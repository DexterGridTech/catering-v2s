import {useOverlayLock} from '@catering-v2s/admin-ui-foundation';
import {useMemo} from 'react';
import {operationsProblemOf} from '../../../../app/api/OperationsTransport';
import {ACTION_CAPABILITIES} from '../../../../app/catalog/generatedAdminCatalog';
import type {OperationsPageProps} from '../../../../app/routing/model';
import {catalogFilterConflictReason} from '../../model/catalogModel';
import {catalogEnumLabel, catalogEnumOptions} from '../../model/catalogManifestLabels';
import {catalogTestIds} from '../../catalogTestIds';
import {CatalogWorkbenchContent} from '../CatalogWorkbenchContent';
import {CatalogWorkbenchTaskSurfaces} from '../CatalogWorkbenchTaskSurfaces';
import {useCatalogWorkbenchTaskCoordinator} from './useCatalogWorkbenchTaskCoordinator';
import {useCatalogWorkbenchReadModel} from './useCatalogWorkbenchReadModel';

export type CatalogSurface = 'store' | 'brand';

/** Composes independent read-model, command and task-surface responsibilities. */
export function CatalogWorkbenchController({
  queryContext,
  actionCapabilityKeys,
  surface,
}: OperationsPageProps & {surface: CatalogSurface}) {
  const model = useCatalogWorkbenchReadModel({queryContext, surface});
  const {
    view,
    setView,
    brandRef,
    brands,
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
    beginQueryGeneration,
    refresh,
    refreshAfterBatch,
  } = model;
  const tasks = useCatalogWorkbenchTaskCoordinator({
    queryContext,
    surface,
    brandRef,
    headers,
    scopeReady,
    navigation,
    selectedItemRows,
    refreshAfterBatch,
    clearSelectedRows,
  });
  const {
    workspaceTask,
    detailTarget,
    categoryController,
    batchController,
    openDetail,
    openDetailEdit,
    openLocalCopy,
    closeDetail,
    openCategory,
    openConfig,
    openBrandCopy,
    openCreate,
    onDetailSaved,
    onCreateClose,
    onCreated,
    onConfigClose,
    onCopyClose,
  } = tasks;
  useOverlayLock(workspaceTask.kind !== 'NONE');
  const editCatalogCapability =
    surface === 'brand' ? ACTION_CAPABILITIES.EDIT_HEAD_COMPANY_CATALOG : ACTION_CAPABILITIES.EDIT_STORE_CATALOG;
  const canWriteCatalog = (actionCapabilityKeys as readonly string[]).includes(editCatalogCapability);
  const statusFilterConflict = catalogFilterConflictReason(treeSelection, 'status');
  const sourceFilterConflict = catalogFilterConflictReason(treeSelection, 'source');
  const statusOptions = useMemo(
    () =>
      catalogEnumOptions(manifest, 'catalogItemStatus').filter(({value}) => ['ENABLED', 'DISABLED'].includes(value)),
    [manifest],
  );
  const sourceOptions = useMemo(() => catalogEnumOptions(manifest, 'catalogSource'), [manifest]);
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
    Boolean(headCompanyQuery.currentData) &&
    brands.length === 0;
  const noSelectedScope =
    !queryContext.scopeRef || (surface === 'brand' && !brandRef && !headCompanyQuery.isLoading && !noAuthorizedBrand);
  const canCreateCatalog = Boolean(context?.actionAvailability.canCreate);
  const createUnavailableReason = context?.actionAvailability.reasons?.filter(Boolean).join('；');
  const smartViewExplanation =
    treeSelection.kind === 'SMART' && treeSelection.ref !== 'ALL'
      ? `智能视图“${treeSelection.label}”已限定结果域；与该结果域冲突的筛选项已禁用。`
      : undefined;
  const rootTestId =
    surface === 'store' ? catalogTestIds.surface.storeWorkbench : catalogTestIds.surface.brandWorkbench;
  return (
    <>
      <CatalogWorkbenchContent
        surface={surface}
        rootTestId={rootTestId}
        scopeForbidden={scopeForbidden}
        failed={failed}
        noAuthorizedBrand={noAuthorizedBrand}
        noSelectedScope={noSelectedScope}
        treeVisible={view === 'TREE_TABLE'}
        toolbarProps={{
          surface,
          view,
          onViewChange: setView,
          brands,
          brandRef,
          brandsLoading: headCompanyQuery.isLoading,
          onBrandChange: changeBrand,
          canWrite: canWriteCatalog,
          canCreate: canCreateCatalog,
          createUnavailableReason,
          canBrandCopy: Boolean(
            context?.headCompanyRef &&
            context.brandRef &&
            context.copySourceAvailable &&
            context.actionAvailability.canCopy,
          ),
          onOpenConfig: openConfig,
          onOpenBrandCopy: openBrandCopy,
          onOpenCreate: openCreate,
        }}
        navigationProps={{
          navigation,
          selection: treeSelection,
          search: treeSearch,
          expandedKeys: treeExpandedKeys,
          canWriteCatalog,
          smartViewLabel: viewKey => catalogEnumLabel(manifest, 'smartViewKey', viewKey),
          shapeLabel: shapeKey => catalogEnumLabel(manifest, 'shapeKey', shapeKey),
          onSearchChange: setTreeSearch,
          onExpandedKeysChange: setTreeExpandedKeys,
          onSelection: selectTree,
          onOpenCategory: openCategory,
          onRememberCategoryTrigger: categoryController.rememberTrigger,
        }}
        itemListProps={{
          resultLabel: treeSelection.label,
          smartViewExplanation,
          keyword: keywordDraft,
          status: filters.status,
          source: filters.source,
          statusOptions,
          sourceOptions,
          statusConflict: statusFilterConflict,
          sourceConflict: sourceFilterConflict,
          onKeywordChange: setKeywordDraft,
          onKeywordSearch: () => {
            setFilters(current => ({...current, keyword: keywordDraft.trim() || undefined}));
            resetListPresentation();
          },
          onStatusChange: status => {
            setFilters(current => ({...current, status}));
            resetListPresentation();
          },
          onSourceChange: source => {
            setFilters(current => ({...current, source}));
            resetListPresentation();
          },
          onReset: () => {
            beginQueryGeneration();
            setKeywordDraft('');
            setFilters({});
            resetListPresentation();
          },
          onRefresh: refresh,
          selectedRows,
          canWrite: canWriteCatalog,
          onBatchAction: batchController.open,
          onClearSelection: clearSelectedRows,
          page,
          cursorState: {page: cursorPage, canPrevious, goToPage: goToCatalogPage},
          manifest,
          skuChildrenByItem: skuController.childrenByItem,
          skuCacheIdentity: skuController.cacheIdentity,
          expandedRows: skuController.expandedRows,
          failed,
          scopeReady,
          noAuthorizedBrand,
          loading: itemsQuery.isFetching && scopeReady,
          onSelectedRowsChange: setSelectedRows,
          onTableExpand: skuController.onExpand,
          onOpenDetail: openDetail,
          loadSkuPage: skuController.loadPage,
        }}
        onRefresh={refresh}
      />
      <CatalogWorkbenchTaskSurfaces
        workspaceTask={workspaceTask}
        surface={surface}
        queryContext={queryContext}
        brandRef={context?.brandRef ?? brandRef}
        canWriteCatalog={canWriteCatalog}
        detailTarget={detailTarget}
        batchProps={{
          action: batchController.action,
          results: batchController.results,
          selectedItemCount: selectedItemRows.length,
          submitting: batchController.submitting,
          problem: batchController.problem,
          refreshProblem: batchController.refreshProblem,
          categoryCandidates,
          categoryRef: batchController.categoryRef,
          tagRefs: batchController.tagRefs,
          tagOptions,
          tagLoading: tagDictionaryQuery.isLoading || tagDictionaryQuery.isFetching,
          status: batchController.status,
          onCategoryChange: batchController.setCategoryRef,
          onTagsChange: batchController.setTagRefs,
          onTagPopupScroll: event => tagDictionaryState.onPopupScroll(event, tagDictionaryQuery.isFetching),
          onStatusChange: batchController.setStatus,
          onClose: batchController.close,
          onExecute: () => void batchController.execute(),
        }}
        categoryProps={{
          action: categoryController.action,
          form: categoryController.form,
          problem: categoryController.problem,
          createCandidates: categoryController.createCandidates,
          reparentCandidates: categoryController.reparentCandidates,
          submitting: categoryController.submitting,
          onClose: categoryController.close,
          onSubmit: () => void categoryController.submit(),
        }}
        onDetailEdit={openDetailEdit}
        onLocalCopy={openLocalCopy}
        onDetailSaved={onDetailSaved}
        onDetailClose={closeDetail}
        onCreateClose={onCreateClose}
        onCreated={onCreated}
        onConfigClose={onConfigClose}
        onCopyClose={onCopyClose}
      />{' '}
    </>
  );
}
