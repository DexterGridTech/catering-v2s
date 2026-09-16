// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record WorkspaceCredentialResetResult(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "accountId", required = true) String accountId,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "loginName", required = true) String loginName,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "status", required = true) WorkspaceAccountStatus status,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "credentialStatus", required = true) String credentialStatus,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "revision", required = true) Long revision,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "sessionsRevoked", required = true) Boolean sessionsRevoked
) {}
