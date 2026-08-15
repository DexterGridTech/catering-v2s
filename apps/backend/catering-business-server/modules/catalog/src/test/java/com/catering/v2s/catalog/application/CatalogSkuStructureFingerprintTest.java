package com.catering.v2s.catalog.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

class CatalogSkuStructureFingerprintTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void sortsSkuCodesAndAttributePairsIntoAStableCompatibilityBit() throws Exception {
        var first = mapper.readTree("{\"skus\":[{\"code\":\"SKU-B\",\"attributeValues\":{\"SIZE\":\"LARGE\",\"COLOR\":\"RED\"}},{\"code\":\"SKU-A\",\"attributeValues\":{\"SIZE\":\"SMALL\"}}]}");
        var reordered = mapper.readTree("{\"skus\":[{\"code\":\"SKU-A\",\"attributeValues\":{\"SIZE\":\"SMALL\"}},{\"code\":\"SKU-B\",\"attributeValues\":{\"COLOR\":\"RED\",\"SIZE\":\"LARGE\"}}]}");
        var changed = mapper.readTree("{\"skus\":[{\"code\":\"SKU-A\",\"attributeValues\":{\"SIZE\":\"MEDIUM\"}},{\"code\":\"SKU-B\",\"attributeValues\":{\"COLOR\":\"RED\",\"SIZE\":\"LARGE\"}}]}");

        assertEquals(CatalogOwnerService.skuStructureFingerprint(first), CatalogOwnerService.skuStructureFingerprint(reordered));
        assertNotEquals(CatalogOwnerService.skuStructureFingerprint(first), CatalogOwnerService.skuStructureFingerprint(changed));
    }

    @Test
    void includesTypedAttributeValueReferencesInTheCompatibilityBit() throws Exception {
        var first = mapper.readTree("{\"skus\":[{\"skuCode\":\"SKU-001\",\"attributeValueRefs\":[{\"attributeCode\":\"SIZE\",\"valueCode\":\"SMALL\"}]}]}");
        var reordered = mapper.readTree("{\"skus\":[{\"skuCode\":\"SKU-001\",\"attributeValueRefs\":[{\"valueCode\":\"SMALL\",\"attributeCode\":\"SIZE\"}]}]}");
        var changed = mapper.readTree("{\"skus\":[{\"skuCode\":\"SKU-001\",\"attributeValueRefs\":[{\"attributeCode\":\"SIZE\",\"valueCode\":\"LARGE\"}]}]}");

        assertEquals(CatalogOwnerService.skuStructureFingerprint(first), CatalogOwnerService.skuStructureFingerprint(reordered));
        assertNotEquals(CatalogOwnerService.skuStructureFingerprint(first), CatalogOwnerService.skuStructureFingerprint(changed));
    }

    @Test
    void prefersCanonicalSkuCodeWhenLegacyCodeIsAlsoPresent() throws Exception {
        var canonical = mapper.readTree("{\"skus\":[{\"skuCode\":\"SKU-CANONICAL\",\"attributeValueRefs\":[{\"attributeCode\":\"SIZE\",\"valueCode\":\"SMALL\"}]}]}");
        var conflictingAliases = mapper.readTree("{\"skus\":[{\"code\":\"legacy-code\",\"skuCode\":\"SKU-CANONICAL\",\"attributeValueRefs\":[{\"attributeCode\":\"SIZE\",\"valueCode\":\"SMALL\"}]}]}");

        assertEquals(CatalogOwnerService.skuStructureFingerprint(canonical), CatalogOwnerService.skuStructureFingerprint(conflictingAliases));
    }
}
