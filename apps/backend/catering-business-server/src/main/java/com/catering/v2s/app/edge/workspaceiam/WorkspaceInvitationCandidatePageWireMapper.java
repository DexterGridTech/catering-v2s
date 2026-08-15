package com.catering.v2s.app.edge.workspaceiam;

import com.catering.v2s.app.edge.generated.wire.WorkspaceInvitationCandidatePage;
import com.catering.v2s.app.edge.generated.wire.WorkspaceInvitationCandidatePageMetadata;
import com.catering.v2s.app.edge.generated.wire.WorkspaceInvitationCandidatePageOrganizationsItem;
import com.catering.v2s.app.edge.generated.wire.WorkspaceRole;
import com.catering.v2s.app.edge.generated.wire.WorkspaceRoleStatus;
import com.catering.v2s.workspace.iam.api.WorkspaceRoleReadback;
import com.catering.v2s.workspace.iam.application.WorkspaceUserService;

/** Shared read-only wire projection for both admin faces; scope is enforced by the caller's owner read. */
public final class WorkspaceInvitationCandidatePageWireMapper {
    private WorkspaceInvitationCandidatePageWireMapper() { }

    public static WorkspaceInvitationCandidatePage page(WorkspaceUserService.CandidatePage value) {
        return new WorkspaceInvitationCandidatePage(value.organizations().stream().map(WorkspaceInvitationCandidatePageWireMapper::organization).toList(), value.roles().stream().map(WorkspaceInvitationCandidatePageWireMapper::role).toList(), metadata(value.metadata()));
    }

    private static WorkspaceInvitationCandidatePageMetadata metadata(WorkspaceUserService.CandidateQueryMetadata value) {
        return value == null ? null : new WorkspaceInvitationCandidatePageMetadata(value.subjectType(), value.queryText(), Long.valueOf(value.page()), Long.valueOf(value.pageSize()), value.total(), value.selectedOrganizationRef());
    }

    private static WorkspaceInvitationCandidatePageOrganizationsItem organization(WorkspaceUserService.CandidateOrganization value) {
        return new WorkspaceInvitationCandidatePageOrganizationsItem(value.serviceNodeType(), value.organizationRef(), value.path());
    }

    private static WorkspaceRole role(WorkspaceRoleReadback value) {
        return new WorkspaceRole(value.id().toString(), value.groupWorkspaceKey(), value.name(), value.description(), value.serviceNodeType(), value.actionCapabilityKeys().stream().sorted().toList(), value.pageAccessKeys().stream().sorted().toList(), WorkspaceRoleStatus.valueOf(value.status()), value.version(), value.createdAtEpochMillis(), value.updatedAtEpochMillis());
    }
}
