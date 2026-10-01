import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import test from 'node:test';
import {
  buildManagedDevCleanupReceipt,
  buildTdsWebSocketProbeUrl,
  canCleanupRemoteJavaRoot,
  cleanupManagedRemoteJavaRoot,
  cleanupManagedRemoteRootAfterStartFailure,
  collectStopDiagnostics,
  haproxyImageDigestLookupScript,
  parseRemoteRootCleanupResult,
  remoteRootCleanupScript,
  remoteProcessStopMarkerCommand,
  remoteTdsReadinessScript,
  stopAndCleanupStartedRemoteJava,
  validateManagedRemoteJavaBinding,
} from './r5-dev-runner.mjs';
import {createHaproxyConfiguration, remoteHaproxyIdentityMatches, validateManagedTdsCluster, validateRemoteHaproxyControl} from './r5-managed-terminal-topology.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const start = path.join(root, 'scripts/dev/start');
const runnerSource = readFileSync(path.join(root, 'scripts/dev/r5-dev-runner.mjs'), 'utf8');

test('managed HAProxy image resolution uses the remote Docker daemon and pins RepoDigest', () => {
  const digest = `sha256:${'a'.repeat(64)}`;
  const imageScript = haproxyImageDigestLookupScript();
  assert.doesNotMatch(imageScript, /auth\.docker\.io|registry-1\.docker\.io/);
  assert.match(imageScript, /docker pull "\$image_ref"/);
  assert.match(imageScript, /docker image inspect/);
  const startBody = runnerSource.slice(runnerSource.indexOf('async function start()'));
  const imageResolveIndex = startBody.indexOf('await resolveRemoteHaproxyDigest(');
  assert.ok(imageResolveIndex >= 0 && imageResolveIndex < startBody.indexOf('await startRemoteJava('));
  assert.ok(imageResolveIndex < startBody.indexOf('await startRemoteTds('));
  const runImageScript = repoDigest => childProcess.spawnSync(
    'bash',
    ['-c', `docker() {\n  if [ "$1" = pull ]; then test "$2" = docker.io/library/haproxy:3.4.6; return; fi\n  if [ "$1" = image ] && [ "$2" = inspect ]; then printf '%s\\n' "$TEST_REPO_DIGEST"; return; fi\n  return 90\n}\n${imageScript}`],
    {cwd: root, encoding: 'utf8', env: {...process.env, TEST_REPO_DIGEST: repoDigest}},
  );
  for (const repository of ['docker.io/library/haproxy', 'library/haproxy', 'haproxy']) {
    const resolved = runImageScript(`${repository}@${digest}`);
    assert.equal(resolved.status, 0, resolved.stderr);
    assert.equal(resolved.stdout, `REMOTE_HAPROXY_PULL=PASS\n${digest}\n`);
  }
  const wrongRepository = runImageScript(`quay.io/library/haproxy@${digest}`);
  assert.equal(wrongRepository.status, 65);
  assert.match(wrongRepository.stderr, /REMOTE_HAPROXY_PULL=PASS REMOTE_HAPROXY_REPODIGESTS=quay\.io\/library\/haproxy@sha256:/);
});

test('managed TDS topology has exact three-node identity and two protected ingress backends', () => {
  const runId = 'r5-dev-1789419999999-70098-1d53aa6c-cd00-444d-8f9a-125f6ee68081';
  const remoteRoot = `/tmp/${runId}`;
  const hostBootId = '0123456789abcdef0123456789abcdef';
  const nodes = ['a', 'b', 'c'].map((name, index) => ({
    instanceName: `tds-${name}`,
    nodeId: `tds-${name}`,
    runId,
    remoteRoot,
    bootId: hostBootId,
    pid: 101 + index,
    processStartTicks: 201 + index,
    websocketPort: 18084 + index,
    rssBudgetMiB: 512,
    logPath: `${remoteRoot}/results/tds-${name}.log`,
  }));
  assert.equal(validateManagedTdsCluster({runId, remoteRoot, nodes, entryPorts: {one: 18083, two: 18087}, hostBootId}).nodes.length, 3);
  assert.throws(
    () => validateManagedTdsCluster({
      runId,
      remoteRoot,
      nodes: nodes.map(({instanceName, ...node}) => ({...node, name: instanceName})),
      entryPorts: {one: 18083, two: 18087},
      hostBootId,
    }),
    /R5_TDS_CLUSTER_NODE_NAME_INVALID/,
  );
  assert.throws(() => validateManagedTdsCluster({runId, remoteRoot, nodes: nodes.slice(0, 2), entryPorts: {one: 18083, two: 18087}, hostBootId}), /R5_TDS_CLUSTER_NODE_COUNT_INVALID/);
  assert.throws(() => validateManagedTdsCluster({runId, remoteRoot, nodes: nodes.map((node, index) => index === 2 ? {...node, nodeId: 'tds-a'} : node), entryPorts: {one: 18083, two: 18087}, hostBootId}), /R5_TDS_CLUSTER_NODE_ID_INVALID/);
  assert.throws(() => validateManagedTdsCluster({runId, remoteRoot, nodes, entryPorts: {one: 18084, two: 18087}, hostBootId}), /R5_TDS_CLUSTER_ENTRY_PORTS_INVALID/);
  assert.throws(() => validateManagedTdsCluster({runId, remoteRoot, nodes, entryPorts: {one: 18083, two: 18087}, hostBootId: 'fedcba9876543210fedcba9876543210'}), /R5_TDS_CLUSTER_NODE_IDENTITY_INVALID/);

  const config = createHaproxyConfiguration({entryOnePort: 18083, entryTwoPort: 18087, nodePorts: {a: 18084, b: 18085, c: 18086}});
  assert.match(config, /stats socket \/run\/haproxy-control\/admin\.sock mode 600 level admin/);
  assert.match(config, /frontend terminal_entry_one[\s\S]*default_backend terminal_nodes_ab/);
  assert.match(config, /frontend terminal_entry_two[\s\S]*default_backend terminal_node_c/);
  assert.match(config, /backend terminal_nodes_ab[\s\S]*balance roundrobin[\s\S]*server tds-a 127\.0\.0\.1:18084 check[\s\S]*server tds-b 127\.0\.0\.1:18085 check/);
  assert.match(config, /backend terminal_node_c[\s\S]*server tds-c 127\.0\.0\.1:18086 check/);
  assert.equal((config.match(/http-request deny deny_status 403 if actuator_root or actuator_tree/g) ?? []).length, 2);
  assert.equal((config.match(/timeout tunnel 180s/g) ?? []).length, 1);
  assert.equal((config.match(/^  timeout check 1s$/gm) ?? []).length, 1);
  assert.equal((config.match(/^  default-server inter 1s fall 1 rise 1 check$/gm) ?? []).length, 2);
  assert.doesNotMatch(config, /^  default-server .*\btimeout\b/m);
  assert.throws(() => createHaproxyConfiguration({entryOnePort: 18083, entryTwoPort: 18084, nodePorts: {a: 18084, b: 18085, c: 18086}}), /R5_TDS_TOPOLOGY_PORT_COLLISION/);

  const haproxyControl = {
    schemaVersion: 1,
    kind: 'r5-dev-remote-haproxy-control',
    runId,
    remoteRoot,
    hostBootId,
    containerId: 'abcdef123456',
    containerImageId: `sha256:${'a'.repeat(64)}`,
    imageRef: `library/haproxy@sha256:${'b'.repeat(64)}`,
    imageDigest: 'b'.repeat(64),
    configSha256: 'c'.repeat(64),
    memoryBudgetMiB: 128,
    entryPorts: {one: 18083, two: 18087},
    nodePorts: {a: 18084, b: 18085, c: 18086},
    configPath: `${remoteRoot}/results/haproxy.cfg`,
    logPath: `${remoteRoot}/results/haproxy.log`,
    controlPath: `${remoteRoot}/results/haproxy-control.json`,
    controlSocketPath: `${remoteRoot}/results/haproxy-control/admin.sock`,
    phase: 'READY',
  };
  assert.equal(validateRemoteHaproxyControl(haproxyControl), haproxyControl);
  assert.equal(remoteHaproxyIdentityMatches(haproxyControl, {...haproxyControl}), true);
  assert.equal(remoteHaproxyIdentityMatches(haproxyControl, {...haproxyControl, configSha256: 'd'.repeat(64)}), false);
  assert.throws(() => validateRemoteHaproxyControl({...haproxyControl, entryPorts: {one: 18083, two: 18084}}), /R5_REMOTE_HAPROXY_CONTROL_PORTS_INVALID/);
});

test('remote stop protocol marker preserves every field in shell output', () => {
  const cases = [
    ['JAVA', null, 'R5_REMOTE_PROCESS_STOP=PASS SERVICE=JAVA'],
    ['TDS', null, 'R5_REMOTE_PROCESS_STOP=PASS SERVICE=TDS'],
    ['JAVA', 'ALREADY_STOPPED', 'R5_REMOTE_PROCESS_STOP=PASS SERVICE=JAVA STATUS=ALREADY_STOPPED'],
    ['TDS', 'ALREADY_STOPPED', 'R5_REMOTE_PROCESS_STOP=PASS SERVICE=TDS STATUS=ALREADY_STOPPED'],
  ];
  for (const [service, status, expected] of cases) {
    const result = childProcess.spawnSync('bash', ['-c', remoteProcessStopMarkerCommand(service, status)], {
      cwd: root,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0);
    assert.equal(result.stdout, `${expected}\n`);
  }
  assert.throws(() => remoteProcessStopMarkerCommand('UNKNOWN'), /REMOTE_PROCESS_STOP_SERVICE_INVALID/);
});

test('DEV start rejects every argument before it can launch managed resources', () => {
  const result = childProcess.spawnSync(start, ['--help'], {
    cwd: root,
    encoding: 'utf8',
    env: {...process.env},
  });

  assert.equal(result.status, 2);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /^R5_DEV_START=REFUSED; REASON=ARGUMENT_INVALID\n$/);
});

test('DEV start propagates authoritative existing MinIO credentials to Java', () => {
  assert.match(runnerSource, /credential\.values\.CATERING_ASSET_S3_ACCESS_KEY = objectStorage\.access/);
  assert.match(runnerSource, /credential\.values\.CATERING_ASSET_S3_SECRET_KEY = objectStorage\.secretKey/);
});

test('DEV start gives Java the selected local asset ingress for browser public URLs', () => {
  assert.match(runnerSource, /const tunnel = await openTunnel\(env, tunnelPorts\);[\s\S]*startRemoteJava/);
  assert.match(runnerSource, /assetPublicBaseUrl: `http:\/\/127\.0\.0\.1:\$\{tunnelPorts\.asset\}`/);
  assert.match(runnerSource, /CATERING_ASSET_PUBLIC_BASE_URL: assetPublicBaseUrl/);
  assert.doesNotMatch(
    runnerSource,
    /CATERING_ASSET_PUBLIC_BASE_URL: `http:\/\/127\.0\.0\.1:\$\{env\.environment\.V2S_DEV_REMOTE_ASSET_PORT\}`/,
  );
});

test('remote Java source sync excludes non-runtime repository payloads', () => {
  const syncStart = runnerSource.indexOf('export async function syncRemoteSource');
  const syncEnd = runnerSource.indexOf('const remoteEnvLine', syncStart);
  assert.ok(syncStart >= 0 && syncEnd > syncStart);
  const syncSource = runnerSource.slice(syncStart, syncEnd);
  assert.match(syncSource, /'--exclude=\*\/node_modules'/);
  assert.match(syncSource, /'--exclude=\*\/\.gradle'/);
  assert.match(syncSource, /'--exclude=doc\/evidence'/);
  assert.match(syncSource, /'--exclude=apps\/terminal'/);
  assert.doesNotMatch(syncSource, /'--exclude=apps\/frontend'/);
  assert.match(syncSource, /'--no-xattrs'/);
  assert.match(syncSource, /'--no-fflags'/);
  assert.match(syncSource, /'--no-acls'/);
  assert.match(syncSource, /'--no-mac-metadata'/);
  assert.match(syncSource, /COPYFILE_DISABLE: '1'/);
});

test('DEV stop retains remote-log evidence for already-stopped Java', () => {
  let missingAttempts = 0;
  const missing = collectStopDiagnostics({
    remoteJavaStopStatus: 'ALREADY_STOPPED',
    collectLog: () => {
      missingAttempts += 1;
      throw new Error('REMOTE_LOG_MISSING');
    },
    refreshDiagnostics: () => {},
  });
  assert.equal(missingAttempts, 1);
  assert.equal(missing.status, 'LOG_NOT_AVAILABLE');
  assert.equal(missing.failures.length, 1);

  let existingAttempts = 0;
  const existing = collectStopDiagnostics({
    remoteJavaStopStatus: 'ALREADY_STOPPED',
    collectLog: () => {
      existingAttempts += 1;
    },
    refreshDiagnostics: () => {},
  });
  assert.equal(existingAttempts, 1);
  assert.equal(existing.status, 'PASS');
  assert.equal(existing.failures.length, 0);
});

test('DEV stop refuses remote-root deletion without a bound control and successful stop', () => {
  let cleanupCalls = 0;
  assert.equal(canCleanupRemoteJavaRoot({controlValid: false, remoteJavaStopStatus: 'STOPPED'}), false);
  assert.equal(canCleanupRemoteJavaRoot({controlValid: true, remoteJavaStopStatus: 'NOT_RUN'}), false);
  assert.equal(
    cleanupManagedRemoteJavaRoot({
      controlValid: false,
      remoteJavaStopStatus: 'STOPPED',
      cleanupRoot: () => {
        cleanupCalls += 1;
      },
    }),
    false,
  );
  assert.equal(cleanupCalls, 0);

  const runId = 'r5-dev-1789364564599-72246-1d53aa6c-cd00-444d-8f9a-125f6ee68081';
  const remoteRoot = `/tmp/${runId}`;
  const control = {
    schemaVersion: 1,
    kind: 'r5-dev-remote-java-control',
    runId,
    remoteRoot,
    pid: 101,
    pgid: 101,
    bootId: '0123456789abcdef0123456789abcdef',
    processStartTicks: 2026,
    commandSha256: 'a'.repeat(64),
    phase: 'STOPPED',
    logPath: `${remoteRoot}/results/business-server.log`,
    phasePath: `${remoteRoot}/results/phase.jsonl`,
  };
  assert.doesNotThrow(() =>
    validateManagedRemoteJavaBinding({runId, remoteJava: control, remoteDiagnostic: {remoteRoot}}),
  );
  assert.throws(
    () =>
      validateManagedRemoteJavaBinding({
        runId,
        remoteJava: control,
        remoteDiagnostic: {remoteRoot: '/tmp/r5-dev-1789364564599-72246-1d53aa6c-cd00-444d-8f9a-125f6ee68080'},
      }),
    /R5_DEV_REMOTE_ROOT_BINDING_MISMATCH/,
  );
});

test('DEV start failure refuses remote-root deletion when managed Java stop fails', async () => {
  const runId = 'r5-dev-1789419999999-70098-1d53aa6c-cd00-444d-8f9a-125f6ee68081';
  const remoteRoot = `/tmp/${runId}`;
  const remoteJava = {
    schemaVersion: 1,
    kind: 'r5-dev-remote-java-control',
    runId,
    remoteRoot,
    pid: 101,
    pgid: 101,
    bootId: '0123456789abcdef0123456789abcdef',
    processStartTicks: 2026,
    commandSha256: 'a'.repeat(64),
    phase: 'READY',
    logPath: `${remoteRoot}/results/business-server.log`,
    phasePath: `${remoteRoot}/results/phase.jsonl`,
  };
  let cleanupCalls = 0;
  const result = await stopAndCleanupStartedRemoteJava({
    host: 'catering-remote-dev',
    runId,
    remoteRoot,
    remoteJava,
    stop: async () => {
      throw new Error('REMOTE_STOP_FAILED');
    },
    cleanup: () => {
      cleanupCalls += 1;
    },
  });
  assert.equal(result.controlValid, true);
  assert.equal(result.stopStatus, 'NOT_RUN');
  assert.equal(result.cleanupStatus, 'FAIL');
  assert.equal(cleanupCalls, 0);
  assert.match(result.failures[0].message, /REMOTE_STOP_FAILED/);
});

test('DEV terminal cleanup receipt keeps local, remote Java, TDS, and remote-root statuses separate', () => {
  assert.deepEqual(
    buildManagedDevCleanupReceipt({
      cleanupStatus: 'FAIL',
      localProcessStatus: 'FAIL',
      remoteJavaControlStatus: 'PASS',
      remoteJavaStopStatus: 'STOPPED',
      remoteJavaRootCleanupStatus: 'PASS',
      failedProcessCount: 1,
    }),
    {
      status: 'FAIL',
      failedProcessCount: 1,
      localProcess: 'FAIL',
      remoteJavaControl: 'PASS',
      remoteJava: 'PASS',
      remoteJavaStop: 'STOPPED',
      remoteTdsControl: 'NOT_APPLICABLE',
      remoteTds: 'NOT_APPLICABLE',
      remoteTdsStop: 'NOT_APPLICABLE',
      remoteHaproxyControl: 'NOT_APPLICABLE',
      remoteHaproxy: 'NOT_APPLICABLE',
      remoteHaproxyStop: 'NOT_APPLICABLE',
      remoteJavaRoot: 'PASS',
    },
  );
  assert.deepEqual(
    buildManagedDevCleanupReceipt({
      cleanupStatus: 'FAIL',
      localProcessStatus: 'PASS',
      remoteJavaControlStatus: 'PASS',
      remoteJavaStopStatus: 'STOPPED',
      remoteJavaRootCleanupStatus: 'FAIL',
    }).remoteJava,
    'PASS',
  );
  assert.equal(
    buildManagedDevCleanupReceipt({
      cleanupStatus: 'PASS',
      localProcessStatus: 'PASS',
      remoteJavaControlStatus: 'NOT_APPLICABLE',
      remoteJavaStopStatus: 'NOT_APPLICABLE',
      remoteJavaRootCleanupStatus: 'PASS',
    }).remoteJava,
    'NOT_APPLICABLE',
  );
  const tdsReceipt = buildManagedDevCleanupReceipt({
    cleanupStatus: 'PASS',
    localProcessStatus: 'PASS',
    remoteJavaControlStatus: 'PASS',
    remoteJavaStopStatus: 'STOPPED',
    remoteTdsControlStatus: 'PASS',
    remoteTdsStopStatus: 'ALREADY_STOPPED',
    remoteJavaRootCleanupStatus: 'PASS',
  });
  assert.equal(tdsReceipt.remoteTds, 'PASS');
  assert.equal(
    buildManagedDevCleanupReceipt({
      cleanupStatus: 'FAIL',
      localProcessStatus: 'PASS',
      remoteJavaControlStatus: 'PASS',
      remoteJavaStopStatus: 'STOPPED',
      remoteTdsControlStatus: 'PASS',
      remoteTdsStopStatus: 'NOT_RUN',
      remoteJavaRootCleanupStatus: 'FAIL',
    }).remoteTds,
    'FAIL',
  );
});

test('remote TDS launch, readiness, logs and stop are independently manifest-bound', () => {
  assert.match(runnerSource, /REMOTE_TDS_CONTROL_KIND/);
  assert.match(runnerSource, /validateManagedRemoteTdsBinding/);
  assert.match(runnerSource, /startRemoteTds\(/);
  assert.match(runnerSource, /waitForRemoteTdsReady\(/);
  assert.match(runnerSource, /collectRemoteTdsLog\(/);
  assert.match(runnerSource, /stopRemoteTds\(/);
  assert.match(runnerSource, /controlPath/);
  assert.match(runnerSource, /databaseListenerReady/);
  assert.match(runnerSource, /rss_budget_kib=\$\{control\.rssBudgetMiB \* 1024\}/);
  assert.match(runnerSource, /rssWithinBudget/);
  assert.match(runnerSource, /REMOTE_TDS_RSS_BUDGET_EXCEEDED_AT_READINESS/);

  const startBody = runnerSource.slice(runnerSource.indexOf('async function start()'));
  const tdsLaunchStart = startBody.indexOf('for (const spec of tdsNodeSpecs)');
  const clusterValidation = startBody.indexOf('const validatedCluster', tdsLaunchStart);
  const tdsLaunchAndReadiness = startBody.slice(tdsLaunchStart, clusterValidation);
  assert.match(
    tdsLaunchAndReadiness,
    /for \(const spec of tdsNodeSpecs\) \{[\s\S]*?await startRemoteTds\([\s\S]*?await waitForRemoteTdsReady\([\s\S]*?\n    \}/,
    'each TDS build must reach readiness before another bootRun shares the Gradle output tree',
  );
  assert.doesNotMatch(tdsLaunchAndReadiness, /for \(const remoteTds of remoteTdsNodes\)/);
});

test('remote TDS readiness probe reads the owned process RSS and generates valid shell', () => {
  const runId = 'r5-dev-1789999999999-70123-1d53aa6c-cd00-444d-8f9a-125f6ee68081';
  const remoteRoot = `/tmp/${runId}`;
  const command = remoteTdsReadinessScript({
    schemaVersion: 1,
    kind: 'r5-dev-remote-tds-control',
    runId,
    remoteRoot,
    instanceName: 'tds-a',
    nodeId: 'tds-a',
    pid: 101,
    pgid: 101,
    bootId: '0123456789abcdef0123456789abcdef',
    processStartTicks: 2026,
    commandSha256: 'a'.repeat(64),
    websocketPort: 18083,
    rssBudgetMiB: 512,
    phase: 'READY',
    controlPath: `${remoteRoot}/results/tds-a-control.json`,
    logPath: `${remoteRoot}/results/tds-a.log`,
    phasePath: `${remoteRoot}/results/tds-a-phase.jsonl`,
  });
  const syntax = childProcess.spawnSync('bash', ['-n'], {input: command, encoding: 'utf8'});
  assert.equal(syntax.status, 0, syntax.stderr || syntax.stdout);
  assert.match(command, /\/proc\/\$pid\/status/);
  assert.match(command, /rss_budget_kib=524288/);
  assert.match(command, /rssWithinBudget/);
  assert.match(command, /TDS_REMOTE_RSS_NOT_AVAILABLE/);
});

test('DEV WebSocket readiness probe uses the TDS registered route and a route-safe probe key', () => {
  const tdsConfiguration = readFileSync(
    path.join(
      root,
      'apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/websocket/TdsWebSocketConfiguration.java',
    ),
    'utf8',
  );
  assert.equal(buildTdsWebSocketProbeUrl(28180), 'ws://127.0.0.1:28180/tdp/dev-readiness-probe/ws');
  assert.match(tdsConfiguration, /Map\.of\(protocol\.webSocketRoutePattern\(\), handler\)/);
  assert.match(runnerSource, /probeLocalTdsWebSocket\(buildTdsWebSocketProbeUrl\(tunnelPorts\.tds\)\)/);
  assert.match(runnerSource, /probeLocalTdsWebSocket\(buildTdsWebSocketProbeUrl\(tunnelPorts\.tdsSecondary\)\)/);
  assert.match(runnerSource, /TDS_WEBSOCKET_TUNNEL_PROBE=FAIL; EVENT=/);
  assert.throws(() => buildTdsWebSocketProbeUrl('28180/invalid'), /TDS_WEBSOCKET_PROBE_PORT_INVALID/);
});

test('DEV tunnel proves both entry listeners belong to the owned SSH tunnel and maps no direct node or database port', () => {
  const openTunnelSource = runnerSource.match(/async function openTunnel\(env, ports\) \{[\s\S]*?\n\}\nasync function /)?.[0];
  assert.ok(openTunnelSource, 'openTunnel implementation must remain directly inspectable');
  assert.match(openTunnelSource, /\$\{ports\.tds\}:127\.0\.0\.1:\$\{env\.environment\.V2S_DEV_REMOTE_TDS_ENTRY_ONE_PORT\}/);
  assert.match(openTunnelSource, /\$\{ports\.tdsSecondary\}:127\.0\.0\.1:\$\{env\.environment\.V2S_DEV_REMOTE_TDS_ENTRY_TWO_PORT\}/);
  const forwardedPorts = [...openTunnelSource.matchAll(/`\$\{ports\.([A-Za-z]+)\}:127\.0\.0\.1:\$\{env\.environment\.([A-Z0-9_]+)\}`/g)]
    .map(([, local, remote]) => [local, remote]);
  assert.equal((openTunnelSource.match(/'-L'/g) ?? []).length, 4, 'the tunnel must expose only the four approved local forwards');
  assert.deepEqual(forwardedPorts, [
    ['http', 'V2S_DEV_REMOTE_HTTP_PORT'],
    ['asset', 'V2S_DEV_REMOTE_ASSET_PORT'],
    ['tds', 'V2S_DEV_REMOTE_TDS_ENTRY_ONE_PORT'],
    ['tdsSecondary', 'V2S_DEV_REMOTE_TDS_ENTRY_TWO_PORT'],
  ]);
  assert.match(openTunnelSource, /const tdsListeners = listenerPids\(ports\.tds\);[\s\S]*const tdsSecondaryListeners = listenerPids\(ports\.tdsSecondary\);/);
  assert.match(openTunnelSource, /tdsListeners\[0\] === value\.pid &&[\s\S]*tdsSecondaryListeners\[0\] === value\.pid/);
  assert.doesNotMatch(openTunnelSource, /V2S_DEV_REMOTE_TDS_[ABC]_PORT|V2S_DEV_REMOTE_(?:POSTGRES|DATABASE|PG)_PORT|V2S_DEV_REMOTE_TDS_MANAGEMENT_PORT/);
});

test('DEV requires capacity-derived TDS keys before start and validates the dedicated remote port', () => {
  const environmentSource = readFileSync(path.join(root, 'scripts/dev/r5-dev-environment.mjs'), 'utf8');
  const capacitySource = readFileSync(path.join(root, 'scripts/env/tds-capacity-configuration.mjs'), 'utf8');
  assert.match(environmentSource, /loadTdsCapacityConfiguration/);
  assert.match(environmentSource, /R5_DEV_\$\{key\}_REQUIRED_OR_INVALID/);
  assert.match(capacitySource, /scripts\/env\/tds-dev-capacity\.json/);
  assert.match(capacitySource, /TDS_CAPACITY_CONFIG_MISSING/);
  assert.match(environmentSource, /V2S_TDS_NODE_ID: env\.V2S_TDS_NODE_ID \?\? "tds"/);
  assert.match(environmentSource, /V2S_TDS_READINESS_WITHDRAWAL_WAIT_MS: env\.V2S_TDS_READINESS_WITHDRAWAL_WAIT_MS \?\? "3000"/);
  assert.match(environmentSource, /R5_DEV_TDS_NODE_ID_INVALID/);
  assert.match(environmentSource, /R5_DEV_TDS_READINESS_WITHDRAWAL_WAIT_INVALID/);
  assert.match(runnerSource, /V2S_DEV_REMOTE_TDS_ENTRY_ONE_PORT/);
  assert.match(runnerSource, /V2S_DEV_REMOTE_TDS_A_PORT/);
  assert.match(runnerSource, /V2S_TDS_MAX_UNAUTHENTICATED_CONNECTIONS/);
  assert.match(runnerSource, /V2S_TDS_MAX_TRACKED_SESSIONS/);
  assert.match(runnerSource, /V2S_TDS_NODE_ID: nodeId/);
  assert.match(runnerSource, /V2S_TDS_READINESS_WITHDRAWAL_WAIT_MS: String\(readinessWithdrawalWaitMs\)/);
  assert.match(runnerSource, /REMOTE_TDS_NODE_ID_INVALID/);
  assert.match(runnerSource, /REMOTE_TDS_READINESS_WITHDRAWAL_WAIT_INVALID/);
  assert.match(runnerSource, /rssBudgetMiB/);
});

test('DEV start failure tracks and cleans a possible exact root before Java control exists', () => {
  let cleanupCalls = 0;
  assert.equal(
    cleanupManagedRemoteRootAfterStartFailure({
      rootMayExist: false,
      cleanupRoot: () => {
        cleanupCalls += 1;
      },
    }),
    false,
  );
  assert.equal(cleanupCalls, 0);
  assert.equal(
    cleanupManagedRemoteRootAfterStartFailure({
      rootMayExist: true,
      cleanupRoot: () => {
        cleanupCalls += 1;
      },
    }),
    true,
  );
  assert.equal(cleanupCalls, 1);
  assert.match(runnerSource, /let remoteRootMayExist = false/);
  assert.match(runnerSource, /remoteRootMayExist = true/);
  assert.match(runnerSource, /cleanupRemoteRootWithoutJavaControl/);
  assert.match(runnerSource, /ps -eo pid=,args=/);
  assert.match(runnerSource, /R5_REMOTE_ROOT_ABSENT=true/);
  const cleanupCommand = remoteRootCleanupScript(
    '/tmp/r5-dev-1789419999999-70098-1d53aa6c-cd00-444d-8f9a-125f6ee68081',
    '01234567-89ab-cdef-0123-456789abcdef',
  );
  const cleanupSyntax = childProcess.spawnSync('bash', ['-n'], {input: cleanupCommand, encoding: 'utf8'});
  assert.equal(cleanupSyntax.status, 0, cleanupSyntax.stderr);
  assert.match(cleanupCommand, /container_ids_csv=""[\s\S]*if test -n "\$container_ids"/);
  assert.deepEqual(
    parseRemoteRootCleanupResult('/tmp/r5-dev-1789419999999-70098-1d53aa6c-cd00-444d-8f9a-125f6ee68081', {
      status: 45,
      stdout:
        'R5_REMOTE_ROOT_PRESENT=true\nREMOTE_ACTIVE_PROCESS_COUNT=1\nREMOTE_ACTIVE_PROCESS_PIDS=101\nREMOTE_ACTIVE_CONTAINER_COUNT=0\nREMOTE_ACTIVE_CONTAINER_IDS=\nREMOTE_UNKNOWN_PROCESS_COUNT=0\nREMOTE_UNKNOWN_PROCESS_PIDS=\n',
      stderr: 'REMOTE_PROCESSES_REMAIN',
    }),
    {
      status: 'FAIL',
      remoteRoot: '/tmp/r5-dev-1789419999999-70098-1d53aa6c-cd00-444d-8f9a-125f6ee68081',
      remoteRootPresent: 'true',
      remoteRootAbsent: false,
      activeProcessCount: '1',
      activeProcessPids: '101',
      activeContainerCount: '0',
      activeContainerIds: '',
      unknownProcessCount: '0',
      unknownProcessPids: '',
      failure: 'REMOTE_PROCESSES_REMAIN',
    },
  );
  assert.deepEqual(
    parseRemoteRootCleanupResult('/tmp/r5-dev-1789419999999-70098-1d53aa6c-cd00-444d-8f9a-125f6ee68081', {
      status: 46,
      stdout:
        'R5_REMOTE_ROOT_PRESENT=true\nREMOTE_ACTIVE_PROCESS_COUNT=0\nREMOTE_ACTIVE_PROCESS_PIDS=\nREMOTE_UNKNOWN_PROCESS_COUNT=1\nREMOTE_UNKNOWN_PROCESS_PIDS=202\n',
      stderr: '',
    }).failure,
    'REMOTE_PROCESS_INSPECTION_UNAVAILABLE',
  );
  assert.deepEqual(
    parseRemoteRootCleanupResult('/tmp/r5-dev-1789419999999-70098-1d53aa6c-cd00-444d-8f9a-125f6ee68081', {
      status: 48,
      stdout: 'R5_REMOTE_ROOT_PRESENT=true\nREMOTE_ACTIVE_PROCESS_COUNT=0\nREMOTE_ACTIVE_PROCESS_PIDS=\nREMOTE_ACTIVE_CONTAINER_COUNT=1\nREMOTE_ACTIVE_CONTAINER_IDS=abc123\nREMOTE_UNKNOWN_PROCESS_COUNT=0\nREMOTE_UNKNOWN_PROCESS_PIDS=\n',
      stderr: 'REMOTE_CONTAINERS_REMAIN',
    }),
    {
      status: 'FAIL',
      remoteRoot: '/tmp/r5-dev-1789419999999-70098-1d53aa6c-cd00-444d-8f9a-125f6ee68081',
      remoteRootPresent: 'true',
      remoteRootAbsent: false,
      activeProcessCount: '0',
      activeProcessPids: '',
      activeContainerCount: '1',
      activeContainerIds: 'abc123',
      unknownProcessCount: '0',
      unknownProcessPids: '',
      failure: 'REMOTE_CONTAINERS_REMAIN',
    },
  );
  assert.deepEqual(
    parseRemoteRootCleanupResult('/tmp/r5-dev-1789419999999-70098-1d53aa6c-cd00-444d-8f9a-125f6ee68081', {
      status: 0,
      stdout:
        'R5_REMOTE_ROOT_PRESENT=true\nREMOTE_ACTIVE_PROCESS_COUNT=0\nREMOTE_ACTIVE_PROCESS_PIDS=\nREMOTE_ACTIVE_CONTAINER_COUNT=0\nREMOTE_ACTIVE_CONTAINER_IDS=\nREMOTE_UNKNOWN_PROCESS_COUNT=0\nREMOTE_UNKNOWN_PROCESS_PIDS=\nR5_REMOTE_ROOT_ABSENT=true\n',
      stderr: '',
    }).status,
    'PASS',
  );
  assert.equal(
    parseRemoteRootCleanupResult('/tmp/r5-dev-1789419999999-70098-1d53aa6c-cd00-444d-8f9a-125f6ee68081', {
      status: 0,
      stdout: 'R5_REMOTE_ROOT_ABSENT=true\nREMOTE_ACTIVE_CONTAINER_COUNT=0\n',
      stderr: '',
    }).status,
    'FAIL',
  );
});

test('DEV start terminal evidence uses explicit phase boundaries', () => {
  assert.match(runnerSource, /let lastKnownGood = 'REMOTE_RESOURCE_PREFLIGHT'/);
  assert.match(runnerSource, /lastKnownGood = 'REMOTE_SOURCE_SYNC'/);
  assert.match(runnerSource, /lastKnownGood = 'TUNNEL_READY'/);
  assert.match(runnerSource, /lastKnownGood = 'REMOTE_JAVA_CONTROL_READY'/);
  assert.match(runnerSource, /firstFailure:\s*safeFailure\(error\),\s*lastKnownGood,\s*brokenBoundary/);
  assert.match(runnerSource, /cleanupEvidence: \{remoteRoot: remoteRootCleanupEvidence\}/);
});

test('remote Java binds the selected HTTP port instead of assuming one shared listener', () => {
  assert.match(runnerSource, /httpPort = env\.environment\.V2S_DEV_REMOTE_HTTP_PORT/);
  assert.match(runnerSource, /SERVER_PORT: String\(httpPort\)/);
  assert.match(runnerSource, /httpPort.*\$http_port/);
});

test('DEV start forwards only an explicit backend verification mode to remote Java', () => {
  assert.match(
    runnerSource,
    /const backendAcceptanceVerificationMode = env\.environment\.V2S_BACKEND_ACCEPTANCE_VERIFICATION_MODE/,
  );
  assert.match(runnerSource, /V2S_BACKEND_ACCEPTANCE_VERIFICATION_MODE: backendAcceptanceVerificationMode/);
  assert.match(runnerSource, /!\['ACCEPTANCE', 'CALIBRATION'\]\.includes\(backendAcceptanceVerificationMode\)/);
});
