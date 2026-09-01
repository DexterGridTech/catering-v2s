# TER `kernel.base.runtime` 单元 B 详设与实施计划 · 独立 DESIGN review

| 字段 | 值 |
|---|---|
| REVIEW_TARGET | `DESIGN` |
| 对象 | 792 行 / `sha256 ba399513…`（**复算一致**） |
| **VERDICT** | **GO** —— 条件：S-1、S-2、S-3 在各自 CP 开工前闭合 |
| **M / S / N** | **0 / 3 / 1** |
| 是否阻断进入实施 | **不阻断**。三条 S 都不需要新机制，两条是补一句话、一条是补一个判空分支 |
| 方法 | 逐代码/逐条静态核验；**本会话未运行任何命令** |
| 预审 | Codex 侧 R1/R2 结论**未被引用**；R1 的三处我**独立重核**，结论见 §4 |

---

## 0 · 前置事实复算（不采信文档自述）

| 事实 | 复算结果 |
|---|---|
| A 公开面 | **58**，`RuntimeRoleChangeEffect` **在**、`RuntimeRoleChangeSignal` **不在** ⇒ S-7 按选项 C 落地无误 |
| `tools/terminal-runtime/check-static.mjs` 的 `expectedPublicExports` | **58**，含 `RuntimeRoleChangeEffect` ⇒ 门与源码同步 |
| contracts 当前导出 | **69** ⇒ §6 第三/四组已执行完（我第一轮实施评审时还是 74，这一项现已闭合） |
| `SyncIntent` | `'isolated' \| 'master-to-slave' \| 'slave-to-master'`（`state/src/types/sync.ts:4-7`）⇒ 详设用的两个方向**真实存在** |
| `SyncRecordState<TKey,TValue>` | `Readonly<Partial<Record<TKey, SyncValueEnvelope<TValue>>>>`（`:21-24`）⇒ 与详设 §4.3 及需求 §4.7.2 的 slice 形状**逐字一致** |
| contracts 当前 `CommandRouteContext` | `{workspace?: string; instanceMode?: string}`（`types/command.ts:5-8`）⇒ 两个开放 string、缺 `displayMode`，与需求 §6 第二组的起点描述一致 |
| contracts 当前 `RequestLifecycleStatus` | `'started' \| 'completed' \| 'error'`（`types/request.ts:12`）三态 ⇒ 收窄到五态的起点无误 |

---

## 1 · 方案合理性（先于闭环正确）

### 问题对不对 —— **对**

我从 `TR-01`/`TR-09` 与 POC 事实独立重建了一遍：一次业务动作跨多命令、多 actor、可能跨机，
而 actor 的返回值本身就是后续展示与补偿判断的输入。只返回 `dispatchCommand` 的终值，
UI 与 automation 就只能知道「完成/失败」。详设 §1.1 列的四条后果与我的重建一致，
且**没有把 A 的东西拉回来重做**。

### 方案优不优 —— **C 明显优于其余三个，且四个替代都被真列了**

模板 §1.2 要求「至少三个含被否的」+ 一句「我选了 C 而不是 A/B」。详设列了**四个**并给了那句话。
我独立复核每一条否决理由都站得住：
**A（内存 Map + request 专用跨机快照）** —— 把 request 特殊化，需求 §3.6 已实证 POC 那套要么是死的、要么自我抵消；
**B（单 shared slice 两机共写）** —— 直接破 `TR-09` 单写者，并要引入本批未授权的冲突模型；
**D（只记 journal）** —— journal 是内存诊断通道，UI 无法用 selector 订阅，也不承载中间结果。
**C 的真正优点详设自己说到了点上**：它把跨机冲突从「写侧协议」降成「读侧选择规则」，
写、同步、读三件事全部落在 `state` 已交付的能力上，**不新增第二套同步模型**。

### 代价配不配 —— **配，而且有两处主动收敛值得点名**

1. **只新增一道机器门**（`RUNTIME_RULE_LEDGER_RECORD_SHAPE`），并**明确拒绝**给 selector cache
   建文本形态门，理由写得对：「仅靠 AST/文本识别 `WeakMap` 或 `Map` 既无法证明缓存键确由
   envelope 引用组成，也会把等价的局部实现误判为失败」（§7.2）。这正是仓内「不得用关键词匹配
   把语义伪装成 checker」的正确应用。
2. **公开面只加 5 项**，且把 `RequestExecutionRecord`、`aggregateRequestStatus`、reducer action、
   cleanup command、slice 名、memo cache、role effect factory **全部留在包内**（§4.2），
   理由是「当前没有第二个生产消费者，提前放进 root 只会扩大共享编译面」——
   这与我第一轮给 A 的口径同向。

---

## 2 · 冻结分母覆盖（我先独立重建，再对照）

我从需求 §0-A 两张表 + 契约一逐小节表独立列出 B 的分母，再逐条对照详设：

| 我重建的 B 分母 | 详设落点 | 结果 |
|---|---|---|
| §2.3 要求三（台账带 route 归属） | §4.3 record `workspace` + §4.4 command `displayMode` | ✅ |
| §4.2b ②（单 request 命令数上限） | §4.9.3 | ✅ 且比需求更细，见 §3 第 4 项 |
| §4.8b 表里标 B 的三行 | §4.1（contracts 第二组）· §4.3/§4.4（两级 route 记账）· §4.4（两级 filter） | ✅ 三行齐 |
| §4.7.1 两个单写者 slice + 读侧合并 | §4.9.1 · §4.9.5 | ✅ |
| §4.7.2 的 `RequestExecutionRecord` · slice 形状 · ⑤ · ⑥ · ⑦ | §4.3 · §4.9.1 · §4.9.4 末段 · §4.4 | ✅ **⑦ 逐条核过**：record 四字段、无 `rootCommandId`/`originNodeId`/`sessionId`；`rootCommandIds` 复数由 selector 推导、无根为空数组、按 `startedAt` 再 `commandId` 稳定排序；`startedAt` 语义为「本机这一份」且视图优先本机、降级标 `timeSource:'peer'` —— 与需求第 1577-1601 行**逐字对上** |
| §4.7.2 ① 的「commands 保序 + 跨机 startedAt 归并」半 | §4.4 · §4.9.5 列表排序 | ✅ |
| §4.7.2 ④ 的 `RequestExecutionRecord` 夹具半 | 测试 L-1 | ✅ |
| §4.7.4 业务例子（需求明令也要进 README） | §14 README 第 4 项 | ✅ |
| §4.7.5 第二级 + `RequestExecutionView` | §4.9.4 七条 · §4.4 | ✅ **七条规则与顺序逐条对上**，含「空集靠顺序落到 started」 |
| §4.7.6 全节（0/1/2/3/3b/4/5/6） | §4.9.6 五条 + §4.9.7 + 开篇「必须由 internal cleanup command 驱动」 | ✅ 八项全覆盖；第 6 条的收窄由 §4.9.6 第 5 条 + 测试 E-7 承接 |
| §4.7.7 ②③⑤ | §3 表「写授权」· §4.9.6/E-5 · §4.9.1 + HANDOFF | ✅ |
| §4.7.7 ④（翻转后的时钟后果） | —— | ❌ **零覆盖，见 S-1** |
| contracts 第一组 | §4.1 | ✅ |
| contracts 第二组（**七个落点**） | §4.1 · §4.9.8 · §7.3 · §8.2 | ✅ **七个全覆盖**，含最容易漏的第 7 项（`NonNullable<CommandRouteContext['workspace']>` 与 `WorkspaceKey` **双向两行**夹具，且**归属包必须是 runtime**，理由「contracts 零依赖不得为测试新增到 state 的出边」写对了） |

**单元 A 的东西一件没被拉回来重做**：无新 observation factory、无第二份聚合、
不改 transition 类型、不改 dispatcher 调用点、不改角色 actor。

---

## 3 · 逐项回答评审 prompt 的九个重点

**1 · 两个单写者 slice 是否比三个替代更简单且足够** —— 是，见 §1。

**2 · 58→63 的五项与 contracts 69** —— **合理**。
两个 view 类型是三个 selector 的公开返回类型，不导出就不可命名；
三个 selector 分别对应需求 §4.7.1（普通 selector 订阅）与 §4.7.2 ⑥（两级 route 过滤），
**每一项都有冻结需求直接背书**，不是猜未来。contracts **只改两个既有类型、导出名数不变**，
我对着 checker 的 69 名单核过，两个类型都在名单内 ✅。

**3 · 是否只触碰已登记接点** —— **是**。
emitter 写账（同一函数体追加 dispatch）· `displayMode` 单点赋值 · role effect 注册 ·
dispatch options 只读不改 · `aggregateCommandStatus` 复用。
⚠️ 另有三处 A 侧文件被改：`createCommandDispatcher`（budget 接线）·
`createInternalRuntimeModule`（挂 slice/command/actor/effect）· `createRuntime`（挂 ledger helper、
timer 资源、把 ledger effect append 到最后、给 test-only sync accessor 提供 `StateRuntime`）。
**这三处都是必需且已在 §8.2 显式列出** —— 契约三承诺的是「不必回改**已冻结的 actor**」，
而内部 effect 天然只能在 `createRuntime` 里构造（它需要 ledger writer 与当前 state），
**不构成接点破约**。

**4 · 命令数上限** —— **严格做到了，而且有两处比需求更细**：
guard 位置写死在「command/context 构造之后、写正常 `command.started` 与压 execution stack 之前」；
计数来源是**与 UI 相同的合并 selector 的 `view.commands.length`**（不是只数本机 half，
详设明写「否则副机产生且已同步到本机的子命令不进预算」）；**无独立 count Map**；
首次超限走完整 transition 序列写一条 budget fact 后 **typed reject**，
并明写「不得正常返回 `CommandDispatchResult.status='error'`，否则会把入口拒绝与执行后失败重新合并」
—— 这与 A 对**深度**超限返回 `status:'error'` 的处理**刻意不同**，两者分别对应需求
§4.2b ① 的 typed error 与 ② 的 typed reject，**详设把这个区别说清楚了**。
🔴 **两处我特别认可**：
① 「是否已记录过按**整个合并 request** 的错误 key 搜索，不依赖『最后一条』」——
   这防的是跨机归并顺序变化后重复写，是我没想到的一层；
② 测试 B-1 要求**从预置的已达上限 ledger 开始**，理由是「只靠连续派发会放过 count Map 的错误实现」
   —— 那条用例对「另建 count Map」是**真能打红**的。
⚠️ 一个我核过的细节：A 的 `dispatchInternal` 是 `try{…}finally{releaseCommand}` 且**没有 catch**
（`createCommandDispatcher.ts:299,360-364`），所以 guard 从 try 内抛出时
`releaseCommand` 照常执行、rejection 照常传到调用方 —— 详设写的序列**成立**。

**5 · selector** —— 足够且不过度，**除 S-2 一处**。
两级 route **不互相代替**（§4.4 末段）是需求 §4.7.2 ⑥ 的正确落地：
「我这块屏发起的请求」与「落到我这块屏的命令」是两个集合，
详设明确禁止压成「命中任一 command 就返回完整 view」的存在性过滤 ✅。
`null` 双可见、本机优先、peer 降级、`timeSource` 两级都在 ✅。

**6 · 淘汰有界 + 诚实保留症状** —— **两者都做到**。
§4.9.6 第 3 条是**无条件**删除本机 half ⇒ 存储有界；
§14 README 第 5 项与 §16「对端永久离开后的 UI 症状消失 = `NOT_PROVIDED_BY_THIS_DESIGN`」
与需求 §4.7.6 3b 的 Dexter 裁定 B **口径一致**，没有过度承诺。
第 2 条「已终态必须调用与 UI selector 相同的 merged aggregation」也对上了需求第 3 条的
「判据用合并结果、对象只限本机那一份」✅。

**7 · state 方向校验欠账是否足以支撑单写者表述** —— **足以，且措辞是我见过最准的一种**。
§4.9.1 原文：「runtime 自己的写路径遵守单写者，但无法阻止外部把错误方向的 sync payload
应用到 slice…**不得表述为「同步层已强制单写者」**」，并要求 HANDOFF 保留
`UNVERIFIED_REQUIRES_EVIDENCE`。这是把「我控制得了的」与「我控制不了的」分开写，
而不是用一句「已保证」盖过去。✅

**8 · 验证右尺寸** —— **是**。1 道新机器门覆盖 payload/raw route 入账；
selector cache、单一事实点、request 专用 API 缺失三项明确留人工/focused test 并
**明写不称 machine PASS**（§7.2、测试 T-2、§17.6）。

**9 · R1 三处，我独立重核** ——
① **三个 selector 签名已统一**：全文四处（§4.4、§4.9.5、§17.2、§18）都是
   `selectRequestExecutionCommands(state, requestId, displayMode?)`，**无残留 `view` 签名** ✅；
② **五个 route fixture 全部纳入且断言未弱化** —— 我逐文件打开确认这五处**当前真的会断**：
   `platform-ports/test/public-surface.typecheck.ts:100`（`test`/`single`）·
   `contracts/test/public-surface.typecheck.ts:97`（`store-01`/`primary`）·
   `runtime/test/peerGateway.test.ts:116`（`west`）·
   `roleAndRoute.test.ts:195,201,205`（`west`/`east`）· `visibility.test.ts:102`（`west`）。
   §8.2 五处全列，CP-B1 给了固定映射，并明写「只能换闭集值，**不得削弱继承、整体替换、
   身份相等与 gateway 透传断言**」✅；
③ **分母一致**：§7.2「4 变 5」· §17.6「只新增 1 道」· §17.7「五道 rule gate + support」三处同口径；
   B-01…B-20 我逐号点过**无空号无重号**；§15/§17.7 的证据口径与之一致 ✅。

---

## 4 · findings

### S-1 · 需求 §4.7.7 ④／§4.7.6 第 4 条的「翻转后本机那一份装的是对端时钟」全文零覆盖，而 E-5 把「cleanup 不读 peer 时钟」写成了无条件不变量

**位置**：详设 §4.9.6（淘汰规则 2、3）· 测试 `E-5` · §4.9.7（角色翻转）· §14 README 清单

**仓内事实**：需求第 1923-1927 行写着 ——「**翻转后的「本机那一份」，装的是对端时钟盖的 `updatedAt`**
…⇒ **接受**，但界要写准：**偏差由对端时钟决定、没有上界**…**唯一的硬兜底是 `persistIntent:'never'` + 进程重启**」；
第 1886 行另有 3b 的「**例外：角色翻转后的一个窗口内不成立**」。
我对详设全文搜「对端时钟 / 翻转后 / 偏差 / 无上界」**零命中**（唯一命中的第 31 行是无关的引言）。

**推论链（可证伪）**：MASTER→SLAVE 翻转后，§4.9.7 只清**即将失去写权**的 MASTER half；
本机**新获得写权**的 SLAVE half 里仍是对端写入的记录，其 `updatedAt` 是**对端时钟**盖的。
而 §4.9.6 规则 2/3 用 `now - localEnvelope.updatedAt` 判定，`now` 是本机时钟。
⇒ 翻转后的一个窗口内，淘汰**实际就是在拿本机时间比对端时间戳**：
对端快 40 分钟 ⇒ 这些记录在本机看来「还很新」，`requestRetentionMs` 内不会被删；
对端慢 ⇒ 刚接手的终态记录立刻满足淘汰条件被删。
⇒ 测试 `E-5` 断言的「cleanup 不得读 peer 时钟决定删除」**在这个窗口内为假**，
而详设把它写成了无条件不变量。

**后果**：① 不变量写错，实施者会照着写一条永真断言，**而它在翻转路径上不成立**；
② 需求已接受的一条已知代价在 B 的文档里消失，README 第 5 项只写了 max residence 的存储有界，
没写这条时钟边界。

**最小修复**（不需要新机制，需求已裁定接受）：
① §4.9.6 给规则 2/3 补一句限定：「⚠️ 角色翻转后的一个窗口内，本机新获得写权那份的
`updatedAt` 是对端时钟盖的，偏差**无上界**；接受，硬兜底是 `persistIntent:'never'` + 进程重启」；
② `E-5` 的断言范围收窄成「**未发生角色翻转时**，cleanup 不读镜像 half 的时间」；
③ §14 README 清单增一项。

**为什么更小的替代不足**：只改 README 不够 —— `E-5` 会被实施成一条永真断言，
把这条已知代价掩盖成「已验证不存在」；只改 `E-5` 不够 —— 需求明令「界要写准」，
而写准的地方是 README（用户/下游读得到的那一份）。

**是否需要 Dexter 裁决**：**否**。需求 §4.7.6 第 4 条已裁定「接受、不引入逻辑时钟、不做时基迁移」。

---

### S-2 · selector 记忆化的第一层 WeakMap 键，在「只有镜像 half」时无定义 —— 而那是一等形态

**位置**：详设 §4.9.5 第一个 bullet

**详设原文**：「第一层以**本机 envelope object** 为 key，第二层以镜像 envelope object 或
`NO_ENVELOPE` sentinel object 为 key，第三层按当前 local mode 的有限闭集分桶。
**两侧都缺 envelope 时**直接返回 `null` 且不进 cache。」

**事实**：它处置了「两侧都缺」，**没有处置「本机缺、镜像在」** —— 而这一形态在本设计里是**一等公民**：
测试 `L-3`「只有镜像时**不得**返回 null；`timeSource` 必为 peer」·
§4.9.6 规则 5「本机 half 被清后仍有镜像半，selector 仍返回 `timeSource:'peer'` 的 view」·
测试 `E-3`/`E-7` 全部依赖它；需求 §8【B】用例 ① 也点名「只有一侧有记录」。

**后果（可证伪）**：本机 envelope 为 `undefined`，**不能作为 WeakMap 的键**
⇒ 实施者必须自己发明一条分支。两条可能的发明后果不同：
(a) 第一层用 `localEnvelope ?? NO_LOCAL_SENTINEL` —— 可行且仍有界（第二层由镜像 envelope 提供弱键）；
(b) 该形态**绕过缓存** —— 也正确，但每次 `selectRequestExecutionViews` 枚举都会重算 peer-only 请求，
§4.9.5 承诺的「重算次数与 ledger 内其他 request 数量无关」在 peer-only 集合上不再成立。
**两条都说得通 ⇒ 详设没有把判断收回来**，而 §7.2 已明言这一块不建机器门、只靠 focused test，
测试 `L-6` 又只测「改 A 不重算 B」，覆盖不到这条分支。

**最小修复**：一句话——「第一层键取 `localEnvelope ?? NO_LOCAL_ENVELOPE` sentinel；
sentinel 分支下第二层仍以镜像 envelope 为弱键，故整条 entry 随镜像记录被回收」，
并给 `L-6` 补一条 peer-only 的分片断言。

**为什么更小的替代不足**：不能靠「实施者自然会懂」—— 这是详设**已经精确到三层键**的机制，
精确到这个程度还缺一个分支，读者会当成「刻意不缓存」而选 (b)。

**是否需要 Dexter 裁决**：**否**。

---

### S-3 · owner rule B-19「无 tombstone」对镜像 half 不成立；tombstone envelope 的读侧行为未定义

**位置**：详设 §17.1 B-19 · §4.9.1 · §4.9.5 · §4.9.6

**仓内事实**：`SyncValueEnvelope` 是**判别联合**，含 tombstone 分支
（`state/src/types/sync.ts:9-19`：一支 `{value, updatedAt, tombstone?: never}`，
另一支 `{value?: never, updatedAt, tombstone: …}`）；`createSyncTombstone` 是 **state 的公开导出**
（`state/src/index.ts`）。

**问题**：B-19 写的是「**无 tombstone**：reducer 直接 delete；state full sync `replaceMissing:true` 收敛」
—— 这条只约束**本机写侧**。**镜像 half 不是本机写的**，它的内容来自对端经 `state` 同步而来。
详设 §4.9.5 与 §4.9.6 都直接读 `envelope.value` / `envelope.updatedAt`，**没有一处判别 tombstone 分支**。

**后果（可证伪）**：任一 tombstone envelope 落进两份 slice 中的任意一份时，
`envelope.value` 是 `undefined` ⇒ selector 会用 `undefined` 构造 view；
淘汰会把 tombstone 的 `updatedAt` 当成活记录的时间。
⚠️ **诚实标注证据档位**：本批交付内**没有任何代码写 tombstone**，所以这条在 B 自己的字节里
**当前不可达**；它随 `transport` 落地、或任何一方调用 `createSyncTombstone` 而变为可达。
⇒ 这是**推论 + 尚缺证据的假设**，不是已发生的缺陷。

**最小修复**：两处各加一个判空 —— selector 与 cleanup 在读 envelope 前
「若 `envelope` 不是 value 分支则按**该 half 无此记录**处理」；
并把 B-19 改写成「**本机写侧不产生 tombstone**；镜像 half 的 tombstone 按不存在处理」，
不要写成一条 B 无法保证的全局不变量。

**是否需要 Dexter 裁决**：**否**。

---

### N-1 · §4.9.2 第 2 条把「创建最小 request record 后再推进」称为 fail closed，用词与行为相反

**位置**：详设 §4.9.2 规则 2

原文：「若记录不存在，创建最小 request record 后再推进，保持 lifecycle 对迟到/异常顺序 **fail closed**」。
**创建一条不存在的记录是 fail open**（补全并继续），不是 fail closed（拒绝并终止）。
行为本身合理（丢事实比补事实更糟），但 `fail closed` 在本仓是 `TR-02` 家族的定型词，
误用会让评审顺着这个词放行。建议改成「**补齐后继续，不丢事实**」，并说明为什么不选择拒绝。

---

## 5 · 已核实 / 未核实边界

**仓内事实（本轮逐文件打开）**：A 公开面 58 与门同步 · contracts 69 · `SyncIntent` 三值 ·
`SyncRecordState` 与 `SyncValueEnvelope` 形状 · contracts 两个待改类型的当前形状 ·
五处 route fixture 的**当前真实字面量与行号** · A `dispatchInternal` 的 `try/finally` 无 catch ·
需求 §4.7.2 ⑦ 与 §4.7.6 第 4 条原文 · 详设内部三处分母的一致性 · B-01…B-20 无空号。

**推论（非直接观测）**：S-1 的翻转窗口时钟后果 · S-2 两条发明路径的不同代价 ·
S-3 的可达性依赖未来 `transport`。

**产品判断**：无。三条 S 都不涉及产品/Journey 语义，**无 `DEXTER_DECISION`**。

**`UNVERIFIED_REQUIRES_EVIDENCE`**：本设计能否编译 · 51/52 条既有用例在 route 字面量替换后是否仍绿 ·
contracts optional-union checker 改造后既有四条钉子是否仍 PASS ·
新门的 red mutation 是否只红目标门 · TER-local verify。**本轮未运行任何命令。**

---

## 6 · 结论

**`VERDICT = GO`　`M=0  S=3  N=1`　不阻断进入单元 B 实施。**

这份详设的完成度明显高于同期同类交付：分母覆盖我独立重建后**只找出一处真空白**（S-1）；
需求里最容易漏的两处（§6 第二组的第 7 项 runtime 归属夹具、§4.7.2 ⑦ 的三删一改语义）
**都精确落地**；命令数上限的两处细化（合并计数、按整个 request 搜错误 key）和
测试 B-1 的预置-ledger 证伪法**优于需求原文**；对「不建伪 checker」和「不过度导出」
两处收敛的判断也和仓内标准同向。

三条 S 分别在 CP-B4（S-1）、CP-B2（S-2）、CP-B2（S-3）开工前闭合即可，
**都不需要新机制**：两条补一句话与一条断言范围，一条补一个判别分支。
N-1 顺手改。

**授权边界**：本结论只覆盖「单元 B 详设与实施计划是否可作为后续实施输入」。
**不授权**单元 B 实施、不授权修改 TER 源码/contracts/测试/验证工具、
不授权动态运行、设备、DEV、seed、reset、浏览器 L2、UAT、部署或仓级 normal verify。
是否接受设计并授权实施，由 Dexter 决定。
