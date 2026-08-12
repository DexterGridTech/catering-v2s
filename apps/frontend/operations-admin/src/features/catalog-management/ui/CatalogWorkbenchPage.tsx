import {AppstoreOutlined, BulbOutlined, ClockCircleOutlined, CustomerServiceOutlined, GiftOutlined, HistoryOutlined, InboxOutlined, ShoppingOutlined, StopOutlined, SyncOutlined, TagsOutlined, ToolOutlined} from '@ant-design/icons';
import {Alert, Button, Card, Dropdown, Form, Input, Modal, Segmented, Select, Skeleton, Space, Tag, Tree, Typography} from 'antd';
import {ProTable, type ProColumns} from '@ant-design/pro-components';
import {adminListState, NameCodeText, testId, useAsyncGenerationGuard, useDetailDrawer} from '@catering-v2s/admin-ui-foundation';
import {useCallback, useEffect, useMemo, useRef, useState, type Key, type ReactNode} from 'react';
import {operationsProblemOf, operationsRtk} from '../../../app/api/OperationsTransport';
import type {HeadCompany} from '../../../app/api/generated/operations-edge';
import {operationsAdminRtkRequest} from '../../../app/api/generated/operations-edge.rtk';
import type {JsonValue} from '../../../app/api/generated/catalog-inventory-edge';
import {catalogInventoryRtkRequest} from '../../../app/api/generated/catalog-inventory-edge.rtk';
import {requireOperationsScopeRef, type OperationsPageProps} from '../../../app/routing/model';
import {decodeDetail, decodeItems, decodeNavigation, decodeWorkbenchContext, type CatalogItemSummary, type CatalogNavigation} from '../model/catalogModel';
import {BrandCatalogCopyDrawer} from './BrandCatalogCopyDrawer';
import {CatalogItemDrawer} from './CatalogItemDrawer';
import {CatalogItemCreateDrawer} from './CatalogItemCreateDrawer';
import {CatalogDictionaryDrawer} from './CatalogDictionaryDrawer';
import {CatalogAssetPreview} from './CatalogAssetPreview';

type CatalogSurface = 'store' | 'brand';
type TreeSelection = {kind: 'SMART' | 'SHAPE' | 'CATEGORY' | 'UNCATEGORIZED'; ref: string; label: string};
type CatalogFilters = {keyword?: string; status?: string; governanceStatus?: string; source?: string};
type CategoryAction = {mode: 'CREATE' | 'RENAME' | 'REPARENT' | 'MOVE_UP' | 'MOVE_DOWN' | 'DELETE'; node?: CatalogNavigation['tree'][number]};
type CatalogTreeNode = {key: string; title: ReactNode; selectable?: boolean; children?: CatalogTreeNode[]};

type CatalogTreeLineProps = {
  label: string;
  count?: number;
  icon?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
};

const shapeLabels: Record<string, string> = {STANDARD_SALE_COUNTED: '普通销售商品', SKU_VARIANT_SALE_COUNTED: '按 SKU 管理商品', STANDARD_SALE_WEIGHED: '称重销售商品', MATERIAL: '原材料/半成品/包装物', SERVICE: '服务', COMPOSITE: '套餐', BENEFIT_SHELL: '权益商品壳'};
const smartLabels: Record<string, string> = {ALL: '全部商品', GOVERNANCE_PENDING: '待治理', EXTERNAL_ORDER_TEMP: '外部订单临时商品', INACTIVE: '已停用', ARCHIVED: '已归档', RECENTLY_UPDATED: '最近修改', AUTO_SYNC: '自动同步'};
const smartViewIcons: Record<string, ReactNode> = {
  ALL: <AppstoreOutlined/>, GOVERNANCE_PENDING: <ClockCircleOutlined/>, EXTERNAL_ORDER_TEMP: <InboxOutlined/>,
  INACTIVE: <StopOutlined/>, ARCHIVED: <InboxOutlined/>, RECENTLY_UPDATED: <HistoryOutlined/>, AUTO_SYNC: <SyncOutlined/>,
};
const shapeIcons: Record<string, ReactNode> = {
  STANDARD_SALE_COUNTED: <ShoppingOutlined/>, SKU_VARIANT_SALE_COUNTED: <TagsOutlined/>, STANDARD_SALE_WEIGHED: <ToolOutlined/>,
  MATERIAL: <InboxOutlined/>, SERVICE: <CustomerServiceOutlined/>, COMPOSITE: <AppstoreOutlined/>, BENEFIT_SHELL: <GiftOutlined/>,
};

function CatalogTreeLine({label, count, icon, children, action}: CatalogTreeLineProps) {
  return <div style={{display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, width: '100%'}}>
    {icon && <span aria-hidden="true" style={{display: 'inline-flex', flex: '0 0 auto'}}>{icon}</span>}
    {count !== undefined && <Tag style={{flex: '0 0 auto', marginInlineEnd: 0}}>{count}</Tag>}
    <Typography.Text ellipsis={{tooltip: label}} style={{display: 'block', flex: '1 1 auto', minWidth: 0}}>{children ?? label}</Typography.Text>
    {action && <span style={{display: 'inline-flex', flex: '0 0 auto', marginLeft: 'auto'}}>{action}</span>}
  </div>;
}

function isCategoryDescendant(candidate: CatalogNavigation['tree'][number], ancestorCategoryRef: string | undefined, tree: CatalogNavigation['tree']): boolean {
  if (!ancestorCategoryRef) return false;
  let parent = candidate.parentCategoryRef;
  const seen = new Set<string>();
  while (parent && seen.add(parent)) {
    if (parent === ancestorCategoryRef) return true;
    parent = tree.find((entry) => entry.categoryRef === parent)?.parentCategoryRef ?? null;
  }
  return false;
}

function itemReferenceSummary(row: CatalogItemSummary, navigation: CatalogNavigation): string {
  const categoryNames = row.categoryRefs
    .map((categoryRef) => navigation.tree.find((node) => node.categoryRef === categoryRef)?.name)
    .filter((name): name is string => Boolean(name));
  const labels = [...categoryNames];
  if (row.productionTagRefs.length) labels.push(`生产标签 ${row.productionTagRefs.length}`);
  if (!labels.length) return '未分类';
  const visible = labels.slice(0, 2);
  const remaining = labels.length - visible.length;
  return `${visible.join(' · ')}${remaining > 0 ? ` +${remaining}` : ''}`;
}

export function StoreCatalogManagementPage(props: OperationsPageProps) { return <CatalogWorkbenchPage {...props} surface="store"/>; }
export function BrandCatalogManagementPage(props: OperationsPageProps) { return <CatalogWorkbenchPage {...props} surface="brand"/>; }

function CatalogWorkbenchPage({queryContext, actionCapabilityKeys, surface}: OperationsPageProps & {surface: CatalogSurface}) {
  const [view, setView] = useState<'TREE_TABLE' | 'TABLE_ONLY'>('TREE_TABLE');
  const [brandRef, setBrandRef] = useState<string>();
  const [treeSelection, setTreeSelection] = useState<TreeSelection>({kind: 'SMART', ref: 'ALL', label: '全部商品'});
  const [treeSearch, setTreeSearch] = useState('');
  const [keywordDraft, setKeywordDraft] = useState('');
  const [filters, setFilters] = useState<CatalogFilters>({});
  const [cursorStack, setCursorStack] = useState<string[]>(['']);
  const [pageSize, setPageSize] = useState(20);
  const [selectedRows, setSelectedRows] = useState<Key[]>([]);
  const [expandedRows, setExpandedRows] = useState<Key[]>([]);
  const [treeExpandedKeys, setTreeExpandedKeys] = useState<Key[] | undefined>();
  const [copyOpen, setCopyOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [rebuildPrefill, setRebuildPrefill] = useState<{name?: string; shapeKey?: string}>();
  const [dictionaryOpen, setDictionaryOpen] = useState(false);
  const [dictionaryKind, setDictionaryKind] = useState<'TAG' | 'SALES_UNIT' | 'SKU_ATTRIBUTE' | 'SKU_ATTRIBUTE_VALUE' | 'PRODUCTION_TAG'>('TAG');
  const [categoryAction, setCategoryAction] = useState<CategoryAction>();
  const [categoryProblem, setCategoryProblem] = useState<string>();
  const [categoryForm] = Form.useForm<{code?: string; name?: string; parentCategoryRef?: string | null}>();
  const detail = useDetailDrawer<string>();
  const generation = useAsyncGenerationGuard();
  const listRequestGeneration = useRef(0);
  const [acceptedPage, setAcceptedPage] = useState<ReturnType<typeof decodeItems>>();
  const editCatalogCapability = surface === 'brand' ? 'EDIT_HEAD_COMPANY_CATALOG' : 'EDIT_STORE_CATALOG';
  const canWriteCatalog = (actionCapabilityKeys as readonly string[]).includes(editCatalogCapability);
  const [createCategory, createCategoryState] = operationsRtk.useCreateOperationsCatalogCategoryMutation();
  const [updateCategory, updateCategoryState] = operationsRtk.useUpdateOperationsCatalogCategoryMutation();
  const [moveCategory, moveCategoryState] = operationsRtk.useMoveOperationsCatalogCategoryMutation();
  const [deleteCategory, deleteCategoryState] = operationsRtk.useDeleteOperationsCatalogCategoryMutation();
  const headCompanyRequest = useMemo(() => operationsAdminRtkRequest.getOperationsOrganizationHeadCompany({groupWorkspaceKey: queryContext.groupWorkspaceKey, headCompanyId: queryContext.scopeRef ?? ''}, {query: {expectedContextVersion: queryContext.expectedContextVersion}}), [queryContext.expectedContextVersion, queryContext.groupWorkspaceKey, queryContext.scopeRef]);
  const headCompanyQuery = operationsRtk.useGetOperationsOrganizationHeadCompanyQuery(headCompanyRequest, {skip: surface !== 'brand' || !queryContext.scopeRef});
  const brands = useMemo(() => (headCompanyQuery.data as HeadCompany | undefined)?.authorizedBrands.filter((brand) => brand.status === 'ENABLED') ?? [], [headCompanyQuery.data]);
  useEffect(() => {
    if (surface !== 'brand') return;
    setBrandRef((current) => brands.some((brand) => brand.id === current) ? current : brands[0]?.id);
  }, [brands, surface]);
  const headers = useMemo(() => brandRef ? {'X-Workspace-Brand-Ref': brandRef} : undefined, [brandRef]);
  const scopeReady = Boolean(queryContext.scopeRef) && (surface === 'store' || Boolean(brandRef));
  const contextRequest = useMemo(() => catalogInventoryRtkRequest.getOperationsCatalogWorkbenchContext({}, {query: {dataNodeRef: queryContext.scopeRef ?? ''}, headers}), [headers, queryContext.scopeRef]);
  const navigationRequest = useMemo(() => catalogInventoryRtkRequest.getOperationsCatalogNavigation({}, {query: {dataNodeRef: queryContext.scopeRef ?? '', viewKey: 'ALL'}, headers}), [headers, queryContext.scopeRef]);
  const listQuery = useMemo(() => compactQuery({
    dataNodeRef: queryContext.scopeRef ?? '', keyword: filters.keyword,
    smartViewKey: treeSelection.kind === 'SMART' ? treeSelection.ref : undefined,
    shapeKey: treeSelection.kind === 'SHAPE' ? treeSelection.ref : undefined,
    categoryRef: treeSelection.kind === 'CATEGORY' ? treeSelection.ref : undefined,
    uncategorized: treeSelection.kind === 'UNCATEGORIZED' ? true : undefined,
    includeSubCategories: treeSelection.kind === 'CATEGORY' ? true : undefined,
    status: filters.status, governanceStatus: filters.governanceStatus, source: filters.source,
    cursor: cursorStack[cursorStack.length - 1] || undefined, pageSize,
  }), [cursorStack, filters, pageSize, queryContext.scopeRef, treeSelection]);
  const queryGeneration = useMemo(() => JSON.stringify({scopeRef: queryContext.scopeRef ?? '', brandRef: brandRef ?? '', query: listQuery}), [brandRef, listQuery, queryContext.scopeRef]);
  const itemsRequest = useMemo(() => catalogInventoryRtkRequest.getOperationsCatalogItems({}, {query: {...listQuery, queryGeneration}, headers}), [headers, listQuery, queryGeneration]);
  const contextQuery = operationsRtk.useGetOperationsCatalogWorkbenchContextQuery(contextRequest, {skip: !scopeReady});
  const navigationQuery = operationsRtk.useGetOperationsCatalogNavigationQuery(navigationRequest, {skip: !scopeReady});
  const itemsQuery = operationsRtk.useGetOperationsCatalogItemsQuery(itemsRequest, {skip: !scopeReady});
  // `currentData` is bound to the current RTK query arguments. Using `data`
  // here can keep the previous brand/tree response visible while a new
  // request is pending, which defeats the scope generation boundary.
  const context = decodeWorkbenchContext(contextQuery.currentData);
  const navigation = decodeNavigation(navigationQuery.currentData);
  useEffect(() => {
    listRequestGeneration.current = generation.begin();
    setAcceptedPage(undefined);
  }, [generation, itemsRequest]);
  useEffect(() => {
    const next = decodeItems(itemsQuery.currentData);
    if (!next || !itemsQuery.currentData || next.queryGeneration !== queryGeneration || !generation.isCurrent(listRequestGeneration.current)) return;
    setAcceptedPage(next);
  }, [generation, itemsQuery.currentData, queryGeneration]);
  const page = acceptedPage ?? {items: [], total: 0, cursor: '', generation: 0, queryGeneration: ''};
  const categorySubmitting = createCategoryState.isLoading || updateCategoryState.isLoading || moveCategoryState.isLoading || deleteCategoryState.isLoading;
  useEffect(() => {
    if (!categoryAction) return;
    categoryForm.setFieldsValue({name: categoryAction.node?.name, parentCategoryRef: categoryAction.mode === 'REPARENT' ? categoryAction.node?.parentCategoryRef ?? null : undefined});
  }, [categoryAction, categoryForm]);
  const closeCategoryAction = () => { setCategoryAction(undefined); setCategoryProblem(undefined); categoryForm.resetFields(); };
  const submitCategoryAction = async () => {
    if (!categoryAction) return;
    try {
      const values = await categoryForm.validateFields();
      const dataNodeRef = requireOperationsScopeRef(queryContext);
      const idempotencyKey = globalThis.crypto.randomUUID();
      const node = categoryAction.node;
      const categoryRef = node?.categoryRef;
      const headers = {'X-Workspace-Brand-Ref': brandRef, 'Idempotency-Key': idempotencyKey};
      if (categoryAction.mode === 'CREATE') {
        await createCategory(catalogInventoryRtkRequest.createOperationsCatalogCategory({}, {headers, body: {dataNodeRef, code: values.code?.trim() ?? '', name: values.name?.trim() ?? '', parentCategoryRef: node?.categoryRef ?? null}})).unwrap();
      } else if (!categoryRef || !node) {
        throw new Error('CATEGORY_REF_MISSING');
      } else if (categoryAction.mode === 'RENAME') {
        await updateCategory(catalogInventoryRtkRequest.updateOperationsCatalogCategory({categoryRef}, {headers, body: {dataNodeRef, categoryRef, expectedVersion: node.version, name: values.name?.trim() ?? ''}})).unwrap();
      } else if (categoryAction.mode === 'REPARENT' || categoryAction.mode === 'MOVE_UP' || categoryAction.mode === 'MOVE_DOWN') {
        const action = categoryAction.mode === 'REPARENT' ? 'REPARENT' : categoryAction.mode === 'MOVE_UP' ? 'UP' : 'DOWN';
        await moveCategory(catalogInventoryRtkRequest.moveOperationsCatalogCategory({categoryRef}, {headers, body: {dataNodeRef, categoryRef, expectedVersion: node.version, action, ...(action === 'REPARENT' ? {parentCategoryRef: values.parentCategoryRef ?? null} : {})}})).unwrap();
      } else {
        await deleteCategory(catalogInventoryRtkRequest.deleteOperationsCatalogCategory({categoryRef}, {headers, body: {dataNodeRef, categoryRef, expectedVersion: node.version}})).unwrap();
      }
      closeCategoryAction();
      refresh();
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) return;
      setCategoryProblem(operationsProblemOf(error).detail || '分类操作未完成，请重试。');
    }
  };
  const changeBrand = (nextBrand: string) => {
    generation.begin();
    setBrandRef(nextBrand); setTreeSelection({kind: 'SMART', ref: 'ALL', label: '全部商品'}); setKeywordDraft(''); setFilters({}); setCursorStack(['']); setSelectedRows([]); setExpandedRows([]); setTreeExpandedKeys(undefined);
  };
  const selectTree = useCallback((next: TreeSelection) => {
    generation.begin();
    setTreeSelection(next); setCursorStack(['']); setSelectedRows([]); setExpandedRows([]);
    if (next.kind === 'SMART') setFilters((current) => ({keyword: current.keyword}));
  }, [generation]);
  const refresh = useCallback(() => { listRequestGeneration.current = generation.begin(); setAcceptedPage(undefined); if (surface === 'brand') void headCompanyQuery.refetch(); void contextQuery.refetch(); void navigationQuery.refetch(); void itemsQuery.refetch(); }, [contextQuery, generation, headCompanyQuery, itemsQuery, navigationQuery, surface]);
  const treeData = useMemo<CatalogTreeNode[]>(() => {
    const match = treeSearch.trim().toLocaleLowerCase();
    const categoryByParent = new Map<string, CatalogNavigation['tree']>();
    navigation.tree.forEach((node) => { const parent = node.parentCategoryRef ?? ''; categoryByParent.set(parent, [...(categoryByParent.get(parent) ?? []), node]); });
    const categoryMatches = (node: CatalogNavigation['tree'][number]): boolean => !match || node.name.toLocaleLowerCase().includes(match) || node.code.toLocaleLowerCase().includes(match) || (categoryByParent.get(node.categoryRef) ?? []).some(categoryMatches);
    const renderCategory = (node: CatalogNavigation['tree'][number]): CatalogTreeNode => ({
      key: `CATEGORY:${node.categoryRef}`,
      title: <CatalogTreeLine label={`${node.name}(${node.code})`} count={node.count} action={canWriteCatalog && <Dropdown trigger={['click']} menu={{items: [
        {key: 'create-child', label: '新建子分类', disabled: Boolean(node.parentCategoryRef), title: node.parentCategoryRef ? '分类最多支持两级' : undefined},
        {key: 'rename', label: '重命名'}, {key: 'reparent', label: '更换父分类'}, {key: 'move-up', label: '向上移动'}, {key: 'move-down', label: '向下移动'},
        {key: 'delete', label: '删除分类', danger: true, disabled: !node.deletionAvailability.canDelete, title: node.deletionAvailability.canDelete ? undefined : `仍有 ${node.deletionAvailability.blockingReferenceCount} 个商品引用`},
        ], onClick: ({key}) => { if (key === 'create-child' && !node.parentCategoryRef) setCategoryAction({mode: 'CREATE', node}); if (key === 'rename') setCategoryAction({mode: 'RENAME', node}); if (key === 'reparent') setCategoryAction({mode: 'REPARENT', node}); if (key === 'move-up') setCategoryAction({mode: 'MOVE_UP', node}); if (key === 'move-down') setCategoryAction({mode: 'MOVE_DOWN', node}); if (key === 'delete') setCategoryAction({mode: 'DELETE', node}); }}}><Button type="text" size="small" aria-label={`分类 ${node.name} 操作`} {...testId(`catalog-category-actions-${node.code}`)}>···</Button></Dropdown>} {...testId(`catalog-category-node-${node.code}`)}><NameCodeText name={node.name} code={node.code}/></CatalogTreeLine>,
      children: (categoryByParent.get(node.categoryRef) ?? []).filter(categoryMatches).map(renderCategory),
    });
    return [
      {key: 'smart-root', title: <CatalogTreeLine label="智能视图" icon={<BulbOutlined/>}/>, selectable: false, children: navigation.smartViews.map((node) => ({key: `SMART:${node.viewKey}`, title: <CatalogTreeLine label={smartLabels[node.viewKey] ?? node.viewKey} count={node.count} icon={smartViewIcons[node.viewKey] ?? <AppstoreOutlined/>}/>}))},
      {key: 'shape-root', title: <CatalogTreeLine label="商品形态" icon={<AppstoreOutlined/>}/>, selectable: false, children: navigation.shapeCounts.map((node) => ({key: `SHAPE:${node.shapeKey}`, title: <CatalogTreeLine label={shapeLabels[node.shapeKey] ?? node.shapeKey} count={node.count} icon={shapeIcons[node.shapeKey] ?? <AppstoreOutlined/>}/>}))},
      {key: 'category-root', title: <CatalogTreeLine label="商品分类" icon={<TagsOutlined/>} action={canWriteCatalog && <Button type="link" size="small" onClick={(event) => { event.stopPropagation(); setCategoryAction({mode: 'CREATE'}); }} {...testId('catalog-category-create-root')}>新建分类</Button>}/>, selectable: false, children: [
        {key: 'UNCATEGORIZED:UNCATEGORIZED', title: <CatalogTreeLine label="未分类" count={navigation.uncategorizedCount ?? 0}/>},
        ...(categoryByParent.get('') ?? []).filter(categoryMatches).map(renderCategory),
      ]},
    ];
  }, [canWriteCatalog, navigation, treeSearch]);
  const searchExpandedKeys = useMemo<Key[] | undefined>(() => {
    if (!treeSearch.trim()) return undefined;
    const keys: Key[] = [];
    const visit = (nodes: CatalogTreeNode[]) => nodes.forEach((node) => {
      if (!node.children?.length) return;
      keys.push(node.key);
      visit(node.children);
    });
    visit(treeData);
    return keys;
  }, [treeData, treeSearch]);
  const columns = useMemo<ProColumns<CatalogItemSummary>[]>(() => [
    {title: '商品', key: 'item', fixed: 'left', width: 280, render: (_, row) => <Button type="link" onClick={() => detail.open(row.code)} {...testId(`catalog-inventory-open-item-${row.code}`)}><Space align="start" size={8}>{row.primaryImageAssetRef ? <CatalogAssetPreview assetRef={row.primaryImageAssetRef} alt={`${row.name}商品图片`} width={48} height={48} preview={false} testId={`catalog-item-thumbnail-${row.code}`}/> : <Typography.Text type="secondary" style={{fontSize: 12, minWidth: 48}}>无图</Typography.Text>}<span style={{display: 'grid', textAlign: 'left'}}><NameCodeText name={row.name} code={row.code}/><Typography.Text type="secondary" style={{fontSize: 12}}>{itemReferenceSummary(row, navigation)}</Typography.Text></span></Space></Button>},
    {title: '形态 / 规格', key: 'shape', width: 190, render: (_, row) => <Space direction="vertical" size={0}><span>{shapeLabels[row.shapeKey] ?? row.shapeKey}</span><Typography.Text type="secondary">{row.skuNonArchivedCount ? `${row.skuEnabledCount}/${row.skuNonArchivedCount} 个 SKU${row.skuDimensionSummary.length ? ` · ${row.skuDimensionSummary.join('、')}` : ''}` : '无 SKU'}</Typography.Text></Space>},
    {title: '价格 / 粒度', key: 'price', width: 150, render: (_, row) => <Space direction="vertical" size={0}><span>{row.standardSalePrice === undefined ? '—' : `¥${(row.standardSalePrice / 100).toFixed(2)}`}</span><Typography.Text type={row.missingPriceCount ? 'danger' : 'secondary'}>{row.priceGranularity}{row.missingPriceCount ? ` · 缺价 ${row.missingPriceCount}` : ''}</Typography.Text></Space>},
    {title: surface === 'brand' ? '库存对象 / BOM 定义' : '库存 / BOM', key: 'inventory', width: 180, render: (_, row) => <Space direction="vertical" size={0}><span>{row.stockTargetCount} 个库存对象 / {row.bomCount} 个 BOM</span>{row.riskFlags.map((risk) => <Tag color="warning" key={risk}>{risk}</Tag>)}</Space>},
    {title: '状态 / 治理', key: 'governance', width: 150, render: (_, row) => <Space direction="vertical" size={0}><Tag color={row.status === 'ENABLED' ? 'green' : 'default'}>{row.status}</Tag><Typography.Text type="secondary">{row.governanceStatus}</Typography.Text></Space>},
    {title: '来源', dataIndex: 'source', width: 110}, {title: '更新时间', dataIndex: 'updatedAt', valueType: 'dateTime', width: 180}, {title: '版本', dataIndex: 'version', hideInTable: true},
  ], [detail, navigation, surface]);
  const failed = Boolean(contextQuery.error || navigationQuery.error || itemsQuery.error || headCompanyQuery.error);
  const rootTestId = surface === 'store' ? 'catalog-inventory-store-page' : 'catalog-inventory-brand-page';
  return <section {...testId(rootTestId)}>
    {failed && <Alert type="error" showIcon title="商品工作台暂时无法获取" description="当前筛选和结果域已保留，请重试。" action={<Button onClick={refresh}>重试</Button>} style={{marginBottom: 16}} {...testId('catalog-inventory-workbench-problem')}/>} 
    <Card size="small" styles={{body: {display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap'}}}>
      <Space wrap>
        <Segmented value={view} options={[{label: '树表视图', value: 'TREE_TABLE'}, {label: '仅表格', value: 'TABLE_ONLY'}]} onChange={(value) => setView(value as typeof view)} {...testId('catalog-inventory-view-switch')}/>
        {surface === 'brand' && <Select value={brandRef} loading={headCompanyQuery.isLoading} placeholder="选择已授权品牌" options={brands.map((brand) => ({value: brand.id, label: `${brand.name}(${brand.code})`}))} onChange={changeBrand} style={{minWidth: 220}} {...testId('catalog-inventory-brand-switch')}/>} 
      </Space>
      <Space wrap>
        <Button onClick={() => { setDictionaryKind('TAG'); setDictionaryOpen(true); }} {...testId('catalog-inventory-dictionary')}>商品字典</Button>
        {surface === 'store' && canWriteCatalog && context?.headCompanyRef && context.brandRef && context.copySourceAvailable && context.actionAvailability.canCopy && <Button onClick={() => setCopyOpen(true)} {...testId('catalog-inventory-copy-open')}>从品牌复制</Button>}
        {canWriteCatalog && context?.actionAvailability.canCreate && <Button type="primary" onClick={() => setCreateOpen(true)} {...testId('catalog-inventory-create')}>新建商品</Button>}
      </Space>
    </Card>
    <div style={{display: 'flex', gap: 16, marginTop: 16, minHeight: 460}}>
      {view === 'TREE_TABLE' && <Card size="small" style={{width: 312, flex: '0 0 312px'}} title="商品结果域" {...testId('catalog-inventory-tree')}>
        <Input.Search allowClear placeholder="搜索分类名称/编码" value={treeSearch} onChange={(event) => setTreeSearch(event.target.value)} {...testId('catalog-inventory-tree-search')}/>
        <Tree blockNode defaultExpandAll expandedKeys={treeSearch.trim() ? searchExpandedKeys : treeExpandedKeys} onExpand={(keys) => setTreeExpandedKeys(keys)} selectedKeys={[`${treeSelection.kind}:${treeSelection.ref}`]} treeData={treeData} onSelect={(keys) => { const [kind, ...ref] = String(keys[0] ?? '').split(':'); if (!['SMART', 'SHAPE', 'CATEGORY', 'UNCATEGORIZED'].includes(kind)) return; const key = ref.join(':'); const label = kind === 'SMART' ? smartLabels[key] ?? key : kind === 'SHAPE' ? shapeLabels[key] ?? key : kind === 'UNCATEGORIZED' ? '未分类' : navigation.tree.find((node) => node.categoryRef === key)?.name ?? key; selectTree({kind: kind as TreeSelection['kind'], ref: key, label}); }} style={{marginTop: 12}}/>
      </Card>}
      <div style={{minWidth: 0, flex: 1}}>
        <Card size="small" style={{marginBottom: 12}} title={`当前结果域：${treeSelection.label}`}>
          <Space wrap>
            <Input.Search value={keywordDraft} onChange={(event) => setKeywordDraft(event.target.value)} onSearch={() => { setFilters((current) => ({...current, keyword: keywordDraft.trim() || undefined})); setCursorStack(['']); }} placeholder="在当前结果域搜索：编码/名称/短名" style={{width: 320}} {...testId('catalog-inventory-local-search')}/>
            <Select allowClear value={filters.status} placeholder="状态" options={['DRAFT', 'ENABLED', 'DISABLED', 'ARCHIVED'].map((value) => ({value}))} onChange={(status) => { setFilters((current) => ({...current, status})); setCursorStack(['']); }}/>
            <Select allowClear value={filters.governanceStatus} placeholder="治理状态" options={['READY', 'NEEDS_ATTENTION', 'BLOCKED'].map((value) => ({value}))} onChange={(governanceStatus) => { setFilters((current) => ({...current, governanceStatus})); setCursorStack(['']); }} {...testId('catalog-inventory-governance-filter')}/>
            <Select allowClear value={filters.source} placeholder="来源" options={['SELF_MANAGED', 'COPIED', 'AUTO_SYNC', 'TEMPORARY'].map((value) => ({value}))} onChange={(source) => { setFilters((current) => ({...current, source})); setCursorStack(['']); }}/>
            <Button onClick={() => { generation.begin(); setKeywordDraft(''); setFilters({}); setCursorStack(['']); setSelectedRows([]); setExpandedRows([]); }}>重置</Button>
          </Space>
        </Card>
        <ProTable<CatalogItemSummary> rowKey="code" size="small" columns={columns} dataSource={page.items} search={false} options={{reload: refresh, density: false}} toolBarRender={() => selectedRows.length ? [<Space key="catalog-selection-summary" size={8} {...testId('catalog-inventory-selection-summary')}><Typography.Text type="secondary">已选择 {selectedRows.length} 项</Typography.Text><Button type="link" size="small" onClick={() => setSelectedRows([])}>取消选择</Button></Space>] : []} tableAlertRender={false} tableAlertOptionRender={false} scroll={{x: 1120}} expandable={{rowExpandable: (row) => row.skuNonArchivedCount > 0, expandedRowKeys: expandedRows, onExpandedRowsChange: (keys) => setExpandedRows([...keys]), expandedRowRender: (row) => <CatalogSkuExpandedRow itemCode={row.code} dataNodeRef={queryContext.scopeRef ?? ''} brandRef={context?.brandRef ?? brandRef}/>}} {...adminListState({loading: itemsQuery.isLoading && !itemsQuery.currentData, failed, emptyText: '当前结果域暂无商品', testIdPrefix: 'catalog-inventory-item-list'})} pagination={{current: cursorStack.length, pageSize, total: page.total, showSizeChanger: true}} onChange={(pagination, _filters, _sorter, extra) => { if (extra.action !== 'paginate') return; const nextPageSize = pagination.pageSize ?? pageSize; if (nextPageSize !== pageSize) { setPageSize(nextPageSize); setCursorStack(['']); return; } const nextPage = pagination.current ?? cursorStack.length; if (nextPage < cursorStack.length) setCursorStack((current) => current.slice(0, -1)); else if (nextPage > cursorStack.length && page.cursor) setCursorStack((current) => [...current, page.cursor]); }} rowSelection={{selectedRowKeys: selectedRows, onChange: setSelectedRows, preserveSelectedRowKeys: false, getCheckboxProps: (row) => ({disabled: row.status === 'ARCHIVED'})}} {...testId('catalog-inventory-item-table')}/>
      </div>
    </div>
    <CatalogItemDrawer itemCode={detail.target} queryContext={queryContext} brandRef={context?.brandRef ?? brandRef} canWriteCatalog={canWriteCatalog} surface={surface} onOpenProductionTags={() => { setDictionaryKind('PRODUCTION_TAG'); setDictionaryOpen(true); }} onVoidAndRebuild={(source) => { detail.close(); setRebuildPrefill(source); setCreateOpen(true); }} onClose={detail.close} onChanged={refresh}/>
    <CatalogItemCreateDrawer open={createOpen} queryContext={queryContext} brandRef={context?.brandRef ?? brandRef} initialValues={rebuildPrefill} onClose={() => { setCreateOpen(false); setRebuildPrefill(undefined); }} onCreated={(createdCode) => { setCreateOpen(false); setRebuildPrefill(undefined); refresh(); detail.open(createdCode); }}/>
    <CatalogDictionaryDrawer open={dictionaryOpen} initialKind={dictionaryKind} queryContext={queryContext} brandRef={context?.brandRef ?? brandRef} canWrite={canWriteCatalog} onClose={() => setDictionaryOpen(false)}/>
    {surface === 'store' && <BrandCatalogCopyDrawer open={copyOpen} queryContext={queryContext} brandRef={context?.brandRef} onClose={() => setCopyOpen(false)} onCompleted={refresh}/>} 
    <Modal open={Boolean(categoryAction)} title={categoryAction?.mode === 'CREATE' ? (categoryAction.node ? '新建子分类' : '新建分类') : categoryAction?.mode === 'RENAME' ? '重命名分类' : categoryAction?.mode === 'REPARENT' ? '更换父分类' : categoryAction?.mode === 'MOVE_UP' ? '向上移动分类' : categoryAction?.mode === 'MOVE_DOWN' ? '向下移动分类' : '删除分类'} okText={categoryAction?.mode === 'DELETE' ? '删除' : '确定'} okButtonProps={categoryAction?.mode === 'DELETE' ? {danger: true} : undefined} onCancel={closeCategoryAction} onOk={() => void submitCategoryAction()} confirmLoading={categorySubmitting} destroyOnHidden {...testId('catalog-category-action-modal')}>
      <Form form={categoryForm} layout="vertical">
        {categoryProblem && <Alert type="error" showIcon title="分类操作未完成" description={categoryProblem} style={{marginBottom: 12}}/>}
        {categoryAction?.mode === 'CREATE' && categoryAction.node && <Form.Item label="父分类"><Typography.Text>{`${categoryAction.node.name}（${categoryAction.node.code}）`}</Typography.Text></Form.Item>}
        {categoryAction?.mode === 'REPARENT' && <Form.Item label="目标父分类" name="parentCategoryRef"><Select options={[{value: null, label: '根级（无父分类）'}, ...navigation.tree.filter((node) => node.categoryRef !== categoryAction.node?.categoryRef && !isCategoryDescendant(node, categoryAction.node?.categoryRef, navigation.tree)).map((node) => ({value: node.categoryRef, label: `${node.name}（${node.code}）`}))]}/></Form.Item>}
        {categoryAction?.mode === 'CREATE' && <Form.Item label="分类编码" name="code" rules={[{required: true, message: '请输入分类编码'}, {pattern: /^[A-Z0-9][A-Z0-9_-]{1,63}$/, message: '使用 2-64 位大写字母、数字、下划线或连字符'}]}><Input {...testId('catalog-category-code')}/></Form.Item>}
        {(categoryAction?.mode === 'CREATE' || categoryAction?.mode === 'RENAME') && <Form.Item label="分类名称" name="name" rules={[{required: true, message: '请输入分类名称'}, {max: 80, message: '名称不能超过 80 个字符'}]}><Input {...testId('catalog-category-name')}/></Form.Item>}
        {categoryAction?.mode === 'MOVE_UP' && <Typography.Text type="secondary">将按当前最新排序上移一位。</Typography.Text>}
        {categoryAction?.mode === 'MOVE_DOWN' && <Typography.Text type="secondary">将按当前最新排序下移一位。</Typography.Text>}
        {categoryAction?.mode === 'DELETE' && <Space direction="vertical" size={6}><Typography.Text>将删除“{categoryAction.node?.name}”及其 {categoryAction.node?.deletionAvailability.subtreeSize ?? 0} 个分类节点。</Typography.Text>{(categoryAction.node?.deletionAvailability.blockingReferenceLabels.length ?? 0) > 0 && <Typography.Text type="danger">仍被以下商品引用：{categoryAction.node?.deletionAvailability.blockingReferenceLabels.join('、')}</Typography.Text>}</Space>}
      </Form>
    </Modal>
  </section>;
}

function CatalogSkuExpandedRow({itemCode, dataNodeRef, brandRef}: {itemCode: string; dataNodeRef: string; brandRef?: string}) {
  const request = useMemo(() => catalogInventoryRtkRequest.getOperationsCatalogItem({itemCode}, {query: {dataNodeRef}, headers: brandRef ? {'X-Workspace-Brand-Ref': brandRef} : undefined}), [brandRef, dataNodeRef, itemCode]);
  const query = operationsRtk.useGetOperationsCatalogItemQuery(request, {skip: !dataNodeRef || !itemCode});
  const detail = decodeDetail(query.data);
  if (query.isLoading && !query.data) return <div {...testId(`catalog-inventory-sku-expand-${itemCode}`)}><Skeleton active paragraph={{rows: 2}}/></div>;
  if (query.error) return <Alert type="error" showIcon title="SKU 明细加载失败" description="当前行的 SKU 明细未覆盖列表上下文，请重试。" action={<Button size="small" onClick={() => void query.refetch()}>重试</Button>} {...testId(`catalog-inventory-sku-expand-${itemCode}-error`)}/>;
  const rows = detail?.item.skus ?? [];
  if (!rows.length) return <Typography.Text type="secondary" {...testId(`catalog-inventory-sku-expand-${itemCode}`)}>该商品不按 SKU 管理，暂无 SKU 明细。</Typography.Text>;
  return <Space direction="vertical" size={6} style={{display: 'flex'}} {...testId(`catalog-inventory-sku-expand-${itemCode}`)}>
    <Typography.Text type="secondary">SKU 规格与价格（展开行按需读取，不改变列表结果域）</Typography.Text>
    {rows.map((sku) => <Space key={sku.skuCode} wrap>
      <NameCodeText name={sku.skuName} code={sku.skuCode}/>
      <Typography.Text type="secondary">{sku.attributeValueRefs.map((ref) => `${ref.attributeName || ref.attributeCode}=${ref.valueLabel || ref.valueCode}`).join('、') || '无规格值'}</Typography.Text>
      <Typography.Text>{sku.standardSalePrice === null ? '缺价' : `¥${(sku.standardSalePrice / 100).toFixed(2)}`}</Typography.Text>
      <Tag color={sku.status === 'ENABLED' ? 'green' : 'default'}>{sku.status}{sku.isDefault ? ' · 默认' : ''}</Tag>
    </Space>)}
  </Space>;
}

function compactQuery(values: Record<string, JsonValue | undefined>): Record<string, JsonValue> {
  return Object.fromEntries(Object.entries(values).filter((entry): entry is [string, JsonValue] => entry[1] !== undefined));
}
