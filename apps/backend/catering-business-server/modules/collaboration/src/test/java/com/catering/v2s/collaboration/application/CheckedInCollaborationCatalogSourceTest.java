package com.catering.v2s.collaboration.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.junit.jupiter.api.Test;

class CheckedInCollaborationCatalogSourceTest {
    @Test
    void loadsTheCheckedInCatalogWithoutWorkspaceState() {
        CheckedInCollaborationCatalogSource source = new CheckedInCollaborationCatalogSource(new ObjectMapper());

        assertEquals(5, source.externalSystems().size());
        assertEquals(8, source.providerProfiles().size());
        assertEquals("PLANNED", source.externalSystem("MEITUAN").catalogStatus());
        assertEquals("EXTERNAL_GRANT", source.providerProfile("MEITUAN_ISV_A").authenticationKind());
        assertTrue(source.providerProfile("MEITUAN_ISV_A").businessScope().contains("TAKEAWAY"));
        assertEquals(
                "PLANNED", source.externalSystem("STORE_OWNED_MINI_PROGRAM").catalogStatus());
        assertTrue(source.externalSystem("STORE_OWNED_MINI_PROGRAM").capabilities().stream()
                .anyMatch(capability -> capability.capabilityClass().equals("DINE_IN")));
        assertEquals(
                List.of("DINE_IN"),
                source.providerProfile("STORE_OWNED_MINI_PROGRAM_DINE_IN").businessScope());
        assertEquals(
                List.of("STORE"),
                source.providerProfile("STORE_OWNED_MINI_PROGRAM_DINE_IN").bindableNodeTypes());
        assertNotNull(source.providerProfile("SHOPPING_MALL_ERP_DEFAULT"));
    }
}
