# U8 当前源码 wrong-primary-display release 失败证据摘要（重跑）

RUNNER=tools/terminal-sample2/run-u8-release-cold-start.mjs
RUN_DATE=2026-09-15
MODE=record-only-release-cold-start;failureMode=wrong-primary-display
BUSINESS=PASS
CLEANUP=PASS
FIRST_FAILURE=null

## 命令与原始结果

```bash
node tools/terminal-sample2/run-u8-release-cold-start.mjs \
  --skip-build \
  --failure-mode wrong-primary-display \
  --output doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/u8-release-wrong-primary-current-source-rerun-20260915
```

原始结果：
`doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/u8-release-wrong-primary-current-source-rerun-20260915/result.json`。
四条 record（sample-terminal/sample-wallpaper-terminal × mobile/dual）均为
`business=PASS`、`cleanup=PASS`、`firstFailure=null`；手机记录执行正常冷启动，双屏记录
把 Activity 注入到错误物理屏并观察启动期失败页。

## 当前 release APK binding

| App | APK | bytes | sha256 |
| --- | --- | ---: | --- |
| sample-terminal | `apps/terminal/assembly/android/sample-terminal/android/app/build/outputs/apk/release/app-release.apk` | 87920433 | `e985891e23872a7ff68af44e93b1b6d7629df375e6759a16c83a3b67d9f8c94` |
| sample-wallpaper-terminal | `apps/terminal/assembly/android/sample-wallpaper-terminal/android/app/build/outputs/apk/release/app-release.apk` | 88329713 | `0388b6f77b49841104cdd867103ceb641326b66279bc32af62f0e6021e8045dd` |

两条 binding 文件、result.json 和 release-build evidence 使用同一 sha256/字节数；本摘要不
替代 raw logcat、SurfaceFlinger、UI XML、截图或 run manifest。

## 失败页与时序

双屏 wrong-primary 的两 App record 都证明：错误物理屏命中启动期 `ui.base.render:startup-failure`，
标题为“终端启动失败”，说明为“请重启终端，如仍失败请联系管理员”，启动期 splash 在
settled 状态已收起，且没有 `ready` 或 `startup.complete`。SECONDARY 没有渲染全屏失败页；
对应 raw 观察位于本目录各 profile 子目录的 `result.json`、logcat、SurfaceFlinger/UI、
截图和 `run-manifest.json`。

这是 R-S7/U8 的当前 release supporting evidence，不等于完整 sample2 B0、PF 矩阵、Web、
visual 或整体 implementation acceptance。
