---
title: RM1 P6 implementation-facing design and three-phase plan
status: PREPARED_FOR_INDEPENDENT_DESIGN_REVIEW
reviewTarget: DESIGN
implementationAuthority: false
designAuthority: Dexter 2026-07-29 P6 interaction-design GO and implementation-design authorization
---

# RM1 P6 实施详设与三步实施计划

## 1. 目的、原始业务问题与不变边界

P6 不是把既有页面接到现有接口。它要让平台人员安全治理集团空间、管理员、角色与扩展字段，
让运营用户在正确的集团空间、任职与可查看范围内完成登录、恢复、邀请、组织、门店、合同和用户任务。
原始业务来源为 G-01/G-02/G-03/G-04/G-05/G-07/G-09/G-10、P-U1…P-U5、P-Q1/P-Q5/P-Q7、
ST-2/ST-6/ST-11，以及 IA-01…IA-05 的 `BUSINESS_REQUIREMENT_SOURCE`。

五份 IA 已获 Dexter 接受并标记 `DEXTER_WIREFRAME_REVIEW=ACCEPTED_2026-07-29`；它们仍不是
implementation authority。本稿只冻结“先建立 owner truth，再让两个独立 app 消费”的实施顺序。
不从 pageKey、URL、asset ref、session、浏览器缓存或全量列表反推授权、品牌、候选或业务事实。

共同禁止项：手改 generated wire；以 UI filter 代替 owner filter；把管理员发起的恢复替代匿名自助恢复；
production 以空字符串替代 debug code omission；把 definition revision 塞回实体写请求；复制
`admin-ui-foundation`；把一个 endpoint 支撑的两个业务表面误记为一个用户任务。

## 2. 三步顺序与 review 闸门

| step | 交付目标 | 不能开始的条件 | 完成后必须停下 |
| --- | --- | --- | --- |
| P6-1 | 公开入口、认证恢复与品牌事实的 contract/owner/edge 闭环及单元测试 | 任一 public route、operationId、canonical mobile migration、typed Problem 或 red case 未冻结 | 交 Dexter 与 Claude review；GO 前不得开始任何 UI 或 P6-2。 |
| P6-2 | platform-admin 的治理真相与平台 UI | P6-1 review 不是 GO；任一平台 task 仍靠 client 推导 | 交 Dexter 与 Claude review；GO 前不得开始 P6-3。 |
| P6-3 | operations-admin/public 的业务完成路径 | P6-2 review 不是 GO；任一候选/写授权/extension truth 未由 owner 闭合 | 交 Dexter 与 Claude review；GO 后才可做整个 P6 implementation review。 |

每一步都必须先完成 D1 routed project-memory、D2 P6 assertion/GAP、D3 禁止伪修复、D4 actual
changed-file/incremental receipt equality、D5 IA anchor + 22 surface/25 pageDesignKey、D6 R5 due standards
六类 package-exit 对账。步骤之间不借 receipt，也不把上一阶段单测绿当作下一阶段业务证明。

**UI/L2 强制顺序。** 对有完整 IA/交互详设的任何 P6 UI-bearing step，实际 consumer 完成后必须先形成
`UI_INTERACTION_CONFORMANCE_RECORD`：逐页面、逐控件与批准 IA/physical screen contract 对读用户任务、入口
与形态、文案、数据/候选来源、前置条件、级联/清理、状态/恢复、owner 再核验、foundation primitive 和禁止项。
记录的分母必须等于该 step 的所有 UI consumer/physical-screen 条目；每个偏差都要修复或有明确
`NOT_APPLICABLE_WITH_REASON`。**该记录 PASS 是启动 L2 的前置条件**；L2、API、typecheck 或截图均不替代它。
L2 后的独立 implementation review 与 Claude review 必须重新核对此记录、IA 和真实页面。

## 3. P6-1：公开入口、认证恢复与品牌事实

### 3.1 用户任务与最小替代

未认证用户必须看见所属集团空间的名称/Logo/运营后台标题，安全地使用密码或 OTP 登录，并以“账号+
本人手机号+验证码”恢复密码。更小的替代方案是先画 UI 或重用管理员发起恢复，但前者迫使 client 猜 owner
事实，后者把已认证管理员链误用为匿名链，均不满足反枚举与无早期 session 的业务边界。

### 3.2 Capability 详设

| unit | contract、owner 与 edge 的精确边界 | retain / failure behavior | 必须先有的 unit tests |
| --- | --- | --- | --- |
| 运营登录与邀请品牌 readback | 更新 `contracts/openapi/components/workspace-iam/workspace-session.schemas.yaml#WorkspaceLoginEntry`、`workspace-access.schemas.yaml#PublicInvitationView`；`OperationsWorkspaceLoginEntryController#entry`、`PublicInvitationController#view` 仅返回 workspace owner 批准的 `workspaceName`、`operationsTitle`、nullable `logoUrl`。`logoUrl` 复用 `PlatformWorkspaceAdministrationController#logoUrl` 与 `PlatformAssetService#requireActivePublicReference`。 | 绝不从 `logoAssetRef`、URL 或缓存拼 URL；无有效 asset 返回 null，UI 只显示默认标识。 | 新增 edge readback tests：空间隔离、无 asset、非 public/失效 asset、public wire 无 asset ref。 |
| 平台手机号 OTP 登录 | 在 `platform-auth.paths.yaml` 与 `platform-identity.schemas.yaml` 冻结 `sendPlatformLoginOtp`、`verifyPlatformLoginOtp`；新增 additive migration 在 platform-IAM owner 形成 canonical normalized mobile 与 OTP state；`PlatformAuthenticationService`/`PlatformAuthenticationController` 只按 owner 事实认证。 | 不复用展示用 `mobile_mask_source`，不以 password fallback 或 session id 生成 OTP。 | 扩充 `PlatformAuthenticationServiceTest`：随机、限频、过期、一次性、停用、统一拒绝、成功 session；edge typed Problem mapping test。 |
| 平台匿名恢复 | 冻结 `startPlatformPasswordRecovery`、`sendPlatformPasswordRecoveryOtp`、`verifyPlatformPasswordRecoveryOtp`、`completePlatformPasswordRecovery`；platform-IAM owner 管 opaque、短时、一次性 flow/grant，complete 后 revoke all platform sessions。 | 现存 reset table 不是 public protocol；登录页不能签 grant。 | flow state、反枚举、OTP 过期/一次性、重复 complete、限频、session revoke red cases。 |
| 运营匿名恢复 | 新增独立 operations public recovery family；workspace-IAM owner 使用入口定位的 workspace + loginName/mobile 建 flow 并回 owner 品牌。 | 保留 `PublicWorkspacePasswordResetController` 与 `WorkspacePasswordResetService#request/sendOtp/verifyOtp/complete`，它们只服务管理员发起链；`resetGenerationKey` 不进入登录页。 | 扩充 `WorkspaceInvitationPublicFlowTest` 或新 capability-named service test：不越空间、反枚举、无早期 session、complete 后 revoke operations sessions。 |
| DEV/UAT debug code | send response 的 optional `debugVerificationCode` 由 `platform.otp.debug-code-exposure` 控制，默认 false，DEV/UAT true；涉及 `WorkspaceAuthenticationService#sendLoginOtp`、`WorkspaceInvitationService#sendPublicOtp` 与上述新增 send operations。 | production **缺省**字段而非空串；只五个 IA surface 在 response 非空时显示；管理员发起恢复不为 UI 而扩 response。 | false omission、true 值与本次随机 OTP 一致、OTP 不可由 request/session 推导、codegen check。 |

所有 contract delta 同步 `contracts/openapi/edge.openapi.yaml`、R5 edge contract catalog、error-code
disposition catalog、generated Java/TypeScript/RTK 与 route registry；generated files 只由 generator 产生。
所有新增 migration additive；edge 只调 owner public API，在同一 `REQUIRED` 事务内完成。

### 3.3 P6-1 exit

上表每个 unit 先有 service/owner unit test、edge mapping test 与具名 red mutation；再运行 generation
check、package-exit actual-file receipt equality 和静态 standards check。完成即停，给 Dexter 与 Claude review。

## 4. P6-2：平台治理真相与 platform-admin 消费

平台用户任务来自 IA-02/IA-03：在已选集团空间内治理空间资料、商业集团、管理员、角色、账号与扩展字段，
并只读核对组织/合同。概览不是管理页，列表不新增行内写操作。

| capability family | owner/contract first | platform consumer | focused proof |
| --- | --- | --- | --- |
| 空间选择、资料、Logo、状态 | `group-workspace-management.paths.yaml`、`WorkspaceAdministrationService`、`PlatformAssetService` 闭合 `GAP-WORKSPACE-LOGO-STAGING-DISPOSITION` 的 keep/remove/replace/release 与同谓词 list/total。 | `WorkspaceManagementPage.tsx`、`WorkspaceAdministrationPage.tsx`：名称链接→详情 Drawer→编辑/状态 Modal；未选 workspace 菜单置灰/阻止导航。 | asset grant 不重用、冲突重读、未选不发 task read、context 缓存扇出失效。 |
| 只读组织/合同与扩展定义 | `PlatformOrganizationOverviewController` + `OrganizationOverviewTaskReadService`、`PlatformContractOverviewController` + `ContractTaskReadService` 提供 server filters/candidates/same-predicate total；平台 definition owner 保持整组 replace。 | `PlatformReadPage.tsx`、`ExtensionsPage.tsx` 消费 generated wire，详情槽位直接显示 current enabled definitions。 | 无 client filter/full read；空/失败/候选失败分离；definition conflict 重读。 |
| 管理员、账号与角色 | platform-IAM/workspace-IAM public command APIs 提供 create/update/status/credential recovery、两棵独立授权树、五 target 用户筛选与 `GAP-ROLE-GENERIC-UPDATE-STATUS-BOUNDARY`。 | `AccountsPage.tsx`、`RolesPage.tsx` 和平台管理员 feature，只能 detail 后进入 Drawer/Modal。 | 未授权 action 不渲染且 owner 再拒绝；K04 仍是管理员发起恢复。 |

P6-2 先完成 owner/service unit tests 与 edge mapping tests，再实现 UI；UI 只能复用 foundation 的 Drawer、
overlay、list context、submission/readback primitives。8 个平台 catalog page key（`PLATFORM-WORKSPACES`、
`PLATFORM-WORKSPACE-OVERVIEW`、`PLATFORM-ADMIN-USERS`、`PLATFORM-ORGANIZATION-OVERVIEW`、
`PLATFORM-CONTRACT-OVERVIEW`、`PLATFORM-ROLES`、`PLATFORM-WORKSPACE-ACCOUNTS`、
`PLATFORM-EXTENSION-FIELDS`）及 platform password Drawer surface 要逐一对账 IA anchor、heritage hash、
generated operation 与 focused frontend test。完成即停，交 Dexter 与 Claude review。

## 5. P6-3：运营管理后台与公开业务完成路径

运营用户任务来自 IA-01/IA-02/IA-04/IA-05：在当前任职与可查看范围内管理用户、组织、实体、门店和合同，
并使用扩展字段；public invitation 不创建早期 assignment/session。

| capability family | owner/contract first | operations/public consumer | focused proof |
| --- | --- | --- | --- |
| 任职、范围、邀请、用户 | session/access paths 提供 assignment/data-node candidate、邀请角色/任职机构 candidate、五 target user filter；保留 capability→target resolver，禁止 pageKey 恢复。 | `OperationsLoginPage.tsx`、`RoleHomeBootstrapPage.tsx`、`WorkspaceUserPage.tsx`、`WorkspaceInvitationPanel.tsx`；任职与范围分离。 | peer/cross-workspace/scope-out red；上游变化清下游；unknown submit 先 owner readback。 |
| 组织、门店、合同 | 关闭 `GAP-STORE-LIST-FILTER-SEMANTICS`、`GAP-STORE-PROJECT-FILTER`、`GAP-STORE-CREATE-CASCADE`、`GAP-CONTRACT-PROJECT-SCOPE-AUTHORIZATION`、`GAP-CONTRACT-TENANT-READBACK`。 | `OrganizationStructurePage.tsx`、`StoreManagementPage.tsx`、`ContractManagementPage.tsx`、`StoreProfilePage.tsx`；各 pageDesignKey 独立，名称链接→详情→Drawer/Modal。 | owner candidate 级联；items/total 同 predicate；无行内操作列。 |
| 实体 extension 与公开邀请 | 关闭 `GAP-EXTENSION-OWNER-KEY-DERIVATION`、`GAP-ENTITY-EXTENSION-REQUEST-REVISION-REMOVAL`：五 host × create/edit 的 10 条 request/edge/owner CAS 一并移除 definition revision，保留提交瞬间 definition 校验与 owner trace。 | `PublicInvitationEntry.tsx` 与所有适用原生 form/detail；无“经营资料”分组，按 `displayOrder` 插入。 | 10-path set equality；未知/停用 definition 值不静默覆盖；public flow 无早期 assignment/session。 |

12 个 operations catalog page key（组织 1、业务实体 3、门店 1、合同 1、用户 5、门店资料 1）和 5 个 home
page key，连同 public invitation、operations shell、operations password 三个非 catalog surface，均要逐一对账
IA anchor、owner readback、candidate source、failure/recovery、foundation import 和 generated operation；运行
architecture/typecheck/generation checks 与 approved focused tests。业务与 cleanup evidence 分开。完成即停，交
Dexter 与 Claude review；GO 后才启动整个 P6 implementation review。

**门店资料合同四态（Dexter，2026-07-31）。** `PG-STORE-PROFILE` 的合同子 Tab 是四个 owner-read
视图，而不是浏览器按本地日期或既有列表切片：`CURRENT` 是 `VALID` 且
`effectiveFrom <= BusinessDate` 且 (`effectiveTo` 为空或 `>= BusinessDate`)；
`PENDING_EFFECTIVE` 是 `VALID` 且 `effectiveFrom > BusinessDate`；`HISTORY` 是 `VALID` 且
`effectiveTo < BusinessDate`；`INVALID` 是 `INVALID`。`BusinessDate` 只能由 contract owner 的
`BusinessDateProvider`（Asia/Shanghai）取得。OpenAPI 以 typed `StoreContractViewState` query 传递
该视图；owner 对每种 view 使用同一谓词计算 `items` 与 `total` 后再分页，edge 只转发，generated
client 的 query arg 纳入 cache key。页面以“当前／待生效／历史／已作废”四 Tab 切换该 view，切换时
回到第 1 页；合同编号只能打开无写入口的 detail Drawer。

**Total-company brand authorization corrective slice.** This is a P6-3 operations-admin slice, not a P6-2
exception.  Its accepted IA04 user task is exactly one candidate-brand add or one current-brand remove in the
head-company detail Drawer, never a collection replace.  The complete operation set is owner-detail readback
`getOperationsOrganizationHeadCompany`, the candidate-search contract
`getOperationsOrganizationBrands`, and the independent resource commands
`addOperationsOrganizationHeadCompanyBrandAuthorization` /
`removeOperationsOrganizationHeadCompanyBrandAuthorization`.  Owner/add-remove and edge typed-problem tests
precede generated consumption and the nonvisual adapter/UI binding. Current bytes have
`GAP-BRAND-CANDIDATE-OWNER-PAGINATION`: the edge locally pages an owner List, so P6-3 must first change only
`OperationsBusinessEntityController#brands`, provide the owner query with the same filter/sort/page/total semantics,
add the concrete `OperationsBusinessEntityControllerTest` pass-through/red proof, and remove edge-local
materialization. Current bytes
also have `GAP-BRAND-IN-USE-TYPED-PROJECTION`: the declared safe code is not yet selected for the actual owner
subclass, so P6-3 must add an explicit most-specific edge mapping and focused red before generated consumption.
Each 204 is followed by current owner detail
readback, and each new user intent owns a fresh idempotency identity.  The P6-3 Drawer must only replay an
unknown outcome with the original command identity after a fresh owner readback cannot decide its membership
predicate; known 4xx never replay. After its required mapping, the typed in-use blocker travels owner → edge →
generated wire → transport as a safe code only, with fixed user copy, never raw Problem detail.
`2026-07-30-v2s-rm1-p6-3-head-company-brand-authorization-corrective-design.md` is the authoritative
implementation-facing detail for this P6-3 slice; all other P6-3 surfaces remain in their established denominator.

## 6. Review 约束

P6-1、P6-2、P6-3 各自为独立 implementation scope，实施后都必须有 Dexter 与 Claude review。所有实施
完成后另建 `REVIEW_TARGET=IMPLEMENTATION` 独立审查；不得把本稿、单元测试或 Claude design GO 当成
implementation GO，也不得修改 Roadmap 状态。

## 7. Final screen/surface binding

`rm1-u09-final-ui-surface-roster.md` is part of this design, not an optional implementation note.  It binds all
22 carry-over surfaces, 25 catalog pageDesignKeys and seven non-catalog surfaces to their accepted IA screen,
exact final consumer path, owner prerequisite, generated operation or exact N/A reason, recovery behavior,
foundation primitive, focused test and package-exit assertion.  It also makes the public/contract-only P6-1
records explicit without misrepresenting them as UI implementation.  The roster's two foundation import-equality
red mutations are required before a UI-bearing phase can claim package exit PASS.

`rm1-u09-physical-screen-import-contracts.md` is the mandatory physical-screen expansion of that roster.  It
separates every content page, content Tab, Drawer, Modal, selector and public step that has a different host or
foundation import, including the five operations user pages, invitation Drawer/Modal chain and revocation Modal.
It is the authoritative per-screen import-equality denominator; its references preserve the already accepted IA
actor, scenario, user-visible copy and form-cascade contract rather than redrawing or changing the interaction.
