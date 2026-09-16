// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record PublicInvitationReadiness(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "verificationGrant", required = true) String verificationGrant,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "accountExists", required = true) AccountPresenceStatus accountExists,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "userNameReady", required = true) Boolean userNameReady,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "loginNameReady", required = true) Boolean loginNameReady,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "passwordReady", required = true) Boolean passwordReady,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "nextStep", required = true) String nextStep
) {}
