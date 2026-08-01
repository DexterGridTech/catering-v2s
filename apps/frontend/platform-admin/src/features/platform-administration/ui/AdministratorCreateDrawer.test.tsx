import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';
import {PLATFORM_ADMIN_OPERATION_IDS} from '../../../app/api/generated/platform-edge';
const source = await readFile(new URL('./AdministratorCreateDrawer.tsx', import.meta.url), 'utf8');
describe('administrator creation focused contract', () => it('clears password proof, validates confirmation and submits the owner command', () => {
  expect(source).toContain("form.resetFields(['password', 'confirmation'])"); expect(source).toContain(PLATFORM_ADMIN_OPERATION_IDS.createPlatformAdmin); expect(source).toContain("testId('platform-admin-create-password')"); expect(source).toContain("testId('platform-admin-create-submit')");
}));
