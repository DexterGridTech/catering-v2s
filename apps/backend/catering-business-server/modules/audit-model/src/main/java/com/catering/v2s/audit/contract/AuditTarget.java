package com.catering.v2s.audit.contract;

import java.util.Objects;

/** Owner-local entity reference. The edge never infers authorization from this value. */
public record AuditTarget(String entityType, String entityRef) {
    public AuditTarget {
        entityType = required(entityType, "entityType", 64);
        entityRef = required(entityRef, "entityRef", 128);
    }

    private static String required(String value, String name, int limit) {
        String normalized = Objects.requireNonNullElse(value, "").trim();
        if (normalized.isEmpty() || normalized.length() > limit) throw new IllegalArgumentException(name + " is invalid");
        return normalized;
    }
}
