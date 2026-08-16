import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = name =>
  fs.readFileSync(new URL(`../../features/platform-administration/ui/${name}`, import.meta.url), 'utf8');
const page = source('AdministratorsPage.tsx');
const create = source('AdministratorCreateDrawer.tsx');
const edit = source('AdministratorEditDrawer.tsx');
const credential = source('AdministratorCredentialDrawer.tsx');
const status = source('AdministratorStatusModal.tsx');
const detail = source('AdministratorDetailDrawer.tsx');

test('platform administrator actions remain detail-first, generated-client-only surfaces', () => {
  assert.match(page, /AdministratorDetailDrawer/);
  assert.match(page, /detail\.close\(\);/);
  assert.match(page, /AdministratorCreateDrawer/);
  assert.match(page, /AdministratorEditDrawer/);
  assert.match(page, /AdministratorCredentialDrawer/);
  assert.match(page, /AdministratorStatusModal/);
  assert.match(page, /platform-admin-create/);
  assert.match(page, /platform-admin-detail-/);
  assert.doesNotMatch(page, /fetch\(|createApi\(|createSlice\(|useDispatch\(|useSelector\(/);
  assert.doesNotMatch(page, /columns={[\s\S]*title:\s*['"]操作['"]/);
  assert.match(page + detail, /PlatformAuditHistoryModal|onAudit/);
  assert.match(detail, /platform-admin-detail-audit-history/);
});

test('administrator write surfaces reuse drawer lifecycles and never substitute anonymous recovery', () => {
  for (const candidate of [create, edit, credential]) {
    assert.match(candidate, /useDrawerFormLifecycle/);
    assert.match(candidate, /Idempotency-Key/);
    assert.doesNotMatch(
      candidate,
      /fetch\(|platformHttpProtocol|startPlatformPasswordRecovery|completePlatformPasswordRecovery/,
    );
  }
  assert.match(create, /platformClient\.createPlatformAdmin/);
  assert.match(edit, /platformClient\.updatePlatformAdminProfile/);
  assert.match(credential, /platformClient\.resetPlatformAdminCredential/);
  assert.match(status, /platformClient\.transitionPlatformAdminStatus/);
  assert.match(status, /useOverlayLock/);
  assert.doesNotMatch(status, /活动会话将失效/);
  assert.match(detail, /useOverlayLock/);
  assert.match(create + edit + credential, /testId/);
  assert.match(credential, /admin\?\.loginName/);
  assert.match(create + credential, /clearSecrets/);
  assert.doesNotMatch(credential + detail, /password:\s*admin|password.*readback/i);
});
