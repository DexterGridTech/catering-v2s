package com.catering.v2s.collaboration.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

class CheckedInCollaborationCatalogSourceTest {
    @Test
    void loadsTheCheckedInCatalogWithoutWorkspaceState() {
        CheckedInCollaborationCatalogSource source = new CheckedInCollaborationCatalogSource(new ObjectMapper());

        assertEquals(4, source.externalSystems().size());
        assertEquals(7, source.providerProfiles().size());
        assertEquals("PLANNED", source.externalSystem("MEITUAN").catalogStatus());
        assertEquals("EXTERNAL_GRANT", source.providerProfile("MEITUAN_ISV_A").authenticationKind());
        assertTrue(source.providerProfile("MEITUAN_ISV_A").businessScope().contains("TAKEAWAY"));
        assertNotNull(source.providerProfile("SHOPPING_MALL_ERP_DEFAULT"));
    }
}
