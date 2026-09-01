import {useMemo} from 'react';
import {operationsRtk} from '../../../app/api/OperationsTransport';
import {catalogInventoryRtkRequest} from '../../../app/api/generated/catalog-inventory-edge.rtk';
import {wireUuid} from '../../../app/api/wireUuid';
import {decodeCatalogMediaLimits} from '../model/catalogModel';
import type {CatalogFieldRuntimeContext} from '../model/catalogFieldRuntime';
import {catalogTestIds} from '../catalogTestIds';
import {CatalogItemBasicEditor} from './CatalogItemBasicEditor';
import {CatalogItemIdentifiersEditor, manifestIdentifierTypes} from './CatalogItemIdentifiersEditor';
import {CatalogItemSkuSpecificationsEditor} from './CatalogItemSkuSpecificationsEditor';
import {CatalogItemAttributesEditor} from './CatalogItemAttributesEditor';
import {CatalogItemOrderOptionsEditor} from './CatalogItemOrderOptionsEditor';
import {CatalogItemProductionEditor} from './CatalogItemProductionEditor';
import {CatalogItemInventoryBomEditor} from './CatalogItemInventoryBomEditor';
import {CatalogItemCompositeEditor} from './CatalogItemCompositeEditor';
import {EmptySection} from './CatalogItemReadOnlyPresenters';
import type {CatalogItemEditorSectionProps} from './CatalogItemEditorSectionProps';
import {catalogCategorySummary, useCatalogItemEditorFieldPresentation} from './CatalogItemEditorFieldPresentation';

export function CatalogItemEditorSectionAssembler({
  tabKey,
  detail,
  manifest,
  canWriteCatalog,
  form,
  mediaDraft,
  onStageMedia,
  onRemoveMedia,
  onMoveMedia,
  onSetPrimaryMedia,
  skuStagedMedia,
  onStageSkuMedia,
  onRemoveSkuMedia,
  onRemoveSkuStagedMedia,
  onOpenConfig,
  basicDraft,
  productionDraft,
  attributeAssignmentsDraft,
  onAttributeAssignmentsChange,
  orderOptionConfigsDraft,
  onOrderOptionConfigsChange,
  identifierDraft,
  createDraftRowId,
  inventoryRulesDraft,
  compositeGroupsDraft,
  skuVariantDimensionsDraft,
  skusDraft,
  queryContext,
  brandRef,
  currentItemCode,
  onIdentifiersChange,
  onInventoryRulesChange,
  onCompositeGroupsChange,
  onSkuVariantDimensionsChange,
  onSkusChange,
  onDirty,
  onVoidSku,
  voidingSkuRef,
  onNavigateTab,
}: CatalogItemEditorSectionProps) {
  const {denied, fieldLabel, locked, lockedFact} = useCatalogItemEditorFieldPresentation(detail, manifest);
  const categorySummary = catalogCategorySummary(
    basicDraft.values.categoryRefDraft,
    detail.item.categoryPath.map(node => node.name),
  );
  const unitRequest = useMemo(
    () =>
      catalogInventoryRtkRequest.listOperationsCatalogUnits(
        {},
        {
          query: {dataNodeRef: wireUuid(queryContext.scopeRef ?? ''), includeInactive: false},
          headers: brandRef ? {'X-Workspace-Brand-Ref': brandRef} : undefined,
        },
      ),
    [brandRef, queryContext.scopeRef],
  );
  const unitQuery = operationsRtk.useListOperationsCatalogUnitsQuery(unitRequest, {
    skip: !queryContext.scopeRef,
  });
  const unitOptions = unitQuery.currentData?.data.units ?? [];
  const referencePickerContexts = useMemo(
    () =>
      ({
        TAG: {
          scope: {dataNodeRef: wireUuid(queryContext.scopeRef ?? ''), brandRef},
          readField: () => undefined,
          readSection: () => [],
          sectionRevision: () => detail.item.version,
        },
      }) satisfies Record<'TAG', CatalogFieldRuntimeContext>,
    [brandRef, detail.item.version, queryContext.scopeRef],
  );
  if (tabKey === 'basic')
    return (
      <CatalogItemBasicEditor
        detail={detail}
        manifest={manifest}
        form={form}
        mediaDraft={mediaDraft}
        mediaLimits={decodeCatalogMediaLimits(manifest)}
        unitOptions={unitOptions}
        unitsLoading={unitQuery.isLoading || unitQuery.isFetching}
        scopeRef={queryContext.scopeRef}
        brandRef={brandRef}
        basicDraft={basicDraft}
        denied={denied}
        fieldLabel={fieldLabel}
        lockedFact={lockedFact}
        locked={locked}
        referencePickerContexts={referencePickerContexts}
        categorySummary={categorySummary}
        onOpenTagDictionary={() => onOpenConfig('TAG', catalogTestIds.static.itemTagManage)}
        onDirty={onDirty}
        onStageMedia={onStageMedia}
        onRemoveMedia={onRemoveMedia}
        onMoveMedia={onMoveMedia}
        onSetPrimaryMedia={onSetPrimaryMedia}
      />
    );
  if (tabKey === 'identifiers')
    return (
      <CatalogItemIdentifiersEditor
        locked={denied('identifiers')}
        values={identifierDraft}
        allowedTypes={manifestIdentifierTypes(manifest, detail.item.shapeKey, 'CATALOG_ITEM')}
        createDraftRowId={createDraftRowId}
        onChange={onIdentifiersChange}
        onDirty={onDirty}
      />
    );
  if (tabKey === 'sku-specifications-pricing')
    return (
      <CatalogItemSkuSpecificationsEditor
        mode={denied('skus') || denied('skuVariantDimensions') ? 'view' : 'edit'}
        manifest={manifest}
        dimensions={skuVariantDimensionsDraft}
        skus={skusDraft}
        readOnlyDimensions={detail.item.skuVariantDimensions}
        readOnlySkus={detail.item.skus}
        readOnlySummary={detail.item.skuSummary}
        priceGranularity={detail.item.priceGranularity}
        standardSalePrice={detail.item.standardSalePrice}
        itemLifecycleStatus={detail.item.lifecycle.status}
        allowedIdentifierTypes={manifestIdentifierTypes(manifest, detail.item.shapeKey, 'SKU')}
        itemDefaultPreparation={productionDraft.values.preparationProfileDraft}
        skuStagedMedia={skuStagedMedia}
        scopeRef={queryContext.scopeRef}
        brandRef={brandRef}
        version={detail.item.version}
        createDraftRowId={createDraftRowId}
        onOpenDictionary={(kind, triggerTestId) => onOpenConfig(kind, triggerTestId)}
        unitOptions={unitOptions}
        onDimensionsChange={onSkuVariantDimensionsChange}
        onSkusChange={onSkusChange}
        onStageSkuMedia={onStageSkuMedia}
        onRemoveSkuMedia={onRemoveSkuMedia}
        onRemoveSkuStagedMedia={onRemoveSkuStagedMedia}
        canWriteCatalog={canWriteCatalog}
        lockNotices={
          <>
            {denied('skuVariantDimensions') && locked('skuVariantDimensions')}
            {denied('skus') && locked('skus')}
          </>
        }
        onVoidSku={onVoidSku}
        voidingSkuRef={voidingSkuRef}
        onDirty={onDirty}
      />
    );
  if (tabKey === 'attributes')
    return (
      <CatalogItemAttributesEditor
        locked={denied('attributeAssignments')}
        values={attributeAssignmentsDraft}
        readOnlyValues={detail.item.attributeAssignments}
        scopeRef={queryContext.scopeRef}
        brandRef={brandRef}
        onChange={onAttributeAssignmentsChange}
        onDirty={onDirty}
        onOpenAttributeLibrary={() => onOpenConfig('ATTRIBUTES', catalogTestIds.static.itemAttributeLibraryManage)}
        lockedNotice={locked('attributeAssignments')}
      />
    );
  if (tabKey === 'order-options')
    return (
      <CatalogItemOrderOptionsEditor
        locked={denied('orderOptionConfigs')}
        values={orderOptionConfigsDraft}
        readOnlyValues={detail.item.orderOptionConfigs}
        scopeRef={queryContext.scopeRef}
        brandRef={brandRef}
        onChange={onOrderOptionConfigsChange}
        onDirty={onDirty}
        onOpenOrderOptionLibrary={() =>
          onOpenConfig('ORDER_OPTIONS', catalogTestIds.static.itemOrderOptionLibraryManage)
        }
        lockedNotice={locked('orderOptionConfigs')}
      />
    );
  if (tabKey === 'production-prompts') {
    return (
      <CatalogItemProductionEditor
        canEdit={canWriteCatalog && !denied('preparationProfile')}
        productionDraft={productionDraft}
        knownTags={detail.productionTags}
        scopeRef={queryContext.scopeRef}
        brandRef={brandRef}
        onOpenProductionTags={() => onOpenConfig('PRODUCTION_TAG', catalogTestIds.static.itemProductionTagManage)}
        onDirty={onDirty}
        readOnlyProfile={detail.item.preparationProfile}
        skus={skusDraft}
        orderOptions={orderOptionConfigsDraft}
        shapeKey={detail.item.shapeKey}
        onNavigateToOptions={() => onNavigateTab('order-options')}
      />
    );
  }
  if (tabKey === 'inventory-bom') {
    const inventoryRulesDenied = denied('inventoryRules');
    return (
      <CatalogItemInventoryBomEditor
        shapeKey={detail.item.shapeKey}
        locked={inventoryRulesDenied}
        detail={detail}
        nodes={inventoryRulesDenied ? detail.inventoryRules.nodes : inventoryRulesDraft}
        scopeRef={queryContext.scopeRef}
        brandRef={brandRef}
        unitOptions={unitOptions}
        createDraftRowId={createDraftRowId}
        onChange={onInventoryRulesChange}
        onDirty={onDirty}
      />
    );
  }
  if (tabKey === 'composite-content')
    return (
      <CatalogItemCompositeEditor
        mode={denied('compositeGroups') ? 'view' : 'edit'}
        manifest={manifest}
        shapeKey={detail.item.shapeKey}
        values={compositeGroupsDraft}
        readOnlyValues={detail.compositeGroups}
        lockNotice={locked('compositeGroups')}
        onChange={onCompositeGroupsChange}
        onDirty={onDirty}
        queryContext={queryContext}
        brandRef={brandRef}
        currentItemCode={currentItemCode}
        version={detail.item.version}
        createDraftRowId={createDraftRowId}
      />
    );
  return <EmptySection text="当前页暂不支持编辑。" />;
}
