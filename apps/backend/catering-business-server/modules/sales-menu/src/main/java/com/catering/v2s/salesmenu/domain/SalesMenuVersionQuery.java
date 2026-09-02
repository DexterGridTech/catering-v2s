package com.catering.v2s.salesmenu.domain;

import java.util.Objects;

public record SalesMenuVersionQuery(SalesMenuTarget menu, SalesMenuVersionKind versionKind) {
    public SalesMenuVersionQuery {
        Objects.requireNonNull(menu, "menu");
        Objects.requireNonNull(versionKind, "versionKind");
    }
}
