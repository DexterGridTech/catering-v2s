package com.catering.v2s.app.edge.operations.access;

import com.catering.v2s.platform.foundation.contract.ServiceNodeTypes;

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
import com.catering.v2s.workspace.iam.application.WorkspaceTaskReadService;
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
    private final OperationsSessionResolver sessions; private final WorkspaceUserService user; private final WorkspaceTaskReadService reads;
    public OperationsWorkspaceInvitationCandidateController(OperationsSessionResolver sessions, WorkspaceUserService user, WorkspaceTaskReadService reads) { this.sessions = sessions; this.user = user; this.reads = reads; }
    @GetMapping("/group/invitations/candidates") WorkspaceInvitationCandidatePage groupCandidates(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @RequestParam(required = false) UUID scopeRef, @RequestParam String subjectType, @RequestParam String candidateUsage, @RequestParam(required = false) String queryText, @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer pageSize, @RequestParam(required = false) UUID selectedOrganizationRef, @RequestParam long expectedContextVersion) { return candidates(request, groupWorkspaceKey, ServiceNodeTypes.GROUP, scopeRef, subjectType, candidateUsage, queryText, page, pageSize, selectedOrganizationRef, expectedContextVersion); }
    @GetMapping("/region/invitations/candidates") WorkspaceInvitationCandidatePage regionCandidates(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @RequestParam(required = false) UUID scopeRef, @RequestParam String subjectType, @RequestParam String candidateUsage, @RequestParam(required = false) String queryText, @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer pageSize, @RequestParam(required = false) UUID selectedOrganizationRef, @RequestParam long expectedContextVersion) { return candidates(request, groupWorkspaceKey, ServiceNodeTypes.REGION, scopeRef, subjectType, candidateUsage, queryText, page, pageSize, selectedOrganizationRef, expectedContextVersion); }
    @GetMapping("/project/invitations/candidates") WorkspaceInvitationCandidatePage projectCandidates(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @RequestParam(required = false) UUID scopeRef, @RequestParam String subjectType, @RequestParam String candidateUsage, @RequestParam(required = false) String queryText, @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer pageSize, @RequestParam(required = false) UUID selectedOrganizationRef, @RequestParam long expectedContextVersion) { return candidates(request, groupWorkspaceKey, ServiceNodeTypes.PROJECT, scopeRef, subjectType, candidateUsage, queryText, page, pageSize, selectedOrganizationRef, expectedContextVersion); }
    @GetMapping("/head-company/invitations/candidates") WorkspaceInvitationCandidatePage headCompanyCandidates(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @RequestParam(required = false) UUID scopeRef, @RequestParam String subjectType, @RequestParam String candidateUsage, @RequestParam(required = false) String queryText, @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer pageSize, @RequestParam(required = false) UUID selectedOrganizationRef, @RequestParam long expectedContextVersion) { return candidates(request, groupWorkspaceKey, ServiceNodeTypes.HEAD_COMPANY, scopeRef, subjectType, candidateUsage, queryText, page, pageSize, selectedOrganizationRef, expectedContextVersion); }
    @GetMapping("/store/invitations/candidates") WorkspaceInvitationCandidatePage storeCandidates(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @RequestParam(required = false) UUID scopeRef, @RequestParam String subjectType, @RequestParam String candidateUsage, @RequestParam(required = false) String queryText, @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer pageSize, @RequestParam(required = false) UUID selectedOrganizationRef, @RequestParam long expectedContextVersion) { return candidates(request, groupWorkspaceKey, ServiceNodeTypes.STORE, scopeRef, subjectType, candidateUsage, queryText, page, pageSize, selectedOrganizationRef, expectedContextVersion); }
    private WorkspaceInvitationCandidatePage candidates(EdgeRequestContext request, String groupWorkspaceKey, String expectedTargetType, UUID scopeRef, String subjectType, String candidateUsage, String queryText, Integer page, Integer pageSize, UUID selectedOrganizationRef, long expectedContextVersion) {
        WorkspaceSessionReadback session = session(request, groupWorkspaceKey, expectedContextVersion);
        return WorkspaceInvitationCandidatePageWireMapper.page(reads.invitationCandidates(WorkspaceUserService.CandidateQuery.forOperations(session, expectedTargetType, scopeRef, subjectType, candidateUsage, queryText, page, pageSize, selectedOrganizationRef)));
    }
    private WorkspaceSessionReadback session(EdgeRequestContext request, String key, long version) { return sessions.requireWorkspaceReadAtContextVersion(request, key, version); }
}
