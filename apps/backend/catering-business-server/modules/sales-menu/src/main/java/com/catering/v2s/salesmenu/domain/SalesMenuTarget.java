package com.catering.v2s.salesmenu.domain;

import java.util.Objects;
import java.util.UUID;

public record SalesMenuTarget(SalesMenuScope scope, UUID salesMenuRef) {
    public SalesMenuTarget {
        Objects.requireNonNull(scope, "scope");
        Objects.requireNonNull(salesMenuRef, "salesMenuRef");
    }
}
