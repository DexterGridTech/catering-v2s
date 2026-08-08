import {ProTable} from '@ant-design/pro-components';
import {Alert, Avatar, Button, Card, Tag, Typography} from 'antd';
import {adminListState, testId, useAsyncGenerationGuard, useDetailDrawer, useOverlayLock} from '@catering-v2s/admin-ui-foundation';
import {useMemo, useRef, useState} from 'react';
import {platformAdminRtkRequest} from '../../../app/api/generated/platform-edge.rtk';
import {platformClient, platformProblemOf, platformRtk, type PlatformApiProblem} from '../../../app/api/PlatformTransport';
import {adminCatalog, platformPageDesignKeys} from '../../../app/catalog/generatedAdminCatalog';
import type {GroupWorkspaceDetail, GroupWorkspacePage, GroupWorkspaceSortKey, GroupWorkspaceStatus, SortDirection} from '../../../app/api/generated/platform-edge';
import {CommercialGroupInitializationDrawer} from './CommercialGroupInitializationDrawer';
import {WorkspaceCreateDrawer} from './WorkspaceCreateDrawer';
import {WorkspaceDetailDrawer} from './WorkspaceDetailDrawer';
import {WorkspaceEditDrawer} from './WorkspaceEditDrawer';
import {WorkspaceStatusModal} from './WorkspaceStatusModal';
import {PlatformAuditHistoryModal, type PlatformAuditTarget} from '../../audit-history';
import {WorkspaceMutationConflictModal} from './WorkspaceMutationConflictModal';

type Workspace = GroupWorkspacePage['items'][number];
type Filters = {name?: string; groupWorkspaceKey?: string; operationsTitle?: string; status?: GroupWorkspaceStatus};
const workspacePage = adminCatalog.platformPages.find((page) => page.pageDesignKey === platformPageDesignKeys.PlatformWorkspaces);
if (!workspacePage) throw new Error('Missing generated workspace page');
const workspacePageTitle = workspacePage.title;

function operationsLoginUrl(groupWorkspaceKey: string) {
  const configuredOrigin = import.meta.env.VITE_OPERATIONS_ADMIN_ORIGIN?.replace(/\/$/, '');
  const localHost = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
  const fallbackOrigin = localHost ? `${window.location.protocol}//${window.location.hostname}:5175` : window.location.origin;
  return `${configuredOrigin || fallbackOrigin}/operations/${encodeURIComponent(groupWorkspaceKey)}/login`;
}

/** IA02: the management list identifies a workspace; every business action starts from owner detail. */
export function WorkspaceManagementPage() {
  const [filters, setFilters] = useState<Filters>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState<GroupWorkspaceSortKey>('UPDATED_AT');
  const [sortDirection, setSortDirection] = useState<SortDirection>('DESC');
  const [commandProblem, setProblem] = useState<PlatformApiProblem>();
  const [createOpen, setCreateOpen] = useState(false);
  const detail = useDetailDrawer<GroupWorkspaceDetail>();
  const detailGeneration = useAsyncGenerationGuard();
  const [editing, setEditing] = useState<GroupWorkspaceDetail>();
  const [statusTarget, setStatusTarget] = useState<GroupWorkspaceDetail>();
  const [initializing, setInitializing] = useState<GroupWorkspaceDetail>();
  const [auditTarget, setAuditTarget] = useState<PlatformAuditTarget>();
  const [conflictWorkspaceKey, setConflictWorkspaceKey] = useState<string>();
  const [pendingAction, setPendingAction] = useState<{kind: 'edit' | 'status' | 'initialize'; target: GroupWorkspaceDetail}>();
  const pendingActionRef = useRef<typeof pendingAction>(undefined);
  pendingActionRef.current = pendingAction;
  useOverlayLock(detail.isOpen || createOpen || Boolean(editing) || Boolean(statusTarget) || Boolean(initializing) || Boolean(auditTarget) || Boolean(conflictWorkspaceKey));
  const listRequest = useMemo(
    () => platformAdminRtkRequest.listPlatformGroupWorkspaces({}, {query: {...filters, page, pageSize, sortKey, sortDirection}}),
    [filters, page, pageSize, sortDirection, sortKey],
  );
  const {data: result, error, isLoading} = platformRtk.useListPlatformGroupWorkspacesQuery(listRequest);
  const [loadDetail] = platformRtk.useLazyGetPlatformGroupWorkspaceDetailQuery();
  const problem = error ? platformProblemOf(error) : commandProblem;

  const openDetail = (row: Workspace) => {
    const request = detailGeneration.begin();
    setProblem(undefined);
    detail.openLoading();
    void loadDetail(platformAdminRtkRequest.getPlatformGroupWorkspaceDetail({groupWorkspaceKey: row.groupWorkspaceKey}, {})).unwrap().then((next) => {
      if (detailGeneration.isCurrent(request)) detail.open(next);
    }).catch((next) => {
      if (detailGeneration.isCurrent(request)) {
        detail.finishLoading();
        setProblem(platformProblemOf(next));
      }
    });
  };
  const submitFilters = (next: Filters) => { setFilters(next); setPage(1); };
  const openAction = (action: 'edit' | 'status' | 'initialize') => {
    if (!detail.target) return;
    const next = {kind: action, target: detail.target};
    pendingActionRef.current = next;
    setPendingAction(next);
    detail.close();
  };
  const openPendingActionAfterDetailClosed = (open: boolean) => {
    const pending = pendingActionRef.current;
    if (open || !pending) return;
    if (pending.kind === 'edit') setEditing(pending.target);
    else if (pending.kind === 'status') setStatusTarget(pending.target);
    else setInitializing(pending.target);
    pendingActionRef.current = undefined;
    setPendingAction(undefined);
  };
  const returnToDetail = (workspace: GroupWorkspaceDetail) => {
    setEditing(undefined); setStatusTarget(undefined); setInitializing(undefined); detail.open(workspace);
  };
  const viewLatestAfterConflict = async () => {
    const key = conflictWorkspaceKey;
    if (!key) return;
    setConflictWorkspaceKey(undefined); setProblem(undefined);
    const request = detailGeneration.begin();
    detail.openLoading();
    try {
      const latest = await platformClient.getPlatformGroupWorkspaceDetail({groupWorkspaceKey: key}, {});
      if (detailGeneration.isCurrent(request)) detail.open(latest);
    } catch (error) {
      if (detailGeneration.isCurrent(request)) { detail.finishLoading(); setProblem(platformProblemOf(error)); }
    }
  };

  const closeDetail = () => { detailGeneration.invalidate(); detail.close(); };
  const listState = adminListState({loading: isLoading && !result && !error, failed: Boolean(error), emptyText: '暂无集团空间', testIdPrefix: 'platform-workspace-list'});
  return <Card title={<Typography.Paragraph aria-label={workspacePageTitle} type="secondary" style={{margin: 0}}>查找集团空间后先核对详情；编辑、启停和商业集团初始化仅从详情进入。</Typography.Paragraph>} extra={<Button type="primary" onClick={() => setCreateOpen(true)} {...testId('platform-workspace-create')}>新建集团空间</Button>}>
    {problem && <Alert type="error" showIcon title={problem.title} description={problem.detail} style={{marginBottom: 16}} {...testId('platform-workspace-list-error')}/>}
    <div {...testId('platform-workspace-table')}><ProTable<Workspace>
      size="small"
      rowKey="groupWorkspaceKey" loading={listState.loading} locale={listState.locale} dataSource={result?.items} options={false}
      search={{labelWidth: 'auto', optionRender: (searchConfig) => [<Button key="submit" type="primary" onClick={() => searchConfig.form?.submit()} {...testId('platform-workspace-filter-submit')}>查询</Button>, <Button key="reset" onClick={() => { searchConfig.form?.resetFields(); setFilters({}); setPage(1); }} {...testId('platform-workspace-filter-reset')}>重置</Button>]}}
      onSubmit={(value) => submitFilters({name: value.name?.trim() || undefined, groupWorkspaceKey: value.groupWorkspaceKey?.trim() || undefined, operationsTitle: value.operationsTitle?.trim() || undefined, status: value.status})}
      pagination={result ? {current: result.page, pageSize: result.pageSize, total: result.total} : false}
      columns={[
        {title: '集团空间名称', dataIndex: 'name', sorter: true, fieldProps: {...testId('platform-workspace-filter-name'), allowClear: true}, render: (_, row) => <Button type="link" onClick={() => void openDetail(row)} {...testId(`platform-workspace-detail-${row.groupWorkspaceKey}`)}>{row.name}</Button>},
        {title: '集团空间编码', dataIndex: 'groupWorkspaceKey', sorter: true, fieldProps: {...testId('platform-workspace-filter-key'), allowClear: true}},
        {title: 'Logo', dataIndex: 'logoUrl', search: false, render: (_, row) => row.logoUrl ? <Avatar src={row.logoUrl} alt={`${row.name} Logo`}/> : '未配置'},
        {title: '运营管理后台标题名称', dataIndex: 'operationsTitle', fieldProps: {...testId('platform-workspace-filter-operations-title'), allowClear: true}, render: (value) => value ?? '—'},
        {title: '运营后台地址', dataIndex: 'groupWorkspaceKey', search: false, render: (_, row) => <a href={operationsLoginUrl(row.groupWorkspaceKey)} target="_blank" rel="noreferrer" {...testId(`platform-workspace-operations-entry-${row.groupWorkspaceKey}`)}>打开运营后台</a>},
        {title: '商业集团', search: false, render: (_, row) => <Tag color={row.commercialGroup?.initialized ? 'success' : 'default'}>{row.commercialGroup?.initialized ? '已初始化' : '未初始化'}</Tag>},
        {title: '状态', dataIndex: 'status', valueType: 'select', valueEnum: {ENABLED: {text: '已启用'}, DISABLED: {text: '已停用'}}, fieldProps: {...testId('platform-workspace-filter-status'), style: {minWidth: 120}}, render: (_, row) => <Tag color={row.status === 'ENABLED' ? 'success' : 'default'}>{row.status === 'ENABLED' ? '已启用' : '已停用'}</Tag>},
        {title: '更新时间', dataIndex: 'updatedAt', valueType: 'dateTime', sorter: true, search: false},
      ]}
      onChange={(pagination, _, sorter, extra) => {
        if (extra.action === 'paginate') { setPage(pagination.current ?? page); setPageSize(pagination.pageSize ?? pageSize); return; }
        if (extra.action !== 'sort') return;
        const current = Array.isArray(sorter) ? sorter[0] : sorter;
        if (!current?.order) {
          setSortKey('UPDATED_AT');
          setSortDirection('DESC');
          return;
        }
        const nextKey = current.field === 'name' ? 'NAME' : current.field === 'groupWorkspaceKey' ? 'WORKSPACE_KEY' : 'UPDATED_AT';
        setSortKey(nextKey);
        setSortDirection(current.order === 'ascend' ? 'ASC' : 'DESC');
        setPage(1);
      }}
    /></div>
    <WorkspaceDetailDrawer open={detail.isOpen} loading={detail.loading} problem={problem} workspace={detail.target} onClose={closeDetail} onAfterOpenChange={openPendingActionAfterDetailClosed} onEdit={() => openAction('edit')} onStatus={() => openAction('status')} onInitialize={() => openAction('initialize')} onAudit={() => detail.target && setAuditTarget({entityType: 'GROUP_WORKSPACE', entityId: detail.target.groupWorkspaceKey, displayName: detail.target.name})}/>
    <WorkspaceCreateDrawer open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => setCreateOpen(false)}/>
    <WorkspaceEditDrawer workspace={editing} onClose={() => setEditing(undefined)} onUpdated={returnToDetail} onConflict={setConflictWorkspaceKey}/>
    <WorkspaceStatusModal workspace={statusTarget} onClose={() => setStatusTarget(undefined)} onUpdated={returnToDetail} onProblem={setProblem} onConflict={setConflictWorkspaceKey}/>
    <CommercialGroupInitializationDrawer workspace={initializing} onClose={() => setInitializing(undefined)} onInitialized={returnToDetail}/>
    <PlatformAuditHistoryModal open={Boolean(auditTarget)} target={auditTarget} onClose={() => setAuditTarget(undefined)}/>
    <WorkspaceMutationConflictModal open={Boolean(conflictWorkspaceKey)} onClose={() => setConflictWorkspaceKey(undefined)} onViewLatest={() => void viewLatestAfterConflict()}/>
  </Card>;
}
