// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record TerminalUpdateRulePageQuery(
    String status,
    String applicationId,
    Long createdFromEpochMillis,
    Long createdToEpochMillis,
    String cursor,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "limit", required = true) Long limit
) {}
