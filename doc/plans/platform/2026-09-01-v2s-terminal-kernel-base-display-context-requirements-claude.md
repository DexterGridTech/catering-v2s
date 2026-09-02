# TER `kernel.base.display-context` 需求（Claude）

| 字段 | 值 |
|---|---|
| 包 | `kernel.base.display-context`（`skeleton-graph.ts:33-38`，`plannedKind:'owner'`，batch 1） |
| 冻结输入 | Dexter 2026-09-01 的四形态模型与派生规则 · Q-1…Q-5（Dexter 原话「Q-1 到 Q-5 都按你的建议」，**即采纳作者建议成为裁定**，非独立提出）· 项目记忆 `terminal-architecture-and-stack-rulings` · `kernel.base.runtime` 需求 §2.4 / §2.4.1 / §4.8a / §7.1 |
| ⚠️ 裁定变更 | **Q-3 经两次变更后回到「第一版就做」** —— 09-01 曾以「无生产数据源」反转为不做，09-02 Dexter 质疑「没有生产入口不代表不能测试」，该反转**已撤销**。⇒ 电源路径在 v1，机制见 §4.5。其余 Q 条目不变 |
| v1 范围 | 见 **§4.0**。判据是「**今天能不能建成并被 focused test 跑通**」⇒ 电源全链 · `switchDisplayRole` · §4.6 ①③ · `getDisplayInfo` **都在 v1**；**唯一推迟 §4.6 ②**（`transport` 零声明，无从假造） |
| 前身 | 分析稿 `…display-context-requirements-analysis-claude.md`（推理过程已并入本文，分析稿不再单独维护） |
| 本轮出处 | fresh，v2s 仓根；**未运行任何命令**，全部为静态源码事实或明标推论 |

---

## 0 · 这份文档怎么读

**一 · POC 里每个东西都有产品用意，只是可能实现得不好。**
判读的职责是读懂那个用意，再判断 TER 要不要、以及实现得好不好。
⛔ **不得用「有没有生产调用」否定一项能力** —— 「零消费者」只能作为去查证产品用意的线索，不能作为结论。

**二 · 每条能力必须带判定**：`POC_ALREADY_HAS`（照写即重造）·
`POC_HAS_BUT_WORSE`（继承用意、换实现，**必须写清为什么换**）·
`FABRICATED`（POC 没有且给不出产品理由 ⇒ 删）。

**三 · 本文的推理过程是内容的一部分，不是背景。**
凡「换实现」「不做」「拒绝」，都必须能读到理由；只给结论不给推理的条目视为未完成。

**四 · 证据分档**：仓内静态事实 · 推论 · `UNVERIFIED_REQUIRES_EVIDENCE` · `DEXTER_DECISION`，四者不得混写。

---

## 1 · 包位置与可用能力（仓内事实，逐项亲验）

```
'kernel.base.display-context': {
  batch: 1,
  plannedKind: 'owner',
  dependencies: ['kernel.base.contracts', 'kernel.base.state', 'kernel.base.runtime'],
  devDependencies: [],
}
```

**下游消费者**（图中声明依赖它的三个包）：`kernel.base.ui-state` · `ui.integration.platform-console` · `assembly.android.pos-desktop`。

**可用的上游能力**（已收口，逐名核过）：

| 来源 | 能力 |
|---|---|
| `runtime`（63 项） | `selectRuntimeInstanceMode` · `RuntimeInstanceMode` · `setRuntimeInstanceModeCommand` · `SetRuntimeInstanceModePayload/Result` · `RuntimeRoleChangeEffect` · `defineCommand`/`defineActor`/`onCommand` · 两个执行上下文 |
| `state` | `WorkspaceKey='MAIN'\|'BRANCH'` · `WorkspaceRouteContext` · `createWorkspaceStateKeys` · `createWorkspaceActionDispatcher` · `toWorkspaceStateDescriptors` · `defineStateRuntimeSlice` |
| `contracts` | `CommandRouteContext`（单元 B 后为三闭集可选字段） |
| `platform-ports` | 🔴 **v1 需要这条依赖边**（`skeleton-graph.ts:33-38` 今天不含它，须加，见 §4.0）。已有：`DevicePort.getPowerStatus` / `subscribePowerStatus` / `unsubscribePowerStatus`，`PowerStatus = {source:'external'\|'battery'\|'unknown', charging:…}`（`types/device.ts:27-57`）。🔴 **须新增**：`getDisplayInfo()`（§7 T-6，Dexter 2026-09-02 裁定重开该包） |

🔴 **方向约束**：`runtime` **不能**反向依赖本包（runtime 需求 §2.4 已裁定）。
⇒ `instanceMode` 的**持有**永远在 runtime；`displayRole` 的持有、`displayMode` 与 `workspace` 的**派生**在本包。

---

## 2 · 四形态、两个输入、一条派生式

### 2.1 四形态（Dexter 2026-09-01）

| 形态 | 机器 / 屏 | JS | workspace |
|---|---|---|---|
| **A** | 单机单屏，单主屏 | 单 JS | MAIN |
| **B** | 单机双屏，主+副屏 | **单 JS** | MAIN（两屏共享） |
| **C** | 主副机各单屏，主+副屏 | 双 JS | MAIN |
| **D** | 主副机各单屏，**双主屏** | 双 JS | 主机 MAIN / **副机 BRANCH** |

B 的「单 JS」是项目记忆 `TER_SINGLE_VM_SINGLE_STORE_MULTI_SURFACE` 的直接后果：
**一个 ReactHost、一个 Hermes VM、一个 JS 线程、一个 store、多个 Root Surface**；
POC 的「副屏独立进程」跨进程广播协议**明令不搬**。

### 2.2 两个输入与它们的住址（🔴 被形态逼出来的唯一解）

| 输入 | 类型 | 住址 | 为什么不能换 |
|---|---|---|---|
| `displayIndex` | 闭集 `0 \| 1` | **Kotlin `initialProps` → React context**，per Root Surface | B 是单 VM 单 store 双 surface。**放进 slice 则两屏共用一个值** ⇒ 要么同 PRIMARY 要么同 SECONDARY ⇒ **B 结构性不成立** |
| `displayRole` | 闭集 `'CHIEF' \| 'VICE'`，默认 `CHIEF` | **设备级持久化 slice** | C↔D 是**运行期热切换**（副机拿下来接电当主屏）。走 props 就要 Kotlin 重启重传 ⇒ **热切换消失** |

⇒ **per-surface 的那个 `displayMode` 是「每 Root Surface 一个值」。**
⚠️ 但**不是只有这一个 `displayMode`** —— 冻结需求同时定义了一个**设备级**的，用途不同，见 §2.3。
本文首版把两者合并了，已在第一轮对抗审查更正。
per-surface 那份的存在理由，正是 runtime 需求 §2.4 那条 🔴 的根：
「T3 下一个 runtime 两块屏，runtime 无从知道这条命令来自哪块屏 —— 只有发起它的那个 Root Surface 知道」。

⚠️ `displayRole` 的命名按 **Q-2 裁定**取大写闭集 `'CHIEF' | 'VICE'`，
与 `MASTER/SLAVE`、`PRIMARY/SECONDARY` 同形；不用 `chief/vice` 小写，避免第三组词形。

### 2.3 🔴 两个 `displayMode`，不是一个 —— 冻结需求已经分开，本文首版把它们合并了

`kernel.base.runtime` 需求第 387 至 390 行原文：

> ⚠️ **T3 下两者并存、不冲突**：双屏设备只能是 MASTER（Dexter 2026-08-31 裁定），
> **设备级 `displayMode = PRIMARY`** ⇒ `workspace = MAIN`、两屏共享；
> 而两个 Root Surface 各自带 `PRIMARY`/`SECONDARY` 去盖命令的章。
> **设备级那份用于派生工作区，per-surface 那份用于命令归属** —— 用途不同，所以不打架。

⇒ 本包要产出**两个**值，住址与用途都不同：

| | 设备级 `displayMode` | per-surface `displayMode` |
|---|---|---|
| 用途 | **派生 `workspace`** | **盖命令的章**（`routeContext.displayMode`） |
| 输入 | 只有 `displayRole`（设备级没有 `displayIndex`） | `displayIndex` + `displayRole` + `instanceMode` |
| 形态 | **可以是 selector**（只读设备级 slice） | **必须是纯函数**，入参含 per-surface 值 |

```ts
// ⚠️ 2026-09-01 删除：selectDeviceDisplayMode（见 §4.0）
//    它是 selectDisplayRole 的双射（VICE↔SECONDARY）、零声明消费者，
//    却返回 DisplayMode 类型 ⇒ 与 per-surface 的 displayMode 类型碰撞，
//    正是 terminal-coding-standard §4-A 点名的反例「把 displayMode 改成从全局 state 读 ⇒ 两块屏的 overlay 会串」。
//    要显示「本机当前是副屏」直接读 selectDisplayRole。

// per-surface：纯函数，用于盖章
export const resolveSurfaceDisplayMode = (input: Readonly<{
  displayIndex: 0 | 1
  displayRole: DisplayRole
  instanceMode: RuntimeInstanceMode
}>): DisplayMode =>
  input.displayIndex === 1
    || (input.displayRole === 'VICE' && input.instanceMode === 'SLAVE')
    ? 'SECONDARY'
    : 'PRIMARY'
```

🔴 **`instanceMode` 这个第三输入是本轮对抗审查加的，理由必须写清**：
`displayRole` 与 `instanceMode` **是两份互相独立的持久化设备级状态**。
一台 C 副机（`SLAVE` + `VICE`）被重新部署成 B 主机（`MASTER`）后，
重启时 `displayRole` 仍持久为 `VICE` ⇒ 首版公式给出
`idx0 → SECONDARY`、`idx1 → SECONDARY` ⇒ **两块屏都不是主屏，设备无主屏**。
⇒ 加上 `instanceMode === 'SLAVE'` 的合取后，`MASTER` 下 `VICE` 不生效，
`idx0 → PRIMARY`、`idx1 → SECONDARY`，坏状态在**结构上消失**。
⚠️ **2026-09-01 更正：原文写「不采用 role-change effect 重置的修法」，与 Dexter 后续裁定相反，已作废。**
Dexter 裁定：**切 `instanceMode` 的时候都重置 `displayRole`**。

⇒ **两条都要，它们治的是两件不同的事**：
- **公式吃 `instanceMode`（结构）**：残留的 `displayRole` **算不出坏状态**，即使重置失败。
  这是上面那段论证，仍然成立，是地板；
- **切换时重置（Dexter 裁定）**：**存储里那个值不再是谎**。
  `displayRole` 是持久化的设备级值；一个「永远算不出坏状态、但存着错值」的持久状态，
  会在下一个读它的人那里咬人（诊断、留痕、以及任何未来把它当输入的地方）。

⚠️ 原文用「§3.2(3) 主张结构上不可能优于运行期守卫」来否决重置，**是把「优于」读成了「排斥」**。
§3.2(3) 说的是**同一个问题**上结构解优于守卫解；这里是**两个问题** —— 派生正确性与存储诚实性。

🔴 **2026-09-02 改为 `TR-11` 形态（Codex M-1）。原「role change effect + D-5 硬前置」整套作废。**

`TR-11` 把 `RuntimeModule.roleChangeEffects` **点名为应被替换的反例** ——
effect 列表即使改成「返回 action 数组」（D-5 当前方案），**仍然是 effect 列表**，
把它藏进模块工厂做成私有也**不改变机制类别**。

⇒ **正确形态**：

```
runtime 的角色写入成功提交之后
        ↓ runtime 派发自己定义的 internal「角色已变化」command（payload 至少带前后角色）
roleChangedCommand（★ 由 runtime 定义）
        ↓
本包的 RoleChangedActor          ← display-context 定义
        ↓ dispatchAction
重置 displayRole
```

⚠️ **三条约束，缺一即错**：
1. 🔴 **该 command 必须由 `runtime` 定义** —— 不能由本包定义后要求 runtime 反向依赖本包；
2. 🔴 **必须在角色写入成功提交之后派发** —— ⛔ **不得**让 runtime actor 与本包 actor
   **并发监听原始 `setRuntimeInstanceMode` 命令**当作「提交后通知」：
   runtime 的多 actor 执行是并发的，本包 actor 可能**先**重置，
   而 runtime actor 随后**拒绝**了角色切换 —— 副作用已经发生；
3. request ledger 等其它消费者**各自监听同一条 command**，不各开接缝。

⚠️ **这是对 `runtime` 的跨包要求**，见 §6 新增的 S-6；并**取代**门缺陷整改 D-5 的现有方案。

**设备级公式的四形态验算**（`role==='VICE' ? SECONDARY : PRIMARY`，只一个输入）：

| 形态 | role | 设备级 displayMode | instanceMode | ⇒ workspace |
|---|---|---|---|---|
| A | CHIEF | PRIMARY | MASTER | MAIN ✓ |
| B | CHIEF | PRIMARY | MASTER | MAIN ✓ 两屏共享 |
| C 副 | VICE | SECONDARY | SLAVE | MAIN ✓ |
| D 副 | CHIEF | PRIMARY | SLAVE | **BRANCH** ✓ |

**per-surface 公式的七行逐条验算**（`instanceMode` 按各形态取值）：

| 形态 | idx | role | instanceMode | ⇒ | 命中 |
|---|---|---|---|---|---|
| A | 0 | CHIEF | MASTER | PRIMARY | 都不命中 |
| B 主 | 0 | CHIEF | MASTER | PRIMARY | 都不命中 |
| B 副 | **1** | CHIEF | MASTER | **SECONDARY** | `idx===1` |
| C 主 | 0 | CHIEF | MASTER | PRIMARY | 都不命中 |
| C 副 | 0 | **VICE** | **SLAVE** | **SECONDARY** | `VICE && SLAVE` |
| D 主 | 0 | CHIEF | MASTER | PRIMARY | 都不命中 |
| D 副 | 0 | CHIEF | SLAVE | PRIMARY | 都不命中 |
| **坏状态**（B 设备残留 VICE） | 0 / 1 | VICE | MASTER | **PRIMARY / SECONDARY** | 第三输入挡住 ✓ |

### 2.4 与已冻结的 `workspace` 规则交叉验算

项目记忆 `terminal-architecture-and-stack-rulings.md:34`：`SLAVE && PRIMARY → BRANCH`。

| 形态 | instanceMode | displayMode | ⇒ workspace | 与 Dexter 表 |
|---|---|---|---|---|
| A | MASTER | PRIMARY | MAIN | ✓ |
| B 主 / 副 | MASTER | PRIMARY / SECONDARY | MAIN / MAIN | ✓ 两屏共享 |
| C 主 / 副 | MASTER / SLAVE | PRIMARY / SECONDARY | MAIN / MAIN | ✓ |
| D 主 / 副 | MASTER / **SLAVE** | PRIMARY / **PRIMARY** | MAIN / **BRANCH** | ✓ |

⇒ **`displayRole` 与所有既有裁定逐行自洽，没有推翻任何一条。**

⚠️ `workspace` **是设备级、两屏共享**（记忆 `:31`）。
B 下两 surface 共 store 天然共享 ✓；C/D 是两台机器各算各的 ✓。
🔴 **不得因为 `displayMode` 是 per-surface 就把 `workspace` 也做成 per-surface。**

---

## 3 · POC 对照（`topology-runtime-v3`，逐文件亲验）

### 3.1 `POC_ALREADY_HAS` —— 产品用意全部继承

| POC 位置 | 内容 |
|---|---|
| `features/slices/contextState.ts:6-16` | context slice：`localNodeId`·`displayIndex`·`displayCount`·`instanceMode`·`displayMode`·`workspace`·`standalone`·`enableSlave`·`masterLocator` |
| 同上 `:33-34` | `persistIntent:'never'` · `syncIntent:'isolated'` —— POC 的 context 是**派生投影**，不持久不同步 |
| `foundations/eligibility.ts:21-23` | `isManagedSecondary = displayCount > 1 && displayIndex > 0` |
| 同上 `:25-27` | `isStandaloneSlave = displayIndex === 0 && instanceMode === 'SLAVE'` |
| 同上 `:29-85` | **四条准入**，各返回 `{allowed, reasonCode}`：TCP 激活 · 切 SLAVE · 启用 slave · 改 displayMode |
| `foundations/powerDisplaySwitch.ts:4-23` | 仅 `standalone && SLAVE` 生效；**接电+PRIMARY→SECONDARY**；**断电+SECONDARY→PRIMARY**；否则 `null` |
| 同上 `:1-2` | 切换要走确认 alert（`…power-display-switch-confirm`） |

🔴 **两条我原本会自己发明、而 POC 已经想清楚的，必须点名继承**：
① **准入返回 `reasonCode` 而不是布尔** —— 拒绝要能对用户解释；
② **`displayMode` 切换要走确认，不是静默翻转** —— 平板拿起放下会误触。

⚠️ 接电/断电方向我核过与项目记忆一致：记忆写「副屏可拿下来、监听接电状态当主屏用」——
拿下来 = 断电 = 变 PRIMARY，与 POC 代码同向 ✓。

### 3.2 `POC_HAS_BUT_WORSE` —— 继承用意，换实现

#### (0) 🔴 2026-09-01 补：POC 是**两层**结构，本文首版只看见了一层

⚠️ **首版称本节「逐文件亲验」，实际只读了 30 余个文件中的 4 个**，而没读的那几个恰好推翻了两条判断。
本轮重读，实际读到的是：`features/slices/configState.ts` · `contextState.ts` ·
`foundations/runtimeDerivation.ts` · `foundations/powerDisplaySwitch.ts` ·
`features/actors/contextActor.ts` · `features/actors/powerDisplaySwitchActor.ts` ·
`application/createModule.ts`（共 7 个，覆盖本节全部结论）。

**POC 的真实形态是两层，不是一层：**

| 层 | 文件 | 形态 |
|---|---|---|
| **配置层（持久化、可写）** | `features/slices/configState.ts` | `patchConfigState` 用 `Object.assign(state, action.payload)` 逐字段打补丁；`persistIntent:'owner-only'` · `syncIntent:'isolated'`；**字段级持久化** `instanceMode` · `displayMode` · `enableSlave` · `masterLocator`，四个都是 `flushMode:'immediate'` |
| **上下文层（派生、不持久）** | `features/slices/contextState.ts` | `persistIntent:'never'` · `syncIntent:'isolated'`；每个 actor 在 `patchConfigState(...)` 之后**紧接着** `replaceContextState(buildContextState(context))`（`contextActor.ts:88/102/115/122/129` 五处同形） |

🔴 **而派生式本身不是「读一个可写值」，是「持久化覆盖 + 物理事实兜底」**（`runtimeDerivation.ts:23-27`）：

```
const standalone   = input.displayIndex === 0
const instanceMode = input.configState.instanceMode ?? (standalone ? 'MASTER' : 'SLAVE')
const displayMode  = input.configState.displayMode  ?? (standalone ? 'PRIMARY' : 'SECONDARY')
const enableSlave  = input.configState.enableSlave  ?? Boolean(input.displayCount > 1 && standalone)
```

⚠️ **这对本文 §3.2(3) 的措辞是实质修正**：说「`displayMode` 在 POC 是可写状态」**不完整** ——
它是**可空的持久化覆盖，缺省回落到物理事实**。POC 并非没有派生，
而是把派生**急切地物化进 `contextState` 这个 slice**；TER 的改法是把同一层派生
**改成 selector 惰性求值、不落 slice**。结论不变，但两者的差别不是「可写 vs 派生」，
而是「急切物化 vs 惰性求值」，这个说法才对得上源码。

✅ **`deriveTopologyV3Workspace`（`:6-14`）与本文 §2.3 的 `SLAVE && PRIMARY → BRANCH` 逐字一致**，
这一条首版是对的。
⚠️ `deriveTopologyV3RuntimeContext:19-21` 在 `displayIndex`/`displayCount` 非 number 时**直接抛**，
是硬前提，不是可选输入。

#### (0b) 🔴 电源：首个事件只播种，同值去重，只有跃迁才请求确认

`application/createModule.ts:49` 持有 `let lastPowerConnected: boolean | null = null`；
`:105-140` 的监听器分三支：

1. `lastPowerConnected === powerConnected` ⇒ **直接 return**（同值去重）；
2. `lastPowerConnected == null` ⇒ **只写入 `lastPowerConnected` 并记一条
   `power-display-switch-seeded` 日志（"Seeded topology power state without changing display mode"），
   不切换**；
3. 只有真正的跃迁才算目标并 `dispatchCommand(requestPowerDisplayModeSwitchConfirmation, ...)`。

🔴 **本文首版完全没有这条，必须继承。** 理由是结构性的：应用启动时 OS 会把**当前**电源状态
作为一个事件投递过来；没有播种这一步，那个初始事件会被当成跃迁，**每次启动都翻转一次屏身份**。

✅ 顺带证实本文 §4.5 的措辞收紧是对的：POC 这一步发的是
`requestPowerDisplayModeSwitchConfirmation`（**请求确认**），
真正改值的 `setDisplayMode` 由 `powerDisplaySwitchActor` 在收到
`confirmPowerDisplayModeSwitch` 后才发（`powerDisplaySwitchActor.ts:20-37`）。

#### (0c) hydrate 竞态：POC 用 install 期播种消掉，TER 形态不同

POC 的 `contextState` 是 `persistIntent:'never'`，且 `createModule.ts:72` 在 install 期
`replaceContextState(fullState)` **播种一次** ⇒ 重启后不存在「派生值陈旧到第一条命令为止」的窗口。

⚠️ **TER 不能照抄这个做法**，因为本文的 `displayMode` 是 **selector 惰性求值、根本不落 slice**，
没有需要播种的派生 slice。⇒ TER 的对应问题变成另一个：
**持久化的 `displayRole` 何时可读，相对于第一个 surface 的 `initialProps` 到达**。
`displayRole` 由 `preloadedState` 在 store 构造时注入（`TR-09` 写侧例外第 1 条），
而 `displayIndex` 走 props → context ⇒ **两者不同步到达**。
🔴 **详设必须写明：per-surface 派生式在 `displayIndex` 尚未到达时返回什么**，
不得让它在窗口期算出一个会被 UI 采信的值。

---

#### (1) 🔴 `displayIndex` / `displayCount` 进 slice —— TER 下结构性不可用

POC 这么做**在 POC 里是对的**：它的双屏是**每屏一个进程**，一个进程一个 store，
slice 里放一个值天然正确。

**TER 不同**（§2.2）⇒ 照抄则 B 形态不成立。
**换法**：`displayIndex` 只走 props → context，**永不入 slice**。

#### (2) `displayCount` 在 TER 是冗余的

POC 用 `displayCount > 1 && displayIndex > 0` 判受管副屏。
`displayIndex` 收成闭集 `0 | 1` 后，**`displayIndex === 1` 本身就蕴含「有第二块屏」**。
⇒ **本包的屏身份不引入 `displayCount`**。

⚠️ **2026-09-01 更新：上一句的逃生条款已被 Dexter 裁定启用，但 v1 不启用（§4.0）。**
原文写「真需要屏总数时另立字段并写明用途，不得让它兼任屏身份」——
Dexter 裁定的正是这个形态：**设备级需要「本机有几块屏」来拦住「双屏设备被整机切成 SLAVE」**
（§4.6 ① 与原 §7 T-5），而 `displayIndex` 是 per-surface 的，答不了这个问题。
⇒ **屏总数作为独立的设备级事实引入，来源是 `DevicePort.getDisplayInfo()`（见 §7 T-5/T-6）**，
**只在 `setRuntimeInstanceMode` 的准入判据里读一次，永不入 slice、永不参与屏身份判定**。
✅ **该准入属 §4.6 ①，v1 做**（Dexter 2026-09-02）⇒ v1 新增 `getDisplayInfo()`、并加 `display-context → platform-ports` 依赖边（§4.0）。
§3.2(1) 的结论不变：`displayIndex` 与屏总数**都不进 slice**。

#### (3) 🔴 `displayMode` 在 POC 是可写状态，在 TER 必须是派生值 —— 本包最重要的一条

POC 里 `displayMode` 被**两个来源**写：物理事实的投影（副屏 `displayIndex>0`）与
用户/电源触发的切换（`powerDisplaySwitch` 直接改它）。
POC 靠 `resolvePowerDisplaySwitchTarget:13` 的
`context?.standalone !== true || context.instanceMode !== 'SLAVE'` **运行期守卫**
挡住「受管副屏被切成主屏」。

**TER 把两个来源分开**：`displayIndex`（物理、props、**不可写**）+ `displayRole`（可写、slice），
`displayMode` 由二者派生。

**为什么更好（可证伪）**：B 的受管副屏 `displayIndex === 1`，
派生式里 `idx===1` 是**第一支短路** ⇒ **无论 `displayRole` 被改成什么，都算不出 PRIMARY**。
⇒ 「受管副屏不得被切成主屏」从**运行期守卫**变成**结构上不可能**。
POC 那条守卫被改错一次、或新增第二个写入点，保护就没了；派生式没有这个失效模式。

#### (4) `replaceContextState` 整体替换 reducer

`contextState.ts:22-24` 只有一个整体替换动作 ⇒ 谁写了哪个字段在 reducer 层不可分辨，
也无法给单字段配准入。
**换法**：本包只有 `displayRole` 一个可写字段，动作按字段定义；写入只经命令 + actor（`TR-01`）。

### 3.3 `FABRICATED` —— 我原本会写、但给不出理由的

| 想写的 | 判定 |
|---|---|
| `displayMode` 变化广播给其它 surface | **臆造**。B 里两屏各自从同一 store + 各自 props 派生，**不需要通知**；C/D 跨机靠 runtime 命令与 state 同步，不另建通道 |
| 本包持有 `containerKey` | **臆造**。记忆写明 `containerKey` **随命令传入**；`state` README 已裁定它是「同一 owner slice 内部的路由键」，不是物理轴 |
| 本包提供 `useDisplayMode()` React hook | **越界**。本包在 `kernel/base`，React 归 `ui/base`。本包只出纯函数与 selector，provider 归 `ui.base.render` |

---

## 4 · 本包要做什么

### 4.0 🔴 v1 范围（Dexter 2026-09-02 二次裁定，取代 09-01 的 Alt-B 收敛）

⚠️ **本节已重写。** 2026-09-01 曾按 Alt-B 把电源触发与 `switchInstanceMode` 整体推迟，
理由是「batch 1 没有生产数据源 / 没有生产调用方」。**Dexter 2026-09-02 质疑：
「没有生产入口，不代表不能测试吧？」——该质疑成立，原收敛过头，已撤销。**

**判据更正：**

| | |
|---|---|
| ❌ 原用的 | 「有没有生产数据源 / 调用方？」 |
| ✅ 应用的 | **「今天能不能建成，并被 focused test 完整跑通？」** |

**为什么原判据错**（本轮亲验）：⚠️ **2026-09-02 更正引证（Codex N-1）——
结论成立，但作者原先引的证据是错的。**
`runtime/test/testSupport.ts` 的 `createTestPlatformPorts` **只接受 `plainStorage` / `protectedStorage` / `events`**，
`:65` 的 `device: unavailableDevicePort` 是**硬编码**、注入不了假 `DevicePort`，
且该 helper **不是 runtime 的公开导出**（`runtime/src/index.ts` 零命中）。
**正确的可测性依据是另一条**：`platform-ports/src/index.ts:136` 公开导出 `createPlatformPorts`
⇒ **本包在自己的测试里造一套 fake ports 即可**，
⛔ 不得为本包去改 runtime 的私有 test helper。
⇒「batch 1 的端口恒返 `unavailable`」说的是**生产默认值**，不是**可测性**。
同理，「`routeContext` 在生产路径缺席」也不妨碍测试直接传入。

⚠️ 另一半理由（§4.5 算出的意图**无承载体**）**已被 Dexter 2026-09-02 的 command 裁定解掉**，见 §4.5。

### v1 范围（按「能不能建成并测通」重划）

| 项 | 判 | 依据 |
|---|---|---|
| `displayRole` slice · **五个纯函数**（§4.7 逐名） · `selectDisplayRole` | ✅ **做** | 无外部依赖 |
| `switchDisplayRole` 命令 + actor + 准入 | ✅ **做** | 测试直接传 `routeContext`，可端到端 |
| **电源路径**（端口订阅 → 命令 → actor → 写 `displayRole`） | ✅ **做** | 注入假 `DevicePort` 即可端到端；Android 原生实现等 `adapter.android.device`（batch 2），**不阻塞本包建成与测通** |
| §4.6 ③ 受管副屏拒 | ✅ **做** | 判据入参在手 |
| §4.6 ① 双屏不得 SLAVE + `DevicePort.getDisplayInfo()` | ✅ **做**（Dexter 2026-09-02 裁「做」） | 需重开 `platform-ports` 新增端口方法，见 §7 T-6 |
| §4.6 ② 已激活主机不得切 SLAVE | ⏸ **唯一推迟项** | 🔴 **不是选择，是物理上无法闭环**：`transport` 包今天只有 `dependencies.ts` / `index.ts` / `moduleName.ts` **三个文件**（纯骨架壳），全仓搜 `activation`/`activated` **零命中** ⇒ **没有接口、没有类型、没有 slice，没有东西可以假**。对照 `DevicePort`：接口已声明、只缺 Android 实现 ⇒ 可注入假实现。要做 ② 就得由本包反过来替 `transport` 声明契约，那是 `CLAUDE.md` 禁的「为假设中的未来需求提前设计」。见 §7 T-1 |
| **`RoleChangedActor`**（监听 runtime 的角色已变化 command，重置 `displayRole`） | ✅ **做** | `TR-11` 形态，取代原 role change effect（§2.3）。⚠️ 依赖 runtime 侧新增该 command，见 §6 S-6 |

🔴 **连带：本包需要 `display-context → kernel.base.platform-ports` 这条依赖边。**
今天 `skeleton-graph.ts:33-38` 的依赖是 `[contracts, state, runtime]`，**不含 platform-ports**。
按 §6 S-1b 同样的形态：kernel→kernel 合法（`runDependencyDirection` 只在 `dependencyLayer !== 'kernel'` 时抛），
三个文件约四行 —— `skeleton-graph.ts` · 本包 `package.json` · 本包 `src/dependencies.ts`。
⚠️ 这不是架构裁定，是普通改动。

⚠️ **唯一被推迟的是 §4.6 ②。** 恢复它时须与 `transport` 同批，并把对应测试从 §8 的 deferred 组移入 required 组。

---

### 4.1 `displayRole` slice

```
name:          kernel.base.display-context.display-role
state:         { displayRole: 'CHIEF' | 'VICE' }   // 默认 CHIEF
persistIntent: 'owner-only'
persistence:   [{ kind:'field', stateKey:'displayRole', protection:'plain', flushMode:'immediate' }]
syncIntent:    'isolated'
```

- **`flushMode:'immediate'` 是必须的**：与 runtime 角色 slice 同理 ——
  用户切成 VICE 后进程立刻崩，重启回 CHIEF 会让副机自认主屏，与真正的主屏打架。
- **`syncIntent:'isolated'`（Q-4 裁定：第一版不同步）**：两台机器各有各的 `displayRole`，
  同步它等于让主机覆盖副机的屏身份。对端需要知道的是 `instanceMode` 与 `workspace`，那两条已有通路。

### 4.2 三个派生函数，两种形态

```ts
// ⚠️ selectDeviceDisplayMode 已于 2026-09-01 删除，见 §4.0
resolveSurfaceDisplayMode({displayIndex, displayRole, instanceMode}): DisplayMode   // 纯函数（per-surface，盖章用）
resolveWorkspace({instanceMode, displayRole}): WorkspaceKey        // 直接收 role，不经 displayMode
```

🔴 **`resolveWorkspace` 收 `displayRole` 而不是 `deviceDisplayMode` —— 第三轮对抗审查改的。**
首版（第一轮改后）写的是 `{instanceMode, deviceDisplayMode}`，并配了一句
「必须喂设备级那份」的警告加一条测试。**但那是运行期约定，不是结构保证** ——
`DisplayMode` 这个类型两份是同一个，喂错 per-surface 那份**类型上完全合法**，
后果是 B 的两个 surface 算出两个 `workspace`，而 `workspace` 必须设备级共享（记忆 `:31`）。
⇒ 改收 `DisplayRole`：它与 `DisplayMode` **是两个不同的类型**，
per-surface 那份**在类型上就喂不进来**。
⚠️ 这与 §3.2(3) 的立场一致：**结构上不可能 > 运行期守卫**。
⚠️ **但不得再用这条去否掉 role-change effect 的重置**（本文第一轮曾如此，已于 §2.3 更正作废）——
那是把「优于」读成了「排斥」。派生正确性用结构解，存储诚实性用重置，**两件事、两个解**。
⚠️ 语义没变：设备级 `displayMode = (role==='VICE' ? SECONDARY : PRIMARY)`，
代进 `SLAVE && PRIMARY → BRANCH` 即 `SLAVE && role!=='VICE' → BRANCH`，与冻结规则等价。
⚠️ **2026-09-01 更正：`selectDeviceDisplayMode` 不保留，已删除。**
上一版留它作「展示用」，但它零声明消费者、且是 `selectDisplayRole` 的双射；
真正的代价是它**返回 `DisplayMode` 类型**——与 per-surface 的 `displayMode` 是同一个类型，
于是 `openOverlay({displayMode: selectDeviceDisplayMode(state)})` **类型上完全合法**，
B 形态下两个 surface 拿到同一个值 ⇒ **两块屏的 overlay 串**，
正是 `terminal-coding-standard` §4-A 逐字点名的反例。
本文第三轮把 `resolveWorkspace` 改收 `DisplayRole` 只堵住了**一个调用点**，
而这个 selector 对三个下游消费者全开。⇒ 删除，不是改名、不是加注释。

🔴 **`resolveSurfaceDisplayMode` 不得做成 selector，也不得把结果写进任何 slice。**
它的入参之一（`displayIndex`）是 per-surface 的，而 selector 只能读设备级 store。

**这条的执行机制是结构性的**：本包**不在任何 slice 里持有 `displayIndex`**
⇒ 写不出它的 selector 版本，除非把 `displayIndex` 放进 slice（本文明令禁止）
或去读别人的 slice（`TR-03` 挡住）。
⚠️ **措辞要精确**：本包**不持有** `displayIndex`，但 §4.4 的准入会**从每条命令的
`routeContext.displayMode` 读它的投影** —— 那是**每命令的入参**，不是设备状态，两者不矛盾。
⇒ **门的判据**：本包 slice 的字段精确集里**不得出现 `displayIndex`**。

### 4.3 形态切换命令 —— 🔴 一跳，不是两跳

runtime 的角色切换是**两跳**（`display-context` 的 `public` 带准入 → runtime 的 `internal` 写状态），
理由是**准入数据与写入点跨包**。

**本包的 `displayRole` 切换只需一跳**：准入所需的三项事实本包全部可得，
⇒ 一条 `public` 命令，其 actor 先判准入、再写字段。**不为对称而多造一跳。**

### 4.4 🔴 准入判据 —— 不需要 `displayIndex`，这一步是本文的关键推理

准入要拒的是「**受管副屏**」（B 的副屏，`displayIndex===1`）。
但 actor 跑在 runtime 里、只能读 store，**看不见 per-surface 的 `displayIndex`**。

⇒ **从 `routeContext.displayMode` 反推**（该值由发起命令的那个 Root Surface 盖章，见 §6 S-1）：

| 目标 | 判据 | 推理 |
|---|---|---|
| `CHIEF → VICE` | `instanceMode==='SLAVE'` **且** 本次命令的 `routeContext.displayMode==='PRIMARY'` | 当前 role 是 CHIEF；由派生式，此时 `SECONDARY` 只能来自 `idx===1` ⇒ **`SECONDARY` 即受管副屏 ⇒ 拒**。要求 `PRIMARY` 后再要求 `SLAVE`，恰好只剩 D 副机 ✓ |
| `VICE → CHIEF` | `instanceMode==='SLAVE'` | 当前 role 是 VICE ⇒ A/B 不允许改 role ⇒ 必是 C 副机 ⇒ 允许切回 ✓ |

🔴 **这张表的两行都建立在同一个前提上：「双屏设备不会是 SLAVE」。**

### 🔴 4.4a 所有 `CHIEF → VICE` 写路径的共同前置（2026-09-02 新增，Codex M-3）

⚠️ **`setRuntimeInstanceMode` 那一处的屏数检查只是「切换那一刻的 transition guard」，不是不变式。**
本文 §4.5 自己已经证明：单屏设备可**合法**切成 SLAVE，此后**热插第二块屏**
即可到达 `SLAVE ∧ 屏数 > 1`，**不违反任何一次切换准入**。
⇒ 只在 `switchInstanceMode` 查一次屏数是不够的。

**⇒ 以下条件提升为「任何把 `displayRole` 写成 `VICE` 的路径」的共同前置**，
**两条写路径都必须各自实时求值，不得复用上一次的结果**：

```
getDisplayInfo().status === 'succeeded'   且   displayCount === 1
```

| 写路径 | 现状 | 要求 |
|---|---|---|
| `switchDisplayRoleCommand` 的 actor | 只查 `instanceMode` 与 `routeContext` | 🔴 **加本前置** |
| `powerStatusChangedCommand` 的 actor | 纯函数收 `displayCount`，但**没规定谁在哪里求值** | 🔴 **actor 在处理命令时实时调 `getDisplayInfo()`**，不得由桥缓存后传入 |
| 🔴 **持久化 hydrate**（2026-09-02 补，Codex M-2） | **无人检查** | 见 §4.4b —— **这是第三条真实写入路径，前一版整个漏了** |

🔴 **hydrate 为什么也是写路径**：`state` 在**创建 store 之前**从持久层恢复，
把值作为 `preloadedState` 注入；runtime **之后**才 install 模块。
⇒ 持久化的 `displayRole = VICE` **可以在任何本包 actor 执行之前就进入 store**，
两条 actor 准入**一次都没跑**。

**可证伪路径**：单屏 SLAVE 下合法持久化 `VICE` → 接第二块屏 → 重启 →
hydrate 直接恢复 `VICE` → 两个 surface 都派生成 `SECONDARY` ⇒ **整机没有主屏**。
⚠️ 而现有的命令测试、端口失败测试、以及「重启后仍恢复 VICE」的**正向**测试**全都能通过**。

#### 🔴 4.4b 启动校验（2026-09-02 新增，Codex M-2）

**在 hydrate 完成之后、runtime 对外 `started` 或 UI 可渲染之前**，
对恢复出来的 `VICE` 用**新鲜的** `getDisplayInfo()` 重新验证一次。
⚠️ 形态照 `TR-11`：**校验入口是一条本包定义的 command + actor**，不是回调、不是 install 期的裸副作用。

| `getDisplayInfo()` 结果 | 处置 |
|---|---|
| `succeeded` 且 `displayCount === 1` | **保留 `VICE`** |
| `succeeded` 且 `displayCount > 1`，或 count 畸形 | 🔴 **改回 `CHIEF`** |
| **非 `succeeded`**（含 `unavailable`） | 🔴 **改回 `CHIEF`，并留 typed 诊断** ——（作者裁定，见下） |

🔴 **第三行的裁定（Dexter 2026-09-02 授权作者裁定）**：
- ⛔ **fail-start 出局** —— batch 1 的端口恒返 `unavailable`，那会让应用**永远起不来**；
- 「保留 `VICE`」不可取 —— 错成 `VICE` 的后果是**两屏都 `SECONDARY`、整机没有主屏**，正是本节要防的；
- ✅ **改回 `CHIEF`** —— 错成 `CHIEF` 的后果是「副屏显示主屏内容」，**可见、可恢复**。
⇒ **fail-closed 的方向是 `CHIEF`。**

⚠️ **已知代价，必须登记**：batch 1 端口恒 `unavailable` ⇒ **C 副机的 `VICE` 在有 Android adapter 之前不能跨重启存活**。
这是诚实的（我们验证不了前提），随 `adapter.android.device` 落地自动解除。写进 README 与 HANDOFF。

🔴 **连带：`TR-04` 的正向判据必须收窄。** 原「重启后 `displayRole` 仍是 VICE」
**只在「端口成功确认单屏」时成立**，否则它与本节的 fail-closed 规则直接冲突。

🔴 **fail-closed，三种情况一律不改状态**：
端口返回**非 `succeeded`**（含 `unavailable`）· `displayCount` **缺失或非法**（非正整数）· `displayCount > 1`。
⚠️ **不得把「测不出屏数」当成「不 > 1 ⇒ 放行」。**
⚠️ 与 §4.5 对 `PowerStatus.source === 'unknown'` 立的「必须显式不切换」是同一条立场，此处不得双标。

⚠️ **数据新鲜度**：`getDisplayInfo()` 必须在**处理命令时**调用。
桥在订阅回调里取到的屏数**只能用于日志**，不得作为准入依据 —— 热插与命令之间可能相隔任意长时间。

⚠️ 这仍是**运行期守卫**，不是结构保证（§3.2(3) 的立场）。
但它现在覆盖**全部**写路径，而不是只覆盖一处 ⇒ 残余风险从「一条路没守」变成「守卫本身失效」，
写进 README 与 HANDOFF。

原风险描述（保留，作为守卫失效时的后果说明）：
⇒ 若双屏设备被错误地整机切成 SLAVE，则 B 的主屏 surface 满足
`SLAVE && PRIMARY` ⇒ `CHIEF→VICE` 会被放行 ⇒ 设备 role 变 VICE
⇒ 两个 surface 都算出 `SECONDARY` ⇒ **整机没有主屏**。
⚠️ **T-5 与本节是同一个根因，闭一个即闭两个** —— **T-5 已于 2026-09-01 关闭**（`getDisplayInfo()`），
所以本节的准入表现在有强制手段。
⚠️ 但仍须写进 README 与 HANDOFF：**这是运行期守卫，不是结构保证**；
守卫失效时上面那条坏状态路径依然存在，只是有了明确的责任人。

🔴 **`routeContext.displayMode` 缺失（`null`/`undefined`）⇒ typed reject。**
理由不是洁癖：缺章意味着**判据的一半不存在**，此时放行等于对受管副屏无保护。
⚠️ 代价必须写明：**在 `ui.base.render` 的盖章能力（S-1）建成之前，本命令在生产路径上恒被拒**。
这是可接受的 —— 那时也还没有 UI 能发它；测试可显式传 `routeContext`。

**准入结果形态**（继承 POC 用意）：

```ts
type DisplayContextEligibility = Readonly<{
  allowed: boolean
  reasonCode: DisplayRoleChangeReasonCode
}>
type DisplayRoleChangeReasonCode =
  | 'managed-secondary'          // 受管副屏，不得改
  | 'master-instance'            // 本机是 MASTER，不得改
  | 'missing-display-route'      // routeContext.displayMode 缺失
  | 'allowed'
```

⚠️ **Q-5 裁定：`reasonCode` 闭集先留本包**，不进 contracts；等第二个消费者出现再上提。

### 4.5 电源触发的切换 —— ✅ **v1 做**（Dexter 2026-09-02 定机制并裁「可闭环即做」）

⚠️ **本节的推迟标注已撤销。** 09-01 曾以「batch 1 收不到电源事件」推迟，
但那说的是**生产默认值**——测试可注入假 `DevicePort`，整条链可闭环。
⚠️ **注入路径以 §4.0 的更正为准**：用 `platform-ports/src/index.ts:136` 公开导出的 `createPlatformPorts`
在**本包自己的测试**里造 fake ports；
⛔ **不是** runtime 的 `createTestPlatformPorts`（它 device 硬编码、且非公开导出），
也**不得**为本包去改 runtime 的私有 test helper。Android 原生实现等 `adapter.android.device`（batch 2），
**不阻塞本包建成与测通**。

#### 🔴 机制（Dexter 2026-09-02 裁定）

原设计让本包订阅端口、算出一个「意图」，而那个意图**在公开面里没有承载体**（Codex M-3）。
Dexter 裁定的正确形态是：**把电源变化做成 command，由 actor 监听处理并写 `displayRole`**
—— 写路径回到 `command → actor → dispatchAction` 这条唯一合法路上，
**不需要发明「意图」，也不需要 `TR-01` 例外**。

```
DevicePort.subscribePowerStatus   ← install 期订阅，桥在本包
        ↓ 桥：播种 / 同值去重 / 翻译 PowerStatus → 本包 payload
powerStatusChangedCommand         ← 本包定义
        ↓
PowerStatusActor                  ← 本包定义
        ↓ dispatchAction
displayRole slice
```

⚠️ **command 的定义点必须是本包，不是 `platform-ports`。** 亲验：
`CommandDefinition` 住在 `runtime/src/types/command.ts:34`、`defineCommand` 由 `runtime/src/index.ts:14` 导出，
而 **`platform-ports` 的依赖只有 `contracts`** ⇒ 它 import 不到 runtime。
让端口定义 command 会使**最底层的包反向依赖 runtime**（22 个包里 16 个依赖 platform-ports），
方向倒置。⇒ Dexter 裁定的**意图**（电源变化走 command）落在本包实现。

⚠️ **payload 用本包自己的类型**（如 `{ powerSource: 'external' | 'battery' | 'unknown' }`），
值域抄自 `platform-ports/src/types/device.ts:28` 的 `PowerStatus.source` 但**不 import 它**，
桥在订阅回调里翻译一次。

⚠️ 🔴 **桥必须继承 POC 的播种与去重**（§3.2(0b)，`createModule.ts:49,105-140`）：
同值去重 · **首个事件只播种不切换** · 只有跃迁才派发命令。
缺播种这一步，OS 在启动时投递的当前电源状态会被当成跃迁，**每次启动翻转一次屏身份**。
播种状态（`lastPowerSource: string | null`）的**持有点是桥**，不入 slice。

✅ **已裁定（2026-09-02，见 §4.5 下方「确认步已裁定」段）**：POC 在派发前有一步 **UI 确认**
（`requestPowerDisplayModeSwitchConfirmation` → 用户确认 → `setDisplayMode`）。
Dexter 2026-09-02 的裁定原话是「actor 监听处理这个 command，然后设置 displayRole」，**没有确认步**。
是有意去掉，还是确认仍归 UI、actor 只处理已确认的那条？
⇒ Dexter 2026-09-02「**按 command 模式修复**」已定：**v1 无独立确认步**。
将来若要加确认，它自己也是一条 command（`TR-11`），**叠加不返工**。

- 端口已存在：`DevicePort.subscribePowerStatus`（`platform-ports/src/types/device.ts:55`）。**本包不新建端口。**
- 纯函数 `resolvePowerRoleTarget({powerSource, instanceMode, displayRole, displayCount})`：
  🔴 **仅 `instanceMode==='SLAVE'` 且 `displayCount === 1` 生效**；
  ⚠️ **`displayCount` 由 actor 在处理命令时实时调 `getDisplayInfo()` 求得**（§4.4a），
  **不得由桥缓存后传入** —— 桥取到的值只能进日志；
  `source==='external'`（接电）且当前 `CHIEF` ⇒ 目标 `VICE`；
  `source==='battery'`（断电）且当前 `VICE` ⇒ 目标 `CHIEF`；其余 ⇒ `null`。
- 🔴 **`source==='unknown'` 一律返回 `null`。** POC 的入参是布尔 `powerConnected`，没有第三态；
  TER 的 `PowerStatus.source` 有 `'unknown'`，**必须显式不切换**，否则会把「读不到电源状态」当成断电而误翻转屏身份。
⚠️ **`displayIndex===0` 这半已于 2026-09-01 再次移除，理由变了两次，记录完整过程：**
  POC 的守卫是 `context?.standalone !== true || context.instanceMode !== 'SLAVE'`
  （`powerDisplaySwitch.ts:13`）。

  ⚠️ **2026-09-02 更正归因（Codex S-1）**：本文一度称 `standalone` 在 POC 里「**就是单屏判据**」，
  **那是误读**。`runtimeDerivation.ts:23` 只是 `const standalone = input.displayIndex === 0`，
  且 `host-runtime-rn84/src/application/createApp.ts` 同样只按 `displayIndex === 0` 构造它、
  **不检查 `displayCount`** ⇒ 它表达的是「**当前是 index 0 / main surface**」，
  **证明不了设备只有一块屏**。
  ⇒ 论证必须拆成两段：
  **POC 事实** —— `standalone` 由 `displayIndex === 0` 派生；
  **TER 选择** —— 基于单 VM 多 surface 与「双屏 SLAVE 会没有主屏」的风险，改用设备级 `displayCount === 1`。
  这是**产品语义上的收敛，不是对 POC 守卫的忠实翻译**。
  首版只留后半，第二轮对抗审查以「`SLAVE` 蕴含单屏是模型推论不是结构保证」为由补回。

  🔴 **但它在设备级不可求值。** 电源事件来自 `DevicePort.subscribePowerStatus`，是**设备级订阅**；
  而 `displayIndex` 是 **per-surface** 的、随每个 surface 的 `initialProps` 到达。
  双屏设备上同时存在 `0` 与 `1` 两个值 ⇒ **设备级处理器没有单一的 `displayIndex` 可读**，
  这个入参在调用点填不出来。

  🔴 **但保护本身必须留下 —— 换入参，不是删保护。**
  ⚠️ 本文一度以「T-5 关闭 ⇒ `SLAVE` 蕴含单屏」为由把整个合取项删掉，**那是错的**：
  §4.6 ① 是 `switchInstanceMode` **那一刻**的 transition guard，**不是不变式**，
  而 `instanceMode` 是**持久化**的设备级值。
  ⇒ 合法的单屏 SLAVE 之后**热插第二块屏、或整机重新部署**，
  即可到达 `SLAVE ∧ 屏数 > 1`，**且不违反 ①**。
  此时电源接电触发 `CHIEF→VICE`，按 §2.3 的 per-surface 公式：
  `idx1` 命中第一支 ⇒ `SECONDARY`；`idx0` 命中 `VICE ∧ SLAVE` ⇒ **也 `SECONDARY`**
  ⇒ **整机没有主屏** —— 正是 §2.3 M-2 用第三输入结构性消掉的那个坏状态，从电源路径重新灌回来。

  ⇒ **正解**：把 per-surface 的 `displayIndex === 0`（设备级不可求值）
  换成设备级的 **`displayCount === 1`**（`getDisplayInfo()` 已把数据源送到手边，见 T-6）。
  两个问题各自解决：可求值性靠换入参，保护靠保留合取项。

  ⚠️ `displayCount` 在此处**只作判据入参，不入 slice、不参与屏身份判定**（与 §3.2(2) 的口径一致）。

🔴 **2026-09-02：旧的「意图链」整段删除（Codex M-1）。**
本节一度同时写着两条互斥的链 —— 上面的 command 链，与「本包只发意图、由 UI 确认后再发角色变更命令」。
两者不能同时实现，且两种互斥实现都能引用本文自证正确。**只保留 command 链。**

**确认步已裁定：v1 无独立确认步。** Dexter 两次表述一致 ——
2026-09-02 裁定原话「actor 监听处理这个 command，然后设置 `displayRole`」，
及后续「**按 command 模式修复**」。⇒ 桥直接派发 `powerStatusChangedCommand`，
actor 处理并写 `displayRole`，**中间没有待确认的中间态**。
⚠️ 与 POC 分歧已知：POC 有一步 `requestPowerDisplayModeSwitchConfirmation`。
分歧可接受的理由：确认是**用户交互关注点**，将来要加时它自己也是一条 command
（`TR-11`：确认动作 → command → actor），**不改变本节机制**，是叠加不是返工。

⛔ **不得**为电源路径开「`routeContext` 缺失时跳过准入」的旁路 ——
那等于任何人省掉 `routeContext` 即可绕过准入。

⚠️ **交付措辞边界（Codex N-2）**：runtime 今天只把调用方传入的 `routeContext` **原样冻进命令、不校验来源**
（`createCommandDispatcher.ts`）。⇒ 测试里手工传 `routeContext` **只能证明本包的判定逻辑**，
**证明不了生产来源可信**。
⛔ 交付时**不得**表述为「生产 route 不可伪造」或「用户端到端已闭环」；
Root Surface 自动盖章是**跨包接缝**（§6 S-1），在它建成前这条准入的输入**只能被信任、无法被校验**。
⚠️ 电源命令**不经过 §4.4 的 `routeContext` 准入**（它没有发起 surface），
它的准入是 §4.5 自己那套：`instanceMode === 'SLAVE'` **且**实时屏数为 1（见下）。
#### 🔴 4.5a 默认 `unavailableDevicePort` 下的 install 行为（2026-09-02 新增，Codex S-1）

生产默认 `unavailableDevicePort.subscribePowerStatus` 返回
`{status:'unavailable', reason:'ADAPTER_NOT_INJECTED'}`（`platform-ports/src/defaults/unavailableDevice.ts:12-17`），
而 runtime 会 `await` 模块 install（`createRuntimeLifecycle.ts:87-90`）。
⇒ **不写死就会二选一地错**：当成异常 ⇒ Android adapter 落地前 runtime 起不来；
静默吞掉 ⇒ 生产的电源能力缺失完全不可观测。

**冻结如下**：

1. 🔴 默认 `unavailableDevicePort` 下，**runtime 与本模块的 install 不得失败、不得抛**；
2. **不产生 `subscriptionId`**，**不派发任何电源命令**；
3. 🔴 **必须留下一条 typed 诊断**，携带端口返回的 `reason`（此处为 `ADAPTER_NOT_INJECTED`）——
   不得静默；
4. 释放路径对「从未订阅成功」必须是**幂等无操作**，不得因无 `subscriptionId` 而抛。

⚠️ 这四条都要有 focused test；再用 fake `DevicePort` 覆盖正常订阅、播种、去重与释放。

- 🔴 **要持有的是 `subscriptionId`，不是一个取消函数** ——
  `subscribePowerStatus` 返回 `PortResult<{subscriptionId}>`，
  释放要拿它去调 `unsubscribePowerStatus`。首版措辞不准，已更正。
  runtime 需求 §4.5b 已立同类规矩：install 期注册的生命周期资源必须统一持有，且有仅供测试的释放入口。

### 4.6 角色切换两跳链的**第一跳** —— ✅ **v1 做 ①③，仅 ② 推迟**（见 §4.0）

⚠️ **09-01 的整体推迟已撤销。** ① 的数据源由 `getDisplayInfo()` 提供（Dexter 2026-09-02 裁「做」，见 §7 T-6）；
③ 的判据入参在手。**唯一推迟的是 ②**，理由见 §4.0 表末行（`transport` 零声明，无从假造）。

runtime 需求 §4.8a ② 画了这条链，**上半截一直缺**：

```
用户点「切换为副机」
  → [public]  display-context 的 switch-instance-mode   ← 本包提供，带准入
      → [internal] runtime 的 set-instance-mode          ← 已存在
```

- 准入三条：
  ① 🔴 **双屏设备不得整体切成 SLAVE。** Dexter 2026-08-31 裁定
     「双屏设备不能整体作为 pair 的副机 ⇒ **副机必为单屏设备**」
     （runtime 需求第 258、1523、2770 行三处）。
     ⚠️ **本文首版只写了「受管副屏一律拒」，那是漏的** ——
     受管副屏拒只拦住**从副屏 surface 发出**的那条命令；
     B 的**主屏** surface 发同一条命令时 `routeContext.displayMode === 'PRIMARY'`，
     会被放行 ⇒ **双屏设备整机变 SLAVE，直接违反裁定**。
     ✅ **2026-09-01 更新：判据已有数据源。** 调 `DevicePort.getDisplayInfo()` 取设备级屏数，
     **屏数 > 1 ⇒ 拒**。这与「受管副屏拒」是两条独立判据：前者拦整机，后者拦单屏。
     ⚠️ 依赖 `platform-ports` 新增该端口方法（§7 T-6），**本包第一版与该能力同批交付，不得先上无判据的版本**。
  ② **已激活主机不得切 SLAVE**（POC `getSwitchToSlaveEligibility:45-56` 的用意继承）。
     ⚠️ 「已激活」的数据源是 TCP 激活状态，**归 `transport`/topology，本包读不到** ⇒ §7 欠账 T-1。
  ③ 受管副屏一律拒（`routeContext.displayMode === 'SECONDARY'` 且当前 role 为 CHIEF）。
  🔴 **2026-09-02 更正（Codex M-2）：v1 必须通过 `getDisplayInfo()` 完成 ①。**
  原文写「第一版只有 ③ 可执行，①② 都缺数据源」是收窄期残留，与 §4.0 / T-6 / required tests 相反，已删。
  ⇒ **v1 做 ① 与 ③；唯一 deferred 是 ②（activation）。**
  README 与 HANDOFF **只登记 ②**，**不再登记「双屏 SLAVE」欠账** —— 它已被 ① 拦住。
- 🔴 **不得把 runtime 的 `internal` 命令改成 `public` 来省这一跳** ——
  那正是 runtime 需求 §4.8a ② 论证过要避免的「任何 UI 都能绕过准入直接切角色」。

### 4.7 本包公开面（草案）

| 组 | 导出 |
|---|---|
| 元数据 3 | `moduleName` · `dependencyModuleNames` · `devDependencyModuleNames` |
| 类型 | `DisplayRole` · `DisplayMode` · `DisplayContextEligibility` · `DisplayRoleChangeReasonCode` |
| 纯函数 | `resolveSurfaceDisplayMode` · `resolveWorkspace` · `getDisplayRoleChangeEligibility` · `resolvePowerRoleTarget` · `getSwitchInstanceModeEligibility` |
| selector | `selectDisplayRole`（**唯一**） |
| 命令 | `switchDisplayRoleCommand` · `switchInstanceModeCommand` · **`powerStatusChangedCommand`**（§4.5） |
| 模块 | 本包的 `RuntimeModule` 工厂 |

🔴 **不在公开面的两项（Codex S-2，已采纳更小方案）**：

| 项 | 归属 | 验收改法 |
|---|---|---|
| ~~role change effect~~ | **已删除**（`TR-11`，见 §2.3） | 改为 `RoleChangedActor`，走 actor 组，**不是私有 effect** |
| **电源桥**（订阅 + 播种 + 去重 + 翻译） | **模块 install 内部私有**，不导出 | 注入假 `DevicePort`，断言首个事件不派发命令、同值不重复派发、跃迁派发一次 |

⚠️ **2026-09-02：原「role effect 形态随 D-5、且以 D-5 已实施为硬前置」整段作废**（`TR-11`，§2.3）。
本包不再依赖 `roleChangeEffects` 这条接缝的任何形态。
🔴 **新的硬前置换成一条跨包要求**：`runtime` 须在角色写入**成功提交后**派发它自己定义的
「角色已变化」`internal` command（§6 S-6）。**该 command 到位前，本包的 `RoleChangedActor` 无法实施。**
⚠️ 这同时**取代**门缺陷整改 D-5 的现有方案 —— D-5 让 effect 返回 action 数组，
比现状好但**仍是 `TR-11` 禁止的 effect 列表**。
⚠️ **`selectDeviceDisplayMode` 已删**（§4.2）⇒ **设备级 `displayMode` 不再有 selector**；
要展示「本机当前是副屏」直接读 `selectDisplayRole`。
per-surface 那份是纯函数，永不入 slice（§2.3、§4.2）。
⚠️ 精确数目留详设定，**但集合必须手写、进静态门**。

---

## 5 · 明确不做

| 不做 | 为什么 |
|---|---|
| 任何 React 组件 / hook / provider | 本包在 `kernel/base`，React 归 `ui/base` |
| `displayIndex` 进 slice | §2.2 / §3.2(1)：B 形态会结构性不成立 |
| `displayCount` **进 slice / 参与屏身份** | §3.2(1)(2)：屏身份用闭集 `0\|1` 的 `displayIndex` 即足。⚠️ 但**屏总数作为设备级准入入参 v1 就要用**（§4.6 ① 与 §4.5 的守卫），只是**只读一次、永不入 slice、不参与屏身份判定** |
| `displayMode` 进 slice 或做成 selector | §4.2：入参是 per-surface 的 |
| 跨 surface 广播 · 跨机同步 `displayRole` | §3.3 · Q-4 |
| TCP 激活 / 连接 / 重连 / master locator | POC 把拓扑连接与上下文混在一包；TER 已拆开，连接归 `transport`/topology |
| `containerKey` | §3.3 |
| 三屏及以上 | `displayIndex` 闭集 `0 \| 1`；扩屏是一次显式类型变更 |
| 确认交互的呈现 | §4.5：v1 **无独立确认步**（已裁定）；将来若加，确认动作自己也是一条 command（`TR-11`），**呈现**仍归 UI |

---

## 6 · 跨包接缝（本包不做，但缺任一个形态就不成立）

| # | 对手方 | 内容 |
|---|---|---|
| **S-1** 🔴 | `ui.base.render` + **`ui-state`** | **每个 Root Surface 在其发出的所有命令上自动盖 `routeContext` 的 `displayMode` 与 `workspace`**。**不得让业务组件自己传** —— 漏一处就静默写错屏（runtime 需求 §2.4 原文）。runtime 侧已就绪（`createLifecycleEmitter.ts:134` 读 `routeContext?.displayMode`；单元 B 的 ledger 从 `routeContext?.workspace` 取请求级 workspace）。⚠️ **本包 §4.4 的准入直接依赖它** |
| **S-1b** ✅ | `ui.base.render` | ⚠️ **本行已于 2026-09-01 重写，原「必须由 `ui-state` 转出」的转接层设计整个作废。** 原判断说「⛔ 不建议新增 `ui.base.render → display-context` 的图出边，那要改依赖结构、需单独裁定」——**已证伪**：亲验 `tools/terminal-skeleton/check-static.mjs` 的 `runDependencyDirection`，对 `ui.*` 模块**只禁 `dependencyLayer === 'adapter'`**，ui→kernel 一律不抛。⇒ `ui.base.render → kernel.base.display-context` **是一条合法的普通边**，加它需要改三个文件约四行（`skeleton-graph.ts`、该包 `package.json`、该包 `src/dependencies.ts`），**不是架构裁定**。⇒ **直接加边，`ui.base.render` 直接调本包的三个派生函数。** ⛔ 仍不得让 `ui.base.render` 自己实现派生（那是第二份公式）。⚠️ 原设计发明的 `ui-state` 转接层是「只为洗依赖而存在的中间层」，`ui-state` 对那三个函数**没有任何业务所有权** |
| **S-2** 🔴 | `ui-state` | **每块屏的 UI 状态分片**。B 下单 store 双 surface，控件裸写 `useSelector` 两屏会串。需要由 context 注入 surface 键的读取面（如 `useSurfaceSelector`）。**控件仍对 displayMode 无感，但必须用它** |
| **S-3** ✅ | `ui.base.render` | 该包依赖精确集为 `[platform-ports, runtime, ui-state]`，**不含 contracts** ⇒ 拿不到 `CommandRouteContext` 类型。⚠️ **与 S-1b 同一形状、同一结论**：`ui.base.render → kernel.base.contracts` 同样是合法的 ui→kernel 边，**直接加**，不经任何转出。两条一并处理 |
| **S-4** | `ui-state` / `ui.base.render` | **下游不得对缺失 route 抛错** —— 无发起 surface 的命令 route 为 `null`，属设备级、两屏可见 |
| **S-5** | Kotlin / `assembly.android.pos-desktop` | `initialProps` 逐 surface 传 `displayIndex`。**本包不定义这条通道**，只定义它到达 JS 后的类型与用法 |

| **S-6** 🔴 | `kernel.base.runtime` | **角色写入成功提交后，派发一条 runtime 自己定义的 `internal`「角色已变化」command**，payload 至少带 `previousMode` 与 `nextMode`。⚠️ 三条约束：① **由 runtime 定义**（本包不能反向要求 runtime 依赖自己）；② **必须在提交之后**——⛔ 不得让多个 actor 并发监听原始 `setRuntimeInstanceMode` 命令冒充「提交后通知」，那样本包 actor 可能先重置而 runtime 随后拒绝，副作用已发生；③ 其它消费者（如 request ledger）各自监听同一条，不各开接缝。⚠️ **本条取代门缺陷整改 D-5 的现有方案**（`roleChangeEffects` 返回 action 数组仍是 `TR-11` 禁止的 effect 列表）|

🔴 **S-1 与 S-2 缺任一个，B 与 D 形态都不成立**（runtime 需求 §2.4 原文）。

---

## 7 · 跨包欠账

| # | 欠账 | 落点 |
|---|---|---|
| **T-1** 🔴 | **「已激活主机不得切 SLAVE」（§4.6 ②）的数据源缺席** —— TCP 激活状态归 `transport`/topology。⚠️ **不只是「读不到」，是「零声明」**：`transport` 包今天只有 `dependencies.ts` / `index.ts` / `moduleName.ts` 三个文件，全仓搜 `activation`/`activated` 零命中 ⇒ **没有接口可假造，测试里也闭环不了**（对照 `DevicePort`：接口已声明、只缺实现）。⇒ **§4.6 ② 是本包唯一的推迟项**；v1 做 ① 与 ③ | `transport` / topology |
| **T-2** | runtime 需求 §7.1 的措辞要更正：「设备级 **`displayMode`** 的持有…**它就是 T1↔T2 的形态开关**」—— **开关是 `displayRole`**，`displayMode` 是派生值 | runtime 需求正本 |
| **T-5** ✅ | **已关闭**（Dexter 2026-09-01 定数据源、2026-09-02 裁「做」）： 设备级「本机有几块屏」的来源定为 **`DevicePort.getDisplayInfo()`** —— 一个**新增的独立端口方法**，返回屏幕的丰富信息（屏数、物理尺寸、分辨率等），不是把屏数塞进既有方法。本包在 `setRuntimeInstanceMode` 准入处调用它，判「屏数 > 1 ⇒ 不得设为 SLAVE」。⚠️ **这是 `kernel.base.platform-ports` 的新增能力**，落点见下方 T-6 | `platform-ports`（能力）+ 本包（消费） |
| **T-6** 🔴 | **v1 必做（Dexter 2026-09-02 裁定重开 `platform-ports`）。**<br>🔴 **契约须冻结后才可实施（Codex S-2）**，当前只写「屏数、物理尺寸、分辨率等」**不足以实施**。至少要定死：① 完整方法签名与 `timeout`（与既有 `DeviceCall` 同形）；② **`displayCount` 的语义** —— 指**已连接屏**、**活跃屏**还是**可渲染 surface**？是否计入内置屏与虚拟屏？③ 合法范围（正整数，`0` 与非整数按畸形处理）；④ 尺寸/分辨率的单位；⑤ **畸形 `succeeded` 数据的处置** —— 与端口非 `succeeded` **同样 fail-closed**（§4.4a）。<br>✅ **已裁定（Dexter 2026-09-02 授权作者裁定）：v1 只冻结 `displayCount`（候选 A）。**<br>理由：贵的是**方法本身** —— 新端口方法 + `portMethods` 与 `publicExports` 两处 invariant + `src/index.ts` 导出 + `public-surface.typecheck.ts` 夹具，这一次成本两种选择都要付；而**往已存在的返回类型上加字段**很便宜：`portMethods` 列的是**方法名**（不变）、`publicExports` 列的是**符号名**（不变），只动 `types/device.ts`。且零消费者的字段**无法验证** —— 没人知道 adapter 填得对不对。<br>⚠️ 与 Dexter 2026-09-01 原话「返回屏幕的丰富的信息、物理尺寸、分辨率等等」的差异**已知且有意**：将来真有消费者时**追加字段**即可，不需要再次重开端口。<br>🔴 **`displayCount` 须逐项定死**：语义（**已连接的物理屏数**，不含虚拟屏与投屏）· 类型（正整数）· 合法范围（`>= 1`；`0`、非整数、缺失一律按**畸形**处理并 fail-closed）。**`DevicePort.getDisplayInfo()` 的新增**：`DevicePort` 今天只有 `getDeviceInfo` · `getSystemStatus` · `getPowerStatus` · `subscribePowerStatus` · `unsubscribePowerStatus`（本轮亲验 `platform-ports/src/types/device.ts:51-57`）。新增须同时改：端口类型、`unavailableDevicePort` 的对应条目、以及 platform-ports 的 `terminal-invariants.json`（`publicExports` 与 `portMethods` 两处）。⚠️ Dexter 原话：platform-ports「不是永久收口，应该改的时候必须改」 | `platform-ports` |
| **T-3** | 电源事件的**原生实现**（Android `subscribePowerStatus` 的 adapter 侧） | `adapter.android.device` |
| **T-4** | `displayRole` 变更的**业务留痕跨重启**（与 runtime 角色切换同病：值持久、留痕不持久） | 待定 |

---

## 8 · 交付物 · 门 · 测试（草案，详设可细化但不得缩小）

⚠️ **范围以 §4.0 为准**（2026-09-02 二次裁定，取代 09-01 的 Alt-B 收敛）。

**v1 交付物**：

| 组 | 内容 |
|---|---|
| 状态 | `displayRole` slice（**单字段**，`owner-only` · `isolated`） |
| 命令 + actor | `switchDisplayRole` · `switchInstanceMode` · **`powerStatusChanged`**（§4.5） |
| 纯函数 5 | `resolveSurfaceDisplayMode` · `resolveWorkspace` · `getDisplayRoleChangeEligibility` · `resolvePowerRoleTarget` · `getSwitchInstanceModeEligibility` |
| selector 1 | `selectDisplayRole` |
| **私有**（不进公开面，§4.7） | **电源桥**（订阅 + 播种 + 去重 + 翻译）· **启动校验**（§4.4b） |
| 跨包 | 🔴 **加 `display-context → kernel.base.platform-ports` 依赖边**（三文件四行，§4.0）· 🔴 **`platform-ports` 新增 `DevicePort.getDisplayInfo()`**（§7 T-6） |
| 其余 | 模块工厂 · README（`TR-10` 中文）· HANDOFF ·
🔴 **`kind` 迁移**：从 `apps/terminal/skeleton-graph.ts` 移除本包的 `plannedKind`，
在 **`src/moduleName.ts`** 与 `moduleName` 并列导出 `export const moduleKind = 'owner' as const` |

⚠️ **本节已于 2026-09-01 更正两处**：
- 住址**不是** `application/moduleManifest.ts`。门缺陷整改单元 A 已把 `kind` 正本定在 `src/moduleName.ts`
  （`runtime/src/moduleName.ts` 现为 `moduleName` + `moduleKind` 两行并列），
  `graph-model.mjs` 沿 alias 链解析到该 symbol，**同文本局部常量无效**；
- 原文写「工具已改成二选一，所以本批不需要再改工具」，**当时是错的**——
  `graph-model.mjs` 那时硬编码到 `kernel.base.runtime`，第二个包做 kind 迁移会把整套门打塌。
  **该硬编码已由单元 A 消除**（本轮亲验 `moduleName !== 'kernel.base.runtime'` 零命中），
  所以结论现在成立，但成立的理由与原文所写不同。

**静态门 —— 四道，逐项编号（Codex S-3：原「建议三道」与表列四道、正文「四道减为三道」三处打架，已统一为四道）**

| 门 | 判据 | 反例栏 |
|---|---|---|
| **① `DISPLAY_CONTEXT_PUBLIC_SURFACE`** | 手写 exact-set | 只证名字集合不漂，不证语义 |
| **② `DISPLAY_CONTEXT_OWNER_KIND`** | 🔴 **解析 `src/moduleName.ts` 导出的 `moduleKind` symbol**（**不是** manifest；Codex S-3，与 §8 kind 正本一致）+ 至少一个 slice + slice 名以 moduleName 派生 | 只证形态，不证持久化运行语义 |
| **③ `DISPLAY_CONTEXT_RESTART_POSITIVE`** | 声明 `owner-only` 的包必须有跨 runtime 恢复用例 | **存在性扫描**，不证恢复语义；⚠️ `TR-04` 的**反向断言这一半本批无对象可测**（本包只有一个持久字段），须在反例栏明写、留待后续补齐 |
| **④ 🔴 `DISPLAY_CONTEXT_NO_DISPLAY_INDEX_IN_SLICE`** | 本包 slice 的字段精确集**不得出现 `displayIndex`** | 抓不到把它藏进别的字段名（如 `screenIdx`）；那只能靠 review |
⚠️ **第三轮对抗审查删掉了一道我自己加的门。**
第一轮曾加 `DISPLAY_CONTEXT_SURFACE_MODE_NOT_SELECTOR`（断言签名不以 `StateRoot` 为唯一入参）。
**它与上一道门重复**：`resolveSurfaceDisplayMode` 需要 `displayIndex`，
而 slice 里禁止有 `displayIndex` ⇒ 它**本来就写不成 selector**。
本文在评审 runtime 时立过同一条立场：「**不得为它新建独立表或独立门 —— 那才是过度设计**」，
这里必须自我适用。⇒ **删除该门。**⚠️ 删的是**第五道**（曾短暂存在），删完**剩四道**，即上表 ①–④。原文写「四道减为三道」是笔误（Codex S-3）。

**测试 —— 两张确定清单（Codex M-1）**

⚠️ 本节抬头「详设可细化但**不得缩小**」只约束 **v1 required** 那一组；
**deferred** 组在恢复 §4.6 ② 时**同样不得缩小**。

#### v1 required（至少含）

- per-surface 派生式**七行全覆盖**（§2.3 的表逐行一条），不得只测两三行；
  🔴 **外加坏状态一条**：`MASTER + VICE` 时 `idx0→PRIMARY`、`idx1→SECONDARY`
  —— 缺这条，把第三输入 `instanceMode` 删掉的实现会全绿通过。
- ⚠️ 原「设备级 `selectDeviceDisplayMode` 四形态各一条」随该 selector 删除而移除。
- `resolveWorkspace` **四组穷举**（`{instanceMode, displayRole}` 是 2×2）：
  `SLAVE+CHIEF→BRANCH`（D 副机）· `SLAVE+VICE→MAIN`（C 副机）·
  `MASTER+CHIEF→MAIN` · `MASTER+VICE→MAIN`（坏状态下 workspace 仍正确）。
  ⚠️ 第三轮改签名后**不再需要**「断言它取的是设备级那份」那条用例 ——
  它现在收 `DisplayRole`，per-surface 的 `DisplayMode` **在类型上就喂不进来**。
- 准入四条：`CHIEF→VICE` 在 MASTER 拒 · 在 SLAVE+SECONDARY 拒（受管副屏）· 在 SLAVE+PRIMARY 允许 ·
  **`routeContext.displayMode` 缺失时 typed reject**。
- `VICE→CHIEF` 在 SLAVE 允许。
- 电源：接电+CHIEF→VICE · 断电+VICE→CHIEF · **`unknown` 不切换** · MASTER 不切换 ·
  ⚠️ 原「`displayIndex===1` 不切换」**已改为 `displayCount > 1` 不切换**（§4.5：per-surface 的 `displayIndex` 在设备级不可求值）。
- `TR-04` 正向：重启后 `displayRole` 仍是 VICE。
- `displayRole` slice **不参与同步**：对它调 `applyAuthoritativeSync`
  ⇒ 返回 `{status:'skipped', reason:'SYNC_NOT_DECLARED'}` 且 slice 值不变。
  ⚠️ 措辞要准：`isolated` 在 `defineStateRuntimeSlice` 层就禁止带 `sync` descriptor，
  所以入站是**被跳过**不是"被拒"；与 runtime 单元 B 的 `I-3` 用例同形。
- 两跳链：本包 `public` 命令 → runtime `internal` 命令，`requestId` 被继承。
- 🔴 **电源桥三条**（§4.5，注入假 `DevicePort`）：**首个事件只播种、不派发命令** ·
  **同值不重复派发** · **跃迁派发一次 `powerStatusChangedCommand`**。
  ⚠️ 缺第一条，实现会在每次启动翻转一次屏身份（§3.2(0b) 的 POC 实证）。
- 🔴 **`RoleChangedActor` 端到端**（§2.3，`TR-11` 形态）：runtime 角色写入**成功提交后**派发
  「角色已变化」command ⇒ 本包 actor 处理 ⇒ `displayRole` 回 `CHIEF`。
  🔴 **反证一条**：runtime 角色切换被**拒绝**时 ⇒ 该 command **不得被派发**，`displayRole` **不变**
  —— 这条专门证伪「并发监听原始 set-mode 命令」那种错误实现。
- 🔴 **§4.6 ① 准入**：`getDisplayInfo()` 报屏数 > 1 ⇒ 切 SLAVE 必拒；
  端口返回非 `succeeded`（如 `unavailable`）⇒ **fail-closed，同样必拒**。
  ⚠️ 不得把「测不出屏数」当成「不 > 1 ⇒ 放行」。
- 🔴 **§4.5 守卫**：`displayCount > 1` 时电源不切换。
- 🔴 **三条端到端 actor 行为（2026-09-02 新增，Codex S-3）** ——
  必须观察**最终 slice 值、命令结果与端口调用**，⛔ **不得只断言纯函数结果或「命令被派发」**：
  ① `switchInstanceModeCommand` 从 **`SECONDARY` route** 发起 ⇒ **必须被拒**，`instanceMode` 不变；
  ② `powerStatusChangedCommand` 经 actor 与 reducer 之后，**`displayRole` 确实改变**；
  ③ power actor 在 `getDisplayInfo()` 非 `succeeded` 时 ⇒ **不得写状态**，且留下 typed 诊断（§4.5a）。
- 🔴 **`switchDisplayRoleCommand` actor 四条（2026-09-02 新增，Codex S-1）** ——
  ⚠️ 前一版只给电源 actor 配了共同前置的反证，**`switchDisplayRole` 一条都没有**
  ⇒ 实现者只在电源 actor 里加前置、`switchDisplayRole` 直接写 `VICE`，**所有 required tests 仍绿**。
  四条同时观察**端口调用、命令结果与最终 slice 值**：
  ① 单屏（`succeeded` + `count===1`）⇒ **允许**写 `VICE`；
  ② `count > 1` ⇒ **拒**且状态不变；
  ③ 端口非 `succeeded` ⇒ **拒**且状态不变；
  ④ `count` 缺失 / 非整数 / `< 1` ⇒ **拒**且状态不变。
- 🔴 **启动校验三条（§4.4b）**：跨两个 runtime 实例、**共享持久存储**、**改变屏幕拓扑**：
  ① 单屏持久化 `VICE` → 重启仍单屏 → **保留 `VICE`**；
  ② 单屏持久化 `VICE` → 重启时已是双屏 → **改回 `CHIEF`**；
  ③ 端口非 `succeeded` → **改回 `CHIEF`** 且留 typed 诊断。
  ⚠️ 纯函数正确、桥派发次数正确、`requestId` 被继承 —— **三者都证明不了 actor 的准入与最终写入正确**。

#### deferred —— 恢复 §4.6 ② 时必须启用，届时不得缩小

- ② 已激活主机不得切 SLAVE：已激活 ⇒ 拒 · 未激活 ⇒ 允许 · 激活状态读不到 ⇒ **fail-closed 拒**。
- ⚠️ 恢复时须与 `transport` 同批，并把本组移入 v1 required。

---

## 9 · 已知会踩的三个点

1. **`displayRole` 要 hydrate、`displayIndex` 走 props** ⇒ 两者**不同步到达**。
   ⚠️ **这里有两个窗口，别读成一个**：
   - **store 就绪窗口** —— 单元 A 已做成硬约束（`getState`/`getStore` 在 `started` 前抛），UI 不抢跑即可。**已闭**；
   - 🔴 **surface props 到达窗口** —— `displayRole` 由 `preloadedState` 在 store 构造时注入，
     而 `displayIndex` 随每个 surface 的 `initialProps` 到达，**两者时序独立**。
     ⚠️ **2026-09-02 收紧（Codex N-3）：只说「详设写明返回什么」不够具体，须二选一并写死：**
     **甲 · 保持严格签名**（`displayIndex: 0 | 1`）⇒ props 未到时**根本调不了**，
     由 provider 在 props 到达前**阻止调用与渲染**，接缝责任落 `ui.base.render`（§6 S-1）；
     **乙 · 扩展签名**：入参允许 `displayIndex` 缺省，返回类型显式表达 `pending` / `unavailable`，调用方分支。
     ⛔ **无论哪个都不得默认 `displayIndex = 0`** —— 那会让**副屏首帧被当成主屏**。
     ⚠️ 作者倾向**甲**；该条影响 `ui.base.render` 接缝，详设须与那一批一起定。见 §3.2(0c)。**未闭。**
2. **单 VM 双 surface 共享 Hermes VM 与同一 bundle** ⇒ 副屏 UI 代码在主屏 surface 里永不渲染但会被打包进去；
   `react-error-boundary` 必须下到 screen 级（技术栈裁定已有）。
3. **`workspace` 是设备级** —— 不要因为 `displayMode` 是 per-surface 就把它也做成 per-surface（§2.4）。

---

## 10 · 决策记录

| 日期 | 裁定 | 落点 |
|---|---|---|
| 2026-09-01 | 四形态 A/B/C/D 与两个输入 `displayIndex`/`displayRole`，派生式 `idx===1 \|\| role==='VICE' ⇒ SECONDARY` | §2 |
| 2026-09-01 · Q-1 | 能改 `displayRole` 的是 **C/D**，不是口述中的「B/C」（B 是单机双屏、没有副机） | §4.4 |
| 2026-09-01 · Q-2 | `displayRole` 取大写闭集 **`'CHIEF' \| 'VICE'`** | §2.2 |
| 2026-09-01 · Q-3 | 电源触发切换**第一版就做** ⚠️ 09-01 曾反转为「不做」，**09-02 撤销该反转、回到原裁定**（§4.0 判据更正）。✅ **确认步已裁定（2026-09-02）：v1 无独立确认步**；未来若新增确认，**必须作为另一条 `TR-11` command**，⛔ 不得恢复回调式确认。确认交互的**呈现**仍归 UI | §4.0 · §4.5 |
| 2026-09-01 · Q-4 | `displayRole` **第一版不跨机同步**（`isolated`） | §4.1 |
| 2026-09-01 · Q-5 | `reasonCode` 闭集**先留本包**，不进 contracts | §4.4 |

---

## 11 · 评审历史

首版写完后由作者自做**三轮对抗式自审**（非独立盲审，findings 归作者自己，不冒充第三方评审）。
三轮共改出 **3 M · 3 S · 5 N**，其中两条是首版的实质错误。

### 第一轮 · 与冻结需求对账

| # | 问题 | 处置 |
|---|---|---|
| **M-1** | **把冻结需求里的两个 `displayMode` 合并成了一个。** runtime 需求第 387-390 行明写「设备级那份用于派生工作区，per-surface 那份用于命令归属 —— **用途不同**」。首版据此错误地断言「`displayMode` 不得做成 selector」——**对设备级那份是错的**，它必须是 selector | §2.3 拆成两个函数两种形态；§4.2、§4.7、§8 连带更正 |
| **M-2** | **派生式在 `displayRole` 与 `instanceMode` 不一致时产出坏状态。** 两者是独立持久化的设备级值；C 副机（SLAVE+VICE）重新部署成 B 主机（MASTER）后，重启时 role 残留 VICE ⇒ 两个 surface 都算出 `SECONDARY` ⇒ **整机没有主屏** | per-surface 公式加第三输入 `instanceMode`。⚠️ **本行「不采用 role-change effect 重置」的处置已于 2026-09-01 作废** —— Dexter 裁定「切 `instanceMode` 时都重置 `displayRole`」，两条都要，见 §2 正文更正段 |
| **S-1** | §4.6 的准入漏了 Dexter 已裁定的「**双屏设备不能整体作为 pair 的副机**」（runtime 需求 258/1523/2770 三处）。首版只写「受管副屏一律拒」——**那只拦从副屏发出的命令**，B 的主屏 surface 发同一条会被放行 | 补成三条准入并写明①②当前缺数据源；新增欠账 T-5 |
| **S-2** | **删掉了 POC 的 `standalone` 守卫却没查清它是什么。** 查证后：`runtimeDerivation.ts:23` `const standalone = input.displayIndex === 0` —— **它就是单屏判据**。首版的删除理由「SLAVE 蕴含单屏」是**模型推论不是结构保证**，而 S-1 恰好证明该蕴含可被破坏 | §4.5 补回 `displayIndex===0` |
| **N-1** | 交付物漏了 `kind` 迁移（移除 `plannedKind` + 建 manifest） | 补入 §8，并指出 runtime A-4 已有先例、工具已改好 |
| **N-2** | 「本包不持有 `displayIndex`」与 §4.4 从 routeContext 反推该信息，措辞冲突 | §4.2 分清「不持有设备状态」与「读每命令的入参投影」 |

### 第二轮 · 攻击第一轮的修法

| # | 问题 | 处置 |
|---|---|---|
| **M-3** | 🔴 **接缝的对手方够不到本包。** 亲验 `skeleton-graph.ts`：`ui.base.render` 的依赖精确集是 `[platform-ports, runtime, ui-state]`，**不含 `display-context`**；而本包的消费者只有 `ui-state`、`ui.integration.platform-console`、`assembly.android.pos-desktop`。⇒ S-1 要求它盖章，但它**调不到**本包的三个派生函数 | 新增 **S-1b**：由 `ui-state` 转出；并指出与既有 S-3 是同一形状的两个实例，应一并设计 |
| **N-3** | §2.2 的结论句「不是设备级值」与新增的 §2.3 直接矛盾 | 改写 |
| **N-4** | 「伪造入站 diff ⇒ 被拒」措辞不准：`isolated` 是在 `defineStateRuntimeSlice` 层禁止带 sync descriptor，入站是**被跳过**（`SYNC_NOT_DECLARED`）不是被拒 | 按 runtime 单元 B 的 `I-3` 同形改写 |
| **N-5** | 「订阅的取消函数必须持有」不准 —— `subscribePowerStatus` 返回的是 `subscriptionId` | 改成持有 `subscriptionId` |

### 第三轮 · 攻击自己的一致性

| # | 问题 | 处置 |
|---|---|---|
| **S-3** | 第一轮把 `resolveWorkspace` 改成收 `deviceDisplayMode`，并配一句「必须喂设备级那份」的警告加一条测试 —— **那是运行期约定不是结构保证**：两份 `DisplayMode` 是同一个类型，喂错在类型上完全合法 | 改收 `DisplayRole`（与 `DisplayMode` 是不同类型）⇒ **per-surface 那份在类型上喂不进来**。语义等价，已验算 |
| **N-6** ⚠️ *2026-09-02 更正：删的是重复的**第五道**，删完**仍为四道**，原记「四道减为三道」是笔误* | 第一轮我自己加了一道 `DISPLAY_CONTEXT_SURFACE_MODE_NOT_SELECTOR` 门，**它与 slice 门重复** —— `resolveSurfaceDisplayMode` 需要 `displayIndex`，而 slice 里禁止有它 ⇒ 本来就写不成 selector。本文在评审 runtime 时立过「不得为它新建独立门，那才是过度设计」 | **删门**（删的是重复的第五道，删完**仍为四道**），并记录理由 |
| **N-7** | §4.4 准入表的两行都建立在「双屏设备不会是 SLAVE」这个**当前无人强制**的前提上 | 点明与 T-5 同根、闭一个即闭两个，并要求写进 README/HANDOFF |

### 本轮边界

- 三轮均为**作者自审**，不是独立盲审；按仓内规矩，DESIGN/IMPLEMENTATION 的正式对抗审查须由 fresh 独立子 agent 做，本文尚未进入该流程。
- **本轮未运行任何命令。** 所有仓内事实为静态读取，所有「更好/更差」的判断为设计推论。
- 本文是**需求**，不授权详设或实施。
