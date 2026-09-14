import type {
  CatalogInventoryEnvelope,
  CatalogItemBatchStatusTransitionReadback,
  CatalogItemBatchStatusTransitionRequest,
  CatalogItemSaveRequest,
  JsonValue,
  Uuid,
} from '../../../../app/api/generated/catalog-inventory-edge';
import {catalogLifecycleStatus} from './catalogLifecycle';
import type {
  CatalogBatchResult,
  CatalogBatchStatus,
  CatalogBatchUpdateKind,
  CatalogDataEnvelope,
  CatalogDetail,
  CatalogInventoryRuleDraftNode,
  CatalogInventoryRuleNode,
  CatalogItemSummary,
  CatalogNavigation,
  CatalogOrderOptionConfig,
  CatalogSkuIssueCode,
  CatalogSkuListRow,
  CatalogSkuRow,
  CatalogSkuSaveRow,
  CatalogSkuVariantDimension,
  CatalogSkuVoidReadback,
  CatalogSkuVoidTransitionReadback,
  CatalogVoidAvailability,
  CatalogWorkbenchContext,
} from './catalogTypes';
import {
  asRecord,
  decodeAttributeAssignmentReadback,
  decodeCatalogVoidAvailability,
  decodeCompositeGroups,
  decodeExternalIdentity,
  decodeIdentifiers,
  decodeInventoryDeductionSummary,
  decodeInventoryRules,
  decodePreparationEffect,
  decodePreparationProfile,
  decodeSkuRows,
  decodeSkuSummary,
  decodeSkuVariantDimensions,
  decodeUnitAssignment,
  envelopeData,
  integer,
  optionalInteger,
  optionalNumber,
  optionalText,
  readOptionalUuid,
  readUuid,
  readUuidArray,
  recordArray,
  requireCatalogTags,
  requireCategoryPath,
  requireOrderOptionFacts,
  requirePreparationFacts,
  requireSpecificationFacts,
  requiredRecordArray,
  text,
  textArray,
  truth,
} from './catalogValidation';

type CatalogBatchCatalogDraft = Partial<
  Pick<CatalogItemSaveRequest['sections']['catalogDraft'], 'categoryRef' | 'tagRefs'>
>;

export function catalogDetailImageRefs(item: Pick<CatalogDetail['item'], 'images' | 'primaryImageAssetRef'>): string[] {
  return item.images.length > 0 ? item.images : item.primaryImageAssetRef ? [item.primaryImageAssetRef] : [];
}

export function shouldHydrateCatalogItemDraft(input: {
  initializedItemCode?: string;
  detailItemCode: string;
  dirty: boolean;
  forceHydrate: boolean;
}): boolean {
  const {initializedItemCode, detailItemCode, forceHydrate} = input;
  // Hydration establishes a draft once for a newly opened item.  A clean
  // draft is not an invitation to replace it again on every render: that
  // would make a section with controlled inputs continuously recreate its
  // state.  A deliberately refreshed server fact is represented explicitly
  // by forceHydrate (after a save or a shell-driven content refresh).
  return forceHydrate || initializedItemCode !== detailItemCode;
}

export function requireCatalogSkuVoidTransitionReadback(
  candidateReadbacks: unknown,
  requestedSkuRef: Uuid,
): CatalogSkuVoidTransitionReadback {
  if (!Array.isArray(candidateReadbacks)) throw new Error('INVALID_CATALOG_SKU_VOID_TRANSITION_READBACK');
  const matches = candidateReadbacks
    .map(asRecord)
    .filter((candidate): candidate is Record<string, JsonValue> => candidate?.skuRef === requestedSkuRef);
  if (matches.length !== 1) throw new Error('INVALID_CATALOG_SKU_VOID_TRANSITION_READBACK');
  const match = matches[0];
  if (match.targetStatus !== 'VOIDED') throw new Error('INVALID_CATALOG_SKU_VOID_TRANSITION_READBACK');
  const version = integer(match.version);
  if (version < 0) throw new Error('INVALID_CATALOG_SKU_VOID_TRANSITION_READBACK');
  let availability: CatalogVoidAvailability;
  try {
    availability = decodeCatalogVoidAvailability({
      canVoid: match.canVoid,
      blockingReferences: match.blockingReferences,
      dependentFacts: match.dependentFacts,
      blockingReasons: match.blockingReasons,
    });
  } catch {
    throw new Error('INVALID_CATALOG_SKU_VOID_TRANSITION_READBACK');
  }
  if (availability.canVoid) throw new Error('INVALID_CATALOG_SKU_VOID_TRANSITION_READBACK');
  return {
    skuRef: requestedSkuRef,
    targetStatus: 'VOIDED',
    version,
    ...availability,
  };
}

export function mergeCatalogSkuVoidReadback(
  rows: CatalogSkuRow[],
  skuRef: Uuid,
  readback: CatalogSkuVoidReadback,
): CatalogSkuRow[] {
  return rows.map(row => {
    if (row.productSkuRef !== skuRef) return row;
    return {
      ...row,
      status: 'VOIDED',
      version: readback.version,
      voidAvailability: {
        canVoid: readback.canVoid,
        blockingReferences: readback.blockingReferences.map(entry => ({...entry})),
        dependentFacts: readback.dependentFacts.map(entry => ({...entry})),
        blockingReasons: readback.blockingReasons.map(entry => ({
          ...entry,
          relatedItemNames: [...entry.relatedItemNames],
        })),
      },
    };
  });
}

export function buildCatalogSkuVoidRequest(
  item: CatalogDetail['item'],
  dataNodeRef: Uuid,
  itemCode: string,
  sku: Pick<CatalogSkuRow, 'productSkuRef' | 'version'>,
): CatalogItemSaveRequest {
  return {
    dataNodeRef,
    itemCode,
    skuTransitions: [{skuRef: sku.productSkuRef, targetStatus: 'VOIDED', expectedVersion: sku.version}],
    sections: {
      catalogDraft: {
        name: item.name,
        shapeKey: item.shapeKey,
        images: [...item.images],
        productionTagRef: item.productionTagRef ?? null,
        categoryRef: item.categoryRef ?? null,
      },
      expectedCatalogVersion: item.version,
      inventoryRules: {nodes: []},
    },
  };
}

export function catalogSkuIssueCodes(
  sku: CatalogSkuRow,
  _priceGranularity: string,
  duplicateCombination: boolean,
  duplicateCode = false,
): CatalogSkuIssueCode[] {
  return [
    !sku.skuCode.trim() ? 'MISSING_CODE' : undefined,
    !sku.skuName.trim() ? 'MISSING_NAME' : undefined,
    duplicateCode && Boolean(sku.skuCode.trim()) ? 'DUPLICATE_CODE' : undefined,
    duplicateCombination ? 'DUPLICATE_COMBINATION' : undefined,
  ].filter((issue): issue is CatalogSkuIssueCode => Boolean(issue));
}

export function productionTagReadbackIsComplete(
  readback: {tagRef?: string; code?: string; name?: string; status?: string} | undefined,
): boolean {
  return Boolean(readback?.tagRef && readback.code && readback.name && readback.status);
}

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
      (outcome === 'FAILED' && (problemCode === null || version !== null))
    ) {
      invalid();
    }
    // The typed problem code is authoritative for failure copy.  A missing
    // explanatory reason remains a valid failed receipt; the view projects a
    // stable known-code copy or a generic fallback instead of rejecting the
    // whole batch readback.
    return {itemRef: itemRef as Uuid, itemCode, outcome, problemCode, reason, version};
  });
}

export const emptyUuid = '' as Uuid;

export function compareStableText(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function hasUuid(value: Uuid) {
  return value.trim().length > 0;
}

export function skuCombinationKey(values: Array<{attributeRef: Uuid; attributeValueRef: Uuid}>) {
  return values
    .map(value => `${value.attributeRef}:${value.attributeValueRef}`)
    .sort(compareStableText)
    .join('|');
}

export function cloneSkuRow(row: CatalogSkuRow, patch: Partial<CatalogSkuRow> = {}): CatalogSkuRow {
  return {
    ...row,
    ...patch,
    attributeValueRefs: patch.attributeValueRefs ?? row.attributeValueRefs.map(value => ({...value})),
    mediaRefs: patch.mediaRefs ?? [...row.mediaRefs],
  };
}

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
    if (row.status === 'VOIDED') return;
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
      // Attribute codes are storage identifiers, never fallback customer-facing names.
      // A missing candidate name remains visibly unresolved for the editor to repair.
      skuName: attributeValueRefs.map(value => value.valueLabel || '未命名属性值').join(' / '),
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
      // A client-created SKU has no server timestamp until whole-save returns
      // its authoritative row.  Keep the typed read-model fact explicit so
      // all draft rows have the same closed shape as readback rows.
      updatedAt: 0,
      mediaRefs: [],
      salesUnitOverrideRef: null,
      baseMeasureUnitOverrideRef: null,
      salesUnit: null,
      baseMeasureUnit: null,
      voidAvailability: {canVoid: false, blockingReferences: [], dependentFacts: [], blockingReasons: []},
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

export function serializeSkuRowsForSave(rows: CatalogSkuRow[]): CatalogSkuSaveRow[] {
  return rows.map(row => {
    const {
      variantCombinationDigest: ignoredDigest,
      version: ignoredVersion,
      updatedAt: ignoredUpdatedAt,
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
    void ignoredUpdatedAt;
    void ignoredEffectivePreparation;
    void ignoredPreparationSource;
    void ignoredSalesUnit;
    void ignoredBaseMeasureUnit;
    void ignoredVoidAvailability;
    return productSkuRef.trim() ? {...requestRow, productSkuRef} : requestRow;
  });
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

export function decodeNavigation(envelope: CatalogDataEnvelope | undefined): CatalogNavigation | undefined {
  const value = envelopeData(envelope);
  if (!value) return undefined;
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
        directCount: integer(row.directCount),
        countSemantics: row.countSemantics === 'SELF_AND_DESCENDANTS' ? 'SELF_AND_DESCENDANTS' : 'SELF_ONLY',
        deletionAvailability: {
          canDelete: truth(deletion.canDelete),
          subtreeSize: integer(deletion.subtreeSize),
          blockingReferenceCount: integer(deletion.blockingReferenceCount),
          blockingReferences: {
            count: integer(asRecord(deletion.blockingReferences)?.count),
            references: recordArray(asRecord(deletion.blockingReferences)?.references).map(entry => ({
              referenceKind: text(entry.referenceKind),
              referenceRef: readUuid(entry.referenceRef),
              code: text(entry.code),
              name: text(entry.name),
              direction: text(entry.direction),
            })),
          },
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
    productionTags: requiredRecordArray(value.productionTags, 'productionTags', 'CatalogNavigation.data').map(row => ({
      tagRef: readUuid(row.tagRef),
      code: text(row.code),
      name: text(row.name),
      status: catalogLifecycleStatus(row.status),
      owner: text(row.owner),
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

export function decodeSkuListPage(envelope: CatalogDataEnvelope | undefined): {
  items: CatalogSkuListRow[];
  total: number;
  cursor: string | null;
  nextCursor: string | null;
} {
  const value = envelopeData(envelope) ?? {};
  return {
    items: recordArray(value.items).map(row => ({
      productSkuRef: readUuid(row.productSkuRef),
      skuCode: text(row.skuCode),
      skuName: text(row.skuName),
      attributeValueRefs: recordArray(row.attributeValueRefs).map(attribute => ({
        attributeRef: readUuid(attribute.attributeRef),
        attributeCode: text(attribute.attributeCode),
        attributeName: text(attribute.attributeName),
        attributeValueRef: readUuid(attribute.attributeValueRef),
        valueCode: text(attribute.valueCode),
        valueLabel: text(attribute.valueLabel),
        displayOrder: integer(attribute.displayOrder),
        status: catalogLifecycleStatus(attribute.status),
      })),
      standardSalePrice: row.standardSalePrice === null ? null : (optionalNumber(row.standardSalePrice) ?? null),
      salesUnit: decodeUnitAssignment(row.salesUnit),
      baseMeasureUnit: decodeUnitAssignment(row.baseMeasureUnit),
      isDefault: truth(row.isDefault),
      status: catalogLifecycleStatus(row.status),
      primaryImageAssetRef: readOptionalUuid(row.primaryImageAssetRef) ?? null,
      inventoryDeductionSummary: decodeInventoryDeductionSummary(row.inventoryDeductionSummary),
      attributeFacts: requiredRecordArray(row.attributeFacts, 'attributeFacts', 'CatalogItemSkuPage').map(
        attribute => ({
          attributeRef: readUuid(attribute.attributeRef),
          attributeCode: text(attribute.attributeCode),
          attributeName: text(attribute.attributeName),
          attributeValueRef: readUuid(attribute.attributeValueRef),
          valueCode: text(attribute.valueCode),
          valueLabel: text(attribute.valueLabel),
          displayOrder: integer(attribute.displayOrder),
          status: catalogLifecycleStatus(attribute.status),
        }),
      ),
      preparationFacts: requirePreparationFacts(row.preparationFacts, 'CatalogItemSkuPage'),
      updatedAt: integer(row.updatedAt),
    })),
    total: integer(value.total),
    cursor: value.cursor === null ? null : (optionalText(value.cursor) ?? null),
    nextCursor: value.nextCursor === null ? null : (optionalText(value.nextCursor) ?? null),
  };
}

export function buildCatalogItemsQuery(values: {
  dataNodeRef: Uuid;
  keyword?: string;
  smartViewKey?: string;
  shapeKey?: string;
  categoryRef?: Uuid;
  tagRef?: Uuid;
  productionTagRef?: Uuid;
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
  return row.standardSalePrice === undefined ? '未设置' : `¥${(row.standardSalePrice / 100).toFixed(2)}`;
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
  const voidFacts =
    action.voidAvailability === undefined ? undefined : decodeCatalogVoidAvailability(action.voidAvailability);
  return {
    item: {
      itemRef: readUuid(item.itemRef),
      code: text(item.code),
      name: text(item.name),
      shortName: optionalText(item.shortName),
      materialRole: optionalText(item.materialRole),
      categoryRef: readOptionalUuid(item.categoryRef) ?? null,
      categoryPath: requireCategoryPath(item.categoryPath, 'detail.item.categoryPath'),
      productionTagRef: readOptionalUuid(item.productionTagRef) ?? null,
      tagRefs: readUuidArray(item.tagRefs),
      shapeKey: text(item.shapeKey),
      itemKind: text(item.itemKind),
      measureMode: text(item.measureMode),
      usageCapabilities: textArray(item.usageCapabilities),
      images: textArray(item.images),
      primaryImageAssetRef: readOptionalUuid(item.primaryImageAssetRef),
      salesUnitRef: readOptionalUuid(item.salesUnitRef) ?? null,
      baseMeasureUnitRef: readOptionalUuid(item.baseMeasureUnitRef) ?? null,
      salesUnit: decodeUnitAssignment(item.salesUnit),
      baseMeasureUnit: decodeUnitAssignment(item.baseMeasureUnit),
      attributeAssignments: recordArray(item.attributeAssignments).map(row =>
        decodeAttributeAssignmentReadback(row, 'detail.item.attributeAssignments'),
      ),
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
      specificationFacts: requireSpecificationFacts(item.specificationFacts, 'detail.item.specificationFacts'),
      orderOptionFacts: requireOrderOptionFacts(item.orderOptionFacts, 'detail.item.orderOptionFacts'),
      attributeFacts: requiredRecordArray(item.attributeFacts, 'attributeFacts', 'detail.item').map(row =>
        decodeAttributeAssignmentReadback(row, 'detail.item.attributeFacts'),
      ),
      preparationFacts: requirePreparationFacts(item.preparationFacts, 'detail.item.preparationFacts'),
      identifiers: decodeIdentifiers(item.identifiers),
      skuVariantDimensions: itemSkuDimensions,
      skus: itemSkus,
      skuSummary,
      standardSalePrice: optionalNumber(item.standardSalePrice),
      priceGranularity: text(item.priceGranularity),
      compositeGroups: itemCompositeGroups.length ? itemCompositeGroups : rootCompositeGroups,
      preparationProfile: decodePreparationProfile(item.preparationProfile),
      lifecycle: {
        status: catalogLifecycleStatus(lifecycle.status || item.status),
        version: integer(lifecycle.version) || integer(item.version),
        source: text(lifecycle.source) || text(item.source),
      },
      source: text(item.source),
      externalIdentity: itemExternalIdentity,
      version: integer(item.version),
      updatedAt: integer(item.updatedAt),
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
      name: text(row.name),
      direction: text(row.direction),
    })),
    inventoryRules,
    productionTags: requiredRecordArray(root.productionTags, 'productionTags', 'CatalogItemDetail').map(row => ({
      code: text(row.code),
      tagRef: readUuid(row.tagRef),
      name: text(row.name),
      status: catalogLifecycleStatus(row.status),
      owner: text(row.owner),
    })),
    compositeGroups: rootCompositeGroups.length ? rootCompositeGroups : itemCompositeGroups,
    actionAvailability: {
      canEdit: truth(action.canEdit),
      canEnable: truth(action.canEnable),
      canDisable: truth(action.canDisable),
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

export function selectCatalogDetailForItem(
  itemCode: string | undefined,
  currentData: CatalogDataEnvelope | undefined,
  data: CatalogDataEnvelope | undefined,
): CatalogDetail | undefined {
  if (!itemCode) return undefined;
  for (const envelope of [currentData, data]) {
    const detail = decodeDetail(envelope);
    if (detail?.item.code === itemCode) return detail;
  }
  return undefined;
}

export function displayValue(value: JsonValue | undefined) {
  if (value === undefined || value === null || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function decodeItemSummary(row: Record<string, JsonValue>): CatalogItemSummary {
  const summary: CatalogItemSummary = {
    itemRef: readUuid(row.itemRef),
    code: text(row.code),
    name: text(row.name),
    shortName: optionalText(row.shortName),
    materialRole: optionalText(row.materialRole),
    categoryRef: readOptionalUuid(row.categoryRef) ?? null,
    categoryPath: requireCategoryPath(row.categoryPath, 'itemPage.item.categoryPath'),
    hasSkuChildren: truth(row.hasSkuChildren),
    productionTagRef: readOptionalUuid(row.productionTagRef) ?? null,
    tags: requireCatalogTags(row.tags, 'itemPage.item.tags'),
    tagRefs: readUuidArray(row.tagRefs),
    shapeKey: text(row.shapeKey),
    status: catalogLifecycleStatus(row.status),
    source: text(row.source),
    skuEnabledCount: integer(row.skuEnabledCount),
    skuNonArchivedCount: integer(row.skuNonArchivedCount),
    skuTotalCount: integer(row.skuTotalCount),
    specificationFacts: requireSpecificationFacts(row.specificationFacts, 'itemPage.item.specificationFacts'),
    orderOptionFacts: requireOrderOptionFacts(row.orderOptionFacts, 'itemPage.item.orderOptionFacts'),
    attributeFacts: requiredRecordArray(row.attributeFacts, 'attributeFacts', 'itemPage.item').map(entry =>
      decodeAttributeAssignmentReadback(entry, 'itemPage.item.attributeFacts'),
    ),
    preparationFacts: requirePreparationFacts(row.preparationFacts, 'itemPage.item.preparationFacts'),
    standardSalePrice: optionalNumber(row.standardSalePrice),
    standardSalePriceMin: optionalNumber(row.standardSalePriceMin),
    standardSalePriceMax: optionalNumber(row.standardSalePriceMax),
    standardPriceDelta: optionalNumber(row.standardPriceDelta),
    standardExtraPrice: optionalNumber(row.standardExtraPrice),
    priceGranularity: text(row.priceGranularity),
    salesUnit: decodeUnitAssignment(row.salesUnit),
    baseMeasureUnit: decodeUnitAssignment(row.baseMeasureUnit),
    inventoryDeductionSummary: decodeInventoryDeductionSummary(row.inventoryDeductionSummary),
    version: integer(row.version),
    updatedAt: integer(row.updatedAt),
  };
  const primaryImageAssetRef = readOptionalUuid(row.primaryImageAssetRef);
  if (primaryImageAssetRef) summary.primaryImageAssetRef = primaryImageAssetRef;
  return summary;
}
