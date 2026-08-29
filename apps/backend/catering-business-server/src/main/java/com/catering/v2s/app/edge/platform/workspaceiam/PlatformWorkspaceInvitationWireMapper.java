package com.catering.v2s.app.edge.platform.workspaceiam;

import com.catering.v2s.app.edge.generated.wire.InvitationRouteFacts;
import com.catering.v2s.app.edge.generated.wire.OrganizationPathNode;
import com.catering.v2s.app.edge.generated.wire.PlatformWorkspaceInvitation;
import com.catering.v2s.app.edge.generated.wire.ServiceNodeType;
import com.catering.v2s.app.edge.generated.wire.WorkspaceInvitationStatus;
import com.catering.v2s.workspace.iam.application.WorkspaceInvitationService;

/** Platform-only projection: unlike the shared invitation wire, it is authorized to expose mobile. */
public final class PlatformWorkspaceInvitationWireMapper {
    private PlatformWorkspaceInvitationWireMapper() {}

    public static PlatformWorkspaceInvitation wire(WorkspaceInvitationService.ManagementInvitationView value) {
        return new PlatformWorkspaceInvitation(
                value.id().toString(),
                value.groupWorkspaceKey(),
                value.mobile(),
                value.issuerDisplayName(),
                ServiceNodeType.valueOf(value.targetOrganizationType()),
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
                        .map(PlatformWorkspaceInvitationWireMapper::node)
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
                value.ref(), value.code(), value.name(), ServiceNodeType.valueOf(value.nodeType()));
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
