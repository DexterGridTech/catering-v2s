# TER admin console 需求正本 · Claude 独立评审请求

REVIEW_CYCLE_ID=TER_ADMIN_CONSOLE_REQUIREMENTS_20260911
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=CLAUDE_EXTERNAL_REVIEWER

## 背景

本轮只评 TER admin console、设备形态维度、primitives 补齐、系统键盘退役，以及设备标识和调试态两项 runtime capability 的需求正本，不评详设或实施。

需求正本由 Claude 根据两版 POC 逐行分析和 Dexter 九轮、32 条裁定形成；作者随后自行组织两轮 fresh 子 agent 盲审，五个 agent 合计报告 8M、32S、21N，两轮均 NO-GO，作者又逐条处置并重写。由于这些盲审由作者组织，它们对本次评审不构成独立质量证明，只能作为作者声称已处理过的 checklist。

Codex 已从当前仓库字节重开需求正本、上游讨论稿、owning source 与旧 POC source，形成独立输入：
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B
VERDICT=NO-GO
M/S/N=10/16/4

该输入不是新的权威，也不替代 Claude 的独立判断。当前没有启动 Web、Android、DEV、seed、UAT、部署或任何动态环境。

## 评审目标

请独立验证：

1. 入口 gate 是否应使用 displayMode，还是上游 Q-8 已决定的 isHostPrimaryDisplay；特别验证单显示器 SLAVE+VICE、power role 变化和 D-5。
2. DeviceInfo.deviceId 的“同步可读”要求是否与当前 DevicePort 六个 Promise 方法相容；确认最小 async assembly 方案是否足够。
3. layer-only admin entry 使用空 containerKeys 时，是否真的能与同一 UiCatalog、selectAvailableParts 和 LayerStack 形成单一路径。
4. selectAvailableParts、resolvePart、showScreen/openLayer actors 是否能真正强制所有 production parts 的 shape admission，而不是只新增一个 consumer。
5. LayerStack 当前 0→非 0 的 surface-level focus broadcast 是否满足 nested admin/business layer 的 A-15；验证实施顺序是否把 proof 放早了。
6. 360×800 portrait、debug pack-time/startup-time precedence、mobile shell/navigation 是否已有 Dexter 的明确裁决；若没有，必须标为 DEXTER_DECISION。
7. 53 条判据是否可以被恶意但字面合规的实现通过，尤其是恒真、只查存在、缺 comparator、缺 denominator、错误 source 和错误 evidence tier。
8. 94 条覆盖计数是否为实质闭环；逐项重查 §9.2 的 22 个“不需要判据”条目。
9. UI 操作是否来自已批准 Journey/IA，是否符合用户当下任务，是否有更短路径；区分接口限制、owner 边界、历史文档模糊和产品语义未裁决。

## 需阅读文件

请从 catering-v2s 仓库根直接打开：

- doc/plans/platform/2026-09-11-v2s-terminal-admin-console-and-primitives-requirements-claude.md：本轮需求正本；
- doc/review/platform/2026-09-11-v2s-terminal-admin-console-poc-analysis-and-design-discussion-claude.md：两版 POC 逐行分析和 Dexter 讨论裁定；
- doc/review/platform/2026-09-11-v2s-terminal-admin-console-requirements-independent-review-codex.md：Codex 独立复核结果、F1-F47、A-1..A-53 反例、覆盖审计；
- AGENTS.md、PLATFORM-BLUEPRINT.md、doc/platform/review-standard.md：仓库边界和 review 规则；
- project-memory/decisions/deterministic-context-only.md、project-memory/operations/claude-review-handoff-standard.md：当前上下文和 Claude 交接边界；
- apps/terminal/kernel/base/display-context/src/foundations/displayDerivation.ts：displayMode、power role、SLAVE eligibility；
- apps/terminal/kernel/base/display-context/src/application/createDisplayContextModule.ts、apps/terminal/kernel/base/display-context/src/features/actors/switchInstanceModeActor.ts：command registration 和内部 dispatch；
- apps/terminal/kernel/base/ui-state/src/foundations/catalog.ts、apps/terminal/kernel/base/ui-state/src/features/resolvePart.ts、apps/terminal/kernel/base/ui-state/src/features/actors/contentActors.ts：catalog、shape、direct actor admission；
- apps/terminal/ui/base/render/src/components/LayerStack.tsx：layer selection、focus broadcast、layout；
- apps/terminal/kernel/base/platform-ports/src/types/device.ts、apps/terminal/kernel/base/platform-ports/src/defaults/unavailableDevice.ts：DeviceInfo/DevicePort contract；
- apps/terminal/adapter/android/device/src/implementations/androidDevice.ts、apps/terminal/ui/base/dev-host/src/implementations/webPlatform.ts：当前 adapter 能力；
- apps/terminal/ui/base/primitives/src/types/types.ts、apps/terminal/ui/base/primitives/src/components/PrimitiveButton.tsx、apps/terminal/ui/integration/sample-console/theme/global.css：input/primitives/token source；
- apps/terminal/ui/feature/sample-member-desk/src/components/MemberForm.tsx、apps/terminal/ui/feature/sample-member-desk/src/hooks/useInputField.ts：现有 system keyboard consumer；
- apps/terminal/ui/integration/sample-console/package.json、apps/terminal/assembly/android/sample-terminal/App.tsx：当前 canvas declaration/consumer；
- 旧 POC 的 source 路径由上游讨论稿逐项列出，但位于 catering-v2s 仓库外；只作为 source observation，不冒充仓根相对文件，当前结论以本仓 owning source 为准。

## 独立核验重点

请以当前 source 为真相，逐条给出：

- CONFIRMED、PARTIALLY_CONFIRMED、REJECTED_WITH_EVIDENCE、UNVERIFIED_REQUIRES_EVIDENCE 或 DEXTER_DECISION；
- 仓根相对路径与行号或唯一符号；
- 失败场景、影响面、最小修复方向，以及是否需要 Dexter 裁决；
- static、focused、Web、Android、native/device、release/DCE evidence 的严格区分。

请特别检查以下作者承重点：selectAvailableParts production zero call、resolvePart 无 dimension compare、当前 checked adapters 的 getDeviceInfo unavailable、DeviceInfo.deviceId slot、LayerStack 0→非 0 focus broadcast、SLAVE 单显示 eligibility、switchInstanceMode 的“zero dispatcher”措辞、ADAPTER_NOT_INJECTED 的方法级范围、dual-screen 两处 imeVisible 条件、showSoftInputOnFocus optional prop、portrait SECONDARY parser、transport 空壳与 installPeerDispatchGateway。

请对 A-1..A-53 各构造一个明显不符合需求意图但能通过字面判据的实现；请重新枚举 AC/ID/DBG/IN/PR/CT 条款，不能仅复读目标文档的 94/94 结论；请逐项审计 §9.2 的 22 个“不需要判据”条目。

不要启动 Web、Android、DEV、seed、UAT 或部署；本轮不需要实现、改源码、改测试、补依赖或写详设。

## 期望结论

请给出明确的 GO 或 NO-GO，并给出 M/S/N 计数。不要把作者自组织的两轮盲审当作独立证据，不要把 Codex review 当作必须接受的 verdict。若你不同意某项，请给出当前 source 的反证或明确标 UNVERIFIED_REQUIRES_EVIDENCE / DEXTER_DECISION，不要用确定语气替代证据。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助对 TER admin console 需求正本做一次独立 DESIGN review。

背景：本轮只评 doc/plans/platform/2026-09-11-v2s-terminal-admin-console-and-primitives-requirements-claude.md，不评详设或实施。该文档由 Claude 根据两版 POC 分析和 Dexter 九轮 32 条裁定形成；作者后来自行组织两轮盲审并处置。那些盲审由作者组织，对你不构成独立质量证明，只能当作作者声称已处理过的 checklist。Codex 已重开当前源码，形成 NO-GO（M/S/N=10/16/4），但该结论也只是独立输入，不是请你照单全收的权威。

目标：请从当前源码独立核验入口主显示 gate、DevicePort async/sync 与 deviceId、layer-only catalog/admission、LayerStack nested focus、portrait 数字尺寸、debug precedence、system keyboard migration、53 条判据的恶意通过反例、94 条覆盖及 §9.2 no-criterion 分类；同时判断 hidden gesture、密码登录、shell/mobile navigation、close/back、三项 read-only section 是否来自已批准 Journey/IA、是否符合用户任务、是否存在更短路径。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-09-11-v2s-terminal-admin-console-and-primitives-requirements-claude.md：需求正本；
- doc/review/platform/2026-09-11-v2s-terminal-admin-console-poc-analysis-and-design-discussion-claude.md：上游讨论和 Dexter 裁定；
- doc/review/platform/2026-09-11-v2s-terminal-admin-console-requirements-independent-review-codex.md：Codex 独立复核输入；
- apps/terminal/kernel/base/display-context/src/foundations/displayDerivation.ts、apps/terminal/kernel/base/ui-state/src/foundations/catalog.ts、apps/terminal/kernel/base/ui-state/src/features/resolvePart.ts、apps/terminal/kernel/base/ui-state/src/features/actors/contentActors.ts：display、catalog、shape、actor admission；
- apps/terminal/ui/base/render/src/components/LayerStack.tsx、apps/terminal/kernel/base/platform-ports/src/types/device.ts：focus/layer 和 DevicePort contract；
- apps/terminal/ui/feature/sample-member-desk/src/components/MemberForm.tsx、apps/terminal/ui/base/input/src/hooks/useInputField.ts、apps/terminal/ui/base/primitives/src/types/types.ts：system keyboard consumer 和 input prop；
- 旧 POC source 路径请以 upstream discussion 中的逐行引用为准；这些文件在本仓外，本轮不把它们当作仓根相对材料。

请对每条 finding 标注 CONFIRMED、PARTIALLY_CONFIRMED、REJECTED_WITH_EVIDENCE、UNVERIFIED_REQUIRES_EVIDENCE 或 DEXTER_DECISION，并给出仓根相对路径与行号/唯一符号、失败场景、影响面、最小修复方向、是否需要 Dexter 裁决。请严格区分 static、focused、Web、Android、native/device、release/DCE；不要把 focused test、welcome 文本完整、历史 handoff 或 review GO 扩写为完整视觉验收 PASS。

请给出明确 GO 或 NO-GO 及 M/S/N 计数，并单独列出你推翻的作者结论和本轮范围内文档漏掉的问题。不要启动 Web、Android、DEV、seed、UAT 或部署，不要修改源码、测试、依赖、需求正本或详设。

授权边界：本次只请求对需求正本的独立 review。你的 GO/NO-GO 不授权作者或 Codex 修改源码、测试、依赖、契约、详设、实施计划，或启动任何动态环境；需求修订、产品/Journey 决策和后续实施授权仍由 Dexter 单独决定。谢谢。
```
