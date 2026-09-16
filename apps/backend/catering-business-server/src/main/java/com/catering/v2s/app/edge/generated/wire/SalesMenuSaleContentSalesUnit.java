// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record SalesMenuSaleContentSalesUnit(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "unitRef", required = true) java.util.UUID unitRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "code", required = true) String code,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "name", required = true) String name,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "unitDimension", required = true) String unitDimension,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "precision", required = true) Long precision
) {}
