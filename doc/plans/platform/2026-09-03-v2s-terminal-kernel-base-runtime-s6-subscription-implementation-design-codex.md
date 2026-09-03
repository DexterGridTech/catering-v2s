SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0

# V2S TER `kernel.base.runtime` S-6 只读订阅详设（Codex）

## 0 · 元数据与授权边界

| 字段 | 值 |
|---|---|
| PROGRAM_ID | `V2S_W0_W4_EXECUTION` |
| REVIEW_TARGET | `IMPLEMENTATION` |
| DESIGN_UNIT | `S6_RUNTIME_READONLY_SUBSCRIPTION` |
| REQUIREMENTS | `doc/plans/platform/2026-09-02-v2s-terminal-ui-base-render-requirements-claude.md` §4.0a、§4.0b |
| RUNTIME_REQUIREMENTS | `doc/plans/platform/2026-09-01-v2s-terminal-kernel-base-runtime-requirements-claude.md` §4.5、§4.5b |
| CURRENT_INPUT_HASHES | render `28c3818e…`; runtime `c36c699e…`; TER standard `4c9ce680…` |
| STATUS | `IMPLEMENTATION_AUTHORIZED` |
| IMPLEMENTATION_AUTHORITY | `true`（Dexter 本轮直接授权） |
| AUTHORIZED | S-6 详设、runtime 实现、类型与根导出、invariants、runtime 测试、production mutation harness、README/详设/计划同步及自验收 |
| NOT_AUTHORIZED | render 详设/实施、S-7、其它 kernel 包、Runtime stop/dispose、DEV、seed、reset、L2、UAT、部署、Git |
| IA / INTERACTION | `NOT_APPLICABLE_WITH_REASON`：纯 kernel 读侧同步接缝，无 UI screen、Journey 或焦点行为 |

本设计以当前源码为准；用户提供的行号只用于定位，实施锚点使用唯一符号/文本，不依赖行号。

## 1 · 真实问题、当前事实与完成定义

### 1.1 这批真正要解决的问题

render 的 `useSyncExternalStore` 需要一个同时覆盖 Redux 状态变更和 Runtime 生命周期变更的单一、窄、只读订阅源。当前 facade 只有 `status`、`getState`、`getStore`，其中 `getState` 在非 `started` 时抛错，`getStore` 又把 `dispatch` 暴露给消费侧；现有 `createStateSubscription` 只包 store，不会通知 `created/starting/started/failed` 转变。结果是 Provider 无法安全地在 start 前挂载，也无法由 `failed` 或 `started` 转变驱动重渲染。

如果不做 S-6，消费侧只能把完整 Redux store 带入 UI，或另造 status 轮询/回调体系；前者违反读写边界，后者无法保证 `useSyncExternalStore` 的同步一致性并会形成第二个生命周期事实源。

### 1.2 已亲验的可复用能力与不变事实

| 事实 | 当前正本 |
|---|---|
| Runtime status 的唯一赋值点 | `apps/terminal/kernel/base/runtime/src/application/createRuntime.ts` 的 `start`；`created → starting`、`starting → started`、`starting → failed` |
| facade 快照门 | 同文件的 `getState`：非 `started` 或无 `stateRuntime` 时抛 `lifecycle_failed`/未启动错误；本批保持不变 |
| store 订阅与幂等退订 | `apps/terminal/kernel/base/runtime/src/foundations/createStateSubscription.ts#createStateSubscription` |
| 测试资源释放 | `apps/terminal/kernel/base/runtime/src/foundations/createRuntimeResourceRegistry.ts#createRuntimeResourceRegistry` 与 `src/testing/releaseRuntimeForTest.ts` |
| 无生产停机出口 | `Runtime` 与 `RuntimeModule` 没有 `stop`/`dispose`；已在 `README.md` 与 runtime requirements 记录 |
| 当前根级 exact export | `src/index.ts` 与 `terminal-invariants.json` 的 `publicExports`，S-6 落地后当前 64 项 |

### 1.3 完成定义

1. `Runtime.subscribe(listener)` 是唯一新增运行时方法；listener 没有 payload、store、dispatch 或 status 参数。
2. 订阅在所有非 failed 阶段可建立；订阅本身不回调。它同步观察 status 转变与 state store dispatch。
3. `starting → started` 的状态先写入、后回调；回调中 `runtime.status === 'started'` 且 `getState()` 可用。`starting → failed` 先写入 `failure` 与 `failed`、再发最终回调；之后不再通知。
4. 退订幂等；显式退订和 `releaseRuntimeForTest` 都使后续 state dispatch 不再触发该 listener。失败终态会在最终 failed 通知之后关闭 facade 订阅。
5. `getState`、`getStore`、`status`、`failure`、启动顺序与既有资源释放语义不变；不新增生产停机 API。
6. `RuntimeSubscriptionListener` 作为第 64 个根级导出类型加入 `src/index.ts` 与 invariant；不新增其它 named export。
7. runtime typecheck、既有测试、S-6 focused tests、runtime static/model、五个 production mutation 的 red/green 以及 sandbox cleanup 全部有新鲜输出。

## 2 · 方案比较与选型

| 方案 | 结果 | 结论 |
|---|---|---|
| A：直接公开 `getStore()`，render 自己调用 `store.subscribe` | 最短，但消费侧获得 `dispatch`，违反窄只读接缝；无法把 Runtime status 转变纳入同一通知源 | 拒绝 |
| B：分别公开 `subscribeState` 与 `subscribeStatus` | 能覆盖两类变化，但 `useSyncExternalStore` 需要一个 subscribe；消费侧要合并两个生命周期，容易产生重复回调、退订不一致和顺序漂移 | 拒绝 |
| C：Runtime 内部 listener registry，state 侧复用 `createStateSubscription`，status 侧同步 fan-out；对外只暴露 `subscribe` 与一个 listener 类型 | 一个接缝闭合两类变化；store 只在 runtime 内部取得；失败与 test resource cleanup 可在一个记录模型中定义 | **采用** |
| D：导出独立 `subscribeRuntime(runtime, listener)` helper | 会把 Runtime 实例与生命周期逻辑散到公共函数，且不能自然表达“Runtime 上的方法”；额外扩大根级公共面 | 拒绝 |

我选了 C 而不是 A/B/D，因为它用现有 store subscription 机制承载状态变化，把生命周期状态留在唯一的 `createRuntime` owner 内，同时让消费侧只拿到一个无写能力的 callback 接缝。

## 3 · 公共契约与七条运行语义

### 3.1 精确公共面

在 `src/types/runtime.ts` 增加：

```ts
export type RuntimeSubscriptionListener = () => void
```

在 `Runtime` interface 增加：

```ts
subscribe(listener: RuntimeSubscriptionListener): () => void
```

`src/index.ts` 只把 `RuntimeSubscriptionListener` 加入现有 `types/runtime` 的具名 type export；`subscribe` 是 `Runtime` 的成员，不单独成为根级 named export。`terminal-invariants.json.publicExports` 只新增这一项，预期精确 64；不导出 listener registry、状态 transition、store subscription helper、测试接缝或任意 `dispatch` 访问器。

Runtime 仍以已有 `readonly status` 供消费侧适配 `getStatus`；本批不新增 `getStatus()` 方法。`getState()` 仍抛错，消费侧必须先读 status 再决定是否调用。

### 3.2 七条确定语义

| # | 契约答案 | 可证伪观察 |
|---|---|---|
| 1 未 start 时订阅 | `created`/`starting` 均允许；订阅不立即回调。`created → starting` 在 `start()` 调用中同步通知；state runtime 建成后该 listener 开始接收 store 通知 | 先订阅再 `start`，第一条观察到的 status 是 `starting`；订阅瞬间计数仍为 0 |
| 2 进入 failed 后 | `failure` 与 `status='failed'` 先写入，所有活跃 facade listener 同步收到**一次最终 failed 通知**；通知结束后 facade subscription 全部关闭，后续不再收到 status 或 state 通知；failed 后新订阅返回幂等 no-op | failed listener 读取到 `failure`；重复 `start()`、任何可观察的后续 state attempt 都不增加计数；failed 后 subscribe 不回放 |
| 3 通知时机 | 同步：status 赋值后立即 fan-out；state 复用 Redux `store.subscribe` 的同步语义。不开批处理、微任务或 timer 合并 | listener 在 actor 的 `dispatchAction` 返回前被观察到；status listener 看到已写入的新 status |
| 4 退订幂等 | 同一返回函数第一次执行移除记录并取消底层 store fan-out，第二次及以后安全 no-op | 退订一次、二次后再发一个真实 runtime command，回调计数不变；mutation 改坏记录移除必须红 |
| 5 生命周期结束后的残留 | `started` 没有生产 stop/dispose，因此正常运行的 facade subscription 由调用方退订，或由已有 test resource registry 在 `releaseRuntimeForTest` 中释放；`failed` 是本次可达终态，按第 2 条自动结束 facade 订阅。不得借此新增生产 shutdown | started 后 test release 使订阅失效；failed 后最终回调之后无残留回调 |
| 6 可观察 oracle | 不检查私有 Set/计数；通过 listener 计数与 callback 内读取 `runtime.status`/`getState`，在退订或 release 后执行真实 command/state dispatch，断言计数不变 | `runtimeSubscription.test.ts` 的退订、release、failed 后 late-subscribe 场景；`check-behavior.mjs` 只修改 production 实现并期待各自 focused test 失败 |
| 7 snapshot 可用性与生命周期 | S-6 不修改 snapshot。`getState()` 在非 started/failed 仍抛；started 通知发生在 status 已变更且 stateRuntime 已完成 initialize 之后。无 dispatch 时 Redux root 引用由现有 `StateRuntime.getState` 保持稳定；本批不复制/缓存 root | 既有 lifecycle L-2 保持抛错；started callback 成功读取同一 root；render 的 status-first 门控仍是消费侧责任 |

### 3.3 通知顺序

| 事件 | 内部顺序 | listener 可观察事实 |
|---|---|---|
| `start()` | `status='starting'` → 同步通知 → 异步 preSetup/state runtime/install/initialize | callback 看到 `starting`，不能调用 `getState()` |
| 成功启动 | initialize 完成 → `status='started'` → 同步通知 | callback 看到 `started`，`getState()` 可用 |
| 启动失败 | `failure` 写入 → `status='failed'` → 解除 state fan-out → 同步最终通知 → 关闭 facade subscriptions | callback 看到 `failed` 与非空 failure；最终通知之后不再回调 |
| started 状态 dispatch | Redux reducer/store 完成 → Redux 同步 listener fan-out | callback 在 dispatch action 的同步调用栈内可观察到新 root |

## 4 · 实施形态与责任边界

### 4.1 Runtime 内部 registry

`createRuntime.ts` 继续是 status 唯一 owner，并在现有 `resources` 之后维护一组 subscription records。每条 record 至少含 `listener` 与 `active`，并保存从 resource registry 注销的函数。用 record 而不是 listener 本身作为集合成员，保证同一个函数可被独立订阅两次、各自退订。

内部形态：

```text
Runtime.subscribe(listener)
  -> record 加入 Set
  -> resources.register(record removal)
  -> 若 stateRuntime 已存在，确保一个共享 createStateSubscription(store, notifyAll)
  -> 返回幂等 removal

stateRuntime 建成后
  -> 若有 pending records，建立共享 store subscription

status transition
  -> 先更新 status/failure
  -> 同步 notifyAll

failed final notification 后
  -> 取消共享 store subscription
  -> 移除/注销所有 facade records
```

状态变化采用一条共享的 `createStateSubscription(stateRuntime.getStore(), notifyAll)`，不是每个 listener 各自对 store 建订阅；这样所有 listener 的退订都走同一 fan-out，且复用既有幂等 store unsubscribe。资源注册使用既有 `resources.register`，使 `releaseRuntimeForTest` 可释放 facade subscription；不修改 module/actor `subscribeState`。

通知逐条读取 record 的 `active`，对快照数组同步迭代。listener 异常只记录固定安全消息的
`runtime.subscription.listener-failed` 错误并继续通知其它 listener；不记录回调抛出的原始
error message，避免把消费侧内容带入日志。异常不能改变 Runtime status 或把一次 UI 回调错误
变成启动失败。该处理与 `createRuntimeJournal` 的 observer isolation 形态一致，但不复用 journal
的事件类型。

### 4.2 不触碰的边界

- 不删除、不收窄 `getStore()`；它是当前已有 Runtime 公共契约，本批只保证 render 不需要它。
- 不改变 `getState()`/`getStore()` 的非 started 抛错，也不把 status gate 移到 state 包。
- 不改 `createStateSubscription` 的 public/private 位置、module context、actor context 或资源释放时机。
- 不新增 `stop`、`dispose`、`destroy`、`shutdown` 或生产 drain。
- 不把 subscription 当业务事件总线；listener 没有 event payload，也不得持有 `dispatchAction`。TR-11 的事件→command→actor 规则不被本读侧 invalidation 接缝绕过。
- 不修改 render、ui-state、state、display-context 或其它 kernel 包。

## 5 · 文件与唯一锚点

| 文件 | 变更 | 唯一责任 |
|---|---|---|
| `apps/terminal/kernel/base/runtime/src/types/runtime.ts` | 新增 `RuntimeSubscriptionListener`；给 `Runtime` 增加 `subscribe` | 公共 type/interface contract |
| `apps/terminal/kernel/base/runtime/src/index.ts` | 具名导出 `RuntimeSubscriptionListener` | 根级 exact public surface |
| `apps/terminal/kernel/base/runtime/src/application/createRuntime.ts` | registry、共享 state subscription、status notification、failed closure；保留现有 facade methods | Runtime 实现 owner |
| `apps/terminal/kernel/base/runtime/terminal-invariants.json` | `publicExports` 增加唯一新 type | exact-set static support |
| `apps/terminal/kernel/base/runtime/test/runtimeSubscription.test.ts` | S-6 七语义 focused proof | Runtime behavior oracle |
| `apps/terminal/kernel/base/runtime/test/public-surface.typecheck.ts` | 引用新公共 type，并验证 Runtime subscribe 形态 | type closure |
| `tools/terminal-runtime/check-behavior.mjs` | baseline + unsubscribe、pre-start notify、state attach、failed close、failed-subscribe 五个 production mutations | production red vectors |
| `apps/terminal/kernel/base/runtime/README.md` | 写明 facade subscribe、通知顺序、failed/stop 边界与使用约束 | TR-10 package contract |
| 本详设/实施计划 | 当前设计、步骤、证据入口 | durable handoff |

新增文件不进入任何 `src/testing` 或 package root public runtime export，命名按 capability 而不是流程/Journey。

## 6 · 测试与 production red vector

### 6.1 focused scenarios

`runtimeSubscription.test.ts` 包含以下六个可独立失败的 runtime 行为场景；第七项只读形状由
`public-surface.typecheck.ts` 的公共类型闭包单独证明：

1. **before-start and started order**：created 时订阅不回调；调用 start 立即观察 `starting`；成功后观察 `started`，且 started callback 能读 `getState()`。
2. **state notification is synchronous**：actor 内将 `inActionDispatch` 设为 true，`dispatchAction` 触发 facade listener，listener 在该同步区间内被观察到；command 完成后恢复 false。
3. **failed final notification**：install 抛错；listener 顺序为 `starting`, `failed`，failed callback 看到 non-null failure；失败后重复 start 不再增加通知。
4. **idempotent unsubscribe oracle**：真实 command 改 state 后产生通知；执行退订两次，再发同一 command，计数保持不变。
5. **test resource release oracle**：started 后订阅，先确认一次真实通知，再调用 `releaseRuntimeForTest`，再次 command 不通知；新订阅仍可在 started runtime 上建立。
6. **snapshot contract remains**：复用已有 L-2 的非 started/failed 抛错断言，并在 started callback 读取 root；没有 dispatch 时两次 `getState()` 为同一引用。
7. **read-only shape**（public-surface typecheck）：返回值为 function，listener 无参数；公共 typecheck 只接受 `() => void` 与 `() => () => void`，不存在 `dispatch` 能力参数。

失败场景把两个 release oracle 分开：failed 最终通知后立即调用 `releaseRuntimeForTest(runtime)`，返回 `0`
证明失败路径已经关闭既有 facade subscriptions；随后再调用 `runtime.subscribe`，再次 release 仍返回 `0`
证明 failed 守卫拒绝 late subscription。这样 `RED_FAILED_CLOSE` 与 `RED_FAILED_SUBSCRIBE` 分别在不同断点
变红；oracle 不依赖私有集合，也不把“重复 start 不再通知”误当成 `closeRuntimeSubscriptions` 的证明。

测试中使用 `runtime.dispatchCommand` 与 actor `context.dispatchAction` 产生真实状态变化；不得为了证明订阅而从测试私自新增 runtime/store 旁路。

### 6.2 production mutation

`tools/terminal-runtime/check-behavior.mjs` 在临时复制的 runtime package 中执行。每个 mutation 都保持
同一份测试夹具和 focused test，只改 sandbox 中的 production `createRuntime.ts`，并要求 mutation 后退出非零：

1. baseline：`runtimeSubscription.test.ts` 的六个 S-6 focused 场景必须 PASS；
2. `RED_UNSUBSCRIBE`：把 `if (!subscription.active) return` 改成错误的 active guard，证明显式退订二次执行后不会再收到真实 command 通知；
3. `RED_PRE_START`：移除 `status = 'starting'` 后的同步 `notifyRuntimeSubscribers()`，证明 pre-start subscription 的 starting 观察丢失；
4. `RED_STATE_ATTACH`：把共享 `createStateSubscription(...)` attach 改成不建立订阅，证明 actor 内真实 dispatch 不再同步通知；
5. `RED_FAILED_CLOSE`：移除失败路径的 `closeRuntimeSubscriptions()`，第一个 failed 后 release oracle 立即变红；
6. `RED_FAILED_SUBSCRIBE`：移除 `status === 'failed'` 的 early-return，第一个 release 仍为零但 late subscribe 后的第二个 release 变红；
7. 每个 sandbox 都在 `finally` 中删除精确临时目录，最后输出 `TERMINAL_RUNTIME_BEHAVIOR_CLEANUP=PASS`。

这些 red vector 全部改 production 实现，不改测试输入、不删测试步骤、不把失败转成静态存在性检查。

## 7 · 横切机制对照表

| 机制 | ① 现成能力/规范 | ② 如何验证 | ③ 无现成时必须符合形态 | ④ 本批适用全集 |
|---|---|---|---|---|
| 读侧节点授权 | `Runtime` facade；`createRuntime.ts` 的 `getState`/`status` | typecheck + focused callback 只能读 status/state，listener 无参数 | 不新增 store/dispatch 输入 | Runtime consumer facade |
| 写授权与 grant 复核 | N/A：本批不授权业务写 | N/A | N/A | 无 |
| 跨 owner 写与事务 | N/A：无后端/跨 owner 写 | N/A | N/A | 无 |
| 集合形态与分页 | `Set<RuntimeSubscriptionRecord>`，生命周期绑定、显式移除 | focused duplicate callback + release 后计数不变 | 不使用无界 request-id Map；每条 record 有退订路径 | Runtime facade subscriptions |
| 缓存失效 / 改完刷新什么 | `createStateSubscription` + Redux store synchronous subscribe | actor dispatch 后 listener 在同一调用栈可见 | 不加 timer/batch；status 与 store 只各有一个事实源 | state dispatch、created/starting/started/failed |
| RTK 数据读取与加载判定 | N/A：runtime 不使用 RTK Query | N/A | N/A | 无 |
| 同一事实只有一个住址 | `createRuntime.ts` status/failure owner；state root 由 state runtime owner | source scan：无第二份 status/root cache | listener 只做 invalidation，不复制 state/status | Runtime status、StateRoot |
| 失败可见且原因不得改写 | `AppError`/existing lifecycle logger；`getState` 抛错不变 | failed callback 读 failure；L-2 保持错误 | 不吞 failed transition，不改原 failure | startup failure、snapshot unavailable |
| owner 错误到 HTTP 的映射与注册处 | N/A：无 HTTP | N/A | N/A | 无 |
| 幂等键构成与重放语义 | N/A：订阅不发业务 command | N/A | listener 不携带或生成幂等键 | 无 |
| 该用生成物的地方不得手搓字符串 | 既有 `moduleName`/lifecycle error/event naming | static/source review | 新诊断使用稳定 capability 名，不生成 command 字符串 | subscription listener failure log |
| 日志落点与脱敏字段 | `platformPorts.logger` scope；`createRuntimeJournal` observer isolation precedent | focused throwing-listener optional check + source review | 只记 status/安全 error message，不记 payload/store | listener failure diagnostic |
| 迁移回填与可逆性 | N/A：进程内 callback contract，无持久化字段 | N/A | N/A | 无 |
| 前端共享行为(Drawer/列表/表单生命周期) | N/A：纯 kernel | N/A | N/A | 无 |
| 候选/下拉数据源 | N/A：无 UI | N/A | N/A | 无 |
| 编码与名称呈现 | `README.md` 中文 TR-10；错误事件 capability name | README/source readback | 文档必须与 Runtime public shape 一致 | runtime README、详设、计划 |
| 会同时坏的东西是否已声明为原子组 | S-6 的 Runtime facade、public type/export、status wiring、tests/red vector | 全包 typecheck/static/test + mutation | source、contract、invariant、proof 同一变更闭合 | S-6 全部变更文件 |

## 8 · 声明—传递—消费矩阵

| fact | declaration | transfer | consumption | proof |
|---|---|---|---|---|
| status transition | `createRuntime.ts` 的唯一 `status`/`failure` owner | `notifyRuntimeSubscribers` 读取已写入闭包状态 | render 后续由 `stateSource.subscribe` 触发重读；本批不改 render | starting/started/failed callback status 断言 |
| state invalidation | state package 的 Redux store `subscribe` | runtime 内部 `createStateSubscription(store, notifyAll)` fan-out | consumer 只拿 `Runtime.subscribe` 返回的 unsubscribe | actor dispatch 同步 oracle |
| snapshot availability | `Runtime.getState` 非 started 抛错、started 返回 StateRoot | Runtime 不复制/缓存 root | consumer status-first gate | existing L-2 + started callback |
| subscription lifecycle | public `RuntimeSubscriptionListener`; internal record active bit | resource registry registers removal; failed closes records | caller calls returned unsubscribe; test calls release seam | idempotent unsubscribe + release count oracle |
| public surface | `types/runtime.ts` + `src/index.ts` type export | invariant exact list | downstream can import listener type without store | 64 exact support + public typecheck |
| failure diagnostic | existing scoped logger | listener exception maps only to safe diagnostic | no consumer-facing business payload | source scan and optional throwing observer proof |

## 9 · 实施前完整同步分母

| 变更事实 | 契约/唯一生成源/生成物 | 后端 owner/edge/migration | 前端 model/surface/state | focused/static/HTTP/L2 | fixture/seed/executor | 结论 |
|---|---|---|---|---|---|---|
| `Runtime` 增加 subscribe + listener type | `src/types/runtime.ts`、`src/index.ts`、`terminal-invariants.json` | N/A | render requirements §4.0a/4.0b 是下游契约，**本批不改** | runtime focused/typecheck/static；无 HTTP/L2 | `runtimeSubscription.test.ts`、behavior harness；无 seed | 同步修改 |
| status notification wiring | `createRuntime.ts` status owner | N/A | render 后续消费；本批不改 | started/failed/order/synchronous proofs | test module fixtures | 同步修改 |
| test release behavior | existing testing seam only | N/A | 无 | lifecycle existing tests + release focused | no seed | 复用并补 focused |
| package contract/documentation | runtime README、S-6 design/plan | N/A | render requirements 保留为 consumer input | static/source readback | N/A | 同步修改 |

## 10 · CP 入口与停机条件

实施由实施计划的一个原子 CP 执行，避免出现只更新 public type、只接 status、或只迁 store listener 的中间态。以下任一情形必须停止并向 Dexter 说明：

- 现有 `createStateSubscription` 无法在不暴露 store 的情况下复用；
- `Runtime` interface 的新增方法不能保持调用方类型闭包，或 public export 需要超过一个新增符号；
- 要改变 `getState`/`getStore` 非 started 抛错、引入 stop/dispose、或修改其它包才能通过 S-6；
- unsubscribe production mutation 无法使 focused proof 变红，说明 oracle 不可证伪；
- listener 异常会改变 lifecycle failure 结果且无法用最小局部形态隔离。

## 11 · 未适用项与证据边界

- 无 HTTP operation、DB、migration、seed、DEV、L2、UAT、部署或业务 acceptance；对应 template 行明确 `N/A`。
- 本批能证明的是 runtime package 的静态、类型、Vitest 行为与 sandbox production mutation。不能升级为 native、设备、Hermes、React `useSyncExternalStore` 真实渲染或 render 包证明。
- S-6 完成不自动授权 render 详设/实施；render 仍须等待本批交付经 Dexter/Claude review 后的第三层授权。
