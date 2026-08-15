package com.catering.v2s.app.edge.platform.workspaceiam;

import com.catering.v2s.app.edge.generated.wire.ServiceNodeType;
import com.catering.v2s.app.edge.generated.wire.SortDirection;
import com.catering.v2s.app.edge.generated.wire.PlatformWorkspaceInvitation;
import com.catering.v2s.app.edge.generated.wire.PlatformWorkspaceInvitationPage;
import com.catering.v2s.app.edge.generated.wire.WorkspaceInvitationCancelRequest;
import com.catering.v2s.app.edge.generated.wire.WorkspaceInvitationCandidatePage;
import com.catering.v2s.app.edge.generated.wire.WorkspaceInvitationCreateRequest;
import com.catering.v2s.app.edge.generated.wire.WorkspaceInvitationPage;
import com.catering.v2s.app.edge.generated.wire.WorkspaceInvitationReissueRequest;
import com.catering.v2s.app.edge.generated.wire.WorkspaceInvitationSortKey;
import com.catering.v2s.app.edge.generated.wire.WorkspaceInvitationStatus;
import com.catering.v2s.app.edge.platform.session.PlatformSessionResolver;
import com.catering.v2s.app.edge.problem.InvalidEdgeRequestException;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.app.edge.workspaceiam.WorkspaceInvitationCandidatePageWireMapper;
import com.catering.v2s.platform.workspace.application.WorkspaceAdministrationService;
import com.catering.v2s.workspace.iam.application.WorkspaceInvitationService;
import com.catering.v2s.workspace.iam.application.PlatformInvitationCandidatesTaskReadService;
import com.catering.v2s.workspace.iam.application.PlatformWorkspaceInvitationTaskReadService;
import com.catering.v2s.workspace.iam.application.WorkspaceUserService;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Permanent platform invitation centre.  This face deliberately authenticates only
 * the platform session; it never resolves a workspace account, assignment or role capability.
 */
@RestController
@RequestMapping("/api/platform/group-workspaces/{groupWorkspaceKey}")
public final class PlatformWorkspaceInvitationController {
    private final PlatformSessionResolver sessions;
    private final WorkspaceAdministrationService workspaces;
    private final WorkspaceInvitationService invitations;
    private final WorkspaceUserService users;
    private final PlatformInvitationCandidatesTaskReadService candidates;
    private final PlatformWorkspaceInvitationTaskReadService reads;

    public PlatformWorkspaceInvitationController(PlatformSessionResolver sessions, WorkspaceAdministrationService workspaces, WorkspaceInvitationService invitations, WorkspaceUserService users, PlatformInvitationCandidatesTaskReadService candidates, PlatformWorkspaceInvitationTaskReadService reads) {
        this.sessions = sessions;
        this.workspaces = workspaces;
        this.invitations = invitations;
        this.users = users;
        this.candidates = candidates;
        this.reads = reads;
    }

    @GetMapping("/invitations")
    PlatformWorkspaceInvitationPage list(
        EdgeRequestContext request,
        @PathVariable String groupWorkspaceKey,
        @RequestParam(required = false) String mobile,
        @RequestParam(required = false) ServiceNodeType targetOrganizationType,
        @RequestParam(required = false) UUID targetOrganizationRef,
        @RequestParam(required = false) UUID roleId,
        @RequestParam(required = false) WorkspaceInvitationStatus status,
        @RequestParam(required = false) Long expiresFrom,
        @RequestParam(required = false) Long expiresTo,
        @RequestParam(required = false) WorkspaceInvitationSortKey sort,
        @RequestParam(required = false) SortDirection direction,
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int pageSize
    ) {
        var workspace = workspace(request, groupWorkspaceKey);
        return PlatformWorkspaceInvitationPageWireMapper.page(reads.page(
            workspace.workspaceUuid(), groupWorkspaceKey,
            new WorkspaceInvitationService.ManagementInvitationPageRequest(mobile, targetOrganizationType == null ? null : targetOrganizationType.name(), targetOrganizationRef, roleId, status == null ? null : status.name(), expiresFrom, expiresTo, sort == null ? WorkspaceInvitationSortKey.CREATED_AT.name() : sort.name(), direction == null ? SortDirection.DESC.name() : direction.name(), page, pageSize)
        ));
    }

    @GetMapping("/invitation-candidates")
    WorkspaceInvitationCandidatePage candidates(
        EdgeRequestContext request,
        @PathVariable String groupWorkspaceKey,
        @RequestParam ServiceNodeType targetOrganizationType,
        @RequestParam String subjectType,
        @RequestParam String candidateUsage,
        @RequestParam(required = false) String queryText,
        @RequestParam(required = false) Integer page,
        @RequestParam(required = false) Integer pageSize,
        @RequestParam(required = false) UUID selectedOrganizationRef
    ) {
        var workspace = workspace(request, groupWorkspaceKey);
        return WorkspaceInvitationCandidatePageWireMapper.page(candidates.candidates(WorkspaceUserService.CandidateQuery.forPlatform(workspace.workspaceUuid(), groupWorkspaceKey, targetOrganizationType.name(), subjectType, candidateUsage, queryText, page, pageSize, selectedOrganizationRef)));
    }

    @GetMapping("/invitations/{invitationId}")
    PlatformWorkspaceInvitation detail(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @PathVariable UUID invitationId) {
        var workspace = workspace(request, groupWorkspaceKey);
        return PlatformWorkspaceInvitationWireMapper.wire(reads.detail(workspace.workspaceUuid(), groupWorkspaceKey, invitationId));
    }

    @PostMapping("/invitations")
    ResponseEntity<PlatformWorkspaceInvitation> create(
        EdgeRequestContext request,
        @PathVariable String groupWorkspaceKey,
        @RequestHeader("Idempotency-Key") String idempotencyKey,
        @RequestBody WorkspaceInvitationCreateRequest body
    ) {
        var session = sessions.require(request);
        var workspace = workspaces.requireEnabled(groupWorkspaceKey);
        validKey(idempotencyKey);
        if (body == null || body.targetOrganizationType() == null || body.targetOrganizationRef() == null || body.roleIds() == null || body.roleIds().isEmpty()) throw new InvalidEdgeRequestException("invitation target and role ids are required");
        UUID targetId = body.targetOrganizationRef();
        List<WorkspaceInvitationService.AssignmentIntent> intents = body.roleIds().stream().map(PlatformWorkspaceInvitationController::uuid).map(roleId -> new WorkspaceInvitationService.AssignmentIntent(roleId, body.targetOrganizationType(), targetId)).toList();
        return ResponseEntity.status(HttpStatus.CREATED).body(PlatformWorkspaceInvitationWireMapper.wire(invitations.managementView(invitations.create(workspace.workspaceUuid(), groupWorkspaceKey, body.mobile(), intents, idempotencyKey, sessions.actor(session)))));
    }

    @PostMapping("/invitations/{invitationId}/cancel")
    PlatformWorkspaceInvitation cancel(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @PathVariable UUID invitationId, @RequestHeader("Idempotency-Key") String idempotencyKey, @RequestBody WorkspaceInvitationCancelRequest body) {
        var session = sessions.require(request);
        var workspace = workspaces.requireEnabled(groupWorkspaceKey);
        validKey(idempotencyKey);
        return PlatformWorkspaceInvitationWireMapper.wire(invitations.managementView(invitations.cancel(workspace.workspaceUuid(), groupWorkspaceKey, invitationId, expected(body == null ? null : body.expectedVersion()), idempotencyKey, sessions.actor(session))));
    }

    @PostMapping("/invitations/{invitationId}/reissue")
    PlatformWorkspaceInvitation reissue(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @PathVariable UUID invitationId, @RequestHeader("Idempotency-Key") String idempotencyKey, @RequestBody WorkspaceInvitationReissueRequest body) {
        var session = sessions.require(request);
        var workspace = workspaces.requireEnabled(groupWorkspaceKey);
        validKey(idempotencyKey);
        return PlatformWorkspaceInvitationWireMapper.wire(invitations.managementView(invitations.reissue(workspace.workspaceUuid(), groupWorkspaceKey, invitationId, expected(body == null ? null : body.expectedVersion()), idempotencyKey, sessions.actor(session))));
    }

    private PlatformSessionResolver.EnabledSelectedWorkspaceFact workspace(EdgeRequestContext request, String groupWorkspaceKey) {
        return sessions.requireRead(request).requireEnabledSelectedWorkspace(workspaces, groupWorkspaceKey);
    }

    private static UUID uuid(String value) {
        try { return UUID.fromString(value); } catch (RuntimeException exception) { throw new InvalidEdgeRequestException("identifier is invalid"); }
    }

    private static long expected(Long value) {
        if (value == null) throw new InvalidEdgeRequestException("expected version is required");
        return value;
    }

    private static void validKey(String value) {
        if (value == null || value.length() < 16 || value.length() > 128) throw new InvalidEdgeRequestException("invalid idempotency key");
    }
}
