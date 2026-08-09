package com.catering.v2s.app.edge.platform.workspaceiam;

import com.catering.v2s.app.edge.generated.wire.WorkspaceAccount;
import com.catering.v2s.app.edge.generated.wire.WorkspaceAccountAssignmentsItem;
import com.catering.v2s.app.edge.generated.wire.WorkspaceAccountInvitationHistoryItem;
import com.catering.v2s.app.edge.generated.wire.WorkspaceAccountAuthenticationHistoryItem;
import com.catering.v2s.app.edge.generated.wire.WorkspaceAccountPage;
import com.catering.v2s.app.edge.generated.wire.WorkspaceAccountStatus;
import com.catering.v2s.app.edge.generated.wire.WorkspaceInvitationStatus;
import com.catering.v2s.app.edge.generated.wire.ServiceNodeType;
import com.catering.v2s.app.edge.generated.wire.SortDirection;
import com.catering.v2s.app.edge.generated.wire.WorkspacePlatformAccountSortKey;
import com.catering.v2s.app.edge.generated.wire.WorkspaceAccountStatusTransitionRequest;
import com.catering.v2s.app.edge.generated.wire.WorkspaceAssignmentRevokeRequest;
import com.catering.v2s.app.edge.generated.wire.WorkspaceAssignmentRevokeResult;
import com.catering.v2s.app.edge.generated.wire.WorkspaceCredentialResetRequest;
import com.catering.v2s.app.edge.generated.wire.WorkspaceCredentialResetResult;
import com.catering.v2s.app.edge.platform.session.PlatformSessionResolver;
import com.catering.v2s.app.edge.problem.InvalidEdgeRequestException;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.platform.workspace.application.WorkspaceAdministrationService;
import com.catering.v2s.workspace.iam.application.WorkspaceAccountService;
import com.catering.v2s.workspace.iam.application.PlatformWorkspaceAccountTaskReadService;
import com.catering.v2s.workspace.iam.application.WorkspaceUserService;
import com.catering.v2s.workspace.iam.application.WorkspacePasswordResetService;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/platform/group-workspaces/{groupWorkspaceKey}/accounts")
public final class PlatformWorkspaceAccountController {
    private final PlatformSessionResolver sessions; private final WorkspaceAdministrationService workspaces; private final WorkspaceAccountService accounts; private final WorkspacePasswordResetService passwordResets; private final WorkspaceUserService user; private final PlatformWorkspaceAccountTaskReadService reads;
    public PlatformWorkspaceAccountController(PlatformSessionResolver sessions, WorkspaceAdministrationService workspaces, WorkspaceAccountService accounts, WorkspacePasswordResetService passwordResets, WorkspaceUserService user, PlatformWorkspaceAccountTaskReadService reads) { this.sessions = sessions; this.workspaces = workspaces; this.accounts = accounts; this.passwordResets = passwordResets; this.user = user; this.reads = reads; }
    @GetMapping WorkspaceAccountPage list(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @RequestParam(required = false) String userName, @RequestParam(required = false) String mobile, @RequestParam(required = false) String loginName, @RequestParam(required = false) UUID roleId, @RequestParam(required = false) WorkspaceAccountStatus status, @RequestParam(required = false) ServiceNodeType serviceNodeType, @RequestParam(required = false) String organizationRef, @RequestParam(required = false) WorkspacePlatformAccountSortKey sort, @RequestParam(required = false) SortDirection direction, @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "50") int pageSize) { var workspace = workspace(request, groupWorkspaceKey); var result = reads.page(WorkspaceUserService.AccountPageQuery.forPlatform(workspace.workspaceUuid(), groupWorkspaceKey, userName, mobile, loginName, roleId, status == null ? null : status.wire(), serviceNodeType == null ? null : serviceNodeType.wire(), opaqueRef(organizationRef), sort == null ? null : sort.wire(), direction == null ? null : direction.wire(), page, pageSize)); return new WorkspaceAccountPage(result.items().stream().map(value -> wire(value, groupWorkspaceKey)).toList(), (long) result.page(), (long) result.pageSize(), result.total(), WorkspacePlatformAccountSortKey.valueOf(result.sort()), SortDirection.valueOf(result.direction())); }
    @GetMapping("/{accountId}") WorkspaceAccount detail(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @PathVariable UUID accountId) { var workspace = workspace(request, groupWorkspaceKey); return wire(reads.detail(WorkspaceUserService.AccountDetailQuery.forPlatform(workspace.workspaceUuid(), groupWorkspaceKey, accountId)), groupWorkspaceKey); }
    @PostMapping("/{accountId}/status") WorkspaceAccount status(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @PathVariable UUID accountId, @RequestHeader("Idempotency-Key") String idempotencyKey, @RequestBody WorkspaceAccountStatusTransitionRequest body) { var session = sessions.require(request); var workspace = workspaces.requireEnabled(groupWorkspaceKey); key(idempotencyKey); if (body.targetStatus() == null || body.expectedVersion() == null) throw new InvalidEdgeRequestException("status and expected version required"); var result = accounts.transitionStatusForPlatform(workspace.workspaceUuid(), groupWorkspaceKey, accountId, body.targetStatus().wire(), body.expectedVersion(), idempotencyKey, sessions.actor(session)); return wire(user.detail(WorkspaceUserService.AccountDetailQuery.forPlatform(result.workspaceUuid(), groupWorkspaceKey, accountId)), groupWorkspaceKey); }
    @PostMapping("/{accountId}/credential-reset") WorkspaceCredentialResetResult requestCredentialReset(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @PathVariable UUID accountId, @RequestHeader("Idempotency-Key") String idempotencyKey, @RequestBody WorkspaceCredentialResetRequest body) { var session = sessions.require(request); var workspace = workspaces.requireEnabled(groupWorkspaceKey); key(idempotencyKey); if (body.expectedVersion() == null) throw new InvalidEdgeRequestException("expected version required"); var result = passwordResets.requestPlatform(workspace.workspaceUuid(), groupWorkspaceKey, accountId, body.expectedVersion(), idempotencyKey, sessions.actor(session)); return new WorkspaceCredentialResetResult(result.accountId().toString(), result.loginName(), WorkspaceAccountStatus.valueOf(result.status()), result.credentialStatus(), result.revision(), result.sessionsRevoked()); }
    @PostMapping("/{accountId}/assignments/{assignmentId}/revoke") WorkspaceAssignmentRevokeResult revoke(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @PathVariable UUID accountId, @PathVariable UUID assignmentId, @RequestHeader("Idempotency-Key") String idempotencyKey, @RequestBody WorkspaceAssignmentRevokeRequest body) { var session = sessions.require(request); var workspace = workspaces.requireEnabled(groupWorkspaceKey); key(idempotencyKey); if (body.expectedVersion() == null) throw new InvalidEdgeRequestException("expected version required"); var result = accounts.revokeAssignmentForPlatform(workspace.workspaceUuid(), groupWorkspaceKey, accountId, assignmentId, body.expectedVersion(), idempotencyKey, sessions.actor(session)); return new WorkspaceAssignmentRevokeResult(result.assignmentId().toString(), result.status(), result.revision(), null); }
    private PlatformSessionResolver.EnabledSelectedWorkspaceFact workspace(EdgeRequestContext request, String key) { return sessions.requireRead(request).requireEnabledSelectedWorkspace(workspaces, key); }
    private static WorkspaceAccount wire(WorkspaceUserService.User value, String groupWorkspaceKey) { return new WorkspaceAccount(value.accountId().toString(), groupWorkspaceKey, value.displayName(), value.mobile(), value.loginName(), WorkspaceAccountStatus.valueOf(value.status()), value.credentialStatus(), (long) value.activeAssignmentCount(), value.lastLoginAt(), value.createdAt(), value.updatedAt(), value.revision(), value.assignments().stream().map(PlatformWorkspaceAccountController::assignment).toList(), value.invitationHistory().stream().map(PlatformWorkspaceAccountController::invitation).toList(), value.authenticationHistory().stream().map(history -> new WorkspaceAccountAuthenticationHistoryItem(history.authenticatedAt())).toList()); }
    private static WorkspaceAccountAssignmentsItem assignment(WorkspaceUserService.Assignment value) { return new WorkspaceAccountAssignmentsItem(value.id().toString(), ServiceNodeType.valueOf(value.serviceNodeType()), value.organizationPath(), value.roleName(), value.status(), value.source(), value.revision()); }
    private static WorkspaceAccountInvitationHistoryItem invitation(WorkspaceUserService.Invitation value) { return new WorkspaceAccountInvitationHistoryItem(value.invitationId().toString(), WorkspaceInvitationStatus.valueOf(value.status()), (long) value.generation(), value.expiresAt()); }
    private static UUID opaqueRef(String value) { if (value == null || value.isBlank()) return null; try { return UUID.fromString(value); } catch (IllegalArgumentException error) { throw new InvalidEdgeRequestException("invalid organization reference"); } }
    private static void key(String value) { if (value == null || value.length() < 16 || value.length() > 128) throw new InvalidEdgeRequestException("invalid idempotency key"); }
}
