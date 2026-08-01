import {Alert, Button, Form, Input, Select} from 'antd';
import {ProTable, type ProColumns} from '@ant-design/pro-components';
import {contextScopedQueryArgs, testId, useDetailDrawer, useOverlayLock} from '@catering-v2s/admin-ui-foundation';
import {useCallback, useMemo, useState} from 'react';
import {operationsRtk} from '../../../app/api/OperationsTransport';
import type {OrganizationStore, OrganizationStoreStatus} from '../../../app/api/generated/operations-edge';
import {operationsAdminRtkRequest} from '../../../app/api/generated/operations-edge.rtk';
import {ACTION_CAPABILITIES, adminCatalog, operationsPageDesignKeys} from '../../../app/catalog/generatedAdminCatalog';
import type {OperationsPageProps} from '../../../app/routing/model';
import {OperationsAuditHistoryModal} from '../../audit-history';
import {StoreCreateDrawer} from './StoreCreateDrawer';
import {StoreDetailDrawer} from './StoreDetailDrawer';
import {StoreEditDrawer} from './StoreEditDrawer';
import {StoreStatusModal} from './StoreStatusModal';

type StoreFilters = {name?: string; projectId?: string; code?: string; status?: OrganizationStoreStatus};
const page = adminCatalog.operationsPages.find((entry) => entry.pageDesignKey === operationsPageDesignKeys.PgOrgStoreManage);
const storePageTitle = page?.pageTitle;
if (!storePageTitle) throw new Error('ADMIN_CATALOG_STORE_PAGE_MISSING');

export function StoreManagementPage({queryContext, actionCapabilityKeys}: OperationsPageProps) {
  const [current, setCurrent] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filters, setFilters] = useState<StoreFilters>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<OrganizationStore>();
  const [statusTarget, setStatusTarget] = useState<OrganizationStore>();
  const [message, setMessage] = useState<string>();
  const [auditOpen, setAuditOpen] = useState(false);
  const detail = useDetailDrawer<OrganizationStore>();
  useOverlayLock(Boolean(statusTarget));
  const context = contextScopedQueryArgs({}, queryContext);
  const scopeReady = Boolean(queryContext.scopeRef);
  const listRequest = useMemo(() => operationsAdminRtkRequest.getOperationsOrganizationStores(
    {groupWorkspaceKey: queryContext.groupWorkspaceKey}, {query: {...context, ...filters, page: current, pageSize}},
  ), [context, current, filters, pageSize, queryContext.groupWorkspaceKey]);
  const list = operationsRtk.useGetOperationsOrganizationStoresQuery(listRequest, {skip: !scopeReady});
  const candidateRequest = useMemo(() => operationsAdminRtkRequest.getOperationsOrganizationStoreCandidates(
    {groupWorkspaceKey: queryContext.groupWorkspaceKey}, {query: context},
  ), [context, queryContext.groupWorkspaceKey]);
  const candidates = operationsRtk.useGetOperationsOrganizationStoreCandidatesQuery(candidateRequest, {skip: !scopeReady});
  const openDetail = useCallback((row: OrganizationStore) => {
    setMessage(undefined);
    detail.open(row);
  }, [detail]);
  const columns = useMemo<ProColumns<OrganizationStore>[]>(() => [
    {title: '门店名称', render: (_, row) => <Button type="link" onClick={() => void openDetail(row)} {...testId(`operations-store-open-detail-${row.id}`)}>{row.name}</Button>},
    {title: '编码', dataIndex: 'code'}, {title: '项目', render: (_, row) => row.project.name},
    {title: '品牌', render: (_, row) => row.brand.name}, {title: '经营租户', render: (_, row) => row.tenant.name},
    {title: '总公司', render: (_, row) => row.headCompany?.name ?? '未设置'},
    {title: '状态', dataIndex: 'status', valueEnum: {ENABLED: {text: '启用', status: 'Success'}, DISABLED: {text: '停用', status: 'Default'}}},
  ], [openDetail]);
  const problem = !scopeReady ? '请选择可查看范围。' : message ?? (list.error || candidates.error ? '门店数据暂时无法获取，请重试。' : undefined);
  const selected = detail.target;
  return <section {...testId('operations-store-page')}>
    {problem && <Alert type="error" showIcon message="门店管理未完成" description={problem} style={{marginBottom: 16}}/>}
    <Form<StoreFilters> layout="inline" style={{marginBottom: 16}} onFinish={(value) => { setFilters({name: value.name?.trim() || undefined, projectId: value.projectId, code: value.code?.trim() || undefined, status: value.status}); setCurrent(1); }}>
      <Form.Item name="name"><Input aria-label="门店名称" placeholder="门店名称" allowClear {...testId('operations-store-filter-name')}/></Form.Item>
      <Form.Item name="projectId"><Select aria-label="项目" showSearch allowClear placeholder="项目" options={(candidates.data?.projects ?? []).map((item) => ({value: item.id, label: `${item.name}（${item.code}）`}))} {...testId('operations-store-filter-project')}/></Form.Item>
      <Form.Item name="code"><Input aria-label="门店编码" placeholder="门店编码" allowClear {...testId('operations-store-filter-code')}/></Form.Item>
      <Form.Item name="status"><Select aria-label="状态" allowClear placeholder="状态" options={[{value: 'ENABLED', label: '启用'}, {value: 'DISABLED', label: '停用'}]} {...testId('operations-store-filter-status')}/></Form.Item>
      <Button type="primary" htmlType="submit" {...testId('operations-store-filter-submit')}>查询</Button>
    </Form>
    <ProTable<OrganizationStore> headerTitle={storePageTitle} rowKey="id" search={false} options={false} loading={list.isLoading && !list.data} dataSource={list.data?.items ?? []} columns={columns}
      toolBarRender={() => actionCapabilityKeys.includes(ACTION_CAPABILITIES.ORG_STORE_CREATE) ? [<Button key="create" type="primary" onClick={() => setCreateOpen(true)} {...testId('operations-store-create-open')}>新建门店</Button>] : []}
      pagination={{current, pageSize, total: list.data?.metadata.total ?? 0, showSizeChanger: true, onChange: (next, size) => { setCurrent(next); setPageSize(size); }}} locale={{emptyText: '暂无门店'}} {...testId('operations-store-table')}/>
    <StoreDetailDrawer store={detail.isOpen ? selected : undefined} queryContext={queryContext} canEdit={actionCapabilityKeys.includes(ACTION_CAPABILITIES.ORG_STORE_EDIT)} canTransition={actionCapabilityKeys.includes(ACTION_CAPABILITIES.ORG_STORE_STATUS)} onClose={detail.close} onAudit={() => setAuditOpen(true)} onEdit={setEditing} onStatus={setStatusTarget}/>
    <StoreCreateDrawer open={createOpen} queryContext={queryContext} onClose={() => setCreateOpen(false)} onCreated={(store) => { setCreateOpen(false); detail.open(store); }}/>
    <StoreEditDrawer store={editing} queryContext={queryContext} onClose={() => setEditing(undefined)} onUpdated={(store) => { setEditing(undefined); detail.open(store); }}/>
    <StoreStatusModal store={statusTarget} queryContext={queryContext} onClose={() => setStatusTarget(undefined)} onUpdated={(store) => { setStatusTarget(undefined); detail.open(store); }} onProblem={setMessage}/>
    <OperationsAuditHistoryModal open={auditOpen} target={selected ? {entityType: 'STORE', entityId: selected.id, displayName: selected.name} : undefined} groupWorkspaceKey={queryContext.groupWorkspaceKey} onClose={() => setAuditOpen(false)}/>
  </section>;
}
