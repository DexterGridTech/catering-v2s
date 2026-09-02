package com.catering.v2s.salesmenu.domain;

import java.util.Objects;
import java.util.UUID;

/** Stable sales-menu identity and the two version pointers owned by the collection aggregate. */
public record SalesMenuAggregate(
        UUID salesMenuRef,
        SalesMenuScope scope,
        String name,
        boolean archived,
        long version,
        long draftRevision,
        Long latestPublishedRevision,
        Long latestPublishedSourceDraftRevision,
        SalesMenuSchedule draftSchedule,
        SalesMenuSchedule latestPublishedSchedule) {
    public SalesMenuAggregate {
        Objects.requireNonNull(salesMenuRef, "salesMenuRef");
        Objects.requireNonNull(scope, "scope");
        name = required(name);
        if (version < 1
                || draftRevision < 0
                || (latestPublishedRevision != null && latestPublishedRevision < 0)
                || (latestPublishedSourceDraftRevision != null && latestPublishedSourceDraftRevision < 0)) {
            throw new IllegalArgumentException("sales-menu version facts are invalid");
        }
        Objects.requireNonNull(draftSchedule, "draftSchedule");
    }

    public boolean draftDirty() {
        return latestPublishedSourceDraftRevision == null || draftRevision != latestPublishedSourceDraftRevision;
    }

    private static String required(String value) {
        String normalized = Objects.requireNonNullElse(value, "").trim();
        if (normalized.isEmpty() || normalized.length() > 160) {
            throw new IllegalArgumentException("name is invalid");
        }
        return normalized;
    }
}
