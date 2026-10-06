# TER automation-agent implementation review handoff

## 背景

TER automation-agent 批次一已完成 CP-01～CP-06、批次级 6b、批准范围内的两个主旅途 Web→Android 验收，以及 console 的 TDP `DEV-DATA-01` selector 读回。当前 fresh 独立源码 implementation review 为 `GO`、`M/S/N=0/0/0`。本轮随后关闭了 13c 指出的两项对账差异：同步 `createTestId` options 参数签名，并在详设中登记实际直接使用的 `source-map@0.6.1`。

## 评审目标

请只对当前生产代码、测试/runner 源码及其与已批准详设功能要求的对应关系做静态 review，判断实现是否符合功能要求、是否简单、高效、健壮。不得要求或复核动态运行 evidence；缺少运行证据不构成本轮 finding。

## 需阅读文件

- `doc/plans/platform/2026-10-05-ter-automation-agent-formal-requirements-claude.md`：正式需求与功能边界。
- `doc/plans/platform/2026-10-05-ter-automation-agent-implementation-design-claude.md`：批准详设与实现判据。
- `doc/plans/platform/2026-10-05-ter-automation-agent-implementation-plan-claude.md`：CP 范围及本批收敛后的主要 Journey。
- `doc/review/platform/2026-10-06-ter-automation-agent-final-verification-codex.md`：范围与排除项导航；其中运行记录不作为本轮 review 对账输入。
- `apps/terminal/ui/base/automation-agent/`：终端自动化 agent 实现。
- `apps/terminal/kernel/base/runtime/`：selector 声明、注册、订阅与读取实现。
- `apps/terminal/kernel/base/terminal-data-client/`：TDC 操作 fixture 与验收实现。
- `tools/terminal-automation/`：driver、journey、selectors/request 观察、设备与测试实现。
- `scripts/test/terminal-automation.mjs`：受管 runner 入口。
- `tools/terminal-skeleton/check-static.mjs`、`tools/terminal-runtime/check-static.mjs`：保留的静态约束门。
- `.agents/skills/cs-terminal-automation/SKILL.md`：当前自动化 skill；仅核对其与当前 API/源码一致性。

## 独立核验重点

- agent、driver、Runtime selector/command 的职责和唯一通路；selector 生命周期、请求结果观察及资源释放。
- Web 与 Android 主 Journey 是否由真实 UI 输入/点击驱动，业务结果是否通过 selector/request 观察，不以直 dispatch 代替。
- console 的 TDP 数据变化场景是否订阅 `store-basic` selector、观察 CBS 更新并恢复原值；检查源码逻辑即可，不要求运行日志或运行报告。
- serverSpace business/TDS 地址注入、Android 设备身份及 runner manifest/资源归属处理。
- TestId 强类型构造、使用点、现有 consumer 与自动化目标是否相符；纯展示 primitive 无需为了 review 补 testID。
- `createTestId(module, part, {element?, key?})` 的 API 形态在实现、mock、skill 与详设中是否一致；`source-map` 的直接依赖及当前使用范围是否符合详设。
- 旧 UI runner 退役、受保留的静态门和 TDC 协议验收是否仍有正确边界。
- 静态判断不得被旧运行、源码 mtime、manifest 或 run evidence 替代；本轮无需读取或复核 `.runtime/`。

以下未执行项目是 Dexter 明确排除的范围，必须继续视为 `NOT_RUN`，不得要求补充证据，也不得仅因缺少这些证据形成 finding：F-4b、geometry、F-1/F-2、非主要 Journey、额外拓扑、未迁移旧场景、Android 双屏/双机、L2、UAT。静态源码本身若违反已批准功能要求，仍可按代码 finding 报告。

## 期望结论

请给出明确 `GO` 或 `NO-GO` 与 `M/S/N`。每条 finding 写明详设条款、生产/测试源码精确路径与行号、代码事实、影响及最小修正；需要产品裁决时明确标注。只报告当前代码层结论，不评价历史运行或要求扩展动态验证。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请对 TER automation-agent 批次一当前代码做一轮独立静态 review。

背景：本批已完成 CP-01～CP-06、批次级 6b，以及授权范围内的主要 Journey；此前 fresh 独立源码 review 为 GO、M/S/N=0/0/0。随后已关闭 13c 提出的 API 文档同步与 source-map 依赖登记差异。本轮请依据当前需求、详设和源码独立判断，不继承历史 verdict。

目标：只检查当前生产代码、测试/runner 源码是否符合批准的功能要求，并判断实现是否简单、高效、健壮。请不要复核运行 evidence，也不要要求任何动态证据；缺少动态证据不构成本轮 finding。

请从 catering-v2s 仓库根阅读：
- `doc/plans/platform/2026-10-05-ter-automation-agent-formal-requirements-claude.md`：正式需求；
- `doc/plans/platform/2026-10-05-ter-automation-agent-implementation-design-claude.md`：详设与验收设计；
- `doc/plans/platform/2026-10-05-ter-automation-agent-implementation-plan-claude.md`：实施范围与收敛后的执行面；
- `doc/review/platform/2026-10-06-ter-automation-agent-final-verification-codex.md`：仅用于识别范围和证据边界，不核验其中的运行 evidence；
- `apps/terminal/ui/base/automation-agent/`、`apps/terminal/kernel/base/runtime/`、`apps/terminal/kernel/base/terminal-data-client/`：agent、selector 与 TDC；
- `tools/terminal-automation/`、`scripts/test/terminal-automation.mjs`：driver、Journey 与受管入口；
- `tools/terminal-skeleton/check-static.mjs`、`tools/terminal-runtime/check-static.mjs`：保留的静态约束；
- `.agents/skills/cs-terminal-automation/SKILL.md`：当前 skill/API 一致性。

请重点检查职责边界、真实 UI 操作与业务 selector/request 观察、TDP selector 更新路径、DEV 地址/设备身份注入、TestId 强类型和实际自动化目标、`createTestId(module, part, {element?, key?})` 的调用一致性、`source-map@0.6.1` 的直接使用、旧 runner 退役与保留门的边界。请只用当前源码与设计判据，不读取 `.runtime/` 或要求运行记录。

Dexter 明确未要求运行且不得作为证据缺口或 finding 的项目包括：F-4b、geometry、F-1/F-2、非主要 Journey、额外拓扑、未迁移旧场景、Android 双屏/双机、L2、UAT。若代码本身违反批准需求，仍可报告静态代码问题。

烦请给出明确 `GO` 或 `NO-GO` 与 `M/S/N`。每条 finding 请列详设条款、当前生产/测试代码精确路径与行号、事实、影响和最小修正；需要产品裁决时单独注明。请勿把未要求运行的场景或缺失运行 evidence 列为 finding。

授权边界：本轮仅为静态代码 review，不授权源码修改、测试执行、构建、verify、DEV、Expo Web、Android、reset/seed、L2、UAT 或部署。谢谢。
```
