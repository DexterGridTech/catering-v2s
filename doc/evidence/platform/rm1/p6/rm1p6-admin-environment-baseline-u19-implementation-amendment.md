# RM1 P6 U19：受管非生产 OTP、统一列表页长与公开邀请品牌基线

## 1. 触发与本次裁决

Dexter 已确认三项用户可见问题属于同一类“环境/共享 UI 基线被局部开关或局部默认值打散”的缺口：

1. 受管 DEV 曾把 `CATERING_OTP_DEBUG_CODE_EXPOSURE` 解析成可关闭的 `false`，使 owner 不返回真实 OTP、公开邀请页无法回填；DEV 与 UAT 不允许再关闭该回填。
2. 两个管理后台的列表初始页长分散为 20，不能保证默认仅显示 10 条。
3. 公开邀请卡片把集团空间名与运营后台标题在卡片头和页面标题重复呈现，且 OTP 成功提示与操作按钮紧贴。

本 amendment 仅覆盖上述基线；不修改 invitation/public protocol、workspace capability、token/mobile 校验、生产 OTP 隐私边界、owner command/readback 或 U18 的账号/邀请业务闭环。

## 2. OTP 环境门

本文件 supersede `2026-07-29-v2s-rm1-p6-interaction-preparation-and-refreeze-design.md` §8.1 第 1 条中“DEV/UAT 显式配置为 true”的可关闭部分：

- `V2S_RUNTIME_ENVIRONMENT=non-production`（受管 DEV 与非生产 UAT）及 `uat` 必须显式为 `CATERING_OTP_DEBUG_CODE_EXPOSURE=true`；foundation policy 对 `false` 或缺失 fail closed，不能启动为无回填状态。
- `V2S_RUNTIME_ENVIRONMENT=production` 必须为 `false`；显式 `true` 同样 fail closed。未标记运行时沿用原 `platform.otp.debug-code-exposure` 默认 `false`，不能被宣称为 DEV/UAT。不存在前端、URL、session 或请求参数开关。
- policy 是无状态配置解释，不持有 OTP、token、手机号或 owner 数据；四个 owner 服务只消费同一 `enabled()` 结果。
- r5 managed DEV runner 恒定传递 `true` 并在 manifest 记录 `otpDebugExposure:true`；formal seed 只接受该受管事实，仍不把 OTP 写入 seed 报告、日志、stdout、URL 或 session。
- OTP 始终为随机真实值。仅在 owner response 含非空 `debugVerificationCode` 时，既有五个 consumer surface 显示并自动填写；生产字段仍缺省。

## 3. 两后台列表基线

分页 query state 由各 app 自己拥有；`admin-ui-foundation` 当前不拥有页长/分页生命周期，故不为一个常量新建 shared primitive。以下完整分母必须将其**管理列表初始页长**直接设为 10，并由 app 内分母测试锁定：

- platform-admin：平台审计历史、组织/合同概览、管理员、空间账号、空间邀请、业务角色、集团空间管理。
- operations-admin：运营审计历史、业务实体、合同、门店管理、门店档案、运营用户、运营邀请。

候选 Select 的 `candidatePageSize` 不属于管理列表，且 backend API 的最大页长及显式请求语义不变。服务端 controller 的 20 仅是遗漏 `pageSize` 的 wire default，不是任一管理 UI 的默认显示决定；本包不借 UI 裁决修改 owner contract。

## 4. 公开邀请品牌和 OTP 布局

- `PublicInvitationEntry` 的 Card header 固定为“欢迎加入”。
- 所有邀请步骤的主标题使用 owner-approved logo（无 logo 时既有图标回退）加 `operationsTitle`；不再将 `workspaceName` 与 `operationsTitle` 拼接或以“加入...”重复呈现。步骤语义继续由 `Steps` 显示。
- OTP 两个 Alert 放入有明确纵向间隔的 notice 区，操作按钮右对齐；保留手机号/验证码、发送/验证/返回、owner 回填、overlay lock、改手机号清空验证码和所有既有 test ID。

## 5. 六类 package-exit source 对账分母

| 类别 | owning source / 本包分母 |
| --- | --- |
| PROJECT_MEMORY_ASSERTION_OCCURRENCES | `project-memory/kernel/04-contract-consumer-and-admin.md`、`project-memory/kernel/05-evidence-runtime-and-git.md`、`project-memory/operations/phase-retrospective-and-systemic-repair.md`、`project-memory/decisions/incremental-compliance-hook.md` |
| APPROVED_ASSERTIONS | IA01-PUBLIC-INVITATION、IA01-PUBLIC-INVITATION-OTP、P6 §8.1 及 Dexter 本轮三项页面/环境裁决 |
| FORBIDDEN_PSEUDO_FIXES | 前端/URL/session OTP 开关、生产回填、OTP/token 日志、将候选 Select 或 detail 全量表误作管理列表、用 workspace 名替代运营后台品牌 |
| DETAIL_DESIGN_COMPLETION_AND_CHANGED_PATH_CRITERIA | 本文件 §2–§4 的 environment gate、15 个列表分母、公开邀请三处 UI source 与 focused proof |
| OWNED_SURFACE_AND_OPERATION_KEYS | `platform.otp.debug-code-exposure`、四个 OTP owner services、`sendPublicInvitationOtp`、两 app ProTable/Table query state、`PublicInvitationView` |
| DUE_STANDARDS_RULE_IDS | `scripts/check/standards-coverage`、`scripts/check/remediation-compliance`、`scripts/check/code-layout` |

## 6. 验收与边界

静态：双 app 完整分母 guard；policy unit proof 证明 `non-production`/`uat` 的 false/missing 与 `production` 的 true 均被拒绝；formal seed managed manifest guard 证明 true 是唯一允许值。

focused：四个 owner 服务使用统一 policy；公开邀请保留 owner response 回填且品牌/notice layout 符合本文件；两个 app typecheck 与相关 UI tests 通过。

动态：代码变更后必须重新执行 managed `reset → start --profile r5-full → seed --profile r5-full`，读回本次 manifest/seed report/log；随后在 DEV 的真实公开邀请 OTP 流验证回填。L2 与 UAT 未获本包自动授权，不得由 DEV 宣称。
