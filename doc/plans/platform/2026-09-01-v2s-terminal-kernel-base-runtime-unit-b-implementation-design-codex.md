# V2S TER `kernel.base.runtime` 单元 B 详细设计（Codex）

## 0. 元数据与授权边界

```text
BUSINESS_SOURCE=doc/plans/platform/2026-09-01-v2s-terminal-kernel-base-runtime-requirements-claude.md §0-A, §4.7, §4.8b, §6 第一/二组, §8 B-1/B-2
JOURNEY_REFS=NOT_APPLICABLE：本包是 TER kernel runtime，无用户可见 Journey
IA_REF=NOT_APPLICABLE：本批不改变信息架构、页面、导航或用户可见信息组织
INTERACTION_REF=NOT_APPLICABLE：本批无 UI surface、无交互流程
AUTHORIZED=仅编写单元 B implementation-facing 详细设计与实施计划；不进入实现
NOT_AUTHORIZED=修改 TER 源码、contracts 源码、测试、验证工具、需求正本、评审文件；不运行动态/设备/DEV/seed/reset/browser L2/UAT/deploy；不运行仓级 normal verify
IMPLEMENTATION_AUTHORITY=false
```

本文保留工作草稿形成时的连续节号，但按模板逐项覆盖：模板 §5/§6/§7 分别对应本文 §10/§11/§12；
模板 §8/§9/§9a/§9b/§13b/§14 由本文 §17 的同名小节补齐；模板 §10/§10b 对应 §13；
模板 §11 对应 §7+§15；模板 §12/§13 对应 §16/§9.1。这个映射只解决排版，不改变任一规则的
owning section；DESIGN review 必须按模板行集逐项核，不能因节号不同跳读。

本设计以单元 A 当前实现为前提：runtime 公开面已为 58 项，`RuntimeRoleChangeEffect` 已从包根导出，`RuntimeRoleChangeSignal` 不导出；A 已有唯一 lifecycle emitter、角色 effect 扩展点、完整 dispatch options 和 `displayMode: null` 的单点赋值。单元 B 只在这些已登记接点上接入请求台账，不重新设计 A 的命令、actor、context、peer 或 reset。

## 1. 真实业务目标与方案比较

### 1.1 这一批要解决的结构性问题

POS 终端的一次业务动作不是一条同步函数调用：一个 request 会跨多个 command、多个 actor、可能跨主副机，并且 actor return 的中间结果本身就是后续展示和补偿判断的输入。若 runtime 只把最终 `dispatchCommand` 结果返回给调用方，UI 与 automation 只能知道“完成/失败”，看不到“哪一步还在跑、哪一步失败、哪一步已经产生可用中间结果”。

不做单元 B 会产生四个具体后果：

- 跨机命令只能靠内存回调或专用 request 消息解释，无法复用 `state` 的同步与 selector 订阅。
- 角色翻转后两台机器对同一个 request 的事实来源不清，单写者边界会被专用合并逻辑慢慢侵蚀。
- 长时间运行或 peer 不返回的 request 没有有界驻留规则，store 会被执行历史拖大。
- `displayMode` 与 `workspace` 的两级 route 只能散落在调用栈里，无法被读侧统一过滤与展示。

本批要交付的是“请求台账作为普通 state slice”的第一版：两个单写者 ledger slice、读侧合并 selector、请求级聚合、时效淘汰、角色翻转清旧账、命令数上限，以及 `contracts` 中与请求状态和 route context 相关的两组契约修正。

### 1.2 方案比较

| 方案 | 结果 | 结论 |
|---|---|---|
| A. 照搬当前 POC 的内存 Map + request 专用跨机快照 | 能短期查询 request，但状态不进统一 store，不可重启恢复，不走 state 同步，且会与业务 state 形成第二套同步模型 | 拒绝，因为 request 被错误地特殊化，复杂度比复用 state 更高 |
| B. 单个 ledger slice 由主副机共同写 | 读取最简单，但同一 requestId 下两台机器会竞争写同一条记录，需要冲突解决、latest-wins 或双向合并协议 | 拒绝，因为它破坏 TR-09 单写者，并为本批引入未授权冲突模型 |
| C. 两个单写者 slice + 普通 state sync + 读侧合并 selector | 每台机器只写自己当前角色那份，另一份由同步镜像；合并与聚合都是纯读侧函数，能复用 state 的 record 同步 | 采用 |
| D. 只记录 journal，不建 ledger slice | 实现最少，但 journal 是内存诊断通道，不可由 UI 用 selector 订阅，也不承载中间结果视图 | 拒绝，因为它解决的是调试，不是业务读取 |

我选了 C 而不是 A/B/D，因为 request 本质上是运行时状态事实，不需要专用传输模型；两份单写者 slice 让写入、同步、读取都落在已交付的 state 能力上，同时把跨机冲突降成读侧选择规则。

## 2. CP 总览

| CP | 主题 | owner | 主要输出 | 依赖 |
|---|---|---|---|---|
| CP-B0 | 冻结前置与 A/B 接点复核 | Codex | 当前 A 五个接点、contracts/state API、需求 B 分母的回读记录 | A 已收口字节 |
| CP-B1 | contracts 第一/二组 | Codex | `RequestLifecycleStatus` 五态；`CommandRouteContext` 三闭集字段；contracts 门与类型夹具 | CP-B0 |
| CP-B2 | ledger 类型、slice、selector 与聚合 | Codex | 三层 record、两个 ledger slice、`aggregateRequestStatus`、分片记忆化 selector、route filter | CP-B1 |
| CP-B3 | lifecycle 写账与 request 命令数上限 | Codex | emitter 写 ledger；`displayMode` 单点赋值；命令数上限拒绝与 budget record | CP-B2 |
| CP-B4 | 淘汰、角色 effect、README/HANDOFF、验证接线 | Codex | 内部 cleanup command、角色翻转清旧账、README 台账章节、B 静态门与 TER-local 证据 | CP-B3 |

每个 CP 的 focused proof 完成后，进入下一个 CP 前必须按 AGENTS.md 由 fresh 独立子 agent 做三维证伪式对账。全部 CP 完成后、整体测试前，再做一次全范围对账。对账维度为需求文档、当前详设与项目记忆/规范正本。

## 3. 横切机制对照表

| 机制 | ① 用哪个现成能力/规范 | ② 如何验证 | ③ 无现成时必须符合什么形态 | ④ 本批适用全集 |
|---|---|---|---|---|
| 读侧节点授权 | `state` 的普通 selector 读取；`doc/platform/terminal-coding-standard.md` TR-03 | focused test：selector 只读 `StateRoot` 中两份 ledger slice，不导出 `queryRequest/subscribeRequest` | 读侧只做纯函数合并，不发命令、不写 store | `selectRequestExecutionView`、`selectRequestExecutionViews` |
| 写授权与 grant 复核 | TR-01；runtime 在 `createLifecycleEmitter` 处实现派发事实 | review + test：执行事实只在 emitter 写 ledger；淘汰走 internal command actor | ledger 执行事实写入是正本例外，不能扩到业务 slice；淘汰不是执行事实，必须走 command | lifecycle ledger 写入、cleanup command、role effect 清账 |
| 跨 owner 写与事务 | N/A：本包无后端 owner、DB 或事务 | N/A | N/A | 无 |
| 集合形态与分页 | state `SyncRecordState`；ledger key = requestId | test：新增、合并、淘汰均按 requestId 操作；selector 按 requestId 分片记忆化 | 不引入分页，本地窗口靠 retention/residence 有界 | 两个 ledger slice 的 record 集合 |
| 缓存失效 / 改完刷新什么 | Redux selector + state runtime dispatch | test：ledger 写入后 selector 返回新 view；其他 request 的 memo 不重算 | 只按 requestId 分片缓存，不建全表缓存 | 单 request selector、列表 selector |
| RTK 数据读取与加载判定 | N/A：本包不是前端 RTK Query | N/A | N/A | 无 |
| 同一事实只有一个住址 | A `createLifecycleEmitter` 单一事实产生点 | review：`CommandExecutionObservation` 与 ledger 写入来自同一对象；不得另建 observation factory | B 只追加 dispatch，不复制构造逻辑 | command/actor lifecycle fact |
| 失败可见且原因不得改写 | contracts `AppError`/`LedgerError`；runtime `aggregateCommandStatus` | test：budget exceeded、peer missing、actor error 都可由 selector 看到 key/code/status | request 状态只由聚合算，不写派生 status | request view、command view、actor records |
| owner 错误到 HTTP 的映射与注册处 | N/A：无 HTTP | N/A | N/A | 无 |
| 幂等键构成与重放语义 | README 约定：订阅里发命令自带幂等判据 | review：不新增跨 request 环路探测器 | 运行时只限制同 request 深度/数量，不替业务定义幂等 | 下游约定，不是本批代码能力 |
| 该用生成物的地方不得手搓字符串 | 本包无 generated API；TER moduleName/command factory | static：command names 来自 `defineCommand`，slice name 固定常量 | ledger slice 名必须以 moduleName 常量派生或同文件 literal exact | 两个 ledger slice、cleanup command |
| 日志落点与脱敏字段 | AGENTS.md 日志脱敏；platform-ports logger | focused test：cleanup/budget failure 只记录 key/status，不记录 payload/result/raw routeContext | ledger 保存中间结果，日志不保存中间结果 | cleanup、budget、role clear failure |
| 迁移回填与可逆性 | N/A：ledger `persistIntent:'never'`，contracts 类型变更无数据迁移 | N/A | N/A | 无持久化迁移 |
| 前端共享行为 | N/A：无 UI | N/A | N/A | 无 |
| 候选/下拉数据源 | N/A | N/A | N/A | 无 |
| 编码与名称呈现 | TR-10 README 中文说明 | review：README 写明中英文枚举含义与 T1/T2/T3 | 状态名不本地化，UI 后续决定呈现 | README、HANDOFF |
| 会同时坏的东西是否已声明为原子组 | 需求 §0-A 五个接点；本设计 CP-B3/B4 | proof：displayMode 赋值、ledger write、role clear 三项分别有测试 | 任何触及 A 接点的改动必须同 CP 验证，不能散修 | 五个 A/B 接点、contracts 两组 |

## 4. 每个 CP 的门控与精确实现形状

### 4.1 contracts 变更

`@catering-v2s/kernel-base-contracts` 不新增导出名，仍为 69 项，但修改两个既有导出。

`RequestLifecycleStatus` 改为五态：

```ts
export type RequestLifecycleStatus =
  | 'started'
  | 'completed'
  | 'error'
  | 'partial-failed'
  | 'timed-out'
```

`CommandLifecycleStatus` 六态不动。六态表示历史 request snapshot 里的单条命令进度；五态 request status 表示读侧聚合结果。不得合并。

`CommandRouteContext` 改为闭集可选字段：

```ts
export interface CommandRouteContext {
  readonly workspace?: 'MAIN' | 'BRANCH'
  readonly instanceMode?: 'MASTER' | 'SLAVE'
  readonly displayMode?: 'PRIMARY' | 'SECONDARY'
}
```

注释必须保留“local-only / crossing wire still requires dedicated review”的事实边界。收窄类型不等于运行期可安全解码跨版本未知枚举值。

### 4.2 runtime 新增公开面

单元 B 后 runtime 包根 exact exports 从 58 增至 63。只新增 5 项：

| 组 | 导出名 | 当前/已授权消费者 |
|---|---|---|
| request view types | `RequestExecutionCommandView`, `RequestExecutionView` | 两个普通 selector 的返回类型；需求 §4.7.5 明令 UI/automation 读取完整过程 |
| request selectors | `selectRequestExecutionView`, `selectRequestExecutionViews`, `selectRequestExecutionCommands` | runtime 自身淘汰 actor复用单 request selector；后续 UI/automation 按需求 §4.7.1 只走普通 selector |

`RequestExecutionRecord`、`aggregateRequestStatus`、reducer action、cleanup command、ledger slice state、
memo cache、role clear effect factory、两个 slice 名都保持包内。前两者是 owner 的存储形状与纯计算实现，
当前没有第二个生产消费者；提前把它们放进 root 只会扩大共享编译面。slice 名可在 README 说明，
但不得作为写入 API 导出。

### 4.3 ledger 三层事实

`ActorExecutionRecord` 与 `CommandExecutionObservation` 复用单元 A 已导出的类型，不重建。

新增 `RequestExecutionRecord`：

```ts
export type RequestExecutionRecord = Readonly<{
  requestId: RequestId
  workspace: 'MAIN' | 'BRANCH' | null
  startedAt: TimestampMs
  commands: readonly CommandExecutionObservation[]
}>
```

该类型必须用 `type`，不得用 `interface`；不得有 `?` 可选属性；`null` 用于缺省值。它必须可赋给 `StateJsonValue`，以满足 `SyncValueEnvelope<RequestExecutionRecord>`。

两个 ledger slice 内部 state 形态：

```ts
type RuntimeRequestLedgerState =
  SyncRecordState<string, RequestExecutionRecord>
```

两个 slice 名固定：

- `kernel.base.runtime.request-ledger.MASTER`
- `kernel.base.runtime.request-ledger.SLAVE`

MASTER slice 的 `syncIntent:'master-to-slave'`；SLAVE slice 的 `syncIntent:'slave-to-master'`；两者均 `persistIntent:'never'`，无 persistence descriptor。

### 4.4 读侧 view

```ts
export type RequestExecutionCommandView = Readonly<{
  commandId: CommandId
  commandName: string
  parentCommandId: CommandId | null
  displayMode: 'PRIMARY' | 'SECONDARY' | null
  timeSource: 'local' | 'peer'
  status: CommandAggregateStatus
  observations: readonly Readonly<CommandExecutionObservation & {
    source: 'local' | 'peer'
  }>[]
  results: readonly StateJsonValue[]
  errors: readonly LedgerError[]
}>

export type RequestExecutionView = Readonly<{
  requestId: RequestId
  status: RequestLifecycleStatus
  rootCommandIds: readonly CommandId[]
  workspace: 'MAIN' | 'BRANCH' | null
  startedAt: TimestampMs
  updatedAt: TimestampMs
  timeSource: 'local' | 'peer'
  commands: readonly RequestExecutionCommandView[]
}>

```

`results` 与 `errors` 是从 `observations[].actorResults` 拍平出来的便利视图，不是新事实；不得只保留最后一个、不得只保留成功项、不得改写错误原因。

`rootCommandIds` 从合并后按 `startedAt`、再按 `commandId` 稳定排序的命令中，取全部
`parentCommandId === null` 的命令；没有根命令时为空数组。若调用方复用同一 requestId 做多次根派发，
所有根命令事实必须完整保留在 `rootCommandIds` 与 `commands`，不得压成单值字段。

三个普通 selector 的精确职责不得合并成一个含糊的 filter：

- `selectRequestExecutionView(state, requestId)` 返回 `RequestExecutionView | null`；
- `selectRequestExecutionViews(state, workspace?)` 过滤**请求级** workspace，返回完整 view；
  `workspace` 省略时不过滤，view 的 `workspace === null` 对 `MAIN` 与 `BRANCH` 都可见；
- `selectRequestExecutionCommands(state, requestId, displayMode?)` 先复用单 request selector，再过滤
  **命令级** displayMode；request 不存在时返回空数组；
  `displayMode` 省略时返回全部，command 的 `displayMode === null` 对两块屏都可见。

两级 route 不互相代替：workspace selector 不裁剪命令，display selector 不改变请求状态或 workspace。
这样“我这块屏发起的请求”与“落到我这块屏的命令”分别得到正确集合，而不是只做存在性过滤。

### 4.9 运行机制

#### 4.9.1 两个单写者 slice

运行时当前角色由 A 的 `selectRuntimeInstanceMode(state)` 得出。本机拥有写权的 ledger slice 按当前角色选择：

| 当前角色 | 本机写 | 镜像读 |
|---|---|---|
| MASTER | MASTER ledger | SLAVE ledger |
| SLAVE | SLAVE ledger | MASTER ledger |

每个 requestId 在每份 slice 中至多一个 `SyncValueEnvelope<RequestExecutionRecord>`。ledger 本机 reducer
只写 live value envelope 或直接删除 key，不产生 tombstone；镜像那份由对端淘汰后经
`replaceMissing:true` 的全量同步收敛。state owner 的 `applySliceSyncDiff` 会在调用 Unit B 的
`applyEntries` 前把 tombstone 消费为 key 删除，正常同步链不会把 tombstone 存进 ledger slice。

但 `SyncRecordState` 的静态类型仍包含 tombstone 分支，因此 Unit B 必须有且只有一处包内收窄边界：
`features/slices/requestLedger.ts` 提供不从包根导出的 `readLiveRequestEnvelope`，检查 discriminant，
value 分支返回 live envelope，tombstone 或缺 key 均返回 `undefined`。selector 与 cleanup 只能复用该
helper，不得各自直接读 `envelope.value` 或重复解释 tombstone。这样既保持 state owner 的删除语义，
也让手工构造的广义 `SyncRecordState` fail closed 成“该 half 无此记录”。

本批不修改 `state.applyAuthoritativeSync` 的方向校验缺口。该缺口登记为阻塞“不变量已被同步层强制”的跨包欠账：runtime 自己的写路径遵守单写者，但无法阻止外部把错误方向的 sync payload 应用到 slice。实施记录和 HANDOFF 必须保留 `UNVERIFIED_REQUIRES_EVIDENCE`，不得表述为“同步层已强制单写者”。

#### 4.9.2 lifecycle 写账

B 只在 A 的 `createLifecycleEmitter.emitLifecycle` 中追加 ledger 写入，不改调用点，不新建 observation factory。写入规则：

1. `command.started`：若 `requestId !== null`，在当前角色 slice 里创建或更新该 request；若该 request 不存在，`startedAt` 取当前 command 的 startedAt，`workspace` 取 `routeContext?.workspace ?? null`。新增 command observation，`displayMode` 由 A 的单点表达式改为 `routeContext?.displayMode ?? null`。
2. `actor.running/completed/error/timed-out`：只推进 A accumulator 已持有的同一 command observation。
   若该 observation 存在、但当前角色 ledger 因角色翻转清账或 max-residence 淘汰而缺少对应
   request/command，则以 lifecycle context 与该 observation 补建从当前时点可证实的最小记录后继续，
   不伪造已经丢失的前序事实；若 A accumulator 本身没有 observation，保持 A 既有异常拒绝/typed
   error，不得补建。这是有界的事实保全路径，不称 `fail closed` 或 `fail open`。
3. `command.completed`：推进同一个 command observation 的 `completedAt`，不重建 observation。
4. `actor.late-*`、reset ignored、role change journal-only transition：不写 ledger。
5. `command.depth-rejected`：若有 requestId，写一条终结的 command observation，其 actorResults 含 depth rejected record；若无 requestId，只进 journal。

ledger 写入必须发生在 `releaseCommand(commandId)` 之前，使用 A accumulator 中同一份 observation 对象。若 ledger dispatch 失败，dispatcher 把该命令收敛为 typed `error`，并写脱敏日志；不得让台账失败被吞成 completed。

#### 4.9.3 request 命令数上限

单 request 命令数上限在 B 消费 `limits.maxCommandsPerRequest`，计数来源只能是 ledger 中该 request 的 `commands.length`。不得新增 `requestId → count` 表。

在 `command.started` 写账前，通过与 UI 相同的合并 selector 读取当前本机**已经知道的**
`view.commands.length`。不得只数本机 half，否则副机产生且已同步到本机的子命令不进预算；
也不得宣称这是全局强一致计数，尚未同步到本机的远端事实天然不可见。

这里的“拒绝新派发”沿用需求 §4.2b 对 `typed reject` 的定义：不启动业务 actor、不调用 peer
gateway；首次超限先经 lifecycle emitter 写一条已终结的 budget observation，再以现有
`AppError` typed rejection 拒绝入口 Promise。不得正常返回
`CommandDispatchResult.status='error'`，否则会把“入口拒绝”与“命令执行后失败”重新合并。

接线位置写死：`dispatchInternal` 已完成 command/context 构造之后、写正常
`command.started` 与压 execution stack 之前执行 budget guard。首次超限仍使用既有 transition
序列 `command.started → actor.running → actor.error → command.completed → releaseCommand`，
synthetic actorKey 为 budget key；随后抛出由同一 `LedgerError` 投影来源生成的 `AppError`。
该 rejection 必须位于任何“把 actor 失败收敛成 CommandDispatchResult”的 catch 之外，不能被再吞回正常返回。

- 若未达上限，正常写入。
- 若已达上限且整个合并 request 还没有 budget observation，写一条已终结的 budget observation，随后 typed reject。
- 若任一 observation 已含 `LedgerError.key === 'kernel.base.runtime.request_budget_exceeded'`，直接返回同类 typed rejection，不再写台账。
- budget observation 的 synthetic actorKey 固定为 `kernel.base.runtime.request-budget`，`LedgerError.key='kernel.base.runtime.request_budget_exceeded'`，`result:null`，`completedAt` 为当前时间。
- budget observation 使用本次被拒绝派发的 `commandId`；是否已记录过按整个合并 request 的错误 key
  搜索，不依赖“最后一条”，避免跨机归并顺序变化后重复写。

该规则保证“台账不再增长”，不保证 request 立即终态。父 command 仍可能 running，最终由 actor timeout/完成收敛。

测试不得只靠连续派发把计数推到上限；那会放过“ledger 之外另建 count Map”的错误实现。必须通过内部 state fixture 或真实 state full-sync 接缝预置一个已达上限的 request ledger，然后对同一 `requestId` 做首次派发并立即被 budget observation 拒绝。独立 count Map 在该路径上为空，会被稳定打红。

#### 4.9.4 请求聚合

包内 `aggregateRequestStatus(commands)` 复用 A 的 `aggregateCommandStatus`，按有序规则短路：

0. 任一命令聚合结果为 `running` → `started`
1. 命令为空 → `started`
2. 有命令 `partial-failed` → `partial-failed`
3. 有失败（`error` 或 `timed-out`）且同时有 `completed` → `partial-failed`
4. 全部失败且全部为 `timed-out` → `timed-out`
5. 有失败的其余情形 → `error`
6. 全部 `completed` → `completed`

不得改写为并列布尔表达式；空集靠顺序落到 `started`。

同一 `commandId` 两侧都有 observation 时，状态以本机拥有写权那份为准；镜像 observation 保留在 `observations` 供诊断，但不参与 status 判定。本机无该 commandId 时，才用 peer observation 算状态。

Dexter 2026-09-01 的单边裁定固定为 selector 的首个分支：

1. local/peer 两份 request envelope 都缺失：返回 `null`；
2. 恰好一份存在：`commands`、命令/请求两级状态、`rootCommandIds`、`workspace`、
   `startedAt` 与 `updatedAt` 全部只按该边事实计算；缺失边不得被解读为
   「还在等待」，不补造 observation，不从上一次 memo 结果带入该边事实；
3. 两份都存在：才做双边 union，并按上段的 same-command local precedence 裁决冲突。

这条不是「单边降级等另一边」，而是「已知事实就是当前全部输入」。peer-only 时
`timeSource:'peer'`；local-only 时 `timeSource:'local'`。

#### 4.9.5 合并 selector 与记忆化

selector 输入必须按 requestId 分片：当前角色 slice 的该 request envelope、镜像 slice 的该 request envelope、当前 instanceMode。单次 ledger 写入触发的重算次数必须与 ledger 内其他 request 数量无关。

实现形态：

- 内部 `createRequestExecutionSelectorCache()` 不得持有永久性的 `Map<string, memoEntry>`，否则 request
  被淘汰后 cache 仍按 requestId 无界增长。实现使用 envelope 引用驱动的 WeakMap 组合缓存：
  第一层 key 固定取 `localEnvelope ?? NO_LOCAL_ENVELOPE`；第二层 key 固定取
  `peerEnvelope ?? NO_PEER_ENVELOPE`；第三层按当前 local mode 的有限闭集分桶。两个 sentinel 都是
  module-level 冻结单例。local 缺、peer 有时，第一层只永久保留一个共享 WeakMap 容器，request-specific
  entry 仍以真实 peer envelope 为第二层弱键，peer envelope 失去外部强引用后可回收；local 有、peer 缺
  时则由第一层 local 弱键控制整支生命周期。两侧都缺 envelope 时直接返回 `null` 且不进 cache。
- `selectRequestExecutionView(state, requestId)` 是公开纯函数，使用模块级 WeakMap cache；只要两个 envelope 引用和当前 local mode 未变，就返回同一 view 引用。ledger 删除后 envelope 引用不再由 selector cache 强持有，可随 Redux state 替换被回收。
- `selectRequestExecutionViews(state, workspace?)` 只枚举两份 slice 的 requestId 并调用单 request
  selector；列表级排序按 view `updatedAt` 降序，跨设备先后不保证。
- `selectRequestExecutionCommands(state, requestId, displayMode?)` 复用缓存后的 command view，只过滤不重算聚合。
- `observations` 为增加 `source` 创建一次浅包装并按 observation 引用缓存；其
  `actorResults`、`result`、`error` 仍透传原引用，不深拷贝事实。

`startedAt`/`updatedAt`/request `workspace` 优先本机那份；本机没有该 request 时取镜像并标 `timeSource:'peer'`。command `displayMode` 同理优先本机 observation；本机没有时取镜像；两侧都为 `null` 则为 `null`。

#### 4.9.6 淘汰

淘汰必须由 internal cleanup command 驱动，不得在 reducer 中顺手清，也不得从定时器裸 dispatch。

内部模块新增 `cleanupRequestLedgerCommand` 与 actor：

- `visibility:'internal'`
- `allowNoActor:false`
- payload 固定为 `{}`；actor 内调用 contracts 的 `nowTimestampMs()`。测试用 Vitest 假时钟做精确值
  断言，不为测试向生产命令增加第二种 payload 形状。该命令不从包根导出。
- actor 读取当前 state，按当前角色只清本机拥有写权的 ledger slice。

淘汰规则：

1. 只作用本机拥有写权 slice。
2. 已终态 request 且 `now - localEnvelope.updatedAt > requestRetentionMs`：删除。这里的“已终态”必须调用与 UI selector 相同的 merged aggregation；若本机 half 已 terminal 但镜像 half 仍 running，则视为未终态，不能按 retention 删除本机 half。
3. 无论是否终态，`now - localEnvelope.updatedAt > requestMaxResidenceMs`：删除。
4. running request 未超过 max residence：保留。
5. 只含镜像半的 request 不由本机清；如果本机半被清后仍有镜像半，selector 仍返回 `timeSource:'peer'` 的 view。

规则 2、3 中的 `localEnvelope` 表示“当前角色拥有写权的 half”，不等于“时间戳一定由本机产生”。
未发生角色翻转时，它由本机时钟盖章；角色翻转后的一个窗口内，新获得写权的 half 是翻转前的镜像，
其中既有记录携带对端 `updatedAt`。此时本机 `now` 与对端时间戳的偏差无上界：对端慢可能让刚接手的
终态记录立刻淘汰，对端快可能延迟 retention/max-residence 淘汰。该代价按需求明确接受，不引入逻辑
时钟或时基迁移；唯一硬兜底是 `persistIntent:'never'` 加进程重启。翻转后由本机新写的记录重新使用
本机时钟，不能把整个 half 永久描述为“对端时间”。

定时器在 runtime started 后注册，周期取 `requestRetentionMs`，但不保证准点；每次 tick 派发 cleanup command，已有 cleanup running 时跳过本次 tick。releaseRuntimeForTest 必须释放该 timer。

`requestMaxResidenceMs` 已由 A 的 `resolveLimits` 校验：至少四倍 retention，且大于 `maxCommandDepth * maxRegisteredCommandTimeoutMs`。B 不新增第二个配置项。

#### 4.9.7 角色翻转清旧账

B 通过已公开的 `RuntimeRoleChangeEffect` 注册一项内部 effect，不改 `setRuntimeInstanceModeActor`：

1. effect 在角色字段写入前执行，此时本机仍是旧角色 ledger 的合法写者。
2. `createRuntime` 先按 input module 顺序收集全部外部 effect，再把内部 ledger cleanup effect
   append 为最终数组的最后一项，并将该数组交给 `createInternalRuntimeModule`。所有外部 effect
   成功后，才用一次同步 dispatch 清空即将失去写权的 ledger slice；MASTER→SLAVE 清 MASTER，
   SLAVE→MASTER 清 SLAVE。不得依赖 module topology 排序暗示 effect 顺序。
3. 任一前置 effect 失败时，ledger 不得被清；ledger cleanup 自身失败时抛出，使角色 actor error，角色字段不变。
4. 该清空会删除切换命令自己在旧 slice 的前半段记录；后半段落入新 slice，是已知有界半条记录，靠淘汰清理。

角色翻转不迁移新获得写权 half 中既有 envelope 的时基；§4.9.6 的翻转窗口例外同时适用于 retention、
max residence 与 view 排序。peer-only view 可以按 peer `updatedAt` 排序，但必须标
`timeSource:'peer'`，且不承诺跨机先后。

角色切换的业务留痕只在内存 journal，重启后不存在。不得把 journal 改成持久化，也不得让 ledger 承诺跨重启审计。

#### 4.9.8 contracts closed-union checker

`tools/terminal-contracts/check-static.mjs` 的 `runClosedLiteralUnions` 必须先支持可选属性：读取 `CommandRouteContext.workspace?` 等属性类型后，若属性 symbol 带 optional flag，则从 union members 中剥掉 `undefined`，再要求剩余成员全部是 string literal。不得把 `string` 也放过。

红夹具：把 `workspace?: 'MAIN' | 'BRANCH'` 改成 `workspace?: string` 必须只红 `closed-literal-unions`；把它改成必填闭集仍应 PASS，证明剥离只针对 optional undefined。

runtime 的类型夹具另以两条赋值钉住
`NonNullable<CommandRouteContext['workspace']>` 与 state `WorkspaceKey` 双向一致；夹具只能放 runtime
test，因为 contracts 零依赖且不得为测试新增到 state 的依赖出边。

### 4.10 每个 CP 的门控

#### CP-B0：冻结前置复核

- 可证伪失败条件：A 当前源码不再满足五个接点，或 contracts/state API 与设计假设不一致。
- 不变量：不修改任何源码；只形成核验记录。
- FORBID：用前一轮 review 摘要替代当前字节。
- 比例验证：`rg/sed` 只读复核 A `createLifecycleEmitter`、`createCommandDispatcher`、`createRuntime`、contracts route/request types、state sync APIs。
- 完成信号：记录五个接点均存在，或列出停机项。
- RECALL：需求 §0-A、§4.7、§4.8b、§6；A 设计 §5.6、§5.10、§7.2、§10.2。

#### CP-B1：contracts 第一/二组

- 可证伪失败条件：五态状态或三字段 route 任一未被 typecheck/closed-literal 门钉住。
- 不变量：contracts export 名数量保持 69；不新增 runtime 依赖到 contracts。
- FORBID：把注释改成“可安全跨线”；在 contracts test import state。
- 比例验证：contracts typecheck、contracts static model/real；platform-ports public fixture 修复后 typecheck。
- 完成信号：`TERMINAL_CONTRACTS_STATIC=PASS`；非法 request status、非法 route 三字段均 `@ts-expect-error` 生效。
- RECALL：需求 §6 第一组、第二组。

#### CP-B2：ledger 类型、slice、selector

- 可证伪失败条件：record 不能赋给 `StateJsonValue`，selector 状态不复用 `aggregateCommandStatus`，或 route filter 只做存在性不保留完整 view。
- 不变量：两个 slice 是 owner runtime 内部 slice；`persistIntent:'never'`；同步方向一主一副。
- FORBID：新增 request 专用订阅 API、存 payload、存完整 routeContext、存派生 status。
- 比例验证：类型夹具 + selector focused tests。
- 完成信号：runtime 公开面 63 exact；两个 ledger slice descriptor 与 state sync descriptor 均可被 createRuntime 装配。
- RECALL：需求 §4.7.1、§4.7.2、§4.7.5。

#### CP-B3：lifecycle 写账与命令数上限

- 可证伪失败条件：ledger observation 由第二个 factory 构造；`displayMode` 不在 A 的单点表达式赋值；命令数上限靠独立 Map 计数。
- 不变量：ledger 写入在 releaseCommand 前；budget 超限必须 typed reject，普通执行失败不得返回
  completed；command/actor journal 与 ledger 同源。
- FORBID：改 transition 类型、改 dispatcher 调用点、改 actor context/public API。
- 比例验证：真实 runtime 注册测试模块，派发本地/peer/子命令，断言 selector 读到完整过程；超限 test 断言只写一条 budget fact。
- 完成信号：本机和 peer observation 合并可见；同 commandId 冲突以本机状态为准。
- RECALL：需求 §0-A 契约二/触点、§4.2b②、§4.7.3、§4.7.7②。

#### CP-B4：淘汰、角色 effect、README/HANDOFF 与验证

- 可证伪失败条件：淘汰裸 dispatch；镜像 half 被本机删除；角色字段先写再清账；README 把 ledger 说成持久审计。
- 不变量：cleanup command internal；timer 由 releaseRuntimeForTest 释放；角色清账失败阻止角色变更。
- FORBID：修改 state 包方向校验；引入逻辑时钟、由 runtime 生成 tombstone、重试/补偿。
- 比例验证：cleanup focused tests、role flip focused tests、README/HANDOFF review、TER-local verify。
- 完成信号：runtime tests 新分母 PASS；B 静态门 red/green；TER `verify:static` 与 `verify` PASS。
- RECALL：需求 §4.7.6、§4.7.7③④⑤、§8 共用、TR-10。

## 7. 测试与机器门

### 7.1 测试用例矩阵

| 组 | 用例 | 正断言 | 反断言 / 证伪缺陷 |
|---|---|---|---|
| C-1 | contracts 五态 | 五个 `RequestLifecycleStatus` 合法 | 非法状态 `@ts-expect-error`；六态 command status 不可互赋 |
| C-2 | route 三闭集 | 三字段合法值通过 | `workspace:'store-01'`、`instanceMode:'primary'`、`displayMode:'LEFT'` 编译失败 |
| C-3 | optional union checker | 可选闭集 PASS | `workspace?: string` 只红 closed-literal；必填闭集 PASS |
| L-1 | record JSON 类型 | `RequestExecutionRecord` 可赋给 `StateJsonValue` | 改为 interface 或加可选属性触发 type fixture |
| L-2 | 两个 slice descriptor | MASTER/SLAVE 名称、syncIntent、persistIntent 精确 | 任一方向写反或 persist 非 never 失败 |
| L-3 | selector 单侧记录 | local-only 与 peer-only 各构造一组独有 command/status/result/error/root/route/time 事实，view 的状态与所有字段只由存在的该边计算 | 不得等待缺失边而强制 `started`，不得补造 observation 或泄漏前一次 cache 中已删除边的事实；peer-only 不得返回 null 且 `timeSource` 必为 peer，local-only 必为 local |
| L-4 | 双侧合并 | 同 commandId 两侧 observation 都保留 | 状态必须按本机 observation，不能被 peer completed 覆盖本机 timeout |
| L-4b | 根命令推导 | peer-only 半没有根时 `rootCommandIds:[]`；合并 local 根后包含该根；同 requestId 多根时全部进入 `rootCommandIds` 且顺序稳定 | 不得把第一条子命令当根，也不得压成单值 root |
| L-5 | 两级 route filter | workspace selector 返回请求集合；display selector 返回该请求的命令集合；两个 null 都是双可见 | 不得把两级压成“命中任一 command 就返回完整 view”的存在性过滤 |
| L-6 | memo 分片 | 改 request A 不重算 request B view；另建两个 peer-only request，改其中 A 的 peer envelope 后 B 的 view 引用不变，删掉 B 的 peer envelope 后 B 返回 null | peer-only 绕过 cache、全表重建导致 B 引用变化均失败；不做不稳定 GC 断言，永久 requestId 强键风险由源码穷举证伪，不冒充机器门结论 |
| A-1 | 本地命令写 ledger | 注册测试模块派发 public request，selector 看到 command/actor result | dispatch result PASS 但 selector 缺记录失败 |
| A-2 | actor 中间结果 | 两个 actor 返回不同 JSON，view.results 全保留且有序 | 只保留最后一个或只保留成功项失败 |
| A-3 | 子命令继承 route | 父 route display PRIMARY，子默认继承 | 子 displayMode 为 null 或字段级合并失败 |
| A-4 | 请求聚合 running 前置 | `{error,running}` 为 started，越过 retention 仍不删 | 不得误判 error/终态 |
| A-5 | 请求聚合全超时 | `{timed-out,timed-out}` 为 timed-out | 不得被“有失败即 error”吞掉 |
| A-6 | 请求聚合混合失败 | `{timed-out,error}` 为 error | 不得报 timed-out |
| A-7 | 请求聚合部分失败 | `{completed,timed-out}` 为 partial-failed；`{completed,error}` 同理 | 不得压成 completed/error/timed-out |
| P-1 | peer 双 runtime | 内存 gateway 让 A peer 命令投给 B，本机和镜像同步后合并 | 只靠假数据不经 runtime dispatch 失败 |
| P-2 | peer timeout/local precedence | 本机 peer timed-out、对端后来 completed | 主机 view status timed-out；peer observation 保留但不改主状态 |
| B-1 | 单 request 命令数上限 | 通过 state full-sync 预置已达上限 ledger，首次派发写一条 request-budget error 后 typed reject | 后续派发不得继续写；独立 count Map 为空时不应放行；不得正常返回 error result |
| B-2 | 超限后有界 | 换不同 commandId 连续派发仍只保留第一条 budget fact | 防无界机制不得自身无界 |
| B-3 | 超限不强制终态 | 父命令仍 running 时 request 为 started | 不得写 request status 或直接进入时效淘汰 |
| E-1 | terminal cleanup command | tick 派发 internal cleanup command 删除过期终态本机 half | reducer 顺手清或裸 dispatch 路径失败 |
| E-2 | running retention | 未超 max residence 的 running request 保留；本机 terminal 但镜像 running 时 retention 不删本机 half | 半小时 retention 不得删 running；terminality 不得只看 local half |
| E-3 | max residence | 超 max residence 的本机 half 删除 | 若镜像 half 仍在，selector 仍返回 peer view |
| E-4 | role flip clear | 所有前置 role effect 成功后，ledger cleanup 作为最后一个 effect 清旧角色 ledger，再写角色字段 | 前置 effect 抛错时 ledger 未清；cleanup 抛错时角色与 ledger 均未变 |
| E-5 | 时钟来源边界 | 未翻转且双 half 存在时，镜像 `updatedAt` 快 40 分钟不影响本机 half 淘汰；角色翻转后分别预置对端快/慢的既有记录，断言 cleanup 按当前 local half 的该时间运行，并保留已接受的延迟/立即删除结果 | 不得把“current local half”误写成“永远是本机时间”；peer-only view 排序允许使用 peer 时间，但必须保留 `timeSource:'peer'` |
| E-6 | only-peer 不归本机删 | 只有镜像的过期终态仍存在 | 本机不得越权删除镜像 half |
| E-7 | 查询边界 | 本机 half 淘汰且无镜像时 selector 为 null；仍有镜像时返回 peer view | 不得存“已淘汰 id”集合 |
| R-1 | restart boundary | runtime 重建后角色恢复、ledger 为空 | 台账被持久化或角色不恢复均失败 |
| S-1 | full sync reuse | 用 state `createFullSyncPayload/applyAuthoritativeSync` 搬运 ledger | 新增 request 专用线格式失败 |
| S-2 | tombstone owner 边界 | 经真实 `StateRuntime.applyAuthoritativeSync` 输入 ledger tombstone 后，owner state 与 selector 均表现为该 request 不存在；selector/cleanup 都复用唯一 `readLiveRequestEnvelope` | tombstone 留在 ledger、两处各自解释 discriminant、或绕过 state owner 删除语义均失败 |
| T-1 | ledger record exact shape | static/type fixture 证明 record 无 payload/status/raw route，observation 只保留 displayMode | 给 record 加 `payload` 只红新增 ledger-shape 门 |
| T-2 | no request API | 人工穷举包根与 Runtime/context：无 query/subscribe/watch/snapshot 等专用读取面 | 同义改名无法被可靠机器判断，明确不称 machine PASS |

每个类型负夹具必须进入本包或 contracts/platform-ports 的 `tsconfig include`。每个 `@ts-expect-error` 都要有反向控制：删掉一行后 typecheck 变红。

P-1/S-1 的 sync 复用用例必须走真实 `StateRuntime.createFullSyncPayload/applyAuthoritativeSync`。由于 `Runtime` 公开面不暴露 `StateRuntime`，本批新增一个不从包根导出的 test-only accessor/control，绑定 `createRuntime` 内部当前 `StateRuntime`；测试只能经该 seam 触发 full-sync，不得伪造两份 ledger 对象后直接调用 selector。

### 7.2 runtime 静态门

`tools/terminal-runtime/check-static.mjs` 新增一道 B rule：

1. `RUNTIME_RULE_LEDGER_RECORD_SHAPE`：以手写 exact-set 对拍 `RequestExecutionRecord` 和
   `CommandExecutionObservation`，拒绝 payload、完整 routeContext 与派生 status。给
   `RequestExecutionRecord` 加 `payload` 的 mutation 必须只红这一门，其余既有门与 support 仍 PASS。

slice 方向、淘汰、selector 业务语义由 focused tests 证伪；request 专用 API 的同义改名只能靠人工穷举。
selector cache 形态同样由 focused test 与人工源码穷举覆盖：仅靠 AST/文本识别 `WeakMap` 或 `Map`
既无法证明缓存键确由 envelope 引用组成，也会把等价的局部实现误判为失败，故不得为它追加伪 checker。
rule gate 分母从 4 变 5；public support exact-set 从 58 变 63。

### 7.3 contracts 静态门

`tools/terminal-contracts/check-static.mjs`：

- `expectedLiteralUnions` 新增 `RequestLifecycleStatus` 五态；
- 新增 `CommandRouteContext.workspace`、`.instanceMode`、`.displayMode` 三条；
- `runClosedLiteralUnions` 支持 optional undefined 剥离；
- public exports count 仍为 69。

红夹具必须证明：非法 request status、route 字段开放 string、剥离 optional undefined 均被准确覆盖。

## 8. 文件变更清单

### 8.1 新增

| 路径 | 职责 |
|---|---|
| `apps/terminal/kernel/base/runtime/src/types/requestLedger.ts` | `RequestExecutionRecord`、view/filter 类型 |
| `apps/terminal/kernel/base/runtime/src/features/slices/requestLedger.ts` | 两个 ledger slice、actions、sync descriptor、唯一 `readLiveRequestEnvelope` 收窄边界与其余内部 helpers |
| `apps/terminal/kernel/base/runtime/src/foundations/aggregateRequestStatus.ts` | 第二级请求聚合，复用 `aggregateCommandStatus` |
| `apps/terminal/kernel/base/runtime/src/selectors/selectRequestExecutionView.ts` | 单 request 分片 memo selector |
| `apps/terminal/kernel/base/runtime/src/selectors/selectRequestExecutionViews.ts` | route filter + list selector |
| `apps/terminal/kernel/base/runtime/src/features/commands/cleanupRequestLedger.ts` | internal cleanup command，包内使用不从根导出 |
| `apps/terminal/kernel/base/runtime/src/features/actors/cleanupRequestLedgerActor.ts` | 淘汰 actor |
| `apps/terminal/kernel/base/runtime/src/application/createRequestLedgerRoleEffect.ts` | 清旧账 role effect，包内使用；由 `createRuntime` 追加到所有外部 `roleChangeEffects` 之后 |
| `apps/terminal/kernel/base/runtime/src/testing/runtimeStateSyncForTest.ts` | test-only accessor/control，绑定真实 runtime 内部 `StateRuntime` 的 `createFullSyncPayload/applyAuthoritativeSync`；不从包根导出 |
| `apps/terminal/kernel/base/runtime/test/requestLedger*.test.ts` | ledger/selector/lifecycle/cleanup/role focused tests |

### 8.2 修改

| 路径 | 职责 |
|---|---|
| `apps/terminal/kernel/base/contracts/src/types/request.ts` | `RequestLifecycleStatus` 五态 |
| `apps/terminal/kernel/base/contracts/src/types/command.ts` | `CommandRouteContext` 三闭集字段与注释 |
| `apps/terminal/kernel/base/contracts/test/public-surface.typecheck.ts` | status/route 类型夹具；修正旧开放 string fixture |
| `apps/terminal/kernel/base/contracts/README.md` | TR-10 同步：七个闭集、route 注释 |
| `apps/terminal/kernel/base/platform-ports/test/public-surface.typecheck.ts` | 修正旧 `CommandRouteContext` 开放 string fixture |
| `apps/terminal/kernel/base/runtime/test/roleAndRoute.test.ts` | 把 parent `west` 改为 `BRANCH`、child override `east` 改为 `MAIN`，保持“继承完整 route / 显式 route 整体替换”的原断言不变 |
| `apps/terminal/kernel/base/runtime/test/visibility.test.ts` | 把 `west` 改为 `BRANCH`，保持两种门面逐字透传同一 routeContext 引用的断言不变 |
| `apps/terminal/kernel/base/runtime/test/peerGateway.test.ts` | 把 `west` 改为 `BRANCH`，保持 gateway 收到完整 options 且 routeContext 引用不变的断言不变 |
| `tools/terminal-contracts/check-static.mjs` | optional closed-union checker 与 expected |
| `tools/terminal-contracts/check-static.test.mjs` | 对应 red mutations |
| `apps/terminal/kernel/base/runtime/src/foundations/createLifecycleEmitter.ts` | 单点写 ledger；`displayMode` 从 routeContext 取值 |
| `apps/terminal/kernel/base/runtime/src/foundations/createCommandDispatcher.ts` | request 命令数上限接入；传 ledger writer |
| `apps/terminal/kernel/base/runtime/src/application/createInternalRuntimeModule.ts` | 挂载两个 ledger slice、cleanup command/actor、role clear effect |
| `apps/terminal/kernel/base/runtime/src/application/createRuntime.ts` | 给 dispatcher/emitter 提供 ledger helpers；注册 cleanup timer resource；把 ledger cleanup 作为最后一个 role effect 追加；向 test-only sync accessor 提供当前 `StateRuntime` |
| `apps/terminal/kernel/base/runtime/src/index.ts` | 新增 5 个 B 公开导出，exact=63 |
| `tools/terminal-runtime/check-static.mjs` | 新增 ledger record shape 一道门，public expected=63；不得为 selector cache 追加文本形态门 |
| `tools/terminal-runtime/check-static.test.mjs` | ledger record shape 的定向 red mutation |
| `apps/terminal/kernel/base/runtime/README.md` | 追加 §4.7 全节、三部署形态、跨机不同状态、淘汰边界 |
| `apps/terminal/kernel/base/runtime/HANDOFF.md` | 登记 state 方向校验欠账、角色切换留痕不能跨重启 |

## 9. 实施步骤与停机条件

### CP-B0：前置核验

回读并记录：

- A `createLifecycleEmitter` 是否仍只有一个 observation factory，`displayMode:null` 是否仍为唯一赋值；
- A role effect 是否仍在字段写入前执行；
- A `dispatchCommand` options 是否仍含 requestId/commandId/parentCommandId/routeContext；
- contracts 当前 status/route 形状；
- state 当前 `SyncRecordState`、`createFullSyncPayload`、`applyAuthoritativeSync` 形状。

### CP-B1：契约变更

先改 contracts checker optional union，再改 contracts 类型与夹具。顺序不能反，因为未改 checker 时 optional 闭集会误红。
同一 CP 必须同步修正 runtime 的三个真实 route fixture：`roleAndRoute.test.ts` 的 `west/east`
分别映射为 `BRANCH/MAIN`，`visibility.test.ts` 与 `peerGateway.test.ts` 的 `west` 映射为
`BRANCH`；只能换闭集值，不得削弱继承、整体替换、身份相等与 gateway 透传断言。完成后跑
contracts、platform-ports、runtime 三包 typecheck，以及 contracts static real/model。

### CP-B2：ledger 与 selector

先写纯类型与聚合，再写 slice/actions 与唯一 live-envelope 收窄 helper，再写 selectors。selector tests
必须在 lifecycle 接入前用显式 state object 证明合并、复数 `rootCommandIds` 推导、两级 null wildcard
filter、local/peer/peer-only 四态 WeakMap 分片；另用真实 StateRuntime tombstone apply 证明 owner 边界最终
向 selector 呈现 absent。不得为了 selector 测试先改 dispatcher。

### CP-B3：lifecycle 接入

只改 A 已登记接点：emitter 写 ledger、displayMode 一处赋值、dispatcher 命令数上限；同时新增不从包根导出的 test-only StateRuntime sync accessor，供 P-1/S-1 证明真实 full-sync 搬运。完成后用真实 runtime 模块测试本地、子命令、peer gateway、full-sync 和 budget exceeded；budget exceeded 的反证必须从预置 ledger 达上限开始，不得只靠连续派发。

### CP-B4：淘汰与收口

新增 cleanup command/actor、timer、最后执行的 role clear effect，补 README/HANDOFF，接静态门与 TER-local 验证。淘汰测试必须证明 terminality 取 merged fact；角色测试必须证明前置 effect 失败不清 ledger、cleanup 失败时角色与 ledger 均未变。最后跑 runtime typecheck/test/static、contracts/platform-ports affected checks、TER `verify:static` 与 `verify`。

### 9.1 不得自行决定

命中任一项立即停机回报：

- 需要修改 §0-A 的 A/B 切分、五个接点或 A command/actor/context 公开形状；
- 需要新增 runtime 依赖或 skeleton graph 出边；
- 需要修改 `state` 的同步方向校验、`applyAuthoritativeSync` 形状或 runtime 外的 production 源码；
- 需要把 `CommandRouteContext` 宣称为 wire-safe，或需要定义入站 wire 解码；
- 需要新增 request 专用传输消息、request 专用订阅 API、payload/raw command/raw routeContext 入账；
- 需要改变 `ActorExecutionRecord.status` 四态、`CommandAggregateStatus` 五态或 request 五态；
- 需要把 ledger 持久化，或把 journal 改成持久审计；
- 任一道 red mutation 不红、红错门、真实树不绿，或 contracts/state/platform-ports 已收口门漂移；
- 项目记忆与正本不一致且会影响本包形状。按 Dexter 指令，必须修复项目记忆，不能跳过。

## 10. operation/path/face/集合形态

N/A：本批无 HTTP operation、无 consumer face、无后端 path、无分页 API。唯一集合是本地 Redux state 中两个 request ledger record 集合：

| 集合 | 键 | 规模与增长驱动 | 有界机制 |
|---|---|---|---|
| MASTER ledger | requestId | 当前 MASTER 角色执行过的 request | retention/max residence/role flip clear |
| SLAVE ledger | requestId | 当前 SLAVE 角色执行过的 request | retention/max residence/role flip clear |

## 11. 跨 owner 写矩阵

N/A：无后端 owner、事务或 DB 写。本包内部 owner 边界是 runtime 自己写自己的 ledger slice；对业务 slice 无写入。

## 12. 声明—传递—消费矩阵

| fact | declaration | transfer | consumption | proof |
|---|---|---|---|---|
| Request status 五态 | contracts `RequestLifecycleStatus` | runtime selector view `status` | UI/automation 后续 select view | type fixture + aggregate tests |
| Route workspace | `CommandRouteContext.workspace` | request record `workspace` | route filter, request view | route tests + selector tests |
| Route displayMode | `CommandRouteContext.displayMode` | command observation `displayMode` | route filter, command view | lifecycle test：routeContext → displayMode |
| Actor result | actor handler return | `ActorExecutionRecord.result` | request view command results | existing A result tests + B view tests |
| 单写者 ledger | two slice descriptors | state sync record payload | selector local/peer merge | slice shape static + sync focused test |
| 淘汰 | limits retention/residence | cleanup command action | ledger state key deletion | cleanup tests |
| 角色翻转清账 | runtime role effect | actor effect before role reducer | ledger old half cleared | role flip tests |
| 跨包欠账 | HANDOFF | review handoff | Dexter/后续包 | file review |

## 13. 数据迁移与 seed（模板 §10 / §10b）

### 13.1 数据迁移

| 迁移 | 加/改什么 | 旧行回填 | 唯一可恢复事实 | 可否回滚 |
|---|---|---|---|---|
| N/A | ledger 是 `persistIntent:'never'` 的全新 state | 无旧行 | Dexter 已裁定重启即清 | N/A |

contracts route/status 是编译契约收窄，不对应持久化行；不得为旧开放 string 添加兼容层或 fallback。

### 13.2 seed 受影响全集

| seed 文件 | 本批为什么受影响 | 处置 |
|---|---|---|
| 无 | request ledger 只由运行时 command/actor 产生，且不持久；route/status 不由 seed 物化 | `NOT_APPLICABLE_WITH_REASON` |

### 13.3 新功能与旧功能两类核对

- 新 ledger 不造 DEV 样例，测试用包内模块、actor、假时钟和 full-sync fixture；fixture 不是 seed。
- 旧 seed 全仓不构造 `RequestLifecycleStatus` 或 `CommandRouteContext`，不存在会因收窄变非法的物化数据。

### 13.4 覆盖、同步与边界

无 seed static test 需要修改；本批不新增 seed plan/executor，不运行 reset 或 seed。若实施前同根搜索
发现 seed 实际构造上述事实，立即命中 §9.1 停机并把它补入唯一来源清单，不得按本段假设跳过。

## 14. README、HANDOFF 与未验证边界

README 必须追加：

1. request ledger 为什么是两个单写者 slice；
2. 三层 data 形状，说明 status 都是 selector 计算；
3. actor return 是中间结果，写全但受 JSON 与体积限制；
4. 收银业务例子；
5. 淘汰规则、max residence 只保证存储有界，不保证对端永久离开时界面症状消失；
6. 跨机命令在两台机器上显示不同状态是刻意的；
7. T1/T2/T3 三种部署形态与本包只承载/记账 route 的边界；
8. 台账不跨重启，角色切换业务留痕也不跨重启；
9. 角色翻转窗口内新获得写权 half 的既有记录携带对端时钟，偏差无上界；不做时基迁移，
   `persistIntent:'never'` 加进程重启是唯一硬兜底，peer-only 排序不承诺跨机先后；
10. selector 只有一边 request 时仅按该边已知事实计算，不等待、不补造、不泄漏已删除边的 memo 事实。

HANDOFF 必须登记：

- `state.applyAuthoritativeSync` 尚不校验 sync direction，阻塞“同步层强制单写者”证明；
- 角色切换留痕不能跨重启；
- `displayMode` 的盖章方归 `ui.base.render`/`ui-state`；
- `CommandRouteContext` 跨版本未知值入站处置归 transport/topology；
- 本批未证明 native、Gradle、设备、DEV、seed、browser L2、UAT、部署。

## 15. 交付验收输出

实施完成后必须提供新鲜输出：

- contracts public exact exports = 69；
- runtime public exact exports = 63；
- runtime tests：新增 B 用例全绿，且总数与实施记录一致；
- contracts/platform-ports/runtimes typecheck 全绿；
- contracts 和 runtime 静态门真实树绿；
- contracts optional union 与 runtime ledger shape 的 red mutation 各自只红目标门；
- TER-local `verify:static` 与 `verify` PASS，test owners 仍为 9，REAL=4，NO_TEST=5，除非本批新增/减少测试 owner 并有 Dexter 明确授权；
- assembly export 仍只证明 Metro 消费闭包，不升格为 native/Gradle/设备证明。

## 16. 未验证边界

| 项 | 状态 |
|---|---|
| Unit B 代码能否按本设计编译 | `UNVERIFIED_REQUIRES_EVIDENCE`，本轮只写设计 |
| `state` 同步方向校验 | `CROSS_PACKAGE_DEBT`，本批登记不修 |
| 真实 transport 是否携带 routeContext | `NOT_OWNED_BY_RUNTIME` |
| 对端永久离开后的 UI 症状消失 | `NOT_PROVIDED_BY_THIS_DESIGN`，只保证本机 half 存储有界 |
| 角色切换留痕跨重启 | `NOT_PROVIDED_BY_THIS_DESIGN`，需要后续审计/日志 owner |
| native/Gradle/设备/DEV/seed/L2/UAT/deploy | `NOT_AUTHORIZED` |

本设计已完成 fresh independent 与 Claude `REVIEW_TARGET=DESIGN`；Claude 原始结论为 GO，后续 3S/1N
按 §19 回源闭合。该结论仍不构成实施授权：在 Dexter 明确接受当前修订字节并授权前，不得开始
CP-B0 或任何 Unit B 源码改动。

## 17. 模板缺失维度补全

### 17.1 模板 §8 · 业务规则 → owner 判定点

| 规则 | owner 判定点 |
|---|---|
| B-01 两个单写者 | request-ledger descriptor factory：MASTER/SLAVE 两份、方向相反、persist never |
| B-02 本机写权 | lifecycle ledger writer 按 `selectRuntimeInstanceMode` 只选当前角色 half |
| B-03 状态不存 | record exact-set 无 command/request status；两级 aggregate 在 selector 计算 |
| B-04 单边独立、双边本机优先 | 单 request selector 先按 absent/local-only/peer-only/both 四态分支；单边全量仅按该边计算，双边 same-command 冲突才用 local precedence |
| B-05 过程与结果全量 | command view 构造：observations/results/errors 全保留 |
| B-06 根命令 | selector 从 `parentCommandId === null` 推导复数 `rootCommandIds`，无根为空数组 |
| B-07 两级 route | request list selector 判 workspace；command selector 判 displayMode |
| B-08 null route | 两个 selector 都把 null 当作设备级、双可见 |
| B-09 分片记忆化 | envelope-reference WeakMap cache；无永久 requestId Map |
| B-10 命令预算 | dispatcher 从 merged view `commands.length` 取值 |
| B-11 首次超限事实 | lifecycle emitter 写一条 budget observation 后 typed reject |
| B-12 后续超限零写 | merged view 已有 budget error key 时直接 reject |
| B-13 时效淘汰 | cleanup actor 用 merged status，但只删 local half |
| B-14 最长驻留 | cleanup actor 只读当前写权 half 的 envelope updatedAt；翻转窗口内其来源可为对端且偏差无上界 |
| B-15 镜像保护 | cleanup reducer action只接受当前 local slice name；only-peer 不动 |
| B-16 命令驱动 cleanup | timer 只派 internal command；actor 才 dispatch delete action |
| B-17 角色翻转 | `createRuntime` 将 ledger effect append 最后，actor 在 role reducer 前 await；不迁移新 local half 的既有时基 |
| B-18 不持久 | 两 ledger descriptors `persistIntent:'never'`，restart fixture 为空 |
| B-19 tombstone 边界 | 本机 reducer 不产生 tombstone；state apply 在 owner ingress 前把 tombstone 消费为删除；包内唯一 live-envelope helper 将防御性 tombstone 视为 absent |
| B-20 同步方向欠账 | HANDOFF 标 `UNVERIFIED_REQUIRES_EVIDENCE`，本批不改 state |

20 条无空号；B-20 是边界判定点，不允许被测试绿升格成“方向已强制”。

### 17.2 模板 §9 · owner API 与消费者清单

| owner API | 精确消费者 |
|---|---|
| `RequestExecutionView` | 三个 selector 的公开返回类型；后续 ui-state/automation 依冻结需求读取 |
| `RequestExecutionCommandView` | `selectRequestExecutionCommands(state, requestId, displayMode?)` 的公开返回类型 |
| `selectRequestExecutionView` | 本包 cleanup actor + 后续单 request UI/automation |
| `selectRequestExecutionViews` | 后续 UI workspace request 列表 |
| `selectRequestExecutionCommands` | 后续 T3 PRIMARY/SECONDARY 命令列表 |

后两项当前尚无已实施业务包调用，但不是猜测未来：它们是冻结需求 §4.7.1、§4.7.2⑥ 明令本批
冻结的普通 selector。除此五项外没有零调用者 root API；`RequestExecutionRecord` 与
`aggregateRequestStatus` 因没有第二个生产消费者保持内部。

### 17.3 模板 §9a · 实施前全链同步变更清单

| 事实 | 契约/唯一源 | backend/edge/migration | frontend surface/state | proof | fixture/seed | 结论 |
|---|---|---|---|---|---|---|
| request 五态 | contracts request type + expected union | N/A：无 HTTP/DB | 后续只读 view，本批 N/A | contracts type/static | type fixture；seed N/A | 同步修改 contracts/checker/README |
| route 三闭集 | contracts command type | N/A | 后续 UI 不在本批 | contracts/platform-ports/runtime typecheck | contracts、platform-ports 与 runtime 三包共五处 fixture；seed N/A | contracts `store-01/primary`→`MAIN/MASTER`；platform-ports `test/single`→`BRANCH/SLAVE`；runtime `roleAndRoute` 的 `west/east`→`BRANCH/MAIN`、`visibility` 与 `peerGateway` 的 `west`→`BRANCH`；另有 WorkspaceKey 双向夹具 |
| ledger data | runtime internal record/slices | N/A | UI 只通过 selector | runtime focused/static | test module/full sync/tombstone ingress；seed N/A | 新增 owner state，不改 state 包；state apply 先消费 tombstone，包内唯一 helper 再防御性收窄 |
| lifecycle 入账 | A lifecycle emitter | N/A | N/A | local/peer/budget tests + 人工单点核 | runtime actors | 只改同一函数，不新造 fact factory |
| route 记账 | emitter 单一 displayMode 表达式 | N/A | 后续 selector | inheritance/replacement/null tests | runtime module | 只改登记的一处 B→A 触点 |
| budget | limits + merged selector | N/A | N/A | 预置 ledger 反 Count-Map | full-sync fixture | 无 count Map、首次一 fact 后 reject |
| 淘汰 | cleanup command/actor | N/A | N/A | fake clock/镜像/role tests | package-local | 不持久、不 seed |
| 角色清账 | A public Effect | N/A | N/A | before/after/failure test | effect fixture | 最后 effect，不改 role actor |
| public surface | runtime root + checker hand-list | N/A | 后续编译消费者 | exact support/model | type fixture | runtime 58→63；contracts仍69 |
| 文档/记忆 | README/HANDOFF/owning memory | N/A | N/A | fresh review + build-index（仅发生 memory 修复时） | N/A | 冲突必须修 owning memory，不改生成 index 止血 |

### 17.4 模板 §9b · 变更定位锚点

| 文件 | 写前必须唯一命中的锚点 |
|---|---|
| contracts request | `export type RequestLifecycleStatus =` |
| contracts command | `export interface CommandRouteContext` |
| contracts checker | `const expectedLiteralUnions`、`const runClosedLiteralUnions` |
| runtime emitter | `export const createLifecycleEmitter`、`displayMode: null` |
| runtime dispatcher | `export const createCommandDispatcher` |
| runtime create | `const roleChangeEffects = Object.freeze`、`const start = (): Promise<void>` |
| internal module | `export const createInternalRuntimeModule` |
| runtime root/checker | `export type {` 的 module 组、`const expectedPublicExports` |
| README/HANDOFF | 各自 H1；只能追加当前 B 状态，历史 A 证据不得改写 |

锚点在写前以 `rg -n -F` 复算为一次；不是一次即命中 §9.1 停机条件。不得依赖行号。

### 17.5 模板 §13b · 实施节奏与三维对账

| 维 | 每个 CP 必须重开 |
|---|---|
| 需求 | §0-A、§4.2b②、§4.7、§4.8b、§6 第一/二组、§8 B |
| 详设/IA | 本文对应 CP；IA/interaction/Journey 均 N/A，不补造 UI 工件 |
| 项目记忆 | 六维 query 全命中原文、terminal standard TR-01/03/04/09/10、架构裁定 |

每个 CP focused proof 后、下一 CP 前由 fresh 独立子 agent 给逐条 `MATCHED/OPEN`；OPEN 修复后
必须 fresh recheck。全部 CP 后、整体测试前再做全范围对账，不是阶段汇总。两者都不产生整批
GO/NO-GO，也不消耗正式 IMPLEMENTATION review 的两轮上限。

### 17.6 模板 §14 · 交付前自查

| 检查 | 判据 |
|---|---|
| §3 行集 | 模板所有机制行都在，N/A 有理由 |
| 精确数字 | A 58、B 63、contracts 69；2 slices、5 request states、3 route fields、20 owner rules |
| 五个接点 | emitter、role Effect、四 options、displayMode 单点、aggregate reuse 全核 |
| 右尺寸 | runtime 只新增 1 道 rule gate；同义 request API/单一事实点留人工 review |
| budget | merged commands.length、首次一 fact 后 reject、后续零写、无 count Map |
| route / selector | 两级 selector 分开；null 双可见；runtime 只记不判；恰好一边 request 时所有 view 事实仅由该边计算 |
| 时钟 | 常态 cleanup 不读 mirror half 时间；翻转窗口 current-local 的既有值可来自 peer，偏差无上界；view fallback 标 timeSource |
| data/seed | 无迁移、无 seed、无数据动作；runtime 不产生 tombstone，state ingress 统一消费，不建兼容层 |
| 对账 | 每 CP 后与整体测试前均有 fresh 留痕 |
| 证据档位 | type/static/test/export 不升格 native/device/runtime environment |

### 17.7 实施计划的文件职责与完成信号

新增文件的唯一职责以 §8.1 为准；其中 selector 文件必须同时拥有三个 selector 和唯一 memo cache，
不再拆第二套 list cache。修改文件以 §8.2 为准；`createRuntime` 只承担挂接 current state、最后 role
effect 与 timer，业务规则仍在对应 owner helper。

执行顺序固定：

1. CP-B0 只读五接点与真实签名，输出逐项 MATCHED；
2. CP-B1 先修 checker optional union，再改类型/三包夹具，信号是三包 typecheck 与 contracts
   real/model static 绿；
3. CP-B2 类型→聚合→slice→selectors，信号是 record/merge/route/memo（含 peer-only）与真实 state
   tombstone ingress focused 绿、runtime 63 exact、新 ledger gate 真实绿且 payload mutation 定向红；
4. CP-B3 只接 emitter/displayMode/dispatcher budget，信号是 local/peer/full-sync/budget focused 绿，
   人工重开确认 journal/observation/ledger 未裂成两个事实点；
5. CP-B4 cleanup/timer/最后 role effect/README/HANDOFF，focused proof 必含角色翻转后对端快/慢两支
   时钟边界；完成阶段与整体对账后，才跑整体 runtime/affected packages/TER-local verify。

最终实施证据必须逐项给：contracts `69/69`、runtime `63/63`；既有 52 条测试与本设计新增用例
全部绿（最终 `it` 数按源码实算，不预写假分母）；五道 runtime rule gate + support、contracts rule
真实树与定向 red；TER-local owners=9、REAL=4、NO_TEST=5、cleanup PASS。Metro/export 只证明 JS
消费闭包，不证明 native、Gradle、autolinking 或设备。

## 18. DESIGN review Round 1 辩证 intake

```text
REVIEW_CYCLE_ID=TER_RUNTIME_UNIT_B_DESIGN_2026_09_01
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
ROUND_1_VERDICT=NO-GO
ROUND_1_COUNTS=M=2 S=1 N=0
```

Round 1 是 fresh 独立子 agent 的盲审输入，不因本节处置而改写其原始 verdict。作者逐条回到需求、
当前源码与设计 owning section 做辩证 intake，处置如下：

| finding | intake | 当前落点与理由 |
|---|---|---|
| M-1 `selectRequestExecutionCommands` 出现 `view` 与 `state/requestId` 两种互斥签名 | `CONFIRMED_ON_REVIEW_BASELINE / CLOSED_IN_CURRENT_BYTES` | 全文统一为 `selectRequestExecutionCommands(state, requestId, displayMode?)`，并规定它内部复用 `selectRequestExecutionView`。没有采用 reviewer 推荐的 `view` helper：冻结需求要求三者都是普通 Redux selector；state 形态让消费者不必先物化 view，也不新增第四个 helper，同时仍复用同一 request memo。§4.4、§4.9.5、§17.2 与测试矩阵现已同形。 |
| M-2 route 闭集收窄漏掉三个 runtime 真实夹具 | `CONFIRMED / CLOSED` | §8.2、CP-B1、§17.3 已逐文件列出 `roleAndRoute.test.ts`、`visibility.test.ts`、`peerGateway.test.ts`。映射固定为 `west→BRANCH`、`east→MAIN`，并明确继承、整体替换、对象身份和 gateway 透传断言不得削弱。 |
| S-1 runtime gate 与 owner rule denominator 互斥 | `CONFIRMED / CLOSED` | 只保留 `RUNTIME_RULE_LEDGER_RECORD_SHAPE` 一道新门，runtime 总门数固定 5；selector cache 用 focused test 与人工源码穷举，不建无法证明语义的文本形态门。owner rules 固定 B-01 至 B-20 共 20 条；§7.2、§8.2、§17.6 与最终证据口径已统一。 |

三条均不涉及产品/Journey 语义，无 `DEXTER_DECISION`。Round 2 只定向复核上述三处闭合及修订引入的
新冲突；它是本 cycle 最后一轮，之后由作者按 `ROUND_FINAL_DECISION=SELF_DECIDED` 收口，不得换 reviewer、
改文件名或拆范围重置轮次。

## 19. Claude DESIGN review 辩证 intake（2026-09-01）

Claude 对冻结 792 行、SHA-256 前缀 `ba399513` 的设计给出 `GO，M=0 S=3 N=1`。该 verdict 不替代
作者回源；本轮另以两路只读 source audit 穷举同根影响面，处置如下：

| finding | intake | 当前落点与理由 |
|---|---|---|
| S-1 翻转窗口把对端时钟误写成无条件本机时钟 | `CONFIRMED / CLOSED` | §4.9.6、§4.9.7 明确 current-local 与 timestamp-source 是两件事；翻转前镜像既有记录的偏差无上界且只由重启硬兜底。E-5 拆成常态隔离与翻转快/慢两支；B-14、B-17、§17.6、README 同步，peer-only 排序保留 `timeSource:'peer'` 且不承诺跨机顺序。 |
| S-2 peer-only 缺 WeakMap 第一层 key | `CONFIRMED / CLOSED` | §4.9.5 冻结 local/peer 四态：`NO_LOCAL_ENVELOPE` 与 `NO_PEER_ENVELOPE` 为两个共享单例；peer-only 的 request entry 仍以真实 peer envelope 为第二层弱键。L-6、CP-B2 完成信号补 peer-only 引用稳定与删除后 null；不做不稳定 GC 测试。 |
| S-3 tombstone 会直接落入镜像 half | `PARTIALLY_CONFIRMED / CLOSED_WITH_OWNING_SOURCE_EVIDENCE` | Claude 指出的广义 union 收窄缺口成立，但“正常 state sync 会把 tombstone 存进 ledger”的可达链被当前源码反证：`state/src/supports/sync.ts` 的 `applySliceSyncDiff` 在 owner `applyEntries` 前已把 tombstone 消费为删除。§4.9.1 与 B-19 因此不在 selector/cleanup 各复制逻辑，而在 request-ledger slice 模块设唯一 `readLiveRequestEnvelope` 防御性收窄；S-2 focused case 经真实 `StateRuntime.applyAuthoritativeSync` 证明 tombstone 最终表现为 absent。 |
| N-1 把补建最小事实称为 fail closed | `PARTIALLY_CONFIRMED / CLOSED` | 术语误用成立，但简单改称 fail open 仍把事实恢复误写成准入策略。§4.9.2 现仅在 A accumulator 已有 observation、ledger 因翻转/淘汰缺记录时补建当前可证的最小事实；A accumulator 缺 observation 仍走既有异常拒绝/typed error。全文只此一处同根误用。 |

四条均不涉及产品/Journey 语义，无 `DEXTER_DECISION`，不改变 Unit B 公共面 63、contracts 公共面 69、
五个 A/B 接点、五道 runtime rule gate 或 B-01 至 B-20 分母。Claude 已明确本轮 GO 不授权实施；
在 Dexter 另行接受当前修订字节并授权前，不得开始 CP-B0 或任何 Unit B 源码改动。

### Dexter 2026-09-01 单边 selector 补充裁定

Dexter 在 Claude finding 闭合期间明确裁定：「如果 selector 只读到一边的 request 状态，
就只按一边 request 状态计算返回。」本文已将其固化为 §4.9.4 的四态算法、L-3 的正反断言、
B-04 owner 判定点、README 交付条目与 §17.6 自查。该裁定只收窄 selector 已知输入的计算语义，
不改变双边同时存在时的 local precedence，也不新增远端拉取、等待、重试或缓存兼容层。
