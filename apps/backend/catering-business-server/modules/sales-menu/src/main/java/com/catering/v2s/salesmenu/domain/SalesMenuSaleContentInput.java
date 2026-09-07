package com.catering.v2s.salesmenu.domain;

import java.util.List;
import java.util.Objects;

/** Client-editable sale definition; Catalog owns and supplies the effective sales unit. */
public record SalesMenuSaleContentInput(
        SalesMenuSaleContentKind kind,
        Long listedPriceCents,
        List<SalesMenuSkuPrice> skuPrices,
        List<SalesMenuOrderOptionSelectionInput> orderOptionSelections) {
    public SalesMenuSaleContentInput(
            SalesMenuSaleContentKind kind, Long listedPriceCents, List<SalesMenuSkuPrice> skuPrices) {
        this(kind, listedPriceCents, skuPrices, List.of());
    }

    public SalesMenuSaleContentInput {
        Objects.requireNonNull(kind, "kind");
        if (listedPriceCents != null && listedPriceCents < 0) {
            throw new IllegalArgumentException("listedPriceCents cannot be negative");
        }
        skuPrices = List.copyOf(Objects.requireNonNull(skuPrices, "skuPrices"));
        orderOptionSelections = List.copyOf(Objects.requireNonNull(orderOptionSelections, "orderOptionSelections"));
    }
}
