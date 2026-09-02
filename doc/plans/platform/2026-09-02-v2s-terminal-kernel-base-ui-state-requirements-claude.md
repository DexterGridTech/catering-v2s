# `kernel.base.ui-state` 需求稿

| 项 | 值 |
|---|---|
| 性质 | 需求文档。详设与实施由 Codex 承担 |
| 作者 | Claude |
| 日期 | 2026-09-02 |
| 冻结输入 | 分析稿 `2026-09-02-...-ui-state-requirements-analysis-claude.md`;两代 POC(`_old_` 的 `navigation`/`ui-runtime`、`newPOSv1` 的 `ui-runtime-v2`);v2s 已落地的 contracts / platform-ports / state / runtime / display-context;骨架需求文档 §7.1 §11 |
| 未验证 | 本文结论**全部来自静态阅读**,未执行任何命令、未跑任何测试 |

---

## 0 · 这份文档怎么读

1. **`🔴` 标记的是本文的关键推理**,不是强调语气。评审请优先攻击这些段落。
2. **Dexter 已裁定的条目直接标 `裁定`**,不再复述论证过程,论证在分析稿。
3. **每条能力都带判定**:`POC_ALREADY_HAS`(继承用意与实现)·
   `POC_HAS_BUT_WORSE`(继承用意、换实现,**必须写清为什么换**)·
   `FABRICATED`(POC 没有且给不出产品理由 ⇒ 不做)。
4. §8 的验收判据必须**可证伪** —— 每条都写明"改动什么会让它变红"。
   机器判不了的显式标 `UNENFORCEABLE_BY_MACHINE`。

---

## 1 · 包位置与可用能力(仓内事实,逐项亲验)

| 项 | 事实 |
|---|---|
| 包名 | `kernel.base.ui-state`,`plannedKind: owner` |
| 依赖(骨架 §6.1) | `contracts` · `platform-ports` · `state` · `runtime` · **`display-context`** |
| 当前状态 | 3 文件骨架壳(`dependencies.ts` / `index.ts` / `moduleName.ts`) |
| 骨架 §7.1 定位 | **overlay / screen 的状态协议**;**不得拥有 React;不得拥有任何外观** |
| 下游 | `ui/**` 七个包**整层**都在等它(render · automation · primitives · input · admin-shell · ui test-support · platform-console) |

**可直接消费的既有能力**(2026-09-02 kernel 整改落地后重核 ✅):

- `display-context`(17 个公共导出):`DisplayMode`(`'PRIMARY' | 'SECONDARY'`)· `DisplayRole` ·
  `resolveSurfaceDisplayMode({displayIndex, displayRole, instanceMode})` · `resolveWorkspace` · `selectDisplayRole`
- `state`:`defineStateRuntimeSlice` · `PersistIntent` · `StateJsonValue` · `SyncValueEnvelope` ·
  **workspace 分区三件套** `createWorkspaceStateKeys` / `createWorkspaceActionDispatcher` / `toWorkspaceStateDescriptors` ·
  **泛型分区四件套** `createPartitionedStateKeys` / `createPartitionedActionDispatcher` / `readPartitionedState` / `toPartitionedStateDescriptors`
- `runtime`:**`defineCommand(moduleName, {...})`** · `defineActor` / `onCommand` · `ActorExecutionContext` ·
  `registerResource` · `RuntimeInstanceMode`
- `contracts`:`CommandRouteContext{workspace?, instanceMode?, displayMode?}` ·
  **`createModuleParameterFactory`**(§4.4 的声明式变量以此为形)· `createModuleErrorFactory` · `TimestampMs`

⚠️ **两条口径更正(本文首版写错)**:
- **contracts 没有 `createModuleCommandFactory`** —— 那是 POC 的名字。v2s 的命令由 `runtime` 的
  `defineCommand(moduleName, {name, visibility, allowNoActor, allowReentry, defaultTarget})` 定义。
- 首版称 state 提供 `PersistenceProtection` 可用 —— 本包**不使用**它(见 §4.4)。

### 1.1 🔴 整改落地后新增的两条约定,本包必须遵守

1. **slice 一律用 RTK 的 `createSlice`** ✅:三个 kernel slice 已全部迁移,
   **手写 action type 常量在 kernel 里零残留**。形态见 `display-context` 的 `displayRole.ts` ——
   `createSlice({name, initialState, reducers})` 再由 `defineStateRuntimeSlice` 包装,
   且**在 reducer 内保留类型守卫**(`isDisplayRole(action.payload) ? … : state`)。
2. **按维度分区不得自造** ✅:用 state 的 workspace 三件套(或其泛型内核),
   理由与 `requestLedger` 用 instanceMode 维同源。
   ⚠️ **本包将是 workspace 三件套的第一个真实生产消费者** —— 整改批次里 `requestLedger` 用的是
   instanceMode 维,workspace 维在此之前零消费者。

## 2 · 核心模型

### 2.1 内容集与视口(🔴 本文的核心抽象)

> **`PRIMARY` / `SECONDARY` 不是"两块屏",是两套内容:收银面的与顾客面的。**
> **物理屏幕是视口 —— 它按自己当下的 `displayMode` 取用其中一套。**

```
uiState.contentSets = {
    PRIMARY:   { containers, layers }     // 收银面内容
    SECONDARY: { containers, layers }     // 顾客面内容
}
```

四形态下的取用关系:

| 形态 | 物理屏 | 该屏的 `displayMode` | 取用哪套 |
|---|---|---|---|
| A 单机单屏 | idx0 | PRIMARY | PRIMARY |
| B 单机双屏 | idx0 / idx1 | PRIMARY / SECONDARY | 两套同时被取用 |
| C 主机 | idx0 | PRIMARY | PRIMARY |
| C 副机(单屏 SLAVE + VICE) | idx0 | **SECONDARY** | SECONDARY |
| D 副机(单屏 SLAVE + CHIEF) | idx0 | PRIMARY | PRIMARY |

### 2.2 🔴 角色切换 = 视口改取另一套 = **整套原子切换**(裁定)

C 形态副机接上电源 —— 🔴 **两个轴同时翻,本文首版只写了 displayMode 一个轴,已更正**:

```
resolvePowerRoleTarget → VICE  →  displayRole CHIEF→VICE
   ⇒ displayMode(idx0)  由 PRIMARY 变 SECONDARY   (resolveSurfaceDisplayMode)
   ⇒ workspace          由 BRANCH  变 MAIN        (resolveWorkspace = SLAVE && CHIEF ? BRANCH : MAIN)
```

⇒ 单屏 SLAVE 的两个电源态是 **(BRANCH, PRIMARY)** 与 **(MAIN, SECONDARY)**。
翻转是**跨分区 + 跨内容集**的,不是同一分区内换一套内容。
凡是描述这次翻转的判据,**两端都必须断言四元组**,只断言 displayMode 会让"跨分区搬运 entry"的错误实现漏网。

⚠️ **由此得出一条可达性事实(推论)**:`BRANCH × SECONDARY` 在 TER **不可达** ——
BRANCH 要求 `SLAVE ∧ CHIEF`,而 SECONDARY 要求 `displayIndex===1` 或 `VICE ∧ SLAVE`;
CHIEF 下后者为假,前者要求双屏,而双屏被 `getSwitchInstanceModeEligibility` 拒绝 SLAVE ⇒ 矛盾。
实际可达:双屏设备 `MAIN×{PRIMARY, SECONDARY}`;单屏 SLAVE `BRANCH×PRIMARY` 与 `MAIN×SECONDARY`。
四桶隔离判据可以保留全部四桶(纵深防御无害),但**必须注明哪一桶不可达**,
免得将来有人为一个不可能出现的组合去"修行为"。

⇒ **收银面已打开的层不再显示(但不被删除),顾客面那套原样浮现;拔掉电源翻回来,收银员接着干。**

**这是特性,不是缺陷。** 它正是 C/D 形态的切换机制。

⚠️ 我在分析稿里曾把它当缺陷、主张改用 `displayIndex` 寻址。**那是错的** ——
按物理槽位寻址会导致"设备翻成顾客面之后,收银员刚才开的弹窗继续显示给顾客看"。
Dexter 裁定保留 `displayMode` 寻址。留档见分析稿 §5.9。

### 2.3 🔴 `displayMode` 做键在 TER 里结构安全 —— 单射性证明

**命题**:任何一台设备,都不可能有两块屏同时映射到同一个 `displayMode`。

- **双屏设备**(`displayCount = 2`):`getSwitchInstanceModeEligibility` 在 `displayCount !== 1` 时拒绝 SLAVE
  ⇒ 必为 `MASTER` ⇒ idx0 的合取项 `displayRole === 'VICE' && instanceMode === 'SLAVE'` **恒假** ⇒ idx0 = PRIMARY;
  idx1 由 `displayIndex === 1` 短路 ⇒ SECONDARY。**两者不撞。**
- **单屏设备**(`displayCount = 1`):只有 idx0,一块屏取一套,无从相撞。

⇒ `displayMode` 既承载角色切换语义,寻址能力又不弱于物理索引。**它严格占优。**

⚠️ 该证明**依赖 `getSwitchInstanceModeEligibility` 的双屏拒 SLAVE 规则**。
若那条规则被放宽,本命题失效 ⇒ 详设需在此处留一条断言。

### 2.4 🔴 驱动方式:业务方明确指定,UI 不反推(裁定)

POC 的做法是"容器里排一队候选屏,取第一个 `readyToEnter()` 成立的"。**本包不做这件事。**

**取而代之(与 `TR-11` 同构)**:

```
用户登出 → 发 logout command
        → 登录业务模块的 actor 监听到
        → 该 actor 直接 showScreen(登录界面)
```

**谁拥有这件事的语义,谁来说要显示什么。** 内核不猜、不排队、不反推。

**支持这条裁定的仓外证据**:`readyToEnter` 在两代 POC 里**真实用法只有一处** ——
v1 `MPLoginScreen.tsx` 的 `readyToEnter: () => !getUser()`;
而 v2 的 `defineUiScreenPart` 已将该字段 **`Omit`**,作者连设都设不了。

⇒ 删除 `readyToEnter` · `indexInContainer` · `findFirstReady` · 队列语义。

---

## 3 · POC 对照(三代,逐项判定)

### 3.1 `POC_ALREADY_HAS` —— 用意与实现一并继承

| POC 位置 | 内容 | 继承理由 |
|---|---|---|
| 三代都有 | **UI 状态进 slice 缓存** | 裁定:核心思想正确 |
| v2 `overlayState` | 按 `displayMode` 分两套内容 | §2.1 / §2.2,这是切换机制本体 |
| 三代都有 | 层是**有 id 的栈**,按 id 关闭 | 层需要被别处关闭,id 是必需的 |
| v2 `commands` | **全部通过命令驱动,无人 dispatch action** | 已是 `TR-11` 形态;七个消费者里五个只取命令定义 |
| 三代都有 | `uiVariable` 跨组件/跨屏共享值 | 裁定:**精髓** |
| v2 `UiAlertAction.commands` | alert 动作携带 `CommandIntent[]` | 与 `TR-11` 同构,v2 相对 v1 的改进 |
| v1 `registerScreenPart` | **重复 partKey 抛错** | v2 退化成静默覆盖,恢复 v1 |
| v1 `openOverlay` | **重复 id 拒绝并报错** | v2 退化成静默置顶,恢复 v1 |
| v1 `ScreenPartRegistration` | 三个准入维度**强类型** | v2 退化成 `string[]`,恢复 v1 并换成 v2s 闭集 |
| v1 `getFirstReady...` 返回前剥离 `componentType` | **React 组件不出注册表** | 与骨架 §7.1"不得拥有 React"一致 |

### 3.2 `POC_HAS_BUT_WORSE` —— 继承用意,换实现

| POC 做法 | 问题 | 本文做法 |
|---|---|---|
| `showScreen` / `replaceScreen` / `resetScreen` 三条 | `operation` 是**全栈死数据**(`ScreenContainer` 980 行零命中;唯一读取处只原样转抄) | **`showScreen` 一条**(裁定) |
| screen 靠 `primary.root.container` / `secondary.root.container` **容器键约定**分内容集 | 内核不强制;业务可在收银面写顾客面的容器 | **screen 与 layer 一起进 `contentSets[displayMode]`**,结构化、原子切换 |
| 命令载荷携带整个 `UiScreenDefinition`(含函数) | v2s 载荷受 `StateJsonValue` 约束,**函数进不去** | 载荷只带 **`partKey` + 调用期数据** |
| 注册表是 module scope 可变单例 | 隐式全局、测试不可隔离 | **安装期构建、构建后不可变、挂在模块实例上** |
| 文案(`name`/`title`/`description`)注册表与状态各存一份 | 可能不一致;而渲染 ready 路径**根本不用**它们(仅出现在 `missing-renderer` 诊断) | **只在 catalog** |
| `uiVariable` 自由字符串键 + `unknown` 值 + 调用点传默认值 + `shared.` 前缀约定 | 无归属、无类型、默认值散落、跨节点靠约定 | **声明式变量**(§4.4) |
| 一连串 fail-open(`?? 'PRIMARY'` · 未知字符串落主屏 · `?? 'main'`) | 静默走错分支 | 闭集化后类型层消失;**残余处显式拒绝 + 诊断** |

### 3.3 `FABRICATED` / 不继承

| 项 | 为什么不做 |
|---|---|
| 屏幕队列(`indexInContainer` + `readyToEnter` + `findFirstReady`) | 裁定:明确指定,不反推。§2.4 |
| `screenReady` 闸门 | 裁定:意义不大。且它与 `readyToEnter` 是两个概念(渲染层的"异步初始化完了没") |
| 形态因子(`ScreenMode` MOBILE/DESKTOP) | **v2s 全仓零命中**;TER 是 POS 终端,形态固定。真出现手持形态再加一个闭集维度 |
| 屏幕缓存 / keep-alive | 纯渲染关注点:缓存键 `${containerKey}:${partKey}:${id}`、LRU、`display:'none'` 隐藏。`screen-container.cache-size` 参数也应归 render 包 |
| 事件总线 | `TR-11` 禁止形态。POC `ui-automation-runtime` 的 event bus 服务对外自动化协议,不构成先例 |
| 虚拟键盘一类渲染局部叠加 | 不进层栈。**进栈判据:有身份、要被别处关闭、要参与恢复** |
| ~~workspace 分区~~ | 🔴 **此条已撤销**:workspace 是运行期可变维度(接电即跨),**必须分区**,见 §4.1 |

---

## 4 · 本包要做什么

### 4.1 内容集 slice —— **两个维度:workspace 分区 × displayMode 内容集**

🔴 **本节已按 2026-09-02 的更正重写。** 首版只有 displayMode 一维,漏了 workspace 分区。

```
ContentSet = {
    containers: Record<ContainerKey, ScreenPlacement>
    layers:     readonly LayerEntry[]
}
ScreenPlacement = { partKey: PartKey; instanceId?: string; props?: StateJsonValue }
LayerEntry      = { layerId: string; partKey: PartKey; props?: StateJsonValue; openedAt: TimestampMs }

// 每个 workspace 分区各持有一份：
PartitionState = { contentSets: Record<DisplayMode, ContentSet> }   // 键是闭集,恒有两条
```

**为什么必须分 workspace 分区**:`resolveWorkspace = (SLAVE && CHIEF) ? BRANCH : MAIN`,
而 `resolvePowerRoleTarget` 让**单屏 SLAVE 接电 CHIEF→VICE、断电 VICE→CHIEF**
⇒ **同一台设备插一次电源线就跨 workspace**。两侧的 UI 状态必须隔离,
否则在同一组容器键上互相覆盖。**不涉及链路、不涉及第二台设备。**

**落地方式**:用 `createWorkspaceStateKeys(baseName)` 生成两个 slice 名,
`createSlice` 建同构 reducer,`toWorkspaceStateDescriptors` 生成两份 registration;
写入侧用 `createWorkspaceActionDispatcher` 按当前 workspace 路由。**不自造分区。**

**registration 的三个声明**:

- `persistIntent: 'owner-only'` —— **屏幕位置随 slice 持久化**。
  🔴 理由:导航位置**不是业务状态的投影**(同一业务状态下可以在设置页也可以在订单页),
  它是独立状态,重启后应回到原处。这正是"slice 缓存 UI 状态"的应有之义。
- `syncIntent: 'isolated'` —— **显式声明**。链路半边被骨架 §11 排除;
  仓内惯例是显式写出(`displayRole.ts` 即如此),不靠默认值。
- `persistence` 描述符**只覆盖 `containers`**。
  🔴 **层不进 persistence 描述符**(与 §4.3 一致):`openLayer` 不带持久化参数,
  层在 v1 一律不恢复,需要重来的场景由业务显式重开。
  ⚠️ 首版此处写"层默认不持久化(见 §4.3 的 persistence 字段)",而 §4.3 已删掉那个字段 —— 该表述已作废。

### 4.2 catalog —— 只答"能显示什么"

```
CatalogEntry = {
    partKey: PartKey
    rendererKey: string
    containerKey: ContainerKey
    displayModes:  readonly DisplayMode[]
    workspaces:    readonly WorkspaceKey[]
    instanceModes: readonly RuntimeInstanceMode[]
    title: string
    description: string
}
```

- **不是 Redux 状态,也不是模块级全局**。在模块 install 阶段由各 UI 包声明、汇总构建,
  构建完成后**不可变**(冻结)。
- **重复 `partKey` 在构建时抛错**,不静默覆盖。
- **不含 React 组件** —— `rendererKey` 到组件的解析是 render 包自己的注册表(POC 已这么分,骨架 §7.1 亦如此要求)。
- **没有 `order`,没有 `readyToEnter`** —— 队列已删,排序与前置条件都不再是 catalog 的事。
- 三个准入维度**只在枚举类查询时用**(例:"这个容器里有哪些屏可以出现在导航里"),
  🔴 **不做写入门**:业务要显示某屏时它自己知道场不场合;写入门只会制造"内核比业务更懂业务"的错觉。
  两代 POC 的写入路径也都不校验(`screenRuntimeActor` 只查 `containerKey` 是否存在)。

**什么会推翻"不做写入门"**:若出现"顾客屏绝不能显示收银界面"这类**安全级**约束,
就该做成写入门并配红向量。当前没有这样的需求陈述。

### 4.3 命令面

```
showScreen   { displayMode, containerKey, partKey, instanceId?, props? }
openLayer    { displayMode, layerId, partKey, props? }
closeLayer   { displayMode, layerId }
clearLayers  { displayMode }
setUiVariables   { entries: 见 §4.4 }
clearUiVariables { keys:    见 §4.4 }
```

- `displayMode` 是**必填载荷字段**,不从 `routeContext` 推断。
  🔴 理由:业务侧常常要**指向另一套内容**("支付完成→在顾客面显示小票"),
  这是"目标"不是"来源";从来源推断在语义上就是错的。
- `openLayer` 遇**重复 `layerId` 拒绝并落诊断**(恢复 v1,修 v2 的静默置顶)。
- 层栈**不设深度上限**(裁定)。重复 `layerId` 已被拒绝,层由谁开谁关,不引入淘汰策略。
- 🔴 **层在 v1 一律不持久化**,`openLayer` 不带持久化参数。
  理由:弹窗脱离上下文单独恢复正是"投影与本体分离"的错;
  需要重启后重来的场景由**业务模块自己重开** —— 与 §2.4"谁拥有语义谁指定"同一条原则。
  ⇒ 层所在字段**不进 persistence 描述符**,不需要任何逐项开关。
- **首屏(裁定)**:容器在状态里缺省时,**渲染侧落一个 default 空页面**。
  ⇒ 本包**不需要**任何首屏机制:不声明容器默认内容屏(那会变成变相的队列),
  也不要求业务在启动时先读状态再下发。**容器没有条目 = 空页面**,就这么简单。
  🔴 空页面本身是**外观**,归 `ui.base.render`(POC 已有 `EmptyScreen.tsx` 的先例);
  本包只负责"这个容器当前没有条目"这一状态事实。

### 4.4 `uiVariable` —— 保留并优化(裁定:精髓)

**POC 的弱点(这是"可以优化"的具体所指)**:键是自由字符串、值是 `unknown`、
默认值散在每个调用点的第三参、跨节点共享靠 `shared.` 前缀约定、
三级持久化分类在 `input-runtime` 与 `runtime-react` **各定义一遍**而内核侧根本没有这个概念。

**做法:把 UI 变量变成声明式的一等公民,与本仓已有的 command / parameter 同构。**

```
const defineUiVariable = createModuleUiVariableFactory(moduleName)

export const orderNo = defineUiVariable<string>('order.no', {
    defaultValue: '',
    persistIntent: 'owner-only',        // 复用 state 已导出的 PersistIntent,不新造枚举
})
```

| 收益 | 说明 |
|---|---|
| 命名空间有归属 | 实际键由 `moduleName` 前缀生成,**机制保证不撞车**,不再靠 `shared.` 约定 |
| 类型贯通 | 写入与读取两端同一个 `T`,不再是 `unknown` |
| 默认值单一真相 | 从每个调用点的第三参移到声明处 |
| 持久化开关收口 | 复用 `state` 已有的 `PersistIntent`,落到声明上一个字段,消掉两处重复定义 |

- 值类型受 `StateJsonValue` 约束。
- **批量写保留**(一次原子写入单号 + 金额是真实场景),但是有类型的批量,不是 `Record<string, any>`。
- 🔴 **不新造持久化机制,复用 `state` 的既有钩子**(Dexter 要求)。
  `state` 的记录型描述符已经带
  `shouldPersistEntry(entryKey, value, state) => boolean`,
  且**是活的**:`persistenceEngine.ts` 第 465-474 行真实消费,并有行为测试
  `X-4 respects shouldPersistEntry without deleting unrelated record data`。

  ⇒ ui-variable 的持久化就这么落:

  ```
  变量 slice 用 record 描述符
  shouldPersistEntry: (key) => 声明表[key]?.persistIntent === 'owner-only'
  ```

- 🔴 **变量 slice 同样按 workspace 分区**(与 §4.1 同源):
  单号、金额这类值属于**当前 workspace 的业务上下文**,设备跨 workspace 时不得串用。
  同样用 state 的 workspace 三件套,不自造。

  **声明只是既有钩子的策略输入,不是第二条持久化管线。**
  词汇也复用 `state` 已导出的 `PersistIntent = 'never' | 'owner-only'`,**不新造枚举**。

- 🔴 **不做 `secure-never-persist`,也不引入加密存储**(裁定)。
  行为上无损:"绝不落盘"就是 `persistIntent: 'never'`;
  与原第三级的差别只在**意图表达**,不在行为。
  `PersistenceProtection: 'protected'`(安全存储)本包不使用。
- ⚠️ 将来接链路半边时,"该变量是否跨节点同步"也应是**声明上的一个字段**;
  §11 已排除链路,**现在不建**,只把位置留对。

### 4.5 公开面(草案)

```
类型:   DisplayMode(转出) · ContainerKey · PartKey · CatalogEntry · ScreenPlacement · LayerEntry
        UiVariableDeclaration<T>          // 其 persistIntent 字段直接用 state 导出的 PersistIntent
命令:   showScreen · openLayer · closeLayer · clearLayers · setUiVariables · clearUiVariables
选择器: selectScreen(state, displayMode, containerKey)
        selectLayers(state, displayMode)
        selectUiVariable(state, declaration)
        selectAvailableParts(state, containerKey, context)      // 枚举查询,用准入三维
工厂:   createModuleUiVariableFactory(moduleName)
模块:   createUiStateModule(input: { catalog })
```

**选择器一律显式收 `displayMode`** —— 渲染根壳本来就知道自己该取哪一套。
🔴 读写两侧对称、全程无环境态,这修掉 POC 的读写不对称
(v2 的读路径已显式传参,写路径仍取设备级状态)。

---

## 5 · 明确不做

见 §3.3。另补两条:

| 项 | 为什么 |
|---|---|
| 屏幕/层的跨节点同步 | 骨架 §11 排除链路半边;`syncIntent` 保持默认 `isolated` |
| alert 的具体外观与默认件 | 骨架 §7.1:本包不得拥有任何外观。alert 是"保留 partKey 的层",协议在本包,外观在 render/primitives |

---

## 6 · 跨包接缝(本包不做,但缺任一个形态就不成立)

| # | 接缝 | 对方 | 说明 |
|---|---|---|---|
| S-1 | 每个视口在渲染时提供自己的 `displayMode` | `ui.base.render` | 由 `resolveSurfaceDisplayMode({displayIndex, displayRole, instanceMode})` 求得;根壳已有 surface context 的位置 |
| S-2 | `rendererKey` → React 组件的解析 | `ui.base.render` | 本包只存字符串键 |
| S-3 | 角色/模式变化后的 UI 处置 | 各业务模块 | 变化本身由 `display-context` / `runtime` 发命令(`TR-11`);**要不要关层、要不要换屏由业务决定**,本包不自动搬运 |
| S-4 | 各 UI 包在 install 阶段贡献 catalog 条目 | `ui/**` | 汇总与冻结在本包 |

---

## 7 · 跨包欠账(登记,不在本包做)

| 项 | 归属 |
|---|---|
| `screen-container.cache-size` 参数定义现在在 POC 的 ui-state 侧,应归 render 包 | `ui.base.render` |
| POC 渲染层 `prop ?? useOptionalXxx()` 是**条件调用 hook**,违反 rules of hooks | `ui.base.render` 移植时修 |
| `ui-automation-runtime` 的 event bus 边界(对外协议 vs 领域事件) | `ui.base.automation` 设计时显式回答 |
| 容器的 default 空页面(外观) | `ui.base.render`;POC 已有 `EmptyScreen.tsx` 先例 |

---

## 8 · 交付物 · 门 · 验收判据

### 8.1 判据必须可证伪

| # | 判据 | 变红条件(反例) |
|---|---|---|
| A-1 | 在 `PRIMARY` 集 `openLayer` 后,用 `SECONDARY` 读层 ⇒ 空 | 把寻址键写死成 `PRIMARY` ⇒ 必须变红 |
| A-2 | 单屏 SLAVE 从 **`BRANCH × PRIMARY`**（CHIEF）变为 **`MAIN × SECONDARY`**（VICE）后,同一视口读到 `MAIN × SECONDARY`;原 entry 仍在 **BRANCH 分区的 PRIMARY 集**、只是不可见;翻回后回到 **`BRANCH × PRIMARY`** 且原 entry 复现。两端都断言 workspace 与 displayMode 四元组合 | 若实现改成"翻转时把 entry 搬到另一 workspace 或 content set" ⇒ 必须变红 |
| A-3 | 重复 `layerId` 的 `openLayer` ⇒ 拒绝 + 诊断,栈不变 | 改成静默覆盖/置顶 ⇒ 必须变红 |
| A-5 | catalog 构建时出现重复 `partKey` ⇒ 抛错 | 改成 `map.set` 覆盖 ⇒ 必须变红 |
| A-6 | catalog 冻结后再尝试注册 ⇒ 拒绝(或类型上不可能) | 提供运行期 register 入口 ⇒ 必须变红 |
| A-7 | 状态快照中**不含** `title` / `description` | 把文案写进 `ScreenPlacement` ⇒ 必须变红 |
| A-8 | 两个模块声明同名短键(如都叫 `'order.no'`)⇒ 实际状态键不同,互不覆盖 | 去掉 `moduleName` 前缀 ⇒ 必须变红 |
| A-9 | `persistIntent: 'never'` 的变量写入后,持久化载荷中不含其值;同一 slice 内 `owner-only` 的变量**不受影响**照常落盘 | 去掉 `shouldPersistEntry` 接线 ⇒ 必须变红 |
| A-15 | 本包**不定义**任何自有的持久化枚举/开关类型;持久化只经 `state` 的描述符钩子 | 新增一个本包私有的持久化分级类型 ⇒ 必须变红(公共导出精确集 A-11 亦覆盖) |
| A-14 | 容器在状态中缺省时,`selectScreen` 返回空(不返回任何兜底 `partKey`) | 本包内引入任何"默认内容屏"解析 ⇒ 必须变红 |
| A-10 | 重启后 `containers` 恢复到重启前的 `partKey`;**层一律不恢复** | 把层字段加进 persistence 描述符 ⇒ 必须变红 |
| A-11 | 公共导出精确集 = §4.5 清单 | 多导出或少导出任一符号 ⇒ 必须变红 |
| A-12 | 本包源码零 React / RN 依赖 | 任一源文件 import react ⇒ 必须变红(骨架 §10 已有此门) |
| A-13 | 本包不存在 `readyToEnter` / `indexInContainer` / 队列解析符号 | 重新引入 ⇒ 必须变红 |

| A-16 | 在 MAIN 分区 `showScreen` 后,用 BRANCH 分区读 ⇒ 空;变量同理 | 把两个分区拍平成一份 slice ⇒ 必须变红 |
| A-17 | 本包 slice 全部由 `createSlice` 产出;包内**零**手写 action type 常量 | 引入一个 `@@` 前缀的手写 action type 常量 ⇒ 必须变红 |
| A-18 | 本包**不定义**任何自有的分区键生成/路由实现,只消费 state 的 workspace 三件套 | 包内出现自造的分区键拼接或 action 路由 ⇒ 必须变红(公共导出精确集 A-11 亦覆盖) |

⚠️ 原 A-4(层栈深度上限)已按 Dexter 裁定撤销,编号不复用。

### 8.2 机器判不了的

| 项 | 标记 |
|---|---|
| "业务方在**正确时机**指定了要显示什么" | `UNENFORCEABLE_BY_MACHINE` —— A-13 只能证明内核没有反推机制,不能证明业务用对了 |
| "层是否**应该**进栈"(有身份/要被别处关闭/要参与恢复) | `UNENFORCEABLE_BY_MACHINE` —— 判据是设计评审项 |
| §2.3 单射性在未来规则变更后是否仍成立 | 建议详设落一条断言;规则本身在 `display-context`,本包只能断言当前事实 |

---

## 9 · 已知会踩的三个点

1. **`displayMode` 既是内容集的键,又是准入维度的一员。** 前者是"放哪套",后者是"能不能出现"。
   实现时不要把两者合成一个判断 —— 写入不做准入门(§4.2),而寻址永远要用键。
2. **持久化的是内容集,而内容集按 `displayMode` 分。** 重启后两套都会 hydrate,
   而视口取哪套取决于当时的 `displayRole`/`instanceMode` ——
   **这意味着"重启后看到什么"依赖 `display-context` 的启动校验先跑完**。次序在 S-1/S-3 上。
3. **`clearLayers` 只清一套。** 不要出现"清空所有内容集"的便捷命令 ——
   那会让角色切换的原子性失去意义。

---

## 10 · 决策记录

| # | 决策 | 依据 |
|---|---|---|
| D-A | 内容集按 `displayMode` 寻址 | Dexter 裁定;§2.2 切换机制;§2.3 单射性 |
| D-B | 业务方明确指定,删除队列与 `readyToEnter` | Dexter 裁定;`readyToEnter` 真实用法仅一处且 v2 已 `Omit` |
| D-C | `showScreen` 一条,删 `replaceScreen`/`resetScreen` | Dexter 裁定;`operation` 已证实全栈死数据 |
| D-D | `uiVariable` 保留并改为声明式 | Dexter 裁定"精髓";优化点见 §4.4 |
| D-E | screen 与 layer 一起结构化进内容集 | 让角色切换真正原子;修掉 POC 容器键约定不受内核约束 |
| D-F | 屏幕位置持久化 | 导航位置是独立状态,不是业务状态的投影 |
| D-G | 不做写入门 | §4.2;并写明什么会推翻 |
| D-H | 不引入形态因子 | v2s 全仓零命中 |
| D-I | 层栈不设上限 | Dexter 裁定 |
| D-J | 不做加密存储 | Dexter 裁定 |
| D-L | **不新造持久化机制**:变量持久化复用 `state` 的 `shouldPersistEntry`,词汇复用 `PersistIntent` | Dexter 要求;钩子已亲验为活(引擎消费 + 行为测试 X-4) |
| D-M | 层在 v1 一律不持久化 | 弹窗脱离上下文恢复即投影与本体分离;业务自己重开 |
| D-K | 容器缺省时由渲染侧落 default 空页面 | Dexter 裁定;本包不引入任何首屏/默认内容屏机制 |
| D-L | 🔴 **内容集与变量都按 workspace 分区** | 单屏 SLAVE 接一次电源即跨 workspace(`resolveWorkspace` + `resolvePowerRoleTarget`),两侧状态必须隔离。**推翻本文首版的"只落一份 slice"** |
| D-M | 分区不自造,用 state 的 workspace 三件套 | 与 `requestLedger` 用 instanceMode 维同源;本包将是 workspace 维的**第一个真实生产消费者** |
| D-N | slice 一律用 RTK `createSlice`,保留 reducer 内类型守卫 | 2026-09-02 整改后 kernel 已统一该形态,手写 action type 常量零残留 |

---

## 11 · 待确认项(已全部收敛)

| # | 问题 | 裁定(Dexter 2026-09-02) |
|---|---|---|
| Q-1 | 层栈深度上限取多少 | **不需要上限** ⇒ §4.3 已改 |
| Q-2 | `secure-never-persist` 这一级 v1 是否要做 | **不需要加密存储** ⇒ 分级收成两级,§4.4 已改 |
| Q-3 | 首屏谁下发 | **容器有个 default 的空页面** ⇒ 本包不做首屏机制,§4.3 已改 |

| Q-4 | UI 变量的持久化是否与 slice 通用 persist 是同一套机制 | **必须是同一套** ⇒ §4.4 已改为复用 `shouldPersistEntry` + `PersistIntent`,本包零自有持久化类型 |

**本文当前无待裁项。**
