// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record PublicInvitationView(
    String invitationId,
    String groupWorkspaceKey,
    String operationsTitle,
    String targetOrganizationType,
    String targetOrganizationPath,
    java.util.List<String> roleNames,
    String maskedMobile,
    WorkspaceInvitationStatus status,
    String nextStep,
    Long expiresAt,
    String workspaceName,
    String logoUrl
) {}
