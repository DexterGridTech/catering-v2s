# U8 当前源码 release 冷启动记录

RUNNER=`tools/terminal-sample2/run-u8-release-cold-start.mjs`
DATE=2026-09-15
MODE=record-only-release-cold-start
EVIDENCE_TIER=release/android/cleanup
BUILD=SKIPPED_BY_EXPLICIT_OPTION
BUSINESS=PASS
CLEANUP=PASS
FIRST_FAILURE=null

## 当前 APK 绑定

| App | sha256 | bytes |
| --- | --- | ---: |
| sample-terminal | `e985891e238e72a7ff68af44e93b1b6d7629df375e6759a16c83a3b67d9f8c94` | 87920433 |
| sample-wallpaper-terminal | `0388b6f77b49841104cdd867103ceb641326b66279bc32af62f0e6021e8045dd` | 88329713 |

对应绑定和逐设备原始记录在本目录的
`u8-release-cold-start-current-source-rerun-20260915/`。本次显式 `--skip-build` 只
跳过 runner 内部重复构建；当前 APK 已由 `release-build-current-source-20260915.md`
记录的串行 release build 产生，并由 runner 在安装后逐设备 sha256/bytes 回读核对。

## 正常路径

| App | mobile | dual |
| --- | --- | --- |
| sample-terminal | `PASS/PASS` | `PASS/PASS` |
| sample-wallpaper-terminal | `PASS/PASS` | `PASS/PASS` |

每个 profile 均保存 pre-ready splash、首个 RN 内容设备观察、同设备 logcat、PRIMARY
surface/geometry/real-part 顺序、settled splash hidden 和 cleanup。dual profile 另保存
SECONDARY 物理 surface 截图及 SurfaceFlinger 映射。正常 oracle 确认 `ready-candidate`、
`startup.complete`、`ready-hidden` 的顺序；首个 RN 内容观察若晚于 hide，则保留观察延迟
字段，不反向制造“早收起”结论。

## 错误主屏反向夹具

相同当前 APK 的 wrong-primary 记录在
`u8-release-wrong-primary-current-source-rerun-20260915/`，命令使用
`--failure-mode wrong-primary-display`。sample-terminal 与 sample-wallpaper-terminal
的 dual 记录均为 `business=PASS`、`cleanup=PASS`：pre-ready splash 可见，ready/complete
缺失，settled 时 splash 收起并显示 `ui.base.render:startup-failure`、标题“终端启动失败”、
说明“请重启终端，如仍失败请联系管理员”；错误 code 只呈现内部 reason/error name
形态。该记录证明 R-S7 的错误物理主屏终态，不替代运行期 failure variant。

## 边界

这组记录关闭 U8 当前 release 冷启动执行体的正常及 wrong-primary supporting evidence，
不宣称 Web、visual 或整体 implementation review 已通过。
