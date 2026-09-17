# TER React UI selector 订阅规范与订阅边界收紧 · implementation-facing 详设

`SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0`

```text
DOCUMENT_KIND=IMPLEMENTATION_FACING_DESIGN
REVIEW_TARGET=DESIGN
BUSINESS_SOURCE=本轮 Dexter 直接任务：检查 TER React UI 的 selector 调用方式，并把它提升为框架级规范
JOURNEY_REFS=N/A_WITH_REASON：本批不新增 Journey、入口、业务动作或用户可见文案
IA_REF=N/A_WITH_REASON：本批不改变页面信息架构、布局、焦点或可见交互
INTERACTION_REF=N/A_WITH_REASON：本批只改变 React 状态订阅边界，不改变操作语义
REQUIREMENTS=本文件第 1 节与 Dexter 当前任务；没有另行创建重复的业务需求稿
AUTHORIZED=按本详设与实施计划实施源码、测试、依赖、规范、README，执行限定的 typecheck/test/static，并准备 implementation review handoff
NOT_AUTHORIZED=Web、Metro、Android、DEV、设备、seed、UAT、部署、Git、性能测量与性能结论
IMPLEMENTATION_AUTHORITY=true
DESIGN_STATUS=GO_BY_CLAUDE_ROUND_2; IMPLEMENTATION_STATUS=PREPARED_FOR_REVIEW
INDEPENDENT_SUBAGENT_REVIEW=ROUND_2_COMPLETE：fresh 只读记录于 `doc/review/platform/2026-09-17-ter-selector-subscription-performance-independent-review-codex.md`；一名 reviewer 给出 0M/0S/0N，另一名未完成全文核验并由主 agent按项目规则接管；最终 DESIGN verdict 仍交 Dexter/Claude
SCOPE_DECISION=方案二：本批定位为框架级 selector 调用规范与订阅边界收紧；不主张任何性能改善，render isolation 是订阅契约的行为结果而非性能验收结论
POST_CLAUDE_REVIEW=GO(0M/0S/3N)：`doc/review/platform/2026-09-17-ter-selector-subscription-design-review-round2-claude.md`；三条 Note 在本实施批同步处置
PATH_NOTE=文件名沿用创建时的路径以保持既有引用稳定；本批口径以当前标题与 SCOPE_DECISION 为准，不代表性能改善任务
```

本文件定义实现边界、公共契约、验收执行体和顺序；实现结果与证据见 `doc/evidence/platform/2026-09-17-ter-selector-subscription-implementation-codex.md`，不把静态或 focused 证据提升为运行期性能结论。本批不以“性能优化”命名或验收；它只定义 selector-aware 订阅边界、React UI 调用规范及其可验证行为。

## 0 · 现状恢复与设计边界

### 0.1 当前源码事实与设计动机

TER 的 `RenderProvider` 为所有 React UI 提供一个外部状态源。当前 `useRenderSnapshot` 使用完整的 `RenderSnapshot` 作为 `useSyncExternalStore` 的快照；只要 Runtime 以新的 root 引用发布一次变更，依赖该 hook 的组件都会重新 render。`useUiStateSelector` 随后才从 snapshot 的 `root` 上执行 selector，并按 `root + selector identity` 缓存结果。

这解决了“同一个 root 不重复计算 selector”，没有提供“按选择结果隔离订阅”的契约。因此根 store 不是说每一笔数据变化必然重绘所有组件：如果外部源没有发布、root 引用没有变化或 React 最终能 bailout，可能不会重绘；在本仓不可变状态产生新 root 的路径上，当前 hook 的订阅边界仍然粗于业务选择边界。这是本批要收紧的框架行为边界；本批不把它升级为已测得的性能缺陷，不提供性能改善幅度或用户感知改善结论。

当前直接使用完整 snapshot 的生产分母为五个组件与两个共享 hook：

| 类别 | 当前位置 | 当前问题 |
|---|---|---|
| render 宿主 | `apps/terminal/ui/base/render/src/components/ScreenContainer.tsx`、`LayerStack.tsx` | screen/layer 所需选择与 status 混在完整 snapshot 中 |
| admin 宿主 | `apps/terminal/ui/base/admin-shell/src/components/AdminLauncher.tsx`、`AdminShellLaptop.tsx`、`AdminShellMobile.tsx` | admin 只需少量状态，却订阅整个 root 并把 root/source 继续向下传 |
| 共享 hook | `apps/terminal/ui/base/render/src/hooks/useUiStateSelector.ts`、`useUiVariable.ts` | selector/cache 建立在全量 snapshot 之上 |

已有 `SurfaceRoot`、wallpaper、member、request 等调用已经通过 `useUiStateSelector`，它们不是本批的遗漏；实现前仍须以 `rg` 重算全集，不能只相信当前清单。

### 0.2 规范目标与非目标

目标（方案二口径）：

1. React UI 的状态读取经过一个 selector-aware 的 TER framework hook；无关 root 更新且选择结果按约定相等时，订阅组件不重新 render。
2. `useRenderStatus` 单独订阅 Runtime status；业务 UI 不再为读 status 取得完整 root。
3. 需要 catalog context 的组件通过一个共享 typed adapter 选择 context，不能各自把 raw root 传入下游。
4. 把 selector 的纯度、稳定性、派生结果引用稳定和 Reselect 的适用边界写入终端框架规范 `TR-15`，形成可复用的调用契约。
5. 通过现有 `tools/terminal-ui-render/check-static.mjs` 增加机械边界，并用真实 red mutation 证明该门不会只是字符串存在性检查。

本批不主张性能改善，不定义 FPS、CPU、内存、首帧、延迟或用户感知阈值。F-1 等 render-count 用例只证明 selector-aware 订阅契约成立；“无关 root 更新且选择结果相等时不重新 render”是框架行为性质，不是性能数字或性能验收结论。采用方案二是因为当前没有改前运行基线，继续使用“性能优化”名称会把机制证明误读为问题存在性和改善幅度证明。

非目标：

- 不把所有 kernel actor/foundation 的 `getState()` 改成 React hook；那些代码不在 React render 订阅边界，继续遵循 `TR-03` 的 owner selector 规则。
- 不把每一个 scalar selector 强制改成 Reselect；Reselect 只负责派生计算缓存和引用稳定，不能替代 selector-aware subscription。
- 不做 virtualization、列表分页、渲染器缓存、状态切片重构、Runtime API 重做或任何性能基准/阈值研究。
- 不改变 screen/layer/admin 的业务行为、布局、partKey、testID、失败语义、命令或用户可见文案。
- 本批不执行动态 Web/Metro/Android/DEV/设备验证，也不宣称 FPS、首帧、内存或 release 性能 PASS。

## 1 · 方案比较与选择（规范边界方案）

| 方案 | 优点 | 代价/失败模式 | 结论 |
|---|---|---|---|
| A. 保持全量 snapshot，只在 selector 上使用 Reselect | 改动最少；复杂派生值可少算 | 仍不建立按选择结果隔离订阅的框架契约；只能改变派生计算缓存，不能满足本批订阅边界目标 | 拒绝 |
| B. 每个 slice 建立独立 React Context/Provider | 订阅粒度可能很细 | Provider 拓扑、生命周期和 owner 边界扩散；同一组件需要多个 slice 时会形成第二套组合机制 | 拒绝 |
| C. 用 `use-sync-external-store/with-selector` 建立一个统一 selector-aware hook，status/context 走同一框架边界 | 利用 React 官方 shim 的并发订阅语义；不新增 Provider；业务 selector 与现有 owner API 兼容 | render 包增加一个直接依赖；需要迁移完整 snapshot 消费者和补引用稳定测试 | **采用** |
| D. 自行在 render 包封装 `useSyncExternalStore` + equality | 不增加包依赖 | 需要自行维护 selector 记忆化与 equality 的边界情况；官方 React 订阅原语仍可复用，但自研封装扩大维护面 | 不采用 |

采用 C。`use-sync-external-store/with-selector` 只提供订阅机制，不改变 TER 的状态 owner；`useUiStateSelector` 仍调用 owner 导出的 typed selector。Reselect 在已有 owner selector 需要派生对象/数组时继续使用，但不作为本批的唯一修复。

## 2 · CP 总览

| CP | 内容 | owner | 产出 | 依赖 |
|---|---|---|---|---|
| CP-0 | 当前源码、规范、公共面、测试分母冻结 | 主 agent | preflight/readback 清单；不改文件 | 本详设与设计 review 通过 |
| CP-1 | selector-aware framework core | `ui/base/render` | 直接依赖、`useUiStateSelector`、`useRenderStatus`、`useUiCatalogContext`、内部 snapshot reader 调整 | CP-0 |
| CP-2 | render/admin 生产消费者迁移 | `ui/base/render`、`ui/base/admin-shell` | 五个完整 snapshot 生产组件迁移；去除 admin raw root/source pass-through；`useUiVariable` 迁移 | CP-1 |
| CP-3 | 框架规范与机械边界 | terminal standard、render invariant、`tools/terminal-ui-render` | TR-15、静态规则、真实 red self-test、README 与旧契约清理 | CP-1/CP-2 |
| CP-4 | focused/static 证据、三维对账与交付 | 主 agent + fresh reviewers | focused selector-contract proof、typecheck/static 结果、逐代码与详设对账、implementation review handoff | CP-3 |

CP-1～CP-3 是一个原子实现范围：只增加 hook 而留下完整 snapshot 消费者，或只迁移消费者而没有规范/门，均不能作为中间交付。CP-4 不增加产品机制，只收证据与交付。

## 3 · 横切机制对照表

| 机制 | 现成能力/正本 | 最低验证 | 本批形态与全集 |
|---|---|---|---|
| React 外部状态订阅 | `RenderContext.ts`、`createRenderSnapshotReader.ts`、React `useSyncExternalStore` | focused test 记录订阅、snapshot、selector result 与 render count | 所有 TER React UI 生产状态读取；raw source 只在 framework-private accessor；actor/foundation 不在此分母 |
| selector-aware 订阅 | `use-sync-external-store/with-selector` 的 `useSyncExternalStoreWithSelector` | 新 root + 相等 result 不增加 render；选中值变化恰好更新目标 consumer | `useUiStateSelector` 唯一通用入口 |
| Runtime status 读取 | `RenderProvider.tsx` 当前 status subscription | focused test 覆盖 unavailable→started→failed；不调用 `getState` 读取 status | `useRenderStatus`；不把 status 塞进业务 selector |
| catalog context 派生 | `createCatalogContext.ts`、ui-state owner selectors | context 相关字段变化更新；无关 root 更新不更新；比较器只比较定义字段 | `useUiCatalogContext`，仅 render/admin 宿主使用 |
| 跨包读 | `doc/platform/terminal-coding-standard.md` 的 TR-03 | source/static 与 focused 检查只经 owner selector，不读字符串 slice | 新/迁移生产 React UI 读取；kernel selector 本身不受误伤 |
| selector 纯度 | TR-03 与新增 TR-15 | focused red mutation 将 dispatch/写入放进 selector 必须失败；review 查副作用 | selector 不 dispatch、无 IO、无随机/时间；参数由稳定闭包提供 |
| selector identity | 本批 `useUiStateSelector` 公共 API | 参数化 selector 变更时重新计算；缺依赖的 stale closure focused case 必须失败 | module-level selector 或 `useMemo`/完整依赖；禁止错误空依赖 |
| 派生引用稳定 | 既有 RTK `createSelector` 与本地 owner selector | 数组/对象无关更新保持引用或显式 equality；选择变化仍更新 | expensive/derived object 优先 owner Reselect；不强制 scalar Reselect |
| 旧全量入口 | 当前 `useRenderSnapshot` | 删除 public export/invariant；重新引入生产 import 的静态 red mutation 必须失败 | 生产 React UI 禁止；framework internals 可保留 snapshot reader，但不暴露 hook |
| 组件 prop 传递 | `AdminSectionRenderContext`、`AdminSectionContent`、`RenderContext.ts` | typecheck/focused test 证明 public render context 不暴露 raw source，section 直接订阅所需值 | 删除 `stateRoot`/`stateSource` 生产 pass-through；保留 command/surface/runtimeFacts；framework-private accessor 只供 render hook |
| 静态执行体 | 现有 `tools/terminal-ui-render/check-static.mjs` 与 self-test | 每条机械规则有 baseline、真实 red mutation、cleanup | 扩展现有门，不新建 AST checker |
| focused mutation 执行体 | 现有 `tools/terminal-ui-render/check-behavior.mjs` | 复用既有行为 harness 执行 selector/status/equality/identity/unsubscribe 的真实 production mutation；只修当前源码锚点与依赖链接，不新增 runner | B1 focused proof；不把 mutation harness 当生产功能 |
| 文档正本 | `doc/platform/terminal-coding-standard.md`、render README | standard/README 示例回源码核对；旧 hook 约定不得继续当现行契约 | 新开 `TR-15`，不复制到 review standard |
| 日志/诊断 | 本批没有新增业务诊断事件 | focused 不以日志证明性能或规范成立；只确认无新增生产日志面 | N/A：不为 selector 订阅增加诊断噪声 |
| HTTP/数据库/seed | 本批无此类能力 | source scope 检查无 edge、DB、migration、seed 改动 | `N/A_WITH_REASON` |

### 3a · UI / L2 前置复核

```text
UI_DESIGN_REVIEW=N/A_WITH_REASON：不改变用户可见行为、布局、文案、焦点或 Journey
TESTID_REVIEW=N/A_WITH_REASON：现有 testID 必须保持不变，本批不新增 locator
L2_SCRIPT_ADMISSION=N/A_WITH_REASON：本批未授权且不需要浏览器 L2
```

## 4 · 框架契约：selector 应该如何调用

本节是拟写入 `doc/platform/terminal-coding-standard.md` 的 `TR-15` 内容。实施前由 Dexter/Claude review 该规范文本；实施时才修改规范文件。

### `TR-15` · React UI 状态读取必须经过 selector-aware framework hook

1. **唯一订阅入口**：`apps/terminal/ui/**` 的生产 React UI 组件读取 TER runtime state，必须使用 `@catering-v2s/ui-base-render` 的 `useUiStateSelector(selector[, equalityFn])`；读取 runtime lifecycle status 使用 `useRenderStatus()`。生产 UI 不得调用 `useRenderSnapshot`、`stateSource.getState()`、`stateSource.getStatus()` 或把 raw state root/source 作为业务渲染 prop 向下传递。`useRenderContext()` 的 public 返回类型不暴露 `stateSource`/`snapshotReader`；这两个字段只存在于 framework-private subscription accessor，供 render hooks 实现订阅。`useUiStateSelector` 的 `undefined` 不代表 runtime 生命周期或业务空值；需要区分 runtime unavailable 与业务选择结果为空时，必须同时读取 `useRenderStatus()`。
2. **selector 是纯读函数**：selector 只能从参数 root 计算返回值，不得 dispatch、写 store、调用 IO、读时间/随机数或修改输入。跨包状态只能使用 owner 导出的 typed selector；不得按字符串 slice key 读取别人的状态，仍受 TR-03 约束。
3. **调用身份必须稳定且完整**：无参数 selector 放在模块级；参数化 selector 使用模块级 selector factory 或 `useMemo`/完整依赖构造。禁止用缺少依赖的 `useCallback` 或 `useMemo` 把旧闭包伪装成稳定 selector。equality function 也须是稳定的，或由完整依赖构造。
4. **输出按形态选择策略**：scalar、boolean 和 owner 已稳定的引用可直接返回；派生对象/数组或昂贵计算由 owner selector/Reselect 提供稳定引用，或在确有理由时传入窄的 equality function。不得为了“使用了 selector”而对所有简单值套 `createSelector`。
5. **理解 Reselect 的边界**：Reselect 缓存派生计算和结果引用；它不改变外部 store 的订阅粒度。只把 `useSelector` 换成 Reselect selector、但继续订阅完整 snapshot，不能满足本条的无关 render 隔离。
6. **例外必须窄且可解释**：render framework 内部的 `RenderContext.ts`、`RenderProvider.tsx`、`createRenderSnapshotReader.ts`、`useUiStateSelector.ts`、`useRenderStatus.ts` 可以通过 framework-private accessor 读 source/snapshot 以实现订阅；`apps/terminal/ui/base/console-assembly` 创建 state source 并向 `RenderProvider` 注入 `stateSource` 属于 assembly→render 的基础设施装配接线，也不受“业务 UI 读取”禁令约束，但不得把 source 继续传给业务组件。专门验证订阅机制的 `ui-base-render` test 可以选择 full root。public `useRenderContext()` 不返回 raw source，外部 production UI 不能绕过 hook。上述例外不得成为 feature、integration、admin-shell 生产 UI 的调用模板。kernel actor/foundation 的同步 `getState()` 仍遵循其 owner API，不被错误迁移成 React hook。
7. **公共面与迁移**：`useRenderSnapshot` 不再是 render package public export；新代码只有 `useUiStateSelector`、`useRenderStatus` 和必要的 `useUiCatalogContext` 这组框架面。新增/迁移完成必须同时更新 package invariant、README、类型和静态边界。

TR-15 的机器可判定部分检查入口和明显越界：public render context 类型不暴露 raw source；生产源不能导入/调用 `useRenderSnapshot`，不能重新暴露它，且 admin section contract 不接收 raw root/source。`apps/terminal/ui/base/console-assembly` 的基础设施注入是显式例外，不能被误报为业务 UI pass-through。selector 纯度、参数依赖完整性、返回值语义和 equality 是否合理属于 focused test 与独立 review；不能用正则声称已证明这些语义。若实际 checker 无法跨 `apps/terminal/ui/**` 稳定判定，B0/B4 必须输出完整 exact-set source scan，且把一个外部 production `useRenderContext().stateSource` 变异交 typecheck 作为真实 red proof；不得只扫 render 包就宣称全仓封口。

## 5 · 选定实现的公共 API 与行为

### 5.1 `useUiStateSelector`

拟保持现有名称，改变实现契约：

```ts
useUiStateSelector<TValue>(
  selector: (root: RuntimeStateRoot) => TValue,
  equalityFn?: (previous: TValue, next: TValue) => boolean,
): TValue | undefined
```

实现使用 `useSyncExternalStoreWithSelector`。`stateSource` 与 `snapshotReader` 由 `RenderContext.ts` 的 framework-private accessor 提供；public `useRenderContext` 只返回安全的非订阅 infrastructure value：

- private accessor 只能在 `ui-base-render` framework hooks/internal plumbing 使用；
- `RenderContextValue` public type 不含 `stateSource` 与 `snapshotReader`，外部 consumer 从类型层不能取得 raw source；
- `RenderProvider` 仍可接收 `RenderProviderProps.stateSource`，这是 assembly → render 的基础设施输入，不是 React UI 业务读取入口。

实现使用 `useSyncExternalStoreWithSelector` 的具体语义：

- subscribe 仍来自 framework-private `RenderContext.stateSource.subscribe`；
- snapshot 仍由 `snapshotReader.getSnapshot` 提供，保持 status-first 和 root 引用缓存；
- snapshot selector 只取 `snapshot.root`；root 不可用时不调用业务 selector，返回 `undefined`；
- 默认 equality 为 `Object.is`；自定义 equality 只为稳定的派生输出使用；
- root 新引用但 selector 结果相等时，React consumer 不重新 render；root 新引用且结果变化时，只让选择该结果的 consumer 更新；
- selector identity 改变时，即使 root 不变，也必须重新计算，保留现有测试语义。

`undefined` 只表示 hook 的返回值，不承载 runtime 生命周期或业务空值语义：它既可能来自 root unavailable，也可能是业务 selector 合法返回的 `undefined`（例如空容器没有 screen）。任何需要区分“runtime 尚未可用”和“业务选择结果为空”的消费者必须同时读取 `useRenderStatus()`，不得单凭 `undefined` 推断生命周期。也不在 hook 内创建第二份 store、Provider 或业务默认值。

### 5.2 `useRenderStatus`

新增 render public hook，内部通过 framework-private source accessor 直接对 `stateSource.getStatus` 做 selector-free subscription。它只返回 lifecycle status；不读取 root，也不替代 `useUiStateSelector` 的业务状态读取。`RenderProvider` 内部现有 status subscription 可保留，因为那是 provider 自己决定 context/生命周期的内部机制；public `useRenderContext` 不对外暴露 raw status source。

### 5.3 `useUiCatalogContext`

新增一个窄 typed adapter，输入 `displayMode`，内部使用 `useUiStateSelector` 选择 `createCatalogContext(root, displayMode, selectSurfaceForm(root))`，并用明确的 `areUiCatalogContextsEqual` 比较 `displayMode`、`workspace`、`instanceMode`、`surfaceForm` 等 context 字段。它不是第二套订阅机制，也不把业务 partKey 放进 render。

`createCatalogContext` 继续作为安装/非 React 代码的纯函数；只有重复的 React 订阅接线通过新 hook 收口。若源码核对发现 context 字段集合与本设计不同，实施前以当前类型为准补齐 equality 字段，不悄悄漏掉字段。

订阅通知次数不会因 with-selector 减少：同一 state source 仍会通知每个订阅者；拆分后单个宿主可能执行多个窄 selector，而 `useUiCatalogContext` 当前形态还会构造候选 context 再比较其字段。这个固定代价属于订阅边界取舍，不是本批的性能改善声明。`areUiCatalogContextsEqual` 必须保持常数时间、字段明确的浅比较，不得在通知路径做深遍历、IO 或业务计算；若未来要优化该开销，应另开有基线的任务。

### 5.4 删除旧的 public full snapshot hook

删除 `src/hooks/useRenderSnapshot.ts` 的 public React hook 和 `src/index.ts`/`terminal-invariants.json` 中的 `useRenderSnapshot`。`createRenderSnapshotReader` 不是 public hook，仍是 selector-aware hook 与 provider 的共享基础。实现前若有新的 production caller，必须先加入迁移分母，不得保留兼容出口。

## 6 · 生产消费者迁移

| 消费者 | 读取内容 | 目标调用 | 额外处置 |
|---|---|---|---|
| `ScreenContainer.tsx` | status、current screen placement、surface form/catalog context | `useRenderStatus`、稳定参数化 `useUiStateSelector`、`useUiCatalogContext` | 默认 placement 用 `useMemo`/模块级常量稳定引用；保留现有 failure/ready 分支；focused render-count 覆盖默认分支 |
| `LayerStack.tsx` | status、layers、catalog context | `useRenderStatus`、`useUiStateSelector`、`useUiCatalogContext` | filter/sort 基于稳定 selected layers/context；不改层序与 fallback |
| `AdminLauncher.tsx` | admin layer 是否存在 | 参数化 boolean selector + `useUiStateSelector` | selector 只读目标 displayMode 的 layers；保留五击入口与 testID |
| `AdminShellLaptop.tsx` | runtime availability、surface form/catalog、admin sections | `useRenderStatus`、`useUiCatalogContext`、`useAdminSections` | 不把 raw root/source 传给 `AdminSectionContent`；hook 无条件调用，状态分支放在 hook 之后 |
| `AdminShellMobile.tsx` | 同上 | 同上 | 与 laptop 使用同一 hook 规则，不改变 mobile IA |
| `useUiVariable.ts` | runtime root + variable declaration | 以 `useUiStateSelector` 为底层适配器 | 保留 variable owner reader；selector identity 随 declaration 变化 |
| `DisplayContextSection.tsx` | runtime status、display role、instance mode | `useRenderStatus()` 与 `useUiStateSelector(selectDisplayRole)`、`useUiStateSelector(selectRuntimeInstanceMode)` | lifecycle 文案只由 status 决定；started 但 owner 数据缺失使用中性数据缺失文案；删除 `context.stateRoot` 读取 |
| `RuntimeSection.tsx` | runtime status | `useRenderStatus()` | 删除 `context.stateSource.getStatus()` |
| `AdminSectionRenderContext`/`AdminSectionContent` | raw stateRoot/stateSource pass-through | 从生产 contract 删除两项 | 不删 commandBoundary、runtimeFacts、surface、catalogEntry 等仍需要的字段 |

`SurfaceRoot.tsx`、`WallpaperPicker.tsx`、`WallpaperBackground.tsx`、`CustomerMember.tsx`、`MemberForm.tsx`、`MemberList.tsx`、`WaitingConfirm.tsx`、`useRequest.ts` 已使用 selector-aware 入口的调用点保持行为不变；实施前需重新扫出准确全集并确认没有 direct snapshot caller 漏列。

## 7 · 测试与静态门设计

### 7.1 focused 行为执行体

使用现有 `react-test-renderer`、fake `stateSource` 和 `act`，不添加测试框架。

1. `renderState.test.tsx` 增加 render-count probe：root 变为新引用，但 selector 选择的 primitive/稳定对象不变，probe render count 不增加；选择值改变时 count 增加且值正确。`renderSurface.test.tsx` 另覆盖“无持久化记录但配置了默认 placement”分支，root 无关字段更新时 screen render count 仍保持不变。
2. 同一测试保留 status sequence、selector identity change、provider isolation/shared source/unsubscribe 断言；把原有“只缓存 selector 计算”用例改名并补上“render 不增加”语义，不能用 selector call count 冒充 render isolation。
3. 增加 derived object/array 两组：owner/稳定 selector 的引用不变时不 render；明确 equality 的窄例在语义字段变化时 render。禁止只测 `toEqual` 而不测引用/次数。
4. 增加 stale dependency red case：参数变化、root 不变时 selector 必须读新参数；把 `useMemo/useCallback([])` 缺少参数依赖的错误实现注入后，value assertion 必须失败。只测 selector identity 不足以关闭本条。
5. 增加 equality 反向 red cases：比较器返回总 `true`，以及分别漏掉 `displayMode`、`workspace`、`instanceMode`、`surfaceForm` 的变异，必须在对应字段变化时使 F-5/F-6 失败；不能只验证“过于严格导致多 render”。
6. `useRenderStatus` 测试确认 status 更新不调用 `getState`，root 更新不改变只读 status consumer；同时证明 `useUiStateSelector` 返回 `undefined` 时，消费者必须结合 status 才能区分 runtime unavailable 与业务 selector 的空结果。
7. `useUiCatalogContext` 测试确认 context 字段更新会 render，无关 root 不会；比较字段必须与 `UiCatalogContext` 类型的完整字段集合逐项对账。
8. `renderSurface.test.tsx`、`layerStack.test.tsx`、admin-shell 的 `adminLauncher.test.ts`、`adminLayout.test.ts`、`adminSections.test.tsx` 保留现有行为断言，并补 raw root/source 删除后的真实装配/section 消费证明；`admin-shell/test/displayContext.test.tsx` 覆盖 runtime status 与 owner 数据缺失的分离。
9. `renderProps.test.tsx` 中 `useUiStateSelector(root => root)` 若仍保留，只允许作为订阅机制专用 test exception，并在用例注释和规范中说明；不能成为生产调用模板。
10. 默认 placement 的稳定引用必须有真实 render-count oracle；将 `ScreenContainer` 改回 selector 内每次新建默认对象且不传 equality 的 production-like mutation 后，该 oracle 必须失败。

### 7.2 机械静态门

扩展现有 `tools/terminal-ui-render/check-static.mjs`，不新建专用 AST checker。新增规则必须同步维护 `RENDER_STATIC_RULE_NAMES`、由其派生的 `RENDER_STATIC_RULE_GATES` 以及现有 self-test 的规则清单；这些不是可省略的显示计数：

- `render-selector-boundary`：render public source 不再导出 `useRenderSnapshot`，所有 render source 不导入它；self-test 通过恢复 export/import 的真实 mutation 必须红。
- `render-package-boundary`：加入 `use-sync-external-store` 的直接 runtime dependency，继续禁止 `react-redux`、React/RN runtime dependency 和既有越界模块；依赖数组精确更新。该白名单是精确替换/重算结果，不是把新包无限追加到允许列表。
- `render-public-surface`：invariant 与 TypeScript 实际 public exports 精确相等，新增 hook 和删除旧 hook 都被检查。
- `render-public-context-boundary`：`RenderContextValue`/`useRenderContext` 的 public 类型不得暴露 `stateSource`、`snapshotReader`；private accessor 只可被 render framework internal files 使用。外部 production `useRenderContext().stateSource` red fixture 必须被 typecheck 或静态边界捕获。
- `render-admin-state-pass-through`：只检查明显的 `stateRoot/stateSource` production contract 形态；若无法用稳定机械谓词判定，不建门，交由 typecheck/focused/review，不用字符串匹配冒充语义。

每一个新增机械规则必须回答：

| 门准入问题 | 本批答案 |
|---|---|
| 真实坏处是什么 | 未来调用方可重新订阅完整 snapshot，或者公共面/依赖未同步而只在下游失败 |
| 不建门会不会自然漏过且不报错 | 会；TypeScript 允许旧/新增导出或误用某些运行时 API，render-count 回归也不会由编译器发现 |
| 能否用稳定机械谓词与真实 red mutation 证明 | full snapshot import/export、public context 类型与依赖/public surface 可以；selector 纯度、闭包完整性和 equality 合理性不可以只靠静态门，必须由 focused/review 覆盖 |

不使用 `grep` 命中 selector 名称来宣称业务语义正确；机器门只约束入口和契约。

## 8 · owner、跨层与数据边界

本批是读侧 React 订阅优化，没有跨业务 owner 写、HTTP、数据库、migration、seed 或持久化迁移。

| 数据/能力 | 权威 owner | 传递 | 消费 |
|---|---|---|---|
| runtime lifecycle status | Runtime/stateSource | `RenderContext` → `useRenderStatus` | RenderProvider、ScreenContainer、LayerStack、admin RuntimeSection |
| state root | Runtime/stateSource | private subscription accessor → snapshot reader | `useUiStateSelector` 内部的 snapshot selector；public `useRenderContext` 和 business prop 不暴露它 |
| display role/instance mode/surface form | 各 ui-state owner selector | selector-aware hook | DisplayContextSection、catalog context |
| screen placement/layers | ui-state content selectors | selector-aware hook | ScreenContainer、LayerStack、AdminLauncher |
| catalog context | `createCatalogContext` + render adapter | `useUiCatalogContext` | Screen/Layer/admin shells |
| variable declaration value | injected `selectUiVariable` | `useUiVariable` → selector hook | production React UI |
| selector derivation cache | owner selector/Reselect where needed | return stable reference | hook equality layer；不重新拥有状态 |

禁止把 `useUiStateSelector` 改成读取另一个 store，禁止为减少 render 在 UI 层复制 state slice 或缓存第二份 catalog。

## 9 · owner API、公共面与消费者全集

### 9.1 预期公共面变化

| 符号 | 状态 | owner | 说明 |
|---|---|---|---|
| `useUiStateSelector` | 保留并改为 selector-aware | `ui-base-render` | 唯一通用 React state selector hook |
| `useRenderStatus` | 新增 | `ui-base-render` | 独立 status subscription |
| `useUiCatalogContext` | 新增 | `ui-base-render` | 共享 typed catalog context adapter |
| `useRenderSnapshot` | 删除 public 面 | `ui-base-render` | 不留兼容别名或第二入口 |
| `createCatalogContext` | 保留 | `ui-base-render` | 纯函数 consumer 仍可用，React consumer 优先走 adapter |
| `useUiVariable` | 保留 | `ui-base-render` | 内部改用 selector-aware hook |
| `RenderContextValue` | 收窄 public type | `ui-base-render` | 不暴露 `stateSource`/`snapshotReader`；framework-private accessor 只供订阅 hook |

实施后必须同时核对 `src/index.ts`、`terminal-invariants.json` 和 package README；公共导出实际列表以 TypeScript checker 为准，不能手算数量。

### 9.2 当前生产读取全集

实现前用 `rg` 重新生成，不以本文列举代替源事实：

- direct `useRenderSnapshot`：五个生产组件、`useUiStateSelector`、`useUiVariable` 和自身定义/测试引用；迁移后 production source 数为 0。
- existing `useUiStateSelector`：SurfaceRoot、wallpaper feature、member feature、request hook 与 render tests；逐个确认保持/调整。
- raw `stateRoot`/`stateSource` exact-set：`RenderContext.ts` public context、`AdminShellLaptop`、`AdminShellMobile`、`AdminSectionContent`、`AdminSectionRenderContext`、`DisplayContextSection`、`RuntimeSection`，以及全仓 `apps/terminal/ui/**/src/**/*.{ts,tsx}` 中的 production `useRenderContext`/source access；迁移后仅 framework internals 可拥有 source。
- non-React `getState()`：kernel actors/foundations 另行列为不受 TR-15 迁移的例外，仍检查 TR-03，不得把它们误纳入 React render 分母。

## 9a · 实施前全链同步变更清单

以下是实现分母，不是本轮已修改文件：

| 变更点 | 预计路径 | 同步事实 |
|---|---|---|
| 直接依赖 | `apps/terminal/ui/base/render/package.json`、`apps/terminal/package.json`、workspace lock 的正常包管理更新 | `use-sync-external-store` 是 render 当前第一个第三方运行依赖；terminal workspace 额外固定同一运行依赖与 React 19.2.3 peer resolution，避免测试/运行边界加载另一份 React；render-package-boundary 白名单必须精确重算，不把 React/RN 改成 render runtime dependency，也不以传递依赖代替直接声明 |
| 类型依赖 | `apps/terminal/ui/base/render/package.json`、workspace lock 的正常包管理更新 | `@types/use-sync-external-store` 作为 render direct devDependency；不依赖 `react-redux` 的传递安装提供类型 |
| selector hook | `apps/terminal/ui/base/render/src/hooks/useUiStateSelector.ts` | root/status snapshot → selector result + equality；保留 unavailable/identity 语义 |
| status hook | `apps/terminal/ui/base/render/src/hooks/useRenderStatus.ts` | status 独立订阅，不读取 root |
| catalog hook/equality | `apps/terminal/ui/base/render/src/hooks/useUiCatalogContext.ts` 或经 source readback 确认的同责路径 | 共享 catalog context 选择与稳定比较 |
| context boundary | `apps/terminal/ui/base/render/src/contexts/RenderContext.ts` | public safe context 与 private subscription context 分离；raw source 不可由外部 UI typecheck 取得 |
| 旧 hook | `apps/terminal/ui/base/render/src/hooks/useRenderSnapshot.ts`、`src/index.ts` | 删除 public full-snapshot hook，不留兼容出口 |
| render consumers | `ScreenContainer.tsx`、`LayerStack.tsx`、render `useUiVariable.ts` | 每个读取改为 selector/status/context hook |
| admin consumers | `AdminLauncher.tsx`、`AdminShellLaptop.tsx`、`AdminShellMobile.tsx`、`DisplayContextSection.tsx`、`RuntimeSection.tsx` | raw root/source 不再传入业务 section |
| admin contract | `adminSection.ts`、`AdminSectionContent.tsx` | 删除不再需要的 `stateRoot/stateSource` 字段/props，保持其余字段 |
| focused tests | `apps/terminal/ui/base/render/test/renderState.test.tsx`、`renderProps.test.tsx`、`renderSurface.test.tsx`、`layerStack.test.tsx`；admin-shell 对应 test | render-count、status、identity、catalog equality、行为回归与 red case |
| public invariant | `apps/terminal/ui/base/render/terminal-invariants.json` | actual/expected exports 与新依赖边界同步 |
| static gate | `tools/terminal-ui-render/check-static.mjs`、其 self-test | 只加真实机械规则与 red mutation，不建第二 checker |
| focused mutation harness | `tools/terminal-ui-render/check-behavior.mjs` | 既有 harness 的当前源码锚点、sandbox 依赖链接与 selector-specific vectors；包含默认 placement identity mutation | 真实 red mutation evidence |
| framework standard | `doc/platform/terminal-coding-standard.md` | 新增 TR-15 及反例；与 TR-03 互补，不复制 review 规则 |
| package docs | `apps/terminal/ui/base/render/README.md`、必要的 admin-shell README | 说明 selector-aware 调用、status hook、例外和 Reselect 边界 |
| stale contract audit | `doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-design-codex.md`、对应 implementation plan 及所有命中 `useRenderSnapshot` 的 doc | 逐个标识历史/现行；历史记录不重写，仍被当作现行契约的文字才纳入同步 |

任何预计路径在 source readback 后变化，必须同时更新本表与计划 §7（必要时并列详设 §13c）；新增未列出的 production 改动属于 scope drift，需停在 CP-0。

## 9b · 稳定定位锚点

使用 symbol/结构锚点而不是行号：

- `useRenderSnapshot` export/import 与 `useUiStateSelector` implementation；
- `RenderProvider` 的 `stateSource`、`snapshotReader`、status subscription；
- `createRenderSnapshotReader#getSnapshot` 的 status-first/root identity 缓存；
- `ScreenContainer`/`LayerStack` 的 snapshot 分支与 selector 调用；
- `AdminShellLaptop`/`AdminShellMobile` 的 raw root/source pass-through；
- `AdminSectionRenderContext` 的 `stateRoot/stateSource` 字段；
- `tools/terminal-ui-render/check-static.mjs` 的 rule name、dependency list、self-test mutation；
- `terminal-invariants.json` 的 `publicExports` 与 `package.json` dependencies。

## 10 · 数据迁移、seed 与可逆性

### 10.1 数据迁移

`N/A_WITH_REASON`：不改持久化格式、业务数据、container/layer record 或数据库。

### 10.2 seed

`N/A_WITH_REASON`：不新增业务场景，不改 fixture data，不运行 seed。

### 10.3 代码迁移与回退边界

这是一次 public React hook 的收窄：`useRenderSnapshot` 删除而不是保留兼容层。回退不是实现双入口；如 focused proof 发现 selector-aware 实现不满足 React 订阅契约，应停在 CP-1 修复 owning source 或由 Dexter 裁定方案，不把旧入口重新暴露为长期 fallback。

## 11 · 验收场景与证据档位

| ID | 性质 | 执行体 | 批次 | 预期结果 |
|---|---|---|---|---|
| F-1 | 无关 root 更新不 render | `renderState.test.tsx` render-count probe | CP-1 | selected result `Object.is` 相等时 count 不增 |
| F-2 | 选中值更新 | 同上 | CP-1 | 目标 consumer 更新且读取新值 |
| F-3 | selector identity 更新 | 既有 identity test + 参数 mutation | CP-1 | root 不变、selector 身份变时重新计算 |
| F-4 | unavailable/status 与 undefined 语义边界 | fake source + `useRenderStatus`/selector | CP-1 | 不可用不调用 selector/getState；status 正确转换；业务 selector 的 `undefined` 不被单独解释为 lifecycle unavailable |
| F-5 | 派生引用/equality | focused object/array cases | CP-1 | 稳定引用/窄 equality 隔离无关更新；字段变化不被吞 |
| F-6 | catalog context | `useUiCatalogContext` focused case | CP-1 | context 字段变化更新，无关 root 不更新 |
| F-7 | render 行为回归 | Screen/Layer focused tests | CP-2 | part、layer、fallback、status/ready 行为不变 |
| F-8 | admin 行为回归 | admin-shell focused tests | CP-2 | launcher、section、runtime/display context 行为不变 |
| F-9 | raw full snapshot 禁止 | existing static checker + mutation | CP-3 | reintroduced import/export 非零失败 |
| F-10 | public/dependency closure | TypeScript checker/invariant/static | CP-3 | 新 hook 出口、删除旧出口、直接依赖一致 |
| F-11 | TR-15 可读且不越权 | standard/README source readback + review | CP-3 | 规范覆盖入口、纯度、稳定性、Reselect 边界和例外 |
| F-12 | 逐代码与详设对账 | 主 agent逐行 + fresh readback | CP-4 | 仅允许 `MATCHED` 或 `OPEN`；有 OPEN 不得交付“就绪” |

证据分档：

| 档位 | 本批状态 |
|---|---|
| static | 实施期运行现有 terminal static 与 render static；已执行通过，原始输出见 `.runtime/ter-selector-subscription/2026-09-17/final-07-terminal-static.log` 与 `b3-static-production.log` |
| focused | 实施期运行 render/admin/console-assembly owned tests 与 selector red mutations；已执行通过，原始输出见 `.runtime/ter-selector-subscription/2026-09-17/final-02-render-test.log`、`final-04-admin-test.log`、`final-06-console-assembly-test.log`、`b1-red-mutations.log` |
| native / Android | `NOT_APPLICABLE_WITH_REASON`：本批不改 native/Android |
| Web | `NOT_APPLICABLE_WITH_REASON`：本批不改 Web |
| release / visual | `NOT_APPLICABLE_WITH_REASON`：没有用户可见设计变更，且未获 release/设备授权 |
| cleanup | `NOT_APPLICABLE_WITH_REASON`：没有受管长运行；若测试 runner 产生 sandbox，必须有其自身 cleanup 输出 |

本批可证明的是 selector-aware 订阅语义、公共调用边界和静态闭包；不证明设备帧率、内存、CPU、用户感知改善或任何性能数字。若 Dexter 后续要求真实性能研究，必须另开有改前基线、动态授权和证据方案的任务。

## 12 · 预期规模、未决项与设计边界

### 12.1 预期规模

- 一个 render package 增加一个直接依赖、最多三个 framework hook 调整/新增、删除一个 public hook。
- 五个 direct full-snapshot production component sites 完成迁移；两个共享 hook 完成底层迁移；现有 selector callers 重扫后不应出现新的 full snapshot 逃逸。
- admin contract 删除两项 raw state pass-through，保留已有业务 context 字段。
- 现有 render static checker 增加规则，不新建工具目录。

### 12.2 不在本批解决的风险

- MemberList 等组件是否需要 virtualization 或列表级 memo：这是另一个数据规模/用户体验问题，不能用本批 selector hook 证明已解决。
- provider value、surface measurement、DEV effect dependency 等其他 render 成本：除非 source readback 证明由本批迁移直接影响，否则记录为 out of scope。
- 真实设备帧率、黑帧和性能改善幅度：本批不做 native/Android 运行验证，也不以订阅语义推断这些结果。

### 12.3 需要 Dexter 裁决的事项

当前没有产品 Journey 或用户可见语义需要裁决。Dexter 已选择方案二，因而本批不再把“是否补性能基线”列为未决项。以下属于实现阶段若与当前源码冲突才上报，而不是本设计预先扩大范围：

1. `use-sync-external-store` 当前安装版本/许可证或 workspace 依赖约束不允许作为 render 直接依赖；此时不能偷偷换成自研并发订阅实现。
2. source readback 发现某个 direct snapshot caller 是确实需要 full root 的 framework-level能力，而不是业务 UI；需决定是否保留一个内部、不可 public 的专用适配器。
3. 若后续需求把本批重新定义为需要真实性能数字，必须另开任务补改前基线、测量方法与授权；本批不能自行新增阈值或把 focused 结果改称性能 PASS。

## 13 · 停机条件与失败处理

- 设计 review 未 GO 前，不实施。
- 若实现中发现 direct consumer 分母扩大、旧 hook 有外部包依赖、或 admin raw root/source 还有未识别 owner，停在 CP-0，重做同族全集扫描。
- 任一 focused/static 命令失败，保留原始输出，记录 first failure、last known good、broken boundary，按 owning source 最小修复后 focused 重验；不延长 timeout、不盲重跑、不把失败改写成 PASS。
- 若 selector-aware hook 只能通过业务组件内复制 store、增加 Provider 或改变 command/state owner 才能工作，视为 broken boundary，停止并回到方案评估。
- 子 agent 只能只读审查与对账；不得修改文件、运行有写入副作用的命令或替主 agent 编码。

## 13b · 三维对账

实施每个 CP 后、进入下一个 CP 前，由 fresh 只读独立子 agent 按以下三维逐项对账：

1. 本详设与本轮 Dexter 目标：selector-aware subscription、TR-15、scope 与证据边界；
2. 相关现行设计/规范：`doc/platform/terminal-coding-standard.md`、`project-memory/decisions/deterministic-context-only.md`、`project-memory/operations/implementation-source-reread-discipline.md`、命中 TER selector/cache memory；
3. owning source 与 focused/static 输出：公共 API、调用全集、测试 oracle、静态门 red mutation。

步骤 reviewer 输出只能是逐项 `MATCHED` 或 `OPEN`，不得写阶段 GO/NO-GO；任一 OPEN 由主 agent修复后交另一 fresh reviewer 复查。全部 CP 完成后、任何整体测试之前，再做一次全批三维对账。

## 13c · 逐代码与详设对账

交付 Dexter/Claude 前，主 agent必须逐行/逐符号核对 §9a 与实际 diff：

| 对账范围 | 必核内容 | 结果格式 |
|---|---|---|
| public hook | `useUiStateSelector`、`useRenderStatus`、`useUiCatalogContext`、删除 `useRenderSnapshot` | `MATCHED`/`OPEN` |
| state source | subscribe、snapshot、status、getState 调用边界 | `MATCHED`/`OPEN` |
| production consumers | §6/§9.2 全集每一处 | `MATCHED`/`OPEN` |
| admin contract | raw root/source 删除与剩余字段 | `MATCHED`/`OPEN` |
| focused tests | 每个 F-1～F-8 有真实 oracle 和 red case | `MATCHED`/`OPEN` |
| static gate | rule、dependency、public invariant、red mutation | `MATCHED`/`OPEN` |
| behavior harness | selector-specific mutation vectors、sandbox cleanup 与 first-failure readback | `MATCHED`/`OPEN` |
| TR-15/README | 规范条款、例外、Reselect 边界与源码示例 | `MATCHED`/`OPEN` |
| out-of-scope/evidence | 无动态结果被升格；未运行档位明确 OPEN/N-A | `MATCHED`/`OPEN` |

这张表不是三维对账的替代；三维对账验证设计规范与源码/证据是否一致，逐代码对账验证每一处计划变更是否真的落在详设。

## 14 · 详设自查

- [x] 明确 root snapshot 订阅与 selector 计算缓存不是同一问题。
- [x] 按 Dexter 选择采用方案二：本批是框架级 selector 调用规范与订阅边界收紧，不主张性能改善。
- [x] 比较了“不改”“Reselect-only”“独立 Provider”“官方 selector shim”和自研 wrapper，选了最小可靠方案。
- [x] 给出框架级 TR-15，规定入口、纯度、稳定 identity、派生引用、Reselect 边界和窄例外。
- [x] 列出 direct snapshot 消费者、admin raw state pass-through、保留的 selector callers 与 kernel 例外。
- [x] 规定了真实 render-count focused oracle，未用 selector call count 冒充 render proof。
- [x] 规定静态门三问和真实 red mutation，不新建专用 checker。
- [x] 明确没有 UI/L2、Web、Android、release、dynamic performance 结论。
- [x] 明确实施前置、CP 顺序、三维对账、逐代码与详设对账、失败处置和停机边界。
- [x] fresh 独立 DESIGN review：Round 2 已完成，记录于 `doc/review/platform/2026-09-17-ter-selector-subscription-design-review-round2-claude.md`；设计轮次已封顶，后续仅执行实施期步骤级/全批三维对账，不再开启第三轮 DESIGN review。

## 15 · Claude 复评处置（已复评；实施结果）

本节记录 Claude 复评后的作者侧处置，不改写历史评审文件，也不把本节当作 implementation review 结论。`POST_CLAUDE_REVIEW_STATUS=GO(0M/0S/3N)`；三条 Note 已在实施批同步处置。当前实现状态为 `PREPARED_FOR_REVIEW`，最终 implementation/acceptance 仍由 Dexter 与 Claude 独立复核。

| finding | 状态/处置 | 具体落点 | 当前证据 |
|---|---|---|---|
| M-1 | `DEXTER_DECISION=方案二`；真处置。将本批重新定位为框架级 selector 调用规范与订阅边界收紧，明确不主张性能改善；render isolation 仅作为行为契约结果而非性能验收结论 | 本节、§0.1、§0.2、§1、§11、计划对应范围与 implementation handoff | 设计/实现口径一致；证据明确不含性能基线或性能结论 |
| S-1 | 真修复。承认通知量不变、selector 执行次数可能增加、catalog adapter 的候选对象与常数时间浅比较成本，并禁止在通知路径做深遍历/IO | §5.3、§12.2、计划 §5/§6 | `b1-red-mutations.log` 与 focused tests；不据此推导性能改善 |
| S-2 | 真修复。把 `ui/base/console-assembly` 的 stateSource 注入明确列为基础设施例外，限制不得下传至业务组件 | §4 TR-15 第 6 条、§4 机器边界、计划 B3 | `b3-static-production.log`、`final-07-terminal-static.log` |
| S-3 | 真修复。明确 `undefined` 不承载 lifecycle/业务空值语义，要求需要区分时同时读取 status，并加入 F-4 | §5.1、§7.1、§11 F-4、计划 B1/F-4 | `b1-red-mutations.log` 与 `final-02-render-test.log` |
| N-1 | 真修复。点名 `RENDER_STATIC_RULE_NAMES`、`RENDER_STATIC_RULE_GATES` 与 self-test 规则清单同步 | §7.2、§9a、计划 B3 | `b3-static-model.log`、`b3-static-production.log`；10 条规则与 self-test 已同步 |
| N-2 | 真修复。将自研 wrapper 的否决理由改为避免维护 selector 记忆化/equality 边界，不再把 tearing/并发正确性归因给自研 wrapper | §1 方案表 | 实施保持方案二；交付材料没有性能改善主张 |
| N-3 | 真修复。明确 render 的第一个第三方运行依赖与精确白名单重算要求 | §7.2、§9a、计划 B3 | `b0-source-dependency-inventory.log`、`b3-static-production.log`；直接依赖与 peer-resolution anchor 已核对 |
