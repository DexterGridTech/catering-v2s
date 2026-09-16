// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record OwnerBindingPageMetadata(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "bindingName", required = true) tools.jackson.databind.JsonNode bindingName,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "nodeQueryText", required = true) tools.jackson.databind.JsonNode nodeQueryText,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "sortKey", required = true) String sortKey,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "sortDirection", required = true) String sortDirection,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "page", required = true) Long page,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "pageSize", required = true) Long pageSize,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "total", required = true) Long total
) {}
