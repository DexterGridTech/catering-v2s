// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record TerminalUpdateVersionPageQuery(
    java.util.UUID storeRef,
    String queryText,
    String currentApkVersion,
    String currentJsVersion,
    String runtimeVersion,
    String cursor,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "limit", required = true) Long limit
) {}
