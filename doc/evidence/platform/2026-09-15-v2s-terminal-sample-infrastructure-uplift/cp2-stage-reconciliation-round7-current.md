# CP2/B2 三维独立对账（round 7）

REVIEW_TARGET=IMPLEMENTATION_RECONCILIATION
REVIEW_CYCLE_ID=2026-09-15-v2s-terminal-sample-infrastructure-uplift-implementation
REVIEW_ROUND=7
reviewerKind=INDEPENDENT_SUBAGENT
REVIEW_SCOPE=CP2/B2 after S-1 repair
VERDICT=MATCHED_WITH_OPEN_EVIDENCE
M_S_N=0/0/0

## 审查边界

本记录由 fresh 独立只读 reviewer Franklin 产生。reviewer 读取当前需求、详设、实施计划、项目记忆及 owning source；没有修改文件，没有执行测试、构建、runtime、设备、Web、Metro、Android、DEV、seed、UAT、部署或 Git 操作。结论只覆盖 CP2/B2 的 source/design 对账，不把 focused/static 证据升级为 dynamic、native、release、device 或 cleanup PASS。

## S-1 after-repair

- `CONFIRMED`：`started` runtime、host `ready`、物理 PRIMARY（`surfaceKey=PRIMARY`、`displayIndex=0`）且 real container 为空时，`ScreenContainer` 渲染 render-owned `StartupFailurePage`；见 `apps/terminal/ui/base/render/src/components/ScreenContainer.tsx:69-85`。
- `CONFIRMED`：`pending` 不通过生产 timeout 收口；显式 host `unavailable`、native identity mismatch 或 snapshot error 才进入终态路径；见 `apps/terminal/ui/base/render/src/components/ScreenContainer.tsx:47-53`、`apps/terminal/adapter/android/dual-screen/src/implementations/surfaceHost.ts:225-263`。
- `CONFIRMED`：failure page 由 render owner 提供并通过 `hideOnce('startup-failure')` 收起 splash；见 `apps/terminal/ui/base/render/src/components/ScreenReadyBoundary.tsx:68-104`。
- `CONFIRMED`：ready 依赖 resolved real part 的正尺寸 layout，不由 root mount、fallback 或 spinner 触发；见 `apps/terminal/ui/base/render/src/components/ScreenReadyBoundary.tsx:163-206`。
- `CONFIRMED`：Web、secondary、unhosted/test 的 `container-empty` fallback 未被改为 PRIMARY failure page；见 `apps/terminal/ui/base/render/src/components/ScreenContainer.tsx:69-87`。

## CP2/B2 对账结果

- `CONFIRMED`：native loading target 固定为 PRIMARY/display 0，两个 `MainActivity` 在 `super.onCreate(null)` 前注册 `SplashScreenManager`；见 `apps/terminal/assembly/base/android/src/foundations/nativeLoadingCapability.ts:10-21`、两个 App 的 `MainActivity.kt:14-18`。
- `CONFIRMED`：Android App shell 只承载 assembly pending/rejection；ready/failure 的 UI ownership 由注入的 render callback 提供；见 `apps/terminal/assembly/base/android/src/components/AndroidTerminalApp.tsx:27-68`。
- `CONFIRMED`：skeleton graph 中 `assembly.base.android` 为 batch 2，当前 sample-console 与 Android App 边界没有发现 CP2 source/design 反向依赖矛盾；见 `apps/terminal/skeleton-graph.ts:206-243,275-305`。
- `PARTIALLY_CONFIRMED`：package、lock、native resource/Gradle 注册、shared-console 完整映射及 U6/U7/U8/U12/U13 退出前置在设计/计划中有定义，但本轮为快速静态复核，未逐项重跑全部 owning-source/命令闭包。
- `UNVERIFIED_REQUIRES_EVIDENCE`：release 手机/双屏冷启动、splash 实际隐藏、native registration 构建链接、U8/U12/U13 dynamic/focused 证据尚未在本轮取得。
- `UNVERIFIED_REQUIRES_EVIDENCE`：完整 package/lock/graph resolver 与 dependency census 的当前字节闭包尚未在本轮重跑。

## 失败链与最后已知状态

- S-1 首败位于 focused test harness 的错误解构：测试取出 `logger` 后访问不存在的 `logger.events`；断点在 evidence readback，不在 `ScreenContainer` 或 native loading production source。
- S-NEW-1 的首败是静态红 fixture 仍按旧 import 形态匹配；修复后 evidence 记录 focused/static/typecheck 已恢复。
- last known good：当前源码与修复 evidence 的 source/design 描述一致；focused 结果记录为 render 12/12 files、67/67 tests，dynamic/native/release/device/cleanup 仍 OPEN。

## Verdict

CP2/B2 当前 source/design 可记为 `MATCHED_WITH_OPEN_EVIDENCE`，M/S/N 为 `0/0/0`。后续仍必须完成全批三维对账，并在此后取得真实 release 手机/双屏、U8/U10/U12/U13 及 cleanup 证据。
