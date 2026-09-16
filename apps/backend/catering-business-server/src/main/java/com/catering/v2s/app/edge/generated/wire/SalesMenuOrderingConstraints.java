// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record SalesMenuOrderingConstraints(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "minItemQuantity", required = true) Long minItemQuantity,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "quantityStep", required = true) Long quantityStep
) {}
