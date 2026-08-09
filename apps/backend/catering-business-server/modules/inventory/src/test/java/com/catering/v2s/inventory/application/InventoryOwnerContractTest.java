package com.catering.v2s.inventory.application;

import static org.junit.jupiter.api.Assertions.assertThrows;

import com.catering.v2s.inventory.api.InventoryOwnerApi;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class InventoryOwnerContractTest {
    private final ObjectMapper mapper = new ObjectMapper();
    @Test
    void missingIdempotencyKeyIsRejectedByTheOwnerContract() {
        InventoryOwnerApi.Problem problem = assertThrows(InventoryOwnerApi.Problem.class, () -> InventoryOwnerService.requireIdempotencyKey("  "));
        org.junit.jupiter.api.Assertions.assertEquals("VALIDATION_ERROR", problem.code());
    }

    @Test
    void idempotencyKeyIsNormalizedAtTheOwnerBoundary() {
        org.junit.jupiter.api.Assertions.assertEquals("request-1", InventoryOwnerService.requireIdempotencyKey(" request-1 "));
    }

    @Test
    void opaqueCatalogReferencesRejectBusinessCodesAndAcceptUuids() {
        var request = mapper.createObjectNode().put("itemRef", "ITEM-001");
        InventoryOwnerApi.Problem failure = assertThrows(InventoryOwnerApi.Problem.class,
            () -> InventoryOwnerService.requiredOpaqueRef(request, "itemRef"));
        org.junit.jupiter.api.Assertions.assertEquals("REFERENCE_MAPPING_UNRESOLVED", failure.code());

        UUID itemRef = UUID.randomUUID();
        request.put("itemRef", itemRef.toString());
        org.junit.jupiter.api.Assertions.assertEquals(itemRef, InventoryOwnerService.requiredOpaqueRef(request, "itemRef"));
    }
}
