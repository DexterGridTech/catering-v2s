// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record PublicInvitationCompletion(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "invitationId", required = true) String invitationId,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "status", required = true) String status,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "message", required = true) String message,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "loginPath", required = true) String loginPath
) {}
