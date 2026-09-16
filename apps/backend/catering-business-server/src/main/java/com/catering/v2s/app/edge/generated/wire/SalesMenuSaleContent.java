// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record SalesMenuSaleContent(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "kind", required = true) String kind,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "listedPriceCents", required = true) Long listedPriceCents,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "skuPrices", required = true) java.util.List<SalesMenuSkuPrice> skuPrices,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "selectedOrderOptions", required = true) java.util.List<SalesMenuSaleContentSelectedOrderOptionsItem> selectedOrderOptions,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "salesUnit", required = true) SalesMenuSaleContentSalesUnit salesUnit
) {}
