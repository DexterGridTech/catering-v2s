# `ui.base.render` IA 详设（Codex）

```text
IA_SCOPE=RENDER_SURFACE_ROOT,RENDER_SCREEN_CONTAINER,RENDER_LAYER_STACK,RENDER_DIAGNOSTIC_FALLBACK
BUSINESS_SOURCE=doc/plans/platform/2026-09-02-v2s-terminal-ui-base-render-requirements-claude.md
JOURNEY_REFS=NOT_APPLICABLE_WITH_REASON:本包是无业务 owner 的 TER toolkit；业务 Journey 由下游集成包承接
UI_INTERACTION_REF=NOT_APPLICABLE_WITH_REASON:本包没有产品页面、业务控件或产品文案；只定义渲染基础设施与诊断变体
IMPLEMENTATION_DESIGN_REF=doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-design-codex.md
DEXTER_WIREFRAME_REVIEW=NOT_APPLICABLE_WITH_REASON:不新增产品 screen，SurfaceRoot/ScreenContainer/LayerStack 是装配接缝
IMPLEMENTATION_AUTHORITY=false
```

## 1 · IA-ID 与可见维度

本工件只有四个 IA-ID。它们不是业务 Journey ID，而是 render toolkit 的四个可观察能力面。

| IA-ID | businessTask | actorAndScenario | entryAndSurface | controlType |
|---|---|---|---|---|
| `RENDER_SURFACE_ROOT` | 在集成层指定的 surface 上显示该 surface 的 screen 与 layer 内容 | 集成层装配者挂载一个 TER surface；最终用户只看到被业务命令指定的内容 | `RenderProvider` 注入只读运行时接缝后，`SurfaceRoot` 接收必填 `displayMode` 与 `containerKey`；无路由、无本包入口页面 | 本包不提供业务控件；`children` 是装配插槽，不是用户操作 |
| `RENDER_SCREEN_CONTAINER` | 在显式容器中显示 ui-state 当前的 screen placement，或显示可区分的空/错误变体 | 用户所在的指定 surface 已由装配层确定；screen 内容由业务 command 写入 ui-state | `SurfaceRoot → ScreenContainer`；screen 的 `partKey` 来自 ui-state，不由宿主猜测 | 本包不提供 screen 内业务控件；注册组件自己拥有其控件 |
| `RENDER_LAYER_STACK` | 按 renderer binding 声明的技术 tier 与打开时间显示当前 layer 栈；已接受的 render 树规则是 standard 排在 alert 之前，render 不替业务选择某个 part 的 tier | 用户看到业务模块已打开的层；layer 的命令归业务包，不归 render | `SurfaceRoot → LayerStack`；同一 displayMode 下读取 ui-state layers | 本包不提供 layer 操作；close/open command 由业务 owner 承担 |
| `RENDER_DIAGNOSTIC_FALLBACK` | 当内容不能安全画出时，给出可区分且可自动断言的诊断表现，不伪装成业务页面 | 用户看到运行时不可用、空容器或坏注册的明确变体；集成层负责注入 logger | 由 `ScreenContainer`/`LayerStack` 在各自解析路径内产生；没有具体 partKey 或默认业务外观 | 诊断变体无业务交互；每个变体有独立 testID，错误事件由 logger 注入 |

| IA-ID | validationAndError | accessibilityAndTestId | emptyLoadingErrorStates | containerBehaviorUnderLoad |
|---|---|---|---|---|
| `RENDER_SURFACE_ROOT` | `displayMode`、`containerKey`、`stateSource`、两张 catalog 与 logger 缺失时由 TypeScript/Provider 契约拒绝；本包不从 routeContext 推断 | 根壳、screen host、layer host 使用稳定 capability testID；无颜色单独承载状态；无业务 aria 文案 | runtime `status !== started` 是 `runtime-unavailable`，不得与容器空混用；本包不定义 loading、ready 或默认页面 | surface 只承载固定三段树 `children → ScreenContainer → LayerStack`；根壳不因层数量创建第二种布局或分页；视口尺寸由集成/具体 renderer 负责 |
| `RENDER_SCREEN_CONTAINER` | 空 placement 是正常 `container-empty`；catalog 缺失、renderer 缺失、props 非普通对象分别落独立 fallback 与 typed diagnostic；缺席 props 合法 | screen host 与五类 fallback 使用不同 testID；业务组件的可访问性由业务 renderer 负责，宿主不注入额外 props | 不显示 loading；runtime unavailable、container empty、missing catalog、missing renderer、invalid props 五种事实分别表现；失败不写回 ui-state | 一个容器最多映射当前 screen placement；不缓存、不 keep-alive、不分页；screen renderer 自己决定长内容换行/裁剪，host 不静默溢出或改写 props |
| `RENDER_LAYER_STACK` | 每个 layer 两跳解析失败均可观察；invalid props 不调用业务组件；缺失 renderer 不静默丢弃 | layer host 与每个 fallback 使用稳定 testID；顺序由渲染树可观察，真实视觉 z-order 不在本授权内 | 空 layer 列表渲染无层结果；不引 loading；standard 全部先于 alert，组内按 `openedAt` 升序、同值按 `layerId` 字典序 | 全量映射 state 中的 layers，不设深度上限、不客户端分页、不丢旧层；所有 layer 都保留确定排序；单条过长内容由该 renderer 负责 |
| `RENDER_DIAGNOSTIC_FALLBACK` | `missing-catalog-entry`、`missing-renderer`、`invalid-props-shape` 的 logger event、category 与 data 必须精确；runtime 状态仅作 lifecycle observation，不冒充业务错误 | 五种 fallback testID 固定且互不相同；诊断不能以颜色作为唯一信号；不渲染可操作业务控件 | `runtime-unavailable` 有独立变体；`container-empty` 是正常空态无错误诊断；其它三种只记录一次对应内容身份的诊断 | fallback 是单个渲染节点，不随 layer 数量复制默认业务 UI；异常 data 只含 `partKey`、`displayMode`、必要的 `rendererKey`/`valueType` |

## 2 · 不可见维度：可执行观察

| IA-ID | stateAndPermission | navigationAndRefresh | collectionShapeAndScale | dataSourceAndCascade | forbiddenUI |
|---|---|---|---|---|---|
| `RENDER_SURFACE_ROOT` | `[静态 + focused]` 本包只接收 `RenderStateSource={getStatus,getState,subscribe}`；源码不得 import `StateRoot`、`getStore` 或 dispatch。把完整 Runtime 传给 Provider 或增加 dispatch 字段即缺陷 | `[focused]` S-6 listener 在状态变化与 status transition 后触发 `useSyncExternalStore` 重新取快照；不缓存 screen、不写默认 placement；卸载后退订 | `[focused]` 一个 Provider 可承载两个不同 `SurfaceRoot`；每个 root 只有一个显式 `displayMode`/`containerKey`，不存在客户端 collection 分页 | `[静态]` state root 由 runtime/state owner 提供，ui-state 的 `selectScreen`/`selectLayers` 是唯一内容读选择器；catalog 由集成层构建后注入，render 不调用 `selectAvailableParts` | `[静态]` render 源码不得出现具体 `partKey`、具体 `containerKey`、`defineCommand`、`dispatchCommand`、`getStore`、`react-redux`、RuntimeModule 或 install |
| `RENDER_SCREEN_CONTAINER` | `[静态 + focused]` 只读取当前 root 的 `selectScreen(root, displayMode, containerKey)`；没有本包权限模型，也不根据 UI 读失败写状态 | `[focused]` dispatch 新 screen 后同一 surface 只重新解析快照；切换 displayMode 由另一个显式 root 读取另一 content set，不搬运 entry | `[focused]` screen 是单 placement（0 或 1），layers 不在本 ID 中分页；造 missing entry/renderer 时只出现对应 fallback，不隐式补内容 | `[静态]` 第一跳是 `uiCatalog.byPartKey[partKey]`，第二跳是 `rendererCatalog.resolve(rendererKey)`；任一上游改变只导致当前节点重新解析，不复制 catalog 到 state | `[focused + static]` 不出现 loading、screenReady、keep-alive、default part、自动化 provider、字符串前缀分类或业务 command |
| `RENDER_LAYER_STACK` | `[静态 + focused]` 只读取 `selectLayers(root, displayMode)`；layer 操作权限与 command 属业务 owner，本包不能 dispatch | `[focused]` 同步 state 变化后 layer 列表按新 root 重算；无缓存清理或“首次 ready”写入 | `[focused]` 形态是全量有序映射，预期规模是当前 content set 的全部 layer 条目，render 不声明数值上界、不分页、不截断；0/1/多个/大样本都保持排序规则 | `[静态 + focused]` layer 的 `partKey` 先查 ui-state catalog，再用 entry.rendererKey 查 renderer catalog；layerTier 只来自 renderer binding，不进入 ui-state | `[static]` 不出现 OverlayHost/AlertHost 双实现、具体 alert key、id 前缀匹配、`return null` 静默吞掉缺失或 dispatch 接缝 |
| `RENDER_DIAGNOSTIC_FALLBACK` | `[focused]` fallback 不改变 root、catalog、command 或 permission；logger 只能由 Provider 注入，非模块上下文 | `[focused]` 同一错误 identity 在重复 render 中不重复刷诊断；内容恢复或错误 identity 改变时有新的可观察结果；不写默认状态 | `[focused]` fallback 是常数大小的单节点；layer 数量增长只增加对应 layer 节点，不复制或合并错误事实 | `[focused]` missing catalog/renderer/invalid props 分别保留来源字段；props 非法只记录 `valueType`，不把原始 payload 写入日志 | `[static + focused]` 不出现统一空态掩盖错误、错误 event 互相替代、业务文案、token/raw props、可操作的默认 alert |

## 3 · 通用信息架构规则

1. 读侧唯一入口是 Provider 注入的窄 `stateSource`。适配当前 Runtime 时由集成层闭合 `runtime.status` 为 `getStatus()`，并用包装函数调用 `runtime.getState()` 与 `runtime.subscribe()`，render 不接触完整 Runtime。这里的 `getStatus()` 是 render adapter 形状，不是当前 Runtime 上新增的方法。
2. 所有 `displayMode` 读写身份都必须显式：写入由 ui-state command payload 负责，读取由 `SurfaceRoot`/context 负责；render 不从 routeContext、container 名或 partKey 推断。
3. catalog 是安装期构建值。`UiCatalog` 由 ui-state 的精确 ownKeys 校验，`RendererCatalog` 由本包冻结且重复 rendererKey 抛错；两者都没有运行期 register。
4. render 只读不写：不定义 command、不 dispatch、不在空态时写默认 screen、不提供 automation context、不拥有可编辑 uiVariable。
5. screen/layer 均采用两跳解析。业务组件 props 只有字段缺席或普通对象两种可安全调用形态；字段存在但非普通对象必须 fail-closed。
6. empty、runtime unavailable、missing catalog、missing renderer、invalid props 是五个不同事实，必须保留不同 testID；共享布局不等于共享语义。
7. `layerTier` 是 renderer 的稳定属性，render 的 tier 排序只影响 layer 渲染树；它不是 ui-state content state，也不由装配覆盖。`standard` 在 `alert` 之前是已接受的 render 技术树约束，不是本包替产品决定哪个业务 part 属于哪一 tier。

## 4 · 错误语义与界面映射

| problem/event | HTTP | 业务规则映射 | 触发界面/owner | 用户可见处理 |
|---|---|---|---|---|
| `runtime-status-changed`（生命周期 observation） | N/A | Runtime status 由 runtime owner 定义；render 只响应 `created/starting/started/failed` | `RenderProvider`/状态快照层 | `runtime-unavailable` testID 变体；不显示产品错误文案、不写 state |
| `missing-catalog-entry` | N/A | ui-state 已允许 placement 写入而未要求 catalog 存在；render 是第一跳发现者 | ScreenContainer 或 LayerStack | 对应 fallback；logger 精确记录 `category=ui.base.render`、event 与 `partKey/displayMode` |
| `missing-renderer` | N/A | ui-state catalog 有 entry，但 render catalog 没有 renderer binding | ScreenContainer 或 LayerStack | 对应 fallback；logger 增加 `rendererKey` |
| `invalid-props-shape` | N/A | state JSON props 字段存在但不是普通对象 | ScreenContainer 或 LayerStack | 对应 fallback；不调用业务组件；logger 只记录 `partKey/displayMode/valueType` |

`container-empty` 与五种“画不出内容”中的其它错误一样有独立 testID，但它是正常空态，不产生 error diagnostic。真实视觉质量、tier 产品选择、业务调用时机与设备层 z-order 依旧是 `UNENFORCEABLE_BY_MACHINE` 或 `L2_UNVERIFIED`，本工件不伪装成已验证。

## 5 · 与详设交叉对账

| 检查 | 结果 |
|---|---|
| IA ↔ 需求稿 | PASS_WITH_HISTORICAL_BOUNDARY：需求稿保留了 pre-S-6/S-7 的历史状态叙述；本批已明确 current owning source 优先，当前契约为 `Runtime.status/getState/subscribe` 与 `UiCatalogEntry.containerKeys`，不得由历史文字引入双形状。未来 render implementation 前仍须由 owner 同步需求稿措辞，但这不是本轮设计的事实缺口 |
| IA ↔ 详设 | PASS：与 `doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-design-codex.md` §3、§7、§11 的四个 IA-ID、五类 fallback、adapter、诊断分型与 T/R 映射逐项对上 |
| IA-ID ↔ Journey | `NOT_APPLICABLE_WITH_REASON`：render 是 toolkit，不拥有产品 Journey；集成与业务包拥有到达 surface 的 Journey |
| 计数自证 | 4 个 IA-ID = `RENDER_SURFACE_ROOT`、`RENDER_SCREEN_CONTAINER`、`RENDER_LAYER_STACK`、`RENDER_DIAGNOSTIC_FALLBACK` |

## 6 · 完成判定

```text
IA_DIMENSIONS=4 IA-ID × 9 visible/invisible dimensions = COMPLETE
INVISIBLE_DIMENSIONS_AS_OBSERVATIONS=YES
FORBIDDEN_UI=explicit
TYPED_PROBLEMS=3 error diagnostics + 1 lifecycle observation mapped
CROSS_CHECK_WITH_DESIGN=PASS
DEXTER_WIREFRAME_REVIEW=NOT_APPLICABLE_WITH_REASON: toolkit seam, no product screen
IA_STATUS=READY_FOR_DESIGN_REVIEW;current-source precedence recorded;requirements wording sync remains a future implementation precondition;不构成 render implementation authorization
```
