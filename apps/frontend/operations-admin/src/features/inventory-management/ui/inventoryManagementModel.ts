import type {CatalogInventoryEnvelope, Uuid} from '../../../app/api/generated/catalog-inventory-edge';

export type StockView = 'ALL' | 'NEEDS_ATTENTION' | 'LOW' | 'OUT' | 'NEGATIVE' | 'UNKNOWN';

export type InventoryCounts = Record<StockView, number>;

export type InventoryTargetSummary = {
  targetRef: Uuid;
  targetType: string;
  productCode: string;
  productName: string;
  skuCode: string | null;
  skuName: string | null;
  categoryName: string | null;
  materialRole: string | null;
  consumptionUnit: string;
  countingUnit: string | null;
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
};
export type InventoryReference = {
  sourceCode: string;
  sourceKind: string;
  sourceName?: string;
  ownerScope?: {ownerType: string; ownerRef: Uuid; brandRef: Uuid};
  quantity: string;
  unit: string;
  timing: string;
  status: string;
};
export type InventoryDiagnostics = {
  permission: {granted: boolean; reason: string | null};
  queries: Array<{queryName: string; databaseOperationCount: number; durationMillis: number}>;
  timings: Array<{queryName: string; durationMillis: number}>;
  warnings: Array<{code: string; message: string}>;
};

export type InventoryCurrentView = {
  target: InventoryTargetSummary & {productShape: string};
  balance: string;
  version: number;
  configuration: {
    allowNegative: boolean;
    lowStockThreshold: string | null;
    countingUnit?: string | null;
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
  if (authorityType === 'INTERNAL') return '内部轻库存';
  return authorityType ?? '—';
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

export function shouldRequestInventoryDiagnostics(drawerOpen: boolean) {
  return drawerOpen;
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
