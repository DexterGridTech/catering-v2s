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
} finally {
  fs.rmSync(fixtureRoot, {recursive: true, force: true});
}

console.log('TERMINAL_PACKAGE_INVARIANT_MODEL_TEST=PASS');
