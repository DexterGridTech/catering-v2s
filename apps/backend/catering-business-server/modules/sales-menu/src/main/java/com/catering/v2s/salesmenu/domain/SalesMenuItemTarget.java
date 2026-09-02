package com.catering.v2s.salesmenu.domain;

import java.util.Objects;
import java.util.UUID;

public record SalesMenuItemTarget(SalesMenuTarget menu, UUID salesItemRef) {
    public SalesMenuItemTarget {
        Objects.requireNonNull(menu, "menu");
        Objects.requireNonNull(salesItemRef, "salesItemRef");
    }
}
