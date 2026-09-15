# sample2 当前源码 release 冻结旅途

DATE=2026-09-15
RUNNER=`tools/terminal-sample2/run-sample2-frozen-journey.mjs`
EVIDENCE_TIER=release/android/cleanup

## 当前运行

| 形态 | evidence 目录 | business | cleanup | APK sha256 |
| --- | --- | --- | --- | --- |
| mobile | `sample2-frozen-current-mobile-final-20260915-rerun2/` | PASS | PASS | `0388b6f77b49841104cdd867103ceb641326b66279bc32af62f0e6021e8045dd` |
| dual | `sample2-frozen-current-dual-final-20260915-rerun2/` | PASS | PASS | `0388b6f77b49841104cdd867103ceb641326b66279bc32af62f0e6021e8045dd` |

两种形态均为 `firstFailure=null`、`lastKnownGood=confirmed-w3-restored-without-pending`，
并回读当前 sample-wallpaper-terminal APK。十个步骤为：`anonymous`、
`picker-after-login`、`w1-pending`、`w1-confirmed`、`w2-pending`、`w2-confirmed`、
`w3-pending-before-restart`、`w3-pending-after-restart`、`w3-confirmed`、
`w3-confirmed-after-restart`。

## 状态与双屏

每一步均保存 PRIMARY partKey、选择/确认/有效 wallpaper 状态、background asset、confirm
enabled、UI XML、logcat、window/activity 和截图。dual 另保存 SECONDARY partKey/asset 与
物理 surface 映射；mobile 保存无 SECONDARY 观察。当前 runner 对 picker 确认控件的 viewport
滚动已修复，避免把确认按钮不在当前 UIAutomator viewport 误报成业务缺陷。

## 边界

这组记录关闭当前 sample2 wallpaper 冻结旅途的 mobile/dual supporting evidence，并不把
sample2 既有完整 A1–A9/F-A acceptance、U13 全量 PF 矩阵、Web、visual 或整体
implementation review 自动标为 PASS；picker 两跳失败的真实 runtime focused evidence
见 `u13-runtime-evidence.md`。
