// GENERATED FILE. DO NOT EDIT. sourceSha256=cc6e9e397769e5919abbeb4a6dd487746e0f2354434453307cd9f5c8eb15e262

export type StoreOperatingRuleValueType = 'BOOLEAN' | 'NUMBER' | 'STRING';
export type StoreOperatingRuleKey = "catalogManagementEnabled" | "externalCatalogSyncEnabled" | "openPlatformDeveloperCode" | "reservationEnabled" | "reservationDepositEnabled" | "queueCallEnabled" | "tableManagementEnabled" | "tableStatusEnabled" | "tableWaitCallEnabled" | "banquetOrderEnabled" | "pickupCallEnabled" | "receivableEnabled";
export type StoreOperatingRuleValue = boolean | number | string;
export type StoreOperatingRuleValues = Record<StoreOperatingRuleKey, StoreOperatingRuleValue>;

export type StoreOperatingRuleDefinition = {
  key: StoreOperatingRuleKey;
  label: string;
  type: StoreOperatingRuleValueType;
  defaultValue: StoreOperatingRuleValue;
  parentKey: StoreOperatingRuleKey | null;
  displayOrder: number;
};

export const STORE_OPERATING_RULE_SOURCE_SHA256 = "cc6e9e397769e5919abbeb4a6dd487746e0f2354434453307cd9f5c8eb15e262" as const;
export const STORE_OPERATING_RULE_DEFINITIONS: readonly StoreOperatingRuleDefinition[] = [
  { key: "catalogManagementEnabled", label: "是否启用商品、库存和菜单管理", type: "BOOLEAN", defaultValue: false, parentKey: null, displayOrder: 1 },
  { key: "externalCatalogSyncEnabled", label: "是否启用外部商品、库存、菜单同步", type: "BOOLEAN", defaultValue: false, parentKey: "catalogManagementEnabled", displayOrder: 2 },
  { key: "openPlatformDeveloperCode", label: "开放平台开发者编码", type: "STRING", defaultValue: "", parentKey: "externalCatalogSyncEnabled", displayOrder: 3 },
  { key: "reservationEnabled", label: "是否启用预约功能", type: "BOOLEAN", defaultValue: false, parentKey: "catalogManagementEnabled", displayOrder: 4 },
  { key: "reservationDepositEnabled", label: "是否支持押金预约", type: "BOOLEAN", defaultValue: false, parentKey: "reservationEnabled", displayOrder: 5 },
  { key: "queueCallEnabled", label: "是否启用排队叫号", type: "BOOLEAN", defaultValue: false, parentKey: "catalogManagementEnabled", displayOrder: 6 },
  { key: "tableManagementEnabled", label: "是否启用桌台和二维码管理", type: "BOOLEAN", defaultValue: false, parentKey: "catalogManagementEnabled", displayOrder: 7 },
  { key: "tableStatusEnabled", label: "是否启用桌台状态管理", type: "BOOLEAN", defaultValue: false, parentKey: "tableManagementEnabled", displayOrder: 8 },
  { key: "tableWaitCallEnabled", label: "是否支持「等叫」功能", type: "BOOLEAN", defaultValue: false, parentKey: "tableStatusEnabled", displayOrder: 9 },
  { key: "banquetOrderEnabled", label: "是否支持宴会订单", type: "BOOLEAN", defaultValue: false, parentKey: "tableStatusEnabled", displayOrder: 10 },
  { key: "pickupCallEnabled", label: "是否启用取餐叫号", type: "BOOLEAN", defaultValue: false, parentKey: "catalogManagementEnabled", displayOrder: 11 },
  { key: "receivableEnabled", label: "是否支持应收单管理", type: "BOOLEAN", defaultValue: false, parentKey: null, displayOrder: 12 }
] as const;

const definitionByKey = new Map(STORE_OPERATING_RULE_DEFINITIONS.map((definition) => [definition.key, definition]));

export function storeOperatingRuleDefaults(): StoreOperatingRuleValues {
  return Object.fromEntries(STORE_OPERATING_RULE_DEFINITIONS.map((definition) => [definition.key, definition.defaultValue])) as StoreOperatingRuleValues;
}

export function storeOperatingRuleApplicable(values: StoreOperatingRuleValues, key: StoreOperatingRuleKey): boolean {
  const definition = definitionByKey.get(key);
  if (!definition?.parentKey) return true;
  return storeOperatingRuleEffective(values, definition.parentKey) === true;
}

export function storeOperatingRuleEffective(values: StoreOperatingRuleValues, key: StoreOperatingRuleKey): boolean | StoreOperatingRuleValue {
  const definition = definitionByKey.get(key);
  if (!definition) throw new Error('unknown store operating rule key');
  const value = values[key] ?? definition.defaultValue;
  if (definition.type !== 'BOOLEAN') return value;
  return storeOperatingRuleApplicable(values, key) && value === true;
}
