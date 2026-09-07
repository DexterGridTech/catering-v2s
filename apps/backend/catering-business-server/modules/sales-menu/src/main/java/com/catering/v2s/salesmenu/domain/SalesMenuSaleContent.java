package com.catering.v2s.salesmenu.domain;

import java.util.List;
import java.util.Objects;

public record SalesMenuSaleContent(
        SalesMenuSaleContentKind kind,
        Long listedPriceCents,
        List<SalesMenuSkuPrice> skuPrices,
        List<SalesMenuSelectedOrderOption> selectedOrderOptions,
        SalesMenuSalesUnit salesUnit) {
    public SalesMenuSaleContent(
            SalesMenuSaleContentKind kind,
            Long listedPriceCents,
            List<SalesMenuSkuPrice> skuPrices,
            SalesMenuSalesUnit salesUnit) {
        this(kind, listedPriceCents, skuPrices, List.of(), salesUnit);
    }

    public SalesMenuSaleContent {
        Objects.requireNonNull(kind, "kind");
        if (listedPriceCents != null && listedPriceCents < 0) {
            throw new IllegalArgumentException("listedPriceCents cannot be negative");
        }
        skuPrices = List.copyOf(Objects.requireNonNull(skuPrices, "skuPrices"));
        selectedOrderOptions = List.copyOf(Objects.requireNonNull(selectedOrderOptions, "selectedOrderOptions"));
    }
}
