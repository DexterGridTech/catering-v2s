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
import {existsSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
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
const fail = (code) => { const error = new Error(`CATALOG_INVENTORY_BACKEND_UNIT=${code}`); error.code = code; throw error; };
const command = (binary, args) => spawnSync(binary, args, {cwd: root, encoding: 'utf8'});
const digest = (value) => createHash('sha256').update(value).digest('hex');
const summarize = (result) => ({status: result.status, signal: result.signal, stdoutBytes: Buffer.byteLength(result.stdout || ''), stderrBytes: Buffer.byteLength(result.stderr || ''), outputSha256: digest(`${result.stdout || ''}\n${result.stderr || ''}`)});

function selfTest() {
  if (remoteModuleTasks.length !== 2 || !remoteModuleTasks.includes(':apps:backend:catering-business-server:modules:catalog:test') || !remoteModuleTasks.includes(':apps:backend:catering-business-server:modules:inventory:test')) fail('REMOTE_MODULE_TASK_DENOMINATOR_INVALID');
  if (remoteApplicationTests.length !== 2 || remoteApplicationTests.some((name) => !name.endsWith('Test'))) fail('REMOTE_TEST_DENOMINATOR_INVALID');
  process.stdout.write('CATALOG_INVENTORY_BACKEND_UNIT_SELF_TEST=PASS\nLOCAL_MODULE_TESTS=0\nREMOTE_MODULE_TESTS=2\nREMOTE_APPLICATION_TESTS=2\nSEED_RUNTIME_INPUT=false\n');
}

function execute() {
  if (process.argv.includes('--self-test')) return selfTest();
  const phases = [];
  mkdirSync(path.dirname(reportPath), {recursive: true, mode: 0o700});
  rmSync(reportPath, {force: true});

  for (const task of remoteModuleTasks) {
    const remoteModule = command(process.execPath, [path.join(root, 'scripts/test/r5-remote-testcontainers.mjs'), task]);
    phases.push({name: 'REMOTE_OWNER_MODULE_TESTS', task, ...summarize(remoteModule), status: remoteModule.status === 0 ? 'PASS' : 'FAIL'});
    if (remoteModule.status !== 0) fail('REMOTE_OWNER_MODULE_TESTS_FAILED');
  }

  const remoteArgs = [path.join(root, 'scripts/test/r5-remote-testcontainers.mjs'), ':apps:backend:catering-business-server:test'];
  for (const testName of remoteApplicationTests) remoteArgs.push('--tests', testName);
  const remote = command(process.execPath, remoteArgs);
  phases.push({name: 'REMOTE_APPLICATION_TESTS', ...summarize(remote), status: remote.status === 0 ? 'PASS' : 'FAIL'});
  const report = {schemaVersion: 1, kind: 'catalog-inventory-backend-unit-tests', status: phases.every((phase) => phase.status === 'PASS') ? 'PASS' : 'FAIL', seedRuntimeInput: false, apiHttpCasesNotRunHere: true, phases};
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, {mode: 0o600});
  if (remote.status !== 0) fail('REMOTE_APPLICATION_TESTS_FAILED');
  process.stdout.write(`CATALOG_INVENTORY_BACKEND_UNIT_TESTS=PASS; REPORT=${reportPath}\n`);
}

try { execute(); } catch (error) {
  if (!existsSync(reportPath)) {
    mkdirSync(path.dirname(reportPath), {recursive: true, mode: 0o700});
    writeFileSync(reportPath, `${JSON.stringify({schemaVersion: 1, kind: 'catalog-inventory-backend-unit-tests', status: 'FAIL', seedRuntimeInput: false, firstFailure: error.code || error.message}, null, 2)}\n`, {mode: 0o600});
  }
  process.stderr.write(`${error.code || error.message}\n`);
  process.exitCode = 2;
}
