import {Button, Descriptions, Drawer, Space, Table, Tag, Typography} from 'antd';
import {adminDrawerSurfaceProps, testId, useOverlayLock} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useState} from 'react';
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

/** The detail readback is the only source for account and assignment actions. */
export function WorkspaceAccountDetailDrawer({open, loading, account, onClose, onAfterOpenChange, onOpenAction, onAudit}: Props) {
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>();
  useEffect(() => setSelectedAssignmentId(undefined), [account?.id, account?.revision]);
  useOverlayLock(open);
  const selectedAssignment = account?.assignments.find((assignment) => assignment.id === selectedAssignmentId && assignment.status === 'ACTIVE');
  return <Drawer
    title="账号详情"
    open={open}
    loading={loading}
    width={640}
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
      <Button danger disabled={!selectedAssignment} onClick={() => selectedAssignment && onOpenAction({kind: 'REVOKE_ASSIGNMENT', assignment: selectedAssignment})} {...testId('workspace-account-revoke-selected-assignment')}>撤销所选任职</Button>
    </Space>}
  >
    {account && <>
      <Descriptions bordered size="small" column={1} items={[
        {key: 'name', label: '姓名', children: account.displayName},
        {key: 'login-name', label: '登录账号', children: account.loginName},
        {key: 'status', label: '状态', children: accountStatusLabel(account.status)},
      ]}/>
      <Typography.Title level={5}>任职</Typography.Title>
      <div {...testId('workspace-account-assignment-table')}><Table<WorkspaceAccount['assignments'][number]>
        rowKey="id"
        size="small"
        pagination={false}
        dataSource={account.assignments}
        rowSelection={{type: 'radio', selectedRowKeys: selectedAssignmentId ? [selectedAssignmentId] : [], onChange: (keys) => setSelectedAssignmentId(keys.length ? String(keys[0]) : undefined), getCheckboxProps: (assignment) => ({disabled: assignment.status !== 'ACTIVE'})}}
        columns={[
          {title: '任职机构', dataIndex: 'organizationPath'},
          {title: '业务角色', dataIndex: 'roleName'},
          {title: '状态', render: (_, assignment) => <Tag>{assignmentStatusLabel(assignment.status)}</Tag>},
        ]}
      /></div>
    </>}
  </Drawer>;
}
