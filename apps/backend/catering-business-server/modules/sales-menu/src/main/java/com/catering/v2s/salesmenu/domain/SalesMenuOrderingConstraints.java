package com.catering.v2s.salesmenu.domain;

public record SalesMenuOrderingConstraints(Integer minItemQuantity, Integer quantityStep) {
    public SalesMenuOrderingConstraints {
        if (minItemQuantity != null && minItemQuantity < 1) {
            throw new IllegalArgumentException("minItemQuantity must be positive");
        }
        if (quantityStep != null && quantityStep < 1) {
            throw new IllegalArgumentException("quantityStep must be positive");
        }
    }
}
