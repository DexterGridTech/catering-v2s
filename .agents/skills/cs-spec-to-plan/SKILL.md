---
name: cs-spec-to-plan
description: Derive a reviewable catering-v2s implementation plan from an approved spec and current Roadmap authority.
---
# cs-spec-to-plan

Confirm the explicit program and current Roadmap authorization first. Reopen applicable project-memory and Heritage sources, including `SOLUTION_REASONABLENESS_FIRST`, `UI_USER_TASK_VALIDATION` and `AMBIGUITY_REQUIRES_DEXTER`. Before decomposing implementation, state the business user's actual task, Dexter's stage/cost intent, at least one viable alternative and why the recommendation is better. For UI, prove each operation comes from an approved Journey, is logical in context and has no better path; attribute constraints to backend/owner/contract/document ambiguity rather than inheriting them silently, and ask Dexter when product semantics are ambiguous. Then produce implementation units with exact create/update/delete/retain paths, owner and transaction boundaries, failure behavior, evidence and red controls.

The plan is incomplete unless it contains an explicit delivery step named `逐代码与详设对账`
(line-by-line reconciliation of the produced code against the implementation-facing design),
stating its scope, executor, criteria and result form. Scope is every changed line, not a sample.
Results are only `MATCHED` or `OPEN`. **Passing this reconciliation is the precondition for
delivering the implementation to Dexter and Claude for post-implementation review** — with any
`OPEN` outstanding the correct report is "实施未就绪", never "已交付 review".
This is NOT the same control as the three-dimensional reconciliation (requirements + design/IA +
project-memory standards) that runs before whole-scope testing, and neither substitutes for the
other: that one gates testing, this one gates handing work to human review.
Authority: Dexter 2026-09-06. Canonical wording lives in
`doc/platform/implementation-task-template.md`.

Any new or modified backend HTTP operation is incomplete until the plan reads
`doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md` and contains its
backend-acceptance scenario intent: non-empty `identity`, `fixture`, `request`, and `businessOracle`.
The business oracle must list the real fields or side effects to verify and the applicable permission,
isolation, state, masking, write/readback, no-write, or idempotency facts. The plan must name the
owning `*AcceptanceScenarios.java` group and the focused/full runner commands. Never satisfy this
requirement with a path string, status-only check, `response.ok`, or no-exception assertion.
Do not add retired `performanceCriterion`, scenario-level `cleanup`, `correctnessCases`, accepted
baseline, lane, exact-set, or package-exit fields.

The historical backend-acceptance migration catalog and its performance/baseline closure process are
superseded. Do not reopen them for a new business scenario unless Dexter explicitly changes the
current decision and the active standard is replaced.

Any TER (`apps/terminal`) plan is incomplete unless its dynamic verification follows `TR-16` in
`doc/platform/terminal-coding-standard.md`: for every feature whose behavior under test does not depend on
an `adapter/*` capability, schedule the `ui/integration` Expo Web verification of the current bytes before
any `assembly` run on a VM or device, and name the shared scenario list whose side-by-side Web/device
results prove both ends behave the same. A batch that touches an adapter somewhere still applies this
order to its non-adapter parts. The rule, evidence form and counterexamples live only in `TR-16`.

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
3b. for a UI-bearing Journey, also write the IA artifact against
   `doc/decisions/templates/ia-design-template.md`; the interaction artifact governs what the user
   sees, the IA governs what is invisible yet decides behavior (who may read, what refetches after a
   write, how large the collection gets). Invisible dimensions must be written as performable
   observations, not property descriptions;
4. only then write implementation-facing design against
   `doc/decisions/templates/implementation-design-template.md`, with exact owner/path and
   verification units. Its cross-cutting mechanism table is a fixed row set — fill each row with the
   exact existing capability, one performable observation, the required shape when only a code
   precedent exists, and the complete in-batch applicability list. Any fact shared with the IA must
   match word for word; resolve mismatches before implementation rather than leaving them to be
   bridged in code;
5. for every adversarial round, dispatch the fresh independent-subagent blind review using
   `doc/review/platform/independent-subagent-adversarial-review-input-checklist-template.md`,
   then perform author-side dialectical intake and request Claude review.

For the current backend-acceptance extension, do not create an implementation package manifest or
package-exit denominator. Reopen the owning business/design sources and record the exact scenario
file, route identity, and verification commands directly in the working plan. UI Journey artifacts
are not a prerequisite for this backend-only scenario work.

Every confirmed design, implementation, test, or evidence finding must be generalized before
closure: state the reusable failure pattern, root-cause layer, finite applicability denominator,
counterexample boundary, and smallest reusable remedy. Select exactly one primary prevention
destination: project-memory, an existing machine control that passes the three admission questions
and a production red mutation, an explicit review checklist, or
`NOT_APPLICABLE_WITH_REASON`. A local fix alone is not systemic closure.

Treat every user-reported file, field, literal, or failure as a problem-family entry rather than
the complete denominator. Before proposing or applying a fix, enumerate the finite search surface,
search all same-root siblings, record counterexamples, and make the finding/prevention sets equal.
The prompt intake hook is mechanical evidence only and never proves semantic completeness.

An unresolved external prerequisite blocks implementation-facing design; do not replace it with a
test account, seed, default identity, anonymous session or an invented UI. A UI-bearing delivery
unit must reference an existing, uniquely anchored interaction artifact in its design record. The
source validity, user-task logic and wireframe quality remain independent human review. Do not use
this pipeline to invent a Journey or to turn a UI artifact into implementation authorization.

Before Codex declares any design, implementation, evidence or closure ready, Codex must arrange and preserve the independent-subagent blind review required by `doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md`. The independent reviewer forms the reasonableness verdict first; the author may write only the subsequent dialectical intake: user task, Dexter intent, alternatives, complexity/benefit, verified disposition and closure correctness. Use `REVIEW_TARGET=DESIGN` for design and `REVIEW_TARGET=IMPLEMENTATION` after code exists. Implementation review must reopen actual production sources through `scripts/context/recall-code`, verify compiler/test/runtime evidence and reassess real user behavior; fidelity to an approved design is not a reasonableness waiver. Claude review never substitutes for the required independent-subagent review. A plan or author intake never authorizes its own implementation.

Treat every adversarial finding as a hypothesis requiring dialectical intake, not as authority. Reopen the owning source/code/evidence, verify drift-prone external claims with primary sources or reproducible experiments, search for counterexamples and applicability limits, then classify it as `CONFIRMED`, `PARTIALLY_CONFIRMED`, `REJECTED_WITH_EVIDENCE`, `UNVERIFIED_REQUIRES_EVIDENCE`, or `DEXTER_DECISION`. Only verified portions may change the plan. Compare the proposed fix with a smaller alternative and current-stage cost so review does not create overdesign. Missing information must remain explicit; do not manufacture certainty or infer product/Journey semantics.

Cap `REVIEW_TARGET=DESIGN` adversarial review (the agent's own requirements, design, or implementation plan) at two rounds for the same `REVIEW_CYCLE_ID + REVIEW_TARGET + approved scope`. Every round is a fresh independent-subagent blind review that tries to falsify the target before reading author material; round two is targeted verification and a hard stop where the author synthesizes independent findings and disposition evidence under the existing `SELF_DECIDED` rule. Changing reviewer/model/file/hash/wording or making local fixes does not reset the cycle. Only a material Dexter-approved Journey/scope/authority/target change starts a documented new cycle. Declare `REVIEW_CYCLE_ID`, `REVIEW_ROUND=1|2`, `REVIEW_ROUND_LIMIT=2`, and on round two `ROUND_FINAL_DECISION=SELF_DECIDED`; never dispatch a third independent reviewer for the same design cycle. By Dexter's 2026-09-14 ruling, three kinds of review have no round limit: the whole-batch `REVIEW_TARGET=IMPLEMENTATION` review after implementation (it must be grounded in the design document), in-implementation reconciliation (repeat until `MATCHED`), and Codex↔Claude reviews relayed by Dexter. They use `REVIEW_ROUND=N` only as a sequence number and never declare `REVIEW_ROUND_LIMIT` or `ROUND_FINAL_DECISION`; the owning rule is section 1 of `doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md`.

If verified findings require author remediation after round two, preserve the historical verdict and
state clearly that the current bytes were not reviewed by that round. Obtain a newly authorized
review when the changed scope needs one; never manufacture a historical green verdict or a third
round.
