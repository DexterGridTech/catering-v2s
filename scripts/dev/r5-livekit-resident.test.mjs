import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  LIVEKIT_RESIDENT_IMAGE,
  LIVEKIT_RESIDENT_SOURCE_IMAGE,
  LIVEKIT_RESIDENT_KIND,
  LIVEKIT_RESIDENT_MIN_AVAILABLE_DISK_MIB,
  LIVEKIT_RESIDENT_MIN_AVAILABLE_MEMORY_MIB,
  parseDockerPullLayerProgress,
  parseLivekitImageImportReport,
  LIVEKIT_RESIDENT_PROJECT,
  livekitResidentLogAttemptId,
  formatLivekitEnsureFailure,
  livekitCredentialsPath,
  livekitResidentAttemptLogPath,
  readLivekitManifest,
  validateLivekitDevBinding,
  redactLivekitOutput,
  renderLivekitConfig,
  renderLivekitImageImportCommand,
  renderLivekitRemoteScript,
} from './r5-livekit-resident.mjs';

const identity = {
  schemaVersion: 1,
  kind: LIVEKIT_RESIDENT_KIND,
  host: 'catering-remote-dev',
  hostFingerprint: 'a'.repeat(64),
  bootId: '01234567-89ab-cdef-0123-456789abcdef',
  containerName: 'catering-v2s-livekit-resident',
  containerId: 'b'.repeat(64),
  imageRef: LIVEKIT_RESIDENT_IMAGE,
  sourceImageRef: LIVEKIT_RESIDENT_SOURCE_IMAGE,
  imageId: `sha256:${'c'.repeat(64)}`,
  configSha256: 'd'.repeat(64),
  attemptId: '01234567-89ab-cdef-0123-456789abcdea',
  endpoint: 'http://47.106.121.27:7880',
  signalUrl: 'ws://47.106.121.27:7880',
  udpPort: 7882,
  state: 'RUNNING',
};

test('LiveKit reads the credentials owned by the selected R5 runtime', () => {
  const runtimeDirectory = path.join(os.tmpdir(), 'remote-control-r5-runtime');
  assert.equal(livekitCredentialsPath(runtimeDirectory), path.join(runtimeDirectory, 'credentials.env'));
});

test('LiveKit config keeps the current bare IP transport and does not enable external STUN or TURN', () => {
  const template = readFileSync(new URL('./livekit/livekit.yaml.template', import.meta.url), 'utf8');
  const config = renderLivekitConfig(template, {apiKey: 'r5dev_key_1234', apiSecret: 's'.repeat(64)});
  assert.match(config, /node_ip: 47\.106\.121\.27/);
  assert.match(config, /udp_port: 7882/);
  assert.match(config, /use_external_ip: false/);
  assert.match(config, /enabled: false/);
  assert.doesNotMatch(config, /__LIVEKIT_API_(?:KEY|SECRET)__/);
  assert.throws(() => renderLivekitConfig(template, {apiKey: 'bad:key', apiSecret: 's'.repeat(64)}), /CREDENTIAL_INVALID/);
});

test('the official image reference retains its pinned digest and parses pull progress', () => {
  const digest = 'sha256:6fd3b7088874c4d119160dd688798dfec852bc014786d392caad15f6f63912a3';
  assert.equal(LIVEKIT_RESIDENT_SOURCE_IMAGE, `livekit/livekit-server@${digest}`);
  assert.equal(LIVEKIT_RESIDENT_IMAGE, 'livekit/livekit-server:r5-6fd3b7088874');
  assert.deepEqual(parseDockerPullLayerProgress('427bf4fdbf3d: Downloading [=====> ] 12.3MB/58.4MB'), {
    layer: '427bf4fdbf3d', status: 'Downloading', transfer: '12.3MB/58.4MB',
  });
  assert.deepEqual(parseDockerPullLayerProgress('427bf4fdbf3d: Download complete'), {
    layer: '427bf4fdbf3d', status: 'Download complete', transfer: undefined,
  });
  assert.equal(parseDockerPullLayerProgress('not a Docker layer line'), null);
});

test('remote lifecycle scripts are valid shell and bind actions to the pinned image and managed identity', () => {
  const base = {
    fingerprint: identity.hostFingerprint,
    attemptId: identity.attemptId,
    configSha256: identity.configSha256,
  };
  const scripts = [
    renderLivekitRemoteScript({...base, action: 'init'}),
    renderLivekitRemoteScript({...base, action: 'cache'}),
    renderLivekitRemoteScript({...base, action: 'start', configBase64: 'eA==', composeBase64: 'eQ=='}),
    renderLivekitRemoteScript({...base, action: 'check', expected: identity}),
    renderLivekitRemoteScript({...base, action: 'stop', expected: identity}),
    renderLivekitImageImportCommand({expectedBootId: identity.bootId, platform: 'linux/amd64', expectedImageId: 'sha256:' + 'e'.repeat(64)}),
  ];
  for (const script of scripts) {
    const syntax = spawnSync('bash', ['-n'], {encoding: 'utf8', input: script});
    assert.equal(syntax.status, 0, syntax.stderr);
  }
  const cache = scripts[1];
  const start = scripts[2];
  const init = scripts[0];
  const check = scripts[3];
  const stop = scripts[4];
  const imageImport = scripts[5];
  for (const script of [start, check]) {
    assert.doesNotMatch(script, /47\.106\.121\.27/);
    assert.match(script, /ENDPOINT_REF\\tLIVEKIT_RESIDENT_ENDPOINT/);
    assert.match(script, /SIGNAL_TRANSPORT\\tWS/);
  }
  assert.match(start, /livekit\/livekit-server:r5-6fd3b7088874/);
  assert.match(start, /livekit\/livekit-server@sha256:6fd3b7088874c4d119160dd688798dfec852bc014786d392caad15f6f63912a3/);
  assert.match(start, /UNMANIFESTED_CONTAINER_EXISTS/);
  assert.match(start, /R5_LIVEKIT_RUNNER_CLEANUP=PASS/);
  assert.match(start, /7880\/tcp/);
  assert.match(start, /7882\/udp/);
  assert.match(init, /COMPOSE_MODE/);
  assert.match(init, /REGISTRY_MIRROR_KIND/);
  assert.match(init, /HOST_ARCH/);
  assert.match(init, /aliyuncs\.com/);
  assert.match(init, /daocloud/);
  assert.match(init, /huaweicloud/);
  assert.match(init, /tencentyun/);
  assert.match(start, /command -v docker-compose/);
  assert.match(start, new RegExp(`project_name='${LIVEKIT_RESIDENT_PROJECT}-${identity.attemptId}'`));
  assert.match(start, /compose --project-name "\$project_name" .* down/);
  assert.match(start, /network_ids=\$\(project_network_ids\).*test -z "\$network_ids"/);
  assert.match(start, /minimum_memory_mib=2048/);
  assert.match(start, /minimum_disk_kib=2097152/);
  assert.doesNotMatch(start, /docker pull/);
  assert.match(start, /IMAGE_NOT_CACHED/);
  assert.ok(start.indexOf('resource_preflight BEFORE_COMPOSE_UP') < start.indexOf('docker image inspect --platform'));
  assert.ok(start.indexOf('docker image inspect --platform') < start.indexOf('compose --project-name'));
  assert.match(cache, /docker pull "\$source_image_ref"/);
  assert.match(cache, /progress IMAGE_PULL/);
  assert.match(cache, /progress IMAGE_CACHE_READBACK/);
  assert.ok(cache.indexOf('docker pull "$source_image_ref"') < cache.indexOf('progress IMAGE_CACHE_READBACK'));
  assert.match(cache, /PINNED_SOURCE_DIGEST_MISMATCH/);
  assert.match(cache, /livekit-resident-image-cache/);
  assert.match(cache, /IMAGE_CACHED\\ttrue/);
  assert.match(start, /progress IMAGE_CACHE_READBACK/);
  assert.match(start, /progress COMPOSE_UP/);
  assert.match(start, /progress HEALTHCHECK/);
  assert.match(start, /RESOURCE_BUDGET_INSUFFICIENT_MEMORY/);
  assert.match(start, /RESOURCE_BUDGET_INSUFFICIENT_HOME_DISK/);
  assert.match(start, /RESOURCE_BUDGET_INSUFFICIENT_DOCKER_DISK/);
  assert.match(start, /R5_LIVEKIT_RESOURCE_PREFLIGHT/);
  assert.match(start, /AVAILABLE_DOCKER_DISK_KIB/);
  assert.match(start, /IMAGE_CACHED_BEFORE/);
  assert.ok(start.includes(String.raw`R5_LIVEKIT_RESIDENT\tWS_SIGNAL_READY\tNOT_PROVEN`));
  assert.ok(start.includes(String.raw`R5_LIVEKIT_RESIDENT\tUDP_MEDIA_PROOF\tNOT_RUN`));
  assert.ok(start.includes(String.raw`R5_LIVEKIT_RESIDENT\tT04_STATUS\tPARTIAL`));
  assert.ok(!start.includes(String.raw`R5_LIVEKIT_RESIDENT\tT04_STATUS\tPASS`));
  assert.match(stop, /compose --project-name "\$project_name" .* down/);
  assert.match(stop, /network_remaining=\$\(project_network_ids\).*test -z "\$network_remaining"/);
  assert.match(stop, /R5_LIVEKIT_RESIDENT\s+CLEANUP\s+PASS/);
  assert.doesNotMatch(stop, /docker rm/);
  assert.match(init, /AVAILABLE_DOCKER_DISK_KIB/);
  assert.match(init, /livekit-resident-image-cache/);
  assert.match(imageImport, /docker image load/);
  assert.match(imageImport, /docker image tag/);
  assert.match(imageImport, /IMAGE_ID_MISMATCH/);
  assert.match(imageImport, /IMAGE_PLATFORM_MISMATCH/);
  assert.match(imageImport, /HOST_BOOT_ID_CHANGED/);
  assert.match(imageImport, /livekit-resident-image-cache/);
  assert.equal(LIVEKIT_RESIDENT_MIN_AVAILABLE_MEMORY_MIB, 2048);
  assert.equal(LIVEKIT_RESIDENT_MIN_AVAILABLE_DISK_MIB, 2048);
  assert.notEqual(
    livekitResidentAttemptLogPath('start', identity.attemptId),
    livekitResidentAttemptLogPath('start', '11234567-89ab-cdef-0123-456789abcdef'),
  );
  const checkAttemptOne = livekitResidentLogAttemptId('check', identity.attemptId);
  const checkAttemptTwo = livekitResidentLogAttemptId('check', identity.attemptId);
  assert.match(checkAttemptOne, /^[a-f0-9-]{36}$/i);
  assert.notEqual(checkAttemptOne, checkAttemptTwo);
  assert.equal(livekitResidentLogAttemptId('start', identity.attemptId), identity.attemptId);
  assert.match(livekitResidentAttemptLogPath('start', identity.attemptId), new RegExp(`${identity.attemptId}/start\\.log$`));
  assert.throws(() => livekitResidentAttemptLogPath('start', '../outside'), /LOG_IDENTITY_INVALID/);
  assert.doesNotMatch(start, /docker image rm/);
  assert.doesNotMatch(start, /docker system prune/);
  assert.match(check, /CONTAINER_OWNERSHIP_MISMATCH/);
  assert.match(stop, /HOST_BOOT_ID_CHANGED/);
  assert.match(stop, /REMOTE_CONFIG_CLEANUP_READBACK_FAILED/);
  assert.doesNotMatch(check, /\$\{expected\.[A-Za-z_]/);
  assert.match(check, /"\$boot_id" "\$expected_container_id" 'sha256:[a-f0-9]{64}'/);
  assert.notEqual(
    livekitResidentAttemptLogPath('cache', identity.attemptId),
    livekitResidentAttemptLogPath('cache', '11234567-89ab-cdef-0123-456789abcdef'),
  );
  assert.match(livekitResidentAttemptLogPath('cache', identity.attemptId), new RegExp(`${identity.attemptId}/cache\\.log$`));
});

test('local image import report requires the pinned source digest and exact platform readback', () => {
  const valid = [
    `R5_LIVEKIT_IMAGE_READBACK\tSOURCE_DIGEST\t${LIVEKIT_RESIDENT_SOURCE_IMAGE}`,
    `R5_LIVEKIT_IMAGE_READBACK\tID\tsha256:${'e'.repeat(64)}`,
    'R5_LIVEKIT_IMAGE_READBACK\tOS\tlinux',
    'R5_LIVEKIT_IMAGE_READBACK\tARCH\tamd64',
    'R5_LIVEKIT_IMAGE_READBACK\tPLATFORM\tlinux/amd64',
    'R5_LIVEKIT_IMAGE_READBACK\tAVAILABLE_DOCKER_DISK_KIB\t12345678',
  ].join('\n');
  assert.equal(parseLivekitImageImportReport(valid).ID, `sha256:${'e'.repeat(64)}`);
  assert.throws(() => parseLivekitImageImportReport(valid.replace('linux/amd64', 'linux/arm64')), /IMPORT_REPORT_INVALID/);
  assert.throws(() => parseLivekitImageImportReport(valid.replace(LIVEKIT_RESIDENT_SOURCE_IMAGE, 'livekit/livekit-server:latest')), /IMPORT_REPORT_INVALID/);
});

test('manifest reading binds LiveKit resource identity to the trusted host and rejects corruption', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'r5-livekit-resident-'));
  const filePath = path.join(directory, 'manifest.json');
  try {
    assert.equal(readLivekitManifest(filePath, {host: identity.host, fingerprint: identity.hostFingerprint}), null);
    writeFileSync(filePath, JSON.stringify(identity));
    assert.throws(() => readLivekitManifest(filePath, {host: 'other-host', fingerprint: identity.hostFingerprint}), /R5_LIVEKIT_RESIDENT_MANIFEST_INVALID/);
    assert.equal(readLivekitManifest(filePath, {host: identity.host, fingerprint: identity.hostFingerprint}).containerId, identity.containerId);
    writeFileSync(filePath, JSON.stringify({...identity, containerId: 'not-an-id'}));
    assert.throws(() => readLivekitManifest(filePath, {host: identity.host, fingerprint: identity.hostFingerprint}), /R5_LIVEKIT_RESIDENT_MANIFEST_INVALID/);
  } finally {
    rmSync(directory, {recursive: true, force: true});
  }
});

test('managed DEV binds the current running LiveKit resident to the same host boot and container', () => {
  const currentResident = {...identity};
  const input = {
    developmentResident: {...identity},
    currentResident,
    host: identity.host,
    fingerprint: identity.hostFingerprint,
    expectedBootId: identity.bootId,
  };
  assert.deepEqual(validateLivekitDevBinding(input), {
    state: 'RUNNING',
    bootId: identity.bootId,
    containerId: identity.containerId,
    imageId: identity.imageId,
    endpointRef: 'LIVEKIT_RESIDENT_ENDPOINT',
    signalTransport: 'WS',
  });
  for (const mutate of [
    value => ({...value, developmentResident: undefined}),
    value => ({...value, developmentResident: {...value.developmentResident, state: 'STOPPED'}}),
    value => ({...value, currentResident: {...value.currentResident, bootId: '11234567-89ab-cdef-0123-456789abcdef'}}),
    value => ({...value, currentResident: {...value.currentResident, containerId: 'f'.repeat(64)}}),
    value => ({...value, developmentResident: {...value.developmentResident, endpoint: 'https://47.106.121.27:7880'}}),
  ]) {
    assert.throws(() => validateLivekitDevBinding(mutate(input)));
  }
});

test('credentials are sent only over the SSH input stream and never appear as command arguments', () => {
  const script = renderLivekitRemoteScript({
    fingerprint: identity.hostFingerprint,
    attemptId: identity.attemptId,
    configSha256: identity.configSha256,
    action: 'start',
    configBase64: Buffer.from('private-secret').toString('base64'),
    composeBase64: 'eA==',
  });
  assert.doesNotMatch(script, /private-secret/);
  assert.match(script, /base64 -d/);
});

test('LiveKit output redaction preserves diagnostics when init has no loaded credentials', () => {
  const output = 'R5_LIVEKIT_INIT=FAIL; REASON=DOCKER_UNAVAILABLE';
  assert.equal(redactLivekitOutput(output, ['', '']), output);
  assert.equal(redactLivekitOutput('secret output', ['secret', '']), '[REDACTED] output');
  assert.equal(redactLivekitOutput('host=47.106.121.27', ['47.106.121.27']), 'host=[REDACTED]');
  const source = readFileSync(new URL('./r5-livekit-resident.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /process\.stdout\.write\(`[^`]*HOST=\$\{trust\.host\}/);
  assert.doesNotMatch(source, /process\.stdout\.write\(`[^`]*ENDPOINT=\$\{(?:manifest|current)\.endpoint/);
  assert.doesNotMatch(source, /process\.stdout\.write\(`[^`]*SIGNAL=\$\{(?:manifest|current)\.signalUrl/);
});

test('managed wrapper failure preserves stable reason and attempt-scoped log path', () => {
  assert.equal(
    formatLivekitEnsureFailure('start', {
      status: 1,
      stderr: `R5_LIVEKIT_RESIDENT_REMOTE_FAILED:31:HTTP_ENDPOINT_NOT_READY:${identity.attemptId}/start.log`,
    }),
    `R5_LIVEKIT_RESIDENT_START_FAILED:HTTP_ENDPOINT_NOT_READY:${identity.attemptId}/start.log`,
  );
  assert.equal(
    formatLivekitEnsureFailure('check', {status: 255, stderr: 'secret payload'}),
    'R5_LIVEKIT_RESIDENT_CHECK_FAILED:255:LOG_NOT_AVAILABLE',
  );
});
