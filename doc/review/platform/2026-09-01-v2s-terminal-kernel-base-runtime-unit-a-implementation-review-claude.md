# TER `kernel.base.runtime` 单元 A 已实施结果 · 独立 IMPLEMENTATION review

| 字段 | 值 |
|---|---|
| REVIEW_TARGET | `IMPLEMENTATION` |
| **VERDICT** | **NO-GO** |
| **M / S / N** | **1 / 6 / 6** |
| 基线指纹 | 三份**全部复算一致**（requirements `9ab0bddb…` · 详设 `5e670380…` · HANDOFF `d63b78ce…`） |
| 方法 | **逐代码静态核验**。Dexter 会话中途指令「仅做逐代码静态 review」⇒ 除已跑完的 runtime `typecheck` 外，**其余授权命令一律未复跑** |
| 会话出处 | fresh，v2s 仓根发起 |
| 与内部 recheck 的关系 | 内部 postfix 对账的 `GO 0/0/0` **不作为本轮任何结论的依据**，本轮未引用它 |

---

## 0 · 先回答：这活到底要解决什么问题，解决了没有

### 真问题（从 `TR-01` 与 POC 事实独立推导，不引详设结论）

TER 有 22 个包，除 runtime 外每个 owner 包都要往 store 写状态。**没有一条受控写路径时会同时坏三件事**
（`doc/platform/terminal-coding-standard.md` 第 62 至 66 行给的三条收益，反过来就是三个病）：
① 没有任何地方能回答「这次状态变化是哪个用户操作引起的」；
② automation 的 `command.dispatch` 不是完备驱动面 ⇒ 必须开后门；
③ foundation 被迫持有 store ⇒ 不可单测。
POC 的实测反例就在规范里：`AdapterDiagnosticsScreen.tsx:54` 组件里直接 `store.dispatch`，
`reduceServerMessage.ts` 让 foundation 接 `dispatchAction`。

⇒ **`TR-01` 是规矩，runtime 是这条规矩的唯一执行机制** —— 只有它拿得到 dispatch，别人只能发 command。
单元 A 要交的就是这台机器本身：模块装配 → 命令定义与分发 → actor 并发执行 → 结果聚合 →
生命周期留痕 → 启动 / reset / 角色自持。

### 解决了吗：**主干解决了，但同时偷偷建起了一个需求开篇就批评过的东西**

**真正立住了的（逐代码核过，不是看文档）**：

- **`TR-01` 的执行机制成立**。`dispatchAction` 在全包只出现在两处生产路径：
  actor 上下文的构造（`src/foundations/createCommandDispatcher.ts:409`）与角色 actor
  （`src/features/actors/setRuntimeInstanceModeActor.ts:37`）。
  **模块上下文 9 项里没有它**（`src/types/module.ts:43-57`）—— 这正是 `TR-01` 成立的机械前提。
- **六条聚合规则逐条正确**（`src/foundations/aggregateCommandStatus.ts:13-31`）：
  rule 0 的 `completedAt === null || some(running)` 在最前，空集在 rule 1，
  `partial-failed` 与 `timed-out` 的分界与需求 §4.7.5 **逐字一致**。
- **契约二的单一产生点是真的**。`ActorExecutionRecord` 与 `CommandExecutionObservation`
  在 `src/` 内**只有 `createLifecycleEmitter.ts:98` 与 `:114` 两个构造函数**，
  三条合法路径（正常 actor / peer 网关 / 网关未装）都经 `emitLifecycle`；
  `journal.append` 在 `src/` 只有 `createLifecycleEmitter.ts:370` 一个调用点。
- **M-1 触点（B→A）真的闭合**。`LifecycleCommandContext` 带 `routeContext`
  （`createLifecycleEmitter.ts:32`），而 `displayMode: null` 唯一赋值点
  （`:127`）与 `context` **在同一个函数体内** ⇒ B 只改这一个表达式，不改类型、不改调用点。
- **契约三成立**。角色 effects 在 `setRuntimeInstanceModeActor.ts:30-36` 串行执行，
  `dispatchAction` 写字段在 `:37`，effect 抛错则字段不写 ⇒ **顺序与失败语义都对**。
- **单元 B 确实一点没做**。全包无 request slice、无 selector 聚合、无 eviction、
  无 latest-wins、无 request 同步（`limits` 里 B 的三项只声明不消费，
  `createRuntime.ts:94-101` 只校验、`resolveLimits` 之外零引用）。
- **RTK 边界干净得超出详设**。详设写的是 `EnhancedStore` / `StoreEnhancer` / `UnknownAction`
  三个 RTK 类型；实现**改成从 state 的公开类型结构派生**
  （`src/types/runtime.ts:23-25`），全包 **零 `@reduxjs/toolkit` import**，
  `package.json` 也不声明它 ⇒ 依赖闭包是诚实的。**这一处比详设更好。**

**同时被建起来的问题**：`createLifecycleEmitter.ts` 的 `observations` 与 `recordsByCommand`
两个 Map **从头到尾没有一处 `delete`**（见 M-1）。这就是一份没有淘汰、没有上限、没人能读的
内存请求台账 —— 而需求 §4.7.6 开篇的原话是「**台账是 slice，无界比内存 Map 更糟**」，
§3.8 第 2 条点名 POC 的台账「**完全无淘汰无上限**」。**A 把这条毛病原样搬了进来。**

### 方案合理性（不因门绿就默认成立）

- **复用而非重造**：store / 持久化 / 同步全部经 `state`，时间与 ID 经 `contracts` 的
  `nowTimestampMs`/`createCommandId`，日志与存储经 `platform-ports`。**没有重复造轮子。**
- **有一处错误抽象**：通用分发器里塞进了对 `set-instance-mode` 这一条业务命令的特判
  （见 S-2）。这是**为一个 journal 事件把业务概念焊进了通用路径**。
- **没有为 B 提前引入抽象**：`limits` 六字段一次冻结是详设写明的跨单元接口成本，合理；
  没有出现 B 的 slice / selector / 淘汰的任何雏形。
- **有一处「写了没接线」**：`assertModuleDependencyShape`（见 N-2）。

---

## 1 · findings

### M-1 · lifecycle emitter 的两个 Map 从不释放：单元 A 建了一个无界内存台账

**位置**：`apps/terminal/kernel/base/runtime/src/foundations/createLifecycleEmitter.ts:293-294`
（声明）· `:308-309` `:353` `:432` `:435`（写入）· **全文无任何删除点**

**仓内事实（穷举确认）**：对 `observations` 与 `recordsByCommand` 的全部操作只有
`get` / `set`，`createLifecycleEmitter.ts` 里 **`.delete(` 零命中**，
`emitLifecycle` / `getObservation` / 返回的对象里都没有释放入口。
对照：`createCommandDispatcher.ts:327` 明确删了 `commandChains` 的条目
—— **作者知道要清理，只是漏了这两个**。

**每条命令留下什么**：一条 `CommandExecutionObservation`
（`:114-128`，含全部 `actorResults`）+ 一个 `Map<actorKey, ActorExecutionRecord>`
（`:294`），而 `ActorExecutionRecord.result` 装的是 **actor 的完整返回值**，
单条上限 `maxActorResultBytes` 默认 **262144 字节**（`src/types/limits.ts` 的默认值，
经 `createRuntime.ts:110` 校验）。

**可证伪的失败条件**：
一台连续运行的收银终端，每分钟 60 条命令 × 每条 3 个 actor × 平均 1 KB result
⇒ 每小时约 **10.8 MB 常驻增长，永不释放**，直到进程重启。
更直接的证伪：在任一测试里连发 N 条命令后读 emitter 的 `observations.size`，
它恒等于 N —— 而 A 期**没有任何读者需要这些条目活过 `dispatchInternal` 的返回**
（`createCommandDispatcher.ts:302-303` 取完 observation 就构造 result 返回了）。

**为什么门和测试全绿**：四道 rule gate 是 context 精确集 / 挂载形状 / owner kind /
重启正向（`tools/terminal-runtime/check-static.mjs:12-18`），没有一道看得见运行期结构；
41 条用例里没有一条断言 emitter 的内存不增长。

**与需求的冲突**：§4.7.6 开篇「台账是 slice，**无界比内存 Map 更糟**」；
§3.8 第 2 条把 POC 台账的「完全无淘汰无上限」列为缺陷。A 交付的正是那个形态。

**最小修复**：emitter 增一个 `releaseCommand(commandId)`，删掉两个 Map 的对应条目；
`dispatchInternal` 在 `commandChains.delete`（`createCommandDispatcher.ts:327`）**同处**调用它。
🔴 **必须同批处理的连带项**：超时后的迟到路径
（`createCommandDispatcher.ts:534-538` 与 `:631-657`）仍会 emit `actor.late-*`，
而 late 不在 `isStandalone` 集合里（`createLifecycleEmitter.ts:312-319`）
⇒ 释放后迟到事件会走 `observation === undefined` 分支返回 `{ok:false}`，
**迟到 journal 事件将全部丢失**（异常被 `:538` 的 `.catch` 吞掉，静默）。
⇒ 正确修法是**同时把 `actor.late-completed` / `actor.late-error` 加进 `isStandalone`**
—— 它们按需求 §4.3 本来就「只进 journal、不回写记录」，不该依赖 observation 存在。

**为什么更小的替代不足**：给两个 Map 加 LRU 或条数上限**不足以修** ——
那只是把「无界增长」换成「有界丢失」，而正确语义是「命令终结即释放」；
且上限会让迟到路径在高负载下随机丢事件，比现在更难诊断。

---

### S-1 · `subscribeState` 的取消函数全程无人持有：§4.5b 只做了定时器那一半

**位置**：`src/foundations/createCommandDispatcher.ts:411`（actor 上下文）·
`src/foundations/createRuntimeLifecycle.ts:57`（模块上下文）

**仓内事实**：两处都是 `stateRuntime.getStore().subscribe(listener)` **直接返回**，
没有经过 `registerResource`。`registerResource` 在全包只被用了两次
（`createCommandDispatcher.ts:496` 与 `:616`），**两次都是 `clearTimeout`**。
`createRuntimeLifecycle` 的入参里**根本没有 `registerResource`**。
测试 `L-4` 自己的标题就写着「releases test-owned **timeout** resources」
（`test/lifecycle.test.ts:117`）。

**与需求的冲突**：§4.5b 原文——「🔴 **但 runtime 必须统一持有 `install` 期注册的一切生命周期资源**：
**`subscribeState` 返回的取消函数** · 所有定时器。POC **不持有**（`subscribeState` 的返回值
全仓无人保存），于是无从释放。」并给了理由：「§8 的【A】测试要求「两个 runtime 实例 + 内存网关」，
**而那正是会被订阅与定时器泄漏串掉的那一类**」。
⇒ **需求点名的第一项没做，而且做的正是 POC 那个被点名的形态。**

**可证伪的失败条件**：某模块 `install` 里 `ctx.subscribeState(cb)`；
`releaseRuntimeForTest(runtime)` 返回后该 listener **仍在 A 的 store 上**，
且**没有任何代码持有它的 unsubscribe** ⇒ 永远无法释放。

**为什么不是 M**：生产形态下 runtime 是进程级单例，泄漏量被模块数封顶；
真实影响集中在多 runtime 测试的相互串扰。

**最小修复**：两处 `subscribeState` 都改成
`const off = store.subscribe(l); const un = registerResource(() => off()); return () => {un(); off()}`；
`createRuntimeLifecycle` 的入参补 `registerResource`；`L-4` 补一条订阅侧断言。

---

### S-2 · 通用分发器里塞了对 `set-instance-mode` 的业务特判：层次倒置 + 事件重复

**位置**：`src/foundations/createCommandDispatcher.ts:50-51`（import）·
`:102-109`（`readRoleTransition`）· `:367-386`（调用点）

**仓内事实**：`foundations/` 的通用分发器 **import 了 `features/commands/setRuntimeInstanceMode`
与 `selectors/selectRuntimeInstanceMode`**，并在 `dispatchActor` 里对**每一个 actor**
先做一次命令名字符串比较（`:103`），命中时**读一次 store**（`:107`）。

**三个可证伪的后果**：
1. **事件重复**：`readRoleTransition` 在 `dispatchActor` 内（`:367`），不是每条命令一次。
   `setRuntimeInstanceModeCommand` 是**公开导出**的（`src/index.ts` 第 50 行一带），
   任何模块的 actor 都能挂它 ⇒ 挂 N 个 actor 就发 N 次 `role.change-requested`。
   这正是评审 prompt 第四项点名的「状态被**重复产生**」。
2. **层次倒置**：`foundations/` 依赖 `features/` 与 `selectors/`。
   `TR-06` 要求 foundations「必须是纯函数，或只接受**显式注入的、已抽象的**依赖」；
   runtime 虽在 `TR-01`/`TR-06` 的白名单里，但白名单的**理由**是
   「它们**实现**派发本身」（规范第 53 行）——
   **「嗅探命令名并读角色 slice」不是实现派发**，不在这条理由的射程内。
3. **通用路径上的 store 读**：每条命令的每个 actor 都要跑一次字符串比较，命中即 `getState()`。

**最小修复**：删掉 `readRoleTransition` 与两个 import；由**角色 actor 自己**发这两个事件
—— 它在 `setRuntimeInstanceModeActor.ts:22` 已经算出了 `current`，
再通过 actor 上下文的一个通用「业务事实」出口发给 emitter。

**为什么更小的替代不足**：只把调用点从 `dispatchActor` 提到 `dispatchInternal`
（修掉重复发送）**不够** —— 倒置与通用路径读 store 两条还在，
且下一个需要 journal 特写的业务命令又要在分发器里加一个 `if`。

---

### S-3 · 分发器内有第二份聚合规则，且规则是错的

**位置**：`src/foundations/createCommandDispatcher.ts:304-312`

**仓内事实**：
```
const status = emitter.aggregate(commandId) ?? (
  resultActorResults.length === 0 && definition.allowNoActor ? 'completed'
    : resultActorResults.some(r => r.status === 'running') ? 'running'
    : resultActorResults.every(r => r.status === 'completed') ? 'completed'
    : 'error')
```
这份 fallback **没有 `partial-failed`、没有 `timed-out`**，且把 rule 0 排在空集规则之后
—— 与 `aggregateCommandStatus.ts:13-31` 的六条正本**规则不同、顺序也不同**。

**与需求的冲突**：契约一「⚠️ **单元 B 复用同一份实现，不得另写一份**」；
§4.7.7 ②b「每一次状态迁移只有一个产生点」。**A 期就已经有第二份。**

**可证伪的失败条件**：当 `emitter.aggregate` 返回 `undefined` 时，
一条 `{completed, timed-out}` 的命令算出 **`error`**，而需求 §4.7.5 明令它必须是
`partial-failed`（§4.7.4 的旗舰例子就打在这里）。

**为什么仍是 S 而不是 M**：`emitter.aggregate` 返回 `undefined` 需要
`command.started` 那次 emit 抛到 `:416` 的外层 catch，而其内部 journal / observer
各有自己的 try/catch（`:369-391`）⇒ **近乎不可达**。
但它写在**最需要语义稳定的降级路径**上，且 `aggregateCommandStatus` 已导出，复用是一行的事。

**最小修复**：`?? aggregateCommandStatus(createCommandExecutionObservation(context, resultActorResults, now))`
—— 复用正本，不另写规则。

---

### S-4 · 深度拒绝合成了一个**动态拼接**的 actorKey，actorKey 空间因此无界

**位置**：`src/foundations/createLifecycleEmitter.ts:398-406`

**仓内事实**：`` actorKey: `kernel.base.runtime.depth:${transition.context.commandName}` ``
—— 每个被拒的命令名产生**一个不同的 actorKey**，且含 `:`。

**与既有约束的冲突**：`defineActor` 刚刚才把 `actorName` 的 `.` 禁掉
（`src/foundations/defineActor.ts:15-17`），为的就是让 `${moduleName}.${actorName}`
的命名空间可判定；详设 §5.3 也只保留**一个**私有合成常量
（`peer-dispatch`，`createCommandDispatcher.ts:53`）。**这是实现自己加的第三种形态，而且不是常量。**

**可证伪的失败条件**：分别 dispatch 两条超深命令 `a.b` 与 `a.c`，
台账/journal 里得到两个不同的 actorKey；B 期任何按 `actorKey` 索引或聚合的读侧
会被无限多的 key 撑开。

**最小修复**：换成固定常量 `kernel.base.runtime.depth-rejected`；
命令名已经在 `commandChain`（`:68`）与 `LedgerError.message` 里了，不需要进 key。

---

### S-5 · emitter 的 `sessionId` 入参声明了、传了，**零消费**

**位置**：`src/foundations/createLifecycleEmitter.ts:146`（声明）·
`src/foundations/createCommandDispatcher.ts:155`（传入）· `createLifecycleEmitter.ts:155`（写死 `undefined`）

**仓内事实**：`grep -n "sessionId" createLifecycleEmitter.ts` 只有两处命中：
第 146 行的类型声明与第 155 行的 `sessionId: undefined`。
**`input.sessionId` 在 emitter 内零引用。**

**后果**：`projectError` 是模块级函数（`:150`），拿不到 `input`，
于是 emitter 内部归一化出来的 `AppError` 的 `context` **恒无 sessionId**；
而 dispatcher 自己的 `normalize`（`createCommandDispatcher.ts:216`）传的是
`input.getSessionId?.() ?? null`。**同一类错误经两条路径产出，上下文不一致。**
需求 §4.4 明写命令作用域要带 `sessionId`。

**最小修复**：把 `projectError` 收进 `createLifecycleEmitter` 的闭包，
读 `input.sessionId?.() ?? null`；或删掉这个入参并在详设写明 emitter 不需要它。
**二选一，但不能留着一个声明了不用的依赖** —— 那正是「声称 ≠ 行为」。

---

### S-6 · 两个类型各被重复声明两次，其中一对**不等价**；契约三的接入类型不在公开面

**位置**：
- `RuntimeRoleChangeEffect`：`src/types/module.ts:25`（**无 `export`**）与
  `src/features/actors/setRuntimeInstanceModeActor.ts:11`（有 `export`）——**逐字重复**；
- `RegisteredCommandDefinition`：`src/types/command.ts:23-32`（带 `definition: unknown`）与
  `src/foundations/createCommandDispatcher.ts:68-76`（**不带 `definition`**）——**两份不等价**。

**可证伪的失败后果**：
1. 给 role effect 加一个字段只改 `setRuntimeInstanceModeActor.ts` 那份，
   `RuntimeModule.roleChangeEffects`（`types/module.ts:68`）仍是旧形状，
   **TS 不会报错**（两个都是结构类型），装配方按新形状写、按旧形状被接受。
2. 把 `types/command.ts` 的 `definition: unknown` 收紧成 `CommandDefinition`
   **不会影响** dispatcher 那份 —— **类型链是断的**。
3. **契约三的 B 侧接入面无法命名**：`RuntimeRoleChangeEffect` 两处都不在
   `src/index.ts` 里。B 要注册「清空旧角色台账」的 effect 只能写内联字面量，
   或自己用 `NonNullable<RuntimeModule['roleChangeEffects']>[number]` 反推。

**最小修复**：删掉 `types/module.ts:25` 与 `createCommandDispatcher.ts:68-76` 两份重复，
单向 import 正本。
⚠️ **是否把 `RuntimeRoleChangeEffect` 加进公开面（57 → 58）触发详设 §9.1 的停机条件**
（「需要增删 57 项公开面」）⇒ **`DEXTER_DECISION`**：
要么按停机条件回改详设与门，要么明确接受「B 只能反推该类型」。

---

### N 组（6 条）

| # | 位置 | 事实与后果 |
|---|---|---|
| N-1 | `src/selectors/selectRuntimeInstanceMode.ts:5-9` | slice 缺席时**静默返回 `'MASTER'`**（`value === 'SLAVE' ? 'SLAVE' : 'MASTER'`）⇒「slice 不存在」与「角色是 MASTER」不可区分。而 MASTER 恰恰是危险的那个默认：需求 §4.8a ③ 的理由原文是「重启回来变成 MASTER 会去起拓扑 host，**和真正的主机打架**」。该 selector 是**公开导出**的，`display-context` 会拿任意 `StateRoot` 调它。建议：slice 缺席时抛或返回 `null`，让缺失成为一等事实（`TR-02` 同精神） |
| N-2 | `src/application/moduleManifest.ts:26-37` · `:21-24` · `src/features/commands/setRuntimeInstanceMode.ts:15` | 三处**零引用死代码**（`assertModuleDependencyShape` · `describeRuntimeModules` · `isRuntimeInstanceMode`，`src` 与 `test` 全域零命中）。其中 `assertModuleDependencyShape` 尤其要说：它做的「依赖名非空 + 同模块内重复依赖」校验，`createRuntime` 与 `resolveModuleOrder` **都没有做** ⇒ **写了一道校验但从来没接上**。行为上无洞（空名会在 `resolveModuleOrder.ts:39-43` 变成 Missing required 而 fail closed；重复依赖被 `VISITED` 吸收），所以是 N 不是 S |
| N-3 | `src/features/slices/runtimeInstanceMode.ts:33` `:47` · `src/application/createInternalRuntimeModule.ts:31` | slice 名 `'kernel.base.runtime.instance-mode'` 有**三处独立字面量**，其中 `createInternalRuntimeModule.ts:31` 是一个**本地重复常量**，没有 import 同文件已导出的 `runtimeInstanceModeSliceName`。改 `:33` 那处注册名，manifest 与 selector **都不会跟着变**，而 selector 会因 N-1 的静默 fallback 返回 MASTER ⇒ 两条合起来是一条静默错值路径。建议：`:33` 改用同一个常量，`createInternalRuntimeModule.ts:31` 删掉改 import |
| N-4 | `src/foundations/createLifecycleEmitter.ts:198` | `command.completed` 事件里 `status === undefined \|\| status === 'running' ? 'error' : status` ⇒ 把「还没结束」和「算不出来」都记成 **`error`**。journal 是诊断面，这是**信息损坏**而非缺失，会让人在 journal 里看到不存在的失败 |
| N-5 | `src/foundations/createCommandDispatcher.ts:324-327` · `:494` | ① `await input.performReset?.()` 在 `commandChains.delete` **之前**，而 `runReset` 会抛（`createRuntime.ts:266` `:271`）⇒ **reset 失败时根命令的 chain 条目永久残留**（异常路径，每次一条）。② `timer === undefined` 是死条件：`new Promise` 的 executor 同步执行，`timer` 必然已赋值 |
| N-6 | `src/application/createRuntime.ts:133-160` | 只校验「每个 definition 都有 declaration」，**不校验反向**。模块可以在 `AppModule.commands` 里声明一条没有 definition 的命令 ⇒ `describeRuntimeModule`（`moduleManifest.ts:14`）把它写进 `descriptors[].commandNames`，而 `dispatchCommand(name)` 会 typed reject。需求 §4.1 第 2 条称该清单为「**权威声明**」，现在这个权威是单向的 |

---

## 2 · 逐项回答评审 prompt

**一、Unit A 的真实边界** —— 未偷做 B ✓（无 request slice / selector 聚合 / eviction /
latest-wins / request 同步）。四阶段启动、install、initialize、reset、角色 seam
**逐代码可走通** ✓。`start` 显式 await、无 void 启动、失败进不可逆 `failed` 且
后续调用统一 typed reject（`createRuntime.ts:286-346` `:348-356`）✓。
README/HANDOFF 的边界表述**与源码一致**，README 第 98 至 99 行还写明了
`AppModule.commands[].name` 必须用全名这条否则会踩的约定 ✓。
⚠️ **但「不做 B」只在 slice 层成立**：M-1 的两个 Map 在功能上就是一份不可读、无淘汰的台账。

**二、contracts / state / RTK 边界** —— runtime 公开面**逐组复算 = 57、无重名**；
contracts 仍为 **74**（`tools/terminal-contracts/check-static.mjs:506-514` 逐名点过），
**尚未执行 §6 的 7+9 删除，因此不是 69** ⇒ 见「未核实边界」。
**零 RTK import、零 RTK 依赖声明** ✓（`src/types/runtime.ts:23-25` 从 state 公开类型结构派生）。
`getStore`/`getState` 只是 Redux 原生根，**无 readSlice/getSliceState 旁路** ✓。

**三、command 与 actor** —— payload brand **真正绑定**：
`commandDefinitionBrand` 是不导出的 `unique symbol`，值类型
`(payload: TPayload) => TPayload`（`src/types/command.ts` + `defineCommand.ts:39`）
⇒ `TPayload` 同时在参数位与返回位 ⇒ **不变绑定** ✓。
actor carrier 与 command owner 正确区分（`createRuntime.ts:176` 校验 actor 归属，
`:189-190` 允许挂别的模块声明的命令）✓，**ownership fail closed** ✓。
跨模块挂载正向路径可用 ✓。visibility 对拍在 `createRuntime.ts:131` `:144` ✓。
⚠️ **`commandDefinitions` 的类型用 `Pick` 剥掉了 brand**（`src/types/module.ts:61-64`）
⇒ 伪造 definition 在**类型层不被拦**，只由 `createRuntime.ts:134` 的运行期 `in` 检查兜住
—— fail closed，但防线从编译期退到了运行期。

**四、生命周期与观测** —— 单一事实产生点 ✓（唯一构造函数 + 唯一 `journal.append`）。
local / peer / 网关缺失 / 失败 / 超时 / 迟到 **六条路径全部经 `emitLifecycle`** ✓。
迟到**不改写已终结记录** ✓（`createLifecycleEmitter.ts:321-345` 的写入分支
**不含** `actor.late-*`）。`routeContext` 只作 opaque 搬运、不解释字段 ✓。
⚠️ 状态**重复产生**的路径存在：S-2 的 `role.change-requested`。
⚠️ 状态**错误合并**的路径存在：N-4 的 `running → error`。

**五、测试与机器门** —— **10 个 test file、41 条用例，逐文件点过属实**
（4+3+6+5+5+4+2+4+3+5=41）。`tsconfig.include` 含 `test/**/*.ts` ✓。
四道 rule gate + 一道 support ✓（`tools/terminal-runtime/check-static.mjs:12-18`）。
⚠️ 详设 §3.2 列的是 9 个 test file，实际是 10 个（新增 `foundations.test.ts`、
`types.test.ts`，`public-surface.typecheck.ts` 独立）—— **偏差是往多的方向，不是缺陷**，
但详设与实现的文件清单已不一致。
⚠️ **没有一条用例覆盖 M-1**（emitter 内存不增长），也没有一条覆盖 S-1 的订阅释放
—— `L-4` 的标题自陈只测 timer。

**六、复跑** —— 见「未核实边界」。

**七、架构与方案合理性** —— 见 §0。

**八、证据边界** —— 见下。

---

## 3 · 已核实 / 未核实边界

**已核实（源码事实，逐文件打开）**：57 项公开面 · 六条聚合规则 · 单一事实产生点 ·
契约二/三与 B→A 触点 · `TR-01` 的 `dispatchAction` 分布 · 零 RTK ·
payload brand 的不变绑定 · reset 三个洞的处置 · 角色 slice 的
`owner-only`/`immediate`/`isolated` 声明 · 41 条用例的存在与分布 ·
`verify.test.mjs` 五处夹具与 `50–56` 原字节（第一轮已核，本轮未重核）。

**动态输出（本轮唯一一条）**：`yarn workspace @catering-v2s/kernel-base-runtime typecheck`
⇒ **exit 0，无输出**（`tsc --noEmit`）。

**`UNVERIFIED_REQUIRES_EVIDENCE`（Dexter 会话中途指令「仅做逐代码静态 review」，未复跑）**：
runtime `test` 的 41 条是否**真的全绿** · `check-static.mjs` 四道 rule 与 support 是否**真的 PASS** ·
`check-static.test.mjs` 的五个 red mutation 是否**各自只击穿目标门** ·
`verify.test.mjs` / `verify-static.mjs` · TER-local `verify:static` 与 `verify` ·
`TERMINAL_RUNTIME_STATIC=PASS` / `TERMINAL_STATIC=PASS` / `TERMINAL_VERIFY=PASS` /
`owners=9 REAL=4 NO_TEST=5` 是否由**当前源码**产生 ·
**contracts 是否已收到 69**（本轮读到的 `expectedPublicExports` 仍是 **74**）·
Expo export 的 701 modules。
**以上一律不以 HANDOFF、自陈或旧输出替代。**

**边界不得升格**：静态、typecheck、单测、TER-local verify 与 Expo JS export
**只能证明各自边界**，不得升级为 native / Gradle / autolinking / 真实设备 / adapter 能力 /
DEV / seed / reset / 浏览器 L2 / UAT / 部署 / 仓级 normal verify 的证明。

---

## 4 · 「全部判据通过但 runtime 实际未建成」的路径

**不存在**。41 条用例是真实行为测试（真建 runtime、真跑 actor、真走四阶段），
不是夹具堆；四道门另有独立职责。**runtime 确实建成了。**

**但存在两条「全绿而缺陷仍在」的路径，且都无人拦**：
① **M-1 的无界内存增长** —— 四道门看不见运行期结构，41 条用例无一断言内存不增长；
② **S-1 的订阅泄漏** —— `L-4` 自陈只测 timer。
两条都属于「**门与测试的判据集合与需求的判据集合不重合**」，不是实现绕过了门。

---

## 5 · 结论与授权边界

**`VERDICT = NO-GO`　`M=1  S=6  N=6`**

**NO-GO 的唯一理由是 M-1** —— 单元 A 在 emitter 里建了一份从不释放的内存台账，
而那正是需求开篇（§4.7.6、§3.8 第 2 条）点名批评 POC 的同一条毛病。
修复本身不大（一个 `releaseCommand` + 一处调用），
但**必须与迟到路径的 `isStandalone` 归类同批处理**，否则会把迟到 journal 事件静默丢掉。

S-1 至 S-6 建议同批闭合；其中 **S-6 的公开面问题触发详设 §9.1 的停机条件**，
需要 Dexter 一句裁定（回改详设与门，还是接受 B 反推类型）。
N 组可顺手改。

**本轮结论授权什么**：什么都不授权。这是一次**静态 IMPLEMENTATION review**，
不授权修改任何源码、不授权 CP-A0、不授权 native / Gradle / 设备 / DEV / seed / reset /
浏览器 L2 / UAT / 部署 / 数据操作 / 仓级 normal verify，也不授权开始单元 B 或下一个包。

**本轮不能证明什么**：除 `typecheck` 外**本轮没有运行任何命令**。
所有「成立 / 不成立」都是对**当前仓库字节**的静态核验。
测试是否真绿、门是否真 PASS、红夹具是否真的定向红、contracts 是否已收到 69 ——
**一概未证**，见 §3 的 `UNVERIFIED_REQUIRES_EVIDENCE` 清单。
