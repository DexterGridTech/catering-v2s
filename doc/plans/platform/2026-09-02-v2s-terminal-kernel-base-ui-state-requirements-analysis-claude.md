# `kernel.base.ui-state` 需求分析稿（非正式）

| 项 | 值 |
|---|---|
| 性质 | **分析稿,不是需求稿**。供 Dexter 与我边讨论边改;定稿后另出 `-requirements-claude.md` |
| 作者 | Claude(独立分析) |
| 日期 | 2026-09-02 |
| 冻结输入 | **两代 POC**:v1 `_old_` 的 `1.1-cores/{navigation, ui-runtime, base}`;v2 `newPOSv1` 的 `1.1-base/ui-runtime-v2` 及其全部消费方。v2s 侧:已落地的 contracts / platform-ports / state / runtime / display-context |
| 未验证 | 本文**全部结论来自静态阅读**,未执行任何命令、未跑任何测试 |

---

## 1 · 亲验清单(供复核)

**v1(`_old_`)**:`1.1-cores/base/src/foundations/screen.ts`、`base/src/types/shared/environment.ts`、
`ui-runtime/src/{types/state/*, types/foundations/screen.ts, features/slices/{overlay,uiVariables}.ts,
features/actors/{overlay,screen}.ts, features/commands/index.ts, foundations/screen.ts,
selectors/index.ts, hooks/useChildScreenPart.ts}`、
`navigation/src/{features/commands/index.ts, features/actors/navigate.ts,
features/slices/uiVariables.ts, types/state/uiVariables.ts}`

**v2(`newPOSv1`)**:`ui-runtime-v2/src/{types/*, features/slices/*, features/commands/index.ts,
features/actors/{overlay,screen,screenRegistry}RuntimeActor.ts, foundations/{screenRegistry,screenFactory}.ts,
selectors/index.ts, supports/screenHelpers.ts}`;消费方七个包的导入符号全集;
`runtime-react` 的 `UiRuntimeRootShell.tsx` / `OverlayHost.tsx` / `AlertHost.tsx` / `hooks/useUiOverlays.ts`

**v2s**:`contracts/types/command.ts`、`state` 56 个公共导出、`display-context` 17 个公共导出、骨架需求文档 §7.1 / §11

**本轮补读(原缺口已闭)**:v1 九个 kernel core 的全部 `epics` / `middlewares`;
v2 `admin-console` 内部(`selectors/adminConsole.ts`、`application/createModule.ts`、`foundations/adminScreenParts.tsx`);
`ui-automation-runtime` 的依赖与源码;`runtime-react` 的 `foundations/uiVariables.ts`、`types/parts.ts`、
`ui/components/{OverlayHost,ScreenContainer}.tsx`;v2 `supports/parameters.ts`;
`input-runtime/foundations/inputPolicies.ts`;v2s `state/types/persistence.ts`。

**第三轮补读(缺口已全闭)**:v1 `ui-runtime/dev/{test-state-dual,worker}.ts`;
`runtime-react/ui/components/ScreenContainer.tsx` 的缓存与挂载实现、`contexts/UiRuntimeContext.tsx`
的两个 controller、`hooks/useChildScreenPart.ts` 全文;
`input-runtime` 的 `types/input.ts` · `foundations/inputPolicies.ts` · `ui/components/VirtualKeyboardOverlay.tsx` 及公共导出;
`ui-automation-runtime` 的依赖与源码扫描。

---

## 2 · 三代演进(这是理解本包的关键)

同一件事在 POC 里被做了三遍。**演进方向本身就是最好的设计输入**。

### 第一代 · `navigation` —— 一个通用袋子装所有

```
UiVariablesState extends Record<string, ValueWithUpdatedAt<any>> {
    primaryModals:   ValueWithUpdatedAt<ModalScreen[]>
    secondaryModals: ValueWithUpdatedAt<ModalScreen[]>
}
```

- **屏幕**:`navigateTo({target})` 的实现是 `setUiVariables({[containerKey]: target})` —— 存进袋子
- **模态**:`openModal` 派发 `uiVariablesActions.openModal` —— 存进同一个袋子的两个保留键

⇒ 只有一个 slice,screen 与 modal 都编码进通用 key-value。

### 第二代 · `ui-runtime`(v1) —— 拆成三个专用 slice

- `screen`:`Record<containerKey, ValueWithUpdatedAt<ScreenEntry | null>>`
- `overlay`:`{primaryOverlays, secondaryOverlays}`
- `uiVariables`:**只剩 `updateUiVariables` / `clearUiVariables` 两个 reducer**

⇒ **`uiVariables` 是被掏空的残留物**:用它的两样东西(screen、modal)都被搬进了各自的专用 slice。

同时建立了两个关键切分:

| 类型 | 内容 | 是否穿越命令/状态 |
|---|---|---|
| `ScreenPart` | `name` `title` `description` `partKey` `id?` `containerKey?` `props?` `indexInContainer?` | ✅ 是(JSON 安全) |
| `ScreenPartRegistration extends ScreenPart` | 追加 `componentType: ComponentType`(React 组件!) · `readyToEnter?: () => boolean` · `screenMode: ScreenMode[]` · `instanceMode: InstanceMode[]` · `workspace: Workspace[]` | ❌ 否(只在注册表) |

**三个准入维度在 v1 全部是强类型**:`ScreenMode` 是 enum(`MOBILE='mobile'` / `DESKTOP='desktop'`),
`InstanceMode[]` 与 `Workspace[]` 来自 `interconnection`。
`ScreenMode` 属于 `Environment{deviceId, production, screenMode, displayCount, displayIndex, isEmulator}`
⇒ **它是设备形态因子,与主副屏无关**,这一点在 v1 毫无歧义。

### 第三代 · `ui-runtime-v2`(newPOSv1) —— 保留三 slice,但退化了两处

| 维度 | v1 | v2 | 判定 |
|---|---|---|---|
| 三个准入维度 | `ScreenMode[]` · `InstanceMode[]` · `Workspace[]`(强类型) | 全部 `readonly string[]` | 🔴 **回退** |
| 定义模型 | `ScreenPart` / `ScreenPartRegistration` **两个类型** | 合并成单一 `UiScreenDefinition`,**整个塞进命令载荷** | 🔴 **回退** |
| 重复注册 | `registerScreenPart` **抛错** | `definitions.set(key, def)` **静默覆盖** | 🔴 **回退** |
| 重复 overlay id | `openOverlay` **拒绝并报错** | 先 `filter` 掉同 id 再 append(静默置顶) | 🔴 **回退** |
| alert 动作 | `confirmCommandName: string` + `confirmCommandPayload: any` | `commands: readonly CommandIntent[]` | 🟢 **改进** |
| overlay 读路径 | `selectCurrentOverlays(state)`,displayMode 从 state 取 | `selectUiOverlays(state, displayMode?)`,根壳显式传 | 🟢 **改进(但只改了一半,见 D-1)** |

---

## 3 · 消费面(决定 v1 公共面)

⚠️ **本节已修正。** 首轮我用行级 `grep` 抽取导入符号,**漏掉了全部多行 `import`**,
因而错判成"只有渲染包读状态"。下表是用跨行解析重扫的结果(排除测试):

| 消费者 | 生产代码取用 |
|---|---|
| `runtime-react` | `createUiRuntimeModuleV2` · `selectUiScreen` · `selectUiOverlays` · `selectUiVariable` · `selectUiCurrentScreenOrFirstReady` · `selectUiScreenDefinitionsByContainer` · `uiRuntimeV2ParameterDefinitions` · 4 个类型 · 命令 |
| `admin-console` | **`selectUiScreen`** · 命令 |
| `catering-shell` | **`selectUiOverlays`** · 命令 |
| `terminal-console` · `catering-master-data-workbench` | 命令(+ moduleName) |
| `test-support` · `topology-runtime-bridge` | 模块工厂(+ 命令) |
| `input-runtime` | 完全不 import |
| `ui-automation-runtime` | **package.json 声明了依赖,源码零 import**(冗余声明) |

**修正后的结论**:

1. **读状态的是三个包**(runtime-react · admin-console · catering-shell),不是一个。
2. **`selectUiVariable` 在生产代码里只有 `runtime-react` 用** —— D-10 不受影响。
3. **`selectUiScreenDefinition` 只被测试用** —— 不进 v2s 公共面。
4. 整个 UI 层的**写**全部走命令,无人 dispatch action ⇒ 已是 `TR-11` 形态。

### 3.1 注册发生在安装期(支持 §5.4 的方案 C)

`admin-console/application/createModule.ts` 在模块 install 时
`dispatchCommand(registerScreenDefinitions, {definitions: adminConsoleScreenDefinitions})`,
定义来自 `Object.values(adminConsoleScreenParts)` —— **构建期静态常量**。
两代 POC 都没有真正的运行期动态注册场景。

### 3.2 surface 身份贯穿到自动化寻址

`OverlayHost` 收 `automationTarget?: 'primary' | 'secondary'`,
注册的节点 id 是 `overlay-host:${automationTarget}`;根壳 testID 是 `ui-base-root-shell:${display}`。
⇒ **surface 是整条 UI 栈的一等寻址维度**,只有内核写路径把它丢了(见 D-1)。

## 4 · 缺陷与结构性问题

### 🔴 D-1 · displayMode 的写路径是环境态 —— **TER 下结构性不成立**

三代的处置:

- v1 写:`getDisplayMode()`,`interconnection` 的**全局函数**
- v1 读:`selectCurrentOverlays(state)`,从 `instanceInfo.displayMode` 取,`?? PRIMARY`
- v2 写:`selectTopologyDisplayMode(getState()) ?? 'PRIMARY'` —— 仍是设备级状态
- v2 读:**根壳显式传** `displayMode={display === 'secondary' ? 'SECONDARY' : 'PRIMARY'}`

⇒ **v2 把读路径改成 per-surface,却留下写路径是设备级。** 这个不对称本身就是证据:
他们撞上了这个问题并修了一半。

**为什么在 POC 里能跑**:每块屏一个进程一个 store,设备级 displayMode 恰好等于本 surface 的。
**为什么 TER 下不成立**:`TER_SINGLE_VM_SINGLE_STORE_MULTI_SURFACE`,一个 store 服务两块屏,
设备级 displayMode 只有一个值 ⇒ **副屏发起的 overlay 会落到主屏栈上**。

**v2s 侧的结构性佐证**:`display-context` 的 17 个公共导出里**没有 `selectDisplayMode`**,
只有纯函数 `resolveSurfaceDisplayMode({displayIndex, displayRole, instanceMode})`。
ui-state 在 v2s **根本读不到**设备级 displayMode ——
这不是"建议改",是照抄编译不过。

⇒ **displayMode 必须来自 `command.routeContext.displayMode`(读路径同样来自 surface 身份),不得来自 state。**

### 🔴 D-2 · screen 的 surface 隔离靠约定,内核不强制

⚠️ **本条已修正。** POC **确实**隔离了两块屏的根屏幕:
`runtime-react/foundations/uiVariables.ts` 定义了两个常量
`primaryRootContainer.key = 'primary.root.container'` / `secondaryRootContainer.key = 'secondary.root.container'`,
根壳按 `display` prop 二选一传给 `ScreenContainer`。

**但这是渲染包持有的约定,内核不强制。** kernel 的 `screenState` 是
`Record<containerKey, entry>`,**没有 surface 概念**:
- 任何业务包都可以在主屏上下发一条写 `secondary.root.container` 的 `showScreen`,内核不会拒绝;
- 两块屏若用同名容器键(非根容器),在单 store 下直接互相覆盖。

⇒ 与 D-1 同源:surface 在渲染侧是一等维度,在内核侧不存在。

### 🟠 D-3 · 三个准入维度在 v2 退化为无类型 `string[]`,真实数据已经乱了

v2 全仓实际取值:

- `screenModes`:`['DESKTOP','MOBILE']` 27 次 · `['DESKTOP']` 7 次 · **`['PRIMARY','DESKTOP']` 4 次** · `['SECONDARY','DESKTOP']` 2 次
  ⇒ 形态因子与主副屏被混进同一列表;而 context 的 `screenMode` 默认 `'DESKTOP'`,
  那些 `'PRIMARY'`/`'SECONDARY'` 项**永远匹配不上,是死数据**
- `workspaces`:**`['main','MAIN']` 21 次** —— 作者为规避大小写归一不一致而两个都写
- `instanceModes`:**`'STANDALONE'` 6 次**,而它不是 instanceMode

**关键**:v1 这三个维度是强类型的,以上三类混乱**全部是 v1→v2 退化的直接产物**。
⇒ v2s 用闭集不是我的发明,是**恢复 v1 的设计**。三个闭集现成:
`DisplayMode` · `WorkspaceKey` · `RuntimeInstanceMode`。

### 🟠 D-4 · v2 把定义与注册合并,导致函数进命令载荷

v1 的 `ScreenPart` / `ScreenPartRegistration` 切分是对的:
`componentType`(React 组件)与 `readyToEnter`(闭包)**只在注册表**,
`getFirstReadyScreenPartByContainerKey` 返回前还显式剥离:`const {componentType, ...screenPart} = registration`。

v2 合并成 `UiScreenDefinition` 并整个塞进 `showScreen`/`openOverlay` 载荷,
而它带 `readyToEnter?: () => boolean`。
v2s 的命令载荷受 `StateJsonValue` 约束 ⇒ **函数进不去,照抄编译不过**。

### 🟠 D-5 · `operation` 是整条栈上的死数据 —— `showScreen` / `replaceScreen` 行为完全相同

两条命令都走同一个写入,只有 entry 里的 `operation: 'show' | 'replace'` 不同。三代都如此。

**已穷举证实无人消费**:
- `ScreenContainer.tsx`(980 行,真正的挂载/缓存实现)**零命中**;
- 全仓 `.operation` 的其余命中全部属于 tdp-sync 的另一个 `operation`(`'upsert' | 'delete'`);
- 唯一读取处 `useChildScreenPart.ts` 第 50 / 66 行只是**原样转抄**进结果对象,无任何分支。

⇒ 两条命令在内核与渲染两侧行为完全一致,合并是安全的。

### 🟡 D-6 · 一连串 fail-open 默认值(v2 比 v1 严重)

v2:`displayMode === 'SECONDARY' ? secondary : primary`(未知字符串静默落主屏)、
`?? 'PRIMARY'`、`?? 'MASTER'`、`normalizeUiRuntimeWorkspace` 未知值原样透传后索引不存在的 slice 键。
v1 因为是 enum,只有 `?? PRIMARY` 一处。

### 🟡 D-7 · 模块级可变全局,三代都有且越来越多

v1:`screenRegistryMap`(注册表)· `screenPartRegisters`(注册器数组)· `selectorCache`(记忆化缓存)
v2:`sharedRegistry`(module scope 单例)
⇒ 测试之间不可重置、无法隔离;两个 runtime 实例共享同一张表。

### 🟠 D-8 · POC **有**"该不该恢复"的分级,却没用在 overlay 上

⚠️ **本条已升级。** 我原判"两代都没有区分哪些该重现",**是错的**。

`runtime-react/types/parts.ts` 定义了三级分类:

```
persistence?: 'transient' | 'recoverable' | 'secure-never-persist'
```

`input-runtime/foundations/inputPolicies.ts` 实现策略 `shouldRestoreInputValue = p => p === 'recoverable'`,
并有测试 `persists only explicitly recoverable values`;
`admin-console` 也有 `persists only the minimum recoverable admin console state`。

**但这套分级只用在变量与输入值上;overlay 栈是整体持久化的**
(v1 `persistToStorage: true`,v2 `persistIntent:'owner-only'` + 两条 field 持久化)。

⇒ 真正的缺陷不是"没想过",而是**已有的语义没有覆盖到 overlay**。
崩溃时开着的支付确认框与一条陈旧 toast,重启后被同等对待。

**v2s 侧的错配**:v2s 的两根轴是 **slice 级** ——
`PersistIntent: 'never' | 'owner-only'` 与 `PersistenceProtection: 'plain' | 'protected'`。
而这里需要的是**逐项级**:同一个 overlay 栈里会同时存在该恢复与不该恢复的条目。
⇒ 分级必须落在 **overlay/screen 协议本身**,不能靠 slice 级 persistIntent 表达。

⚠️ 注意 `secure-never-persist` 在 v2s 无直接对应:v2s 的 `protected` 是"存进安全存储",
而 POC 这一级是"**绝不落盘**"。对 POS 而言(卡号、密码输入)这是真实需求,不是冗余。

### 🟡 D-9 · overlay 栈无深度上限、无模态互斥

v1 至少拒绝重复 id;v2 连这个都退化了。两代都没有上限与互斥概念。

### 🟠 D-10 · `uiVariables` 的真实用途是**跨节点共享 UI 值**(本条已两次修正)

**第一次判断**(只看 v2):零业务消费者,建了没人用。
**第二次判断**(读 v1 `navigation`):第一代设计的残骸 —— screen 与 modal 都被搬走了。
**第三次判断(现结论)**:前两条都不完整。v1 的双屏开发夹具给出了它的**存活用途**。

`ui-runtime/dev/worker.ts` 里 master 侧:

```
setUiVariables({'shared.orderNo': 'A1001', 'shared.amount': 128})
openOverlay({id: 'dual-payment-modal', props: {amount: 128}})
```

`test-state-dual.ts` 的断言:

```
slaveResult.syncedOrderNo === 'A1001'        // 从机收到同步的单号
slaveResult.syncedAmount  === 128            // 从机收到同步的金额
slaveResult.syncedScreen?.partKey === 'dev.primary.root'   // 屏幕状态也同步
slaveResult.displayMode === 'secondary'      // 从机进程跑在副显示模式
slaveResult.workspace   === 'main'
```

⇒ `shared.` 前缀是刻意的跨节点命名。**它的产品用意是:主机把单号与金额推给顾客面副屏显示。**
这是真实 POS 需求,不是死代码。

**但对 TER 的结论仍然是"v1 不建",理由完全不同**:

- **TER 的 A/B 形态是单 VM 单 store 多 surface** —— 副屏组件与主屏读**同一个 store**,
  想显示单号直接读持有它的业务 slice 即可。**"把值传给另一块屏"这个问题在单 store 下根本不存在。**
- **C/D 形态(两台机器两个 VM)才需要它** —— 而那需要链路半边,§11 已排除。

⇒ 不是"这个能力没用",而是"**TER 的架构已经免费解决了它在 A/B 下的用途,而 C/D 下的用途不在范围**"。

⚠️ 附带发现:**屏幕状态也走 master→slave 同步**(`syncedScreen`),
即 POC 的从机屏幕是被主机驱动的。这条在 §11 排除链路后同样不适用于 TER v1。

### 🟢 D-11 · `epics` / `middlewares` 是空脚手架 —— 不必带进 TER

v1 九个 kernel core 各有 `features/epics/index.ts` 与 `features/middlewares/index.ts`,
**18 个槽位中 17 个是空对象**;唯一非空的是
`interconnection` 的 `stateSyncMiddleware`(服务状态同步,即 §11 已排除的链路半边)。
v2 的 `ui-runtime-v2` 已经**整个删掉了这两个目录**。

⇒ Dexter 的判断("第一版用了,后面觉得意义不大")在代码上完全坐实。
**更重要的是:screen / overlay 的语义没有藏在里面**,§2 的能力清单是完整的。

### 🟠 D-12 · 三级持久化分类在两个包里各定义了一遍

`input-runtime/types/input.ts` 定义 `InputPersistencePolicy = 'transient' | 'recoverable' | 'secure-never-persist'`
并由 `inputPolicies.ts` 的 `canPersistInputValue` 实施;
`runtime-react/types/parts.ts` 的 `UiRuntimeVariable.persistence` **把同样三个字面量又写了一遍**,
两者之间没有类型关系。

⇒ 这是 DRY 违反,也说明它是**跨包的横切关注点,应当只有一个归属**。
`ManagedInputMode` 含 `'system-password'` · `'virtual-pin'` · `'virtual-activation-code'`
⇒ `secure-never-persist` 对应密码/PIN/激活码输入,是真实需求。

### 🟢 D-13 · POC 有两套 overlay 机制,不必强行统一

`input-runtime` 的 `VirtualKeyboardOverlay.tsx` 是**普通的绝对定位 React 视图**,
完全不经过 ui-state 的 overlay 栈(该包对 ui-runtime 零 import)。

⇒ 虚拟键盘是**渲染局部叠加**,不是协议意义上的 modal。
v2s 不应把所有叠加物都塞进 overlay 栈 —— 需要进栈的是"有身份、要被别处关闭、要参与恢复"的那些。

### 🟢 D-14 · `screenReady` 与 `readyToEnter` 是两个概念,不能混

- `readyToEnter`(注册表,ui-state 侧):**这个屏幕现在有没有资格被进入** —— 步进时的准入谓词
- `screenReadyController`(`runtime-react/contexts/UiRuntimeContext.tsx`):
  **这个已挂载的屏幕自身异步初始化完了没有** —— 带 `readyGateCount` 闸门与 `generation` 防陈旧,
  驱动 loading → content 过渡

两者都合理,但归属不同层。v2s 只需承接前者。

### 🟢 D-15 · 屏幕缓存是纯渲染关注点

`ScreenContainer.tsx` 的缓存以 `${containerKey}:${partKey}:${id ?? 'default'}` 为键,
按 `recency` 做 LRU 淘汰,复用判据是
`Component` 同一性 + `partKey` + `rendererKey` + `id` + props 浅比。

缓存中的非活动屏幕用 `display: 'none'` **隐藏而非卸载**(keep-alive),
其自动化节点随槽位激活态开关;过渡期盖一层 `LoadingOverlay`,在 `scheduleAfterPaint` 后提交。

**决定性事实**:`ScreenContainer`(980 行)对 ui-state 的消费**只有一处** ——
`useChildScreenPartResolution(containerPart)`,其余全部是自动化桥、运行参数与渲染局部状态。

⇒ **ui-state 只需提供 `containerKey` / `partKey` / `id` / `props` 这组身份,缓存机制不进协议**;
`screen-container.cache-size` 这个参数也应随之归 render 包(它现在定义在 ui-state 侧)。

### 🟠 D-16 · automation 里有一个真正的事件总线 —— TR-11 要盯的形态

`ui-automation-runtime/foundations/eventBus.ts` 的 `createAutomationEventBus`
是标准的 `subscribe(handler)` / `publish(event)` 订阅表,并由 `index.ts` **公开导出**。

这正是本仓 `TR-11` 明令禁止的形态(回调注册缝 / effect 列表 / 事件总线)。

⚠️ **但要区分**:它承载的是**对外自动化协议**的事件推送(经 WS / JSON-RPC 送给外部驱动端),
不是领域事件的内部分发。TR-11 针对的是后者。
⇒ 这不构成"POC 违反 TR-11",但 **v2s 的 `ui.base.automation` 设计时必须显式回答这个边界**,
不能默认照搬一个 event bus 进来。

### 🟢 D-17 · surface 身份在渲染层走 `prop ?? context ?? 'primary'`

`ScreenContainer` 第 552-554 行:`automationTargetProp ?? useOptionalUiAutomationTarget() ?? 'primary'`。
⇒ 渲染层已有一条 **surface context**,这是 v2s 读路径承接 `displayMode` 的天然位置;
但末端的 `?? 'primary'` 仍是 fail-open(D-6 同类)。

⚠️ **顺带发现一个 POC 渲染层真实 bug(不属 ui-state 范围,仅登记)**:
第 547-554 行用 `prop ?? useOptionalXxx()` 的写法 —— prop 非空时 hook **不被调用**,
这是条件调用 hook,违反 rules of hooks;同一组件时有时无地传该 prop 就会触发 React 报错。

---

## 5 · 设计

> **本节已按 Dexter 2026-09-02 的裁定重写。** 上一版我提出"步进交给 workflow""不持久化 UI 状态"
> "不建 uiVariables",被指出是脑洞。原因记在 §5.9,不删,供追溯。

### 5.0 保留的核心思想(Dexter 裁定)

> **通过 slice 缓存 UI 的各种状态。** 两版 POC 这一条是对的,继承。

ui-state 持有三类 UI 状态,都在 slice 里:

| 状态 | 内容 |
|---|---|
| **screen** | 每个容器当前显示哪个屏 |
| **layer**(原 overlay) | 叠在其上的层 |
| **uiVariable** | 跨组件/跨屏共享的 UI 值 |

### 5.1 驱动方式:**明确指定要显示什么,不做队列反推**(Dexter 裁定)

POC 的 `indexInContainer` + `readyToEnter` + `findFirstReady` 是
"容器里排一队候选屏,取第一个前置条件成立的"。**这个机制删掉。**

**证据支持这条裁定**:`readyToEnter` 全仓**真实用法只有一处** ——
v1 `MPLoginScreen.tsx` 的 `readyToEnter: () => !getUser()`(未登录才进登录页);
而 v2 的 `defineUiScreenPart` 已经把该字段 **`Omit` 掉**,作者连设都设不了。
⇒ 一个只用过一次、下一代就被封掉的机制,不值得进 TER。

**取而代之的形态(与 `TR-11` 同构)**:

```
用户登出 → 发 logout command
        → 登录业务模块的 actor 监听到
        → 该 actor 直接 showScreen(登录界面)
```

**UI 不反推,业务方明确指定。** 谁拥有这件事的语义,谁来说要显示什么。

⇒ 随之删除:`readyToEnter` · `indexInContainer` · `findFirstReady` · 队列语义 ·
`screenReady` 闸门(Dexter:意义不大)。

### 5.2 命令面:`showScreen` 一条(Dexter 裁定)

`replaceScreen` 与 `resetScreen` 多余 —— 前者与 `showScreen` 状态变更完全相同
(`operation` 已证实是全栈死数据,D-5),后者等价于 `showScreen` 到目标屏。

```
showScreen   { surfaceId, containerKey, partKey, instanceId?, props? }
openLayer    { surfaceId, layerId, partKey, props? }
closeLayer   { surfaceId, layerId }
clearLayers  { surfaceId }
setUiVariables   { ...(见 5.3) }
clearUiVariables { ...(见 5.3) }
```

### 5.3 `uiVariables` —— 精髓,保留并优化(Dexter 裁定)

**POC 的弱点在哪(这是"可以优化"的具体所指)**:

- 键是**自由字符串**,值是 `unknown`。任何模块可以写任何键,**无归属、无类型、无默认值**;
- 跨节点共享靠 **`shared.` 前缀的约定**(v1 dual 夹具里的 `shared.orderNo`),不是机制;
- 三级持久化分类(`transient` / `recoverable` / `secure-never-persist`)在
  `input-runtime` 与 `runtime-react` **各定义了一遍**(D-12),而内核侧的变量根本没有这个概念。

**我的优化:把 UI 变量变成"声明式的一等公民",与本仓已有的 command / parameter 同构。**

v2s 里 command 是 `createModuleCommandFactory(moduleName)` 声明的,
parameter 是 `createModuleParameterFactory(moduleName)` 声明的。UI 变量照此:

```
const defineUiVariable = createModuleUiVariableFactory(moduleName)

export const orderNo = defineUiVariable<string>('order.no', {
    defaultValue: '',
    persistence: 'recoverable',
})
```

带来四个直接收益:

| 收益 | 说明 |
|---|---|
| **命名空间有归属** | 键由 moduleName 前缀生成,**机制保证不撞车**,不再靠 `shared.` 约定 |
| **类型贯通** | `set(orderNo, 'A1001')` / `select(orderNo)` 两端同一个 `T`,不再是 `unknown` |
| **默认值有归属** | 现在默认值散在每个调用点的第三参里(`selectUiVariable(state, key, defaultValue)`),移到声明处,单一真相 |
| **持久化分级落到声明上** | 三级分类从两处重复定义收成**变量声明的一个字段**,消掉 D-12 |

命令仍保留**批量**形态(一次原子写入单号 + 金额是真实场景),只是从
`Record<string, any>` 变成"声明句柄 → 值"的有类型批量。

⚠️ 将来接链路半边时,"这个变量要不要跨节点同步"也该是**声明上的一个字段** ——
但 §11 已排除链路,**现在不建**,只是把位置留对。

### 5.4 状态形状

```
uiState.surfaces[surfaceId] = {
    containers: Record<ContainerKey, { partKey, instanceId?, props? }>
    layers:     readonly { layerId, partKey, props?, openedAt }[]
}
uiState.variables = Record<DeclaredKey, Value>      // 按声明的持久化分级落盘
```

- 屏幕状态**随 slice 持久化** —— 重启回到原来那个 tab,这是"缓存 UI 状态"的应有之义;
- 层默认 `transient`;需要重启后重来的由业务显式重开;
- **workspace 只落一份 slice**:设备任一时刻只有一个 workspace,分两份是为被 §11 排除的链路预留。

### 5.5 catalog:只答"能显示什么"

```
CatalogEntry = {
  partKey · rendererKey · containerKey
  displayModes · workspaces · instanceModes     // 三个维度全部闭集(恢复 v1,修 v2 回退)
  title · description                            // 文案只在这里,不进状态
}
```

- **不含 React 组件**(渲染键→组件由 render 包自己的注册表解析,POC 已这么分);
- **重复 partKey 报错**(恢复 v1,修掉 v2 的静默覆盖);
- 无 `order` / 无 `readyToEnter` —— 队列删了,排序与前置条件都不再是 catalog 的事;
- 准入三维**只在枚举类查询时用**(如"这个容器里有哪些 tab 可显示"),**不做写入门**。

### 5.6 唯一仍待定:surface 的寻址键(Dexter 表示拿不准)

POC 用 **`displayMode`** 给 overlay 寻址(`primaryOverlays` / `secondaryOverlays`)。
而 `displayMode` 是**派生且易变**的:

```
C 形态单屏从机接上电源
  → resolvePowerRoleTarget 返回 VICE → displayRole CHIEF→VICE
  → resolveSurfaceDisplayMode 由 PRIMARY 变 SECONDARY
  → 读写两侧同时切到另一条 overlay 栈
```

⇒ **插一次电源线,已打开的弹窗当场消失,另一条栈里的陈旧条目浮现。**
两代 POC 都是这个形状(v1 `getTargetList`、v2 `getListEnvelope`)。

**我的建议:用 `displayIndex`(0 | 1,物理、稳定)做寻址键,`displayMode` 只参与"该显示什么"。**
角色变化时不隐式搬运状态,而是**发一条命令**,由业务决定关层还是换屏 ——
**这正是 §5.1 那条裁定的同一形态**(登出发命令、业务方明确指定),只是换个触发源。

**反方(需要你判)**:若产品语义就是"这块屏现在是副屏,就该显示副屏那套东西",
那么按 displayMode 寻址反而更直白,插电切换是**特性不是缺陷**。
这取决于你要的产品行为,我不替你定。

### 5.7 明确不做

| 项 | 为什么 |
|---|---|
| 屏幕队列 / `readyToEnter` / `indexInContainer` | Dexter 裁定:明确指定,不反推 |
| `screenReady` 闸门 | Dexter 裁定:意义不大 |
| `replaceScreen` / `resetScreen` | 冗余,`showScreen` 一条够 |
| 形态因子(MOBILE / DESKTOP) | v2s 全仓零命中;TER 是 POS 终端,形态固定。真出现再加一个闭集维度 |
| 屏幕缓存 / keep-alive | 纯渲染关注点(D-15),参数也应归 render 包 |
| 事件总线 | `TR-11` 禁止形态;automation 的对外协议推送是另一件事(D-16) |
| 虚拟键盘等渲染局部叠加 | 不进层栈(D-13)。进栈判据:**有身份、要被别处关闭、要参与恢复** |

### 5.8 与 POC 的差异一览

| 维度 | POC | 本设计 |
|---|---|---|
| UI 状态进 slice | ✅ | ✅ **保留(核心思想)** |
| 屏幕选择 | 队列 + `readyToEnter` 反推 | **业务 actor 明确 `showScreen`** |
| 屏幕命令 | `show` / `replace` / `reset` 三条 | **`showScreen` 一条** |
| uiVariable | 自由字符串键 + `unknown` 值 | **声明式、有归属、有类型、有默认值、有持久化分级** |
| 准入三维 | v1 强类型 → v2 退化成 `string[]` | **恢复闭集** |
| 注册表 | 模块级可变全局 | **安装期构建、不可变、重复报错** |
| 文案 | 注册表与状态各存一份 | **只在 catalog** |
| surface 寻址 | 按派生的 `displayMode` | **待定(§5.6)** |

### 5.9 上一版设计错在哪(留档)

| 我的主张 | 错因 |
|---|---|
| 步进交给 `workflow` | **从机制反推产品用途**。`readyToEnter` + index + findFirst 看着像向导引擎,实际是导航守卫(登录页)。workflow 是命令式编排,与之无关 |
| v1 不持久化 UI 状态 | 我断言"屏幕是业务状态的投影"。**对 tab / 导航位置根本不成立** —— 同一业务状态下可以在设置页也可以在订单页,导航位置是独立状态,理应缓存 |
| 不建 uiVariables | 为了甩掉队列,把跨组件共享值这个**精髓**一起否了。它与队列无关 |

**共同根因**:我在没有真实使用证据时,用机制形态推断产品意图 —— 这正是 `CLAUDE.md`
"不得从现有接口、表结构或旧页面反推用户任务"禁止的做法。

---

## 6 · 待办

- **§5.6 surface 寻址键**:唯一需要 Dexter 裁的产品语义问题。
- 其余各条已按裁定收敛,可直接进需求稿。

## 7 · 已闭缺口与仍缺证据

### 已闭(本轮补读)

| 原缺口 | 结果 |
|---|---|
| `epics` / `middlewares` 是否藏着屏幕副作用 | ✅ 否。18 槽 17 空,唯一非空是状态同步中间件(D-11)⇒ 能力清单完整 |
| `admin-console` 是否间接用 uiVariable | ✅ 否,零命中。但它**用了 `selectUiScreen`** ⇒ §3 已修正 |
| automation 是否依赖 overlay/screen 结构 | ✅ 否。`ui-automation-runtime` 对 ui-runtime 是**冗余依赖声明,源码零 import**;它自有 `screenKey` 概念(浏览器 DOM),与本包无关。但渲染侧 `OverlayHost` 把 `automationTarget: 'primary'\|'secondary'` 编进节点 id ⇒ 反而成了 D-1/D-2 的佐证 |
| `uiRuntimeV2ParameterDefinitions` 是什么 | ✅ 两个调优参数:`registry.cache-size-hint`(256)、`screen-container.cache-size`(2)。后者被 `ScreenContainer` 用作**已挂载屏幕的缓存深度**。⚠️ 这是渲染侧关注点,参数定义却放在 ui-state ⇒ 在 v2s 应归 render 包(§7.1 边界) |

### 仍缺证据 / 方法论限制(不得当成结论)

- **我的公共面统计方法有过一个缺口**:抽取导出时只匹配 `export {…}`,**漏了 `export *`**。
  这导致我一度把 `ui-automation-runtime` 的公共面读成"只有 `packageVersion`" ——
  它实际用 `export *` 导出了 `application` / `types` / `supports` 与六个 foundations,面很大。
  ⚠️ 已复核:**v2s 的 `display-context` / `state` / `platform-ports` 三个 index 全是显式具名重导出,
  零 `export *`** ⇒ 本文引用的 v2s 导出计数(含 D-1 承重的"没有 `selectDisplayMode`")不受影响。
  但本文引用的**其他 POC 包**导出面若来自同一方法,应视为**下界而非全集**。
- `ui-automation-runtime` 我读了其文件清单、`index.ts`、`eventBus.ts`,
  并全量确认它对 ui-runtime 零 import;**其余内部实现未读**。
- `ScreenContainer.tsx` 我读了缓存/复用/淘汰/过渡/自动化分槽与全部 ui-state 消费点,
  **未逐行读**其 300-540 行的自动化桥实现细节。已足以支撑 D-15 / D-17。
- `test-state-single.ts` 已读:**仅 15 行**,单进程壳,只打印 displayMode,**无实质证据**。
- 两代的同步行为判读仍是**静态推断**;链路半边在 v2s 被 §11 排除,标 `UNVERIFIED`。
  D-10 引用的 dual 夹具断言是 POC 仓内**源码文本**,我**没有运行过它**。
- 本文全部结论**未跑任何命令、未执行任何测试**。

## 8 · 本文修正记录(供追溯)

| 条目 | 首判 | 现判 | 触发 |
|---|---|---|---|
| 消费面 | 只有渲染包读状态 | **三个包读状态** | 行级 grep 漏抓多行 import |
| D-2 | POC 没有 surface 隔离 | **有,但只是渲染侧约定,内核不强制** | `uiRuntimeRootVariables` 两个根容器键 |
| D-3 | POC 用无类型 `string[]` | **v1 是强类型,v2 回退** | 读 `_old_` 的 `ScreenPartRegistration` |
| D-8 | 两代都没有"该恢复什么"的语义 | **有三级分类,只是没覆盖 overlay** | `UiRuntimeVariable.persistence` + `inputPolicies` |
| D-10 | 建了没人用 → 第一代残骸 | **跨节点共享 UI 值;TER 单 store 已免费解决 A/B** | v1 dual 夹具断言 |
| Q7 | 建议合并 | **`operation` 全栈死数据,可直接删** | `ScreenContainer` 零命中 + 唯一读取处只转抄 |
| automation 公共面 | 只有 `packageVersion` | **很大(`export *` 六个 foundations 等)** | 抽取正则漏了 `export *` |
