## 背景

TER 第三方库用法整改需求 v3.3 已获授权进入详设与实施计划编写；当前交付仅为 DESIGN，IMPLEMENTATION_AUTHORITY=false。详设/计划经过两轮独立盲审：Round 1 给出 NO-GO，作者已回到 owning source 处置；Round 2 fresh reviewer Herschel 给出 `GO, M/S/N=0/0/0` 并以 `ROUND_FINAL_DECISION=SELF_DECIDED` 收口，记录见 `doc/review/platform/2026-09-28-ter-third-party-usage-remediation-design-independent-review-round2-codex.md`。最终验收包括非拓扑（单机双屏真机 + mobile 虚拟机，适用场景先 Web）和拓扑（两台单机单屏 laptop 虚拟机，先 JVM 真 socket）的两部分。

## 评审目标

请独立确认详设与实施计划是否可按需求执行并可证伪，重点检查：TP-A7 两种 heartbeat 的生产观测性、TP-A8 精确场景分母、TP-A9/JVM 真 socket、topology runner 不清数据、虚拟机 serial 每次动态发现并按 AVD 身份/实时形态绑定、以及 Web/双屏真机/mobile/two-laptop 的两段最终验收和授权边界。

## 需阅读文件

- `doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-requirements-claude.md`：v3.3 唯一需求输入。
- `doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-implementation-design-codex.md`：详设、边界、控件/场景分母与证伪判据。
- `doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-implementation-plan-codex.md`：CP 顺序、命令、验证和最终验收步骤。
- `doc/review/platform/2026-09-28-ter-third-party-usage-remediation-design-independent-review-round1-codex.md`：Round 1 findings 与逐项处置。
- `doc/review/platform/2026-09-28-ter-third-party-usage-remediation-design-review-checklist-v3.3-round2-codex.md`：Round 2 独立审查输入清单与盲审声明。
- `doc/review/platform/2026-09-28-ter-third-party-usage-remediation-design-independent-review-round2-codex.md`：Round 2 fresh independent verdict `GO, M/S/N=0/0/0` 与 `SELF_DECIDED` 收口。
- `doc/platform/terminal-coding-standard.md`：TR-08、TR-10、TR-11、TR-16、TR-17 与 §7.1。
- `doc/platform/third-party-library-usage-standard.md`、`doc/platform/implementation-task-template.md`、`doc/decisions/templates/implementation-design-template.md`：第三方依据与详设/计划门槛。
- `tools/terminal-topology/run-dual-device.mjs`、Android topology registry/server、transport session：检查设计引用的当前生产边界和旧 serial/清数据 runner 行为。

## 独立核验重点

- 确认 Round 1 的 M-1/M-2/S-1/S-2 是否由当前详设与计划真正关闭；尤其要求 TP-A7 分开观察 NanoWSD control ping/pong 与 JSON `type=ping/pong`，并保证两端 counters 可取、不记录 payload。
- 虚拟机可能删除重建、serial 会变化；确认任何运行都只使用现场 `adb devices -l` 发现的 serial，以 AVD/物理设备身份和实时显示形态唯一绑定角色；无写死编号、默认 serial 或列表顺序猜测，歧义即 fail closed。
- 确认 stage-1 runner 不会在最终验收时执行 `pm clear` 或等价清数据；无法通过产品路径准备状态时保持 OPEN。
- 复核 TP-A7/A8/A9 的 JVM 真 socket/线程边界及两台 laptop VM T1–T5 全集；VM 结果不替代 JVM 判据。
- 检查非拓扑场景遵循 TR-16 同源码、Web 先于设备；双屏真机和 mobile VM 分别执行全部适用场景；不把静态、focused、截图存在或 harness 结果升级为业务/视觉通过。
- 确认本轮没有实施授权、没有新增设备数据清理授权，任何超出需求的产品/Journey 决策都明确留给 Dexter。

## 期望结论

请给出 `REVIEW_TARGET=DESIGN`、`GO` 或 `NO-GO`、`M/S/N=x/y/z`。每条 finding 请列出精确文档/源码路径与行号、事实或反例、影响及最小修复建议；产品或 Journey 取舍请标 `DEXTER_DECISION`。本次 review 不沿用 Round 1 verdict。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助复核 TER 第三方库整改 v3.3 的详设与实施计划。

背景：需求 v3.3 是本批唯一输入。详设与实施计划已完成两轮 DESIGN 独立盲审，Round 1 的 NO-GO findings 已逐项回源处置；Round 2 是该 cycle 的最后一轮。当前仍未进入实施，IMPLEMENTATION_AUTHORITY=false。虚拟机曾删除重建，ADB serial 会变化，因此运行时必须动态发现并识别设备，不能写死编号。
目标：独立判断设计是否可实施、验收能否证伪，尤其核查拓扑 heartbeat、真 socket、数据清理边界、设备动态识别与完整动态验收范围。

请从 catering-v2s 仓库根阅读：
- `doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-requirements-claude.md`：唯一需求输入 v3.3；
- `doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-implementation-design-codex.md`：详设；
- `doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-implementation-plan-codex.md`：实施计划；
- `doc/review/platform/2026-09-28-ter-third-party-usage-remediation-design-independent-review-round1-codex.md`：Round 1 findings 及处置；
- `doc/review/platform/2026-09-28-ter-third-party-usage-remediation-design-review-checklist-v3.3-round2-codex.md`：Round 2 输入和独立核验范围；
- `doc/review/platform/2026-09-28-ter-third-party-usage-remediation-design-independent-review-round2-codex.md`：Round 2 独立结论 GO、M/S/N=0/0/0；
- `doc/platform/terminal-coding-standard.md`、`doc/platform/third-party-library-usage-standard.md`、`doc/platform/implementation-task-template.md` 与 `doc/decisions/templates/implementation-design-template.md`：适用规范与模板；
- `tools/terminal-topology/run-dual-device.mjs`、`apps/terminal/application/base/android/android/src/main/java/com/catering/v2s/terminal/application/base/android/TerminalTopologyHostRegistry.kt`、同目录 `TerminalTopologyServer.kt`、`apps/terminal/kernel/base/transport/src/foundations/createTopologySession.ts`：当前拓扑执行与 heartbeat owning source。

请重点独立核验：虚拟机重建后的 serial 是否每次通过 `adb devices -l` 动态发现并由 AVD/设备身份及实时形态唯一绑定；runner 是否禁止清除 App 数据；TP-A7 是否分别观察 NanoWSD control ping/pong 与 JSON heartbeat、至少 3 倍生产 timeout 且无非 heartbeat/断连重连；TP-A8 的 18 个 Journey 标签是否 exact-set；JVM 是否经生产 Registry.start 使用真实 socket 并核对线程回到基线；两台 laptop 虚拟机 T1–T5 与非拓扑 Web→双屏真机/mobile 两部分是否完整、顺序正确且授权没有扩大。

烦请给出明确 `GO` 或 `NO-GO`，并写明 `REVIEW_TARGET=DESIGN` 与 `M/S/N=x/y/z`。每条 finding 列出精确路径和行号、影响、最小修复建议；涉及产品或 Journey 取舍的标记 `DEXTER_DECISION`。

授权边界：本次只评审需求、详设与实施计划，不授权源码实施、依赖安装、构建、Web/Metro/Android/虚拟机/真机运行或设备数据清除；是否进入实施由 Dexter 在 review 后另行决定。谢谢。
```
