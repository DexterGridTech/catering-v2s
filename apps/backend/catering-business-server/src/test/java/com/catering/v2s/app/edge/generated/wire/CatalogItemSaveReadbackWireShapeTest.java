package com.catering.v2s.app.edge.generated.wire;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;

import org.junit.jupiter.api.Test;

class CatalogItemSaveReadbackWireShapeTest {
    @Test
    void emptyInventoryRulesAreAValidSaveReadbackShape() {
        String json = """
                {
                  "revision": "CATALOG_INVENTORY_P1_20260806",
                  "requestId": "request-1",
                  "result": {
                    "inventoryRules": {"nodes": []},
                    "skuTransitions": []
                  }
                }
                """;

        assertDoesNotThrow(() -> new tools.jackson.databind.ObjectMapper().readValue(json, CatalogItemSaveReadback.class));
    }
}
