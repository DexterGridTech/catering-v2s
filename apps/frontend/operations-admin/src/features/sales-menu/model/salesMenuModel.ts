import type {InventoryAvailabilityFact, ManualSaleStatusFact, SalesMenuDraftItemView} from './salesMenuModelTypes';
import {LIFECYCLE_LABELS} from '@catering-v2s/admin-ui-foundation';

export const SALES_MENU_PAGE_SIZE = 20 as const;
export const SALES_MENU_OPERATION_COLUMN_TITLE = '操作';

export type SalesMenuMode = 'PUBLISHED' | 'DRAFT' | 'OPERATIONS';
export type SalesMenuCollectionMode = 'CHANNEL' | 'SELECTOR' | 'MANAGER' | 'CANDIDATE' | 'DRAFT' | 'PUBLISHED' | 'LOG';
export type SalesMenuProductShape = SalesMenuDraftItemView['productShape'];
export type SalesMenuInventoryAvailability = InventoryAvailabilityFact;
export type SalesMenuManualSaleStatus = ManualSaleStatusFact;

export function salesMenuCandidateSelection(selected: readonly string[], visible: readonly string[]) {
  const visibleRefs = new Set(visible);
  const hidden = selected.filter(candidateRef => !visibleRefs.has(candidateRef));
  return {
    hiddenSelectedCount: hidden.length,
    visibleSelected: selected.filter(candidateRef => visibleRefs.has(candidateRef)),
    canSubmit: selected.length > 0,
  };
}

export function mergeSalesMenuCandidateSelection(
  selected: readonly string[],
  visible: readonly string[],
  nextVisible: readonly string[],
): string[] {
  const visibleRefs = new Set(visible);
  const next = new Set(selected.filter(candidateRef => !visibleRefs.has(candidateRef)));
  for (const candidateRef of nextVisible) next.add(candidateRef);
  return [...next];
}

export type SalesMenuQueryIdentityInput = {
  scopeRef?: string;
  channelRef?: string;
  menuRef?: string;
  mode?: SalesMenuMode;
  sectionRef?: string;
  query?: string;
  categoryRef?: string;
  publication?: string;
  collection?: SalesMenuCollectionMode;
};

export function salesMenuQueryIdentity(input: SalesMenuQueryIdentityInput): string {
  return JSON.stringify({
    collection: input.collection ?? 'PAGE',
    scopeRef: input.scopeRef ?? '',
    channelRef: input.channelRef ?? '',
    menuRef: input.menuRef ?? '',
    mode: input.mode ?? '',
    sectionRef: input.sectionRef ?? '',
    query: input.query ?? '',
    categoryRef: input.categoryRef ?? '',
    publication: input.publication ?? '',
  });
}

/**
 * Owner receipts are scoped by operation and workspace, while their request
 * hash includes the command target. Keep the client content key aligned with
 * that identity so identical bodies for different menu resources cannot
 * collide.
 */
export function salesMenuCommandIdempotencyPayload(path: object, body: unknown) {
  return {path, body};
}

const PRODUCT_SHAPE_LABELS: Record<SalesMenuProductShape, string> = {
  ORDINARY: '普通销售商品',
  SKU: '按规格管理商品',
  WEIGHTED: '称重销售商品',
  COMPOSITE: '商品型套餐',
  SERVICE: '服务、费用商品',
};

export function salesMenuProductShapeLabel(shape: SalesMenuProductShape): string {
  return PRODUCT_SHAPE_LABELS[shape];
}

export function salesMenuChannelStatusLabel(status: 'ENABLED' | 'DISABLED' | 'VOIDED'): string {
  return LIFECYCLE_LABELS[status];
}

export function salesMenuDraftStateLabel(draftDirty: boolean): string {
  return draftDirty ? '有未发布修改' : '与前台一致';
}

export function salesMenuModeLabel(mode: SalesMenuMode): string {
  return mode === 'PUBLISHED' ? '前台菜单' : mode === 'DRAFT' ? '草稿菜单' : '操作记录';
}

export function salesMenuInventoryAvailabilityLabel(fact: SalesMenuInventoryAvailability): string {
  if (fact.applicability === 'NOT_APPLICABLE') return '不适用';
  if (fact.state === 'AUTO_UNAVAILABLE') return '自动不可售';
  if (fact.state === 'UNKNOWN') return '库存未知';
  return '库存可售';
}

export function salesMenuManualSaleStatusLabel(fact: SalesMenuManualSaleStatus): string {
  return fact.state === 'MANUAL_SOLD_OUT' ? '已沽清' : '正常销售';
}

export function salesMenuScheduleLabel(schedule: {
  kind: 'ALL_DAY' | 'DAILY_TIME_RANGE';
  startLocalTime: string | null;
  endLocalTime: string | null;
}): string {
  return schedule.kind === 'ALL_DAY'
    ? '全天'
    : `${schedule.startLocalTime ?? '未设置'}至${schedule.endLocalTime ?? '未设置'}`;
}

const SALES_MENU_OPERATION_LABELS: Record<string, string> = {
  addOperationsSalesMenuItems: '添加商品到菜单',
  archiveOperationsSalesMenu: '归档菜单',
  copyOperationsSalesMenu: '复制菜单',
  createOperationsSalesMenu: '新建菜单',
  createOperationsSalesMenuSection: '新建销售分区',
  deleteOperationsSalesMenuItem: '删除销售项',
  deleteOperationsSalesMenuSection: '删除销售分区',
  moveOperationsSalesMenuItem: '调整销售项顺序',
  moveOperationsSalesMenuSection: '调整销售分区顺序',
  publishOperationsSalesMenu: '更新到前台',
  releaseOperationsSalesMenuStagedAsset: '释放暂存图片',
  renameOperationsSalesMenu: '重命名菜单',
  renameOperationsSalesMenuSection: '重命名销售分区',
  restoreOperationsSalesMenuItemSale: '恢复正常销售',
  setOperationsSalesMenuActivation: '启用或停用菜单',
  setOperationsSalesMenuItemSoldOut: '设置人工沽清',
  stageOperationsSalesMenuAsset: '上传菜单图片',
  updateOperationsSalesMenuItem: '保存销售项',
  updateOperationsSalesMenuSchedule: '保存菜单时段',
};

export function salesMenuOperationLabel(operationKind: string): string {
  return SALES_MENU_OPERATION_LABELS[operationKind] ?? '菜单操作';
}

export function formatSalesMenuPrice(cents: number | null): string {
  return cents === null ? '未设置' : `¥${(cents / 100).toFixed(2)}`;
}
