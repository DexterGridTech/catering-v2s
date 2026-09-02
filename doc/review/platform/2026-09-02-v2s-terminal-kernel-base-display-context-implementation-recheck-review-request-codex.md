# TER `kernel.base.display-context` S-1/S-2/N-1 implementation recheck brief

Dexter，请将以下 brief 原样转交 Claude，按仓内独立 IMPLEMENTATION review 规范执行。

## 背景与本轮目标

DC-P0～DC-P5 已完成。上一轮静态 IMPLEMENTATION review 为 `GO 0/2/3`，指出：

- S-1：`switchDisplayRole` 的多物理屏 VICE 拒绝没有直接行为红向量；
- S-2：生产没有 `Runtime` stop/dispose，`registerResource` 只有 test-only drain；
- N-1：bridge 尾部关于 disposer 闭包可达性的注释与事实不符。

本轮已在既有授权范围内闭合三条：新增真实 actor/command 子场景，登记生产 teardown 欠账并修正注释；
没有新增 runtime 公共字段、生产 stop/dispose、adapter/native 或设备行为。

`REVIEW_TARGET=IMPLEMENTATION`
`REVIEW_CYCLE_ID=TER_DISPLAY_CONTEXT_IMPLEMENTATION_RECHECK_2026_09_02`
`REVIEW_ROUND=2`
`REVIEW_ROUND_LIMIT=2`
`reviewerKind=INDEPENDENT_SUBAGENT`

## 请读取的材料（仓根相对路径）

需求、详设、计划与先前证据：

- `doc/plans/platform/2026-09-01-v2s-terminal-kernel-base-display-context-requirements-claude.md`
- `doc/plans/platform/2026-09-02-v2s-terminal-kernel-base-display-context-implementation-design-codex.md`
- `doc/plans/platform/2026-09-02-v2s-terminal-kernel-base-display-context-implementation-plan-codex.md`
- `doc/evidence/platform/2026-09-02-v2s-terminal-kernel-base-display-context-implementation-evidence-codex.md`
- `doc/evidence/platform/2026-09-02-v2s-terminal-kernel-base-display-context-s1-s2-n1-recheck-evidence-codex.md`

本轮源码与 handoff：

- `apps/terminal/kernel/base/display-context/test/behavior.test.ts`
- `apps/terminal/kernel/base/display-context/src/foundations/displayDerivation.ts`
- `apps/terminal/kernel/base/display-context/src/features/actors/switchDisplayRoleActor.ts`
- `apps/terminal/kernel/base/display-context/src/application/createPowerStatusBridge.ts`
- `apps/terminal/kernel/base/display-context/HANDOFF.md`
- `apps/terminal/kernel/base/runtime/src/types/execution.ts`
- `apps/terminal/kernel/base/runtime/src/foundations/createCommandDispatcher.ts`
- `apps/terminal/kernel/base/display-context/test/testSupport.ts`

门与接线、规范与记忆：

- `tools/terminal-display-context/`
- `tools/terminal-skeleton/verify-static.mjs`
- `tools/terminal-skeleton/verify.test.mjs`
- `apps/terminal/kernel/base/{contracts,platform-ports,state,runtime}/terminal-invariants.json`
- `doc/platform/terminal-coding-standard.md`（TR-01/TR-02/TR-04/TR-09/TR-10/TR-11）
- `project-memory/decisions/terminal-architecture-and-stack-rulings.md`
- 当前六维路由命中的项目记忆与 `scripts/README.md`

## 本轮改动与事实边界

### S-1：多屏 `switchDisplayRole` 直接行为覆盖

`behavior.test.ts:79-105` 在既有 A-3 测试内加入第二个子场景：

1. 用 fake device 建 runtime 并先切到 `SLAVE`；
2. 将 live `displayCount` 设为 `2`；
3. 通过 `switchDisplayRoleCommand`、`VICE`、`PRIMARY` route 走真实 actor；
4. 断言 command/actor 为 `error`、最终 slice 仍为 `CHIEF`、`getDisplayInfo` 被再次实时调用；
5. 对同一个输入对拍 `getDisplayRoleChangeEligibility`，断言
   `reasonCode='multiple-physical-displays'`。

runtime 的公开 `LedgerError` 只保留稳定的 key/code/message/category/severity，不暴露 `AppError.details`；
因此没有扩大 runtime 公共契约，reasonCode 在策略边界断言，命令断言负责证明 actor 实际拒绝写入。
测试声明数量仍为 55（A-3 增加子场景，不新增 `it` 分母）。

当前 test 目录内 `multiple-physical-displays` 恰有两处：

- `test/derivation.test.ts:115`：原有 `switchInstanceMode` 纯策略用例；
- `test/behavior.test.ts:104`：本轮 `switchDisplayRole` actor/command 用例。

守卫实现仍是 `displayDerivation.ts:31` 的 `input.displayCount !== 1`。

### S-2：选择登记欠账，不扩建生产生命周期

按当前授权与分钟级简单性边界，选择“登记欠账”路线，而不是自造 Runtime teardown：

- `HANDOFF.md:11-12` 明写 production 没有 stop/dispose；
- `registerResource` 当前唯一 drain 是 test-only `releaseRuntimeForTest`；
- 生产订阅依赖进程退出回收；test-only release 只证明本地失活与 unsubscribe 调用发起；
- 未新增 stop/dispose、生产 release API、回调总线或第二套 registry。

### N-1：注释改为事实描述

`createPowerStatusBridge.ts:150-153` 已删除“disposer 由闭包保持可达”的错误描述，改为说明：
registry 当前仅由 test-only release drain，生产无 stop/dispose，进程退出回收原生订阅，disposer 暂不调用。

## 新鲜运行证据

### S-1 红/绿翻转（package-local cwd）

命令：

```text
../../../../../node_modules/.bin/vitest run --config vitest.config.ts test/behavior.test.ts -t "A-3 switchDisplayRole rejects VICE when display info is unavailable"
```

未变异守卫（绿）：

```text
Test Files  1 passed (1)
Tests  1 passed | 21 skipped (22)
Duration  313ms
```

仅将 `displayCount !== 1` 改为 `< 0`（红）：

```text
❯ test/behavior.test.ts (22 tests | 1 failed | 21 skipped) 21ms
FAIL test/behavior.test.ts > display-context command actors > A-3 switchDisplayRole rejects VICE when display info is unavailable
AssertionError: expected 'completed' to be 'error' // Object.is equality
Expected: "error"
Received: "completed"
❯ test/behavior.test.ts:91:32
```

恢复 `displayCount !== 1`（绿）：

```text
Test Files  1 passed (1)
Tests  1 passed | 21 skipped (22)
Duration  313ms
```

该红向量的失败点是 command 从拒绝变成成功，非旁路纯函数断言。

### Package focused proof

```text
yarn workspace @catering-v2s/kernel-base-display-context typecheck
yarn workspace @catering-v2s/kernel-base-display-context test
```

退出码 0；4 test files、55 tests PASS；
`TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/kernel-base-display-context`。

### TER-local `verify:static`

runId=`ter-local-static-91731-1788308466425`，退出码 0，`TERMINAL_STATIC=PASS`。
六个 skeleton gate、四个 contracts gate、四个 platform-ports gate、四个 state gate、五个 runtime gate、
四个 display gate 及 support 均 PASS；display 四条既有 machine red vector 仍为目标独红。

### TER-local `verify`

runId=`ter-local-92410-1788308509561`，退出码 0，关键输出：

```text
TERMINAL_STATIC=PASS
TERMINAL_TURBO_DRY_TYPECHECK=PASS packages=22 tasks=22 executable=22
TERMINAL_TURBO_DRY_TEST=PASS packages=22 tasks=22 executable=10
TERMINAL_TURBO_DRY_LINT=PASS packages=22 tasks=22 executable=0
TERMINAL_TURBO_DRY_CLEAN=PASS packages=22 tasks=22 executable=0
TERMINAL_TEST_MARKERS=PASS real=5 noTests=5
Android Bundled 1656ms apps/terminal/assembly/android/pos-desktop/index.ts (730 modules)
TERMINAL_VERIFY_CLEANUP=PASS
TERMINAL_VERIFY=PASS
```

Expo export 仅证明 Metro/JS 入口消费闭包，不证明 native、Gradle、autolinking、真实设备或 adapter 能力。

## Fresh 独立对账输入

本轮修复后已由 fresh 独立子 agent 只读三维对账：

```text
REVIEW_TARGET=IMPLEMENTATION
SCOPE=TER_DISPLAY_CONTEXT_S1_S2_N1_RECHECK
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
VERDICT=GO
M=0 S=0 N=0
```

该子 agent 未运行命令；动态结论以上述 evidence 为准。

## 请独立核验并返回的内容

请不要把作者 brief 或上轮静态 GO 当作权威，重新打开当前字节并判断：

1. `multiple-physical-displays` 是否正好两处，第二处是否确实由 `switchDisplayRoleCommand` 的 actor 场景触发，
   且守卫变异红、恢复绿；reasonCode 的策略边界断言是否足以避免扩大 runtime 契约；
2. S-2 是否诚实登记为生产 teardown 欠账，`registerResource` 是否仍只有 test-only drain，是否有任何越权的生产
   stop/dispose 或第二套 cleanup 机制；
3. bridge 注释是否已与生产可达路径一致；N-2（persistDisplayRole 软失败）与 N-3（MASTER eligibility 分工）
   是否保持未改；
4. 是否还能构造“所有门/测试/TER-local verify 都绿但 switchDisplayRole 多屏 VICE 仍成功”、
   “生产订阅被误称为可释放”或“注释/文档制造虚假 teardown”路径；
5. 静态、typecheck、TER-local、Expo 证据是否被错误升级为 native/Gradle/device/adapter/browser/DEV/seed/reset/UAT/deploy。

请按以下格式返回：

```text
REVIEW_TARGET=IMPLEMENTATION
VERDICT=GO 或 NO-GO
M=<major> S=<significant> N=<note>
```

每条 finding 写精确路径/行号、仓内事实或推论、可证伪失败条件、最小修复，并标记
`CONFIRMED / PARTIALLY_CONFIRMED / REJECTED_WITH_EVIDENCE / UNVERIFIED_REQUIRES_EVIDENCE / DEXTER_DECISION`。
若本轮仍有阻断，明确说明是否阻断本包收口；若没有，明确哪些动态/native/设备边界仍为
`UNVERIFIED_REQUIRES_EVIDENCE`。

## 授权边界

本 brief 只请求 display-context S-1/S-2/N-1 的 IMPLEMENTATION recheck，不授权修改源码、
继续单元 B、开始下一个 owner 包、运行仓级 normal verify、native/Gradle/设备、DEV、seed、reset、
browser L2、UAT、部署或数据操作。S-2 的生产 stop/dispose 是否建设仍由 Dexter 后续裁定；
本轮选择登记欠账，不自行扩建生命周期。
