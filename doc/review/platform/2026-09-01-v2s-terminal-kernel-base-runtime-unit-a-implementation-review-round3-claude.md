# TER `kernel.base.runtime` 单元 A · 第三轮静态逐行 IMPLEMENTATION review

| 字段 | 值 |
|---|---|
| REVIEW_TARGET | `IMPLEMENTATION` · ROUND 3 |
| **VERDICT** | **GO**（静态口径）—— 唯一未决项 S-7 是我上轮标的 `DEXTER_DECISION`，不阻塞 A 的正确性 |
| **M / S / N** | **0 / 1 / 0**（S-1 即 S-7，未决非缺陷） |
| 上轮处置 | **M 1/1 · N 3/3 真修**；S-7 按裁定边界**正确地留而未动** |
| 新增缺陷 | **未发现** |
| 方法 | **纯静态逐行**。本轮**未运行任何命令** |
| 会话出处 | fresh，v2s 仓根发起 |

---

## 1 · 上轮 findings 逐条复核（全部回原文亲验）

### M-2 · 角色 payload 无人校验 —— ✅ **真修，且修在最早的那个位置**

`src/features/actors/setRuntimeInstanceModeActor.ts:20-23`：
```
const payload = context.command.payload
if (!isRuntimeInstanceMode(payload.instanceMode)) {
  throw new Error('Runtime instance mode must be MASTER or SLAVE')
}
```

**位置是对的 —— 这是我上轮说「缺一不可」的那两处里最关键的一处**：
校验排在**读当前角色之前、幂等短路之前、`role.change-requested` 之前、
`roleEffects` 之前、`dispatchAction` 之前**。抛出后经 `dispatchActor` 的
`.catch`（`createCommandDispatcher.ts` 的 execution 链）落成该 actor 的 `error`
⇒ 命令聚合为 `error` 而非 `completed`。**三条失守（journal / 返回值 / effects）一次全关。**

`isRuntimeInstanceMode` 回来了，但**没有回到被删的旧位置**，而是落在
`src/types/role.ts:3-4`，与 `RuntimeInstanceMode` 闭集**同文件**：
```
export const isRuntimeInstanceMode = (value: unknown): value is RuntimeInstanceMode =>
  value === 'MASTER' || value === 'SLAVE'
```
⚠️ 我复核了这不违反任何仓内约束：`tools/` 下**没有任何门断言 `types/` 必须是纯类型**
（穷举 `terminal-runtime/check-static.mjs` 与 `terminal-skeleton/check-static.mjs`），
而 `types/limits.ts`（8 个值）· `types/actor.ts`（2 个）· `types/command.ts`（1 个）
**本来就有运行期值** ⇒ 这是**跟随既有惯例**，不是新开口子。

**深度防御保留**：reducer 的静默忽略仍在（`runtimeInstanceMode.ts`），
但按 HANDOFF 第 349 行的自述「不再承担唯一校验职责」—— 与我上轮的修法建议一致。

**测试是真的能证伪**（`test/roleAndRoute.test.ts:120-137`，用例 `I-2`）：
- 走的正是我点名的**字符串派发路径**（`:128-131`，零 cast）；
- 四条后果**逐条断言**：`result.status === 'error'` · `effectCalls === 0` ·
  `selectRuntimeInstanceMode(...) === 'MASTER'` ·
  **journal 里 `role.change-requested` 与 `role.changed` 都不存在**。

⚠️ 我另外验了两个它没写但也 fail-closed 的输入：
`payload` 为 `null`（`dispatchCommand(name, null)` 编译得过，因为 `null ∈ StateJsonPrimitive`）
⇒ `payload.instanceMode` 抛 `TypeError` ⇒ 经 `normalizeRuntimeError`
（`:34` 非 AppError 走 `command_execution_failed` 并把原始错误放进 `cause`）
⇒ 同样落成 actor `error`。**没有静默成功的分支。**

### N-6 · 声明无 definition 不被拒 —— ✅ **真修**

`src/application/createRuntime.ts:163-167` 新增反向闭合：
```
for (const declaredCommandName of declared.keys()) {
  if (!definedCommandNames.has(declaredCommandName)) {
    throw commandDefinitionError(`Runtime command declaration has no definition: ${declaredCommandName}`)
  }
}
```
**作用域核过**：`declared`（`:126`）与 `definedCommandNames`（`:133`）都声明在
`for (const module of modules)`（`:121`）**之内**，反向检查（`:163`）也在其内
⇒ **逐模块闭合，不会把 A 模块的声明拿去和 B 模块的定义比**。
两侧键都是**全名**（`declared` 存 `AppModule.commands[].name`，README 第 98 行要求用全名；
`definedCommandNames` 存 `definition.commandName`）⇒ 比较口径一致。
内部模块自身配对复核通过（`createInternalRuntimeModule.ts:24-28`：2 声明 / 2 定义，名字逐字对上）。

### N-7 · `commandDefinitions` 的 `Pick` 剥掉 brand —— ✅ **真修**

`src/types/module.ts:42-48` 新增 `RuntimeCommandDefinition`，在 `Pick` 之外**补回 brand**：
```
& { readonly [commandDefinitionBrand]: unknown }
```
⇒ 手写对象字面量**在类型层就放不进 `commandDefinitions`**（`:80`），
因为 `commandDefinitionBrand`（`types/command.ts:20`）虽在包内 `export`、
**但不在 `index.ts` 的 57 项里**（我逐名复算确认）⇒ 包外无从写出该键。
**防线从运行期回到了编译期**，与 `defineCommand` 的 brand 立意重新对齐。
（`(payload: T) => T` 可赋给 `unknown` ⇒ 真定义仍然满足。）

### N-8 · `fallbackContext` 硬编码 —— ✅ **真修，且比我建议的更好**

我建议「写成断言，或从 signal 里带上真实值」。他们取了第三条：
**把不变量钉进类型**。`RuntimeRoleChangeSignal`（`types/module.ts:32-40`）新增
`visibility: 'internal'` 与 `allowNoActor: false` 两个**字面量类型**字段，
`createCommandDispatcher.ts:208,210` 改为 `signal.visibility` / `signal.allowNoActor`。
⇒ 别的命令若要复用这条 signal 通道，**必须先显式放宽类型**，
journal 的 `visibility` 说谎变成一次刻意的类型改动，而不是无声漂移。

### S-7 · 契约三接入类型不在公开面 —— ⏸ **未动，且这是正确的**

亲验：`RuntimeRoleChangeEffect` 与 `RuntimeRoleChangeSignal` **仍不在 `src/index.ts`**，
导出**逐名复算仍为 57、无重复**。
我上轮把它标成 `DEXTER_DECISION`（加进公开面会触发详设 §9.1「需要增删 57 项公开面」的停机条件）
⇒ **实施者不自行决定是对的**，这一条不计为未修。

---

## 2 · 本轮新增缺陷扫描：**未发现**

我按「找出它为什么不成立」逐项试过，以下都不成立：

| 试探的角度 | 结果 |
|---|---|
| `types/role.ts` 出现运行期值是否破坏结构约束 | **不成立** —— 无此门，且 `limits/actor/command` 三个 types 文件本来就有值 |
| 新抛的 `Error` 是否绕过统一错误协议 | **不成立** —— `normalizeRuntimeError:34` 把非 AppError 包成 `command_execution_failed` 并保留 `cause`，与其它 actor 抛错同一条路径 |
| `payload` 为 `null` / 非对象是否有静默分支 | **不成立** —— `TypeError` 同样落成 actor `error` |
| 反向声明检查是否跨模块串味 | **不成立** —— 两个集合都在模块循环内声明 |
| 反向检查是否误伤内部模块 | **不成立** —— 2 声明 / 2 定义逐字对上 |
| brand 补回后是否让真定义不再满足类型 | **不成立** —— `(payload:T)=>T` 可赋给 `unknown` |
| brand 符号是否泄漏到包外 | **不成立** —— 不在 57 项内 |
| 上两轮修好的东西是否回退 | **未回退** —— `try/finally` 三件套释放（`:360-364`）在；`releaseCommand` 在；dispatcher **零** `features/`/`selectors/` import；`aggregateCommandStatus` 六条规则与顺序逐行未变 |
| 是否又出现死代码 | **未出现** —— 全 `src` 导出符号做零引用穷举，结果为空 |
| 公开面是否被顺手改动 | **未改动** —— 仍 57、无重复、无新名 |

**测试**：51 → **52 条**，新增的就是 `I-2` 那条四断言用例。
README 未变（`5dc24812` 同上轮）—— 复核后认为**不需要变**：
README 第 98-99 行原本就写着「`commandDefinitions`、manifest 与 owner declaration
必须保持 **exact-set**」，**是代码这轮才追上文档**，不是文档滞后。
`HANDOFF.md` 已更新（`d18b0e10`），第 346-353、382 行逐条记了本轮闭合。

---

## 3 · 已核实 / 未核实边界

**已核实（源码事实，本轮逐行打开）**：M-2 校验的位置与执行顺序 · `I-2` 用例的四条断言 ·
反向声明检查的作用域与键口径 · brand 在模块面类型里的补回与符号不外泄 ·
signal 两个字面量字段的类型钉死 · 导出仍 57 且无重复 · 无死代码 ·
上两轮核心不变量（`try/finally` 释放、emitter 单一产生点、聚合六规则、无 features 倒置）未回退。

**`UNVERIFIED_REQUIRES_EVIDENCE`（本轮按指令未运行任何命令）**：
typecheck · **52 条用例是否全绿**（尤其 `I-2` 与反向声明检查是否误伤既有测试模块）·
四道 rule gate 与 support 是否 PASS · red mutation 是否各自只击穿目标门 ·
TER-local `verify:static` / `verify` · 三个 PASS marker 与 `owners=9 / REAL=4 / NO_TEST=5` ·
**contracts 是否已收到 69**（第一轮读到仍是 74，两轮均未复查）。

**边界不得升格**：静态逐行阅读**只能证明源码事实**，不得升级为 native / Gradle /
真实设备 / adapter 能力 / DEV / seed / reset / 浏览器 L2 / UAT / 部署 / 仓级 normal verify 的证明。

---

## 4 · 结论

**`VERDICT = GO`（静态口径）　`M=0  S=1  N=0`**

三轮下来，这个包的走向是对的：
第一轮 1M/6S/6N → 第二轮全修但暴露 1M → 第三轮该 M 闭合、三条 N 全修、**未引入新缺陷**。
本轮修法有两处值得点名：**校验放在最早的位置**（一次关掉三条失守），
以及 **N-8 用类型钉死不变量**（比我建议的注释断言更强）。

**唯一未决项 S-7**（契约三的 `RuntimeRoleChangeEffect` / `RuntimeRoleChangeSignal`
是否进公开面）是**治理裁定**不是实现缺陷，需要 Dexter 一句：
① 按停机条件回改详设与静态门，把 57 放宽；或
② 明确接受「单元 B 反推该类型」并写进 HANDOFF。
**在裁定前保持现状是正确的。**

**这个 GO 的口径**：它是**静态**的。本轮与上一轮都**没有运行任何命令**，
所以 52 条用例是否全绿、四道门是否 PASS、红夹具是否定向红、contracts 是否已到 69 ——
**一概未证**。请以 §3 的清单为准复跑并留原始输出。
**这个 GO 不授权实施后续包、不授权单元 B、不授权任何动态或部署动作。**
