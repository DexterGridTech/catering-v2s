# TER screenPart 机型解析 · implementation-facing 详设

`SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0`

```text
DOCUMENT_KIND=IMPLEMENTATION_FACING_DESIGN
BUSINESS_SOURCE=doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-requirements-claude.md
JOURNEY_REFS=doc/plans/platform/2026-09-11-v2s-terminal-admin-console-ui-interaction-design-codex.md
IA_REF=doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-ia-design-codex.md
INTERACTION_REF=doc/plans/platform/2026-09-11-v2s-terminal-admin-console-ui-interaction-design-codex.md
AUTHORIZED=本文件、配套 IA、实施计划、TR-13/TR-14 与旧需求四处的文档修订；以及按当前 Dexter 直接授权进入本计划范围内的源码、测试、README、验证与计划内动态证据收集
NOT_AUTHORIZED=超出本需求/详设/实施计划的产品范围、构建拓扑、seed/UAT/部署或未列出的源码改动；Git 由 Dexter 控制
IMPLEMENTATION_AUTHORITY=true（Dexter 当前任务直接授权；不扩大需求范围）
DESIGN_STATUS=READY_FOR_IMPLEMENTATION_BY_DEXTER_AUTHORIZATION
REVIEW_TARGET=DESIGN
INDEPENDENT_SUBAGENT_REVIEW=COMPLETED（fresh 只读前置审查记录于 `doc/review/platform/2026-09-16-ter-screen-part-form-resolution-design-adversarial-review-codex.md`；finding 已 intake）
DEXTER_WIREFRAME_REVIEW=UNSET（沿用既有交互工件，新增 IA 待 Dexter/Claude 评审）
```

本文件是实现详设，不是实施记录、测试结果或 acceptance。没有在本轮宣称任何源码、focused、native、Android、Web、visual 或 release 结果。

## 1. 真实业务目标与方案比较

### 1.1 本批真正要解决的问题

TER 的调用方现在已经只传 `partKey`，但一个 `partKey` 不能在同一 catalog 中表达两个机型实现；如果把机型逻辑散到各 feature、各 integration 或调用方，遗漏一处就会产生静默的错误组件选择。与此同时，admin console 的单卡片布局在 laptop 上浪费画布，在 mobile 上又把导航、详情和设备信息混在一个层级内。最后，现有 `runtime-unavailable` 同时代表“运行时尚未启动”和两种系统失败，导致内容失败是否阻碍 PRIMARY ready 无法由类型可靠判定。

不修复的可观察后果是：

- 同一 `partKey` 的机型实现必须靠调用方知道机型，违反“调用方只关注 partKey”；
- 只在当前机型过滤后检查重复，另一机型的冲突可以静默进入下一次启动；
- 过滤后的持久化容器或浮层可能在另一机型变成空/不可关闭的残留；
- `missing-catalog-entry` 可能被错误提升成“终端启动失败”，而真正的内容配置问题被误导为需要重启的系统故障；
- admin console 不能在 laptop 真实利用横向空间，mobile 也没有清晰的分区/返回/焦点约束。

### 1.2 方案比较

| 方案 | 结果 | 结论 |
|---|---|---|
| A. 每个 feature/integration 在自己注册前按机型过滤 | 过滤责任分散；漏接一处就静默少条目；冲突检测无法看到完整集合；调用方和测试容易各自手搓 catalog | 拒绝：重复 owner，且无法保证全量冲突边界 |
| B. 将 catalog 索引改成 `(partKey, surfaceForm)` 双键，并把机型放进 show/open 命令 | API、持久化身份、layer 查找和多处 selector 都要换；调用方仍需感知机型；会把需求扩大成新的 catalog 数据模型 | 拒绝：改动面大于问题，破坏 partKey-only 目标 |
| C. console-assembly 汇总全部 parts 后先检测冲突、再按当前机型过滤；用带 category 的失败结果驱动 render；admin 分两批演进 | 只有一个生产收口；调用方仍只传 partKey；失败分类与 ready 边界可由类型表达；声明拆分先于组件分化 | **采用** |

我选了 C 而不是 A/B，因为它把机型知识留在装配与 renderer owner，把调用侧 API 保持最小，并只在已有 catalog/renderer/render 链上增加必需的分类和恢复信息，不新增索引、弹窗机制或通用 sibling 机制。

### 1.3 Dexter 意图与成本取舍

Dexter 的意图是：开发组件时可以知道它用于 mobile 还是 laptop；展示其他 screenPart 时只写 `partKey`；integration 主要用于预览，assembly 才是实际运行组合；admin console 最大化展示，laptop 走 master-detail，mobile 采用不引入横向滚动能力的最佳实践；不为此重建另一套弹窗机制。

因此本设计接受两项有意的本批成本：

1. 将失败分类沿 `resolvePart → ScreenContainer → ScreenReadyBoundary → console-assembly → integration` 逐层传递；它比在一个组件里加字符串判断多，但否则 R-15/R-16 无法成为类型事实。
2. 选择水合时裁剪跨机型失效容器，而不是把所有失效记录静默回落默认。裁剪复用 ui-state 已有的 layer owner，保留显式 `show-screen` 的 not-found 业务反馈；回落默认会把“调用方明确请求了一个当前不存在的 part”与“容器没有任何记录”混为一谈。对 unknown/retired 与 other-form 的运维文案采用 R-9 允许的改写分支，不为区分一个日志字段建立 assembly→ui-state declaration metadata 通道。

## 2. CP 总览

| CP | 主题 | owner | 主要输出 | 依赖 |
|---|---|---|---|---|
| CP-0 | 权威同步与 implementation preflight | 主 agent / 文档 owner | TR-13、TR-14、旧需求四处与本设计一致 | 需求 v9、现行源码重读 |
| CP-1 | 类型化失败、内容失败呈现与 ready 边界 | `ui/base/render` | 分类载体、fallback、PRIMARY ready 输入、failure page 分流 | CP-0 |
| CP-2 | 默认传递、水合裁剪与诊断/启动传播 | `kernel/base/ui-state`、`ui/base/console-assembly`、两个 integration | 容器恢复、ready payload、唯一 startup writer | CP-1 |
| CP-3 | 全量冲突检测与装配期过滤 | `ui/base/console-assembly` | 先冲突、后过滤的单一生产收口 | CP-2 |
| CP-4 | admin 声明拆分（R-10a） | `ui/base/admin-shell` | 8 条未过滤 admin 输入、每 key 两个不相交兄弟，暂共用组件 | CP-3 |
| CP-5 | admin 组件分化、版式、hook 与 IA | `ui/base/admin-shell` | laptop/mobile renderer、master-detail/wrap、共享 hook | CP-4 且 CP-1～CP-4 零回归已证 |
| CP-6 | focused/静态收口与设计对账 | 主 agent + fresh 对账者 | U-1～U-15 结果、视觉证据计划、逐代码与详设对账 | CP-5 |

CP-1～CP-4 构成机制批，CP-5 构成 admin 重排批；CP-6 是整体收口，不是第三个产品批次。

## 3. 横切机制对照表

本表保留模板的固定行集。TER 本批是终端本地 UI/状态/装配，不新增 HTTP、数据库或后台 owner；不适用项明确写 `N/A`，不会通过空泛的“沿用既有做法”跳过。

| 机制 | ① 用哪个现成能力/规范（精确路径或符号名） | ② 如何验证（最低可执行观察） | ③ 无现成时必须符合的形态 | ④ 本批适用全集 |
|---|---|---|---|---|
| 读侧节点授权 | `kernel/base/ui-state/src/foundations/catalog.ts` 的 selectors；`ui/base/render/src/contexts/RenderContext.tsx` | focused test 只从导出的 selector/RenderContext 读取 form、catalog、host 状态；跨包字符串 slice 读命中即 OPEN | 新读取必须由 owner 包导出 typed selector，消费方不读取 raw store key | catalog、surfaceForm、containers、layers、ready input、admin section selection |
| 写授权与 grant 复核 | `features/actors/contentActors.ts` 的 command→actor→dispatch；`createUiStateModule` 的 install | focused test 记录 show/open、prune、ready 命令到唯一 actor；组件/foundation 直接 dispatch 为 red mutation | state 变更只能由 actor 写，装配只发命令；不新增 UI 直写 reducer | container prune、layer prune 复用、startup-ready、startup.complete |
| 跨 owner 写与事务 | 终端无跨业务 owner/数据库写；`consoleAssembly` 只组合能力 | 静态检查本批无 HTTP/DB/跨 owner write；startup writer 与其 integration payload 在同一 console owner 内 | N/A：无跨 owner 事务；runtime 事件只进本地 writer，不引入事务假象 | 全部 R-1～R-16 |
| 集合形态与分页 | `createUiCatalog`、`selectAdminSections`、`parseContainers` | focused test 断言一次 assembly 的有限 `parts[]`/`entries[]` 与各 integration 冻结分母；没有 cursor/page | N/A：本批集合是一次装配的有限本地数组；若未来增长超出冻结分母，先改需求/IA | 未过滤 parts、过滤 parts、catalog entries、admin sections、hydrated containers |
| 缓存失效 / 改完刷新什么 | `createUiStateModule.ts` 的 install 顺序；`contentActors.ts` 的 prune owner | 跨机型冷启动 focused test 观察水合后 containers/layers 与 render tree 均无失效项；不新增 cache | 以当前 catalog/form 重建派生视图；不持久化默认值，不维护第二份 catalog | containers、layers、admin section selection、renderer bindings |
| **RTK 数据读取与加载判定** (`currentData` / `isFetching`) | `N/A_WITH_REASON`：TER 不适用 `doc/platform/frontend-coding-standard.md`；当前 owner 是 `RenderContext.tsx` 与本地 ui-state selectors | focused/static 证明本批无 RTK、无 query/loading hook；对应条目标 N/A | N/A：TER 使用本地 runtime 状态，不伪造 RTK 义务 | 全部 TER 本地 surface |
| **同一事实只有一个住址** | `doc/platform/terminal-coding-standard.md`（终端唯一正本）；`createUiStateModule.ts` 的 `createSurfaceFormSlice`；`RenderContext.tsx` | 静态搜 `surfaceForm` 的生产来源，确认只有 ui-state 注入值；assembly 只传同一值；focused 改值后 catalog/render 同步变化 | 不在 SurfaceRoot、hook、integration 复制 form 状态；默认 part 只由 integration 声明 | surfaceForm、target PRIMARY、catalog projection、ready event |
| **失败可见且原因不得改写** | `resolvePart.ts`、`ScreenContainer.tsx`、`ScreenReadyBoundary.tsx`；终端规范失败可见条款 | focused 为四种 content、三种 system/transition 各注入分类，断言 category、可见文案、ready/page 分流 | failure 是 discriminated object；消费方按 `category`，不再按 reason 字符串枚举；显示文案不含敏感消息 | missing/incompatible/empty/invalid-props、missing-renderer、runtime/surface、runtime-not-started |
| owner 错误到 HTTP 的映射与注册处 | N/A：本批无 HTTP/typed problem | 结构核对本批改动列表不含 edge/route/HTTP；若实施新增 HTTP，计划必须暂停并补 backend scenario | N/A：不创建伪 HTTP 层 | 全部终端本地失败 |
| 幂等键构成与重放语义 | `startupDiagnosticsWriter` 的已有一次写入锁；`diagnostics.ts` 的按身份去重 | focused test 同一 startup event 重放一次，确认只产生一个 `startup.complete`；失败诊断按 identity 去重 | writer 只接受同一 run 的 typed event；不得把 UI render 次数当 operation id | startup.complete、ready diagnostics、content error diagnostics |
| **该用生成物的地方不得手搓字符串** | `definePart.ts`、`adminTestIds.ts`、各 package `terminal-invariants.json` | focused/public-surface test 由真实 export/invariant 比对；failure test 从 typed reason 映射到单一 testID 表 | part/test identity 从 owner 的常量/定义导出；不在 integration 重写 admin 常量 | admin partKey/testID、rendererBinding 字段、failure testID |
| 日志落点与脱敏字段 | `foundations/diagnostics.ts`、`consoleAssembly.tsx` 的 startup writer、两个 integration actors | focused test 读取 structured diagnostic sink：含 run/form/part/container/category；断言无 password、token、raw props/payload | 日志只记稳定身份与 reason/category；message 不作为分类源；同 run 关联 | screen error、hydrate prune、startup groups、ready payload、failure page |
| 迁移回填与可逆性 | N/A：不改数据库、不做持久化 schema migration | 静态确认无 migration/seed/回填文件；容器记录由读时裁剪处理 | N/A：读时恢复，不添加旧格式兼容表 | containers/layers persisted records |
| 前端共享行为(Drawer/列表/表单生命周期) | `N/A_WITH_REASON`：Web admin 前端规范与 `libraries/frontend/admin-ui-foundation` 不适用于 TER；复用 TER `AdminLayer.tsx`、`AdminSectionNavigation.tsx` 与 terminal primitives | focused test 验证 focus scope mount/unmount、section selection、close/back；不接 Web foundation | 复用现有 terminal owner，不在 Web foundation 复制行为 | admin layer、laptop detail、mobile navigation |
| 候选/下拉数据源 | `selectAdminSections` 读取 `UiCatalog.entries` | focused test 由真实 assembly catalog 得到每个 integration 的 section 分母；无第二 registry | section 顺序来自过滤后 catalog；默认/回落由组件根据 section 集合决定 | admin navigation、selected section fallback |
| 编码与名称呈现 | `doc/platform/terminal-coding-standard.md` TR-13、TR-14；existing admin test IDs | implementation review 逐条核对 basename、partKey、rendererKey、testID 与 README；TR-14 不建机器门 | 组件 basename 显式包含 `Laptop`/`Mobile`；双机型共享组件不靠扩展名解析 | admin four part pairs、section components、README |
| **会同时坏的东西是否已声明为原子组** | `doc/platform/foundation-charter.md` §5-C；本批 CP-1/CP-2/CP-3 | 每个 CP 完成前检查类型、传播、writer、integration payload 是否同时更新；任一字段缺一即 gate OPEN | 分类、ready input、writer、两个 integration payload 是一个原子组；R-10a 声明/fixture/分母也是原子组 | CP-1～CP-4 全部改动 |

### 3a. L2 / testId 前置复核

```text
UI_DESIGN_REVIEW=OPEN：本批 UI-bearing；既有交互工件可作基线，但 Dexter wireframe review 尚未在本轮完成
TESTID_REVIEW=OPEN：D-7 已列出真实动作节点与现有 adminTestIds；实施前需对账并由独立 review 复核
L2_SCRIPT_ADMISSION=BLOCKED：本轮未获 L2/浏览器授权，也未执行 L2
```

本轮没有声明 L2 可执行。未来实现只能从 `apps/terminal/ui/base/admin-shell/src/foundations/adminTestIds.ts` 的单一常量源建立 locator；必须先完成 focused/static 对账和 fresh 独立复核，才可另行获得 L2 admission。现有动作节点是：登录验证、关闭 console、分区选择、隐藏 launcher 手势；分区选择在 laptop 是 list/button 语义，在 mobile 是 tab 语义，但仍使用同一 section testID。

## 4. 每个 CP 的门控

| CP | 可证伪失败条件 | 不变量 | FORBID | 比例验证 | 形态理由 | RECALL |
|---|---|---|---|---|---|---|
| CP-0 | 旧 R-S1/R-S7/U8 或 TR-13 仍用旧“所有 fallback 不 ready/catalog”口径 | 权威文档只保留 system/content/transition 分层，TR-13 检查未过滤装配输入 | 不改 apps；不造 retired manifest/checker | 文档静态检索与内容对账 | 只同步已授权权威，不触碰实现 | v9 §3、§5、§8；TR-13/TR-14 |
| CP-1 | 把 content fallback 当 system、把 runtime-not-started 当 system、或 SECONDARY 宣告 ready | typed category 闭合；content 可见且 PRIMARY 可 ready；system 页面仅目标 PRIMARY；transition 不 ready | 不在消费者枚举 reason；不新建第二失败页机制；不保留旧 overloaded token | render focused tests + typecheck | 在 resolver 层补失去的信息，比在每个 consumer 重复猜测更小 | `resolvePart.ts`、`ScreenContainer.tsx`、`ScreenReadyBoundary.tsx`、R-15/R-16 |
| CP-2 | 默认被写入 container；跨机型容器/层仍残留；ready payload 丢失 `null` 或 content state | integration 声明默认；读时传递；水合裁剪只移除失效记录；writer 是唯一 complete owner | 不在 console-assembly 写业务 partKey；不让 platform logger 判定 complete；不新增诊断事件 | ui-state/assembly focused + cold-restart evidence later | 复用现有 layer prune owner，避免一个容器 fallback 静默吞掉显式失败 | R-6、R-9、R-16、`workspaceSlices.ts`、`contentActors.ts` |
| CP-3 | 过滤恒等 mutation 后 U-1 仍绿；只在受影响机型发现 overlap | full input 先分组冲突、再以同一 form 过滤；post-filter unique 保留 | 不让 integration 各自过滤；不改 catalog index | real assembly focused + overlap fixture | 单一装配点能覆盖生产输入且不改调用 API | R-1/R-2、`consoleAssembly.tsx` |
| CP-4 | R-10a 只改 catalog/fixture、未过滤输入缺 admin parts、兄弟 forms overlap 未红 | 8 条 admin 输入完整；四 key 每 key 两个不相交条目；组件先相同 | 不在测试手搓完整 production catalog；不跳过 U-14 | admin-shell/integration focused | 先证明声明拆分不改变行为，再给第二批组件分化最强零回归基线 | R-10a、U-14/U-15、TR-13 |
| CP-5 | root 仍卡片/居中；hook 读 form；laptop 纵向堆叠；mobile 入口裁剪 | admin IA、hook、style、a11y/focus、testID 同时匹配 | 不加 horizontal scroll、新 token、第二 popup、通用 sibling-aware definePart | admin-shell focused + later device visual | 使用现有 PrimitiveGrid wrap 和 RN style，改动面小于新 primitive | R-10b/R-11/R-12/R-13/R-14、IA |
| CP-6 | 对账漏行、视觉结构冒充视觉 PASS、任一 OPEN 仍交 review | U-1～U-15 逐条有执行体；visual 标 UNVERIFIABLE；逐代码结果仅 MATCHED/OPEN | 不把 static/focused 冒充 native/Android/Web/visual/release | final static/focused/reconciliation; future device evidence | 证据档位与能力相称，避免差分器或结构测试作绝对 oracle | D-13、D-14、D-15、§5 |

### CP 门 red mutation 与最小防再犯

- CP-1 的 production red mutation 是把 `missing-catalog-entry` 的 category 改为 `system`，或把 `runtime-not-started` 归进 system；U-5b 必须同时红在失败页/ready 断言上。防再犯落点：typed failure focused test，而不是 reason 字符串扫描。
- CP-1 还必须跑 R-16 时序 red mutation：删掉 content failure 的首次 ready、在后续 system failure 前清零 `hasPrimarySurfaceReady`，或把后续页面 testID 改回启动期 variant；`renderSurface.test.tsx` 的顺序断言必须红。仅由 `failureStage` 现有三元表达式得到的“自动通过”不算证据。
- CP-2 的 red mutation 是删除容器 prune actor 或把默认值 dispatch 到 container slice；U-6/U-7b 必须分别红在 hydrated key 集合和 render tree。防再犯落点：ui-state owned restart/prune focused test。
- CP-2 还必须保持 R-9 的最小边界：若实现者加入 assembly→ui-state 的 declaration metadata 通道，或恢复 `hydrated-container-other-form` 独立 problem code，设计对账必须红；只允许 `hydrated-container-invalid` 与 `hydrated-container-not-renderable` 两个 typed recovery reason。
- CP-3 的 red mutation 是把 `allParts` 直接传给 `createUiCatalog`；U-1 必须红。另把一个真实 R-10a sibling 的 forms 改为 overlap；U-2 必须在任一 form 红。防再犯落点：real assembly tests。
- CP-4 的 red mutation 是从未过滤装配输入删除一个 admin part；U-14 的输入段必须红；只保留过滤后四条不能替代它。防再犯落点：admin integration focused test + TR-13 review。
- CP-5 的 red mutation 是 hook 中加入 `surfaceForm === ...` 分支；U-12(b) AST 结果必须红；将 LayerStack padding 改回 24 或 root 恢复 `maxWidth`，U-9 结构段必须红。防再犯落点：focused semantics + human review，视觉结论不由结构门伪造。

## 5. operation / path / face / 集合形态

本批没有 HTTP operation。以下是终端本地能力，写出预期规模以防把一次装配误做成可分页服务。

| 业务意图 | operationId | method/path | consumer face | 集合形态 | 预期规模与增长驱动 |
|---|---|---|---|---|---|
| 按当前机型装配 screen parts | `createConsoleAssembly` | local assembly call | terminal-local public operator surface | 一次性 `parts[]` | 两个 integration；现有 admin 8 条未过滤输入 + integration parts；增长来自新 integration part |
| 展示业务 screen | `show-screen` command | local command | terminal-local runtime | 单 container record：`partKey`、props、displayMode | 每个 workspace/display mode 的容器记录有限；增长来自业务 screen 数量，不分页 |
| 打开 admin layer | `open-layer` command | local command | terminal-local operator | 单 layer record；admin layer 是一个决定性入口 | 每个 surface 最多一个 admin console layer；增长来自其他业务 layer，不改 admin 机制 |
| 水合后恢复当前形态可用内容 | `prune-hydrated-containers` / existing layer prune capability | local actor command | terminal-local runtime | 启动期遍历所有 workspace/display mode 的容器/层 | 遍历固定当前 catalog 与持久化记录；增长来自持久化 workspace/display mode |
| 宣告目标 PRIMARY ready | `startup-ready` | local command/event | console-assembly owner | 每个 startup run 只接受一次 primary real-ready | 六个启动组 + declared/measured/real ready；不分页、不广播成多个 owner |

`operationId` 仅是文档能力名，不进入 runtime/test 目录、包、文件或类名。无 edge、route、`x-consumer-faces`、HTTP status 或 database oracle。

## 6. 跨 owner 写矩阵

| policy | 第一个 owner command | 第二个 owner command | 事务 | 失败时的回滚事实 |
|---|---|---|---|---|
| 终端本地 ready 传播 | render 的 `startup-ready` 输入由 `ScreenReadyBoundary` 交给 console-assembly callback | console-assembly 内部唯一 `startup.complete` writer 写 sink，并向两个 integration actor 传 typed payload | N/A：同一进程本地事件，不是数据库事务 | 分类/字段缺失则不写 complete；content failure 可 ready，system/transition 不可；无需回滚业务 state |
| 水合失效记录 | ui-state hydration/prune actor | render 读取当前 catalog 后派生 container/layer tree | N/A：owner-only storage read-time recovery | 失效记录从本次内存视图移除并记诊断；原始持久化记录不被默认值覆盖 |

没有第二个业务 owner，也没有跨 schema write；因此不把本地事件包装成不存在的事务语义。

## 7. 声明—传递—消费矩阵

| fact | declaration | transfer | consumption | proof |
|---|---|---|---|---|
| 当前机型 | `createUiStateModule(input.surfaceForm)` / `selectSurfaceForm` | integration → console assembly → ui-state/render context | filter、catalog availability、section selection、ready target | static single-source search + U-1/U-3 |
| 未过滤 assembly input | integration `parts` + `adminShellAssembly.parts` | `createConsoleAssembly` 汇总数组 | R-2 conflict scan、R-1 filter、TR-13/U-14 | U-2/U-14 |
| 机型冲突 | full parts group by `partKey` before filter | assembly throw typed/config error | startup caller；不进入 runtime catalog | U-2 任一 form |
| filtered catalog | `selectAvailableParts(allParts, surfaceForm)` 的唯一装配结果 | assembly → ui-state `catalog`/renderer catalog | resolve、LayerStack、admin section selection | U-1/U-3/U-14 |
| part resolution failure | `resolvePart` failure discriminated object | resolver → `ScreenContainer` → `RenderFallback`/`ScreenReadyBoundary` | content/system/transition views and diagnostics | U-4a/U-5b |
| content failure visible payload | content failure object carries `partKey|null`, `surfaceForm`, `containerKey`, `reason` | `ScreenContainer` passes to container fallback | visible text and testID; no startup failure page | U-5 + D-13 |
| PRIMARY ready input | `RenderSurfaceReadyInput` includes `readyPartKey:string|null`, `contentFailure` | resolved/content fallback layout → callback → console assembly | only target physical PRIMARY can hide splash/write ready | U-5, U-5b, U-8 |
| startup completeness | six groups + declared/measured/real-ready | console assembly writer receives group facts and primary ready | one `startup.complete`; platform logger is sink only | focused writer test |
| integration ready payload | `SampleConsoleReadyPayload` and wallpaper equivalent add typed content state | assembly → integration module/actor/log | diagnostics and frozen journey assertions | integration focused tests |
| default part | each integration `defaultContainerPartKeys`/surface input | integration → console assembly → surface/container selection | only when no container placement exists | U-6 |
| persisted container validity | serialized `partKey`/instance/props | `parseContainers` separates structural invalidity; prune actor maps catalog-missing and current-form-unavailable records to one typed `hydrated-container-not-renderable` diagnostic | structurally invalid and non-renderable records removed from hydrated view; no declaration metadata crosses into ui-state | U-6/U-7b |
| admin sibling declaration | admin-shell parts list, same key/two disjoint forms | assembly unfiltered input → filtered catalog/renderer | R-10a/U-14/U-15, later renderer choice | focused normalized comparison |
| admin section collection | `selectAdminSections(catalog, context)` | catalog → common hook → form-specific component | nav entries and selected fallback | U-12/U-13 |
| logging/masking | diagnostics owner declares stable identity fields and forbidden fields | resolver/hydration/writer/integration actor | sink emits category/reason, never raw sensitive input | structured sink focused test |
| authorization | terminal-local admin password verifier remains `AdminLogin` owner | layer local state → authenticated shell | no network permission; no new auth path | existing admin focused tests |
| cache invalidation | N/A: no server cache | current catalog is recreated per assembly | no stale filtered catalog | U-1/U-7b |

## 8. 业务规则 → owner 判定点

| 规则 | owner 判定点 |
|---|---|
| R-1 | `consoleAssembly` 汇总后一次过滤；`createUiCatalog` 只消费 filtered parts |
| R-2 | `consoleAssembly` 的 pre-filter grouped overlap check |
| R-3 | `show-screen`/`open-layer` command payload 与 `resolvePart` 不含 form 选择参数 |
| R-4 | `resolvePart` screen failure 与 `contentActors`/`LayerStack` layer admission 分别保持职责 |
| R-5 | `RenderFallback` content view + `ScreenContainer` surface gate |
| R-6 | integration defaults + ui-state hydration/prune actor |
| R-7 | implementation review 核对 component basename 与 single-form declaration |
| R-8 | integration real-assembly behavior matrix、existing layer behavior tests |
| R-9 | `parseContainers` diagnostic and prune reason classification |
| R-10a | admin-shell part declarations before assembly filter |
| R-10b | admin-shell component renderer bindings and normalized sibling focused test |
| R-11 | admin root/LayerStack/section/card style owners |
| R-12 | laptop renderer IA and focus/back handlers |
| R-13 | mobile renderer wrap navigation; frozen section set trigger |
| R-14 | common admin hook and form-specific component fallback |
| R-15 | typed failure construction in render resolver/host branches |
| R-16 | target physical PRIMARY ready boundary + console startup writer |

无空号：R-1 至 R-16 全部有 owner；R-10 是实现上拆成 R-10a/R-10b，需求语义仍覆盖完整 R-10。

## 9. owner API 与消费者清单

| owner 方法/能力 | 谁调用（精确路径） |
|---|---|
| `resolvePart` / `resolvePartWithFailure` | `ui/base/render/src/components/ScreenContainer.tsx`、`LayerStack.tsx` 与 render focused tests |
| `createConsoleAssembly` / `adminShellAssembly` | 两个 integration 的 `src/assembly/assembly.tsx`、integration assembly tests |
| `createUiCatalog` / `createRendererCatalog` | `consoleAssembly.tsx` 的生产路径；现有 hand-built test 只允许保留为明确的非生产 catalog unit test |
| `ScreenReadyBoundary` | `ScreenContainer.tsx` 的 resolved/content-ready 分支 |
| `createStartupDiagnosticsWriter` | `consoleAssembly.tsx`；platform ports/logger 只能作为 sink |
| `selectAdminSections` | 共同 `useAdminSections` hook 与两个 form-specific shell/section renderers |
| `parseContainers` / `pruneHydratedContainers` | `workspaceSlices.ts`、ui-state actor install/prune owner |
| `adminTestIds` / `AdminLauncher` | admin-shell 内部与两个 integration assembly；不由 integration 重定义 |
| integration ready payload types/actors | 各自 `src/application`/`src/features` actor；对应 assembly 只组装同一 typed payload |

零调用者的新增 command 不进入设计。`prune-hydrated-containers` 若 implementation 发现可直接扩展已有 hydrate/prune actor，则保留能力名但不额外导出无调用者的 public API。

## 9a. 实施前全链同步变更清单

| 变更事实 | 契约/唯一生成源/生成物 | 后端 owner/edge/migration | 前端 model/surface/state | focused/静态/HTTP/L2 测试 | fixture/seed/executor | 结论 |
|---|---|---|---|---|---|---|
| `surfaceForm` 从双机型声明投影为单机型 catalog | integration parts + `consoleAssembly` input；catalog 九字段不变 | N/A | ui-state surfaceForm、render context、catalog/renderer | U-1/U-3/U-14；无 HTTP/L2 | real assembly fixture | 同步修改 assembly、tests；不改 catalog schema |
| failure category 与 reason 分离 | render typed failure union | N/A | resolve types、ScreenContainer、fallback、ready input | U-4a/U-5/U-5b、render tests | category mutation fixture | 同步修改所有消费方和 testID 断言 |
| `runtime-unavailable` 拆分 | resolver status/failure type | N/A | ScreenContainer failureStage/testID | U-5b、fallback tests | three branch fixtures | 同步迁移，不保留 overloaded alias |
| content failure ready payload | render ready input → console writer → integration payload/log | N/A | props, callback, startup facts, actors | U-5/U-5b/ready tests | content failures incl null part | 原子组同步；新增字段不进 catalog |
| `RenderSurfaceReadyInput` 公共类型 | render exported props；`partKey` 改为 `readyPartKey:string|null`，新增 `contentFailure` | N/A | render public index → `ScreenReadyBoundary`/`RenderProvider` → console writer → 两个 integration `createStartupReadyPayload` 直接消费者 | render/console/integration typecheck 与 ready focused tests | content failure、无默认 container 的 `null` fixture | 这是破坏性公共面变更；所有直接消费者同批同步，不保留旧必填字段别名 |
| default + hydrated container validity | optional integration declaration；ui-state serialized shape仍是 part/instance/props | N/A | workspaceSlices, prune actor, container selector | U-6/U-7b restart/focused | stale cross-form records | 读时恢复；结构无效与当前不可呈现统一为 typed diagnostic，不传 declaration metadata、不写 migration/seed |
| R-10 sibling declarations | admin-shell parts owner | N/A | catalog/renderer bindings | U-2/U-14/U-15 | real admin split pair | R-10a 与 U-14 同批 |
| admin layout/hook | admin-shell components/primitives | N/A | local selected state/focus | U-9/U-10/U-11/U-12/U-13 | frozen section sets | 第二批同步组件、exports、invariant、README |
| obsolete source/aliases | current `rg --files`/consumer search | N/A | admin public surface and old hand-built tests | publicSurface + focused | N/A | implementation 只删除确认无消费者的废弃 orchestration；确认不清则 OPEN，不用删除掩盖测试 |

## 10. 数据迁移

| 迁移 | 加/改什么 | 旧行回填取什么值 | 为什么是唯一可恢复事实 | 可否回滚 |
|---|---|---|---|---|
| N/A | 不改数据库、Flyway、seed 或持久化 schema | N/A | TER 容器/层记录仍按现有 owner-only storage 解析；失效 container 通过当前 catalog/form 读时裁剪，并由既有 owner-only content write 清除 stale placement | 无 schema 回滚项；删除 stale placement 是本批的预期恢复结果，不写 default、不做 migration |

## 10b. seed 数据

本批没有业务数据库、seed 或 reset 变化。`container`/`layer` 是终端本地持久化记录，不是 DEV seed。任何实施者若发现需要更新 seed，必须停止并回到范围审查，不能把终端 fixture 塞进别的 domain seed。

## 11. 验收场景设计（未来实施执行体）

本节只定义执行体，不是当前运行结果。U-1～U-15 的逐条执行表见 §13。

| scenario | owner 文件 | identity | fixture | request | businessOracle |
|---|---|---|---|---|---|
| catalog projection | `ui/base/console-assembly` | real `createConsoleAssembly` instance + `surfaceForm` | current admin plus integration parts | assemble laptop/mobile | filtered catalog includes only current form; unfiltered sibling set remains complete |
| overlap admission | `ui/base/console-assembly` | each form separately | real R-10a pair with overlapping forms | assemble | throws with partKey and overlap form set before catalog creation |
| content failure render/ready | `ui/base/render` | `containerKey` + form + primary/secondary host | each four content failure reasons | render screen | visible failure text and location code; primary ready only target; no startup page |
| system/transition classification | `ui/base/render` | failure code + target surface | missing renderer, host unavailable, runtime-started/failed branches | render each branch | system page/transition neutral behavior and ready flag match category |
| hydrated recovery | `kernel/base/ui-state` | storage record + form | structurally invalid, non-renderable (unknown or other-form), valid container/layer | independent runtime/hydrate | only invalid/non-renderable records removed; the two non-renderable causes share one typed reason/message; valid record remains |
| startup writer | `ui/base/console-assembly` | generated startup run identity | missing group, content-ready, later system failure | emit startup events | complete written exactly once only at six groups + primary declared/measured/real-ready |
| admin behavior/layout | `ui/base/admin-shell` | form + authenticated local layer | frozen admin section set and focused interactions | open/select/close/back | section/focus/a11y/style invariants and per-form layout contract |

No HTTP business scenario exists. No response status, exception absence, test name, or path string is used as an oracle.

## 12. 具体契约

### 12.1 失败分类载体

实现选择一个带 category 的 discriminated union；reason 仍保留为 category 内的代码，但 consumer 只按 category 分流。

```ts
type ContentFailureReason =
  | 'missing-catalog-entry'
  | 'incompatible-catalog-entry'
  | 'container-empty'
  | 'invalid-props'

type SystemFailureReason =
  | 'missing-renderer'
  | 'runtime-start-failed'
  | 'surface-host-unavailable'

type TransitionFailureReason = 'runtime-not-started'

type RenderFailure =
  | {category: 'content'; reason: ContentFailureReason; partKey: string | null; containerKey: string; surfaceForm: SurfaceForm}
  | {category: 'system'; reason: SystemFailureReason}
  | {category: 'transition'; reason: TransitionFailureReason}
```

`invalid-props` 归 content 是调用方提供给 screenPart 的内容契约失败；它不会污染系统 ready，因为 host/runtime 仍可画出带定位码的 content failure container。`container-empty` 也是 content：它表示当前容器没有可展示的业务 part，不是 runtime 无法启动；当它来自无默认容器时，`partKey=null`，显示 `containerKey`/`surfaceForm`，不编造 token。

`runtime-unavailable` 迁移为 `runtime-not-started`（transition）、`runtime-start-failed`（system）和 `surface-host-unavailable`（system）。`missing-renderer` 保持 system，四个旧内容 reason 保持 content。`ScreenContainer` 用 `failure.category` 分支；不得写 `reason !== ...` 或维护第二张 reason-to-category 字符串表。

所有由 screen/layer resolver 发出的 content diagnostic 都必须带 `category`、`reason`、`partKey`、`displayMode`、`containerKey`（screen 为实际 key，layer 为 `null`）与当前 `surfaceForm`；无 placement 的 `container-empty` 同样发出 `partKey:null` 的 typed diagnostic；`invalid-props` 另带脱敏后的 `valueType`。因此 missing/invalid 不能只记一个 part key，`incompatible-catalog-entry` 也必须沿同一字段形状上报。system/transition diagnostic 不借用这些 content 字段来伪造定位。

### 12.2 fallback、文案与 testID

- content fallback 不再是空 `Text`：它是当前 container 内可见的 `Text`/primitive，包含“页面找不到”、`partKey`（`container-empty` 无默认时为空）和 `surfaceForm`。四种 content reason 共用 content failure testID 前缀，但 reason 作为 typed prop 可单独断言。
- system failure page 保留现有启动/运行期两档 testID 与标题语义；它只消费 system category。transition 使用中性 loading/fallback，不显示 system failure page。
- 拆分后的 neutral fallback testID 必须是稳定的 capability 名：`ui-base-render:fallback:runtime-not-started`、`ui-base-render:fallback:runtime-start-failed`、`ui-base-render:fallback:surface-host-unavailable`；四个 content reason 使用明确的 content testID。旧 `runtime-unavailable` 断言逐项迁移，不保留兼容 alias。
- system failure 页面只在目标 PRIMARY 物理表面出现；SECONDARY 保持中性 fallback。content failure 所有表面都可见，但只有目标 PRIMARY 可 ready/hide；Web 没有原生 splash，也不写 PRIMARY startup event。
- 失败页文案沿需求裁决：启动期“终端启动失败”，运行期“终端运行异常”，说明“请重启终端，如仍失败请联系管理员”；本批不加重启按钮。not-found 不使用该文案，避免把业务配置问题说成机器故障。

### 12.3 ready input 与 startup writer

```ts
type RenderSurfaceReadyInput = {
  surfaceKey: 'PRIMARY'
  displayIndex: 0
  displayMode: DisplayMode
  containerKey: string
  readyPartKey: string | null
  contentFailure: ContentFailureReason | null
}
```

`ScreenReadyBoundary` 只在目标 PRIMARY 物理表面的实际 layout 完成后发出该输入。resolved 内容的 `contentFailure=null`；可见 content fallback 携带对应 reason；transition/system 不发 ready。`readyPartKey` 不从容器为空时编造，`contentFailure` 必须显式消费。

R-16 的顺序不能由当前 `failureStage` 的默认三元选择间接继承，必须有独立 focused 时序用例：先在目标 PRIMARY 挂载一个可见的 content failure，完成首次布局并断言它已 ready、没有 system failure page；随后在不重置 `hasPrimarySurfaceReady`、不重新挂载的前提下注入 system failure，断言显示运行期标题与运行期 testID，并与 ready 前注入同一 system failure 时的启动期标题/testID 区分。只有 category matrix 而没有这段先后顺序，不能证明该裁决。

console-assembly 的 readiness 仍要求六个真实启动组 `modules/slices/commands/actors/ports/parts` 全完成，加上 PRIMARY declared、measured、real ready。writer 是 `startup.complete` 的唯一写入者；platform-ports logger 只 sink，不判定、不覆盖调用方的 startupRunId。`startup.complete` 的 payload 增加 ready part/category information，但不新增生产诊断事件。重复事件在同一 run 只写一次。

两个 integration 的 ready payload 同步增加 `readyPartKey:string|null` 与 `contentFailure:ContentFailureReason|null`；actor 日志输出结构化 category/reason/part/container/run identity。sample1 的既有 partKey、layerId、testID 保持不变。

### 12.4 默认与失效容器恢复

默认值只由 integration 声明，沿 `integration → consoleAssembly input → SurfaceRoot/SurfaceContext → container selection` 传递；`console-assembly` 不出现业务 `partKey` 字面量。当前源码的默认清单是事实而不是“当前预期”：两个 integration 的 assembly 都没有 `defaultContainerPartKeys` 或其他 PRIMARY 默认字段，`console-assembly` 也没有默认 part 入口。两套装配的 PRIMARY placement owner 必须合并核对：

1. 共享 `sample-staff-auth` feature 的 `apps/terminal/ui/feature/sample-staff-auth/src/features/actors/actors.ts:32-37` 定义 `showLogin`，并由同文件 `:52-59` 在 `logoutSucceededCommand` 与 `sessionRestoredAnonymousCommand` 上派发 PRIMARY `main/sample.auth.login`；该 assembly 在 `sample-console/src/assembly/assembly.tsx:39` 与 `sample-wallpaper-console/src/assembly/assembly.tsx:63` 都被汇总，module 也分别在 `:100` 与 `:83` 装入。
2. `sample-member-desk` 只装入 sample-console（`apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx:40,101`）；其 `:82-105` 在认证成功后派发 PRIMARY member list，匿名恢复只尝试 SECONDARY welcome，不清除或覆盖 staff-auth 的 PRIMARY login。
3. sample-console 的本地 `createSampleConsoleModule`（`apps/terminal/ui/integration/sample-console/src/application/module.ts:23-38`）只有 startup-ready actor，没有 screen placement owner。
4. sample-wallpaper-console 的本地 `apps/terminal/ui/integration/sample-wallpaper-console/src/features/actors/actors.ts:49-67` 在认证成功/恢复认证时派发 PRIMARY picker，在匿名/退出时只尝试 SECONDARY waiting；`sample-wallpaper-picker` 的 actor（`apps/terminal/ui/feature/sample-wallpaper-picker/src/features/actors/actors.ts:65-113`）只处理壁纸命令与 layer，不派发 screen。因共享 staff-auth 同样消费匿名恢复命令，wallpaper 的匿名 PRIMARY 最终并非空。

因此，两个当前 integration 在稳定的匿名恢复旅途里都有真实的 PRIMARY `sample.auth.login`，没有可把 `readyPartKey=null` 归因于“当前生产匿名路径”的事实。U-6 的 null 分支改用显式 focused synthetic fixture：它代表 screen container 合法存在但没有 placement/default 的通用生产状态形状，验证 nullable ready contract 与“不得编造 partKey”；它不冒充两个 integration 当前旅途，也不宣称有真实 anonymous empty journey。若产品要把某一正常匿名旅途改为无 PRIMARY placement，另行升为产品语义裁决，本批不自行改变 actor。

读时恢复选择“裁剪 hydrated containers”：

1. `parseContainers` 保留现有记录格式；结构无效记录产出 `hydrated-container-invalid`，catalog 缺席或当前 form 不可用（包括未知/已退役与其他机型）统一产出 `hydrated-container-not-renderable`。不把无效记录写回成默认值。
2. hydration/prune actor 在 render/surface 创建前遍历全部 workspace/display mode，移除当前运行时与 owner-only 持久化记录中的当前 catalog 不可渲染 container；其余有效记录保留。它复用现有 content write/flush owner，不新增 view-only persistence 通道。
   当传入 catalog 完全没有 container declaration 时，actor 不执行 container membership prune：此时不存在可用于判断历史 container 合法性的 production oracle，保留现有 layer-only runtime/test fixture 的既有状态契约；一旦 catalog 含有至少一个 container declaration，生产装配路径即按上面的全量遍历执行，不把该边界伪装成默认回落。
3. 不建立也不传递全量 declaration metadata；其他机型与已退役/未知在运行期共用 `hydrated-container-not-renderable` reason 和同一中性定位文案“该恢复记录在当前 catalog 中不可呈现，已移除本次恢复记录”。需求 R-9 的“区分或改写文案”在此选择零跨层通道的改写文案分支；文案不把任一成因误说成机型问题。
4. 可选默认值只在没有有效 container placement 时被选择。显式 `show-screen` 仍可进入 content not-found，不能被默认值静默吞掉。
5. layer 继续复用现有启动裁剪；U-7b 同时观察 layer render tree 和 container state，确保没有 backdrop/关不掉空层；当前生产跨机型交叉机型恢复在过滤上线后再由 A-3 的 focused recheck 覆盖。

容器裁剪调用现有普通 content write 的 persistence flush，把当前不可呈现的 hydrated placement 从 owner-only 本地记录中清除；这保证后续冷启动不会继续恢复到 not-found。它不把 default 写回 container，也不新增 schema/migration 或另一条 view-only persistence 通道。

这比 fallback-to-default 多一个 ui-state prune 变更，但保留了用户/调用方显式请求失败的可见事实，且与既有 layer prune owner 同形；不引入第二 catalog 或持久化迁移。

### 12.5 冲突与过滤

`consoleAssembly` 在汇总 `[...adminShellAssembly.parts, ...input.parts]` 后执行：

1. 按 `partKey` 分组，检查每条声明的 `surfaceForm` 是否非空、单条内部无重复 form；同组任两条 form 集合相交立即抛配置错误，错误含 `partKey` 与重叠 forms。只有一条同 key 时不报 overlap，但仍校验其自身声明。
2. 对全量 parts 按当前 `input.surfaceForm` 过滤。
3. 对 filtered parts 保留 `assertUniquePartKeys`，再一次性建立唯一 `UiCatalog` 与 renderer catalog。

`createUiCatalog` 的公开导出不承担生产冲突扫描；直接调用它的测试必须被明确命名为非装配 catalog unit，或改走真实 assembly。这样既不在所有 catalog builder 上复制装配上下文，又不允许 hand-built test 代表生产语义。

### 12.6 R-10 sibling contract

R-10a 先把 admin console、platform-ports、runtime、display-context 四个 key 各拆为 laptop/mobile 两条条目，两个 renderer 暂时指向同一现有组件。每组 forms 不相交，`rendererKey` 不同。

R-10b 再把组件拆到普通文件名，例如 `AdminShellLaptop.tsx`/`AdminShellMobile.tsx`、`PlatformPortsSectionLaptop.tsx`/`PlatformPortsSectionMobile.tsx`、`RuntimeSectionLaptop.tsx`/`RuntimeSectionMobile.tsx`、`DisplayContextSectionLaptop.tsx`/`DisplayContextSectionMobile.tsx`；精确最终文件名由 implementation 在该目录内按 TR-14 核对，但不得使用 Metro 未配置的 `.laptop.tsx`/`.mobile.tsx` resolver 机制。

U-15 的 focused test 取 `definePart` 归一化后的 `catalogEntry` 七个语义字段，再加 `rendererBinding.layerTier` 和 `rendererBinding.layerGuard` 比较；排除 `surfaceForm`、`rendererKey`、component，单独断言 rendererKey 唯一。不给通用 `definePart` 增加 sibling-aware 机制，避免把一个 admin 局部约束扩散到全仓。

### 12.7 admin layout、hook 与 public surface

- laptop：根为 `PrimitiveContainer layout="fill"`，RN style 明确 `flex:1,width:'100%'`；内容父节点 `flexDirection:'row'`，左侧 section list、右侧 detail；header 只保留标题/关闭；display-context 成为一个 section。导航使用 list/listitem 或 button 语义，初次 focus 落在当前 section，详情 heading 在选择后获得可读焦点；具体实现复用 `ui/base/primitives` 的 `PrimitiveHeading`，由其真实 host `Text` 提供 `accessibilityRole="header"` 与 `accessibilityLiveRegion="polite"` 的可读播报，不新增 imperative focus 或第二个焦点 owner；关闭/返回恢复进入 admin 前的 focus scope。
- mobile：根同样 fill；`PrimitiveGrid` 现有 `flex-row flex-wrap` 作为分区条，下面只有一个 content frame 和一个纵向 scroll owner；当前冻结分区集合在 360×640 下入口均可见、可点、未裁剪，选中态可辨识。使用 tablist/tab 语义；不新增横向滚动或 `BackHandler` 备选路径。
- LayerStack 去除全屏内容的 `alignItems:'center'`、`justifyContent:'center'`、`padding:24`；遮罩/决定性 layer 语义不改。9 个 card 调用点/8 个组件分别移除统一 bounded 留白或改由自身 card content 负责；content 层和四个 section 的 bounded 也逐项处理，不能只改 root。
- 只使用 primitives 已有 token 或 RN style；不在 admin-shell/render 新增 tailwind utility，不添加新 token。
- `useAdminSections` 放在 admin-shell `src/hooks/`，一个文件一个 hook；返回 `sections`、`selectedPartKey`、`selectedSection`、`selectSection`，不读取/分支 `surfaceForm`。selected 回落由 laptop/mobile component 根据它各自收到的 section 集合决定，登录态仍归 `AdminLayer` 本地。
- `AdminLauncher`、身份/testID 常量、assembly、integration 使用的 section types 保留在 public surface；form-specific renderer 与内部 orchestration 组件不新增公共出口。实施前重新搜索所有仓内 import；若发现仓外契约依赖旧 orchestration export，保持 OPEN 并交 Dexter，不用兼容别名掩盖。
- `terminal-invariants.json` 与 public-surface focused test 精确同步；四个 integration README 和 admin-shell README 按 TR-10 描述“未过滤输入完整、装配期过滤、调用方只传 partKey、单机型文件名”语义。

## 13. U-1～U-15 执行体与绕过闭合

下表是实现后必须执行的最低证据计划。`UNVERIFIABLE_BY_MACHINE` 不是 PASS；它表示结构/属性 focused 不能证明的部分必须由 D-13 设备证据承接。

| 判据 | 执行体与落点 | 红夹具/反例代入 | 证据档位与结果 |
|---|---|---|---|
| U-1 | 两个 integration 的真实 `createSampleAssembly({surfaceForm})`；断言 filtered catalog 只含当前 form；不调用 `createUiCatalog` 绕过 assembly | 把 central filter 改成 identity，或只测一 form；真实 assembly 必须红 | focused；必须同时得到 laptop/mobile 两组 |
| U-2 | console-assembly overlap test 使用 R-10a 真实 admin sibling；分别以 laptop/mobile assemble；断言错误含 key 与 overlap forms | 只影响另一 form 的 overlap；`toThrow()` 不核 message；任一均必须红 | focused/static；任一 form 启动都红 |
| U-3 | real assembly + distinct laptop/mobile renderer fixture；caller payload 只有 partKey；断言另一 renderer 不在当前 renderer catalog | 按 rendererKey 拼 partKey、只断言存在、不验缺席，必须红 | focused |
| U-4a | `resolvePart`/`ScreenContainer` screen missing fixture；structured logger sink 断言 key/form/container；render tree 断言 content failure text | 只日志、空 fallback testID、缺 visible key/form，必须红 | focused + D-13 visual |
| U-4b | 既有回归护栏按**具名用例**点名；每个具名用例的实现与断言逐字不变：`apps/terminal/kernel/base/ui-state/test/acceptance.test.ts` 的 `U-3 rejects a duplicate layer id without changing the stack`、`U-7 restores containers and layers after restart`、`U-12 rejects an unavailable layer part before the content write`；`apps/terminal/kernel/base/ui-state/test/content.test.ts` 的 `restores containers and layers with order, props, and openedAt across a runtime restart`、`drops malformed and duplicate hydrated rows while retaining valid order and diagnostics`、`prunes unknown catalog members across all four buckets without pruning known layers`、`keeps a catalog member when it is unavailable for the current surface`、`rejects duplicate layer ids, leaves the stack unchanged, and records a safe diagnostic`；`apps/terminal/ui/base/render/test/renderContracts.test.ts` 的 `T-13 excludes a layer-only declaration from a real container enumeration` 与 `R-19 preserves the empty containerKeys transfer across the real package boundary`；两个 integration 的 layer persistence/restore tests（`sampleAssembly.test.tsx` 的 `persists the admin layer while keeping section selection ephemeral`、`restores the real admin layer and business screen across a cold runtime restart`、`keeps a business command alive while the admin layer opens over the business surface`；`sample2Assembly.test.tsx` 的 `restores confirmed wallpaper, pending choice, business screen, and admin layer after restart`）。同一 `sampleAssembly.test.tsx` 还包含 D-1/D-10 要求改造或降级的 hand-built catalog 用例，因此该文件级 diff 非空是预期，不再把“文件 diff 为空”作为 U-4b 条件。由于当前没有直接挂载 `LayerStack` 的 focused test，新增 `apps/terminal/ui/base/render/test/layerStack.test.tsx` 用例 `renders no backdrop for an unavailable layer part while preserving layer admission behavior`，直接观察渲染过滤与 backdrop/关闭语义；新用例是补足覆盖，不替换上述既有护栏 | 把具名用例改写为迁移后的新测试、把派发拒绝降成只测 state、把 unavailable layer 渲染成 backdrop、或删除新 LayerStack 断言，必须红；允许同文件其他用例为 D-1/D-10 改动，不得借此改写具名护栏 | focused regression guard；以具名用例实现/断言不变为 oracle，文件级 diff 由 D-1/D-10 单独解释 |
| U-5 | 四个 content reason 分别 render；primary/secondary/Web context；断言 content visible payload、target PRIMARY ready、无 system page；像素可见/未裁剪/非零高另走设备证据 | 空 Text + testID、沿用重启文案、SECONDARY ready、not-found system page，必须红 | focused 属性 + native/Android/Web visual future；visual `UNVERIFIABLE_BY_MACHINE` |
| U-5b | `apps/terminal/ui/base/render/test/renderSurface.test.tsx` 的 typed category matrix 覆盖 4 content、3 system、1 transition，并点名 `reports an incompatible catalog entry as visible content failure and PRIMARY ready` 与 `keeps a system failure neutral on the SECONDARY physical surface`；同一 focused 集合新增时序用例 `keeps a content failure ready before a later system failure uses the runtime variant`：先在目标 PRIMARY 让 content failure 完成可见首次布局，断言 ready、无 system page；再不重置 ready state/不重新挂载地注入 system failure，断言运行期标题与运行期 testID，并与 ready 前同一 system failure 的启动期标题/testID 区分 | 改 category 归属、漏 transition、SECONDARY system page、删掉第一段 content-ready、在第二段把 ready state 清回 false、或让第二段仍使用 startup testID，必须红；仅读取 `failureStage` 的默认结果不算执行体 | typecheck + focused；时序段是 R-16 的强制证据，不能由分类矩阵或作者描述替代 |
| U-6 | 无 container record、结构无效 record、当前不可呈现 record、valid record independent runtime；用显式 focused synthetic fixture 覆盖合法“无 placement、无默认”的 `readyPartKey=null` 状态形状（当前两个 integration 的匿名恢复并非该路径），另以显式 default fixture 覆盖“有默认时只呈现”；断言 default 只呈现不写入反序列化 key 集合，结构无效与当前不可呈现分别记录 `hydrated-container-invalid`/`hydrated-container-not-renderable`，失效记录下次冷启动可恢复 | 派发默认写表、为 unknown/other-form 传 declaration metadata、只用 `not.toContain`、只测首次启动，必须红；若把 synthetic fixture 改写成现有 integration anonymous production path，事实对账必须红 | focused + future native/restart；synthetic fixture 只代表允许的空容器语义，不冒充当前旅途 |
| U-7 | 两 integration 两 form 的既有 journey 行为；wallpaper laptop-only parts mobile 维持“无可用 secondary”行为；层级/关闭/遮罩/focus 对照 | catalog equality、只验存在、不验 layer behavior，必须红或 OPEN | focused；视觉非本条绝对结论 |
| U-7b | 在一形态持久化单机型 layer/container，另一形态独立 runtime hydrate；A-2 先覆盖结构无效/未知记录，A-3 在真实 assembly filter 已生效后追加跨机型 hydrated container 的 focused recheck；两段都检查 selector 与 render tree 无 backdrop/空层，非渲染原因统一为 `hydrated-container-not-renderable` | 同形态重启、在 filter 前宣称 other-form 已被真实执行、双机型 fixture、只测 state，必须红 | focused + future native/restart；完整 U-7b 直到 A-3 recheck 才可收口 |
| U-8 | review 逐项把单机型 declaration 与 renderer basename 对照；real assembly 断言只注册当前 form | 只改名、双候选 resolver、component 仍双注册，review 必须 OPEN | review-only + focused registration；不建机器门 |
| U-9 | focused 精确 flatten style：root 非 card、无 maxWidth、flex:1；LayerStack align/justify/padding 精确值；9/8 card/content/sections 清单逐项对账 | 否定式“不存在居中”、把居中挪别处、mask 改透明，结构/人工审查必须发现 | focused 属性 + D-13 device visual；ROI 仅辅助，visual `UNVERIFIABLE_BY_MACHINE` |
| U-10 | focused 断言 list/detail 共享父、row、display-context section、header 无三行；laptop 设备证据确认真正同屏/无遮挡/未裁剪 | 结构通过但纵向堆叠/宽度 0/详情裁剪，设备观察必须 OPEN | focused structure + D-13 visual/measurement |
| U-11 | mobile 360×640 设备/测量证据逐个入口可见、可达、可点、未裁剪、选中态可辨；focused 验 section selection | 只测切换或使用未授权 BackHandler 备选，必须 OPEN | focused + Android/native visual future |
| U-12 | 两 renderer 用同一 hook 的 wrapper 行为比较；AST 遍历 hook 及本包内依赖闭包，禁止 surfaceForm read；跨包 helper 仍 review-only | hook 分支、复制 hook、空壳 hook、把分支下沉依赖，分别由行为/AST/review 识别 | focused + static AST + review |
| U-13 | 两 integration 各自真实 assembly、两 form；sample-console 断言共享 3 + sample admin-test，wallpaper 只共享 3；partKey/testID 不变 | 共用错误分母、只测 sample-console 示例 section、改 ID，必须红 | focused |
| U-14 | 断言未过滤 assembly input 完整含 8 admin parts；再断言两 form filtered catalog 的 4 admin 可渲染 | 用 filtered 8 条构造 catalog、只数数量、只验输入/只验渲染，必须红 | focused + TR-13 review |
| U-15 | admin-shell focused 取归一化 catalog 七字段 + binding tier/guard；四组全验；rendererKey 唯一 | 漏 layerGuard、只验 console、源码文本误报、rendererKey 重复，必须红 | focused |

U-9/U-10/U-5 的“看得见、铺满、真正同屏、未裁剪”不能由 React test renderer 或 ROI 差分单独证明；设计只把它们拆成结构/属性段与 D-13 的显式视觉段。

U-4b 的充分性判断：上述既有文件覆盖 layer admission、hydration/persistence、catalog/layer-only contract、integration layer restore 等回归，但没有任何测试直接挂载 `LayerStack` 并观察 unavailable layer 的渲染树/backdrop/关闭行为。`apps/terminal/ui/base/render/test/catalog.test.ts` 中的 `rejects duplicate renderer keys and exposes no mutation entry point`、`keeps omitted layerTier distinct from an own undefined layerTier` 与 `rejects extra renderer binding fields at the render catalog boundary` 只覆盖 catalog/binding，不替代该行为。因此新增的 `layerStack.test.tsx` 是必要的最小补覆盖；它不改写既有 U-4b 判据，也不把 state-only 断言当作渲染 oracle。

## 14. 证据分档计划

本轮没有采集证据。未来实施按以下档位分离记录，不能把低档位升级成高档位：

| 档位 | 能证明什么 | 不能证明什么 | 计划产物 |
|---|---|---|---|
| static | imports、类型 union、assembly 输入、basename、invariant、README、AST hook 闭包 | 真实布局、触摸、splash、runtime 时序 | `doc/evidence/platform/2026-09-16-ter-screen-part-form-resolution/static.md` |
| focused | owner API、real assembly、分类分流、hydration 状态、style 属性、testID/行为 | layout engine 计算、真实双屏/冷启动可见性 | `focused.md` 与各包原始输出 |
| native/Android | 物理 surface、360×640、双屏、冷启动、触摸焦点 | Web 预览事实 | `native-primary-secondary.md`、`u11-mobile.md` |
| Web | Web 预览 content failure visible、partKey/form 与无 native splash | Android native readiness | `web-content-failure.md` |
| visual/release | 目标画布铺满、无 mask、laptop 真同屏、content failure 非零高；release 冷启动 ready 时序 | 不能替代分类 focused/type proof | `u5-content-failure.md`、`u9-full-screen.md`、`u10-master-detail.md` |
| cleanup | 受管运行资源按 manifest/PID/start token 关闭且无残留 | business 行为 | `cleanup.md` |

D-13 设备证据固定记录设备形态/逻辑分辨率/物理分辨率、t0、ROI、改前基线来源、观察语句、判定人和截图/原始测量路径。ROI diff 只能作辅助：它证明同一 ROI 有预期方向变化，不证明“铺满”或“遮罩消失”。本轮未执行任何 runner、设备或 cleanup。

## 15. D-1～D-15 逐项结论

| D | 结论 | owning source / 落点 | 最低证明 |
|---|---|---|---|
| D-1 | full parts 在 `consoleAssembly` 先 overlap、后 filter；公开 `createUiCatalog` 不补一套生产冲突机制；hand-built tests 改真实 assembly 或明确非生产命名 | `ui/base/console-assembly/src/foundations/consoleAssembly.tsx`、sample-console test、U-1/U-2/U-14 | real assembly + pre/post input assertions |
| D-2 | 选 category discriminated union；拆三值；content container 变可见；ready input 带 `contentFailure`/nullable key；迁移 fallback IDs；不使用重启文案 | `ui/base/render/src/types/props.ts`、`resolvePart.ts`、`ScreenContainer.tsx`、`ScreenReadyBoundary.tsx` | typecheck + category matrix + visible content evidence |
| D-3 | 默认只在 integration；经 assembly/surface/container selection；当前两个 integration 与 console-assembly 均无显式 default 字段，两个 integration 的稳定匿名恢复都由共享 staff-auth actor 放置 PRIMARY `sample.auth.login`；失效容器选 hydration prune，不写 default、不在 assembly 写 literal；container-empty 归 content；U-6 的 null 用 synthetic fixture，不冒充当前 integration 旅途 | integration assembly/placement actors、`workspaceSlices.ts`、`contentActors.ts` | restart/focused invalid/empty/default matrix；U-6 以 typed nullable contract 证明无 placement 状态 |
| D-4 | `parseContainers` 区分结构无效与当前不可呈现；unknown/retired/other-form 共用 `hydrated-container-not-renderable` typed diagnostic 与定位文案，不建立 declaration metadata 通道；prune 与 layer 诊断同一 owner | `workspaceSlices.ts`、ui-state actors/diagnostics | diagnostics sink focused；A-3 追加真实 cross-form 恢复复验 |
| D-5 | 普通 `Laptop`/`Mobile` basename；不依赖 Metro resolver；TR-14 review-only，由实现交付前主 agent + Claude/Dexter 逐项核 | admin-shell parts/components、terminal coding standard | source review；不建命名机器门 |
| D-6 | 根/LayerStack/card/content/sections 三层分别处理；9 callsites/8 components + content + 4 sections 全清单；样式只用既有 token/RN | admin-shell、render、primitives | exact style focused + D-13 |
| D-7 | laptop master-detail；mobile wrap；info 为 section；roles、focus、close/back、empty/error、testID 在 IA §3 固定 | 配套 IA、interaction baseline、admin components | IA review + focused/device evidence |
| D-8 | `useAdminSections` 返回 finite sections/selected/fallback/select；登录态留 AdminLayer；hook 与本包依赖不读 form；AST 只覆盖本包闭包，跨包 helper review-only | admin-shell `src/hooks/`、U-12 | wrapper behavior + AST red branch |
| D-9 | 保留实际 integration/launcher/id/type public surface；单列 `RenderSurfaceReadyInput` 的 `partKey`→`readyPartKey:string|null` 与 `contentFailure` 破坏性公共面变更，并同步两个 integration `createStartupReadyPayload` 直接消费者；form-specific implementation private；invariant/public test/README 同批更新；仓内消费者搜索若发现外部依赖则 OPEN | render exported props/index、`ScreenReadyBoundary`、`RenderProvider`、console writer、两个 integration payload；admin-shell `index.ts`、`terminal-invariants.json`、README | public surface exact test + source search + 四包 typecheck/focused ready tests |
| D-10 | 两 integration tests 都走 real assembly；sample-console 两处 hand-built production-name test 改造/降级；逐字行为只在 R-10a same component 证明；三生产 section 分母按 integration | both integration tests | U-7/U-13 real assembly |
| D-11 | 机制批 R-1～R-9/R-15/R-16/R-10a；admin 批 R-10b～R-14；R-6 与旧需求四处/标准同步在机制批；机制批未零回归不得开 admin 批 | implementation plan §4 | CP-1～CP-4 gates + fresh 3D reconciliation |
| D-12 | admin-shell focused normalized semantic comparison，不改通用 `definePart` sibling-aware | admin-shell focused test、`definePart.ts` unchanged | U-15 mutation |
| D-13 | U-5/U-9/U-10 设备/分辨率/ROI/baseline/judgment/evidence path 见 §14；ROI auxiliary；由指定 visual reviewer 判定 | `doc/evidence/platform/...` future | release/native/Web future; no current PASS |
| D-14 | 360×640 每入口 visible/reachable/tappable/unclipped/selected；只采用 wrap，不需 BackHandler alternate | IA §3.2、U-11 | device observation + focused selection |
| D-15 | sample-console 分母=共享 3 + sample admin-test；wallpaper=共享 3；新增 section owner 必须同步 fixture/test/README/IA 清单 | integration assembly/tests + admin-shell parts | U-13 exact-set review |

## 16. 之前 Codex 可行性 finding 的处置

以下保留历史 finding 的问题族，不改写历史 verdict；本表是当前详设如何承接的说明，当前文档仍待新的 DESIGN review。

| Finding | 当前处置 | 落点 | 证据 |
|---|---|---|---|
| M-01 机制与 admin 组件分化混批 | 接受并拆 R-10a/R-10b；same component 先证明零回归 | D-11、CP-4/CP-5、计划 §4 | U-2/U-14/U-15 |
| M-02 兄弟字段逐字口径与 binding 漏项 | 接受；归一化 catalog 七字段 + binding tier/guard | R-10、D-12、U-15 | focused mutation |
| M-03 过滤/测试形态可能互相绕过 | 接受；真实 assembly 作为 U-1/U-13 入口，hand-built 降级 | D-1、D-10、U-1 | identity-filter mutation |
| M-04 ROI 被误用绝对 oracle | 接受；结构/属性与视觉分离，ROI 仅辅助 | D-13、U-5/U-9/U-10 | future visual evidence plan |
| M-05 laptop 同屏无法由结构测试证明 | 接受；shared parent/row 是结构段，真实同屏是设备段 | D-7、D-13、U-10 | future device evidence |
| S-01 layerGuard 位于 rendererBinding | 接受；U-15 比 binding 两字段 | §12.6、U-15 | normalized focused |
| S-02 overlap 必须在任一 form发现 | 接受；pre-filter full group | §12.5、U-2 | real overlap fixture |
| S-03 layer 行为与 screen not-found 不统一 | 接受；R-4 两条 owner 分离 | §12.1/§12.4、U-4b/U-7b | existing layer regression |
| S-04 content 可见无单测 oracle | 接受；`UNVERIFIABLE_BY_MACHINE` + D-13 | §13/§14 | future native/Web visual |
| S-05 U-12 helper scope | 接受边界；本包依赖闭包 AST，跨包 helper review-only | D-8/U-12 | AST red mutation + review |
| S-06 R-13 mobile 能力过度 | 接受；复用 PrimitiveGrid wrap，不加 horizontal scroll | §12.7、IA | focused/device |
| S-07 U-13 分母 | 接受；按 integration 冻结 | D-15/U-13 | two integration tests |
| S-08 U-15 默认归一化 | 接受；以 definePart 输出为基准 | §12.6/U-15 | normalized comparison |
| N-01～N-03 计数、命名、对账 | 接受；9/8、TR-14、逐代码对账分别进入 D-6/D-5/计划 §8 | §15、计划 | document/source reconciliation |

## 17. 未决、停机与交付前置

| 项目 | 当前状态 | 本批允许 | 本批禁止 |
|---|---|---|---|
| Dexter/Claude DESIGN review | OPEN | 评审本文、IA、计划及已同步权威文档 | 宣称设计 GO 或进入实施 |
| Dexter wireframe review | UNSET | 以 IA 提交评审 | 以旧 interaction artifact 自称本轮视觉接受 |
| L2/设备/Android/Web | BLOCKED by current authorization | 在计划中定义未来 evidence | 本轮运行、构建、设备或 browser |
| cross-package helper AST gate | review-only | implementation review 核对 | 新建跨包 checker |
| obsolete orchestration exports/files | implementation preflight OPEN | 搜索真实消费者后删除 confirmed obsolete source | 为清洁而保留空壳或盲删 |

停机条件：发现需求的产品语义、Journey、权限、默认业务值与当前授权冲突；发现外部/仓外公共消费者依赖拟删除出口；或发现 D-13 所需的设备/runner 不能产生真实观察。类型/测试失败不是停机理由：未来实施应保留 first failure，定位 owning source，最小修复后 focused 重验。

## 18. 设计交付状态

```text
DESIGN_CLOSURE=AUTHORIZED_FOR_IMPLEMENTATION_BY_DEXTER
DESIGN_GAPS=最新复评三条 finding 已按当前源码和最小边界修订；未发现新的产品语义冲突；U-6 null 为 synthetic fixture，不冒充当前 integration anonymous journey
INDEPENDENT_SUBAGENT_REVIEW=COMPLETED（fresh 只读审查记录已保存；主 agent 已按其 findings 完成文档 intake）
INDEPENDENT_SUBAGENT_REVIEW_REQUIRED=YES；已完成本 implementation-facing design 的 fresh 只读前置审查，不以作者 readback 或 Claude/Dexter review 冒充
IMPLEMENTATION_AUTHORITY=true（Dexter 当前任务直接授权；仍受计划与“不扩大范围”约束）
SOURCE_MODIFICATION_IN_THIS_TURN=NONE（截至本设计修订段；随后实施阶段另行记录）
```

## 19. Claude 复评 finding 逐条处置

状态只描述本轮文档修订，不把未来 focused、设备或独立审查结果预报成 PASS。九条 finding 均按仓内事实确认并修正；没有拒绝项，也没有把尚未执行的审查伪装成已完成。

| finding | 处置 | 落点 | 证据/反例闭合 |
|---|---|---|---|
| M-1 | **真修复**：采用需求 R-9 允许的“改写文案”分支；不把 declaration metadata 从 assembly 传到 ui-state。结构无效仍单独用 `hydrated-container-invalid`，catalog 缺席/其他机型/已退役共用 `hydrated-container-not-renderable` 与同一定位文案。 | §7、§9a、§12.4、§13 U-6/U-7b、§15 D-3/D-4；IA §6；计划 A-2/A-3/§9 | 反例：若实现新增全量 declaration map 或恢复 `hydrated-container-other-form`，就违反本行并重开 finding；当前源码只证明过滤后无法区分，需求已允许用一个运维文案消除该区分，不足以证明永久跨层通道必要。 |
| M-2 | **真修复**：把“content failure ready → later system failure”写成独立 focused 时序执行体；明确不能靠 `failureStage` 默认继承。 | §12.3、§13 U-5b、CP-1 red mutation；IA-04；计划 A-1、§5、§9 | 反例：删除首次 content-ready、重置 `hasPrimarySurfaceReady`、或第二段继续用 startup testID，新增顺序断言必须红；分类矩阵单独全绿仍不闭合。 |
| S-1 | **真修复**：点名现有 layer admission/hydration/integration 文件及精确用例，并判断其不足：当前没有直接挂载 `LayerStack` 的 focused test，因此新增 capability 文件/用例补足渲染过滤与 backdrop/关闭行为；U-4b 约束具名用例的实现与断言逐字不变，不再要求文件级 diff 为空。`sampleAssembly.test.tsx` 其余被 D-1/D-10 点名的 hand-built catalog 用例允许受控改动。 | §13 U-4b；计划 A-3、B-2、§9；新增 `apps/terminal/ui/base/render/test/layerStack.test.tsx` 计划项 | 当前 `rg` 已核对所列既有用例；新增测试尚未执行。反例：只测 state、改写具名护栏用例，或不直接观察 LayerStack，U-4b 仍失败；同文件非具名用例发生计划内 diff 不构成 U-4b 失败。 |
| S-2 | **真修复**：恢复 R-S1 续段的两空格缩进，避免把“排除 fallback、content failure 可 ready”的规范从 R-S1 结构上拆成顶层条目。 | `doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-requirements-claude.md:342` | 当前 `nl -ba` 可见 R-E3 后的说明与该续段同为两空格缩进；反例是再次以 `-  ` 开头，后续按 R-S1 引用会漏掉该约束。 |
| S-3 | **真修复**：重做默认与 PRIMARY owner 清单，不再把局部 wallpaper actor 误当成完整装配事实。两个 integration 与 console-assembly 均没有默认字段；共享 staff-auth actor 在两个 integration 的匿名恢复/退出旅途都显式放置 PRIMARY `sample.auth.login`，sample-member-desk 仅在 sample-console 的认证旅途放置 PRIMARY，wallpaper 本地 actor 的匿名分支仅放置 SECONDARY waiting。因此当前没有真实稳定的 integration anonymous `readyPartKey=null` 路径，U-6 改用 synthetic fixture，并明示其只代表合法空容器状态形状。 | §12.4、§15 D-3；IA §5；计划 A-0/A-2、U-6 | 复核命令：`rg -n "showScreenCommand" apps/terminal/ui/feature apps/terminal/ui/integration/sample-console/src apps/terminal/ui/integration/sample-wallpaper-console/src --glob '*.{ts,tsx}' --glob '!**/test/**'`；再逐项重开 `sample-staff-auth/src/features/actors/actors.ts:32-67`、`sample-member-desk/src/features/actors/actors.ts:82-105`、`sample-wallpaper-console/src/features/actors/actors.ts:49-67`、两个 assembly 的 parts/modules 汇总，以及 `rg -n "defaultContainerPartKeys|default.*container|default.*part" apps/terminal/kernel apps/terminal/ui/base apps/terminal/ui/integration/sample-console apps/terminal/ui/integration/sample-wallpaper-console`。反例：只读 wallpaper 本地 actor、忽略 staff-auth 汇总，或把 synthetic null 写成现有旅途，都会重开本 finding。 |
| S-4 | **真修复**：A-2 只证明结构无效与未知/不可呈现的可执行段，不在过滤前声称真实 other-form；A-3 在 filter 生效后追加真实 cross-form hydration focused recheck，U-7b 直到该复验才收口。 | §12.4、§13 U-7b；计划 A-2、A-3、§5、§9 | 反例：A-2 仍把 other-form 列为真实分支并在 A-2 收口，或只用手搓不存在的 key 而无 A-3 recheck，finding 重开。 |
| S-5 | **真修复**：TER 机制表不再把 Web admin 前端规范作为 owning source；不适用项显式写 `N/A_WITH_REASON`，事实 owner 改指向终端 RenderContext/ui-state/AdminLayer/primitives。 | §3 横切机制表 | 反例：把 Web `frontend-coding-standard` 的条款继续列为 TER 的 owning source，会让本批约束落到错误边界；本修订只保留“不适用”的解释和终端实际 owner。 |
| N-1 | **真修复（状态仍 OPEN）**：明确这是新的 implementation-facing DESIGN review 对象，fresh 只读独立子 agent 审查是交付前置要求；本 doc-only 修订回合未运行该审查，不能宣称已闭合。 | 文档头部、§18、handoff 元数据/正文 | 证据是当前状态声明而非审查结果；反例：用作者 readback 或 Claude/Dexter review 代替 fresh independent review，仍不满足治理要求。 |
| N-2 | **真修复**：IA 的两处交叉对账状态统一为“作者自证；独立复核 OPEN”，删除孤立的 `MATCHED by author readback`。 | IA §7、§8 | 反例：同一 IA 一处写 MATCHED、一处写 OPEN，会继续混淆作者自读与独立对账。 |
| N-3 | **真修复**：在全链同步表和 D-9 公共面清单中单列 `RenderSurfaceReadyInput` 的破坏性变更及两个 integration `createStartupReadyPayload` 直接消费者，要求同批 typecheck/focused 同步，不保留旧别名。 | §9a、§15 D-9；计划 A-1/A-2、§10 | 反例：只改 `props.ts`/`ScreenReadyBoundary` 而遗漏两个 integration payload，公共类型变更应在 typecheck/ready focused 阶段红。 |

## 20. 最新复评 finding（M-4、S-6、N-4）处置

本节只处置最新 implementation-facing 详设复评提出的三条文档 finding，不改变需求已定的产品裁决。源码仍未在本轮文档修订中修改。

| finding | 处置 | 落点 | 证据/反例闭合 |
|---|---|---|---|
| M-4 | **真修复**：撤回“wallpaper 匿名 PRIMARY 为空/`readyPartKey=null` 是真实生产路径”的错误事实。重做两个 integration 的完整 placement owner 清单：共享 staff-auth 在两个 integration 的匿名恢复/退出时都放置 PRIMARY `sample.auth.login`；sample-member-desk 只在 sample-console 的认证路径放置 PRIMARY；sample-console 本地 module 只有 startup-ready actor；wallpaper 本地 actor 的匿名路径只放 SECONDARY waiting；wallpaper-picker actor 不派发 screen。两个 integration 与 console-assembly 都没有显式 default 字段。因此 U-6 null 改为 synthetic fixture，并明确它验证合法空容器状态形状与 nullable ready contract，不冒充当前匿名旅途。若未来把正常匿名旅途改为无 PRIMARY placement，另列产品语义裁决。 | §12.4、§13 U-6、§15 D-3；IA §5.1；计划 A-0、A-2、§9 | 仓内复核命令：`rg -n "showScreenCommand" apps/terminal/ui/feature apps/terminal/ui/integration/sample-console/src apps/terminal/ui/integration/sample-wallpaper-console/src --glob '*.{ts,tsx}' --glob '!**/test/**'`；再重开 `sample-staff-auth/src/features/actors/actors.ts:32-67`、`sample-member-desk/src/features/actors/actors.ts:82-105`、`sample-wallpaper-console/src/features/actors/actors.ts:49-67`、两个 assembly 的 parts/modules 汇总与 `rg -n "defaultContainerPartKeys|default.*container|default.*part" ...`。反例：只读 wallpaper 本地 actor、忽略 assembly 汇总，或把 synthetic null 宣称为当前 production journey，均重开 M-4。 |
| S-6 | **真修复**：把 U-4b 从文件级 diff 约束收窄到具名用例的实现与断言逐字不变；明确 `sampleAssembly.test.tsx` 因 D-1/D-10 的其他 hand-built catalog 用例改造而文件级 diff 非空是预期。 | §13 U-4b；计划 A-3、§9 | 反例：改写具名 U-4b 用例、用新测试替换旧护栏或不补 LayerStack 直接观察仍必须红；允许同文件其他计划内用例变化。 |
| N-4 | **真修复**：保留单一 `hydrated-container-not-renderable` reason，不增加 metadata 通道；将 other-form 与 retired/unknown 共用的定位文案改为“该恢复记录在当前 catalog 中不可呈现，已移除本次恢复记录”，不把原因误归于机型。 | §12.4；IA §5/§6；计划 A-2、§9 | 反例：恢复“当前机型无法呈现”或新增 other-form reason/metadata 会分别造成语义误导或违反 M-1 最小边界。 |
