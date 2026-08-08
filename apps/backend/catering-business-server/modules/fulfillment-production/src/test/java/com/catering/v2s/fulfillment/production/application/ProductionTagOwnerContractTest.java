package com.catering.v2s.fulfillment.production.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.catering.v2s.fulfillment.production.api.ProductionTagOwnerApi;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

class ProductionTagOwnerContractTest {
    private final ObjectMapper mapper = new ObjectMapper();
    @Test
    void productionOwnerRequiresAnIdempotencyKeyAtTheOwnerBoundary() {
        ProductionTagOwnerApi.Problem problem = assertThrows(ProductionTagOwnerApi.Problem.class, () -> ProductionTagOwnerService.requireIdempotencyKey(null));
        org.junit.jupiter.api.Assertions.assertEquals("VALIDATION_ERROR", problem.code());
    }

    @Test
    void productionOwnerNormalizesTheIdempotencyKey() {
        assertEquals("tag-command", ProductionTagOwnerService.requireIdempotencyKey(" tag-command "));
    }

    @Test
    void productionTagKindIsAClosedSixValueSet() throws Exception {
        for (String value : new String[]{"PRODUCTION", "PACKAGE", "LABEL", "HANDOFF", "REVIEW", "OTHER"}) {
            var request = mapper.createObjectNode().put("tagKind", value);
            assertEquals(value, ProductionTagOwnerService.requiredTagKind(request, "tagKind"));
        }
        var invalid = mapper.createObjectNode().put("tagKind", "SPEC");
        ProductionTagOwnerApi.Problem problem = assertThrows(ProductionTagOwnerApi.Problem.class, () -> ProductionTagOwnerService.requiredTagKind(invalid, "tagKind"));
        assertEquals("VALIDATION_ERROR", problem.code());
    }
}
