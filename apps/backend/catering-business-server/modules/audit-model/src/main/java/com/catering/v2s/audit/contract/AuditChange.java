package com.catering.v2s.audit.contract;

import java.util.Objects;

/** A closed allowlisted field difference; values are display-safe scalar strings only. */
public record AuditChange(
        String fieldKey,
        String fieldLabelSnapshot,
        AuditValueState beforeState,
        String beforeValue,
        AuditValueState afterState,
        String afterValue) {
    public AuditChange {
        fieldKey = required(fieldKey, 120);
        fieldLabelSnapshot = optional(fieldLabelSnapshot, 120);
        beforeValue = bounded(beforeValue);
        afterValue = bounded(afterValue);
        validateState(beforeState, beforeValue, "before");
        validateState(afterState, afterValue, "after");
    }

    /**
     * Creates a change for a nullable scalar whose lifecycle intentionally maps null before to MISSING and null after
     * to CLEARED. Use the canonical constructor when explicit NULL must be distinguished from MISSING.
     */
    public static AuditChange forNullableScalar(String fieldKey, String beforeValue, String afterValue) {
        return new AuditChange(
                fieldKey,
                null,
                beforeValue == null ? AuditValueState.MISSING : AuditValueState.VALUE,
                beforeValue,
                afterValue == null ? AuditValueState.CLEARED : AuditValueState.VALUE,
                afterValue);
    }

    private static String required(String value, int limit) {
        String normalized = Objects.requireNonNullElse(value, "").trim();
        if (normalized.isEmpty() || normalized.length() > limit)
            throw new IllegalArgumentException("field key is invalid");
        return normalized;
    }

    private static String optional(String value, int limit) {
        if (value == null || value.isBlank()) return null;
        return required(value, limit);
    }

    private static String bounded(String value) {
        if (value == null) return null;
        int limit = 2000;
        if (value.codePointCount(0, value.length()) <= limit) return value;
        String suffix = "…（已截断）";
        int prefixCodePoints = limit - suffix.codePointCount(0, suffix.length());
        int prefixEnd = value.offsetByCodePoints(0, prefixCodePoints);
        return value.substring(0, prefixEnd) + suffix;
    }

    private static void validateState(AuditValueState state, String value, String side) {
        if (state == null) return;
        if (state == AuditValueState.VALUE && value == null)
            throw new IllegalArgumentException(side + " VALUE state requires a value");
        if (state != AuditValueState.VALUE && value != null)
            throw new IllegalArgumentException(side + " non-VALUE state cannot carry a value");
    }
}
