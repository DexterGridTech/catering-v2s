// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record StoreServicePointUpdateRequest(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "name", required = true) String name,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "code", required = true) String code,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "pointType", required = true) StoreServicePointType pointType,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "status", required = true) StoreServicePointStatus status,
    tools.jackson.databind.JsonNode seatCapacity,
    tools.jackson.databind.JsonNode tableShape,
    tools.jackson.databind.JsonNode reservable,
    java.util.UUID imageAssetRef,
    tools.jackson.databind.JsonNode imageBindGrant,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "extensionValues", required = true) tools.jackson.databind.JsonNode extensionValues,
    tools.jackson.databind.JsonNode extensionRuleRevision,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "expectedVersion", required = true) Long expectedVersion
) {}
