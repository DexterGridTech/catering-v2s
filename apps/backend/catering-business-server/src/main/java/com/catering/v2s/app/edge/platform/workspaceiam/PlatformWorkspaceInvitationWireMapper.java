package com.catering.v2s.app.edge.platform.workspaceiam;

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
                value.invitationPageUrl());
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
