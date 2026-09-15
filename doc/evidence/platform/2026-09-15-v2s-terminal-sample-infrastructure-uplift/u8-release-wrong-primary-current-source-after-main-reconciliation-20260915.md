# U8 release 错误主屏终态失败观察（当前源码）

```text
EVIDENCE_TIER=release/android/native/cleanup
BUSINESS=PASS
CLEANUP=PASS
FIRST_FAILURE=null
FAILURE_MODE=wrong-primary-display
```

## 运行

执行体是同一个记录式 release runner，以受控的错误物理屏注入覆盖双屏分支：

```sh
node tools/terminal-sample2/run-u8-release-cold-start.mjs \
  --phone-serial emulator-5556 \
  --dual-serial emulator-5554 \
  --skip-build \
  --failure-mode wrong-primary-display \
  --output doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/u8-release-wrong-primary-current-source-after-main-reconciliation-20260915
```

四条记录（两个 App 的 mobile 正常分支、两个 App 的 dual 错误主屏分支）均为 `business=PASS`、`cleanup=PASS`、`firstFailure=null`。dual 注入记录明确写入 `activityDisplayId=2`、`expectedPrimaryDisplayId=0`，并使用本次运行发现的 SurfaceFlinger virtual ID 做失败页截图。

## 终态判据

两个 App 的 dual 失败记录均满足：

- `after-launch-before-ready-poll.splashVisible=true`；
- `t0-first-rn-content.failurePage=true`；
- `ready-or-failure-observed.readyCandidate=false`、`readyHidden=false`、`startupComplete=false`；
- `splashVisibleBeforeReady=true`、`preReadyCaptured=true`，settled 后开机画面已隐藏；
- `startup-failure-order.failurePage=true`、`provenFailureAfterSplash=true`、`readyEventsAbsent=true`、`uiFailureIdentity=true`、`failurePageLogObserved=true`；
- UI hierarchy 含 `ui.base.render:startup-failure`、`:title`、`:message`、`:code`，标题为“终端启动失败”，说明为“请重启终端，如仍失败请联系管理员”，错误代码只呈现内部 reason 与错误名。

原始时间线、UI hierarchy、开机画面前后截图、logical/SF display dump、PNG `file` 输出和 cleanup 记录均保留在本目录下的 App/形态子目录。此证据证明 R-S7 的一个真实终态分支，不代表全部失败类型、Web、visual 或整体 implementation acceptance 已关闭。
