// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record WorkspaceInvitation(
    String id,
    String groupWorkspaceKey,
    String maskedMobile,
    String targetOrganizationType,
    java.util.List<String> roleNames,
    WorkspaceInvitationStatus status,
    Long generation,
    Long expiresAt,
    Long revision,
    Long createdAt,
    Long consentedAt,
    Long completedAt,
    Long cancelledAt,
    java.util.List<OrganizationPathNode> targetOrganizationPathNodes,
    InvitationRouteFacts invitationRouteFacts
) {}
