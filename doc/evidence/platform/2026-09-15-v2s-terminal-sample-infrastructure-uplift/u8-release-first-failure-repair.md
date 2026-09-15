# U8 release 冷启动首败与最小修复

## 范围

- 工具：`tools/terminal-sample2/run-u8-release-cold-start.mjs`
- 首次运行：`u8-release-cold-start`
- 目标：release APK、mobile 与 dual 形态、冷启动、开机画面与 startup 事件的记录式观察。
- 该记录不把首次业务失败提升为 PASS；它保留首败、源码边界和 cleanup 结果。

## 首败

首次命令为：

```text
node tools/terminal-sample2/run-u8-release-cold-start.mjs --phone-serial emulator-5556 --dual-serial emulator-5554 --output doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/u8-release-cold-start
```

首次汇总为 `TERMINAL_U8_RELEASE_COLD_START=FAIL CLEANUP=PASS`。四个 profile 的首败分别是：

1. mobile 两个 profile：`could not prove native splash remained visible before ready`。
2. dual 两个 profile：`startup event order is not candidate<=hidden<=complete`。

原始 `result.json` 已保留在首次运行目录。其时间线同时记录了 `splashVisibleBeforeReady=true`，但 mobile profile 的 `preReadyCaptured=false`；dual profile 的实际 release log 已同时出现 candidate、complete、ready-hidden，且 secondary surface 也已出现。

## 根因定位

1. runner 在首次 logcat 轮询前已经捕获 `window-immediate-after-launch.txt`。release 启动很快时，ready-candidate 会在第一轮读取中出现，旧代码于是跳过 `preReadyCaptured`，把已经存在的 immediate 快照当作未捕获。这是 runner 的证据采集 bug，不是生产代码证明失败。
2. `apps/terminal/ui/base/console-assembly/src/foundations/consoleAssembly.tsx` 的生产路径先通过共享 writer 写 `startup.complete`，再由 platform port 记录 `startup.ready-hidden`。旧 runner 强制 `candidate <= hidden <= complete`，与当前真实生产记录顺序不等价；需求只要求开机画面收起发生在 ready candidate 之后，并不要求两个独立诊断事件构成该人为全序。

## 最小修复

`tools/terminal-sample2/run-u8-release-cold-start.mjs`：

- 用 `splashVisible(immediateWindow)` 初始化 `preReadyCaptured`，使 immediate snapshot 成为合法的首个 ready 前观察；
- 将事件时序断言收窄为 `candidate <= complete` 且 `candidate <= hidden`，不改变生产事件顺序，也不以 parser 去重或等待掩盖失败；
- 保留每次运行的原始 logcat、window/activity 快照、截图、UI readback、结果与 cleanup。

## 重验入口

修复后必须以新的输出目录执行：

```text
node --check tools/terminal-sample2/run-u8-release-cold-start.mjs
node tools/terminal-sample2/run-u8-release-cold-start.mjs --phone-serial emulator-5556 --dual-serial emulator-5554 --skip-build --output doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/u8-release-cold-start-rerun-01
```

## 重验结果

重验使用已生成的 release APK（`--skip-build`），并写入新的输出目录：

```text
node tools/terminal-sample2/run-u8-release-cold-start.mjs --phone-serial emulator-5556 --dual-serial emulator-5554 --skip-build --output doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/u8-release-cold-start-rerun-01
```

结果为 `TERMINAL_U8_RELEASE_COLD_START=PASS CLEANUP=PASS`。四个 profile 均 `business=PASS`、`cleanup=PASS`、`firstFailure=null`：

| profile | 形态 | ready 前 splash | startup 事件 | secondary surface | cleanup |
| --- | --- | --- | --- | --- | --- |
| sample-terminal-mobile | mobile | `true` | candidate `1789435535.843`；complete `.845`；hidden `.847` | 不适用 | PASS |
| sample-terminal-dual | dual | `true` | candidate `1789134976.140`；complete `.144`；hidden `.149` | `true` | PASS |
| sample-wallpaper-terminal-mobile | mobile | `true` | candidate `1789435547.148`；complete `.155`；hidden `.160` | 不适用 | PASS |
| sample-wallpaper-terminal-dual | dual | `true` | candidate `1789134987.290`；complete `.295`；hidden `.308` | `true` | PASS |

每个 profile 的 `result.json`、logcat、window/activity 快照、UI readback 和 primary 截图均在上述 rerun 目录中。该结果只关闭当时 APK 的 U8 release 冷启动 supporting evidence；它不替代 U10/U13 业务旅途，也不宣称整批 implementation acceptance GO。

## R-S7 失败注入首败与修复

失败注入命令使用双屏设备把 Activity 启动到非默认物理 display `2`，预期这条非法
primary 拓扑进入 render-owned failure page，而不是把 secondary 当作 PRIMARY：

```text
node tools/terminal-sample2/run-u8-release-cold-start.mjs --phone-serial emulator-5556 --dual-serial emulator-5554 --app sample-terminal --failure-mode wrong-primary-display --skip-build --output doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/u8-release-failure-sample-terminal-rerun-01
```

第一次失败注入及第二次复跑均为 `business=FAIL CLEANUP=PASS`，原始输出分别保留在
`u8-release-failure-sample-terminal` 与 `u8-release-failure-sample-terminal-rerun-01/02`
目录。首败 logcat 是 `FATAL EXCEPTION`，原因是旧 release APK 尚未包含
`surface-rejection` catch；强制重建前的 APK bundle 检查也找不到该字符串。根因是
workspace source 变更未使 App 工程的 Gradle release JS bundle 任务失效，普通
`assembleRelease` 报 `createBundleReleaseJsAndAssets UP-TO-DATE`，因此它不是已修复
源码的运行证伪。

最小修复分两部分：

1. `apps/terminal/assembly/base/android/src/components/AndroidTerminalApp.tsx` 捕获
   `renderSurface` 的同步 surface rejection，并通过 App 注入的 typed
   `StandaloneStartupFailurePage` 处理；
2. `apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenActivityHandler.kt`
   以 `isPrimaryActivitySurface(surfaceIndex, displayId)` 明确只有 Android 默认
   physical display (`displayId=0`) 的 Activity 才能发布 `isHostPrimaryDisplay=true`。
   因此 `am start --display 2` 会被现有 adapter identity fence 判为不可用，并由
   `ScreenContainer` 的 R-S7 路径显示失败页；没有新增生产 debug seam。

Focused 原生回归：

```text
./gradlew :catering-v2s-adapter-android-dual-screen:test --no-daemon --console=plain
```

结果 `BUILD SUCCESSFUL`；新增的 default-display primary predicate 与现有 dual-screen
测试共同通过。

强制重建命令（两个 App 均执行，避免 workspace bundle 陈旧）：

```text
./gradlew assembleRelease --rerun-tasks --no-daemon --console=plain
```

分别在两个 App 的 `android/` 根执行，均 `BUILD SUCCESSFUL`。重建后的真实 APK bundle
均包含 `surface-rejection` 与 `startup.failure-page-visible`，真实 APK 扫描均 PASS：

```text
node tools/terminal-sample2/check-production-bundle.mjs --apk apps/terminal/assembly/android/sample-terminal/android/app/build/outputs/apk/release/app-release.apk
TERMINAL_PRODUCTION_BUNDLE=PASS ... BUNDLES=1
node tools/terminal-sample2/check-production-bundle.mjs --apk apps/terminal/assembly/android/sample-wallpaper-terminal/android/app/build/outputs/apk/release/app-release.apk
TERMINAL_PRODUCTION_BUNDLE=PASS ... BUNDLES=1
```

最终 sample-terminal 失败注入：

```text
node tools/terminal-sample2/run-u8-release-cold-start.mjs --phone-serial emulator-5556 --dual-serial emulator-5554 --app sample-terminal --failure-mode wrong-primary-display --skip-build --output doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/u8-release-failure-sample-terminal-rerun-03
TERMINAL_U8_RELEASE_COLD_START=PASS CLEANUP=PASS
```

最终 sample-wallpaper-terminal 失败注入：

```text
node tools/terminal-sample2/run-u8-release-cold-start.mjs --phone-serial emulator-5556 --dual-serial emulator-5554 --app sample-wallpaper-terminal --failure-mode wrong-primary-display --skip-build --output doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/u8-release-failure-sample-wallpaper-rerun-01
TERMINAL_U8_RELEASE_COLD_START=PASS CLEANUP=PASS
```

两个最终 failure `result.json` 的 dual timeline 都证明：

| App | 注入 display | ready candidate/complete | ready-hidden | failure page | splash | cleanup |
| --- | ---: | --- | --- | --- | --- | --- |
| sample-terminal | 2 | 均无 | 无 | `true`，`uiFailureIdentity=true`，`startup.failure-page-visible=true` | ready 前 `true`，settled `false` | PASS |
| sample-wallpaper-terminal | 2 | 均无 | 无 | `true`，`uiFailureIdentity=true`，`startup.failure-page-visible=true` | ready 前 `true`，settled `false` | PASS |

失败页截图、UI readback、window/activity、SurfaceFlinger 映射、完整与 relevant logcat
均在对应 rerun 目录；失败页显示在注入 Activity 所在的 SurfaceFlinger virtual display，
不是把默认物理 primary 截图误当作失败页。该证据关闭 R-S7 的 release failure-page
路径，但不替代完整 U10/U13 或整批 implementation acceptance。

## 当前 release 正常路径

在强制重建两个 APK 后，用新的输出目录重新执行四个 profile：

```text
node tools/terminal-sample2/run-u8-release-cold-start.mjs --phone-serial emulator-5556 --dual-serial emulator-5554 --skip-build --output doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/u8-release-cold-start-rerun-02
TERMINAL_U8_RELEASE_COLD_START=PASS CLEANUP=PASS
```

四个 profile 均 `business=PASS`、`cleanup=PASS`、`firstFailure=null`：

| profile | 形态 | ready 前 splash | startup 事件 | secondary surface | cleanup |
| --- | --- | --- | --- | --- | --- |
| sample-terminal-mobile | mobile | `true` | candidate→complete/hidden | 不适用 | PASS |
| sample-terminal-dual | dual | `true` | candidate→complete/hidden | `true` | PASS |
| sample-wallpaper-terminal-mobile | mobile | `true` | candidate→complete/hidden | 不适用 | PASS |
| sample-wallpaper-terminal-dual | dual | `true` | candidate→complete/hidden | `true` | PASS |

每个 profile 的原始时间线和证据均位于 `u8-release-cold-start-rerun-02/`。当前 runner
只要求 candidate 先于 complete 和 hidden；生产日志真实顺序是 candidate→complete→hidden，
不能强行把两个独立事件伪造为 hidden→complete。U8 的 release/mobile/dual 冷启动及
R-S7 失败页证据现在具备，但仍不把 U8 外推为 U10/U13 或整批 implementation acceptance。

为闭合“当前结果对应哪一个 APK”的证据边界，新增 runner 版本将 APK binding 写入结果
目录，并重新执行四个 profile：

```text
node tools/terminal-sample2/run-u8-release-cold-start.mjs --phone-serial emulator-5556 --dual-serial emulator-5554 --skip-build --output doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/u8-release-cold-start-rerun-03
TERMINAL_U8_RELEASE_COLD_START=PASS CLEANUP=PASS
```

`u8-release-cold-start-rerun-03/result.json` 的 `apkBindings` 与两个 binding 文件记录：

| APK | SHA-256 | bytes |
| --- | --- | ---: |
| `apps/terminal/assembly/android/sample-terminal/android/app/build/outputs/apk/release/app-release.apk` | `afa047522f49e080eff4fb69e60e9f98c610fca634b8a810d7df439cfce6a691` | 87910909 |
| `apps/terminal/assembly/android/sample-wallpaper-terminal/android/app/build/outputs/apk/release/app-release.apk` | `529d055f419d0da691f827b19c0c9bc2e46c6095376b72bdbb5fff8ee01179a1` | 88320469 |

四个 profile 均 `business=PASS`、`cleanup=PASS`、`firstFailure=null`；每个 profile 的
timeline 仍证明 ready 前 splash、candidate→complete/hidden、双屏 secondary surface
和目标包 PID absence。该 rerun 是当前 release 证据索引，`rerun-02` 保留为较早的成功
记录，不冒充当前 APK binding。
