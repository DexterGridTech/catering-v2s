SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0

# `ui.base.render` 实施计划（Codex）

## 0 · 计划元数据与边界

```text
PROGRAM_ID=V2S_W0_W4_EXECUTION
REVIEW_TARGET=DESIGN
IMPLEMENTATION_AUTHORITY=false
DESIGN=doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-design-codex.md
IA=doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-ia-design-codex.md
REQUIREMENTS=doc/plans/platform/2026-09-02-v2s-terminal-ui-base-render-requirements-claude.md
AUTHORIZED=仅交付实施计划；render 代码、依赖、测试、静态门、行为 harness 均须另获实施授权
NOT_AUTHORIZED=render implementation、Runtime/S-6 source change、S-7、DEV、seed、reset、L2、UAT、部署、Git
```

本计划描述未来一次完整 render implementation 的执行顺序，不表示本轮已经实施。S-6 的补测属于当前
单独授权范围，已在 runtime package 中完成并有独立输出；render 不在这次 S-6 补测里偷偷实现。

## 1 · 执行前硬前置

在任何 render 源码写入前，必须重新打开并以当前字节确认：

1. `apps/terminal/kernel/base/ui-state/src/types/catalog.ts#UiCatalogEntry` 与
   `apps/terminal/kernel/base/ui-state/src/foundations/catalog.ts#createUiCatalog/selectAvailableParts`
   的 `containerKeys`、精确 `Reflect.ownKeys`、空数组不对称与 `.includes` 过滤；
2. `apps/terminal/kernel/base/runtime/src/types/runtime.ts#Runtime` 的 readonly `status`、
   `getState`、`subscribe`，以及 `apps/terminal/kernel/base/runtime/src/application/createRuntime.ts`
   的 status-first 可消费事实；
3. `apps/terminal/skeleton-graph.ts` 的 toolkit/owner 与三项 dependency；
4. `doc/platform/frontend-coding-standard.md`、
   `project-memory/decisions/deterministic-context-only.md`、
   `project-memory/operations/implementation-source-reread-discipline.md` 与 TER 相关 memory；
5. 本详设 §3/§7/§11、IA 四个 IA-ID 与当前需求稿全文。

requirements 文档里的 S-6/S-7“尚未落地”叙述是历史状态说明；当前 source 与本详设的 `CURRENT_SOURCE_WINS`
边界已经固定，实施不得因此保留单数字段、getStore fallback 或双形状兼容层。未来 render implementation 前，
owner 仍应把需求稿同步为 current-contract wording；这项文档同步是实施前置，不是本轮设计的双事实。runtime
observation 与 part diagnostic 的分类按详设 §11.3 执行；若实施需要靠改变代码来迎合历史文字，停在 CP0。

## 2 · CP 顺序与原子性

| CP | 顺序 | 内容 | 进入条件 | 退出证据 |
|---|---:|---|---|---|
| RENDER-CP0 | 0 | current source/requirements/doc alignment；test wiring inventory | 本详设与 IA review 通过；S-6/S-7 current source 可读 | owner 文档对齐、唯一锚点与完整分母 |
| RENDER-CP1 | 1 | public types、`definePart`、RendererCatalog | CP0 | T-7/T-8/T-9a/T-9b、typecheck、exact surface focused |
| RENDER-CP2 | 2 | stateSource adapter 接缝、snapshot reader、provider/context、hooks | CP1；不把 Runtime 作为 source | status gate/root identity/selector/unmount proof |
| RENDER-CP3 | 3 | SurfaceRoot、ScreenContainer、LayerStack、fallback/diagnostic | CP1/CP2 | T-1..T-6/T-10..T-12、层序 proof、source readback |
| RENDER-CP4 | 4 | `.tsx` 测试接线、T/R 全量门、production mutation harness | CP1–CP3 | package tests/static/behavior baseline+red+cleanup |
| RENDER-CP5 | 5 | 全批逐点对账与设计/实现交付 | CP4 | fresh independent review、全批 readback；仍不做 DEV/L2/UAT |

CP1–CP3 不允许出现可运行但未闭合的中间公共面：不得先发布 `RenderProvider` 接收完整 Runtime，
不得先按旧 `containerKey` 搬一次 `definePart`，不得先让 ScreenContainer 通过 `getStore()` 订阅。
每个 CP 完成后，下一 CP 开始前必须做步骤级 fresh 独立三维对账；所有步骤完成后再做一次全批对账。

## 3 · 分步实施

### RENDER-CP0：材料与测试接线冻结

1. 复算 `ui-state`/Runtime 当前 public types 与 symbols；记录 requirements 历史文字与 current source
   的差异，但不改生产 owner。
2. 盘点 render 当前三文件骨架、package scripts/dev/peer dependencies、tsconfig include、
   `terminal-invariants.json` 与 skeleton graph；确认测试目录不存在、`owned.test.kind=ABSENT`。
3. 写出本计划 §9a 的完整 change denominator 与 §9b 唯一 anchors；任何新的 public symbol 必须在
   §9.1 exact set 与 typecheck fixture 中出现，并把 package-root `README.md` 纳入实施收口分母。
4. 先建立测试接线设计：`vitest.config.ts` 收 `test/**/*.test.ts` 与 `test/**/*.test.tsx`；
   tsconfig 收 src/test 的 `.ts/.tsx`；package 新增 `test` script、vitest 与 lock 中已有版本的
   `react-test-renderer@19.2.3` devDependencies；invariant 改为 `REAL_TESTS`/vitest。
5. 不引 `@testing-library`，不改 skeleton graph 偷引 `ui.base.test-support`；如实际解析发现依赖
   版本与 lock 不一致，停在 CP0，重新核依赖而不是手写 lock。

**CP0 gate**：`.tsx` focused test 未被 runner 收集、实施需要以历史 S-6/S-7 文字驱动兼容代码、或
`RenderProvider` 形状无法写成窄三件套时停止。CP0 的步骤级 review 必须逐项对照 requirements、IA/详设/计划
与 memory/source，并保留 first mismatch。

### RENDER-CP1：类型、part factory 与 renderer catalog

建议文件责任（实际路径以现有 `src` 结构复核后为准）：

- `src/types/catalog.ts`：`LayerTier`、具名泛型 `RendererBinding<TProps extends RenderComponentProps>`、`RendererCatalog`；
- `src/types/props.ts`：`SurfaceRootProps`、`RenderProviderProps`，其中 `stateSource` 为内联窄只读
  结构，不导出 `RenderStateSource`；root 类型用 `ReturnType` 从 Runtime API 推导；
- `src/foundations/createRendererCatalog.ts`：bindings copy、重复 `rendererKey` 抛错、resolve/tierOf、
  构建后闭包不可变与无 register；
- `src/foundations/definePart.ts`：单次输入生成 `catalogEntry` 与 `rendererBinding`；catalogEntry
  不带 component/layerTier，binding 不带 title/description；`containerKeys` 由依赖包类型贯通；
- `src/index.ts`：保留现有 3 个 infrastructure exports，并新增详设 §9.1 的 13 个 domain symbols；最终 exact
  public surface=16，不增加 module factory/runtime/test seam。

实现细节：

1. `createRendererCatalog` 复制 bindings 后用内部不可达 Map；返回的 object 冻结，只有 `resolve` 与
   `tierOf`，没有 register/clear；同 key 在构建阶段抛错。
2. `layerTier` 输入可省略时只在 `definePart` 内默认；若输入自有该字段但值为 `undefined`，必须抛错。
   canonical binding 始终物化 `layerTier`，且 ownKeys 精确为 `rendererKey/component/layerTier`；`tierOf` 只对已由
   resolve 成功的 renderer 调用，缺失 renderer 由解析层先产生 `missing-renderer`。
   CP1 的 focused proof 必须成对执行：省略该字段的 control 断言 binding 为 `standard`；保留自有
   `layerTier: undefined` 的 negative fixture（可用 `Object.defineProperty` 构造）断言同步抛错且错误指向
   `layerTier`，不接受物化后的 binding。production red mutation 改为 `?? 'standard'` 或移除该拒绝分支时，
   negative case 必须非零失败，control case 仍通过。
3. `definePart<TProps extends RenderComponentProps>` 使用具名 generic component contract，不使用 `any` 或
   `Record<string, unknown>`；对 arrays 做只读 copy/freeze，不改变 title/description；component 与 tier 只进入
   binding；真实 `catalogEntry` 交给 ui-state `createUiCatalog`，不在 render 复制 ui-state 的 validator。
4. 任何 `partKey`/`containerKey` 都是输入数据，不得成为 render 源码字面量；不得构造 id 前缀来分类 layer。

**CP1 gate**：重复 key 被覆盖、catalog 暴露 register、entry/binding 发生字段串台、`containerKeys` 变回
单数、显式自有 `layerTier: undefined` 被静默当作省略、或出现第二个 public symbol 住址时停止。最低 proof
为 T-7/T-8/T-9a/T-9b、R-3/R-4/R-11/R-14、typecheck 与 source exact-set；T-9b 的省略/显式 undefined
成对 oracle 与对应 production red vector 不得省略。

### RENDER-CP2：Provider、snapshot 与 selector

实现顺序：

1. `src/foundations/createRenderSnapshotReader.ts` 先实现 status-first reader：每次先调用
   `stateSource.getStatus()`；`created/starting/failed` 返回按 status 缓存的 `{status, root: undefined}`，
   不调用 getState；`started` 才调用 getState，并按 root 引用缓存 `{status:'started',root}`。
2. `src/contexts/RenderContext.ts` 保存 `stateSource`、UiCatalog、RendererCatalog、LoggerPort、
   snapshot reader；context value 只含这些输入引用，不含 root/status 副本与 dispatch。
3. `RenderProvider` 只接 `RenderProviderProps`，不接完整 Runtime，不建 RuntimeModule/install/slice，
   不提供默认 catalog/logger/state。
4. `useUiStateSelector<T>(selector)` 无条件使用 snapshot hook；root 不可用时不调用 selector 并返回
   `undefined`；root 引用相同直接返回该 hook 上次 selector result；root 变化才调用纯 selector。
5. `useSurfaceDisplayMode` 无条件读取 context；`SurfaceRoot` 的 displayMode/containerKey 必填，
   不接受小写/默认/routeContext 推断。
6. lifecycle observation 由一个 provider-level effect 按 status transition 记录 `runtime-status-changed`；
   part-level logger 只允许详设 §11.3 的三项 error event。`container-empty` 不记 error diagnostic。

**CP2 gate**：任何非 started `getState` 调用、snapshot 每次读分配、same root selector result 不稳定、
state dispatch/status transition 不触发重读、unmount 不退订、或 Provider 可以拿到 dispatch/getStore 时停止。
最低 proof：fake stateSource 调用记录 + react-test-renderer `act`，覆盖 status sequence、failed、root
identity、selector allocation、unsubscribe exactly once。不可用与空容器必须在不同 component testID 中可见。

### RENDER-CP3：宿主解析与五类 fallback

1. `ScreenContainer` 从 context 取 displayMode/containerKey，从当前 snapshot root 调
   `selectScreen(root, displayMode, containerKey)`；无 placement 渲染 `container-empty`。
2. `LayerStack` 从 context 取 displayMode，调用 `selectLayers(root, displayMode)`；按 binding 的
   tier rank、`openedAt`、`layerId` 稳定排序；不设深度上限/分页/缓存。
3. screen 与 layer 各自执行：`partKey`→`uiCatalog.byPartKey`→`rendererKey`→`rendererCatalog.resolve`。
   第一跳失败落 `missing-catalog-entry`，第二跳失败落 `missing-renderer`，不得 return null 静默吞掉。
4. props shape gate 先判断 own property 是否存在：缺席调用 component({})；存在但 prototype 不是
   Object.prototype/null，或为 null/array/primitive，则不调用 component，渲染 `invalid-props`。
   plain object 的字段和值不加 partKey、testID 或 displayMode。
5. fallback reason 是闭集；testID 至少为：
   `runtime-unavailable`、`container-empty`、`missing-catalog-entry`、`missing-renderer`、
   `invalid-props` 五个不同值。诊断 reporter 以 `reason + displayMode + partKey + rendererKey/valueType`
   identity 去重，不重复刷同一错误帧。
6. `SurfaceRoot` 固定返回 `children → ScreenContainer → LayerStack`；它不提供 DefaultAlert、LoadingScreen、
   EmptyScreen 或任何具体业务 part。

**CP3 gate**：任一 fallback 复用错误语义/testID、invalid props 调 component、displayMode 写死、tier
排序不稳定、screen/layer 任一跳静默、出现具体 key/字符串前缀/automation provider 时停止。最低 proof：
T-1..T-6、T-11/T-12、R-2/R-5/R-6/R-7，以及各 path missing/invalid 的 exact logger assertions。

### RENDER-CP4：全量测试、门与 production red mutation

1. `test/` 每条用例按 capability 命名，`.test.tsx` 真正渲染组件；用 `react-test-renderer@19.2.3`
   的 `act`，不引 testing-library。每个 T/R 必须在测试清单中有唯一场景名与 oracle。
2. T-13/R-19 使用真实 `definePart`、真实 ui-state `createUiCatalog`、真实
   `selectAvailableParts`；render package runner 直接执行，不 mock 这三层交界。fixture 的
   `containerKeys: []` 保持不变。
3. 建 `tools/terminal-ui-render/check-static.mjs`（只作禁止性机械门）与对应 support/model test：
   禁止具体 key、getStore、dispatch/defineCommand、StateRoot import、RuntimeModule/slice/install、
   react-redux、非 peer React/RN；public exports 做 actual/expected exact 对账。存在性检查只能与
   typecheck/行为测试配对，不以源码字符串代理组件行为。
4. 建 `tools/terminal-ui-render/check-behavior.mjs`：每个 sandbox 精确复制/链接所需 workspace package，
   每个 mutation 用唯一 `replaceOnce` anchor，先 baseline，再运行对应 render focused proof，mutation
   必须非零，finally 删除精确 sandbox，单独输出 cleanup PASS。候选 red vector 至少包含：

   - displayMode 常量化（T-2/R-2）；
   - 删除第一跳（T-1）；
   - 删除 tier sort/tie-break（T-3/R-5）；
   - missing path return null（T-4/T-5/R-6）；
   - invalid props 继续调用 component（T-4b）；
   - empty fallback 注册为 part/默认写入（T-6/R-7）；
   - duplicate 后者覆盖、暴露 register、取消 freeze（T-7/T-8/R-3/R-4）；
   - `definePart` 把自有 `layerTier: undefined` 合并为 `standard`（T-9b/R-11）；negative case 必须变红；
   - 删除 status-first/root cache/selector root cache（T-10/T-11/T-12/R-1/R-15）；
   - **ui-state `selectAvailableParts` 的 `.includes` 过滤改坏**（T-13/R-19）；
   - **render `definePart` 输出 `containerKeys` 的 wiring 改坏**（T-13/R-19 第二个跨包 vector）。

   T-13/R-19 的两种 mutation 不互相冒充：ui-state mutation 证明真实枚举契合点，definePart mutation
   证明 render declaration transfer；两者都必须使 render package 的 focused test 红。
5. runner 输出必须同时保留：`.tsx` 实际收集分母、baseline PASS、每条 mutation 的非零红结果、cleanup PASS、
   failed first output。无 DEV、L2、UAT、部署输出可写成 render 验收。

**CP4 gate**：任何 `.tsx` 未收集、T/R 缺一项、跨包只红 ui-state、自造 fixture mutation、cleanup 失败、
静态门靠“必须存在”而非禁止性约束、或 production mutation 不红时停止。不得通过删测试、放宽 exact-set、
改输入事实或新增 fallback 让门回绿。

### RENDER-CP5：整批对账与交付

1. 用同一份 §9a denominator 逐条重读 current source、IA、详设、plan、package config、test output，并在
   package-root `README.md` 创建后对照 TR-10 的定位、作用、结构、真实用法与迭代说明；README 不在本轮创建。
2. 独立 fresh subagent 以 `REVIEW_TARGET=DESIGN`（本轮）或 future implementation cycle 的
   `REVIEW_TARGET=IMPLEMENTATION` 做对抗核验；记录 input checklist/hash、round、reviewerKind、盲审声明。
   同一 cycle 最多两轮，第二轮硬停止，不用 Claude 后续 review 替代独立 subagent。
3. 对照六维/全维：行为、形态、动作、关系、位置、文案、限制、状态控制、失败恢复、可访问性焦点、
   数据源与失效。任一 mismatch 主 agent 必须修复并 fresh recheck。
4. 交付时明确：render implementation 是否实际授权/完成、S-6/S-7 current source、五类 fallback、
   Provider 三件套与 logger 分离、T/R fresh output、UNENFORCEABLE/L2 未证边界；不得写“设计已证明实现”。

## 4 · CP gate 汇总

| CP | 失败即停止的最小信号 | 必须同时读回 |
|---|---|---|
| CP0 | 实施被历史 S-6/S-7 文字驱动去添加兼容层、测试未收 `.tsx`、或窄三件套无法成立 | requirements、IA、详设、package/skeleton、runtime/ui-state source |
| CP1 | 两张 catalog 串台/可变/重复覆盖、显式自有 `layerTier: undefined` 被静默默认、public surface 漂移 | definePart、catalog types、ui-state validator、exact export、T-9b 成对输入 oracle |
| CP2 | non-started 调 getState、snapshot/selector 不稳、full Runtime/store/dispatch 泄漏 | runtime S-6 source、Provider/hook、fake source proof |
| CP3 | 五类 fallback 不可区分、两跳静默、props fail-open、tier/identity 错 | ui-state selectors/content、render hosts/fallbacks、logger proof |
| CP4 | T/R 缺 proof、`.tsx` 假绿、cross-package 不真实、red mutation 不红 | test files、runner config、static/behavior harness、raw outputs |
| CP5 | IA/design/plan/source/evidence 任一维度漂移 | full denominator、fresh independent review、all fresh outputs |

## 5 · operation / owner / migration / seed 结论

- HTTP/backend/DB/transaction/grant/idempotency：`N/A`，render 是本地 toolkit，不拥有后端事实。
- migration/backfill：`N/A`，本批不改持久化形状；S-7 已是前置 current contract。
- seed/reset/DEV：`N/A`，测试 fixture 与 seed 分离；本轮不执行破坏性数据动作。
- L2/UAT：`NOT_AUTHORIZED`；真实视觉 z-order、空态质量与设备 React Native 行为未验证。

## 6 · 预期实施后验证命令（当前不执行）

以下是未来取得 render implementation authorization 后的命令清单，不是本轮运行证据：

```text
yarn workspace @catering-v2s/ui-base-render test
yarn workspace @catering-v2s/ui-base-render typecheck
node tools/terminal-ui-render/check-static.test.mjs
node tools/terminal-ui-render/check-static.mjs
node tools/terminal-ui-render/check-behavior.mjs
```

命令实际入口、workspace 名与 vitest 版本必须在 CP0 从当前 package/lock 复核；如果命令首败，保留
first failure 与日志，完成边界诊断后才允许第二次尝试，禁止延长 timeout/轮询伪装修复。

## 7 · 计划完成判定

```text
PLAN_STATUS=READY_FOR_DESIGN_REVIEW
DESIGN_STATUS=READY_FOR_DESIGN_REVIEW
IMPLEMENTATION_AUTHORITY=false
RENDER_IMPLEMENTATION=NOT_STARTED
S6_SUPPLEMENT=IMPLEMENTED_AND_SELF_VERIFIED; 5 production mutations red; cleanup PASS
T_COVERAGE=T-1..T-13 plus T-4b mapped
R_COVERAGE=R-1..R-20 mapped
UNENFORCEABLE_BY_MACHINE=preserved
L2=NOT_AUTHORIZED
```
