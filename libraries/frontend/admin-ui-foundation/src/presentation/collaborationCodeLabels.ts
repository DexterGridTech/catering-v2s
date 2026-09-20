import {closedCodeLabel} from './closedCode';

/**
 * Pure collaboration vocabulary shared by both admin faces.
 * Generated API unions stay in each app adapter; this module owns only the
 * user-facing values so the two generated contracts cannot drift apart.
 */
const capabilityClassLabels = {
  MASTER_DATA_SYNC: '主数据同步',
  MEMBER_BENEFIT: '用户与权益',
  DINE_IN: '到店点餐',
  GROUP_BUY: '团购',
  TAKEAWAY: '外卖',
  INVENTORY_SYNC: '库存',
  TAKEAWAY_DELIVERY: '外卖配送',
  ORDER_SYNC: '订单同步',
} as const;

const groupBuyMappingDirectionLabels = {
  EXTERNAL_TO_INTERNAL: '外部映射到内部',
  INTERNAL_TO_EXTERNAL: '内部映射到外部',
} as const;

const menuCollaborationDirectionLabels = {PULL_ONLY: '仅拉取外部菜单'} as const;

const collaborationBindingStatusLabels = {
  PENDING_AUTHORIZATION: '待授权',
  EFFECTIVE: '有效',
  INVALID: '无效',
  DELETED: '已删除',
} as const;

const organizationNodeTypeLabels = {
  COMMERCIAL_GROUP: '集团',
  REGION: '大区',
  PROJECT: '项目',
  HEAD_COMPANY: '总公司',
  STORE: '门店',
} as const;

const providerBusinessScopeLabels = {
  DINE_IN: '到店点餐',
  TAKEAWAY: '外卖',
  GROUP_BUY: '团购',
  ORDER_SYNC: '订单同步',
  MEMBER_BENEFIT: '用户与权益',
} as const;

const authenticationKindLabels = {
  EXTERNAL_GRANT: '需要外部平台授权',
  INTERNAL_MAPPING: '内部主体映射',
  NO_MAPPING: '无需主体映射',
} as const;

const unbindKindLabels = {
  LOCAL_ONLY: '本地解除绑定',
  REQUIRES_ADAPTER_UNBIND: '需外部平台解除授权',
} as const;

const catalogStatusLabels = {PLANNED: '计划中', AVAILABLE: '可用'} as const;
const attributeControlKindLabels = {readonlySummary: '只读摘要', readonlyPreview: '只读预览'} as const;
const attributeOptionSourceLabels = {enum: '枚举', endpoint: '接口', local: '本地字典'} as const;

export const collaborationCodeLabels = {
  capabilityClass: capabilityClassLabels,
  groupBuyMappingDirection: groupBuyMappingDirectionLabels,
  menuCollaborationDirection: menuCollaborationDirectionLabels,
  bindingStatus: collaborationBindingStatusLabels,
  organizationNodeType: organizationNodeTypeLabels,
  providerBusinessScope: providerBusinessScopeLabels,
  authenticationKind: authenticationKindLabels,
  unbindKind: unbindKindLabels,
  catalogStatus: catalogStatusLabels,
  attributeControlKind: attributeControlKindLabels,
  attributeOptionSource: attributeOptionSourceLabels,
} as const;

export type CollaborationAttributeControlKind = keyof typeof attributeControlKindLabels;
export type CollaborationAttributeOptionSource = keyof typeof attributeOptionSourceLabels;

export const collaborationAttributePresentation = {
  groupBuyMappingDirection: {
    label: '团购商品映射方向',
    helpText: '团购商品由外部映射到内部，还是由内部映射到外部',
    controlKind: 'readonlySummary' as CollaborationAttributeControlKind,
    optionSourceRef: 'enum' as CollaborationAttributeOptionSource,
  },
  menuCollaborationDirection: {
    label: '菜单协作方向',
    helpText: '只拉取外部菜单，还是支持将本地菜单推送到外部平台',
    controlKind: 'readonlySummary' as CollaborationAttributeControlKind,
    optionSourceRef: 'enum' as CollaborationAttributeOptionSource,
  },
} as const;

export function collaborationAttributeValueLabel(fieldKey: string, value: unknown): string | undefined {
  if (fieldKey === 'groupBuyMappingDirection' && typeof value === 'string') {
    return closedCodeLabel(collaborationCodeLabels.groupBuyMappingDirection, value, '当前值无法识别');
  }
  if (fieldKey === 'menuCollaborationDirection' && typeof value === 'string') {
    return closedCodeLabel(collaborationCodeLabels.menuCollaborationDirection, value, '当前值无法识别');
  }
  return undefined;
}
