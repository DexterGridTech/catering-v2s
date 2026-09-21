package com.catering.v2s.catalog.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.catering.v2s.catalog.api.CatalogProductionTagOwnerApi;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.Test;

class ProductionTagOwnerContractTest {
    @Test
    void productionOwnerRequiresAnIdempotencyKeyAtTheOwnerBoundary() {
        CatalogProductionTagOwnerApi.Problem problem = assertThrows(
                CatalogProductionTagOwnerApi.Problem.class,
                () -> CatalogProductionTagOwnerService.requireIdempotencyKey(null));
        org.junit.jupiter.api.Assertions.assertEquals("VALIDATION_ERROR", problem.code());
    }

    @Test
    void productionOwnerNormalizesTheIdempotencyKey() {
        assertEquals("tag-command", CatalogProductionTagOwnerService.requireIdempotencyKey(" tag-command "));
    }

    @Test
    void productionTagCommandHasOnlyTheApprovedBusinessFacts() {
        List<String> fields = Arrays.stream(CatalogProductionTagOwnerApi.CreateTagCommand.class.getRecordComponents())
                .map(component -> component.getName())
                .toList();
        assertEquals(List.of("code", "name"), fields);
    }
}
