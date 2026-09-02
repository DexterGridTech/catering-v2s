package com.catering.v2s.salesmenu.domain;

import java.util.List;
import java.util.Objects;

public record SalesMenuSaleContent(
        SalesMenuSaleContentKind kind,
        Long listedPriceCents,
        List<SalesMenuSkuPrice> skuPrices,
        SalesMenuSalesUnit salesUnit) {
    public SalesMenuSaleContent {
        Objects.requireNonNull(kind, "kind");
        if (listedPriceCents != null && listedPriceCents < 0) {
            throw new IllegalArgumentException("listedPriceCents cannot be negative");
        }
        skuPrices = List.copyOf(Objects.requireNonNull(skuPrices, "skuPrices"));
    }
}
