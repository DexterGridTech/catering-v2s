// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record TerminalUpdateRuleStorePageItemsItem(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "storeRef", required = true) java.util.UUID storeRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "name", required = true) tools.jackson.databind.JsonNode name,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "code", required = true) tools.jackson.databind.JsonNode code,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "status", required = true) String status,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "unknownReason", required = true) String unknownReason
) {}
