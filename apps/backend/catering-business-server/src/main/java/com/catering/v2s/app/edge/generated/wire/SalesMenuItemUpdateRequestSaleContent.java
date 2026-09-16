// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record SalesMenuItemUpdateRequestSaleContent(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "kind", required = true) String kind,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "listedPriceCents", required = true) Long listedPriceCents,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "skuPrices", required = true) java.util.List<SalesMenuSkuPrice> skuPrices,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "orderOptionSelections", required = true) java.util.List<SalesMenuItemUpdateRequestSaleContentOrderOptionSelectionsItem> orderOptionSelections
) {}
