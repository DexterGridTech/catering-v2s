# TER screenPart 机型解析 · IA 详设

`SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0`

## 1. 元数据

```text
IA_SCOPE=IA-01..IA-06
BUSINESS_SOURCE=doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-requirements-claude.md
JOURNEY_REFS=doc/plans/platform/2026-09-11-v2s-terminal-admin-console-ui-interaction-design-codex.md
UI_INTERACTION_REF=doc/plans/platform/2026-09-11-v2s-terminal-admin-console-ui-interaction-design-codex.md
IMPLEMENTATION_DESIGN_REF=doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-implementation-design-codex.md
DEXTER_WIREFRAME_REVIEW=沿用既有 interaction 工件；本次 Dexter 直接授权不新增 wireframe gate
IMPLEMENTATION_AUTHORITY=true（Dexter 当前任务直接授权；仅限既定详设/计划范围）
IA_STATUS=READY_FOR_IMPLEMENTATION_BY_DEXTER_AUTHORIZATION
```

本 IA 是 implementation-facing 详设的 UI-bearing companion。它不替代既有 interaction artifact：interaction artifact 负责已接受的入口、可见任务和基础动作；本 IA 补充机型分支、不可见状态/数据来源/规模、a11y/focus、错误和容器在负载下的行为。本轮未执行 L2、设备、Web、Android 或视觉验证。

## 2. 共同事实（与 implementation design §12.7 逐字一致）

以下事实是 IA 与详设的共享规范；任何实现不能在两份文档之间自行选择另一种形态。

- `SURFACE_FORMS=laptop|mobile`。
- `ADMIN_SECTION_CONTAINER_KEY=admin.sections`。
- `ADMIN_CONSOLE_PART_KEY=admin.console`。
- laptop：根为 `PrimitiveContainer layout="fill"`，RN style 明确 `flex:1,width:'100%'`；内容父节点 `flexDirection:'row'`，左侧 section list、右侧 detail；header 只保留标题/关闭；display-context 成为一个 section。导航使用 list/listitem 或 button 语义，初次 focus 落在当前 section，详情 heading 在选择后获得可读焦点；关闭/返回恢复进入 admin 前的 focus scope。
- mobile：根同样 fill；`PrimitiveGrid` 现有 `flex-row flex-wrap` 作为分区条，下面只有一个 content frame 和一个纵向 scroll owner；当前冻结分区集合在 360×640 下入口均可见、可点、未裁剪，选中态可辨识。使用 tablist/tab 语义；不新增横向滚动或 `BackHandler` 备选路径。
- LayerStack 去除全屏内容的 `alignItems:'center'`、`justifyContent:'center'`、`padding:24`；遮罩/决定性 layer 语义不改。9 个 card 调用点/8 个组件分别移除统一 bounded 留白或改由自身 card content 负责；content 层和四个 section 的 bounded 也逐项处理，不能只改 root。
- 只使用 primitives 已有 token 或 RN style；不在 admin-shell/render 新增 tailwind utility，不添加新 token。
- `useAdminSections` 放在 admin-shell `src/hooks/`，一个文件一个 hook；返回 `sections`、`selectedPartKey`、`selectedSection`、`selectSection`，不读取/分支 `surfaceForm`。selected 回落由 laptop/mobile component 根据它各自收到的 section 集合决定，登录态仍归 `AdminLayer` 本地。

## 3. IA-ID 与可见信息架构

### IA-01 · laptop admin console master-detail

```text
businessTask=终端操作员在不离开业务画布的情况下查看只读诊断，并能回到进入前的业务焦点
actorAndScenario=终端操作员已通过本次打开的本地动态口令，admin layer 已挂载
entryAndSurface=AdminLauncher 的既有隐藏入口 → admin.console layer；laptop 目标物理表面全屏 surface
controlType=左侧 section list 的 button/listitem；右侧只读 detail；顶部标题与关闭 button；无编辑控件
validationAndError=section 不可用显示既有空态；content failure 在容器内显示页面找不到、partKey/form 定位码；system failure 仅目标 PRIMARY 显示既有启动/运行期失败页
accessibilityAndTestId=list/listitem 或 button 语义；当前 section 有 selected/label；初次 focus 当前 section，选择后 focus detail heading，关闭/返回恢复 admin 前 focus scope；testID 由 adminTestIds 单源
emptyLoadingErrorStates=sections 为空显示“暂无可用诊断节”；host loading 显示“正在准备终端画布”；content failure 保留容器并显示定位码；system failure 按 system category 显示失败页
containerBehaviorUnderLoad=左侧分区集合是固定当前分母，不单独滚动；右侧是唯一纵向滚动 owner；长标题/编码换行，不撑宽父节点；顶部标题/关闭与 section list 不溢出 canvas；左右栏顶端按 shared parent 对齐
```

低保真结构：

```text
┌────────────────────────── laptop canvas ──────────────────────────┐
│ 终端管理                                                   [关闭] │
├──────────────────────┬───────────────────────────────────────────┤
│ [平台端口]            │                                           │
│ [运行状态]            │              当前分区详情                 │
│ [显示上下文]          │                                           │
│ [示例节（仅 sample）] │                                           │
└──────────────────────┴───────────────────────────────────────────┘
```

### IA-02 · mobile admin console wrap navigation

```text
businessTask=终端操作员在 360×640 逻辑画布内快速切换并查看只读诊断
actorAndScenario=终端操作员已通过本次打开的本地动态口令，admin layer 已挂载
entryAndSurface=AdminLauncher 的既有隐藏入口 → admin.console layer；mobile 目标物理表面全屏 surface
controlType=上方可换行 section tablist/tab；下方单一 content frame；顶部标题与关闭 button；无横向滚动控件
validationAndError=每个冻结 section 均可选；selected fallback 由 component 在当前 sections 集合内处理；空/加载/content/system 状态与 IA-01 相同
accessibilityAndTestId=tablist/tab，label 为“选择<分区标题>”；selected 状态不只靠颜色；入口使用 adminTestIds 单源；关闭恢复 admin 前 focus scope
emptyLoadingErrorStates=sections 为空显示“暂无可用诊断节”；host loading 显示“正在准备终端画布”；content failure 在 container 内显示定位码；system failure 只在目标 PRIMARY 显示失败页
containerBehaviorUnderLoad=360×640 下当前冻结的每个 section 入口均可见、可达、可点、未裁剪且 selected 可辨；导航条允许换行但不产生横向 scroll owner；详情内容是唯一纵向 scroll owner；长标题换行，不撑宽入口或 canvas
```

低保真结构：

```text
┌──────────────────── mobile 360×640 ────────────────────┐
│ 终端管理                                        [关闭] │
├─────────────────────────────────────────────────────────┤
│ [平台端口] [运行状态] [显示上下文] [示例节]             │
│                                                         │
│              当前分区详情（纵向滚动）                  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### IA-03 · content failure container

```text
businessTask=终端操作员或开发人员能从当前容器直接定位缺失/不兼容的 screenPart
actorAndScenario=任意 screen 调用方只传 partKey，但当前 form 没有可用条目或容器内容失败
entryAndSurface=show-screen 渲染路径；PRIMARY、SECONDARY、Web 都保留在其当前 container
controlType=无修复按钮；可见只读 failure text；不弹出第二层错误 modal
validationAndError=文本包含“页面找不到”、partKey（无默认 container-empty 允许为空）和 surfaceForm；具体 content reason 通过 typed state/testID 可核；不得显示“请重启终端”
accessibilityAndTestId=失败内容有可读文本和稳定 content failure testID；partKey/form 不是仅颜色或日志；容器仍属于原 screen surface
emptyLoadingErrorStates=content failure 不是 host loading；它不阻碍目标 PRIMARY ready；system/transition 不借用此形态
containerBehaviorUnderLoad=定位码在 content frame 内换行；不得把 containerKey/partKey 撑出 logical canvas；失败内容使用同一容器 scroll owner，不增加 modal/backdrop
```

### IA-04 · system failure page

```text
businessTask=终端操作员知道系统/runtime/主承载表面真正不可用，并得到正确的运维动作提示
actorAndScenario=首次 ready 前或 ready 后发生 system category failure
entryAndSurface=目标 PRIMARY 物理表面的现有 failure page owner；SECONDARY 仅 neutral fallback
controlType=只读标题/说明/内部 reason code；本批没有页内重新启动按钮
validationAndError=首次 ready 前标题“终端启动失败”；首次 ready 后标题“终端运行异常”；说明“请重启终端，如仍失败请联系管理员”；错误代码只含内部 reason/name，不含消息或敏感值
accessibilityAndTestId=启动/运行期两个 variant 使用不同 testID；目标 PRIMARY 才可见；system page 的文字可被辅助技术读取
emptyLoadingErrorStates=runtime-not-started 保持 loading/neutral，不显示 system page；content failure 不升级为 system page
containerBehaviorUnderLoad=失败页填充目标 canvas；不被 LayerStack 的旧居中 padding 约束；SECONDARY 不产生全屏失败页
```

### IA-05 · transition / host loading

```text
businessTask=终端操作员知道系统仍在准备，而不是把过渡态误读成终态故障
actorAndScenario=runtime 尚未 started，或 host snapshot 尚未完成；尚未满足 ready
entryAndSurface=当前 surface host 的 loading/fallback；不产生 startup failure page
controlType=只读 loading indicator/状态文字；无重启按钮
validationAndError=状态保持 transition category；system page 与 startup-ready 均不出现
accessibilityAndTestId=loading 状态有稳定 testID 和可读 label；不复用 content failure testID
emptyLoadingErrorStates=loading 可持续到 host/runtime 提供下一次有效快照；本需求不加超时
containerBehaviorUnderLoad=loading 指示器在当前 host frame 内，不创建第二 scroll owner，不影响后续 resolved/content fallback mount
```

### IA-06 · close / focus / recovery boundary

```text
businessTask=终端操作员关闭 admin console 后继续原业务操作，并在容器/形态变化后不被残留层困住
actorAndScenario=已认证 admin layer，或跨机型冷启动恢复了旧 container/layer 记录
entryAndSurface=既有 AdminLayer focus scope 与 LayerStack close/back owner；不是新 popup 机制
controlType=console close button；laptop 返回/关闭语义；mobile 使用既有关闭语义，不新增 BackHandler alternate
validationAndError=跨机型失效 layer/container 在 hydrate/prune 后不渲染 backdrop/空层；有效业务内容与 focus scope 保留
accessibilityAndTestId=关闭动作位于真实 button 节点；焦点回到进入前 scope；selected section 不跨 admin layer mount 承诺持久
emptyLoadingErrorStates=没有有效 section 显示 admin empty；无效记录记诊断并移除；有效记录照常恢复
containerBehaviorUnderLoad=跨机型恢复只移除失效记录，不以默认值覆盖显式记录；单一内容 scroll owner；决定性 admin layer 的遮罩/关闭语义保持原值
```

## 4. 不可见维度：可执行观察

每个观察标明最低档位；本轮只定义观察，不宣称已执行。

| IA-ID | `stateAndPermission` | `navigationAndRefresh` | `collectionShapeAndScale` | `dataSourceAndCascade` | `forbiddenUI` |
|---|---|---|---|---|---|
| IA-01 | `[static/focused]` admin 读取只来自 terminal-local runtime facts 与 UiCatalog；没有 HTTP 读/写授权点；AdminLogin 仍是本地身份 owner | `[focused]` 选择 section 只改变本地 selected part，不触发 HTTP/refetch、不写业务 state；close 只卸载 admin layer | `[focused]` 一次 assembly 产生有限 section 数组；sample-console 分母为共享 3 + sample admin-test，wallpaper 为共享 3；无 cursor/page | `[static]` section 由当前 filtered catalog 同步筛选；catalog 变化时 selected 由组件在同集合回落；无第二 registry | `[static]` 禁止 raw password/device identity、token、raw props、第二 openLayer、第二 scroll owner；命中即 finding |
| IA-02 | `[static/focused]` 与 IA-01 相同；tab selection 没有网络权限或业务写入口 | `[focused]` tab 选择只更新本地 selected state；close 恢复 scope；没有 refetch | `[focused]` current frozen set only，导航入口不分页；section 内容使用一个 vertical owner | `[static]` same `selectAdminSections`/hook source；new section beyond frozen set requires IA reevaluation | `[static/device]` 禁止横向 scroll、裁剪入口、只用颜色表示 selected、text/index locator；命中即 finding |
| IA-03 | `[focused]` screen failure 是 render-local content result；不调用权限/HTTP；所有表面都能消费可见 failure | `[focused]` failure 不发新业务请求、不自动重试；target PRIMARY only adds ready event | `[focused]` 一个 container failure record，bounded text；partKey/form 是有限字符串字段，不抽干集合 | `[static]` reason 来自 resolver typed outcome；不会被 ScreenContainer 改写为 system | `[focused]` 禁止 startup failure page、restart copy、raw error message、sensitive props；命中即 finding |
| IA-04 | `[focused]` system page 只由 system category 触发；目标 PRIMARY gate；SECONDARY 不获得全屏 failure surface；必须执行“content failure 先 ready、随后 system failure”时序 | `[focused]` system page 不做 HTTP retry；close/back 仍受现有 decisive layer 行为；时序用例在不重置 ready state/不重新挂载的前提下断言 ready 后使用运行期档位，不能只读取 `failureStage` 的默认值 | `[focused]` 单一 failure page，不分页；错误 code 是有限内部 reason/name | `[focused]` failureStage 只消费 ready state/category；content failure 先 ready，后续 system failure 必须由独立 focused sequence 证明为运行期 variant | `[focused]` 禁止把 content/transition 画成 system page、显示敏感消息、在 SECONDARY 画全屏页；删除时序第一段或清零 ready 必须红 |
| IA-05 | `[focused]` transition 是 local render lifecycle，不能被操作员当作系统故障 | `[focused]` 不重试、不写业务 state；等待下一次 host/runtime snapshot | `[focused]` 单一 loading node；没有列表/分页 | `[static]` `status`/host availability 是现有 RenderContext owner；transition 不改变 catalog | `[focused]` 禁止 startup-ready、system failure page、超时魔法或第二 host gate |
| IA-06 | `[focused]` admin layer 认证/焦点 scope 归 AdminLayer；hydrate prune 归 ui-state actor；没有跨 owner HTTP 写或 declaration metadata 通道 | `[focused]` close/back 只恢复既有 scope；hydrate 后不发业务 refetch；无 cache | `[focused]` workspace/display mode 下遍历有限 containers/layers；不分页、不扩展 persisted schema | `[focused]` current catalog/form 改变只裁剪 invalid/non-renderable record；有效 record 保留；默认不写入 container；unknown/retired/other-form 共用 `hydrated-container-not-renderable` | `[static/focused]` 禁止 backdrop 残留、关不掉空层、用默认覆盖显式失败、第二个 popup/scroll owner、跨层传 declaration snapshot |

### 4.1 containerBehaviorUnderLoad 细化

- 当前 admin section 数量是冻结集合，不分页、不单独滚动；新增 section 不是实现者自行扩容的隐式行为，必须同步 admin parts、两个 integration 分母、focused fixture、README 和 IA。
- 右侧/下方详情是唯一纵向 scroll owner。长标题、partKey、内部 reason 和端口行换行；它们不得撑宽 root，也不得遮挡标题、关闭控件或 section 入口。
- laptop 左右两栏以同一父节点的 top edge 对齐；左右内容行数不同不强行等高，详情自身在其 bounded content frame 内滚动。
- mobile 导航条只允许 wrap；当固定 360×640 观察发现新增条目让入口不可见/不可点时，判定 U-11 OPEN，并先重新评估 IA，不偷偷加入横向能力。
- content failure 文本不创建 LayerStack backdrop；system failure page 填充目标 PRIMARY；SECONDARY 与 Web 的 content failure 仍留在原 container。

## 5. 共用信息架构规则

1. 所有 admin section 都是同一 filtered `UiCatalog.entries` 的投影；没有按机型拼接 partKey、没有第二 section registry、没有在组件外复制 form 状态。
2. 登录态仍归 `AdminLayer` 本地；`useAdminSections` 只负责 section 集合、selected 和选择动作，不读取 `surfaceForm`。
3. admin 是只读终端诊断 surface；本批不增加网络、数据库、seed 或业务写命令。
4. screen content failure 是容器内业务失败；system failure page 与 transition/loading 是不同 UI 类别；分类以 typed category 为准，不由可见文案或 reason 字符串反推。
5. 默认 part 只在没有有效 container placement 时由 integration 声明提供；显式失效记录先走 hydrate prune/diagnostic，不被默认静默覆盖。
6. 所有真实动作节点使用 `adminTestIds` 单源：登录验证、关闭、section 选择、隐藏 launcher；不用 text、role、index 或 wrapper 代替可标记节点。

### 5.1 当前默认入口事实

本项是实施前已完成的源码核对，不是待核的预期值：两个 integration 的 assembly 都没有 `defaultContainerPartKeys` 或其他 PRIMARY 默认字段，`console-assembly` 当前也没有默认 part 入口。两套装配的完整 PRIMARY placement owner 已逐项核对：共享 `sample-staff-auth` 的 `showLogin`（`apps/terminal/ui/feature/sample-staff-auth/src/features/actors/actors.ts:32-37`）由同文件 `:52-59` 在匿名恢复与退出登录时派发 PRIMARY `sample.auth.login`，且该 feature 分别由 `sample-console/src/assembly/assembly.tsx:39,100` 与 `sample-wallpaper-console/src/assembly/assembly.tsx:63,83` 汇总/装入；`sample-member-desk`（仅 sample-console，`apps/terminal/ui/feature/sample-member-desk/src/features/actors/actors.ts:82-105`）在认证后派发 PRIMARY member list、匿名只尝试 SECONDARY；sample-console 本地 module（`apps/terminal/ui/integration/sample-console/src/application/module.ts:23-38`）只有 startup-ready actor；sample-wallpaper 本地 placement（`apps/terminal/ui/integration/sample-wallpaper-console/src/features/actors/actors.ts:49-67`）在认证后派发 PRIMARY picker、匿名只尝试 SECONDARY waiting；wallpaper-picker actor（`apps/terminal/ui/feature/sample-wallpaper-picker/src/features/actors/actors.ts:65-113`）只处理命令/layer，不派发 screen。由此两个 integration 的稳定匿名恢复旅途都有共享 staff-auth 的 PRIMARY login，当前没有真实 integration anonymous `container-empty`/`readyPartKey=null` 路径。U-6 的 null 分支改用显式 focused synthetic fixture，代表合法“无 placement、无默认”的生产状态形状但不冒充当前旅途；如要把正常匿名旅途改成无 PRIMARY placement，另行升为产品语义裁决。

## 6. 错误语义与界面映射

本终端本批没有 HTTP code；“HTTP”列用 `N/A (terminal-local)`，不虚构 edge problem。

| problem code | HTTP | 业务规则映射 | 触发界面/owner | 用户可见处理 |
|---|---|---|---|---|
| `missing-catalog-entry` | N/A | content failure；R-4/R-5 | `ScreenContainer` → content failure container | 页面找不到 + requested partKey + current surfaceForm |
| `incompatible-catalog-entry` | N/A | content failure；R-5 | `ScreenContainer` → content failure container | 同上；不显示重启提示 |
| `container-empty` | N/A | content failure；R-5/R-6 | container owner → content failure/default selection | 无默认时不编造 partKey；显示 container/form 定位码；目标 PRIMARY 仍可 ready |
| `invalid-props` | N/A | content failure；R-15 | resolver/ScreenContainer | 页面找不到定位码；不把调用方错误升级为 system page |
| `missing-renderer` | N/A | system failure；R-15/R-S7 | target PRIMARY failure page；other surfaces neutral | 启动/运行期标题按 ready phase，内部 code 不含 message/sensitive |
| `runtime-start-failed` | N/A | system failure；R-15/R-S7 | target PRIMARY failure page | 同上 |
| `surface-host-unavailable` | N/A | system failure；R-15/R-S7 | target PRIMARY failure page；SECONDARY neutral | 同上 |
| `runtime-not-started` | N/A | transition；R-15/R-16 | current host loading/fallback | 等待；不显示失败页、不写 ready |
| `hydrated-container-invalid` | N/A | recovery diagnostic；R-6/R-9 | ui-state prune actor | 结构无效 record 从本次视图移除；不显示关不掉层；记结构化诊断 |
| `hydrated-container-not-renderable` | N/A | recovery diagnostic；R-6/R-9 | ui-state prune actor | catalog 缺席、已退役/未知或其他机型 record 从当前视图移除；共用 reason 与中性定位文案“该恢复记录在当前 catalog 中不可呈现，已移除本次恢复记录”；有效当前形态记录保留；不传 declaration metadata |

“出现即缺陷”的结构/视觉规则（如 root 仍有 card maxWidth、mobile 入口裁剪）不伪造 HTTP reject code；由 focused red mutation 或 D-13 人工核验。

`hydrated-container-not-renderable` 有意合并“其他机型”和“已退役/未知”：需求 R-9 允许区分或改写文案，本 IA 选择改写文案的零跨层通道方案，统一使用“该恢复记录在当前 catalog 中不可呈现，已移除本次恢复记录”。ui-state 不接收 assembly 的全量 declaration metadata；若实现试图恢复独立的 other-form problem code 或 declaration snapshot，应在设计/逐代码对账中判为 OPEN。

## 7. 交叉对账

| 检查 | 判据 | 当前状态 |
|---|---|---|
| IA ↔ 交互工件 | IA-01/02 延续 admin layer、AdminLauncher、登录/关闭和 section action；新增形态/焦点/错误只细化本需求，不替换既有入口 | OPEN，待 Dexter wireframe review |
| IA ↔ implementation design | 共同事实块、laptop/mobile layout、hook、9/8 card denominator、LayerStack exact values、失败分类与无横向能力均逐字一致 | 作者自证；独立复核 OPEN |
| IA-ID ↔ Journey | IA-01/02/03/04/05/06 均回溯 terminal admin console interaction artifact 的 admin layer/loading/section/close/failure states；未新增业务 Journey | OPEN，需人审验 Journey 边界 |
| 计数自证 | `IA_SCOPE=IA-01..IA-06`，正文恰有六个 IA-ID 小节 | MATCHED |
| 不可见维度可执行 | 每个 IA-ID 的 permission/refresh/scale/source/forbidden 以 static/focused/device observation 写出 | 作者自证；独立复核 OPEN |

## 8. 完成判定

```text
IA_DIMENSIONS=IA-01..IA-06，共 6 个；可见与不可见维度逐项齐全
INVISIBLE_DIMENSIONS_AS_OBSERVATIONS=是
FORBIDDEN_UI=explicit
TYPED_PROBLEMS=10 mapped（8 render categories + 2 hydration diagnostics）
CROSS_CHECK_WITH_DESIGN=作者自证；fresh 独立前置审查已完成，实施后仍须步骤级/全批三维对账
DEXTER_WIREFRAME_REVIEW=沿用既有 interaction 工件；本次 Dexter 直接授权不新增 wireframe gate
IA_STATUS=READY_FOR_IMPLEMENTATION_BY_DEXTER_AUTHORIZATION
IMPLEMENTATION_AUTHORITY=true（Dexter 当前任务直接授权；不扩大产品语义）
```
