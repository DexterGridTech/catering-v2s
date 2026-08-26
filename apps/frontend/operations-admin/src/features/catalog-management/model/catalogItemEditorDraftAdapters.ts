import {wireUuid} from '../../../app/api/wireUuid';
import type {CatalogItemSaveRequest} from '../../../app/api/generated/catalog-inventory-edge';
import type {
  CatalogAttributeAssignment,
  CatalogCompositeComponent,
  CatalogCompositeGroup,
  CatalogIdentifier,
  CatalogInventoryRuleNode,
  CatalogOrderOptionConfig,
  CatalogPreparationEffect,
  CatalogPreparationProfile,
  CatalogSkuRow,
  CatalogSkuVariantDimension,
} from './catalogModel';
import {CATALOG_ITEM_DRAFT_SECTIONS, type CatalogItemDraftSection} from './useCatalogItemDraft';

/**
 * The editor draft is deliberately separate from the read model.  These
 * adapters add stable local keys and remove them again at the save boundary;
 * no local-only key is allowed to leak into the generated wire request.
 */
export type MediaDraft = {
  id: string;
  assetRef?: string;
  bindGrant?: string;
  fileName: string;
  mediaType: string;
  status: 'READY' | 'UPLOADING' | 'FAILED';
  file?: File;
  error?: string;
  version?: number;
  staged: boolean;
  skuEditorId?: string;
  previous?: {assetRef?: string; version?: number; staged: boolean};
};

export type SkuDimensionValueDraft = CatalogSkuVariantDimension['values'][number] & {editorId: string};
export type SkuDimensionDraft = Omit<CatalogSkuVariantDimension, 'values'> & {
  editorId: string;
  values: SkuDimensionValueDraft[];
};
export type CatalogIdentifierDraft = CatalogIdentifier & {editorId: string};
export type PreparationProfileDraft = CatalogPreparationProfile;
export type SkuRowDraft = CatalogSkuRow & {editorId: string};
export type CatalogCompositeComponentDraft = CatalogCompositeComponent & {editorId: string};
export type CatalogCompositeGroupDraft = Omit<CatalogCompositeGroup, 'components'> & {
  editorId: string;
  components: CatalogCompositeComponentDraft[];
};

export type CatalogItemDraftSnapshot = {
  mode: 'view' | 'edit';
  activeTab: string;
  /** Scroll position of the single editor content region; never sent to the owner. */
  contentScrollTop: number;
  formValues: {displayName?: string; shortName?: string};
  selectedTagRefs: string[];
  selectedSalesUnitRef?: string;
  selectedBaseMeasureUnitRef?: string;
  selectedProductionTagRef?: string;
  identifierDraft: CatalogIdentifierDraft[];
  categoryRefDraft?: string;
  attributeAssignmentsDraft: CatalogAttributeAssignment[];
  orderOptionConfigsDraft: CatalogOrderOptionConfig[];
  standardSalePriceDraft: number | null;
  preparationProfileDraft: PreparationProfileDraft | null;
  inventoryRulesDraft: CatalogInventoryRuleNode[];
  compositeGroupsDraft: CatalogCompositeGroupDraft[];
  skuVariantDimensionsDraft: SkuDimensionDraft[];
  skusDraft: SkuRowDraft[];
  mediaDraft: MediaDraft[];
  skuStagedMedia: MediaDraft[];
};

/**
 * Section editors exchange typed patches with the whole-item draft.  These
 * aliases deliberately retain the persisted draft field names so the workspace
 * does not translate one basic/production field at a time.
 */
export type CatalogItemBasicDraft = Pick<
  CatalogItemDraftSnapshot,
  | 'categoryRefDraft'
  | 'selectedTagRefs'
  | 'selectedSalesUnitRef'
  | 'selectedBaseMeasureUnitRef'
  | 'standardSalePriceDraft'
>;

export type CatalogItemProductionDraft = Pick<
  CatalogItemDraftSnapshot,
  'selectedProductionTagRef' | 'preparationProfileDraft'
>;

/**
 * Keep each editor section's field membership beside the draft model rather
 * than in the workspace assembler.  A new basic/production field therefore
 * changes its draft type and section adapter, not the workspace lifecycle.
 */
export function selectCatalogItemBasicDraft(draft: CatalogItemDraftSnapshot): CatalogItemBasicDraft {
  return {
    categoryRefDraft: draft.categoryRefDraft,
    selectedTagRefs: draft.selectedTagRefs,
    selectedSalesUnitRef: draft.selectedSalesUnitRef,
    selectedBaseMeasureUnitRef: draft.selectedBaseMeasureUnitRef,
    standardSalePriceDraft: draft.standardSalePriceDraft,
  };
}

export function selectCatalogItemProductionDraft(draft: CatalogItemDraftSnapshot): CatalogItemProductionDraft {
  return {
    selectedProductionTagRef: draft.selectedProductionTagRef,
    preparationProfileDraft: draft.preparationProfileDraft,
  };
}

export type CatalogEditorDraftSlice<T> = {
  values: T;
  onChange: (patch: Partial<T>) => void;
};

export const draftFieldSections: Partial<Record<keyof CatalogItemDraftSnapshot, CatalogItemDraftSection>> = {
  formValues: 'basic',
  selectedTagRefs: 'basic',
  selectedSalesUnitRef: 'basic',
  selectedBaseMeasureUnitRef: 'basic',
  selectedProductionTagRef: 'production-prompts',
  identifierDraft: 'identifiers',
  categoryRefDraft: 'basic',
  attributeAssignmentsDraft: 'attributes',
  orderOptionConfigsDraft: 'order-options',
  standardSalePriceDraft: 'basic',
  preparationProfileDraft: 'production-prompts',
  inventoryRulesDraft: 'inventory-bom',
  compositeGroupsDraft: 'composite-content',
  skuVariantDimensionsDraft: 'sku-specifications-pricing',
  skusDraft: 'sku-specifications-pricing',
  mediaDraft: 'basic',
  skuStagedMedia: 'sku-specifications-pricing',
};

export function draftSection(value: string): CatalogItemDraftSection {
  return (CATALOG_ITEM_DRAFT_SECTIONS as readonly string[]).includes(value)
    ? (value as CatalogItemDraftSection)
    : 'basic';
}

export function emptyCatalogItemDraftSnapshot(): CatalogItemDraftSnapshot {
  return {
    mode: 'edit',
    activeTab: 'basic',
    contentScrollTop: 0,
    formValues: {},
    selectedTagRefs: [],
    selectedSalesUnitRef: undefined,
    selectedBaseMeasureUnitRef: undefined,
    selectedProductionTagRef: undefined,
    identifierDraft: [],
    categoryRefDraft: undefined,
    attributeAssignmentsDraft: [],
    orderOptionConfigsDraft: [],
    standardSalePriceDraft: null,
    preparationProfileDraft: null,
    inventoryRulesDraft: [],
    compositeGroupsDraft: [],
    skuVariantDimensionsDraft: [],
    skusDraft: [],
    mediaDraft: [],
    skuStagedMedia: [],
  };
}

// These values stay inside an incomplete editor draft. They are validated by
// wireUuid only when a request is assembled for a generated endpoint.
export const draftUuid = (value = ''): ReturnType<typeof wireUuid> => value as ReturnType<typeof wireUuid>;

export function clonePreparationProfile(value: PreparationProfileDraft | null): PreparationProfileDraft | null {
  return value ? {...value} : null;
}

export function cloneSkuDimensions(
  value: CatalogSkuVariantDimension[],
  createId = (prefix: string, index: number) => `${prefix}-${index}`,
): SkuDimensionDraft[] {
  return value.map((dimension, dimensionIndex) => ({
    ...dimension,
    editorId:
      (dimension as Partial<SkuDimensionDraft>).editorId ||
      dimension.attributeRef ||
      dimension.attributeCode ||
      createId('dimension', dimensionIndex),
    values: dimension.values.map((entry, valueIndex) => ({
      ...entry,
      editorId:
        (entry as Partial<SkuDimensionValueDraft>).editorId ||
        entry.valueRef ||
        entry.valueCode ||
        createId('dimension-value', valueIndex),
    })),
  }));
}

export function cloneCompositeGroups(
  value: CatalogCompositeGroup[],
  createId = (prefix: string, index: number) => `${prefix}-${index}`,
): CatalogCompositeGroupDraft[] {
  return value.map((group, groupIndex) => ({
    ...group,
    editorId:
      (group as Partial<CatalogCompositeGroupDraft>).editorId ||
      group.groupCode ||
      group.groupName ||
      createId('group', groupIndex),
    components: group.components.map((component, componentIndex) => ({
      ...component,
      editorId:
        (component as Partial<CatalogCompositeComponentDraft>).editorId ||
        component.itemRef ||
        component.itemCode ||
        component.productSkuRef ||
        component.skuCode ||
        createId('component', componentIndex),
    })),
  }));
}

export function serializeSkuDimensions(value: SkuDimensionDraft[]): CatalogSkuVariantDimension[] {
  return value.map(({editorId: _editorId, values, ...dimension}) => ({
    ...dimension,
    values: values.map(({editorId: _valueEditorId, ...entry}) => entry),
  }));
}

type CatalogCompositeGroupsSave = NonNullable<CatalogItemSaveRequest['sections']['catalogDraft']['compositeGroups']>;

export function serializeCompositeGroups(value: CatalogCompositeGroupDraft[]): CatalogCompositeGroupsSave {
  return value.map(({editorId: _editorId, components, ...group}) => ({
    ...group,
    // Names are resolved read-model labels for users. The owner receives only the stable relation
    // identity and persisted component facts; sending labels back would create a second authority.
    components: components.map(
      ({editorId: _componentEditorId, itemName: _itemName, skuName: _skuName, ...component}) => component,
    ),
  }));
}

export function cloneSkuRows(value: CatalogSkuRow[]): CatalogSkuRow[] {
  return value.map(sku => ({
    ...sku,
    attributeValueRefs: sku.attributeValueRefs.map(entry => ({...entry})),
    identifiers: sku.identifiers.map(entry => ({...entry})),
    preparationOverride: {
      mode: sku.preparationOverride.mode,
      profile: clonePreparationProfile(sku.preparationOverride.profile),
    },
    effectivePreparation: clonePreparationProfile(sku.effectivePreparation),
    mediaRefs: [...sku.mediaRefs],
  }));
}

/** Attach the only local row key used by the SKU editor before a draft is persisted. */
export function normalizeSkuDraftRows(
  rows: CatalogSkuRow[],
  createDraftRowId: (prefix: string) => string,
): SkuRowDraft[] {
  return rows.map(row => {
    const draftRow = row as Partial<SkuRowDraft>;
    return {...row, editorId: row.productSkuRef.trim() || draftRow.editorId || createDraftRowId('sku')};
  });
}

export type CatalogPreparationLayout = 'ITEM_ONLY' | 'SKU' | 'OPTIONS' | 'SKU_AND_OPTIONS';

export function catalogPreparationLayout(
  shapeKey: string,
  skuCount: number,
  optionEffectCount: number,
): CatalogPreparationLayout {
  const hasSkuVariation = shapeKey === 'SKU_VARIANT_SALE_COUNTED' && skuCount > 0;
  const hasOptionVariation = optionEffectCount > 0;
  if (hasSkuVariation && hasOptionVariation) return 'SKU_AND_OPTIONS';
  if (hasSkuVariation) return 'SKU';
  if (hasOptionVariation) return 'OPTIONS';
  return 'ITEM_ONLY';
}

export function skuPreparationOverrideForMode(
  mode: CatalogSkuRow['preparationOverride']['mode'],
  profile: PreparationProfileDraft | null,
): CatalogSkuRow['preparationOverride'] {
  return {mode, profile: mode === 'OVERRIDE' ? clonePreparationProfile(profile) : null};
}

export function buildAdditivePreparationEffect(
  identity: Pick<
    CatalogPreparationEffect,
    'definitionValueRef' | 'optionGroupDisplayOrder' | 'optionValueDisplayOrder'
  >,
  current: CatalogPreparationEffect | null,
  patch: Partial<Pick<CatalogPreparationEffect, 'instruction' | 'preparationSecondsDelta'>>,
): CatalogPreparationEffect | null {
  const next = {
    definitionValueRef: identity.definitionValueRef,
    optionGroupDisplayOrder: identity.optionGroupDisplayOrder,
    optionValueDisplayOrder: identity.optionValueDisplayOrder,
    instruction: patch.instruction !== undefined ? patch.instruction : (current?.instruction ?? null),
    preparationSecondsDelta:
      patch.preparationSecondsDelta !== undefined
        ? patch.preparationSecondsDelta
        : (current?.preparationSecondsDelta ?? null),
  } satisfies CatalogPreparationEffect;
  return Boolean(next.instruction) || next.preparationSecondsDelta !== null ? next : null;
}
