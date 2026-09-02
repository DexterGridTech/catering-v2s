package com.catering.v2s.salesmenu.domain;

import java.util.List;
import java.util.Objects;

/** Client-editable sale definition; Catalog owns and supplies the effective sales unit. */
public record SalesMenuSaleContentInput(
        SalesMenuSaleContentKind kind, Long listedPriceCents, List<SalesMenuSkuPrice> skuPrices) {
    public SalesMenuSaleContentInput {
        Objects.requireNonNull(kind, "kind");
        if (listedPriceCents != null && listedPriceCents < 0) {
            throw new IllegalArgumentException("listedPriceCents cannot be negative");
        }
        skuPrices = List.copyOf(Objects.requireNonNull(skuPrices, "skuPrices"));
    }
}
