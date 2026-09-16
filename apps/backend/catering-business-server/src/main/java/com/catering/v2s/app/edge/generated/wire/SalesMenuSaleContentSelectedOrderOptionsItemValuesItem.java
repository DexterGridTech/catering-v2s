// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record SalesMenuSaleContentSelectedOrderOptionsItemValuesItem(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "definitionValueRef", required = true) java.util.UUID definitionValueRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "name", required = true) String name,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "displayOrder", required = true) Long displayOrder,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "defaultValue", required = true) Boolean defaultValue,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "extraPrice", required = true) Long extraPrice
) {}
