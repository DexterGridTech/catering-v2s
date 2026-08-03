import {EDGE_PROBLEM_CODES as OPERATIONS_EDGE_PROBLEM_CODES, type EdgeProblemCode as OperationsEdgeProblemCode} from './generated/operations-edge';
import {EDGE_PROBLEM_CODES as PUBLIC_EDGE_PROBLEM_CODES, type EdgeProblemCode as PublicEdgeProblemCode} from './generated/public-edge';

export type ProblemFeedback = {title: string; detail: string};
export type OperationsProblemCode = OperationsEdgeProblemCode | PublicEdgeProblemCode;

/**
 * Business-language feedback for the complete operations/public Problem union.
 * The generated edge catalogs are closed sets; new codes must add copy here.
 */
export const OPERATIONS_PROBLEM_FEEDBACK: Record<OperationsProblemCode, ProblemFeedback> = {
  CONTRACT_ALREADY_INVALID: {title: '合同已失效', detail: '当前合同已经失效，无需重复操作。'},
  CONTRACT_DATE_RANGE_INVALID: {title: '合同日期有误', detail: '请检查合同生效与失效日期后重试。'},
  CONTRACT_ITEM_CODE_DUPLICATE: {title: '合同项目重复', detail: '请移除重复项目后重试。'},
  CONTRACT_ITEM_CODE_REQUIRED: {title: '合同项目不完整', detail: '请填写合同项目后重试。'},
  CONTRACT_NUMBER_CONFLICT: {title: '合同编号已存在', detail: '请更换合同编号后重试。'},
  CONTRACT_REFERENCE_UNRESOLVED: {title: '合同关联资料不可用', detail: '请刷新关联资料后重试。'},
  CONTRACT_VERSION_CONFLICT: {title: '合同资料已被更新', detail: '请查看最新合同后再试。'},
  ORGANIZATION_BUSINESS_ENTITY_CODE_CONFLICT: {title: '业务资料编码已存在', detail: '请更换编码后重试。'},
  ORGANIZATION_BUSINESS_ENTITY_NAME_CONFLICT: {title: '业务资料名称已存在', detail: '请更换名称后重试。'},
  ORGANIZATION_BUSINESS_ENTITY_REFERENCE_CONFLICT: {title: '业务资料关联冲突', detail: '请刷新关联资料后重试。'},
  ORGANIZATION_BUSINESS_ENTITY_REFERENCE_UNRESOLVED: {title: '业务资料关联不可用', detail: '请刷新关联资料后重试。'},
  ORGANIZATION_BUSINESS_ENTITY_STATUS_TRANSITION_INVALID: {title: '业务资料状态不可变更', detail: '当前状态不支持此操作。'},
  ORGANIZATION_BUSINESS_ENTITY_VERSION_CONFLICT: {title: '业务资料已被更新', detail: '请查看最新资料后再试。'},
  ORGANIZATION_COMMERCIAL_GROUP_NOT_INITIALIZED: {title: '集团空间尚未初始化', detail: '请先完成集团空间初始化。'},
  ORGANIZATION_COMMERCIAL_GROUP_REQUIRED: {title: '缺少集团空间资料', detail: '请选择集团空间后重试。'},
  ORGANIZATION_HEAD_COMPANY_BRAND_AUTHORIZATION_IN_USE: {title: '品牌仍在使用中', detail: '该品牌仍被门店使用，暂时不能移除。'},
  ORGANIZATION_HEAD_COMPANY_BRAND_AUTHORIZATION_REQUIRED: {title: '需要品牌授权', detail: '请先完成总公司品牌授权。'},
  ORGANIZATION_NODE_CODE_CONFLICT: {title: '组织编码已存在', detail: '请更换组织编码后重试。'},
  ORGANIZATION_NODE_NAME_CONFLICT: {title: '组织名称已存在', detail: '请更换组织名称后重试。'},
  ORGANIZATION_NODE_PARENT_INVALID: {title: '组织层级关系有误', detail: '请检查上级组织后重试。'},
  ORGANIZATION_NODE_STATUS_TRANSITION_INVALID: {title: '组织状态不可变更', detail: '当前组织状态不支持此操作。'},
  ORGANIZATION_NODE_VERSION_CONFLICT: {title: '组织资料已被更新', detail: '请查看最新组织资料后再试。'},
  ORGANIZATION_STORE_CODE_CONFLICT: {title: '门店编码已存在', detail: '请更换门店编码后重试。'},
  ORGANIZATION_STORE_EXTENSION_VERSION_CONFLICT: {title: '门店扩展资料已被更新', detail: '请查看最新资料后再试。'},
  ORGANIZATION_STORE_FIXED_SCOPE_FORBIDDEN: {title: '门店范围不可变更', detail: '当前门店范围不支持此操作。'},
  ORGANIZATION_STORE_HEAD_COMPANY_AUTHORIZATION_REQUIRED: {title: '需要总公司授权', detail: '请先完成总公司授权后重试。'},
  ORGANIZATION_STORE_NAME_CONFLICT: {title: '门店名称已存在', detail: '请更换门店名称后重试。'},
  ORGANIZATION_STORE_PROJECT_REQUIRED: {title: '缺少所属项目', detail: '请选择所属项目后重试。'},
  ORGANIZATION_STORE_RELATION_INVALID: {title: '门店关联资料有误', detail: '请检查门店所属关系后重试。'},
  ORGANIZATION_STORE_RELATION_LOCKED: {title: '门店关联已锁定', detail: '当前门店关联不支持此操作。'},
  ORGANIZATION_STORE_STATUS_TRANSITION_INVALID: {title: '门店状态不可变更', detail: '当前门店状态不支持此操作。'},
  ORGANIZATION_STORE_VERSION_CONFLICT: {title: '门店资料已被更新', detail: '请查看最新门店资料后再试。'},
  PLATFORM_ASSET_NOT_ACTIVE: {title: 'Logo 暂不可用', detail: '当前 Logo 尚未处于可使用状态。'},
  PLATFORM_ASSET_NOT_FOUND: {title: 'Logo 不存在', detail: '请重新选择 Logo 后重试。'},
  PLATFORM_ASSET_USAGE_DENIED: {title: 'Logo 不可使用', detail: '当前账号无权使用该 Logo。'},
  PLATFORM_COMMON_ACCESS_DENIED: {title: '没有操作权限', detail: '当前账号无权执行此操作。'},
  PLATFORM_COMMON_AUTHENTICATION_REQUIRED: {title: '登录状态已失效', detail: '请重新登录后继续。'},
  PLATFORM_COMMON_CONTEXT_STALE: {title: '页面资料已更新', detail: '请刷新当前页面后重试。'},
  PLATFORM_COMMON_GROUP_WORKSPACE_DISABLED: {title: '集团空间不可用', detail: '当前集团空间已停用。'},
  PLATFORM_COMMON_IDEMPOTENCY_CONFLICT: {title: '操作请求已变化', detail: '请重新提交当前操作。'},
  PLATFORM_COMMON_OWNER_INVARIANT_VIOLATION: {title: '操作暂时不可用', detail: '当前资料状态异常，请稍后重试。'},
  PLATFORM_COMMON_RESOURCE_NOT_FOUND: {title: '资料不存在', detail: '请刷新页面后重试。'},
  PLATFORM_COMMON_RESULT_UNKNOWN: {title: '操作结果待确认', detail: '请刷新页面或使用原操作重试。'},
  PLATFORM_COMMON_VALIDATION_FAILED: {title: '填写内容有误', detail: '请检查填写内容后重试。'},
  PLATFORM_COMMON_VERSION_CONFLICT: {title: '资料已被更新', detail: '请查看最新资料后再试。'},
  WORKSPACE_IAM_ACCOUNT_DISABLED: {title: '账号已停用', detail: '当前账号无法继续操作，请联系管理员。'},
  WORKSPACE_IAM_ASSIGNMENT_CONFLICT: {title: '任职资料发生冲突', detail: '请刷新任职资料后重试。'},
  WORKSPACE_IAM_CREDENTIAL_LOCKED: {title: '凭据已锁定', detail: '请稍后再试或联系管理员。'},
  WORKSPACE_IAM_CREDENTIAL_NOT_READY: {title: '凭据尚未准备好', detail: '请稍后再试。'},
  WORKSPACE_IAM_GRANT_INVALID: {title: '操作授权已失效', detail: '请重新开始当前流程。'},
  WORKSPACE_IAM_INVALID_CREDENTIALS: {title: '登录信息不正确', detail: '请检查登录名、手机号或验证码。'},
  WORKSPACE_IAM_INVITATION_EXPIRED: {title: '邀请已过期', detail: '请重新发起邀请。'},
  WORKSPACE_IAM_INVITATION_NOT_FOUND: {title: '邀请不存在', detail: '请刷新列表后重试。'},
  WORKSPACE_IAM_INVITATION_TERMINAL: {title: '邀请已结束', detail: '当前邀请不能继续操作。'},
  WORKSPACE_IAM_OTP_EXPIRED: {title: '验证码已过期', detail: '请重新获取验证码。'},
  WORKSPACE_IAM_OTP_INVALID: {title: '验证码不可用', detail: '请检查验证码或重新获取。'},
  WORKSPACE_IAM_PASSWORD_POLICY_FAILED: {title: '密码不符合要求', detail: '请按页面提示设置新密码。'},
  WORKSPACE_IAM_PASSWORD_RESET_GENERATION_INVALID: {title: '密码重置链接已失效', detail: '请重新开始密码重置流程。'},
  WORKSPACE_IAM_PASSWORD_RESET_MOBILE_MISMATCH: {title: '手机号不匹配', detail: '请使用与账号绑定的手机号。'},
  WORKSPACE_IAM_PASSWORD_RESET_REPLAYED: {title: '密码重置流程已完成', detail: '请重新开始密码重置流程。'},
  WORKSPACE_IAM_RATE_LIMITED: {title: '操作暂时受限', detail: '验证码请求过于频繁，请稍后再试。'},
  WORKSPACE_IAM_RESET_EXPIRED: {title: '重置流程已过期', detail: '请重新开始密码重置流程。'},
  WORKSPACE_IAM_RESET_NOT_FOUND: {title: '重置流程不存在', detail: '请重新开始密码重置流程。'},
  WORKSPACE_IAM_RESULT_UNKNOWN: {title: '操作结果待确认', detail: '请刷新页面或使用原操作重试。'},
  WORKSPACE_IAM_WORKSPACE_DISABLED: {title: '集团空间不可用', detail: '当前集团空间已停用。'},
  WORKSPACE_IAM_WORKSPACE_NOT_FOUND: {title: '集团空间不存在', detail: '请刷新页面后重试。'},
};

export function operationsProblemFeedback(errorCode: OperationsProblemCode | 'NETWORK_ERROR'): ProblemFeedback {
  return errorCode === 'NETWORK_ERROR'
    ? {title: '暂时无法连接服务', detail: '请检查网络连接后重试。'}
    : OPERATIONS_PROBLEM_FEEDBACK[errorCode];
}

export function isOperationsProblemCode(value: unknown): value is OperationsProblemCode {
  return typeof value === 'string'
    && ([...OPERATIONS_EDGE_PROBLEM_CODES, ...PUBLIC_EDGE_PROBLEM_CODES] as readonly string[]).includes(value);
}
