package com.catering.v2s.fulfillment.production.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.catering.v2s.fulfillment.production.api.ProductionTagOwnerApi;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.Test;

class ProductionTagOwnerContractTest {
    @Test
    void productionOwnerRequiresAnIdempotencyKeyAtTheOwnerBoundary() {
        ProductionTagOwnerApi.Problem problem = assertThrows(
                ProductionTagOwnerApi.Problem.class, () -> ProductionTagOwnerService.requireIdempotencyKey(null));
        org.junit.jupiter.api.Assertions.assertEquals("VALIDATION_ERROR", problem.code());
    }

    @Test
    void productionOwnerNormalizesTheIdempotencyKey() {
        assertEquals("tag-command", ProductionTagOwnerService.requireIdempotencyKey(" tag-command "));
    }

    @Test
    void productionTagCommandHasOnlyTheApprovedBusinessFacts() {
        List<String> fields = Arrays.stream(ProductionTagOwnerApi.CreateTagCommand.class.getRecordComponents())
                .map(component -> component.getName())
                .toList();
        assertEquals(List.of("code", "name"), fields);
    }
}
