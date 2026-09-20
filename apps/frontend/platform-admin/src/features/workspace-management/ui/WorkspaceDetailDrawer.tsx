import {Alert, Descriptions, Drawer, Image, Tag} from 'antd';
import {
  AdminDetailActionLabel,
  AdminDetailActionMenu,
  adminDrawerSurfaceProps,
  displayFieldValue,
  formatCanonicalDateTime,
  lifecycleColor,
  lifecycleLabel,
  NameCodeText,
  testId,
  useOverlayLock,
} from '@catering-v2s/admin-ui-foundation';
import type {GroupWorkspaceDetail} from '../../../app/api/generated/platform-edge';
import {platformDetailDrawerTestIds} from '../../../app/automation/platformDetailDrawerTestIds';

export function WorkspaceDetailDrawer({
  open,
  loading,
  problem,
  workspace,
  onClose,
  onAfterOpenChange,
  onEdit,
  onStatus,
  onInitialize,
  onAudit,
}: {
  open: boolean;
  loading: boolean;
  problem?: {title: string; detail: string};
  workspace?: GroupWorkspaceDetail;
  onClose: () => void;
  onAfterOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onStatus: () => void;
  onInitialize: () => void;
  onAudit: () => void;
}) {
  useOverlayLock(open);
  const actionItems = workspace
    ? [
        ...(!workspace.commercialGroup?.initialized
          ? [
              {
                key: 'initialize',
                label: (
                  <AdminDetailActionLabel testIdValue={platformDetailDrawerTestIds.workspace.initialize}>
                    初始化商业集团
                  </AdminDetailActionLabel>
                ),
                onClick: onInitialize,
              },
            ]
          : []),
        {
          key: 'audit',
          label: (
            <AdminDetailActionLabel testIdValue={platformDetailDrawerTestIds.workspace.audit}>
              操作历史
            </AdminDetailActionLabel>
          ),
          onClick: onAudit,
        },
        {
          key: 'edit',
          label: (
            <AdminDetailActionLabel testIdValue={platformDetailDrawerTestIds.workspace.edit}>
              编辑
            </AdminDetailActionLabel>
          ),
          onClick: onEdit,
        },
        {
          key: 'status',
          danger: workspace.status === 'ENABLED',
          label: (
            <AdminDetailActionLabel testIdValue={platformDetailDrawerTestIds.workspace.status}>
              {workspace.status === 'ENABLED' ? '停用' : '启用'}
            </AdminDetailActionLabel>
          ),
          onClick: onStatus,
        },
      ]
    : [];
  return (
    <Drawer
      title="集团空间详情"
      open={open}
      loading={loading}
      onClose={onClose}
      maskClosable
      afterOpenChange={onAfterOpenChange}
      size={600}
      {...adminDrawerSurfaceProps}
      {...testId('platform-workspace-detail-drawer')}
      extra={
        actionItems.length > 0 ? (
          <AdminDetailActionMenu items={actionItems} triggerTestId={platformDetailDrawerTestIds.workspace.actionMenu} />
        ) : undefined
      }
    >
      {problem && !workspace && (
        <Alert
          type="error"
          showIcon
          title={problem.title}
          description={problem.detail}
          {...testId('platform-workspace-detail-problem')}
        />
      )}
      {workspace && (
        <Descriptions
          bordered
          size="small"
          column={1}
          items={[
            {key: 'workspaceName', label: '集团空间名称', children: workspace.name},
            {key: 'workspaceCode', label: '集团空间编码', children: workspace.groupWorkspaceKey},
            {key: 'operationsTitle', label: '运营管理后台标题名称', children: workspace.operationsTitle},
            {
              key: 'logo',
              label: 'Logo',
              children: workspace.logoUrl ? (
                <Image width={96} src={workspace.logoUrl} alt={`${workspace.name} Logo`} />
              ) : (
                '未配置'
              ),
            },
            {key: 'notes', label: '备注', children: displayFieldValue(workspace.notes)},
            {
              key: 'status',
              label: '状态',
              children: <Tag color={lifecycleColor(workspace.status)}>{lifecycleLabel(workspace.status)}</Tag>,
            },
            {
              key: 'group',
              label: '商业集团',
              children: workspace.commercialGroup?.root ? (
                <NameCodeText
                  name={workspace.commercialGroup.root.groupName}
                  code={workspace.commercialGroup.root.groupCode}
                />
              ) : (
                '尚未初始化'
              ),
            },
            {key: 'created', label: '创建时间', children: formatCanonicalDateTime(workspace.createdAt)},
            {key: 'updated', label: '更新时间', children: formatCanonicalDateTime(workspace.updatedAt)},
          ]}
        />
      )}
    </Drawer>
  );
}
