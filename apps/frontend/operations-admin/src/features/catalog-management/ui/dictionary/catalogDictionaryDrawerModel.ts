export type DictionaryKind = 'TAG' | 'UNIT' | 'SKU_ATTRIBUTE' | 'SKU_ATTRIBUTE_VALUE' | 'PRODUCTION_TAG';

export type FormValues = {
  code: string;
  name: string;
  unitDimension?: 'COUNT' | 'WEIGHT' | 'VOLUME' | 'SERVICE_DURATION' | 'PACKAGE';
  precision?: number;
};

export type VoidAvailability = {
  canVoid: boolean;
  blockingReferences: Array<{referenceKind: string; referenceRef: string}>;
  dependentFacts: Array<{factKind: string; factRef: string}>;
};

export function voidReason(value?: VoidAvailability) {
  if (!value || value.canVoid) return undefined;
  if (value.blockingReferences.some(entry => entry.referenceKind === 'CATALOG_ITEM')) {
    return '仍被商品或规格使用';
  }
  if (value.blockingReferences.length > 0) return '仍被其他业务记录使用';
  if (value.dependentFacts.length > 0) return '仍存在关联业务数据';
  return '当前条目暂不能删除';
}

export function deleteActionLabel(_value?: VoidAvailability) {
  // Availability changes the control state and its business reason, never the
  // action's meaning. A different disabled label made the same lifecycle
  // action look like a second operation in the configuration libraries.
  return '删除';
}

export const dictionaryKindLabels: Record<DictionaryKind, string> = {
  TAG: '商品标签',
  UNIT: '计量单位',
  SKU_ATTRIBUTE: '规格维度',
  SKU_ATTRIBUTE_VALUE: '属性值',
  PRODUCTION_TAG: '生产标签',
};

export const dictionaryDescriptions: Record<Exclude<DictionaryKind, 'SKU_ATTRIBUTE_VALUE'>, string> = {
  TAG: '为商品补充业务特征，方便筛选和运营管理。',
  UNIT: '维护有限的计量单位定义；精度属于单位本身，停用只影响后续候选。',
  SKU_ATTRIBUTE: '定义商品可售规格的维度及其可选值，例如杯型与中杯。',
  PRODUCTION_TAG: '维护商品的生产标签，供后厨识别。',
};

export const DICTIONARY_PAGE_SIZE = 50;

export const unitDimensionOptions: Array<{value: NonNullable<FormValues['unitDimension']>; label: string}> = [
  {value: 'COUNT', label: '计数'},
  {value: 'WEIGHT', label: '重量'},
  {value: 'VOLUME', label: '体积'},
  {value: 'SERVICE_DURATION', label: '服务时长'},
  {value: 'PACKAGE', label: '包装'},
];

export function unitDimensionLabel(value?: FormValues['unitDimension']) {
  return unitDimensionOptions.find(option => option.value === value)?.label ?? value ?? '—';
}

export function catalogUnitVoidControlState({
  canWrite,
  isReferenced,
  isTransitioning,
}: {
  canWrite: boolean;
  isReferenced: boolean | undefined;
  isTransitioning: boolean;
}): {disabled: boolean; reason?: string} {
  if (!canWrite) return {disabled: true, reason: '当前账号只有查看商品库的权限，不能修改字典。'};
  if (isReferenced) return {disabled: true, reason: '该计量单位正在使用，不能删除；可以停用。'};
  if (isTransitioning) return {disabled: true, reason: '正在更新状态，请稍候。'};
  return {disabled: false};
}

export function catalogUnitStatusQuery(status?: string): {status?: 'ENABLED' | 'DISABLED' | 'VOIDED'} {
  if (status === 'ENABLED' || status === 'DISABLED' || status === 'VOIDED') return {status};
  return {};
}

export function catalogConfigurationChangeNeedsConfirmation({
  configurationLifecycleDirty,
  definitionDirtyMessage,
}: {
  configurationLifecycleDirty: boolean;
  definitionDirtyMessage?: string;
}) {
  return configurationLifecycleDirty || Boolean(definitionDirtyMessage);
}
