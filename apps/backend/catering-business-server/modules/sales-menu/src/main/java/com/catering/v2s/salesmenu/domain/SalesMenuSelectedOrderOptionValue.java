package com.catering.v2s.salesmenu.domain;

import java.util.Objects;
import java.util.UUID;

public record SalesMenuSelectedOrderOptionValue(
        UUID definitionValueRef, String name, int displayOrder, boolean defaultValue, Long extraPrice) {
    public SalesMenuSelectedOrderOptionValue {
        Objects.requireNonNull(definitionValueRef, "definitionValueRef");
        name = required(name, "name", 160);
        if (displayOrder < 0) throw new IllegalArgumentException("displayOrder cannot be negative");
    }

    private static String required(String value, String field, int maxLength) {
        String normalized = Objects.requireNonNullElse(value, "").trim();
        if (normalized.isEmpty() || normalized.length() > maxLength) {
            throw new IllegalArgumentException(field + " is invalid");
        }
        return normalized;
    }
}
