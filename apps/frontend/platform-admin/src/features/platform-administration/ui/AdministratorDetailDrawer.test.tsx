import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';
const source = await readFile(new URL('./AdministratorDetailDrawer.tsx', import.meta.url), 'utf8');
describe('administrator detail focused contract', () => it('is the only entry to editor, credential and status surfaces', () => {
  expect(source).toContain("testId('platform-admin-detail-drawer')"); expect(source).toContain("testId('platform-admin-detail-edit')"); expect(source).toContain("testId('platform-admin-detail-credential')"); expect(source).toContain("testId('platform-admin-detail-status')"); expect(source).not.toContain('destroyOnHidden');
}));
