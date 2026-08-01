import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';
const source = await readFile(new URL('./AccountsPage.tsx', import.meta.url), 'utf8');
describe('workspace accounts focused contract', () => it('opens a fresh owner detail from the name link and keeps all commands in dedicated action surfaces', () => {
  expect(source).toContain('platformClient.getWorkspaceAccount'); expect(source).toContain('useAsyncGenerationGuard'); expect(source).toContain("testId(`workspace-account-detail-${row.id}`)"); expect(source).toContain('WorkspaceAccountActionModal'); expect(source).not.toMatch(/title:\s*['"]操作['"]/);
  expect(source).not.toContain('InvitationsPage'); expect(source).not.toContain("label: '邀请'"); expect(source).not.toContain('workspace-account-tabs');
}));
