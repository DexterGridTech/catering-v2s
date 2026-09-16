// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record SalesMenuSaleContentSelectedOrderOptionsItem(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "definitionRef", required = true) java.util.UUID definitionRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "name", required = true) String name,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "selectionMode", required = true) String selectionMode,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "displayOrder", required = true) Long displayOrder,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "required", required = true) Boolean required,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "minSelectionCount", required = true) Long minSelectionCount,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "maxSelectionCount", required = true) Long maxSelectionCount,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "values", required = true) java.util.List<SalesMenuSaleContentSelectedOrderOptionsItemValuesItem> values
) {}
