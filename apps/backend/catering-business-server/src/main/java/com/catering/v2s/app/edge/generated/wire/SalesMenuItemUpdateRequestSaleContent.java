// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record SalesMenuItemUpdateRequestSaleContent(
    String kind,
    Long listedPriceCents,
    java.util.List<SalesMenuSkuPrice> skuPrices,
    java.util.List<SalesMenuItemUpdateRequestSaleContentOrderOptionSelectionsItem> orderOptionSelections
) {}
