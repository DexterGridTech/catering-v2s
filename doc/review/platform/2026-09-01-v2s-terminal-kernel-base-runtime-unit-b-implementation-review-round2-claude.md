# TER `kernel.base.runtime` 单元 B 实施结果 · 第二轮独立 IMPLEMENTATION review

```text
REVIEW_TARGET=IMPLEMENTATION
ACTION_1_VARIANT=1-A 代码提取（按 kernel 包改写，见 §0 与 DESIGN_GAPS）
REVIEW_CYCLE_ID=TER_KERNEL_BASE_RUNTIME_UNIT_B_IMPLEMENTATION_2026_09_01
REVIEW_ROUND=2/2
reviewerKind=EXTERNAL_CLAUDE
VERDICT=GO
M/S/N=0/0/0
L1_ENGINEERING=PASS
L2_USER_VISIBLE=NOT_APPLICABLE —— 本包是 TER kernel runtime，无 UI surface、无 Journey、无用户可见文案；等价的「对外可观测面」已按 §0 提取并逐条对账
L3_UNVERIFIED=空（理由见 §4：三项未验证边界不是本批的用户可见事实，而是本批明确不覆盖的范围外边界，已单列）
SAME_ROOT_SCAN=见 §2（emit 家族 21 个调用点全集）与 §3.3（results/errors 全集）
DESIGN_GAPS=见 §5（两条，均为正本缺判据，不在本轮自造规则）
EVIDENCE_TIER=静态源码事实（本轮零命令）；Codex 提供的运行输出一律 UNVERIFIED_BY_THIS_REVIEW
```

上一轮 `NO-GO / M=1 S=1 N=2`。本轮**未采信 Codex 自述、实施记录、HANDOFF 或既有 verdict**，
重新打开源码、测试与工具核验。

---

## 0 · 动作 1-A：可观测事实提取（本轮非空）

⚠️ 规范 §1 动作 1-A 的提取脚本只覆盖 `apps/frontend/*/src/features/*/ui/*.tsx`，
对 kernel 包直接跑会产出**空清单** —— 而空清单按 §1 必须停机、不得记 PASS。
本轮按同一意图改写提取口径为「**对外可观测面**」（公开导出 · 对外错误/actor key · 状态字面量 · slice 名），
并把这一缺口记入 `DESIGN_GAPS`，**不在本评审内自造规则**。

| 提取项 | 事实 |
|---|---|
| 包根导出 | **63**（`src/index.ts` 复算，唯一 63）；`tools/terminal-runtime/check-static.mjs` 的 `expectedPublicExports` 同为 **63** |
| 对外错误 / actor key（13 个） | `actor_reentry_rejected` · `actor_result_invalid` · `command_definition_invalid` · `command_depth_rejected` · `depth-rejected` · `instance-mode` · **`ledger_write_failed`** · `peer-dispatch` · `peer_gateway_not_installed` · `peer_result_failed` · `request-budget` · `request_budget_exceeded` · `request_id_required` |
| 被比较的状态字面量 | `completed` `error` `failed` `invalid` `partial-failed` `running` `started` `timed-out` |
| slice 名（3 个） | `kernel.base.runtime.instance-mode` · `…request-ledger.MASTER` · `…request-ledger.SLAVE` |
| 测试规模 | **13 文件 / 76 条**（实算，未采信声明的 13/76） |

---

## 1 · 上一轮 findings 的复核

### M-1（ledger 写失败抛到分发边界）—— **CONFIRMED_FIXED**

修法是**分三个入口**，不是一处补 catch：

| 入口 | 位置 | 行为 |
|---|---|---|
| `emit` | `createCommandDispatcher.ts:260-273` | 非 actor 槽位的 transition，ledger 失败仍 **throw** ⇒ typed reject |
| `emitActorRunning` | `:284-296` | ledger 失败时**返回 emitter 已替换好的 terminal error 记录**；只有记录缺失或非 error 才 throw |
| `emitActorTerminal` | `:298-313` | 同上 |

**关键前提我回源验了，不是采信注释**：emitter 在 ledger 写失败时**确实先把该 actor 的记录换成 terminal error**
（`createLifecycleEmitter.ts:451-477`）—— 先写脱敏日志（`:446-450`，只含 category/event/message），
再 `createActorExecutionRecord(actorKey, 'error', …, projectError(error, ctx))`，
`commandRecords.set(actorKey, failureRecord)`（`:465`），更新 observation 后
返回 `{record: failureRecord, ledgerWriteFailed: true}`。
⇒ `emitActorTerminal` 的返回值**确实是 error 记录**，注释所述成立。

**dispatchActor 侧的早停**：`:590-594` 与 peer 的 `:787-791` 在
`runningRecord.status === 'error' && error.key === ledgerWriteFailureErrorKey` 时直接返回该记录 ⇒
该 actor 终止、**不上抛**、`Promise.all` 的 sibling 不受影响。

### S-1（`results` 只留成功项）—— **CONFIRMED_FIXED**

`selectRequestExecutionView.ts:65-69` 的 `.filter(record => record.status === 'completed')` **已删除**，
现在是 `observation.actorResults.map(record => record.result)` ⇒ **保留全部 actor 槽位**。

### N-1（`isTerminalStatus` 丢穷尽性）—— **CONFIRMED_FIXED**

`cleanupRequestLedgerActor.ts:20-32`：入参收成 `RequestLifecycleStatus`，
`switch` 逐值列出，`default` 用 `const exhaustive: never = status` 收口。
⚠️ 我核过这条的真实保护点：`never` 赋值是**编译期**错误，
所以 contracts 若增第六态，`runtime typecheck` 先红，运行期 throw 是不可达的兜底 ⇒ 方向正确。

### N-2（`depthRecord!`）—— **CONFIRMED_FIXED**

`createLifecycleEmitter.ts:435-441` 改成
`if (depthRecord === undefined) throw new Error('Depth rejection did not produce a record')` 后再构造，
**两处非空断言全部消失**。

---

## 2 · 动作 3 · 同族全集扫描（`emit` 家族）

M-1 的修法只在部分入口生效就等于没修，所以我**穷举了 `createCommandDispatcher.ts` 里
`emit(` / `emitActorRunning(` / `emitActorTerminal(` 的全部 21 个调用点**并逐个判定：

| 类别 | 调用点 | 判定 |
|---|---|---|
| **携带 actor 记录（必须用 per-actor helper）** | `:572` 重入拒绝 · `:584` 本地 running · `:739` 本地 terminal · `:781` peer running · `:802` 网关未装 · `:863` peer terminal | **6 个全部用 helper** ✅ 无遗漏 |
| 入口拒绝路径（throw 是正确的） | `:459 :461 :467 :476` budget 四步 · `:491` depth · `:507` command.started · `:518` command.completed | ✅ 均在 `dispatchInternal` 的 `try` 内，`finally` 仍执行 `releaseCommand` |
| journal-only（设计 §4.9.2 规则 4 明令不写 ledger） | `:355` 角色信号 · `:662 :672` reset ignored · `:727 :875 :883 :893` late 六处 | ✅ `ledgerWriteFailed` 不可能置位；late 三处另有 `.catch(() => undefined)` 兜住 |

**其余 15 个已逐个核对，无一遗漏。**

---

## 3 · 逐项回答评审 prompt 的七个重点

### 1 · actor ledger 失败 → 该 actor typed error + sibling 保留 —— **成立，且有真能证伪的用例**

`test/requestLedgerLifecycle.test.ts:198-239`：两个 actor，在**第 4 次 dispatch**（第一个 terminal actor transition）注入失败。断言：
- `result.status === 'partial-failed'` —— **命令返回而非 reject** ✅
- `actorResults` **长度 2** ✅
- `[0]` = 失败 actor，`status:'error'`，`error.key === 'kernel.base.runtime.ledger_write_failed'` ✅
- `[1]` = sibling，`status:'completed'`，**`result:{completed:true}` 仍在** ✅
- 脱敏日志已产生 ✅

这正是我上轮点名要的反断言，**不是存在性断言**。

### 2 · command.started / command.completed 失败 → typed reject 且不报 completed —— **成立**

- `:241-274`：在 **command.completed** 的 ledger 写入注入失败 ⇒
  `rejects.toMatchObject({key:'ledger_write_failed'})` ✅
- `:276-305`：在 **command.started** 注入失败 ⇒ reject，
  且 **`expect(actorCalled).toBe(false)`** ✅ —— 证明在 actor 执行**之前**就拒绝了

### 3 · selector results 保留全部槽位、失败/超时为 null —— **成立**

源码 `:65-69` 已去 filter；用例两条**正面证伪**：
- `requestLedgerSelector.test.ts:153`：`results).toEqual([null, {peer: true}])` —— 本机 timed-out 槽位保留为 `null` ✅
- `:171`：`results).toEqual([{first: true}, null, {second: true}])` —— **三槽位、中间为 null** ✅
  这正是我上轮说「现有用例全是单 actor、混合场景零覆盖」的那个缺口，已补上。

### 4 · cleanup 用闭集 exhaustive switch —— **成立**（见 §1 的 N-1）

### 5 · depth rejected 路径已无 `depthRecord!` —— **成立**（见 §1 的 N-2）

### 6 · 父子 command 测试改按 commandName 对拍，是否削弱排序 —— **没有削弱**

- **排序逻辑本身未变**：`selectRequestExecutionView.ts:140-144` 仍是
  `startedAt` 升序、并列时 `String(commandId).localeCompare` ✅
- 改动的只是 `requestLedgerLifecycle.test.ts:105` —— 从位置断言改为按 `commandName` 取值。
  **这个改动是对的**：该用例走真实 runtime，父子命令可能落在同一毫秒，
  并列时 tie-break 落到**随机生成的 commandId**，位置断言本身是 flaky 的。
- **稳定排序仍被三条确定性用例覆盖**（手工构造 state，`startedAt` 可控）：
  `requestLedgerSelector.test.ts:194` `rootCommandIds).toEqual([parentA, parentB])`（多根有序）·
  `:208` 命令列表 `toEqual([primary.commandId, device.commandId])`（有序）·
  `:152` `observations.map(source)).toEqual(['local','peer'])`（同命令内两侧顺序）
⇒ **把不确定的位置断言从真实运行用例移走、把确定的排序断言留在可控用例里**，是正确的拆分。

### 7 · 是否仍存在「全部门与测试通过但 ledger 或 runtime 实际错误」的路径

**本批范围内：未找到。** 我按四个角度试过，都不成立：

| 试探 | 结果 |
|---|---|
| helper 的 fallback throw（`record` 缺失或非 error）会不会逸出 | 需要 `commandRecords` 未建立，而那要求 `command.started` 未成功 —— 那一步会先 typed reject。**不可达，且方向是 fail-closed** |
| budget 合成 observation 的 `results` 会不会被新逻辑污染 | 只产出 `[null]`，无害 |
| `isTerminalStatus` 的运行期 throw 会不会让淘汰整体停摆 | 需要 contracts 增态，而 `never` 赋值是**编译期**错误，typecheck 先红 |
| `dispatchCount === 4` 的注入点耦合会不会静默失效 | 三条用例都另外断言了 actorKey/status/error.key，注入点漂移会让断言失败而非静默通过 |

⚠️ **本批范围外确有一条**：`state.applyAuthoritativeSync` 仍不校验 sync direction。
TER-local 全绿**不能**证明单写者已被同步层强制。HANDOFF 已按 `UNVERIFIED_REQUIRES_EVIDENCE` 登记，
本轮**不因绿灯升格**。

---

## 4 · 动作 4 · 未验证清单（三档）

| 档 | 内容 |
|---|---|
| **静态已证（本轮我逐行核）** | 63/63 导出与门同步 · emit 家族 21 点全集 · emitter 的失败记录替换链 · selector 四态与 results 槽位 · cleanup 闭集 switch · 无 `depthRecord!` · 排序逻辑未变 · `verify.mjs` 的 `terminalRealTestOwners`（`:30`）与 runtime REAL 断言（`:106-107`）· `verify-static.mjs:35-36` 已注册 `runtime-model-test` 与 `runtime-real-static` · `verify.test.mjs:58` 仍为 `/marker count mismatch/`、`:100` 为 `/test marker package mismatch/` · 证据文件存在（27 207 字节） |
| **测试已证（用例存在且断言正确，但绿灯由 Codex 提供）** | 三条 ledger 失败用例 · 两条 results 槽位用例 · 多根有序 · 两级 route filter · peer 合并 · budget 预置 ledger · cleanup 合并判据 · 角色翻转 · 重启边界 |
| **无人验证（本轮零命令，均为 `UNVERIFIED_BY_THIS_REVIEW`）** | typecheck exit 0 · 76 条用例是否真绿 · 5 门 + support 是否真 PASS · red mutation 是否真的各自只红目标门 · `TERMINAL_STATIC=PASS` · `TERMINAL_VERIFY=PASS` · 22/22 typecheck · 9/9 test · `real=4 noTests=5` · Metro 710 modules · cleanup PASS |
| **范围外、本批明确不覆盖** | `state` 跨包 sync direction · native / Gradle / autolinking / 设备 · **真实跨机 transport** · **跨重启行为** —— 以上**均不因 TER-local 通过而成立** |

---

## 5 · DESIGN_GAPS（正本缺判据，按规范 §2 记录，不在本轮自造规则）

1. **规范 §1 动作 1-A 没有非 UI 包的等价定义。** 其提取脚本硬编码
   `apps/frontend/*/src/features/*/ui/*.tsx`，对 kernel/adapter 类包必然产出空清单，
   而 §1 又规定空清单要停机。本轮按同一意图改写为「对外可观测面」提取，
   **但这个改写没有正本住址** ⇒ 建议由 `doc/platform/review-standard.md` 补一条非 UI 变体。
2. **`results` 与 `errors` 的空值语义没有唯一判据。** 需求第 1815-1817 行用一条规则同时约束两者
   （「不得做任何取舍」），但实现后 `results` 保留 `null` 槽位（3 项）、
   `errors` 仍按 `error !== null` 压缩（1 项），**两个数组因此不可按下标配对**。
   我判断这不是缺陷（丢一个 `null` 错误不等于丢一个错误，需求也从未承诺下标对齐），
   **但需求文本没有把两者的空值语义分开写** ⇒ 建议在 §4.7.5 补一句，
   免得后续消费者假设可配对。

---

## 6 · 结论

**`VERDICT = GO`　`M=0  S=0  N=0`**

上一轮的 1M/1S/2N **四条全部真修**，而且两处修法比我建议的更完整：
M-1 没有简单加一层 catch，而是**按 transition 是否携带 actor 槽位分成三个入口**——
有槽位的降级成该 actor 的 typed error、无槽位的仍 typed reject，
这与需求 §4.3「降级成**该 actor** 的 error」和 §4.2b 的 typed error / typed reject 区分**同时**对上；
S-1 补的两条用例（`[null, {peer}]` 与 `[{first}, null, {second}]`）正是我说「零覆盖」的那个混合场景。

`emit` 家族 21 个调用点我做了全集扫描，**六个携带 actor 记录的入口无一遗漏**；
`results` 槽位保留、cleanup 闭集、无 `depthRecord!`、排序未削弱四项逐条落实。
第 6 项的测试改动**不是弱化**：把 flaky 的位置断言从真实运行用例移走，
把确定性排序断言留在可控用例里，覆盖没有丢。

**本轮为纯静态复核，零命令。** Codex 提供的全部运行输出属
`UNVERIFIED_BY_THIS_REVIEW`；TER-local 通过**不构成** native、设备、
真实跨机 transport、跨重启或 `state` 跨包同步方向已证明。

**授权边界**：本结论只覆盖 Unit B implementation 是否完成。
不授权 Unit C、其他包、adapter/native、Gradle、设备、DEV、seed、reset、
浏览器 L2、UAT、部署或仓级 normal `scripts/verify`。
