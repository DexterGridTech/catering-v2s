import type {JsonValue, Uuid} from '../../../../app/api/generated/catalog-inventory-edge';
import {catalogLifecycleStatus} from './catalogLifecycle';
import type {
  CatalogAttributeAssignment,
  CatalogAttributeAssignmentReadback,
  CatalogCategoryPathNode,
  CatalogCompositeGroup,
  CatalogDetail,
  CatalogExternalIdentity,
  CatalogIdentifier,
  CatalogIdentifierType,
  CatalogInventoryDeductionSummary,
  CatalogInventoryRuleMode,
  CatalogInventoryRuleOwner,
  CatalogInventoryRules,
  CatalogOrderOptionConfig,
  CatalogPreparationEffect,
  CatalogPreparationFacts,
  CatalogPreparationProfile,
  CatalogSkuRow,
  CatalogSkuVariantDimension,
  CatalogSpecificationFact,
  CatalogTagFact,
  CatalogUnitAssignment,
  CatalogUnitDimension,
  CatalogUnitSnapshot,
  CatalogVoidAvailability,
  CatalogVoidBlockReasonCode,
  CatalogDataEnvelope,
} from './catalogTypes';

type CatalogTreeSelectionForFilter = {
  kind: 'SMART' | 'SHAPE' | 'CATEGORY' | 'TAG' | 'PRODUCTION_TAG' | 'UNCATEGORIZED';
  ref: string;
};

export function catalogVoidBlockReasonCode(value: JsonValue | undefined): CatalogVoidBlockReasonCode {
  const reasonCode = text(value);
  if (
    reasonCode === 'HAS_SKUS' ||
    reasonCode === 'HAS_IDENTIFIERS' ||
    reasonCode === 'HAS_PRODUCTION_TAG' ||
    reasonCode === 'USED_BY_OTHER_ITEM' ||
    reasonCode === 'USED_BY_INVENTORY_BOM' ||
    reasonCode === 'ALREADY_VOIDED' ||
    reasonCode === 'USED_BY_PACKAGE'
  )
    return reasonCode;
  throw new Error('INVALID_CATALOG_VOID_BLOCK_REASON_CODE');
}

export function envelopeData(envelope: CatalogDataEnvelope | undefined): Record<string, JsonValue> | undefined {
  return asRecord(envelope?.data);
}

export function catalogFilterConflictReason(
  selection: CatalogTreeSelectionForFilter,
  filter: 'status' | 'source',
): string | undefined {
  if (selection.kind !== 'SMART') return undefined;
  if (filter === 'status' && selection.ref === 'INACTIVE') {
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

export function catalogInventoryProblemTab(errorCode: string): 'basic' | 'inventory-bom' | undefined {
  if (errorCode === 'CATALOG_BASE_MEASURE_UNIT_CHANGE_BLOCKED') return 'basic';
  if (errorCode === 'CONSUMPTION_UNIT_INCOMPATIBLE' || errorCode.startsWith('INVENTORY_')) return 'inventory-bom';
  return undefined;
}

export function asRecord(value: unknown): Record<string, JsonValue> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, JsonValue>) : undefined;
}

export function recordArray(value: JsonValue | undefined): Array<Record<string, JsonValue>> {
  return Array.isArray(value) ? value.flatMap(entry => (asRecord(entry) ? [asRecord(entry)!] : [])) : [];
}

export function requiredRecordArray(
  value: JsonValue | undefined,
  field: string,
  boundary: string,
): Array<Record<string, JsonValue>> {
  if (!Array.isArray(value)) throw new Error(`CATALOG_REQUIRED_FIELD_MISSING:${boundary}.${field}`);
  return recordArray(value);
}

export function text(value: JsonValue | undefined): string {
  return typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value);
}

export function readUuid(value: JsonValue | undefined): Uuid {
  return text(value) as Uuid;
}

export function readOptionalUuid(value: JsonValue | undefined): Uuid | undefined {
  const result = optionalText(value);
  return result ? (result as Uuid) : undefined;
}

export function readUuidArray(value: JsonValue | undefined): Uuid[] {
  return textArray(value).map(entry => entry as Uuid);
}

export function optionalText(value: JsonValue | undefined): string | undefined {
  const result = text(value).trim();
  return result || undefined;
}

export function decodeInventoryDeductionSummary(value: JsonValue | undefined): CatalogInventoryDeductionSummary {
  const row = asRecord(value) ?? {};
  const mode = text(row.mode);
  return {
    grain: text(row.grain) === 'SKU' ? 'SKU' : 'ITEM',
    mode: mode === 'DIRECT' || mode === 'BOM' || mode === 'NONE' ? mode : null,
    consumptionUnitSnapshot: decodeUnitSnapshot(row.consumptionUnitSnapshot),
    bomLineCount: row.bomLineCount === null ? null : (optionalInteger(row.bomLineCount) ?? null),
  };
}

export function integer(value: JsonValue | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function optionalInteger(value: JsonValue | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function optionalNumber(value: JsonValue | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function decodeSkuSummary(value: JsonValue | undefined): CatalogDetail['item']['skuSummary'] {
  const row = asRecord(value) ?? {};
  return {
    enabledCount: integer(row.enabledCount),
    nonArchivedCount: integer(row.nonArchivedCount),
    totalCount: integer(row.totalCount),
    dimensions: textArray(row.dimensions),
  };
}

export function decodeExternalIdentity(value: JsonValue | undefined): CatalogExternalIdentity {
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

export function decodeSkuVariantDimensions(value: JsonValue | undefined): CatalogSkuVariantDimension[] {
  return recordArray(value).map(row => ({
    attributeRef: readUuid(row.attributeRef),
    attributeCode: text(row.attributeCode),
    attributeName: text(row.attributeName),
    values: recordArray(row.values).map(entry => ({
      valueRef: readUuid(entry.valueRef),
      valueCode: text(entry.valueCode),
      valueLabel: text(entry.valueLabel),
      displayOrder: integer(entry.displayOrder),
      status: catalogLifecycleStatus(entry.status),
    })),
  }));
}

export function decodeIdentifiers(value: JsonValue | undefined): CatalogIdentifier[] {
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

export function decodePreparationProfile(value: JsonValue | undefined): CatalogPreparationProfile | null {
  const row = asRecord(value);
  if (!row) return null;
  return {
    productionDisplayName:
      row.productionDisplayName === null ? null : (optionalText(row.productionDisplayName) ?? null),
    estimatedPreparationSeconds:
      row.estimatedPreparationSeconds === null ? null : (optionalInteger(row.estimatedPreparationSeconds) ?? null),
    preparationNotes: row.preparationNotes === null ? null : (optionalText(row.preparationNotes) ?? null),
  };
}

export function decodeCategoryPath(value: JsonValue | undefined): CatalogCategoryPathNode[] {
  return recordArray(value).map(row => ({
    categoryRef: readUuid(row.categoryRef),
    code: text(row.code),
    name: text(row.name),
  }));
}

export function requireCategoryPath(value: JsonValue | undefined, boundary: string): CatalogCategoryPathNode[] {
  if (!Array.isArray(value)) throw new Error(`CATALOG_REQUIRED_FIELD_MISSING:${boundary}`);
  return decodeCategoryPath(value);
}

export function decodeCatalogTags(value: JsonValue | undefined): CatalogTagFact[] {
  return recordArray(value).map(row => ({tagRef: readUuid(row.tagRef), code: text(row.code), name: text(row.name)}));
}

export function requireCatalogTags(value: JsonValue | undefined, boundary: string): CatalogTagFact[] {
  if (!Array.isArray(value)) throw new Error(`CATALOG_REQUIRED_FIELD_MISSING:${boundary}`);
  return decodeCatalogTags(value);
}

export function decodeSpecificationFacts(value: JsonValue | undefined): CatalogSpecificationFact[] {
  return recordArray(value).map(row => ({
    attributeRef: readUuid(row.attributeRef),
    attributeCode: text(row.attributeCode),
    attributeName: text(row.attributeName),
    values: recordArray(row.values).map(entry => ({
      valueRef: readUuid(entry.valueRef),
      valueCode: text(entry.valueCode),
      valueLabel: text(entry.valueLabel),
      displayOrder: integer(entry.displayOrder),
      status: catalogLifecycleStatus(entry.status),
    })),
  }));
}

export function requireSpecificationFacts(value: JsonValue | undefined, boundary: string): CatalogSpecificationFact[] {
  if (!Array.isArray(value)) throw new Error(`CATALOG_REQUIRED_FIELD_MISSING:${boundary}`);
  return decodeSpecificationFacts(value);
}

export function decodePreparationFacts(value: JsonValue | undefined): CatalogPreparationFacts | undefined {
  const row = asRecord(value);
  if (!row) return undefined;
  const productionTagRow = asRecord(row.productionTag);
  const productionTag = productionTagRow
    ? {
        tagRef: readUuid(productionTagRow.tagRef),
        code: text(productionTagRow.code),
        name: text(productionTagRow.name),
        status: catalogLifecycleStatus(productionTagRow.status),
        owner: text(productionTagRow.owner),
      }
    : null;
  const variation = asRecord(row.skuVariation);
  return {
    productionTag,
    profile: decodePreparationProfile(row.profile),
    skuVariation: {varies: truth(variation?.varies)},
  };
}

export function requirePreparationFacts(value: JsonValue | undefined, boundary: string): CatalogPreparationFacts {
  const facts = decodePreparationFacts(value);
  if (!facts) throw new Error(`CATALOG_REQUIRED_FIELD_MISSING:${boundary}`);
  return facts;
}

export function decodeOrderOptionFacts(value: JsonValue | undefined): CatalogOrderOptionConfig[] {
  return recordArray(value).map(row => ({
    definitionRef: readUuid(row.definitionRef),
    name: text(row.name),
    selectionMode: text(row.selectionMode) as CatalogOrderOptionConfig['selectionMode'],
    displayOrder: integer(row.displayOrder),
    required: truth(row.required),
    minSelectionCount: row.minSelectionCount === null ? null : (optionalNumber(row.minSelectionCount) ?? null),
    maxSelectionCount: row.maxSelectionCount === null ? null : (optionalNumber(row.maxSelectionCount) ?? null),
    values: recordArray(row.values).map(valueRow => ({
      definitionValueRef: readUuid(valueRow.definitionValueRef),
      name: text(valueRow.name),
      displayOrder: integer(valueRow.displayOrder),
      defaultValue: truth(valueRow.defaultValue),
      extraPrice: valueRow.extraPrice === null ? null : (optionalNumber(valueRow.extraPrice) ?? null),
      bomVersion: valueRow.bomVersion === null ? null : (optionalNumber(valueRow.bomVersion) ?? null),
      preparationEffect: decodePreparationEffect(valueRow.preparationEffect),
    })),
  }));
}

export function requireOrderOptionFacts(value: JsonValue | undefined, boundary: string): CatalogOrderOptionConfig[] {
  if (!Array.isArray(value)) throw new Error(`CATALOG_REQUIRED_FIELD_MISSING:${boundary}`);
  return decodeOrderOptionFacts(value);
}

export function decodePreparationOverride(value: JsonValue | undefined): CatalogSkuRow['preparationOverride'] {
  const row = asRecord(value) ?? {};
  const mode = text(row.mode) as CatalogSkuRow['preparationOverride']['mode'];
  return {
    mode: mode === 'OVERRIDE' ? 'OVERRIDE' : 'INHERIT_ITEM',
    profile: decodePreparationProfile(row.profile),
  };
}

export function decodePreparationEffect(value: JsonValue | undefined): CatalogPreparationEffect | null {
  const row = asRecord(value);
  if (!row) return null;
  return {
    definitionValueRef: readUuid(row.definitionValueRef),
    optionGroupDisplayOrder: integer(row.optionGroupDisplayOrder),
    optionValueDisplayOrder: integer(row.optionValueDisplayOrder),
    instruction: row.instruction === null ? null : (optionalText(row.instruction) ?? null),
    preparationSecondsDelta:
      row.preparationSecondsDelta === null ? null : (optionalInteger(row.preparationSecondsDelta) ?? null),
  };
}

export function decodeCatalogVoidAvailability(value: JsonValue | undefined): CatalogVoidAvailability {
  const availability = asRecord(value);
  if (
    !availability ||
    typeof availability.canVoid !== 'boolean' ||
    !Array.isArray(availability.blockingReferences) ||
    !Array.isArray(availability.dependentFacts) ||
    !Array.isArray(availability.blockingReasons)
  )
    throw new Error('INVALID_CATALOG_VOID_AVAILABILITY');
  const blockingReasons = recordArray(availability.blockingReasons).map(entry => ({
    reasonCode: catalogVoidBlockReasonCode(entry.reasonCode),
    count: integer(entry.count),
    relatedItemNames: recordArray(entry.relatedItemNames).map(text).filter(Boolean),
  }));
  if (
    blockingReasons.some(reason => !reason.reasonCode.trim() || reason.count <= 0) ||
    (availability.canVoid === false && blockingReasons.length === 0)
  )
    throw new Error('INVALID_CATALOG_VOID_AVAILABILITY');
  return {
    canVoid: availability.canVoid,
    blockingReferences: recordArray(availability.blockingReferences).map(entry => ({
      referenceKind: text(entry.referenceKind),
      referenceRef: readUuid(entry.referenceRef),
    })),
    dependentFacts: recordArray(availability.dependentFacts).map(entry => ({
      factKind: text(entry.factKind),
      factRef: readUuid(entry.factRef),
    })),
    blockingReasons,
  };
}

export function decodeCatalogSkuVoidAvailability(value: JsonValue | undefined): CatalogVoidAvailability {
  return decodeCatalogVoidAvailability(value);
}

export function decodeSkuRows(value: JsonValue | undefined): CatalogSkuRow[] {
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
      status: catalogLifecycleStatus(entry.status),
    })),
    identifiers: decodeIdentifiers(row.identifiers),
    preparationOverride: decodePreparationOverride(row.preparationOverride),
    effectivePreparation: decodePreparationProfile(row.effectivePreparation),
    preparationSource: text(row.preparationSource) as CatalogSkuRow['preparationSource'],
    standardSalePrice: typeof row.standardSalePrice === 'number' ? row.standardSalePrice : null,
    isDefault: truth(row.isDefault),
    status: catalogLifecycleStatus(row.status),
    version: integer(row.version),
    updatedAt: integer(row.updatedAt),
    mediaRefs: readUuidArray(row.mediaRefs),
    salesUnitOverrideRef: readOptionalUuid(row.salesUnitOverrideRef) ?? null,
    baseMeasureUnitOverrideRef: readOptionalUuid(row.baseMeasureUnitOverrideRef) ?? null,
    salesUnit: decodeUnitAssignment(row.salesUnit),
    baseMeasureUnit: decodeUnitAssignment(row.baseMeasureUnit),
    voidAvailability: decodeCatalogSkuVoidAvailability(row.voidAvailability),
  }));
}

export function decodeUnitSnapshot(value: JsonValue | undefined): CatalogUnitSnapshot | null {
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

export function requireUnitSnapshot(value: JsonValue | undefined, label: string): CatalogUnitSnapshot {
  const snapshot = decodeUnitSnapshot(value);
  if (!snapshot) throw new Error(`INVALID_UNIT_SNAPSHOT:${label}`);
  return snapshot;
}

export function decodeUnitAssignment(value: JsonValue | undefined): CatalogUnitAssignment | null {
  const snapshot = decodeUnitSnapshot(value);
  const row = asRecord(value);
  if (!snapshot || !row) return null;
  return {
    ...snapshot,
    status: text(row.status) as CatalogUnitAssignment['status'],
    inheritanceSource: text(row.inheritanceSource) as CatalogUnitAssignment['inheritanceSource'],
  };
}

export function decodeCompositeGroups(value: JsonValue | undefined): CatalogCompositeGroup[] {
  return recordArray(value).map(row => ({
    groupCode: text(row.groupCode),
    groupName: text(row.groupName),
    selectionRule: text(row.selectionRule),
    minSelections: integer(row.minSelections),
    maxSelections: integer(row.maxSelections),
    displayOrder: integer(row.displayOrder),
    components: recordArray(row.components).map(entry => ({
      itemCode: text(entry.itemCode),
      itemName: text(entry.itemName),
      itemRef: readUuid(entry.itemRef),
      productSkuRef: readOptionalUuid(entry.productSkuRef) ?? null,
      skuCode: optionalText(entry.skuCode) ?? null,
      skuName: optionalText(entry.skuName) ?? null,
      quantity: text(entry.quantity),
      unit: text(entry.unit),
      default: truth(entry.default),
      extraPrice: typeof entry.extraPrice === 'number' ? entry.extraPrice : null,
      status: catalogLifecycleStatus(entry.status),
      displayOrder: integer(entry.displayOrder),
    })),
  }));
}

export function decodeInventoryRules(value: JsonValue | undefined): CatalogInventoryRules {
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

export function truth(value: JsonValue | undefined): boolean {
  return value === true;
}

export function textArray(value: JsonValue | undefined): string[] {
  return Array.isArray(value) ? value.flatMap(entry => (typeof entry === 'string' ? [entry] : [])) : [];
}

export function requiredTextArray(value: JsonValue | undefined, field: string, boundary: string): string[] {
  if (!Array.isArray(value)) throw new Error(`CATALOG_REQUIRED_FIELD_MISSING:${boundary}.${field}`);
  return textArray(value);
}

export function decodeAttributeAssignmentReadback(
  row: Record<string, JsonValue>,
  boundary: string,
): CatalogAttributeAssignmentReadback {
  const optionRefs = readUuidArray(row.optionRefs);
  const selectedOptionNames = requiredTextArray(row.selectedOptionNames, 'selectedOptionNames', boundary);
  if (optionRefs.length !== selectedOptionNames.length)
    throw new Error(`CATALOG_ATTRIBUTE_OPTION_FACT_MISMATCH:${boundary}`);
  return {
    definitionRef: readUuid(row.definitionRef),
    code: text(row.code),
    name: text(row.name),
    valueType: text(row.valueType) as CatalogAttributeAssignment['valueType'],
    textValue: row.textValue === null ? null : (optionalText(row.textValue) ?? null),
    optionRefs,
    selectedOptionNames,
  };
}
