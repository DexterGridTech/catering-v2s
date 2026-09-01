# TER `kernel.base.runtime` 单元 A · 第二轮静态逐行 IMPLEMENTATION review

| 字段 | 值 |
|---|---|
| REVIEW_TARGET | `IMPLEMENTATION` · ROUND 2 |
| **VERDICT** | **NO-GO** |
| **M / S / N** | **1 / 1 / 3** |
| 上轮处置 | **M 1/1 · S 6/6 · N 5/6 真修**（逐行亲验，不采信自陈）；N-6 未修，S-6 的导出半留待裁定 |
| 方法 | **纯静态逐行**。本轮**未运行任何命令**（含 typecheck） |
| 会话出处 | fresh，v2s 仓根发起 |

**这一轮的修法质量很高** —— 不是打补丁，是真的把结构改对了，而且**主动补了三处我没点名的连带项**。
但引入/暴露了一条 Major：**角色命令的 payload 全程无人校验，而这一轮恰好把仅有的那半道兜底拆了。**

---

## 1 · 上轮 findings 的逐条复核（全部回原文亲验）

| 上轮 | 结论 | 亲验依据 |
|---|---|---|
| **M-1** emitter 两个 Map 从不释放 | ✅ **真修** | `createLifecycleEmitter.ts:468-472` 新增 `releaseCommand`；`createCommandDispatcher.ts:299/360-364` 把整个 `dispatchInternal` 包进 `try/finally`，`finally` 里同时释放 `activeRoleContexts`、`commandChains`、`emitter.releaseCommand`。**五个 `set` 点（`:319 :320 :366 :445 :448`）全部落在 `finally` 之前，无残留泄漏路径。** 连带项也做了：`actor.late-*` 已进 `isStandalone`（`:328-329`）⇒ 释放后迟到事件仍 `ok:true` 且进 journal |
| **S-1** `subscribeState` 无人持有 | ✅ **真修，且比我提的更完整** | 两处都改了：`createCommandDispatcher.ts:174-184` 与 `createRuntimeLifecycle.ts:58-67`，都经 `registerResource` 登记，且返回**幂等 disposer**（`active` 闸门防重复 unregister）。`createRuntimeLifecycle` 的 `registerResource` 已改成**必填**（`:35`，`:60` 无 `?.`） |
| **S-2** 分发器里的角色特判 | ✅ **真修，方向正确** | `readRoleTransition` 与两个 `features`/`selectors` import **全部删除**；改为 `RuntimeRoleChangeSignal` + **per-runtime** 的 `roleChangeSignalRef`（`createRuntime.ts:212-217` 是局部 const，**不会跨 runtime 串**）。事件由角色 actor 自己发（`setRuntimeInstanceModeActor.ts:28,42`）⇒ **重复发送消失**（业务 actor 拿不到那个闭包）。foundations→features 的倒置解除，只留一个 `types/module` 的类型 import |
| **S-3** 第二份聚合规则 | ✅ **真修** | `createCommandDispatcher.ts:340-344` 改为复用 `aggregateCommandStatus`；正本参数放宽成 `Pick<..., 'actorResults'\|'allowNoActor'\|'completedAt'>`（`aggregateCommandStatus.ts:11`），**六条规则与顺序一字未动** |
| **S-4** 动态拼接的 depth actorKey | ✅ **真修** | `createLifecycleEmitter.ts:413` 改为固定常量 `'kernel.base.runtime.depth-rejected'`；`lifecycle.test.ts:197-198` 断言两条不同命令名产出**同一个** actorKey |
| **S-5** emitter 的 `sessionId` 零消费 | ✅ **真修** | `projectError` 收进闭包并读 `input.sessionId`（`:290-297`）；另新增 `loggerForContext`（`:271-277`）也带 sessionId ⇒ 命令作用域 logger 现在真的带全五项 |
| **S-6** 两处重复类型 + 契约三接入面 | ⚠️ **修了一半** | 重复**已消除**：`RuntimeRoleChangeEffect` 只剩 `types/module.ts:25`（已 `export`），`RegisteredCommandDefinition` 只剩 `types/command.ts:23`。**但 `RuntimeRoleChangeEffect` 与新增的 `RuntimeRoleChangeSignal` 都不在 `index.ts` 里**（导出仍 57）—— 见 S-7 |
| **N-1** selector 静默返回 MASTER | ✅ **真修** | `selectRuntimeInstanceMode.ts:7-13` 现在对「slice 缺席」与「值非法」**分别抛**，不再静默 |
| **N-2** 三处死代码 | ✅ **真修（删除）** | `assertModuleDependencyShape` · `describeRuntimeModules` · `isRuntimeInstanceMode` **三个全部删除**（`moduleManifest.ts` 37→18 行）。⚠️ 但 `isRuntimeInstanceMode` 恰好是本轮 M-2 需要的那个校验器，见下 |
| **N-3** slice 名三处字面量 | ✅ **真修** | 只剩 `runtimeInstanceMode.ts:13` 一处常量，注册（`:34`）、manifest（`createInternalRuntimeModule.ts:31`）、selector 全部 import 它 |
| **N-4** journal 把 `running` 记成 `error` | ✅ **真修** | `createLifecycleEmitter.ts:185` 改为 `status ?? 'running'`，`types/journal.ts:32-37` 有配套注释说明为什么不伪造 `error` |
| **N-5** `commandChains` 泄漏 + 死条件 | ✅ **真修** | `try/finally` 顺带修掉了 reset 失败路径的 chain 残留；`timer === undefined` 死条件已删（`:524 :656` 改为 `registerResource?.(...)`） |
| **N-6** 声明无 definition 不被拒 | ❌ **未修** | `createRuntime.ts:141-147` 仍只校验 definition→declaration 单向。保留为 N |

**主动补的三处连带项（我没点名，但都对）**：
① 迟到 actor 的 `requestApplicationReset` 现在会检测 `commandChains` 已释放并**记日志后忽略**
（`createCommandDispatcher.ts:458-470`）—— 否则会造出一个**没有任何命令会消费的孤儿 pending reset**；
② `finish()` 改成可返回 `undefined` 并在调用点显式检查（`:563 :573`），不再靠会抛的 `recordFromEmitter`；
③ 新增 `commandLogger`（`:186-192`），命令作用域日志上下文与 emitter 对齐。

**测试**：41 → **51 条**，且新增的是**真行为断言**不是存在性断言：
`lifecycle.test.ts:158-165` 断言释放后 observation/aggregate 为 undefined **且迟到事件仍 `ok:true`、journal 仍有**；
`:272-277` 断言释放后订阅回调**不再触发**（`notifications` 不变）。

---

## 2 · 本轮 findings

### M-2 · 角色命令的 payload 全程无人校验：命令报成功、journal 报已切换、B 的 effect 已执行，而角色没变

**位置**：`src/features/actors/setRuntimeInstanceModeActor.ts:18-53` ·
`src/features/slices/runtimeInstanceMode.ts:26-31` ·
`src/application/createRuntime.ts:378-388`

**仓内事实（四条，逐处打开确认）**：
1. `RuntimeInstanceMode` 是闭集 `'MASTER' | 'SLAVE'`（`src/types/role.ts:1`）；
2. **reducer 静默忽略非法值**：`runtimeInstanceMode.ts:28-30`
   `payload === 'MASTER' || payload === 'SLAVE' ? {instanceMode: payload} : state`
   —— 不抛、不记、不返回任何可区分结果；
3. **角色 actor 不做任何 payload 校验**：`setRuntimeInstanceModeActor.ts:19-21` 直接
   `const payload = context.command.payload`，只与当前值比较是否相等；
4. **门面按名派发不需要任何 cast**：`createRuntime.ts:372-388` 的字符串重载是
   `dispatchCommand<TPayload extends StateJsonValue>(commandName: string, payload: TPayload, …)`
   ⇒ `TPayload` 从**调用方的 payload** 推断，第 384 行再 `as CommandDefinition<TPayload>`。

**可证伪的失败条件（零 cast，automation 可直接触发）**：
```
await runtime.dispatchCommand('kernel.base.runtime.set-instance-mode', {instanceMode: 'BOGUS'})
```
该命令是 `internal`，按 §4.2 第 5 条门面**不要求 requestId**，因此直达角色 actor。逐步结果：
- `current = 'MASTER'`，`'BOGUS' !== 'MASTER'` ⇒ **不走幂等短路**，继续；
- 发出 `role.change-requested`，`nextMode: 'BOGUS'`（`:28-33`）；
- **`roleEffects` 逐条执行**，`nextMode: 'BOGUS'`（`:34-40`）
  —— 按 §0-A 契约三，单元 B 在这里注册的是「**清空本机不再拥有写权的那一份台账 slice**」
  ⇒ **B 的台账半边被真实清掉**；
- `dispatchAction` 派发，reducer 静默忽略 ⇒ **角色仍是 `MASTER`**；
- 发出 `role.changed`，`nextMode: 'BOGUS'` ⇒ **journal 声明角色已切换**；
- actor 返回 `{changed: true, previousMode: 'MASTER', currentMode: 'BOGUS'}`
  ⇒ 聚合为 `completed` ⇒ **`CommandDispatchResult` 报成功**。

**违反的硬规则**：`TR-02`「**「什么都没做」的路径不得返回成功**」
（`doc/platform/terminal-coding-standard.md` 第 84 行）。
这条路径**什么都没做**（角色未变），却同时返回成功、写下成功的 journal、并执行了破坏性 effect。
另与 `TR-01` 立规理由②冲突：automation 的 `command.dispatch` 被要求是**完备驱动面**，
而这条完备驱动面现在能驱动出一个「报告成功的空操作 + 一次真实的数据清除」。

**⚠️ 诚实定性：这不是纯粹的新回归，但本轮把仅有的半道兜底拆了。**
上一版有 `emitRoleChangedIfApplied`，它在发 `role.changed` **之前**校验
`selectRuntimeInstanceMode(...) === nextMode` —— 那半道只护住了 **journal**，
**没有**护住返回值与 effects（那两条上一版就已经是错的）。
本轮按 S-2 把它连同分发器特判一起删掉了，**没有在 actor 侧补上等价校验**；
同时按 N-2 把 `isRuntimeInstanceMode`（`setRuntimeInstanceMode.ts` 旧第 15 行的类型守卫）
**删掉了** —— 那恰恰是这里该用的校验器。
⇒ 结果是**三处一起失守**：journal、返回值、effects。

**没有任何东西拦得住它**：四道 rule gate 是 context 精确集 / 挂载形状 / owner kind / 重启正向，
都看不见 payload；51 条用例里**没有一条**用非法 `instanceMode` 派发
（穷举 `test/*.test.ts` 中 `instanceMode:` 的全部出现，只有 `'MASTER'`/`'SLAVE'`）。

**最小修复**（两处，缺一不可）：
① 角色 actor 在读 `payload` 之后**立即校验**，非闭集取值即抛
（恢复一个等价于被删掉的 `isRuntimeInstanceMode` 的守卫），
使命令落成 `error` 而不是 `completed`，**effects 与两个 signal 都不执行**；
② reducer 的静默忽略保留（它是深度防御），但**不得作为唯一防线**。

**为什么更小的替代不足**：
- 只在 reducer 里抛 **不行** —— reducer 在 `dispatchAction` 之后才跑，
  那时 `role.change-requested` 已发、**effects 已经执行完**，B 的台账已经被清了；
- 只恢复 `emitRoleChangedIfApplied` 式的「事后校验再决定发不发 journal」**也不行** ——
  它修的是三条里最轻的那条，返回值仍报成功、effects 仍已执行；
- 只靠类型 **不行** —— 字符串派发路径 `TPayload` 从 payload 推断，编译期不设防，
  而那正是 automation 与跨机入站要走的路。

---

### S-7 · 契约三的两个接入类型仍不在公开面（`DEXTER_DECISION` 待裁）

**位置**：`src/types/module.ts:25`（`RuntimeRoleChangeEffect`）· `:31`（`RuntimeRoleChangeSignal`）·
`src/index.ts`（两者均**不在**其中，导出仍为 **57，逐名复算无重复**）

**事实**：重复声明已消除 ✓，但两个类型都只从 `types/module.ts` 导出、**没有出现在包根**。
`RuntimeModule.roleChangeEffects` 是**公开类型**的字段，其元素类型不可命名。

**后果（可证伪）**：单元 B 要按 §0-A 契约三注册「清空旧角色台账」的 effect 时，
只能写内联字面量，或自己用 `NonNullable<RuntimeModule['roleChangeEffects']>[number]` 反推 ——
无法 `import type {RuntimeRoleChangeEffect}`。

**为什么本轮没修是合理的**：把它加进公开面会让 57 变 58，
**触发详设 §9.1 的停机条件**「需要增删 57 项公开面」。
⇒ **这一条是 `DEXTER_DECISION`**：要么按停机条件回改详设与静态门（57→58 或 59），
要么明确记录「B 只能反推该类型」并写进 HANDOFF。**不应由实施者自行决定。**

---

### N 组（3 条）

| # | 位置 | 事实与后果 |
|---|---|---|
| N-6 | `src/application/createRuntime.ts:141-147` | **沿用上轮，未修**。只校验「每个 definition 都有 declaration」，不校验反向 ⇒ 模块可在 `AppModule.commands` 里声明一条没有 definition 的命令，`describeRuntimeModule`（`moduleManifest.ts:13`）把它写进 `descriptors[].commandNames`，而按名派发会 typed reject。需求 §4.1 第 2 条称该清单为「权威声明」，这个权威仍是单向的 |
| N-7 | `src/types/module.ts:68-71` | `commandDefinitions` 的类型用 `Pick<CommandDefinition, …7 个字段>` **刻意剥掉了 brand** ⇒ 手写对象字面量在**类型层**可以放进模块声明。运行期由 `createRuntime.ts` 的 `commandDefinitionBrand in definition` 兜住（fail closed），所以不是缺陷，但**防线从编译期退到了运行期**，与 `defineCommand` 的 brand 立意不完全一致。建议在类型上保留 brand 并让工厂产出满足它 |
| N-8 | `src/foundations/createCommandDispatcher.ts:201-213` | `fallbackContext` 把 `visibility: 'internal'` 与 `allowNoActor: false` **硬编码**。当前不变量成立（`onRoleChange` 是只交给内部角色 actor 的私有闭包，而 `setRuntimeInstanceModeCommand` 确为 `internal`/`allowNoActor:false`），但这个不变量**没有任何机械保障**；若将来别的命令复用该 signal 通道，journal 的 `visibility` 会说谎。建议在注释里把不变量写成断言，或从 signal 里带上真实值 |

---

## 3 · 已核实 / 未核实边界

**已核实（源码事实，本轮逐行打开）**：上表 13 项处置逐条 · `releaseCommand` 的全部释放路径与
五个 `set` 点的覆盖关系 · 两处 `subscribeState` 的登记与幂等 · 角色 signal 的 per-runtime 隔离 ·
`aggregateCommandStatus` 六条规则未变 · 导出仍 57 且无重复 · 51 条用例的分布与新增断言内容 ·
`LoggerPort.withContext` 确实存在（`platform-ports/src/types/logging.ts:83`）。

**`UNVERIFIED_REQUIRES_EVIDENCE`（本轮按指令未运行任何命令）**：
typecheck · 51 条用例是否全绿 · 四道 rule gate 与 support 是否 PASS ·
red mutation 是否各自只击穿目标门 · TER-local `verify:static` / `verify` ·
三个 PASS marker 与 `owners=9 / REAL=4 / NO_TEST=5` ·
**contracts 是否已收到 69**（上轮读到仍是 74，本轮未复查）。

**边界不得升格**：静态与逐行阅读**只能证明源码事实**，
不得升级为 native / Gradle / 真实设备 / adapter 能力 / DEV / seed / reset /
浏览器 L2 / UAT / 部署 / 仓级 normal verify 的证明。

---

## 4 · 结论

**`VERDICT = NO-GO`　`M=1  S=1  N=3`**

**上轮的 1M/6S/5N 是真修，不是补丁** —— 结构改对了（`try/finally` 释放、
角色事件回到 actor、聚合复用正本、订阅登记幂等），还主动补了三处连带项，
测试也从存在性断言升级成了行为断言。**这一轮的工作质量明显高于上一轮。**

**NO-GO 的唯一理由是 M-2**：角色命令的 payload 无人校验，
而本轮按 S-2 删掉分发器特判、按 N-2 删掉 `isRuntimeInstanceMode` 之后，
**journal、返回值、effects 三条全部失守** —— 一条 automation 零 cast 就能发出的命令，
可以让 runtime 报成功、journal 报已切换、B 的台账被真实清空，而角色纹丝未动。
修法是在角色 actor 里加一道闭集校验（约 3 行）+ 一条用例。

**S-7 需要 Dexter 一句裁定**（改公开面会触发详设 §9.1 停机条件），不应由实施者自决。
N-6 / N-7 / N-8 可顺手改。

**本轮授权边界**：只做静态 IMPLEMENTATION review 并交付本报告。
不授权修改任何源码、不授权运行命令、不授权 native / 设备 / DEV / seed / reset /
浏览器 L2 / UAT / 部署 / 数据操作 / 仓级 normal verify，也不授权开始单元 B 或下一个包。
