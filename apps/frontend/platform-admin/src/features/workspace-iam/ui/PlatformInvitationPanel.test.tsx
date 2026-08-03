import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';

const source = await readFile(new URL('./PlatformInvitationPanel.tsx', import.meta.url), 'utf8');

describe('permanent platform invitation centre focused contract', () => {
  it('keeps the complete cross-node list, cascade and owner-refresh path', () => {
    expect(source).toContain("title: '任职机构类型'");
    expect(source).toContain("title: '任职机构'");
    expect(source).toContain("title: '发起时间'");
    expect(source).toContain("title: '邀请链接'");
    expect(source).toContain('function operationsInvitationUrl(invitationPageUrl: string | null | undefined)');
    expect(source).toContain('if (!invitationPageUrl) return undefined;');
    expect(source).toContain('const href = operationsInvitationUrl(row.invitationPageUrl);');
    expect(source).toContain('VITE_OPERATIONS_ADMIN_ORIGIN');
    expect(source).toContain('管理当前集团空间任意组织节点的邀请');
    expect(source).toContain("testId('platform-invitation-query-submit')");
    expect(source).toContain("searchConfig.form?.submit()");
    expect(source).toContain("testId('platform-invitation-query-reset')");
    expect(source).toContain("if (!sorter?.order)");
    expect(source).toContain("form.setFieldValue('targetOrganizationRef', undefined)");
    expect(source).toContain("form.setFieldValue('roleIds', [])");
    expect(source).toContain('useGetWorkspaceInvitationCandidatesQuery');
    expect(source).toContain('onChanged={() => void invitations.refetch()}');
    expect(source).toContain('platformClient.createWorkspaceInvitation');
    expect(source).toContain('platformClient.cancelWorkspaceInvitation');
    expect(source).toContain('platformClient.reissueWorkspaceInvitation');
    expect(source).toContain('formatCodeNamePath(candidate.path)');
    expect(source).toContain('formatCodeNamePath(row.targetOrganizationPath)');
    expect(source).toContain('formatCodeNamePath(invitation.targetOrganizationPath)');
    expect(source).toContain('const latest = await platformClient.getWorkspaceInvitation');
    expect(source).toContain('expectedVersion: latest.revision');
    expect(source).toContain("label: '发起人', children: invitation.issuerDisplayName");
    expect(source).toContain("label: '邀请手机号', children: invitation.mobile");
    expect(source).toContain('邀请详情暂时无法读取');
  });
});
