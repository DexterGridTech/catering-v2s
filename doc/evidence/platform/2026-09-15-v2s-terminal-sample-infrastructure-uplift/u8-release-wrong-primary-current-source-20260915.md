# U8 当前源码 wrong-primary-display release 失败证据摘要

RUNNER=tools/terminal-sample2/run-u8-release-cold-start.mjs
RUN_DATE=2026-09-15
MODE=record-only-release-cold-start;failureMode=wrong-primary-display
BUSINESS=PASS
CLEANUP=PASS

## 命令

```bash
node tools/terminal-sample2/run-u8-release-cold-start.mjs \
  --phone-serial emulator-5556 \
  --dual-serial emulator-5554 \
  --failure-mode wrong-primary-display \
  --output doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/u8-release-wrong-primary-current-source-20260915 \
  --skip-build
```

当前两个 release APK 的绑定写在本目录的 `*-apk-binding.json`，与正常 U8 记录使用的
sha256 相同。脚本仍对手机形态执行正常控制；失败注入只在双屏形态把 Activity 启动到
非 0 号物理 display，两个 App 各有一条真实 failure record。

## 失败注入结果

| App | 设备 | 注入 | failure page | ready-candidate | startup.complete | pre-ready splash | settled splash | cleanup |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| sample-terminal | `emulator-5554` | display 2，期望 primary 0 | PASS | absent | absent | visible | hidden | PASS |
| sample-wallpaper-terminal | `emulator-5554` | display 2，期望 primary 0 | PASS | absent | absent | visible | hidden | PASS |

两条 dual record 的 `startup-failure-order` 均为：

```text
provenFailureAfterSplash=true
readyEventsAbsent=true
uiFailureIdentity=true
failurePageLogObserved=true
```

settled UI readback 均同时观察到：

- `ui.base.render:startup-failure`；
- title `终端启动失败`；
- message `请重启终端，如仍失败请联系管理员`；
- code 只呈现内部 reason/error name 形态，不含 raw error message。

## 原始记录与边界

每个 App/形态子目录保留 display inventory、SurfaceFlinger、window/Activity snapshot、
UI XML、截图、logcat、`result.json` 和 owner-scoped cleanup 结果。手机控制记录也在
本目录，但不把它们重复计算为 failure injection。

本记录证明的是 R-S7 的 wrong-primary-display 启动终态：收起 splash、显示启动期失败页、
且没有 ready/complete。它不替代 runtime failure variant、sample1/sample2 冻结旅途、
Web、visual 或整体 implementation review。
