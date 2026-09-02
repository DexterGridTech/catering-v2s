package com.catering.v2s.salesmenu.domain;

import java.util.Objects;
import java.util.UUID;

/** Query identity bound into the shared opaque cursor; it is never sent as a client-selected sort key. */
public record SalesMenuCursorIdentity(
        String operationId,
        SalesMenuScope scope,
        UUID channelRef,
        UUID salesMenuRef,
        UUID versionRef,
        UUID sectionRef,
        String mode,
        String filter,
        int pageSize) {
    public SalesMenuCursorIdentity {
        operationId = required(operationId, "operationId", 160);
        Objects.requireNonNull(scope, "scope");
        mode = required(mode, "mode", 64);
        if (filter != null && filter.length() > 160) {
            throw new IllegalArgumentException("filter is too long");
        }
        if (pageSize != SalesMenuPolicy.PAGE_SIZE) {
            throw new IllegalArgumentException("pageSize must be 20");
        }
    }

    public String value() {
        return String.join(
                "|",
                operationId,
                scope.workspaceUuid().toString(),
                scope.groupWorkspaceKey(),
                scope.storeRef().toString(),
                String.valueOf(channelRef),
                String.valueOf(salesMenuRef),
                String.valueOf(versionRef),
                String.valueOf(sectionRef),
                mode,
                String.valueOf(filter),
                Integer.toString(pageSize));
    }

    private static String required(String value, String name, int maxLength) {
        String normalized = Objects.requireNonNullElse(value, "").trim();
        if (normalized.isEmpty() || normalized.length() > maxLength) {
            throw new IllegalArgumentException(name + " is invalid");
        }
        return normalized;
    }
}
