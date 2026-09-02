package com.catering.v2s.salesmenu.domain;

import java.util.Objects;
import java.util.UUID;

public record SalesMenuListQuery(SalesMenuScope scope, UUID channelRef, String filter, SalesMenuPageRequest page) {
    public SalesMenuListQuery {
        Objects.requireNonNull(scope, "scope");
        Objects.requireNonNull(channelRef, "channelRef");
        page = Objects.requireNonNull(page, "page");
        if (filter != null && filter.length() > 160) {
            throw new IllegalArgumentException("filter is too long");
        }
    }
}
