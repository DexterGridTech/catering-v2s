package com.catering.v2s.salesmenu.domain;

import java.util.Objects;
import java.util.UUID;

/** The owner scope used by every sales-menu read and command target. */
public record SalesMenuScope(UUID workspaceUuid, String groupWorkspaceKey, UUID storeRef) {
    public SalesMenuScope {
        Objects.requireNonNull(workspaceUuid, "workspaceUuid");
        groupWorkspaceKey = required(groupWorkspaceKey, "groupWorkspaceKey", 128);
        Objects.requireNonNull(storeRef, "storeRef");
    }

    private static String required(String value, String name, int maxLength) {
        String normalized = Objects.requireNonNullElse(value, "").trim();
        if (normalized.isEmpty() || normalized.length() > maxLength) {
            throw new IllegalArgumentException(name + " is invalid");
        }
        return normalized;
    }
}
