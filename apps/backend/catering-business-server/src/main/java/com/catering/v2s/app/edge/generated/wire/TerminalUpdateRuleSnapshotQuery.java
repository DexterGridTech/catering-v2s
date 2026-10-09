// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record TerminalUpdateRuleSnapshotQuery(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "cursor", required = true) tools.jackson.databind.JsonNode cursor,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "limit", required = true) Long limit,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "collectionHash", required = true) tools.jackson.databind.JsonNode collectionHash
) {}
