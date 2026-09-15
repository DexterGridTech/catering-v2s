# CP3/CP4 focused repair evidence — round 2

日期：2026-09-15
范围：共享 `ui.base.console-assembly` 抽取后，主 Codex 对 CP3/CP4 相关 focused proof 的重验。

## 首败与修复

第一次重验时 sample2 integration 的 focused test 为 `11/13`，两个失败分别是：

1. `integrates the shared admin console...` 找不到 `terminal.admin:login`；
2. `restores confirmed wallpaper...` 恢复后的 admin layer 为空。

根因是共享抽取时 wallpaper integration 的 `parts` 漏传了 `adminShellAssembly.parts`，导致 admin catalog entry 不在运行时 catalog 中；这同时使 hydrate pruning 丢弃 admin layer。主 Codex 将 admin shell parts 补回 integration 传给共享 assembly 的 `parts`。

## 当前 focused 结果

以下命令均从仓库根执行，结果为实际退出码：

```text
yarn workspace @catering-v2s/ui-base-console-assembly typecheck       exit=0
yarn workspace @catering-v2s/ui-integration-sample-console typecheck  exit=0
yarn workspace @catering-v2s/ui-integration-sample-wallpaper-console typecheck exit=0
yarn workspace @catering-v2s/ui-base-console-assembly test --run      exit=0
  Test Files 1 passed; Tests 3 passed
yarn workspace @catering-v2s/ui-integration-sample-console test --run exit=0
  Test Files 7 passed; Tests 35 passed
yarn workspace @catering-v2s/ui-integration-sample-wallpaper-console test --run exit=0
  Test Files 4 passed; Tests 13 passed
```

sample2 行为门在修复旧 F-A3a/F-A9 mutation 锚点后重新执行：

```text
node tools/terminal-sample2/check-behavior.mjs                       exit=0
SAMPLE2_KERNEL_BASELINE=PASS
SAMPLE2_PICKER_BASELINE=PASS
SAMPLE2_INTEGRATION_BASELINE=PASS
SAMPLE2_PRIMITIVES_BASELINE=PASS
SAMPLE2_F_A5_ADMISSION_REJECTED=PASS
SAMPLE2_F_A5_RUNTIME_RED=PASS
SAMPLE2_F_A5B_RED=PASS
SAMPLE2_F_A5D_RED=PASS
SAMPLE2_F_A2_RED=PASS
SAMPLE2_F_A2C_RED=PASS
SAMPLE2_F_A2A_RED=PASS
SAMPLE2_F_A2_SCROLL_RED=PASS
SAMPLE2_F_A2_TOKEN_RED=PASS
SAMPLE2_F_A3A_RED=PASS
SAMPLE2_F_A3B_RED=PASS
SAMPLE2_F_A7_RED=PASS
SAMPLE2_F_A7B_RED=PASS
SAMPLE2_F_A9_ADMISSION_REJECTED=PASS
SAMPLE2_RED_MUTATION_CLEANUP=PASS
```

F-A3a 现在真实变异 shared assembly 的 `renderChildren`（移除 wallpaper background），F-A9 真实变异 shared assembly 的 secondary admission 与 declared-size guard；两者不再依赖已经删除的 integration 私有实现锚点。

## 边界声明

本记录只证明 focused/typecheck/red-mutation；没有执行 Web、Metro、DEV、release APK、Android 设备、双屏冷启动、seed、UAT 或部署。因此不能推出 native、Android、Web、visual 或 release PASS。
