import {createElement, type ReactNode} from 'react';
import {NameCodeText} from '@catering-v2s/admin-ui-foundation';
import type {CatalogInventoryEnvelope, Uuid} from '../../../app/api/generated/catalog-inventory-edge';

export type StockView = 'ALL' | 'NEEDS_ATTENTION' | 'LOW' | 'OUT' | 'NEGATIVE' | 'UNKNOWN';

export type InventoryCounts = Record<StockView, number>;

export type InventoryUnitSnapshot = {
  unitRef: Uuid;
  code: string;
  name: string;
  unitDimension: 'COUNT' | 'WEIGHT' | 'VOLUME' | 'SERVICE_DURATION' | 'PACKAGE';
  precision: number;
};

export type InventoryConversionFacts = {
  countingUnitSnapshot: InventoryUnitSnapshot | null;
  consumptionUnitSnapshot: InventoryUnitSnapshot;
  conversionFactor: string;
};

type InventoryLabelMap = Readonly<Record<string, string>>;

const INVENTORY_SHAPE_LABELS: InventoryLabelMap = {
  STANDARD_SALE_COUNTED: '普通销售商品',
  SKU_VARIANT_SALE_COUNTED: '按规格管理商品',
  STANDARD_SALE_WEIGHED: '称重销售商品',
  MATERIAL: '原材料/半成品/包装物',
  COMPOSITE: '商品型套餐',
  SERVICE: '服务/费用商品',
  BENEFIT_SHELL: '权益商品壳',
  COUNTED: '计数销售',
  WEIGHED: '称重销售',
};

const INVENTORY_MATERIAL_ROLE_LABELS: InventoryLabelMap = {
  RAW_MATERIAL: '原材料',
  SEMI_FINISHED: '半成品',
  PACKAGING_MATERIAL: '包装物',
};

const INVENTORY_TARGET_TYPE_LABELS: InventoryLabelMap = {
  CATALOG_ITEM: '商品',
  SKU: '规格',
  OPTION_VALUE: '点单选项值',
};

const INVENTORY_STOCK_STATE_LABELS: InventoryLabelMap = {
  IN_STOCK: '在库',
  OK: '在库',
  LOW: '低库存',
  LOW_STOCK: '低库存',
  OUT: '无库存',
  OUT_OF_STOCK: '无库存',
  NEGATIVE: '负库存',
  UNKNOWN: '未知',
};

/**
 * Inventory owner returns closed-set identities for these projections. Keep
 * their user-facing labels at one boundary so an internal value cannot be
 * rendered directly by a table column or a detail description.
 */
const INVENTORY_OPERATION_LABELS: InventoryLabelMap = {
  COUNT: '存量盘点',
  INCREASE: '库存增加',
  ADJUST: '人工调整',
  ORDER_DEDUCTION: '订单扣减',
  RESTORE: '库存恢复',
  MANUAL_ADJUSTMENT: '人工调整',
  MANUAL_COUNT_COVERAGE: '存量盘点',
  GOVERNANCE_ADJUSTMENT: '库存治理调整',
};

const INVENTORY_REASON_LABELS: InventoryLabelMap = {
  RECOUNT: '盘点复核',
  RECEIPT: '收货/增加',
  WASTE: '报损/废弃',
  TRANSFER: '调拨',
  CORRECTION: '盘点纠正',
  OTHER: '其他已核实原因',
};

const INVENTORY_REFERENCE_SOURCE_KIND_LABELS: InventoryLabelMap = {
  ITEM: '商品',
  CATALOG_ITEM: '商品',
  SKU: '规格',
  OPTION_VALUE: '点单选项值',
};

const INVENTORY_DEDUCTION_TIMING_LABELS: InventoryLabelMap = {
  BOM: '按 BOM 扣组件库存',
};

function inventoryClosedSetLabel(value: string | null | undefined, labels: InventoryLabelMap) {
  if (!value) return '—';
  return labels[value] ?? '未识别';
}

export function inventoryShapeLabel(value: string | null | undefined) {
  return inventoryClosedSetLabel(value, INVENTORY_SHAPE_LABELS);
}

export function inventoryMaterialRoleLabel(value: string | null | undefined) {
  return inventoryClosedSetLabel(value, INVENTORY_MATERIAL_ROLE_LABELS);
}

export function inventoryTargetTypeLabel(value: string | null | undefined) {
  return inventoryClosedSetLabel(value, INVENTORY_TARGET_TYPE_LABELS);
}

export function inventoryStockStateLabel(value: string | null | undefined) {
  return inventoryClosedSetLabel(value, INVENTORY_STOCK_STATE_LABELS);
}

export function inventoryOperationLabel(value: string | null | undefined) {
  return inventoryClosedSetLabel(value, INVENTORY_OPERATION_LABELS);
}

export function inventoryReasonLabel(value: string | null | undefined) {
  return inventoryClosedSetLabel(value, INVENTORY_REASON_LABELS);
}

export function inventoryReferenceSourceKindLabel(value: string | null | undefined) {
  return inventoryClosedSetLabel(value, INVENTORY_REFERENCE_SOURCE_KIND_LABELS);
}

export function inventoryDeductionTimingLabel(value: string | null | undefined) {
  return inventoryClosedSetLabel(value, INVENTORY_DEDUCTION_TIMING_LABELS);
}

export function inventoryUnitLabel(snapshot: InventoryUnitSnapshot | null | undefined): ReactNode {
  if (!snapshot) return '—';
  return createElement(NameCodeText, {name: snapshot.name, code: snapshot.code});
}

export function inventoryConversionLabel(facts: InventoryConversionFacts | null | undefined): ReactNode {
  if (!facts) return '换算信息暂缺';
  if (!facts.countingUnitSnapshot) {
    return createElement(
      'span',
      null,
      '按 ',
      createElement(NameCodeText, {
        name: facts.consumptionUnitSnapshot.name,
        code: facts.consumptionUnitSnapshot.code,
      }),
      ' 记录',
    );
  }
  return createElement(
    'span',
    null,
    '1 ',
    createElement(NameCodeText, {
      name: facts.countingUnitSnapshot.name,
      code: facts.countingUnitSnapshot.code,
    }),
    ' = ',
    facts.conversionFactor,
    ' ',
    createElement(NameCodeText, {
      name: facts.consumptionUnitSnapshot.name,
      code: facts.consumptionUnitSnapshot.code,
    }),
  );
}

export type InventoryTargetSummary = {
  targetRef: Uuid;
  targetType: string;
  productCode: string;
  productName: string;
  skuCode: string | null;
  skuName: string | null;
  categoryName: string | null;
  materialRole: string | null;
  consumptionUnitSnapshot: InventoryUnitSnapshot;
  countingUnitSnapshot: InventoryUnitSnapshot | null;
  conversionFacts?: InventoryConversionFacts;
  conversionSummary: string | null;
  balance: string;
  stockState: string;
  stale: boolean;
  unknown: boolean;
  threshold: string | null;
  gap: string | null;
  changeToday: string;
  change7d: string;
  change30d: string;
  lastChangeSource: string | null;
  lastChangeAt: number | null;
  authorityType: 'INTERNAL';
};

export type PeriodChange = {period?: string; increase: string; decrease: string; netChange: string; entryCount: number};
export type InventoryLedgerEntry = {
  entryRef: Uuid;
  source: string;
  reasonCode: string;
  beforeQuantity: string;
  changeQuantity: string;
  afterQuantity: string;
  occurredAt: number;
  consumptionUnitSnapshot: InventoryUnitSnapshot;
};
export type InventoryHistoryEntry = {
  entryRef: Uuid;
  action: string;
  quantity: string;
  beforeQuantity: string;
  afterQuantity: string;
  occurredAt: number;
  source: string;
  reasonCode: string;
  consumptionUnitSnapshot: InventoryUnitSnapshot;
};
export type InventoryReference = {
  sourceCode: string;
  sourceKind: string;
  sourceName?: string;
  ownerScope?: {ownerType: string; ownerRef: Uuid; brandRef: Uuid};
  quantity: string;
  consumptionUnitSnapshot: InventoryUnitSnapshot;
  timing: string;
};
export type InventoryCurrentView = {
  target: InventoryTargetSummary & {productShape: string};
  balance: string;
  version: number;
  configuration: {
    allowNegative: boolean;
    lowStockThreshold: string | null;
    countingUnitSnapshot: InventoryUnitSnapshot | null;
    conversionFactor?: string | null;
  };
  stockState: string;
  stale: boolean;
  unknown: boolean;
  threshold: string | null;
  gap: string | null;
  changeSummary: {today: PeriodChange; sevenDays: PeriodChange; thirtyDays: PeriodChange};
  recentChanges: Array<{occurredAt: number; changeType: string; quantity: string; source: string}>;
  diagnosticsAvailability: {canRead: boolean; reason: string | null};
};

/**
 * Inventory actions may only enter quantities in the units already owned by
 * the current inventory object: its consumption unit and, when configured,
 * its counting-unit snapshot. The catalog unit dictionary is not an action
 * candidate source; the owner command accepts the same closed set.
 */
export function inventorySelectableUnitSnapshots(
  current: Pick<InventoryCurrentView, 'target' | 'configuration'>,
): InventoryUnitSnapshot[] {
  const configuredCountingUnit = current.configuration.countingUnitSnapshot ?? current.target.countingUnitSnapshot;
  return [
    ...new Map(
      [current.target.consumptionUnitSnapshot, configuredCountingUnit]
        .filter((unit): unit is InventoryUnitSnapshot => Boolean(unit))
        .map(unit => [unit.unitRef, unit]),
    ).values(),
  ];
}

export type InventoryPage = {
  items: InventoryTargetSummary[];
  cursor: string;
  total: number;
  generation: string;
  counts?: Partial<InventoryCounts>;
};
export type CursorPage<T> = {entries: T[]; cursor: string; total: number};
export type InventoryWriteResult = {
  targetRef: Uuid;
  before: string;
  change: string;
  after: string;
  ledgerEntryRef: Uuid | '—';
  stockState: string;
  version: number;
};

export function inventoryAuthorityLabel(authorityType: string | null | undefined) {
  return inventoryClosedSetLabel(authorityType, {INTERNAL: '内部轻库存'});
}

export function envelopeData<T>(envelope: CatalogInventoryEnvelope | undefined): T | undefined {
  // Page reads are enveloped, while detail/zone reads are typed raw models in
  // the OpenAPI surface. Decode both at the transport boundary so a valid raw
  // owner read is not silently rendered as an empty drawer.
  return (envelope?.data ?? envelope?.result ?? envelope) as T | undefined;
}

export function envelopeResult<T>(envelope: CatalogInventoryEnvelope | undefined): T | undefined {
  return envelope?.result as T | undefined;
}

export function hasCapability(keys: readonly string[], capability: string) {
  return keys.includes(capability);
}

export function matchesStockView(row: InventoryTargetSummary, view: StockView) {
  if (view === 'ALL') return true;
  if (view === 'NEEDS_ATTENTION')
    return row.unknown || row.stale || ['LOW', 'OUT', 'NEGATIVE', 'UNKNOWN'].includes(row.stockState);
  return row.stockState === view;
}

export function jsonBody<T extends object>(value: T): T {
  return value;
}
