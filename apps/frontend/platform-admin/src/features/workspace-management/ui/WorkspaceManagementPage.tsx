import {ProTable} from '@ant-design/pro-components';
import {Alert, Avatar, Button, Card, Form, Input, Select, Space, Tag, Typography} from 'antd';
import {testId, useDetailDrawer, useOverlayLock} from '@catering-v2s/admin-ui-foundation';
import {useMemo, useRef, useState} from 'react';
import {platformAdminRtkRequest} from '../../../app/api/generated/platform-edge.rtk';
import {platformProblemOf, platformRtk, type PlatformApiProblem} from '../../../app/api/PlatformTransport';
import {adminCatalog, platformPageDesignKeys} from '../../../app/catalog/generatedAdminCatalog';
import type {GroupWorkspaceDetail, GroupWorkspacePage, GroupWorkspaceStatus} from '../../../app/api/generated/platform-edge';
import {CommercialGroupInitializationDrawer} from './CommercialGroupInitializationDrawer';
import {WorkspaceCreateDrawer} from './WorkspaceCreateDrawer';
import {WorkspaceDetailDrawer} from './WorkspaceDetailDrawer';
import {WorkspaceEditDrawer} from './WorkspaceEditDrawer';
import {WorkspaceStatusModal} from './WorkspaceStatusModal';
import {PlatformAuditHistoryModal, type PlatformAuditTarget} from '../../audit-history';

type Workspace = GroupWorkspacePage['items'][number];
type Filters = {name?: string; groupWorkspaceKey?: string; operationsTitle?: string; status?: GroupWorkspaceStatus};
const workspacePage = adminCatalog.platformPages.find((page) => page.pageDesignKey === platformPageDesignKeys.PlatformWorkspaces);
if (!workspacePage) throw new Error('Missing generated workspace page');
const workspacePageTitle = workspacePage.title;

/** IA02: the management list identifies a workspace; every business action starts from owner detail. */
export function WorkspaceManagementPage() {
  const [filters, setFilters] = useState<Filters>({});
  const [filterForm] = Form.useForm<Filters>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [commandProblem, setProblem] = useState<PlatformApiProblem>();
  const [createOpen, setCreateOpen] = useState(false);
  const detail = useDetailDrawer<GroupWorkspaceDetail>();
  const [editing, setEditing] = useState<GroupWorkspaceDetail>();
  const [statusTarget, setStatusTarget] = useState<GroupWorkspaceDetail>();
  const [initializing, setInitializing] = useState<GroupWorkspaceDetail>();
  const [auditTarget, setAuditTarget] = useState<PlatformAuditTarget>();
  const [pendingAction, setPendingAction] = useState<{kind: 'edit' | 'status' | 'initialize'; target: GroupWorkspaceDetail}>();
  const pendingActionRef = useRef<typeof pendingAction>(undefined);
  pendingActionRef.current = pendingAction;
  useOverlayLock(detail.isOpen || createOpen || Boolean(editing) || Boolean(statusTarget) || Boolean(initializing) || Boolean(auditTarget));
  const listRequest = useMemo(
    () => platformAdminRtkRequest.listPlatformGroupWorkspaces({}, {query: {...filters, page, pageSize, sortKey: 'UPDATED_AT', sortDirection: 'DESC'}}),
    [filters, page, pageSize],
  );
  const {data: result, error, isLoading} = platformRtk.useListPlatformGroupWorkspacesQuery(listRequest);
  const [loadDetail] = platformRtk.useLazyGetPlatformGroupWorkspaceDetailQuery();
  const problem = error ? platformProblemOf(error) : commandProblem;

  const openDetail = async (row: Workspace) => {
    try {
      setProblem(undefined);
      detail.open(await loadDetail(platformAdminRtkRequest.getPlatformGroupWorkspaceDetail({groupWorkspaceKey: row.groupWorkspaceKey}, {})).unwrap());
    } catch (next) { setProblem(next as PlatformApiProblem); }
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

  return <Card title={workspacePageTitle} extra={<Button type="primary" onClick={() => setCreateOpen(true)} {...testId('platform-workspace-create')}>新建集团空间</Button>}>
    <Typography.Paragraph>查找集团空间后先核对详情；编辑、启停和商业集团初始化仅从详情进入。</Typography.Paragraph>
    {problem && <Alert type="error" showIcon message={problem.title} description={problem.detail} style={{marginBottom: 16}}/>}
    <Form<Filters> form={filterForm} layout="inline" onFinish={submitFilters} style={{marginBottom: 16}}>
      <Form.Item name="name" label="集团空间名称"><Input allowClear {...testId('platform-workspace-filter-name')}/></Form.Item>
      <Form.Item name="groupWorkspaceKey" label="集团空间编码"><Input allowClear {...testId('platform-workspace-filter-key')}/></Form.Item>
      <Form.Item name="operationsTitle" label="运营管理后台标题名称"><Input allowClear {...testId('platform-workspace-filter-operations-title')}/></Form.Item>
      <Form.Item name="status" label="状态"><Select allowClear style={{minWidth: 120}} options={[{value: 'ENABLED', label: '已启用'}, {value: 'DISABLED', label: '已停用'}]} {...testId('platform-workspace-filter-status')}/></Form.Item>
      <Form.Item><Space><Button type="primary" htmlType="submit" {...testId('platform-workspace-filter-submit')}>查询</Button><Button onClick={() => { filterForm.resetFields(); setFilters({}); setPage(1); }} {...testId('platform-workspace-filter-reset')}>重置</Button></Space></Form.Item>
    </Form>
    <ProTable<Workspace>
      rowKey="groupWorkspaceKey" loading={isLoading && !result && !problem} dataSource={result?.items} search={false} options={false}
      pagination={result ? {current: result.page, pageSize: result.pageSize, total: result.total, onChange: (nextPage, nextPageSize) => { setPage(nextPage); setPageSize(nextPageSize); }} : false}
      columns={[
        {title: '集团空间名称', dataIndex: 'name', render: (_, row) => <Button type="link" onClick={() => void openDetail(row)} {...testId(`platform-workspace-detail-${row.groupWorkspaceKey}`)}>{row.name}</Button>},
        {title: '集团空间编码', dataIndex: 'groupWorkspaceKey'},
        {title: 'Logo', dataIndex: 'logoUrl', render: (_, row) => row.logoUrl ? <Avatar src={row.logoUrl} alt={`${row.name} Logo`}/> : '未配置'},
        {title: '运营管理后台标题名称', dataIndex: 'operationsTitle', render: (value) => value ?? '—'},
        {title: '商业集团', render: (_, row) => <Tag color={row.commercialGroup?.initialized ? 'success' : 'default'}>{row.commercialGroup?.initialized ? '已初始化' : '未初始化'}</Tag>},
        {title: '状态', dataIndex: 'status', render: (_, row) => <Tag color={row.status === 'ENABLED' ? 'success' : 'default'}>{row.status === 'ENABLED' ? '已启用' : '已停用'}</Tag>},
        {title: '更新时间', dataIndex: 'updatedAt', valueType: 'dateTime'},
      ]}
    />
    <WorkspaceDetailDrawer workspace={detail.target} onClose={detail.close} onAfterOpenChange={openPendingActionAfterDetailClosed} onEdit={() => openAction('edit')} onStatus={() => openAction('status')} onInitialize={() => openAction('initialize')} onAudit={() => detail.target && setAuditTarget({entityType: 'GROUP_WORKSPACE', entityId: detail.target.groupWorkspaceKey, displayName: detail.target.name})}/>
    <WorkspaceCreateDrawer open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => setCreateOpen(false)}/>
    <WorkspaceEditDrawer workspace={editing} onClose={() => setEditing(undefined)} onUpdated={returnToDetail}/>
    <WorkspaceStatusModal workspace={statusTarget} onClose={() => setStatusTarget(undefined)} onUpdated={returnToDetail} onProblem={setProblem}/>
    <CommercialGroupInitializationDrawer workspace={initializing} onClose={() => setInitializing(undefined)} onInitialized={returnToDetail}/>
    <PlatformAuditHistoryModal open={Boolean(auditTarget)} target={auditTarget} onClose={() => setAuditTarget(undefined)}/>
  </Card>;
}
