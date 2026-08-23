#!/usr/bin/env node
/**
 * Backend unit/contract gate for catalog and light-inventory.
 *
 * This gate owns no runtime business data and never invokes a seed profile.
 * Only pure owner-module tests run locally. Any module whose test denominator
 * imports Testcontainers, together with application tests, is delegated to the
 * repository's managed remote Testcontainers runner.
 */
import {createHash} from 'node:crypto';
import {mkdirSync, rmSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const root = path.resolve(import.meta.dirname, '../..');
const runtime = path.resolve(process.env.V2S_RUNTIME_DIR || path.join(root, '.runtime/r5'));
const reportPath = path.join(runtime, 'results', 'catalog-inventory-backend-unit-tests.json');
const remoteModuleTasks = [
  ':apps:backend:catering-business-server:modules:catalog:test',
  ':apps:backend:catering-business-server:modules:inventory:test',
];
const remoteApplicationTests = [
  'com.catering.v2s.app.edge.operations.cataloginventory.OperationsCatalogInventoryControllerRouteTest',
  'com.catering.v2s.app.application.cataloginventory.CatalogCopySourceAuthorityTest',
];
const childOutputBudgetBytes = 32 * 1024 * 1024;
const phases = [];
let firstFailure = null;
let lastKnownGood = null;
let brokenBoundary = null;
const fail = (code) => { const error = new Error(`CATALOG_INVENTORY_BACKEND_UNIT=${code}`); error.code = code; throw error; };
const command = (binary, args) => spawnSync(binary, args, {
  cwd: root,
  encoding: 'utf8',
  maxBuffer: childOutputBudgetBytes,
});
const digest = (value) => createHash('sha256').update(value).digest('hex');
const summarize = (result) => ({
  status: result.status,
  signal: result.signal,
  error: result.error ? {code: result.error.code, message: result.error.message} : null,
  stdoutBytes: Buffer.byteLength(result.stdout || ''),
  stderrBytes: Buffer.byteLength(result.stderr || ''),
  outputSha256: digest(`${result.stdout || ''}\n${result.stderr || ''}`),
});
const evidenceDirectory = (result) => {
  const match = `${result.stdout || ''}\n${result.stderr || ''}`.match(/EVIDENCE=([^\s;]+)/);
  return match ? match[1] : null;
};

function writeReport(status) {
  mkdirSync(path.dirname(reportPath), {recursive: true, mode: 0o700});
  const report = {
    schemaVersion: 1,
    kind: 'catalog-inventory-backend-unit-tests',
    status,
    seedRuntimeInput: false,
    apiHttpCasesNotRunHere: true,
    firstFailure,
    lastKnownGood,
    brokenBoundary,
    business: phases.length === 0 ? 'NOT_RUN' : phases.every((phase) => phase.status === 'PASS') ? 'PASS' : 'FAIL',
    cleanup: phases.length === 0 ? 'NOT_RUN' : 'DELEGATED_TO_MANAGED_RUN_MANIFESTS',
    phases,
  };
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, {mode: 0o600});
}

function selfTest() {
  if (remoteModuleTasks.length !== 2 || !remoteModuleTasks.includes(':apps:backend:catering-business-server:modules:catalog:test') || !remoteModuleTasks.includes(':apps:backend:catering-business-server:modules:inventory:test')) fail('REMOTE_MODULE_TASK_DENOMINATOR_INVALID');
  if (remoteApplicationTests.length !== 2 || remoteApplicationTests.some((name) => !name.endsWith('Test'))) fail('REMOTE_TEST_DENOMINATOR_INVALID');
  process.stdout.write('CATALOG_INVENTORY_BACKEND_UNIT_SELF_TEST=PASS\nLOCAL_MODULE_TESTS=0\nREMOTE_MODULE_TESTS=2\nREMOTE_APPLICATION_TESTS=2\nSEED_RUNTIME_INPUT=false\n');
}

function execute() {
  if (process.argv.includes('--self-test')) return selfTest();
  mkdirSync(path.dirname(reportPath), {recursive: true, mode: 0o700});
  rmSync(reportPath, {force: true});

  for (const task of remoteModuleTasks) {
    const remoteModule = command(process.execPath, [path.join(root, 'scripts/test/r5-remote-testcontainers.mjs'), task]);
    const phase = {name: 'REMOTE_OWNER_MODULE_TESTS', task, evidence: evidenceDirectory(remoteModule), ...summarize(remoteModule), status: remoteModule.status === 0 ? 'PASS' : 'FAIL'};
    phases.push(phase);
    if (phase.status !== 'PASS') {
      firstFailure = 'REMOTE_OWNER_MODULE_TESTS_FAILED';
      brokenBoundary = task;
      writeReport('FAIL');
      fail(firstFailure);
    }
    lastKnownGood = task;
  }

  const remoteArgs = [path.join(root, 'scripts/test/r5-remote-testcontainers.mjs'), ':apps:backend:catering-business-server:test'];
  for (const testName of remoteApplicationTests) remoteArgs.push('--tests', testName);
  const remote = command(process.execPath, remoteArgs);
  const phase = {name: 'REMOTE_APPLICATION_TESTS', evidence: evidenceDirectory(remote), ...summarize(remote), status: remote.status === 0 ? 'PASS' : 'FAIL'};
  phases.push(phase);
  if (phase.status !== 'PASS') {
    firstFailure = 'REMOTE_APPLICATION_TESTS_FAILED';
    brokenBoundary = ':apps:backend:catering-business-server:test';
    writeReport('FAIL');
    fail(firstFailure);
  }
  lastKnownGood = 'REMOTE_APPLICATION_TESTS';
  writeReport('PASS');
  process.stdout.write(`CATALOG_INVENTORY_BACKEND_UNIT_TESTS=PASS; REPORT=${reportPath}\n`);
}

try { execute(); } catch (error) {
  firstFailure ??= error.code || error.message;
  writeReport('FAIL');
  process.stderr.write(`${error.code || error.message}\n`);
  process.exitCode = 2;
}
