// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record TerminalUpdateDownloadGrantResultArtifact(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "schemaVersion", required = true) Long schemaVersion,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "platform", required = true) String platform,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "applicationId", required = true) String applicationId,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "nativeVersion", required = true) String nativeVersion,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "nativeBuildNumber", required = true) Long nativeBuildNumber,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "bundleVersion", required = true) String bundleVersion,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "runtimeVersion", required = true) String runtimeVersion,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "entry", required = true) String entry,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "files", required = true) java.util.List<TerminalUpdateDownloadGrantResultArtifactFilesItem> files,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "publicationId", required = true) String publicationId,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "minimumFull", required = true) tools.jackson.databind.JsonNode minimumFull,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "apk", required = true) tools.jackson.databind.JsonNode apk
) {}
