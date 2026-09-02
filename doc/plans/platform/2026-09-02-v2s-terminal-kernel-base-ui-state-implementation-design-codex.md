# V2S TER `kernel.base.ui-state` 详设（Codex）

| 项 | 值 |
|---|---|
| 状态 | `DESIGN_READY_FOR_REVIEW` |
| 范围 | `kernel.base.ui-state` 的实现形态与验证设计；本文件不授权写源码、依赖、测试或运行命令 |
| 需求正本 | `doc/plans/platform/2026-09-02-v2s-terminal-kernel-base-ui-state-requirements-claude.md` |
| 当前源码输入 | `apps/terminal/kernel/base/ui-state` 骨架；`state` workspace 三件套；`display-context`；`runtime`；`contracts` |
| 已知授权 | Dexter 仅授权详设与实施计划；未授权实施、DEV、seed、L2、UAT、部署 |

## 1 · 目的、问题与已冻结边界

本包是 TER 的 overlay/screen **状态协议 owner**。它保存某 workspace 中 PRIMARY/SECONDARY
两套内容集、层栈及声明式 UI 变量；不拥有 React、renderer、空页面外观、队列推断、设备
能力、跨节点同步或业务“此时该显示什么”的语义。

本设计只把需求已经裁定的模型落在当前 kernel 的已有机制上：

1. workspace 不自造键或 action 路由，复用 state 的
   `createWorkspaceStateKeys`、`createWorkspaceActionDispatcher`、
   `toWorkspaceStateDescriptors`；
2. 所有真实 reducer 由 RTK `createSlice` 产生，再由
   `defineStateRuntimeSlice` 注册；不手写 action-type 常量；
3. command 用 runtime 的 `defineCommand`、actor 用 `defineActor/onCommand`；
4. 变量持久化只用 state 的 `PersistIntent` 与 record descriptor 的
   `shouldPersistEntry`，不在本包创造第三种持久化概念；
5. surface 身份只以 payload/selector 参数的 `displayMode` 表达。workspace 是设备级运行上下文，
   写侧和读侧都由 `selectRuntimeInstanceMode + selectDisplayRole + resolveWorkspace` 从当前 state root
   推导；写侧仅将这个已得出的 `WorkspaceRouteContext` 交给已有
   `createWorkspaceActionDispatcher`，以复用它的 action rewrite。二者都不从 route 的 displayMode
   或环境态推断内容集。

下列裁定不重开：无 `readyToEnter`/队列/首屏机制、只有 `showScreen`、层无深度上限、层不持久化、
无加密持久化、`syncIntent: 'isolated'`、三个 catalog 准入维度不作为写入门、workspace 必须隔离。

## 2 · 模块形态与两维状态

### 2.1 模块、命名与注册数量

实施时在 `src/moduleName.ts` 增加 `moduleKind = 'owner' as const`，同时把 skeleton graph 中
`kernel.base.ui-state` 的 `plannedKind` 升格为实际 kind。包继续使用现有五条 workspace 依赖，
并新增对已安装版本 `@reduxjs/toolkit: 2.12.0` 的**直接声明**，因为本包自己调用
`createSlice`；这不是新增第三方能力，而是使源码依赖完整。

本包创建四个 state-runtime registration，均由 workspace 三件套展开：

| family | base name | MAIN | BRANCH | persist / sync |
|---|---|---|---|---|
| 内容集 | `kernel.base.ui-state.content` | `.MAIN` | `.BRANCH` | `owner-only` / `isolated` |
| UI 变量 | `kernel.base.ui-state.ui-variables` | `.MAIN` | `.BRANCH` | `owner-only` / `isolated` |

没有“拍平版”slice、没有 displayIndex slice、没有当前 screen 镜像字段。`displayMode` 是每个内容
slice 内的第二维，不是 state-runtime 的分区维度。

### 2.2 内容集的精确形状

```ts
type ContainerKey = string
type PartKey = string

type ScreenPlacement = Readonly<{
  partKey: PartKey
  instanceId?: string
  props?: StateJsonValue
}>

type LayerEntry = Readonly<{
  layerId: string
  partKey: PartKey
  props?: StateJsonValue
  openedAt: TimestampMs
}>

type ContentSet = Readonly<{
  containers: Readonly<Record<ContainerKey, ScreenPlacement>>
  layers: readonly LayerEntry[]
}>

type UiContentState = Readonly<{
  contentSets: Readonly<Record<DisplayMode, ContentSet>>
}>
```

每个 workspace slice 的 `initialState` 都含有 PRIMARY 与 SECONDARY 两个空 `ContentSet`。所有
`showScreen/openLayer/closeLayer/clearLayers` reducer 均先检查 `displayMode` 是闭集值；无效 payload
返回原 state。actor 是命令入口的错误边界，先做完整 payload 校验，不能把 reducer 的防御性 no-op
当成业务拒绝。

`showScreen` 只替换 **当前 workspace + payload.displayMode + payload.containerKey** 的 placement；
`openLayer` 只向同一 content set 追加一条带 `openedAt` 的 layer；`closeLayer` 只移除同一
content set 中同 id 的 layer；`clearLayers` 只清同一 content set。`closeLayer` 对不存在 id 保持
幂等 no-op，并返回 `changed:false`；重复 `openLayer` 则必须拒绝，维持原栈，并记录脱敏诊断。
这些命令均不查询 catalog，也不跨 content set 批量清理。

四个可观察桶及其最小验收矩阵如下；测试必须经公开 command/selector 与 display-context state 转换读取，
不能偷读私有 slice key：

| 写入桶 | 改变角色/模式后应读到 | 必须仍为空 |
|---|---|---|
| MAIN × PRIMARY | MAIN × PRIMARY | MAIN × SECONDARY、BRANCH × PRIMARY、BRANCH × SECONDARY |
| MAIN × SECONDARY | MAIN × SECONDARY | MAIN × PRIMARY、BRANCH × PRIMARY、BRANCH × SECONDARY |
| BRANCH × PRIMARY | BRANCH × PRIMARY | BRANCH × SECONDARY、MAIN × PRIMARY、MAIN × SECONDARY |
| BRANCH × SECONDARY | BRANCH × SECONDARY | BRANCH × PRIMARY、MAIN × PRIMARY、MAIN × SECONDARY |

`BRANCH × SECONDARY` 在 TER 的当前规则下不可达,但保留在四桶隔离矩阵中作为纵深防御。推导是：
`BRANCH` 要求 `SLAVE ∧ CHIEF`;`SECONDARY` 要求 `displayIndex === 1` 或
`VICE ∧ SLAVE`;在 CHIEF 下后一项为假,前一项要求双屏,而
`getSwitchInstanceModeEligibility` 拒绝双屏 SLAVE,故该组合矛盾。当前可达组合是双屏设备的
`MAIN × PRIMARY` 与 `MAIN × SECONDARY`,以及单屏 SLAVE 的 `BRANCH × PRIMARY` 与
`MAIN × SECONDARY`。该说明禁止把不可达桶当成待修产品行为。

SLAVE 的 CHIEF→VICE/VICE→CHIEF 只改变同一物理视口所读的 PRIMARY/SECONDARY；测试还必须证明它不搬迁
这四个桶里的 entry。

### 2.3 workspace 三件套的真实接法

每个 family 采用同一闭合：

```text
createWorkspaceStateKeys(baseName)
  -> { MAIN: `${baseName}.MAIN`, BRANCH: `${baseName}.BRANCH` }
createSlice({ name: stateKey, initialState, reducers }) for MAIN and BRANCH
toWorkspaceStateDescriptors({ baseName, reducers, createDescriptor })
  -> two defineStateRuntimeSlice registrations
```

写入不可自行拼接 `${baseName}.${workspace}`。actor 只调用：

```ts
const dispatchForWorkspace = createWorkspaceActionDispatcher({
  routeContext: {workspace: selectCurrentWorkspace(context.getState())},
  dispatch: context.dispatchAction,
})
dispatchForWorkspace(canonicalContentActions.showScreen(payload))
```

为满足现有 wrapper 的“最终斜杠前插入 `.MAIN/.BRANCH`”契约，每个 family 还会有一个**未注册的
canonical action slice**：它也是 `createSlice({name: baseName, ...})`，只作为 RTK action creator
来源；两个注册 reducer 仍分别来自 name 为 `.MAIN/.BRANCH` 的 RTK slices。它不是第三份 state、
不进入 runtime registration、没有手写 action string。这样既保留 workspace wrapper 已被钉住的
slash rewrite 语义，也让全部 action/reducer 继续由 RTK 生成。

这是 workspace 三件套的第一个生产消费面。它已覆盖本包的两个独立 slice family，因此无需也不得
以“内容”和“变量不同”为理由平行造分区机制。若实现阶段发现 wrapper 无法处理上面的 canonical
RTK action，必须停在 CP-2 并回到 state owner 补机制；不得在 ui-state 写本地 fallback。

### 2.4 读侧接缝：surface 显式，workspace 合法推导

```ts
selectScreen(root, displayMode, containerKey): ScreenPlacement | undefined
selectLayers(root, displayMode): readonly LayerEntry[]
selectUiVariable(root, declaration): TValue
```

三个选择器首先从 root 的已注册 `runtimeInstanceMode` 与 `displayRole` 推导当前 workspace，随后读取
对应 family 的 MAIN/BRANCH slice；`displayMode` 绝不由 routeContext、displayRole 或设备全局状态替代。
前两个选择器必须收显式 `displayMode`。渲染根壳在调用时用它自己的
`resolveSurfaceDisplayMode({displayIndex, displayRole, instanceMode})` 结果传入；所以“当前是哪个
surface”没有隐藏输入。

容器在所选 content set 中不存在时 `selectScreen` 返回 `undefined`。render 包根据这个事实显示自己的
default 空页面；ui-state 不返回 fallback `partKey`，不存空页面，更不建立首屏/队列规则。

`selectUiVariable` 是 `createUiStateModule` 返回的 readonly instance method，不是可脱离 module 调用的
root 函数。它先以 object identity 验证传入 declaration 正是这个 module 的冻结 declaration table 中的对象，
未注册 declaration（包括同 key 但不同 defaultValue/persistIntent 的伪对象）立即 fail closed；随后才用当前
workspace 的 value record 查 key，缺项返回**注册 declaration** 的 `defaultValue`。变量本身不按 displayMode
分割，原因是它属于 workspace 的业务上下文，不是 surface 内容。该例外不削弱 screen/layer 的 surface显式规则。

## 3 · catalog：安装组合值，而非状态或全局注册表

### 3.1 输入、构建和冻结

```ts
type UiCatalogEntry = Readonly<{
  partKey: PartKey
  rendererKey: string
  containerKey: ContainerKey
  displayModes: readonly DisplayMode[]
  workspaces: readonly WorkspaceKey[]
  instanceModes: readonly RuntimeInstanceMode[]
  title: string
  description: string
}>

type UiCatalog = Readonly<{
  entries: readonly UiCatalogEntry[]
  byPartKey: Readonly<Record<PartKey, UiCatalogEntry>>
}>

type UiCatalogContext = Readonly<{
  displayMode: DisplayMode
  workspace: WorkspaceKey
  instanceMode: RuntimeInstanceMode
}>

type UiStateModule = RuntimeModule & Readonly<{
  catalog: UiCatalog
  selectUiVariable: <TValue extends StateJsonValue>(
    root: StateRoot,
    declaration: UiVariableDeclaration<TValue>,
  ) => TValue
}>

createUiCatalog(entries): UiCatalog
createUiStateModule({catalog, variables}): UiStateModule
```

上游 UI 包在组合时提供 immutable `UiCatalogEntry[]`；assembly/模块组合者先调用
`createUiCatalog`，再把**同一个值**传给 `createUiStateModule` 与需要枚举的消费者。catalog 不放 Redux，
不放 module-scope mutable Map，也不提供运行期 `register` API。`createUiCatalog` 一次性校验后深冻结
entry list、entry 和索引：

- `partKey`、`rendererKey`、`containerKey`、`title`、`description` 必须是非空字符串；
- `partKey` 重复立即 throw，绝不覆盖；
- 三个准入数组必须为非空、无重复且仅包含各自的闭集值；
- 输入 entry 的 `Reflect.ownKeys` 必须精确等于批准字段集合；多余 enumerable/non-enumerable/symbol key 均拒绝，
  而不是悄悄丢弃；
- 校验后构造**新的** canonical entry，只复制批准的 string 与闭集 array 值并冻结；索引用冻结的 plain record，
  不用 `Object.freeze(new Map())` 这种仍可 `.set()` 的伪不可变容器；
- entry 没有 React/RN component、element、lazy factory 或任何 renderer 引用，只有 `rendererKey`；
- catalog 文案不进入 command payload、content state、variable state 或 persistence descriptor。

`UiStateModule` 只携带对已冻结 catalog 的 readonly 引用，以便模块实例可作为组合产物被交给下游；
它不创建共享全局。公开枚举函数改为
`selectAvailableParts(catalog, containerKey, {displayMode, workspace, instanceMode})`，而不是需求稿草案中的
`state` 首参：可用项来自 catalog，刻意不来自 Redux。它精确以三个维度和 containerKey 过滤，稳定保留
catalog 的声明顺序。

### 3.2 准入不是写入门

`showScreen`/`openLayer` actor 不读 catalog，绝不因 `partKey` 的 display/workspace/instance 准入而拒绝写入。
这三个数组只服务枚举（例如导航候选），不宣称内核比业务 actor 更了解当时的合法业务屏。若以后出现
安全级“某类屏绝不可出现”的需求，必须以新 decision、明确写入门和独立 red vector 进入后续范围；本批不预置。

## 4 · 声明式 `uiVariable`

### 4.1 声明及其注册表

```ts
type UiVariableDeclaration<TValue extends StateJsonValue> = Readonly<{
  key: string
  moduleName: string
  defaultValue: TValue
  persistIntent: PersistIntent
}>

type UiVariableWrite<TValue extends StateJsonValue> = Readonly<{
  key: string
  value: TValue
}>

createModuleUiVariableFactory(moduleName)
  .define<TValue extends StateJsonValue>(localKey, {defaultValue, persistIntent})
createUiVariableWrite(declaration, value): UiVariableWrite<TValue>
```

形态借鉴 contracts 的 `createModuleParameterFactory`：声明 key 始终由 `moduleName + '.' + localKey`
构造，defaultValue 与 persistIntent 固定在声明点，工厂验证 module/local key 非空、值为 JSON 安全值、
persistIntent 是 state 的 `'never' | 'owner-only'`。它不复刻 contracts 的 parameter type 行列，因为
UI variable 的值域就是 `StateJsonValue`；泛型在 declaration、write helper 和 selector 之间贯通。

组合者把所有 declaration 作为 `createUiStateModule({catalog, variables})` 的 `variables` 传入。模块构造时
建立冻结 `key -> declaration` 表；重复完整 key 立即 throw。这样 declaration 是持久化策略的唯一输入，
而不是调用点临时传 default、也不是将值塞进 `Record<string, any>`。

工厂返回值带有不进入 root public value exports 的包内 brand，并保持精确 own-key 形状；组合边界会重新验证
brand、字段集合、`moduleName` 非空以及 `key` 必须以 `${moduleName}.` 开头且有非空 suffix。这样变量注册
不会把结构相似但由调用者伪造的 key 当作机制生成的声明；同 key 的不同 declaration 仍由对象身份校验拒绝。

`setUiVariables` 的 command payload 是 JSON-safe 的
`{entries: readonly UiVariableWrite<StateJsonValue>[]}`，其中每项只有 `{key, value}`；**declaration 从不进入
command payload**。调用者必须经 `createUiVariableWrite(declaration, value)` 获得 entry，因此 compile-time
检查 value 与 declaration 的 `T` 匹配。actor 再检查每个 key 在冻结 declaration table 中、无重复 key、value
为 JSON value，随后**一次** route 到 workspace variable slice。`clearUiVariables` 接受 declaration key 列表，
actor 同样只允许已注册 key。这是 declaration 完整性校验，不是 catalog 的 display/workspace 写入门。

### 4.2 变量持久化

变量 slice 为每个 workspace 使用：

```ts
type UiVariableState = Readonly<{
  values: Readonly<Record<string, StateJsonValue>>
}>
```

它的唯一 persistence descriptor 是现有 state record descriptor：

```ts
{
  kind: 'record',
  storageKeyPrefix: 'variables',
  getEntries: state => state.values,
  applyEntries: (state, entries) => ({...state, values: {...state.values, ...entries}}),
  shouldPersistEntry: key => declarationsByKey.get(key)?.persistIntent === 'owner-only',
}
```

因此 `never` 值留在内存但永不进入落盘 record；同 slice 的 owner-only 值继续被引擎逐 entry 写入。
`shouldPersistEntry` 是 flush hook，不能把“未来手动插入的历史 never storage key”解释为 schema migration。
本批的 restart proof 只主张由本实现写入后：owner-only 值可恢复、never 值没有 storage entry 因而不恢复；
若未来修改 declaration 的 persistIntent，须另行决定旧 entry 的迁移/清理语义。
不定义本包的 protection/persistence enum、没有 `secure-never-persist`、没有第二条 persistence pipeline。

内容 slice 同为 `owner-only`，但其 record descriptor 只暴露：

```ts
{
  kind: 'record',
  storageKeyPrefix: 'containers',
  getEntries: state => ({
    PRIMARY: state.contentSets.PRIMARY.containers,
    SECONDARY: state.contentSets.SECONDARY.containers,
  }),
  applyEntries: mergeContainersOnly,
}
```

这里从源头排除了 `layers`；hydrate 只合并合法 `containers` entries，初始/现有 layer arrays 不被写入或恢复。
两个 descriptor 都显式 `syncIntent: 'isolated'` 且无 `sync` 字段。

## 5 · command、actor 与错误边界

### 5.1 六条 command

本包定义并向 runtime module 登记六个 `visibility:'public'`、`allowNoActor:false`、
`allowReentry:false`、`defaultTarget:'local'` command：

```text
show-screen        { displayMode, containerKey, partKey, instanceId?, props? }
open-layer         { displayMode, layerId, partKey, props? }
close-layer        { displayMode, layerId }
clear-layers       { displayMode }
set-ui-variables   { entries }
clear-ui-variables { keys }
```

前四条的 payload 将 `displayMode` 作为必填闭集字段。actor 以 payload 的值选择 content set；即使
`command.routeContext.displayMode` 存在且不同，亦不读取它作为目的地。后两条只作用 workspace variable
record，因此没有伪造的 displayMode 字段。

每条 command 对应本包 actor handler；业务模块按 TR-11 dispatch command，不直接 dispatch UI action。
actor 每次从 root 推导 workspace 后才创建 dispatcher，避免复用可能过期的 routeContext workspace。完成有效
reducer 写后调用 runtime 既有 `flushPersistence()`，返回其状态/失败计数；写失败不得将
落盘失败伪装成成功。命令 payload、诊断和 AppError 不记录 `props` 或变量原值。重复 layerId 的拒绝记录
`ui-state.layer.duplicate-rejected`，只含 command/workspace/displayMode 与 `hasLayerId:true` 这类非敏感形状。

### 5.2 模块实例

`createUiStateModule({catalog, variables})` 构造 catalog/variable table 所需的不可变输入、六条 actor、两 family
共四 registrations 和 RuntimeModule declaration。`commands`、`commandDefinitions`、`actors`、
`actorDefinitions`、`slices` 与 `stateSlices` 一一对应。它不在 `install` 时“收集”外部注册，避免隐式时序和
全局可变注册表；catalog/variables 已在组合时完整交给 factory。它同时闭包生成
`UiStateModule.selectUiVariable`，让 public read API 使用同一冻结 registry，而不是另建 module-scope registry。

## 6 · public surface 与禁止扩面

公开面采用下列精确集合，并由 typecheck + package static gate 维护。内部 slice action、slice name、
catalog indexes、declaration map、payload validators、actors、AppError/diagnostic helpers 全部不从 root export。

| 类别 | root export |
|---|---|
| 身份 | `moduleName`、`moduleKind`、`dependencyModuleNames`、`devDependencyModuleNames` |
| 类型 | `DisplayMode`（转出）、`ContainerKey`、`PartKey`、`ScreenPlacement`、`LayerEntry`、`UiCatalogEntry`、`UiCatalog`、`UiCatalogContext`、`UiVariableDeclaration`、`UiVariableWrite`、`UiStateModule` |
| factory/helper | `createUiCatalog`、`createUiStateModule`、`createModuleUiVariableFactory`、`createUiVariableWrite` |
| command | `showScreenCommand`、`openLayerCommand`、`closeLayerCommand`、`clearLayersCommand`、`setUiVariablesCommand`、`clearUiVariablesCommand` |
| selector | `selectScreen`、`selectLayers`、`selectAvailableParts`；`UiStateModule.selectUiVariable`（实例绑定） |

不导出 `createWorkspace*` 的包装、任何 route dispatcher、catalog runtime register、renderer resolver、
persistence classification、default screen/empty page、queue/ready symbol 或 React type。

## 7 · 可证伪验证设计

### 7.1 业务/机制 focused proof

| ID | proof | 必须失败的反例 |
|---|---|---|
| U-1 | MAIN workspace 的 PRIMARY/SECONDARY 分别 show/open 后，各 selector 只读显式传入的 mode | 将 selector 的 mode 固定 PRIMARY，SECONDARY read 变红 |
| U-2 | 单屏 SLAVE 同一视口从 **`BRANCH × PRIMARY`**（CHIEF）变为 **`MAIN × SECONDARY`**（VICE）后读后者；原 entry 仍在 **BRANCH 分区的 PRIMARY 集**、只是不可见；翻回后 **`BRANCH × PRIMARY`** 的 entry 复现。前、后、翻回三端都断言 workspace 与 displayMode | 实现为角色翻转时把 entry 搬到另一 workspace/content set 或删除 entry，四元组合与复现断言变红 |
| U-3 | 同一 mode 重复 open 相同 layerId：typed reject + diagnostic，原层数组不变 | 静默覆盖或置顶，断言变红 |
| U-4 | 目标 payload 为 SECONDARY、routeContext 为 PRIMARY 时，写到 SECONDARY；选择器必须有 displayMode 参数 | actor 从 routeContext 取 mode，断言变红；type fixture 漏 displayMode 编译失败 |
| U-5 | 经公开 command/selector 覆盖 MAIN/BRANCH × PRIMARY/SECONDARY 四桶：同 mode 跨 workspace 不串、同 workspace 跨 mode 不串；MAIN 写 screen/variable 后 BRANCH 读空/default | 把两个 workspace reducer/registration 拍平成一份，四桶隔离断言变红 |
| U-6 | `never` variable 不入 fake storage、不会在新 runtime 恢复；owner-only sibling 落盘并恢复；clear 后 storage entry 删除且同 slice sibling 不受影响；未注册/同 key fake declaration 读变量必 fail closed | 去掉 `shouldPersistEntry`、错误 clear，或以 fake declaration 读取默认值，断言变红 |
| U-7 | content restart 恢复 containers 的 partKey；layers 为空 | persistence descriptor 暴露 layers，restart assertion变红 |
| U-8 | 相同 local key 的两个 module variable declaration 得到不同 full key；write helper 拒绝 T 不匹配；模块组合拒绝带错误 `moduleName` 前缀的伪造 declaration | 去掉 moduleName key 前缀、绕过组合边界声明校验或退成 unknown/any，type/behavior fixture 变红 |
| U-9 | catalog duplicate partKey 抛错、冻结后无 register 入口、canonical 条目/索引的 own keys 精确且只含 rendererKey | 改成 map 覆盖、暴露 register，或传入 `{component(){}}`/symbol/non-enumerable extra key，分别变红 |
| U-10 | catalog enumeration 按 container + 三个闭集维度过滤；`showScreen` 对 catalog 不准入仍可写 | 在 actor 加 admission reject，写入断言变红 |
| U-11 | `getSwitchInstanceModeEligibility({targetMode:'SLAVE', routeDisplayMode:'PRIMARY', displayCount:2})` 必为拒绝 `multiple-physical-displays` | 放宽双屏 SLAVE，单射性前提断言变红 |

U-11 不是 ui-state 对 display-context 的所有权扩张；它是 `displayMode` 键单射证明的明确依赖断言。

### 7.2 机械 gates 与 red vectors

| gate | 机械判定 | 独立 red vector |
|---|---|---|
| public surface | root export exact set 等于 §6 | 增/删一个 root export，只红此门 |
| RTK/action form | 所有 registration reducer 与 canonical action creator 均来自 `createSlice`；本包无手写 action creator/`type` string | 注入 `const rogue = () => ({type:'legacy/action'})`（无 `@@`），门红 |
| workspace reuse | state 的 partition API import 精确为 workspace 三件套；无 `createPartitioned*`、任意命名的 package-local key/router declaration、直接 `.MAIN/.BRANCH` 拼接或非 descriptor 的 `{MAIN, BRANCH}` key pair | 将一个 import 替成任意命名的本地 key/router helper，或直接拼接 workspace suffix，门红 |
| package boundary | 无 React/RN import、无 queue symbols、无自有 persistence type、无 layer persistence field；四 registration 均显式 isolated 且无 sync descriptor/API | 分别注入 `react` import、`readyToEnter`、私有 persist union、layer descriptor 或 sync descriptor，目标门红 |
| catalog state boundary | state types/actions/persistence payload 不含 title/description/renderer component；catalog canonical entry/record own keys exact | 将 title 写入 placement，或输入 `{component(){}}` / symbol extra key，目标 assertion 红 |

workspace gate 只判断可诚实判定的 import origin 与本包声明；U-5 是它的行为反证，二者不得互相冒充。
所有 red vector 均要求真实树回绿，且不以文本存在检查代替 focused behavior。

### 7.3 诚实保留为评审项

以下仍是 `UNENFORCEABLE_BY_MACHINE`，不得包装成机器 PASS：业务 actor 是否在正确时机指定应显示的
part；某个 overlay 是否应成为有身份、可被外部关闭/恢复的 layer；以及未来 display-context 改动之外的
单射性持续成立。U-11 仅钉住当前双屏拒 SLAVE 的前提。

## 8 · 实施范围与明确不做

实施只会改 ui-state 包、它的 package invariant/test/static checker、terminal skeleton graph 的 kind 状态、
以及 lockfile 中已有 RTK direct dependency 的完整性记录。不会修改 state workspace helper、display-context
行为、runtime 调度、render、automation、adapter/native、assembly、transport、业务模块或任何动态环境。

后续 render 负责 `rendererKey -> React component` 与空页面；上游业务模块负责何时 dispatch；未来同步
需求须另起设计。若实施需要更改其中任一边界，停止并交 Dexter，不用本包代码绕过。

## 9 · 设计自检结论

本设计将 workspace、displayMode、catalog、variable 与 persistence 放在各自唯一的 owner/输入上：无新
分区轮子，无隐藏 surface identity，无 catalog 全局或 React 泄漏，且每条机器可判主张都有明确 red vector，
不可判主张保留为 review 项。

**自评：GO；M=0，S=0，N=0。** 此结论仅表示可进入 Dexter/Claude 的设计评审，不是实施授权。
