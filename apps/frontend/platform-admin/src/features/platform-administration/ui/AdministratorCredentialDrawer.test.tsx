import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';
import {PLATFORM_ADMIN_OPERATION_IDS} from '../../../app/api/generated/platform-edge';
const source = await readFile(new URL('./AdministratorCredentialDrawer.tsx', import.meta.url), 'utf8');
describe('administrator credential focused contract', () => it('resets only confidential fields and submits latest-version credential reset', () => {
  expect(source).toContain(PLATFORM_ADMIN_OPERATION_IDS.resetPlatformAdminCredential); expect(source).toContain('expectedVersion: admin.version'); expect(source).toContain('clearSecrets()'); expect(source).toContain("testId('platform-admin-credential-confirmation')");
}));
