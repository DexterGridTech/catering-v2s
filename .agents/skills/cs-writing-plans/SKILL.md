---
name: cs-writing-plans
description: Produce a bounded catering-v2s implementation-facing design only after an accepted Journey and visual review.
---

# cs-writing-plans

Authority boundary: `AGENTS.md`, Dexter's explicit session assignment, approved Journey/interaction
artifacts, project-memory and local templates win over the frozen vendor source. This adapter
does not create a branch, commit, use a worktree, dispatch agents, or advance to implementation.
Git is always Dexter's.

Use only after the applicable business/design sources and Dexter's explicit session assignment are available.
UI-bearing work still requires an accepted Journey and interaction artifact; a backend-only
backend-acceptance scenario extension follows the active business-scenario standard and does not
invent or wait for a UI Journey. If a required prerequisite is pending, stop and return it to Dexter;
do not invent a test account, seed data or an external dependency.

Do not create package-exit, hash-chain, receipt, P0/W0/P1, or six-category source-denominator artifacts for
the retired compliance-control model. For a current backend-acceptance scenario extension, record the
owning business source, the exact scenario file, the route identity, and the focused/full verification
commands instead.

For every new or modified backend HTTP operation, read
`doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md` and include a
scenario design with non-empty `identity`, `fixture`, `request`, and `businessOracle`. The oracle must
name the real business fields or side effects it will assert, including applicable permission,
isolation, state, masking, write/readback, no-write, or idempotency facts. The implementation belongs
in the owning domain's `*AcceptanceScenarios.java` group and is discovered by the explicit catalog.
Do not add retired `performanceCriterion`, scenario-level `cleanup`, `correctnessCases`, baseline,
lane, or exact-set fields. A path string, status-only check, `response.ok`, or no-exception check is
not a business oracle.

Plans must also define how every confirmed design, implementation, testing, or evidence finding is
abstracted into a reusable failure pattern and receives one prevention destination: project-memory,
an admitted existing machine control with production red proof, a semantic review checklist, or a
specific `NOT_APPLICABLE_WITH_REASON`. Do not claim systemic closure from a one-file repair.

For every user-reported symptom, require a pre-fix problem-family discovery: root-cause class,
finite search surface, all same-root siblings, explicit counterexamples, and exact equality between
the finding set and prevention dispositions. A named file or literal is never the whole denominator
by default.

The design must be written against `doc/decisions/templates/implementation-design-template.md`. Its
cross-cutting mechanism table is a fixed row set: fill every row with (1) the exact existing
capability path or symbol, (2) one performable observation that verifies it, (3) when the repo has
only a code precedent and no written standard, that precedent's exact path plus which parts the new
code must match, and (4) the complete in-batch applicability list rather than an example. Rows may
not be deleted; `N/A` requires a reason. The declaration-transfer-consumption matrix must carry
mechanism rows (collection shape, authorization enforcement point, cache invalidation, error
mapping, logging/masking), each stating its concrete value at every layer it passes through.

A UI-bearing design also requires an IA artifact written against
`doc/decisions/templates/ia-design-template.md`. Dimensions that cannot be verified by opening the
page — read authorization, what refetches after a write, collection shape and expected scale — must
be written as performable observations, never as property descriptions. Any fact appearing in both
the IA and this design must match word for word; a mismatch is a defect to resolve now, never a gap
left for implementation to bridge.

A TER (`apps/terminal`) design's verification units must follow `TR-16` in
`doc/platform/terminal-coding-standard.md`: name the `ui/integration` package and its Expo Web entry, the
`application` package and target VM or device, the shared scenario list run on both ends, and which scenarios
depend on an `adapter/*` capability and may go straight to the device. Do not restate the rule here.

The resulting design starts with:

```text
SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0
```

Its units must name exact paths, owner/transaction boundary, command/readback, failure/recovery,
prerequisite source, UI interaction anchor when applicable, verification and mechanical controls.
It must not prescribe Git operations or start execution; each DESIGN or IMPLEMENTATION adversarial
round must use a fresh independent subagent, with the author limited to post-verdict dialectical
intake, and Claude review remains a separate gate.

For every `create` or `update` path under `apps/` or `libraries/`, use a stable capability name.
Never put a flow, step, or Journey ID (`R*`/`U*`/`J*`/`JG*`/`PKG*`/`G-*`) in a runtime or test
directory, package, file, or class name; IDs belong only to `doc/`, evidence/review/memory, and
gate-catalog metadata. Keep runtime/test names capability-based and stable.

When verified findings change a design after the second and final adversarial round, do not rewrite
the historical review or claim that the reviewer saw the new bytes. Record the current change and
its unreviewed status in ordinary working notes, then obtain the next authorized review when the
change requires one. This does not open or simulate a third round for the closed cycle.

Frozen vendor reference:
`.agents/skills/vendor/superpowers-6.2.0/writing-plans/VENDOR-SKILL.md`
at SHA-256 `72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0`.
