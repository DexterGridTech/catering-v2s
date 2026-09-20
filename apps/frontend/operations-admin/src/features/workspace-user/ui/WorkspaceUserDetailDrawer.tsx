import {Alert, Button, Descriptions, Drawer, Space, Tag} from 'antd';
import {
  AdminDetailActionLabel,
  AdminDetailActionMenu,
  adminDetailDescriptionsProps,
  adminDrawerSurfaceProps,
  formatCanonicalDateTime,
  NameCodePathText,
  testId,
  useOverlayLock,
} from '@catering-v2s/admin-ui-foundation';
import type {WorkspaceUser} from '../../../app/api/generated/operations-edge';
import {operationsDetailDrawerTestIds} from '../../../app/automation/operationsDetailDrawerTestIds';

type Props = {
  open: boolean;
  loading: boolean;
  problem?: string;
  pageTitle: string;
  user?: WorkspaceUser;
  canRevoke: boolean;
  revoking: boolean;
  onClose: () => void;
  onOpenAudit: () => void;
  onRequestRevoke: (assignment: WorkspaceUser['assignments'][number]) => void;
};

function detailTitle(pageTitle: string) {
  return pageTitle.endsWith('用户管理')
    ? `${pageTitle.slice(0, -2)}任职详情`
    : pageTitle.endsWith('用户')
      ? `${pageTitle}任职详情`
      : `${pageTitle}详情`;
}

function assignmentSummary(user?: WorkspaceUser) {
  const assignments = user?.assignments ?? [];
  const organizations = Array.from(
    new Map(
      assignments.map(assignment => [
        assignment.organizationPathNodes.map(node => node.ref).join('|'),
        assignment.organizationPathNodes,
      ]),
    ).values(),
  );
  return {
    organizations,
    roles: Array.from(new Set(assignments.map(assignment => assignment.roleName))),
    joinedAt: assignments.reduce<number | undefined>(
      (earliest, assignment) =>
        earliest === undefined ? assignment.createdAt : Math.min(earliest, assignment.createdAt),
      undefined,
    ),
    status: assignments.every(assignment => assignment.status === 'ACTIVE')
      ? '启用'
      : assignments.some(assignment => assignment.status === 'ACTIVE')
        ? '部分启用'
        : '已撤销',
  };
}

function time(value?: number) {
  return formatCanonicalDateTime(value);
}

export function WorkspaceUserDetailDrawer({
  open,
  loading,
  problem,
  pageTitle,
  user,
  canRevoke,
  revoking,
  onClose,
  onOpenAudit,
  onRequestRevoke,
}: Props) {
  useOverlayLock(open);
  const summary = assignmentSummary(user);
  const actionItems = user
    ? [
        {
          key: 'audit',
          label: (
            <AdminDetailActionLabel testIdValue={operationsDetailDrawerTestIds.workspaceUser.audit}>
              操作历史
            </AdminDetailActionLabel>
          ),
          onClick: onOpenAudit,
        },
      ]
    : [];
  return (
    <Drawer
      title={detailTitle(pageTitle)}
      open={open}
      loading={loading}
      onClose={onClose}
      size={640}
      destroyOnHidden
      maskClosable
      {...adminDrawerSurfaceProps}
      {...testId('operations-workspace-user-detail-drawer')}
      extra={
        actionItems.length > 0 ? (
          <AdminDetailActionMenu
            items={actionItems}
            triggerTestId={operationsDetailDrawerTestIds.workspaceUser.actionMenu}
          />
        ) : undefined
      }
    >
      {problem && !user && (
        <Alert
          type="error"
          showIcon
          title="详情加载失败"
          description={problem}
          {...testId('operations-workspace-user-detail-problem')}
        />
      )}
      {user && (
        <>
          <Descriptions
            {...adminDetailDescriptionsProps}
            items={[
              {key: 'name', label: '姓名', children: user.displayName},
              {key: 'loginName', label: '登录账号', children: user.loginName},
              {
                key: 'organizations',
                label: '任职机构',
                children:
                  summary.organizations.length > 0 ? (
                    <Space size={[4, 4]} wrap>
                      {summary.organizations.map((nodes, index) => (
                        <Tag key={nodes.map(node => node.ref).join('|') || `organization-${index}`}>
                          <NameCodePathText nodes={nodes} />
                        </Tag>
                      ))}
                    </Space>
                  ) : (
                    '—'
                  ),
              },
              {
                key: 'roles',
                label: '业务角色',
                children:
                  summary.roles.length > 0 ? (
                    <Space size={[4, 4]} wrap>
                      {summary.roles.map(value => (
                        <Tag key={value}>{value}</Tag>
                      ))}
                    </Space>
                  ) : (
                    '—'
                  ),
              },
              {key: 'status', label: '状态', children: summary.status},
              {key: 'joinedAt', label: '加入时间', children: time(summary.joinedAt)},
            ]}
          />
          <Space orientation="vertical" style={{width: '100%', marginTop: 16}} size={12}>
            {user.assignments.map(assignment => (
              <Space key={assignment.id} wrap style={{justifyContent: 'space-between', width: '100%'}}>
                <Space size={[4, 4]} wrap>
                  <Tag>
                    <NameCodePathText nodes={assignment.organizationPathNodes} />
                  </Tag>
                  <Tag>{assignment.roleName}</Tag>
                  <Tag color={assignment.status === 'ACTIVE' ? 'success' : 'default'}>
                    {assignment.status === 'ACTIVE' ? '启用' : '已撤销'}
                  </Tag>
                </Space>
                {canRevoke && assignment.status === 'ACTIVE' && (
                  <Button
                    danger
                    size="small"
                    loading={revoking}
                    onClick={() => onRequestRevoke(assignment)}
                    {...testId(`operations-workspace-user-detail-revoke-${assignment.id}`)}
                  >
                    撤销任职
                  </Button>
                )}
              </Space>
            ))}
          </Space>
        </>
      )}
    </Drawer>
  );
}
