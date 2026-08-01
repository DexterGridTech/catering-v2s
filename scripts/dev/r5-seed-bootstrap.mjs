#!/usr/bin/env node
/** R5's sole direct-SQL seed exception: a built-in DEV root identity, its bcrypt credential, audit fact and receipt. */
import {spawnSync} from 'node:child_process';
import crypto from 'node:crypto';
import {existsSync, readFileSync} from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const runtime = path.resolve(process.env.V2S_RUNTIME_DIR ?? path.join(root, '.runtime/r5'));
const credentialsPath = path.join(runtime, 'credentials.env');
const environmentScript = path.join(root, 'scripts/dev/r5-dev-environment.mjs');
const rootId = '00000000-0000-4000-8000-000000000001';
const auditId = '00000000-0000-4000-8000-000000000002';
const receiptKey = 'r5-v1-bootstrap-root';
const fixedEpochMillis = 1784908800000;

const fail = (reason) => { process.stderr.write(`R5_SEED_BOOTSTRAP=REFUSED; REASON=${reason}\n`); process.exit(2); };
const command = (binary, args, options = {}) => {
  const result = spawnSync(binary, args, {cwd: root, encoding: 'utf8', ...options});
  if (result.status !== 0) fail(`${binary}:${(result.stderr || result.stdout || 'FAILED').trim().replace(/\s+/g, '_').slice(0, 200)}`);
  return result.stdout;
};
const sqlLiteral = (value) => `'${String(value).replaceAll("'", "''")}'`;

if (!existsSync(credentialsPath)) fail('MANAGED_CREDENTIALS_REQUIRED');
const credentials = Object.fromEntries(readFileSync(credentialsPath, 'utf8').trim().split('\n').filter(Boolean).map((line) => line.split('=', 2)));
if (credentials.V2S_SEED_PLATFORM_ROOT_PASSWORD !== 'root') fail('ROOT_PASSWORD_MUST_BE_FIXED_ROOT');
const environment = JSON.parse(command(process.execPath, [environmentScript, 'seed', '--json'], {env: {...process.env, ...credentials}}));
if (!/^catering_v2s_dev_[a-z0-9_]{3,32}$/.test(environment.expectedDatabase ?? '')) fail('DEV_DATABASE_NOT_ALLOWLISTED');
if (!environment.environment?.V2S_DEV_REMOTE_HOST || !/^[a-z0-9._-]{3,128}$/.test(environment.environment.V2S_DEV_REMOTE_HOST)) fail('DEV_REMOTE_HOST_NOT_ALLOWLISTED');
const bcryptLine = command('/usr/sbin/htpasswd', ['-nBiC', '10', ''], {input: 'root\n'}).trim();
const passwordHash = bcryptLine.startsWith(':') ? bcryptLine.slice(1) : '';
if (!/^\$2[aby]\$10\$[./A-Za-z0-9]{53}$/.test(passwordHash)) fail('BCRYPT_HASH_INVALID');
const receiptHash = crypto.createHash('sha256').update('r5-root-bootstrap-v1', 'utf8').digest('hex');
const sql = `
BEGIN;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM platform_iam.platform_admin) THEN
    RAISE EXCEPTION 'R5_SEED_BOOTSTRAP_REQUIRES_EMPTY_PLATFORM_ADMIN';
  END IF;
END $$;
INSERT INTO platform_iam.platform_admin (id, login_name, login_name_normalized, display_name, mobile_mask_source, status, version, created_at_epoch_millis, updated_at_epoch_millis, is_builtin)
VALUES (${sqlLiteral(rootId)}::uuid, 'root', 'root', 'Root', NULL, 'ENABLED', 1, ${fixedEpochMillis}, ${fixedEpochMillis}, TRUE);
INSERT INTO platform_iam.platform_credential (platform_admin_id, password_hash, algorithm, changed_at_epoch_millis, failed_attempts, locked_until_epoch_millis, version)
VALUES (${sqlLiteral(rootId)}::uuid, ${sqlLiteral(passwordHash)}, 'bcrypt', ${fixedEpochMillis}, 0, NULL, 1);
INSERT INTO platform_iam.audit_event (id, entity_type, entity_ref_text, actor_type, actor_id, actor_display_snapshot, action, occurred_at_epoch_millis, changes_json)
VALUES (${sqlLiteral(auditId)}::uuid, 'PLATFORM_ADMIN', ${sqlLiteral(rootId)}, 'SYSTEM', NULL, '系统', 'DEV_ROOT_BOOTSTRAPPED', ${fixedEpochMillis}, '[]'::jsonb);
INSERT INTO platform_iam.platform_command_receipt (idempotency_key, request_hash, response_json, created_at_epoch_millis)
VALUES (${sqlLiteral(receiptKey)}, ${sqlLiteral(receiptHash)}, jsonb_build_object('platformAdminId', ${sqlLiteral(rootId)}, 'loginName', 'root', 'builtIn', true), ${fixedEpochMillis});
COMMIT;
`;
const remote = spawnSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', environment.environment.V2S_DEV_REMOTE_HOST, `docker exec -i catering-postgres psql -U catering -d ${environment.expectedDatabase} -v ON_ERROR_STOP=1 -q`], {cwd: root, encoding: 'utf8', input: sql});
if (remote.status !== 0) fail(`BOOTSTRAP_SQL:${(remote.stderr || remote.stdout || 'FAILED').trim().replace(/\s+/g, '_').slice(0, 200)}`);
process.stdout.write(`R5_SEED_BOOTSTRAP=PASS; LOGIN=root; PLATFORM_ADMIN_ID=${rootId}; AUDIT=PASS; RECEIPT=PASS\n`);
