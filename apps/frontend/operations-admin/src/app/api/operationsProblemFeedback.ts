import {
  EDGE_PROBLEM_CODES as OPERATIONS_EDGE_PROBLEM_CODES,
  type EdgeProblemCode as OperationsEdgeProblemCode,
} from './generated/operations-edge';
import {
  EDGE_PROBLEM_CODES as PUBLIC_EDGE_PROBLEM_CODES,
  type EdgeProblemCode as PublicEdgeProblemCode,
} from './generated/public-edge';

export type ProblemFeedback = {title: string; detail: string};
export type OperationsProblemCode = OperationsEdgeProblemCode | PublicEdgeProblemCode;

/**
 * Business-language feedback for the complete operations/public Problem union.
 * The generated edge catalogs are closed sets; new codes must add copy here.
 */
export const OPERATIONS_PROBLEM_FEEDBACK: Record<OperationsProblemCode, ProblemFeedback> = {
  EXTENSION_DEFINITION_REVISION_STALE: {title: '字段配置已变化', detail: '请刷新字段配置后重新查询。'},
  EXTENSION_FILTER_INVALID: {title: '字段筛选无效', detail: '请检查字段筛选条件后重试。'},
  ADAPTER_UNBIND_REQUIRED: {title: '需要外部解除授权', detail: '请先完成外部平台解除授权后重试。'},
  ACCOUNT_NOT_BINDABLE: {title: '账号当前不可接受邀请', detail: '该账号当前不可接受邀请，请联系空间管理员。'},
  AUTHORIZATION_REQUIRED: {title: '操作授权已失效', detail: '请重新选择当前数据节点后重试。'},
  BINDING_EDIT_NOT_ALLOWED: {title: '绑定不可编辑', detail: '当前绑定状态不支持手工修改。'},
  BINDING_NOT_EFFECTIVE: {title: '绑定尚未生效', detail: '请完成外部授权后再启用该渠道。'},
  BUSINESS_SCOPE_EXCEEDED: {title: '业务范围不匹配', detail: '当前接入档案不支持该经营渠道业务。'},
  BUSINESS_CHANNEL_STORE_NOT_IN_PROJECT: {title: '门店不属于当前项目', detail: '请重新选择当前项目内的门店后重试。'},
  BUSINESS_CHANNEL_STORE_VISIBILITY_DUPLICATE: {
    title: '可见门店重复',
    detail: '请移除重复门店后重试。',
  },
  BUSINESS_CHANNEL_STORE_VISIBILITY_NOT_APPLICABLE: {
    title: '门店范围不适用',
    detail: '项目主体模板不能设置门店可见范围。',
  },
  BUSINESS_CHANNEL_STORE_VISIBILITY_SCOPE_REQUIRED: {
    title: '缺少门店可见范围',
    detail: '请选择门店可见范围后重试。',
  },
  BUSINESS_CHANNEL_STORE_VISIBILITY_STALE: {
    title: '门店可见范围已变化',
    detail: '该模板已不再对当前门店开放，请刷新模板列表后重试。',
  },
  CONFIRMATION_REQUIRED: {title: '需要确认操作', detail: '请确认当前操作后重试。'},
  CONTRACT_ALREADY_INVALID: {title: '合同已失效', detail: '当前合同已经失效，无需重复操作。'},
  CONTRACT_DATE_RANGE_INVALID: {title: '合同日期有误', detail: '请检查合同生效与失效日期后重试。'},
  CONTRACT_ITEM_CODE_DUPLICATE: {title: '合同项目重复', detail: '请移除重复项目后重试。'},
  CONTRACT_ITEM_CODE_REQUIRED: {title: '合同项目不完整', detail: '请填写合同项目后重试。'},
  CONTRACT_NUMBER_CONFLICT: {title: '合同编号已存在', detail: '请更换合同编号后重试。'},
  CONTRACT_REFERENCE_UNRESOLVED: {title: '合同关联资料不可用', detail: '请刷新关联资料后重试。'},
  CONTRACT_VERSION_CONFLICT: {title: '合同资料已被更新', detail: '请查看最新合同后再试。'},
  DELETE_NOT_ALLOWED: {title: '对象不可删除', detail: '当前对象状态不支持删除。'},
  DINE_IN_FORM_MISMATCH: {title: '堂食形态不匹配', detail: '请检查堂食渠道形态后重试。'},
  PROJECT_DINE_IN_EXTERNAL_NOT_ALLOWED: {
    title: '项目级到店点餐仅支持内部接入',
    detail: '门店级外部到店点餐请将经营主体改为门店。',
  },
  DUPLICATE_CODE: {title: '编码已存在', detail: '当前项目或集团空间已有相同编码，请更换后重试。'},
  ORGANIZATION_BUSINESS_ENTITY_CODE_CONFLICT: {title: '业务资料编码已存在', detail: '请更换编码后重试。'},
  ORGANIZATION_BUSINESS_ENTITY_NAME_CONFLICT: {title: '业务资料名称已存在', detail: '请更换名称后重试。'},
  ORGANIZATION_BUSINESS_ENTITY_REFERENCE_CONFLICT: {title: '业务资料关联冲突', detail: '请刷新关联资料后重试。'},
  ORGANIZATION_BUSINESS_ENTITY_REFERENCE_UNRESOLVED: {title: '业务资料关联不可用', detail: '请刷新关联资料后重试。'},
  ORGANIZATION_BUSINESS_ENTITY_STATUS_TRANSITION_INVALID: {
    title: '业务资料状态不可变更',
    detail: '当前状态不支持此操作。',
  },
  ORGANIZATION_BUSINESS_ENTITY_VERSION_CONFLICT: {title: '业务资料已被更新', detail: '请查看最新资料后再试。'},
  ORGANIZATION_COMMERCIAL_GROUP_NOT_INITIALIZED: {title: '集团空间尚未初始化', detail: '请先完成集团空间初始化。'},
  ORGANIZATION_COMMERCIAL_GROUP_REQUIRED: {title: '缺少集团空间资料', detail: '请选择集团空间后重试。'},
  ORGANIZATION_HEAD_COMPANY_BRAND_AUTHORIZATION_IN_USE: {
    title: '品牌仍在使用中',
    detail: '该品牌仍被门店使用，暂时不能移除。',
  },
  ORGANIZATION_NODE_CODE_CONFLICT: {title: '组织编码已存在', detail: '请更换组织编码后重试。'},
  ORGANIZATION_NODE_NAME_CONFLICT: {title: '组织名称已存在', detail: '请更换组织名称后重试。'},
  ORGANIZATION_NODE_PARENT_INVALID: {title: '组织层级关系有误', detail: '请检查上级组织后重试。'},
  ORGANIZATION_NODE_STATUS_TRANSITION_INVALID: {title: '组织状态不可变更', detail: '当前组织状态不支持此操作。'},
  ORGANIZATION_NODE_VERSION_CONFLICT: {title: '组织资料已被更新', detail: '请查看最新组织资料后再试。'},
  ORGANIZATION_STORE_CODE_CONFLICT: {title: '门店编码已存在', detail: '请更换门店编码后重试。'},
  ORGANIZATION_STORE_CATALOG_MANAGEMENT_DISABLED: {
    title: '功能尚未开启',
    detail: '功能尚未开启，需项目对门店授权',
  },
  ORGANIZATION_STORE_EXTENSION_VERSION_CONFLICT: {title: '门店扩展资料已被更新', detail: '请查看最新资料后再试。'},
  ORGANIZATION_STORE_FIXED_SCOPE_FORBIDDEN: {title: '门店范围不可变更', detail: '当前门店范围不支持此操作。'},
  ORGANIZATION_STORE_HEAD_COMPANY_AUTHORIZATION_REQUIRED: {
    title: '需要总公司授权',
    detail: '请先完成总公司授权后重试。',
  },
  ORGANIZATION_STORE_NAME_CONFLICT: {title: '门店名称已存在', detail: '请更换门店名称后重试。'},
  ORGANIZATION_STORE_OPERATING_RULES_INVALID: {title: '门店经营规则无效', detail: '请检查门店经营规则后重试。'},
  ORGANIZATION_STORE_PROJECT_REQUIRED: {title: '缺少所属项目', detail: '请选择所属项目后重试。'},
  ORGANIZATION_STORE_RELATION_INVALID: {title: '门店关联资料有误', detail: '请检查门店所属关系后重试。'},
  ORGANIZATION_STORE_RELATION_LOCKED: {title: '门店关联已锁定', detail: '当前门店关联不支持此操作。'},
  ORGANIZATION_STORE_STATUS_TRANSITION_INVALID: {title: '门店状态不可变更', detail: '当前门店状态不支持此操作。'},
  ORGANIZATION_STORE_VERSION_CONFLICT: {title: '门店资料已被更新', detail: '请查看最新门店资料后再试。'},
  EXTERNAL_OWNER_ID_MISMATCH: {title: '外部主体编号不匹配', detail: '请刷新绑定资料并检查外部主体编号。'},
  IMMUTABLE_FIELD: {title: '字段不可修改', detail: '当前字段由 owner 状态维护，不能手工修改。'},
  ORDER_KIND_MISMATCH: {title: '订单类型不匹配', detail: '请检查渠道模板与订单类型映射。'},
  PLATFORM_ASSET_NOT_ACTIVE: {title: 'Logo 暂不可用', detail: '当前 Logo 尚未处于可使用状态。'},
  PLATFORM_ASSET_NOT_FOUND: {title: 'Logo 不存在', detail: '请重新选择 Logo 后重试。'},
  PLATFORM_ASSET_USAGE_DENIED: {title: 'Logo 不可使用', detail: '当前账号无权使用该 Logo。'},
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
  PROVIDER_NOT_ENABLED: {title: '接入档案未启用', detail: '请先启用当前接入档案后重试。'},
  SALES_ITEM_NOT_FOUND: {title: '销售项不存在', detail: '请刷新销售菜单后重试。'},
  SALES_MENU_ARCHIVED: {title: '销售菜单已归档', detail: '已归档的销售菜单不能继续编辑。'},
  SALES_MENU_ASSET_INVALID: {title: '菜单图片不可用', detail: '请检查图片后重试，或移除这张图片。'},
  SALES_MENU_ASSET_LIFECYCLE_CONFLICT: {title: '菜单图片状态已变化', detail: '请刷新图片资料后再试。'},
  SALES_MENU_ASSET_TARGET_MISMATCH: {title: '菜单图片归属不匹配', detail: '请刷新当前销售项后重试。'},
  SALES_MENU_CAPABILITY_REQUIRED: {title: '没有销售菜单操作权限', detail: '当前账号无权执行此销售菜单操作。'},
  SALES_MENU_CHANNEL_DISABLED: {title: '经营入口已停用', detail: '请启用经营入口后再更新到前台。'},
  SALES_MENU_CHANNEL_INELIGIBLE: {title: '经营入口不适用', detail: '当前经营入口不能使用这份销售菜单。'},
  SALES_MENU_CONSTRAINT_INVALID: {title: '销售约束有误', detail: '请检查起售量与订购倍数后重试。'},
  SALES_MENU_DRAFT_INVALID: {title: '销售菜单尚未具备发布条件', detail: '请根据发布提示补齐销售菜单后重试。'},
  SALES_MENU_IDEMPOTENCY_CONFLICT: {title: '销售菜单操作内容已变化', detail: '请重新提交当前操作。'},
  SALES_MENU_ITEM_REFERENCE_INVALID: {title: '商品资料不可用于销售', detail: '请刷新商品资料后重试。'},
  SALES_MENU_MANUAL_REASON_REQUIRED: {title: '请填写沽清原因', detail: '设置人工沽清前请填写原因。'},
  SALES_MENU_MANUAL_TARGET_INVALID: {
    title: '人工销售目标已变化',
    detail: '当前目标不属于最新发布内容，请刷新后重新选择。',
  },
  SALES_MENU_MOVE_BOUNDARY: {title: '销售项已在边界位置', detail: '请刷新当前销售项顺序后重试。'},
  SALES_MENU_NOT_FOUND: {title: '销售菜单不存在', detail: '请刷新销售菜单后重试。'},
  SALES_MENU_ORDER_OPTION_REFERENCE_INVALID: {title: '销售选项资料已变化', detail: '请刷新商品选项定义后重试。'},
  SALES_MENU_ORDER_OPTION_SELECTION_INVALID: {
    title: '销售选项选择不完整',
    detail: '请检查对应选项组并补齐必选值后重试。',
  },
  SALES_MENU_ORDER_OPTION_SHAPE_UNSUPPORTED: {title: '当前商品形态不支持选项', detail: '请移除销售选项选择后重试。'},
  SALES_MENU_PRICE_REQUIRED: {title: '缺少菜单挂牌价', detail: '请补齐菜单挂牌价后重试。'},
  SALES_MENU_PUBLICATION_REQUIRED: {title: '销售菜单尚未更新到前台', detail: '请先更新到前台后再执行销售状态操作。'},
  SALES_MENU_RESULT_UNKNOWN: {title: '销售菜单操作结果待确认', detail: '请刷新销售菜单确认当前状态。'},
  SALES_MENU_SCHEDULE_INVALID: {title: '销售时段有误', detail: '请检查销售时段后重试。'},
  SALES_MENU_SCOPE_MISMATCH: {title: '销售菜单门店范围不匹配', detail: '请重新选择当前门店数据节点后重试。'},
  SALES_MENU_SECTION_NOT_EMPTY: {title: '销售分区尚有销售项', detail: '请先移除或移动分区中的销售项后重试。'},
  SALES_MENU_SKU_REFERENCE_INVALID: {title: '销售规格不可用', detail: '请刷新商品规格后重试。'},
  SALES_MENU_STORE_DISABLED: {title: '门店已停用', detail: '已停用门店不能更新销售菜单到前台。'},
  SALES_MENU_VERSION_CONFLICT: {title: '销售菜单已被更新', detail: '请查看最新销售菜单后再试。'},
  SALES_SECTION_NOT_FOUND: {title: '销售分区不存在', detail: '请刷新销售菜单后重试。'},
  VERSION_CONFLICT: {title: '资料已被更新', detail: '请查看最新资料后再试。'},
  VOIDED_RECORD_IMMUTABLE: {title: '对象已标记删除', detail: '该对象已标记删除，不能继续修改。'},
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
  WORKSPACE_IAM_RATE_LIMITED: {title: '操作暂时受限', detail: '验证码请求过于频繁，请稍后再试。'},
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
  return (
    typeof value === 'string' &&
    ([...OPERATIONS_EDGE_PROBLEM_CODES, ...PUBLIC_EDGE_PROBLEM_CODES] as readonly string[]).includes(value)
  );
}
