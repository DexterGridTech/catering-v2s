# TER 虚拟键盘优化正式需求：Claude review handoff

## 背景

Dexter 已给出 TER 虚拟键盘优化的分析问题与 Q1–Q6 裁定。本轮据此完成正式需求，覆盖四种键盘的全宽与方角、full 键盘 Shift/空格/URL 符号、键盘覆盖非键盘 UI、按输入框中心计算并限制整体位移、必要时内部滚动，以及 A→B 切换与动画同步。

本稿已由 fresh 独立子 agent 完成两轮 DESIGN 对抗审查。第一轮 `GO_WITH_UNVERIFIED_UI，M/S/N=0/0/0`；第二轮 `NO-GO，M/S/N=0/1/0`，唯一 S-1 是一次性 Shift 在焦点切换后的状态归属不明确。作者随后回源自决为“仅属于当前字段的当前焦点会话，真正离开即清除”，并补充同布局 resize 仍原位适配的规则。因两轮上限已用完，修订后的字节没有第三轮独立 agent verdict；需求稿如实标记为 `REQUIREMENTS_SELF_DECIDED_AFTER_ROUND_2`，请 Claude 对当前最终字节独立复核。

## 评审目标

请判断正式需求是否完整、无相互矛盾且可供后续 IA/详设使用，重点核验：A–D 与 Q1–Q6 是否逐项准确落地；Shift 焦点会话清除规则是否是 Dexter 原裁定的合理收敛；键盘全宽、方角、overlay、`|offsetY|≤K`、完整输入框可见优先及内部滚动能否同时成立；旧正本覆盖范围是否正确；需求有没有越界定义 IA 或实施细节。

## 需阅读文件

- `doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-formal-requirements-codex.md`：当前待审正式需求，是本轮的主要核验对象。
- `doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-requirements-analysis-codex.md`：问题分析与 Q1–Q6 裁定回填，用于核对需求来源。
- `doc/review/platform/2026-09-23-ter-virtual-keyboard-optimization-requirements-adversarial-review-round1-codex.md`：第一轮独立 verdict、输入清单及作者补充源码核验边界。
- `doc/review/platform/2026-09-23-ter-virtual-keyboard-optimization-requirements-adversarial-review-round2-codex.md`：第二轮独立 NO-GO 与唯一 S-1。
- `doc/review/platform/2026-09-23-ter-virtual-keyboard-optimization-requirements-review-response-codex.md`：finding 回源分类、作者自决及未复审边界。
- `doc/plans/platform/2026-09-05-v2s-terminal-input-requirements-claude.md`：检查既有虚拟键盘收缩、焦点切换和输入 owner 规则是否被明确覆盖。
- `doc/plans/platform/2026-09-06-v2s-terminal-input-keyboard-visual-redesign-requirements-v2-codex.md` 与 `doc/plans/platform/2026-09-06-v2s-terminal-input-surface-form-requirements-codex.md`：核对 CAPS、键位、旧 dock 尺寸及承载模型边界。
- `doc/plans/platform/2026-09-19-ter-terminal-input-keyboard-visual-implementation-design-codex.md`：检查旧视觉详设与当前需求的冲突覆盖范围。
- `apps/terminal/ui/base/input/src/foundations/editText.ts`、`apps/terminal/ui/base/input/src/hooks/useInputField.ts`、`apps/terminal/ui/base/input/src/hooks/useInputFocusController.ts`：核验 Shift 状态存储、插入消费、焦点交接及关闭行为。
- `doc/platform/review-standard.md` 与 `doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md`：核对 verdict 分类与 review 边界。

## 独立核验重点

- 按 Dexter 原始 A–D、位移上限补充与 Q1–Q6 逐条核对，不以摘要替代原分析稿。
- 检查 R01 对 surface/field placement 的全宽要求是否定义一致；R02 是否只约束外框。
- 检查 full/alpha 的 CAPS 清除、full 的 Shift/空格交换、十二个 URL 符号可达性及 Shift 一次性消费规则；尤其核验焦点切换时“离开当前字段焦点会话即清除”，是否与产品意图及现有 per-field owner 一致，是否还有系统键盘接管、中间 blur、focus-next 或字段卸载反例。
- 检查同布局 A→B、同布局 resize、modifier 切换、异布局交接和跨 surface 场景；键盘与内容动画是否同段完成，期间也守住位移上限及焦点框可见性。
- 对照 2026-09-05/06/19 正本，核验旧内容收缩模型、旧 dock 几何、CAPS/无空格规则只在明示范围内被替代；系统 IME 与业务语义没有被无意改写。
- 核验 PIN 锚点、内部滚动承载、容量不足恢复和受保护 focus scope 的要求是否诚实表达为待后续设计解决的问题，而非虚称当前能力。
- 主动给出反例，判断内部滚动能否补足输入框完整可见、又不导致 UI 变形；核验十二个字符、空格键和最小宽高边界的验收分母是否明确。

## 期望结论

请明确给出 `GO` 或 `NO-GO`，并给出 `M/S/N` 数量。每条 finding 请提供精确仓库相对路径与行号、反例和影响面、最小修复建议，并注明是否需要 Dexter 的产品裁决。作者自决修订尚未获得独立复评，请勿把先前第一轮 GO 或第二轮原始 NO-GO 自动投射为当前字节 verdict。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请独立评审 TER 虚拟键盘优化正式需求。

背景：Dexter 已提供分析稿和 Q1–Q6 裁定，Codex 据此形成正式需求。独立子 agent 两轮审查中，第一轮为 GO_WITH_UNVERIFIED_UI，M/S/N=0/0/0；第二轮为 NO-GO，M/S/N=0/1/0，唯一 S-1 是一次性 Shift 在焦点切换后的状态归属不清。作者回源后自决为“Shift 只属于当前字段的当前焦点会话，真正离开即清除”，并修正了同布局 resize 仍应原位适配的规则。两轮审查上限已用完，当前字节没有第三轮独立 agent verdict；请以当前正式需求字节为对象重新独立判断。

目标：判断需求是否完整、一致、可供后续 IA/详设使用；特别核验 Shift 焦点会话规则、全宽/方角、overlay 与内容避让公式、位移上限、焦点框完整可见、内部滚动及键盘切换动画能否共同满足用户意图。

请从 catering-v2s 仓库根阅读：
- `doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-formal-requirements-codex.md`：当前正式需求，主要评审对象；
- `doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-requirements-analysis-codex.md`：原问题分析与 Dexter 裁定；
- `doc/review/platform/2026-09-23-ter-virtual-keyboard-optimization-requirements-adversarial-review-round1-codex.md`、`doc/review/platform/2026-09-23-ter-virtual-keyboard-optimization-requirements-adversarial-review-round2-codex.md`、`doc/review/platform/2026-09-23-ter-virtual-keyboard-optimization-requirements-review-response-codex.md`：两轮独立结论和作者处置；
- `doc/plans/platform/2026-09-05-v2s-terminal-input-requirements-claude.md`、`doc/plans/platform/2026-09-06-v2s-terminal-input-keyboard-visual-redesign-requirements-v2-codex.md`、`doc/plans/platform/2026-09-06-v2s-terminal-input-surface-form-requirements-codex.md`、`doc/plans/platform/2026-09-19-ter-terminal-input-keyboard-visual-implementation-design-codex.md`：需要核对的既有输入与视觉正本；
- `apps/terminal/ui/base/input/src/foundations/editText.ts`、`apps/terminal/ui/base/input/src/hooks/useInputField.ts`、`apps/terminal/ui/base/input/src/hooks/useInputFocusController.ts`：Shift 和焦点 owner 的当前源码事实；
- `doc/platform/review-standard.md`：评审 finding 与证据口径。

请重点独立核验：A–D 与 Q1–Q6 是否逐条落地；Shift 在 A 按下后切到 B、再回 A、focus-next、系统键盘接管及中间 blur 时的状态是否符合产品意图；同布局切字段、resize 和 modifier 是否被正确区分；键盘覆盖、非键盘 UI 不变形、|offsetY|≤K、输入框完整可见优先与内部滚动是否可以同时成立；旧收缩、旧圆角/宽度及 CAPS 规则的正本替代范围是否准确；是否存在需求缺项或越界冻结实现方案。

烦请给出明确 `GO` 或 `NO-GO`，并标注 `M/S/N`。每条 finding 请写精确路径与行号、反例、影响面、最小修复建议，并注明是否需要 Dexter 产品裁决。请单独说明这次 verdict 针对当前字节，不沿用此前任一轮 verdict。

授权边界：本次仅请求正式需求的独立 review。review 结论不授权编写 IA、详设、实施计划、源码/测试修改或 Web/Android/设备动态验证；后续阶段由 Dexter 另行指示。谢谢。
```
