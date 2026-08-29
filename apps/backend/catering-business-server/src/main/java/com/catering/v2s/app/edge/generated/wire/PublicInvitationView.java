// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record PublicInvitationView(
    String invitationId,
    String groupWorkspaceKey,
    String operationsTitle,
    String targetOrganizationType,
    java.util.List<String> roleNames,
    String maskedMobile,
    WorkspaceInvitationStatus status,
    Long expiresAt,
    String workspaceName,
    String nextStep,
    String logoUrl,
    java.util.List<OrganizationPathNode> targetOrganizationPathNodes
) {}
