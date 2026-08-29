package com.catering.v2s.app.edge.workspaceiam;

import com.catering.v2s.app.edge.generated.wire.InvitationRouteFacts;
import com.catering.v2s.app.edge.generated.wire.OrganizationPathNode;
import com.catering.v2s.app.edge.generated.wire.WorkspaceInvitation;
import com.catering.v2s.app.edge.generated.wire.WorkspaceInvitationStatus;
import com.catering.v2s.workspace.iam.application.WorkspaceInvitationService;

/** Maps the owner readback to the generated HTTP wire without exposing owner-only mobile/token. */
public final class WorkspaceInvitationWireMapper {
    private WorkspaceInvitationWireMapper() {}

    public static WorkspaceInvitation wire(WorkspaceInvitationService.ManagementInvitationView value) {
        return new WorkspaceInvitation(
                value.id().toString(),
                value.groupWorkspaceKey(),
                value.maskedMobile(),
                value.targetOrganizationType(),
                value.roleNames(),
                status(value.status()),
                value.generation(),
                value.expiresAt(),
                value.revision(),
                value.createdAt(),
                value.consentedAt(),
                value.completedAt(),
                value.cancelledAt(),
                value.targetOrganizationPathNodes().stream()
                        .map(WorkspaceInvitationWireMapper::node)
                        .toList(),
                value.invitationRouteFacts() == null
                        ? null
                        : new InvitationRouteFacts(
                                value.invitationRouteFacts().groupWorkspaceKey(),
                                value.invitationRouteFacts().invitationToken()));
    }

    private static OrganizationPathNode node(
            com.catering.v2s.organization.api.OrganizationTaskPathLookup.TaskPathNode value) {
        return new OrganizationPathNode(
                value.ref(),
                value.code(),
                value.name(),
                com.catering.v2s.app.edge.generated.wire.ServiceNodeType.valueOf(value.nodeType()));
    }

    private static WorkspaceInvitationStatus status(String value) {
        return switch (value) {
            case "COMPLETED" -> WorkspaceInvitationStatus.COMPLETED;
            case "CANCELLED" -> WorkspaceInvitationStatus.CANCELLED;
            case "EXPIRED" -> WorkspaceInvitationStatus.EXPIRED;
            default -> WorkspaceInvitationStatus.ACTIVE;
        };
    }
}
