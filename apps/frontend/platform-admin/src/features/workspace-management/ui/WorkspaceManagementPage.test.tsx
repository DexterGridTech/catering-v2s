import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';
const source = await readFile(new URL('./WorkspaceManagementPage.tsx', import.meta.url), 'utf8');
describe('workspace management focused contract', () => it('uses catalog title and list-to-detail flow with no row operation column', () => {
  expect(source).toContain('workspacePageTitle'); expect(source).toContain('useDetailDrawer'); expect(source).toContain("testId(`platform-workspace-detail-${row.groupWorkspaceKey}`)"); expect(source).not.toMatch(/title:\s*['"]操作['"]/); expect(source).not.toContain('operationsUrl');
}));
