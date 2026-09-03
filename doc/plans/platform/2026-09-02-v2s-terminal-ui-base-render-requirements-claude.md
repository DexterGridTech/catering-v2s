# `ui.base.render` 需求稿

| 项 | 值 |
|---|---|
| 性质 | 需求文档。详设与实施由 Codex 承担 |
| 作者 | Claude |
| 日期 | 2026-09-02 |
| 冻结输入 | 分析稿 `2026-09-02-v2s-terminal-ui-base-render-requirements-analysis-claude.md`;两代 POC(`_old_` 的 `ui-core-base` / `ui-core-runtime-base`,`newPOSv1` 的 `runtime-react`)及其全部消费方;v2s 已落地的 kernel 六包;骨架需求 §6.4 §7.1 |
| 未验证 | 本文结论**全部来自静态阅读**,未执行任何命令 |
| 版本 | **第四版**(2026-09-03)。第一版经 Codex 独立评审 NO-GO(M=3/S=12/N=3),**三处矛盾均由"补丁叠加不删旧文"造成** ⇒ 第二版整篇重写;第三、四版按复评逐条修订。修订清单见 §12(第二版)、§13(第三版)、§14(第四版)|

---

## 0 · 这份文档怎么读

1. `🔴` 标记的是关键推理,不是强调语气。评审请优先攻击这些段落。
2. 每条能力带判定:`POC_ALREADY_HAS` · `POC_HAS_BUT_WORSE`(**必须写清为什么换**)· `FABRICATED`(不做)。
3. §8 判据必须**可证伪** —— 每条写明"改动什么会让它变红"。机器判不了的显式标 `UNENFORCEABLE_BY_MACHINE`。
4. **命名**:本文对若干概念重新命名,理由在 §2.4;凡改名处都写了原名,便于与 POC 对照。

---

## 1 · 包位置与可用能力(仓内事实,逐项亲验 ✅)

| 项 | 事实 |
|---|---|
| 包名 | `ui.base.render`,`plannedKind: toolkit` |
| 依赖(已声明) | `platform-ports` · `runtime` · `ui-state` |
| 当前状态 | 3 文件骨架壳 |
| 骨架 §7.1 定位 | **宿主 + 注册表 + part 定义 API**;按类别挑出该渲染的 overlay,按 key 解析组件。**不得拥有任何具体 part 的 key;不得拥有任何外观** |
| 外部依赖基线 §6.4 | `react` / `react-native` 等在 `ui/**` 声明为 **`peerDependencies`**,由 assembly 提供唯一实例 —— 多副本 React 会在运行时炸 |
| 下游 | `primitives`(经 automation)· `input` · `admin-shell` · `platform-console` |

**`ui-state` 提供的读侧接缝**(28 个公共导出中与本包相关的):

```
selectScreen(root, displayMode, containerKey): ScreenPlacement | undefined
selectLayers(root, displayMode): readonly LayerEntry[]
selectAvailableParts(catalog, containerKey, context): readonly UiCatalogEntry[]   // ⚠️ 本包不用,见 §1.2

ScreenPlacement = { partKey, instanceId?, props? }
LayerEntry      = { layerId, partKey, props?, openedAt }
UiCatalogEntry  = { partKey, rendererKey, <容器字段>, displayModes, workspaces, instanceModes, title, description }
```

🔴 **容器字段有两个形态,不要混**(第二版把目标态标成了当前事实,已更正):

| | 值 | 状态 |
|---|---|---|
| **当前源码事实** ✅ | `containerKey: ContainerKey`(单数) | `ui-state/src/types/catalog.ts` 与 `foundations/catalog.ts` **现在就是这个** |
| **S-7 完成后的目标契约** | `containerKeys: readonly ContainerKey[]` | 标 **`REQUIRED_AFTER_S7`**,**不是当前事实**。见 §4.6a |

⇒ 本稿以下条目**全部按目标契约写,在 S-7 落地前不成立**:
§4.6 的 `definePart` · §4.6a · **T-9a**(catalogEntry 的 ownKeys 校验)· **T-13** · **R-19** ·
**R-20**(ownKeys 仍须精确相等 —— 它约束的正是 S-7 的实施方式)·
**R-11 中涉及 `catalogEntry` 形状的那一半**(`rendererBinding` 那一半不受 S-7 影响)。

```
UiCatalog       = { entries, byPartKey }
UiCatalogContext= { displayMode, workspace, instanceMode }
```

### 1.1 🔴 **放置**用单数,**准入**用列表 —— 两个概念不要混

| | 谁持有 | 形状 | 作用 |
|---|---|---|---|
| **放置** | `showScreenCommand` 的载荷 ✅ | **单数 `containerKey`** | 这次要把 part 放进哪个容器。actor 直接写它,**从不查 catalog** |
| **准入** | `UiCatalogEntry` | **列表 `containerKeys`** | 这个 part **可以**出现在哪些容器(枚举过滤用) |

⚠️ **S-7 只改后者,不动前者。** 第一版因为没写清这一点,导致 §4.6 与 §4.6a 自相矛盾。

### 1.2 🔴 由此决定的解析链是**两跳**

`ScreenPlacement` 与 `LayerEntry` **只带 `partKey`,不带 `rendererKey`**(✅ 亲验)。
文案与 `rendererKey` 只在 catalog(ui-state 的裁定)。所以:

```
partKey → catalog.byPartKey[partKey].rendererKey → 本包的 catalog → React 组件
```

⇒ **本包必须能读到 ui-state 的 `UiCatalog`**,它是第一跳的解析表。
⚠️ v2 POC 是一跳(`LayerEntry` 自带 `rendererKey`),v2s 是两跳 —— 这是 ui-state"文案不进状态"的直接后果,不是本包的选择。

---

### 1.3 🔴 `selectAvailableParts` **不由本包调用**(自查第一轮)

它要 `UiCatalogContext = {displayMode, workspace, instanceMode}`,其中 `workspace` 须经
`resolveWorkspace({instanceMode, displayRole})` 求得,而 `displayRole` 只有 `display-context` 提供 ——
**本包的声明依赖里没有 `display-context`** ✅(实为 platform-ports · runtime · ui-state)。

⇒ **枚举是消费方的事**(如 admin-shell 画 tab 条),不是渲染宿主的事。本包只做"按 partKey 画出来"。

## 2 · 核心模型

### 2.1 这个包回答的唯一问题

> **给定「这块屏是哪个 surface」与「该容器/层栈现在放着哪些 `partKey`」,把对应的 React 组件画出来。**

它**不决定**显示什么(业务方经 ui-state 命令指定)、**不拥有**任何具体 part 的 key 与外观、**不写**任何状态。

### 2.2 三条不可让

1. **surface 身份必填、闭集、无默认**(§4.1)。
2. **只读不写** —— 本包不 dispatch 任何 ui-state 命令(§4.5)。
3. **宿主不认识任何具体 `partKey`** —— 分层靠 `layerTier`,不靠字符串匹配(§4.3)。

### 2.3 🔴 层的 z 层级是承重语义

POC 根壳的渲染树是 `ScreenContainer` → `OverlayHost` → `AlertHost`,
即 **alert 恒在普通层之上**。这是真实产品需求(alert 不能被对话框盖住),不能一删了之。

v2 POC 用**两个宿主 + partKey 字符串匹配**表达它;本包用**一个层栈 + 声明式 `layerTier`** 表达。

### 2.4 命名:本文改了什么,为什么

| 本文名 | POC 原名 | 为什么换 |
|---|---|---|
| `RendererCatalog` · `createRendererCatalog` · `RendererBinding` | `UiRendererRegistry` · `createRendererRegistry` | **"registry" 暗示可持续注册**,而本包是构建期一次成型后冻结。`catalog` 是固定清单,语义准确;且与 ui-state 的 `UiCatalog` / `createUiCatalog` **形态对称** |
| `layerTier: 'standard' \| 'alert'` | `UiPartKind: 'screen' \| 'modal' \| 'alert'` | 🔴 原名**混了两件正交的事**:"在容器里还是叠在上面"在 v2s 已由**命令**决定(`showScreen` vs `openLayer`),不该再由 part 声明;本包真正需要的只有**层之间的 z 层级**。改名后语义单一 |
| `definePart` | `defineUiScreenPart` / `defineUiAlertPart` / `defineUiModalPart` | 原名说"screen"却也被用来定义 alert 与 modal(v2 用它包了三层)。且在 v2s 里它产出的两半要去**两个不同的包**,新名点明这件事 |
| `SurfaceRoot` | `UiRuntimeRootShell` | 本包把 surface 提成一等概念,组件名应说出它是**一个 surface 的根**,而不是"runtime 的壳" |
| `LayerStack` | `OverlayHost` + `AlertHost` | 两个宿主合成一个,按 `layerTier` 分层渲染(§4.3)。名字说的是它渲染的东西 |
| `ScreenContainer` | 同名 | 保留 —— 与 `containerKey` 同源,准确 |

⚠️ **我检查过是否要改 ui-state 的名字,结论是不改。** 那 28 个导出没有一个是误导性的,
而重命名要同时改源码、`publicExports` 精确集合与消费方,代价与收益不成比例。

---

## 3 · POC 对照(三代,逐项判定)

### 3.1 `POC_ALREADY_HAS` —— 用意与实现一并继承

| POC 位置 | 内容 | 继承理由 |
|---|---|---|
| v2 `rendererRegistry` | **注册表归渲染包**(v1 在内核) | 骨架 §7.1 明确要求;v2 改对了 |
| v2 `defineUiScreenPart` | **一次声明组件与定义两半** | 4 个消费者在用;是创作侧的正确接缝 |
| v2 根壳的 `display` prop | surface 身份**显式化**的方向 | v1 完全没有根壳、靠环境态;v2 的方向对(形态见 3.2) |
| v1 `registerScreenPart` | **重复 key 抛错** | v2 退化成静默覆盖,恢复 v1 |
| v2 `useChildScreenPart` | `missing-renderer` **诊断态** | 屏幕路径的正确姿态,扩到层路径(3.2) |
| v2 根壳渲染树 | **alert 恒在普通层之上** | 承重产品语义,换实现不换语义(§2.3) |
| v2 拆出 `input-runtime` | 输入控件不在渲染基座 | v1 六个 `Fancy*` 在同包;v2s 对应 `ui.base.input` |

### 3.2 `POC_HAS_BUT_WORSE` —— 继承用意,换实现

| POC 做法 | 问题 | 本文做法 |
|---|---|---|
| 根壳 `display?: 'primary' \| 'secondary'`,**默认 `'primary'`**,小写 | fail-open:漏传静默落主屏;大小写与内核不一致 | **`displayMode: DisplayMode` 必填、闭集、无默认**(§4.1) |
| 注册表是模块级单例;`renderers.set` **静默覆盖** | 隐式全局、测试不可隔离;重复 key 无声 | **安装期构建、构建后冻结、挂模块实例、重复抛错**(§4.2) |
| `kind` 被解构到包装对象,**进不了任何模型**;宿主用 partKey 字符串匹配把它猜回来 | 宿主认识具体 partKey;`id.startsWith('overlay.alert')` 会误判 | **`layerTier` 存进本包 catalog**,宿主按 tier 分层(§4.3) |
| `defaultParts` 注册**四个具体 partKey**(含一个业务热更新模态),`DefaultAlert` 158 行 | 违反 §7.1;"能看的默认件挤掉真正的注册" | **零具体 partKey**;空态是**不可注册的渲染局部兜底**(§4.4) |
| `useUiScreenOrSetDefault` 读不到屏就 dispatch 写默认 | 渲染层决定显示什么;渲染期写状态;**可能覆盖持久化恢复出来的导航位置** | **只读不写**(§4.5) |
| 根壳 `defineCommand({moduleName: 'kernel.base.tdp-sync-runtime-v2', …})` | 替别的模块伪造命令定义,所有权与兼容性失去归属 | **不做**(§5) |
| `OverlayHost`:`if (!Component) return null` | 层静默消失;与同包屏幕路径**不对称** | **两条路径对称落诊断**(§4.3) |
| `createUiNavigationBridge` 71 行纯转发 | 给每条命令第二个名字(v1 旧词汇);把 `definition` 塞进载荷 | **不做**(§5) |
| `prop ?? useOptionalXxx()` 两处 | **条件调用 hook**,违反 rules of hooks | 一律无条件调用 hook,再用 prop 覆盖(§4.6) |

### 3.3 `FABRICATED` / 不继承

| 项 | 为什么不做 |
|---|---|
| 屏幕缓存 / keep-alive(v2 的 980 行容器大半是它) | v1 容器 128 行**无缓存**;本阶段无任何测量说明必要。**先测量再动** |
| `screenReady` 闸门与 loading 兜底 | Dexter 已裁 `screenReady` 意义不大;loading 依赖它 |
| 形态因子 `screenModes`(`DESKTOP`/`MOBILE`) | v2s 全仓零命中,已裁定不引入 |
| 具体容器键(`primaryRootContainer` 等) | 内容集已按 `displayMode` **结构化**分离,容器键不再承担 surface 区分;由集成层传入(§6) |
| 自动化 context 的**提供** | 归 `automation`;本包只**接收**(§6) |

---

## 4 · 本包要做什么

### 4.0 🔴 读侧接缝:快照与订阅(自查第一轮补,首版完全缺失)

首版全文写"读 `selectScreen(root, …)`",却**没说 `root` 从哪来、重渲染怎么触发**。补齐:

**不引入 `react-redux`**。⚠️ **口径更正**:第一版称它"不在 `yarn.lock` 里"是**错的** ——
它以依赖边形式存在(`yarn.lock` 第 1257 / 1264 / 1425 / 1452 行)。
我当时的 grep 只匹配条目头,是**用窄模式下负面结论**。
正确表述是:**它不在骨架 §6.4 的 `ui/**` 允许清单里,且本包不需要它**。
而 assembly 声明的是 **`react@19.2.3`** ⇒ **`useSyncExternalStore` 是 React 内置的**,足够。

```
const snapshot  = () => selectScreen(runtime.getState(), displayMode, containerKey)
const value     = useSyncExternalStore(subscribeRuntimeState, snapshot)
```

- **快照**:`Runtime.getState(): StateRoot` ✅ 已存在。
  ⚠️ 本包**不显式标注 `StateRoot` 类型**(靠推导)——
  `StateRoot` 只由 `state` 导出,而骨架 §6.1 的规格里本包**不依赖 `state`**;
  显式 import 会让依赖图与规格不符。
- **订阅**:🔴 **`Runtime` 目前没有 `subscribe`** ✅(接口止于 `dispatchCommand`)。
  唯一路径是 `getStore()`,它返回**完整 Redux store,带 `.dispatch`** ——
  正是 `TR-06` 反例栏说的"看起来抽象、实际就是 store"的对象,与 `TR-01` 的写入管控相抵。
  ⇒ **本包不得调用 `getStore()`**;需要 runtime 补一个窄接缝,见 §6 的 **S-6**。

#### 4.0a 🔴 S-6 的运行语义(第一版只给了方法形状,不足以实现或验证)

⚠️ runtime 内部已有 `foundations/createStateSubscription.ts` ✅,但它**不是公共契约**。
把它提成公共接缝时,以下**七条**必须在契约里写死,否则 T-10 无法独立证伪:

| # | 必须定义 | 为什么 |
|---|---|---|
| 1 | **runtime 未 `start()` 时订阅**的行为(允许并在 start 后开始通知 / 抛错 / 返回空退订) | render 的 Provider 可能先于 start 挂载 |
| 2 | **runtime 进入 `failed` 后**的通知行为 | 否则组件可能永久停在最后一帧而无信号 |
| 3 | **通知时机**:每次 action 后同步、还是批处理 | 决定 `useSyncExternalStore` 会不会撕裂 |
| 4 | **退订幂等**:重复调用退订必须安全 | React 严格模式会挂载两次 |
| 5 | **runtime 生命周期结束后**残留订阅的行为 | 与整改报告 R6 登记的"生产无停机出口"同源 |
| 6 | **可观察 oracle**:测试凭什么断言"已退订" | 无 oracle 则 T-10 的后半段不可证伪 |
| **7** 🔴 | **snapshot 的可用性与生命周期** —— 见下 | 第二版只定义了订阅侧,漏了快照侧,而**快照侧才是崩溃路径** |

#### 4.0b 🔴 snapshot 的生命周期(第二版漏掉的一半)

**仓内事实** ✅:`createRuntime.ts` 第 327-330 行 ——

```
const unavailable = () => failure ?? lifecycleError('Runtime has not started')
const getState = (): StateRoot => {
  if (status !== 'started' || stateRuntime === undefined) throw unavailable()
  ...
}
```

⇒ **`getState()` 在非 `started` 状态直接抛。** 而 §4.0 让 `useSyncExternalStore` 的 getSnapshot 调它
⇒ **Provider 早于 `start()` 挂载、或 runtime 进入 `failed` 后,渲染直接崩** —— 这是第二版亲手指定的崩溃路径。

**要求**:

1. `RenderProvider` **先读 `runtime.status`**(公共只读字段 ✅),`status !== 'started'` 时**不调用 `getState()`**;
2. 此时渲染**"运行时不可用"态** —— 它与"容器为空"是**两个不同的事实**,不得复用空态兜底;
3. 🔴 **从不可用转为可用时必须重渲染,而这个通知必须由 S-6 承担**。
   ⚠️ 第三版写"或对 `status` 本身可订阅"是**不可执行的** ✅ ——
   `status` 是 `Runtime` 上的**只读字段**,不是可订阅源;
   而现有 `createStateSubscription.ts` **只包装 Redux store 订阅,不通知 runtime 生命周期** ✅。
   ⇒ **S-6 的契约必须明确承担生命周期通知**:至少覆盖"不可用 → started"与"进入 failed"两次转变及其顺序;
4. **snapshot 在读取 `status` 与状态期间不得抛异常** —— 由本包的门控保证,而非依赖调用方 try/catch;
5. **snapshot 引用稳定性**:状态未变化时 `getState()` 必须返回同一引用,否则 `useSyncExternalStore` 会无限重渲染;
6. 🔴 **`useUiStateSelector` 的相等性规则是单一规则,不保留二选一**(第三版留了两个选项,不可实现):
   **按 root state 的引用做记忆化** —— `getSnapshot` 缓存上一次的 `(root, result)`,
   `root` 引用未变则**直接返回缓存的 result**。
   ⇒ 选择器即使每次分配新对象也**不会触发重渲染**,因为比较的是 root 不是 result;
   代价是选择器**必须是纯函数**(同一 root 必得同一逻辑结果),这一条写进契约。

⚠️ 第 4、5、6 条是 `useSyncExternalStore` 的硬约束,不是优化。

⚠️ **S-6 的实施不在本轮授权内**;本节是**需求侧对它的契约要求**,由 runtime 的 owner 落。

### 4.1 `SurfaceRoot` —— 一个 surface 的根

```
SurfaceRoot(props: {
    displayMode: DisplayMode          // 🔴 必填、闭集、无默认
    containerKey: ContainerKey        // 由集成层传入,本包不持有任何具体键
    children?: ReactNode
})
```

- `displayMode` 由**渲染侧自己**用 `resolveSurfaceDisplayMode({displayIndex, displayRole, instanceMode})` 求得后传入;
- 向下经 context 传递,`ScreenContainer` 与 `LayerStack` 从 context 取,**不再各自接受可选参数**;
- 渲染树顺序固定:`children` → `ScreenContainer` → `LayerStack`。

### 4.2 `RendererCatalog` —— `rendererKey → {component, layerTier}`

```
RendererBinding = { rendererKey: string; component: ComponentType<any>; layerTier?: LayerTier }
LayerTier       = 'standard' | 'alert'          // 默认 'standard'

createRendererCatalog(bindings: readonly RendererBinding[]): RendererCatalog
RendererCatalog = { resolve(rendererKey): ComponentType | undefined
                    tierOf(rendererKey): LayerTier }
```

- **构建期一次构建、构建后冻结**;由**集成层持有并经 `RenderProvider` 传入**,
  **不是模块级单例,也不挂在任何 runtime 模块上**(本包是 toolkit,不注册模块 —— §4.9);
- **重复 `rendererKey` 构建时抛错**,不静默覆盖;
- 构建后**没有 register 入口**;
- 🔴 与 ui-state 的 `createUiCatalog` **形态对称** —— 两张表都是构建期静态的:
  ui-state 管 `partKey → 定义`,本包管 `rendererKey → 组件`。

⚠️ `layerTier` 只有两级且其一叫 `alert`,是因为**证据只支持两级**(POC 的两个宿主)。
增加第三级必须有产品理由,不得为"将来可能"预留。

🔴 **跨装配稳定性**(第一版未定义):`layerTier` 是**该 renderer 的稳定属性**,
不是装配级可调项。同一个 `rendererKey` 在任何装配下**必须得到同一 tier**。
理由:"alert 恒在 standard 之上"若只在单个装配内成立,这条产品语义就没有意义。
⇒ tier 在 `definePart` 处一次声明,`createRendererCatalog` **不接受装配级覆盖**。

### 4.3 `LayerStack` —— 一个层栈,按 tier 分层

替代 POC 的 `OverlayHost` + `AlertHost`:

- 读 `selectLayers(root, displayMode)`;
- 每条层:`partKey → UiCatalog.byPartKey → rendererKey → RendererCatalog.resolve`;
- **按 `tierOf(rendererKey)` 分两组渲染**:`standard` 全部,再 `alert` 全部 ⇒ alert 恒在上;
- 组内按 `openedAt` 升序(先开的在下);
- 🔴 **两跳各自的缺失都必须落诊断,不得静默不渲染**:
  - **第一跳缺失**(`UiCatalog.byPartKey[partKey]` 无此 part):诊断 `missing-catalog-entry`。
    ⚠️ 这条第一版完全没定义。而 ui-state 的 actor **不做 catalog 存在性门控**(`contentActors.ts` ✅)
    ⇒ 一个不在 catalog 里的 `partKey` **能被成功写进状态**,渲染侧是它唯一的发现点;
  - **第二跳缺失**(`RendererCatalog.resolve` 无此 renderer):诊断 `missing-renderer`。

⇒ 宿主**不出现任何具体 `partKey` 字面量**。

### 4.3a 🔴 五种"画不出内容"的结果必须彼此可区分(第三版未定)

我在 §4.0b 自己写了"运行时不可用与容器为空是两个事实,不得复用同一表现",
但没把这条规则贯彻到其余几种。**统一定义**:

| # | 事实 | testID | 诊断 |
|---|---|---|---|
| 1 | **运行时不可用**(`status !== 'started'`) | `ui-base-render:fallback:runtime-unavailable` | 每次状态**转变**记一条,不是每帧 |
| 2 | **容器为空**(`selectScreen` 返回 `undefined`) | `ui-base-render:fallback:container-empty` | **无** —— 这是正常态,不是错误 |
| 3 | **catalog 无此 part**(第一跳缺失) | `ui-base-render:fallback:missing-catalog-entry` | `missing-catalog-entry` |
| 4 | **无此 renderer**(第二跳缺失) | `ui-base-render:fallback:missing-renderer` | `missing-renderer` |
| 5 | **props 形状非法** | `ui-base-render:fallback:invalid-props` | `invalid-props-shape` |

🔴 **实现上允许共享同一个底层布局组件**,但**必须是不同的语义变体**:
`reason` 是闭集入参,testID 由它派生,判据断言的是 **testID 与诊断的取值**,不是"渲染了某个兜底"。

⚠️ **第 3、4、5 种在 screen 与 layer 两条路径上都要覆盖** —— 两条路径各自独立走两跳与 props 校验。

### 4.4 `ScreenContainer` 与空态

- 读 `selectScreen(root, displayMode, containerKey)`;
- 有 `ScreenPlacement` ⇒ 两跳解析后渲染;**`props` 在通过 §4.6b 的形状校验后原样下传**(不增删不改写);
- **返回 `undefined` ⇒ 画 `container-empty` 变体**(§4.3a 第 2 种);
- 🔴 空态兜底**不是 part**:没有 `partKey`、不进任何 catalog、不可被业务注册或替换,
  且**刻意不做成可用外观**(骨架 §7.1:"做得能看的默认 alert 会挤掉真正的注册")。
  它带 `testID` 以便自动化与排查。

### 4.5 只读不写

本包**不 dispatch 任何 ui-state 命令**,不提供任何"读不到就写默认"的 hook。
🔴 理由三条:① 违反"业务方明确指定";② 渲染期产生状态写入;
③ ui-state 的内容集**会持久化**,默认写入可能**覆盖恢复出来的导航位置**。

### 4.6 `definePart` —— 创作接缝

```
definePart<TProps>(input: {
    partKey · rendererKey
    containerKeys: readonly ContainerKey[]         // 🔴 列表;层专用 part 传 []
    displayModes · workspaces · instanceModes      // 复用 ui-state 的三个闭集
    title · description
    component: ComponentType<TProps>
    layerTier?: LayerTier
}): { catalogEntry: UiCatalogEntry; rendererBinding: RendererBinding }
```

一次声明,产出**去往两个包**的两半:`catalogEntry` 交给 ui-state 的 `createUiCatalog`,
`rendererBinding` 交给本包的 `createRendererCatalog`。
⚠️ `component` 与 `layerTier` **绝不进入** `catalogEntry`;`title`/`description` **绝不进入** `rendererBinding`。

### 4.6a 🔴 层专用 part 的容器归属 —— **裁决:`containerKeys` 列表化**

> 🔴🔴 **这是 render 详设的硬前置,不是可并行项。**
> 当前 owning source **仍是单数**:`ui-state/src/types/catalog.ts` 与 `foundations/catalog.ts`,
> 且 `ui-state/README.md` 与 ui-state 的实施详设也仍写单数。
> **S-7 未落地之前,本稿的 T-9 / T-13 / R-19 所依赖的跨包契约并不成立**,render 不得进入详设。

**仓内事实** ✅:
- `UiCatalogEntry.containerKey` **必填**;构建时 `assertNonEmptyString`,且 `Reflect.ownKeys` 必须**精确等于**批准字段集;
- 🔴 **但它不是放置机制** ——`showScreenCommand` 的载荷自带 `containerKey`,
  actor 直接写 `payload.containerKey`(`contentActors.ts` 第 83 / 92 行),**从不查 catalog**;
- ⇒ `UiCatalogEntry.containerKey` 的**唯一消费者**是 `selectAvailableParts` 的过滤(`catalog.ts` 第 120 行)。

**真正的缺陷是形状不对称**:catalog 有四个准入维度,三个是**非空闭集列表**
(`displayModes` / `workspaces` / `instanceModes`),唯独 `containerKey` 是**必填标量**。
凭什么一个 part 可以在两个 workspace 里可用,却只能在一个容器里可用?

而「层专用 part 在**零个**容器里可用」对列表是自然值 `[]`,对必填标量**无法表达** ⇒ 只能造假值。
POC 造了 `'overlay.alert'`,那个假值随后被拿去做 `id.startsWith(...)` 前缀匹配,
变成 §3.2 记的误判 bug。**假值不是症状,它是"用标量表达一个本该是集合的东西"的必然产物。**

#### 裁决(Dexter 2026-09-02 授权,按最长远最优、忽略沉没成本)

> **`containerKey: ContainerKey` → `containerKeys: readonly ContainerKey[]`,允许为空。**

| 优于"改可选"的地方 | 说明 |
|---|---|
| 四个维度形状统一 | 一条规则代替"三个列表 + 一个可选标量" |
| `[]` 是**正面陈述** | 「在零个容器里可用」是事实;`undefined` 靠缺席表达,读者分不清"不适用"还是"忘了填" |
| 🔴 **保住 `Reflect.ownKeys` 的精确校验** | 字段永远在。改可选则必须把它从"精确相等"放宽为"必填⊆实际⊆批准",**削弱一道已建好的门** |
| 枚举自动正确 | 过滤从 `=== containerKey` 变 `.includes(containerKey)`,空数组天然不匹配 ⇒ 层专用 part 不进枚举,从**约定**变成**数据结构的直接结果** |
| 解锁真实场景 | 同一 part 在两个容器复用,现在表达不了 |

⚠️ **与另外三个维度的唯一差异必须显式注释**:那三个校验为**非空**闭集
(`displayModes: []` 的 part 永远显示不了,是无意义值),而 **`containerKeys: []` 有意义**。
这处差异是刻意的,防止后来的人"顺手统一"回去。

⚠️ **本包的 `definePart` 随之收 `containerKeys`**;层专用 part 传 `[]`。

### 4.6b 🔴 `props` 的值域与 React 组件输入的映射(第一版缺失)

**仓内事实** ✅:`ScreenPlacement.props` 与 `LayerEntry.props` 的类型是 `StateJsonValue`,
而它**包含 primitive、array 与 null**,不只是对象。而 React 组件的 props **必须是对象**。

⇒ 第一版写"`props` 原样下传"是**不完整的**,存在无法映射的值域。

🔴 **两件事必须分开**(第二版把它们混了):

| 情形 | 判定 | 处置 |
|---|---|---|
| **字段缺席**(`props` 未提供)| ✅ **合法** | 以**空 props** 渲染组件。⚠️ `props?` 是**可选字段**,且 ui-state 的 actor 用 `...(props === undefined ? {} : {props})` **刻意区分"未提供"与"提供后校验"** ✅ —— 把缺席当非法是错的 |
| **字段存在但值不是普通对象**(primitive / array / null)| 🔴 **非法** | **不调用业务组件**,渲染 `invalid-props` 变体(§4.3a 第 5 种)并落诊断 `invalid-props-shape`,`data` 含 `partKey` 与实际 `valueType` |

🔴 **非法形状时不得"以空 props 继续调用组件"** —— 那会让依赖必填 props 的组件崩在自己的解构上,
或渲染出一个语义错误的界面。**fail-closed:不渲染该 part,把事实报出来。**
也**不得**把非对象包装成 `{value: …}` —— 那会让组件契约不可预测。

### 4.7 hooks 与 rules of hooks

对外提供的 hook 一律**无条件调用**,再用 prop 覆盖:

```
const fromContext = useSurfaceDisplayMode()      // 无条件调用
```

🔴 **`SurfaceRoot.displayMode` 是必填契约,不存在 fallback**(§4.1)。
本节的"无条件调用"规则针对的是**内部子组件**从 context 取值的写法,
**不得被读成"根壳可以省略 displayMode"**。
若某个内部接缝确实允许 prop 覆盖 context,写法必须是:

```
const fromContext = useSurfaceDisplayMode()      // 先无条件调用
const value = props.displayMode ?? fromContext   // 再覆盖
```

🔴 **禁止** `props.x ?? useOptionalX()` 形态 —— prop 非空时 hook 不被调用,违反 rules of hooks。
(POC 在 `UiRuntimeRootShell` 与 `ScreenContainer` **两处**都有这个 bug。)

### 4.8 公开面(草案)

```
类型:   LayerTier · RendererBinding · RendererCatalog · SurfaceRootProps · RenderProviderProps
组件:   RenderProvider · SurfaceRoot · ScreenContainer · LayerStack
工厂:   createRendererCatalog · definePart
hook:   useSurfaceDisplayMode · useUiStateSelector
```

**不导出**:空态兜底组件、任何具体 partKey/containerKey、任何自动化 context。

#### 4.8a 🔴 被注册的业务组件如何触达 runtime(第一版缺失)

POC 的子组件依赖 `useUiRuntime`、`createUiNavigationBridge`、可编辑 uiVariable 等接缝,
而本稿的公开面只有 `useSurfaceDisplayMode`。**这四件事必须明确归属,不能让下游自己猜**:

| 能力 | 归属 | 说明 |
|---|---|---|
| 业务组件**读 runtime 状态** | **本包** | 提供 `useUiStateSelector(selector)`,内部走 §4.0 的快照 + S-6 订阅。这是本包已有能力的自然外延,不新增依赖 |
| 业务组件**发 command** | **业务包自己**(经集成层) | 🔴 **本包不导出 dispatch、不接收也不转发业务 command** —— 与 §2.2 第 2 条一致。⚠️ **"从自己的模块拿 runtime 引用"不是可执行契约**(第二版的写法):`RuntimeModuleContext.dispatchCommand` 属**模块安装上下文** ✅,React 组件拿不到它。⇒ **由业务包或集成层自己提供 command hook/context**,并在**该包**测试;本稿只钉住 render 侧的两条否定(不导出 dispatch、不转发)。具体形态列入 §7 欠账,**不是 render 的交付物** |
| **可编辑 uiVariable** 的读写 | **`ui.base.input`** | 它是受控输入的语义,不是渲染宿主的。POC 把 `useEditableUiVariable` 放在渲染包是层级放错 |
| **自动化寻址** | **`ui.base.automation`** | §6 的 S-3 |

⚠️ 这四条里只有第一条落在本包;其余三条写进 §7 欠账,由对应 owner 在其需求稿里承接。

### 4.9 🔴 本包是 `toolkit`,**不注册 runtime 模块**(自查第二轮改)

首版 §4.8 提过一个 `createRenderModule` —— **那是错的** ✅:
骨架 §6.1 的规格里 `ui.base.render` 是 **`toolkit`**(`ui.base.automation` 才是 `owner`)。
toolkit 不拥有 slice、不注册模块、**没有 `install` 钩子**。

⇒ 本包**一切依赖由集成层显式传入**,经一个纯 React 的 provider:

```
RenderProvider(props: {
    stateSource      // 🔴 **窄只读入参,不是完整 Runtime**:{ getStatus, getState, subscribe }
                     // 完整 Runtime 带 dispatchCommand ✅,不得整体交给渲染层
    uiCatalog        // 第一跳解析表(ui-state 的 UiCatalog)
    rendererCatalog  // 第二跳解析表(本包 createRendererCatalog 的产物)
    logger           // 🔴 诊断渠道,见下
    children
})
```

**诊断的精确形状**(否则 T-4 / T-5 可以用 no-op mock 假绿):
每条诊断必须带 `category`(固定为本包名)· `event`(闭集**三选一**:`missing-catalog-entry` / `missing-renderer` / `invalid-props-shape`)·
`data` 至少含 `partKey`、`displayMode`,第二跳另含 `rendererKey`。
判据断言的是**这三项的值**,不是"logger 被调用过"。

**诊断渠道**:R-6 要求"层的渲染器解析不到必须落诊断",而 React 组件拿不到 `platformPorts`
(那是 `RuntimeModuleContext` 的成员,只有模块 install 时可见)。
本包是 toolkit 没有 install ⇒ **logger 由集成层注入**,经 provider 下传。

⚠️ 这条同时**加固了 §2.2 的"只读不写"**:一个不拥有 slice、不注册 actor 的 toolkit,
**在结构上就写不了状态**,不必只靠纪律。

---

## 5 · 明确不做

| 项 | 为什么 |
|---|---|
| 任何具体 `partKey` 与默认外观 | 骨架 §7.1;§3.2 |
| `useUiScreenOrSetDefault` 类首屏写入 | §4.5 |
| 替别的模块定义命令 | 所有权与兼容性失去归属;且 tdp-sync 不在 TER 范围 |
| `createUiNavigationBridge` 类薄封装 | 纯转发、第二套词汇、把 `definition` 塞进载荷 |
| 屏幕缓存 / keep-alive · `screenReady` · loading 兜底 | §3.3 |
| 形态因子 `screenModes` | §3.3 |
| 提供自动化 context | 归 `automation`(§6) |
| 任何具体容器键 | 由集成层传入(§6) |

---

## 6 · 跨包接缝(本包不做,但缺任一个形态就不成立)

| # | 接缝 | 对方 | 说明 |
|---|---|---|---|
| S-1 | 每个视口求出自己的 `displayMode` 并传给 `SurfaceRoot` | 集成层 / assembly | 用 `resolveSurfaceDisplayMode({displayIndex, displayRole, instanceMode})`;`displayIndex` 是**物理槽位**,由装配层提供 |
| S-2 | 根容器键的声明与传入 | 集成层 | 本包零具体容器键 |
| S-3 | 自动化 context 的**提供** | `ui.base.automation` | 🔴 本包只**接收**(prop 或 automation 的 context)。理由:POC 里 5 个消费者用它,而 `input` **仅为此**依赖 render;放 `automation` 后 `primitives` 与 `input` 都能拿到 |
| S-4 | `UiCatalog` 的构建与注入 | 集成层 | 第一跳解析表;由集成层用各 UI 包的 `catalogEntry` 建好后同时交给 ui-state 与本包 |
| S-5 | `react` / `react-native` 的唯一实例 | assembly | 本包声明为 `peerDependencies`(骨架 §6.4) |
| **S-7** 🔴🔴 | **硬前置:`UiCatalogEntry.containerKey` 改为 `containerKeys: readonly ContainerKey[]`(允许空)** | `kernel.base.ui-state` | 见 §4.6a。改动面:`types/catalog.ts` 的字段 · `catalog.ts` 的批准键/校验/拷贝/`selectAvailableParts` 过滤四处 · ui-state 自己的 catalog 与枚举用例。**`publicExports` 不变**(类型名未变)。⚠️ **下游消费者为零** —— ui-state 无生产消费者、render 未开工 ⇒ **这是该改动在项目生命周期里最便宜的时刻**,每晚一天成本单调上升 |
| **S-6** 🔴 | **`Runtime` 补一个只读订阅接缝** | `kernel.base.runtime` | 形如 `subscribe(listener: () => void): () => void`。**缺它本包就只能调 `getStore()`,从而持有带 `.dispatch` 的完整 store**。这是本包能否成立的前置条件,不是优化 |

---

## 7 · 跨包欠账(登记,不在本包做)

| 项 | 归属 |
|---|---|
| POC 的 `screen-container.cache-size` 参数定义现在在 ui-runtime 侧 | 若将来做缓存,参数随实现走;当前不做 |
| POC 的自动化 event bus 边界(对外协议 vs 领域事件,`TR-11`) | `ui.base.automation` 设计时显式回答 |
| POC 的 `hot-update-progress-modal` 业务件 | 业务包 |
| 🔴 **业务组件的 command 接缝**(React 组件如何拿到 dispatch 能力) | **业务包 / 集成层**,由其自己的需求稿承接。⚠️ **不阻塞 render** —— render 侧只需守住 §4.8a 的两条否定 |

---

## 8 · 交付物 · 门 · 验收判据

### 8.0 🔴 测试前提(本包是 TER 第一个测 React 组件的包)

| 项 | 事实 ✅ / 要求 |
|---|---|
| 测试框架 | `vitest`,与既有包一致 |
| React 组件渲染 | **`react-test-renderer@19.2.3`** —— **已在 `yarn.lock` 且与 `react@19.2.3` 版本锁死**;POC 的 `runtime-react` 测试也正是用它(5 处)。⇒ **按"先用已有依赖"原则选它,不引 `@testing-library/react-native`**(后者在仓内零条目) |
| ⚠️ 已知代价 | React 19 已弃用 `react-test-renderer`,会有告警。**触发换库的条件**:它在某次 React 升级后不再工作,或需要断言真实触摸/无障碍语义 —— 那时才评估 `@testing-library/react-native` |
| `vitest.config.ts` | 🔴 **本包当前没有这个文件,必须新建**(见下一行)。**六个** kernel 包(contracts · platform-ports · state · runtime · display-context · ui-state)的 `include` 全是 `test/**/*.test.ts`,照抄会让组件测试**一条都不被收集而门显示 PASS**。⚠️ 第一版写"五个"是 ui-state 落地前的旧数 |
| 🔴 **测试接线是"新建"不是"扩展"** ✅ | 本包 `package.json` 当前**只有 `typecheck` 一个脚本**,devDependencies 只有 `@types/react` · `react` · `react-native` · `typescript`;**无 vitest、无 react-test-renderer、无 `vitest.config.ts`、无 `test/` 目录**;`terminal-invariants.json` 的 `owned.test.kind` 是 **`ABSENT`**。⇒ 必须新建:`test` 脚本 · vitest 与 react-test-renderer 的 devDependency · `vitest.config.ts`(含 `.tsx`)· `tsconfig.json` 的 include 扩到 `.tsx` · invariants 改 `REAL_TESTS` |
| `react` / `react-native` | ✅ **已是 `peerDependencies`**(19.2.3 / 0.86.3),骨架已合规,本包不必再改 |
| `terminal-invariants.json` | `owned.test.kind` 必须是 `REAL_TESTS`,`runner: vitest` |

### 8.1 必须测的行为(`T-*`,每条自带反例)

**这一节是需求,不是建议。** 详设可以细化用例编号与夹具,**不得缩小覆盖范围**。

| # | 必须证明 | 必须失败的错误实现 |
|---|---|---|
| T-1 | **两跳解析**:`partKey` 经 `UiCatalog.byPartKey` 取 `rendererKey`,再经本包 catalog 取组件并渲染。🔴 **夹具必须用 ui-state 真实构建的 `UiCatalog` 与真实 `LayerEntry`** | 跳过第一跳直接读 `layer.rendererKey` ⇒ 编译失败或渲染为空。⚠️ 若夹具自造一个带 `rendererKey` 的假 layer,一跳错误**不会红** —— 这条是本判据的成立前提 |
| T-2 | **surface 隔离**:两个 `SurfaceRoot` 分别传 PRIMARY / SECONDARY,各自只渲染自己那套内容集 | 把 `displayMode` 写死成常量,或给它加默认值 ⇒ 另一套内容出现在错误的 surface |
| T-3 | **z 分层**:`alert` tier 的层**恒渲染在全部 `standard` 之上**;同组内按 `openedAt` 升序,**相同 `openedAt` 时按 `layerId` 字典序**兜底 | 去掉分层按插入序渲染 ⇒ 变红。⚠️ 判据断言的是**渲染树顺序**;真实视觉 z-order 属 `L2_UNVERIFIED`,本轮不宣称 |
| T-4 | **两跳各自缺失 ⇒ 落对应诊断**(`missing-catalog-entry` / `missing-renderer`),且不渲染该层;断言**诊断的 category/event/data 三项取值**,不是"logger 被调用过" | 改回静默跳过、或只发一个笼统事件 ⇒ 变红 |
| T-4b | `props` **字段存在但非普通对象**时:**不调用业务组件**,渲染兜底并落 `invalid-props-shape` | 改成"以空 props 继续调用组件"、静默丢弃、或包装成 `{value: …}` ⇒ 变红 |
| T-5 | **屏幕的渲染器解析不到 ⇒ 落诊断**(与 T-4 对称) | 两条路径任一静默 ⇒ 变红 |
| T-6 | **容器无 `ScreenPlacement` ⇒ 渲染空态兜底**,且该兜底**不在任何 catalog 中** | 把兜底注册成 part,或返回某个真实 `partKey` ⇒ 变红 |
| T-7 | `createRendererCatalog` 遇**重复 `rendererKey` 抛错** | 改成后者覆盖 ⇒ 变红 |
| T-8 | catalog **构建后冻结**且**无 register 入口**;尝试改写抛错或静默无效但可被断言 | 暴露 register 或允许 set ⇒ 变红 |
| T-9a | `catalogEntry` 半边:能直接通过 ui-state `createUiCatalog` 的 `Reflect.ownKeys` 精确校验 | 塞入 `component`/`layerTier` ⇒ ui-state **替我们抛**(免费红向量) |
| T-9b | 🔴 `rendererBinding` 半边:**本包自己**校验其 own keys 精确等于 `{rendererKey, component, layerTier?}` | 塞入 `title`/`description` ⇒ 必须变红。⚠️ **ui-state 不看这一半,不会替我们抛** —— 第一版把两半合成一条判据是错的 |
| T-10 | **订阅与退订**:store 变化触发重渲染;组件卸载后监听器被移除,再变化不触发 | 不订阅 ⇒ 状态变了不重画;不退订 ⇒ 卸载后仍触发(泄漏) |
| T-11 | **合法**(缺席或普通对象)的 `props` 原样下传,不篡改不注入;**缺席时以空 props 渲染且不落诊断** | 宿主注入额外字段、丢字段、或把缺席当成非法 ⇒ 变红 |
| T-12 | **hook 顺序稳定**:同一组件在"传该 prop"与"不传该 prop"两种调用下,hook 调用序列一致 | 写成 `props.x ?? useOptionalX()` ⇒ React 报 hook 顺序变化 |
| T-13 | **`containerKeys: []` 的 part 不出现在任何真实容器的枚举结果里**。🔴 **这是 render 拥有的跨包契约用例**:真实调用本包 `definePart` → 把其 `catalogEntry` 交给**真实** `createUiCatalog` → 真实调用 `selectAvailableParts`,全程不 mock | 🔴 **红向量必须是 production mutation**:保持夹具的 `[]` 不变,改 **ui-state 的 `selectAvailableParts` 过滤**(把 `.includes(containerKey)` 换成恒真或删掉该条件)⇒ **该 render 用例必须变红**。
⚠️ 若它只让 ui-state 自己的用例红而 render 用例不红,说明调用链没接通,**该判据即不成立**,须改归 ui-state。⚠️ **改夹具的 `containerKeys` 属于改输入事实,不算红向量**(`PRODUCTION_RED_MUTATION_REQUIRED`)。⚠️ 表述已收窄:本判据**不证明**"空数组等价于 layer-only",绑定是设计约定,列入 §8.3 |

⚠️ **T-9 与 T-13 是跨包判据**:它们的红由 ui-state 侧产生。这是刻意的 ——
两个 catalog 的契合点必须在**真实调用**上验证,而不是各自 mock 一份。

### 8.2 判据必须可证伪

| # | 判据 | 变红条件(反例) |
|---|---|---|
| R-1 | `SurfaceRoot` 缺 `displayMode` ⇒ **编译失败** | 给它加可选或默认值 ⇒ 必须变红 |
| R-2 | 同一 `root` 下两个 `SurfaceRoot` 分别传 PRIMARY/SECONDARY,各自只渲染自己那套内容 | 把 `displayMode` 写死成常量 ⇒ 必须变红 |
| R-3 | `createRendererCatalog` 遇重复 `rendererKey` ⇒ 抛错 | 改成后者覆盖 ⇒ 必须变红 |
| R-4 | catalog 构建后**无 register 入口**,且对象冻结 | 暴露一个 register 方法 ⇒ 必须变红 |
| R-5 | 层栈中 `alert` tier 的层**恒渲染在全部 `standard` 之上**,组内按 `openedAt` 升序 | 去掉分层、或按插入序渲染 ⇒ 必须变红 |
| R-6 | 层的 `rendererKey` 解析不到组件 ⇒ **落诊断**,不静默 | 改回 `return null` ⇒ 必须变红 |
| R-7 | 容器无 `ScreenPlacement` ⇒ 渲染空态兜底,且**该兜底不在任何 catalog 中** | 把兜底注册成 part ⇒ 必须变红 |
| R-8 | 本包源码**不出现任何具体 `partKey` / `containerKey` 字面量** | 加一个 `'ui.base.default-alert'` 字面量 ⇒ 必须变红 |
| R-9 | 本包**不 dispatch 任何 ui-state 命令** | 加一处 `dispatchCommand(showScreenCommand, …)` ⇒ 必须变红 |
| R-10 | 本包**不定义任何 command** | 加一处 `defineCommand(...)` ⇒ 必须变红 |
| R-11 | `definePart` 的 `catalogEntry` **不含** `component`/`layerTier`;`rendererBinding` **不含** `title`/`description` | 任一字段串台 ⇒ 必须变红 |
| R-12 | 本包不出现 `props.x ?? useOptionalX()` 形态 | 引入一处条件调用 hook ⇒ 必须变红 |
| R-13 | `react` / `react-native` 在本包是 `peerDependencies`,不是 `dependencies` | 改成 dependencies ⇒ 必须变红 |
| R-19 | 层专用 part 的 `containerKeys` 为 `[]`,枚举任一真实容器时结果中不含它 | 🔴 同 T-13:改 **ui-state 的过滤实现**使其变红,**不是改夹具输入** |
| R-20 | `UiCatalogEntry` 的 `Reflect.ownKeys` 校验**仍是精确相等**(S-7 不得以放宽它为代价) | 改成"必填⊆实际⊆批准" ⇒ 必须变红 |
| R-18 | 本包**不导出任何 `RuntimeModule`**、不注册 actor、不声明 slice(它是 toolkit) | 加一个模块工厂或 slice 声明 ⇒ 必须变红 |
| R-15 | 本包源码**不出现 `getStore(`**;订阅只经 S-6 的窄接缝 | 加一处 `runtime.getStore()` ⇒ 必须变红 |
| R-16 | 本包**不依赖 `react-redux`**,订阅用 `useSyncExternalStore` | 加 `react-redux` 依赖或 import ⇒ 必须变红 |
| R-17 | 本包**不 import `StateRoot`**(靠推导),依赖图与骨架 §6.1 规格一致 | 显式 import `StateRoot` ⇒ 依赖声明完整门必须变红 |
| R-14 | 公共导出精确集 = §4.8 | 增/删任一符号 ⇒ 必须变红 |

### 8.3 机器判不了的

| 项 | 标记 |
|---|---|
| 空态兜底是否"刻意不做成可用外观" | `UNENFORCEABLE_BY_MACHINE` —— R-7 只能证明它不是 part,证明不了它不好看。设计评审项 |
| 某个部件**应该**是 `standard` 还是 `alert` tier | `UNENFORCEABLE_BY_MACHINE` —— 产品判断 |
| 业务方是否在**正确时机**指定要显示什么 | `UNENFORCEABLE_BY_MACHINE` —— 与 ui-state §8.2 同源 |
| **`containerKeys: []` 与 layer-only 的等价性** | `UNENFORCEABLE_BY_MACHINE` —— ui-state 的 catalog 不认识 `layerTier`,两者的绑定是设计约定;T-13 只能证明空数组不进枚举 |
| **真实视觉 z-order** | `L2_UNVERIFIED` —— T-3 断言的是渲染树顺序;真实层叠需设备或浏览器验证,本轮不宣称 |

---

## 9 · 已知会踩的四个点

1. **解析是两跳,不是一跳。** `LayerEntry` 只带 `partKey`,`rendererKey` 在 ui-state 的 catalog 里。
   照 v2 POC 直接读 `layer.rendererKey` 会编译不过 —— 那是 v2 的一跳模型。
2. **`layerTier` 存在本包,不在 ui-state。** 不要为了"统一"把它推进 catalog:
   z 层级是**外观语义**,而 §7.1 要求 ui-state 不得拥有外观。
3. 🔴 **`getStore()` 是陷阱。** 它是拿到订阅能力最短的路,但它同时把 `.dispatch` 交到渲染层手里。
   S-6 没落地之前,不要"先用 `getStore()` 顶着"—— 那会让 R-9 与 R-15 同时失效,且极难再收回。
4. **`displayMode` 在本包内只能从 context 取一次。** 不要让每个宿主组件各自接受可选 `displayMode`
   —— 那正是 POC 逐层加默认值、最终 fail-open 的路径。

---

## 10 · 决策记录

| # | 决策 | 依据 |
|---|---|---|
| D-A | surface 身份必填闭集无默认 | POC 的可选默认使显式化改进作废 |
| D-B | 注册表改名 `RendererCatalog`,安装期冻结、重复抛错 | "registry"暗示可持续注册;与 ui-state catalog 形态对称;恢复 v1 的重复抛错 |
| D-C | `layerTier` 取代 `UiPartKind`,住本包 | 原名混了两件正交的事;z 层级是外观语义 |
| D-D | 两个宿主合成 `LayerStack` | 分层依据从字符串匹配变成声明式 tier 后,两个宿主没有存在理由 |
| D-E | 零具体 partKey;空态不是 part | 骨架 §7.1 与其 fallback 警告 |
| D-F | 只读不写 | 三条理由见 §4.5 |
| D-G | 不做缓存 / loading / 形态因子 | 无测量、依赖已裁的 `screenReady`、全仓零命中 |
| D-H | 自动化 context 归 `automation` | `input` 仅为它依赖 render |
| D-I | 不改 ui-state 的命名 | 28 个导出无误导性,重命名代价与收益不成比例 |
| D-J | 订阅用 `useSyncExternalStore`,不引 `react-redux` | 它**不在骨架 §6.4 的 `ui/**` 允许清单内,且本包不需要**;React 19.2.3 内置该 API。⚠️ **它以依赖边形式存在于 `yarn.lock`,但那不构成本包的准入依据** |
| D-K | 本包是 toolkit,不注册模块;依赖经 `RenderProvider` 注入 | 骨架 §6.1 规格;顺带让"只读不写"成为结构事实 |
| D-M | `containerKeys` 列表化(而非改可选或用哨兵) | 四维度形状统一;`[]` 正面陈述;保住 ownKeys 精确校验;枚举自动正确。忽略沉没成本后,零下游消费者的现在是最便宜时刻 |
| D-L | 枚举(`selectAvailableParts`)不归本包 | 它要 `workspace`,而本包不依赖 display-context,算不出来 |

---

## 11 · 待确认项

**无待裁项。**

原 Q-1(层专用 part 的容器归属)已由 Dexter 授权按"最长远最优、忽略沉没成本"裁决,
结论见 §4.6a、跨包改动见 §6 的 S-7。

⚠️ **什么会推翻它**:若产品判断是"一个 part 永远只属于一个容器,复用是反模式",
则标量形状才对,应改为**由 ui-state 具名导出一个哨兵值**,并加一条判据
**禁止该常量出现在任何比较、前缀匹配或 id 构造中**(反例即 POC 的 `id.startsWith(...)`)。
这一条是产品语义,我判不了。**但即便如此,"改可选"也应被排除** ——
它削弱 `ownKeys` 那道门却没换来形状统一。

---

## 12 · 第二版修订清单(回应 Codex 首轮 NO-GO)

| 编号 | 原主张 | 处置 |
|---|---|---|
| M-1 | §11 写"无待裁项"而 S-7 未落地 | **接受**。S-7 提为**硬前置**(§4.6a 抬头 + §6),并新增 §1.3 讲清"放置用单数 / 准入用列表",那正是矛盾的根 |
| M-2 | S-6 只有方法形状 | **接受**。新增 §4.0a,把六条运行语义写成契约要求(未启动/失败/通知时机/退订幂等/生命周期结束/可观察 oracle) |
| M-3 | render 测试路径不可执行 | **接受**。§8.0 改为"**新建**不是扩展",逐项列出要新建的六样东西;并核实 `react`/`react-native` **已是 peerDependencies**,该项无需改动 |
| S-1 | `definePart` 仍收单数 | **接受**,签名与 §1 接缝清单同步为 `containerKeys` |
| S-2 | react-redux 其实在 lock | **接受,我的 ✅ 标错了**。它以依赖边存在;我的 grep 只匹配条目头,是**用窄模式下负面结论**(我第三次犯)。结论改为"不在允许清单且本包不需要" |
| S-3 | 是六个 kernel 包不是五个 | **接受**,ui-state 落地后我没重数 |
| S-4 | catalog"挂模块实例"与"不注册模块"矛盾 | **接受**,改为由集成层持有、经 Provider 传入 |
| S-5 | 根壳必填与 `?? fallback` 矛盾 | **接受**,§4.7 改写并显式声明"不得被读成根壳可省略" |
| S-6 | `rendererBinding` 半边无 proof | **接受**,T-9 拆成 T-9a / T-9b;明确 **ui-state 不看 binding 那一半** |
| S-7 | T-13 证不了 layer-only | **接受**,表述收窄,等价性移入 §8.3 不可判定 |
| S-8 | 第一跳缺失行为未定义 | **接受**,补 `missing-catalog-entry`;并记下 ui-state 的 actor **不做 catalog 存在性门控**,渲染侧是唯一发现点 |
| S-9 | 诊断 oracle 不足 | **接受**,规定 category/event/data 三项,判据断言取值而非"被调用过" |
| S-10 | props 值域与 React 冲突 | **接受**,新增 §4.6b:非对象以空 props 渲染 + `invalid-props-shape` 诊断;**不静默丢弃也不包装** |
| S-11 | 子组件的 runtime 接缝未定 | **接受**,新增 §4.8a 四条归属:读状态归本包,发 command 归业务,可编辑变量归 `input`,自动化归 `automation` |
| S-12 | layerTier 跨装配稳定性未定 | **接受**,声明为 renderer 的稳定属性,`createRendererCatalog` 不接受装配级覆盖 |
| N(T-1) | 夹具可能让一跳错误不红 | **接受**,写明夹具必须用真实 `UiCatalog` 与真实 `LayerEntry` |
| N(T-3) | 树顺序 ≠ 视觉 z-order;tie-break 未定 | **接受**,补 `layerId` 字典序兜底;视觉 z-order 标 `L2_UNVERIFIED` |

## 13 · 第三版修订清单(回应 Codex 复评 NO-GO,M=2/S=3/N=1)

| 编号 | 处置 |
|---|---|
| M-1 props 三方矛盾 | **接受**。诊断闭集扩为**三事件**;§4.6b 拆开"**字段缺席=合法空 props**"与"**字段存在但非普通对象=非法**";非法时**不调用业务组件**、渲染兜底并落诊断(**fail-closed**,不再"以空 props 继续调用");§4.4 与 T-11 同步限定 |
| M-2 snapshot 生命周期 | **接受,而且它比订阅侧更危险**。✅ 亲验 `createRuntime.ts` 第 327-330 行:`getState()` 在非 `started` **直接抛** ⇒ 我第二版指定的 getSnapshot **是一条崩溃路径**。新增 §4.0b:先读 `runtime.status`、"运行时不可用"与"容器为空"是两个事实不得复用兜底、转可用必须重渲染、**snapshot 引用稳定性**、`useUiStateSelector` 的相等性规则 |
| S-1 §1 把目标态标成当前事实 | **接受**。§1 分两栏:当前源码事实是**单数**,`containerKeys` 标 `REQUIRED_AFTER_S7`,并列出哪些条目在 S-7 前不成立 |
| S-2 业务 command 接缝不可落地 | **接受**。"从自己的模块拿 runtime 引用"确实不是可执行契约 —— `RuntimeModuleContext.dispatchCommand` 是**模块安装上下文**,React 组件拿不到。改为:本稿只钉住 render 侧**两条否定**(不导出 dispatch、不转发 command),具体形态入 §7 欠账,**不是 render 的交付物** |
| S-3 红向量是改夹具不是改 production | **接受**,违反 `PRODUCTION_RED_MUTATION_REQUIRED` ✅。T-13 / R-19 改为:**保持夹具 `[]` 不变,改 ui-state 的 `selectAvailableParts` 过滤实现**使其变红。⚠️ 我另外**自查了全部 29 条反例**,只有这 2 条属此类,范围未扩大 |
| N-1 D-J 仍写"不在 lock" | **接受**。第二版我改了 §4.0 却没改决策记录 —— **同一模式第五次** |

### 第三版新增的两条失误

4. **修订只改叙述处,不改判据与决策记录** —— N-1 与 M-1 都是这样:
   §4.0 改了而 D-J 没改;§4.6b 加了而 §4.4 / T-11 / 诊断闭集没跟。
   ⇒ **改一个概念时必须同时搜它在全文的每一次出现**,包括判据表与决策记录。
5. **"必须变红"要区分改 production 还是改输入** —— 改夹具数据不是红向量,是换了道题。
   本版已按 `PRODUCTION_RED_MUTATION_REQUIRED` 逐条自查。

---

### 我的三类失误(记下来防复发)

1. **补丁叠加不删旧文** —— S-1 / S-4 / S-5 三条矛盾全是这么来的,**这是同一模式第三次发作**。
   本版因此整篇重写而非续补。
2. **用窄模式下负面结论** —— S-2 的 react-redux,**第三次**。
   凡"某物不存在"的断言,必须用至少两种不同形状的检索验证。
3. **数字不随仓变化更新** —— S-3 的"五个 kernel 包"是 ui-state 落地前的旧数。

---

## 14 · 第四版修订清单(回应 Codex 第二次复评 NO-GO,M=2/S=4/N=1)

| 编号 | 处置 |
|---|---|
| M-1 兜底形态未闭合 | **接受**。新增 §4.3a:**五种"画不出内容"的结果**各有独立 testID 变体与诊断策略;允许共享底层布局但必须是不同语义变体;并要求第 3/4/5 种在 **screen 与 layer 两条路径都覆盖**。⚠️ 我在 §4.0b 自己立了"两个事实不得复用同一表现",却没贯彻到其余几种 |
| M-2 S-6 生命周期与 snapshot 契约不足 | **接受**。✅ 亲验 `status` 是只读字段、`createStateSubscription` 只包 Redux 订阅不通知生命周期 ⇒ "status 可订阅"确实不可执行,改为**由 S-6 承担生命周期通知**(覆盖两次转变及顺序);补"snapshot 读取期间不得抛";**相等性规则收成单一规则** —— 按 root 引用记忆化,选择器须纯函数 |
| S-1 `useUiStateSelector` 不在公开面 | **接受**,已加入 §4.8(R-14 的精确集合随之覆盖它) |
| S-2 前置清单漏 R-20 | **接受**,补入 R-20,并说明 **R-11 只有 `catalogEntry` 那一半后置**,`rendererBinding` 那一半不受 S-7 影响 |
| S-3 欠账未登记 / Provider 未收窄 | **接受**。§7 补 command 接缝欠账(注明**不阻塞 render**);`RenderProvider` 的入参由完整 `Runtime` 改为**窄只读 `stateSource`**(`getStatus` / `getState` / `subscribe`),因为完整 `Runtime` 带 `dispatchCommand` ✅ |
| S-4 跨包红向量可能只红 ui-state | **接受**。T-13 / R-19 明确为 **render 拥有的跨包契约用例**,写出真实调用链(`definePart` → 真实 `createUiCatalog` → 真实 `selectAvailableParts`,全程不 mock),并写明**若只红 ui-state 不红 render 则该判据不成立、须改归 ui-state** |
| N-1 版本/计数/编号漂移 | **接受**。版本号改第四版并指向三份修订清单;§9 标题"三个点"改"四个点";§1 小节顺序理顺为 1.1 / 1.2 / 1.3;§4.0a"六条"改"七条" |

### 第四版新增的一条失误

6. **自己立的规则不贯彻到同类** —— M-1 是典型:我在 §4.0b 明确写了"运行时不可用与容器为空是两个事实,
   不得复用同一表现",却没把这条规则施加到 missing-catalog-entry / missing-renderer / invalid-props。
   ⇒ **每写下一条通用规则,当场搜一遍全文有哪些同类情形应当适用。**
