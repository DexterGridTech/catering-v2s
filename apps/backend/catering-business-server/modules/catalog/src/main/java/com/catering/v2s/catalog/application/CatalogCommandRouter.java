package com.catering.v2s.catalog.application;

import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.platform.command.CatalogAuthorizationScope;
import com.catering.v2s.platform.command.WorkspaceExecutionContext;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.Set;
import java.util.function.Supplier;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Adapts the operation-id owner protocol to the concrete Catalog command family.
 *
 * <p>This class owns no Catalog facts. It keeps the generic command transaction at the protocol boundary while the
 * concrete target service owns category receipts, locks, writes, and authoritative readback.
 */
@Service
class CatalogCommandRouter {
    private static final Set<String> CATEGORY_OPERATIONS = Set.of(
            "createOperationsCatalogCategory",
            "updateOperationsCatalogCategory",
            "moveOperationsCatalogCategory",
            "transitionOperationsCatalogCategoryStatus");
    private static final Set<String> DICTIONARY_OPERATIONS = Set.of(
            "createOperationsCatalogDictionaryEntry",
            "updateOperationsCatalogDictionaryEntry",
            "reorderOperationsCatalogDictionaryEntry",
            "transitionOperationsCatalogDictionaryEntryStatus");
    private static final Set<String> ITEM_OPERATIONS = Set.of(
            "createOperationsCatalogItem",
            "saveOperationsCatalogItem",
            "transitionOperationsCatalogItemStatus",
            "preflightOperationsTemporaryCatalogItemPromotion",
            "executeOperationsTemporaryCatalogItemPromotion");

    private final CatalogCategoryService categoryService;
    private final CatalogDictionaryService dictionaryService;
    private final CatalogItemService itemService;

    @Autowired
    CatalogCommandRouter(
            CatalogCategoryService categoryService,
            CatalogDictionaryService dictionaryService,
            CatalogItemService itemService) {
        this.categoryService = categoryService;
        this.dictionaryService = dictionaryService;
        this.itemService = itemService;
    }

    CatalogCommandRouter(CatalogCategoryService categoryService) {
        this(categoryService, null, null);
    }

    CatalogCommandRouter(CatalogCategoryService categoryService, CatalogDictionaryService dictionaryService) {
        this(categoryService, dictionaryService, null);
    }

    @Transactional
    JsonNode route(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            ObjectNode request,
            String idempotencyKey,
            Supplier<JsonNode> legacyOwnerCommand) {
        String operationId = context.operationToken().operationId();
        if (CATEGORY_OPERATIONS.contains(operationId)) {
            return categoryService.write(context, request, idempotencyKey);
        }
        if (DICTIONARY_OPERATIONS.contains(operationId)) {
            if (dictionaryService == null) {
                throw new CatalogOwnerApi.Problem(
                        "VALIDATION_ERROR", 422, "catalog dictionary command target is not configured");
            }
            return dictionaryService.write(context, request, idempotencyKey);
        }
        if (ITEM_OPERATIONS.contains(operationId)) {
            if (itemService == null) {
                throw new CatalogOwnerApi.Problem(
                        "VALIDATION_ERROR", 422, "catalog item command target is not configured");
            }
            return itemService.write(context, request, idempotencyKey);
        }
        if (legacyOwnerCommand == null) {
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "catalog write operation is not registered");
        }
        return legacyOwnerCommand.get();
    }
}
