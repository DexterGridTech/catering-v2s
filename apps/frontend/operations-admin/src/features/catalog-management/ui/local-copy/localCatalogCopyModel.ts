import {catalogCopyObjectTypeLabel} from '../../model/catalog/catalogCopyModel';
import type {
  LocalCopyCandidatePage,
  LocalCopyPreflight,
  LocalCopyReadback,
} from '../../../../app/api/generated/catalog-inventory-edge';

export const LOCAL_COPY_SCOPE_VALUES = [
  'BASIC_INFO',
  'SKU_STRUCTURE',
  'SKU_BOM',
  'ORDER_OPTIONS',
  'OPTION_VALUE_BOM',
  'ITEM_BOM',
  'PACKAGE_STRUCTURE',
  'PRODUCTION_PROMPTS',
] as const;

export type LocalCopyScope = (typeof LOCAL_COPY_SCOPE_VALUES)[number];
export type LocalCopyCandidatePageData = LocalCopyCandidatePage['data'];
export type LocalCopyPreflightData = LocalCopyPreflight['data'];
export type LocalCopyReadbackData = LocalCopyReadback['data'];

export type WizardStep = 'source-scope' | 'source-item' | 'copy-scope' | 'bom-mapping' | 'preview';

export const LOCAL_COPY_USER_VISIBLE_COPY = {
  steps: [
    {key: 'source-scope', title: '来源范围'},
    {key: 'source-item', title: '来源商品'},
    {key: 'copy-scope', title: '复制范围'},
    {key: 'bom-mapping', title: 'BOM映射'},
    {key: 'preview', title: '预览确认'},
  ] satisfies Array<{key: WizardStep; title: string}>,
  scopeDescriptions: {
    BASIC_INFO: '复制名称、属性、图片、分类、标签和销售单位等基础资料；商品编码与来源身份不变。',
    SKU_STRUCTURE: '复制规格结构、规格维度与规格行；目标商品现有规格会按检查影响结果处理。',
    SKU_BOM: '复制各规格的库存与 BOM 配置，并按目标商品的规格与库存对象重新建立引用。',
    ORDER_OPTIONS: '复制点单选项组和值，供点单选项页签继续维护。',
    OPTION_VALUE_BOM: '复制点单选项值上的 BOM，并按目标商品的选项值重新建立引用。',
    ITEM_BOM: '复制商品的库存与 BOM 配置，并按目标商品的库存对象重新建立引用。',
    PACKAGE_STRUCTURE: '复制套餐组件关系，并按目标商品的组件规格重新建立引用。',
    PRODUCTION_PROMPTS: '复制制作信息和生产标签等商品制作配置。',
  } satisfies Record<LocalCopyScope, string>,
} as const;

export const LOCAL_COPY_STEPS = LOCAL_COPY_USER_VISIBLE_COPY.steps;
export const DEFAULT_LOCAL_COPY_SCOPES: LocalCopyScope[] = ['BASIC_INFO'];

export const LOCAL_COPY_SCOPE_DEPENDENCIES: Array<[LocalCopyScope, LocalCopyScope[]]> = [
  ['SKU_BOM', ['SKU_STRUCTURE']],
  ['OPTION_VALUE_BOM', ['ORDER_OPTIONS']],
];

export const LOCAL_COPY_SCOPE_DESCRIPTIONS = LOCAL_COPY_USER_VISIBLE_COPY.scopeDescriptions;

export function decodeLocalCopyCandidatePage(
  response: LocalCopyCandidatePage | undefined,
): LocalCopyCandidatePageData | undefined {
  return response?.data;
}

export function decodeLocalCopyPreflight(response: LocalCopyPreflight | undefined): LocalCopyPreflightData | undefined {
  const value = response?.data;
  return value?.preflightDigest ? value : undefined;
}

export function decodeLocalCopyReadback(response: LocalCopyReadback | undefined): LocalCopyReadbackData | undefined {
  const value = response?.data;
  return value?.preflightDigest ? value : undefined;
}

export function copyScopeTabKey(scope: LocalCopyScope): string {
  switch (scope) {
    case 'BASIC_INFO':
      return 'basic';
    case 'SKU_STRUCTURE':
      return 'sku-specifications-pricing';
    case 'SKU_BOM':
    case 'ITEM_BOM':
      return 'inventory-bom';
    case 'ORDER_OPTIONS':
      return 'order-options';
    case 'OPTION_VALUE_BOM':
      return 'inventory-bom';
    case 'PACKAGE_STRUCTURE':
      return 'composite-content';
    case 'PRODUCTION_PROMPTS':
      return 'production-prompts';
    default:
      return assertNever(scope);
  }
}

function assertNever(value: never): never {
  throw new Error(`UNSUPPORTED_LOCAL_COPY_SCOPE:${String(value)}`);
}

export function mappingColor(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes('block') || normalized.includes('不可') || normalized.includes('fail')) return 'red';
  if (normalized.includes('skip') || normalized.includes('未解') || normalized.includes('warn')) return 'gold';
  return 'green';
}

export function referenceMappingLabel(row: LocalCopyPreflightData['referenceMappings'][number]) {
  return [
    catalogCopyObjectTypeLabel(row.objectType),
    row.targetCode,
    row.targetSkuCode && `规格编码：${row.targetSkuCode}`,
    row.targetOptionValueCode && `选项：${row.targetOptionValueCode}`,
  ]
    .filter(Boolean)
    .join(' / ');
}
