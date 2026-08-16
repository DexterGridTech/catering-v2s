package com.catering.v2s.inventory.application;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.catering.v2s.inventory.api.InventoryOwnerApi;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class InventoryPageQueryContractTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void acceptsAResolvedCategoryAndStockView() {
        var query = mapper.createObjectNode()
                .put("categoryRef", "DRINK")
                .put("includeSubCategories", true)
                .put("stockView", "NEEDS_ATTENTION")
                .put("cursor", "10")
                .put("pageSize", 25);
        query.putArray("catalogItemRefs")
                .add(UUID.randomUUID().toString())
                .add(UUID.randomUUID().toString());

        assertDoesNotThrow(() -> InventoryOwnerService.validateTargetPageQuery(query));
    }

    @Test
    void acceptsCatalogCategoryFilterAndRejectsUnknownStockView() {
        var unresolved = mapper.createObjectNode().put("categoryRef", "DRINK");
        assertDoesNotThrow(() -> InventoryOwnerService.validateTargetPageQuery(unresolved));

        var malformed = mapper.createObjectNode().put("stockView", "NOT_A_VIEW");
        InventoryOwnerApi.Problem stockProblem = assertThrows(
                InventoryOwnerApi.Problem.class, () -> InventoryOwnerService.validateTargetPageQuery(malformed));
        assertEquals("VALIDATION_ERROR", stockProblem.code());
    }

    @Test
    void acceptsOnlyOpaqueCatalogItemRefsForCrossOwnerFiltering() {
        var legacyCodeFilter = mapper.createObjectNode();
        legacyCodeFilter.putArray("catalogItemCodes").add("LATTE-001");
        InventoryOwnerApi.Problem legacyProblem = assertThrows(
                InventoryOwnerApi.Problem.class, () -> InventoryOwnerService.validateTargetPageQuery(legacyCodeFilter));
        assertEquals("VALIDATION_ERROR", legacyProblem.code());

        var malformedRef = mapper.createObjectNode();
        malformedRef.putArray("catalogItemRefs").add("LATTE-001");
        InventoryOwnerApi.Problem malformedProblem = assertThrows(
                InventoryOwnerApi.Problem.class, () -> InventoryOwnerService.validateTargetPageQuery(malformedRef));
        assertEquals("VALIDATION_ERROR", malformedProblem.code());
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

    @Test
    void derivesInventoryTargetTypeFromTheOwnedSkuReference() {
        assertEquals("CATALOG_ITEM", InventoryOwnerService.inventoryTargetType(null));
        assertEquals("SKU", InventoryOwnerService.inventoryTargetType(UUID.randomUUID()));
    }
}
