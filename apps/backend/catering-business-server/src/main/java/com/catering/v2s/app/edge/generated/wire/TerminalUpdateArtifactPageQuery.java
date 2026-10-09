// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record TerminalUpdateArtifactPageQuery(
    String kind,
    String appId,
    String runtimeVersion,
    String queryText,
    Long minimumFullNativeBuildNumber,
    String minimumFullPublicationId,
    String minimumFullApkSha256,
    String cursor,
    Long limit
) {}
