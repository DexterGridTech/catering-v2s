import type {BusinessChannelTemplateView, BusinessChannelView} from '../../../app/api/generated/operations-edge';

type AccessKind = BusinessChannelTemplateView['accessKind'];
type OperatorKind = BusinessChannelTemplateView['operatorKind'];
type OrderKind = BusinessChannelTemplateView['orderKind'];
type DineInForm = Exclude<BusinessChannelTemplateView['dineInForm'], null | undefined>;
type LifecycleStatus = BusinessChannelTemplateView['status'];
type OwnerNodeType = BusinessChannelView['ownerNodeType'];
type BindingStatus = BusinessChannelView['bindingStatus'];
type StatusDimensionType = BusinessChannelView['statusDimensions'][number]['type'];

export const accessKindLabels = {
  INTERNAL: '内部接入',
  EXTERNAL: '外部接入',
} satisfies Record<AccessKind, string>;

export const operatorKindLabels = {
  PROJECT: '项目',
  STORE: '门店',
} satisfies Record<OperatorKind, string>;

export const orderKindLabels = {
  DINE_IN: '到店点餐',
  TAKEAWAY: '外卖',
  GROUP_BUY: '团购',
} satisfies Record<OrderKind, string>;

export const dineInFormLabels = {
  POS: 'POS',
  QR: '扫码',
  KIOSK: '自助机',
} satisfies Record<DineInForm, string>;

export const lifecycleStatusLabels = {
  ENABLED: '启用',
  DISABLED: '停用',
  VOIDED: '标记删除',
} satisfies Record<LifecycleStatus, string>;

export const ownerNodeTypeLabels = {
  PROJECT: '项目',
  STORE: '门店',
} satisfies Record<OwnerNodeType, string>;

export const bindingStatusLabels = {
  NOT_REQUIRED: '无需绑定',
  UNBOUND: '未绑定',
  BOUND: '已绑定',
} satisfies Record<BindingStatus, string>;

export const statusDimensionTypeLabels = {
  BUSINESS_CHANNEL_TEMPLATE: '渠道模板',
  GROUP_WORKSPACE: '集团空间',
  ORGANIZATION_GROUP: '集团',
  ORGANIZATION_REGION: '大区',
  ORGANIZATION_PROJECT: '项目',
  ORGANIZATION_STORE: '门店',
  ORGANIZATION_TENANT: '租户',
  ORGANIZATION_BRAND: '品牌',
  COLLABORATION_EXTERNAL_SYSTEM: '外部系统',
  COLLABORATION_PROVIDER_PROFILE: '接入档案',
  COLLABORATION_BINDING: '协作绑定',
} satisfies Record<StatusDimensionType, string>;

/** All business-channel closed-set labels live in one module for this app. */
export const businessChannelCodeLabels = {
  accessKind: accessKindLabels,
  operatorKind: operatorKindLabels,
  orderKind: orderKindLabels,
  dineInForm: dineInFormLabels,
  status: lifecycleStatusLabels,
  ownerNodeType: ownerNodeTypeLabels,
  bindingStatus: bindingStatusLabels,
  statusDimensionType: statusDimensionTypeLabels,
} as const;
