import type {
  BrandCatalogCopyPreflight,
  CatalogInventoryEnvelope,
  JsonValue,
} from '../../../../app/api/generated/catalog-inventory-edge';
import {catalogLifecycleStatus} from './catalogLifecycle';
import type {
  BrandCopyReadback,
  BrandCopyScope,
  BrandCopyCompatibilityBuckets,
  CatalogCopyReferenceMapping,
  CatalogDataEnvelope,
  CopyCandidate,
  CopyPreflight,
} from './catalogTypes';
import {asRecord, envelopeData, integer, readUuid, recordArray, text, truth} from './catalogValidation';

type BrandCopyPreflightResponse = CatalogInventoryEnvelope | BrandCatalogCopyPreflight;
type ConfirmableCompatibility = {compatibilityId: string; result: string};
export type CopyConfirmationRow<T extends ConfirmableCompatibility = CopyPreflight['compatibilityResults'][number]> = {
  row: T;
  key: string;
};
const CATALOG_COPY_USER_VISIBLE_COPY = {
  objectTypes: {
    CATALOG_ITEM: '商品',
    CATALOG_CATEGORY: '商品分类',
    CATALOG_TAG: '商品标签',
    SKU: '规格',
    SKU_ATTRIBUTE: '规格维度',
    SKU_ATTRIBUTE_VALUE: '规格值',
    ORDER_OPTION_GROUP: '点单分组',
    ORDER_OPTION_VALUE: '点单选项',
    CATALOG_ORDER_OPTION_DEFINITION: '点单选项',
    CATALOG_ORDER_OPTION_DEFINITION_VALUE: '点单选项值',
    INVENTORY_TARGET: '库存对象',
    STOCK_TARGET: '库存对象',
    BOM: '配方',
    SKU_BOM: '规格库存与 BOM',
    OPTION_VALUE_BOM: '选项用料',
    ITEM_BOM: '商品库存与 BOM',
    PACKAGE_COMPONENT: '套餐组件',
    PRODUCTION_PROMPT: '制作信息',
    PRODUCTION_TAG: '生产标签',
  } as Record<string, string>,
  actions: {
    create: '新建',
    reuse: '复用',
    skip: '跳过',
    blocked: '不可复制',
    checked: '已检查',
  },
  confirmations: {
    create: '确认新建',
    reuse: '确认复用',
    other: '确认此处理',
  },
  reasonCodes: {
    TARGET_ABSENT: '目标商品尚不存在，将新建。',
    STRUCTURE_COMPATIBLE: '商品结构兼容，可以复用。',
    STRUCTURE_INCOMPATIBLE: '商品形态或结构不兼容。',
    SKU_STRUCTURE_INCOMPATIBLE: '规格结构不一致。',
    CONSUMPTION_UNIT_INCOMPATIBLE: '计量单位不兼容。',
    REFERENCE_MAPPING_UNRESOLVED: '关联内容无法在当前商品库对应。',
    REUSE_CONFIRMATION_REQUIRED: '编码和结构兼容，可复用。',
    OWNER_FACT_UNAVAILABLE: '关联资料暂时不可用，请稍后重新检查。',
    CATALOG_COPY_DEFINITION_CONFLICT: '同编码定义的配置不一致。',
  } as Record<string, string>,
  unknownReason: '当前内容需要进一步确认，请核对后重新检查。',
  unknownObjectType: '关联内容',
} as const;
const CATALOG_COPY_OBJECT_TYPES = new Set([
  'CATALOG_ITEM',
  'CATALOG_CATEGORY',
  'CATALOG_TAG',
  'SKU_ATTRIBUTE',
  'SKU_ATTRIBUTE_VALUE',
]);

export function catalogCopyObjectTypeLabel(value: string) {
  return CATALOG_COPY_USER_VISIBLE_COPY.objectTypes[value] ?? CATALOG_COPY_USER_VISIBLE_COPY.unknownObjectType;
}

export function catalogCopyActionLabel(value: string) {
  if (value === 'CREATE') return CATALOG_COPY_USER_VISIBLE_COPY.actions.create;
  if (value.includes('REUSE')) return CATALOG_COPY_USER_VISIBLE_COPY.actions.reuse;
  if (value === 'SKIP') return CATALOG_COPY_USER_VISIBLE_COPY.actions.skip;
  if (value === 'BLOCKED') return CATALOG_COPY_USER_VISIBLE_COPY.actions.blocked;
  return CATALOG_COPY_USER_VISIBLE_COPY.actions.checked;
}

export function catalogCopyReasonLabel(value: string) {
  return CATALOG_COPY_USER_VISIBLE_COPY.reasonCodes[value] ?? CATALOG_COPY_USER_VISIBLE_COPY.unknownReason;
}

export function catalogCopyScopeLabel(value: string) {
  if (value === 'HEAD_COMPANY') return '品牌商品库';
  if (value === 'STORE') return '门店商品库';
  return '当前商品库';
}

export function catalogCopyVersionRows(rows: Array<Record<string, JsonValue>>) {
  return rows.filter(row => CATALOG_COPY_OBJECT_TYPES.has(String(row.objectType ?? '')));
}

export function copyConfirmationRows<T extends ConfirmableCompatibility>(rows: T[]): CopyConfirmationRow<T>[] {
  return rows.flatMap(row =>
    row.result === 'BLOCKED' || !row.compatibilityId ? [] : [{row, key: copyConfirmationKey(row)}],
  );
}

export function copyConfirmationKey(row: ConfirmableCompatibility): string {
  return row.compatibilityId;
}

export function copyConfirmationLabel(result: string): string {
  if (result === 'CREATE') return CATALOG_COPY_USER_VISIBLE_COPY.confirmations.create;
  if (result.includes('REUSE')) return CATALOG_COPY_USER_VISIBLE_COPY.confirmations.reuse;
  return CATALOG_COPY_USER_VISIBLE_COPY.confirmations.other;
}

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

export function decodeCandidates(envelope: CatalogInventoryEnvelope | undefined): CopyCandidate[] {
  const value = envelopeData(envelope);
  const page = asRecord(value?.data) ?? value;
  return recordArray(page?.items).map(row => ({
    code: text(row.code),
    name: text(row.name),
    shapeKey: text(row.shapeKey),
    status: catalogLifecycleStatus(row.status),
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

export function decodePreflight(envelope: BrandCopyPreflightResponse | undefined): CopyPreflight | undefined {
  const rootRecord = asRecord(envelope);
  const directPayload = typeof rootRecord?.preflightDigest === 'string' ? rootRecord : undefined;
  const root = directPayload ?? envelopeData(envelope as CatalogDataEnvelope) ?? asRecord(rootRecord?.result);
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

export function decodeCompatibilityResults(
  value: JsonValue | undefined,
): CopyPreflight['compatibilityResults'] | undefined {
  if (!Array.isArray(value)) return undefined;
  const seen = new Set<string>();
  const decoded: CopyPreflight['compatibilityResults'] = [];
  for (const entry of value) {
    const row = asRecord(entry);
    const objectType = typeof row?.objectType === 'string' ? row.objectType : '';
    const compatibilityId = typeof row?.compatibilityId === 'string' ? row.compatibilityId : '';
    const result = typeof row?.result === 'string' ? row.result : '';
    const reason = typeof row?.reason === 'string' ? row.reason : '';
    const reasonCode = typeof row?.reasonCode === 'string' ? row.reasonCode : '';
    if (
      !row ||
      !objectType.trim() ||
      !compatibilityId.trim() ||
      !result.trim() ||
      !reasonCode.trim() ||
      seen.has(compatibilityId)
    )
      return undefined;
    seen.add(compatibilityId);
    decoded.push({objectType, compatibilityId, result, reason, reasonCode});
  }
  return decoded;
}

export function referenceMappings(value: JsonValue | undefined): CatalogCopyReferenceMapping[] {
  return recordArray(value).map(row => ({
    objectType: text(row.objectType),
    targetCode: text(row.targetCode),
    ...(text(row.targetSkuCode) ? {targetSkuCode: text(row.targetSkuCode)} : {}),
    ...(text(row.targetOptionValueCode) ? {targetOptionValueCode: text(row.targetOptionValueCode)} : {}),
  }));
}
