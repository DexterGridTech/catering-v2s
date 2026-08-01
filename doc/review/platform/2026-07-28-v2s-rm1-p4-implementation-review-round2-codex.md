---
reviewType: IMPLEMENTATION_ADVERSARIAL_REVIEW
REVIEW_CYCLE_ID: RM1-P4-IMPLEMENTATION-20260729
REVIEW_TARGET: IMPLEMENTATION
REVIEW_ROUND: 2
REVIEW_ROUND_LIMIT: 2
reviewerKind: INDEPENDENT_SUBAGENT
ROUND_FINAL_DECISION: SELF_DECIDED
verdict: NO-GO
---

# RM1 P4 implementation independent review — round 2

## 1. Independent-review declaration

`reviewerKind=INDEPENDENT_SUBAGENT`  
`ROUND_FINAL_DECISION=SELF_DECIDED`  
`blindReviewDeclaration=I reopened the original P4 business task, current production bytes, ledger, migration, managed evidence, and mechanical outputs from a falsification stance before reading any author conclusion or disposition. The requested prior-round artifact was not present in doc/review/platform, so no author verdict/disposition was read.`  
`authorMaterialReadAfterIndependentVerdict=false (the prior-round artifact is absent; this verdict is based on independently reopened sources)`

Business purpose: an existing platform/operations administration read must keep returning the same authorized owner facts while records and assignments scale, without per-row/per-assignment SQL amplification. This is P4's explicit user task in the amendment and is not merely a static-code cleanliness exercise.

## 2. Reviewer input checklist (all read)

| Input | SHA-256 | Result |
| --- | --- | --- |
| `AGENTS.md` | `f179f36d8aade8e4cb01def3637aef3a41dc031f79720c4fa13c1a58e3384414` | read |
| `PLATFORM-BLUEPRINT.md` | `29bcd8930f9ce75627ca32902f7fabc40c2c93c611e15db6a416cf7d8e3fab4d` | read |
| `doc/review/platform/2026-07-28-v2s-r6-problem-inventory-claude.md` | `ec3eabd35f3c9a27592e38190d0c726aac76e1fd2a2749a9e3cbc8c422ec4376` | read, P-E1/2/3/5/6/7/8/9 and P-R8 |
| `doc/roadmaps/platform/2026-07-28-v2s-rm1-restructure-and-remediation-roadmap-claude.md` | `e4cb040ec24c62504ed2d919af848b7c5c6f1b4b6dcdea9107a1d1bfc056e70f` | read, P4 allocation |
| `doc/plans/platform/2026-07-28-v2s-rm1-restructure-and-remediation-implementation-design-and-plan.md` | `8ea5d20a8d614cfc4fd9de0bebe946bee5a240d1b5bcbfe1943c0159aa384e3c` | read, P4-A…F completion criteria |
| `doc/evidence/platform/rm1/p4/rm1-u07-implementation-amendment.json` | `b7bba3fb58b297479393b2e508e0975b64ac1f322275b87785902eb37cc7743e` | read |
| `doc/evidence/platform/rm1/p4/canonical-performance-ledger.json` | `1ecb7e3f9572be6f5125647a275d690fcf32612e92e0916dbc3f113a0d4943d7` | read, 25 runtime-budget rows |
| current production sources: `OperationsStoreManagementController`, `BusinessEntityService`, `ContractTaskReadService`, `OrganizationOverviewTaskReadService`, `OrganizationHierarchyService`, `ExtensionDefinitionService`, `OrganizationVisibilityService`, `WorkspaceAuthenticationService`, `WorkspaceInvitationService`, `PlatformAssetService` | reopened directly; individual current hashes recorded by the review command log | read |
| `apps/backend/catering-business-server/src/test/java/database/P4SqlOperationBudgetTest.java` | `d4fd5a509555b8728874855ab8ec7c5d49bdf11d9f6629b6ae5daf672387ed99` | read |
| P4 migration `V20260729_010000_000__rm1_p4_hot_foreign_key_indexes.sql` | `14eae15e02729cb66ba41c9fe0e3c09212b553ceed6e262dd0cfd49822f98284` | read |
| managed evidence `r5-tc-1785258783252-90786/{runner-result,cleanup-result}.txt` | `7f1fbecfdfea9f59de73cf62ff7e0aa52b2eeb23386772d120707932b4602f82` / `1b14cf86c7b3389c8105f47a94bc9fa5b54007279d07bdaa9d91582a50fbcde1` | `REMOTE_EXIT_STATUS=0`, `CLEANUP=PASS` |
| `static-scan`, `validate-delta-receipts`, canonical-ledger, database-operation-budget, standards-coverage outputs | current execution | all mechanically PASS |

Memory route: `review/backend/operations-admin/backend/database/task-start`; all six kernels were read, then the routed independent-review, verification-governance, systemic-repair and incremental-compliance anchors and owning decisions were reopened. Corpus match: G-02/G-03/G-05/G-08/G-09; relevant counterexamples are that store enablement is not operating status and a role assignment is not a data-node fact.

## 3. Verdict: NO-GO — M=2 / S=1 / N=2

### M1 — P-E9's finite 25-path denominator is not implemented; multiple actual N+1 paths remain

**Status: CONFIRMED.** The ledger itself declares M1–M13, S1–S5, O1–O6 and R8 as `RUNTIME_BUDGET_REQUIRED`; P4-A's explicit completion criterion is each enumerated path, not a selected subset. Current production bytes still retain, among others:

1. `ExtensionDefinitionService#listDefinitions` selects only `entity_type` and calls `requireDefinition(...)` inside its RowMapper. That is `1 + N` (`ExtensionDefinitionService.java:35-38`), exactly ledger M10.
2. `OrganizationVisibilityService#listVisibleDataNodeCandidates` runs two unbounded owner scans, then for every row calls `isVisibleDataNodeAllowed(...)` and `ancestorPath(...)` (`OrganizationVisibilityService.java:67-104`). For a REGION assignment those helpers each issue SQL; this is ledger M11's named root cause, not a theoretical pattern.
3. `WorkspaceAuthenticationService#sessionEntry` batches roles, but still maps every assignment through `candidate(...)`, which calls `nodeName(...)`; `nodeName` performs an owner lookup / recursive path per assignment (`WorkspaceAuthenticationService.java:137-143`, `204-214`). Thus ledger S2 remains assignment-linear.
4. `PlatformAssetService#requireActivePublicReference` still calls `objects.exists(objectKey)` inside its JDBC `ResultSetExtractor` (`PlatformAssetService.java:122-130`), leaving ledger M13's cursor-held object I/O unchanged.
5. Same-root counterexample: `WorkspaceInvitationService#managementListForOperations` obtains an unbounded invitation list and invokes `invitationTarget(invitation.id())` per entry before scope filtering (`:133-141`, `:395-404`). It is an additional N+1 production read surface; it cannot be dismissed merely because the plain `managementList` path was subsequently batched.

The newer fixes are real but partial: the operations store page now obtains the paged IDs, then one `requireEntities` and one `derivedStoreStatuses` map before mapping rows; `BusinessEntityService` and `ContractTaskReadService` no longer call their `require/view` read inside the listed RowMappers. They do not close the remaining P-E9 denominator.

**Smallest correction:** complete the existing owner-owned batch/read-model APIs for the named finite rows (including visibility and session display paths); include the operations invitation counterexample in the canonical denominator or record a concrete, bounded `NOT_APPLICABLE_WITH_REASON` only if its endpoint is outside P4's approved read surface. Do not replace it with a syntax ban or direct cross-owner SQL.

### M2 — the dynamic SQL-count proof covers only three selected reads, not the declared ledger and budgets

**Status: CONFIRMED.** `P4SqlOperationBudgetTest` has exactly two test methods. Its count assertions execute only:

- `BusinessEntityService#requireEntities` at P=1/P=100;
- `ContractTaskReadService#derivedStoreStatuses` at P=1/P=100;
- `OrganizationOverviewTaskReadService#page` at P=1/P=100.

The 25 ledger rows name seven test classes and fixed budgets for M1–M13, S1–S5, O1–O6 and R8. No test source names ledger IDs or invokes the remaining call paths under the `CountingJdbcTemplate`; the managed run's `TEST-database.P4SqlOperationBudgetTest.xml` reports only these two test cases. Its red mutation repeats the obsolete single-store `derivedStoreStatus` in a loop; it proves that repetition increases the counter, not that every declared production path meets its own budget.

This contradicts both the P4 amendment's `REQUIRED_CURRENT_BYTE_DYNAMIC_QUERY_BUDGETS` obligation and the plan's requirement that every P-E9 path has a 1/100 or stated bounded-fixture count with a real red mutation. Static PASS and cleanup PASS are valid mechanical/runner evidence but cannot substitute for this missing business evidence.

**Smallest correction:** add a per-ledger-row, named runtime-budget mapping to the existing counting fixture (or focused owner test fixtures where that is smaller), with the ledger's exact P=1/P=100 or stated bound and a mutation that reintroduces that row's former repeated query. Keep the current three checks as part of that set; do not merely expand a source-token checker.

### S1 — the requested round-1 independent review artifact is absent from the repository input set

**Status: CONFIRMED.** The requested path `doc/review/platform/2026-07-28-v2s-rm1-p4-implementation-review-codex.md` is absent, and a full `doc/review/platform` filename/content search found no P4 implementation review artifact. Therefore this round cannot hash, quote, or show a source-anchored disposition of the first review's M1–M3/S1. This did not cause M1/M2 above (both were independently reproduced), but it weakens traceability for the fixed claims.

**Correction:** retain the completed round-2 verdict as the hard stop, and have the author record a source-reopen disposition for this review's M1/M2 and the historical-artifact absence in the P4 package evidence. Do not fabricate or retroactively rewrite a round-1 verdict.

## 4. Verified improvements / non-findings

1. **P-R8 targeted repair: CONFIRMED.** `OrganizationHierarchyService#requireNode` now completes its node extractor before querying phase names; the reviewed `BusinessEntityService` sites likewise perform follow-up reads outside their extractor. The full source scan found no remaining actual nested JDBC query in those three former P-R8 sites. This must not be regressed while fixing M1.
2. **P-E2 store-page repair: CONFIRMED.** The page path uses bounded page IDs plus two owner-owned batch reads, so it no longer performs one overview/detail/status query per displayed store. Detail/create/update retain single-item reads and are not a page-size multiplier.
3. **P-E1/S1 index evidence: CONFIRMED.** The additive migration contains exactly the seven declared foreign-key indexes; the managed P4 test runs all seven matching `EXPLAIN` assertions and the result XML is green. This resolves the prior per-index-plan gap.
4. **Managed-run hygiene: CONFIRMED.** The named R5 evidence has `REMOTE_EXIT_STATUS=0` and `CLEANUP=PASS`; no claim is made that this proves the untested ledger paths.

## 5. Final decision and authorized next action

`NO-GO`. This is review round **2/2** for `RM1-P4-IMPLEMENTATION-20260729`; no third independent review may be started. The author may now do the required source-reopen intake and minimal remediation for M1/M2, self-verify the full current-byte ledger evidence and then send the completed package to Dexter and Claude. This verdict neither authorizes P5 nor changes P4's owner, authorization, runtime, DEV/seed/reset, or product scope boundaries.
