SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0

# 双后台详情抽屉“操作”Popup Menu 整改实施详设与计划

## 0 · 元数据与授权边界

```text
BUSINESS_SOURCE=doc/plans/platform/2026-09-07-v2s-admin-detail-drawer-action-menu-interaction-design-codex.md
JOURNEY_REFS=既有平台治理、组织/合同、用户/邀请、渠道、库存、目录与销售菜单详情 Journey；不新增 Journey
IA_REF=doc/decisions/2026-07-29-v2s-rm1-ia-03-platform-governance-and-self-service-interaction.md;doc/decisions/2026-07-29-v2s-rm1-ia-04-operations-organization-and-contract-interaction.md;doc/decisions/2026-07-29-v2s-rm1-ia-05-operations-users-recovery-and-home-interaction.md
INTERACTION_REF=doc/plans/platform/2026-09-07-v2s-admin-detail-drawer-action-menu-interaction-design-codex.md
AUTHORIZED=修改 libraries/frontend/admin-ui-foundation、apps/frontend/platform-admin、apps/frontend/operations-admin 的详情 Drawer header action 展示；补充 app-owned *TestIds.ts、focused/static proof 和与本批 UI 直接相关的既有 L2 locator 适配
NOT_AUTHORIZED=后端/契约/generated API/迁移/seed/reset/DEV/Testcontainers/UAT/部署/切流/新增业务动作/新增权限/数据模型/Git；不改变 Drawer 正文与现有命令语义
IMPLEMENTATION_AUTHORITY=true（Dexter 2026-09-07 直接授权）
```

## 1 · 真实业务目标与方案比较

### 1.1 结构性问题

同一类“打开对象详情后执行动作”的用户任务在两个后台由多个平铺 Button、局部“更多”
Dropdown 和嵌套命令组件表达。动作一多，Drawer header 的空间、顺序和入口认知不稳定；
只改截图中的角色 Drawer 会把同一业务任务的差异继续留在其他模块。若每个 feature 自己
包一层 Dropdown，还会复制菜单触发、Popup 行为、trigger testId 和后续状态处理，新的
动作将继续产生分叉。

### 1.2 方案比较

| 方案 | 结果 | 结论 |
|---|---|---|
| A. 保持平铺，只调整间距或自动换行 | 不能解决入口不一致；动作仍随模块增长挤压 header | 拒绝，因为改变布局不能关闭结构性分母 |
| B. 每个 app/feature 各自新建 Dropdown wrapper | 可暂时收敛截图，但会复制触发器、菜单展示和 testId 处理，两个后台长期漂移 | 拒绝，因为违反 foundation 优先和 DRY |
| C. foundation 提供无业务含义的 `AdminDetailActionMenu`，app 传入原动作项 | 一个展示机制覆盖 16 个 action-bearing Drawer；业务条件、危险、确认、回调、错误仍由 app 保留 | **采用** |

我选了 C 而不是 A/B，因为只有共享 foundation 能同时收敛两个后台的展示机制，且不会把
业务 owner 事实搬进共享组件；A 只修视觉表象，B 会复制同一行为。

## 2 · 完整问题分母与变更范围

### 2.1 详情 Drawer 全集

对象详情 Drawer 全集为 19 个：platform-admin 8 个、operations-admin 11 个。按 header
action 分母，16 个有动作、3 个无动作；无动作面必须保持没有空“操作”按钮。

| face | owning source | header action 分母 | 本批处置 |
|---|---|---|---|
| platform-admin | `features/external-collaboration/ui/OwnerBindingDetailDrawer.tsx` | 编辑绑定；申请解除授权/删除绑定 | 接入菜单 |
| platform-admin | `features/organization-contract-overview/ui/OrganizationOverviewDetailDrawer.tsx` | 0 | 明确 N/A，不渲染空入口 |
| platform-admin | `features/organization-contract-overview/ui/ContractOverviewDetailDrawer.tsx` | 操作历史 | 接入菜单 |
| platform-admin | `features/platform-administration/ui/AdministratorDetailDrawer.tsx` | 操作历史；编辑；重置登录凭据；停用/启用 | 接入菜单 |
| platform-admin | `features/workspace-iam/ui/PlatformInvitationPanel.tsx#PlatformInvitationDetailDrawer` | 操作历史；取消/重发 | 接入菜单，保留确认和 readback |
| platform-admin | `features/workspace-iam/ui/RoleDetailDrawer.tsx` | 操作历史；编辑；停用/启用；标记删除 | 接入菜单 |
| platform-admin | `features/workspace-iam/ui/WorkspaceAccountDetailDrawer.tsx` | 操作历史；重置登录凭据；停用/启用 | 接入菜单；正文撤销任职不纳入 |
| platform-admin | `features/workspace-management/ui/WorkspaceDetailDrawer.tsx` | 初始化商业集团；操作历史；编辑；停用/启用 | 接入菜单 |
| operations-admin | `features/workspace-user/ui/WorkspaceUserDetailDrawer.tsx` | 操作历史 | 接入菜单；正文撤销任职不纳入 |
| operations-admin | `features/workspace-user/ui/WorkspaceInvitationDetailDrawer.tsx` | 操作历史；取消邀请；重新发送 | 接入菜单；正文复制链接不纳入 |
| operations-admin | `features/contract-management/ui/ContractDetailDrawer.tsx` | 操作历史；编辑；作废 | 接入菜单 |
| operations-admin | `features/inventory-management/ui/InventoryDetailDrawer.tsx` | 存量盘点；库存增加；人工调整；快捷配置 | 接入菜单，action Drawer/modal 保持独立 |
| operations-admin | `features/store-management/ui/StoreDetailDrawer.tsx` | 操作历史；编辑；停用/启用 | 接入菜单 |
| operations-admin | `features/business-channel/ui/BusinessChannelDetailDrawer.tsx` | 编辑；维护绑定；停用/恢复启用 | 接入菜单 |
| operations-admin | `features/business-channel/ui/BusinessChannelTemplateDetailDrawer.tsx` | 编辑；停用/启用 | 接入菜单 |
| operations-admin | `features/business-entity-management/ui/BusinessEntityDetailDrawer.tsx` | 操作历史；编辑；经营品牌；停用/启用；标记删除 | 接入菜单 |
| operations-admin | `features/catalog-management/ui/CatalogItemViewDrawer.tsx` | 编辑；返回当前商品；检查转正式商品；启用/停用/标记删除/复制 | 合并现有顶部动作与“更多”菜单 |
| operations-admin | `features/store-profile/ui/FixedStoreContractDetailDrawer.tsx` | 0 | 明确 N/A，只读详情 |
| operations-admin | `features/sales-menu/ui/SalesMenuItemDetailDrawer.tsx` | 0 | 明确 N/A，只读详情 |

### 2.2 排除分母

下列命中 `<Drawer>` 或 `extra` 的面不是对象详情 header action，不得被本批误改：

| 排除族 | 当前代表 | 理由 |
|---|---|---|
| 新建/编辑/配置 Drawer | `WorkspaceCreateDrawer`、`RoleEditDrawer`、`SalesMenuItemEditorDrawer`、`CatalogConfigurationDrawerSurface` | 表单 footer/生命周期，不是已存在对象详情 header |
| action Modal/Drawer | `InventoryActionModal`、`CommercialGroupInitializationDrawer` | 从详情动作打开的第二层业务表单，保持原独立生命周期 |
| 页面 Card 详情 | `ProviderProfileDetail`、`ExternalSystemDetail` | 不是 Drawer，不受本条 Drawer header 规则约束 |
| 列表行菜单 | `SalesMenuPage`、`SalesMenuManagerDrawer`、Catalog workbench list | 作用域是行/列表集合，不是详情 Drawer header |
| Drawer 正文集合动作 | 任职撤销、复制链接、正文内资源操作 | 动作针对集合行或正文内容，不能移进详情 header 菜单 |
| Drawer 关闭按钮 | Ant Design Drawer close | 生命周期出口，不是业务 action |

### 2.3 业务动作保持分母

实现前后必须逐项保持以下 facts：动作顺序、可见条件、权限/状态条件、文案、danger、
confirmation、loading/disabled、原 callback/command、原错误/成功 readback。共享组件只
消费已经构造好的 menu items，不读取任何业务类型。

## 3 · CP 总览（严格按序）

| CP | 主题 | owner | 主要输出 | 依赖 |
|---|---|---|---|---|
| CP-01 | 规范、分母、TestIds 唯一源 | 主 agent | 本交互工件、本详设、两 app detail Drawer TestIds | 已读取 IA、frontend standard、memory、owning source |
| CP-02 | foundation 展示原语 | 主 agent | `AdminDetailActionMenu`、export、focused test | CP-01 |
| CP-03 | platform-admin 接入 | 主 agent | 7 个 action-bearing Drawer 改造 + invitation adapter | CP-02；逐文件静态 proof |
| CP-04 | operations-admin 接入 | 主 agent | 9 个 action-bearing Drawer 改造 + Catalog 合并 | CP-03；逐文件静态 proof |
| CP-05 | L2/UI source 适配与验证 | 主 agent | 既有 locator 适配、static/typecheck/focused/browser evidence | CP-04；不新增业务场景 |
| CP-06 | 交付回读 | 主 agent | 同一分母回读、交付证据、未证明边界 | CP-05 |

每一项 CP 完成后，主 agent 用同一组 IA/interaction/frontend standard/memory/owning source
做前后双读；未通过的项不得进入下一项。没有独立子 agent 工具可用时，不伪造独立 review；
最终 Claude review 仍是外部独立审查，不由本计划替代。

## 4 · 横切机制对照表

| 机制 | ① 现成能力/规范 | ② 如何验证 | ③ 无现成时的形态 | ④ 本批适用全集 |
|---|---|---|---|---|
| 读侧节点授权 | 各 Drawer 当前 detail readback 与 app action policy | 静态检查菜单构造仍以原 `role/admin/channel/selected/current` 为前提 | 不新增授权推导 | 16 个 action-bearing Drawer |
| 写授权与 grant 复核 | 原 app callback/command 与 owner policy | 类型检查 + source diff 检查回调调用点不变 | foundation 不接业务授权 | 所有菜单项 |
| 跨 owner 写与事务 | N/A：本批不改业务写路径 | 无 backend/HTTP diff；确认 consumer 仍调用原函数 | N/A | 19 个 Drawer |
| 集合形态与分页 | N/A：本批不改集合读模型 | 不改 query、Table、分页和正文 | N/A | 19 个 Drawer |
| 缓存失效 / 改完刷新什么 | 原 `onChanged`、RTK refetch、refresh signal、readback | source 对照 callback/command 和 `onChanged` 仍在同一项 | 不新增缓存机制 | 16 个 Drawer |
| RTK 数据读取与加载判定 | frontend standard §3-B；现有 `detailReady/current/selected` | 静态检查 trigger 只在原 ready 条件下渲染，组件不引入 query | N/A | 所有动态详情 Drawer |
| 同一事实只有一个住址 | frontend standard §3-E | 菜单项只引用现有状态，不复制到 foundation state | N/A | 业务 action availability |
| 失败可见且原因不得改写 | frontend standard §3-D；各 app problem/Alert/message | 静态检查无 catch、无 fallback、无错误文案改写 | N/A | 原 command/action |
| owner 错误到 HTTP 映射 | N/A：不改 command/edge | 无后端变更；只验证 callback unchanged | N/A | 16 个 Drawer |
| 幂等键构成与重放 | 原 command 内已有 idempotency；本批不触碰 | `rg`/source review 确认 invitation/catalog/inventory command body unchanged | N/A | Invitation/Catalog/Inventory |
| 生成物不得手搓字符串 | `*TestIds.ts` app source；Catalog existing vocabulary | new IDs only in app TestIds; UI consumers import them | N/A | trigger + action IDs |
| 日志落点与脱敏 | AGENTS.md observability hard constraint | no new payload/logging; action command paths unchanged | N/A | all actions |
| 迁移回填与可逆性 | N/A：纯前端展示整改 | no migration/seed files in change surface | N/A | 全批 |
| 前端共享行为 | `adminDrawerSurfaceProps`、`useOverlayLock`、新增 `AdminDetailActionMenu` | foundation focused test + app typecheck | 新原语仅负责 Dropdown/Button 展示 | 16 个 Drawer |
| 候选/下拉数据源 | N/A：动作菜单不是业务候选 | items 由 app 当前 readback 条件构造 | N/A | 所有菜单 |
| 编码与名称呈现 | 原 app action labels；用户可见语言标准 | text diff 对照原文案 | N/A | 53 个逻辑 action slots |
| 同时坏的东西是否原子组 | all action-bearing Drawer + foundation | CP-02～04 不单独交付，全部 static/typecheck 通过后才验收 | N/A | CP-02/03/04 |

## 3a · L2 脚本开发前 UI/testId 前置复核

本批确实是 UI-bearing；先完成 UI/static proof，再改既有 L2 locator。不存在新的业务
operation 或新场景，禁止借此新增 L2 case。

```text
UI_DESIGN_REVIEW=PASS_BY_INTERACTION_ARTIFACT_AND_SOURCE_ROSTER
TESTID_REVIEW=OPEN_UNTIL_APP_TESTIDS_AND_REAL_MENU_ANCHORS_REVIEWED
L2_SCRIPT_ADMISSION=BLOCKED_UNTIL_CP-05
```

| case/action | 控件 | owning source | `*TestIds.ts` | 实际节点 | L2 binding/touch | focused/static proof | fresh 独立复核 | 结论 |
|---|---|---|---|---|---|---|---|---|
| 每个 16 个详情 Drawer 打开菜单 | “操作” Button | 对应 detail Drawer | `platformDetailDrawerTestIds` / `operationsDetailDrawerTestIds`；Catalog `catalogTestIds` | foundation native Button | 既有 case 先 click trigger | foundation markup/test + app typecheck | CP-06/Claude review | OPEN |
| 每个既有 header action | Popup Menu item | 对应 detail Drawer | 原动作 ID 由 app TestIds 提供 | AntD item 的真实 label anchor；不得以文本 locator 替代 | 先打开菜单再消费 ID | source/static + focused | CP-06/Claude review | OPEN |
| 危险动作确认 | 原 Popconfirm/Modal | action owner | 原 confirm IDs | native confirm action | 保持既有 binding | source/static | CP-06/Claude review | UNCHANGED |

## 4 · 每个 CP 的门控

### CP-01

- 可证伪失败条件：`rg` 仍能在 16 个 action-bearing Drawer 的 header `extra` 中找到两个
  或以上业务 Button，或新增动作 ID 仍散写在 owning source 而不在 app `*TestIds.ts`。
- 不变量：19 个 Drawer roster 与 source 一致；3 个无动作面没有空菜单；现有动作 53 个
  逻辑槽位逐项可追溯。
- FORBID：不改后端、不改业务条件、不删除旧 ID、不写 L2 fallback。
- 比例验证：静态 `rg` + source review；不启动 DEV、不跑 L2。
- 形态理由：先完整分母再改代码，避免把 screenshot-only 修复误当全仓修复。
- RECALL：`project-memory/practices/detail-drawer-action-menu.md`、frontend standard §3-K-9/10、
  两份 interaction IA、16 个 owning source、仓内 Dropdown 正例。

### CP-02

- 可证伪失败条件：foundation 原语不能渲染唯一“操作” Button、不能把 items 交给 AntD Popup，
  或组件读取/判断业务字段。
- 不变量：API 只接 `items`、`triggerTestId`、可选 `disabled`；使用 AntD `Dropdown`/`Button`；
  `triggerTestId` 挂在 native Button；不新增 app-local Dropdown wrapper。
- FORBID：通用 fixture DSL、业务 action registry、权限判断、错误处理、额外主题层。
- 比例验证：foundation focused test、typecheck、render/static inspection。
- 形态理由：一个展示原语足够，避免为 53 个动作槽位引入新领域抽象。
- RECALL：`admin-ui-foundation/src/index.ts`、`overlay/drawerSurface.ts`、`automation/testId.ts`、
  `CatalogWorkbenchItemList.tsx` 与 `SalesMenuManagerDrawer.tsx` Dropdown 正例。

### CP-03

- 可证伪失败条件：任一 platform detail Drawer header 仍平铺多个 Button，或 invitation 的
  Popconfirm/readback/busy 语义丢失。
- 不变量：7 个 platform action-bearing Drawer 的业务动作条件和 callback 逐项不变；无动作
  OrganizationOverview 仍不显示操作。
- FORBID：把 action policy 下沉 foundation；把 invitation confirmation 改成无确认的 menu click；
  改 route/HTTP/owner。
- 比例验证：按文件 focused source diff + platform typecheck；不先跑全量。
- 形态理由：platform 先接入可形成共享组件的第一批正例，便于 operations 按同一 API 接入。
- RECALL：CP-01 清单、每个 platform Drawer owning source、`PlatformInvitationPanel` command。

### CP-04

- 可证伪失败条件：任一 operations detail Drawer header 仍有多个业务入口，或 Catalog 仍同时
  保留顶部 Button 和“更多” Dropdown。
- 不变量：9 个 operations action-bearing Drawer 统一使用 foundation；Inventory 的 action
  Drawer、Catalog 的 promotion/status/copy/lifecycle 行为保持原 callback/confirmation；三无动作面不变。
- FORBID：把正文集合动作塞入 header；更改业务文案/权限/数据源；新增第二套菜单组件。
- 比例验证：按文件 focused source diff + operations typecheck；Catalog item TestIds 同步 static review。
- 形态理由：operations 的 Catalog 已有成熟 Dropdown 正例，直接把现有 items 合并入 foundation consumer，
  不重建菜单项语义。
- RECALL：CP-01 清单、operations 9 个 owning source、catalogTestIds、InventoryActionModal、existing Dropdown。

### CP-05

- 可证伪失败条件：既有 L2 直接点击原 action ID 却未先打开“操作”菜单，或静态 binding 消费了散写 ID。
- 不变量：每个受影响 L2 case/action 的触点仍是 `*TestIds.ts` 常量和真实菜单项 anchor；没有 role/text/label/index/CSS/XPath fallback。
- FORBID：扩大 L2 场景、修改业务 oracle、延长 timeout、用宽 locator 止血；不以 typecheck 冒充浏览器行为。
- 比例验证：先静态/focused，再按授权运行受影响 focused case；不先跑全仓。
- 形态理由：菜单变化属于 UI locator 适配，不需要重写业务场景；只有真实点击验证后才可交付用户行为。
- RECALL：frontend standard §3-K-9、交互工件 testId 表、受影响 L2 spec、runner locator helper。

### CP-06

- 可证伪失败条件：同一 roster 回读发现任一 action-bearing Drawer 仍有 flat header action、旧动作缺失或无动作面出现空入口。
- 不变量：19/19 roster 完整；16/16 action-bearing 使用同一 foundation；静态、typecheck/focused 和目标 browser proof 分开报告。
- FORBID：把历史绿色 run 当作整改后证明；把静态 markup 当作焦点/Popup/确认行为证明；不做 backend/seed/DEV/UAT 扩展。
- 比例验证：同一分母的静态回读 + targeted browser proof；按风险不做无关全批运行。
- 形态理由：用户要求交付双后台一致行为，最终判据必须覆盖双 app，而不是只看角色截图。
- RECALL：本详设 §2、interaction artifact §6、frontend standard §3-K-10、所有变更文件和验证输出。

## 5 · operation / path / face / 集合形态

| 业务意图 | operationId | method/path | consumer face | 集合形态 | 预期规模与增长驱动 |
|---|---|---|---|---|---|
| 详情动作入口统一 | N/A | N/A | platform-admin / operations-admin | N/A；不改 read/write 集合 | 动作数量随既有 feature 增长；本批只统一展示入口 |

本批不改变 `x-consumer-faces`、operationId、HTTP path 或 generated wire。

## 6 · 跨 owner 写矩阵

| policy | 第一个 owner command | 第二个 owner command | 事务 | 失败时的回滚事实 |
|---|---|---|---|---|
| N/A：纯前端展示整改 | 原 app callback/command | N/A | N/A；foundation 不发请求 | 原 action owner 的 readback/错误/事务保持不变 |

## 7 · 声明—传递—消费矩阵

| fact | declaration | transfer | consumption | proof |
|---|---|---|---|---|
| 详情动作可见条件 | 原 Drawer 当前 readback + policy | app 内构造 action items | Popup 只展示已构造 items | source diff/typecheck |
| 动作语义 | 原 Button label/onClick/confirmation | app action item `label/onClick/danger/disabled` | Menu item click 调原 callback | per-file focused/static |
| 操作入口 | 交互工件 §1.1 | `triggerTestId` 传 foundation | native “操作” Button | foundation focused test |
| TestId 唯一源 | 两 app `*TestIds.ts` / Catalog `catalogTestIds` | consumer import | Button 与 Menu anchor | static `rg` + component render |
| 缓存失效 | 原 command/readback contract | callback/command unchanged | 原 query refresh/readback | source diff |
| 错误映射 | 原 typed problem/message | callback/command unchanged | 原 Alert/message | source diff；browser targeted |
| 日志与脱敏 | 原 command/logging boundary | no new payload | no new logging | no backend surface change |

## 8 · 业务规则 → owner 判定点

本批不新增规则；以下是必须保留的既有判定点：

| 规则编号 | owner 判定点 |
|---|---|
| A-01 | 当前详情 readback ready 才产生动作列表 |
| A-02 | 原 app 权限与状态 policy 决定菜单项是否存在/disabled |
| A-03 | 原 command 负责版本、权限、状态最终复核 |
| A-04 | 原 danger/confirmation 负责不可逆操作保护 |
| A-05 | 原 submission/readback/refresh 负责成功和失败后的事实 |
| A-06 | 无动作详情不渲染空“操作”入口 |

## 9 · owner API 与消费者清单

| owner 方法 | 谁调用 |
|---|---|
| `AdminDetailActionMenu` | 16 个 action-bearing Drawer 的 app consumer；foundation 不调用业务 API |
| platform 既有 `onAudit/onEdit/onStatus/onOpenAction/onChanged` 等 callback | 原各 platform Drawer；只改变 Button → item 的传递形态 |
| operations 既有 `onAudit/onEdit/onInvalidate/onRequestAction/openAction/transition/markItemDeleted` 等 callback | 原各 operations Drawer；只改变 Button → item 的传递形态 |

## 9a · 实施前全链同步变更清单

| 变更事实 | 契约 / 唯一生成源 / 生成物 | 后端 owner / edge / migration | 前端 model / surface / state | focused / static / HTTP / L2 测试 | fixture / seed / executor | 结论 |
|---|---|---|---|---|---|---|
| 详情 header 展示从 flat actions 变单一 Popup Menu | N/A：纯 UI presentation；不改 contract/generated | N/A：不改 backend | foundation `detailActionMenu.tsx`/index/test；16 个 Drawer consumer | foundation focused/static；受影响既有 L2 仅做 locator 适配，browser proof 后置 | N/A：无业务事实/seed 形状变化 | 前端同步修改 |
| action TestId 唯一源 | 各 app 新/现有 `*TestIds.ts`；Catalog `catalogTestIds.ts` | N/A | app testId modules + consumers | static exact source check；不新增业务场景 | N/A | 前端同步修改 |
| invitation confirmation/readback | N/A：既有 command | N/A | `PlatformInvitationPanel.tsx` menu adapter | focused/source proof；不改 request | N/A | callback shape only |
| Catalog “更多”与顶部动作合并 | N/A | N/A | `CatalogItemViewDrawer.tsx` + `catalogTestIds.ts` | focused/source proof；现有 Catalog L2 需先打开 action menu | N/A | 前端同步修改 |

## 9b · 变更定位

所有定位使用唯一语义锚点，不依赖行号：

- foundation：`src/overlay/detailActionMenu.tsx`、`src/index.ts`、`src/overlay/detailActionMenu.test.tsx`。
- platform consumers：每个文件的 `<Drawer ... extra={...}>` header action block；邀请面为
  `InvitationCommands`/`PlatformInvitationDetailDrawer` 组合。
- operations consumers：每个文件的 `<Drawer ... extra={...}>` header action block；Catalog 为
  `moreActions` 与同一 Drawer `extra` 的合并。
- IDs：新增 app-level `platformDetailDrawerTestIds.ts`、`operationsDetailDrawerTestIds.ts`；
  Catalog 扩充 `catalogTestIds` 的 view/static vocabulary。

## 10 · 数据迁移与 seed

| 迁移 | 加/改什么 | 旧行回填 | 可回滚 |
|---|---|---|---|
| N/A | 纯前端展示；不改变业务事实、数据库或 contract | N/A | N/A |

`10b seed`：N/A_WITH_REASON：本批不新增/调整业务对象、状态、字段或 operation；reset/seed/DEV
不授权、不执行。

## 11 · 验收场景设计

本批不新增 backend acceptance scenario 或 operation。验收围绕既有 UI behavior：

| scenario id | owner 文件 | identity | fixture | request | businessOracle |
|---|---|---|---|---|---|
| DETAIL-DRAWER-ACTION-MENU-PLATFORM | 各 platform detail Drawer | 详情对象现有 identity | 既有 app readback | 既有 action callback/command | header 只有“操作”；菜单保留原允许动作和 danger/disabled |
| DETAIL-DRAWER-ACTION-MENU-OPERATIONS | 各 operations detail Drawer | 详情对象现有 identity | 既有 app readback | 既有 action callback/command | header 只有“操作”；Catalog 顶部与更多动作无丢失/重复 |

这不是新的 backend scenario；不以 HTTP status 或 response.ok 判定 UI 交付。

## 12 · 实施顺序与停止条件

1. CP-01：先新增/更新文档和 app TestIds 唯一源，静态核对 19/19 roster。
2. CP-02：新增并 export `AdminDetailActionMenu`，写 focused test；通过后才进入 consumer。
3. CP-03：按文件顺序完成 platform-admin 7 个 action-bearing Drawer；每个文件做前后双读和静态检查。
4. CP-04：按文件顺序完成 operations-admin 9 个 action-bearing Drawer；先保留正文动作和 action Drawer。
5. CP-05：只在所有 UI consumer static/typecheck 通过后适配既有 L2 locator；不得新增 case。
6. CP-06：targeted browser proof（若运行环境与授权可用）后，重新读取同一 19 面分母并形成交付证据。

任一 CP 出现同一失败族第二次，停止继续业务推进，回到该族的完整同根扫描；禁止增加 timeout、
fallback、放宽断言、手改 generated 或复制第二个 Dropdown wrapper。

## 13 · 未证明边界

- 后端 owner、contract、数据库、seed、reset、DEV 和 UAT 均不在本批证明范围。
- foundation static/focused proof 不能代替 Popup 在真实浏览器中的打开、点击、焦点归还和确认行为。
- 没有 fresh browser evidence 前，只能报告 `IMPLEMENTED_STATICALLY`，不能把 UI 行为标记为完整交付。
