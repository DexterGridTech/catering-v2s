# TER 第三方库整改最终实施独立复核记录

REVIEW_TARGET=IMPLEMENTATION  
REVIEW_ROUND=2  
reviewerKind=INDEPENDENT_SUBAGENT  
reviewer=Newton  
reviewerInputChecklist=doc/review/platform/2026-09-29-ter-third-party-usage-remediation-final-implementation-review-input-checklist-codex.md  
VERDICT=GO_WITH_UNVERIFIED_UI  
M/S/N=0/0/3

## 独立结论

Fresh reviewer 对当前实现补查后没有发现新的 confirmed 代码级 M/S finding。其静态源码核验包括：

- 系统失败 notice 仅派发 reset command，runtime actor 调 `appControl.resetRuntime`：`apps/terminal/ui/base/render/src/components/SystemFailureBoundary.tsx:110`、`apps/terminal/kernel/base/runtime/src/features/actors/resetRuntimeAfterSystemFailureActor.ts:22`、`apps/terminal/kernel/base/runtime/src/application/createInternalRuntimeModule.ts:44`。
- 当前 W4 Web runner 在 SECONDARY 错误提示后复位宿主滚动并断言 PRIMARY 几何回到初始测量位置：`scripts/test/ter-admin-display-web.mjs:379`、`:390`。
- CP-C native 静态链：`apps/terminal/application/base/android/src/foundations/nativeLoadingCapability.ts:34`、`apps/terminal/application/base/android/android/src/main/java/com/catering/v2s/terminal/application/base/android/TerminalExpoSplashScreen.kt:12`、`apps/terminal/application/base/android/src/foundations/nativeTopology.ts:330`、`apps/terminal/application/base/android/android/src/main/java/com/catering/v2s/terminal/application/base/android/TerminalAppControlModule.kt:11`。
- RNTL lifecycle setup：`tools/terminal-shared/rntl-vitest-setup.ts:25`；package manifests 与 yarn.lock 解析到 v14.0.1 / test-renderer 1.2.0，未发现 TER manifest 直接声明 `react-test-renderer`。

## 未验证范围

按 reviewer 的 `L3_UNVERIFIED`，以下保持 OPEN 或豁免，不等同于通过：W4 的 14 个 layer owners；W9 native callback、真实 splash 与 resetRuntime 时序；拓扑 T1..T5；设备/native 最终动态证据。W5、W7、W8、W10 按 Dexter 的明确授权豁免，不补判为 PASS。

Web-only dynamic evidence 中，W4 七个 screen owner 已观察；SECONDARY wallpaper waiting 的 stale launcher-origin 同族先有两次失败，修复后新 run PASS，相关 run cleanup 均 PASS。此结果只证明 Web 观察，不外推为 Android、native 或 topology 结论。

Verdict block：

`L1_ENGINEERING=GO`  
`L2_USER_VISIBLE=GO_WITH_WEB_SCOPE_ONLY`  
`L3_UNVERIFIED=W4 layer owners; W9 native callback/splash/resetRuntime; T1..T5 topology; Android/device/native final evidence; waived W5/W7/W8/W10`  
`SAME_ROOT_SCAN=NO_CONFIRMED_CODE_MISMATCH_FOUND_IN_REVIEWED_SCOPE`  
`DESIGN_GAPS=NONE_NEW`  
`EVIDENCE_TIER=STATIC_SOURCE + SELECTED_LSP_DIAGNOSTICS + WEB_MANIFEST_LOG_CLASSIFICATION; NOT_DYNAMIC_NATIVE_DEVICE_TOPOLOGY`  
`VERDICT=GO_WITH_UNVERIFIED_UI`  
`M/S/N=0/0/3`

## 主 agent intake

状态：`CONFIRMED`。主 agent 接受独立 reviewer 的无新增 confirmed M/S 结论与 L3 分层；不将任何 OPEN 或 Dexter waiver 改写为 PASS。当前任务只交 Claude 做实施后复核，不再启动 Android/device/VM/topology 动态运行。
