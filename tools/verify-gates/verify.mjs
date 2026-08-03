#!/usr/bin/env node
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const validateOnly = process.argv.length === 3 && process.argv[2] === '--validate-only';
if (process.argv.length !== 2 && !validateOnly) {
  process.stderr.write('R5_VERIFY=FAIL\nREASON=VERIFY_ACCEPTS_NO_SELF_TEST_OR_EXTRA_ARGUMENTS\n');
  process.exit(2);
}
const commands = [
  ['U01-openapi', 'scripts/check/openapi-contracts', []], ['U01-face', 'scripts/check/contract-face', []], ['U01-codegen', 'scripts/check/edge-codegen', []], ['U01-retirement', 'scripts/check/retirement', []],
  ['U02-backend', 'node', ['scripts/test/r5-remote-testcontainers.mjs', ':apps:backend:catering-business-server:test'], true], ['U02-boundary', 'scripts/check/backend-boundaries', []], ['U02-database', 'scripts/check/database-boundaries', []], ['U02-flyway', 'scripts/check/flyway-layout', []],
  ['U03-platform-iam', 'node', ['scripts/test/r5-remote-testcontainers.mjs', ':apps:backend:catering-business-server:modules:platform-admin-iam:test'], true],
  ['U04-workspace', 'node', ['scripts/test/r5-remote-testcontainers.mjs', ':apps:backend:catering-business-server:modules:workspace:test'], true],
  ['U04-asset', 'node', ['scripts/test/r5-remote-testcontainers.mjs', ':apps:backend:catering-business-server:modules:asset:test'], true],
  ['U05-organization', 'node', ['scripts/test/r5-remote-testcontainers.mjs', ':apps:backend:catering-business-server:modules:organization:test'], true], ['U06-workspace-iam', 'node', ['scripts/test/r5-remote-testcontainers.mjs', ':apps:backend:catering-business-server:modules:workspace-iam:test'], true], ['U07-contract', 'node', ['scripts/test/r5-remote-testcontainers.mjs', ':apps:backend:catering-business-server:modules:store-contract:test'], true],
  ['U08-platform-ui-test', 'yarn', ['--cwd', 'apps/frontend/platform-admin', 'test']], ['U08-platform-ui-build', 'yarn', ['--cwd', 'apps/frontend/platform-admin', 'build']],
  ['U09-operations-ui-test', 'yarn', ['--cwd', 'apps/frontend/operations-admin', 'test']], ['U09-operations-ui-build', 'yarn', ['--cwd', 'apps/frontend/operations-admin', 'build']],
  ['U10-frontend-architecture', 'scripts/check/frontend-architecture', []], ['U10-affected-l2', 'scripts/check/affected-l2', []],
  ['U11-dev-check', 'scripts/dev/check', []], ['U11-seed-dry-run', 'scripts/dev/seed', ['--profile', 'r5-full', '--dry-run']], ['U12-standards', 'scripts/check/standards-coverage', ['--phase', 'R5']]
];
function run(label, command, args, env, remote = false) {
  const executable = command.includes('/') ? path.join(root, command) : command;
  const result = spawnSync(executable, args, {cwd: root, encoding: 'utf8', env});
  process.stdout.write(result.stdout || ''); process.stderr.write(result.stderr || '');
  if (result.status !== 0) throw new Error(`R5_VERIFY_FIRST_FAILURE:${label}`);
  if (remote && !String(result.stdout || '').includes('CLEANUP=PASS')) throw new Error(`R5_REMOTE_CLEANUP_NOT_CONFIRMED:${label}`);
}
try {
  const env = {...process.env};
  for (const [label, command, args, remote] of commands) {
    if (validateOnly && label === 'U12-standards') continue;
    run(label, command, args, env, remote);
  }
  process.stdout.write(validateOnly ? 'R5_VERIFY_VALIDATE_ONLY=PASS\nREMOTE_TESTCONTAINERS_CLEANUP=PASS\n' : 'R5_VERIFY=PASS\nBUSINESS=UNVERIFIED_REQUIRES_R5_L3_AND_SEED_EVIDENCE\nREMOTE_TESTCONTAINERS_CLEANUP=PASS\n');
} catch (error) { process.stderr.write(`R5_VERIFY=FAIL\nREASON=${error.message}\n`); process.exit(1); }
