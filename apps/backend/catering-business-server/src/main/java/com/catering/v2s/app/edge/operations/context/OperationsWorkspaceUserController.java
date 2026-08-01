package com.catering.v2s.app.edge.operations.context;

import com.catering.v2s.app.edge.generated.wire.WorkspaceAccountStatus;
import com.catering.v2s.app.edge.generated.wire.WorkspaceUser;
import com.catering.v2s.app.edge.generated.wire.WorkspaceUserAssignmentsItem;
import com.catering.v2s.app.edge.generated.wire.WorkspaceUserInvitationHistoryItem;
import com.catering.v2s.app.edge.generated.wire.WorkspaceUserPage;
import com.catering.v2s.app.edge.generated.wire.WorkspaceUserRevokeRequest;
import com.catering.v2s.app.edge.generated.wire.WorkspaceUserRevokeResult;
import com.catering.v2s.app.edge.generated.wire.ServiceNodeType;
import com.catering.v2s.app.edge.generated.wire.WorkspaceInvitationStatus;
import com.catering.v2s.app.edge.operations.session.OperationsSessionResolver;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import com.catering.v2s.workspace.iam.application.WorkspaceAccountService;
import com.catering.v2s.workspace.iam.application.WorkspaceAuthenticationService;
import com.catering.v2s.workspace.iam.application.WorkspaceUserService;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** User task reads rely on a session context and an owner-derived scope. */
@RestController
@RequestMapping("/api/operations/group-workspaces/{groupWorkspaceKey}/user-management")
public final class OperationsWorkspaceUserController {
    private final OperationsSessionResolver sessions; private final WorkspaceUserService user; private final WorkspaceAccountService accounts;
    public OperationsWorkspaceUserController(OperationsSessionResolver sessions, WorkspaceUserService user, WorkspaceAccountService accounts) { this.sessions = sessions; this.user = user; this.accounts = accounts; }

    @GetMapping("/group/user") WorkspaceUserPage groupPage(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @RequestParam(required = false) UUID scopeRef, @RequestParam(required = false) String userName, @RequestParam(required = false) String mobile, @RequestParam(required = false) String roleQuery, @RequestParam(required = false) WorkspaceAccountStatus status, @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "20") int pageSize, @RequestParam long expectedContextVersion) { return page(request, groupWorkspaceKey, "GROUP", scopeRef, userName, mobile, roleQuery, status, page, pageSize, expectedContextVersion); }
    @GetMapping("/region/user") WorkspaceUserPage regionPage(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @RequestParam(required = false) UUID scopeRef, @RequestParam(required = false) String userName, @RequestParam(required = false) String mobile, @RequestParam(required = false) String roleQuery, @RequestParam(required = false) WorkspaceAccountStatus status, @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "20") int pageSize, @RequestParam long expectedContextVersion) { return page(request, groupWorkspaceKey, "REGION", scopeRef, userName, mobile, roleQuery, status, page, pageSize, expectedContextVersion); }
    @GetMapping("/project/user") WorkspaceUserPage projectPage(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @RequestParam(required = false) UUID scopeRef, @RequestParam(required = false) String userName, @RequestParam(required = false) String mobile, @RequestParam(required = false) String roleQuery, @RequestParam(required = false) WorkspaceAccountStatus status, @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "20") int pageSize, @RequestParam long expectedContextVersion) { return page(request, groupWorkspaceKey, "PROJECT", scopeRef, userName, mobile, roleQuery, status, page, pageSize, expectedContextVersion); }
    @GetMapping("/head-company/user") WorkspaceUserPage headCompanyPage(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @RequestParam(required = false) UUID scopeRef, @RequestParam(required = false) String userName, @RequestParam(required = false) String mobile, @RequestParam(required = false) String roleQuery, @RequestParam(required = false) WorkspaceAccountStatus status, @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "20") int pageSize, @RequestParam long expectedContextVersion) { return page(request, groupWorkspaceKey, "HEAD_COMPANY", scopeRef, userName, mobile, roleQuery, status, page, pageSize, expectedContextVersion); }
    @GetMapping("/store/user") WorkspaceUserPage storePage(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @RequestParam(required = false) UUID scopeRef, @RequestParam(required = false) String userName, @RequestParam(required = false) String mobile, @RequestParam(required = false) String roleQuery, @RequestParam(required = false) WorkspaceAccountStatus status, @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "20") int pageSize, @RequestParam long expectedContextVersion) { return page(request, groupWorkspaceKey, "STORE", scopeRef, userName, mobile, roleQuery, status, page, pageSize, expectedContextVersion); }

    @GetMapping("/group/user/accounts/{accountId}") WorkspaceUser groupDetail(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @PathVariable UUID accountId, @RequestParam long expectedContextVersion) { return detail(request, groupWorkspaceKey, "GROUP", accountId, expectedContextVersion); }
    @GetMapping("/region/user/accounts/{accountId}") WorkspaceUser regionDetail(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @PathVariable UUID accountId, @RequestParam long expectedContextVersion) { return detail(request, groupWorkspaceKey, "REGION", accountId, expectedContextVersion); }
    @GetMapping("/project/user/accounts/{accountId}") WorkspaceUser projectDetail(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @PathVariable UUID accountId, @RequestParam long expectedContextVersion) { return detail(request, groupWorkspaceKey, "PROJECT", accountId, expectedContextVersion); }
    @GetMapping("/head-company/user/accounts/{accountId}") WorkspaceUser headCompanyDetail(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @PathVariable UUID accountId, @RequestParam long expectedContextVersion) { return detail(request, groupWorkspaceKey, "HEAD_COMPANY", accountId, expectedContextVersion); }
    @GetMapping("/store/user/accounts/{accountId}") WorkspaceUser storeDetail(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @PathVariable UUID accountId, @RequestParam long expectedContextVersion) { return detail(request, groupWorkspaceKey, "STORE", accountId, expectedContextVersion); }

    @PostMapping("/group/user/assignments/{assignmentId}/revoke") WorkspaceUserRevokeResult groupRevoke(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @PathVariable UUID assignmentId, @RequestHeader("Idempotency-Key") String idempotencyKey, @RequestBody WorkspaceUserRevokeRequest body) { return revoke(request, groupWorkspaceKey, "GROUP", assignmentId, idempotencyKey, body); }
    @PostMapping("/region/user/assignments/{assignmentId}/revoke") WorkspaceUserRevokeResult regionRevoke(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @PathVariable UUID assignmentId, @RequestHeader("Idempotency-Key") String idempotencyKey, @RequestBody WorkspaceUserRevokeRequest body) { return revoke(request, groupWorkspaceKey, "REGION", assignmentId, idempotencyKey, body); }
    @PostMapping("/project/user/assignments/{assignmentId}/revoke") WorkspaceUserRevokeResult projectRevoke(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @PathVariable UUID assignmentId, @RequestHeader("Idempotency-Key") String idempotencyKey, @RequestBody WorkspaceUserRevokeRequest body) { return revoke(request, groupWorkspaceKey, "PROJECT", assignmentId, idempotencyKey, body); }
    @PostMapping("/head-company/user/assignments/{assignmentId}/revoke") WorkspaceUserRevokeResult headCompanyRevoke(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @PathVariable UUID assignmentId, @RequestHeader("Idempotency-Key") String idempotencyKey, @RequestBody WorkspaceUserRevokeRequest body) { return revoke(request, groupWorkspaceKey, "HEAD_COMPANY", assignmentId, idempotencyKey, body); }
    @PostMapping("/store/user/assignments/{assignmentId}/revoke") WorkspaceUserRevokeResult storeRevoke(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @PathVariable UUID assignmentId, @RequestHeader("Idempotency-Key") String idempotencyKey, @RequestBody WorkspaceUserRevokeRequest body) { return revoke(request, groupWorkspaceKey, "STORE", assignmentId, idempotencyKey, body); }

    private WorkspaceUserPage page(EdgeRequestContext request, String groupWorkspaceKey, String expectedTargetType, UUID scopeRef, String userName, String mobile, String roleQuery, WorkspaceAccountStatus status, int page, int pageSize, long expectedContextVersion) { var session = session(request, groupWorkspaceKey, expectedContextVersion); return page(user.pageForOperations(session, expectedTargetType, scopeRef, userName, mobile, roleQuery, status == null ? null : status.name(), page, pageSize)); }
    private WorkspaceUser detail(EdgeRequestContext request, String groupWorkspaceKey, String expectedTargetType, UUID accountId, long expectedContextVersion) { var session = session(request, groupWorkspaceKey, expectedContextVersion); return user(user.userForOperations(session, expectedTargetType, accountId)); }
    private WorkspaceUserRevokeResult revoke(EdgeRequestContext request, String groupWorkspaceKey, String expectedTargetType, UUID assignmentId, String idempotencyKey, WorkspaceUserRevokeRequest body) { var session = session(request, groupWorkspaceKey, body.expectedContextVersion()); key(idempotencyKey); UUID accountId = accounts.revokeAssignmentForOperations(session.workspaceUuid(), groupWorkspaceKey, session.currentAssignmentId(), expectedTargetType, assignmentId, body.expectedVersion(), sessions.requireActor(request, groupWorkspaceKey)); return new WorkspaceUserRevokeResult(assignmentId.toString(), true, user(user.userForOperations(session, expectedTargetType, accountId)), session.contextVersion(), false, null); }

    static WorkspaceUserPage page(WorkspaceUserService.Page value) { return new WorkspaceUserPage(value.items().stream().map(OperationsWorkspaceUserController::user).toList(), (long) value.page(), (long) value.pageSize(), value.total(), ServiceNodeType.valueOf(value.targetOrganizationType()), value.scopeRef(), value.scopeName(), value.contextVersion()); }
    static WorkspaceUser user(WorkspaceUserService.User value) { return new WorkspaceUser(value.accountId().toString(), value.displayName(), value.maskedMobile(), value.loginName(), WorkspaceAccountStatus.valueOf(value.status()), value.credentialStatus(), (long) value.activeAssignmentCount(), null, value.createdAt(), value.assignments().stream().map(OperationsWorkspaceUserController::assignment).toList(), value.invitationHistory().stream().map(OperationsWorkspaceUserController::invitation).toList(), value.revision()); }
    private static WorkspaceUserAssignmentsItem assignment(WorkspaceUserService.Assignment value) { return new WorkspaceUserAssignmentsItem(value.id().toString(), value.accountId().toString(), value.roleId().toString(), value.roleName(), ServiceNodeType.valueOf(value.serviceNodeType()), value.organizationPath(), value.status(), value.source(), value.revision(), value.createdAt(), value.updatedAt()); }
    private static WorkspaceUserInvitationHistoryItem invitation(WorkspaceUserService.Invitation value) { return new WorkspaceUserInvitationHistoryItem(value.invitationId().toString(), WorkspaceInvitationStatus.valueOf(value.status()), (long) value.generation(), value.expiresAt()); }

    private WorkspaceSessionReadback session(EdgeRequestContext request, String key, long version) { WorkspaceSessionReadback session = sessions.requireWorkspace(request, key); if (session.contextVersion() != version) throw new AccessDeniedException(); return session; }
    private static void key(String value) { if (value == null || value.length() < 16 || value.length() > 128) throw new com.catering.v2s.app.edge.problem.InvalidEdgeRequestException("invalid idempotency key"); }
    static final class AccessDeniedException extends RuntimeException { }
}
