export type AuditChangeLike = {
  fieldKey: string;
  fieldLabelSnapshot?: string | null;
  beforeState?: string | null;
  beforeValue?: string | null;
  afterState?: string | null;
  afterValue?: string | null;
};

const FIXED_FIELD_LABELS: Record<string, string> = {
  groupWorkspaceKey: '集团空间编码',
  status: '状态',
  displayName: '显示名称',
  name: '名称',
  legalName: '法定名称',
  creditCode: '统一代码',
  alias: '别名',
  remark: '备注',
  notes: '说明',
  description: '说明',
  contractNo: '合同编号',
  effectiveFrom: '生效日期',
  effectiveTo: '失效日期',
  relationship: '关联关系',
  lifecycleEvent: '生命周期事件',
  serviceNodeAssignment: '任职',
  pageAccessKeys: '可使用的功能菜单',
  capabilityKeys: '可执行的操作',
  phaseName: '项目分期',
  items: '货号',
  logo: 'Logo',
  fieldDefinitions: '字段定义',
  revision: '版本',
  itemCodes: '货号',
  note: '备注',
  operationsTitle: '运营管理后台标题名称',
  commercialGroupCode: '集团编码',
  commercialGroupName: '集团名称',
};

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  COMMERCIAL_GROUP_INITIALIZED: '已初始化商业集团',
  ORGANIZATION_NODE_CREATED: '已创建组织节点',
  ORGANIZATION_NODE_UPDATED: '已更新组织节点',
  ORGANIZATION_NODE_STATUS_CHANGED: '已更新组织节点状态',
  PROJECT_PHASE_NAMES_REPLACED: '已更新项目分期名称',
  BRAND_CREATED: '已创建品牌',
  BRAND_UPDATED: '已更新品牌',
  BRAND_STATUS_CHANGED: '已更新品牌状态',
  TENANT_CREATED: '已创建经营租户',
  TENANT_UPDATED: '已更新经营租户',
  TENANT_STATUS_CHANGED: '已更新经营租户状态',
  HEAD_COMPANY_CREATED: '已创建总公司',
  HEAD_COMPANY_UPDATED: '已更新总公司',
  HEAD_COMPANY_STATUS_CHANGED: '已更新总公司状态',
  HEAD_COMPANY_BRAND_AUTHORIZATION_ADDED: '已新增总公司品牌授权',
  HEAD_COMPANY_BRAND_AUTHORIZATION_REMOVED: '已移除总公司品牌授权',
  STORE_CREATED: '已创建门店',
  STORE_UPDATED: '已更新门店',
  STORE_STATUS_CHANGED: '已更新门店状态',
  CONTRACT_CREATED: '已创建合同',
  CONTRACT_UPDATED: '已更新合同',
  CONTRACT_INVALIDATED: '已设置合同失效',
  WORKSPACE_ACCOUNT_STATUS_CHANGED: '已更新账号状态',
  WORKSPACE_ACCOUNT_ASSIGNMENT_REVOKED: '已撤销账号任职',
  WORKSPACE_ACCOUNT_CREDENTIAL_RESET_REQUESTED: '已请求重置账号凭据',
  WORKSPACE_INVITATION_CREATED: '已创建邀请',
  WORKSPACE_INVITATION_CANCELLED: '已取消邀请',
  WORKSPACE_INVITATION_REISSUED: '已重新发送邀请',
  WORKSPACE_INVITATION_ACCEPT_INTENT_RECORDED: '已记录接受邀请意图',
  WORKSPACE_INVITATION_MOBILE_VERIFIED: '已验证手机号',
  WORKSPACE_INVITATION_CREDENTIAL_READY: '已完成凭据准备',
  WORKSPACE_INVITATION_COMPLETED: '已完成邀请',
  WORKSPACE_ROLE_CREATED: '已创建业务角色',
  ROLE_PERMISSIONS_REPLACED: '已更新业务角色授权',
  WORKSPACE_ROLE_STATUS_CHANGED: '已更新业务角色状态',
  GROUP_WORKSPACE_CREATED: '已创建集团空间',
  GROUP_WORKSPACE_UPDATED: '已更新集团空间',
  GROUP_WORKSPACE_STATUS_CHANGED: '已更新集团空间状态',
  PLATFORM_ADMIN_CREATED: '已创建管理员',
  PLATFORM_ADMIN_PROFILE_UPDATED: '已更新管理员资料',
  PLATFORM_ADMIN_STATUS_CHANGED: '已更新管理员状态',
  PLATFORM_ADMIN_CREDENTIAL_RESET: '已重置管理员登录凭据',
  EXTENSION_DEFINITION_REPLACED: '已更新字段定义',
};

export function auditFieldLabel(change: AuditChangeLike) {
  const snapshot = change.fieldLabelSnapshot?.trim();
  return snapshot || FIXED_FIELD_LABELS[change.fieldKey] || `字段（${change.fieldKey}）`;
}

export function auditValue(change: AuditChangeLike, side: 'before' | 'after') {
  const state = side === 'before' ? change.beforeState : change.afterState;
  const value = side === 'before' ? change.beforeValue : change.afterValue;
  if (!state) return value == null ? '历史记录未区分空值状态' : value;
  switch (state) {
    case 'MISSING':
      return '未填写';
    case 'NULL':
      return '空值';
    case 'CLEARED':
      return '已清空';
    case 'VALUE':
      return value == null ? '历史记录未区分空值状态' : value === '' ? '空字符串' : value;
    default:
      return value == null ? '历史记录未区分空值状态' : value;
  }
}

export function auditActionLabel(action: string) {
  return AUDIT_ACTION_LABELS[action] ?? '已记录操作';
}
