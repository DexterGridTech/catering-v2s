# `kernel.base.state` · 需求文档

| 字段 | 值 |
|---|---|
| 包 | `apps/terminal/kernel/base/state` · `@catering-v2s/kernel-base-state` |
| 性质 | 需求文档。详设与实施由 Codex 承担 |
| 前置 | `contracts`（74 导出）与 `platform-ports`（10 端口）均已收口 |
| kind | `plannedKind: toolkit` —— **不得拥有 slice**（`TR-09`） |
| 依赖 | `contracts` · `platform-ports` · RTK |
| 构造输入 | 存储端口（plain / secure）· **`LoggerPort`** · **具名 storage timeout policy** · `persistenceKey` · slice 声明集合 |
| 规范正本 | `doc/platform/terminal-coding-standard.md`（`TR-01`/`TR-02`/`TR-03`/`TR-04`/`TR-09` 全部落在本包） |
| POC 参照 | `1-kernel/1.1-base/state-runtime`（src 1,633 行 / 25 文件）· `topology-runtime-v3` · `runtime-shell-v2` |
| 本批范围 | **持久化与同步全量**（Dexter 2026-08-30 裁定：POC 当时没做完整，不代表 TER 不需要做完整） |

⚠️ **本文保留完整分析过程与证据链**，不是只给结论 ——
Dexter 要求 Codex 在读结论之前能独立复核同一批事实并给出自己的判断。
每条事实都标了文件与行号，请**打开原文亲验**，不要采信本文转述。

---

## 1 · 包定位

**Redux store + 持久化 + 同步声明的统一基座。**
业务 slice 只**声明意图**，落盘粒度、存储后端、刷盘时机、同步方向全部在这里收敛。

### 1.1 `toolkit` 意味着什么 —— 先说清楚，否则实施必然长歪

一个叫 `state` 的包**不持有任何状态**。`TR-09` 规定 `toolkit` 不得拥有 slice。

| 本包提供 | 本包不提供 |
|---|---|
| store 的构造与根级 action | 任何业务 slice |
| slice descriptor **协议** | slice 的**声明**（归各业务包） |
| 持久化的**执行**（读写存储端口） | 决定哪些字段该落盘（归声明方） |
| 同步的 summary / diff / apply **算法** | 传输、会话、方向解析、重连（归 topology） |

⇒ 判别式：**本包只做"按声明去执行"，不做"决定声明什么"。**

### 1.2 `TR-01` 与 `TR-03` 在本包各有一个**必须被命名**的缺口

`store.ts` 第 39-46 行：根 reducer 拦截 `@@…/replace`，做
`combinedReducer({...state, ...incomingSlices}, {type:'…/init'})` ——
**业务 slice 自己的 reducer 根本没有被调用，它的子树被从外部整体换掉。**

`createStateRuntime.ts` 里**三条路径**都从外部整体改写 slice：
hydrate（第 275 行）· `applySlicePatches`（第 284 行，同步落地）·
以及 **`resetState`（第 628 行，根级 reset action，覆盖全部 slice）**。
⚠️ 本文初版只列了前两条，第三条是 Codex 独立评审 S-1 指出后我方核实补上的。

⇒ **后果**：`TR-01`（reducer 只能被 actor 调用、且只由 command 驱动）与
`TR-09`（owner 是自己 slice 的唯一写者）在这两条路径上**不成立** ——
任何包的 slice 都可能被本包从外部覆盖，而它的 actor 全程不知情。

**`TR-03` 有一个对称的缺口**：同步的发送侧要读**别人的** slice，
做法是 `getStore().getState()` 后**按字符串键取**
（`runtimeStateSync.ts` 与 `syncRegistry.ts` 都是这么做的），而 `TR-03` 要求跨包读只走 selector。

**这两个都不是 bug，是持久化与同步无法回避的机制**：恢复与同步天然是"从外部读写"。
但它必须被**显式命名并划边界**，否则下游会以为 owner 的单写者保证是无条件的。

🔴 **Dexter 2026-08-31 已裁定**：取乙支 —— **修改规范正本，精确点名例外**。
落点在 `doc/platform/terminal-coding-standard.md` 的 `TR-09` 下新增一节。

⚠️ **但例外只有一条，不是三条** —— 复核三条路径后收窄如下：

| 路径 | 是不是外部写入 | 处置 |
|---|---|---|
| **hydrate** | 是，但可消除 | 改走 **`preloadedState` 在 store 构造时注入** ⇒ store 对外可见时状态已就位，**运行期不发生外部写**。同时消掉「hydrate 与用户写入竞争窗口」这个未决项 |
| **reset** | **不是** | `store.ts` 第 49-51 行：根级 reset 把 `undefined` 交给 `combineReducers`，**每个 owner 的 reducer 各自返回自己的初始值** —— 没有任何外来数据被注入。它是「请各 owner 回到初始值」的生命周期信号，不是替 owner 写值 |
| **sync 落地** | **是，且无法消除** | **唯一的例外**。同步的本质就是把对端数据写进本机 owner 的状态 |

**为什么不取甲（让 owner 自己写）**：那只是把同一个外部写入拆成二十份样板代码分散到各包，
**写入方向一点没变**，`TR-09` 表面成立而实质未变，还多一层 command 通路依赖。
把例外写在明面上并限定死范围，比制造一个形式上合规的假象更诚实。

⇒ 正本那一节同时定死了四条边界：只限同步落地一条路径 · 只能写声明了 `sync` 的 slice ·
不得导出通用「写任意 slice」API（读侧同理）· **新增第二条例外必须在正本点名**。

---

**以下是裁决前的分析，保留备查。**

把这三条路径写进 README **并不能**让它们符合 `TR-09`。
README 只能让越权**可读**，不能让它**合规**。正本说 owner 是自己 slice 的唯一写者，
而这三条路径就是在绕过它 —— **需求文档无权自行豁免正本**（Codex S-1，我方接受）。

**hydrate 这一条可以直接消掉，零代价**：

⇒ **要求**：hydrate 的结果作为 `preloadedState` 在 **store 构造时**传入，
**不再走运行期 replace**。这同时解决了 §11 的"hydrate 与用户写入的竞争窗口"——
store 对外可见时状态已经就位，竞争窗口根本不存在。**一次修改消掉一条越权路径加一个未决项。**

（裁决前曾并列「让 owner 自己写」与「改正本点名例外」两支，Dexter 取后者。）

**以下三条在最终形态下仍然成立**：
1. **不得导出通用的"写任意 slice"API**；读侧同理，
   按字符串键读别人 slice 的能力只能是本包内部为 persistence/sync 服务的私有路径；
2. 覆盖只允许发生在**声明了 `persistence` 或 `sync` 的 slice** 上 ——
   没声明的 slice 即使出现在 patch 里也必须被跳过并记录原因；
3. 最终形态要写进本包 README，让下游知道自己的 slice 在什么条件下会被外部改写。

---

## 2 · POC 判读 · 持久化半边

### 2.1 必须整体继承的核心：六字段 slice descriptor

`types/slice.ts`：

```ts
interface StateRuntimeSliceDescriptor<State> {
    name: string
    reducer?: Reducer<State>
    persistIntent: 'never' | 'owner-only'
    syncIntent?: 'isolated' | 'master-to-slave' | 'slave-to-master'
    persistence?: readonly StateRuntimePersistenceDescriptor<State>[]
    sync?: StateRuntimeSyncDescriptor<State>
}
```

**为什么这是这个代码库最好的一个想法**：六个字段表达完"什么落盘 / 什么粒度 /
哪个后端 / 何时刷 / 往哪同步"，POC 里约 40 个 slice 在用，
**业务包写零行持久化与同步代码**。

**两种持久化粒度**（`types/persistence.ts`）：

| kind | 存储形态 | 适用 |
|---|---|---|
| `field` | 一个字段一个 storage key | 固定字段 |
| `record` | 一条 entry 一个 key（POC 另加一个 `__manifest__` key 记 entry 列表，**TER 不采用**，见 §6 第 5 条） | 动态 Record 状态 |

两者共有 `protection: 'plain' \| 'protected'`（选普通/加密存储端口）、
`flushMode: 'immediate' \| 'debounced'`、以及 `shouldPersist` / `shouldPersistEntry` 谓词。

⇒ **按字段/按条目落盘**避免了整块 blob 的写放大与恢复粒度问题。
POC README 自己写明这就是它不用 `redux-persist` 的原因。

### 2.2 已亲验的六条缺陷（每条给出行号，请复核）

| # | 事实 | 位置 | 后果 |
|---|---|---|---|
| P-a | 两条自动刷盘路径都是 `void flushPersistence()`，**返回的 Promise 被丢弃** | `createStateRuntime.ts` 第 449、458 行 | **写盘失败无任何信号**：不打日志、不改 state、不上报。存储写满或权限异常时界面一切正常，重启后状态丢失 |
| P-b | 每次刷盘**全量重写**。`persistedValueCache` 只用于陈旧键清理，**没有用来跳过未变化的条目** | 缓存定义在第 129 行；只在第 395、403、486、498 行被读；第 421 行整体 `clear()` 后重建 | N 个持久化条目时，任一条变化都写 N 次。debounce 摊薄了频次，没摊薄单次成本 |
| P-c | `resetState` 调 `storage.clear()` **清整个后端，不按前缀过滤** | 第 319-329 行 `clearStorage`，第 614、617 行调用 | 键本身有 `<persistenceKey>:` 前缀，但清理不用它。宿主若把同一存储实例共享给别的用途，会被一并清掉 |
| P-d | hydrate 是 **N+1 次 `getItem`**，完全没用 `multiGet` | 第 537、554、567 行 | record 型 slice 有 M 个 entry 就是 M+1 次跨 JSI 调用，落在冷启动路径上 |
| P-e | `persistenceEnabled = Boolean(persistenceKey && allowPersistence !== false)` —— **不检查存储端口是否存在** | 第 126-127 行 | 宿主忘记注入存储时，持久化静默不工作，而 `persistenceEnabled` 仍为 `true` |
| P-f | protected 缺失且有 protected 条目 ⇒ **抛错**；plain 缺失 ⇒ **静默跳过** | 抛在第 388-392 行；plain 无对应分支 | 同一件事两种处理，且静默的那一支是数据丢失面更大的那支 |

### 2.3 已亲验的四个做对的细节（不要在重写时丢掉）

| 细节 | 位置 | 为什么容易漏 |
|---|---|---|
| 变更侦测只遍历 **persistable slice** 并用引用相等 | `store.subscribe` 回调 | 配合 immer 不可变更新，引用比对就够；全量深比是常见的错误做法 |
| 刷盘模式判断额外看 `persistedValueCache.has(key)` | 第 486、498 行 | 让**字段被删除**也能触发刷盘，而不是只有"字段有值"才刷 |
| 计算并清理**存储类别迁移**的陈旧键 | 第 395、403 行 | 把一个字段从 plain 改成 protected 时，旧的明文副本会被删掉。多数实现会漏 |
| 刷盘串行化：`chain = chain.catch(()=>undefined).then(...)` | 刷盘入口 | 不会并发写打架，且前一次失败不阻塞后一次 |

### 2.4 两处"关掉了本该保护自己的东西"

**其一：`serializableCheck` 与 `immutableCheck` 被无条件关闭**（`store.ts` 第 59-60 行），
而持久化恰恰是 `JSON.stringify` 编码的（`createStateRuntime.ts` 第 96 行 `encodeEntry`，
第 94 行 `cloneState` 也走 JSON 往返）。

⇒ **一个以 JSON 持久化为职责的包，关掉了唯一能发现"非 JSON 安全值进入 store"的检查。**
`Date` 落盘后 hydrate 回来是字符串、`Map`/`Set` 变成 `{}`、`undefined` 键直接消失 ——
**全部静默**，任何环境都不报。POC 关它的理由是性能，这个理由在 PROD 成立，在 DEV/TEST 不成立。

**要求**：`serializableCheck` 与 `immutableCheck` **在 DEV/TEST 开启、PROD 关闭**。

🔴 **但不得声称这两项检查等于"JSON 安全"**（Codex S-2，我方接受）：
RTK 的 `serializableCheck` 接受 `undefined` 与全部 `number`，
所以 **`NaN` / `Infinity` / `undefined` 都能通过检查**，而 JSON 会把前两者变成 `null`、
把 `undefined` 的键直接丢掉；`immutableCheck` 只查突变，与 JSON 安全无关。

⇒ **持久化边界必须另有 codec**：编码时对不可 JSON 往返的值**返回 typed 失败**，
不得静默写入。RTK 那两项检查是开发期的网，**不是持久化的判据**。

**其二：没有 slice 重名检查。** `store.ts` 用 `reducerMap[slice.name] = slice.reducer` 直接赋值，
两个包声明同名 slice 时**后者静默覆盖前者**，且两者的存储键也会撞。
`TR-09` 已要求 slice 名以 `moduleName` 为前缀，但那是**声明方**的规范；
本包作为**装配方**必须自己挡一道。

**要求**：构造 store 时发现重复 slice 名 ⇒ **报错**，不得后者覆盖前者。

### 2.5 `persistIntent` 与 `persistence` 数组是 AND 关系

`createStateRuntime.ts` 第 140 行：

```ts
slice => slice.persistIntent === 'owner-only' && (slice.persistence?.length ?? 0) > 0
```

⇒ 声明 `persistIntent: 'owner-only'` 但 `persistence` 为空数组时，**该 slice 静默不落盘**。
两个字段之间没有任何约束。

---

## 3 · POC 判读 · 同步半边

⚠️ **验证方法警告**：本节结论必须用**不截断**的搜索得出。
`topology-runtime-v3` 按字母序排在 `tdp-sync-runtime-v2` 之后 ——
用 `head` 截断的 grep 输出会**只看到测试文件**，从而得出"同步算法没有生产消费者"这个**错误**的全称否定。
下同步半边的任何否定结论前，请先穷举。

### 3.1 真实的生产链路（三个包，两段）

**发送侧** —— `topology-runtime-v3/src/foundations/syncRegistry.ts`：

```ts
// 方向按角色实时算
toDirection(context) = context.instanceMode === 'MASTER' ? 'master-to-slave' : 'slave-to-master'

// 按方向筛 slice —— syncIntent 在这里被读（第 37 行）
filterSlicesByDirection = slices.filter(s => s.syncIntent === direction && s.sync)

// 全量快照：空 remoteSummary ⇒ 全部条目
payload = createSliceSyncDiff(slice, sliceState, {}, {mode: 'authoritative'})

// 增量：remoteSummary 由发送方自己的上一版 state 算出（第 102-110 行）
remoteSummary = createSliceSyncSummary(slice, previousSlice)
payload       = createSliceSyncDiff(slice, currentSlice, remoteSummary, {mode: 'authoritative'})
revision      = nowTimestampMs()
```

**接收侧** —— `runtime-shell-v2/src/foundations/runtimeStateSync.ts`：

```ts
syncMode = direction === 'master-to-slave' || direction === 'slave-to-master'
    ? 'authoritative' : 'latest-wins'
applySliceSyncDiff(slice, currentSliceState, diff, {mode: syncMode, replaceMissing: envelope.replaceMissing})
stateRuntime.applySlicePatches(nextSlices)
```

该文件的注释写明了设计意图，**这个意图是对的，TER 整体继承**：

> topology runtime 不直接理解 Redux slice 内部结构，只通过 state-runtime 暴露的 sync 描述计算和应用 diff。
> 这让主副屏同步能力保持通用，业务包只声明自己的 syncIntent 和字段策略。

⇒ **职责边界**：`state` 提供**协议 + 算法 + 值信封**；`topology` 提供**方向、会话、传输、重连**。

### 3.2 已有的材料（TER 直接继承，不重造）

`types/sync.ts`：

```ts
interface SyncValueEnvelope<TValue> { value?: TValue; updatedAt: TimestampMs; tombstone?: boolean }
interface SyncStateSummaryEntry   { updatedAt: TimestampMs; tombstone?: boolean; valueHash?: string }
interface SyncDiffOptions         { mode?: 'latest-wins' | 'authoritative'; replaceMissing?: boolean }
```

🔴 **`valueHash` 是真算真用的**（`supports/sync.ts` 第 45 行计算、第 207 行参与比对）。
这一点很重要：**内容摘要已经存在**，所以"两端对账找出分歧"这件事不需要新造材料。

### 3.3 五处保证不足（形状够，保证不够）

**S-a · 增量同步的 `remoteSummary` 是虚构的，但分歧不是永久的。**
发送方用**自己的上一版 state** 当作"对方现在有什么"，这一点成立。

🔴 **但"永久分歧"不成立**：`connectionController.ts` 第 466-484 行，
收到 `hello-ack` 且 `accepted && sessionId` 时会发送**全量 authoritative 快照**
（空 `remoteSummary` 的 diff），同一分支还调 `resetReconnectAttempt()` ——
**每次连接与重连都会重新对齐**。

⇒ **准确的边界**：活跃会话内**没有接收确认与间隙检测**，
未被察觉的丢失会让分歧**持续到下一次 hello-ack**；重连后由权威全量快照消除。
**不是永久分歧。**

**S-b · `revision` 是墙钟时间戳，而且没人读。**
发送侧两处都写 `revision: nowTimestampMs()`；接收侧 `runtimeStateSync` **完全不读 `revision`**。
既没有序号也没有间隙检测。

**S-c · `latest-wins` 是死代码。**
接收侧的三元判断里，`direction` 的类型**只有** `'master-to-slave' | 'slave-to-master'` 两个值，
所以 `latest-wins` 那一支**永远不可达**。算法里整套 `updatedAt` 比较没有生产入口。

**S-d · TER 的角色会翻转，POC 没有这个场景。**
`TER_PAIR_TOPOLOGY_WITH_DETACHABLE_SECONDARY`：副屏平板**可拿下来、监听接电状态当主屏用**
（`SLAVE && PRIMARY → BRANCH`）。方向按 `instanceMode` 实时算，所以**翻转本身能工作**。
但**脱开期间平板上产生的本地变更，重新接上时会被 master 的
`authoritative` + `replaceMissing: true` 快照整体覆盖**。

**S-e · `as any` 成片**（`sessionId as any` / `payload as any` / `diff as any`，
`syncRegistry.ts` 的三个 envelope 构造器与 `runtimeStateSync.ts` 的 apply 调用）。
`TR-05` 会直接拦下，转写时必须给出具名类型。

---

## 4 · 本批的设计主张

⚠️ **全部是"更简单"的方向。** 全量做同步，不等于建一套同步协议。

**一 · 职责边界原样继承。**
`state` 不碰传输与会话；`topology` 不碰 slice 内部结构。
POC 这一刀切对了，且注释里写明了意图（§3.1）。

**二 · 声明与行为必须一致，不一致就报错。**
`persistIntent: 'owner-only'` 而 `persistence` 为空、
`syncIntent` 非 `isolated` 而 `sync` 未定义 —— **两者都在构造 descriptor 时报错**，不静默跳过。

> POC 里 `syncIntent` 看起来像个惰性字段，正是因为"声明了方向却没给描述符"会被静默忽略。
> 让它报错，字段的含义才是真的。

**三 · 同步只做无会话状态的纯机制，本批采用「全量 slice 快照」。**

| 做 | 不做 | 理由 |
|---|---|---|
| `authoritative` 的 summary / diff / apply 三段式，**无任何接收方账本** | 序号 · 间隙检测 · 分歧信号 | 见下 |
| 全量 slice 快照作为本批唯一的同步载荷形态 | 增量 · 重传 · 冲突解决 / CRDT | 与现有 reconnect 机制天然一致，不需要接收方状态 |

🔴 **为什么撤回序号方案**（Codex 独立评审 M-1，我方核实后接受）：

① **立论前提不成立**：我原以为丢消息会造成永久分歧，实测重连即重新对齐（S-a 已更正）；
② **它越过了本文自己划的边界**：会话生命周期、角色翻转、账本何时重置**只有 topology 知道**，
   而本文第 7 节明写"本包不提供会话"。要求 toolkit 维护「会话 × slice」账本，
   **与自身的职责声明直接矛盾** —— 这是我五轮自审都没看出来的内部冲突；
③ **没有证据支持它的代价**：目前没有 slice 体量或同步流量数据能证明全量快照不可接受。

⇒ **本批取全量快照。** 将来测得真实传输成本后，再由 `topology` 决定是否引入
定期 `valueHash` 对账或会话序号 —— **那时它属于 topology 协议，不属于本包**。

**四 · `latest-wins` 不建。**
生产不可达（S-c），无形状证据。`SyncDiffOptions.mode` 本批只保留 `authoritative`。

**五 · 失败必须可观测，而这在 TER 比在 POC 更难。**
见 §5 —— TER 的端口把错误从"抛"变成了"typed 返回值"，**忽略它反而更容易**。

---

## 5 · TER 的端口变化重塑了持久化的设计

**这是本批与 POC 最大的结构差异，必须先讲。**

| | POC `StateStoragePort` | TER `StateStoragePort` |
|---|---|---|
| 方法 | 3 必填 + 5 可选（`multiGet?` `multiSet?` `getAllKeys?` `clear?` …） | **8 全必填**：`read` `write` `remove` `readMany` `writeMany` `removeMany` `listKeys` `clear` |
| 「没有这个键」 | `getItem` 返回 `string \| null`，与"存了 null"分不清 | **显式** `{state:'missing'}` vs `{state:'found', value}` |
| 失败 | 抛异常 | **typed 五态** `succeeded/unavailable/failed/timed-out` |
| 端口缺失 | 端口可能是 `undefined` | **端口永远存在**，不可用是一个 typed 返回值 |

**逐条后果**：

1. **P-d（N+1 读）没有借口了** —— `readMany` 是必填方法。hydrate 必须批读，
   record 型的 manifest 与 entries 合成尽可能少的往返。
2. **P-c（清整个后端）可以修** —— `listKeys` 是必填方法，
   `resetState` **必须按 `persistenceKey` 前缀过滤后逐键删除**，不得调 `clear()`。
3. **P-e / P-f（端口缺失的不对称）消失了**，但换来一个**新问题**：
   `persistSecure` 返回 `unavailable` 时本包该怎么办？
   ⇒ **要求**：与 POC 的 protected 处理同向 —— **fail closed**，
   返回 typed 失败并让 `persistenceHealth` 可见，**不得退回 plain 存储**。
   这与 `platform-ports` 的 `D-1` 裁定同源：明文冒充加密是不可见的谎。

   🔴 **但 fail closed 的作用域必须限定在 protected 条目上，不得升级为"整体启动失败"。**
   理由：`persistSecure` 的默认实例就是不可用（`platform-ports` D-1），
   而架构裁定要求 `ui.base.integration` **必须能在 Expo Web 上跑**且 web 不建 adapter ——
   若 protected 不可用就中止 hydrate，**web 通道永远起不来**，与架构裁定直接冲突。
   ⇒ 正确语义是：**protected 条目缺席 + 健康位可见 + 有 error 记录；plain 条目照常 hydrate。**
   「fail closed」在这里的含义是**绝不静默降级到明文**，不是**一票否决**。
4. 🔴 **P-a（静默失败）在 TER 更危险。**
   POC 里 `void flushPersistence()` 至少丢的是一个会 reject 的 Promise；
   TER 的端口**不抛异常**，返回的是一个 `status: 'failed'` 的对象 ——
   **不看返回值就等于当作成功**，而且没有任何 lint 或类型会提醒。
   ⇒ **要求**：刷盘的每一次端口调用都必须判别五态；
   自动刷盘路径**不得丢弃结果**，失败必须①打 error 日志、②置一个可被观察的持久化健康位。

   🔴 若启动期 `listKeys` 或 `readMany` 失败，该后端进入 `baseline unknown`，不得用初始值覆盖它。
   第一次后续 `flushPersistence` 可对该后端做**一次且仅一次** `listKeys` + `readMany` re-baseline；两步都成功
   才解除 block 并继续本次 flush，任一步失败则维持 block，本进程不做周期重试，只能由下一次 runtime 构造或
   成功 `resetState` 重新建立基线。该尝试必须进入 typed health/log，不得表述为普通 retry 或退避。

⚠️ **`persistKv` 的默认实例是进程内 Map（不跨重启）**，这是规范正本 `§3-A` 与 Dexter 的裁定。
本包**不得**据此认为持久化已生效 —— `TR-04` 的重启测试必须用**真实可持久化的替身**，
不能用默认 Map 冒充。

---

## 6 · 包内容 · 持久化

-1. 🔴 **构造时必须接受一个具名的 storage timeout policy。**
   TER 的 `StateStoragePort` **每个方法都要求 `timeoutMs`**（`StateStorageCall`），
   而本文初版全文没有说这个值从哪来 —— 实施者只能临场编（Codex S-3，我方接受）。
   ⇒ 要求给出 **read / write / reset 三类预算**的具名来源，
   并写明它是构造参数还是取自 contracts 的参数定义；
0. ⚠️ **构造时必须接受一个 `LoggerPort`** —— 本文多处要求"打 error 日志""坏 JSON 打 warn"，
   而 kernel 拿日志的唯一入口是 `platform-ports`。不接 logger，这些要求就无处落地；
1. **六字段 slice descriptor** 与两种持久化粒度（`field` / `record`），形状继承 §2.1;
2. **store 构造**：纯 RTK `configureStore` + **有且仅有两个**根级 action
   （合并 slice patch / 整体回初始值）。⚠️ "仅有两个"是 §1.2 边界的一部分：
   每多一个根级 action，就多一个绕过 owner 的写入口；
3. **变更侦测**：只遍历 persistable slice，引用相等比对（§2.3 第 1 条）；
4. **刷盘**：串行链 · 陈旧键清理 · **存储类别迁移（先写新、后删旧）** · **差量写入**（修 P-b）。

   🔴 **迁移顺序固定为"新后端写成功，再删旧后端"**，不得反序。
   反序（先删 plain、再写 protected）时若写入失败，**数据永久丢失**；
   且**旧明文删除失败仍算迁移失败**，必须计入健康位 —— 明文残留是安全问题，不是清理瑕疵。

   🔴 **差量写入有一个只在 TER 存在的陷阱**：`persistedValueCache` 是"已落盘内容"的镜像，
   差量靠它比对。POC 的端口**抛异常**，一次失败会把整个刷盘炸出去；
   TER 的端口**返回 `failed` 对象**，如果照着"写完就更新缓存"实现，
   **失败的键会被记成已落盘，之后永远不再重试** —— 数据永久丢失且无声。
   ⇒ **要求：缓存只在该键的写入返回 `succeeded` 时更新。**

   🔴 **但"该键"这个粒度，端口给不了。** `writeMany` / `removeMany` **只返回整批一个
   `PortResult<NoOutput>`，没有 per-key status，也不承诺原子性**。
   于是存在一条我上一版没堵住的重启假绿：
   `writeMany([a,b])` 实际写成了 a、在 b 上失败并整批返回 `failed` ⇒
   健康位正确记录、缓存也正确地没有前移 ⇒ 此时进程崩溃 ⇒
   新 runtime 枚举读到**新 a 与旧 b**，把半新半旧当正常状态恢复。

   ⇒ **本批的语义裁定：record 的每个 entry 是独立的提交单元，
   本包不承诺整份 record 的"全有或全无"。** 据此：
   ① 需要逐键成功信息的路径**用逐键 `write`/`remove`**，
      批量方法只用于不需要逐键提交判断的场景；
   ② 测试断言的是**部分成功后的合法恢复语义**，不是整份原子一致；
   ③ 文档、README 与实施记录都**不得声称整份 record 的重启一致性**。

   ⚠️ **为什么不现在建提交协议**：整份原子需要 transactional port、per-key status
   或 generation/commit marker，**是端口层的改造**，而目前没有任何业务要求整份 record
   原子更新的证据。等出现真实需求再升级，届时红夹具是
   "只物理写入第一项后返回 failed 再立即重启"。
   ⇒ **附带效果**：失败的键**保持 dirty**，会在**下一次由状态变化或显式 flush 触发的刷盘**中再次尝试。
   ⚠️ **这不是完整的重试机制，不得如此声称**（Codex S-2，我方接受）：
   若最后一次自动刷盘失败、其后再无状态变化、也没有人调显式 flush，
   **就根本不会发生重试**。
   ⇒ 本批仍**不建自动 retry 与退避**，但必须①保留**显式 `flushPersistence`**、
   ②把"上次失败"作为 typed 结果暴露在健康位上，
   ③**在 README 里诚实写明"没有无后续变更时自动恢复的保证"**；
5. **hydrate**：**枚举驱动**（不用 manifest）· **批读**（修 P-d）· 坏 JSON 单条跳过**且打 warn**。

   🔴 **record 不采用 `__manifest__`。** POC 用一个额外的 manifest 键记录 entry 列表，
   但 **TER 的 `writeMany` / `removeMany` 只返回整批一个 `PortResult`，接口不承诺原子性**。
   于是 manifest 与 entries 之间存在一个没有提交协议的窗口：
   manifest 写成功而 entry 失败 ⇒ 指向不存在的条目；entry 写成功而 manifest 失败 ⇒ 数据成孤儿；
   还要额外回答"entry 自身就叫 `__manifest__` 时怎么办"。
   ⇒ **要求：用 `listKeys` 按 entry 命名空间枚举 + `readMany` 批读**。
   这两个方法在 TER 是**必填**的（§5），所以不需要 manifest 就能知道有哪些条目 ——
   **删掉一个键、删掉整套提交协议，比补 generation/commit-marker 简单得多**；

5b. **键空间必须无歧义，且枚举成本要有边界。**

   🔴 **`listKeys` 没有 prefix 参数**（签名只有 `timeoutMs`）——
   它返回**该后端的全部键**，本包必须自己按 namespace 过滤。这带来两个要求：

   ① **固定 key grammar**：包级 namespace · descriptor prefix · entry 的可逆编码 ·
      分隔符 · 冲突规则。构造 descriptor 时**拒绝会造成 keyspace 冲突的
      `storageKey` / `storageKeyPrefix` 组合**（报错，不是后者胜）。
      分隔符处理不严会误匹配相邻 namespace，必须有测试。
   ② **每个 storage backend 在一次 hydrate 或 reset 中最多调用一次 `listKeys`**，
      之后在内存里按 descriptor 分区。**不得每个 descriptor 各扫一次全后端** ——
      那会退化成「descriptor 数 × 后端全部键」。

   ⚠️ **复杂度如实登记**：本方案是 `O(该后端全部键)`。
   目前**没有真实键规模证据**，因此**本批不改端口**；
   只有实测证明全量枚举不可接受时，才另行设计 prefix-aware 的端口方法；
6. **resetState**：**按 `persistenceKey` 前缀**逐键删除（修 P-c）。
   ⚠️ **持久层删除成功之后才允许重置内存** —— 否则删除失败时内存已清、界面显示空，
   重启后旧数据**原样回来**，而所有判据都是绿的；
7. **持久化健康**：自动刷盘与 hydrate 的失败可观测（修 P-a，见 §5 第 4 条）。

   🔴 **健康位不得做成 slice。** 本包是 `toolkit`，`TR-09` 禁止它拥有 slice，
   而"建一个 `persistenceHealth` slice"恰恰是最自然的实现直觉 —— 它会直接撞上 ST-2 门。
   ⇒ **要求**：健康状态是 runtime 对象上的**普通可观察值**
   （一个读取方法 + 一个订阅），不进 Redux store。
   ⚠️ 这条约束反过来也说明了它的边界：**本包只负责"让失败可被读到"，
   不负责把它呈现给用户** —— 要展示就由某个 owner 包订阅后写进自己的 slice；
8. **scoped slice：本批只建 `workspace` 一轴。**

   🔴 **穷举实测**（Codex S-3，我方复算确认）：
   `createWorkspaceStateKeys` 与 `createWorkspaceActionDispatcher` 各有 **3 个生产消费者**；
   `instanceMode` 与 `displayMode` 的两组 helper **各 0 个生产消费者、只有 1 个测试消费者**。

   ⇒ 本文初版把三轴一并列为强制交付物，**其中两轴没有任何形状证据** ——
   这正是本文自己反对的"为假设需求提前建"。
   ⇒ **要求：只建 `workspace` 轴**（或一个通用的 scope-key 工具），
   `instanceMode` / `displayMode` 的专用 helper **等真实消费者出现再建**。

   ⚠️ 从架构裁定独立推导也支持这个结论：`workspace`（MAIN/BRANCH）是**设备级工作上下文、
   两块 surface 共享**，天然需要按轴展开；而 `containerKey` 与随 command 传入的 `displayMode`
   是**同一个 owner slice 内部的路由键**，不是需要拆成多份 reducer 的物理轴。

⚠️ 第 8 条与 `TER_SINGLE_VM_SINGLE_STORE_MULTI_SURFACE` 直接相关：
TER 改成一个 store 后，`workspace: MAIN/BRANCH` 是**设备级**上下文、两屏共享；
`displayMode` 是随 command 传入的路由键。**本批只需写清 `workspace` 这一轴的语义**，
另两轴在有真实消费者之前不写、不建。

## 7 · 包内容 · 同步

1. **`SyncValueEnvelope` / `SyncStateSummary`（含 `valueHash`）/ `SyncStateDiff`** 形状继承；
2. **三段式算法**：`createSliceSyncSummary` → `createSliceSyncDiff(remoteSummary)` → `applySliceSyncDiff`；
3. **`mode` 只保留 `authoritative`**（主张四）；
4. **本包不产生也不消费任何序号、游标或会话账本** —— 无接收方状态；
5. **提供"产出某 slice 全量 payload"的能力**（空 `remoteSummary` 的 diff 即为全量，
   §3.1 的快照路径已经是这么做的）。**何时发送由 `topology` 决定**；
6. **`syncIntent` 与 `sync` 的一致性在构造时校验**（主张二）;
7. **tombstone 语义**：`authoritative` 下显式删除；`replaceMissing` 的行为在详设写清楚。

⚠️ **本包不提供**：传输、会话、方向解析（`instanceMode → direction`）、重连、重传。
方向解析留在 `topology`，因为它依赖运行期角色，而角色可翻转（S-d）。

🔴 **角色可运行期翻转（S-d）是"本包不得持有同步账本"的第二个理由**：
翻转后收发双方对调，任何以"对端"为键的接收方状态都会立刻失效，
而**判断翻转发生的信息只在 topology 手里**。无状态的全量快照对翻转天然免疫。

---

## 8 · 设计标准与门

| # | 标准 | 落点 |
|---|---|---|
| ST-1 | 出边只有 `contracts` · `platform-ports` · RTK | 已有门（依赖方向 + 声明完整） |
| ST-2 | **本包零 slice**（`TR-09` toolkit） | **新增门**：扫 **`src/**` 内**不得调用 `createSlice`、也不得导出 slice descriptor 实例。⚠️ **扫描面必须排除 `test/**`** —— 测试当然要造 slice 夹具，把测试算进来就是假红。红夹具：在 `src/` 加一个 slice |
| ST-3 | `TR-05`：端口边界与公开面禁 `Record<string, unknown>` / `any` / 双重 cast | 扩展既有 analyzer 到本包。红夹具：把 diff payload 改回 `any`（S-e 的转写方向） |
| ST-4 | **声明一致性（双向）**：`persistIntent:'owner-only'` + 空 `persistence` **报错**；`persistIntent:'never'` + 非空 `persistence` **也报错**；`syncIntent` 非 `isolated` + 无 `sync` **报错**；`syncIntent:'isolated'`（或未声明）+ 有 `sync` **也报错** | 测试 + 类型层负夹具 |
| ST-5 | **端口调用必须判别五态**，不得忽略返回值 | **新增门（可机械）**：本包内不得存在"丢弃存储端口返回值"的语句 —— AST 扫 `await port.<method>(…)` 出现在表达式语句位置而结果未被消费。红夹具：把某处刷盘改成 `await storage.writeMany(...)` 不接结果。⚠️ 门只能证明"结果被接住了"，**"失败分支写对了没有"仍是评审判断**，绑评审清单 |
| ST-6 | `resetState` 不得调用 `storage.clear()` | **新增门**：本包源码禁止出现对存储端口 `clear` 的调用。红夹具：改回 `clear()` |
| ST-7 | `TR-04`：声明了持久化就必须有**正反双断言**的重启测试 | 测试（§9 的 R 组） |
| ST-8 | `TR-02`：刷盘失败不得表现为成功 | 测试（§9 的 F 组） |
| ST-9a | **`serializableCheck`/`immutableCheck` 在 DEV/TEST 开启**，且**持久化 codec 独立把关** | 测试：DEV 下放 `Date` 触发 RTK 告警、PROD 不触发；**且 codec 对 `NaN`/`Infinity`/`undefined`/循环引用返回 typed 失败** —— 后者才是持久化的判据 |
| ST-9b | **重复 slice 名必须报错** | 测试：两个同名 descriptor 构造 store ⇒ 抛，且错误里带上冲突的名字 |
| ST-9 | **hydrate 失败不得静默降级成"初始状态"** | 测试（§9 的 F 组）。⚠️ 读路径的静默失败比写路径更难查：用户看到的是"设置莫名回到默认值"，且没有任何记录 |

---

## 9 · 测试

| 组 | 断言 | 反断言 |
|---|---|---|
| **D**（descriptor 校验） | 合法声明构造成功；**重复 slice 名报错**（ST-9b） | **四条反断言，两两成对**：`owner-only` + 空 `persistence` 报错 · `never` + 非空 `persistence` 报错 · `master-to-slave` + 无 `sync` 报错 · `isolated`/未声明 + 有 `sync` 报错。⚠️ **只测第一个方向不算覆盖** —— 反向的"声明了不做却给了描述符"同样是契约撒谎 |
| **P**（持久化往返） | field 与 record 两种粒度各自 write→read 往返；`shouldPersist` 谓词生效；`shouldPersist` 由真转假时该键被**删除**而不是留旧值 | ① **差量**：只改一个条目时只有该条目被写（按详设 §5.4 断言逐键 `write` 集合，不使用 `writeMany`）；② 🔴 **hydrate 之后立刻 flush，写入次数必须为 0** —— 这是差量是否真生效的最强证伪，全量重写实现会在这里立刻红；③ **写失败的键不得进入已落盘缓存**：让端口对某键返回 `failed`，下一次 flush 该键必须**再次**被写。此处以逐键 `write` 为唯一实现口径，详设 §5.4 已取代历史 `writeMany` 计数措辞 |
| **R**（`TR-04` 重启） | 第一次运行写入 → **换一个新 runtime 实例 hydrate** → 状态恢复 | **反断言**：`persistIntent:'never'` 的 slice 重启后**必须回到初始值**。⚠️ 判据是**存储替身跨 runtime 实例存活**：两个实例共享**同一个** Map 就够，**不必造文件后端**；错误做法是各调一次 `createProcessMemoryStateStoragePort()`（那是两个不同的 Map），或复用同一个 runtime 实例再 hydrate 一次（什么都没证明） |
| **F**（失败可观测 · 写） | 存储端口返回 `failed` 时，自动刷盘路径打 error 日志且置持久化健康位 | **不得**返回成功；`persistSecure` 返回 `unavailable` 时 **fail closed，不得退回 plain** |
| **H**（失败可观测 · 读） | hydrate 期间 `readMany` 返回 `failed`/`timed-out` 时，健康位可见且有 error 日志；第一次后续 flush 对 blocked 后端只做一次 re-baseline，两步成功才恢复写入 | 🔴 **不得把"读失败"与"这个键本来就没有"混为一谈** —— 前者必须留痕，后者是 `{state:'missing'}` 的正常分支；re-baseline 失败后不得每次 flush 无限重试。⚠️ 坏 JSON 单条跳过时必须打 warn，带 storageKey |
| **C**（清理） | `resetState` 只删本 `persistenceKey` 前缀的键 | ① 同一存储里的**外部键必须原样存活**；② 源码不得调用 `clear()`；③ 🔴 **删除失败时内存不得被重置** —— 重启后数据回来而判据全绿，是本包最隐蔽的一条假绿 |
| **M**（存储类别迁移） | 字段从 plain 改成 protected 后，**旧的明文副本被删除** | ① 迁移后再读，plain 后端已无该键；② **两阶段失败**：protected 写失败时 plain 旧值**必须仍在**；③ 旧明文删除失败 ⇒ 迁移记为失败且健康位可见 |
| **X**（部分失败与键空间） | record 的 entry 集合变化后，`listKeys` 枚举结果与内存一致 | ① **批写部分失败**（按详设 §5.4 的逐键 fake 只物理写入前一项、第二个 `write` 返回 `failed`）再重启，hydrate 必须得到**逐 entry 合法**的集合（新 a + 旧 b 是**合法**结果），且健康位记录了这次失败 —— ⚠️ **不得断言整份 record 原子**，那是端口给不了的保证；② 两个 descriptor 的键空间冲突 ⇒ 构造时报错；③ entry key 含分隔符时可逆编码往返正确；④ `listKeys` 返回 `failed`/`timed-out` **不得被当成"没有持久化数据"**。此处明确按逐键 `write` 的部分失败验证，不实现或断言 `writeMany` 整批语义 |
| **S**（同步） | `authoritative` 的 summary → diff → apply 三段式往返；tombstone 生效；`replaceMissing` 语义正确 | ① **公开面不存在 `latest-wins`**；② **不存在任何接收方账本**（无序号、无游标、无 lastApplied 记录）；③ 全量 payload 可由本包产出且不含会话信息 |
| **T**（类型层） | 全部公开名可从包根导入 | `@ts-expect-error`：不一致声明不可构造；**同步载荷必须是具名形状** —— 用 `unknown` 或缺字段的对象去赋值必须编译失败。⚠️ **不得写"`any` 不可赋值"的夹具**：`any` 可赋给任何类型，那行只会得到 "unused @ts-expect-error"（Codex N-2，我方接受）。显式 `any` 由 ST-3 的 analyzer 负责，不归类型层 |

⚠️ `tsconfig` 必须包含 `test/**`，并有**反向控制**（删一行 `@ts-expect-error` → typecheck 变红）。
前两批都踩过这个坑。

---

## 10 · 明确不做

| 不做 | 为什么 |
|---|---|
| `latest-wins` 模式 | 生产不可达（S-c），无形状证据 |
| 同步的**重传**、会话、序号与分歧检测 | 全部归 `topology`；本包只提供无状态的 summary/diff/apply 与全量 payload 产出 |
| 冲突解决 / CRDT | 无双写场景，`authoritative` 已定权威方 |
| 脱开重连时保留 slave 的本地变更 | **Dexter 2026-08-31 已裁定被远端覆盖**（§11）—— 这是正确语义，不是待补救的缺陷 |
| "真相不在 KV"的第三档来源语义（SQLite 类） | Dexter 已裁定推迟到有真实业务再补 |
| 持久化的加密实现 | 归 `adapter`；本包只按 `protection` 选端口 |
| 把方向解析搬进本包 | 角色可运行期翻转，解析依赖 topology 的运行期上下文 |

---

## 11 · 未决与需 Dexter 裁决

| 项目 | 档位 | 说明 |
|---|---|---|
| ~~脱开重连时 slave 的本地变更是否保留~~ | **已裁决：被远端覆盖** | Dexter 2026-08-31：**state 是有方向的，断开重连后当然要被远端覆盖**。⇒ 现有的 `authoritative` + `replaceMissing:true` 快照语义**就是正确语义**，不是需要补救的缺陷。详设据此实现，并在 README 写明这条方向性 |
| ~~`revision` 序号的持久化~~ | **随方案作废** | 序号方案已在第一轮评审后整体删除（§4 主张三、§13 M-1），本项不再存在 |
| ~~同步进来的数据要不要落盘~~ | **已裁决：落盘** | Dexter 2026-08-31。理由链：副机断电重启、主机未连上的窗口里收银台**不能白屏**，落盘让它至少显示上次同步到的内容；而「落盘数据可能过时」的担心已被上一行「重连一律被远端覆盖」的裁定消解 —— 过时会自动修正。**要求**：同时声明 `persistence` 与 `sync` 的 slice，同步落地的值**照常进入落盘流程**。⚠️ POC 从没做过这个决定：它的 `persistenceDirty` 标志（第 135 行声明、267 置真、271 置假）**零读取点**，现有行为是那个死标志的意外结果 |
| ~~privileged root write 是否保留~~ | **已裁决** | Dexter 2026-08-31 取「改正本点名例外」支；复核后**例外收窄为同步落地一条**（§1.2）。正本已新增 `TR-09` 例外节，定死四条边界 |
| ~~hydrate 与用户写入的竞争窗口~~ | **已结案** | hydrate 改走 `preloadedState`（§1.2），store 对外可见时状态已就位，竞争窗口不存在 |
| ~~scoped slice 三轴语义~~ | **已结案** | 按穷举证据只建 `workspace` 一轴（§6 第 8 条）；另两轴无生产消费者，等真实需求再建。此项不再是未决 |

✅ **本节已无未决项。** 五项全部结案：三项由 Dexter 2026-08-31 裁定，
两项因方案变更而消失。**详设可以按本文开工，不需要再等任何裁决。**

---

## 12 · 交付物

1. 六字段 descriptor 与两种持久化粒度的类型 + 构造期一致性校验；
2. store 构造与两个根级 action；
3. 持久化执行：变更侦测 · 差量刷盘 · 陈旧键与迁移清理 · 前缀化 reset · 批读 hydrate · 健康位；
4. 同步：值信封 · 摘要（含 `valueHash`）· `authoritative` 的 diff / apply · **全量 slice payload 的产出能力**。
   ⚠️ **不含**序号、游标、接收方账本、分歧信号、`latest-wins`；
5. scoped slice **仅 `workspace` 一轴**（或一个通用 scope-key 工具）；
6. **三道新增门**（ST-2 零 slice · ST-5 禁丢弃端口返回值 · ST-6 禁 `clear()`）
   与**一道扩展门**（ST-3 `TR-05` 扩展到本包），各带红夹具与真实树绿；
7. §9 **十组**断言（D/P/R/F/H/C/M/X/S/T）+ `tsconfig` 覆盖 `test/**` 的反向控制记录；
8. **TER-local 验证接线**（Codex N-1，我方核实：本包目前只有 `typecheck` 没有 `test`，
   而 `tools/terminal-skeleton/verify.mjs` 把 test owner 写死为七元组并断言 `REAL_TESTS` 恰为 2 ——
   **只加测试不改 verifier，TER-local verify 会因为多出一个 owner 直接失败**）：
   本包 `test` script · state 成为**第三个** `REAL_TESTS` owner ·
   verifier 的 owner 集合与计数更新 · state 的静态 checker 与红夹具接入 `verify:static` ·
   公开面 exact-set 检查；
9. **中文 `README.md`**（`TR-10`：定位 / 作用 / 结构 / 用法 + 「在这个包上迭代时」），
   **须写明**三件事：① 三条路径的最终形态 —— hydrate 是**构造期 `preloadedState`**、
   reset 是**生命周期信号（各 owner 返回自己的初始值）**、
   **sync 落地是唯一的运行期外部写例外**；② record entry 是**独立提交单元**，
   本包不承诺整份 record 的原子更新（§6 第 4 条）；
   ③ 没有"无后续变更时自动恢复"的保证；
10. 实施记录，含：逐条 POC 差异清单（P-a…P-f 与 S-a…S-e 各自的处置）·
   端口五态判别的**逐调用点**核对 · `TR-04` 重启测试的正反证据 ·
   以及 §11 五项裁决/结案在实现中的落点。⚠️ **§11 已无未决项**。

---

## 13 · 第一轮独立评审处置记录

Codex 独立评审 `TER_KERNEL_BASE_STATE_REQUIREMENTS_2026_08_31` ROUND 1（NO-GO，2M/3S/2N）。
本文作者已逐条回源亲验，**七条全部成立，零驳回**。

| 编号 | 处置 | 我方亲验依据 |
|---|---|---|
| M-1 序号越界且前提过强 | **ACCEPTED（全部）** | 亲验 `connectionController.ts` 第 466-484 行：`hello-ack` 且 `accepted && sessionId` 时发全量 authoritative 快照并 `resetReconnectAttempt()` ⇒ **重连即对齐，"永久分歧"不成立**。且本文第 7 节自称"不提供会话"却要求维护「会话 × slice」账本，**是内部矛盾**。已删除序号/账本/分歧信号，改取全量快照（§4 主张三、§7） |
| M-2 manifest 无提交协议 | **ACCEPTED** | TER `writeMany`/`removeMany` 只返回整批一个 `PortResult`，接口不承诺原子性。已改为 `listKeys` 枚举 + `readMany` 批读、去掉 manifest；迁移固定"先写新后删旧"；reset 先删成功再重置内存；补 X 组测试（§6、§9） |
| S-1 README 不能豁免正本，且漏算 reset | **ACCEPTED，已裁决** | 亲验 `createStateRuntime.ts` 第 628 行确是第三条路径，本文初版只列两条。Dexter 取「改正本」支；复核后**例外收窄为一条** —— hydrate 走 `preloadedState` 消掉、reset 经 `store.ts` 第 49-51 行确认是「各 owner 返回自己初始值」不含外来数据、**仅同步落地是真例外**。正本已加 `TR-09` 例外节 |
| S-2 两处过度声称 | **ACCEPTED** | ①"失败键不进缓存"只保证下次 flush 时重选，**末次失败后再无变化就不会重试** —— 表述已收窄并要求保留显式 flush + typed 失败暴露；② RTK `serializableCheck` 接受 `undefined` 与全部 `number`，`NaN`/`Infinity`/`undefined` 都能过检 ⇒ 已要求持久化边界**另有 codec**，不得把 RTK 检查当 JSON 安全判据 |
| S-3 关键输入未定 | **ACCEPTED** | ① `StateStorageCall.timeoutMs` 每个方法必填而全文无来源 ⇒ 已加具名 timeout policy；② 穷举复算：`workspace` helper **3 个生产消费者**，`instanceMode`/`displayMode` **各 0 生产 1 测试** ⇒ 本批只建 `workspace` 轴；③ 同步值是否落盘维持 `DEXTER_DECISION` |
| N-1 未接入 TER-local 单点入口 | **ACCEPTED** | 亲验本包只有 `typecheck` 无 `test`；`verify.mjs` 的 `terminalTestOwners` 是七元组常量且断言 `real.length === 2` ⇒ 只加测试不改 verifier 会直接失败。已列入交付物 |
| N-2 `any` 负夹具不可实现 | **ACCEPTED** | `any` 可赋给任意类型 ⇒ 该行只会得到 unused `@ts-expect-error`。已改为 `unknown`/缺字段的具名错误形状，显式 `any` 归 ST-3 analyzer |

⚠️ Codex 列出的"明确成立、无需重开"八项方向，本次修订**均未回退**。

### 13.1 第二轮处置记录（NO-GO，3M/1S · 本 cycle 硬上限）

| 编号 | 处置 | 我方亲验依据 |
|---|---|---|
| M-1 已删方案仍残留在测试与交付物 | **ACCEPTED** | 复查确认八处：§9 S 组仍要求"序号不连续返回分歧信号"、§10 仍称"本包只到报告分歧"与"产品语义未裁"、§12 仍把"单调序号 · typed 分歧信号"与"scoped 三轴"列为交付物、README 仍写"三条外部写入路径"、实施记录仍要求处置"§11 三项未决"。**我改了论证章节却没改交付物与测试**，两种互斥实现各能引用一段文字自称正确。已全部清理；历史分析加"备查，不构成当前要求"标注 |
| M-2 批量写的半提交没被堵住 | **ACCEPTED，取 A 支** | 亲验 `storage.ts` 的 `writeMany`/`removeMany` **只返回整批一个 `PortResult<NoOutput>`**，无 per-key status、不承诺原子性 ⇒ 我上一版"缓存只在该键 succeeded 时更新"**在批量方法上根本无法成立**。已裁定 **record entry 是独立提交单元、本包不承诺整份原子**；需要逐键成功信息就用逐键 `write`/`remove`；X 组改为断言"逐 entry 合法"而非"整份原子"。**不现在建提交协议** —— 那是端口层改造，且无业务证据 |
| M-3 `TR-03` 读侧例外未落正本 | **ACCEPTED，已落正本** | 属实：`hydrate` 改 `preloadedState` 只消掉了运行期**写**，**flush 仍需读他包 slice**；而我把例外写在 `TR-09` 下、正文针对唯一写者，"读侧同理"那句只提同步、未覆盖 persistence。**用一条硬规则下的一句话隐式改写另一条硬规则是越权** —— Dexter 的授权明确覆盖写侧，读侧需他确认。**Dexter 2026-08-31 授权由我判定方向**，处置见 §13.2：正本已改 |
| S-1 `listKeys` 成本与 key grammar 未闭合 | **ACCEPTED** | 亲验 `listKeys(input: StateStorageCall)` **签名只有 `timeoutMs`、无 prefix** ⇒ 必须枚举整个后端再自行过滤。已补：固定 key grammar 与冲突规则 · **每后端每次 hydrate/reset 最多一次 `listKeys`** · 复杂度如实登记为 `O(该后端全部键)` · `listKeys` 失败不得冒充"没有数据" · **本批不改端口**，等实测不可接受再议 |
| 附带边界：reset 仍受 `TR-01` 约束 | **ACCEPTED** | reset 不是 `TR-09` 的外部数据写入，但公开入口仍须 `command → actor → dispatch`；**root reset action 与其 action creator 不得作为公共后门导出**。已并入 §1.2 的三条通用要求 |

### 13.2 `TR-03` 读侧例外的落点（**已写入正本**）

**我的判定：改 `TR-03`，但不写第二份例外正文。**
把 `TR-09` 下那一节扩成覆盖**读写两侧**，`TR-03` 下只放**一行指针**。

**为什么不写两节**：正本自己的维护约定就是"唯一内容源，别处只放指针"。
持久化与同步天然跨 owner 读写，两侧是**同一个机制的两半**，同一个包、同一组边界 ——
写成两节必然漂移。而 Codex 的实质诉求是"读 `TR-03` 的人要能找到例外、且要覆盖持久化"，
一行指针就满足了。

**为什么不取"每个 owner 提供 selector/serializer"**：二十份 owner 样板，
**读取方向一点没变** —— 是仪式，不是安全。与写侧不取甲支同理。

**正本实际改动**：例外节改名为《`kernel.base.state` 的持久化与同步》，
拆出写侧与读侧两段，边界从四条扩到**六条**（新增"键必须来自已注册 descriptor 的
`slice.name`、未知 slice 跳过并记录"，以及"reset 仍受 `TR-01` 约束、
根级 reset action 不得作为公共后门导出"）；`TR-03` 下新增指针一行。

例外正文摘要：

> **例外：`kernel.base.state` 为持久化与同步读取他包 slice**
>
> `kernel.base.state` 可以按已注册 descriptor 的 `slice.name` 从根状态读取他包 slice，
> **仅限两个用途**：① 持久化的 flush，只读声明了 `persistence` 的 slice；
> ② 同步的载荷产出，只读声明了 `sync` 的 slice。
>
> 边界四条：键必须来自**已注册 descriptor 的 `slice.name`**，不得在逻辑中临时硬编码 ·
> 未声明或未知的 slice 必须跳过并记录诊断 ·
> **不得导出通用的「读取任意 slice」API** ·
> 新增第二条读侧例外必须回本节点名。

---

## 14 · 收口

本 cycle 两轮独立评审共 5M/4S/2N，**全部 ACCEPTED，零驳回**；
Dexter 四条裁定（远端覆盖 · 同步值落盘 · 取"改正本"支 · 读侧方向由我判定）全部落地。

`§11` 零未决 · `§13`/`§13.1` 逐条处置在案 · 正本例外已收敛为**一节两侧六条边界**。

⇒ **按 `ROUND_FINAL_DECISION=SELF_DECIDED` 收口：需求可作为详设输入。**

---

## 15 · 请 Codex 独立判断的点（历史，供详设阶段参考）

⚠️ **以下每一条我都给了结论，但都请你先自己推一遍再看我的。**
你不同意的，请给出证据与替代方案，不要因为本文写了就照做。

1. **§3.3 的五条"保证不足"是否都成立？** 尤其 S-a（`remoteSummary` 是虚构的）——
   请打开 `syncRegistry.ts` 第 102-110 行自行判断，我的推论链是"发送方用自己的上一版当对方的现状，
   因此丢消息不可发现"。**如果你能找到别处有补偿机制，这条就不成立。**
2. ⚠️ **以下为历史备查，不构成当前要求。**
   ~~**"一个序号 + 一致性校验 + typed 分歧信号"是不是右尺寸？**~~
   **已结案**：第一轮独立评审判定为过度设计且越界，本文已改为全量快照（§4 主张三）。
   第二轮**不要重开这一条**，除非你能拿出新的传输成本证据。原文如下备查：
   请至少和这三个替代方案做比较，不要只评价我的方案：
   **(a) 只发全量快照、根本不做增量** —— 无接收方状态、无序号、无分歧概念，代码最少，
   代价是每次变更全量传；对本项目的 slice 体量来说，这个代价可能根本不重要。
   **(b) 保留增量，但用定期的全量 `valueHash` 摘要对账代替序号** ——
   同样无需接收方逐条记账，且能自愈；代价是分歧的发现有延迟。
   **(c) 我的方案（序号 + 间隙检测）** —— 发现最快，但接收方要为每（会话, slice）记账。
   ⚠️ 如果 (a) 或 (b) 够用，**我的方案就是过度设计**，请直说。
3. **`latest-wins` 真的该删吗？** 我的依据是生产不可达（S-c）。
   但 TER 的角色可翻转（S-d），翻转后是否会出现 `authoritative` 表达不了的场景？
4. **§5 第 3 条**：`persistSecure` 返回 `unavailable` 时 fail closed，
   代价是加密存储不可用时**整个 protected 持久化停摆**。这个代价配不配？有没有更好的中间态？
5. ⚠️ **历史备查，已由「只建 workspace 一轴」结案。**
   ~~**§6 第 8 条 scoped 三轴**在单 store 多 surface 下的语义~~ —— 我只指出了它与 POC 不同，
   **没有给出 TER 的定义**。请你从 `CON-01`/`CON-02` 与 display-context 的合约独立推导。
6. **§1.2 的 `TR-01` 缺口我划的边界够不够？**
   我要求"仅有 hydrate 与 sync 两个外部写入口、只作用于声明过 persistence/sync 的 slice、
   并写进 README"。这三条挡得住"下游 owner 的单写者保证被悄悄破坏"吗？还是需要更强的东西？
7. **§5 第 4 条与 §6 第 4 条**：我把"失败的键不进缓存"当成了重试机制本身，
   从而主张不建重试器。这个推理成立吗？有没有一种失败模式会让它永远重试同一个键而不前进？
8. **本文有没有过度设计的地方？** 特别是同步半边 ——
   Dexter 的要求是"做完整但不能过度设计"，请指出你认为越线的条目。
   ⚠️ 反过来也请指出**做得不够**的地方：我为了避免过度设计而砍掉的东西里，
   有没有哪一件其实是刚需。
