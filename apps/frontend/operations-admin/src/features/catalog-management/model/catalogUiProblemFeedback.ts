import {operationsProblemOf} from '../../../app/api/OperationsTransport';
import {catalogInventoryProblemTab} from './catalogModel';
import {catalogIdentifierProblemFeedback} from './catalogIdentificationPreparationFeedback';

export type CatalogEditorProblemTab =
  'basic' | 'identifiers' | 'sku-specifications-pricing' | 'order-options' | 'production-prompts' | 'inventory-bom';

export type CatalogUiProblemFeedback = {
  message: string;
  tab?: CatalogEditorProblemTab;
  known: boolean;
};

const CATALOG_BUSINESS_PROBLEM_COPY: Readonly<Record<string, CatalogUiProblemFeedback>> = {
  CATALOG_BASE_MEASURE_UNIT_CHANGE_BLOCKED: {
    tab: 'basic',
    known: true,
    message: '商品已有库存配置，暂不能修改基础计量单位。',
  },
  VERSION_CONFLICT: {
    known: true,
    message: '商品刚刚有更新，请重新读取最新资料后再保存。',
  },
  DUPLICATE_CODE: {
    known: true,
    message: '商品编码已被使用，请修改后再保存。',
  },
  MATERIAL_ROLE_REQUIRED: {
    tab: 'basic',
    known: true,
    message: '选择原材料、半成品或包装物时，请填写物料角色。',
  },
  STALE_COPY_PREFLIGHT: {
    known: true,
    message: '资料或来源已变化，请重新检查后再确认。',
  },
  INVENTORY_BOM_EMPTY: {
    tab: 'inventory-bom',
    known: true,
    message: '选择按配方扣减时，至少需要添加一条用料。',
  },
  PRODUCTION_TAG_NOT_BINDABLE: {
    tab: 'production-prompts',
    known: true,
    message: '所选生产标签已不可使用，请重新选择。',
  },
};

/**
 * Converts transport problems into user-facing business copy.  Explicit UI
 * mappings may add task navigation, but an unmapped catalog problem keeps the
 * owner-provided business reason instead of being replaced by a generic retry.
 */
export function catalogUiProblemFeedback(error: unknown, fallback: string): CatalogUiProblemFeedback {
  const {contractDetail, contractTitle, errorCode} = operationsProblemOf(error);
  const identification = catalogIdentifierProblemFeedback(errorCode);
  if (identification) {
    const tab =
      identification.target === 'optionPreparation'
        ? 'order-options'
        : identification.target === 'skuIdentifier' || identification.target === 'skuPreparation'
          ? 'sku-specifications-pricing'
          : identification.target === 'identifier'
            ? 'identifiers'
            : 'production-prompts';
    return {message: identification.message, tab, known: true};
  }
  const explicit = errorCode ? CATALOG_BUSINESS_PROBLEM_COPY[errorCode] : undefined;
  if (explicit) return explicit;
  const inventoryTab = errorCode ? catalogInventoryProblemTab(errorCode) : undefined;
  if (inventoryTab) {
    return {
      tab: inventoryTab,
      known: true,
      message:
        inventoryTab === 'basic'
          ? '当前基础信息暂不能保存，请核对计量单位后再试。'
          : '库存与用料配置暂不能保存，请核对后再试。',
    };
  }
  const ownerReason = contractDetail?.trim() || contractTitle?.trim();
  return {message: ownerReason || fallback, known: false};
}
