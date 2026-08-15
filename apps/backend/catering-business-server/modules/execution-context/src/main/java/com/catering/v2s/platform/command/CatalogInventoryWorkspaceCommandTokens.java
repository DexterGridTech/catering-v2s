package com.catering.v2s.platform.command;

import java.util.List;
import java.util.Map;

/** Generated from contracts/registry/operation-handler-bindings.json (825d5411a404883dce70a652fb67bf1a2e3aeda53153d3b3c58205d626ec7f09) and contracts/catalog/catalog-inventory-edge-contract.json (0af9635b3ce066886e71bd2bea65e30853ef1197455c33d78b8818e52935e812). */
public final class CatalogInventoryWorkspaceCommandTokens {
    private CatalogInventoryWorkspaceCommandTokens() { }

    public static final WorkspaceCommandOperationToken ADJUST_OPERATIONS_INVENTORY_TARGET = new WorkspaceCommandOperationToken(
        "adjustOperationsInventoryTarget", "inventory", "CATALOG_INVENTORY_OPERATION_ADJUST_OPERATIONS_INVENTORY_TARGET", List.of("STORE"), Map.ofEntries(Map.entry("STORE", "EDIT_STORE_INVENTORY")), "NONE", WorkspaceCommandOperationToken.CopySourcePolicy.NONE
    );

    public static final WorkspaceCommandOperationToken BATCH_TRANSITION_OPERATIONS_CATALOG_ITEM_STATUS = new WorkspaceCommandOperationToken(
        "batchTransitionOperationsCatalogItemStatus", "catalog", "CATALOG_INVENTORY_OPERATION_BATCH_TRANSITION_OPERATIONS_CATALOG_ITEM_STATUS", List.of("HEAD_COMPANY", "STORE"), Map.ofEntries(Map.entry("HEAD_COMPANY", "EDIT_HEAD_COMPANY_CATALOG"), Map.entry("STORE", "EDIT_STORE_CATALOG")), "NONE", WorkspaceCommandOperationToken.CopySourcePolicy.NONE
    );

    public static final WorkspaceCommandOperationToken COUNT_OPERATIONS_INVENTORY_TARGET = new WorkspaceCommandOperationToken(
        "countOperationsInventoryTarget", "inventory", "CATALOG_INVENTORY_OPERATION_COUNT_OPERATIONS_INVENTORY_TARGET", List.of("STORE"), Map.ofEntries(Map.entry("STORE", "EDIT_STORE_INVENTORY")), "NONE", WorkspaceCommandOperationToken.CopySourcePolicy.NONE
    );

    public static final WorkspaceCommandOperationToken CREATE_OPERATIONS_CATALOG_CATEGORY = new WorkspaceCommandOperationToken(
        "createOperationsCatalogCategory", "catalog", "CATALOG_INVENTORY_OPERATION_CREATE_OPERATIONS_CATALOG_CATEGORY", List.of("HEAD_COMPANY", "STORE"), Map.ofEntries(Map.entry("HEAD_COMPANY", "EDIT_HEAD_COMPANY_CATALOG"), Map.entry("STORE", "EDIT_STORE_CATALOG")), "NONE", WorkspaceCommandOperationToken.CopySourcePolicy.NONE
    );

    public static final WorkspaceCommandOperationToken CREATE_OPERATIONS_CATALOG_DICTIONARY_ENTRY = new WorkspaceCommandOperationToken(
        "createOperationsCatalogDictionaryEntry", "catalog", "CATALOG_INVENTORY_OPERATION_CREATE_OPERATIONS_CATALOG_DICTIONARY_ENTRY", List.of("HEAD_COMPANY", "STORE"), Map.ofEntries(Map.entry("HEAD_COMPANY", "EDIT_HEAD_COMPANY_CATALOG"), Map.entry("STORE", "EDIT_STORE_CATALOG")), "NONE", WorkspaceCommandOperationToken.CopySourcePolicy.NONE
    );

    public static final WorkspaceCommandOperationToken CREATE_OPERATIONS_CATALOG_ITEM = new WorkspaceCommandOperationToken(
        "createOperationsCatalogItem", "catalog", "CATALOG_INVENTORY_OPERATION_CREATE_OPERATIONS_CATALOG_ITEM", List.of("HEAD_COMPANY", "STORE"), Map.ofEntries(Map.entry("HEAD_COMPANY", "EDIT_HEAD_COMPANY_CATALOG"), Map.entry("STORE", "EDIT_STORE_CATALOG")), "NONE", WorkspaceCommandOperationToken.CopySourcePolicy.NONE
    );

    public static final WorkspaceCommandOperationToken CREATE_OPERATIONS_PRODUCTION_TAG = new WorkspaceCommandOperationToken(
        "createOperationsProductionTag", "fulfillment-production", "CATALOG_INVENTORY_OPERATION_CREATE_OPERATIONS_PRODUCTION_TAG", List.of("HEAD_COMPANY", "STORE"), Map.ofEntries(Map.entry("HEAD_COMPANY", "EDIT_HEAD_COMPANY_CATALOG"), Map.entry("STORE", "EDIT_STORE_CATALOG")), "NONE", WorkspaceCommandOperationToken.CopySourcePolicy.NONE
    );

    public static final WorkspaceCommandOperationToken DELETE_OPERATIONS_CATALOG_CATEGORY = new WorkspaceCommandOperationToken(
        "deleteOperationsCatalogCategory", "catalog", "CATALOG_INVENTORY_OPERATION_DELETE_OPERATIONS_CATALOG_CATEGORY", List.of("HEAD_COMPANY", "STORE"), Map.ofEntries(Map.entry("HEAD_COMPANY", "EDIT_HEAD_COMPANY_CATALOG"), Map.entry("STORE", "EDIT_STORE_CATALOG")), "NONE", WorkspaceCommandOperationToken.CopySourcePolicy.NONE
    );

    public static final WorkspaceCommandOperationToken EXECUTE_OPERATIONS_BRAND_CATALOG_COPY = new WorkspaceCommandOperationToken(
        "executeOperationsBrandCatalogCopy", "catalog", "CATALOG_INVENTORY_OPERATION_EXECUTE_OPERATIONS_BRAND_CATALOG_COPY", List.of("STORE"), Map.ofEntries(Map.entry("STORE", "EDIT_STORE_CATALOG")), "COPY_TARGET", WorkspaceCommandOperationToken.CopySourcePolicy.ORGANIZATION_JUDGMENT
    );

    public static final WorkspaceCommandOperationToken EXECUTE_OPERATIONS_LOCAL_CATALOG_COPY = new WorkspaceCommandOperationToken(
        "executeOperationsLocalCatalogCopy", "catalog", "CATALOG_INVENTORY_OPERATION_EXECUTE_OPERATIONS_LOCAL_CATALOG_COPY", List.of("STORE"), Map.ofEntries(Map.entry("STORE", "EDIT_STORE_CATALOG")), "COPY_TARGET", WorkspaceCommandOperationToken.CopySourcePolicy.TARGET_SCOPE
    );

    public static final WorkspaceCommandOperationToken EXECUTE_OPERATIONS_TEMPORARY_CATALOG_ITEM_PROMOTION = new WorkspaceCommandOperationToken(
        "executeOperationsTemporaryCatalogItemPromotion", "catalog", "CATALOG_INVENTORY_OPERATION_EXECUTE_OPERATIONS_TEMPORARY_CATALOG_ITEM_PROMOTION", List.of("HEAD_COMPANY", "STORE"), Map.ofEntries(Map.entry("HEAD_COMPANY", "EDIT_HEAD_COMPANY_CATALOG"), Map.entry("STORE", "EDIT_STORE_CATALOG")), "COPY_TARGET", WorkspaceCommandOperationToken.CopySourcePolicy.CATALOG_ITEM
    );

    public static final WorkspaceCommandOperationToken INCREASE_OPERATIONS_INVENTORY_TARGET = new WorkspaceCommandOperationToken(
        "increaseOperationsInventoryTarget", "inventory", "CATALOG_INVENTORY_OPERATION_INCREASE_OPERATIONS_INVENTORY_TARGET", List.of("STORE"), Map.ofEntries(Map.entry("STORE", "EDIT_STORE_INVENTORY")), "NONE", WorkspaceCommandOperationToken.CopySourcePolicy.NONE
    );

    public static final WorkspaceCommandOperationToken MOVE_OPERATIONS_CATALOG_CATEGORY = new WorkspaceCommandOperationToken(
        "moveOperationsCatalogCategory", "catalog", "CATALOG_INVENTORY_OPERATION_MOVE_OPERATIONS_CATALOG_CATEGORY", List.of("HEAD_COMPANY", "STORE"), Map.ofEntries(Map.entry("HEAD_COMPANY", "EDIT_HEAD_COMPANY_CATALOG"), Map.entry("STORE", "EDIT_STORE_CATALOG")), "NONE", WorkspaceCommandOperationToken.CopySourcePolicy.NONE
    );

    public static final WorkspaceCommandOperationToken PREFLIGHT_OPERATIONS_BRAND_CATALOG_COPY = new WorkspaceCommandOperationToken(
        "preflightOperationsBrandCatalogCopy", "catalog", "CATALOG_INVENTORY_OPERATION_PREFLIGHT_OPERATIONS_BRAND_CATALOG_COPY", List.of("STORE"), Map.ofEntries(Map.entry("STORE", "EDIT_STORE_CATALOG")), "COPY_TARGET", WorkspaceCommandOperationToken.CopySourcePolicy.ORGANIZATION_JUDGMENT
    );

    public static final WorkspaceCommandOperationToken PREFLIGHT_OPERATIONS_LOCAL_CATALOG_COPY = new WorkspaceCommandOperationToken(
        "preflightOperationsLocalCatalogCopy", "catalog", "CATALOG_INVENTORY_OPERATION_PREFLIGHT_OPERATIONS_LOCAL_CATALOG_COPY", List.of("STORE"), Map.ofEntries(Map.entry("STORE", "EDIT_STORE_CATALOG")), "COPY_TARGET", WorkspaceCommandOperationToken.CopySourcePolicy.TARGET_SCOPE
    );

    public static final WorkspaceCommandOperationToken PREFLIGHT_OPERATIONS_TEMPORARY_CATALOG_ITEM_PROMOTION = new WorkspaceCommandOperationToken(
        "preflightOperationsTemporaryCatalogItemPromotion", "catalog", "CATALOG_INVENTORY_OPERATION_PREFLIGHT_OPERATIONS_TEMPORARY_CATALOG_ITEM_PROMOTION", List.of("HEAD_COMPANY", "STORE"), Map.ofEntries(Map.entry("HEAD_COMPANY", "EDIT_HEAD_COMPANY_CATALOG"), Map.entry("STORE", "EDIT_STORE_CATALOG")), "COPY_TARGET", WorkspaceCommandOperationToken.CopySourcePolicy.CATALOG_ITEM
    );

    public static final WorkspaceCommandOperationToken RELEASE_OPERATIONS_CATALOG_STAGED_ASSET = new WorkspaceCommandOperationToken(
        "releaseOperationsCatalogStagedAsset", "asset", "CATALOG_INVENTORY_OPERATION_RELEASE_OPERATIONS_CATALOG_STAGED_ASSET", List.of("HEAD_COMPANY", "STORE"), Map.ofEntries(Map.entry("HEAD_COMPANY", "EDIT_HEAD_COMPANY_CATALOG"), Map.entry("STORE", "EDIT_STORE_CATALOG")), "NONE", WorkspaceCommandOperationToken.CopySourcePolicy.NONE
    );

    public static final WorkspaceCommandOperationToken REORDER_OPERATIONS_CATALOG_DICTIONARY_ENTRY = new WorkspaceCommandOperationToken(
        "reorderOperationsCatalogDictionaryEntry", "catalog", "CATALOG_INVENTORY_OPERATION_REORDER_OPERATIONS_CATALOG_DICTIONARY_ENTRY", List.of("HEAD_COMPANY", "STORE"), Map.ofEntries(Map.entry("HEAD_COMPANY", "EDIT_HEAD_COMPANY_CATALOG"), Map.entry("STORE", "EDIT_STORE_CATALOG")), "NONE", WorkspaceCommandOperationToken.CopySourcePolicy.NONE
    );

    public static final WorkspaceCommandOperationToken SAVE_OPERATIONS_CATALOG_ITEM = new WorkspaceCommandOperationToken(
        "saveOperationsCatalogItem", "catalog", "CATALOG_INVENTORY_OPERATION_SAVE_OPERATIONS_CATALOG_ITEM", List.of("HEAD_COMPANY", "STORE"), Map.ofEntries(Map.entry("HEAD_COMPANY", "EDIT_HEAD_COMPANY_CATALOG"), Map.entry("STORE", "EDIT_STORE_CATALOG")), "NONE", WorkspaceCommandOperationToken.CopySourcePolicy.NONE
    );

    public static final WorkspaceCommandOperationToken STAGE_OPERATIONS_CATALOG_ASSET = new WorkspaceCommandOperationToken(
        "stageOperationsCatalogAsset", "asset", "CATALOG_INVENTORY_OPERATION_STAGE_OPERATIONS_CATALOG_ASSET", List.of("HEAD_COMPANY", "STORE"), Map.ofEntries(Map.entry("HEAD_COMPANY", "EDIT_HEAD_COMPANY_CATALOG"), Map.entry("STORE", "EDIT_STORE_CATALOG")), "NONE", WorkspaceCommandOperationToken.CopySourcePolicy.NONE
    );

    public static final WorkspaceCommandOperationToken TRANSITION_OPERATIONS_CATALOG_DICTIONARY_ENTRY_STATUS = new WorkspaceCommandOperationToken(
        "transitionOperationsCatalogDictionaryEntryStatus", "catalog", "CATALOG_INVENTORY_OPERATION_TRANSITION_OPERATIONS_CATALOG_DICTIONARY_ENTRY_STATUS", List.of("HEAD_COMPANY", "STORE"), Map.ofEntries(Map.entry("HEAD_COMPANY", "EDIT_HEAD_COMPANY_CATALOG"), Map.entry("STORE", "EDIT_STORE_CATALOG")), "NONE", WorkspaceCommandOperationToken.CopySourcePolicy.NONE
    );

    public static final WorkspaceCommandOperationToken TRANSITION_OPERATIONS_CATALOG_ITEM_STATUS = new WorkspaceCommandOperationToken(
        "transitionOperationsCatalogItemStatus", "catalog", "CATALOG_INVENTORY_OPERATION_TRANSITION_OPERATIONS_CATALOG_ITEM_STATUS", List.of("HEAD_COMPANY", "STORE"), Map.ofEntries(Map.entry("HEAD_COMPANY", "EDIT_HEAD_COMPANY_CATALOG"), Map.entry("STORE", "EDIT_STORE_CATALOG")), "NONE", WorkspaceCommandOperationToken.CopySourcePolicy.NONE
    );

    public static final WorkspaceCommandOperationToken TRANSITION_OPERATIONS_PRODUCTION_TAG_STATUS = new WorkspaceCommandOperationToken(
        "transitionOperationsProductionTagStatus", "fulfillment-production", "CATALOG_INVENTORY_OPERATION_TRANSITION_OPERATIONS_PRODUCTION_TAG_STATUS", List.of("HEAD_COMPANY", "STORE"), Map.ofEntries(Map.entry("HEAD_COMPANY", "EDIT_HEAD_COMPANY_CATALOG"), Map.entry("STORE", "EDIT_STORE_CATALOG")), "NONE", WorkspaceCommandOperationToken.CopySourcePolicy.NONE
    );

    public static final WorkspaceCommandOperationToken UPDATE_OPERATIONS_CATALOG_CATEGORY = new WorkspaceCommandOperationToken(
        "updateOperationsCatalogCategory", "catalog", "CATALOG_INVENTORY_OPERATION_UPDATE_OPERATIONS_CATALOG_CATEGORY", List.of("HEAD_COMPANY", "STORE"), Map.ofEntries(Map.entry("HEAD_COMPANY", "EDIT_HEAD_COMPANY_CATALOG"), Map.entry("STORE", "EDIT_STORE_CATALOG")), "NONE", WorkspaceCommandOperationToken.CopySourcePolicy.NONE
    );

    public static final WorkspaceCommandOperationToken UPDATE_OPERATIONS_CATALOG_DICTIONARY_ENTRY = new WorkspaceCommandOperationToken(
        "updateOperationsCatalogDictionaryEntry", "catalog", "CATALOG_INVENTORY_OPERATION_UPDATE_OPERATIONS_CATALOG_DICTIONARY_ENTRY", List.of("HEAD_COMPANY", "STORE"), Map.ofEntries(Map.entry("HEAD_COMPANY", "EDIT_HEAD_COMPANY_CATALOG"), Map.entry("STORE", "EDIT_STORE_CATALOG")), "NONE", WorkspaceCommandOperationToken.CopySourcePolicy.NONE
    );

    public static final WorkspaceCommandOperationToken UPDATE_OPERATIONS_INVENTORY_TARGET_CONFIGURATION = new WorkspaceCommandOperationToken(
        "updateOperationsInventoryTargetConfiguration", "inventory", "CATALOG_INVENTORY_OPERATION_UPDATE_OPERATIONS_INVENTORY_TARGET_CONFIGURATION", List.of("STORE"), Map.ofEntries(Map.entry("STORE", "EDIT_STORE_INVENTORY")), "NONE", WorkspaceCommandOperationToken.CopySourcePolicy.NONE
    );

    public static final WorkspaceCommandOperationToken UPDATE_OPERATIONS_PRODUCTION_TAG = new WorkspaceCommandOperationToken(
        "updateOperationsProductionTag", "fulfillment-production", "CATALOG_INVENTORY_OPERATION_UPDATE_OPERATIONS_PRODUCTION_TAG", List.of("HEAD_COMPANY", "STORE"), Map.ofEntries(Map.entry("HEAD_COMPANY", "EDIT_HEAD_COMPANY_CATALOG"), Map.entry("STORE", "EDIT_STORE_CATALOG")), "NONE", WorkspaceCommandOperationToken.CopySourcePolicy.NONE
    );

    public static List<WorkspaceCommandOperationToken> all() {
        return List.of(ADJUST_OPERATIONS_INVENTORY_TARGET, BATCH_TRANSITION_OPERATIONS_CATALOG_ITEM_STATUS, COUNT_OPERATIONS_INVENTORY_TARGET, CREATE_OPERATIONS_CATALOG_CATEGORY, CREATE_OPERATIONS_CATALOG_DICTIONARY_ENTRY, CREATE_OPERATIONS_CATALOG_ITEM, CREATE_OPERATIONS_PRODUCTION_TAG, DELETE_OPERATIONS_CATALOG_CATEGORY, EXECUTE_OPERATIONS_BRAND_CATALOG_COPY, EXECUTE_OPERATIONS_LOCAL_CATALOG_COPY, EXECUTE_OPERATIONS_TEMPORARY_CATALOG_ITEM_PROMOTION, INCREASE_OPERATIONS_INVENTORY_TARGET, MOVE_OPERATIONS_CATALOG_CATEGORY, PREFLIGHT_OPERATIONS_BRAND_CATALOG_COPY, PREFLIGHT_OPERATIONS_LOCAL_CATALOG_COPY, PREFLIGHT_OPERATIONS_TEMPORARY_CATALOG_ITEM_PROMOTION, RELEASE_OPERATIONS_CATALOG_STAGED_ASSET, REORDER_OPERATIONS_CATALOG_DICTIONARY_ENTRY, SAVE_OPERATIONS_CATALOG_ITEM, STAGE_OPERATIONS_CATALOG_ASSET, TRANSITION_OPERATIONS_CATALOG_DICTIONARY_ENTRY_STATUS, TRANSITION_OPERATIONS_CATALOG_ITEM_STATUS, TRANSITION_OPERATIONS_PRODUCTION_TAG_STATUS, UPDATE_OPERATIONS_CATALOG_CATEGORY, UPDATE_OPERATIONS_CATALOG_DICTIONARY_ENTRY, UPDATE_OPERATIONS_INVENTORY_TARGET_CONFIGURATION, UPDATE_OPERATIONS_PRODUCTION_TAG);
    }
}
