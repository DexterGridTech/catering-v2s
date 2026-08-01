import {CloseOutlined} from '@ant-design/icons';
import {adminDrawerSurfaceProps} from '@catering-all-v2/admin-ui-foundation';
import {Alert, Button, Drawer, Space, Spin, Tag} from 'antd';
import {ProDescriptions} from '@ant-design/pro-components';
import {useEffect, useRef, useState} from 'react';
import {ErrorCode, type GroupWorkspaceDetail} from '../../../app/api/generated/platformEdgeApi';
import {readPlatformRequestFailure} from '../../../app/feedback/platformProblemFeedback';
import {testId} from '../../../app/automation/platformLocators';
import {workspaceManagementLocators} from '../automation/locators';
import type {CommercialGroupRootSummary} from './CommercialGroupInitializationDrawer';
import {WorkspaceLogoImage} from './WorkspaceLogoImage';

const statusLabel = {ENABLED: '已启用', DISABLED: '已停用'} as const;

type Props = {
  open: boolean;
  data?: GroupWorkspaceDetail;
  loading?: boolean;
  error?: unknown;
  onClose: () => void;
  onRetry: () => void;
  onEdit: (workspace: GroupWorkspaceDetail) => void;
  onStatusAction: (workspace: GroupWorkspaceDetail) => void;
  commercialGroupSummary?: CommercialGroupRootSummary;
  onInitializeCommercialGroup?: (workspace: GroupWorkspaceDetail) => void;
};

type PendingDrawerAction =
  | {kind: 'edit'; workspace: GroupWorkspaceDetail}
  | {kind: 'status'; workspace: GroupWorkspaceDetail}
  | {kind: 'initialize-commercial-group'; workspace: GroupWorkspaceDetail};

export function WorkspaceDetailDrawer({
  open,
  data,
  loading = false,
  error,
  onClose,
  onRetry,
  onEdit,
  onStatusAction,
  commercialGroupSummary,
  onInitializeCommercialGroup,
}: Props) {
  const failure = error ? readPlatformRequestFailure(error) : null;
  const pendingAction = useRef<PendingDrawerAction | undefined>(undefined);
  const [closingForAction, setClosingForAction] = useState(false);

  useEffect(() => {
    if (!open) setClosingForAction(false);
  }, [open]);

  return (
    <Drawer
      {...adminDrawerSurfaceProps}
      open={open && !closingForAction}
      title={<Space size={8}><Button type="text" icon={<CloseOutlined />} {...testId(workspaceManagementLocators.detailClose)} aria-label="关闭" onClick={onClose} /><span>集团空间详情</span></Space>}
      placement="right"
      size={560}
      closable={false}
      extra={data ? (
        <Space>
          {commercialGroupSummary?.initialized === false && onInitializeCommercialGroup ? (
            <Button
              type="primary"
              {...testId(workspaceManagementLocators.detailInitializeCommercialGroup)}
              aria-label="初始化商业集团"
              onClick={() => {
                pendingAction.current = {kind: 'initialize-commercial-group', workspace: data};
                setClosingForAction(true);
              }}
            >
              初始化商业集团
            </Button>
          ) : null}
          <Button
            aria-label="编辑"
            {...testId(workspaceManagementLocators.detailEdit)}
            onClick={() => {
              pendingAction.current = {kind: 'edit', workspace: data};
              setClosingForAction(true);
            }}
          >
            编辑
          </Button>
          <Button
            danger={data.status === 'ENABLED'}
            aria-label={data.status === 'ENABLED' ? '停用' : '启用'}
            {...testId(workspaceManagementLocators.detailStatus)}
            onClick={() => {
              pendingAction.current = {kind: 'status', workspace: data};
              setClosingForAction(true);
            }}
          >
            {data.status === 'ENABLED' ? '停用' : '启用'}
          </Button>
        </Space>
      ) : null}
      onClose={onClose}
      afterOpenChange={(visible) => {
        if (visible || !pendingAction.current) return;
        const action = pendingAction.current;
        pendingAction.current = undefined;
        onClose();
        if (action.kind === 'edit') onEdit(action.workspace);
        else if (action.kind === 'status') onStatusAction(action.workspace);
        else onInitializeCommercialGroup?.(action.workspace);
      }}
    >
      {loading ? <Spin aria-label="正在加载集团空间详情" /> : null}
      {failure ? (
        <Alert
          type="error"
          showIcon
          title={failure.code === ErrorCode.PlatformResourceNotFound ? '集团空间不存在或已被移除' : '集团空间详情加载失败，请重试'}
          action={failure.code === ErrorCode.PlatformResourceNotFound ? undefined : <Button {...testId(workspaceManagementLocators.detailRetry)} onClick={onRetry}>重试</Button>}
        />
      ) : null}
      {data ? <WorkspaceDetail data={data} commercialGroupSummary={commercialGroupSummary} /> : null}
    </Drawer>
  );
}

function WorkspaceDetail({data, commercialGroupSummary}: {data: GroupWorkspaceDetail; commercialGroupSummary?: CommercialGroupRootSummary}) {
  return (
    <ProDescriptions<GroupWorkspaceDetail>
      column={1}
      bordered
      dataSource={data}
      emptyText="—"
      columns={[
        {title: '集团空间名称', dataIndex: 'name'},
        {title: '集团空间编码', dataIndex: 'workspaceKey'},
        {title: '运营管理后台标题名称', dataIndex: 'operationsTitle'},
        {
          title: 'Logo',
          dataIndex: 'logoAssetRef',
          render: (_, record) => {
            const logoUrl = record.logoUrl;
            return logoUrl ? <WorkspaceLogoImage width={96} height={96} src={logoUrl} alt={`${record.name} Logo`} preview /> : <Tag>未配置</Tag>;
          },
        },
        {title: '备注', dataIndex: 'notes'},
        {
          title: '状态',
          dataIndex: 'status',
          render: (_, record) => <Tag color={record.status === 'ENABLED' ? 'success' : 'default'}>{statusLabel[record.status]}</Tag>,
        },
        ...(commercialGroupSummary?.initialized && commercialGroupSummary.root ? [
          {title: '集团编码', render: () => commercialGroupSummary.root?.groupCode ?? '—'},
          {title: '集团名称', render: () => commercialGroupSummary.root?.groupName ?? '—'},
        ] : []),
        {title: '版本', dataIndex: 'version'},
        {title: '创建时间', dataIndex: 'createdAt', valueType: 'dateTime'},
        {title: '更新时间', dataIndex: 'updatedAt', valueType: 'dateTime'},
      ]}
    />
  );
}
