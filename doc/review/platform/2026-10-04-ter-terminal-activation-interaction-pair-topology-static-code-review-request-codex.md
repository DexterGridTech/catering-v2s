# TER 终端激活交互与双机拓扑专项 · 当前源码静态代码复核请求

## 背景

本专项按已接受需求、Journey、IA、交互工件、详设与实施计划完成了主要 TER owner、composition、UI 和测试脚本实现。当前 CP 记录作为实施过程材料保留；本轮不要求核对 CP/6b/13c、日志、manifest、历史运行或任何业务/cleanup 证据。

Dexter 已明确：本轮只检查当前源码是否满足详设的功能要求，以及实现是否足够简单、高效、健壮。Android/Web/DEV 的动态证据留待完整 UiAutomator 包就绪后另行处理。当前 Android 设备编排仍依赖 `scripts/test/ter-virtual-keyboard-android.mjs` 的具名动作；实施计划 §9.2 第 6 项提到的 `scripts/test/ter-terminal-interaction-android.mjs` 当前尚未建立，请按源码与计划判定其代码缺口，不要转为运行证据审查。

本轮曾调研第三方 Android 自动化工具；Maestro CLI/MCP 仅作为候选，尚未安装、接入或改变依赖。本轮不评估或要求引入该工具。

## 评审目标

请对当前生产代码及测试/runner 源码做独立静态代码复核，判断：

- 行为是否满足正式需求与详设，尤其是唯一 owner command/selector 通路、激活与取消、当前服务空间切换、主副角色/投影、断链遮罩与恢复、配置失败边界、会员并发/迟到结果、壁纸隔离及登录/登出；
- 三包职责与 composition 接线是否清晰，是否存在重复事实、绕过 owner、跨层反向依赖或遗漏路径；
- 代码及测试脚本是否采用足够简单的实现，是否有明显低效、脆弱假设、状态竞态、错误顺序、字段/身份传错、错误吞没或假绿风险；
- Android runner 源码现状是否符合详设与计划。仅依据当前源码判断，不评估任何运行证据。

## 需阅读文件

- `AGENTS.md`、`CLAUDE.md`：本仓协作、授权和评审边界。
- `doc/platform/review-standard.md`、`doc/platform/terminal-coding-standard.md`、`doc/platform/frontend-coding-standard.md`：静态代码审查适用规范。
- `doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-and-pair-topology-formal-requirements-codex.md`：本专项正式需求与 R-01～R-16、V-01～V-20。
- `doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-pair-topology-journey-codex.md`：批准的用户旅程。
- `doc/decisions/2026-10-02-ter-terminal-activation-interaction-pair-topology-ia-codex.md`：页面与信息架构。
- `doc/decisions/2026-10-02-ter-terminal-activation-interaction-pair-topology-ui-interaction-codex.md`：控件、状态、测试标识及交互工件。
- `doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-pair-topology-implementation-design-codex.md`：实现 owner、跨包边界、行为和验收设计。
- `doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-pair-topology-implementation-plan-codex.md`：CP 实施形态与代码/脚本要求。
- `apps/terminal/kernel/base/terminal-data-client/`、`apps/terminal/kernel/base/server-config/`、`apps/terminal/kernel/base/topology/`、`apps/terminal/kernel/base/transport/`：激活凭证、服务配置、拓扑与通信 owner 的实现及测试。
- `apps/terminal/ui/base/terminal-activation/`、`apps/terminal/ui/base/server-config-panel/`、`apps/terminal/ui/base/admin-shell/`、`apps/terminal/ui/base/integration-assembly/`：激活/配置 UI、admin 恢复与 composition 实现及测试。
- `apps/terminal/ui/integration/sample-console/`、`apps/terminal/ui/integration/sample-wallpaper-console/`：两种集成入口、阶段路由、同步与测试。
- `apps/terminal/kernel/feature/sample-staff-session/`、`apps/terminal/kernel/feature/sample-member-registry/`、`apps/terminal/ui/feature/sample-staff-auth/`、`apps/terminal/ui/feature/sample-member-desk/`、`apps/terminal/ui/feature/sample-wallpaper-picker/`：店员、会员和壁纸功能实现及测试。
- `scripts/test/ter-admin-display-web.mjs`、`scripts/test/ter-admin-display-web.test.mjs`：Web 测试脚本与静态用例。
- `scripts/test/ter-virtual-keyboard-android.mjs`、`scripts/test/ter-virtual-keyboard-android.test.mjs`：Android 受管动作脚本及测试。
- `tools/terminal-topology/run-dual-device.mjs`、`tools/terminal-topology/journey-acceptance.mjs` 及对应测试：本专项复用的双机拓扑脚本源码；只读代码，不读取其运行产物。

## 独立核验重点

1. 先从正式需求与详设提取预期行为，再检查实际 owner、command/selector、UI 与 composition 调用链；不要将设计文档中的实现声明视为源码事实。
2. 检查同根实现全集：两个 integration、四个内容面及适用的 MASTER/SLAVE、PRIMARY/SECONDARY/CHIEF/VICE 组合；配置/凭证/拓扑状态是否由唯一 owner 保存和读取。
3. 对激活、取消激活、服务空间切换、登录/登出、配置保存/清除/恢复、成员新增与确认/拒绝、壁纸选择/退出、断链遮罩与恢复等路径，追踪成功、拒绝、异步迟到、重复操作及持久化/同步失败分支。
4. 检查 Android/Web runner 源码中的命令顺序、输入与显式提交、屏幕和业务断言、失败后停止、状态读回、日志脱敏及 cleanup ownership。当前不存在的专项 Android 薄编排入口请注明其是否构成详设/计划要求下的代码缺口。
5. 主动寻找简单替代方案与反例，指出不必要的抽象、重复层、脆弱 UI 选择器、依赖隐含状态或可能误报 PASS 的分支；仅凭代码评审，不要求补采任何运行材料。

**严格排除**：不查看或比较 `.runtime/` 下的 run manifest、日志、截图、报告及历史运行；不运行命令、测试、构建、verify、Web/Android/VM/DEV；不以缺少动态证据作为本轮 finding。后续完整 UiAutomator 包就绪后再单独处理动态证据。

## 期望结论

请给出明确 `GO` 或 `NO-GO` 与 `M/S/N=x/y/z`。每条 finding 给出当前仓库相对路径与行号、源码事实、反例或失效条件、影响面、最小可验收修正，以及是否需要 Dexter 产品裁决。区分已证实的静态事实与推论；不要把旧 review、CP 对账或作者报告当成本轮结论。

## 可直接复制给 Claude 的话术

```text
您好 Claude，请对《TER 终端激活交互与双机拓扑优化专项》当前代码做一次独立静态代码复核。

背景：本专项按已接受需求、Journey、IA、交互工件、详设与实施计划完成了主要 owner、composition、UI 和测试脚本实现。Dexter 要求本轮先看当前源码是否符合详设功能要求，以及实现是否足够简单、高效、健壮。Android/Web/DEV 运行证据留待完整 UiAutomator 包就绪后另行处理。请不要复核历史运行、CP/6b/13c 或任何 `.runtime/` 证据。

目标：只读审查当前生产源码与测试/runner 源码。核验需求和详设中的行为是否由真实调用链实现，三包职责及 owner 边界是否保持，关键正常/拒绝/竞态/失败路径是否健壮，并检查是否存在可删的重复机制、脆弱假设或假绿风险。不要运行命令、测试、构建、verify、Web、Android、VM 或 DEV，也不要要求本轮补交运行证据。

请从 catering-v2s 仓库根阅读：
- `AGENTS.md`、`CLAUDE.md`、`doc/platform/review-standard.md`、`doc/platform/terminal-coding-standard.md`、`doc/platform/frontend-coding-standard.md`：协作边界与代码规范；
- `doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-and-pair-topology-formal-requirements-codex.md`：正式需求 R-01～R-16 与 V-01～V-20；
- `doc/decisions/2026-10-02-ter-terminal-activation-interaction-pair-topology-journey-codex.md`、`doc/decisions/2026-10-02-ter-terminal-activation-interaction-pair-topology-ia-codex.md`、`doc/decisions/2026-10-02-ter-terminal-activation-interaction-pair-topology-ui-interaction-codex.md`：批准的 Journey、IA 与交互状态；
- `doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-pair-topology-implementation-design-codex.md`、`doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-pair-topology-implementation-plan-codex.md`：代码边界、调用链和预期实现形态；
- `apps/terminal/kernel/base/terminal-data-client/`、`server-config/`、`topology/`、`transport/`：owner 实现与测试；
- `apps/terminal/ui/base/terminal-activation/`、`server-config-panel/`、`admin-shell/`、`integration-assembly/` 和 `apps/terminal/ui/integration/sample-console/`、`sample-wallpaper-console/`：UI、admin、composition 与阶段路由；
- `apps/terminal/kernel/feature/sample-staff-session/`、`sample-member-registry/`、`apps/terminal/ui/feature/sample-staff-auth/`、`sample-member-desk/`、`sample-wallpaper-picker/`：店员、会员与壁纸实现及测试；
- `scripts/test/ter-admin-display-web.mjs`、`scripts/test/ter-admin-display-web.test.mjs`、`scripts/test/ter-virtual-keyboard-android.mjs`、`scripts/test/ter-virtual-keyboard-android.test.mjs`：测试脚本源码；
- `tools/terminal-topology/run-dual-device.mjs`、`tools/terminal-topology/journey-acceptance.mjs` 与对应测试：专项复用的双机拓扑代码。请不要打开这些入口在 `.runtime/` 下生成的证据。

请特别核验唯一 owner command/selector 通路、激活和取消、切换服务空间、主副角色/投影、断链遮罩和本机 admin 恢复、配置持久化/同步失败、会员两端 pending 与迟到结果、登录/登出、壁纸隔离，以及脚本是否按顺序输入并显式提交、是否读取业务结果、首次失败后是否停止业务操作。实施计划 §9.2 第 6 项提到的 `scripts/test/ter-terminal-interaction-android.mjs` 当前尚未建立，请据详设与计划判断其代码缺口，不要把这个问题转化为运行证据比较。

本轮严格只做静态源码审查：不看、不比较 `.runtime/` 运行产物，不运行测试或其他命令，不要求动态证据；动态证据留待完整 UiAutomator 包就绪后处理。请给出 `GO` 或 `NO-GO` 与 `M/S/N=x/y/z`；每项 finding 附当前源码路径/行号、事实与失效条件、影响、最小修正和是否需要 Dexter 产品裁决。区分源码事实与推论，不继承旧 verdict。

授权边界：本轮仅请求只读静态代码复核，不授权修改源码、测试、依赖、脚本或文档，不授权任何测试、构建、verify、Web、Android、VM、DEV、reset/seed、L2、UAT 或部署。谢谢。
```
