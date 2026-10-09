// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record TerminalUpdateArtifactCandidateQuery(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "projectRef", required = true) java.util.UUID projectRef,
    String queryText,
    String kind,
    String applicationId,
    String runtimeVersion,
    java.util.UUID minimumFullArtifactRef,
    String cursor,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "limit", required = true) Long limit
) {}
