# TER `kernel.base.state` 详设与实施计划 · 独立 DESIGN review

| 字段 | 值 |
|---|---|
| REVIEW_TARGET | DESIGN（详设 824 行 + 实施计划 321 行） |
| **VERDICT** | **GO** —— 条件：S-1、S-2 在 CP-1 开工前闭合 |
| M / S / N | **0 / 2 / 4** |
| 方法 | 逐代码静态核验；本会话不运行命令 |

⚠️ **口径更正**：评审 prompt 给的两个路径不存在 ——
`platform-ports/src/types/stateStorage.ts` 实为 `storage.ts`；
`newPOSv1/1-kernel/1.2-feature/topology-runtime-v3` 实为 `1.1-base/topology-runtime-v3`。
本轮按真实路径核。

---

## 1 · 方案合理性

**问题对、方案优于更小替代、代价相称。**

三个替代我独立比过：**照搬 POC** 不成立 —— manifest 半提交、`void flush`、
`storage.clear()` 越 namespace、`syncIntent` 与 `sync` 可不一致，这些是 POC 的实证缺陷；
**只建纯 helper**（不做 async runtime）不成立 —— 那样每个下游包各自手写枚举、
提交与失败处理，`TR-04` 的重启保证无处落地；**当前的 async factory** 是三者里唯一
能把"hydrate 完成前 store 不可见"变成类型事实的形态（`Promise<StateRuntime>`）。

**本轮特别认可四处做减法**：manifest 整个删掉改用必填的 `listKeys`+`readMany`；
`latest-wins`/revision/sequence/cursor/session/lastApplied **公开面与源码双清**；
三 scope 轴收到只剩 `workspace`；`writeMany/removeMany/clear` **生产路径不用**——
这一条是把"端口给不了 per-key 承诺"这个事实老实接受，而不是假装有原子性。

**尺寸**：824 行里约 320 行是十组测试与精确类型，即交付物本身；4 CP、10 组测试、
4+1 门对一个承载 `TR-01/03/04/09` 四条硬规则的包是相称的。

## 2 · 独立复算与逐条确认

| 核验项 | 结果 |
|---|---|
| 56 exports | **独立复算 = 56，无重复** |
| brand + WeakMap 不可伪造 | **成立**。`unique symbol` 未导出 ⇒ 外部对象字面量无法写出该键；T-6 同时用 `@ts-expect-error` 与 runtime fixture 双向钉死。⚠️ 前提是本包 `--noEmit` 且 `exports` 直指 `src/index.ts`（与 contracts/platform-ports 一致）；**若将来开启 declaration emit，此模式会因私有名而报错** |
| descriptor 双 discriminated union | **成立**。`persistIntent`/`persistence` 与 `syncIntent`/`sync` 各自成对，四条一致性在类型层即不可构造（T-3），运行期再校验 |
| key grammar | **闭合**。固定 namespace + `/` 分隔 + 全 segment `encodeURIComponent` ⇒ `pos` 不误匹配 `pos2`（X-3 有 `/:%中文` 往返用例）；构造期拒绝六类冲突 |
| 每后端一次 list/read | **成立**，X-4 有定向断言 |
| baseline unknown 写栅栏 | **成立且是本设计最好的一处**：读失败 ⇒ 该后端 blocked ⇒ 后续 flush 不 write/remove（H-4）。没有这道栅栏，一次读失败会让 flush 拿空 cache 去"清理陈旧键"，把真实数据删掉 |
| 逐 key 提交 + 失败继续 + dirty cache | **成立**（P-6、F-3）。且 §6.2 第 7 条明写"没有 timer retry、退避或无后续变化时自动恢复的主张"——与需求的诚实边界一致 |
| `preloadedState` hydrate | **闭合 `TR-01`**：hydrate 不是 action，运行期无外部写 |
| actor-only reset | **闭合**：`getResetActor()` 唯一入口，root action type、creator、dispatch closure 全 package-private（T-5 钉死），不导出 `resetState`/`applySlicePatches`/`createResetAction` |
| 持久层先删成功再 reset 内存 | **成立**（C-2） |
| health 非 slice | **成立**，`TR-09` toolkit 约束满足 |
| 三类 timeout | **成立**（P-7 断言三类预算不互借） |
| sync 无会话账本 | **成立**，S-6 对源码与公开面双扫 |
| workspace 单轴 | **成立**，T-4 钉死 `instanceMode`/`displayMode` 不可传 |
| 四门 + support | **只判机械事实**，各有定向 red，且 ST-4/7/8/9 老实归入测试/review 不伪造成语义门 |
| 计划停机清单 | **无重复漂移**：§5 明写"唯一来源是详设 §13"，只补一条 owner=8 的执行条件 —— 修掉了 platform-ports 那批两份清单会漂移的问题 |
| 开放式措辞 | **零命中**（"按需设计/选择合适/视情况/酌情"全无） |
| 互斥方案残留 | **零**。`writeMany`/manifest/`latest-wins`/三轴的每一处提及都在"删除/禁止/不用"语境 |

🔴 **§5.4 末段值得单独表扬**：它主动指出需求 §9 的 P 表"断言 `writeMany` 入参数量"
与 X 表"`writeMany` 半提交"已被逐 key 设计取代，并明写"不得保留两种互斥实现"。
这正是上一批的阻断项（改了论证不改测试），这次作者自己先堵上了。

---

## 3 · Findings

### S-1 · `getState()` 公开暴露开放索引的 `StateRoot`，与正本例外边界冲突

**CONFIRMED**。事实类别：仓内设计事实 + 规范事实。

**位置**：详设第 388 行 `export interface StateRoot { readonly [sliceName: string]: object | undefined }`；
第 391-392 行 `getStore()` / `getState()`；第 733 行 `StateRoot` 在 56 个公开导出内；
对照第 72 行的横切矩阵。

**事实**：第 72 行声称读侧"**只由 registration 私有 closure 读已声明 slice**"。
但 `getState(): StateRoot` 是公开 API，`StateRoot` 是对 `string` 开放的索引签名 ⇒
任何持有 runtime 的包都可以写 `runtime.getState()[foreignSliceName]` 并**通过类型检查**。

而 `TR-09` 下的例外节（本 cycle 新增）明写边界第 4 条：
**不得导出通用的「写任意 slice」或「读任意 slice」API**。

**可证伪失败条件**：任一下游包用变量键读他包 slice。
`TR-03` 的门只禁"`getState()[` 紧跟字符串字面量"，其反例栏已明写
"把 key 拼进变量再取抓不到，不在防范目标内" ⇒ **类型是唯一剩下的屏障，而它是敞开的。**

**影响面**：不是运行期缺陷，是**边界声明与公开面不一致**。
留着它，下一个 reviewer 会重新撞上同一个矛盾；更糟的是有人据第 72 行以为读侧已受控。

**最小修复（两侧各一句，不改代码结构）**：
① 详设明确承认 —— Redux 的 store 根**结构上不可能隐藏**（`useSelector` 需要它），
   因此 `getState()/getStore()` 暴露的是 Redux 原生根，**读侧的执行机制是 `TR-03` 的门**，
   而不是"只走私有 closure"；把第 72 行改成与公开面一致的表述；
② 正本例外边界第 4 条**收窄为可满足的说法**：禁止的是"为读取具名他包 slice 提供**便捷访问器**"，
   Redux 原生根仍由 `TR-03` 管辖。

**为什么更小方案不足**：只改详设措辞而不动正本，正本上仍留着一条**字面上无法满足**的边界；
只改正本而不动详设，第 72 行的错误声称仍在。两处都要动，各一句。

**为什么不是 M**：`TR-03` 的门仍拦得住最常见的字面量写法，且这是声明与实现的一致性问题，
不产生运行期错误或数据损坏。

### S-2 · blocked 后端没有恢复路径，一次启动期读失败即本进程内永久停用持久化

**CONFIRMED**。事实类别：仓内设计事实 + 可复现推论。

**位置**：详设 §5.2 第 7 步（blocked 的建立）· §6.2 第 4 步（blocked ⇒
`HYDRATION_BASELINE_UNAVAILABLE`，不调用 write/remove）· §6.3（reset 只对
"已能成功 list 的后端"清 block）。

**事实**：`blocked` 只在 hydrate 建立，**只有一条清除路径 —— 一次全部删除成功的 reset**。
flush 路径不重建 baseline，也不重试 `listKeys`。

**可证伪失败条件**：POS 冷启动时存储繁忙，`listKeys` 一次 `timed-out` ⇒
该后端 blocked ⇒ **本进程剩余生命周期内所有写入都不落盘**，
用户整个班次的改动在下次断电后消失。health 是 degraded、日志有记录，
但没有任何机制会再试一次。

⚠️ **附带一层**：blocked 期间若某字段正在 plain→protected 迁移，
新值写进 protected 而**旧的明文副本无法被删除**（该后端不允许 remove）——
明文残留会一直存在到下次成功的 reset。

**影响面**：可用性与安全残留。且这个后果**详设没有任何一句写明**，
§8 也没有用例断言 blocked 的持续性 ⇒ 它现在是一个**未被记录的行为**，不是被接受的取舍。

**最小修复（先做①，②可选）**：
① **把后果写明并测出来**：详设写清"一次启动期 list/read 失败 ⇒ 该后端在本进程内不再持久化，
   直到一次成功的 reset"，并加一条用例断言这个持续性 —— 让它成为**已知且刻意**的行为；
② 若认为该代价不可接受，再加**一次性 re-baseline**：flush 遇到 blocked 后端时
   先尝试一次 `listKeys`+`readMany`，成功则解除 block 并继续，失败则维持原状。
   这条只走 blocked 分支，不改正常路径。

**为什么更小方案不足**：只保留"health degraded"不够 —— 它表达的是"这次失败了"，
表达不了"从此不再尝试"。消费者无法从 health 区分"偶发失败会重试"与"已永久停用"。

**为什么不是 M**：写栅栏本身是对的（它防的是更严重的破坏性写入），
且失败是可见的（health + error log），不是静默。

### N-1 · `valueHash` 不是 hash，名字会误导下游的成本估算

第 313 行：`valueHash` 固定为 `json:<canonical-json>` —— **是完整序列化，不是摘要**。
我核过 POC 的 `createSyncValueHash`（`supports/sync.ts:22-31`）确实就是 `JSON.stringify`，
所以这是**忠实转写**，拒绝引入非安全 32-bit 摘要的理由也成立。

但名字撒谎的后果是具体的：`SyncStateSummary` 看起来像"便宜的对账材料"，
实际大小是 `O(全量数据)`。下游（topology）若据此设计"定期摘要对账"，
会在实现时才发现摘要和全量快照一样贵。
**最小修复**：改名 `valueSerialization`，或在类型上写一句"这是 canonical 序列化，不是摘要，成本等同全量"。

### N-2 · 没有任何用例断言 `subscribePersistenceHealth` 真的会回调

health **刻意不是 slice**（`TR-09`），所以它是失败可见性的**唯一非日志通道**。
但 §8 的 47 条用例里没有一条订阅它 —— F-1 只断言"degraded health"（可由 `getPersistenceHealth()` 读到）。
⇒ 一个**从不触发监听器**的实现能通过全部判据。
**最小修复**：F-1 增一条 —— 订阅后触发一次失败，断言 listener 被调用且收到的 `revision` 已递增。

### N-3 · `field` 的值类型不受 JSON 约束，`record` 的受，且未说明为什么

`StateRuntimePersistenceRecordDescriptor` 有 `TEntryValue extends StateJsonValue`，
而 `StateRuntimePersistenceFieldDescriptor` 对 `TState[TKey]` 无约束。
同一类数据两种保护级别，靠 codec 在运行期兜（X-5）。
我认为**当前做法是对的**（field 指向 owner 既有字段，不该反过来约束 owner 的 state 形状），
但详设没写这个理由。**最小修复**：加一句说明，免得后来者以为是遗漏而去加类型体操。

### N-4 · 需求文档仍写 `writeMany`，详设已取代但需求侧没有指针

详设 §5.4 末段正确地宣告取代，但**需求 §9 的 P/X 组仍是 `writeMany` 措辞**。
只读需求的人会实现批量写。
**最小修复**：需求文档对应两行加一句"已由详设 §5.4 收口为逐 key `write`"。

---

## 4 · 「所有判据通过但包没建成或重启仍错误」的再搜寻

逐个推演可被掏空而不被发现的实现点：

| 掏空对象 | 会红的判据 |
|---|---|
| 差量失效、改回全量重写 | P-4、**P-5（hydrate 后立即 flush 必须 0 写）** |
| cache 在写失败后仍前移 | P-6 |
| 读失败后仍写入 | **H-4**（baseline unknown 不得调用 write/remove） |
| reset 删除失败仍清内存 | C-2 |
| 迁移先删后写 | M-1、M-2 |
| 旧明文删除失败报成功 | M-3 |
| 用 `writeMany` 假装原子 | X-1（断言逐 entry 合法，明确不断言整份原子）+ ST-5 |
| codec 静默把 `NaN` 写成 `null` | X-5 |
| 用 RTK check 冒充 codec | X-6、X-7 |
| registration 被伪造 | T-6（编译期 + 运行期双向） |
| 会话账本回潮 | S-6（源码与公开面双扫） |
| 公开面漂移 | support exact-export |

**新找到一条：S-2 的 blocked 持续性** —— 一个"hydrate 后把所有后端都标 blocked"的实现，
全部判据仍绿（H-4 正是断言 blocked 不写），而**运行期什么都不落盘**。
这不是假设：它就是 S-2 描述的真实分支被放大到极端。
⇒ **S-2 的修复①（加一条持续性用例）同时堵上这条路径。**

其余未发现新的假绿路径。

---

## 5 · 需 Dexter 裁决

**无新增。** 详设 §11 记录的五项需求裁决均已结案，未见升格或回退。
S-1 的正本措辞收窄属于**规范文字的一致性修正**，不改变任何已裁定的边界实质，
我判断不需要单独裁决；若 Dexter 认为改动正本必须逐次授权，请以他为准。

## 6 · 实际打开核过 / 未核

**核过**：两份待评文档全文（详设 §0–14、计划 §0–6 逐节）；
需求正本对应章节；`terminal-coding-standard.md` 的 `TR-01/03/09` 与本 cycle 新增例外节；
`platform-ports/src/types/storage.ts` 与 `result.ts`；
`kernel/base/state/`（现状：仅 `package.json`/`src`/`tsconfig.json`，无 test）；
`tools/terminal-skeleton/verify.mjs` 的 owner 常量与 marker 断言；
POC `state-runtime/src/supports/sync.ts`（`createSyncValueHash` 实现）、
`foundations/store.ts`、`foundations/createStateRuntime.ts`；
POC `topology-runtime-v3/src/foundations/syncRegistry.ts` 与
`runtime-shell-v2/src/foundations/runtimeStateSync.ts`。

**未核**：`AGENTS.md`、`PLATFORM-BLUEPRINT.md`、`terminal-build-order-and-batches.md` 本轮未重开；
`verify-static.mjs` 与 `verify.test.mjs` 只核了计划所述改动的**接线位置**，未逐行审现有实现；
contracts analyzer 的**内部实现**未逐行审（核的是它被具名复用且 contracts 侧规则名/expected 未变）；
Codex 自述的两轮内部评审（R1 2M/1S、R2 1M/2S）我**未采信**，全部结论按 current bytes 独立得出。
**全部动态命令输出均未复跑** —— 本轮为静态 review。

## 7 · 授权边界

本 `GO` 只表示这两份设计材料可交 Dexter 决定是否作为 state 实施输入，
且以 S-1、S-2 闭合为条件。不授权实施、不授权修改 TER 源码或端口、其余 21 包、
adapter/native、设备、仓级 normal verify、DEV、seed、reset、浏览器 L2、UAT 或部署。
静态结论不构成任何运行时、重启、native 或用户可见行为已被证明。
