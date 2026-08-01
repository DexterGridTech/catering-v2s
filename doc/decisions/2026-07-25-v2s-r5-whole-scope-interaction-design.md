---
title: R5 全范围 UI 交互设计与 carry-over-first 线框
status: DEXTER_ACCEPTED_V2_BASELINE
createdAt: 2026-07-25
programId: V2S_W0_W4_EXECUTION
implementationAuthority: false
---

# R5 全范围 UI 交互设计与 carry-over-first 线框

## 1. 工件元数据

```text
JOURNEY_DECISION=doc/decisions/2026-07-25-v2s-r5-whole-scope-journey-decision.md#R5 全范围 Journey 裁决
UI_BEARING=true
SKILL_USED=cs-spec-to-plan@local
DEXTER_WIREFRAME_REVIEW=ACCEPTED_V2_BASELINE_NO_FURTHER_CONFIRMATION
DEXTER_HIFI_REVIEW=NOT_REQUIRED
CONSUMER_FACE=platform-admin|operations-admin|public
IMPLEMENTATION_AUTHORITY=false
```

本工件不重新设计 v2 页面。所有线框采用 all-v2 当前 TSX 与已接受 Interaction Spec 的
静态摹本，实施时默认 `CARRY` 页面任务与信息层级、`ADAPT` v2s contract/术语/owner 边界。
五个 operations 首页在 v2 中只有 route/bootstrap，因此 R5 也只搬运该入口/壳行为，不新增
dashboard、orientation card 或其他 v2 中不存在的页面内容。Dexter 已裁决线框全部以 v2 为准，
无需再设逐页或首页看图确认点。

涉及合同日期、合同三态和其他业务日展示/筛选时，业务日边界依据
`doc/decisions/2026-07-26-v2s-r5-claude-review-five-point-resolution.md#D-07：业务日历时区`
固定为 `Asia/Shanghai`；浏览器、DEV 主机或会话环境的默认时区不得改变页面判断。

## 2. Interaction map

| 顺序 | 前提 | route / 屏幕 | 用户目的 | 可见信息与操作 | owner readback | 成功去向 | 失败恢复 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 既有平台身份 | `/platform/login` | 登录平台后台 | 登录名、密码、提交 | platform-IAM session | 全局平台页 | typed problem；不猜默认身份 |
| 2 | 平台 session | `/platform/workspaces` | 治理空间与初始化集团 | 列表、详情、create/edit/status/init | workspace/asset/organization owner | 留在列表/详情 | Drawer 保留安全草稿；冲突重读 |
| 3 | 选定空间 | platform required pages | 治理组织、IAM、扩展与只读概览 | 8 个 platform pageKey | 对应 owner/task query | Content Tab 内 readback | 切空间清旧数据并重读 |
| 4 | 邀请 URL | `/operations/invitations/{groupWorkspaceKey}/{token}` | 本人完成邀请和账号 readiness | 详情→同意→手机验证→条件补齐→完成 | workspace-IAM invitation | 登录页 | 原子失败，不提前任职 |
| 5 | 运营账号 | `/operations/{groupWorkspaceKey}/login` | 登录并选择运营角色 | 凭据、单/多角色选择 | workspace-IAM session/context | 对应角色首页 | 空间/账号/门店任职 denied 可恢复 |
| 6 | 运营 session | `/operations/{groupWorkspaceKey}/home/*` | 进入 v2 已有角色首页 route/bootstrap | v2 shell、空内容 outlet 与 owner-confirmed navigation | context/navigation readback | 获准业务页 | stale 时清投影重读 |
| 7 | page access | `/operations/{groupWorkspaceKey}/...` | 维护组织、主体、门店、合同、用户/邀请 | v2 对应页面 | owner command/task query | 原页 owner readback | denied/conflict/unknown 分型恢复 |
| 8 | 用户菜单 | 两后台“修改密码” | 修改本人密码 | 当前密码、新密码、确认 | session owner | 成功提示后重新登录 | 失败清密码字段，不泄露细节 |

## 3. v2 对应页面盘点

以下 all-v2 文件均为只读 `path@SHA-256` 静态审看来源；除已登记的 R3 workspace 三文件外，
其余标记 `PENDING_HERITAGE_REGISTRATION`，实施 C0 必须先复制到 frozen registry 后才可作为
搬运输入，不能从 sibling checkout 建 runtime/build fallback。

### 3.1 platform-admin

| screen id | 对应关系 | all-v2 Heritage path@SHA-256 | 静态基线 | R5 差异 |
| --- | --- | --- | --- | --- |
| `PLATFORM-LOGIN` | EXACT_COUNTERPART | `apps/frontend/platform-admin/src/features/authentication/ui/PlatformLoginPage.tsx@83aa1c365ab84df20d37a1256d445b8b0a8775223b0721c19d51878a91aa8a2b` | [§4.1](#PLATFORM-LOGIN) | 接 v2s platform session；不 seed/default root |
| `PLATFORM-WORKSPACES` | PARTIAL_COUNTERPART | `.../WorkspaceManagementPage.tsx@0af9be8c884de227c28b875f4e41626f6a20d932b43e4ab6064289e7cbfe63dc` | [§4.2](#PLATFORM-WORKSPACES) | `groupWorkspaceKey`；幂等 header；R3 init retain |
| `PLATFORM-ADMIN-USERS` | PARTIAL_COUNTERPART | `.../PlatformAdminGovernancePage.tsx@c0a872918f604834f56fa3b45e92b59ef3f6cffb310bb3c29f47c732768188cd` | [§4.3](#PLATFORM-ADMIN-USERS) | 不创建默认/root；增加已裁决独立 principal 治理 |
| `PLATFORM-WORKSPACE-OVERVIEW` | EXACT_COUNTERPART | `.../WorkspaceOverviewPage.tsx@cb1de9be62db383895141c9014f4b363906f967be0d32a3b4c2e596bae1f8d4f` | [§4.4](#PLATFORM-WORKSPACE-OVERVIEW) | task-read 直接 join，不搬投影 |
| `PLATFORM-ORGANIZATION-OVERVIEW` | PARTIAL_COUNTERPART | `.../OrganizationOverviewPage.tsx@72f5ab9beb8f9eb58b1f44effcaaad924d7fcd2dba00e96b93ad21b43c408829` | [§4.4](#PLATFORM-ORGANIZATION-OVERVIEW) | 正确业务词；不叫“诊断” |
| `PLATFORM-CONTRACT-OVERVIEW` | PARTIAL_COUNTERPART | `.../ContractOverviewPage.tsx@932784738052ab15f1733900b6d47e29718e0334b8f3e0a32fac8b76f363dfe0` | [§4.4](#PLATFORM-CONTRACT-OVERVIEW) | 货号二元组与三态只读 |
| `PLATFORM-ROLES` | PARTIAL_COUNTERPART | `.../RoleManagementPage.tsx@45111b3d93310ffdbe7a3700822bf76a3d0630ac3917b21ede091996dea7efe0` | [§4.5](#PLATFORM-ROLES) | 页面准入/动作能力独立；节点类型锁定 |
| `PLATFORM-WORKSPACE-ACCOUNTS` | PARTIAL_COUNTERPART | `.../WorkspaceAccountManagementPage.tsx@f91df607180aebc2354e7e811c9abcb316121f24bc121b711314280cb207011e` | [§4.6](#PLATFORM-WORKSPACE-ACCOUNTS) | 平台可撤销任职；新增仍只经邀请 |
| `PLATFORM-EXTENSION-FIELDS` | PARTIAL_COUNTERPART | `.../ExtensionFieldManagementPage.tsx@4d23ecd15dcfe641c38c3292076c1ebb452f309fb36a4e1d59c9729ee554cc4e` | [§4.7](#PLATFORM-EXTENSION-FIELDS) | definition/value 宿主均收窄五类 |
| `PLATFORM-PASSWORD` | EXACT_COUNTERPART | `.../PlatformPasswordChangeDrawer.tsx@7f628b6e14e5b4965d59db9282b6e3aa78a85cf851b823e2f182f381c143dc57` | [§4.8](#PLATFORM-PASSWORD) | owner 成功后其他 session 失效 |

### 3.2 operations-admin 与 public

| screen id | 对应关系 | all-v2 Heritage path@SHA-256 | 静态基线 | R5 差异 |
| --- | --- | --- | --- | --- |
| `OPERATIONS-LOGIN` | PARTIAL_COUNTERPART | `.../WorkspaceLoginPage.tsx@d04db79096a1f474aac00b0de3f67e07a9848dd38c388a06b2a2f3daf28a3f0f` | [§4.9](#OPERATIONS-LOGIN) | URL 必须携带 `groupWorkspaceKey` |
| `INVITATION-ACCEPTANCE` | PARTIAL_COUNTERPART | `.../InvitationAcceptancePage.tsx@0a9973f2c8f4f94cf76f5c82b61fc2987e13205e364ca0e30f97d74016c5cafd` | [§4.9](#INVITATION-ACCEPTANCE) | 邀请/账号/任职同一 owner 原子边界 |
| `ACCESS-RECOVERY` | EXACT_COUNTERPART | `.../AccessRecoveryPage.tsx@2c7d8ecde8aeb446734a2606e563260a58195a01b4a05731b99236361d1e6bd6` | [§4.9](#ACCESS-RECOVERY) | 无管理员代设密码 |
| `OPERATIONS-SHELL` | PARTIAL_COUNTERPART | `.../OperationsContextShell.tsx@ac41148c6a40d0abde90611e6c06a718738634dd5f9dcdab170b1667dc257be6` | [§4.10](#OPERATIONS-SHELL) | 新词；路径统一带 key；版本进入 cache/tag |
| `ORG-STRUCTURE` | PARTIAL_COUNTERPART | `.../OrganizationHierarchyPage.tsx@116c878d01954e1642df7a6c2b5b7fc4524cefd0da7aa01e3b83c942e96d2626` | [§4.11](#ORG-STRUCTURE) | 固定三层；项目分期为属性 |
| `BRAND/TENANT/HEAD-COMPANY` | PARTIAL_COUNTERPART | `.../BusinessEntityManagementPage.tsx@ce3ff54d22af79f5e973c42cfa8040199b1feb4d11f0dae03464fc417340276f` | [§4.11](#BRAND/TENANT/HEAD-COMPANY) | 三个独立 pageKey；禁止“商户”混称 |
| `STORE-MANAGEMENT` | PARTIAL_COUNTERPART | `.../StoreManagementPage.tsx@4a4d270aefd097cd6f842327439c56180af396c63c642300997fb553e5d292a5` | [§4.11](#STORE-MANAGEMENT) | 锁定三关系；三态只读不替代启停 |
| `CONTRACT-MANAGEMENT` | PARTIAL_COUNTERPART | `.../ContractManagementPage.tsx@7bd2bd086555904ba4a33c9350a7af8fb28a220f2bff5b1e54efacffc5a6c3e3` | [§4.11](#CONTRACT-MANAGEMENT) | 货号 `{code,name}` 表格 |
| `FIVE-USER-PAGES` | PARTIAL_COUNTERPART | `.../UserManagementPage.tsx@c811961086741b0da5a53f8a38dcc4ef7d7df9a3589be466bb95ea58e7f44265` | [§4.12](#FIVE-USER-PAGES) | 新增仅邀请；撤销直接；五 pageKey 不合并 |
| `STORE-PROFILE` | PARTIAL_COUNTERPART | `.../StoreProfilePage.tsx@24511b42b2f589c6034a16ae12abacd4e41c2cea7915cf949fd63e5673c1e3c9` | [§4.11](#STORE-PROFILE) | 基础资料与合同只读；展示三态 |
| `OPERATIONS-PASSWORD` | EXACT_COUNTERPART | `.../OperationsPasswordChangeDrawer.tsx@eeaf97cdbe180f5855ac68932c62e22caa8615cdb51861db797faa0243fa0432` | [§4.8](#OPERATIONS-PASSWORD) | owner 成功后其他 session 失效 |
| `HOME-GROUP/REGION/PROJECT/HEAD-COMPANY/STORE` | EXACT_BOOTSTRAP_COUNTERPART | `OperationsAdminSeed.tsx` 的 router/home bootstrap；检索 router/home + feature tree | [§4.13](#HOME-GROUP/REGION/PROJECT/HEAD-COMPANY/STORE) | 搬运 v2 入口/壳；不新增页面内容、dashboard、指标或 command |

## 4. 低保真线框

以下摹本的整体 shell/list/detail/drawer 结构来自 all-v2
`doc/specs/platform/2026-07-23-dual-admin-experience-remediation-interaction-spec.md@4d8f282e...`；
业务差异以 R5 Journey/corpus 为准。

<a id="PLATFORM-LOGIN"></a>

### Screen: PLATFORM-LOGIN

```text
┌────────────────────────────────────────────┐
│              平台管理后台                  │
│  登录账号 [________________________]        │
│  登录密码 [________________________]        │
│                         [ 登录 ]            │
│  typed feedback / correlation id（按需）   │
└────────────────────────────────────────────┘
```

<a id="PLATFORM-WORKSPACES"></a>

### Screen: PLATFORM-WORKSPACES

```text
[集团空间管理]                                      [新建集团空间]
┌ 搜索：名称 | 编码 | 运营后台标题 | 状态 ─────────────────────┐
│ Logo | 集团空间名称(详情) | 编码 | 商业集团 | 状态 | 更新时间 │
└──────────────────────────────────────────────────────────────┘
详情 Drawer：[编辑] [初始化商业集团(未初始化时)] [启用/停用]
```

<a id="PLATFORM-ADMIN-USERS"></a>

### Screen: PLATFORM-ADMIN-USERS

```text
[运维管理员管理]                                    [新建管理员]
┌ 搜索：姓名 | 登录账号 | 状态 ───────────────────────────────┐
│ 姓名(详情) | 登录账号 | 状态 | 最近登录 | 更新时间           │
└──────────────────────────────────────────────────────────────┘
详情 Drawer：[编辑] [启用/停用] [发起凭据恢复] [查看审计摘要]
```

<a id="PLATFORM-WORKSPACE-OVERVIEW"></a>
<a id="PLATFORM-ORGANIZATION-OVERVIEW"></a>
<a id="PLATFORM-CONTRACT-OVERVIEW"></a>

### Screen: PLATFORM-OVERVIEWS

```text
[当前按域概览标题]
┌ 搜索条件（按 owner task-read 定义）                         ┐
├─────────────────────────────────────────────────────────────┤
│ ProTable / 全量组织树 + 右侧详情                            │
│ 名称或编号链接打开 bordered 详情 Drawer                     │
└─────────────────────────────────────────────────────────────┘
只读；无状态命令；不出现“诊断”或跨域万能编辑。
```

<a id="PLATFORM-ROLES"></a>

### Screen: PLATFORM-ROLES

```text
[业务角色]                                              [新建角色]
┌ 角色名称(详情) | 节点类型 | 状态 | 页面摘要 | 动作摘要       ┐
└─────────────────────────────────────────────────────────────┘
详情 Drawer：[编辑角色] [配置页面准入] [配置可执行动作] [停用]
页面准入树与动作能力树分别选择、分别校验；点击一次“保存授权”后，以同一命令的
`pageAccessKeys`/`actionCapabilityKeys` 两个独立字段原子提交，不产生中间态。
```

<a id="PLATFORM-WORKSPACE-ACCOUNTS"></a>

### Screen: PLATFORM-WORKSPACE-ACCOUNTS

```text
[空间账号]
┌ 账号 Tab ─────────────────┬ 邀请 Tab ───────────────────────┐
│ 账号/状态/任职结果         │ 手机号/服务节点/角色/状态/链接 │
│ 详情：启停/恢复/撤销任职   │ [发出邀请] 详情/取消/重发/复制 │
└────────────────────────────┴────────────────────────────────┘
```

<a id="PLATFORM-EXTENSION-FIELDS"></a>

### Screen: PLATFORM-EXTENSION-FIELDS

```text
┌ 五类值宿主 ─────────┬ 当前 definitions 详情           [编辑] ┐
│ 品牌                │ 字段名 | 类型 | 必填 | 顺序            │
│ 经营租户            │ revision / 更新时间                    │
│ 总公司              │ 未配置时显示空态                       │
│ 门店 / 合同         │                                        │
└─────────────────────┴────────────────────────────────────────┘
```

<a id="PLATFORM-PASSWORD"></a>
<a id="OPERATIONS-PASSWORD"></a>

### Screen: PASSWORD-DRAWER

```text
× 修改密码
当前密码 [________________]
新密码   [________________]
确认密码 [________________]
[取消]                                         [确认修改]
成功：关闭 Drawer → 明确提示 → 重新登录；失败：清空密码字段。
```

<a id="OPERATIONS-LOGIN"></a>
<a id="INVITATION-ACCEPTANCE"></a>
<a id="ACCESS-RECOVERY"></a>

### Screen: OPERATIONS PUBLIC FLOW

```text
登录：集团空间标识(来自 URL，只读) + 登录名/手机号 + 凭据
邀请：邀请详情 → [同意] → 手机号验证码 → 条件补齐姓名/登录名/密码 → 完成
恢复：手机号验证 → 新密码 → 完成
```

<a id="OPERATIONS-SHELL"></a>

### Screen: OPERATIONS-SHELL

```text
┌ 运营管理后台 ────── [当前运营角色：名称（服务节点） v] [用户 v] ┐
│ owner-confirmed navigation                                      │
├ [角色首页 ×][业务页 ×]                         [刷新][全屏]     ┤
│ 当前页面                                                         │
├──────────────────────────────────────────────────────────────────┤
│ 可视数据节点：大区 > 项目 > 门店（仅当前页需要时出现）           │
└──────────────────────────────────────────────────────────────────┘
```

<a id="ORG-STRUCTURE"></a>
<a id="BRAND/TENANT/HEAD-COMPANY"></a>
<a id="STORE-MANAGEMENT"></a>
<a id="CONTRACT-MANAGEMENT"></a>
<a id="STORE-PROFILE"></a>

### Screen: OPERATIONS BUSINESS PAGES

```text
[独立业务页标题]                                        [新建(如获准)]
┌ ProTable search / 左树右详情（组织页）                           ┐
│ 业务名称(详情链接) | 业务专属列 | 状态 | 更新时间                │
└──────────────────────────────────────────────────────────────────┘
详情 Drawer：bordered readback；右上 edit/status 动作按 capability 显示。
```

<a id="FIVE-USER-PAGES"></a>

### Screen: FIVE USER MANAGEMENT PAGES

```text
[集团/大区/项目/总公司/门店 用户管理]
┌ 用户 Tab ─────────────────┬ 邀请 Tab ───────────────────────────┐
│ 用户 + 一个或多个任职      │ 手机号 + 固定节点类型内具体节点 + 角色 │
│ 详情：[撤销任职]           │ [邀请] [复制链接] [取消] [重发]      │
└────────────────────────────┴────────────────────────────────────┘
```

<a id="HOME-GROUP/REGION/PROJECT/HEAD-COMPANY/STORE"></a>

### Screen: FIVE ROLE HOMES（v2 bootstrap 基线）

```text
OperationsContextShell
└── owner-confirmed navigation / opened content tabs
    └── /operations/:groupWorkspaceKey/home/{group|region|project|head-company|store}
        └── v2 bootstrap content outlet（无新增业务卡片）
```

五类首页只保留 v2 已有 route/bootstrap 与 shell 行为；角色、服务节点和可视数据节点仍由
v2 shell 对应区域呈现。R5 不新增首页组件、指标、待办、最近操作、业务汇总或后端 operation。
全部 authenticated operations browser route 都携带 `groupWorkspaceKey`，但 URL 只定位上下文，
每个 task endpoint 仍重新授权。邀请新增任职的门店候选排除停用门店；合同候选显示门店启停
状态但不因停用而过滤或阻断。

## 5. 状态与边界表

| 屏幕/动作 | initial/loading | validation | submitting | success | conflict/denied | timeout/unknown | owner/face 边界 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| login/session | 不猜默认空间/身份 | 本地只验格式 | 单次 submit | owner session 后导航 | typed reason | 保留输入，可重试 | platform-IAM/workspace-IAM |
| list/detail | skeleton，不用旧数据冒充 | query args 闭集 | N/A | owner readback | denied 不显示空列表 | retry 同一 query | task query owner |
| create/edit Drawer | owner candidates/readback | safe local validation | dirty guard + idempotency | 关闭后 readback | CAS/stale 保留安全草稿 | 先查状态再决定 | command owner |
| invitation | 先读 invitation | 手机号/OTP/readiness | owner 原子 command | COMPLETED + assignments | 任一角色冲突整次拒绝 | 不提前赋权 | workspace-IAM |
| context switch | owner-confirmed choices | 不自由输入范围 | switch command/query | version 更新、清投影重读 | disabled node/role denied | 回到最近 confirmed context | workspace-IAM |
| status action | 详情右上确认 | 只允许状态闭集 | idempotent command | owner state/version | conflict 重新读详情 | unknown 先查询 | 对应 owner |
| password | 空密码字段 | 新旧/确认校验 | 单次 command | 其他 session revoked | typed failure 清密码 | 不重复提交 | session owner |
| role home | context loading | N/A | N/A | v2 bootstrap outlet | 无页面保持 v2 空内容状态 | context retry | 只消费 session/navigation |

## 6. 逐操作任务合理性

| 操作 | Journey 来源 | 用户为何此时操作 | 更短路径 | 不选替代原因 | 约束归因 | 需再裁决 |
| --- | --- | --- | --- | --- | --- | --- |
| list→名称详情→右上动作 | 32 项对应 scenario | 先读 owner fact 再改变 | 列表操作列 | 缺上下文且易误操作 | Heritage owning UI standard | 否 |
| 邀请新增任职 | D04-S05P/O、S06 | 任职必须本人接受 | 管理员直接添加 | 违反 G-07 | 产品语义 | 否 |
| 当前角色/数据节点切换 | D04-S09 | 用户明确切换工作视角 | 页面内重复选择 | 多处真相、增加错误 | owner/context 边界 | 否 |
| 五类首页 bootstrap | D04-S08/S09 | 登录/切角色后进入 v2 已有角色 route | 保持 v2 bootstrap | 这是已实现范围的真实边界 | Dexter 裁决全部线框以 v2 为准 | 否 |
| 首页 dashboard/指标 | 无 | 不成立 | N/A | 超出 v2 已实现范围 | 产品范围 | 不做 |
| 扩展字段值嵌入实体页 | D01-S07O | 用户编辑实体时一并维护 | 独立扩展值页面 | 暴露技术机制且增加切换 | owner/product | 否 |
| 合同三态只读展示 | D03-S04、D-04 | 用户理解经营关系 | 状态 command | 三态不驱动事实 | G-09 | 否 |

## 7. Face / owner 对齐矩阵

| 屏幕/动作 | consumer face | 页面准入 | server operation owner | 不可由前端替代 |
| --- | --- | --- | --- | --- |
| 平台登录/管理员治理 | platform-admin | platform principal | platform-IAM | 身份、session、状态 |
| 空间/Logo/商业集团 | platform-admin | global/selected workspace | platform-workspace/platform-asset/organization | 绑定、唯一集团、状态 |
| 平台概览 | platform-admin | selected workspace | 对应 task-query owner | 数据范围与降级 |
| 角色/账号/邀请 | platform-admin | selected workspace | workspace-IAM | page/capability/assignment |
| public invitation/recovery | public | token/OTP | workspace-IAM | token、readiness、原子生效 |
| operations login/shell/home | operations-admin | session + role | workspace-IAM | context/navigation/version |
| 组织/主体/门店 | operations-admin | page + capability + node | organization | invariant/brand authorization |
| 合同 | operations-admin/platform-admin read | page/capability | contract | CAS、状态、三态 |
| 扩展值 | operations-admin | 原实体权限 | 实体 owner + extension definition read | 未知值保留与 revision |

## 8. Manifest B.4/B.5 命中对照

| manifest 条文 | 命中 | 遵循方式 | Heritage 原文 |
| --- | --- | --- | --- |
| B.4 前端架构与状态 | 双 app、独立 shell/store/baseApi/generated；context/revision 入 query/cache/tag | C0/C1 先消费 foundation，app 只拥有业务策略 | `doc/heritage/frozen/catering-all-v2/project-memory/decisions/admin-frontend-implementation-standard.md@12afa79f...` |
| B.4 页面 catalog/route owner | page definition、navigation、app loader 分权 | generated catalog + app registry；home 无静态 allowlist | `.../admin-page-catalog-navigation-and-access-owner-boundary.md@26041803...` |
| B.4 overlay/list/http/log | Drawer lifecycle、overlay lock、list context、HTTP、observability | 必须 import `libraries/frontend/admin-ui-foundation`，禁止 app 重造 | 当前 v2s foundation + frozen standard |
| B.5 列表/详情/动作三定律 | 名称进详情，详情右上动作，列表无操作列 | 所有管理页采用同一任务结构 | `.../business-entity-list-detail-action-standard.md@3d036edb...` |
| B.5 AntD/ProComponents | ProTable/Descriptions/Drawer/Modal 选择 | 优先成熟组合，不用 disabled form 冒充详情 | `.../admin-ui-interaction-and-ant-design-usage-standard.md@25e3ec01...` |
| B.5 双后台 chrome | 平台/运营 shell 独立 | 分别拥有 theme/router/store/context | `.../admin-consumer-chrome-rules.md@98bb944a...` |

## 9. 高保真 demo

`NOT_REQUIRED`。全部页面与五类首页 route/bootstrap 均以 all-v2 静态基线为准，不创建
一次性高保真页面或 v2 未实现的新首页内容。

## 10. Dexter 线框裁决

- 裁决日期：`2026-07-25`
- 低保真线框结论：`ACCEPTED_V2_BASELINE_NO_FURTHER_CONFIRMATION`
- 高保真 demo 结论：`NOT_REQUIRED`
- 裁决原文：`线框全部以v2为准，不需要我再确认了`
- 适用方式：所有页面从 v2 静态基线 `CARRY/ADAPT`；五类首页只搬运 v2 route/bootstrap，
  不补造新页面内容。
- 允许进入 implementation-facing design：`是`
