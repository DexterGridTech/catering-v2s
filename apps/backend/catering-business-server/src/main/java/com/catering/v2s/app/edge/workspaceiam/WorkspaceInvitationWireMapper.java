package com.catering.v2s.app.edge.workspaceiam;

import com.catering.v2s.app.edge.generated.wire.WorkspaceInvitation;
import com.catering.v2s.app.edge.generated.wire.WorkspaceInvitationStatus;
import com.catering.v2s.workspace.iam.application.WorkspaceInvitationService;

/** Maps the owner readback to the generated HTTP wire without exposing owner-only mobile/token. */
public final class WorkspaceInvitationWireMapper {
    private WorkspaceInvitationWireMapper() { }

    public static WorkspaceInvitation wire(
        WorkspaceInvitationService.ManagementInvitationView value
    ) {
        return new WorkspaceInvitation(
            value.id().toString(),
            value.groupWorkspaceKey(),
            value.maskedMobile(),
            value.targetOrganizationType(),
            value.targetOrganizationPath(),
            value.roleNames(),
            status(value.status()),
            value.generation(),
            value.expiresAt(),
            value.revision(),
            value.createdAt(),
            value.consentedAt(),
            value.completedAt(),
            value.cancelledAt(),
            value.invitationPageUrl()
        );
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
