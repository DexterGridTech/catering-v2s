# `kernel.base.runtime` · 需求文档

| 字段 | 值 |
|---|---|
| 包 | `apps/terminal/kernel/base/runtime` · `@catering-v2s/kernel-base-runtime` |
| 性质 | 需求文档。详设与实施由 Codex 承担 |
| kind | `plannedKind: owner` —— **TER 第一个 owner 包** |
| 依赖 | `contracts` · `platform-ports` · `state`（三个已收口） |
| 被依赖 | **10 个包**：`transport` `display-context` `workflow` `ui-state` `ui.base.render/automation/input/admin-shell` `ui.integration.platform-console` `assembly.android.pos-desktop` —— 当前扇出最大 |
| POC 参照 | `runtime-shell-v2`（2,501 行 / 40 文件）· `execution-runtime`（488 行 / 19 文件）· `topology-runtime-v3`（跨机与角色） |

---

## 0-A · 本批切成两个冻结单元（Dexter 2026-08-31 裁定）

🔴 **本文描述一个包，但交付与评审分两次。**
理由：`§4.1–4.6` 与 `§4.8a` **不依赖台账进 slice** —— 它们只需要
「命令结束时能算出聚合状态并返回」；台账是独立的第二层。
一次交 1800+ 行 Codex 核不完（`CLAUDE.md`：「超过半小时难以核完的交付应先切小」）。

| | **单元 A · 运行时骨架** | **单元 B · 请求台账** |
|---|---|---|
| 正文 | §4.1 模块系统（含内部模块）· §4.2 命令定义与分发 · §4.2b 环路防护（**② 单 request 命令数上限除外，属 B**）· §4.2c `peerDispatchGateway` 插槽 · §4.3 actor 执行与上下文（**含 §2.3 要求二/四**）· §4.4 错误归一化/logger/journal · §4.4b 六个可调值的 `limits` · §4.5 启动四阶段 · §4.5b 订阅与定时器持有 · §4.6 reset 两段式 · §4.8a 角色自持 | §2.3 **要求三**（台账带 route 归属）· §4.2b **②** · §4.8b route 的记账 · §4.7 全节（**除下表划给 A 的五处**） |
| contracts 变更 | 第三组（删 `AppModuleMiddlewareDescriptor`）· 第四组（删四个 catalog 类型） | 第一组（`RequestLifecycleStatus` 五态）· 第二组（`CommandRouteContext` 收窄补 `displayMode`） |
| 产出 | 一个能装配模块、分发命令、执行 actor 的 runtime。**命令结果由 `dispatchCommand` 返回、过程进 journal**，不进台账 slice | 两个单写者台账 slice + 读侧合并 selector + 时效淘汰 |
| `owner` 身份 | ✅ 单元 A 自带**角色 slice**（`persistIntent:'owner-only'`，§4.8a ③）⇒ A 交付后 runtime 已是合法 `owner`，`kind` 迁移在 A 做（§8 A-4） | 追加两个台账 slice |

🔴 **跨单元硬契约三条 + 一条签名约束 + 一个已登记的 B→A 触点，详设与评审都必须逐条显式检查。**
**按 契约一 → 契约二 → 契约三 → 约束四 → 触点 的顺序列在下面。**

**契约一 · §4.7 里「与台账是不是 slice 无关」的那几节，随单元 A 交付。**

🔴 **§4.7 的章节号属于 B，但它的内容有一半描述的是「一次命令执行的事实」，
与台账是不是 slice 无关 —— 那部分归 A。** 逐节划清：

| §4.7 的小节 | 归属 | 为什么 |
|---|---|---|
| §4.7.2 的 `LedgerError` · `ActorExecutionRecord` · `CommandExecutionObservation` 三个类型 + 两条类型硬约束 (a)(b) | **A** | 前两个被 `CommandDispatchResult`（§4.2）直接用；第三个是 `aggregateCommandStatus(observation)` 的入参 |
| §4.7.2 **⑤b**（peer 网关的执行记录、五行映射表） | **A** | §4.2c ③ 的未安装分支直接依赖它 |
| §4.7.3 **全节**（actor 返回值的校验/脱钩/体积） | **A** | 返回值在 A 期就经 `CommandDispatchResult` 出去 |
| §4.7.5 的**第一级** `aggregateCommandStatus` + `CommandAggregateStatus` 五值 | **A** | 它是 `dispatchCommand` 的返回类型 |
| §4.7.7 **①**（peer 命令自带超时预算） | **A** | 网关四态里的 `timed-out` 那一支靠它 |
| §4.7.2 **②**（存投影不存原始命令、`payload` 不进） | **A** | 约束的是 `CommandExecutionObservation` 的字段集，A 期就要定 |
| §4.7.2 **③**（`result` 收成 `StateJsonValue`、`error` 投影成 `LedgerError`） | **A** | 约束的是 `ActorExecutionRecord` 的两个字段 |
| §4.7.2 **④** | **拆** | 三个类型的夹具随 A，`RequestExecutionRecord` 的随 B（④ 本身已注明） |
| §4.7.2 **①** | **拆** | 「`actorResults` 保序」随 A；「`commands` 保序」与跨机按 `startedAt` 归并随 B |
| §4.7.2 的 `RequestExecutionRecord` · slice 形状 · **⑤** · ⑥ · ⑦ | B | 台账本体；⑤ 是读侧合并规则（**⑤b 例外，归 A**，见上） |
| §4.7.1 · §4.7.4 · §4.7.5 的**第二级**与视图 · §4.7.6 · §4.7.7 ②③④⑤ | B | 台账本体 |

⚠️ **§4.7.2 的七条已逐条落表**（①拆 · ②A · ③A · ④拆 · ⑤B · ⑤bA · ⑥B · ⑦B）——
早先版本只落了三个类型、(a)(b) 与 ⑤b，**①②③④⑤ 五条悬空**，
详设作者会按「章节号属 B」整体推到 B，而 ②③ 恰好是 A 期就要定死的字段约束。

⚠️ **`aggregateCommandStatus` 必须从第一天就带 `running` 前置判据（rule 0）**（§4.7.5）。
单元 A 落地时它只在「命令已终结」这一个前置条件下被调用，rule 0 **在 A 期不会被触发** ——
但它必须从第一天就在，否则单元 B 接上去就是错的。
⚠️ **单元 B 复用同一份实现，不得另写一份。**

**契约二 · 状态迁移点必须在 A 期就收敛成单一产生点。**

§4.7.7 ②b 要求「命令与 actor 的每一次状态迁移**只有一个产生点**，
由它**同时**产出台账写入与 journal 记录」。而 **journal 在 A、台账 slice 在 B**。
⇒ A 期若按最自然的写法把 `journal.append(...)` 散在分发器的三四处，
**B 接上去时必须回改 A 已冻结的分发器**。

⇒ **单元 A 必须**：把命令与 actor 的状态迁移收敛到**一个**内部函数
（例如 `emitLifecycle(transition)`），A 期它只驱动 journal；
B 期在**同一个函数体内**追加台账写入，不动调用点。

🔴 **要收敛的是「记录的构造与推进」，不只是 journal 的写入。**
A 期 `ActorExecutionRecord` / `CommandExecutionObservation` 是
`CommandDispatchResult` 的内容（§4.2）—— 若它们在每-actor 路径里**就地构造**、
而 `emitLifecycle` 只 `journal.append(...)`，
则 B 期在 `emitLifecycle` 体内加台账写入时会**第二次构造记录**
⇒ 台账与返回值成为两份事实，正是 §4.7.7 ②b 要防的漂移。
⇒ **`emitLifecycle` 必须同时是记录的唯一构造与推进点**：
A 期它把记录写进一个进程内累加器、`CommandDispatchResult` 从累加器读；
B 期在同一函数体里把**同一个记录对象**再 dispatch 进 slice。
⚠️ 只做 journal 收敛、不做记录构造收敛，本契约在 B 期会失效。

⚠️ **`transition` 的取值集合必须在 A 期就定全**，至少覆盖六类：
命令 started/completed · actor running→completed/error/timed-out ·
迟到的 actor 完成（§4.3，只进 journal）· reset 的第二次 `reason`（§4.6 洞②）·
环路超限的完整命令链（§4.2b）· 角色切换两跳链（§4.8a ②）。
定窄了 B 期照样要回改。
⚠️ 同形的第二处接缝：§4.3 要求「台账写入（含 §4.7.3 的 JSON 校验）必须在**每 actor 的路径内**完成」——
A 期只做校验那一半，B 期在**同一位置**加写入。
⚠️ §8 门表已把「单一状态迁移点」移出机械门（只能靠评审）
⇒ **这一条必须在 A 的评审清单里显式检查**，否则没有任何东西会拦住它。

**契约三 · 角色生效点要为单元 B 预留清空钩子。**
§4.7.6 第 4 条要求「角色变化生效时清空本机不再拥有写权的那一份台账 slice」，
而 `set-instance-mode` 的 actor 在**单元 A** 交付并收口。
⇒ **单元 A 必须把这个生效点做成可扩展的**（例如一个按序执行的「角色变更副作用」列表），
使单元 B 只需注册一项、**不必回改 A 已冻结的 actor**。
⚠️ 不这样做，「A 收口后再冻结 B」就不成立。

**约束四 · 门面 `dispatchCommand` 的按名派发必须能带完整身份 options。**
`requestId`/`commandId`/`parentCommandId`/`routeContext` 四项缺一，
§4.7.2 ⑤ 的双观察合并（两侧同 `commandId`）在 B 期就不成立，
而 A 的门面签名届时已冻结。⇒ **A 期就要把签名定全**（§4.2）。

**触点（不是契约，但同样必须登记）· `CommandExecutionObservation.displayMode`。**
A 期在分发器里构造观察时**恒写 `null`**；B 期改为从 `routeContext` 取值。
**B 只改这一处赋值，不改类型、不改调用点**（§4.7.2 ⑥）。
⚠️ 它与契约二同样落在分发器里，但规模是一行赋值，因此不升为契约；
**登记在此，是为了让 A 的评审知道有这么一处**。


**共用前置**（两个单元都要读）：§0–§3 判读 · §2 全节 · §5 明确不做 · §7 欠账 ·
§10 决策记录 · §11 评审历史。
🔴 **A/B 划分的唯一正本是上面这张表加下面契约一那张逐小节表。**
各小节标题上的【单元 X】是**索引**，与两张表冲突时以表为准
（已知一处：§4.2b 标题标【A】而其 ② 属 B，表里已注明）。
本节开头那句「`§4.1–4.6` 与 `§4.8a` 不依赖台账」是切分的**动机**，不是划分本身。

**评审顺序**：A 收口后再冻结 B。B 依赖 A 的命令管线与角色 slice；A 不依赖 B。

---

## 0 · 这份文档怎么读

**一 · POC 里每一个东西都有产品用意，只是可能实现得不好。**
判读的职责是**读懂那个用意**，再判断 TER 要不要、以及实现得好不好。
⚠️ **不得用「有没有生产调用」作为否定某个能力的论据。**
要否定一项能力，必须给出「**这个产品用意在 TER 不成立**」的理由。
「零消费者」只能作为**去查证产品用意**的线索，不能作为结论。

**二 · 本文所有 POC 事实都带 `file:line`，且已逐条回源亲验。**
若你要驳回本文的某条结论，请打开对应源码 —— 本文欢迎被打脸，
但不接受「文档这么写的」或「注释这么说的」这类依据：
POC 里至少有两处注释与它自己所注释的函数不符（§3.3 的启动顺序、§3.4 ④ 的重入范围）。

**三 · 判据是「方案对不对」，不是「闭环自洽不自洽」。**
本文若有过度设计、方向偏离或该做没做的地方，请直接指出。

**四 · Dexter 的裁定集中列在 §10**，正文引用时标日期。

---

## 1 · 包定位

**它把一组各自独立声明的 `AppModule` 变成一个能跑的应用。**

前三个包分别给了：共享词汇（`contracts`）、通往外部世界的门（`platform-ports`）、
状态与持久化的执行机制（`state`）。**但到现在为止，没有任何东西会「驱动」——**
命令没人分发、actor 没人调用、模块没人按依赖顺序装配。`runtime` 就是那个驱动者。

### 1.1 它是 `TR-01` 与 `TR-09` 第一次真正被执行的地方

`TR-01` 说「reducer 只能被 actor 调用，且只由 command 驱动」。
前三个包是 toolkit，没有 slice 也没有 actor，这条规则**无从执行**。
到 `runtime` 才第一次有「命令 → actor → reducer」这条链。

⇒ **`runtime` 不只是遵守 `TR-01`，它是 `TR-01` 的执行者。**
别的包能不能遵守，取决于它给了什么 —— 具体见 §4.3 的上下文能力面。

### 1.2 `state` 已经为它留了两个接口

- `StateResetActor.handleResetCommand()` —— `state` 明写「未来 `kernel.base.runtime`
  只把它绑定到 command actor」；
- 根级 reset action 是 package-private 的 ⇒ **`command → actor → dispatch` 这条链只能由 runtime 建起来**。

### 1.3 `contracts` 已经声明了它的职责边界

`AppModule` 声明了 `commands`（带 `visibility`）· `actors` ·
~~`middlewares`（带 `priority`）~~（**本批删除**，§6 第三组）·
`slices` · `dependencies`（带 `optional`）；`request.ts` 声明了命令与请求的生命周期与快照形状。

⚠️ **但「实现 contracts 声明的东西」不等于「只用 contracts 的类型」。**
`AppModuleCommandDescriptor` 只有 `{name, visibility?}`，是**清单条目**（供装配、内省、门使用）；
runtime 的 `CommandDefinition` 还需要 `allowNoActor`/`allowReentry`/`defaultTarget`/`timeoutMs`
这些**执行策略**。两者形状不同是正常的，不要试图让清单条目承担执行策略。

---

## 2 · 三种部署形态 —— 一套代码必须同时支持

TER 从立项起就定了：**同一套代码**要同时支持下面三种形态。
这是本包的**第一约束**，先于其它一切设计判断。

| 代号 | 形态 | 机器数 | JS 环境数 |
|---|---|---|---|
| **T1** | 主机主屏 + **副机副屏** | 2 | 2（每机一个） |
| **T2** | 主机主屏 + **副机主屏** | 2 | 2（每机一个） |
| **T3** | **单机双屏**（主屏 + 副屏） | 1 | **1**（`TER_SINGLE_VM_SINGLE_STORE_MULTI_SURFACE`） |

### 2.1 POC 的派生模型 —— `workspace` 轴的存在理由

`topology-runtime-v3/src/foundations/runtimeDerivation.ts` 第 16-36 行：

```js
standalone   = displayIndex === 0
instanceMode = configState.instanceMode ?? (standalone ? 'MASTER' : 'SLAVE')
displayMode  = configState.displayMode  ?? (standalone ? 'PRIMARY' : 'SECONDARY')
workspace    = (instanceMode === 'SLAVE' && displayMode === 'PRIMARY') ? 'BRANCH' : 'MAIN'
```

活的组合只有三个：

| instanceMode | displayMode | workspace | 含义 |
|---|---|---|---|
| MASTER | PRIMARY | MAIN | 主机主屏 |
| SLAVE | SECONDARY | **MAIN** | 副屏 —— 与主机**共用**工作区，靠 `master-to-slave` 镜像下来 |
| SLAVE | PRIMARY | **BRANCH** | 副机主屏 —— **自己的**工作区，靠 `slave-to-master` 回传 |

🔴 **`workspace` 轴的存在理由就是「副机副屏 vs 副机主屏」**：`BRANCH ≡ SLAVE + PRIMARY`。
这也解释了 `ui-runtime-v2` 为什么把 `screen.branch` 声明成 `slave-to-master`、
而 `screen.main` 是 `master-to-slave`。

⇒ **T1 与 T2 在 POC 里是一等形态**，靠 `instanceMode × displayMode → workspace` 这个派生区分。
准入规则也在（`topology-runtime-v3/src/foundations/eligibility.ts`）：
切 SLAVE 时受管副屏与已激活主机都被拒；改 `displayMode` 只允许独立副机。

🔴 **T1/T2 在状态层是靠 scoped slice 的「每个 scope 值各有一份 persist/sync 配置」成立的。**
`scopedSlice.ts` 的设计意图注释：

> scoped slice 用来表达「同一类状态按 workspace/display/instance 等轴复制多份」的场景。
> 复制规则在这里统一生成，业务包只关心声明 axis 和 reducers。

而 `resolveScopedValue` 允许**每个 scope 值有不同的 persist/sync 配置** ——
`ui-runtime-v2` 正是这么用 workspace 轴的：

```ts
syncIntent: { main: 'master-to-slave', branch: 'slave-to-master' }
```

⇒ 同一族 UI 状态，MAIN 那份主机权威下发（T1：副屏镜像主机），
BRANCH 那份副机权威回传（T2：副机主屏有自己的工作区）。
✅ **`kernel.base.state` 已经建了 `workspace` 轴**，这一半是就绪的；
缺的是 `displayMode`（要求一）。

### 2.2 POC 的「单机双屏」不是单 JS 环境 ⇒ T3 没有先例

`host-runtime-rn84/src/application/resolveTopologyLaunch.ts` 第 20-23 行的设计意图注释：

> Android assembly 的主副屏都必须通过真实 loopback topology host 通讯。

第 60-65 行给副屏派生独立节点 id `${masterNodeId}:display-${displayIndex}`；
`hostApp/createHostApp.tsx` 第 51-52 行每块屏一套 props（`displayIndex`/`displayCount`），
第 151 行每个实例一个 runtime 与一个 store；
`application/bootstrapRuntime.ts` 第 11-29 行按 `displayIndex` 决定这个实例是 MASTER 还是 SLAVE。

⇒ **POC 把 T3 降格成了 T1 的同机特例：两个 JS 运行时，走本机 WebSocket 互联。**
TER 已裁定 `TER_SINGLE_VM_SINGLE_STORE_MULTI_SURFACE` —— **一个 VM、一个 store、多个 Root Surface**。
⇒ **T3 在 TER 是新形态，这一块没有 POC 实现可抄。**

### 2.3 由此对本包产生的四条要求

**要求一 · `displayMode` 只能随命令走，不能是 runtime 的状态。**

🔴 **依据是已有裁定，不是新论证**
（`project-memory/decisions/terminal-architecture-and-stack-rulings.md:31`）：

> `displayMode` / `containerKey` **随命令传入**；`workspace`（MAIN/BRANCH）是**设备级工作上下文**，
> 两屏共享。

⚠️ **Dexter 2026-08-31 补充裁定：双屏设备不能整体作为 pair 的副机。**
⇒ 副机必然是单屏设备 ⇒ 不会出现「同一个 store 上同时有 `(SLAVE,PRIMARY)→BRANCH`
与 `(SLAVE,SECONDARY)→MAIN`」的组合 ⇒ 上面那句「设备级、两屏共享」成立且稳定。

**为什么 `displayMode` 必须 per-dispatch**：POC 能把它放进 runtime 的单值状态，
是因为**它每个 runtime 只服务一块屏**；T3 打破这个前提 —— 一个 runtime 两块屏、一个 store，
**UI 状态要按屏分片、命令必须说明自己落在哪块屏**。
POC 把这个 API 建好了却从没用（`createDisplayModeActionDispatcher` 强制要求 routeContext、
缺了就抛，`state-runtime.spec.ts:1114-1117` 有断言）——**正因为它自己的部署形态用不上**。

⚠️ **理由是「T3 的写侧分片」，不是「派生 `workspace`」。**
本文早先写过后者（「没有 `displayMode` 就派生不出 `workspace`」），**那是编的** ——
`workspace` 既然是设备级，它的派生用设备级的 `displayMode` 就够，per-dispatch 那个不参与。

⚠️ **TER 当前完全没有 `displayMode`**：`apps/terminal/kernel/base/*/src/` 全域 grep
`PRIMARY|SECONDARY|MASTER|SLAVE` **零命中**；`contracts.CommandRouteContext` 只有
`workspace?: string` 与 `instanceMode?: string`，且都是**开放 `string`**。
契约变更见 §6 第二组。

**要求二 · `routeContext` 必须被子命令继承。**

POC 的 actor 上下文 `dispatchCommand`（`runtimeCommandDispatcher.ts:234-237`）是：

```js
dispatchCommand: childCommand => dispatchLocal(childCommand, {
    requestId,
    parentCommandId: dispatched.commandId,
}),
```

**`routeContext` 被丢掉了。** T3 下这是致命的：副屏发的命令，
其 actor 再发子命令去写 UI 状态时屏归属已经没了 ——
要么按 `displayMode` 分片的 dispatcher 直接抛错，要么写进错误的那一份。

⇒ **规则两条（Dexter 2026-08-31 裁定）**：

**① 默认继承。** 子命令沿用父命令的 `routeContext`，与 `requestId` 同等待遇。

**② 🔴 actor 要让某条子命令落到**另一块屏**时，必须**显式发一条那块屏的命令**。**
Dexter 原话：「主屏操作要在副屏弹提示，这种情况主屏的 actor 要**明确发一个副屏的 command**。」

⇒ 这条同时把**要求四**定死了：`ActorDispatchOptions.routeContext`
**必须真正实现**（POC 静默丢弃它，见要求四）—— 因为它**就是**「明确发一个副屏 command」的机制。
两条要求不冲突，是同一件事的默认支与显式支。

⚠️ **显式传的 `routeContext` 整体替换继承来的，不做逐字段合并。**
理由是 Dexter 强调的「**明确**」：半继承半覆盖会让人读不出这条命令最终落在哪块屏。
若调用处嫌啰嗦，详设可给一个纯函数 helper（例如 `withDisplayMode(ctx, 'SECONDARY')`），
但那是**调用方的便利**，**不得**变成管线的隐式行为。

**要求三 · 台账记录必须带 route 归属 —— 两个字段，两个层级。**

T3 下两块屏共用同一个 store、同一份台账 ⇒ 不带 route 归属就分不出谁发的、
也分不出一条命令该落到哪块屏。

| 字段 | 性质 | 记在哪 |
|---|---|---|
| `workspace`（`'MAIN'\|'BRANCH'`） | **设备级**，一个 request 内恒定 | 请求级 |
| `displayMode`（`'PRIMARY'\|'SECONDARY'`） | **真正 per-dispatch** | 命令级 |

⚠️ **不存 `instanceMode`**（台账分片已按角色编码），**也不存 `workspace` 的两个推导输入**。
形状与理由见 §4.7.2 ⑥。

**要求四 · `ActorDispatchOptions` 要么实现、要么不声明。**

POC 的 `types/command.ts:49-52` 声明了 `{target?, routeContext?}`，
`types/actor.ts:37-40` 把它写进 `dispatchCommand` 第二参数，
**而实现只接一个参数、静默丢弃第二个**（同上 234-237 行）。
唯一真实传参处 `terminal-log-upload-runtime-v2/.../uploadActor.ts:132-134` 传 `{target:'peer'}`，
之所以仍然走 peer 是因为目标命令自带 `defaultTarget:'peer'` —— **效果被掩盖了**。
⇒ 不得留下「声明了但不生效」的第三种状态。

### 2.4 归属切分：哪一块归本包，哪一块不归

骨架里已有 `kernel.base.display-context`（`skeleton-graph.ts:34-39`：
依赖 `contracts` + `state` + `runtime`；`ui-state` 依赖它）。据此：

| 能力 | 归属 | 理由 |
|---|---|---|
| `instanceMode`（`'MASTER' \| 'SLAVE'`） | **本包** | 台账分片必需；且 runtime 不能反向依赖 `display-context` |
| `routeContext` 的**承载、继承、记账** | **本包** | 它是命令管线的事 |
| `displayMode` 的**设备级**持有 · `workspace` 的派生 · 形态切换的准入 | **`display-context`** | 派生要同时读 runtime 的 `instanceMode` 与自己的 `displayMode`；它依赖 runtime，方向正确 |
| 每块屏的 UI 状态如何分片 | **`ui-state`** | 候选：`displayMode` 轴，或 POC 生产里实际用的「同一 slice 内 `primary*`/`secondary*` 两组字段」。⚠️ **第一个候选需要重开已收口的 `state`** —— 它只交付了 `workspace` 一轴的 helper，且其 README 已写「`containerKey` 与随 command 传入的 `displayMode` 是**同一个 owner slice 内部的路由键**，不是需要拆成多份 reducer 的物理轴」。选它就是推翻那句 |
| 🔴 **T3 下谁在每次 dispatch 上盖 `displayMode`** | **`ui.base.render`**（可能配合 `ui-state`） | 见下 |

🔴 **最后一行是 T3 真正跑起来的关键，必须单独点名。**
T1/T2 下一个 runtime 只服务一块屏，理论上 runtime 自己就能盖章；
**T3 下一个 runtime 两块屏，runtime 无从知道这条命令来自哪块屏** ——
只有**发起它的那个 Root Surface** 知道。

⇒ **要求（落点不在本批）**：每个 Root Surface 必须携带自己的 `displayMode`，
并在该 surface 内发出的命令上**自动盖章**，
**不得让每个业务组件自己传** —— 漏传一处就写错屏，而且是静默写错。

⚠️ 这与「UI 状态怎么分片」**不是同一件事**：分片是**读写状态**的问题，
盖章是**发命令**的问题。**两者缺任一个，T3 都不成立。**

#### 2.4.1 `displayMode` 有**两个**来源，用途不同，两个都必须有

🔴 **这是本文早先只写了半句的地方**（只写了「持有归 `display-context`」，
没写它从哪来、怎么设），必须在这里写死边界，否则它会掉进无人区。

| 来源 | 是什么 | 用途 | 谁拥有 |
|---|---|---|---|
| **设备级配置** | 持久化 slice 里的一个字段，默认 `PRIMARY`，用户经命令改 | **参与 `workspace` 派生** | `display-context` |
| **per-surface 值** | 每个 Root Surface 从 `initialProps` 拿到（`TER_SINGLE_VM_SINGLE_STORE_MULTI_SURFACE`：「Kotlin 按屏传不同 `initialProps`」） | **盖在该 surface 发出的命令上** | `ui.base.render` |

🔴 **T1 与 T2 的区别，本质上就是副机上设备级 `displayMode` 的取值。**

两者的副机都是**单屏**设备，物理上那块屏都是主屏。区别是**用户想让这台平板干什么**：

| 用户的选择 | `displayMode` | `workspace` | 形态 |
|---|---|---|---|
| 当主机的**副屏**用 | `SECONDARY` | `MAIN` —— 镜像主机工作区 | **T1** |
| 当**独立副机**用 | `PRIMARY` | `BRANCH` —— 自己的工作区 | **T2** |

⇒ **这不是物理属性，Kotlin 不知道** ⇒ 设备级那份**必须可配置、必须持久化**，
与 `instanceMode` 完全同构（§4.8a：默认值 + `internal` 写命令 + `owner-only` + `immediate` +
**`isolated` 绝不同步**）。
✅ POC 同形：`configState` 一个 slice 装 `instanceMode`/`displayMode` 两个字段，都是
`flushMode:'immediate'`；`setDisplayMode` 的准入是
`getTopologyV3DisplayModeEligibility` —— **只允许独立副机改**，
因为那正是 T1↔T2 切换的入口（`TER_PAIR_TOPOLOGY_WITH_DETACHABLE_SECONDARY`
的「副屏平板拿下来当主屏」）。

⚠️ **为什么 `instanceMode` 在 runtime、设备级 `displayMode` 在 `display-context`** ——
不是随手分的，是依赖方向决定的：**runtime 需要 `instanceMode` 来分台账 slice，
但不需要 `displayMode`**；而 `display-context` 两个都要读。这个不对称有理由，不要「统一」掉。

⚠️ **T3 下两者并存、不冲突**：双屏设备只能是 MASTER（Dexter 2026-08-31 裁定），
设备级 `displayMode = PRIMARY` ⇒ `workspace = MAIN`、两屏共享；
而两个 Root Surface 各自带 `PRIMARY`/`SECONDARY` 去盖命令的章。
**设备级那份用于派生工作区，per-surface 那份用于命令归属** —— 用途不同，所以不打架。

⚠️ **本批不做 `displayMode` 的派生与准入**（那两件归 `display-context`）。本批做的是：
① 让 `contracts` **有能力表达它**（§6 第二组，**单元 B**）；
② 让 runtime **忠实承载并继承它**（§4.3 的 `routeContext` 继承，**单元 A**）；
③ 让台账**记下它**（§4.7.2 ⑥，**单元 B**）；
④ 让合并 selector 支持**按它过滤**（§4.7.2 ⑥，**单元 B**）。

⚠️ **② 与 ① 的单元不同，这是一个真实的顺序约束**：单元 A 的 `routeContext` 继承
只需要**原样搬运** `CommandRouteContext` 这个对象，**不读它的字段**，
所以 A 不依赖 §6 第二组的字段变更 —— **「A 不依赖 B」仍然成立**，但详设必须写明
「A 期的继承是**不透明搬运**」，不得在 A 里写任何读 `displayMode` 的代码。

---

## 3 · POC 判读

### 3.1 两个运行时是两个模型，不是重复

| | `runtime-shell-v2`（生产在用） | `execution-runtime` |
|---|---|---|
| 命令模型 | **一命令 → N 个 actor 并行**（`Promise.all`），逐 actor 结果，聚合成命令状态 | 一命令 → 一 handler |
| 跨机 | **有 `peerDispatch`** | 无 |
| 横切 | **无中间件、无生命周期事件流**，自己又写了一份 `normalizeError` | **洋葱中间件 · 有界 journal · 统一错误归一化 · 命令作用域 logger** |
| 子命令 | actor 可再发命令（经 dispatcher） | `dispatchChild` 走同一条管线 |
| 生产接线 | 唯一真实分发器 | 🔴 **全仓零生产依赖** —— 穷举后除自身 `package.json`/`vitest.config.ts`/`src/`/测试外无人引用 |

⇒ **生产那条有对的模型，缺横切机制；另一条有横切机制，模型不对。**
本批建**一个**运行时：**取 shell 的模型，吸收 execution-runtime 的三件横切**。

### 3.2 从 `execution-runtime` 吸收三件，**不吸收中间件**

**① 错误归一化。** 任何抛出物在**命令边界**变成带
`commandName/commandId/requestId/sessionId` 上下文的 `AppError`，
原始错误进 `cause`/`details`，`isAppError` 透传避免二次包装，并落一条 error 日志。

> 🔴 这解开了一个容易误判的点：`contracts` 的错误协议**不是没有消费者**，
> 它的消费者就是这里，而且位置精确 —— **命令边界**。
> 构造期程序员错误用裸 `Error`、跨命令边界的错误归一化成 `AppError`，是一个自洽设计。

⚠️ 全仓有 **8 处** `normalizeError`。分发器那份**不填 `details`、不写日志**；
`execution-runtime` 那份填 `details.error{name,message,stack}`、带 `sessionId`、落 error 日志。
**取后者，全包只留一份。**
另：分发器的错误 key 是**内联定义**、内部模块清单未声明它 ⇒ 它永远进不了 error catalog。

**② 命令作用域 logger。** `logger.withContext({requestId, commandId, commandName, sessionId})`。
⇒ 这解释了 `platform-ports` 的 `LogContext` 为什么恰好是那几个字段 —— **零件是配套的**。
命令执行期间的每一条日志自动带相关性 ID，不需要每个 actor 自己传。

**③ 有界 journal + 生命周期钩子。** `append(started|completed|failed)`，带 `internal` 标记；
`maxJournalRecords` 默认 1000、从头裁；有全局 `onLifecycleEvent` 与每次调用的 `options.onLifecycleEvent`。

**④ 洋葱中间件 —— 不吸收。** 理由见 §5。

### 3.3 模块系统与生命周期

**真实启动顺序**（`runtimeLifecycle.ts` 与 `createKernelRuntimeApp.ts` 逐行核过）：

```
resolveModuleOrder → 构造 runtime（store/slice/actor 全部注册）
  → preSetup × N（只由 app 级入口调）
  → hydratePersistence → install × N → bootstrapCatalogs → 广播 initialize → resolve
```

⚠️ `runtimeLifecycle.ts:105-109` 的注释说「先恢复 state-runtime，**再注册 catalog，再 install**」，
**与它自己所注释的函数不符** —— catalog 在 `runInitialize` 内、在 install **之后**。
真实后果：install 里调 `resolveParameter` 读不到 catalog，只能拿 `source:'default', valid:false`。

**`resolveModuleOrder`（49 行）三道检查，整体继承**：重复模块名即抛 ·
`pending`/`visited` 三态 DFS 环检测 · required 依赖缺失即抛。
`optional` 的精确语义是**这个模块可以整个不存在**（`continue` 跳过），不是「依赖可空」；
optional 但存在时照常参与排序与环检测。依赖先于依赖者入序。

🔴 **但 `resolveKernelRuntimeModuleOrderV2` 只有一个调用点**（`createKernelRuntimeApp.ts:55`），
`createKernelRuntimeV2` **不调它**
（`createKernelRuntimeV2.ts:35-38` 只前置内部模块）⇒ **直接建 runtime 就没有依赖排序、
没有环检测、没有重名检测**，模块按数组原序 install。测试里大量走这条路。

**其它无护栏之处**：slice 名重复在 `state-runtime/src/foundations/store.ts:29-33` 静默 last-wins；
`actorKey` 重复无检查；`commandDefinitions` **不参与注册** ——
路由完全靠 `actorDefinitions` 里 handler 的 `commandName` 字符串
（`runtimeActorRegistry.ts:10-23`），**命令没在清单里声明也照样能跑**。

**内部模块**：`createRuntimeShellInternalModuleV2` 在 `createKernelRuntimeV2.ts:36` 被**前置**，
永远是 `modules[0]` ⇒ slice、actor 顺序、描述符都排在业务模块之前。
它承载两个 catalog slice + 5 条 `internal` 命令 + 1 个 catalog actor，
**且不处理 `initialize`** —— 这正是 `initialize` 声明 `allowNoActor: true` 的原因。

**`preSetup`**：只由 `createKernelRuntimeApp.ts:38` 调用，`lifecycle.start()` 从不调；
在 `hydratePersistence` **之前**、逐模块串行 await、按依赖序；
上下文是**只读的**（`types/module.ts:105-111` —— 无 store、无 dispatch）；
真实用途是 `registerUiRendererParts`：**必须先于 React 渲染完成的模块级注册**。
⚠️ 它拿到的 `descriptors` **不含**内部模块，而 `install` 拿到的**含** —— 同一次运行两份长度不同。

**`initialize` 是一条真正的命令**，不是广播回调 —— 它走完整分发链，
`visibility:'internal'`、`allowNoActor:true`、`timeoutMs` 默认 60000。

**模块钩子只有三个**：`preSetup` · `install` · `onApplicationReset`。
`KernelRuntimeV2` / `KernelRuntimeAppV2` / `KernelRuntimeModuleV2` **都没有
`stop`/`dispose`/`destroy`/`shutdown`/`uninstall`** —— runtime 从不拆卸。
⚠️ **而且 `install` 里注册的订阅从不解绑**：`subscribeState` 返回 unsubscribe 函数，
但 `src/` 里没有任何调用方保存它。

⇒ 本批的处置见 §4.5b（那是**建设要求**，不该藏在 POC 判读里）。

**启动失败无重试路径**：`startPromise` 在 rejection 后**不清除**
（`createKernelRuntimeApp.ts:81-83`、`createKernelRuntimeV2.ts:125-127`），
此后每次 `start()` 返回同一个 rejected promise，`started` 恒 false。
⇒ 「不可重试」在 POC 里是**意外行为**而非声明。

**`autoStart`**：存在，但**全仓没有任何调用方设 true**，
实现是 `void start()` fire-and-forget、**rejection 无人观察**。

### 3.4 命令分发与 actor 执行

**① 排序只决定启动顺序，不决定完成顺序。**
`order` 是注册期的全局单调计数器（`runtimeActorRegistry.ts:5` 声明、`:20` 自增），
分发时 `handlers.sort((l,r)=>l.order-r.order)` 之后是 `Promise.all(handlers.map(...))` ——
map 按序启动，各 actor 并发完成。
⇒ **一个 actor 不能依赖另一个 actor 的副作用已经发生。**

**② actor 级超时，预算来自命令定义。**
`Promise.race([execution, timeout])`，定时器在调 handler **之前**就已 armed，
提前完成会 `clearTimeout`。每个 actor 一个独立定时器，无 per-actor 覆盖能力。

**③ 超时不取消 actor，只停止等待。** JS 无法取消 promise。
而且 actor 手里不只有 `dispatchAction` —— 还有子命令、`flushPersistence`、整套 `platformPorts`。
⚠️ **栈帧在超时那一刻就被弹出**（`finally` 在 `race` resolve 后立即执行）
⇒ **重入保护在 actor 仍在运行时就已解除**。迟到的返回值被整个丢弃。

**④ 重入检测的真实含义。** `executionStack` 是被并发 actor 共享的可变数组，
检查是 `some(同 requestId && 同 commandName && 同 actorKey)`。
⇒ 它防的是「**同 (request, command, actor) 已经在运行**」，**不只是递归** ——
同一 request 内并发的两个同名命令，第二个也会被判为重入。
POC 注释说的是「递归重入」，**实现比注释更宽**。`allowReentry` 可放行（全仓 5 处真实用例）。

**⑤ actor 返回值：不校验、不深拷贝。**
`result: result ?? undefined`（`:257-264`），类型是 `Record<string, unknown> | void`，
**直接持有 actor 返回的对象引用**。有 actor 用返回值表达「我没处理」（`{routed:false}`），
状态仍是 `COMPLETED` —— 这是真实用法。

**⑥ actor 抛异常永远不会让 `dispatchCommand` reject**，只降级为该 actor 的 `FAILED`
（异步 `.catch`、同步 `try/catch` 两条路都覆盖）。大量真实 actor 依赖这一点直接 `throw`。

🔴 **但 `Promise.all` 的 map 回调只有 `try/finally`、没有 `catch`**（`:222-293`）
⇒ **台账写入若抛错，整个 `dispatchLocal` 会 reject 而不是返回聚合结果。**

**⑦ 命令状态聚合**（`aggregateStatus`，`:53-71`）：
空集 → `allowNoActor ? COMPLETED : FAILED`；任一 `TIMEOUT` → `TIMEOUT`；
零失败 → `COMPLETED`；全失败 → `FAILED`；否则 `PARTIAL_FAILED`。

**⑧ `commandName` 有逃逸口。** `foundations/command.ts:7-9`：含 `.` 就原样保留，
否则才拼 `${moduleName}.`。而 `handlersByCommand` 是一张**扁平 Map、无模块隔离**
⇒ 任何模块都能劫持别的模块的命令名。
POC 自己的 `createRemoteCommandDefinition`（`connectionController.ts:65-69`）正是靠这个洞工作，
代价是**重建 definition 时丢掉 `allowNoActor`/`timeoutMs`/`allowReentry`** ——
真实后果：`allowNoActor:true` 的命令跨机且对端无 actor 时被**误判为失败**。

**⑨ `visibility` 全仓无人读。** 穷举确认：只有写入与类型声明，**分发路径零处校验**，纯死元数据。
⇒ 它的用意见 §4.2，本批把它接线。

**⑩ 上下文能力面。**
actor 上下文：`runtimeId` · `localNodeId` · `platformPorts` · `displayContext` · `command` · `actor` ·
`getState` · **`dispatchAction`** · `flushPersistence` · `subscribeState` ·
**`dispatchCommand`（子命令，自动继承 `requestId`，并把自己的 `commandId` 设为子命令的
`parentCommandId`）** · `requestApplicationReset` · `queryRequest` · `resolveParameter`。
⚠️ **但它不继承 `routeContext`** —— 那正是 §2.3 要求二要修的。

🔴 **但模块上下文也有 `dispatchAction`**（`types/module.ts:32`，全仓 190 个调用点）
⇒ install 期的代码可以绕过命令直接改 store —— **这是 POC 里 `TR-01` 的一个洞**。
`getStore()` 也在模块上下文上，**全仓零消费者**。

⚠️ `displayContext` 是 `createKernelRuntimeApp` 的**构造输入**（`config.displayContext ?? {}`），
**不是包依赖** ⇒ TER 的 `display-context` 依赖 `runtime` 而非反向，**不存在循环依赖**。

### 3.5 reset 是延后执行的

actor 调 `context.requestApplicationReset(input)` 只是**登记**
（`pendingResetByRequestId.set(requestId, ...)`）；真正执行在**根命令完成之后**
（`:303-309`，`options.parentCommandId == null` 才触发）：

```js
const pendingReset = pendingResetByRequestId.get(requestId)
if (pendingReset) { pendingResetByRequestId.delete(requestId); await input.resetApplicationState?.(pendingReset) }
```

⇒ **顺序是刻意的**：不能在 actor 执行途中把 store 重置掉。
执行体是 `ledger.clear()` → `resetState()` → `onApplicationReset` 钩子 → **再次广播 `initialize`**。

⚠️ **诚实声明**：`requestApplicationReset` 在 POC 里**全仓零调用者**
（runtime 级的 `resetApplicationState` 是活的，host-runtime 在用）。
**Dexter 2026-08-31 裁定：本批做**（§10）。

### 3.6 跨机 request：POC 有三条路径，只有一条活着

**路径甲 · 主动派发（生产接通）。**
`dispatchLocal` 里 `target === 'peer'` 分支，注释写明了产品用意：

> peer 执行仍然先登记本地 request，这样**前端 selector 能同步看到「已开始」**，
> 再等待拓扑网关回填远端结果。

流程：actor 发子命令、`target:'peer'`、**带同一个 requestId** → **先 `ledger.registerCommand`**
→ 经 `peerDispatchGateway.dispatchCommand` 派到远端并 await → 拿到结果后 `completeCommand`。
装配方是 topology（`topology-runtime-v3/src/application/createModule.ts:152`
调 `context.installPeerDispatchGateway`）。
⚠️ **同一命令在两机用完全相同的 `requestId` 与 `commandId`**；
发起端把远端明细**嵌套**进一条 `peer-dispatch` 的 `result`（一个无类型 blob），不展开。

**路径乙 · 被动接收快照。** `registerMirroredCommand` + `applyRequestLifecycleSnapshot`。
实现是 `snapshot.commands.map(...)` 造一个全新数组再 `records.set(requestId, record)` ——
**整条替换**，不按 commandId 合并、不比较新鲜度 ⇒ **旧快照能把终态拉回 `started`**。
🔴 **且它是死的**：`registerMirroredCommand` **零生产调用**，
`applyRequestLifecycleSnapshot` **零 context 消费者**，
`request-snapshot` **有接收分支但全仓无发送方**。

**路径丙 · 远端命令级进度事件。** `applyRemoteCommandEvent(envelope: CommandEventEnvelope)`，
`eventType` 是 `accepted/started/resultPatch/completed/failed`。
POC 在这里留了一条必须继承的注释：

> 远端 `accepted`/`started` 只是**执行屏障事件**，不能提前映射成 `TIMEOUT`，
> 否则运行中 selector 会产生**假失败信号**。

⇒ **进度事件不得被当成终态。**
🔴 **但这条路径自我抵消**：`connectionController.ts:527` 先调 `applyRemoteCommandEvent` 写进度，
随后 promise resolve、`completeCommand` 用**整数组替换** `actorResults`，
于是 `'runtime-shell-v2.remote-event'` 那条**被 `'runtime-shell-v2.peer-dispatch'` 顶掉** ——
远端逐步上报的进度全丢。

**其余出口全是死的**：`sendStateSnapshot`/`sendStateUpdate`/`sendCommandDispatch`/
`sendCommandEvent`/`sendRequestSnapshot`/`sendProjectionMirror` **六个出口全仓零调用**；
`state-diff` 与 `projection-mirror` 两个消息类型**在 switch 里没有 case**。

⇒ **本批只保留「合并后重算」这个思想，不保留这三条路径的实现。**
台账改成 slice 之后，跨机走 `state` 的同步、读侧用合并 selector（§4.7）。
**不建** `registerMirroredCommand` · `applyRequestLifecycleSnapshot` · `CommandEventEnvelope`。

🔴 **`RequestLifecycleSnapshot` 为什么长成那样，到这里才解释得通**：
它带 `commands[]` + `commandResults[]` + `ownerNodeId`/`sourceNodeId`/`targetNodeId`，
**因为它就是路径乙的线格式**，不是冗余设计。
⇒ **命令明细不能删**，它既是 request 状态的推导输入，也是跨机合并的载荷。

### 3.7 角色与热切换

**切换是一条命令**：`setInstanceMode`（`topology-runtime-v3/src/features/commands/index.ts:7`），
handler 在 `contextActor.ts:77-93`：准入检查（只对切 SLAVE 做）→ `patchConfigState` →
`replaceContextState` → `syncHostLifecycle`。**闭集 `'MASTER'|'SLAVE'`，不是开放字符串。**

**方向立即翻转、不用重连**：出站方向每次 state 变化重读 `contextState.instanceMode`
（`connectionController.ts:567-576`），入站每条消息重读（`:39-48`）。

🔴 **但 POC 的热切换是不完整的**，四条事实：

- **出站 diff 基线不重置** —— `previousState` 在 orchestrator 创建时初始化一次（`:258`），
  此后只在订阅回调末尾滚动（`:559`、`:585`），切换时不重置
  ⇒ 切换后第一批 diff 是对着**切换前的本地快照**算的，与对端真实状态无关；
- **服务端角色表不更新** —— `peerByRole` 只在 `hello` 时按 `instanceMode` 写入，不重连就不更新；
- **在途跨机命令既不 resolve 也不 reject** —— `rejectPendingRemoteCommands`
  只在 disconnect 路径被调，角色切换不触发；`dispatchRemoteCommand` 自身**没有超时**，
  只靠 60 秒 actor 超时兜底；
- **全仓没有一条测试覆盖「连接活跃时切换 `instanceMode`」**。

🔴 **同步应用侧不校验方向**：`applyStateSyncDiff` **只看 slice 有没有 `sync` 描述符，
不读它自己的 `syncIntent`**（`runtimeStateSync.ts:10`、`:22-49`），
方向过滤**只存在于发送侧**（`syncRegistry.ts:34-37`、`:88-93`）。
POC 仓里已有 3 个 `syncIntent:'isolated'` 却带 `sync` 描述符的 slice，
入站 diff 命中它们会被照常应用。

**重连时的补齐机制**是 `hello-ack` 触发的**全量快照 + `replaceMissing: true`**
（`connectionController.ts:466-485`、`syncRegistry.ts:141`）—— 单写者 slice 正好吃这套。

### 3.8 当前 POC 的请求台账：形状对，实现有四个问题

**形状**（`MutableRequestRecord → MutableCommandRecord → ActorExecutionResult`）是三层，
与 §4.7.2 一致。**问题在别处**：

1. 🔴 **状态是存下来的，而且写入源不止一个。** request 状态由 `toRequestStatus` 算后存，
   但有 **2 条路径绕过它**（快照直接赋值、`clear()` 直接写 FAILED）；
   命令状态**根本不在台账算**、由 dispatcher 的 `aggregateStatus` 传入，
   而有 **4 个写入源绕过 `aggregateStatus`**（peer 透传、网关缺失硬编码 FAILED、
   远端事件二选一、快照导入）。⇒ **「存下来的状态与事实漂移」的实证。**
2. 🔴 **完全没有淘汰或上限**，唯一删除是 `clear()`；而 `ExecutionJournal` 有 1000 条上限。
3. 🔴 **`rootCommandId` 名不副实** —— 它取的是「第一条为该 requestId 建记录的命令」，
   不是 `parentCommandId` 为空的根命令；快照乱序或 peer 回流时会指向非根命令。
4. **没有终态锁** —— `touch()` 每次全量重算，迟到的子命令能把 request 状态改回去。

**其它可继承的细节**：`clear()` 的精确语义是「非 RUNNING 的记录直接跳过不 emit、
RUNNING 的置 FAILED 再 emit、最后全清」；`subscribeRequest` 订阅瞬间会**回放**一次已有记录
（改成 Redux selector 之后不需要这个机制）。

**唯一的生产消费者**是 host-runtime 的 automation dispatcher：
按 `updatedAt` 倒序列出 + 轮询等待 ⇒ **`updatedAt` 排序是真实需求**。

### 3.9 catalog：历史分析，本批不做

**产品用意**：`tdp-sync-runtime-v2` 的 `systemCatalogBridgeActor` 通过 TDP topic
**接收远端下发的** error/parameter catalog 再写进 runtime-shell 的两个 slice
⇒ 错误文案与系统参数是可以远端更新的，`source: 'default'|'remote'|'host'` 就是判别位。

🔴 **但实现把这个用意摧毁了**：`bootstrapRuntimeCatalogs` 无条件为每个模块的每条定义
dispatch 一次 `setErrorCatalogEntry`，值里带 `source:'default'` 与 `updatedAt: nowTimestampMs()`；
reducer 是**无护栏覆盖**。而它在 `hydratePersistence` **之后**跑
⇒ **远端下发的文案与参数，每次重启后都被默认值冲掉**，`source` 这个判别位形同虚设。
**附带后果**：`updatedAt` 让每条在每次启动都「变化」⇒ 差量比对认为全部变更
⇒ **每次启动把整个目录重写一遍存储**。

⚠️ **以上是历史分析，不构成 TER 的建设要求。**
**动态 catalog 已于 2026-08-28 由 Dexter 整体取消**（§10），
连带删除 `errorCatalogState`、`parameterCatalogState`、`runtimeParameterResolver` 的 catalog 查找、
`systemCatalogBridgeActor` 与两个 TDP topic。职责四分：定义归各包 `supports/errors.ts`、
工厂与模板渲染留在 `contracts`、key 唯一性与全集清单改成**静态门 + 生成的清单常量**
（不是运行期注册表）。
⚠️ **TER 因此也没有 `definition-registry` 包**（22 包清单确认）——
本文不得再以「运行期解析没有别的家」为由把 catalog 归给 runtime。
`contracts` 里那四条被门钉住的 union
（`ErrorCatalogEntry.source` · `ResolvedErrorView.source` ·
`ParameterCatalogEntry.source` · `ResolvedParameter.source`）是**取消之后的遗留类型**，
保留它们不构成任何实现义务。
🔴 **本批一并删除**（Dexter 2026-08-31 裁定，§6 第四组）。
⇒ 本批 runtime **不消费、不解析、不落 slice、不新增任何 catalog consumer**。

保留这段是因为它记录了一种缺陷形态：**用意被冻结成枚举并上了门，实现却把它绕过去。**

---

## 4 · 本批要建什么

⚠️ **每个小节标了所属交付单元**（切分见 §0-A）：
**【A】= 运行时骨架** · **【B】= 请求台账**。

### 4.1 模块系统  【单元 A】

`AppModule` 注册 · 拓扑排序 + 环检测 · required 缺失即抛 / `optional` 跳过（§3.3）。

🔴 **四条比 POC 严**：

1. **只有一条建 runtime 的路径。** POC 两个入口保证不同（§3.3），测试大量走无保护的那条。
   TER 不得有「绕过依赖解析」的构造方式。
2. **模块的命令清单是权威声明** —— 🔴 **但查的是 owning module 的清单，不是 actor 自己模块的。**
   🔴 **字段名是 `AppModule.commands`（条目类型 `AppModuleCommandDescriptor`，§1.3），
   不是 POC 的 `commandDefinitions`** —— 早先版本用错了 POC 的名字。
   条目的 `name` 存**带前缀的全名**（`defineCommand` 拼好的那个），查表时不剥前缀。
   每条被挂载的命令，必须在它的 **owning module** 的 `commands` 里声明；查不到即**注册期报错**。
   🔴 **不需要反向推导算法** —— `defineCommand` 的入参里本来就有 `moduleName`
   （§4.2 的定义字段表），`onCommand` 收的是**定义对象**（§4.2）
   ⇒ **owning module 直接读定义对象的 `moduleName` 字段**，不从命令名反推。
   ⚠️ 早先版本要求「最长前缀匹配 + 紧跟 `.`」并同时「禁止裸名含 `.`」——
   **后者一旦成立，前者与「剥最后一段」在所有输入上等价，论据自我消解**；
   而 POC 之所以需要反推，只因它的 `onCommand` 丢掉定义对象、只留字符串
   （`foundations/actor.ts:14-16`），本文不继承那个形状。
   ⚠️ **仍然保留 `defineCommand` 构造期禁止裸名含 `.`** —— 理由不是消歧，
   而是它是 §4.2「命令名无逃逸口」的一部分（含 `.` 的裸名会绕过前缀拼接的语义）。
   ⚠️ **不得读成「actor 只能挂载自己模块声明的命令」** —— 那会禁掉 100% 的跨模块订阅，
   而跨模块广播正是 §3.1 判定「广播模型赢了 `execution-runtime`」的全部理由。
   POC 实证：`resetTcpControl` 的 8 个生产 handler **7 个在别的包**；
   `initialize` 的 3 个生产 handler **全部在别的包**，owning 包自己一个都没有。
3. **重名一律报错。** slice 名重复（POC 静默 last-wins）、`actorKey` 重复（POC 无护栏）
   都必须在注册期抛。⚠️ **同一命令名挂多个 actor 是合法的**（广播语义），不在此列。
4. **`descriptors` 在所有阶段是同一份**（POC 不是，§3.3）。

**runtime 自己的内部模块。** 它承载（按交付单元）：
**【A】角色 slice**（§4.8a ③，`persistIntent:'owner-only'` —— **本包 `owner` 身份的依据**）
· **`set-instance-mode` 这条 `internal` 命令**；
**【B】两个台账 slice** · 淘汰清理命令。
POC 的做法是把内部模块**前置**到模块列表首位，整体继承。
⚠️ POC 的内部模块只承载 catalog。

### 4.2 命令定义与分发  【单元 A】

**命令定义**（runtime 自己的可执行类型，不是 contracts 的清单条目，§1.3）：
`moduleName` · `commandName` · `visibility` · `timeoutMs` · `allowNoActor` · `allowReentry` · `defaultTarget`。

🔴 **两条比 POC 严**：

1. 🔴 **`commandName` 由 `defineCommand` 在**定义侧**自动加 owning `moduleName` 前缀，
   **没有逃逸口**（不保留 POC 的「含 `.` 就原样保留」）。
   ⚠️ **这条与「跨模块可以挂载别人的命令」（§4.1 第 2 条）不冲突，因为引用侧根本不写字符串**：
   **actor 挂载时传的是命令定义对象，不是命令名**（POC 的 `onCommand(definition, handler)` 就是这样）。
   模块 B 的 actor 要挂模块 A 的命令，就 `import` A 导出的定义对象 ——
   名字已经在定义侧拼好，B **无从伪造也无从劫持**。
   ⇒ **两条规则的分工**：定义侧保证名字唯一且带前缀；**挂载侧**只能用定义对象，不能用字符串。
   ⚠️ 详设**不得**提供任何「按字符串**挂载**命令」的 API —— 那就是逃逸口。
   ⚠️ 配套：`defineCommand` 的**裸名参数不得含 `.`**（构造期抛），
   否则含 `.` 的裸名会绕过前缀拼接的语义（§4.1）。**测试落点见 §8。**
2. **跨机执行时按 `commandName` 查本机已注册的定义，不得重建 definition。**
   POC 重建时丢 `allowNoActor`/`timeoutMs`/`allowReentry`，真实后果是误判失败（§3.4⑧）。

🔴 **只约束挂载，不约束派发** —— 按名派发不创造命令、只查已注册的 handler，
而 automation 需要它（`TR-01` 立规理由②）；伪造入口在挂载那一侧。
⇒ **门面 `dispatchCommand` 必须同时收两种入参**：命令定义对象 + payload，
或**命令全名字符串** + payload（后者供 automation 与跨机入站使用，
上面第 2 条的「跨机执行按 `commandName` 查本机已注册的定义」走的就是它）。
查不到该名字即 typed reject。

🔴 **两种入参都必须能带完整的身份 options**：
`requestId` · `commandId` · `parentCommandId` · `routeContext`。
⚠️ 早先版本只写「字符串 + payload」，而 §4.7.2 ⑤ 的**整个双观察合并建立在
「peer 派发两侧用同一个 `requestId` 与同一个 `commandId`」之上** ——
入站侧若不能带外部 `commandId`，⑤ 与 §8【B】用例 ③ 都不成立，
而那时 A 的门面签名已冻结、B 只能回改它。
⇒ **这是第四条跨单元约束，已在 §0-A 登记。**

🔴 **`routeContext` 的边界要说准 —— 早先版本这里是自相矛盾的。**
原文写「门面接受它，但 **runtime 不把它交给任何跨线结构**」，
而 §4.2c ① 明写网关的 `options` **含 `routeContext`**，网关正是出境那一跳。
⇒ **正确的边界是三句**：
· **runtime 把 `routeContext` 交给网关**（进程内的一次方法调用），这不是「跨线」；
· **它是否被序列化上线，由 `transport` 决定，本包不定义、也不假定**
  —— 所以 §4.7.2 ⑥ 才写「**执行侧不假定拿得到发起侧的 `routeContext`**，其观察可能为 `null`」；
· **本包不定义 wire 形状、不定义入站解码**（§4.2c ①、§5）。
⚠️ §5 那句「不得跨线」指的是**本包不得定义跨线结构**，
不是「不得把值交给传输方」——两者被混成一句话，读者会据此删掉网关 options 里的 `routeContext`，
而 §2.3 要求二/四（T3 副屏提示）当场失效。

🔴 **`dispatchCommand` 的返回形状（单元 A 就要定完）**：

```ts
export type CommandDispatchResult = {
  readonly requestId: RequestId | null      // internal 无 request 时为 null
  readonly commandId: CommandId
  readonly status: CommandAggregateStatus   // 由 aggregateCommandStatus 算出
  readonly actorResults: readonly ActorExecutionRecord[]   // **中间结果全在这里**
}
```
⚠️ **不能只返回状态枚举** —— 单元 A 没有台账 slice，**返回值是中间结果的唯一出口**，
而 §4.7.3 明令「不得只保留最后一个、不得只保留成功的、不得压成布尔」。
⚠️ 单元 B 接上后返回形状**不变**；台账写的是同一批事实的另一个去处，不是替代。

**分发**：`commandName → 按声明序排序的 actor 列表`，**按序启动、并发完成**（§3.4①）；
**actor 级超时**，预算取自命令定义（§3.4②）；
逐 actor 结果聚合成 `CommandAggregateStatus`（§4.7.5 第一级）——
🔴 **五个值**：`running` 加四个终态。
⚠️ 早先版本这里写「四个终态之一」，会让人把联合定义成四个成员、
把第一级的 `running` 前置判据（rule 0）整个丢掉；
`${requestId}:${commandName}:${actorKey}` 三元重入键，
含义是「**已在运行**」而非「递归」（§3.4④），`allowReentry` 可放行。
🔴 **命中后的行为必须写死**（否则三种实现都能通过测试，可观测行为却不同）：
**该 actor 记为 `error`**（保留错误 key，如 `kernel.base.runtime.actor_reentry_rejected`），
**同命令的其它 actor 照常执行**，命令按正常聚合规则收敛。
⚠️ **不得**整条 `dispatchCommand` reject，也**不得**静默跳过该 actor
（静默跳过会让命令落进「零 actor」分支，与被拒是两种完全不同的可观测结果）。

🔴 **`visibility` 落地成五条规则。**
Dexter 的原始用意：**`internal` = 内部发出的，可以没有 request**（例如 initialize 阶段）；
**外部调用必须带 request**。⇒ 这不是访问控制，
是**「这条命令归不归属于某个业务请求」的判别位**，因此**可机械检查**。
⚠️ POC 里 `visibility` **全仓无人读**（§3.4⑨）—— 本批是把早已声明却没接线的意图接上。

1. **`public` 命令必须带 `requestId`，runtime 不得自动生成 —— 缺即拒绝。**
   POC 的 `dispatchLocal:110` 是 `options.requestId ?? createRequestId()`。
   ⚠️ **理由不是「追溯性断掉」** —— POC 把伪造的 id 放进了返回值，调用方拿得到。
   真正的理由是本文自己的读侧设计：**UI 用普通 selector 订阅台账**（§4.7.1），
   所以 **UI 必须在 dispatch 之前就持有 `requestId`** 才能订阅得上。
   runtime 事后生成的 id 对「先订阅、后看它跑」这个用法没有用。
2. **`internal` 命令可以没有 `requestId`**；没有的话**不进请求台账，只进 journal** ——
   这也解释了 journal 为什么必须独立于台账存在：它是唯一记全所有命令执行的地方。
3. **一切经门面进来的派发都必须可追溯：`public` 缺 `requestId` 即拒；
   `internal` 带 `requestId` 时照常受理并进台账。**
   ⚠️ 🔴 **Dexter 原话「UI 与自动化脚本一律只能发 `public`」在本设计里没有执行点** ——
   门面没有调用方身份，第 5 条也明确「门面不做**能力**限制，只做**追溯性**限制」。
   ⇒ **「UI 只能发 public」是约定不是机制**（与 §4.2b ③ 同处理），
   它防的是**伪造 requestId**，而那一半已由本条的机制兜住。
   ⚠️ **不能简单写成「automation 只能发 public」** —— 那与 `TR-01` 自己的立规理由②
   直接冲突：`terminal-coding-standard.md:64` 原文「automation 的 `command.dispatch`
   成为**完备驱动面**，可覆盖 100% 状态迁移，**不需要后门**」。
   而 `set-instance-mode`（§4.8a）与淘汰命令（§4.7.6）都是 `internal` 且驱动真实状态迁移；
   禁 automation 发 internal ⇒ 它不是完备驱动面 ⇒ 必须开后门 ⇒ TR-01 的理由②当场作废。
   ⇒ Dexter 原话「UI 与自动化脚本一律只能发 public」防的是**伪造 requestId**，
   带上合法 requestId 之后两个目的都达到。
4. **`visibility` 在 contracts 是可选字段 ⇒ 必须钉死 `visibility ?? 'public'`** ——
   否则未声明的普通命令会被当成 `internal`，绕过第 1 条。
5. **无 request 的 `internal` actor 发 `public` 子命令时**：`internal` **有** request 时子命令继承；
   **无** request 时**必须显式提供合法 requestId，否则 typed reject** —— 不得就地伪造。
   🔴 **实现为两个入口，门面那个拒的是「伪造 requestId」，不是「`internal`」。**
   ⚠️ 早先版本写的是「门面拒 `internal`」，**那与第 3 条直接对撞**：
   automation 不是 actor，只能走门面；门面拒 internal ⇒ automation 永远发不出 `internal`
   ⇒ 正是第 3 条花五行论证要避免的结果，而 §8 里「切角色写两份 slice」的测试正走这条路。
   ⇒ **正确的两个入口**：
   · **actor 上下文的 `dispatchCommand`**：`requestId` 由父命令继承，无从伪造 ⇒ 全通；
   · **runtime 门面的 `dispatchCommand`**：**`public` 缺 `requestId` 即拒**（第 1 条）、
     **`internal` 带 `requestId` 时照常受理并进台账**、`internal` 不带 `requestId` 时只进 journal。
   与「`dispatchAction` 只给 actor」是同一形状：门面不做**能力**限制，只做**追溯性**限制。

🔴 **POC 里有一个完整的活例子**：`runtime-shell-v2` 自己的 `initialize` 声明就是
`{visibility:'internal', allowNoActor:true}`，且由 `runInitialize` 以
`createCommand(initialize, {})`（**不带任何 options**）发出 —— 这正是「内部发出、可以没有 request」。
而现行 `dispatchLocal:110` 给它**伪造了一个 requestId**，
于是启动过程在台账里留下一条没有来源的假请求。
TER 修掉之后，`initialize` 这类命令**只进 journal，不进台账**。

#### 4.2b 命令环路防护 —— 三元键只挡住一类，另外三类要单独管  【单元 A】

🔴 **三元键挡得住的**：同一 request 内**回到同一 (命令, actor)**，
**包括间接环** `A → B → A` —— 🔴 **但只在未超时时挡得住**。
原理是栈帧还在：actor X 处理 A 时压帧，
它 `await` 子命令 B 期间 **`finally` 尚未执行**
（POC `runtimeCommandDispatcher.ts:220` 压栈、`:288-293` 的 `finally`
在 `Promise.race` resolve 之后才弹），所以 A 第二次进来时 `some()` 命中 ⇒ 被拒。

**跨机回路同样被挡**：主机 A → peer 派到副机执行 B → 副机 actor 又把 A 派回主机，
回到主机时 requestId 相同、X 的 A 帧仍在 ⇒ 命中。

🔴 **已知边界：环路一旦跨过超时，两道保险同时失效。**
`Promise.race` 在**超时**时同样 resolve ⇒ `finally` 弹帧 ⇒ 三元键失效（§4.3 已接受这个后果）；
深度上限也随之释放（它在执行栈上）。而上面两类环恰恰是**长耗时**路径
（跨机回路要等 peer 往返，而 peer 派发自带超时预算，§4.7.7 ①）。
⇒ **与 ③ 同处理：立规矩、不建机制。** 这条要写进 README，成为已知边界而不是现场事故。

🔴 **挡不住的三类，本批必须分别处置**：

**① 全是不同名命令的长链**（`A → B → C → D → …`）。
三元键永远不触发，而 POC 的 `executionStack` **无深度上限、无界增长**。
⇒ **要求**：**命令链深度上限**（取自参数，不硬编码）。
超限即 typed error，journal 记录**完整命令链**（便于定位是谁在绕）。
⚠️ **`allowReentry: true` 不豁免深度上限** —— 它只关掉三元键这一项。

**② 单个 request 内命令数失控。**
即使深度不深，一个 actor 循环发平级子命令也能把一条台账记录撑爆。
🔴 **这与 §4.7.6 是同一个担忧的两半**：
失控的 request 永远停在 `running` ⇒ **「running 永不淘汰」使它永久驻留**，
淘汰机制救不了它。
⇒ **要求**：**单 request 命令数上限**（同样取自参数）。
🔴 **这一条属单元 B，不属 A** —— 计数的来源是**台账里该 request 的 `commands.length`**，
不是一个独立的计数器。
⚠️ **不得在 A 里为它建一张 `requestId → 计数` 的表**：`requestId` 由调用方持有、
可以跨多次根派发（§4.2 第 1 条），那张表**没有确定的清除时机**，
「防台账无界」的机制自己会变成无界结构。
⇒ A 只做**深度上限**（它在执行栈上，天然随命令结束而释放）；命令数上限随台账一起在 B 落地。
🔴 **超限的表达必须是一条「可被 selector 推出的事实」，不能是「把 request 判为 error」** ——
台账里没有 request 级的 status 字段可写（§4.7.2 的分界线），
「判为」这个动作在本设计里不存在。

⇒ **正确的形式（三条，缺一条这道保险就不成立）**：
· **超限后拒绝新派发**，入口 typed reject；
· **只写一条**已终结的命令观察记录这件事（保留 `actorKey`，如
  `kernel.base.runtime.request-budget`，`LedgerError` 带专门 key）。
  🔴 **本包引入两类保留名，性质不同，不得混为一谈**：
  · **保留 `actorKey` 两个**：`kernel.base.runtime.peer-dispatch`（§4.7.2 ⑤b）·
    `kernel.base.runtime.request-budget`（本条）。
    它们与 §4.1 第 3 条的「`actorKey` 重复一律报错」**共用同一张注册表**
    ⇒ 业务模块注册同名即报错，详设须钉进保留名单。
    ⚠️ 🔴 **诚实标注：这张保留名单的实际价值接近于零，本文仍保留它，理由要说清。**
    `actorKey` 由 `${moduleName}.${actorName}` 派生（§4.1），
    而业务模块的 `moduleName` 不会是 `kernel.base.runtime`
    ⇒ **业务模块在结构上就撞不到这两个名字**，「注册同名即报错」几乎不可能触发。
    ⇒ 保留它的**唯一理由**是：这两条记录本身要经**与业务 actor 相同的注册路径**产生
    （§4.2c ③「走的是与其它失败完全相同的路径，不是特例分支」），
    而同一张表既然已经存在，把两个内部名写进去是**零成本**的。
    ⇒ **不得为它新建一张独立的保留名表或一道单独的门** —— 那才是过度设计。
    ⚠️ 若详设发现内部记录并不走注册表（例如直接构造 `ActorExecutionRecord`），
    则**这两个保留名连零成本都不是，应当整条删掉**，只留错误 key 的三个名字。
  · **保留错误 key 三个**：`…actor_reentry_rejected`（§4.2b 重入）·
    `…peer_gateway_not_installed`（§4.2c ③）· `…request_budget_exceeded`（本条）。
    它们是 `LedgerError.key`，**不在 actorKey 注册表里**，重名不会被那道检查抓到；
  ⚠️ **后续被拒的派发不再写**，否则循环 10⁶ 次就写 10⁶ 条 ——
  「防台账无界」的机制自己会变成无界写入源；
· 🔴 **它保证的是「有界」，不保证「终态」。**
  ⚠️ 兜底链的最后一环是「父命令终会结束」，而那要求**每条命令都有有限的 `timeoutMs`**
  ⇒ 🔴 **`defineCommand` 必须在构造期断言 `timeoutMs` 是有限正数** ——
  拒绝 `0`、负数、`Infinity` **与 `NaN`**（`setTimeout(NaN)` 与 `setTimeout(0)` 等价即刻触发，
  而 §4.7.3 第 2 条自己把 `NaN` 列为危险值）。判据是「有限正数」，不是三值排除表；
  未指定时取本包的**缺省常量**（POC 是 60_000，`runtime-shell-v2/src/foundations/command.ts:11`）。
  ⚠️ 它**不是** §4.4b 的全局可调值，是命令定义自己的字段（那里已写明）。
  ⚠️ **早先版本写「该 request 随即终态化、进入淘汰分母」是错的**：
  命令数失控的典型场景是**某个 actor 在循环发子命令**，那个父命令**仍在 `running`**
  ⇒ 第二级 rule 0（任一命令 `running` ⇒ `started`）**先命中**，
  后面所有判失败的分支（rule 3/4/5）永远走不到。
  ⇒ 该 request 会停在 `started` 直到它的父命令真的结束（正常结束、超时、或 actor 抛错）；
  **台账不再增长，但淘汰要等它终态**。这是**接受的**：
  台账已有界（不再写入），永久驻留的只是一条记录，不是无界增长。

**③ `subscribeState → dispatch` 造成的跨 request 回路。**
状态变化触发订阅者发新命令、新命令又改状态。
🔴 **这一类 runtime 挡不住**：requestId 是新的、栈早已展开，三元键与深度上限都看不见。
POC 生产里真有这个模式（`topology-runtime-v3/src/application/createModule.ts:76`、`:103`
在 install 期注册订阅并在其中 dispatch 命令），它靠**订阅者自己的 `JSON.stringify` 指纹去重**
挡住（`:67-71`）—— **即责任在订阅者，不在运行时**。

⇒ **本批的处置：立规矩，不建机制。**
· install 期注册的订阅**不得直接 dispatch action**（`TR-01` 已禁，此处重申）；
· **订阅里发命令必须自带幂等判据**（指纹 / 去重 / 状态未变则不发），
  这条要写进 README 与本包对下游的约定；
· runtime **不建跨 request 的环路探测器** —— 那需要有状态的时间窗，
  代价与收益不匹配，且真正知道「什么算没变」的是订阅者自己。

⚠️ **诚实声明**：③ 是**约定**不是**机制**，下游违反时 runtime 不会报错。
本文点名它，是为了让它成为已知边界而不是现场事故。

#### 4.2c `peerDispatchGateway` 插槽  【单元 A】

🔴 **本批交付它，所以必须在这里写死形状** —— 早先版本把它列进交付物却全文无定义。

**三件事**：

**① 接口。** 🔴 **它是一个对象上的一个方法**（不是裸函数），签名：

```
dispatchCommand(command, options) => Promise<CommandDispatchResult>
```
· `command`：本包自己的**命令意图**类型（命令定义 + payload 的打包，§4.2）——
  ⚠️ 早先版本写的 `CommandIntent` 是 POC 的类型名，**TER 全仓不存在**，本文也从未定义它；
  详设须在本包给这个打包类型一个名字并导出。
· `options`：`requestId` · `commandId` · `parentCommandId` · `routeContext`；
· 返回：`Promise<CommandDispatchResult>`（§4.2 定义的那个），**与本机派发同形**。
  ⚠️ **同形不等于无需映射**：`CommandDispatchResult.status` 五值、
  `ActorExecutionRecord.status` 四值 ⇒ 落到 ⑤b 那条网关记录时**必须映射一次**，
  规则见 §4.7.2 ⑤b（`partial-failed → error`，有损且已写明）。
  ⚠️ 同形换到的是**另一件事**：POC 的手工映射把 `PARTIAL_FAILED` **吞成 `COMPLETED`**
  （`TIMEOUT→TIMEOUT`、`FAILED→FAILED`、其余一律成功，§3.6）——
  **同形返回让「对端部分失败」至少落成 `error` 而不是成功**，这个失真消掉了。
⚠️ **它是 runtime 的出口，不是入口** —— 对端命令怎么进来是 `transport`/topology 的事，
本包不定义入站形状。

**② 安装点。** 模块 install 期由拥有传输能力的模块调用（POC 是
`context.installPeerDispatchGateway`，`topology-runtime-v3` 是唯一安装方）。
**至多一个**；重复安装即报错（与 §4.1「重名一律报错」同精神）。

**③ 🔴 未安装时 `target:'peer'` 的行为：记为该命令的 `error`，**不 reject**。**
⚠️ 早先版本写「typed 拒绝」，与本文别处的 `typed reject`（入口 promise reject、
调用方拿不到结果，见 §4.2b ② 与 §4.2 第 5 条）是**两种相反的可观测行为** ——
这里命令**正常返回** `CommandDispatchResult{status:'error'}`。
POC 在这里是**硬编码 FAILED**（§3.8 列为四个绕过聚合的写入源之一，本文批评过）。
⇒ TER：按 §4.7.2 ⑤b 写入那条 `kernel.base.runtime.peer-dispatch` 的 actor 记录，
`status: 'error'`、`LedgerError` 带专门 key（如 `peer_gateway_not_installed`）。
**走的是与其它失败完全相同的路径，不是特例分支。**

⚠️ T3（单机双屏）下永远没有网关，`target:'peer'` 的命令因此恒定失败 —— **这是正确行为**，
不是缺陷；T3 的业务本来就不该发 peer 命令。

### 4.3 actor 执行与上下文  【单元 A】

🔴 **两个上下文的完整属性清单必须在详设里列全，本文只给基线与减法。**
⚠️ 早先版本写「模块上下文的完整集合全文没有，**而 POC 不在本仓、取不到基线**」——
**那个理由是假的**：本文自己两次引用过同一个文件（§3.3 引 `types/module.ts:105-111`、
§3.4⑩ 引 `types/module.ts:32`）。挡住它的不是取不到，是没去取。
🔴 **本文直接给出两份减完的精确集，不再推给详设** ——
上一版把逐名枚举交给详设，而那份清单正是 §8 那道门的判据；转嫁的不是抄写，是**核对**。

**基线**（已逐名点数）：模块上下文 `RuntimeModuleContextV2`
（`runtime-shell-v2/src/types/module.ts:24-62`）**19 个成员**；
actor 上下文 `ActorExecutionContext`（`types/actor.ts:26-47`）**14 个成员**，与 §3.4⑩ 一致。
⚠️ 早先版本写「21 个成员」，那是把 `dispatchCommand` 签名里的两个参数名当成了成员。

**减法不是「各减五处」** —— 例外表前两行明写只针对**模块上下文**，
且 `getStore` 在 `ActorExecutionContext` 里根本不存在。
⚠️ 字面照做会把 `dispatchAction` 从 **actor** 上下文减掉 —— 那正是下一段
「`dispatchAction` 只交给 actor，这就是 `TR-01` 的执行机制」的全部内容。
⇒ **模块上下文减五处、actor 上下文减三处**（`displayContext`/`resolveParameter`/`queryRequest`）。

**减完之后还要再减一次** —— POC 模块上下文里有**五个**是本文 §3.6/§5 明令不建的：
`registerMirroredCommand` · `applyRequestLifecycleSnapshot` · `applyRemoteCommandEvent`
（其入参 `CommandEventEnvelope` 在 TER 不存在，§4.7.5）· `getSyncSlices` · `applyStateSyncDiff`。

⇒ **两份精确集（门的判据就是它们）**：

| 上下文 | 成员 |
|---|---|
| **模块上下文（9 项）** | `moduleName` · `localNodeId` · `platformPorts` · `descriptors` · `getState` · `flushPersistence` · `subscribeState` · `dispatchCommand` · `installPeerDispatchGateway` |
| **actor 上下文（11 项）** | `runtimeId` · `localNodeId` · `platformPorts` · `command` · `actor` · `getState` · `dispatchAction` · `flushPersistence` · `subscribeState` · `dispatchCommand` · `requestApplicationReset` |

**上下文能力面按 POC 继承**（§3.4⑩），**但有五处例外**：

| 不继承 | 理由 |
|---|---|
| 模块上下文的 `dispatchAction` | `TR-01` 的洞，见下 |
| 模块上下文的 `getStore()` | POC 有、**全仓零消费者** |
| 🔴 **`displayContext`** | 它是 **per-runtime 单值的屏身份**（POC 的 `{displayIndex, displayCount}`，构造时定一次、所有 actor 拿到同一个对象）—— 与要求一治的是**同一个病的另一条腿**：T3 下一个 runtime 两块屏，单值屏身份必然错。⚠️ 若确有「屏总数」这类**设备级**需求，须改名并去掉 `displayIndex`，避免它继续充当屏身份 |
| 🔴 **`resolveParameter`（两个层级都不建）** | 动态 catalog 已于 2026-08-28 取消（§3.9），本批**不新增任何 catalog consumer**；它的返回类型 `ResolvedParameter` 正被 §6 第四组从 contracts 删除；§4.4b 的六个可调值也明令不得经它取。⚠️ 早先版本的例外表漏了它，而 §3.4⑩ 把它列在 POC 的能力面里 —— **三处互相矛盾，以本行为准** |
| **`queryRequest`（两个层级都不建）** | 「request 不特殊」的直接推论（§4.7.1）：读台账就用 `getState()` + §4.7.5 那个共享 selector，**与 UI 走同一条路**。POC 的 actor 级 `queryRequest` **全仓零使用**；runtime 级那个的唯一用户是 automation dispatcher，改用 store + selector 即可。⚠️ 多一个 request 专用查询入口，就多一处会与 selector 漂移的地方 |

🔴 **`dispatchAction` 只交给 actor** —— 这就是 `TR-01` 的执行机制：
只有 actor 拿得到 dispatch，runtime 不把它给别人，规则才成立。
⚠️ **POC 不是这样做的**：它的模块上下文也有 `dispatchAction`（190 个调用点）
⇒ install 期可绕过命令直接改 store。install 要发东西有 `dispatchCommand` 就够。
⇒ **TER 的模块上下文不暴露 `dispatchAction`**；`getStore()` 同理不建（POC 有、全仓零消费者）。

🔴 **actor 的声明形态必须在详设里定全** —— 本文只当它是既有物，从未给形状：
一个 actor 定义带 `actorName`，`actorKey = ${moduleName}.${actorName}`
（🔴 **只继承这条组合规则，不继承 POC 的 `actorKey?` 显式覆盖逃逸口**
—— POC 在 `types/actor.ts:70` 声明 `actorKey?: string`，
在 `runtimeActorRegistry.ts:9` 用 `actorDefinition.actorKey ?? \`${moduleName}.${actorName}\`` 取值。
**已穷举核过：POC 全仓没有任何一个 actor 定义填过它**
（`grep actorKey:` 的命中全在读侧断言与 `ActorExecutionResult` 夹具上，不在 `ActorDefinition` 上）
⇒ 留着它与 §4.2 刚封死命令名逃逸口的立场相反）
与一组 handler，每个 handler 用 `onCommand(definition, handle)` 绑定一条命令
（POC 的 `foundations/actor.ts` 同形）。**一个 actor 可挂多条命令**（POC 实证）。
⇒ 详设须给出 `ActorDefinition` 与 `onCommand` 的具体类型。

**`routeContext` 必须被子命令继承**（§2.3 要求二），与 `requestId` 同等待遇。
**`ActorDispatchOptions` 要么实现、要么不声明**（§2.3 要求四）。

**超时的唯一规则。**
🔴 **Dexter 2026-09-01 裁定：`timed-out` 本身就是一种 error 类型，不影响后续调用。**
⇒ **不建栅栏、不建取消、不拦截任何后续调用。**

**理由**（Dexter 让我想清楚 actor 什么时候会超时）：actor 超时的典型情形是
**它阻塞在慢 I/O 上** —— 端口调用、脚本执行、peer 派发。这类 actor 并没有「跑飞」，只是慢；
它最终返回时再做的事通常是正当的。为这种情形建一整套围栏，代价远大于收益。

**唯一需要的一条**：**已经终态的 actor 记录不得被改写。**
迟到的完成**只进 journal**，不回写台账 —— 这样台账保持自洽
（一条记为 `timed-out` 的命令不会过一会儿变成 `completed`），
而 actor 的后续调用**照常放行**。
⚠️ 这条不是围栏：它不拒绝任何调用，只是**不覆盖已成事实**。

⚠️ **已知并接受的后果**：POC 的重入守卫在超时那一刻就解除（§3.4③），
即超时的 actor 仍在跑时，同 (request, command, actor) 可以再次进入。
这与「不影响后续调用」的裁定一致，**不为它建机制**。

🔴 **台账写入不得抛出到分发边界。**
POC 的 `Promise.all` map 回调只有 `try/finally`、没有 `catch`（§3.4⑥）
⇒ 台账写入抛错会让整个 `dispatchLocal` reject。
⇒ **要求**：台账写入（含 §4.7.3 的 JSON 校验）必须在**每 actor 的路径内**完成、
并降级成该 actor 的 `error`。

### 4.4 错误归一化 · 命令作用域 logger · journal  【单元 A】

- **错误归一化**：命令边界统一产出 `AppError`，`isAppError` 透传；**全包只有一份**（§3.2①）。
- **命令作用域 logger**：自动带 `requestId/commandId/commandName/sessionId`（§3.2②）。
  ⚠️ 🔴 **`sessionId` 从哪来必须写明**：会话归 `transport`/topology（§5），
  runtime **不自己产生也不订阅它**。⇒ 它经 `CommandRouteContext` 之外的一条明确通道进来：
  **由装配方在 `createRuntime` 时提供一个 `getSessionId?: () => SessionId | null` 读取器**，
  缺省返回 `null`。logger 每次取当前值。
  ⚠️ **不得**为它在台账里留字段（§4.7.2 ⑦ 已删），也**不得**放进 `routeContext`。
- **journal**：**有界的、进程内的**命令生命周期事件流 + 生命周期钩子（§3.2③）。
  **它是下面六个可调值之一，缺省 1000**（POC 的 `maxJournalRecords` 默认值）。
  🔴 **「journal 记全」在全文一律读作「窗口内可见」，不是「永久完整」。**
  它有界（1000 条 FIFO）、不持久化、不同步；而 §4.7.7 ②b 要求它承接**每一次**
  命令与 actor 的状态迁移，本文举的量级是「50 命令 × 5 actor」⇒ 几个大请求就会把窗口挤满。
  ⇒ 凡是把 journal 当作留痕去处的地方（无 request 的 `internal` 命令 · 迟到的完成 ·
  reset 的第二次 `reason` · 环路的完整命令链 · 角色切换的两跳链），
  **保证的都是「窗口内可查」**。
  ⚠️ **角色切换的业务留痕因此在重启后不存在**（台账 `persistIntent:'never'`、journal 不持久化，
  而角色本身是持久的）—— 这是**本批不满足**的一项，登记在 §7 欠账，不在此处硬撑。
  它承接**六类**进不了台账、或需要在台账之外留痕的东西：
  **无 request 的 `internal` 命令** · **迟到的 actor 完成** ·
  **reset 的第二次 `reason`**（§4.6 洞②）· **reset 执行期间被忽略的请求**（§4.6 洞③）·
  **环路超限的完整命令链**（§4.2b）· **角色切换的两跳链**（§4.8a ②）。
  ⚠️ **不持久化、不同步**，只用于诊断。

#### 4.4b 六个可调值的唯一出处  【单元 A】

🔴 **全文有四处写着「取自参数，不硬编码」，而 catalog 已被取消 ⇒ 必须另给出处**，
否则实施者只能写成模块常量（那就是硬编码）或自造两套配置面。

| 可调值 | 出处小节 | 缺省 |
|---|---|---|
| 命令链深度上限 | §4.2b ① | 详设定 |
| 单 request 命令数上限（**B**） | §4.2b ② | 详设定 |
| `ActorExecutionRecord.result` 体积上限 | §4.7.3 第 5 条 | 详设定 |
| 台账淘汰时效（**B**） | §4.7.6 第 2 条 | 半小时（Dexter） |
| 🔴 最长驻留上限（**B**） | §4.7.6 第 3b 条 | 详设定，建议 4× 淘汰时效 |
| journal 上限 | §4.4 | 1000 |

⇒ **要求**：六个值经 **`createRuntime` 的一个 `limits` 入参**传入；
缺省值在本包 `supports/` 里以具名常量声明并导出，供装配方按需覆盖。
⚠️ **不得经 `resolveParameter` 取** —— 动态 catalog 已取消（§3.9），
那条路只能拿到默认值，等于换个写法硬编码。
⚠️ **六个值分属两个交付单元**（**深度上限** · **journal 上限** · **`result` 体积上限**在 **A**
—— §4.7.3 全节按 §0-A 契约一归 A；**命令数上限** · **淘汰时效** · **最长驻留上限**在 **B**）。

🔴 **`timeoutMs` 不在这六个之内，它不是全局可调值。**
它是**每条命令定义自己的字段**（§4.2）⇒ 由 `defineCommand` 提供一个**包级缺省常量**，
命令可覆盖。§4.2b ② 要求的是「**必须是有限正数**」这条**构造期校验**，不是全局参数。
⚠️ 早先版本写「`timeoutMs` 必填、缺省值随 `limits` 给出」——**一句之内自相矛盾**，且 limits 表里没有它。
`limits` 的形状**在 A 就要定完整**，B 只填自己那**三项**，不得另开第二个入参。

### 4.5 启动四阶段  【单元 A】

| 阶段 | 做什么 | 与 POC 的差别 |
|---|---|---|
| 0 | 逐模块 `preSetup`（**只读上下文**，串行，依赖序） | 同 POC，但 `descriptors` 与后续阶段必须同一份 |
| 1 | `await createStateRuntime(...)` | 🔴 **runtime 不再自己 hydrate** —— `state` 的 async factory 在 resolve 前已完成恢复 |
| 2 | 逐模块 `install`（完整上下文，串行，依赖序） | 同 POC |
| 3 | dispatch `initialize` 命令 | 同 POC。**catalog seeding 本批不做**（§3.9、§5） |

🔴 **启动必须由装配方显式 `await`，不得自启动。**
若沿用「构造时 `void start()`」，装配方拿到的 runtime 可能还没 install 完而看起来可用 ——
这正是 `TR-02` 禁止的「什么都没做却返回成功」。
⇒ 要么 `createRuntime` 返回 `Promise` 且 resolve 时已启动完（与 `state` 的 async factory 同形），
要么给出独立的 `start(): Promise<void>` 并**在门或类型上强制它被 await**。
🔴 **选择依据（不是自由二选一）**：下面「启动失败必须是显式终态」要求
失败后**有一个对象承载 `failed` 状态、且后续任何调用 typed reject**。
第一支在失败时 `Promise` 直接 reject、调用方**拿不到 runtime 对象**，无处承载。
⇒ **取第二支**：构造与启动分离，`createRuntime` 同步/异步产出对象，`start()` 单独 await。

🔴 **`createRuntime` 的入参形状本节必须给全**，否则实施者只能从 POC 反推。
已知必须有的：`modules` · `platformPorts`（`platform-ports` 的端口集）·
`limits`（§4.4b 六项）· `getSessionId?`（§4.4）·
以及**转交给 `createStateRuntime` 的那一组**（仓内 `state/src/foundations/createStateRuntime.ts`
的输入里 `persistenceKey`/存储端口等是必填，**不能靠默认值**）。
⇒ 详设须逐字段列出并说明哪些有缺省、哪些必填；
🔴 **`runtimeId`/`localNodeId` 的来源**：
· `runtimeId` 由 `createRuntime` **构造时生成**（`contracts` 已有 `createRuntimeInstanceId`）——
  它只标识本次进程内的运行时实例，每次启动换新是正确的；
· `localNodeId` **必填、由装配方传入** —— 它是**跨机身份**，每次启动换新会让对端认不出本机。
  ⚠️ 早先版本写「缺省时用 `createNodeId` 生成一个」，与同句的「不是 runtime 能自己决定的」
  自相矛盾，**已删**：缺失即 typed reject。装配方要持久化它是装配方的事。

🔴 **启动失败必须是显式终态。** POC 的「不可重试」是 `startPromise` 不清除造成的**意外行为**（§3.3）。
⇒ 失败后 runtime 进入 `failed` 终态，**后续任何调用都 typed reject**，
调用方只能丢弃并重建。**不得让它看起来还能重试。**

#### 4.5b 不建 shutdown，但必须统一持有订阅与定时器  【单元 A】

**不建 shutdown / dispose / teardown** —— 三种形态里 runtime 都是
**进程级单例、与进程同生共死**（§2），建拆卸链是为不存在的场景付复杂度。
✅ POC 同样没有（§3.3）。

🔴 **但 runtime 必须统一持有 `install` 期注册的一切生命周期资源**：
`subscribeState` 返回的取消函数 · 所有定时器（含 §4.7.6 的淘汰定时器）。
POC **不持有**（`subscribeState` 的返回值全仓无人保存，§3.3），于是无从释放。

⇒ **要求**：提供一个**仅供测试使用**的释放入口，**不进生产 API 面**（详设须写明怎么做到）。
⚠️ 理由不是洁癖：§8 的【A】测试要求「**两个 runtime 实例 + 内存网关**」，
而那正是会被订阅与定时器泄漏串掉的那一类。

### 4.6 reset 的两段式  【单元 A】

actor 调 `requestApplicationReset` 只**登记**，**根命令完成之后**才执行 ——
执行体是 `state` 的 `handleResetCommand`。**不得在 actor 执行途中重置 store**（§3.5）。
延迟执行只在 `parentCommandId == null` 时触发，子命令完成不触发 —— 这一点 POC 是对的，照抄。

**完整的 reset 序列**（POC 的 `runtimeLifecycle.ts:132-150`，整体继承）：
捕获 `previousState` → `resetState()` → 逐模块 `onApplicationReset(context, {reason?, previousState})`
→ **重新广播 `initialize`**。
⚠️ 三点必须写明：① `previousState` 是在 `resetState()` **之前**捕获的；
② `onApplicationReset` 拿到的是**新构造**的模块上下文，不是 `install` 时那个；
③ **reset 会重跑 `initialize`** —— 模块的 initialize actor 必须能被重复执行。
⚠️ 台账在 reset 时全清。**但语义与 POC 不同，必须写明**：POC 的 `ledger.clear()` 会把
RUNNING 记录先置 FAILED 并 emit、再全清（§3.8）；台账改成 slice 之后走的是 `state` 的根级 reset
（各 owner reducer 返回初始值）⇒ **RUNNING 记录直接消失，不会被置为失败**。
按「重启就清掉、不要过度设计」，**接受这个差异**，但不得再引用 POC 的 `clear()` 语义。

🔴 **Dexter 2026-08-31 裁定：本批做**（尽管 POC 里 `requestApplicationReset` 零调用者）。

🔴 **机制本身有三个洞，本批必须堵，与「该不该做」无关**：

**① `internal` 命令可以没有 `requestId`，而 pending reset 按 `requestId` 登记。**
POC 不存在这问题，只因 `dispatchLocal:110` 给每条命令都伪造了一个 id —— 正是 §4.2 第 1 条要修的。
修掉之后，无 request 的 `internal` actor 调 `requestApplicationReset` **无键可登记**：
静默丢弃撞 `TR-02`。
⇒ 🔴 **取「登记键一律用根 `commandId`，不用 `requestId`」**（不是二选一）。
理由有二：① 每条命令必有 `commandId`，`internal`/`public` 不再有差别，整类问题消失；
② `requestId` 由调用方持有、**可以跨多次根派发**（§4.2 第 1 条），
拿它做键本来就会把两次不相干的派发串在一起。
⇒ 延迟执行的触发点也随之统一为「**这条根命令**完成之后」，与 §3.5 的
`parentCommandId == null` 判据天然一致。

**② 同一 request 内两个 actor 都请求 reset ⇒ 后写覆盖先写，第一个 `reason` 静默丢失**
（POC 同病，`:238-240` 是 `Map.set`）。
⇒ 🔴 **取「第二次及以后的请求被忽略，但 journal 记下全部」**（不是二选一）。
理由：reset 是幂等的（它把一切归零），第二次请求不带来任何**行为**差异；
`reason` 只有诊断价值，进 journal 就已经全都保住了。
合并成列表会改变传给 `onApplicationReset` 的形状，换不到行为上的收益。
**不得静默覆盖**（POC 的 `Map.set` 就是静默覆盖）。

**③ reset 会重新广播 `initialize`，而 `initialize` 的 actor 同样能调 `requestApplicationReset`**
⇒ **无任何守卫的重置循环**。
⇒ 🔴 **取「reset 执行期间登记的 reset 请求一律被忽略并记 journal」**（不是二选一）。
理由与洞 ② 同源：reset 是幂等的，重播 `initialize` 期间再请求一次不带来任何行为差异；
计数熔断要引入一个「连续 reset 次数」的状态，而它的清除时机又是一个新问题
（与 §4.2b ② 那张被否掉的计数表同形）。
⇒ **终止条件是「执行期间不接受新请求」这个闸门本身**，不需要计数。journal 记全链。

### 4.7 请求台账 —— 第一版 POC 的核心设计  【单元 B】

⚠️ **Dexter 明确交代**：这是他第一版 POC 精心设计的核心，
**当前这版 POC 把精髓吃掉了**（改成内存 Map + 一套 request 专用跨机机制，反而更复杂）。
本节必须完整保留，**并且要求同样详细地写进本包 README**。

#### 4.7.1 两个单写者 slice，读侧合并

🔴 **首要理由是 Dexter 给的，不是我总结的四条 —— 必须原样保留：**

> 我是希望放 slice 里，这样**不管是本机还是远端，都可以走统一写入统一读取的方式**，
> 而且后面 **request state 也可以和后续其他业务 state 用一样的机制来同步**。
> 我的第一版 POC 就是放到 slice 里，**UI 用普通的 selector 来订阅** request 的状态，
> 而且定期会清除超过时效的数据，比如半小时。
> 我忘了这版 POC 为什么改成这种形式了，他可能觉得 **request 比较特殊，就新造了一套机制，
> 反而增加了复杂性**。

⇒ 这条比下面四条更根本：**它说的是「request 根本不特殊」。**
一旦承认 request 不特殊，它就该走**和其它业务 state 完全一样的**写入、读取、同步路径 ——
于是那一整套 request 专用的跨机机制（§3.6）**连存在的理由都没有了**，
而不是「有理由但我们不采用」。

**由此派生三条硬要求**：
· **写入**：只经 command → actor → reducer，与任何业务 slice 无差别（`TR-01`）。
  ⚠️ **唯一例外是台账自己的执行事实** —— 它由**分发器**写，具名例外与三条边界见 §4.7.7 ②a。
  **不得据本行把台账写入塞进 actor**（§4.7.7 ②a 说明那会立刻踩上死循环）；
· **读取**：**UI 用普通的 selector 订阅**，
  **不得提供 `queryRequest`/`subscribeRequest` 这类 request 专用订阅或查询 API**
  （POC 有，且订阅瞬间要回放一次已有记录，§3.8 —— Redux selector 天然有当前值，不需要）；
· **同步**：走 `state` 已有的 record 同步与信封，**不新增任何 request 专用的消息类型或线格式**。

🔴 **Dexter 2026-08-31 补充裁定**：读侧**只取已经同步到本机的信息**。
⇒ **不为「远端中间结果的实时可见性」建任何机制。** 对端的观察通过普通 slice 同步到本机，
合并 selector 读它 —— **这不是额外机制，是双 slice 的自然结果**。
本批不建任何 peer 专用的进度推送、事件流或快照回填。

| | 主机的台账 slice | 副机的台账 slice |
|---|---|---|
| 谁能写 | **只有主机** | **只有副机** |
| 同步方向 | `master-to-slave` | `slave-to-master` |
| 键 | `requestId` | `requestId` |

**每台机器上都有这两份**：本地写自己那份，另一份由同步收进来。
slice 名按 `TR-09` 以本包 `moduleName` 为前缀：
`kernel.base.runtime.request-ledger.MASTER` 与 `….SLAVE`。

⚠️ **本批不要求 `state` 增加 `instanceMode` 轴。** `state` 当前只建了 `workspace` 一轴；
实施时**直接声明两个 slice descriptor 即可** —— scoped helper 只是「一份声明生成 N 份」的便利，
两份且方向不同时，写开更清楚。

🔴 **这个设计好在四处，逐条说明白，避免后来者「优化」掉**：

1. **不需要双向同步。** 每个 slice 单写者、单向，正好落在 `SyncIntent` 现有的两个值上。
   若改成「一份台账两台机器都写」，就需要双向合并与冲突解决 —— **凭空多一套机制**。
2. **不需要 `latest-wins`。** 单写者 ⇒ `authoritative` 就够。
3. **`TR-09` 的唯一写者保证不被破坏。** 这比「两台机器写同一份」干净得多。
4. **合并在读侧做，不在写侧做。** 写侧没有冲突可言；读侧合并是一个纯函数。

🔴 **这个形状同时满足 §2 的三形态**：
T1 两端 workspace 都是 MAIN、T2 一端 MAIN 一端 BRANCH，台账分片与 workspace **正交**；
**T3 下同一套代码照常工作** —— 没有对端 ⇒ 只写 MASTER 那一份、另一份恒空、不发生同步。

🔴 **本批建到完整程度**（Dexter 2026-08-31 裁定）。
**而且两侧性在本批就能真实验证** —— 这半句是**作者的推导**，不在裁定内（§10 已标）。

曾有一种读法认为：`transport` 是批 2、topology peer-link 是批 D ⇒ 本批 SLAVE 那份恒空、
双观察永不发生、测试只能手写假数据。**这个结论是错的** —— 本批自己就有全部零件：

| 要验的行为 | 本批怎么真实产生它 |
|---|---|
| 台账写入、两级聚合、`running` 判定、淘汰、reset、启动 | **测试注册自己的模块 + 命令 + actor**。runtime 的职责就是「把一组 `AppModule` 变成能跑的应用」，测试模块是正常用法，不是夹具造假 |
| 两份 slice 各自被真实写入 | `set-instance-mode` 本批就建 ⇒ 同一个 runtime **先以 MASTER 跑一个 request**（写进 MASTER 那份）、**切成 SLAVE 再跑一个**（写进 SLAVE 那份） |
| **同一 `commandId` 两侧观察** | `peerDispatchGateway` 是本批建的**插槽** ⇒ 测试里起**两个 runtime 实例**，装一个内存网关把 A 的 peer 命令投给 B |
| 两份合并 | 用 `state` 已交付的 `createFullSyncPayload` / `applyAuthoritativeSync` 手工搬同步载荷 |

⇒ **不需要 `transport`、不需要 topology**，全在本批与已收口的 `state` 的能力内。
这是端到端行为验证，不是形状测试。
⚠️ 本批唯一验不了的是**真实网络传输与会话**（重连、断线、乱序）—— 那本来就归 `transport`。

#### 4.7.2 data 形状 —— 只存事实，状态一律在 selector 里算

🔴 **Dexter 2026-09-01 裁定：request 的状态在 selector / reselect 里动态计算，不存。**

⇒ **分界线**：**事实**（发生过什么）进 slice；**状态**（这些事实合起来意味着什么）由 selector 算。
**可推导的东西一律不存。**

| 层 | 存的是事实 | 算出来的 |
|---|---|---|
| actor | 它 running / completed / error / timed-out —— **这一层是原始事实，必须存** | —— |
| command | 何时派发、派给谁、落在哪块屏、允许零 actor 吗、各 actor 的结果 | **命令状态** |
| request | 何时开始、有哪些命令、设备工作区 | **请求状态** · **根命令** · **中间结果汇总** |

```ts
/** 错误必须是 JSON-safe 扁平投影 —— `AppError` 的 cause/details/stack 不可 JSON 往返 */
export type LedgerError = {
  readonly key: string
  readonly code: string
  readonly message: string
  readonly category: ErrorCategory
  readonly severity: ErrorSeverity
}

/** 第三层：一个 actor 的执行 —— 这一层的 status 是原始事实 */
export type ActorExecutionRecord = {
  readonly actorKey: string
  readonly status: 'running' | 'completed' | 'error' | 'timed-out'
  readonly startedAt: TimestampMs
  readonly completedAt: TimestampMs | null
  readonly result: StateJsonValue         // 🔴 actor return 的中间结果，见 4.7.3 与下方 (b) 注
  readonly error: LedgerError | null
}

/** 第二层：一次命令执行的**观察** —— 无 status 字段 */
export type CommandExecutionObservation = {
  readonly commandId: CommandId
  readonly parentCommandId: CommandId | null
  readonly commandName: string
  readonly displayMode: 'PRIMARY' | 'SECONDARY' | null   // 🔴 落在哪块屏，见 ⑥；**A 期恒 null**
  readonly target: 'local' | 'peer'
  readonly allowNoActor: boolean          // 事实：该次执行是否允许零 actor
  readonly startedAt: TimestampMs
  readonly completedAt: TimestampMs | null
  readonly actorResults: readonly ActorExecutionRecord[]   // **数组保序**，按启动序
}

/** 第一层：一个请求在**这一份 slice 上**的记录（slice 条目的值）—— 无 status 字段 */
export type RequestExecutionRecord = {
  readonly requestId: RequestId
  readonly workspace: 'MAIN' | 'BRANCH' | null   // 🔴 设备级工作区快照，见 ⑥
  readonly startedAt: TimestampMs               // **这一份**的开始时间，见 ⑦
  readonly commands: readonly CommandExecutionObservation[]  // **数组保序**，按 startedAt
}
```

**slice 的状态形状**（供 `state` 的 record 同步）：

```ts
// 与 state 的 SyncRecordState 同形（注意 Partial —— 淘汰要删键、合并要处理「本机没有这条」）
Readonly<Partial<Record<string, SyncValueEnvelope<RequestExecutionRecord>>>>   // 键 = requestId
```

⚠️ **不使用 tombstone。** `SyncValueEnvelope` 是个联合、带 `{tombstone: true}` 分支，
但本包的淘汰**直接删键**：对端靠 `replaceMissing: true` 的全量快照收敛（§3.7），
不需要墓碑。详设不得引入它。

🔴 **两条类型硬约束，任一条漏掉都会直接卡住 typecheck**：

**（a）必须用 `type` 声明，不得用 `interface`。**
`state` 的 `StateJsonObject` 是一个**索引签名接口**（`{readonly [key: string]: StateJsonValue}`），
而 TypeScript 里**接口不获得隐式索引签名，类型别名才会**。
⇒ 声明成 `interface` 时 `SyncValueEnvelope<RequestExecutionRecord>`
（其 `TValue extends StateJsonValue`）编译不过。

**（b）🔴 不得使用可选属性 `?`，缺省一律写成显式 `| null`。**
`StateJsonValue` **不含 `undefined`**（`state/src/types/value.ts`：
`StateJsonPrimitive = string | number | boolean | null`），
而 `strictNullChecks` 下可选属性 `x?: T` 的类型是 `T | undefined`，
它会被带进类型别名的**隐式索引签名** ⇒ 同样不可赋给 `StateJsonValue`。
`null` 本身在 `StateJsonPrimitive` 里，所以显式 `| null` 是安全的。
⚠️ 上面四个类型已按此写死，**详设不得改回 `?`**。
⇒ 详设须给一条类型层夹具同时钉住 (a) 与 (b)。

⚠️ **`ActorExecutionRecord.result` 是唯一的例外，且是刻意的**：
`null` 本来就在 `StateJsonPrimitive` 里，所以 `StateJsonValue | null ≡ StateJsonValue` ——
写 `| null` 是空操作。⇒ 该字段直接写 `StateJsonValue`。
**后果是「actor 没有返回值」与「actor 显式 return `null`」在台账里不可区分**
（§4.7.3 的 handler 返回类型 `StateJsonValue | void`，两者都落成 `null`）。
**接受这个不可区分** —— 对读侧而言「没有中间结果」与「中间结果是空」意义相同。
详设不得为区分它们加字段。

**必须遵守的七条**：

**① 数组保序，不用 `Record` 做键。** 「这个请求依次做了什么」里顺序是有意义的。
🔴 **合并两份时按 `startedAt` 归并，但跨机顺序不保证**（§4.7.7 ③）——
两侧时间戳来自两个时钟。归并只保证**同一侧内部**的先后正确。

**② 存的是投影，不是原始 `DispatchedCommand`。**
POC 内部记录 embed 了整个 `DispatchedCommand`（含 `payload` 与 `routeContext`），
但它对外的 `CommandQueryResult` 两个都不含。
⇒ **按对外那一层存**：`payload` 不进（体积与隐私），原始命令对象不进。
route 只存 ⑥ 规定的**两个裸枚举字段**，不存整个 `CommandRouteContext`。

**③ 两处类型要比 POC 收紧。** POC 的 `ActorExecutionResult.result` 是
`Record<string, unknown>` ⇒ 收成 `StateJsonValue`；
`error` 是完整 `AppError`（`Error` 实例进 slice 会被 codec 拒）⇒ 投影成 `LedgerError`。
⚠️ 依据是 `state` 的 `SyncValueEnvelope<TValue extends StateJsonValue>` 类型约束，
**不是 `TR-05`** —— `TR-05` 的规则域只有 `platform-ports` 与 `contracts` 两个包，runtime 不在内。

**④ 四个记录类型全部 `type` + 无可选属性**（见上），并有类型层夹具证明可作 `StateJsonValue`。
⚠️ **三个随 A（§0-A 契约一）、`RequestExecutionRecord` 随 B** —— 夹具因此也分两批。

**⑤ 同一条 `commandId` 在两侧都出现时，不得压成一个对象。**

peer 派发时网关传的是**同一个 requestId 与同一个 commandId**（§3.6 路径甲），
所以两侧都有这条命令：本机那条记「我何时派出去、等到了什么」，
远端那条记「我实际怎么执行的」。

⚠️ **这一层站得住的理由是四个单值字段加 `actorResults`，不是六个。**
本文早先列了 `target`·`allowNoActor`·`startedAt`·`completedAt`·`parentCommandId`·`commandName`
六个「两侧天然不同」的单值字段 —— **其中三个被本文自己的 §4.2 消解了**：
`allowNoActor` 是**命令定义**的属性，POC 两侧不同只因它用 `createRemoteCommandDefinition`
重建了空定义，而 §4.2 明令 TER 不得重建 ⇒ 两侧必然相同；
`commandName` 是路由键，两侧同一个字符串；`parentCommandId` 由发起侧原样传给执行侧。
⇒ **真正不同的是 `target`、两侧的时间戳、`displayMode`、以及 `actorResults` 的内容。**
⚠️ `displayMode` 也**不假定两侧相等**（`routeContext` 是否上线由 `transport` 决定、
本包不假定，§4.2 的边界三句），执行侧的观察可能为 `null`，
它的合并规则在 §4.7.5 单独给了 —— 早先版本的「只有」漏了它。
⚠️ **`target` 必须存，它不可推导** —— 本机那一份 slice 里 `target:'local'` 与 `target:'peer'`
的命令**混在一起**，slice 归属只告诉你「谁写的」，不告诉你「派到哪去了」。
（本文早先在这里写过「可由 slice 归属推出」，**那句是错的**。）

**那为什么仍然分开存？** 因为它们是**两台机器各自的观察**，
分属两个单写者 slice，本来就不可能合并写入 —— 「分开」不是设计选择，是分片的必然结果。
读侧要做的只是**不把它们压平**：每条观察各自完整，`commandId` 只负责分组。

⚠️ **不需要 `executorNodeId` 字段。** 观察来自哪一台机器，由**它所在的那一份 slice** 决定，
是可推导的（§4.7.2 的分界线：可推导的不存）。合并 selector 在归并时给每条观察标上来源即可
（视图里那个字段叫 `source`，与存下来的 `target` 是两回事：
`target` 是「这次派发去哪」，`source` 是「这条观察谁写的」）。

**⑤b 🔴 发起侧的 peer 观察必须带一条代表网关的 actor 记录。**

**这是本文早先版本的一个真缺口。** `target:'peer'` 的命令在**发起侧没有本地 actor**
⇒ 它的 `actorResults` 为空；而观察层**没有 status 字段**（分界线：状态一律算出来）。
两条合起来，第一级聚合只剩规则 1（空集 ⇒ `allowNoActor ? completed : error`），
于是：**超时永远推不出 `timed-out`**（§4.7.7 ① 要求「记为 `timed-out`」却无处可记），
而且 `allowNoActor:false` 的跨机命令**在对端执行成功后仍被算成 `error`** ——
与 §4.7.4 承诺的界面语义正好相反。

⇒ **要求**：发起侧那条观察的 `actorResults` 里**恰好有一条**记录，
`actorKey` 用本包的保留名（如 `kernel.base.runtime.peer-dispatch`），语义是
**「网关这次派发」本身就是一个执行单元**：

| 网关状态 | 该 actor 记录 | 第一级聚合命中 | 结果 |
|---|---|---|---|
| 已派出、未回 | `running` | 规则 0 | `running` |
| peer 超时预算到期（§4.7.7 ①） | `timed-out` | 规则 3（全部失败且全是超时） | `timed-out` |
| 对端返回 `completed` | `completed`，**`result` 为 `null`** | 规则 2 | `completed` |
| 对端返回 `error` / 网关未安装 | `error` + `LedgerError` | 规则 4 | `error` |
| 🔴 对端返回 `partial-failed` | `error` + `LedgerError`（见下） | 规则 4 | `error` |

🔴 **网关返回值到网关记录必须显式映射，「同形返回就没有映射」这句话是错的。**
`CommandDispatchResult.status` 是 `CommandAggregateStatus`（**五值**，含 `partial-failed`），
而落点 `ActorExecutionRecord.status` 只有**四值**（`running`/`completed`/`error`/`timed-out`）。
⇒ 映射不可避免，规则**只有一条**：
`completed → completed` · `timed-out → timed-out` · **`error` 与 `partial-failed` 都 → `error`**
（`running` 不会出现在返回值里）。
⚠️ **`partial-failed → error` 是有损的，必须写明**：对端「部分成功」在发起侧只看到「失败」。
这与 §4.7.5「只以本机获取到的信息为准」的裁定一致 ——
发起侧只知道「我没拿到完整成功」；对端那半的细粒度状态由**对端自己的观察经 slice 同步过来**，
读侧合并时看得到（本机那条不承载它）。
⚠️ **不得因此给 `ActorExecutionRecord.status` 加第五个值** —— 它记的是**一个 actor 的执行**，
而 `partial-failed` 是**多个 actor 的聚合**，两者不同层。

⚠️ **这不是「伪造一条 actor」，也不是继承 POC 的 peer 专用机制。**
POC 确实也合成这样一条记录（`runtimeCommandDispatcher.ts:153-166`），
但它的两个毛病本文都不继承：那条记录随后被**整数组替换覆盖**（§3.6 路径丙），
以及远端明细被塞成**无类型 blob**。这里只是承认「网关是一个执行单元」这个事实。
🔴 **网关记录的 `result` 恒为 `null`，不装对端的执行明细。**
把明细塞进去就是把本文批评过的「无类型 blob」（§3.6）原样搬回来，而且是**重复存储**：
对端的执行明细会**经普通 slice 同步**以它自己那条观察的形式到达本机
（§4.7.1「读侧只取已经同步到本机的信息」），读侧合并时自然看得到。
⚠️ 顺带消掉一个反噬：若明细进 `result`，它要受 §4.7.3 第 5 条的体积上限约束
⇒ **对端执行成功但结果太大时，本机反而把它判成 `error`** —— 正是 ⑤b 要修的那个语义。

⚠️ **不得因此在观察层加回 status 字段** —— 分界线不变。

**⑥ route 归属：两个字段，两个层级，性质不同。**

🔴 **Dexter 2026-08-31 裁定：双屏设备不能整体作为 pair 的副机。**
⇒ 副机必然是单屏设备 ⇒ `workspace`（`MAIN`/`BRANCH`）确实是
**设备级工作上下文、两屏共享**（`project-memory/decisions/terminal-architecture-and-stack-rulings.md:31`）。

| 字段 | 性质 | 记在哪 |
|---|---|---|
| `workspace` | **设备级**，一个 request 内恒定 | **请求级** |
| `displayMode` | **真正 per-dispatch**，T3 下两块屏共用一个 store、必须逐命令区分 | **命令级** |

⚠️ **`displayMode` 进 `routeContext` 的理由是「T3 的写侧分片」，不是「派生 workspace」。**
（后者是本文早先编的论证：workspace 既然设备级，它的派生用设备级的 displayMode 即可。）
真正的依据是同一条裁定的前半句：「`displayMode` / `containerKey` **随命令传入**」。

⚠️ **不存 `instanceMode`。** 台账分片本身已按角色编码（slice 名 `.MASTER`/`.SLAVE`），
再存一份就是同一事实两个住址 —— 热切换后必然出现「记录说 MASTER、躺在 SLAVE 那份里」。
⚠️ **也不存 `workspace` 的两个推导输入**：只存派生结果，避免三者自相矛盾。

⇒ **四条**：
· `RequestExecutionRecord.workspace` 取自根命令 `routeContext` 的设备级快照；
· `CommandExecutionObservation.displayMode` 取自**该命令自己的** `routeContext`
  （默认继承父命令；actor 显式传则整体替换，§2.3 要求二）。
  🔴 **单元 A 期这个字段恒写 `null`** —— `contracts.CommandRouteContext` 要到
  §6 第二组（单元 B）才长出 `displayMode`，而 §2.4.1 明禁 A 读它。
  ⇒ **A 期构造观察时直接写 `null`，B 期改为从 `routeContext` 取值**。
  ⚠️ 这是一个**已登记的 B→A 触点**：B 只改这一处赋值，不改类型、不改调用点；
· 合并 selector 支持**两级过滤**：「我这块屏发起的请求」按请求级，
  「**落到我这块屏的命令**」按命令级 —— 副屏弹提示那个场景用的是后者；
· 请求级与命令级不一致**不是错误**，是正常情形，不得在写入或读取时把它们对齐掉。

🔴 **`null` 是合法取值，且必须有明确语义 —— 否则一整类命令会被静默吞掉。**

有一整类命令**根本没有发起它的 Root Surface**，因此 `routeContext` 天然为空：
`initialize`（§4.2 自述由 `createCommand(initialize, {})` 不带任何 options 发出）·
淘汰定时器发的 `internal` 清理命令（§4.7.6 第 5 条）· `set-instance-mode`（§4.8a）·
transport 推送触发的 actor 子命令 · automation 发起的命令。
它们要写按屏分片的 UI 状态是 POS 的常规路径（后厨出餐提示、拓扑断连横幅、热更新提示）。

⚠️ 这不是可以留空不管的：`state` 的 `createWorkspaceActionDispatcher` 内部
（`supports/workspace.ts:15-30` 的 `requireWorkspaceRouteContext`，**不在公开面上**）
对非法与缺失值都是**硬抛**，而按 route 过滤的视图会把 `null` 的记录**从两块屏都排除掉**。

⇒ **规则两条**：
· `workspace` / `displayMode` 为 `null` 表示「**设备级，不属于任何单块屏**」，是合法状态；
· **按 `displayMode` 过滤时，`null` 的命令对两块屏都可见** —— 设备级的东西两块屏都该看到。
  按 `workspace` 过滤同理。
⚠️ 下游（`ui-state`/`ui.base.render`）**不得对缺失 route 抛错**，这条登记为跨包欠账（§7）。

⚠️ **route 只记不判**：runtime **不因 route 做任何路由或准入决策**。
派生与准入归 `display-context`（§2.4）；「谁把提示真的弹到副屏」是 `ui-state`/`ui.base.render` 的事。

**⑦ 第一层也有两侧性 —— 三个字段因此删除、一个改语义。**

🔴 副机那一份台账里，该 request 的命令 `parentCommandId` **全都非空**
（跨机派发时执行侧收到的就是子命令）⇒ 早先形状里的
`rootCommandId`（定义为「`parentCommandId` 为空的那条」）**在副机那份上无值可填**，
而它是必填字段；单值字段在同一 requestId 多次根派发时也没有确定承载。`originNodeId`、`sessionId` 同病（副机不知道请求起源），
且三者在本文全部规则与视图里**零读取**。

⇒ **处置**：
· **删 ledger record 上的 `rootCommandId`，视图改为 `rootCommandIds`** —— 它是可推导的
  （所有 `parentCommandId` 为空的命令），由合并 selector 在**有根命令的那一侧**算出；
  两侧都没有根命令时视图里是空数组；同一 requestId 多次根派发时全部保留，按 `startedAt`、
  再按 `commandId` 稳定排序。
  ⚠️ **顺带修掉 POC 的同名缺陷**：POC 的 `rootCommandId` 取的是「第一条为该 requestId
  建记录的命令」，快照乱序或 peer 回流时会指向非根命令（§3.8 第 3 条）。
· **删 `originNodeId` 与 `sessionId`** —— 零读取、无消费者。
  将来真有诊断需求再加，代价是一次形状变更；现在留着的代价是每条记录都带来源不明的值。
· **`startedAt` 保留，但语义是「本机这一份的开始时间」** —— 不是「请求的全局开始时间」，
  那个跨两台设备的时钟没有意义（§4.7.7 ③）。
  视图里**优先取本机那一份；本机没有该记录时取镜像那一份并标 `timeSource:'peer'`**。

#### 4.7.3 actor 的返回值就是「中间结果」

🔴 **第一版 POC 允许 actor 执行 command 时 return，return 的内容作为中间结果写进这份 data。**

这是整个设计的价值所在：业务 select 一个 requestId，
**拿到的不只是「成功/失败」，而是这次请求走过的全过程与沿途所有中间结果**，
然后自己决定怎么展示、要不要走下一步。

⇒ **要求**：actor 的返回值原样进 `ActorExecutionRecord.result`，
**不得只保留最后一个、不得只保留成功的、不得压成布尔**。

**校验、拷贝、体积三件事必须一起定死**：

1. **handler 的公开返回类型收窄为 `StateJsonValue | void`** —— 编译期挡住大部分；
2. **运行期仍要校验**（类型挡不住 `as` 与动态值）：`NaN`/`Infinity`/`undefined`/函数/
   `Date`/循环引用都会被 `state` 的 codec 与同步拒绝；
3. 🔴 **非法返回值 ⇒ 该 actor 判为 `error`**，命令随之进 `error` 或 `partial-failed`，
   journal 记脱敏后的原因。
   **不得静默丢掉 result 却仍报 `completed`** —— 那既违反 `TR-02`，
   也直接违背「中间结果必须记录」这条设计意图；
4. 🔴 **必须与 actor 脱钩**（深拷贝或等价的冻结快照）。POC **直接持有 actor 返回的对象引用** ——
   actor 之后修改那个对象，台账里的历史事实会跟着变。
   ⚠️ **实现上不要单独做一次深拷贝**：第 2 条的 JSON-safe 校验本来就要完整递归一遍，
   **让这次递归顺带产出结构化副本**，两次遍历合成一次；
5. 🔴 **`result` 必须有体积上限**（取自参数，不硬编码）。理由见 §4.7.7 ④：
   台账走 record 粒度同步，一条记录的**整个 value** 会被反复重写与传输，
   而 §4.7.4 举的「库存明细」「优惠拆分明细」天然可以很大。
   超限即判该 actor `error`、原因进 journal —— 与第 3 条同形。
   ⚠️ 这样「记全」与「有界」不冲突：**超限是一个被记录的失败，不是一次静默截断。**

🔴 **台账写入不得抛出到分发边界。** POC 的 `Promise.all` map 回调只有 `try/finally`、
没有 `catch`（§3.4⑥）⇒ 写入抛错会让整个 `dispatchLocal` reject。
⇒ 校验、拷贝、体积检查**必须都在每 actor 的路径内完成并降级成该 actor 的 `error`**。

#### 4.7.4 业务例子（这一段也要进 README）

收银员点「提交订单」：

1. UI 发 `order.submit`（`public` 命令，**必须带 requestId `R`**）；
2. 主机的 `inventory` actor 校验库存，**return 可用库存明细**；
   `pricing` actor 算价，**return 优惠拆分明细** —— 两个 actor 并行，各自的 return 都进 `R` 的记录；
3. 同一条命令的 actor 再发子命令 `member.benefit.apply`，`target: 'peer'`，**继承同一个 `R`**；
4. 副机执行核销，写进**副机那份**台账，同步回主机；
5. 收银界面 `select(R)` **合并两份**，看到：
   主机两条命令已完成（**带着算价明细**），副机那条还在 `running`；
   ⇒ 界面可以显示「正在核销会员权益…」，而不是转圈或假装已完成。

⚠️ **第 3 步的命令在发起侧没有本地 actor，但它的观察不是空的** ——
按 §4.7.2 ⑤b，里面**恰好有一条**代表网关的 actor 记录，此刻是 `running`。
⇒ 第一级 rule 0 命中（「任一 actor 是 `running`」），命令状态 `running`，
第 5 步的界面才能显示「正在核销会员权益…」。

🔴 **⑤b 与 rule 0 缺任何一个，这个例子都会翻**：
没有 ⑤b，`actorResults` 为空 ⇒ 落进 rule 1 ⇒ `allowNoActor:false` 时算 **`error`**，
界面显示「会员权益核销失败」；
没有 rule 0，网关记录哪怕是 `running`，也会被后面的规则当成非失败而算 `completed`。

**如果第 4 步失败**：合并后 request 是 **`partial-failed`** ——
界面可以显示「**订单已受理，会员权益核销失败**」，
并且**因为中间结果都在**，它知道订单主体已经算好了价、只有权益那一步没成。

🔴 **这就是「部分成功」必须是一个独立状态的业务理由**：
压成 `completed` 会让收银员以为权益已核销；压成 `error` 会让他以为整单失败重新做一遍。

⚠️ **本批只记录，不做重试与补偿**（Dexter 2026-09-01 裁定）——
但**必须把过程和中间结果记全**，否则将来任何重试策略都无从判断该补哪一步。

#### 4.7.5 状态：`RequestLifecycleStatus` 五态，两级链式聚合

🔴 **Dexter 2026-09-01 裁定**：「`RequestLifecycleStatus` 需要有五态。
**当前只是记录。后续是否重试，当前不做约束，也不做设计。**」

```ts
export type RequestLifecycleStatus =
  | 'started'        // POC: RUNNING
  | 'completed'      // POC: COMPLETED
  | 'error'          // POC: FAILED —— 沿用既有取值，不改名
  | 'partial-failed' // POC: PARTIAL_FAILED —— 新增
  | 'timed-out'      // POC: TIMEOUT —— 新增

/** 命令级聚合结果 —— runtime 拥有并导出，见 §6 关于它住哪的说明 */
export type CommandAggregateStatus =
  | 'running' | 'completed' | 'error' | 'partial-failed' | 'timed-out'
```

🔴 **两级都必须先判「还没结束」，这是本文早先版本的一个真缺陷。**

POC 的 `aggregateStatus` **只有一个调用点，且在命令结束之后**
（`runtimeCommandDispatcher.ts:296-301`），那时 `actorResults` 全是终态；
运行中的状态由台账在 `registerCommand` 时写死的 `'RUNNING'` 承担。
把状态字段撤掉、调用点改成「每次读都算」之后，**那份规则的前置条件就不成立了** ——
照抄它会把三类正在执行的东西判成终态：
`[{status:'running'}]` → 零失败 → `completed`；
`[]`（已登记、首个 actor 未登记 / 跨机在途）→ `allowNoActor ? completed : error`；
`{cmdA:error, cmdB:running}` → `error`。
⚠️ 第三条最危险：它是**终态** ⇒ 进淘汰分母 ⇒ **半小时后把仍在执行的请求整条删掉**。

**第一级 · 命令级**（`aggregateCommandStatus(observation)`）：

```
0. 观察未终结（completedAt === null）或任一 actor.status === 'running'  ⇒ running   ← 最高优先级
1. actorResults 为空                                    ⇒ allowNoActor ? completed : error
2. 零失败（失败 = error 或 timed-out）                    ⇒ completed
3. 全部失败，且全部是 timed-out                           ⇒ timed-out
4. 全部失败（其余情形）                                   ⇒ error
5. 其余（有成功也有失败）                                 ⇒ partial-failed
```

⚠️ 第 0 条落在**已存的事实**上（`completedAt` 与 actor 的 `status`），不需要新增字段。
⚠️ **两级都是有序判定链：从 0 往下第一个命中的即为结果。**
空集会同时满足第一级的 rule 1、rule 2（「零失败」真空真）**与 rule 3**（「全部失败且全是超时」真空真）；
第二级空集同时满足 rule 1、rule 4 与 rule 6，同理。**全靠顺序消解**。
详设必须按顺序实现，不得改写成并列判断。

🔴 **`timed-out` 与 `error` 同级参与混合判定 —— 这是 Dexter 裁定的直接后果。**
§4.3 的裁定原文是「**`timed-out` 本身就是一种 error 类型**」⇒ 它必须走失败的混合逻辑，
**不得凌驾其上另立一档**。
⚠️ **早先版本把「任一 timed-out ⇒ timed-out」放在最高优先级（仅次于 running），那是错的**：
`{actorA: completed, actorB: timed-out}` 会被算成 `timed-out`，
而按裁定那**就是** `error` —— 正是 §4.7.4 明令不得发生的「压成 error」。
⇒ 现在同一组事实算出 `partial-failed`，`timed-out` 只在**全部失败且全是超时**时出现。

**第二级 · 请求级**（`aggregateRequestStatus(commands)`）：

```
0. 任一命令的第一级结果为 running                        ⇒ started    ← 最高优先级
1. 命令为空                                              ⇒ started
2. 有命令 partial-failed                                 ⇒ partial-failed
3. 有失败（error 或 timed-out）且同时有 completed         ⇒ partial-failed
4. 全部失败，且全部是 timed-out                           ⇒ timed-out
5. 有失败（其余情形）                                     ⇒ error
6. 全部 completed                                        ⇒ completed
```

⚠️ **两级对空集的处置刻意不同 —— 但第一级要连 rule 0 一起说才准**：
第一级空集**先过 rule 0** ⇒ `completedAt === null` 时是 `running`（非终态），
只有 `completedAt !== null` 时才落到 rule 1 的 `allowNoActor ? completed : error`（终态）；
第二级空集**无条件**是**非终态**（rule 1：`started`），第二级没有 `completedAt` 可看。
⚠️ 只写「第一级空集是终态」会漏掉「跨机在途、首个 actor 未登记」那一类，
而那正是本节开头列的三类误判之一。
构造上第二级空集不可达（请求记录随首条命令观察一并写入），
但若出现，按「有命令才可能终态」处理是安全的一侧 —— **它不会被淘汰**（§4.7.6 第 3 条），
而 §4.7.6 第 3b 条的最长驻留上限兜底。

🔴 **第二级同构，理由同上。** 代入 §4.7.4 的旗舰例子
（主体命令 `completed` + 跨机核销 `timed-out`）⇒ 规则 3 ⇒ **`partial-failed`**，
界面才能显示「订单已受理，会员权益核销失败」。
⚠️ 早先版本的 rule 2 会把它算成 `timed-out`，
而 §4.7.4 花五行论证的那个业务能力**在最典型的跨机失败形态上就拿不到** ——
这是「照抄一份规则、没重推前置条件」的第二次发生（第一次是缺 `running` 分支）。

⚠️ **两级都是纯函数，且第一级有两个调用点，必须是同一份实现**：
① **分发器**在命令结束时算出它，作为 `dispatchCommand` 的返回值交给调用方；
② **selector** 在读台账时算出它。
两处若各写一份，必然漂移出「返回说成功、界面说部分失败」这类矛盾。
⚠️ 但两个调用点的**前置条件不同** —— 分发器调用时命令必然已终结，selector 调用时不一定。
第 0 条正是让同一份实现在两种前置条件下都正确的那一条。

🔴 **同一 `commandId` 两侧观察冲突时：以本机那一份为准**（Dexter 2026-08-31 裁定：
「**超时失败，只以本机获取到的信息为准**」）。

⇒ **规则**：命令状态由**本机拥有写权的那一份 slice** 里的观察算出；
本机那份没有该 `commandId` 时，才取对端那条。对端的观察**完整保留在视图里供诊断**，
但**不参与状态判定**。

⚠️ **必须写明的后果**：跨机命令在**两台机器上会显示不同的状态** ——
主机等超时了就是 `timed-out`，副机实际执行完就是 `completed`。
这是「只以本机获取到的信息为准」的直接结果，**是刻意的，不是不一致缺陷**。
业务上意味着：主机侧不会把一条自己没等到结果的命令报成成功。

🔴 **Dexter 2026-09-01 补充裁定：selector 只读到一边的 request 状态时，只按这一边计算返回。**

这里的「只按一边」是精确算法边界：两份 request envelope 都缺失时返回 `null`；
恰好只有一份时，`commands` 与两级状态、`rootCommandIds`、`workspace`、
`startedAt`/`updatedAt` 全部只从该边已有事实推导。缺失的另一边不表示
「尚未结束」，不得等待、补造或沿用 selector cache 里该边旧事实。只有两边同时存在时，
才进入上述「同 `commandId` 本机优先、其余事实并集」的双边归并。

**三个枚举的归属**：

| 枚举 | 值 | 用途 | 住哪 |
|---|---|---|---|
| `CommandLifecycleStatus` | 六态 | **request 快照里单条命令的进度**（`RequestCommandSnapshot.status`）——**不是 wire event type** | contracts，**已有、不动**；本批不消费 |
| `CommandAggregateStatus` | 五态 | 本机一条命令的聚合结果 | **runtime 拥有并导出**（见 §6） |
| `RequestLifecycleStatus` | 五态 | 请求聚合 | **contracts（已定，见 §6 第一组）**；与 `CommandAggregateStatus` 的不对称是明知的，复议渠道是 §9 |

⚠️ **前两个不能合并**：六态是快照里的**进度**，`CommandAggregateStatus` 是**本机聚合结果**。
⚠️ **本批不定义 `CommandEventEnvelope`**（TER contracts 里也没有它）。

**合并 selector 的返回形状** —— 不只是状态，是「整个运行过程」。

Dexter 两次强调同一件事：
> 完整记录了 request 的运行过程和所有中间结果和错误信息。
> 最后业务 select 之后**可以从里面拿到 request 的状态与中间过程中的所有结果**，
> 然后再决定如何展示或如何下一步。

```ts
export type RequestExecutionView = {
  readonly requestId: RequestId
  readonly status: RequestLifecycleStatus         // 算出来的（第二级）
  readonly rootCommandIds: readonly CommandId[]   // 算出来的：全部 parentCommandId 为空的命令
  readonly workspace: 'MAIN' | 'BRANCH' | null
  readonly startedAt: TimestampMs                 // 优先本机；本机无该记录时取镜像，见 timeSource
  readonly updatedAt: TimestampMs                 // 见下方 timeSource
  readonly timeSource: 'local' | 'peer'           // 🔴 算出来的：上面两个时间取自哪一份
  readonly commands: readonly {
    readonly commandId: CommandId
    readonly commandName: string
    readonly parentCommandId: CommandId | null
    readonly displayMode: 'PRIMARY' | 'SECONDARY' | null
    readonly timeSource: 'local' | 'peer'         // 🔴 算出来的：本条的 startedAt 取自哪一份
    readonly status: CommandAggregateStatus       // 算出来的（第一级，本机那份为准）
    readonly observations: readonly (CommandExecutionObservation & {
      readonly source: 'local' | 'peer'           // 算出来的：来自哪一份 slice
    })[]
    readonly results: readonly StateJsonValue[]   // 该命令下全部 actor 的中间结果，按启动序
    readonly errors: readonly LedgerError[]       // 该命令下全部 actor 的错误，按启动序
  }[]                                              // 按 startedAt 归并保序；跨机顺序不保证
}
```

⚠️ **`results` 与 `errors` 是「拍平的便利视图」，不是新事实** —— 从 `observations` 逐 actor
取出排序，**不得在此处做任何取舍**（不许只留最后一个、只留成功的、压成布尔）。
这是 §4.7.3「写侧记全」的读侧对应：**读侧也要交全。**
⚠️ 单值字段（`commandName`/`parentCommandId`）两侧恒等（⑤），取任一即可。

🔴 **时间戳与排序键：优先本机那一份，本机没有该记录时降级取镜像那一份并标注来源。**
⚠️ **早先版本写的「一律取本机那一份」是错的**：一个完全由对端发起、本机只收到镜像的 request
（副机视角看主机发起的请求，或 §8 用例 ①「只有一侧有记录」）**在本机那一份里根本不存在**，
而 `startedAt`/`updatedAt` 是非空字段 —— 「一律」这个绝对措辞让它无值可填。
⇒ 视图增一个 `timeSource: 'local' | 'peer'`（**算出来的**），
消费方据它判断该记录的时间轴是否可与本机其它记录直接比较（§4.7.7 ③）。
⚠️ `displayMode` 同理**不可假定两侧恒等** —— `routeContext` 是否被序列化上线
**由 `transport` 决定，本包不定义也不假定**（§4.2 的边界三句），
执行侧的观察**可能**为 `null`。
⚠️ 早先版本写「§5 禁止它整个跨线 ⇒ 执行侧多半拿不到」，**两处都不准**：
§5 禁的是**本包把它放进落盘/台账结构**，不是禁传输方序列化它；
而「多半拿不到」是对别的包行为的猜测，本文无据。
⇒ **命令级 `displayMode` 取本机那一份；本机没有时取镜像那一份；两侧都为 `null` 则为 `null`。**

🔴 **记忆化是需求，不是优化。**
台账 slice 每次写入都产生新对象；同步侧每收一次全量载荷就整体换对象。
若 selector 以整份 slice 为输入，一次 50 命令 × 5 actor 的请求会触发 250 次
**全表两级聚合 + 全部视图重建**，而 `createSelector` 默认缓存深度为 1，
两个组件订阅两个 requestId 会互相抖掉缓存。
⇒ **要求**：
· selector **按 `requestId` 分片记忆化** —— 输入是那一条记录的两个信封引用，不是整份 slice；
· **聚合与视图构造分离**，`observations` 直接透传原引用、不做复制；
· 详设须给一条量级说明：一次写入触发的重算次数**与台账内其它请求数无关**。

#### 4.7.6 淘汰 —— 台账进了 store，有界就是必须的

⚠️ **台账是 slice，无界比内存 Map 更糟** —— 它不只是内存涨，
还会让 store 越来越大、`state` 每次 dispatch 的引用比对跟着变重。
POC 的台账**完全无淘汰无上限**（§3.8 第 2 条）。

0. 🔴 **两个台账 slice 都是 `persistIntent: 'never'`**（Dexter 2026-09-01：**重启就清掉，不保留**）。
   ⇒ 进程或设备重启后，窗口内的请求过程全部消失，这是**刻意的**，不做跨重启恢复。
   ⚠️ **但本包并非无持久化声明** —— 角色 slice 是 `persistIntent:'owner-only'` 且
   `flushMode:'immediate'`（§4.8a ③）⇒ **`TR-04` 的重启测试适用于角色，不适用于台账**。
   两者必须分别测：重启后角色仍是 `SLAVE`、台账为空。

1. 🔴 **淘汰只作用于本机拥有写权的那一份 slice。**
   这条不是细节，是不变量：淘汰镜像那一份意味着**写一份自己不是写者的 slice**，
   直接破坏 §4.7.1 的单写者与 `TR-09`；而且下一次 `replaceMissing:true` 的全量同步
   会把它们原样带回来 —— **那是一次无效写入**。
   ⇒ 镜像那一份由**对端**淘汰后经同步反映过来。
   ⚠️ **已知代价（必须写明）**：对端永久离开后，镜像那份冻结在断连瞬间，
   直到本进程重启才消失。残留量有界（≈ 对端离开前一个窗口），
   且 `persistIntent:'never'` 保证重启即清 —— **接受，不为它建机制。**

2. **按时效淘汰终态请求**，Dexter 给的量级是**半小时**；具体值取自参数，不硬编码。
   ⚠️ 时效读的是**本机那一份**同步信封的 `updatedAt`（§4.7.7 ③）。

3. **`running` 的请求永不淘汰** —— 判定「是否终态」用 §4.7.5 的两级聚合算，
   🔴 **在合并后的事实上算，但只删本机那一份。**
   ⚠️ **早先版本写的「在本机那一份上算」是错的**：可构造反例 —— 本机半边全终态、
   镜像半边仍有 `running` 命令 ⇒ 本机口径判终态、合并口径判 `started`；
   按本机口径淘汰就会**删掉一个仍在执行的请求**，正是本节要防的那件事。
   ⇒ **判据用合并结果（与 UI 看到的一致），对象只限本机那一份**（与第 1 条同粒度）。
   判据与对象粒度不同，是**刻意的**。

   🔴 **但合并判据会被一条永远不会再变的镜像观察钉死，必须另加一道兜底。**
   反例：本机半边全终态；对端在执行一条命令时**永久离开** ⇒ 镜像半边冻结着一条 `running`
   （第 1 条已承认镜像半会冻结）⇒ 合并判据下第二级 rule 0 恒命中 ⇒ 该 request 恒为 `started`
   ⇒ **本机那一份也永不淘汰**，收银界面上那笔订单**永远显示「正在核销会员权益…」**。
   这与 Dexter「半小时后都会清理掉」的裁定直接相反。

3b. 🔴 **最长驻留硬上限：本机那一份的信封 `updatedAt` 超过上限 ⇒ 无条件淘汰，不看合并结果。**
   上限取自 `limits`（§4.4b），量级应显著大于淘汰时效（详设定，建议 4×）。
   🔴 **不变量：上限必须大于「一条命令链可能的最长在途时长」** ——
   否则 3b 会重犯它用来否掉上一版的那个错（按墙钟年龄无条件删掉在途 request，
   只是常数更大）。命令链的在途时长由每条命令的 `timeoutMs` 决定（§4.2b ② 保证它有限），
   详设须给出上限与 `timeoutMs` 缺省值的关系并写明依据。
   🔴 **删除之后分发器仍可能继续写同一个 requestId**（`emitLifecycle` 不知道记录被删过）
   ⇒ 会出现「半条复活记录」。**接受**：它是一条新的、从当下开始计时的记录，
   照常受第 2 条与 3b 约束；查询它返回的是那半条，不是 not-found。
   ⚠️ 这与第 6 条的 not-found 承诺同属「已收窄」的范围（见下）。
   ⚠️ **它只读本机那一份的信封时间** —— 常态下那是**本机时钟**盖的
   ⇒ §4.7.7 ③「淘汰一律只读本机那一份的时间」**不用破例**，
   🔴 **例外：角色翻转后的一个窗口内不成立** —— 翻转后的「本机那一份」
   是翻转前的镜像那一份，装的是**对端时钟**盖的 `updatedAt`，偏差**无上界**（第 4 条）。
   ⇒ 那个窗口里 3b 的「无条件淘汰」跑在对端时钟上：对端慢 ⇒ 刚接手的记录立刻被删；
   对端快 ⇒ 迟迟不删。**与第 4 条同源、同样接受**，不引入逻辑时钟。
   也**不新增第三个聚合调用点**（§4.7.5 的「两个调用点、同一份实现」仍然成立）。
   ⚠️ **早先版本的修法是「超时效的镜像观察不参与判定」，那个方向是错的**：
   「超时效」读的是镜像信封，而那是**对端时钟**——用对端时钟做**存活性**判定会同时产生三种错：
   一条 `timeoutMs` 大于淘汰窗口的 peer 命令会让**在途 request 被提前删掉**（不需要任何时钟偏差）；
   对端慢 ⇒ 新鲜镜像记录落地即「超时效」，同样提前删；对端快 ⇒ 迟迟不超时效，洞根本没关上。
   ⇒ **淘汰的所有判据一律只读本机时钟；被遗弃的镜像由本机那份的老化兜底。**
   🔴 **代价必须写准：3b 保证的是「存储有界」，不是「界面症状消失」**
   （Dexter 2026-08-31 裁定 B）。

   删的只有本机那一份。删完之后该 request 变成「**只有镜像半有记录**」——
   而那是本文**明确支持**的形态（§4.7.5 的 `timeSource:'peer'` 降级、§8【B】用例 ①）。
   ⇒ 镜像半那条冻结的 `running` 经第二级 rule 0 仍算 `started`
   ⇒ **界面仍然显示「正在核销会员权益…」，直到本进程重启**（镜像半 `persistIntent:'never'`）。

   ⚠️ **因此两条既有结论对「对端永久离开」这一类不成立，必须写明**：
   · Dexter「**未闭合中间态的 request 记录……最终会在半小时后都清理掉**」——
     对这一类**不成立**，界面症状只由进程重启兜底；
   · 第 6 条「已淘汰查询返回 not-found」——
     对这一类**不成立**（本机半已删，合并视图仍能返回一个只含镜像半的完整视图）。
     第 6 条的承诺**收窄为「本机半曾经存在过的 request」**。

   ⚠️ **不为它建机制**（三条替代都要付更大代价）：
   「本机半淘汰后该 requestId 整条不出视图」与用例 ① 直接冲突（T2 下副机发起、
   主机只收到镜像是**正常形态**）；「镜像半也删」违反单写者且下次全量同步原样带回。

4. 🔴 **角色变化生效时，清空本机不再拥有写权的那一份。**
   这条堵住一个否则无解的洞：翻转后本机不再写旧那份 ⇒ 那些 `running` 记录
   **再没有写者** ⇒ 按第 3 条**永不淘汰**，而 §4.8a「被新的同角色机器权威覆盖」
   在 T3 单机、对端已断连、无人接管角色三种情形下都不成立。
   ⇒ 角色是一条命令、有确定生效点（§4.8a），在那里整份清空即可。
   ⚠️ 这与「翻转丢在途记录不用管」（§4.8a）一致，**不做迁移、不做保留、不打标记**。

   🔴 **翻转带来两个必须写明的后果**：
   · **翻转后的「本机那一份」，装的是对端时钟盖的 `updatedAt`** ——
     它是翻转前的镜像那一份。第 2 条的时效判据（读本机那份的信封时间）
     在翻转后的一个窗口内会拿本机时间去比对端时间戳（§4.7.7 ③）。
     ⇒ **接受**，但界要写准：🔴 **偏差由对端时钟决定、没有上界**
     （对端快 40 分钟 ⇒ 这些记录 70 分钟内不满足淘汰条件；对端慢 ⇒ 刚写下的终态记录立刻被判过期）。
     **唯一的硬兜底是 `persistIntent:'never'` + 进程重启**。
     早先版本写「最多一个窗口的偏差」，那个界不成立。
     **不引入逻辑时钟，不做时基迁移。**
   · **切换命令自己会留下半条记录**：清空发生在写角色字段之前、且在同一条命令内，
     于是这条命令的尾部（actor 完成、父命令完成）会落进**新的那一份**。
     ⇒ 这半条记录**没有任何人会覆盖它**（§4.8a 的「被新的同角色机器权威同步覆盖」
     对它不成立，因为它是本机自己写的）。
     ⇒ **接受**：它是终态的、有界的、半小时内被淘汰。
     ⚠️ **这条链的真正根是第一跳那条 `public` 切换命令**
     （§4.8a ② 的两跳链：`display-context` 的 `switch-instance-mode`；
     runtime 的 `set-instance-mode` 是它的子命令、`parentCommandId` 非空）。
     而根命令的记录在**被清的那一份**里 ⇒ 新那一份里 **`rootCommandIds` 算出空数组**。
     ⚠️ 早先版本先写「算出 `null`」、再改成「算出切换命令自己」，**两次都没对齐两跳链的指代**；
     以本行为准。
     ⚠️ 例外：`automation` 直接发 `internal` 的 `set-instance-mode`（§8【A】测试那条路径）时，
     它自己就是根，`rootCommandIds` 非空。
     **不为它建机制。**

   🔴 **顺序是这条规则成立的全部前提**：必须在 `set-instance-mode` 的 actor 内
   **先清空即将失去写权的那一份（此刻本机仍是它的合法写者）、再写角色字段**，
   **同一条命令内完成**。
   ⚠️ 若反过来，就正是第 1 条定义为「破坏单写者与 `TR-09`」的那件事 ——
   第 1 条与第 4 条**不矛盾，但只在这个顺序下不矛盾**，详设必须钉死。
   ⚠️ **连带后果**：切换命令自己的台账记录就在被清的那一份里，会一并消失。
   ⇒ **角色切换的留痕靠 journal，不靠台账**（§4.8a ② 的措辞已按此对齐）。

5. **淘汰必须走命令，不得裸 dispatch。**
   ⚠️ **早先版本的「写入时顺带在 reducer 里清理」这一支已删除，它结构上不可实现**：
   第 3 条要求终态判定用两级聚合，而 `combineReducers` 只把本 slice 的 state 交给本 slice 的
   reducer —— **reducer 看不到另一份 slice**。
   ⇒ **唯一实现是定时 `internal` 清理命令**：actor 在命令路径内 `getState()` 算终态、
   再 dispatch 删除动作。既满足 `TR-01`，也绕开 reducer 的可见性问题。
   ⚠️ Dexter 原话是「**定期**会清除超过时效的数据，比如半小时」——「定期」本就指向定时器。

6. **查询已淘汰的 request 直接返回 not-found，不区分「从没有过」与「已淘汰」。**
   🔴 **这条承诺收窄为「本机半曾经存在过、且已被淘汰」的 request**（第 3b 条）——
   「只有镜像半有记录」的那一类，合并视图仍会返回一个完整视图，不是 not-found。
   ⚠️ 要区分就得另存一份「已淘汰 requestId」的标记，
   而**那份标记本身又是一个无界集合**。据「不要过度设计」，**不做**。

#### 4.7.7 五条边界

**① peer 命令必须有自己的超时。**
actor 级超时管的是本机 actor；而 `target:'peer'` 的命令是
`await peerDispatchGateway.dispatchCommand(...)` —— **连接还在但对端永不回**时，
这条 await 会一直挂着（POC 的 `dispatchRemoteCommand` **没有超时**，§3.7），
命令永远停在 `running`，request 也永远不终态，**因而也永远不会被时效淘汰**。
⇒ **要求**：peer 派发必须有自己的超时预算（可复用命令定义的 `timeoutMs`），
超时后把**该观察里那条网关 actor 记录**（§4.7.2 ⑤b）记为 `timed-out` ——
观察层没有 status 字段，状态一律由 actor 记录算出。测试须覆盖「网关永不 resolve」。
⚠️ 超时之后对端才回来**不构成对已终态 actor 记录的改写** —— 它落在**另一份 slice**；
按 §4.7.5 的裁定，本机仍以自己那份为准。

**②a 🔴 台账的写入者是分发器本身，这是一条具名例外。**

三条要求看起来互相打架，必须在这里说清：
§4.7.1 要求「写入只经 command → actor → reducer」（`TR-01`）·
§4.7.7 ②b 要求「每一次状态迁移只有一个产生点」而那个点在**分发器** ·
§4.7.6 第 5 条禁止 foundation 层的裸 dispatch。

⇒ **裁决**：**分发器就是台账 slice 的合法写者**，理由有二 ——
① 台账记的是「命令与 actor 的执行事实」，**产生这些事实的就是分发器**；
让 actor 去记会立刻踩上「谁记 actor 自己的 running」这个死循环；
② 编码规范给这条白名单的**理由**本身就是「它们**实现**派发本身」
（`doc/platform/terminal-coding-standard.md:53`）—— 本包正是那个「实现派发」的包。
⚠️ **不得拿「门不会红」当理由** —— §8 门表已判定该门对本包是**假绿**（白名单豁免）。
门的盲区解释的是「门抓不到」，不解释「规则被满足」。理由①本身已经足够。

⚠️ **边界（必须同时成立，否则白名单就成了后门）**：
· 分发器**只写本包自己的两个台账 slice**，不碰任何业务 slice；
· 🔴 **命令与 actor 状态迁移的写入点只有一个**（②b），与 journal 同源。
  ⚠️ 早先版本写成绝对的「写入点只有一个」，**那是假的** ——
  这两个 slice 至少还有三个合法写者：淘汰 `internal` 命令的 actor（第 5 条）·
  `set-instance-mode` actor 的整份清空（第 4 条）· `state` 的同步应用侧与根级 reset。
  边界管的是**执行事实**这一类写入，不是整个 slice；
· §4.7.6 第 5 条禁的是**淘汰**走裸 dispatch —— 淘汰不是执行事实、没有命令驱动它，
  所以它必须自己发一条 `internal` 命令。**两件事不同，不要混。**

**②b journal 与台账必须由同一个状态迁移点派生。**
如果分发器一边写台账、一边另外 append journal，两者会漂移出
「台账说完成、journal 说失败」这类矛盾。
⇒ 命令与 actor 的每一次状态迁移**只有一个产生点**，由它同时产出台账写入与 journal 记录。

**③ 🔴 跨设备时钟不可直接比较。**
信封的 `updatedAt` 由**写者本机**盖（`nowTimestampMs` 就是 JS 运行时的时间，
`TR-06` 的例外正文明确「时间不需要 JS 层校正，真要校正是操作系统级的」）。
镜像那一份的 `updatedAt` 来自**对端的时钟**。
🔴 超时效判据是 `now_local − updatedAt > 窗口` ⇒ **对端快** 40 分钟 ⇒ `updatedAt` 落在未来
⇒ 差值更小甚至为负 ⇒ **迟迟不超时效**（70 分钟内都不满足）；**对端慢** ⇒ **立刻**超时效。
⚠️ 早先版本把这两支写反了，而它是 §4.7.6 判据的输入方向 —— 写反会让实施者判进相反的分支。
⇒ **要求**：淘汰、排序、视图的 `updatedAt`/`startedAt`，
**一律只读本机那一份的时间**（与 §4.7.6 第 1 条同粒度）。
✅ **淘汰不需要破这条例**：§4.7.6 第 2 条的时效与第 3b 条的最长驻留上限
**都读本机那一份的信封**，前者判「本机这半够不够旧」、后者兜底「对端永远不回来」。
镜像那一份的时间**在淘汰路径上一次都不读**。
🔴 **「视图」是例外，不适用这条绝对措辞** —— 视图必须能表达
「只有镜像那一份有这条记录」的情形（§8【B】用例 ①），
⇒ 按 §4.7.5 的降级规则：**优先本机，本机没有该记录时取镜像那一份并标 `timeSource:'peer'`**。
⚠️ 这不是放松：`timeSource` 就是给消费方判断「这个时间轴能不能与本机其它记录直接比较」的。
跨机的先后顺序**不保证**，需求里显式声明这一点。
⚠️ 不引入逻辑时钟 —— 单写者 + 各管各的时间轴就够。

**④ 🔴 「走 `state` 已有的 record 同步」今天的实际行为是每次发全表。**
`state` 对外只有 `createFullSyncPayload(sliceName)` 与 `applyAuthoritativeSync(...)`；
增量差量函数 `createSliceSyncDiff` 虽已导出，**全仓零生产调用**。
而 record 粒度是「每个 key 一份完整 value」：给一条 request 追加一条 actor 观察，
信封的 `value` 是**整条记录**（含此前全部命令与全部中间结果）。
50 命令 × 5 actor 的请求，一次生命周期内这条记录被完整重写 250 次，尺寸单调增长。
⚠️ 且 `state` 的 README 已点名：`valueHash` **不是摘要，大小等同于全量数据**,
不要基于「摘要很便宜」去设计定期对账协议。
⇒ **要求**：需求层明写这个实际行为，让详设与 topology 知道自己在承接什么；
并由 §4.7.3 第 5 条的 `result` 体积上限把量级封住。**本批不新建差量协议。**

**⑤ 单写者是不变量，而同步层当前不强制它。**
🔴 **不只是 POC 的问题** —— TER **刚交付的 `state` 也一样**：
`applyAuthoritativeSync` 只按 `slice.sync !== undefined` 定位 slice，**全函数不读 `syncIntent`**。
⇒ 今天没有任何东西阻止一份声明为 `master-to-slave` 的载荷被应用到主机自己的 MASTER slice 上
并整份覆盖它的本地记录。
⚠️ **「不变量」与「无人执行的不变量」是两回事** —— §4.7.1 第 3 条把
「`TR-09` 的唯一写者保证不被破坏」列为双 slice 的理由之一，而它现在**未被强制**。
⇒ 落点在 `state`/`transport`（§7 欠账），但**本批必须把它登记为「阻塞台账不变量成立」的欠账**，
由 Dexter 决定是先补校验还是接受一段未强制期。

### 4.8a 角色自持  【单元 A】

**角色自持。** POC 的机制是 `set-instance-mode` **命令**写上下文 slice、
闭集 `'MASTER'|'SLAVE'`、默认 `MASTER`（§3.7），整体继承。

⚠️ **TER 有一个方向问题必须先解决**：POC 的 `contextState` 属 `topology-runtime-v3`，
而 TER 把上下文半边拆成了 `display-context` —— **它依赖 `runtime`**。
所以 runtime **不能**反过来去读它的 slice（那也违反 `TR-03`）。

⇒ **runtime 自持角色**，五条：①–④ 是 Dexter 2026-08-31 的裁定，⑤ 由 §0-A 契约三派生。逐条都要落：

**① 默认 `MASTER`。** 闭集 `'MASTER' | 'SLAVE'`，不是开放字符串。

**② 用户手动切换 —— 链条是两跳，`public` 与 `internal` 各司其职。**

🔴 **Dexter 2026-08-31**：「用户发 command，**执行 command 的 actor 可以判断之后再发 command**。」

```
用户点「切换为副机」
  → [public] display-context 的 switch-instance-mode   ← 带 requestId，进台账
      → 它的 actor 做准入判断（受管副屏？已激活主机？）
        → [internal] runtime 的 set-instance-mode       ← 继承同一 requestId，同样进台账
            → runtime 的 actor 写角色 slice
```

| | 归属 | visibility | 职责 |
|---|---|---|---|
| 面向用户的切换命令 | **`display-context`** | `public` | 准入**策略**：受管副屏拒绝、已激活主机不得切 SLAVE |
| 写角色的命令 | **`runtime`（本批）** | `internal` | 纯**机制**：无条件写角色 slice |

**为什么 runtime 那条是 `internal`**：若它是 `public`，任何 UI 都能**绕过准入**直接切角色 ——
那正是我在 §3.8 批评 POC 的「多个写入源绕过校验」。
`internal` 使它只能被模块内的 actor 发出，准入无法被绕开。

⚠️ **`internal` 不等于不进台账**：按 §4.2 第 2 条，`internal` **可以**没有 requestId；
这里它是 `public` 命令的子命令、**继承了 requestId**，所以**照常进台账** ——
角色切换是要留痕的业务动作。
🔴 **但它的留痕靠 journal，不靠台账。** §4.7.6 第 4 条要求角色生效点
「清空本机不再拥有写权的那一份」——**切换命令自己的记录就在被清的那一份里，会一并消失**。
⇒ **头部消失、尾部落在新那一份**（§4.7.6 第 4 条：清空在写角色字段之前，
所以这条命令的 actor 完成与父命令完成会写进新那一份），
台账里因此只剩半条 —— 这是**预期**，不是缺陷；**完整的两跳链在 journal 的窗口内可见**。
⚠️ 这与「翻转丢在途记录不用管」是同一条裁定的直接后果。

⚠️ **POC 为什么只有一跳**：`topology-runtime-v3` **同时拥有准入数据与角色 slice**，
所以它把两件事放进同一个 actor
（`features/commands/index.ts:7` 的 `set-instance-mode` 不带 options ⇒ 默认 `public`；
准入在 `features/actors/contextActor.ts:77-93`，规则在 `foundations/eligibility.ts`）。
**TER 把职责拆成了两个包，链条自然变成两跳** —— 不是 POC 错，是边界不同。
管理界面的按钮在 `admin-console/src/ui/screens/AdminTopologySection.tsx:407,416`。

**③ 🔴 必须作为 state 持久化在本地。** Dexter 原话：「这个要作为 state 存储在本地。」
⇒ 一个 runtime 自己的 slice（挂在 §4.1 的内部模块上），描述符：

```
persistIntent: 'owner-only'
syncIntent:    'isolated'          // 🔴 绝不同步，理由见 ④
persistence:   [{ kind: 'field', stateKey: 'instanceMode', flushMode: 'immediate' }]
```

**`flushMode: 'immediate'` 是必须的**：用户切成 SLAVE 后若进程立刻崩，
重启回来变成 MASTER 会去起拓扑 host，和真正的主机打架。
✅ POC 同形：`topology-runtime-v3/src/features/slices/configState.ts:21-31`
（`persistIntent:'owner-only'` · `syncIntent:'isolated'` · `instanceMode` 走
`{kind:'field', flushMode:'immediate'}`）。

**④ 🔴 角色 slice 绝不参与同步（`syncIntent: 'isolated'`）。**
若它同步，主机会把自己的 `MASTER` 权威推给副机、副机被覆盖成 MASTER，
两台机器互相覆盖角色，链路当场自毁。
⚠️ 这条必须写进 README 与红夹具 —— 它是那种「看起来该同步、实际绝不能同步」的字段。

⇒ 恢复顺序天然正确：`state` 的 async factory 在 resolve 前完成 hydrate（§4.5 阶段 1），
所以 install 与 `initialize` 跑起来时角色已经就位、台账知道该写哪一份。

⚠️ **准入为什么必须在 `display-context` 而不在 runtime**：它要读 `tcp-control` 的激活状态
与显示器信息 —— **runtime 看不到，也不该看到**（`TR-03`）。
本文点名这条边界，免得它掉进无人区。

⚠️ **不得用 `CommandRouteContext.instanceMode` 代替这个 slice** —— 那是**每次派发**的属性
（这条命令是在什么上下文里发的），而角色是**机器级的持久状态**。两者不是一回事，
也不该互相推导。

**⑤ 🔴 角色变更必须有一个可扩展的生效点（§0-A 契约三）。**
`set-instance-mode` 的 actor 在本单元交付并收口，而**单元 B 要在同一个生效点插入
「清空本机不再拥有写权的那份台账 slice」**（§4.7.6 第 4 条）。
⇒ **要求**：把生效点做成一个**按序执行的「角色变更副作用」列表**，
单元 B 只需注册一项、**不必回改本单元已冻结的 actor**。
⚠️ 顺序要求：副作用**先于**角色字段写入执行（§4.7.6 第 4 条的清空必须在本机仍是写者时发生）。
⚠️ 不这样做，「A 收口后再冻结 B」就不成立。

**热切换是常规操作。** 🔴 **Dexter 2026-08-31**：角色可热切换，POC 里有例子；
设好主副、连上之后按方向同步即可。方向翻转不需要重连（§3.7 已核）。

**翻转对在途记录的后果 —— Dexter 2026-08-31 裁定：不用管。**
翻转后本机改写另一份，它此前写在旧角色那份里的在途记录，
会被**新的同角色机器的权威同步覆盖**（`replaceMissing:true` 的全量快照）。
🔴 **裁定原话**：「不用管，这类未闭合中间态的 request 记录不重要，
最终会在半个小时后都清理掉。」
⇒ **不为它建任何机制**：不按 `nodeId` 分片、不做迁移、不做保留、不打标记。
⚠️ 🔴 **但「半小时后都清理掉」这句本身已被 §4.7.6 第 3b 条收窄**
（Dexter 2026-08-31 裁定 B）：对「**只有镜像半有记录**」那一类，
存储确实有界，但**界面症状只由进程重启兜底**。
引用这句裁定时必须连同那处收窄一起读，不得当成无条件承诺。
⚠️ 「副屏平板拿下来当主屏」（`TER_PAIR_TOPOLOGY_WITH_DETACHABLE_SECONDARY`，
即 T1 → T2 转换）走的就是这条路。

### 4.8b route 的承载与记账  【A/B 混合，逐行见下表】

| 做什么 | 单元 | 落点 |
|---|---|---|
| `routeContext` 随子命令继承；显式传则整体替换 | **A** | §2.3 要求二 · §4.3 |
| `ActorDispatchOptions` 要么实现、要么不声明 | **A** | §2.3 要求四 · §4.3 |
| `contracts.CommandRouteContext` 收窄并补 `displayMode` | **B** | §6 第二组 |
| 台账记两级 route（请求级 `workspace` · 命令级 `displayMode`） | **B** | §2.3 要求三 · §4.7.2 ⑥ |
| 合并 selector 支持两级 route 过滤 | **B** | §4.7.2 ⑥ |

⚠️ **单元 A 的继承是「不透明搬运」** —— A 期只把 `CommandRouteContext` 这个对象原样传给子命令，
**不读它的任何字段**，因此不依赖 §6 第二组（§2.4.1 已说明）。
🔴 **本包只承载与记账，不做任何派生与准入判断**（§2.4）。

---

## 5 · 明确不做

| 不做 | 为什么 |
|---|---|
| **中间件链，以及任何具体中间件** | 生产那份运行时**包内 `middleware` 零命中**；洋葱链所在的 `execution-runtime` **全仓零生产依赖**、**生产中间件实现 0 个**（只有测试里 4 个内联的）、`priority` **无消费方**。而我曾列的五项用途里，**超时**是分发器的一等机制、**错误归一化**是命令边界的一等机制、**审计**就是 journal —— 三项各有专门机制；剩下**权限**与**幂等**当前无需求。⇒ 零具体中间件却先建链 = 未经验证的抽象。⚠️ **`AppModuleMiddlewareDescriptor` 因此本批一并删除**（Dexter 2026-08-31 裁定，§6 第三组）—— 不留悬空声明。将来真有中间件需求时连同链一起建，重入保护的写法可直接取 `createExecutionRuntime.ts:94-116` 的单调 cursor |
| 传输、会话、重连、重传 | 归 `transport` 与 topology；本批只留 `peerDispatchGateway` 插槽与合并入口 |
| **为 request 另造跨机机制** | 台账是 slice ⇒ 走 `state` 的同步即可。**不建** `registerMirroredCommand` · `applyRequestLifecycleSnapshot` · `CommandEventEnvelope`（§3.6：这套东西在 POC 里要么是死的、要么自我抵消） |
| **另立 command 台账** | 命令与 actor 明细是 request 记录的第二、三层；命令级状态流转事件进 journal |
| **动态 error/parameter catalog** | 2026-08-28 由 Dexter 整体取消（§3.9、§10）。⚠️ **它留下的四个类型本批一并删除**（§6 第四组） |
| **`displayMode` 的任何行为** | 归 `display-context`（§2.4）。本批只让 contracts 有能力表达它、让 runtime 忠实承载并继承它 |
| **按 route 做任何路由或准入判断** | runtime 只**如实记录** route（两级），不因它改变命令去向、不因它拒绝命令。「谁真的把提示弹到副屏」是 `ui-state`/`ui.base.render` 的事；角色切换的准入是 `display-context` 的事（§4.8a） |
| **同步应用侧的方向校验 / 角色切换后重置基线** | 需求出自本批（§4.7.7 ⑤ 与 §3.7），落点在 `state`/`transport`/topology；本批登记欠账，不自己实现 |
| **重试、补偿、回滚** | Dexter 2026-09-01：当前只是记录，后续是否重试不做约束也不做设计 |
| **超时后的栅栏、取消、副作用拦截** | Dexter 2026-09-01：`timed-out` 就是一种 error，不影响后续调用（§4.3） |
| 重造 `state` 已有的能力 | 持久化、同步算法、store 装配全部复用 `state` |
| 再写一份 `normalizeError` | 生产里那份重复必须合并成一份（§3.2①） |
| **把 `CommandRouteContext` 整个对象放进任何会落盘或进台账的结构** | 台账只存 ⑥ 规定的**两个裸枚举字段**（请求级 `workspace`、命令级 `displayMode`），不存整个对象、不定义与它同构的投影类型。🔴 **本行不约束 §4.2c ① 的网关 `options`** —— 那是进程内的一次方法调用，`routeContext` 必须能传过去（§2.3 要求二/四），是否上线由 `transport` 决定。⚠️ 早先版本定义过一个 `LedgerRoute` 投影，**已删除** —— 它与收窄后的 `CommandRouteContext` 结构完全相同，「不含原始对象」因此变成只能靠标识符匹配的伪 checker |
| **宣布 `CommandRouteContext` 已可安全跨线** | 见 §6 第二组：收窄照做，但**跨版本未知取值的接收行为本批未定义**，注释不得改成「可安全跨线」 |

---

## 6 · `contracts` 的四组契约变更

⚠️ **前两组只改已有导出的成员/字段、不新增导出名；第三组删 1 个导出、第四组删 4 个**
⇒ **导出数 74 → 69**：`expectedPublicExports` 删 **5 个名字、动 3 行**（`:510`/`:511`/`:512`）。
`CommandAggregateStatus` 与 `RequestExecutionView` 留在 runtime，不进 contracts。
⚠️ **按单元切分**：第三、四组属**单元 A**；第一、二组属**单元 B**（§0-A）。

### 第一组 · `RequestLifecycleStatus` 扩为五态

| # | 落点 | 变更 |
|---|---|---|
| 1 | `contracts/src/types/request.ts` | 扩 `RequestLifecycleStatus` 为五值（§4.7.5） |
| 2 | `tools/terminal-contracts/check-static.mjs` 的 `expectedLiteralUnions` | **新增**一条把这五个值钉死。⚠️ 该门目前**没有**钉 `RequestLifecycleStatus`，所以扩容不会撞门 —— **正因为如此才要补钉**，否则这个业务语义枚举可以被静默改动 |
| 3 | `contracts` 的类型层夹具 | 补 `@ts-expect-error`：非法取值不可赋；且**六态与五态互不可赋** |

⚠️ **`CommandLifecycleStatus` 六态不动** —— 它是 request 快照里单条命令的进度，与聚合无关。

⚠️ **为什么 `RequestLifecycleStatus` 仍住 contracts、而 `CommandAggregateStatus` 住 runtime。**
有一种反对意见成立地问：`RequestLifecycleStatus` 在 contracts 的**唯一结构性使用点**是
`RequestLifecycleSnapshot.status`，而本批明确不建那条路径（§3.6 路径乙）；
按本文自己「聚合状态是 selector 返回类型 ⇒ 留在 runtime」的分类原则，它也该留在 runtime。
⇒ **仍选择扩它的理由是**：这个类型**已经在 contracts 里、且值是错的**（三态）。
留一个错的三态在共享词汇里，比把它改对更糟；而删它是另一次范围更大的变更。
`CommandAggregateStatus` 是**新增**的，没有这个包袱 ⇒ 从 runtime 起步，
将来若出现独立于视图的第二个消费者再议。
⚠️ 这个不对称是**明知的**，不是疏忽。若 Codex 认为对称更重要，请在评审里提出。

### 第二组 · `CommandRouteContext` 收窄并补 `displayMode`

🔴 **Dexter 2026-08-31 裁定：必须改。**「这还用问，必须改呀，需求已经很明确了。」

**当前形状**（`apps/terminal/kernel/base/contracts/src/types/command.ts`）：

```ts
/**
 * Local-only routing context. It must not cross a wire boundary before a
 * dedicated serialization and compatibility review.
 */
export interface CommandRouteContext {
  readonly workspace?: string;
  readonly instanceMode?: string;
}
```

**两个问题**：① **没有 `displayMode`** ⇒ T3 下命令无法说明自己落在哪块屏（§2.3 要求一）；
② 两个字段都是**开放 `string`** ⇒ 与 `state` 已收口的
`WorkspaceKey = 'MAIN' | 'BRANCH'` 不一致。

**目标形状**：

```ts
/**
 * Local-only routing context. All three fields are closed enums.
 * Cross-version handling of unknown values is NOT yet defined; crossing a wire
 * boundary still requires the dedicated wire context / version negotiation
 * described in the 2026-08-30 contracts review.
 */
export interface CommandRouteContext {
  readonly workspace?: 'MAIN' | 'BRANCH';
  readonly instanceMode?: 'MASTER' | 'SLAVE';
  readonly displayMode?: 'PRIMARY' | 'SECONDARY';
}
```

🔴 **收窄不等于「序列化与兼容审查已完成」。** 早先版本要求把注释改成「可安全跨线」，
**那个论证不成立**，三条：
① 它与 owning source 相反 —— 产生这条注释的
`doc/review/platform/2026-08-30-…-contracts-requirements-review-claude.md` 要求的是
「**单独定义 wire context 或显式 allowlist/version**」，收窄字段类型不是其中任何一项；
② **闭合联合在运行期不存在**（TS 擦除）。POC 的 routeContext **已经在跨线**，
且入站是裸断言：`connectionController.ts:317` `envelope.context as CommandRouteContext`、
`:638` 同形。对端版本新增枚举值时零拦截；
③ 对照 `state` 在同一件事上是**闭合联合 + 运行期 guard + throw** 两件都做
（`supports/workspace.ts:12-30`），本文只做前者却给出更强的结论。
⇒ **收窄照做**（它被理由②「与 `WorkspaceKey` 不一致」独立支撑），
**注释改成事实陈述**，「跨版本未知取值的接收行为」登记为跨包欠账（§7，落点在入站边界）。

| # | 落点 | 变更 |
|---|---|---|
| 1 | `contracts/src/types/command.ts` | 三字段收窄 + 新增 `displayMode`；文件头注释改成上面那段**事实陈述**，不得宣布审查已完成 |
| 2 | 🔴 `tools/terminal-contracts/check-static.mjs` 的 **`runClosedLiteralUnions` 实现** | **必须先改门，才能加钉子。** `typeProperty` 用 `getTypeOfSymbolAtLocation` 取属性类型，`runClosedLiteralUnions` 随后断言**每个成员都是 `StringLiteral`**；而 `strict` 下**可选属性的类型含 `undefined` 成员** ⇒ 直接抛 `must be a string literal union`。现有四条点号钉子（`ErrorCatalogEntry.source` 等）**全是必填属性**，这条路从未被走过。⇒ 取值后按属性的 `SymbolFlags.Optional` **剥掉 `undefined` 再判**，并补一条**变异夹具**证明剥的是 `undefined` 而不是把 `string` 也放过 |
| 3 | 同上的 `expectedLiteralUnions` | 新增三条把三个字段的取值钉死。⚠️ 这是关键护栏：不钉住，闭合枚举随时能被改回开放 `string` |
| 4 | `contracts/test/public-surface.typecheck.ts` | 补 `@ts-expect-error`：三个字段的非法取值不可赋。⚠️ **同时必须改现有第 102 行** `{workspace:'store-01', instanceMode:'primary'}` —— 四个取值没一个在新集合里，收窄后它**必然编译失败** |
| 5 | 🔴 `platform-ports/test/public-surface.typecheck.ts` | **第 100 行** `{workspace:'test', instanceMode:'single'}` 同样必然失败。两个包的 `tsconfig` 都 `include test/**`，且 platform-ports 依赖 contracts 源码。⚠️ **早先版本漏了这一处，把零回归范围限定在「contracts 自己」** |
| 6 | `contracts/README.md` | 第 53 行写着 `CommandRouteContext（**仅本机路由，不得跨线**）`，第 112-116 行说「**两个闭集**不要自己发明取值」—— 本批后受门约束的闭集变成**七个**（见第四组末尾的列举）。`TR-10` 把 README 与源码不一致列为 **finding 级** |
| 7 | 与 `state` 的一致性夹具 | ⚠️ **早先版本写的「二者可互赋」在类型上不成立**：`WorkspaceKey` 是必填、`CommandRouteContext.workspace?` 含 `undefined`，**两个方向都只有一边通**。正确判据是 `NonNullable<CommandRouteContext['workspace']>` 与 `WorkspaceKey` **双向互赋（两行）**。⚠️ 夹具**归属包必须写明是 `kernel.base.runtime`** —— contracts 零依赖、不能 import state：真正会拦住的是 `tools/terminal-skeleton/check-static.mjs:218-227` 的 **`dependencies`/`devDependencies` 精确集门**（`skeleton-graph.ts` 给 contracts 声明的两者都是 `[]`）。⚠️ **不是 `source imports` 门** —— 那道门经 `graph-model.mjs:148-161` **只扫 `src/`、不扫 `test/`**，夹具放在 `test/` 里它根本不会红。这个事实要一并登记：本组第 4、5 项正依赖 `test/` 参与 typecheck，两处口径必须一致 |

⚠️ **本批只改类型与门，不实现 `displayMode` 的任何行为**（§2.4）。

### 第三组 · 删除 `AppModuleMiddlewareDescriptor`

🔴 **Dexter 2026-08-31 裁定：删。**

主张三已撤回、本批不建中间件链（§5）⇒ `contracts` 里的
`AppModuleMiddlewareDescriptor`（含 `priority`）与 `AppModule.middlewares`
在 TER 全仓**零 producer、零 consumer**，却被 `expectedPublicExports` 与类型层夹具主动防守。

**理由**：`CLAUDE.md`「不要为了保持向后兼容而长期保留废弃方案，优先删除过时代码」；
`contracts/README.md` §5 第 1 关「只有本包用不到、只有一个包用得到 —— 不要放进来」；
本批已经为前两组打开 contracts，边际成本只有一行。
**加强一条**：`priority` 要解决的是**顺序**，而 §3.4① 明确放弃了 actor 之间的顺序保证
（「一个 actor 不能依赖另一个 actor 的副作用已经发生」）—— 同一层已经不承诺顺序，
`priority` 更无处落脚。

**落点七处**（已逐一打开核过；穷举用 `grep -rin middleware`（**大小写不敏感**）——
早先用 `Middleware|middlewares` 漏掉了 README 里的小写单数，
`state/src/foundations/createStateStore.ts:57-58` 是 RTK 内建的 `getDefaultMiddleware`、无关）：

| # | 落点 | 变更 |
|---|---|---|
| 1 | `contracts/src/types/module.ts:20-23` | 删 `AppModuleMiddlewareDescriptor` 接口 |
| 2 | `contracts/src/types/module.ts:40` | 删 `AppModule.middlewares` 字段 |
| 3 | `contracts/src/index.ts:71` | 删导出 |
| 4 | `contracts/test/public-surface.typecheck.ts:29` | 删 type import |
| 5 | `contracts/test/public-surface.typecheck.ts:244` | 删夹具引用 |
| 6 | `tools/terminal-contracts/check-static.mjs:512` | 从 `expectedPublicExports` 移除 ⇒ **74 → 73** |
| 7 | 🔴 `contracts/README.md:51` | 该行写着 `module.ts  AppModule 及其 command/actor/**middleware**/slice 描述符` —— **必改**。`TR-10` 把 README 与源码不一致列为 **finding 级**，不是可选项 |

### 第四组 · 删除四个 catalog 类型

🔴 **Dexter 2026-08-31 裁定：删。**

动态 catalog 已于 2026-08-28 整体取消（§3.9）。这四个类型在 TER 全仓
**零构造、零消费者**（穷举 `apps/terminal` + `tools` + `libraries` + `scripts`，
唯一构造点是 contracts 自己的 T-6 测试），却被**四处同时锁住**：
`index.ts` 导出 · `expectedPublicExports` · `expectedLiteralUnions` · 类型层夹具。
⇒ **删除比保留贵**，门在这里制造了一个只增不减的偏压：正确动作比错误动作成本高。

**落点九处**（已逐一打开核过；`src/foundations/` 与 `src/supports/` 对这四个类型**零引用**）：

| # | 落点 | 变更 |
|---|---|---|
| 1 | `contracts/src/types/error.ts:54-70` | 删 `ErrorCatalogEntry` 与 `ResolvedErrorView` |
| 2 | `contracts/src/types/parameter.ts:21-33` | 删 `ParameterCatalogEntry` 与 `ResolvedParameter` |
| 3 | 🔴 `contracts/src/types/parameter.ts:1` | **删 `TimestampMs` 的 import** —— 它在该文件里的**唯一用处**就是 `ParameterCatalogEntry.updatedAt`，不删会留一个未用 import。⚠️ `error.ts` 的同名 import **要保留**（`AppError.createdAt` 还在用，第 46 行） |
| 4 | `contracts/src/index.ts:40,41,50,51` | 删四个导出 |
| 5 | `contracts/test/public-surface.typecheck.ts:43,52,63,64` 与 `:227,228,233,234` | 删四处 type import 与四处再导出 |
| 6 | `contracts/test/contracts.test.ts:23` 与 `:136-147` | 删 `ResolvedParameter` 的 import 与整个 `describe('T-6: parameter source discriminants')` 块 —— 它是这四个类型的**唯一真实构造点** |
| 7 | `tools/terminal-contracts/check-static.mjs:34-37` 与 `:510-511` | 删四条 `expectedLiteralUnions` 与四个 `expectedPublicExports` 名 |
| 8 | 🔴 `contracts/README.md:49` | 该行写着 `error.ts  错误协议：定义、模板、AppError、**目录、解析视图**` —— 删掉两个类型后成假，**必改** |
| 9 | 🔴 `contracts/README.md:50` | 同上：`parameter.ts  参数协议：值类型、定义、**目录、解析结果**、描述符` |

⚠️ **`contracts/README.md:112` 的「**两个闭集**不要自己发明取值」同批更新** ——
本批之后受门约束的闭集变成：`ErrorCategory` · `ErrorSeverity` · `ParameterValueType` ·
`RequestLifecycleStatus` · `CommandRouteContext` 的三个字段。**不再是两个。**

⚠️ **`ParameterValueType` 与 `ParameterDefinition`/`ParameterDescriptor` 不动** ——
「定义归各包 `supports/errors.ts`、工厂与模板渲染留在 contracts」是 2026-08-28 裁定的职责四分
（§3.9），定义侧保留是那次裁定的一部分，**只删被取消的 catalog / resolved 侧**。

---

## 7 · 前三个包的回顾与跨包欠账

**Dexter 2026-09-01 的要求原话**：

> 我怀疑你对前三个已经实施的包也没有详细逐行代码去看其用意与价值。
> 所以你也要**回顾一下之前那三个包是否有遗漏**，然后一起写到这次的需求分析中。

🔴 **诚实交代做到了什么程度。**

**已做**：① 逐条复审本文作者在前三个包上三次用「零生产消费者」否定 POC 能力的处置
（结果：两次结论错误、一次结论对但方法错，见下与 §10）；
② 2026-08-31 的四路 POC 对照顺带扫到的、落在前三个包上的问题
（`state` 的应用侧不校验同步方向、`state` 只建了 `workspace` 一轴、
`contracts.CommandRouteContext` 缺 `displayMode` 且是开放 `string`）。

⚠️ **未做**：**一次针对 `contracts` / `platform-ports` / `state` 的完整逐行重扫**。
上面两项都是「顺着已知线索找」，不是「把三个包对 POC 从头核一遍」。
⇒ **若要真正回答 Dexter 那个问题，还欠一轮独立重扫**，
建议与本批并行、由独立子 agent 分三路做，结论回填本节。
**本文不把已做的那部分冒充成完整回顾。**

### 7.1 已查出的欠账

| 欠账 | 落点 | 出处 |
|---|---|---|
| 🔴 同步应用侧的**方向校验**（`syncIntent` × 载荷来源角色）——**阻塞台账单写者不变量的成立** | `state` / `transport` | §4.7.7 ⑤ |
| 角色切换后**重置出站同步基线** | topology / `transport` | §3.7 |
| **跨版本未知枚举取值的入站处置**（`CommandRouteContext` 三字段） | `transport` / topology 的入站边界 | §6 第二组 |
| `displayMode` 的持有 · `workspace` 的派生 · 形态切换准入 | `display-context` | §2.4 |
| 每块屏的 UI 状态如何分片（单 store 多 surface） | `ui-state` | §2.4 |
| 🔴 **Root Surface 在其发出的命令上自动盖 `displayMode`** | `ui.base.render`（+ `ui-state`） | §2.4 |
| 🔴 **设备级 `displayMode` 的持有与设置机制**（持久化 slice · `internal` 写命令 · `isolated` · 只允许独立副机改的准入）—— 它就是 T1↔T2 的形态开关 | `display-context` | §2.4.1 |
| 🔴 **下游不得对缺失 route 抛错**（无发起 surface 的命令 route 为 `null`，设备级、两屏可见） | `ui-state` / `ui.base.render` | §4.7.2 ⑥ |
| **`ui.base.render` 取得 `CommandRouteContext` 的路径** —— 它的 `source imports` 是精确集（`[platform-ports, runtime, ui-state]`），**不含 contracts** ⇒ 盖章方拿不到那个类型，须由 runtime 或 ui-state 转出 | `ui.base.render` 那一批 | §2.4 |
| 🔴 **角色切换的业务留痕在重启后不存在** —— 台账 `persistIntent:'never'`、journal 不持久化，而角色本身是持久的 ⇒ 「怎么切过来的」重启后无处可查。**本批不满足**，需要留痕时另指去处 | 待定（可能是 `platform-ports` 的 terminalLogs 或后续的审计能力） | §4.4 |
| 🔴 **`contracts.AppModuleSliceDescriptor` 表达不了 `syncIntent`** —— 它只有 `{name, persistIntent?}`，而本包与后续所有同步 slice 都要声明 `syncIntent`；真正的声明在 `state` 的 `StateRuntimeSliceDescriptor`。⇒ 模块清单与真实声明各说一半 | `contracts`（本批已开，但**不在本批范围**） | §4.7.1 · §4.8a ④ |
| **`latest-wins` 同步模式的重新评估** | 第一个需要双向可写 slice 的批次 | 见下 |

🔴 **`latest-wins` 这条要展开说，因为它是被砍错的。**
当时的结论是「生产不可达（`direction` 只有两个值，三元的另一支永远走不到），删除」。
**真实的产品用意**（`state-runtime/src/supports/sync.ts:88-101`）：
`latest-wins` = 按 `updatedAt` 比较、只接受比本地更新的条目 —— 这是**双向可写**场景的合并策略；
`authoritative` 是单向权威、本地改动一律丢弃。

**需求真实存在的证据**：`ui-runtime-v2/src/features/slices/screenState.ts:60-64`
**在 reducer 里手写了一遍 latest-wins**：
`if (!local || local.updatedAt < incoming.updatedAt) { state[key] = incoming }`
（`overlayState.ts:87-89`、`uiVariableState.ts:60-62` 各有一份）。
⇒ 正确的读法不是「机制没人用」，而是
**「需求真实存在、机制没接通、于是消费者自己又实现了一遍」**。

🔴 **而且当时的处置自相矛盾**：砍掉了 `latest-wins`，却**保留了 `SyncValueEnvelope.updatedAt`** ——
而 `authoritative` 模式**根本不读这个字段**。**`updatedAt` 的存在本身就是双向合并的证据。**

⇒ **不得以「`state` 包当时没建」为由把它当成已裁定的不做。**
⚠️ 本包的两个台账 slice 是**单写者**，只需要 `authoritative`，**不受这条欠账阻塞**。

---

## 8 · 交付物

⚠️ **每一项都标了交付单元**（切分见 §0-A）。**【A】= 运行时骨架** · **【B】= 请求台账**。

### A-1 【A】运行时骨架本体
模块系统（单一入口 · **`AppModule.commands` 按 owning module 查** · 重名一律报错 ·
runtime 自己的内部模块，承载**角色 slice + `set-instance-mode`**）
+ 命令定义与分发（含 `visibility` 五条、`CommandDispatchResult` 返回形状）
+ §4.2b 环路防护（**深度上限** · 重入命中记 `error`）
  ⚠️ **单 request 命令数上限属单元 B**（计数来自台账的 `commands.length`，§4.2b ②）
+ §4.2c **`peerDispatchGateway` 插槽**（接口 · 安装点 · 至多一个 · **未安装即记为该命令的 `error`、不 reject**）
+ actor 执行与上下文（**模块上下文减五处、actor 上下文减三处**）+ 错误归一化 + 命令作用域 logger + journal
+ §4.4b 的 `limits` 入参（**六个可调值的形状在 A 就要定完整**）
+ 🔴 **§0-A 契约二：把命令与 actor 的状态迁移与记录构造收敛到单一产生点**
  （`emitLifecycle` 或等价物；A 期只驱动 journal 与累加器，B 期在同一函数体内加台账写入）。
  ⚠️ 它**已被移出机械门**（§8 门表）⇒ **必须列进 A 的评审清单**（见下），否则没有任何东西拦得住
+ 🔴 **两个上下文的属性精确集**（§4.3 已逐名列出：模块 9 项 · actor 11 项）——
  §8 那道门的判据就是它
+ **`defineCommand` 的 `timeoutMs` 构造期校验**（必须是有限正数，§4.2b ②）
+ **保留名注册表**：两个保留 `actorKey` + 三个保留错误 key（§4.2b ②），业务模块注册同名即报错
+ §4.5 启动四阶段（**取「构造与启动分离」那一支**，失败进 `failed` 终态）
+ §4.5b 统一持有订阅与定时器 + 仅供测试的释放入口
+ §4.6 reset 两段式（含三个洞的处置）
+ §4.8a 角色自持（角色 slice + **两跳链中属 runtime 的那一跳**：`set-instance-mode` 这条 `internal` 命令
  —— 第一跳的 `public` 命令与准入归 `display-context`，是 §7 的跨包欠账
  + **为 B 预留的角色变更副作用挂载点**）
+ §4.3 的 `routeContext` **不透明继承** 与 `ActorDispatchOptions` 的实现/不声明二选一。

🔴 **另有七条要求散在正文、早先版本漏列，逐条补进本项**（漏列 = 必漏做）：
· **`descriptors` 在所有阶段是同一份**（§4.1 第 4 条 · §4.5 阶段 0）；
· **跨机执行按 `commandName` 查本机已注册定义，不得重建 definition**（§4.2）
  —— §4.7.2 ⑤ 的整个推理建立在这条已实现之上；
· **`getSessionId` 读取器通道**（§4.4）；
· **journal 上限 1000、从头裁**（§4.4）；
· **peer 派发自带超时预算**（§4.7.7 ①，按 §0-A 契约一归 A）；
· **启动失败后「后续任何调用」都 typed reject**（§4.5，不只是再调 `start()`）；
· **只有一条建 runtime 的路径**（§4.1 第 1 条）——
  ⚠️ 它只能靠「公开导出精确集合」这道门间接兜住（不导出第二个构造函数），详设须写明。

⚠️ **不含中间件链**（§5）。

### A-1b 【A】actor 返回值的完整处置（§4.7.3 全节）
校验（`StateJsonValue` 运行期递归判定）· **与 actor 脱钩**（与校验合成一次递归）·
**体积上限**（`limits` 的一项）· 非法与超限一律**判该 actor `error`**、原因进 journal、
**不抛出到分发边界**。
🔴 早先版本把这一节整节归 A（§0-A 契约一）却没给交付物条目，只在测试里出现 —— 按
「漏列 = 必漏做」补上。

### A-1c 【A】peer 网关的执行记录（§4.7.2 ⑤b）
发起侧那条观察里**恰好一条** `kernel.base.runtime.peer-dispatch` 的 actor 记录 ·
五种网关返回情形到该记录的映射（含 `partial-failed → error` 这次**有损映射**）·
`result` **恒为 `null`**。
🔴 同样是「归 A 却无条目」，补上。
⚠️ **A 期跨机命令的对端中间结果不可见** —— 网关返回值里那份 `actorResults` 只用于推出
本机这条记录的 `status`，**不进本机的观察**（⑤b：`result` 恒 `null`）。
B 期经对端自己那条观察的 slice 同步才看得到。**这是 A 期一处已知的能力缺口，接受。**

### A-2 【A】`aggregateCommandStatus` 与它依赖的三个记录类型
`LedgerError` · `ActorExecutionRecord` · `CommandExecutionObservation`（§4.7.2）
随 A 一起定义；`aggregateCommandStatus`（§4.7.5 第一级）**从一开始就带 `running` 前置判据**。
🔴 这是 §0-A 的**跨单元契约一**，B 复用同一份实现，详设与评审都必须显式检查。

### A-3 【A】`contracts` 第三、四组变更
删 `AppModuleMiddlewareDescriptor`（**七处**落点）· 删四个 catalog 类型（**九处**落点）。
⇒ **导出数 74 → 69**。同批跑 `terminal-static` 与 `apps/terminal/**` 全量 typecheck 证明零回归。

### A-4 【A】`kind` 迁移
runtime 落下第一个真实 slice（**角色 slice**，§4.8a ③）⇒ 按 `TR-09` 骨架阶段例外，
建 `runtime/application/moduleManifest.ts` 声明 `kind:'owner'`、从 `skeleton-graph.ts` 移除 `plannedKind`。
⚠️ **`tools/terminal-skeleton/graph-model.mjs:72` 会因 `plannedKind` 缺失直接抛** ⇒ 同批改它。
🔴 **而且它目前只读 `skeleton-graph.ts`，没有任何读取包内 manifest 的输入源** ——
「已声明 `kind` 的包不再要求 `plannedKind`」需要给它新增一条输入，详设须写明怎么加。
🔴 **要红夹具就得先建门 —— 而这道门全仓不存在**（亲验：`tools/terminal-state/check-static.mjs` 里**与 slice 相关的只有** `runToolkitZeroSlice`，
查的是「toolkit 不得调 `createSlice`」，
**owner-必须有-slice 那一半没有**）。⇒ 本项要交的是**门 + 红夹具**两样。
🔴 **`TR-04` 的门同样不存在**（亲验：`tools/` 与 `scripts/` 下
`persistIntent`/`restart-recovery` **零命中**）。
本包是第一个落下 `persistIntent:'owner-only'` slice 的包 ⇒ 这道门也要在 A 建。
🔴 **但判据凑不齐 `TR-04` 要求的正反双断言**：`TR-04` 要用例同时证明
「该恢复的恢复了」与「不该恢复的确实没恢复」，而 A 期角色 slice **只有一个持久化字段**，
没有「不该恢复」的对象（台账在 B、且 `persistIntent:'never'`）。
⇒ **本批的处置**：门只建**正向**那一半（「声明了 `owner-only` 的包必须有重启恢复用例」），
并**在门的反例栏明写「反向断言这一半本批无对象可测，B 交付台账后补齐」**。
⚠️ 不得为凑反向断言给角色 slice 硬加一个非持久字段。
⚠️ **`owner` 身份由角色 slice 建立，不是台账 slice**；**不得为满足 owner 硬造占位 slice**。

### A-5 【A】`tools/terminal-skeleton/verify.mjs` 的两处硬编码

🔴 **这是单元 A 的两组契约变更（第三、四组，共 7+9=16 处）之外的第 17–24 处落点
（`verify.mjs` 两处硬编码 + `verify.test.mjs` 五处夹具 + 新建一个 `terminalRealTestOwners` 集合，
共 8 处），早先版本一字未提，而单元 A 只要写测试就撞它。**
亲验两处：

| 位置 | 现状 | 撞法 |
|---|---|---|
| `verify.mjs:18-27` | `terminalTestOwners` 是**硬编码的 8 个包精确集**，不含 runtime | `assertTurboDryRun` 对 `test` 任务做集合相等断言 ⇒ runtime 有 `test` script 即判 `extra` |
| `verify.mjs:98` | `if (real.length !== 3 \|\| noTests.length !== expected.length - 3) throw` | runtime 打出 `REAL_TESTS` marker ⇒ `real=4`，必红 |

⇒ 同批：把 runtime 加进 `terminalTestOwners`；
🔴 **「把 `3` 改成随集合推导」推不出来** —— `terminalTestOwners` 是平表，
**不编码「哪几个包有真实测试」**（`verify.mjs:89-97` 是三条并列的硬编码断言）。
⇒ 必须**另建一个 `terminalRealTestOwners` 集合**，把 `:89-97` 改成按它遍历；
并同步 `tools/terminal-skeleton/verify.test.mjs` 的夹具。
🔴 **范围比想的大，但也不是「全都断」—— 逐块点过，五断一存**：
该文件有**六个** `expectedTaskOwners('test', 2)` 调用点（`:14 :34 :53 :67 :80 :94`），
而 `assertPackageTestMarkers` 的**第一道检查**就是
`markers.length !== expected.length`（`verify.mjs:75-77`），排在所有 per-package 断言之前
⇒ runtime 一进 `terminalTestOwners`，`expected.length` 由 8 变 9：

| 夹具 | 现在断言什么 | runtime 进集合后 |
|---|---|---|
| `:14-23` | `deepEqual(expectedTaskOwners('test',2).sort(), [8 个名字])` | **断** —— 少了 runtime |
| `:25-49` | 8 条 marker 的**正例**（不抛） | **断** —— 抛 `marker count mismatch` |
| `:50-56` | 1 条 marker ⇒ 期望 `/marker count mismatch/` | ✅ **仍过**（1 ≠ 9 照样是 count mismatch） |
| `:57-69` | 8 条 ⇒ 期望 `/platform-ports marker must be REAL_TESTS/` | **断** —— 先撞 count mismatch，消息不匹配 |
| `:70-82` | 8 条 ⇒ 期望 `/state marker must be REAL_TESTS/` | **断** —— 同上 |
| `:83-96` | 9 条（含 `ui-support-test-harness`）⇒ 期望 `/marker count mismatch/` | **断** —— 9 = 9 不再 count mismatch，改抛 `test marker package mismatch`（missing=runtime, extra=ui-support-test-harness） |

⇒ 要改的是 `:14-23` · `:25-49` · `:57-69` · `:70-82` · `:83-96`，**五处**；`:50-56` 不动。
⚠️ `:83-96` 那一处**尤其要注意**：它不是简单地跟着 `expected.length` 走，
而是**换了一条错误路径**，照抄旧写法改不对。
⚠️ 这道门由 `tools/verify-gates/verify.mjs:160` 的 `terminal-verify` 真实执行，**绕不过去**。

### B-1 【B】请求台账本体
两个单写者 slice + `RequestExecutionRecord` + 读侧合并 selector（含 `RequestExecutionView`
与按 requestId 分片的记忆化）+ 第二级 `aggregateRequestStatus` + 时效淘汰
+ §4.7.7 边界 ②③④ 的落地（**① peer 超时按 §0-A 契约一归 A**；
  **⑤ 只是登记欠账、落点在 `state`/`transport`，不在本批实现**）
+ §4.8b 的台账 route 记账与两级过滤
+ **单 request 命令数上限**（§4.2b ②，计数来自台账的 `commands.length`）
+ 向 A 的角色变更副作用挂载点**注册一项**：清空本机不再拥有写权的那份（§4.7.6 第 4 条）
+ 向 A 的单一状态迁移点（§0-A 契约二）**追加台账写入**，不动调用点
+ 把 `CommandExecutionObservation.displayMode` 的赋值从恒 `null` 改为取自 `routeContext`
  （§0-A 登记的那个 B→A 触点，只改一处赋值）。
🔴 上面三项分别对应 §0-A 的**契约三、契约二、以及那个已登记的 B→A 触点**。

### B-2 【B】`contracts` 第一、二组变更
`RequestLifecycleStatus` 扩五态 · `CommandRouteContext` 收窄并补 `displayMode`
（**含先改 `runClosedLiteralUnions` 实现**、`contracts` 与 `platform-ports` 两个包的夹具、README，
以及**归属 `kernel.base.runtime` 的那条 `WorkspaceKey` 一致性夹具**，§6 第二组 #7）。

### 门与红夹具  【A 除注明外】

🔴 **每条必须自带反例栏**（`terminal-coding-standard.md:7`：
「写不出『这道门抓不到什么』，说明这条还没想清楚」），**措辞不得超出手段能证的范围**。

| 门 | 单元 | 手段 | 反例栏 |
|---|---|---|---|
| ~~`TR-01` reducer 只经 actor~~ | —— | 🔴 **不列为本包的门。** 亲验：`tools/terminal-skeleton/check-static.mjs:336-351` 的 `runTr01Boundary` 里 `allowed = new Set(['kernel.base.runtime','kernel.base.state'])` —— **runtime 被白名单豁免**，这道门对本包写的任何一行都不会红。列上去是假绿 | —— |
| **两个上下文类型的属性名精确集** | A | 🔴 **对模块上下文与 actor 上下文的类型声明各做一次 AST 属性名精确集断言**（不是标识符缺席 —— `dispatchAction` 在本包内部必然大量出现，那正是上面白名单存在的原因）。⚠️ **精确集已在 §4.3 逐名给出**（模块上下文 9 项 · actor 上下文 11 项）。门断言的是那两份清单，不是「与实现一致」 | 运行期用 `as` 绕过类型、或经第三方 helper 间接取得 store，抓不到 |
| 命令名不可伪造 | A | 🔴 **不是断言字面量前缀** —— 前缀由 `defineCommand` 在运行期拼（§4.2），源码里的字面量本来就是裸名，那样断言对**正确实现**必红。⇒ 正确的门是 **AST：本包不得导出任何以字符串为命令名的「**挂载**」API**（`onCommand` 的第一参数必须是命令定义对象；`defineCommand` 的名字参数只接受裸名字面量，不接受拼接表达式）。🔴 **只禁挂载，不禁派发** —— 按名派发不创造命令、只查已注册的 handler，而 automation 需要它（`TR-01` 立规理由②，`terminal-coding-standard.md:64`）；伪造入口在挂载那一侧 | **抓不到跨包劫持**（本门只扫本包）；抓不到用 `as` 绕过类型直接构造定义对象；**抓不到按名派发一个不存在的命令**（那是运行期行为，归测试） |
| runtime 公开导出精确集合 | A | 与前三包同形态的 `tools/terminal-runtime/check-static.mjs`。🔴 **必须同批在 `tools/terminal-skeleton/verify-static.mjs` 注册对应的 `run(...)`** —— 既有形态是**每包两条**（`*-model-test` + `*-real-static`）；不注册就是白建 | **导出名对而语义换了，抓不到**；只保证名字集合不漂。也抓不到「第二个构造函数被内部使用但不导出」 |
| 记录类型可作 `StateJsonValue`（`type` + 无可选属性） | A | 类型层夹具（三个类型随 A 定义） | **抓不到运行期用 `as` 写进去的 `undefined`** —— 这正是 §4.7.3 第 2 条要单独做运行期校验的理由 |
| 台账记录不含 `payload` | **B** | checker 断言 `RequestExecutionRecord`/`CommandExecutionObservation` 的属性名精确集合 | **抓不到把 payload 塞进 `result` 里** —— 那只能靠 review |

⚠️ **以下三条只能靠标识符匹配，写成语义断言就是仓内明令禁止的伪 checker ⇒ 移出门清单，改为评审判断**：
「全包不得出现 request 专用读取入口」（换名成 `getRequestSnapshot` 即过门）·
「单一 `normalizeError`」（第二份叫 `toAppError` 即过门）· 「单一状态迁移点」（无机械判据）。

### 测试

🔴 **要求真实的端到端行为验证，不接受「只能用夹具」**（§4.7.1）：
测试注册**自己的模块 + 命令 + actor**；两份 slice 各自被真实写入靠**切角色**；
同 commandId 两侧观察靠**两个 runtime 实例 + 内存 `peerDispatchGateway`**；
两份合并靠 `state` 的 `createFullSyncPayload`/`applyAuthoritativeSync` 手工搬运。
**不需要 `transport`，不需要 topology。**

**【A】至少含**
- 模块系统：环检测 · 重复模块名 · **重复 `actorKey`** · `optional` 依赖 ·
  **模块 B 的 actor 挂载模块 A 声明的命令 ⇒ 绿** · **挂载无任何模块声明的命令 ⇒ 红**。
  ⚠️ **slice 名重复不必新建机制** —— `state` 的 `createStateRuntime:48-50` 已经抛；
  本包只需一条「不绕过它」的用例。
- `visibility` 五条：**`public` 缺 `requestId` ⇒ 拒** · **未声明 `visibility` 的命令按 `public` 处理** ·
  **无 request 的 `internal` actor 发 `public` 子命令必须显式给 requestId，否则 typed reject** ·
  **automation 经门面发 `internal` 且带 requestId ⇒ 受理并进台账（B 期验台账半）**。
- 分发：多 actor 聚合 · 零 actor × `allowNoActor` 真假（**前置 `completedAt !== null`**）·
  **重入命中 ⇒ 该 actor `error`、同命令其它 actor 照常完成** ·
  **命令链深度上限**（**单 request 命令数上限属【B】**）。
- `aggregateCommandStatus` 的 `running` 前置判据**两例**：
  `[{running}]` 不得算 `completed` · `[]` 且 `completedAt===null` 不得算 `error`。
- 🔴 **能区分新旧聚合规则的两例**（缺了这两条，一个照抄 POC
  「任一 `TIMEOUT` → `TIMEOUT`」、只补 rule 0 的实现能全绿通过）
  —— ⚠️ **两条都必须前置 `completedAt !== null` 且无 actor 处于 `running`**，
  否则 rule 0 先命中、两条一起退化成 `running`，判别力归零：
  · `[{completed}, {timed-out}]` ⇒ **必须是 `partial-failed`**，不得是 `timed-out`；
  · `[{error}, {timed-out}]` ⇒ **必须是 `error`**，不得是 `timed-out`。
- 🔴 **命令名无逃逸口的两条构造期用例**（§4.2）：
  · `defineCommand` 收到含 `.` 的裸名 ⇒ **构造期抛**；
  · `onCommand` 只接受命令定义对象，传字符串在类型层即不通过（类型层夹具一条）。
  ⚠️ 早先版本把「禁止裸名含 `.`」只写在正文里，**交付物、门、测试三处都没有落点**
  —— 而 §8 门表自陈那道 AST 门只管**挂载 API 的形状**，管不到裸名内容。
- **`partial-failed → error` 的有损映射**：网关返回 `partial-failed`
  ⇒ 本机那条网关记录是 `error`（§4.7.2 ⑤b）。
- **peer 网关三态**（§4.7.2 ⑤b）：未安装 ⇒ `error` · 超时 ⇒ `timed-out`
  （**网关永不 resolve** 走这一支）· 返回成功 ⇒ `completed`。
  ⚠️ **「在途 ⇒ `running`」这一态在 A 期不可观测** —— `dispatchCommand` 只在命令终结后返回，
  A 期没有台账、没有 selector，没有任何入口能在中途看到它。
  ⇒ **它归【B】测试**（经台账与合并 selector 观察）。
  ⚠️ A 期这一态**只能靠评审判断**（读分发器的 peer 分支确认它先写 `running` 再等）——
  类型不保证运行期取值，不得写成「类型层保证」。
  · **重复安装网关 ⇒ 报错**（§4.2c ②）。
- **跨机执行按 `commandName` 查本机已注册定义**：对端收到一条本机声明了
  `allowNoActor:true` 的命令、且本机无 actor ⇒ 结果是 `completed` 而非 `error`
  （POC 因重建 definition 在这里误判，§3.4⑧）。
- **journal 上限**：超过 1000 条后从头裁，最新的仍在。
- actor 返回值：**循环引用 / `NaN` / `Date` ⇒ 该 actor `error`、命令非 `completed`、
  journal 有原因、结果里没有半个损坏的 result、且不抛出到分发边界** ·
  **返回后再修改该对象，记录不变（与 actor 脱钩）** · **超体积上限 ⇒ 该 actor `error`**。
- 超时：**迟到完成 ⇒ 记录仍是 `timed-out`、journal 有迟到记录，
  且该 actor 后续的 `dispatchAction`/子命令/port 调用照常成功**。
- 启动与 reset：**启动失败后再调 `start()` 是 typed reject**，
  **且失败后 `dispatchCommand` 等其它调用同样 typed reject** ·
  **`descriptors` 在 `preSetup` 与 `install` 两阶段是同一份**（长度与内容都相等）·
  **reset 序列：`previousState` 在 `resetState()` 之前捕获、`onApplicationReset` 拿到的是新构造的上下文** ·
  **reset 三洞**（无 requestId 的 internal 请求 reset 有确定行为 ·
  同 request 两次请求不静默覆盖 · reset 重播 `initialize` 后再请求 reset 有终止条件）。
- 角色：**重启后仍是 `SLAVE`（`TR-04`）** · **角色 slice 不参与同步**
  （伪造一条打向它的入站 diff ⇒ 被拒）。
- `routeContext`：**子命令继承** · **actor 显式传时整体替换而非合并**。
  ⚠️ 「A 期不读它的任何字段」（不透明搬运）**写不成会失败的测试** —— 那是代码属性不是行为属性
  ⇒ 归**评审判断**，不列测试。
- 类型层夹具：三个记录类型可作 `StateJsonValue`（`type` + 无可选属性）。

**【B】至少含**
- 第二级聚合：**`{cmdA:error, cmdB:running}` 不得算终态，且跨过淘汰窗口后仍在**。
- 🔴 **第二级 rule 4（全失败且全超时 ⇒ `timed-out`）单独一例**：
  `{cmdA:timed-out, cmdB:timed-out}` ⇒ **`timed-out`**，不得是 `error`。
  ⚠️ 早先版本第二级只测了 rule 0，**rule 4 是第二级唯一一条能被 rule 5 悄悄吞掉的规则**
  （把它写成「有失败即 error」，除本例外全部用例仍绿）。
  配套反向一例：`{cmdA:timed-out, cmdB:error}` ⇒ **`error`**。
- **合并 selector 的四种组合**（① 只有一侧有记录，状态与完整视图只按该侧事实计算，
  不等另一侧、不泄漏旧 cache 事实；② 两侧都有、不同 commandId；
  ③ **同 commandId 两侧都有观察**；④ 一侧全终态另一侧仍 running）。
  ⚠️ 早先版本把「零 actor × `allowNoActor` 真假」混进来当 ⑤⑥ —— 那是第一级规则的分支，
  不涉及合并，已移到【A】。
- **同 commandId 冲突取本机那份**：主机 `timed-out` + 副机 `completed`
  ⇒ **主机视图 `timed-out`、副机视图 `completed`，两台不同是预期**。
- **时间戳回退**：只有镜像半有记录时，`startedAt`/`updatedAt` 取镜像那份且 `timeSource:'peer'`。
- 淘汰：超时效终态被淘汰 · running 超时效**不**被淘汰 · **判据用合并结果、对象只限本机那份**
  （伪造镜像半的过期终态 ⇒ 本机不删它）· 淘汰走命令而非裸 dispatch ·
  已淘汰查询返回 not-found · **镜像半信封时间超前 40 分钟 ⇒ 不影响本机淘汰与排序**。
- **角色变化时清空本机不再拥有写权的那份**，且**清空发生在写角色字段之前**（§4.7.6 第 4 条）。
- route：**同一 request 内命令级与请求级 route 不同时，两级过滤各自取到正确集合** ·
  **无发起 surface 的命令 route 为 `null` ⇒ 两块屏都可见**。
- 🔴 **第二级同两例**（第二级独立于第一级，必须各测一次）：
  命令集 `[completed, timed-out]` ⇒ **必须是 `partial-failed`**；
  `[error, timed-out]` ⇒ **必须是 `error`**。
- **最长驻留上限**（§4.7.6 第 3b 条）：本机那份信封超过上限 ⇒ **无条件淘汰**，
  即使合并结果仍是 `started`（构造：镜像半冻结一条 `running`，对端永不再写）。
- **单 request 命令数上限**：超限后拒绝新派发、**只写一条** `error` 观察；
  且**该 request 不因此终态化**（第二级 rule 0 先命中），台账不再增长。
- **`rootCommandIds` 由 selector 算出**：两侧都无根命令时为空数组；
  副机那份单独看时为空数组、合并后包含主机那侧的全部根命令；同一 requestId 多根时按
  `startedAt`、再按 `commandId` 稳定排序。
- **selector 按 requestId 分片记忆化**（一次写入触发的重算次数与台账内其它请求数无关）。
- **台账为空**（重启后，与【A】的角色 `TR-04` 用例配对）。

### 🔴 单元 A 的评审清单（机械门抓不到、必须人工核的四条）

§8 门表与测试节合计移出下列判据（它们只能靠标识符匹配或无机械判据）⇒
**A 收口评审必须逐条人工核，缺一条就等于没有任何东西拦住它**：

1. **§0-A 契约二**：状态迁移与记录构造是否收敛到单一产生点？
   🔴 **判据要写准**：不是「构造点计数 = 1」——
   `ActorExecutionRecord` 在 A 期至少有三条合法构造路径（正常 actor 完成 ·
   ⑤b 的网关记录 · §4.2c ③ 未安装网关那条 `error`），单测里还有字面量。
   ⇒ 正确判据是：**`src/` 内是否只有一个构造它们的函数**
   （三条路径都经它，参数不同），且 `CommandExecutionObservation` **也只在那里构造**
   —— 后者是 §0-A 那个 B→A 触点「只改一处赋值」成立的前提。
   `journal.append` 同理：**只有一个调用点**，纯 journal 事件（reset 第二次 `reason` 等）
   经同一函数的不同 `transition` 种类进入，不得绕开。
2. 🔴 **§0-A 契约三**：角色变更生效点是否做成了可扩展的副作用列表？
   （反问：B 要注册「清空旧那份台账 slice」时，需要改 `set-instance-mode` 的 actor 吗？应为否）
3. 🔴 **§0-A 约束四**：门面 `dispatchCommand` 的按名派发能带全四项身份 options 吗？
4. 🔴 **`emitLifecycle` 自身不得向分发边界抛**（§4.3）——
   每-actor 路径要有 catch 降级壳，A 期就要建。
5. **只有一条建 runtime 的路径**（§4.1）——「不导出第二个构造函数」只能靠这道人工核，
   §8 门表自己写明「抓不到第二个构造函数被内部使用但不导出」。
6. **⑤b 的「已派出、未回 ⇒ `running`」**（§8 测试自陈 A 期不可观测）——
   读分发器的 peer 分支确认它先写 `running` 再等。
7. **单一 `normalizeError`**：是否只有一份错误归一化实现？（换名成 `toAppError` 门抓不到）
8. **全包无 request 专用读取入口**：`queryRequest`/`subscribeRequest` 之外，
   有没有换名的等价物（`getRequestSnapshot`/`watchRequest`/`useRequest`）？
   ⚠️ A 期近乎空转（A 没有台账可读），但保留 —— 它能抓住「两个上下文上偷偷留了 `queryRequest`」。
9. **§4.3 的「A 期不读 `routeContext` 的任何字段」**（不透明搬运）——代码属性，写不成测试。
   ⚠️ 注意区分：A **要**读 `instanceMode`，但读的是**角色 slice**，不是 `routeContext`（§4.8a）。

⚠️ 这四条与 §9 交给 Codex 的「独立判断点」不同：那是**方案取舍**，这是**收口前的机械核对**。

### 共用
- **中文 `README.md`**（`TR-10`）。🔴 **以 `TR-10` 的四轴为底**（定位 / 作用 / 结构 / 用法）
  **加「在这个包上迭代时」一节**，示例必须来自本包真实公开面。
  **A 期交完整四轴**（骨架部分）；**B 期追加台账章节**。
  **另须写明五件事**：§4.7 全节（两个单写者 slice 的设计与四条理由 · 三层 data 形状 ·
  **actor return 即中间结果** · §4.7.4 的业务例子 · **五条边界** · 淘汰策略）·
  §2 的三种部署形态（T1/T2/T3 · `instanceMode × displayMode → workspace` 的派生 ·
  为什么 T3 让 `displayMode` 只能走 `routeContext` · 本包只负责承载与记账这条边界）·
  **订阅里发命令必须自带幂等判据**（§4.2b ③）· **角色 slice 绝不参与同步**（§4.8a ④）·
  **跨机命令在两台机器上会显示不同状态，这是刻意的**（§4.7.5）。
- **跨包欠账登记**（§7）写进 `HANDOFF.md` 或等价台账，不得随本批结束而蒸发。
- 实施记录。

---

## 9 · 请 Codex 独立判断的点

⚠️ 请先自己读 POC 再看本文结论。**特别是 §0 的判读纪律：
若你要否定本文的任何一条，请给出「产品用意在 TER 不成立」的理由，而不是「没人调用」。**

⚠️ 本文已经过**四路独立对抗盲审**（§11 第四轮），十五处作者自造缺陷已修。
请重点核**修法本身**，以及下面这些**仍然开着**的点。

1. **§4.7.5 的 `running` 前置判据穷尽了吗？** 这是本轮最重的一处修复：
   两级聚合原本没有 `running` 分支，会把正在跑的东西判成终态、进而被淘汰删掉。
   现在两级各加了一条最高优先级前置。**请构造反例**：还有没有哪组合法事实，
   按新规则算出来的状态在业务上仍是错的或误导的？
2. **§4.7.2 ⑥ 的 `null` route 语义（「设备级、两屏都可见」）对吗？**
   这是我为「无发起 surface 的命令」现补的规则，**没有 POC 先例**。
   反向的选择是「两块屏都不可见」或「必须显式指定」。请判断这个默认值。
3. **§4.7.6 第 1 条与第 4 条（淘汰只作用本机那份 + 角色生效点清空旧那份）** 够不够？
   请找出仍会让记录永久驻留或被误删的路径。
4. **§6 第二组第 2 项要求先改门实现（剥掉可选属性的 `undefined`）再加钉子** ——
   请自己打开 `runClosedLiteralUnions` 核这个判断；若我判错，这一整项该撤。
5. **§6 第三、四组的删除落点穷尽了吗？**（Dexter 2026-08-31 已裁定删，不是待决项。）
   请自己穷举 `grep -rin middleware` 与四个 catalog 类型名，核对第三组**七处**、第四组**九处**
   是否有遗漏；特别核 `parameter.ts` 的 `TimestampMs` import 是否只剩这一个用处。
6. **`RequestLifecycleStatus` 住 contracts、`CommandAggregateStatus` 住 runtime 这个不对称**
   （§6 第一组末尾）站得住吗？若你认为对称更重要，请说清代价。
7. **§4.7 的复杂度配不配当前阶段？** Dexter 已裁「本批建到完整程度」，
   但**做法**仍可挑：三层形状、两级聚合、多观察、两级 route、记忆化要求、体积上限。
   哪一处可以更小而不丢能力？
8. **§0-A 的两个单元切在正确的地方吗？** 我按「§4.1–4.6 与 §4.8a 不依赖台账进 slice」切的。
   请核这个依赖判断；特别是 `aggregateCommandStatus` 横跨两个单元这一点，
   有没有更好的切法（比如把它整个放进 B、A 只返回原始 actorResults）。
9. **本文有没有过度设计？** 也请指出**做得不够**的地方 —— 两个方向都要给。

---

## 10 · 决策记录

| 日期 | 裁定 | 落点 |
|---|---|---|
| 2026-08-28 | **动态 catalog 整体取消** —— 「最主要的是从 store 中动态取值，但实际上意义不大，后续不希望再从 store 中动态取值了，就在各个包中自己定义就好了」。owning source 是 `doc/review/platform/2026-08-28-newposv1-package-analysis-claude/00-ter-build-order-claude.md` §2 F1b 与 §4B.8 | §3.9 · §5 |
| 2026-09-01 | **请求台账放 slice**，不用内存 Map；两个单写者 slice、requestId 为键、读侧合并 | §4.7.1 |
| 2026-09-01 | **状态在 selector / reselect 里动态计算，不存** | §4.7.2 · §4.7.5 |
| 2026-09-01 | **selector 恰好只读到一边 request 状态时，只按该边事实计算返回** | §4.7.5 · §8【B】 |
| 2026-09-01 | **`RequestLifecycleStatus` 五态**；当前只是记录，后续是否重试不做约束也不做设计 | §4.7.5 |
| 2026-09-01 | **`visibility` 的原始用意**：`internal` = 内部发出的、可以没有 request；外部调用必须带 request；UI 与自动化脚本一律只能发 `public` | §4.2 |
| —— | ⚠️ **上一条在 §4.2 被收窄**（作者判断，非裁定）：原话防的是**伪造 requestId**；禁 automation 发 `internal` 会作废 `TR-01` 立规理由② ⇒ 改为「automation 发 `internal` 须显式带合法 `requestId`」 | §4.2 第 3/5 条 |
| 2026-09-01 | **角色可热切换**，POC 里有例子；设好主副、连上之后按方向同步即可 | §4.8a |
| 2026-09-01 | **`timed-out` 本身就是一种 error 类型，不影响后续调用** | §4.3 |
| 2026-09-01 | **重启就清掉，不保留，不要过度设计** ⇒ 两个 slice `persistIntent:'never'` | §4.7.6 |
| 2026-09-01 | 淘汰量级**半小时** | §4.7.6 |
| 2026-08-31 | **`contracts.CommandRouteContext` 必须现在改** | §6 第二组 |
| 2026-08-31 | **actor 级 `requestApplicationReset` 两段式本批做** | §4.6 |
| 2026-08-31 | **角色翻转丢在途记录不用管** —— 未闭合中间态的 request 记录不重要，半小时后都会被清理 | §4.8a |
| 2026-08-31 | 三种部署形态是本包的第一约束 | §2 |
| 2026-08-31 | **双屏设备不能整体作为 pair 的副机** ⇒ 副机必为单屏设备，`workspace` 确为设备级两屏共享；`displayMode` 进 `routeContext` 的理由是 **T3 写侧分片**，不是派生 workspace | §2.3 要求一 |
| 2026-08-31 | **跨机同一命令「我这边超时、对端说完成」⇒ 超时失败，只以本机获取到的信息为准** | §4.7.5 |
| 2026-08-31 | 读侧**只取已经同步到本机的信息** ⇒ 不为远端中间结果的实时可见性建任何机制 | §4.7.1 |
| 2026-08-31 | **台账本批建到完整程度** | §4.7.1 |
| —— | ⚠️ **「两侧性在本批就能真实验证」（测试模块 + 切角色 + 两个 runtime 实例 + 内存网关）是作者驳回盲审时的推导，不是 Dexter 裁定** —— 早先版本把它一并冠在裁定名下，已改正 | §4.7.1 · §8 的测试一节 · §11 第四轮 ① |
| 2026-08-31 | **`preSetup` 要建，即使只 log 一下也要有** ⇒ 启动保持四阶段 | §4.5 |
| 2026-08-31 | **删除 `AppModuleMiddlewareDescriptor`**（含 `priority` 与 `AppModule.middlewares`） | §6 第三组 |
| 2026-08-31 | **删除四个 catalog 类型**（`ErrorCatalogEntry` · `ResolvedErrorView` · `ParameterCatalogEntry` · `ResolvedParameter`）⇒ 连同第三组，contracts 导出数 **74 → 69** | §6 第四组 |
| 2026-08-31 | **本批切成两个冻结单元**：A 运行时骨架 / B 请求台账，A 收口后再冻结 B | §0-A |
| 2026-08-31 | **`instanceMode` 默认 `MASTER`；用户可手动发命令设成 `SLAVE`；且这个要作为 state 存储在本地** ⇒ 角色 slice `persistIntent:'owner-only'` + `flushMode:'immediate'` + **`syncIntent:'isolated'`** | §4.8a ①③④ |
| 2026-08-31 | **用户发 command，执行 command 的 actor 可以判断之后再发 command** ⇒ 切换是两跳：`display-context` 的 `public` 命令做准入 → runtime 的 `internal` 命令写角色（继承 requestId，照常进台账） | §4.8a ② |
| 2026-08-31 | **主屏操作要在副屏弹提示时，主屏的 actor 要明确发一个副屏的 command** ⇒ `routeContext` 默认继承、显式传则整体替换；`ActorDispatchOptions.routeContext` **必须实现**；台账的 route **记两级** | §2.3 要求二 · §4.7.2 ⑥ |

**方法上的两条长期约束**（Dexter 多次强调）：

- **不得用「零生产调用」否定 POC 的能力**。POC 每写一个东西都有产品用意，可能实现得不好。
  本文在前三个包上违反过三次，其中 `latest-wins`（§7）与 `displayMode` 轴（§2.3 要求一）
  两次结论错误 —— 两处欠账都由此而来。
  第三次是 `platform-ports` 的 `localWebServer`：**结论对但方法错**。
  正确依据是 POC 自己的实施计划
  `docs/superpowers/plans/2026-04-16-android-assembly-v2-implementation.md` ——
  「the old `LocalWebServer` is **replaced by** a native `topologyHost`」、
  「Step 2: Replace `LocalWebServerTurboModule` with `TopologyHostTurboModule`」，
  即它是**被有意取代的旧能力**、TS 端口是残留；而当时用的是消费者计数。
  ⚠️ 登记这一条是因为它是三处里唯一蒙对的：若当时 `topologyHost` 不存在，
  同样的方法会得出同样的结论，**而那就错了**。
- **POC 的注释可能与它自己所注释的函数不符**（§3.3 的启动顺序、§3.4④ 的重入范围各一例）。
  判行为必须打开读写路径，不能信注释、字段名或契约声明。

---

## 11 · 评审历史（治理记录）

本文是**重写稿**。前身经过两轮 Codex 独立评审与一次 Dexter 发起的 POC 对照，
知识已沉淀进正文；这里只保留治理事实，不再逐条列 finding。

| 轮次 | 结果 |
|---|---|
| ROUND 1（Codex，2026-09-01） | NO-GO，6M/2S。**七条成立、一条前提我曾驳回** |
| ROUND 2（Codex，2026-09-01） | NO-GO，6M/3S/1N。**十条全部 ACCEPTED，零驳回**；其中我在 ROUND 1 对 M-1 的前提驳回**被驳回且属实** —— owning source 是 `00-ter-build-order-claude.md`，而 `project-memory` 那条的 `sourceRefs` 明确指向它，我 grep 了压缩条目没命中就下了「查无此裁定」，**没跟着 sourceRefs 打开正文** |
| 收口 | 两轮共 12M/5S/1N **全部 ACCEPTED**，`ROUND_FINAL_DECISION=SELF_DECIDED`（两轮硬上限） |
| POC 对照（Dexter 发起，2026-08-31） | **不是评审轮。** Dexter 指出「你有很多问题，或者你的设计，都是因为没有仔细读 POC，就自己臆造了」⇒ 拆四块、四个独立子 agent 穷举 POC 既有实现后逐块判定 |

🔴 **2026-08-31 的对照推翻了收口后的两处结论，Codex 复审时请注意**：

1. **「建中间件链、不建具体中间件」被我自己撤回** —— 现在是**不建链**（§5 第一行）。
   ROUND 1/2 里关于中间件 `priority` 排序语义的未决项随之作废。
2. **「台账记录不含 `routeContext`」被修正为「存两个裸枚举字段」**（§4.7.2 ②⑥）——
   原处置来自 ROUND 1 的 S-2，方向对但过头了，它会让 T3 无法成立。

### 第九轮 · 三次冻结验收（2026-08-31）

⚠️ **本轮没有 hash 冻结基线**：第八轮的修法是直接改在工作副本上的，
改完没有另存一份带 hash 的快照 —— 所以这里**不写冻结 sha256**，不编一个数字充数。
本轮由我自己按第八轮承诺的一道额外纪律扫：
**每删一条旧规则，单独 grep 一遍旧结论句是否还活着** ——
第七、八两轮连着两次只做了「写新的」没做「删旧的」。

🔴 **这道纪律当场抓到四条**，它们全是「同一段里，新结论上面十几行还立着被撤回的旧结论」：

| 位置 | 旧结论还活着 | 后果 |
|---|---|---|
| §4.7.6 第 3 条 | 「且超时效的镜像观察不参与判定」立在它**自己第 3b 条的撤回**上方 18 行 | 实施者按顺序读，先落地被撤回的那条 |
| §4.2 | 「runtime 不把 `routeContext` 交给任何跨线结构」与 §4.2c ① 的网关 `options` **含 `routeContext`** 正面对撞 | 照做即删掉网关 options 里的 `routeContext` ⇒ §2.3 要求二/四（T3 副屏提示）当场失效 |
| §4.3 | 「缺省时用 `createNodeId` 生成一个」与**同一句**的「跨机身份不是 runtime 能自己决定的」自相矛盾 | 每次启动换新 `localNodeId` ⇒ 对端认不出本机 |
| §8 交付物 | 「POC 基线减五处例外」重复了第八轮已更正的错减法 | 与 §4.3 的 5/3 直接不一致 |

🔴 **另有四处 Markdown 结构破损，其中两处会在渲染后静默吞掉内容** ——
这类缺陷 grep 抓不到（源文本全在），只有把文档当**渲染产物**看才发现：

| 位置 | 破损 | 渲染后 |
|---|---|---|
| §6 第四组落点表 | 第 7 行后夹了一个空行 | **第 8、9 行（两条 `README.md` 落点）整个消失** —— 而它们正是 `TR-10` 判 finding 的那两条 |
| §8 门表 | 「runtime 公开导出精确集合」一行被折成两行 | **反例栏脱落** |
| §4.2 | 「两条比 POC 严」的第 2 条被十几行段落与空行隔开 | 渲染成两个不相干的列表，「两条」只剩一条 |
| §8 测试 | 网关三态的两行注释顶格 | 从列表项里掉出来，读成对整节的注释 |

🔴 **一条实证落点被我少算了。**
A-5 原写「`verify.test.mjs` 夹具两段」。实际是**六个** `expectedTaskOwners('test', 2)` 调用点，
且 `assertPackageTestMarkers` 的**第一道检查**就是 `markers.length !== expected.length`
（排在所有 per-package 断言之前）⇒ runtime 一进 `terminalTestOwners`，
夹具**五断一存**（逐块点过，表见 A-5）。
同时「把硬编码的 `3` 改成随集合推导」**推不出来** —— `terminalTestOwners` 是平表，
不编码「哪几个包有真实测试」⇒ 必须另建一个 `terminalRealTestOwners`。
⇒ 落点从「第 17–19 处」更正为「**第 17–24 处**」。
⚠️ **这条更正我自己先写过头了一次**：初稿写「四个 `assert.throws` 块会全部变红」——
逐块点过之后是**五断一存**（`:50-56` 期望的就是 `marker count mismatch`，1 ≠ 9 照样命中），
且 `:83-96` 断的是**另一条错误路径**（9 = 9 不再 count mismatch，改抛 package mismatch）。
**「范围比想的大」是对的，「全都断」是错的**，A-5 已按逐块结果重写。

🔴 **两处判据本身是错的，不是漏写。**

1. A 评审清单第 1 条原写「`ActorExecutionRecord` 构造点计数 = 1」——
   **A 期至少有三条合法构造路径**（正常 actor 完成 · ⑤b 的网关记录 ·
   §4.2c ③ 未安装网关那条 `error`），照此判必然误判。
   ⇒ 改为「`src/` 内只有**一个构造它们的函数**，三条路径都经它」，
   并补上 `CommandExecutionObservation` —— 后者是 §0-A 那个 B→A 触点
   「只改一处赋值」成立的前提，原清单整个漏了。
2. 两条「能区分新旧聚合规则」的判别用例**没有写前置条件**。
   rule 0 排在最前，`completedAt === null` 时两条一起退化成 `running` ⇒ **判别力归零**，
   而这两条正是拦住「照抄 POC 只补 rule 0」的唯一防线。

**另外补齐的空白**：§4.7.2 的七条里**①②③④⑤ 五条在 §0-A 的归属表上悬空**
（详设作者会按「章节号属 B」整体推到 B，而 ②③ 恰是 A 期就要定死的字段约束）·
第二级 rule 4 **一条用例都没有**（写成「有失败即 error」，除该例外全部用例仍绿）·
「禁止裸名含 `.`」正文有、**交付物/门/测试三处零落点** ·
journal 承接的类别数少算一类（§4.6 洞③）·
空集在第一级同时满足 rule 1/2/**3**、第二级同时满足 rule 1/**4**/6，
原文只列了前两条，**「全靠顺序消解」这个提醒因此不完整**。

🔴 **一处主动登记为可能的过度设计**：保留 `actorKey` 名单。
`actorKey` 由 `${moduleName}.${actorName}` 派生，业务模块的 `moduleName` 不会是
`kernel.base.runtime` ⇒ **业务模块在结构上就撞不到那两个名字**，这道检查几乎不可能触发。
保留它的唯一理由是复用**已经存在**的那张表（零成本），
并已写明：**不得为它新建独立表或独立门**；若详设发现内部记录不走注册表，**整条删掉**。

**本轮不产生新的对抗轮次**（两轮硬上限已在收口时用完，见上表）——
这是作者按 Dexter「改完你再 review，不要带病交给 codex」做的自查，
findings 归作者自己，不冒充独立盲审。

🔴 **本轮修完后的冻结基线**：`sha256 2ac28865…`

⚠️ **这个数字是自指的，复核步骤必须写明，否则直接 `shasum` 必然对不上**：
① 取全文；② 把**上面那一行**里的 8 位十六进制换成 8 个下划线
（即 `` `sha256 ________…` ``，全文第一处 `sha256 <8位>…` 就是它）；
③ 对改完的内容取 sha256，前 8 位即上面那个值。
**交给 Codex 的就是这一版。**

⚠️ `SUPERSEDED_BY_DEXTER_2026_09_01_SELECTOR_SINGLE_SIDE`：上述 hash 仍只是当时第七轮的历史冻结记录；
Dexter 后续直接补充了「selector 只读到一边 request 状态时，只按该边计算返回」，
当前实施输入已以 §4.7.5 与 §10 的新裁定为准。不得再用 `2ac28865…` 声称匹配当前文档字节。

### 第八轮 · 二次冻结验收（2026-08-31）

冻结基线 `sha256 e8c501a6…`，三路各自先核 hash。三路：修法验算 · 无前情实施者读单元 A · 全文终扫。

✅ **第七轮最重的那条修法（两级聚合去掉 rule 2）经 21 组输入逐一手算，全部通过** ——
无落空、无歧义、两级语义一致、⑤b 的规则号已跟。**设计文本对、传导干净。**
✅ **实施者路首次给出「单元 A 可以开工」**（带三条须先处理的偏差）。

🔴 **但第七轮的另一条修法方向就是错的。**
「超时效的镜像观察不参与判定」——「超时效」读的是镜像信封，而那是**对端时钟**。
用对端时钟做**存活性**判定同时产生三种错：
一条 `timeoutMs` 大于淘汰窗口的 peer 命令会让**在途 request 被提前删掉**（不需要任何时钟偏差）·
对端慢 ⇒ 新鲜镜像记录落地即「超时效」· 对端快 ⇒ 迟迟不超时效，洞根本没关上。
⇒ 改为 **§4.7.6 第 3b 条：只读本机时钟的「最长驻留上限」** ——
不破 §4.7.7 ③ 的不变量、不新增聚合调用点、不误删在途请求。

🔴 **一条理由被抓出来 —— 但我这次的更正也过头了。**
§4.3 与 §8 门表原写「精确集给不出来，**因为 POC 不在本仓、取不到基线**」。
**「取不到」是假的**（POC 在同级仓 `/Volumes/idea/newPOSv1`，本文引过它的行号）；
但**「不在本仓」是真的** —— 而我当时把整句判为编造，理由是「引用过就说明在本仓」，
**那个推理不成立**（引用带行号与文件不在本仓完全相容）。
更糟的是我更正后写的替换文本**自己错了两个数**（21 vs 实际 19、「各减五处」vs 实际 5/3），
第九轮被逐名点数抓出来。⇒ 现已在 §4.3 直接给出两份逐名精确集（模块 9 项 · actor 11 项）。

🔴 **最该记的一条**：改了最重的规则，却**没有留下能证伪它的判据**。
§8 全节只出现过一次 `partial-failed`，而新旧规则的差集恰好只在
「同时含成功与超时」「同时含 error 与 timed-out」两类输入上，这两类在 §8 一次都没出现
⇒ **一个照抄 POC「任一 TIMEOUT → TIMEOUT」、只补 rule 0 的实现能全绿通过。**
已在两级各补两条能区分新旧的用例。

**其余处置**：时钟偏差方向在 §4.7.7 ③ 写反（对端快 ⇒ `updatedAt` 落在未来 ⇒ **不会**超时效）·
契约二（原契约三）在 §8 A-1 无条目 ⇒ 补条目并**新增「单元 A 的评审清单」**四条 ·
契约二（状态迁移点）要收敛的是**记录的构造与推进**不只是 journal
（只收敛后者，B 期会第二次构造记录）·
`displayMode` 是第四个跨单元触点、已登记 · ⑤ 的「真正不同的只有…」漏了 `displayMode` ·
§4.7.6 的 `rootCommandId` 指代漂移（按两跳链，根是第一跳那条 `public`，不是 `set-instance-mode`）·
`timeoutMs` 从「随 limits 给缺省」改为**命令定义自己的字段 + 构造期校验**（limits 五→六项，
新增最长驻留上限）· 门面 `dispatchCommand` 的**按名派发**入参形状 · owning module 的
**最长前缀匹配**算法 · actor 声明形态 · `runtimeId`/`localNodeId` 来源 ·
§7 欠账补「角色切换留痕重启后不存在」· 契约编号乱序（一→三→二）已理顺 · 十余处计数与行号。

### 第七轮 · 冻结验收（2026-08-31）

前六轮都是**边审边改**；本轮第一次**先冻结再审**（`sha256 b5ddfee2…`，三路各自先核 hash）。
三路：M/S 闭环验收 · 无前情实施者只读单元 A · 全文终扫。合计约 36 条。

🔴 **两路独立撞上同一条最重的**：两级聚合的 rule 2「任一 timed-out ⇒ timed-out」
把 `partial-failed` 在文档自己指定的路径上吃掉了 ——
§4.7.4 的旗舰例子（主体 `completed` + 跨机核销 `timed-out`）会被算成 `timed-out`，
而 §4.3 的裁定说 `timed-out` **就是一种 error** ⇒ 正是 §4.7.4 明令不得发生的「压成 error」。
⇒ 改为 **`timed-out` 与 `error` 同级参与混合判定，仅全部超时才收敛为 `timed-out`**。
⚠️ **这是「照抄一份规则、没重推前置条件」的第二次发生**（第一次是缺 `running` 分支）。

**其余三条设计层**：镜像半僵死的 `running` 经合并判据把本机半也永久钉死（改：超时效的镜像观察
不参与判定）· 「同形返回就没有映射」被自己的类型定义推翻（`CommandDispatchResult.status` 五值 →
`ActorExecutionRecord.status` 四值，改：明写 `partial-failed → error` 的有损映射）·
**第三条跨单元硬契约**（单一状态迁移点：journal 在 A、台账在 B，A 期不收敛 B 就要回改 A）。

**十余条 S**：§4.7.7 ① 的层级 · §4.8a ② 与 §4.7.6 第 4 条对「切换后台账剩什么」结论相反 ·
②a 的「写入点只有一个」为假且拿假绿门当理由 · §4.7.1 缺指向具名例外的指针 ·
journal「记全」vs 1000 条 FIFO · §4.2b 的环路保证被超时弹帧推翻 ·
§0-A 正本表漏三节错一节 · §8 把别的包的命令列进本批 ·
`displayMode` 在 A 期无来源（改：恒 `null`，已登记为 B→A 触点）· 命令名门禁到「挂载」还是
「挂载/派发」（裁：**只禁挂载**）· `commandDefinitions` 是 POC 字段名（TER 是 `AppModule.commands`）·
`TR-04` 门凑不齐正反双断言（改：只建正向、反例栏写明另一半待 B）· §4.6 洞③给了依据。

🔴 **三路共同的判词值得记下**：事实层极干净（约 40 处 `file:line` 逐个打开，
行号与内容**无一处错**；被删除物**零残留**；交叉引用**零悬空**；40 处计数 37 处相符），
**问题全在「改完没回头扫谁引用了这句话」** ——
17 条里没有一条是作者不知道的事，`ActorExecutionRecord.status` 与 `CommandAggregateStatus`
就写在相隔 290 行的两个代码块里。
⇒ **本轮的处置纪律**：每条 finding 落地前先扫一遍「还有谁引用了这句话」，
连同受影响处一起改，再动下一条。

### 第六轮 · 修法验收（2026-08-31）

第五轮的修订之后再发两路：**逐条验收 30 项修法** + **一个没读过前情的实施者只读单元 A**。
两路都 `NO-GO`。

🔴 **本轮最该记住的不是缺陷本身，是缺陷的形状：修法的传导率不到 100%，
而且是在文件没有冻结的情况下边审边改的。** 验收路在它自己那一轮里看着文件从
2247 → 2321 → 2341 行，它今天读到的三条新缺陷就是那次编辑造出来的。

🔴 **一条必须单独点名的错误**：§4.7.6 第 4 条写了
「（§4.8a ② 的措辞已按此对齐）」，**而 §4.8a ② 一个字都没改**。
**在没改的情况下写下「已对齐」，比没改更糟** —— 它会让下一个 reviewer 跳过这一处。
这正是仓内纪律里「声称 ≠ 行为」的形态，登记在此以免重犯。

**六条 M 的处置**：
· §4.8a ② 真正改成「留痕靠 journal 不靠台账」；
· §4.7.4 的旗舰例子跟到 ⑤b（发起侧观察**不是空的**，里面有网关那条 `running` 记录）；
· §4.2b ② 的「随即终态化」推导**撤回** —— 第二级 rule 0 会先命中，
  它保证的是**有界**不是**终态**；被拒的派发**只写一条**，否则保险自己无界；
· 命令数上限改判 B 之后，§8 A-1、§8【A】测试、§4.4b 三处跟上；
· §4.7.7 ③ 的「一律只读本机那一份」为**视图**摘出例外，指向 §4.7.5 的降级规则；
· 角色翻转的两个后果写明并接受（翻转后「本机那一份」装的是对端时钟；切换命令自己留下半条记录）。

**S 的处置**：`timeSource` 进类型块 · 网关接口给全（连同「`CommandIntent` 是 POC 类型名、
TER 不存在」这个事实）· ⑤b 的 `result` 恒为 `null`（不复活无类型 blob，顺带消掉
「对端成功但结果太大反被判 error」这个反噬）· 「在途 ⇒ running」在 A 期不可观测 ⇒ 归 B ·
`defineCommand` 自动前缀与 AST 门互斥 ⇒ 门改成「不得导出以字符串为命令名的挂载 API」·
🔴 **台账的写入者第一次被指名**：分发器本身，理由是
「产生这些事实的就是它」+「`TR-01` 的门已经把本包整个白名单化，
而那条白名单存在的原因正是如此」，同时钉了三条边界防止白名单变后门。

**十二条 N**：计数（四处例外→五处、五处「取自参数」→四处）· 失效指针（`§8 第 5b/6 项`）·
行号（`verify.mjs:97→:98`、`contracts.test.ts:136-148→136-147`）·
§0-A 内两套 A/B 划分并存 ⇒ 明确「上表是唯一正本」· 三个保留 `actorKey` 的重名规则 · 等。

### 第五轮 · 四路内部一致性盲审（2026-08-31）

在第四轮的修订**之后**再发四路，镜头换成**纯内部一致性**（不再核 POC）：
规则对撞 · 裁定↔正文 · 类型与契约 · 实施者视角。**四路合计约 54 条。**

🔴 **一个真设计洞**：`target:'peer'` 的命令在发起侧 `actorResults` 恒空，
而观察层没有 status 字段 ⇒ 第一级聚合只剩「空集」分支，
**超时永远推不出 `timed-out`、对端成功反而被判 `error`**，正打在 §4.7.4 的旗舰例子上。
⇒ 补 §4.7.2 ⑤b（网关的执行记录），零新字段。

**五条规则对撞**：automation 与门面（第 3 条 vs 第 5 条）· 角色生效点清空 vs 单写者不变量
vs 切换留痕 · 终态判定的输入集（合并 vs 本机那份）· 命令数超限「判为 error」无处可写 ·
「时间戳一律取本机那份」vs「只有一侧有记录」。

**四条经亲验的事实错**：`state` 里没有 `resolveWorkspace`（实为不在公开面上的
`requireWorkspaceRouteContext`）· 援引 `source imports` 门挡 contracts 依赖是错的
（那门只扫 `src/`，真正会拦的是 `dependencies` 精确集门）· `terminal-coding-standard.md:65`
应为 `:64` · `result: StateJsonValue | null` 的 `| null` 是空操作。

**切分未传导**：`owner` 身份两说 · §2.3 要求二/四 被同时判给 A 和 B ·
`aggregateCommandStatus` 的入参类型落在另一个单元 · 第二条跨单元硬契约（B 要回改 A）·
§8 第 5/6 项的 A/B 分配 · 一条 A 依赖 B。
⇒ 原「角色与 route 的承载」一节拆成 §4.8a / §4.8b、§8 整节按单元重写、§0-A 的硬契约改成两条。

**十五条空洞**：`peerDispatchGateway` 全文无定义却分给 A · 五个「取自参数」无出处 ·
重入命中后行为未定义 · A 期 `dispatchCommand` 返回什么 · journal 上限 · `sessionId` 从哪来 ·
启动「详设二选一」没给依据 · shutdown 与订阅持有藏在 §3 · README 要求太薄 ·
三条门反例栏为空 · 类型夹具既列门又列测试 · 「`public` 缺 requestId 即拒」移出门后无人接住 ·
`rootCommandId` 乱序用例在字段删除后不可能红 · 「六种组合」里两种不是合并组合 ·
「重复 slice 名」已由 `state` 兜住。**逐条已补或已改。**

🔴 **一条归属错误已改正**：早先把「两侧性在本批就能真实验证」连同
「台账建到完整程度」一起冠在 Dexter 裁定名下 —— **后半句是作者驳回盲审时的推导**，
已在 §10 拆开重标。

### 第四轮 · 四路独立对抗盲审（2026-08-31）

四个 fresh 子 agent 分四路盲审（三形态与 route · 台账与 selector · 契约与门 · 方案合理性），
每路先读冻结输入独立推导、再打开本文攻击。**四路全部 `NO-GO`**，合计 17M/23S/16N。
**六处跨路撞车**（不同 agent 独立命中同一缺陷）—— 那是最强信号。

🔴 **本轮改掉的、属于作者自造的缺陷**（不是 POC 判读错，是设计本身错）：

| 缺陷 | 后果 |
|---|---|
| **两级聚合规则没有 `running` 分支** | POC 的 `aggregateStatus` 只在命令**结束后**调用一次，我把调用点改成「每次读都算」却逐行照抄了那份规则 ⇒ 正在跑的命令算 `completed`、`{error, running}` 的请求算 `error` = 终态 ⇒ **淘汰会删掉仍在执行的请求**。而且它打在 §4.7.4 我自己的旗舰例子上 |
| **`commandDefinitions` 权威化未说明查谁的清单** | 若读成「actor 自己模块的」，会**禁掉 100% 跨模块订阅** —— 而那正是我判定「广播模型赢了」的全部理由。POC 实证：`resetTcpControl` 8 个 handler 7 个在别的包 |
| **「automation 只能发 public」与 `TR-01` 立规理由②冲突** | 理由②原文「automation 的 `command.dispatch` 成为完备驱动面、不需要后门」，而 `set-instance-mode` 与淘汰命令都是 internal |
| **`LedgerRoute` 与收窄后的 `CommandRouteContext` 结构全同** | 「台账不含原始对象」变成只能靠标识符匹配的伪 checker ⇒ 整个类型删除，改存两个裸枚举字段 |
| **第一层的两侧性没处理** | 副机那份台账里 `rootCommandId`/`originNodeId`/`startedAt` 无值可填（命令全是子命令）⇒ 前两个删除、第三个改语义 |
| **可选属性 `?` 会把 `undefined` 带进隐式索引签名** | 我只解决了 `interface` 无隐式索引签名，没解决这个 ⇒ 四个记录类型全改 `\| null` |
| **淘汰与单写者粒度不一致 · 镜像半无淘汰者 · 角色翻转后旧半边永久驻留** | 三条合起来让你「半小时后都会清理掉」的裁定在我自己的规则下变假 ⇒ 淘汰只作用本机那份 + 角色生效点清空旧那份 |
| **「写入时顺带在 reducer 里清理」结构上不可实现** | `combineReducers` 只把本 slice 交给本 slice 的 reducer，看不到另一份 ⇒ 该支删除 |
| **跨设备时钟一个字没提** | 淘汰/排序/`updatedAt` 三处都在比两台机器的 `Date.now()` ⇒ 一律只读本机那份 |
| **reset 两段式三个洞** | internal 无 requestId 却按 requestId 登记 pending · 两次请求后写覆盖先写 · reset 重播 `initialize` 后可无限重置 |
| **闭合联合门钉不住可选属性** | `runClosedLiteralUnions` 要求每个成员是 `StringLiteral`，可选属性带 `undefined` ⇒ 照做即门红。必须**先改门实现**再加钉子 |
| **`platform-ports` 的夹具会断** | 我把零回归范围限定在「contracts 自己」，漏了唯一会红的那个包 |
| **`displayContext` 被原样继承** | 它是 per-runtime 单值屏身份，与 `displayMode` 是同一个病的另一条腿 ⇒ 进不继承表 |
| **`⑤` 的六个理由里三个被我自己的 §4.2 消解** | `allowNoActor`/`commandName`/`parentCommandId` 两侧必然相同 ⇒ 论证重写 |
| **几处理由蒙对但写错** | `§4.2` 第 1 条（不是「追溯性断掉」，是「UI 要先持有 requestId 才能订阅」）· `TR-05` 引用越界（规则域只有 platform-ports 与 contracts）· 「闭合枚举 = wire-safe」（POC 入站是裸 `as`） |

🔴 **被我驳回的两条**（带证据）：
① 「本批 SLAVE 那份恒空、双观察永不发生、测试只能造假数据」——
**不成立**：本批自己就有测试模块、`set-instance-mode`、`peerDispatchGateway` 插槽与
`state` 的同步 API，足以做真实端到端验证（§4.7.1 表）；
② 「跨机冲突应以执行侧为准」—— **Dexter 裁定相反**：超时失败，只以本机信息为准。

**同一轮还补进了四样 POC 已有而我漏掉的东西**：runtime 自己的内部模块（§4.1）·
`preSetup` 的真实调用点与用途（§3.3、§4.5）· 角色切换后出站基线不重置（§3.7）·
同步应用侧不校验方向（§4.7.7 ⑤）。
**以及两处我自己的缺陷**：`rootCommandId` 照抄了 POC 名不副实的语义（§4.7.2 ⑦）·
台账写入若抛错会 reject 整个分发（§4.3）。
