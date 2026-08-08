package com.catering.v2s.inventory.application;

import static org.junit.jupiter.api.Assertions.assertThrows;

import com.catering.v2s.inventory.api.InventoryOwnerApi;
import org.junit.jupiter.api.Test;

class InventoryOwnerContractTest {
    @Test
    void missingIdempotencyKeyIsRejectedByTheOwnerContract() {
        InventoryOwnerApi.Problem problem = assertThrows(InventoryOwnerApi.Problem.class, () -> InventoryOwnerService.requireIdempotencyKey("  "));
        org.junit.jupiter.api.Assertions.assertEquals("VALIDATION_ERROR", problem.code());
    }

    @Test
    void idempotencyKeyIsNormalizedAtTheOwnerBoundary() {
        org.junit.jupiter.api.Assertions.assertEquals("request-1", InventoryOwnerService.requireIdempotencyKey(" request-1 "));
    }
}
