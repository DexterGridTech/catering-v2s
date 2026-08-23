import type {
  CatalogDictionaryView,
  CatalogInventoryEnvelope,
  CatalogItemBatchStatusTransitionRequest,
  CatalogItemBatchStatusTransitionReadback,
  CatalogItemSaveRequest,
  CatalogItemSaveReadback,
  CatalogShapeManifestView,
  JsonValue,
  LocalCopyCandidatePage,
  LocalCopyPreflight,
  LocalCopyReadback,
  Uuid,
} from '../../../app/api/generated/catalog-inventory-edge';

export type CatalogItemSummary = {
  itemRef: Uuid;
  code: string;
  name: string;
  shortName?: string;
  materialRole?: string;
  primaryImageAssetRef?: Uuid;
  categoryRef: Uuid | null;
  productionTagRefs: Uuid[];
  tagRefs: Uuid[];
  shapeKey: string;
  status: string;
  source: string;
  skuEnabledCount: number;
  skuNonArchivedCount: number;
  skuTotalCount: number;
  skuDimensionSummary: string[];
  standardSalePrice?: number;
  standardSalePriceMin?: number;
  standardSalePriceMax?: number;
  standardPriceDelta?: number;
  standardExtraPrice?: number;
  priceGranularity: string;
  missingPriceCount: number;
  stockTargetCount: number;
  bomCount: number;
  version: number;
  updatedAt: number;
};

export type CatalogBatchUpdateKind = 'CATEGORY' | 'TAG';
export type CatalogBatchStatus = 'ENABLED' | 'DISABLED' | 'ARCHIVED';
export type CatalogBatchResult = {
  itemRef: Uuid;
  itemCode: string;
  outcome: 'SUCCEEDED' | 'FAILED';
  problemCode: string | null;
  reason: string | null;
  version: number | null;
};

/** Keep batch selection and the execution snapshot on the same source lock. */
export function isCatalogBatchRowSelectable(row: Pick<CatalogItemSummary, 'status' | 'source'>): boolean {
  return row.status !== 'ARCHIVED' && row.source !== 'TEMPORARY';
}

export type CatalogDictionaryLabel = {entryRef: Uuid; name: string; status: string};

export function decodeCatalogDictionaryLabels(response: CatalogDictionaryView | undefined): CatalogDictionaryLabel[] {
  return (
    response?.data.entries.map(entry => ({entryRef: entry.entryRef, name: entry.name, status: entry.status})) ?? []
  );
}

export type CatalogNavigation = {
  allCount: number;
  tree: Array<{
    categoryRef: Uuid;
    code: string;
    name: string;
    parentCategoryRef: Uuid | null;
    version: number;
    displayOrder: number;
    count: number;
    countSemantics: 'SELF_ONLY' | 'SELF_AND_DESCENDANTS';
    deletionAvailability: CatalogCategoryDeletionAvailability;
  }>;
  smartViews: Array<{viewKey: string; count: number}>;
  shapeCounts: Array<{shapeKey: string; count: number}>;
  /** Enabled catalog tags are a bounded navigation branch, with their matching item counts. */
  tags: Array<{tagRef: Uuid; code: string; name: string; count: number}>;
  /** Optional until the navigation owner exposes the unclassified aggregate. */
  uncategorizedCount?: number;
  generation: number;
};

/** A tag node has one owner-backed identity; its label and filter must travel together. */
export function catalogTagTreeSelection(tag: CatalogNavigation['tags'][number]): {
  kind: 'TAG';
  ref: Uuid;
  label: string;
} {
  return {kind: 'TAG', ref: tag.tagRef, label: tag.name};
}

/** Catalog category codes are unique within the loaded navigation scope. */
export function catalogCategoryCodeExists(
  tree: CatalogNavigation['tree'],
  code: string,
  excludedCategoryRef?: string,
): boolean {
  const normalized = code.trim().toLocaleUpperCase();
  if (!normalized) return false;
  return tree.some(
    node => node.categoryRef !== excludedCategoryRef && node.code.trim().toLocaleUpperCase() === normalized,
  );
}

export type CatalogCategoryDeletionAvailability = {
  canDelete: boolean;
  subtreeSize: number;
  blockingReferenceCount: number;
  blockingReferenceLabels: string[];
};

export type CatalogVoidAvailability = {
  canVoid: boolean;
  blockingReferences: Array<{referenceKind: string; referenceRef: Uuid}>;
  dependentFacts: Array<{factKind: string; factRef: Uuid}>;
};

/** A missing or malformed shape manifest must never enable a local-copy scope. */
export function shapeHasVisibleTab(
  manifest: Pick<CatalogShapeManifestView, 'tabRules'> | undefined,
  shapeKey: string,
  tabKey: string,
): boolean {
  const tabRules = manifest?.tabRules;
  if (!tabRules || typeof tabRules !== 'object' || Array.isArray(tabRules)) return false;
  const value = tabRules[shapeKey];
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const visible = (value as {visible?: unknown}).visible;
  return Array.isArray(visible) && visible.includes(tabKey);
}

export type CatalogMediaLimits = {maxImageCount: number; maxImageBytes: number};

/** The wire contract keeps monetary values as integer cents; editors use yuan. */
export function catalogCentsToYuan(value: number | null | undefined): number | undefined {
  if (value === null || value === undefined || !Number.isFinite(value)) return undefined;
  return Number((value / 100).toFixed(2));
}

/** Convert the operator-facing yuan input back to the integer-cent wire value. */
export function catalogYuanToCents(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100);
}

/** The server-generated manifest is the only frontend source of media limits. */
export function decodeCatalogMediaLimits(
  manifest: Pick<CatalogShapeManifestView, 'typeEffects'> | undefined,
): CatalogMediaLimits | undefined {
  const effects = manifest?.typeEffects;
  if (!effects || typeof effects !== 'object' || Array.isArray(effects)) return undefined;
  const limits = effects.mediaLimits;
  if (!limits || typeof limits !== 'object' || Array.isArray(limits)) return undefined;
  const maxImageCount = limits.maxImageCount;
  const maxImageBytes = limits.maxImageBytes;
  if (typeof maxImageCount !== 'number' || !Number.isInteger(maxImageCount) || maxImageCount < 1) return undefined;
  if (typeof maxImageBytes !== 'number' || !Number.isInteger(maxImageBytes) || maxImageBytes < 1) return undefined;
  return {maxImageCount, maxImageBytes};
}

export type CatalogExternalIdentity = {
  sourceOrderRef?: string;
  sourceRecordRef?: string;
  sourceItemRef?: string;
  snapshot?: {name?: string; specification?: string; price?: number | null};
};

export type CatalogDetail = {
  item: CatalogItemSummary & {
    itemKind: string;
    measureMode: string;
    usageCapabilities: string[];
    images: string[];
    categoryRef: Uuid | null;
    salesUnitRef: Uuid | null;
    baseMeasureUnitRef: Uuid | null;
    salesUnit: CatalogUnitAssignment | null;
    baseMeasureUnit: CatalogUnitAssignment | null;
    attributeAssignments: CatalogAttributeAssignment[];
    orderOptionConfigs: CatalogOrderOptionConfig[];
    identifiers: CatalogIdentifier[];
    skuVariantDimensions: CatalogSkuVariantDimension[];
    skus: CatalogSkuRow[];
    skuSummary: {enabledCount: number; nonArchivedCount: number; totalCount: number; dimensions: string[]};
    compositeGroups: CatalogCompositeGroup[];
    preparationProfile: CatalogPreparationProfile | null;
    lifecycle: {status: string; version: number; source: string};
    externalIdentity: CatalogExternalIdentity;
  };
  tabs: Array<{tabKey: string; visible: boolean; disabled: boolean; reason?: string}>;
  references: Array<{referenceKind: string; referenceRef: Uuid; code: string; direction: string}>;
  inventoryRules: CatalogInventoryRules;
  productionTags: Array<{code: string; tagRef: Uuid; name: string; status: string; owner: string}>;
  compositeGroups: CatalogCompositeGroup[];
  actionAvailability: {
    canEdit: boolean;
    canEnable: boolean;
    canDisable: boolean;
    canArchive: boolean;
    voidAvailability?: CatalogVoidAvailability;
  };
  governance: {deniedFields: string[]; externalIdentity: CatalogExternalIdentity};
  deniedFields: string[];
  fieldOwnership: {catalog: string; inventory: string; asset: string};
  queryIdentity: {dataNodeRef: Uuid; generation: string};
};

/** Detail responses may omit the ordered relation while still carrying the list primary image. */
export function catalogDetailImageRefs(item: Pick<CatalogDetail['item'], 'images' | 'primaryImageAssetRef'>): string[] {
  return item.images.length > 0 ? item.images : item.primaryImageAssetRef ? [item.primaryImageAssetRef] : [];
}

export type CatalogAttributeAssignment = {
  definitionRef: Uuid;
  code: string;
  name: string;
  valueType: 'TEXT' | 'SINGLE_SELECT' | 'MULTI_SELECT';
  textValue: string | null;
  optionRefs: Uuid[];
};
export type CatalogOrderOptionConfig = {
  definitionRef: Uuid;
  name: string;
  selectionMode: 'SINGLE' | 'MULTIPLE';
  displayOrder: number;
  required: boolean;
  minSelectionCount: number | null;
  maxSelectionCount: number | null;
  values: Array<{
    definitionValueRef: Uuid;
    name: string;
    displayOrder: number;
    defaultValue: boolean;
    extraPrice: number | null;
    bomVersion: number | null;
    preparationEffect: CatalogPreparationEffect | null;
  }>;
};
export type CatalogIdentifierType = 'BARCODE' | 'PLU' | 'MNEMONIC';
export type CatalogIdentifier = {
  identifierRef: Uuid;
  ownerType: 'CATALOG_ITEM' | 'SKU';
  ownerRef: Uuid;
  identifierType: CatalogIdentifierType;
  identifierValue: string;
  normalizedValue: string;
  displayOrder: number;
};
export type CatalogPreparationProfile = {
  productionTagRefs: Uuid[];
  productionDisplayName: string | null;
  estimatedPreparationSeconds: number | null;
  preparationNotes: string | null;
};
export type CatalogPreparationEffect = {
  definitionValueRef: Uuid;
  optionGroupDisplayOrder: number;
  optionValueDisplayOrder: number;
  addProductionTagRefs: Uuid[];
  instruction: string | null;
  preparationSecondsDelta: number | null;
};
export type CatalogCompositeComponent = {
  itemCode: string;
  itemRef: Uuid;
  productSkuRef: Uuid | null;
  skuCode: string | null;
  quantity: string;
  unit: string;
  default: boolean;
  extraPrice: number | null;
  status: string;
  displayOrder: number;
};
export type CatalogCompositeGroup = {
  groupCode: string;
  groupName: string;
  selectionRule: string;
  minSelections: number;
  maxSelections: number;
  displayOrder: number;
  components: CatalogCompositeComponent[];
};
export type CatalogUnitDimension = 'COUNT' | 'WEIGHT' | 'VOLUME' | 'SERVICE_DURATION' | 'PACKAGE';
export type CatalogUnitSnapshot = {
  unitRef: Uuid;
  code: string;
  name: string;
  unitDimension: CatalogUnitDimension;
  precision: number;
};
export type CatalogUnitAssignment = CatalogUnitSnapshot & {
  status: 'ENABLED' | 'DISABLED';
  inheritanceSource: 'ITEM_DEFAULT' | 'SKU_OVERRIDE';
};
export type CatalogInventoryRuleMode = 'NONE' | 'DIRECT' | 'BOM';
export type CatalogInventoryRuleOwner = {
  ownerType: 'ITEM' | 'SKU' | 'OPTION_VALUE';
  itemRef: Uuid;
  productSkuRef: Uuid | null;
  optionValueRef: Uuid | null;
  itemCode?: string | null;
  skuCode?: string | null;
  optionValueCode?: string | null;
};
export type CatalogInventoryRuleNode = {
  owner: CatalogInventoryRuleOwner;
  itemCode: string;
  itemName: string;
  skuCode: string | null;
  optionValueCode: string | null;
  allowedModes: CatalogInventoryRuleMode[];
  defaultMode: CatalogInventoryRuleMode;
  disabledReason: string | null;
  mode: CatalogInventoryRuleMode;
  directConfiguration: {
    targetRef: Uuid | null;
    allowNegative: boolean | null;
    lowStockThreshold: string | null;
    consumptionUnitSnapshot: CatalogUnitSnapshot | null;
    countingUnitSnapshot: CatalogUnitSnapshot | null;
    conversionFactor: string | null;
    version: number | null;
  } | null;
  bom: {
    version: number | null;
    lines: Array<{
      targetRef: Uuid;
      itemRef: Uuid;
      productSkuRef: Uuid | null;
      itemCode: string;
      skuCode: string | null;
      itemName: string;
      skuName: string | null;
      lineSign: 'POSITIVE' | 'NEGATIVE';
      quantity: string;
      consumptionUnitSnapshot: CatalogUnitSnapshot;
    }>;
  } | null;
};
export type CatalogInventoryRules = {nodes: CatalogInventoryRuleNode[]};
export type CatalogInventoryRuleDraftNode = CatalogItemSaveRequest['sections']['inventoryRules']['nodes'][number];
export type CatalogSkuAttributeValueRef = {
  attributeRef: Uuid;
  attributeCode: string;
  attributeName: string;
  attributeValueRef: Uuid;
  valueCode: string;
  valueLabel: string;
  displayOrder: number;
  status: string;
};
export type CatalogSkuVariantDimension = {
  attributeRef: Uuid;
  attributeCode: string;
  attributeName: string;
  values: Array<{valueRef: Uuid; valueCode: string; valueLabel: string; displayOrder: number; status: string}>;
};
export type CatalogSkuRow = {
  productSkuRef: Uuid;
  skuCode: string;
  skuName: string;
  displayOrder: number;
  variantCombinationDigest: string;
  attributeValueRefs: CatalogSkuAttributeValueRef[];
  identifiers: CatalogIdentifier[];
  preparationOverride: {mode: 'INHERIT_ITEM' | 'OVERRIDE'; profile: CatalogPreparationProfile | null};
  effectivePreparation: CatalogPreparationProfile | null;
  preparationSource: 'ITEM_DEFAULT' | 'SKU_OVERRIDE';
  standardSalePrice: number | null;
  isDefault: boolean;
  status: string;
  version: number;
  mediaRefs: Uuid[];
  salesUnitOverrideRef: Uuid | null;
  baseMeasureUnitOverrideRef: Uuid | null;
  salesUnit: CatalogUnitAssignment | null;
  baseMeasureUnit: CatalogUnitAssignment | null;
  voidAvailability?: CatalogVoidAvailability;
};

export function shouldHydrateCatalogItemDraft({
  initializedItemCode,
  detailItemCode,
  dirty,
  forceHydrate,
}: {
  initializedItemCode?: string;
  detailItemCode: string;
  dirty: boolean;
  forceHydrate: boolean;
}): boolean {
  return forceHydrate || initializedItemCode !== detailItemCode || !dirty;
}

export type CatalogSkuVoidReadback = Pick<
  CatalogItemSaveReadback['result']['skuTransitions'][number],
  'version' | 'canVoid' | 'blockingReferences' | 'dependentFacts'
>;

/** Merge only the owner-confirmed SKU transition into a local draft. */
export function mergeCatalogSkuVoidReadback(
  rows: CatalogSkuRow[],
  skuRef: Uuid,
  readback?: CatalogSkuVoidReadback,
): CatalogSkuRow[] {
  return rows.map(row => {
    if (row.productSkuRef !== skuRef) return row;
    const voidAvailability = readback
      ? {
          canVoid: readback.canVoid,
          blockingReferences: readback.blockingReferences.map(entry => ({...entry})),
          dependentFacts: readback.dependentFacts.map(entry => ({...entry})),
        }
      : row.voidAvailability
        ? {...row.voidAvailability, canVoid: false}
        : undefined;
    return {
      ...row,
      status: 'VOIDED',
      ...(readback ? {version: readback.version} : {}),
      ...(voidAvailability ? {voidAvailability} : {}),
    };
  });
}

/** Build the catalog-owner save envelope used exclusively for SKU VOIDED transitions. */
export function buildCatalogSkuVoidRequest(
  item: CatalogDetail['item'],
  dataNodeRef: Uuid,
  itemCode: string,
  sku: Pick<CatalogSkuRow, 'productSkuRef' | 'version'>,
  inventoryRules: CatalogInventoryRules = {nodes: []},
): CatalogItemSaveRequest {
  return {
    dataNodeRef,
    itemCode,
    skuTransitions: [{skuRef: sku.productSkuRef, targetStatus: 'VOIDED', expectedVersion: sku.version}],
    sections: {
      catalogDraft: {
        name: item.name,
        shapeKey: item.shapeKey,
        categoryRef: item.categoryRef,
        attributeAssignments: item.attributeAssignments.map(assignment => ({
          definitionRef: assignment.definitionRef,
          textValue: assignment.textValue,
          optionRefs: assignment.optionRefs,
        })),
        orderOptionConfigs: item.orderOptionConfigs.map(config => ({
          definitionRef: config.definitionRef,
          displayOrder: config.displayOrder,
          required: config.required,
          minSelectionCount: config.minSelectionCount,
          maxSelectionCount: config.maxSelectionCount,
          values: config.values.map(value => ({
            definitionValueRef: value.definitionValueRef,
            defaultValue: value.defaultValue,
            extraPrice: value.extraPrice,
            expectedBomVersion: value.bomVersion ?? 0,
            preparationEffect: value.preparationEffect
              ? {
                  addProductionTagRefs: value.preparationEffect.addProductionTagRefs,
                  instruction: value.preparationEffect.instruction,
                  preparationSecondsDelta: value.preparationEffect.preparationSecondsDelta,
                }
              : null,
          })),
        })),
        images: item.images,
        identifiers: item.identifiers.map(identifier => ({
          identifierType: identifier.identifierType,
          identifierValue: identifier.identifierValue,
        })),
        preparationProfile: item.preparationProfile,
        tagRefs: item.tagRefs,
      },
      expectedCatalogVersion: item.version,
      inventoryRules: {nodes: inventoryRules.nodes.map(catalogInventoryRuleToDraft)},
    },
  };
}
export type CatalogSkuIssueCode =
  'MISSING_CODE' | 'MISSING_NAME' | 'MISSING_SKU_PRICE' | 'DUPLICATE_CODE' | 'DUPLICATE_COMBINATION';

export function catalogSkuIssueCodes(
  sku: CatalogSkuRow,
  priceGranularity: string,
  duplicateCombination: boolean,
  duplicateCode = false,
): CatalogSkuIssueCode[] {
  return [
    !sku.skuCode.trim() ? 'MISSING_CODE' : undefined,
    !sku.skuName.trim() ? 'MISSING_NAME' : undefined,
    priceGranularity === 'SKU' && sku.status === 'ENABLED' && sku.standardSalePrice === null
      ? 'MISSING_SKU_PRICE'
      : undefined,
    duplicateCode && Boolean(sku.skuCode.trim()) ? 'DUPLICATE_CODE' : undefined,
    duplicateCombination ? 'DUPLICATE_COMBINATION' : undefined,
  ].filter((issue): issue is CatalogSkuIssueCode => Boolean(issue));
}

export type CatalogSkuSaveRow = NonNullable<
  NonNullable<CatalogItemSaveRequest['sections']['catalogDraft']['skus']>[number]
>;
export type CatalogProductionTagCandidate = {
  tagRef: string;
  code: string;
  name: string;
  tagKind?: 'PRODUCTION' | 'PACKAGE' | 'LABEL' | 'HANDOFF' | 'REVIEW' | 'OTHER';
  owner: 'fulfillment-production';
  status?: string;
};

export function productionTagCandidateFromReadback(
  readback: {tagRef?: string; code?: string; name?: string; status?: string} | undefined,
  fallback: {code: string; name: string; tagKind?: CatalogProductionTagCandidate['tagKind']},
): CatalogProductionTagCandidate | undefined {
  if (!readback?.tagRef) return undefined;
  return {
    tagRef: readback.tagRef,
    code: readback.code ?? fallback.code,
    name: readback.name ?? fallback.name,
    tagKind: fallback.tagKind,
    owner: 'fulfillment-production',
    status: readback.status,
  };
}

type CatalogBatchCatalogDraft = Partial<
  Pick<CatalogItemSaveRequest['sections']['catalogDraft'], 'categoryRef' | 'tagRefs'>
>;

/** Build a relation-only save from facts already present in the list row. */
export function buildCatalogBatchSaveRequest(
  row: Pick<CatalogItemSummary, 'code' | 'version'>,
  dataNodeRef: Uuid,
  kind: CatalogBatchUpdateKind,
  refs: Uuid[],
): CatalogItemSaveRequest {
  const catalogDraft: CatalogBatchCatalogDraft =
    kind === 'CATEGORY' ? {categoryRef: refs[0] ?? null} : {tagRefs: [...refs]};

  return {
    dataNodeRef,
    itemCode: row.code,
    sections: {
      // The generated editor envelope models the full draft as required, but
      // the catalog owner intentionally merges omitted unchanged draft facts.
      catalogDraft: catalogDraft as CatalogItemSaveRequest['sections']['catalogDraft'],
      expectedCatalogVersion: row.version,
      inventoryRules: {nodes: []},
    },
  };
}

/** Convert an owner-confirmed detail node into the generated whole-save branch. */
export function catalogInventoryRuleToDraft(node: CatalogInventoryRuleNode): CatalogInventoryRuleDraftNode {
  return {
    owner: {...node.owner},
    mode: node.mode,
    consumptionUnitSnapshot: node.directConfiguration?.consumptionUnitSnapshot ?? null,
    expectedTargetVersion: node.directConfiguration?.version ?? null,
    expectedBomVersion: node.bom?.version ?? null,
    directConfiguration:
      node.mode === 'DIRECT' && node.directConfiguration
        ? {
            allowNegative: node.directConfiguration.allowNegative ?? false,
            lowStockThreshold: node.directConfiguration.lowStockThreshold,
            countingUnitRef: node.directConfiguration.countingUnitSnapshot?.unitRef ?? null,
            conversionFactor: node.directConfiguration.conversionFactor,
          }
        : null,
    bom:
      node.mode === 'BOM' && node.bom
        ? {
            lines: node.bom.lines.map(line => ({
              targetRef: line.targetRef,
              lineSign: line.lineSign,
              quantity: line.quantity,
            })),
          }
        : null,
  };
}

export function buildCatalogBatchStatusRequest(
  dataNodeRef: Uuid,
  targetStatus: CatalogBatchStatus,
  rows: Array<Pick<CatalogItemSummary, 'itemRef' | 'version'>>,
): CatalogItemBatchStatusTransitionRequest {
  return {
    dataNodeRef,
    targetStatus,
    items: rows.map(row => ({itemRef: row.itemRef, expectedVersion: row.version})),
  };
}

/** The batch operation's direct edge readback is the root-level results array. */
export function decodeCatalogBatchResults(
  response:
    | CatalogInventoryEnvelope<CatalogItemBatchStatusTransitionReadback>
    | CatalogItemBatchStatusTransitionReadback
    | undefined,
  expectedItemRefs?: Uuid[],
): CatalogBatchResult[] {
  const root = asRecord(response);
  const invalid = (): never => {
    throw new Error('CATALOG_BATCH_RESULT_PROTOCOL_INVALID');
  };
  const rawResults: JsonValue[] = Array.isArray(root?.results) ? root.results : invalid();
  const expectedKeys = ['itemCode', 'itemRef', 'outcome', 'problemCode', 'reason', 'version'];
  if (expectedItemRefs && rawResults.length !== expectedItemRefs.length) invalid();
  const seen = new Set<string>();
  return rawResults.map((value, index) => {
    const row = asRecord(value);
    const record = row && Object.keys(row).sort().join('|') === expectedKeys.join('|') ? row : invalid();
    const itemRef = typeof record.itemRef === 'string' ? record.itemRef : '';
    const itemCode = typeof record.itemCode === 'string' ? record.itemCode.trim() : '';
    const outcome: CatalogBatchResult['outcome'] =
      record.outcome === 'SUCCEEDED' || record.outcome === 'FAILED' ? record.outcome : invalid();
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(itemRef) ||
      !itemCode ||
      seen.has(itemRef) ||
      (expectedItemRefs && expectedItemRefs[index] !== itemRef)
    ) {
      invalid();
    }
    seen.add(itemRef);
    const problemCode =
      record.problemCode === null
        ? null
        : typeof record.problemCode === 'string' && record.problemCode.trim()
          ? record.problemCode
          : invalid();
    const reason =
      record.reason === null
        ? null
        : typeof record.reason === 'string' && record.reason.trim()
          ? record.reason
          : invalid();
    const version =
      record.version === null
        ? null
        : typeof record.version === 'number' && Number.isInteger(record.version) && record.version > 0
          ? record.version
          : invalid();
    if (
      (outcome === 'SUCCEEDED' && (problemCode !== null || reason !== null || version === null)) ||
      (outcome === 'FAILED' && (problemCode === null || reason === null || version !== null))
    ) {
      invalid();
    }
    return {itemRef: itemRef as Uuid, itemCode, outcome, problemCode, reason, version};
  });
}

const emptyUuid = '' as Uuid;

function compareStableText(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function hasUuid(value: Uuid) {
  return value.trim().length > 0;
}

function skuCombinationKey(values: Array<{attributeRef: Uuid; attributeValueRef: Uuid}>) {
  return values
    .map(value => `${value.attributeRef}:${value.attributeValueRef}`)
    .sort(compareStableText)
    .join('|');
}

function cloneSkuRow(row: CatalogSkuRow, patch: Partial<CatalogSkuRow> = {}): CatalogSkuRow {
  return {
    ...row,
    ...patch,
    attributeValueRefs: patch.attributeValueRefs ?? row.attributeValueRefs.map(value => ({...value})),
    mediaRefs: patch.mediaRefs ?? [...row.mediaRefs],
  };
}

/**
 * Build the client-side SKU matrix from the selected, enabled dimension values.
 * The server-owned digest is intentionally not calculated here. Existing rows
 * are matched by the normalized (attributeRef, attributeValueRef) set instead,
 * so labels and ordering cannot make a previously edited row lose its content.
 */
export function buildSkuMatrix(
  dimensions: CatalogSkuVariantDimension[],
  existingSkus: CatalogSkuRow[],
): CatalogSkuRow[] {
  const choices = dimensions.map(dimension => ({
    dimension,
    values: [...dimension.values]
      .filter(value => value.status === 'ENABLED' && hasUuid(value.valueRef))
      .sort(
        (left, right) =>
          left.displayOrder - right.displayOrder ||
          compareStableText(left.valueCode, right.valueCode) ||
          compareStableText(left.valueRef, right.valueRef),
      ),
  }));
  if (choices.length === 0 || choices.some(choice => choice.values.length === 0))
    return existingSkus.map(row => cloneSkuRow(row));

  const combinations: Array<
    Array<{dimension: CatalogSkuVariantDimension; value: CatalogSkuVariantDimension['values'][number]}>
  > = [[]];
  for (const choice of choices) {
    const next: typeof combinations = [];
    for (const combination of combinations)
      for (const value of choice.values) next.push([...combination, {dimension: choice.dimension, value}]);
    combinations.splice(0, combinations.length, ...next);
  }

  const activeRowsByCombination = new Map<string, Array<{index: number; row: CatalogSkuRow}>>();
  existingSkus.forEach((row, index) => {
    if (row.status === 'ARCHIVED') return;
    const key = skuCombinationKey(row.attributeValueRefs);
    const rows = activeRowsByCombination.get(key) ?? [];
    rows.push({index, row});
    activeRowsByCombination.set(key, rows);
  });
  const consumed = new Set<number>();
  const usedCodes = new Set(existingSkus.map(row => row.skuCode).filter(Boolean));
  let generatedCodeNumber = 1;
  const nextGeneratedCode = () => {
    let code = '';
    do {
      code = `SKU-${String(generatedCodeNumber).padStart(3, '0')}`;
      generatedCodeNumber += 1;
    } while (usedCodes.has(code));
    usedCodes.add(code);
    return code;
  };
  const result: CatalogSkuRow[] = [];

  for (const combination of combinations) {
    const attributeValueRefs = combination.map(({dimension, value}) => ({
      attributeRef: dimension.attributeRef,
      attributeCode: dimension.attributeCode,
      attributeName: dimension.attributeName,
      attributeValueRef: value.valueRef,
      valueCode: value.valueCode,
      valueLabel: value.valueLabel,
      displayOrder: value.displayOrder,
      status: value.status,
    }));
    const key = skuCombinationKey(attributeValueRefs);
    const candidate = (activeRowsByCombination.get(key) ?? []).find(entry => !consumed.has(entry.index));
    if (candidate) {
      consumed.add(candidate.index);
      result.push(cloneSkuRow(candidate.row, {attributeValueRefs, displayOrder: result.length}));
      continue;
    }
    result.push({
      productSkuRef: emptyUuid,
      skuCode: nextGeneratedCode(),
      skuName: attributeValueRefs.map(value => value.valueLabel || value.valueCode).join(' / '),
      displayOrder: result.length,
      variantCombinationDigest: '',
      attributeValueRefs,
      identifiers: [],
      preparationOverride: {mode: 'INHERIT_ITEM', profile: null},
      effectivePreparation: null,
      preparationSource: 'ITEM_DEFAULT',
      standardSalePrice: null,
      isDefault: false,
      status: 'ENABLED',
      version: 0,
      mediaRefs: [],
      salesUnitOverrideRef: null,
      baseMeasureUnitOverrideRef: null,
      salesUnit: null,
      baseMeasureUnit: null,
      voidAvailability: {canVoid: false, blockingReferences: [], dependentFacts: []},
    });
  }

  const retainedRows = existingSkus
    .map((row, index) => ({row, index}))
    .filter(({index}) => !consumed.has(index))
    .sort(
      (left, right) =>
        left.row.displayOrder - right.row.displayOrder || compareStableText(left.row.skuCode, right.row.skuCode),
    );
  for (const {row} of retainedRows) result.push(cloneSkuRow(row, {displayOrder: result.length}));
  return result;
}

/** Response-only fields must never cross the save request boundary. */
export function serializeSkuRowsForSave(rows: CatalogSkuRow[]): CatalogSkuSaveRow[] {
  return rows.map(row => {
    const {
      variantCombinationDigest: ignoredDigest,
      version: ignoredVersion,
      effectivePreparation: ignoredEffectivePreparation,
      preparationSource: ignoredPreparationSource,
      salesUnit: ignoredSalesUnit,
      baseMeasureUnit: ignoredBaseMeasureUnit,
      voidAvailability: ignoredVoidAvailability,
      productSkuRef,
      ...requestRow
    } = row;
    void ignoredDigest;
    void ignoredVersion;
    void ignoredEffectivePreparation;
    void ignoredPreparationSource;
    void ignoredSalesUnit;
    void ignoredBaseMeasureUnit;
    void ignoredVoidAvailability;
    return productSkuRef.trim() ? {...requestRow, productSkuRef} : requestRow;
  });
}

export type CatalogWorkbenchContext = {
  ownerType: string;
  ownerRef: Uuid;
  brandRef: Uuid;
  scopeName: string;
  scopeCode: string;
  headCompanyRef?: Uuid | null;
  copySourceAvailable: boolean;
  actionAvailability: {canCreate: boolean; canEdit: boolean; canCopy: boolean; reasons: string[]};
};

export type CopyCandidate = {code: string; name: string; shapeKey: string; status: string; version: number};
export type BrandCopyScope = {ownerType: string; ownerRef: Uuid; brandRef: Uuid};
export type CatalogCopyReferenceMapping = {
  objectType: string;
  targetCode: string;
  targetSkuCode?: string;
  targetOptionValueCode?: string;
};

const catalogCopyObjectTypeLabels: Record<string, string> = {
  CATALOG_ITEM: '商品',
  CATALOG_CATEGORY: '商品分类',
  CATALOG_TAG: '商品标签',
  SKU: 'SKU',
  SKU_ATTRIBUTE: '销售属性',
  SKU_ATTRIBUTE_VALUE: '销售属性值',
  ORDER_OPTION_GROUP: '点单分组',
  ORDER_OPTION_VALUE: '点单选项',
  CATALOG_ORDER_OPTION_DEFINITION: '点单选项',
  CATALOG_ORDER_OPTION_DEFINITION_VALUE: '点单选项值',
  INVENTORY_TARGET: '库存对象',
  BOM: '配方',
  PACKAGE_COMPONENT: '套餐组件',
  PRODUCTION_PROMPT: '制作信息',
};

export function catalogCopyObjectTypeLabel(value: string) {
  return catalogCopyObjectTypeLabels[value] ?? '关联内容';
}

export function catalogCopyActionLabel(value: string) {
  if (value === 'CREATE') return '新建';
  if (value.includes('REUSE')) return '复用';
  if (value === 'SKIP') return '跳过';
  if (value === 'BLOCKED') return '不可复制';
  return '已检查';
}

export function catalogCopyScopeLabel(value: string) {
  if (value === 'HEAD_COMPANY') return '品牌商品库';
  if (value === 'STORE') return '门店商品库';
  return '当前商品库';
}
export type BrandCopyReadback = {
  preflightDigest: string;
  created: Array<{objectType: string; code: string}>;
  reused: Array<{objectType: string; code: string}>;
  referenceMappings: CatalogCopyReferenceMapping[];
  targetVersions: Array<{version: number}>;
  ownerReadbacks: Array<{owner: string; status: string; version: number}>;
};

/**
 * The combined brand-copy preflight also contains inventory and production
 * owner version rows.  Catalog execute accepts the catalog-owner scope
 * versions only; selecting the maximum across every owner would send a
 * foreign version and make an otherwise unchanged copy fail as stale.
 */
const CATALOG_COPY_OBJECT_TYPES = new Set([
  'CATALOG_ITEM',
  'CATALOG_CATEGORY',
  'CATALOG_TAG',
  'SKU_ATTRIBUTE',
  'SKU_ATTRIBUTE_VALUE',
]);

export function catalogCopyVersionRows(rows: Array<Record<string, JsonValue>>) {
  return rows.filter(row => CATALOG_COPY_OBJECT_TYPES.has(String(row.objectType ?? '')));
}
export type CopyPreflight = {
  selectedCount: number;
  selectedLimit: number;
  closureCount: number;
  closureLimit: number;
  preflightDigest: string;
  blockingCount: number;
  confirmationRequiredCount: number;
  selectedItems: Array<{objectType: string; code: string; name: string}>;
  closureItems: Array<{objectType: string; code: string; name: string; action: string}>;
  referenceMappings: CatalogCopyReferenceMapping[];
  compatibilityResults: Array<{
    objectType: string;
    compatibilityId: string;
    result: string;
    reason: string;
    businessCode?: string;
  }>;
  objectVersions: Array<Record<string, JsonValue>>;
};

type ConfirmableCompatibility = {compatibilityId: string; result: string};
export type CopyConfirmationRow<T extends ConfirmableCompatibility = CopyPreflight['compatibilityResults'][number]> = {
  row: T;
  key: string;
};

/** Keep the UI confirmation denominator aligned with the owner aggregate. */
export function copyConfirmationRows<T extends ConfirmableCompatibility>(rows: T[]): CopyConfirmationRow<T>[] {
  return rows.flatMap(row =>
    row.result === 'BLOCKED' || !row.compatibilityId ? [] : [{row, key: copyConfirmationKey(row)}],
  );
}

export function copyConfirmationKey(row: ConfirmableCompatibility): string {
  return row.compatibilityId;
}

export function copyConfirmationLabel(result: string): string {
  if (result === 'CREATE') return '确认新建';
  if (result.includes('REUSE')) return '确认复用';
  return '确认此处理';
}

export type BrandCopyCompatibilityBuckets = {
  inventory: CopyPreflight['compatibilityResults'];
  production: CopyPreflight['compatibilityResults'];
  other: CopyPreflight['compatibilityResults'];
};

export function partitionBrandCopyCompatibilityResults(
  rows: CopyPreflight['compatibilityResults'],
): BrandCopyCompatibilityBuckets {
  const buckets: BrandCopyCompatibilityBuckets = {inventory: [], production: [], other: []};
  for (const row of rows) {
    if (row.objectType.includes('STOCK') || row.objectType.includes('BOM')) buckets.inventory.push(row);
    else if (row.objectType.includes('PRODUCTION')) buckets.production.push(row);
    else buckets.other.push(row);
  }
  return buckets;
}

/** Technical section keys remain local because they drive owner dependency semantics;
 * their user-facing labels come from the shape manifest at runtime. */
export const LOCAL_COPY_SCOPE_VALUES = [
  'BASIC_INFO',
  'SKU_STRUCTURE',
  'SKU_BOM',
  'ORDER_OPTIONS',
  'OPTION_VALUE_BOM',
  'ITEM_BOM',
  'PACKAGE_STRUCTURE',
  'PRODUCTION_PROMPTS',
] as const;

export type LocalCopyScope = (typeof LOCAL_COPY_SCOPE_VALUES)[number];
export type LocalCopyCandidatePageData = LocalCopyCandidatePage['data'];
export type LocalCopyPreflightData = LocalCopyPreflight['data'];
export type LocalCopyReadbackData = LocalCopyReadback['data'];
type CatalogDataEnvelope<T = unknown> = {data?: T};

export function decodeLocalCopyCandidatePage(
  response: LocalCopyCandidatePage | undefined,
): LocalCopyCandidatePageData | undefined {
  return response?.data;
}

export function decodeLocalCopyPreflight(response: LocalCopyPreflight | undefined): LocalCopyPreflightData | undefined {
  const value = response?.data;
  return value?.preflightDigest ? value : undefined;
}

export function decodeLocalCopyReadback(response: LocalCopyReadback | undefined): LocalCopyReadbackData | undefined {
  const value = response?.data;
  return value?.preflightDigest ? value : undefined;
}

export function envelopeData(envelope: CatalogDataEnvelope | undefined): Record<string, JsonValue> | undefined {
  return asRecord(envelope?.data);
}

export function decodeWorkbenchContext(envelope: CatalogDataEnvelope | undefined): CatalogWorkbenchContext | undefined {
  const value = envelopeData(envelope);
  if (!value) return undefined;
  const availability = asRecord(value.actionAvailability) ?? {};
  return {
    ownerType: text(value.ownerType),
    ownerRef: readUuid(value.ownerRef),
    brandRef: readUuid(value.brandRef),
    scopeName: text(value.scopeName),
    scopeCode: text(value.scopeCode),
    headCompanyRef: readOptionalUuid(value.headCompanyRef),
    copySourceAvailable: truth(value.copySourceAvailable),
    actionAvailability: {
      canCreate: truth(availability.canCreate),
      canEdit: truth(availability.canEdit),
      canCopy: truth(availability.canCopy),
      reasons: textArray(availability.reasons),
    },
  };
}

export function decodeNavigation(envelope: CatalogDataEnvelope | undefined): CatalogNavigation {
  const value = envelopeData(envelope) ?? {};
  return {
    allCount: integer(value.allCount),
    tree: recordArray(value.tree).map(row => {
      const deletion = asRecord(row.deletionAvailability) ?? {};
      return {
        categoryRef: readUuid(row.categoryRef),
        code: text(row.code),
        name: text(row.name),
        parentCategoryRef: row.parentCategoryRef === null ? null : (readOptionalUuid(row.parentCategoryRef) ?? null),
        version: integer(row.version),
        displayOrder: integer(row.displayOrder),
        count: integer(row.count),
        countSemantics: row.countSemantics === 'SELF_AND_DESCENDANTS' ? 'SELF_AND_DESCENDANTS' : 'SELF_ONLY',
        deletionAvailability: {
          canDelete: truth(deletion.canDelete),
          subtreeSize: integer(deletion.subtreeSize),
          blockingReferenceCount: integer(deletion.blockingReferenceCount),
          blockingReferenceLabels: textArray(deletion.blockingReferenceLabels),
        },
      };
    }),
    smartViews: recordArray(value.smartViews).map(row => ({viewKey: text(row.viewKey), count: integer(row.count)})),
    shapeCounts: recordArray(value.shapeCounts).map(row => ({shapeKey: text(row.shapeKey), count: integer(row.count)})),
    tags: recordArray(value.tags).map(row => ({
      tagRef: readUuid(row.tagRef),
      code: text(row.code),
      name: text(row.name),
      count: integer(row.count),
    })),
    uncategorizedCount: optionalInteger(value.uncategorizedCount),
    generation: integer(value.generation),
  };
}

export function decodeItems(envelope: CatalogDataEnvelope | undefined) {
  const value = envelopeData(envelope) ?? {};
  return {
    items: recordArray(value.items).map(decodeItemSummary),
    total: integer(value.total),
    cursor: text(value.cursor),
    generation: integer(value.generation),
    queryGeneration: text(value.queryGeneration),
  };
}

export function buildCatalogItemsQuery(values: {
  dataNodeRef: Uuid;
  keyword?: string;
  smartViewKey?: string;
  shapeKey?: string;
  categoryRef?: Uuid;
  tagRef?: Uuid;
  uncategorized?: boolean;
  includeSubCategories?: boolean;
  status?: string;
  source?: string;
  cursor?: string;
  pageSize?: number;
  queryGeneration?: string;
}): Record<string, JsonValue> {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined));
}

export function shortNameMatchesKeyword(shortName: string | undefined, keyword: string | undefined): boolean {
  const candidate = shortName?.trim().toLocaleLowerCase();
  const query = keyword?.trim().toLocaleLowerCase();
  return Boolean(candidate && query && candidate.includes(query));
}

export function catalogPriceLabel(
  row: Pick<CatalogItemSummary, 'standardSalePrice' | 'standardSalePriceMin' | 'standardSalePriceMax'>,
): string {
  const min = row.standardSalePriceMin;
  const max = row.standardSalePriceMax;
  if (min !== undefined && max !== undefined) {
    const minLabel = (min / 100).toFixed(2);
    const maxLabel = (max / 100).toFixed(2);
    return min === max ? `¥${minLabel}` : `¥${minLabel}~${maxLabel}`;
  }
  return row.standardSalePrice === undefined ? '—' : `¥${(row.standardSalePrice / 100).toFixed(2)}`;
}

export type CatalogTreeSelectionForFilter = {
  kind: 'SMART' | 'SHAPE' | 'CATEGORY' | 'TAG' | 'UNCATEGORIZED';
  ref: string;
};

export function catalogFilterConflictReason(
  selection: CatalogTreeSelectionForFilter,
  filter: 'status' | 'source',
): string | undefined {
  if (selection.kind !== 'SMART') return undefined;
  if (filter === 'status' && (selection.ref === 'INACTIVE' || selection.ref === 'ARCHIVED')) {
    return '当前智能视图已按商品状态限定，不能再叠加状态筛选';
  }
  if (filter === 'source' && (selection.ref === 'EXTERNAL_ORDER_TEMP' || selection.ref === 'AUTO_SYNC')) {
    return '当前智能视图已按商品来源限定，不能再叠加来源筛选';
  }
  return undefined;
}

export function catalogFormValidationIssue(error: unknown): {tabKey: 'basic'; message: string} | undefined {
  if (!error || typeof error !== 'object' || !('errorFields' in error) || !Array.isArray(error.errorFields))
    return undefined;
  const first = error.errorFields[0];
  if (!first || typeof first !== 'object') return undefined;
  const errors =
    'errors' in first && Array.isArray(first.errors)
      ? first.errors.filter((value: unknown): value is string => typeof value === 'string')
      : [];
  return {tabKey: 'basic', message: errors[0] ?? '请先修正当前页签中的字段。'};
}

/** Keep typed inventory failures on the tab that owns the submitted facts. */
export function catalogInventoryProblemTab(errorCode: string): 'basic' | 'inventory-bom' | undefined {
  if (errorCode === 'CATALOG_BASE_MEASURE_UNIT_CHANGE_BLOCKED') return 'basic';
  if (errorCode === 'CONSUMPTION_UNIT_INCOMPATIBLE' || errorCode.startsWith('INVENTORY_')) return 'inventory-bom';
  return undefined;
}

export function decodeDetail(envelope: CatalogDataEnvelope | undefined): CatalogDetail | undefined {
  const root = envelopeData(envelope);
  const item = asRecord(root?.item);
  if (!root || !item) return undefined;
  const action = asRecord(root.actionAvailability) ?? {};
  const governance = asRecord(root.governance) ?? {};
  const rootCompositeGroups = decodeCompositeGroups(root.compositeGroups);
  const itemCompositeGroups = decodeCompositeGroups(item.compositeGroups);
  const inventoryRules = decodeInventoryRules(root.inventoryRules);
  const itemSkuDimensions = decodeSkuVariantDimensions(item.skuVariantDimensions);
  const itemSkus = decodeSkuRows(item.skus);
  const skuSummary = decodeSkuSummary(item.skuSummary);
  const lifecycle = asRecord(item.lifecycle) ?? {};
  const itemExternalIdentity = decodeExternalIdentity(item.externalIdentity);
  const decodedGovernanceExternalIdentity = decodeExternalIdentity(governance.externalIdentity);
  const governanceExternalIdentity =
    Object.keys(decodedGovernanceExternalIdentity).length > 0
      ? decodedGovernanceExternalIdentity
      : itemExternalIdentity;
  const voidAvailability = asRecord(action.voidAvailability);
  const voidFacts = voidAvailability
    ? {
        canVoid: truth(voidAvailability.canVoid),
        blockingReferences: recordArray(voidAvailability.blockingReferences).map(entry => ({
          referenceKind: text(entry.referenceKind),
          referenceRef: readUuid(entry.referenceRef),
        })),
        dependentFacts: recordArray(voidAvailability.dependentFacts).map(entry => ({
          factKind: text(entry.factKind),
          factRef: readUuid(entry.factRef),
        })),
      }
    : undefined;
  return {
    item: {
      ...decodeItemSummary(item),
      skuEnabledCount: skuSummary.enabledCount,
      skuNonArchivedCount: skuSummary.nonArchivedCount,
      skuTotalCount: skuSummary.totalCount,
      itemKind: text(item.itemKind),
      measureMode: text(item.measureMode),
      usageCapabilities: textArray(item.usageCapabilities),
      images: textArray(item.images),
      primaryImageAssetRef: readOptionalUuid(item.primaryImageAssetRef),
      categoryRef: readOptionalUuid(item.categoryRef) ?? null,
      salesUnitRef: readOptionalUuid(item.salesUnitRef) ?? null,
      baseMeasureUnitRef: readOptionalUuid(item.baseMeasureUnitRef) ?? null,
      salesUnit: decodeUnitAssignment(item.salesUnit),
      baseMeasureUnit: decodeUnitAssignment(item.baseMeasureUnit),
      attributeAssignments: recordArray(item.attributeAssignments).map(row => ({
        definitionRef: readUuid(row.definitionRef),
        code: text(row.code),
        name: text(row.name),
        valueType: text(row.valueType) as CatalogAttributeAssignment['valueType'],
        textValue: optionalText(row.textValue) ?? null,
        optionRefs: readUuidArray(row.optionRefs),
      })),
      orderOptionConfigs: recordArray(item.orderOptionConfigs).map(row => ({
        definitionRef: readUuid(row.definitionRef),
        name: text(row.name),
        selectionMode: text(row.selectionMode) as CatalogOrderOptionConfig['selectionMode'],
        displayOrder: integer(row.displayOrder),
        required: truth(row.required),
        minSelectionCount: optionalNumber(row.minSelectionCount) ?? null,
        maxSelectionCount: optionalNumber(row.maxSelectionCount) ?? null,
        values: recordArray(row.values).map(value => ({
          definitionValueRef: readUuid(value.definitionValueRef),
          name: text(value.name),
          displayOrder: integer(value.displayOrder),
          defaultValue: truth(value.defaultValue),
          extraPrice: optionalNumber(value.extraPrice) ?? null,
          bomVersion: optionalNumber(value.bomVersion) ?? null,
          preparationEffect: decodePreparationEffect(value.preparationEffect),
        })),
      })),
      identifiers: decodeIdentifiers(item.identifiers),
      skuVariantDimensions: itemSkuDimensions,
      skus: itemSkus,
      skuSummary,
      compositeGroups: itemCompositeGroups.length ? itemCompositeGroups : rootCompositeGroups,
      preparationProfile: decodePreparationProfile(item.preparationProfile),
      lifecycle: {
        status: text(lifecycle.status) || text(item.status),
        version: integer(lifecycle.version) || integer(item.version),
        source: text(lifecycle.source) || text(item.source),
      },
      externalIdentity: itemExternalIdentity,
    },
    tabs: recordArray(root.tabs).map(row => ({
      tabKey: text(row.tabKey),
      visible: truth(row.visible),
      disabled: truth(row.disabled),
      reason: optionalText(row.reason),
    })),
    references: recordArray(root.references).map(row => ({
      referenceKind: text(row.referenceKind),
      referenceRef: readUuid(row.referenceRef),
      code: text(row.code),
      direction: text(row.direction),
    })),
    inventoryRules,
    productionTags: recordArray(root.productionTags).map(row => ({
      code: text(row.code),
      tagRef: readUuid(row.tagRef),
      name: text(row.name),
      status: text(row.status),
      owner: text(row.owner),
    })),
    compositeGroups: rootCompositeGroups.length ? rootCompositeGroups : itemCompositeGroups,
    actionAvailability: {
      canEdit: truth(action.canEdit),
      canEnable: truth(action.canEnable),
      canDisable: truth(action.canDisable),
      canArchive: truth(action.canArchive),
      ...(voidFacts ? {voidAvailability: voidFacts} : {}),
    },
    governance: {deniedFields: textArray(governance.deniedFields), externalIdentity: governanceExternalIdentity},
    deniedFields: textArray(root.deniedFields),
    fieldOwnership: {
      catalog: text(asRecord(root.fieldOwnership)?.catalog),
      inventory: text(asRecord(root.fieldOwnership)?.inventory),
      asset: text(asRecord(root.fieldOwnership)?.asset),
    },
    queryIdentity: {
      dataNodeRef: readUuid(asRecord(root.queryIdentity)?.dataNodeRef),
      generation: text(asRecord(root.queryIdentity)?.generation),
    },
  };
}

export function decodeCandidates(envelope: CatalogInventoryEnvelope | undefined): CopyCandidate[] {
  const value = envelopeData(envelope);
  const page = asRecord(value?.data) ?? value;
  return recordArray(page?.items).map(row => ({
    code: text(row.code),
    name: text(row.name),
    shapeKey: text(row.shapeKey),
    status: text(row.status),
    version: integer(row.version),
  }));
}

export function decodeBrandCopyScopes(envelope: CatalogInventoryEnvelope | undefined): {
  sourceScope?: BrandCopyScope;
  targetScope?: BrandCopyScope;
  copySourceAvailable: boolean;
} {
  const root = envelopeData(envelope);
  const page = asRecord(root?.data) ?? root;
  const source = asRecord(page?.sourceScope);
  const target = asRecord(page?.targetScope);
  return {
    sourceScope: source
      ? {ownerType: text(source.ownerType), ownerRef: readUuid(source.ownerRef), brandRef: readUuid(source.brandRef)}
      : undefined,
    targetScope: target
      ? {ownerType: text(target.ownerType), ownerRef: readUuid(target.ownerRef), brandRef: readUuid(target.brandRef)}
      : undefined,
    copySourceAvailable: truth(page?.copySourceAvailable),
  };
}

export function decodeBrandCopyReadback(envelope: CatalogInventoryEnvelope | undefined): BrandCopyReadback | undefined {
  const root = envelopeData(envelope) ?? asRecord(envelope?.result);
  const value = asRecord(root?.data) ?? root;
  if (!value?.preflightDigest) return undefined;
  return {
    preflightDigest: text(value.preflightDigest),
    created: recordArray(value.created).map(row => ({objectType: text(row.objectType), code: text(row.code)})),
    reused: recordArray(value.reused).map(row => ({objectType: text(row.objectType), code: text(row.code)})),
    referenceMappings: referenceMappings(value.referenceMappings),
    targetVersions: recordArray(value.targetVersions).map(row => ({version: integer(row.version)})),
    ownerReadbacks: recordArray(value.ownerReadbacks).map(row => ({
      owner: text(row.owner),
      status: text(row.status),
      version: integer(row.version),
    })),
  };
}

export function decodePreflight(envelope: CatalogInventoryEnvelope | undefined): CopyPreflight | undefined {
  const root = envelopeData(envelope) ?? asRecord(envelope?.result);
  const value = asRecord(root?.data) ?? root;
  if (!value?.preflightDigest) return undefined;
  const compatibilityResults = decodeCompatibilityResults(value.compatibilityResults);
  if (!compatibilityResults) return undefined;
  return {
    selectedCount: integer(value.selectedCount),
    selectedLimit: integer(value.selectedLimit),
    closureCount: integer(value.closureCount),
    closureLimit: integer(value.closureLimit),
    preflightDigest: text(value.preflightDigest),
    blockingCount: integer(value.blockingCount),
    confirmationRequiredCount: integer(value.confirmationRequiredCount),
    selectedItems: recordArray(value.selectedItems).map(row => ({
      objectType: text(row.objectType),
      code: text(row.code),
      name: text(row.name),
    })),
    closureItems: recordArray(value.closureItems).map(row => ({
      objectType: text(row.objectType),
      code: text(row.code),
      name: text(row.name),
      action: text(row.action),
    })),
    referenceMappings: referenceMappings(value.referenceMappings),
    compatibilityResults,
    objectVersions: recordArray(value.objectVersions),
  };
}

function decodeCompatibilityResults(value: JsonValue | undefined): CopyPreflight['compatibilityResults'] | undefined {
  if (!Array.isArray(value)) return undefined;
  const seen = new Set<string>();
  const decoded: CopyPreflight['compatibilityResults'] = [];
  for (const entry of value) {
    const row = asRecord(entry);
    const objectType = typeof row?.objectType === 'string' ? row.objectType : '';
    const compatibilityId = typeof row?.compatibilityId === 'string' ? row.compatibilityId : '';
    const result = typeof row?.result === 'string' ? row.result : '';
    const reason = typeof row?.reason === 'string' ? row.reason : '';
    if (!row || !objectType.trim() || !compatibilityId.trim() || !result.trim() || seen.has(compatibilityId))
      return undefined;
    seen.add(compatibilityId);
    const tuple = asRecord(row.canonicalTuple);
    const parts = tuple ? textArray(tuple.parts as JsonValue | undefined) : [];
    // The owner canonical tuple's first business part is the conflict identity label.  It is display-only;
    // replay and reference mapping remain opaque-ref based.
    const businessCode = parts[0]?.trim() || undefined;
    decoded.push({objectType, compatibilityId, result, reason, businessCode});
  }
  return decoded;
}

function referenceMappings(value: JsonValue | undefined): CatalogCopyReferenceMapping[] {
  return recordArray(value).map(row => ({
    objectType: text(row.objectType),
    targetCode: text(row.targetCode),
    ...(text(row.targetSkuCode) ? {targetSkuCode: text(row.targetSkuCode)} : {}),
    ...(text(row.targetOptionValueCode) ? {targetOptionValueCode: text(row.targetOptionValueCode)} : {}),
  }));
}

export function displayValue(value: JsonValue | undefined) {
  if (value === undefined || value === null || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function decodeItemSummary(row: Record<string, JsonValue>): CatalogItemSummary {
  const summary: CatalogItemSummary = {
    itemRef: readUuid(row.itemRef),
    code: text(row.code),
    name: text(row.name),
    shortName: optionalText(row.shortName),
    materialRole: optionalText(row.materialRole),
    categoryRef: readOptionalUuid(row.categoryRef) ?? null,
    productionTagRefs: readUuidArray(row.productionTagRefs),
    tagRefs: readUuidArray(row.tagRefs),
    shapeKey: text(row.shapeKey),
    status: text(row.status),
    source: text(row.source),
    skuEnabledCount: integer(row.skuEnabledCount),
    skuNonArchivedCount: integer(row.skuNonArchivedCount),
    skuTotalCount: integer(row.skuTotalCount),
    skuDimensionSummary: textArray(row.skuDimensionSummary),
    standardSalePrice: optionalNumber(row.standardSalePrice),
    standardSalePriceMin: optionalNumber(row.standardSalePriceMin),
    standardSalePriceMax: optionalNumber(row.standardSalePriceMax),
    standardPriceDelta: optionalNumber(row.standardPriceDelta),
    standardExtraPrice: optionalNumber(row.standardExtraPrice),
    priceGranularity: text(row.priceGranularity),
    missingPriceCount: integer(row.missingPriceCount),
    stockTargetCount: integer(row.stockTargetCount),
    bomCount: integer(row.bomCount),
    version: integer(row.version),
    updatedAt: integer(row.updatedAt),
  };
  const primaryImageAssetRef = readOptionalUuid(row.primaryImageAssetRef);
  if (primaryImageAssetRef) summary.primaryImageAssetRef = primaryImageAssetRef;
  return summary;
}

export function asRecord(value: unknown): Record<string, JsonValue> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, JsonValue>) : undefined;
}
export function recordArray(value: JsonValue | undefined): Array<Record<string, JsonValue>> {
  return Array.isArray(value) ? value.flatMap(entry => (asRecord(entry) ? [asRecord(entry)!] : [])) : [];
}
export function text(value: JsonValue | undefined): string {
  return typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value);
}
// Responses may legitimately omit optional nested refs while a detail is
// loading. This decoder never crosses a generated request boundary; request
// UUIDs use app/api/wireUuid instead.
function readUuid(value: JsonValue | undefined): Uuid {
  return text(value) as Uuid;
}
function readOptionalUuid(value: JsonValue | undefined): Uuid | undefined {
  const result = optionalText(value);
  return result ? (result as Uuid) : undefined;
}
function readUuidArray(value: JsonValue | undefined): Uuid[] {
  return textArray(value).map(entry => entry as Uuid);
}
function optionalText(value: JsonValue | undefined): string | undefined {
  const result = text(value).trim();
  return result || undefined;
}
function integer(value: JsonValue | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
function optionalInteger(value: JsonValue | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
function optionalNumber(value: JsonValue | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
function decodeSkuSummary(value: JsonValue | undefined): CatalogDetail['item']['skuSummary'] {
  const row = asRecord(value) ?? {};
  return {
    enabledCount: integer(row.enabledCount),
    nonArchivedCount: integer(row.nonArchivedCount),
    totalCount: integer(row.totalCount),
    dimensions: textArray(row.dimensions),
  };
}
function decodeExternalIdentity(value: JsonValue | undefined): CatalogExternalIdentity {
  const row = asRecord(value);
  if (!row) return {};
  const snapshot = asRecord(row.snapshot);
  return {
    sourceOrderRef: optionalText(row.sourceOrderRef),
    sourceRecordRef: optionalText(row.sourceRecordRef),
    sourceItemRef: optionalText(row.sourceItemRef),
    ...(snapshot
      ? {
          snapshot: {
            name: optionalText(snapshot.name),
            specification: optionalText(snapshot.specification),
            price: snapshot.price === null ? null : optionalNumber(snapshot.price),
          },
        }
      : {}),
  };
}
function decodeSkuVariantDimensions(value: JsonValue | undefined): CatalogSkuVariantDimension[] {
  return recordArray(value).map(row => ({
    attributeRef: readUuid(row.attributeRef),
    attributeCode: text(row.attributeCode),
    attributeName: text(row.attributeName),
    values: recordArray(row.values).map(entry => ({
      valueRef: readUuid(entry.valueRef),
      valueCode: text(entry.valueCode),
      valueLabel: text(entry.valueLabel),
      displayOrder: integer(entry.displayOrder),
      status: text(entry.status),
    })),
  }));
}
function decodeIdentifiers(value: JsonValue | undefined): CatalogIdentifier[] {
  return recordArray(value).map(row => ({
    identifierRef: readUuid(row.identifierRef),
    ownerType: text(row.ownerType) as CatalogIdentifier['ownerType'],
    ownerRef: readUuid(row.ownerRef),
    identifierType: text(row.identifierType) as CatalogIdentifierType,
    identifierValue: text(row.identifierValue),
    normalizedValue: text(row.normalizedValue),
    displayOrder: integer(row.displayOrder),
  }));
}
function decodePreparationProfile(value: JsonValue | undefined): CatalogPreparationProfile | null {
  const row = asRecord(value);
  if (!row) return null;
  return {
    productionTagRefs: readUuidArray(row.productionTagRefs),
    productionDisplayName: row.productionDisplayName === null ? null : optionalText(row.productionDisplayName) ?? null,
    estimatedPreparationSeconds:
      row.estimatedPreparationSeconds === null ? null : optionalInteger(row.estimatedPreparationSeconds) ?? null,
    preparationNotes: row.preparationNotes === null ? null : optionalText(row.preparationNotes) ?? null,
  };
}
function decodePreparationOverride(value: JsonValue | undefined): CatalogSkuRow['preparationOverride'] {
  const row = asRecord(value) ?? {};
  const mode = text(row.mode) as CatalogSkuRow['preparationOverride']['mode'];
  return {
    mode: mode === 'OVERRIDE' ? 'OVERRIDE' : 'INHERIT_ITEM',
    profile: decodePreparationProfile(row.profile),
  };
}
function decodePreparationEffect(value: JsonValue | undefined): CatalogPreparationEffect | null {
  const row = asRecord(value);
  if (!row) return null;
  return {
    definitionValueRef: readUuid(row.definitionValueRef),
    optionGroupDisplayOrder: integer(row.optionGroupDisplayOrder),
    optionValueDisplayOrder: integer(row.optionValueDisplayOrder),
    addProductionTagRefs: readUuidArray(row.addProductionTagRefs),
    instruction: row.instruction === null ? null : optionalText(row.instruction) ?? null,
    preparationSecondsDelta:
      row.preparationSecondsDelta === null ? null : optionalInteger(row.preparationSecondsDelta) ?? null,
  };
}
function decodeSkuRows(value: JsonValue | undefined): CatalogSkuRow[] {
  return recordArray(value).map(row => ({
    productSkuRef: readUuid(row.productSkuRef),
    skuCode: text(row.skuCode),
    skuName: text(row.skuName),
    displayOrder: integer(row.displayOrder),
    variantCombinationDigest: text(row.variantCombinationDigest),
    attributeValueRefs: recordArray(row.attributeValueRefs).map(entry => ({
      attributeRef: readUuid(entry.attributeRef),
      attributeCode: text(entry.attributeCode),
      attributeName: text(entry.attributeName),
      attributeValueRef: readUuid(entry.attributeValueRef),
      valueCode: text(entry.valueCode),
      valueLabel: text(entry.valueLabel),
      displayOrder: integer(entry.displayOrder),
      status: text(entry.status),
    })),
    identifiers: decodeIdentifiers(row.identifiers),
    preparationOverride: decodePreparationOverride(row.preparationOverride),
    effectivePreparation: decodePreparationProfile(row.effectivePreparation),
    preparationSource: text(row.preparationSource) as CatalogSkuRow['preparationSource'],
    standardSalePrice: typeof row.standardSalePrice === 'number' ? row.standardSalePrice : null,
    isDefault: truth(row.isDefault),
    status: text(row.status),
    version: integer(row.version),
    mediaRefs: readUuidArray(row.mediaRefs),
    salesUnitOverrideRef: readOptionalUuid(row.salesUnitOverrideRef) ?? null,
    baseMeasureUnitOverrideRef: readOptionalUuid(row.baseMeasureUnitOverrideRef) ?? null,
    salesUnit: decodeUnitAssignment(row.salesUnit),
    baseMeasureUnit: decodeUnitAssignment(row.baseMeasureUnit),
    voidAvailability: (() => {
      const availability = asRecord(row.voidAvailability);
      return {
        canVoid: truth(availability?.canVoid),
        blockingReferences: recordArray(availability?.blockingReferences).map(entry => ({
          referenceKind: text(entry.referenceKind),
          referenceRef: readUuid(entry.referenceRef),
        })),
        dependentFacts: recordArray(availability?.dependentFacts).map(entry => ({
          factKind: text(entry.factKind),
          factRef: readUuid(entry.factRef),
        })),
      };
    })(),
  }));
}
function decodeUnitSnapshot(value: JsonValue | undefined): CatalogUnitSnapshot | null {
  const row = asRecord(value);
  if (!row) return null;
  return {
    unitRef: readUuid(row.unitRef),
    code: text(row.code),
    name: text(row.name),
    unitDimension: text(row.unitDimension) as CatalogUnitDimension,
    precision: integer(row.precision),
  };
}
function requireUnitSnapshot(value: JsonValue | undefined, label: string): CatalogUnitSnapshot {
  const snapshot = decodeUnitSnapshot(value);
  if (!snapshot) throw new Error(`INVALID_UNIT_SNAPSHOT:${label}`);
  return snapshot;
}
function decodeUnitAssignment(value: JsonValue | undefined): CatalogUnitAssignment | null {
  const snapshot = decodeUnitSnapshot(value);
  const row = asRecord(value);
  if (!snapshot || !row) return null;
  return {
    ...snapshot,
    status: text(row.status) as CatalogUnitAssignment['status'],
    inheritanceSource: text(row.inheritanceSource) as CatalogUnitAssignment['inheritanceSource'],
  };
}
function decodeCompositeGroups(value: JsonValue | undefined): CatalogCompositeGroup[] {
  return recordArray(value).map(row => ({
    groupCode: text(row.groupCode),
    groupName: text(row.groupName),
    selectionRule: text(row.selectionRule),
    minSelections: integer(row.minSelections),
    maxSelections: integer(row.maxSelections),
    displayOrder: integer(row.displayOrder),
    components: recordArray(row.components).map(entry => ({
      itemCode: text(entry.itemCode),
      itemRef: readUuid(entry.itemRef),
      productSkuRef: readOptionalUuid(entry.productSkuRef) ?? null,
      skuCode: optionalText(entry.skuCode) ?? null,
      quantity: text(entry.quantity),
      unit: text(entry.unit),
      default: truth(entry.default),
      extraPrice: typeof entry.extraPrice === 'number' ? entry.extraPrice : null,
      status: text(entry.status),
      displayOrder: integer(entry.displayOrder),
    })),
  }));
}
function decodeInventoryRules(value: JsonValue | undefined): CatalogInventoryRules {
  return {
    nodes: recordArray(asRecord(value)?.nodes).map(row => {
      const owner = asRecord(row.owner) ?? {};
      const direct = asRecord(row.directConfiguration);
      const bom = asRecord(row.bom);
      return {
        owner: {
          ownerType: text(owner.ownerType) as CatalogInventoryRuleOwner['ownerType'],
          itemRef: readUuid(owner.itemRef),
          productSkuRef: readOptionalUuid(owner.productSkuRef) ?? null,
          optionValueRef: readOptionalUuid(owner.optionValueRef) ?? null,
          itemCode: optionalText(owner.itemCode) ?? null,
          skuCode: optionalText(owner.skuCode) ?? null,
          optionValueCode: optionalText(owner.optionValueCode) ?? null,
        },
        itemCode: text(row.itemCode),
        itemName: text(row.itemName),
        skuCode: optionalText(row.skuCode) ?? null,
        optionValueCode: optionalText(row.optionValueCode) ?? null,
        allowedModes: textArray(row.allowedModes) as CatalogInventoryRuleMode[],
        defaultMode: text(row.defaultMode) as CatalogInventoryRuleMode,
        disabledReason: optionalText(row.disabledReason) ?? null,
        mode: text(row.mode) as CatalogInventoryRuleMode,
        directConfiguration: direct
          ? {
              targetRef: readOptionalUuid(direct.targetRef) ?? null,
              allowNegative: typeof direct.allowNegative === 'boolean' ? direct.allowNegative : null,
              lowStockThreshold:
                direct.lowStockThreshold === null ? null : (optionalText(direct.lowStockThreshold) ?? null),
              consumptionUnitSnapshot: decodeUnitSnapshot(direct.consumptionUnitSnapshot),
              countingUnitSnapshot: decodeUnitSnapshot(direct.countingUnitSnapshot),
              conversionFactor:
                direct.conversionFactor === null ? null : (optionalText(direct.conversionFactor) ?? null),
              version: optionalInteger(direct.version) ?? null,
            }
          : null,
        bom: bom
          ? {
              version: optionalInteger(bom.version) ?? null,
              lines: recordArray(bom.lines).map(line => ({
                targetRef: readUuid(line.targetRef),
                itemRef: readUuid(line.itemRef),
                productSkuRef: readOptionalUuid(line.productSkuRef) ?? null,
                itemCode: text(line.itemCode),
                skuCode: optionalText(line.skuCode) ?? null,
                itemName: text(line.itemName),
                skuName: optionalText(line.skuName) ?? null,
                lineSign: text(line.lineSign) as 'POSITIVE' | 'NEGATIVE',
                quantity: text(line.quantity),
                consumptionUnitSnapshot: requireUnitSnapshot(line.consumptionUnitSnapshot, 'inventory-rule-bom-line'),
              })),
            }
          : null,
      };
    }),
  };
}
function truth(value: JsonValue | undefined): boolean {
  return value === true;
}
function textArray(value: JsonValue | undefined): string[] {
  return Array.isArray(value) ? value.flatMap(entry => (typeof entry === 'string' ? [entry] : [])) : [];
}
