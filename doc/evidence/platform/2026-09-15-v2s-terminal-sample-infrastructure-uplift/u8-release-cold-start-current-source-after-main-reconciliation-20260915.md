# U8 release 冷启动设备观察（当前源码）

```text
EVIDENCE_TIER=release/android/native/cleanup
BUSINESS=PASS
CLEANUP=PASS
FIRST_FAILURE=null
```

## 运行

执行体是 `tools/terminal-sample2/run-u8-release-cold-start.mjs` 的记录式 release 冷启动观察：

```sh
node tools/terminal-sample2/run-u8-release-cold-start.mjs \
  --phone-serial emulator-5556 \
  --dual-serial emulator-5554 \
  --skip-build \
  --output doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/u8-release-cold-start-current-source-after-main-reconciliation-20260915
```

`--skip-build` 只跳过 runner 内的重复构建；四条记录均绑定当前源码直接生成的 release APK：

| App | release APK sha256 | bytes |
|---|---|---:|
| sample-terminal | `9fe47967bb5824ee63e19f565af7a3218d3d116f3cbf31472b62dc21eec04077` | 87920433 |
| sample-wallpaper-terminal | `65242127eef6df56fa48fe0ffa042e171bbffeea2024fe76cbf66e0c7f2d4b1b` | 88329653 |

## 结果

四条记录全部为 `business=PASS`、`cleanup=PASS`、`firstFailure=null`：

| App | 形态 | primary | secondary |
|---|---|---|---|
| sample-terminal | mobile | PASS | 不适用 |
| sample-terminal | dual | PASS | `Display id=2` 与本次发现的 SurfaceFlinger virtual ID 配对，截图 `1280 x 720` |
| sample-wallpaper-terminal | mobile | PASS | 不适用 |
| sample-wallpaper-terminal | dual | PASS | `Display id=2` 与本次发现的 SurfaceFlinger virtual ID 配对，截图 `1280 x 720` |

每条记录都保留 `before-launch`、`after-launch-before-ready-poll`、`t0-first-rn-content`、`ready-or-failure-observed`、`settled` 和 `startup-order` 原始事件。成功双屏记录显示：

- `after-launch-before-ready-poll.splashVisible=true`，因此保留了就绪前开机画面仍在的设备观察；
- `ready-or-failure-observed` 同时观察到 `readyCandidate=true`、`readyHidden=true`、`startupComplete=true`；
- `splashVisibleBeforeReady=true`、`preReadyCaptured=true`，`settledSplashHidden=true`；
- `startup-order` 的 candidate、complete、hidden 顺序与 render-owned content 关联成立；
- `screen-primary*.png` 为 `2560 x 1600`，`screen-secondary.png` 为 `1280 x 720`，并保留对应的 logical display 与 SurfaceFlinger 原始 dump。

设备级原始产物在本目录下的各 App/形态子目录；顶层汇总为 `result.json` 与 `run-manifest.json`。本文件只关闭当前 U8 release supporting evidence，不宣称 Web、visual 或整体 implementation acceptance 已通过。
