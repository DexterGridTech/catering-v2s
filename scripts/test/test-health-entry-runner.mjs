#!/usr/bin/env node

import childProcess from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const explicitScriptTestRoots = Object.freeze(['scripts/dev', 'scripts/generate', 'scripts/test']);

// This is intentionally an explicit file list. The recursive scan below is only
// the denominator check: a new scripts test file or directory must be added here
// before the runner can report success.
const nodeTestFiles = Object.freeze([
  'scripts/dev/catalog-inventory-seed-executor.test.mjs',
  'scripts/dev/r5-dev-command-wrapper.test.mjs',
  'scripts/dev/r5-complete-seed-executor.test.mjs',
  'scripts/dev/managed-diagnostic-protocol.test.mjs',
  'scripts/dev/owner-command-seed-executor.test.mjs',
  'scripts/dev/r5-otp-debug-exposure.test.mjs',
  'scripts/dev/r5-reset.test.mjs',
  'scripts/dev/terminal-fixture-state.test.mjs',
  'scripts/test/backend-acceptance-structure.test.mjs',
  'scripts/test/backend-performance-event-verifier.test.mjs',
  'scripts/test/backend-performance-budget.test.mjs',
  'scripts/test/backend-performance-operation-reconciliation.test.mjs',
  'scripts/test/browser-l2-credentials.test.mjs',
  'scripts/test/browser-l2-runtime.test.mjs',
  'scripts/test/catalog-inventory-definition-seed.test.mjs',
  'scripts/test/catalog-single-production-tag-migration.test.mjs',
  'scripts/test/catalog-identification-migration.test.mjs',
  'scripts/test/catalog-inventory-reference-path-matrix.test.mjs',
  'scripts/test/catalog-inventory-query-envelope.test.mjs',
  'scripts/test/catalog-inventory-rtk-tag-generation.test.mjs',
  'scripts/test/catalog-p3-model-migration.test.mjs',
  'scripts/test/catalog-inventory-seed-identity.test.mjs',
  'scripts/test/frontend-idempotency-boundary.test.mjs',
  'scripts/test/frontend-transport-cache-lifecycle.test.mjs',
  'scripts/test/r5-remote-testcontainers.test.mjs',
  'scripts/test/seed-report.test.mjs',
  'scripts/test/standards-enforcement-execution-catalog.test.mjs',
  'scripts/test/standards-enforcement-verify.test.mjs',
]);

const sorted = values => [...values].sort((left, right) => left.localeCompare(right));

function fail(code, detail = '') {
  throw new Error(detail ? `${code}:${detail}` : code);
}

function walkScriptTests(root, relativeDirectory = 'scripts') {
  const absoluteDirectory = path.join(root, relativeDirectory);
  const entries = fs
    .readdirSync(absoluteDirectory, {withFileTypes: true})
    .sort((left, right) => left.name.localeCompare(right.name));
  const result = [];
  for (const entry of entries) {
    const relativePath = path.posix.join(relativeDirectory.replaceAll(path.sep, '/'), entry.name);
    if (entry.isDirectory()) result.push(...walkScriptTests(root, relativePath));
    else if (entry.isFile() && entry.name.endsWith('.test.mjs')) result.push(relativePath);
  }
  return result;
}

export function validateExplicitTestSet({root: repositoryRoot = root, declared = nodeTestFiles} = {}) {
  const discovered = sorted(walkScriptTests(repositoryRoot));
  const declaredNormalized = declared.map(value => String(value).replaceAll(path.sep, '/'));
  const duplicates = declaredNormalized.filter((value, index) => declaredNormalized.indexOf(value) !== index);
  if (duplicates.length > 0) fail('THCL_NODE_TEST_ENTRY_DUPLICATE', sorted(new Set(duplicates)).join(','));
  const declaredSet = new Set(declaredNormalized);
  const discoveredSet = new Set(discovered);
  const missing = discovered.filter(value => !declaredSet.has(value));
  const extra = declaredNormalized.filter(value => !discoveredSet.has(value));
  if (missing.length > 0 || extra.length > 0) {
    fail('THCL_NODE_TEST_ENTRY_DENOMINATOR_MISMATCH', `missing=${missing.join(',')};extra=${extra.join(',')}`);
  }
  for (const relative of declaredNormalized) {
    const absolute = path.join(repositoryRoot, relative);
    if (!fs.statSync(absolute).isFile()) fail('THCL_NODE_TEST_ENTRY_NOT_FILE', relative);
  }
  return Object.freeze({
    declared: Object.freeze(sorted(declaredNormalized)),
    discovered: Object.freeze(discovered),
    count: discovered.length,
  });
}

function assertSelfTest(condition, code) {
  if (!condition) fail(`THCL_NODE_TEST_ENTRY_SELF_TEST_NOT_RED:${code}`);
}

export function selfTest(repositoryRoot = root) {
  const current = validateExplicitTestSet({root: repositoryRoot});
  assertSelfTest(current.count === nodeTestFiles.length, 'CURRENT_COUNT');
  try {
    validateExplicitTestSet({root: repositoryRoot, declared: nodeTestFiles.slice(1)});
    fail('THCL_NODE_TEST_ENTRY_SELF_TEST_NOT_RED:MISSING');
  } catch (error) {
    if (!error.message.startsWith('THCL_NODE_TEST_ENTRY_DENOMINATOR_MISMATCH:')) throw error;
  }
  try {
    validateExplicitTestSet({root: repositoryRoot, declared: [...nodeTestFiles, nodeTestFiles[0]]});
    fail('THCL_NODE_TEST_ENTRY_SELF_TEST_NOT_RED:DUPLICATE');
  } catch (error) {
    if (error.message !== `THCL_NODE_TEST_ENTRY_DUPLICATE:${nodeTestFiles[0]}`) throw error;
  }
  const source = fs.readFileSync(path.join(repositoryRoot, 'scripts/test/test-health-entry-runner.mjs'), 'utf8');
  assertSelfTest(
    explicitScriptTestRoots.every(relative => source.includes(`'${relative}'`) || source.includes(`"${relative}"`)),
    'EXPLICIT_ROOTS',
  );
  const broadNodeGlob = ['**', '/*.test.mjs'].join('');
  const broadFrontendGlob = ['src/', ['**', '/*.test.mjs'].join('')].join('');
  assertSelfTest(!source.includes(broadNodeGlob) && !source.includes(broadFrontendGlob), 'BROAD_GLOB');
  process.stdout.write(
    `THCL_NODE_TEST_ENTRY_SELF_TEST=PASS\nDISCOVERED_TEST_FILES=${current.count}\nEXECUTED_TEST_FILES=${current.count}\nRED_MISSING_ENTRY=PASS\nRED_DUPLICATE_ENTRY=PASS\nRED_BROAD_GLOB=PASS\n`,
  );
}

export function runNodeTests({repositoryRoot = root, spawnSyncImpl = childProcess.spawnSync} = {}) {
  const entrySet = validateExplicitTestSet({root: repositoryRoot});
  const result = spawnSyncImpl(process.execPath, ['--test', ...entrySet.declared], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env: {...process.env},
  });
  process.stdout.write(result?.stdout || '');
  process.stderr.write(result?.stderr || '');
  if (result?.error) fail('THCL_NODE_TEST_ENTRY_SPAWN_FAILURE', result.error.code || 'UNKNOWN');
  if (result?.status !== 0) {
    process.stdout.write('THCL_NODE_TEST_ENTRY=FAIL\n');
    process.exitCode = result?.status ?? 1;
    return Object.freeze({...entrySet, status: 'FAIL', exitStatus: process.exitCode});
  }
  process.stdout.write(
    `THCL_NODE_TEST_ENTRY=PASS\nDISCOVERED_TEST_FILES=${entrySet.discovered.length}\nEXECUTED_TEST_FILES=${entrySet.declared.length}\n`,
  );
  return Object.freeze({...entrySet, status: 'PASS', exitStatus: 0});
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  try {
    if (process.argv.length === 3 && process.argv[2] === '--self-test') selfTest();
    else if (process.argv.length === 3 && process.argv[2] === '--node') runNodeTests();
    else fail('THCL_NODE_TEST_ENTRY_ARGUMENT_INVALID');
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
