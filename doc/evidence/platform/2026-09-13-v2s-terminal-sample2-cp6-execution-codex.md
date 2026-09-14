# TER sample2 壁纸终端 CP-6 执行证据

- `RUN_ID`: `ter-sample2-cp6-20260913-01`
- `SCOPE`: dual-screen Android adapter 的形态判定、launch options、configuration freeze、
  display snapshot 分支与两台 TER Android VM 的载体/清理验证。该步骤不声称 sample2
  wallpaper assembly、壁纸 UI、视觉像素或业务旅途已经通过。
- `STATUS`: `MATCHED`
- `AUTHORITY`: Dexter 已授权 sample2 实施与动态验收；本步骤使用 TER 自有 sample-terminal
  与直接 `adb`/Gradle 验证，未使用后台 DEV、seed、UAT、部署或 Git。
- `EXECUTED_AT`: `2026-09-13 21:01-22:16 +09:00`

## 首败与根因修复

1. 初次 native 重跑使用了模糊的 Gradle 前缀
   `:catering-v2s-adapter-android:testDebugUnitTest`，Gradle 报项目名歧义并列出
   `catering-v2s-adapter-android-dual-screen` 等候选；该命令未进入测试编译，不是源码
   行为证据。随后改用完整项目名 `:catering-v2s-adapter-android-dual-screen:testDebugUnitTest`。
2. 完整项目名重跑后暴露 Kotlin 2.1.20 不接受生产代码中的 synthetic Java property
   method reference：`displays.map(Display::displayId)`。根因修复为等价且兼容的
   `displays.map { it.displayId }`，没有改变 display snapshot 的选择语义。
3. 首次 CP-6 独立步骤审查指出 `readDisplaySnapshot` 只有最终 surface 载体证据，缺少
   primary-only、snapshot 缺失、正常双屏和读取失败的返回形状覆盖；同时 Android cleanup
   没有逐 serial 的进程缺失证明。主 agent 抽出生产 helper 并补四类 native 测试，随后对
   两个已确认拥有的 runtime 资源分别执行精确 cleanup。

## 实际 native 结果

| 检查 | 实际边界 | 结果 | 原始记录 |
| --- | --- | --- | --- |
| dual-screen native unit | 完整 Gradle project `:catering-v2s-adapter-android-dual-screen:testDebugUnitTest --no-daemon` | Gradle `BUILD SUCCESSFUL`，当前测试文件 16 个 `@Test`，主命令 exit `0` | `/tmp/ter-sample2-cp6-native-test-after-snapshot-helper-fix.log` |
| display snapshot branch proof | `readDisplaySnapshotSelection` 的 primary-only、正常双屏、manager unavailable、read failure | 4 分支均有明确返回/原因断言 | `apps/terminal/adapter/android/dual-screen/android/src/test/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalSurfaceHostActivityHandlerTest.kt` |
| dual-screen red control | classifier branch mutation 与 snapshot selection mutation | baseline PASS；两个 mutation 均按预期 RED；source cleanup PASS | `/tmp/ter-sample2-cp6-native-behavior-after-snapshot-helper.log` |

生产锚点：

- `TerminalDualScreenActivityHandler.kt:102-118` 的
  `readDisplaySnapshotSelection` 返回 `Ready(displayCount, secondaryDisplayIndex)` 或具名
  `Unavailable` 原因。
- `TerminalDualScreenActivityHandler.kt:550-583` 的 `readDisplaySnapshot` 从当前
  `DisplayManager` 列表构造 display id，再调用该 helper，并把已选 secondary index 映射回
  当前列表；不存在第二套 display snapshot 选择逻辑。
- `TerminalSurfaceHostActivityHandlerTest.kt:86-107` 覆盖 primary-only、正常双屏、
  manager unavailable、read failure；`TerminalSurfaceHostActivityHandlerTest.kt:111-150`
  覆盖已冻结形态对后续 configuration 值不重算以及 primary/secondary 使用同一 Bundle helper。
- `/tmp/ter-sample2-cp6-native-behavior-after-snapshot-helper.log:1-4` 为真实控制器输出：
  `TERMINAL_DUAL_SCREEN_BASELINE=PASS`、classifier mutation RED、snapshot mutation RED、
  `TERMINAL_DUAL_SCREEN_CLEANUP=PASS`。

native 测试日志本身没有由 wrapper 写入 `NATIVE_TEST_EXIT=0` 行；本地执行器观察到该完整
Gradle 命令 exit `0`，且日志中有 `BUILD SUCCESSFUL`。二者分别记录，不能把测试名称或
Gradle 成功替代更高档位的设备行为证明。

## 两台 Android VM 的实际观察

| serial | 设备边界 | 观察结果 | 原始记录 |
| --- | --- | --- | --- |
| `emulator-5554` | Pixel Tablet / 双屏 laptop carrier | `smallestScreenWidthDp=800`，决策 `laptop`；display count 2，secondary display id 2；host/snapshot ready；secondary start completed | `/tmp/ter-sample2-cp6-emulator-5554-metro-final.log` |
| `emulator-5556` | Android phone / mobile carrier | `smallestScreenWidthDp=360`，决策 `mobile`；display count 1；无 secondary；方向锁定后主 surface 为 720×1280 portrait | `/tmp/ter-sample2-cp6-emulator-5556-metro-final.log` |

首个 preflight 的阈值计算为 `floor((360 + 800) / 2) + 1 = 581`。这两份日志验证的是
`sample-terminal` 对已实施 dual-screen adapter 的载体路径，不是 sample2 assembly 的
wallpaper 业务验收；CP-7 会重新验证 sample2 入口、catalog、壁纸与完整旅途。

## Cleanup 证据

应用进程使用精确 package `com.anonymous.sampleterminal`，按两个明确 serial 分别停止并
再次读取 `pidof` 与 resumed activity：

- `/tmp/ter-sample2-cp6-android-cleanup-final.log:3-9`：`emulator-5554` PID `31508 -> none`，
  resumed `none`；`emulator-5556` PID `7547 -> none`，resumed `none`；`APP_CLEANUP=PASS`。
- 本次 TER Metro 的拥有 root PID 为 `65287`，精确关联的 Expo/NativeWind/devtools PID 为
  `65296`、`65353`、`65039`。首次 SIGINT 未清除，failure 与 PID/PPID/PGID/完整命令保留在
  `/tmp/ter-sample2-cp6-metro-cleanup-final.log:1-11`；完成边界诊断后仅对这四个已确认拥有
  的 PID 发 TERM，`REMAINING_AFTER_TERM=none`、`METRO_CLEANUP=PASS` 在同一文件
  `:13-21`。

应用 cleanup 与 Metro cleanup 分开记录；未按端口、模糊命令或未知 AVD 停止资源。

## 步骤级独立对账

`REVIEW_CYCLE_ID=TER-SAMPLE2-IMPLEMENTATION-20260913`  
`REVIEW_TARGET=IMPLEMENTATION`  
`REVIEW_ROUND=2`  
`REVIEW_ROUND_LIMIT=2`  
`reviewerKind=INDEPENDENT_SUBAGENT`  
`ROUND_FINAL_DECISION=SELF_DECIDED`

- reviewer：Kierkegaard（agent `01a09ae1-13af-7e11-8c0f-288d4189d71a`）。
- 初轮发现：缺少 `readDisplaySnapshot` 逐分支 native 覆盖，且没有 Android cleanup 的精确
  进程缺失证据。
- 主 agent 抽出 helper、补四分支测试、修复 Kotlin 兼容写法、完成 native baseline 与双
  mutation 后，又完成两台 emulator 的 app cleanup 及已拥有 Metro tree 的 cleanup。
- reviewer 以只读源码与日志复核当前字节，确认 helper 由生产路径调用、四分支与 16 项
  native test 证据存在、两台 app PID/前台状态消失、Metro 精确 PID 清理完成。
- `CP6_STEP_VERDICT=MATCHED`。

## 未执行与证据边界

CP-6 未执行 sample2 wallpaper assembly 的 Web/Android UI、壁纸 ROI、三张图差异、浮层/状态
恢复、A1-A9 全量业务旅途或 visual/release 验收；这些属于 CP-7/CP-8/CP-9 的后续范围。
CP-6 的 Android runtime 只证明 adapter carrier 的形态、display snapshot、launch options、
freeze 与 cleanup，不提升 sample-terminal 的历史行为为 sample2 业务 PASS。
