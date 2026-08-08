package com.catering.v2s.catalog.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class CatalogOwnerTypesTest {
    @Test
    void usesTheGeneratedSevenShapeSetAndRetainsProducibleAsCapabilityOnly() {
        assertEquals(7, CatalogOwnerTypes.SHAPES.size());
        assertTrue(CatalogOwnerTypes.SHAPES.contains("BENEFIT_SHELL"));
        assertTrue(!CatalogOwnerTypes.SHAPES.contains("PRODUCIBLE"));
        assertTrue(CatalogOwnerTypes.CAPABILITIES.contains("PRODUCIBLE"));
        assertTrue(CatalogOwnerTypes.STATUSES.contains("VOIDED"));
    }
}
