# TER `kernel.base.runtime` 单元 B 实施结果 · 独立 IMPLEMENTATION review

| 字段 | 值 |
|---|---|
| REVIEW_TARGET | `IMPLEMENTATION` · ROUND 1/2 |
| REVIEW_CYCLE_ID | `TER_KERNEL_BASE_RUNTIME_UNIT_B_IMPLEMENTATION_2026_09_01` |
| **VERDICT** | **NO-GO** |
| **M / S / N** | **1 / 1 / 2** |
| 是否阻断 | M-1 阻断收口，但**不需要重新设计** —— 修复面是「每-actor 路径内加一层 catch + 改一条测试断言」 |
| 方法 | **纯静态逐行**。**本轮未运行任何命令**；prompt 里的新鲜输出**未被我复核**，全部列为动态证据待验 |
| 采信边界 | 未采信实施记录、HANDOFF、对账结论或既有 verdict；全部重开源码 |

---

## 0 · 证据分档（先声明，避免把未验证写成已证明）

| 档位 | 本轮取得 |
|---|---|
| **仓内源码事实**（我逐文件打开） | 下列全部核验项 |
| **动态输出** | **无**。typecheck / 73 tests / 5 gates / `TERMINAL_STATIC=PASS` / `TERMINAL_VERIFY=PASS` / Metro 710 modules **一概未由我复跑**，属 `UNVERIFIED_BY_THIS_REVIEW` |
| **推论** | M-1 的传播链、S-1 的可观测差异、state 未被越界修改的判断 |
| **不得升格** | 静态阅读**不**证明 state 跨包 sync direction、native、Gradle、autolinking、设备、跨重启 |

---

## 1 · 逐项核验（评审 prompt 的六个重点）

### 1 · 公开面、契约、graph、依赖 —— **全部属实**

| 项 | 复算结果 |
|---|---|
| runtime `src/index.ts` | **63**，唯一 63 |
| `tools/terminal-runtime/check-static.mjs` 的 `expectedPublicExports` | **63**，与源码同步 |
| contracts 门 `expectedPublicExports` | **69** |
| `apps/terminal/skeleton-graph.ts:22-26` | runtime 条目**已无 `plannedKind`**，依赖边未变 |
| 依赖越界 | `package.json` deps 恰为 contracts/platform-ports/state；`src/` 外部 import **只有这三个**（20/8/20 处）；**零 RTK** |
| 反向依赖 | `state/src` 内 `kernel-base-runtime` **零命中** |

### 2 · 两个 ledger slice 与 selector —— **成立**

- `features/slices/requestLedger.ts:131-145`：两片 `persistIntent:'never'`、
  `master-to-slave` / `slave-to-master` ✅；reducer 第 92 行按 `payload.sliceName` 判别，
  **MASTER 的 action 打不到 SLAVE 片** ✅。
- `readLiveRequestEnvelope`（`:76-83`）是**包内唯一** tombstone 收窄点，
  selector 与 cleanup actor 都复用它（`selectRequestExecutionView.ts:206,210`；
  `cleanupRequestLedgerActor.ts:41`）✅ —— 与详设「有且只有一处」一致，没有两处各自解释 discriminant。
- **Dexter 单边裁定的四态，逐分支核过**（`selectRequestExecutionView.ts:119-164`）：
  两侧皆无 → `null`（`:125`）✅；local-only → `chosenRecord=localRecord`、`timeSource:'local'` ✅；
  peer-only → `chosenRecord=peerRecord`、`timeSource:'peer'`（`:148,161`）✅；
  双侧 → `commandKeys` 并集 + `preferred = local ?? peer`、
  `status: aggregateCommandStatus(preferred)`（`:86,102`）⇒ **同 commandId 本机优先**，
  peer observation 仍保留在 `observations` 供诊断 ✅。
  **缺失侧不被解读为「仍在等待」**：没有任何分支因另一侧缺失而注入 `running`/`started` ✅。
- **WeakMap 分片**（`:33-36,166-199`）：`NO_LOCAL_ENVELOPE` / `NO_PEER_ENVELOPE` 两个冻结单例，
  三层键 = local envelope → peer envelope → mode ✅。
  🔴 **裁定第三条排除（不得带回已删除侧旧事实）在结构上成立**：本机 half 被淘汰后
  第一层键从旧 envelope 对象变为 `NO_LOCAL_ENVELOPE`，**走的是另一条 cache 路径**，旧的双侧 view 取不回来。
- `aggregateRequestStatus.ts:4-19`：我把七条规则逐条代入穷举
  （全 completed / 全 timed-out / 全 error / error+timed-out / completed+失败 / 含 running / 空集），
  **七条结论与冻结规则逐条一致** ✅。第 16 行 `every(=== 'timed-out')` 在该位置
  与「全部失败且全部超时」**等价**（此前分支已排除 running、空集、partial-failed、混合成功失败）。

### 3 · 单一事实产生点、ledger 失败、budget —— **两项成立，一项不成立**

- **单一事实产生点** ✅：`createCommandExecutionObservation` 全 `src` **只有一个定义**
  （`createLifecycleEmitter.ts:121`），调用点三处均在同一文件（`:325 :430 :477`），
  **无第二个 observation factory**。
- **`displayMode` 单点赋值** ✅：全 `src` 只有 `createLifecycleEmitter.ts:134`
  `context.routeContext?.displayMode ?? null` 一处赋值；selector `:100` 只是读取。
  **登记的 B→A 触点改动面就是这一行**。
- **ledger 写入位置** ✅：写入在 `dispatchInternal` 的 `finally` 释放之前，
  复用 A accumulator 的同一份 observation（`createCommandDispatcher.ts:187-199`），
  `updatedAt` 只取 `transition.completedAt` 或 `nowTimestampMs()`（`:200-202`）⇒ **只用本机时钟** ✅。
- ❌ **ledger 写入失败的收敛方式不成立** —— 见 **M-1**。
- **budget** ✅：`:405-431`。位置在 `try` 内、`command.started` 之前、压栈之前；
  计数取 `selectRequestExecutionView(...).commands.length`（`:406`）即**合并 selector**；
  **全文无独立计数表**（`new Map` 只有 `commandChains`/`pendingResetByRoot`/`activeRoleContexts` 三个 A 期结构）；
  首次超限走完整 transition 序列后 `throw budgetError`（**typed reject**），
  后续由 `hasBudgetObservation`（`:353-354`，**搜整个合并 request 的错误 key，不看最后一条**）拦成零写 ✅。

### 4 · cleanup / 淘汰 / 角色翻转 / timer —— **成立**

- `cleanupRequestLedgerActor.ts:30-53`：只取 `requestLedgerSliceNameForMode(mode)` 即**本机写权那半** ✅；
  `terminalByMergedView` 用 **merged** `selectRequestExecutionView`（`:44-45`）✅ 与需求「判据用合并结果、对象只限本机那份」一致；
  retention 仅在终态时生效（`:46`）、residence **无条件**（`:47`）✅；
  只读本机 envelope 的 `updatedAt`（`:43`）⇒ **不读对端时钟** ✅；
  删除经 actor `dispatchAction`（`:52`）⇒ **不裸 dispatch、不在 reducer 顺手清** ✅；
  只含镜像半的 request 不在 `typedState` 里 ⇒ **本机不越权删** ✅。
- `createRequestLedgerRoleEffect.ts:8-15`：清 `previousMode` 那半 ✅；
  `createRuntime.ts:212-214` 把它 **append 在全部外部 effect 之后**，不依赖 module 拓扑序 ✅；
  A 的角色 actor 先跑 effects 再写字段，且 effect 抛错则字段不写 ⇒ **失败保护成立** ✅。
- timer：`createRuntime.ts:251-278`，周期 `requestRetentionMs`，
  `cleanupInFlight` 与 `status !== 'started'` 双重跳过 ✅，
  **`resources.register(() => clearInterval(timer))`（`:277`）** ⇒ 由 `releaseRuntimeForTest` 释放 ✅。
- 非持久化：两片 `persistIntent:'never'` ✅。**跨重启行为本轮未动态验证**（见 §0）。

### 5 · 测试是否真证伪 / 是否存在「全绿但未建成」

- **数目属实**：`test/*.test.ts` **13 个文件**、`it(`/`test(` 合计 **73 条**（我实算，未采信声明）。
- **不是存在性断言**：`requestLedgerLifecycle.test.ts` 用真实 runtime 派发并读 selector；
  budget 用例从**预置已达上限的 ledger** 起步（正是详设用来打红「独立 count Map」的那条路径）；
  cleanup 用假时钟；peer 用两个 runtime + 内存 gateway + 真实 full-sync 接缝。
- **静态门**：`RUNTIME_RULE_NAMES` **五道** + 1 support（`check-static.mjs:12-19`）；
  `check-static.test.mjs` 的 `assertVector`（`:24-31`）断言**只有目标门 FAIL、其余仍 PASS**，
  六个定向变异分别命中 context / mount×3 / owner / restart / ledger-record-shape ✅ **红夹具形态正确**。
- **「全部门通过但 Unit B 未建成」的路径：不存在。** 台账、selector、淘汰、角色清账都由真实运行路径覆盖。
- ⚠️ **但存在一条更危险的变体：「全部门通过而行为偏离冻结规格，且被测试锁死」** —— 见 M-1。
  另有一处规格禁令**无任何用例触及** —— 见 S-1。

### 6 · 未升格边界 —— **HANDOFF 表述诚实** ✅

`HANDOFF.md:475` 与 `:492-493` 明写 `state.applyAuthoritativeSync` 的 sync direction 仍为
`UNVERIFIED_REQUIRES_EVIDENCE`，且「TER-local 绿灯不升级为跨包同步、native、设备或跨重启证明」；
`:233 :237 :478` 登记角色留痕与 ledger 均不跨重启。**没有过度承诺。**

**state 生产源码是否被越界修改** —— 我查了 `git status`：`state/src/index.ts` 显示为已修改，
但其 diff 是**把整包公开面从骨架两行补齐**（+75 行导出），而 `state/src/foundations|supports|types`
三个目录整体处于 **untracked** 状态。⇒ **推论**：这是 `kernel.base.state` 自身交付批次留下的未提交工作，
**不是 Unit B 的改动**；`supports/sync.ts` 的方向校验缺口仍原样存在，与 HANDOFF 的登记一致。
⚠️ 这是**推论**，不是直接观测 —— 工作树无 B 之前的基线可比，我无法从 diff 本身证明「B 没碰过」。

---

## 2 · findings

### M-1 · 台账写入失败会抛到分发边界，整条 `dispatchCommand` reject —— 需求 §4.3 明令禁止的那个形状

**位置**：
`apps/terminal/kernel/base/runtime/src/foundations/createCommandDispatcher.ts:255-264`（`emit` 抛出）·
`:665-695`（`finish` 调用 `emit`）· `:711-716`（`try/finally`，**无 catch**）·
`:728`（`dispatchPeer` 的裸 `emit`）·
`apps/terminal/kernel/base/runtime/test/requestLedgerLifecycle.test.ts:212-214`（测试锁死了错误行为）

**仓内事实**：
```
255  const emit = (transition, observer) => {
259    const result = emitter.emitLifecycle(transition, observer)
260    if (result.ledgerWriteFailed === true) {
261      throw ledgerWriteFailureError(transition.context, result.error)
262    }
```
而 `dispatchActor` 的正常路径是：
```
711  let record: ActorExecutionRecord | undefined
712  try {
713    record = finish(settled, false)     // finish 内部调 emit
714  } finally {
715    releaseExecutionStack()
716  }
```
**`try/finally`，没有 `catch`。** `dispatchInternal` 同样只有 `try/finally`（`:404`、`:432` 一带）。

**传播链（推论，但每一跳都可从源码读出）**：
`emit` throw → `finish` throw → 穿过 `:712-716` 的 finally → 逸出 `dispatchActor`
→ 逸出 `dispatchInternal` 的 `Promise.all` → 逸出 `dispatchInternal`
→ **`runtime.dispatchCommand(...)` 整体 reject**。

**与冻结规格冲突（两处，都是明令）**：
- 需求 §4.3 🔴 原文：「**台账写入不得抛出到分发边界。** POC 的 `Promise.all` map 回调
  **只有 `try/finally`、没有 `catch`** ⇒ 台账写入抛错会让整个 `dispatchLocal` reject。
  ⇒ **要求**：台账写入…必须在**每 actor 的路径内**完成、并**降级成该 actor 的 `error`**。」
  —— 实现**逐字复现了这条规则用来禁止的代码形状**。
- 详设 §4.9.2（第 244 行）：「若 ledger dispatch 失败，dispatcher 把该命令
  **收敛为 typed `error`**」。本仓对 `typed error` 与 `typed reject` 有**明确区分**
  （需求 §4.2b：① 深度超限 = typed error = 返回 `status:'error'`；② 命令数超限 = typed reject = 入口 reject）。
  ⇒ 详设要的是**返回** `status:'error'`，实现给的是 reject。

**可证伪的失败后果**：命令挂两个 actor，A 的台账写入失败、B 正常完成。
- 规格：A 记为 `error`，B 的 `completed` 与其 `result` 仍在
  `CommandDispatchResult.actorResults` 里返回，命令状态由聚合算出。
- 实现：**整条 `dispatchCommand` reject，B 的结果对调用方彻底丢失**。
`dispatchPeer:728` 的 `emit({kind:'actor.running'...})` 更在任何 try 之外，
那里失败连一条记录都不会产生。

**为什么没被拦住**：五道静态门（context / mount / owner / restart / ledger-record-shape）
都看不见运行期传播；而唯一相关的用例
`requestLedgerLifecycle.test.ts:212` 写的是
`await expect(...).rejects.toMatchObject({key:'kernel.base.runtime.ledger_write_failed'})`
—— **它断言的正是 reject**。用例标题「does not turn a ledger write failure into a completed command」
只证明了「不是 completed」，**没有证明规格要求的「降级成该 actor 的 error 并正常返回」**。
⇒ 这条偏离被测试锁死，后续任何按规格修复都会先把这条用例打红。

**最小修复**（不改设计、不动接点）：
① 在 `dispatchActor` 的每-actor 路径把 `finish` 包进 `try/catch`：
   捕获 `ledgerWriteFailureError` 后，构造该 actor 的 `error` 记录返回，不再上抛；
   `dispatchPeer` 的 `:728` 与 `:739` 同处理；
② 把 `requestLedgerLifecycle.test.ts:212-214` 改成断言
   `result.status !== 'completed'`、该 actor 记录为 `error` 且 `error.key` 为
   `ledger_write_failed`、**同命令其它 actor 的结果仍在 `actorResults` 里**、
   并保留「脱敏日志已产生」这条断言（`:215` 那条是对的，保留）。
③ `dispatchInternal` 层面 ledger 失败（budget 序列、depth 序列内的 `emit`）
   保持现状 reject 是可以的 —— 那两条本来就是入口拒绝路径。

**为什么更小的替代不足**：只改测试不行 —— 行为仍违反 §4.3；
只在 `dispatchInternal` 加 catch 也不行 —— 那会把「该 actor 失败」变成「整命令失败」，
丢掉同命令其它 actor 的事实，仍不满足「降级成**该 actor** 的 error」。

**证据档位**：仓内源码事实（传播链为推论，每一跳可读）。**未做动态验证。**
**是否需要 Dexter 裁决**：**否**。需求 §4.3 已裁定，详设 §4.9.2 同向。

---

### S-1 · `results` 只保留成功项，正是需求逐字禁止的三种取舍之一，且无任何用例触及

**位置**：`apps/terminal/kernel/base/runtime/src/selectors/selectRequestExecutionView.ts:65-71`

**仓内事实**：
```
67  ): readonly StateJsonValue[] => Object.freeze(observations.flatMap(observation =>
68    observation.actorResults
69      .filter(record => record.status === 'completed')
70      .map(record => record.result),
```
需求第 1815-1817 行：「`results` 与 `errors` 是「拍平的便利视图」…**不得在此处做任何取舍**
（不许只留最后一个、**只留成功的**、压成布尔）。这是 §4.7.3「写侧记全」的读侧对应：**读侧也要交全。**」
详设 §4.4 逐字重复；测试 `A-2` 的反断言写的是「只保留最后一个**或只保留成功项**失败」。

**可观测差异（我核过它的边界，不夸大）**：
失败 actor 的 `result` **恒为 `null`**（`createLifecycleEmitter.ts:364`
`transition.kind === 'actor.completed' ? transition.result : null`），
所以被过滤掉的条目**都是 `null`**，信息本身没有丢
（完整逐 actor 事实仍在 `observations[].actorResults`，失败原因仍在 `errors`）。
**真正的差异是元数（arity）**：actors `[A completed→X, B error→null, C completed→Y]`
⇒ 规格 `results = [X, null, Y]`（3 项，逐 actor 保序），实现 `results = [X, Y]`（2 项）。
⇒ 消费方按 `results.length` 理解「这条命令跑了几个 actor」会得到错的数，
与 `observations[].actorResults` 的下标对应也断了。

**为什么没被拦住**：现有断言只有
`requestLedgerLifecycle.test.ts:105`（只取 `results[0]`）、`:132` 与
`requestLedgerSelector.test.ts:124,153`（均为**单 actor** 命令）。
⇒ **没有任何用例构造「同一命令内有成功也有失败的 actor」再看 `results`**，
`A-2` 的反断言因此从未被执行。

**最小修复**：`:69` 的 `.filter(...)` 删除，直接 `.map(record => record.result)`；
补一条用例：一条命令挂三个 actor（成功/失败/成功），断言 `results.length === 3`
且顺序与 `actorResults` 一致。

**证据档位**：仓内源码事实 + 一条推论（arity 差异）。
**是否需要 Dexter 裁决**：**否** —— 需求已明令。
⚠️ 若 Dexter 认为「便利视图就该compact」，那是**改需求**，需要单独裁定并同步 §4.7.5 与详设 §4.4。

---

### N 组

| # | 位置 | 事实与后果 |
|---|---|---|
| N-1 | `features/actors/cleanupRequestLedgerActor.ts:16-20` | `isTerminalStatus(status: string)` 用 `string` 而非 `RequestLifecycleStatus` 收参，四个字面量硬比。**行为当前正确**（`started` 被正确排除），但失去穷尽性检查：contracts 若再加第六态，这里会静默当作**非终态**（fail-safe 方向，不会误删），且编译器不提示。建议收成 `RequestLifecycleStatus` 并用穷尽 switch 或 `satisfies` |
| N-2 | `foundations/createLifecycleEmitter.ts:430` | `createCommandExecutionObservation(transition.context, [depthRecord!], depthRecord!.completedAt)` 用了两处非空断言。当前由同一行的 `transition.kind === 'command.depth-rejected'` 判别式保证成立，**不是缺陷**；但 `!` 会随分支重构静默失效。建议改成先 `if (depthRecord !== undefined)` 收窄再构造 |

---

## 3 · 未核实边界（本轮不得当作已证明）

| 项 | 状态 |
|---|---|
| runtime typecheck / 73 tests / 5 gates / contracts / platform-ports 静态门 | `UNVERIFIED_BY_THIS_REVIEW` —— 本轮零命令 |
| `TERMINAL_STATIC=PASS` · `TERMINAL_VERIFY=PASS` · 22/22 typecheck · 9/9 test · `real=4 noTests=5` · Metro 710 modules · cleanup PASS | `UNVERIFIED_BY_THIS_REVIEW` |
| red mutation 是否**真的**各自只红目标门 | 形态正确（`assertVector` 结构已核），**是否真红未验** |
| `state.applyAuthoritativeSync` 的 sync direction | `CROSS_PACKAGE_DEBT`，本批按设计登记不修 —— **静态阅读不构成它已被修复或已被证明的证据** |
| 跨重启行为 | `NOT_PROVEN_BY_THIS_REVIEW` |
| native / Gradle / autolinking / 设备 | `NOT_APPLICABLE_AND_NOT_AUTHORIZED` |
| state 生产源码未被 B 越界修改 | **推论**（见 §1.6），非直接观测 |

---

## 4 · 结论

**`VERDICT = NO-GO`　`M=1  S=1  N=2`**

**Unit B 确实建成了** —— 两个单写者 slice、四态 selector（含 Dexter 单边裁定的三条排除）、
合并聚合、budget 从合并视图取数且无独立计数表、淘汰用合并判据只删本机半、
角色 effect append 在最后且失败保护成立、timer 可释放、单一事实产生点与
`displayMode` 单点赋值都未被破坏。这些我逐行核过，**不是靠实施记录采信的**。

**NO-GO 的唯一理由是 M-1**：台账写入失败会把异常抛到分发边界，
**逐字复现了需求 §4.3 用来禁止 POC 的那个 `try/finally` 无 `catch` 形状**，
同命令其它 actor 的结果会随整条 reject 一起丢失；
而唯一相关的用例断言的正是 reject，**把偏离锁死在测试里**。
修复面很小：每-actor 路径加一层 catch + 改一条断言，**不动五个接点、不动公开面 63、不动设计**。

S-1 同批修（一行 `.filter` 删除 + 一条混合 actor 用例），N-1/N-2 顺手改。

**本轮授权边界**：只评审 Unit B 实现是否完成。
不授权 Unit C、其余包能力实现、`state` 生产同步方向修复、native/Gradle/autolinking/设备、
DEV、seed、reset、浏览器 L2、UAT、部署或仓级 normal verify。
