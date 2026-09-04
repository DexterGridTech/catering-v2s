# `kernel.base.runtime` · 终端运行时骨架

| 字段 | 值 |
|---|---|
| npm 名 | `@catering-v2s/kernel-base-runtime` |
| moduleName | `kernel.base.runtime` |
| 层 | `kernel/base` |
| kind | `owner`：拥有本包的 runtime role slice 与 request-ledger 两个单写者 slice |
| 依赖 | `contracts` · `platform-ports` · `state` |

## 1 · 这个包是什么

这是 TER kernel 的运行时装配与执行骨架：解析模块依赖，注册 command、actor 与 state
registration，启动生命周期，执行本地或 peer command，并把生命周期事实写入有界 journal 与
request ledger。它不是业务事实台账、同步协议或平台适配器；这些能力由后续 owner 和
topology/adapter 包负责。

## 2 · 结构

```text
src/
  application/   createRuntime、四阶段生命周期接线、模块 descriptor
  foundations/   拓扑解析、dispatcher、lifecycle emitter、journal、资源注册表、错误归一化
  features/      runtime initialize、instance-mode 与 request-ledger command/actor/slice
  selectors/     instance-mode 与 request execution view selector
  types/         command、actor、execution、requestLedger、peer、journal、limits、module、runtime
  testing/       仅测试接缝：资源释放与 state 同步读取，不是生产能力；通过 `/testing` 子路径访问
  index.ts       唯一公开面（当前 64 项）
test/            runtime 行为与类型夹具（test 目录已纳入 tsc）
```

## 3 · 最小用法

```ts
import {createRuntime, initializeCommand} from '@catering-v2s/kernel-base-runtime'

const runtime = createRuntime({
  localNodeId,
  modules,
  platformPorts,
  state: {
    runtimeName: 'terminal',
    environmentMode: 'DEV',
    persistenceKey: 'terminal-main',
    storageTimeouts: {readMs: 2000, writeMs: 2000, resetMs: 5000},
    persistenceDebounceMs: 300,
  },
})

await runtime.start() // 必须显式 await
await runtime.dispatchCommand(initializeCommand, {})
```

`start` 的顺序固定为 `preSetup → state hydrate → install → initialize`。只有全部完成后
runtime 才进入 `started`；任何阶段失败都会进入不可继续的 `failed`，调用方不得忽略
`start()` 的 Promise，也不得在失败后继续派发。

本地 actor 通过 `Promise.all` 并行执行，结果数组按 actor 的启动/声明顺序返回。每个 actor
有自己的 timeout；超时只产生 `timed-out` 终态，不取消 handler、port 或 dispatch 副作用。
迟到完成/错误只追加 journal 事件，不改写已经终结的 actor 记录。角色切换提交成功后，runtime
再派发内部 `instance-mode-changed` command；request-ledger actor 作为该 command 的消费者，
按旧角色清理台账，不再使用 `roleChangeEffects` 或 action-list effect seam。

`routeContext` 在 runtime 内只作为 opaque 值整体继承或替换，再交给 peer gateway；wire
形状、序列化与入站解码属于 transport，本包不解释 workspace、instanceMode 或 displayMode。
`internal` 是命令语义，不是 caller 权限；是否允许外部调用由 public command 和 requestId
规则决定。

## 4 · 状态、角色、request ledger 与 reset

runtime facade 的 `getState`/`getStore` 只暴露 Redux 原生根，created/starting 阶段不可用；
module/actor context 在 state runtime 建成后直接读取它。只读订阅通过
`subscribe(listener)` 暴露，不要求调用方传入 store；它对 `starting`、`started`、`failed`
状态转变以及 started 后的同步 Redux state dispatch 同步通知。订阅可以在 start 前建立，
不会立即回调；进入 failed 后先完成最终一次 `failed` 通知，再关闭 facade 订阅，之后的新订阅
是 no-op。退订幂等，测试可通过退订后的真实 state command 观察通知计数不再增加。消费侧应
组合既有 `status`、`getState` 与 `subscribe` 三件套，不应把 `getStore` 当作读侧接缝。
状态订阅若在回调中派发命令，模块必须自己提供幂等判据，runtime 不替业务发明幂等键。

instance-mode 是本包的角色 slice：`owner-only`、`isolated`、进程内角色值可持久化；角色切换
先写角色字段，提交成功后再派发内部 `instance-mode-changed` command。request ledger 由
MASTER 与 SLAVE 两个单写者 slice 组成，分别沿角色方向同步，`persistIntent: 'never'`，
只记录 request/command 事实，不保存业务 payload，也不承担跨机 wire 协议。selector 支持
只读到本机一侧、只读到镜像一侧或两侧合并；只读到一侧时只按该侧计算状态，双侧同一
`commandId` 冲突时本机事实优先。ledger 的清理由内部 cleanup command/actor 与有界 timer
触发，只删除当前拥有写权的一侧；角色提交后的 `instance-mode-changed` command 由 ledger actor
消费并清理旧角色半边。
角色切换的业务留痕只在内存 journal，不能跨重启保留；若需要跨重启审计，应由后续
owner/审计设计负责。

reset 只能由 actor context 的 `requestApplicationReset` 登记，并在 root command 完成后执行：
持久层 reset 成功 → state 重建 → reset hooks → initialize。重复 reason 与 reset 执行期间
登记的请求都会被忽略并分别写入 `reset.reason-ignored`、`reset.during-reset-ignored`；
reset 会再次运行 initialize，所以每个模块的 initialize actor 必须可重复执行并自带幂等保证。
命令已经终结并释放后才到达的 actor reset 请求没有活动 root 可绑定，会被丢弃，不会留下
无人消费的 pending reset。

## 5 · 部署边界与本单元范围

本包只承载命令的 opaque route context，不派生路由、不做准入，也不把角色 slice 纳入同步。
它适用于 T1（主机主屏 + 副机副屏）、T2（主机主屏 + 副机主屏）和 T3（单机双屏、单 VM /
单 store / 多 surface）三种部署形态。

单元 B 包含 request ledger、selector、预算、淘汰与角色翻转清理，但不包含 dedicated request
wire 协议、latest-wins、逻辑时钟、跨重启 ledger 持久化或 Unit C 的 peer transport 实现。
state 包提供的全量同步负责把两个单写者 slice 送到对端；本包不另造接收方账本或命令级
跨机机制。journal 有界（默认 1000 条 FIFO）、仅进程内、不同步、不持久化，不保存 payload
或 actor result。actor 超时后仍可能继续派发子命令；此时原执行栈的重入/深度保护不是取消
保证，这是已知边界。

## 6 · 在这个包上迭代时

1. 新的生命周期事实必须进入唯一的 lifecycle emitter；不要在 dispatcher 另造 record 或 observation。
2. 新增 context 字段、公开导出、limit、gateway、command/actor 形状或依赖出边前，先更新设计、静态门与类型夹具。
3. 不要在这里加入 Unit C 的 dedicated request wire、latest-wins、逻辑时钟、wire 解码或 caller 权限系统；
   request ledger 的事实、selector、预算与淘汰已经在本包，跨机传输仍由 state/topology 负责。
4. 不要把 `internal` 当权限绕过；角色切换的后续消费者必须监听 runtime 的
   `instance-mode-changed` command，不得恢复 `roleChangeEffects` 或 action-list effect seam。
5. 修改 command 声明时，`AppModule.commands[].name` 必须使用 `defineCommand` 生成的完整命令名；
   `commandDefinitions`、manifest 与 owner declaration 必须保持 exact-set。
6. 生命周期诊断日志通过 platform-ports logger 的命令上下文派生 scope，记录时读取
   `requestId`、`commandId`、`commandName`、`sessionId` 与本地节点身份；不得把 payload、routeContext
   或 actor result 写入日志。
7. 变更前运行本包的 typecheck、test、runtime static/model；TER-local 收口还要保持
   `REAL_TESTS=4`、`NO_TEST=5` 的 owner 分母。静态/typecheck/export 通过不能升级为 native、
   Gradle、设备、DEV、浏览器 L2、UAT 或部署证明。
8. 调用方若确需表达 store、enhancer、action 或 request view 类型，可从既有公开面反推：
   `ReturnType<Runtime['getStore']>`、
   `NonNullable<RuntimeStateInput['storeEnhancers']>[number]`、
   `Parameters<ActorExecutionContext['dispatchAction']>[0]`，以及直接使用公开的
   `RequestExecutionView`/`RequestExecutionCommandView`。本包内部的具名 alias 同样只从
   `state` 的公开类型结构派生，刻意不从包根导出；这样既避免 runtime 直接导入 RTK，
   也不鼓励业务包长期持有 Redux 原生 store。跨包读取仍须遵守 TR-03，只走 owner selector。

## 7 · 当前有效的 display-context 前置（2026-09-02）

runtime 的角色提交后通知是内部 `runtimeInstanceModeChangedCommand`，由 runtime 自己定义，
并在角色字段成功写入后派发。display-context 与 request-ledger 等消费者各自注册 actor，
不注册回调、不接收写能力，也不恢复已退役的 `RuntimeRoleChangeEffect`/`roleChangeEffects`。

`RuntimeModuleContext.registerResource` 是模块安装期登记未来 teardown 资源的唯一接缝；资源
注册表本身是生产设施，`src/testing` 只保留测试读取/释放接缝；跨包测试必须从
`@catering-v2s/kernel-base-runtime/testing` 子路径导入 `releaseRuntimeForTest`，不能穿透包边界引用
源码路径。当前 Runtime 没有生产
`stop`/`dispose`，因此生产电源订阅与 facade 订阅的释放依赖进程退出，测试释放只用于隔离
测试资源。`start()`、模块 context 的 `getState` 与 actor context 的 `getState` 仍按各自阶段
契约执行，context 读取不受 runtime 门面 created/starting 限制。
