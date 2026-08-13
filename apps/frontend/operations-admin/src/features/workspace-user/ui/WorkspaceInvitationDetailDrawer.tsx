import {Button, Descriptions, Drawer, Space, Typography} from 'antd';
import {activeInvitationPageUrl, adminDetailDescriptionsProps, adminDrawerSurfaceProps, NameCodePathText, testId, useOverlayLock} from '@catering-v2s/admin-ui-foundation';
import {useState} from 'react';
import type {WorkspaceInvitation} from '../../../app/api/generated/operations-edge';
import {OperationsAuditHistoryModal} from '../../audit-history';

type Props = {
  open: boolean;
  invitation?: WorkspaceInvitation;
  canInvite: boolean;
  onClose: () => void;
  onRequestAction: (kind: 'cancel' | 'reissue') => void;
};

const statusLabel: Record<WorkspaceInvitation['status'], string> = {
  ACTIVE: '有效',
  CANCELLED: '已取消',
  EXPIRED: '已过期',
  COMPLETED: '已完成',
};

function time(value: number | null | undefined) {
  return value ? new Date(value).toLocaleString('zh-CN') : '—';
}

async function copy(value?: string) {
  if (!value || !globalThis.navigator?.clipboard) return;
  await globalThis.navigator.clipboard.writeText(value);
}

export function WorkspaceInvitationDetailDrawer({open, invitation, canInvite, onClose, onRequestAction}: Props) {
  const [auditOpen, setAuditOpen] = useState(false);
  useOverlayLock(open);
  const actionable = invitation?.status === 'ACTIVE' && canInvite;
  const invitationPageUrl = invitation ? activeInvitationPageUrl(invitation) : undefined;
  return <><Drawer
    title="邀请详情"
    open={open}
    onClose={onClose}
    size={640}
    destroyOnHidden
    maskClosable
    {...adminDrawerSurfaceProps}
    {...testId('operations-workspace-invitation-detail-drawer')}
    extra={invitation ? <Space>
      <Button onClick={() => setAuditOpen(true)} {...testId('operations-workspace-invitation-audit-history')}>操作历史</Button>
      {actionable && <Button onClick={() => onRequestAction('cancel')} {...testId('operations-workspace-invitation-cancel')}>取消邀请</Button>}
      {actionable && <Button type="primary" onClick={() => onRequestAction('reissue')} {...testId('operations-workspace-invitation-reissue')}>重新发送</Button>}
    </Space> : undefined}
  >
    {invitation && <Descriptions {...adminDetailDescriptionsProps} items={[
      {key: 'mobile', label: '邀请手机号', children: invitation.maskedMobile},
      {key: 'organization', label: '任职机构', children: <NameCodePathText value={invitation.targetOrganizationPath}/>},
      {key: 'roles', label: '业务角色', children: invitation.roleNames.join('、')},
      {key: 'status', label: '状态', children: statusLabel[invitation.status]},
      {key: 'expiresAt', label: '有效期', children: time(invitation.expiresAt)},
      ...(invitationPageUrl ? [{key: 'url', label: '邀请链接', children: <Space>
        <Typography.Text ellipsis={{tooltip: invitationPageUrl}} style={{maxWidth: 420}} {...testId('operations-workspace-invitation-link')}>{invitationPageUrl}</Typography.Text>
        <Button onClick={() => void copy(invitationPageUrl)} {...testId('operations-workspace-invitation-copy-link')}>复制</Button>
      </Space>}] : []),
    ]}/>}
  </Drawer><OperationsAuditHistoryModal open={auditOpen} target={invitation ? {entityType: 'WORKSPACE_INVITATION', entityId: invitation.id, displayName: <NameCodePathText value={invitation.targetOrganizationPath}/>} : undefined} groupWorkspaceKey={invitation?.groupWorkspaceKey ?? ''} onClose={() => setAuditOpen(false)}/></>;
}
