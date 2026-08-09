# BP-U05 remaining owner-projection — author intake after independent DESIGN Round 1

`REVIEW_CYCLE_ID=OVERALL_PHASE_4_U05_REMAINING_OWNER_PROJECTIONS_DESIGN_20260809`  
`REVIEW_TARGET=DESIGN`  
`SOURCE_REVIEW=doc/review/platform/2026-08-09-v2s-backend-performance-phase4-u05-remaining-owner-projection-design-review-round1.md`  
`SOURCE_REVIEW_SHA256=4b930a4160d13ef63ae8e47e2d915d7f380c44289e18bec8fed3f9f7f4fb2626`

## Dialectical disposition

| finding | status | finite applicability | confirmed root cause | smallest repair and rejected alternative | evidence |
| --- | --- | --- | --- | --- | --- |
| `U05-REMAINING-M-01` | `CONFIRMED` | The three future reader families and exactly three real edge callers: `OperationsAuditHistoryController#history`, `PlatformAuditHistoryController#history`, and `PlatformWorkspaceAdministrationController#list/#detail`. | The design table named the readers but the manifest's implementation/receipt denominator omitted the real edge callers and their focused tests. | Added all three controller paths plus focused tests to the exact manifest surface; the detail design now binds each edge method to its one typed reader and declares four production-source red mutations. Rejecting reader-only tests would leave a bypassable HTTP chain and make package-exit equality false. | Current controller source confirms the legacy audit lookup/switch and direct group-workspace composition; manifest now declares six caller/proof paths. |
| `U05-REMAINING-M-02` | `CONFIRMED` | One policy row: `getPlatformEntityAuditHistory`, plus the generator's matching requirement. | Both policy and generator retained a stale `modules/audit` reader path despite the frozen decision's `app/application/audit` location. Their string-to-string self-test could pass without a real source path. | Normalized both to `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/application/audit/PlatformAuditHistoryTaskReadService.java`; added future-reader admission validation for existing source, method, exact edge call, `TASK_READER`, and primary boundary. Rejecting a new `modules/audit` module preserves the frozen module layout and avoids scope expansion. | `backend-performance-read-budget --check` and `--self-test` pass with 45 red fixtures; explicit wrong-path, absent-source, and absent-edge-call mutations fail. |

## Readback and remaining boundary

The re-opened source has the operations-audit nine-type switch, platform-audit seven branch set, and group-workspace direct composition. The repaired design does not implement any reader, change a public HTTP contract, run a runtime workload, or enter BP-U06. `BP_U05_READ_BUDGET_STATUS=BLOCKED_UNMEASURED` and `BP_U07_SQL_MERGE_SUCCESS=BLOCKED_UNMEASURED` remain required truth states.

Round 2 is requested only to verify the two repaired findings and their counterexamples. It must not reopen a third round or substitute a numeric performance claim for immutable snapshot evidence.

## Claude NO-GO remediation disposition

`CLAUDE_INPUT=doc/review/platform/2026-08-09-v2s-backend-performance-phase4-u05-remaining-owner-projection-review-claude.md`

| finding | status | finite applicability | repair and counterexample |
| --- | --- | --- | --- |
| `M-01` edge legacy read may remain beside a typed reader | `CONFIRMED` | Five remaining `sourceRequirement` rows: platform contract detail, platform organization detail, platform audit, group-workspace page, and group-workspace detail. | Each row now has a fixed `forbiddenEdgeReads` set derived from its own actual legacy edge chain. Admission requires typed reader source/method/call **and** absence of every forbidden expression in the anchor closure. True mutations reject a deleted forbidden rule and the independently demonstrated `reads.view(...)` insertion beside the typed contract reader. This extends the pre-existing two-owner “typed call present plus old call absent” control rather than creating a new mechanism. |
| `N-01` audit row cap ambiguity | `CONFIRMED` | Exactly `getPlatformEntityAuditHistory` with `PLATFORM_AUDIT_BRANCHED`. | Added `optionalCountCapBasis: BRANCH_CAPS`; the row remains 0, only the `PLATFORM_ADMIN` branch declares 1. The generator rejects a missing/wrong basis, a basis on another row, or changing the row cap to 1. No current runtime consumer exists, so no runtime scope is added. |
| `N-02` current manifest paired to Round 1 drifts | `CONFIRMED` | This design cycle only. | Before this remediation, current manifest plus Round 1 correctly failed `REVIEW_MANIFEST_HASH_DRIFT`; current manifest plus Round 2 passed `EXACT_REVIEWED_MANIFEST`. The two control-byte changes occurred after the cycle's final Round 2, so this declaration intentionally binds them as `POST_REMEDIATION_V1`, retains `implementationAuthority=false`, and requests Claude recheck instead of fabricating a third independent round. |

The current control proof is `backend-performance-read-budget --check` and `--self-test` PASS with `RED_FIXTURES=50`; U07 applicability check/self-test remain PASS and `BP_U07_SQL_MERGE_SUCCESS=BLOCKED_UNMEASURED`. This remediation changes no cap, denominator, reader path, production code, BP-U06 path, runtime operation, or SQL-success claim.

## Claude GO follow-up — S-01 / N-01 disposition

`CLAUDE_INPUT=doc/review/platform/2026-08-09-v2s-backend-performance-phase4-u05-remaining-owner-projection-recheck-claude.md`

| finding | status | finite applicability | root cause and smallest repair | retained boundary |
| --- | --- | --- | --- | --- |
| `S-01` cap-four group-workspace detail has no exact surface for `WorkspaceIamSummaryReadService#accountAndRoleSummary`, and list could retain a cross-schema EXISTS beside a new organization port | `CONFIRMED` | R5 only: `listPlatformGroupWorkspaces` and `getPlatformGroupWorkspaceDetail`; nine newly declared implementation/test paths plus the existing four R5 caller/reader paths. | The previously declared R5 surface described four owner segments but omitted the workspace-IAM aggregate owner and the source whose list query currently reads `organization.commercial_group`. The design now admits the missing update/create paths and requires replacement: `WorkspaceAdministrationService#list` returns only the platform base page; organization provides bounded initialization facts for the already-paged keys; detail consumes one typed workspace-IAM account-and-role aggregate. Reject retaining the EXISTS and adding the port because it double-reads the same initialization fact. | No production code is changed in this remediation. The legacy `PlatformWorkspaceService#initializeCommercialGroup` command path is explicitly retained and outside BP-U05 task reads. |
| `N-01` a forbidden legacy edge expression may be intentionally future-facing, but the generator cannot distinguish that from a misspelled dead rule | `CONFIRMED` | The fixed forbidden-read denominator is **15**, not 16: 13 current legacy hits, one correct implemented contract absence, and one prospective list rule, `initializationFacts.list(...)`. | Represent each rule as `{pattern, prospective?: true}`. Only `initializationFacts.list(...)` is prospective. For `SOURCE_NOT_IMPLEMENTED_BLOCKED` rows every non-prospective rule must match the real edge method closure; absence fails `BP_U05_FUTURE_READER_FORBIDDEN_EDGE_READ_NOT_LIVE`. Do not apply liveness to the already implemented contract row, whose correct state is old-chain absence. | The prospective rule is still admission-checked for absence after the reader is implemented; the repair does not alter cap, operation denominator, reader status, runtime authority, or BP-U06. |

The source audit corrected an arithmetic mismatch in the review narrative without inventing a sixteenth rule. This follow-up changes only plan/manifest/control documentation and the policy generator; it retains `implementationAuthority=false` and requires another Claude POST_REMEDIATION_V1 recheck before any implementation package can resume.

## Claude second recheck — R5 owner-source assertion disposition

`CLAUDE_INPUT=doc/review/platform/2026-08-09-v2s-backend-performance-phase4-u05-remaining-owner-projection-recheck2-claude.md`

| finding | status | finite applicability | disposition and evidence |
| --- | --- | --- | --- |
| `S-01` R5 design promised four owner-source red checks but the control only inspected edge closures | `CONFIRMED` | Only the two R5 exception rows: `listPlatformGroupWorkspaces` and `getPlatformGroupWorkspaceDetail`. | Added exact `ownerSourceAssertions`, activated only when the relevant future reader becomes `SOURCE_IMPLEMENTED_UNMEASURED`: `WorkspaceAdministrationService#list` rejects `organization.` and `EXISTS`; the organization initialization method rejects `platform_workspace`; `GroupWorkspaceTaskQuery` must expose only `GroupWorkspaceInitializationFact` without platform-owned fields; `WorkspaceIamSummaryReadService#accountAndRoleSummary` must contain exactly one JDBC statement and cannot delegate to `accountCount`/`roleCount`. Five synthetic source mutations now fail with five distinct R5 codes. Rejected an edge-only extension because edge source cannot observe schema reads or owner-local statement count. |
| `N-01` the manifest lacked a focused `WorkspaceAdministrationService` list test surface | `REJECTED_WITH_EVIDENCE` | One existing test: `modules/workspace/src/test/java/com/catering/v2s/platform/workspace/api/WorkspaceAdministrationPageRequestTest.java`. | The manifest already declares this existing file as `update` with the target “prove list SQL contains no organization schema reference.” The test directly constructs `WorkspaceAdministrationService`, captures `listSql` using `RecordingJdbcTemplate`, and is the smallest correct focused surface for the future SQL assertion. Creating a redundant `WorkspaceAdministrationServiceTest` would expand the denominator without additional proof. A future implementation-package reconciliation must use this real API-path test rather than the currently predeclared nonexistent application-path test. |

This remediation changes no cap, denominator, reader status, production code, BP-U06 path, runtime operation, or numeric SQL-success claim. `implementationAuthority=false` remains mandatory pending Claude recheck.
