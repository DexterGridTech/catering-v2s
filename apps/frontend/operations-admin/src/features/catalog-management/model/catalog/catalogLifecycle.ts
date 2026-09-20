import type {
  CatalogDictionaryLabel,
  CatalogItemSummary,
  CatalogMediaLimits,
  CatalogNavigation,
  CatalogLifecycleStatus,
} from './catalogTypes';
import type {
  CatalogDictionaryView,
  CatalogShapeManifestView,
  Uuid,
} from '../../../../app/api/generated/catalog-inventory-edge';

const CATALOG_BATCH_PROBLEM_COPY: Readonly<Record<string, string>> = Object.freeze({
  DEPENDENT_FACTS_BLOCK_VOID: '商品仍有依赖资料，暂不能作废。',
  NOT_FOUND: '商品已不存在，请刷新后重试。',
  REFERENCE_BLOCKS_VOID: '商品仍被业务资料引用，暂不能作废。',
  REFERENCE_MAPPING_UNRESOLVED: '商品关联资料无法确认，请刷新后重试。',
  SCOPE_FORBIDDEN: '商品不在当前数据范围内。',
  VALIDATION_ERROR: '提交的商品状态不符合要求，请检查后重试。',
  VERSION_CONFLICT: '商品资料已有更新，请重新读取后再操作。',
  VOIDED_RECORD_IMMUTABLE: '已作废的商品不可修改。',
});
const CATALOG_BATCH_UNKNOWN_PROBLEM_COPY = '批量操作项执行失败，请重新读取后再试。';

export function catalogLifecycleStatus(value: unknown): CatalogLifecycleStatus {
  const status = typeof value === 'string' ? value : '';
  if (status === 'ENABLED' || status === 'DISABLED' || status === 'VOIDED') return status;
  throw new Error('INVALID_CATALOG_LIFECYCLE_STATUS');
}

export function catalogBatchFailureReasonLabel(problemCode: string | null, reason: string | null): string {
  const knownCopy = problemCode === null ? undefined : CATALOG_BATCH_PROBLEM_COPY[problemCode];
  void reason;
  return knownCopy ?? CATALOG_BATCH_UNKNOWN_PROBLEM_COPY;
}

export function isCatalogBatchRowSelectable(row: Pick<CatalogItemSummary, 'status' | 'source'>): boolean {
  return row.status !== 'VOIDED' && row.source !== 'TEMPORARY';
}

export function decodeCatalogDictionaryLabels(response: CatalogDictionaryView | undefined): CatalogDictionaryLabel[] {
  return (
    response?.data.entries.map(entry => ({entryRef: entry.entryRef, name: entry.name, status: entry.status})) ?? []
  );
}

export function catalogTagTreeSelection(tag: CatalogNavigation['tags'][number]): {
  kind: 'TAG';
  ref: Uuid;
  label: string;
} {
  return {kind: 'TAG', ref: tag.tagRef, label: tag.name};
}

export function catalogProductionTagTreeSelection(tag: CatalogNavigation['productionTags'][number]): {
  kind: 'PRODUCTION_TAG';
  ref: Uuid;
  label: string;
} {
  return {kind: 'PRODUCTION_TAG', ref: tag.tagRef, label: tag.name};
}

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

export function catalogCentsToYuan(value: number | null | undefined): number | undefined {
  if (value === null || value === undefined || !Number.isFinite(value)) return undefined;
  return Number((value / 100).toFixed(2));
}

export function catalogYuanToCents(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100);
}

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
