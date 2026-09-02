package com.catering.v2s.salesmenu.domain;

import java.util.Objects;
import java.util.UUID;

/** The resolved menu-item target passed to the platform-asset owner. */
public record SalesMenuAssetTarget(
        String groupWorkspaceKey,
        UUID storeRef,
        UUID salesMenuRef,
        UUID salesItemRef,
        SalesMenuAssetUsage usage,
        long expectedDraftVersion) {
    public SalesMenuAssetTarget {
        groupWorkspaceKey = required(groupWorkspaceKey);
        Objects.requireNonNull(storeRef, "storeRef");
        Objects.requireNonNull(salesMenuRef, "salesMenuRef");
        Objects.requireNonNull(salesItemRef, "salesItemRef");
        Objects.requireNonNull(usage, "usage");
        if (expectedDraftVersion < 0) {
            throw new IllegalArgumentException("expectedDraftVersion cannot be negative");
        }
    }

    private static String required(String value) {
        String normalized = Objects.requireNonNullElse(value, "").trim();
        if (normalized.isEmpty() || normalized.length() > 128) {
            throw new IllegalArgumentException("groupWorkspaceKey is invalid");
        }
        return normalized;
    }
}
