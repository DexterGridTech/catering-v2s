package com.catering.v2s.app.edge.operations.access;

import com.catering.v2s.app.edge.generated.wire.WorkspaceInvitationCandidatePage;
import com.catering.v2s.app.edge.generated.wire.WorkspaceInvitationCandidatePageOrganizationsItem;
import com.catering.v2s.app.edge.generated.wire.WorkspaceInvitationCandidatePageMetadata;
import com.catering.v2s.app.edge.generated.wire.ServiceNodeType;
import com.catering.v2s.app.edge.generated.wire.WorkspaceRole;
import com.catering.v2s.app.edge.generated.wire.WorkspaceRoleStatus;
import com.catering.v2s.app.edge.operations.session.OperationsSessionResolver;
import com.catering.v2s.app.edge.workspaceiam.WorkspaceInvitationCandidatePageWireMapper;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import com.catering.v2s.workspace.iam.application.WorkspaceAuthenticationService;
import com.catering.v2s.workspace.iam.application.WorkspaceUserService;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Candidate reads are bounded by the same authorized five-page context as user. */
@RestController
@RequestMapping("/api/operations/group-workspaces/{groupWorkspaceKey}/user-management")
public final class OperationsWorkspaceInvitationCandidateController {
    private final OperationsSessionResolver sessions; private final WorkspaceUserService user;
    public OperationsWorkspaceInvitationCandidateController(OperationsSessionResolver sessions, WorkspaceUserService user) { this.sessions = sessions; this.user = user; }
    @GetMapping("/group/invitations/candidates") WorkspaceInvitationCandidatePage groupCandidates(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @RequestParam(required = false) UUID scopeRef, @RequestParam String subjectType, @RequestParam(required = false) String queryText, @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer pageSize, @RequestParam(required = false) UUID selectedOrganizationRef, @RequestParam long expectedContextVersion) { return candidates(request, groupWorkspaceKey, "GROUP", scopeRef, subjectType, queryText, page, pageSize, selectedOrganizationRef, expectedContextVersion); }
    @GetMapping("/region/invitations/candidates") WorkspaceInvitationCandidatePage regionCandidates(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @RequestParam(required = false) UUID scopeRef, @RequestParam String subjectType, @RequestParam(required = false) String queryText, @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer pageSize, @RequestParam(required = false) UUID selectedOrganizationRef, @RequestParam long expectedContextVersion) { return candidates(request, groupWorkspaceKey, "REGION", scopeRef, subjectType, queryText, page, pageSize, selectedOrganizationRef, expectedContextVersion); }
    @GetMapping("/project/invitations/candidates") WorkspaceInvitationCandidatePage projectCandidates(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @RequestParam(required = false) UUID scopeRef, @RequestParam String subjectType, @RequestParam(required = false) String queryText, @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer pageSize, @RequestParam(required = false) UUID selectedOrganizationRef, @RequestParam long expectedContextVersion) { return candidates(request, groupWorkspaceKey, "PROJECT", scopeRef, subjectType, queryText, page, pageSize, selectedOrganizationRef, expectedContextVersion); }
    @GetMapping("/head-company/invitations/candidates") WorkspaceInvitationCandidatePage headCompanyCandidates(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @RequestParam(required = false) UUID scopeRef, @RequestParam String subjectType, @RequestParam(required = false) String queryText, @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer pageSize, @RequestParam(required = false) UUID selectedOrganizationRef, @RequestParam long expectedContextVersion) { return candidates(request, groupWorkspaceKey, "HEAD_COMPANY", scopeRef, subjectType, queryText, page, pageSize, selectedOrganizationRef, expectedContextVersion); }
    @GetMapping("/store/invitations/candidates") WorkspaceInvitationCandidatePage storeCandidates(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @RequestParam(required = false) UUID scopeRef, @RequestParam String subjectType, @RequestParam(required = false) String queryText, @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer pageSize, @RequestParam(required = false) UUID selectedOrganizationRef, @RequestParam long expectedContextVersion) { return candidates(request, groupWorkspaceKey, "STORE", scopeRef, subjectType, queryText, page, pageSize, selectedOrganizationRef, expectedContextVersion); }
    private WorkspaceInvitationCandidatePage candidates(EdgeRequestContext request, String groupWorkspaceKey, String expectedTargetType, UUID scopeRef, String subjectType, String queryText, Integer page, Integer pageSize, UUID selectedOrganizationRef, long expectedContextVersion) {
        WorkspaceSessionReadback session = session(request, groupWorkspaceKey, expectedContextVersion);
        return WorkspaceInvitationCandidatePageWireMapper.page(user.candidatesForOperations(session, expectedTargetType, scopeRef, subjectType, queryText, page, pageSize, selectedOrganizationRef));
    }
    private WorkspaceSessionReadback session(EdgeRequestContext request, String key, long version) { WorkspaceSessionReadback session = sessions.requireWorkspace(request, key); if (session.contextVersion() != version) throw new AccessDeniedException(); return session; }
    static final class AccessDeniedException extends RuntimeException { }
}
