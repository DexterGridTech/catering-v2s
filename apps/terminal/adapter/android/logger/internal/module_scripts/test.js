#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {spawnSyncWithAutoShell} from './util.js';

const SUBTARGETS = ['plugin', 'cli', 'utils', 'scripts'];
const DEFAULT_TEST_FILE_PATTERN = /(?:^|\/)(?:__tests__\/.*|[^/]+\.(?:test|spec))\.(?:[cm]?[jt]sx?)$/;
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDirectory, '../..');

function readPackageJson() {
  return JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
}

function toPosixPath(filePath) {
  return filePath.split(path.sep).join('/');
}

function collectFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  function visit(currentDirectory) {
    for (const entry of fs.readdirSync(currentDirectory, {withFileTypes: true})) {
      if (entry.name === 'node_modules') continue;
      const entryPath = path.join(currentDirectory, entry.name);
      if (entry.isDirectory()) visit(entryPath);
      else if (entry.isFile()) files.push(entryPath);
    }
  }
  visit(directory);
  return files.sort();
}

function configuredRoots(manifest, target) {
  if (target) return [path.resolve(packageRoot, target)];
  const roots = manifest.jest?.roots ?? ['<rootDir>'];
  return roots.map(root => path.resolve(packageRoot, root.replace('<rootDir>', '.')));
}

function testFileMatches(filePath, manifest) {
  const relativePath = toPosixPath(path.relative(packageRoot, filePath));
  const testRegex = manifest.jest?.testRegex;
  if (testRegex) {
    const patterns = Array.isArray(testRegex) ? testRegex : [testRegex];
    return patterns.some(pattern => new RegExp(pattern).test(filePath));
  }
  // The current adapter manifests use Jest's defaults (no testMatch/testRegex).
  // Keep this default path rule explicit so a missing test cannot be mistaken for
  // a successful Jest run.
  return DEFAULT_TEST_FILE_PATTERN.test(relativePath);
}

class AdapterTestConfigurationError extends Error {
  constructor(code) {
    super(code);
    this.name = 'AdapterTestConfigurationError';
    this.code = code;
  }
}

function assertSupportedTestConfiguration(manifest) {
  if (Object.prototype.hasOwnProperty.call(manifest.jest ?? {}, 'testMatch')) {
    throw new AdapterTestConfigurationError('UNSUPPORTED_TEST_MATCH');
  }
}

function discoverTests(manifest, target) {
  return configuredRoots(manifest, target)
    .flatMap(collectFiles)
    .filter(filePath => testFileMatches(filePath, manifest));
}

function packageTestMarker(kind, packageName) {
  return 'TERMINAL_PACKAGE_TEST=PASS kind=' + kind + ' package=' + packageName;
}

const manifest = readPackageJson();
const packageName = manifest.name;
try {
  assertSupportedTestConfiguration(manifest);
} catch (error) {
  if (error instanceof AdapterTestConfigurationError) {
    console.error(
      'TERMINAL_PACKAGE_TEST_CONFIGURATION_FAILURE package=' + packageName + ' code=' + error.code,
    );
    process.exit(1);
  }
  throw error;
}
const originalArgs = process.argv.slice(2);
const target = SUBTARGETS.includes(originalArgs[0]) ? originalArgs[0] : null;
let args = originalArgs;

if (target) {
  const targetDir = path.join(packageRoot, target);
  const restArgs = originalArgs.slice(1);
  args = ['--rootDir', target];
  if (fs.existsSync(path.join(targetDir, 'jest.config.js'))) {
    args.push('--config', target + '/jest.config.js');
  }
  args.push(...restArgs);
}

const testFiles = discoverTests(manifest, target);
if (testFiles.length === 0) {
  console.log(packageTestMarker('NO_TEST_FILES', packageName));
  process.exit(0);
}

if (
  process.stdout.isTTY
  && !process.env.CI
  && !process.env.EXPO_NONINTERACTIVE
  && !args.includes('--watch')
) {
  args.push('--watch');
}

const result = spawnSyncWithAutoShell('jest', args, {stdio: 'inherit'});
if (result.error) {
  console.error('TERMINAL_PACKAGE_TEST_FAILURE package=' + packageName + ' error=' + result.error.message);
  process.exit(1);
}
if (result.signal) {
  console.error('TERMINAL_PACKAGE_TEST_FAILURE package=' + packageName + ' signal=' + result.signal);
  process.kill(process.pid, result.signal);
}
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(packageTestMarker('REAL_TESTS', packageName));
