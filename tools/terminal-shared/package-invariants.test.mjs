import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {
  assertExactList,
  readAllPackageInvariants,
  readPackageInvariant,
} from './package-invariants.mjs';
import {formatUnhandledDiagnostics} from './vitest-unhandled-diagnostics-reporter.mjs';
import {summarizeVitestFailureReport} from './vitest-json-report.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const packageRoot = path.join(repoRoot, 'apps/terminal/kernel/base/contracts');
const packageName = '@catering-v2s/kernel-base-contracts';
const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'terminal-invariant-test-'));
try {
  const fixturePackageRoot = path.join(fixtureRoot, 'contracts');
  fs.mkdirSync(fixturePackageRoot, {recursive: true});
  const invariantPath = path.join(fixturePackageRoot, 'terminal-invariants.json');
  const original = fs.readFileSync(path.join(packageRoot, 'terminal-invariants.json'), 'utf8');
  fs.writeFileSync(invariantPath, original);

  const invariant = readPackageInvariant(fixturePackageRoot, packageName);
  assert.equal(invariant.schemaVersion, 1);
  assertExactList('test helper list', ['b', 'a'], ['a', 'b']);
  assert.deepEqual(
    readAllPackageInvariants([{packageRoot: fixturePackageRoot, packageName}]).map(item => item.package),
    [packageName],
  );

  const mutate = mutation => {
    const value = JSON.parse(original);
    mutation(value);
    fs.writeFileSync(invariantPath, `${JSON.stringify(value)}\n`);
  };
  mutate(value => { value.schemaVersion = 999; });
  assert.throws(() => readPackageInvariant(fixturePackageRoot, packageName), /schemaVersion/);
  mutate(value => { value.owned.test.owner = '@catering-v2s/other'; });
  assert.throws(() => readPackageInvariant(fixturePackageRoot, packageName), /owner must equal package/);
  mutate(value => { value.publicExports.push(value.publicExports[0]); });
  assert.throws(() => readPackageInvariant(fixturePackageRoot, packageName), /publicExports must not contain duplicates/);
  mutate(value => { value.closedUnionConsumerCount = -1; });
  assert.throws(() => readPackageInvariant(fixturePackageRoot, packageName), /closedUnionConsumerCount/);

  const diagnostics = formatUnhandledDiagnostics([new Error('topology reconciliation rejected')], 'failed');
  assert.match(diagnostics[1], /detail="topology reconciliation rejected"/);
  const nonError = Object.assign(Object.create(null), {name: 'Error', message: 'dispatch result object'});
  const nonErrorDiagnostics = formatUnhandledDiagnostics([nonError], 'failed');
  assert.match(nonErrorDiagnostics[1], /detail=.*dispatch result object/);

  const failureDetail = summarizeVitestFailureReport({
    testResults: [
      {
        name: '/repo/sample.test.ts',
        status: 'failed',
        assertionResults: [
          {
            title: 'preserves runtime cause details',
            fullName: 'suite preserves runtime cause details',
            status: 'failed',
            failureMessages: ['outer failure\nCaused by: exact token=debug-value\ninner detail: broken adapter'],
          },
        ],
      },
    ],
  });
  assert.match(failureDetail, /Caused by: exact token=debug-value/);
  assert.match(failureDetail, /inner detail: broken adapter/);
  assert.doesNotMatch(failureDetail, /REDACTED/);
} finally {
  fs.rmSync(fixtureRoot, {recursive: true, force: true});
}

console.log('TERMINAL_PACKAGE_INVARIANT_MODEL_TEST=PASS');
