#!/usr/bin/env node

import {createHash} from 'node:crypto';
import {chmodSync, existsSync, readFileSync, renameSync, writeFileSync} from 'node:fs';

export const DORIS_RESIDENT_IMAGE = 'apache/doris:all-in-one-4.1.3';
export const DORIS_RESIDENT_IMAGE_ID = 'sha256:82a5cabc7900ebcd3d080412d636c0cebd6602799fffe2605c652b2ea7d42609';
export const DORIS_RESIDENT_REPO_DIGEST = 'apache/doris@sha256:82a5cabc7900ebcd3d080412d636c0cebd6602799fffe2605c652b2ea7d42609';
export const DORIS_RESIDENT_CONTAINER = 'catering-v2s-r5-doris-resident';
export const DORIS_RESIDENT_FE_VOLUME = 'catering-v2s-r5-doris-fe-meta';
export const DORIS_RESIDENT_BE_VOLUME = 'catering-v2s-r5-doris-be-storage';
export const DORIS_RESIDENT_ENDPOINT = 'http://127.0.0.1:8040';
export const DORIS_RESIDENT_DATABASE = 'terminal_connection_history';
export const DORIS_RESIDENT_TABLE = 'connection_history';
export const DORIS_RESIDENT_USERNAME = 'tds_history_writer';
const ownerLabel = 'com.catering-v2s.doris-resident';
const fail = code => { throw new Error(code); };
const shellQuote = value => `'${String(value).replaceAll("'", "'\\''")}'`;
const sha256 = value => createHash('sha256').update(value).digest('hex');

export function validateResidentManifest(value, {host, fingerprint} = {}) {
  if (value?.schemaVersion !== 1 || value.kind !== 'r5-managed-doris-resident' ||
      value.host !== host || value.hostFingerprint !== fingerprint ||
      value.containerName !== DORIS_RESIDENT_CONTAINER ||
      !/^[a-f0-9]{64}$/.test(value.containerId ?? '') ||
      value.imageRef !== DORIS_RESIDENT_IMAGE || value.imageId !== DORIS_RESIDENT_IMAGE_ID ||
      value.repoDigest !== DORIS_RESIDENT_REPO_DIGEST ||
      !/^[a-f0-9]{64}$/.test(value.feVolumeId ?? '') || !/^[a-f0-9]{64}$/.test(value.beVolumeId ?? '') ||
      !/^[a-f0-9-]{36}$/i.test(value.bootId ?? '') || value.health !== 'healthy' ||
      value.endpoint !== DORIS_RESIDENT_ENDPOINT || value.database !== DORIS_RESIDENT_DATABASE ||
      value.table !== DORIS_RESIDENT_TABLE || value.username !== DORIS_RESIDENT_USERNAME ||
      JSON.stringify(value.ports) !== JSON.stringify({mysql: '127.0.0.1:9030', http: '127.0.0.1:8030', load: '127.0.0.1:8040'})) {
    fail('R5_DORIS_RESIDENT_MANIFEST_INVALID');
  }
  return Object.freeze({...value});
}

export function readResidentManifest(filePath, expected) {
  if (!existsSync(filePath)) return null;
  try { return validateResidentManifest(JSON.parse(readFileSync(filePath, 'utf8')), expected); }
  catch (error) { if (error?.message === 'R5_DORIS_RESIDENT_MANIFEST_INVALID') throw error; fail('R5_DORIS_RESIDENT_MANIFEST_INVALID'); }
}

export function writeResidentManifest(filePath, value) {
  validateResidentManifest(value, {host: value.host, fingerprint: value.hostFingerprint});
  const temporary = `${filePath}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {flag: 'wx', mode: 0o600});
  renameSync(temporary, filePath);
  chmodSync(filePath, 0o600);
  return {path: filePath, sha256: sha256(readFileSync(filePath))};
}

export function parseResidentReport(output) {
  const fields = {};
  for (const line of String(output ?? '').split(/\r?\n/)) {
    const match = line.match(/^R5_DORIS_RESIDENT\t([A-Z_]+)\t([^\r\n]*)$/);
    if (match) fields[match[1]] = match[2];
  }
  const required = ['STATUS', 'BOOT_ID', 'CONTAINER_ID', 'IMAGE_ID', 'FE_VOLUME_ID', 'BE_VOLUME_ID', 'HEALTH', 'AVAILABLE_MEMORY_MIB', 'DOCKER_MEMORY_BYTES'];
  if (required.some(name => !fields[name]) || fields.STATUS !== 'PASS' || fields.IMAGE_ID !== DORIS_RESIDENT_IMAGE_ID || fields.HEALTH !== 'healthy' ||
      !/^[a-f0-9]{64}$/.test(fields.CONTAINER_ID) || !/^[a-f0-9]{64}$/.test(fields.FE_VOLUME_ID) || !/^[a-f0-9]{64}$/.test(fields.BE_VOLUME_ID)) {
    fail('R5_DORIS_RESIDENT_REPORT_INVALID');
  }
  return Object.freeze({
    bootId: fields.BOOT_ID, containerId: fields.CONTAINER_ID, imageId: fields.IMAGE_ID,
    feVolumeId: fields.FE_VOLUME_ID, beVolumeId: fields.BE_VOLUME_ID, health: fields.HEALTH,
    availableMemoryMiB: Number(fields.AVAILABLE_MEMORY_MIB), dockerMemoryBytes: Number(fields.DOCKER_MEMORY_BYTES),
    adoptedExistingContainer: fields.ADOPTED_EXISTING_CONTAINER === 'true',
  });
}

export function buildResidentManifest({host, fingerprint, report, previous = null}) {
  return validateResidentManifest({
    schemaVersion: 1, kind: 'r5-managed-doris-resident', host, hostFingerprint: fingerprint,
    bootId: report.bootId, containerName: DORIS_RESIDENT_CONTAINER, containerId: report.containerId,
    imageRef: DORIS_RESIDENT_IMAGE, imageId: report.imageId, repoDigest: DORIS_RESIDENT_REPO_DIGEST,
    feVolumeId: report.feVolumeId, beVolumeId: report.beVolumeId, endpoint: DORIS_RESIDENT_ENDPOINT,
    database: DORIS_RESIDENT_DATABASE, table: DORIS_RESIDENT_TABLE, username: DORIS_RESIDENT_USERNAME,
    health: report.health, ports: {mysql: '127.0.0.1:9030', http: '127.0.0.1:8030', load: '127.0.0.1:8040'},
    resourceObservation: {availableMemoryMiB: report.availableMemoryMiB, dockerMemoryBytes: report.dockerMemoryBytes, observedAt: new Date().toISOString()},
    adoptedExistingContainer: report.adoptedExistingContainer === true,
    createdAt: previous?.createdAt ?? new Date().toISOString(), verifiedAt: new Date().toISOString(),
  }, {host, fingerprint});
}

const exactPortBindingCheck = marker =>
  `python3 -c 'import json,sys; expected={"9030/tcp":[{"HostIp":"127.0.0.1","HostPort":"9030"}],"8030/tcp":[{"HostIp":"127.0.0.1","HostPort":"8030"}],"8040/tcp":[{"HostIp":"127.0.0.1","HostPort":"8040"}]}; sys.exit(0 if json.loads(sys.argv[1]) == expected else 1)' "$port_bindings" || fail ${marker}`;

export function renderEnsureResidentScript({expectedBootId, expectedContainerId = null, expectedFeVolumeId = null,
  expectedBeVolumeId = null, hostFingerprint, attemptId, password, ddlBase64}) {
  if (!/^[a-f0-9-]{36}$/i.test(expectedBootId ?? '') || !/^[a-f0-9]{64}$/.test(hostFingerprint ?? '') ||
      !/^[a-f0-9-]{36}$/i.test(attemptId ?? '') ||
      (expectedContainerId !== null && !/^[a-f0-9]{64}$/.test(expectedContainerId)) ||
      (expectedFeVolumeId !== null && !/^[a-f0-9]{64}$/.test(expectedFeVolumeId)) ||
      (expectedBeVolumeId !== null && !/^[a-f0-9]{64}$/.test(expectedBeVolumeId)) ||
      !/^[a-f0-9]{64}$/.test(password ?? '') || !/^[A-Za-z0-9+/=]+$/.test(ddlBase64 ?? '')) fail('R5_DORIS_RESIDENT_INPUT_INVALID');
  return [
    'set -Eeuo pipefail',
    `expected_boot_id=${shellQuote(expectedBootId)}`,
    `host_fingerprint=${shellQuote(hostFingerprint)}`,
    `expected_container_id=${shellQuote(expectedContainerId ?? '')}`,
    `expected_fe_volume_id=${shellQuote(expectedFeVolumeId ?? '')}`,
    `expected_be_volume_id=${shellQuote(expectedBeVolumeId ?? '')}`,
    `container_name=${shellQuote(DORIS_RESIDENT_CONTAINER)}`,
    `image_ref=${shellQuote(DORIS_RESIDENT_IMAGE)}`,
    `expected_image_id=${shellQuote(DORIS_RESIDENT_IMAGE_ID)}`,
    `expected_repo_digest=${shellQuote(DORIS_RESIDENT_REPO_DIGEST)}`,
    `fe_volume=${shellQuote(DORIS_RESIDENT_FE_VOLUME)}`,
    `be_volume=${shellQuote(DORIS_RESIDENT_BE_VOLUME)}`,
    `owner_label=${shellQuote(ownerLabel)}`,
    `owner_value=${shellQuote('r5-dev-resident')}`,
    `attempt_id=${shellQuote(attemptId)}`,
    `writer_user=${shellQuote(DORIS_RESIDENT_USERNAME)}`,
    `writer_password=${shellQuote(password)}`,
    `ddl_base64=${shellQuote(ddlBase64)}`,
    'fail() { printf "R5_DORIS_RESIDENT_FAILURE=%s\\n" "$1" >&2; exit 70; }',
    'resident_ready=false',
    'cleanup_status=PASS',
    'cleanup_partial_resident() {',
    '  original_status=$?',
    '  if test "$resident_ready" = true || test "$original_status" -eq 0; then return "$original_status"; fi',
    '  volume_cleanup_allowed=true',
    '  cleanup_container_ids=$(docker container ls --all --quiet --filter "label=$owner_label.attempt=$attempt_id") || cleanup_status=FAIL',
    '  for cleanup_container_id in $cleanup_container_ids; do',
    '    cleanup_facts=$(docker inspect -f \'{{.Id}}|{{.Name}}|{{.Image}}|{{.Config.Image}}|{{index .Config.Labels "com.catering-v2s.doris-resident"}}|{{index .Config.Labels "com.catering-v2s.doris-resident.host-fingerprint"}}|{{index .Config.Labels "com.catering-v2s.doris-resident.attempt"}}\' "$cleanup_container_id" 2>/dev/null) || { cleanup_status=FAIL; continue; }',
    '    expected_cleanup_facts="$cleanup_container_id|/$container_name|$expected_image_id|$image_ref|$owner_value|$host_fingerprint|$attempt_id"',
    '    if test "$cleanup_facts" = "$expected_cleanup_facts"; then docker container rm --force "$cleanup_container_id" >/dev/null || { cleanup_status=FAIL; volume_cleanup_allowed=false; }; else cleanup_status=FAIL; volume_cleanup_allowed=false; fi',
    '  done',
    '  if test "$cleanup_status" = PASS; then',
    '    remaining_container_ids=',
    '    for attempt in $(seq 1 10); do',
    '      remaining_container_ids=$(docker container ls --all --quiet --filter "label=$owner_label.attempt=$attempt_id") || { cleanup_status=FAIL; break; }',
    '      test -n "$remaining_container_ids" || break',
    '      sleep 1',
    '    done',
    '    if test -n "$remaining_container_ids"; then printf "R5_DORIS_RESIDENT_CLEANUP_FAILURE=ATTEMPT_CONTAINER_STILL_PRESENT\\n" >&2; cleanup_status=FAIL; volume_cleanup_allowed=false; fi',
    '  fi',
    '  if test "$volume_cleanup_allowed" = true; then',
    '    cleanup_volume_names=$(docker volume ls --quiet --filter "label=$owner_label.attempt=$attempt_id") || cleanup_status=FAIL',
    '    for cleanup_volume_name in $cleanup_volume_names; do',
    '      case "$cleanup_volume_name" in "$fe_volume"|"$be_volume") ;; *) cleanup_status=FAIL; continue ;; esac',
    '      cleanup_volume_facts=$(docker volume inspect -f \'{{.Name}}|{{.Driver}}|{{index .Labels "com.catering-v2s.doris-resident"}}|{{index .Labels "com.catering-v2s.doris-resident.attempt"}}\' "$cleanup_volume_name" 2>/dev/null) || { cleanup_status=FAIL; continue; }',
    '      if test "$cleanup_volume_facts" = "$cleanup_volume_name|local|$owner_value|$attempt_id"; then docker volume rm "$cleanup_volume_name" >/dev/null || cleanup_status=FAIL; else cleanup_status=FAIL; fi',
    '    done',
    '  fi',
    '  remaining_container_ids=$(docker container ls --all --quiet --filter "label=$owner_label.attempt=$attempt_id") || cleanup_status=FAIL',
    '  test -z "$remaining_container_ids" || cleanup_status=FAIL',
    '  remaining_volume_names=$(docker volume ls --quiet --filter "label=$owner_label.attempt=$attempt_id") || cleanup_status=FAIL',
    '  test -z "$remaining_volume_names" || cleanup_status=FAIL',
    '  printf "R5_DORIS_RESIDENT_PARTIAL_CLEANUP=%s\\n" "$cleanup_status" >&2',
    '  exit "$original_status"',
    '}',
    'trap cleanup_partial_resident EXIT',
    'boot_id=$(cat /proc/sys/kernel/random/boot_id) || fail REMOTE_BOOT_ID_READ_FAILED',
    'test "$boot_id" = "$expected_boot_id" || fail REMOTE_HOST_BOOT_ID_CHANGED_DURING_START',
    'docker image inspect "$image_ref" >/dev/null 2>&1 || fail DORIS_IMAGE_NOT_CACHED',
    'image_id=$(docker image inspect -f "{{.Id}}" "$image_ref") || fail DORIS_IMAGE_ID_READ_FAILED',
    'test "$image_id" = "$expected_image_id" || fail DORIS_IMAGE_ID_MISMATCH',
    'repo_digests=$(docker image inspect -f "{{range .RepoDigests}}{{println .}}{{end}}" "$image_ref") || fail DORIS_IMAGE_DIGEST_READ_FAILED',
    'printf "%s\\n" "$repo_digests" | grep -Fx "$expected_repo_digest" >/dev/null || fail DORIS_IMAGE_DIGEST_MISMATCH',
    'container_id=$(docker inspect -f "{{.Id}}" "$container_name" 2>/dev/null || true)',
    'adopted_existing_container=false',
    'fe_volume_exists=$(docker volume inspect -f "{{.Name}}" "$fe_volume" 2>/dev/null || true)',
    'be_volume_exists=$(docker volume inspect -f "{{.Name}}" "$be_volume" 2>/dev/null || true)',
    'if test -z "$container_id"; then',
    '  test -z "$expected_container_id" || fail DORIS_RESIDENT_CONTAINER_MISSING',
    '  test -z "$fe_volume_exists$be_volume_exists" || fail DORIS_RESIDENT_ORPHAN_VOLUME_WITHOUT_MANIFEST',
    '  docker volume create --label "$owner_label=$owner_value" --label "$owner_label.attempt=$attempt_id" "$fe_volume" >/dev/null || fail DORIS_FE_VOLUME_CREATE_FAILED',
    '  docker volume create --label "$owner_label=$owner_value" --label "$owner_label.attempt=$attempt_id" "$be_volume" >/dev/null || fail DORIS_BE_VOLUME_CREATE_FAILED',
    '  docker run --detach --name "$container_name" --restart unless-stopped --label "$owner_label=$owner_value" --label "$owner_label.host-fingerprint=$host_fingerprint" --label "$owner_label.attempt=$attempt_id" --publish 127.0.0.1:9030:9030 --publish 127.0.0.1:8030:8030 --publish 127.0.0.1:8040:8040 --mount "type=volume,src=$fe_volume,dst=/opt/apache-doris/fe/doris-meta" --mount "type=volume,src=$be_volume,dst=/opt/apache-doris/be/storage" "$image_ref" >/dev/null || fail DORIS_RESIDENT_CONTAINER_CREATE_FAILED',
    '  container_id=$(docker inspect -f "{{.Id}}" "$container_name") || fail DORIS_RESIDENT_CONTAINER_ID_READ_FAILED',
    'else',
    '  if test -n "$expected_container_id"; then test "$container_id" = "$expected_container_id" || fail DORIS_RESIDENT_CONTAINER_ID_MISMATCH; else adopted_existing_container=true; fi',
    'fi',
    'container_facts=$(docker inspect -f \'{{.Id}}|{{.Image}}|{{.Config.Image}}|{{index .Config.Labels "com.catering-v2s.doris-resident"}}|{{index .Config.Labels "com.catering-v2s.doris-resident.host-fingerprint"}}|{{index .Config.Labels "com.catering-v2s.doris-resident.attempt"}}|{{.HostConfig.RestartPolicy.Name}}\' "$container_id") || fail DORIS_RESIDENT_INSPECT_FAILED',
    'container_attempt=$(printf "%s" "$container_facts" | awk -F\'|\' \'{print $6}\')',
    '[[ "$container_attempt" =~ ^[a-f0-9-]{36}$ ]] || fail DORIS_RESIDENT_CONTAINER_ATTEMPT_ID_INVALID',
    'expected_container_facts="$container_id|$expected_image_id|$image_ref|$owner_value|$host_fingerprint|$container_attempt|unless-stopped"',
    'test "$container_facts" = "$expected_container_facts" || fail DORIS_RESIDENT_CONTAINER_FACTS_MISMATCH',
    'mount_facts=$(docker inspect -f \'{{range .Mounts}}{{.Name}}:{{.Destination}};{{end}}\' "$container_id" | tr \'\\;\' \'\\n\' | sed \'/^$/d\' | sort | paste -sd\';\' -) || fail DORIS_RESIDENT_MOUNT_READ_FAILED',
    'expected_mount_facts=$(printf "%s\\n%s\\n" "$fe_volume:/opt/apache-doris/fe/doris-meta" "$be_volume:/opt/apache-doris/be/storage" | sort | paste -sd\';\' -)',
    'test "$mount_facts" = "$expected_mount_facts" || fail DORIS_RESIDENT_MOUNT_IDENTITY_MISMATCH',
    'port_bindings=$(docker inspect -f "{{json .HostConfig.PortBindings}}" "$container_id") || fail DORIS_RESIDENT_PORT_BINDING_READ_FAILED',
    exactPortBindingCheck('DORIS_RESIDENT_PORT_BINDING_INVALID'),
    'docker inspect -f "{{.State.Running}}" "$container_id" | grep -Fx true >/dev/null || docker start "$container_id" >/dev/null || fail DORIS_RESIDENT_START_FAILED',
    'ready=false; for attempt in $(seq 1 120); do health=$(docker inspect -f "{{.State.Health.Status}}" "$container_id" 2>/dev/null || true); if test "$health" = healthy; then ready=true; break; fi; if (( attempt % 10 == 0 )); then printf "R5_DORIS_RESIDENT_HEARTBEAT phase=HEALTH attempt=%s health=%s\\n" "$attempt" "${health:-unavailable}" >&2; fi; sleep 2; done',
    'test "$ready" = true || { docker logs --tail 80 "$container_id" >&2 || true; fail DORIS_RESIDENT_HEALTH_TIMEOUT; }',
    'printf "%s" "$ddl_base64" | base64 -d | docker exec -i "$container_id" mysql --batch --skip-column-names -h127.0.0.1 -P9030 -uroot || fail DORIS_RESIDENT_DDL_FAILED',
    'writer_sql="CREATE USER IF NOT EXISTS \'$writer_user\' IDENTIFIED BY \'$writer_password\'; ALTER USER \'$writer_user\' IDENTIFIED BY \'$writer_password\'; GRANT LOAD_PRIV ON terminal_connection_history.connection_history TO \'$writer_user\'; SHOW GRANTS FOR \'$writer_user\';"',
    'grants=$(printf "%s\\n" "$writer_sql" | docker exec -i "$container_id" mysql --batch --skip-column-names -h127.0.0.1 -P9030 -uroot 2>/dev/null) || fail DORIS_RESIDENT_WRITER_GRANT_FAILED',
    'printf "%s\\n" "$grants" | grep -Eiq "terminal_connection_history[.]connection_history: load_priv" || fail DORIS_RESIDENT_WRITER_GRANT_READBACK_FAILED',
    'grant_count=$(printf "%s\\n" "$grants" | grep -Eic "load_priv" || true)',
    'test "$grant_count" = 1 || fail DORIS_RESIDENT_WRITER_GRANT_SET_INVALID',
    'fe_volume_facts=$(docker volume inspect -f \'{{.Name}}|{{.Driver}}|{{index .Labels "com.catering-v2s.doris-resident"}}|{{index .Labels "com.catering-v2s.doris-resident.attempt"}}\' "$fe_volume") || fail DORIS_RESIDENT_FE_VOLUME_READ_FAILED',
    'be_volume_facts=$(docker volume inspect -f \'{{.Name}}|{{.Driver}}|{{index .Labels "com.catering-v2s.doris-resident"}}|{{index .Labels "com.catering-v2s.doris-resident.attempt"}}\' "$be_volume") || fail DORIS_RESIDENT_BE_VOLUME_READ_FAILED',
    'test "$fe_volume_facts" = "$fe_volume|local|$owner_value|$container_attempt" || fail DORIS_RESIDENT_FE_VOLUME_OWNER_INVALID',
    'test "$be_volume_facts" = "$be_volume|local|$owner_value|$container_attempt" || fail DORIS_RESIDENT_BE_VOLUME_OWNER_INVALID',
    'fe_volume_id=$(printf "%s" "$fe_volume_facts" | sha256sum | awk \'{print $1}\')',
    'be_volume_id=$(printf "%s" "$be_volume_facts" | sha256sum | awk \'{print $1}\')',
    'if test -n "$expected_container_id"; then test "$fe_volume_id" = "$expected_fe_volume_id" || fail DORIS_RESIDENT_FE_VOLUME_ID_MISMATCH; test "$be_volume_id" = "$expected_be_volume_id" || fail DORIS_RESIDENT_BE_VOLUME_ID_MISMATCH; fi',
    'available_memory_mib=$(awk \'/^MemAvailable:/ {print int($2/1024)}\' /proc/meminfo)',
    'docker_memory_bytes=$(docker info --format "{{.MemTotal}}")',
    'printf "R5_DORIS_RESIDENT\\tSTATUS\\tPASS\\nR5_DORIS_RESIDENT\\tBOOT_ID\\t%s\\nR5_DORIS_RESIDENT\\tCONTAINER_ID\\t%s\\nR5_DORIS_RESIDENT\\tIMAGE_ID\\t%s\\nR5_DORIS_RESIDENT\\tFE_VOLUME_ID\\t%s\\nR5_DORIS_RESIDENT\\tBE_VOLUME_ID\\t%s\\nR5_DORIS_RESIDENT\\tHEALTH\\thealthy\\nR5_DORIS_RESIDENT\\tAVAILABLE_MEMORY_MIB\\t%s\\nR5_DORIS_RESIDENT\\tDOCKER_MEMORY_BYTES\\t%s\\nR5_DORIS_RESIDENT\\tADOPTED_EXISTING_CONTAINER\\t%s\\n" "$boot_id" "$container_id" "$image_id" "$fe_volume_id" "$be_volume_id" "$available_memory_mib" "$docker_memory_bytes" "$adopted_existing_container"',
    'resident_ready=true',
  ].join('\n');
}

export function renderResidentTruncateScript(value) {
  const manifest = validateResidentManifest(value, {host: value.host, fingerprint: value.hostFingerprint});
  return [
    'set -Eeuo pipefail',
    `container_id=${shellQuote(manifest.containerId)}`,
    `image_id=${shellQuote(manifest.imageId)}`,
    `host_fingerprint=${shellQuote(manifest.hostFingerprint)}`,
    `fe_volume=${shellQuote(DORIS_RESIDENT_FE_VOLUME)}`,
    `be_volume=${shellQuote(DORIS_RESIDENT_BE_VOLUME)}`,
    `database=${shellQuote(DORIS_RESIDENT_DATABASE)}`,
    `table=${shellQuote(DORIS_RESIDENT_TABLE)}`,
    `expected_repo_digest=${shellQuote(DORIS_RESIDENT_REPO_DIGEST)}`,
    `expected_fe_volume_id=${shellQuote(manifest.feVolumeId)}`,
    `expected_be_volume_id=${shellQuote(manifest.beVolumeId)}`,
    'fail() { printf "R5_REMOTE_RESET_DORIS_FAILURE=%s\\n" "$1" >&2; exit 70; }',
    'actual=$(docker inspect -f \'{{.Id}}|{{.Image}}|{{.Config.Image}}|{{index .Config.Labels "com.catering-v2s.doris-resident"}}|{{index .Config.Labels "com.catering-v2s.doris-resident.host-fingerprint"}}|{{.State.Health.Status}}|{{.State.Running}}\' "$container_id") || fail DORIS_RESET_CONTAINER_UNAVAILABLE',
    'expected="$container_id|$image_id|apache/doris:all-in-one-4.1.3|r5-dev-resident|$host_fingerprint|healthy|true"',
    'test "$actual" = "$expected" || fail DORIS_RESET_CONTAINER_IDENTITY_MISMATCH',
    'mount_facts=$(docker inspect -f \'{{range .Mounts}}{{.Name}}:{{.Destination}};{{end}}\' "$container_id" | tr \'\\;\' \'\\n\' | sed \'/^$/d\' | sort | paste -sd\';\' -) || fail DORIS_RESET_MOUNT_IDENTITY_READ_FAILED',
    'expected_mount_facts=$(printf "%s\\n%s\\n" "$fe_volume:/opt/apache-doris/fe/doris-meta" "$be_volume:/opt/apache-doris/be/storage" | sort | paste -sd\';\' -)',
    'test "$mount_facts" = "$expected_mount_facts" || fail DORIS_RESET_MOUNT_IDENTITY_MISMATCH',
    'repo_digests=$(docker image inspect -f \'{{range .RepoDigests}}{{println .}}{{end}}\' "$image_id") || fail DORIS_RESET_IMAGE_UNAVAILABLE',
    'printf "%s\\n" "$repo_digests" | grep -Fx "$expected_repo_digest" >/dev/null || fail DORIS_RESET_IMAGE_DIGEST_MISMATCH',
    'port_bindings=$(docker inspect -f "{{json .HostConfig.PortBindings}}" "$container_id") || fail DORIS_RESET_PORT_BINDING_UNAVAILABLE',
    exactPortBindingCheck('DORIS_RESET_PORT_NOT_LOOPBACK'),
    'container_attempt=$(docker inspect -f \'{{index .Config.Labels "com.catering-v2s.doris-resident.attempt"}}\' "$container_id") || fail DORIS_RESET_CONTAINER_ATTEMPT_UNAVAILABLE',
    'fe_volume_facts=$(docker volume inspect -f \'{{.Name}}|{{.Driver}}|{{index .Labels "com.catering-v2s.doris-resident"}}|{{index .Labels "com.catering-v2s.doris-resident.attempt"}}\' "$fe_volume") || fail DORIS_RESET_FE_VOLUME_UNAVAILABLE',
    'be_volume_facts=$(docker volume inspect -f \'{{.Name}}|{{.Driver}}|{{index .Labels "com.catering-v2s.doris-resident"}}|{{index .Labels "com.catering-v2s.doris-resident.attempt"}}\' "$be_volume") || fail DORIS_RESET_BE_VOLUME_UNAVAILABLE',
    'test "$fe_volume_facts" = "$fe_volume|local|r5-dev-resident|$container_attempt" || fail DORIS_RESET_FE_VOLUME_OWNER_INVALID',
    'test "$be_volume_facts" = "$be_volume|local|r5-dev-resident|$container_attempt" || fail DORIS_RESET_BE_VOLUME_OWNER_INVALID',
    'fe_volume_id=$(printf "%s" "$fe_volume_facts" | sha256sum | awk \'{print $1}\')',
    'be_volume_id=$(printf "%s" "$be_volume_facts" | sha256sum | awk \'{print $1}\')',
    'test "$fe_volume_id" = "$expected_fe_volume_id" || fail DORIS_RESET_FE_VOLUME_IDENTITY_MISMATCH',
    'test "$be_volume_id" = "$expected_be_volume_id" || fail DORIS_RESET_BE_VOLUME_IDENTITY_MISMATCH',
    'docker exec "$container_id" mysql --batch --skip-column-names -h127.0.0.1 -P9030 -uroot -e "TRUNCATE TABLE $database.$table" >/dev/null || fail DORIS_RESET_TRUNCATE_FAILED',
    'count=$(docker exec "$container_id" mysql --batch --skip-column-names -h127.0.0.1 -P9030 -uroot -e "SELECT COUNT(*) FROM $database.$table") || fail DORIS_RESET_READBACK_FAILED',
    'test "$count" = 0 || fail DORIS_RESET_READBACK_NONZERO',
    'printf "R5_REMOTE_RESET_DORIS_TRUNCATE=PASS\\nR5_REMOTE_RESET_DORIS_READBACK=0\\n"',
  ].join('\n');
}

export function renderVerifyResidentScript(value) {
  const manifest = validateResidentManifest(value, {host: value.host, fingerprint: value.hostFingerprint});
  return [
    'set -Eeuo pipefail',
    `container_id=${shellQuote(manifest.containerId)}`,
    `image_id=${shellQuote(manifest.imageId)}`,
    `host_fingerprint=${shellQuote(manifest.hostFingerprint)}`,
    `fe_volume=${shellQuote(DORIS_RESIDENT_FE_VOLUME)}`,
    `be_volume=${shellQuote(DORIS_RESIDENT_BE_VOLUME)}`,
    `expected_fe_volume_id=${shellQuote(manifest.feVolumeId)}`,
    `expected_be_volume_id=${shellQuote(manifest.beVolumeId)}`,
    'fail() { printf "R5_DORIS_RESIDENT_VERIFY=FAIL; REASON=%s\\n" "$1"; exit 70; }',
    'boot_id=$(cat /proc/sys/kernel/random/boot_id) || fail BOOT_ID_UNAVAILABLE',
    'actual=$(docker inspect -f \'{{.Id}}|{{.Image}}|{{.Config.Image}}|{{index .Config.Labels "com.catering-v2s.doris-resident"}}|{{index .Config.Labels "com.catering-v2s.doris-resident.host-fingerprint"}}|{{.State.Health.Status}}|{{.State.Running}}|{{.HostConfig.RestartPolicy.Name}}\' "$container_id") || fail CONTAINER_UNAVAILABLE',
    'expected="$container_id|$image_id|apache/doris:all-in-one-4.1.3|r5-dev-resident|$host_fingerprint|healthy|true|unless-stopped"',
    'test "$actual" = "$expected" || fail CONTAINER_IDENTITY_MISMATCH',
    'mount_facts=$(docker inspect -f \'{{range .Mounts}}{{.Name}}:{{.Destination}};{{end}}\' "$container_id" | tr \'\\;\' \'\\n\' | sed \'/^$/d\' | sort | paste -sd\';\' -) || fail MOUNT_IDENTITY_READ_FAILED',
    'expected_mount_facts=$(printf "%s\\n%s\\n" "$fe_volume:/opt/apache-doris/fe/doris-meta" "$be_volume:/opt/apache-doris/be/storage" | sort | paste -sd\';\' -)',
    'test "$mount_facts" = "$expected_mount_facts" || fail MOUNT_IDENTITY_MISMATCH',
    'port_bindings=$(docker inspect -f "{{json .HostConfig.PortBindings}}" "$container_id") || fail PORT_BINDINGS_UNAVAILABLE',
    exactPortBindingCheck('PORT_BINDING_INVALID'),
    'container_attempt=$(docker inspect -f \'{{index .Config.Labels "com.catering-v2s.doris-resident.attempt"}}\' "$container_id") || fail CONTAINER_ATTEMPT_UNAVAILABLE',
    'fe_volume_facts=$(docker volume inspect -f \'{{.Name}}|{{.Driver}}|{{index .Labels "com.catering-v2s.doris-resident"}}|{{index .Labels "com.catering-v2s.doris-resident.attempt"}}\' "$fe_volume") || fail FE_VOLUME_UNAVAILABLE',
    'be_volume_facts=$(docker volume inspect -f \'{{.Name}}|{{.Driver}}|{{index .Labels "com.catering-v2s.doris-resident"}}|{{index .Labels "com.catering-v2s.doris-resident.attempt"}}\' "$be_volume") || fail BE_VOLUME_UNAVAILABLE',
    'test "$fe_volume_facts" = "$fe_volume|local|r5-dev-resident|$container_attempt" || fail FE_VOLUME_OWNER_INVALID',
    'test "$be_volume_facts" = "$be_volume|local|r5-dev-resident|$container_attempt" || fail BE_VOLUME_OWNER_INVALID',
    'fe_volume_id=$(printf "%s" "$fe_volume_facts" | sha256sum | awk \'{print $1}\')',
    'be_volume_id=$(printf "%s" "$be_volume_facts" | sha256sum | awk \'{print $1}\')',
    'test "$fe_volume_id" = "$expected_fe_volume_id" || fail FE_VOLUME_IDENTITY_MISMATCH',
    'test "$be_volume_id" = "$expected_be_volume_id" || fail BE_VOLUME_IDENTITY_MISMATCH',
    'printf "R5_DORIS_RESIDENT_VERIFY=PASS\\nR5_DORIS_RESIDENT_BOOT_ID=%s\\nR5_DORIS_RESIDENT_HEALTH=healthy\\n" "$boot_id"',
  ].join('\n');
}
