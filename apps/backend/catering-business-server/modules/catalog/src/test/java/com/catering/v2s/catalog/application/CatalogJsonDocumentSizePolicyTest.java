package com.catering.v2s.catalog.application;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import org.junit.jupiter.api.Test;

class CatalogJsonDocumentSizePolicyTest {
    @Test
    void acceptsTheBoundaryAndReportsUtf8BytesAndOverflowWithoutTruncating() {
        String boundary = "x".repeat(CatalogJsonDocumentSizePolicy.MAX_BYTES);
        assertDoesNotThrow(() -> CatalogJsonDocumentSizePolicy.requireWithin("attributes", boundary));

        String over = "中".repeat(CatalogJsonDocumentSizePolicy.MAX_BYTES / 3 + 1);
        CatalogOwnerApi.Problem failure = assertThrows(
                CatalogOwnerApi.Problem.class, () -> CatalogJsonDocumentSizePolicy.requireWithin("attributes", over));
        int actualBytes = over.getBytes(java.nio.charset.StandardCharsets.UTF_8).length;
        assertEquals("VALIDATION_ERROR", failure.code());
        assertEquals(422, failure.status());
        org.junit.jupiter.api.Assertions.assertTrue(failure.getMessage().contains("attributes"));
        org.junit.jupiter.api.Assertions.assertTrue(failure.getMessage().contains("actual=" + actualBytes));
        org.junit.jupiter.api.Assertions.assertTrue(
                failure.getMessage().contains("by " + (actualBytes - CatalogJsonDocumentSizePolicy.MAX_BYTES)));
    }

    @Test
    void validatesTheTypedPreparationProfileWithItsOwnFieldName() {
        ObjectMapper mapper = new ObjectMapper();
        ObjectNode request = mapper.createObjectNode();
        request.putObject("sections")
                .putObject("catalogDraft")
                .putObject("preparationProfile")
                .put("preparationNotes", "x".repeat(CatalogJsonDocumentSizePolicy.MAX_BYTES + 1));

        CatalogOwnerApi.Problem failure = assertThrows(
                CatalogOwnerApi.Problem.class, () -> CatalogJsonDocumentSizePolicy.validateCatalogDraft(request));
        assertTrue(failure.getMessage().contains("sections.catalogDraft.preparationProfile"));
    }

    @Test
    void coordinatorPreservesFieldSpecificSizeProblemAtTheCompositionBoundary() {
        ObjectMapper mapper = new ObjectMapper();
        ObjectNode request = mapper.createObjectNode();
        request.putObject("sections")
                .putObject("catalogDraft")
                .putObject("preparationProfile")
                .put("preparationNotes", "x".repeat(CatalogJsonDocumentSizePolicy.MAX_BYTES + 1));
        CatalogInventoryCoordinator coordinator =
                new CatalogInventoryCoordinator(null, null, null, null, mapper, null, null);

        CatalogOwnerApi.Problem failure = assertThrows(
                CatalogOwnerApi.Problem.class,
                () -> coordinator.saveCatalogItem(
                        null,
                        new CatalogOwnerApi.CatalogItemSaveCommand("ITEM-001", request.toString()),
                        List.of(),
                        "idempotency-key-001"));

        assertTrue(failure.getMessage().contains("sections.catalogDraft.preparationProfile"));
        assertTrue(failure.getMessage().contains("actual="));
        assertTrue(failure.getMessage().contains("by "));
    }
}
