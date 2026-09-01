# TER `kernel.base.runtime` 单元 B · 实施证据

```text
EVIDENCE_OWNER=CODEX
IMPLEMENTATION_SCOPE=TER_KERNEL_BASE_RUNTIME_UNIT_B
REVIEW_TARGET=IMPLEMENTATION
IA=NOT_APPLICABLE
TER_ONLY_VERIFY=true
UNIT_B_STATUS=IN_PROGRESS
```

本文件按 CP 追加。仓级 normal `scripts/verify`、单元 C、adapter/native、Gradle、设备、DEV、seed、reset、浏览器 L2、UAT、部署与 EAS 均不在本次授权内。

## CP-B0 · 冻结前置与 A/B 接点复核

写入前重新读取：

- 需求：`doc/plans/platform/2026-09-01-v2s-terminal-kernel-base-runtime-requirements-claude.md` 的 §0-A、§4.7、§4.8b、§6、§8；
- 详设：`doc/plans/platform/2026-09-01-v2s-terminal-kernel-base-runtime-unit-b-implementation-design-codex.md` 的 §2、§4、§9、§17；
- 项目记忆：`project-memory/decisions/terminal-architecture-and-stack-rulings.md`、`project-memory/decisions/deterministic-context-only.md` 及 implementation/platform 路由结果；
- owning source：当前 A 的 runtime、contracts、platform-ports、state 源码与测试。

### 1. 五个接点逐项结果

| 接点 | 当前 owning source | 复核事实 | 结果 |
|---|---|---|---|
| A-1 lifecycle 单一事实产生点 | `apps/terminal/kernel/base/runtime/src/foundations/createLifecycleEmitter.ts:114-127, 317, 447` | `createCommandExecutionObservation` 只有一处定义；A 期 `command.started` 与异常兜底均经该函数；`displayMode` 当前唯一赋值为 `null` | `MATCHED` |
| A-2 角色 effect 生效点 | `apps/terminal/kernel/base/runtime/src/features/actors/setRuntimeInstanceModeActor.ts:32-55` | `role.change-requested` 后先按声明顺序 await 全部 `roleEffects`，再 dispatch 角色 action，最后发 `role.changed`；effect 失败不会执行角色写入 | `MATCHED` |
| A-3 dispatch 上下文 | `apps/terminal/kernel/base/runtime/src/foundations/createCommandDispatcher.ts:63-78, 340-371` | `CommandDispatchOptions` 与 actor options 含 `requestId`、`commandId`、`parentCommandId`、`routeContext`；context 保留 target 与 allowNoActor | `MATCHED` |
| B-1 contracts 输入 | `apps/terminal/kernel/base/contracts/src/types/request.ts:4-52`、`src/types/command.ts:1-9`；`src/foundations/runtimeId.ts:26-59`；`src/foundations/errorTemplate.ts:44-68`；`src/types/module.ts:25-36` | 当前 request status 仍为三态；route 仍为开放 `string` 字段；ID 工厂、AppError 工厂、AppModule 描述符均存在，`packageVersion` 可选 | `MATCHED_FOR_CP-B1_CHANGE` |
| B-2 state 接口与同步边界 | `apps/terminal/kernel/base/state/src/types/runtime.ts:49-78`、`src/types/slice.ts:32-40`、`src/foundations/createStateRuntime.ts:180-247`、`src/supports/sync.ts:192-214` | `CreateStateRuntimeInput` 现有十字段；`getStore`/`getState`/`flushPersistence`/`getResetActor().handleResetCommand` 可用；`createFullSyncPayload` 与 `applyAuthoritativeSync` 为现成 seam；isolated slice 无 sync descriptor，入站 apply 返回 `SYNC_NOT_DECLARED`；tombstone 在 owner apply 前消费为删除 | `MATCHED` |

### 2. CP-B0 基线输出

以下命令均为本次 CP-B0 新鲜运行，均 exit 0；输出中的 warning 不升级为 PASS，也不改变本次范围：

```text
COMMAND=yarn --cwd apps/terminal typecheck
RESULT=Tasks: 22 successful, 22 total
ELAPSED=6.688s
```

```text
COMMAND=yarn --cwd apps/terminal test
RESULT=Tasks: 9 successful, 9 total; runtime=52 tests; state=67 tests; platform-ports=16 tests; contracts=17 tests
EXIT=0
```

```text
COMMAND=node tools/terminal-runtime/check-static.mjs
RESULT=4 rule gates + 1 support; TERMINAL_RUNTIME_STATIC=PASS
EXIT=0
```

```text
COMMAND=node tools/terminal-contracts/check-static.mjs
RESULT=4 rule gates + 1 support; TERMINAL_CONTRACTS_STATIC=PASS
EXIT=0
```

```text
COMMAND=yarn --cwd apps/terminal verify:static
RESULT=6 skeleton gates + hygiene; contracts/platform-ports/state/runtime static sections PASS; TERMINAL_STATIC=PASS
EXIT=0
```

```text
COMMAND=yarn --cwd apps/terminal verify
RESULT=TERMINAL_STATIC=PASS; typecheck=22/22; test owners=9, REAL=4, NO_TEST=5; Android export=702 modules; TERMINAL_VERIFY_CLEANUP=PASS; TERMINAL_VERIFY=PASS
EXIT=0
NOTE=npm warn Unknown user config "allow-scripts"; Expo reported forceful exit after export; neither was treated as a success proof.
```

CP-B0 完成信号：五个接点均已在当前字节中找到并记录；B-1 的 contracts 当前形状与设计预期一致；无需改 A/state 或停机回报。

### 3. CP-B0 fresh 独立三维对账

`runtime_b_cp0_reconcile_fast` 以 fresh 独立子 agent 执行只读对账，未读取或采信本证据自述，
也未写入、安装、测试或动态运行。其逐项结果为：

```text
1 lifecycle emitter: MATCHED
2 role effect 顺序: MATCHED
3 dispatch identity/route: MATCHED
4 contracts 输入: MATCHED
5 state sync 边界: MATCHED
RECONCILIATION=MATCHED OPEN_COUNT=0
```

该对账确认 CP-B0 可以进入 CP-B1；state 同步方向校验缺口按详设登记为跨包欠账，未被误报为本步 mismatch。

## CP-B1 · contracts 第一/二组

CP-B1 写前按实现路由回读了 contracts checker、contracts 类型、contracts public-surface fixture、
platform-ports 与 runtime 的 route fixtures。已完成的变更：

- `tools/terminal-contracts/check-static.mjs` 的 dot-property closed-union 检查显式区分 optional symbol；
  只有 optional 属性才剥离 `undefined`，必填字段不会被同样放宽。
- `tools/terminal-contracts/check-static.test.mjs` 增加两个定向控制：
  `workspace?: string` 只使 `closed-literal-unions` 失败；改成必填的 `'MAIN' | 'BRANCH'` 保持全绿。
- 当前 contracts 的 `RequestLifecycleStatus` 为五态，`CommandRouteContext` 的三个字段为闭集可选字段；
  三包真实 route fixtures 均使用 `MAIN/BRANCH`、`MASTER/SLAVE`、`PRIMARY/SECONDARY` 合法值。

### CP-B1 focused proof

```text
COMMAND=node tools/terminal-contracts/check-static.test.mjs
RESULT=CONTRACTS_MODEL_CLEANUP=PASS; TERMINAL_CONTRACTS_STATIC_MODEL_TEST=PASS
EXIT=0
```

```text
COMMAND=node tools/terminal-contracts/check-static.mjs
RESULT=CONTRACT_RULE_GATES=4; CONTRACT_SUPPORT_CHECKS=1; all four rules PASS; CONTRACT_SUPPORT=PASS; TERMINAL_CONTRACTS_STATIC=PASS
EXIT=0
```

```text
COMMAND=yarn --cwd apps/terminal/kernel/base/contracts typecheck
EXIT=0

COMMAND=yarn --cwd apps/terminal/kernel/base/platform-ports typecheck
EXIT=0

COMMAND=yarn --cwd apps/terminal/kernel/base/runtime typecheck
EXIT=0
```

```text
COMMAND=yarn --cwd apps/terminal/kernel/base/runtime test
RESULT=Test Files 11 passed; Tests 58 passed; TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/kernel-base-runtime
EXIT=0
```

CP-B1 focused proof 证明 optional-union checker 的正向与反向控制、contracts 三包类型解析与现有 runtime
route fixture 均通过；尚未把该结果升级为 CP-B1 之外的 ledger、lifecycle 或设备证明。

## CP-B2 · ledger、selector 与 runtime ledger-shape gate

CP-B2 写前按实现路由回读了需求 §4.7.1、§4.7.2、§4.7.5，详设 §4.3、§4.4、§4.9.1、§4.9.4、§4.9.5、
§7.1、§7.2、§8 与 §9，及当前 state sync owner 实现。当前实现保持两个单写者 slice（MASTER→SLAVE、
SLAVE→MASTER），`persistIntent:'never'`，record 只含 requestId/workspace/startedAt/commands，
selector 通过唯一 `readLiveRequestEnvelope` 防御性收窄 tombstone，并实现 local-only、peer-only、双侧合并、
same-command local precedence、两级 route filter 与 envelope 引用 WeakMap 分片缓存。请求状态复用
`aggregateCommandStatus` 的结果按冻结顺序聚合；未改 dispatcher、emitter 或 state package 生产接线。

runtime static checker 新增 `ledger-record-shape` 规则并把 public expected exact 从 58 更新为 63；规则以手写
成员集合对拍 `RequestExecutionRecord` 与 `CommandExecutionObservation`，不另建 selector cache 伪门。
model test 新增给 record 加 `payload` 的定向 mutation，确认只击穿 ledger-shape，真实树与 support 仍通过。

### CP-B2 focused proof

```text
COMMAND=node tools/terminal-runtime/check-static.test.mjs
RESULT=RUNTIME_MODEL_CLEANUP=PASS; TERMINAL_RUNTIME_STATIC_MODEL_TEST=PASS
EXIT=0
```

```text
COMMAND=node tools/terminal-runtime/check-static.mjs
RESULT=RUNTIME_RULE_GATES=5; RUNTIME_SUPPORT_CHECKS=1; all five rules PASS; RUNTIME_SUPPORT_EXPORTS=PASS; TERMINAL_RUNTIME_STATIC=PASS
EXIT=0
```

```text
COMMAND=yarn --cwd apps/terminal/kernel/base/runtime typecheck
EXIT=0

COMMAND=yarn --cwd apps/terminal/kernel/base/runtime test
RESULT=Test Files 11 passed; Tests 58 passed; TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/kernel-base-runtime
EXIT=0
```

CP-B2 focused proof 证明类型/成员闭集、双 slice descriptor、聚合及 selector focused cases 可编译并通过；真实
runtime lifecycle 写账、budget、cleanup、role effect 与 TER-local 全链仍留给后续 CP。

### CP-B2 fresh 独立三维对账

`runtime_b_cp2_reconcile_verifier` 以 fresh 独立子 agent 执行只读源码对账，未修改文件、未运行测试，
未采信本证据自述。其对照需求/详设与当前字节的 11 项结果全部为 `MATCHED`：

```text
RequestExecutionRecord exact fields: MATCHED
CommandExecutionObservation nine fields: MATCHED
MASTER/SLAVE slice intents and persistIntent: MATCHED
single readLiveRequestEnvelope tombstone boundary: MATCHED
local-only/peer-only selector semantics: MATCHED
dual-side local precedence: MATCHED
workspace/display route filters: MATCHED
WeakMap envelope sentinels: MATCHED
runtime five rules: MATCHED
public support exact=63: MATCHED
ledger payload red mutation: MATCHED
RECONCILIATION=MATCHED OPEN_COUNT=0
```

CP-B2 完成，可进入 CP-B3；上述对账仅证明静态设计/源码关系，未升级为 lifecycle、budget、cleanup、native
或设备行为证明。

## CP-B3 focused proof（2026-09-01）

CP-B3 按详设只改已登记接点：`createLifecycleEmitter` 是唯一 ledger observation 写入点，
`displayMode` 由同一 observation factory 从 `routeContext` 单点赋值；`createCommandDispatcher`
从合并 selector 的 `commands.length` 执行 `maxCommandsPerRequest`，不建立独立计数表；
`createInternalRuntimeModule` 将 MASTER/SLAVE 两个 ledger slice 装配进真实 runtime；
`runtimeStateSyncForTest.ts` 只提供不从包根导出的 StateRuntime full-sync 测试接缝。

新鲜命令与输出：

```text
$ yarn --cwd apps/terminal/kernel/base/runtime typecheck
exit=0

$ yarn --cwd apps/terminal/kernel/base/runtime test
Test Files  12 passed (12)
Tests       62 passed (62)
TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/kernel-base-runtime

$ node tools/terminal-runtime/check-static.mjs
RUNTIME_RULE_GATES=5
RUNTIME_SUPPORT_CHECKS=1
RUNTIME_RULE_CONTEXT_EXACT_SET=PASS
RUNTIME_RULE_COMMAND_MOUNT_SHAPE=PASS
RUNTIME_RULE_OWNER_KIND=PASS
RUNTIME_RULE_RESTART_POSITIVE=PASS
RUNTIME_RULE_LEDGER_RECORD_SHAPE=PASS
RUNTIME_SUPPORT_EXPORTS=PASS
TERMINAL_RUNTIME_STATIC=PASS
```

新增 focused cases：

- local public command + child command：selector 读到两个 command 的 actor result，继承同一
  `displayMode`，状态为 `completed`；
- peer-targeted command：真实 peer gateway 经 dispatcher，selector 读到 peer observation；
- 两个真实 runtime：源 runtime 的 `createFullSyncPayload` 产物经 test-only seam 应用到目标 runtime，
  目标切为 SLAVE 后以 peer view 读到完整记录；
- 以 StateRuntime full-sync 预置达到上限的 request：首次派发得到
  `kernel.base.runtime.request_budget_exceeded` typed rejection，并写一条 budget observation；
  第二次派发同一 request 仍 typed reject 且 ledger command 数与 budget fact 数不增长。

上述输出只证明 CP-B3 的 runtime typecheck/test 与 focused 行为，不升级为 cleanup、native、Gradle、
设备或 Unit C 证明。

### CP-B3 独立对账与修复

首次 fresh 对账发现一个 OPEN：`onLedgerTransition` 抛错时 dispatcher 未检查 emitter 的失败结果，
可能继续返回 `completed`。已在既有 CP-B3 范围内闭合：emitter 以 `ledgerWriteFailed` 标记并输出
脱敏 `runtime.ledger.write-failed`，dispatcher 将其投影为 typed
`kernel.base.runtime.ledger_write_failed` rejection；actor execution stack 在 lifecycle emit 失败时
也通过 `finally` 释放。新增 focused test 让真实 store dispatch 抛出，断言不返回 completed 且诊断事件存在。

修复后新鲜复跑：

```text
$ yarn --cwd apps/terminal/kernel/base/runtime typecheck
exit=0

$ yarn --cwd apps/terminal/kernel/base/runtime test
Test Files  12 passed (12)
Tests       63 passed (63)
TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/kernel-base-runtime

$ node tools/terminal-runtime/check-static.test.mjs
RUNTIME_MODEL_CLEANUP=PASS
TERMINAL_RUNTIME_STATIC_MODEL_TEST=PASS

$ node tools/terminal-runtime/check-static.mjs
RUNTIME_RULE_GATES=5
RUNTIME_SUPPORT_CHECKS=1
RUNTIME_RULE_CONTEXT_EXACT_SET=PASS
RUNTIME_RULE_COMMAND_MOUNT_SHAPE=PASS
RUNTIME_RULE_OWNER_KIND=PASS
RUNTIME_RULE_RESTART_POSITIVE=PASS
RUNTIME_RULE_LEDGER_RECORD_SHAPE=PASS
RUNTIME_SUPPORT_EXPORTS=PASS
TERMINAL_RUNTIME_STATIC=PASS
```

fresh `runtime_b_cp3_recheck` 已对修复后的当前字节完成只读三维复核：
`RECONCILIATION=MATCHED / OPEN_COUNT=0`。复核确认 ledger-write failure 会进入脱敏日志与 typed
`ledger_write_failed` rejection，dispatch/actor execution stack 均在 `finally` 释放；其余 CP-B3
接点与 Unit B 边界无 OPEN。该复核未运行命令，动态证据仍以本节前述新鲜输出为准。

## CP-B4 focused proof（2026-09-01）

CP-B4 只改 Unit B 已批准的 cleanup/role/timer 接点与本包文档：内部
`cleanup-request-ledger` command/actor 按当前角色 slice 逐键删除已终结且超过 retention 或
max-residence 的记录；running 记录与镜像侧仍 running 的请求保留；角色切换 effect 在角色字段写入
前清空失去写权的 ledger half；timer 在 runtime 进入 started 后注册并通过资源 disposer 清理；默认
ledger 仍 `persistIntent: 'never'`。没有修改 state package 生产同步、其余 TER 包或 Unit C。

新增/扩展 focused cases 覆盖：本机 terminal、retention 与 max-residence 淘汰；running 与 peer-running
保留；只有当前写权 half 被删除；角色翻转后旧 half 清理与新角色写入；role effect/cleanup dispatch
失败时角色与旧 half 保持；peer 时钟快慢窗口；timer 注册、触发与 disposer；跨 runtime 实例 ledger
不恢复。真实测试输出：

```text
$ yarn --cwd apps/terminal/kernel/base/runtime typecheck
exit=0

$ yarn --cwd apps/terminal/kernel/base/runtime test
Test Files  13 passed (13)
Tests       73 passed (73)
TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/kernel-base-runtime
```

CP-B4 静态与模型门输出：

```text
$ node tools/terminal-runtime/check-static.test.mjs
RUNTIME_MODEL_CLEANUP=PASS
TERMINAL_RUNTIME_STATIC_MODEL_TEST=PASS
exit=0

$ node tools/terminal-runtime/check-static.mjs
RUNTIME_RULE_GATES=5
RUNTIME_SUPPORT_CHECKS=1
RUNTIME_RULE_CONTEXT_EXACT_SET=PASS
RUNTIME_RULE_COMMAND_MOUNT_SHAPE=PASS
RUNTIME_RULE_OWNER_KIND=PASS
RUNTIME_RULE_RESTART_POSITIVE=PASS
RUNTIME_RULE_LEDGER_RECORD_SHAPE=PASS
RUNTIME_SUPPORT_EXPORTS=PASS
TERMINAL_RUNTIME_STATIC=PASS
exit=0
```

CP-B4 结论：本包的 cleanup actor、内部 command、role effect、timer 与 Unit B focused tests 已接入，
其 static/model/type/test 证据全绿。该证据不证明 state 的真实生产跨机 transport、Unit C、native、
Gradle/autolinking、设备、DEV、seed/reset 运行环境、浏览器 L2、UAT、部署或仓级 normal verify；
角色 journal 与 request ledger 均不跨重启保留。

### CP-B4 fresh 独立三维对账（修复后）

`runtime_b_cp4_reconcile_final` 以 fresh 独立子 agent 只读复核当前字节，未运行命令、未修改文件，
并未采信作者自述。此前唯一 OPEN（HANDOFF 未精确登记 state 同步方向仍未证明）已按要求闭合：

```text
RECONCILIATION=MATCHED
OPEN_COUNT=0
```

逐项确认：

- `HANDOFF.md` 明确以 `UNVERIFIED_REQUIRES_EVIDENCE` 登记
  `state.applyAuthoritativeSync` 尚不校验 sync direction，runtime 自身写路径的单写者约束不得
  升级为跨包同步层证明；
- README 与 HANDOFF 对两个单写者 ledger slice、`persistIntent:'never'`、selector 单边/双侧语义、
  cleanup 当前写权侧、role flip 清旧 half、journal/ledger 不跨重启的表述一致；
- cleanup command/actor、retention/max-residence、peer-running 保留、role effect 失败保护、timer
  disposer、peer-clock window 与跨 runtime 非持久化测试均与 CP-B4 详设 MATCHED；
- `runtimeStateSyncForTest` 仍为包内 test-only seam，未扩张为 Unit C transport；未发现 state 生产同步
  方向修复或其他越界实现。

该复核只证明静态设计/源码关系；typecheck、test、static、TER-local verify 的动态结果仍以本证据
中对应的新鲜命令输出为准，未升级为 native、Gradle、设备或跨包同步方向的证明。

## Unit B 全范围三维对账（CP-B0～CP-B4，2026-09-01）

`runtime_b_whole_scope_reconcile_final` 作为 fresh 独立验证者，重新打开冻结需求、冻结详设、相关
project-memory、runtime 全部源码/测试/工具、skeleton graph、TER-local 接线、README 与 HANDOFF，
只做静态对账，未运行 typecheck/test/build/verify/Expo/动态命令。其独立结果为：

```text
RECONCILIATION=MATCHED
OPEN_COUNT=0
EVIDENCE_BOUNDARY=STATIC_SOURCE_ONLY
```

核心复算与逐项结果：

- `skeleton-graph.ts` 已移除 runtime `plannedKind`，runtime 仍只有 contracts/platform-ports/state 三条出边；
- runtime root public export 与 `tools/terminal-runtime/check-static.mjs` 的 Unit B expected exact-set 均为 63，
  `RuntimeRoleChangeEffect` 已公开而 `RuntimeRoleChangeSignal` 仍为内部类型；
- MASTER/SLAVE ledger slice 的 `persistIntent:'never'` 与 `master-to-slave`/`slave-to-master` 方向一致；
- selector 在 local-only、peer-only、双侧三种形态下按存在事实计算，peer-only 使用 `timeSource:'peer'`，
  envelope sentinel 分支存在；tombstone 经唯一 `readLiveRequestEnvelope` 按 absent 处理；
- lifecycle ledger writer 为单点，merged selector 的 request budget 不建立独立计数表，重复 budget fact 不增长；
- cleanup 是 internal command/actor，按当前写权 half、terminal/retention/maxResidence 逐键处理；role flip 清旧 half
  的 effect 在角色字段写入前执行；timer 仅派 command 并登记 disposer；ledger 与角色 journal 不跨重启；
- 依赖、测试 owner、TER-local marker、README/HANDOFF 边界与冻结输入一致；未发现 Unit C、state 生产同步方向
  修复或其他越界实现；未构造出当前“所有门绿但 Unit B 未建成”的可用路径。

该全范围对账的动态缺口仍由随后新鲜命令填补：runtime/依赖包 typecheck 与 test、runtime model/static、
TER `verify:static`/`verify`。`state.applyAuthoritativeSync` 尚不校验 sync direction 的跨包风险已在
HANDOFF 以 `UNVERIFIED_REQUIRES_EVIDENCE` 单独登记，不能被本包的静态或 TER-local 结果升级。

## Unit B final dynamic verification（2026-09-01）

全范围对账后按当前字节执行授权内命令。以下为本轮新鲜原始结果摘要：

```text
$ yarn --cwd apps/terminal/kernel/base/runtime typecheck
exit=0

$ yarn --cwd apps/terminal/kernel/base/runtime test
Test Files  13 passed (13)
Tests       73 passed (73)
TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/kernel-base-runtime
exit=0

$ node tools/terminal-runtime/check-static.test.mjs
RUNTIME_MODEL_CLEANUP=PASS
TERMINAL_RUNTIME_STATIC_MODEL_TEST=PASS
exit=0

$ node tools/terminal-runtime/check-static.mjs
RUNTIME_RULE_GATES=5
RUNTIME_SUPPORT_CHECKS=1
RUNTIME_RULE_CONTEXT_EXACT_SET=PASS
RUNTIME_RULE_COMMAND_MOUNT_SHAPE=PASS
RUNTIME_RULE_OWNER_KIND=PASS
RUNTIME_RULE_RESTART_POSITIVE=PASS
RUNTIME_RULE_LEDGER_RECORD_SHAPE=PASS
RUNTIME_SUPPORT_EXPORTS=PASS
TERMINAL_RUNTIME_STATIC=PASS
exit=0

$ yarn --cwd apps/terminal/kernel/base/contracts typecheck
exit=0

$ yarn --cwd apps/terminal/kernel/base/platform-ports typecheck
exit=0

$ node tools/terminal-contracts/check-static.test.mjs
CONTRACTS_MODEL_CLEANUP=PASS
TERMINAL_CONTRACTS_STATIC_MODEL_TEST=PASS
exit=0

$ node tools/terminal-contracts/check-static.mjs
CONTRACT_RULE_GATES=4
CONTRACT_SUPPORT_CHECKS=1
CONTRACT_RULE_ZERO_ADAPTER_CAPABILITY=PASS
CONTRACT_RULE_TR05_NAMED_BOUNDARY=PASS
CONTRACT_RULE_RUNTIME_ID_PREFIX_EXACT_SET=PASS
CONTRACT_RULE_CLOSED_LITERAL_UNIONS=PASS
CONTRACT_SUPPORT=PASS
TERMINAL_CONTRACTS_STATIC=PASS
exit=0

$ node tools/terminal-platform-ports/check-static.test.mjs
PLATFORM_PORTS_MODEL_CLEANUP=PASS
TERMINAL_PLATFORM_PORTS_STATIC_MODEL_TEST=PASS
exit=0

$ node tools/terminal-platform-ports/check-static.mjs
PLATFORM_PORT_RULE_GATES=4
PLATFORM_PORT_SUPPORT_CHECKS=1
PLATFORM_PORT_RULE_TR05_NAMED_BOUNDARY=PASS
PLATFORM_PORT_RULE_REQUIRED_PORT_SHAPE=PASS
PLATFORM_PORT_RULE_DEFAULT_IMPORT_ALLOWLIST=PASS
PLATFORM_PORT_RULE_PLATFORM_IDENTIFIER_BOUNDARY=PASS
PLATFORM_PORT_SUPPORT=PASS
TERMINAL_PLATFORM_PORTS_STATIC=PASS
exit=0

$ yarn --cwd apps/terminal verify:static
TERMINAL_SKELETON_MODEL_TEST=PASS
RULE_GATES=6
SUPPORT_CHECKS=1
RULE_GRAPH_COMPARISON=PASS
RULE_TRIPLE_NAMING=PASS
RULE_DEPENDENCY_DIRECTION=PASS
RULE_DEPENDENCY_DECLARATION_COMPLETENESS=PASS
RULE_TR01_REDUCER_BOUNDARY=PASS
RULE_KERNEL_PLATFORM_INDEPENDENCE=PASS
SCAFFOLD_HYGIENE=PASS
TERMINAL_CONTRACTS_STATIC=PASS
TERMINAL_PLATFORM_PORTS_STATIC=PASS
TERMINAL_STATE_STATIC=PASS
TERMINAL_RUNTIME_STATIC=PASS
TERMINAL_STATIC=PASS
exit=0

$ yarn --cwd apps/terminal verify
TERMINAL_SKELETON_MODEL_TEST=PASS
TERMINAL_STATIC=PASS
TERMINAL_TURBO_DRY_TYPECHECK=PASS packages=22 tasks=22 executable=22
TERMINAL_TURBO_DRY_TEST=PASS packages=22 tasks=22 executable=9
TERMINAL_TURBO_DRY_LINT=PASS packages=22 tasks=22 executable=0
TERMINAL_TURBO_DRY_CLEAN=PASS packages=22 tasks=22 executable=0
Tasks: 22 successful, 22 total (typecheck)
Tasks: 9 successful, 9 total (test)
TERMINAL_TEST_MARKERS=PASS real=4 noTests=5
Android Bundled 2150ms apps/terminal/assembly/android/pos-desktop/index.ts (710 modules)
Exported: dist
TERMINAL_VERIFY_CLEANUP=PASS
TERMINAL_VERIFY=PASS
exit=0
```

`verify` 输出中的 npm `allow-scripts` warning 与本批代码无关，未改变退出码、business 或 cleanup
判定。本轮没有运行仓级 normal `scripts/verify`，也没有运行 native/Gradle/设备、DEV、seed、reset
运行环境、浏览器 L2、UAT 或部署；TER-local 结果只证明静态、类型、测试、marker 与 Metro/JS export
闭包，不升级为 Unit C、state 同步方向、native、设备或跨重启证明。

## Unit B implementation review remediation（2026-09-01，当前有效）

Claude implementation review `doc/review/platform/2026-09-01-v2s-terminal-kernel-base-runtime-unit-b-implementation-review-claude.md`
的 1M/1S/2N 已按当前源码逐条修复；以下内容取代本节此前的过时叙述：

- M-1：`writeLedgerTransition` 把底层 store failure 投影为
  `kernel.base.runtime.ledger_write_failed`。`emitActorRunning` 与 `emitActorTerminal` 直接消费
  emitter 的 actor error record，因此 actor running/terminal 写账失败只影响该 actor，命令仍返回聚合结果，
  同命令其它 actor 的结果保留；普通 `command.started`/`command.completed` 等无 actor 槽位的写账失败由
  dispatcher `emit` 转成 typed rejection，不能继续返回 `completed`。新增两条用例分别证明 sibling 保留与
  final command ledger failure rejection，并断言 `runtime.ledger.write-failed` 日志。
- S-1：`selectRequestExecutionView` 的 `results` 改为逐 observation 拍平所有 actor result，失败或超时 actor
  的 slot 保留为 `null`，不再只保留 completed actor。新增 `L-4c` 覆盖 success/error/success 三 actor
  顺序，既断言 `results=[value,null,value]`，也断言 `errors` 仍只含真实 error。
- N-1：`cleanupRequestLedgerActor` 的 terminal status 判断改为接收 contracts 的闭集
  `RequestLifecycleStatus` 并用 exhaustive switch，避免新增请求终态时静默落入开放 string 比较。
- N-2：`createLifecycleEmitter` 的 depth rejected ledger observation 已使用显式局部 narrowing，
  无 `depthRecord!` 非空断言残留。

修复后新鲜输出：

```text
$ yarn workspace @catering-v2s/kernel-base-runtime typecheck
exit=0

$ yarn workspace @catering-v2s/kernel-base-runtime test
Test Files  13 passed (13)
Tests       76 passed (76)
TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/kernel-base-runtime
exit=0

$ yarn workspace @catering-v2s/kernel-base-runtime exec vitest run --config vitest.config.ts requestLedgerLifecycle requestLedgerSelector
Test Files  2 passed (2)
Tests       14 passed (14)
exit=0

$ node tools/terminal-runtime/check-static.mjs
RUNTIME_RULE_GATES=5
RUNTIME_SUPPORT_CHECKS=1
RUNTIME_RULE_CONTEXT_EXACT_SET=PASS
RUNTIME_RULE_COMMAND_MOUNT_SHAPE=PASS
RUNTIME_RULE_OWNER_KIND=PASS
RUNTIME_RULE_RESTART_POSITIVE=PASS
RUNTIME_RULE_LEDGER_RECORD_SHAPE=PASS
RUNTIME_SUPPORT_EXPORTS=PASS
TERMINAL_RUNTIME_STATIC=PASS
exit=0

$ node tools/terminal-skeleton/verify-static.mjs
TERMINAL_STATIC=PASS
TERMINAL_CONTRACTS_STATIC=PASS
TERMINAL_PLATFORM_PORTS_STATIC=PASS
TERMINAL_STATE_STATIC=PASS
TERMINAL_RUNTIME_STATIC=PASS
exit=0

$ yarn --cwd apps/terminal verify
TERMINAL_TURBO_DRY_TYPECHECK=PASS packages=22 tasks=22 executable=22
TERMINAL_TURBO_DRY_TEST=PASS packages=22 tasks=22 executable=9
Tasks: 22 successful, 22 total (typecheck)
Tasks: 9 successful, 9 total (test)
TERMINAL_TEST_MARKERS=PASS real=4 noTests=5
Android Bundled 1792ms apps/terminal/assembly/android/pos-desktop/index.ts (710 modules)
Exported: dist
TERMINAL_VERIFY_CLEANUP=PASS
TERMINAL_VERIFY=PASS
exit=0
```

首轮 `yarn workspace @catering-v2s/terminal verify` 曾在 runtime test 段暴露一条真实首败：
`requestLedgerLifecycle.test.ts` 把同一毫秒内父/子 command 的 selector 输出顺序断言为父先子后；
但冻结设计规定 command view 按 `startedAt` 再 `commandId` 稳定排序，未承诺父子拓扑序。
已将该断言改为按 `commandName` 对拍 parent/child 的 result，保留 route/display 与两条 command 均存在的证明。
修复后按原始 TER-local verify 入口重跑，得到上方 `TERMINAL_VERIFY=PASS`。

一次误用命令不计入证据：曾把 `--runInBand` 传给 package script，Vitest 本体 13/13 files、75/75 tests
通过，但脚本末尾的 Node 以 `bad option: --runInBand` exit 9；随后按原始 package script 重跑并 exit 0。

本轮仍未运行仓级 normal `scripts/verify`，也未运行 native/Gradle/设备、DEV、seed、reset 运行环境、
浏览器 L2、UAT 或部署；TER-local 绿灯不升级为 Unit C、state 同步方向、native、设备或跨重启证明。
