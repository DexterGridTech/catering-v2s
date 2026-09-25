#!/usr/bin/env node

import childProcess from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {resolveGradleCommand} from '../../scripts/lib/gradle-runtime.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const childOutputBudgetBytes = 32 * 1024 * 1024;

// `scripts/verify --validate-only` deliberately names the real static checks it
// runs. It has no derived denominator, dependency digest, persistent execution artifact, or hook
// contract: a check passes only when its current command actually passes.
const staticCommands = Object.freeze([
  ['logging-boundaries', 'scripts/check/logging-boundaries', [], ['R4_LOGGING_BOUNDARIES=PASS']],
  ['database-boundaries', 'scripts/check/database-boundaries', [], ['R4_DATABASE_BOUNDARIES=PASS']],
  ['query-boundaries', 'scripts/check/query-boundaries', [], ['R4_DATABASE_QUERY_BOUNDARIES=PASS']],
  ['backend-boundaries', 'scripts/check/backend-boundaries', [], ['R4_BACKEND_BOUNDARIES=PASS']],
  ['frontend-architecture', 'scripts/check/frontend-architecture', [], ['R5_FRONTEND_ARCHITECTURE=PASS']],
  ['frontend-format', 'yarn', ['format:check'], ['All matched files use Prettier code style!']],
  ['name-code-density', 'node', ['scripts/check/name-code-density.mjs'], ['NAME_CODE_DENSITY=PASS']],
  ['openapi-contracts', 'scripts/check/openapi-contracts', [], ['R5_OPENAPI_CONTRACTS=PASS']],
  ['ui-wireframe-traceability', 'scripts/check/ui-wireframe-traceability', [], ['R4_UI_WIREFRAME_TRACEABILITY=PASS']],
  [
    'business-terminology-traceability',
    'scripts/check/business-terminology-traceability',
    [],
    ['R4_BUSINESS_TERMINOLOGY_TRACEABILITY=PASS'],
  ],
  ['code-layout', 'scripts/check/code-layout', [], ['CODE_LAYOUT=PASS']],
  ['catalog-inventory-p1', 'node', ['tools/catalog-inventory-p1/cli.mjs'], ['CATALOG_INVENTORY_P1_CHECK=PASS']],
  ['sales-menu-contract', 'scripts/check/sales-menu-contract', [], ['SALES_MENU_CONTRACT=PASS']],
  ['sales-menu-schema', 'scripts/check/sales-menu-schema', [], ['SALES_MENU_SCHEMA=PASS']],
  ['sales-menu-l2-p1', 'node', ['scripts/generate/sales-menu-p1.mjs', '--check'], ['SALES_MENU_P1=PASS']],
  [
    'store-terminal-rules',
    'node',
    ['scripts/generate/store-terminal-rules.mjs', '--self-test', '--check'],
    ['STORE_TERMINAL_RULES_SELF_TEST=PASS', 'STORE_TERMINAL_RULES_CHECK=PASS'],
  ],
  [
    'sales-menu-l2-fixture',
    'node',
    ['scripts/test/sales-menu-l2-fixture.mjs', '--self-test'],
    ['SALES_MENU_L2_FIXTURE_SELF_TEST=PASS'],
  ],
  [
    'sales-menu-l2-runner-self-test',
    'scripts/test/browser-l2',
    ['--suite', 'sales-menu', '--self-test'],
    ['BROWSER_L2_SALES_MENU_RUNTIME_SELF_TEST=PASS'],
  ],
  [
    'l2-locator-bindings-static',
    'node',
    ['--test', 'scripts/test/l2-locator-bindings.static.test.mjs'],
    ['tests 8', 'pass 8'],
  ],
  ['runtime-environment-keys', 'scripts/check/runtime-environment-keys', [], ['R5_RUNTIME_ENVIRONMENT_KEYS=PASS']],
  ['lifecycle-vocabulary', 'scripts/check/lifecycle-vocabulary', [], ['R6_LIFECYCLE_VOCABULARY=PASS']],
  ['reuse-consistency', 'node', ['tools/verify-gates/cli.mjs', 'r11'], ['R11_REUSE_CONSISTENCY=PASS']],
  [
    'backend-archunit',
    'gradle',
    [':apps:backend:catering-business-server:backendModuleBoundariesArchunitSelector', '--no-daemon'],
    ['BUILD SUCCESSFUL'],
  ],
  ['backend-pmd-preserve-stack-trace', 'gradle', ['backendPmdPreserveStackTrace', '--no-daemon'], ['BUILD SUCCESSFUL']],
  ['backend-spotless-check', 'gradle', ['spotlessCheck', '--no-daemon'], ['BUILD SUCCESSFUL']],
  [
    'terminal-static',
    'yarn',
    ['workspace', '@catering-v2s/terminal', 'run', 'verify:static'],
    ['TERMINAL_STATIC=PASS'],
  ],
]);

const runtimeCommands = [
  ['U01-face', 'scripts/check/contract-face', []],
  ['U01-codegen', 'scripts/check/edge-codegen', []],
  ['U01-retirement', 'scripts/check/retirement', []],
  ['THCL-04-node-tests', 'node', ['scripts/test/test-health-entry-runner.mjs', '--node']],
  ['THCL-04-foundation-tests', 'yarn', ['--cwd', 'libraries/frontend/admin-ui-foundation', 'test']],
  [
    'U02-backend',
    'node',
    ['scripts/test/r5-remote-testcontainers.mjs', ':apps:backend:catering-business-server:test'],
    true,
  ],
  ['U02-flyway', 'scripts/check/flyway-layout', []],
  [
    'U03-platform-iam',
    'node',
    [
      'scripts/test/r5-remote-testcontainers.mjs',
      ':apps:backend:catering-business-server:modules:platform-admin-iam:test',
    ],
    true,
  ],
  [
    'U04-workspace',
    'node',
    ['scripts/test/r5-remote-testcontainers.mjs', ':apps:backend:catering-business-server:modules:workspace:test'],
    true,
  ],
  [
    'U04-asset',
    'node',
    ['scripts/test/r5-remote-testcontainers.mjs', ':apps:backend:catering-business-server:modules:asset:test'],
    true,
  ],
  [
    'U05-organization',
    'node',
    ['scripts/test/r5-remote-testcontainers.mjs', ':apps:backend:catering-business-server:modules:organization:test'],
    true,
  ],
  [
    'U06-workspace-iam',
    'node',
    ['scripts/test/r5-remote-testcontainers.mjs', ':apps:backend:catering-business-server:modules:workspace-iam:test'],
    true,
  ],
  [
    'U07-contract',
    'node',
    ['scripts/test/r5-remote-testcontainers.mjs', ':apps:backend:catering-business-server:modules:store-contract:test'],
    true,
  ],
  [
    'THCL-JAVA-audit-model',
    'node',
    ['scripts/test/r5-remote-testcontainers.mjs', ':apps:backend:catering-business-server:modules:audit-model:test'],
    true,
  ],
  [
    'THCL-JAVA-audit-read',
    'node',
    ['scripts/test/r5-remote-testcontainers.mjs', ':apps:backend:catering-business-server:modules:audit-read:test'],
    true,
  ],
  [
    'THCL-JAVA-catalog',
    'node',
    ['scripts/test/r5-remote-testcontainers.mjs', ':apps:backend:catering-business-server:modules:catalog:test'],
    true,
  ],
  [
    'THCL-JAVA-execution-context',
    'node',
    [
      'scripts/test/r5-remote-testcontainers.mjs',
      ':apps:backend:catering-business-server:modules:execution-context:test',
    ],
    true,
  ],
  [
    'THCL-JAVA-extension',
    'node',
    ['scripts/test/r5-remote-testcontainers.mjs', ':apps:backend:catering-business-server:modules:extension:test'],
    true,
  ],
  [
    'THCL-JAVA-foundation',
    'node',
    ['scripts/test/r5-remote-testcontainers.mjs', ':apps:backend:catering-business-server:modules:foundation:test'],
    true,
  ],
  [
    'THCL-JAVA-inventory',
    'node',
    ['scripts/test/r5-remote-testcontainers.mjs', ':apps:backend:catering-business-server:modules:inventory:test'],
    true,
  ],
  ['U08-platform-ui-test', 'yarn', ['--cwd', 'apps/frontend/platform-admin', 'test']],
  ['U08-platform-ui-build', 'yarn', ['--cwd', 'apps/frontend/platform-admin', 'build']],
  ['U09-operations-ui-test', 'yarn', ['--cwd', 'apps/frontend/operations-admin', 'test']],
  ['U09-operations-ui-build', 'yarn', ['--cwd', 'apps/frontend/operations-admin', 'build']],
  ['U10-affected-l2', 'scripts/check/affected-l2', []],
  ['U11-dev-check', 'scripts/dev/check', []],
  ['U11-seed-dry-run', 'scripts/dev/seed', ['--profile', 'r5-full', '--dry-run']],
  ['terminal-verify', 'yarn', ['workspace', '@catering-v2s/terminal', 'run', 'verify']],
];

function fail(reason) {
  throw new Error(reason);
}

function commandExecutable(root, command) {
  if (command === 'gradle') return resolveGradleCommand({root}).command;
  return command.includes('/') ? path.join(root, command) : command;
}

function spawnAndForward({root, command, args, spawnSyncImpl, env = process.env}) {
  const result = spawnSyncImpl(commandExecutable(root, command), args, {
    cwd: root,
    encoding: 'utf8',
    env: {...env},
    maxBuffer: childOutputBudgetBytes,
  });
  process.stdout.write(result?.stdout || '');
  process.stderr.write(result?.stderr || '');
  return result;
}

function runStaticCommand({root, commandTuple, spawnSyncImpl}) {
  const [label, command, args, successMarkers] = commandTuple;
  const result = spawnAndForward({root, command, args, spawnSyncImpl});
  if (result?.error) fail(`R5_VERIFY_STATIC_SPAWN_FAILURE:${label}`);
  if (result?.status !== 0) fail(`R5_VERIFY_STATIC_FIRST_FAILURE:${label}`);
  const output = `${result?.stdout || ''}\n${result?.stderr || ''}`;
  const missingMarker = successMarkers.find(marker => !output.includes(marker));
  if (missingMarker) fail(`R5_VERIFY_STATIC_MARKER_MISSING:${label}:${missingMarker}`);
}

function runStatic({root = repositoryRoot, commands = staticCommands, spawnSyncImpl = childProcess.spawnSync} = {}) {
  for (const commandTuple of commands) runStaticCommand({root, commandTuple, spawnSyncImpl});
  return {count: commands.length};
}

function parseMode(argv) {
  if (argv.length === 0) return 'normal';
  if (argv.length === 1 && argv[0] === '--validate-only') return 'validate-only';
  fail('VERIFY_ACCEPTS_ONLY_VALIDATE_ONLY_OR_NO_ARGUMENTS');
}

function runRuntimeCommand({root, commandTuple, spawnSyncImpl}) {
  const [label, command, args, remote = false] = commandTuple;
  const result = spawnAndForward({root, command, args, spawnSyncImpl});
  if (result?.error || result?.status !== 0) fail(`R5_VERIFY_FIRST_FAILURE:${label}`);
  if (remote && !String(result?.stdout || '').includes('CLEANUP=PASS'))
    fail(`R5_REMOTE_CLEANUP_NOT_CONFIRMED:${label}`);
  return remote;
}

async function runVerify({
  argv = process.argv.slice(2),
  root = repositoryRoot,
  spawnSyncImpl = childProcess.spawnSync,
} = {}) {
  const mode = parseMode(argv);
  const staticResult = runStatic({root, spawnSyncImpl});
  if (mode === 'validate-only') {
    console.log('R5_VERIFY_VALIDATE_ONLY=PASS');
    console.log(`EXECUTED=${staticResult.count}/${staticResult.count}`);
    console.log('CLEANUP=NOT_APPLICABLE_STATIC_ONLY');
    return {mode, ...staticResult};
  }

  let remoteExecuted = false;
  for (const commandTuple of runtimeCommands) {
    remoteExecuted = runRuntimeCommand({root, commandTuple, spawnSyncImpl}) || remoteExecuted;
  }
  console.log('R5_VERIFY=PASS');
  console.log('BUSINESS=UNVERIFIED_REQUIRES_R5_L3_AND_SEED_EVIDENCE');
  if (remoteExecuted) console.log('REMOTE_TESTCONTAINERS_CLEANUP=PASS');
  return {mode, ...staticResult};
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  runVerify().catch(error => {
    process.stderr.write(`R5_VERIFY=FAIL\nREASON=${error.message}\n`);
    process.exit(1);
  });
}

export {parseMode, runStatic, runVerify, runtimeCommands, staticCommands};
