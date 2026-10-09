// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record TerminalUpdateRulePage(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "items", required = true) java.util.List<TerminalUpdateRuleSummary> items,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "nextCursor", required = true) tools.jackson.databind.JsonNode nextCursor
) {}
