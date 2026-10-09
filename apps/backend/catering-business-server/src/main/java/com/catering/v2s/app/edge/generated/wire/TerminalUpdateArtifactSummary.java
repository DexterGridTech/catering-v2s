// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record TerminalUpdateArtifactSummary(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "artifactRef", required = true) java.util.UUID artifactRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "kind", required = true) String kind,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "applicationId", required = true) String applicationId,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "runtimeVersion", required = true) String runtimeVersion,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "nativeBuildNumber", required = true) Long nativeBuildNumber,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "apkVersion", required = true) String apkVersion,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "jsVersion", required = true) String jsVersion,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "publicationId", required = true) String publicationId,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "zipSha256", required = true) String zipSha256,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "byteSize", required = true) Long byteSize,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "createdAtEpochMillis", required = true) Long createdAtEpochMillis
) {}
