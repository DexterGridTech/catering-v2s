package com.catering.v2s.catalog.application;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;

class CatalogOwnerValueSupportTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void skuPreparationDifferencePreservesMissingNullAndNonArraySemantics() {
        ObjectNode sections = mapper.createObjectNode();
        assertFalse(CatalogOwnerValueSupport.skuPreparationDiffers(sections, null));

        sections.putArray("skus");
        assertFalse(CatalogOwnerValueSupport.skuPreparationDiffers(sections, null));
        sections.withArray("skus").addObject().putNull("effectivePreparation");
        assertFalse(CatalogOwnerValueSupport.skuPreparationDiffers(sections, null));

        ObjectNode itemWithMissingProfile = mapper.createObjectNode();
        assertTrue(CatalogOwnerValueSupport.skuPreparationDiffers(
                sections, itemWithMissingProfile.path("preparationProfile")));

        sections.set("skus", mapper.createObjectNode().put("effectivePreparation", "not-an-array"));
        assertFalse(CatalogOwnerValueSupport.skuPreparationDiffers(sections, null));
    }

    @Test
    void skuPreparationDifferenceDetectsChangedProfile() {
        ObjectNode sections = mapper.createObjectNode();
        sections.putArray("skus").addObject().put("effectivePreparation", "SKU_PROFILE");

        assertTrue(CatalogOwnerValueSupport.skuPreparationDiffers(
                sections, mapper.getNodeFactory().textNode("ITEM_PROFILE")));
    }
}
