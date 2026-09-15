# CP-3 / CP-4 focused repair evidence

- 日期：2026-09-15
- 执行者：主 Codex
- 范围：当前源码的 focused/static 复核；不包含 Web、Metro、DEV、Android 设备或 release 动态。
- 本记录不能替代 fresh stage reconciliation；对应独立报告必须另存并引用本记录。

## CP-3 修复控制

sample2 startup surface producer 已在当前源码投影出明确的 `kind`：

- `apps/terminal/ui/integration/sample-wallpaper-console/src/assembly/assembly.tsx`
  对 `startup.surfaces.declared` 写入 `kind = declared`；
- 同一 producer 对 `startup.surfaces.measured` 写入 `kind = measured`。

命令：

```text
yarn workspace @catering-v2s/ui-integration-sample-wallpaper-console test --run
```

结果：`Test Files 4 passed (4)`、`Tests 13 passed (13)`、
`TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/ui-integration-sample-wallpaper-console`。

命令：

```text
yarn workspace @catering-v2s/ui-integration-sample-wallpaper-console typecheck
```

结果：本轮 typecheck exit 0。

## CP-4 focused 控制

命令：

```text
yarn workspace @catering-v2s/ui-feature-sample-wallpaper-picker test --run
```

结果：`Test Files 3 passed (3)`、`Tests 14 passed (14)`、
`TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/ui-feature-sample-wallpaper-picker`。

这组真实 package tests 包含 `test/pickerSystemFailure.test.ts` 的 runtime child-command
injection：先写入 pending/confirmed readback，再由 child command 抛 typed system error，
断言 parent error/state/notice 与 write phase；不是只断言 rejected Promise。

命令：

```text
node tools/terminal-sample2/check-behavior.mjs
```

结果：

- `SAMPLE2_KERNEL_BASELINE=PASS`
- `SAMPLE2_PICKER_BASELINE=PASS`
- `SAMPLE2_INTEGRATION_BASELINE=PASS`
- `SAMPLE2_PRIMITIVES_BASELINE=PASS`
- 所有 `SAMPLE2_F_*` admission/behavior/component-contract red mutation 均为 `PASS`，mutation exit 为 1；
- `SAMPLE2_RED_MUTATION_CLEANUP=PASS`。

## 横切 focused controls

```text
node tools/terminal-sample2/check-native-projection.test.mjs
```

结果：native projection baseline、app.json drift、private config diff、native resource hash
drift、App asset hash drift、empty discovery intersection 五个 red mutation 及 cleanup 均 `PASS`。

```text
node tools/terminal-sample2/check-production-bundle.test.mjs
```

结果：production bundle fixture baseline、automation token red、test injection token red 与
cleanup 均 `PASS`。这仍是 fixture red control；两个真实 release APK 的 scan 留待 U8 build
之后，未在本记录中升级为 release PASS。

```text
node tools/terminal-sample2/check-startup-diagnostics.mjs
```

结果：startup diagnostics baseline、duplicate guard、surface identity、run ID propagation
三个 red mutation 与 cleanup 均 `PASS`。

## 边界

本记录证明当前 focused implementation controls 可回放，不证明 sample2 冻结 acceptance、
release splash 时序、真实双屏冷启动、R-S7 设备失败页、Web 或最终 cleanup 已通过；这些仍
必须按计划在 fresh whole-scope 与 code↔design 前置之后分别执行并分档记录。
