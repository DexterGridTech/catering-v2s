// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record TerminalUpdateStageResult(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "stageRef", required = true) java.util.UUID stageRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "stageBindGrant", required = true) String stageBindGrant,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "expiresAtEpochMillis", required = true) Long expiresAtEpochMillis,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "fileName", required = true) String fileName,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "sha256", required = true) String sha256,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "byteSize", required = true) Long byteSize,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "candidateKind", required = true) String candidateKind,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "applicationId", required = true) String applicationId,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "platform", required = true) String platform,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "nativeVersion", required = true) String nativeVersion,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "nativeBuildNumber", required = true) Long nativeBuildNumber,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "bundleVersion", required = true) String bundleVersion,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "runtimeVersion", required = true) String runtimeVersion,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "publicationId", required = true) String publicationId,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "apkSha256", required = true) String apkSha256,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "minimumFull", required = true) tools.jackson.databind.JsonNode minimumFull
) {}
