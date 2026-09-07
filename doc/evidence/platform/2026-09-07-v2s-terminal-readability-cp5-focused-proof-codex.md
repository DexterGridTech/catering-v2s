# TER 可读性整改 CP-5 focused proof

`REVIEW_TARGET=IMPLEMENTATION_STEP`
`CP=CP-5`
`AUTHORITY=DEXTER_IMPLEMENTATION_AUTHORIZATION`
`STATUS=FOCUSED_PROOF_PASS`

## 范围

本步实现开发期 startup 结构化诊断、14 个 per-port descriptor attach 位点、runtime/render/surface
owner 传递与终态 tracker。没有扩展 `PlatformPortBindings`、`CreatePlatformPortsInput`、`PlatformPorts`、
`LoggerPort` 或 `LogContext` 公共契约，没有改业务字段、command、actor、快照或用户交互。

按详设 §9.4，dev/prod focused 只使用 Vite compile-time define；共享
`tools/terminal-shared/react-native-vitest.setup.cjs` 未改写，没有使用临时 `global.__DEV__` 代替编译期
分支。真实 Expo/Metro production bundle、Android/Web 真实运行、DEV、seed、UAT、部署和视觉验收未获授权，
本证据不将它们写成 PASS。

## 实施观察

- `createPlatformPorts.ts` 持有 private startup tracker；`createLogger`、`scope`、`withContext` 共享同一
  `startupRunId` 与 sequence。startup group 只有 sink/console 写入成功后才登记，`startup.failed` 是终态，
  `startup.complete` 由 declared+measured surface pair 与六个普通 group 成功后 guarded 写出。
- 14 个真实 attach 位点统一使用
  `Symbol.for('catering-v2s.platform-ports.descriptor')`，descriptor 和 capabilities/entry 冻结，sidecar
  非枚举、不可写、不可配置；partial-real 的 Android/Web device 按 capability 表达，不调用端口、不比较
  defaults identity，不向三个公共 PlatformPorts 类型添加 provenance。
- runtime 从已有 module descriptors、slice definitions、command descriptors、actor registry 产生四组
  startup 事实；render 从已有 `uiCatalog.entries` 与 `rendererCatalog.resolve` 产生 parts 事实；
  `InputSurfaceFrame` 的真实 pointer View `onLayout` 产生 measured frame，sample-console 只负责 declared
  baseline 与日志转发。
- `apps/terminal/terminal-env.d.ts` 是唯一 ambient `__DEV__` 声明，`tsconfig.base.json` 纳入它；两个
  focused Vitest config 用 Vite post plugin 在模块导入前注入 `true`/`false`。
- 为保持已启用 TR-R02/TR-R04/TR-R05 全树门闭合，8 个 unavailable singleton 改为定义处 export，
  `createLogger` 与 startup helper 按职责拆分为最多三参数、控制流深度不超过三层；既有 logger 与
  unavailable 行为未改变。

## 首次失败与根因修复

1. 初次从仓根直接调用 `vitest` 时命令不存在；这是错误执行入口，不是源码失败。改用 package-owned
   `yarn exec vitest` 并传入 `tools/terminal-readability/vitest.{dev,prod}.config.ts`。
2. descriptor checker 首次把 `Object.defineProperty` 第三参数误当作冻结值；源码的冻结 descriptor 在该
   对象的 `value` 属性内。修正 AST 取值后继续运行。
3. descriptor checker 随后未识别 TypeScript shorthand property，导致实际 `.map` capability entry 与
   `port` 参数被误报。扩展通用 AST property 读取后，错误 key 与缺 capability fixture 均按预期变红。
4. 真实六道 L 门首次暴露 8 个末尾 export 汇总块、`createLogger` 四参数与三处深控制流。分别按
   TR-R02 定义处导出、options 对象/独立 startup helper、职责拆分修复；没有放宽 checker。

## 真实 focused 输出

### CP-5 startup dev/prod focused

在 `apps/terminal/kernel/base/platform-ports` 使用 package-owned command：

```text
yarn exec vitest run --config ../../../../../tools/terminal-readability/vitest.dev.config.ts --reporter verbose
Test Files  4 passed (4)
Tests       6 passed (6)

yarn exec vitest run --config ../../../../../tools/terminal-readability/vitest.prod.config.ts --reporter verbose
Test Files  4 passed (4)
Tests       5 passed | 1 skipped (6)
```

dev 观察了 correlated startup sequence、同 runId/sequence、14 位点 descriptor 摘要、runtime 四组事实、
render catalog/missing renderer 事实、首帧未测量与真实 `onLayout` 同尺寸去重。prod 对同一入口集合确认
startup 分支不产生事件；dev-only 测试按 compile-time false 分支 skip，不以环境参数伪造结果。
输出中的 `react-test-renderer is deprecated` 是既有测试运行时 warning，不影响 exit code；未把它升级成
Web/Android 真实渲染证据。

### 既有 platform-ports focused tests

```text
yarn exec vitest run --reporter verbose
Test Files  5 passed (5)
Tests       17 passed | 1 skipped (18)
```

既有 logger、defaults、success semantics、platform root assembly 均通过；root 仍保留十个 binding、
identity 与冻结边界。

### startup descriptor checker 与模型红向量

```text
node tools/terminal-readability/check-static.test.mjs
MODEL_TR_R02=PASS
MODEL_TR_R03=PASS
MODEL_TR_R04=PASS
MODEL_TR_R05=PASS
MODEL_TR_R06=PASS
MODEL_TR_R07=PASS
MODEL_RD12=PASS
MODEL_RD13=PASS
MODEL_RD14=PASS
MODEL_RD09_RD11=PASS
MODEL_RD06_DESCRIPTOR=PASS
READABILITY_MODEL=PASS

node tools/terminal-readability/check-static.mjs
READABILITY_RULE_GATES=6
RULE_TR_R02=PASS
RULE_TR_R03=PASS
RULE_TR_R04=PASS
RULE_TR_R05=PASS
RULE_TR_R06=PASS
RULE_TR_R07=PASS
READABILITY_STATIC=PASS

node tools/terminal-readability/check-static.mjs --startup
STARTUP_DESCRIPTOR_ATTACH_SITES=14
STARTUP_DESCRIPTOR=PASS
```

`check-static.test.mjs` 使用与真实 checker 相同的 TypeScript AST 实现：错误 Symbol key、缺一项 capability
各自造成 fixture finding；negative control 全部通过。`--startup` 真实树扫描覆盖 1 个 logger、8 个
unavailable singleton、1 个 process-memory factory、2 个 Android factory、2 个 Web factory，fixture
不计入 14 个真实位点分母。

### 全终端 focused verification

```text
yarn --cwd apps/terminal typecheck
Tasks: 27 successful, 27 total
exit=0

yarn --cwd apps/terminal test
Tasks: 20 successful, 20 total
exit=0

yarn --cwd apps/terminal lint
Tasks: 0 successful, 0 total
exit=0
WARNING No tasks were executed as part of this run.
```

lint 只证明命令成功且当前 Turbo 没有执行任务，不冒充 lint 规则已运行。

## 证据边界与阶段结论

以上证据属于 TypeScript typecheck、package tests、Node AST/model/static 和 node-only React focused
evidence。它证明了 CP-5 的 startup tracker、descriptor 协议、owner focused seam、dev/prod compile-time
分支与全树 L 门当前结果；它不证明真实 Expo/Metro DCE、Android 真启动/副屏输入、Web 真实 pointer、
四种布局视觉结果、DEV、seed、UAT 或部署。

`CP-5_FOCUSED_PROOF=PASS`。进入 CP-6 前仍须由 fresh 独立子 agent 对 CP-5 做阶段三维对账；任何
`OPEN` 必须由主 agent 根因修复并 fresh 复查。

## CP-5 阶段三维独立对账

```text
REVIEW_CYCLE_ID=TER_READABILITY_IMPLEMENTATION_2026_09_07
REVIEW_TARGET=IMPLEMENTATION_STEP_RECONCILIATION
REVIEW_ROUND=2/2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
ROUND_FINAL_DECISION=SELF_DECIDED
CP5_RECONCILIATION=MATCHED
M/S/N=0/0/0
```

fresh 独立 reviewer 只读重开了需求、详设、实施计划、项目记忆、CP-5 focused proof 与当前 owning
source，未修改源码、测试或文档。首轮唯一 S finding 认为 `sample-console` 的 declared surface
baseline 在 render body 登记可能记录 abandoned render；第二轮定向复核以原文为准判定
`REJECTED_WITH_EVIDENCE`：详设明确要求在每个实际创建 `SurfaceInputFrame(displayMode)` 之前登记
declared baseline，当前实现满足该时序；measured 仍只来自真实 `InputSurfaceFrame.onLayout`，没有把
declared 冒充 measured。

其余核验项均无 finding：14 个 descriptor attach、partial-real capability、公共 platform-ports 契约、
production graph 对 `src/testing` 的不可达性、owner startup facts、终态与序列关联、真实测量 seam、
compile-time dev/prod focused harness，以及 TR-R02/R04/R05/R06/R07 的 checker/red fixture/negative
control 均与详设 MATCHED。Web、Android、生产 DCE、DEV、seed、UAT 与部署仍按授权边界 NOT_RUN，未被
阶段对账升格为已验事实。

## CP-6 修复后真实复验绑定

CP-6 第二轮提出的两个证据绑定缺口已由主 agent 以当前实际输出补齐；以下只引用完整结束的
run，不引用此前并行启动但输出未完整收集的那次调用。

```text
runId=ter-local-static-31864-1788793081817

yarn --cwd apps/terminal/ui/base/input test
Test Files  10 passed (10)
Tests       48 passed (48)
TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/ui-base-input

yarn --cwd apps/terminal verify:static
TERMINAL_VERIFY_DEBUG {"schemaVersion":1,"event":"verify-static.finish","runId":"ter-local-static-31864-1788793081817","outcome":"PASS"}
TERMINAL_STATIC=PASS
```

该 run 的静态输出同时包含 `READABILITY_MODEL=PASS`、六条 L 规则门 PASS、
`TERMINAL_SKELETON_MODEL_TEST=PASS` 与 `TERMINAL_SKELETON...=PASS`。输入包输出中的分母是
当前真实 package test run 的 10 个 test files 与 48 个 tests；它不以调用次数、prop 值或
mock callback 证明行为。CP-6 前置修复后的 InputSurfaceFrame focused oracle 观察了 360x640
首帧、重复同尺寸去重和 420x700 尺寸变化，详见
`apps/terminal/ui/base/input/test/InputSurfaceFrame.measurement.dev.test.tsx`。
