package com.catering.v2s.salesmenu.domain;

import java.util.Objects;
import java.util.UUID;

public record SalesMenuItemQuery(SalesMenuItemTarget item, SalesMenuVersionKind versionKind, UUID channelRef) {
    public SalesMenuItemQuery {
        Objects.requireNonNull(item, "item");
        Objects.requireNonNull(versionKind, "versionKind");
        if (versionKind == SalesMenuVersionKind.DRAFT && channelRef != null) {
            throw new IllegalArgumentException("draft item reads do not have a channel overlay");
        }
        if (versionKind == SalesMenuVersionKind.PUBLISHED && channelRef == null) {
            throw new IllegalArgumentException("published item reads require a channel");
        }
    }
}
