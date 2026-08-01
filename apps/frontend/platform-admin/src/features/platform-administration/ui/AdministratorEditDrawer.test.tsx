import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';
import {PLATFORM_ADMIN_OPERATION_IDS} from '../../../app/api/generated/platform-edge';
const source = await readFile(new URL('./AdministratorEditDrawer.tsx', import.meta.url), 'utf8');
describe('administrator edit focused contract', () => it('keeps login identity read-only and updates only profile facts with owner version', () => {
  expect(source).toContain(PLATFORM_ADMIN_OPERATION_IDS.updatePlatformAdminProfile); expect(source).toContain('expectedVersion: admin.version'); expect(source).toContain('value={admin?.loginName} disabled'); expect(source).toContain("testId('platform-admin-edit-submit')");
}));
