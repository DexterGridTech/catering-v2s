import {closedCodeLabel} from '@catering-v2s/admin-ui-foundation';
import type {
  ExternalCapability,
  OwnerBindingView,
  ProviderProfileView,
} from '../../../app/api/generated/operations-edge';

type CapabilityClass = ExternalCapability['capabilityClass'];
type GroupBuyMappingDirection = NonNullable<ExternalCapability['attributeValues']['groupBuyMappingDirection']>;
type MenuCollaborationDirection = NonNullable<ExternalCapability['attributeValues']['menuCollaborationDirection']>;
type BindingStatus = OwnerBindingView['status'];
type OrganizationNodeType = OwnerBindingView['nodeType'];
type ProviderBusinessScope = ProviderProfileView['businessScope'][number];
type AuthenticationKind = ProviderProfileView['authenticationKind'];
type UnbindKind = ProviderProfileView['unbindKind'];
type CatalogStatus = ProviderProfileView['catalogStatus'];
type AttributeControlKind = 'readonlySummary' | 'readonlyPreview';
type AttributeOptionSource = 'enum' | 'endpoint' | 'local';

export const capabilityClassLabels = {
  MASTER_DATA_SYNC: '主数据同步',
  MEMBER_BENEFIT: '用户与权益',
  GROUP_BUY: '团购',
  TAKEAWAY: '外卖',
  INVENTORY_SYNC: '库存',
  TAKEAWAY_DELIVERY: '外卖配送',
  ORDER_SYNC: '订单同步',
} satisfies Record<CapabilityClass, string>;

export const groupBuyMappingDirectionLabels = {
  EXTERNAL_TO_INTERNAL: '外部映射到内部',
  INTERNAL_TO_EXTERNAL: '内部映射到外部',
} satisfies Record<GroupBuyMappingDirection, string>;

export const menuCollaborationDirectionLabels = {
  PULL_ONLY: '仅拉取外部菜单',
} satisfies Record<MenuCollaborationDirection, string>;

export const collaborationBindingStatusLabels = {
  PENDING_AUTHORIZATION: '待授权',
  EFFECTIVE: '有效',
  INVALID: '无效',
  DELETED: '已删除',
} satisfies Record<BindingStatus, string>;

export const organizationNodeTypeLabels = {
  COMMERCIAL_GROUP: '集团',
  REGION: '大区',
  PROJECT: '项目',
  HEAD_COMPANY: '总公司',
  STORE: '门店',
} satisfies Record<OrganizationNodeType, string>;

export const providerBusinessScopeLabels = {
  TAKEAWAY: '外卖',
  GROUP_BUY: '团购',
  ORDER_SYNC: '订单同步',
  MEMBER_BENEFIT: '用户与权益',
} satisfies Record<ProviderBusinessScope, string>;

export const authenticationKindLabels = {
  EXTERNAL_GRANT: '需要外部平台授权',
  INTERNAL_MAPPING: '内部主体映射',
  NO_MAPPING: '无需主体映射',
} satisfies Record<AuthenticationKind, string>;

export const unbindKindLabels = {
  LOCAL_ONLY: '本地解除绑定',
  REQUIRES_ADAPTER_UNBIND: '需外部平台解除授权',
} satisfies Record<UnbindKind, string>;

export const catalogStatusLabels = {
  PLANNED: '计划中',
  AVAILABLE: '可用',
} satisfies Record<CatalogStatus, string>;

export const attributeControlKindLabels = {
  readonlySummary: '只读摘要',
  readonlyPreview: '只读预览',
} satisfies Record<AttributeControlKind, string>;

export const attributeOptionSourceLabels = {
  enum: '枚举',
  endpoint: '接口',
  local: '本地字典',
} satisfies Record<AttributeOptionSource, string>;

type AttributePresentation = {
  groupBuyMappingDirection: {
    label: string;
    helpText: string;
    controlKind: AttributeControlKind;
    optionSourceRef: AttributeOptionSource;
  };
  menuCollaborationDirection: {
    label: string;
    helpText: string;
    controlKind: AttributeControlKind;
    optionSourceRef: AttributeOptionSource;
  };
};

export const collaborationAttributePresentation: AttributePresentation = {
  groupBuyMappingDirection: {
    label: '团购商品映射方向',
    helpText: '团购商品由外部映射到内部，还是由内部映射到外部',
    controlKind: 'readonlySummary',
    optionSourceRef: 'enum',
  },
  menuCollaborationDirection: {
    label: '菜单协作方向',
    helpText: '只拉取外部菜单，还是支持将本地菜单推送到外部平台',
    controlKind: 'readonlySummary',
    optionSourceRef: 'enum',
  },
};

/** All collaboration closed-set labels consumed by operations-admin. */
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

export function collaborationAttributeValueLabel(fieldKey: string, value: unknown): string | undefined {
  if (fieldKey === 'groupBuyMappingDirection' && typeof value === 'string') {
    return closedCodeLabel(groupBuyMappingDirectionLabels, value, '当前值无法识别');
  }
  if (fieldKey === 'menuCollaborationDirection' && typeof value === 'string') {
    return closedCodeLabel(menuCollaborationDirectionLabels, value, '当前值无法识别');
  }
  return undefined;
}
