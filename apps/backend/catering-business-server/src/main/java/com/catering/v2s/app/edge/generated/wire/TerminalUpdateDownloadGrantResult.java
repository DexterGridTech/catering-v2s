// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record TerminalUpdateDownloadGrantResult(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "relativeContentPath", required = true) String relativeContentPath,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "grant", required = true) String grant,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "expiresAtEpochMillis", required = true) Long expiresAtEpochMillis,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "artifactRef", required = true) java.util.UUID artifactRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "zipSha256", required = true) String zipSha256,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "byteSize", required = true) Long byteSize,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "artifact", required = true) TerminalUpdateDownloadGrantResultArtifact artifact
) {}
