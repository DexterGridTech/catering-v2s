import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';
const source = await readFile(new URL('./AdministratorsPage.tsx', import.meta.url), 'utf8');
describe('administrator list focused contract', () => it('uses catalog title, owner filters and name-to-detail flow without an operation column', () => {
  expect(source).toContain('administratorPageTitle'); expect(source).toContain("testId('platform-admin-filter-login-name')"); expect(source).toContain("testId(`platform-admin-detail-${row.id}`)"); expect(source).toContain('useDetailDrawer'); expect(source).not.toMatch(/title:\s*['"]操作['"]/);
}));
