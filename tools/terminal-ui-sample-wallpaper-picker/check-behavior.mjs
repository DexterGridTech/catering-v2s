import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const packageDirectory = path.join(repoRoot, 'apps/terminal/ui/feature/sample-wallpaper-picker');
const assetsPath = path.join(packageDirectory, 'src/foundations/assets.ts');
const packageTest = ['yarn', '--cwd', 'apps/terminal/ui/feature/sample-wallpaper-picker', 'test'];

const runPackageTest = () => spawnSync(packageTest[0], packageTest.slice(1), {
  cwd: repoRoot,
  encoding: 'utf8',
  env: {...process.env, CI: '1'},
});

const baseline = runPackageTest();
if (baseline.status !== 0) {
  process.stdout.write(baseline.stdout ?? '');
  process.stderr.write(baseline.stderr ?? '');
  throw new Error(`picker baseline focused tests failed with exit ${baseline.status}`);
}
console.log('WALLPAPER_PICKER_BASELINE=PASS');

const original = fs.readFileSync(assetsPath, 'utf8');
const mutation = original.replace('  w2: w2Asset,', '  w2: undefined,');
assert.notEqual(mutation, original, 'F-A2b mutation anchor must exist');
try {
  fs.writeFileSync(assetsPath, mutation);
  const red = runPackageTest();
  assert.notEqual(red.status, 0, 'F-A2b w2 source mutation must make the independent oracle red');
  console.log('WALLPAPER_PICKER_F_A2B_RED=PASS');
} finally {
  fs.writeFileSync(assetsPath, original);
}

const cleanup = runPackageTest();
assert.equal(cleanup.status, 0, 'picker focused tests must pass after restoring the F-A2b mutation');
console.log('WALLPAPER_PICKER_CLEANUP=PASS');
