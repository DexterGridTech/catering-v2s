---
title: RM1 IA-02 运营上下文与平台集团空间交互详设
status: DEXTER_ACCEPTED_FOR_IMPLEMENTATION_FACING_REFREEZE
createdAt: 2026-07-29
programContext: V2S_RM1_REMEDIATION
decisionOwner: Dexter
implementationAuthority: false
---

# RM1 IA-02：运营上下文与平台集团空间交互详设

```text
JOURNEY_DECISION=doc/plans/platform/2026-07-28-v2s-rm1-restructure-and-remediation-implementation-design-and-plan.md#rm1-p6ui-carry-overotp-work-context
UI_BEARING=true
SKILL_USED=NONE
DEXTER_WIREFRAME_REVIEW=ACCEPTED_2026-07-29
DEXTER_HIFI_REVIEW=NOT_REQUIRED
CONSUMER_FACE=operations-admin + platform-admin
IMPLEMENTATION_AUTHORITY=false
```

## 1. 原始业务问题、范围与非目标

本稿解决的是用户在两个不同后台中的两个不同上下文问题，而不是“做一个通用切换器”。
P-U2 要求六个 `workspaceRequirement=REQUIRED` 的 platform 页面共享选中集团空间；P-U3 要求
写能力在 `PLATFORM-WORKSPACES`，而已选择空间后的 `PLATFORM-WORKSPACE-OVERVIEW` 仅做总览；
P-U4 要求运营端的“我是谁”（任职）和“我在哪”（可见数据节点）分开，且切任职不整页接管。
Owning source 是 `doc/review/platform/2026-07-28-v2s-r6-problem-inventory-claude.md` §9/§11 和
`doc/plans/platform/2026-07-28-v2s-rm1-restructure-and-remediation-implementation-design-and-plan.md#rm1-p6ui-carry-overotp-work-context`。

原始业务依据：

- G-05：一个运营账号可有多个任职，右上切换改变页面和权限；可视数据节点另选，只限制功能页
  数据范围；数据可见、页面准入、写权限互不推出；
- G-10：operations URL 的 `groupWorkspaceKey` 只定位集团空间，不构成授权；platform URL 不带该 key，
  所选空间是端内会话上下文；
- R-7：`PLATFORM-WORKSPACES` 是“管理全部集团空间”的页，`PLATFORM-WORKSPACE-OVERVIEW` 是
  “选中一个集团空间后的数据总览”，两者是两页；
- R-12：右上角常驻任职切换器不整页接管，数据范围是独立切换器；
- R-13：后端只返回授权事实 `dataNodeCandidates`；前端 catalog 持 `requiredDataNodeType` 并按深度裁剪。

当前 bytes 已经拥有 `getOperationsWorkspaceSessionEntry`、`selectOperationsWorkspaceSessionContext`、
`selectOperationsWorkspaceSessionDataNode` 和 `operationsWorkspaceLogout`；`WorkspaceSessionEntry`
已经 owner-readback `candidates`、`selected`、`dataNodeCandidates`、`selectedDataNode`、
`contextVersion` 和 `selected.navigation[].requiredDataNodeType`。因此本 P6 **不**新增候选接口、
不从 hierarchy 或 assignment 推导候选、也不把 `requiredDataNodeType` 当作新 contract 工作。

**本稿的强制 UI 标准已适用**：每个面均在其线框前声明后台、界面形态、用户角色、业务场景、
业务目的和用户可见词。用户界面中不出现“节点”、`pageDesignKey`、`dataNodeRef`、session、
capability 或 owner；技术名仅用于本稿的 contract/owner 矩阵。技术接口中的角色归属字段在用户界面统一为
“任职机构”，可视数据节点统一为“可查看范围”或“可查看机构”。

## 2. 交互地图

| 顺序 | 前提 | route / 屏幕 | 用户目的 | 可见信息与可操作项 | server/owner readback | 成功去向 | 失败/退出恢复 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 运营管理后台登录后，有多个可用任职但尚未选择 | shell 内 `IA02-OPERATIONS-CONTEXT-SWITCHER` | 选择本次任职进入业务功能页 | 可用任职的业务角色名+任职机构；不能自由输入 | `selectOperationsWorkspaceSessionContext` 返回完整 entry | 维持 shell，按新 entry 的第一可访问页导航 | 保留最后确认的任职；不确定时先重读 entry |
| 2 | 已有选定任职，当前功能页需要选择可查看范围 | shell 左侧菜单底部的 `IA02-OPERATIONS-DATA-SCOPE-SIDER-TRIGGER` 打开 `IA02-OPERATIONS-DATA-SCOPE` | 选择该任职允许查看的机构范围 | 系统提供的可选机构、当前已选范围；独立 Popover | `selectOperationsWorkspaceSessionDataNode` 返回完整 entry | 保持任职；只刷新当前范围相关的读取 | 被拒绝/冲突不修改本地上下文；不确定时重读 entry |
| 3 | platform authenticated | `IA02-PLATFORM-WORKSPACE-CONTEXT` | 在六个 REQUIRED 页面使用同一个已选集团空间 | 未选择时只显示业务提示；所需菜单禁用，不能发起缺少集团空间的读取 | platform workspace selection source and page task reads | 在全局选择器确认空间后，进入所选功能页并以其 key 查询 | 未选择不发 task query；access/stale 清 selection 后保持在安全空态 |
| 4 | platform authenticated | `IA02-PLATFORM-WORKSPACES-ACTIONS` → `DETAIL-DRAWER` | 管理一个集团空间的资料、状态或商业集团初始化 | 管理列表仅由名称链接进入详情；详情抽屉再展示创建、编辑、启停、初始化的上下文动作 | `createPlatformGroupWorkspace`、`updatePlatformGroupWorkspaceDisplay`、`transitionPlatformGroupWorkspaceStatus` 与初始化 owner readback | owner readback 更新列表和已选上下文的同 key 缓存 | conflict 重读详情；unknown 先按 key readback |
| 5 | 已选择 workspace | `IA02-PLATFORM-WORKSPACE-OVERVIEW` | 阅读该空间的汇总事实 | 空间概览、初始化情况、账号访问；仅刷新或对暂不可得资料重试 | corresponding task read | 留在总览 | selection missing 显示无动作提示；读取失败保留重试 |

## 3. v2 对应页面盘点

| screen id | 对应关系 | all-v2 Heritage path@SHA-256 | 静态基线 / 摹本标注 | 差异及原因 |
| --- | --- | --- | --- | --- |
| IA02-OPERATIONS-CONTEXT-SWITCHER | PARTIAL_COUNTERPART | `OperationsContextShell.tsx@ac41148c6a40d0abde90611e6c06a718738634dd5f9dcdab170b1667dc257be6` | `DEXTER_WAIVED_2026-07-29；等价证据：R5 #OPERATIONS-SHELL + 本稿 §3.1` | 保留 shell 内右上任职、独立可视节点；v2s 必须从当前整页 `RoleAssignmentSelector` 收敛为一个直接切换的顶部下拉框，不再打开角色 Drawer。 |
| IA02-PLATFORM-WORKSPACE-CONTEXT | EXACT_COUNTERPART | `WorkspaceOverviewPage.tsx@cb1de9be62db383895141c9014f4b363906f967be0d32a3b4c2e596bae1f8d4f`；`workspace-overview.spec.ts@40339201d050e3f35793f00f6682b9a59e20387734b9f0bdb90a2f1887f435d6` | `DEXTER_WAIVED_2026-07-29；等价证据：Claude IA review §1.2 + R5 #PLATFORM-WORKSPACE-OVERVIEW` | 未选择时是无操作的 Result；v2 菜单 guard 禁止进入需选空间的页面，不得擅加跳转按钮。 |
| IA02-PLATFORM-WORKSPACES-ACTIONS | EXACT_COUNTERPART | `WorkspaceManagementPage.tsx@0af9be8c884de227c28b875f4e41626f6a20d932b43e4ab6064289e7cbfe63dc`；`workspace-management.spec.ts@8d90a5feb0686c91b6409d23753b7c8fce43eabf3a7f49f8aad336dc07f098a3` | `DEXTER_WAIVED_2026-07-29；等价证据：Claude IA review §1.2 + R5 #PLATFORM-WORKSPACES` | 表格不设操作列；名称链接是唯一行入口，打开详情抽屉。 |
| IA02-PLATFORM-WORKSPACE-DETAIL-DRAWER | EXACT_COUNTERPART | `WorkspaceDetailDrawer.tsx@f573ca9c02e3fc80cd35ee5e6e9b43933fa7579d87a79ac3c2a09a683e24852a` | `DEXTER_WAIVED_2026-07-29；等价证据：Claude IA review §1.2 + R5 #PLATFORM-WORKSPACES` | 上下文动作只在详情抽屉右上；先关闭详情，再开编辑抽屉、状态确认或初始化抽屉。 |
| IA02-PLATFORM-WORKSPACE-CREATE-DRAWER / EDIT-DRAWER | EXACT_COUNTERPART | `WorkspaceFormDrawer.tsx@445800766f658d74954d608f0f213748a20fbff039b2b36927b6796d5db9204f` | `DEXTER_WAIVED_2026-07-29；等价证据：Claude IA review §1.2 + R5 #PLATFORM-WORKSPACES` | 新建在页头；编辑只能从详情抽屉进入；两者复用同一 DrawerForm，编辑时编码只读。 |
| IA02-PLATFORM-COMMERCIAL-GROUP-INIT-DRAWER | EXACT_COUNTERPART | `CommercialGroupInitializationDrawer.tsx@3b40a5fdfe5cdcfa90bbc7f80944485acd9e47772893e77bf2d39ec32da85c6c` | `DEXTER_WAIVED_2026-07-29；等价证据：Claude IA review §1.2 + R5 #PLATFORM-WORKSPACES` | 仅未初始化的详情提供入口；该既有业务流程被完整保留，P6 不扩展其业务范围。 |
| IA02-PLATFORM-WORKSPACE-OVERVIEW | EXACT_COUNTERPART | `WorkspaceOverviewPage.tsx@cb1de9be62db383895141c9014f4b363906f967be0d32a3b4c2e596bae1f8d4f` | `DEXTER_WAIVED_2026-07-29；等价证据：Claude IA review §1.2 + R5 #PLATFORM-WORKSPACE-OVERVIEW` | 仅在已选择空间后读；页面仅保留“刷新/重试”，不承接 edit/status 或跳回管理页。 |
| IA02-PLATFORM-WORKSPACE-SELECTOR | `DEXTER_DECIDED_SIDER_2026-07-29` | `admin-consumer-chrome-standard.md@557fc9922155f9901deef8cf76a11a126a9454e25acdba445c25f086d4fe9249` + element ledger `@b7fa2c922725793801ae7f424280a261afb2055f45b405428d3a17da6ac7c2b7`（Header，已拒绝）；`PlatformShell.tsx@1d9bbb9ad16d5d7063ca4469ad8de0509a0c896c4397bc72458fb87814c9f268`、`PlatformWorkspaceSelector.tsx@00ceb58c6e937bd69940a59b4712a5a9a68bc72d950673df9d73aadf2bdc6af5`（侧栏底部，已接受） | `DEXTER_DECIDED_2026-07-29；等价证据：本稿 #platform-workspace-selector-decision` | Dexter 裁决采用左侧菜单底部；Header 仅保留为来源冲突记录，不是 screen、线框或 implementation input。 |

所有 Heritage 引用均延续 R5 的 `PENDING_HERITAGE_REGISTRATION` 静态审阅边界，绝不形成
runtime/build fallback。接受后的详设必须重新核验 frozen registry 与 hash。

### 3.1 v1 真实交互基线复核（仅继承交互形状）

Dexter 要求对照的 v1 运营后台真实源码已只读重开：

| v1 原始 source@SHA-256 | 已核实的真实做法 | v2s 采用 / 明确不采用 |
| --- | --- | --- |
| `catering-all-v1/packages/admin-ui-foundation/src/shell/MembershipSwitcher.tsx@bd400f54c3c79e10320e2162854fefb7b484edc2be7a1ee1e4f69d187962184f` | `Select` 直接放进 shell header；多项任职时选择一个 option 立即调用 `switchWorkContext`，没有 Drawer、确认页或第二次提交。单项任职只显示当前任职。 | 采用“顶部 `Select` + 单次选择立即切换 + 切换中禁用”的轻量形状。v1 的 `REGION · 华东大区` 等类型码不是面向用户的文案，v2s 改为“业务角色 · 任职机构”。 |
| `catering-all-v1/apps/frontend/operations-admin/src/shell/OperationsShell.tsx@f60e206b1e2ebb5c23a46a2b4e93063ecd19ea5004439a905d1e065b48852f38` | `ProLayout.actionsRender` 承载该选择器；服务端返回新身份后，shell 重置旧 tabs，并导航到新身份首个可访问页。数据范围是另一个独立控件。 | 采用 header 容器、菜单/页签清理和“新任职首个可访问页”的结果；不复制 v1 的 legacy membership/session 状态模型。 |
| `catering-all-v1/apps/frontend/operations-admin/src/tests/l2/operations-admin-shell.spec.ts@4e2a871a555c9a630854f3d522dcf8346009ee6437b1d190c7f4b4e6721cfbbd` | L2 选择 `REGION · 华东大区` 后，断言只产生一次 owner switch、导航到该身份首页、旧菜单和旧 tab 消失，shell 保持挂载。 | P6 详设必须为同一结果留出 focused evidence；不把测试中出现的技术类型码带入 UI。 |

因此，`IA02-OPERATIONS-SHELL-HEADER` 的“顶部下拉直接切换”既是 Dexter 已接受的用户路径，也与
v1 真实、已验收的操作形状一致；本稿仍以 v2s owner entry 为唯一授权事实，不能把 v1 当 runtime/build
fallback。

<a id="v1v4-data-scope-display-baseline"></a>

### 3.2 v1/v4 数据范围展示基线复核（仅继承交互形状）

本次重开两套运营后台的真实源码后，结论一致：**数据范围入口属于 shell 左侧菜单底部，不属于 Header；
不应使用 Drawer。** v1 直接在该位置展示逐级选择器，v4 则用一枚摘要按钮打开右下 Popover；v2s 采用
v4 的“摘要入口 + Popover”信息密度，并采用 v1 已证明的逐级联动语义，但仍只使用 v2s owner entry，
不继承旧系统的浏览器持久化或本地授权状态。

| 原始 source@SHA-256 | 已核实的真实做法 | v2s 采用 / 明确不采用 |
| --- | --- | --- |
| `catering-all-v1/apps/frontend/operations-admin/src/shell/OperationsShell.tsx@f60e206b1e2ebb5c23a46a2b4e93063ecd19ea5004439a905d1e065b48852f38`；`catering-all-v1/packages/admin-ui-foundation/src/shell/AdminShellPorts.tsx@48518a78f60a72d2b9bffd83cdc785bf93ad8059e964d6775e447dcce0052ea9` | `menuFooterRender` 将“当前工作范围”放入左侧菜单底部；按大区/项目/门店逐级 `Select`，上级变化清空下级，选择即回调。 | 采用侧栏底部位置与上游变更清理下游；不采用 storage 持久化、旧 policy 类型码或本地范围权威。 |
| `catering-server-v4/frontend/apps/catering-operations-admin/src/app.tsx@dbe4731644db0143e484f93a187d6a2c97d3361e37ca0681937ae1aec1d35b63` | `menuFooterRender` 放入 `OperationsGlobalWorkScope`；“当前工作范围”摘要按钮以 `Popover placement=rightBottom` 打开项目/门店搜索选择器，先选项目后选门店；完整选择即关闭，未保存业务内容时才弹确认。 | 采用“侧栏底部摘要控件 → right-bottom Popover”、搜索选择器和完整选择即提交/关闭；不采用 v4 Redux/storage 范围状态、其项目/门店限定模型或任何本地权限推导。 |
| `contracts/openapi/components/workspace-iam/workspace-session.schemas.yaml` current bytes；`WorkspaceSessionWireMapper.java` current bytes | v2s entry 的每个候选已有 `ancestorPath`、`regionRef`、`projectRef`、`storeRef`，选择命令只接受最终 owner 返回的候选及当前版本。 | 可按 owner 返回引用做大区→项目→门店联动与选项裁剪；最终只提交叶级/页面要求层级的候选 ref/type，owner 重新核验。 |

## 4. 低保真线框

<a id="IA02-OPERATIONS-SHELL-HEADER"></a>

### Screen: IA02-OPERATIONS-SHELL-HEADER

```text
CONSUMER_FACE=operations-admin（运营管理后台）
UI_SURFACE=Header 控件
HOST_AND_ENTRY=运营管理后台已登录 shell 的顶部；用户已完成首次任职选择后可见
ACTOR=拥有多个有效任职的商场运营方或店铺运营方用户
BUSINESS_SCENARIO=用户已进入运营管理后台，需要切换本次承担的职责
BUSINESS_GOAL=在不离开当前后台的情况下切换到另一项获准任职，并进入该任职可使用的首个功能页
USER_VISIBLE_COPY=“当前任职”；顶部下拉的每项显示“业务角色 · 任职机构”；切换失败提示“暂时无法切换任职，请重试”
TECHNICAL_BOUNDARY=page access、session entry、role assignment、scope 只由服务端核验
FOUNDATION_PRIMITIVE=useSubmissionLifecycle, testId
```

```text
Header：[当前任职：角色名 · 任职机构 v]

```

**Dexter 已接受的交互**：多任职首次进入仍使用独立选择页；一旦已有 confirmed shell，右上角只有
“当前任职”下拉框。用户选择另一项后立即调用 owner 切换，不弹 Drawer、不展示确认页、不再点击
“确认切换”。成功后以服务端返回的新获准功能菜单重建菜单并导航到第一可访问页；不保留当前页来
猜测新任职仍有准入。若当前页面有未保存表单，顶部下拉禁用并提示用户先保存或放弃当前修改；这不是
额外信息展示，而是防止直接切换丢失输入。数据范围仍是独立控件，不能合并入该下拉。

#### 表单控件依赖图：IA02-OPERATIONS-SHELL-HEADER

| 用户可见控件 | 控件形态/搜索方式 | owner 候选或初始值来源 | 上游依赖与可用条件 | 变更后的级联清理/重载 | 可选项约束 | loading/empty/failed | 提交时 owner 再核验 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 当前任职 | 顶部单选 `Select`；候选较少时不额外搜索 | 已确认 `WorkspaceSessionEntry.candidates`，当前值为 `selected` | 已登录、至少两个可用任职、当前页面无未保存表单时启用 | 选项变更即直接切换；立即进入 loading，清理旧任职的菜单、查询与可查看范围，等待完整 entry 重建 | 只显示 owner 返回的“业务角色 · 任职机构” | 一个候选时只读显示；切换中禁用；失败/拒绝恢复最后确认任职；不确定时先重读 entry | `selectOperationsWorkspaceSessionContext` 复核候选、上下文版本和页面准入，并返回完整 entry |

<a id="IA02-OPERATIONS-INITIAL-ROLE-SELECTION"></a>

### Screen: IA02-OPERATIONS-INITIAL-ROLE-SELECTION

```text
CONSUMER_FACE=operations-admin（运营管理后台）
UI_SURFACE=独立内容页
HOST_AND_ENTRY=运营管理后台登录成功后；服务端返回多个可用任职且尚未选择时进入
ACTOR=拥有多个有效任职的商场运营方或店铺运营方用户
BUSINESS_SCENARIO=用户首次进入本次运营工作，需要先明确使用哪一项职责
BUSINESS_GOAL=选择本次任职后进入对应的可使用功能页
USER_VISIBLE_COPY=标题“选择本次任职”；字段“可用任职”；按钮“进入运营管理后台”；空态“当前账号暂无可用任职，请联系集团管理员”
TECHNICAL_BOUNDARY=entry mode、assignment ref、page access、context version 不展示
FOUNDATION_PRIMITIVE=useAsyncGenerationGuard, useSubmissionLifecycle, testId
```

```text
┌──────────────── 选择本次任职 ────────────────┐
│ 可用任职 [业务角色 · 任职机构              v] │
│                                                │
│                    [进入运营管理后台]          │
└───────────────────────────────────────────────┘
```

#### 表单控件依赖图：IA02-OPERATIONS-INITIAL-ROLE-SELECTION

| 用户可见控件 | 控件形态/搜索方式 | owner 候选或初始值来源 | 上游依赖与可用条件 | 变更后的级联清理/重载 | 可选项约束 | loading/empty/failed | 提交时 owner 再核验 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 可用任职 | 单选 `Select`；候选较少时不额外搜索 | 登录成功后的 `WorkspaceSessionEntry.candidates` | 无上游依赖；entry 返回两个或以上候选时显示 | 改选只更新待确认值；尚未进入 shell，无旧菜单/范围需清理 | 只显示 owner 返回的“业务角色 · 任职机构” | entry loading 禁用；空集显示“当前账号暂无可用任职”；失败保留未选择态 | 点击“进入运营管理后台”时 `selectOperationsWorkspaceSessionContext` 复核候选、版本和页面准入，并返回完整 entry |

<a id="IA02-OPERATIONS-DATA-SCOPE"></a>

### Screen: IA02-OPERATIONS-DATA-SCOPE

```text
CONSUMER_FACE=operations-admin（运营管理后台）
UI_SURFACE=Popover
HOST_AND_ENTRY=运营管理后台 shell 左侧菜单底部“可查看范围”摘要控件；当前功能页需要选择查看范围时点击打开，Popover 固定在该控件右下侧
ACTOR=已选定任职、正在处理需要限定查看范围的运营用户
BUSINESS_SCENARIO=用户进入组织、项目或门店层级相关功能页，需要在当前任职允许范围内选择查看对象
BUSINESS_GOAL=只查看本次工作需要的机构范围，不改变自身任职和功能权限
USER_VISIBLE_COPY=标题“选择可查看范围”；说明“请选择本次需要查看的机构”；字段“大区”“项目”“门店”（按当前功能页所需层级显示）；占位“选择大区”“请先选择大区”“请先选择项目”；失败提示“暂时无法设置可查看范围，请重试”
TECHNICAL_BOUNDARY=dataNodeRef、dataNodeType、requiredDataNodeType、contextVersion 和服务端范围核验不展示
FOUNDATION_PRIMITIVE=contextScopedQueryArgs, useAsyncGenerationGuard, useSubmissionLifecycle, testId
```

```text
┌──────── 选择可查看范围 ────────┐
│ 请选择本次需要查看的机构         │
│ 大区 [华东大区                v] │
│ 项目 [选择项目                v] │
│ 门店 [请先选择项目            v] │
│ （仅画至当前功能页所需层级）   │
└────────────────────────────────┘
```

#### 表单控件依赖图：IA02-OPERATIONS-DATA-SCOPE

| 用户可见控件 | 控件形态/搜索方式 | owner 候选或初始值来源 | 上游依赖与可用条件 | 变更后的级联清理/重载 | 可选项约束 | loading/empty/failed | 提交时 owner 再核验 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 大区 | 单选可搜索 `Select` | 从 `entry.dataNodeCandidates` 的 `regionRef` 与对应路径名称去重而来 | 当前页需要项目或门店层级时显示；无上游依赖 | 改选立刻清空项目和门店，并仅保留该大区下的 owner 候选 | 只显示 owner 返回候选关联到的大区；不能自由输入 | entry loading 禁用；空集显示“当前任职没有可查看范围”；失败保留最后确认范围 | 不单独提交；只能作为下游候选的过滤条件 |
| 项目 | 单选可搜索 `Select` | 从 owner 候选的 `projectRef` 与对应路径名称去重而来 | 当前页需要项目或门店层级；先选择大区 | 大区改变即清空；项目改变即清空门店并重建其候选 | 仅显示已选大区内、owner 返回的项目 | 未选大区时禁用并显示“请先选择大区”；空集/失败不猜测可选项目 | 不单独提交；只能作为最终选择的上游条件 |
| 门店 | 单选可搜索 `Select` | 从 owner 候选的 `storeRef` 与对应路径名称去重而来 | 当前页需要门店层级；先选择项目 | 项目改变即清空；选择门店后立即提交 | 仅显示已选项目内、owner 返回的门店 | 未选项目时禁用并显示“请先选择项目”；提交中禁用 | `selectOperationsWorkspaceSessionDataNode` 只接受最终 owner 候选，复核候选、层级、上下文版本和范围授权 |
| 最终可查看机构 | 单选可搜索 `Select`；仅当当前页只需大区或项目时显示为该层级最后一个控件 | 当前层级的 owner-returned candidate | 上游大区/项目已选，且该层级正是当前功能页所需层级 | 选择后立即提交并关闭 Popover；owner 完整 entry 替换后刷新范围相关读取 | 仅显示匹配当前功能页所需层级的 owner candidate | loading 禁用；无候选显示业务空态；失败保留最后确认范围并保持 Popover | `selectOperationsWorkspaceSessionDataNode` 复核候选、层级、上下文版本和范围授权 |

只有当前 page 的 catalog `requiredDataNodeType` 非 `NONE` 才显示/要求选择；候选只能来自
`entry.dataNodeCandidates`，UI 以其 `regionRef`→`projectRef`→`storeRef` 逐级裁剪，但最终只提交与当前
业务页所需层级相符的 `dataNodeRef`、`dataNodeType`、`requiredContextVersion` 给 owner。选择最终层级后
立即提交、成功即关闭 Popover，不增加无业务价值的“确认选择”。若当前内容页存在未保存输入，侧栏入口禁用
并提示先保存或放弃当前修改；不在 Popover 内留一份独立草稿。该 guard 不替代服务器 version/scope 校验。

<a id="IA02-PLATFORM-WORKSPACE-CONTEXT"></a>

### Screen: IA02-PLATFORM-WORKSPACE-CONTEXT

```text
CONSUMER_FACE=platform-admin（运维管理后台）
UI_SURFACE=独立内容页；无已选集团空间时呈现空态
HOST_AND_ENTRY=运维管理后台需要先选择集团空间的内容页；用户没有当前集团空间时，由该页面显示
ACTOR=已登录、需要处理某个集团空间资料、账号、角色、扩展字段或总览的运维管理员
BUSINESS_SCENARIO=用户准备进入必须针对某一集团空间处理的功能页
BUSINESS_GOAL=明确本次要管理的集团空间；在确认前不读取或处理其他业务资料
USER_VISIBLE_COPY=提示“请先选择集团空间”“选择集团空间后，才能查看对应的集团空间概览。”；不提供按钮
TECHNICAL_BOUNDARY=workspaceRequirement、selected key、route guard、任务查询条件和内部页面/权限术语不展示
FOUNDATION_PRIMITIVE=testId
```

```text
┌──────────── 请先选择集团空间 ──────────────────────────┐
│ 选择集团空间后，才能查看对应的集团空间概览。             │
└────────────────────────────────────────────────────────┘
```

六个 REQUIRED 页共享一个 platform app state。v2 真实菜单基线是：菜单仍可见，但未选集团空间时不可进入
需要该空间的页面；受控的页面恢复或直达如落入该页，只显示上面的无操作空态，绝不发出缺少当前集团空间的
任务读取。切换空间后仅刷新该空间的读取；不在页面内复制选择状态。

<a id="IA02-PLATFORM-WORKSPACES-ACTIONS"></a>

### Screen: IA02-PLATFORM-WORKSPACES-ACTIONS

```text
CONSUMER_FACE=platform-admin（运维管理后台）
UI_SURFACE=独立内容页
HOST_AND_ENTRY=/platform/workspaces；运维管理员从侧栏“集团空间管理”进入
ACTOR=负责维护集团空间基础资料和状态的运维管理员
BUSINESS_SCENARIO=管理员需要查找一个集团空间，并进入该空间的详情处理后续业务动作
BUSINESS_GOAL=在一个无行内操作列的列表中识别目标集团空间，再进入其详情
USER_VISIBLE_COPY=标题“集团空间管理”；页头按钮“新建集团空间”；筛选“集团空间名称”“集团空间编码”“运营管理后台标题名称”“状态”；列表列“集团空间名称”“集团空间编码”“Logo”“运营管理后台标题名称”“运营后台地址”“商业集团”“状态”“更新时间”
TECHNICAL_BOUNDARY=version、capability、expected version、idempotency、owner readback 不展示
FOUNDATION_PRIMITIVE=contextScopedQueryArgs, useDetailDrawer, testId
```

```text
┌─────────────────────────────── 集团空间管理 ───────────────────────────────┐
│ [新建集团空间]                                                               │
│ 集团空间名称 [________]  集团空间编码 [________]  运营管理后台标题名称 [____]  状态 [全部 v] │
├──────────────┬──────────────┬──────┬──────────────┬──────────┬────────┬──────────────┤
│ 集团空间名称 │ 集团空间编码 │ Logo │ 运营管理后台标题名称 │ 运营后台地址 │ 商业集团│ 状态 / 更新时间│
├──────────────┼──────────────┼──────┼──────────────┼──────────┼────────┼──────────────┤
│ <集团空间名称（链接）> │ <编码> │ <Logo> │ <后台标题> │ <打开运营后台> │ <集团> │ <状态/时间> │
└─────────────────────────────────────────────────────────────────────────────┘
```

表格**没有**“操作”列、行尾按钮或“选择为当前空间”动作。集团空间名称是唯一的行内入口，打开
`IA02-PLATFORM-WORKSPACE-DETAIL-DRAWER`。页头“新建集团空间”打开创建抽屉。编辑、启停和初始化
只从详情抽屉的上下文动作进入；其服务端事实仍由相应 owner command/readback 决定。

<a id="IA02-PLATFORM-WORKSPACE-OVERVIEW"></a>

### Screen: IA02-PLATFORM-WORKSPACE-OVERVIEW

```text
CONSUMER_FACE=platform-admin（运维管理后台）
UI_SURFACE=独立内容页
HOST_AND_ENTRY=/platform/workspace-overview；已选择当前集团空间后从侧栏进入
ACTOR=需要了解已选集团空间业务概况的运维管理员
BUSINESS_SCENARIO=管理员已经选择集团空间，准备阅读该空间的基本、初始化和账号访问汇总事实
BUSINESS_GOAL=阅读当前集团空间的业务概览，不在阅读任务中修改空间资料或状态
USER_VISIBLE_COPY=标题“集团空间概览”；区块“空间概览”“初始化情况”“账号访问”；按钮“刷新”；某一资料暂时无法获取时按钮“重试”
TECHNICAL_BOUNDARY=selected key、task query、authorization 不展示
FOUNDATION_PRIMITIVE=contextScopedQueryArgs, testId
```

```text
┌──────────────────────── 集团空间概览 ─────────────────────────┐
│ 空间概览：集团空间名称 / 集团空间编码 / 状态 / 最近更新        │
│ 初始化情况：初始化状态 / 集团名称                               │
│ 账号访问：账号数量 / 角色数量                                   │
│                                                    [刷新]        │
└────────────────────────────────────────────────────────────────┘
```

本阅读页不提供创建、编辑、启用、停用、返回管理页或更换当前集团空间的入口；这些任务分别属于
“集团空间管理”和待裁决的全局集团空间选择器。本稿采用 carry-over manifest 的冻结用户文案“集团空间概览”；
当前 v2 页面和 catalog 的“集团空间总览”只记录为来源差异，不据此凭空加入“数据”一词。
“刷新”与资料级“重试”均调用该 overview task query 的 `refetch` 重新读取，不订阅或发布
`RefreshSignal`；写后缓存更新仍遵循 RTK tag 的既有权威。

<a id="IA02-OPERATIONS-DATA-SCOPE-SIDER-TRIGGER"></a>

### Screen: IA02-OPERATIONS-DATA-SCOPE-SIDER-TRIGGER

```text
CONSUMER_FACE=operations-admin（运营管理后台）
UI_SURFACE=侧栏底部控件
HOST_AND_ENTRY=已登录运营管理后台 shell 左侧菜单底部；当前功能页需要选择可查看范围时显示，点击打开右下侧 Popover
ACTOR=已选定任职、正在处理需要限定查看范围的运营用户
BUSINESS_SCENARIO=用户需要调整当前业务页的查看范围
BUSINESS_GOAL=打开“选择可查看范围”Popover，而不改变任职和功能权限
USER_VISIBLE_COPY=控件标题“可查看范围”；当前值“大区/项目/门店：<当前机构名称>”或“请选择可查看范围”；无可选范围时“当前任职没有可查看范围”
TECHNICAL_BOUNDARY=requiredDataNodeType、scopeRef、session entry 不展示
FOUNDATION_PRIMITIVE=testId
LAYOUT_BOUNDARY=侧栏固定占用页面可视高度；折叠控件与“可查看范围”不参与菜单滚动。菜单独占中间剩余高度，项目过长时仅在菜单内部垂直滚动。
```

```text
侧栏底部：
可查看范围                                 ›
大区  <当前大区名称(编码)>
项目  <当前项目名称(编码)>
门店  <当前门店名称(编码)>
```

<a id="platform-workspace-selector-decision"></a>

#### 集团空间选择器来源冲突裁决（不是 screen）

正式 v2 `admin-consumer-chrome-standard.md` 与 element ledger 曾把选择器放在 Header；当前
`PlatformShell.tsx`、`PlatformWorkspaceSelector.tsx` 与 L2 则置于侧栏底部。Dexter 已于 2026-07-29
裁决采用**左侧菜单底部**。因此 Header 仅作为已拒绝的来源候选留档，不能再作为 UI screen、线框、
foundation 分母或 implementation input。唯一可实施 shape 是下列侧栏底部控件：一个可搜索的集团空间
选择框，选择即更新当前空间；不提供额外“更换”、“前往管理页”或行内“选择为当前空间”按钮。

<a id="IA02-PLATFORM-WORKSPACE-SIDER-CONTROL"></a>

### Screen: IA02-PLATFORM-WORKSPACE-SIDER-CONTROL

```text
CONSUMER_FACE=platform-admin（运维管理后台）
UI_SURFACE=侧栏底部控件（Dexter 于 2026-07-29 已接受）
HOST_AND_ENTRY=已登录运维管理后台 shell 的左侧菜单底部；切换当前集团空间的唯一全局控件
ACTOR=需要处理某个集团空间资料、账号、角色、扩展字段或总览的运维管理员
BUSINESS_SCENARIO=管理员已进入运维管理后台，需要确认或切换当前工作对象
BUSINESS_GOAL=直接选择当前要处理的集团空间；选择成功后刷新该空间相关的读取和页面准入
USER_VISIBLE_COPY=控件标签“集团空间”；选项显示集团空间名称；无选择时“请选择集团空间”
TECHNICAL_BOUNDARY=selected key、route guard、task query 条件不展示
FOUNDATION_PRIMITIVE=useAsyncGenerationGuard, testId
```

```text
侧栏底部：
集团空间
<集团空间名称 / 请选择集团空间>              v
```

#### 表单控件依赖图：IA02-PLATFORM-WORKSPACE-SIDER-CONTROL

| 用户可见控件 | 控件形态/搜索方式 | owner 候选或初始值来源 | 上游依赖与可用条件 | 变更后的级联清理/重载 | 可选项约束 | loading/empty/failed | 提交时 owner 再核验 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 集团空间 | 单选可搜索 `Select` | 已授权的集团空间列表，当前值来自上一次已确认选择 | 已登录后可用；无当前选择不阻止打开控件 | 选择新空间即替换全局当前空间，清除旧空间相关读取并重新计算六个需要当前空间页面的可进入状态 | 只能选择 owner 返回且当前可用的集团空间；不得自由输入或从 URL 推导 | 列表加载时禁用；无可选项显示“暂无可选择的集团空间”；读取失败保留最后确认值并显示重试 | 后续每个业务读取与写入仍由其 owner 以当前集团空间和权限重新核验；选择器不授予权限 |

<a id="IA02-PLATFORM-WORKSPACE-DETAIL-DRAWER"></a>

### Screen: IA02-PLATFORM-WORKSPACE-DETAIL-DRAWER

```text
CONSUMER_FACE=platform-admin（运维管理后台）
UI_SURFACE=Drawer
HOST_AND_ENTRY=“集团空间管理”独立内容页；点击列表中“集团空间名称”链接打开
ACTOR=需要查看一个集团空间详情，并决定是否处理其资料、状态或商业集团初始化的运维管理员
BUSINESS_SCENARIO=管理员已经在列表中识别目标集团空间，需要先核对完整信息再执行后续动作
BUSINESS_GOAL=在详情中阅读准确资料，并只在此处进入与该集团空间相关的上下文动作
USER_VISIBLE_COPY=标题“集团空间详情”；字段“集团空间名称”“集团空间编码”“运营管理后台标题名称”“Logo”“备注”“状态”“集团编码”“集团名称”“创建时间”“更新时间”；右上操作“初始化商业集团”（仅尚未初始化时）“编辑”“启用”或“停用”
TECHNICAL_BOUNDARY=版本号、owner readback、权限、并发和幂等键不展示
FOUNDATION_PRIMITIVE=adminDrawerSurfaceProps, useDetailDrawer, useOverlayLock, testId
```

```text
┌──────────────────────────── 集团空间详情 ─────────────────────────────┐
│ [关闭]                                      [初始化商业集团] [编辑] [停用]│
│ 集团空间名称  <名称>        集团空间编码  <编码>                         │
│ 运营管理后台标题名称 <标题>  Logo <图片/未配置>                          │
│ 备注 <备注>  状态 <已启用/已停用>  初始化后显示集团编码、集团名称          │
└────────────────────────────────────────────────────────────────────────┘
```

点击“编辑”“启用/停用”或“初始化商业集团”时，**先关闭本详情 Drawer**，确认关闭后才打开相应的
编辑 Drawer、状态 Modal 或初始化 Drawer。这样不叠加两个任务面，也保留原始 v2 的详情→动作链。

<a id="IA02-PLATFORM-WORKSPACE-CREATE-DRAWER"></a>

### Screen: IA02-PLATFORM-WORKSPACE-CREATE-DRAWER

```text
CONSUMER_FACE=platform-admin（运维管理后台）
UI_SURFACE=Drawer
HOST_AND_ENTRY=“集团空间管理”独立内容页的页头“新建集团空间”按钮
ACTOR=负责新建集团空间基础资料的运维管理员
BUSINESS_SCENARIO=管理员需要为新的集团空间填写其可识别资料、运营管理后台名称和 Logo
BUSINESS_GOAL=创建一个完整的集团空间，再回到管理列表核对创建结果
USER_VISIBLE_COPY=标题“新建集团空间”；字段“集团空间编码”“集团空间名称”“运营管理后台标题名称”“备注”“Logo”；按钮“取消”“创建”
TECHNICAL_BOUNDARY=资源引用、绑定凭证、幂等键和 owner command 不展示
FOUNDATION_PRIMITIVE=adminDrawerSurfaceProps, useDrawerFormLifecycle, testId
```

```text
┌──────────────────────── 新建集团空间 ────────────────────────┐
│ 集团空间编码 [________________]                               │
│ 集团空间名称 [________________]                               │
│ 运营管理后台标题名称 [________________]                       │
│ 备注 [________________________________________]               │
│ Logo [选择文件]                                                │
│ [取消]                                             [创建]      │
└──────────────────────────────────────────────────────────────┘
```

#### 表单控件依赖图：IA02-PLATFORM-WORKSPACE-CREATE-DRAWER

| 用户可见控件 | 控件形态/搜索方式 | owner 候选或初始值来源 | 上游依赖与可用条件 | 变更后的级联清理/重载 | 可选项约束 | loading/empty/failed | 提交时 owner 再核验 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 集团空间编码 | 单行 `Input` | 用户填写 | 无上游依赖 | 修改仅保留本 Drawer 草稿 | 必填；同一集团空间编码不可重复 | 校验失败显示字段提示；冲突保留其他输入 | create command 复核格式和唯一性 |
| 集团空间名称 | 单行 `Input` | 用户填写 | 无上游依赖 | 修改仅保留本 Drawer 草稿 | 必填；同一集团空间名称不可重复 | 校验失败显示字段提示；冲突保留其他输入 | create command 复核字段规则和唯一性 |
| 运营管理后台标题名称 | 单行 `Input` | 用户填写 | 无上游依赖 | 修改仅保留本 Drawer 草稿 | 必填；作为该集团空间运营后台的用户可见标题 | 校验失败显示字段提示 | create command 复核字段规则 |
| 备注 | 多行 `TextArea` | 用户填写 | 无上游依赖 | 修改仅保留本 Drawer 草稿 | 非必填，最多 500 字 | 字段校验失败保留草稿 | create command 复核字段规则 |
| Logo | 文件选择控件 | 用户选择并由 owner 返回可用上传结果 | 无上游依赖；创建前必须完成上传 | 更换文件废弃前一暂存结果；上传失败不清除其他字段 | 创建必须有可用 Logo；不得从客户端构造资源地址 | 上传中禁用“创建”；失败提示重新选择 Logo | create command 复核可用 Logo 及绑定授权 |

<a id="IA02-PLATFORM-COMMERCIAL-GROUP-INIT-DRAWER"></a>

### Screen: IA02-PLATFORM-COMMERCIAL-GROUP-INIT-DRAWER

```text
CONSUMER_FACE=platform-admin（运维管理后台）
UI_SURFACE=Drawer
HOST_AND_ENTRY=已关闭“集团空间详情”Drawer；仅当详情显示尚未初始化时，由右上“初始化商业集团”进入
ACTOR=负责为已存在集团空间完成商业集团初始化的运维管理员
BUSINESS_SCENARIO=集团空间已创建，但其商业集团资料尚未建立
BUSINESS_GOAL=填写商业集团编码和名称，完成该集团空间的一次初始化
USER_VISIBLE_COPY=标题“初始化商业集团”；字段“集团编码”“集团名称”；按钮“取消”“初始化”；成功提示“初始化成功”
TECHNICAL_BOUNDARY=workspaceKey、版本、幂等键和 owner command 不展示
FOUNDATION_PRIMITIVE=adminDrawerSurfaceProps, useDrawerFormLifecycle, testId
```

```text
┌──────────────────── 初始化商业集团 ────────────────────┐
│ 集团编码 [________________]                             │
│ 集团名称 [________________]                             │
│ [取消]                                     [初始化]      │
└────────────────────────────────────────────────────────┘
```

#### 表单控件依赖图：IA02-PLATFORM-COMMERCIAL-GROUP-INIT-DRAWER

| 用户可见控件 | 控件形态/搜索方式 | owner 候选或初始值来源 | 上游依赖与可用条件 | 变更后的级联清理/重载 | 可选项约束 | loading/empty/failed | 提交时 owner 再核验 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 集团编码 | 单行 `Input` | 用户填写 | 仅详情确认“尚未初始化”后可打开本 Drawer | 修改仅保留本 Drawer 草稿 | 必填，最多 64 字 | 失败保留草稿，允许修改后重试 | 初始化 command 复核目标集团空间、未初始化前提及编码规则 |
| 集团名称 | 单行 `Input` | 用户填写 | 仅详情确认“尚未初始化”后可打开本 Drawer | 修改仅保留本 Drawer 草稿 | 必填，最多 120 字 | 失败保留草稿，允许修改后重试 | 初始化 command 复核目标集团空间、未初始化前提及名称规则 |

<a id="IA02-PLATFORM-WORKSPACE-EDIT-DRAWER"></a>

### Screen: IA02-PLATFORM-WORKSPACE-EDIT-DRAWER

```text
CONSUMER_FACE=platform-admin（运维管理后台）
UI_SURFACE=Drawer
HOST_AND_ENTRY=已关闭“集团空间详情”Drawer；点击详情右上“编辑”后打开
ACTOR=负责维护集团空间基础资料的运维管理员
BUSINESS_SCENARIO=管理员发现集团空间名称或显示资料需要修正
BUSINESS_GOAL=提交一项受版本保护的资料修改，并看到更新后的集团空间信息
USER_VISIBLE_COPY=标题“编辑集团空间资料”；字段“集团空间编码”（只读）“集团空间名称”“运营管理后台标题名称”“备注”“Logo”；按钮“取消”“保存”；失败提示“信息暂未保存，请查看最新信息后重试”
TECHNICAL_BOUNDARY=expectedVersion、Idempotency-Key、owner command/readback 不展示
FOUNDATION_PRIMITIVE=adminDrawerSurfaceProps, useDrawerFormLifecycle, testId
```

```text
┌──────────────── 编辑集团空间 ────────────────┐
│ 集团空间编码 <只读编码>                        │
│ 集团空间名称 [________________]                │
│ 运营管理后台标题名称 [________________]        │
│ 备注 [__________________________]              │
│ Logo [保持当前 / 选择新 Logo / 移除]            │
│ [取消]                              [保存]    │
└─────────────────────────────────────────────┘
```

#### 表单控件依赖图：IA02-PLATFORM-WORKSPACE-EDIT-DRAWER

| 用户可见控件 | 控件形态/搜索方式 | owner 候选或初始值来源 | 上游依赖与可用条件 | 变更后的级联清理/重载 | 可选项约束 | loading/empty/failed | 提交时 owner 再核验 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 集团空间编码 | 只读 `Input` | 打开 Drawer 时由 owner detail 预填 | 无上游依赖；不可编辑 | 无级联 | 编辑不允许变更编码 | detail loading 禁用 | 更新 command 以详情目标为准，客户端不能替换目标 |
| 集团空间名称 | 单行 `Input` | 打开 Drawer 时由 owner detail 预填 | 无上游依赖；有编辑能力且详情 readback 完成时可编辑 | 变更仅保留 Drawer 草稿；保存成功用 owner detail 替换列表行和同 key context 缓存 | 采用已接受的名称长度/字符规则 | detail loading 禁用；校验失败显示字段提示；冲突重读详情后由用户决定是否重填 | `updatePlatformGroupWorkspaceDisplay` 复核权限、版本和字段规则，并返回 owner detail |
| 运营管理后台标题名称 | 单行 `Input` | 打开 Drawer 时由 owner detail 预填 | 无上游依赖 | 修改仅保留 Drawer 草稿 | 必填；作为该集团空间运营后台的用户可见标题 | detail loading 禁用；校验失败显示字段提示 | update command 复核字段规则和版本 |
| 备注 | 多行 `TextArea` | 打开 Drawer 时由 owner detail 预填 | 无上游依赖 | 修改仅保留 Drawer 草稿 | 非必填，最多 500 字 | detail loading 禁用；校验失败显示字段提示 | update command 复核字段规则和版本 |
| Logo | 三选一单选项“保持当前 / 选择新 Logo / 移除”；选择新 Logo 时显示文件选择控件 | 当前 Logo 由详情预览；新文件经 owner 上传返回可用结果 | 选择“新 Logo”后才显示文件选择控件 | 从“新 Logo”切走时废弃暂存上传；替换成功后以 owner detail 刷新 | 替换必须有新的可用 Logo；不得从客户端构造资源地址 | 上传中禁用保存；上传失败保留其他输入并提示重新选择 | update command 复核操作方式、可用 Logo、绑定授权和版本 |

<a id="IA02-PLATFORM-WORKSPACE-STATUS-MODAL"></a>

### Screen: IA02-PLATFORM-WORKSPACE-STATUS-MODAL

```text
CONSUMER_FACE=platform-admin（运维管理后台）
UI_SURFACE=Modal
HOST_AND_ENTRY=已关闭“集团空间详情”Drawer；点击详情右上“启用”或“停用”后打开
ACTOR=负责维护集团空间状态的运维管理员
BUSINESS_SCENARIO=管理员需要调整一个集团空间的可用状态
BUSINESS_GOAL=明确确认状态变更，避免误停用或误启用
USER_VISIBLE_COPY=标题“确认启用集团空间？”或“确认停用集团空间？”；按钮“返回”“确认”；失败提示“状态暂未更新，请查看最新信息后重试”
TECHNICAL_BOUNDARY=closed enum、version conflict、idempotency、owner invariant 不展示
FOUNDATION_PRIMITIVE=useOverlayLock, useSubmissionLifecycle, testId
```

```text
┌──────────── 确认停用集团空间？ ──────────────┐
│ 将集团空间状态变更为“已停用”。                │
│ [返回]                              [确认]    │
└─────────────────────────────────────────────┘
```

#### Surface ownership roster（本稿 15 个可实施 screen；Header 来源候选已拒绝）

| screen id | 声明 UI_SURFACE | 线框可见元素分母 | owner 对账 | USER_VISIBLE_COPY 对账 | 结论 |
| --- | --- | --- | --- | --- | --- |
| IA02-OPERATIONS-SHELL-HEADER | Header 控件 | 当前任职选择器 | 仅本 Header 控件 | 当前任职、角色/机构 option、失败提示 | PASS |
| IA02-OPERATIONS-INITIAL-ROLE-SELECTION | 独立内容页 | 标题、任职 Select、进入按钮 | 均属初次选择页 | 全部有位置 | PASS |
| IA02-OPERATIONS-DATA-SCOPE | Popover | 标题、说明、逐级范围 Select、失败提示 | 均属该 Popover | 全部有位置 | PASS |
| IA02-PLATFORM-WORKSPACE-CONTEXT | 独立内容页中的空态 | 空态标题、说明 | 不画 Header、侧栏或跳转按钮 | 全部有位置 | PASS |
| IA02-PLATFORM-WORKSPACES-ACTIONS | 独立内容页 | 页头新建、筛选、无操作列表、名称链接 | 不画操作列/行尾按钮 | 全部有位置 | PASS |
| IA02-PLATFORM-WORKSPACE-DETAIL-DRAWER | Drawer | 标题、详情、关闭、初始化/编辑/状态上下文操作 | 操作都属详情 Drawer | 全部有位置 | PASS |
| IA02-PLATFORM-WORKSPACE-CREATE-DRAWER | Drawer | 标题、五个字段、取消/创建 | 均属创建 Drawer | 全部有位置 | PASS |
| IA02-PLATFORM-COMMERCIAL-GROUP-INIT-DRAWER | Drawer | 标题、两字段、取消/初始化 | 均属初始化 Drawer | 全部有位置 | PASS |
| IA02-PLATFORM-WORKSPACE-OVERVIEW | 独立内容页 | 标题、三组只读汇总、刷新/资料重试 | 不画管理或选择操作 | 全部有位置 | PASS |
| IA02-OPERATIONS-DATA-SCOPE-SIDER-TRIGGER | 侧栏底部控件 | 范围标题、当前值、打开图标 | 仅本侧栏底部控件 | 全部有位置 | PASS |
| IA02-PLATFORM-WORKSPACE-SIDER-CONTROL | 侧栏底部控件 | 单一集团空间 Select | 仅本侧栏底部控件 | 全部有位置 | PASS |
| IA02-PLATFORM-WORKSPACE-EDIT-DRAWER | Drawer | 标题、编码只读、资料输入、Logo、取消/保存 | 均属该 Drawer | 全部有位置 | PASS |
| IA02-PLATFORM-WORKSPACE-STATUS-MODAL | Modal | 确认标题、状态说明、返回/确认 | 均属该 Modal | 全部有位置 | PASS |
| IA02-PLATFORM-AUTHENTICATED-SHELL | 登录后的应用 Shell | 左侧品牌、带图标菜单、内容页签、刷新/全屏、内容滚动容器；集团空间选择器和用户菜单只标为 sibling 插槽 | shell 自有 chrome 属本 screen；选择器 owner=`IA02-PLATFORM-WORKSPACE-SIDER-CONTROL`，用户菜单 owner=独立安全入口，均不在 shell 内展开 | shell 自有文案有位置；sibling 文案回各自 screen | PASS |
| IA02-OPERATIONS-AUTHENTICATED-SHELL | 登录后的应用 Shell | 品牌、带图标菜单、内容页签、刷新/全屏、内容滚动容器；任职 Select、可查看范围和用户菜单只标为 sibling 插槽 | shell 自有 chrome 属本 screen；任职 owner=`IA02-OPERATIONS-SHELL-HEADER`，范围 owner=`IA02-OPERATIONS-DATA-SCOPE-SIDER-TRIGGER`，用户菜单 owner=独立安全入口，均不在 shell 内展开 | shell 自有文案有位置；sibling 文案回各自 screen | PASS |

## 5. 状态与边界表

| 屏幕/动作 | initial/loading | validation | submitting | success | conflict/denied | timeout/unknown | owner/face 边界 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| first role selection | entry loading；`EMPTY` 显示独立态 | 只选 owner candidates | `select...Context` 期间禁重复 | full entry → shell/first accessible page | 保持无 selected state 和 typed reason | 重读 session entry，不猜 assignment | operations / workspace-iam |
| shell role direct select | shell 保持、下拉显示 last confirmed role | 候选必须来自 entry；有未保存表单时禁用下拉 | 选择后立即 owner command；切换中禁重复 | full entry 替换；清 context queries；导航 | 保留 old entry；403/409 不改变 UI context | 重读 entry；只有 owner 未确认才允许重放 | operations / workspace-iam |
| data scope Popover | 仅 current page needs depth 时可打开；逐级 Select 按 entry 加载 | 可查看机构必须来自 candidates 且满足页面需要的层级 | 最终层级选择即 owner command；Idempotency-Key+requiredContextVersion | full entry 替换、关闭 Popover；只刷新 scope reads | 保留 old selectedDataNode、显示错误，不猜测新范围 | 重读 entry，再决定重试 | operations / workspace-iam |
| platform selected workspace | app boot 恢复最后确认 selection；无 selection 时 required 菜单禁用 | selection 仅来自侧栏底部已授权空间选择器 | local state transition；不发业务 command | required page read begins with selected key | access/stale 清除 selection，保持安全空态 | 先重读可选择空间 | platform-admin; server task APIs remain authoritative |
| workspace create/detail/edit/status/init | 列表与详情 loading；列表只开详情 | 字段约束；状态 closed enum；初始化仅未初始化可见 | Drawer/Modal 生命周期、dirty guard、idempotency+expectedVersion | owner detail replaces list row/selected cache | 409 重读该 key；403 无 action | key readback before replay | platform-admin / platform-workspace |
| overview | selected key required；read-only loading | N/A | 只允许刷新或资料级重试 | owner task read render | denied 不伪装成空总览 | selection/readback refresh | platform-admin / task owner |

## 6. 逐操作任务合理性

| 操作 | 批准来源 | 用户为何此时操作 | 更短路径 | 不选替代的理由 | 约束归因 | Dexter 裁决是否必要 |
| --- | --- | --- | --- | --- | --- | --- |
| 初次选任职 | G-05、R-15 | 多任职账号必须确定本次页面/权限 | 选默认任职 | 业务未授权默认，也会掩盖权限变化 | 产品已裁定 | 否 |
| shell 内切任职 | G-05、R-12 | 已在工作中更换职责 | Drawer 确认或整页选择器 | Dexter 已裁定顶部下拉直接切换；Drawer 只增加一次无业务价值的确认，整页接管使已确认任务消失 | Dexter 交互裁定；R-12 | 否，已接受顶部下拉形状 |
| 选数据范围 | G-05、R-12/R-13；v1/v4 shell 基线 | 当前页面需要限定可见节点 | 与任职合并；Header Drawer | 两者有不同语义/生命周期，合并会误授或误筛；v1/v4 均将范围放在侧栏底部，v4 以 Popover 保持当前任务上下文 | 产品/owner 已裁定；Heritage 仅作交互形状基线 | 否 |
| 全局 Select 选择集团空间 | G-10、R-7、D01-S06、P-U2 | 进入当前集团空间的功能页前确认工作对象 | URL 带 key / 管理表格行内选择按钮 | URL 不能带 key 且非授权；v2 表格禁止为此增加操作列 | Dexter 于 2026-07-29 已裁决侧栏底部；Header 仅为已拒绝来源记录 | 否，已接受侧栏底部 |
| 页头“新建集团空间” | D01-S02；v2 管理页 | 管理员在列表页创建新的集团空间 | 在总览页或行内表单创建 | 创建是管理页页头动作；总览是只读页 | D01-S02、v2 原始页 | 否 |
| 新建 Drawer“取消” | D01-S02；v2 form Drawer | 放弃尚未提交的创建草稿 | 直接丢弃内容 | 原始 Drawer 有草稿关闭保护，不能绕过 | v2 form Drawer lifecycle | 否 |
| 新建 Drawer“创建” | D01-S02；v2 form Drawer | 已填写资料并上传 Logo 后提交 | 自动保存或无 Logo 创建 | 原始流程要求用户明确创建且有可用 Logo | D01-S02、v2 form Drawer | 否 |
| 列表“集团空间名称”链接 | D01-S02；v2 管理页和 UI 标准 §2.4 | 管理员从列表识别目标后先核对详情 | 行尾“查看”按钮或操作列 | 标准要求业务名称链接打开详情 Drawer，禁止行尾查看/编辑/启停 | v2 正式标准与 L2 | 否 |
| 详情“关闭” | D01-S02；v2 detail Drawer | 详情已读完且不继续操作时退出该任务面 | 跳转列表或关闭整个页面 | 保留列表和筛选上下文，符合 Drawer 的独立关闭面 | v2 detail Drawer | 否 |
| 详情“编辑” | D01-S03；v2 detail Drawer | 已核对详情后修正显示资料 | 列表行内编辑或 overview 编辑 | 动作只从详情右上进入，并先关闭详情再开编辑 Drawer | D01-S03、v2 原始链路 | 否 |
| 编辑 Drawer“取消” | D01-S03；v2 form Drawer | 放弃尚未保存的资料草稿 | 直接丢弃内容 | 原始 Drawer 有草稿关闭保护，不能绕过 | v2 form Drawer lifecycle | 否 |
| 编辑 Drawer“保存” | D01-S03；v2 form Drawer | 已修正资料后明确提交 | 自动保存 | 需要 owner 版本保护与明确提交 | D01-S03、v2 form Drawer | 否 |
| 详情“启用”或“停用” | D01-S04；v2 detail Drawer | 已核对详情后需要调整状态 | 列表行内启停或 overview 启停 | 状态动作只从详情右上进入，并先关闭详情再开确认 Modal | D01-S04、v2 原始链路 | 否 |
| 状态 Modal“返回” | D01-S04；v2 status Modal | 放弃本次状态变更 | 关闭整个详情任务 | 仅取消确认，不更改状态 | v2 status Modal | 否 |
| 状态 Modal“确认” | D01-S04；v2 status Modal | 已阅读状态变更说明后确认提交 | 直接在详情中即时改变 | 纯确认操作应进入 Modal，防止误操作 | D01-S04、v2 status Modal | 否 |
| 详情“初始化商业集团” | D01-S05；v2 detail Drawer | 仅未初始化空间需要补齐商业集团资料 | 在列表或总览提供入口 | 该动作与单个空间详情强绑定，且仅未初始化可见 | D01-S05、v2 原始链路 | 否 |
| 初始化 Drawer“取消” | D01-S05；v2 init Drawer | 放弃尚未提交的商业集团资料 | 直接丢弃内容 | 原始 Drawer 有草稿关闭保护，不能绕过 | v2 init Drawer lifecycle | 否 |
| 初始化 Drawer“初始化” | D01-S05；v2 init Drawer | 已填写集团编码和名称后完成一次初始化 | 自动初始化或列表直接初始化 | 需要用户明确提供两项业务资料 | D01-S05、v2 init Drawer | 否 |
| 总览“刷新” | D01-S06；v2 overview | 已选择空间后更新汇总事实 | 让总览兼任管理 | 刷新只重新读取，不改变资料或状态 | D01-S06、v2 overview | 否 |
| 总览资料级“重试” | D01-S06；v2 overview | 某一汇总资料暂不可得时再次读取 | 把失败伪装成空值 | 重试只对失败读取恢复，保留已成功的资料 | v2 overview | 否 |

## 7. Face / owner 对齐矩阵

| 屏幕/动作 | consumer face | 页面准入 | server operation | owner readback / command | 前端不可替代的判定 |
| --- | --- | --- | --- | --- | --- |
| role select/switch | operations-admin | authenticated entry; menu from returned pageDesignKeys | `getOperationsWorkspaceSessionEntry`, `selectOperationsWorkspaceSessionContext` | workspace-iam complete `WorkspaceSessionEntry` | role candidate, capability, current version 和 page access 不由 client 推导 |
| visible data scope | operations-admin | current page required depth；not page auth | `selectOperationsWorkspaceSessionDataNode` | workspace-iam complete entry/candidates | hierarchy scope、candidate 和 final scope 都不能前端判断 |
| platform workspace selection | platform-admin | platform session；six REQUIRED pages share app state | platform workspace list/detail task reads | selected key comes from owner result; later task APIs re-authorize | selection is a locator/context, not capability or server authorization |
| create | platform-admin | `PLATFORM-WORKSPACES` page header | `createPlatformGroupWorkspace` | platform-workspace create readback updates the list | name/code uniqueness, Logo binding and create authority are owner facts |
| detail / edit / status / initialization | platform-admin | detail action visibility only; initialization additionally requires not initialized | detail read; `updatePlatformGroupWorkspaceDisplay`; `transitionPlatformGroupWorkspaceStatus`; commercial-group initialization command | platform-workspace/organization owner detail or root readback | current status, version, initialization state and command authority are owner facts |
| overview refresh / retry | platform-admin | `PLATFORM-WORKSPACE-OVERVIEW` + selection | existing overview task query/refetch | task owner readback | no client-created summary or inferred selection |

## 8. Manifest B.4/B.5 命中对照

| manifest 条文 | 命中/不适用理由 | 遵循方式 / 待 Dexter 裁决 | Heritage 原文 |
| --- | --- | --- | --- |
| B.4（single state authority） | P-U2 与 P-U4 都是重复/混淆 context state | platform selected workspace 单一 app source；operations 一律覆盖为 owner entry | R5 frozen baseline / registry-selected source；无 runtime fallback |
| B.4（lifecycle/dirty/async） | Drawer、role switch、status 都会异步失败 | 复用 foundation lifecycle/overlay/generation；unknown 先 readback | 同上 |
| B.5（信息架构） | “我是谁”“我在哪”“管理空间”“阅读总览”是四个任务 | 四个屏幕不互相吞并；每个线框明确入口/退出 | 同上 |
| B.5（授权不可由 UI 替代） | role/page/scope/status 都是权限相关 | UI 只作导航和 hint；owner command/readback 决定 | 同上 |

最终 implementation-facing 详设须重开 `contracts/policy/standards-coverage-matrix.json` 当前字节，
逐个写出实际 B.4/B.5 rule id、owner、red mutation 和 hash；本预备稿不伪称这些控制已闭合。

## 9. 高保真静态 demo

`NOT_REQUIRED`。各屏沿用已接受 R5 shell/list/Drawer 的视觉语言；此次争点是操作分离、
状态恢复与 owner 边界，低保真线框足够由 Dexter 裁定。

## 10. Dexter 看图结论

- 看图日期：`UNSET`
- 低保真线框结论：`UNSET`
- 高保真 demo：`NOT_REQUIRED`
- 请确认的最小事项：
  1. 已进入 shell 后的任职切换改为右上 shell 内选择面，成功后进入新任职的第一可访问页；
  2. 数据范围继续独立，采用左侧菜单底部摘要控件打开右下 Popover，且仅在当前页要求数据范围时显示；
  3. platform 的六个 REQUIRED 页在未选空间时菜单可见但不可进入；任何恢复到页面的空态只显示说明，不加“前往管理页”按钮，也不以 URL key 代替选择；
  4. 已裁决：全局“集团空间”选择器采用候选 B（左侧菜单底部，当前源码与 L2）；Header 正式 element ledger 仅保留为已拒绝来源记录；
  5. 管理列表保留“页头新建 + 名称链接详情”，详情关闭后才进入编辑、状态确认或商业集团初始化；总览只读，仅刷新/重试。

## 11. 两个后台登录后 Shell 的严格详设（Dexter 指令，2026-07-29）

```text
BUSINESS_REQUIREMENT_SOURCE=doc/decisions/2026-07-25-v2s-r5-whole-scope-interaction-design.md#OPERATIONS-SHELL；contracts/policy/frontend-asset-carryover-manifest.json#OPERATIONS-SHELL；Dexter 的“两个管理后台登录之后 shell 必须有详设”指令。
BUSINESS_PROBLEM=登录成功后的用户需要在稳定、可识别且不拥挤的后台工作面中切换获准功能；没有独立 shell 详设会让菜单、标签页、滚动和刷新被各业务页重复或猜测实现。
BUSINESS_USER_OR_OWNER=已登录运维管理员、已登录运营用户；菜单/身份/范围/品牌均由对应 app 与 owner readback 共同确定。
CURRENT_TASK=为 platform-admin 与 operations-admin 各补一个登录后 shell screen；不改变 IA02 中已接受的任职/范围/集团空间选择器 ownership。
SUCCESS_OUTCOME=用户在有菜单图标、可多开内容页签、紧凑可滚动内容容器及统一刷新/全屏能力的 shell 中完成已获准任务；运营用户始终看见所属集团空间的品牌信息。
IMPLEMENTATION_AUTHORITY=false
```

### Screen: IA02-PLATFORM-AUTHENTICATED-SHELL

```text
CONSUMER_FACE=platform-admin（运维管理后台）
UI_SURFACE=登录后的应用 Shell；独立于其 Outlet 内容页、Drawer 和 Modal
HOST_AND_ENTRY=运维管理员完成登录并进入已获准 platform route 后
ACTOR=已登录运维管理员
BUSINESS_SCENARIO=在集团空间、管理员治理、空间详情任务间切换
BUSINESS_GOAL=通过带图标的左侧菜单、可并存的内容页签和统一 chrome 完成平台工作，而不丢失当前上下文
USER_VISIBLE_COPY=左侧品牌“运维管理后台”；菜单“集团空间管理”“运维管理员管理”“集团空间详细信息”；页签操作“刷新当前页”“全屏显示当前页面/退出全屏”；侧栏底部“集团空间”选择器
TECHNICAL_BOUNDARY=集团空间选择器只是 app context，不是授权；菜单是否可进入、数据读取及写入均由各 task owner 重新核验；内部 page key、tab refresh version、tag、路由和错误码不显示
FOUNDATION_PRIMITIVE=useOverlayLock,contextScopedQueryArgs,testId
HERITAGE_COUNTERPART=EXACT_COUNTERPART; all-v2/apps/frontend/platform-admin/src/app/shell/PlatformShell.tsx@1d9bbb9ad16d5d7063ca4469ad8de0509a0c896c4397bc72458fb87814c9f268；all-v2/apps/frontend/platform-admin/src/app/layout/AppPageContainer.tsx@6e9aa5fd698812132558127f0f14dea657cf53fe275d1d6f89c66c0bef849f40
```

```text
┌ 运维管理后台 ──────────────────────────────────────────┐
│ [▦] 集团空间管理   ┌ [集团空间管理 ×] [管理员管理 ×] ─ [刷新][全屏] ┐ │
│ [♟] 运维管理员管理 │                    当前内容页（可上下滚动）      │ │
│ [⚙] 集团空间详细信息 └──────────────────────────────────────────────┘ │
│ …各获准子菜单（均有图标）                                              │
│ ───────────────── [集团空间：<名称> v]（sibling：IA02-PLATFORM-WORKSPACE-SIDER-CONTROL） │
└──────────────────────────────────────────────────────────────────────┘
```

- 菜单图标固定映射为：集团空间管理 `AppstoreOutlined`、运维管理员 `TeamOutlined`、集团空间详细信息 `SettingOutlined`；其下概览/组织/合同/角色/账号/扩展字段分别为 `DashboardOutlined`、`ApartmentOutlined`、`FileTextOutlined`、`SafetyCertificateOutlined`、`UserOutlined`、`TagsOutlined`。图标只辅助识别，不改变页面权限或菜单顺序。
- `IA02-PLATFORM-WORKSPACE-SIDER-CONTROL` 仍是唯一的全局集团空间选择器；不得移回 Header、列表操作列或总览。
- 登录后首次打开一个获准内容页；以后菜单打开/聚焦同一页签而不重复创建。可关闭非最后一个页签；关闭当前页签后导航到相邻已开页签。集团空间变更只刷新该空间有关页签；它不成为 server 授权。
- 页签栏右侧的“刷新当前页”只使当前页重新读取并失效该空间相关缓存；页面自身的资料级“重试/刷新”仍是该页面 task query，不替代 shell 刷新。
- 全屏是 shell CSS 状态：隐藏顶栏和侧栏，让当前内容页最大化；不是浏览器全屏 API，退出后恢复原 tab、菜单和滚动位置。
- shell 根占满视窗并禁止外层滚动；内容 tab body 是唯一应用级滚动容器。shell 内容采用紧凑 `md` 间距，`AppPageContainer` 不再叠加内边距，保证内容与容器边缘有清晰但不过大的空隙。

### Screen: IA02-OPERATIONS-AUTHENTICATED-SHELL

```text
CONSUMER_FACE=operations-admin（运营管理后台）
UI_SURFACE=登录后的应用 Shell；独立于 Header 任职 Select、侧栏范围控件、Outlet 内容页、Drawer 和 Modal
HOST_AND_ENTRY=运营用户经所属集团空间登录并完成首次任职选择后
ACTOR=已登录且已有 confirmed 任职的运营用户
BUSINESS_SCENARIO=在所属集团空间内处理组织、门店、合同或用户管理，并在多个已获准功能间切换
BUSINESS_GOAL=始终认得当前所属集团空间，在图标菜单和多内容页签中高效处理已授权业务
USER_VISIBLE_COPY=侧栏品牌“<集团空间 LOGO> <集团空间名称>”“<运营管理后台标题>”；菜单分组及各获准菜单名称；页签操作“刷新当前页”“全屏显示当前页面/退出全屏”；任职控件“当前任职”；侧栏底部“可查看范围”
TECHNICAL_BOUNDARY=集团空间品牌、运营后台标题和 LOGO 必须来自 owner-approved authenticated session brand readback；URL、workspace key、role assignment、范围、菜单 grant、tab state、缓存版本及错误码不显示。若当前 session entry 没有这些展示字段，final implementation-facing design 必须由 workspace-IAM owner 扩展同一 session entry readback；浏览器不得从资源引用、URL 或本地缓存构造品牌。
FOUNDATION_PRIMITIVE=useOverlayLock,contextScopedQueryArgs,testId
HERITAGE_COUNTERPART=PARTIAL_COUNTERPART; all-v2/apps/frontend/operations-admin/src/features/work-context/ui/OperationsContextShell.tsx@ac41148c6a40d0abde90611e6c06a718738634dd5f9dcdab170b1667dc257be6；all-v2/apps/frontend/operations-admin/src/app/layout/AppPageContainer.tsx@6e9aa5fd698812132558127f0f14dea657cf53fe275d1d6f89c66c0bef849f40
```

```text
┌ <LOGO> <集团空间名称> ─ <运营管理后台标题> ─ [当前任职 v]（sibling：IA02-OPERATIONS-SHELL-HEADER） ┐
│ [▦] 工作台   [⌂] 组织管理   [▣] 合同管理   [♟] 用户管理             │
│    各获准菜单项均显示固定图标 + 业务名称                             │
│ ┌ [组织架构 ×] [门店管理 ×] [合同管理 ×] ───────── [刷新][全屏] ┐ │
│ │                   当前内容页（可上下滚动）                       │ │
│ └────────────────────────────────────────────────────────────────┘ │
│ ────────────────────────────── 可查看范围：<当前机构> v（sibling：IA02-OPERATIONS-DATA-SCOPE-SIDER-TRIGGER） │
└────────────────────────────────────────────────────────────────────┘
```

- 品牌区位于侧栏 menu header：LOGO 与集团空间名称左右并列，运营管理后台标题作为其下的业务说明；未配置 LOGO 或加载失败时只回退到统一默认标识，名称和标题仍必须来自 owner readback。它不替代 IA01 登录页的品牌区，也不把集团空间选择器加入运营 Shell。
- 左侧菜单的所有获准项均要有 Ant Design 图标。固定映射：工作台 `DashboardOutlined`、组织架构 `ApartmentOutlined`、品牌 `TagsOutlined`、经营租户 `BankOutlined`、总公司 `ClusterOutlined`、门店/门店资料 `ShopOutlined`、合同 `FileTextOutlined`、五类用户页 `TeamOutlined`。图标映射在 generated catalog/page registry 之外由 app-shell 单一表拥有，按已获准 pageDesignKey 取用；图标缺失 fail closed 为不渲染该菜单项，不能用 page key 或技术占位文案替代。
- 多内容页签只由 owner-confirmed navigation 打开；同一功能重复点击聚焦已有页签。任职切换成功后必须关闭旧任职全部页签、清旧查询/范围并进入新任职的首个获准页；范围改变保留页签，当前页立即刷新，后台页在再次聚焦时刷新。
- 页签栏右侧“刷新当前页”仅刷新当前内容页并失效该集团空间业务缓存；不得把它画入 Header，也不替代内容页的资料级重试。
- 全屏是 Shell CSS 状态，隐藏侧栏、顶部品牌和顶栏，仅最大化当前内容页；不是浏览器全屏 API。Overlay 锁定、未保存表单或切换进行中时，菜单、页签关闭、任职/范围和全屏控制均按各自已有 lock 规则禁用。
- Shell 根占满视窗、外层不滚动；tab body 是唯一应用级纵向滚动面。内容使用紧凑 `md` 容器间距，`AppPageContainer` 清除二次内容 padding；业务页不得再用大卡片外边距制造空洞。

两个 Shell 中，既有 `IA02-OPERATIONS-SHELL-HEADER`、`IA02-OPERATIONS-DATA-SCOPE-SIDER-TRIGGER`、`IA02-OPERATIONS-DATA-SCOPE`、`IA02-PLATFORM-WORKSPACE-SIDER-CONTROL` 和密码 Drawer 继续各自拥有其独立 surface；本节只定义宿主 chrome，不把这些 sibling screen 混画或合并。
- 允许作为 implementation-facing design 输入：`是，Dexter 于 2026-07-29 接受`；这不是 implementation authority。

## 12. P6 搜索与候选选择详设（2026-07-29）

`SEARCH_CAPABILITY_DENOMINATOR=5`。原始业务问题是 G-05 的“任职是我是谁、数据范围是我在哪”以及
G-10/P-U2 的“集团空间只定位当前业务上下文、不能由 URL 授权”；具体任务回指 R5 `D04-S01/S02`、
RM1 plan `P-U2/P-U4`。下列不是把技术 id 填入表单：每项都只让用户在 owner 已确认的业务事实内定位。
其余 IA02 screen 是详情、状态动作、只读概览或 shell chrome，`NOT_APPLICABLE_WITH_REASON`：原始任务未
要求再查找实体，不能因菜单/表格可见而臆增条件。

| screen / 业务对象 / 用户问题 | 条件的用户可见文案 | 匹配语义与控件形态 | 值或候选的唯一来源 | 上游级联、清理与重载 | 请求/提交 owner 核验 | 适合性与排除的替代方案 | contract 缺口或不适用处置 |
| --- | --- | --- | --- | --- | --- | --- |
| `IA02-OPERATIONS-INITIAL-ROLE-SELECTION` / 本次任职 / 登录后先确认“我以谁的身份工作” | “可用任职” | 单选 `Select`；任职数少时不启用远程搜索 | `WorkspaceSessionEntry.candidates`，workspace-IAM session readback | 成功选定后才打开业务页；改选清空旧任职的页签、范围与查询缓存 | `select...Context` 以 assignment ref 与 session 版本重验 | 任职不能由名称、URL 或当前数据范围推断；固定 Select 比无必要搜索更符合少量已确认候选 | 无；候选为空只呈恢复/退出，不造默认任职 |
| `IA02-OPERATIONS-SHELL-HEADER` / 已登录用户的当前任职 / 在不中断业务的前提下切换任职 | “当前任职” | 单选 `Select`，沿用同一 session candidates；不显示技术身份 | 同上 | 选择成功关闭旧任职页签并回首个获准页；失败保留当前任职 | workspace-IAM 的 context-select 重验 | 这是“切换本次工作身份”，不是查人或查机构，故不以文本或独立搜索页实现 | 无 |
| `IA02-OPERATIONS-DATA-SCOPE` / 可处理数据的机构范围 / 在当前任职下定位大区、项目或门店 | “可查看范围” | owner-returned 大区→项目→门店 searchable `Select`；只有需要具体范围时展示下级 | `WorkspaceSessionEntry.dataNodeCandidates`，workspace-IAM | 选大区清项目/门店，选项目清门店；最终层才提交，加载失败不保留旧下游值 | data-scope select 以当前 assignment、候选 ref 与版本重验 | 机构随业务增长且同名可能出现，不能手填；本地发现层级会错越权，故不用 Cascader 自建树 | 无；候选不含的层级不显示/不可选 |
| `IA02-PLATFORM-WORKSPACES-ACTIONS` / 集团空间管理记录 / 平台人员在治理前按名称、编码、运营后台标题或状态缩小列表 | “集团空间名称”“集团空间编码”“运营管理后台标题”“状态” | 前三项为 contract 文本查询 `Input`；状态为冻结状态词表 `Select` | `listPlatformGroupWorkspaces`，platform-workspace owner；业务依据 P-U3 的管理页承担治理 | 条件互不级联；清空恢复 owner 默认分页；不可从当前选择器反推管理列表 | list query 仍由 owner 按平台权限返回；后续详情/启停 command 另行重验 | 名称/编码/标题是管理记录的可键入业务标识，故 Input；状态有限稳定，故 Select；不把“当前空间”混入筛选 | 无；排序/分页是协议参数，不写成用户伪筛选 |
| `IA02-PLATFORM-WORKSPACE-SIDER-CONTROL` / 当前集团空间 / 在平台管理页间保持同一工作上下文 | “集团空间” | 已授权空间 searchable `Select`，按名称/编码过滤 owner 返回候选 | platform-workspace task read；选择写入 app context 而非 URL | 改选使六个 required 页的缓存失效并重读；清除/失效回导航 guard，不能保留旧 key | owner 按当前可访问空间重验 read；它不替代任何业务 command 授权 | 当前空间是不断增长的业务主体，不能手填 key 或复用管理表已加载行；搜索选择能先定位再切换 | 无；没有候选时菜单置灰并阻止导航，空态不替代 guard |

## 13. 接受后的严格设计输入

接受后 P6 详设必须对每个实际 delivery unit 冻结 exact path disposition、owner/contract boundary、
command/readback、failure/recovery、foundation reuse、UI anchor 和完整 `testContract`。P-U4 的 L2
至少要以“旧整页接管/错误 scope 深度/dirty switch”真实红断言验证；P-U2 要有“局部选择状态或
缺 selection task query”红断言；P-U3 要有“写 action 出现在 overview 或缺失于 management”红断言。
六类 package-exit denominator、22/25 逐行 disposition、ST-2/6/11 authority trace 与 non-empty
incremental receipt set 必须由 final design re-freeze 到 manifest；本稿不能替代该步骤。

## 14. 创建、编辑与状态表单事实矩阵修订（2026-07-29）

`FORM_MUTATION_DENOMINATOR=3 core form variants + 1 status confirmation`。原始业务来源是 R5
`D01-S02`（创建空间并录入编码、名称、运营管理后台标题、Logo 与备注）、`D01-S03`（修改展示资料、
备注与 Logo 绑定）、`D01-S04`（从详情改变启用状态）和 `D01-S05`（为既有空间初始化商业集团）。
本节覆盖 `IA02-PLATFORM-WORKSPACE-CREATE-DRAWER`、`...-INITIALIZE-DRAWER`、
`...-EDIT-DRAWER` 和 `...-STATUS-MODAL` 的字段事实；它不改变“名称链接→详情 Drawer→动作”的已接受
surface 次序，也不把全局空间选择器变成写入入口。

| variant / 业务事实 | 用户可见控件 | 分类 | request 取值与唯一来源 | 级联、约束与 owner 复核 | 失败/恢复 |
| --- | --- | --- | --- | --- | --- |
| 创建：集团空间编码 | “集团空间编码” Input | `EDITABLE`（仅创建） | 用户输入；`GroupWorkspaceCreateRequest.groupWorkspaceKey` | 创建成功后只读，不以名称/URL 替代；workspace owner 校验唯一性与格式 | 重复或格式失败保留输入并就地提示 |
| 创建：名称、运营管理后台标题、备注 | 三个业务输入 | `EDITABLE` | 用户输入 | 标题是运营用户认得的后台名称；owner 重验长度和资料边界 | owner 拒绝不关闭 Drawer |
| 创建：Logo | “集团空间 Logo”上传/预览 | `CONDITIONAL_EDITABLE` | **仅** platform-asset staging 成功返回的 `logoAssetRef + logoBindGrant`；页面只保留预览 | 没有 staging readback 不可创建；提交时 workspace owner 消费一次性 grant 并绑定资产 | `GAP-WORKSPACE-LOGO-STAGING-DISPOSITION`：当前 source 未给出取消或替换草稿资产的 release/disposition operation；implementation-facing contract 必须补 asset-owner 的明确处置，不能由浏览器静默删除或保留 |
| 创建：初始状态、版本、幂等 proof、Logo ref/grant | 不显示 | `HIDDEN_OWNER_FACT` | 状态由 workspace owner 设为 ENABLED；版本为 owner readback；idempotency 由提交生命周期生成；asset ref/grant 只由 staging readback 提供 | Header/body 同一 idempotency proof；不让用户编辑状态或 technical ref | 网络未知时先按 proof/readback 查询，不重放不同内容 |
| 初始化商业集团：目标空间 | “集团空间（只读）” | `FIXED_READONLY` | 详情 owner readback 的当前空间 | 仅尚未初始化时可打开；organization owner 再验空间与未初始化事实 | 已初始化/冲突回详情刷新 |
| 初始化商业集团：集团编码、集团名称 | 两个 Input | `EDITABLE` | 用户输入 | G-01 要求与空间编码/名称独立录入；不得复制空间字段 | owner 的唯一性/一次性初始化失败不关 Drawer |
| 编辑：空间编码 | “集团空间编码（只读）” | `FIXED_READONLY` | latest `GroupWorkspaceDetail.groupWorkspaceKey` | 不生成改编码 mutation | detail 过期时重读 |
| 编辑：名称、运营管理后台标题、备注 | 三个业务输入 | `EDITABLE` | latest detail 预填后用户修改 | owner 以 expectedVersion 重验；不从 shell/URL取值 | 冲突关闭草稿并回详情重读 |
| 编辑：Logo keep/remove/replace | “保留当前 Logo / 移除 Logo / 更换 Logo” | `CONDITIONAL_EDITABLE` | latest detail 决定 KEEP/REMOVE；REPLACE 仅接 staging `ref+grant` | 选 REPLACE 才显示上传；切 KEEP/REMOVE 清暂存 ref/grant；previous asset 只是 owner detail 事实、不得由浏览器解绑 | 新 asset staging 失败不能误保存 KEEP；资产处置沿上述 GAP 处理 |
| 编辑：版本、幂等 proof、Logo grant、旧资产引用 | 不显示 | `HIDDEN_OWNER_FACT` | latest detail / submission lifecycle / staging readback | `logoIntent` 与 ref/grant 必须成对合法；owner 原子重验版本、intent、grant 与绑定 | conflict 或 grant 被消费均重读详情后重新选择 |
| 状态确认：对象、目标状态、版本、proof | 标题中的空间名称与“启用/停用” | `HIDDEN_OWNER_FACT` | latest detail + 当前点击动作 + submission lifecycle | Modal 没有可编辑资料字段；owner 重验对象、版本和状态转换 | 冲突回详情；不宣称未有出处的业务后果 |

这四项所有值都必须有且只有一个来源；Logo asset ref、grant、版本、状态和 idempotency proof 均不是用户
可见业务字段。与早前“Logo 已选择”之类概述冲突时，以本矩阵为准。

本节的 command 计数与确认动作分母以
`doc/evidence/platform/rm1/p6/rm1-u09-form-command-variant-ledger.md` 的 C02–C04、S01 为准。

本 IA 中集团空间、可查看范围和任职的 searchable Select 使用同一 P6 `CandidateQuery` consumer protocol；
`subjectType` 与当前 entry/context dependencies 决定 adapter 路由到对应 owner task read。它不把集团空间、
任职或可查看范围混为同一 owner 数据，也不允许各控件直接定义自己的 query wire、分页或错误恢复。
