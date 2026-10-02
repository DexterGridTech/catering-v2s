#!/usr/bin/env node

import {spawn, spawnSync} from 'node:child_process';
import {createHash, randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {canonicalStartToken, readProcessTable, snapshotProcessTree} from '../dev/managed-process-tree.mjs';
import {
  readManagedDorisHistory,
  validateManagedRemoteHaproxyBinding,
  validateManagedRemoteJavaBinding,
  validateManagedRemoteTdsNodeBinding,
} from '../dev/r5-dev-runner.mjs';
import {acquireTerminalClientDevAcceptanceLock} from '../dev/terminal-client-dev-acceptance-lock.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const runtimeRoot = path.join(root, '.runtime');
const devManifestPath = path.join(root, '.runtime/r5/run-manifest.json');
const lockPath = path.join(runtimeRoot, 'terminal-client-dev-acceptance.lock');
const packageRoot = path.join(root, 'apps/terminal/kernel/base/terminal-data-client');
const scenarioCatalog = Object.freeze({
  'terminal.client.multi-instance-isolation': Object.freeze({
    file: 'acceptance/multiInstanceIsolation.test.ts',
    suiteName: 'terminal-data-client Node acceptance composition isolation',
    testName: 'isolates activation identity, secure-storage namespace, WebSocket session and disposal across two compositions',
  }),
  'terminal.dev.lifecycle-and-compression': Object.freeze({
    file: 'acceptance/devScenarios.test.ts',
    suiteName: 'terminal-data-client managed DEV end-to-end scenarios',
    testName: 'terminal-data-client managed DEV lifecycle activates, receives heartbeats and latency, survives backend cancellation, reactivates and cancels online',
  }),
  'terminal.dev.entry-address-failover': Object.freeze({
    file: 'acceptance/devScenarios.test.ts',
    suiteName: 'terminal-data-client managed DEV end-to-end scenarios',
    testName: 'terminal-data-client managed DEV retries a nonresponsive configured entry and prefers the reachable address',
  }),
  'terminal.dev.two-device-rebind': Object.freeze({
    file: 'acceptance/devScenarios.test.ts',
    suiteName: 'terminal-data-client managed DEV end-to-end scenarios',
    testName: 'terminal-data-client managed DEV preserves an offline credential until backend cancellation and rebinds across devices',
  }),
  'terminal.dev.three-node-two-entry-handoff': Object.freeze({
    file: 'acceptance/devScenarios.test.ts',
    suiteName: 'terminal-data-client managed DEV end-to-end scenarios',
    testName: 'terminal-data-client managed DEV drains node A, fails node B to entry two, and does not fail back after restart',
  }),
});

const fail = code => { throw new Error(code); };
const sha256 = value => createHash('sha256').update(value).digest('hex');
const escapeTestName = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const within = (base, candidate) => {
  const relative = path.relative(base, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
};
const safeFailure = error => String(error?.code || error?.message || 'TERMINAL_CLIENT_ACCEPTANCE_FAILED')
  .replaceAll(/[^A-Za-z0-9_:. -]/g, '').slice(0, 220);

export function parseTerminalAcceptanceArgs(argv) {
  if (argv.length === 1 && argv[0] === '--self-test') return Object.freeze({selfTest: true});
  if (argv.length !== 2 || argv[0] !== '--scenario') fail('TERMINAL_CLIENT_ACCEPTANCE_ARGUMENT_INVALID');
  const scenarioId = argv[1];
  const scenario = scenarioCatalog[scenarioId];
  if (!scenario) fail('TERMINAL_CLIENT_ACCEPTANCE_SCENARIO_UNKNOWN');
  return Object.freeze({selfTest: false, scenarioId, scenario});
}

export function buildVitestArguments({cliPath, scenarioId, scenario, configPath = 'acceptance.vitest.config.ts'} = {}) {
  if (typeof cliPath !== 'string' || !path.isAbsolute(cliPath) || !scenarioCatalog[scenarioId] ||
      scenarioCatalog[scenarioId].file !== scenario?.file || scenarioCatalog[scenarioId].suiteName !== scenario?.suiteName ||
      scenarioCatalog[scenarioId].testName !== scenario?.testName)
    fail('TERMINAL_CLIENT_ACCEPTANCE_VITEST_INPUT_INVALID');
  const escapedName = escapeTestName(`${scenario.suiteName} ${scenario.testName}`);
  return Object.freeze([
    cliPath,
    'run',
    '--config', configPath,
    '--testNamePattern', `^${escapedName}$`,
    scenario.file,
  ]);
}

export function assertVitestListResult(entries, {filePath, suiteName, testName} = {}) {
  const expectedName = `${suiteName} > ${testName}`;
  if (!Array.isArray(entries) || entries.length !== 1 || entries[0]?.name !== expectedName ||
      typeof entries[0]?.file !== 'string' || path.resolve(entries[0].file) !== path.resolve(filePath))
    fail('TERMINAL_CLIENT_ACCEPTANCE_VITEST_SELECTION_NOT_EXACT');
}

function packageRootFor(resolvedEntry, expectedName, repositoryRoot) {
  let directory = path.dirname(realpathSync(resolvedEntry));
  while (true) {
    const manifest = path.join(directory, 'package.json');
    if (existsSync(manifest)) {
      const actual = JSON.parse(readFileSync(manifest, 'utf8'));
      if (actual.name === expectedName) {
        const realPackageRoot = realpathSync(directory);
        if (!within(repositoryRoot, realPackageRoot)) fail('TERMINAL_CLIENT_ACCEPTANCE_PACKAGE_ESCAPES_REPOSITORY');
        return {root: realPackageRoot, manifest: actual, manifestPath: realpathSync(manifest)};
      }
    }
    const parent = path.dirname(directory);
    if (parent === directory) fail(`TERMINAL_CLIENT_ACCEPTANCE_PACKAGE_NOT_FOUND:${expectedName}`);
    directory = parent;
  }
}

export function resolveTerminalNodeRuntime({repositoryRoot = root, terminalPackageRoot = packageRoot} = {}) {
  const repo = realpathSync(repositoryRoot);
  const terRoot = realpathSync(terminalPackageRoot);
  if (!within(repo, terRoot)) fail('TERMINAL_CLIENT_ACCEPTANCE_TER_PACKAGE_ESCAPES_REPOSITORY');
  const terManifestPath = path.join(terRoot, 'package.json');
  const terManifest = JSON.parse(readFileSync(terManifestPath, 'utf8'));
  const requireFromTer = createRequire(terManifestPath);
  const vitest = packageRootFor(requireFromTer.resolve('vitest'), 'vitest', repo);
  const undici = packageRootFor(requireFromTer.resolve('undici'), 'undici', repo);
  const vitestDeclaration = terManifest.devDependencies?.vitest;
  const undiciDeclaration = terManifest.devDependencies?.undici;
  if (vitestDeclaration !== vitest.manifest.version || vitest.manifest.version !== '4.1.10') fail('TERMINAL_CLIENT_ACCEPTANCE_VITEST_VERSION_MISMATCH');
  if (undiciDeclaration !== undici.manifest.version || undici.manifest.version !== '8.11.2') fail('TERMINAL_CLIENT_ACCEPTANCE_UNDICI_VERSION_MISMATCH');
  const cliRelative = typeof vitest.manifest.bin === 'string' ? vitest.manifest.bin : vitest.manifest.bin?.vitest;
  if (typeof cliRelative !== 'string' || path.isAbsolute(cliRelative)) fail('TERMINAL_CLIENT_ACCEPTANCE_VITEST_BIN_INVALID');
  const cliPath = realpathSync(path.resolve(vitest.root, cliRelative));
  if (!within(vitest.root, cliPath)) fail('TERMINAL_CLIENT_ACCEPTANCE_VITEST_BIN_ESCAPES_PACKAGE');
  const nodeVersion = process.versions.node;
  if (!supportsTerminalAcceptanceNodeVersion(nodeVersion)) fail('TERMINAL_CLIENT_ACCEPTANCE_NODE_VERSION_UNSUPPORTED');
  return Object.freeze({
    node: Object.freeze({version: process.version, executable: realpathSync(process.execPath)}),
    terminalPackage: Object.freeze({root: path.relative(repo, terRoot), manifestSha256: sha256(readFileSync(terManifestPath))}),
    vitest: Object.freeze({version: vitest.manifest.version, packageRoot: path.relative(repo, vitest.root), packageManifestSha256: sha256(readFileSync(vitest.manifestPath)), cliPath}),
    undici: Object.freeze({version: undici.manifest.version, packageRoot: path.relative(repo, undici.root), packageManifestSha256: sha256(readFileSync(undici.manifestPath))}),
  });
}

export function supportsTerminalAcceptanceNodeVersion(value) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(value));
  if (!match) return false;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  return (major === 22 && minor >= 19) || major >= 24;
}

export function currentProcessIdentity(pid) {
  const result = spawnSync('ps', ['-o', 'lstart=', '-o', 'pgid=', '-p', String(pid)], {encoding: 'utf8'});
  if (result.status !== 0) return null;
  const match = /^(.*\S)\s+(\d+)$/.exec(result.stdout.trim());
  if (!match) return null;
  return {startToken: canonicalStartToken(match[1]), pgid: Number(match[2])};
}

export function validateManagedDevManifest(manifest, {manifestPath = devManifestPath, processIdentityForPid = currentProcessIdentity} = {}) {
  if (!manifest || manifest.kind !== 'r5-dev-run-manifest' ||
      typeof manifest.runId !== 'string' || !/^r5-dev-[0-9]+-[0-9]+-[0-9a-f-]{36}$/.test(manifest.runId) ||
      !Array.isArray(manifest.processes) || manifest.processes.length < 3 ||
      !Array.isArray(manifest.remoteTdsNodes) || manifest.remoteTdsNodes.length !== 3 || !manifest.remoteHaproxy) {
    fail('TERMINAL_CLIENT_ACCEPTANCE_DEV_MANIFEST_INVALID');
  }
  const absoluteManifest = realpathSync(manifestPath);
  if (!within(path.join(root, '.runtime/r5'), absoluteManifest) || path.basename(absoluteManifest) !== 'run-manifest.json') {
    fail('TERMINAL_CLIENT_ACCEPTANCE_DEV_MANIFEST_PATH_INVALID');
  }
  for (const process of manifest.processes) {
    if (!Number.isInteger(process.pid) || !Number.isInteger(process.pgid) || typeof process.startToken !== 'string')
      fail('TERMINAL_CLIENT_ACCEPTANCE_LOCAL_PROCESS_IDENTITY_INVALID');
    let alive = false;
    try { globalThis.process.kill(process.pid, 0); alive = true; } catch { alive = false; }
    const actual = processIdentityForPid(process.pid);
    if (!alive || !actual || actual.pgid !== process.pgid ||
        actual.startToken !== canonicalStartToken(process.startToken)) {
      fail('TERMINAL_CLIENT_ACCEPTANCE_LOCAL_PROCESS_IDENTITY_MISMATCH');
    }
  }
  validateManagedRemoteJavaBinding(manifest);
  for (const node of manifest.remoteTdsNodes) validateManagedRemoteTdsNodeBinding(manifest, node);
  validateManagedRemoteHaproxyBinding(manifest);
  return Object.freeze({manifest, manifestPath: absoluteManifest});
}

function writeJsonAtomically(filePath, value) {
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  const descriptor = openSync(temporaryPath, 'wx', 0o600);
  try {
    writeSync(descriptor, `${JSON.stringify(value, null, 2)}\n`);
  } finally {
    closeSync(descriptor);
  }
  renameSync(temporaryPath, filePath);
}

function redactOutputLine(line) {
  if (/(password|authorization|credential|secret|token|activation.?code|cookie|otp|bearer|raw.?payload)/i.test(line)) {
    return 'REDACTED_SENSITIVE_TEST_OUTPUT';
  }
  return line.length > 1600 ? `${line.slice(0, 1600)} [TRUNCATED]` : line;
}

function resourcePreflight() {
  const script = path.join(root, 'scripts/env/check-runtime-resource-budget');
  const result = spawnSync(script, ['--profile', 'ter-validation-with-dev', path.join(root, '.runtime')], {
    cwd: root,
    encoding: 'utf8',
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) fail('TERMINAL_CLIENT_ACCEPTANCE_RESOURCE_PREFLIGHT_FAILED');
}

function readOperationsPassword() {
  const credentialsPath = path.join(root, '.runtime/r5/credentials.env');
  const actualPath = realpathSync(credentialsPath);
  if (!within(path.join(root, '.runtime/r5'), actualPath) || path.basename(actualPath) !== 'credentials.env')
    fail('TERMINAL_CLIENT_ACCEPTANCE_CREDENTIAL_PATH_INVALID');
  if ((statSync(actualPath).mode & 0o777) !== 0o600) fail('TERMINAL_CLIENT_ACCEPTANCE_CREDENTIAL_MODE_INVALID');
  const line = readFileSync(actualPath, 'utf8').split(/\r?\n/).find(value => value.startsWith('V2S_SEED_OPERATIONS_DEFAULT_PASSWORD='));
  const password = line?.slice('V2S_SEED_OPERATIONS_DEFAULT_PASSWORD='.length);
  if (!password || /[\u0000\r\n]/.test(password)) fail('TERMINAL_CLIENT_ACCEPTANCE_OPERATIONS_PASSWORD_MISSING');
  return password;
}

function processIsAlive(pid) {
  try { globalThis.process.kill(pid, 0); return true; } catch { return false; }
}

function makeRunId() {
  return `ter-client-dev-${Date.now()}-${process.pid}-${randomUUID()}`;
}

function vitestListEntries(resolved, scenario, testNamePattern) {
  const temporaryDirectory = mkdtempSync(path.join(tmpdir(), 'v2s-terminal-vitest-list-'));
  const reportPath = path.join(temporaryDirectory, 'selection.json');
  try {
    const result = spawnSync(resolved.node.executable, [
      resolved.vitest.cliPath,
      'list',
      '--config', 'acceptance.vitest.config.ts',
      '--testNamePattern', testNamePattern,
      `--json=${reportPath}`,
      scenario.file,
    ], {cwd: packageRoot, encoding: 'utf8', timeout: 20_000});
    if (result.error || result.status !== 0 || !existsSync(reportPath))
      fail('TERMINAL_CLIENT_ACCEPTANCE_VITEST_LIST_FAILED');
    try {
      return JSON.parse(readFileSync(reportPath, 'utf8'));
    } catch {
      fail('TERMINAL_CLIENT_ACCEPTANCE_VITEST_LIST_OUTPUT_INVALID');
    }
  } finally {
    rmSync(temporaryDirectory, {recursive: true, force: true});
  }
}

function selfTest() {
  const scenarioId = 'terminal.client.multi-instance-isolation';
  const selected = parseTerminalAcceptanceArgs(['--scenario', scenarioId]);
  if (selected.scenario.file !== 'acceptance/multiInstanceIsolation.test.ts') fail('TERMINAL_CLIENT_ACCEPTANCE_SELF_TEST_SCENARIO');
  const args = buildVitestArguments({cliPath: '/repo/vitest.mjs', scenarioId, scenario: selected.scenario});
  if (args.at(-1) !== selected.scenario.file ||
      args[args.indexOf('--testNamePattern') + 1] !== `^${escapeTestName(`${selected.scenario.suiteName} ${selected.scenario.testName}`)}$`)
    fail('TERMINAL_CLIENT_ACCEPTANCE_SELF_TEST_EXACT_SELECTION');
  if (redactOutputLine('credentialSecret=unsafe') !== 'REDACTED_SENSITIVE_TEST_OUTPUT') fail('TERMINAL_CLIENT_ACCEPTANCE_SELF_TEST_REDACTION');
  const resolved = resolveTerminalNodeRuntime();
  for (const [id, mapping] of Object.entries(scenarioCatalog)) {
    if (mapping.file.startsWith('acceptance/')) {
      const sourcePath = path.join(packageRoot, mapping.file);
      if (!existsSync(sourcePath)) fail(`TERMINAL_CLIENT_ACCEPTANCE_SCENARIO_FILE_MISSING:${id}`);
      const source = readFileSync(sourcePath, 'utf8');
      if (source.split(`describe('${mapping.suiteName}'`).length - 1 !== 1 ||
          source.split(`it('${mapping.testName}'`).length - 1 !== 1 ||
          buildVitestArguments({cliPath: '/repo/vitest.mjs', scenarioId: id, scenario: mapping})[5] !== `^${escapeTestName(`${mapping.suiteName} ${mapping.testName}`)}$`)
        fail(`TERMINAL_CLIENT_ACCEPTANCE_SCENARIO_MAPPING_INVALID:${id}`);
      const pattern = buildVitestArguments({cliPath: resolved.vitest.cliPath, scenarioId: id, scenario: mapping})[5];
      const entries = vitestListEntries(resolved, mapping, pattern);
      assertVitestListResult(entries, {
        filePath: path.join(packageRoot, mapping.file),
        suiteName: mapping.suiteName,
        testName: mapping.testName,
      });
    }
  }
  const impossiblePattern = '^terminal-client-self-test-no-such-scenario$';
  const noMatchEntries = vitestListEntries(resolved, scenarioCatalog[scenarioId], impossiblePattern);
  let zeroMatchRejected = false;
  try {
    assertVitestListResult(noMatchEntries, {
      filePath: path.join(packageRoot, scenarioCatalog[scenarioId].file),
      suiteName: scenarioCatalog[scenarioId].suiteName,
      testName: scenarioCatalog[scenarioId].testName,
    });
  } catch (error) {
    if (error.message !== 'TERMINAL_CLIENT_ACCEPTANCE_VITEST_SELECTION_NOT_EXACT') throw error;
    zeroMatchRejected = true;
  }
  if (!zeroMatchRejected) fail('TERMINAL_CLIENT_ACCEPTANCE_VITEST_ZERO_MATCH_RED_NOT_RED');
  for (const invalid of [[], ['--scenario', 'all'], ['--scenario', scenarioId, '--all'], ['--scenario', 'terminal.dev.not-a-scenario']]) {
    try { parseTerminalAcceptanceArgs(invalid); fail('TERMINAL_CLIENT_ACCEPTANCE_SELF_TEST_NOT_RED'); }
    catch (error) { if (!error.message.startsWith('TERMINAL_CLIENT_ACCEPTANCE_')) throw error; }
  }
  process.stdout.write(`TERMINAL_CLIENT_DEV_ACCEPTANCE_SELF_TEST=PASS\nVITEST_SELECTION=PASS; CATALOG=${Object.keys(scenarioCatalog).length}; ZERO_MATCH_RED=PASS\nNODE=${resolved.node.version}\nVITEST=${resolved.vitest.version}\nUNDICI=${resolved.undici.version}\n`);
}

async function runSelectedScenario(scenarioId) {
  const scenario = scenarioCatalog[scenarioId];
  if (!scenario) fail('TERMINAL_CLIENT_ACCEPTANCE_SCENARIO_UNKNOWN');
  const runId = makeRunId();
  const runDirectory = path.join(runtimeRoot, 'terminal-client-dev-acceptance', runId);
  mkdirSync(runDirectory, {recursive: true, mode: 0o700});
  const manifestFile = path.join(runDirectory, 'manifest.json');
  const logFile = path.join(runDirectory, 'vitest.log');
  const eventsFile = path.join(runDirectory, 'events.jsonl');
  const state = {
    schemaVersion: 1,
    kind: 'terminal-client-dev-acceptance-run-manifest',
    runId,
    devRunId: null,
    devManifestPath: path.relative(root, devManifestPath),
    devManifestSha256: null,
    scenarioId,
    scenarioFile: path.relative(root, path.join(packageRoot, scenario.file)),
    startedAt: new Date().toISOString(),
    nodeRuntime: null,
    business: 'NOT_RUN',
    cleanup: 'PASS',
    process: null,
    processes: [],
    logPath: path.relative(root, logFile),
    eventsPath: path.relative(root, eventsFile),
    firstFailure: null,
  };
  const logDescriptor = openSync(logFile, 'wx', 0o600);
  const eventDescriptor = openSync(eventsFile, 'wx', 0o600);
  const appendEvent = event => writeSync(eventDescriptor, `${JSON.stringify({at: new Date().toISOString(), runId, scenarioId, ...event})}\n`);
  let child;
  let closePromise;
  let lock;
  let outputBuffers = {stdout: '', stderr: ''};
  let outputLines = 0;
  let exitStatus = null;
  let exitSignal = null;
  let heartbeatTimer = null;
  try {
    lock = acquireTerminalClientDevAcceptanceLock(lockPath, {runId});
    writeJsonAtomically(manifestFile, state);
    const devManifestBytes = readFileSync(devManifestPath);
    const parentSha256 = sha256(devManifestBytes);
    const manifestData = JSON.parse(devManifestBytes.toString('utf8'));
    const resolvedManifest = validateManagedDevManifest(manifestData);
    const nodeRuntime = resolveTerminalNodeRuntime();
    const testFile = path.join(packageRoot, scenario.file);
    const configFile = path.join(packageRoot, 'acceptance.vitest.config.ts');
    if (!existsSync(testFile) || !existsSync(configFile)) fail('TERMINAL_CLIENT_ACCEPTANCE_SCENARIO_SOURCE_MISSING');
    if (!within(realpathSync(packageRoot), realpathSync(testFile)) || !within(realpathSync(packageRoot), realpathSync(configFile)))
      fail('TERMINAL_CLIENT_ACCEPTANCE_SCENARIO_SOURCE_ESCAPES_PACKAGE');
    state.devRunId = manifestData.runId;
    state.devManifestPath = path.relative(root, resolvedManifest.manifestPath);
    state.devManifestSha256 = parentSha256;
    state.nodeRuntime = nodeRuntime;
    state.phase = 'PREFLIGHT';
    writeJsonAtomically(manifestFile, state);
    resourcePreflight();
    const parentIdentity = currentProcessIdentity(process.pid);
    if (!parentIdentity) fail('TERMINAL_CLIENT_ACCEPTANCE_RUNNER_IDENTITY_UNAVAILABLE');
    state.processes = [{pid: process.pid, startToken: parentIdentity.startToken}];
    appendEvent({phase: 'MANIFEST_VALIDATED', devRunId: manifestData.runId});
    appendEvent({phase: 'NODE_RUNTIME_RESOLVED', node: nodeRuntime.node.version, vitest: nodeRuntime.vitest.version, undici: nodeRuntime.undici.version});
    const args = buildVitestArguments({cliPath: nodeRuntime.vitest.cliPath, scenarioId, scenario});
    const childEnvironment = {
      PATH: process.env.PATH ?? '',
      ...(process.env.HOME ? {HOME: process.env.HOME} : {}),
      ...(process.env.TMPDIR ? {TMPDIR: process.env.TMPDIR} : {}),
      CI: 'true',
      NO_COLOR: '1',
      V2S_TERMINAL_DEV_MANIFEST: resolvedManifest.manifestPath,
      V2S_TERMINAL_DEV_ACCEPTANCE_RUN_ID: runId,
      V2S_TERMINAL_DEV_MANAGED_DEV_RUN_ID: manifestData.runId,
      V2S_TERMINAL_DEV_ACCEPTANCE_SCENARIO: scenarioId,
      V2S_TERMINAL_DEV_HTTP_BASE_URL: manifestData.localHttpBaseUrl,
      V2S_TERMINAL_DEV_TDS_ENTRY_ONE_WS_URL: manifestData.localTdsWebSocketBaseUrl,
      V2S_TERMINAL_DEV_TDS_ENTRY_TWO_WS_URL: manifestData.localTdsEntryTwoWebSocketBaseUrl,
      V2S_TERMINAL_DEV_ACCEPTANCE_SCENARIO_EVENTS: path.join(runDirectory, 'scenario-events.jsonl'),
      V2S_SEED_OPERATIONS_DEFAULT_PASSWORD: readOperationsPassword(),
    };
    closeSync(openSync(childEnvironment.V2S_TERMINAL_DEV_ACCEPTANCE_SCENARIO_EVENTS, 'wx', 0o600));
    state.scenarioEventsPath = path.relative(root, childEnvironment.V2S_TERMINAL_DEV_ACCEPTANCE_SCENARIO_EVENTS);
    child = spawn(process.execPath, args, {
      cwd: packageRoot,
      detached: true,
      env: childEnvironment,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (!Number.isInteger(child.pid)) fail('TERMINAL_CLIENT_ACCEPTANCE_VITEST_SPAWN_FAILED');
    closePromise = new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', (code, signal) => resolve({code, signal}));
    });
    const identityDeadline = Date.now() + 5000;
    let childOsIdentity = null;
    while (Date.now() < identityDeadline && !childOsIdentity) {
      childOsIdentity = currentProcessIdentity(child.pid);
      if (!childOsIdentity) await new Promise(resolve => setTimeout(resolve, 50));
    }
    if (!childOsIdentity) fail('TERMINAL_CLIENT_ACCEPTANCE_VITEST_IDENTITY_UNAVAILABLE');
    const processTree = snapshotProcessTree({pid: child.pid, pgid: childOsIdentity.pgid, startToken: childOsIdentity.startToken});
    if (!processTree.some(value => value.pid === child.pid && !value.ownershipUnverified)) fail('TERMINAL_CLIENT_ACCEPTANCE_VITEST_TREE_UNVERIFIED');
    state.process = {
      pid: child.pid,
      pgid: childOsIdentity.pgid,
      startToken: childOsIdentity.startToken,
      commandSha256: processTree.find(value => value.pid === child.pid)?.commandSha256,
      treeAtStart: processTree,
    };
    state.processes.push({pid: child.pid, startToken: childOsIdentity.startToken});
    state.phase = 'VITEST_RUNNING';
    writeJsonAtomically(manifestFile, state);
    appendEvent({phase: 'VITEST_STARTED', pid: child.pid, pgid: childOsIdentity.pgid});
    heartbeatTimer = setInterval(() => {
      state.lastHeartbeatAt = new Date().toISOString();
      try {
        writeJsonAtomically(manifestFile, state);
        appendEvent({phase: 'VITEST_HEARTBEAT', pid: child.pid});
      } catch (error) {
        state.firstFailure ??= safeFailure(error);
      }
    }, 30_000);
    heartbeatTimer.unref();

    const consume = (kind, chunk) => {
      outputBuffers[kind] += chunk.toString('utf8');
      const lines = outputBuffers[kind].split(/\r?\n/);
      outputBuffers[kind] = lines.pop() ?? '';
      for (const line of lines) {
        const safeLine = redactOutputLine(line);
        writeSync(logDescriptor, `${kind.toUpperCase()} ${safeLine}\n`);
        outputLines += 1;
        if (outputLines % 20 === 0) {
          appendEvent({phase: 'VITEST_OUTPUT', lines: outputLines});
          state.lastHeartbeatAt = new Date().toISOString();
          writeJsonAtomically(manifestFile, state);
        }
      }
    };
    child.stdout.on('data', chunk => consume('stdout', chunk));
    child.stderr.on('data', chunk => consume('stderr', chunk));
    const result = await closePromise;
    exitStatus = result.code;
    exitSignal = result.signal;
    for (const [kind, finalLine] of Object.entries(outputBuffers)) {
      if (!finalLine) continue;
      const safeLine = redactOutputLine(finalLine);
      writeSync(logDescriptor, `${kind.toUpperCase()} ${safeLine}\n`);
      outputLines += 1;
    }
    state.business = exitStatus === 0 ? 'PASS' : 'FAIL';
    state.phase = 'VITEST_EXITED';
    state.exitStatus = exitStatus;
    state.exitSignal = exitSignal;
    state.finishedAt = new Date().toISOString();
    appendEvent({phase: 'VITEST_EXITED', exitStatus, exitSignal, outputLines});
    const scenarioEvents = readScenarioEvents(childEnvironment.V2S_TERMINAL_DEV_ACCEPTANCE_SCENARIO_EVENTS, runId, scenarioId);
    state.fixtureCleanup = scenarioEvents.cleanup;
    if (scenarioEvents.failure) state.firstFailure ??= scenarioEvents.failure;
    if (scenarioEvents.startedCount !== 1) {
      state.business = 'FAIL';
      state.firstFailure ??= 'TERMINAL_CLIENT_ACCEPTANCE_SCENARIO_NOT_EXECUTED_EXACTLY_ONCE';
    }
    if (scenarioEvents.cleanup === 'FAIL') {
      state.cleanup = 'FAIL';
      state.firstFailure ??= 'TERMINAL_CLIENT_ACCEPTANCE_SCENARIO_CLEANUP_FAILED';
    }
    if (scenarioId === 'terminal.dev.lifecycle-and-compression' && !scenarioEvents.dorisHistoryTarget) {
      state.business = 'FAIL';
      state.firstFailure ??= 'TERMINAL_CLIENT_ACCEPTANCE_DORIS_HISTORY_TARGET_MISSING';
    }
    if (scenarioEvents.dorisHistoryTarget && state.business === 'PASS') {
      const target = scenarioEvents.dorisHistoryTarget;
      const readbackStarted = Date.now();
      let rows = [];
      let readbackComplete = false;
      while (Date.now() - readbackStarted < 20_000) {
        rows = readManagedDorisHistory({
          manifestPath: resolvedManifest.manifestPath,
          runId: manifestData.runId,
          terminalRef: target.terminalRef,
          sessionIds: target.sessionIds,
        });
        const connected = rows.filter(row => row.eventType === 'CONNECTED');
        const heartbeats = rows.filter(row => row.eventType === 'HEARTBEAT_RTT' && row.sessionId === target.heartbeatSessionId);
        const disconnected = rows.filter(row => row.eventType === 'DISCONNECTED');
        readbackComplete = connected.length >= target.sessionIds.length && heartbeats.length >= 3 &&
          disconnected.length >= target.sessionIds.length && disconnected.every(row => row.closeReason === 'ACTIVATION_CANCELLED') &&
          heartbeats.every(row => row.rttMs !== 'NULL' && row.rttMs !== '\\N');
        if (readbackComplete) break;
        await new Promise(resolve => setTimeout(resolve, 250));
      }
      state.dorisHistoryReadback = {
        status: readbackComplete ? 'PASS' : 'FAIL',
        sessionCount: target.sessionIds.length,
        connectedRows: rows.filter(row => row.eventType === 'CONNECTED').length,
        heartbeatRows: rows.filter(row => row.eventType === 'HEARTBEAT_RTT').length,
        disconnectedRows: rows.filter(row => row.eventType === 'DISCONNECTED').length,
        elapsedMillis: Date.now() - readbackStarted,
      };
      if (!readbackComplete) {
        state.business = 'FAIL';
        state.firstFailure ??= 'TERMINAL_CLIENT_ACCEPTANCE_DORIS_HISTORY_READBACK_INCOMPLETE';
      }
    }
    const remaining = readProcessTable().filter(value => value.pgid === state.process.pgid);
    if (remaining.length === 0 && !processIsAlive(state.process.pid) && state.cleanup !== 'FAIL') state.cleanup = 'PASS';
    else {
      state.cleanup = 'FAIL';
      state.cleanupProcesses = remaining.map(({pid, startToken, commandSha256}) => ({pid, startToken, commandSha256}));
      state.firstFailure ??= 'TERMINAL_CLIENT_ACCEPTANCE_PROCESS_TREE_REMAINS';
    }
  } catch (error) {
    if (state.process) state.business = 'FAIL';
    state.firstFailure ??= safeFailure(error);
    state.phase = 'FAILED';
    if (child?.pid && state.process && processIsAlive(child.pid)) {
      const identity = currentProcessIdentity(child.pid);
      if (identity && identity.pgid === state.process.pgid && identity.startToken === state.process.startToken) {
        try { process.kill(-identity.pgid, 'SIGTERM'); } catch {}
        try {
          const result = await closePromise;
          exitStatus = result.code;
          exitSignal = result.signal;
        } catch {}
      }
    }
    let ownedRemaining = [];
    try {
      const groupId = state.process?.pgid ?? child?.pid;
      ownedRemaining = groupId ? readProcessTable().filter(value => value.pgid === groupId) : [];
    } catch {
      state.cleanup = 'FAIL';
    }
    if (state.cleanup !== 'FAIL') state.cleanup = ownedRemaining.length === 0 ? 'PASS' : 'FAIL';
    if (ownedRemaining.length > 0) {
      state.cleanupProcesses = ownedRemaining.map(({pid, startToken, commandSha256}) => ({pid, startToken, commandSha256}));
    }
  } finally {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    if (lock) {
      try { lock.release(); } catch (error) { state.cleanup = 'FAIL'; state.firstFailure ??= safeFailure(error); }
    }
    state.finishedAt ??= new Date().toISOString();
    state.outputLines = outputLines;
    if (!state.process) state.exitStatus = exitStatus;
    try { appendEvent({phase: 'RUN_FINALIZED', business: state.business, cleanup: state.cleanup, exitStatus, exitSignal}); } catch {}
    writeJsonAtomically(manifestFile, state);
    closeSync(logDescriptor);
    closeSync(eventDescriptor);
  }
  process.stdout.write(`TERMINAL_CLIENT_DEV_ACCEPTANCE=${state.business}; FIXTURE_CLEANUP=${state.fixtureCleanup ?? 'NOT_STARTED'}; CLEANUP=${state.cleanup}; RUN_ID=${runId}; SCENARIO=${scenarioId}; MANIFEST=${path.relative(root, manifestFile)}; NODE=${state.nodeRuntime?.node.version ?? process.version}; VITEST=${state.nodeRuntime?.vitest.version ?? 'NOT_RESOLVED'}; UNDICI=${state.nodeRuntime?.undici.version ?? 'NOT_RESOLVED'}\n`);
  if (state.business !== 'PASS' || state.cleanup !== 'PASS') process.exitCode = 1;
}

export function readScenarioEvents(filePath, runId, scenarioId) {
  let events;
  try {
    events = readFileSync(filePath, 'utf8').split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
  } catch {
    return Object.freeze({cleanup: 'FAIL', startedCount: 0, failure: 'TERMINAL_CLIENT_ACCEPTANCE_SCENARIO_EVENTS_UNREADABLE'});
  }
  if (events.some(event => event.runId !== runId || event.scenarioId !== scenarioId))
    return Object.freeze({cleanup: 'FAIL', startedCount: 0, failure: 'TERMINAL_CLIENT_ACCEPTANCE_SCENARIO_EVENT_BINDING_INVALID'});
  const acceptedPhases = new Set([
    'SCENARIO_STARTED',
    'SCENARIO_CLEANUP_PASS',
    'SCENARIO_CLEANUP_FAIL',
    'DORIS_HISTORY_TARGET',
    'E6_INITIAL_CONNECTIONS',
    'E6_AFTER_A_CONNECTION_WAIT_FAILED',
    'E6_AFTER_A_CONNECTION_REACHED',
  ]);
  if (events.some(event => !acceptedPhases.has(event.phase)))
    return Object.freeze({cleanup: 'FAIL', startedCount: 0, failure: 'TERMINAL_CLIENT_ACCEPTANCE_SCENARIO_EVENT_PHASE_INVALID'});
  const started = events.filter(event => event.phase === 'SCENARIO_STARTED');
  const outcomes = events.filter(event => event.phase === 'SCENARIO_CLEANUP_PASS' || event.phase === 'SCENARIO_CLEANUP_FAIL');
  if (started.length === 0) return Object.freeze({cleanup: 'NOT_STARTED', startedCount: 0, failure: undefined});
  if (started.length !== 1 || outcomes.length !== 1)
    return Object.freeze({cleanup: 'FAIL', startedCount: started.length, failure: 'TERMINAL_CLIENT_ACCEPTANCE_SCENARIO_CLEANUP_PROOF_INVALID'});
  if (outcomes[0]?.phase === 'SCENARIO_CLEANUP_FAIL')
    return Object.freeze({cleanup: 'FAIL', startedCount: 1, failure: 'TERMINAL_CLIENT_ACCEPTANCE_SCENARIO_CLEANUP_FAILED'});
  const targets = events.filter(event => event.phase === 'DORIS_HISTORY_TARGET');
  if (targets.length > 1) return Object.freeze({cleanup: 'FAIL', startedCount: 1, failure: 'TERMINAL_CLIENT_ACCEPTANCE_DORIS_HISTORY_TARGET_DUPLICATE'});
  let result = {cleanup: 'PASS', startedCount: 1, failure: undefined};
  if (targets.length === 1) {
    const target = targets[0];
    if (scenarioId !== 'terminal.dev.lifecycle-and-compression' ||
        typeof target.terminalRef !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(target.terminalRef) ||
        !Array.isArray(target.sessionIds) || target.sessionIds.length !== 2 ||
        target.sessionIds.some(value => typeof value !== 'string' || !/^[A-Za-z0-9._-]{1,128}$/.test(value)) ||
        new Set(target.sessionIds).size !== target.sessionIds.length ||
        !target.sessionIds.includes(target.heartbeatSessionId))
      return Object.freeze({cleanup: 'FAIL', startedCount: 1, failure: 'TERMINAL_CLIENT_ACCEPTANCE_DORIS_HISTORY_TARGET_INVALID'});
    result = {...result, dorisHistoryTarget: Object.freeze({
      terminalRef: target.terminalRef,
      sessionIds: Object.freeze([...target.sessionIds]),
      heartbeatSessionId: target.heartbeatSessionId,
    })};
  }
  return Object.freeze(result);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  try {
    const args = parseTerminalAcceptanceArgs(process.argv.slice(2));
    if (args.selfTest) selfTest();
    else await runSelectedScenario(args.scenarioId);
  } catch (error) {
    process.stderr.write(`${safeFailure(error)}\n`);
    process.exitCode = 1;
  }
}
