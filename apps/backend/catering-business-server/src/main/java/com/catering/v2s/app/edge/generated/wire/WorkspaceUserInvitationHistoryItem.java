// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record WorkspaceUserInvitationHistoryItem(
    String invitationId,
    WorkspaceInvitationStatus status,
    Long generation,
    Long expiresAt
) {}
