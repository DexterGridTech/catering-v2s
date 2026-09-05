import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const toolRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(toolRoot, '../..');
const packageRoot = process.cwd();

function collectTestFiles(directory, result = []) {
  if (!fs.existsSync(directory)) return result;
  for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
    if (['node_modules', '.git', '.turbo', '.expo', 'build', 'dist'].includes(entry.name)) continue;
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) collectTestFiles(entryPath, result);
    else if (entry.isFile() && /\.test\.tsx?$/.test(entry.name)) result.push(entryPath);
  }
  return result.sort();
}

function marker(kind, packageName) {
  return `TERMINAL_PACKAGE_TEST=PASS kind=${kind} package=${packageName}`;
}

const packageJsonPath = path.join(packageRoot, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const packageName = packageJson.name;
const testFiles = collectTestFiles(path.join(packageRoot, 'test'));
if (testFiles.length === 0) {
  console.log(marker('NO_TEST_FILES', packageName));
  process.exit(0);
}

const vitestPath = path.join(repositoryRoot, 'node_modules/.bin/vitest');
const packageNodeModules = path.join(packageRoot, 'node_modules');
const vitestCacheDirectories = [
  path.join(packageNodeModules, '.vite'),
  path.join(packageNodeModules, '.vite-temp'),
];
let result;
try {
  result = spawnSync(vitestPath, ['run', '--config', 'vitest.config.ts'], {
    cwd: packageRoot,
    stdio: 'inherit',
  });
} finally {
  for (const cacheDirectory of vitestCacheDirectories) {
    fs.rmSync(cacheDirectory, {recursive: true, force: true});
  }
  try {
    fs.rmdirSync(packageNodeModules);
  } catch (error) {
    if (error?.code !== 'ENOENT' && error?.code !== 'ENOTEMPTY') throw error;
  }
}
if (result.error) {
  console.error(`TERMINAL_PACKAGE_TEST_FAILURE package=${packageName} error=${result.error.message}`);
  process.exit(1);
}
if (result.signal) {
  console.error(`TERMINAL_PACKAGE_TEST_FAILURE package=${packageName} signal=${result.signal}`);
  process.exit(1);
}
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(marker('REAL_TESTS', packageName));
