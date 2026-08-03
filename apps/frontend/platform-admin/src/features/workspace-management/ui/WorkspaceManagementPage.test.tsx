import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';
const source = await readFile(new URL('./WorkspaceManagementPage.tsx', import.meta.url), 'utf8');
describe('workspace management focused contract', () => it('uses catalog title and list-to-detail flow with no row operation column', () => {
  expect(source).toContain('workspacePageTitle'); expect(source).toContain('title={<Typography.Paragraph'); expect(source).not.toContain('title={workspacePageTitle}'); expect(source).toContain('useDetailDrawer'); expect(source).toContain('detail.openLoading()'); expect(source).toContain('loading={detail.loading}'); expect(source).toContain('adminListState'); expect(source).toContain("testId('platform-workspace-list-error')"); expect(source).toContain("testId('platform-workspace-table')"); expect(source).toContain("testId(`platform-workspace-detail-${row.groupWorkspaceKey}`)"); expect(source).toContain("title: '运营后台地址'"); expect(source).toContain("打开运营后台"); expect(source).not.toMatch(/title:\s*['"]操作['"]/); expect(source).not.toContain('operationsUrl');
}));
