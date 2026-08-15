import {ProTable} from '@ant-design/pro-components';
import {Alert, Button, Card, Descriptions, Empty, Input, Spin, Tabs, Tag, Tree} from 'antd';
import {adminHierarchyCollator, adminListState, contextScopedQueryArgs, NameCodeText, testId, useAsyncGenerationGuard, useDetailDrawer, useOverlayLock} from '@catering-v2s/admin-ui-foundation';
import {useMemo, useState, type ReactNode} from 'react';
import {WorkspaceScope} from '../../../app/state/WorkspaceScope';
import {platformAdminRtkRequest} from '../../../app/api/generated/platform-edge.rtk';
import {platformProblemOf, platformRtk, type PlatformApiProblem} from '../../../app/api/PlatformTransport';
import type {ContractOverviewItem, OrganizationHierarchyTreeNode, OrganizationOverviewItem, OrganizationOverviewStatus, StoreContractSortDirection, StoreContractSortKey, StoreContractStatus} from '../../../app/api/generated/platform-edge';
import {wireUuid} from '../../../app/api/wireUuid';
import {ContractOverviewDetailDrawer} from './ContractOverviewDetailDrawer';
import {OrganizationOverviewDetailDrawer} from './OrganizationOverviewDetailDrawer';
import {defaultOrganizationTabQueryState, filtersForOrganizationTab, organizationOverviewQuery, ownerFilterOptions, updateOrganizationTabQueryState, type OrganizationFilters, type OrganizationTab, type OrganizationTabQueryState} from './OrganizationOverviewFilters';
import {PlatformAuditHistoryModal, type PlatformAuditTarget} from '../../audit-history';
import {organizationOverviewExtensionItems} from './OrganizationOverviewPresentation';
import {usePlatformOrganizationCandidates} from '../../../app/queries/usePlatformOrganizationCandidates';

type ContractFilters = {contractNo?: string; storeId?: string; phaseName?: string; tenantId?: string; itemCode?: string; status?: StoreContractStatus};

const organizationTabs: OrganizationTab[] = [
  {key: 'HIERARCHY', label: '组织架构', category: 'HIERARCHY'}, {key: 'BRAND', label: '品牌', category: 'BUSINESS_ENTITY', type: 'BRAND'},
  {key: 'TENANT', label: '经营租户', category: 'BUSINESS_ENTITY', type: 'TENANT'}, {key: 'HEAD_COMPANY', label: '总公司', category: 'BUSINESS_ENTITY', type: 'HEAD_COMPANY'},
  {key: 'STORE', label: '门店', category: 'STORE', type: 'STORE'},
];
const statusLabel = (value: string) => value === 'ENABLED' ? '已启用' : value === 'DISABLED' ? '已停用' : value === 'VALID' ? '生效中' : '已失效';
export function PlatformReadPage({kind}: {kind: 'organization' | 'contracts'}) {
  return <WorkspaceScope>{(groupWorkspaceKey) => <PlatformReadForWorkspace key={`${groupWorkspaceKey}-${kind}`} groupWorkspaceKey={groupWorkspaceKey} kind={kind}/>}</WorkspaceScope>;
}

type OrganizationTreeData = {key: string; title: ReactNode; children: OrganizationTreeData[]};
type OrganizationHierarchyDetail = Omit<OrganizationOverviewItem, 'extensionFields'> & {extensionFields: ReturnType<typeof organizationOverviewExtensionItems>};

const hierarchyTypeLabels = {GROUP: '集团', REGION: '大区', PROJECT: '项目'} as const;
const hierarchyNameCollator = adminHierarchyCollator;

function hierarchyNodeTitle(type: keyof typeof hierarchyTypeLabels, name: string, code: string, status: OrganizationOverviewStatus): ReactNode {
  return <span><Tag color="cyan">{hierarchyTypeLabels[type]}</Tag><span>{<NameCodeText name={name} code={code}/>}</span>{status === 'DISABLED' && <Tag color="default">已停用</Tag>}</span>;
}

function treeNodes(nodes: OrganizationHierarchyTreeNode[]): OrganizationTreeData[] {
  return [...nodes].sort((left, right) => hierarchyNameCollator.compare(left.name, right.name)).map((node) => ({key: node.id, title: hierarchyNodeTitle(node.type, node.name, node.code, node.status), children: treeNodes(node.children)}));
}

function hierarchySearchMatches(node: Pick<OrganizationHierarchyTreeNode, 'name' | 'code'>, query: string) {
  const normalized = query.trim().toLocaleLowerCase('zh-CN');
  return !normalized || node.name.toLocaleLowerCase('zh-CN').includes(normalized) || node.code.toLocaleLowerCase('zh-CN').includes(normalized);
}

function filterHierarchyNodes(nodes: OrganizationHierarchyTreeNode[], query: string): OrganizationHierarchyTreeNode[] {
  return [...nodes].sort((left, right) => hierarchyNameCollator.compare(left.name, right.name)).flatMap((node) => {
    const children = filterHierarchyNodes(node.children, query);
    return hierarchySearchMatches(node, query) || children.length ? [{...node, children}] : [];
  });
}

function findHierarchyNode(nodes: OrganizationHierarchyTreeNode[], id: string): OrganizationHierarchyTreeNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const child = findHierarchyNode(node.children, id);
    if (child) return child;
  }
  return undefined;
}

function hierarchyDetailPresentation(item: OrganizationOverviewItem): OrganizationHierarchyDetail {
  return {...item, extensionFields: (item.extensionFields ?? []).map((field) => ({key: `extension-${field.name}`, label: field.name, children: field.value || '—'}))};
}

function PlatformReadForWorkspace({groupWorkspaceKey, kind}: {groupWorkspaceKey: string; kind: 'organization' | 'contracts'}) {
  const [organizationTab, setOrganizationTab] = useState('HIERARCHY');
  const [organizationTabStates, setOrganizationTabStates] = useState<Record<string, OrganizationTabQueryState>>({});
  const [contractFilters, setContractFilters] = useState<ContractFilters>({});
  const [contractStoreSearch, setContractStoreSearch] = useState('');
  const [contractTenantSearch, setContractTenantSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [contractSort, setContractSort] = useState<StoreContractSortKey>('UPDATED_AT');
  const [contractDirection, setContractDirection] = useState<StoreContractSortDirection>('DESC');
  const [commandProblem, setProblem] = useState<PlatformApiProblem>();
  const organizationDetail = useDetailDrawer<OrganizationOverviewItem>();
  const [hierarchyDetail, setHierarchyDetail] = useState<OrganizationHierarchyDetail>();
  const [hierarchyNodeId, setHierarchyNodeId] = useState<string>();
  const [hierarchySearch, setHierarchySearch] = useState('');
  const contractDetail = useDetailDrawer<ContractOverviewItem>();
  const organizationDetailGeneration = useAsyncGenerationGuard();
  const contractDetailGeneration = useAsyncGenerationGuard();
  const [auditTarget, setAuditTarget] = useState<PlatformAuditTarget>();
  useOverlayLock(organizationDetail.isOpen || contractDetail.isOpen || Boolean(auditTarget));
  const tab = organizationTabs.find((item) => item.key === organizationTab) ?? organizationTabs[0];
  const legalEntityTab = tab.category === 'BUSINESS_ENTITY' && (tab.type === 'TENANT' || tab.type === 'HEAD_COMPANY');
  const organizationTabState = organizationTabStates[tab.key] ?? defaultOrganizationTabQueryState;
  const context = useMemo(() => contextScopedQueryArgs({}, {groupWorkspaceKey}), [groupWorkspaceKey]);
  const workspaceDetailRequest = useMemo(() => platformAdminRtkRequest.getPlatformGroupWorkspaceDetail({groupWorkspaceKey: context.groupWorkspaceKey}, {}), [context.groupWorkspaceKey]);
  const organizationRequest = useMemo(() => platformAdminRtkRequest.getPlatformOrganizationOverviewPage({groupWorkspaceKey: context.groupWorkspaceKey}, {query: organizationOverviewQuery(tab, organizationTabState.filters, organizationTabState.page, organizationTabState.pageSize, organizationTabState.sort, organizationTabState.direction)}), [context.groupWorkspaceKey, organizationTabState, tab]);
  const contractRequest = useMemo(() => {
    const {storeId, tenantId, ...restFilters} = contractFilters;
    return platformAdminRtkRequest.getPlatformContractOverviewPage({groupWorkspaceKey: context.groupWorkspaceKey}, {query: {...restFilters, ...(storeId ? {storeId: wireUuid(storeId)} : {}), ...(tenantId ? {tenantId: wireUuid(tenantId)} : {}), sort: contractSort, direction: contractDirection, page, pageSize}});
  }, [context.groupWorkspaceKey, contractDirection, contractFilters, contractSort, page, pageSize]);
  const treeRequest = useMemo(() => platformAdminRtkRequest.getPlatformOrganizationHierarchyTree({groupWorkspaceKey: context.groupWorkspaceKey}, {}), [context.groupWorkspaceKey]);
  const commercialGroupDefinitionRequest = useMemo(() => platformAdminRtkRequest.getExtensionDefinition({groupWorkspaceKey: context.groupWorkspaceKey, entityType: 'COMMERCIAL_GROUP'}, {}), [context.groupWorkspaceKey]);
  const organizationQuery = platformRtk.useGetPlatformOrganizationOverviewPageQuery(organizationRequest, {skip: kind !== 'organization' || tab.category === 'HIERARCHY'});
  const workspaceDetailQuery = platformRtk.useGetPlatformGroupWorkspaceDetailQuery(workspaceDetailRequest, {skip: kind !== 'organization' || tab.category !== 'HIERARCHY'});
  const workspaceIsInitialized = workspaceDetailQuery.data?.commercialGroup?.initialized === true;
  // A selected enabled workspace can legitimately be awaiting commercial-group
  // initialization. Its hierarchy has no owner root, so do not issue task reads
  // whose documented owner response is not-found for that state.
  const hierarchyQuery = platformRtk.useGetPlatformOrganizationHierarchyTreeQuery(treeRequest, {skip: kind !== 'organization' || tab.category !== 'HIERARCHY' || !workspaceIsInitialized});
  const commercialGroupDefinitionQuery = platformRtk.useGetExtensionDefinitionQuery(commercialGroupDefinitionRequest, {skip: kind !== 'organization' || tab.category !== 'HIERARCHY' || !workspaceIsInitialized});
  const contractQuery = platformRtk.useGetPlatformContractOverviewPageQuery(contractRequest, {skip: kind !== 'contracts'});
  const contractStoreCandidates = usePlatformOrganizationCandidates({open: kind === 'contracts', groupWorkspaceKey: context.groupWorkspaceKey, subjectType: 'STORE', queryText: contractStoreSearch, selectedId: contractFilters.storeId});
  const contractTenantCandidates = usePlatformOrganizationCandidates({open: kind === 'contracts', groupWorkspaceKey: context.groupWorkspaceKey, subjectType: 'TENANT', queryText: contractTenantSearch, selectedId: contractFilters.tenantId});
  const [loadOrganizationDetail] = platformRtk.useLazyGetPlatformOrganizationOverviewDetailQuery();
  const [loadContractDetail] = platformRtk.useLazyGetPlatformContractOverviewDetailQuery();
  const openOrganizationDetail = (itemId: string, category = tab.category) => {
    const request = organizationDetailGeneration.begin();
    setProblem(undefined);
    if (category === 'HIERARCHY') setHierarchyNodeId(itemId);
    if (category !== 'HIERARCHY') organizationDetail.openLoading();
    void loadOrganizationDetail(platformAdminRtkRequest.getPlatformOrganizationOverviewDetail({groupWorkspaceKey: context.groupWorkspaceKey, category, itemId}, {})).unwrap().then((detail) => {
      if (!organizationDetailGeneration.isCurrent(request)) return;
      if (category === 'HIERARCHY') setHierarchyDetail(hierarchyDetailPresentation(detail));
      else organizationDetail.open(detail);
    }).catch((error) => {
      if (organizationDetailGeneration.isCurrent(request)) { organizationDetail.finishLoading(); setProblem(platformProblemOf(error)); }
    });
  };
  const openContractDetail = (contractId: string) => {
    const request = contractDetailGeneration.begin();
    setProblem(undefined);
    contractDetail.openLoading();
    void loadContractDetail(platformAdminRtkRequest.getPlatformContractOverviewDetail({groupWorkspaceKey: context.groupWorkspaceKey, contractId}, {})).unwrap().then((detail) => {
      if (contractDetailGeneration.isCurrent(request)) contractDetail.open(detail);
    }).catch((error) => {
      if (contractDetailGeneration.isCurrent(request)) { contractDetail.finishLoading(); setProblem(platformProblemOf(error)); }
    });
  };
  const closeOrganizationDetail = () => { organizationDetailGeneration.invalidate(); organizationDetail.close(); };
  const closeContractDetail = () => { contractDetailGeneration.invalidate(); contractDetail.close(); };
  const hierarchyError = workspaceDetailQuery.error ?? (workspaceIsInitialized ? hierarchyQuery.error ?? commercialGroupDefinitionQuery.error : undefined);
  const queryError = kind === 'contracts' ? contractQuery.error : tab.category === 'HIERARCHY' ? hierarchyError : organizationQuery.error;
  const problem = queryError ? platformProblemOf(queryError) : commandProblem;
  const organizationPage = organizationQuery.data;
  const contractPage = contractQuery.data;
  const hierarchyLoading = (workspaceDetailQuery.isLoading || (workspaceIsInitialized && (hierarchyQuery.isLoading || commercialGroupDefinitionQuery.isLoading))) && !queryError;
  // This is a presentation projection of two real owner readbacks, not a persisted or synthetic GROUP node.
  const workspaceDetail = workspaceDetailQuery.data;
  const hierarchyRoot = workspaceDetail?.commercialGroup?.root;
  const selectedHierarchyNode = hierarchyNodeId && hierarchyQuery.data ? findHierarchyNode(hierarchyQuery.data.regions, hierarchyNodeId) : undefined;
  const hierarchyRootProjection = workspaceDetail && hierarchyRoot && hierarchyQuery.data ? {
    id: hierarchyRoot.id,
    groupWorkspaceKey: hierarchyRoot.groupWorkspaceKey,
    category: 'HIERARCHY' as const,
    type: 'GROUP' as const,
    code: hierarchyRoot.groupCode,
    name: hierarchyRoot.groupName,
    path: [{id: hierarchyRoot.id, code: hierarchyRoot.groupCode, name: hierarchyRoot.groupName, resolved: true}],
    status: workspaceDetail.status,
    source: 'MANUAL' as const,
    version: hierarchyRoot.version,
    createdAt: hierarchyRoot.createdAt,
    updatedAt: hierarchyRoot.updatedAt,
    notes: undefined,
    unresolvedReferences: [],
    extensionFields: organizationOverviewExtensionItems(commercialGroupDefinitionQuery.data, hierarchyRoot.extensionValues),
  } : undefined;
  const filteredHierarchyRegions = hierarchyQuery.data ? filterHierarchyNodes(hierarchyQuery.data.regions, hierarchySearch) : [];
  const hierarchyRootMatchesSearch = hierarchyRootProjection ? hierarchySearchMatches(hierarchyRootProjection, hierarchySearch) : false;
  const hierarchyTreeData = hierarchyRootProjection && (!hierarchySearch.trim() || hierarchyRootMatchesSearch || filteredHierarchyRegions.length) ? [{key: hierarchyRootProjection.id, title: hierarchyNodeTitle('GROUP', hierarchyRootProjection.name, hierarchyRootProjection.code, hierarchyRootProjection.status), children: treeNodes(hierarchyRootMatchesSearch ? hierarchyQuery?.data?.regions ?? [] : filteredHierarchyRegions)}] : [];
  const displayedHierarchyDetail = hierarchyNodeId === hierarchyRootProjection?.id ? hierarchyRootProjection : hierarchyDetail;
  const organizationListState = adminListState({loading: organizationQuery.isLoading && !organizationPage && !organizationQuery.error, failed: Boolean(organizationQuery.error), emptyText: `暂无${tab.label}`, testIdPrefix: 'platform-organization-list'});
  const contractListState = adminListState({loading: contractQuery.isLoading && !contractPage && !contractQuery.error, failed: Boolean(contractQuery.error), emptyText: '暂无合同', testIdPrefix: 'platform-contract-list'});
  const updateOrganizationTabState = (key: string, patch: Partial<OrganizationTabQueryState>) => {
    setOrganizationTabStates((current) => updateOrganizationTabQueryState(current, key, patch));
  };
  const submitOrganizationFilters = (next: OrganizationFilters) => { updateOrganizationTabState(tab.key, {filters: filtersForOrganizationTab(tab, next), page: 1}); };
  const resetOrganizationFilters = () => { updateOrganizationTabState(tab.key, {filters: {}, page: 1}); };
  const submitContractFilters = (next: ContractFilters) => { setContractFilters(next); setPage(1); };
  const resetContractFilters = () => { setContractFilters({}); setPage(1); };
  const hierarchyPage = kind === 'organization' && tab.category === 'HIERARCHY';
  return <div className={hierarchyPage ? 'platform-organization-hierarchy-page' : undefined}>
    {problem && <Alert type="error" showIcon title={problem.title} description={problem.detail} style={{marginBottom: 12}} {...testId(`platform-${kind}-list-error`)}/>}
    {kind === 'organization' && <Tabs activeKey={organizationTab} onChange={setOrganizationTab} items={organizationTabs.map((item) => ({key: item.key, label: item.label}))} {...testId('platform-organization-tabs')}/>}
    {hierarchyPage && <div className="platform-organization-hierarchy-layout">
      {hierarchyLoading ? <Spin description={<span {...testId('platform-organization-hierarchy-loading')}>正在加载</span>}/> : problem ? null : !workspaceIsInitialized ? <Empty description={<span {...testId('platform-organization-hierarchy-uninitialized')}>当前集团空间尚未初始化商业集团</span>}/> : !hierarchyQuery.data || !hierarchyRootProjection ? <Empty description={<span {...testId('platform-organization-hierarchy-empty')}>暂无组织架构</span>}/> : <Card className="platform-organization-hierarchy-panel platform-organization-hierarchy-tree-panel" classNames={{body: 'platform-organization-hierarchy-tree-panel-body'}} size="small" title="组织架构"><Input allowClear placeholder="按名称或编码搜索" value={hierarchySearch} onChange={(event) => setHierarchySearch(event.target.value)} {...testId('platform-organization-hierarchy-search')}/><div className="platform-organization-hierarchy-tree-scroll">{hierarchyTreeData.length ? <Tree showLine defaultExpandAll selectedKeys={hierarchyNodeId ? [hierarchyNodeId] : []} onSelect={(keys) => { const id = String(keys[0] ?? ''); if (!id) return; if (id === hierarchyRootProjection.id) { setHierarchyNodeId(id); setHierarchyDetail(hierarchyRootProjection); return; } openOrganizationDetail(id, 'HIERARCHY'); }} treeData={hierarchyTreeData} {...testId('platform-organization-hierarchy-tree')}/> : <Empty description="未找到匹配的组织"/>}</div></Card>}
      <Card className="platform-organization-hierarchy-panel platform-organization-hierarchy-detail-panel" classNames={{body: 'platform-organization-hierarchy-detail-panel-body'}} size="small" title="组织详情"><Descriptions bordered size="small" column={1} styles={{label: {width: 164}}} items={displayedHierarchyDetail ? [
        {key: 'name', label: '名称', children: displayedHierarchyDetail.name},
        {key: 'code', label: '编码', children: displayedHierarchyDetail.code},
        {key: 'status', label: '状态', children: statusLabel(displayedHierarchyDetail.status)}, {key: 'notes', label: '备注', children: displayedHierarchyDetail.notes || '—'},
        ...(displayedHierarchyDetail.type === 'PROJECT' ? [{key: 'phases', label: '项目分期名称', children: selectedHierarchyNode?.phases?.join('、') || '—'}] : []),
        {key: 'updatedAt', label: '更新时间', children: new Date(displayedHierarchyDetail.updatedAt).toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'})},
        ...displayedHierarchyDetail.extensionFields,
      ] : [{key: 'empty', label: '提示', children: '请选择左侧组织查看详情。'}]}/></Card>
    </div>}
    {kind === 'organization' && tab.category !== 'HIERARCHY' && <div {...testId('platform-organization-table')}><ProTable<OrganizationOverviewItem> size="small" key={tab.key} rowKey="id" loading={organizationListState.loading} locale={organizationListState.locale} dataSource={organizationPage?.items ?? []} options={false}
       search={{labelWidth: 'auto', optionRender: (searchConfig) => [<Button key="submit" type="primary" onClick={() => searchConfig.form?.submit()} {...testId('platform-organization-filter-submit')}>查询</Button>, <Button key="reset" onClick={() => { searchConfig.form?.resetFields(); searchConfig.form?.setFieldsValue({name: undefined, code: undefined, legalName: undefined, unifiedSocialCreditCode: undefined, status: undefined, source: undefined, projectId: undefined, brandId: undefined, tenantId: undefined, headCompanyId: undefined}); resetOrganizationFilters(); }} {...testId('platform-organization-filter-reset')}>重置</Button>]}}
       form={{initialValues: organizationTabState.filters}}
       onSubmit={(value) => submitOrganizationFilters({name: value.name?.trim() || undefined, code: value.code?.trim() || undefined, legalName: value.legalName?.trim() || undefined, unifiedSocialCreditCode: value.unifiedSocialCreditCode?.trim() || undefined, status: value.status, source: value.source, projectId: value.projectId, brandId: value.brandId, tenantId: value.tenantId, headCompanyId: value.headCompanyId})}
      pagination={organizationPage ? {current: organizationPage.metadata.page, pageSize: organizationPage.metadata.pageSize, total: organizationPage.metadata.total} : false}
      onChange={(pagination, _, sorter, extra) => { if (extra.action === 'paginate') { updateOrganizationTabState(tab.key, {page: pagination.current ?? organizationTabState.page, pageSize: pagination.pageSize ?? organizationTabState.pageSize}); return; } if (extra.action !== 'sort') return; const current = Array.isArray(sorter) ? sorter[0] : sorter; if (!current?.order) { updateOrganizationTabState(tab.key, {sort: 'UPDATED_AT', direction: 'DESC'}); return; } const nextSort = current.columnKey === 'name' ? 'NAME' : current.columnKey === 'code' ? 'CODE' : 'UPDATED_AT'; updateOrganizationTabState(tab.key, {sort: nextSort, direction: current.order === 'ascend' ? 'ASC' : 'DESC', page: 1}); }}
      columns={[
        {key: 'name', title: '名称', dataIndex: 'name', sorter: true, fieldProps: {...testId('platform-organization-filter-name'), allowClear: true, placeholder: '输入名称'}, render: (_, row) => <Button type="link" onClick={() => openOrganizationDetail(row.id)} {...testId(`platform-organization-detail-${row.id}`)}>{row.name}</Button>},
        {key: 'code', title: '编码', dataIndex: 'code', sorter: true, fieldProps: {...testId('platform-organization-filter-code'), allowClear: true, placeholder: '输入编码'}},
        ...(legalEntityTab ? [
          {key: 'legalName', title: '法人公司', dataIndex: 'legalName', fieldProps: {...testId('platform-organization-filter-legal-name'), allowClear: true, placeholder: '输入法人公司'}},
          {key: 'unifiedSocialCreditCode', title: '统一代码', dataIndex: 'unifiedSocialCreditCode', fieldProps: {...testId('platform-organization-filter-unified-code'), allowClear: true, placeholder: '输入统一代码'}},
        ] : []),
        ...(tab.type === 'BRAND' ? [{title: '别名', dataIndex: 'alias', search: false, render: (_: unknown, row: OrganizationOverviewItem) => row.alias || '—'}] : []),
        {title: '状态', dataIndex: 'status', valueType: 'select', valueEnum: {ENABLED: {text: '已启用'}, DISABLED: {text: '已停用'}}, fieldProps: {...testId('platform-organization-filter-status'), allowClear: true, placeholder: '全部'}, render: (_, row) => statusLabel(row.status)},
        {title: '来源', dataIndex: 'source', valueType: 'select', valueEnum: {MANUAL: {text: '人工维护'}, SYSTEM: {text: '系统生成'}}, fieldProps: {...testId('platform-organization-filter-source'), allowClear: true, placeholder: '全部'}},
        ...(tab.category === 'STORE' ? [
          {title: '项目', dataIndex: 'projectId', valueType: 'select' as const, hideInTable: true, fieldProps: {...testId('platform-organization-filter-project'), allowClear: true, showSearch: {optionFilterProp: 'label'}, options: ownerFilterOptions(organizationPage?.filterOptions, 'PROJECT'), placeholder: '全部'}},
          {title: '品牌', dataIndex: 'brandId', valueType: 'select' as const, hideInTable: true, fieldProps: {...testId('platform-organization-filter-brand'), allowClear: true, showSearch: {optionFilterProp: 'label'}, options: ownerFilterOptions(organizationPage?.filterOptions, 'BRAND'), placeholder: '全部'}},
          {title: '经营租户', dataIndex: 'tenantId', valueType: 'select' as const, hideInTable: true, fieldProps: {...testId('platform-organization-filter-tenant'), allowClear: true, showSearch: {optionFilterProp: 'label'}, options: ownerFilterOptions(organizationPage?.filterOptions, 'TENANT'), placeholder: '全部'}},
          {title: '总公司', dataIndex: 'headCompanyId', valueType: 'select' as const, hideInTable: true, fieldProps: {...testId('platform-organization-filter-head-company'), allowClear: true, showSearch: {optionFilterProp: 'label'}, options: ownerFilterOptions(organizationPage?.filterOptions, 'HEAD_COMPANY'), placeholder: '全部'}},
          {title: '项目', dataIndex: 'project', search: false, render: (_: unknown, row: OrganizationOverviewItem) => row.project ? <NameCodeText name={row.project.name} code={row.project.code}/> : '—'},
          {title: '品牌', dataIndex: 'brand', search: false, render: (_: unknown, row: OrganizationOverviewItem) => row.brand ? <NameCodeText name={row.brand.name} code={row.brand.code}/> : '—'},
          {title: '经营租户', dataIndex: 'tenant', search: false, render: (_: unknown, row: OrganizationOverviewItem) => row.tenant ? <NameCodeText name={row.tenant.name} code={row.tenant.code}/> : '—'},
          {title: '总公司', dataIndex: 'headCompany', search: false, render: (_: unknown, row: OrganizationOverviewItem) => row.headCompany ? <NameCodeText name={row.headCompany.name} code={row.headCompany.code}/> : '未设置'},
        ] : []),
        {title: '备注', dataIndex: 'notes', search: false, render: (_: unknown, row: OrganizationOverviewItem) => row.notes || '—'},
        {key: 'updatedAt', title: '更新时间', dataIndex: 'updatedAt', valueType: 'dateTime', sorter: true, search: false},
      ]}
    /></div>}
    {kind === 'contracts' && <div {...testId('platform-contract-table')}><ProTable<ContractOverviewItem> size="small" rowKey={(row) => row.contractRef.id} loading={contractListState.loading} locale={contractListState.locale} dataSource={contractPage?.items ?? []} options={false}
       search={{labelWidth: 'auto', optionRender: (searchConfig) => [<Button key="submit" type="primary" onClick={() => searchConfig.form?.submit()} {...testId('platform-contract-filter-submit')}>查询</Button>, <Button key="reset" onClick={() => { searchConfig.form?.resetFields(); searchConfig.form?.setFieldsValue({contractNo: undefined, storeId: undefined, phaseName: undefined, tenantId: undefined, itemCode: undefined, status: undefined}); setContractStoreSearch(''); setContractTenantSearch(''); resetContractFilters(); }} {...testId('platform-contract-filter-reset')}>重置</Button>]}}
       form={{initialValues: contractFilters}}
      onSubmit={(value) => submitContractFilters({contractNo: value.contractNo?.trim() || undefined, storeId: value.storeId, phaseName: value.phaseName?.trim() || undefined, tenantId: value.tenantId, itemCode: value.itemCode?.trim() || undefined, status: value.status})}
      pagination={contractPage ? {current: contractPage.metadata.page, pageSize: contractPage.metadata.pageSize, total: contractPage.metadata.total} : false}
      onChange={(pagination, _, sorter, extra) => { if (extra.action === 'paginate') { setPage(pagination.current ?? page); setPageSize(pagination.pageSize ?? pageSize); return; } if (extra.action !== 'sort') return; const current = Array.isArray(sorter) ? sorter[0] : sorter; if (!current?.order) { setContractSort('UPDATED_AT'); setContractDirection('DESC'); return; } const nextSort = current.columnKey === 'contractNo' ? 'CONTRACT_NO' : current.columnKey === 'effectiveFrom' ? 'EFFECTIVE_FROM' : 'UPDATED_AT'; setContractSort(nextSort); setContractDirection(current.order === 'ascend' ? 'ASC' : 'DESC'); setPage(1); }}
      columns={[
        {key: 'contractNo', title: '合同编号', dataIndex: 'contractNo', sorter: true, fieldProps: {...testId('platform-contract-filter-number'), allowClear: true}, render: (_, row) => <Button type="link" onClick={() => openContractDetail(row.contractRef.id)} {...testId(`platform-contract-detail-${row.contractRef.id}`)}>{row.contractRef.code}</Button>},
        {title: '门店', dataIndex: 'storeId', hideInTable: true, valueType: 'select', fieldProps: {allowClear: true, showSearch: {filterOption: false, onSearch: setContractStoreSearch}, onPopupScroll: contractStoreCandidates.onPopupScroll, loading: contractStoreCandidates.isFetching, options: contractStoreCandidates.items.map((item) => ({value: item.id, label: <NameCodeText name={item.name} code={item.code}/>})), placeholder: '搜索门店名称或编码', ...testId('platform-contract-filter-store')}},
        {title: '分期', dataIndex: 'phaseName', hideInTable: true, fieldProps: {...testId('platform-contract-filter-phase'), allowClear: true, placeholder: '输入项目分期'}},
        {title: '经营租户', dataIndex: 'tenantId', hideInTable: true, valueType: 'select', fieldProps: {allowClear: true, showSearch: {filterOption: false, onSearch: setContractTenantSearch}, onPopupScroll: contractTenantCandidates.onPopupScroll, loading: contractTenantCandidates.isFetching, options: contractTenantCandidates.items.map((item) => ({value: item.id, label: <NameCodeText name={item.name} code={item.code}/>})), placeholder: '搜索经营租户名称或编码', ...testId('platform-contract-filter-tenant')}},
        {title: '货号', dataIndex: 'itemCode', hideInTable: true, fieldProps: {...testId('platform-contract-filter-item-code'), allowClear: true, placeholder: '输入货号'}},
        {title: '项目', dataIndex: 'projectRef', search: false, render: (_, row) => <NameCodeText name={row.projectRef.name} code={row.projectRef.code}/>},
        {title: '门店', dataIndex: 'storeRef', search: false, render: (_, row) => <NameCodeText name={row.storeRef.name} code={row.storeRef.code}/>},
        {title: '分期', dataIndex: 'phaseName', search: false},
        {title: '经营租户', dataIndex: 'tenantRef', search: false, render: (_, row) => <NameCodeText name={row.tenantRef.name} code={row.tenantRef.code}/>},
        {title: '起止日期', key: 'effectiveFrom', search: false, sorter: true, render: (_, row) => `${row.effectiveFrom} 至 ${row.effectiveTo ?? '长期'}`},
        {title: '货号', dataIndex: 'itemSummary', search: false, render: (_, row) => row.itemSummary || row.items.map((item) => item.code).join('、') || '—'},
        {title: '货号数量', dataIndex: 'items', search: false, render: (_, row) => String(row.items?.length ?? 0)},
        {title: '状态', dataIndex: 'status', valueType: 'select', valueEnum: {VALID: {text: '生效中'}, INVALID: {text: '已失效'}}, fieldProps: {...testId('platform-contract-filter-status'), allowClear: true, placeholder: '全部'}, render: (_, row) => statusLabel(row.status)},
        {key: 'updatedAt', title: '更新时间', dataIndex: 'updatedAt', valueType: 'dateTime', sorter: true, search: false},
      ]}
    /></div>}
    <OrganizationOverviewDetailDrawer open={organizationDetail.isOpen} loading={organizationDetail.loading} problem={problem} item={organizationDetail.target} onClose={closeOrganizationDetail}/>
    <ContractOverviewDetailDrawer open={contractDetail.isOpen} loading={contractDetail.loading} problem={problem} item={contractDetail.target} onClose={closeContractDetail} onAudit={() => contractDetail.target && setAuditTarget({entityType: 'STORE_CONTRACT', entityId: contractDetail.target.contractRef.id, displayName: contractDetail.target.contractRef.code})}/>
    <PlatformAuditHistoryModal open={Boolean(auditTarget)} target={auditTarget} groupWorkspaceKey={groupWorkspaceKey} onClose={() => setAuditTarget(undefined)}/>
  </div>;
}
