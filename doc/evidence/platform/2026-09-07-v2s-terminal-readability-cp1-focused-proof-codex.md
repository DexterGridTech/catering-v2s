# TER 可读性整改 · CP-1 focused proof

`REVIEW_TARGET=IMPLEMENTATION_STEP_PROOF`
`CP=CP-1`
`evidenceMode=static + focused`

本记录只覆盖 CP-1 的 kernel/base 拆分、runtime testing graph、职责→测试矩阵和未改动
input owner 的基线复跑。没有执行 Web、Android、DEV、seed、UAT 或部署，因此不对这些
边界作已验声明。

## 1. 首败与根因

在修正迁移后的 TR-01 例外之后，受管 `verify:static` 首次重跑越过了 readability model
与 readability real static，但在 skeleton model-test 停止：

```text
Error: ENOENT: no such file or directory, open '/var/folders/.../terminal-skeleton-static-XDYANY/apps/terminal/kernel/base/state/src/supports/workspace.ts'
TERMINAL_STATIC_FIRST_FAILURE:model-test:exit=1
```

根因是 `tools/terminal-skeleton/check-static.test.mjs` 的非 Redux dispatch negative-control
仍使用迁移前路径；生产 source 已在 `apps/terminal/kernel/base/state/src/foundations/workspace.ts`。
修复只把模型夹具路径同步到当前 source，未改变 checker 规则、业务断言或生产行为。

## 2. 当前 focused 结果

### 2.1 package typecheck 与行为测试

以下命令均在当前工作区实际执行，退出码均为 0：

```text
runtime: ../../../../../node_modules/.bin/tsc --project tsconfig.json --noEmit
state:   ../../../../../node_modules/.bin/tsc --project tsconfig.json --noEmit
input:   ../../../../../node_modules/.bin/tsc --project tsconfig.json --noEmit
```

实际 Vitest 结果：

```text
runtime: Test Files 15 passed (15), Tests 92 passed (92)
state:   Test Files 5 passed (5), Tests 69 passed (69)
input:   Test Files 9 passed (9), Tests 47 passed (47)
```

runtime 还实际覆盖了 `test/testingAccessors.test.ts` 的 3 个结果型测试：未注册 resource
release、未注册 state accessor，以及 registered getter 返回 `undefined` 的既有错误结果。
这些断言观察返回值/错误，而不是 mock 调用次数或 prop 值。

### 2.2 static sequence

模型测试在路径修复后实际输出：

```text
TERMINAL_SKELETON_MODEL_TEST=PASS
```

随后 `yarn --cwd apps/terminal verify:static` 使用以下 runId 完成：

```text
runId=ter-local-static-70634-1788782334465
TERMINAL_SKELETON_MODEL_TEST=PASS
TERMINAL_CONTRACTS_STATIC_MODEL_TEST=PASS
TERMINAL_PLATFORM_PORTS_STATIC_MODEL_TEST=PASS
TERMINAL_STATE_STATIC_MODEL_TEST=PASS
TERMINAL_RUNTIME_STATIC_MODEL_TEST=PASS
TERMINAL_UI_STATE_STATIC_MODEL_TEST=PASS
TERMINAL_RENDER_STATIC_MODEL_TEST=PASS
TERMINAL_LAYERING_MODEL_TEST=PASS
TERMINAL_VERIFY_DEBUG ... "outcome":"PASS"
TERMINAL_STATIC=PASS
```

在该 sequence 中，readability model、readability real static、skeleton model/real static
及既有 contracts、platform-ports、state、runtime、display-context、ui-state、render、
layering sequence 均完成；模型红向量的 `FAIL` 行是故意的负向夹具结果，不当作生产源码失败。

单独执行 `node tools/terminal-readability/check-static.mjs --rule TR-R07` 的实际输出为：

```text
READABILITY_RULE_GATES=1
RULE_TR_R07=PASS
READABILITY_STATIC=PASS
```

该结果观察的是 production entry 的真实 TypeScript runtime graph，不把 `src/testing` 的
测试入口当作生产可达；两个 foundations registry 仍是同一 module-level `WeakMap` 的生产
注册与测试读取来源。

空 `apps/terminal/kernel/base/state/src/supports` 目录移除后，使用同一 checker 的定向
只读调用实际输出：

```text
TR_R06_KERNEL_BASE_FINDINGS=0
```

全仓强制执行 `node tools/terminal-readability/check-static.mjs --rule TR-R06` 仍有 37 个
finding；它们来自尚未执行的后续批次，因此不被 CP-1 定向结论吸收，也没有被改写成 PASS。

## 3. 当前 source 与测试分母

这些数字由 CP-1 完成后的当前文件直接读取，仅用于矩阵完整性核对，不是职责拆分判据：

```text
runtime dispatcher source: 1127 lines across
  createCommandDispatcher.ts (631)
  createCommandActorDispatcher.ts (310)
  createCommandPeerDispatcher.ts (186)
runtime owner tests: 15 files, 2978 lines

state persistence source: 1052 lines across
  persistencePrimitives.ts (236)
  persistenceHydration.ts (208)
  persistenceEngine.ts (608)
createStateRuntime.ts: 278 lines
state owner tests: 5 files, 1261 lines

InputProvider.tsx: 406 lines
input owner tests: 9 files, 1227 lines

runtime testing registry source: 75 lines across
  runtimeResourceAccessorRegistry.ts (15)
  runtimeStateSyncAccessorRegistry.ts (17)
  releaseRuntimeForTest.ts (12)
  runtimeStateSyncForTest.ts (31)
createRuntime.ts: 436 lines
```

## 4. CP-1 changed-boundary summary

- state 的 `partitioned.ts`、`sync.ts`、`workspace.ts` 已归位到 `src/foundations/`，并同步
  当前 index/README/import；模型 negative control 也使用新路径。
- runtime 的 resource/state-sync registry 已移入 `src/foundations/`；生产
  `createRuntime.ts` 只从 foundations 注册，`src/testing` 只读取同一 registry。
- runtime dispatcher 的 actor/peer dispatch 逻辑与 facade 分开；state persistence 的
  primitives、hydration 与 engine 分开；现有结果型 owner tests 全量通过。
- `apps/terminal/kernel/base/runtime/src/testing` 没有被 public root export 扩大；未升级
  production stop/dispose 能力，也未扩展 platform-ports 公共契约。

## 5. CP-1 结论边界

本记录证明 CP-1 当前 focused/static 结果可供独立三维对账读取。它不替代 fresh independent
reviewer 的阶段结论，也不把 static 或 focused 结果扩大为真实 Web、Android、DEV 或生产 bundle
行为证明。CP-1 是否能进入 CP-2，以独立 reviewer 的 `MATCHED` 为准；任何 `OPEN` 都阻断。

## 6. 独立阶段复核收口

```text
REVIEW_CYCLE_ID=TER_READABILITY_IMPLEMENTATION_CP1_2026_09_07
REVIEW_TARGET=IMPLEMENTATION_STEP_RECONCILIATION
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
ROUND_FINAL_DECISION=SELF_DECIDED
```

第一轮 fresh reviewer 的唯一 OPEN 是空 `src/supports` 目录；该目录已确认为空并移除，
随后 kernel/base 定向 `TR_R06` 为 0，完整 static sequence 以最新 runId 通过。第二轮 fresh
reviewer 对当前 source、tests、checkers、matrix 与本证据复核：source/tests/checkers 为
`MATCHED`，唯一 N 级 OPEN 是 matrix 第 98 行仍引用旧 static runId；该文档行已改为
`ter-local-static-70634-1788782334465`，与本记录第 60 行一致。此处的
`ROUND_FINAL_DECISION=SELF_DECIDED` 只表示主 agent 对第二轮 N 级证据同步 finding 的处置
结论，不冒充独立 reviewer 的 GO。

CP-1 最终三维对账结论：需求维 `MATCHED`、详设/计划维 `MATCHED`、项目记忆维 `MATCHED`；
CP-1 可进入 CP-2。该结论不代表整个 TER 专题完成，也不授权 Web、Android、DEV、seed、
UAT、生产 bundle 或部署。
