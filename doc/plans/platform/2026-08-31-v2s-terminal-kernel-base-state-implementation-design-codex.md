SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0

# TER `kernel.base.state` · implementation-facing 详设

## 0 · 元数据、输入与授权边界

```text
PROGRAM_ID=V2S_W0_W4_EXECUTION
BUSINESS_SOURCE=doc/plans/platform/2026-08-31-v2s-terminal-kernel-base-state-requirements-claude.md
RULE_SOURCE=doc/platform/terminal-coding-standard.md
OBSERVABILITY_SOURCE=doc/decisions/2026-07-29-v2s-observability-and-acceptance-standard.md
ARCHITECTURE_SOURCE=project-memory/decisions/terminal-architecture-and-stack-rulings.md
BUILD_ORDER_SOURCE=project-memory/decisions/terminal-build-order-and-batches.md
JOURNEY_REFS=NOT_APPLICABLE_WITH_REASON（React-free kernel toolkit，无用户 Journey）
IA_REF=NOT_APPLICABLE_WITH_REASON（Dexter 已确认无用户可见界面、导航、焦点或交互）
INTERACTION_REF=NOT_APPLICABLE_WITH_REASON（无页面或用户操作）
AUTHORIZED=详设、实施与 state 包及其四道门/TER-local 接线（Dexter 2026-08-31）
NOT_AUTHORIZED=改端口；修改其余 21 个 TER 包生产源码；adapter/native；动态设备；DEV；seed；reset；浏览器 L2；UAT；部署；仓级 normal verify
IMPLEMENTATION_AUTHORITY=true
REVIEW_CYCLE_ID=TER_KERNEL_BASE_STATE_IMPLEMENTATION_DESIGN_20260831
```

Roadmap 只记录 program 授权；本轮具体授权以 Dexter 的直接指派为准。启动时发现
`project-memory/operations/terminal-coding-standard.md` 与 `required-inventory.json` 仍停留在九条规则的旧断言，
已按当前 `doc/platform/terminal-coding-standard.md` 修复记忆条目与 assertion source，并运行
`scripts/memory/build-index` 得到 `PROJECT_MEMORY=PASS / ENTRIES=75 / KERNEL=6 / ROUTED=69`；
随后以六维具体路由重新查询并重开返回的 memory 与 owning source。当前 recall 已通过，不以旧 drift 结论作为实施依据。

## 1 · 真实目标与方案比较

### 1.1 结构性问题

本包要让业务 slice 只声明持久化与同步意图，统一 runtime 负责按声明构造 store、恢复、差量落盘、清理、
存储类别迁移和无状态全量同步。若照搬 POC，会同时保留六条持久化缺陷、五条同步保证不足、hydrate 运行期越权写、
`writeMany` 半提交假象和失败不可观测；若只做类型壳，则下游仍会各自手写存储与同步旁路。

### 1.2 方案比较

| 方案 | 结果 | 结论 |
|---|---|---|
| A · 照搬 POC runtime | manifest 与 batch write 没有提交协议；hydrate/reset/sync 都可绕 owner；失败仍能静默。 | 拒绝。 |
| B · 只交 descriptor 与纯同步 helper | 当前代码少，但没有恢复、差量、迁移、健康与 TR-04 重启闭包；真实问题留给每个 owner。 | 拒绝。 |
| C · async 构造期 hydrate + typed descriptor registration + 逐键写删 + 枚举批读 + runtime 健康 + 无状态 full snapshot | 不改端口、不造事务协议、不造会话账本，同时把数据安全与失败可见闭合。 | **采用。** |

我选择 C 而不是 A/B，因为它用当前端口真实能提供的保证完成本包职责；对端口无法提供的整 record 原子性、
接收方序号和自动重试均不冒充完成。

### 1.3 两个从源码推导出的额外安全边界

1. **hydrate 基线未知时禁止写对应后端。** `listKeys/readMany` 失败若仍允许自动 flush，初始 state 会覆盖尚未读出的旧数据。
   因此 plain/protected 分别维护 `baselineKnown`；未知后端进入 health 的 `blockedStorageKinds`，该后端所有 write/remove
   fail closed，直到新 runtime 在构造期成功 hydrate。没有运行期 rehydrate 后门。
2. **每次 flush 失败后继续处理其余独立 entry。** 若首个失败即中止，固定坏键会让后续合法键永远不前进。
   逐键循环记录全部失败和成功；operation 最终为 failed，但成功键可以更新 cache，失败键保持 dirty。

这两条是需求目标“失败不得伪装成成功”和“record entry 独立提交”的直接推论，不增加端口、协议或后台任务。

## 2 · CP 总览

| CP | 主题 | owner | 主要输出 | 依赖 |
|---|---|---|---|---|
| CP-1 | 类型、descriptor registration、workspace 轴 | Codex | 精确公开面、双向校验、type fixture | design GO |
| CP-2 | store、hydrate、持久化与同步 runtime | Codex | preloadedState、逐键 flush/reset、健康、full snapshot | CP-1 |
| CP-3 | 十组测试、四道门与 TER-local 接线 | Codex | D/P/R/F/H/C/M/X/S/T、3 REAL owner、state static checker | CP-2 |
| CP-4 | README、全范围对账与 TER-local 验收 | Codex | TR-10、实施证据、静态/typecheck/test/export 证明 | CP-1…3 |

实施时每个 CP focused proof 后、下一 CP 前必须由 fresh 独立子 agent 做三维证伪式对账；全部 CP 后、整体测试前
重新做全范围对账。本文只规定未来实施纪律，不授权当前执行。

## 3 · 横切机制对照表

| 机制 | ① 现成能力/规范 | ② 可证伪观察 | ③ 本批确定形态 | ④ 适用全集 |
|---|---|---|---|---|
| 读侧节点授权 | `TR-03` + `TR-09` state 例外 | 未注册/无 persistence 或 sync 的 slice 被跳过并记诊断；不得新增具名 `readSlice` 便捷入口 | `getStore()`/`getState()` 暴露 Redux 原生根，实际 persistence/sync 读取仍由 registration closure 完成；TR-03 机械门约束源码访问 | hydrate、flush、sync payload |
| 写授权与 grant 复核 | `TR-01`、`TR-09` | root action creator 从 package root 不可导入 | hydrate 走构造期；reset 仅 actor；sync apply 是唯一外部写例外 | hydrate/reset/sync 三路径 |
| 跨 owner 写与事务 | `TR-09` 六条边界 | 未声明 sync 的 payload 不改 state | 只有 authoritative sync apply；不承诺跨 slice/record 原子 | sync slice 集合 |
| 集合形态与分页 | `TR-07`；本包无分页接口 | key 枚举每物理后端每 hydrate/reset 恰一次 | 有界于后端全部键，`O(all backend keys)`；无 manifest | plain/protected keyspace |
| 缓存失效 / 改完刷新什么 | 需求 §6 | hydrate 后立刻 flush 写 0；失败键下次仍写 | cache 只代表已确认落盘 raw 值；逐键成功才前移 | field/record 全 persisted key |
| RTK 数据读取与加载判定 | N/A：非 RTK Query 前端数据加载 | type/runtime tests | 仅 Redux store；无 currentData/isFetching | 全批 |
| 同一事实只有一个住址 | `TR-09` toolkit | src 零 slice，health 不进 Redux | 业务事实只在 owner slice；本包只持运行期 cache/health | 全部 descriptor |
| 失败可见且原因不得改写 | `TR-02`、platform-ports 五态 | 端口 failed/timed-out/unavailable 均落 typed health + logger | composite operation result + observable health | hydrate/flush/migration/reset |
| owner 错误到 HTTP 映射与注册处 | N/A：无 HTTP/owner edge | 包内无 route/problem mapper | 不建 | 全批 |
| 幂等键构成与重放语义 | N/A：无 HTTP command replay | 无 idempotency 字段/API | 不建 | 全批 |
| 该用生成物的地方不得手搓字符串 | N/A：无 OpenAPI/generated wire | 无 generated import/文件 | storage key 由单一 keyspace helper 派生 | 全部 persisted key |
| 日志落点与脱敏字段 | `LoggerPort`、observability standard §2 | 日志只含 phase/outcome/storageKind/storageKey/error code，不含 raw value | scope 固定 `kernel.base.state`；port logger 统一脱敏 | hydrate/flush/reset/sync skip |
| 迁移回填与可逆性 | 需求 §6 | 新后端写失败旧值仍在；旧明文删失败 operation 红 | 先写新、后删旧；无 DB migration | plain↔protected 每个 key |
| 前端共享行为 | N/A：无 UI | 无 component/import | 不建 | 全批 |
| 候选/下拉数据源 | N/A：无 UI collection | 无 selector/query | 不建 | 全批 |
| 编码与名称呈现 | key grammar + codec | delimiter round-trip、相邻 namespace 不误匹配、非法 JSON typed fail | `encodeURIComponent` 分段 + canonical JSON codec | persistence key、slice、descriptor、entry |
| 会同时坏的东西是否已声明为原子组 | 需求裁定“不承诺整 record 原子” | second entry 失败后重启得到逐 entry 合法集合 | 原子单元仅单 storage key；root reset 只有全删成功才内存 reset | field key、record entry、reset lifecycle |

## 4 · 精确公开类型与 API

### 4.1 JSON、安全结果与持久化类型

以下是实现契约，不是示意。源码不得出现显式 `any`、`Record<string, unknown>` 或双重 cast。

```ts
export type StateJsonPrimitive = string | number | boolean | null
export type StateJsonValue = StateJsonPrimitive | readonly StateJsonValue[] | StateJsonObject
export interface StateJsonObject { readonly [key: string]: StateJsonValue }

export type PersistIntent = 'never' | 'owner-only'
export type SyncIntent = 'isolated' | 'master-to-slave' | 'slave-to-master'
export type PersistenceProtection = 'plain' | 'protected'
export type PersistenceFlushMode = 'immediate' | 'debounced'
export type PersistenceStorageKind = 'plain' | 'protected'
export type PersistencePhase = 'hydrate' | 'flush' | 'migration' | 'reset'

export interface StateStorageTimeoutPolicy {
  readonly readMs: number
  readonly writeMs: number
  readonly resetMs: number
}

export interface StateRuntimePersistenceFieldDescriptor<
  TState extends object,
  TKey extends keyof TState & string = keyof TState & string,
> {
  readonly kind: 'field'
  readonly stateKey: TKey
  readonly storageKey?: string
  readonly protection?: PersistenceProtection
  readonly flushMode?: PersistenceFlushMode
  readonly shouldPersist?: (value: TState[TKey], state: Readonly<TState>) => boolean
}

export interface StateRuntimePersistenceRecordDescriptor<
  TState extends object,
  TEntryKey extends string = string,
  TEntryValue extends StateJsonValue = StateJsonValue,
> {
  readonly kind: 'record'
  readonly storageKeyPrefix?: string
  readonly protection?: PersistenceProtection
  readonly flushMode?: PersistenceFlushMode
  readonly getEntries: (state: Readonly<TState>) => Readonly<Partial<Record<TEntryKey, TEntryValue>>>
  readonly applyEntries: (
    state: Readonly<TState>,
    entries: Readonly<Partial<Record<TEntryKey, TEntryValue>>>,
  ) => TState
  readonly shouldPersistEntry?: (
    entryKey: TEntryKey,
    value: TEntryValue,
    state: Readonly<TState>,
  ) => boolean
}

export type StateRuntimePersistenceDescriptor<TState extends object> =
  | StateRuntimePersistenceFieldDescriptor<TState>
  | StateRuntimePersistenceRecordDescriptor<TState>
```

`record.getEntries/applyEntries` 在 TER 为必填。它用两行 owner 侧显式映射换掉 POC“默认把整个 slice 当 record”的隐式
假设和 `as any`；同时允许 record 位于 slice 子字段。没有第三种 blob 粒度。

field descriptor 不在类型层把 `TState[TKey]` 限制成 `StateJsonValue`：field 指向 owner 已有字段，反向约束 owner
slice 形状会把本包的 toolkit 规则泄漏进业务模型。运行时仍由 persistence codec 在写入边界逐值拒绝非 JSON-safe 值；
record 则从一开始以 `TEntryValue extends StateJsonValue` 约束动态 entry，二者差异是固定的粒度责任而非遗漏。

### 4.2 六字段 descriptor 与异构 registration

```ts
type StateRuntimePersistenceDeclaration<TState extends object> =
  | {
      readonly persistIntent: 'never'
      readonly persistence?: never
    }
  | {
      readonly persistIntent: 'owner-only'
      readonly persistence: readonly [
        StateRuntimePersistenceDescriptor<TState>,
        ...StateRuntimePersistenceDescriptor<TState>[],
      ]
    }

type StateRuntimeSyncDeclaration<TState extends object> =
  | {
      readonly syncIntent?: 'isolated'
      readonly sync?: never
    }
  | {
      readonly syncIntent: Exclude<SyncIntent, 'isolated'>
      readonly sync: StateRuntimeSyncDescriptor<TState>
    }

export type StateRuntimeSliceDescriptor<TState extends object> = {
  readonly name: string
  readonly reducer: Reducer<TState>
} & StateRuntimePersistenceDeclaration<TState> & StateRuntimeSyncDeclaration<TState>

declare const stateRuntimeSliceRegistrationBrand: unique symbol

export interface StateRuntimeSliceRegistration {
  readonly [stateRuntimeSliceRegistrationBrand]: true
  readonly name: string
  readonly persistIntent: PersistIntent
  readonly syncIntent: SyncIntent
  readonly hasPersistence: boolean
  readonly hasSync: boolean
}

export function defineStateRuntimeSlice<TState extends object>(
  descriptor: StateRuntimeSliceDescriptor<TState>,
): StateRuntimeSliceRegistration
```

`defineStateRuntimeSlice` 负责单 descriptor 四条双向校验和 key grammar 校验，并把具体 `TState` 封进包内私有 closure；
`CreateStateRuntimeInput.slices` 因而可以是类型安全的异构 registration 数组，不需要公开 `any` 或让消费者双重 cast。
registration 是冻结的 nominal object：非导出的 `unique symbol` 让外部对象字面量不能伪造；模块内 WeakMap 以该 object identity
保存 reducer/persistence/sync closure，runtime 同时检查 brand 与 WeakMap membership，任一缺失都在 I/O 前 fail closed 并带 name。
内部 persistence registration 也必须保持 field/record 判别式联合：field 分支的 `stateKey`、归一化 `storageKey`、`readField`、
`writeField` 必填，record 分支的归一化 `storageKeyPrefix`、`getEntries`、`applyEntries` 必填；引擎不使用可选链或字面量兜底。
公开 descriptor 的可选 key 只在 registration 构造时归一化（field 默认 `stateKey`，record 默认 `entries`），因此 erased 边界不会
把缺失回调静默吞掉。新增 descriptor kind 必须同时新增判别式分支、构造校验与引擎消费路径。
泛型擦除只允许在 `defineStateRuntimeSlice` 写入 WeakMap 的单一内部边界做一次具名 assertion；不得出现在公开类型、consumer
或 runtime 其他路径。registration 对外只可读五个元数据，不暴露“任意读写 slice”的函数。重复 slice name 在 runtime 聚合时再检查。

四条一致性固定为：

1. `owner-only` 必须有非空 persistence；
2. `never` 必须没有 persistence 或为空；
3. 非 `isolated` syncIntent 必须有 sync；
4. `isolated`/未声明必须没有 sync。

`syncIntent` 未声明在 registration 中规范化为 `isolated`。错误消息固定带 descriptor name 和冲突字段。

### 4.3 同步类型与纯函数

```ts
export type SyncValueEnvelope<TValue extends StateJsonValue = StateJsonValue> =
  | { readonly value: TValue; readonly updatedAt: TimestampMs; readonly tombstone?: never }
  | { readonly value?: never; readonly updatedAt: TimestampMs; readonly tombstone: true }

export type SyncRecordState<
  TKey extends string = string,
  TValue extends StateJsonValue = StateJsonValue,
> = Readonly<Partial<Record<TKey, SyncValueEnvelope<TValue>>>>

export interface SyncStateSummaryEntry {
  readonly updatedAt: TimestampMs
  readonly tombstone?: true
  readonly valueHash: string
}

export type SyncStateSummary<TKey extends string = string> =
  Readonly<Partial<Record<TKey, SyncStateSummaryEntry>>>

export interface SyncStateDiffEntry<
  TKey extends string = string,
  TValue extends StateJsonValue = StateJsonValue,
> {
  readonly key: TKey
  readonly value: SyncValueEnvelope<TValue>
}

export type SyncStateDiff<
  TKey extends string = string,
  TValue extends StateJsonValue = StateJsonValue,
> =
  | { readonly mode: 'authoritative'; readonly replaceMissing: false; readonly entries: readonly SyncStateDiffEntry<TKey, TValue>[] }
  | { readonly mode: 'authoritative'; readonly replaceMissing: true; readonly entries: readonly SyncStateDiffEntry<TKey, TValue>[] }

export interface SyncDiffOptions { readonly mode: 'authoritative' }

export interface StateRuntimeSyncRecordDescriptor<
  TState extends object,
  TKey extends string = string,
  TValue extends StateJsonValue = StateJsonValue,
> {
  readonly kind: 'record'
  readonly getEntries: (state: Readonly<TState>) => SyncRecordState<TKey, TValue>
  readonly applyEntries: (state: Readonly<TState>, entries: SyncRecordState<TKey, TValue>) => TState
}

export type StateRuntimeSyncDescriptor<TState extends object> = StateRuntimeSyncRecordDescriptor<TState>

export function createSliceSyncSummary<
  TState extends object,
  TKey extends string,
  TValue extends StateJsonValue,
>(
  descriptor: StateRuntimeSyncRecordDescriptor<TState, TKey, TValue>,
  state: Readonly<TState>,
): SyncStateSummary<TKey>

export function createSliceSyncDiff<
  TState extends object,
  TKey extends string,
  TValue extends StateJsonValue,
>(
  descriptor: StateRuntimeSyncRecordDescriptor<TState, TKey, TValue>,
  state: Readonly<TState>,
  remoteSummary: SyncStateSummary<TKey>,
  options: SyncDiffOptions,
): Extract<SyncStateDiff<TKey, TValue>, { readonly replaceMissing: false }>

export function createFullSliceSyncPayload<
  TState extends object,
  TKey extends string,
  TValue extends StateJsonValue,
>(
  descriptor: StateRuntimeSyncRecordDescriptor<TState, TKey, TValue>,
  state: Readonly<TState>,
): Extract<SyncStateDiff<TKey, TValue>, { readonly replaceMissing: true }>

export function applySliceSyncDiff<
  TState extends object,
  TKey extends string,
  TValue extends StateJsonValue,
>(
  descriptor: StateRuntimeSyncRecordDescriptor<TState, TKey, TValue>,
  state: Readonly<TState>,
  diff: SyncStateDiff<TKey, TValue>,
): TState
export function createSyncTombstone(updatedAt: TimestampMs): SyncValueEnvelope<never>
```

- `createSliceSyncDiff` 产出 `replaceMissing:false` 的 authoritative diff；
- `createFullSliceSyncPayload` 以空 remote summary 产出 `replaceMissing:true` 的完整 entries；
- apply 只有在 discriminant 为 true 时删除 payload 未列出的本地 key；显式 tombstone 在两种形态下都删除；
- `valueHash` 固定为 `json:<canonical-json>`（对象 key 排序；tombstone 固定为 `tombstone`）。沿用 POC“序列化内容直接比对”
  的无碰撞语义，不为一个非安全摘要新增 hash 依赖，也不引入 32-bit 碰撞导致漏 diff。字段名沿用既有 envelope 词汇，
  但它不是廉价摘要或密码学 hash，大小与 canonical 全量 JSON 同阶；topology 不得据此假设低成本对账；
- 公开面不存在 `latest-wins`、revision、sequence、cursor、session、lastApplied 或 receiver ledger。

### 4.4 runtime、健康与 reset actor

```ts
export type PersistenceFailureKind =
  | 'PORT_UNAVAILABLE'
  | 'PORT_FAILED'
  | 'PORT_TIMED_OUT'
  | 'ENCODE_REJECTED'
  | 'DECODE_REJECTED'
  | 'HYDRATION_BASELINE_UNAVAILABLE'

export interface PersistenceFailure {
  readonly kind: PersistenceFailureKind
  readonly phase: PersistencePhase
  readonly storageKind: PersistenceStorageKind
  readonly operation: 'listKeys' | 'readMany' | 'write' | 'remove' | 'encode' | 'decode'
  readonly storageKey?: string
  readonly code?: string
  readonly message: string
}

export interface PersistenceHealth {
  readonly status: 'healthy' | 'degraded'
  readonly revision: number
  /** Historical diagnostic value; current state is determined by status/dirty/block fields. */
  readonly lastFailure?: PersistenceFailure
  readonly dirtyKeys: readonly string[]
  readonly blockedStorageKinds: readonly PersistenceStorageKind[]
}

export type PersistenceHealthListener = (health: PersistenceHealth) => void

export interface PersistenceOperationSucceeded {
  readonly status: 'succeeded'
  readonly writtenKeys: readonly string[]
  readonly removedKeys: readonly string[]
}

export interface PersistenceOperationFailed {
  readonly status: 'failed'
  readonly writtenKeys: readonly string[]
  readonly removedKeys: readonly string[]
  readonly dirtyKeys: readonly string[]
  readonly failures: readonly PersistenceFailure[]
}

export type PersistenceOperationResult = PersistenceOperationSucceeded | PersistenceOperationFailed

export interface StateResetActor {
  handleResetCommand(): Promise<PersistenceOperationResult>
}

export type StateSyncSkipReason = 'UNKNOWN_SLICE' | 'SYNC_NOT_DECLARED'
export type StateSyncPayloadResult =
  | { readonly status: 'ready'; readonly sliceName: string; readonly payload: SyncStateDiff }
  | { readonly status: 'skipped'; readonly sliceName: string; readonly reason: StateSyncSkipReason }
export type StateSyncApplyResult =
  | { readonly status: 'applied'; readonly sliceName: string; readonly changed: boolean }
  | { readonly status: 'skipped'; readonly sliceName: string; readonly reason: StateSyncSkipReason }

export interface CreateStateRuntimeInput {
  readonly runtimeName: string
  readonly environmentMode: EnvironmentMode
  readonly slices: readonly StateRuntimeSliceRegistration[]
  readonly logger: LoggerPort
  readonly plainStorage: StateStoragePort
  readonly protectedStorage: StateStoragePort
  readonly persistenceKey: string
  readonly storageTimeouts: StateStorageTimeoutPolicy
  readonly persistenceDebounceMs: number
  readonly storeEnhancers?: readonly StoreEnhancer[]
}

export interface StateRoot { readonly [sliceName: string]: object | undefined }

export interface StateRuntime {
  getStore(): EnhancedStore<StateRoot>
  getState(): StateRoot
  getSlices(): readonly StateRuntimeSliceRegistration[]
  getPersistenceHealth(): PersistenceHealth
  subscribePersistenceHealth(listener: PersistenceHealthListener): () => void
  flushPersistence(): Promise<PersistenceOperationResult>
  getResetActor(): StateResetActor
  createFullSyncPayload(sliceName: string): StateSyncPayloadResult
  applyAuthoritativeSync(sliceName: string, payload: SyncStateDiff): StateSyncApplyResult
}

export function createStateRuntime(input: CreateStateRuntimeInput): Promise<StateRuntime>
```

`createStateRuntime` 必须完成 validate → enumerate/read/decode → build preloadedState → configureStore → subscribe 后才 resolve；
调用者永远拿不到“先暴露 store、后 hydrate”的中间态。预期端口失败不 reject factory，而是返回初始/部分已恢复 store，
并以 health + error/warn 日志表达；配置错误（重复名、descriptor 冲突、非法 timeout/key）同步/异步 throw，阻止装配。

`plainStorage` 与 `protectedStorage` 必须是两个不同的物理 `StateStoragePort` 对象。key grammar 不含 protection segment，
同一对象无法同时表达明文与受保护类别；因此在任何 `listKeys` 之前拒绝 identity alias，而不是把一次物理存储上的同一键误判成迁移并删除。

`getResetActor()` 是唯一 reset 写入口。root reset action type、action creator 与直接 dispatch closure 全部 package-private；
未来 `kernel.base.runtime` 只把 `handleResetCommand` 绑定到 command actor。任何其他生产文件直接调用它由 TR-01 consumer gate/review 拦截。
本包不导出 `resetState()`、`applySlicePatches()` 或 `createResetAction()`。

### 4.5 workspace 单轴

```ts
export type WorkspaceKey = 'MAIN' | 'BRANCH'
export interface WorkspaceStateKeys { readonly MAIN: string; readonly BRANCH: string }
export interface WorkspaceRouteContext { readonly workspace: WorkspaceKey }

export interface CreateWorkspaceActionDispatcherInput {
  readonly routeContext: WorkspaceRouteContext
  readonly dispatch: (action: UnknownAction) => unknown
}

export interface ToWorkspaceStateDescriptorsInput<TState extends object> {
  readonly baseName: string
  readonly reducers: Readonly<Record<WorkspaceKey, Reducer<TState>>>
  readonly createDescriptor: (
    workspace: WorkspaceKey,
    sliceName: string,
    reducer: Reducer<TState>,
  ) => StateRuntimeSliceDescriptor<TState>
}

export function createWorkspaceStateKeys(baseName: string): WorkspaceStateKeys
export function createWorkspaceActionDispatcher(input: CreateWorkspaceActionDispatcherInput): (action: UnknownAction) => unknown
export function toWorkspaceStateDescriptors<TState extends object>(
  input: ToWorkspaceStateDescriptorsInput<TState>,
): readonly StateRuntimeSliceRegistration[]
```

slice 名固定 `<baseName>.MAIN|BRANCH`。owner 自己创建两份 slice/reducer；本包只生成 key、改写 action type、展开
descriptor registration，因此 `src/**` 零 `createSlice`。不导出 instanceMode/displayMode helper，也不把 containerKey/displayMode
当 scope 轴。

`createWorkspaceActionDispatcher` 在构造时校验 `routeContext.workspace`，缺失固定抛
`[createWorkspaceActionDispatcher] routeContext.workspace is required`。每次 dispatch 按 action type **最后一个** `/` 拆成
非空 `sliceType` 与非空 `actionName`；无 `/`、首位 `/` 或末位 `/` 固定抛
`[createWorkspaceActionDispatcher] invalid action type: <type>`。输出 type 固定为
`${sliceType}.${workspace}/${actionName}`，并以 object spread 保留输入 action 除 type 外的全部自有可枚举字段。
例如 `catalog/cart/addLine` 在 MAIN 下变为 `catalog/cart.MAIN/addLine`，不接受前缀、后缀或替换整个 type 的其他算法。

## 5 · key grammar、hydrate 与缓存

### 5.1 唯一 key grammar

固定 namespace：`catering-v2s.terminal.state.v1`；分隔符：`/`；所有动态 segment 用 `encodeURIComponent`，
所以 segment 内的 `/` 与 `%` 可逆且不会改变分段。

```text
instancePrefix = catering-v2s.terminal.state.v1/<E(persistenceKey)>/
fieldKey      = <instancePrefix><E(sliceName)>/field/<E(storageKey ?? stateKey)>
recordPrefix  = <instancePrefix><E(sliceName)>/record/<E(storageKeyPrefix ?? "entries")>/entry/
recordKey     = <recordPrefix><E(entryKey)>
```

构造时拒绝：空 persistenceKey/name/stateKey/storageKey/storageKeyPrefix；同 slice 两个 field 生成同 key；两个 record
生成同 prefix；任一 field/record canonical key 重复；重复 slice name。field 与 record 有明确 kind segment，名字相同不冲突。
解析只接受 exact segment count 和 exact instancePrefix；`pos` 不得误匹配 `pos2`；坏 percent encoding 作为 foreign key 跳过并 warn。

### 5.2 hydrate 固定步骤

1. 校验全部 registration、timeout 为正有限数、keyspace exact-set；在任何 I/O 前失败。
2. 以 port 对象 identity 分组；每个物理后端最多一次 `listKeys({timeoutMs: readMs})`。
3. 在内存中过滤 instancePrefix、解析 descriptor；每个物理后端最多一次 `readMany`。
4. 当前 protection 后端值优先；只有旧类别有值时恢复旧值并登记 migration dirty；两边都有时恢复当前类别并登记旧类别 stale。
5. 每个 found raw 经 codec；坏 JSON/非 JSON-safe 单键跳过、warn、health degraded，不影响其他键。
6. 用每个 reducer 对 `undefined + init action` 得到 owner 初始值，再用 field 赋值或 record `applyEntries` 合成 preloadedState。
7. 只有 baseline known 的后端才初始化 cache；list/read 整体失败的后端加入 blocked，不能被后续 flush 覆盖。
8. configureStore 后建立引用快照与 subscribe；factory 才 resolve。

protected unavailable 的含义是 protected 条目缺席、health degraded、plain 继续；绝不改走 plain，也不让 Web 整体起不来。

### 5.3 codec

编码先递归检查，再 canonical stringify。拒绝：`NaN`、正负 Infinity、`undefined`（含对象字段/数组元素）、循环引用、
`bigint`、function、symbol、Date/Map/Set/自定义 prototype、稀疏数组；返回 `ENCODE_REJECTED`，不得写 `null` 或丢字段。
解码拒绝 malformed JSON 及非 JSON 值，返回 `DECODE_REJECTED`。codec 不抛给自动 flush 调用者。

RTK `serializableCheck`/`immutableCheck` 仅在 `DEV|TEST` 开，`PROD` 关；它们是开发期诊断，不能替代 codec。

### 5.4 cache 与批量方法判定

| 路径 | 端口方法 | 原因 |
|---|---|---|
| hydrate 枚举 | `listKeys`，每物理后端一次 | 端口无 prefix 参数，只能全枚举 |
| hydrate 读取 | `readMany`，每物理后端一次 | successful result 内有逐 key found/missing，且只读不提交 |
| field/record 新写或改写 | **逐 key `write`** | cache 与 entry commit 都需要逐 key succeeded 信息 |
| stale key 删除 | **逐 key `remove`** | 只有 succeeded 才能删 cache；失败键保持 dirty |
| protection migration | **先逐 key `write` 新后端，再逐 key `remove` 旧后端** | 新写失败不丢旧值；旧删失败不能报成功 |
| reset | listKeys 后**逐 key `remove`** | 任一失败则不 dispatch root reset；外部 key 永不进入删除集 |
| `writeMany/removeMany/clear` | 生产路径不用 | 端口无 per-key status/原子保证；`clear` 越 namespace |

因此需求 §9 P 表中“断言 writeMany 入参数量”和 X 表中“writeMany 半提交”按其后 §6 与第二轮裁定收口为：
spy 单键 `write` 调用集合；X fake 在第二个 `write` 返回 failed。不得保留两种互斥实现。

## 6 · store、flush、reset 与同步运行时

### 6.1 store 与两个私有 root action

- `APPLY_AUTHORITATIVE_SYNC`：payload 必须由已注册且 `hasSync` 的 registration 生成；root reducer 只替换该 slice。
- `RESET_TO_OWNER_INITIAL_STATE`：root reducer 把 `undefined` 交给 combined reducers；各 owner reducer 返回自己的 initial state。

两者的 type/action creator 均不导出。hydrate 不是 action。除此之外不建第三个 root action。

middleware：DEV/TEST 开 `serializableCheck/immutableCheck`，PROD 关。没有 reducer 时不是本批有效 runtime；空 registration
集合在装配时报错，不造 placeholder slice。

### 6.2 差量 flush

1. subscribe 记录 persistable slice 的上一引用；无 persistable slice 变化不触发 flush。sync apply 也经过 store subscribe，因此同时声明 persistence+sync 的 slice 自动 dirty。
2. immediate 变化进入同一串行 queue，只处理 immediate descriptors；debounced 变化重置 timer，timer 到点再处理全部 descriptors。immediate 不取消已有 debounced timer；显式 `flushPersistence` 仍处理全部 descriptors。两条自动路径都保留 Promise handler，禁止 `void`。每个新任务先 catch 前一任务的 rejection 再入队，前一异常不得永久 poison 后续 flush/reset。
3. export 当前 canonical entry map；与 confirmed cache 对比得到 writes/removes/migrations。
4. blocked backend 第一次被后续 flush 遇到时，按该后端执行一次且仅一次 `listKeys(readMs)` + `readMany(readMs)` re-baseline；
   两步均成功才解除 block、更新 confirmed cache 并继续本次 flush，任一步失败则产出 `HYDRATION_BASELINE_UNAVAILABLE`、
   保持 block 且不调用 write/remove。此恢复不是周期 retry/退避。
5. 按 stable key sort 逐 key 处理，遇失败记录后继续；成功键单独前移 cache，失败键保持 dirty。
6. 只要一个失败，operation 为 failed、error log、health degraded；全成功才 succeeded。下次状态变化或显式 flush 会重试 dirty。
7. 没有 timer retry、指数退避或“无后续变化时自动恢复”的主张；re-baseline 每后端每 runtime 最多一次，失败后只能下一次
   runtime 构造或成功 reset 重建基线。

### 6.3 reset actor

`handleResetCommand` 先取消 debounce 并排到 persistence queue；对每物理后端 listKeys 一次，过滤 exact instancePrefix，
逐 key remove。任何 list/remove 非 succeeded：返回 failed、保持内存原状、保留剩余 cache/health，不 dispatch reset。
全部删除成功后才清 cache/dirty/block（block 只有已能成功 list 的后端）、dispatch 私有 reset action并返回 succeeded。
同存储外部键原样存活。

### 6.4 health

health 是 runtime 普通冻结 snapshot，不进 Redux。每次变化 revision +1，并同步通知订阅者；listener 加入后不立即回调，
调用者先 `getPersistenceHealth` 再 subscribe，避免双发。unsubscribe 幂等。health 只保存 lastFailure 与当前 dirty/block 集，
不无限累积历史；完整失败逐项写结构化日志。日志不带 raw value。

### 6.5 无状态同步

- topology 通过 `createFullSyncPayload(sliceName)` 取 registered sync slice 全量 authoritative payload；未知或未声明返回 skipped 并 warn。
- 接收端调用 `applyAuthoritativeSync`；只对 registered sync slice生效。`replaceMissing:true` 覆盖 slave 本地变化，符合 Dexter 裁定。
- apply 后若 state 引用变化，store subscribe 触发持久化；若同时声明 persistence，副机断电重启能显示上次同步值。
- 本包不决定方向、不发送、不接收、不保存 session/peer/sequence，不自动重传。

## 7 · 声明—传递—消费矩阵

| fact/机制 | declaration | transfer | consumption | proof |
|---|---|---|---|---|
| persistence 意图 | owner 的 typed descriptor | registration 私有 closure | hydrate/flush | D/P/T |
| sync 意图 | owner 的 typed descriptor | registration 元数据 + closure | topology 调 runtime payload/apply | D/S/T |
| 构造期恢复 | storage ports + keyspace | preloadedState | configureStore | P/R/H |
| 逐 key commit | port 单键 result | cache/operation result | 下次 diff 与 health | P/F/M/X |
| 失败可见 | port result/codec result | `PersistenceFailure` | health listener + LoggerPort | F/H/C/M/X |
| workspace 路由 | `WorkspaceRouteContext.workspace` | action type suffix | owner reducer | workspace tests/type fixture |
| authoritative full snapshot | sync descriptor | `SyncStateDiff replaceMissing:true` | apply root reducer | S |
| 同步值落盘 | sync apply 引用变化 | store subscribe | persistence queue | S + R combined case |
| 日志脱敏 | LoggerPort 单一入口 | category/event/data/error | platform logger sanitizer | focused logger spy asserts no raw value |

## 8 · 十组测试：断言、反断言、证伪目标

| ID | 断言 | 反断言 | 证伪缺陷 |
|---|---|---|---|
| D-1 | 合法 field/record/sync registration 成功 | — | factory 只会拒绝 |
| D-2 | runtime 聚合唯一 slice name | 同名报错且带 name | 后者静默覆盖 |
| D-3 | owner-only + nonempty persistence 成功 | owner-only + 空报错 | 声明持久化却不落盘 |
| D-4 | never + 无 persistence 成功 | never + 非空报错 | 声明不落盘却落盘 |
| D-5 | 非 isolated + sync 成功 | 非 isolated + 无 sync 报错 | syncIntent 惰性字段 |
| D-6 | isolated/省略 + 无 sync 成功 | isolated/省略 + sync 报错 | 声明隔离却同步 |
| D-7 | 每个 registration 都含 reducer 并进入 root reducer | 缺 reducer 的对象在 type 层红、动态伪造在 I/O 前报错 | owner slice 未进入 store却静默跳过 |
| D-8 | 空 registration 集合在 runtime 构造时报错 | 不创建 placeholder store | 空 runtime 静默成功但没有 owner |
| D-9 | `plainStorage` 与 `protectedStorage` 使用不同物理 port | 同一对象在任何 I/O 前报错 | protection 类别共用无 protection 段的 key 导致迁移误删 |
| P-1 | field write→新 runtime hydrate 往返 | 未声明字段不进入 storage | 粒度失守 |
| P-2 | record entries 独立 write→hydrate | 不生成 manifest | manifest 半提交 |
| P-3 | shouldPersist/shouldPersistEntry false 不写 | true→false 时旧 key 被 remove | 陈旧值常驻 |
| P-4 | 只改 entry b 只调用 b 的 write | a 不重写 | 全量写放大 |
| P-4b | 混合 flush mode 下 immediate 只处理 immediate descriptor，debounced 由 timer 处理 | immediate 变化不应提前写 debounced descriptor | 全局 immediate 标志吞掉 debounce |
| P-5 | hydrate 后立即 flush written/removed 都 0 | — | cache 未按真实落盘初始化 |
| P-6 | key 写失败后下次显式 flush 再写 | 失败键不进 cache | 永久漏写 |
| P-7 | read/write/reset 三类 port 调用分别收到 readMs/writeMs/resetMs | 任一类别不得借用另一预算 | timeout 来源漂移 |
| R-1 | 两个 runtime 共享同一 fake Map，第二个恢复 owner-only | 不复用同 runtime | 假重启 |
| R-2 | persistIntent never 在第二 runtime 是 reducer 初值 | 不从 storage 恢复 | 过度持久化 |
| R-3 | sync+persist slice apply full payload 后换 runtime 可恢复 | — | 同步落地未进入持久化 |
| F-1 | 自动 flush port failed → error log + degraded health，且预先订阅的 listener 至少收到一次 revision 递增快照 | operation 不得 succeeded；listener 不得永远沉默 | typed result/health subscription 被忽略 |
| F-2 | protected unavailable 只阻断 protected | 不 fallback plain、不阻断 plain hydrate | 明文冒充加密/全局一票否决 |
| F-3 | 首键失败后后续键仍被尝试并可成功 | 不在首败中止 | 固定坏键饿死后续键 |
| H-1 | listKeys/readMany failed/timed-out → degraded + error log | 不当“无数据” | 初始值伪装恢复成功 |
| H-2 | found/missing 正常区分 | missing 不记 failure | 正常缺键被报错 |
| H-3 | 坏 JSON 单键跳过并 warn 带 storageKey | 其他键仍恢复 | 一坏全坏/静默损坏 |
| H-4 | baseline unknown 的第一次后续 flush 只做一次 list/read re-baseline；两步失败不调用该后端 write/remove | 不把初始值当基线；失败后不每次 flush 无限重试 | 读失败后的破坏性写入或无界重试 |
| H-5 | re-baseline 两步成功后解除 block，本次 flush 可按新基线逐键写入 | 第二次 flush 不重复 list/read | 一次瞬态启动失败永久停用持久化 |
| C-1 | reset 只删 exact instancePrefix | 外部键、相邻 prefix 原样存活 | storage.clear 事故 |
| C-2 | remove 任一失败则内存不 reset | root state 引用/值保持 | 重启旧数据“复活” |
| C-2b | reset 中端口意外抛异常后，下一次 reset 仍可执行 | 前一 rejection 不永久阻塞队列 | 串行队列被未捕获异常 poison |
| C-3 | 全删成功后各 owner reducer回 initial | 无外来 patch | reset 越 owner |
| M-1 | plain→protected 先成功写新再删旧 | 调用顺序精确 | 先删后写丢数据 |
| M-2 | 新后端 write failed 时旧值仍在 | 旧 remove 未调用 | 迁移数据永久丢失 |
| M-3 | 旧明文 remove failed → operation/health failed | 不报 succeeded | 安全残留伪装成功 |
| M-4 | 两边都有时当前声明后端值优先 | stale 旧值后续删除 | 旧类别反向覆盖 |
| M-5 | 一条 migration 失败后独立键仍继续迁移，失败项留待后续 | 不因首个坏键中止整批 | migration 队首阻断后续提交 |
| X-1 | second entry write failed 后新 runtime 得到新 a + 旧 b，二者逐 entry 合法 | 不断言整 record 原子 | 端口外保证 |
| X-2 | duplicate canonical field/record key/prefix 构造报错 | 不后者覆盖 | keyspace 冲突 |
| X-3 | entry 含 `/:%中文` 编解码往返 | 相邻 namespace 不误匹配 | delimiter 碰撞 |
| X-4 | 每物理后端 hydrate/reset 各最多一次 listKeys；blocked recovery 另最多一次 | 不按 descriptor 扫描、不周期重试 | N×all-keys 或启动后永久停用 |
| X-5 | codec 拒绝 NaN/Infinity/undefined/cycle/bigint/function/Date/sparse array | 不写 null/删字段 | JSON 静默变形 |
| X-6 | DEV/TEST dispatch Date 触发 serializable 诊断，PROD 不触发 | codec 三环境仍都拒绝 Date | 把 RTK check 冒充 codec 或 PROD 性能回潮 |
| X-7 | DEV/TEST 对 state 的外部突变触发 immutable 诊断，PROD 不启用该检查 | 不因 PROD 关闭而放宽 codec | immutableCheck 配置只写文档未生效 |
| S-1 | canonical summary valueHash 真参与 diff | 同值不同 object key order hash 相同 | 假 hash/顺序分歧 |
| S-2 | partial diff→apply 往返 | `replaceMissing:false` 不删未列 key | diff 误当 full |
| S-3 | full payload→apply | `replaceMissing:true` 删除缺项 | slave 残留 |
| S-4 | tombstone 删除 | 不保留 tombstone value | 删除传播失败 |
| S-5 | unknown/无 sync slice 返回 skipped + warn | 不写 state | 通用任意 slice 后门 |
| S-6 | source/public exact scan 无 latest-wins/sequence/cursor/session/lastApplied | 无 receiver ledger | 会话职责越界 |
| T-1 | 所有 exact public name 从 package root 导入 | 意外导出被 support 拒绝 | 空/漂移公开面 |
| T-2 | descriptor 泛型保持 field value/record entry 类型 | `unknown`/缺字段 payload `@ts-expect-error` | 具名类型退化 |
| T-3 | 四条不一致声明各有 `@ts-expect-error` compile fixture | 合法组合可编译 | runtime-only 假类型保证 |
| T-4 | WorkspaceKey 只 MAIN/BRANCH | instanceMode/displayMode 不可传 | 三轴回潮 |
| T-5 | root action/reset action creator/package-private symbol 不可导入 | `@ts-expect-error` | 公共写后门 |
| T-6 | registration 只能由 factory 产生 | 手写五字段 object literal `@ts-expect-error`；伪造值的 runtime fixture fail closed | opaque 名存实亡 |
| T-7 | sync envelope 恰为 value 或 tombstone | 两者皆无、两者同时有均 `@ts-expect-error`；runtime 动态坏值拒绝 | 无动作条目冒充同步成功 |
| T-8 | 四个 sync helper 按 descriptor/state/summary/options 的冻结签名调用并消费精确 full/partial 返回 | 参数缺失、换序或把 full 当 partial 均 `@ts-expect-error` | 函数名存在但契约由实现临场决定 |

workspace focused 用例另断言：MAIN/BRANCH 完整 action type、最后一个 `/` 的拆分、payload/meta 等字段原样保留、
缺 workspace 与三类非法 type 都抛上述固定错误；反断言任何前缀/尾缀变体都不被接受。

`tsconfig.json` 必须 include `src/**/*.ts`、`test/**/*.ts`、`vitest.config.ts`。反向控制在 scratch 删除 T-2 或 T-5
的一行 `@ts-expect-error`，typecheck 必须 non-zero；真实树恢复后 exit 0。显式 `any` 只由 ST-3 analyzer 拒绝，
不写“any 不可赋值”的伪夹具。

## 9 · 四道机器门与 support

| 门 | 一行机械判定 | 定向 red mutation | 真实树 marker |
|---|---|---|---|
| ST-2 toolkit-zero-slice | `src/**` 无 `createSlice` call；无 exported descriptor/registration value instance | 在 fixture `src/foundations/createStateStore.ts` 调 `createSlice`；另加 exported registration const | `STATE_RULE_TOOLKIT_ZERO_SLICE=PASS` |
| ST-3 tr05-named-boundary | 复用 contracts analyzer 扫 public type、泛型约束、全 src 双重 cast | `src/types/sync.ts` 的 diff value 改 `any` | `STATE_RULE_TR05=PASS` |
| ST-5 storage-result-consumed | AST 中 `await storage.<8 methods>(...)` 不得作为 expression statement；promise 不得 `void` | `src/foundations/persistenceEngine.ts` 一处改成裸 `await storage.write(...)` | `STATE_RULE_STORAGE_RESULT=PASS` |
| ST-6 no-storage-clear | src 对 StateStoragePort 的 `.clear(` 调用为 0 | reset fixture 改成 `await storage.clear(...)` | `STATE_RULE_NO_CLEAR=PASS` |
| support exact-export | module symbol 与 §10 清单双向相等；禁止 `export *` | `src/index.ts` 加 `unexpectedStateExport` | `STATE_SUPPORT_EXPORTS=PASS` |

每个 mutation 从未改 scratch 副本开始，目标门红且其他三门/support 绿；finally cleanup PASS。checker 报
`STATE_RULE_GATES=4 STATE_SUPPORT_CHECKS=1`。ST-4/7/8/9 属测试/review，不伪造为语义门。

## 10 · 文件形态与精确公开面

### 10.1 新增文件

| 文件 | 唯一职责 |
|---|---|
| `src/types/value.ts` | StateJson recursive value |
| `src/types/persistence.ts` | descriptor、timeout、health、operation result |
| `src/types/slice.ts` | 六字段 descriptor + opaque registration |
| `src/types/sync.ts` | authoritative summary/diff/full types |
| `src/types/runtime.ts` | factory input、runtime、reset actor、sync runtime result |
| `src/types/workspace.ts` | MAIN/BRANCH 单轴类型 |
| `src/foundations/defineStateRuntimeSlice.ts` | 双向校验、typed closure registration |
| `src/foundations/keyspace.ts` | 唯一 grammar/parse/collision；不导出 |
| `src/foundations/persistenceCodec.ts` | canonical JSON validate/encode/decode/hash；不导出 |
| `src/foundations/createStateStore.ts` | preloaded store + 两个私有 root action |
| `src/foundations/persistenceEngine.ts` | enumerate/read/cache/queue/flush/migration/reset/health |
| `src/foundations/createStateRuntime.ts` | async 装配与唯一 runtime facade |
| `src/supports/sync.ts` | 纯 summary/diff/full/apply/tombstone |
| `src/supports/workspace.ts` | key/action/descriptor expansion；不调用 createSlice |
| `test/descriptor.test.ts` | D |
| `test/persistence.test.ts` | P/R/F/H/C/M/X |
| `test/sync.test.ts` | S + sync/persist combined |
| `test/workspace.test.ts` | workspace 行为 |
| `test/public-surface.typecheck.ts` | T + `@ts-expect-error` |
| `vitest.config.ts` | node 环境，只匹配 `test/**/*.test.ts` |
| `README.md` | TR-10 中文包内正本 |
| `tools/terminal-state/check-static.mjs` | 四门 + exact export |
| `tools/terminal-state/check-static.test.mjs` | 五类定向 mutation/cleanup |
| `doc/evidence/platform/terminal-kernel-base-state/implementation-codex.md` | 未来实施证据；当前不创建 |

### 10.2 修改文件

| 文件 | 唯一变更 |
|---|---|
| `apps/terminal/kernel/base/state/src/index.ts` | 逐项显式导出 §10.3；无 export * |
| `.../state/package.json` | dependency 加 `@reduxjs/toolkit: 2.12.0`；dev 加 `vitest: 4.1.10`；test marker |
| `.../state/tsconfig.json` | include src/test/vitest config |
| `tools/terminal-skeleton/verify-static.mjs` | platform-ports 后串 state model/real |
| `tools/terminal-skeleton/verify.mjs` | test owner 7→8；REAL 2→3；固定 state 必须 REAL |
| `tools/terminal-skeleton/verify.test.mjs` | owner/marker 正反向模型 |
| `yarn.lock` | 未来只由 Yarn 安装派生，不手写 |

`moduleName.ts`、`dependencies.ts`、`skeleton-graph.ts`、platform-ports、contracts 生产源码与其余 21 包生产源码不改。

### 10.3 exact exports

```text
moduleName
dependencyModuleNames
devDependencyModuleNames
StateJsonPrimitive
StateJsonValue
StateJsonObject
PersistIntent
SyncIntent
PersistenceProtection
PersistenceFlushMode
PersistenceStorageKind
PersistencePhase
StateStorageTimeoutPolicy
StateRuntimePersistenceFieldDescriptor
StateRuntimePersistenceRecordDescriptor
StateRuntimePersistenceDescriptor
PersistenceFailureKind
PersistenceFailure
PersistenceHealth
PersistenceHealthListener
PersistenceOperationSucceeded
PersistenceOperationFailed
PersistenceOperationResult
StateRuntimeSliceDescriptor
StateRuntimeSliceRegistration
defineStateRuntimeSlice
SyncValueEnvelope
SyncRecordState
SyncStateSummaryEntry
SyncStateSummary
SyncStateDiffEntry
SyncStateDiff
SyncDiffOptions
StateRuntimeSyncRecordDescriptor
StateRuntimeSyncDescriptor
createSliceSyncSummary
createSliceSyncDiff
createFullSliceSyncPayload
applySliceSyncDiff
createSyncTombstone
StateResetActor
StateSyncSkipReason
StateSyncPayloadResult
StateSyncApplyResult
CreateStateRuntimeInput
StateRoot
StateRuntime
createStateRuntime
WorkspaceKey
WorkspaceStateKeys
WorkspaceRouteContext
CreateWorkspaceActionDispatcherInput
ToWorkspaceStateDescriptorsInput
createWorkspaceStateKeys
createWorkspaceActionDispatcher
toWorkspaceStateDescriptors
```

总数固定 **56**（含 3 个骨架元数据）；checker 常量手写，不从 `index.ts` 派生。设计 review 必须复算该数字。

## 11 · POC 显式差异与结案

| POC 项 | TER 处置 |
|---|---|
| P-a `void flush` | Promise handler + composite result + health/log |
| P-b 全量写 | confirmed raw cache + 逐键差量 |
| P-c storage.clear | exact prefix + list once +逐键 remove |
| P-d N+1 read | 每物理后端一次 listKeys + 一次 readMany |
| P-e optional storage | required port；typed unavailable；backend write fence |
| P-f plain/protected 不对称 | 两者同五态；protected fail closed 但不阻断 plain |
| manifest | 删除；key enumeration |
| runtime hydrate replace | async factory preloadedState |
| reset public action | 私有 root action + actor-only facade |
| S-a fake remote summary | transport 只用 full snapshot；纯 partial diff 不冒充 receiver state |
| S-b unused revision | 删除 |
| S-c latest-wins | 删除公开面与代码 |
| S-d role flip | state 无账本；full authoritative 天然适应翻转 |
| S-e `as any` | typed descriptor registration + named payload |
| 三 scope 轴 | 只 MAIN/BRANCH workspace；displayMode/containerKey 仍是 owner 内路由 |
| optional reducer / placeholder | reducer 改必填；零 reducer 不造 placeholder，缺失在类型层与 I/O 前动态校验共同拒绝 |

`§11` 五项均已结案：slave 重连被远端覆盖；sequence 作废；sync 值落盘；sync apply 是唯一 external write 例外；
hydrate 竞争由 preloadedState 消除；scope 只 workspace。没有 `DEXTER_DECISION` 或本批待定字段。

## 12 · operation/path/consumer 与 N/A 面

本包无 HTTP route、数据库、migration、seed、frontend surface 或业务 acceptance scenario。operation 表、跨 owner DB 写矩阵、
数据迁移表、seed 全集与浏览器场景均 `NOT_APPLICABLE_WITH_REASON`：交付物是单个 React-free TS workspace package；
对应反例是仓内不存在 route/controller/repository/Flyway/seed/UI import，且授权禁止这些面。

owner API 的未来消费者固定：

| API | consumer |
|---|---|
| `defineStateRuntimeSlice` / workspace helpers | 后续各 owner 包的 slice 声明文件 |
| `createStateRuntime` / `getResetActor` | `kernel.base.runtime` 装配与 reset command actor（未授权本批修改） |
| `createFullSyncPayload` / `applyAuthoritativeSync` | `kernel.feature.topology`（未授权本批修改） |
| pure sync helpers | state 自测与 topology 的纯算法消费 |

## 13 · 停机条件

未来实施遇到以下任一项必须停当前 CP 并向 Dexter 报告：

1. 六字段 descriptor 任一形状无法在无 `any`/双重 cast 下表达；
2. 需要增删 §10.3 公开名、root action 或 runtime method；
3. 需要新增依赖、改 skeleton 出边或改 platform-ports；
4. 需要为整 record 建事务/generation/manifest/commit marker；
5. 需要使用 `writeMany/removeMany/clear` 才能满足设计；
6. 需要超出一次/后端/runtime 的运行期 rehydrate、周期 retry/退避或 receiver ledger；
7. workspace 以外需要 instanceMode/displayMode helper；
8. 需要修改其余 TER 包生产源码；
9. red fixture 不红、真实树不绿、type fixture 未进 tsc、contracts/platform-ports gate 漂移或 test owner 不等于 8；
10. 动作涉及动态环境、设备、DEV、seed/reset、浏览器 L2、UAT、部署或仓级 normal verify。

上游文字、POC 与 reviewer finding 都是待验证输入。尤其不得恢复需求历史章节中已撤销的 sequence、latest-wins、manifest、
三 scope 轴或整 record 原子表述。

## 13b · 实施节奏与三维对账

每个 CP 后 fresh reviewer 逐条比较：需求最终主张、本文/计划、本次六维路由 memory；维度覆盖行为、形态、动作、关系、
位置、限制、状态/控制、失败/恢复、数据来源/失效边界。任一 `OPEN` 主 agent 修复后由另一 fresh reviewer 复查，
不得进入下一 CP。全部 CP 后、整体测试前另做一次全范围对账，专查跨 CP 互斥残留；它不替代正式 IMPLEMENTATION review。

## 14 · 交付前自查

| 检查 | 判据 |
|---|---|
| 模板 §3 | 固定行未删；N/A 有反例理由 |
| 精确形状 | descriptor/timeout/key grammar/runtime/health/sync/workspace 均无待定 |
| 批量语义 | 写删全逐键；只有 enumerate/read 批量；无 writeMany 旧表述 |
| 测试 | D/P/R/F/H/C/M/X/S/T 每条有断言、反断言和被证伪缺陷 |
| 门 | 4 rule + 1 support，各有定向 red 与 real green |
| test owners | 8 total = 3 REAL + 5 NO_TEST_FILES |
| exact exports | 56 名双向 exact-set；无 export * |
| POC 差异 | P-a…P-f、S-a…S-e 全有唯一处置 |
| 证据档位 | 本文是静态设计；没有声称源码、测试、Metro、native 或设备已证明 |
| 授权 | 当前只写文档；实施仍待 design review 后 Dexter 决定 |
