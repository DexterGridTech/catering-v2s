# TER 第三方库整改静态代码复审请求

## 背景

本批依据需求 v3.4 与已接受详设实施。Dexter 要求先全面复核测试脚本/用例、修复假绿风险，再集中运行测试；本轮补强了拓扑 T3/T4 acceptance oracle 与 runner 的 fail-closed 汇总。此前的 Web、设备和其他动态材料不属于本次 Claude 评审输入。

## 评审目标

请只读复核当前代码与测试：实现是否符合需求及详设、runner 与测试是否能阻止假绿、是否有遗漏或测试自我验证。不要审查、重算或要求补采运行证据，不运行 Web、Metro、Android、设备或拓扑场景。

## 需阅读文件

- `doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-requirements-claude.md`：唯一需求输入，v3.4。
- `doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-implementation-design-codex.md`：实现边界与验收判据。
- `doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-implementation-plan-codex.md`：CP 与测试/runner 要求。
- `tools/terminal-topology/journey-acceptance.mjs`：新增 T3/T4 结构化验收解析与 fail-closed 判定。
- `tools/terminal-topology/run-dual-device.mjs`：拓扑 runner、日志读取、source snapshot 与最终状态绑定。
- `scripts/test/terminal-topology-runner-guards.test.mjs`：本轮相关 helper 与 runner guard 用例。
- `apps/terminal/kernel/base/topology/src/application/createTopologyStateSyncController.ts`、`apps/terminal/application/base/android/android/src/main/java/com/catering/v2s/terminal/application/base/android/TerminalTopologyServer.kt`、`TerminalTopologyHostRegistry.kt`：事件与原因码 owning source。
- `scripts/test/test-health-entry-runner.mjs`：Node 测试的显式分母及执行入口。

## 独立核验重点

- T3 是否要求两个方向各自存在当前旅途产生的 `zlib-base64` 发送事件、相符的接收应用事件与业务状态读回；旧日志、其他 slice、错误方向、摘要不一致不得通过。
- T4 七个计划来源是否有精确且有界的逐项 oracle；角色占用是拒绝新连接且保留 incumbent，不应错误要求 incumbent 断开；缺失、重复、额外或单端原因码不得通过。
- 测试期望值是否独立于被测常量，避免同一错误同时污染实现和 fixture；负例是否分别证伪关键边界。
- 原始 RN 结构化日志与 logcat 前缀是否能被解析；journey baseline 是否能排除旧事件；最终 runner PASS 是否同时要求业务、acceptance、cleanup 与 source stability。
- `terminalSourceSnapshot()` 是否覆盖 runner 运行时读取的全部本地 helper。
- implementation plan §8.1a 的 T4 七来源与 implementation design §8 的 T4 较窄描述存在范围差异。请从当前两个正本指出其对 runner 的影响；不要自行决定缩小产品/验收范围。

本轮已执行的作者侧回归仅供定位：拓扑 guard focused tests 为 11/11 PASS，TER package test 为 27/27 tasks PASS；统一 Node 脚本入口有一项 `L2_SCRIPT_ADMISSION_SOURCE_DRIFT`，属于未修改的 L2 admission 记录摘要，不在本轮改动范围。本次没有运行任何动态场景。以上结果不是 Claude 结论，也不替代独立代码审查。

## 期望结论

请给出 `GO` 或 `NO-GO` 与 `M/S/N=x/y/z`。每条 finding 写明代码/测试路径与行号、具体假绿反例或影响、最小修复建议；若发现需改变详设/计划的事项，标为设计缺口，不要自行更改验收语义。

## 可直接复制给 Claude 的话术

```text
您好 Claude，请对 TER 第三方库整改的当前代码与测试做一次 REVIEW_TARGET=IMPLEMENTATION 静态复审。

背景：本批依据需求 v3.4 与已接受详设实施。Dexter 要求先全面复核测试脚本/用例、修复假绿风险，再集中运行测试。本轮补强了拓扑 T3/T4 acceptance oracle 与 runner 的 fail-closed 汇总。此前 Web、设备和其他动态材料不属于本次评审输入。

目标：请只读复核当前代码与测试，判断实现是否符合需求/详设，以及新增 oracle 与测试能否防止假绿。

请从 catering-v2s 仓库根只读以下当前字节：
- `doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-requirements-claude.md`：唯一需求输入，v3.4；
- `doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-implementation-design-codex.md`：实现边界与验收判据；
- `doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-implementation-plan-codex.md`：CP 与测试/runner 要求；
- `tools/terminal-topology/journey-acceptance.mjs`、`tools/terminal-topology/run-dual-device.mjs`、`scripts/test/terminal-topology-runner-guards.test.mjs`：本轮拓扑验收与测试改动；
- `apps/terminal/kernel/base/topology/src/application/createTopologyStateSyncController.ts`、`apps/terminal/application/base/android/android/src/main/java/com/catering/v2s/terminal/application/base/android/TerminalTopologyServer.kt`、`TerminalTopologyHostRegistry.kt`：事件与原因码 owning source；
- `scripts/test/test-health-entry-runner.mjs`：Node 测试显式分母。

请只做静态代码/测试审查，不检查运行证据、不重算 Web/device manifests、不启动服务或设备、不运行动态场景。重点核验：T3 双向压缩计划/接收应用/业务读回的关联与旧事件排除；T4 七个来源的精确、独立、有界原因码断言；role-occupied 的拒绝新 peer/保留 incumbent 语义；缺失/重复/额外/单端证据是否 fail closed；fixture 是否独立于实现常量；logcat 解析与 baseline；最终 PASS 是否绑定业务、acceptance、cleanup、source stability；source snapshot 是否覆盖所有 runner helper。

注意：implementation plan §8.1a 的 T4 七来源与 implementation design §8 的 T4 较窄描述存在范围差异。请指出这是否构成设计缺口，不要自行缩小验收范围。

作者侧仅供背景的测试结果：拓扑 guard focused tests 11/11 PASS，TER package test 27/27 tasks PASS；统一 Node 脚本入口有一项未修改 L2 admission 记录的 `L2_SCRIPT_ADMISSION_SOURCE_DRIFT`。请独立判断代码，不把作者测试结果当成审查结论。本轮没有运行动态场景。

烦请给出 `GO` 或 `NO-GO` 与 `M/S/N=x/y/z`。每条 finding 请给出精确路径/行号、假绿反例或影响、最小修复；需要改详设/计划的标成设计缺口，不改变验收语义。

授权边界：本次只请求静态代码与测试复审，不授权修改代码、补采运行证据或启动 Web、Metro、Android、设备/VM、L2、DEV、seed、reset、UAT。谢谢。
```
