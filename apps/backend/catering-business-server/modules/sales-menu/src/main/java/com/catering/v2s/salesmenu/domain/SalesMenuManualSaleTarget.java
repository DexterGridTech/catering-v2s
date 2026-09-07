package com.catering.v2s.salesmenu.domain;

import java.util.Objects;
import java.util.UUID;

public record SalesMenuManualSaleTarget(SalesMenuManualSaleTargetKind targetKind, UUID targetRef) {
    public SalesMenuManualSaleTarget {
        Objects.requireNonNull(targetKind, "targetKind");
        Objects.requireNonNull(targetRef, "targetRef");
    }
}
