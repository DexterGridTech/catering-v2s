package com.catering.v2s.salesmenu.domain;

import java.util.List;
import java.util.Objects;
import java.util.UUID;

public record SalesMenuSelectedOrderOption(
        UUID definitionRef,
        String name,
        String selectionMode,
        int displayOrder,
        boolean required,
        Integer minSelectionCount,
        Integer maxSelectionCount,
        List<SalesMenuSelectedOrderOptionValue> values) {
    public SalesMenuSelectedOrderOption {
        Objects.requireNonNull(definitionRef, "definitionRef");
        name = required(name, "name", 160);
        selectionMode = required(selectionMode, "selectionMode", 16);
        if (displayOrder < 0) throw new IllegalArgumentException("displayOrder cannot be negative");
        if (minSelectionCount != null && minSelectionCount < 0) {
            throw new IllegalArgumentException("minSelectionCount cannot be negative");
        }
        if (maxSelectionCount != null && maxSelectionCount < 0) {
            throw new IllegalArgumentException("maxSelectionCount cannot be negative");
        }
        if (minSelectionCount != null && maxSelectionCount != null && minSelectionCount > maxSelectionCount) {
            throw new IllegalArgumentException("minSelectionCount cannot exceed maxSelectionCount");
        }
        values = List.copyOf(Objects.requireNonNull(values, "values"));
    }

    private static String required(String value, String field, int maxLength) {
        String normalized = Objects.requireNonNullElse(value, "").trim();
        if (normalized.isEmpty() || normalized.length() > maxLength) {
            throw new IllegalArgumentException(field + " is invalid");
        }
        return normalized;
    }
}
