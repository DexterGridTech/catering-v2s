package com.catering.v2s.salesmenu.domain;

import java.util.Objects;
import java.util.UUID;

/** Structured Catalog-owned sales-unit fact used by weighted sale definitions. */
public record SalesMenuSalesUnit(UUID unitRef, String code, String name, String unitDimension, int precision) {
    public SalesMenuSalesUnit {
        Objects.requireNonNull(unitRef, "unitRef");
        code = required(code, "code");
        name = required(name, "name");
        unitDimension = required(unitDimension, "unitDimension");
        if (precision < 0) throw new IllegalArgumentException("precision cannot be negative");
    }

    private static String required(String value, String name) {
        String normalized = Objects.requireNonNullElse(value, "").trim();
        if (normalized.isEmpty() || normalized.length() > 160) {
            throw new IllegalArgumentException(name + " is invalid");
        }
        return normalized;
    }
}
