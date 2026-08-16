package com.catering.v2s.platform.command;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import org.junit.jupiter.api.Test;

class CatalogTargetCapabilityTest {
    @Test
    void mapsOnlyTheApprovedCatalogOwnerDataNodeTypes() {
        assertEquals("EDIT_HEAD_COMPANY_CATALOG", CatalogTargetCapability.forDataNodeType("HEAD_COMPANY"));
        assertEquals("EDIT_STORE_CATALOG", CatalogTargetCapability.forDataNodeType("STORE"));
        assertNull(CatalogTargetCapability.forDataNodeType("REGION"));
    }
}
