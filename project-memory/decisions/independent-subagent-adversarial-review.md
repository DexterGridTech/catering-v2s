---
id: decisions.independent-subagent-adversarial-review
status: active
layer: routed
taskKinds: ["design","implementation","review","testing"]
domains: ["platform","backend","contract","admin-ui"]
consumerFaces: ["all"]
owners: ["platform","backend","product"]
impacts: ["governance","evidence","architecture","contract","database"]
triggers: ["task-start","review","implementation"]
assertions: ["INDEPENDENT_SUBAGENT_REQUIRED","BLIND_REVIEW_FIRST","AUTHOR_INTAKE_ONLY","SUBAGENT_INPUT_CHECKLIST_REQUIRED","SUBAGENT_ADVERSARIAL_REVIEW_TWO_ROUND_LIMIT","DEXTER_RELAYED_CODEX_CLAUDE_REVIEW_NOT_ROUND_LIMITED","IMPLEMENTATION_RECONCILIATION_NOT_ROUND_LIMITED","IMPLEMENTATION_REVIEW_AGAINST_DESIGN_NOT_ROUND_LIMITED","MAIN_AGENT_REVIEW_FALLBACK_AFTER_REPEATED_SUBAGENT_FAILURE"]
sourceRefs: ["doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md","doc/platform/review-standard.md"]
---

# Independent subagent adversarial review

- `INDEPENDENT_SUBAGENT_REQUIRED`: from the next review cycle, both DESIGN and
  IMPLEMENTATION adversarial rounds are performed by fresh independent subagents.
- `BLIND_REVIEW_FIRST`: the reviewer writes findings and verdict before reading author
  self-assessment or disposition.
- `AUTHOR_INTAKE_ONLY`: the author reopens sources and performs dialectical finding intake;
  the author cannot write the adversarial verdict.
- `SUBAGENT_INPUT_CHECKLIST_REQUIRED`: each round records the mandatory entry-chain paths;
  the retired hash checklist is not required. Absence of required source reading invalidates that round.

## Repeated reviewer failure fallback

`MAIN_AGENT_REVIEW_FALLBACK_AFTER_REPEATED_SUBAGENT_FAILURE` is a Dexter-authorized
operational exception added on 2026-09-15. The normal path is unchanged: a usable
`REVIEW_TARGET=DESIGN` or `REVIEW_TARGET=IMPLEMENTATION` adversarial verdict, and any
fresh implementation reconciliation required by the task, must come from a fresh
independent subagent.

The exception applies only when the same assigned review task has had at least three
consecutive fresh-reviewer attempts fail to produce a usable verdict or reconciliation
result because of a tool error, process/runtime failure, explicit boundary violation,
or a diagnosed stuck task. A valid `NO-GO`, `OPEN`, or finding report is not a failed
attempt. Before the next attempt, the agent must preserve the actual reviewer status,
the portion read, the first failure, the last known good phase, the broken boundary,
and the diagnosed reason; blind waiting, timeout growth, polling, and relabeling are
not evidence of failure or recovery.

After that threshold, the main agent must complete the same review scope so the
authorized task can proceed. The result is valid for the task, but its provenance
must remain explicit: `REVIEW_FALLBACK=MAIN_AGENT_AFTER_REPEATED_SUBAGENT_FAILURE`.
It must not be labeled `INDEPENDENT_SUBAGENT`, and the main agent must not fabricate a
fresh reviewer checklist or verdict. The main-agent review still reads the required
inputs, records findings and unresolved `OPEN` items, and preserves every failed
attempt for Dexter/Claude. Any input that cannot be verified remains `OPEN`; the
fallback does not reset a review cycle, waive a required external review, or authorize
new scope. If Dexter later requires a fresh reviewer, this record is the handoff
context for a new attempt rather than a reason to conceal the fallback.

## 轮次上限只管哪一类 review

以下四类是 Dexter 2026-09-14 的裁定，正本见治理决定 `## 1. 裁决`。

- `SUBAGENT_ADVERSARIAL_REVIEW_TWO_ROUND_LIMIT`：agent 对**自己的**需求、详设或实施计划
  （`REVIEW_TARGET=DESIGN`）发起、由 fresh `INDEPENDENT_SUBAGENT` 执行的对抗式 review，受两轮上限约束：
  第一轮找盲点，第二轮定向核验并硬停止，按 `SELF_DECIDED` 收口；换 reviewer、模型、文件名或局部修订都不重置轮次。
- `DEXTER_RELAYED_CODEX_CLAUDE_REVIEW_NOT_ROUND_LIMITED`：Codex 与 Claude 之间、由 Dexter 做消息中转的
  review（无论谁审谁）**不受两轮上限约束**，做几轮由 Dexter 决定。为这类 review 起草请求、交接或 intake
  时，`REVIEW_ROUND=N` 只作序号，不得写 `REVIEW_ROUND_LIMIT=2`、`ROUND_FINAL_DECISION=SELF_DECIDED`、
  「第二轮硬停止」或「不得召集第三轮」。
- `IMPLEMENTATION_RECONCILIATION_NOT_ROUND_LIMITED`：实施过程中由子 agent 做的「实施结果 ↔ 需求、详设」
  对账**不受两轮上限约束**，包括 `review-standard.md` 的实施步骤级独立对账、
  `implementation-task-template.md` 的 6b 整体三维对账和交付前的逐代码与详设对账。结论只有 `MATCHED`
  或逐项 `OPEN`；`OPEN` 时按同根范围修复，再交另一个 fresh 子 agent 复查，直到 `MATCHED` 才往下走。
  不得以「两轮已满」为由停止复查，也不得带着 `OPEN` 进入下一步骤或交付。
- `IMPLEMENTATION_REVIEW_AGAINST_DESIGN_NOT_ROUND_LIMITED`：实施完成后对整批做的
  `REVIEW_TARGET=IMPLEMENTATION` 对抗 review **不受两轮上限约束**，但**必须依据详设文档**：每条 finding
  写明依据的详设位置和对应实现位置（即 `review-standard.md` 动作 2「与本批设计文档逐条对账」）；详设里
  找不到判据的问题按 `review-standard.md` §2 记入 `DESIGN_GAPS`、交回设计侧，不得在 review 里就地立标准。
  `NO-GO` 时修复后交新的 fresh 子 agent 复审，不因轮次停止，也不由作者 `SELF_DECIDED` 收口；
  `REVIEW_ROUND=N` 只作序号，不写 `REVIEW_ROUND_LIMIT=2`。

判别式：**被审的是什么、谁来审、经不经 Dexter 中转？**

- agent 自己的需求/详设/实施计划（DESIGN），fresh 子 agent 审 ⇒ 两轮。
- Codex 与 Claude 互审，经 Dexter 中转 ⇒ 不限轮次，由 Dexter 决定。
- 实施过程中对账实施结果（步骤级、6b 整体、交付前逐代码）⇒ 不限轮次，直到 `MATCHED`。
- 实施完成后整批 `REVIEW_TARGET=IMPLEMENTATION` 对抗 review ⇒ 不限轮次，但必须依据详设。
- 四类之外的 review 按 owning decision 执行。

已发生的反例：

- 2026-09-14 扩展字段列表搜索需求：作者 intake §5「第二轮硬停止边界」和交给 Claude 的第二轮请求写了
  `REVIEW_ROUND_LIMIT=2`、`ROUND_FINAL_DECISION=SELF_DECIDED` 与「第二轮是硬停止轮次，不得再召集第三轮」；
  Dexter 纠正「本 cycle 的不硬停止，我说 review 几次就是几次」。
- 2026-09-12～14 可读性整改实施（`doc/evidence/platform/2026-09-12-v2s-readability-implementation-execution-codex.md`）：
  B1、B2、B3、B10、B15 的步骤对账都套了 `REVIEW_ROUND_LIMIT=2` 与 `SELF_DECIDED`，第二轮仍 `OPEN` 时以
  「已达两轮上限」为由不再派 fresh 子 agent，改由作者自证。B3、B10 之后还是派了 fresh 子 agent 复查才拿到
  `MATCHED`（B3 的记录写明步骤对账「不消耗正式 review 两轮上限」）；B15 却又停在第二轮 `OPEN`，
  后来整批 review 的两轮各查出一条 B15 证据问题。整批 `REVIEW_TARGET=IMPLEMENTATION` review 本身也停在
  第 2 轮 `NO-GO`，作者补测试后自行收口，没有再交 fresh 子 agent 复审。

Dexter 在对话里明确要求再审或停止时照做，见 `pitfalls.repo-rule-cited-against-dexter`。

This rule does not reopen already closed cycles. The owning decision is
`doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md`.
