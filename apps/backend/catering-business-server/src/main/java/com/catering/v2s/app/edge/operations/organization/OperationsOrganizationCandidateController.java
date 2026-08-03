package com.catering.v2s.app.edge.operations.organization;

import com.catering.v2s.app.edge.generated.wire.OrganizationCandidatePage;
import com.catering.v2s.app.edge.generated.wire.OrganizationCandidatePageItemsItem;
import com.catering.v2s.app.edge.generated.wire.OrganizationCandidatePageMetadata;
import com.catering.v2s.app.edge.generated.wire.OrganizationCandidateQuerySubjectType;
import com.catering.v2s.app.edge.operations.session.OperationsSessionResolver;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.organization.application.StoreCandidateTaskReadService;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import com.catering.v2s.workspace.iam.application.WorkspaceAuthenticationService;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Single reusable owner candidate surface for cross-entity selectors. */
@RestController
@RequestMapping("/api/operations/group-workspaces/{groupWorkspaceKey}/organization")
public final class OperationsOrganizationCandidateController {
    private final OperationsSessionResolver sessions;
    private final StoreCandidateTaskReadService candidates;

    public OperationsOrganizationCandidateController(OperationsSessionResolver sessions, StoreCandidateTaskReadService candidates) {
        this.sessions = sessions;
        this.candidates = candidates;
    }

    @GetMapping("/candidates")
    OrganizationCandidatePage page(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @RequestParam long expectedContextVersion, @RequestParam String subjectType, @RequestParam(required = false) String queryText, @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer pageSize, @RequestParam(required = false) UUID selectedId, @RequestParam(required = false) UUID projectId, @RequestParam(required = false) UUID brandId, @RequestParam(required = false) UUID tenantId) {
        WorkspaceSessionReadback session = sessions.requireWorkspace(request, groupWorkspaceKey);
        if (session.contextVersion() != expectedContextVersion || session.currentAssignmentId() == null) throw new WorkspaceAuthenticationService.SessionInvalidException();
        var value = candidates.candidatePage(session.workspaceUuid(), groupWorkspaceKey, session.currentAssignmentId(), session.visibleDataNodeId(), subjectType, queryText, page, pageSize, selectedId, projectId, brandId, tenantId);
        return new OrganizationCandidatePage(new OrganizationCandidatePageMetadata(OrganizationCandidateQuerySubjectType.valueOf(value.metadata().subjectType()), value.metadata().queryText(), (long) value.metadata().page(), (long) value.metadata().pageSize(), value.metadata().total(), value.metadata().selectedId() == null ? null : value.metadata().selectedId().toString()), value.items().stream().map(item -> new OrganizationCandidatePageItemsItem(item.id().toString(), item.code(), item.name())).toList());
    }
}
