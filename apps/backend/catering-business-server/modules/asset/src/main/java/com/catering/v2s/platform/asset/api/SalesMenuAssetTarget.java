package com.catering.v2s.platform.asset.api;

import java.util.Objects;
import java.util.UUID;

/** Server-owned, fully resolved target supplied by the sales-menu owner. */
public record SalesMenuAssetTarget(
        UUID workspaceUuid,
        String groupWorkspaceKey,
        UUID storeRef,
        UUID salesMenuRef,
        UUID salesItemRef,
        SalesMenuAssetUsage usage,
        long expectedDraftVersion) {
    public SalesMenuAssetTarget {
        Objects.requireNonNull(workspaceUuid, "workspaceUuid");
        groupWorkspaceKey = required(groupWorkspaceKey, "groupWorkspaceKey", 128);
        Objects.requireNonNull(storeRef, "storeRef");
        Objects.requireNonNull(salesMenuRef, "salesMenuRef");
        Objects.requireNonNull(salesItemRef, "salesItemRef");
        Objects.requireNonNull(usage, "usage");
        if (expectedDraftVersion < 0) {
            throw new IllegalArgumentException("expectedDraftVersion cannot be negative");
        }
    }

    private static String required(String value, String name, int maxLength) {
        String normalized = Objects.requireNonNullElse(value, "").trim();
        if (normalized.isEmpty() || normalized.length() > maxLength) {
            throw new IllegalArgumentException(name + " is invalid");
        }
        return normalized;
    }
}
