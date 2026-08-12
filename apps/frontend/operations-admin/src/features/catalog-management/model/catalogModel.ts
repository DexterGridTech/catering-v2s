import type {
  CatalogInventoryEnvelope,
  JsonValue,
  LocalCopyCandidatePage,
  LocalCopyPreflight,
  LocalCopyReadback,
} from '../../../app/api/generated/catalog-inventory-edge';

export type CatalogItemSummary = {
  itemRef: string;
  code: string;
  name: string;
  shortName?: string;
  primaryImageAssetRef?: string;
  categoryRefs: string[];
  productionTagRefs: string[];
  shapeKey: string;
  status: string;
  governanceStatus: string;
  source: string;
  skuEnabledCount: number;
  skuNonArchivedCount: number;
  skuTotalCount: number;
  skuDimensionSummary: string[];
  standardSalePrice?: number;
  listedSalePrice?: number;
  standardPriceDelta?: number;
  standardExtraPrice?: number;
  priceGranularity: string;
  missingPriceCount: number;
  stockTargetCount: number;
  bomCount: number;
  riskFlags: string[];
  version: number;
  updatedAt: number;
};

export type CatalogNavigation = {
  tree: Array<{
    categoryRef: string;
    code: string;
    name: string;
    parentCategoryRef: string | null;
    version: number;
    displayOrder: number;
    count: number;
    countSemantics: 'SELF_ONLY' | 'SELF_AND_DESCENDANTS';
    deletionAvailability: CatalogCategoryDeletionAvailability;
  }>;
  smartViews: Array<{viewKey: string; count: number}>;
  shapeCounts: Array<{shapeKey: string; count: number}>;
  /** Optional until the navigation owner exposes the unclassified aggregate. */
  uncategorizedCount?: number;
  generation: number;
};

export type CatalogCategoryDeletionAvailability = {
  canDelete: boolean;
  subtreeSize: number;
  blockingReferenceCount: number;
  blockingReferenceLabels: string[];
};

export type CatalogVoidAvailability = {
  canVoid: boolean;
  blockingReferences: Array<{referenceKind: string; referenceRef: string}>;
  dependentFacts: Array<{factKind: string; factRef: string}>;
};

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
    attributes: Record<string, JsonValue>;
    identifiers: Array<{kind: string; code: string; value: string}>;
    skuVariantDimensions: CatalogSkuVariantDimension[];
    skus: CatalogSkuRow[];
    ordering: {priceGranularity: 'ITEM' | 'SKU'; standardSalePrice: number | null; listedSalePrice: number | null; missingPriceCount: number};
    skuSummary: {enabledCount: number; nonArchivedCount: number; totalCount: number; dimensions: string[]};
    orderOptions: CatalogOrderOptionGroup[];
    compositeGroups: CatalogCompositeGroup[];
    inventoryBom: CatalogInventoryBomEntry[];
    productionProfiles: {item: Record<string, JsonValue>; sku: Record<string, JsonValue>; optionValue: Record<string, JsonValue>};
    lifecycle: {status: string; version: number; source: string};
    externalIdentity: CatalogExternalIdentity;
  };
  tabs: Array<{tabKey: string; visible: boolean; disabled: boolean; reason?: string}>;
  references: Array<{referenceKind: string; code: string; direction: string}>;
  inventoryBom: CatalogInventoryBomEntry[];
  productionTags: Array<{code: string; tagRef: string; name: string; owner: string}>;
  orderOptions: CatalogOrderOptionGroup[];
  compositeGroups: CatalogCompositeGroup[];
  actionAvailability: {canEdit: boolean; canEnable: boolean; canDisable: boolean; canArchive: boolean; voidAvailability?: CatalogVoidAvailability};
  governance: {status: string; deniedFields: string[]; externalIdentity: CatalogExternalIdentity};
  deniedFields: string[];
  fieldOwnership: {catalog: string; inventory: string; asset: string};
  queryIdentity: {dataNodeRef: string; generation: string};
};

export type CatalogOrderOptionValue = {code: string; attributeValueRef: string; name: string; default: boolean; extraPrice: number | null; productionEffects: string[]};
export type CatalogOrderOptionGroup = {groupCode: string; groupName: string; selectionMode: string; required: boolean; values: CatalogOrderOptionValue[]};
export type CatalogCompositeComponent = {itemCode: string; itemRef: string; productSkuRef: string | null; skuCode: string | null; quantity: string; unit: string; default: boolean; extraPrice: number | null; status: string};
export type CatalogCompositeGroup = {groupCode: string; groupName: string; selectionRule: string; components: CatalogCompositeComponent[]};
export type CatalogInventoryConfiguration = {
  allowNegative?: boolean;
  lowStockThreshold?: string | null;
  countingUnit?: string;
  conversionFactor?: string;
};
export type CatalogInventoryBomEntry = {
  nodeType: string;
  mode: string;
  targetRef: string;
  quantity: string;
  unit: string;
  itemCode?: string;
  itemRef?: string;
  productSkuRef?: string | null;
  skuCode?: string | null;
  optionValueRef?: string | null;
  optionValueCode?: string | null;
  version?: number;
  lineSign?: string;
  consumptionUnit?: string;
  configuration?: CatalogInventoryConfiguration;
};
export type CatalogSkuAttributeValueRef = {attributeRef: string; attributeCode: string; attributeName: string; attributeValueRef: string; valueCode: string; valueLabel: string; displayOrder: number; status: string};
export type CatalogSkuVariantDimension = {attributeRef: string; attributeCode: string; attributeName: string; values: Array<{valueRef: string; valueCode: string; valueLabel: string; displayOrder: number; status: string}>};
export type CatalogSkuRow = {productSkuRef: string; skuCode: string; skuName: string; attributeValueRefs: CatalogSkuAttributeValueRef[]; skuBarcode: string; standardSalePrice: number | null; isDefault: boolean; status: string; version: number; mediaRefs: string[]};

export type CatalogWorkbenchContext = {
  ownerType: string;
  ownerRef: string;
  brandRef: string;
  scopeName: string;
  scopeCode: string;
  headCompanyRef?: string;
  copySourceAvailable: boolean;
  actionAvailability: {canCreate: boolean; canEdit: boolean; canCopy: boolean; reasons: string[]};
};

export type CopyCandidate = {code: string; name: string; shapeKey: string; status: string; version: number};
export type BrandCopyScope = {ownerType: string; ownerRef: string; brandRef: string};
export type CatalogCopyReferenceMapping = {objectType: string; targetCode: string; targetSkuCode?: string; targetOptionValueCode?: string};
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
  'SALES_UNIT',
  'SKU_ATTRIBUTE',
  'SKU_ATTRIBUTE_VALUE',
]);

export function catalogCopyVersionRows(rows: Array<Record<string, JsonValue>>) {
  return rows.filter((row) => CATALOG_COPY_OBJECT_TYPES.has(String(row.objectType ?? '')));
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
  compatibilityResults: Array<{objectType: string; result: string; reason: string}>;
  objectVersions: Array<Record<string, JsonValue>>;
};

/**
 * These values are the catalog-owner section keys from the generated local-copy
 * contract. Keep the labels here so every local-copy surface renders the same
 * capability vocabulary instead of deriving it from route or journey names.
 */
export const LOCAL_COPY_SCOPE_OPTIONS = [
  {value: 'BASIC_INFO', label: '基础资料'},
  {value: 'SKU_STRUCTURE', label: 'SKU结构'},
  {value: 'SKU_BOM', label: 'SKU BOM'},
  {value: 'ORDER_OPTIONS', label: '点单选项'},
  {value: 'OPTION_VALUE_BOM', label: '选项值 BOM'},
  {value: 'ITEM_BOM', label: '商品 BOM'},
  {value: 'PACKAGE_STRUCTURE', label: '套餐结构'},
  {value: 'PRODUCTION_PROMPTS', label: '生产提示'},
  {value: 'PRINT_NAME', label: '打印展示名'},
] as const;

export type LocalCopyScope = (typeof LOCAL_COPY_SCOPE_OPTIONS)[number]['value'];
export type LocalCopyCandidatePageData = LocalCopyCandidatePage['data'];
export type LocalCopyPreflightData = LocalCopyPreflight['data'];
export type LocalCopyReadbackData = LocalCopyReadback['data'];
type CatalogDataEnvelope<T = unknown> = {data?: T};

export function decodeLocalCopyCandidatePage(
  response: LocalCopyCandidatePage | undefined,
): LocalCopyCandidatePageData | undefined {
  return response?.data;
}

export function decodeLocalCopyPreflight(
  response: LocalCopyPreflight | undefined,
): LocalCopyPreflightData | undefined {
  const value = response?.data;
  return value?.preflightDigest ? value : undefined;
}

export function decodeLocalCopyReadback(
  response: LocalCopyReadback | undefined,
): LocalCopyReadbackData | undefined {
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
    ownerType: text(value.ownerType), ownerRef: text(value.ownerRef), brandRef: text(value.brandRef),
    scopeName: text(value.scopeName), scopeCode: text(value.scopeCode), headCompanyRef: optionalText(value.headCompanyRef),
    copySourceAvailable: truth(value.copySourceAvailable),
    actionAvailability: {canCreate: truth(availability.canCreate), canEdit: truth(availability.canEdit), canCopy: truth(availability.canCopy), reasons: textArray(availability.reasons)},
  };
}

export function decodeNavigation(envelope: CatalogDataEnvelope | undefined): CatalogNavigation {
  const value = envelopeData(envelope) ?? {};
  return {
    tree: recordArray(value.tree).map((row) => {
      const deletion = asRecord(row.deletionAvailability) ?? {};
      return {
        categoryRef: text(row.categoryRef),
        code: text(row.code),
        name: text(row.name),
        parentCategoryRef: row.parentCategoryRef === null ? null : optionalText(row.parentCategoryRef) ?? null,
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
    smartViews: recordArray(value.smartViews).map((row) => ({viewKey: text(row.viewKey), count: integer(row.count)})),
    shapeCounts: recordArray(value.shapeCounts).map((row) => ({shapeKey: text(row.shapeKey), count: integer(row.count)})),
    uncategorizedCount: optionalInteger(value.uncategorizedCount),
    generation: integer(value.generation),
  };
}

export function decodeItems(envelope: CatalogDataEnvelope | undefined) {
  const value = envelopeData(envelope) ?? {};
  return {items: recordArray(value.items).map(decodeItemSummary), total: integer(value.total), cursor: text(value.cursor), generation: integer(value.generation), queryGeneration: text(value.queryGeneration)};
}

export function decodeDetail(envelope: CatalogDataEnvelope | undefined): CatalogDetail | undefined {
  const root = envelopeData(envelope);
  const item = asRecord(root?.item);
  if (!root || !item) return undefined;
  const action = asRecord(root.actionAvailability) ?? {};
  const governance = asRecord(root.governance) ?? {};
  const rootOrderOptions = decodeOrderOptions(root.orderOptions);
  const rootCompositeGroups = decodeCompositeGroups(root.compositeGroups);
  const rootInventoryBom = decodeInventoryBom(root.inventoryBom);
  const itemOrderOptions = decodeOrderOptions(item.orderOptions);
  const itemCompositeGroups = decodeCompositeGroups(item.compositeGroups);
  const itemInventoryBom = decodeInventoryBom(item.inventoryBom);
  const itemSkuDimensions = decodeSkuVariantDimensions(item.skuVariantDimensions);
  const itemSkus = decodeSkuRows(item.skus);
  const skuSummary = decodeSkuSummary(item.skuSummary);
  const lifecycle = asRecord(item.lifecycle) ?? {};
  const itemExternalIdentity = decodeExternalIdentity(item.externalIdentity);
  const decodedGovernanceExternalIdentity = decodeExternalIdentity(governance.externalIdentity);
  const governanceExternalIdentity = Object.keys(decodedGovernanceExternalIdentity).length > 0 ? decodedGovernanceExternalIdentity : itemExternalIdentity;
  const voidAvailability = asRecord(action.voidAvailability);
  const voidFacts = voidAvailability ? {
    canVoid: truth(voidAvailability.canVoid),
    blockingReferences: recordArray(voidAvailability.blockingReferences).map((entry) => ({referenceKind: text(entry.referenceKind), referenceRef: text(entry.referenceRef)})),
    dependentFacts: recordArray(voidAvailability.dependentFacts).map((entry) => ({factKind: text(entry.factKind), factRef: text(entry.factRef)})),
  } : undefined;
  return {
    item: {...decodeItemSummary(item), skuEnabledCount: skuSummary.enabledCount, skuNonArchivedCount: skuSummary.nonArchivedCount, skuTotalCount: skuSummary.totalCount, itemKind: text(item.itemKind), measureMode: text(item.measureMode), usageCapabilities: textArray(item.usageCapabilities), images: textArray(item.images), attributes: asRecord(item.attributes) ?? {}, identifiers: recordArray(item.identifiers).map((row) => ({kind: text(row.kind), code: text(row.code), value: text(row.value)})), skuVariantDimensions: itemSkuDimensions, skus: itemSkus, skuSummary, ordering: decodeOrdering(item.ordering), orderOptions: itemOrderOptions.length ? itemOrderOptions : rootOrderOptions, compositeGroups: itemCompositeGroups.length ? itemCompositeGroups : rootCompositeGroups, inventoryBom: itemInventoryBom.length ? itemInventoryBom : rootInventoryBom, productionProfiles: {item: asRecord(asRecord(item.productionProfiles)?.item) ?? {}, sku: asRecord(asRecord(item.productionProfiles)?.sku) ?? {}, optionValue: asRecord(asRecord(item.productionProfiles)?.optionValue) ?? {}}, lifecycle: {status: text(lifecycle.status) || text(item.status), version: integer(lifecycle.version) || integer(item.version), source: text(lifecycle.source) || text(item.source)}, externalIdentity: itemExternalIdentity},
    tabs: recordArray(root.tabs).map((row) => ({tabKey: text(row.tabKey), visible: truth(row.visible), disabled: truth(row.disabled), reason: optionalText(row.reason)})),
    references: recordArray(root.references).map((row) => ({referenceKind: text(row.referenceKind), code: text(row.code), direction: text(row.direction)})),
    inventoryBom: rootInventoryBom,
    productionTags: recordArray(root.productionTags).map((row) => ({code: text(row.code), tagRef: text(row.tagRef), name: text(row.name), owner: text(row.owner)})),
    orderOptions: rootOrderOptions.length ? rootOrderOptions : itemOrderOptions,
    compositeGroups: rootCompositeGroups.length ? rootCompositeGroups : itemCompositeGroups,
    actionAvailability: {canEdit: truth(action.canEdit), canEnable: truth(action.canEnable), canDisable: truth(action.canDisable), canArchive: truth(action.canArchive), ...(voidFacts ? {voidAvailability: voidFacts} : {})},
    governance: {status: text(governance.status), deniedFields: textArray(governance.deniedFields), externalIdentity: governanceExternalIdentity},
    deniedFields: textArray(root.deniedFields),
    fieldOwnership: {catalog: text(asRecord(root.fieldOwnership)?.catalog), inventory: text(asRecord(root.fieldOwnership)?.inventory), asset: text(asRecord(root.fieldOwnership)?.asset)},
    queryIdentity: {dataNodeRef: text(asRecord(root.queryIdentity)?.dataNodeRef), generation: text(asRecord(root.queryIdentity)?.generation)},
  };
}

export function decodeCandidates(envelope: CatalogInventoryEnvelope | undefined): CopyCandidate[] {
  const value = envelopeData(envelope);
  const page = asRecord(value?.data) ?? value;
  return recordArray(page?.items).map((row) => ({code: text(row.code), name: text(row.name), shapeKey: text(row.shapeKey), status: text(row.status), version: integer(row.version)}));
}

export function decodeBrandCopyScopes(envelope: CatalogInventoryEnvelope | undefined): {sourceScope?: BrandCopyScope; targetScope?: BrandCopyScope; copySourceAvailable: boolean} {
  const root = envelopeData(envelope);
  const page = asRecord(root?.data) ?? root;
  const source = asRecord(page?.sourceScope);
  const target = asRecord(page?.targetScope);
  return {
    sourceScope: source ? {ownerType: text(source.ownerType), ownerRef: text(source.ownerRef), brandRef: text(source.brandRef)} : undefined,
    targetScope: target ? {ownerType: text(target.ownerType), ownerRef: text(target.ownerRef), brandRef: text(target.brandRef)} : undefined,
    copySourceAvailable: truth(page?.copySourceAvailable),
  };
}

export function decodeBrandCopyReadback(envelope: CatalogInventoryEnvelope | undefined): BrandCopyReadback | undefined {
  const root = envelopeData(envelope) ?? asRecord(envelope?.result);
  const value = asRecord(root?.data) ?? root;
  if (!value?.preflightDigest) return undefined;
  return {
    preflightDigest: text(value.preflightDigest),
    created: recordArray(value.created).map((row) => ({objectType: text(row.objectType), code: text(row.code)})),
    reused: recordArray(value.reused).map((row) => ({objectType: text(row.objectType), code: text(row.code)})),
    referenceMappings: referenceMappings(value.referenceMappings),
    targetVersions: recordArray(value.targetVersions).map((row) => ({version: integer(row.version)})),
    ownerReadbacks: recordArray(value.ownerReadbacks).map((row) => ({owner: text(row.owner), status: text(row.status), version: integer(row.version)})),
  };
}

export function decodePreflight(envelope: CatalogInventoryEnvelope | undefined): CopyPreflight | undefined {
  const root = envelopeData(envelope) ?? asRecord(envelope?.result);
  const value = asRecord(root?.data) ?? root;
  if (!value?.preflightDigest) return undefined;
  return {
    selectedCount: integer(value.selectedCount),
    selectedLimit: integer(value.selectedLimit),
    closureCount: integer(value.closureCount),
    closureLimit: integer(value.closureLimit),
    preflightDigest: text(value.preflightDigest),
    blockingCount: integer(value.blockingCount),
    confirmationRequiredCount: integer(value.confirmationRequiredCount),
    selectedItems: recordArray(value.selectedItems).map((row) => ({objectType: text(row.objectType), code: text(row.code), name: text(row.name)})),
    closureItems: recordArray(value.closureItems).map((row) => ({objectType: text(row.objectType), code: text(row.code), name: text(row.name), action: text(row.action)})),
    referenceMappings: referenceMappings(value.referenceMappings),
    compatibilityResults: recordArray(value.compatibilityResults).map((row) => ({objectType: text(row.objectType), result: text(row.result), reason: text(row.reason)})),
    objectVersions: recordArray(value.objectVersions),
  };
}

function referenceMappings(value: JsonValue | undefined): CatalogCopyReferenceMapping[] {
  return recordArray(value).map((row) => ({
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
  const summary: CatalogItemSummary = {itemRef: text(row.itemRef), code: text(row.code), name: text(row.name), shortName: optionalText(row.shortName), categoryRefs: textArray(row.categoryRefs), productionTagRefs: textArray(row.productionTagRefs), shapeKey: text(row.shapeKey), status: text(row.status), governanceStatus: text(row.governanceStatus), source: text(row.source), skuEnabledCount: integer(row.skuEnabledCount), skuNonArchivedCount: integer(row.skuNonArchivedCount), skuTotalCount: integer(row.skuTotalCount), skuDimensionSummary: textArray(row.skuDimensionSummary), standardSalePrice: optionalNumber(row.standardSalePrice), listedSalePrice: optionalNumber(row.listedSalePrice), standardPriceDelta: optionalNumber(row.standardPriceDelta), standardExtraPrice: optionalNumber(row.standardExtraPrice), priceGranularity: text(row.priceGranularity), missingPriceCount: integer(row.missingPriceCount), stockTargetCount: integer(row.stockTargetCount), bomCount: integer(row.bomCount), riskFlags: textArray(row.riskFlags), version: integer(row.version), updatedAt: integer(row.updatedAt)};
  const primaryImageAssetRef = optionalText(row.primaryImageAssetRef);
  if (primaryImageAssetRef) summary.primaryImageAssetRef = primaryImageAssetRef;
  return summary;
}

export function asRecord(value: unknown): Record<string, JsonValue> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, JsonValue> : undefined;
}
export function recordArray(value: JsonValue | undefined): Array<Record<string, JsonValue>> { return Array.isArray(value) ? value.flatMap((entry) => asRecord(entry) ? [asRecord(entry)!] : []) : []; }
export function text(value: JsonValue | undefined): string { return typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value); }
function optionalText(value: JsonValue | undefined): string | undefined { const result = text(value).trim(); return result || undefined; }
function integer(value: JsonValue | undefined): number { return typeof value === 'number' && Number.isFinite(value) ? value : 0; }
function optionalInteger(value: JsonValue | undefined): number | undefined { return typeof value === 'number' && Number.isFinite(value) ? value : undefined; }
function optionalNumber(value: JsonValue | undefined): number | undefined { return typeof value === 'number' && Number.isFinite(value) ? value : undefined; }
function decodeOrdering(value: JsonValue | undefined): CatalogDetail['item']['ordering'] { const row = asRecord(value) ?? {}; return {priceGranularity: row.priceGranularity === 'SKU' ? 'SKU' : 'ITEM', standardSalePrice: typeof row.standardSalePrice === 'number' ? row.standardSalePrice : null, listedSalePrice: typeof row.listedSalePrice === 'number' ? row.listedSalePrice : null, missingPriceCount: integer(row.missingPriceCount)}; }
function decodeSkuSummary(value: JsonValue | undefined): CatalogDetail['item']['skuSummary'] { const row = asRecord(value) ?? {}; return {enabledCount: integer(row.enabledCount), nonArchivedCount: integer(row.nonArchivedCount), totalCount: integer(row.totalCount), dimensions: textArray(row.dimensions)}; }
function decodeExternalIdentity(value: JsonValue | undefined): CatalogExternalIdentity {
  const row = asRecord(value);
  if (!row) return {};
  const snapshot = asRecord(row.snapshot);
  return {
    sourceOrderRef: optionalText(row.sourceOrderRef),
    sourceRecordRef: optionalText(row.sourceRecordRef),
    sourceItemRef: optionalText(row.sourceItemRef),
    ...(snapshot ? {snapshot: {name: optionalText(snapshot.name), specification: optionalText(snapshot.specification), price: snapshot.price === null ? null : optionalNumber(snapshot.price)}} : {}),
  };
}
function decodeSkuVariantDimensions(value: JsonValue | undefined): CatalogSkuVariantDimension[] {
  return recordArray(value).map((row) => ({
    attributeRef: text(row.attributeRef), attributeCode: text(row.attributeCode), attributeName: text(row.attributeName),
    values: recordArray(row.values).map((entry) => ({valueRef: text(entry.valueRef), valueCode: text(entry.valueCode), valueLabel: text(entry.valueLabel), displayOrder: integer(entry.displayOrder), status: text(entry.status)})),
  }));
}
function decodeSkuRows(value: JsonValue | undefined): CatalogSkuRow[] {
  return recordArray(value).map((row) => ({
    productSkuRef: text(row.productSkuRef), skuCode: text(row.skuCode), skuName: text(row.skuName),
    attributeValueRefs: recordArray(row.attributeValueRefs).map((entry) => ({attributeRef: text(entry.attributeRef), attributeCode: text(entry.attributeCode), attributeName: text(entry.attributeName), attributeValueRef: text(entry.attributeValueRef), valueCode: text(entry.valueCode), valueLabel: text(entry.valueLabel), displayOrder: integer(entry.displayOrder), status: text(entry.status)})),
    skuBarcode: text(row.skuBarcode), standardSalePrice: typeof row.standardSalePrice === 'number' ? row.standardSalePrice : null, isDefault: truth(row.isDefault), status: text(row.status), version: integer(row.version), mediaRefs: textArray(row.mediaRefs),
  }));
}
function decodeOrderOptions(value: JsonValue | undefined): CatalogOrderOptionGroup[] {
  return recordArray(value).map((row) => ({
    groupCode: text(row.groupCode), groupName: text(row.groupName), selectionMode: text(row.selectionMode), required: truth(row.required),
    values: recordArray(row.values).map((entry) => ({code: text(entry.code), attributeValueRef: text(entry.attributeValueRef), name: text(entry.name), default: truth(entry.default), extraPrice: typeof entry.extraPrice === 'number' ? entry.extraPrice : null, productionEffects: textArray(entry.productionEffects)})),
  }));
}
function decodeCompositeGroups(value: JsonValue | undefined): CatalogCompositeGroup[] {
  return recordArray(value).map((row) => ({
    groupCode: text(row.groupCode), groupName: text(row.groupName), selectionRule: text(row.selectionRule),
    components: recordArray(row.components).map((entry) => ({itemCode: text(entry.itemCode), itemRef: text(entry.itemRef), productSkuRef: optionalText(entry.productSkuRef) ?? null, skuCode: optionalText(entry.skuCode) ?? null, quantity: text(entry.quantity), unit: text(entry.unit), default: truth(entry.default), extraPrice: typeof entry.extraPrice === 'number' ? entry.extraPrice : null, status: text(entry.status)})),
  }));
}
function decodeInventoryBom(value: JsonValue | undefined): CatalogInventoryBomEntry[] {
  return recordArray(value).map((row) => {
    const entry: CatalogInventoryBomEntry = {
      nodeType: text(row.nodeType), mode: text(row.mode), targetRef: text(row.targetRef),
      quantity: text(row.quantity), unit: text(row.unit), itemCode: optionalText(row.itemCode), itemRef: optionalText(row.itemRef), productSkuRef: optionalText(row.productSkuRef) ?? null,
      skuCode: optionalText(row.skuCode) ?? null, optionValueRef: optionalText(row.optionValueRef) ?? null, version: optionalInteger(row.version), optionValueCode: optionalText(row.optionValueCode) ?? null,
      lineSign: optionalText(row.lineSign), consumptionUnit: optionalText(row.consumptionUnit),
    };
    const configuration = asRecord(row.configuration);
    if (configuration) entry.configuration = {
      allowNegative: typeof configuration.allowNegative === 'boolean' ? configuration.allowNegative : undefined,
      lowStockThreshold: configuration.lowStockThreshold === null ? null : optionalText(configuration.lowStockThreshold),
      countingUnit: optionalText(configuration.countingUnit), conversionFactor: optionalText(configuration.conversionFactor),
    };
    return entry;
  });
}
function truth(value: JsonValue | undefined): boolean { return value === true; }
function textArray(value: JsonValue | undefined): string[] { return Array.isArray(value) ? value.flatMap((entry) => typeof entry === 'string' ? [entry] : []) : []; }
