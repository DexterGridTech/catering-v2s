import {ProTable} from '@ant-design/pro-components';
import {Alert, Button, Descriptions, Form, Input, Select, Space, Spin, Tabs, Tree, Typography} from 'antd';
import {contextScopedQueryArgs, testId, useDetailDrawer, useOverlayLock} from '@catering-v2s/admin-ui-foundation';
import {useMemo, useState, type ReactNode} from 'react';
import {WorkspaceScope} from '../../../app/state/WorkspaceScope';
import {platformAdminRtkRequest} from '../../../app/api/generated/platform-edge.rtk';
import {platformProblemOf, platformRtk, type PlatformApiProblem} from '../../../app/api/PlatformTransport';
import {adminCatalog, platformPageDesignKeys} from '../../../app/catalog/generatedAdminCatalog';
import type {ContractOverviewItem, OrganizationHierarchyTreeNode, OrganizationOverviewItem, StoreContractStatus} from '../../../app/api/generated/platform-edge';
import {ContractOverviewDetailDrawer} from './ContractOverviewDetailDrawer';
import {OrganizationOverviewDetailDrawer} from './OrganizationOverviewDetailDrawer';
import {filtersForOrganizationTab, organizationOverviewQuery, ownerFilterOptions, type OrganizationFilters, type OrganizationTab} from './OrganizationOverviewFilters';
import {PlatformAuditHistoryModal, type PlatformAuditTarget} from '../../audit-history';

type ContractFilters = {contractNo?: string; storeName?: string; phaseName?: string; tenantName?: string; itemCode?: string; status?: StoreContractStatus};

const organizationTabs: OrganizationTab[] = [
  {key: 'HIERARCHY', label: '组织架构', category: 'HIERARCHY'}, {key: 'BRAND', label: '品牌', category: 'BUSINESS_ENTITY', type: 'BRAND'},
  {key: 'TENANT', label: '经营租户', category: 'BUSINESS_ENTITY', type: 'TENANT'}, {key: 'HEAD_COMPANY', label: '总公司', category: 'BUSINESS_ENTITY', type: 'HEAD_COMPANY'},
  {key: 'STORE', label: '门店', category: 'STORE', type: 'STORE'},
];
const statusOptions = [{value: 'ENABLED', label: '已启用'}, {value: 'DISABLED', label: '已停用'}];
const sourceOptions = [{value: 'MANUAL', label: '人工维护'}, {value: 'SYSTEM', label: '系统生成'}];
const contractStatusOptions = [{value: 'VALID', label: '生效中'}, {value: 'INVALID', label: '已失效'}];
const statusLabel = (value: string) => value === 'ENABLED' ? '已启用' : value === 'DISABLED' ? '已停用' : value === 'VALID' ? '生效中' : '已失效';
const organizationOverviewPage = adminCatalog.platformPages.find((page) => page.pageDesignKey === platformPageDesignKeys.PlatformOrganizationOverview);
const contractOverviewPage = adminCatalog.platformPages.find((page) => page.pageDesignKey === platformPageDesignKeys.PlatformContractOverview);
if (!organizationOverviewPage || !contractOverviewPage) throw new Error('Missing generated platform overview page');
const organizationOverviewPageTitle = organizationOverviewPage.title;
const contractOverviewPageTitle = contractOverviewPage.title;

export function PlatformReadPage({kind}: {kind: 'organization' | 'contracts'}) {
  return <WorkspaceScope>{(groupWorkspaceKey) => <PlatformReadForWorkspace key={`${groupWorkspaceKey}-${kind}`} groupWorkspaceKey={groupWorkspaceKey} kind={kind}/>}</WorkspaceScope>;
}

type OrganizationTreeData = {key: string; title: ReactNode; children: OrganizationTreeData[]};

function treeNodes(nodes: OrganizationHierarchyTreeNode[], open: (id: string) => void): OrganizationTreeData[] {
  return nodes.map((node) => ({key: node.id, title: <Button type="link" onClick={() => open(node.id)}>{node.name}</Button>, children: treeNodes(node.children, open)}));
}

function PlatformReadForWorkspace({groupWorkspaceKey, kind}: {groupWorkspaceKey: string; kind: 'organization' | 'contracts'}) {
  const [organizationTab, setOrganizationTab] = useState('HIERARCHY');
  const [organizationFilters, setOrganizationFilters] = useState<OrganizationFilters>({});
  const [contractFilters, setContractFilters] = useState<ContractFilters>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [commandProblem, setProblem] = useState<PlatformApiProblem>();
  const [organizationForm] = Form.useForm<OrganizationFilters>();
  const [contractForm] = Form.useForm<ContractFilters>();
  const organizationDetail = useDetailDrawer<OrganizationOverviewItem>();
  const [hierarchyDetail, setHierarchyDetail] = useState<OrganizationOverviewItem>();
  const contractDetail = useDetailDrawer<ContractOverviewItem>();
  const [auditTarget, setAuditTarget] = useState<PlatformAuditTarget>();
  useOverlayLock(organizationDetail.isOpen || contractDetail.isOpen || Boolean(auditTarget));
  const tab = organizationTabs.find((item) => item.key === organizationTab) ?? organizationTabs[0];
  const context = useMemo(() => contextScopedQueryArgs({}, {groupWorkspaceKey}), [groupWorkspaceKey]);
  const organizationRequest = useMemo(() => platformAdminRtkRequest.getPlatformOrganizationOverviewPage({groupWorkspaceKey: context.groupWorkspaceKey}, {query: organizationOverviewQuery(tab, organizationFilters, page, pageSize)}), [context.groupWorkspaceKey, organizationFilters, page, pageSize, tab]);
  const contractRequest = useMemo(() => platformAdminRtkRequest.getPlatformContractOverviewPage({groupWorkspaceKey: context.groupWorkspaceKey}, {query: {...contractFilters, page, pageSize}}), [context.groupWorkspaceKey, contractFilters, page, pageSize]);
  const treeRequest = useMemo(() => platformAdminRtkRequest.getPlatformOrganizationHierarchyTree({groupWorkspaceKey: context.groupWorkspaceKey}, {}), [context.groupWorkspaceKey]);
  const organizationQuery = platformRtk.useGetPlatformOrganizationOverviewPageQuery(organizationRequest, {skip: kind !== 'organization' || tab.category === 'HIERARCHY'});
  const hierarchyQuery = platformRtk.useGetPlatformOrganizationHierarchyTreeQuery(treeRequest, {skip: kind !== 'organization' || tab.category !== 'HIERARCHY'});
  const contractQuery = platformRtk.useGetPlatformContractOverviewPageQuery(contractRequest, {skip: kind !== 'contracts'});
  const [loadOrganizationDetail] = platformRtk.useLazyGetPlatformOrganizationOverviewDetailQuery();
  const [loadContractDetail] = platformRtk.useLazyGetPlatformContractOverviewDetailQuery();
  const openOrganizationDetail = (itemId: string, category = tab.category) => {
    setProblem(undefined);
    void loadOrganizationDetail(platformAdminRtkRequest.getPlatformOrganizationOverviewDetail({groupWorkspaceKey: context.groupWorkspaceKey, category, itemId}, {})).unwrap().then((detail) => {
      if (category === 'HIERARCHY') setHierarchyDetail(detail);
      else organizationDetail.open(detail);
    }).catch((error) => setProblem(platformProblemOf(error)));
  };
  const openContractDetail = (contractId: string) => {
    setProblem(undefined);
    void loadContractDetail(platformAdminRtkRequest.getPlatformContractOverviewDetail({groupWorkspaceKey: context.groupWorkspaceKey, contractId}, {})).unwrap().then(contractDetail.open).catch((error) => setProblem(platformProblemOf(error)));
  };
  const queryError = kind === 'contracts' ? contractQuery.error : tab.category === 'HIERARCHY' ? hierarchyQuery.error : organizationQuery.error;
  const problem = queryError ? platformProblemOf(queryError) : commandProblem;
  const organizationPage = organizationQuery.data;
  const contractPage = contractQuery.data;
  const refresh = () => { if (kind === 'contracts') void contractQuery.refetch(); else if (tab.category === 'HIERARCHY') void hierarchyQuery.refetch(); else void organizationQuery.refetch(); };
  const submitOrganizationFilters = (next: OrganizationFilters) => { setOrganizationFilters(filtersForOrganizationTab(tab, next)); setPage(1); };
  const resetOrganizationFilters = () => { organizationForm.resetFields(); setOrganizationFilters({}); setPage(1); };
  const submitContractFilters = (next: ContractFilters) => { setContractFilters(next); setPage(1); };
  const resetContractFilters = () => { contractForm.resetFields(); setContractFilters({}); setPage(1); };
  return <>
    <Space style={{width: '100%', justifyContent: 'space-between', marginBottom: 12}}><Typography.Title level={4} style={{margin: 0}}>{kind === 'organization' ? organizationOverviewPageTitle : contractOverviewPageTitle}</Typography.Title><Button onClick={refresh} {...testId(`platform-${kind}-refresh`)}>刷新</Button></Space>
    {problem && <Alert type="error" showIcon message={problem.title} description={problem.detail} style={{marginBottom: 12}}/>}
    {kind === 'organization' && <Tabs activeKey={organizationTab} onChange={(key) => { const nextTab = organizationTabs.find((item) => item.key === key) ?? organizationTabs[0]; const nextFilters = filtersForOrganizationTab(nextTab, organizationForm.getFieldsValue()); setOrganizationTab(key); setOrganizationFilters(nextFilters); organizationForm.setFieldsValue(nextTab.category === 'STORE' ? nextFilters : {...nextFilters, projectId: undefined, brandId: undefined, tenantId: undefined}); setPage(1); }} items={organizationTabs.map((item) => ({key: item.key, label: item.label}))} {...testId('platform-organization-tabs')}/>} 
    {kind === 'organization' && tab.category !== 'HIERARCHY' && <Form form={organizationForm} layout="inline" onFinish={submitOrganizationFilters} style={{marginBottom: 12}}>
      <Form.Item name="name" label="名称"><Input allowClear placeholder="输入名称" {...testId('platform-organization-filter-name')}/></Form.Item><Form.Item name="code" label="编码"><Input allowClear placeholder="输入编码" {...testId('platform-organization-filter-code')}/></Form.Item><Form.Item name="status" label="状态"><Select allowClear style={{width: 120}} placeholder="全部" options={statusOptions} {...testId('platform-organization-filter-status')}/></Form.Item><Form.Item name="source" label="来源"><Select allowClear style={{width: 120}} placeholder="全部" options={sourceOptions} {...testId('platform-organization-filter-source')}/></Form.Item>
      {tab.category === 'STORE' && <><Form.Item name="projectId" label="项目"><Select allowClear showSearch optionFilterProp="label" style={{width: 180}} placeholder="全部" options={ownerFilterOptions(organizationPage?.filterOptions, 'PROJECT')} {...testId('platform-organization-filter-project')}/></Form.Item><Form.Item name="brandId" label="品牌"><Select allowClear showSearch optionFilterProp="label" style={{width: 180}} placeholder="全部" options={ownerFilterOptions(organizationPage?.filterOptions, 'BRAND')} {...testId('platform-organization-filter-brand')}/></Form.Item><Form.Item name="tenantId" label="经营租户"><Select allowClear showSearch optionFilterProp="label" style={{width: 180}} placeholder="全部" options={ownerFilterOptions(organizationPage?.filterOptions, 'TENANT')} {...testId('platform-organization-filter-tenant')}/></Form.Item></>}
      <Form.Item><Space><Button type="primary" htmlType="submit" {...testId('platform-organization-filter-submit')}>查询</Button><Button onClick={resetOrganizationFilters} {...testId('platform-organization-filter-reset')}>重置</Button></Space></Form.Item>
    </Form>}
    {kind === 'organization' && tab.category === 'HIERARCHY' && <div style={{display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) minmax(340px, 1.35fr)', gap: 16}}>
      <Spin spinning={hierarchyQuery.isLoading}><Tree showLine defaultExpandAll treeData={[{key: 'commercial-group', title: hierarchyQuery.data?.groupName ?? '商业集团', children: treeNodes(hierarchyQuery.data?.regions ?? [], (id) => openOrganizationDetail(id, 'HIERARCHY'))}]}/></Spin>
      <Descriptions title="组织详情" bordered size="small" column={1} items={hierarchyDetail ? [
        {key: 'name', label: '名称', children: hierarchyDetail.name}, {key: 'code', label: '编码', children: hierarchyDetail.code},
        {key: 'organization', label: '所属机构', children: hierarchyDetail.path.map((part) => part.name).join(' / ') || '—'},
        {key: 'status', label: '状态', children: statusLabel(hierarchyDetail.status)}, {key: 'notes', label: '备注', children: hierarchyDetail.notes || '—'},
        {key: 'updatedAt', label: '更新时间', children: new Date(hierarchyDetail.updatedAt).toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'})},
        ...(hierarchyDetail.extensionFields?.map((field) => ({key: `extension-${field.name}`, label: field.name, children: field.value || '—'})) ?? []),
      ] : [{key: 'empty', label: '提示', children: '请选择左侧组织查看详情。'}]}/>
    </div>}
    {kind === 'organization' && tab.category !== 'HIERARCHY' && <ProTable<OrganizationOverviewItem> rowKey="id" loading={organizationQuery.isLoading} dataSource={organizationPage?.items ?? []} search={false} options={false} pagination={organizationPage ? {current: organizationPage.metadata.page, pageSize: organizationPage.metadata.pageSize, total: organizationPage.metadata.total, onChange: (nextPage, nextPageSize) => { setPage(nextPage); setPageSize(nextPageSize); }} : false} columns={[
      {title: '名称', dataIndex: 'name', render: (_, row) => <Button type="link" onClick={() => openOrganizationDetail(row.id)}>{row.name}</Button>}, {title: '编码', dataIndex: 'code'}, {title: '状态', dataIndex: 'status', render: (_, row) => statusLabel(row.status)}, {title: '更新时间', dataIndex: 'updatedAt', valueType: 'dateTime'},
    ]}/>} 
    {kind === 'contracts' && <><Form form={contractForm} layout="inline" onFinish={submitContractFilters} style={{marginBottom: 12}}>
      <Form.Item name="contractNo" label="合同编号"><Input allowClear {...testId('platform-contract-filter-number')}/></Form.Item><Form.Item name="storeName" label="门店"><Input allowClear {...testId('platform-contract-filter-store')}/></Form.Item><Form.Item name="phaseName" label="分期"><Input allowClear {...testId('platform-contract-filter-phase')}/></Form.Item><Form.Item name="tenantName" label="经营租户"><Input allowClear {...testId('platform-contract-filter-tenant')}/></Form.Item><Form.Item name="itemCode" label="货号"><Input allowClear {...testId('platform-contract-filter-item')}/></Form.Item><Form.Item name="status" label="状态"><Select allowClear style={{width: 120}} placeholder="全部" options={contractStatusOptions} {...testId('platform-contract-filter-status')}/></Form.Item>
      <Form.Item><Space><Button type="primary" htmlType="submit" {...testId('platform-contract-filter-submit')}>查询</Button><Button onClick={resetContractFilters} {...testId('platform-contract-filter-reset')}>重置</Button></Space></Form.Item>
    </Form><ProTable<ContractOverviewItem> rowKey={(row) => row.contractRef.id} loading={contractQuery.isLoading} dataSource={contractPage?.items ?? []} search={false} options={false} pagination={contractPage ? {current: contractPage.metadata.page, pageSize: contractPage.metadata.pageSize, total: contractPage.metadata.total, onChange: (nextPage, nextPageSize) => { setPage(nextPage); setPageSize(nextPageSize); }} : false} columns={[
      {title: '合同编号', render: (_, row) => <Button type="link" onClick={() => openContractDetail(row.contractRef.id)}>{row.contractRef.code}</Button>}, {title: '门店', render: (_, row) => row.storeRef.name}, {title: '分期', dataIndex: 'phaseName'}, {title: '经营租户', render: (_, row) => row.tenantRef.name}, {title: '货号摘要', dataIndex: 'itemSummary', render: (_, row) => row.itemSummary || '—'}, {title: '状态', render: (_, row) => statusLabel(row.status)}, {title: '更新时间', dataIndex: 'updatedAt', valueType: 'dateTime'},
    ]}/></>}
    <OrganizationOverviewDetailDrawer item={organizationDetail.target} onClose={organizationDetail.close}/>
    <ContractOverviewDetailDrawer item={contractDetail.target} onClose={contractDetail.close} onAudit={() => contractDetail.target && setAuditTarget({entityType: 'STORE_CONTRACT', entityId: contractDetail.target.contractRef.id, displayName: contractDetail.target.contractRef.code})}/>
    <PlatformAuditHistoryModal open={Boolean(auditTarget)} target={auditTarget} groupWorkspaceKey={groupWorkspaceKey} onClose={() => setAuditTarget(undefined)}/>
  </>;
}
