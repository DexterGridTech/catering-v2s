import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';
import {PLATFORM_ADMIN_OPERATION_IDS} from '../../../app/api/generated/platform-edge';
const source = await readFile(new URL('./AdministratorStatusModal.tsx', import.meta.url), 'utf8');
describe('administrator status focused contract', () => it('uses an explicit owner transition and accessible confirmation controls', () => {
  expect(source).toContain(PLATFORM_ADMIN_OPERATION_IDS.transitionPlatformAdminStatus); expect(source).toContain('expectedVersion: admin.version'); expect(source).toContain("testId('platform-admin-status-confirm')"); expect(source).toContain('useSubmissionLifecycle');
}));
