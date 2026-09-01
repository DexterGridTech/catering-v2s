import {useCallback, useMemo, useRef} from 'react';
import {operationsLogger, operationsRtk} from '../../../app/api/OperationsTransport';
import {CATALOG_INVENTORY_OPERATION_IDS} from '../../../app/api/generated/catalog-inventory-edge';
import {catalogInventoryRtkRequest} from '../../../app/api/generated/catalog-inventory-edge.rtk';
import {wireUuid} from '../../../app/api/wireUuid';
import {createContentIdempotencyKey, digestFileContent} from '@catering-v2s/admin-ui-foundation';
import {
  buildCatalogSkuVoidRequest,
  catalogDetailImageRefs,
  decodeCatalogMediaLimits,
  selectCatalogDetailForItem,
  shouldHydrateCatalogItemDraft,
  type CatalogDetail,
} from './catalogModel';
import {
  cloneCompositeGroups,
  clonePreparationProfile,
  cloneSkuDimensions,
  cloneSkuRows,
  emptyCatalogItemDraftSnapshot,
  normalizeSkuDraftRows,
  type CatalogItemDraftSnapshot,
  type MediaDraft,
} from './catalogItemEditorDraftAdapters';
import {buildCatalogItemSaveRequest} from './catalogItemSaveRequest';
import {catalogUiProblemFeedback} from './catalogUiProblemFeedback';
import {catalogEditorTabIsAllowed} from './catalogTabLabels';
import {useCatalogItemDraft} from './useCatalogItemDraft';

type Props = {
  itemCode?: string;
  scopeRef?: string;
  brandRef?: string;
};

/**
 * The single editor-session owner for server reads and the in-memory whole-item draft.
 * It deliberately owns no drawer/section/modal state and renders no JSX.
 */
export function useCatalogItemEditorSession({itemCode, scopeRef, brandRef}: Props) {
  const headers = useMemo(() => (brandRef ? {'X-Workspace-Brand-Ref': brandRef} : undefined), [brandRef]);
  const detailRequest = useMemo(
    () =>
      catalogInventoryRtkRequest.getOperationsCatalogItem(
        {itemCode: itemCode ?? ''},
        {query: {dataNodeRef: wireUuid(scopeRef ?? '')}, headers},
      ),
    [headers, itemCode, scopeRef],
  );
  const detailQuery = operationsRtk.useGetOperationsCatalogItemQuery(detailRequest, {skip: !itemCode || !scopeRef});
  const detail = useMemo(
    () =>
      detailQuery.isError ? undefined : selectCatalogDetailForItem(itemCode, detailQuery.currentData, detailQuery.data),
    [detailQuery.currentData, detailQuery.data, detailQuery.isError, itemCode],
  );
  const manifestRequest = useMemo(
    () =>
      catalogInventoryRtkRequest.getOperationsCatalogShapeManifest(
        {},
        {query: {dataNodeRef: wireUuid(scopeRef ?? '')}, headers},
      ),
    [headers, scopeRef],
  );
  const manifestQuery = operationsRtk.useGetOperationsCatalogShapeManifestQuery(manifestRequest, {
    skip: !itemCode || !scopeRef,
  });
  const manifest = manifestQuery.currentData?.data;
  const mediaLimits = useMemo(() => decodeCatalogMediaLimits(manifest), [manifest]);
  const draft = useCatalogItemDraft<CatalogItemDraftSnapshot>({
    initialPayload: emptyCatalogItemDraftSnapshot(),
  });
  const replaceDraft = draft.replace;
  const initializedDraftItem = useRef<string | undefined>(undefined);
  const hydrateDraftAfterSave = useRef(false);
  const requireScope = useCallback(() => {
    if (!scopeRef) throw new Error('CATALOG_EDITOR_SCOPE_MISSING');
    return scopeRef;
  }, [scopeRef]);
  const markSavedForHydration = useCallback(() => {
    hydrateDraftAfterSave.current = true;
  }, []);
  const resetHydrationForClosedItem = useCallback(() => {
    initializedDraftItem.current = undefined;
    hydrateDraftAfterSave.current = false;
  }, []);
  const hydrateDraftFromDetail = useCallback(
    ({
      activeTab,
      dirty,
      createDraftRowId,
    }: {
      activeTab: string;
      dirty: boolean;
      createDraftRowId: (prefix: string) => string;
    }) => {
      if (!detail) {
        operationsLogger.debug({
          event: 'catalog.item.editor.draft.hydration',
          phase: 'DRAFT_HYDRATION',
          outcome: 'WAITING',
          operationId: 'catalog-item-editor',
          correlationId: itemCode,
        });
        return {kind: 'WAITING' as const};
      }
      if (
        !shouldHydrateCatalogItemDraft({
          initializedItemCode: initializedDraftItem.current,
          detailItemCode: detail.item.code,
          dirty,
          forceHydrate: hydrateDraftAfterSave.current,
        })
      ) {
        operationsLogger.debug({
          event: 'catalog.item.editor.draft.hydration',
          phase: 'DRAFT_HYDRATION',
          outcome: 'SKIPPED',
          operationId: 'catalog-item-editor',
          correlationId: detail.item.code,
        });
        return {kind: 'SKIPPED' as const};
      }
      const editorTabs = detail.tabs.filter(tab => tab.visible && catalogEditorTabIsAllowed(tab.tabKey));
      const firstVisibleTab = editorTabs[0]?.tabKey;
      const nextActiveTab = editorTabs.some(tab => tab.tabKey === activeTab) ? activeTab : (firstVisibleTab ?? 'basic');
      const imageRefs = catalogDetailImageRefs(detail.item);
      replaceDraft({
        mode: 'edit',
        activeTab: nextActiveTab,
        contentScrollTop: 0,
        formValues: {displayName: detail.item.name, shortName: detail.item.shortName ?? ''},
        selectedTagRefs: [...detail.item.tagRefs],
        selectedSalesUnitRef: detail.item.salesUnitRef ?? undefined,
        selectedBaseMeasureUnitRef: detail.item.baseMeasureUnitRef ?? undefined,
        selectedProductionTagRef: detail.item.productionTagRef ?? undefined,
        identifierDraft: detail.item.identifiers.map(entry => ({...entry, editorId: createDraftRowId('identifier')})),
        categoryRefDraft: detail.item.categoryRef ?? undefined,
        attributeAssignmentsDraft: detail.item.attributeAssignments.map(assignment => ({
          ...assignment,
          optionRefs: [...assignment.optionRefs],
        })),
        orderOptionConfigsDraft: detail.item.orderOptionConfigs.map(config => ({
          ...config,
          values: config.values.map(value => ({...value})),
        })),
        standardSalePriceDraft: detail.item.standardSalePrice ?? null,
        preparationProfileDraft: clonePreparationProfile(detail.item.preparationProfile),
        inventoryRulesDraft: detail.inventoryRules.nodes.map(node => ({
          ...node,
          owner: {...node.owner},
          allowedModes: [...node.allowedModes],
          directConfiguration: node.directConfiguration ? {...node.directConfiguration} : null,
          bom: node.bom
            ? {
                version: node.bom.version,
                lines: node.bom.lines.map(line => ({
                  ...line,
                  editorId: line.editorId || createDraftRowId('inventory-bom-line'),
                  consumptionUnitSnapshot: {...line.consumptionUnitSnapshot},
                })),
              }
            : null,
        })),
        compositeGroupsDraft: cloneCompositeGroups(detail.compositeGroups, createDraftRowId),
        skuVariantDimensionsDraft: cloneSkuDimensions(detail.item.skuVariantDimensions, createDraftRowId),
        skusDraft: normalizeSkuDraftRows(cloneSkuRows(detail.item.skus), createDraftRowId),
        mediaDraft: imageRefs.map((assetRef, index) => ({
          id: `existing-${assetRef}`,
          assetRef,
          fileName: index === 0 ? '已保存主图' : `已保存附图 ${index}`,
          mediaType: 'image/*',
          status: 'READY',
          staged: false,
        })),
        skuStagedMedia: [],
      });
      initializedDraftItem.current = detail.item.code;
      hydrateDraftAfterSave.current = false;
      operationsLogger.info({
        event: 'catalog.item.editor.draft.hydration',
        phase: 'DRAFT_HYDRATION',
        outcome: 'SUCCEEDED',
        operationId: 'catalog-item-editor',
        correlationId: detail.item.code,
      });
      return {
        kind: 'HYDRATED' as const,
        activeTab: nextActiveTab,
        formValues: {displayName: detail.item.name, shortName: detail.item.shortName ?? ''},
        productionTags: detail.productionTags,
      };
    },
    [detail, itemCode, replaceDraft],
  );
  const [saveCatalogItem] = operationsRtk.useSaveOperationsCatalogItemMutation();
  const [stageCatalogAsset] = operationsRtk.useStageOperationsCatalogAssetMutation();
  const [releaseCatalogAsset] = operationsRtk.useReleaseOperationsCatalogStagedAssetMutation();
  const stageStagedAsset = useCallback(
    async ({file, correlationId}: {file: File; correlationId?: string}) => {
      const dataNodeRef = wireUuid(requireScope());
      const contentDigest = await digestFileContent(file);
      const mediaType = file.type || 'application/octet-stream';
      const body = {
        dataNodeRef,
        fileName: file.name,
        content: file,
        mediaType,
        contentDigest,
      };
      const idempotencyKey = await createContentIdempotencyKey(
        CATALOG_INVENTORY_OPERATION_IDS.stageOperationsCatalogAsset,
        {dataNodeRef, fileName: file.name, mediaType, contentDigest},
      );
      operationsLogger.info({
        event: 'catalog.item.editor.asset_stage',
        phase: 'COMMAND',
        outcome: 'STARTED',
        operationId: CATALOG_INVENTORY_OPERATION_IDS.stageOperationsCatalogAsset,
        correlationId,
      });
      try {
        const response = await stageCatalogAsset(
          catalogInventoryRtkRequest.stageOperationsCatalogAsset(
            {},
            {headers: {...headers, 'Idempotency-Key': idempotencyKey}, body},
          ),
        ).unwrap();
        const readback = response.result;
        if (!readback?.assetRef || !readback.bindGrant) throw new Error('CATALOG_ASSET_STAGE_READBACK_MISSING');
        operationsLogger.info({
          event: 'catalog.item.editor.asset_stage',
          phase: 'COMMAND',
          outcome: 'SUCCEEDED',
          operationId: CATALOG_INVENTORY_OPERATION_IDS.stageOperationsCatalogAsset,
          correlationId,
        });
        return {
          assetRef: readback.assetRef,
          bindGrant: readback.bindGrant,
          mediaType: readback.mediaType ?? mediaType,
          version: readback.version,
        };
      } catch (error) {
        const feedback = catalogUiProblemFeedback(error, '图片上传未完成。');
        operationsLogger.warn({
          event: 'catalog.item.editor.asset_stage',
          phase: 'COMMAND',
          outcome: feedback.known ? 'KNOWN_FAILURE' : 'UNKNOWN_FAILURE',
          operationId: CATALOG_INVENTORY_OPERATION_IDS.stageOperationsCatalogAsset,
          correlationId,
        });
        throw error;
      }
    },
    [headers, requireScope, stageCatalogAsset],
  );
  const releaseStagedAsset = useCallback(
    async (asset: MediaDraft) => {
      if (!asset.staged || !asset.assetRef || asset.version === undefined) return true;
      const assetRef = wireUuid(asset.assetRef);
      const body = {dataNodeRef: wireUuid(requireScope()), assetRef, expectedVersion: asset.version};
      const idempotencyKey = await createContentIdempotencyKey(
        CATALOG_INVENTORY_OPERATION_IDS.releaseOperationsCatalogStagedAsset,
        body,
      );
      operationsLogger.info({
        event: 'catalog.item.editor.asset_release',
        phase: 'COMMAND',
        outcome: 'STARTED',
        operationId: CATALOG_INVENTORY_OPERATION_IDS.releaseOperationsCatalogStagedAsset,
      });
      try {
        await releaseCatalogAsset(
          catalogInventoryRtkRequest.releaseOperationsCatalogStagedAsset(
            {assetRef},
            {headers: {...headers, 'Idempotency-Key': idempotencyKey}, body},
          ),
        ).unwrap();
        operationsLogger.info({
          event: 'catalog.item.editor.asset_release',
          phase: 'COMMAND',
          outcome: 'SUCCEEDED',
          operationId: CATALOG_INVENTORY_OPERATION_IDS.releaseOperationsCatalogStagedAsset,
        });
        return true;
      } catch (error) {
        const feedback = catalogUiProblemFeedback(error, '图片资产释放未完成。');
        operationsLogger.warn({
          event: 'catalog.item.editor.asset_release',
          phase: 'COMMAND',
          outcome: feedback.known ? 'KNOWN_FAILURE' : 'UNKNOWN_FAILURE',
          operationId: CATALOG_INVENTORY_OPERATION_IDS.releaseOperationsCatalogStagedAsset,
        });
        return false;
      }
    },
    [headers, releaseCatalogAsset, requireScope],
  );
  const releaseStagedMedia = useCallback(
    async (assets: MediaDraft[]) => {
      const staged = assets.filter(asset => asset.staged && asset.assetRef && asset.version !== undefined);
      return Promise.all(staged.map(async asset => ({asset, released: await releaseStagedAsset(asset)})));
    },
    [releaseStagedAsset],
  );
  const saveWholeDraft = useCallback(
    async ({
      itemCode: currentItemCode,
      detail: currentDetail,
      visibleTabs,
      formValues,
    }: {
      itemCode: string;
      detail: NonNullable<CatalogDetail>;
      visibleTabs: Set<string>;
      formValues: {displayName: string; shortName?: string};
    }) => {
      const dataNodeRef = requireScope();
      const {body, bindGrants} = buildCatalogItemSaveRequest({
        dataNodeRef: wireUuid(dataNodeRef),
        itemCode: currentItemCode,
        detail: currentDetail,
        visibleTabs,
        formValues,
        mediaDraft: draft.draft.mediaDraft,
        skuStagedMedia: draft.draft.skuStagedMedia,
        selectedTagRefs: draft.draft.selectedTagRefs,
        selectedProductionTagRef: draft.draft.selectedProductionTagRef,
        selectedSalesUnitRef: draft.draft.selectedSalesUnitRef,
        selectedBaseMeasureUnitRef: draft.draft.selectedBaseMeasureUnitRef,
        categoryRefDraft: draft.draft.categoryRefDraft,
        attributeAssignmentsDraft: draft.draft.attributeAssignmentsDraft,
        orderOptionConfigsDraft: draft.draft.orderOptionConfigsDraft,
        identifierDraft: draft.draft.identifierDraft,
        standardSalePriceDraft: draft.draft.standardSalePriceDraft,
        skuVariantDimensionsDraft: draft.draft.skuVariantDimensionsDraft,
        skusDraft: draft.draft.skusDraft,
        compositeGroupsDraft: draft.draft.compositeGroupsDraft,
        preparationProfileDraft: draft.draft.preparationProfileDraft,
        inventoryRulesDraft: draft.draft.inventoryRulesDraft,
      });
      const idempotencyKey = await createContentIdempotencyKey(
        CATALOG_INVENTORY_OPERATION_IDS.saveOperationsCatalogItem,
        body,
      );
      operationsLogger.info({
        event: 'catalog.item.editor.save',
        phase: 'COMMAND',
        outcome: 'STARTED',
        operationId: CATALOG_INVENTORY_OPERATION_IDS.saveOperationsCatalogItem,
        correlationId: currentItemCode,
      });
      try {
        const result = await saveCatalogItem(
          catalogInventoryRtkRequest.saveOperationsCatalogItem(
            {itemCode: currentItemCode},
            {
              headers: {
                ...headers,
                'Idempotency-Key': idempotencyKey,
                ...(Object.keys(bindGrants).length ? {'X-Catalog-Asset-Bind-Grants': JSON.stringify(bindGrants)} : {}),
              },
              body,
            },
          ),
        ).unwrap();
        operationsLogger.info({
          event: 'catalog.item.editor.save',
          phase: 'COMMAND',
          outcome: 'SUCCEEDED',
          operationId: CATALOG_INVENTORY_OPERATION_IDS.saveOperationsCatalogItem,
          correlationId: currentItemCode,
        });
        return result;
      } catch (error) {
        const feedback = catalogUiProblemFeedback(error, '商品暂时无法保存。');
        operationsLogger.warn({
          event: 'catalog.item.editor.save',
          phase: 'COMMAND',
          outcome: feedback.known ? 'KNOWN_FAILURE' : 'UNKNOWN_FAILURE',
          operationId: CATALOG_INVENTORY_OPERATION_IDS.saveOperationsCatalogItem,
          correlationId: currentItemCode,
        });
        throw error;
      }
    },
    [draft.draft, headers, requireScope, saveCatalogItem],
  );
  const saveSkuVoid = useCallback(
    async ({
      itemCode: currentItemCode,
      body,
    }: {
      itemCode: string;
      body: ReturnType<typeof buildCatalogSkuVoidRequest>;
    }) => {
      const idempotencyKey = await createContentIdempotencyKey(
        CATALOG_INVENTORY_OPERATION_IDS.saveOperationsCatalogItem,
        body,
      );
      operationsLogger.info({
        event: 'catalog.item.editor.sku_void',
        phase: 'COMMAND',
        outcome: 'STARTED',
        operationId: CATALOG_INVENTORY_OPERATION_IDS.saveOperationsCatalogItem,
        correlationId: currentItemCode,
      });
      try {
        const result = await saveCatalogItem(
          catalogInventoryRtkRequest.saveOperationsCatalogItem(
            {itemCode: currentItemCode},
            {headers: {...headers, 'Idempotency-Key': idempotencyKey}, body},
          ),
        ).unwrap();
        operationsLogger.info({
          event: 'catalog.item.editor.sku_void',
          phase: 'COMMAND',
          outcome: 'SUCCEEDED',
          operationId: CATALOG_INVENTORY_OPERATION_IDS.saveOperationsCatalogItem,
          correlationId: currentItemCode,
        });
        return result;
      } catch (error) {
        const feedback = catalogUiProblemFeedback(error, '规格暂时无法作废。');
        operationsLogger.warn({
          event: 'catalog.item.editor.sku_void',
          phase: 'COMMAND',
          outcome: feedback.known ? 'KNOWN_FAILURE' : 'UNKNOWN_FAILURE',
          operationId: CATALOG_INVENTORY_OPERATION_IDS.saveOperationsCatalogItem,
          correlationId: currentItemCode,
        });
        throw error;
      }
    },
    [headers, saveCatalogItem],
  );
  return {
    headers,
    detailQuery,
    detail,
    manifestQuery,
    manifest,
    mediaLimits,
    draft,
    requireScope,
    hydrateDraftFromDetail,
    markSavedForHydration,
    resetHydrationForClosedItem,
    saveWholeDraft,
    saveSkuVoid,
    stageStagedAsset,
    releaseStagedAsset,
    releaseStagedMedia,
  };
}
