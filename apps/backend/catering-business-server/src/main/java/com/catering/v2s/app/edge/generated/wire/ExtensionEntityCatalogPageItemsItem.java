// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record ExtensionEntityCatalogPageItemsItem(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "entityType", required = true) ExtensionEntityType entityType,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "displayName", required = true) String displayName,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "configuredFieldCount", required = true) Long configuredFieldCount,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "updatedAt", required = true) Long updatedAt
) {}
