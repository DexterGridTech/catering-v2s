package com.catering.v2s.audit.contract;

import java.util.List;
import java.util.UUID;

/** Read-model value returned by a host-authorized owner task read. */
public record AuditHistoryItem(
        UUID id,
        long occurredAtEpochMillis,
        String actorDisplayName,
        String action,
        AuditTarget target,
        List<AuditChange> changes) {
    public AuditHistoryItem {
        if (id == null
                || occurredAtEpochMillis < 0
                || actorDisplayName == null
                || actorDisplayName.isBlank()
                || action == null
                || action.isBlank()
                || target == null) throw new IllegalArgumentException("audit history item is invalid");
        changes = List.copyOf(changes == null ? List.of() : changes);
    }
}
