package com.catering.v2s.catalog.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.catering.v2s.catalog.api.CatalogOwnerApi;
import org.junit.jupiter.api.Test;

class CatalogDictionaryKindTest {
    @Test
    void mapsOnlyTheClosedDictionaryVocabulary() {
        assertEquals("CATALOG_TAG", CatalogOwnerService.dictionaryObjectType("TAG"));
        assertEquals("SKU_ATTRIBUTE", CatalogOwnerService.dictionaryObjectType("SKU_ATTRIBUTE"));
        assertEquals("SKU_ATTRIBUTE_VALUE", CatalogOwnerService.dictionaryObjectType("SKU_ATTRIBUTE_VALUE"));
        CatalogOwnerApi.Problem problem =
                assertThrows(CatalogOwnerApi.Problem.class, () -> CatalogOwnerService.dictionaryObjectType("UNIT"));
        assertEquals("VALIDATION_ERROR", problem.code());
        assertEquals(422, problem.status());
    }
}
