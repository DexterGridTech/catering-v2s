import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';
const source = await readFile(new URL('./WorkspaceAdministrationPage.tsx', import.meta.url), 'utf8');
describe('workspace overview focused contract', () => it('uses the catalog page title and keeps source-unavailable recovery explicit and test-addressable', () => {
  expect(source).toContain('workspaceOverviewPage = adminCatalog.platformPages.find'); expect(source).toContain('contextScopedQueryArgs'); expect(source).toContain("testId('workspace-overview-retry')"); expect(source).toContain("testId('workspace-overview-refresh')"); expect(source).toContain('资料暂时无法获取');
}));
