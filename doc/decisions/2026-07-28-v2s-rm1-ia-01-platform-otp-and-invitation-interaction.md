---
title: RM1 IA-01 平台 OTP 与邀请入口交互详设
status: DEXTER_ACCEPTED_FOR_IMPLEMENTATION_FACING_REFREEZE
createdAt: 2026-07-29
programContext: V2S_RM1_REMEDIATION
decisionOwner: Dexter
implementationAuthority: false
---

# RM1 IA-01：平台 OTP 与邀请入口交互详设

```text
JOURNEY_DECISION=doc/plans/platform/2026-07-28-v2s-rm1-restructure-and-remediation-implementation-design-and-plan.md#rm1-p6ui-carry-overotp-work-context
UI_BEARING=true
SKILL_USED=NONE
DEXTER_WIREFRAME_REVIEW=ACCEPTED_2026-07-29
DEXTER_HIFI_REVIEW=NOT_REQUIRED
CONSUMER_FACE=platform-admin + public + operations-admin
IMPLEMENTATION_AUTHORITY=false
DEXTER_PRODUCT_DECISION_2026-07-29=运维管理后台与运营管理后台均支持未认证用户以“账号+手机号+验证码”验证本人后重置密码；此裁决新增产品能力，但不授权契约、owner 或前端实现。
```

## 1. 原始业务问题、范围与非目标

本稿先回答“为什么做”，而不从现有组件或接口倒推页面。P6 的原始输入是 P-N1、P-U5
和 R-5：平台管理员需要可用的手机号验证码登录能力；旧的 platform-face invitation
管理面必须退役；但运营任职的新增仍只能走邀请。其 owning sources 是
`doc/plans/platform/2026-07-28-v2s-rm1-restructure-and-remediation-implementation-design-and-plan.md#rm1-p6ui-carry-overotp-work-context`
与同文件 `#r-5`。

业务语义来自 `project-memory/decisions/confirmed-business-language-corpus.md`：

- G-05：**运营用户**支持“登录名+密码与手机号验证码”；一个账号可有多任职，身份和可视数据范围不是同一选择。它不自动推出平台管理员也有同形 OTP；
- G-07：新增任职必须邀请、接受后才生效；撤销可以直接，但不存在直接编辑任职；
- G-10：公开邀请 URL 必须带 `groupWorkspaceKey`，但 URL 只定位空间，绝不构成授权。

本稿只裁定以下用户任务的交互形状：平台管理员以密码或短信验证码登录，或在无法登录时以账号、本人手机号和验证码重置密码；被邀请运营用户
经公开链接完成本人接受；具有用户管理权限的运营用户在五个 target-specific 用户页发起、
取消或重发邀请。它**不**新建账号、角色、任职、空间或“平台邀请中心”业务；不把 invitation
acceptance 变成后台登录捷径；不授权实现，不修改 contract、codegen、owner、前端或 manifest。
2026-07-29 Dexter 已裁决：两个管理后台的未认证用户都可用“账号+手机号+验证码”完成本人验证后重置密码。
这是 `D04-S10` 对“本人验证手机号后设新密码”的产品解释；不能再以当前管理员签发 `resetGenerationKey`
的实现限制否定该用户任务。

**本稿的强制 UI 标准已适用**：运维管理后台和运营管理后台的登录 screen 都是独立页面，
实施必须使用 `@ant-design/pro-components` 的 `LoginFormPage`，不能继续使用 `Card + Form` 自建壳。
“节点”、`groupWorkspaceKey`、`roleAssignmentRef`、`dataNodeRef`、capability、session 等只可在
技术对齐表中出现，绝不作为标题、字段、按钮、空态或反馈文案。

## 2. 交互地图

| 顺序 | 前提 | route / 屏幕 | 用户目的 | 可见信息与可操作项 | server/owner readback | 成功去向 | 失败/退出恢复 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 未认证 | 运维管理后台 `/platform/login`，`IA01-PLATFORM-LOGIN`；**独立 `LoginFormPage`** | 运维管理员登录平台或进入自助重置入口 | 登录名+密码；手机验证码登录；“忘记密码”链接 | `platformPasswordLogin`；平台 OTP 和自助恢复均为需补齐的 platform-iam public contract family | 登录成功后进入平台壳；点击“忘记密码”进入 `IA01-PLATFORM-RECOVERY-VERIFY` | 字段保留；typed Problem 映射展示；未知结果先读 session |
| 2 | 未认证 | 运营管理后台 `/operations/{集团空间编码}/login`，`IA01-OPERATIONS-LOGIN`；**独立 `LoginFormPage`** | 商场运营方或店铺运营方登录所属集团空间或进入自助重置入口 | 集团空间**LOGO**、集团空间名称、运营管理后台标题、登录名+密码或手机号验证码；“忘记密码”；不显示也不输入集团空间编码 | 先 `getOperationsWorkspaceLoginEntry`；再 `operationsWorkspacePasswordLogin` / existing operations OTP operations；恢复由 workspace-IAM 新的 anonymous flow 最终核验 | owner 返回 workspace session entry 后进入任职选择或 shell；“忘记密码”保留已品牌化集团空间上下文进入 IA05 | 入口加载、未找到、停用、失败各自成页；登录失败字段保留；未知结果先读 entry |
| 3 | 未认证 | `IA01-PLATFORM-RECOVERY-VERIFY/PASSWORD/COMPLETE`；platform-admin 所属公开恢复页面 | 运维管理员以账号、本人手机号和验证码恢复密码 | 账号、手机号、验证码、新密码、完成提示；不创建 session | `GAP-PLATFORM-SELF-SERVICE-RESET`：platform-iam 必须新建匿名 start/send/verify/complete owner flow | 完成后只回平台登录页 | 统一结果、不泄露账号或手机号匹配；未知结果由 owner flow readback 确认 |
| 4 | 未认证且收到邀请 URL | 运营管理后台所属的 public `/operations/invitations/{groupWorkspaceKey}/{invitationToken}`，`IA01-PUBLIC-INVITATION`；独立公开页面，不进入已登录后台 shell | 受邀人了解并本人接受任职邀请 | 集团空间 LOGO、集团空间名称、运营管理后台标题、任职机构、业务角色、已脱敏手机号、有效期；同意、验证码、补齐凭据、完成 | `get/accept/sendOtp/verifyOtp/saveCredentials/completePublicInvitation` | 完成后仅回到该空间运营管理后台登录入口 | 失效/拒绝保留安全说明，不提前创建任职；刷新从 get view 重建 |
| 5 | 已认证、有相应用户管理权限 | 运营管理后台五个用户管理**内容 Tab**，`IA01-USER-INVITATION-ACTIONS`；详情/发出邀请为 Drawer，取消/重发为确认 Modal | 对本机构范围内人员发起、取消、重发邀请 | 手机号、任职机构候选、业务角色；邀请状态和逐行取消/重发 | `get/create/cancel/reissueOperationsWorkspace{Target}Invitation*` | owner readback 后只刷新本 target 内容 Tab | typed 失败保持已确认列表与安全草稿；未知结果先重读 invitation |

## 3. v2 对应页面盘点

| screen id | 对应关系 | all-v2 Heritage path@SHA-256 | 静态基线 / 摹本标注 | 差异及原因 |
| --- | --- | --- | --- | --- |
| IA01-PLATFORM-LOGIN | PARTIAL_COUNTERPART | `apps/frontend/platform-admin/src/features/authentication/ui/PlatformLoginPage.tsx@83aa1c365ab84df20d37a1256d445b8b0a8775223b0721c19d51878a91aa8a2b` | `DEXTER_WAIVED_2026-07-29；等价证据：R5 #PLATFORM-LOGIN + 本稿 §4` | v2 基线是密码页；P-N1 已裁定新增 OTP，故不能假称 exact carry-over。Heritage 注册状态按 R5 表为 `PENDING_HERITAGE_REGISTRATION`，只作静态审阅。 |
| IA01-OPERATIONS-LOGIN | PARTIAL_COUNTERPART | `WorkspaceLoginPage.tsx@d04db79096a1f474aac00b0de3f67e07a9848dd38c388a06b2a2f3daf28a3f0f` | `DEXTER_WAIVED_2026-07-29；等价证据：R5 #OPERATIONS-LOGIN + 本稿 §4` | 运营管理后台 URL 携带集团空间编码；以 v4 的“入口先读→品牌→登录”信息层级纠正 v2s 当前误把编码做成表单字段的形状；本仓按强制标准使用 `LoginFormPage`，不改变 owner session 边界。 |
| IA01-PUBLIC-INVITATION | PARTIAL_COUNTERPART | `InvitationAcceptancePage.tsx@0a9973f2c8f4f94cf76f5c82b61fc2987e13205e364ca0e30f97d74016c5cafd` | `DEXTER_WAIVED_2026-07-29；等价证据：R5 #INVITATION-ACCEPTANCE + 本稿 §4` | 这是运营管理后台所属的未认证公开入口，不是已登录 shell；保持“详情→同意→手机号验证→按 readiness 补齐→完成”，并在四步始终显示集团空间 LOGO、名称和运营管理后台标题。 |
| IA01-USER-INVITATION-ACTIONS | PARTIAL_COUNTERPART | `UserManagementPage.tsx@c811961086741b0da5a53f8a38dcc4ef7d7df9a3589be466bb95ea58e7f44265` | `DEXTER_WAIVED_2026-07-29；等价证据：R5 #FIVE-USER-PAGES + 本稿 §4` | 按 target 分为五页，不合成万能用户页；新增仍是邀请，撤销任职另走直接动作。 |

`IA01-OPERATIONS-LOGIN` 另以只读 v4 的
`/Users/dexter/Documents/workspace/idea/catering-server-v4/frontend/apps/catering-operations-admin/src/pages/Login.tsx@b95fb172f3131641a361652625c71c66b46f4bb8efd6cdee288d181c8010f737`
作为**展示基线**：由入口 URL 取得集团空间标识，先读取入口展示信息，再显示“品牌标识 +
集团空间名称 + 运营管理后台标题 + 两种登录方式”。v4 的同一标题 helper 和登录品牌规则见
`/Users/dexter/Documents/workspace/idea/catering-server-v4/docs/architecture/frontend-resource-conventions.md@bfeb5dadfc6ebc746fd0e9fc858ef222a0d0b15c033e725369f9c3da3fbe4b65`。
这只是只读任务与信息基线：v4 使用 `LoginForm`，而本仓遵从本 IA 的强制要求，使用
`LoginFormPage`；v4 旧文案“平台运维后台”不带入本仓，统一写“运维管理后台”。v4 的自定义左对齐
72px 品牌栅格**不复制**，以免为了摹写旧形状又绕开官方登录页结构。

两个登录 screen 已先重开本仓锁定的 `@ant-design/pro-components@3.1.12-0` 的
`LoginFormPage` 类型与实现：官方页面从 `logo + title + subTitle` 组成 header，`message` 位于
ProForm 顶部，`children` 是登录方式和字段，默认 `submitter` 是 328px 主表单区内的全宽 large
提交按钮，`actions` 在主表单区下方；`activityConfig`、背景图和背景视频都是可选项。本 IA 不使用
后三者，不额外套 `Card + Form` 壳；两页只把各自的业务标题、品牌和字段映射到这套官方结构。

## 4. 低保真线框

<a id="IA01-PLATFORM-LOGIN"></a>

### Screen: IA01-PLATFORM-LOGIN

```text
CONSUMER_FACE=platform-admin（运维管理后台）
UI_SURFACE=独立页面；@ant-design/pro-components LoginFormPage
HOST_AND_ENTRY=/platform/login；未认证运维管理员直接进入
ACTOR=系统服务提供者的运维管理员
BUSINESS_SCENARIO=运维管理员开始处理集团空间、角色或平台治理工作前
BUSINESS_GOAL=安全进入运维管理后台
USER_VISIBLE_COPY=标题“运维管理后台”；字段“登录名”“登录密码”“手机号”“验证码”；按钮“登录”“获取验证码”；链接“忘记密码”；失败提示使用业务化登录提示；仅当 owner 返回本次非空测试验证码时显示提示“当前为测试环境，验证码：<code>”
TECHNICAL_BOUNDARY=platform session、Idempotency-Key、Problem code 和诊断码仅在实现/日志边界使用，不显示给用户；测试验证码提示仅由服务端非生产配置决定，生产不存在，页面不能由 URL、请求、session 或本地开关推导
FOUNDATION_PRIMITIVE=useSubmissionLifecycle, testId
LOGIN_FORM_PAGE_VERSION=@ant-design/pro-components@3.1.12-0
LOGIN_FORM_PAGE_OFFICIAL_COMPOSITION=logo:统一运维管理后台标识，与 title 在官方 header 左右并列；title:“运维管理后台”；subTitle:在 header 下方显示“请使用账号登录”；message:仅在失败时显示业务化 Alert；children:账号密码/手机验证码 Tabs 与对应 ProForm 字段；submitter:默认全宽 large 主按钮，文字按 tab 为“登录”或“验证并登录”；actions:账号密码 Tab 下显示唯一“忘记密码”链接，进入本稿 IA01-PLATFORM-RECOVERY-VERIFY；activityConfig:不使用，登录不是营销入口；background:不使用，遵从组件默认页面画布
```

```text
┌──────────────────── 登录页面 ────────────────────┐
│          [运维管理后台标识]  运维管理后台               │
│                    请使用账号登录                        │
│                                                          │
│  登录方式  [账号密码登录]  [手机验证码登录]              │
│  登录名 [____________________________]                  │
│  登录密码 [__________________________]                  │
│  登录提示（仅失败时；不展示诊断码）                      │
│  [────────────────── 登录 ──────────────────]           │
│  忘记密码                                                 │
└────────────────────────────────────────────────────────┘

OTP tab：手机号 [________________] [获取验证码]
         验证码 [________________]
         当前为测试环境，验证码：<code>（仅 owner 返回非空时）
         登录提示                          [验证并登录]
```

**推荐决策（待 Dexter 接受）**：P-N1 的平台 OTP 采用与既有密码登录并列的显式 tab；不以
“忘记密码”伪装 OTP，也不让手机号验证码覆盖密码输入区。G-05 只证明运营端已有两种凭据，
**不**是平台 OTP 的业务授权；这里的新增边界来自 P-N1，必须由本 IA 的看图结论接受。显式
选择可避免在平台页面错误引入 `groupWorkspaceKey`。更短的“OTP-only”路径会强迫既有密码
管理员改用手机号；不选。更复杂的“同屏双表单”增加误提交和可访问性负担；不选。

#### 表单控件依赖图：IA01-PLATFORM-LOGIN

| 用户可见控件 | 控件形态/搜索方式 | owner 候选或初始值来源 | 上游依赖与可用条件 | 变更后的级联清理/重载 | 可选项约束 | loading/empty/failed | 提交时 owner 再核验 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 登录方式 | 两项 `Tabs` | 页面默认“账号密码登录”；OTP 是 P-N1 已接受后才提供的第二项 | 无上游依赖 | 切换时清空另一方式的密码、验证码及其发送状态 | 只可在两种已批准方式间选择 | 登录中禁切换；失败保留当前方式 | 登录 owner 按所选方式核验凭据 |
| 登录名 | `Input` | 用户填写 | 仅账号密码方式显示 | 切离该方式清空 | 长度/字符仅作本地格式提示 | 格式失败不提交；登录失败保留非敏感值 | 密码登录 owner 核验 |
| 登录密码 | `Password` | 用户填写 | 仅账号密码方式显示且登录名非空 | 切换方式、失败或离开页面即清空 | 不在前端判断凭据 | 提交中禁编辑；失败清空密码 | 密码登录 owner 核验 |
| 手机号 | `Input` | 用户填写 | 仅手机验证码方式显示 | 改号即清空验证码和已发送状态 | 手机号格式 | 格式错误不能发送；发送失败可更正后重试 | OTP owner 核验手机号 |
| 获取验证码 | 次要按钮 | 当前手机号输入 | 手机号格式通过且未在发送中 | 成功后启动该手机号的验证码时效；改号即失效 | 仅当前手机号可发送 | 发送中禁重复；失败不生成可提交状态 | OTP send owner 核验 |
| 验证码 / 验证并登录 | `Input` + 主提交按钮 | 用户填写 / 当前发送成功状态 | 仅验证码已向当前手机号发送后启用 | 改手机号或验证失败清空验证码 | 验证码格式；仅 owner 返回本次非空测试验证码时显示测试提示，不推导 | 提交中禁重复；失败清空验证码并提示 | OTP verify/login owner 核验验证码和登录结果 |
| 忘记密码 | `LoginFormPage.actions` 内的文本链接 | 无 | 仅账号密码 Tab、未提交时可用 | 不携带密码或验证码；离开登录页清空全部秘密 | 只进入 IA01-PLATFORM-RECOVERY-VERIFY，不在登录页发起重置 | 不可用时不显示技术原因 | 公开恢复 owner 从账号、手机号和验证码重新验证本人；登录页不能自行判断或签发恢复凭据 |

<a id="IA01-PLATFORM-RECOVERY-VERIFY"></a>

### Screen: IA01-PLATFORM-RECOVERY-VERIFY

```text
CONSUMER_FACE=public
APPLICATION_AFFILIATION=platform-admin（运维管理后台）；未认证公开入口，不是已登录后台 shell/session
UI_SURFACE=独立页面
HOST_AND_ENTRY=IA01-PLATFORM-LOGIN 的“忘记密码”
ACTOR=无法登录的运维管理员
BUSINESS_SCENARIO=忘记密码但仍可证明本人账号与手机号
BUSINESS_GOAL=以账号、本人手机号和验证码完成恢复前的身份验证
USER_VISIBLE_COPY=标题“找回运维管理后台密码”；步骤“验证身份—设置新密码—完成”；字段“登录名”“手机号”“验证码”；按钮“获取验证码”“下一步”“返回登录”；统一提示“如果信息匹配，验证码将发送到该手机号”；仅当 owner 返回本次非空测试验证码时显示提示“当前为测试环境，验证码：<code>”
TECHNICAL_BOUNDARY=账号是否存在、账号与手机号是否匹配、恢复 flow、验证码、限频键和诊断不显示；不创建 session；测试验证码提示仅由服务端非生产配置决定，生产不存在，页面不能推导
FOUNDATION_PRIMITIVE=testId
HERITAGE_COUNTERPART=NOT_CARRIED_WITH_REASON: Dexter 2026-07-29 新裁决，当前 platform-iam 无公开恢复协议
```

```text
找回运维管理后台密码  验证身份 — 设置新密码 — 完成
登录名 [________________]  手机号 [________________]
验证码 [________________] [获取验证码]
当前为测试环境，验证码：<code>（仅 owner 返回非空时）
[下一步]  返回登录
```

| 控件 | 形态 | 初始值/来源 | 可用条件与级联 | loading/failed | owner 再核验 |
| --- | --- | --- | --- | --- | --- |
| 登录名 | `Input` | 用户填写 | 改变即清空验证码和已发送状态 | 仅本地格式提示 | platform-iam 在匿名恢复 start/send 时以规范化账号匹配 |
| 手机号 | `Input` | 用户填写 | 改变即清空验证码和已发送状态 | 仅本地格式提示 | platform-iam 以账号绑定手机号、账号状态与发送限频重验 |
| 获取验证码 | 次要按钮 | 当前登录名+手机号 | 两者格式通过才可请求；不可由页面判断匹配性 | 提交中禁重复；始终显示统一发送提示 | public recovery start/send 必须以 HMAC 化来源、账号和手机号建立限频，响应不得枚举账号或手机号 |
| 验证码 / 下一步 | `Input` + 主按钮 | 用户填写 / owner 已接受本次发送 | 必须对同一账号和手机号发送成功；任一前置字段改变即失效 | 验证失败清空验证码，保留非敏感账号/手机号 | public recovery verify 必须重新匹配账号、手机号、有效 OTP、账号可用状态和一次性 flow |

<a id="IA01-PLATFORM-RECOVERY-PASSWORD"></a>

### Screen: IA01-PLATFORM-RECOVERY-PASSWORD

```text
CONSUMER_FACE=public
APPLICATION_AFFILIATION=platform-admin（运维管理后台）；未认证公开入口，不是已登录后台 shell/session
UI_SURFACE=独立页面
HOST_AND_ENTRY=IA01-PLATFORM-RECOVERY-VERIFY 由 owner 验证成功后
ACTOR=已完成本人验证的运维管理员
BUSINESS_SCENARIO=继续恢复自己的平台登录密码
BUSINESS_GOAL=设定符合规则的新密码
USER_VISIBLE_COPY=标题“设置新密码”；字段“新密码”“确认新密码”；按钮“上一步”“提交”
TECHNICAL_BOUNDARY=恢复 flow、一次性完成凭据、规则诊断和 session 不显示
FOUNDATION_PRIMITIVE=testId
HERITAGE_COUNTERPART=NOT_CARRIED_WITH_REASON: 同上
```

| 控件 | 形态 | 可用条件与级联 | 状态 | owner 再核验 |
| --- | --- | --- | --- | --- |
| 新密码/确认新密码 | `Password` | 仅 owner 已验证的恢复 flow 可进入；改新密码即重验确认 | 离开、失败、成功均清除秘密 | platform-iam complete 必须重验 flow、一次性 grant、账号状态、密码规则和未过期性 |

<a id="IA01-PLATFORM-RECOVERY-COMPLETE"></a>

### Screen: IA01-PLATFORM-RECOVERY-COMPLETE

```text
CONSUMER_FACE=public
APPLICATION_AFFILIATION=platform-admin（运维管理后台）；未认证公开入口
UI_SURFACE=独立页面
HOST_AND_ENTRY=IA01-PLATFORM-RECOVERY-PASSWORD 提交且 owner readback=completed 后
ACTOR=刚完成平台密码恢复的运维管理员
BUSINESS_SCENARIO=得知密码已经重置且旧会话已由 owner 作废
BUSINESS_GOAL=返回登录页使用新密码
USER_VISIBLE_COPY=“密码已重设”；“请使用新密码登录运维管理后台。”；按钮“返回登录”
TECHNICAL_BOUNDARY=不显示会话数、恢复 grant 或账户内部状态；不创建 session
FOUNDATION_PRIMITIVE=testId
HERITAGE_COUNTERPART=NOT_CARRIED_WITH_REASON: 同上
```

### 自助恢复 owner/协议边界（两个管理后台的共同裁决）

`GAP-PLATFORM-SELF-SERVICE-RESET`：当前 `PlatformAuthenticationController` 和
`platform-auth.paths.yaml` 只有 password login/current-password/session/logout，缺少匿名恢复家族；
最终详设必须新增 platform-iam owner 的 start/send/verify/complete readback，而不能复用或猜测
workspace 的 `resetGenerationKey`。

现有管理员发起的 `requestWorkspaceCredentialReset → /api/public/password-reset/{resetGenerationKey}`
链**保留**：它服务于已认证运维管理员对某运营账号发起的凭据恢复，仍由
`WorkspacePasswordResetService#request` 生成并受该管理员动作约束。Dexter 裁决的自助恢复**替换其
作为“登录页入口”的角色，但不替换该管理链**：两个 face 各自由 owner 在匿名 start 后建立短时、
不可展示的自助恢复 flow（例如 secure HttpOnly cookie 或等价 owner-bound opaque handle），OTP verify
只向该 flow 释放一次性完成 grant。不得把 raw `resetGenerationKey`、账号匹配结论或恢复 grant 放进 URL、
品牌、表单或浏览器可见提示。

共同安全不变量：start/send 对存在、停用、不匹配和不存在账号返回相同业务提示；按 face、规范化账号、
手机号和 HMAC 化来源执行发送/验证限频；verify/complete 在同一 owner 事务中重验账号、手机号、OTP、
flow、账号状态、过期与一次性使用，并在成功后作废该账号所有有效 session。前端仅做格式、冷却和秘密清理，
不能用“已发送/未找到”等本地状态推导账号事实。

<a id="IA01-OPERATIONS-LOGIN"></a>

### Screen: IA01-OPERATIONS-LOGIN

```text
CONSUMER_FACE=operations-admin（运营管理后台）
UI_SURFACE=独立页面；@ant-design/pro-components LoginFormPage
HOST_AND_ENTRY=/operations/{集团空间编码}/login；未认证运营用户从所属集团空间入口进入
ACTOR=商场运营方或店铺运营方的运营用户
BUSINESS_SCENARIO=运营用户通过所属集团空间的入口开始日常组织、主体、门店、合同或用户管理工作前
BUSINESS_GOAL=进入所属集团空间并继续选择本次使用的任职
USER_VISIBLE_COPY=品牌区**必须将“<集团空间 LOGO>”与“<集团空间名称>”左右并列显示**，并在其下显示“<运营管理后台标题>”；字段“登录名”“登录密码”“手机号”“验证码”；方式“账号密码登录”“手机号验证码登录”；按钮“登录运营管理后台”“获取验证码”“验证并登录”；链接“忘记密码”；入口状态“正在准备登录页面”“入口不存在”“该集团空间暂不可进入运营管理后台”“暂时无法打开登录入口，请稍后重试”；仅当 owner 返回本次非空测试验证码时显示提示“当前为测试环境，验证码：<code>”
TECHNICAL_BOUNDARY=URL 中的 groupWorkspaceKey 仅定位入口；先由匿名 getOperationsWorkspaceLoginEntry 读取 workspaceName、operationsTitle、gateway-approved logoUrl、status 和 sessionState，再由既有登录 operation 作最终核验。当前 login-entry 只有 logoAssetRef 且 controller 固定返回 null，不能满足本 screen；final P6 详设必须将 owner-approved logoUrl 加入其 readback，并复用平台集团空间详情的资产 owner URL 解析规则，client 绝不从 logoAssetRef 推导 URL。session entry、Idempotency-Key、Problem code 不显示给用户；URL 或 login-entry 绝不构成授权；测试验证码提示仅由服务端非生产配置决定，生产不存在，页面不能推导
FOUNDATION_PRIMITIVE=useAsyncGenerationGuard, useSubmissionLifecycle, testId
LOGIN_FORM_PAGE_VERSION=@ant-design/pro-components@3.1.12-0
LOGIN_FORM_PAGE_OFFICIAL_COMPOSITION=logo:直接传入 gateway-approved logoUrl 所展示的“<集团空间 LOGO>”，不从资源引用拼接，且与 title 在官方 header 左右并列；未配置 LOGO 或图片加载失败时才显示统一默认标识；title:“<集团空间名称>”；subTitle:在 header 下方显示“<运营管理后台标题>”；message:仅在登录失败时显示业务化 Alert；children:账号密码/手机验证码 Tabs 与对应 ProForm 字段；submitter:默认全宽 large 主按钮，文字按 tab 为“登录运营管理后台”或“验证并登录”；actions:账号密码 Tab 下显示唯一“忘记密码”链接，进入 IA05-RECOVERY-VERIFY；activityConfig:不使用，登录不是营销入口；background:不使用，遵从组件默认页面画布
```

```text
┌──────────────────── 登录页面 ────────────────────┐
│        [<集团空间 LOGO> / 默认标识]  <集团空间名称>     │
│                    <运营管理后台标题>                    │
│                                                          │
│  登录方式  [账号密码登录]  [手机号验证码登录]              │
│  登录名 [____________________________]                  │
│  登录密码 [__________________________]                  │
│  登录提示（仅失败时；映射为用户可理解的提示）            │
│  [──────────── 登录运营管理后台 ─────────────]           │
│  忘记密码                                                 │
└────────────────────────────────────────────────────────┘

手机号验证码登录：手机号 [________________] [获取验证码]
                  验证码 [________________]
                  当前为测试环境，验证码：<code>（仅 owner 返回非空时）
                                      [验证并登录]
```

该页必须由 `LoginFormPage` 提供页面壳、官方 header/主表单区和 submit 生命周期；URL 中的集团空间编码只定位入口，
不作为用户字段，也不在品牌区回显。先调用既有 `getOperationsWorkspaceLoginEntry`：加载中只显示
登录页骨架；找不到时显示“入口不存在”；状态为停用时禁用全部登录操作并显示“该集团空间暂不可
进入运营管理后台”；读取失败时显示可重试的“暂时无法打开登录入口，请稍后重试”。成功读回后，
以 `workspaceName` 作与 LOGO 左右并列的官方主标题、以 `operationsTitle` 作 header 下方副标题，并把 owner 返回的 `logoUrl` 直接传给
`LoginFormPage.logo`，使登录框显示该集团空间的 LOGO；不得把资源引用拼成 URL。集团空间没有配置
LOGO，或已批准 URL 的图片加载失败时，才显示统一默认标识且不阻塞登录，不显示资源引用。若
`sessionState=AUTHENTICATED`，不据此自行进入业务页，仍由既有
session entry readback 决定是否进入任职选择或 shell。登录成功后也同理由 owner 返回本次可用任职，
再按 IA-02 选择或进入 shell。v4 的视觉层级在此复用，`LoginFormPage` 是本仓有意的组件升级，不是
对 v4 runtime 的搬运。

#### 表单控件依赖图：IA01-OPERATIONS-LOGIN

| 用户可见控件 | 控件形态/搜索方式 | owner 候选或初始值来源 | 上游依赖与可用条件 | 变更后的级联清理/重载 | 可选项约束 | loading/empty/failed | 提交时 owner 再核验 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 集团空间品牌区 | `LoginFormPage.logo/title/subTitle` | 成功 `getOperationsWorkspaceLoginEntry` 的名称、标题和批准 LOGO URL | 登录 entry 成功且空间可进入后显示表单 | 路径变化或 entry 重读时清空全部敏感草稿并重建品牌 | 只消费 owner readback；不从 URL/资源引用推导 | loading 显示骨架；不存在/停用/读取失败不开放表单 | 登录 entry owner 决定入口可用性 |
| 登录方式 | 两项 `Tabs` | 成功 entry 后默认账号密码 | 依赖可进入的 entry | 切换时清空另一方式的密码、验证码和发送状态 | 账号密码/手机号验证码两项 | 登录中禁切换；entry 失效回入口状态 | 登录 owner 按所选方式核验 |
| 登录名 / 登录密码 | `Input` / `Password` | 用户填写 | 依赖 entry 成功且为账号密码方式 | 切换方式、entry 失效或登录失败清空密码 | 仅本地格式提示 | submitting 禁编辑；失败保留非敏感登录名 | 密码登录 owner 核验 |
| 手机号 | `Input` | 用户填写 | 依赖 entry 成功且为手机号验证码方式 | 改号清空验证码和已发送状态 | 手机号格式 | 格式失败不发送 | OTP owner 核验手机号 |
| 获取验证码 | 次要按钮 | 当前手机号输入 | 依赖格式通过、entry 有效且未在发送中 | 成功后绑定当前手机号的验证码时效；改号即失效 | 仅当前手机号可发送 | 发送中禁重复；失败可更正重试 | OTP send owner 核验 |
| 验证码 / 验证并登录 | `Input` + 主提交按钮 | 用户填写 / 当前发送成功状态 | 仅验证码已向当前手机号发送后启用 | 改号、entry 失效或验证失败清空验证码 | 验证码格式；仅 owner 返回本次非空测试验证码时显示测试提示，不推导 | submitting 禁重复；失败显示业务提示 | OTP verify/login owner 核验验证码与入口状态 |

<a id="IA01-PUBLIC-INVITATION"></a>

### Screen: IA01-PUBLIC-INVITATION

```text
CONSUMER_FACE=public（不是任一管理后台）
APPLICATION_AFFILIATION=operations-admin（运营管理后台所属公开入口；未认证，不建立或进入运营后台 session）
UI_SURFACE=内容页（公开邀请独立页面的“邀请详情”步骤）
HOST_AND_ENTRY=/operations/invitations/{集团空间编码}/{邀请令牌}；受邀人打开收到的邀请链接
ACTOR=收到运营任职邀请的个人
BUSINESS_SCENARIO=受邀人从邀请链接确认加入指定机构的运营工作
BUSINESS_GOAL=完成本人验证和账号准备，使邀请规定的任职生效
USER_VISIBLE_COPY=共享品牌区始终显示“<集团空间 LOGO>”“<集团空间名称>”“<运营管理后台标题>”；本步骤页面标题为动态“加入<运营管理后台标题>”；“受邀加入的组织”“业务角色”“受邀手机号”“有效期”；按钮“同意邀请”“返回”；失败提示“邀请链接不可用”
TECHNICAL_BOUNDARY=public protocol 保持匿名；PublicInvitationView 必须由 owner 返回 workspaceName、operationsTitle 与 gateway-approved logoUrl；四个步骤的页面标题一律由 `加入${operationsTitle}` 形成，不得写死“加入运营管理后台”或在 client 另设 fallback。client 不从 groupWorkspaceKey 或 logoAssetRef 推导品牌信息，也不把 invitation token、readiness、verification grant 和 owner protocol 显示给用户
FOUNDATION_PRIMITIVE=useAsyncGenerationGuard, useSubmissionLifecycle, testId
```

```text
┌──────────── 加入<运营管理后台标题> ────────────┐
│ [<集团空间 LOGO>] <集团空间名称>               │
│                    <运营管理后台标题>          │
│ 1 邀请详情 ─ 2 手机验证 ─ 3 完善账号 ─ 4 完成 │
├──────────────────────────────────────────────┤
│ 受邀加入的组织：<组织路径>                     │
│ 业务角色：<角色名称>                           │
│ 受邀手机号：<已脱敏手机号>  有效期：<日期时间> │
│                                                │
│ [不同意 / 退出]                     [同意邀请] │
└──────────────────────────────────────────────┘
```

第 2 步只接受该 invitation 的手机号+验证码；第 3 步只有 owner readiness 要求时才显示姓名、
登录名和密码；第 4 步由 `completePublicInvitation` 作为唯一完成动作。显示信息全部来自
`PublicInvitationView`；不从 token 或 URL 推导权限。

<a id="IA01-PUBLIC-INVITATION-OTP"></a>

### Screen: IA01-PUBLIC-INVITATION-OTP

```text
CONSUMER_FACE=public（不是任一管理后台）
APPLICATION_AFFILIATION=operations-admin（运营管理后台所属公开入口；未认证，不建立或进入运营后台 session）
UI_SURFACE=内容页（公开邀请独立页面的“手机验证”步骤）
HOST_AND_ENTRY=受邀人点击“同意邀请”后进入；仍在原邀请链接的独立页面内
ACTOR=已同意邀请的受邀人
BUSINESS_SCENARIO=受邀人需要证明邀请中的手机号确由本人使用
BUSINESS_GOAL=完成手机验证并继续完成加入流程
USER_VISIBLE_COPY=共享品牌区显示“<集团空间 LOGO>”“<集团空间名称>”“<运营管理后台标题>”；页面标题“加入<运营管理后台标题> · 手机验证”；字段“手机号”“验证码”；按钮“获取验证码”“验证并继续”；提示“验证码已发送，请在有效期内填写”；仅当 owner 返回本次非空测试验证码时显示提示“当前为测试环境，验证码：<code>”
TECHNICAL_BOUNDARY=邀请令牌、验证码、verification grant、idempotency 不展示；品牌只消费邀请 view 的 owner-approved readback；测试验证码提示仅由服务端非生产配置决定，生产不存在，页面不能推导
FOUNDATION_PRIMITIVE=useSubmissionLifecycle, testId
```

```text
┌────────── 加入<运营管理后台标题> · 手机验证 ──────────┐
│ [<集团空间 LOGO>] <集团空间名称> · <运营管理后台标题> │
│ 手机号 [________________] [获取验证码]               │
│ 验证码 [________________]                            │
│ 当前为测试环境，验证码：<code>（仅 owner 返回非空时） │
│ 操作提示                                              │
│ [返回]                               [验证并继续]    │
└─────────────────────────────────────────────────────┘
```

#### 表单控件依赖图：IA01-PUBLIC-INVITATION-OTP

| 用户可见控件 | 控件形态/搜索方式 | owner 候选或初始值来源 | 上游依赖与可用条件 | 变更后的级联清理/重载 | 可选项约束 | loading/empty/failed | 提交时 owner 再核验 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 手机号 | `Input` | 受邀人填写；邀请 view 仅作 owner 期望号码的事实来源 | 已同意邀请且 owner 进入手机验证步骤 | 改号立即清空验证码与已发送状态 | 手机号格式；前端不自行判断是否等于邀请号码 | 格式错误不能发送；失效邀请终止该步骤 | public OTP owner 核验手机号仍属于该邀请 |
| 获取验证码 | 次要按钮 | 当前手机号输入 | 依赖手机号格式和当前邀请仍有效 | 成功后创建仅对当前手机号有效的发送状态；改号即失效 | 仅当前手机号可发送 | 发送中禁重复；失败可更正重试 | public OTP send owner 核验邀请与手机号 |
| 验证码 / 验证并继续 | `Input` + 主提交按钮 | 用户填写 / 当前发送成功状态 | 仅向当前手机号发送成功后启用 | 改号、邀请失效或验证失败清空验证码 | 验证码格式 | submitting 禁重复；失败保留非敏感手机号 | public verify owner 核验验证码、邀请和下一步 readiness |

<a id="IA01-PUBLIC-INVITATION-CREDENTIALS"></a>

### Screen: IA01-PUBLIC-INVITATION-CREDENTIALS

```text
CONSUMER_FACE=public（不是任一管理后台）
APPLICATION_AFFILIATION=operations-admin（运营管理后台所属公开入口；未认证，不建立或进入运营后台 session）
UI_SURFACE=内容页（公开邀请独立页面的“完善账号”步骤）
HOST_AND_ENTRY=手机验证通过且服务端要求补充账号资料时进入
ACTOR=已完成手机验证的受邀人
BUSINESS_SCENARIO=受邀人尚缺少运营管理后台所需的账号资料
BUSINESS_GOAL=提交本人姓名、登录名和登录密码，继续完成加入
USER_VISIBLE_COPY=共享品牌区显示“<集团空间 LOGO>”“<集团空间名称>”“<运营管理后台标题>”；页面标题“加入<运营管理后台标题> · 完善账号”；字段“姓名”“登录名”“登录密码”；按钮“保存并继续”；失败提示“账号信息暂未保存，请检查后重试”
TECHNICAL_BOUNDARY=readiness、verification grant、credential command 不展示；品牌只消费邀请 view 的 owner-approved readback
FOUNDATION_PRIMITIVE=useSubmissionLifecycle, testId
```

```text
┌────────── 加入<运营管理后台标题> · 完善账号 ──────────┐
│ [<集团空间 LOGO>] <集团空间名称> · <运营管理后台标题> │
│ 姓名     [________________]                          │
│ 登录名   [________________]                          │
│ 登录密码 [________________]                          │
│ [返回]                                 [保存并继续]  │
└─────────────────────────────────────────────────────┘
```

#### 表单控件依赖图：IA01-PUBLIC-INVITATION-CREDENTIALS

| 用户可见控件 | 控件形态/搜索方式 | owner 候选或初始值来源 | 上游依赖与可用条件 | 变更后的级联清理/重载 | 可选项约束 | loading/empty/failed | 提交时 owner 再核验 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 姓名 | `Input` | 受邀人填写 | 无表单内上游；仅 owner readiness 要求补全账号信息且验证授权有效时显示 | 离开、邀请/授权失效后清空草稿 | 本地格式/长度提示 | 校验失败保留非敏感输入 | public credential owner 核验 readiness 与字段 |
| 登录名 | `Input` | 受邀人填写 | 同上 | 离开、邀请/授权失效后清空草稿 | 本地格式/长度提示；不在前端判断占用 | 校验失败保留非敏感输入 | public credential owner 核验唯一性与字段 |
| 登录密码 | `Password` | 受邀人填写 | 同上 | 切离页面、邀请/授权失效或提交失败立即清空 | 密码规则提示；不可回显 | submitting 禁编辑；失败清空密码 | public credential owner 核验密码规则 |
| 保存并继续 | 主提交按钮 | 三项有效输入与 owner readiness | 依赖姓名、登录名、登录密码均通过本地格式；验证授权仍有效 | 成功后由 owner readback 决定下一步骤 | 不允许跳过 owner required 字段 | 提交中禁重复；未知先重读邀请完成状态 | public credential owner 原子核验 readiness、授权和三项资料 |

<a id="IA01-PUBLIC-INVITATION-COMPLETE"></a>

### Screen: IA01-PUBLIC-INVITATION-COMPLETE

```text
CONSUMER_FACE=public（不是任一管理后台）
APPLICATION_AFFILIATION=operations-admin（运营管理后台所属公开入口；未认证，不建立或进入运营后台 session）
UI_SURFACE=内容页（公开邀请独立页面的“完成”步骤）
HOST_AND_ENTRY=手机验证完成，且账号资料已满足要求后进入
ACTOR=已经完成必要资料的受邀人
BUSINESS_SCENARIO=受邀人最后确认接受的任职
BUSINESS_GOAL=使邀请规定的任职生效，并转到所属集团空间的运营管理后台登录页
USER_VISIBLE_COPY=共享品牌区显示“<集团空间 LOGO>”“<集团空间名称>”“<运营管理后台标题>”；页面标题“加入<运营管理后台标题> · 完成”；提示“信息已准备完成”；按钮“完成加入”“前往登录”；失败提示“暂未完成加入，请重试”
TECHNICAL_BOUNDARY=completion state、assignment 生成和重放协议不展示；品牌只消费邀请 view 的 owner-approved readback
FOUNDATION_PRIMITIVE=useSubmissionLifecycle, testId
```

```text
┌──────────── 加入<运营管理后台标题> · 完成 ─────────────┐
│ [<集团空间 LOGO>] <集团空间名称> · <运营管理后台标题> │
│ 信息已准备完成                                        │
│ 完成加入后，请使用<运营管理后台标题>登录页继续。       │
│ [返回]                                   [完成加入]  │
└─────────────────────────────────────────────────────┘
```

<a id="IA01-USER-INVITATION-ACTIONS"></a>

### Screen: IA01-USER-INVITATION-ACTIONS

```text
CONSUMER_FACE=operations-admin（运营管理后台）
UI_SURFACE=内容 Tab（用户管理内容页中的“邀请”）
HOST_AND_ENTRY=运营管理后台五个用户管理内容页；点击“邀请”Tab 后进入
ACTOR=具有当前机构用户管理权限的运营用户
BUSINESS_SCENARIO=需要让某人以指定业务角色服务于当前管理范围内的机构
BUSINESS_GOAL=发出、查看、取消或重新发送一项可追溯的任职邀请
USER_VISIBLE_COPY=Tab“邀请”；筛选“邀请手机号”“任职机构”“业务角色”“状态”“有效期”；按钮“查询”“重置”“发出邀请”；列表业务标识链接“邀请手机号”
TECHNICAL_BOUNDARY=target type、capability、expected version、idempotency 和 owner readback 不显示给用户
FOUNDATION_PRIMITIVE=contextScopedQueryArgs, useDetailDrawer, testId
```

```text
┌────── <集团|大区|项目|总公司|门店> 用户管理 ─────┐
│ [用户] [邀请]                                      │
├──────────────────────────────────────────────────┤
│ 邀请手机号 [____] 任职机构 [____] 业务角色 [____] 状态 [全部 v] 有效期 [日期范围] [查询][重置] │
│ [发出邀请]                                         │
│ 邀请手机号（链接） | 任职机构 | 业务角色 | 状态 | 有效期 │
│ <邀请手机号>（链接） | <任职机构> | <业务角色> | <状态> | <有效期> │
└──────────────────────────────────────────────────┘
```

每个页面的 target 类型由该页面绑定的 generated operation/capability 确定；不得由用户输入、
pageKey 传给后端或当前 session assignment 反推。五个 target 不合并为单页/单 endpoint 的 UI 假象。
Tab 只负责定位邀请和打开详情：发出邀请只打开 Create Drawer；重新发送、取消邀请只在详情 Drawer 已读回
该邀请且 owner 判断为可执行时出现，并再打开确认 Modal。列表不承载内嵌创建表单或行内 mutation 动作。

<a id="IA01-USER-INVITATION-CREATE-DRAWER"></a>

### Screen: IA01-USER-INVITATION-CREATE-DRAWER

```text
CONSUMER_FACE=operations-admin（运营管理后台）
UI_SURFACE=Drawer
HOST_AND_ENTRY=五个用户管理内容页的“邀请”Tab；点击“发出邀请”打开
ACTOR=具有当前机构用户管理权限的运营用户
BUSINESS_SCENARIO=用户已确认需要邀请一位人员加入当前管理范围内的机构
BUSINESS_GOAL=填写受邀人和任职信息，发出一项任职邀请
USER_VISIBLE_COPY=标题“发出邀请”；字段“邀请手机号”“任职机构（可搜索）”“业务角色”；“业务角色”在先选择任职机构前显示“请先选择任职机构”；按钮“取消”“发出邀请”；失败提示“邀请暂未发出，请检查后重试”
TECHNICAL_BOUNDARY=当前用户管理页已绑定的目标机构类型决定统一 CandidateQuery 的 subject/dependency；candidate ref、role id、capability、expected context version 不展示。前端不从页面 key、当前任职或 URL 猜测机构/角色；owner 在候选读取和创建 command 时都再次核验
FOUNDATION_PRIMITIVE=adminDrawerSurfaceProps, useAsyncGenerationGuard, useDrawerFormLifecycle, contextScopedQueryArgs, testId
```

```text
┌──────────────────── 发出邀请 ────────────────────┐
│ 邀请手机号 [________________]                     │
│ 任职机构   [搜索机构名称或路径...          v]     │
│ 业务角色   [请先选择任职机构              v]     │
│ 操作提示                                          │
│ [取消]                              [发出邀请]    │
└─────────────────────────────────────────────────┘
```

#### 表单控件依赖图：IA01-USER-INVITATION-CREATE-DRAWER

| 用户可见控件 | 控件形态/搜索方式 | owner 候选或初始值来源 | 上游依赖与可用条件 | 变更后的级联清理/重载 | 可选项约束 | loading/empty/failed | 提交时 owner 再核验 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 邀请手机号 | 手机号 `Input` | 用户填写 | 无上游依赖 | 不影响其他控件 | 手机号格式；不在前端判断账号是否存在 | 格式错误即时提示；提交失败保留非敏感输入 | invitation command 复核手机号与邀请条件 |
| 任职机构 | 可搜索 `Select`；按机构名称/路径过滤 owner 已返回候选 | `CandidateQuery(subjectType=任职机构)` adapter 路由当前五个 target 的 owner invitation task read | Drawer 打开且候选加载成功；不依赖手机号 | 选择、清除或改选任职机构时，立即清空已选“业务角色”；不另由 client 猜测或请求跨 target 候选 | 只显示 owner 返回且机构类型等于当前用户管理页面目标类型的机构 | 加载中禁用；空集显示“当前范围内没有可邀请的机构”；读取失败显示重试，不开放角色选择 | create command 以该页面 target 与机构 ref 重新解析任务范围 |
| 业务角色 | searchable multi-`Select`；未闭合 GAP 时禁用 | `CandidateQuery(subjectType=业务角色, dependencies=[任职机构])` adapter 路由 workspace-IAM role task read | 必须先选“任职机构”；其机构类型与当前页面 target 一致后才加载 | 改选/清空任职机构时取消旧请求、清空全部角色与候选页；按 queryText/page 重读 | 只显示 `serviceNodeType` 等于已选任职机构类型且当前范围可用的 owner-returned 角色 | 未选机构显示“请先选择任职机构”；GAP 未闭合显示“暂时无法搜索可选业务角色”，不以一次性全量列表或本地过滤替代 | `GAP-INVITATION-ROLE-CANDIDATE-QUERY`：owner task read 必须接收 queryText/page/pageSize/context token 并返回同一 CandidatePage；create command 对每个 role id、目标机构类型和机构 ref 再次验证 |

该页的五个 owner 候选来源已由用户管理页面 target 固定，且只由统一 CandidateQuery adapter 路由：页面决定“可邀请哪类机构”，用户在该类机构中
搜索并选择具体任职机构，随后才能按统一 query/page 搜索该机构类型的业务角色。机构类型是 owner 的候选事实，不显示为
技术标签，也不能由前端根据名称、路径或当前用户任职推断。

**当前契约缺口（不得以线框掩盖）**：Dexter 已明确要求任职机构可搜索选择；但 current
`WorkspaceUserService#candidatesForOperations` 只返回当前服务端任务范围解析出的一个机构，当前 create
request 也只能把 `scopeRef` 交给 owner 重解。接受本 IA 后，final P6 必须把“当前管理范围内、当前 target
类型的可选任职机构集合”作为 contract + owner + generated client + command revalidation 的同一闭环，且在
机构改选时清空角色；在这之前不能声称当前 bytes 已经满足搜索选择。

<a id="IA01-USER-INVITATION-DETAIL-DRAWER"></a>

### Screen: IA01-USER-INVITATION-DETAIL-DRAWER

```text
CONSUMER_FACE=operations-admin（运营管理后台）
UI_SURFACE=Drawer
HOST_AND_ENTRY=五个用户管理内容页的“邀请”Tab；点击一条邀请记录打开
ACTOR=具有当前机构用户管理权限的运营用户
BUSINESS_SCENARIO=用户需要查看某一已发邀请的状态、有效期和接收信息
BUSINESS_GOAL=判断是否需要重新发送或取消该邀请
USER_VISIBLE_COPY=标题“邀请详情”；“邀请手机号”“任职机构”“业务角色”“状态”“有效期”“邀请链接”；按钮“重新发送”“取消邀请”
TECHNICAL_BOUNDARY=invitation id、revision、raw token 和 command headers 不展示
FOUNDATION_PRIMITIVE=adminDrawerSurfaceProps, useDetailDrawer, useOverlayLock, testId
```

```text
┌──────────────────── 邀请详情 ────────────────────┐
│ 邀请手机号 / 任职机构 / 业务角色 / 状态 / 有效期  │
│ 邀请链接 [复制]                                   │
│ [取消邀请]                         [重新发送]     │
└─────────────────────────────────────────────────┘
```

<a id="IA01-USER-INVITATION-ACTION-MODAL"></a>

### Screen: IA01-USER-INVITATION-ACTION-MODAL

```text
CONSUMER_FACE=operations-admin（运营管理后台）
UI_SURFACE=Modal
HOST_AND_ENTRY=邀请详情 Drawer；点击“取消邀请”或“重新发送”打开
ACTOR=具有当前机构用户管理权限的运营用户
BUSINESS_SCENARIO=用户准备改变一项尚未完成的邀请
BUSINESS_GOAL=明确确认取消或重新发送，避免误操作
USER_VISIBLE_COPY=标题“确认取消邀请？”或“确认重新发送邀请？”；说明“取消后该邀请链接将不再有效”或“重新发送会使旧邀请链接失效”；按钮“返回”“确认”
TECHNICAL_BOUNDARY=command/replay/version conflict 不展示；未知结果先由服务端状态确认
FOUNDATION_PRIMITIVE=useOverlayLock, useSubmissionLifecycle, testId
```

```text
┌──────────── 确认取消邀请？ ────────────┐
│ 取消后该邀请链接将不再有效。            │
│ [返回]                         [确认]   │
└───────────────────────────────────────┘
```

详情 Drawer 只在 owner readback 表示该邀请仍可操作时显示“重新发送”或“取消邀请”；否则保留只读详情。

#### Surface ownership roster（本稿 13 个 screen）

| screen id | 声明 UI_SURFACE | 线框可见元素分母 | owner 对账 | USER_VISIBLE_COPY 对账 | 结论 |
| --- | --- | --- | --- | --- | --- |
| IA01-PLATFORM-LOGIN | 独立登录页 | 官方 header、登录方式、字段、测试验证码提示、提交 | 均属 LoginFormPage | 全部有位置 | PASS |
| IA01-PLATFORM-RECOVERY-VERIFY | 公开独立页 | 账号、手机号、验证码、步骤、统一提示、测试验证码提示、按钮 | 仅恢复验证页 | 全部有位置 | REVISE：等待 `GAP-PLATFORM-SELF-SERVICE-RESET` owner/contract 闭环 |
| IA01-PLATFORM-RECOVERY-PASSWORD | 公开独立页 | 新密码、确认密码、步骤、按钮 | 仅恢复设置页 | 全部有位置 | REVISE：等待同一 GAP |
| IA01-PLATFORM-RECOVERY-COMPLETE | 公开独立页 | 完成提示、返回登录 | 仅恢复完成页 | 全部有位置 | REVISE：等待同一 GAP |
| IA01-OPERATIONS-LOGIN | 独立登录页 | 品牌 header、登录方式、字段、入口状态、测试验证码提示、提交 | 均属 LoginFormPage | 全部有位置 | PASS |
| IA01-PUBLIC-INVITATION | 公开内容页 | 品牌区、步骤、邀请事实、同意/退出 | 均属邀请详情步骤 | 全部有位置 | PASS |
| IA01-PUBLIC-INVITATION-OTP | 公开内容页 | 品牌区、手机号、验证码、测试验证码提示、步骤按钮 | 均属手机验证步骤 | 全部有位置 | PASS |
| IA01-PUBLIC-INVITATION-CREDENTIALS | 公开内容页 | 品牌区、三项资料、步骤按钮 | 均属完善账号步骤 | 全部有位置 | PASS |
| IA01-PUBLIC-INVITATION-COMPLETE | 公开内容页 | 品牌区、完成提示、完成按钮 | 均属完成步骤 | 全部有位置 | PASS |
| IA01-USER-INVITATION-ACTIONS | 内容 Tab | Tab、发出入口、邀请列表、详情入口 | 不画 Drawer 字段或 mutation 行操作 | 全部有位置 | PASS |
| IA01-USER-INVITATION-CREATE-DRAWER | Drawer | 标题、手机号、任职机构、角色、取消/提交 | 仅 Create Drawer | 全部有位置 | PASS |
| IA01-USER-INVITATION-DETAIL-DRAWER | Drawer | 邀请事实、链接复制、条件性详情动作 | 仅 Detail Drawer | 全部有位置 | PASS |
| IA01-USER-INVITATION-ACTION-MODAL | Modal | 确认标题、影响说明、返回/确认 | 仅 Action Modal | 全部有位置 | PASS |

## 5. 状态与边界表

| 屏幕/动作 | initial/loading | validation | submitting | success | conflict/denied | timeout/unknown | owner/face 边界 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| platform password login | `LoginFormPage` header + 默认密码 tab，无默认身份 | 必填但不在前端判凭据 | 仅本次 submit disabled | platform session → 平台壳 | 统一 typed Problem；不泄露账号存在性 | 先 `getCurrentPlatformSession`；未确认才允许重试 | platform-admin；`platform-iam` 判定凭据/会话 |
| proposed platform OTP send/verify/login | tab 切换清空另一方式的密码敏感字段 | 手机格式、验证码非空；服务端仍为真相 | 发送与验证各有独立 lifecycle/key | owner session → 平台壳 | `debug-code-exposure=false` 时无 debug code；DEV/UAT 配置开启且 owner 返回非空时才显示测试提示 | 先 session readback；不盲目重复验证 | platform-admin；OTP owner 不允许 session/request 可推导验证码 |
| platform self-service recovery | 登录名、手机号和验证码无 owner flow 时不能进入设置页；不创建 session | 仅本地格式；不判断账号存在或匹配 | start/send/verify/complete 各自防重；前置字段变更即废弃验证码 | owner completed → 仅返回平台登录 | 不存在/停用/不匹配同一提示；无 raw token/test code | 未知结果先读 recovery flow，不盲重发或完成 | public + platform-admin affiliation；platform-iam 重验账号、手机号、OTP、flow、过期/一次性并撤销 session |
| operations login entry/password/OTP | 先读 login-entry；加载为 `LoginFormPage` 骨架；未找到/停用/读取失败为独立结果面 | 成功读回后才显示登录方式；必填但不在前端判凭据 | 仅本次动作 disabled；停用时无 submit | workspace session entry → 任职选择或 shell | 不泄露账号存在性；停用不显示可登录表单 | 先 session entry readback；未确认才允许重试 | operations-admin；workspace-iam 判定入口、凭据、会话和任职 |
| public invitation view/accept | 先读 view；加载中显示运营管理后台所属品牌骨架；不可用显示终止页 | URL 仅 locator；不把 token 当 authorization | accept 使用 idempotency | 品牌 header 保留并进入 OTP step | expired/cancelled/denied 不能显示任职或创建入口 | 重读 view/completion，不提前赋权 | public protocol + operations-admin affiliation；`workspace-iam` 原子拥有 invitation/account/assignment |
| public OTP/credentials/complete | 继承同一集团空间品牌 header；基于 owner readiness 的 step；敏感字段空白 | 仅局部格式；手机号由 owner 再校验 | 同一动作禁重复 | owner completion 后显示确认，并转该 key 登录页 | typed failure 保留非敏感输入、清密码 | 先 `getPublicInvitationCompletion` 再重放 | public protocol + operations-admin affiliation；不形成后台 session |
| five-target invite action | 当前机构的邀请列表与可选信息加载 | 受邀人机构由当前用户管理页面固定；只可选系统提供的机构和角色 | 单个 command；禁止批量保存 | 服务端确认后刷新当前邀请 Tab | 授权/范围/填写问题以用户可理解提示呈现；不伪装成空列表 | 重读当前机构的邀请列表，再决定重发/取消 | operations-admin；`workspace-iam` 复核授权与范围 |

## 6. 逐操作任务合理性

| 操作 | 批准来源 | 用户为何此时操作 | 更短路径 | 不选替代的理由 | 约束归因 | Dexter 裁决是否必要 |
| --- | --- | --- | --- | --- | --- | --- |
| 选 OTP 登录 | P-N1（拟新增） | 平台管理员需要可选手机号认证 | 仅保留密码 | 与 P-N1 的整改目标冲突；G-05 不是平台授权 | P-N1 + 本 IA 看图 | 是：接受平台 OTP 本身及 tab 形状 |
| 发送/验证 platform OTP | P-N1（拟新增，DEV/UAT 受控展示） | 平台管理员完成本人认证 | 自动读取/展示验证码 | 仅 owner 在非生产配置开启时返回本次代码；生产、前端开关与可推导验证码均不允许 | owner/security | 否 |
| 平台“忘记密码” | Dexter 2026-07-29 对 D04-S10 的产品裁决 | 无法登录但仍持有本人手机号的运维管理员恢复凭据 | 继续让其他管理员手工改密码 | 无法替代用户自助恢复，且管理员重置仍保留为独立账号治理能力 | 产品裁决 + platform-iam owner/security | 已裁决产品能力；contract/owner 细节仍是 GAP |
| 接受公开邀请 | G-07 | 受邀人确认本人加入指定任职 | 管理员直接加任职 | G-07 明确禁止 | 产品已裁定 | 否 |
| 完成后去登录 | G-10 | 用户从公开 flow 回到对应运营空间 | 自动创建已认证会话 | invitation 接受不是 operations 登录 | session/owner 边界 | 否 |
| 发起/重发/取消 target invitation | G-07；R-5 | 管理员管理该 target 人群的入职邀请 | 平台万能 invitation center | R-5 已要求平台面退役，且目标人群/能力不同 | 产品已裁定 + capability contract | 否 |

## 7. Face / owner 对齐矩阵

| 屏幕/动作 | consumer face | 页面准入 | server operation | owner readback / command | 前端不可替代的判定 |
| --- | --- | --- | --- | --- | --- |
| 平台密码登录 | platform-admin | public entry, no session | `platformPasswordLogin` | platform-iam returns PlatformSessionView | 凭据、锁定、会话不能由页面判断 |
| 平台 OTP | platform-admin | public entry, no session | P-N1 的**拟新增** platform OTP contract family（Dexter 接受后、implementation-facing design 才可写 exact operation id） | platform-iam mobile/OTP/session readback | P6 只允许 owner 在 DEV/UAT server configuration 开启时返回 optional debugVerificationCode；生产不返回，client 不推导验证码或认证结论 |
| 平台自助恢复 | public（platform-admin 所属未认证入口） | 登录页“忘记密码”；不进入后台 shell | `GAP-PLATFORM-SELF-SERVICE-RESET`：需 platform-iam 匿名 start/send/verify/complete family | platform-iam 只以 owner-bound flow 回传下一步；成功只返回登录入口 | 登录页、URL 和 client 不能签发/读取 resetGenerationKey、账号匹配或 complete grant |
| 运营登录 / 自助恢复入口 | operations-admin | public route entry, no session | `getOperationsWorkspaceLoginEntry` → `operationsWorkspacePasswordLogin` / existing operations OTP operations；“忘记密码”进入 IA05 anonymous recovery | workspace-IAM 先返回入口展示，再返回 WorkspaceSessionEntry；自助恢复另由 owner recheck | URL 只定位；品牌、集团空间状态、凭据、会话和可用任职均不能由页面推导 |
| 公开邀请 | public（operations-admin 所属未认证入口） | token locator only；不进入后台 shell | `getPublicInvitationView`（含品牌 readback）→ `acceptPublicInvitation`, `sendPublicInvitationOtp`, `verifyPublicInvitationOtp`, `savePublicInvitationCredentials`, `completePublicInvitation` | workspace-iam invitation completion + workspace owner-approved workspaceName/operationsTitle/logoUrl | token/readiness/assignment/品牌 URL 绝不由 UI 推导；公开入口不能借品牌变成后台 session |
| 五类邀请 | operations-admin | page access + action capability UI hint；服务端重判 | `*OperationsWorkspace{Group|Region|Project|HeadCompany|Store}Invitation*` | workspace-iam target-scoped invitation commands | UI hidden/visible 不能替代 capability+scope 校验 |

## 8. Manifest B.4/B.5 命中对照

| manifest 条文 | 命中/不适用理由 | 遵循方式 / 待 Dexter 裁决 | Heritage 原文 |
| --- | --- | --- | --- |
| B.4（state ownership） | 认证、invitation readiness、session 均是 owner state | UI 只保存临时表单和加载态；成功一律消费 owner readback | `doc/heritage/registry.json` 中已选择的 R5 frozen baseline；本稿不新增 heritage runtime 依赖 |

## 9. P6 搜索与候选选择复核（2026-07-29）

`SEARCH_CAPABILITY_DENOMINATOR=2`。它是 P6 全分母中的既有合格项；与 IA02–IA04 的 20 项合计为
22 项，IA05 的五个用户页另在 IA05 §9 按本次复核补入。登录、公开邀请接受、详情、取消/重发与密码/OTP 字段均为凭据输入、只读事实或固定动作，
`NOT_APPLICABLE_WITH_REASON`：G-05/G-07 没有赋予它们查找组织、角色或任职的业务任务，不能借表单存在
而添加搜索。

| screen / 业务对象 / 用户问题 | 条件的用户可见文案 | 匹配语义与控件形态 | 值或候选的唯一来源 | 上游级联、清理与重载 | 请求/提交 owner 核验 | 适合性与排除的替代方案 | contract 缺口或不适用处置 |
| --- | --- | --- | --- | --- | --- | --- |
| `IA01-USER-INVITATION-CREATE-DRAWER` / 可邀请任职机构与业务角色 / 管理者要为某人选择正确任职 | “任职机构”“业务角色” | 任职机构和角色均为按名称/路径或角色名称过滤的 searchable `Select`；角色多选且不是任意文本 | 统一 `CandidateQuery` adapter 按固定 target 和已选机构路由 workspace-IAM task read；业务依据 `R5 D04-S05O`、G-05/G-07 | 先选机构；改选/清空立即取消角色查询、清角色与候选页；按 query/page 重取 | create invitation 以固定 target、机构 ref 和 role id 重验范围/类型/可用性 | 机构名称会重复且任职是 owner 事实，角色会增长且可能同名，故均不能手填或一次性本地过滤 | `GAP-INVITATION-ROLE-CANDIDATE-QUERY`：current readback 无 query/page；owner contract/read、adapter mapping 和 command recheck 未闭合前，角色搜索禁用。机构集合 GAP 仍按 :392–396 处理 |
| `IA01-USER-INVITATION-ACTIONS` / 当前固定 target 内的邀请 / 管理者要定位待处理或已发出的邀请 | “邀请手机号”“任职机构”“业务角色”“状态”“有效期” | 手机号、机构、角色为文本 `Input`；状态固定 `Select`；有效期为 `DateRangePicker` | 各 target 的 `getOperationsWorkspace{Target}Invitations` 已暴露 `mobile/organizationQuery/roleQuery/status/expiresFrom/expiresTo`，workspace-IAM owner；业务依据 D04-S05O、G-07 | 条件互不级联；重置清全部条件与页码；不改变固定 target | list、detail、cancel/reissue 均由 workspace-IAM 以固定 target 和当前范围重验 | 当前任务是在已固定机构类型内找邀请，文本匹配适合手机号/名称，状态是有限词表，日期范围对应有效期；不得添加 target 下拉或把机构文本当 create 候选 | 无；列表搜索不授予跨 target 查询 |
| B.4（async/error/recovery） | 三条 flow 都有 unknown 结果 | 先 readback 再重试；不拼接 errorCode/detail；敏感字段清理 | 同上 |
| B.5（任务顺序与信息层级） | OTP 和 invitation 都是强顺序任务 | 线框明确步骤、exit 和错误恢复 | 同上 |
| B.5（双后台边界） | platform login、public invitation、operations user management 是三个 face | 平台 URL 无 key；邀请/operations URL 带 key 但不授权 | 同上 |

> 最终 implementation-facing 详设必须把这里的条文 key 与
> `contracts/policy/standards-coverage-matrix.json` 当前字节逐条 hash-bound；本预备稿不伪称已完成该 re-freeze。

本稿中任职机构与业务角色的 searchable Select 不得在前端直接各绑一条 invitation candidates endpoint；
必须经 P6 统一 `CandidateQuery` adapter，以 `subjectType=任职机构/业务角色`、固定 target 和已选任职机构
作为 dependencies 路由到 workspace-IAM public task read。角色还必须带 queryText/page/pageSize 与 owner
consistency token；具体 owner endpoint 仅可作为 adapter 后端实现；
它不改变 target-specific capability、候选资格或 command recheck。

## 10. 高保真静态 demo

`NOT_REQUIRED`。两个登录方式、四步 invitation 和 target-specific tab 都可由本低保真线框
裁定；没有为“看起来完整”而编造示例业务数据。

## 11. Dexter 看图结论

- 看图日期：`UNSET`
- 低保真线框结论：`UNSET`
- 高保真 demo：`NOT_REQUIRED`
- 请确认的最小事项：
  1. 平台登录采用“密码 / 手机验证码”显式 tab，而不是 OTP-only 或同屏双表单；
  2. 两个后台均从登录页“忘记密码”进入账号+手机号+验证码自助恢复；运营端继承已品牌化集团空间入口、不得另填集团空间；
  3. invitation acceptance 保持四步 public flow，完成后转该 `groupWorkspaceKey` 登录页、不自动进入 shell；
  4. platform invitation management 退役，邀请管理保留在五个 target-specific operations 用户页。
- 允许作为 implementation-facing design 输入：`是，Dexter 于 2026-07-29 接受`；这不是 implementation authority。

## 12. 接受后的严格设计输入

Dexter 接受后，P6 implementation-facing 详设必须重开当前 source 并冻结：IA 本稿 path+hash+
三个锚点、22 surface/25 page key exact map、P-N1/P-U5/ST-2/ST-6/ST-11 issue set、接受后的
platform OTP operation ids、每个实际 change path、六类 package-exit source denominator、每个新行为的
`testContract`（L2，`redFirst:true`、具名 red assertion、case path、negative cases）。任何缺项
都是 `implementation-design-granularity` 的 fail-closed 输入，不得以本稿代替。
