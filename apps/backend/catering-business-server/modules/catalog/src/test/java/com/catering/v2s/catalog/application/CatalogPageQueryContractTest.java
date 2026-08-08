package com.catering.v2s.catalog.application;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

class CatalogPageQueryContractTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void acceptsTheFrozenFilterAndCursorVocabulary() {
        var query = mapper.createObjectNode()
            .put("keyword", "latte")
            .put("smartViewKey", "AUTO_SYNC")
            .put("shapeKey", "STANDARD_SALE_COUNTED")
            .put("categoryRef", "DRINK")
            .put("includeSubCategories", true)
            .put("status", "ENABLED")
            .put("governanceStatus", "GOVERNANCE_TODO")
            .put("source", "AUTO_SYNC")
            .put("cursor", "20")
            .put("pageSize", 50)
            .put("queryGeneration", "{\"scopeRef\":\"STORE-01\",\"query\":{\"keyword\":\"latte\"}}" );

        assertDoesNotThrow(() -> CatalogOwnerService.validateItemPageQuery(query));
    }

    @Test
    void rejectsUnknownOrMalformedPageFields() {
        var unknown = mapper.createObjectNode().put("ignoredFilter", "x");
        CatalogOwnerApi.Problem unknownProblem = assertThrows(CatalogOwnerApi.Problem.class,
            () -> CatalogOwnerService.validateItemPageQuery(unknown));
        assertEquals("VALIDATION_ERROR", unknownProblem.code());

        var malformed = mapper.createObjectNode().put("smartViewKey", "NOT_A_VIEW");
        CatalogOwnerApi.Problem malformedProblem = assertThrows(CatalogOwnerApi.Problem.class,
            () -> CatalogOwnerService.validateItemPageQuery(malformed));
        assertEquals("VALIDATION_ERROR", malformedProblem.code());
    }
}
