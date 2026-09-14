# B15 CP-0 current-byte matrices

## Evidence boundary

- CP: B15 `workspace-iam` execution relocation.
- Checkpoint: 2026-09-14 02:35:51 KST, after all B15 application execution calls were connected to typed persistence. Earlier checkpoints are historical only.
- Read-only inventory method: `find` for candidate classes, case-sensitive `rg` for `@Transactional` and `jdbc.(query|queryForObject|queryForList|update|execute|batchUpdate)(`, and source opening for callers and behavior. Counts are source-site counts, not operation-budget denominators.
- The matrix is an implementation input, not a compliance ledger. It does not use hashes, receipts, package entry/exit, or retired control-plane gates.

## Matrix 1 — candidate and production boundary

Every suffix candidate in the current package is listed in the B15 source-to-sink ledger. `KEEP_*` is the business/application boundary; `PERSISTENCE` is the execution target, not a new business owner.

| candidate | class declaration | current classification | execution disposition at checkpoint |
| --- | --- | --- | --- |
| PlatformInvitationCandidatesTaskReadService | `application/PlatformInvitationCandidatesTaskReadService.java:16` | KEEP_TASK_READ | no direct sink; keep |
| PlatformWorkspaceAccountTaskReadService | `application/PlatformWorkspaceAccountTaskReadService.java:27` | KEEP_TASK_READ | `PlatformWorkspaceAccountTaskReadPersistence` present |
| PlatformWorkspaceInvitationTaskReadService | `application/PlatformWorkspaceInvitationTaskReadService.java:21` | KEEP_TASK_READ | `PlatformWorkspaceInvitationTaskReadPersistence` present |
| WorkspaceAccountService | `application/WorkspaceAccountService.java:23` | KEEP_SINGLE_AGGREGATE | `WorkspaceAccountPersistence` present |
| WorkspaceAssignmentScopeService | `application/WorkspaceAssignmentScopeService.java:11` | KEEP_TASK_READ | `WorkspaceAssignmentScopePersistence` present |
| WorkspaceAuditAuthorizationService | `application/WorkspaceAuditAuthorizationService.java:22` | KEEP_ADAPTER_SUPPORT | `WorkspaceAuditAuthorizationPersistence` present |
| WorkspaceAuthenticationService | `application/WorkspaceAuthenticationService.java:35` | KEEP_ADAPTER_SUPPORT | `WorkspaceAuthenticationPersistence` present |
| WorkspaceCapabilityScopeResolver | `application/WorkspaceCapabilityScopeResolver.java:22` | SUPPORT_RESOLVER (non-suffix boundary) | `WorkspaceCapabilityScopePersistence` present |
| WorkspaceCommandAuthorizationService | `application/WorkspaceCommandAuthorizationService.java:15` | KEEP_ADAPTER_SUPPORT | `WorkspaceCommandAuthorizationPersistence` present |
| WorkspaceIamAuditHistoryService | `application/WorkspaceIamAuditHistoryService.java:17` | KEEP_ADAPTER_SUPPORT | `WorkspaceIamAuditHistoryPersistence` present |
| WorkspaceIamCommandReceiptService | `application/WorkspaceIamCommandReceiptService.java:16` | KEEP_ADAPTER_SUPPORT | `WorkspaceIamCommandReceiptPersistence` present |
| WorkspaceIamSummaryReadService | `application/WorkspaceIamSummaryReadService.java:12` | KEEP_TASK_READ | `WorkspaceIamSummaryReadPersistence` present |
| WorkspaceInvitationService | `application/WorkspaceInvitationService.java:38` | KEEP_SINGLE_AGGREGATE | `WorkspaceInvitationPersistence` present |
| WorkspaceLoginRateLimitService | `application/WorkspaceLoginRateLimitService.java:16` | KEEP_ADAPTER_SUPPORT | `WorkspaceLoginRateLimitPersistence` present |
| WorkspaceOperationsCommandService | `application/WorkspaceOperationsCommandService.java:16` | KEEP_COORDINATOR | no direct sink; keep coordinator |
| WorkspaceOtpRateLimitService | `application/WorkspaceOtpRateLimitService.java:11` | KEEP_ADAPTER_SUPPORT | `WorkspaceOtpRateLimitPersistence` present |
| WorkspacePasswordRecoveryService | `application/WorkspacePasswordRecoveryService.java:20` | KEEP_ADAPTER_SUPPORT | `WorkspacePasswordRecoveryPersistence` present |
| WorkspacePasswordResetService | `application/WorkspacePasswordResetService.java:20` | KEEP_ADAPTER_SUPPORT | `WorkspacePasswordResetPersistence` present |
| WorkspaceRoleService | `application/WorkspaceRoleService.java:33` | KEEP_SINGLE_AGGREGATE | `WorkspaceRolePersistence` present |
| WorkspaceTaskReadService | `application/WorkspaceTaskReadService.java:14` | KEEP_TASK_READ | no direct sink; keep task-read |
| WorkspaceUserService | `application/WorkspaceUserService.java:28` | KEEP_TASK_READ | `WorkspaceUserPersistence` present |

The non-suffix resolver is deliberately included in the production boundary matrix because the current-byte sink scan finds one query in it; it is not silently excluded by a filename rule.

## Matrix 2 — public overload and caller index

The following index expands every public service operation overload. The source declaration path is the exact start line; the declaration may continue on the following lines. `callers` lists the current production/test consumer families found by source search, not only the declaring class. Static nested records/classes and inherited record accessors are not service overloads.

| class | public overloads (declaration start lines; full declaration in source) | callers / receiver boundary | target and disposition |
| --- | --- | --- | --- |
| PlatformInvitationCandidatesTaskReadService | `candidates(CandidateQuery)` (`:27`) | `PlatformInvitationCandidateController`, `WorkspaceTaskReadService`, platform candidate tests | keep task-read facade; typed persistence none |
| PlatformWorkspaceAccountTaskReadService | `page(AccountPageQuery)` (`:42`); `detail(AccountDetailQuery)` (`:63`); `transitionStatusAndReadback(UUID,String,UUID,String,long,String,AuditActor)` (`:85`) | `PlatformWorkspaceAccountController`; platform account sort/page tests; `WorkspaceTaskReadService` | keep task-read/API receiver; move direct reads to typed persistence |
| PlatformWorkspaceInvitationTaskReadService | `page(ManagementInvitationPageRequest)` (`:32`); `detail(UUID,String,UUID)` (`:53`) | `PlatformWorkspaceInvitationController`; `WorkspaceTaskReadService`; invitation controller tests | keep composite read; move direct reads to typed persistence |
| WorkspaceAccountService | `require(UUID,String,UUID)` (`:73`); `transitionStatus(UUID,String,UUID,String,long)` (`:90`); `transitionStatus(UUID,String,UUID,String,long,AuditActor)` (`:96`); `transitionStatusForPlatform(UUID,String,UUID,String,long,String,AuditActor)` (`:155`); `revokeAssignment(UUID,String,UUID,UUID,long)` (`:173`); `revokeAssignment(UUID,String,UUID,UUID,long,AuditActor)` (`:179`); `revokeAssignmentForPlatform(UUID,String,UUID,UUID,long,String,AuditActor)` (`:212`); `revokeAssignment(UUID,String,UUID,long)` (`:233`); `revokeAssignment(UUID,String,UUID,long,AuditActor)` (`:238`); `revokeAssignmentForOperations(UUID,String,UUID,String,UUID,long,String,AuditActor)` (`:257`) | platform account controller; operations command service; password reset/user services through typed exceptions; `ContractProblemAdvice`; account receipt/page tests | preserve public owner protocol and transaction methods; typed persistence owns account/assignment reads and writes |
| WorkspaceAssignmentScopeService | `requireActiveScope(UUID,String,UUID)` (`:20`) | `WorkspaceCapabilityScopeResolver`; organization lookup port; `ContractProblemAdvice`; invitation public-flow test | keep lookup port; `WorkspaceAssignmentScopePersistence.findActiveScope` owns query |
| WorkspaceAuditAuthorizationService | `requireGroupHost(WorkspaceSessionReadback)` (`:32`); `requireScopedHost(WorkspaceSessionReadback,String,UUID)` (`:39`); `requireWorkspaceSubject(WorkspaceSessionReadback,String,UUID)` (`:45`) | audit authorization tests and operations audit consumer | preserve authorization receiver; typed persistence owns assignment/subject reads |
| WorkspaceAuthenticationService | `login(String,String,char[])` (`:153`); `login(String,String,char[],String)` (`:167`); `loginWithSessionEntry(String,String,char[],String)` (`:181`); `sendLoginOtp(String,String)` (`:244`); `verifyLoginOtp(String,String,String)` (`:267`); `verifyLoginOtpWithSessionEntry(String,String,String)` (`:272`); `selectContext(String,String)` (`:300`); `selectContext(String,String,UUID)` (`:317`); `selectContext(String,String,UUID,UUID)` (`:328`); `selectDataNode(String,String,UUID)` (`:365`); `selectDataNode(String,String,UUID,UUID)` (`:376`); `session(String)` (`:443`); `readAuthorizationFacts(String)` (`:452`); `commandAuthorizationFacts(String)` (`:486`); `sessionForPasswordChange(String)` (`:569`); `sessionEntry(String)` (`:620`); `sessionEntry(String,String)` (`:626`); `logout(String)` (`:792`); `changeCurrentPassword(String,String,char[],char[])` (`:804`) | operations session resolver/controllers; invitation/recovery services; command execution context; authentication tests | preserve auth support/API and nested public result/error FQCN; typed persistence owns account/credential/session reads/writes |
| WorkspaceCapabilityScopeResolver | `resolve(UUID,String,String,String,UUID)` (`:43`); `resolveStatusTransition(UUID,String,String,String,UUID)` (`:53`); `resolveIncludingDisabledStoreTarget(UUID,String,String,String,UUID)` (`:62`); `resolveGeneratedOperation(UUID,String,String,String,UUID)` (`:73`); `resolveGeneratedCatalogOperation(UUID,String,String,String,UUID)` (`:93`); `resolveUsingResolvedTaskPath(UUID,String,String,String,UUID,TaskPath)` (`:165`); `resolveStatusTransitionUsingResolvedTaskPath(UUID,String,String,String,UUID,TaskPath)` (`:188`) | command execution context resolver; edge authorization paths; capability resolver tests | keep support resolver; typed persistence owns the remaining direct query; no aggregate split |
| WorkspaceCommandAuthorizationService | `requireUserManagementAction(UUID,String,UUID,String,UUID,UserManagementAction)` (`:33`); same overload with validated scope (`:56`); `requireUserManagementActionOnValidatedScope(WorkspaceSessionReadback,String,UUID,...)` (`:78`); `requireUserManagementCapabilityOnScope(...)` (`:96`) | account/role/invitation commands; operations authorization edges; authorization tests | preserve authorization semantics; typed persistence owns one direct read |
| WorkspaceIamAuditHistoryService | `read(AuditReadScope,AuditTarget,long,long)` (`:26`); `readWorkspaceRole(AuditReadScope,String,long,long)` (`:86`); `readWorkspaceAccount(AuditReadScope,String,long,long)` (`:98`); `readWorkspaceInvitation(AuditReadScope,String,long,long)` (`:110`); `readPlatformAuditProjection(AuditReadScope,String,long,long)` (`:124`); `readOperationsAuditProjection(AuditReadScope,String,long,long)` (`:191`) | platform/operations audit controllers and audit tests | preserve projection/typed page; typed persistence owns audit reads |
| WorkspaceIamCommandReceiptService | `execute(UUID,String,String,Class<T>,Supplier<T>)` (`:26`) | account/invitation/role commands, operations command coordinator, receipt tests | preserve receipt protocol; persistence owns lock/read/insert; Supplier remains application command callback, not SQL executor |
| WorkspaceIamSummaryReadService | `accountAndRoleSummary(UUID)` (`:21`); `accountCount(UUID)` (`:34`); `roleCount(UUID)` (`:43`) | workspace summary API and summary tests | preserve lookup port; typed persistence owns three reads |
| WorkspaceInvitationService | `create(...)` overloads (`:128`, `:199`, `:209`); `createForOperations(...)` (`:151`); `managementPage(...)` (`:297`); `managementPageForOperations(...)` (`:304`); `managementView(...)` (`:425`); `managementInvitation(...)` (`:454`); `cancel(...)` overloads (`:520`, `:525`, `:550`, `:570`); `reissue(...)` overloads (`:594`, `:600`, `:654`, `:670`); `acceptPublic(...)` (`:695`); `publicView(...)` (`:726`); `sendPublicOtp(...)` (`:758`); `verifyPublicOtp(...)` (`:777`); `savePublicCredentials(...)` (`:846`); `completePublic(...)` (`:888`); `publicCompletion(...)` (`:915`); `issueMobileVerificationOtp(...)` overloads (`:921`, `:966`, `:971`) | operations/platform invitation controllers; `WorkspaceOperationsCommandService`; task-read services; public invitation and receipt tests | preserve invitation aggregate/public flow; typed persistence owns invitation execution and readback queries |
| WorkspaceLoginRateLimitService | `begin(String,String,String)` (`:41`); `beginPasswordRecovery(String,String,String,String)` (`:53`); `recordInvalid(String,Attempt)` (`:64`); `recordPasswordRecoveryStart(String,Attempt)` (`:69`); `recordSourceFailure(String,Attempt)` (`:73`); `clearAccount(String,Attempt)` (`:77`) | authentication and recovery services; authentication context tests | preserve HMAC/rate-limit semantics; typed persistence owns lock/read/upsert/delete |
| WorkspaceOperationsCommandService | `createInvitation(InvitationCreateCommand)` (`:30`); `cancelInvitation(InvitationActionCommand)` (`:51`); `reissueInvitation(InvitationActionCommand)` (`:69`); `revokeAssignment(AssignmentRevokeCommand)` (`:87`) | `WorkspaceOperationsCommandApi` edge/controller; command tests | keep coordinator; no persistence target |
| WorkspaceOtpRateLimitService | `beforeSend(UUID,String,String,UUID)` (`:21`); `beforeVerify(UUID,String,String,UUID)` (`:25`); `invalidVerify(UUID,String,String,UUID)` (`:29`); `successfulVerify(UUID,String,String,UUID)` (`:33`) | authentication, invitation and recovery public flows; recovery/auth tests | preserve subject guard; typed persistence owns lock/read/upsert/delete |
| WorkspacePasswordRecoveryService | `start(...)` (`:61`); `sendOtp(...)` (`:98`); `verifyOtp(...)` (`:133`); `complete(...)` (`:194`) | operations password recovery edge; password recovery tests | preserve support flow; typed persistence owns recovery facts |
| WorkspacePasswordResetService | `requestPlatform(...)` (`:39`) | platform account controller; reset tests | preserve platform support flow; typed persistence owns reset query/update |
| WorkspaceRoleService | `create(...)` overloads (`:83`, `:103`, `:148`); `update(...)` overloads (`:186`, `:208`, `:249`); `replacePermissions(...)` (`:288`); `transitionStatus(...)` overloads (`:308`, `:314`, `:348`); `page(...)` (`:367`); `platformTaskPage(...)` (`:383`); `require(...)` (`:474`); `platformTaskDetail(...)` (`:480`); `requireAll(...)` (`:504`) | role controllers/services; role page/service and authentication tests | preserve role aggregate/CAS/permission catalog/readback; typed persistence owns role execution |
| WorkspaceTaskReadService | `userPage(AccountPageQuery)` (`:28`); `userDetail(AccountDetailQuery)` (`:32`); `invitationCandidates(CandidateQuery)` (`:36`); `invitations(ManagementInvitationPageRequest)` (`:40`); `sessionEntry(String,String)` (`:50`) | operations/platform task-read controllers | keep composition task-read; no direct sink |
| WorkspaceUserService | `resolveCurrentTaskScope(WorkspaceSessionReadback)` (`:75`); `resolveTaskScope(...)` (`:90`); `resolveSelectedProjectScope(...)` (`:130`); `resolveSelectedProjectScopeForStore(...)` (`:152`); `resolveCommandTarget(...)` (`:171`); `resolveCommandTargetAllowingDisabledStore(...)` (`:192`); `candidates(CandidateQuery)` (`:251`); `page(AccountPageQuery)` (`:336`); `detail(AccountDetailQuery)` (`:371`) | operations/platform account/user controllers; business-channel/contract/organization edges; platform task-read; user tests | preserve task/scope/candidate read semantics; typed persistence owns account/task query execution |

Where a line has `...` or a grouped overload description, it is navigation only and cannot close CP-0. Before CP-0 is marked `MATCHED`, the source-backed row must be expanded with the complete Java parameter types and the exact caller `path:line`, receiver/interface type, and target class. This explicit rule prevents the matrix from pretending that a grouped index is a full closure.

### Exact service-operation overload index

The navigation table above is retained for scanning. This index is the CP-0 signature expansion; each declaration is anchored at its source path and declaration-start line. Constructors, record accessors, exception constructors, and nested record factory methods are not service operation overloads; they are tracked in the constructor/FQCN caller notes and are not silently treated as business methods.

```text
PlatformInvitationCandidatesTaskReadService.java
  :27 WorkspaceUserService.CandidatePage candidates(WorkspaceUserService.CandidateQuery query)

PlatformWorkspaceAccountTaskReadService.java
  :48 WorkspaceUserService.AccountPage page(WorkspaceUserService.AccountPageQuery query)
  :69 WorkspaceUserService.User detail(WorkspaceUserService.AccountDetailQuery query)
  :78 WorkspaceUserService.User transitionStatusAndReadback(UUID workspaceUuid, String key, UUID accountId, String status, long expectedVersion, String idempotencyKey, AuditActor actor)

PlatformWorkspaceInvitationTaskReadService.java
  :35 WorkspaceInvitationService.ManagementInvitationPage page(UUID workspaceUuid, String key, WorkspaceInvitationService.ManagementInvitationPageRequest request)
  :47 WorkspaceInvitationService.ManagementInvitationView detail(UUID workspaceUuid, String key, UUID invitationId)

WorkspaceAccountService.java
  :75 WorkspaceAccountReadback require(UUID workspaceUuid, String key, UUID accountId)
  :80 WorkspaceAccountReadback transitionStatus(UUID workspaceUuid, String key, UUID accountId, String status, long expectedVersion)
  :86 WorkspaceAccountReadback transitionStatus(UUID workspaceUuid, String key, UUID accountId, String status, long expectedVersion, AuditActor actor)
  :114 WorkspaceAccountReadback transitionStatusForPlatform(UUID workspaceUuid, String key, UUID accountId, String status, long expectedVersion, String idempotencyKey, AuditActor actor)
  :132 void revokeAssignment(UUID workspaceUuid, String key, UUID accountId, UUID assignmentId, long expectedVersion)
  :138 void revokeAssignment(UUID workspaceUuid, String key, UUID accountId, UUID assignmentId, long expectedVersion, AuditActor actor)
  :154 AssignmentRevocation revokeAssignmentForPlatform(UUID workspaceUuid, String key, UUID accountId, UUID assignmentId, long expectedVersion, String idempotencyKey, AuditActor actor)
  :175 UUID revokeAssignment(UUID workspaceUuid, String key, UUID assignmentId, long expectedVersion)
  :180 UUID revokeAssignment(UUID workspaceUuid, String key, UUID assignmentId, long expectedVersion, AuditActor actor)
  :188 UUID revokeAssignmentForOperations(UUID workspaceUuid, String key, UUID actorAssignmentId, String expectedTargetType, UUID assignmentId, long expectedVersion, String idempotencyKey, AuditActor actor)

WorkspaceAssignmentScopeService.java
  :23 AssignmentScope requireActiveScope(UUID workspaceUuid, String groupWorkspaceKey, UUID assignmentId)

WorkspaceAuditAuthorizationService.java
  :37 void requireGroupHost(WorkspaceSessionReadback session)
  :44 void requireScopedHost(WorkspaceSessionReadback session, String targetType, UUID targetId)
  :50 void requireWorkspaceSubject(WorkspaceSessionReadback session, String entityType, UUID subjectId)

WorkspaceAuthenticationService.java
  :153 LoginResult login(String groupWorkspaceKey, String loginName, char[] password)
  :167 LoginResult login(String groupWorkspaceKey, String loginName, char[] password, String sourceAddress)
  :181 LoginEntryResult loginWithSessionEntry(String groupWorkspaceKey, String loginName, char[] password, String sourceAddress)
  :215 OtpDelivery sendLoginOtp(String groupWorkspaceKey, String mobile)
  :232 LoginResult verifyLoginOtp(String groupWorkspaceKey, String mobile, String otp)
  :237 LoginEntryResult verifyLoginOtpWithSessionEntry(String groupWorkspaceKey, String mobile, String otp)
  :256 WorkspaceSessionReadback selectContext(String rawToken, UUID assignmentId, UUID scopeNodeId, long expectedContextVersion)
  :273 WorkspaceSessionEntryReadback selectContext(String rawToken, UUID assignmentId, long expectedContextVersion)
  :284 WorkspaceSessionEntryReadback selectContext(String rawToken, String expectedGroupWorkspaceKey, UUID assignmentId, long expectedContextVersion)
  :317 WorkspaceSessionEntryReadback selectDataNode(String rawToken, String dataNodeType, UUID scopeNodeId, long expectedContextVersion)
  :328 WorkspaceSessionEntryReadback selectDataNode(String rawToken, String expectedGroupWorkspaceKey, String dataNodeType, UUID scopeNodeId, long expectedContextVersion)
  :392 WorkspaceSessionReadback session(String rawToken)
  :401 WorkspaceReadAuthorizationFacts readAuthorizationFacts(String rawToken)
  :435 WorkspaceCommandAuthorizationFacts commandAuthorizationFacts(String rawToken)
  :480 WorkspaceSessionReadback sessionForPasswordChange(String rawToken)
  :528 WorkspaceSessionEntryReadback sessionEntry(String rawToken)
  :534 WorkspaceSessionEntryReadback sessionEntry(String rawToken, String groupWorkspaceKey)
  :700 void logout(String rawToken)
  :707 PasswordChangeResult changeCurrentPassword(String rawToken, char[] currentPassword, char[] newPassword, long expectedSessionVersion)

WorkspaceCapabilityScopeResolver.java
  :50 ScopeResolution resolve(WorkspaceSessionReadback session, String requirementId, ServerResolvedResource target)
  :60 ScopeResolution resolveStatusTransition(WorkspaceSessionReadback session, String requirementId, ServerResolvedResource target)
  :69 ScopeResolution resolveIncludingDisabledStoreTarget(WorkspaceSessionReadback session, String requirementId, ServerResolvedResource target)
  :80 ScopeResolution resolveGeneratedOperation(WorkspaceSessionReadback session, String requirementId, String capabilityKey, ServerResolvedResource target)
  :100 CatalogScopeResolution resolveGeneratedCatalogOperation(WorkspaceSessionReadback session, String requirementId, String capabilityKey, ServerResolvedResource target, CatalogScopeLookup.CatalogBrandSelection selection)
  :172 ScopeResolution resolveUsingResolvedTaskPath(WorkspaceSessionReadback session, String requirementId, ServerResolvedResource target, OrganizationTaskPathLookup.TaskPath resolvedTaskPath)
  :195 ScopeResolution resolveStatusTransitionUsingResolvedTaskPath(WorkspaceSessionReadback session, String requirementId, ServerResolvedResource target, OrganizationTaskPathLookup.TaskPath resolvedTaskPath)

WorkspaceCommandAuthorizationService.java
  :40 void requireUserManagementAction(UUID workspaceUuid, String groupWorkspaceKey, UUID actorAssignmentId, String targetOrganizationType, UUID targetOrganizationId, UserManagementAction action)
  :63 void requireUserManagementAction(UUID workspaceUuid, String groupWorkspaceKey, UUID actorAssignmentId, String targetOrganizationType, OrganizationTaskPathLookup.TaskPath validatedTarget, UserManagementAction action)
  :85 void requireUserManagementActionOnValidatedScope(UUID workspaceUuid, String groupWorkspaceKey, UUID actorAssignmentId, String capabilityTargetType, OrganizationTaskPathLookup.TaskPath validatedScope, UserManagementAction action)
  :103 void requireUserManagementCapabilityOnScope(UUID workspaceUuid, String groupWorkspaceKey, UUID actorAssignmentId, String capabilityTargetType, UserManagementAction action, String scopeTargetType, UUID scopeTargetId)

WorkspaceIamAuditHistoryService.java
  :28 AuditHistoryPage read(AuditReadScope scope, AuditTarget target, long page, long pageSize)
  :55 AuditHistoryPage readWorkspaceRole(AuditReadScope scope, String roleId, long page, long pageSize)
  :67 AuditHistoryPage readWorkspaceAccount(AuditReadScope scope, String accountId, long page, long pageSize)
  :79 AuditHistoryPage readWorkspaceInvitation(AuditReadScope scope, String invitationId, long page, long pageSize)
  :93 AuditHistoryPage readPlatformAuditProjection(AuditReadScope scope, AuditTarget target, long page, long pageSize)
  :147 AuditHistoryPage readOperationsAuditProjection(WorkspaceReadAuthorizationFacts facts, AuditTarget target, long page, long pageSize)

WorkspaceIamCommandReceiptService.java
  :28 <T> T execute(UUID workspaceUuid, String key, String canonicalRequest, Class<T> resultType, Supplier<T> command)

WorkspaceIamSummaryReadService.java
  :24 AccountAndRoleSummary accountAndRoleSummary(UUID workspaceUuid)
  :30 long accountCount(UUID workspaceUuid)
  :36 long roleCount(UUID workspaceUuid)

WorkspaceInvitationService.java
  :162 WorkspaceInvitationReadback create(UUID workspaceUuid, String groupWorkspaceKey, String mobile, List<AssignmentIntent> intents, String idempotencyKey, AuditActor actor)
  :185 ManagementInvitationView createForOperations(UUID workspaceUuid, String groupWorkspaceKey, UUID actorAssignmentId, OrganizationTaskPathLookup.TaskPath validatedTarget, String mobile, List<AssignmentIntent> intents, String idempotencyKey, AuditActor actor)
  :233 WorkspaceInvitationReadback create(UUID workspaceUuid, String groupWorkspaceKey, String mobile, List<AssignmentIntent> intents, long expiresAtEpochMillis)
  :243 WorkspaceInvitationReadback create(UUID workspaceUuid, String groupWorkspaceKey, String mobile, List<AssignmentIntent> intents, long expiresAtEpochMillis, AuditActor actor)
  :325 ManagementInvitationPage managementPage(UUID workspaceUuid, String groupWorkspaceKey, ManagementInvitationPageRequest request)
  :332 ManagementInvitationPage managementPageForOperations(WorkspaceSessionReadback session, String expectedTargetType, UUID requestedScopeRef, ManagementInvitationPageRequest request)
  :403 ManagementInvitationView managementView(WorkspaceInvitationReadback invitation)
  :432 ManagementInvitationView managementInvitation(UUID workspaceUuid, String groupWorkspaceKey, UUID invitationId)
  :498 void cancel(UUID workspaceUuid, String groupWorkspaceKey, UUID invitationId, long expectedVersion)
  :503 void cancel(UUID workspaceUuid, String groupWorkspaceKey, UUID invitationId, long expectedVersion, AuditActor actor)
  :524 WorkspaceInvitationReadback cancel(UUID workspaceUuid, String groupWorkspaceKey, UUID invitationId, long expectedVersion, String idempotencyKey, AuditActor actor)
  :544 WorkspaceInvitationReadback cancelForOperations(UUID workspaceUuid, String groupWorkspaceKey, UUID actorAssignmentId, String expectedTargetType, OrganizationTaskPathLookup.TaskPath selectedScope, UUID invitationId, long expectedVersion, String idempotencyKey, AuditActor actor)
  :568 WorkspaceInvitationReadback reissue(UUID workspaceUuid, String groupWorkspaceKey, UUID invitationId, long expectedVersion)
  :574 WorkspaceInvitationReadback reissue(UUID workspaceUuid, String groupWorkspaceKey, UUID invitationId, long expectedVersion, AuditActor actor)
  :600 WorkspaceInvitationReadback reissue(UUID workspaceUuid, String groupWorkspaceKey, UUID invitationId, long expectedVersion, String idempotencyKey, AuditActor actor)
  :616 WorkspaceInvitationReadback reissueForOperations(UUID workspaceUuid, String groupWorkspaceKey, UUID actorAssignmentId, String expectedTargetType, OrganizationTaskPathLookup.TaskPath selectedScope, UUID invitationId, long expectedVersion, String idempotencyKey, AuditActor actor)
  :641 PublicAcceptIntent acceptPublic(String groupWorkspaceKey, String rawInvitationToken)
  :665 PublicInvitationView publicView(String groupWorkspaceKey, String rawInvitationToken)
  :688 PublicOtpDelivery sendPublicOtp(String groupWorkspaceKey, String rawInvitationToken, String mobile)
  :707 PublicReadiness verifyPublicOtp(String groupWorkspaceKey, String rawInvitationToken, String mobile, String rawOtp)
  :754 PublicReadiness savePublicCredentials(String groupWorkspaceKey, String rawInvitationToken, String grant, String userName, String loginName, char[] password)
  :789 PublicCompletion completePublic(String groupWorkspaceKey, String rawInvitationToken)
  :811 PublicCompletion publicCompletion(String groupWorkspaceKey, String rawInvitationToken)
  :817 String issueMobileVerificationOtp(UUID invitationId, long expiresAtEpochMillis)
  :841 String issueMobileVerificationOtp(String rawInvitationToken, long expiresAtEpochMillis)
  :846 String issueMobileVerificationOtp(String groupWorkspaceKey, String rawInvitationToken, long expiresAtEpochMillis)

WorkspaceLoginRateLimitService.java
  :47 Attempt begin(String key, String loginName, String sourceAddress)
  :59 Attempt beginPasswordRecovery(String key, String loginName, String mobile, String sourceAddress)
  :70 void recordInvalid(String key, Attempt attempt)
  :75 void recordPasswordRecoveryStart(String key, Attempt attempt)
  :79 void recordSourceFailure(String key, Attempt attempt)
  :83 void clearAccount(String key, Attempt attempt)

WorkspaceOperationsCommandService.java
  :30 WorkspaceInvitationService.ManagementInvitationView createInvitation(InvitationCreateCommand command)
  :51 WorkspaceInvitationService.ManagementInvitationView cancelInvitation(InvitationActionCommand command)
  :69 WorkspaceInvitationService.ManagementInvitationView reissueInvitation(InvitationActionCommand command)
  :87 OperationsAssignmentRevokeReadback revokeAssignment(AssignmentRevokeCommand command)

WorkspaceOtpRateLimitService.java
  :24 void beforeSend(UUID workspace, String key, String purpose, UUID subject)
  :28 void beforeVerify(UUID workspace, String key, String purpose, UUID subject)
  :32 void invalidVerify(UUID workspace, String key, String purpose, UUID subject)
  :36 void successfulVerify(UUID workspace, String key, String purpose, UUID subject)

WorkspacePasswordRecoveryService.java
  :78 StartResult start(UUID workspaceUuid, String groupWorkspaceKey, String loginName, String mobile, String sourceAddress)
  :108 OtpDelivery sendOtp(UUID workspaceUuid, String groupWorkspaceKey, RecoveryFlowCredential recoveryFlow, String sourceAddress)
  :137 VerificationResult verifyOtp(UUID workspaceUuid, String groupWorkspaceKey, RecoveryFlowCredential recoveryFlow, String rawOtp, String sourceAddress)
  :184 Completion complete(UUID workspaceUuid, String groupWorkspaceKey, RecoveryFlowCredential recoveryFlow, RecoveryGrantCredential recoveryGrant, char[] password)

WorkspacePasswordResetService.java
  :48 PlatformRequestResult requestPlatform(UUID workspaceUuid, String groupWorkspaceKey, UUID accountId, long expectedVersion, String idempotencyKey, AuditActor actor)

WorkspaceRoleService.java
  :83 WorkspaceRoleReadback create(UUID workspaceUuid, String groupWorkspaceKey, String name, String serviceNodeType, String description, Set<String> pageAccessKeys, Set<String> actionCapabilityKeys)
  :103 WorkspaceRoleReadback create(UUID workspaceUuid, String groupWorkspaceKey, String name, String serviceNodeType, String description, Set<String> pageAccessKeys, Set<String> actionCapabilityKeys, AuditActor actor)
  :144 WorkspaceRoleReadback createForPlatform(UUID workspaceUuid, String groupWorkspaceKey, String name, String serviceNodeType, String description, Set<String> pageAccessKeys, Set<String> actionCapabilityKeys, String idempotencyKey, AuditActor actor)
  :182 WorkspaceRoleReadback update(UUID workspaceUuid, String groupWorkspaceKey, UUID roleId, long expectedVersion, String name, String description, Set<String> pageAccessKeys, Set<String> actionCapabilityKeys)
  :204 WorkspaceRoleReadback update(UUID workspaceUuid, String groupWorkspaceKey, UUID roleId, long expectedVersion, String name, String description, Set<String> pageAccessKeys, Set<String> actionCapabilityKeys, AuditActor actor)
  :241 WorkspaceRoleReadback updateForPlatform(UUID workspaceUuid, String groupWorkspaceKey, UUID roleId, long expectedVersion, String name, String description, Set<String> pageAccessKeys, Set<String> actionCapabilityKeys, String idempotencyKey, AuditActor actor)
  :280 WorkspaceRoleReadback replacePermissions(UUID workspaceUuid, String groupWorkspaceKey, UUID roleId, long expectedVersion, Set<String> pageAccessKeys, Set<String> actionCapabilityKeys)
  :300 WorkspaceRoleReadback transitionStatus(UUID workspaceUuid, String groupWorkspaceKey, UUID roleId, String status, long expectedVersion)
  :306 WorkspaceRoleReadback transitionStatus(UUID workspaceUuid, String groupWorkspaceKey, UUID roleId, String status, long expectedVersion, AuditActor actor)
  :337 WorkspaceRoleReadback transitionStatusForPlatform(UUID workspaceUuid, String groupWorkspaceKey, UUID roleId, String status, long expectedVersion, String idempotencyKey, AuditActor actor)
  :356 Page page(UUID workspaceUuid, String groupWorkspaceKey, String name, String organizationType, String status, int page, int pageSize, String sort, String direction)
  :372 Page platformTaskPage(UUID workspaceUuid, String groupWorkspaceKey, String name, String organizationType, String status, int page, int pageSize, String sort, String direction)
  :432 WorkspaceRoleReadback require(UUID workspaceUuid, String groupWorkspaceKey, UUID roleId)
  :438 WorkspaceRoleReadback platformTaskDetail(UUID workspaceUuid, String groupWorkspaceKey, UUID roleId)
  :451 Map<UUID, WorkspaceRoleReadback> requireAll(UUID workspaceUuid, String groupWorkspaceKey, List<UUID> roleIds)

WorkspaceTaskReadService.java
  :28 WorkspaceUserService.AccountPage userPage(WorkspaceUserService.AccountPageQuery query)
  :32 WorkspaceUserService.User userDetail(WorkspaceUserService.AccountDetailQuery query)
  :36 WorkspaceUserService.CandidatePage invitationCandidates(WorkspaceUserService.CandidateQuery query)
  :40 WorkspaceInvitationService.ManagementInvitationPage invitations(WorkspaceSessionReadback session, String expectedTargetType, UUID requestedScopeRef, WorkspaceInvitationService.ManagementInvitationPageRequest request)
  :50 WorkspaceSessionEntryReadback sessionEntry(String rawToken, String groupWorkspaceKey)

WorkspaceUserService.java
  :88 OrganizationTaskPathLookup.TaskPath resolveCurrentTaskScope(WorkspaceSessionReadback session)
  :103 OrganizationTaskPathLookup.TaskPath resolveTaskScope(WorkspaceSessionReadback session, String expectedTargetType, UUID requestedScopeRef)
  :143 OrganizationTaskPathLookup.TaskPath resolveSelectedProjectScope(WorkspaceSessionReadback session, UUID requestedProjectRef)
  :165 OrganizationTaskPathLookup.StoreProjectCommandFacts resolveSelectedProjectScopeForStore(WorkspaceSessionReadback session, UUID storeId)
  :184 OrganizationTaskPathLookup.TaskPath resolveCommandTarget(WorkspaceSessionReadback session, String expectedTargetType, UUID requestedTargetRef)
  :205 OrganizationTaskPathLookup.TaskPath resolveCommandTargetAllowingDisabledStore(WorkspaceSessionReadback session, String expectedTargetType, UUID requestedTargetRef)
  :264 CandidatePage candidates(CandidateQuery query)
  :349 AccountPage page(AccountPageQuery query)
  :388 User detail(AccountDetailQuery query)
```

The index is a current-byte snapshot at the checkpoint above. Its declaration lines, signatures, caller paths and target classes must be regenerated from source before CP-0 can close after any later edit; no line-number stability is assumed.

### Current-byte caller/receiver reconciliation

The exact-signature index above is the declaration-side ledger. For each row, the receiver is the declaring application class shown in the file header, and the interface boundary is the class declaration's implemented API (or `NONE` for the task-read/support class with no public owner API). The caller-side scan was rerun against current Java bytes with receiver-qualified references first, then method name plus compatible argument arity for lambda/method-reference and Mockito call sites. A caller is recorded as `path:line`; a declaration, nested record accessor, or unrelated same-name symbol is excluded. The resulting per-class call-site groups are below; an overload with no consumer beyond its declaration is explicitly `NONE_FOUND`, not silently treated as used.

| receiver class | interface/consumer boundary | overload caller evidence | execution target | disposition |
| --- | --- | --- | --- | --- |
| `PlatformInvitationCandidatesTaskReadService` | application task-read consumer; no owner command API | `apps/backend/catering-business-server/modules/workspace-iam/src/test/java/com/catering/v2s/workspace/iam/application/PlatformInvitationCandidatesTaskReadServiceTest.java:24`; external direct callers `NONE_FOUND` | none | keep task-read |
| `PlatformWorkspaceAccountTaskReadService` | task-read edge consumer | `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/workspaceiam/PlatformWorkspaceAccountController.java:75,105,123`; tests `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/edge/platform/workspaceiam/PlatformWorkspaceAccountControllerSortTest.java:39,77,139` | `PlatformWorkspaceAccountTaskReadPersistence` | keep task-read / persistence execution |
| `PlatformWorkspaceInvitationTaskReadService` | task-read edge consumer | `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/workspaceiam/PlatformWorkspaceInvitationController.java:80,127` | `PlatformWorkspaceInvitationTaskReadPersistence` | keep task-read / persistence execution |
| `WorkspaceAccountService` | `WorkspaceAccountApi`; platform/operations command consumers | `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/workspaceiam/PlatformWorkspaceAccountController.java:123,173`; `apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceOperationsCommandService.java:87` | `WorkspaceAccountPersistence` | keep aggregate facade / persistence execution |
| `WorkspaceAssignmentScopeService` | assignment-scope lookup port | `WorkspaceCapabilityScopeResolver.java:34,40`; `WorkspaceCapabilityScopeResolverTest.java:41,68` | `WorkspaceAssignmentScopePersistence` | keep lookup facade / persistence execution |
| `WorkspaceAuditAuthorizationService` | audit authorization support | `WorkspaceIamAuditHistoryService.java:39,49,59`; `WorkspaceReadAuthorizationFactsTest.java:32,61` | `WorkspaceAuditAuthorizationPersistence` | keep support / persistence execution |
| `WorkspaceAuthenticationService` | authentication/session support | `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/session/OperationsCatalogAuthenticationController.java:60,77,88,109,128,146,159`; `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/session/OperationsSessionResolver.java:34,54,73,135`; `apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/CommandExecutionContextResolver.java:84,185`; `apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceTaskReadService.java:51` | `WorkspaceAuthenticationPersistence` | keep auth facade / persistence execution |
| `WorkspaceCapabilityScopeResolver` | generated operation authorization resolver | `CommandExecutionContextResolver.java:72,94`; `WorkspaceCapabilityScopeResolverTest.java:52,81` | `WorkspaceCapabilityScopePersistence` | keep resolver / persistence execution |
| `WorkspaceCommandAuthorizationService` | command authorization support | `WorkspaceAccountService.java:154`; `WorkspaceInvitationService.java:190,549,621`; operations/role command consumers | `WorkspaceCommandAuthorizationPersistence` | keep support / persistence execution |
| `WorkspaceIamAuditHistoryService` | audit projection task-read | `apps/backend/catering-business-server/modules/audit-read/src/main/java/com/catering/v2s/audit/read/PlatformAuditHistoryTaskReadService.java:56`; `apps/backend/catering-business-server/modules/audit-read/src/main/java/com/catering/v2s/audit/read/OperationsAuditTaskReadService.java:38` | `WorkspaceIamAuditHistoryPersistence` | keep projection / persistence execution |
| `WorkspaceIamCommandReceiptService` | receipt/replay support | `WorkspaceAccountService.java:156,220`; `WorkspaceInvitationService.java:171,536,612`; `WorkspaceRoleService.java:146,243,339`; receipt tests | `WorkspaceIamCommandReceiptPersistence` | keep receipt protocol / persistence execution |
| `WorkspaceIamSummaryReadService` | summary task-read | workspace summary controller and `WorkspaceIamSummaryReadServiceTest.java:24,31,38` | `WorkspaceIamSummaryReadPersistence` | keep task-read / persistence execution |
| `WorkspaceInvitationService` | invitation owner/public flow API | platform/operations invitation controllers; `WorkspaceOperationsCommandService.java:30,51,69`; `WorkspaceInvitationPublicFlowTest.java:123` and current public-flow call sites | `WorkspaceInvitationPersistence` | keep invitation owner / persistence execution |
| `WorkspaceLoginRateLimitService` | account/recovery rate-limit support | `WorkspaceAuthenticationService.java:203,219,246`; `WorkspacePasswordRecoveryService.java:91,121`; auth/recovery tests | `WorkspaceLoginRateLimitPersistence` | keep support / persistence execution |
| `WorkspaceOperationsCommandService` | `WorkspaceOperationsCommandApi` | edge/controller command callers; `WorkspaceOperationsCommandService` has no SQL sink | none | keep coordinator |
| `WorkspaceOtpRateLimitService` | OTP rate-limit support | `WorkspaceAuthenticationService.java:222,244,268`; `WorkspaceInvitationService.java:696,715`; `WorkspacePasswordRecoveryService.java:122,161` | `WorkspaceOtpRateLimitPersistence` | keep support / persistence execution |
| `WorkspacePasswordRecoveryService` | recovery support API | recovery edge/controller and `WorkspacePasswordRecoveryServiceTest.java:48,83,119,161` | `WorkspacePasswordRecoveryPersistence` | keep support / persistence execution |
| `WorkspacePasswordResetService` | platform credential reset support | `PlatformWorkspaceAccountController.java:161`; `WorkspacePasswordRecoveryService.java:221`; reset tests | `WorkspacePasswordResetPersistence` | keep support / persistence execution |
| `WorkspaceRoleService` | `WorkspaceRoleApi`; role command/read edges | role controllers; `WorkspaceRoleServiceTest.java:44,79,127,168`; receipt consumers | `WorkspaceRolePersistence` | keep role owner / persistence execution |
| `WorkspaceTaskReadService` | task-read composition | task-read controller consumers; no SQL sink | none | keep composition |
| `WorkspaceUserService` | user/scope task-read and authorization consumers | operations/platform edge controllers; `WorkspaceOperationsCommandService.java:33`; `WorkspaceUserTaskScopeTest.java:252,387`; `WorkspaceUserCandidatePageTest.java:43` | `WorkspaceUserPersistence` | keep task-read / persistence execution |

The compact rows above are class-level navigation only for the receiver boundary. CP-0 caller closure is the combination of the exact-signature index and a per-overload source-backed call-site row; no class-level row is used to claim that an overload is covered. For overloaded names, declaration arity and the caller's compiled argument types are the disambiguator. A caller row records the exact `path:line`, receiver expression and resolved interface/class type; same-name matches in a different receiver, declaration, record accessor or mapper are excluded. If no exact call can be proven, that overload is explicitly `NONE_FOUND` and its owner proof remains in the batch plan.

### Per-overload caller, receiver and oracle closure

The exact-signature block above is the authoritative 134-row operation index for this checkpoint. The previous reviewer correctly rejected the earlier class-group summary as sufficient caller evidence. The current author repair therefore treats the declaration row and the caller row as one atomic record: each of the 134 rows has a caller scan keyed by `(declaringClass, declarationLine, methodName, parameterArity)`, with the receiver expression and resolved interface/class boundary retained in the scan output. The scan includes production and test Java under the workspace-iam module and business-server edge sources, and separately marks `NONE_FOUND`; it does not infer a caller from a method-name token.

The caller scan is static navigation evidence only. It does not close a behavior oracle. The row-level closure appendix `doc/evidence/platform/2026-09-14-b15-overload-oracle-closure-codex.md` now records every exact row explicitly as `ORACLE_NAMED`, `N/A_WITH_REASON`, or `NONE_FOUND_WITH_NA`. `ORACLE_NAMED` is used only when a named test method and business assertion/readback were opened for that exact overload; pure delegators/composition wrappers and the one exact overload with no provable caller are not silently promoted. Existing test-file presence, a class token, an HTTP status assertion, or a DB-operation count never upgrades a row. The appendix is author-side closure evidence and remains subject to fresh independent verification; it is not a substitute for the owning-batch focused behavior proof.

The missing `PlatformInvitationCandidatesTaskReadService.candidates(WorkspaceUserService.CandidateQuery)` row is included at declaration line `27` in the exact index and is independently recorded as `caller=NONE_FOUND` outside its own test fixture. This is intentional: no external production caller was found for that direct task-read facade, and the existence of the test fixture is not promoted to a business oracle. The row remains in the owner-batch plan rather than being silently omitted.

## Matrix 3 — transaction and persistence boundary

At the 2026-09-14 02:35:51 KST checkpoint, the strict current-byte direct sink inventory is:

| scope | files | source-site calls | meaning |
| --- | ---: | ---: | --- |
| candidate service/resolver classes still executing directly | 0 | 0 | application execution boundary is closed |
| 18 typed persistence classes | 18 | 125 | current B15 execution sinks |
| application package total | 18 | 125 | persistence-only source-site count |

All 18 sink-owning service/resolver boundaries have no JDBC receiver-qualified call in their application body; their persistence targets are the 18 typed classes named in Matrix 1 and the ledger. `WorkspaceOperationsCommandService` has no JDBC sink and remains a coordinator. The class-level counts in the ledger are not a substitute for the exact method-family and caller evidence below.

No current public application-to-persistence boundary accepts SQL text, a SQL fragment, a SQL wrapper, `RowMapper`, or generic variadic executor parameters in the 18 moved slices. The current `Supplier<T>` in `WorkspaceIamCommandReceiptService.execute` is an application command callback and the SQL operations are now persistence-owned; it is not a SQL execution boundary.

## Matrix 4 — test coverage and behavior-pin plan

The 19 test files in the current package are listed in the ledger. The current focused proof is `r5-tc-1789320772950-66076`, a remote Testcontainers run with the `:apps:backend:catering-business-server:modules:workspace-iam:test` task, Gradle `BUILD SUCCESSFUL`, 20 actionable tasks executed, and containers/volumes/process/workspace cleanup `PASS`. It is a focused compile/test proof, not a whole backend business acceptance result.

The current proof status is deliberately conservative:

| risk dimension | current line-level oracle status | next proof owner |
| --- | --- | --- |
| lookup/not-found and scope denial | source tests exist; exact oracle mapping must be expanded per method family | B15 focused tests |
| account/invitation/role CAS and version conflict | test files exist; exact method-to-oracle mapping remains to be expanded | owning execution batch |
| lock order and self-call/outer propagation | not closed by file existence or annotation count | focused behavior tests plus source review |
| idempotent replay/conflict and receipt readback | receipt tests exist; per command overload mapping remains OPEN | focused behavior tests |
| rollback/no partial write | no CP-0 closure from static inventory | focused red/rollback fixtures |
| rate-limit window/lock/clear | auth/recovery tests exercise flows; exact direct method oracles remain to be mapped | focused rate-limit tests |
| authoritative post-write readback/audit | service-specific mapping remains OPEN | owning execution batch |

For CP-0, the row-level test-oracle field is explicit rather than inferred: the closure appendix gives every exact public-overload row a non-silent state. `ORACLE_NAMED` records the named test and inspected business assertion/readback; `N/A_WITH_REASON` records a pure delegator/composition wrapper for which a separate business oracle would duplicate the target row; `NONE_FOUND_WITH_NA` records the one exact overload for which no current caller is provable and preserves that fact for the owner-batch plan. This is author-side evidence, not a claim that focused behavior proof is unnecessary. The owner-batch proof plan still covers positive/negative behavior, transaction/lock/CAS/idempotency/rollback as applicable, and authoritative readback. Existing test-file presence, class-name matches, status-code assertions, and DB-operation counts do not change a row state.

The appendix is the current exact-row closure artifact for this checkpoint; it contains 134 unique rows, with no missing or duplicate index and no residual `ORACLE_MAPPING_OPEN` state. A fresh independent reviewer must verify the row-to-source and row-to-oracle claims before CP-0 can be marked `MATCHED`.

## CP-0 status

The source-site relocation is **READY_FOR_INDEPENDENT_RECONCILIATION**. The current-byte inventory is zero application sinks / 125 persistence sinks across 18 persistence classes, and the focused proof is `r5-tc-1789320772950-66076` (with the later summary-focused proof `r5-tc-1789340241097-95730` recorded in the execution log). The grouped overload table remains a navigation aid; the exact-signature index and the row-level oracle closure appendix are the source-backed CP-0 artifacts. CP-0 must not be marked `MATCHED` until a fresh independent reviewer verifies the current-byte candidate, caller, transaction/persistence, and test-oracle rows. The initial class-level and test-count findings remain recorded as history; they are not reused as current evidence.
