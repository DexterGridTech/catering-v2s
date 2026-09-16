// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record PublicInvitationCredentialRequest(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "verificationGrant", required = true) String verificationGrant,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "userName", required = true) String userName,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "loginName", required = true) String loginName,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "password", required = true) String password
) {}
