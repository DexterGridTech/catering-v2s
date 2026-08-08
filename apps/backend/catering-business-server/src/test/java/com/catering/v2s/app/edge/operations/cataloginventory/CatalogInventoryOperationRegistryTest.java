package com.catering.v2s.app.edge.operations.cataloginventory;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.catering.v2s.contracts.generated.cataloginventory.CatalogInventoryEdgeWire;
import org.junit.jupiter.api.Test;

class CatalogInventoryOperationRegistryTest {
    @Test
    void everyGeneratedOperationResolvesItsConcretePath() {
        CatalogInventoryOperationRegistry registry = new CatalogInventoryOperationRegistry();
        for (CatalogInventoryEdgeWire.Operation operation : CatalogInventoryEdgeWire.OPERATIONS) {
            String concretePath = operation.path().replaceAll("\\{[^}]+}", "fixture");
            assertEquals(operation.operationId(), registry.resolve(operation.method(), concretePath));
            assertEquals(operation.operationId(), registry.resolve(operation.method(), "/api" + concretePath));
        }
    }

    @Test
    void unknownMethodAndPathAreRejected() {
        assertThrows(RuntimeException.class, () -> new CatalogInventoryOperationRegistry().resolve("DELETE", "/operations/catalog-inventory/items/fixture"));
    }
}
