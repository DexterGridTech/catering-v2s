# V2S TER `kernel.base.runtime` 单元 A 详细设计（Codex）

## 0. 元数据与授权边界

| 字段 | 值 |
|---|---|
| PROGRAM_ID | `V2S_W0_W4_EXECUTION` |
| REVIEW_TARGET | `DESIGN` |
| REVIEW_CYCLE_ID | `TER_KERNEL_BASE_RUNTIME_UNIT_A_IMPLEMENTATION_DESIGN_2026_09_01` |
| REQUIREMENTS | `doc/plans/platform/2026-09-01-v2s-terminal-kernel-base-runtime-requirements-claude.md` |
| REQUIREMENTS_VERSION | 用户声明冻结版 3066 行，sha256 前缀 `2ac28865…`；完整自指复核方式以需求 §11 为准 |
| DESIGN_UNIT | `A_RUNTIME_SKELETON` |
| STATUS | `ROUND_FINAL_DECISION_SELF_DECIDED_READY_FOR_DEXTER_ACCEPTANCE` |
| REVIEW_ROUND | `2 / 2` |
| ROUND_FINAL_DECISION | `SELF_DECIDED` |
| IA | `NOT_APPLICABLE`：纯 kernel、无用户可见界面、无 Journey 操作或焦点行为 |
| IMPLEMENTATION_AUTHORITY | `false` |
| AUTHORIZED | 只编写本详设 |
| NOT_AUTHORIZED | 实施、修改 TER 源码、运行命令、测试或动态环境、数据操作、设备、DEV、seed、reset、浏览器 L2、UAT、部署 |

本设计只解释单元 A 如何实现。它不把需求变成授权，不把静态设计当成运行证明，也不提前设计单元 B 的请求台账。

## 1. 输入、目标与有限分母

### 1.1 必读输入

1. 冻结需求的唯一切分正本：§0-A 两张表；各小节标题只作索引。
2. `doc/platform/terminal-coding-standard.md`：TR-01、TR-03、TR-04、TR-09、TR-10。
3. 已收口包：`kernel.base.contracts`、`kernel.base.platform-ports`、`kernel.base.state` 当前公开面。
4. POC：`runtime-shell-v2`、`execution-runtime`、`topology-runtime-v3` 的命令、actor、生命周期、跨机分发事实。
5. `project-memory/decisions/terminal-architecture-and-stack-rulings.md` 与 routed terminal standard memory。
6. 当前 TER 骨架、graph model、runtime package、`tools/terminal-skeleton/verify*.mjs`。

### 1.2 单元 A 要解决的问题

单元 A 建立唯一 runtime 装配与执行骨架：模块排序与安装、命令定义与派发、actor 并行执行、peer gateway、错误与 journal、启动和 reset、实例角色 owner slice。它必须返回一次命令的完整有序 actor 结果，但不得建立请求台账、请求同步或 selector。

完成信号不是“文件存在”，而是：

- 模块、命令、actor、生命周期与角色形成一条真实消费链；
- `dispatchCommand` 返回由真实 actor 终态聚合出的五态结果；
- 所有生命周期事实只在一个内部事实产生点构造；
- 单元 B 只沿冻结的五个 seam 接入，不需重写单元 A 的公开签名或执行模型；
- runtime 成为合法 `owner`，并加入 TER-local 测试与静态验证闭包。

### 1.3 单元 A 正文分母

| 分母 | A 的责任 |
|---|---|
| §4.1 | 模块系统、顺序、唯一构造路径、内部角色模块 |
| §4.2 | 命令定义、两种门面、visibility、身份、target |
| §4.2b | 重入、命令深度、保留错误 key；不做单 request 命令数消费 |
| §4.2c | 单一 peer gateway、超时与有损投影 |
| §4.3 | actor、并发、精确模块/actor 上下文、返回值 |
| §4.4 | 错误归一化、命令作用域 logger、内存 journal |
| §4.4b | 六字段 limits 类型与默认值；A 只消费其中三项 |
| §4.5 / §4.5b | 显式启动、四阶段、失败终态、test-only 资源释放 |
| §4.6 | 根命令完成后的两段式 reset |
| §4.8a | MASTER/SLAVE 角色 owner slice、内部命令、前置副作用 |
| §4.8b（A） | `routeContext` 整体继承/整体替换，`ActorDispatchOptions` 生效 |
| contracts 第三/四组 | 已冻结的 7 + 9 处删除 |
| §5/§7/§10/§11 | 边界、欠账、裁定与治理输入 |

### 1.4 契约一的 A 精确分母

需求口语中的“五处”不作为计数。按 §0-A 表，A 有七个完整项加两个拆分项：

1. `LedgerError`、`ActorExecutionRecord`、`CommandExecutionObservation` 及 JSON 约束；
2. peer gateway 的一条合成 actor 记录；
3. actor 返回值校验、脱钩和体积上限；
4. 第一级 `aggregateCommandStatus` 与 `CommandAggregateStatus`；
5. peer 自带超时预算；
6. observation 只存执行投影，不存 payload 或原始命令；
7. record.result 为 `StateJsonValue`（其中已包含 null），error 为 `LedgerError | null`；
8. 上述三个记录类型的类型夹具；
9. `actorResults` 按 actor 启动顺序稳定输出。

## 2. 方案比较与选型

### 2.1 候选方案

| 方案 | 优点 | 失败点 | 结论 |
|---|---|---|---|
| 复制 `runtime-shell-v2` | 初始代码少 | 内存 request map 与专用跨机线侵入 A；actor 返回丢失；生命周期事实多点构造 | 拒绝 |
| 只建 command bus | 最简单 | 无模块生命周期、角色 owner、reset、peer、journal；B 无稳定挂点 | 拒绝 |
| A/B 一次做完 | 少一次 seam 设计 | 把尚未冻结的双 slice 台账、淘汰和 selector 强塞进 A，审阅与变更面过大 | 拒绝 |
| 当前方案：A 执行骨架 + 五个冻结 seam | A 自身可用；B 只增加台账观察，不改执行语义 | 必须严格保持 seam 单点与公开签名 | 采用 |

### 2.2 右尺寸结论

- 不建 DI 容器、事件总线、codegen、运行期 schema、production shutdown 或 actor 取消协议。
- 不为两个几乎不可触发的合成 actor 名新建保留名表或机器门。
- 不把 `internal` 冒充权限系统；它是命令语义，不含 caller identity。
- 六字段 limits 一次冻结是跨单元接口成本；A 只消费三项，B 只能消费余下三项，不得另开配置口。

## 3. 包结构与唯一职责

### 3.1 生产文件

```text
apps/terminal/kernel/base/runtime/src/
  application/
    createRuntime.ts                 # 唯一 runtime 构造门面
    createInternalRuntimeModule.ts   # initialize、角色命令/actor/slice 的模块装配
    moduleManifest.ts                # kind=owner 与公开 manifest
  foundations/
    defineCommand.ts                 # branded command definition
    defineActor.ts                   # branded actor definition与 onCommand
    resolveModuleOrder.ts            # required/optional 拓扑排序
    createActorRegistry.ts           # actorKey、挂载与注册校验
    createCommandDispatcher.ts       # local/peer 分发、并发、timeout、aggregate
    createLifecycleEmitter.ts        # 契约二的唯一事实产生点
    createRuntimeLifecycle.ts        # start/reset 状态机
    createRuntimeJournal.ts          # 有界 FIFO 与订阅
    normalizeRuntimeError.ts         # AppError -> LedgerError
    cloneStateJsonValue.ts           # 一次遍历完成校验、克隆和计量
  features/
    commands/initialize.ts
    commands/setRuntimeInstanceMode.ts
    actors/setRuntimeInstanceModeActor.ts
    slices/runtimeInstanceMode.ts
  selectors/
    selectRuntimeInstanceMode.ts
  supports/
    errorKeys.ts
    limits.ts
  testing/
    releaseRuntimeForTest.ts         # 不从 package root 导出
  types/
    actor.ts
    command.ts
    execution.ts
    journal.ts
    limits.ts
    module.ts
    peer.ts
    role.ts
    runtime.ts
  index.ts
```

### 3.2 测试与工具文件

```text
apps/terminal/kernel/base/runtime/test/
  moduleSystem.test.ts
  visibility.test.ts
  dispatch.test.ts
  peerGateway.test.ts
  actorResult.test.ts
  lifecycle.test.ts
  reset.test.ts
  roleAndRoute.test.ts
  publicSurface.typecheck.ts

tools/terminal-runtime/
  check-static.mjs
  check-static.test.mjs
```

不新增第三方运行时依赖；复用 `@reduxjs/toolkit`、contracts、platform-ports、state。测试依赖复用仓内已选定的 Vitest 版本。

## 4. 精确公开面

### 4.1 包根 exact exports（58 项）

| 组 | 精确导出 |
|---|---|
| 元数据 3 | `moduleName`, `dependencyModuleNames`, `devDependencyModuleNames` |
| command 10 | `CommandVisibility`, `CommandTarget`, `CommandDefinition`, `DefineCommandInput`, `CommandIntent`, `CommandDispatchOptions`, `ActorDispatchOptions`, `DispatchedCommand`, `defineCommand`, `createCommand` |
| actor 7 | `ActorInfo`, `ActorExecutionContext`, `ActorCommandHandler`, `ActorCommandHandlerDefinition`, `ActorDefinition`, `defineActor`, `onCommand` |
| execution 7 | `LedgerError`, `ActorExecutionStatus`, `ActorExecutionRecord`, `CommandExecutionObservation`, `CommandAggregateStatus`, `CommandDispatchResult`, `aggregateCommandStatus` |
| peer 2 | `PeerDispatchOptions`, `PeerDispatchGateway` |
| module 6 | `RuntimeModulePreSetupContext`, `RuntimeModuleContext`, `RuntimeModuleResetInput`, `RuntimeRoleChangeEffect`, `RuntimeModule`, `RuntimeModuleDescriptor` |
| role 6 | `RuntimeInstanceMode`, `SetRuntimeInstanceModePayload`, `SetRuntimeInstanceModeResult`, `initializeCommand`, `setRuntimeInstanceModeCommand`, `selectRuntimeInstanceMode` |
| limits 9 | `RuntimeLimits`, `defaultMaxCommandDepth`, `defaultMaxCommandsPerRequest`, `defaultMaxActorResultBytes`, `defaultRequestRetentionMs`, `defaultRequestMaxResidenceMs`, `defaultMaxJournalRecords`, `defaultCommandTimeoutMs`, `defaultRuntimeLimits` |
| journal 3 | `RuntimeJournalEvent`, `RuntimeLifecycleObserver`, `RuntimeJournal` |
| runtime 5 | `RuntimeStatus`, `RuntimeStateInput`, `CreateRuntimeInput`, `Runtime`, `createRuntime` |

规则：`src/index.ts` 只从具名文件导出；不得导出内部 reducer/action、事实 transition、registry、错误 key、test cleanup 或深层子路径。

### 4.2 命令与分发类型

```ts
type CommandVisibility = 'public' | 'internal'

type CommandTarget = 'local' | 'peer'

declare const commandDefinitionBrand: unique symbol

type CommandDefinition<TPayload extends StateJsonValue = StateJsonValue> = Readonly<{
  moduleName: string
  commandName: string
  visibility: CommandVisibility
  timeoutMs: number
  allowNoActor: boolean
  allowReentry: boolean
  defaultTarget: CommandTarget
  readonly [commandDefinitionBrand]: (payload: TPayload) => TPayload
}>

type DefineCommandInput = Readonly<{
  name: string                    // 裸名，不得含点号
  visibility: CommandVisibility
  timeoutMs?: number
  allowNoActor?: boolean
  allowReentry?: boolean
  defaultTarget?: CommandTarget
}>

type CommandIntent<TPayload extends StateJsonValue = StateJsonValue> = Readonly<{
  definition: CommandDefinition<TPayload>
  payload: TPayload
}>

type CommandDispatchOptions = Readonly<{
  requestId?: RequestId
  commandId?: CommandId
  parentCommandId?: CommandId
  routeContext?: CommandRouteContext | null
  target?: CommandTarget
  onLifecycleEvent?: RuntimeLifecycleObserver
}>

type ActorDispatchOptions = Readonly<{
  requestId?: RequestId
  commandId?: CommandId
  parentCommandId?: CommandId
  routeContext?: CommandRouteContext | null
  target?: CommandTarget
}>
```

`defineCommand(moduleName, input)` 做构造期检查：moduleName 与裸名非空；裸名含 `.` 拒绝；timeout 必须为有限正数，未给时取 `defaultCommandTimeoutMs`；输出全名 `${moduleName}.${name}`。内部声明一个不导出的 `unique symbol`，对应必填 brand 字段的类型是 `(payload: TPayload) => TPayload`，由工厂写入恒等函数。该 phantom 同时让 definition 不可由外部伪造，并让不同 payload 类型的 definition 在结构上不可互换；五处 dispatch/onCommand 签名都从该字段推导 TPayload。

runtime 门面具有两组重载，且两组都接收完整身份 options：

```ts
dispatchCommand<T extends StateJsonValue>(
  definition: CommandDefinition<T>, payload: T, options?: CommandDispatchOptions
): Promise<CommandDispatchResult>

dispatchCommand<T extends StateJsonValue>(
  commandName: string, payload: T, options?: CommandDispatchOptions
): Promise<CommandDispatchResult>
```

字符串形式只查已注册完整定义，不用字符串临时造定义。public 命令缺 requestId 在派发前拒绝；internal 可无 requestId，也可携带 requestId。`internal` 不代表 caller 授权，UI/automation 是否能调用由上层 owner 约束，本包不虚构身份鉴权。

### 4.3 actor 类型和 exact context

actor 只能通过 `defineActor(moduleName, actorName, handlers)` 创建；`actorName` 是裸名，空串或包含 `.` 均在构造期拒绝；`actorKey` 固定 `${moduleName}.${actorName}`，无覆盖字段。该规则使业务 actor 结构上无法伪造包内 peer synthetic key。`onCommand` 只接 `CommandDefinition`，不得接字符串。

模块上下文 exact-set 为 9 项：

```ts
type RuntimeModuleContext = Readonly<{
  moduleName: string
  localNodeId: NodeId
  platformPorts: PlatformPorts
  descriptors: readonly RuntimeModuleDescriptor[]
  getState: () => StateRoot
  flushPersistence: () => Promise<PersistenceOperationResult>
  subscribeState: (listener: () => void) => () => void
  dispatchCommand: <T extends StateJsonValue>(
    definition: CommandDefinition<T>,
    payload: T,
    options?: CommandDispatchOptions,
  ) => Promise<CommandDispatchResult>
  installPeerDispatchGateway: (gateway: PeerDispatchGateway) => void
}>
```

actor 上下文 exact-set 为 11 项：

```ts
type ActorExecutionContext = Readonly<{
  runtimeId: RuntimeInstanceId
  localNodeId: NodeId
  platformPorts: PlatformPorts
  command: DispatchedCommand
  actor: ActorInfo
  getState: () => StateRoot
  dispatchAction: (action: UnknownAction) => UnknownAction
  flushPersistence: () => Promise<PersistenceOperationResult>
  subscribeState: (listener: () => void) => () => void
  dispatchCommand: <T extends StateJsonValue>(
    definition: CommandDefinition<T>,
    payload: T,
    options?: ActorDispatchOptions,
  ) => Promise<CommandDispatchResult>
  requestApplicationReset: (reason?: string) => void
}>
```

门的 expected 数组是上述手写清单，不从接口反射或源码派生。模块 dispatch 与 actor dispatch 都只接定义对象；字符串形式只存在于 runtime 门面。

`RuntimeModulePreSetupContext` 是只读子集：`moduleName`、`localNodeId`、`platformPorts`、同一份 `descriptors`。它不伪造尚未创建的 state 或 dispatch 能力。

### 4.4 执行记录

以下记录用 `type` 而非 `interface`，使其满足 `StateJsonObject` 的索引约束：

```ts
type LedgerError = {
  readonly key: string
  readonly code: string
  readonly message: string
  readonly category: AppError['category']
  readonly severity: AppError['severity']
}

type ActorExecutionStatus = 'running' | 'completed' | 'error' | 'timed-out'

type ActorExecutionRecord = {
  readonly actorKey: string
  readonly status: ActorExecutionStatus
  readonly startedAt: TimestampMs
  readonly completedAt: TimestampMs | null
  readonly result: StateJsonValue
  readonly error: LedgerError | null
}

type CommandAggregateStatus =
  | 'running'
  | 'completed'
  | 'partial-failed'
  | 'timed-out'
  | 'error'

type CommandExecutionObservation = {
  readonly commandId: CommandId
  readonly parentCommandId: CommandId | null
  readonly commandName: string
  readonly target: 'local' | 'peer'
  readonly allowNoActor: boolean
  readonly actorResults: readonly ActorExecutionRecord[]
  readonly startedAt: TimestampMs
  readonly completedAt: TimestampMs | null
  readonly displayMode: 'PRIMARY' | 'SECONDARY' | null
}

type CommandDispatchResult = {
  readonly requestId: RequestId | null
  readonly commandId: CommandId
  readonly status: CommandAggregateStatus
  readonly actorResults: readonly ActorExecutionRecord[]
}
```

`CommandExecutionObservation` 不存 payload、原始 definition、完整 command 或派生 status；status 始终由同一份 `aggregateCommandStatus` 从 observation 动态计算。单元 A 的 `displayMode` 唯一赋值为 `null`。

### 4.5 Runtime 门面与 journal 公开形状

```ts
interface Runtime {
  readonly runtimeId: RuntimeInstanceId
  readonly localNodeId: NodeId
  get status(): RuntimeStatus
  get failure(): AppError | null
  readonly descriptors: readonly RuntimeModuleDescriptor[]
  readonly journal: RuntimeJournal
  start(): Promise<void>
  getState(): StateRoot
  getStore(): EnhancedStore<StateRoot>
  dispatchCommand<T extends StateJsonValue>(
    definition: CommandDefinition<T>, payload: T, options?: CommandDispatchOptions,
  ): Promise<CommandDispatchResult>
  dispatchCommand<T extends StateJsonValue>(
    commandName: string, payload: T, options?: CommandDispatchOptions,
  ): Promise<CommandDispatchResult>
}

type RuntimeJournal = Readonly<{
  list: () => readonly RuntimeJournalEvent[]
  subscribe: (listener: (event: RuntimeJournalEvent) => void) => () => void
}>
```

`RuntimeJournalEvent` 是具名判别联合，公共字段固定为 `kind`、`occurredAt`、`runtimeId`、`localNodeId`、`requestId|null`、`commandId|null`、`parentCommandId|null`、`commandName|null`、`visibility`（internal/public 判别位）。各分支只追加：

| kind | 分支字段 |
|---|---|
| `command.started` / `command.completed` | `status`；completed 分支含 actor 状态投影，不含 result |
| `actor.running/completed/error/timed-out` | `actorKey`, `status`, `errorKey|null` |
| `actor.late-completed/late-error` | `actorKey`, `terminalStatus`, `errorKey|null` |
| `reset.reason-ignored` | `rootCommandId`, `keptReason`, `ignoredReason` |
| `reset.during-reset-ignored` | `rootCommandId`, `ignoredCommandId` |
| `command.depth-rejected` | `commandChain`（完整 commandName/commandId 投影） |
| `role.change-requested/role.changed` | `previousMode`, `nextMode` |

所有字段均为 `StateJsonValue` 可表达值；不含 payload、routeContext、actor result、raw Error 或未脱敏自由对象。

### 4.6 actor 返回值与聚合

handler 返回 `StateJsonValue | void | Promise<StateJsonValue | void>`。结算时一次深度遍历同时完成：

1. 拒绝 `undefined`（顶层 void 除外）、函数、symbol、bigint、循环、Date/非 plain object、NaN、Infinity；
2. 产生与 handler 对象脱钩的克隆；
3. 以 UTF-8 JSON 字节计量，超过 `maxActorResultBytes` 变为该 actor `error`；
4. 冻结保存的克隆；顶层 void 规范化为 `null`。

非法结果只使该 actor 失败，不使整个 `dispatchCommand` reject。

`aggregateCommandStatus` 必须按下列顺序短路：

0. `completedAt === null` 或任一 actor 为 `running` → `running`；
1. actor 空集 → `allowNoActor ? completed : error`；
2. 失败数为 0 → `completed`；
3. 全部失败且全部为 `timed-out` → `timed-out`；
4. 全部失败的其余组合 → `error`；
5. 成功与失败混合 → `partial-failed`。

不得改为并列布尔表达式。`completed + timed-out` 必须是 `partial-failed`，`error + timed-out` 必须是 `error`。A 只在命令终结时对外返回终态，但 rule 0 从第一天保留，供 B selector 直接复用。

## 5. 运行机制

### 5.1 模块解析与 descriptor

`RuntimeModule` 扩展 contracts 的 `AppModule` 描述，并持有 command definitions、actor definitions、state slice registrations 及 `preSetup/install/onApplicationReset` hooks。

解析顺序：

1. 把 runtime 内部模块固定放在 `modules[0]`，再接输入模块；
2. 拒绝重复 moduleName；
3. 对 required dependency 缺失报错；optional 缺失跳过；optional 已存在则参与图；
4. 拒绝环；
5. 稳定拓扑排序，同层保持声明顺序；
6. 生成并冻结唯一 descriptor 数组；preSetup、install、reset 复用同一数组引用；
7. command 是否存在以 owning module 的 `AppModule.commands` 为声明权威；运行期 visibility 只读已验证的 `CommandDefinition.visibility`。descriptor 的 `visibility` 缺省按 `public`，注册期必须与同名 definition 的 visibility 精确相等，否则拒绝。actor 可跨模块挂载定义对象，但 owning module 未声明的 command 一律拒绝；
8. 拒绝重复 commandName、重复 actorKey、同 actor 对同 command 的重复 handler。

模块排序只决定 preSetup/install 的启动顺序，不把 actor 执行串行化。actor 按注册顺序启动、并行等待、按启动顺序输出。

### 5.2 routeContext 与身份

- `runtimeId` 在 `createRuntime` 时调用 contracts 的 `createRuntimeInstanceId` 生成。
- `localNodeId` 是 `CreateRuntimeInput` 必填项；运行期不生成、不 fallback。缺失属于构造期程序员错误，立即 fail closed。
- actor 子命令默认继承父命令完整 `routeContext` 对象；显式传入则整体替换，绝不字段合并。
- A 不读 `workspace`、`instanceMode`、`displayMode`。
- runtime 把 routeContext 作为进程内参数交给 peer gateway；是否序列化由 transport 决定。runtime 不定义 wire 或入站解码。
- 父命令已有 requestId 时，actor 不得用另一个 requestId 覆盖；相同值可省略。父命令无 requestId 而子命令为 public 时，actor 必须显式提供 requestId。
- actor 上下文派发子命令时，`parentCommandId` 默认取当前 commandId；若显式提供，只允许等于当前 commandId，防止伪造本机子链。runtime 门面没有“当前 commandId”：它原样接受调用方提供的 parentCommandId，缺省为 null；跨机入站携带的对端 parent 不做本机相等校验。

### 5.3 重入和深度

- 运行栈以 actorKey + commandName 判断同 actor 重入；`allowReentry=false` 时只把该 actor 记录为 error，其他 actor 继续。
- 命令链保存完整 commandName/commandId 链。深度超过 `maxCommandDepth` 时拒绝新子命令，并把完整链写 journal。
- 单 request 命令数只定义字段和错误 key，不在 A 消费；B 只能接入相同分发入口。
- 保留三个错误 key：`actor_reentry_rejected`、`peer_gateway_not_installed`、`request_budget_exceeded`。

内部 peer 与 budget 记录由唯一 lifecycle emitter 直接构造，不注册为 actor，因此删除两个保留 actorKey 的“注册表占位”和保留名单，不新建门。peer 记录仍使用一个包内私有稳定常量 `kernel.base.runtime.peer-dispatch` 作为事实里的 actorKey；该常量不进入 actor registry，也不作为业务 actor 禁用名单。

### 5.4 actor timeout

每个 actor 使用 command definition 的 timeout。timeout 只结束该 actor 的观察记录，不取消 Promise、不建立副作用栅栏。迟到完成/失败：

- 不覆盖已终结 record；
- 只产生 `late-completed`/`late-error` journal event；
- 允许 handler 已发出的 port/dispatch 副作用继续；README 必须明确这一边界。

这是显式取舍，不把无法兑现的取消语义伪装成保证。

### 5.5 peer gateway

```ts
type PeerDispatchOptions = Readonly<{
  requestId: RequestId | null
  commandId: CommandId
  parentCommandId: CommandId | null
  routeContext: CommandRouteContext | null
}>

type PeerDispatchGateway = Readonly<{
  dispatchCommand: (
    command: CommandIntent,
    options: PeerDispatchOptions,
  ) => Promise<CommandDispatchResult>
}>
```

- module context 只允许安装一次；第二次安装 fail closed。
- peer target 未安装 gateway 时，命令正常返回 `status:error`，不 reject；产生一条 result=null、error key=`peer_gateway_not_installed` 的合成 actor record。
- 已安装时，发起侧恰有一条 peer actor record；对端 `completed` 映射 completed，`timed-out` 映射 timed-out，`error`/`partial-failed` 映射 error，result 恒 null。
- gateway 永不 resolve 时以 command timeout 收敛为 timed-out。
- peer 合成记录不进 actor registry，只进 lifecycle emitter。

### 5.6 单一事实产生点（跨单元契约二）

`createLifecycleEmitter` 暴露包内唯一 `emitLifecycle(transition)`。只有它可以：

1. 构造/推进 `ActorExecutionRecord`；
2. 构造 `CommandExecutionObservation`；
3. 更新 A 的进程内 command accumulator；
4. append journal；
5. 调全局与 per-dispatch observer（异常被记录并吞掉，不改变命令结果）。

transition 判别联合精确覆盖：command started/completed；actor running/completed/error/timed-out；actor 迟到完成/失败；第二次 reset reason；reset 中的 reset；深度超限完整链；角色切换 requested/changed 两跳。`command.started` transition 从 A 起就携带 `routeContext: CommandRouteContext | null`；A 只不透明搬运，不读取其中任何字段。observation 必须在处理 `command.started` 时创建，初值 `completedAt: null`，随后所有 actor 与 command.completed transition 只推进同一个 accumulator 条目，不在 completed 分支重新构造 observation。

正常 actor、peer gateway、gateway missing 三条合法构造路径都只能调用该函数。`journal.append` 在 `src` 只有一个调用点，`CommandExecutionObservation` 也只有此函数构造。

该函数不得把错误抛到 dispatch 边界：record 的 JSON 校验与克隆在进入 emitter 前完成；核心 accumulator 只用本地 Map/数组与已校验 transition；journal append、全局 observer、per-dispatch observer 分别包在独立 catch 中，失败只写到 platform logger 的脱敏 runtime scope，绝不写回 journal，避免 append 失败递归。内部 emitter 返回判别结果而不 throw；若核心不变量意外失败，dispatcher 把该次 actor 归一化为 error，命令仍以 `CommandDispatchResult` 结束。测试通过包内构造注入会失败的 journal adapter 与 observer，断言 emitter 返回失败投影但 `dispatchCommand` 不 reject；该注入点不从 package root 导出。

B 在事实链上的接入点是在此函数体追加台账 slice dispatch；不得另建 observation factory。A 在处理 command.started transition 并首次构造 observation 时，`displayMode: null` 只有一处，当前 transition 同时携带 routeContext；B 只把该表达式改为 `routeContext?.displayMode ?? null`，不改 transition 类型或调用点。角色清账另走契约三的 effect seam，不与本触点混称“唯一改动”。

### 5.7 logger 与 journal

- 每条命令以 platform-ports logger 派生 scope，固定关联 `runtimeId/localNodeId/requestId/commandId/commandName`，sessionId 由 `CreateRuntimeInput.getSessionId?: () => SessionId | null` 在记录时读取。
- payload、actor result、routeContext 不写日志。全包只有一个 `normalizeRuntimeError(unknown, commandContext)`：第一层用 `isAppError` 识别并原样透传既有 `AppError`，其余值通过 contracts 的 error 工厂补命令上下文形成 `AppError`；第二层只在 execution record 边界把该 `AppError` 投影为五字段 `LedgerError`。构造期程序员错误不走这条命令边界。
- journal 是进程内、FIFO、有界、不可持久化/同步的诊断记录；默认 1000。
- `RuntimeJournalEvent` 只含身份、阶段、actorKey、status、错误 key、时间和必要链路，不含命令 payload 或 actor result。
- observer throw 只记录诊断，不破坏派发。

### 5.8 启动状态机

`createRuntime(input)` 是唯一构造路径，返回 `Runtime`，不自动 start：

```ts
type RuntimeStatus = 'created' | 'starting' | 'started' | 'failed'

type RuntimeStateInput = Readonly<{
  runtimeName: string
  environmentMode: EnvironmentMode
  persistenceKey: string
  storageTimeouts: StateStorageTimeoutPolicy
  persistenceDebounceMs: number
  storeEnhancers?: readonly StoreEnhancer[]
}>

type CreateRuntimeInput = Readonly<{
  localNodeId: NodeId
  modules: readonly RuntimeModule[]
  platformPorts: PlatformPorts
  state: RuntimeStateInput
  limits?: Partial<RuntimeLimits>
  getSessionId?: () => SessionId | null
  onLifecycleEvent?: RuntimeLifecycleObserver
}>
```

到 `CreateStateRuntimeInput` 的十字段映射必须逐项固定：`runtimeName`、`environmentMode`、`persistenceKey`、`storageTimeouts`、`persistenceDebounceMs`、`storeEnhancers` 来自 `RuntimeStateInput`，其中前五项必填、只有 `storeEnhancers` 可缺省；`slices` 由内部角色 slice 加已排序模块 slice 派生；`logger` 取 `platformPorts.logger`；`plainStorage` 取 `platformPorts.persistKv`；`protectedStorage` 取 `platformPorts.persistSecure`。`runtimeName` 只作为 state logger component，不参与存储命名空间，装配方仍必须为并存 runtime 提供可区分名称。

启动阶段固定为：

1. 按模块顺序执行 `preSetup`；
2. 收集内部和业务 slice 后 `await createStateRuntime`，hydrate 完成前 store 不可见；
3. 用新建 module context 按顺序 `await install`；
4. 派发 `initializeCommand` 并 await typed result；只有聚合状态为 `completed` 才进入 `started`，`error`、`partial-failed`、`timed-out` 或意外 `running` 一律形成专用 AppError 并进入不可逆 `failed`。

`initializeCommand` 是内部模块声明的 internal、allowNoActor 命令，业务 module 可用 definition 对象挂 actor。

并发调用 `start()` 在 starting 时返回同一个 Promise；started 时返回已完成结果；任一阶段失败进入不可逆 `failed`。当前模型没有“非关键模块”分类，因此 initialize 非 completed 采用 fail-closed 是对既有阶段失败规则的收口，不新增产品轴；未来若要允许非关键模块降级启动，须由 Dexter 另行裁定并先增加模块 criticality 语义。

`status` 与 `failure` 必须实现为读取内部可变状态的 accessor，不能在 `createRuntime` 返回时复制快照。本段的可用性限制只约束 `Runtime` 门面的 `getState()`/`getStore()`：created 或 starting 阶段同步抛 runtime-not-started AppError；failed 阶段同步抛保存的 failure；started 后正常可用。`RuntimeModuleContext.getState` 在阶段二 store 建成后供阶段三 install 正常使用，`ActorExecutionContext.getState` 在阶段四 initialize actor 中正常使用；它们是直接绑定已建 StateRuntime 的上下文函数，不委托 Runtime 门面，也不受 Runtime status 限制。`start()` 与 `dispatchCommand()` 是异步 API，因此以 Promise reject 表达门面未启动/失败。

不建 production shutdown。包内 `testing/releaseRuntimeForTest.ts` 通过 WeakMap 只释放 runtime 自己登记的订阅和 timeout；不从 package root 导出，不修改 state 包 API。

### 5.9 reset

`requestApplicationReset(reason?)` 只在 actor context 暴露：

1. 以根 commandId 记录 pending reset；同根第二次 reason 保留第一条，第二条只进 journal；
2. 根命令未终结时不 reset；
3. 根命令终结后捕获 `previousState`；
4. 调用 state 包授权的 `StateResetActor.handleResetCommand()`；不得直接调用或导出根级 `resetState()`/Redux reset action。失败时 reset 失败、内存保持 state 包承诺，不静默继续；
5. 为每个 module 新建上下文，按模块顺序 await `onApplicationReset({reason, previousState})`；
6. 重新派发并 await initialize；
7. reset 执行期的新 reset 忽略并进 journal；
8. 清理 pending 标记。

reset 不导出根级 Redux action，不绕过 TR-01；角色 slice 的恢复依赖 state persistence，而不是外部根写。

### 5.10 角色 owner 与跨单元契约三

内部模块拥有：

- slice name：`kernel.base.runtime.instance-mode`；state `{ instanceMode: 'MASTER' | 'SLAVE' }`；默认 MASTER；
- persistence：owner-only、field 粒度、plain、immediate、isolated；
- `setRuntimeInstanceModeCommand`：internal；payload `{ instanceMode }`；
- actor：先串行执行 role-change effects，再 dispatch 私有 reducer action。

若目标等于当前值，返回 `{changed:false, previousMode, currentMode}`，不执行 effects；否则任一 effect 失败均不写角色字段，命令 actor error。effects 按注册顺序、写字段之前执行。

B 只注册“清旧角色 ledger”effect，不修改该 actor。`selectRuntimeInstanceMode` 是唯一公开具名 selector，供 display-context 读取。

`internal` 不能机械阻止 UI/automation；本设计明确不同意需求 §4.8a 中“internal 使它只能被模块内 actor 发出”的理由句，因为公开的 command definition 可被任意持有它的 actor 派发。A 只冻结“不由 UI 直接调用”的 owner 约定。若未来要求 caller 级授权，必须由 Dexter 扩大范围，不能在 A 偷加 caller 分类学或把假保护恢复回来。

### 5.11 limits

```ts
type RuntimeLimits = Readonly<{
  maxCommandDepth: number
  maxCommandsPerRequest: number
  maxActorResultBytes: number
  requestRetentionMs: number
  requestMaxResidenceMs: number
  maxJournalRecords: number
}>
```

具名默认值：

| 字段 | 默认 | A 中用途 |
|---|---:|---|
| maxCommandDepth | 32 | 消费 |
| maxCommandsPerRequest | 256 | 只冻结，B 消费 |
| maxActorResultBytes | 262144 | 消费 |
| requestRetentionMs | 1800000 | 只冻结，B 消费 |
| requestMaxResidenceMs | 7200000 | 只冻结，B 消费 |
| maxJournalRecords | 1000 | 消费 |
| defaultCommandTimeoutMs | 60000 | command definition 缺省；不属于 RuntimeLimits 六字段 |

所有 override 必须为有限正整数，并同时满足：

1. `requestMaxResidenceMs >= 4 * requestRetentionMs`；
2. `requestMaxResidenceMs > maxCommandDepth * maxRegisteredCommandTimeoutMs`，其中 `maxRegisteredCommandTimeoutMs` 是模块解析后所有已注册 command definition 的最大 timeout；没有业务 command 时至少使用 `defaultCommandTimeoutMs`。

第二条是对“最长可能在途命令链”的真实约束，比只乘缺省 timeout 更严格；缺省值下 7,200,000ms 同时大于四倍 retention 与 32×60,000ms。若模块定义更长 timeout，构造期必须按实际最大值重新校验，不能让 B 的无条件最长驻留淘汰删掉仍在途 request。这些是可配置工程默认，不是产品上限。B 只能开始消费已冻结的后三项，不改字段、默认或入口。

## 6. contracts 与 kind 迁移

### 6.1 contracts 第三组七处

逐项实施，不重新推导：删除 `AppModuleMiddlewareDescriptor`；删除 `AppModule.middlewares`；根导出删除；typecheck import 删除；fixture 引用删除；checker expected export 删除（74→73）；README middleware 描述删除。

### 6.2 contracts 第四组九处

逐项实施，不重新推导：error 两个 catalog 类型；parameter 两个 catalog 类型；其孤立 `TimestampMs` import；index 四导出；public-surface typecheck 四 import/再导出；contracts test 的 `ResolvedParameter` 与 T-6 block；checker 四 literal union/expected export；README error 文案；README parameter 文案。最终 contracts exact exports 为 69。

### 6.3 runtime kind

- `apps/terminal/skeleton-graph.ts` 只移除 runtime 的 `plannedKind`，依赖边不变。
- `src/application/moduleManifest.ts` 写 `kind: 'owner'`，同时声明角色 slice。
- graph model 从每个包“plannedKind 或 module manifest kind 二选一”解析；两者同时有或同时无均红。
- owner-kind 门断言 owner 至少一个 slice、slice 前缀属于 moduleName；runtime 满足。
- TR-04 正向恢复门以角色字段重启恢复为对象；A 不为凑 B 的反向门制造“永不恢复”字段。

## 7. 测试与机器门

### 7.1 测试用例矩阵

每例必须写正断言、反断言和所证伪缺陷；不能只断言“不抛错”。

| 组 | 用例与正/反断言 | 证伪缺陷 |
|---|---|---|
| M-1 | required 缺失、环、重复 moduleName 各拒绝；optional 缺失跳过、存在则参与排序 | 排序器只检查部分图 |
| M-2 | 同层保持声明顺序；preSetup/install 收到同一 descriptors 引用 | 阶段间排序/描述符漂移 |
| M-3 | 重复 actorKey、重复挂载拒绝；跨模块 definition 挂载成功；owner 未声明的命令挂载失败 | 字符串挂载逃逸 owner |
| M-4 | 两个模块声明重复 slice 名时由 state registration 校验拒绝；runtime 不吞错、不改名 | runtime 绕过 state 的唯一 slice 名约束 |
| V-1 | public 无 requestId 拒绝；有 requestId 成功 | public 请求不可关联 |
| V-2 | internal 无 requestId 成功且结果 requestId=null；带 requestId 也成功 | internal 被误作 access control |
| V-3 | initialize 不再被伪造 requestId | 内部生命周期污染台账 |
| V-4 | 两种门面均保留四身份 options；门面缺省 parent=null 且原样保留外部 parent；未知字符串名拒绝 | 入站临时造定义、根自成其父或跨机 parent 丢失 |
| V-5 | descriptor visibility 缺省 public；与 definition 不同则注册失败；相同则分发只读 definition | 双声明源导致审计与运行相反 |
| D-1 | 多 actor 同步启动、完成顺序打乱但 actorResults 保持启动序 | 输出顺序取完成时序 |
| D-2 | 在 `completedAt !== null` 前置下断言 allowNoActor 空集正/反；重入只使一个 actor error；其他 actor 继续 | rule 0 掩盖空集规则或一 actor 失败中断整体 |
| D-3 | 深度 32 成功、33 拒绝且 journal 有完整链 | 环路没有可诊断边界 |
| D-4 | rule 0：completedAt=null 或含 running 均 running | A 省略 rule 0 导致 B 接入即错 |
| D-5 | 在 `completedAt !== null` 前置下断言 completed+timed-out=partial-failed、error+timed-out=error、全 timed-out=timed-out | rule 0 掩盖判别链或旧 timeout 聚合 |
| N-1 | command 裸名含点、空名、非正有限 timeout 拒绝 | 全名逃逸与无限 timeout |
| N-2 | actor 裸名含点或为空时构造期拒绝 | 业务 actorKey 伪造 peer synthetic key |
| P-1 | gateway 未安装返回 error 记录且不 reject | 缺能力变成异常 |
| P-2 | gateway 成功/失败/partial/timeout 映射，result 恒 null | 远端复杂结果冒充本地 actor |
| P-3 | 重复安装拒绝；gateway 收到 routeContext 同一对象引用和四身份 | 多网关/routeContext 丢失 |
| P-4 | 按字符串入站复用完整注册 definition；对端收到本机声明 `allowNoActor:true` 且本机无 actor 的命令时返回 completed 而非 error | 入站绕过 timeout/visibility 或丢失 allowNoActor |
| R-1 | void→null；合法对象保存为脱钩冻结克隆 | actor 后续修改历史 |
| R-2 | NaN、Infinity、undefined、函数、Date、循环、bigint、超限逐项变 actor error，dispatch 不 reject | 非 JSON 结果污染台账 |
| R-3 | handler timeout 后 record 不变；迟到结果只进 journal；后续合法 dispatch 可用 | 迟到覆盖终态或 runtime 被毒死 |
| R-4 | actor 抛 AppError 时 key/code/category/severity 原样投影；抛普通 Error 时先形成带 command context 的 AppError 再投影 | 跳过统一错误协议或二次包装 AppError |
| J-1 | journal 1001 条只保留后 1000；订阅按序；observer throw 不影响 dispatch | 无界增长或观察者破坏业务 |
| J-2 | 注入 journal append/observer 失败，emitter 不把异常抛到 dispatch；命令以 typed result 结束 | lifecycle 支撑故障击穿分发边界 |
| L-1 | start 四阶段严格有序、同一 descriptors、显式 await | 声称阶段与真实行为不符 |
| L-2 | start 失败后 status=failed；Runtime 门面的 start/dispatch 异步 reject、门面 getState/getStore 同步 throw；install 与 initialize context 的 getState 正常可用 | 半启动 runtime 继续工作或门面限制误伤内部阶段 |
| L-3 | initialize actor 返回 error、partial-failed、timed-out 时 start 均 reject 且 status=failed；completed 才 started | initialize 失败却启动成功 |
| L-4 | test-only release 真取消登记资源；root exports 不含 cleanup | 测试泄漏或 production shutdown 扩面 |
| X-1 | reset 等根命令终结；previousState 在 state reset 前；新 module context；initialize 重播 | reset 顺序错误 |
| X-2 | 第二个 reason、reset 中 reset 都忽略且 journal 可见；state reset 失败不执行后续 | reset 洞与静默成功 |
| I-1 | 默认 MASTER；角色重建后从同 storage 恢复；descriptor 为 isolated | 角色不符合 TR-04 或被同步 |
| I-2 | role effects 顺序先于字段写；effect 失败字段不变；同值幂等不跑 effect | B 清账晚于角色翻转 |
| I-3 | 伪造包含角色 slice 的 inbound sync payload/diff 被 state 的 isolated 规则拒绝，角色不变 | isolated 只写在 descriptor 而同步仍可覆盖角色 |
| C-1 | 子命令默认继承完整 routeContext；显式对象整体替换 | 字段级合并或 routeContext 丢失 |
| T-1 | 三个 record 可赋给 StateJsonValue；不同 branded ID 不可互传 | 记录不能进入 B slice |
| T-2 | 两个 context exact-set：缺字段、增字段都让 type/static fixture 红 | 上下文无边界扩张 |
| T-3 | 字符串不能用于 onCommand；手造 definition/actor 不可通过 brand | 绕过 owner 声明 |
| T-4 | 删除一行 `@ts-expect-error` 后 typecheck 红；tsconfig include test | 负夹具未进入编译面 |
| T-5 | A command definition 配 B payload 以 `@ts-expect-error` 固定为编译失败；正确 payload 可推导通过 | 未使用泛型使任意 payload 可配任意命令 |

A 期 peer “已派出未回时为 running”没有公开观察口，列入 §10.2 人工审查；不得写测试自有局部变量冒充端口产出。B 通过 selector 建立可观察面后补运行断言。

### 7.2 runtime 静态门

`tools/terminal-runtime/check-static.mjs` 的 expected 均手写，不从源码派生：

1. `RUNTIME_CONTEXT_EXACT_SET`：模块 9 / actor 11；
2. `RUNTIME_COMMAND_MOUNT_SHAPE`：definition brand、无字符串 onCommand、owner command 声明闭合；
3. `RUNTIME_OWNER_KIND`：manifest owner、至少一 slice、plannedKind 已删；
4. `RUNTIME_RESTART_POSITIVE`：角色 descriptor 持久化且测试存在跨 runtime 恢复用例；
5. `RUNTIME_PUBLIC_SURFACE` support：58 exact exports。

单一事实产生点不得建成机器门或 support marker：标识符/调用次数扫描无法证明语义唯一，换名或 helper 转发即可假绿。它只进入 §10.2 的人工源码审查；实施证据可附结构扫描，但不得称为 machine PASS。

| 门/support | 反例边界 |
|---|---|
| RUNTIME_CONTEXT_EXACT_SET | 只证明声明字段集合，不证明字段在运行期被正确消费 |
| RUNTIME_COMMAND_MOUNT_SHAPE | 只证明挂载形状与声明对账，不证明业务 actor 行为正确 |
| RUNTIME_OWNER_KIND | 只证明 owner/slice 形态，不证明持久化或同步运行语义 |
| RUNTIME_RESTART_POSITIVE | 仅作“owner-only descriptor + 跨 runtime 恢复用例存在”的存在性扫描，不证明恢复语义真实正确；反向断言本批无对象可测，B 交付 never-persisted 台账后补齐 |
| RUNTIME_PUBLIC_SURFACE | 只证明导出名字 exact-set，不证明每个类型语义正确 |

每道 rule 与 support 都要真实树绿和定向 red；red 只改变一个事实，并断言其他门仍 PASS：

- context：给 actor context expected 删除 `localNodeId`，只该门红；
- mount：把一个 onCommand 改为字符串名，只 mount 门红；
- owner：恢复 skeleton plannedKind 或删 manifest slice，只 owner 门红；
- restart：把角色 persistence 改 `never`，只 restart 门红；
- public：删除一个手写 expected export，只 support 红。

### 7.3 A-5 八处验证工具落点

1. `verify.mjs` 增 `runtimePackageName` 并加入 `terminalTestOwners`；
2. 新建手写 `terminalRealTestOwners` = contracts/platform-ports/state/runtime；
3. marker exact-set 分别验证 all owners、REAL owners、差集 NO_TEST owners，删除 `real.length !== 3`；新增 REAL/NO_TEST 精确集检查固定放在 contracts/platform-ports/state 三条既有 per-package 断言之后，保证第 6、7 项仍先命中原有定向错误消息；
4. `verify.test.mjs:14–23` test task owner 正例加 runtime；
5. `25–49` marker 正例加 runtime REAL，real=4、noTests=5；
6. `57–69` platform-ports 错误夹具补 runtime marker，仍定向命中 platform-ports；
7. `70–82` state 错误夹具补 runtime marker，仍定向命中 state；
8. `83–96` 不补 runtime，把期望错误从 count mismatch 改为 package mismatch（missing runtime、extra ui-support-test-harness）。

`50–56` 保持原字节。另在 `verify-static.mjs` 注册 `runtime-model-test` 与 `runtime-real-static`；否则门未进入 TER-local 闭包。

runtime test marker 固定：

```text
TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/kernel-base-runtime
```

只允许运行 TER-local `verify:static` 与 `verify`；不运行仓级 normal verify。

## 8. 文件变更清单

### 8.1 新增

- §3.1 除既有 skeleton 元数据文件外的全部 production 文件；每个文件只承担表中职责。
- §3.2 九个 test 文件。
- `tools/terminal-runtime/check-static.mjs`、`check-static.test.mjs`。
- runtime 中文 `README.md`，覆盖定位、作用、结构、用法和“在这个包上迭代时”。
- runtime `HANDOFF.md`，逐项承接需求 §7 的跨包欠账、owner、触发批次与失效边界；不得用 CP-A0 重扫替代欠账登记。

### 8.2 修改

- runtime `package.json`、`tsconfig.json`、`src/index.ts`、`src/dependencies.ts`。
- contracts 第三组七处、第四组九处。
- `apps/terminal/skeleton-graph.ts`。
- `tools/terminal-skeleton/graph-model.mjs`、`verify-static.mjs`、`verify.mjs`、`verify.test.mjs`。
- TER 相关 checker expected 与 README（只限上述 owning source）。

不得修改 platform-ports/state 生产源码、其他 TER 包、adapter/native、assembly 或仓级 normal verifier 语义。

## 9. 实施步骤与停机条件

### CP-A0：A 实际消费面的有限定向核验

实施入口前只核 A 真实消费的有限集合：contracts 的 ID/error 工厂与 `AppModule` 描述；platform-ports 的 logger/persistKv/persistSecure；state 的 `CreateStateRuntimeInput` 十字段、slice registration、getStore/getState/flushPersistence、`getResetActor().handleResetCommand()` 与 isolated sync 拒绝。逐项把真实签名回填 §5.8、§5.9、§5.11；任一不一致先修详设，未闭合不得进入 CP-A1。

完成信号：上述有限清单逐项有当前源码引用，且 createRuntime 的入参与调用形状完全对齐。

需求 §7 记录的 contracts、platform-ports、state 三包全量 fresh 独立重扫作为并行欠账执行：各由一个 fresh 只读 agent 从原需求/详设、当前生产源码、POC、项目记忆重建 API、行为、失败/恢复与边界，结论回填需求 §7 和本包 HANDOFF。它不阻断 CP-A1/CP-A2；若发现推翻 A 前提的事实，则对应 CP 立即停机并回源处置。定向核验和全量重扫不得互相冒充。

### CP-A1：契约收窄、类型与纯 foundations

完成 contracts 7+9 删除；落下 command/actor/record/limits 类型、定义工厂、返回值 clone、aggregate、error normalize；public surface checker 先红后绿。

完成信号：contracts exact 69，runtime exact 58；类型夹具和纯函数测试绿。

### CP-A2：模块、state、角色与启动

落下 resolver、内部模块、角色 slice/selector/effect seam、manifest owner、createRuntime 四阶段；完成 kind/role/static gates。

完成信号：模块与 lifecycle focused tests 绿；runtime plannedKind 移除且 graph model 绿；角色重启正向证据绿。

### CP-A3：dispatcher、peer、唯一事实点与 reset

落下 registry、dispatcher、gateway、lifecycle emitter、journal、timeout、reset；确保三合法路径与 observation 只在 emitter 构造。

完成信号：D/P/R/J/X/C 全组绿；single emitter checker 正反控制绿。

### CP-A4：TER-local 接线、README 与收口证据

完成 A-5 八处、verify-static 两项、runtime test owner、README、HANDOFF 欠账台账；执行获授权的 TER-local typecheck/test/static/export 闭包并记录新鲜输出。

完成信号：9 test owners、4 REAL、5 NO_TEST；runtime marker 被消费；TER-local verify 绿；不把 Expo export 升格为 native/Gradle/设备证明。

每个 CP focused proof 后、下一 CP 前，须由 fresh 独立子 agent 按需求、详设、项目记忆做三维证伪式对账；全 CP 后、整体验收前另做一次全范围对账。

### 9.1 不得自行决定

出现以下任一项立即停机：

- 需要改变 §0-A 分母或五个 cross-unit seam；
- 需要增删 58 项公开面、命令/actor/context 精确形状；
- 需要新增依赖、图出边、caller 权限系统、wire/入站解码；
- 无法让三合法记录路径汇入单一 emitter；
- localNodeId 无法由装配方提供；
- 需要定义 B 的 slice、selector、淘汰、latest-wins 或 route display 语义；
- 需要 actor 取消/副作用栅栏或 production shutdown；
- 任一 red fixture 不红、真实树不绿、contracts/state/platform-ports gate 漂移；
- REAL_TESTS owner 分母不是 4，或 A 人工复核九项无法逐项成立。

## 10. §9 问题显式回答与人工审查

### 10.1 九问回答

1. **聚合穷尽性**：A 的第一级六条有序规则穷尽五种状态；不一致输入优先按 rule 0 保守为 running。第二级请求聚合归 B。
2. **route null**：A 只不透明传递，observation 固定 null；UI 展示语义归 B，不在 A 决定。
3. **角色翻转与淘汰**：淘汰/清旧 ledger 归 B；A 的有序前置 effect 足够，effect 失败会阻止角色字段写入。
4. **闭集 checker**：归 B；A 不改 optional-union/ledger 闭集门。
5. **contracts 第三/四组**：接受冻结 7/9 落点，不重算；实施以 exact 69 对账。
6. **状态类型归属不对称**：归 B。
7. **复杂度必要性**：actor result 是 dispatch 返回的真实中间结果；peer projection 避免把远端明细冒充本地 actor；第一级 aggregate 是 A 返回值必需。B 的台账复杂度不提前引入。
8. **A/B 切分**：只有契约一/二/三、约束四、B→A 单点五个 seam 同时成立才合理。把 aggregate 推 B 不成立，因为 A 已必须返回 status。
9. **过度/不足**：过度设计项是两个合成 actorKey 保留名，因内部记录不进 registry，本设计删除。当前不足是 internal 没有 caller 授权语义；本批诚实登记，不自行加分类学。

### 10.2 A 收口人工审查九项

1. `src` 只有一个 lifecycle 事实构造函数；正常 actor、peer、gateway missing 都经它；observation 只在那里构造。
2. 角色变化副作用 seam 存在、按序且全部发生在角色字段写入前；B 可注册清旧 ledger effect 而不改 actor。
3. 按定义对象与按全名两种门面都把 requestId、commandId、parentCommandId、routeContext 交到同一分发入口。
4. lifecycle emitter 的 core、journal 与 observer 任一失败均不向 dispatch 边界抛；每 actor catch 仍把命令收敛为 typed result。
5. runtime 只有 `createRuntime` 一条构造路径，start 四阶段不另有旁路。
6. peer 已派出未回期间的内部 observation 为 running；A 无公开观察口，因此用代码路径审查，不写自证测试。
7. 全包只有一个 `normalizeRuntimeError`，并完成 `unknown → AppError → LedgerError` 两层闭包。
8. 公开面和深层源码均无 request 专用读取入口、台账 selector 或 request map。
9. A 不读 routeContext 的 workspace、instanceMode、displayMode；只整体继承/替换并交给 gateway。

补充人工检查（不替代上述九项）：timeout 不取消副作用；context 保持 9/11 exact-set；合成 peer key 不进 actor registry；internal 不被描述为权限；limits 只有一份；A-5 分母为 9/4/5。

## 11. 跨切面矩阵

| 维度 | 本批设计 |
|---|---|
| 行为 | 模块装配、command/actor、peer、start/reset、role |
| 形态 | 58 exact exports；module 9 / actor 11 exact context |
| 动作 | 两种 runtime dispatch；actor 只按 definition dispatch |
| 关系 | contracts/platform-ports/state 三依赖；无新出边 |
| 位置 | 四层结构内的 runtime owner；角色 slice 属内部模块 |
| 限制 | 六字段 limits、命令 timeout、result bytes、journal FIFO |
| 状态/控制 | runtime 四态、actor 四态、command 五态、角色两态 |
| 失败/恢复 | actor 失败归一化；start failed 终态；角色持久化；reset 两阶段 |
| 数据来源/失效 | module declarations、state runtime、platform ports；routeContext 不解释 |
| 用户可见文案 | N/A：无 UI、无 Journey 文案 |
| 可访问性/焦点 | N/A：无 UI surface |
| HTTP/数据库/migration/seed | N/A：本包无 HTTP、DB schema、migration、fixture 或 seed |
| native/设备 | N/A 且未授权；静态/typecheck/export 不证明 native |

## 12. README 必须写明

1. runtime 的定位、四层位置、目录与最小用法；
2. start 必须显式 await；失败后不可继续；
3. actor 并行、结果按启动序；timeout 不取消也不围住副作用；
4. routeContext 只不透明搬运，wire 属 transport；
5. internal 不是 caller 权限；
6. journal 有界、内存态、不存 payload/result、不持久化；
7. reset 顺序与两个 ignored 分支；
8. reset 会重跑 initialize，因此每个模块的 initialize actor 必须可重复执行并自带幂等保证；
9. 角色是 owner-only isolated persistence，切换 effect 先于写字段；
10. 单元 A 不含请求台账、selector、淘汰、latest-wins；
11. state subscription 内派发命令的模块必须自带幂等判据；runtime 不替业务发明幂等键；
12. T1 主机主屏 + 副机副屏、T2 主机主屏 + 副机主屏、T3 单机双屏（单 VM / 单 store / 多 surface）三种部署形态，以及本包只承载 routeContext、不派生、不做准入；角色 slice 绝不进入同步；
13. actor 超时后仍运行；若它在 timeout 之后继续派发子命令，原执行栈的重入/深度保护不再构成取消保证，这是已知边界；
14. “在这个包上迭代时”：新增生命周期事实必须进唯一 emitter；新增 context 字段、公开导出、limits 或第二 gateway 必须先改设计和门。

`HANDOFF.md` 必须单列：角色值会持久化，但角色切换的业务留痕只在内存 journal，重启后不存在；B 的 never-persisted 台账也不能补足持久审计。若产品需要跨重启的角色变更审计，应由后续 owner/审计设计接管，不能把 journal 改成持久化作为临时解。

## 13. 未验证边界与评审交付

| 项 | 状态 |
|---|---|
| 本详设与冻结需求 exact 分母 | 静态设计已覆盖，待独立 DESIGN review |
| 三个前置包 A 消费面定向核验 | `UNVERIFIED_REQUIRES_EVIDENCE`，CP-A0 阻断 CP-A1 |
| 三个前置包全量独立重扫 | `UNVERIFIED_REQUIRES_EVIDENCE`，按需求 §7 并行回填，不阻断 CP-A1/CP-A2；若推翻 A 前提则对应 CP 停机 |
| 类型、测试、静态门实际运行 | `UNVERIFIED_REQUIRES_EVIDENCE`，本轮未授权运行 |
| actor 超时后的真实 port 副作用 | 设计明确不取消；未做动态证明 |
| transport 是否序列化 routeContext | `NOT_OWNED_BY_RUNTIME` |
| Unit B 请求台账、selector、淘汰、显示语义 | `UNIT_B_NOT_DESIGNED_HERE` |
| caller 级 internal 授权 | `UNVERIFIED_PRODUCT_NEED`；需 Dexter 扩范围才建设 |
| native/Gradle/设备/用户行为 | `NOT_APPLICABLE_TO_THIS_DESIGN` 且未授权 |

本设计交付后只进入独立 `REVIEW_TARGET=DESIGN`。在 GO 与后续明确实施授权之前，不得开始 CP-A0 或任何源码改动。

## 14. Claude DESIGN review 辩证 intake

评审来源：`doc/review/platform/2026-09-01-v2s-terminal-kernel-base-runtime-unit-a-design-review-claude.md`。全部 finding 均重新对照当前需求、详设和 owning source 判定；本节是处置记录，不代替独立 verdict。

| Finding | 分类 | 处置 |
|---|---|---|
| M-1 routeContext 触点 | CONFIRMED | command.started transition 从 A 起携带 opaque routeContext；A 仍只赋 null，B 只改一处表达式 |
| M-2 initialize 失败 | CONFIRMED | 采用 fail-closed：非 completed 均 failed；当前无 noncritical 模型，因此不是新增产品分类。若未来要降级启动再交 Dexter |
| S-1 parentCommandId | CONFIRMED | actor 子命令与 runtime 门面分域；门面缺省 null、原样接受外部 parent |
| S-2 synthetic actorKey | CONFIRMED | 不恢复无效保留表；defineActor 裸名禁点号，使碰撞结构上不可能 |
| S-3 visibility 双源 | CONFIRMED | descriptor 缺省 public，注册期与 definition 对拍，分发只读 definition |
| S-4 A-5 检查定序 | CONFIRMED | REAL/NO_TEST exact-set 固定放三条 per-package 断言之后 |
| S-5 TR-04 反例栏 | CONFIRMED | 五道门/support 补反例边界，登记 B 期反向断言与存在性扫描限制 |
| S-6 residence 上限 | CONFIRMED | 同时约束 4×retention 与 maxDepth×实际最大 command timeout |
| S-7 CP-A0 位置 | CONFIRMED | 拆成阻断性的有限消费面核验与不阻断的并行全量重扫 |
| N-1 result 摘要 | CONFIRMED | §1.4 与类型统一为 StateJsonValue |
| N-2 “B 唯一改动” | CONFIRMED | 区分 emitter 接入与角色 effect seam，只保留 displayMode 单赋值触点 |
| N-3 state 十字段 | CONFIRMED | RuntimeStateInput 补两个必填项并列出十字段逐项来源 |
| N-4 Runtime 状态/API | CONFIRMED | status/failure 明确 accessor；同步 getter throw，异步 API reject |
| N-5 三个未导出 alias | CONFIRMED | 实现以 `state` 已公开类型反向推导三个未导出类型表达式，避免直接导入 RTK，并避免业务包长期持有 Redux 原生 store；不新增具名公开 alias，exact exports 在 Dexter 的 S-7 方案 C 裁定后为 58 |
| N-6 journal failure 诊断 | CONFIRMED | 只降级写 platform logger，禁止写回 journal 递归 |
| N-7 internal 假保护 | CONFIRMED_REQUIREMENTS_DEFECT | 显式记录与需求理由句相反；不恢复 caller 假保护 |
| N-8 测试前置/peer 断言 | CONFIRMED | 补 completedAt 前置、外部 parent、visibility、actor 名、initialize fail-closed 与 peer allowNoActor |
| N-9 README/HANDOFF | CONFIRMED | 补 initialize 幂等责任与跨重启角色审计欠账 |

本轮只修改本详设；没有修改 TER 源码、需求正本或评审文件，也没有执行测试、动态环境或数据动作。

## 15. 第二轮定向 recheck 与 SELF_DECIDED 收口

第二轮来源：`doc/review/platform/2026-09-01-v2s-terminal-kernel-base-runtime-unit-a-design-review-round2-claude.md`。

| Finding | 分类 | 处置 |
|---|---|---|
| S-8 同名 getState 误伤 context | CONFIRMED | Runtime 门面在 created/starting throw；阶段二后 module/actor context 直接绑定 StateRuntime，不委托门面 |
| S-9 CommandDefinition 泛型未绑定 | CONFIRMED | 不导出 unique symbol brand 的值类型参数化为 `(payload: TPayload) => TPayload`；T-5 负夹具锁定 definition/payload 配对 |
| N-10 L-3 重号 | CONFIRMED | test-only release 改为 L-4，测试追溯键恢复唯一 |
| N-11 routeContext 留存点 | CONFIRMED | observation 固定在 command.started 创建，routeContext 当场可用；后续只推进同一 accumulator 条目 |

`ROUND_FINAL_DECISION=SELF_DECIDED`：两轮 review 的全部 finding 已在当前详设闭合，方案分母、五个 A/B seam、58 项公开面、9/11 context、9/4/5 工具分母均未改变。作者侧结论为 `DESIGN_SELF_DECISION=GO_PENDING_DEXTER_ACCEPTANCE`。按两轮硬上限不再发起第三轮；是否接受设计并授权 CP-A0/实施，仅由 Dexter 决定。
