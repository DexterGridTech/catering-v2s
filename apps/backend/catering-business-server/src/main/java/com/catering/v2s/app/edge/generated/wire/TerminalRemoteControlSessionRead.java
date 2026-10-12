// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record TerminalRemoteControlSessionRead(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "sessionId", required = true) java.util.UUID sessionId,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "state", required = true) String state,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "reason", required = true) String reason,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "description", required = true) tools.jackson.databind.JsonNode description,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "startedAtEpochMillis", required = true) Long startedAtEpochMillis,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "endedAtEpochMillis", required = true) Long endedAtEpochMillis
) {}
