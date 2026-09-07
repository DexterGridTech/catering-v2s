import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const toolDirectory = path.dirname(fileURLToPath(import.meta.url));
const testPath = path.join(toolDirectory, 'check-static.test.mjs');
const checkPath = path.join(toolDirectory, 'check-static.mjs');
const contractsTestPath = path.join(toolDirectory, '../terminal-contracts/check-static.test.mjs');
const contractsCheckPath = path.join(toolDirectory, '../terminal-contracts/check-static.mjs');
const platformPortsTestPath = path.join(toolDirectory, '../terminal-platform-ports/check-static.test.mjs');
const platformPortsCheckPath = path.join(toolDirectory, '../terminal-platform-ports/check-static.mjs');
const stateTestPath = path.join(toolDirectory, '../terminal-state/check-static.test.mjs');
const stateCheckPath = path.join(toolDirectory, '../terminal-state/check-static.mjs');
const runtimeTestPath = path.join(toolDirectory, '../terminal-runtime/check-static.test.mjs');
const runtimeCheckPath = path.join(toolDirectory, '../terminal-runtime/check-static.mjs');
const displayContextTestPath = path.join(toolDirectory, '../terminal-display-context/check-static.test.mjs');
const displayContextCheckPath = path.join(toolDirectory, '../terminal-display-context/check-static.mjs');
const uiStateTestPath = path.join(toolDirectory, '../terminal-ui-state/check-static.test.mjs');
const uiStateCheckPath = path.join(toolDirectory, '../terminal-ui-state/check-static.mjs');
const renderTestPath = path.join(toolDirectory, '../terminal-ui-render/check-static.test.mjs');
const renderCheckPath = path.join(toolDirectory, '../terminal-ui-render/check-static.mjs');
const layeringTestPath = path.join(toolDirectory, '../terminal-layering/check-static.test.mjs');
const layeringCheckPath = path.join(toolDirectory, '../terminal-layering/check-static.mjs');
const readabilityTestPath = path.join(toolDirectory, '../terminal-readability/check-static.test.mjs');
const readabilityCheckPath = path.join(toolDirectory, '../terminal-readability/check-static.mjs');

const staticRunId = `ter-local-static-${process.pid}-${Date.now()}`;

function debugLog(phase, fields = {}) {
  const state = phase.endsWith('.start') ? 'START' : phase.endsWith('.finish') ? 'FINISH' : undefined;
  const payload = {
    schemaVersion: 1,
    event: 'TERMINAL_VERIFY_DEBUG',
    runId: staticRunId,
    phase,
    at: new Date().toISOString(),
    ...(state ? {state} : {}),
    ...fields,
  };
  process.stderr.write(`TERMINAL_VERIFY_DEBUG ${JSON.stringify(payload)}\n`);
}

function durationMs(startedAt) {
  return Number(process.hrtime.bigint() - startedAt) / 1_000_000;
}

function run(label, command, args) {
  const startedAt = process.hrtime.bigint();
  debugLog('subprocess.start', {label, command, args, cwd: path.resolve(toolDirectory, '../..')});
  const result = spawnSync(command, args, {cwd: path.resolve(toolDirectory, '../..'), encoding: 'utf8'});
  debugLog('subprocess.finish', {
    label,
    command,
    status: result.status,
    signal: result.signal ?? null,
    errorCode: result.error?.code ?? null,
    durationMs: Math.round(durationMs(startedAt)),
  });
  process.stdout.write(result.stdout ?? '');
  process.stderr.write(result.stderr ?? '');
  if (result.status !== 0) {
    debugLog('verify-static.finish', {outcome: 'FAIL', label, status: result.status});
    console.error(`TERMINAL_STATIC_FIRST_FAILURE:${label}:exit=${String(result.status)}`);
    process.exit(result.status ?? 1);
  }
}

debugLog('verify-static.start', {cwd: path.resolve(toolDirectory, '../..'), pid: process.pid, node: process.version});
run('readability-model-test', process.execPath, [readabilityTestPath]);
run('readability-real-static', process.execPath, [readabilityCheckPath]);
run('model-test', process.execPath, [testPath]);
run('real-static-tree', process.execPath, [checkPath]);
run('contracts-model-test', process.execPath, [contractsTestPath]);
run('contracts-real-static', process.execPath, [contractsCheckPath]);
run('platform-ports-model-test', process.execPath, [platformPortsTestPath]);
run('platform-ports-real-static', process.execPath, [platformPortsCheckPath]);
run('state-model-test', process.execPath, [stateTestPath]);
run('state-real-static', process.execPath, [stateCheckPath]);
run('runtime-model-test', process.execPath, [runtimeTestPath]);
run('runtime-real-static', process.execPath, [runtimeCheckPath]);
run('display-context-model-test', process.execPath, [displayContextTestPath]);
run('display-context-real-static', process.execPath, [displayContextCheckPath]);
run('ui-state-model-test', process.execPath, [uiStateTestPath]);
run('ui-state-real-static', process.execPath, [uiStateCheckPath]);
run('render-model-test', process.execPath, [renderTestPath]);
run('render-real-static', process.execPath, [renderCheckPath]);
run('layering-model-test', process.execPath, [layeringTestPath]);
run('layering-real-static', process.execPath, [layeringCheckPath]);
debugLog('verify-static.finish', {outcome: 'PASS'});
console.log('TERMINAL_STATIC=PASS');
