package com.catering.v2s.salesmenu.domain;

import java.util.Objects;
import java.util.UUID;

public record SalesMenuOperationQuery(SalesMenuTarget menu, UUID channelRef, SalesMenuPageRequest page) {
    public SalesMenuOperationQuery {
        Objects.requireNonNull(menu, "menu");
        Objects.requireNonNull(channelRef, "channelRef");
        page = Objects.requireNonNull(page, "page");
    }
}
