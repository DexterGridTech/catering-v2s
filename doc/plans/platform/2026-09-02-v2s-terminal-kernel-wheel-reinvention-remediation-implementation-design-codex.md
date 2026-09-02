# TER kernel 重复造轮子整改 · implementation-facing 详设

```text
SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0
DESIGN_ID=TER_KERNEL_WHEEL_REINVENTION_REMEDIATION_20260902
BUSINESS_SOURCE=doc/plans/platform/2026-09-02-v2s-terminal-kernel-wheel-reinvention-remediation-claude.md
PRIOR_REVIEW=doc/review/platform/2026-09-02-v2s-terminal-kernel-wheel-reinvention-remediation-review-codex.md
AUTHORIZED=implementation and self-verification within this approved design/plan scope
NOT_AUTHORIZED=DEV; reset; seed; L2; UAT; deployment; any scope expansion
IMPLEMENTATION_AUTHORITY=true (Dexter selected fixed-window B-1b)
DESIGN_REVIEW=GO (M=0,S=2,N=2); S-1 revised, S-2 fixed-window selected by Dexter
REVIEW_STATUS=DESIGN_GO_IMPLEMENTATION_AUTHORIZED_FIXED_WINDOW_ACTIVE_CP0
```

## 1. 目标、范围与方案选择

### 1.1 真实任务

终端 kernel 仍处于底座建设期。任务不是为了压缩行数而替换库，而是在已引入 RTK 的前提下：

1. 消除已确认的手写 Redux/状态分区/记忆化重复；
2. 修正会静默失效的红夹具、debounce 调度、重置清理、ledger 清理和重入判断；
3. 不削弱 MASTER/SLAVE 同步、角色切换、local/peer readback、命令生命周期或既有闭合联合约束；
4. 把未证实的“预计减行”从实施决策中剥离。

本批没有 UI-bearing Journey、HTTP operation、数据库、事务、seed 或动态环境行为，UI/IA、HTTP acceptance 和 backend-acceptance 为 **N/A**。

### 1.2 方案比较

| 方案 | 结论 |
|---|---|
| 维持手写 reducer、手写两分区和 WeakMap cache | 保留重复根因和已确认的 B-1/R3 缺陷，拒绝。 |
| 直接复制 Heritage 的 scope/instance-mode 实现 | Heritage 的 axis 语义和当前 runtime 所需的 local/peer/sync 语义不同；机械搬运会把领域事实下沉，拒绝。 |
| state 提供无维度泛型机械内核；runtime 保有实例模式领域语义；同一原子单元一次迁移 requestLedger + createSlice | 最小复用边界，保持依赖方向且没有“旧分区先迁一次”的中间态，**采用**。 |

已裁定而不重开：RTK 适用、无新增第三方依赖、保持 `autoFreeze`、不引 schema 库、不加入 AbortSignal/clock port、workspace 三件套保留、B-3 撤销。

### 1.3 输入中的已知矛盾处置

报告 §7 仍有“workspace 三件套由 C-12 接上第一个真实消费者”的残留表述；它与报告 §4.1 已接受的更正及 Dexter 本次指令冲突。本详设按后者执行：**generic core 的首个生产消费者是 runtime requestLedger；workspace wrappers 仍是生产零消费者，但保留。** 本详设不修改原报告。

本轮修订记录：S-1 已把 workspace wrapper 的 action type 校验、最后斜杠重写和 generic dispatch 委托边界写成可实施组合，并把两条既有 workspace 测试列为不变判据；S-2 已撤回实施 agent 对 B-1b 的默认选择，Dexter 已选择固定窗口，`trailing + maxWait` 不纳入本批。N-1 的 `peer-running` proof 同步限定为 `max residence` 以内保留；N-2 属于输入陈述更正，TR-01 anchor-miss 显式失败仍作为加固保留。

## 2. 原子边界与横切机制

### 2.1 原子组

`C-12 + A-1(requestLedger)` 是一个原子整改单元。允许先写并验证 state generic core；但 requestLedger 只能从“当前手写两分区 reducer”一次变为“generic partition + per-mode createSlice”，不得出现“先把旧 payload/sliceName 路由套 createSlice、再迁分区”的源码中间态。

`runtimeInstanceMode` 与 `displayRole` 同在 A-1 单元迁为 `createSlice`，但不承担 C-12 的领域语义。

### 2.2 横切机制对照

| 机制 | 现有能力/拥有者 | 可证伪观察 | 本批适用面 |
|---|---|---|---|
| 不可变 state | `@reduxjs/toolkit` 已由 state package 使用；owner=state/runtime/display-context | requestLedger 命中 case 时保留预冻结 record/commands；不存在 key delete/空 clear 不产生新 state ref | A-1 |
| 分区机械能力 | 新 `kernel-base-state` generic core；owner=state | state 源码、public type 和 package edge 不出现 `RuntimeInstanceMode`；任意 `K extends string` 可生成 keys/descriptor/action dispatch/read | C-12 |
| instance-mode 领域语义 | runtime requestLedger、role actor、cleanup actor、selectors；owner=runtime | 四项保持条件及反例全部成立，见 §3.4 | C-12/A-1/B-4 |
| 外部 package 声明 | package.json；owner=各 kernel package | runtime/display-context 每个直接 RTK import 均有自身 dependency；workspace-only gate 不作为该事实的证明 | A-1/依赖卫生 |
| public surface 与闭合联合 | 各 `terminal-invariants.json` + package static checker | private symbol 改形不改变根 index；只有真实 root export 增减才同步 publicExports；删除旧 declaration 后 count 与行集合一致 | A-1/C-12/§7 删除 |
| 红夹具 | `tools/terminal-skeleton/check-static.test.mjs`；owner=skeleton tool | 对新 actor direct dispatch 文本的四种 receiver/lexical 变异仍分别红，且 anchor miss 本身 fail | A-1 |
| persistence 调度 | `createStateRuntime`；owner=state | immediate 更新不推迟既有 deadline；debounced-only 更新不调用 immediate selection | B-1 |
| 日志与失败恢复 | runtime logger；owner=runtime | 被根命令异常丢弃的 reset 只记录脱敏 warn，Map 条目仍释放；不写 raw reason | B-2 |
| UI / HTTP / DB / transaction / cache invalidation | N/A：无本批 consumer operation | 不新增 UI、HTTP、schema、migration、seed 或 owner transaction | 全批 |

## 3. C-12 + A-1 详设

### 3.1 state 的泛型公共面

新增 `apps/terminal/kernel/base/state/src/types/partitioned.ts` 与 `src/supports/partitioned.ts`，从 state root index 导出如下**泛型**类型/函数：

```ts
type PartitionedStateKeys<K extends string> = Readonly<Record<K, string>>

createPartitionedStateKeys<K extends string>(baseName: string, keys: readonly K[]): PartitionedStateKeys<K>

createPartitionedActionDispatcher<K extends string, TAction extends UnknownAction>(input: {
  selectPartition: () => K
  dispatch: (action: TAction) => unknown
}): (createAction: (partition: K) => TAction) => unknown

readPartitionedState<K extends string, TValue>(values: Readonly<Record<K, TValue>>, partition: K): TValue

toPartitionedStateDescriptors<K extends string, TState extends object>(input: {
  keys: readonly K[]
  stateKeys: PartitionedStateKeys<K>
  createDescriptor: (partition: K, stateKey: string) => StateRuntimeSliceRegistration<TState>
}): readonly StateRuntimeSliceRegistration<TState>[]
```

约束：

- `partitioned.ts` 只能依赖 state 自身类型和 `UnknownAction`，不得 import runtime、display-context，或出现 `RuntimeInstanceMode`/`WorkspaceKey` 字面量；
- `createPartitionedActionDispatcher` 不拼接 action type 字符串。它只选择 caller 提供的 partition，再调用 runtime 提供的 per-partition action factory；避免误把 `createSlice` 的 reducer action type 当成可任意文本改写的协议；
- `readPartitionedState` 只做泛型 key lookup，不作 current/peer、同步、生命周期或清理判断；
- `toPartitionedStateDescriptors` 只枚举 caller 明示的 key 并验证 descriptor name；`syncIntent`、persistence、sync descriptor 一律由 caller 填入；
- `workspace.ts` 保留现有三个公共 wrapper、类型和报错语义，内部改委托 generic core。它们不因当前零生产消费者而删除。

workspace action wrapper 的委托边界必须保持明确：`createWorkspaceActionDispatcher` 仍由 wrapper 自己执行
`requireWorkspaceRouteContext`、`requireActionType` 以及最后一个 `/` 之前/之后的切分；它不能把 action type
重写规则下沉到 generic core。wrapper 先得到并校验原始 action，再把“按当前 `workspace` 选分区并 dispatch”交给
`createPartitionedActionDispatcher`，传入的 action factory 才按所选 partition 返回
`{...action, type: \`${sliceType}.${partition}/${actionName}\`}`。因此 core 只选择 partition、调用 factory、dispatch
已构造 action；`requireActionType` 的异常文本、最后斜杠重写、payload 及其它 action 字段仍由 workspace wrapper
拥有。CP-2A 的行为不变判据是 `apps/terminal/kernel/base/state/test/workspace.test.ts` 中
“rewrites action type at the final slash and preserves action fields”和“rejects missing workspace and invalid action types”
两条既有测试保持绿，而不是只看 generic core 测试。

因此 state 只认识 `K extends string`，不认识两个业务联合；runtime 依赖 state 的方向保持不变。

### 3.2 runtime requestLedger 的最终形态

在 `runtime/src/features/slices/requestLedger.ts` 内部声明稳定的 `runtimeInstanceModes = ['MASTER', 'SLAVE'] as const`，用 `createPartitionedStateKeys` 生成两个 state key。对每个 mode 创建一个同构的 `createSlice`：

- `upsert({record, updatedAt})`：写入 `{value: record, updatedAt}`；record/commands 继续由 lifecycle writer 预冻结；
- `deleteRecords({requestIds})`：逐个 delete；空数组或全部不存在的 key 不修改 draft；
- `clear()`：仅当当前 record map 非空时清空；空 map return/不写 draft，保留 state reference。

runtime 私有 map 同时持有 `{slice, registration}`；`createPartitionedActionDispatcher` 以当前 mode 选择该 map 的 action creator。`requestLedgerSliceNameForMode`、peer lookup 和 selectors 使用 generic keys/read helper，仍由 runtime 解释“current/peer”。实例化 map、actions 和 helpers只供 runtime feature import，**不**进入 runtime root index 或 `publicExports`。

`runtimeInstanceMode.ts` 与 `displayRole.ts` 也改为自身 `createSlice`。其 actor 在 command payload 已验证后派发对应 slice action；不再保留手写 action type 常量和 standalone creator。请求 ledger 不再以 payload 的 `sliceName` 决定 reducer；mode→per-mode action creator 的选择在 runtime 私有边界完成。

### 3.3 A-1 台账与测试的同批责任

| 事实 | 责任改动 | 不可替代的 proof |
|---|---|---|
| runtime closed union | 删除 `createSetRuntimeInstanceModeAction` consumer 行，按实际剩余消费者重算 `closedUnionConsumerCount`；不伪造 replacement declaration | runtime closed-union checker 绿，且旧 declaration 不存在 |
| state public surface | 将本节列出的 generic public API 精确加入 state root index 与 state `publicExports`；保留 workspace names | state public-surface typecheck 与 static exact-set 绿 |
| runtime/display public surface | 不因 feature-private maps/actions 增加 root export；五个 package checker 全部重跑 | runtime/display `publicExports` 无 extra/missing |
| external dependency | runtime、display-context 各在自己的 `package.json` 声明 `@reduxjs/toolkit: 2.12.0` | manifest readback；不得引用 workspace-only dependency gate 作为证明 |
| TR-01 red control | 将 `roleDispatchText` 和四个 replace 变体迁到新 actor 的 direct `context.dispatchAction(<slice-action>)` 文本；fixture helper 必须在 anchor 不存在时抛错 | 四种 mutation 仍命中预期 gate vector；anchor miss 自身红 |
| package tests | 将 `requestLedgerSelector.test.ts` 对旧 standalone creators 的 import 改为最终 feature-private action source；保留 role/ledger selector assertions | A-1 三 slice 的 set/upsert/delete/empty-clear 与 role-change tests 均有行为断言 |

`tr01Exceptions` 不改：其 receiver/lexical 判据不读 action creator 名称。

### 3.4 四项 runtime 语义保持条件与反例

| 语义 | 保持条件 | 必须失败的错误形状 | focused proof |
|---|---|---|---|
| 相反 syncIntent | MASTER registration 恒为 `master-to-slave`，SLAVE 恒为 `slave-to-master` | generic core 给两个 partition 同一 syncIntent，或 runtime 未分别声明 | 从每个 registration 读取 syncIntent，精确断言相反方向 |
| role change 清前分区 | mode 变化成功后只 clear previous mode；clear dispatch 失败则 role command 为 error 且 mode/ledger 保持旧事实 | clear next mode、两侧都 clear、或失败后仍改变 mode | 现有 role flip/clear failure cases 改用最终 action，并增加 previous/next 双侧 readback |
| cleanup 只处理 current | cleanup helper 只返回 current partition 内可删除 requestId；peer-only / peer-running 事实不被 delete | 对两分区全量扫描后删除 peer，或用 mode 未选择的 state key | current expired 删除、peer-only 保留、merged peer-running 在 `max residence` 内保留；超过该边界按 residence 判据处理 |
| local/peer 合并 | current mode 选 local，另一 mode 选 peer；同 requestId 合并且 local 优先，不把 peer 作为 current 清理 | 只读 current、反转两侧、或按 key 合并却丢 actor observation | selector tests 覆盖 local-only、peer-only、同 request 合并、role flip 后 readback |

## 4. A-2、Immer 与行为修复详设

### 4.1 A-2：reselect 5.2.0

当前 `selectRequestExecutionView.ts` 共 217 行；仅手写 cache 的 sentinel/cache/read/write 区段为约 43 行，不是报告旧称的 52 行。最终 selector 至少需要 requestId、current mode、local envelope、peer envelope 四个 input selector，预估约 25–30 行，**净减约 15–20 行**。此数字只作复核记录，不作工作量或必要性依据。

A-1 完成后 runtime 将直接声明 RTK 2.12.0；该安装树提供 reselect 5.2.0 的默认 `weakMapMemoize`。实现使用默认 `createSelector`，不得传 `lruMemoize` 或容量一 options：`selectRequestExecutionViews` 在同一 state 中遍历多个 requestId，容量一会令每次循环驱逐前一个缓存。

result function 仍调用现有 `buildView(requestId, mode, localEnvelope, peerEnvelope)`，因此 local/peer identity 与 mode 是失效输入；`observationCache` 不属于本次替换。focused proof 要在同一个 state 上读取至少两个 requestId、再逐个重读，断言各 view reference 仍命中；若替换为 LRU(1)，该断言应红。

### 4.2 Immer

不将 requestLedger 从 A-1 分拆，也不调用 `setAutoFreeze(false)`。每次命中 case reducer 仍有 root map/draft/new envelope 成本，但预冻结 record/commands 不被深遍历；未获得单独性能授权前不测量、不提前优化。

### 4.3 B-1 / B-1b：descriptor 粒度与有界延迟

`createStateRuntime` 将在记录 previous slice reference 后，按每条 persistence descriptor 比较它在 previous/next slice 的实际值：field 比较 `stateKey` 值；record 比较 `getEntries(previous)` 与 `getEntries(next)` 的引用。仅由变化 descriptor 推导 immediate/debounced 选择。

这消除两个镜像错误：

- immediate-only 变化不 clear/restart 已有 debounce timer；
- debounced-only 变化不调用 `runFlush('immediate')`。

B-1 的 descriptor-level 修复已确定；B-1b 的 debounce 取舍必须由 Dexter 在 CP-4 前选择，不由实施 agent 代选。两个可行选项如下：

- **固定窗口**：首次 debounced change 创建 `persistenceDebounceMs` deadline，同一窗口的后续变化不推迟 deadline；实现最简单、无需新参数，但持续变化时按窗口频繁写，闪存写放大更大。
- **trailing + maxWait**：每次变化重置 quiet debounce deadline，同时从窗口首个变化开始保留独立 `maxWait` deadline；保留既有静默后 trailing 写入语义、持续变化时写得更少，但需要新增并裁定一个 maxWait 值及其配置归属。

两者都满足“陈旧度有上界”，但写放大与配置复杂度不同。Dexter 已选择**固定窗口**：`DECISION=DEXTER_SELECTED_FIXED_WINDOW`；因此 CP-4 实现首次 deadline 固定、窗口内后续 debounced 变化不延后，`trailing + maxWait` 不纳入本批。CP-0 至 CP-3 与不依赖该选择的后续准备不受影响。

proof 一律用 Vitest fake timers，不以 wall-clock sleep 判断：

1. t=0 发 debounced，t=10 发 immediate，t=25 必须 flush debounced record；“错误重启 timer”实现会在 t=25 失败；
2. 通过 test-only module mock/fake persistence engine 的 `flush` spy，发 debounced-only change 后断言零次 `flush('immediate')`；“按 slice 含 immediate descriptor”实现必红；
3. 连续 debounced 变化在首个 deadline flush 最新值；不得重置 quiet deadline，也不得实现未选择的 `trailing + maxWait` 方案。

test seam 只能存在测试 module mock，不新增 runtime public hook 或测试专用生产 API。

### 4.4 B-2：reset cleanup

在 `createCommandDispatcher` root-command `finally` 统一删除 `pendingResetByRoot`：

- root 正常完成且 reset 尚未尝试时，取出 reason、标记 `resetStarted`、调用既有 `performReset`；
- root 在此前抛错，finally 删除未消费项并以 `runtime.reset.request-discarded-after-root-failure` 写 warn；data 只含 root command id、是否有 reason，不记录 raw reason；
- `performReset` 已开始即不称“discarded”，其异常沿既有失败路径传播，Map 仍释放。

focused proof：actor request reset 后 root throw，logger 有脱敏 warn，随后同一运行时仍可处理另一 root reset；不改变 timeout actor 的继续运行裁定。

### 4.5 B-4：新请求扫描而非定时器

保留 `cleanupRequestLedgerCommand`/actor 作为显式内部清理入口，但把可删除 id 的纯计算提为 runtime private helper，由 actor 和 lifecycle writer 复用。lifecycle writer 第一次看到**当前 mode 中不存在**的 request record 时，在 upsert 前按 current mode 扫描并派发最终的 delete action；这就是“新请求到来”而非每个生命周期 transition 的触发点。

删除 `createRuntime` 的 interval、in-flight/timer registration 与其 resource registry registration。不得把扫描扩展到 peer partition，不加 monotonic clock、clock port 或条目数上限。

条目数 cap **不纳入本批**：当前裁定只要求按新请求的年龄扫描防无限增长；cap 会引入“最旧”“terminal/running”“peer”和阈值语义，既无裁定数值也可能删掉仍需观察的事实。发生实际规模证据后再单独设计。

focused proof：过期 terminal current entry 在下一新 request 的第一次 ledger write 前被删除；没有新 request 时即使推进 timer 也不触发清理；running、peer-only 保留，且 **peer-running 仅在 `max residence` 之内保留**，超过该独立 residence 边界时不得被 terminal 状态门控错误地永久保留。

### 4.6 R3：真正的 actor 祖先链

当前 `commandChains` 只有 `{commandName, commandId}`，不含 actor key，不能单独支持“同 actor+command”的祖先判断。实现新增 runtime-private `ActorInvocationAncestor` 参数，只在 `ActorExecutionContext.dispatchCommand` 调用 `dispatchInternal` 时沿当前 actor 分支传递；每项为 `{actorKey, commandName}`。

`dispatchActor` 的拒绝条件改为：当前 invocation 的 ancestor list 中存在相同 `actorKey + commandName`，且 definition 不允许 reentry。`executionStack` 不再参与 reentry 判断，可随其唯一职责删除；`commandChains` 继续服务 command depth/reset root，不承载 actor ancestry。

新增 focused case：父 actor 并行派发两个同一 child command，child actor 故意重叠运行；二者同为 siblings，均完成。原全运行时 `executionStack` 判据会拒绝至少一个；新祖先判据只拒绝 child 嵌套回自身的真实循环。现有 D-2 保留为“真祖先循环被拒、同 command 的其他 actor 继续”。

## 5. 其余整改的设计边界

### 5.1 第一批的内部去重（C-1 至 C-11）

这些项逐项先按当前源码重开，只有同构条件仍成立才改；不写入报告中的圆圈行数。所有 target 均为包内 capability helper，除 C-7a 采用 display-context 本地 guard 外，不扩大 root public surface。

| 项 | 目标形态 | 保护条件 |
|---|---|---|
| C-1 | `createUnavailable(port)` 统一同构 unavailable port | 每个 port 的 discriminant 和 unavailable reason 不变 |
| C-2 | 一处 actor mount validation，统一错误分类 | `createRuntime` 与 registry 仍拒绝未 `defineActor` 的 actor |
| C-3 | 一处 runtime ledger state reader | object/null boundary 与 typed cast 语义不变 |
| C-4/C-5 | display diagnostic builder + level-aware logger | 原 event/message/data 字段逐字保持，warn/error level 不漂移 |
| C-6 | 一处 `subscribeState` adapter | unsubscribe 只执行一次、late actor 不留 listener |
| C-7a | display-context package-local `isRuntimeInstanceMode` equivalent | 不 import runtime、不改 runtime publicExports；unknown 输入拒绝 |
| C-7b | 各 owner 内统一 `isPowerSource`/`isObject` | guard 接受集与报错路径不扩大 |
| C-8 | 复用已有 `freezeList` | 返回 immutable list 与元素顺序不变 |
| C-9 | scope-aware non-empty string assertion | 保留 caller 特定错误前缀，不用无上下文泛化 message |
| C-10 | persistence migration planning 唯一 helper | hydrate/rebaseline 的 storage migration decision 对同输入一致 |
| C-11 | state JSON safety single owner | getter、symbol key、Date/Map/Set 等非法 shape 在两个原路径得到同一 reject 语义 |

### 5.2 §5 删除

只删除 state root 的 `createSliceSyncDiff` 与 `createSliceSyncSummary`：同步删除 `src/index.ts` export、state `publicExports` 两项、`public-surface.typecheck.ts`/`sync.test.ts` 对应 imports、fixtures 与 assertion。`createFullSliceSyncPayload`、`applySliceSyncDiff`、workspace 三件套保留。删除前以同根 import scan 证明无剩余 consumer；删除后 exact public surface/owned tests 必须通过。

### 5.3 B-5 / B-6

B-5 先将 owner state 生成的 record key 纳入与 value 同级的 per-entry validation，坏 key 进入既有典型化 failure/result 路径，不允许异常穿透 `flushPersistence()` promise contract。B-6 的 record hydrate complexity、re-encoding、queue coalescing、`keysForStorage` 以及 TextEncoder 分配只在对应 record/field 路径有 red proof 后分解；全量 hot-path 优化没有测量授权，保持 **NOT_SCHEDULED_PENDING_MEASUREMENT**。

## 6. 分层声明—传递—消费矩阵

| 事实 | 声明 | 传递 | 消费 |
|---|---|---|---|
| partition key | caller-owned `K extends string` | state generic helper 的 keys/map | runtime chooses RuntimeInstanceMode；workspace wrapper chooses WorkspaceKey |
| sync direction | runtime requestLedger descriptor | state registration 不解释 | state authoritative sync engine |
| role cleanup | role-change actor command payload | runtime private action dispatcher | previous mode slice only |
| current/peer | runtime current mode selector | generic key lookup | request view/cleanup actor |
| debounce selection | persistence descriptor previous/next comparison | `scheduleAutoFlush` flags/timer | persistence engine `flush(selection)` |
| reset reason | actor context private Map | root command lifecycle | performReset 或脱敏 discarded warn |
| actor ancestry | private ActorInvocationAncestor | only actor child dispatch call | dispatchActor reentry decision |

## 7. 验证设计与不进入实施的边界

每个 CP 的代码改动前后必须按 `project-memory/operations/implementation-source-reread-discipline.md` 重开本详设、报告、适用 memory 和 owning source；完成 focused proof 后进行 fresh 独立步骤对账。预期命令（本次未运行）是：

```bash
cd apps/terminal && yarn verify:static
cd apps/terminal && yarn typecheck
cd apps/terminal && yarn test
```

其中 static verification 必须包含 skeleton、state、runtime、display-context 的真实 red fixtures；测试不替代后续获授权的任何动态/真机验证。NativePerformance 和 Hermes `crypto.getRandomValues` 为本批无关的真机未验证项，不阻塞设计或静态实施。

## 8. 设计自评

```text
SELF_ASSESSMENT=GO_FOR_IMPLEMENTATION_AFTER_CP0_RECOVERY
IMPLEMENTATION_VERDICT=BLOCKED_AT_CP0_DETERMINISTIC_MEMORY_ROUTE
M/S/N=0/0/0
DECISION=DEXTER_SELECTED_FIXED_WINDOW
```
