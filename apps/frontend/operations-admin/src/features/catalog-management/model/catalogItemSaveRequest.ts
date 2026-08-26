import type {CatalogItemSaveRequest, Uuid} from '../../../app/api/generated/catalog-inventory-edge';
import {wireUuid} from '../../../app/api/wireUuid';
import type {CatalogDetail, CatalogInventoryRuleNode} from './catalogModel';
import {catalogInventoryRuleToDraft, serializeSkuRowsForSave} from './catalogModel';
import {
  serializeCompositeGroups,
  serializeSkuDimensions,
  type CatalogCompositeGroupDraft,
  type CatalogIdentifierDraft,
  type MediaDraft,
  type PreparationProfileDraft,
  type SkuDimensionDraft,
  type SkuRowDraft,
} from './catalogItemEditorDraftAdapters';
import type {CatalogAttributeAssignment, CatalogOrderOptionConfig} from './catalogModel';

type SaveRequestInput = {
  dataNodeRef: Uuid;
  itemCode: string;
  detail: Pick<CatalogDetail, 'item'>;
  visibleTabs: ReadonlySet<string>;
  formValues: {displayName: string; shortName?: string};
  mediaDraft: MediaDraft[];
  skuStagedMedia: MediaDraft[];
  selectedTagRefs: string[];
  selectedProductionTagRef?: string;
  selectedSalesUnitRef?: string;
  selectedBaseMeasureUnitRef?: string;
  categoryRefDraft?: string;
  attributeAssignmentsDraft: CatalogAttributeAssignment[];
  orderOptionConfigsDraft: CatalogOrderOptionConfig[];
  identifierDraft: CatalogIdentifierDraft[];
  standardSalePriceDraft: number | null;
  skuVariantDimensionsDraft: SkuDimensionDraft[];
  skusDraft: SkuRowDraft[];
  compositeGroupsDraft: CatalogCompositeGroupDraft[];
  preparationProfileDraft: PreparationProfileDraft | null;
  inventoryRulesDraft: CatalogInventoryRuleNode[];
};

/**
 * The only editor-side projection from typed draft slices to the whole-save contract.
 * It deliberately never projects a production tag into SKU or option-effect payloads.
 */
export function buildCatalogItemSaveRequest(input: SaveRequestInput) {
  const catalogDraft: CatalogItemSaveRequest['sections']['catalogDraft'] = {
    shortName: input.formValues.shortName?.trim() || null,
    name: input.formValues.displayName,
    shapeKey: input.detail.item.shapeKey,
    images: input.mediaDraft
      .filter(asset => (asset.status === 'READY' || asset.status === 'FAILED') && asset.assetRef)
      .map(asset => wireUuid(asset.assetRef!)),
    tagRefs: input.selectedTagRefs.map(ref => wireUuid(ref)),
    productionTagRef: input.selectedProductionTagRef ? wireUuid(input.selectedProductionTagRef) : null,
    salesUnitRef: input.selectedSalesUnitRef ? wireUuid(input.selectedSalesUnitRef) : null,
    baseMeasureUnitRef: input.selectedBaseMeasureUnitRef ? wireUuid(input.selectedBaseMeasureUnitRef) : null,
    categoryRef: input.categoryRefDraft ? wireUuid(input.categoryRefDraft) : null,
    attributeAssignments: input.attributeAssignmentsDraft.map(assignment => ({
      definitionRef: wireUuid(assignment.definitionRef),
      textValue: assignment.textValue,
      optionRefs: assignment.optionRefs.map(ref => wireUuid(ref)),
    })),
    orderOptionConfigs: input.orderOptionConfigsDraft.map(config => ({
      definitionRef: wireUuid(config.definitionRef),
      displayOrder: config.displayOrder,
      required: config.required,
      minSelectionCount: config.selectionMode === 'MULTIPLE' ? config.minSelectionCount : null,
      maxSelectionCount: config.selectionMode === 'MULTIPLE' ? config.maxSelectionCount : null,
      values: config.values.map(value => ({
        definitionValueRef: wireUuid(value.definitionValueRef),
        defaultValue: value.defaultValue,
        extraPrice: value.extraPrice,
        expectedBomVersion: value.bomVersion ?? 0,
        preparationEffect: value.preparationEffect
          ? {
              instruction: value.preparationEffect.instruction,
              preparationSecondsDelta: value.preparationEffect.preparationSecondsDelta,
            }
          : null,
      })),
    })),
  };
  if (input.visibleTabs.has('identifiers'))
    catalogDraft.identifiers = input.identifierDraft.map(entry => ({
      identifierType: entry.identifierType,
      identifierValue: entry.identifierValue,
    }));
  if (input.visibleTabs.has('basic') && input.detail.item.priceGranularity === 'ITEM')
    catalogDraft.standardSalePrice = input.standardSalePriceDraft;
  if (input.visibleTabs.has('sku-specifications-pricing')) {
    catalogDraft.skuVariantDimensions = serializeSkuDimensions(input.skuVariantDimensionsDraft);
    catalogDraft.skus = serializeSkuRowsForSave(input.skusDraft.map(({editorId: _editorId, ...row}) => row));
  }
  if (input.visibleTabs.has('composite-content'))
    catalogDraft.compositeGroups = serializeCompositeGroups(input.compositeGroupsDraft);
  if (input.visibleTabs.has('production-prompts'))
    catalogDraft.preparationProfile = input.preparationProfileDraft ? {...input.preparationProfileDraft} : null;
  const bindGrants = Object.fromEntries(
    [...input.mediaDraft, ...input.skuStagedMedia]
      .filter((asset): asset is MediaDraft & {assetRef: string; bindGrant: string} =>
        Boolean(asset.assetRef && asset.bindGrant),
      )
      .map(asset => [asset.assetRef, asset.bindGrant]),
  );
  return {
    body: {
      dataNodeRef: input.dataNodeRef,
      itemCode: input.itemCode,
      sections: {
        catalogDraft,
        expectedCatalogVersion: input.detail.item.version,
        inventoryRules: {
          nodes: input.visibleTabs.has('inventory-bom')
            ? input.inventoryRulesDraft.map(catalogInventoryRuleToDraft)
            : [],
        },
      },
    } satisfies CatalogItemSaveRequest,
    bindGrants,
  };
}
