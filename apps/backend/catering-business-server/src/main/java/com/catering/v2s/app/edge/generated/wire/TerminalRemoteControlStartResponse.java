// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record TerminalRemoteControlStartResponse(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "sessionId", required = true) java.util.UUID sessionId,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "state", required = true) String state,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "roomName", required = true) String roomName,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "controllerIdentity", required = true) String controllerIdentity,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "description", required = true) tools.jackson.databind.JsonNode description,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "startOperationId", required = true) java.util.UUID startOperationId,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "deadlineAtEpochMillis", required = true) Long deadlineAtEpochMillis
) {}
