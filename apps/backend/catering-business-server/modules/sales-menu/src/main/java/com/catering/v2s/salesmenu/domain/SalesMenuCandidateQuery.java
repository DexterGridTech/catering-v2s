package com.catering.v2s.salesmenu.domain;

import java.util.Objects;
import java.util.UUID;

public record SalesMenuCandidateQuery(
        SalesMenuTarget menu, UUID categoryRef, String filter, SalesMenuPageRequest page) {
    public SalesMenuCandidateQuery {
        Objects.requireNonNull(menu, "menu");
        page = Objects.requireNonNull(page, "page");
        if (filter != null && filter.length() > 160) {
            throw new IllegalArgumentException("filter is too long");
        }
    }
}
