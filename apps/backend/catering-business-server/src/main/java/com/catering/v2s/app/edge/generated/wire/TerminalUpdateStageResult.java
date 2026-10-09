// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record TerminalUpdateStageResult(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "stageRef", required = true) java.util.UUID stageRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "stageBindGrant", required = true) String stageBindGrant,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "expiresAtEpochMillis", required = true) Long expiresAtEpochMillis,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "fileName", required = true) String fileName,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "sha256", required = true) String sha256,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "byteSize", required = true) Long byteSize
) {}
