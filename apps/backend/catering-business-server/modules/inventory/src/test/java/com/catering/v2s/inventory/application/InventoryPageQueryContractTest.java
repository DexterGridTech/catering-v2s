package com.catering.v2s.inventory.application;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.catering.v2s.inventory.api.InventoryOwnerApi;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class InventoryPageQueryContractTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void acceptsAResolvedCategoryAndStockView() {
        var query = mapper.createObjectNode()
            .put("categoryRef", "DRINK")
            .put("stockView", "NEEDS_ATTENTION")
            .put("cursor", "10")
            .put("pageSize", 25);
        query.putArray("catalogItemCodes").add("LATTE-001").add("TEA-001");

        assertDoesNotThrow(() -> InventoryOwnerService.validateTargetPageQuery(query));
    }

    @Test
    void rejectsUnresolvedCategoryAndUnknownStockView() {
        var unresolved = mapper.createObjectNode().put("categoryRef", "DRINK");
        InventoryOwnerApi.Problem categoryProblem = assertThrows(InventoryOwnerApi.Problem.class,
            () -> InventoryOwnerService.validateTargetPageQuery(unresolved));
        assertEquals("VALIDATION_ERROR", categoryProblem.code());

        var malformed = mapper.createObjectNode().put("stockView", "NOT_A_VIEW");
        InventoryOwnerApi.Problem stockProblem = assertThrows(InventoryOwnerApi.Problem.class,
            () -> InventoryOwnerService.validateTargetPageQuery(malformed));
        assertEquals("VALIDATION_ERROR", stockProblem.code());
    }

    @Test
    void derivesTheSameStockStateForPageAndCurrentReads() {
        var config = mapper.createObjectNode().put("lowStockThreshold", "5");
        assertEquals("OUT", InventoryOwnerService.state(BigDecimal.ZERO, config));
        assertEquals("NEGATIVE", InventoryOwnerService.state(new BigDecimal("-1"), config));
        assertEquals("LOW", InventoryOwnerService.state(new BigDecimal("3"), config));
        config.put("unknown", true);
        assertEquals("UNKNOWN", InventoryOwnerService.state(new BigDecimal("3"), config));
    }
}
