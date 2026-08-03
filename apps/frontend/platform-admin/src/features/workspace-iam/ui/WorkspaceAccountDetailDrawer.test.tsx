import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';

const source = await readFile(new URL('./WorkspaceAccountDetailDrawer.tsx', import.meta.url), 'utf8');
describe('workspace account detail focused contract', () => {
  it('keeps the IA-required revoke affordance on each active assignment row', () => {
    expect(source).toContain("title: '撤销任职'");
    expect(source).toContain("assignment.status === 'ACTIVE'");
    expect(source).toContain("testId(`workspace-account-revoke-assignment-${assignment.id}`)");
    expect(source).toContain("kind: 'REVOKE_ASSIGNMENT'");
    expect(source).not.toMatch(/title:\s*['"]操作['"]/);
    expect(source).not.toContain('destroyOnHidden');
    expect(source).not.toContain('destroyOnClose');
    expect(source).toContain("label: '手机号', children: account.mobile");
    expect(source).toContain("label: '最后登录时间'");
    expect(source).toContain("workspace-account-authentication-history");
    expect(source).toContain("emptyText: '暂无登录历史'");
    expect(source).toContain('authenticationHistory');
  });
});
