package com.catering.v2s.organization.api;

import com.catering.v2s.organization.domain.generated.StoreOperatingRuleCatalog.Values;
import java.util.Objects;
import java.util.UUID;

/** Organization-owner readback for the closed Store operating-rule catalog. */
public record StoreOperatingRuleReadback(UUID storeId, Values values) {
    public StoreOperatingRuleReadback {
        storeId = Objects.requireNonNull(storeId, "storeId");
        values = Objects.requireNonNull(values, "values");
    }
}
