SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0

# TER `kernel.base.platform-ports` · implementation-facing 详设

## 0 · 元数据、输入与授权边界

```text
PROGRAM_ID=V2S_W0_W4_EXECUTION
BUSINESS_SOURCE=doc/plans/platform/2026-08-30-v2s-terminal-kernel-base-platform-ports-requirements-claude.md
RULE_SOURCE=doc/platform/terminal-coding-standard.md
OBSERVABILITY_SOURCE=doc/decisions/2026-07-29-v2s-observability-and-acceptance-standard.md
ARCHITECTURE_SOURCE=project-memory/decisions/terminal-architecture-and-stack-rulings.md
BUILD_ORDER_SOURCE=project-memory/decisions/terminal-build-order-and-batches.md
JOURNEY_REFS=NOT_APPLICABLE_WITH_REASON（kernel 宿主能力声明包，无用户 Journey）
IA_REF=NOT_APPLICABLE_WITH_REASON（Dexter 已确认本批无用户可见界面或交互，不产出 IA）
INTERACTION_REF=NOT_APPLICABLE_WITH_REASON（无页面、焦点、导航或用户操作）
AUTHORIZED=详设、实施本包及其 TER-local 门与验证（Dexter 2026-08-30 review GO）
NOT_AUTHORIZED=adapter/native 能力；修改其余 TER 包生产源码；仓级 normal verify；设备；DEV；seed；reset；浏览器 L2；UAT；部署
IMPLEMENTATION_AUTHORITY=true
AUTHORIZED_BY=DEXTER_2026_08_30_PLATFORM_PORTS_REVIEW_GO
REVIEW_CYCLE_ID=TER_KERNEL_BASE_PLATFORM_PORTS_DESIGN_20260830
```

Roadmap 只记录 program 授权；当前任务与边界以 Dexter 本会话直接指派为准。本文已获得
Dexter 与 Claude 的 `REVIEW_TARGET=DESIGN` GO，是本次本包实施的输入；实施后仍须重新进行
`REVIEW_TARGET=IMPLEMENTATION` 评审。

## 1 · 真实目标与方案比较

### 1.1 结构性问题

本包是 kernel 访问宿主能力的唯一入口。若继续沿用 POC 的可选端口、可选方法、开放 `Record`、机制命名和
`Promise<void>`，则“能力不存在”“装配忘记接线”“动作只排队但未生效”会在调用方表现成同一种模糊状态；
与此同时，日志还能绕开脱敏。本批要建立的不是平台实现，而是一套能让四个平台诚实表达成功、失败、超时与
不可用的最小契约，以及两个零依赖可用默认。

### 1.2 方案比较

| 方案 | 结果 | 结论 |
|---|---|---|
| A · 照搬 POC 11 个字段和 Android 形状 | Android 机制、开放对象、两层可选和 `Promise<void>` 继续进入 kernel；`localWebServer` 成为空壳。 | 拒绝。 |
| B · 只声明当前已有 adapter 的 5 个端口 | 当前简单，但每个后续 consumer 会自行造旁路；与 Dexter“接口要全”裁定冲突。 | 拒绝。 |
| C · 对 11 个候选逐项举证，10 个形成完整契约，`localWebServer` 因五问不成立而不单建；用穷尽 record、typed result、统一脱敏和精确验证闭包 | 不预造无证能力，也不把能力缺失藏成 optional；复杂度与当前包职责一致。 | **采用。** |

我选择 C，因为它把“接口要全”解释为有证据的能力必须全量声明，而不是为没有消费者、没有返回形状、已被
`topologyHost` 覆盖的旧名字制造一个全绿空壳。

### 1.3 当前证据档位

- 仓内事实：本包只有 `contracts` 一条出边；骨架当前只有 `moduleName/dependencies/index`。
- POC 外部事实：Android/Kotlin 与 RN84 bridge 提供本文逐端口所列形状证据；它们不是四平台权威。
- 设计推论：本文把对侧形状收成四平台都能表达的契约；真实 adapter 行为留到各 adapter 批次证明。
- `UNVERIFIED_REQUIRES_EVIDENCE`：connector channel 的能力分类；iOS/Electron/Linux 的真实 adapter 行为；
  topology host 在 iOS 后台的存活边界；hot update 的四平台落盘/回滚实现。
- `DEXTER_DECISION`：appControl 六类接口全量声明；退出应用与 kiosk 的最终 owner/产品授权仍未定。

## 2 · CP 总览

| CP | 主题 | 主要输出 | 依赖 |
|---|---|---|---|
| CP-1 | 公共结果模型与 10 个端口类型 | 精确公开面、11 候选处置表、逐方法五问、消费者类型夹具 | 设计 GO |
| CP-2 | 默认实例、脱敏与纯 factory | console logger、进程内 KV、8 个不可用默认、冻结装配 | CP-1 |
| CP-3 | 四道门与 TER-local 接线 | TR-05/P-3/P-4/P-8、exact-export support、正负控制、test owner 2+5 | CP-2 |
| CP-4 | 全范围三维对账与 TER-local 验收 | 新鲜 static/typecheck/test/export 证据与实施记录 | CP-1…3 |

实施时每个 CP focused proof 后、进入下一个 CP 前，必须由 fresh 独立子 agent 逐项对照需求、本文/计划与
项目记忆；全部 CP 后、整体测试前再做一次全范围三维对账。本文只设计这一纪律，不授权执行。

## 3 · 横切机制对照表

| 机制 | 现成规范/能力 | 可证伪观察 | 本批确定形态 | 适用全集 |
|---|---|---|---|---|
| kernel 唯一平台边界 | `terminal-coding-standard.md` TR-02/TR-05、骨架图 | package dependency exact-set 只有 contracts；源码零 Expo/RN/native import | 所有宿主能力只出现在本包公开端口 | 10 个实际端口 |
| 失败可见且原因不改写 | 需求 §5.5、TR-02 | 不可用默认逐端口返回 discriminated union，不抛、不返回 null | `unavailable/failed/timed-out/succeeded/accepted` 五态 | 全部异步端口方法 |
| 日志与脱敏 | observability standard 第 2 条 | message/data/error 中完整禁记项在 DEV/TEST/PROD 均不出现在 console/sink；合法诊断字段仍可读 | 单一 sanitizer；公开 `LoggerPort` 无 `emit` | logger 全公开入口 |
| 同一事实只有一个住址 | TR-05、既有 contracts exact-export 模式 | `src/index.ts` module symbol 与本文清单双向相等；拒绝 `export *` | 类型在 `types/`，默认在 `defaults/`，factory 在 `foundations/` | 本包公开面 |
| 端口生命周期 | 需求 §5.4 | record 缺键编译失败；返回根对象 `Object.isFrozen=true` 且写入失败 | 一次性穷尽 record；无 register/seal | `PlatformPortBindings` 全键 |
| 测试进入真实编译面 | contracts 已有先例 | `tsc --listFilesOnly` 含 type fixture；移除一行 `@ts-expect-error` 后 typecheck 红 | 单一 tsconfig 含 `src/test/vitest.config` | 本包全部类型夹具 |
| TER-local 一键测试 | `tools/terminal-skeleton/verify.mjs` | owner exact-set 为 7；2 REAL + 5 NO_TEST_FILES | 只改 TER-local verifier，不运行仓级 normal | contracts、platform-ports、5 adapters |
| 跨 owner/HTTP/DB/UI/seed | NOT_APPLICABLE_WITH_REASON | 本包无 route、数据库、UI、持久化业务事实 | 不建对应机制 | 全批 |

## 4 · 11 个候选端口的处置结论

| 候选 | 结论 | 证据与边界 |
|---|---|---|
| `logger` | 建 | Kotlin `ILogManager` 与 POC TS logger；公开面删除 `emit`，脱敏集中。 |
| `persistKv` | 建 | POC string KV 更可移植；进程内 Map 是 Dexter 维持的可用默认。 |
| `persistSecure` | 建，与 `persistKv` 共接口但分注册位 | 操作集合相同，安全保证和默认档位不同。 |
| `device` | 建 | Kotlin `DeviceInfo/SystemStatus/PowerStatus` 去 displays、去 Android 专有 health。 |
| `appControl` | 建 | Dexter 裁定六类全量声明；方法按能力而非 Android 机制命名。 |
| `script` | 建 | Kotlin `ScriptModels` 的名字列表 + 单一 dispatcher + JSON string 边界。 |
| `connector` | 建 | workflow POC 真实使用 `call/subscribe/unsubscribe/on`；只推迟 channel 分类。 |
| `hotUpdate` | 建 | Kotlin package installer 与 boot/active/rollback marker store 有完整具名形状。 |
| `logUpload` | 建 | Kotlin `ILogManager.uploadLogsForDate`；与 logger 默认档位不同，必须分家。 |
| `topologyHost` | 建 | Kotlin `TopologyHostV3*`；保留 HTTP/WS 以及 local URL。 |
| `localWebServer` | **不单建** | 五问中①与 topologyHost 的协议能力不可分、②无已证非协议能力、③无真实 consumer、④ POC 返回全为开放 Record；只有⑤四平台“可起本机服务”能回答。四项失败，按需求 §5.1 本批不建，也不造默认值或公开类型。 |

### 4.1 `topologyHost` / `localWebServer` 四判别式

| 判别式 | 结论 |
|---|---|
| 生命周期一致 | 已知能力都随同一个本机 host service 起停；没有独立生命周期证据。 |
| 默认档位一致 | 都是不可用。 |
| 保证级别一致 | 已知输出都是 HTTP/WS/local URL 与 host 状态；没有第二种保证。 |
| 同一 adapter | POC 的旧 LocalWebServer 已被 dev-app 文案明确从协议能力移除，真实协议 host 为 topologyHost。 |

四条均成立，因此已知能力归入 `topologyHost`；未知的“非协议本机 Web 服务”不为未来假设占位。

### 4.2 其余分家/合并

| 边界 | 生命周期 | 默认档位 | 保证 | adapter | 结论 |
|---|---|---|---|---|---|
| logger / logUpload | 可同时存在也可独立缺失 | 可用 / 不可用 | 写本地日志 / 远端上传 | sink 与 uploader 可分离 | 分家 |
| persistKv / persistSecure | 同操作但实现可独立缺失 | 可用 / 不可用 | 普通 / 加密 | 可由不同 backing store 实现 | 同接口、两个端口键 |
| hotUpdate / appControl | 下载/marker 与 runtime reset 可分别成功失败 | 均不可用 | 代码资产状态 / 宿主动作 | 可由不同 adapter 实现 | 分家 |

### 4.3 display 合约边界

本批不建 `display` 端口。宿主创建每个 Root Surface 时通过 `initialProps` 推入 `displayMode` 与
`containerKey`；`kernel.base.display-context` 消费并保存该 surface context。后续 command 如需定向 surface，
携带既有 `containerKey`，kernel 不经 platform-ports 查询物理屏。`appControl` 的加载遮罩与全屏入参使用
同一个被推进来的 `containerKey` opaque key，只路由既有 surface，不枚举显示器、不读取硬件。

## 5 · 公共结果模型与装配形态

以下形状是实现契约，不是示意。除明确的 recursive JSON 字典和 string-to-string headers 外，不得增加 index
signature；不得出现 `Record<string, unknown>`、`any` 或双重 cast。

```ts
export type EnvironmentMode = 'DEV' | 'TEST' | 'PROD'

export type PlatformPortName =
  | 'logger' | 'persistKv' | 'persistSecure' | 'device' | 'appControl'
  | 'script' | 'connector' | 'hotUpdate' | 'logUpload' | 'topologyHost'

export type CapabilityUnavailableReason =
  | 'ADAPTER_NOT_INJECTED'
  | 'PLATFORM_UNSUPPORTED'

export interface PortUnavailable {
  readonly status: 'unavailable'
  readonly port: PlatformPortName
  readonly capability: string
  readonly reason: CapabilityUnavailableReason
  readonly message: string
}

export interface PortError {
  readonly code: string
  readonly message: string
  readonly retryable: boolean
}

export interface PortFailure {
  readonly status: 'failed'
  readonly port: PlatformPortName
  readonly capability: string
  readonly error: PortError
}

export interface PortTimedOut {
  readonly status: 'timed-out'
  readonly port: PlatformPortName
  readonly capability: string
  readonly timeoutMs: number
}

export interface PortSucceeded<TValue> {
  readonly status: 'succeeded'
  readonly value: TValue
  readonly completedAt: TimestampMs
}

export interface PortAccepted<TObservation extends string> {
  readonly status: 'accepted'
  readonly requestId: RequestId
  readonly acceptedAt: TimestampMs
  readonly terminalObservation: TObservation
}

export interface NoOutput {
  readonly completed: true
}

export type PortResult<TValue> =
  | PortSucceeded<TValue>
  | PortUnavailable
  | PortFailure
  | PortTimedOut

export type PortActionResult<TValue, TObservation extends string> =
  | PortSucceeded<TValue>
  | PortAccepted<TObservation>
  | PortUnavailable
  | PortFailure
  | PortTimedOut
```

每个 Promise 代表完整操作结果，adapter 必须把可预期的 native/IPC/network 错误映射为 union；不得把业务可预期
失败留成 rejection。`timeoutMs` 是从方法调用到 terminal result 的总预算；超时只能返回 `timed-out`，不得同时
返回 `failed`。

### 5.1 穷尽装配

```ts
export interface LoggerConsoleBinding { readonly kind: 'console' }
export interface LoggerSinkBinding {
  readonly kind: 'sink'
  readonly write: (event: LogEvent) => void
}
export type LoggerBinding = LoggerConsoleBinding | LoggerSinkBinding

export interface PlatformPortBindings {
  readonly logger: LoggerBinding
  readonly persistKv: StateStoragePort
  readonly persistSecure: StateStoragePort
  readonly device: DevicePort
  readonly appControl: AppControlPort
  readonly script: ScriptPort
  readonly connector: ConnectorPort
  readonly hotUpdate: HotUpdatePort
  readonly logUpload: LogUploadPort
  readonly topologyHost: TopologyHostPort
}

export interface PlatformPorts {
  readonly logger: LoggerPort
  readonly persistKv: StateStoragePort
  readonly persistSecure: StateStoragePort
  readonly device: DevicePort
  readonly appControl: AppControlPort
  readonly script: ScriptPort
  readonly connector: ConnectorPort
  readonly hotUpdate: HotUpdatePort
  readonly logUpload: LogUploadPort
  readonly topologyHost: TopologyHostPort
}

export interface CreatePlatformPortsInput {
  readonly environmentMode: EnvironmentMode
  readonly bindings: PlatformPortBindings
}

export function createPlatformPorts(input: CreatePlatformPortsInput): Readonly<PlatformPorts>
```

`environmentMode` 作为 factory 输入保留，但本包的 console binding 不按环境丢弃任何日志级别；四级写入均在
console 方法返回后才报告 succeeded。它不进入 `PlatformPorts`。`LoggerBinding` 让 factory 始终拥有 sanitizer：
`console` 和真实文件 sink 都先收到已清洗 `LogEvent`，adapter 无法用另一个 public `emit` 绕过。
不导出“整套默认 record”helper，避免 assembly 用一次 spread 掩盖忘记逐键作出注入/不可用选择。

默认实例精确为：`consoleLoggerBinding`、`createProcessMemoryStateStoragePort()`，以及
`unavailablePersistSecurePort`、`unavailableDevicePort`、`unavailableAppControlPort`、
`unavailableScriptPort`、`unavailableConnectorPort`、`unavailableHotUpdatePort`、
`unavailableLogUploadPort`、`unavailableTopologyHostPort`。默认不可用原因固定为
`ADAPTER_NOT_INJECTED`；真实 adapter 发现平台能力不存在时使用 `PLATFORM_UNSUPPORTED`。

## 6 · 十个实际端口的精确类型形状

### 6.1 `logger`

```ts
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'
export type LogMaskingMode = 'masked'
export type LogPrimitive = string | number | boolean | null
export type LogValue = LogPrimitive | readonly LogValue[] | LogFields
export interface LogFields { readonly [key: string]: LogValue }

export interface LogScope {
  readonly moduleName: string
  readonly layer?: 'kernel' | 'ui' | 'adapter' | 'assembly'
  readonly subsystem?: string
  readonly component?: string
}
export interface LogScopeBinding {
  readonly moduleName?: string
  readonly layer?: 'kernel' | 'ui' | 'adapter' | 'assembly'
  readonly subsystem?: string
  readonly component?: string
}
export interface LogContext {
  readonly requestId?: RequestId
  readonly commandId?: CommandId
  readonly commandName?: string
  readonly sessionId?: SessionId
  readonly connectionId?: ConnectionId
  readonly nodeId?: NodeId
  readonly peerNodeId?: NodeId
}
export interface LogError {
  readonly name?: string
  readonly code?: string
  readonly message: string
  readonly stack?: string
}
export interface LogSecurity {
  readonly containsSensitiveRaw: boolean
  readonly maskingMode: LogMaskingMode
}
export interface LogEvent {
  readonly timestamp: TimestampMs
  readonly level: LogLevel
  readonly category: string
  readonly event: string
  readonly message?: string
  readonly scope: LogScope
  readonly context?: LogContext
  readonly data?: LogFields
  readonly error?: LogError
  readonly security: LogSecurity
}
export interface LogWriteInput {
  readonly category: string
  readonly event: string
  readonly message?: string
  readonly context?: LogContext
  readonly data?: LogFields
  readonly error?: LogError
}
export type LogWriteResult = PortSucceeded<LogEvent> | PortFailure
export interface LoggerPort {
  debug(input: LogWriteInput): LogWriteResult
  info(input: LogWriteInput): LogWriteResult
  warn(input: LogWriteInput): LogWriteResult
  error(input: LogWriteInput): LogWriteResult
  scope(binding: LogScopeBinding): LoggerPort
  withContext(context: LogContext): LoggerPort
}
```

`LogFields` 是日志这一真实开放扩展点：writer 是任意模块，reader 是统一 sanitizer/sink，key 无法预枚举；value
被递归限制为 JSON-safe 值。logger 无 `emit`，也不公开未清洗 sink。手机号、密码/hash、验证码、token、cookie、
Authorization、登录名、原始 IP、raw request/response、可反推账号存在性的字段，必须同时按 key 与 value 扫描；
message、data、error.message 与 `LogContext.commandName` 都进入同一 sanitizer。`LogContext` 的 branded ID 字段
按闭合形状逐项保留，未知字段不得透传。仅以下严格匹配的诊断字段允许保留其合法值：64 位十六进制的
`packageSha256`/`manifestSha256`、数字版本串 `bundleVersion`、十进制数值 `accountBalance`；其他字段仍按
通用 key/value 规则扫描。命中后原值替换为 `[REDACTED:<category>]`，`containsSensitiveRaw=true`；所有环境
`maskingMode='masked'`。

### 6.2 `persistKv` / `persistSecure`

```ts
export interface StateStorageCall { readonly timeoutMs: number }
export interface StateStorageReadInput extends StateStorageCall { readonly key: string }
export interface StateStorageWriteInput extends StateStorageReadInput { readonly value: string }
export interface StateStorageKeysInput extends StateStorageCall { readonly keys: readonly string[] }
export interface StateStorageEntriesInput extends StateStorageCall { readonly entries: readonly StateStorageEntry[] }
export interface StateStorageEntry { readonly key: string; readonly value: string }
export type StateStorageReadValue =
  | { readonly state: 'found'; readonly value: string }
  | { readonly state: 'missing' }
export interface StateStorageReadEntry { readonly key: string; readonly result: StateStorageReadValue }
export interface StateStoragePort {
  read(input: StateStorageReadInput): Promise<PortResult<StateStorageReadValue>>
  write(input: StateStorageWriteInput): Promise<PortResult<NoOutput>>
  remove(input: StateStorageReadInput): Promise<PortResult<NoOutput>>
  readMany(input: StateStorageKeysInput): Promise<PortResult<readonly StateStorageReadEntry[]>>
  writeMany(input: StateStorageEntriesInput): Promise<PortResult<NoOutput>>
  removeMany(input: StateStorageKeysInput): Promise<PortResult<NoOutput>>
  listKeys(input: StateStorageCall): Promise<PortResult<readonly string[]>>
  clear(input: StateStorageCall): Promise<PortResult<NoOutput>>
}
```

不存在 `null`：键缺失是成功 payload 的 `state:'missing'`。`createProcessMemoryStateStoragePort` 的 JSDoc 必须逐字
含 `PROCESS_MEMORY_ONLY: data is not persisted across process restart`；其名称和文档同时表明不跨重启。它只能作为
`persistKv` 默认，绝不能填进 `persistSecure`。

### 6.3 `device`

```ts
export interface DeviceInfo {
  readonly deviceId: string
  readonly manufacturer?: string
  readonly model?: string
  readonly systemName: string
  readonly systemVersion: string
  readonly logicalProcessorCount: number
}
export interface ProcessorStatus {
  readonly logicalProcessorCount: number
  readonly processUtilizationRatio: number
}
export interface MemoryStatus {
  readonly totalBytes: number
  readonly availableBytes: number
  readonly processBytes: number
}
export interface StorageStatus {
  readonly totalBytes: number
  readonly availableBytes: number
  readonly processBytes: number
}
export interface NetworkStatus { readonly connected: boolean }
export interface PowerStatus {
  readonly source: 'external' | 'battery' | 'unknown'
  readonly charging: 'charging' | 'not-charging' | 'unknown'
  readonly levelRatio?: number
}
export interface SystemStatus {
  readonly processor: ProcessorStatus
  readonly memory: MemoryStatus
  readonly storage: StorageStatus
  readonly network: NetworkStatus
  readonly power: PowerStatus
  readonly observedAt: TimestampMs
}
export interface PowerStatusChanged {
  readonly status: PowerStatus
  readonly observedAt: TimestampMs
}
export type PowerStatusListener = (event: PowerStatusChanged) => void
export interface DeviceCall { readonly timeoutMs: number }
export interface PowerStatusSubscriptionInput extends DeviceCall {
  readonly listener: PowerStatusListener
  readonly onError: (error: PortFailure['error']) => void
}
export interface PowerStatusUnsubscribeInput extends DeviceCall { readonly subscriptionId: string }
export interface DevicePort {
  getDeviceInfo(input: DeviceCall): Promise<PortResult<DeviceInfo>>
  getSystemStatus(input: DeviceCall): Promise<PortResult<SystemStatus>>
  getPowerStatus(input: DeviceCall): Promise<PortResult<PowerStatus>>
  subscribePowerStatus(input: PowerStatusSubscriptionInput): Promise<PortResult<{readonly subscriptionId: string}>>
  unsubscribePowerStatus(input: PowerStatusUnsubscribeInput): Promise<PortResult<NoOutput>>
}
```

`displays`、USB/Bluetooth/serial/installed-app 列表不进本端口：前者由 surface initialProps 推入，后四者属于
connector/运维诊断的实现面，不是设备基础快照。`batteryHealth`、Android 风格字符串容量字段不进契约；桌面无
电池时返回 `source:'external'` 或 `'unknown'`，不是不可用整个 device 端口。

### 6.4 `appControl`

```ts
export interface AppControlCall { readonly timeoutMs: number }
export interface RuntimeResetInput extends AppControlCall { readonly requestId: RequestId }
export interface ExitApplicationInput extends AppControlCall { readonly requestId: RequestId }
export interface SurfaceActionInput extends AppControlCall { readonly containerKey: string }
export interface SurfaceToggleInput extends SurfaceActionInput { readonly enabled: boolean }
export interface NativeLoadingInput extends SurfaceActionInput { readonly message: string }
export interface ApplicationToggleInput extends AppControlCall { readonly enabled: boolean }
export interface ToggleState { readonly enabled: boolean }
export type RuntimeTransitionObservation = 'SUCCESSOR_RUNTIME_STARTED'
export type ExitTransitionObservation = 'PROCESS_TERMINATED'

export interface AppControlPort {
  resetRuntime(input: RuntimeResetInput): Promise<PortActionResult<NoOutput, RuntimeTransitionObservation>>
  exitApplication(input: ExitApplicationInput): Promise<PortActionResult<NoOutput, ExitTransitionObservation>>
  clearHostDataCache(input: AppControlCall): Promise<PortResult<NoOutput>>
  setFullscreen(input: SurfaceToggleInput): Promise<PortResult<ToggleState>>
  getFullscreen(input: SurfaceActionInput): Promise<PortResult<ToggleState>>
  setKioskMode(input: ApplicationToggleInput): Promise<PortResult<ToggleState>>
  getKioskMode(input: AppControlCall): Promise<PortResult<ToggleState>>
  showNativeLoading(input: NativeLoadingInput): Promise<PortResult<NoOutput>>
  hideNativeLoading(input: SurfaceActionInput): Promise<PortResult<NoOutput>>
}
```

`resetRuntime` 替代机制名 `restartApp`。它允许 `accepted`，终态来源是 successor runtime 的启动完成信号；
`exitApplication` 允许 `accepted`，终态来源是 host/process 观察到进程退出。调用方不能把 accepted 当 succeeded。
其余方法只能在实际状态可查询/可观察后返回 succeeded。`onAppLoadComplete` 不作为别名进入公开面。

`SurfaceActionInput.containerKey` 是本批唯一的 surface 身份名称；`display-context` 后续若把它收紧为
branded 类型，必须同步把本字段改为同一 brand，禁止重新引入 `surfaceKey` 别名。

`DEXTER_DECISION`：退出应用与 kiosk 的最终 owner、产品入口和授权仍未裁定。本文只冻结 capability shape；
实施本包时只提供 `ADAPTER_NOT_INJECTED` 默认，不得据此给任何 kernel 模块新增调用，也不得实现真机行为。

### 6.5 `script`

```ts
export interface NativeFunctionInvocation {
  readonly functionName: string
  readonly argsJson: string
  readonly timeoutMs: number
}
export interface NativeFunctionOutput { readonly resultJson: string }
export type NativeFunctionDispatcher =
  (input: NativeFunctionInvocation) => Promise<PortResult<NativeFunctionOutput>>
export type ScriptNativeBindings =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'named'
      readonly functionNames: readonly string[]
      readonly invoke: NativeFunctionDispatcher
    }
export interface ScriptExecutionInput {
  readonly source: string
  readonly paramsJson: string
  readonly globalsJson: string
  readonly native: ScriptNativeBindings
  readonly timeoutMs: number
}
export interface ScriptExecutionOutput {
  readonly resultJson: string
  readonly elapsedMs: number
}
export interface ScriptStats {
  readonly total: number
  readonly succeeded: number
  readonly failed: number
  readonly averageElapsedMs: number
}
export interface ScriptCall { readonly timeoutMs: number }
export interface ScriptPort {
  execute(input: ScriptExecutionInput): Promise<PortResult<ScriptExecutionOutput>>
  getStats(input: ScriptCall): Promise<PortResult<ScriptStats>>
  clearStats(input: ScriptCall): Promise<PortResult<NoOutput>>
}
```

`source` 允许运行期远端下发，保持 T-11；安全边界是只有 `native.kind:'named'` 列出的函数才能走单一 dispatcher，
参数与返回都是 JSON string。不得恢复开放函数表或主 JS 上下文 `new Function` fallback。

### 6.6 `connector`

```ts
export type ConnectorScalar = string | number | boolean | null
export type ConnectorValue = ConnectorScalar | readonly ConnectorValue[] | ConnectorObject
export interface ConnectorObject { readonly [key: string]: ConnectorValue }
export interface ConnectorChannelRef {
  readonly channelKey: string
  readonly target?: string
}
export interface ConnectorCallRequest<TPayload extends ConnectorObject> {
  readonly requestId: RequestId
  readonly channel: ConnectorChannelRef
  readonly action: string
  readonly payload: TPayload
  readonly timeoutMs: number
}
export interface ConnectorCallResponse<TPayload extends ConnectorValue> {
  readonly requestId: RequestId
  readonly payload: TPayload
}
export interface ConnectorMessage<TPayload extends ConnectorValue> {
  readonly subscriptionId: string
  readonly sequence: number
  readonly receivedAt: TimestampMs
  readonly payload: TPayload
}
export interface ConnectorSubscriptionError {
  readonly subscriptionId: string
  readonly error: ConnectorError
}
export type ConnectorError = PortError
export interface ConnectorSubscribeInput<TPayload extends ConnectorValue> {
  readonly channel: ConnectorChannelRef
  readonly onMessage: (message: ConnectorMessage<TPayload>) => void
  readonly onError: (error: ConnectorSubscriptionError) => void
  readonly timeoutMs: number
}
export interface ConnectorEvent<TPayload extends ConnectorValue> {
  readonly eventName: string
  readonly receivedAt: TimestampMs
  readonly payload: TPayload
}
export interface ConnectorOnInput<TPayload extends ConnectorValue> {
  readonly eventName: string
  readonly handler: (event: ConnectorEvent<TPayload>) => void
  readonly onError: (error: ConnectorSubscriptionError) => void
  readonly timeoutMs: number
}
export interface ConnectorUnsubscribeInput {
  readonly subscriptionId: string
  readonly timeoutMs: number
}
export interface ConnectorSubscription { readonly subscriptionId: string }
export interface ConnectorPort {
  call<TRequest extends ConnectorObject, TResponse extends ConnectorValue>(
    input: ConnectorCallRequest<TRequest>,
  ): Promise<PortResult<ConnectorCallResponse<TResponse>>>
  subscribe<TMessage extends ConnectorValue>(
    input: ConnectorSubscribeInput<TMessage>,
  ): Promise<PortResult<ConnectorSubscription>>
  unsubscribe(input: ConnectorUnsubscribeInput): Promise<PortResult<NoOutput>>
  on<TEvent extends ConnectorValue>(
    input: ConnectorOnInput<TEvent>,
  ): Promise<PortResult<ConnectorSubscription>>
}
```

`ConnectorObject` 是 connector payload 的必要递归 JSON 开放点：writer 是 workflow/设备能力，reader 是对应 adapter；
key 不能由本包枚举，但 value 被收紧为 JSON-safe union。统一错误使用公共 `PortFailure/PortTimedOut/PortUnavailable`。
`channelKey` 只是 opaque route key，不是分类枚举。

`UNVERIFIED_REQUIRES_EVIDENCE`：channel 的 capability taxonomy。不得把 POC 的 `INTENT/AIDL/USB/...`
机制/传输枚举移入本包；真实 workflow 场景形成能力分类证据后另行裁定。

### 6.7 `hotUpdate`

```ts
export interface HotUpdateCall { readonly timeoutMs: number }
export interface HotUpdateDownloadInput extends HotUpdateCall {
  readonly packageId: string
  readonly releaseId: string
  readonly bundleVersion: string
  readonly packageUrls: readonly string[]
  readonly packageSha256: string
  readonly manifestSha256: string
  readonly packageSizeBytes: number
}
export interface HotUpdateInstall {
  readonly installDirectory: string
  readonly entryFile: string
  readonly manifestPath: string
  readonly packageSha256: string
  readonly manifestSha256: string
}
export interface HotUpdateMarkerInput extends HotUpdateCall {
  readonly releaseId: string
  readonly packageId: string
  readonly bundleVersion: string
  readonly resetRequestId?: RequestId
  readonly installDirectory: string
  readonly entryFile: string
  readonly manifestSha256: string
  readonly maxLaunchFailures: number
  readonly healthCheckTimeoutMs: number
}
export interface HotUpdateMarker {
  readonly releaseId: string
  readonly packageId: string
  readonly bundleVersion: string
  readonly resetRequestId?: RequestId
  readonly installDirectory: string
  readonly entryFile: string
  readonly manifestSha256: string
  readonly bootAttempt: number
  readonly maxLaunchFailures: number
  readonly healthCheckTimeoutMs: number
  readonly updatedAt: TimestampMs
  readonly lastBootAt?: TimestampMs
  readonly lastSuccessfulBootAt?: TimestampMs
  readonly rollbackReason?: string
  readonly failedBootAttempt?: number
  readonly rolledBackAt?: TimestampMs
}
export type HotUpdateMarkerRead =
  | { readonly state: 'present'; readonly marker: HotUpdateMarker }
  | { readonly state: 'absent' }
export interface HotUpdateMarkerWrite { readonly markerPath: string }
export interface HotUpdatePort {
  downloadPackage(input: HotUpdateDownloadInput): Promise<PortResult<HotUpdateInstall>>
  writeBootMarker(input: HotUpdateMarkerInput): Promise<PortResult<HotUpdateMarkerWrite>>
  readBootMarker(input: HotUpdateCall): Promise<PortResult<HotUpdateMarkerRead>>
  readActiveMarker(input: HotUpdateCall): Promise<PortResult<HotUpdateMarkerRead>>
  readRollbackMarker(input: HotUpdateCall): Promise<PortResult<HotUpdateMarkerRead>>
  clearBootMarker(input: HotUpdateCall): Promise<PortResult<NoOutput>>
  confirmLoadComplete(input: HotUpdateCall): Promise<PortResult<HotUpdateMarkerRead>>
}
```

不保留 `reportLoadComplete` 别名。marker 不存在是 `succeeded + state:'absent'`；能力不可用仍是
`status:'unavailable'`，两者不能混淆。

### 6.8 `logUpload`

```ts
export interface LogUploadInput {
  readonly uploadUrl: string
  readonly logDate: string
  readonly terminalId?: string
  readonly sandboxId?: string
  readonly commandId?: CommandId
  readonly runtimeInstanceId?: RuntimeInstanceId
  readonly releaseId?: string
  readonly surfaceIndex: number
  readonly surfaceRole: string
  readonly overwrite: boolean
  readonly headers: Readonly<Record<string, string>>
  readonly timeoutMs: number
}
export interface UploadedLogFile {
  readonly fileName: string
  readonly fileSizeBytes: number
  readonly uploadedAt: TimestampMs
  readonly checksum: string
  readonly storageKey?: string
  readonly url?: string
}
export interface LogUploadOutput {
  readonly terminalId?: string
  readonly surfaceIndex: number
  readonly surfaceRole: string
  readonly logDate: string
  readonly uploadedFiles: readonly UploadedLogFile[]
  readonly skippedFiles: readonly string[]
}
export interface LogUploadPort {
  uploadLogsForDate(input: LogUploadInput): Promise<PortResult<LogUploadOutput>>
}
```

只保留有明确 reader 的字段；POC 无 reader 的 metadata 删除。headers 是 string-to-string 协议而不是 unknown 洞；
Authorization 等敏感 header 不得进入日志。

### 6.9 `topologyHost`

```ts
export type TopologyHostState = 'stopped' | 'starting' | 'running' | 'stopping' | 'error'
export interface TopologyHostRuntimeConfig {
  readonly port: number
  readonly basePath: string
  readonly heartbeatIntervalMs: number
  readonly heartbeatTimeoutMs: number
}
export interface TopologyHostConfig extends TopologyHostRuntimeConfig {
  readonly timeoutMs: number
}
export interface TopologyHostAddress {
  readonly host: string
  readonly port: number
  readonly basePath: string
  readonly httpBaseUrl: string
  readonly wsUrl: string
  readonly localHttpBaseUrl: string
  readonly localWsUrl: string
}
export interface TopologyHostStatus {
  readonly state: TopologyHostState
  readonly address?: TopologyHostAddress
  readonly config: TopologyHostRuntimeConfig
  readonly errorCode?: string
  readonly errorMessage?: string
}
export interface TopologyHostStats {
  readonly sessionCount: number
  readonly peerCount: number
  readonly stalePeerCount: number
}
export interface TopologyHostDiagnostics {
  readonly status: TopologyHostStatus
  readonly stats: TopologyHostStats
  readonly capturedAt: TimestampMs
}
export interface TopologyHostCall { readonly timeoutMs: number }
export interface TopologyHostPort {
  start(input: TopologyHostConfig): Promise<PortResult<TopologyHostAddress>>
  stop(input: TopologyHostCall): Promise<PortResult<NoOutput>>
  getStatus(input: TopologyHostCall): Promise<PortResult<TopologyHostStatus>>
  getDiagnosticsSnapshot(input: TopologyHostCall): Promise<PortResult<TopologyHostDiagnostics>>
}
```

fault rules、prepare launch、peer runtime/handshake 和 automation 不进本批：前两者是调试/装配机制，后两者属于
已推迟的 topology protocol。`TopologyHostAddress` 已包含 local URL，因此不再建立 `LocalWebServerPort`。

## 7 · 证据、四平台归属、默认档位与成功语义

### 7.1 形状证据与找不到来源时的唯一处理

| 端口 | 已使用的形状证据 | 四平台抽象时删除/改名 |
|---|---|---|
| logger | POC TS `types/logging.ts`、Kotlin `ILogManager`、JS console | 删除 `emit`；开放 data 改递归 LogValue；全环境脱敏 |
| persistKv / persistSecure | POC TS `StateStoragePort`、Kotlin `IStateStorage`、Keychain/EncryptedSharedPreferences/safeStorage 能力集合 | 只保留 string KV；不存在返回判别值，不返回 null |
| device | Kotlin `IDeviceManager`、`DeviceModels.kt` | 删除 displays、batteryHealth 与 Android 专有外设集合；容量转 bytes，比例转 ratio |
| appControl | Kotlin `AppControlManager`、RN84 `NativeAppControlTurboModule`、iOS runtime reload/Electron reload 的能力对应 | `restartApp` 改 `resetRuntime`；`displayIndex` 改被推进的 `containerKey`；删除别名 |
| script | Kotlin `IScriptEngine`、`ScriptModels` | 开放函数表改 named dispatcher；参数/返回收成 JSON string |
| connector | POC `ConnectorPort` 与 workflow `connectorRuntime` 四方法调用 | 删除 Android channel 枚举；保留 opaque channelKey 与 JSON-safe payload |
| hotUpdate | Kotlin `HotUpdatePackageInstaller`、`HotUpdateBootMarkerStore`、RN84 spec | 所有 marker 改具名；absence 与 unavailable 分离；删除 report alias |
| logUpload | Kotlin `ILogManager.uploadLogsForDate`、`LoggerModels` | 删除无 reader metadata；display 改 surface；ID 使用 contracts brand |
| topologyHost | Kotlin `TopologyHostV3Models`、RN84 topology spec/wrapper | 只留生产 host start/stop/status/diagnostics；删除 fault/automation/protocol handshake |
| localWebServer | POC 只有开放 Record、无 consumer；dev-app 明确旧协议能力不保留 | **不建**；已证 HTTP/WS/local URL 归 topologyHost |

实施时若任一已列方法发现这些来源不足以确定字段，必须停机，不得自行加字段、`unknown` 容器或平台机制名。
只有 `localWebServer` 已在本文按需求条件作出“不建”结论，不再保留待定。

### 7.2 逐方法四平台归属

`△`/`✗` 不是 optional method：真实 adapter 在该机器无法提供能力时返回
`PortUnavailable(reason='PLATFORM_UNSUPPORTED')`。

| 端口 · 方法 | Android | iOS | Windows | Linux | `△`/`✗` 如何成为合法结果 |
|---|---|---|---|---|---|
| logger · `debug/info/warn/error/scope/withContext` | ✓ | ✓ | ✓ | ✓ | N/A |
| persistKv · 8 方法 | ✓ | ✓ | ✓ | ✓ | N/A |
| persistSecure · 8 方法 | ✓ | ✓ | ✓ | △ | 无 keyring/libsecret 时逐方法返回 `PLATFORM_UNSUPPORTED`，不得明文降级 |
| device · `getDeviceInfo` | ✓ | ✓ | ✓ | ✓ | N/A；缺 manufacturer/model 用可选字段 |
| device · `getSystemStatus` | ✓ | △ | ✓ | ✓ | 沙箱拿不到 process/storage 指标时返回 `PLATFORM_UNSUPPORTED`，不得伪造 0 |
| device · `getPowerStatus/subscribePowerStatus/unsubscribePowerStatus` | ✓ | ✓ | △ | △ | 无电池但能判断外接电源时返回 succeeded；系统不给状态/事件时返回 `PLATFORM_UNSUPPORTED` |
| appControl · `resetRuntime` | ✓ | ✓ | ✓ | ✓ | N/A；实现机制不得进入契约 |
| appControl · `exitApplication` | ✓ | ✗ | ✓ | ✓ | iOS 返回 `PLATFORM_UNSUPPORTED` |
| appControl · `clearHostDataCache` | ✓ | ✓ | ✓ | ✓ | N/A |
| appControl · `setFullscreen/getFullscreen` | ✓ | △ | ✓ | ✓ | 宿主 surface 不允许切换时返回 `PLATFORM_UNSUPPORTED` |
| appControl · `setKioskMode/getKioskMode` | ✓ | △ | ✓ | ✓ | iOS 非 supervised/MDM 环境返回 `PLATFORM_UNSUPPORTED` |
| appControl · `showNativeLoading/hideNativeLoading` | ✓ | ✓ | ✓ | ✓ | 找不到 `containerKey` 是 `failed`，不是 unsupported |
| script · `execute/getStats/clearStats` | ✓ | ✓ | ✓ | ✓ | N/A；具体 runtime 由 adapter 选择 |
| connector · `call/subscribe/unsubscribe/on` | ✓ | △ | ✓ | ✓ | 某 channel 在平台不存在时返回 `PLATFORM_UNSUPPORTED`；分类仍不冻结 |
| hotUpdate · `downloadPackage` | ✓ | △ | △ | △ | 发布/沙箱策略禁用本地代码资产时返回 `PLATFORM_UNSUPPORTED` |
| hotUpdate · 6 个 marker 方法 | ✓ | △ | △ | △ | 无可写/原子 marker store 时返回 `PLATFORM_UNSUPPORTED` |
| logUpload · `uploadLogsForDate` | ✓ | ✓ | ✓ | ✓ | N/A；网络失败是 failed/timed-out，不是 unsupported |
| topologyHost · `start/stop/getStatus/getDiagnosticsSnapshot` | ✓ | △ | ✓ | ✓ | iOS 后台不允许持续 listener 时返回 `PLATFORM_UNSUPPORTED` |

### 7.3 默认档位两问

| 端口 | ① 四平台均有？ | ② 默认与真实是同一语义？ | 档位 |
|---|---|---|---|
| logger | 是 | 是；console 真正写日志，只是 sink 不同 | 可用 |
| persistKv | 是 | `DEXTER_DECISION`：进程内 Map 按正本维持可用；不跨重启风险显式登记 | 可用 |
| persistSecure | 否 | 否；明文不是加密 | 不可用 |
| device | 否，完整快照在部分沙箱受限 | 无零依赖真实设备快照 | 不可用 |
| appControl | 否 | 无零依赖宿主动作 | 不可用 |
| script | 平台可实现但本包无引擎 | 无零依赖受控 runtime | 不可用 |
| connector | channel 依平台而异 | 无零依赖外设通道 | 不可用 |
| hotUpdate | 受平台发布/沙箱策略限制 | 无零依赖包/marker store | 不可用 |
| logUpload | 能联网不等于已配置上传 | 无 upload endpoint/文件 owner | 不可用 |
| topologyHost | iOS 后台受限 | 无零依赖 listener/server | 不可用 |

### 7.4 逐方法成功语义五问

“失败回传”列描述 accepted 后的失败来源；普通 awaited 方法在返回前已获得终态，所以在 Promise 结果里返回
`failed/timed-out`。所有 timeout 都取入参的 `timeoutMs`，只有同步 logger/derived logger 标 N/A。

| 方法 | 完成点 | 可观察确认 | 后续异步失败回传 | accepted/pending 与终态来源 | timeout |
|---|---|---|---|---|---|
| logger `debug/info/warn/error` | sanitizer 完成且 console/sink 同步返回 | 返回的 `LogEvent` 与 console/sink 捕获值一致 | console/sink 同步抛出被收成 `PortFailure` | 不允许 | N/A |
| logger `scope/withContext` | 冻结 derived logger 创建 | 返回对象拥有合并后的 scope/context，并由下一次 write 观测 | 无异步工作 | 不允许 | N/A |
| storage `read/readMany/listKeys` | backing store 已返回同一快照 | found/missing、entry 列表或 key 列表 | 无返回后工作 | 不允许 | 超时=`timed-out` |
| storage `write/writeMany/remove/removeMany/clear` | backing store 确认变更可由随后的 read/list 观察 | 测试立即 readback；真实 adapter 测试验证自身 durable 语义 | 无返回后工作 | 不允许 | 超时=`timed-out` |
| device `getDeviceInfo/getSystemStatus/getPowerStatus` | 平台快照读取完成 | 具名快照与 `observedAt` | 无返回后工作 | 不允许 | 超时=`timed-out` |
| device `subscribePowerStatus` | listener 已登记且得到 subscriptionId | 后续 synthetic/native event 可到达 listener | stream 错误调用必填 `onError` | 不允许 | 仅约束建立订阅 |
| device `unsubscribePowerStatus` | listener 已移除 | 相同 id 后续事件不再到达 | 无返回后工作 | 不允许 | 超时=`timed-out` |
| appControl `resetRuntime` | 宿主确认重置请求已接管，或动作已在当前可观察边界生效 | `accepted` 与 `succeeded` 判别值 | accepted 后失败由 host lifecycle 以同一 `requestId` 写入 successor-runtime 启动诊断；successor 通过 `HotUpdateMarker.resetRequestId` 关联本次 marker，不得只写无关联日志 | 允许 accepted；终态源=`SUCCESSOR_RUNTIME_STARTED` | 接管前超时=`timed-out`；接管后不伪报 succeeded |
| appControl `exitApplication` | 宿主确认退出请求已接管；进程退出无法在同一 JS Promise 内确认 | accepted 的 requestId 由外部 supervisor/运维进程观察 process termination | 接管前失败返回 failed；接管后由 supervisor 记录同 requestId 的终态 | 允许 accepted；终态源=`PROCESS_TERMINATED` | 接管前超时=`timed-out` |
| appControl `clearHostDataCache` | 所有 host-owned cache clear 完成 | adapter 测试 readback 为空 | 无返回后工作 | 不允许 | 超时=`timed-out` |
| appControl `setFullscreen/setKioskMode` | 查询 API 回读到目标值 | success payload 的 enabled 与即时 `get*` 相同 | 无返回后工作 | 不允许 | 超时=`timed-out` |
| appControl `getFullscreen/getKioskMode` | 宿主真实状态读取完成 | 返回 `ToggleState` | 无返回后工作 | 不允许 | 超时=`timed-out` |
| appControl `showNativeLoading/hideNativeLoading` | 对应 surface overlay 已 attach/detach | host 查询/adapter UI test 可观察 | 无返回后工作 | 不允许 | 超时=`timed-out` |
| script `execute` | 脚本及所有已发起 native dispatcher 调用结束 | resultJson/elapsedMs 或失败 union | dispatcher 的异步失败并入 execute 结果 | 不允许 | 引擎与 dispatcher 共用总预算 |
| script `getStats/clearStats` | 快照读取/计数清零完成 | getStats readback | 无返回后工作 | 不允许 | 超时=`timed-out` |
| connector `call` | 单次 response 或 error terminal 到达 | requestId 与 typed response 对应 | 无返回后工作 | 不允许 | 超时=`timed-out` |
| connector `subscribe/on` | handler 登记并返回 subscriptionId | synthetic/native message/event 到达 handler | stream/event source 错误经必填 `onError` 回调，携带相同 subscriptionId | 不允许 | 仅约束建立订阅 |
| connector `unsubscribe` | handler 已移除 | 后续消息不再到达 | 无返回后工作 | 不允许 | 超时=`timed-out` |
| hotUpdate `downloadPackage` | 下载、size/hash、manifest/entry hash 校验及原子 promote 全完成 | install path 与两个 hash 可读且匹配 | 无返回后工作 | 不允许 | 超时=`timed-out`，staging 由 adapter 清理 |
| hotUpdate `writeBootMarker` | marker 原子写及 fsync/等价 durable 完成 | 随后 readActive/readBoot 可见对应 marker | 无返回后工作 | 不允许 | 超时=`timed-out` |
| hotUpdate `readBootMarker/readActiveMarker/readRollbackMarker` | 一次 marker store 读取完成 | present/absent 判别值 | 无返回后工作 | 不允许 | 超时=`timed-out` |
| hotUpdate `clearBootMarker` | boot marker 已删除 | 随后 readBoot 为 absent | 无返回后工作 | 不允许 | 超时=`timed-out` |
| hotUpdate `confirmLoadComplete` | active 更新完成，boot/rollback 按规则清理完成 | 返回 marker/absent 且随后的 reads 一致 | 无返回后工作 | 不允许 | 超时=`timed-out` |
| logUpload `uploadLogsForDate` | 每个候选文件已获远端确认或被具名列为 skipped | uploaded/skipped exact partition；远端确认由 adapter 测试证明 | 无返回后工作 | 不允许 | 超时=`timed-out` |
| topologyHost `start` | listener 已 bind 且 address 已生成 | status=running，四个 URL 与 bound address 一致 | host 后续崩溃由 status/diagnostics 变 error；不得维持 running | 不允许 accepted | 超时=`timed-out` 并清理部分 listener |
| topologyHost `stop` | listener、session 与资源关闭 | status=stopped | 无返回后工作 | 不允许 | 超时=`timed-out`，不得伪报 stopped |
| topologyHost `getStatus/getDiagnosticsSnapshot` | 同一时点快照读取完成 | state/config/address/stats 自洽 | 无返回后工作 | 不允许 | 超时=`timed-out` |

`connector.subscribe` 与 `connector.on` 都必须提供 `onError`，因此 event source 建立后失败不会退化为无关联
日志。channel 分类仍未冻结，不影响这条错误回传契约。

## 8 · 测试设计：断言、反断言与被证伪缺陷

Vitest 固定 `4.1.10`、node environment。`tsconfig.json` 的唯一 include 为
`src/**/*.ts`、`test/**/*.ts`、`vitest.config.ts`；`public-surface.typecheck.ts` 不进入 Vitest include，但必须进入
`tsc`。消费者夹具只在本包 test 内，不改 workflow/runtime/assembly。

### 8.1 A 组 · 装配

| id | 断言 | 反断言 | 证伪缺陷 |
|---|---|---|---|
| A-1 | 逐键填满 `PlatformPortBindings`，factory 返回 10 键；除 logger 被 central wrapper 包装外，其余自定义实例 identity 不变 | 缺任一键不能编译，不能在运行期偷偷补默认 | “穷尽 record”退化成隐式 default registry |
| A-2 | `Object.isFrozen(ports) === true` | strict mode 给 `ports.device` 重新赋值抛 `TypeError`，原值不变 | 只写 `Readonly` 类型但运行对象可变 |
| A-3 | `environmentMode` 不在返回对象键集合 | `PlatformPorts` 不能读取 `environmentMode` | 配置值重新混入端口集合 |

### 8.2 D 组 · 默认实例

| id | 断言 | 反断言 | 证伪缺陷 |
|---|---|---|---|
| D-1 | console logger 在 DEV/TEST/PROD 对 debug/info/warn/error 各实际调用对应 console 方法，并返回 sanitized succeeded event | 任一级别未调用 console、出现 raw masking mode 或 public emit | 默认 logger 名存实亡/可绕过；“什么都没做”返回成功 |
| D-2 | process-memory KV 完成 write/read/readMany/list/remove/clear；missing 明确可判 | 不把 missing 返回成 null；测试不声称跨 restart | Map 只占键位却不可用，或冒充持久化 |
| D-3 | `unavailablePersistSecurePort` 的每个方法返回本端口/能力 + `ADAPTER_NOT_INJECTED` | 不抛、不返回 null、不返回 succeeded | 明文/空成功冒充加密 |
| D-4 | `unavailableDevicePort` 每个方法同上；subscribe 不调用 listener | 不生成假设备快照 | 无设备实现却伪造 0 值 |
| D-5 | `unavailableAppControlPort` 每个方法同上 | 不执行 callback/动作，不返回 accepted | 无宿主实现却称受理 |
| D-6 | `unavailableScriptPort` 每个方法同上 | 不调用 dispatcher | fallback 到主 JS 执行 |
| D-7 | `unavailableConnectorPort` 四方法同上 | 不登记 handler，不返回假 subscriptionId | 空 connector 假可用 |
| D-8 | `unavailableHotUpdatePort` 七方法同上 | marker read 不返回 absent；absence 只属于真实可用 store | 把“能力没有”冒充“marker 没有” |
| D-9 | `unavailableLogUploadPort.uploadLogsForDate` 同上 | 不返回空 uploadedFiles succeeded | 无 uploader 的空成功 |
| D-10 | `unavailableTopologyHostPort` 四方法同上 | start 不返回空 URL，status 不返回 stopped succeeded | 未启动 host 冒充已停服务 |

每个不可用端口必须逐方法迭代断言；只抽样一个方法不算覆盖。

不可用结果的 `capability` 必须是触发该结果的方法名，不能使用端口名、缩写或自由描述。D 组逐方法对拍的
固定集合如下：`persistSecure = read | write | remove | readMany | writeMany | removeMany | listKeys | clear`；
`device = getDeviceInfo | getSystemStatus | getPowerStatus | subscribePowerStatus | unsubscribePowerStatus`；
`appControl = resetRuntime | exitApplication | clearHostDataCache | setFullscreen | getFullscreen | setKioskMode |
getKioskMode | showNativeLoading | hideNativeLoading`；`script = execute | getStats | clearStats`；
`connector = call | subscribe | unsubscribe | on`；`hotUpdate = downloadPackage | writeBootMarker | readBootMarker |
readActiveMarker | readRollbackMarker | clearBootMarker | confirmLoadComplete`；`logUpload = uploadLogsForDate`；
`topologyHost = start | stop | getStatus | getDiagnosticsSnapshot`。每条 D-3…D-10 都必须逐一断言
`result.status === 'unavailable'`、`result.port` 等于端口名、`result.capability` 等于上述方法名且
`result.reason === 'ADAPTER_NOT_INJECTED'`；测试不得只断言 reason。

### 8.3 S 组 · 成功语义

| id | 断言 | 反断言 | 证伪缺陷 |
|---|---|---|---|
| S-1 | 假 `resetRuntime` 返回 `accepted/requestId/SUCCESSOR_RUNTIME_STARTED`，调用方分支得到“已受理但未生效” | `accepted.status !== 'succeeded'`；不能读取 `value.completed` | 排队即成功 |
| S-2 | 同一 fake 的 terminal observer 未产生 successor signal 时，测试状态保持 pending，不自行翻成 succeeded | 不以 Promise resolve 作为生效证据 | RN84 `restartApp` 旧缺陷复现 |
| S-3 | 一个 succeeded fake 只有在可观察 flag 已改变后返回；调用方消费 `value` | 不允许在 flag 未改变时返回 succeeded | result type 有区分，但实现仍空成功 |
| S-4 | timed-out fake 返回 `status:'timed-out'` 与原 timeoutMs | 不改写成 generic failed 或 unavailable | timeout 语义丢失 |

### 8.4 L 组 · 脱敏

| id | 输入与断言 | 反断言 | 证伪缺陷 |
|---|---|---|---|
| L-1 | message 含 `13800138000`，sink/event 均只见手机号遮蔽标记，`containsSensitiveRaw=true` | 原手机号零命中 | 只扫 key 不扫 message/value |
| L-2 | DEV、TEST、PROD 各跑 L-1 | 三环境任一不得出现 raw | 非 PROD 泄漏 |
| L-3 | data/error.message 分别含 password 与 password hash | raw secret/hash 零命中 | 只清 message 或只清 data |
| L-4 | 普通 key 的值含 token | raw token 零命中 | 只按 key 扫描 |
| L-5 | cookie | raw cookie 零命中 | 禁记类别遗漏 |
| L-6 | Authorization bearer | header/raw bearer 零命中 | Authorization 遗漏 |
| L-7 | OTP/验证码 | raw code 零命中 | OTP 遗漏 |
| L-8 | 登录名 | raw login name 零命中 | login identity 遗漏 |
| L-9 | IPv4 与 IPv6 原始地址 | raw IP 零命中 | IP 模式遗漏 |
| L-10 | raw request/response 和 account-exists 语句 | raw payload/可反推账号存在性文字零命中 | 上位标准后两类遗漏 |
| L-11 | 普通值保持；合法 `packageSha256`、`manifestSha256`、`bundleVersion` 与 `accountBalance` 原样保留；不安全 hash/account 值仍遮蔽 | 不得把合法诊断字段误报为 hash/account/IP，也不得放过不安全值 | 诊断字段不可用或值扫描被安全放行 |
| L-12 | 类型夹具 `logger.emit(event)` 使用 `@ts-expect-error` | 去掉注释 typecheck 必须因方法不存在而红 | public sanitizer bypass 回归 |
| L-13 | `debug/info/warn/error` 四入口、`scope/withContext` 派生写入及 `LogContext.commandName` 逐一通过同一 sanitizer | 任一路径 sink 不得看到 raw，且不存在第二套 write path | 只测 info，context 或其他公开入口旁路 |

测试只比较禁记 raw 是否消失与非敏感值是否保留，不把具体 masking 正则实现固化成可配置框架。

### 8.5 C 组 · 消费者编译夹具

| id | 正向消费 | 负向消费 | 证伪缺陷 |
|---|---|---|---|
| C-1 | state/runtime 风格调用 `persistKv.read/write`，对 succeeded/missing/unavailable/failed/timed-out 穷尽 switch；logger 写入带 `RequestId` context | 直接把 `PortResult<StateStorageReadValue>` 当 string 用，`@ts-expect-error` | 接口可实现但不可真实消费；失败可跳过分支 |
| C-2 | workflow 风格调用 `script.execute`，并让 named dispatcher 消费 functionName/argsJson/resultJson | 恢复开放函数表不能赋给 `ScriptNativeBindings` | script 跨界仍是 any 表 |
| C-3 | workflow 调 `connector.call`，对 typed response 与统一失败 union 分支 | 把 response payload 当未经声明字段使用，`@ts-expect-error` | generic 形同 any |
| C-4 | workflow 调 `subscribe/on`，真实读取 subscriptionId、message sequence/payload、error code，再 unsubscribe | listener 用错 payload 类型，`@ts-expect-error` | 只证明方法存在，不证明消息/错误可消费 |
| C-5 | assembly 风格逐键构造 `PlatformPortBindings` 并调用 factory | 少 `topologyHost` 一键，`@ts-expect-error` | 穷尽 record 假闭包 |
| C-6 | `LogUploadInput.commandId` 接受 `CommandId` | 把 `RequestId` 传给 commandId，`@ts-expect-error` | contracts brand 在真实端口边界被擦成 string |

### 8.6 F 组 · 类型层完整性

| id | 断言 | 反断言 | 证伪缺陷 |
|---|---|---|---|
| F-1 | 从包根导入全部公开名，并为 10 个端口各构造一个完整合法实现 | 任何实现若缺方法不能满足接口 | 深层文件有类型但包根不可用 |
| F-2 | 每个 actual port 的方法集合与本文 exact list 相等 | 从 `ConnectorPort` fake 删除 `on`，`@ts-expect-error` | P-3 只扫 optional，却放过缺方法 |
| F-3 | `PlatformPortBindings` 10 键完整，factory 返回对象也是 10 键 | 少键 `@ts-expect-error` | 装配分母漂移 |
| F-4 | `localWebServer/display/automation/logger.emit` 均不可从包根使用 | 每项都有 `@ts-expect-error` | 明确排除项被悄悄加回 |

### 8.7 typecheck 反向控制

在仓外 `mktemp -d` scratch 复制本包与 tsconfig 最小闭包，先用 `--listFilesOnly` 确认
`test/public-surface.typecheck.ts` 在编译列表；然后删除 C-6 或 L-12 的一行 `@ts-expect-error`，用仓内 TypeScript
binary 执行 `--noEmit`，必须非 0 且错误精确指向 brand 不可赋值或 `emit` 不存在。真实树紧接着 typecheck 0，
scratch 删除并记录 cleanup PASS。

## 9 · 四道机器门与 support check

不得为语义 review 造更多门。四门使用 TypeScript AST/TypeChecker，不用单行 regex 解析类型或多行 import。

| 门 | 真实树判据 | 定向红 mutation | 预期唯一首错 |
|---|---|---|---|
| P-2 `tr05-named-boundary` | platform-ports 全 src exported boundary + 泛型约束无 `Record<string, unknown>`/any，全 src 无双重 cast | `src/types/connector.ts` 在 `ConnectorCallResponse` 后加 exported `payload: Record<string, unknown>` | `TR-05 Record<string, unknown>` |
| P-3 `required-port-shape` | `PlatformPorts`/`PlatformPortBindings` 10 键零 optional；10 个 port interface 的本文方法零 optional | 把 `ConnectorPort.on` 改为 `on?` | `optional port method ConnectorPort.on` |
| P-4 `default-import-allowlist` | `src/defaults/**` 只 import 本包相对路径与 contracts；package production dependency 只有 contracts | 在 `src/defaults/unavailableConnector.ts` 加 `import type {Store} from 'redux'` | `default import outside allowlist: redux` |
| P-8 `platform-identifier-boundary` | 全 src 无 RN/Expo/Electron/native import；无明确原生符号 `NativeModules/TurboModuleRegistry/requireNativeModule/UIApplication/UIDevice/BrowserWindow/webContents/ipcMain/ipcRenderer` | 在 `src/types/device.ts` 加 `import type {NativeModules} from 'react-native'` | `platform import react-native` |

`support-public-surface` 不计入四门：TypeChecker 读取 `src/index.ts` module symbol，与 §10 exact exports 双向相等，
拒绝 `export *`，并显式断言 `localWebServer/display/automation/emit` 不存在。红 mutation 是 index 增加
`export const unexpectedPortExport = 1`，只允许 support 红。

model test 在 temp fixture 逐个 mutation；每次断言目标门红、其余三门和 support 绿，最后删除 fixture。真实树
同一 checker 输出四门和 support 全绿。两份输出缺一不可。

## 10 · 文件形态与精确公开面

### 10.1 生产文件

```text
src/types/result.ts
src/types/logging.ts
src/types/storage.ts
src/types/device.ts
src/types/appControl.ts
src/types/script.ts
src/types/connector.ts
src/types/hotUpdate.ts
src/types/logUpload.ts
src/types/topologyHost.ts
src/types/platformPorts.ts
src/foundations/sensitiveData.ts
src/foundations/createPlatformPorts.ts
src/defaults/logger.ts
src/defaults/processMemoryStorage.ts
src/defaults/unavailablePersistSecure.ts
src/defaults/unavailableDevice.ts
src/defaults/unavailableAppControl.ts
src/defaults/unavailableScript.ts
src/defaults/unavailableConnector.ts
src/defaults/unavailableHotUpdate.ts
src/defaults/unavailableLogUpload.ts
src/defaults/unavailableTopologyHost.ts
src/index.ts
```

不建目录 barrel，不用 `export *`。八个不可用端口各有独立文件，避免一个大对象漏方法时难以定位；共享的 typed
unavailable 构造 helper 保持 `foundations/createPlatformPorts.ts` 内部私有，不导出通用 fallback API。

### 10.2 `src/index.ts` exact export groups

| 来源 | 公开名 |
|---|---|
| 骨架 | `moduleName`, `dependencyModuleNames`, `devDependencyModuleNames` |
| result | `EnvironmentMode`, `PlatformPortName`, `CapabilityUnavailableReason`, `PortUnavailable`, `PortError`, `PortFailure`, `PortTimedOut`, `PortSucceeded`, `PortAccepted`, `NoOutput`, `PortResult`, `PortActionResult` |
| logging | `LogLevel`, `LogMaskingMode`, `LogPrimitive`, `LogValue`, `LogFields`, `LogScope`, `LogScopeBinding`, `LogContext`, `LogError`, `LogSecurity`, `LogEvent`, `LogWriteInput`, `LogWriteResult`, `LoggerPort` |
| storage | `StateStorageCall`, `StateStorageReadInput`, `StateStorageWriteInput`, `StateStorageKeysInput`, `StateStorageEntriesInput`, `StateStorageEntry`, `StateStorageReadValue`, `StateStorageReadEntry`, `StateStoragePort` |
| device | `DeviceInfo`, `ProcessorStatus`, `MemoryStatus`, `StorageStatus`, `NetworkStatus`, `PowerStatus`, `SystemStatus`, `PowerStatusChanged`, `PowerStatusListener`, `DeviceCall`, `PowerStatusSubscriptionInput`, `PowerStatusUnsubscribeInput`, `DevicePort` |
| appControl | `AppControlCall`, `RuntimeResetInput`, `ExitApplicationInput`, `SurfaceActionInput`, `SurfaceToggleInput`, `NativeLoadingInput`, `ApplicationToggleInput`, `ToggleState`, `RuntimeTransitionObservation`, `ExitTransitionObservation`, `AppControlPort` |
| script | `NativeFunctionInvocation`, `NativeFunctionOutput`, `NativeFunctionDispatcher`, `ScriptNativeBindings`, `ScriptExecutionInput`, `ScriptExecutionOutput`, `ScriptStats`, `ScriptCall`, `ScriptPort` |
| connector | `ConnectorScalar`, `ConnectorValue`, `ConnectorObject`, `ConnectorChannelRef`, `ConnectorCallRequest`, `ConnectorCallResponse`, `ConnectorMessage`, `ConnectorError`, `ConnectorSubscriptionError`, `ConnectorSubscribeInput`, `ConnectorEvent`, `ConnectorOnInput`, `ConnectorUnsubscribeInput`, `ConnectorSubscription`, `ConnectorPort` |
| hotUpdate | `HotUpdateCall`, `HotUpdateDownloadInput`, `HotUpdateInstall`, `HotUpdateMarkerInput`, `HotUpdateMarker`, `HotUpdateMarkerRead`, `HotUpdateMarkerWrite`, `HotUpdatePort` |
| logUpload | `LogUploadInput`, `UploadedLogFile`, `LogUploadOutput`, `LogUploadPort` |
| topologyHost | `TopologyHostState`, `TopologyHostRuntimeConfig`, `TopologyHostConfig`, `TopologyHostAddress`, `TopologyHostStatus`, `TopologyHostStats`, `TopologyHostDiagnostics`, `TopologyHostCall`, `TopologyHostPort` |
| assembly/factory | `LoggerConsoleBinding`, `LoggerSinkBinding`, `LoggerBinding`, `PlatformPortBindings`, `PlatformPorts`, `CreatePlatformPortsInput`, `createPlatformPorts` |
| defaults | `consoleLoggerBinding`, `createProcessMemoryStateStoragePort`, `unavailablePersistSecurePort`, `unavailableDevicePort`, `unavailableAppControlPort`, `unavailableScriptPort`, `unavailableConnectorPort`, `unavailableHotUpdatePort`, `unavailableLogUploadPort`, `unavailableTopologyHostPort` |

不公开 sanitizer、mask pattern、unavailable helper 或 sink writer。实现时 checker 的 expected list 必须从本文逐名抄入，
不得用当前源码自派生 expected 值，否则 extra export 永远抓不到。

## 11 · 与 POC 的显式差异

1. `PlatformPorts` 从 10 层 optional 改 10 键必填；各 port interface 内零 optional method。
2. `environmentMode` 从端口对象移到 factory 输入，不出现在返回对象。
3. `register/seal` 不建，使用一次性穷尽 record 与冻结 root。
4. logger 删除 public `emit`；所有写入口全环境统一 sanitizer，覆盖 message/data/error。
5. `persistKv` 只保留 string KV；进程内默认明确不跨重启；`persistSecure` 不允许明文 fallback。
6. device 从字符串 getter 改结构快照，删除 displays 与 Android-only battery health/外设枚举。
7. appControl 的 `restartApp` 改为 `resetRuntime`，六类能力全量声明，accepted 不冒充 succeeded。
8. appControl `onAppLoadComplete` 别名删除；surface 只收被推进的 key，不查显示器。
9. script 从开放函数表改“名字列表 + 单一 typed dispatcher + JSON string”。
10. connector 冻结四方法 typed 契约，推迟 channel 分类；不搬 `INTENT/AIDL/...`。
11. hotUpdate 的 marker 全部具名，absence 与 unavailable 分开；删除 report alias。
12. log upload 删除无 reader metadata，display 字段改 surface，ID 使用 contracts brand。
13. topology 只保留生产 host 能力；fault/prepare/handshake/automation 排除。
14. `localWebServer` 不单建；已证 URL/协议能力由 topologyHost 承担。
15. `display` 与 `automation` 不进入 platform-ports。
16. console 默认不再按 PROD/debug 静默丢弃；四级 console 写入均在调用完成后返回 succeeded。
17. sanitizer 对 `LogContext.commandName` 使用同一 value 规则，并对合法热更新 hash、版本与余额字段保留可诊断值；未知字段不透传。

## 12 · 未决项与明确不做

| 项目 | 状态 | 本批允许 | 本批禁止 |
|---|---|---|---|
| connector channel 分类 | `UNVERIFIED_REQUIRES_EVIDENCE` | opaque `channelKey` + typed payload/订阅 | 新建能力/机制枚举 |
| app exit/kiosk owner 与产品授权 | `DEXTER_DECISION` | 声明端口 shape、提供 unavailable 默认 | 给生产 consumer 接线或实现真机动作 |
| iOS/Electron/Linux adapter 语义 | `UNVERIFIED_REQUIRES_EVIDENCE` | 在矩阵登记 ✓/△/✗ 与合法 unavailable | 声称已动态证明 |
| topology iOS background | `UNVERIFIED_REQUIRES_EVIDENCE` | 返回 platform unsupported | 猜测持续服务可用 |
| hot update 四平台实现 | `UNVERIFIED_REQUIRES_EVIDENCE` | 冻结已证 package/marker shape | 实现 adapter 或声明发布策略已解决 |
| persistKv 重启数据 | `DEXTER_DECISION` 残留风险 | 明确 process-memory 名称/JSDoc | 声称默认持久化 |
| localWebServer | 本详设按需求条件判为不建 | topologyHost 保留 local URLs | 空接口/默认占位 |

不建运行期 schema、类型 codegen、可配置脱敏规则、可变 registry、display/automation port、任何 adapter、
任何真实 native 行为。

## 13 · 停机条件

实施阶段遇到以下任一项必须停止当前 CP 并向 Dexter 报告，不得自行决定：

1. 任一端口或字段找不到 §7.1 所列形状证据；
2. 任一方法无法回答 §7.4 五问，或只能用无判别的 `Promise<void>` 表达；
3. 发现 localWebServer 的真实非协议 consumer/独立生命周期，导致本文“不建”前提变化；
4. 默认实现需要新增第三方依赖、平台 import 或新增 skeleton 出边；
5. 需要恢复 `Record<string, unknown>`、any、双重 cast、可选端口/方法或 logger.emit；
6. 需要冻结 connector channel 分类；
7. 需要给 exit/kiosk 决定 owner、产品入口或权限；
8. 需要改尚未授权的 workflow/runtime/assembly/adapter 生产源码；
9. focused proof 红、red mutation 不红、真实树不绿或 scratch cleanup 非 PASS；
10. 继续动作涉及动态运行、设备、DEV、seed/reset、浏览器 L2、UAT 或部署。

上游文字、POC 与 reviewer finding 都是待验证输入；冲突时回到当前正本与 owning source，不以 fallback 或放宽门
强行通过。
