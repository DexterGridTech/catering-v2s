// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record WorkspaceUserInvitationHistoryItem(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "invitationId", required = true) String invitationId,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "status", required = true) WorkspaceInvitationStatus status,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "generation", required = true) Long generation,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "expiresAt", required = true) Long expiresAt
) {}
