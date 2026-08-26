import {
  NameCodeText,
  useAsyncGenerationGuard,
  useCursorCandidates,
  useCursorStack,
  useRefreshVersion,
} from '@catering-v2s/admin-ui-foundation';
import {useCallback, useEffect, useMemo, useRef, useState, type Key} from 'react';
import {operationsContentTabRefreshSignal, operationsRtk} from '../../../../app/api/OperationsTransport';
import type {HeadCompany} from '../../../../app/api/generated/operations-edge';
import {operationsAdminRtkRequest} from '../../../../app/api/generated/operations-edge.rtk';
import {catalogInventoryRtkRequest} from '../../../../app/api/generated/catalog-inventory-edge.rtk';
import {wireUuid} from '../../../../app/api/wireUuid';
import type {OperationsPageProps} from '../../../../app/routing/model';
import {
  buildCatalogItemsQuery,
  decodeCatalogDictionaryLabels,
  decodeItems,
  decodeNavigation,
  decodeWorkbenchContext,
  isCatalogBatchRowSelectable,
} from '../../model/catalogModel';
import type {CatalogItemSummary} from '../../model/catalogModel';
import type {CatalogTreeSelection} from '../catalogWorkbenchPresentation';
import {useCatalogCategoryCandidates} from '../useCatalogCategoryCandidates';
import {defaultCatalogTreeExpandedKeys} from '../CatalogWorkbenchNavigationTree';
import {useCatalogSkuRows} from './useCatalogSkuRows';

type CatalogFilters = {keyword?: string; status?: string; source?: string};
type TagDictionaryEntry = ReturnType<typeof decodeCatalogDictionaryLabels>[number];

function queryRefetchFailed(value: unknown): boolean {
  return Boolean(value && typeof value === 'object' && 'error' in value && (value as {error?: unknown}).error);
}

/**
 * Owns the workbench's server-derived read model and list-local state.
 * It is the only home for query identity, filter/cursor state, and SKU-page cache.
 * Task surfaces, drafts and category/batch commands deliberately stay outside.
 */
export function useCatalogWorkbenchReadModel({
  queryContext,
  surface,
}: Pick<OperationsPageProps, 'queryContext'> & {surface: 'store' | 'brand'}) {
  const [view, setView] = useState<'TREE_TABLE' | 'TABLE_ONLY'>('TREE_TABLE');
  const [brandRef, setBrandRef] = useState<string>();
  const [treeSelection, setTreeSelection] = useState<CatalogTreeSelection>({
    kind: 'SMART',
    ref: 'ALL',
    label: '全部商品',
  });
  const [treeSearch, setTreeSearch] = useState('');
  const [keywordDraft, setKeywordDraft] = useState('');
  const [filters, setFilters] = useState<CatalogFilters>({});
  const {
    page: cursorPage,
    cursor,
    canPrevious,
    goToPage,
    reset: resetCursor,
  } = useCursorStack({
    resetKey: `${surface}:${queryContext.scopeRef ?? ''}`,
  });
  const pageSize = 20;
  const [selectedRows, setSelectedRows] = useState<Key[]>([]);
  const [treeExpandedKeys, setTreeExpandedKeys] = useState<Key[]>(defaultCatalogTreeExpandedKeys);
  const generation = useAsyncGenerationGuard();
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
      (headCompanyQuery.currentData as HeadCompany | undefined)?.authorizedBrands.filter(
        brand => brand.status === 'ENABLED',
      ) ?? [],
    [headCompanyQuery.currentData],
  );
  useEffect(() => {
    if (surface !== 'brand') return;
    setBrandRef(current => (brands.some(brand => brand.id === current) ? current : brands[0]?.id));
  }, [brands, surface]);
  const headers = useMemo(() => (brandRef ? {'X-Workspace-Brand-Ref': brandRef} : undefined), [brandRef]);
  const scopeReady = Boolean(queryContext.scopeRef) && (surface === 'store' || Boolean(brandRef));
  const tagDictionaryState = useCursorCandidates<TagDictionaryEntry>({
    resetKey: `${queryContext.scopeRef ?? ''}:${brandRef ?? ''}`,
    pageSize: 50,
    keyOf: entry => entry.entryRef,
  });
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
        {
          query: {
            dataNodeRef: wireUuid(queryContext.scopeRef ?? ''),
            ...(tagDictionaryState.cursor ? {cursor: tagDictionaryState.cursor} : {}),
            pageSize: tagDictionaryState.pageSize,
          },
          headers,
        },
      ),
    [headers, queryContext.scopeRef, tagDictionaryState.cursor, tagDictionaryState.pageSize],
  );
  const listQuery = useMemo(
    () =>
      buildCatalogItemsQuery({
        dataNodeRef: wireUuid(queryContext.scopeRef ?? ''),
        keyword: filters.keyword,
        smartViewKey: treeSelection.kind === 'SMART' ? treeSelection.ref : undefined,
        shapeKey: treeSelection.kind === 'SHAPE' ? treeSelection.ref : undefined,
        categoryRef: treeSelection.kind === 'CATEGORY' ? wireUuid(treeSelection.ref) : undefined,
        tagRef: treeSelection.kind === 'TAG' ? wireUuid(treeSelection.ref) : undefined,
        productionTagRef: treeSelection.kind === 'PRODUCTION_TAG' ? wireUuid(treeSelection.ref) : undefined,
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
  const categoryCandidates = useCatalogCategoryCandidates({
    open: scopeReady,
    scopeRef: queryContext.scopeRef,
    brandRef,
    usage: 'ITEM_ASSIGNMENT',
  });
  const context = decodeWorkbenchContext(contextQuery.currentData);
  const navigation = decodeNavigation(navigationQuery.currentData);
  const manifest = manifestQuery.currentData?.data;
  const tagDictionaryPage = tagDictionaryQuery.currentData?.data;
  const acceptTagDictionaryPage = tagDictionaryState.acceptPage;
  const tagDictionaryPageSize = tagDictionaryState.pageSize;
  useEffect(() => {
    if (!tagDictionaryPage || !tagDictionaryQuery.currentData) return;
    acceptTagDictionaryPage(decodeCatalogDictionaryLabels(tagDictionaryQuery.currentData), {
      pageSize: tagDictionaryPageSize,
      total: tagDictionaryPage.total,
      nextCursor: tagDictionaryPage.cursor,
    });
  }, [acceptTagDictionaryPage, tagDictionaryPage, tagDictionaryPageSize, tagDictionaryQuery.currentData]);
  const page = decodeItems(itemsQuery.currentData) ?? {
    items: [],
    total: 0,
    cursor: '',
    generation: 0,
    queryGeneration: '',
  };
  const skuController = useCatalogSkuRows({
    queryContext,
    headers,
    brandRef,
    queryGeneration,
    listGeneration: page.generation,
    pageSize,
  });
  const {clear: clearSkuRows, collapseAll: collapseSkuRows} = skuController;
  const clearSelectedRows = useCallback(() => setSelectedRows([]), []);
  const selectedItemRows = useMemo(
    () => page.items.filter(row => selectedRows.includes(row.code) && isCatalogBatchRowSelectable(row)),
    [page.items, selectedRows],
  );
  const tagOptions = useMemo(
    () => tagDictionaryState.items.map(entry => ({value: entry.entryRef, label: <NameCodeText name={entry.name} />})),
    [tagDictionaryState.items],
  );
  const resetListPresentation = useCallback(() => {
    resetCursor();
    clearSelectedRows();
    collapseSkuRows();
    clearSkuRows();
  }, [clearSelectedRows, clearSkuRows, collapseSkuRows, resetCursor]);
  const changeBrand = useCallback(
    (nextBrand: string) => {
      generation.begin();
      setBrandRef(nextBrand);
      setTreeSelection({kind: 'SMART', ref: 'ALL', label: '全部商品'});
      setKeywordDraft('');
      setFilters({});
      resetListPresentation();
      setTreeExpandedKeys(defaultCatalogTreeExpandedKeys);
    },
    [generation, resetListPresentation],
  );
  const selectTree = useCallback(
    (next: CatalogTreeSelection) => {
      generation.begin();
      setTreeSelection(next);
      resetListPresentation();
      if (next.kind === 'SMART' && next.ref !== 'ALL') setFilters(current => ({keyword: current.keyword}));
    },
    [generation, resetListPresentation],
  );
  const goToCatalogPage = useCallback(
    (pageNumber: number, nextCursor?: string) => {
      clearSkuRows();
      collapseSkuRows();
      clearSelectedRows();
      goToPage(pageNumber, nextCursor);
    },
    [clearSelectedRows, clearSkuRows, collapseSkuRows, goToPage],
  );
  const refresh = useCallback(() => {
    if (!scopeReady) return;
    if (surface === 'brand') void headCompanyQuery.refetch();
    void contextQuery.refetch();
    void navigationQuery.refetch();
    void manifestQuery.refetch();
    void tagDictionaryQuery.refetch();
    void itemsQuery.refetch();
  }, [
    contextQuery,
    headCompanyQuery,
    itemsQuery,
    manifestQuery,
    navigationQuery,
    scopeReady,
    surface,
    tagDictionaryQuery,
  ]);
  const refreshAfterBatch = useCallback(async () => {
    if (!scopeReady) return;
    const results = await Promise.all([itemsQuery.refetch(), navigationQuery.refetch()]);
    if (results.some(queryRefetchFailed)) throw new Error('CATALOG_BATCH_REFRESH_FAILED');
  }, [itemsQuery, navigationQuery, scopeReady]);
  const contentTabRefreshVersion = useRefreshVersion(operationsContentTabRefreshSignal);
  const lastContentTabRefreshVersion = useRef(contentTabRefreshVersion);
  useEffect(() => {
    if (contentTabRefreshVersion === lastContentTabRefreshVersion.current) return;
    lastContentTabRefreshVersion.current = contentTabRefreshVersion;
    refresh();
  }, [contentTabRefreshVersion, refresh]);
  const failed = Boolean(
    contextQuery.error || navigationQuery.error || manifestQuery.error || itemsQuery.error || headCompanyQuery.error,
  );
  return {
    view,
    setView,
    brandRef,
    brands,
    brandsLoading: headCompanyQuery.isLoading,
    headers,
    scopeReady,
    treeSelection,
    treeSearch,
    treeExpandedKeys,
    keywordDraft,
    filters,
    page,
    cursorPage,
    canPrevious,
    selectedRows,
    selectedItemRows,
    navigation,
    manifest,
    context,
    tagOptions,
    tagDictionaryState,
    tagDictionaryQuery,
    categoryCandidates,
    skuController,
    failed,
    headCompanyQuery,
    contextQuery,
    navigationQuery,
    manifestQuery,
    itemsQuery,
    setTreeSearch,
    setTreeExpandedKeys,
    setKeywordDraft,
    setFilters,
    setSelectedRows,
    changeBrand,
    selectTree,
    resetListPresentation,
    goToCatalogPage,
    clearSelectedRows,
    beginQueryGeneration: generation.begin,
    refresh,
    refreshAfterBatch,
  };
}
