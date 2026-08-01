---
REVIEW_CYCLE_ID: RM1P6-U03-FINAL-IMPLEMENTATION-REVIEW
REVIEW_TARGET: IMPLEMENTATION
REVIEW_ROUND: 2
REVIEW_ROUND_LIMIT: 2
reviewerKind: INDEPENDENT_SUBAGENT
blindReview: true
ROUND_FINAL_DECISION: SELF_DECIDED
verdict: NO-GO
---

# RM1P6-U03 implementation adversarial review — round 2 final

Dexter，本轮是同一 review cycle 的 hard-stop 最终轮。我重新以证伪为立场读取最新生产 bytes、IA04、active package、UI IA alignment 和最新受管 r5 run；先独立形成处置，再对照 round-1 artifact。未修改生产源码或执行 Git 操作。

## Review inputs

Immutable checklist: `doc/review/platform/independent-subagent-adversarial-review-input-checklist-template.md` (SHA-256 `0ef12f041bae6b4411bb4b4b3f15f2860796b31f3dab5894738fdd17441b63fe`).

Reopened inputs:

- `doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md` (`108ba9050ed256c6e41a3e53e3af4c761706c4dc8fe697de9540fc649f5af6d3`)
- `doc/decisions/2026-07-29-v2s-rm1-ia-04-operations-organization-and-contract-interaction.md` (`98b58f61d113a61cf1aad367d3cde812b8e6689fca465a0197fdb2e1bd280f6c`)
- `doc/evidence/platform/rm1/p6/rm1-u09-implementation-facing-design-and-three-phase-plan.md` (full reread)
- `doc/evidence/platform/rm1/p6/rm1p6-u03-package-input.json` (`5ee6721c9845578ca0743629e27d6ac6561286fb6caf72bf8a5e6db52cb52ddc`)
- `doc/evidence/platform/rm1/p6/rm1p6-u03-final-ui-ia-control-alignment.json` (`313305e5c97ed349f9bc7a26b7081484c966afb2d67c03dffeddb0008600a2c8`)
- `doc/evidence/platform/rm1/p6/rm1p6-u03-source-compliance-disposition.json` (`b2a30b39c3f18fbb6f32d67b77d7716936d60873e4382a4df01bfb1f5acbc21c`)
- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/organization/OperationsStoreManagementController.java` (current bytes)
- `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/OrganizationOverviewTaskReadService.java` (current bytes)
- `apps/frontend/operations-admin/src/features/organization-structure/ui/OrganizationStructurePage.tsx` and focused test (current bytes)
- `apps/frontend/operations-admin/src/features/head-company-management/ui/HeadCompanyManagementPage.tsx` (current bytes)
- `.runtime/r5/evidence/remote-testcontainers/r5-tc-1785459455311-32782/run-manifest.json` (`a03ff04b86252dccf648b014455cf7b3c3a26497bffa47759a827dd759b4f48e`), `remote-result.json` (`58338e3a71fad3e2eca0c189d00174a1180082e2a8df5fd27456a7b6b396abd0`), `phase.jsonl` (`f7138bc4273e26aceddfe27e722f9ab5adfc56d464e7265619d6e8039f7eac67`), and `gradle.log` (`e0e6595d928927959153bc10007a0068fbc8291452973b4a54cf08464e4f0e8d`).

All project-memory kernels and the six-dimension recall route were reopened. The confirmed business corpus G-06/G-07/G-09/G-10/G-11 and their non-derivation boundaries were checked. This is the final allowed round; no third adversarial round is requested or implied.

## Round-2 dispositions

### F1 — Store visible-data-node owner predicate and target recheck (M, PARTIALLY_CONFIRMED)

The round-1 broad leak is materially repaired. `OperationsStoreManagementController.java:52-67` now passes `session.visibleDataNodeId()` into the owner query, `scopedStore(...)` reads the current project and calls `user.resolveTaskScope(...)` before detail/update/status, and `OrganizationOverviewTaskReadService.java:91-99,135-151` applies the same visible-project predicate to page and count. Focused tests cover project pass-through and unfiltered list pass-through (`OperationsStoreManagementControllerCandidateScopeTest.java:61-126`).

One fail-closed edge remains: if an authenticated session has `visibleDataNodeId == null`, `visibleProjectPredicate(...)` returns an empty predicate (`OrganizationOverviewTaskReadService.java:146-151`), so list becomes workspace-wide; `list(...)` does not require an assignment/visible node before invoking the owner. The current focused tests do not cover a null-scope list, nor detail/update/status negative authorization tests. Minimal root fix: require current assignment and non-null visible node (or call the existing `resolveCurrentTaskScope`) before list, and add null/out-of-scope negative tests. This is not a broad known-store leak for normal scoped sessions, but it remains a medium severity fail-open boundary.

### F2 — Organization status confirmation Modal (S, REJECTED_WITH_EVIDENCE)

The previous direct transition is removed. `OrganizationStructurePage.tsx:394-400` now sets `transitionTarget`; `:275` applies `useOverlayLock(Boolean(transitionTarget))`; `:414-427` renders the IA04 confirmation title, cancel/confirm buttons, fixed impact copy, and calls the existing owner transition only from confirm. `OrganizationStructurePage.test.tsx` asserts the modal/overlay/test-id contract. F2 is closed for this cycle.

### F3 — Head-company status confirmation Modal (S, REJECTED_WITH_EVIDENCE)

`HeadCompanyManagementPage.tsx:235,346-352,372-384` now uses transition target state, overlay lock, fixed confirmation title and cancel/confirm controls before mutation. The operation remains owner-readback based. F3 is closed for this cycle. A dedicated focused test would improve proof, but the current source/static boundary is not itself a confirmed defect.

### F4 — Package/UI admission and exit evidence (M, CONFIRMED)

The latest bytes still show `rm1p6-u03-package-input.json.status=ACTIVE_NOT_EXIT`, `rm1p6-u03-source-compliance-disposition.json.rows=[]`, and `rm1p6-u03-final-ui-ia-control-alignment.json.status=PENDING` with an unfinished physical-screen denominator and explicit “no L2 is authorized.” The package has no exit evidence path. The latest r5 run is a real backend test run, but it does not change these package states or provide full P6-3 UI IA admission.

Minimal root fix: complete the declared U03 source-compliance and receipt equality denominators, make the full final UI IA alignment PASS, then perform the one authorized joint L2 and attach separate business/cleanup evidence before package exit.

### F5 — Static versus dynamic evidence boundary (S, REJECTED_WITH_EVIDENCE)

The latest managed run is properly scoped and auditable: `run-manifest.json` records `task=:apps:backend:catering-business-server:test`, `sourceSha256=167dc4e6...`, structured phase heartbeats, `logInspection.status=READ` with 14 reads and 7,178 observed bytes, `business.status=PASS`, `cleanup.status=PASS`, `firstFailure=null`, and `lastKnownGood=CLEANUP`. `remote-result.json` reports Gradle 0 and cleanup PASS; 16 XML files contain 56 tests with zero skips/failures/errors. This is valid backend dynamic evidence with cleanup, not a UI/full-journey claim. Local operations-admin typecheck/static tests remain separate and green. F5 is therefore closed as an evidence-boundary defect; no scope inflation was found.

## Final decision

`NO-GO` / `ROUND_FINAL_DECISION=SELF_DECIDED`. F2, F3 and F5 are closed. F1 remains `PARTIALLY_CONFIRMED` with a medium fail-open null-scope edge. F4 remains a confirmed package-admission/exit blocker. Because this is review round 2 of 2, stop adversarial review here; do not create a third reviewer cycle. The minimal next action is to fail closed on null visible scope, add the targeted negative tests, and complete the U03 full-denominator UI/package evidence before any GO or joint L2 claim.
