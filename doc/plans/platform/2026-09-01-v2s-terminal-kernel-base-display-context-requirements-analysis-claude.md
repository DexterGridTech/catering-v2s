# TER `kernel.base.display-context` 需求分析（Claude）

| 字段 | 值 |
|---|---|
| 文档地位 | **分析稿，不是冻结需求。** 不进入正式需求 / 详设 / 实施 |
| 方法 | 与 `kernel.base.runtime` 需求同法：**先独立推导 → 再逐条对照 POC → 逐条判定「POC 已有 / POC 有但差 / 我在臆造」** |
| 本轮出处 | fresh，v2s 仓根；**未运行任何命令**，全部结论为静态源码事实或明标推论 |
| 冻结输入 | Dexter 2026-09-01 口述的四形态模型与派生规则（§2）· 项目记忆 `terminal-architecture-and-stack-rulings` · runtime 需求 §2.4 / §2.4.1 / §7.1 |

---

## 0 · 这份文档怎么读

**一 · POC 里每个东西都有产品用意，只是可能实现得不好。**
判读职责是读懂那个用意，再判断 TER 要不要、以及实现得好不好。
⛔ 不得用「有没有生产调用」否定一项能力。

**二 · 本文对每条能力给出三种判定之一**：
`POC_ALREADY_HAS`（我若照写就是重造）· `POC_HAS_BUT_WORSE`（继承用意、换实现）·
`FABRICATED_BY_ME`（POC 没有，且我给不出产品理由 ⇒ 删）。

**三 · 本文不定详设。** 它只回答「这个包该承担什么、边界在哪、哪些是 POC 已解决的、哪些必须换做法」。

---

## 1 · 包位置（仓内事实，已亲验）

`apps/terminal/skeleton-graph.ts:33-38`：

```
'kernel.base.display-context': {
  batch: 1,
  plannedKind: 'owner',
  dependencies: ['kernel.base.contracts', 'kernel.base.state', 'kernel.base.runtime'],
  devDependencies: [],
}
```

**下游消费者（图中声明依赖它的三个包）**：
`kernel.base.ui-state` · `ui.integration.platform-console` · `assembly.android.pos-desktop`。

**它能用的上游能力**（已收口，逐名核过）：

| 来源 | 可用能力 |
|---|---|
| `runtime`（63 项公开面） | `selectRuntimeInstanceMode` · `RuntimeInstanceMode` · `setRuntimeInstanceModeCommand` · `SetRuntimeInstanceModePayload/Result` · `RuntimeRoleChangeEffect` · `defineCommand`/`defineActor`/`onCommand` · `createRuntime` 与两个上下文 |
| `state` | `WorkspaceKey = 'MAIN' \| 'BRANCH'` · `WorkspaceStateKeys` · `WorkspaceRouteContext` · `createWorkspaceStateKeys` · `createWorkspaceActionDispatcher` · `toWorkspaceStateDescriptors` · `defineStateRuntimeSlice` |
| `contracts` | `CommandRouteContext`（单元 B 后为三闭集可选字段：`workspace?: 'MAIN'\|'BRANCH'` · `instanceMode?: 'MASTER'\|'SLAVE'` · `displayMode?: 'PRIMARY'\|'SECONDARY'`） |

⚠️ **方向约束**：runtime **不能**反向依赖 display-context（runtime 需求 §2.4 已裁定），
所以 `instanceMode` 的**持有**永远在 runtime，`displayMode` 的持有与 `workspace` 的**派生**才在本包。

---

## 2 · 四种运行形态与派生规则（Dexter 2026-09-01 口述，本文已逐行验算）

| 形态 | 机器/屏 | JS | workspace | 备注 |
|---|---|---|---|---|
| **A** | 单机单屏，单主屏 | 单 JS | MAIN | |
| **B** | 单机双屏，主+副屏 | **单 JS** | MAIN（两屏共享） | `TER_SINGLE_VM_SINGLE_STORE_MULTI_SURFACE` |
| **C** | 主副机各单屏，主+副屏 | 双 JS | MAIN | |
| **D** | 主副机各单屏，**双主屏** | 双 JS | 主机 MAIN / **副机 BRANCH** | |

**两个输入**：`displayIndex`（Kotlin 启动参数，`0 | 1`）· `displayRole`（`chief | vice`，默认 `chief`）。

**派生规则**：

```
displayMode = (displayIndex === 1 || displayRole === 'vice') ? 'SECONDARY' : 'PRIMARY'
```

**七行逐条验算**（本文独立代入，非转述）：

| 形态 | idx | role | ⇒ displayMode | 命中哪一支 |
|---|---|---|---|---|
| A | 0 | chief | PRIMARY | 都不命中 |
| B 主 | 0 | chief | PRIMARY | 都不命中 |
| B 副 | **1** | chief | **SECONDARY** | `idx===1` |
| C 主 | 0 | chief | PRIMARY | 都不命中 |
| C 副 | 0 | **vice** | **SECONDARY** | `role==='vice'` |
| D 主 | 0 | chief | PRIMARY | 都不命中 |
| D 副 | 0 | chief | PRIMARY | 都不命中 |

**与已冻结的 workspace 派生规则交叉验算**
（项目记忆 `terminal-architecture-and-stack-rulings.md:34`：`SLAVE && PRIMARY → BRANCH`）：

| 形态 | instanceMode | displayMode | ⇒ workspace | 与 Dexter 表 |
|---|---|---|---|---|
| A | MASTER | PRIMARY | MAIN | ✓ |
| B 主/副 | MASTER | PRIMARY / SECONDARY | MAIN / MAIN | ✓ 两屏共享 MAIN |
| C 主/副 | MASTER / SLAVE | PRIMARY / SECONDARY | MAIN / MAIN | ✓ |
| D 主/副 | MASTER / **SLAVE** | PRIMARY / **PRIMARY** | MAIN / **BRANCH** | ✓ |

⇒ **新引入的 `displayRole` 与所有既有裁定逐行自洽，没有推翻任何一条。**

### 2.1 🔴 两个输入的住址是被形态逼出来的唯一解，不是风格选择

| 输入 | 住址 | 为什么不能换 |
|---|---|---|
| `displayIndex` | **Kotlin `initialProps` → React context**，per Root Surface | B 是**单 VM 单 store 双 surface**。放进 slice 则两块屏共用一个值 ⇒ 要么同为 PRIMARY 要么同为 SECONDARY，**B 直接不成立** |
| `displayRole` | **设备级持久化 slice** | C↔D 是**运行期热切换**（副机拿下来接电当主屏）。走 props 就要 Kotlin 重启重传 ⇒ **热切换消失** |

⇒ **`displayMode` 因此是「每 Root Surface 一个值」，不是设备级值。**
这正是 runtime 需求 §2.4 那条 🔴 的根：
「T3 下一个 runtime 两块屏，runtime 无从知道这条命令来自哪块屏 —— 只有发起它的那个 Root Surface 知道」。

### 2.2 ⚠️ Dexter 口述里的一处笔误（需确认）

原话：「**B和C**的情况，副机 instanceMode=slave，displayRole 可以设置成 chief 或 vice」。
按同一段给出的形态表，**B 是单机双屏、没有副机**；能改 `displayRole` 的是 **C 和 D**。
本文按 **C/D** 理解；`DEXTER_DECISION` 待确认。

这处不是措辞问题 —— **准入规则就写在这句上**：
`displayRole` 只在「`instanceMode === 'SLAVE'` 且 `displayIndex === 0`（独立单屏副机）」时可写；
A/B 下必须恒为 `chief`。

---

## 3 · POC 对照（逐文件亲验，非转述）

### 3.1 `POC_ALREADY_HAS` —— 照抄我就是重造

| POC 事实（精确位置） | 内容 |
|---|---|
| `topology-runtime-v3/src/features/slices/contextState.ts:6-16` | 一个 context slice，字段含 `localNodeId` · `displayIndex` · `displayCount` · `instanceMode` · `displayMode` · `workspace` · `standalone` · `enableSlave` · `masterLocator` |
| 同上 `:33-34` | `persistIntent:'never'` · `syncIntent:'isolated'` —— **POC 的 context 是派生投影，不持久、不同步** |
| `foundations/eligibility.ts:21-23` | `isTopologyV3ManagedSecondary = displayCount > 1 && displayIndex > 0`（受管副屏） |
| 同上 `:25-27` | `isTopologyV3StandaloneSlave = displayIndex === 0 && instanceMode === 'SLAVE'`（独立副机） |
| 同上 `:29-85` | **四条准入**，各返回 `{allowed, reasonCode}`：TCP 激活 · 切 SLAVE · 启用 slave · **改 displayMode** |
| `foundations/powerDisplaySwitch.ts:4-23` | `resolvePowerDisplaySwitchTarget`：仅 `standalone && SLAVE` 生效；**接电 + 当前 PRIMARY → SECONDARY**；**断电 + 当前 SECONDARY → PRIMARY**；否则 `null` |
| 同上 `:1-2` | 切换要走一个确认 alert（`…power-display-switch-confirm`） |
| `features/actors/powerDisplaySwitchActor.ts` · `application/createModule.ts:125-135` | 电源事件 → 算目标 → 发命令 → actor 写状态 |

**判定**：这七项**产品用意全部继承**。尤其两条我原本可能自己发明的，POC 已经想清楚了：
① **准入必须带 `reasonCode`**，不是布尔 —— 拒绝要能对用户解释；
② **`displayMode` 的切换要走确认**，不是静默翻转（平板拿起放下会误触）。

⚠️ **接电/断电方向我核过与项目记忆一致**：记忆写「副屏可拿下来、监听接电状态当主屏用」——
拿下来 = 断电 = 变 PRIMARY，与 POC 代码同向 ✓。

### 3.2 `POC_HAS_BUT_WORSE` —— 继承用意，必须换实现

#### （1）🔴 `displayIndex` / `displayCount` 放进 slice —— TER 下**结构性不可用**

POC 把它们放进设备级 slice（`contextState.ts:8-9`），**在 POC 里是对的** ——
POC 的双屏是**每屏一个进程**，一个进程一个 store，slice 里放一个值天然正确。

**TER 不同**：`TER_SINGLE_VM_SINGLE_STORE_MULTI_SURFACE` 明令「一个 ReactHost、一个 Hermes VM、
一个 JS 线程、**一个 store**、多个 Root Surface」，且 POC 的跨进程广播协议**明令不搬**。
⇒ 照抄这两个字段，B 形态在结构上不成立（§2.1）。

**换法**：`displayIndex` 只走 `initialProps → React context`，**永不入 slice**。
`displayCount` 见下条。

#### （2）`displayCount` 在 TER 是冗余的

POC 用 `displayCount > 1 && displayIndex > 0` 判受管副屏。
若 TER 把 `displayIndex` 收成闭集 `0 | 1`，则 **`displayIndex === 1` 本身就蕴含「有第二块屏」**，
`displayCount` 不再承载任何判别力。
⇒ **建议不引入 `displayCount`**；真需要屏总数时另立字段并说明用途，
不得让它继续兼任屏身份（runtime 需求 §4.3 已把 POC 的 `displayContext` 列入不继承，同一个理由）。

#### （3）🔴 `displayMode` 在 POC 是**可写状态**，在 TER 应是**派生值** —— 这是最重要的一条

POC 里 `displayMode` 同时被两个来源写：
**物理事实的投影**（B 的副屏 `displayIndex>0`）与**用户/电源触发的切换**（powerDisplaySwitch 直接改它）。
POC 靠 `resolvePowerDisplaySwitchTarget` 里的 `standalone !== true || instanceMode !== 'SLAVE'` **运行期守卫**
挡住「受管副屏被切成主屏」。

**Dexter 的方案把两个来源分开**：`displayIndex`（物理、props、**不可写**）+ `displayRole`（可写、设备级 slice），
`displayMode` 由二者派生。

**为什么更好（可证伪）**：B 的受管副屏 `displayIndex === 1`，
派生式里 `idx===1` 是**第一支短路** ⇒ **无论 `displayRole` 被改成什么，它都算不出 PRIMARY**。
⇒ 「受管副屏不得被切成主屏」从**运行期守卫**变成**结构上不可能**。
POC 那条守卫一旦被改错（或新增第二个写入点），保护就没了；派生式没有这个失效模式。

#### （4）`replaceContextState` 整体替换 reducer

`contextState.ts:22-24` 只有一个 `replaceContextState`，任何局部更新都要重写整个对象。
⇒ 谁写这个 slice、写了哪一部分，在 reducer 层不可分辨；也无法给单个字段配准入。
**换法**：按字段拆动作（本包只有 `displayRole` 一个可写字段，天然就窄），
并让写入只经 `internal` 命令 + actor（`TR-01`）。

### 3.3 `FABRICATED_BY_ME` —— 我原本想写、但给不出产品理由的

| 我原本可能写的 | 判定 |
|---|---|
| 「`displayMode` 变化要发广播事件给其它 surface」 | **臆造**。B 里两块屏各自从同一 store + 各自 props 派生，**不需要通知**；C/D 是两台机器，跨机靠 runtime 的命令与 state 同步，不另建通道 |
| 「本包持有 `containerKey`」 | **臆造**。项目记忆写明 `containerKey` **随命令传入**，且 `state` README 已裁定它是「同一 owner slice 内部的路由键」，不是物理轴 |
| 「本包提供 `useDisplayMode()` React hook」 | **越界**。本包在 `kernel/base`，**React 属 `ui/base`**。本包只能出纯函数与 selector；context provider 归 `ui.base.render` |

---

## 4 · 建议本包承担的（分析结论，非冻结）

| # | 能力 | 形态建议 |
|---|---|---|
| D-1 | **`displayRole` 的持有** | 设备级 slice，`persistIntent:'owner-only'` + `flushMode:'immediate'`（与 runtime 角色 slice 同形，理由同样是「崩溃重启不能变回默认值」）·`syncIntent:'isolated'`（绝不跨机同步 —— 两台机器各有各的 role） |
| D-2 | **`displayRole` 的写入** | 一条 `internal` 命令 + actor（`TR-01`）。⚠️ 与 runtime 的 `set-instance-mode` 同形：**面向用户的那条 `public` 命令带准入，本包的 `internal` 命令只写状态** |
| D-3 | **`displayMode` 的派生** | **纯函数** `resolveDisplayMode({displayIndex, displayRole})`，不进 slice、不缓存。⚠️ 它的入参之一是 per-surface 的，**所以它不能是 selector** |
| D-4 | **`workspace` 的派生** | 纯函数 `resolveWorkspace({instanceMode, displayMode})`，`SLAVE && PRIMARY → BRANCH`，其余 `MAIN`。`instanceMode` 经 runtime 的 `selectRuntimeInstanceMode` 读 |
| D-5 | **形态准入** | 继承 POC 的四条 + `reasonCode`。至少要有：`displayRole` 可写性（仅独立单屏副机）· 已激活主机不得切 SLAVE · 受管副屏一律拒 |
| D-6 | **角色切换的第一跳** | 面向用户的 `public` 命令（做准入判断）→ 子命令发 runtime 的 `internal` `set-instance-mode`。这是 runtime 需求 §4.8a ② 那条两跳链**缺失的上半截** |
| D-7 | **电源触发的 `displayRole` 切换** | 继承 POC 的 `resolvePowerDisplaySwitchTarget` 用意，但**目标改成 `displayRole` 而不是 `displayMode`**（见 §3.2(3)）；确认 alert 的**发起**归本包，**呈现**归 UI |

⚠️ **D-3 的 per-surface 性质要在需求里写死**：它不是 selector、不能进 slice、不能被 memo 成设备级值。
这是本包最容易被实现者做错的一处。

---

## 5 · 明确不做

| 不做 | 为什么 |
|---|---|
| 任何 React 组件 / hook / provider | 本包在 `kernel/base`，React 归 `ui/base`（§3.3） |
| `displayIndex` 进 slice | §2.1 / §3.2(1) |
| `displayCount` | §3.2(2) |
| 跨 surface 广播、跨机 displayMode 同步 | §3.3 |
| TCP 激活 / 连接 / 重连 / master locator | POC 的 `topology-runtime-v3` 把拓扑连接与上下文混在一包；TER 已拆开，连接归 `transport`/topology |
| `containerKey` | §3.3 |
| 三屏及以上 | `displayIndex` 收成 `0 \| 1`；真要扩是一次显式类型变更 |

---

## 6 · 跨包接缝（本包不做，但必须一起想清楚）

| 接缝 | 对手方 | 内容 |
|---|---|---|
| S-1 🔴 **Root Surface 自动盖 `displayMode`** | `ui.base.render` | 每个 Root Surface 持有自己算出的 `displayMode`，并在**该 surface 发出的所有命令**上自动盖进 `routeContext`。**不得让业务组件自己传** —— 漏一处就静默写错屏（runtime 需求 §2.4 原文）。runtime 侧已就绪（`createLifecycleEmitter.ts:134` 读 `routeContext?.displayMode`） |
| S-2 🔴 **每块屏的 UI 状态分片** | `ui-state` | B 下单 store 双 surface，控件裸写 `useSelector(selectActiveTab)` 两屏会串。需要 `useSurfaceSelector(selector)` 之类由 context 注入 surface 键的读取面。**控件仍对 displayMode 无感，但必须用这个 hook** |
| S-3 | `ui.base.render` | 该包 `source imports` 是精确集 `[platform-ports, runtime, ui-state]`，**不含 contracts** ⇒ 它拿不到 `CommandRouteContext` 类型，须由 runtime 或 ui-state 转出（runtime 需求 §7.1 已登记） |
| S-4 | `ui-state` / `ui.base.render` | **下游不得对缺失 route 抛错** —— 无发起 surface 的命令 `route` 为 `null`，属设备级、两屏可见 |
| S-5 | Kotlin / `assembly.android.pos-desktop` | `initialProps` 必须逐 surface 传 `displayIndex`；**本包不定义这条通道**，只定义它到达 JS 后的类型与用法 |

⚠️ **S-1 与 S-2 缺任一个，B 与 D 形态都不成立**（runtime 需求 §2.4 原文：「两者缺任一个，T3 都不成立」）。

---

## 7 · 已知会踩的三个点

1. **`displayRole` 要 hydrate、`displayIndex` 同步可得** ⇒ `displayMode` 必须等 runtime `start()` 完成后才能算。
   单元 A 已把这条做成硬约束（`getState`/`getStore` 在 `started` 之前抛），UI 不抢跑即可。
2. **单 VM 双 surface 共享 Hermes VM 与同一个 bundle** ⇒ 副屏 UI 代码在主屏 surface 里永不渲染但会被打包进去；
   `react-error-boundary` 必须下到 screen 级（技术栈裁定已有该条）。
3. **`workspace` 是设备级、两屏共享**（项目记忆 `:31`）。B 下两 surface 共 store 天然共享 ✓；
   C/D 是两台机器各算各的 ✓。⚠️ 不要因为 `displayMode` 是 per-surface 就把 `workspace` 也做成 per-surface。

---

## 8 · 要 Dexter 裁的（`DEXTER_DECISION`）

| # | 问题 | 我的建议 |
|---|---|---|
| Q-1 | §2.2 那处笔误：能改 `displayRole` 的是 **C/D** 而不是「B/C」，确认？ | 按 C/D |
| Q-2 | `displayRole` 的命名。POC 无此概念，`chief/vice` 与已有的 `MASTER/SLAVE`、`PRIMARY/SECONDARY` 是第三组大小写与词汇 | 建议统一成大写闭集 `'CHIEF' \| 'VICE'`，与另两组同形 |
| Q-3 | 电源触发切换要不要在**第一版**就做 | 建议**做**（POC 已实证，且它是 C↔D 的真实用户路径），但确认 alert 的呈现归 UI 那一批 |
| Q-4 | `displayRole` 是否需要跨机可见（对端知不知道副机现在是 chief 还是 vice） | 建议**第一版不同步**（`isolated`）。对端要知道的是 `instanceMode` 与 `workspace`，那两个已有通路 |
| Q-5 | 准入被拒时的 `reasonCode` 是否进 `contracts` 闭集 | 建议**先留在本包**，等第二个消费者出现再上提 |

---

## 9 · 与 runtime 需求 §7.1 欠账的对应

本包落地后可关掉的（**仅** 这两条，其余仍在别处）：

- 「`displayMode` 的持有 · `workspace` 的派生 · 形态切换准入」 ⇒ D-1 / D-3 / D-4 / D-5
- 「设备级 `displayMode` 的持有与设置机制…**它就是 T1↔T2 的形态开关**」 ⇒ D-1 / D-2 / D-7
  ⚠️ 措辞要更正：**开关是 `displayRole`，不是 `displayMode`**（§3.2(3)）

**关不掉、仍需别的包**：Root Surface 盖章（`ui.base.render`）· UI 状态分片（`ui-state`）·
缺失 route 不抛错（`ui-state`/`ui.base.render`）· `CommandRouteContext` 的取得路径（`ui.base.render`）·
`state` 同步方向校验 · 跨版本未知枚举入站 · 角色切换后重置出站同步基线。

---

## 10 · 本轮证据边界

- **仓内静态事实**：skeleton-graph 条目与三个下游消费者 · runtime 63 项里可用的六个符号 ·
  `state` 的 workspace 能力 · POC 的 `contextState.ts` / `eligibility.ts` / `powerDisplaySwitch.ts` 逐行内容。
- **推论（已标）**：§3.2 各条的「换法更好」是设计推论，非实测；
  §2 的两张验算表是我独立代入的结果。
- **`UNVERIFIED_REQUIRES_EVIDENCE`**：Kotlin 侧 `initialProps` 的真实字段名与类型 ·
  电源事件端口在 TER 的落点（POC 走 `topology-runtime-v3`，TER 尚未建）·
  B 形态在真实设备上是否确实单 VM 双 surface（本轮无设备）。
- **本轮未运行任何命令。**
