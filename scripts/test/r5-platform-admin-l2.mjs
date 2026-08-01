#!/usr/bin/env node
/** Purpose-bound managed browser L2 runner for the finite P6-2 platform surfaces. */
import crypto from 'node:crypto';
import {appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const runId = `p6l2-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
const runtime = path.join(root, '.runtime/r5/l2', runId);
const environment = {...process.env, V2S_DEV_NAMESPACE: `v2s-dev-${runId}`.slice(0, 32), V2S_RUNTIME_DIR: runtime, V2S_R5_REQUIRE_FRESH_DATABASE: 'true', V2S_R5_L2_OTP_DEBUG_EXPOSURE: 'true'};
const resultPath = path.join(runtime, 'platform-admin-l2', 'result.json');
const phaseLogPath = path.join(runtime, 'platform-admin-l2', 'phases.jsonl');
const terminalManifestPath = path.join(runtime, 'platform-admin-l2', 'terminal-run-manifest.json');
const phases = [];
let started = false;
let business = 'NOT_RUN'; let cleanup = 'NOT_RUN';
let terminalManifest = 'NOT_RECORDED';
const phase = (name, status, extra = {}) => { const event = {atEpochMillis: Date.now(), name, status, ...extra}; phases.push(event); mkdirSync(path.dirname(phaseLogPath), {recursive: true}); appendFileSync(phaseLogPath, JSON.stringify(event) + '\n', {mode: 0o600}); process.stdout.write(`R5_PLATFORM_L2_PHASE=${name}; STATUS=${status}\n`); };
const execute = (name, command, args, options = {}) => { const began = Date.now(); const output = spawnSync(command, args, {cwd: root, encoding: 'utf8', env: environment, ...options}); phase(name, output.status === 0 ? 'PASS' : 'FAIL', {elapsedMs: Date.now() - began}); if (output.status !== 0) throw new Error(`${name}:${(output.stderr || output.stdout || 'FAILED').replace(/\s+/g, '_').slice(0, 180)}`); return output; };
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
function diagnostics(reason) {
  const manifestPath = path.join(runtime, 'run-manifest.json'); const logs = [];
  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    for (const process of manifest.processes ?? []) {
      let tail = 'LOG_NOT_AVAILABLE';
      try { tail = readFileSync(process.log, 'utf8').split('\n').slice(-25).join('\n').replace(/(?:password|token|cookie|otp)[^\n]*/gi, '[REDACTED]'); } catch { /* recorded as unavailable */ }
      logs.push({name: process.name, pid: process.pid, log: process.log, tail});
    }
  }
  phase('diagnostics', 'RECORDED', {reason, logs});
}
async function readiness() {
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    try {
      const [backend, frontend] = await Promise.all([fetch('http://127.0.0.1:8080/api/platform/auth/password-login', {method: 'OPTIONS', signal: AbortSignal.timeout(3000)}), fetch('http://127.0.0.1:5174/platform/login', {signal: AbortSignal.timeout(3000)})]);
      if (backend.status >= 100 && frontend.ok) { phase('readiness', 'PASS', {backendStatus: backend.status, frontendStatus: frontend.status}); return; }
    } catch { /* fixed readiness window only */ }
    await delay(1000);
  }
  diagnostics('READINESS_DEADLINE_EXCEEDED'); throw new Error('READINESS_DEADLINE_EXCEEDED');
}
function writeResult() {
  mkdirSync(path.dirname(resultPath), {recursive: true});
  writeFileSync(resultPath, JSON.stringify({kind: 'r5-platform-admin-l2-result', runId, business, cleanup, phases, terminalManifest, secrets: 'NOT_RECORDED'}, null, 2) + '\n', {mode: 0o600});
}
function preserveTerminalManifest() {
  const sourcePath = path.join(runtime, 'run-manifest.json');
  if (!existsSync(sourcePath)) throw new Error('RUN_MANIFEST_NOT_AVAILABLE_BEFORE_STOP');
  const source = JSON.parse(readFileSync(sourcePath, 'utf8'));
  const snapshot = {
    kind: 'r5-platform-admin-l2-terminal-run-manifest',
    runId,
    freshDatabase: source.freshDatabase === true,
    otpDebugExposure: source.otpDebugExposure === true,
    processes: (source.processes ?? []).map(({name, pid, log, command}) => ({name, pid, log, command})),
    secrets: 'NOT_RECORDED'
  };
  if (!snapshot.freshDatabase || !snapshot.otpDebugExposure || snapshot.processes.length === 0) throw new Error('TERMINAL_RUN_MANIFEST_INCOMPLETE');
  writeFileSync(terminalManifestPath, JSON.stringify(snapshot, null, 2) + '\n', {mode: 0o600});
  terminalManifest = terminalManifestPath;
  phase('terminalManifest', 'PASS', {path: terminalManifestPath, processCount: snapshot.processes.length});
}
try {
  execute('managedStart', process.execPath, [path.join(root, 'scripts/dev/r5-dev-runner.mjs'), 'start']); started = true;
  await readiness();
  execute('ownerCommandFixture', process.execPath, [path.join(root, 'scripts/test/r5-platform-admin-l2-fixture-seed.mjs')]);
  const fixture = JSON.parse(readFileSync(path.join(runtime, 'platform-admin-l2', 'fixture.json'), 'utf8')).values;
  const credentials = Object.fromEntries(readFileSync(path.join(runtime, 'credentials.env'), 'utf8').trim().split('\n').filter(Boolean).map(line => line.split('=', 2)));
  execute('playwright', 'yarn', ['--cwd', 'apps/frontend/platform-admin', 'playwright', 'test', 'src/tests/l2'], {env: {...environment, ...fixture, R5_L2_PLATFORM_LOGIN_PASSWORD: credentials.V2S_SEED_PLATFORM_ROOT_PASSWORD, R5_L2_PLATFORM_BASE_URL: 'http://127.0.0.1:5174'}});
  business = 'PASS';
} catch (error) {
  business = 'FAIL'; diagnostics(String(error.message ?? error)); process.stderr.write(`R5_PLATFORM_L2=FAIL; REASON=${String(error.message ?? error)}\n`);
} finally {
  if (started) {
    try { preserveTerminalManifest(); execute('managedStop', process.execPath, [path.join(root, 'scripts/dev/r5-dev-runner.mjs'), 'stop']); cleanup = 'PASS'; }
    catch (error) { cleanup = 'FAIL'; diagnostics(`STOP:${String(error.message ?? error)}`); }
  } else cleanup = 'NOT_REQUIRED';
  writeResult(); process.stdout.write(`R5_PLATFORM_L2_RESULT=${business}; CLEANUP=${cleanup}; RESULT=${resultPath}\n`);
}
process.exitCode = business === 'PASS' && cleanup === 'PASS' ? 0 : 2;
