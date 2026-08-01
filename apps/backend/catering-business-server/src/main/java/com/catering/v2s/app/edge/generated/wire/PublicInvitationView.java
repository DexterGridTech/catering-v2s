// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record PublicInvitationView(
    String invitationId,
    String groupWorkspaceKey,
    String workspaceName,
    String operationsTitle,
    String logoUrl,
    ServiceNodeType targetOrganizationType,
    String targetOrganizationPath,
    java.util.List<String> roleNames,
    String maskedMobile,
    WorkspaceInvitationStatus status,
    Long expiresAt
) {}
