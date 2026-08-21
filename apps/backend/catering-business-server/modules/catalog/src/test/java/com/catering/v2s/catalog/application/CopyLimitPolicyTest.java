package com.catering.v2s.catalog.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import java.util.Set;
import org.junit.jupiter.api.Test;

class CopyLimitPolicyTest {
    @Test
    void loadsTheSingleRuntimeDeclarationPoint() {
        CopyLimitPolicy policy = CopyLimitPolicy.load(new ObjectMapper());
        assertEquals(true, policy.selectedItemCount() > 0);
        assertEquals(true, policy.closureItemCount() >= policy.selectedItemCount());
        assertEquals(
                Set.of("TAG", "SKU_ATTRIBUTE", "SKU_ATTRIBUTE_VALUE", "ORDER_OPTION_VALUE"), policy.dictionaryKinds());
        assertEquals(false, policy.allowsDictionaryKind("SALES_UNIT"));
        assertEquals(false, policy.allowsDictionaryKind("SPEC"));
    }

    @Test
    void preservesTypedClosureRelationsForCopyPlanning() {
        assertEquals("CATALOG_ITEM", CatalogOwnerService.copyReferenceObjectType("COMPOSITE_COMPONENT"));
        assertEquals("CATALOG_ITEM", CatalogOwnerService.copyReferenceObjectType("BOM_COMPONENT"));
        assertTrue(CatalogOwnerService.expandsCatalogItemClosure("COMPOSITE_COMPONENT"));
        assertTrue(CatalogOwnerService.expandsCatalogItemClosure("BOM_COMPONENT"));
        assertFalse(CatalogOwnerService.expandsCatalogItemClosure("CATEGORY"));
    }

    @Test
    void rejectsUnknownAndDuplicateLocalCopySectionsBeforeEitherPhaseCanProceed() {
        ObjectMapper mapper = new ObjectMapper();
        ArrayNode valid = mapper.createArrayNode().add("BASIC_INFO").add("ORDER_OPTIONS");
        assertEquals(
                Set.of("BASIC_INFO", "ORDER_OPTIONS"),
                Set.copyOf(CatalogOwnerService.validatedLocalCopySections(valid)));

        CatalogOwnerApi.Problem unknown = org.junit.jupiter.api.Assertions.assertThrows(
                CatalogOwnerApi.Problem.class,
                () -> CatalogOwnerService.validatedLocalCopySections(
                        mapper.createArrayNode().add("UNKNOWN_SECTION")));
        assertEquals("VALIDATION_ERROR", unknown.code());
        assertEquals("selectedSections contains an unknown section", unknown.getMessage());

        CatalogOwnerApi.Problem retired = org.junit.jupiter.api.Assertions.assertThrows(
                CatalogOwnerApi.Problem.class,
                () -> CatalogOwnerService.validatedLocalCopySections(
                        mapper.createArrayNode().add("PRINT_NAME")));
        assertEquals("VALIDATION_ERROR", retired.code());
        assertEquals("selectedSections contains an unknown section", retired.getMessage());

        CatalogOwnerApi.Problem duplicate = org.junit.jupiter.api.Assertions.assertThrows(
                CatalogOwnerApi.Problem.class,
                () -> CatalogOwnerService.validatedLocalCopySections(
                        mapper.createArrayNode().add("BASIC_INFO").add("BASIC_INFO")));
        assertEquals("VALIDATION_ERROR", duplicate.code());
        assertEquals("selectedSections contains duplicate section", duplicate.getMessage());
    }
}
