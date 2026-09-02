package com.catering.v2s.salesmenu.domain;

import java.util.Objects;
import java.util.UUID;

public record SalesMenuSkuPrice(
        UUID skuRef, String skuName, String skuCode, long standardPriceCents, long listedPriceCents) {
    public SalesMenuSkuPrice {
        Objects.requireNonNull(skuRef, "skuRef");
        skuName = required(skuName, "skuName", 160);
        skuCode = required(skuCode, "skuCode", 160);
        if (standardPriceCents < 0 || listedPriceCents < 0) {
            throw new IllegalArgumentException("prices cannot be negative");
        }
    }

    private static String required(String value, String name, int maxLength) {
        String normalized = Objects.requireNonNullElse(value, "").trim();
        if (normalized.isEmpty() || normalized.length() > maxLength) {
            throw new IllegalArgumentException(name + " is invalid");
        }
        return normalized;
    }
}
