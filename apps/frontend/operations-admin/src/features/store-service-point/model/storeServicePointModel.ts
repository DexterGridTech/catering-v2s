import dayjs, {type Dayjs} from 'dayjs';
import {LIFECYCLE_LABELS} from '@catering-v2s/admin-ui-foundation';
import type {
  ExtensionDefinition,
  JsonValue,
  StoreQrConfigurationView,
  StoreServicePoint,
  StoreServicePointArea,
  StoreServicePointAreaType,
  StoreServicePointShape,
  StoreServicePointStatus,
  StoreServicePointType,
} from '../../../app/api/generated/operations-edge';

export type StoreServicePointExtensionFormValues = Record<string, JsonValue | Dayjs | undefined>;

export type AreaEditor = {mode: 'create' | 'edit'; area?: StoreServicePointArea};

export type PointEditor = {
  mode: 'create' | 'edit';
  areaName: string;
  areaType: StoreServicePointAreaType;
  point?: StoreServicePoint;
};

export type AreaFormValues = {
  name: string;
  code: string;
  areaType: StoreServicePointAreaType;
};

export type PointFormValues = {
  name: string;
  code: string;
  seatCapacity?: number;
  tableShape?: StoreServicePointShape;
  reservable?: boolean | null;
  extensionValues?: Record<string, JsonValue | Dayjs | undefined>;
};

export type QrFormValues = {enabled: boolean; channelRef?: string};

export type QrDisplayConfiguration = Pick<StoreQrConfigurationView, 'enabled' | 'channelRef'>;

export type QrReadState = {loading: boolean; failed: boolean};

export type StoreServicePointImage = {
  id: string;
  identity: string;
  fileName: string;
  status: 'READY' | 'UPLOADING' | 'FAILED';
  file?: File;
  hasPreview: boolean;
  assetRef?: string;
  bindGrant?: string;
  version?: number;
  staged: boolean;
  error?: string;
};

export type StoreServicePointDrawerLifecycle = {
  requestClose: () => void;
  afterOpenChange: (visible: boolean) => void;
  submitting: boolean;
  setSubmitting: (value: boolean) => void;
  setDirty: (value: boolean) => void;
  markBusinessIntentChanged: () => void;
};

export const STORE_SERVICE_POINT_PAGE_SIZE = 20;
export const STORE_SERVICE_POINT_ORDER_RECEIPT_VERSION = 'swap-v2';
export const STORE_SERVICE_POINT_IMAGE_LIMITS = {maxImageCount: 1, maxImageBytes: 2 * 1024 * 1024} as const;

export const storeServicePointStatusLabels: Record<StoreServicePointStatus, string> = LIFECYCLE_LABELS;

export const storeServicePointAreaTypeLabels: Record<StoreServicePointAreaType, string> = {
  TABLE_AREA: '桌台区',
  SCAN_AREA: '扫码区',
};

export const STORE_SERVICE_POINT_OPERATION_COLUMN_TITLE = '操作';

export const storeServicePointTypeLabels: Record<StoreServicePointType, string> = {
  TABLE: '桌台',
  SCAN: '扫码点',
};

export const storeServicePointShapeLabels: Record<StoreServicePointShape, string> = {
  HALL: '大厅',
  PRIVATE_ROOM: '包间',
  BOOTH: '卡座',
  OUTDOOR: '室外',
};

export function enabledStoreServicePointExtensionFields(definition?: ExtensionDefinition) {
  return (definition?.definitions ?? [])
    .filter(field => field.status !== 'DISABLED')
    .sort((left, right) => (left.displayOrder ?? 0) - (right.displayOrder ?? 0));
}

export function hydrateStoreServicePointExtensionValues(
  definition: ExtensionDefinition | undefined,
  values: Record<string, JsonValue> | undefined,
): StoreServicePointExtensionFormValues {
  const dateKeys = new Set(
    enabledStoreServicePointExtensionFields(definition)
      .filter(field => field.type === 'DATE')
      .map(field => field.key),
  );
  return Object.fromEntries(
    Object.entries(values ?? {}).map(([key, value]) => [
      key,
      dateKeys.has(key) && typeof value === 'string' ? dayjs(value) : value,
    ]),
  ) as StoreServicePointExtensionFormValues;
}

function normalizeExtensionValue(value: JsonValue | Dayjs | undefined): JsonValue {
  if (value === undefined || value === null || value === '') return null;
  if (dayjs.isDayjs(value)) return value.format('YYYY-MM-DD');
  return value;
}

export function serializeStoreServicePointExtensionValues(
  definition: ExtensionDefinition | undefined,
  values: StoreServicePointExtensionFormValues | undefined,
): Record<string, JsonValue> {
  return Object.fromEntries(
    enabledStoreServicePointExtensionFields(definition).map(field => [
      field.key,
      normalizeExtensionValue(values?.[field.key]),
    ]),
  );
}

export function displayExtensionValue(value: JsonValue | undefined): string {
  if (value === undefined || value === null || value === '') return '—';
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (Array.isArray(value)) return value.join('、');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function pointTypeForArea(areaType: StoreServicePointAreaType): StoreServicePointType {
  return areaType === 'TABLE_AREA' ? 'TABLE' : 'SCAN';
}

export function areaTypeForPointType(pointType: StoreServicePointType): StoreServicePointAreaType {
  return pointType === 'TABLE' ? 'TABLE_AREA' : 'SCAN_AREA';
}

export function titleForArea(areaType: StoreServicePointAreaType | undefined): string {
  return areaType === 'TABLE_AREA' ? '桌台' : '扫码点';
}
