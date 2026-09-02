package com.catering.v2s.salesmenu.domain;

import java.util.Objects;
import java.util.UUID;

public record SalesMenuItemPageQuery(
        SalesMenuTarget menu,
        SalesMenuVersionKind versionKind,
        UUID sectionRef,
        UUID channelRef,
        SalesMenuPageRequest page) {
    public SalesMenuItemPageQuery {
        Objects.requireNonNull(menu, "menu");
        Objects.requireNonNull(versionKind, "versionKind");
        Objects.requireNonNull(sectionRef, "sectionRef");
        page = Objects.requireNonNull(page, "page");
        if (versionKind == SalesMenuVersionKind.DRAFT && channelRef != null) {
            throw new IllegalArgumentException("draft item pages do not have a channel overlay");
        }
        if (versionKind == SalesMenuVersionKind.PUBLISHED && channelRef == null) {
            throw new IllegalArgumentException("published item pages require a channel");
        }
    }
}
