package com.catering.v2s.catalog.application;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

class CatalogTemporaryPromotionContractTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void keepsFormalCodeValidationClosedAndStable() {
        assertDoesNotThrow(() -> CatalogOwnerService.validateCatalogCode("LATTE-FORMAL-001"));

        CatalogOwnerApi.Problem lowerCase = assertThrows(CatalogOwnerApi.Problem.class,
            () -> CatalogOwnerService.validateCatalogCode("latte-formal-001"));
        assertEquals("VALIDATION_ERROR", lowerCase.code());

        CatalogOwnerApi.Problem tooShort = assertThrows(CatalogOwnerApi.Problem.class,
            () -> CatalogOwnerService.validateCatalogCode("A"));
        assertEquals("VALIDATION_ERROR", tooShort.code());
    }

    @Test
    void projectsOnlyTypedTemporarySourceFacts() {
        var sections = mapper.createObjectNode();
        var externalIdentity = sections.putObject("externalIdentity")
            .put("sourceOrderRef", "EXT-ORDER-001")
            .put("sourceRecordRef", "EXT-RECORD-001")
            .put("sourceItemRef", "EXT-SKU-88")
            .put("rawPayload", "must-not-cross-owner-boundary");
        externalIdentity.putObject("snapshot")
            .put("name", "外部订单临时拿铁")
            .put("specification", "中杯 / 热")
            .put("price", 2800)
            .put("untyped", "ignored");

        JsonNode projected = CatalogOwnerService.externalIdentityFact(mapper, sections);

        assertEquals("EXT-ORDER-001", projected.path("sourceOrderRef").asText());
        assertEquals("EXT-RECORD-001", projected.path("sourceRecordRef").asText());
        assertEquals("EXT-SKU-88", projected.path("sourceItemRef").asText());
        assertEquals("外部订单临时拿铁", projected.path("snapshot").path("name").asText());
        assertEquals(2800, projected.path("snapshot").path("price").asInt());
        org.junit.jupiter.api.Assertions.assertFalse(projected.has("rawPayload"));
        org.junit.jupiter.api.Assertions.assertFalse(projected.path("snapshot").has("untyped"));
    }
}
