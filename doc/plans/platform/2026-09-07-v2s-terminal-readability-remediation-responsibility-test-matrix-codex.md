# TER 可读性整改 · CP-1 职责→测试对照矩阵

本表在 CP-1 拆分前建立，并在拆分后回写为当前源码与实际测试结果的可读性工作文档；它不是
hash/evidence 台账，也不是新的规范正本。
它按当前 owning source 的完整 AST、private/exported symbol、状态字段、side-effect transition、
error/result discriminant 与 owner 全部测试反推职责分母。写入拆分前必须逐行确认；任一行没有
behavior oracle，先补 focused test，且不得改变既有业务断言语义。

固定字段：

```text
ownerSource | symbolOrTransition | responsibilityFactFromSource | testFile | testNameOrOracle | preObservation | postObservation | gapAction
```

## 1. runtime dispatcher

| ownerSource | symbolOrTransition | responsibilityFactFromSource | testFile | testNameOrOracle | preObservation | postObservation | gapAction |
|---|---|---|---|---|---|---|---|
| `kernel/base/runtime/src/foundations/createCommandDispatcher.ts` | `validateRegisteredDefinition` | factory brand、注册定义 identity、visibility、timeout、target 与 reentry 约束 | `kernel/base/runtime/test/moduleSystem.test.ts` | M-1/M-2/M-3/M-4/M-5/M-6 | 非法定义与重复注册返回 typed failure；合法定义可 dispatch | `CP1-RUNTIME-FULL`：15 files/92 tests PASS；现有 failure/result 断言通过 | 无；当前 facade tests 已复跑 |
| 同上 | `contextFor`、command construction | runtime/request/parent/route/target identity 与 `dispatchedAt` 进入同一 command context | `kernel/base/runtime/test/visibility.test.ts` | V-1/V-2/V-3/V-4 | public 缺 requestId 被拒；route 与 identity 保留 | `CP1-RUNTIME-FULL`：visibility 结果型断言随 15 files/92 tests PASS | 无；当前 facade tests 已复跑 |
| 同上 | `writeLedgerTransition` | lifecycle observation 进入 owner request ledger；过期记录先清理；同 command 更新而非重复 | `kernel/base/runtime/test/requestLedgerLifecycle.test.ts` | local/child、peer、ledger failure、completion | state snapshot 中 commands、startedAt、workspace 与 error 形状正确 | `CP1-RUNTIME-FULL`：ledger snapshot/journal 断言随 15 files/92 tests PASS | 无；当前 facade tests 已复跑 |
| 同上 | `emit`、`emitActorRunning`、`emitActorTerminal` | lifecycle emitter 错误、actor slot、ledger write failure 的 terminal/error 语义 | `kernel/base/runtime/test/lifecycle.test.ts` | J-1/J-2、unresolved、late event | journal、actor record、failure 与 observer 结果可观察 | `CP1-RUNTIME-FULL`：lifecycle record/event/failure 断言随 15 files/92 tests PASS | 无；当前 facade tests 已复跑 |
| 同上 | `dispatchInternal` budget branch | public request identity、command budget、depth、chain 与 started/running/error/completed 顺序 | `kernel/base/runtime/test/dispatch.test.ts`; `requestLedgerLifecycle.test.ts` | D-3、budget rejection | request ledger 与 returned result 明确记录 budget/depth failure | `CP1-RUNTIME-FULL`：budget、ledger、result status 断言随 15 files/92 tests PASS | 无；当前 facade tests 已复跑 |
| 同上 | `dispatchInternal` local actor path | handler registration order、concurrent actors、empty actor、actor result normalization | `kernel/base/runtime/test/dispatch.test.ts`; `actorResult.test.ts` | D-1/D-2、R-1/R-2 | actor result 顺序、null/error/result JSON shape 可观察 | `CP1-RUNTIME-ACTOR`：actor result/ledger/completion 断言随 15 files/92 tests PASS | 无；当前 actor tests 已复跑 |
| `kernel/base/runtime/src/foundations/createCommandActorDispatcher.ts` | `dispatchActor` timeout/late completion | timeout terminal、late journal visibility、resource cleanup、subsequent dispatch | `kernel/base/runtime/test/actorResult.test.ts`; `lifecycle.test.ts`; `runtimeSubscription.test.ts` | R-3、unresolved、L-4 | timeout result、late event、后续 command 可用 | `CP1-RUNTIME-ACTOR`：timeout、late event、cleanup 结果随 15 files/92 tests PASS | 无；当前 actor tests 已复跑 |
| `kernel/base/runtime/src/foundations/createCommandPeerDispatcher.ts` | `dispatchPeer` | peer gateway absence、success/partial/timeout/error、opaque identity forwarding | `kernel/base/runtime/test/peerGateway.test.ts` | P-1/P-2/P-3/P-4 | peer result/error 与 ledger/journal 可观察 | `CP1-RUNTIME-PEER`：peer result/error/identity 断言随 15 files/92 tests PASS | 无；当前 peer tests 已复跑 |
| `kernel/base/runtime/src/foundations/createCommandDispatcher.ts` | role signal bridge | role transition 先提交、observer 后通知；late role event 保持 journal truth | `kernel/base/runtime/test/roleAndRoute.test.ts`; `requestLedgerCleanup.test.ts` | I-2、late role、E-4/E-5 | role state、ledger half 与 event 顺序可观察 | `CP1-RUNTIME-FULL`：role state/ledger/journal 断言随 15 files/92 tests PASS | 无；当前 facade tests 已复跑 |
| 同上 | `requestApplicationReset` | reset reason 去重、pending reset、persistence-first、failure cleanup | `kernel/base/runtime/test/reset.test.ts` | X-1/X-2、reset failure | reset 前后 runtime status、state 与 cleanup 可观察 | `CP1-RUNTIME-FULL`：reset status/state/cleanup 断言随 15 files/92 tests PASS | 无；当前 facade tests 已复跑 |
| 同上 | `subscribeState`、`commandLogger`、facade lifecycle | subscription order、unsubscribe、context fields、closed facade | `kernel/base/runtime/test/runtimeSubscription.test.ts`; `types.test.ts` | subscription 与 T-2 | listeners 收到真实状态序列，facade 关闭后行为可观察 | `CP1-RUNTIME-FULL`：subscription/context/closed behavior 断言随 15 files/92 tests PASS | 无；当前 facade tests 已复跑 |
| 同上 | `installPeerDispatchGateway` 与 returned dispatcher API | 单 gateway 安装、public/internal overload、allowNoActor 与 lifecycle surface | `kernel/base/runtime/test/peerGateway.test.ts`; `visibility.test.ts` | P-3/P-4、V-1..V-5 | facade/API 调用结果、错误与 identity 可观察 | `CP1-RUNTIME-FULL`：public surface/result 断言随 15 files/92 tests PASS | 无；当前 facade tests 已复跑 |

## 2. state persistence

| ownerSource | symbolOrTransition | responsibilityFactFromSource | testFile | testNameOrOracle | preObservation | postObservation | gapAction |
|---|---|---|---|---|---|---|---|
| `kernel/base/state/src/foundations/persistencePrimitives.ts` | `createEntryDescriptors`、keyspace helpers | field/record descriptor、storage kind、encoding、key/prefix 冲突与 migration metadata | `kernel/base/state/test/descriptor.test.ts`; `persistence.test.ts` | D-1..D-9、P-1/P-1b | registration failure 或 entry descriptor、keys、slice state 可观察 | `CP1-STATE-FULL`：5 files/69 tests PASS；descriptor/key/failure 断言通过 | 无；当前 primitive tests 已复跑 |
| 同上 | `groupEntries`、`keysForStorage` | plain/protected storage grouping 与 deterministic key selection | `kernel/base/state/test/persistence.test.ts` | P-1/P-3/P-3b | list/read/write key 集合与 hydrated state 可观察 | `CP1-STATE-FULL`：grouping/key/state 断言随 5 files/69 tests PASS | 无；当前 primitive tests 已复跑 |
| 同上 | `applyDecodedEntry`、decode/migration path | decode failure、field/record apply、old storage migration | `kernel/base/state/test/persistence.test.ts` | H/M groups、decode/migration cases | preloaded state、migration plan 与 failure 可观察 | `CP1-STATE-FULL`：decode/state/migration/health 断言随 5 files/69 tests PASS | 无；当前 primitive tests 已复跑 |
| `kernel/base/state/src/foundations/persistenceEngine.ts` | `PersistenceEngine.getHealth/subscribe`、`#updateHealth` | health revision、last failure、dirty/blocked storage 与 listener notification | `kernel/base/state/test/persistence.test.ts` | health/failure cases | `getHealth()` snapshot 与 listener event 可观察 | `CP1-STATE-FULL`：health snapshot/revision/listener 断言随 5 files/69 tests PASS | 无；当前 engine tests 已复跑 |
| 同上 | `flush`、`#flushNow`、`#writeEncoded` | changed-only write、immediate/debounce、encoding、write failure 与 health | `kernel/base/state/test/persistence.test.ts` | P-2/P-3/P-4/P-5/P-6 | storage values、dirty keys、operation result 与 health 可观察 | `CP1-STATE-FULL`：values/dirty/health/result 断言随 5 files/69 tests PASS；不以调用次数证明 | 无；当前 engine tests 已复跑 |
| 同上 | `reset`、`#resetNow`、`#removeKey` | reset/remove semantics、blocked backend、failure visibility | `kernel/base/state/test/persistence.test.ts` | reset/remove/failure cases | removed keys、state health 与 typed result 可观察 | `CP1-STATE-FULL`：removed keys/health/result 断言随 5 files/69 tests PASS | 无；当前 engine tests 已复跑 |
| 同上 | `#tryRebaseline`、cache helpers | migration rebaseline、cache/dirty/pending migration boundary | `kernel/base/state/test/persistence.test.ts` | migration and rebaseline cases | cache、pending migration、backend state 可观察 | `CP1-STATE-FULL`：cache/pending/storage result 断言随 5 files/69 tests PASS | 无；当前 engine tests 已复跑 |
| `kernel/base/state/src/foundations/createStateRuntime.ts` | `resolveSlices`、runtime validation | duplicate slice、positive timeout/debounce、storage alias validation | `kernel/base/state/test/descriptor.test.ts`; `persistence.test.ts` | D-2/D-8/D-9 | rejected runtime or created runtime state 可观察 | `CP1-STATE-FULL`：runtime rejection/state 断言随 5 files/69 tests PASS | 无；当前 runtime tests 已复跑 |
| `kernel/base/state/src/foundations/persistenceHydration.ts` 与 `createStateRuntime.ts` | `hydrateStateRuntime` integration | list/read both backends、preloaded state、engine health、migration outputs | `kernel/base/state/test/persistence.test.ts` | P-1/H/C/M cases | runtime initial state、health 与 storage results 可观察 | `CP1-STATE-HYDRATION`：preloaded state/health/migration 断言随 5 files/69 tests PASS | 无；当前 hydration tests 已复跑 |
| `kernel/base/state/src/foundations/createStateRuntime.ts` | `createStateRuntime` auto flush/sync | store change detection、debounce scheduling、sync slice listener与 cleanup | `kernel/base/state/test/persistence.test.ts`; `sync.test.ts` | P-3b/P-4/S-4..S-6 | state、storage、sync payload/dispatch result 可观察 | `CP1-STATE-FULL`：state/storage/sync result 断言随 5 files/69 tests PASS | 无；当前 runtime tests 已复跑 |

## 3. input provider

| ownerSource | symbolOrTransition | responsibilityFactFromSource | testFile | testNameOrOracle | preObservation | postObservation | gapAction |
|---|---|---|---|---|---|---|---|
| `ui/base/input/src/hooks/useInputFieldRegistry.ts` | registry register/unregister/token | live field identity、token replacement、blocked field清理、active unregister | `ui/base/input/test/snapshot.test.ts`; `provider.test.tsx` | duplicate/old cleanup、capacity | frozen snapshot、field visibility 与 active owner 可观察 | `CP1-INPUT-BASELINE`：9 files/47 tests PASS；snapshot/token/owner 断言通过 | 无；CP-1 未改变 input 执行边界 |
| 同上 | `updateValue`、`updateSelection`、`updateFieldConfig` | edit value/selection 与 keyboard config 写入 registry/controller | `ui/base/input/test/editText.test.ts`; `inputFieldOptions.test.ts`; `provider.test.tsx` | edit/option/typed value | field content、selection、layout 与 state snapshot 可观察 | `CP1-INPUT-BASELINE`：content/selection/layout 断言随 9 files/47 tests PASS | 无；CP-1 未改变 input 执行边界 |
| `ui/base/input/src/hooks/useInputFocusController.ts` | `preflightFocusTarget` | focus suspension、capacity gate、system→virtual dismiss 与 none transition | `ui/base/input/test/provider.test.tsx` | first pointer focus、owner transition、capacity | first click/native focus、owner、visible/capacity 可观察 | `CP1-INPUT-BASELINE`：首击/owner/capacity 结果断言随 9 files/47 tests PASS | 无；CP-1 未改变 input 执行边界 |
| 同上 | `handleFocus`、`handleBlur` | owner exclusive、virtual native blur side effect、system dismiss与仍由字段持有的清理 | `ui/base/input/test/provider.test.tsx` | owner both directions、native blur | 实际焦点字段、keyboard visibility、owner/state 可观察 | `CP1-INPUT-BASELINE`：双向 owner/focus/visibility 断言随 9 files/47 tests PASS | 无；不得用 dismiss 调用次数替代 |
| 同上 | `blurField`、`dismissActiveField` | explicit outside blur、system IME dismissal、blocked state reset | `ui/base/input/test/provider.test.tsx` | outside surface press | 内容收缩、active field、keyboard visibility 可观察 | `CP1-INPUT-BASELINE`：收缩/owner/field 结果断言随 9 files/47 tests PASS | 无；CP-1 未改变 input 执行边界 |
| 同上 | `focusField`、`completeField` | programmatic focus、live registration order、focus-next 与 final close | `ui/base/input/test/provider.test.tsx`; `editText.test.ts`; `virtualKeyboard.test.tsx` | complete across owners、final complete | 实际 focus target、field value/keyboard visibility 可观察 | `CP1-INPUT-BASELINE`：next-field/final-close 结果断言随 9 files/47 tests PASS | 无；preflight 覆盖必须保留 |
| `ui/base/input/src/hooks/useInputKeyboardController.ts` | `handleKeyboardKey` | virtual owner guard、applyKey result、modifier rerender、focus-next/close-only | `ui/base/input/test/provider.test.tsx`; `virtualKeyboard.test.tsx` | real complete、idle field、key routing | field content、modifier state、focus/visibility 可观察 | `CP1-INPUT-BASELINE`：key/content/focus/visibility 断言随 9 files/47 tests PASS | 无；不以 handler 调用数证明 |
| `ui/base/input/src/hooks/useInputFieldRegistry.ts` 与 `ui/base/input/src/foundations/snapshot.ts` | `captureInputSnapshot` | synchronous frozen snapshot、unregistered/replacement token semantics | `ui/base/input/test/snapshot.test.ts`; `provider.test.tsx` | snapshot boundary、typed value | capture 内容、冻结与 registration 生命周期可观察 | `CP1-INPUT-BASELINE`：capture/freeze/token 断言随 9 files/47 tests PASS | 无；CP-1 未改变 input 执行边界 |
| `ui/base/input/src/hooks/useInputFocusController.ts` 与 `ui/base/input/src/components/FocusBoundaryBridge.tsx` | boundary `notifyFocusBoundary` | suspend clears focus/owner and dismisses; restore re-enables focus | `ui/base/input/test/provider.test.tsx`; `scrollArea.test.tsx` | render layer suspend/restore | content focus、owner、keyboard visibility 与恢复后 focus 可观察 | `CP1-INPUT-BASELINE`：suspend/restore/focus 结果断言随 9 files/47 tests PASS | 无；CP-1 未改变 input 执行边界 |
| `ui/base/input/src/components/InputProvider.tsx` 与 `ui/base/input/src/foundations/keyboardHeight.ts` | `surfaceMetrics` 与 resize effect | unmeasured/width/height capacity、visible/content shrink、active infeasible cleanup | `ui/base/input/test/keyboardHeight.test.ts`; `provider.test.tsx` | first frame、resize failure、capacity decision | metrics、visible、contentHeight、blocked state 可观察 | `CP1-INPUT-BASELINE`：metrics/visibility/resize 结果断言随 9 files/47 tests PASS | 无；不以公式单独证明字段可见 |
| `ui/base/input/src/components/InputProvider.tsx` 与 `ui/base/input/src/contexts/context.ts` | controller/state contexts | stable controller surface、keyboard/field state projection、hasNextField live order | `ui/base/input/test/provider.test.tsx`; `virtualKeyboard.test.tsx` | idle rerender、next-field、capacity | rendered tree、context state、field content 可观察 | `CP1-INPUT-BASELINE`：tree/context/field 断言随 9 files/47 tests PASS | 无；CP-1 未改变 input 执行边界 |

## 4. runtime testing registry

| ownerSource | symbolOrTransition | responsibilityFactFromSource | testFile | testNameOrOracle | preObservation | postObservation | gapAction |
|---|---|---|---|---|---|---|---|
| `kernel/base/runtime/src/foundations/runtimeResourceAccessorRegistry.ts` 与 `src/testing/releaseRuntimeForTest.ts` | resource registry register/read/release | foundations 持有一个模块级 `WeakMap` 与 production register/read 原语；testing release seam 只能读取该同一 registry | `kernel/base/runtime/test/lifecycle.test.ts`; `testingAccessors.test.ts` | L-4 resource cleanup、unregistered release | createRuntime 后 test seam 能读到 resource registry；未注册 runtime release 返回 0 | `CP1-RUNTIME-REGISTRY`：resource release/unregistered 结果随 15 files/92 tests PASS；facade 不暴露 test release | 无；当前 registry tests 已复跑 |
| `kernel/base/runtime/src/foundations/runtimeResourceAccessorRegistry.ts` 与 `src/testing/releaseRuntimeForTest.ts` | release idempotence | release 清空 registry 并且重复 release 不重复清理 | `kernel/base/runtime/test/lifecycle.test.ts` | L-4 exposes module registerResource and releases each cleanup once | 注册一项 cleanup，第一次 release 返回正数且 cleanup 已执行 | `CP1-RUNTIME-REGISTRY`：第一次 cleanup 与第二次返回 0 的结果断言随 15 files/92 tests PASS | 无；当前 registry tests 已复跑 |
| `kernel/base/runtime/src/foundations/runtimeStateSyncAccessorRegistry.ts` 与 `src/testing/runtimeStateSyncForTest.ts` | state sync accessor register/read | foundations 持有 production 注册与同一 accessor；testing seam 只读取并委托 payload/apply 结果 | `kernel/base/runtime/test/requestLedgerLifecycle.test.ts` | moves real ledger payload through StateRuntime full-sync seam | source/target runtime 注册后 source payload 为 ready，target apply 有明确结果 | `CP1-RUNTIME-REGISTRY`：payload/apply/target ledger view 断言随 15 files/92 tests PASS | 无；当前 sync tests 已复跑 |
| `kernel/base/runtime/src/foundations/runtimeStateSyncAccessorRegistry.ts` 与 `src/testing/runtimeStateSyncForTest.ts` | missing accessor failure | 未注册 runtime 调用 testing seam 必须返回既有 typed error | `kernel/base/runtime/test/testingAccessors.test.ts` | missing state sync accessor | opaque runtime 未注册 accessor | `CP1-RUNTIME-ACCESSORS`：既有 `Runtime state sync test accessor is not registered` 错误断言 PASS | 无；current accessor focused test 已复跑 |
| `kernel/base/runtime/src/foundations/runtimeStateSyncAccessorRegistry.ts` 与 `src/testing/runtimeStateSyncForTest.ts` | unavailable StateRuntime failure | 已注册 getter 返回 `undefined` 时，两个 testing read/apply 操作都必须拒绝，而不是猜测状态 | `kernel/base/runtime/test/testingAccessors.test.ts` | unavailable StateRuntime read/apply | accessor 已注册但 getter 返回 undefined | `CP1-RUNTIME-ACCESSORS`：两个操作的 `State runtime is not available` 错误断言 PASS | 无；current accessor focused test 已复跑 |
| `kernel/base/runtime/src/application/createRuntime.ts` 与两个 foundations registry 及当前 testing files | production registration seam | `createRuntime` 第 47 至 48 行、第 433 至 434 行只从 foundations 注册 accessor；testing 读取侧仍观察同一 registry | `kernel/base/runtime/test/lifecycle.test.ts`; `requestLedgerLifecycle.test.ts`; `testingAccessors.test.ts` | cleanup and full-sync integration | runtime 创建后两个 testing seam 均可观察到其实际注册对象 | `CP1-RUNTIME-REGISTRY`：cleanup/full-sync/facade result 随 15 files/92 tests PASS；TR-R07 production graph PASS | 无；当前 registration seam 已复跑 |

## 5. 分母与前置结论

```text
DENOMINATOR_SOURCE=owning source AST + all owner tests
runtime dispatcher source lines=1177 across createCommandDispatcher.ts/createCommandActorDispatcher.ts/createCommandPeerDispatcher.ts; owner test files=15; owner test lines=3034
state persistence source lines=1155 across persistencePrimitives.ts/persistenceHydration.ts/persistenceEngine.ts; createStateRuntime source lines=278; owner test files=5; owner test lines=1261
input owner source lines=1913 across current components/hooks/foundations/contexts/types sources; owner test files=10; owner test lines=1280
runtime testing registry source lines=75 across two foundations registry files and two testing files; current createRuntime source lines=491 (registration symbols at 第 47 至 48 行、第 433 至 434 行); owner test files=16; owner test lines=3034
```

行数只用于本次读取完整性核对，不是拆分判据。上表当前每行均绑定至少一个结果型 behavior oracle；
若实施前重读 owning source 发现新增 symbol、状态转移、error/result discriminant 或测试族，必须先
追加行并重新确认矩阵，再改变执行边界。CP-1 的 `postObservation` 采用下列本次实际结果标识，不能
写成预期绿、调用次数、mock callback 或未运行的静态推断。

CP-3 拆分后的 input 当前职责 owner 已按实际文件回读：registry/token/value/selection/config 与
snapshot 由 `ui/base/input/src/hooks/useInputFieldRegistry.ts` 及
`ui/base/input/src/foundations/snapshot.ts` 承担；focus/blur/preflight/complete/boundary 由
`ui/base/input/src/hooks/useInputFocusController.ts` 与
`ui/base/input/src/components/FocusBoundaryBridge.tsx` 承担；keyboard key dispatch 由
`ui/base/input/src/hooks/useInputKeyboardController.ts` 承担；surface capacity/visibility 与
controller/state projection 由 `ui/base/input/src/components/InputProvider.tsx`、
`ui/base/input/src/foundations/keyboardHeight.ts` 及 `ui/base/input/src/contexts/context.ts`
共同承担。以上是同一职责分母的当前 owning-source 映射，不新增职责、不改变任何测试断言语义。

## 6. CP-1 实际 postObservation

| observationId | 当前实际结果 | 证据边界 |
|---|---|---|
| `CP1-RUNTIME-FULL` / `CP1-RUNTIME-ACTOR` / `CP1-RUNTIME-PEER` / `CP1-RUNTIME-REGISTRY` | runtime Vitest：15 个测试文件、92 个测试通过；runtime typecheck 退出码 0；对应 facade、actor、peer、registry 行的结果型断言均来自该次实际运行 | 只证明当前 runtime owner tests 的结果；不宣称 Web、Android 或 DEV 行为 |
| `CP1-RUNTIME-ACCESSORS` | `testingAccessors.test.ts` 的 3 个 accessor failure/result 测试在上述 15/92 全量运行中通过 | 观察既有错误文本、未注册 release 结果和 unavailable StateRuntime 结果，不使用调用次数代替 |
| `CP1-STATE-FULL` | state Vitest：5 个测试文件、69 个测试通过；state typecheck 退出码 0 | 只证明当前 state persistence/runtime 的结果型断言 |
| `CP1-STATE-HYDRATION` | `persistence.test.ts` 的 hydration/preloaded state/health/migration 断言在上述 5/69 全量运行中通过 | 只记录实际测试观察，不将拆分前后等价扩大为未运行的差分证明 |
| `CP1-INPUT-BASELINE` | input Vitest：9 个测试文件、47 个测试通过；input typecheck 退出码 0 | CP-1 未改变 InputProvider 执行边界；这是当前基线复跑，不是 CP-3 拆分完成证明 |
| `CP1-STATIC` | `yarn --cwd apps/terminal verify:static` runId=`ter-local-static-70634-1788782334465` 终态 PASS；model/readability/skeleton/real-static 及全既有 static sequence 均通过 | 静态门与模型夹具证据，不替代行为测试；readability rule gates 的正式 manifest 在 CP-1 仍按设计为 0 |
| `CP1-TR-R07` | `node tools/terminal-readability/check-static.mjs --rule TR-R07`：`READABILITY_RULE_GATES=1`、`RULE_TR_R07=PASS`、`READABILITY_STATIC=PASS` | 生产 graph 不可达 `src/testing`；shared foundations registry 由 accessor focused tests 观察 |

`CP1-STATIC` 的旧首败仍保留在 focused evidence：skeleton model-test 曾因迁移后仍读取
`state/src/supports/workspace.ts` 而得到 ENOENT；修复仅同步模型夹具到
`state/src/foundations/workspace.ts`，随后同一模型测试与完整 static sequence 均通过。
