# B15 workspace-iam source-to-sink ledger

## Scope and evidence boundary

- CP: B15 / workspace-iam execution relocation.
- Initial CP-0 baseline: 2026-09-14 01:28:47 KST; all initial counts below were recomputed from the working-tree bytes before B15 writes.
- Re-baselined current-byte checkpoint: 2026-09-14 02:35:51 KST, after all B15 application execution calls were connected to typed persistence. The earlier checkpoints are retained as history; they are not used as the current B15 denominator.
- Source root: `apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/`.
- Candidate rule: files whose top-level application class name ends in `Service` or `Coordinator`; nested types are not candidates.
- Direct sink rule: case-sensitive lexical matches for `jdbc.query`, `jdbc.queryForObject`, `jdbc.queryForList`, `jdbc.update`, `jdbc.execute`, or `jdbc.batchUpdate` followed by `(`. This is a source-site inventory, not a business operation denominator.
- Transaction inventory: case-sensitive `@Transactional` token count per candidate file. Annotation count is a sequencing measure only; it is not a proxy for aggregate ownership or behavior coverage.
- The first six typed execution boundaries and the `WorkspaceInvitationPublicFlowTest` fixture repair were already present when the re-baseline was taken. Subsequent B15 work must use the re-baselined inventory and the CP-0 matrices; no earlier “before B15 writes” claim is reused.

## Current-byte inventory

The candidate glob resolves to 20 files. The candidate annotation-token total is 110. The candidate set contains 17 files with direct JDBC sink calls. `WorkspaceCapabilityScopeResolver.java` is intentionally counted separately in the sink inventory because its class name is not a `Service`/`Coordinator` suffix; it is an application support resolver and is classified below.

| application class | `@Transactional` tokens | direct `jdbc.*` sink calls | classification | B15 disposition |
| --- | ---: | ---: | --- | --- |
| `PlatformInvitationCandidatesTaskReadService` | 1 | 0 | KEEP_TASK_READ | keep application task projection; no JDBC execution to relocate |
| `PlatformWorkspaceAccountTaskReadService` | 3 | 0 | KEEP_TASK_READ | retain platform read orchestration; execution now in `PlatformWorkspaceAccountTaskReadPersistence` |
| `PlatformWorkspaceInvitationTaskReadService` | 2 | 0 | KEEP_TASK_READ | retain platform read orchestration; execution now in `PlatformWorkspaceInvitationTaskReadPersistence` |
| `WorkspaceAccountService` | 10 | 0 | KEEP_SINGLE_AGGREGATE | retain account rules/command protocol; execution now in `WorkspaceAccountPersistence` |
| `WorkspaceAssignmentScopeService` | 1 | 0 | KEEP_TASK_READ | retain scope lookup contract; execution now in `WorkspaceAssignmentScopePersistence` |
| `WorkspaceAuditAuthorizationService` | 3 | 0 | KEEP_ADAPTER_SUPPORT | retain authorization adapter semantics; execution now in `WorkspaceAuditAuthorizationPersistence` |
| `WorkspaceAuthenticationService` | 19 | 0 | KEEP_ADAPTER_SUPPORT | retain authentication orchestration; execution now in `WorkspaceAuthenticationPersistence` |
| `WorkspaceCommandAuthorizationService` | 4 | 0 | KEEP_ADAPTER_SUPPORT | retain authorization semantics; execution now in `WorkspaceCommandAuthorizationPersistence` |
| `WorkspaceIamAuditHistoryService` | 6 | 0 | KEEP_ADAPTER_SUPPORT | retain audit projection semantics; execution now in `WorkspaceIamAuditHistoryPersistence` |
| `WorkspaceIamCommandReceiptService` | 0 | 0 | KEEP_ADAPTER_SUPPORT | retain receipt/replay semantics; execution now in `WorkspaceIamCommandReceiptPersistence` |
| `WorkspaceIamSummaryReadService` | 3 | 0 | KEEP_TASK_READ | retain summary task-read semantics; execution now in `WorkspaceIamSummaryReadPersistence` |
| `WorkspaceInvitationService` | 26 | 0 | KEEP_SINGLE_AGGREGATE | retain invitation rules/CAS/receipt/readback; execution now in `WorkspaceInvitationPersistence` |
| `WorkspaceLoginRateLimitService` | 0 | 0 | KEEP_ADAPTER_SUPPORT | retain rate-limit support semantics; execution now in `WorkspaceLoginRateLimitPersistence` |
| `WorkspaceOperationsCommandService` | 4 | 0 | KEEP_COORDINATOR | keep cross-owner command coordinator; no SQL sink to relocate |
| `WorkspaceOtpRateLimitService` | 0 | 0 | KEEP_ADAPTER_SUPPORT | retain OTP support; execution now in `WorkspaceOtpRateLimitPersistence` |
| `WorkspacePasswordRecoveryService` | 4 | 0 | KEEP_ADAPTER_SUPPORT | retain recovery orchestration; execution now in `WorkspacePasswordRecoveryPersistence` |
| `WorkspacePasswordResetService` | 1 | 0 | KEEP_ADAPTER_SUPPORT | retain reset support semantics; execution now in `WorkspacePasswordResetPersistence` |
| `WorkspaceRoleService` | 15 | 0 | KEEP_SINGLE_AGGREGATE | retain role rules/CAS/receipt/readback; execution now in `WorkspaceRolePersistence` |
| `WorkspaceTaskReadService` | 0 | 0 | KEEP_TASK_READ | retain task-read composition; no JDBC execution to relocate |
| `WorkspaceUserService` | 8 | 0 | KEEP_TASK_READ | retain user/task/scope rules; execution now in `WorkspaceUserPersistence` |

The current-byte strict scan reports zero direct sink files and zero direct sink calls under the application service/resolver paths. The 18 persistence files contain 125 sink call sites. The earlier 17/129 plus resolver/130 counts are retained only as pre-relocation history and are not current evidence.

## Existing SQL holders and target boundary

The current package already contains 18 `*ServiceSql.java` text holders, one for each direct-sink service/resolver. They are B3 text owners, not execution boundaries. B15 must add a typed persistence execution boundary for each direct-sink owner (or an explicitly reviewed shared typed persistence class where the source-to-sink and owner facts are identical); it must not leave a generic `JdbcTemplate` method in application and merely import the holder from persistence.

The holders are:

`PlatformWorkspaceAccountTaskReadServiceSql`, `PlatformWorkspaceInvitationTaskReadServiceSql`, `WorkspaceAccountServiceSql`, `WorkspaceAssignmentScopeServiceSql`, `WorkspaceAuditAuthorizationServiceSql`, `WorkspaceAuthenticationServiceSql`, `WorkspaceCapabilityScopeResolverSql`, `WorkspaceCommandAuthorizationServiceSql`, `WorkspaceIamAuditHistoryServiceSql`, `WorkspaceIamCommandReceiptServiceSql`, `WorkspaceIamSummaryReadServiceSql`, `WorkspaceInvitationServiceSql`, `WorkspaceLoginRateLimitServiceSql`, `WorkspaceOtpRateLimitServiceSql`, `WorkspacePasswordRecoveryServiceSql`, `WorkspacePasswordResetServiceSql`, `WorkspaceRoleServiceSql`, and `WorkspaceUserServiceSql`.

The final public boundary must receive business-level values: read-side filters/sort/page/target, or write-side aggregate/command/field values. No application/domain caller may pass SQL text, a SQL fragment, a SQL wrapper, a `RowMapper`, or a generic variadic SQL executor shape. Dynamic condition selection and combination must be owned inside the target persistence method.

## Candidate boundary facts

- `WorkspaceOperationsCommandService` implements `WorkspaceOperationsCommandApi` and has four `REQUIRED` command entries combining invitation/account/user owner commands and organization task-path lookup. It has no direct JDBC sink and remains a coordinator; it must not be moved into an IAM aggregate.
- `PlatformInvitationCandidatesTaskReadService` composes organization and role task reads and has no direct JDBC sink. It remains a task-read projection and is not silently omitted from the candidate matrix.
- `WorkspaceTaskReadService` and `WorkspaceUserService` are task-read surfaces. Their SQL, where present, remains owned by their actual task-read execution target; the task-read classification does not exempt the sink relocation.
- Authentication, password recovery/reset, login/OTP rate limits, authorization, audit history, and command receipt are support/adapter semantics. They must preserve their existing exception mapping, rate-limit facts, receipt/replay facts, and readback while moving only execution ownership.
- Account, invitation, and role are the three B15 single-aggregate candidates. Their command entry transaction propagation, lock/CAS, idempotency, audit, rollback, and authoritative readback must be proved before/after.
- `WorkspaceCapabilityScopeResolver` is a support resolver outside the suffix candidate set but inside the B15 application source inventory. Its direct query must not remain an unowned application sink; CP-0 must record its typed target and caller boundary.

## Current-byte post-checkpoint inventory

The same strict sink expression now reports 18 persistence files and 125 total source-site matches; it reports zero direct sink files and zero direct sink calls under the application service/resolver paths. The 18 typed persistence classes are `PlatformWorkspaceAccountTaskReadPersistence`, `PlatformWorkspaceInvitationTaskReadPersistence`, `WorkspaceAccountPersistence`, `WorkspaceAssignmentScopePersistence`, `WorkspaceAuditAuthorizationPersistence`, `WorkspaceAuthenticationPersistence`, `WorkspaceCapabilityScopePersistence`, `WorkspaceCommandAuthorizationPersistence`, `WorkspaceIamAuditHistoryPersistence`, `WorkspaceIamCommandReceiptPersistence`, `WorkspaceIamSummaryReadPersistence`, `WorkspaceInvitationPersistence`, `WorkspaceLoginRateLimitPersistence`, `WorkspaceOtpRateLimitPersistence`, `WorkspacePasswordRecoveryPersistence`, `WorkspacePasswordResetPersistence`, `WorkspaceRolePersistence`, and `WorkspaceUserPersistence`. This is the B15 execution-relocation closure for source-site placement; it is not a claim that runtime behavior or the full delivery unit is accepted.

The current candidate source inventory is still 20 suffix candidates and 110 `@Transactional` tokens. The current test directory contains 19 Java files, not 20. The earlier 20-file statement was a ledger counting error and is superseded below. The latest focused proof is `r5-tc-1789320772950-66076`; it compiled and ran the `workspace-iam:test` task on the remote Testcontainers plane with cleanup PASS.

## Caller and test inventory baseline

The B15 test directory currently contains 19 Java test files. Existing tests instantiate several services with `JdbcTemplate` compatibility constructors, including account, authentication, invitation, receipt, role, summary, user and password flows. Those constructors are test seams, not permission to retain production execution in application. B15 must preserve or deliberately update the constructor seam while Spring wiring injects typed persistence beans; every changed constructor/caller and each `Workspace*Service.*` static/FQCN consumer must be listed in the call-site matrix.

Current test files:

`CommandExecutionContextResolverTest`, `CommandReceiptNamespaceIsolationIntegrationTest`, `PlatformInvitationCandidatesTaskReadServiceTest`, `WorkspaceAccountPlatformReceiptTest`, `WorkspaceAuthenticationContextVersionTest`, `WorkspaceAuthenticationServiceNodeTypeTest`, `WorkspaceCapabilityScopeResolverTest`, `WorkspaceIamIndexMigrationIntegrationTest`, `WorkspaceIamSummaryReadServiceTest`, `WorkspaceInvitationPublicFlowTest`, `WorkspacePasswordRecoveryServiceTest`, `WorkspacePlatformAccountPageRequestTest`, `WorkspaceReadAuthorizationFactsTest`, `WorkspaceRolePageRequestTest`, `WorkspaceRoleServiceTest`, `WorkspaceTaskReadServiceTest`, `WorkspaceTestTaskPathLookup`, `WorkspaceUserCandidatePageTest`, and `WorkspaceUserTaskScopeTest`.

These names establish only the inventory. CP-1/each execution batch must locate the actual positive and negative business oracle, authoritative post-write readback, transaction/lock/idempotency/rollback coverage, and any gap. File existence or a class-name match cannot close behavior pinning.

## CP-0 close conditions

CP-0 remains `OPEN` until the four matrices contain, for every public overload in the 20 candidates and the non-suffix resolver boundary:

1. the complete Java signature, declaration/implementation path, caller `path:line`, receiver/interface type, target execution class, and keep/change/delete result;
2. transaction method family, self-call and outer transaction propagation, lock/CAS/idempotency/audit/readback facts;
3. every direct raw-SQL, SQL-fragment, SQL-wrapper or generic executor boundary and its call sites;
4. a test path and line-level business oracle/readback for applicable risk dimensions, or explicit `NONE_FOUND` with a later CP-1/owner-batch proof plan.

The CP-0 focused proof must report the 20-candidate zero-missing/zero-extra inventory, the zero-file/zero-call application sink inventory plus the 18-file/125-call persistence inventory, all 18 SQL holders, the resolver exception, and the current 19-test inventory. A fresh read-only independent reconciliation is required before B15 can be marked closed. Production code changes are complete for B15 source-site relocation; behavior and whole-delivery acceptance remain separate evidence tiers.
