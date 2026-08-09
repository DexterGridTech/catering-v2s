# BP-U05 clean implementation｜Cycle 3 Round 1 independent adversarial review

`REVIEW_TARGET=IMPLEMENTATION`  
`REVIEW_CYCLE_ID=OVERALL_PHASE_4_U05_CLEAN_IMPLEMENTATION_REVIEW_3_20260809`  
`REVIEW_ROUND=1` / `REVIEW_ROUND_LIMIT=2`  
`reviewerKind=INDEPENDENT_SUBAGENT`  
`reviewerInputChecklist={path:"doc/review/platform/2026-08-09-v2s-backend-performance-phase4-u05-clean-implementation-review-cycle3-input-checklist.md",sha256:"e8b569ee3ea15a693ddf52172681ba8479c23a87e1e40105665ed134cfb589bd"}`  
`blindReviewDeclaration=I independently reopened the current source, tests, controls, package evidence and designated inputs to try to disprove the clean implementation before reading any author intake or prior-cycle verdict.`  
`authorMaterialReadAfterIndependentVerdict=false`

## Verdict

**NO_GO — 2 M / 1 S / 1 N.** The current bytes cannot advance to the cycle's Round 2 until the two M findings are repaired and the focused proof is rerun within the authorized boundary.

## M findings

### M-01 — Rebaseline design-review binding is mechanically invalid

- Evidence: `scripts/check/implementation-design-granularity --manifest doc/review/platform/2026-08-09-v2s-backend-performance-phase4-u05-rebaseline-design-granularity-manifest.json --review doc/review/platform/2026-08-09-v2s-backend-performance-phase4-u05-rebaseline-design-review-round2.md` returned `IMPLEMENTATION_DESIGN_GRANULARITY=FAIL` and `REASON=POST_REMEDIATION_DECLARATION_INVALID`.
- The manifest declares a different review path and hash at [rebaseline manifest](../../review/platform/2026-08-09-v2s-backend-performance-phase4-u05-rebaseline-design-granularity-manifest.json) lines 92–101, while the checklist-designated Round 2 artifact has current SHA-256 `0e9f328d809addcedda6d2f79006a0fa3b176f95bb0dd94740cd4e49ee007b84` and declares `NO_GO` at lines 1–17.
- This violates the checklist's required two-manifest fresh check. The other required command, against `...remaining-owner-projection-design-granularity-manifest.json` and its Round 2 review, passed; it cannot compensate for this failed binding.

### M-02 — Both audit edges allow `Long.MAX_VALUE` with page size 1 to enter an owner reader

- At [OperationsAuditHistoryController.java](../../../apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/audit/OperationsAuditHistoryController.java#L61), `Math.multiplyExact(page - 1, pageSize)` followed by `Math.addExact(offset, pageSize)` accepts `(Long.MAX_VALUE, 1)`: the result is exactly `Long.MAX_VALUE`, not overflow. The reader call is then reachable at line 38.
- The same calculation appears in [PlatformAuditHistoryController.java](../../../apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/audit/PlatformAuditHistoryController.java#L66), before its reader call at line 34.
- Both focused tests nevertheless assert typed rejection and zero reader interaction for that exact pair: [operations test](../../../apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/edge/operations/audit/OperationsAuditHistoryControllerTest.java#L42) and [platform test](../../../apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/edge/platform/audit/PlatformAuditHistoryControllerTest.java#L75). This directly fails checklist item 3; page size 2 overflows, but page size 1 is the missing boundary.

## S finding

### S-01 — Operations-audit focused proof does not preserve the two authorization facts it claims to test

- [OperationsAuditTaskReadServiceTest.java](../../../apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/application/audit/OperationsAuditTaskReadServiceTest.java#L35) stubs only `workspaceUuid` and `groupWorkspaceKey`.
- Its organization and contract expectations then require `isNull()` for `assignmentNodeType` and `visibleOrganizationFacts` at lines 57–60. The test passes if `OperationsAuditTaskReadService` drops the required authorization/visibility facts and forwards `null`, so it does not prove the exact owner arguments demanded by checklist item 4.
- The source itself presently forwards both facts to organization and visible facts to contract ([OperationsAuditTaskReadService.java](../../../apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/application/audit/OperationsAuditTaskReadService.java#L35)); strengthen the focused test rather than changing that owner-local source behavior.

## N — verified non-findings and limits

- Owner/scope inspection found closed typed audit variants rather than operationId dispatch, a global query bus, command-to-task-reader call, or cross-schema DML. The operations reader's nine variants are compile-time sealed; the platform reader keeps `PLATFORM_ADMIN` outside selected-workspace resolution.
- `scripts/check/backend-performance-read-budget` and `--self-test` passed with `GET_OPERATIONS=83`, `TASK_READ=78`, `PROTOCOL_READ_EXEMPT=5`, `OPERATIONS_AUDIT_TARGET_TYPES=9`, and `BP_U05_READ_BUDGET_STATUS=BLOCKED_UNMEASURED`. SQL applicability check and self-test passed with `BP_U07_SQL_MERGE_SUCCESS=BLOCKED_UNMEASURED`; `scripts/check/standards-coverage --phase R5` passed. These are not performance-success claims.
- `gradle :apps:backend:catering-business-server:compileJava :apps:backend:catering-business-server:compileTestJava` passed. A focused `test` invocation was stopped by the repository's `V2S_TESTCONTAINERS_REMOTE_REQUIRED` guard before test execution because local Docker is forbidden. No remote/runtime command was attempted: package input excludes runtime and dynamic proof remains `NOT_RUN_BLOCKED_UNMEASURED` in `doc/evidence/platform/2026-08-09-v2s-backend-performance-phase4-u05-clean-implementation-package-exit.json` lines 5–10.
- Workspace page/detail and organization-initialization tests provide finite owner-stage assertions; the review does not treat the empty exit `changedPaths` as a closure because the package is `ACTIVE_NOT_EXIT` and the artifact is a Round 1 verdict, not package exit.

## Round 2 entry

Round 2 should be limited to: (1) the corrected post-remediation declaration binding, (2) both audit edges' page-1 and page-2 maximum boundary rejection before any reader, and (3) non-null exact authorization/visibility fact verification for all affected operations-audit owner variants. Dynamic execution remains out of scope unless separately authorized.
