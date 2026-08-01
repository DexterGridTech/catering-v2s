package com.catering.v2s.audit.contract;

import java.util.List;

/** Stable page result; the UI uses its already-present current-page items for detail selection. */
public record AuditHistoryPage(List<AuditHistoryItem> items, long page, long pageSize, long total) {
    public AuditHistoryPage {
        if (page < 1 || pageSize < 1 || pageSize > 100 || total < 0) throw new IllegalArgumentException("audit page is invalid");
        items = List.copyOf(items == null ? List.of() : items);
    }
}
