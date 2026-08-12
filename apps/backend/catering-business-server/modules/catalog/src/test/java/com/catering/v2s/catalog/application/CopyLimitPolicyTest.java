package com.catering.v2s.catalog.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Set;
import org.junit.jupiter.api.Test;

class CopyLimitPolicyTest {
    @Test
    void loadsTheSingleRuntimeDeclarationPoint() {
        CopyLimitPolicy policy = CopyLimitPolicy.load(new ObjectMapper());
        assertEquals(true, policy.selectedItemCount() > 0);
        assertEquals(true, policy.closureItemCount() >= policy.selectedItemCount());
        assertEquals(Set.of("TAG", "SALES_UNIT", "SKU_ATTRIBUTE", "SKU_ATTRIBUTE_VALUE"), policy.dictionaryKinds());
        assertEquals(true, policy.allowsDictionaryKind("SALES_UNIT"));
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
}
