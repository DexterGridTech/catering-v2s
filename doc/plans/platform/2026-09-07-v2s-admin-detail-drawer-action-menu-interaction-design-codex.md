SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0

---
title: 双后台详情抽屉操作入口统一交互工件
status: ACTIVE_IMPLEMENTATION_AUTHORIZED
governanceRef: doc/platform/frontend-coding-standard.md §3-K-10
memoryRef: project-memory/practices/detail-drawer-action-menu.md
---

# 交互工件：双后台详情抽屉统一“操作”Popup Menu

本工件承接 Dexter 2026-09-07 的 UI 反馈：`platform-admin` 与 `operations-admin` 中，
所有已存在业务对象详情 Drawer 的 header action 不再平铺，统一只显示一个“操作”按钮，
点击后以 Popup Menu 展示该详情当前允许的动作。本批不新增 Journey、业务语义、权限、
HTTP operation、数据模型或 Drawer；只统一已有动作的呈现入口。

## 1. 工件元数据

```text
JOURNEY_DECISION=既有 R5/RM1/Catalog/Inventory 详情 Journey；本批不新增 Journey
BUSINESS_REQUIREMENT_SOURCE=Dexter 2026-09-07 浏览器反馈（平台角色详情 Drawer）
BUSINESS_PROBLEM=详情抽屉动作在不同后台和模块平铺方式不一致，动作过多时挤压详情标题区，用户无法形成稳定入口预期
BUSINESS_USER_OR_OWNER=运维管理人员、运营管理人员；各业务 owner 继续决定动作可用性和命令结果
CURRENT_TASK=把已有详情 Drawer 的 header action 收敛为单一“操作”入口，并保持每个原动作的语义与状态
SUCCESS_OUTCOME=用户打开任一适用详情 Drawer 时最多看到一个“操作”按钮；点击后可找到当前有权执行的原动作，动作执行路径与原实现一致
UI_BEARING=true
SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0
DEXTER_WIREFRAME_REVIEW=ACCEPTED_BY_DIRECT_FEEDBACK
DEXTER_HIFI_REVIEW=NOT_REQUIRED
CONSUMER_FACE=platform-admin;operations-admin
```

## 1.1 UI 详设强制标准

本批逐 screen 采用 `doc/platform/frontend-coding-standard.md` §3-K-10 与 §3-K-9。这里的
“详情 Drawer”严格指承载已存在业务对象详情的 Drawer；编辑/新建/配置 Drawer、Modal、
页面 Card 详情、列表行菜单、详情正文集合行动作和关闭按钮不进入动作分母。

每个适用 screen 的共同 contract 如下；业务字段和详情正文不变，仅 header action 入口变化：

```text
CONSUMER_FACE=platform-admin 或 operations-admin
UI_SURFACE=Drawer
HOST_AND_ENTRY=既有列表/主从页打开对应对象详情 Drawer；本批不改变路由和打开控件
ACTOR=当前后台中已获授权的运维管理人员或运营管理人员
BUSINESS_SCENARIO=用户已选定一个对象并需要查看详情、审计或执行该对象现有命令
BUSINESS_GOAL=在不离开详情上下文的情况下找到并执行当前允许的对象动作
USER_VISIBLE_COPY=原 Drawer 标题和正文保持不变；header 只显示“操作”；Popup Menu 保留原动作文案、顺序、危险标识、禁用状态和确认文案
TECHNICAL_BOUNDARY=动作可用条件仍由各 app 的读模型、权限和 owner 回调决定；foundation 不推导业务状态
FOUNDATION_PRIMITIVE=adminDrawerSurfaceProps 或 adminWideDrawerSurfaceProps（按原 Drawer）；useOverlayLock（按原 Drawer）；testId；新增 AdminDetailActionMenu
CONTAINER_LAYOUT=沿用原 Drawer 宽度与 adminDrawerSurfaceProps/adminWideDrawerSurfaceProps；header 操作区只保留一个按钮，菜单由 Ant Design Dropdown Popup 渲染；Drawer body 仍是原唯一滚动区，操作区不进入 body 滚动
```

### 1.1.1 Surface ownership 自检

本批没有新增 screen，所有下表 surface 都是既有详情 Drawer 的 header 改造。`ACTION_COUNT`
是原始逻辑动作槽位，不代表同时可见数量；条件动作按当前 read model/权限动态出现。

| screen id | consumer face | UI surface | header action 现状 | 本批结果 | surface owner |
|---|---|---|---|---|---|
| PLATFORM-OWNER-BINDING-DETAIL | platform-admin | Drawer | 编辑绑定、解除/删除绑定 | 单一操作菜单 | `OwnerBindingDetailDrawer.tsx` |
| PLATFORM-ORGANIZATION-OVERVIEW-DETAIL | platform-admin | Drawer | 无 header action | 保持无操作按钮 | `OrganizationOverviewDetailDrawer.tsx` |
| PLATFORM-CONTRACT-OVERVIEW-DETAIL | platform-admin | Drawer | 操作历史 | 单一操作菜单 | `ContractOverviewDetailDrawer.tsx` |
| PLATFORM-ADMINISTRATOR-DETAIL | platform-admin | Drawer | 操作历史、编辑、重置登录凭据、停用/启用 | 单一操作菜单 | `AdministratorDetailDrawer.tsx` |
| PLATFORM-INVITATION-DETAIL | platform-admin | Drawer | 操作历史、取消/重发 | 单一操作菜单 | `PlatformInvitationPanel.tsx` 内 `PlatformInvitationDetailDrawer` |
| PLATFORM-ROLE-DETAIL | platform-admin | Drawer | 操作历史、编辑、停用/启用、标记删除 | 单一操作菜单 | `RoleDetailDrawer.tsx` |
| PLATFORM-WORKSPACE-ACCOUNT-DETAIL | platform-admin | Drawer | 操作历史、重置登录凭据、停用/启用 | 单一操作菜单 | `WorkspaceAccountDetailDrawer.tsx` |
| PLATFORM-WORKSPACE-DETAIL | platform-admin | Drawer | 初始化商业集团、操作历史、编辑、停用/启用 | 单一操作菜单 | `WorkspaceDetailDrawer.tsx` |
| OPERATIONS-WORKSPACE-USER-DETAIL | operations-admin | Drawer | 操作历史 | 单一操作菜单 | `WorkspaceUserDetailDrawer.tsx` |
| OPERATIONS-WORKSPACE-INVITATION-DETAIL | operations-admin | Drawer | 操作历史、取消邀请、重新发送 | 单一操作菜单 | `WorkspaceInvitationDetailDrawer.tsx` |
| OPERATIONS-CONTRACT-DETAIL | operations-admin | Drawer | 操作历史、编辑、作废 | 单一操作菜单 | `ContractDetailDrawer.tsx` |
| OPERATIONS-INVENTORY-DETAIL | operations-admin | Drawer | 存量盘点、库存增加、人工调整、快捷配置 | 单一操作菜单 | `InventoryDetailDrawer.tsx` |
| OPERATIONS-STORE-DETAIL | operations-admin | Drawer | 操作历史、编辑、停用/启用 | 单一操作菜单 | `StoreDetailDrawer.tsx` |
| OPERATIONS-BUSINESS-CHANNEL-DETAIL | operations-admin | Drawer | 编辑、维护绑定、停用/恢复启用 | 单一操作菜单 | `BusinessChannelDetailDrawer.tsx` |
| OPERATIONS-BUSINESS-CHANNEL-TEMPLATE-DETAIL | operations-admin | Drawer | 编辑、停用/启用 | 单一操作菜单 | `BusinessChannelTemplateDetailDrawer.tsx` |
| OPERATIONS-BUSINESS-ENTITY-DETAIL | operations-admin | Drawer | 操作历史、编辑、经营品牌、停用/启用、标记删除 | 单一操作菜单 | `BusinessEntityDetailDrawer.tsx` |
| OPERATIONS-CATALOG-ITEM-VIEW-DETAIL | operations-admin | Drawer | 编辑、返回当前商品、检查转正式商品、更多中的动作 | 合并为单一操作菜单 | `CatalogItemViewDrawer.tsx` |
| OPERATIONS-STORE-PROFILE-CONTRACT-DETAIL | operations-admin | Drawer | 无 header action | 保持无操作按钮 | `FixedStoreContractDetailDrawer.tsx` |
| OPERATIONS-SALES-MENU-ITEM-DETAIL | operations-admin | Drawer | 无 header action | 保持无操作按钮 | `SalesMenuItemDetailDrawer.tsx` |

**完整分母结论**：19 个对象详情 Drawer；其中 16 个有 header action 需要改造（platform-admin
7 个、operations-admin 9 个），3 个无动作详情 Drawer 作为反例基线。
按动作槽位计，逻辑动作为 2 + 0 + 1 + 4 + 3 + 4 + 3 + 4 + 1 + 3 + 3 + 4 + 3 + 4 +
2 + 5 + 7 + 0 + 0 = 53；其中 Catalog 的“更多”与顶部动作合并，互斥状态不重复计为同时可见动作。

## 2. Interaction map

| 顺序 | 前提 | route / screen | 用户目的 | 可见信息与可操作项 | server/owner readback | 成功去向 | 失败/退出恢复 |
|---:|---|---|---|---|---|---|---|
| 1 | 已在既有列表中选定对象 | 任一适用详情 Drawer | 查看对象并决定是否操作 | header 仅显示“操作”（有动作时） | 详情 read model 与原 action availability | 点击“操作”打开 Popup Menu | 无动作或详情尚未 ready 时不显示按钮；关闭行为不变 |
| 2 | Popup Menu 已打开 | 当前详情 Drawer | 选择一个已有动作 | 原动作文案、顺序、disabled、danger 逐项保留 | app-local 权限/状态判断已在菜单项构造前完成 | 调用原 callback/command | 菜单关闭方式沿用 AntD；命令失败仍由原 Alert/message/readback 处理 |
| 3 | 选择需要确认的动作 | 当前详情 Drawer | 确认危险或不可逆动作 | 原 Popconfirm/确认面、原文案和取消出口 | owner 仍最终复核版本、权限和对象状态 | 原成功 readback/刷新路径 | 原错误映射、原 Drawer 关闭与恢复行为保持 |
| 4 | 动作正在提交 | 当前详情 Drawer | 避免重复操作 | 原 loading/disabled 语义保留在菜单项或触发器 | 原 submission lifecycle/async guard | 原成功 readback | 原失败提示与重试路径保持 |

## 3. 统一低保真线框

本批没有新业务 screen，因此不复制 19 份相同的业务详情正文线框；下面的 header 线框应用于
上表全部 16 个 action-bearing Drawer，正文严格由各 owning source 继续拥有。

### Screen: `DETAIL-DRAWER-ACTION-MENU`

```text
┌──────────────────────────────────────────────────────────────┐
│ × 业务对象详情                                [ 操作 ▾ ]     │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                    原有详情正文                              │
│                                                              │
└──────────────────────────────────────────────────────────────┘

点击“操作”后：

                         ┌──────────────────────────────┐
                         │ 原动作 1                     │
                         │ 原动作 2                     │
                         │ 危险动作                     │
                         └──────────────────────────────┘
```

```text
CONSUMER_FACE=platform-admin 或 operations-admin
UI_SURFACE=Drawer header action + Popup Menu
HOST_AND_ENTRY=对应对象详情 Drawer 已打开且详情 readback ready
ACTOR=运维管理人员或运营管理人员
BUSINESS_GOAL=用统一入口执行已有对象动作
USER_VISIBLE_COPY=操作；以及该 surface 原有动作文案
TECHNICAL_BOUNDARY=Popup 只负责展示与事件转发，不拥有业务状态
FOUNDATION_PRIMITIVE=AdminDetailActionMenu、原 Drawer surface、原 overlay lock、原 testId
CONTAINER_LAYOUT=Drawer header 保持固定；Popup 不改变 Drawer body 的唯一滚动容器；窄屏不增加横向滚动
```

### L2/自动化前控件 testId 清单

本批是 UI-bearing 变更，但不新增业务 L2 场景。先完成 UI/static proof，再允许调整既有
L2 binding；未完成浏览器行为验证前不把静态结果当作 L2 PASS。

| case/action | 实际控件 | UI owning source | `*TestIds.ts` 常量 | testId 实际挂载节点 | wrapper/native 区分 | L2 binding/touch | UI focused/static proof | 结论 |
|---|---|---|---|---|---|---|---|---|
| 打开详情动作菜单 | “操作” Button | 16 个 action-bearing Drawer | 对应 app 的 `platformDetailDrawerTestIds` / `operationsDetailDrawerTestIds`；Catalog 使用 `catalogTestIds` | foundation `AdminDetailActionMenu` 的 native Button | native Button | 先 static 更新 binding，再按授权浏览器验证 | foundation test + 两 app typecheck | `DESIGN_ONLY_UNTIL_PROOF` |
| 选择原有动作 | Popup Menu item | 对应 Drawer owning source | 原 action ID 从 app `*TestIds.ts` 传入 label/anchor | Ant Design Menu item 的可点击 label anchor；不使用文本/role 代替 | AntD Menu item + app-owned label anchor | 每个既有 L2 action 先打开“操作”再点击 item | source/static 检查每个 item | `DESIGN_ONLY_UNTIL_PROOF` |
| 取消/确认危险动作 | 原确认面 | 各 action owner | 原 action/confirm IDs | 原 Popconfirm/Modal native action | 原形态保留 | 不在本批新增 locator | 原 source 对账 | `UNCHANGED_BEHAVIOR` |

复合菜单项的 testId 只在 Ant Design 菜单 option 无法暴露 option-level `data-*` 时挂在
真实可点击 label anchor，并在 implementation proof 中记录该例外；Button、Input 和
确认面仍必须标真实 native 节点。

## 4. v2 对应页面盘点

本批不重新搬运 all-v2 runtime，也不新增页面。既有 surface 的 carry-over 基线沿用
`doc/plans/platform/2026-07-26-v2s-r5-revised-carryover-execution-inventory.md` 的
各 app route/source 记录；本次只是对当前 v2s 已实现 Drawer header 的一致性质量修复。
Dexter 已通过当前浏览器反馈直接指定统一入口，视觉副本不另造；等价静态基线为本工件线框、
当前 19 个 owning source 和仓内既有 `Dropdown menu={{items}}` 正例。不得把 all-v2 代码作为
runtime/build 依赖。

| screen group | 对应关系 | all-v2 基线 | 静态基线 | 差异及原因 |
|---|---|---|---|---|
| 19 个既有详情 Drawer | `PARTIAL_COUNTERPART` / 既有 v2s surface | 既有 carry-over inventory 中对应 app source 的 path@SHA-256 | `DEXTER_WAIVED_2026-09-07；等价证据：本工件统一 header 线框 + 当前 owning source` | 新增的是跨模块一致性呈现规则；业务字段、路由、Journey 和正文不变 |

## 5. 行为、状态与边界

| 状态 | header | Popup Menu | 原语义 |
|---|---|---|---|
| 详情未 ready / 只有 loading | 不显示“操作” | 不存在 | 不允许用不完整 readback 推导动作 |
| 详情 ready 且动作列表非空 | 只显示一个“操作” | 显示当前条件允许动作 | 逐项沿用原条件和顺序 |
| 详情 ready 但无动作 | 不显示“操作” | 不存在 | 19 个分母中的 3 个无动作 Drawer 保持此状态 |
| 某动作 disabled | “操作”可打开，菜单项 disabled | 不可触发 | 不能把 disabled 动作误删为权限缺失 |
| 某动作 danger | “操作”本身不设 danger | 菜单项 danger | 危险动作仍有原确认面 |
| action submitting | 触发器或对应菜单项按原 owner 状态 disabled/loading | 禁止重复触发 | 原 submission/读回路径不变 |
| action failed | 菜单展示机制不吞错误 | 关闭或保持由 AntD/原命令决定 | 原 Alert/message/retry/readback 不改写 |

## 6. 交付判据

```text
DETAIL_DRAWER_ACTION_MENU=PASS 仅当：
1. 19 个详情 Drawer roster 与当前源码一致，3 个无动作 Drawer 没有伪造空操作按钮；
2. 16 个 action-bearing Drawer header 只消费一个 AdminDetailActionMenu；
3. 每个原动作都仍以 app `*TestIds.ts` 唯一源提供稳定身份，条件、顺序、danger、确认、loading 和 callback 未丢；
4. foundation 组件没有业务权限、业务文案或 command 逻辑；
5. foundation focused/static、两 app typecheck/build 通过；
6. 目标详情 Drawer 的浏览器点击“操作”与菜单项行为通过后，才能把用户行为交付标记为 PASS。
```

### Dexter 看图结论

- 看图日期：2026-09-07
- 低保真线框结论：`ACCEPTED_BY_DIRECT_FEEDBACK`
- 高保真 demo 结论：`NOT_REQUIRED`
- 允许进入 implementation-facing design：是；范围仅为既有详情 Drawer header action 的统一呈现。
