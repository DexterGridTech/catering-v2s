package com.catering.v2s.audit.contract;

import java.util.Objects;

/** A closed allowlisted field difference; values are display-safe scalar strings only. */
public record AuditChange(String fieldKey, String beforeValue, String afterValue) {
    public AuditChange {
        fieldKey = required(fieldKey, 120);
        beforeValue = bounded(beforeValue);
        afterValue = bounded(afterValue);
    }

    private static String required(String value, int limit) {
        String normalized = Objects.requireNonNullElse(value, "").trim();
        if (normalized.isEmpty() || normalized.length() > limit) throw new IllegalArgumentException("field key is invalid");
        return normalized;
    }
    private static String bounded(String value) {
        if (value != null && value.length() > 2000) throw new IllegalArgumentException("audit display value is too long");
        return value;
    }
}
