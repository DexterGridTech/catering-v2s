import {Button, Descriptions, Drawer, Space, Table, Tag, Typography} from 'antd';
import {adminDrawerSurfaceProps, NameCodePathText, testId, useOverlayLock} from '@catering-v2s/admin-ui-foundation';
import type {WorkspaceAccount} from '../../../app/api/generated/platform-edge';

export type WorkspaceAccountAction =
  | {kind: 'STATUS'; targetStatus: 'ENABLED' | 'DISABLED'}
  | {kind: 'CREDENTIAL_RESET'}
  | {kind: 'REVOKE_ASSIGNMENT'; assignment: WorkspaceAccount['assignments'][number]};

type Props = {
  open: boolean;
  loading: boolean;
  account?: WorkspaceAccount;
  onClose: () => void;
  onAfterOpenChange: (open: boolean) => void;
  onOpenAction: (action: WorkspaceAccountAction) => void;
  onAudit: () => void;
};

const accountStatusLabel = (status: WorkspaceAccount['status']) => status === 'ENABLED' ? '启用' : '停用';
const assignmentStatusLabel = (status: WorkspaceAccount['assignments'][number]['status']) => status === 'ACTIVE' ? '有效' : '已撤销';
const time = (value: number | null | undefined) => value ? new Date(value).toLocaleString('zh-CN') : '—';

/** The detail readback is the only source for account and assignment actions. */
export function WorkspaceAccountDetailDrawer({open, loading, account, onClose, onAfterOpenChange, onOpenAction, onAudit}: Props) {
  useOverlayLock(open);
  return <Drawer
    title="账号详情"
    open={open}
    loading={loading}
    size={640}
    onClose={onClose}
    afterOpenChange={onAfterOpenChange}
    {...adminDrawerSurfaceProps}
    {...testId('workspace-account-detail-drawer')}
    extra={account && <Space>
      <Button onClick={onAudit} {...testId('workspace-account-audit-history')}>操作历史</Button>
      <Button onClick={() => onOpenAction({kind: 'CREDENTIAL_RESET'})} {...testId('workspace-account-reset-credential')}>重置登录凭据</Button>
      <Button onClick={() => onOpenAction({kind: 'STATUS', targetStatus: account.status === 'ENABLED' ? 'DISABLED' : 'ENABLED'})} {...testId('workspace-account-transition-status')}>
        {account.status === 'ENABLED' ? '停用账号' : '启用账号'}
      </Button>
    </Space>}
  >
    {account && <>
      <Descriptions bordered size="small" column={1} items={[
        {key: 'name', label: '姓名', children: account.displayName},
        {key: 'mobile', label: '手机号', children: account.mobile},
        {key: 'login-name', label: '登录账号', children: account.loginName},
        {key: 'status', label: '状态', children: accountStatusLabel(account.status)},
        {key: 'last-login', label: '最后登录时间', children: time(account.lastLoginAt)},
      ]}/>
      <Typography.Title level={5}>任职</Typography.Title>
      <div {...testId('workspace-account-assignment-table')}><Table<WorkspaceAccount['assignments'][number]>
        rowKey="id"
        size="small"
        pagination={false}
        dataSource={account.assignments}
        columns={[
          {title: '任职机构', dataIndex: 'organizationPath', render: (_, assignment) => <NameCodePathText value={assignment.organizationPath}/>},
          {title: '业务角色', dataIndex: 'roleName'},
          {title: '状态', render: (_, assignment) => <Tag>{assignmentStatusLabel(assignment.status)}</Tag>},
          {title: '撤销任职', key: 'revoke', render: (_, assignment) => assignment.status === 'ACTIVE' ? <Button type="link" danger size="small" onClick={() => onOpenAction({kind: 'REVOKE_ASSIGNMENT', assignment})} {...testId(`workspace-account-revoke-assignment-${assignment.id}`)}>撤销任职</Button> : null},
        ]}
      /></div>
      <Typography.Title level={5}>登录历史</Typography.Title>
      <div {...testId('workspace-account-authentication-history')}><Table<WorkspaceAccount['authenticationHistory'][number]>
        rowKey={(_, index) => `${index}`}
        size="small"
        pagination={false}
        dataSource={account.authenticationHistory}
        locale={{emptyText: '暂无登录历史'}}
        columns={[{title: '成功登录时间', dataIndex: 'authenticatedAt', render: (_, history) => time(history.authenticatedAt)}]}
      /></div>
    </>}
  </Drawer>;
}
