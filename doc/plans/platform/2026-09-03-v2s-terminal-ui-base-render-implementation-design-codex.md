SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0

# `ui.base.render` implementation-facing 详设（Codex）

## 0 · 元数据与授权边界

```text
PROGRAM_ID=V2S_W0_W4_EXECUTION
REVIEW_TARGET=DESIGN
DESIGN_UNIT=UI_BASE_RENDER_TOOLKIT
BUSINESS_SOURCE=doc/plans/platform/2026-09-02-v2s-terminal-ui-base-render-requirements-claude.md
JOURNEY_REFS=NOT_APPLICABLE_WITH_REASON:本包是 toolkit，不拥有产品 Journey
IA_REF=doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-ia-design-codex.md
AUTHORIZED=仅产出 render IA、implementation-facing 详设与实施计划；另补已授权的 S-6 focused production mutation proof
NOT_AUTHORIZED=render 生产代码、render 依赖/测试接线、S-6 源码契约变更、S-7、DEV、seed、reset、L2、UAT、部署、Git
IMPLEMENTATION_AUTHORITY=false
CURRENT_SOURCE_WINS=true
```

本详设是设计交付，不是 render 实施授权。S-6 的补测已在本轮单独完成，render 只消费当前
`Runtime.status`、`Runtime.getState`、`Runtime.subscribe` 形态；不把需求稿中“尚无 S-6”的历史文字
当作当前源码事实。S-7 也已落地，当前 `UiCatalogEntry` 使用 `containerKeys`，不是旧的单数形态。

需求稿的历史修订段仍保留“当前单数 / S-7 未落地”和“Runtime 无 subscribe”的叙述，而当前正本分别是
`apps/terminal/kernel/base/ui-state/src/types/catalog.ts`、`apps/terminal/kernel/base/ui-state/src/foundations/catalog.ts`
与 `apps/terminal/kernel/base/runtime/src/types/runtime.ts`。本详设把这两段明确标为历史状态，采用
`CURRENT_SOURCE_WINS=true`：当前实现契约只有 `containerKeys` 与 `Runtime.status/getState/subscribe`，不得由
历史文字产生兼容字段、getStore fallback 或双形状。未来进入 render implementation 前，owner 仍应把需求稿同步成
current-contract wording；本轮不改需求稿，也不把该文档维护动作伪装成源码事实或当前设计阻断。

## 1 · 真实结构性问题与方案比较

### 1.1 不做会怎样

当前 `ui.base.render` 只有骨架 module/dependency 壳，没有 React 组件、catalog、测试接线或读侧
订阅能力。若直接把 POC 搬进来，会复现四类根因：

1. 根壳用环境态/默认值猜 surface，两个 displayMode 的内容可能在错误屏显示；
2. renderer registry 变成模块级可变单例，重复 key 静默覆盖，测试与多 runtime 装配互相污染；
3. screen/layer 通过一跳字段或具体 key 猜 renderer，catalog 缺失与 renderer 缺失静默消失；
4. React 读侧没有 status-first 快照门控，`getState()` 在非 started 时抛错；若把完整 Runtime 或
   `getStore()` 交给组件，render 会获得 dispatch 能力并形成写入旁路。

### 1.2 方案比较

| 方案 | 结果 | 结论 |
|---|---|---|
| A：引入 `react-redux`，让组件直接从 store 选状态 | 依赖不在 ui toolkit 骨架允许清单；会把 store/dispatch 形状带入 render；不能自然覆盖 Runtime status transition | 拒绝 |
| B：Provider 接收完整 `Runtime`，内部调用 `getStore().subscribe` | 订阅能工作，但 dispatch 随 store 暴露给 UI，违反窄只读接缝；还把当前 Runtime API 细节扩散到组件 | 拒绝 |
| C：render 自己复制 root/status，靠 polling 或 effect 对齐 | 第二份事实源，不能保证同步 invalidation；会让 unavailable/failed 进入状态机与实际 Runtime 漂移 | 拒绝 |
| D：Provider 接收 `stateSource` 窄适配器，使用 React `useSyncExternalStore`；两个 catalog 安装期构建并冻结 | status-first 快照、同步订阅与 root 引用缓存各有唯一 owner；render 没有 dispatch/getStore 能力；真实跨包契约可在 focused test 验证 | **采用** |

我选了 D 而不是 A/B/C，因为它复用当前 Runtime 的唯一 lifecycle/state owner，只在集成边界把
`runtime.status` 适配为 `getStatus()`，并把 React 所需的同步读侧能力限制为三件套。

### 1.3 当前源码核对结果

| 事实 | 当前正本与结论 |
|---|---|
| ui-state catalog | `src/types/catalog.ts#UiCatalogEntry` 当前是 `containerKeys: readonly ContainerKey[]`；`src/foundations/catalog.ts#createUiCatalog/selectAvailableParts` 保留 `Reflect.ownKeys` 精确集合与 `includes` 过滤；`[]` 只对 containerKeys 放行 |
| 放置与准入分离 | `src/features/commands/showScreen.ts#ShowScreenPayload` 仍是单数 `containerKey`；`contentActors.ts#normalizeShowPayload` 直接规范化并写入 payload，render 不改变它 |
| Runtime S-6 | `src/types/runtime.ts#Runtime` 有 readonly `status`、`getState`、`getStore`、`subscribe`；`createRuntime.ts#notifyRuntimeSubscribers` 与 `#attachStateSubscription` 负责同步 lifecycle/state 通知；`getState` 非 started 仍抛错 |
| Provider adapter | Runtime 没有 `getStatus()` 方法；集成层必须用 `getStatus: () => runtime.status`，并用闭包调用 `runtime.getState()`/`runtime.subscribe()`；不得直接把 Runtime 作为 `stateSource` |
| package graph | `apps/terminal/skeleton-graph.ts` 将 render 标为 toolkit，依赖 platform-ports/runtime/ui-state；automation 才是 owner；render 不注册 RuntimeModule/install/slice |
| POC 参考 | `doc/plans/platform/2026-09-02-v2s-terminal-ui-base-render-requirements-analysis-claude.md` 与 `doc/review/platform/2026-08-28-newposv1-package-analysis-claude/u-01-runtime-react-claude.md` 只作差异输入；不继承 POC 的 cache、default part、字符串分层、条件 hook 或模块 singleton |

## 2 · CP 总览

| CP | 主题 | owner | 主要输出 | 依赖 |
|---|---|---|---|---|
| RENDER-CP0 | 当前 S-6/S-7 对齐、依赖/测试接线冻结 | Codex（设计/实现期） | requirements 文档对齐记录、源码锚点、测试夹具边界 | 本详设、IA、当前 runtime/ui-state |
| RENDER-CP1 | `definePart`、两张 catalog 与公共类型 | render | `types`、`definePart`、`createRendererCatalog`、exact public surface | CP0 |
| RENDER-CP2 | Provider、status-first snapshot、selector hook | render + Runtime consumer seam | `RenderProvider`、snapshot reader、`useUiStateSelector`、surface context | CP1；当前 S-6 已验收 |
| RENDER-CP3 | SurfaceRoot、ScreenContainer、LayerStack 与五类 fallback | render | 两跳解析、tier 排序、诊断、只读渲染树 | CP1/CP2 |
| RENDER-CP4 | 测试接线、行为 proof、production red mutations | render | Vitest `.ts/.tsx` 接线、T/R tests、static/behavior gates | CP1–CP3 |
| RENDER-CP5 | 全批三维对账与交付 | Codex + fresh independent subagent | fresh outputs、对账、Claude review brief；不含 render 实施后的动态环境 | CP4 |

CP1→CP3 是 render 生产实现的原子闭包：不能先提供不安全 Provider，再补 snapshot；不能先让
ScreenContainer 使用旧单数 catalog，再迁 `definePart`。CP4 的测试接线与 production red vector 必须
与对应实现同批完成。

## 3 · 横切机制对照表

| 机制 | ① 用哪个现成能力/规范 | ② 如何验证 | ③ 无现成时:必须符合什么形态 | ④ 本批适用全集 |
|---|---|---|---|---|
| 读侧节点授权 | 当前 `Runtime` facade 的 `status/getState/subscribe`；`ui-state` `selectScreen/selectLayers` | `[focused/static]` fake source 记录调用顺序；非 started 时 `getState` 调用计数为 0；源码无 `getStore` | Provider 只接 `getStatus/getState/subscribe`，listener 无 payload/dispatch | Runtime snapshot、screen/layer selector |
| 写授权与 grant 复核 | N/A：render toolkit 不拥有业务写 | `[static]` 无 `defineCommand`/`dispatchCommand`；`T-10` 只观察读侧重渲染 | 不增 command/context 写接缝 | 所有 render 组件与 hook |
| 跨 owner 写与事务 | N/A：无后端、无跨 owner 写 | `[static]` 无 command actor/module | N/A | 无 |
| 集合形态与分页 | `UiContentState.contentSets[displayMode].layers`；`selectLayers` 返回完整只读数组 | `[focused]` 0/1/多个 layer 检查完整映射、tier/时间排序；无 pagination/slice/limit | 全量有序映射；不设 render 自有深度上限 | LayerStack 的 layer entries |
| 缓存失效 / 改完刷新什么 | S-6 `Runtime.subscribe` + React `useSyncExternalStore`；root 仍由 state owner 返回 | `[focused]` dispatch 与 status transition 触发重渲染；unmount 后 unsubscribe；同 root selector result 引用稳定 | 不复制 root、不 polling、不写 default | Provider、ScreenContainer、LayerStack、useUiStateSelector |
| RTK 数据读取与加载判定 | N/A：render 不读 RTK Query | `[static]` 无 RTK Query/currentData/isFetching；状态来自 runtime facade | N/A | 无 |
| 同一事实只有一个住址 | `ui-state` content state、Runtime state/status、集成层 catalog；前端规范 §3-E | `[static/focused]` context 只保存输入引用；selector 只缓存 root/result，不镜像 root 到 local state | catalog 只安装期注入；不把 StateRoot 复制到 render state | root、status、UiCatalog、RendererCatalog |
| 失败可见且原因不得改写 | 需求稿 §4.3a；`platform-ports` `LoggerPort` 的 typed `warn/error` | `[focused]` 五种 testID distinct；三种 part error 的 category/event/data exact；业务组件非法 props 不被调用 | runtime lifecycle observation 与 part diagnostic 分型；不把正常 empty 改成 error | unavailable、empty、missing catalog、missing renderer、invalid props |
| owner 错误到 HTTP 的映射与注册处 | N/A：无 HTTP | N/A | N/A | 无 |
| 幂等键构成与重放语义 | N/A：render 不发命令 | N/A | N/A | 无 |
| 该用生成物的地方不得手搓字符串 | ui-state/runtime 导出的类型与 selector；package `moduleName` | `[static/typecheck]` 不手写命令 type/具体 key；`definePart` 类型必须由依赖包导出类型贯通 | 仅保留 capability diagnostic event 与 fallback testID；不手写业务 command | 公共类型、fallback、diagnostic |
| 日志落点与脱敏字段 | `LoggerPort` `LogWriteInput` / `LogFields`；observability 标准 | `[focused]` logger spy 断言 category/event/data；data 不含 raw props/payload/token | part diagnostics 只允许 `partKey/displayMode`，第二跳加 `rendererKey`，非法 props 只加 `valueType`；runtime status observation 只含旧/新 status | RenderProvider logger、两条解析路径 |
| 迁移回填与可逆性 | N/A：无持久化 schema、migration 或 seed | N/A | N/A | 无 |
| 前端共享行为(Drawer/列表/表单生命周期) | N/A：TER React Native toolkit，不是 admin web surface；仍检查 shared foundation 无对应能力 | `[static]` 不复制 admin foundation 能力；renderer 自己拥有控件 | N/A | 无 |
| 候选/下拉数据源 | N/A：无候选控件 | N/A | N/A | 无 |
| 编码与名称呈现 | ui-state `UiCatalogEntry.title/description` 仍由 catalog owner 保存；render binding 不接文案 | `[typecheck/focused]` `definePart` 两半 ownKeys 对账；渲染树不从 catalog 文案生成业务 UI | render 不显示/改写 title/description；fallback 不新增产品文案 | catalogEntry、rendererBinding、fallback |
| 会同时坏的东西是否已声明为原子组 | CP1–CP4、IA 四个能力面与当前 S-6/S-7 seam | `[static/focused]` 每个 CP gate、全批对账、独立 adversarial review | catalog/adapter/selector/resolution/test wiring 一起交付 | render 全部变更 |

## 3a · L2 与 UI 前置复核

```text
UI_DESIGN_REVIEW=NOT_APPLICABLE_WITH_REASON:本包没有产品 Journey、业务页面或用户交互控件；IA 仅覆盖 toolkit 渲染/诊断状态
TESTID_REVIEW=NOT_APPLICABLE_WITH_REASON:本批不编写 L2 脚本；focused test 使用 requirement 固定 testID 变体
L2_SCRIPT_ADMISSION=BLOCKED
```

fallback testID 仍是组件 focused proof 的接口，不是 L2 准入。真实视觉空态、真实层叠与设备触摸语义
不在本授权内，不能用 testID 输出伪装为 L2 PASS。

## 4 · 每个 CP 的门控

### RENDER-CP0

| 项 | 定义 |
|---|---|
| 可证伪失败条件 | 任何源文件、详设或测试仍把单数 `containerKey` 当 UiCatalogEntry 字段，或把 Runtime 直接当 `stateSource`；需求稿历史文字未与当前 S-6/S-7 事实分开 |
| 不变量 | 放置 command 仍单数；catalog 准入是 `containerKeys`；Runtime 实际是 `status` 字段 + `getState` + `subscribe`；render 只接 adapter |
| FORBID | 不改 showScreen payload；不调用 `getStore`；不引 `StateRoot`；不为过时文字添加兼容 fallback |
| 比例验证 | `[static]` rg/source readback + `[typecheck]` dependency/API shape；无需 DEV/L2 |
| 形态理由 | 以当前 owning source 为事实比沿用需求稿的历史“前置未完成”状态更小、更可执行；不增兼容层 |
| RECALL | `requirements-claude.md` §1.1–1.3、§4.0–4.0b、§4.6a、§4.9、ui-state catalog/selectors、runtime Runtime/createRuntime、skeleton graph |

### RENDER-CP1

| 项 | 定义 |
|---|---|
| 可证伪失败条件 | `definePart` 输出的 catalogEntry 含 component/layerTier，或 rendererBinding 含 title/description；重复 rendererKey 被后者覆盖；catalog 可在构建后 register/mutate；显式自有 `layerTier: undefined` 被静默合并为 `standard` |
| 不变量 | `containerKeys` 只读数组可空且交给真实 ui-state ownKeys 校验；displayModes/workspaces/instanceModes 非空闭集；RendererCatalog 构建一次、重复抛错、无 register；layerTier 只属于 renderer binding |
| FORBID | 不定义自有 catalog 准入/键路由；不生成具体 partKey/containerKey；不把 tier 推进 ui-state |
| 比例验证 | `[typecheck/focused]` definePart→real createUiCatalog；重复/冻结/ownKeys tests；T-9b 的省略/显式 undefined 成对 oracle；`T-9a/T-9b/T-13/R-19/R-20` red vectors |
| 形态理由 | 两张安装期 catalog 对称但各自保有事实：ui-state 保 JSON 准入，render 保组件/tier；比单一 registry 或模块 singleton 更小 |
| RECALL | ui-state `types/catalog.ts`、`foundations/catalog.ts`；requirements §4.2/§4.6/§4.6a；frontend standard §1-0/§1-1/§3-E；POC rendererRegistry/defineUiScreenPart |

### RENDER-CP2

| 项 | 定义 |
|---|---|
| 可证伪失败条件 | `getState` 在 created/starting/failed 被调用；status/root snapshot 每次新分配导致循环；started 或 state dispatch 不重渲染；selector 在同 root 上返回新对象造成额外重渲染 |
| 不变量 | snapshot 先读 status；非 started 返回稳定 unavailable snapshot 且不调 getState；started 才读 root；相同 status/root 返回同一 snapshot；selector 以 root 引用缓存 result；selector 纯函数 |
| FORBID | 不以 try/catch 掩盖 getState 抛错；不把 status 当可独立订阅源；不加 polling/batch；不在 render 读 getStore/dispatch |
| 比例验证 | `[focused]` fake stateSource + react-test-renderer `act`；分别覆盖 created/starting/failed、started、root identity、selector identity、unmount unsubscribe |
| 形态理由 | `useSyncExternalStore` 是 React 内置同步接缝；闭包 snapshot reader 只缓存 `(status,root)`，不复制业务 state |
| RECALL | runtime `Runtime`/`createRuntime` 当前实现；requirements §4.0/4.0a/4.0b；React 19.2.3 API 当前依赖；S-6 focused proof |

### RENDER-CP3

| 项 | 定义 |
|---|---|
| 可证伪失败条件 | screen/layer 任一跳静默 return null；empty/runtime unavailable 共用 testID；非法 props 调业务组件；已接受的 standard→alert 技术排序未生效；displayMode 被写死/默认 |
| 不变量 | `SurfaceRoot` displayMode/containerKey 必填；ScreenContainer 与 LayerStack 都走两跳；五种 fallback testID 独立；三种 part-level diagnostic exact；layer sort tier→openedAt→layerId |
| FORBID | 不缓存/keep-alive/loading/screenReady/default part；不使用具体 key/id 前缀；不提供 automation context/command |
| 比例验证 | `[focused]` real ui-state root + real catalogs + react-test-renderer tree/order/logger spy；screen 与 layer 对缺失/props 各有场景 |
| 形态理由 | 解析与 fallback 共用纯 resolve helper，但 screen/layer 保留各自宿主路径，确保任一边静默都会红 |
| RECALL | requirements §4.1–4.9、§5–§8；ui-state `selectContent.ts`/content types/actors；POC ScreenContainer/OverlayHost/AlertHost/UiRuntimeContext |

### RENDER-CP4

| 项 | 定义 |
|---|---|
| 可证伪失败条件 | `.tsx` 未被 runner 收集；十三条 T 或 R-1..R-20 缺用例/红向量；T-13 只 mock ui-state；static gate 用存在性断言代理行为；mutation 改 fixture 而不改 production |
| 不变量 | 新建 `test` script、Vitest config、`.ts/.tsx` include、devDependency 与 `REAL_TESTS`；T-13/R-19 真走 definePart→real ui-state catalog→real selectAvailableParts；machine gates 各有真实 red vector |
| FORBID | 不增加 testing-library；不扩骨架 dev dependency 而偷用 workspace test-support；不把 L2/UNENFORCEABLE 项包装成 PASS |
| 比例验证 | `[focused]` package tests + `[static]` source gates + `[behavior]` temp sandbox production mutations；逐条保留 baseline/red/cleanup |
| 形态理由 | `react-test-renderer@19.2.3` 已在 lock 且与 peer React 对齐；比引入新的 DOM/test library 成本小 |
| RECALL | requirements §8.0–§8.3；frontend standard §1-0/§1-1/§2-D/§3-E；`yarn.lock` react-test-renderer/vitest；render package current files |

### RENDER-CP5

| 项 | 定义 |
|---|---|
| 可证伪失败条件 | 设计维度、源代码、测试、输出或 IA 有一项仍冲突；把 S-6/S-7 历史文字当成实现证据；独立审查缺少输入清单或第二轮越过上限 |
| 不变量 | IA/详设/计划逐项一致；公共面 exact；行为与静态证据分层；未授权 DEV/L2/UAT 明确为未做；fresh independent review 两轮上限受控 |
| FORBID | 不以“按设计实现”替代 implementation review；不创建退役 compliance-control/分母台账；不改需求产品取舍并自判 |
| 比例验证 | `[static]` readback + `[focused]` outputs + fresh independent `REVIEW_TARGET=DESIGN` adversarial review；无 render implementation 因而无实现验收 |
| 形态理由 | 当前交付是设计评审包，最小闭环是 IA→design→plan→independent review，不预演代码/动态环境 |
| RECALL | 本详设 §3/§7/§11、IA 详设、requirements 全文、verification governance、independent adversarial review governance |

## 5 · operation / path / face / 集合形态

本包无 HTTP operation、无 backend owner、无 server collection。以下不是遗漏，而是对本包 toolkit 责任的
明确 `N/A`：

| 业务意图 | operationId | method/path | consumer face | 集合形态 | 预期规模与增长驱动 |
|---|---|---|---|---|---|
| render toolkit 读取 Runtime/ui-state | N/A | N/A | N/A | screen 0/1；layer 全量有序映射 | screen 是单 container placement；layer 数量由 ui-state content set 增长，render 不设数值上限/分页 |

## 6 · 跨 owner 写矩阵

N/A：render 不写 Runtime、ui-state 或其它 owner；`showScreen/openLayer` 的 command 由业务 owner/集成层
调用，render 只读取已存在 content。不存在 transaction、rollback、cross-schema 或 grant 责任。

## 7 · 声明—传递—消费矩阵

| fact | declaration | transfer | consumption | proof |
|---|---|---|---|---|
| surface displayMode | 集成层根据 display-context 计算 `DisplayMode` | `SurfaceRoot` 必填 prop→surface context→ScreenContainer/LayerStack | 两个宿主显式用同一 surface mode 选择 content set | T-2/R-1/R-2；source 无默认/常量 |
| placement containerKey | ui-state `showScreen` payload 单数 | Runtime dispatch→ui-state content state→`SurfaceRoot` prop | `selectScreen(root,displayMode,containerKey)` | source readback + T-2 |
| catalog admission containerKeys | render `definePart` declaration；ui-state `UiCatalogEntry` exact field | `catalogEntry`→real `createUiCatalog` | 仅 ui-state `selectAvailableParts` 枚举消费，render 不调用 | T-9a/T-13/R-19/R-20；two production mutations |
| runtime status | Runtime `status` owner | integration adapter `getStatus: () => runtime.status`→RenderProvider | snapshot reader先读 status，unavailable 时不取 root | fake source records + non-started getState count |
| state root | state/runtime owner `getState` | adapter closure→snapshot reader→pure selector | `selectScreen`/`selectLayers` | snapshot identity + status gate |
| state invalidation | Runtime S-6 `subscribe` | Provider/source subscribe→`useSyncExternalStore` | ScreenContainer/LayerStack/useUiStateSelector 重读 | T-10 + unmount oracle；S-6 current source |
| renderer binding | `definePart` component/rendererKey/layerTier | binding→`createRendererCatalog` | two-hop resolver | T-1/T-4/T-5/T-9b/R-11 |
| diagnostic | render `RenderPartDiagnostic` union与生命周期 observation分离 | resolve result→fallback reporter→injected LoggerPort | integration logger sink | exact category/event/data focused assertions |
| layer order | renderer binding stable `layerTier`；state `openedAt/layerId` | LayerStack resolve→sort | rendered child order | T-3/R-5；视觉 z-order L2_UNVERIFIED |
| props shape | ui-state placement/layer optional StateJsonValue | state→resolver shape gate→business Component 或 fallback | absent→`{}`；plain object→原字段；other→fail-closed | T-4b/T-11/T-12 |
| test collection | package `test` script/config + `REAL_TESTS` invariant | package runner→`.ts/.tsx` files | Vitest discovers component tests | CP4 runner output与deliberate missing-include red check |

## 8 · 规则 → owner 判定点

| 规则编号 | owner 判定点 |
|---|---|
| RENDER-RULE-01 | Surface identity 必须由 `SurfaceRoot.displayMode`/`containerKey` 显式给出，无默认/环境推断 |
| RENDER-RULE-02 | Runtime unavailable 与 container empty 是不同 fallback；snapshot status-first |
| RENDER-RULE-03 | screen/layer 均为 partKey→UiCatalog entry→rendererKey→component 两跳 |
| RENDER-RULE-04 | renderer catalog 安装期冻结、重复 key 抛错、无 register |
| RENDER-RULE-05 | `containerKeys` 由 ui-state ownKeys/closed validation 承接；render 不复制过滤/路由 |
| RENDER-RULE-06 | layerTier 是 render renderer binding 稳定属性；已接受的 render 技术树约束是 standard 在 alert 之前，具体业务 part 的 tier 归属由 binding 提供而非 render 自行选择 |
| RENDER-RULE-07 | props 缺席合法；非普通对象不调用业务组件、落 invalid-props fallback |
| RENDER-RULE-08 | render 只读，不定义/dispatch command，不提供 automation context |
| RENDER-RULE-09 | snapshot root/status 不复制；selector 按 root 引用记忆化；selector 纯函数 |
| RENDER-RULE-10 | T-13/R-19 必须真实跨包调用，ui-state filter mutation 必须使 render test 红 |

## 9 · owner API 与消费者清单

### 9.1 公共 API exact set

实现后预期公共 named export 分成两个不得混淆的精确集合。骨架基础导出是现有公共面，必须原样保留；领域
toolkit 导出是本批新增的精确集合。R-14 必须分别对账，最终总数为 16，不得把“13 个领域符号”误读成
“整个 package 只能剩 13 个导出”。

```text
INFRASTRUCTURE_EXPORTS (现有、保持不变):
moduleName, dependencyModuleNames, devDependencyModuleNames

DOMAIN_EXPORTS (本批新增，精确 13 个):
types: LayerTier, RendererBinding, RendererCatalog, SurfaceRootProps, RenderProviderProps
components: RenderProvider, SurfaceRoot, ScreenContainer, LayerStack
factories: createRendererCatalog, definePart
hooks: useSurfaceDisplayMode, useUiStateSelector

PUBLIC_EXPORTS_TOTAL=16
```

骨架基础导出与领域导出都必须由 `src/index.ts` 直接导出，不增加第三个符号住址。

不增加 `RenderStateSource` named export、fallback component、RuntimeModule、module factory、具体
partKey/containerKey、dispatch/getStore、automation context。`RenderProviderProps.stateSource` 使用内联
只读结构，root 类型通过 `ReturnType` 从现有 Runtime API 推导，不 import `StateRoot`。

### 9.2 `definePart` transfer contract（canonical shape）

props 类型必须用具名泛型边界，不得使用 `any` 或开放的 `Record<string, unknown>`：

```text
type RenderComponentProps = object
type RenderComponent<TProps extends RenderComponentProps = RenderComponentProps> = React.ComponentType<TProps>
type RendererBinding<TProps extends RenderComponentProps = RenderComponentProps> = Readonly<{
  rendererKey: string
  component: RenderComponent<TProps>
  layerTier: LayerTier
}>
```

`definePart<TProps extends RenderComponentProps>` 的输入可以省略 `layerTier`，省略时只在 factory 内物化
`layerTier: 'standard'`；输入对象自有 `layerTier` 但值为 `undefined` 是非法形状并抛错。factory 输出的
`rendererBinding` 永远自有且仅有 `rendererKey`、`component`、`layerTier` 三个字段，`layerTier` 不以缺席
表达默认值。`catalogEntry` 仍只包含 ui-state approved keys，由真实 `createUiCatalog` 做 exact `Reflect.ownKeys`
校验；renderer fields 不得串入 entry，`title/description` 不得串入 binding。

省略与自有 `undefined` 必须由独立的 focused oracle 区分，而不能只从 canonical 输出反推：control fixture
省略 `layerTier`，断言输出 binding 的 `layerTier` 为 `standard`；negative fixture 必须保留一个可观察的自有
`layerTier` 键且值为 `undefined`（测试可用 `Object.defineProperty` 构造），断言 `definePart` 同步抛错且错误
明确指向 `layerTier`，不得接受物化为 `standard` 的 binding。错误的完整 message 不属于公共契约，但字段级错误
指向必须可断言。production red vector 必须改 `definePart` 的输入形状分支，例如以 `?? 'standard'` 合并自有
`undefined` 或删除该拒绝分支；上述 negative case 必须变红，而 control case 仍保持绿色。

这里的泛型只贯通安装期声明与 renderer component；state 中的 JSON props 仍须经过运行时普通对象 gate。
catalog 的异构 binding 收集必须沿用这个具名边界完成，禁止以 `any` 或双重 cast 抹平；若 TypeScript 无法在
该边界保持类型安全，CP1 停止并修正类型设计，不增加运行时 fallback。

### 9.3 API 与消费者

| owner 方法/符号 | 谁调用 |
|---|---|
| `RenderProvider` | 未来集成层/assembly；当前 render package 无生产 caller，骨架下游为 platform-console/admin-shell 等 |
| `SurfaceRoot` | 集成层每个物理 surface 一次 |
| `ScreenContainer`/`LayerStack` | `SurfaceRoot` 固定树内部 |
| `definePart` | 未来业务 UI package 的安装期 catalog 构建 |
| `createRendererCatalog` | 集成层安装期收集各 `rendererBinding` |
| `useSurfaceDisplayMode` | 注册业务组件需要 surface identity 时 |
| `useUiStateSelector` | 注册业务组件需要读 ui-state 时；命令/编辑变量/automation 由各 owner 承接 |

当前无生产 caller 是因为本包仍为骨架；这些 API 是需求明确的 toolkit surface，不能按当前零 caller
删除。实现后 CP5 必须重新列出真实 caller；若某个新增方法没有被需求或真实组件消费，则删除。

## 9a · 实施前全链同步变更清单

| 变更事实 | 契约 / 唯一生成源 / 生成物 | 后端 owner / edge / migration | 前端 model / surface / state | focused / 静态 / HTTP / L2 测试 | fixture / seed 唯一来源 / executor | 结论 |
|---|---|---|---|---|---|---|
| `UiCatalogEntry.containerKeys` 当前契约 | ui-state `src/types/catalog.ts` 与 `foundations/catalog.ts`；非本批生成物 | N/A | render `definePart` catalogEntry 输入 | T-9a/T-13/R-19/R-20；无 HTTP/L2 | render cross-package fixture；无 seed | 消费 current contract；不改 ui-state |
| Runtime read-only source | runtime `src/types/runtime.ts`/`createRuntime.ts`；S-6 已落地 | N/A | RenderProvider `stateSource` adapter | fake source snapshot/subscription tests；无 HTTP/L2 | focused fake source | 消费 current contract；不改 runtime |
| surface identity | ui-state command/selector contract + display-context integration seam | N/A | `SurfaceRootProps`/context；不落 state mirror | T-2/R-1/R-2 | two-surface fixture | 同步实现与测试 |
| renderer catalog/tier | render `definePart`/`createRendererCatalog` | N/A | renderer binding + LayerStack order | T-1/T-3/T-4/T-5/T-7/T-8/T-9b/R-3..R-7/R-11 | component fixtures | 同步实现与测试 |
| props mapping | ui-state `ScreenPlacement.props`/`LayerEntry.props` StateJsonValue | N/A | resolver shape gate；业务 component props | T-4b/T-11/T-12 | absent/plain/array/null fixtures | 同步实现与测试 |
| fallback/diagnostic event | render fallback reason union + injected LoggerPort | N/A | no Redux state/no copy | T-4/T-4b/T-5/T-6/R-6/R-7 | logger spy fixture | 同步实现与测试 |
| React test collection | package `package.json`/`vitest.config.ts`/`tsconfig.json`/`terminal-invariants.json` | N/A | test runner only | T/R focused + runner collection output | no seed | 同步接线与测试 |
| public exact surface | `src/index.ts` + package invariant | N/A | no consumer model | R-14 + typecheck/static | public-surface type fixture | 骨架 3 个 infrastructure exports 原样保留；本批新增 13 个 domain exports，最终 exact total=16 |
| package documentation | package 根 `README.md`，按 TER TR-10 说明 toolkit 定位/作用/结构/用法/迭代 | N/A | README 与真实 public surface 对账 | CP5 static/readback；无 HTTP/L2 | N/A | 仅在 future render implementation closeout 创建；本轮不创建 |

## 9b · 变更定位

实现计划只使用下列符号/文本锚点，不使用易漂移行号：

| 文件 | 唯一锚点 |
|---|---|
| `src/index.ts` | 当前 `moduleName`/`dependencyModuleNames` exports 块 |
| `src/dependencies.ts` | 当前 `dependencyModuleNames` 与 `devDependencyModuleNames` 声明 |
| `src/types/` | 新建 `LayerTier`、`RendererBinding`、`RendererCatalog`、surface/provider props 类型 |
| `src/foundations/` | 新建 `createRendererCatalog`、`definePart`、snapshot reader、diagnostic reporter |
| `src/components/` | 新建 `RenderProvider`、`SurfaceRoot`、`ScreenContainer`、`LayerStack` |
| `src/hooks/` | 新建 `useSurfaceDisplayMode`、`useUiStateSelector` |
| `package.json` | 现有 `scripts.typecheck` 与 `devDependencies` 对象 |
| `tsconfig.json` | 现有 `include` 数组 |
| `terminal-invariants.json` | 现有 `owned.test` 对象 |
| `vitest.config.ts` | 新建文件的 `test.include` |
| `test/` | 新建每个能力命名的 `.test.ts/.test.tsx` |
| `tools/terminal-ui-render/` | 新建 static/behavior runner；每个 `replaceOnce` anchor 必须唯一计数 |
| `README.md` | package 根中文 README；实施收口时与 §9.1 的 16 个导出及真实用法逐项对账 |

## 10 · 数据迁移与 seed

### 10.1 数据迁移

N/A：render 不改数据库、持久化 schema、Redux slice 或 ui-state state shape。`containerKeys` 的 S-7
已在前置批次落地，本批只消费；不能在 render 增加兼容迁移或旧字段 fallback。

### 10.2 seed

N/A：本批无业务数据、新 schema 或 DEV seed。focused fixture 只在 test 内构造真实 ui-state catalog
和 state root；不执行 reset/seed，也不把 fixture 当 seed。

## 11 · 验收场景设计

本节把需求稿的 T-1..T-13（含 T-4b）与 R-1..R-20 全量落到测试/静态观察；不把
`UNENFORCEABLE_BY_MACHINE`/`L2_UNVERIFIED` 包装成机器 PASS。

### 11.1 T 行为场景

| 场景 | owner/fixture | business/behavior oracle | production red vector |
|---|---|---|---|
| T-1 two-hop screen/layer | `definePart` 输出 + real ui-state `createUiCatalog` + real root entries | 不提供 `layer.rendererKey`；screen/layer 仍通过 entry.rendererKey 渲染正确 component | 删除第一跳 lookup/读取 layer.rendererKey；render test 必红 |
| T-2 surface isolation | 一个 fake root 的 PRIMARY/SECONDARY 两 content set，两个 SurfaceRoot | 每个 root 只出现自己 displayMode 的 component | 把 resolver displayMode 固定为 PRIMARY；SECONDARY test 必红 |
| T-3 tier/order | standard/alert，多 openedAt，含相同时间不同 layerId | tree child 顺序为 standard 全部、alert 全部；组内时间升序、同值 layerId 字典序 | 去掉 tier sort 或 tie-break；顺序断言必红 |
| T-4 two-hop missing diagnostics | screen/layer 各一条 catalog missing 与 renderer missing | 不调用业务 component；各自 fallback testID + exact category/event/data | 任一 missing path `return null`/笼统 event；对应 test 必红 |
| T-4b invalid props | screen/layer 的 props 为 null/array/primitive | 不调用 component；invalid-props testID；event=`invalid-props-shape`、valueType exact | 以空 props 调 component、包装 `{value}` 或静默跳过；必红 |
| T-5 screen missing renderer | screen placement entry 存在但 binding 缺失 | screen 走 missing-renderer fallback/diagnostic；不静默 | screen 路径 return null；必红 |
| T-6 empty screen | 无 placement | container-empty testID；fallback 不在 UiCatalog/RendererCatalog | 把 fallback 注册为 part或写 default placement；必红 |
| T-7 duplicate renderer | 两 binding 同 rendererKey | createRendererCatalog 抛 duplicate error | Map 后者覆盖；必红 |
| T-8 frozen renderer catalog | 构建后尝试写属性/寻找 register | mutation 抛或不可改变；无 register own key | 暴露 register/可写 Map；必红 |
| T-9a catalogEntry half | `definePart`真实输出→real ui-state createUiCatalog | exact ownKeys 可接受；component/layerTier 串台由 ui-state 抛 | definePart 把 renderer fields塞入 entry；必红 |
| T-9b rendererBinding half | `definePart`真实输出→real createRendererCatalog；另有不进入 catalog 的输入形状 focused case | control：省略 `layerTier` 物化为 `standard`；negative：输入保留自有 `layerTier: undefined` 时 `definePart` 同步抛出且错误指向 `layerTier`，不产生 canonical binding；正常 case 的 ownKeys 精确为 `rendererKey/component/layerTier`，title/description 串台抛 | render binding 校验放宽、缺失 layerTier 或串入文案；将显式 undefined 以 `?? 'standard'` 合并；每个对应 case 必红 |
| T-10 subscribe/unsubscribe and snapshot lifecycle | fake stateSource + react-test-renderer mount/unmount；fake source 记录 listener、getStatus、getState、selector 调用 | pre-start mount 不调 getState；starting→started 顺序导致可用重读；started state change 同步触发重读；进入 failed 通知并显示 unavailable，之后不再以残留订阅触发 state rerender；unsubscribe exactly once 且 source 退订幂等；同一 root selector result 引用稳定、root 变化才重算；listener 集合计数是退订 oracle | 去掉 status-first、failed close、state attach、root cache、selector cache 或 unsubscribe；对应断言必红 |
| T-11 props pass-through | absent/plain object with sentinel fields | absent component receives `{}`；plain values/keys unchanged；宿主不注入 | clone/drop/inject or absent invalid；必红 |
| T-12 hook order | same renderer with props absent/present across renders | no hook-order error；hook invocation count/React render stays valid | conditional hook `props.x ?? useOptionalX()`；必红 |
| T-13 empty containerKeys | real `definePart(containerKeys: [])`→real ui-state catalog→real `selectAvailableParts` for actual container | result excludes entry；这是 declaration-transfer contract，不是 render production enumeration | **两条 mutation 都保留**：改 ui-state `includes` filter 必须使 render test 红；另改 render `definePart` output to include container key，必须使 render contract test 红 |

### 11.2 R 控制/契约场景

| 场景 | 最低证据与 oracle | 必须变红的错误形状 |
|---|---|---|
| R-1 | typecheck：SurfaceRoot 缺 displayMode 编译失败 | optional/default displayMode |
| R-2 | focused：两个显式 mode 各读自己的 content | mode 常量化 |
| R-3 | focused：duplicate rendererKey 抛 | 后者覆盖 |
| R-4 | static + focused：catalog frozen/no register | 暴露 register或可写 |
| R-5 | focused：tier、openedAt、layerId 顺序 | 插入顺序/无 tier |
| R-6 | focused：missing renderer diagnostic exact | return null/no-op |
| R-7 | focused：empty fallback not catalog part | fallback 注册/默认写入 |
| R-8 | static forbidden scan：render source 无具体 key literal | 增加任意 business key |
| R-9 | static forbidden scan：无 dispatch/command | 增加 dispatch |
| R-10 | static forbidden scan：无 defineCommand | 增加 command |
| R-11 | focused ownKeys 两半分离，并单独读回 `layerTier` 省略与自有 `undefined` 的输入边界 | fields 串台，或把显式 `undefined` 当作省略并物化 `standard` |
| R-12 | static forbidden scan + hook behavior | conditional hook |
| R-13 | package/source static：React/RN peer only | 移到 dependencies |
| R-14 | public source/invariant exact set + typecheck；分别对账 3 个 infrastructure exports、13 个 domain exports，total=16 | 删除/改名任一骨架导出、增删任一 domain symbol，或把两组分母混成单一 13 项 |
| R-15 | static forbidden scan：无 getStore | 用完整 Redux store |
| R-16 | dependency/source scan：无 react-redux，hook 使用 React API | 添加 react-redux/import |
| R-17 | source/dep static：无 StateRoot import；依赖图仍是三包 | 显式 import StateRoot |
| R-18 | static/source：无 RuntimeModule/slice/install | 增加 module factory/slice |
| R-19 | 与 T-13 同一真实跨包调用，但独立 test name/readback | ui-state filter mutation 后 render test 不红 |
| R-20 | real ui-state ownKeys exact test | 改为 subset/superset 判定 |

`T-13/R-19` 的 mutation 责任不能互相冒充：ui-state filter mutation 验证跨包枚举契合点，
definePart-output mutation 验证 render declaration transfer；两个 test 都必须从 render package runner
真实调用，不能只运行 ui-state 自己的 suite。

### 11.3 诊断形态

为解决需求稿中“runtime-unavailable 要记诊断”与“part diagnostic event 三选一”的 category mismatch，
实现采用两个类型族：

```text
RenderRuntimeObservation = {category: 'ui.base.render', event: 'runtime-status-changed', data: {previousStatus, status}}
RenderPartDiagnostic =
  | {event: 'missing-catalog-entry', data: {partKey, displayMode}}
  | {event: 'missing-renderer', data: {partKey, displayMode, rendererKey}}
  | {event: 'invalid-props-shape', data: {partKey, displayMode, valueType}}
```

`runtime-status-changed` 是 Provider-level lifecycle observation，不属于三项 part error diagnostic，且
不带 partKey；`container-empty` 不写 error diagnostic。此处是实现前需求文档的最小文字对齐项，不能
通过把 status observation 错塞进 part diagnostic 来“满足”闭集。

### 11.4 未由机器判定的范围

以下保持需求稿标记，不伪造 PASS：空态是否具有产品可接受的视觉质量、某个业务 renderer 的产品选择、业务包何时
发 show/open command、`containerKeys: []` 与 layer-only 的产品等价性、真实设备视觉 z-order。`standard` 排在
`alert` 之前仅是本批已接受的 render 技术树排序约束；它不替任何业务 renderer 选择 tier。无 DEV/L2/UAT/部署授权，
任何对应输出均不得写入本批证据。

## 12 · 当前 open / alignment

| 项 | 状态 | 最小处置 |
|---|---|---|
| requirements 的 S-6/S-7 历史文字 | `HISTORICAL_BOUNDARY_RECORDED`，不代表当前设计/source 阻塞 | 本详设与实现以 current owning source 为准；未来实施前由 owner 同步 wording，不加兼容 API |
| Runtime `getStatus` 与实际 `status` | 已有明确答案 | 集成层 adapter 闭包读取 `runtime.status`；render 不新增 Runtime 方法 |
| runtime observation 与三项 part diagnostics 的命名 | `HISTORICAL_BOUNDARY_RECORDED` | 本详设将 row 1 定义为 lifecycle observation，三项 error event 继续闭集；未来 owner 同步需求稿措辞，不扩大业务诊断事件 |
| 业务 command 接缝 | 已登记为下游欠账 | render 只守“不导出/不接收/不转发”；业务包/集成层另行定义 |
| L2/真实视觉 z-order | 未授权/不可判定 | 保持 `L2_UNVERIFIED`，不阻塞本批设计交付 |

当前没有新增需要 Dexter 裁决的产品取舍：`standard` 在 `alert` 之前是已接受的 render 技术树排序约束，而具体
renderer 的 tier 归属、空态视觉质量、业务 command 时机与 `containerKeys: []` 的产品等价性仍是不可由本包自判的
事项。若未来要改变该技术排序，或要把它提升为新的产品/Journey 语义，必须由 Dexter 另行裁决；若集成侧要求
runtime 增加 `getStatus()` 真实方法，则 CP0 停止，不在 render 内部加 fallback。

## 13 · 停止条件

在实现期任一条件出现即停在对应 CP：

- 当前 ui-state/runtime public shape 与本详设不一致，尤其 `containerKeys`、`Runtime.subscribe`、
  `Runtime.status` 或 `getState` non-started throw；
- Provider 无法只用 `getStatus/getState/subscribe` 闭合，或必须把完整 Runtime/getStore/dispatch
  交给 render；
- `definePart` 的 canonical catalogEntry 无法通过真实 ui-state ownKeys 校验；
- T-13/R-19 的 render runner 只能让 ui-state 自己 test 红，不能让 render focused test 红；
- `.tsx` 测试不被收集、任何 required T/R 判据没有对应 focused/static red vector，或 mutation 只能改 fixture；
- 需要引入 `screenReady`、cache、loading、automation provider、具体 key、RuntimeModule 或新的
  public command 才能通过；
- 发现真实下游产品/Journey 需要一个未在需求稿裁定的用户动作、权限或文案；回 Dexter，不自判。

## 13b · 两阶段三维对账

### 阶段一：CP 级

每个 CP 完成后、进入下一 CP 前，fresh 独立 subagent 逐点对照：

1. requirements（当前已对齐的版本）；
2. 本详设与 IA/实施计划；
3. `project-memory` 命中的设计标准与 owning source。

逐点检查行为、形态、动作、关系、位置、用户可见文案、限制、状态/控制、失败/恢复、可访问性/焦点、
数据来源/失效边界。发现 mismatch 必须由主 agent 修复并重新核查，不把问题留给 CP5。

### 阶段二：整批

CP4 完成、整体测试前再做一次全批对账；它不是阶段结果拼接，重点找跨 CP 的漂移：

- `containerKey`（placement）与 `containerKeys`（admission）没有混用；
- status-first snapshot、S-6 adapter 与 unsubscribe 没有绕过；
- catalog 文案/组件/tier 没串台；
- `definePart` 省略 `layerTier` 与自有 `layerTier: undefined` 的成对 oracle、错误字段指向和 production red vector 均保留；
- screen/layer 两条路径的 missing/invalid 行为仍对称；
- T/R 分母、`.tsx` 收集、production red mutation 与 IA/设计完全对齐。

## 14 · 设计交付自检

```text
DESIGN_STATUS=READY_FOR_INDEPENDENT_DESIGN_REVIEW
IMPLEMENTATION_AUTHORITY=false
IA_STATUS=READY_FOR_INDEPENDENT_DESIGN_REVIEW
RENDER_IMPLEMENTATION=NOT_STARTED
S6_SUPPLEMENT=IMPLEMENTED_AND_SELF_VERIFIED_SEPARATELY
T_COVERAGE=T-1..T-13 plus T-4b all mapped
R_COVERAGE=R-1..R-20 all mapped
UNENFORCEABLE_BY_MACHINE=preserved and not claimed PASS
L2=NOT_AUTHORIZED
```
