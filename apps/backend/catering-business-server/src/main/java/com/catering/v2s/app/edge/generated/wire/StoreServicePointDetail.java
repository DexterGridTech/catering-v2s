// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record StoreServicePointDetail(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "pointRef", required = true) java.util.UUID pointRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "storeRef", required = true) java.util.UUID storeRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "areaRef", required = true) java.util.UUID areaRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "name", required = true) String name,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "code", required = true) String code,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "pointType", required = true) StoreServicePointType pointType,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "status", required = true) StoreServicePointStatus status,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "displayOrder", required = true) Long displayOrder,
    tools.jackson.databind.JsonNode seatCapacity,
    tools.jackson.databind.JsonNode tableShape,
    tools.jackson.databind.JsonNode reservable,
    java.util.UUID imageAssetRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "extensionValues", required = true) tools.jackson.databind.JsonNode extensionValues,
    tools.jackson.databind.JsonNode extensionRuleRevision,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "effectiveAvailable", required = true) Boolean effectiveAvailable,
    tools.jackson.databind.JsonNode qrUrl,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "version", required = true) Long version,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "createdAt", required = true) Long createdAt,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "updatedAt", required = true) Long updatedAt,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "canMoveUp", required = true) Boolean canMoveUp,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "canMoveDown", required = true) Boolean canMoveDown
) {}
