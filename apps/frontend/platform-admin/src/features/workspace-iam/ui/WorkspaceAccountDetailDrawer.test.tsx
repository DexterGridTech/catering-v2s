import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';

const source = await readFile(new URL('./WorkspaceAccountDetailDrawer.tsx', import.meta.url), 'utf8');
describe('workspace account detail focused contract', () => {
  it('keeps account actions in the detail surface, removes the assignment operation column, and requires explicit active-assignment selection before revoke confirmation', () => {
    expect(source).toContain('rowSelection={{type: \'radio\'');
    expect(source).toContain("assignment.status !== 'ACTIVE'");
    expect(source).toContain("testId('workspace-account-revoke-selected-assignment')");
    expect(source).toContain("kind: 'REVOKE_ASSIGNMENT'");
    expect(source).not.toMatch(/title:\s*['"]撤销任职['"]/);
    expect(source).not.toMatch(/title:\s*['"]操作['"]/);
    expect(source).not.toContain('destroyOnHidden');
  });
});
