// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record TerminalUpdateRuleSnapshotPage(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "items", required = true) java.util.List<TerminalUpdateRuleSnapshotItem> items,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "collectionHash", required = true) String collectionHash,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "nextCursor", required = true) tools.jackson.databind.JsonNode nextCursor
) {}
