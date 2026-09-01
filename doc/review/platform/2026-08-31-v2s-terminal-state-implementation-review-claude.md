# TER `kernel.base.state` 实施 · 独立 IMPLEMENTATION review

| 字段 | 值 |
|---|---|
| REVIEW_CYCLE_ID | `TER_KERNEL_BASE_STATE_IMPLEMENTATION_2026_08_31` · ROUND 1 |
| **VERDICT** | **GO** |
| M / S / N | **0 / 1 / 3** |
| 规模 | src 2,745 行 / 19 文件 · test 1,690 行 / 67 用例 · 门 490 行 |
| EVIDENCE_TIER | `STATIC_SOURCE_ONLY` —— 逐代码静态核验；本会话不运行命令，evidence 的动态数字未复跑（见 §6） |

---

## 1 · 这活到底解决什么问题，解决了没有

**业务问题**：一台 POS **断电重启后不能丢状态**，主副屏要同步，而**业务包不该各自手写持久化**。

**技术问题（TER 特有，POC 没有）**：要在一个**不抛异常、无原子性、无前缀枚举**的存储端口上做到这件事 ——
`writeMany` 只返回整批一个 `PortResult`、`listKeys` 没有 prefix 参数、失败是返回值不是异常。

**判定：解决了，而且是按 TER 端口的真实约束解的，不是照抄 POC。** 逐条对照：

| POC 的真实缺陷 | 本实施的处置 | 我的亲验 |
|---|---|---|
| `void flushPersistence()` 丢弃 Promise，写盘失败无信号 | 队列保留 handler；失败进 `PersistenceFailure` + health + `logger.error` | `persistenceEngine.ts:311-321` 队列用 `.catch(()=>undefined).then(...)`，**不吞结果**；`:809` 唯一 error 出口 |
| 每次全量重写 | 逐 key 差量，cache 只在 `succeeded` 后前移 | P-4/P-5 用例，`grep` 确认生产路径**零 `writeMany/removeMany/clear`** |
| `resetState` 调 `storage.clear()` 清整个后端 | 按 `instancePrefix` 逐 key remove，删除全成功才 dispatch reset | ST-6 门 + C 组用例 |
| hydrate N+1 次 `getItem` | 每物理后端各一次 `listKeys` + 一次 `readMany` | X-4 用例 |
| manifest 半提交 | **manifest 整个删掉**，改用 `listKeys` 枚举 | `keyspace.ts` 无 manifest 概念 |
| `syncIntent` 惰性字段 | 双向一致性校验，四条都在构造期报错 | D-3…D-6 |

**技术问题里最难的一条也解决了**：读失败后不知道盘上有什么，此时若拿空 cache 去"清理陈旧键"会**删掉真实数据**。
实施用 `blocked` + 一次有界 `rebaseline` 挡住（`:334-338`、`:618-654`），
并**明确记录了代价**——README 第 143-144 行写明"失败则本进程内不继续周期重试，直到一次成功 reset"，
H-3 用例断言这个持续性。⇒ 这是**被记录、被测试的取舍**，不是未被发现的行为。

## 2 · 是否重复造轮子

**逐项查过，没有。**

- **RTK**：`configureStore` / `combineReducers` / `EnhancedStore` 全部复用，未自造 store；
- **`platform-ports`**：存储与 logger 全走端口，未自造；
- **`contracts`**：`nowTimestampMs` 与 `TimestampMs` 复用 —— `grep "Date.now()" src` **零命中**，没有绕开契约自造时间；
- **canonical JSON 只有一份实现**：`persistenceCodec.ts:85-101` 的 `canonicalizeStateJsonValue`，
  `supports/sync.ts` 经 `createStateValueSerialization`（`:138`）复用同一份 ——
  **没有出现"持久化一份、同步一份"的双实现**，这是我本轮专门查的一处；
- **未为 canonical JSON 新增第三方依赖**：约 20 行的东西引一个包才是违规。

⚠️ **反向的一处观察见 N-1**：`contracts` 导出的整套错误协议至今**零消费者**，本包是第一个有真实错误条件的包，
它选择了裸 `new Error`。这不是"造轮子"，是"有轮子没用"。

## 3 · 与需求 / 详设 / 规范 / 项目记忆的一致性

| 对账项 | 结果 |
|---|---|
| 公开面 | **三方精确相等 56 = 56 = 56**（详设 §10.3 · 门的 `expectedPublicExports` · `src/index.ts`），我独立复算，零差 |
| 用例数 | **67 = 45+9+9+4**，与 evidence 自述一致 |
| `TR-01` | hydrate 走构造期 `preloadedState` 不是 action；reset 唯一入口是 `getResetActor()`，root action type/creator 未导出（T-5 负夹具） |
| `TR-03` | `getStore/getState` 只暴露 Redux 原生根，**无具名 slice 读取入口**（我 grep 过 `readSlice`/`getSliceState` 类导出，零命中）——与本 cycle 收窄后的正本措辞一致 |
| `TR-09` | `src/**` 零 `createSlice`（ST-2 门）；health 是 runtime 冻结快照不进 store |
| `TR-10` | README 210 行，四项齐全 + 「在这个包上迭代时」；且 §4.5/§4.6 专门写了 record entry 独立提交与 `valueHash` 不是短摘要 |
| 正本例外节 | 写侧只有 `applyAuthoritativeSync` 一条，且只对 `hasSync` 的 registration 生效 |
| 我上轮 DESIGN review 的 6 条 | **全部闭合**：S-1（第 72 行表述）· S-2（blocked 后果已写入 README 且有 H-3/H-4 两条用例）· N-1（`types/sync.ts:31` 注释写明不是摘要，内部函数名 `createStateValueSerialization`）· N-2（`subscribePersistenceHealth` 在 `persistence.test.ts:344` 被订阅并断言）· N-3 · N-4 |
| verifier 接线 | `terminalTestOwners` 八元组含 state；`real.length !== 3` 且逐名断言 state 为 REAL |
| 门 | 4 规则 + 1 support；红夹具经 `assertVector` 断言**目标门红、其余门保持 PASS** |

## 4 · Findings

### S-1 · 内部 registered persistence 类型是「全可选袋子」，erasure 边界上是静默丢弃而非 fail closed

**事实类别**：仓内源码事实 + 可复现推论（当前**不可经公开 API 触达**）。

**位置**：`src/types/slice.ts:62-89` 的 `RegisteredStateRuntimePersistence`；
对照**同一文件 :92-103** 的 `RegisteredStateRuntimeSync`；
消费点 `src/foundations/persistenceEngine.ts:239-260`（`applyDecodedEntry`）与 `:97-105`（`descriptorStorageKey`）。

**证据**：公开的 `StateRuntimePersistenceRecordDescriptor` 里 `getEntries`/`applyEntries` 是**必填**
（`types/persistence.ts:48,51`）。但内部 registered 形态把 field 与 record **拍平成一个 `kind` 加一堆可选字段**的袋子：
`stateKey?` `storageKey?` `storageKeyPrefix?` `readField?` `writeField?` `getEntries?` `applyEntries?`。
于是引擎只能写：

```ts
const existingEntries = entry.descriptor.getEntries?.(current) ?? {}
const next = entry.descriptor.applyEntries?.(current, {...})
if (next !== undefined) { hydrated.set(slice.name, next) }   // next === undefined ⇒ 静默返回
```

`descriptorStorageKey` 同理：`entry.storageKey ?? entry.stateKey ?? 'field'`、`entry.storageKeyPrefix ?? 'record'`。

**紧邻的 `RegisteredStateRuntimeSync` 把 `getEntries`/`applyEntries` 保持必填** ——
同一个文件里两种写法，说明这不是能力问题。

**可证伪失败条件**：若任一 registered persistence 缺 `applyEntries`，
hydrate 会把**已成功解码的值直接丢掉**，且**不产生 `PersistenceFailure`、不 warn、不改 health** ——
与坏 JSON 的处理（`:978-991` 产出 `DECODE_REJECTED` + warn + degraded）**待遇相反**。

**当前不可达**：`defineStateRuntimeSlice.ts:108,140-141` 先 `assertNonEmpty(descriptor.stateKey)`、
`assertFunction(descriptor.getEntries)`、`assertFunction(descriptor.applyEntries)` 再构造，
且 registration 有 brand + WeakMap 双关，外部伪造不进来。**所以今天没有真实故障。**

**后果**：这是一个**latent 的静默丢数据路径**，落在本包唯一的职责（不丢数据）上。
它在两种情况下会被激活：新增第三种 descriptor kind 时忘记补 assert；或有人重构时把 assert 挪走。
届时表现是"某个持久化字段莫名不恢复"，且**没有任何诊断**。
它同时违反详设 §4.2 明写的"任一缺失都在 I/O 前 fail closed"。

**最小修复**：把 `RegisteredStateRuntimePersistence` 改成与它下面的 `RegisteredStateRuntimeSync`
一样的**判别式联合**（`{kind:'field', readField, writeField, stateKey, ...} | {kind:'record', getEntries, applyEntries, ...}`），
回调随之必填，引擎里的 `?.` 与 `?? 'field'` / `?? 'record'` 全部消失。
若判别式联合改动面过大，退而求其次：把三处 `?.` 改成缺失即 `throw`，与 §4.2 的 fail-closed 一致。

**为什么更小方案不足**：只加注释不行 —— 类型仍允许缺失，而消费点仍是静默分支；
只补一条测试也不行 —— 公开 API 造不出这个输入，测不到。**要么让类型排除它，要么让运行期炸。**

**为什么不是 M**：经公开入口证明不可达，今天零影响。

### N-1 · `contracts` 的错误协议至今零消费者，本包是第一个有真实错误条件的包而未使用

`contracts` 导出 `createModuleErrorFactory` / `createAppError` / `isAppError` / `ErrorDefinition` 等一整套；
`contracts` 与 `platform-ports` 的 `src` 里 `new Error(` **各自零命中**；
本包 `supports/sync.ts` 与 `supports/workspace.ts` 共十余处裸 `new Error('[state.sync] ...')`，消息字符串内联。

我**不认为这是本包的缺陷**：这些是构造期的程序员错误，必须炸掉装配，
不跨包、不面向用户、不需要 catalog key 或模板；而 `AppError` 是普通对象不是 `Error` 子类，
抛它反而丢栈。**但它是一个关于 `contracts` 的信号** ——
一个协议在第一个真实机会上没被用，要么它的适用范围该被写清楚（它是给跨边界的运行期/业务错误用的，
不是给构造期程序员错误用的），要么它在 `contracts` 里的位置该被重新审视。
**最小修复**：在 `contracts` 的 README 里加一句适用范围；若 `kernel.base.runtime` 之后仍零消费者，再议去留。

### N-2 · `health.lastFailure` 在恢复后仍粘着

`persistenceEngine.ts:797-803`：`status` 会在 `lastFailure === undefined && dirtyKeys.length === 0` 时回到 `healthy` ✓，
但 `lastFailure: lastFailure ?? this.#health.lastFailure` **永远向前携带**。
⇒ 出现 `status: 'healthy'` 且 `lastFailure` 非空的组合。
按 `if (health.lastFailure)` 判断"是否有问题"的消费者会得到假阳性。
**最小修复**：在类型上写明 `lastFailure` 是历史值、判据是 `status`；或恢复为 healthy 时清掉它。

### N-3 · `persistenceEngine.ts` 1025 行，承担约七项职责

entry 描述符构建 · key 分组 · hydrate · 差量 flush · 迁移 · reset · 队列与 health。
仓内原则明写"保持模块职责明确，避免一个模块承担过多职责"。
我**不主张现在就拆**（持久化算法内部耦合紧，拆碎可能更难读，且"不过度设计"优先），
但三条自然缝在那里：**hydrate / flush+migration / queue+health**。
**最小修复**：先在 README 的「在这个包上迭代时」记一句"本文件已接近拆分阈值，
新增第四类持久化粒度时先拆"，让它成为**已知**而不是慢慢长成的事实。

## 5 · 「所有门与测试通过但包其实没建成」的再搜寻

按 brief 点名的八条逐个推演：

| 掏空对象 | 会红的判据 |
|---|---|
| 删除 sync 自动持久化订阅 | **R-3**（`persistence.test.ts:309` 断言 apply 后换 runtime 可恢复） |
| 删除自动 flush 错误日志 | **会红** —— `persistence.test.ts:335,419` 经 `captured` 数组断言日志内容（我一度以为无断言，`grep "logger\."` 是错的模式，已更正） |
| dirty key 恢复后 health 永久 degraded | **不会发生**，`:797-799` 的条件正确；但 `lastFailure` 粘着见 N-2 |
| blocked 后端被永久停用 | **是刻意的且被记录**：一次有界 rebaseline（`:618-625` 的 `rebaselineAttempted`），README:143-144 写明，H-3 断言持续性、H-4 断言恢复 |
| 队列被前次 rejection 毒化 | **不会**，`:311-321` 的 `.catch(()=>undefined).then(...)` |
| partial diff 被当整份原子 | 类型层即不可能：`createSliceSyncDiff` 返回 `replaceMissing:false` 的 `Extract`，full 走 `createFullSliceSyncPayload`；S-2/S-3 用例 |
| PROD/TEST 的 RTK 检查未按环境生效 | **X-6/X-7**（`:739-760` 三环境真 dispatch `Date` 并断言 `console.error` 有/无） |
| 公开面旁路 | support exact-export 三方 56 相等 + T-5 负夹具钉死 root action creator 不可导入 |

**未发现新的假绿路径。** S-1 是 latent 结构缺陷，不构成当前可达的假绿。

## 6 · 已核 / 未核

**已核（逐代码）**：`state` 全部 19 个 src 文件与 5 个 test 文件；
`tools/terminal-state/check-static.mjs` 与 `check-static.test.mjs`；
`tools/terminal-skeleton/verify.mjs` 的 owner 常量与 marker 断言；
需求、详设、实施计划的对应章节；`terminal-coding-standard.md` 的 `TR-01/03/09/10` 与例外节；
`contracts`/`platform-ports` 的公开面（用于对账与先例比对）；
POC `state-runtime` 的 `store.ts`、`createStateRuntime.ts`、`supports/sync.ts`（用于判断转写取舍）。

**未核**：`verify-static.mjs` 与 `verify.test.mjs` 只核了 state 相关接线位置，未逐行审既有实现；
`project-memory/required-inventory.json` 的修复与索引重建**本轮未核**（brief 列入范围但我未展开，
`ENTRIES=75/KERNEL=6/ROUTED=69` 与 `PROJECT_MEMORY=PASS` 属未验证数字）；
`AGENTS.md`、`PLATFORM-BLUEPRINT.md` 本轮未重开。

**全部动态输出未复跑** —— 按 Dexter 的长期约定我不在本机运行命令。
brief 里的九组数字（typecheck/test/门/verify/反向控制/记忆索引）我核的是**它们所验证的静态事实**
（三方 56 相等、67 用例存在且断言到位、门的规则名与红夹具定向、owner 八元组与 `real.length !== 3`、
`tsconfig` include 覆盖 `test/**`），**不是这些命令的执行结果**。
⚠️ 特别地：**Expo export 的 677 modules 只证明 Metro 对入口可达集合的消费闭包**，
不构成 native、Gradle、设备、adapter 或业务能力的任何证明 —— evidence 与 brief 都是这么写的，正确。

## 7 · 需 Dexter 裁决

**无。** 需求 §11 的五项裁决未见升格或回退；本轮四条 finding 均不涉及产品语义、Journey 或范围。

## 8 · 授权边界

本 `GO` 只表示实施结果可交 Dexter 决定是否作为本包的收口。
不授权批三、不授权 adapter/native、设备、Gradle、Android、DEV、seed、reset、
浏览器 L2、UAT、部署或仓级 normal `scripts/verify`。
静态结论不构成任何运行时、重启、native 或用户可见行为已被证明。
