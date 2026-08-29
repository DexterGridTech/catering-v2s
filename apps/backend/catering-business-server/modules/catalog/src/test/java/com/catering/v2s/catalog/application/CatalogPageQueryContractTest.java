package com.catering.v2s.catalog.application;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.junit.jupiter.api.Test;

class CatalogPageQueryContractTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void acceptsTheSupportedFilterAndCursorVocabulary() {
        var query = mapper.createObjectNode()
                .put("keyword", "latte")
                .put("smartViewKey", "AUTO_SYNC")
                .put("shapeKey", "STANDARD_SALE_COUNTED")
                .put("categoryRef", "DRINK")
                .put("includeSubCategories", true)
                .put("status", "ENABLED")
                .put("source", "AUTO_SYNC")
                .put("cursor", "20")
                .put("pageSize", 50)
                .put("queryGeneration", "{\"scopeRef\":\"STORE-01\",\"query\":{\"keyword\":\"latte\"}}");

        assertDoesNotThrow(() -> CatalogOwnerService.validateItemPageQuery(query));
    }

    @Test
    void rejectsRetiredOrMalformedPageFields() {
        var unknown = mapper.createObjectNode().put("ignoredFilter", "x");
        CatalogOwnerApi.Problem unknownProblem =
                assertThrows(CatalogOwnerApi.Problem.class, () -> CatalogOwnerService.validateItemPageQuery(unknown));
        assertEquals("VALIDATION_ERROR", unknownProblem.code());

        var retiredGovernanceStatus = mapper.createObjectNode().put("governanceStatus", "GOVERNANCE_TODO");
        CatalogOwnerApi.Problem retiredGovernanceStatusProblem = assertThrows(
                CatalogOwnerApi.Problem.class,
                () -> CatalogOwnerService.validateItemPageQuery(retiredGovernanceStatus));
        assertEquals("VALIDATION_ERROR", retiredGovernanceStatusProblem.code());

        var malformed = mapper.createObjectNode().put("smartViewKey", "NOT_A_VIEW");
        CatalogOwnerApi.Problem malformedProblem =
                assertThrows(CatalogOwnerApi.Problem.class, () -> CatalogOwnerService.validateItemPageQuery(malformed));
        assertEquals("VALIDATION_ERROR", malformedProblem.code());

        var retiredGovernanceView = mapper.createObjectNode().put("smartViewKey", "GOVERNANCE_PENDING");
        CatalogOwnerApi.Problem retiredGovernanceViewProblem = assertThrows(
                CatalogOwnerApi.Problem.class, () -> CatalogOwnerService.validateItemPageQuery(retiredGovernanceView));
        assertEquals("VALIDATION_ERROR", retiredGovernanceViewProblem.code());
    }

    @Test
    void acceptsExactlyTheSmartViewsPublishedByTheManifest() {
        for (String supported : List.of("ALL", "EXTERNAL_ORDER_TEMP", "INACTIVE", "RECENTLY_UPDATED", "AUTO_SYNC")) {
            assertDoesNotThrow(
                    () -> CatalogOwnerService.validateItemPageQuery(
                            mapper.createObjectNode().put("smartViewKey", supported)),
                    supported);
        }
        for (String retired : List.of("ENABLED", "DISABLED", "TEMPORARY", "NEEDS_ATTENTION", "GOVERNANCE_PENDING")) {
            CatalogOwnerApi.Problem problem = assertThrows(
                    CatalogOwnerApi.Problem.class,
                    () -> CatalogOwnerService.validateItemPageQuery(
                            mapper.createObjectNode().put("smartViewKey", retired)),
                    retired);
            assertEquals("VALIDATION_ERROR", problem.code());
        }
    }
}
