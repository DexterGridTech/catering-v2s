# TER `kernel.base.runtime` CP-A0 三包全量独立重扫证据

REVIEW_TARGET=IMPLEMENTATION  
SCOPE=CP-A0_THREE_PACKAGE_FULL_RESCAN_AFTER_FIX  
reviewerKind=INDEPENDENT_SUBAGENT  
reviewer=runtime_cp_a0_rescan_after_fix  
VERDICT=GO  
M/S/N=0/0/0  
READ_ONLY=true

## 输入与边界

本重扫由 fresh 独立 verifier 发起，未采信 runtime `HANDOFF.md`、作者自述或旧复核结论。
重新打开当前 contracts、platform-ports、state、runtime 源码与 package.json、CP-A0 需求/详设、
终端编码规范及相关项目记忆；使用不截断搜索和逐文件阅读。未修改任何文件，不实现 Unit B，
不运行仓级 normal verify、设备/native/Expo `run:android`、DEV、seed/reset、browser L2、UAT 或 deploy。

## 独立结论

### 依赖闭包

- `apps/terminal/kernel/base/runtime/package.json:12-16` 仅声明 contracts、platform-ports、state。
- runtime `src` 的全量 import 扫描只出现这三个 workspace 包，未出现 `@reduxjs/toolkit`。
- RTK 类型由 `runtime/src/types/runtime.ts:17-25` 的 root-private 别名从 state 公开边界派生；
  `runtime/src/index.ts:1-80` 未导出这些别名，未形成 public API drift。
- `apps/terminal/skeleton-graph.ts:22-26` runtime graph 仍为 contracts/platform-ports/state，
  未发现 forbidden dependency 或 graph drift。

### contracts 消费闭包

- `contracts/src/index.ts:32-69` 提供 runtime 所需的 ID、error、AppModule 公开面。
- `contracts/src/types/module.ts:4-36` 的 `AppModule` 无 middleware 字段。
- runtime 消费点位于 `runtime/src/application/createRuntime.ts:1-15`、
  `runtime/src/types/module.ts:1-20`、`runtime/src/foundations/createCommandDispatcher.ts:1-20`；
  未发现 `AppModuleMiddlewareDescriptor`、catalog 类型或 Unit B request ledger 类型。

### platform-ports 消费闭包

- `platform-ports/src/types/platformPorts.ts:19-43` 固定 logger、persistKv、persistSecure 等 required ports。
- `platform-ports/src/types/storage.ts:13-22` 固定 `StateStoragePort`。
- `runtime/src/application/createRuntime.ts:293-304` 将 logger、persistKv、persistSecure 映射进 state runtime，
  与 CP-A0 目标闭包一致。

### state 消费闭包

- `state/src/types/runtime.ts:49-60` 的 `CreateStateRuntimeInput` 十字段完整。
- `state/src/types/runtime.ts:66-79` 提供 getStore、getState、flushPersistence、getResetActor、
  createFullSyncPayload、applyAuthoritativeSync。
- runtime 在 `createRuntime.ts:293-304` 传入十字段，在 `createRuntime.ts:254-267` 使用 reset actor，
  在 `createRuntime.ts:346-352` 暴露 getState/getStore。
- state 的 isolated/no-sync 入站拒绝路径在 `state/src/foundations/createStateRuntime.ts:194-240`，
  返回 typed skipped，不存在 runtime 侧旁路。

### Unit B 隔离

需求/详设把 A 限定为 runtime skeleton、把 request ledger/selector/retention/latest-wins 留给 B：
需求 `doc/plans/platform/2026-09-01-v2s-terminal-kernel-base-runtime-requirements-claude.md:14-27`，
详设 `doc/plans/platform/2026-09-01-v2s-terminal-kernel-base-runtime-unit-a-implementation-design-codex.md:823-835`。
当前 runtime `src` 未发现 `RequestExecutionRecord`、`RequestLifecycleSnapshot`、
`applyRequestLifecycleSnapshot`、`registerMirroredCommand`、`CommandEventEnvelope`、
`resolveParameter`、`queryRequest` 或 latest-wins 实现；`README.md:81-90` 明示 A/B 边界。

## 新鲜命令与输出

- `yarn workspace @catering-v2s/kernel-base-runtime typecheck` — exit 0。
- `yarn workspace @catering-v2s/kernel-base-runtime test` — exit 0，10 files / 41 tests PASS。
- `node tools/terminal-runtime/check-static.mjs` — exit 0，`TERMINAL_RUNTIME_STATIC=PASS`。
- `node tools/terminal-runtime/check-static.test.mjs` — exit 0，`TERMINAL_RUNTIME_STATIC_MODEL_TEST=PASS`。
- `yarn workspace @catering-v2s/kernel-base-contracts typecheck && test` — exit 0，17 tests PASS。
- `yarn workspace @catering-v2s/kernel-base-platform-ports typecheck && test` — exit 0，16 tests PASS。
- `yarn workspace @catering-v2s/kernel-base-state typecheck && test` — exit 0，67 tests PASS。
- `node tools/terminal-contracts/check-static.mjs` — exit 0，`TERMINAL_CONTRACTS_STATIC=PASS`。
- `node tools/terminal-platform-ports/check-static.mjs` — exit 0，`TERMINAL_PLATFORM_PORTS_STATIC=PASS`。
- `node tools/terminal-state/check-static.mjs` — exit 0，`TERMINAL_STATE_STATIC=PASS`。
- `node tools/terminal-skeleton/verify-static.mjs` — exit 0，`TERMINAL_STATIC=PASS`。

## 反例与收口

修复前的独立重扫曾发现 runtime 直接 RTK import 未在 runtime manifest 声明；当前字节已将
所有 runtime/src RTK import 移除，以上 typecheck/test/static 命令重新通过，故该反例已关闭。
本重扫未发现新的“门全绿但三包前提漂移”路径；三包消费闭包、依赖声明、Unit B 隔离及静态 graph/API
均有直接源码证据，无 open finding。

## 未验证边界

本证据是静态源码 + package-local/static 命令证明，不升级为 native、Gradle、设备/autolinking、
DEV、seed/reset 运行环境、browser L2、UAT、deploy 或 Unit B request ledger 行为证明。
