// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record SalesMenuItemsAddRequest(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "catalogItemRefs", required = true) java.util.List<java.util.UUID> catalogItemRefs,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "expectedVersion", required = true) Long expectedVersion
) {}
