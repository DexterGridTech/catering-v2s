import {Alert, Descriptions, Drawer} from 'antd';
import {
  AdminDetailActionLabel,
  AdminDetailActionMenu,
  adminDrawerSurfaceProps,
  formatCanonicalDateTime,
  LIFECYCLE_LABELS,
  testId,
  useOverlayLock,
} from '@catering-v2s/admin-ui-foundation';
import type {PlatformAdminDetail} from '../../../app/api/generated/platform-edge';
import {platformDetailDrawerTestIds} from '../../../app/automation/platformDetailDrawerTestIds';

export function AdministratorDetailDrawer({
  open,
  loading,
  problem,
  admin,
  onClose,
  onAfterOpenChange,
  onEdit,
  onCredential,
  onStatus,
  onAudit,
}: {
  open: boolean;
  loading: boolean;
  problem?: {title: string; detail: string};
  admin?: PlatformAdminDetail;
  onClose: () => void;
  onAfterOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onCredential: () => void;
  onStatus: () => void;
  onAudit: () => void;
}) {
  useOverlayLock(open);
  const actionItems = admin
    ? [
        {
          key: 'audit',
          label: (
            <AdminDetailActionLabel testIdValue={platformDetailDrawerTestIds.administrator.audit}>
              操作历史
            </AdminDetailActionLabel>
          ),
          onClick: onAudit,
        },
        {
          key: 'edit',
          label: (
            <AdminDetailActionLabel testIdValue={platformDetailDrawerTestIds.administrator.edit}>
              编辑
            </AdminDetailActionLabel>
          ),
          onClick: onEdit,
        },
        {
          key: 'credential',
          label: (
            <AdminDetailActionLabel testIdValue={platformDetailDrawerTestIds.administrator.credential}>
              重置登录凭据
            </AdminDetailActionLabel>
          ),
          onClick: onCredential,
        },
        {
          key: 'status',
          danger: admin.status === 'ACTIVE',
          label: (
            <AdminDetailActionLabel testIdValue={platformDetailDrawerTestIds.administrator.status}>
              {admin.status === 'ACTIVE' ? '停用' : '启用'}
            </AdminDetailActionLabel>
          ),
          onClick: onStatus,
        },
      ]
    : [];
  return (
    <Drawer
      title="管理员详情"
      open={open}
      loading={loading}
      onClose={onClose}
      maskClosable
      afterOpenChange={onAfterOpenChange}
      size={520}
      {...adminDrawerSurfaceProps}
      {...testId('platform-admin-detail-drawer')}
      extra={
        actionItems.length > 0 ? (
          <AdminDetailActionMenu
            items={actionItems}
            triggerTestId={platformDetailDrawerTestIds.administrator.actionMenu}
          />
        ) : undefined
      }
    >
      {problem && !admin && (
        <Alert
          type="error"
          showIcon
          title={problem.title}
          description={problem.detail}
          {...testId('platform-admin-detail-problem')}
        />
      )}
      {admin && (
        <Descriptions
          bordered
          size="small"
          column={1}
          items={[
            {key: 'loginName', label: '登录账号', children: admin.loginName},
            {key: 'userName', label: '姓名', children: admin.userName},
            {key: 'mobile', label: '手机号', children: admin.mobile ?? '未填写'},
            {
              key: 'status',
              label: '状态',
              children: admin.status === 'ACTIVE' ? LIFECYCLE_LABELS.ENABLED : LIFECYCLE_LABELS.DISABLED,
            },
            {
              key: 'lastLoginAt',
              label: '最近登录',
              children: formatCanonicalDateTime(admin.lastLoginAt),
            },
            {key: 'updatedAt', label: '更新时间', children: formatCanonicalDateTime(admin.updatedAt)},
            {key: 'audit', label: '审计摘要', children: admin.auditSummary},
          ]}
        />
      )}
    </Drawer>
  );
}
