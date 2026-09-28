# Independent subagent adversarial review input checklist — round 1

REVIEW_CYCLE_ID=TER-THIRD-PARTY-REMEDIATION-DESIGN-2026-09-28  
REVIEW_TARGET=DESIGN  
REVIEW_ROUND=1  
REVIEW_ROUND_LIMIT=2  
reviewerKind=INDEPENDENT_SUBAGENT

Reviewer instruction: first try to falsify the reviewed design/implementation plan; form findings and a verdict before reading author self-review or dispositions. Defer the detailed-design sections `## 12. Design gaps / explicit OPENs` and `## 13. Template completion`, plus the Round-1 disposition file, until the independent findings/verdict are written. Do not implement or edit any file; return read-only findings to the main agent.

| Required input | Path, command, or session input | Read / result |
| --- | --- | --- |
| Codex entry | `AGENTS.md` | REQUIRED — read full |
| Claude entry | `CLAUDE.md` | REQUIRED — read full |
| Platform entry | `PLATFORM-BLUEPRINT.md` | REQUIRED — read full |
| Platform docs entry | `doc/platform/README.md` | REQUIRED — read full |
| Current assignment and authorization | Main-agent prompt reproduces Dexter's v3.2 assignment/authority and explicit “design only, do not implement” boundary | REQUIRED |
| All kernels | `project-memory/kernel/01-workspace-and-authorization.md`, `02-service-shape-and-owner.md`, `03-transaction-data-and-dependencies.md`, `04-contract-consumer-and-admin.md`, `05-evidence-runtime-and-git.md`, `06-heritage-and-change.md` | REQUIRED — all six |
| Six-dimension route A | `scripts/context/recall-memory --task-kind design --domain platform --consumer-face platform-admin --owner platform --impact architecture --trigger task-start` | Run; reopen all hits and applicable `sourceRefs`; `platform-admin` is a retrieval proxy for UI-bearing work, not TER's product consumer-face |
| Six-dimension route B | `scripts/context/recall-memory --task-kind design --domain platform --consumer-face platform-admin --owner frontend-platform --impact runtime --trigger task-start` | Run; reopen all hits and applicable `sourceRefs`; `platform-admin` is a retrieval proxy for UI-bearing work, not TER's product consumer-face |
| Six-dimension route C | `scripts/context/recall-memory --task-kind testing --domain platform --consumer-face platform-admin --owner platform --impact evidence --trigger implementation` | Run; reopen all hits and applicable `sourceRefs`; `platform-admin` is a retrieval proxy for UI-bearing work, not TER's product consumer-face |
| TER-specific routed memory | `project-memory/operations/terminal-coding-standard.md`; `project-memory/decisions/terminal-architecture-and-stack-rulings.md`; `project-memory/decisions/terminal-build-order-and-batches.md`; `project-memory/practices/ter-input-and-virtual-keyboard-usage.md` | REQUIRED — read full, whether or not returned by route |
| Applicable operating/model memory | Every route hit plus its owning `sourceRefs`; do not treat index/query output as the source | REQUIRED — all hits |
| Confirmed business corpus | `project-memory/decisions/confirmed-business-language-corpus.md`; search terms: `TER`, `terminal`, `topology`, `display`, `input`, `keyboard`, `runtime`, `member`, `staff` | Record exact matched entry or `NO_CORPUS_ENTRY_MATCHED` with terms |
| All decision titles | `find doc/decisions -type f -name '*.md' -print | sort`; inspect titles, then open applicable full decisions | REQUIRED — record applicable title list |
| Applicable decisions / rulings | `doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md`; `doc/decisions/2026-07-24-v2s-verification-governance.md`; `doc/review/platform/2026-08-28-newposv1-package-analysis-claude/00-ter-build-order-claude.md` T-3/T-4 sections; `project-memory/decisions/terminal-architecture-and-stack-rulings.md` | REQUIRED — applicable full source/headings |
| Reviewed object — requirements | `doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-requirements-claude.md` | READ_FULL, v3.2 only input |
| Reviewed object — detailed design | `doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-implementation-design-codex.md` | READ_FULL; defer §9 until independent verdict is recorded |
| Reviewed object — implementation plan | `doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-implementation-plan-codex.md` | READ_FULL |
| Previous independent/Claude review sources | `doc/review/platform/2026-09-28-ter-third-party-usage-remediation-requirements-rereview-codex.md`; source review `doc/review/platform/2026-09-28-ter-third-party-library-usage-health-check-claude.md` | Read only after independent findings/verdict, for comparison |
| Applicable third-party standard | `doc/platform/third-party-library-usage-standard.md` | REQUIRED — read full |
| Applicable TER standard | `doc/platform/terminal-coding-standard.md` | REQUIRED — read TR-08, TR-10, TR-11, TR-16, TR-17 and §7.1 |
| Task/implementation standard | `doc/platform/implementation-task-template.md`; `doc/decisions/templates/implementation-design-template.md`; `doc/decisions/templates/ia-design-template.md`; `doc/decisions/templates/ui-interaction-design-template.md`; `doc/decisions/templates/journey-decision-template.md` | REQUIRED — check each template's applicability/completeness |
| General design/architecture standards | `doc/platform/foundation-charter.md` §§1-J/1-K; `doc/platform/frontend-coding-standard.md`; `doc/platform/backend-coding-standard.md`; `doc/platform/review-standard.md` | REQUIRED — applicable sections |
| Verification governance | `doc/decisions/2026-07-24-v2s-verification-governance.md`; `doc/platform/agent-operating-model.md` §3 | REQUIRED |
| Applicable skills | `.agents/skills/cs-spec-to-plan/SKILL.md`; `.agents/skills/cs-writing-plans/SKILL.md`; `.agents/skills/cs-third-party-library-usage/SKILL.md` | REQUIRED — verify design/plan follows them |
| Pointwise code/source basis | Owning source locations linked from requirements F-1…F-31 and detailed design §3/§6/§8/§11 | Read relevant source for any challenged implementation claim; report path/symbol and exact counterexample |

## Blind-review declaration

`I received this checklist in a fresh subagent context, tried to falsify the reviewed design and plan, and wrote my findings and verdict before reading author self-review or dispositions.`  
`I also treated every missing or substituted required input as a finding; an earlier generic preparation pass did not substitute for reading the current design, plan, requirements, and owning sources.`
