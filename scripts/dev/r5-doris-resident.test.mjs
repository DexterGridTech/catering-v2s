import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  DORIS_RESIDENT_IMAGE,
  DORIS_RESIDENT_IMAGE_ID,
  DORIS_RESIDENT_REPO_DIGEST,
  DORIS_RESIDENT_CONTAINER,
  buildResidentManifest,
  parseResidentReport,
  renderEnsureResidentScript,
  renderResidentTruncateScript,
  renderVerifyResidentScript,
  validateResidentManifest,
  writeResidentManifest,
} from './r5-doris-resident.mjs';

const identity = {
  host: 'catering-remote-dev',
  fingerprint: 'a'.repeat(64),
  bootId: '01234567-89ab-cdef-0123-456789abcdef',
  containerId: 'b'.repeat(64),
  imageId: DORIS_RESIDENT_IMAGE_ID,
  feVolumeId: 'c'.repeat(64),
  beVolumeId: 'd'.repeat(64),
  health: 'healthy',
  availableMemoryMiB: 4096,
  dockerMemoryBytes: 34359738368,
};
const report = Object.entries({
  STATUS: 'PASS', BOOT_ID: identity.bootId, CONTAINER_ID: identity.containerId,
  IMAGE_ID: identity.imageId, FE_VOLUME_ID: identity.feVolumeId,
  BE_VOLUME_ID: identity.beVolumeId, HEALTH: identity.health,
  AVAILABLE_MEMORY_MIB: String(identity.availableMemoryMiB),
  DOCKER_MEMORY_BYTES: String(identity.dockerMemoryBytes),
}).map(([name, value]) => `R5_DORIS_RESIDENT\t${name}\t${value}`).join('\n');

const manifest = () => buildResidentManifest({host: identity.host, fingerprint: identity.fingerprint, report: identity});

test('resident Doris manifest binds host, pinned image, loopback ports, volumes and writer identity', () => {
  const value = manifest();
  assert.equal(value.host, identity.host);
  assert.equal(value.imageRef, DORIS_RESIDENT_IMAGE);
  assert.equal(value.repoDigest, DORIS_RESIDENT_REPO_DIGEST);
  assert.deepEqual(value.ports, {mysql: '127.0.0.1:9030', http: '127.0.0.1:8030', load: '127.0.0.1:8040'});
  assert.equal(value.username, 'tds_history_writer');
  assert.throws(() => validateResidentManifest({...value, host: 'other-host'}, {host: identity.host, fingerprint: identity.fingerprint}), /R5_DORIS_RESIDENT_MANIFEST_INVALID/);
  assert.throws(() => validateResidentManifest({...value, ports: {...value.ports, load: '0.0.0.0:8040'}}, {host: identity.host, fingerprint: identity.fingerprint}), /R5_DORIS_RESIDENT_MANIFEST_INVALID/);
  assert.throws(() => validateResidentManifest({...value, imageId: `sha256:${'0'.repeat(64)}`}, {host: identity.host, fingerprint: identity.fingerprint}), /R5_DORIS_RESIDENT_MANIFEST_INVALID/);
});

test('remote ensure, verify and reset scripts are syntactically valid and fail closed on ownership drift', () => {
  const value = manifest();
  const ensure = renderEnsureResidentScript({
    expectedBootId: identity.bootId,
    hostFingerprint: identity.fingerprint,
    attemptId: '01234567-89ab-cdef-0123-456789abcdef',
    password: 'e'.repeat(64),
    ddlBase64: Buffer.from('CREATE DATABASE IF NOT EXISTS terminal_connection_history;').toString('base64'),
  });
  const verify = renderVerifyResidentScript(value);
  const reset = renderResidentTruncateScript(value);
  for (const script of [ensure, verify, reset]) {
    const syntax = spawnSync('bash', ['-n'], {encoding: 'utf8', input: script});
    assert.equal(syntax.status, 0, syntax.stderr);
  }
  assert.doesNotMatch(ensure, /docker pull/);
  assert.match(ensure, /docker run --detach[\s\S]*127\.0\.0\.1:8040:8040/);
  assert.match(ensure, /trap cleanup_partial_resident EXIT/);
  assert.match(ensure, /docker container rm --force/);
  assert.match(ensure, /docker volume rm/);
  assert.match(ensure, /com\.catering-v2s\.doris-resident\.attempt/);
  assert.match(ensure, /resident_ready=true/);
  assert.match(ensure, /adopted_existing_container=true/);
  assert.match(ensure, /expected_container_facts=/);
  assert.match(ensure, /expected_mount_facts=/);
  assert.match(ensure, /DORIS_RESIDENT_ORPHAN_VOLUME_WITHOUT_MANIFEST/);
  assert.match(verify, /PORT_BINDING_INVALID/);
  assert.match(reset, /TRUNCATE TABLE \$database\.\$table/);
  assert.match(reset, /DORIS_RESET_READBACK_NONZERO/);
  assert.doesNotMatch(reset, /docker volume rm|docker rm -f|docker image rm/);
});

test('failed resident initialization removes only resources carrying this attempt identity', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'r5-doris-resident-failure-'));
  try {
    const bin = path.join(directory, 'bin');
    const state = path.join(directory, 'state');
    const log = path.join(directory, 'docker.log');
    const attemptId = '01234567-89ab-cdef-0123-456789abcdef';
    const containerId = 'b'.repeat(64);
    const mockDocker = `#!/usr/bin/env bash
set -u
printf '%s\\n' "$*" >> "$MOCK_DOCKER_LOG"
state=$MOCK_DOCKER_STATE
container_id=${containerId}
attempt=${attemptId}
owner=r5-dev-resident
case "$1" in
  image)
    if [[ "$*" == *'{{.Id}}'* ]]; then printf '%s\\n' '${DORIS_RESIDENT_IMAGE_ID}'; fi
    if [[ "$*" == *'RepoDigests'* ]]; then printf '%s\\n' '${DORIS_RESIDENT_REPO_DIGEST}'; fi
    ;;
  volume)
    action=$2; shift 2
    if [[ "$action" == ls ]]; then
      [[ "\${MOCK_FAIL_INVENTORY:-}" == volume ]] && exit 1
      [[ -f "$state/catering-v2s-r5-doris-fe-meta" ]] && printf '%s\\n' catering-v2s-r5-doris-fe-meta
      [[ -f "$state/catering-v2s-r5-doris-be-storage" ]] && printf '%s\\n' catering-v2s-r5-doris-be-storage
      exit 0
    fi
    if [[ "$action" == create ]]; then name=\"\${@: -1}\"; : > \"$state/$name\"; exit 0; fi
    if [[ "$action" == rm ]]; then name=$1; rm -f \"$state/$name\"; exit 0; fi
    if [[ "$action" == inspect ]]; then fmt=$2; name=$3; [[ -f \"$state/$name\" ]] || exit 1
      if [[ "$fmt" == '{{.Name}}' ]]; then printf '%s\\n' "$name"
      elif [[ "$fmt" == *'doris-resident.attempt'* ]]; then printf '%s|local|%s|%s\\n' "$name" "$owner" "$attempt"
      else printf '%s|local|%s\\n' "$name" "$owner"; fi
    fi
    ;;
  container)
    action=$2; shift 2
    if [[ "$action" == ls ]]; then
      [[ "\${MOCK_FAIL_INVENTORY:-}" == container ]] && exit 1
      [[ -f "$state/container" ]] && printf '%s\\n' "$container_id"
      exit 0
    fi
    if [[ "$action" == rm ]]; then rm -f "$state/container"; exit 0; fi
    ;;
  inspect)
    shift; fmt=$2; name=$3
    [[ -f "$state/container" ]] || exit 1
    if [[ "$fmt" == *'{{.State.Health.Status}}'* ]]; then printf 'healthy\\n'
    elif [[ "$fmt" == *'{{.State.Running}}'* ]]; then printf 'true\\n'
    elif [[ "$fmt" == *'{{json .HostConfig.PortBindings}}'* ]]; then printf '%s\\n' '{"9030/tcp":[{"HostIp":"127.0.0.1","HostPort":"9030"}],"8030/tcp":[{"HostIp":"127.0.0.1","HostPort":"8030"}],"8040/tcp":[{"HostIp":"127.0.0.1","HostPort":"8040"}]}'
    elif [[ "$fmt" == *'{{range .Mounts}}'* ]]; then printf '%s\\n' 'catering-v2s-r5-doris-be-storage:/opt/apache-doris/be/storage;catering-v2s-r5-doris-fe-meta:/opt/apache-doris/fe/doris-meta;'
    elif [[ "$fmt" == *'{{.HostConfig.RestartPolicy.Name}}'* ]]; then
      if [[ "$fmt" == *'doris-resident.attempt'* ]]; then printf '%s|%s|%s|%s|%s|%s|unless-stopped\\n' "$container_id" '${DORIS_RESIDENT_IMAGE_ID}' '${DORIS_RESIDENT_IMAGE}' "$owner" '${identity.fingerprint}' "$attempt"
      else printf '%s|%s|%s|%s|%s|unless-stopped\\n' "$container_id" '${DORIS_RESIDENT_IMAGE_ID}' '${DORIS_RESIDENT_IMAGE}' "$owner" '${identity.fingerprint}'; fi
    elif [[ "$fmt" == *'{{.Name}}'* ]]; then printf '%s|/%s|%s|%s|%s|%s|%s\\n' "$container_id" '${DORIS_RESIDENT_CONTAINER}' '${DORIS_RESIDENT_IMAGE_ID}' '${DORIS_RESIDENT_IMAGE}' "$owner" '${identity.fingerprint}' "$attempt"
    elif [[ "$fmt" == *'doris-resident.attempt'* ]]; then printf '%s|%s|%s|%s|%s|%s\\n' "$container_id" '${DORIS_RESIDENT_IMAGE_ID}' '${DORIS_RESIDENT_IMAGE}' "$owner" '${identity.fingerprint}' "$attempt"
    elif [[ "$fmt" == *'{{.Id}}'* ]]; then printf '%s\\n' "$container_id"
    fi
    ;;
  run) : > "$state/container" ;;
  exec)
    if [[ "\${MOCK_EXEC_SUCCESS:-}" == true ]]; then
      if [[ "$*" == *'mysql'* ]]; then
        input=$(cat)
        printf '%s' "$input" > "$state/mysql-input"
        if [[ "$input" == *"ALTER USER 'tds_history_writer' IDENTIFIED BY "* ]]; then
          printf '%s' 'reconciled' > "$state/writer-password"
        fi
        if [[ "$input" == *'SHOW GRANTS'* ]]; then printf '%s\\n' 'terminal_connection_history.connection_history: LOAD_PRIV'; fi
      fi
      exit 0
    fi
    exit 1
    ;;
  info) printf '34359738368\\n' ;;
esac
`;
    mkdirSync(bin, {recursive: true});
    mkdirSync(state, {recursive: true});
    const dockerPath = path.join(bin, 'docker');
    writeFileSync(dockerPath, mockDocker, {mode: 0o700});
    writeFileSync(path.join(bin, 'cat'), `#!/usr/bin/env bash
if [[ "$1" == /proc/sys/kernel/random/boot_id ]]; then printf '%s\\n' '${identity.bootId}'; else exec /bin/cat "$@"; fi
`, {mode: 0o700});
    writeFileSync(path.join(bin, 'awk'), `#!/usr/bin/env bash
if [[ "$*" == *'/proc/meminfo'* ]]; then printf '4096\\n'; else exec /usr/bin/awk "$@"; fi
`, {mode: 0o700});
    const ensure = renderEnsureResidentScript({
      expectedBootId: identity.bootId,
      hostFingerprint: identity.fingerprint,
      attemptId,
      password: 'e'.repeat(64),
      ddlBase64: Buffer.from('CREATE DATABASE IF NOT EXISTS terminal_connection_history;').toString('base64'),
    });
    const result = spawnSync('bash', ['-c', ensure], {
      encoding: 'utf8',
      env: {...process.env, PATH: `${bin}:${process.env.PATH}`, MOCK_DOCKER_STATE: state, MOCK_DOCKER_LOG: log},
    });
    const commands = readFileSync(log, 'utf8').split(/\r?\n/);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /R5_DORIS_RESIDENT_FAILURE=DORIS_RESIDENT_DDL_FAILED/, `stdout=${result.stdout}; docker=${commands.join(' | ')}`);
    assert.match(result.stderr, /R5_DORIS_RESIDENT_PARTIAL_CLEANUP=PASS/);
    assert.ok(commands.some(command => command.startsWith(`container rm --force ${containerId}`)));
    assert.ok(commands.some(command => command === 'volume rm catering-v2s-r5-doris-fe-meta'));
    assert.ok(commands.some(command => command === 'volume rm catering-v2s-r5-doris-be-storage'));
    assert.equal(commands.some(command => /image rm|image prune|docker pull/.test(command)), false);
    assert.deepEqual(readdirSync(state), []);

    const adoptionState = path.join(directory, 'state-adoption');
    const adoptionLog = path.join(directory, 'docker-adoption.log');
    mkdirSync(adoptionState, {recursive: true});
    writeFileSync(path.join(adoptionState, 'container'), 'managed-resident');
    writeFileSync(path.join(adoptionState, 'catering-v2s-r5-doris-fe-meta'), 'managed-volume');
    writeFileSync(path.join(adoptionState, 'catering-v2s-r5-doris-be-storage'), 'managed-volume');
    writeFileSync(path.join(adoptionState, 'writer-password'), 'stale-password-from-persisted-resident');
    const adoption = spawnSync('bash', ['-c', renderEnsureResidentScript({
      expectedBootId: identity.bootId,
      hostFingerprint: identity.fingerprint,
      attemptId,
      password: 'e'.repeat(64),
      ddlBase64: Buffer.from('CREATE DATABASE IF NOT EXISTS terminal_connection_history;').toString('base64'),
    })], {
      encoding: 'utf8',
      env: {...process.env, PATH: `${bin}:${process.env.PATH}`, MOCK_DOCKER_STATE: adoptionState, MOCK_DOCKER_LOG: adoptionLog, MOCK_EXEC_SUCCESS: 'true'},
    });
    assert.equal(adoption.status, 0, adoption.stderr);
    assert.match(adoption.stdout, /R5_DORIS_RESIDENT\tADOPTED_EXISTING_CONTAINER\ttrue/);
    assert.equal(parseResidentReport(adoption.stdout).adoptedExistingContainer, true);
    const adoptionWriterSql = readFileSync(path.join(adoptionState, 'mysql-input'), 'utf8');
    assert.ok(adoptionWriterSql.includes("ALTER USER 'tds_history_writer' IDENTIFIED BY '" + 'e'.repeat(64) + "'"), 'adoption must set the persisted password to the current DEV credential');
    assert.equal(readFileSync(path.join(adoptionState, 'writer-password'), 'utf8'), 'reconciled', 'a stale password is not repaired by CREATE USER IF NOT EXISTS alone');
    assert.equal(adoption.stdout.includes('e'.repeat(64)) || adoption.stderr.includes('e'.repeat(64)) || readFileSync(adoptionLog, 'utf8').includes('e'.repeat(64)), false, 'writer password must not appear in diagnostics');
    const adoptionCommands = readFileSync(adoptionLog, 'utf8').split(/\\r?\\n/);
    assert.equal(adoptionCommands.some(command => command.startsWith('run --detach')), false, 'adoption must not create another Doris container');
    assert.ok(adoptionCommands.some(command => command.includes('volume inspect')));
    for (const failedInventory of ['container', 'volume']) {
      const failedState = path.join(directory, `state-${failedInventory}`);
      const failedLog = path.join(directory, `docker-${failedInventory}.log`);
      mkdirSync(failedState, {recursive: true});
      const failedCleanup = spawnSync('bash', ['-c', ensure], {
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${bin}:${process.env.PATH}`,
          MOCK_DOCKER_STATE: failedState,
          MOCK_DOCKER_LOG: failedLog,
          MOCK_FAIL_INVENTORY: failedInventory,
        },
      });
      const failedCommands = readFileSync(failedLog, 'utf8').split(/\r?\n/);
      assert.notEqual(failedCleanup.status, 0);
      assert.match(failedCleanup.stderr, /R5_DORIS_RESIDENT_PARTIAL_CLEANUP=FAIL/);
      assert.match(failedCleanup.stderr, /R5_DORIS_RESIDENT_FAILURE=DORIS_RESIDENT_DDL_FAILED/);
      if (failedInventory === 'container') {
        assert.equal(failedCommands.some(command => command.startsWith('container rm ')), false);
      }
      rmSync(failedState, {recursive: true, force: true});
    }
  } finally {
    rmSync(directory, {recursive: true, force: true});
  }
});

test('resident report parser rejects incomplete and wrong image identities', () => {
  assert.deepEqual(parseResidentReport(report).containerId, identity.containerId);
  assert.throws(() => parseResidentReport('R5_DORIS_RESIDENT\tSTATUS\tPASS'), /R5_DORIS_RESIDENT_REPORT_INVALID/);
  assert.throws(() => parseResidentReport(report.replace(identity.imageId, `sha256:${'0'.repeat(64)}`)), /R5_DORIS_RESIDENT_REPORT_INVALID/);
});

test('resident manifest is written atomically with restrictive permissions and excludes writer password', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'r5-doris-resident-'));
  try {
    const filePath = path.join(directory, 'resident.json');
    const value = manifest();
    writeResidentManifest(filePath, value);
    const contents = readFileSync(filePath, 'utf8');
    assert.equal(JSON.parse(contents).containerId, identity.containerId);
    assert.doesNotMatch(contents, /password|secret/i);
    assert.equal(statSync(filePath).mode & 0o777, 0o600);
  } finally {
    rmSync(directory, {recursive: true, force: true});
  }
});
