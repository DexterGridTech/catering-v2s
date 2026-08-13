#!/usr/bin/env node
/**
 * Installs and verifies the three explicitly-owned Docker daemons used by the
 * parallel remote Testcontainers runner.  It never touches the default daemon.
 */
import {createHash, randomUUID} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {resolveTrustedRemoteHost} from '../dev/r5-remote-host-trust.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const mode = process.argv[2] ?? '--preflight';
const trust = resolveTrustedRemoteHost(process.env);
const runId = `r5-tc-daemon-lanes-${Date.now()}-${process.pid}`;
const evidence = path.join(root, '.runtime/r5/evidence/testcontainers-daemon-lanes', runId);
const daemonRoot = '/var/lib/catering-v2s-testcontainers';
const runtimeRoot = '/run/catering-v2s-testcontainers';
const configRoot = '/etc/catering-v2s-testcontainers';
const servicePrefix = 'catering-v2s-testcontainers-daemon';
const testSourceRoot = path.join(root, 'apps/backend/catering-business-server/src/test/java');
const lanes = Object.freeze([1, 2, 3].map((lane) => Object.freeze({
  lane,
  bridge: `cvtcbr${lane}`,
  subnet: `172.30.${lane}.1/24`,
  socket: `${runtimeRoot}/daemon-${lane}/docker.sock`,
  config: `${configRoot}/daemon-${lane}.json`,
  service: `${servicePrefix}@${lane}.service`,
})));
export const backendAcceptanceDaemonLaneCapacity = () => lanes.length;
export function materializeBackendAcceptanceDaemonLanes({laneCount, daemonRootPath = daemonRoot, runtimeRootPath = runtimeRoot, configRootPath = configRoot, servicePrefixValue = servicePrefix}) {
  if (!Number.isSafeInteger(laneCount) || laneCount < 1 || laneCount > backendAcceptanceDaemonLaneCapacity()) throw new Error('BACKEND_ACCEPTANCE_DAEMON_LANE_COUNT_INVALID');
  if (![daemonRootPath, runtimeRootPath, configRootPath, servicePrefixValue].every((value) => typeof value === 'string' && value.length > 0)) {
    throw new Error('BACKEND_ACCEPTANCE_DAEMON_LANE_PATH_INVALID');
  }
  const result = Array.from({length: laneCount}, (_, index) => {
    const lane = index + 1;
    return Object.freeze({
      lane,
      bridge: `cvtcbr${lane}`,
      subnet: `172.30.${lane}.1/24`,
      socket: `${runtimeRootPath}/daemon-${lane}/docker.sock`,
      config: `${configRootPath}/daemon-${lane}.json`,
      service: `${servicePrefixValue}@${lane}.service`,
      dataRoot: `${daemonRootPath}/daemon-${lane}/data`,
    });
  });
  const uniqueFields = ['bridge', 'socket', 'config', 'service', 'dataRoot'];
  for (const field of uniqueFields) if (new Set(result.map((lane) => lane[field])).size !== result.length) {
    throw new Error('BACKEND_ACCEPTANCE_DAEMON_LANE_COLLISION');
  }
  return Object.freeze(result);
}
const now = () => new Date().toISOString();
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const quote = (value) => `'${String(value).replaceAll("'", "'\\''")}'`;
const script = (...lines) => lines.join('\n');
const fail = (reason) => { const error = new Error(reason); error.code = reason; throw error; };
const event = (name, fields = {}) => process.stdout.write(`R5_TESTCONTAINERS_DAEMON_${name} ${Object.entries(fields).map(([key, value]) => `${key}=${value}`).join(' ')}\n`);
const atomicWrite = (target, value) => { const temp = `${target}.${process.pid}.${randomUUID()}.tmp`; writeFileSync(temp, value); renameSync(temp, target); };
const remoteResult = (body) => spawnSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', trust.host, 'bash', '-s'], {cwd: root, input: body, encoding: 'utf8'});
const remote = (body) => { const result = remoteResult(body); if (result.status !== 0) fail(`DAEMON_REMOTE_COMMAND_FAILED:${String(result.stderr || result.stdout).trim().replace(/\s+/g, '_').slice(0, 240)}`); return result.stdout; };
const terminatorSourceRoots = Object.freeze([
  '/etc/systemd/system', '/usr/lib/systemd/system', '/lib/systemd/system',
  '/etc/systemd/user', '/usr/lib/systemd/user', '/lib/systemd/user',
  '/etc/cron.d', '/etc/cron.daily', '/etc/cron.hourly', '/etc/cron.monthly', '/etc/cron.weekly',
  '/var/spool/cron', '/var/spool/cron/crontabs', '/root/.config/systemd/user',
]);
const terminatorSourceRootPattern = new RegExp(`^(?:${terminatorSourceRoots.map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?:/|$)`);
export const parseRemoteTerminatorGovernance = (output) => {
  if (typeof output !== 'string') fail('BACKEND_ACCEPTANCE_TERMINATOR_GOVERNANCE_INVALID');
  const lines = output.split(/\r?\n/).filter(Boolean);
  const bootId = lines.find((line) => line.startsWith('TERMINATOR_HOST_BOOT_ID='))?.slice('TERMINATOR_HOST_BOOT_ID='.length);
  if (!/^[a-f0-9-]{36}$/i.test(bootId ?? '')) fail('BACKEND_ACCEPTANCE_TERMINATOR_GOVERNANCE_INVALID');
  const sources = [];
  const processes = [];
  for (const line of lines) {
    if (line.startsWith('TERMINATOR_SOURCE\t')) {
      const [, sourcePath, sourceSha256] = line.split('\t');
      if (!terminatorSourceRootPattern.test(sourcePath ?? '') || !/^[a-f0-9]{64}$/i.test(sourceSha256 ?? '')) fail('BACKEND_ACCEPTANCE_TERMINATOR_GOVERNANCE_INVALID');
      sources.push(Object.freeze({sourcePath, sourceSha256}));
    }
    if (line.startsWith('TERMINATOR_PROCESS\t')) {
      const [, pid, ppid, comm, cgroupSha256] = line.split('\t');
      if (![pid, ppid].every((value) => /^[1-9][0-9]*$/.test(value ?? '')) || !['pkill', 'killall'].includes(comm) || !/^[a-f0-9]{64}$/i.test(cgroupSha256 ?? '')) fail('BACKEND_ACCEPTANCE_TERMINATOR_GOVERNANCE_INVALID');
      processes.push(Object.freeze({pid: Number(pid), ppid: Number(ppid), comm, cgroupSha256}));
    }
  }
  return Object.freeze({bootId, sources: Object.freeze(sources), processes: Object.freeze(processes)});
};
const terminatorGovernanceDiagnosticScript = () => [
  'printf "TERMINATOR_HOST_BOOT_ID=%s\\n" "$(cat /proc/sys/kernel/random/boot_id)"',
  `for source_root in ${terminatorSourceRoots.map(quote).join(' ')}; do`,
  '  test -d "$source_root" || continue',
  '  while IFS= read -r -d "" source_path; do',
  '    if grep -Eqs "(pkill|killall)" "$source_path"; then source_sha256=$(sha256sum "$source_path" | awk \'{print $1}\'); printf "TERMINATOR_SOURCE\\t%s\\t%s\\n" "$source_path" "$source_sha256"; fi',
  '  done < <(find "$source_root" -xdev -type f -print0 2>/dev/null || true)',
  'done',
  'while read -r pid ppid comm; do',
  '  test -n "$pid" || continue; test -r "/proc/$pid/cgroup" || continue',
  '  cgroup_sha256=$(sha256sum "/proc/$pid/cgroup" | awk \'{print $1}\')',
  '  printf "TERMINATOR_PROCESS\\t%s\\t%s\\t%s\\t%s\\n" "$pid" "$ppid" "$comm" "$cgroup_sha256"',
  'done < <(ps -eo pid=,ppid=,comm= | awk \'$3 == "pkill" || $3 == "killall" {print $1, $2, $3}\')',
];
const walkJavaSources = (directory) => readdirSync(directory, {withFileTypes: true}).flatMap((entry) => {
  const child = path.join(directory, entry.name);
  if (entry.isDirectory()) return walkJavaSources(child);
  return entry.isFile() && entry.name.endsWith('.java') ? [child] : [];
});

// The cache is derived from the current @Testcontainers sources, so a newly
// added test image is warmed on the next managed run rather than depending on
// a hand-maintained image allowlist.  References we cannot resolve statically
// fail closed instead of letting a lane unexpectedly pull from the network.
export const discoverTestcontainersImageRefs = (sourceRoot = testSourceRoot) => {
  const images = new Set();
  for (const sourcePath of walkJavaSources(sourceRoot)) {
    const source = readFileSync(sourcePath, 'utf8');
    if (!source.includes('@Testcontainers')) continue;
    const constants = new Map([...source.matchAll(/\bString\s+([A-Z][A-Z0-9_]*)\s*=\s*"([^"\r\n]+)"/g)].map((match) => [match[1], match[2]]));
    for (const match of source.matchAll(/new\s+(?:PostgreSQLContainer|GenericContainer)(?:\s*<[^>]*>)?\s*\(\s*([^\s,)]+)\s*\)/g)) {
      const reference = match[1];
      const literal = reference.match(/^"([^"\r\n]+)"$/)?.[1];
      const image = literal ?? constants.get(reference);
      if (!image) fail(`TESTCONTAINERS_IMAGE_REFERENCE_UNRESOLVED:${path.relative(root, sourcePath)}:${reference}`);
      images.add(image);
    }
  }
  if (images.size === 0) fail('TESTCONTAINERS_IMAGE_DISCOVERY_DENOMINATOR_INVALID');
  return [...images].sort();
};
const managedImageRefs = () => discoverTestcontainersImageRefs();

const preflight = () => {
  const output = remote(script(
    'set -euo pipefail',
    'test "$(id -u)" = 0',
    'command -v dockerd >/dev/null',
    'command -v systemctl >/dev/null',
    "awk '/MemAvailable:/ { print \"MEM_AVAILABLE_MIB=\" int($2 / 1024) }' /proc/meminfo",
    `df -Pm ${quote(daemonRoot)} 2>/dev/null | awk 'NR == 2 { print "DISK_AVAILABLE_MIB=" $4 }' || df -Pm / | awk 'NR == 2 { print "DISK_AVAILABLE_MIB=" $4 }'`,
    'printf "DOCKERD_PATH=%s\\n" "$(command -v dockerd)"',
    'printf "DEFAULT_DOCKER_ENGINE_ID=%s\\n" "$(docker info --format \"{{.ID}}\" 2>/dev/null || true)"',
    ...lanes.flatMap((lane) => [
      `test ! -e ${quote(lane.socket)} || { printf 'MANAGED_DAEMON_RESOURCE_CONFLICT=socket-${lane.lane}\\n' >&2; exit 68; }`,
      `test ! -e /sys/class/net/${lane.bridge} || { printf 'MANAGED_DAEMON_RESOURCE_CONFLICT=bridge-${lane.lane}\\n' >&2; exit 68; }`,
      `test ! -e ${quote(lane.config)} || { printf 'MANAGED_DAEMON_RESOURCE_CONFLICT=config-${lane.lane}\\n' >&2; exit 68; }`,
      `systemctl is-active --quiet ${quote(lane.service)} && { printf 'MANAGED_DAEMON_RESOURCE_CONFLICT=service-${lane.lane}\\n' >&2; exit 68; } || true`,
    ]),
    'printf "PREFLIGHT=PASS\\n"',
  ));
  const facts = Object.fromEntries(output.trim().split('\n').filter(Boolean).map((line) => line.split('=')));
  const memory = Number(facts.MEM_AVAILABLE_MIB); const disk = Number(facts.DISK_AVAILABLE_MIB);
  if (!Number.isSafeInteger(memory) || memory < 12_288) fail('DAEMON_LANES_MEMORY_BUDGET_INSUFFICIENT');
  if (!Number.isSafeInteger(disk) || disk < 20_480) fail('DAEMON_LANES_DISK_BUDGET_INSUFFICIENT');
  if (!facts.DOCKERD_PATH || !facts.DEFAULT_DOCKER_ENGINE_ID) fail('DAEMON_LANES_DEFAULT_DOCKER_UNAVAILABLE');
  return {status: 'PASS', ...facts, memoryAvailableMiB: memory, diskAvailableMiB: disk};
};

const daemonConfig = (lane) => JSON.stringify({
  'data-root': `${daemonRoot}/daemon-${lane.lane}/data`,
  'exec-root': `${runtimeRoot}/daemon-${lane.lane}/exec`,
  pidfile: `${runtimeRoot}/daemon-${lane.lane}/dockerd.pid`,
  hosts: [`unix://${lane.socket}`],
  bridge: lane.bridge,
  'live-restore': false,
  // Netfilter tables are host-global.  Three independently owned daemons must
  // never race to create/remove the same DOCKER chains; Testcontainers only
  // needs host-published ports and per-daemon bridge networking here.
  'iptables': false,
  'ip-masq': false,
  'ip6tables': false,
  'containerd-namespace': `catering-v2s-testcontainers-${lane.lane}`,
  'containerd-plugins-namespace': `catering-v2s-testcontainers-${lane.lane}-plugins`,
}, null, 2) + '\n';
// This is deliberately retained only for a narrowly-scoped recovery of the
// first attempted managed deployment.  Docker rejects --bridge plus --bip;
// known prior bytes are accepted solely so --repair can replace them without
// accepting arbitrary configuration drift.
const priorInvalidDaemonConfig = (lane) => JSON.stringify({
  'data-root': `${daemonRoot}/daemon-${lane.lane}/data`,
  'exec-root': `${runtimeRoot}/daemon-${lane.lane}/exec`,
  pidfile: `${runtimeRoot}/daemon-${lane.lane}/dockerd.pid`,
  hosts: [`unix://${lane.socket}`],
  bridge: lane.bridge,
  bip: lane.subnet,
  'live-restore': false,
  'iptables': true,
  'ip-masq': true,
  'containerd-namespace': `catering-v2s-testcontainers-${lane.lane}`,
  'containerd-plugins-namespace': `catering-v2s-testcontainers-${lane.lane}-plugins`,
}, null, 2) + '\n';
const interimInvalidDaemonConfig = (lane) => JSON.stringify({
  'data-root': `${daemonRoot}/daemon-${lane.lane}/data`,
  'exec-root': `${runtimeRoot}/daemon-${lane.lane}/exec`,
  pidfile: `${runtimeRoot}/daemon-${lane.lane}/dockerd.pid`,
  hosts: [`unix://${lane.socket}`],
  bridge: lane.bridge,
  'live-restore': false,
  'iptables': true,
  'ip-masq': true,
  'containerd-namespace': `catering-v2s-testcontainers-${lane.lane}`,
  'containerd-plugins-namespace': `catering-v2s-testcontainers-${lane.lane}-plugins`,
}, null, 2) + '\n';
const priorIpv6UnsafeDaemonConfig = (lane) => JSON.stringify({
  'data-root': `${daemonRoot}/daemon-${lane.lane}/data`,
  'exec-root': `${runtimeRoot}/daemon-${lane.lane}/exec`,
  pidfile: `${runtimeRoot}/daemon-${lane.lane}/dockerd.pid`,
  hosts: [`unix://${lane.socket}`],
  bridge: lane.bridge,
  'live-restore': false,
  'iptables': false,
  'ip-masq': false,
  'containerd-namespace': `catering-v2s-testcontainers-${lane.lane}`,
  'containerd-plugins-namespace': `catering-v2s-testcontainers-${lane.lane}-plugins`,
}, null, 2) + '\n';
const serviceUnit = () => `[Unit]\nDescription=Catering v2s isolated Testcontainers Docker daemon %i\nAfter=network-online.target\nWants=network-online.target\n\n[Service]\nType=simple\nDelegate=yes\nKillMode=process\nRestart=on-failure\nRestartSec=2\nLimitNOFILE=1048576\nExecStart=/usr/bin/env dockerd --config-file ${configRoot}/daemon-%i.json\n\n[Install]\nWantedBy=multi-user.target\n`;

export const warmTestcontainersImages = () => {
  const images = managedImageRefs();
  return {images, output: remote(script(
    'set -euo pipefail',
    ...images.flatMap((image) => [
      `docker image inspect ${quote(image)} >/dev/null 2>&1 || docker pull ${quote(image)} >/dev/null`,
      ...lanes.map((lane) => `docker --host ${quote(`unix://${lane.socket}`)} image inspect ${quote(image)} >/dev/null 2>&1 || docker image save ${quote(image)} | docker --host ${quote(`unix://${lane.socket}`)} image load >/dev/null`),
    ]),
    'printf "WARM_IMAGES=PASS\\n"',
  ))};
};

const apply = ({repair = false} = {}) => {
  const configPayloads = lanes.map((lane) => ({lane, contents: daemonConfig(lane), sha256: sha256(daemonConfig(lane))}));
  const unit = serviceUnit(); const unitSha256 = sha256(unit);
  remote(script(
    'set -euo pipefail',
    `config_root=${quote(configRoot)}`, `runtime_root=${quote(runtimeRoot)}`, `daemon_root=${quote(daemonRoot)}`,
    'install -d -m 0750 "$config_root" "$runtime_root" "$daemon_root"',
    `unit_path=${quote(`/etc/systemd/system/${servicePrefix}@.service`)}`,
    `unit_expected=${quote(unitSha256)}`,
    `unit_payload=${quote(Buffer.from(unit).toString('base64'))}`,
    'if test -e "$unit_path" && test "$(sha256sum "$unit_path" | awk \'{print $1}\')" != "$unit_expected"; then printf "MANAGED_DAEMON_UNIT_DRIFT\\n" >&2; exit 69; fi',
    'if ! test -e "$unit_path"; then printf "%s" "$unit_payload" | base64 -d > "$unit_path.tmp"; chmod 0644 "$unit_path.tmp"; mv "$unit_path.tmp" "$unit_path"; fi',
    ...configPayloads.flatMap(({lane, contents, sha256: expected}) => [
      `config_path=${quote(lane.config)}`,
      `config_expected=${quote(expected)}`,
      `config_prior_invalid=${quote(sha256(priorInvalidDaemonConfig(lane)))}`,
      `config_interim_invalid=${quote(sha256(interimInvalidDaemonConfig(lane)))}`,
      `config_prior_ipv6_unsafe=${quote(sha256(priorIpv6UnsafeDaemonConfig(lane)))}`,
      `config_payload=${quote(Buffer.from(contents).toString('base64'))}`,
      'if test -e "$config_path"; then config_actual="$(sha256sum "$config_path" | awk \'{print $1}\')"; test "$config_actual" = "$config_expected" || { test ' + (repair ? '"$config_actual" = "$config_prior_invalid" || test "$config_actual" = "$config_interim_invalid" || test "$config_actual" = "$config_prior_ipv6_unsafe"' : 'false') + ' || { printf "MANAGED_DAEMON_CONFIG_DRIFT\\n" >&2; exit 69; }; }; fi',
      `install -d -m 0710 ${quote(`${runtimeRoot}/daemon-${lane.lane}`)} ${quote(`${daemonRoot}/daemon-${lane.lane}`)}`,
      repair ? `systemctl stop ${quote(lane.service)} || true` : '',
      'if ! test -e "$config_path" || test "${config_actual:-}" = "$config_prior_invalid" || test "${config_actual:-}" = "$config_interim_invalid" || test "${config_actual:-}" = "$config_prior_ipv6_unsafe"; then printf "%s" "$config_payload" | base64 -d > "$config_path.tmp"; chmod 0640 "$config_path.tmp"; mv "$config_path.tmp" "$config_path"; fi',
      `if ip link show dev ${quote(lane.bridge)} >/dev/null 2>&1; then ip -o -4 addr show dev ${quote(lane.bridge)} | awk '{print $4}' | grep -Fx ${quote(lane.subnet)} >/dev/null || { printf 'MANAGED_DAEMON_BRIDGE_DRIFT=${lane.lane}\\n' >&2; exit 69; }; else ip link add name ${quote(lane.bridge)} type bridge; ip addr add ${quote(lane.subnet)} dev ${quote(lane.bridge)}; ip link set ${quote(lane.bridge)} up; fi`,
    ]),
    'systemctl daemon-reload',
    ...(repair ? lanes.map((lane) => `systemctl reset-failed ${quote(lane.service)} || true`) : []),
    ...lanes.map((lane) => `systemctl enable --now ${quote(lane.service)}`),
    'for _ in $(seq 1 40); do ready=1',
    ...lanes.map((lane) => `test -S ${quote(lane.socket)} || ready=0`),
    'test "$ready" = 1 && break; sleep 0.25; done',
    ...lanes.map((lane) => `test -S ${quote(lane.socket)} || { systemctl status ${quote(lane.service)} --no-pager >&2; exit 70; }`),
    ...lanes.map((lane) => `printf 'LANE_${lane.lane}_ENGINE_ID=%s\\n' "$(docker --host ${quote(`unix://${lane.socket}`)} info --format '{{.ID}}')"`),
    'printf "APPLY=PASS\\n"',
  ));
  return status();
};

const status = () => {
  const output = remote(script(
    'set -euo pipefail',
    ...lanes.flatMap((lane) => [
      `systemctl is-active --quiet ${quote(lane.service)}`,
      `test -S ${quote(lane.socket)}`,
      `printf 'LANE_${lane.lane}_ENGINE_ID=%s\\n' "$(docker --host ${quote(`unix://${lane.socket}`)} info --format '{{.ID}}')"`,
    ]),
    'printf "STATUS=PASS\\n"',
  ));
  const facts = Object.fromEntries(output.trim().split('\n').filter(Boolean).map((line) => line.split('=')));
  const engineIds = lanes.map((lane) => facts[`LANE_${lane.lane}_ENGINE_ID`]);
  if (engineIds.some((value) => !/^[a-f0-9-]{36}$/i.test(value ?? '')) || new Set(engineIds).size !== lanes.length) fail('DAEMON_LANES_ENGINE_ID_NOT_DISTINCT');
  return {status: 'PASS', lanes: lanes.map((lane, index) => ({lane: lane.lane, socket: lane.socket, engineId: engineIds[index]}))};
};

const diagnose = () => {
  const output = remote(script(
  'set -u',
  ...lanes.flatMap((lane) => [
    `printf 'UNIT_${lane.lane}_ACTIVE=%s\\n' "$(systemctl is-active ${quote(lane.service)} 2>/dev/null || true)"`,
    `printf 'UNIT_${lane.lane}_SOCKET=%s\\n' "$(test -S ${quote(lane.socket)} && printf PRESENT || printf ABSENT)"`,
    `printf 'UNIT_${lane.lane}_ENGINE_ID=%s\\n' "$(docker --host ${quote(`unix://${lane.socket}`)} info --format '{{.ID}}' 2>/dev/null || true)"`,
    `printf 'UNIT_${lane.lane}_DATA_ROOT=%s\\n' "$(docker --host ${quote(`unix://${lane.socket}`)} info --format '{{.DockerRootDir}}' 2>/dev/null || true)"`,
    `printf 'UNIT_${lane.lane}_JOURNAL_BEGIN\\n'`,
    `journalctl -u ${quote(lane.service)} -n 40 --no-pager 2>&1 || true`,
    `printf 'UNIT_${lane.lane}_JOURNAL_END\\n'`,
  ]),
  ...terminatorGovernanceDiagnosticScript(),
  ));
  return Object.freeze({output, terminatorGovernance: parseRemoteTerminatorGovernance(output)});
};

const execute = () => {
  if (!['--preflight', '--apply', '--repair', '--warm-images', '--status', '--diagnose'].includes(mode)) fail('DAEMON_LANES_MODE_INVALID');
  mkdirSync(evidence, {recursive: true});
  const manifest = {kind: 'r5-testcontainers-daemon-lanes', runId, startedAt: now(), mode, remoteHost: trust, business: {status: 'NOT_APPLICABLE'}, cleanup: {status: 'NOT_APPLICABLE'}};
  try {
    if (['--preflight', '--apply'].includes(mode)) {
      manifest.preflight = preflight();
      event('PREFLIGHT', {RUN_ID: runId, STATUS: 'PASS', MEMORY_AVAILABLE_MIB: manifest.preflight.memoryAvailableMiB, DISK_AVAILABLE_MIB: manifest.preflight.diskAvailableMiB});
    }
    if (mode === '--apply') { manifest.deployment = apply(); manifest.business = {status: 'PASS'}; event('APPLIED', {RUN_ID: runId, STATUS: 'PASS', LANES: backendAcceptanceDaemonLaneCapacity()}); }
    if (mode === '--repair') { manifest.deployment = apply({repair: true}); manifest.business = {status: 'PASS'}; event('REPAIRED', {RUN_ID: runId, STATUS: 'PASS', LANES: backendAcceptanceDaemonLaneCapacity()}); }
    if (mode === '--warm-images') { manifest.imageWarmup = warmTestcontainersImages(); manifest.business = {status: 'PASS'}; event('WARMED_IMAGES', {RUN_ID: runId, STATUS: 'PASS', IMAGES: manifest.imageWarmup.images.join(',')}); }
    if (mode === '--status') { manifest.deployment = status(); manifest.business = {status: 'PASS'}; event('STATUS', {RUN_ID: runId, STATUS: 'PASS', LANES: backendAcceptanceDaemonLaneCapacity()}); }
    if (mode === '--diagnose') { manifest.diagnosis = diagnose(); manifest.business = {status: 'PASS'}; process.stdout.write(manifest.diagnosis.output); event('DIAGNOSED', {RUN_ID: runId, STATUS: 'PASS'}); }
    if (mode === '--preflight') manifest.business = {status: 'PASS'};
  } catch (error) {
    manifest.business = {status: 'FAIL', reason: error instanceof Error ? error.message : String(error)};
    throw error;
  } finally {
    manifest.completedAt = now();
    atomicWrite(path.join(evidence, 'run-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  }
};

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  try { execute(); }
  catch (error) { process.stderr.write(`R5_TESTCONTAINERS_DAEMON_LANES=FAIL; REASON=${error instanceof Error ? error.message : String(error)}; EVIDENCE=${path.relative(root, evidence)}\n`); process.exitCode = 2; }
}
