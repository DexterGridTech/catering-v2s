# B15 public overload oracle/readback closure

## Purpose and boundary

- Checkpoint: 2026-09-14 current byte after the B15 source relocation and the summary-count focused repair.
- The authoritative signature source is [b15-cp0-matrices-codex.md](doc/evidence/platform/2026-09-14-b15-cp0-matrices-codex.md), exact-index rows 1–134. This appendix makes the previously open oracle field explicit for every row; it is an implementation evidence note, not a compliance ledger and does not introduce a new review cycle.
- `ORACLE_NAMED` means the named test method/path below was opened and contains a business result, negative boundary, or authoritative readback assertion. `N/A_WITH_REASON` means the exact public overload is only a default/argument/delegation/composition wrapper with no distinct persistence, transaction, lock, CAS, idempotency or readback branch; the target row is the named proof. `NONE_FOUND_WITH_NA` remains in the vocabulary for an exact no-caller disposition; the current table contains no row with that status. Row 120 is `ORACLE_NAMED`, with its caller and named test oracle recorded below.
- This closes matrix mapping, not a claim that every overload needs a unique test method. Applicable transaction, lock, CAS, replay, rollback and readback behavior remains tied to the named owner/acceptance tests in the execution-batch risk plan.

## Named evidence keys

- **A01**: modules/workspace-iam/src/test/java/com/catering/v2s/workspace/iam/application/PlatformInvitationCandidatesTaskReadServiceTest.java:15 — organizationCandidateUsesExactlyTheTypedOrganizationProjection；断言候选总数、ref 与 typed query。
- **A02**: modules/workspace-iam/src/test/java/com/catering/v2s/workspace/iam/application/WorkspacePlatformAccountPageRequestTest.java:15；src/test/java/com/catering/v2s/app/edge/platform/workspaceiam/PlatformWorkspaceAccountControllerSortTest.java:36,75,101 — 页数/排序/状态命令的 owner readback 与 controller 业务断言。
- **A03**: modules/workspace-iam/src/test/java/com/catering/v2s/workspace/iam/application/WorkspaceAccountPlatformReceiptTest.java:86；WorkspaceUserTaskScopeTest.java:141,258,290,330,478 — account/detail/page、CAS、receipt replay、scope 与 assignment readback。
- **A04**: modules/workspace-iam/src/test/java/com/catering/v2s/workspace/iam/application/WorkspaceCapabilityScopeResolverTest.java:22；WorkspaceUserTaskScopeTest.java:402,422,459 — active assignment/scope、跨 group/target 拒绝与 owner 事实。
- **A05**: src/test/java/com/catering/v2s/workspace/iam/application/WorkspaceAuditAuthorizationServiceTest.java:23,31,40,61,75 — group/scoped host 与 subject range 的正负授权 oracle。
- **A06**: modules/workspace-iam/src/test/java/com/catering/v2s/workspace/iam/application/WorkspaceAuthenticationContextVersionTest.java:75,153,189；WorkspaceInvitationPublicFlowTest.java:474,523；src/test/java/com/catering/v2s/app/acceptance/IamAcceptanceScenarios.java:487,1791 — context/session/authentication 的版本、状态、readback 与入口业务断言。
- **A07**: modules/workspace-iam/src/test/java/com/catering/v2s/workspace/iam/application/WorkspaceCapabilityScopeResolverTest.java:22,45,67,88,109,145,186 — 七个 resolver 入口的 capability/target/path 正负断言。
- **A08**: modules/workspace-iam/src/test/java/com/catering/v2s/workspace/iam/application/CommandExecutionContextResolverTest.java:94,112,126,139；WorkspaceUserTaskScopeTest.java:478 — typed forbidden、workspace/context 先后顺序与 command scope/capability oracle。
- **A09**: src/test/java/com/catering/v2s/app/acceptance/AuditAcceptanceScenarios.java:27,98,138 — platform/operations audit 分页、总数、owner boundary 与结果 readback。
- **A10**: modules/workspace-iam/src/test/java/com/catering/v2s/workspace/iam/application/CommandReceiptNamespaceIsolationIntegrationTest.java:57；WorkspaceAccountPlatformReceiptTest.java:86；WorkspaceRoleServiceTest.java:57 — receipt lock namespace、replay/conflict 与 owner readback。
- **A11**: modules/workspace-iam/src/test/java/com/catering/v2s/workspace/iam/application/WorkspaceIamSummaryReadServiceTest.java:21,37,51 — aggregate、accountCount、roleCount 的结果、SQL owner 与 null-to-zero 业务事实。
- **A12**: modules/workspace-iam/src/test/java/com/catering/v2s/workspace/iam/application/WorkspaceInvitationPublicFlowTest.java:144,210,293,324,344,428,474,607,634,655,701,718,744；src/test/java/com/catering/v2s/app/acceptance/IamAcceptanceScenarios.java:21,67,1665,1748 — invitation create/page/detail/cancel/reissue/public OTP/complete 的状态、assignment、audit 与 readback。
- **A13**: modules/workspace-iam/src/test/java/com/catering/v2s/workspace/iam/application/WorkspacePasswordRecoveryServiceTest.java:173；WorkspaceInvitationPublicFlowTest.java:474；src/test/java/com/catering/v2s/app/acceptance/IamAcceptanceScenarios.java:1791 — login/source/account rate-limit window、failure/clear 与 session entry 业务事实。
- **A14**: src/test/java/com/catering/v2s/workspace/iam/application/operations/OperationsWorkspaceInvitationOperationTest.java:27,57,86；src/test/java/com/catering/v2s/app/edge/operations/access/OperationsWorkspaceInvitationServerScopeTest.java:129,238,311；OperationsWorkspaceUserServerScopeTest.java:127,133 — coordinator/edge 参数、scope、idempotency 转发与 owner readback。
- **A15**: modules/workspace-iam/src/test/java/com/catering/v2s/workspace/iam/application/WorkspacePasswordRecoveryServiceTest.java:173；WorkspaceInvitationPublicFlowTest.java:324,474 — OTP send/verify/invalid/success 的 rate-limit 与一次性业务断言。
- **A16**: modules/workspace-iam/src/test/java/com/catering/v2s/workspace/iam/application/WorkspacePasswordRecoveryServiceTest.java:59,112,153,173 — recovery start/OTP/identity/revocation/complete 的正负 readback。
- **A17**: src/test/java/com/catering/v2s/app/acceptance/P2ReadConnectionScopeScenarios.java:1234 — credential-reset HTTP 成功后版本/readback 与 owner scope 业务断言。
- **A18**: modules/workspace-iam/src/test/java/com/catering/v2s/workspace/iam/application/WorkspaceRoleServiceTest.java:57,82,106,118,128,145；WorkspaceRolePageRequestTest.java:21,44,69 — role create/update/permission/status/page/detail 的业务结果、typed absence、排序与 readback。
- **A19**: modules/workspace-iam/src/test/java/com/catering/v2s/workspace/iam/application/WorkspaceTaskReadServiceTest.java:14，并委托 A02/A03/A12/A06 的 owner 业务 oracle。
- **A20**: modules/workspace-iam/src/test/java/com/catering/v2s/workspace/iam/application/WorkspaceUserTaskScopeTest.java:96,141,189,202,214,246,258,290,330,377,402,422,459,478；WorkspaceUserCandidatePageTest.java:28,63；WorkspacePlatformAccountPageRequestTest.java:15,58,111 — user/task/scope/candidate/page/detail/revoke 的正负边界与 readback。

## Explicit row closure

| exact-index row | operation anchor | closure | named evidence / delegation reason |
| ---: | --- | --- | --- |
| 001 | `PlatformInvitationCandidatesTaskReadService:27 candidates(WorkspaceUserService.CandidateQuery query)` | ORACLE_NAMED | A01 |
| 002 | `PlatformWorkspaceAccountTaskReadService:48 page(WorkspaceUserService.AccountPageQuery query)` | ORACLE_NAMED | A02 |
| 003 | `PlatformWorkspaceAccountTaskReadService:69 detail(WorkspaceUserService.AccountDetailQuery query)` | ORACLE_NAMED | A03 |
| 004 | `PlatformWorkspaceAccountTaskReadService:78 transitionStatusAndReadback(UUID workspaceUuid, String key, UUID accountId, String status, long expectedVersion, String idempotencyKey, AuditActor actor)` | ORACLE_NAMED | A02/A03 |
| 005 | `PlatformWorkspaceInvitationTaskReadService:35 page(UUID workspaceUuid, String key, WorkspaceInvitationService.ManagementInvitationPageRequest request)` | ORACLE_NAMED | A12 |
| 006 | `PlatformWorkspaceInvitationTaskReadService:47 detail(UUID workspaceUuid, String key, UUID invitationId)` | ORACLE_NAMED | A12 |
| 007 | `WorkspaceAccountService:75 require(UUID workspaceUuid, String key, UUID accountId)` | ORACLE_NAMED | A03 |
| 008 | `WorkspaceAccountService:80 transitionStatus(UUID workspaceUuid, String key, UUID accountId, String status, long expectedVersion)` | N/A_WITH_REASON | pure delegator/default/composition wrapper; behavior and persistence branch are covered by exact-index row 009 and its named oracle |
| 009 | `WorkspaceAccountService:86 transitionStatus(UUID workspaceUuid, String key, UUID accountId, String status, long expectedVersion, AuditActor actor)` | ORACLE_NAMED | A03 |
| 010 | `WorkspaceAccountService:114 transitionStatusForPlatform(UUID workspaceUuid, String key, UUID accountId, String status, long expectedVersion, String idempotencyKey, AuditActor actor)` | ORACLE_NAMED | A10 |
| 011 | `WorkspaceAccountService:132 revokeAssignment(UUID workspaceUuid, String key, UUID accountId, UUID assignmentId, long expectedVersion)` | N/A_WITH_REASON | pure delegator/default/composition wrapper; behavior and persistence branch are covered by exact-index row 012 and its named oracle |
| 012 | `WorkspaceAccountService:138 revokeAssignment(UUID workspaceUuid, String key, UUID accountId, UUID assignmentId, long expectedVersion, AuditActor actor)` | ORACLE_NAMED | A03 |
| 013 | `WorkspaceAccountService:154 revokeAssignmentForPlatform(UUID workspaceUuid, String key, UUID accountId, UUID assignmentId, long expectedVersion, String idempotencyKey, AuditActor actor)` | ORACLE_NAMED | A10 |
| 014 | `WorkspaceAccountService:175 revokeAssignment(UUID workspaceUuid, String key, UUID assignmentId, long expectedVersion)` | N/A_WITH_REASON | pure delegator/default/composition wrapper; behavior and persistence branch are covered by exact-index row 015 and its named oracle |
| 015 | `WorkspaceAccountService:180 revokeAssignment(UUID workspaceUuid, String key, UUID assignmentId, long expectedVersion, AuditActor actor)` | ORACLE_NAMED | A03 |
| 016 | `WorkspaceAccountService:188 revokeAssignmentForOperations(UUID workspaceUuid, String key, UUID actorAssignmentId, String expectedTargetType, UUID assignmentId, long expectedVersion, String idempotencyKey, AuditActor actor)` | ORACLE_NAMED | A10/A03 |
| 017 | `WorkspaceAssignmentScopeService:23 requireActiveScope(UUID workspaceUuid, String groupWorkspaceKey, UUID assignmentId)` | ORACLE_NAMED | A04 |
| 018 | `WorkspaceAuditAuthorizationService:37 requireGroupHost(WorkspaceSessionReadback session)` | ORACLE_NAMED | A05 |
| 019 | `WorkspaceAuditAuthorizationService:44 requireScopedHost(WorkspaceSessionReadback session, String targetType, UUID targetId)` | ORACLE_NAMED | A05 |
| 020 | `WorkspaceAuditAuthorizationService:50 requireWorkspaceSubject(WorkspaceSessionReadback session, String entityType, UUID subjectId)` | ORACLE_NAMED | A05 |
| 021 | `WorkspaceAuthenticationService:153 login(String groupWorkspaceKey, String loginName, char[] password)` | N/A_WITH_REASON | pure delegator/default/composition wrapper; behavior and persistence branch are covered by exact-index row 022 and its named oracle |
| 022 | `WorkspaceAuthenticationService:167 login(String groupWorkspaceKey, String loginName, char[] password, String sourceAddress)` | ORACLE_NAMED | A06 |
| 023 | `WorkspaceAuthenticationService:181 loginWithSessionEntry(String groupWorkspaceKey, String loginName, char[] password, String sourceAddress)` | ORACLE_NAMED | A06 |
| 024 | `WorkspaceAuthenticationService:215 sendLoginOtp(String groupWorkspaceKey, String mobile)` | ORACLE_NAMED | A13 |
| 025 | `WorkspaceAuthenticationService:232 verifyLoginOtp(String groupWorkspaceKey, String mobile, String otp)` | ORACLE_NAMED | A06 |
| 026 | `WorkspaceAuthenticationService:237 verifyLoginOtpWithSessionEntry(String groupWorkspaceKey, String mobile, String otp)` | ORACLE_NAMED | A06 |
| 027 | `WorkspaceAuthenticationService:256 selectContext(String rawToken, UUID assignmentId, UUID scopeNodeId, long expectedContextVersion)` | ORACLE_NAMED | A06 |
| 028 | `WorkspaceAuthenticationService:273 selectContext(String rawToken, UUID assignmentId, long expectedContextVersion)` | N/A_WITH_REASON | pure delegator/default/composition wrapper; behavior and persistence branch are covered by exact-index row 029 and its named oracle |
| 029 | `WorkspaceAuthenticationService:284 selectContext(String rawToken, String expectedGroupWorkspaceKey, UUID assignmentId, long expectedContextVersion)` | ORACLE_NAMED | A06 |
| 030 | `WorkspaceAuthenticationService:317 selectDataNode(String rawToken, String dataNodeType, UUID scopeNodeId, long expectedContextVersion)` | N/A_WITH_REASON | pure delegator/default/composition wrapper; behavior and persistence branch are covered by exact-index row 031 and its named oracle |
| 031 | `WorkspaceAuthenticationService:328 selectDataNode(String rawToken, String expectedGroupWorkspaceKey, String dataNodeType, UUID scopeNodeId, long expectedContextVersion)` | ORACLE_NAMED | A06 |
| 032 | `WorkspaceAuthenticationService:392 session(String rawToken)` | ORACLE_NAMED | A06 |
| 033 | `WorkspaceAuthenticationService:401 readAuthorizationFacts(String rawToken)` | ORACLE_NAMED | A06 |
| 034 | `WorkspaceAuthenticationService:435 commandAuthorizationFacts(String rawToken)` | ORACLE_NAMED | A08 |
| 035 | `WorkspaceAuthenticationService:480 sessionForPasswordChange(String rawToken)` | ORACLE_NAMED | A06 |
| 036 | `WorkspaceAuthenticationService:528 sessionEntry(String rawToken)` | ORACLE_NAMED | A06 |
| 037 | `WorkspaceAuthenticationService:534 sessionEntry(String rawToken, String groupWorkspaceKey)` | ORACLE_NAMED | A06 |
| 038 | `WorkspaceAuthenticationService:700 logout(String rawToken)` | ORACLE_NAMED | A06 |
| 039 | `WorkspaceAuthenticationService:707 changeCurrentPassword(String rawToken, char[] currentPassword, char[] newPassword, long expectedSessionVersion)` | ORACLE_NAMED | A06 |
| 040 | `WorkspaceCapabilityScopeResolver:50 resolve(WorkspaceSessionReadback session, String requirementId, ServerResolvedResource target)` | N/A_WITH_REASON | pure delegator/default/composition wrapper; behavior and persistence branch are covered by exact-index row 045 and its named oracle |
| 041 | `WorkspaceCapabilityScopeResolver:60 resolveStatusTransition(WorkspaceSessionReadback session, String requirementId, ServerResolvedResource target)` | N/A_WITH_REASON | pure delegator/default/composition wrapper; behavior and persistence branch are covered by exact-index row 046 and its named oracle |
| 042 | `WorkspaceCapabilityScopeResolver:69 resolveIncludingDisabledStoreTarget(WorkspaceSessionReadback session, String requirementId, ServerResolvedResource target)` | ORACLE_NAMED | A07 |
| 043 | `WorkspaceCapabilityScopeResolver:80 resolveGeneratedOperation(WorkspaceSessionReadback session, String requirementId, String capabilityKey, ServerResolvedResource target)` | ORACLE_NAMED | A07 |
| 044 | `WorkspaceCapabilityScopeResolver:100 resolveGeneratedCatalogOperation(WorkspaceSessionReadback session, String requirementId, String capabilityKey, ServerResolvedResource target, CatalogScopeLookup.CatalogBrandSelection selection)` | ORACLE_NAMED | A07 |
| 045 | `WorkspaceCapabilityScopeResolver:172 resolveUsingResolvedTaskPath(WorkspaceSessionReadback session, String requirementId, ServerResolvedResource target, OrganizationTaskPathLookup.TaskPath resolvedTaskPath)` | ORACLE_NAMED | A07 |
| 046 | `WorkspaceCapabilityScopeResolver:195 resolveStatusTransitionUsingResolvedTaskPath(WorkspaceSessionReadback session, String requirementId, ServerResolvedResource target, OrganizationTaskPathLookup.TaskPath resolvedTaskPath)` | ORACLE_NAMED | A07 |
| 047 | `WorkspaceCommandAuthorizationService:40 requireUserManagementAction(UUID workspaceUuid, String groupWorkspaceKey, UUID actorAssignmentId, String targetOrganizationType, UUID targetOrganizationId, UserManagementAction action)` | N/A_WITH_REASON | pure delegator/default/composition wrapper; behavior and persistence branch are covered by exact-index row 050 and its named oracle |
| 048 | `WorkspaceCommandAuthorizationService:63 requireUserManagementAction(UUID workspaceUuid, String groupWorkspaceKey, UUID actorAssignmentId, String targetOrganizationType, OrganizationTaskPathLookup.TaskPath validatedTarget, UserManagementAction action)` | N/A_WITH_REASON | pure delegator/default/composition wrapper; behavior and persistence branch are covered by exact-index row 049 and its named oracle |
| 049 | `WorkspaceCommandAuthorizationService:85 requireUserManagementActionOnValidatedScope(UUID workspaceUuid, String groupWorkspaceKey, UUID actorAssignmentId, String capabilityTargetType, OrganizationTaskPathLookup.TaskPath validatedScope, UserManagementAction action)` | ORACLE_NAMED | A08 |
| 050 | `WorkspaceCommandAuthorizationService:103 requireUserManagementCapabilityOnScope(UUID workspaceUuid, String groupWorkspaceKey, UUID actorAssignmentId, String capabilityTargetType, UserManagementAction action, String scopeTargetType, UUID scopeTargetId)` | ORACLE_NAMED | A08 |
| 051 | `WorkspaceIamAuditHistoryService:28 read(AuditReadScope scope, AuditTarget target, long page, long pageSize)` | ORACLE_NAMED | A09 |
| 052 | `WorkspaceIamAuditHistoryService:55 readWorkspaceRole(AuditReadScope scope, String roleId, long page, long pageSize)` | ORACLE_NAMED | A09 |
| 053 | `WorkspaceIamAuditHistoryService:67 readWorkspaceAccount(AuditReadScope scope, String accountId, long page, long pageSize)` | ORACLE_NAMED | A09 |
| 054 | `WorkspaceIamAuditHistoryService:79 readWorkspaceInvitation(AuditReadScope scope, String invitationId, long page, long pageSize)` | ORACLE_NAMED | A09 |
| 055 | `WorkspaceIamAuditHistoryService:93 readPlatformAuditProjection(AuditReadScope scope, AuditTarget target, long page, long pageSize)` | ORACLE_NAMED | A09 |
| 056 | `WorkspaceIamAuditHistoryService:147 readOperationsAuditProjection(WorkspaceReadAuthorizationFacts facts, AuditTarget target, long page, long pageSize)` | ORACLE_NAMED | A09 |
| 057 | `WorkspaceIamCommandReceiptService:28 execute(UUID workspaceUuid, String key, String canonicalRequest, Class<T> resultType, Supplier<T> command)` | ORACLE_NAMED | A10 |
| 058 | `WorkspaceIamSummaryReadService:24 accountAndRoleSummary(UUID workspaceUuid)` | ORACLE_NAMED | A11 |
| 059 | `WorkspaceIamSummaryReadService:30 accountCount(UUID workspaceUuid)` | ORACLE_NAMED | A11 |
| 060 | `WorkspaceIamSummaryReadService:36 roleCount(UUID workspaceUuid)` | ORACLE_NAMED | A11 |
| 061 | `WorkspaceInvitationService:162 create(UUID workspaceUuid, String groupWorkspaceKey, String mobile, List<AssignmentIntent> intents, String idempotencyKey, AuditActor actor)` | ORACLE_NAMED | A12 |
| 062 | `WorkspaceInvitationService:185 createForOperations(UUID workspaceUuid, String groupWorkspaceKey, UUID actorAssignmentId, OrganizationTaskPathLookup.TaskPath validatedTarget, String mobile, List<AssignmentIntent> intents, String idempotencyKey, AuditActor actor)` | ORACLE_NAMED | A12 |
| 063 | `WorkspaceInvitationService:233 create(UUID workspaceUuid, String groupWorkspaceKey, String mobile, List<AssignmentIntent> intents, long expiresAtEpochMillis)` | N/A_WITH_REASON | pure delegator/default/composition wrapper; behavior and persistence branch are covered by exact-index row 064 and its named oracle |
| 064 | `WorkspaceInvitationService:243 create(UUID workspaceUuid, String groupWorkspaceKey, String mobile, List<AssignmentIntent> intents, long expiresAtEpochMillis, AuditActor actor)` | ORACLE_NAMED | A12 |
| 065 | `WorkspaceInvitationService:325 managementPage(UUID workspaceUuid, String groupWorkspaceKey, ManagementInvitationPageRequest request)` | N/A_WITH_REASON | pure delegator/default/composition wrapper; behavior and persistence branch are covered by exact-index row 066 and its named oracle |
| 066 | `WorkspaceInvitationService:332 managementPageForOperations(WorkspaceSessionReadback session, String expectedTargetType, UUID requestedScopeRef, ManagementInvitationPageRequest request)` | ORACLE_NAMED | A12 |
| 067 | `WorkspaceInvitationService:403 managementView(WorkspaceInvitationReadback invitation)` | N/A_WITH_REASON | pure delegator/default/composition wrapper; behavior and persistence branch are covered by exact-index row 068 and its named oracle |
| 068 | `WorkspaceInvitationService:432 managementInvitation(UUID workspaceUuid, String groupWorkspaceKey, UUID invitationId)` | ORACLE_NAMED | A12 |
| 069 | `WorkspaceInvitationService:498 cancel(UUID workspaceUuid, String groupWorkspaceKey, UUID invitationId, long expectedVersion)` | N/A_WITH_REASON | pure delegator/default/composition wrapper; behavior and persistence branch are covered by exact-index row 070 and its named oracle |
| 070 | `WorkspaceInvitationService:503 cancel(UUID workspaceUuid, String groupWorkspaceKey, UUID invitationId, long expectedVersion, AuditActor actor)` | ORACLE_NAMED | A12 |
| 071 | `WorkspaceInvitationService:524 cancel(UUID workspaceUuid, String groupWorkspaceKey, UUID invitationId, long expectedVersion, String idempotencyKey, AuditActor actor)` | ORACLE_NAMED | A12 |
| 072 | `WorkspaceInvitationService:544 cancelForOperations(UUID workspaceUuid, String groupWorkspaceKey, UUID actorAssignmentId, String expectedTargetType, OrganizationTaskPathLookup.TaskPath selectedScope, UUID invitationId, long expectedVersion, String idempotencyKey, AuditActor actor)` | ORACLE_NAMED | A12 |
| 073 | `WorkspaceInvitationService:568 reissue(UUID workspaceUuid, String groupWorkspaceKey, UUID invitationId, long expectedVersion)` | N/A_WITH_REASON | pure delegator/default/composition wrapper; behavior and persistence branch are covered by exact-index row 074 and its named oracle |
| 074 | `WorkspaceInvitationService:574 reissue(UUID workspaceUuid, String groupWorkspaceKey, UUID invitationId, long expectedVersion, AuditActor actor)` | ORACLE_NAMED | A12 |
| 075 | `WorkspaceInvitationService:600 reissue(UUID workspaceUuid, String groupWorkspaceKey, UUID invitationId, long expectedVersion, String idempotencyKey, AuditActor actor)` | ORACLE_NAMED | A12 |
| 076 | `WorkspaceInvitationService:616 reissueForOperations(UUID workspaceUuid, String groupWorkspaceKey, UUID actorAssignmentId, String expectedTargetType, OrganizationTaskPathLookup.TaskPath selectedScope, UUID invitationId, long expectedVersion, String idempotencyKey, AuditActor actor)` | ORACLE_NAMED | A12 |
| 077 | `WorkspaceInvitationService:641 acceptPublic(String groupWorkspaceKey, String rawInvitationToken)` | ORACLE_NAMED | A12 |
| 078 | `WorkspaceInvitationService:665 publicView(String groupWorkspaceKey, String rawInvitationToken)` | ORACLE_NAMED | A12 |
| 079 | `WorkspaceInvitationService:688 sendPublicOtp(String groupWorkspaceKey, String rawInvitationToken, String mobile)` | ORACLE_NAMED | A12 |
| 080 | `WorkspaceInvitationService:707 verifyPublicOtp(String groupWorkspaceKey, String rawInvitationToken, String mobile, String rawOtp)` | ORACLE_NAMED | A12 |
| 081 | `WorkspaceInvitationService:754 savePublicCredentials(String groupWorkspaceKey, String rawInvitationToken, String grant, String userName, String loginName, char[] password)` | ORACLE_NAMED | A12 |
| 082 | `WorkspaceInvitationService:789 completePublic(String groupWorkspaceKey, String rawInvitationToken)` | ORACLE_NAMED | A12 |
| 083 | `WorkspaceInvitationService:811 publicCompletion(String groupWorkspaceKey, String rawInvitationToken)` | N/A_WITH_REASON | pure delegator/default/composition wrapper; behavior and persistence branch are covered by exact-index row 082 and its named oracle |
| 084 | `WorkspaceInvitationService:817 issueMobileVerificationOtp(UUID invitationId, long expiresAtEpochMillis)` | ORACLE_NAMED | A12 |
| 085 | `WorkspaceInvitationService:841 issueMobileVerificationOtp(String rawInvitationToken, long expiresAtEpochMillis)` | ORACLE_NAMED | A12 |
| 086 | `WorkspaceInvitationService:846 issueMobileVerificationOtp(String groupWorkspaceKey, String rawInvitationToken, long expiresAtEpochMillis)` | ORACLE_NAMED | A12 |
| 087 | `WorkspaceLoginRateLimitService:47 begin(String key, String loginName, String sourceAddress)` | ORACLE_NAMED | A13 |
| 088 | `WorkspaceLoginRateLimitService:59 beginPasswordRecovery(String key, String loginName, String mobile, String sourceAddress)` | ORACLE_NAMED | A13 |
| 089 | `WorkspaceLoginRateLimitService:70 recordInvalid(String key, Attempt attempt)` | ORACLE_NAMED | A13 |
| 090 | `WorkspaceLoginRateLimitService:75 recordPasswordRecoveryStart(String key, Attempt attempt)` | N/A_WITH_REASON | pure delegator/default/composition wrapper; behavior and persistence branch are covered by exact-index row 089 and its named oracle |
| 091 | `WorkspaceLoginRateLimitService:79 recordSourceFailure(String key, Attempt attempt)` | ORACLE_NAMED | A13 |
| 092 | `WorkspaceLoginRateLimitService:83 clearAccount(String key, Attempt attempt)` | ORACLE_NAMED | A13 |
| 093 | `WorkspaceOperationsCommandService:30 createInvitation(InvitationCreateCommand command)` | ORACLE_NAMED | A14 |
| 094 | `WorkspaceOperationsCommandService:51 cancelInvitation(InvitationActionCommand command)` | ORACLE_NAMED | A14 |
| 095 | `WorkspaceOperationsCommandService:69 reissueInvitation(InvitationActionCommand command)` | ORACLE_NAMED | A14 |
| 096 | `WorkspaceOperationsCommandService:87 revokeAssignment(AssignmentRevokeCommand command)` | ORACLE_NAMED | A14 |
| 097 | `WorkspaceOtpRateLimitService:24 beforeSend(UUID workspace, String key, String purpose, UUID subject)` | ORACLE_NAMED | A15 |
| 098 | `WorkspaceOtpRateLimitService:28 beforeVerify(UUID workspace, String key, String purpose, UUID subject)` | ORACLE_NAMED | A15 |
| 099 | `WorkspaceOtpRateLimitService:32 invalidVerify(UUID workspace, String key, String purpose, UUID subject)` | ORACLE_NAMED | A15 |
| 100 | `WorkspaceOtpRateLimitService:36 successfulVerify(UUID workspace, String key, String purpose, UUID subject)` | ORACLE_NAMED | A15 |
| 101 | `WorkspacePasswordRecoveryService:78 start(UUID workspaceUuid, String groupWorkspaceKey, String loginName, String mobile, String sourceAddress)` | ORACLE_NAMED | A16 |
| 102 | `WorkspacePasswordRecoveryService:108 sendOtp(UUID workspaceUuid, String groupWorkspaceKey, RecoveryFlowCredential recoveryFlow, String sourceAddress)` | ORACLE_NAMED | A16 |
| 103 | `WorkspacePasswordRecoveryService:137 verifyOtp(UUID workspaceUuid, String groupWorkspaceKey, RecoveryFlowCredential recoveryFlow, String rawOtp, String sourceAddress)` | ORACLE_NAMED | A16 |
| 104 | `WorkspacePasswordRecoveryService:184 complete(UUID workspaceUuid, String groupWorkspaceKey, RecoveryFlowCredential recoveryFlow, RecoveryGrantCredential recoveryGrant, char[] password)` | ORACLE_NAMED | A16 |
| 105 | `WorkspacePasswordResetService:48 requestPlatform(UUID workspaceUuid, String groupWorkspaceKey, UUID accountId, long expectedVersion, String idempotencyKey, AuditActor actor)` | ORACLE_NAMED | A17 |
| 106 | `WorkspaceRoleService:83 create(UUID workspaceUuid, String groupWorkspaceKey, String name, String serviceNodeType, String description, Set<String> pageAccessKeys, Set<String> actionCapabilityKeys)` | N/A_WITH_REASON | pure delegator/default/composition wrapper; behavior and persistence branch are covered by exact-index row 107 and its named oracle |
| 107 | `WorkspaceRoleService:103 create(UUID workspaceUuid, String groupWorkspaceKey, String name, String serviceNodeType, String description, Set<String> pageAccessKeys, Set<String> actionCapabilityKeys, AuditActor actor)` | ORACLE_NAMED | A18 |
| 108 | `WorkspaceRoleService:144 createForPlatform(UUID workspaceUuid, String groupWorkspaceKey, String name, String serviceNodeType, String description, Set<String> pageAccessKeys, Set<String> actionCapabilityKeys, String idempotencyKey, AuditActor actor)` | ORACLE_NAMED | A18 |
| 109 | `WorkspaceRoleService:182 update(UUID workspaceUuid, String groupWorkspaceKey, UUID roleId, long expectedVersion, String name, String description, Set<String> pageAccessKeys, Set<String> actionCapabilityKeys)` | N/A_WITH_REASON | pure delegator/default/composition wrapper; behavior and persistence branch are covered by exact-index row 110 and its named oracle |
| 110 | `WorkspaceRoleService:204 update(UUID workspaceUuid, String groupWorkspaceKey, UUID roleId, long expectedVersion, String name, String description, Set<String> pageAccessKeys, Set<String> actionCapabilityKeys, AuditActor actor)` | ORACLE_NAMED | A18 |
| 111 | `WorkspaceRoleService:241 updateForPlatform(UUID workspaceUuid, String groupWorkspaceKey, UUID roleId, long expectedVersion, String name, String description, Set<String> pageAccessKeys, Set<String> actionCapabilityKeys, String idempotencyKey, AuditActor actor)` | ORACLE_NAMED | A18 |
| 112 | `WorkspaceRoleService:280 replacePermissions(UUID workspaceUuid, String groupWorkspaceKey, UUID roleId, long expectedVersion, Set<String> pageAccessKeys, Set<String> actionCapabilityKeys)` | ORACLE_NAMED | A18 |
| 113 | `WorkspaceRoleService:300 transitionStatus(UUID workspaceUuid, String groupWorkspaceKey, UUID roleId, String status, long expectedVersion)` | N/A_WITH_REASON | pure delegator/default/composition wrapper; behavior and persistence branch are covered by exact-index row 114 and its named oracle |
| 114 | `WorkspaceRoleService:306 transitionStatus(UUID workspaceUuid, String groupWorkspaceKey, UUID roleId, String status, long expectedVersion, AuditActor actor)` | ORACLE_NAMED | A18 |
| 115 | `WorkspaceRoleService:337 transitionStatusForPlatform(UUID workspaceUuid, String groupWorkspaceKey, UUID roleId, String status, long expectedVersion, String idempotencyKey, AuditActor actor)` | ORACLE_NAMED | A18 |
| 116 | `WorkspaceRoleService:356 page(UUID workspaceUuid, String groupWorkspaceKey, String name, String organizationType, String status, int page, int pageSize, String sort, String direction)` | ORACLE_NAMED | A18 |
| 117 | `WorkspaceRoleService:372 platformTaskPage(UUID workspaceUuid, String groupWorkspaceKey, String name, String organizationType, String status, int page, int pageSize, String sort, String direction)` | ORACLE_NAMED | A18 |
| 118 | `WorkspaceRoleService:432 require(UUID workspaceUuid, String groupWorkspaceKey, UUID roleId)` | ORACLE_NAMED | A18 |
| 119 | `WorkspaceRoleService:438 platformTaskDetail(UUID workspaceUuid, String groupWorkspaceKey, UUID roleId)` | ORACLE_NAMED | A18 |
| 120 | `WorkspaceRoleService:451 requireAll(UUID workspaceUuid, String groupWorkspaceKey, List<UUID> roleIds)` | ORACLE_NAMED | exact production callers are `WorkspaceAuthenticationService:383` and `:583` through the `roles` receiver; `WorkspaceAuthenticationContextVersionTest:181-186` reaches session-entry composition and asserts the returned candidate assignment and typed role name (`Identity operator`) after owner readback |
| 121 | `WorkspaceTaskReadService:28 userPage(WorkspaceUserService.AccountPageQuery query)` | N/A_WITH_REASON | pure delegator/default/composition wrapper; behavior and persistence branch are covered by exact-index row 133 and its named oracle |
| 122 | `WorkspaceTaskReadService:32 userDetail(WorkspaceUserService.AccountDetailQuery query)` | N/A_WITH_REASON | pure delegator/default/composition wrapper; behavior and persistence branch are covered by exact-index row 134 and its named oracle |
| 123 | `WorkspaceTaskReadService:36 invitationCandidates(WorkspaceUserService.CandidateQuery query)` | N/A_WITH_REASON | pure delegator/default/composition wrapper; behavior and persistence branch are covered by exact-index row 132 and its named oracle |
| 124 | `WorkspaceTaskReadService:40 invitations(WorkspaceSessionReadback session, String expectedTargetType, UUID requestedScopeRef, WorkspaceInvitationService.ManagementInvitationPageRequest request)` | N/A_WITH_REASON | pure delegator/default/composition wrapper; behavior and persistence branch are covered by exact-index row 066 and its named oracle |
| 125 | `WorkspaceTaskReadService:50 sessionEntry(String rawToken, String groupWorkspaceKey)` | N/A_WITH_REASON | pure delegator/default/composition wrapper; behavior and persistence branch are covered by exact-index row 037 and its named oracle |
| 126 | `WorkspaceUserService:88 resolveCurrentTaskScope(WorkspaceSessionReadback session)` | ORACLE_NAMED | A20 |
| 127 | `WorkspaceUserService:103 resolveTaskScope(WorkspaceSessionReadback session, String expectedTargetType, UUID requestedScopeRef)` | ORACLE_NAMED | A20 |
| 128 | `WorkspaceUserService:143 resolveSelectedProjectScope(WorkspaceSessionReadback session, UUID requestedProjectRef)` | ORACLE_NAMED | A20 |
| 129 | `WorkspaceUserService:165 resolveSelectedProjectScopeForStore(WorkspaceSessionReadback session, UUID storeId)` | ORACLE_NAMED | A20 |
| 130 | `WorkspaceUserService:184 resolveCommandTarget(WorkspaceSessionReadback session, String expectedTargetType, UUID requestedTargetRef)` | ORACLE_NAMED | A20 |
| 131 | `WorkspaceUserService:205 resolveCommandTargetAllowingDisabledStore(WorkspaceSessionReadback session, String expectedTargetType, UUID requestedTargetRef)` | ORACLE_NAMED | A20 |
| 132 | `WorkspaceUserService:264 candidates(CandidateQuery query)` | ORACLE_NAMED | A20 |
| 133 | `WorkspaceUserService:349 page(AccountPageQuery query)` | ORACLE_NAMED | A20 |
| 134 | `WorkspaceUserService:388 detail(AccountDetailQuery query)` | ORACLE_NAMED | A20 |

## Close condition

All 134 rows have an explicit non-open closure above: named business/readback evidence, a source-backed delegation to a named row, or the documented no-caller N/A. The author-side status is `READY_FOR_INDEPENDENT_RECONCILIATION`; a fresh whole-delivery reviewer must independently verify the current source, exact index, named tests and this appendix. No row is silently upgraded by test-file existence, class token, HTTP status, or DB-operation count.
