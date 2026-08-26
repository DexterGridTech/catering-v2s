import type {CatalogIdentifierType} from './catalogModel';

export const CATALOG_IDENTIFIER_PREPARATION_PROBLEM_CODES = [
  'CATALOG_IDENTIFIER_TYPE_NOT_ALLOWED',
  'CATALOG_IDENTIFIER_VALUE_INVALID',
  'CATALOG_IDENTIFIER_DUPLICATE',
  'CATALOG_IDENTIFIER_OWNER_MISMATCH',
  'CATALOG_PREPARATION_NOT_ALLOWED',
  'CATALOG_PREPARATION_TARGET_MISMATCH',
  'PRODUCTION_TAG_NOT_BINDABLE',
  'CATALOG_PREPARATION_DURATION_INVALID',
  'CATALOG_OPTION_PREPARATION_CHANGE_NOT_ALLOWED',
  'CATALOG_PREPARATION_UNKNOWN_FIELD',
] as const;

export type CatalogIdentifierPreparationProblemCode = (typeof CATALOG_IDENTIFIER_PREPARATION_PROBLEM_CODES)[number];

export type CatalogFeedbackTarget =
  'identifier' | 'skuIdentifier' | 'preparation' | 'skuPreparation' | 'optionPreparation';

export type CatalogIdentificationPreparationFeedback = {
  target: CatalogFeedbackTarget;
  message: string;
  field?: 'type' | 'value' | 'mode' | 'tags' | 'name' | 'seconds' | 'notes' | 'instruction';
};

/**
 * Server problem codes are transport facts. This exhaustive table is the only
 * business-language boundary for the two new editor surfaces.
 */
export const CATALOG_IDENTIFICATION_PREPARATION_FEEDBACK = {
  CATALOG_IDENTIFIER_TYPE_NOT_ALLOWED: {
    target: 'identifier',
    field: 'type',
    message: '当前商品形态不支持这种识别方式',
  },
  CATALOG_IDENTIFIER_VALUE_INVALID: {
    target: 'identifier',
    field: 'value',
    message: '识别值格式不正确，请检查填写内容',
  },
  CATALOG_IDENTIFIER_DUPLICATE: {
    target: 'identifier',
    field: 'value',
    message: '该识别码已被同一品牌下的其他商品或规格使用',
  },
  CATALOG_IDENTIFIER_OWNER_MISMATCH: {
    target: 'skuIdentifier',
    field: 'value',
    message: '这条识别码不属于当前规格，请重新加载后核对',
  },
  CATALOG_PREPARATION_NOT_ALLOWED: {
    target: 'preparation',
    message: '当前商品形态不能填写制作信息',
  },
  CATALOG_PREPARATION_TARGET_MISMATCH: {
    target: 'preparation',
    message: '制作信息与当前商品或规格不匹配，请重新打开后核对',
  },
  PRODUCTION_TAG_NOT_BINDABLE: {
    target: 'preparation',
    field: 'tags',
    message: '所选生产标签已不可使用，请重新选择',
  },
  CATALOG_PREPARATION_DURATION_INVALID: {
    target: 'preparation',
    field: 'seconds',
    message: '预计制作时长请填写零或正整数',
  },
  CATALOG_OPTION_PREPARATION_CHANGE_NOT_ALLOWED: {
    target: 'optionPreparation',
    message: '点单选项的制作变化只能增加制作时长或追加说明',
  },
  CATALOG_PREPARATION_UNKNOWN_FIELD: {
    target: 'preparation',
    message: '制作信息包含无法识别的内容，请重新打开后填写',
  },
} as const satisfies Record<CatalogIdentifierPreparationProblemCode, CatalogIdentificationPreparationFeedback>;

export const CATALOG_IDENTIFIER_TYPE_LABELS: Readonly<Record<CatalogIdentifierType, string>> = {
  BARCODE: '条码',
  PLU: '称重键码（PLU）',
  MNEMONIC: '助记码',
};

export function catalogIdentifierProblemFeedback(
  code: string | undefined,
): CatalogIdentificationPreparationFeedback | undefined {
  if (!code || !Object.hasOwn(CATALOG_IDENTIFICATION_PREPARATION_FEEDBACK, code)) return undefined;
  return CATALOG_IDENTIFICATION_PREPARATION_FEEDBACK[code as CatalogIdentifierPreparationProblemCode];
}
