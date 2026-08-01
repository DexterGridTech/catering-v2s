# Independent-subagent adversarial-review governance amendment — Claude review request

REVIEW_STATUS=CLAUDE_GO_0M_0S_1N_RESOLVED_DEXTER_ACCEPTED
REVIEW_KIND=GOVERNANCE_DECISION_AMENDMENT
EFFECTIVE_FROM=NEXT_REVIEW_CYCLE
IMPLEMENTATION_AUTHORITY=false

## 背景

Dexter 要求恢复并强化 v2 既有独立审查强度：从下一个 review cycle 起，所有
`REVIEW_TARGET=DESIGN` 与 `REVIEW_TARGET=IMPLEMENTATION` 的两轮对抗审查均须由 fresh
独立子 agent 盲审，作者会话只能在 verdict 后做辩证 intake 和处置，不能代写 verdict。

本批是治理 decision 修订，不是 implementation-facing 详设，不授权任何业务、契约、数据库、
应用、运行或测试实现。R3 已收口与当前 R4 design cycle 不被追溯重开；本规则仅约束其后的新
cycle。此前 all-v2 disposition 批次的 L66 注记已据此从“两轮自审”更正为恢复独立子 agent
盲审。

## 评审目标

独立确认这项修订是否完整、可执行且不越界：

- decision 是否准确保留两轮上限和 `SELF_DECIDED` 收口，同时移除作者自审自判；
- 最小输入清单是否逐项覆盖既定六类输入，且 prompt 强制先证伪、后读作者材料；
- 评审留痕字段与 granularity checker 是否只作字段/清单文件存在性机械检查，不把语义伪装成 gate；
- 本仓 `cs-spec-to-plan`、`cs-writing-plans`、AGENTS、CLAUDE、scripts、standards matrix、
  project-memory 和 disposition L66 是否同向；
- 是否确实仅自下一个 review cycle 生效，未重开 R3 或当前 R4 cycle。

## 需阅读文件

- `doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md`：本次治理裁决与生效边界。
- `doc/review/platform/independent-subagent-adversarial-review-input-checklist-template.md`：独立子 agent prompt 的硬性最小输入清单。
- `doc/decisions/2026-07-25-v2s-design-governance-batch-1.md`：design-governance pipeline 的修订落点。
- `doc/decisions/2026-07-24-v2s-solution-reasonableness-review-policy.md`：既有方案合理性与两轮规则的 amendment。
- `.agents/skills/cs-spec-to-plan/SKILL.md` 与 `.agents/skills/cs-writing-plans/SKILL.md`：本仓唯一 skill 根中的执行壳。
- `AGENTS.md`、`CLAUDE.md`、`scripts/README.md`：执行入口与评审说明。
- `tools/implementation-design-granularity/cli.mjs`：仅机械的字段/清单文件存在性验证及 red fixtures。
- `contracts/policy/standards-coverage-matrix.json`：对应 review checklist 的证据分母。
- `project-memory/kernel/04-contract-consumer-and-admin.md`、`project-memory/decisions/independent-subagent-adversarial-review.md`、`project-memory/required-inventory.json`：memory anchor 与 required inventory。
- `doc/review/platform/2026-07-25-v2s-all-v2-governance-disposition-ledger.md`：L66 disposition 修订。
- `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md`：当前 R4 授权与不追溯边界。

## 独立核验重点

1. 从当前 Roadmap 的 `CURRENT_*` 和授权开关独立确认：R4 implementation 尚未授权，本批不得扩大为实施。
2. 重算新增 decision、输入清单模板、kernel 和 checker 相关文件的 SHA-256；确认链路没有把作者会话伪装为独立 reviewer。
3. 对 `tools/implementation-design-granularity/cli.mjs` 在 scratchpad 复跑：
   `scripts/check/implementation-design-granularity --self-test`；确认错误 `reviewerKind` 与不存在的输入清单文件均真红，且 checker 不解析输入清单语义。
4. 确认输入模板逐项要求：AGENTS/CLAUDE 全文、Roadmap CURRENT 与授权、全部 kernel+六维 recall 命中原文、confirmed business corpus 命中、被审对象及上游冻结输入和当日 decision 标题清单、standards checklist 与验证治理 decision；无适用 corpus 时必须留下搜索词与 `NO_CORPUS_ENTRY_MATCHED`。
5. 确认 `NEXT_REVIEW_CYCLE` 与“不重开 R3/当前 R4 cycle”在 decision、AGENTS、policy、skills 与台账中一致。
6. 复跑：`scripts/check/project-memory`、`scripts/check/roadmap-program-registry`、`scripts/check/agent-lifecycle`、`scripts/check/claude-review-handoff --file doc/review/platform/2026-07-25-v2s-independent-subagent-adversarial-review-governance-review-request.md`。`scripts/check/standards-coverage --phase R4` 的既有 `B.1.N01` planned-enforcement overdue 结果应与本治理修订区分，不得误报为本批缺陷。

## 期望结论

请给出明确 `GO` 或 `NO-GO`。findings 以 `M` / `S` / `N` 报告；每项必须包含精确文件与行号、影响面、最小修复建议，以及是否需要 Dexter 产品裁决。请独立形成结论后再对照本请求，不把作者材料当成正确性的证明。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助评审本次独立子 agent 对抗审查治理修订。

背景：Dexter 要求从下一个 review cycle 起，所有 DESIGN/IMPLEMENTATION 对抗审查两轮均由 fresh 独立子 agent 盲审，作者只能在 verdict 后做辩证 intake，不得自审自判。本批是治理 decision 修订；不授权任何实现，且不重开已收口 R3 或当前 R4 design cycle。
目标：请独立核验该规则是否完整落到 decision、项目 skill、入口规范、standards checklist、project-memory、disposition L66 与 granularity checker，并确认 checker 只做字段和输入清单文件存在性检查，不裁决审查语义。

请从 catering-v2s 仓库根阅读：
- doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md：新治理裁决与生效边界；
- doc/review/platform/independent-subagent-adversarial-review-input-checklist-template.md：子 agent 硬性最小输入清单；
- doc/decisions/2026-07-25-v2s-design-governance-batch-1.md：design pipeline 修订；
- doc/decisions/2026-07-24-v2s-solution-reasonableness-review-policy.md：两轮与 intake amendment；
- .agents/skills/cs-spec-to-plan/SKILL.md、.agents/skills/cs-writing-plans/SKILL.md、AGENTS.md、CLAUDE.md、scripts/README.md：执行入口；
- tools/implementation-design-granularity/cli.mjs、contracts/policy/standards-coverage-matrix.json：机械检查与 review 分母；
- project-memory/kernel/04-contract-consumer-and-admin.md、project-memory/decisions/independent-subagent-adversarial-review.md、project-memory/required-inventory.json：memory anchor；
- doc/review/platform/2026-07-25-v2s-all-v2-governance-disposition-ledger.md：L66 修订；
- doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md：当前授权边界。

请重点独立核验：子 agent 是否必须 fresh、盲审、先证伪后读作者材料；六类最小输入是否缺一即无效；reviewerKind、输入清单 path+hash、盲审声明与清单文件是否有留痕；self-test 是否能让错误 reviewerKind 与缺失清单真红，同时没有语义 checker；以及规则是否仅 NEXT_REVIEW_CYCLE 生效并未重开 R3/当前 R4。请在 scratchpad 复跑 scripts/check/implementation-design-granularity --self-test、scripts/check/project-memory、scripts/check/roadmap-program-registry、scripts/check/agent-lifecycle 与 handoff checker；请把 R4 standards coverage 的既有 B.1.N01 planned-enforcement 状态与本治理修订分开判断。

烦请给出明确 GO 或 NO-GO。如有问题，请按 M / S / N 标注精确文件与行号、影响面、最小修复建议，以及是否需要 Dexter 产品裁决。

授权边界：本次 GO/NO-GO 仅确认治理修订是否可接受；不授权业务、契约、数据库、应用、运行、测试或任何 R4 implementation，也不重开既有收口 cycle。谢谢。
```
