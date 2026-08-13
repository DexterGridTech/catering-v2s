---
name: cs-spec-to-plan
description: Derive a reviewable catering-v2s implementation plan from an approved spec and current Roadmap authority.
---
# cs-spec-to-plan

Confirm the explicit program and current Roadmap authorization first. Reopen applicable project-memory and Heritage sources, including `SOLUTION_REASONABLENESS_FIRST`, `UI_USER_TASK_VALIDATION` and `AMBIGUITY_REQUIRES_DEXTER`. Before decomposing implementation, state the business user's actual task, Dexter's stage/cost intent, at least one viable alternative and why the recommendation is better. For UI, prove each operation comes from an approved Journey, is logical in context and has no better path; attribute constraints to backend/owner/contract/document ambiguity rather than inheriting them silently, and ask Dexter when product semantics are ambiguous. Then produce implementation units with exact create/update/delete/retain paths, owner and transaction boundaries, failure behavior, evidence and red controls.

Any new or modified backend HTTP operation is incomplete until the plan contains its
`backend-acceptance` scenario draft: non-empty `identity`, `fixture`, `request`, `businessOracle`,
deterministic structural `performanceCriterion`, and `cleanup`. `correctnessCases` may be empty only
with a one-line reason; the generic contract validator owns OpenAPI/envelope/Problem validation.
Reject a missing draft before review with `BACKEND_ACCEPTANCE_SCENARIO_REQUIRED`; do not defer it to
implementation or invent latency/percentile budgets.

For the initial backend-acceptance migration, plans must also enumerate—not summarize—the hash-bound
historical replay catalog at
`doc/evidence/platform/2026-08-13-v2s-backend-acceptance-historical-seed-findings.json`: 6 required
structural regression cases, 15 HTTP failure families, and 8 seed/client/fixture families. For each
of the six performance rows, the plan must enforce QUERY, CONNECTION, and TRANSACTION at or below
the row's DBCR-pre per-call baseline, include the typed QUERY disposition, and reject a connection-only
closure. Every
finding needs an implementation disposition and fresh route proof; the words "historical replay"
alone are not a delivery item or acceptance criterion.

## Journey-to-design pipeline

Before any implementation-facing design, use the sequence defined by
`doc/decisions/2026-07-25-v2s-design-governance-batch-1.md`:

1. create or reopen the Journey decision using
   `doc/decisions/templates/journey-decision-template.md`;
2. verify every actor identity and required data prerequisite has exactly one declared source:
   `IN_SCOPE_PRODUCED`, `ESTABLISHED_SOURCE`, or
   `EXTERNAL_PREREQUISITE_DEXTER_DECISION`;
3. if the Journey is UI-bearing, create
   `doc/decisions/templates/ui-interaction-design-template.md`, complete its interaction map,
   low-fidelity wireframes, state/boundary table, per-operation reasonableness and face/owner
   matrix, then obtain Dexter's visual review;
4. only then write implementation-facing design and its granularity manifest;
5. for every adversarial round, dispatch the fresh independent-subagent blind review using
   `doc/review/platform/independent-subagent-adversarial-review-input-checklist-template.md`,
   then perform author-side dialectical intake and request Claude review.

Every implementation-facing manifest must declare package-exit source-compliance denominators for every delivery unit. Reopen the owning sources; do not use a copied rule list. Missing source/anchor, an unowned unit, or `PENDING` disposition is a fail-closed existing granularity-gate result.

Every confirmed design, implementation, test, or evidence finding must be generalized before
closure: state the reusable failure pattern, root-cause layer, finite applicability denominator,
counterexample boundary, and smallest reusable remedy. Select exactly one primary prevention
destination: project-memory, an existing machine control that passes the three admission questions
and a production red mutation, an explicit review checklist, or
`NOT_APPLICABLE_WITH_REASON`. Package exit must reconcile the identified-finding set and prevention
disposition set exactly; a local fix alone is not closure.

Treat every user-reported file, field, literal, or failure as a problem-family entry rather than
the complete denominator. Before proposing or applying a fix, enumerate the finite search surface,
search all same-root siblings, record counterexamples, and make the finding/prevention sets equal.
The prompt intake hook is mechanical evidence only and never proves semantic completeness.

An unresolved external prerequisite blocks implementation-facing design; do not replace it with a
test account, seed, default identity, anonymous session or an invented UI. A UI-bearing delivery
unit must reference an existing, uniquely anchored interaction artifact in the granularity manifest.
The checker verifies only this reference mechanically; the source validity, user-task logic and
wireframe quality remain independent human review. Do not use this pipeline to invent a Journey or
to turn a UI artifact into implementation authorization.

Before Codex declares any design, implementation, evidence or closure ready, Codex must arrange and preserve the independent-subagent blind review required by `doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md`. The independent reviewer forms the reasonableness verdict first; the author may write only the subsequent dialectical intake: user task, Dexter intent, alternatives, complexity/benefit, verified disposition and closure correctness. Use `REVIEW_TARGET=DESIGN` for design and `REVIEW_TARGET=IMPLEMENTATION` after code exists. Implementation review must reopen actual production sources through `scripts/context/recall-code`, verify compiler/test/runtime evidence and reassess real user behavior; fidelity to an approved design is not a reasonableness waiver. Claude review never substitutes for the required independent-subagent review. A plan or author intake never authorizes its own implementation.

Treat every adversarial finding as a hypothesis requiring dialectical intake, not as authority. Reopen the owning source/code/evidence, verify drift-prone external claims with primary sources or reproducible experiments, search for counterexamples and applicability limits, then classify it as `CONFIRMED`, `PARTIALLY_CONFIRMED`, `REJECTED_WITH_EVIDENCE`, `UNVERIFIED_REQUIRES_EVIDENCE`, or `DEXTER_DECISION`. Only verified portions may change the plan. Compare the proposed fix with a smaller alternative and current-stage cost so review does not create overdesign. Missing information must remain explicit; do not manufacture certainty or infer product/Journey semantics.

Cap adversarial review at two rounds for the same `REVIEW_CYCLE_ID + REVIEW_TARGET + approved scope`. Every round is a fresh independent-subagent blind review that tries to falsify the target before reading author material; round two is targeted verification and a hard stop where the author synthesizes independent findings and disposition evidence under the existing `SELF_DECIDED` rule. Changing reviewer/model/file/hash/wording or making local fixes does not reset the cycle. Only DESIGN-to-IMPLEMENTATION or a material Dexter-approved Journey/scope/authority/target change starts a documented new cycle. Declare `REVIEW_CYCLE_ID`, `REVIEW_ROUND=1|2`, `REVIEW_ROUND_LIMIT=2`, and on round two `ROUND_FINAL_DECISION=SELF_DECIDED`; never dispatch a third independent reviewer for the same cycle.

If verified findings require author remediation after round two, preserve the immutable reviewed
manifest hash and bind the changed bytes through `POST_REMEDIATION_V1` as defined by
`doc/decisions/2026-07-26-v2s-post-remediation-review-binding-governance.md`. The declaration must
bind the author intake, state that the current bytes were not reviewed by the adversarial reviewer,
retain `implementationAuthority=false`, and require Claude recheck. It is not a third adversarial
round and must never be used to manufacture an historical green verdict.
