#!/usr/bin/env node
/** One-shot managed R-14 proof for an isolated, persistent Doris container beside managed DEV. */
import {createHash, randomUUID} from 'node:crypto';
import {spawn, spawnSync} from 'node:child_process';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {resolveTrustedRemoteHost} from './r5-remote-host-trust.mjs';
import {validateRemoteJavaControl, validateRemoteTdsControl} from './r5-remote-java.mjs';
import {validateManagedRemoteHaproxyBinding} from './r5-dev-runner.mjs';
import {DORIS_RESIDENT_BE_VOLUME, DORIS_RESIDENT_CONTAINER, DORIS_RESIDENT_FE_VOLUME} from './r5-doris-resident.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const runtime = path.resolve(process.env.V2S_RUNTIME_DIR ?? path.join(root, '.runtime/r5'));
const devManifestPath = path.join(runtime, 'run-manifest.json');
const evidenceRoot = path.join(runtime, 'evidence/doris-resident-feasibility');
const imageRef = 'apache/doris:all-in-one-4.1.3';
const probePort = 29030;
const residentEvidenceRunId = 'r5-doris-feasibility-1790872778086-71714-0ff1e0ca-c53f-4352-aac4-448238ff3bc5';
const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
const now = () => new Date().toISOString();
const sha256 = value => createHash('sha256').update(value).digest('hex');
const safe = value => String(value ?? '').replace(/[\r\n\t]/g, ' ').slice(0, 500);
const shellQuote = value => `'${String(value).replaceAll("'", "'\\''")}'`;
const postgresContainerIdGuard = 'case "$pg_container_id" in "$expected_pg_container_prefix"*) ;; *) fail POSTGRES_CONTAINER_ID_DRIFT ;; esac';
const fail = code => { throw new Error(code); };
export const residentPreflightResourceArgs = (repoRoot = root) =>
  ['--profile', 'ter-validation-with-dev', path.join(repoRoot, '.runtime')];

function local(command, args, {input, allowFailure = false} = {}) {
  const result = spawnSync(command, args, {cwd: root, encoding: 'utf8', input});
  if (!allowFailure && result.status !== 0) fail(`${command.toUpperCase()}_FAILED`);
  return result;
}

function canonicalStartToken(pid) {
  const result = local('ps', ['-o', 'lstart=', '-p', String(pid)], {allowFailure: true});
  return result.status === 0 ? result.stdout.trim().replace(/\s+/g, ' ') : '';
}

function parseRemoteFacts(stdout) {
  return stdout.split(/\r?\n/)
    .filter(line => line.startsWith('R5_DORIS_FACT\t'))
    .map(line => line.split('\t'));
}

function validateDev(manifest, trust) {
  if (manifest?.kind !== 'r5-dev-run-manifest' || !manifest.runId ||
      manifest.remoteHostTrust?.host !== trust.host ||
      manifest.remoteHostTrust?.fingerprint?.toLowerCase() !== trust.fingerprint.toLowerCase() ||
      manifest.remoteDiagnostic?.kind !== 'REMOTE_SSH_PULL' ||
      !manifest.remoteDiagnostic?.remoteRoot ||
      !Array.isArray(manifest.processes) || manifest.processes.length === 0) {
    fail('R5_DORIS_PROBE_DEV_MANIFEST_INVALID');
  }
  for (const process of manifest.processes) {
    if (!Number.isInteger(process.pid) || !process.startToken || canonicalStartToken(process.pid) !== process.startToken) {
      fail('R5_DORIS_PROBE_DEV_LOCAL_PROCESS_IDENTITY_INVALID');
    }
  }
  const java = validateRemoteJavaControl(manifest.remoteJava);
  const tdsNodes = (manifest.remoteTdsNodes ?? []).map(validateRemoteTdsControl);
  const haproxy = validateManagedRemoteHaproxyBinding(manifest);
  if (java.runId !== manifest.runId || java.bootId !== manifest.remoteResources?.bootId ||
      tdsNodes.length !== 3 || tdsNodes.some(node => node.runId !== manifest.runId || node.bootId !== java.bootId) ||
      haproxy.hostBootId !== java.bootId) {
    fail('R5_DORIS_PROBE_DEV_REMOTE_IDENTITY_INVALID');
  }
  return {runId: manifest.runId, java, tdsNodes, haproxy, remoteRoot: manifest.remoteDiagnostic.remoteRoot};
}

export function renderRemoteProbeScript({runId, remoteRoot, expectedBootId, dev, marker, database, containerName}) {
  for (const value of [runId, expectedBootId, marker, database, containerName]) {
    if (!/^[A-Za-z0-9._-]{1,128}$/.test(value)) fail('R5_DORIS_PROBE_INPUT_INVALID');
  }
  if (!/^\/tmp\/r5-doris-feasibility-[0-9]+-[0-9]+-[a-f0-9-]{36}$/.test(remoteRoot)) fail('R5_DORIS_PROBE_REMOTE_ROOT_INVALID');
  const expectedPids = [dev.java, ...dev.tdsNodes].map(value => ({pid: value.pid, ticks: value.processStartTicks}));
  const pidAssertions = expectedPids.map(({pid, ticks}) => [
    `pid=${pid}; expected_ticks=${ticks}`,
    'test -r "/proc/$pid/stat" || fail REMOTE_PROCESS_MISSING',
    'line=$(cat "/proc/$pid/stat") || fail REMOTE_PROCESS_STAT_UNREADABLE',
    'tail=${line##*) }; read -r -a fields <<<"$tail"; actual_ticks=${fields[19]:-}',
    'test "$actual_ticks" = "$expected_ticks" || fail REMOTE_PROCESS_START_TICKS_MISMATCH',
  ].join('\n'));
  return [
    'set -Eeuo pipefail',
    `run_id=${shellQuote(runId)}`,
    `remote_root=${shellQuote(remoteRoot)}`,
    `dev_remote_root=${shellQuote(dev.remoteRoot)}`,
    `expected_boot_id=${shellQuote(expectedBootId)}`,
    `container_name=${shellQuote(containerName)}`,
    `dev_run_id=${shellQuote(dev.runId)}`,
    `image_ref=${shellQuote(imageRef)}`,
    `marker=${shellQuote(marker)}`,
    `database=${shellQuote(database)}`,
    `probe_port=${probePort}`,
    'container_id=',
    'cleanup_status=NOT_RUN',
    'fail() { printf "R5_DORIS_PROBE_FAILURE=%s\\n" "$1" >&2; exit 70; }',
    'snapshot() {',
    '  label="$1"',
    '  available_kib=$(awk \'/^MemAvailable:/ {print $2}\' /proc/meminfo)',
    '  cpu_count=$(getconf _NPROCESSORS_ONLN)',
    '  disk_kib=$(df -Pk "$remote_root" | awk \'NR==2 {print $4}\')',
    '  printf "R5_DORIS_FACT\\t%s\\tHOST_RESOURCES\\t%s\\t%s\\t%s\\n" "$label" "$cpu_count" "$((available_kib / 1024))" "$((disk_kib / 1024))"',
    '  if test -n "$container_id"; then docker stats --no-stream --format "R5_DORIS_FACT\\t$label\\tDORIS_STATS\\t{{.MemUsage}}\\t{{.CPUPerc}}" "$container_id"; fi',
    '  printf "R5_DORIS_FACT\\t%s\\tSERVICE_CONTAINERS\\t" "$label"',
    '  docker ps --format "{{.ID}}|{{.Image}}|{{.Names}}|{{.Status}}" | base64 -w0; printf "\\n"',
    '}',
    'started_at=0',
    'cleanup() {',
    '  status=$?',
    '  cleanup_errors=0',
    '  trap - EXIT',
    '  set +e',
    '  if test -z "$container_id"; then container_id=$(docker ps -aq --filter "name=^/${container_name}$" --filter "label=com.catering-v2s.doris-feasibility-run-id=$run_id" | head -n1); fi',
    '  if test -n "$container_id"; then',
    '    labels=$(docker inspect -f \'{{.Id}}|{{.Config.Image}}|{{index .Config.Labels "com.catering-v2s.doris-feasibility-run-id"}}|{{index .Config.Labels "com.catering-v2s.host-boot-id"}}\' "$container_id" 2>/dev/null)',
    '    expected="$container_id|$image_ref|$run_id|$expected_boot_id"',
    '    if test "$labels" = "$expected"; then docker rm -f "$container_id" >/dev/null 2>&1 || cleanup_errors=1; else printf "R5_DORIS_PROBE_CLEANUP_FAILURE=OWNERSHIP_MISMATCH\\n"; cleanup_errors=1; fi',
    '  fi',
    '  if test -d "$remote_root" && test "${remote_root#/tmp/r5-doris-feasibility-}" != "$remote_root" && test "$remote_root" != /tmp; then rm -rf -- "$remote_root" || cleanup_errors=1; fi',
    '  remaining=$(docker ps -aq --filter "label=com.catering-v2s.doris-feasibility-run-id=$run_id" | wc -l | tr -d " ")',
    '  root_absent=false; test ! -e "$remote_root" && root_absent=true',
    '  image_cached=false; docker image inspect "$image_ref" >/dev/null 2>&1 && image_cached=true',
    '  if test "$remaining" = 0 && test "$root_absent" = true && test "$image_cached" = true && test "$cleanup_errors" = 0; then cleanup_status=PASS; else cleanup_status=FAIL; test "$status" != 0 || status=74; fi',
    '  printf "R5_DORIS_PROBE_CLEANUP=%s\\nR5_DORIS_PROBE_CONTAINER_COUNT=%s\\nR5_DORIS_PROBE_ROOT_ABSENT=%s\\nR5_DORIS_PROBE_IMAGE_CACHE_RETAINED=%s\\n" "$cleanup_status" "$remaining" "$root_absent" "$image_cached"',
    '  exit "$status"',
    '}',
    'trap cleanup EXIT',
    `case "$remote_root" in /tmp/r5-doris-feasibility-[0-9]*-[0-9]*-[a-f0-9-]*) ;; *) fail REMOTE_ROOT_NOT_ALLOWED ;; esac`,
    'test ! -e "$remote_root" || fail REMOTE_ROOT_ALREADY_EXISTS',
    'mkdir -m 700 -p "$remote_root/fe-meta" "$remote_root/be-storage" || fail REMOTE_ROOT_CREATE_FAILED',
    'boot_id=$(cat /proc/sys/kernel/random/boot_id) || fail REMOTE_BOOT_ID_READ_FAILED',
    'test "$boot_id" = "$expected_boot_id" || fail DEV_HOST_BOOT_ID_CHANGED',
    ...pidAssertions,
    `haproxy_id=${shellQuote(dev.haproxy.containerId)}`,
    `haproxy_image_id=${shellQuote(dev.haproxy.containerImageId)}`,
    `haproxy_image_ref=${shellQuote(dev.haproxy.imageRef)}`,
    `haproxy_config_sha256=${shellQuote(dev.haproxy.configSha256)}`,
    'haproxy_identity=$(docker inspect -f \'{{.Id}}|{{.Image}}|{{.Config.Image}}|{{.State.Running}}|{{index .Config.Labels "com.catering-v2s.run-id"}}|{{index .Config.Labels "com.catering-v2s.remote-root"}}|{{index .Config.Labels "com.catering-v2s.host-boot-id"}}|{{index .Config.Labels "com.catering-v2s.image-ref"}}|{{index .Config.Labels "com.catering-v2s.config-sha256"}}\' "$haproxy_id") || fail DEV_HAPROXY_IDENTITY_UNAVAILABLE',
    'expected_haproxy_identity="$haproxy_id|$haproxy_image_id|$haproxy_image_ref|true|$dev_run_id|$dev_remote_root|$expected_boot_id|$haproxy_image_ref|$haproxy_config_sha256"',
    'printf "R5_DORIS_FACT\\tIDENTITY\\tDEV_HAPROXY_IDENTITY_MATCH\\t%s\\n" "$(test "$haproxy_identity" = "$expected_haproxy_identity" && echo true || echo false)"',
    'test "$haproxy_identity" = "$expected_haproxy_identity" || { printf "R5_DORIS_PROBE_HAPROXY_IDENTITY_ACTUAL_B64=%s\\n" "$(printf %s "$haproxy_identity" | base64 -w0)"; printf "R5_DORIS_PROBE_HAPROXY_IDENTITY_EXPECTED_B64=%s\\n" "$(printf %s "$expected_haproxy_identity" | base64 -w0)"; fail DEV_HAPROXY_IDENTITY_INVALID; }',
    'docker inspect -f \'{{.State.Running}}\' catering-postgres | grep -Fx true >/dev/null || fail POSTGRES_NOT_RUNNING',
    'docker inspect -f \'{{.State.Running}}\' catering-v2s-r5-minio | grep -Fx true >/dev/null || fail MINIO_NOT_RUNNING',
    `if ss -ltnH "sport = :$probe_port" | grep -q .; then fail PROBE_LOOPBACK_PORT_BUSY; fi`,
    'before_available_kib=$(awk \'/^MemAvailable:/ {print $2}\' /proc/meminfo)',
    'before_disk_kib=$(df -Pk "$remote_root" | awk \'NR==2 {print $4}\')',
    'test "$before_available_kib" -ge 2097152 || fail DORIS_RESOURCE_PREFLIGHT_MEMORY_LT_2048_MIB',
    'test "$before_disk_kib" -ge 3145728 || fail DORIS_RESOURCE_PREFLIGHT_DISK_LT_3072_MIB',
    'boot_id=$boot_id; kernel=$(uname -r); docker_version=$(docker version --format \'{{.Server.Version}}\')',
    'docker_memory=$(docker info --format \'{{.MemTotal}}\')',
    'image_before=$(docker image inspect -f \'{{.Id}}|{{json .RepoDigests}}\' "$image_ref" 2>/dev/null || true)',
    'image_cache=HIT; test -n "$image_before" || image_cache=COLD_PULL',
    'printf "R5_DORIS_FACT\\tIDENTITY\\tREMOTE_HOST_BOOT_ID\\t%s\\n" "$boot_id"',
    'printf "R5_DORIS_FACT\\tIDENTITY\\tDOCKER_VERSION\\t%s\\n" "$docker_version"',
    'printf "R5_DORIS_FACT\\tIDENTITY\\tDOCKER_MEMORY_BYTES\\t%s\\n" "$docker_memory"',
    'printf "R5_DORIS_FACT\\tIDENTITY\\tKERNEL\\t%s\\n" "$kernel"',
    'printf "R5_DORIS_FACT\\tIDENTITY\\tIMAGE_CACHE\\t%s\\n" "$image_cache"',
    'printf "R5_DORIS_FACT\\tIDENTITY\\tIMAGE_BEFORE\\t%s\\n" "$(printf %s "$image_before" | base64 -w0)"',
    'snapshot BEFORE_DORIS',
    'start_epoch=$(date +%s)',
    'container_id=$(docker run --detach --name "$container_name" --label "com.catering-v2s.doris-feasibility-run-id=$run_id" --label "com.catering-v2s.host-boot-id=$expected_boot_id" --publish "127.0.0.1:$probe_port:9030" --mount "type=bind,src=$remote_root/fe-meta,dst=/opt/apache-doris/fe/doris-meta" --mount "type=bind,src=$remote_root/be-storage,dst=/opt/apache-doris/be/storage" "$image_ref") || fail DORIS_CONTAINER_START_FAILED',
    'printf "R5_DORIS_FACT\\tCONTAINER\\tCONTAINER_ID\\t%s\\n" "$container_id"',
    'docker inspect -f \'{{.Image}}|{{.Config.Image}}|{{json .Mounts}}\' "$container_id" | base64 -w0 | sed \'s/^/R5_DORIS_FACT\\tCONTAINER\\tIMAGE_MOUNTS_B64\\t/\'',
    'ready=false; for attempt in $(seq 1 120); do health=$(docker inspect -f \'{{.State.Health.Status}}\' "$container_id" 2>/dev/null || true); if test "$health" = healthy; then ready=true; printf "R5_DORIS_FACT\\tSTARTUP\\tHEALTH_READY_ATTEMPT\\t%s\\n" "$attempt"; break; fi; if (( attempt % 10 == 0 )); then printf "R5_DORIS_HEARTBEAT phase=INITIAL_HEALTH attempt=%s health=%s\\n" "$attempt" "${health:-unavailable}"; fi; sleep 2; done',
    'test "$ready" = true || { docker logs --tail 120 "$container_id" >&2 || true; fail DORIS_INITIAL_HEALTH_TIMEOUT; }',
    'healthy_epoch=$(date +%s); printf "R5_DORIS_FACT\\tSTARTUP\\tHEALTH_SECONDS\\t%s\\n" "$((healthy_epoch - start_epoch))"',
    'docker exec "$container_id" mysql -uroot -h127.0.0.1 -P9030 -e "CREATE DATABASE IF NOT EXISTS $database" >/dev/null || fail DORIS_CREATE_DATABASE_FAILED',
    'docker exec "$container_id" mysql -uroot -h127.0.0.1 -P9030 -e "CREATE TABLE $database.persistence_probe (id INT, marker VARCHAR(128)) ENGINE=OLAP DUPLICATE KEY(id) DISTRIBUTED BY HASH(id) BUCKETS 1 PROPERTIES (\\\"replication_num\\\"=\\\"1\\\")" >/dev/null || fail DORIS_CREATE_TABLE_FAILED',
    'docker exec "$container_id" mysql -uroot -h127.0.0.1 -P9030 -e "INSERT INTO $database.persistence_probe VALUES (1, \\\"$marker\\\")" >/dev/null || fail DORIS_INSERT_MARKER_FAILED',
    'before_restart=$(docker exec "$container_id" mysql -uroot -h127.0.0.1 -P9030 -N -e "SELECT marker FROM $database.persistence_probe WHERE id=1")',
    'test "$before_restart" = "$marker" || fail DORIS_PRE_RESTART_READBACK_MISMATCH',
    'container_pid=$(docker inspect -f \'{{.State.Pid}}\' "$container_id")',
    'container_start_ticks=$(cat "/proc/$container_pid/stat" | sed \'s/.*) //\' | awk \'{print $20}\')',
    'container_memory_limit=$(docker inspect -f \'{{.HostConfig.Memory}}\' "$container_id")',
    'printf "R5_DORIS_FACT\\tIDENTITY\\tCONTAINER_PID\\t%s\\t%s\\t%s\\n" "$container_pid" "$container_start_ticks" "$boot_id"',
    'printf "R5_DORIS_FACT\\tMEASUREMENT\\tDORIS_MEMORY_LIMIT_BYTES\\t%s\\n" "$container_memory_limit"',
    'snapshot BEFORE_RESTART',
    'docker stop --time 30 "$container_id" >/dev/null || fail DORIS_GRACEFUL_STOP_FAILED',
    'docker start "$container_id" >/dev/null || fail DORIS_RESTART_FAILED',
    'ready=false; for attempt in $(seq 1 120); do health=$(docker inspect -f \'{{.State.Health.Status}}\' "$container_id" 2>/dev/null || true); if test "$health" = healthy; then ready=true; printf "R5_DORIS_FACT\\tRESTART\\tHEALTH_READY_ATTEMPT\\t%s\\n" "$attempt"; break; fi; if (( attempt % 10 == 0 )); then printf "R5_DORIS_HEARTBEAT phase=RESTART_HEALTH attempt=%s health=%s\\n" "$attempt" "${health:-unavailable}"; fi; sleep 2; done',
    'test "$ready" = true || { docker logs --tail 120 "$container_id" >&2 || true; fail DORIS_RESTART_HEALTH_TIMEOUT; }',
    'after_restart=$(docker exec "$container_id" mysql -uroot -h127.0.0.1 -P9030 -N -e "SELECT marker FROM $database.persistence_probe WHERE id=1")',
    'test "$after_restart" = "$marker" || fail DORIS_PERSISTENT_VOLUME_READBACK_MISMATCH',
    'printf "R5_DORIS_FACT\\tPERSISTENCE\\tMARKER_READBACK\\tPASS\\n"',
    'snapshot AFTER_RESTART',
    'printf "R5_DORIS_FEASIBILITY=PASS\\n"',
    'exit 0',
  ].join('\n');
}

export function residentPreflightIdentity(manifest) {
  if (manifest?.kind !== 'r5-managed-doris-resident-feasibility' ||
      manifest.runId !== residentEvidenceRunId || manifest.feasibility !== 'PASS' || manifest.cleanup !== 'PASS' ||
      typeof manifest.remoteHost !== 'string' || typeof manifest.remoteBootId !== 'string' ||
      !Array.isArray(manifest.remoteFacts)) fail('R5_DORIS_PREFLIGHT_RESIDENT_EVIDENCE_INVALID');
  const imageBefore = manifest.remoteFacts.find(row => row[0] === 'IDENTITY' && row[1] === 'IMAGE_BEFORE')?.[2];
  if (typeof imageBefore !== 'string') fail('R5_DORIS_PREFLIGHT_RESIDENT_IMAGE_EVIDENCE_MISSING');
  let decoded;
  try {
    const value = Buffer.from(imageBefore, 'base64').toString('utf8');
    const separator = value.indexOf('|');
    if (separator < 0) fail('R5_DORIS_PREFLIGHT_RESIDENT_IMAGE_EVIDENCE_INVALID');
    decoded = {imageId: value.slice(0, separator), repoDigests: JSON.parse(value.slice(separator + 1))};
  } catch {
    fail('R5_DORIS_PREFLIGHT_RESIDENT_IMAGE_EVIDENCE_INVALID');
  }
  const repoDigest = decoded.repoDigests.find(value => value === `${imageRef.replace(':all-in-one-4.1.3', '')}@${decoded.imageId}`);
  if (!/^sha256:[a-f0-9]{64}$/.test(decoded.imageId) || !repoDigest) fail('R5_DORIS_PREFLIGHT_RESIDENT_IMAGE_EVIDENCE_INVALID');
  const serviceContainers = manifest.remoteFacts.find(row => row[0] === 'BEFORE_DORIS' && row[1] === 'SERVICE_CONTAINERS')?.[2];
  if (typeof serviceContainers !== 'string') fail('R5_DORIS_PREFLIGHT_RESIDENT_POSTGRES_EVIDENCE_MISSING');
  const containerLines = Buffer.from(serviceContainers.replace(/^STDOUT\s+/, ''), 'base64').toString('utf8').trim().split(/\r?\n/);
  const postgres = containerLines.map(line => line.split('|')).find(([, , name]) => name === 'catering-postgres');
  if (!postgres || !/^[a-f0-9]{12,64}$/.test(postgres[0])) fail('R5_DORIS_PREFLIGHT_RESIDENT_POSTGRES_EVIDENCE_INVALID');
  return {runId: manifest.runId, host: manifest.remoteHost, bootId: manifest.remoteBootId, imageId: decoded.imageId, repoDigest, postgresContainerPrefix: postgres[0]};
}

export function assertResidentPreflightHost(baselineHost, trustedHost) {
  if (typeof baselineHost !== 'string' || baselineHost !== trustedHost) fail('R5_DORIS_PREFLIGHT_REMOTE_HOST_DRIFT');
  return trustedHost;
}

export function renderRemotePreflightScript({expectedBootId, expectedImageId, expectedRepoDigest, expectedPostgresContainerPrefix}) {
  if (!/^[a-f0-9-]{36}$/i.test(expectedBootId) || !/^sha256:[a-f0-9]{64}$/.test(expectedImageId) ||
      !/^apache\/doris@sha256:[a-f0-9]{64}$/.test(expectedRepoDigest) ||
      !/^[a-f0-9]{12,64}$/.test(expectedPostgresContainerPrefix)) fail('R5_DORIS_PREFLIGHT_EXPECTED_IDENTITY_INVALID');
  return [
    'set -Eeuo pipefail',
    `expected_boot_id=${shellQuote(expectedBootId)}`,
    `expected_image_id=${shellQuote(expectedImageId)}`,
    `expected_repo_digest=${shellQuote(expectedRepoDigest)}`,
    `expected_pg_container_prefix=${shellQuote(expectedPostgresContainerPrefix)}`,
    `image_ref=${shellQuote(imageRef)}`,
    `resident_container=${shellQuote(DORIS_RESIDENT_CONTAINER)}`,
    `resident_fe_volume=${shellQuote(DORIS_RESIDENT_FE_VOLUME)}`,
    `resident_be_volume=${shellQuote(DORIS_RESIDENT_BE_VOLUME)}`,
    'fail() { printf "R5_DORIS_PREFLIGHT_FAILURE=%s\\n" "$1" >&2; exit 70; }',
    'boot_id=$(cat /proc/sys/kernel/random/boot_id) || fail REMOTE_BOOT_ID_READ_FAILED',
    'cpu_count=$(getconf _NPROCESSORS_ONLN) || fail REMOTE_CPU_READ_FAILED',
    'mem_total_kib=$(awk \'/^MemTotal:/ {print $2}\' /proc/meminfo) || fail REMOTE_MEMORY_READ_FAILED',
    'mem_available_kib=$(awk \'/^MemAvailable:/ {print $2}\' /proc/meminfo) || fail REMOTE_MEMORY_READ_FAILED',
    'swap_total_kib=$(awk \'/^SwapTotal:/ {print $2}\' /proc/meminfo) || fail REMOTE_SWAP_READ_FAILED',
    'swap_free_kib=$(awk \'/^SwapFree:/ {print $2}\' /proc/meminfo) || fail REMOTE_SWAP_READ_FAILED',
    'docker_version=$(docker version --format \'{{.Server.Version}}\') || fail DOCKER_VERSION_READ_FAILED',
    'docker_memory=$(docker info --format \'{{.MemTotal}}\') || fail DOCKER_MEMORY_READ_FAILED',
    'docker_root=$(docker info --format \'{{.DockerRootDir}}\') || fail DOCKER_ROOT_READ_FAILED',
    'disk_available_kib=$(df -Pk "$docker_root" | awk \'NR==2 {print $4}\') || fail REMOTE_DISK_READ_FAILED',
    'pg_running=$(docker inspect -f \'{{.State.Running}}\' catering-postgres 2>/dev/null) || fail POSTGRES_CONTAINER_UNAVAILABLE',
    'test "$pg_running" = true || fail POSTGRES_NOT_RUNNING',
    'pg_identity=$(docker inspect -f \'{{.Id}}|{{.Image}}|{{.Config.Image}}\' catering-postgres) || fail POSTGRES_IDENTITY_READ_FAILED',
    'pg_container_id=${pg_identity%%|*}',
    'pg_server_version=$(docker exec catering-postgres psql -U catering -d postgres -Atqc "SHOW server_version") || fail POSTGRES_SERVER_VERSION_READ_FAILED',
    'doris_image=$(docker image inspect -f \'{{.Id}}|{{json .RepoDigests}}\' "$image_ref" 2>/dev/null) || fail DORIS_IMAGE_NOT_CACHED',
    'testcontainers_containers=$(docker ps -aq --filter label=org.testcontainers=true | paste -sd, -)',
    'testcontainers_volumes=$(docker volume ls -q --filter label=org.testcontainers=true | paste -sd, -)',
    'printf "R5_DORIS_PREFLIGHT_FACT\\tHOST\\tBOOT_ID\\t%s\\n" "$boot_id"',
    'printf "R5_DORIS_PREFLIGHT_FACT\\tHOST\\tCPU_COUNT\\t%s\\n" "$cpu_count"',
    'printf "R5_DORIS_PREFLIGHT_FACT\\tHOST\\tMEM_TOTAL_MIB\\t%s\\n" "$((mem_total_kib / 1024))"',
    'printf "R5_DORIS_PREFLIGHT_FACT\\tHOST\\tMEM_AVAILABLE_MIB\\t%s\\n" "$((mem_available_kib / 1024))"',
    'printf "R5_DORIS_PREFLIGHT_FACT\\tHOST\\tSWAP_TOTAL_MIB\\t%s\\n" "$((swap_total_kib / 1024))"',
    'printf "R5_DORIS_PREFLIGHT_FACT\\tHOST\\tSWAP_FREE_MIB\\t%s\\n" "$((swap_free_kib / 1024))"',
    'printf "R5_DORIS_PREFLIGHT_FACT\\tHOST\\tDOCKER_DISK_AVAILABLE_MIB\\t%s\\n" "$((disk_available_kib / 1024))"',
    'printf "R5_DORIS_PREFLIGHT_FACT\\tDOCKER\\tVERSION\\t%s\\n" "$docker_version"',
    'printf "R5_DORIS_PREFLIGHT_FACT\\tDOCKER\\tMEMORY_BYTES\\t%s\\n" "$docker_memory"',
    'printf "R5_DORIS_PREFLIGHT_FACT\\tPOSTGRES\\tIDENTITY\\t%s\\n" "$pg_identity"',
    'printf "R5_DORIS_PREFLIGHT_FACT\\tPOSTGRES\\tSERVER_VERSION\\t%s\\n" "$pg_server_version"',
    'printf "R5_DORIS_PREFLIGHT_FACT\\tDORIS\\tIMAGE\\t%s\\n" "$doris_image"',
    'printf "R5_DORIS_PREFLIGHT_FACT\\tTESTCONTAINERS\\tCONTAINERS\\t%s\\n" "${testcontainers_containers:-EMPTY}"',
    'printf "R5_DORIS_PREFLIGHT_FACT\\tTESTCONTAINERS\\tVOLUMES\\t%s\\n" "${testcontainers_volumes:-EMPTY}"',
    'test "$boot_id" = "$expected_boot_id" || fail RESIDENT_HOST_BOOT_ID_DRIFT',
    postgresContainerIdGuard,
    'image_id=${doris_image%%|*}',
    'test "$image_id" = "$expected_image_id" || fail RESIDENT_DORIS_IMAGE_ID_DRIFT',
    'printf "%s\\n" "$doris_image" | grep -F "$expected_repo_digest" >/dev/null || fail RESIDENT_DORIS_REPO_DIGEST_DRIFT',
    'test -z "$testcontainers_containers" || fail TESTCONTAINERS_CONTAINER_RESIDUE',
    'test -z "$testcontainers_volumes" || fail TESTCONTAINERS_VOLUME_RESIDUE',
    'resident_container_facts=$(docker inspect -f \'{{.Id}}|{{.Image}}|{{.Config.Image}}|{{index .Config.Labels "com.catering-v2s.doris-resident"}}|{{index .Config.Labels "com.catering-v2s.doris-resident.host-fingerprint"}}|{{index .Config.Labels "com.catering-v2s.doris-resident.attempt"}}|{{.State.Running}}|{{.State.Health.Status}}|{{range .Mounts}}{{.Name}}:{{.Destination}};{{end}}\' "$resident_container" 2>/dev/null || true)',
    'printf "R5_DORIS_PREFLIGHT_FACT\\tDORIS\\tRESIDENT_CONTAINER_B64\\t%s\\n" "$(printf %s "$resident_container_facts" | base64 -w0)"',
    'for volume in "$resident_fe_volume" "$resident_be_volume"; do',
    '  volume_facts=$(docker volume inspect -f \'{{.Name}}|{{.Driver}}|{{index .Labels "com.catering-v2s.doris-resident"}}|{{index .Labels "com.catering-v2s.doris-resident.attempt"}}\' "$volume" 2>/dev/null || true)',
    '  holders=$(docker ps -aq --filter "volume=$volume" | paste -sd, -)',
    '  printf "R5_DORIS_PREFLIGHT_FACT\\tDORIS\\tVOLUME_OCCUPANTS_B64\\t%s\\n" "$(printf %s "$volume|$volume_facts|$holders" | base64 -w0)"',
    '  for holder in $(docker ps -aq --filter "volume=$volume"); do',
    '    holder_facts=$(docker inspect -f \'{{.Id}}|{{.Name}}|{{.Image}}|{{.Config.Image}}|{{index .Config.Labels "com.catering-v2s.doris-resident"}}|{{index .Config.Labels "com.catering-v2s.doris-resident.host-fingerprint"}}|{{index .Config.Labels "com.catering-v2s.doris-resident.attempt"}}|{{.State.Running}}|{{range .Mounts}}{{.Name}}:{{.Destination}};{{end}}\' "$holder") || fail DORIS_RESIDENT_VOLUME_HOLDER_INSPECT_FAILED',
    '    printf "R5_DORIS_PREFLIGHT_FACT\\tDORIS\\tVOLUME_HOLDER_B64\\t%s\\n" "$(printf %s "$holder_facts" | base64 -w0)"',
    '  done',
    'done',
    'printf "%s\\n" R5_DORIS_PREFLIGHT=PASS R5_DORIS_PREFLIGHT_CLEANUP=PASS_NO_REMOTE_MUTATION',
  ].join('\n');
}

function parseRemotePreflightFacts(stdout) {
  return stdout.split(/\r?\n/).filter(line => line.startsWith('R5_DORIS_PREFLIGHT_FACT\t')).map(line => line.split('\t').slice(1));
}

function selfTest() {
  if (shellQuote("a'b") !== "'a'\\''b'") fail('R5_DORIS_PROBE_SELF_TEST_SHELL_QUOTE');
  if (JSON.stringify(residentPreflightResourceArgs('/workspace/repo')) !==
      JSON.stringify(['--profile', 'ter-validation-with-dev', '/workspace/repo/.runtime']))
    fail('R5_DORIS_PREFLIGHT_SELF_TEST_RESOURCE_PROFILE_RED');
  const rendered = renderRemoteProbeScript({
    runId: 'r5probe-1', remoteRoot: `/tmp/r5-doris-feasibility-1-2-${'a'.repeat(8)}-1111-1111-1111-111111111111`,
    expectedBootId: 'a'.repeat(32), dev: {runId:'r5-dev-1-2-aaaaaaaa-1111-1111-1111-111111111111',remoteRoot:'/tmp/r5-dev-1-2-aaaaaaaa-1111-1111-1111-111111111111',java:{pid:1,processStartTicks:1},tdsNodes:[{pid:2,processStartTicks:2},{pid:3,processStartTicks:3},{pid:4,processStartTicks:4}],haproxy:{containerId:'a'.repeat(64)}},
    marker:'marker',database:'r5_probe_1',containerName:'r5-probe-1',
  });
  if (!/DORIS_PERSISTENT_VOLUME_READBACK_MISMATCH/.test(rendered)) fail('R5_DORIS_PROBE_SELF_TEST_PERSISTENCE_RED');
  if (!/dev_remote_root='\/tmp\/r5-dev-/.test(rendered) || !/\$dev_run_id\|\$dev_remote_root\|\$expected_boot_id/.test(rendered))
    fail('R5_DORIS_PROBE_SELF_TEST_DEV_IDENTITY_ROOT_BINDING_RED');
  if (/\$probePort\b/.test(rendered) || !/sport = :\$probe_port/.test(rendered))
    fail('R5_DORIS_PROBE_SELF_TEST_PORT_PREFLIGHT_RED');
  const parsedFacts = parseRemoteFacts([
    'R5_DORIS_FACT\tCONTAINER\tCONTAINER_ID\tabc123',
    'R5_DORIS_FACT\tIDENTITY\tCONTAINER_PID\t123\t456\tboot-id',
  ].join('\n'));
  const parsedContainer = parsedFacts.find(row => row[1] === 'CONTAINER' && row[2] === 'CONTAINER_ID');
  const parsedProcess = parsedFacts.find(row => row[1] === 'IDENTITY' && row[2] === 'CONTAINER_PID');
  if (parsedContainer?.[3] !== 'abc123' || parsedProcess?.[3] !== '123' || parsedProcess?.[4] !== '456' || parsedProcess?.[5] !== 'boot-id')
    fail('R5_DORIS_PROBE_SELF_TEST_FACT_COLUMN_BINDING_RED');
  const shellSyntax = local('bash', ['-n'], {input: rendered, allowFailure: true});
  if (shellSyntax.status !== 0) fail('R5_DORIS_PROBE_SELF_TEST_REMOTE_SHELL_SYNTAX');
  const preflight = renderRemotePreflightScript({expectedBootId:'a'.repeat(8)+'-'.concat('a'.repeat(4),'-','a'.repeat(4),'-','a'.repeat(4),'-','a'.repeat(12)),expectedImageId:`sha256:${'b'.repeat(64)}`,expectedRepoDigest:`apache/doris@sha256:${'b'.repeat(64)}`,expectedPostgresContainerPrefix:'c'.repeat(12)});
  const preflightSyntax = local('bash', ['-n'], {input: preflight, allowFailure: true});
  if (preflightSyntax.status !== 0 || !/SHOW server_version/.test(preflight) || !/POSTGRES_CONTAINER_ID_DRIFT/.test(preflight) || /docker (?:run|pull|rm|stop|start)\b/.test(preflight))
    fail('R5_DORIS_PREFLIGHT_SELF_TEST_READ_ONLY_BOUNDARY');
  if (!preflight.includes(DORIS_RESIDENT_CONTAINER) || !preflight.includes(DORIS_RESIDENT_FE_VOLUME) ||
      !preflight.includes(DORIS_RESIDENT_BE_VOLUME) || !/docker ps -aq --filter "volume=\$volume"/.test(preflight) ||
      /docker (?:container (?:rm|stop|start)|volume (?:create|rm))\b/.test(preflight))
    fail('R5_DORIS_PREFLIGHT_SELF_TEST_RESIDENT_OCCUPANT_READ_ONLY');
  if (!/RESIDENT_HOST_BOOT_ID_DRIFT/.test(preflight) || !/RESIDENT_DORIS_IMAGE_ID_DRIFT/.test(preflight) ||
      !/TESTCONTAINERS_CONTAINER_RESIDUE/.test(preflight) || !/TESTCONTAINERS_VOLUME_RESIDUE/.test(preflight))
    fail('R5_DORIS_PREFLIGHT_SELF_TEST_DRIFT_RED');
  const syntheticImageId = `sha256:${'c'.repeat(64)}`;
  const syntheticImageFacts = Buffer.from(`${syntheticImageId}|["apache/doris@${syntheticImageId}"]`).toString('base64');
  const syntheticServiceContainers = Buffer.from('39d62539cece|postgres:16-alpine|catering-postgres|Up').toString('base64');
  const syntheticIdentity = residentPreflightIdentity({
    kind: 'r5-managed-doris-resident-feasibility', runId: residentEvidenceRunId,
    remoteHost: 'catering-remote-dev', remoteBootId: 'b37e1fe3-4e4b-4459-9f5c-7620f3f26063',
    feasibility: 'PASS', cleanup: 'PASS', remoteFacts: [
      ['IDENTITY', 'IMAGE_BEFORE', syntheticImageFacts],
      ['BEFORE_DORIS', 'SERVICE_CONTAINERS', `STDOUT ${syntheticServiceContainers}`],
    ],
  });
  if (syntheticIdentity.imageId !== syntheticImageId || syntheticIdentity.repoDigest !== `apache/doris@${syntheticImageId}` ||
      syntheticIdentity.postgresContainerPrefix !== '39d62539cece')
    fail('R5_DORIS_PREFLIGHT_SELF_TEST_EVIDENCE_BINDING_RED');
  let postgresEvidenceRejected = false;
  try {
    residentPreflightIdentity({
      kind: 'r5-managed-doris-resident-feasibility', runId: residentEvidenceRunId,
      remoteHost: 'catering-remote-dev', remoteBootId: 'b37e1fe3-4e4b-4459-9f5c-7620f3f26063',
      feasibility: 'PASS', cleanup: 'PASS', remoteFacts: [['IDENTITY', 'IMAGE_BEFORE', syntheticImageFacts]],
    });
  } catch (error) { postgresEvidenceRejected = error.message === 'R5_DORIS_PREFLIGHT_RESIDENT_POSTGRES_EVIDENCE_MISSING'; }
  if (!postgresEvidenceRejected) fail('R5_DORIS_PREFLIGHT_SELF_TEST_POSTGRES_BASELINE_RED');
  assertResidentPreflightHost(syntheticIdentity.host, 'catering-remote-dev');
  let hostDriftRejected = false;
  try { assertResidentPreflightHost(syntheticIdentity.host, 'untrusted-host'); }
  catch (error) { hostDriftRejected = error.message === 'R5_DORIS_PREFLIGHT_REMOTE_HOST_DRIFT'; }
  if (!hostDriftRejected) fail('R5_DORIS_PREFLIGHT_SELF_TEST_HOST_BINDING_RED');
  const postgresGuardPass = local('bash', ['-c', `fail() { printf '%s\\n' "$1" >&2; exit 70; }; pg_container_id=39d62539cece${'0'.repeat(52)}; expected_pg_container_prefix=39d62539cece; ${postgresContainerIdGuard}`], {allowFailure: true});
  const postgresGuardRed = local('bash', ['-c', `fail() { printf '%s\\n' "$1" >&2; exit 70; }; pg_container_id=${'0'.repeat(64)}; expected_pg_container_prefix=39d62539cece; ${postgresContainerIdGuard}`], {allowFailure: true});
  if (postgresGuardPass.status !== 0 || postgresGuardRed.status !== 70 || !postgresGuardRed.stderr.includes('POSTGRES_CONTAINER_ID_DRIFT'))
    fail('R5_DORIS_PREFLIGHT_SELF_TEST_POSTGRES_IDENTITY_RED');
  process.stdout.write('R5_DORIS_RESIDENT_FEASIBILITY_SELF_TEST=PASS\nRED=UNSAFE_ROOT,INVALID_IDENTIFIERS,NO_RESTART_READBACK,RESIDENT_HOST_OR_IMAGE_DRIFT,POSTGRES_CONTAINER_ID_DRIFT,TESTCONTAINERS_RESIDUE,WRONG_PREFLIGHT_RESOURCE_PROFILE\n');
}

async function runRemote(host, payload, logPath, manifest, manifestPath) {
  return await new Promise(resolve => {
    const child = spawn('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', host, 'bash', '-s'], {cwd: root, stdio: ['pipe', 'pipe', 'pipe']});
    manifest.localSshProcess = {pid: child.pid, startToken: child.pid ? canonicalStartToken(child.pid) : null};
    manifest.remotePhaseStartedAt = now();
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {mode: 0o600});
    const streams = {stdout: '', stderr: ''};
    const writeChunk = (name, chunk) => {
      const value = chunk.toString();
      streams[name] += value;
      appendFileSync(logPath, `${name.toUpperCase()} ${value}`, {mode: 0o600});
      process[name === 'stdout' ? 'stdout' : 'stderr'].write(value);
    };
    child.stdout.on('data', chunk => writeChunk('stdout', chunk));
    child.stderr.on('data', chunk => writeChunk('stderr', chunk));
    const heartbeat = setInterval(() => {
      manifest.phase = 'REMOTE_PROBE_RUNNING';
      manifest.heartbeatAt = now();
      writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {mode: 0o600});
      process.stdout.write(`R5_DORIS_RESIDENT_PROBE_HEARTBEAT at=${manifest.heartbeatAt}\n`);
    }, 20_000);
    child.on('error', error => { clearInterval(heartbeat); resolve({status: -1, ...streams, error: safe(error.message)}); });
    child.on('close', status => { clearInterval(heartbeat); resolve({status, ...streams}); });
    child.stdin.end(payload);
  });
}

async function main() {
  const trust = resolveTrustedRemoteHost(process.env);
  if (!existsSync(devManifestPath)) fail('R5_DORIS_PROBE_REQUIRES_MANAGED_DEV');
  const devManifest = JSON.parse(readFileSync(devManifestPath, 'utf8'));
  const dev = validateDev(devManifest, trust);
  const budget = local(path.join(root, 'scripts/env/check-runtime-resource-budget'), [
    '--profile', 'ter-validation-with-dev', path.join(root, '.runtime'),
  ]);
  const runId = `r5-doris-feasibility-${Date.now()}-${process.pid}-${randomUUID()}`;
  const remoteRoot = `/tmp/${runId}`;
  const evidenceDir = path.join(evidenceRoot, runId);
  mkdirSync(evidenceDir, {recursive: true, mode: 0o700});
  const stdoutPath = path.join(evidenceDir, 'probe.log');
  const manifestPath = path.join(evidenceDir, 'run-manifest.json');
  const startToken = canonicalStartToken(process.pid);
  if (!startToken) fail('R5_DORIS_PROBE_LOCAL_IDENTITY_UNAVAILABLE');
  const manifest = {
    schemaVersion: 1,
    kind: 'r5-managed-doris-resident-feasibility',
    runId,
    startedAt: now(),
    phase: 'PREFLIGHT_PASS',
    business: 'NOT_APPLICABLE',
    cleanup: 'NOT_RUN',
    feasibility: 'NOT_RUN',
    devWasRunning: true,
    devRunId: devManifest.runId,
    remoteHost: trust.host,
    remoteBootId: dev.java.bootId,
    localProcess: {pid: process.pid, startToken},
    localResourcePreflight: safe(budget.stdout.trim()),
    imageRef,
    remoteRoot,
    probePort,
    sourceSha256: sha256(readFileSync(fileURLToPath(import.meta.url))),
    evidence: {log: stdoutPath},
  };
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {mode: 0o600});
  process.stdout.write(`R5_DORIS_RESIDENT_PROBE=START runId=${runId} host=${trust.host} devRunId=${devManifest.runId}\n`);
  const marker = `probe-${randomUUID()}`;
  const database = `r5_probe_${Date.now()}_${process.pid}`;
  const containerName = `catering-v2s-r5-doris-probe-${process.pid}-${Date.now()}`;
  const payload = renderRemoteProbeScript({
    runId, remoteRoot, expectedBootId: dev.java.bootId,
    dev,
    marker, database, containerName,
  });
  const result = await runRemote(trust.host, payload, stdoutPath, manifest, manifestPath);
  const cleanupMatch = /R5_DORIS_PROBE_CLEANUP=(PASS|FAIL)/.exec(result.stdout + result.stderr);
  const feasibilityPass = result.status === 0 && /R5_DORIS_FEASIBILITY=PASS/.test(result.stdout);
  const facts = parseRemoteFacts(result.stdout);
  manifest.remoteFacts = facts.map(([, ...fields]) => fields);
  const containerIdentity = facts.find(row => row[1] === 'IDENTITY' && row[2] === 'CONTAINER_PID');
  if (containerIdentity) manifest.remoteContainerProcess = {pid: Number(containerIdentity[3]), startTicks: Number(containerIdentity[4]), bootId: containerIdentity[5]};
  const containerIdFact = facts.find(row => row[1] === 'CONTAINER' && row[2] === 'CONTAINER_ID');
  if (containerIdFact) manifest.remoteContainerId = containerIdFact[3];
  manifest.completedAt = now();
  manifest.phase = result.status === 0 ? 'COMPLETE' : 'FAILED';
  manifest.feasibility = feasibilityPass ? 'PASS' : 'FAIL';
  manifest.cleanup = cleanupMatch?.[1] ?? 'FAIL';
  manifest.firstFailure = feasibilityPass ? null : safe((result.stderr || result.stdout || result.error || `SSH_EXIT_${result.status}`).split('\n').find(line => /FAIL|ERROR|REFUSED/.test(line)) ?? `SSH_EXIT_${result.status}`);
  manifest.lastKnownGood = 'REMOTE_MANAGED_DEV_IDENTITY_AND_RESOURCE_PREFLIGHT';
  manifest.brokenBoundary = feasibilityPass ? null : 'REMOTE_DORIS_RESIDENT_PROBE';
  manifest.stdoutSha256 = sha256(result.stdout);
  manifest.stderrSha256 = sha256(result.stderr);
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {mode: 0o600});
  process.stdout.write(`R5_DORIS_RESIDENT_PROBE_RESULT=${manifest.feasibility} cleanup=${manifest.cleanup} runId=${runId} manifest=${manifestPath}\n`);
  if (!feasibilityPass || manifest.cleanup !== 'PASS') process.exitCode = 2;
}

async function mainPreflight() {
  const trust = resolveTrustedRemoteHost(process.env);
  const priorManifestPath = path.join(evidenceRoot, residentEvidenceRunId, 'run-manifest.json');
  if (!existsSync(priorManifestPath)) fail('R5_DORIS_PREFLIGHT_RESIDENT_EVIDENCE_MISSING');
  const baseline = residentPreflightIdentity(JSON.parse(readFileSync(priorManifestPath, 'utf8')));
  assertResidentPreflightHost(baseline.host, trust.host);
  const budget = local(path.join(root, 'scripts/env/check-runtime-resource-budget'), residentPreflightResourceArgs(root));
  const runId = `r5-doris-preflight-${Date.now()}-${process.pid}-${randomUUID()}`;
  const evidenceDir = path.join(evidenceRoot, runId);
  mkdirSync(evidenceDir, {recursive: true, mode: 0o700});
  const logPath = path.join(evidenceDir, 'preflight.log');
  const manifestPath = path.join(evidenceDir, 'run-manifest.json');
  const startToken = canonicalStartToken(process.pid);
  if (!startToken) fail('R5_DORIS_PREFLIGHT_LOCAL_IDENTITY_UNAVAILABLE');
  const manifest = {
    schemaVersion: 1,
    kind: 'r5-managed-doris-host-preflight',
    runId,
    startedAt: now(),
    phase: 'PREFLIGHT_PASS',
    baselineRunId: baseline.runId,
    remoteHost: trust.host,
    expectedBootId: baseline.bootId,
    expectedImageId: baseline.imageId,
    expectedRepoDigest: baseline.repoDigest,
    expectedPostgresContainerPrefix: baseline.postgresContainerPrefix,
    localProcess: {pid: process.pid, startToken},
    localResourcePreflight: safe(budget.stdout.trim()),
    business: 'NOT_APPLICABLE',
    cleanup: 'NOT_RUN',
    status: 'PENDING',
    evidence: {log: logPath},
  };
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {mode: 0o600});
  process.stdout.write(`R5_DORIS_HOST_PREFLIGHT=START runId=${runId} host=${trust.host} baseline=${baseline.runId}\n`);
  const result = await runRemote(trust.host, renderRemotePreflightScript({
    expectedBootId: baseline.bootId,
    expectedImageId: baseline.imageId,
    expectedRepoDigest: baseline.repoDigest,
    expectedPostgresContainerPrefix: baseline.postgresContainerPrefix,
  }), logPath, manifest, manifestPath);
  const facts = parseRemotePreflightFacts(result.stdout);
  const successful = result.status === 0 && result.stdout.includes('R5_DORIS_PREFLIGHT=PASS') &&
    result.stdout.includes('R5_DORIS_PREFLIGHT_CLEANUP=PASS_NO_REMOTE_MUTATION');
  manifest.remoteFacts = facts;
  manifest.remoteBootId = facts.find(row => row[0] === 'HOST' && row[1] === 'BOOT_ID')?.[2] ?? null;
  manifest.postgresServerVersion = facts.find(row => row[0] === 'POSTGRES' && row[1] === 'SERVER_VERSION')?.[2] ?? null;
  manifest.completedAt = now();
  manifest.phase = successful ? 'COMPLETE' : 'FAILED';
  manifest.status = successful ? 'PASS' : 'FAIL';
  manifest.cleanup = result.status >= 0 ? 'PASS_NO_REMOTE_MUTATION' : 'NOT_VERIFIED';
  manifest.firstFailure = successful ? null : safe((result.stderr || result.stdout || result.error || `SSH_EXIT_${result.status}`).split('\n').find(line => /FAIL|ERROR|DRIFT|RESIDUE/.test(line)) ?? `SSH_EXIT_${result.status}`);
  manifest.lastKnownGood = facts.length > 0 ? 'REMOTE_READ_ONLY_HOST_FACTS_CAPTURED' : 'LOCAL_RESOURCE_PREFLIGHT';
  manifest.brokenBoundary = successful ? null : 'REMOTE_READ_ONLY_HOST_PREFLIGHT';
  manifest.stdoutSha256 = sha256(result.stdout);
  manifest.stderrSha256 = sha256(result.stderr);
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {mode: 0o600});
  process.stdout.write(`R5_DORIS_HOST_PREFLIGHT_RESULT=${manifest.status} cleanup=${manifest.cleanup} runId=${runId} pgServerVersion=${manifest.postgresServerVersion ?? 'UNAVAILABLE'} manifest=${manifestPath}\n`);
  if (!successful) process.exitCode = 2;
}

if (isMain && process.argv[2] === '--self-test') selfTest();
else if (isMain && process.argv[2] === 'preflight') mainPreflight().catch(error => {
  process.stderr.write(`R5_DORIS_HOST_PREFLIGHT_REFUSED=${safe(error?.message ?? 'UNKNOWN')}\n`);
  process.exitCode = 2;
});
else if (isMain && process.argv[2] === 'run') main().catch(error => {
  process.stderr.write(`R5_DORIS_RESIDENT_PROBE_REFUSED=${safe(error?.message ?? 'UNKNOWN')}\n`);
  process.exitCode = 2;
});
else if (isMain) {
  process.stderr.write('USAGE=node scripts/dev/r5-doris-resident-feasibility.mjs preflight|run|--self-test\n');
  process.exitCode = 2;
}
