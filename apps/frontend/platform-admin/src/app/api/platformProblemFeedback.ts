import {EDGE_PROBLEM_CODES, type EdgeProblemCode} from './generated/platform-edge';

export type ProblemFeedback = {title: string; detail: string};

/**
 * Business-language feedback for every platform-facing Problem error code.
 * The generated code list is the closed contract; adding a code without copy
 * is intentionally a typecheck failure.
 */
export const PLATFORM_PROBLEM_FEEDBACK: Record<EdgeProblemCode, ProblemFeedback> = {
  EXTENSION_DEFINITION_REVISION_STALE: {title: '字段配置已变化', detail: '请刷新字段配置后重新查询。'},
  EXTENSION_FILTER_INVALID: {title: '扩展字段筛选无效', detail: '请检查扩展字段筛选条件后重试。'},
  ADAPTER_UNBIND_REQUIRED: {title: '需要外部解除授权', detail: '请先完成外部平台解除授权后重试。'},
  AUTHORIZATION_REQUIRED: {title: '需要外部授权', detail: '当前绑定由外部授权流程管理。'},
  BINDING_EDIT_NOT_ALLOWED: {title: '绑定不可编辑', detail: '当前绑定状态不支持手工修改。'},
  COMMERCIAL_GROUP_ALREADY_INITIALIZED: {title: '集团空间已初始化', detail: '该集团空间已完成初始化。'},
  DELETE_NOT_ALLOWED: {title: '绑定不可删除', detail: '当前绑定状态不支持删除。'},
  EXTENSION_DEFINITION_INVALID: {title: '字段配置不可用', detail: '当前字段配置不符合要求，请检查后重试。'},
  EXTENSION_DEFINITION_VERSION_CONFLICT: {title: '字段配置已变化', detail: '请查看最新配置后再试。'},
  EXTERNAL_OWNER_ID_MISMATCH: {title: '外部主体编号不匹配', detail: '请刷新绑定资料并检查外部主体编号。'},
  GROUP_WORKSPACE_NOT_FOUND: {title: '集团空间不存在', detail: '请刷新列表后重试。'},
  IDEMPOTENCY_CONFLICT: {title: '操作请求已变化', detail: '请重新提交当前操作。'},
  IMMUTABLE_FIELD: {title: '字段不可修改', detail: '当前字段由 owner 状态维护，不能手工修改。'},
  INVALID_EDGE_CONTEXT: {title: '当前页面已失效', detail: '请刷新页面后重试。'},
  PLATFORM_ASSET_BIND_CONFLICT: {title: 'Logo 状态已变化', detail: '请刷新详情后重试。'},
  PLATFORM_COMMON_ACCESS_DENIED: {title: '没有操作权限', detail: '当前账号无权执行此操作。'},
  PLATFORM_COMMON_AUTHENTICATION_REQUIRED: {title: '登录状态已失效', detail: '请重新登录后继续。'},
  PLATFORM_COMMON_CONTEXT_STALE: {title: '页面资料已更新', detail: '当前页面上下文已更新，请重新打开当前操作后重试。'},
  PLATFORM_COMMON_GROUP_WORKSPACE_DISABLED: {title: '集团空间不可用', detail: '当前集团空间已停用。'},
  PLATFORM_COMMON_IDEMPOTENCY_CONFLICT: {title: '操作请求已变化', detail: '请重新提交当前操作。'},
  PLATFORM_COMMON_OWNER_INVARIANT_VIOLATION: {title: '操作暂时不可用', detail: '当前资料状态异常，请稍后重试。'},
  PLATFORM_COMMON_RESOURCE_NOT_FOUND: {title: '资料不存在', detail: '请刷新页面后重试。'},
  PLATFORM_COMMON_RESULT_UNKNOWN: {title: '操作结果待确认', detail: '请刷新页面或使用原操作重试。'},
  PLATFORM_COMMON_VALIDATION_FAILED: {title: '填写内容有误', detail: '请检查填写内容后重试。'},
  PLATFORM_COMMON_VERSION_CONFLICT: {title: '资料已被更新', detail: '请查看最新资料后再试。'},
  PLATFORM_IAM_ACCOUNT_DISABLED: {title: '账号已停用', detail: '当前账号无法登录，请联系管理员。'},
  PLATFORM_IAM_CREDENTIAL_LOCKED: {title: '凭据已锁定', detail: '请稍后再试或联系管理员。'},
  PLATFORM_IAM_INVALID_CREDENTIALS: {title: '登录信息不正确', detail: '请检查登录名、手机号或验证码。'},
  PLATFORM_IAM_LOGIN_NAME_CONFLICT: {title: '登录名已存在', detail: '请更换登录名后重试。'},
  PLATFORM_IAM_RATE_LIMITED: {title: '操作暂时受限', detail: '验证码请求过于频繁，请稍后再试。'},
  PLATFORM_IAM_RESULT_UNKNOWN: {title: '登录结果待确认', detail: '请刷新页面后重试。'},
  PLATFORM_IAM_SESSION_EXPIRED: {title: '登录状态已失效', detail: '请重新登录后继续。'},
  PLATFORM_WORKSPACE_KEY_CONFLICT: {title: '集团空间编码已存在', detail: '请更换集团空间编码后重试。'},
  PLATFORM_WORKSPACE_NAME_CONFLICT: {title: '集团空间名称已存在', detail: '请更换集团空间名称后重试。'},
  PLATFORM_WORKSPACE_STATUS_TRANSITION_INVALID: {title: '状态操作不可用', detail: '当前集团空间状态不支持此操作。'},
  NODE_TYPE_NOT_BINDABLE: {title: '节点类型不可绑定', detail: '当前接入档案不支持该业务节点类型。'},
  PROVIDER_NOT_ENABLED: {title: '接入档案未启用', detail: '请先启用当前接入档案后重试。'},
  UNKNOWN_SUBMISSION_RESULT: {title: '操作结果待确认', detail: '请刷新页面或使用原操作重试。'},
  VALIDATION_FAILED: {title: '填写内容有误', detail: '请检查填写内容后重试。'},
  VERSION_CONFLICT: {title: '资料已被更新', detail: '请查看最新资料后再试。'},
  WORKSPACE_IAM_ACCOUNT_STATUS_TRANSITION_INVALID: {title: '账号状态操作不可用', detail: '当前账号状态不支持此操作。'},
  WORKSPACE_IAM_ACCOUNT_VERSION_CONFLICT: {title: '账号资料已被更新', detail: '请查看最新资料后再试。'},
  WORKSPACE_IAM_ASSIGNMENT_NOT_ACTIVE: {title: '任职已不可用', detail: '当前任职已不是可操作状态。'},
  WORKSPACE_IAM_ASSIGNMENT_VERSION_CONFLICT: {title: '任职资料已被更新', detail: '请查看最新资料后再试。'},
  WORKSPACE_IAM_CREDENTIAL_RESET_UNAVAILABLE: {title: '凭据重置不可用', detail: '当前账号暂不支持凭据重置。'},
  WORKSPACE_IAM_PAGE_ACCESS_CATALOG_MISMATCH: {title: '页面权限资料异常', detail: '请刷新页面后重试。'},
  WORKSPACE_IAM_ROLE_CAPABILITY_CATALOG_DRIFT: {title: '角色权限资料异常', detail: '请刷新页面后重试。'},
  WORKSPACE_IAM_ROLE_CAPABILITY_INCOMPATIBLE: {title: '角色权限组合不可用', detail: '请调整权限后重试。'},
  WORKSPACE_IAM_ROLE_CAPABILITY_UNKNOWN: {title: '角色权限不可识别', detail: '请重新选择权限后重试。'},
  WORKSPACE_IAM_ROLE_NAME_CONFLICT: {title: '角色名称已存在', detail: '请更换角色名称后重试。'},
  WORKSPACE_IAM_ROLE_SERVICE_NODE_TYPE_UNSUPPORTED: {title: '角色范围不可用', detail: '当前组织类型不支持此角色。'},
  WORKSPACE_IAM_ROLE_STATUS_TRANSITION_INVALID: {title: '角色状态操作不可用', detail: '当前角色状态不支持此操作。'},
  WORKSPACE_IAM_ROLE_VERSION_CONFLICT: {title: '角色资料已被更新', detail: '请查看最新资料后再试。'},
};

export function platformProblemFeedback(errorCode: EdgeProblemCode | 'NETWORK_ERROR'): ProblemFeedback {
  return errorCode === 'NETWORK_ERROR'
    ? {title: '暂时无法连接服务', detail: '请检查网络连接后重试。'}
    : PLATFORM_PROBLEM_FEEDBACK[errorCode];
}

export function isPlatformProblemCode(value: unknown): value is EdgeProblemCode {
  return typeof value === 'string' && (EDGE_PROBLEM_CODES as readonly string[]).includes(value);
}
