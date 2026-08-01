import {Alert, Button, Modal, Tag} from 'antd';
import {useDetailDrawer, useOverlayLock} from '@catering-all-v2/admin-ui-foundation';
import {ProTable, type ProColumns} from '@ant-design/pro-components';
import {AppPageContainer as PageContainer} from '../../../app/layout/AppPageContainer';
import {useEffect, useRef, useState} from 'react';
import {WorkspaceDetailDrawer} from './WorkspaceDetailDrawer';
import {WorkspaceFormDrawer} from './WorkspaceFormDrawer';
import {CommercialGroupInitializationDrawer} from './CommercialGroupInitializationDrawer';
import {WorkspaceLogoImage} from './WorkspaceLogoImage';
import {useWorkspaceManagement, type WorkspaceListItem} from '../model/useWorkspaceManagement';
import type {GroupWorkspaceDetail} from '../../../app/api/generated/platformEdgeApi';
import {feedbackForPlatformFailure, readPlatformRequestFailure} from '../../../app/feedback/platformProblemFeedback';
import {testId} from '../../../app/automation/platformLocators';
import {workspaceManagementLocators} from '../automation/locators';
import {updateContentTabResumeState} from '../../../app/state/contentTabsSlice';
import {selectContentTabRefreshVersion, selectContentTabResumeState} from '../../../app/state/contentTabSelectors';
import {useAppDispatch, useAppSelector} from '../../../app/state/hooks';

const statusLabel = {ENABLED: '已启用', DISABLED: '已停用'} as const;

function operationsLoginUrl(workspaceKey: string) {
  const configuredOrigin = import.meta.env.VITE_OPERATIONS_ADMIN_ORIGIN?.replace(/\/$/, '');
  const isLocalHost = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
  const fallbackOrigin = isLocalHost
    ? `${window.location.protocol}//${window.location.hostname}:5175`
    : window.location.origin;
  return `${configuredOrigin || fallbackOrigin}/operations/${encodeURIComponent(workspaceKey)}/login`;
}

type WorkspaceTabSnapshot = {
  filters: {name?: string; workspaceKey?: string; operationsTitle?: string; status?: 'ENABLED' | 'DISABLED'};
  sortKey: 'NAME' | 'WORKSPACE_KEY' | 'UPDATED_AT';
  sortDirection: 'ASC' | 'DESC';
  page: number;
  pageSize: number;
};

const initialSnapshot = (): WorkspaceTabSnapshot => ({filters: {}, sortKey: 'UPDATED_AT', sortDirection: 'DESC', page: 1, pageSize: 20});
function isSnapshot(value: unknown): value is WorkspaceTabSnapshot {
  return value !== null && typeof value === 'object' && 'filters' in value && 'sortKey' in value && 'sortDirection' in value && 'page' in value && 'pageSize' in value;
}
function selectWorkspaceSort(initial: boolean, sort: Record<string, 'ascend' | 'descend' | null | undefined>, snapshot: WorkspaceTabSnapshot): Record<string, 'ascend' | 'descend'> {
  if (initial) return sortFromSnapshot(snapshot.sortKey, snapshot.sortDirection);
  if (Object.keys(sort).length > 0) return sort as Record<string, 'ascend' | 'descend'>;
  return sortFromSnapshot(snapshot.sortKey, snapshot.sortDirection);
}

export function WorkspaceManagementPage() {
  const dispatch = useAppDispatch();
  const storedSnapshot = useAppSelector((state) => selectContentTabResumeState(state, 'PLATFORM-WORKSPACES'));
  const refreshVersion = useAppSelector((state) => selectContentTabRefreshVersion(state, 'PLATFORM-WORKSPACES'));
  const snapshot = isSnapshot(storedSnapshot) ? storedSnapshot : initialSnapshot();
  const detailDrawer = useDetailDrawer<string>();
  const [statusConfirmation, setStatusConfirmation] = useState<GroupWorkspaceDetail | undefined>();
  const [statusFailure, setStatusFailure] = useState<unknown>(null);
  useEffect(() => {
    if (!isSnapshot(storedSnapshot)) dispatch(updateContentTabResumeState({pageDesignKey: 'PLATFORM-WORKSPACES', resumeState: initialSnapshot()}));
  }, [dispatch, storedSnapshot]);
  const updateSnapshot = (next: WorkspaceTabSnapshot) => dispatch(updateContentTabResumeState({pageDesignKey: 'PLATFORM-WORKSPACES', resumeState: next}));
  const onWorkspaceKeyChange = (workspaceKey?: string) => {
    if (workspaceKey) detailDrawer.open(workspaceKey);
    else detailDrawer.close();
  };
  const management = useWorkspaceManagement({
    selectedWorkspaceKey: detailDrawer.target,
    onWorkspaceKeyChange,
  });
  const initialRequest = useRef(true);
  const [tableInstanceKey, setTableInstanceKey] = useState(0);
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  useOverlayLock(Boolean(statusConfirmation) || Boolean(statusFailure));
  useEffect(() => {
    if (refreshVersion > 0) void management.actionRef.current?.reload();
  }, [management.actionRef, refreshVersion]);
  const columns: ProColumns<WorkspaceListItem>[] = [
    {
      title: '集团空间名称',
      dataIndex: 'name',
      sorter: true,
      defaultSortOrder: snapshot.sortKey === 'NAME' ? directionFor(snapshot.sortDirection) : undefined,
      render: (_, record) => (
        <a
          href={`/platform/workspaces#workspace-${record.workspaceKey}`}
          className="platform-workspace-name-link"
          aria-label={`查看集团空间 ${record.name}`}
          {...testId(workspaceManagementLocators.detailLink)}
          onClick={(event) => {event.preventDefault(); management.openDetail(record.workspaceKey);}}
        >
          {record.name}
        </a>
      ),
      fieldProps: {allowClear: true, maxLength: 120},
    },
    {
      title: '集团空间编码',
      dataIndex: 'workspaceKey',
      sorter: true,
      defaultSortOrder: snapshot.sortKey === 'WORKSPACE_KEY' ? directionFor(snapshot.sortDirection) : undefined,
      fieldProps: {allowClear: true, maxLength: 64},
    },
    {
      title: 'Logo',
      dataIndex: 'logoUrl',
      search: false,
      render: (_, record) => {
        const logoUrl = record.logoUrl;
        return logoUrl ? <WorkspaceLogoImage width={32} height={32} src={logoUrl} alt={`${record.name} Logo`} preview /> : <Tag>未配置</Tag>;
      },
    },
    {
      title: '运营管理后台标题名称',
      dataIndex: 'operationsTitle',
      fieldProps: {allowClear: true, maxLength: 120},
      renderText: (value) => value ?? '—',
    },
    {
      title: '运营后台地址',
      dataIndex: 'workspaceKey',
      search: false,
      render: (_, record) => <a href={operationsLoginUrl(record.workspaceKey)} target="_blank" rel="noreferrer" {...testId(workspaceManagementLocators.operationsEntry)}>打开运营后台</a>,
    },
    {
      title: '商业集团',
      dataIndex: 'commercialGroupName',
      search: false,
      render: (_, record) => {
        const root = record.commercialGroup?.root;
        return record.commercialGroup?.initialized && root ? root.groupName : <Tag>未初始化</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      valueType: 'select',
      valueEnum: {ENABLED: {text: '已启用'}, DISABLED: {text: '已停用'}},
      render: (_, record) => <Tag color={record.status === 'ENABLED' ? 'success' : 'default'}>{statusLabel[record.status]}</Tag>,
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      valueType: 'dateTime',
      sorter: true,
      defaultSortOrder: snapshot.sortKey === 'UPDATED_AT' ? directionFor(snapshot.sortDirection) : undefined,
      search: false,
    },
  ];
  const statusAction = statusConfirmation?.status === 'ENABLED'
    ? {label: '停用', impact: '停用后，普通运营用户将无法登录，已有业务事实不会被删除。'}
    : {label: '启用', impact: '启用后，普通运营用户可以重新登录；已有业务事实不会被变更。'};

  return (
    <PageContainer
      className="platform-list-page"
      title="集团空间管理"
      extra={<Button type="primary" {...testId(workspaceManagementLocators.create)} onClick={() => management.setCreateOpen(true)}>新建集团空间</Button>}
    >
      <ProTable<WorkspaceListItem>
        key={tableInstanceKey}
        className="platform-list-table"
        rowKey="workspaceKey"
        columns={columns}
        actionRef={management.actionRef}
        params={{
          current: snapshot.page,
          pageSize: snapshot.pageSize,
        }}
        request={async (params, sort) => {
          const effectiveSort = selectWorkspaceSort(initialRequest.current, sort, snapshot);
          initialRequest.current = false;
          const sortEntry = Object.entries(effectiveSort).find(([, direction]) => Boolean(direction));
          const next: WorkspaceTabSnapshot = {filters: compactFilters(params), page: positive(params.current, 1), pageSize: positive(params.pageSize, 20),
            sortKey: sortKeyFromField(sortEntry?.[0]) ?? 'UPDATED_AT', sortDirection: sortEntry?.[1] === 'ascend' ? 'ASC' : 'DESC'};
          if (JSON.stringify(next) !== JSON.stringify(snapshot)) updateSnapshot(next);
          return management.request(params, effectiveSort);
        }}
        search={{labelWidth: 80, defaultCollapsed: false, span: 8, searchGutter: [16, 16], collapseRender: false}}
        form={{initialValues: snapshot.filters}}
        onSubmit={(values) => updateSnapshot({...snapshot, filters: compactFilters(values as Record<string, unknown>), page: 1})}
        onReset={() => {
          updateSnapshot({...snapshot, filters: {}, page: 1});
          setTableInstanceKey((current) => current + 1);
        }}
        options={false}
        pagination={{showSizeChanger: true}}
        locale={{emptyText: '暂无集团空间'}}
      />
      <WorkspaceDetailDrawer
        open={detailDrawer.isOpen}
        data={management.detailQuery.data}
        loading={management.detailQuery.isFetching}
        error={management.detailQuery.error}
        onClose={management.closeDetail}
        onRetry={() => void management.detailQuery.refetch()}
        onEdit={management.beginEdit}
        onStatusAction={(workspace) => {
          setStatusFailure(null);
          setStatusConfirmation(workspace);
        }}
        commercialGroupSummary={management.detailQuery.data?.commercialGroup}
        onInitializeCommercialGroup={management.beginInitializeCommercialGroup}
      />
      <Modal
        open={Boolean(statusConfirmation)}
        title={statusConfirmation ? `确认${statusAction.label}“${statusConfirmation.name}”？` : undefined}
        okText={`确认${statusAction.label}`}
        confirmLoading={statusSubmitting}
        cancelText="取消"
        cancelButtonProps={testId(workspaceManagementLocators.statusCancel)}
        okButtonProps={{...testId(workspaceManagementLocators.statusConfirm), danger: statusConfirmation?.status === 'ENABLED'}}
        onCancel={() => {
          setStatusFailure(null);
          setStatusConfirmation(undefined);
        }}
        onOk={() => {
          if (!statusConfirmation || statusSubmitting) return;
          setStatusSubmitting(true);
          // Do not return this Promise to Ant Design Modal. The app owns the
          // submitting lifecycle so a typed rejection can immediately leave
          // the confirmation usable for explicit recovery or cancellation.
          void management.onStatusAction(statusConfirmation)
            .then(() => {
              setStatusFailure(null);
              setStatusConfirmation(undefined);
            })
            .catch((error) => {
              setStatusFailure(error);
            })
            .finally(() => {
              setStatusSubmitting(false);
            });
        }}
        destroyOnHidden
      >
        {statusFailure ? (
          <Alert
            type="error"
            showIcon
            title={feedbackForPlatformFailure(readPlatformRequestFailure(statusFailure), 'workspace-save')?.message
              ?? '状态变更失败，请刷新后重新判断。'}
          />
        ) : statusConfirmation ? statusAction.impact : null}
      </Modal>
      <WorkspaceFormDrawer
        open={management.createOpen}
        mode="create"
        onOpenChange={management.setCreateOpen}
        uploadLogo={management.uploadLogo}
        onCreate={management.onCreate}
        onSave={management.onSave}
      />
      <WorkspaceFormDrawer
        open={management.editOpen}
        mode="edit"
        initialValues={management.editWorkspace ? {
          workspaceKey: management.editWorkspace.workspaceKey,
          name: management.editWorkspace.name,
          operationsTitle: management.editWorkspace.operationsTitle,
          notes: management.editWorkspace.notes ?? undefined,
        } : undefined}
        currentAssetConfigured={Boolean(management.editWorkspace?.logoAssetRef)}
        currentLogoUrl={management.editWorkspace?.logoUrl}
        expectedVersion={management.editWorkspace?.version}
        onOpenChange={management.closeEdit}
        uploadLogo={management.uploadLogo}
        onCreate={management.onCreate}
        onSave={management.onSave}
      />
      <CommercialGroupInitializationDrawer
        open={Boolean(management.initializeWorkspace)}
        workspace={management.initializeWorkspace}
        onOpenChange={management.closeInitializeCommercialGroup}
        onInitialize={management.onInitializeCommercialGroup}
        onOwnerReadback={async () => {
          if (management.initializeWorkspace) {
            await management.refreshCommercialGroupOwnerReadback(management.initializeWorkspace.workspaceKey);
          }
        }}
      />
    </PageContainer>
  );
}

function sortFromSnapshot(sortKey: WorkspaceTabSnapshot['sortKey'], direction: WorkspaceTabSnapshot['sortDirection']) {
  const field = sortKey === 'NAME' ? 'name' : sortKey === 'WORKSPACE_KEY' ? 'workspaceKey' : sortKey === 'UPDATED_AT' ? 'updatedAt' : undefined;
  return field ? {[field]: directionFor(direction)} : {};
}

function sortKeyFromField(field: string | undefined) {
  if (field === 'name') return 'NAME';
  if (field === 'workspaceKey') return 'WORKSPACE_KEY';
  if (field === 'updatedAt') return 'UPDATED_AT';
  return undefined;
}

function directionFor(value: WorkspaceTabSnapshot['sortDirection']): 'ascend' | 'descend' { return value === 'ASC' ? 'ascend' : 'descend'; }
function positive(value: unknown, fallback: number): number { const parsed = Number(value); return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback; }
function compactFilters(params: Record<string, unknown>): WorkspaceTabSnapshot['filters'] {
  const string = (key: 'name' | 'workspaceKey' | 'operationsTitle') => typeof params[key] === 'string' && params[key].trim() ? params[key].trim() : undefined;
  return {name: string('name'), workspaceKey: string('workspaceKey'), operationsTitle: string('operationsTitle'), status: params.status === 'ENABLED' || params.status === 'DISABLED' ? params.status : undefined};
}
