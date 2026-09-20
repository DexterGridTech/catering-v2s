package com.catering.v2s.audit.contract;

import java.util.List;
import java.util.Objects;
import java.util.UUID;

/** Structured owner-produced audit event; persistence remains owned by the receiving module. */
public record AuditEvent(
        UUID id,
        UUID workspaceUuid,
        String groupWorkspaceKey,
        AuditTarget target,
        AuditActor actor,
        String action,
        long occurredAtEpochMillis,
        List<AuditChange> changes) {
    public AuditEvent {
        if (id == null || workspaceUuid == null || target == null || actor == null || occurredAtEpochMillis < 0)
            throw new IllegalArgumentException("audit event is invalid");
        groupWorkspaceKey = required(groupWorkspaceKey, "groupWorkspaceKey", 128);
        action = required(action, "action", 120);
        changes = List.copyOf(changes == null ? List.of() : changes);
    }

    private static String required(String value, String name, int limit) {
        String normalized = Objects.requireNonNullElse(value, "").trim();
        if (normalized.isEmpty() || normalized.length() > limit)
            throw new IllegalArgumentException(name + " is invalid");
        return normalized;
    }
}
