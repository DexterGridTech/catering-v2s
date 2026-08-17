import {
  AppstoreOutlined,
  BulbOutlined,
  CustomerServiceOutlined,
  GiftOutlined,
  HistoryOutlined,
  InboxOutlined,
  ShoppingOutlined,
  StopOutlined,
  SyncOutlined,
  TagsOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Dropdown,
  Form,
  Input,
  List,
  Modal,
  Segmented,
  Select,
  Skeleton,
  Space,
  Table,
  Tag,
  Tooltip,
  Tree,
  Typography,
} from 'antd';
import {ProTable, type ProColumns} from '@ant-design/pro-components';
import {
  adminListState,
  createContentIdempotencyKey,
  NameCodeText,
  testId,
  useAsyncGenerationGuard,
  useCursorStack,
  useDetailDrawer,
  useOverlayLock,
} from '@catering-v2s/admin-ui-foundation';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Key,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
import {catalogInventoryClient, operationsProblemOf, operationsRtk} from '../../../app/api/OperationsTransport';
import type {HeadCompany} from '../../../app/api/generated/operations-edge';
import {CATALOG_INVENTORY_OPERATION_IDS} from '../../../app/api/generated/catalog-inventory-edge';
import {operationsAdminRtkRequest} from '../../../app/api/generated/operations-edge.rtk';
import {catalogInventoryRtkRequest} from '../../../app/api/generated/catalog-inventory-edge.rtk';
import {ACTION_CAPABILITIES} from '../../../app/catalog/generatedAdminCatalog';
import {wireUuid} from '../../../app/api/wireUuid';
import {requireOperationsScopeRef, type OperationsPageProps} from '../../../app/routing/model';
import {
  alignCatalogBatchResults,
  buildCatalogBatchSaveRequest,
  buildCatalogBatchStatusRequest,
  buildCatalogItemsQuery,
  catalogCategoryCodeExists,
  catalogFilterConflictReason,
  catalogPriceLabel,
  decodeCatalogBatchResults,
  decodeCatalogDictionaryLabels,
  decodeDetail,
  decodeItems,
  decodeNavigation,
  decodeWorkbenchContext,
  isCatalogBatchRowSelectable,
  type CatalogBatchResult,
  type CatalogBatchStatus,
  type CatalogBatchUpdateKind,
  type CatalogItemSummary,
  type CatalogNavigation,
} from '../model/catalogModel';
import {catalogEnumLabel, catalogEnumOptions} from '../model/catalogManifestLabels';
import {BrandCatalogCopyDrawer} from './BrandCatalogCopyDrawer';
import {CatalogItemDrawer} from './CatalogItemDrawer';
import {CatalogItemCreateDrawer} from './CatalogItemCreateDrawer';
import {CatalogDictionaryDrawer} from './CatalogDictionaryDrawer';
import {CatalogAssetPreview} from './CatalogAssetPreview';

type CatalogSurface = 'store' | 'brand';
type CatalogDictionaryKind = 'TAG' | 'SALES_UNIT' | 'SKU_ATTRIBUTE' | 'SKU_ATTRIBUTE_VALUE' | 'PRODUCTION_TAG';
type TreeSelection = {kind: 'SMART' | 'SHAPE' | 'CATEGORY' | 'UNCATEGORIZED'; ref: string; label: string};
type CatalogFilters = {keyword?: string; status?: string; source?: string};
type CatalogBatchAction = 'CATEGORY' | 'TAG' | 'STATUS' | 'ARCHIVE';
type CatalogBatchRowResult = CatalogBatchResult & {code: string};
type CategoryAction = {
  mode: 'CREATE' | 'RENAME' | 'REPARENT' | 'MOVE_UP' | 'MOVE_DOWN' | 'DELETE';
  node?: CatalogNavigation['tree'][number];
};
type CatalogTreeNode = {key: string; title: ReactNode; selectable?: boolean; children?: CatalogTreeNode[]};
const defaultCatalogTreeExpandedKeys: Key[] = ['smart-root', 'shape-root', 'category-root'];

type CatalogTreeLineProps = {
  label: string;
  count?: number;
  icon?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
};

const smartViewIcons: Record<string, ReactNode> = {
  ALL: <AppstoreOutlined />,
  EXTERNAL_ORDER_TEMP: <InboxOutlined />,
  INACTIVE: <StopOutlined />,
  ARCHIVED: <InboxOutlined />,
  RECENTLY_UPDATED: <HistoryOutlined />,
  AUTO_SYNC: <SyncOutlined />,
};
const shapeIcons: Record<string, ReactNode> = {
  STANDARD_SALE_COUNTED: <ShoppingOutlined />,
  SKU_VARIANT_SALE_COUNTED: <TagsOutlined />,
  STANDARD_SALE_WEIGHED: <ToolOutlined />,
  MATERIAL: <InboxOutlined />,
  SERVICE: <CustomerServiceOutlined />,
  COMPOSITE: <AppstoreOutlined />,
  BENEFIT_SHELL: <GiftOutlined />,
};

function CatalogTreeLine({label, count, icon, children, action}: CatalogTreeLineProps) {
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, width: '100%'}}>
      {icon && (
        <span aria-hidden="true" style={{display: 'inline-flex', flex: '0 0 auto'}}>
          {icon}
        </span>
      )}
      <Typography.Text ellipsis={{tooltip: label}} style={{display: 'block', flex: '0 1 auto', minWidth: 0}}>
        {children ?? label}
      </Typography.Text>
      {count !== undefined && <Tag style={{flex: '0 0 auto', marginInlineEnd: 0, marginInlineStart: 4}}>{count}</Tag>}
      {action && <span style={{display: 'inline-flex', flex: '0 0 auto', marginLeft: 'auto'}}>{action}</span>}
    </div>
  );
}

function isCategoryDescendant(
  candidate: CatalogNavigation['tree'][number],
  ancestorCategoryRef: string | undefined,
  tree: CatalogNavigation['tree'],
): boolean {
  if (!ancestorCategoryRef) return false;
  let parent = candidate.parentCategoryRef;
  const seen = new Set<string>();
  while (parent && seen.add(parent)) {
    if (parent === ancestorCategoryRef) return true;
    parent = tree.find(entry => entry.categoryRef === parent)?.parentCategoryRef ?? null;
  }
  return false;
}

function itemReferenceSummary(
  row: CatalogItemSummary,
  navigation: CatalogNavigation,
  tagLabels: ReadonlyMap<string, string>,
): ReactNode {
  const categoryNodes = row.categoryRefs
    .map(categoryRef => navigation.tree.find(node => node.categoryRef === categoryRef))
    .filter((node): node is CatalogNavigation['tree'][number] => Boolean(node));
  const resolvedTagNames = row.tagRefs
    .map(tagRef => tagLabels.get(tagRef))
    .filter((name): name is string => Boolean(name));
  const unresolvedTagCount = row.tagRefs.length - resolvedTagNames.length;
  const labels: ReactNode[] = [
    ...categoryNodes.map(node => (
      <NameCodeText key={`category-${node.categoryRef}`} name={node.name} code={node.code} />
    )),
    ...resolvedTagNames.map((name, index) => <Typography.Text key={`tag-${name}-${index}`}>{name}</Typography.Text>),
    ...(unresolvedTagCount > 0
      ? [<Typography.Text key="unresolved-tags">商品标签 {unresolvedTagCount}</Typography.Text>]
      : []),
    ...(row.productionTagRefs.length
      ? [<Typography.Text key="production-tags">生产标签 {row.productionTagRefs.length}</Typography.Text>]
      : []),
  ];
  if (!labels.length) return '未分类';
  const categoryVisible = categoryNodes
    .slice(0, 2)
    .map(node => <NameCodeText key={`category-${node.categoryRef}`} name={node.name} code={node.code} />);
  const categoryRemaining = Math.max(0, categoryNodes.length - categoryVisible.length);
  const tagItems = [
    ...resolvedTagNames.map((name, index) => <Typography.Text key={`tag-${name}-${index}`}>{name}</Typography.Text>),
    ...(unresolvedTagCount > 0 ? [<Typography.Text key="unresolved-tags">未解析标签</Typography.Text>] : []),
  ];
  const tagVisible = tagItems.slice(0, 2);
  const tagRemaining = Math.max(0, tagItems.length - tagVisible.length);
  return (
    <Space direction="vertical" size={2}>
      <Space size={4} wrap>
        <Typography.Text type="secondary">分类</Typography.Text>
        {categoryVisible.length ? categoryVisible : <Typography.Text type="secondary">未分类</Typography.Text>}
        {categoryRemaining > 0 && <Typography.Text type="secondary">+{categoryRemaining}</Typography.Text>}
      </Space>
      <Space size={4} wrap>
        <Typography.Text type="secondary">标签</Typography.Text>
        {tagVisible.length ? tagVisible : <Typography.Text type="secondary">无</Typography.Text>}
        {tagRemaining > 0 && <Typography.Text type="secondary">+{tagRemaining}</Typography.Text>}
        {row.productionTagRefs.length > 0 && (
          <Typography.Text type="secondary">生产标签 +{row.productionTagRefs.length}</Typography.Text>
        )}
      </Space>
    </Space>
  );
}

export function StoreCatalogManagementPage(props: OperationsPageProps) {
  return <CatalogWorkbenchPage {...props} surface="store" />;
}
export function BrandCatalogManagementPage(props: OperationsPageProps) {
  return <CatalogWorkbenchPage {...props} surface="brand" />;
}

function CatalogWorkbenchPage({
  queryContext,
  actionCapabilityKeys,
  surface,
}: OperationsPageProps & {surface: CatalogSurface}) {
  const [view, setView] = useState<'TREE_TABLE' | 'TABLE_ONLY'>('TREE_TABLE');
  const [brandRef, setBrandRef] = useState<string>();
  const [treeSelection, setTreeSelection] = useState<TreeSelection>({kind: 'SMART', ref: 'ALL', label: '全部商品'});
  const [treeSearch, setTreeSearch] = useState('');
  const [keywordDraft, setKeywordDraft] = useState('');
  const [filters, setFilters] = useState<CatalogFilters>({});
  const {
    page: cursorPage,
    cursor,
    canPrevious,
    goToPage,
    reset: resetCursor,
  } = useCursorStack({resetKey: `${surface}:${queryContext.scopeRef ?? ''}`});
  const pageSize = 20;
  const [selectedRows, setSelectedRows] = useState<Key[]>([]);
  const [expandedRows, setExpandedRows] = useState<Key[]>([]);
  const [treeExpandedKeys, setTreeExpandedKeys] = useState<Key[]>(defaultCatalogTreeExpandedKeys);
  const [copyOpen, setCopyOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [rebuildPrefill, setRebuildPrefill] = useState<{code?: string; name?: string; shapeKey?: string}>();
  const [dictionaryOpen, setDictionaryOpen] = useState(false);
  const [dictionaryKind, setDictionaryKind] = useState<CatalogDictionaryKind>('TAG');
  const [dictionaryRevision, setDictionaryRevision] = useState<Partial<Record<CatalogDictionaryKind, number>>>({});
  const [categoryAction, setCategoryAction] = useState<CategoryAction>();
  const [categoryProblem, setCategoryProblem] = useState<string>();
  const [categoryForm] = Form.useForm<{code?: string; name?: string; parentCategoryRef?: string | null}>();
  const categoryActionTriggerRef = useRef<HTMLElement | null>(null);
  const [batchAction, setBatchAction] = useState<CatalogBatchAction>();
  const [batchStatus, setBatchStatus] = useState<CatalogBatchStatus>('ENABLED');
  const [batchCategoryRefs, setBatchCategoryRefs] = useState<string[]>([]);
  const [batchTagRefs, setBatchTagRefs] = useState<string[]>([]);
  const [batchResults, setBatchResults] = useState<CatalogBatchRowResult[]>([]);
  const [batchProblem, setBatchProblem] = useState<string>();
  const [batchSubmitting, setBatchSubmitting] = useState(false);
  const detail = useDetailDrawer<string>();
  const detailTriggerRef = useRef<HTMLElement | null>(null);
  const generation = useAsyncGenerationGuard();
  const listRequestGeneration = useRef(0);
  const [acceptedPage, setAcceptedPage] = useState<ReturnType<typeof decodeItems>>();
  const editCatalogCapability =
    surface === 'brand' ? ACTION_CAPABILITIES.EDIT_HEAD_COMPANY_CATALOG : ACTION_CAPABILITIES.EDIT_STORE_CATALOG;
  const canWriteCatalog = (actionCapabilityKeys as readonly string[]).includes(editCatalogCapability);
  useOverlayLock(Boolean(categoryAction || batchAction || detail.isOpen));
  const [createCategory, createCategoryState] = operationsRtk.useCreateOperationsCatalogCategoryMutation();
  const [updateCategory, updateCategoryState] = operationsRtk.useUpdateOperationsCatalogCategoryMutation();
  const [moveCategory, moveCategoryState] = operationsRtk.useMoveOperationsCatalogCategoryMutation();
  const [deleteCategory, deleteCategoryState] = operationsRtk.useDeleteOperationsCatalogCategoryMutation();
  const headCompanyRequest = useMemo(
    () =>
      operationsAdminRtkRequest.getOperationsOrganizationHeadCompany(
        {groupWorkspaceKey: queryContext.groupWorkspaceKey, headCompanyId: queryContext.scopeRef ?? ''},
        {query: {expectedContextVersion: queryContext.expectedContextVersion}},
      ),
    [queryContext.expectedContextVersion, queryContext.groupWorkspaceKey, queryContext.scopeRef],
  );
  const headCompanyQuery = operationsRtk.useGetOperationsOrganizationHeadCompanyQuery(headCompanyRequest, {
    skip: surface !== 'brand' || !queryContext.scopeRef,
  });
  const brands = useMemo(
    () =>
      (headCompanyQuery.data as HeadCompany | undefined)?.authorizedBrands.filter(
        brand => brand.status === 'ENABLED',
      ) ?? [],
    [headCompanyQuery.data],
  );
  useEffect(() => {
    if (surface !== 'brand') return;
    setBrandRef(current => (brands.some(brand => brand.id === current) ? current : brands[0]?.id));
  }, [brands, surface]);
  const headers = useMemo(() => (brandRef ? {'X-Workspace-Brand-Ref': brandRef} : undefined), [brandRef]);
  const scopeReady = Boolean(queryContext.scopeRef) && (surface === 'store' || Boolean(brandRef));
  const contextRequest = useMemo(
    () =>
      catalogInventoryRtkRequest.getOperationsCatalogWorkbenchContext(
        {},
        {query: {dataNodeRef: wireUuid(queryContext.scopeRef ?? '')}, headers},
      ),
    [headers, queryContext.scopeRef],
  );
  const navigationRequest = useMemo(
    () =>
      catalogInventoryRtkRequest.getOperationsCatalogNavigation(
        {},
        {query: {dataNodeRef: wireUuid(queryContext.scopeRef ?? ''), viewKey: 'ALL'}, headers},
      ),
    [headers, queryContext.scopeRef],
  );
  const manifestRequest = useMemo(
    () =>
      catalogInventoryRtkRequest.getOperationsCatalogShapeManifest(
        {},
        {query: {dataNodeRef: wireUuid(queryContext.scopeRef ?? '')}, headers},
      ),
    [headers, queryContext.scopeRef],
  );
  const tagDictionaryRequest = useMemo(
    () =>
      catalogInventoryRtkRequest.getOperationsCatalogDictionary(
        {dictionaryKind: 'TAG'},
        {query: {dataNodeRef: wireUuid(queryContext.scopeRef ?? '')}, headers},
      ),
    [headers, queryContext.scopeRef],
  );
  const listQuery = useMemo(
    () =>
      buildCatalogItemsQuery({
        dataNodeRef: wireUuid(queryContext.scopeRef ?? ''),
        keyword: filters.keyword,
        smartViewKey: treeSelection.kind === 'SMART' ? treeSelection.ref : undefined,
        shapeKey: treeSelection.kind === 'SHAPE' ? treeSelection.ref : undefined,
        categoryRef: treeSelection.kind === 'CATEGORY' ? wireUuid(treeSelection.ref) : undefined,
        uncategorized: treeSelection.kind === 'UNCATEGORIZED' ? true : undefined,
        includeSubCategories: treeSelection.kind === 'CATEGORY' ? true : undefined,
        status: filters.status,
        source: filters.source,
        cursor,
        pageSize,
      }),
    [cursor, filters, pageSize, queryContext.scopeRef, treeSelection],
  );
  const queryGeneration = useMemo(
    () => JSON.stringify({scopeRef: queryContext.scopeRef ?? '', brandRef: brandRef ?? '', query: listQuery}),
    [brandRef, listQuery, queryContext.scopeRef],
  );
  const itemsRequest = useMemo(
    () => catalogInventoryRtkRequest.getOperationsCatalogItems({}, {query: {...listQuery, queryGeneration}, headers}),
    [headers, listQuery, queryGeneration],
  );
  const contextQuery = operationsRtk.useGetOperationsCatalogWorkbenchContextQuery(contextRequest, {skip: !scopeReady});
  const navigationQuery = operationsRtk.useGetOperationsCatalogNavigationQuery(navigationRequest, {skip: !scopeReady});
  const manifestQuery = operationsRtk.useGetOperationsCatalogShapeManifestQuery(manifestRequest, {skip: !scopeReady});
  const tagDictionaryQuery = operationsRtk.useGetOperationsCatalogDictionaryQuery(tagDictionaryRequest, {
    skip: !scopeReady,
  });
  const itemsQuery = operationsRtk.useGetOperationsCatalogItemsQuery(itemsRequest, {skip: !scopeReady});
  // `currentData` is bound to the current RTK query arguments. Using `data`
  // here can keep the previous brand/tree response visible while a new
  // request is pending, which defeats the scope generation boundary.
  const context = decodeWorkbenchContext(contextQuery.currentData);
  const navigation = decodeNavigation(navigationQuery.currentData);
  const manifest = manifestQuery.currentData?.data;
  const tagDictionaryEntries = useMemo(
    () => decodeCatalogDictionaryLabels(tagDictionaryQuery.currentData),
    [tagDictionaryQuery.currentData],
  );
  const tagLabels = useMemo(
    () =>
      new Map(decodeCatalogDictionaryLabels(tagDictionaryQuery.currentData).map(entry => [entry.entryRef, entry.name])),
    [tagDictionaryQuery.currentData],
  );
  useEffect(() => {
    listRequestGeneration.current = generation.begin();
    setAcceptedPage(undefined);
  }, [generation, itemsRequest]);
  useEffect(() => {
    const next = decodeItems(itemsQuery.currentData);
    if (
      !next ||
      !itemsQuery.currentData ||
      next.queryGeneration !== queryGeneration ||
      !generation.isCurrent(listRequestGeneration.current)
    )
      return;
    setAcceptedPage(next);
  }, [generation, itemsQuery.currentData, queryGeneration]);
  const page = acceptedPage ?? {items: [], total: 0, cursor: '', generation: 0, queryGeneration: ''};
  const selectedItemRows = useMemo(
    () => page.items.filter(row => selectedRows.includes(row.code) && isCatalogBatchRowSelectable(row)),
    [page.items, selectedRows],
  );
  const categoryOptions = useMemo(
    () =>
      navigation.tree.map(node => ({
        value: node.categoryRef,
        label: <NameCodeText name={node.name} code={node.code} />,
      })),
    [navigation.tree],
  );
  const tagOptions = useMemo(
    () => tagDictionaryEntries.map(entry => ({value: entry.entryRef, label: <NameCodeText name={entry.name} />})),
    [tagDictionaryEntries],
  );
  const categorySubmitting =
    createCategoryState.isLoading ||
    updateCategoryState.isLoading ||
    moveCategoryState.isLoading ||
    deleteCategoryState.isLoading;
  useEffect(() => {
    if (!categoryAction) return;
    categoryForm.setFieldsValue({
      name: categoryAction.node?.name,
      parentCategoryRef:
        categoryAction.mode === 'REPARENT' ? (categoryAction.node?.parentCategoryRef ?? null) : undefined,
    });
  }, [categoryAction, categoryForm]);
  const finishCategoryAction = useCallback(() => {
    setCategoryAction(undefined);
    setCategoryProblem(undefined);
    categoryForm.resetFields();
  }, [categoryForm]);
  const rememberCategoryActionTrigger = useCallback((event: ReactMouseEvent<HTMLElement>) => {
    const target = event.target instanceof HTMLElement ? event.target.closest('button') : null;
    categoryActionTriggerRef.current = target ?? event.currentTarget;
  }, []);
  useEffect(() => {
    if (categoryAction) {
      if (!categoryActionTriggerRef.current && document.activeElement instanceof HTMLElement)
        categoryActionTriggerRef.current = document.activeElement;
      return;
    }
    if (!categoryActionTriggerRef.current) return;
    const trigger = categoryActionTriggerRef.current;
    categoryActionTriggerRef.current = null;
    if (trigger.isConnected) trigger.focus();
  }, [categoryAction]);
  const closeCategoryAction = useCallback(() => {
    if (!categoryForm.isFieldsTouched()) {
      finishCategoryAction();
      return;
    }
    Modal.confirm({
      title: '放弃分类修改？',
      content: '未保存的分类修改将丢失。',
      okText: '放弃修改',
      cancelText: '继续编辑',
      onOk: finishCategoryAction,
    });
  }, [categoryForm, finishCategoryAction]);
  const submitCategoryAction = async () => {
    if (!categoryAction) return;
    try {
      const values = await categoryForm.validateFields();
      const dataNodeRef = requireOperationsScopeRef(queryContext);
      const node = categoryAction.node;
      const categoryRef = node?.categoryRef;
      if (categoryAction.mode === 'CREATE') {
        const code = values.code?.trim() ?? '';
        const body = {dataNodeRef, code, name: values.name?.trim() ?? '', parentCategoryRef: node?.categoryRef ?? null};
        const idempotencyKey = await createContentIdempotencyKey(
          CATALOG_INVENTORY_OPERATION_IDS.createOperationsCatalogCategory,
          body,
        );
        await createCategory(
          catalogInventoryRtkRequest.createOperationsCatalogCategory(
            {},
            {headers: {...headers, 'Idempotency-Key': idempotencyKey}, body},
          ),
        ).unwrap();
      } else if (!categoryRef || !node) {
        throw new Error('CATEGORY_REF_MISSING');
      } else if (categoryAction.mode === 'RENAME') {
        const body = {dataNodeRef, categoryRef, expectedVersion: node.version, name: values.name?.trim() ?? ''};
        const idempotencyKey = await createContentIdempotencyKey(
          CATALOG_INVENTORY_OPERATION_IDS.updateOperationsCatalogCategory,
          body,
        );
        await updateCategory(
          catalogInventoryRtkRequest.updateOperationsCatalogCategory(
            {categoryRef},
            {headers: {...headers, 'Idempotency-Key': idempotencyKey}, body},
          ),
        ).unwrap();
      } else if (
        categoryAction.mode === 'REPARENT' ||
        categoryAction.mode === 'MOVE_UP' ||
        categoryAction.mode === 'MOVE_DOWN'
      ) {
        const action: 'REPARENT' | 'UP' | 'DOWN' =
          categoryAction.mode === 'REPARENT' ? 'REPARENT' : categoryAction.mode === 'MOVE_UP' ? 'UP' : 'DOWN';
        const body = {
          dataNodeRef,
          categoryRef,
          expectedVersion: node.version,
          action,
          ...(action === 'REPARENT'
            ? {parentCategoryRef: values.parentCategoryRef ? wireUuid(values.parentCategoryRef) : null}
            : {}),
        };
        const idempotencyKey = await createContentIdempotencyKey(
          CATALOG_INVENTORY_OPERATION_IDS.moveOperationsCatalogCategory,
          body,
        );
        await moveCategory(
          catalogInventoryRtkRequest.moveOperationsCatalogCategory(
            {categoryRef},
            {headers: {...headers, 'Idempotency-Key': idempotencyKey}, body},
          ),
        ).unwrap();
      } else {
        const body = {dataNodeRef, categoryRef, expectedVersion: node.version};
        const idempotencyKey = await createContentIdempotencyKey(
          CATALOG_INVENTORY_OPERATION_IDS.deleteOperationsCatalogCategory,
          body,
        );
        await deleteCategory(
          catalogInventoryRtkRequest.deleteOperationsCatalogCategory(
            {categoryRef},
            {headers: {...headers, 'Idempotency-Key': idempotencyKey}, body},
          ),
        ).unwrap();
      }
      finishCategoryAction();
      refresh();
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) return;
      setCategoryProblem(operationsProblemOf(error).detail || '分类操作未完成，请重试。');
    }
  };
  const changeBrand = (nextBrand: string) => {
    generation.begin();
    setBrandRef(nextBrand);
    setTreeSelection({kind: 'SMART', ref: 'ALL', label: '全部商品'});
    setKeywordDraft('');
    setFilters({});
    resetCursor();
    setSelectedRows([]);
    setExpandedRows([]);
    setTreeExpandedKeys(defaultCatalogTreeExpandedKeys);
  };
  const selectTree = useCallback(
    (next: TreeSelection) => {
      generation.begin();
      setTreeSelection(next);
      resetCursor();
      setSelectedRows([]);
      setExpandedRows([]);
      if (next.kind === 'SMART' && next.ref !== 'ALL') setFilters(current => ({keyword: current.keyword}));
    },
    [generation],
  );
  const resetListPresentation = useCallback(() => {
    resetCursor();
    setSelectedRows([]);
    setExpandedRows([]);
  }, [resetCursor]);
  const refresh = useCallback(() => {
    listRequestGeneration.current = generation.begin();
    if (surface === 'brand') void headCompanyQuery.refetch();
    void contextQuery.refetch();
    void navigationQuery.refetch();
    void manifestQuery.refetch();
    void tagDictionaryQuery.refetch();
    void itemsQuery.refetch();
  }, [
    contextQuery,
    generation,
    headCompanyQuery,
    itemsQuery,
    manifestQuery,
    navigationQuery,
    surface,
    tagDictionaryQuery,
  ]);
  const closeBatchAction = useCallback(() => {
    if (batchSubmitting) return;
    setBatchAction(undefined);
    setBatchResults([]);
    setBatchProblem(undefined);
  }, [batchSubmitting]);
  const openDetail = useCallback(
    (itemCode: string, trigger: HTMLElement) => {
      detailTriggerRef.current = trigger;
      detail.open(itemCode);
    },
    [detail],
  );
  const closeDetail = useCallback(
    (restoreFocus = true) => {
      detail.close();
      if (restoreFocus) window.requestAnimationFrame(() => detailTriggerRef.current?.focus());
    },
    [detail],
  );
  const openBatchAction = useCallback((next: CatalogBatchAction) => {
    setBatchAction(next);
    setBatchResults([]);
    setBatchProblem(undefined);
    if (next === 'CATEGORY') setBatchCategoryRefs([]);
    if (next === 'TAG') setBatchTagRefs([]);
    if (next === 'STATUS') setBatchStatus('ENABLED');
  }, []);
  const runBatchAction = useCallback(async () => {
    if (!batchAction || selectedItemRows.length === 0) return;
    setBatchSubmitting(true);
    setBatchProblem(undefined);
    const dataNodeRef = requireOperationsScopeRef(queryContext);
    try {
      if (batchAction === 'STATUS' || batchAction === 'ARCHIVE') {
        const targetStatus: CatalogBatchStatus = batchAction === 'ARCHIVE' ? 'ARCHIVED' : batchStatus;
        const body = buildCatalogBatchStatusRequest(dataNodeRef, targetStatus, selectedItemRows);
        const idempotencyKey = await createContentIdempotencyKey(
          CATALOG_INVENTORY_OPERATION_IDS.batchTransitionOperationsCatalogItemStatus,
          body,
        );
        const response = await catalogInventoryClient.batchTransitionOperationsCatalogItemStatus(
          {},
          {headers: {...headers, 'Idempotency-Key': idempotencyKey}, body},
        );
        setBatchResults(alignCatalogBatchResults(selectedItemRows, decodeCatalogBatchResults(response)));
      } else {
        const updateKind: CatalogBatchUpdateKind = batchAction;
        const refs = (
          batchAction === 'CATEGORY' ? batchCategoryRefs : batchTagRefs
        ) as CatalogItemSummary['categoryRefs'];
        const results = await Promise.all(
          selectedItemRows.map(async (row): Promise<CatalogBatchRowResult> => {
            try {
              const detailResponse = await catalogInventoryClient.getOperationsCatalogItem(
                {itemCode: row.code},
                {query: {dataNodeRef}, headers},
              );
              const detail = decodeDetail(detailResponse);
              if (!detail) throw new Error('CATALOG_DETAIL_UNAVAILABLE');
              const body = buildCatalogBatchSaveRequest(detail, dataNodeRef, updateKind, refs);
              const idempotencyKey = await createContentIdempotencyKey(
                CATALOG_INVENTORY_OPERATION_IDS.saveOperationsCatalogItem,
                body,
              );
              await catalogInventoryClient.saveOperationsCatalogItem(
                {itemCode: row.code},
                {headers: {...headers, 'Idempotency-Key': idempotencyKey}, body},
              );
              return {itemRef: row.itemRef, code: row.code, ok: true, failureCode: null};
            } catch (error) {
              const problem = operationsProblemOf(error);
              return {
                itemRef: row.itemRef,
                code: row.code,
                ok: false,
                failureCode: problem.errorCode === 'NETWORK_ERROR' ? 'RESULT_UNKNOWN' : problem.errorCode,
              };
            }
          }),
        );
        setBatchResults(results);
      }
      setSelectedRows([]);
      refresh();
    } catch (error) {
      const problem = operationsProblemOf(error);
      setBatchProblem(problem.detail || '批量操作未完成，请检查当前选择后重试。');
    } finally {
      setBatchSubmitting(false);
    }
  }, [batchAction, batchCategoryRefs, batchStatus, batchTagRefs, headers, queryContext, refresh, selectedItemRows]);
  const treeData = useMemo<CatalogTreeNode[]>(() => {
    const match = treeSearch.trim().toLocaleLowerCase();
    const categoryByParent = new Map<string, CatalogNavigation['tree']>();
    navigation.tree.forEach(node => {
      const parent = node.parentCategoryRef ?? '';
      categoryByParent.set(parent, [...(categoryByParent.get(parent) ?? []), node]);
    });
    const categoryMatches = (node: CatalogNavigation['tree'][number]): boolean =>
      !match ||
      node.name.toLocaleLowerCase().includes(match) ||
      node.code.toLocaleLowerCase().includes(match) ||
      (categoryByParent.get(node.categoryRef) ?? []).some(categoryMatches);
    const renderCategory = (node: CatalogNavigation['tree'][number]): CatalogTreeNode => {
      const siblings = (categoryByParent.get(node.parentCategoryRef ?? '') ?? [])
        .slice()
        .sort((left, right) => left.displayOrder - right.displayOrder || left.code.localeCompare(right.code));
      const siblingIndex = siblings.findIndex(sibling => sibling.categoryRef === node.categoryRef);
      const canMoveUp = siblingIndex > 0;
      const canMoveDown = siblingIndex >= 0 && siblingIndex < siblings.length - 1;
      return {
        key: `CATEGORY:${node.categoryRef}`,
        title: (
          <CatalogTreeLine
            label={node.name}
            count={node.count}
            action={
              canWriteCatalog && (
                <span
                  onClick={event => event.stopPropagation()}
                  onDoubleClick={event => event.stopPropagation()}
                  onKeyDown={event => event.stopPropagation()}
                  onMouseDown={event => {
                    rememberCategoryActionTrigger(event);
                    event.stopPropagation();
                  }}
                >
                  <Dropdown
                    trigger={['click']}
                    menu={{
                      items: [
                        ...(!node.parentCategoryRef ? [{key: 'create-child', label: '新建子分类'}] : []),
                        {key: 'rename', label: '重命名'},
                        {key: 'reparent', label: '更换父分类'},
                        {
                          key: 'move-up',
                          label: '向上移动',
                          disabled: !canMoveUp,
                          title: canMoveUp ? undefined : '分类已位于当前层级首位',
                        },
                        {
                          key: 'move-down',
                          label: '向下移动',
                          disabled: !canMoveDown,
                          title: canMoveDown ? undefined : '分类已位于当前层级末位',
                        },
                        {
                          key: 'delete',
                          label: '删除分类',
                          danger: true,
                          disabled: !node.deletionAvailability.canDelete,
                          title: node.deletionAvailability.canDelete
                            ? undefined
                            : `仍有 ${node.deletionAvailability.blockingReferenceCount} 个商品引用`,
                        },
                      ],
                      onClick: ({key}) => {
                        if (key === 'create-child' && !node.parentCategoryRef)
                          setCategoryAction({mode: 'CREATE', node});
                        if (key === 'rename') setCategoryAction({mode: 'RENAME', node});
                        if (key === 'reparent') setCategoryAction({mode: 'REPARENT', node});
                        if (key === 'move-up') setCategoryAction({mode: 'MOVE_UP', node});
                        if (key === 'move-down') setCategoryAction({mode: 'MOVE_DOWN', node});
                        if (key === 'delete') setCategoryAction({mode: 'DELETE', node});
                      },
                    }}
                  >
                    <Button
                      type="text"
                      size="small"
                      aria-label={`分类 ${node.name} 操作`}
                      {...testId(`catalog-category-actions-${node.code}`)}
                    >
                      ···
                    </Button>
                  </Dropdown>
                </span>
              )
            }
            {...testId(`catalog-category-node-${node.code}`)}
          >
            <NameCodeText name={node.name} code={node.code} />
          </CatalogTreeLine>
        ),
        children: (categoryByParent.get(node.categoryRef) ?? []).filter(categoryMatches).map(renderCategory),
      };
    };
    return [
      {key: 'SMART:ALL', title: <CatalogTreeLine label="全部商品" count={navigation.allCount} />},
      {
        key: 'smart-root',
        title: <CatalogTreeLine label="智能视图" icon={<BulbOutlined />} />,
        selectable: false,
        children: navigation.smartViews.map(node => ({
          key: `SMART:${node.viewKey}`,
          title: (
            <CatalogTreeLine
              label={catalogEnumLabel(manifest, 'smartViewKey', node.viewKey)}
              count={node.count}
              icon={smartViewIcons[node.viewKey] ?? <AppstoreOutlined />}
            />
          ),
        })),
      },
      {
        key: 'shape-root',
        title: <CatalogTreeLine label="商品形态" icon={<AppstoreOutlined />} />,
        selectable: false,
        children: navigation.shapeCounts.map(node => ({
          key: `SHAPE:${node.shapeKey}`,
          title: (
            <CatalogTreeLine
              label={catalogEnumLabel(manifest, 'shapeKey', node.shapeKey)}
              count={node.count}
              icon={shapeIcons[node.shapeKey] ?? <AppstoreOutlined />}
            />
          ),
        })),
      },
      {
        key: 'category-root',
        title: (
          <CatalogTreeLine
            label="商品分类"
            icon={<TagsOutlined />}
            action={
              canWriteCatalog && (
                <Button
                  type="link"
                  size="small"
                  onClick={event => {
                    event.stopPropagation();
                    setCategoryAction({mode: 'CREATE'});
                  }}
                  {...testId('catalog-category-create-root')}
                >
                  新建分类
                </Button>
              )
            }
          />
        ),
        selectable: false,
        children: [
          {
            key: 'UNCATEGORIZED:UNCATEGORIZED',
            title: <CatalogTreeLine label="未分类" count={navigation.uncategorizedCount ?? 0} />,
          },
          ...(categoryByParent.get('') ?? []).filter(categoryMatches).map(renderCategory),
        ],
      },
    ];
  }, [canWriteCatalog, manifest, navigation, rememberCategoryActionTrigger, treeSearch]);
  const searchExpandedKeys = useMemo<Key[] | undefined>(() => {
    if (!treeSearch.trim()) return undefined;
    const keys: Key[] = [];
    const visit = (nodes: CatalogTreeNode[]) =>
      nodes.forEach(node => {
        if (!node.children?.length) return;
        keys.push(node.key);
        visit(node.children);
      });
    visit(treeData);
    return keys;
  }, [treeData, treeSearch]);
  const statusFilterConflict = catalogFilterConflictReason(treeSelection, 'status');
  const sourceFilterConflict = catalogFilterConflictReason(treeSelection, 'source');
  const statusOptions = useMemo(
    () =>
      catalogEnumOptions(manifest, 'catalogItemStatus').filter(({value}) =>
        ['DRAFT', 'ENABLED', 'DISABLED', 'ARCHIVED'].includes(value),
      ),
    [manifest],
  );
  const sourceOptions = useMemo(() => catalogEnumOptions(manifest, 'catalogSource'), [manifest]);
  const columns = useMemo<ProColumns<CatalogItemSummary>[]>(
    () => [
      Table.SELECTION_COLUMN as unknown as ProColumns<CatalogItemSummary>,
      Table.EXPAND_COLUMN as unknown as ProColumns<CatalogItemSummary>,
      {
        title: '商品',
        key: 'item',
        fixed: 'left',
        width: 280,
        render: (_, row) => (
          <Space align="start" size={8}>
            {row.primaryImageAssetRef ? (
              <CatalogAssetPreview
                assetRef={row.primaryImageAssetRef}
                alt={`${row.name}商品图片`}
                width={48}
                height={48}
                preview={false}
                testId={`catalog-item-thumbnail-${row.code}`}
              />
            ) : (
              <Typography.Text type="secondary" style={{fontSize: 12, minWidth: 48}}>
                无图
              </Typography.Text>
            )}
            <span style={{display: 'grid', minWidth: 0, textAlign: 'left'}}>
              <Button
                type="link"
                size="small"
                onClick={event => openDetail(row.code, event.currentTarget)}
                style={{justifyContent: 'flex-start', paddingInline: 0}}
                {...testId(`catalog-inventory-open-item-${row.code}`)}
              >
                <NameCodeText name={row.name} code={row.code} />
              </Button>
              {row.shortName?.trim() && (
                <Typography.Text type="secondary" style={{fontSize: 12}}>
                  短名：{row.shortName}
                </Typography.Text>
              )}
              <Typography.Text type="secondary" style={{fontSize: 12}}>
                {itemReferenceSummary(row, navigation, tagLabels)}
              </Typography.Text>
            </span>
          </Space>
        ),
      },
      {
        title: '形态 / 规格',
        key: 'shape',
        width: 190,
        render: (_, row) => (
          <Space direction="vertical" size={0}>
            <span>{catalogEnumLabel(manifest, 'shapeKey', row.shapeKey)}</span>
            <Typography.Text type="secondary">
              {row.skuNonArchivedCount
                ? [
                    `${row.skuEnabledCount}/${row.skuNonArchivedCount} 个 SKU`,
                    row.skuDimensionSummary.length ? ` · ${row.skuDimensionSummary.join('、')}` : '',
                  ].join('')
                : '无 SKU'}
            </Typography.Text>
          </Space>
        ),
      },
      {
        title: '价格 / 粒度',
        key: 'price',
        width: 150,
        render: (_, row) => (
          <Space direction="vertical" size={0}>
            <span>{catalogPriceLabel(row)}</span>
            <Typography.Text type={row.missingPriceCount ? 'danger' : 'secondary'}>
              {catalogEnumLabel(manifest, 'priceGranularity', row.priceGranularity)}
              {row.missingPriceCount ? ` · 缺价 ${row.missingPriceCount}` : ''}
            </Typography.Text>
          </Space>
        ),
      },
      {
        title: surface === 'brand' ? '库存对象 / BOM 定义' : '库存 / BOM',
        key: 'inventory',
        width: 180,
        render: (_, row) => (
          <Space direction="vertical" size={0}>
            <span>
              {row.stockTargetCount} 个库存对象 / {row.bomCount} 个 BOM
            </span>
          </Space>
        ),
      },
      {
        title: '状态',
        key: 'status',
        width: 110,
        render: (_, row) => (
          <Tag color={row.status === 'ENABLED' ? 'green' : 'default'}>
            {catalogEnumLabel(manifest, 'catalogItemStatus', row.status)}
          </Tag>
        ),
      },
      {
        title: '来源',
        dataIndex: 'source',
        width: 110,
        render: (_, row) => catalogEnumLabel(manifest, 'catalogSource', row.source),
      },
      {title: '更新时间', dataIndex: 'updatedAt', valueType: 'dateTime', width: 180},
      {title: '版本', dataIndex: 'version', search: false},
    ],
    [manifest, navigation, openDetail, surface, tagLabels],
  );
  const failed = Boolean(
    contextQuery.error || navigationQuery.error || manifestQuery.error || itemsQuery.error || headCompanyQuery.error,
  );
  const scopeForbidden = [
    contextQuery.error,
    navigationQuery.error,
    manifestQuery.error,
    itemsQuery.error,
    headCompanyQuery.error,
  ].some(error => Boolean(error && operationsProblemOf(error).errorCode === 'SCOPE_FORBIDDEN'));
  const noAuthorizedBrand =
    surface === 'brand' &&
    !headCompanyQuery.isLoading &&
    !headCompanyQuery.error &&
    Boolean(headCompanyQuery.data) &&
    brands.length === 0;
  const noSelectedScope =
    !queryContext.scopeRef || (surface === 'brand' && !brandRef && !headCompanyQuery.isLoading && !noAuthorizedBrand);
  const canCreateCatalog = Boolean(context?.actionAvailability.canCreate);
  const createUnavailableReason = context?.actionAvailability.reasons?.filter(Boolean).join('；');
  const createButton = (
    <Button
      type="primary"
      disabled={!canCreateCatalog}
      onClick={() => setCreateOpen(true)}
      {...testId('catalog-inventory-create')}
    >
      新建商品
    </Button>
  );
  const smartViewExplanation =
    treeSelection.kind === 'SMART' && treeSelection.ref !== 'ALL'
      ? `智能视图“${treeSelection.label}”已限定结果域；与该结果域冲突的筛选项已禁用。`
      : undefined;
  const rootTestId = surface === 'store' ? 'catalog-inventory-store-page' : 'catalog-inventory-brand-page';
  return (
    <section {...testId(rootTestId)}>
      {scopeForbidden && (
        <Alert
          type="error"
          showIcon
          title="当前范围无权访问商品数据"
          description="请切换到有权限的数据节点或品牌；系统不会展示其他范围的商品。"
          action={<Button onClick={refresh}>重试</Button>}
          style={{marginBottom: 16}}
          {...testId('catalog-inventory-workbench-scope-forbidden')}
        />
      )}
      {!scopeForbidden && failed && (
        <Alert
          type="error"
          showIcon
          title="商品工作台暂时无法获取"
          description="当前筛选和结果域已保留，请重试。"
          action={<Button onClick={refresh}>重试</Button>}
          style={{marginBottom: 16}}
          {...testId('catalog-inventory-workbench-problem')}
        />
      )}
      {noAuthorizedBrand && (
        <Alert
          type="info"
          showIcon
          title="当前没有可操作的品牌"
          description="当前数据节点下没有授权且启用的品牌，商品列表不会伪装成普通空结果。"
          style={{marginBottom: 16}}
          {...testId('catalog-inventory-no-authorized-brand')}
        />
      )}
      {noSelectedScope && (
        <Alert
          type="info"
          showIcon
          title="请选择管理范围"
          description={surface === 'brand' ? '请选择一个已授权品牌后再查看商品。' : '请选择一个门店后再查看商品。'}
          style={{marginBottom: 16}}
          {...testId('catalog-inventory-scope-required')}
        />
      )}
      <Card size="small" styles={{body: {display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap'}}}>
        <Space wrap>
          <Segmented
            value={view}
            options={[
              {label: '树表视图', value: 'TREE_TABLE'},
              {label: '仅表格', value: 'TABLE_ONLY'},
            ]}
            onChange={value => setView(value as typeof view)}
            {...testId('catalog-inventory-view-switch')}
          />
          {surface === 'brand' && (
            <Select
              value={brandRef}
              loading={headCompanyQuery.isLoading}
              placeholder="选择已授权品牌"
              options={brands.map(brand => ({
                value: brand.id,
                label: <NameCodeText name={brand.name} code={brand.code} />,
              }))}
              onChange={changeBrand}
              style={{minWidth: 220}}
              {...testId('catalog-inventory-brand-switch')}
            />
          )}
        </Space>
        <Space wrap>
          <Button
            onClick={() => {
              setDictionaryKind('TAG');
              setDictionaryOpen(true);
            }}
            {...testId('catalog-inventory-dictionary')}
          >
            商品元数据
          </Button>
          {surface === 'store' &&
            canWriteCatalog &&
            context?.headCompanyRef &&
            context.brandRef &&
            context.copySourceAvailable &&
            context.actionAvailability.canCopy && (
              <Button onClick={() => setCopyOpen(true)} {...testId('catalog-inventory-copy-open')}>
                从品牌复制
              </Button>
            )}
          {canWriteCatalog &&
            (canCreateCatalog || !createUnavailableReason ? (
              createButton
            ) : (
              <Tooltip title={createUnavailableReason}>
                <span style={{display: 'inline-block'}}>{createButton}</span>
              </Tooltip>
            ))}
        </Space>
      </Card>
      <div style={{display: 'flex', gap: 16, marginTop: 16, minHeight: 460}}>
        {view === 'TREE_TABLE' && (
          <Card
            size="small"
            style={{width: 312, flex: '0 0 312px'}}
            title="商品视图和分类"
            {...testId('catalog-inventory-tree')}
          >
            <Input.Search
              allowClear
              placeholder="搜索分类名称/编码"
              value={treeSearch}
              onChange={event => setTreeSearch(event.target.value)}
              {...testId('catalog-inventory-tree-search')}
            />
            {navigationQuery.isLoading && !navigationQuery.currentData ? (
              <Skeleton active paragraph={{rows: 7}} {...testId('catalog-inventory-tree-loading')} />
            ) : (
              <Tree
                blockNode
                expandedKeys={treeSearch.trim() ? searchExpandedKeys : treeExpandedKeys}
                onExpand={keys => setTreeExpandedKeys(keys)}
                selectedKeys={[`${treeSelection.kind}:${treeSelection.ref}`]}
                treeData={treeData}
                onSelect={keys => {
                  const [kind, ...ref] = String(keys[0] ?? '').split(':');
                  if (!['SMART', 'SHAPE', 'CATEGORY', 'UNCATEGORIZED'].includes(kind)) return;
                  const key = ref.join(':');
                  const label =
                    kind === 'SMART'
                      ? catalogEnumLabel(manifest, 'smartViewKey', key)
                      : kind === 'SHAPE'
                        ? catalogEnumLabel(manifest, 'shapeKey', key)
                        : kind === 'UNCATEGORIZED'
                          ? '未分类'
                          : (navigation.tree.find(node => node.categoryRef === key)?.name ?? key);
                  selectTree({kind: kind as TreeSelection['kind'], ref: key, label});
                }}
                style={{marginTop: 12}}
              />
            )}
          </Card>
        )}
        <div style={{minWidth: 0, flex: 1}}>
          <Card size="small" style={{marginBottom: 12}} title={`当前结果域：${treeSelection.label}`}>
            {smartViewExplanation && (
              <Alert
                type="info"
                showIcon
                title="智能视图结果域"
                description={smartViewExplanation}
                style={{marginBottom: 12}}
                {...testId('catalog-inventory-smart-view-explanation')}
              />
            )}
            <Space wrap>
              <Input.Search
                value={keywordDraft}
                onChange={event => setKeywordDraft(event.target.value)}
                onSearch={() => {
                  setFilters(current => ({...current, keyword: keywordDraft.trim() || undefined}));
                  resetListPresentation();
                }}
                placeholder="在当前结果域搜索：编码/名称/短名"
                style={{width: 320}}
                {...testId('catalog-inventory-local-search')}
              />
              <span style={{display: 'inline-flex', alignItems: 'center', gap: 6}}>
                <Select
                  allowClear
                  disabled={Boolean(statusFilterConflict)}
                  value={filters.status}
                  placeholder="状态"
                  options={statusOptions}
                  onChange={status => {
                    setFilters(current => ({...current, status}));
                    resetListPresentation();
                  }}
                />
                {statusFilterConflict && (
                  <Typography.Text type="secondary" style={{fontSize: 12}}>
                    {statusFilterConflict}
                  </Typography.Text>
                )}
              </span>
              <span style={{display: 'inline-flex', alignItems: 'center', gap: 6}}>
                <Select
                  allowClear
                  disabled={Boolean(sourceFilterConflict)}
                  value={filters.source}
                  placeholder="来源"
                  options={sourceOptions}
                  onChange={source => {
                    setFilters(current => ({...current, source}));
                    resetListPresentation();
                  }}
                />
                {sourceFilterConflict && (
                  <Typography.Text type="secondary" style={{fontSize: 12}}>
                    {sourceFilterConflict}
                  </Typography.Text>
                )}
              </span>
              <Button
                onClick={() => {
                  generation.begin();
                  setKeywordDraft('');
                  setFilters({});
                  resetListPresentation();
                }}
              >
                重置
              </Button>
            </Space>
          </Card>
          <ProTable<CatalogItemSummary>
            rowKey="code"
            size="small"
            columns={columns}
            dataSource={page.items}
            search={false}
            options={{reload: refresh, density: false}}
            toolBarRender={() =>
              selectedRows.length
                ? [
                    <Space key="catalog-selection-summary" size={8} {...testId('catalog-inventory-selection-summary')}>
                      <Typography.Text type="secondary">已选择 {selectedRows.length} 项</Typography.Text>
                      {canWriteCatalog && (
                        <Dropdown
                          menu={{
                            items: [
                              {key: 'CATEGORY', label: '批量改分类'},
                              {key: 'TAG', label: '批量改标签'},
                              {key: 'STATUS', label: '批量改状态'},
                              {key: 'ARCHIVE', label: '批量归档', danger: true},
                            ],
                            onClick: ({key}) => openBatchAction(key as CatalogBatchAction),
                          }}
                        >
                          <Button {...testId('catalog-inventory-batch-actions')}>批量操作</Button>
                        </Dropdown>
                      )}
                      <Button type="link" size="small" onClick={() => setSelectedRows([])}>
                        取消选择
                      </Button>
                    </Space>,
                  ]
                : []
            }
            tableAlertRender={false}
            tableAlertOptionRender={false}
            sticky={{offsetHeader: 0}}
            scroll={{x: 1120}}
            expandable={{
              rowExpandable: row => row.skuNonArchivedCount > 0,
              expandedRowKeys: expandedRows,
              onExpandedRowsChange: keys => setExpandedRows([...keys]),
              expandedRowRender: row => (
                <CatalogSkuExpandedRow
                  itemCode={row.code}
                  dataNodeRef={queryContext.scopeRef ?? ''}
                  brandRef={context?.brandRef ?? brandRef}
                />
              ),
            }}
            {...adminListState({
              loading: itemsQuery.isFetching && scopeReady,
              failed: failed || !scopeReady || noAuthorizedBrand,
              emptyText: '当前结果域暂无商品',
              testIdPrefix: 'catalog-inventory-item-list',
            })}
            columnsState={{defaultValue: {version: {show: false}}}}
            pagination={false}
            rowSelection={{
              columnWidth: 32,
              selectedRowKeys: selectedRows,
              onChange: setSelectedRows,
              preserveSelectedRowKeys: false,
              getCheckboxProps: row => ({disabled: !isCatalogBatchRowSelectable(row)}),
            }}
            {...testId('catalog-inventory-item-table')}
          />
          <Space
            style={{display: 'flex', justifyContent: 'flex-end', marginTop: 12}}
            {...testId('catalog-inventory-item-pagination')}
          >
            <Button
              disabled={!canPrevious}
              onClick={() => goToPage(cursorPage - 1)}
              {...testId('catalog-inventory-item-page-previous')}
            >
              上一页
            </Button>
            <Typography.Text type="secondary">第 {cursorPage} 页</Typography.Text>
            <Button
              disabled={!page.cursor}
              onClick={() => goToPage(cursorPage + 1, page.cursor)}
              {...testId('catalog-inventory-item-page-next')}
            >
              下一页
            </Button>
          </Space>
        </div>
      </div>
      <Modal
        open={Boolean(batchAction)}
        title={
          batchAction === 'CATEGORY'
            ? '批量改分类'
            : batchAction === 'TAG'
              ? '批量改标签'
              : batchAction === 'STATUS'
                ? '批量改状态'
                : '批量归档'
        }
        onCancel={closeBatchAction}
        onOk={() => {
          if (batchResults.length) closeBatchAction();
          else void runBatchAction();
        }}
        okText={batchResults.length ? '关闭' : '执行'}
        cancelText="取消"
        confirmLoading={batchSubmitting}
        okButtonProps={{disabled: batchSubmitting || selectedItemRows.length === 0}}
        destroyOnHidden
        {...testId('catalog-inventory-batch-modal')}
      >
        {batchProblem && (
          <Alert
            type="error"
            showIcon
            title="批量操作未完成"
            description={batchProblem}
            style={{marginBottom: 12}}
            {...testId('catalog-inventory-batch-problem')}
          />
        )}
        {!batchResults.length && batchAction === 'CATEGORY' && (
          <Form.Item label="目标分类" extra="提交后会替换所选商品的分类关系；清空即取消全部分类">
            <Select
              mode="multiple"
              allowClear
              value={batchCategoryRefs}
              options={categoryOptions}
              onChange={setBatchCategoryRefs}
              placeholder="请选择分类"
              {...testId('catalog-inventory-batch-category')}
            />
          </Form.Item>
        )}
        {!batchResults.length && batchAction === 'TAG' && (
          <Form.Item label="目标标签" extra="提交后会替换所选商品的标签关系；清空即取消全部标签">
            <Select
              mode="multiple"
              allowClear
              value={batchTagRefs}
              options={tagOptions}
              onChange={setBatchTagRefs}
              placeholder="请选择标签"
              {...testId('catalog-inventory-batch-tag')}
            />
          </Form.Item>
        )}
        {!batchResults.length && batchAction === 'STATUS' && (
          <Form.Item label="目标状态">
            <Select
              value={batchStatus}
              options={[
                {value: 'ENABLED', label: '启用'},
                {value: 'DISABLED', label: '停用'},
              ]}
              onChange={setBatchStatus}
              {...testId('catalog-inventory-batch-status')}
            />
          </Form.Item>
        )}
        {!batchResults.length && batchAction === 'ARCHIVE' && (
          <Alert
            type="warning"
            showIcon
            title={`将归档 ${selectedItemRows.length} 个商品`}
            description="归档只修改状态与版本，不会清空图片、属性或其他商品事实。每条结果会单独返回。"
          />
        )}
        {batchResults.length > 0 && (
          <Space direction="vertical" size={12} style={{display: 'flex'}}>
            <Alert
              type={batchResults.every(result => result.ok) ? 'success' : 'warning'}
              showIcon
              title={[
                `已处理 ${batchResults.length} 条，`,
                `成功 ${batchResults.filter(result => result.ok).length} 条，`,
                `失败 ${batchResults.filter(result => !result.ok).length} 条`,
              ].join('')}
            />
            <List
              bordered
              size="small"
              dataSource={batchResults}
              renderItem={result => (
                <List.Item>
                  <Space>
                    <Typography.Text>{result.code}</Typography.Text>
                    {result.ok ? (
                      <Tag color="green">成功</Tag>
                    ) : (
                      <Tag color="red">失败 · {result.failureCode ?? 'RESULT_UNKNOWN'}</Tag>
                    )}
                  </Space>
                </List.Item>
              )}
            />
          </Space>
        )}
      </Modal>
      <CatalogItemDrawer
        itemCode={detail.target}
        queryContext={queryContext}
        brandRef={context?.brandRef ?? brandRef}
        canWriteCatalog={canWriteCatalog}
        surface={surface}
        navigation={navigation}
        dictionaryRevision={dictionaryRevision}
        onOpenProductionTags={() => {
          setDictionaryKind('PRODUCTION_TAG');
          setDictionaryOpen(true);
        }}
        onVoidAndRebuild={source => {
          closeDetail(false);
          detailTriggerRef.current = null;
          setRebuildPrefill(source);
          setCreateOpen(true);
        }}
        onClose={closeDetail}
        onChanged={refresh}
      />
      <CatalogItemCreateDrawer
        open={createOpen}
        queryContext={queryContext}
        brandRef={context?.brandRef ?? brandRef}
        initialValues={rebuildPrefill}
        onClose={() => {
          setCreateOpen(false);
          setRebuildPrefill(undefined);
        }}
        onCreated={createdCode => {
          setCreateOpen(false);
          setRebuildPrefill(undefined);
          refresh();
          detailTriggerRef.current = null;
          detail.open(createdCode);
        }}
      />
      <CatalogDictionaryDrawer
        open={dictionaryOpen}
        initialKind={dictionaryKind}
        queryContext={queryContext}
        brandRef={context?.brandRef ?? brandRef}
        canWrite={canWriteCatalog}
        onClose={(closedKind = dictionaryKind) => {
          setDictionaryOpen(false);
          setDictionaryRevision(current => ({...current, [closedKind]: (current[closedKind] ?? 0) + 1}));
          void tagDictionaryQuery.refetch();
        }}
      />
      {surface === 'store' && (
        <BrandCatalogCopyDrawer
          open={copyOpen}
          queryContext={queryContext}
          brandRef={context?.brandRef}
          onClose={() => setCopyOpen(false)}
          onCompleted={refresh}
        />
      )}
      <Modal
        open={Boolean(categoryAction)}
        title={
          categoryAction?.mode === 'CREATE'
            ? categoryAction.node
              ? '新建子分类'
              : '新建分类'
            : categoryAction?.mode === 'RENAME'
              ? '重命名分类'
              : categoryAction?.mode === 'REPARENT'
                ? '更换父分类'
                : categoryAction?.mode === 'MOVE_UP'
                  ? '向上移动分类'
                  : categoryAction?.mode === 'MOVE_DOWN'
                    ? '向下移动分类'
                    : '删除分类'
        }
        okText={categoryAction?.mode === 'DELETE' ? '删除' : '确定'}
        okButtonProps={categoryAction?.mode === 'DELETE' ? {danger: true} : undefined}
        onCancel={closeCategoryAction}
        onOk={() => void submitCategoryAction()}
        confirmLoading={categorySubmitting}
        destroyOnHidden
        {...testId('catalog-category-action-modal')}
      >
        <Form form={categoryForm} layout="vertical">
          {categoryProblem && (
            <Alert
              type="error"
              showIcon
              title="分类操作未完成"
              description={categoryProblem}
              style={{marginBottom: 12}}
            />
          )}
          {categoryAction?.mode === 'CREATE' && categoryAction.node && (
            <Form.Item label="父分类">
              <NameCodeText name={categoryAction.node.name} code={categoryAction.node.code} />
            </Form.Item>
          )}
          {categoryAction?.mode === 'REPARENT' && (
            <Form.Item label="目标父分类" name="parentCategoryRef">
              <Select
                options={[
                  {value: null, label: '根级（无父分类）'},
                  ...navigation.tree
                    .filter(
                      node =>
                        node.parentCategoryRef === null &&
                        node.categoryRef !== categoryAction.node?.categoryRef &&
                        !isCategoryDescendant(node, categoryAction.node?.categoryRef, navigation.tree),
                    )
                    .map(node => ({
                      value: node.categoryRef,
                      label: <NameCodeText name={node.name} code={node.code} />,
                    })),
                ]}
              />
            </Form.Item>
          )}
          {categoryAction?.mode === 'CREATE' && (
            <Form.Item label="分类编码" name="code" rules={[{required: true, message: '请输入分类编码'}]}>
              <Input {...testId('catalog-category-code')} />
            </Form.Item>
          )}
          {(categoryAction?.mode === 'CREATE' || categoryAction?.mode === 'RENAME') && (
            <Form.Item
              label="分类名称"
              name="name"
              rules={[
                {required: true, message: '请输入分类名称'},
                {max: 80, message: '名称不能超过 80 个字符'},
              ]}
            >
              <Input {...testId('catalog-category-name')} />
            </Form.Item>
          )}
          {categoryAction?.mode === 'MOVE_UP' && (
            <Typography.Text type="secondary">将按当前最新排序上移一位。</Typography.Text>
          )}
          {categoryAction?.mode === 'MOVE_DOWN' && (
            <Typography.Text type="secondary">将按当前最新排序下移一位。</Typography.Text>
          )}
          {categoryAction?.mode === 'DELETE' && (
            <Space direction="vertical" size={6}>
              <Typography.Text>
                将删除“{categoryAction.node?.name}”及其 {categoryAction.node?.deletionAvailability.subtreeSize ?? 0}{' '}
                个分类节点。
              </Typography.Text>
              {(categoryAction.node?.deletionAvailability.blockingReferenceLabels.length ?? 0) > 0 && (
                <Typography.Text type="danger">
                  仍被以下商品引用：{categoryAction.node?.deletionAvailability.blockingReferenceLabels.join('、')}
                </Typography.Text>
              )}
            </Space>
          )}
        </Form>
      </Modal>
    </section>
  );
}

function CatalogSkuExpandedRow({
  itemCode,
  dataNodeRef,
  brandRef,
}: {
  itemCode: string;
  dataNodeRef: string;
  brandRef?: string;
}) {
  const request = useMemo(
    () =>
      catalogInventoryRtkRequest.getOperationsCatalogItem(
        {itemCode},
        {
          query: {dataNodeRef: wireUuid(dataNodeRef)},
          headers: brandRef ? {'X-Workspace-Brand-Ref': brandRef} : undefined,
        },
      ),
    [brandRef, dataNodeRef, itemCode],
  );
  const query = operationsRtk.useGetOperationsCatalogItemQuery(request, {skip: !dataNodeRef || !itemCode});
  const detail = decodeDetail(query.data);
  if (query.isLoading && !query.data)
    return (
      <div {...testId(`catalog-inventory-sku-expand-${itemCode}`)}>
        <Skeleton active paragraph={{rows: 2}} />
      </div>
    );
  if (query.error)
    return (
      <Alert
        type="error"
        showIcon
        title="SKU 明细加载失败"
        description="当前商品暂未包含可查看的 SKU 明细，请重试。"
        action={
          <Button size="small" onClick={() => void query.refetch()}>
            重试
          </Button>
        }
        {...testId(`catalog-inventory-sku-expand-${itemCode}-error`)}
      />
    );
  const rows = detail?.item.skus ?? [];
  if (!rows.length)
    return (
      <Typography.Text type="secondary" {...testId(`catalog-inventory-sku-expand-${itemCode}`)}>
        该商品不按 SKU 管理，暂无 SKU 明细。
      </Typography.Text>
    );
  return (
    <Space
      direction="vertical"
      size={6}
      style={{display: 'flex'}}
      {...testId(`catalog-inventory-sku-expand-${itemCode}`)}
    >
      <Typography.Text type="secondary">SKU 规格与价格（展开行按需读取，不改变列表结果域）</Typography.Text>
      {rows.map(sku => (
        <Space key={sku.skuCode} wrap>
          <NameCodeText name={sku.skuName} code={sku.skuCode} />
          {sku.attributeValueRefs.length ? (
            <Space size={4} wrap>
              {sku.attributeValueRefs.map((ref, index) => (
                <Space key={`${ref.attributeValueRef}-${index}`} size={2}>
                  <NameCodeText name={ref.attributeName || undefined} code={ref.attributeCode || undefined} />
                  <span>=</span>
                  <NameCodeText name={ref.valueLabel || undefined} code={ref.valueCode || undefined} />
                </Space>
              ))}
            </Space>
          ) : (
            <Typography.Text type="secondary">无规格值</Typography.Text>
          )}
          <Typography.Text>
            {sku.standardSalePrice === null ? '缺价' : `¥${(sku.standardSalePrice / 100).toFixed(2)}`}
          </Typography.Text>
          <Tag color={sku.status === 'ENABLED' ? 'green' : 'default'}>
            {sku.status}
            {sku.isDefault ? ' · 默认' : ''}
          </Tag>
        </Space>
      ))}
    </Space>
  );
}
