# U8 当前源码 release 冷启动证据摘要

RUNNER=tools/terminal-sample2/run-u8-release-cold-start.mjs
RUN_DATE=2026-09-15
MODE=record-only-release-cold-start
SOURCE_BINDING=run-manifest.json 与两个 *-apk-binding.json
BUSINESS=PASS
CLEANUP=PASS

## 命令

```bash
node tools/terminal-sample2/run-u8-release-cold-start.mjs \
  --phone-serial emulator-5556 \
  --dual-serial emulator-5554 \
  --output doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/u8-release-cold-start-current-source-after-runner-order-20260915 \
  --skip-build
```

`--skip-build` 只复用已经绑定并核对 sha256 的当前 release APK，不跳过安装、冷启动、
设备观察或 cleanup。

## 当前 APK 绑定

| App | APK | sha256 | bytes |
| --- | --- | --- | ---: |
| sample-terminal | `apps/terminal/assembly/android/sample-terminal/android/app/build/outputs/apk/release/app-release.apk` | `e726d1203634d834aa0be264a179ad648f4c8ce5f35bb6fd0d10ddb84e6268df` | 87920437 |
| sample-wallpaper-terminal | `apps/terminal/assembly/android/sample-wallpaper-terminal/android/app/build/outputs/apk/release/app-release.apk` | `7fb8f0c296bc199d698d8b2529405b226aa6a5e3c76a0ee2cb5079f9242507f7` | 88329657 |

## 四个观察

| App | 形态 | 设备 | business | cleanup | 关键结果 |
| --- | --- | --- | --- | --- | --- |
| sample-terminal | mobile | `emulator-5556` | PASS | PASS | pre-ready splash=true；candidate→complete/hidden；settled splash=false |
| sample-terminal | dual | `emulator-5554` | PASS | PASS | pre-ready splash=true；candidate→complete/hidden；PRIMARY/SECONDARY 均有记录 |
| sample-wallpaper-terminal | mobile | `emulator-5556` | PASS | PASS | pre-ready splash=true；candidate→complete/hidden；settled splash=false |
| sample-wallpaper-terminal | dual | `emulator-5554` | PASS | PASS | pre-ready splash=true；candidate→complete/hidden；PRIMARY/SECONDARY 均有记录 |

每个子目录的 `result.json` 记录了 `t0-first-rn-content`、`ready-or-failure-observed`、
`settled` 和 `startup-order`。四条记录均有：

- ready 前的 immediate device window 观察仍见 native splash；
- 首个 RN 内容的 UIAutomator readback 及同一设备的 `logcat-at-first-rn-content.txt`；
- `startup.ready-candidate`、`startup.complete`、`startup.ready-hidden`；
- settled UI identity、窗口状态、双屏 secondary surface（仅 dual）；
- owner-scoped package force-stop 后 PID 消失，cleanup=PASS。

## 首败与判定修复

前一轮运行器首败保留在 `u8-release-cold-start-current-source-after-native-order-20260915`：
实现已越过 AppCompat 原生注册崩溃，但 runner 把 host `Date.now()` 与 device log epoch
直接比较，并要求延迟返回的 UIAutomator t0 snapshot 仍见 splash，导致
`native splash was hidden before first RN content appeared`。当前实现未因此放宽 R-S1。

修复后的 runner 不再制造跨时钟因果，也不把 UIAutomator 的延迟观察当成生产早收起；它
要求同一设备的 render-owned `ready-candidate` 先于 `startup.complete` 与
`startup.ready-hidden`，同时保留 t0 的 splash 状态和 ready/hidden 是否已经出现在同一
设备 log 的事实。四个当前 `startup-order` 均为：

```text
firstContentObservedAfterReadyCandidate=true
firstContentObservedAfterReadyHidden=true
provenReadyAfterRenderOwnedContent=true
settledSplashHidden=true
```

因此当前证据区分为：ready 前真实 splash 仍在；真实 part/layout 产生 candidate 后才
complete/hide；UIAutomator t0 可能在 hide 后返回，这是观察延迟而非早收起证据。

## 原始记录

逐设备原始窗口、Activity、UI XML、SurfaceFlinger、截图、logcat 和 `result.json` 均在
本目录下；本摘要不替代原始记录，也不把该 U8 结果外推为 Web、visual、完整 sample2
acceptance 或整体 implementation review GO。
