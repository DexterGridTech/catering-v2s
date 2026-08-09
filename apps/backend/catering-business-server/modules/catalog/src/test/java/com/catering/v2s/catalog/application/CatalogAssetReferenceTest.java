package com.catering.v2s.catalog.application;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Set;
import org.junit.jupiter.api.Test;

class CatalogAssetReferenceTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void referenceProtectionIncludesItemImagesAndSkuMediaRefs() throws Exception {
        var sections = mapper.readTree("""
            {
              "images": [{"assetRef":"item-image"}],
              "skus": [
                {"mediaRefs": ["sku-media", {"assetRef":"sku-detail-image"}]},
                {"mediaRefs": ["sku-media"]}
              ]
            }
            """);

        assertEquals(Set.of("item-image", "sku-media", "sku-detail-image"), CatalogOwnerService.catalogAssetRefs(sections));
    }
}
