# TER 应用内远程控制 Android smoke 实施复核请求

REVIEW_TARGET=IMPLEMENTATION
SCOPE=Android mobile 与同 App 双机配对 remote.main smoke；不含 L2

## 背景

TER 应用内远程控制实现已按既有详设推进。Dexter 最新明确的交付边界是：Android 虚拟机 mobile 和双机配对 smoke 完成后即可交付，本轮不需要 L2。此前实施中发现并修复了两项影响配对主流程的问题：peer 虚拟键盘输入被映射到错误的屏幕槽位；会员确认回执返回期间，状态投影可能触发重复确认。当前有四个 mobile/paired smoke run 记录，结果见下列 manifest 与 runner log。

mobile run 早于上述配对路径修复；配对修复针对 paired 屏幕映射和 branch confirmation 并发路径。本交接明确记录各 run 的字节时序，不把旧 mobile run 说成修复后相同字节的新运行。

## 评审目标

请独立复核当前远程控制主流程代码是否符合正式需求与已批准详设，是否简单、职责清楚且健壮；重点检查配对 peer 的屏幕槽位映射、会员确认期间 reconciliation 抑制是否准确限定于在途操作、远控开始/实际输入/结束的 owner 与失败闭环，以及四个已归档 smoke 结果是否支持本次限定的交付范围。

本次不要求重跑 smoke，也不要求 L2。L2 属于不同执行面；Dexter 已明确本轮在 Android mobile 与 paired smoke 后交付。请勿将未跑 L2 作为本轮 finding 或补证要求。若发现当前源码存在确定反例，请按 finding 报告，说明证据及最小修正。

## 需阅读文件

- `doc/plans/platform/2026-10-10-ter-remote-control-formal-requirements-claude.md`：远控正式行为要求。
- `doc/plans/platform/2026-10-10-ter-remote-control-implementation-design-claude.md`：owner、协议、拓扑和失败边界。
- `doc/plans/platform/2026-10-10-ter-remote-control-implementation-plan-claude.md`：批准实施范围与验证安排；其中 L2 安排以 Dexter 本次最新会话范围为准，本轮不执行 L2。
- `doc/plans/platform/2026-10-10-ter-remote-control-source-and-api-appendix-claude.md`：实现入口、接口及技术依据。
- `doc/decisions/2026-10-10-ter-remote-control-journey-claude.md`：获批用户任务及主流程。
- `doc/decisions/2026-10-10-ter-remote-control-ia-claude.md`：页面与数据责任边界。
- `doc/decisions/2026-10-10-ter-remote-control-ui-interaction-claude.md`：交互和屏幕行为。
- `contracts/protocol/terminal-remote-control-protocol.json`、`contracts/openapi-source/terminal-remote-control.schemas.json`：终端协议与 HTTP 契约正本。
- `apps/terminal/kernel/base/remote-control/src/application/createRemoteControlModule.ts`、`apps/terminal/kernel/base/remote-control/src/features/actors/remoteControlActor.ts`、`apps/terminal/kernel/base/remote-control/src/selectors/selectors.ts`：终端远控 owner、状态和查询。
- `apps/terminal/adapter/android/remote/src/createAndroidRemoteControlPort.ts`、`apps/terminal/adapter/android/remote/android/src/main/java/com/catering/v2s/terminal/adapter/android/remote/RemoteTouchDispatcher.kt`、`apps/terminal/adapter/android/remote/android/src/main/java/com/catering/v2s/terminal/adapter/android/remote/RemoteWindowVideoCapturer.kt`：Android adapter 的触摸分发与画面采集。
- `apps/terminal/kernel/feature/sample-member-registry/src/application/module.ts`、`apps/terminal/kernel/feature/sample-member-registry/src/features/actors/actors.ts`、`apps/terminal/kernel/feature/sample-member-registry/test/memberRegistry.test.ts`：修复配对会员确认回执与状态投影竞态的 owner 代码和反例测试。
- `apps/frontend/operations-admin/src/features/remote-control/ui/RemoteControlWorkspace.tsx`、`apps/frontend/operations-admin/src/features/remote-control/model/remoteControlPointer.ts`、`apps/frontend/operations-admin/src/features/remote-control/model/remoteControlKeepalive.ts`、`apps/frontend/operations-admin/src/features/remote-control/model/remoteControlIdentity.ts`：运营端工作区、指针、保活和身份处理。
- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/terminalcontrol/TerminalRemoteControlController.java`、`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/terminalcontrol/OperationsRemoteControlController.java`、`apps/backend/catering-business-server/modules/terminal-control/src/main/java/com/catering/v2s/terminalcontrol/application/TerminalRemoteControlOwnerService.java`、`apps/backend/catering-business-server/modules/terminal-control/src/main/java/com/catering/v2s/terminalcontrol/application/TerminalRemoteControlEndCoordinator.java`：终端/运营端 HTTP 与 CBS owner 流程。
- `tools/terminal-automation/journeys/remote.android.test.ts`、`tools/terminal-automation/src/driver.ts`、`tools/terminal-automation/src/androidInput.ts`、`tools/terminal-automation/src/journeyUiPort.ts`、`tools/terminal-automation/src/runner.ts`：唯一受管 Android driver、paired 场景与清理入口。
- `.runtime/terminal-automation/0e50702f-1104-4ccb-b848-5b4b3e21e5c7/run-manifest.json`、`runner.log`：console mobile run，2026-10-12T17:34:38.307Z 开始，emulator-5554。
- `.runtime/terminal-automation/9c7787af-1f09-40ca-a835-5f258f9a4b1d/run-manifest.json`、`runner.log`：wallpaper mobile run，2026-10-12T17:06:10.357Z 开始，emulator-5554。
- `.runtime/terminal-automation/ec6feeb3-ef5c-48f1-afe8-3b706979e024/run-manifest.json`、`runner.log`：console paired run，2026-10-12T23:11:03.680Z 开始，MASTER emulator-5556 / PEER emulator-5558。
- `.runtime/terminal-automation/7d930c92-a0a9-4919-a563-33b64e8a7aa3/run-manifest.json`、`runner.log`：wallpaper paired run，2026-10-12T23:14:31.417Z 开始，MASTER emulator-5556 / PEER emulator-5558。

## 独立核验重点

1. 对照正式需求与详设，核验本次 smoke `remote.main` 覆盖的实际用户动作和结果，不以控制命令已发送、画面首帧或 HTTP 成功代替业务完成。
2. 检查 `remote.android.test.ts` 中 MASTER `PRIMARY → main`、paired PEER `PRIMARY → secondary` 的坐标映射，尤其 `enterRemoteKeyboardText` 对 `screenSlot` 的传递；确认没有遗漏同族调用点。
3. 检查 member-registry 的在途确认标识是否只抑制相同 operation 的自动 reconciliation，并在 command settled 后恢复正常回执补偿；反例测试应证明一个 branch confirmation 只产生一次 root confirm。
4. 复核 console 与 wallpaper paired run 的主副设备日志，包括 `remote.controller.interactive.verified`、远端业务结果、`remote.end.verified` 与两端清理完成；检查各 manifest 的 run、设备身份、business、diagnostics、cleanup 与 first failure 字段。
5. 四个 manifest 当前均记录 `stage=FINISHED`、`business=PASS`、`diagnostics=PASS`、`cleanup=PASS`、`firstFailure=null`。其中 mobile run 在 paired 专项修复之前；请按上述变更适用范围判断其作为 mobile smoke 的证据边界，不要将它描述成修复后同字节的新 run。
6. 过程中的配对失败及修复供根因复核：旧 run `99b23c52-48a4-4db0-b445-0268f72f298e` 暴露 peer 键盘坐标误落 `main`；旧 run `7e6fa734-9128-4b31-813c-012c44587579` 暴露 branch confirmation 与投影 reconciliation 重复派发。当前 paired PASS 是修复后的 run。
7. 本次交付边界由 Dexter 最新会话明确为 mobile 与双机配对 smoke；L2 为 `NOT_RUN / OUT_OF_SCOPE_FOR_CURRENT_DELIVERY`。不要要求 L2 或增加未授权拓扑/场景；其他未运行执行面应明确区分，不得升级为 PASS。

## 期望结论

请给出明确 `GO` 或 `NO-GO` 与 `M/S/N` 数量。每个 finding 写精确源码/详设路径与行号、事实或推论、影响、最小修正及是否需要 Dexter 产品裁决。请独立判断证据适用边界；本 handoff 提供的历史 run 结果和实施方说明均不替代你的核验。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请对《TER 应用内远程控制》当前实施结果做一次独立 IMPLEMENTATION review。

背景：本轮已完成 Android 虚拟机 mobile 与同 App 双机配对的 remote.main smoke。Dexter 最新明确本轮在这些 smoke 后即可交付，不需要 L2。请按当前源码、正式需求、详设和下列四个 run 归档独立判断，不继承作者或既有 reviewer verdict。

目标：核验远程控制主流程是否符合需求、实现是否简单高效健壮；重点检查 paired 主副屏幕槽位映射、会员确认回执与状态投影竞态、真实开始/输入/结束业务链，以及现有 smoke 的业务、diagnostics、cleanup 结果和证据适用范围。

请从 catering-v2s 仓库根阅读：
- `doc/plans/platform/2026-10-10-ter-remote-control-formal-requirements-claude.md`：正式需求；
- `doc/plans/platform/2026-10-10-ter-remote-control-implementation-design-claude.md`、`doc/plans/platform/2026-10-10-ter-remote-control-implementation-plan-claude.md`、`doc/plans/platform/2026-10-10-ter-remote-control-source-and-api-appendix-claude.md`：实现判据、计划和源码依据；
- `doc/decisions/2026-10-10-ter-remote-control-journey-claude.md`、`doc/decisions/2026-10-10-ter-remote-control-ia-claude.md`、`doc/decisions/2026-10-10-ter-remote-control-ui-interaction-claude.md`：已确认 Journey、页面和交互；
- `contracts/protocol/terminal-remote-control-protocol.json`、`contracts/openapi-source/terminal-remote-control.schemas.json`：终端与 HTTP 契约；
- `apps/terminal/kernel/base/remote-control/src/application/createRemoteControlModule.ts`、`apps/terminal/kernel/base/remote-control/src/features/actors/remoteControlActor.ts`、`apps/terminal/adapter/android/remote/src/createAndroidRemoteControlPort.ts`、`apps/terminal/adapter/android/remote/android/src/main/java/com/catering/v2s/terminal/adapter/android/remote/RemoteTouchDispatcher.kt`、`apps/terminal/adapter/android/remote/android/src/main/java/com/catering/v2s/terminal/adapter/android/remote/RemoteWindowVideoCapturer.kt`：终端 owner 与 Android adapter；
- `apps/terminal/kernel/feature/sample-member-registry/src/application/module.ts`、`apps/terminal/kernel/feature/sample-member-registry/src/features/actors/actors.ts`、`apps/terminal/kernel/feature/sample-member-registry/test/memberRegistry.test.ts`：paired branch 确认并发修正；
- `apps/frontend/operations-admin/src/features/remote-control/ui/RemoteControlWorkspace.tsx`、`apps/frontend/operations-admin/src/features/remote-control/model/remoteControlPointer.ts`、`apps/frontend/operations-admin/src/features/remote-control/model/remoteControlKeepalive.ts`、`apps/frontend/operations-admin/src/features/remote-control/model/remoteControlIdentity.ts`：运营端远控工作区和指针/保活逻辑；
- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/terminalcontrol/TerminalRemoteControlController.java`、`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/terminalcontrol/OperationsRemoteControlController.java`、`apps/backend/catering-business-server/modules/terminal-control/src/main/java/com/catering/v2s/terminalcontrol/application/TerminalRemoteControlOwnerService.java`、`apps/backend/catering-business-server/modules/terminal-control/src/main/java/com/catering/v2s/terminalcontrol/application/TerminalRemoteControlEndCoordinator.java`：CBS owner 与接入链；
- `tools/terminal-automation/journeys/remote.android.test.ts`、`tools/terminal-automation/src/driver.ts`、`tools/terminal-automation/src/androidInput.ts`、`tools/terminal-automation/src/journeyUiPort.ts`、`tools/terminal-automation/src/runner.ts`：受管 Android smoke 与清理；
- `.runtime/terminal-automation/0e50702f-1104-4ccb-b848-5b4b3e21e5c7/run-manifest.json`、`runner.log`：console mobile；
- `.runtime/terminal-automation/9c7787af-1f09-40ca-a835-5f258f9a4b1d/run-manifest.json`、`runner.log`：wallpaper mobile；
- `.runtime/terminal-automation/ec6feeb3-ef5c-48f1-afe8-3b706979e024/run-manifest.json`、`runner.log`：console paired；
- `.runtime/terminal-automation/7d930c92-a0a9-4919-a563-33b64e8a7aa3/run-manifest.json`、`runner.log`：wallpaper paired。

请重点独立核验：paired PEER 的 `PRIMARY → secondary` 坐标映射是否贯穿点击、拖动和虚拟键盘；confirmation 在权威投影先到时是否只执行一次且不会破坏 response-loss reconciliation；smoke 是否验证了实际远控业务结果和结束释放。四个 run manifest 均记 `FINISHED`、`business=PASS`、`diagnostics=PASS`、`cleanup=PASS`、`firstFailure=null`。mobile runs 早于 paired 专项修复，paired runs 在修复后；请保留这一字节时序区别。

本轮不需要 L2，L2 明确为 `NOT_RUN / OUT_OF_SCOPE_FOR_CURRENT_DELIVERY`，请不要以未运行 L2 要求补证。也不要求重跑上述 smoke；如源码发现确定缺陷，请给出可复核的反例和最小修正。

烦请给出明确 `GO` 或 `NO-GO` 及 `M/S/N` 数量；每项 finding 请列精确路径与行号、影响、最小修正及是否需要 Dexter 产品裁决。

授权边界：本次请求仅评审当前远程控制源码、直接测试及上述既有 Android smoke 结果。Dexter 已明确本轮不跑 L2；本请求不授权新动态运行、额外拓扑、UAT、生产部署或范围外功能。谢谢。
```
