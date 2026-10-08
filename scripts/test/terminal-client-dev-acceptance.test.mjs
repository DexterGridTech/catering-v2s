import assert from 'node:assert/strict';
import {existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  buildVitestArguments,
  assertVitestListResult,
  currentProcessIdentity,
  parseTerminalAcceptanceArgs,
  readScenarioEvents,
  resolveTerminalNodeRuntime,
  supportsTerminalAcceptanceNodeVersion,
} from './terminal-client-dev-acceptance.mjs';
import {TERMINAL_ACCEPTANCE_DEV_ACTIONS, executeManagedTerminalDevAction, haproxyServerAdminState, readManagedDorisHistory, readManagedTdsLatestState, remoteTdsManagedProcessStateScript} from '../dev/r5-dev-runner.mjs';
import {
  acquireTerminalClientDevAcceptanceLock,
  assertNoActiveTerminalClientAcceptance,
} from '../dev/terminal-client-dev-acceptance-lock.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const lockRunId = value => `ter-client-dev-${Date.now()}-${value}-11111111-2222-4333-8444-555555555555`;

test('terminal acceptance selects exactly one closed scenario and one Vitest file', () => {
  const scenarioId = 'terminal.client.multi-instance-isolation';
  const selection = parseTerminalAcceptanceArgs(['--scenario', scenarioId]);
  const args = buildVitestArguments({
    cliPath: '/repo/apps/terminal/node_modules/vitest/vitest.mjs',
    scenarioId: selection.scenarioId,
    scenario: selection.scenario,
  });
  assert.deepEqual(args.slice(1, 5), ['run', '--config', 'acceptance.vitest.config.ts', '--testNamePattern']);
  assert.equal(args[5], `^${`${selection.scenario.suiteName} ${selection.scenario.testName}`.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
  assert.equal(args[6], 'acceptance/multiInstanceIsolation.test.ts');
  const scenarioPath = path.join(root, 'apps/terminal/kernel/base/terminal-data-client', args[6]);
  assert.ok(existsSync(scenarioPath));
  const scenarioSource = readFileSync(scenarioPath, 'utf8');
  assert.ok(scenarioSource.includes(`describe('terminal-data-client Node acceptance composition isolation'`));
  const targetTestDeclaration = `it('isolates activation identity, secure-storage namespace, WebSocket session and disposal across two compositions'`;
  assert.equal(scenarioSource.split(targetTestDeclaration).length - 1, 1, 'catalog test name must resolve to one declaration');
  assert.throws(() => parseTerminalAcceptanceArgs(['--scenario', 'all']), /TERMINAL_CLIENT_ACCEPTANCE_SCENARIO_UNKNOWN/);
  assert.throws(() => parseTerminalAcceptanceArgs(['--scenario', scenarioId, '--all']), /TERMINAL_CLIENT_ACCEPTANCE_ARGUMENT_INVALID/);
  const suiteName = 'terminal-data-client managed DEV end-to-end scenarios';
  const expected = [
    ['terminal.dev.lifecycle-and-compression', 'terminal-data-client managed DEV lifecycle activates, receives heartbeats and latency, survives backend cancellation, reactivates and cancels online'],
    ['terminal.dev.entry-address-failover', 'terminal-data-client managed DEV retries a nonresponsive configured entry and prefers the reachable address'],
    ['terminal.dev.two-device-rebind', 'terminal-data-client managed DEV preserves an offline credential until backend cancellation and rebinds across devices'],
    ['terminal.dev.three-node-two-entry-handoff', 'terminal-data-client managed DEV drains node A, fails node B to entry two, and does not fail back after restart'],
  ];
  for (const [id, testName] of expected) {
    const selected = parseTerminalAcceptanceArgs(['--scenario', id]);
    assert.equal(selected.scenario.file, 'acceptance/devScenarios.test.ts');
    assert.equal(selected.scenario.suiteName, suiteName);
    assert.equal(selected.scenario.testName, testName);
    const args = buildVitestArguments({cliPath: '/repo/vitest.mjs', scenarioId: id, scenario: selected.scenario});
    assert.equal(args.at(-1), 'acceptance/devScenarios.test.ts');
    assert.equal(args[5], `^${`${suiteName} ${testName}`.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
    const source = readFileSync(path.join(root, 'apps/terminal/kernel/base/terminal-data-client/acceptance/devScenarios.test.ts'), 'utf8');
    assert.equal(source.split(`describe('${suiteName}'`).length - 1, 1, `${id} must resolve to exactly one suite`);
    assert.equal(source.split(`it('${testName}'`).length - 1, 1, `${id} must resolve to exactly one real test declaration`);
  }
  const devScenarioSource = readFileSync(path.join(root, 'apps/terminal/kernel/base/terminal-data-client/acceptance/devScenarios.test.ts'), 'utf8');
  assert.match(devScenarioSource, /const managedDevRunId = \(\) => required\('V2S_TERMINAL_DEV_MANAGED_DEV_RUN_ID'\)/);
  assert.match(devScenarioSource, /readManagedTdsLatestState\(\{manifestPath: devManifestPath\(\), runId: managedDevRunId\(\), terminalRef\}\)/);
  const managedActionCalls = [...devScenarioSource.matchAll(/executeManagedTerminalDevAction\(\{([\s\S]*?)\}\)/g)];
  assert.equal(managedActionCalls.length, 6);
  assert.ok(managedActionCalls.every((match) => match[1].includes('runId: managedDevRunId()') && !match[1].includes('scenarioRunId()')));
  const cancelBody = devScenarioSource.slice(devScenarioSource.indexOf('const cancelByOperations ='), devScenarioSource.indexOf('const prepareFixture ='));
  assert.match(cancelBody, /operationsFixtureClient\(\)\.cancelByOperations\(session, terminal\)/);
  const operationsFixtureSource = readFileSync(
    path.join(root, 'apps/terminal/kernel/base/terminal-data-client/acceptance/operationsFixture.ts'),
    'utf8',
  );
  assert.match(operationsFixtureSource, /readback\.binding\?\.status !== 'INACTIVE'/);
  assert.throws(() => parseTerminalAcceptanceArgs(['--scenario', 'terminal.dev.not-a-scenario']), /TERMINAL_CLIENT_ACCEPTANCE_SCENARIO_UNKNOWN/);
});

test('locked Vitest list selection requires one exact file and test; zero and duplicate matches are red', () => {
  const expected = {
    filePath: path.join(root, 'apps/terminal/kernel/base/terminal-data-client/acceptance/multiInstanceIsolation.test.ts'),
    suiteName: 'terminal-data-client Node acceptance composition isolation',
    testName: 'isolates activation identity, secure-storage namespace, WebSocket session and disposal across two compositions',
  };
  const exact = [{
    name: `${expected.suiteName} > ${expected.testName}`,
    file: expected.filePath,
  }];
  assert.doesNotThrow(() => assertVitestListResult(exact, expected));
  assert.throws(() => assertVitestListResult([], expected), /TERMINAL_CLIENT_ACCEPTANCE_VITEST_SELECTION_NOT_EXACT/);
  assert.throws(() => assertVitestListResult([...exact, ...exact], expected), /TERMINAL_CLIENT_ACCEPTANCE_VITEST_SELECTION_NOT_EXACT/);
  assert.throws(() => assertVitestListResult([{...exact[0], file: `${expected.filePath}.other`}], expected), /TERMINAL_CLIENT_ACCEPTANCE_VITEST_SELECTION_NOT_EXACT/);
});

test('scenario cleanup evidence fails closed for missing, malformed, cross-run, duplicate and failed outcomes', t => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'terminal-client-scenario-events-'));
  t.after(() => rmSync(directory, {recursive: true, force: true}));
  const file = path.join(directory, 'events.jsonl');
  const runId = 'ter-client-dev-1710000000000-303-11111111-2222-4333-8444-555555555555';
  const scenarioId = 'terminal.dev.lifecycle-and-compression';
  const event = phase => ({at: '2026-10-01T00:00:00.000Z', runId, scenarioId, phase});
  writeFileSync(file, `${JSON.stringify(event('SCENARIO_STARTED'))}\n${JSON.stringify(event('SCENARIO_CLEANUP_PASS'))}\n`);
  assert.deepEqual(readScenarioEvents(file, runId, scenarioId), {cleanup: 'PASS', startedCount: 1, failure: undefined});
  writeFileSync(file, '{broken json\n');
  assert.deepEqual(readScenarioEvents(file, runId, scenarioId), {cleanup: 'FAIL', startedCount: 0, failure: 'TERMINAL_CLIENT_ACCEPTANCE_SCENARIO_EVENTS_UNREADABLE'});
  writeFileSync(file, `${JSON.stringify({...event('SCENARIO_STARTED'), runId: 'other-run'})}\n`);
  assert.deepEqual(readScenarioEvents(file, runId, scenarioId), {cleanup: 'FAIL', startedCount: 0, failure: 'TERMINAL_CLIENT_ACCEPTANCE_SCENARIO_EVENT_BINDING_INVALID'});
  writeFileSync(file, `${JSON.stringify(event('SCENARIO_STARTED'))}\n${JSON.stringify(event('SCENARIO_CLEANUP_FAIL'))}\n`);
  assert.deepEqual(readScenarioEvents(file, runId, scenarioId), {cleanup: 'FAIL', startedCount: 1, failure: 'TERMINAL_CLIENT_ACCEPTANCE_SCENARIO_CLEANUP_FAILED'});
  writeFileSync(file, `${JSON.stringify(event('SCENARIO_STARTED'))}\n${JSON.stringify(event('SCENARIO_CLEANUP_PASS'))}\n${JSON.stringify(event('SCENARIO_CLEANUP_PASS'))}\n`);
  assert.deepEqual(readScenarioEvents(file, runId, scenarioId), {cleanup: 'FAIL', startedCount: 1, failure: 'TERMINAL_CLIENT_ACCEPTANCE_SCENARIO_CLEANUP_PROOF_INVALID'});
  writeFileSync(file, [
    event('SCENARIO_STARTED'),
    event('E6_INITIAL_CONNECTIONS'),
    event('E6_AFTER_A_CONNECTION_WAIT_FAILED'),
    event('E6_AFTER_A_CONNECTION_REACHED'),
    event('SCENARIO_CLEANUP_PASS'),
  ].map(value => JSON.stringify(value)).join('\n'));
  assert.deepEqual(readScenarioEvents(file, runId, scenarioId), {cleanup: 'PASS', startedCount: 1, failure: undefined});
  const target = {
    ...event('DORIS_HISTORY_TARGET'),
    terminalRef: '123e4567-e89b-42d3-a456-426614174000',
    sessionIds: ['session-a', 'session-b'],
    heartbeatSessionId: 'session-a',
  };
  writeFileSync(file, [
    event('SCENARIO_STARTED'),
    target,
    event('SCENARIO_CLEANUP_PASS'),
  ].map(value => JSON.stringify(value)).join('\n'));
  assert.deepEqual(readScenarioEvents(file, runId, scenarioId), {
    cleanup: 'PASS',
    startedCount: 1,
    failure: undefined,
    dorisHistoryTarget: {
      terminalRef: target.terminalRef,
      sessionIds: ['session-a', 'session-b'],
      heartbeatSessionId: 'session-a',
    },
  });
  writeFileSync(file, [event('SCENARIO_STARTED'), {...target, terminalRef: 'invalid'}, event('SCENARIO_CLEANUP_PASS')]
    .map(value => JSON.stringify(value)).join('\n'));
  assert.equal(readScenarioEvents(file, runId, scenarioId).failure, 'TERMINAL_CLIENT_ACCEPTANCE_DORIS_HISTORY_TARGET_INVALID');
  writeFileSync(file, [event('SCENARIO_STARTED'), target, target, event('SCENARIO_CLEANUP_PASS')]
    .map(value => JSON.stringify(value)).join('\n'));
  assert.equal(readScenarioEvents(file, runId, scenarioId).failure, 'TERMINAL_CLIENT_ACCEPTANCE_DORIS_HISTORY_TARGET_DUPLICATE');
  writeFileSync(file, `${JSON.stringify(event('SCENARIO_STARTED'))}\n${JSON.stringify(event('UNRECOGNIZED_DIAGNOSTIC'))}\n${JSON.stringify(event('SCENARIO_CLEANUP_PASS'))}\n`);
  assert.deepEqual(readScenarioEvents(file, runId, scenarioId), {cleanup: 'FAIL', startedCount: 0, failure: 'TERMINAL_CLIENT_ACCEPTANCE_SCENARIO_EVENT_PHASE_INVALID'});
});

test('managed terminal DEV control exposes only reviewed node actions and verifies HAProxy drain state by readback', async () => {
  assert.deepEqual(TERMINAL_ACCEPTANCE_DEV_ACTIONS, ['drain-stop-a', 'drain-force-stop-b', 'restart-a', 'restart-b', 'ensure-ready-a', 'ensure-ready-b']);
  await assert.rejects(executeManagedTerminalDevAction({action: 'kill-all'}), /TERMINAL_ACCEPTANCE_DEV_ACTION_NOT_ALLOWLISTED/);
  assert.throws(() => readManagedTdsLatestState({terminalRef: 'not-a-uuid'}), /TERMINAL_ACCEPTANCE_TERMINAL_REF_INVALID/);
  assert.throws(() => readManagedDorisHistory({terminalRef: 'not-a-uuid', sessionIds: ['session-a']}), /TERMINAL_ACCEPTANCE_DORIS_TERMINAL_REF_INVALID/);
  assert.throws(() => readManagedDorisHistory({terminalRef: '123e4567-e89b-42d3-a456-426614174000', sessionIds: ['bad\tsession']}), /TERMINAL_ACCEPTANCE_DORIS_SESSION_IDS_INVALID/);
  const output = [
    '# be_id be_name srv_id srv_name srv_addr srv_op_state srv_admin_state srv_fqdn srv_port',
    '1 terminal_nodes_ab 1 tds-a 127.0.0.1 2 8 - 18084',
    '1 terminal_nodes_ab 2 tds-b 127.0.0.1 2 0 - 18085',
  ].join('\n');
  assert.equal(haproxyServerAdminState(output, 'terminal_nodes_ab', 'tds-a'), 0x08);
  assert.equal(haproxyServerAdminState(output, 'terminal_nodes_ab', 'tds-b'), 0x00);
  assert.equal(haproxyServerAdminState(output.replace(' 8 ', ' 0x08 '), 'terminal_nodes_ab', 'tds-a'), 0x08);
  assert.throws(() => haproxyServerAdminState(output, 'terminal_nodes_ab', 'tds-c'), /REMOTE_HAPROXY_STATE_INPUT_INVALID/);
  assert.throws(() => haproxyServerAdminState(output.replace('srv_admin_state', 'flags'), 'terminal_nodes_ab', 'tds-a'), /REMOTE_HAPROXY_STATE_HEADER_MISSING/);
  assert.throws(() => haproxyServerAdminState(output.replace(' 8 ', ' drain '), 'terminal_nodes_ab', 'tds-a'), /REMOTE_HAPROXY_ADMIN_STATE_INVALID/);
  const remoteRunId = 'r5-dev-1710000000000-303-11111111-2222-4333-8444-555555555555';
  const remoteRoot = `/tmp/${remoteRunId}`;
  const control = {
    schemaVersion: 1,
    kind: 'r5-dev-remote-tds-control',
    runId: remoteRunId,
    remoteRoot,
    instanceName: 'tds-a',
    nodeId: 'tds-a',
    pid: 123,
    pgid: 123,
    bootId: 'a'.repeat(36),
    processStartTicks: 456,
    commandSha256: 'b'.repeat(64),
    websocketPort: 18084,
    rssBudgetMiB: 512,
    phase: 'READY',
    controlPath: `${remoteRoot}/results/tds-a-control.json`,
    logPath: `${remoteRoot}/results/tds-a.log`,
    phasePath: `${remoteRoot}/results/tds-a-phase.jsonl`,
  };
  const processState = remoteTdsManagedProcessStateScript(control);
  for (const identity of ['expected_pgid=123', 'expected_boot_id=', 'expected_start_ticks=456', 'expected_command_sha256='])
    assert.ok(processState.includes(identity), `managed status readback must bind ${identity}`);
  assert.match(processState, /R5_REMOTE_TDS_STATE=STOPPED/);
  assert.match(processState, /R5_REMOTE_TDS_STATE=RUNNING/);
  assert.doesNotMatch(processState, /kill\s|pkill|pgrep/);
});

test('TER Node acceptance records the actually resolved locked Node, Vitest, and Undici versions', () => {
  const runtime = resolveTerminalNodeRuntime();
  assert.equal(runtime.node.version, process.version);
  assert.equal(runtime.vitest.version, '4.1.10');
  assert.equal(runtime.undici.version, '8.11.2');
  assert.ok(runtime.vitest.cliPath.startsWith(path.join(root, 'apps/terminal/node_modules/vitest')));
  assert.ok(runtime.undici.packageRoot.startsWith('node_modules/undici'));
});

test('the platform process start-token parser reads a live process identity', () => {
  const identity = currentProcessIdentity(process.pid);
  assert.ok(identity?.startToken);
  assert.ok(Number.isInteger(identity.pgid) && identity.pgid > 0);
});

test('TER Node acceptance matches the intersection of the package and Vitest Node engines', () => {
  assert.equal(supportsTerminalAcceptanceNodeVersion('v22.18.0'), false);
  assert.equal(supportsTerminalAcceptanceNodeVersion('v22.19.0'), true);
  assert.equal(supportsTerminalAcceptanceNodeVersion('v23.9.0'), false);
  assert.equal(supportsTerminalAcceptanceNodeVersion('v24.0.0'), true);
});

test('the acceptance lock blocks DEV start and stop while its exact owner is alive', t => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'terminal-client-lock-active-'));
  t.after(() => rmSync(directory, {recursive: true, force: true}));
  const lockPath = path.join(directory, 'acceptance.lock');
  const startToken = 'Thu Oct 1 12:00:00 2026';
  const owner = acquireTerminalClientDevAcceptanceLock(lockPath, {
    runId: lockRunId(101),
    pid: 101,
    startToken,
    kill: () => {},
    startTokenForPid: () => startToken,
  });
  assert.throws(() => assertNoActiveTerminalClientAcceptance({
    lockPath,
    kill: () => {},
    startTokenForPid: () => startToken,
  }), /TERMINAL_CLIENT_ACCEPTANCE_ACTIVE/);
  assert.throws(() => acquireTerminalClientDevAcceptanceLock(lockPath, {
    runId: lockRunId(102),
    pid: 102,
    startToken: 'Thu Oct 1 12:01:00 2026',
    kill: pid => { if (pid !== 101) throw Object.assign(new Error('gone'), {code: 'ESRCH'}); },
    startTokenForPid: () => startToken,
  }), /TERMINAL_CLIENT_ACCEPTANCE_ACTIVE/);
  owner.release();
  assert.equal(existsSync(lockPath), false);
});

test('a stale acceptance lock is reclaimed only after its recorded PID/start token is gone', t => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'terminal-client-lock-stale-'));
  t.after(() => rmSync(directory, {recursive: true, force: true}));
  const lockPath = path.join(directory, 'acceptance.lock');
  const staleRunId = lockRunId(201);
  writeFileSync(lockPath, `${JSON.stringify({
    schemaVersion: 1,
    kind: 'terminal-client-dev-acceptance-lock',
    runId: staleRunId,
    pid: 201,
    startToken: 'Thu Oct 1 12:00:00 2026',
  })}\n`, {mode: 0o600});
  const result = assertNoActiveTerminalClientAcceptance({
    lockPath,
    kill: () => { throw Object.assign(new Error('gone'), {code: 'ESRCH'}); },
    startTokenForPid: () => null,
  });
  assert.equal(result.status, 'STALE_LOCK_RECLAIMED');
  assert.equal(existsSync(lockPath), false);
});

test('an unreadable live PID identity keeps the acceptance lock closed', t => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'terminal-client-lock-identity-'));
  t.after(() => rmSync(directory, {recursive: true, force: true}));
  const lockPath = path.join(directory, 'acceptance.lock');
  writeFileSync(lockPath, `${JSON.stringify({
    schemaVersion: 1,
    kind: 'terminal-client-dev-acceptance-lock',
    runId: lockRunId(301),
    pid: 301,
    startToken: 'Thu Oct 1 12:00:00 2026',
  })}\n`, {mode: 0o600});
  assert.throws(() => assertNoActiveTerminalClientAcceptance({
    lockPath,
    kill: () => {},
    startTokenForPid: () => null,
  }), /TERMINAL_CLIENT_ACCEPTANCE_LOCK_IDENTITY_UNAVAILABLE/);
  assert.equal(existsSync(lockPath), true);
});

test('DEV start and stop both check the TER acceptance lock before process mutation', () => {
  const source = readFileSync(path.join(root, 'scripts/dev/r5-dev-runner.mjs'), 'utf8');
  const startBody = source.slice(source.indexOf('async function start()'), source.indexOf('async function stop()'));
  const stopBody = source.slice(source.indexOf('async function stop()'), source.indexOf('const mode = process.argv[2]'));
  assert.match(startBody, /assertNoActiveTerminalClientAcceptance/);
  assert.match(stopBody, /assertNoActiveTerminalClientAcceptance[\s\S]*?for \(const value of \[\.\.\.manifest\.processes\]\.reverse\(\)\)/);
});
