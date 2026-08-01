package com.catering.v2s.audit.contract;

import java.util.Objects;
import java.util.UUID;

/** Immutable command-time actor snapshot; it never carries a credential or login identifier. */
public record AuditActor(String actorType, UUID actorId, String displaySnapshot) {
    public AuditActor {
        actorType = required(actorType, "actorType", 48);
        displaySnapshot = required(displaySnapshot, "displaySnapshot", 160);
        if ("SYSTEM".equals(actorType)) {
            if (actorId != null) throw new IllegalArgumentException("system actor id is forbidden");
        } else if (actorId == null) {
            throw new IllegalArgumentException("non-system actor id is required");
        }
    }

    public static AuditActor system() { return new AuditActor("SYSTEM", null, "系统"); }

    private static String required(String value, String name, int limit) {
        String normalized = Objects.requireNonNullElse(value, "").trim();
        if (normalized.isEmpty() || normalized.length() > limit) throw new IllegalArgumentException(name + " is invalid");
        return normalized;
    }
}
