// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record WorkspaceCurrentPasswordChangeResult(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "status", required = true) String status,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "sessionsRevoked", required = true) Boolean sessionsRevoked,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "reauthenticationRequired", required = true) Boolean reauthenticationRequired
) {}
