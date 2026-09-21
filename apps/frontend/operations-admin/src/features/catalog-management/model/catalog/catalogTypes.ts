import type {
  CatalogItemSaveRequest,
  CatalogItemSaveReadback,
  JsonValue,
  Uuid,
} from '../../../../app/api/generated/catalog-inventory-edge';

/** Lifecycle values are closed by the catalog owner and by the wire contract. */

export type CatalogLifecycleStatus = 'ENABLED' | 'DISABLED' | 'VOIDED';

/** Production tags are catalog-owned; this union prevents an old owner from re-entering UI read models. */
export type CatalogProductionTagOwner = 'catalog';

export type CatalogVoidBlockReasonCode =
  | 'HAS_SKUS'
  | 'HAS_IDENTIFIERS'
  | 'HAS_PRODUCTION_TAG'
  | 'USED_BY_OTHER_ITEM'
  | 'USED_BY_INVENTORY_BOM'
  | 'ALREADY_VOIDED'
  | 'USED_BY_PACKAGE';

export type CatalogCategoryPathNode = {categoryRef: Uuid; code: string; name: string};

export type CatalogTagFact = {tagRef: Uuid; code: string; name: string};

export type CatalogSpecificationFact = {
  attributeRef: Uuid;
  attributeCode: string;
  attributeName: string;
  values: Array<{
    valueRef: Uuid;
    valueCode: string;
    valueLabel: string;
    displayOrder: number;
    status: CatalogLifecycleStatus;
  }>;
};

export type CatalogBusinessReference = {
  referenceKind: string;
  referenceRef: Uuid;
  code: string;
  name: string;
  direction: string;
};

export type CatalogPreparationFacts = {
  productionTag: {
    tagRef: Uuid;
    code: string;
    name: string;
    status: CatalogLifecycleStatus;
    owner: CatalogProductionTagOwner;
  } | null;
  profile: CatalogPreparationProfile | null;
  skuVariation: {varies: boolean};
};

export type CatalogItemSummary = {
  itemRef: Uuid;
  code: string;
  name: string;
  shortName?: string;
  materialRole?: string;
  primaryImageAssetRef?: Uuid;
  categoryRef: Uuid | null;
  categoryPath: CatalogCategoryPathNode[];
  hasSkuChildren: boolean;
  productionTagRef: Uuid | null;
  tags: CatalogTagFact[];
  tagRefs: Uuid[];
  shapeKey: string;
  status: CatalogLifecycleStatus;
  source: string;
  skuEnabledCount: number;
  skuNonArchivedCount: number;
  skuTotalCount: number;
  specificationFacts: CatalogSpecificationFact[];
  orderOptionFacts: CatalogOrderOptionConfig[];
  attributeFacts: CatalogAttributeAssignmentReadback[];
  preparationFacts: CatalogPreparationFacts;
  standardSalePrice?: number;
  standardSalePriceMin?: number;
  standardSalePriceMax?: number;
  standardPriceDelta?: number;
  standardExtraPrice?: number;
  priceGranularity: string;
  salesUnit: CatalogUnitAssignment | null;
  baseMeasureUnit: CatalogUnitAssignment | null;
  inventoryDeductionSummary: CatalogInventoryDeductionSummary;
  version: number;
  updatedAt: number;
};

export type CatalogBatchUpdateKind = 'CATEGORY' | 'TAG';

export type CatalogBatchStatus = 'ENABLED' | 'DISABLED' | 'VOIDED';

export type CatalogBatchResult = {
  itemRef: Uuid;
  itemCode: string;
  outcome: 'SUCCEEDED' | 'FAILED';
  problemCode: string | null;
  reason: string | null;
  version: number | null;
};

export type CatalogDictionaryLabel = {entryRef: Uuid; name: string; status: CatalogLifecycleStatus};

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
    directCount: number;
    countSemantics: 'SELF_ONLY' | 'SELF_AND_DESCENDANTS';
    deletionAvailability: CatalogCategoryDeletionAvailability;
  }>;
  smartViews: Array<{viewKey: string; count: number}>;
  shapeCounts: Array<{shapeKey: string; count: number}>;
  /** Enabled catalog tags are a bounded navigation branch, with their matching item counts. */
  tags: Array<{tagRef: Uuid; code: string; name: string; count: number}>;
  /** Production tags are a separate item-level navigation branch; counts are distinct parent products. */
  productionTags: Array<{
    tagRef: Uuid;
    code: string;
    name: string;
    status: CatalogLifecycleStatus;
    owner: CatalogProductionTagOwner;
    count: number;
  }>;
  /** Optional until the navigation owner exposes the unclassified aggregate. */
  uncategorizedCount?: number;
  generation: number;
};

export type CatalogCategoryDeletionAvailability = {
  canDelete: boolean;
  subtreeSize: number;
  blockingReferenceCount: number;
  blockingReferences: {count: number; references: CatalogBusinessReference[]};
};

export type CatalogVoidAvailability = {
  canVoid: boolean;
  blockingReferences: Array<{referenceKind: string; referenceRef: Uuid}>;
  dependentFacts: Array<{factKind: string; factRef: Uuid}>;
  /** Owner-backed business facts that explain every disabled void action. */
  blockingReasons: Array<{
    reasonCode: CatalogVoidBlockReasonCode;
    count: number;
    relatedItemNames: string[];
  }>;
};

export type CatalogMediaLimits = {maxImageCount: number; maxImageBytes: number};

export type CatalogExternalIdentity = {
  sourceOrderRef?: string;
  sourceRecordRef?: string;
  sourceItemRef?: string;
  snapshot?: {name?: string; specification?: string; price?: number | null};
};

export type CatalogDetailItem = {
  itemRef: Uuid;
  code: string;
  name: string;
  shortName?: string;
  materialRole?: string;
  categoryRef: Uuid | null;
  categoryPath: CatalogCategoryPathNode[];
  /** The detail owner supplies the full path; the UI must never reconstruct it from the visible navigation tree. */
  productionTagRef: Uuid | null;
  tagRefs: Uuid[];
  shapeKey: string;
  itemKind: string;
  measureMode: string;
  usageCapabilities: string[];
  images: string[];
  primaryImageAssetRef?: Uuid;
  salesUnitRef: Uuid | null;
  baseMeasureUnitRef: Uuid | null;
  salesUnit: CatalogUnitAssignment | null;
  baseMeasureUnit: CatalogUnitAssignment | null;
  attributeAssignments: CatalogAttributeAssignmentReadback[];
  orderOptionConfigs: CatalogOrderOptionConfig[];
  identifiers: CatalogIdentifier[];
  skuVariantDimensions: CatalogSkuVariantDimension[];
  skus: CatalogSkuRow[];
  skuSummary: {enabledCount: number; nonArchivedCount: number; totalCount: number; dimensions: string[]};
  standardSalePrice?: number;
  priceGranularity: string;
  compositeGroups: CatalogCompositeGroup[];
  preparationProfile: CatalogPreparationProfile | null;
  specificationFacts: CatalogSpecificationFact[];
  orderOptionFacts: CatalogOrderOptionConfig[];
  attributeFacts: CatalogAttributeAssignmentReadback[];
  preparationFacts: CatalogPreparationFacts;
  lifecycle: {status: CatalogLifecycleStatus; version: number; source: string};
  source: string;
  externalIdentity: CatalogExternalIdentity;
  version: number;
  updatedAt: number;
};

export type CatalogDetail = {
  item: CatalogDetailItem;
  tabs: Array<{tabKey: string; visible: boolean; disabled: boolean; reason?: string}>;
  references: Array<{
    referenceKind: string;
    referenceRef: Uuid;
    code: string;
    name: string;
    direction: string;
  }>;
  inventoryRules: CatalogInventoryRules;
  productionTags: Array<{
    code: string;
    tagRef: Uuid;
    name: string;
    status: CatalogLifecycleStatus;
    owner: CatalogProductionTagOwner;
  }>;
  compositeGroups: CatalogCompositeGroup[];
  actionAvailability: {
    canEdit: boolean;
    canEnable: boolean;
    canDisable: boolean;
    voidAvailability?: CatalogVoidAvailability;
  };
  governance: {deniedFields: string[]; externalIdentity: CatalogExternalIdentity};
  deniedFields: string[];
  fieldOwnership: {catalog: string; inventory: string; asset: string};
  queryIdentity: {dataNodeRef: Uuid; generation: string};
};

export type CatalogAttributeAssignment = {
  definitionRef: Uuid;
  code: string;
  name: string;
  valueType: 'TEXT' | 'SINGLE_SELECT' | 'MULTI_SELECT';
  textValue: string | null;
  optionRefs: Uuid[];
  /** Present on owner readback; draft payloads intentionally omit this display-only projection. */
  selectedOptionNames?: string[];
};

export type CatalogAttributeAssignmentReadback = CatalogAttributeAssignment & {
  selectedOptionNames: string[];
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
  productionDisplayName: string | null;
  estimatedPreparationSeconds: number | null;
  preparationNotes: string | null;
};

export type CatalogPreparationEffect = {
  definitionValueRef: Uuid;
  optionGroupDisplayOrder: number;
  optionValueDisplayOrder: number;
  instruction: string | null;
  preparationSecondsDelta: number | null;
};

export type CatalogCompositeComponent = {
  itemCode: string;
  itemName: string;
  itemRef: Uuid;
  productSkuRef: Uuid | null;
  skuCode: string | null;
  skuName: string | null;
  quantity: string;
  unit: string;
  default: boolean;
  extraPrice: number | null;
  status: CatalogLifecycleStatus;
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

export type CatalogInventoryDeductionSummary = {
  grain: 'ITEM' | 'SKU';
  mode: CatalogInventoryRuleMode | null;
  consumptionUnitSnapshot: CatalogUnitSnapshot | null;
  bomLineCount: number | null;
};

export type CatalogSkuListRow = {
  productSkuRef: Uuid;
  skuCode: string;
  skuName: string;
  attributeValueRefs: Array<{
    attributeRef: Uuid;
    attributeCode: string;
    attributeName: string;
    attributeValueRef: Uuid;
    valueCode: string;
    valueLabel: string;
    displayOrder: number;
    status: CatalogLifecycleStatus;
  }>;
  standardSalePrice: number | null;
  salesUnit: CatalogUnitAssignment | null;
  baseMeasureUnit: CatalogUnitAssignment | null;
  isDefault: boolean;
  status: CatalogLifecycleStatus;
  primaryImageAssetRef: Uuid | null;
  inventoryDeductionSummary: CatalogInventoryDeductionSummary;
  attributeFacts: CatalogSkuAttributeValueRef[];
  preparationFacts: CatalogPreparationFacts;
  updatedAt: number;
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
      /** Local editor identity only; never serialized to the inventory owner. */
      editorId?: string;
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
  status: CatalogLifecycleStatus;
};

export type CatalogSkuVariantDimension = {
  attributeRef: Uuid;
  attributeCode: string;
  attributeName: string;
  values: Array<{
    valueRef: Uuid;
    valueCode: string;
    valueLabel: string;
    displayOrder: number;
    status: CatalogLifecycleStatus;
  }>;
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
  status: CatalogLifecycleStatus;
  version: number;
  updatedAt: number;
  mediaRefs: Uuid[];
  salesUnitOverrideRef: Uuid | null;
  baseMeasureUnitOverrideRef: Uuid | null;
  salesUnit: CatalogUnitAssignment | null;
  baseMeasureUnit: CatalogUnitAssignment | null;
  voidAvailability?: CatalogVoidAvailability;
};

export type CatalogSkuVoidReadback = Pick<
  CatalogItemSaveReadback['result']['skuTransitions'][number],
  'version' | 'canVoid' | 'blockingReferences' | 'dependentFacts' | 'blockingReasons'
>;

export type CatalogSkuVoidTransitionReadback = CatalogSkuVoidReadback & {
  skuRef: Uuid;
  targetStatus: 'VOIDED';
};

export type CatalogSkuIssueCode = 'MISSING_CODE' | 'MISSING_NAME' | 'DUPLICATE_CODE' | 'DUPLICATE_COMBINATION';

export type CatalogSkuSaveRow = NonNullable<
  NonNullable<CatalogItemSaveRequest['sections']['catalogDraft']['skus']>[number]
>;

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

export type CopyCandidate = {
  code: string;
  name: string;
  shapeKey: string;
  status: CatalogLifecycleStatus;
  version: number;
};

export type BrandCopyScope = {ownerType: string; ownerRef: Uuid; brandRef: Uuid};

export type CatalogCopyReferenceMapping = {
  objectType: string;
  targetCode: string;
  targetSkuCode?: string;
  targetOptionValueCode?: string;
};

export type BrandCopyReadback = {
  preflightDigest: string;
  created: Array<{objectType: string; code: string}>;
  reused: Array<{objectType: string; code: string}>;
  referenceMappings: CatalogCopyReferenceMapping[];
  targetVersions: Array<{version: number}>;
  ownerReadbacks: Array<{owner: string; status: string; version: number}>;
};

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
    reasonCode: string;
  }>;
  objectVersions: Array<Record<string, JsonValue>>;
};

export type BrandCopyCompatibilityBuckets = {
  inventory: CopyPreflight['compatibilityResults'];
  production: CopyPreflight['compatibilityResults'];
  other: CopyPreflight['compatibilityResults'];
};

export type CatalogDataEnvelope<T = unknown> = {data?: T};
