package com.catering.v2s.audit.contract;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/** Closed per-entity/action allowlist. Callers must declare a distinct policy for every action. */
public record AuditChangePolicy(String entityType, String action, Set<String> allowedFieldKeys) {
    public AuditChangePolicy {
        entityType = required(entityType, "entityType");
        action = required(action, "action");
        allowedFieldKeys = Set.copyOf(new LinkedHashSet<>(allowedFieldKeys == null ? Set.of() : allowedFieldKeys));
        if (allowedFieldKeys.stream().anyMatch(value -> value == null || value.isBlank())) throw new IllegalArgumentException("audit policy field key is invalid");
    }

    public List<AuditChange> allow(List<AuditChange> candidates) {
        List<AuditChange> values = candidates == null ? List.of() : List.copyOf(candidates);
        if (values.stream().anyMatch(value -> !allowedFieldKeys.contains(value.fieldKey()))) throw new IllegalArgumentException("audit change field is forbidden");
        return values;
    }

    private static String required(String value, String name) {
        String normalized = Objects.requireNonNullElse(value, "").trim();
        if (normalized.isEmpty()) throw new IllegalArgumentException(name + " is invalid");
        return normalized;
    }
}
