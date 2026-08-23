package com.catering.v2s.platform.command;

import java.util.List;
import java.util.Map;

/**
 * Generated command tokens. Binding source: contracts/registry/operation-handler-bindings.json Binding digest:
 * 121b7283cfd14ec4ff2236341c7038dfa5c9237941b322ba0f1a34a398c91908 Contract source:
 * contracts/catalog/catalog-inventory-edge-contract.json Contract digest:
 * d7091866242b5c6c81f3c1a05d66d67fd52c16f41f233a45aaa54713e1c9411e
 */
public final class CatalogInventoryWorkspaceCommandTokens {
    private CatalogInventoryWorkspaceCommandTokens() {}

    public static final WorkspaceCommandOperationToken ADJUST_OPERATIONS_INVENTORY_TARGET =
            new WorkspaceCommandOperationToken(
                    "adjustOperationsInventoryTarget",
                    "inventory",
                    "CATALOG_INVENTORY_OPERATION_ADJUST_OPERATIONS_INVENTORY_TARGET",
                    List.of("STORE"),
                    Map.ofEntries(Map.entry("STORE", "EDIT_STORE_INVENTORY")),
                    "NONE",
                    WorkspaceCommandOperationToken.CopySourcePolicy.NONE);

    public static final WorkspaceCommandOperationToken BATCH_TRANSITION_OPERATIONS_CATALOG_ITEM_STATUS =
            new WorkspaceCommandOperationToken(
                    "batchTransitionOperationsCatalogItemStatus",
                    "catalog",
                    "CATALOG_INVENTORY_OPERATION_BATCH_TRANSITION_OPERATIONS_CATALOG_ITEM_STATUS",
                    List.of("HEAD_COMPANY", "STORE"),
                    Map.ofEntries(
                            Map.entry("HEAD_COMPANY", "EDIT_HEAD_COMPANY_CATALOG"),
                            Map.entry("STORE", "EDIT_STORE_CATALOG")),
                    "NONE",
                    WorkspaceCommandOperationToken.CopySourcePolicy.NONE);

    public static final WorkspaceCommandOperationToken COUNT_OPERATIONS_INVENTORY_TARGET =
            new WorkspaceCommandOperationToken(
                    "countOperationsInventoryTarget",
                    "inventory",
                    "CATALOG_INVENTORY_OPERATION_COUNT_OPERATIONS_INVENTORY_TARGET",
                    List.of("STORE"),
                    Map.ofEntries(Map.entry("STORE", "EDIT_STORE_INVENTORY")),
                    "NONE",
                    WorkspaceCommandOperationToken.CopySourcePolicy.NONE);

    public static final WorkspaceCommandOperationToken CREATE_OPERATIONS_CATALOG_ATTRIBUTE_DEFINITION =
            new WorkspaceCommandOperationToken(
                    "createOperationsCatalogAttributeDefinition",
                    "catalog",
                    "CATALOG_INVENTORY_OPERATION_CREATE_OPERATIONS_CATALOG_ATTRIBUTE_DEFINITION",
                    List.of("HEAD_COMPANY", "STORE"),
                    Map.ofEntries(
                            Map.entry("HEAD_COMPANY", "EDIT_HEAD_COMPANY_CATALOG"),
                            Map.entry("STORE", "EDIT_STORE_CATALOG")),
                    "NONE",
                    WorkspaceCommandOperationToken.CopySourcePolicy.NONE);

    public static final WorkspaceCommandOperationToken CREATE_OPERATIONS_CATALOG_CATEGORY =
            new WorkspaceCommandOperationToken(
                    "createOperationsCatalogCategory",
                    "catalog",
                    "CATALOG_INVENTORY_OPERATION_CREATE_OPERATIONS_CATALOG_CATEGORY",
                    List.of("HEAD_COMPANY", "STORE"),
                    Map.ofEntries(
                            Map.entry("HEAD_COMPANY", "EDIT_HEAD_COMPANY_CATALOG"),
                            Map.entry("STORE", "EDIT_STORE_CATALOG")),
                    "NONE",
                    WorkspaceCommandOperationToken.CopySourcePolicy.NONE);

    public static final WorkspaceCommandOperationToken CREATE_OPERATIONS_CATALOG_DICTIONARY_ENTRY =
            new WorkspaceCommandOperationToken(
                    "createOperationsCatalogDictionaryEntry",
                    "catalog",
                    "CATALOG_INVENTORY_OPERATION_CREATE_OPERATIONS_CATALOG_DICTIONARY_ENTRY",
                    List.of("HEAD_COMPANY", "STORE"),
                    Map.ofEntries(
                            Map.entry("HEAD_COMPANY", "EDIT_HEAD_COMPANY_CATALOG"),
                            Map.entry("STORE", "EDIT_STORE_CATALOG")),
                    "NONE",
                    WorkspaceCommandOperationToken.CopySourcePolicy.NONE);

    public static final WorkspaceCommandOperationToken CREATE_OPERATIONS_CATALOG_ITEM =
            new WorkspaceCommandOperationToken(
                    "createOperationsCatalogItem",
                    "catalog",
                    "CATALOG_INVENTORY_OPERATION_CREATE_OPERATIONS_CATALOG_ITEM",
                    List.of("HEAD_COMPANY", "STORE"),
                    Map.ofEntries(
                            Map.entry("HEAD_COMPANY", "EDIT_HEAD_COMPANY_CATALOG"),
                            Map.entry("STORE", "EDIT_STORE_CATALOG")),
                    "NONE",
                    WorkspaceCommandOperationToken.CopySourcePolicy.NONE);

    public static final WorkspaceCommandOperationToken CREATE_OPERATIONS_CATALOG_ORDER_OPTION_DEFINITION =
            new WorkspaceCommandOperationToken(
                    "createOperationsCatalogOrderOptionDefinition",
                    "catalog",
                    "CATALOG_INVENTORY_OPERATION_CREATE_OPERATIONS_CATALOG_ORDER_OPTION_DEFINITION",
                    List.of("HEAD_COMPANY", "STORE"),
                    Map.ofEntries(
                            Map.entry("HEAD_COMPANY", "EDIT_HEAD_COMPANY_CATALOG"),
                            Map.entry("STORE", "EDIT_STORE_CATALOG")),
                    "NONE",
                    WorkspaceCommandOperationToken.CopySourcePolicy.NONE);

    public static final WorkspaceCommandOperationToken CREATE_OPERATIONS_CATALOG_UNIT =
            new WorkspaceCommandOperationToken(
                    "createOperationsCatalogUnit",
                    "catalog",
                    "CATALOG_INVENTORY_OPERATION_CREATE_OPERATIONS_CATALOG_UNIT",
                    List.of("HEAD_COMPANY", "STORE"),
                    Map.ofEntries(
                            Map.entry("HEAD_COMPANY", "EDIT_HEAD_COMPANY_CATALOG"),
                            Map.entry("STORE", "EDIT_STORE_CATALOG")),
                    "NONE",
                    WorkspaceCommandOperationToken.CopySourcePolicy.NONE);

    public static final WorkspaceCommandOperationToken CREATE_OPERATIONS_PRODUCTION_TAG =
            new WorkspaceCommandOperationToken(
                    "createOperationsProductionTag",
                    "fulfillment-production",
                    "CATALOG_INVENTORY_OPERATION_CREATE_OPERATIONS_PRODUCTION_TAG",
                    List.of("HEAD_COMPANY", "STORE"),
                    Map.ofEntries(
                            Map.entry("HEAD_COMPANY", "EDIT_HEAD_COMPANY_CATALOG"),
                            Map.entry("STORE", "EDIT_STORE_CATALOG")),
                    "NONE",
                    WorkspaceCommandOperationToken.CopySourcePolicy.NONE);

    public static final WorkspaceCommandOperationToken DELETE_OPERATIONS_CATALOG_ATTRIBUTE_DEFINITION =
            new WorkspaceCommandOperationToken(
                    "deleteOperationsCatalogAttributeDefinition",
                    "catalog",
                    "CATALOG_INVENTORY_OPERATION_DELETE_OPERATIONS_CATALOG_ATTRIBUTE_DEFINITION",
                    List.of("HEAD_COMPANY", "STORE"),
                    Map.ofEntries(
                            Map.entry("HEAD_COMPANY", "EDIT_HEAD_COMPANY_CATALOG"),
                            Map.entry("STORE", "EDIT_STORE_CATALOG")),
                    "NONE",
                    WorkspaceCommandOperationToken.CopySourcePolicy.NONE);

    public static final WorkspaceCommandOperationToken DELETE_OPERATIONS_CATALOG_CATEGORY =
            new WorkspaceCommandOperationToken(
                    "deleteOperationsCatalogCategory",
                    "catalog",
                    "CATALOG_INVENTORY_OPERATION_DELETE_OPERATIONS_CATALOG_CATEGORY",
                    List.of("HEAD_COMPANY", "STORE"),
                    Map.ofEntries(
                            Map.entry("HEAD_COMPANY", "EDIT_HEAD_COMPANY_CATALOG"),
                            Map.entry("STORE", "EDIT_STORE_CATALOG")),
                    "NONE",
                    WorkspaceCommandOperationToken.CopySourcePolicy.NONE);

    public static final WorkspaceCommandOperationToken DELETE_OPERATIONS_CATALOG_ORDER_OPTION_DEFINITION =
            new WorkspaceCommandOperationToken(
                    "deleteOperationsCatalogOrderOptionDefinition",
                    "catalog",
                    "CATALOG_INVENTORY_OPERATION_DELETE_OPERATIONS_CATALOG_ORDER_OPTION_DEFINITION",
                    List.of("HEAD_COMPANY", "STORE"),
                    Map.ofEntries(
                            Map.entry("HEAD_COMPANY", "EDIT_HEAD_COMPANY_CATALOG"),
                            Map.entry("STORE", "EDIT_STORE_CATALOG")),
                    "NONE",
                    WorkspaceCommandOperationToken.CopySourcePolicy.NONE);

    public static final WorkspaceCommandOperationToken DELETE_OPERATIONS_CATALOG_UNIT =
            new WorkspaceCommandOperationToken(
                    "deleteOperationsCatalogUnit",
                    "catalog",
                    "CATALOG_INVENTORY_OPERATION_DELETE_OPERATIONS_CATALOG_UNIT",
                    List.of("HEAD_COMPANY", "STORE"),
                    Map.ofEntries(
                            Map.entry("HEAD_COMPANY", "EDIT_HEAD_COMPANY_CATALOG"),
                            Map.entry("STORE", "EDIT_STORE_CATALOG")),
                    "NONE",
                    WorkspaceCommandOperationToken.CopySourcePolicy.NONE);

    public static final WorkspaceCommandOperationToken DISABLE_OPERATIONS_CATALOG_UNIT =
            new WorkspaceCommandOperationToken(
                    "disableOperationsCatalogUnit",
                    "catalog",
                    "CATALOG_INVENTORY_OPERATION_DISABLE_OPERATIONS_CATALOG_UNIT",
                    List.of("HEAD_COMPANY", "STORE"),
                    Map.ofEntries(
                            Map.entry("HEAD_COMPANY", "EDIT_HEAD_COMPANY_CATALOG"),
                            Map.entry("STORE", "EDIT_STORE_CATALOG")),
                    "NONE",
                    WorkspaceCommandOperationToken.CopySourcePolicy.NONE);

    public static final WorkspaceCommandOperationToken EXECUTE_OPERATIONS_BRAND_CATALOG_COPY =
            new WorkspaceCommandOperationToken(
                    "executeOperationsBrandCatalogCopy",
                    "catalog",
                    "CATALOG_INVENTORY_OPERATION_EXECUTE_OPERATIONS_BRAND_CATALOG_COPY",
                    List.of("STORE"),
                    Map.ofEntries(Map.entry("STORE", "EDIT_STORE_CATALOG")),
                    "COPY_TARGET",
                    WorkspaceCommandOperationToken.CopySourcePolicy.ORGANIZATION_JUDGMENT);

    public static final WorkspaceCommandOperationToken EXECUTE_OPERATIONS_LOCAL_CATALOG_COPY =
            new WorkspaceCommandOperationToken(
                    "executeOperationsLocalCatalogCopy",
                    "catalog",
                    "CATALOG_INVENTORY_OPERATION_EXECUTE_OPERATIONS_LOCAL_CATALOG_COPY",
                    List.of("STORE"),
                    Map.ofEntries(Map.entry("STORE", "EDIT_STORE_CATALOG")),
                    "COPY_TARGET",
                    WorkspaceCommandOperationToken.CopySourcePolicy.TARGET_SCOPE);

    public static final WorkspaceCommandOperationToken EXECUTE_OPERATIONS_TEMPORARY_CATALOG_ITEM_PROMOTION =
            new WorkspaceCommandOperationToken(
                    "executeOperationsTemporaryCatalogItemPromotion",
                    "catalog",
                    "CATALOG_INVENTORY_OPERATION_EXECUTE_OPERATIONS_TEMPORARY_CATALOG_ITEM_PROMOTION",
                    List.of("HEAD_COMPANY", "STORE"),
                    Map.ofEntries(
                            Map.entry("HEAD_COMPANY", "EDIT_HEAD_COMPANY_CATALOG"),
                            Map.entry("STORE", "EDIT_STORE_CATALOG")),
                    "COPY_TARGET",
                    WorkspaceCommandOperationToken.CopySourcePolicy.CATALOG_ITEM);

    public static final WorkspaceCommandOperationToken INCREASE_OPERATIONS_INVENTORY_TARGET =
            new WorkspaceCommandOperationToken(
                    "increaseOperationsInventoryTarget",
                    "inventory",
                    "CATALOG_INVENTORY_OPERATION_INCREASE_OPERATIONS_INVENTORY_TARGET",
                    List.of("STORE"),
                    Map.ofEntries(Map.entry("STORE", "EDIT_STORE_INVENTORY")),
                    "NONE",
                    WorkspaceCommandOperationToken.CopySourcePolicy.NONE);

    public static final WorkspaceCommandOperationToken MOVE_OPERATIONS_CATALOG_CATEGORY =
            new WorkspaceCommandOperationToken(
                    "moveOperationsCatalogCategory",
                    "catalog",
                    "CATALOG_INVENTORY_OPERATION_MOVE_OPERATIONS_CATALOG_CATEGORY",
                    List.of("HEAD_COMPANY", "STORE"),
                    Map.ofEntries(
                            Map.entry("HEAD_COMPANY", "EDIT_HEAD_COMPANY_CATALOG"),
                            Map.entry("STORE", "EDIT_STORE_CATALOG")),
                    "NONE",
                    WorkspaceCommandOperationToken.CopySourcePolicy.NONE);

    public static final WorkspaceCommandOperationToken PREFLIGHT_OPERATIONS_BRAND_CATALOG_COPY =
            new WorkspaceCommandOperationToken(
                    "preflightOperationsBrandCatalogCopy",
                    "catalog",
                    "CATALOG_INVENTORY_OPERATION_PREFLIGHT_OPERATIONS_BRAND_CATALOG_COPY",
                    List.of("STORE"),
                    Map.ofEntries(Map.entry("STORE", "EDIT_STORE_CATALOG")),
                    "COPY_TARGET",
                    WorkspaceCommandOperationToken.CopySourcePolicy.ORGANIZATION_JUDGMENT);

    public static final WorkspaceCommandOperationToken PREFLIGHT_OPERATIONS_LOCAL_CATALOG_COPY =
            new WorkspaceCommandOperationToken(
                    "preflightOperationsLocalCatalogCopy",
                    "catalog",
                    "CATALOG_INVENTORY_OPERATION_PREFLIGHT_OPERATIONS_LOCAL_CATALOG_COPY",
                    List.of("STORE"),
                    Map.ofEntries(Map.entry("STORE", "EDIT_STORE_CATALOG")),
                    "COPY_TARGET",
                    WorkspaceCommandOperationToken.CopySourcePolicy.TARGET_SCOPE);

    public static final WorkspaceCommandOperationToken PREFLIGHT_OPERATIONS_TEMPORARY_CATALOG_ITEM_PROMOTION =
            new WorkspaceCommandOperationToken(
                    "preflightOperationsTemporaryCatalogItemPromotion",
                    "catalog",
                    "CATALOG_INVENTORY_OPERATION_PREFLIGHT_OPERATIONS_TEMPORARY_CATALOG_ITEM_PROMOTION",
                    List.of("HEAD_COMPANY", "STORE"),
                    Map.ofEntries(
                            Map.entry("HEAD_COMPANY", "EDIT_HEAD_COMPANY_CATALOG"),
                            Map.entry("STORE", "EDIT_STORE_CATALOG")),
                    "COPY_TARGET",
                    WorkspaceCommandOperationToken.CopySourcePolicy.CATALOG_ITEM);

    public static final WorkspaceCommandOperationToken RELEASE_OPERATIONS_CATALOG_STAGED_ASSET =
            new WorkspaceCommandOperationToken(
                    "releaseOperationsCatalogStagedAsset",
                    "asset",
                    "CATALOG_INVENTORY_OPERATION_RELEASE_OPERATIONS_CATALOG_STAGED_ASSET",
                    List.of("HEAD_COMPANY", "STORE"),
                    Map.ofEntries(
                            Map.entry("HEAD_COMPANY", "EDIT_HEAD_COMPANY_CATALOG"),
                            Map.entry("STORE", "EDIT_STORE_CATALOG")),
                    "NONE",
                    WorkspaceCommandOperationToken.CopySourcePolicy.NONE);

    public static final WorkspaceCommandOperationToken REORDER_OPERATIONS_CATALOG_DICTIONARY_ENTRY =
            new WorkspaceCommandOperationToken(
                    "reorderOperationsCatalogDictionaryEntry",
                    "catalog",
                    "CATALOG_INVENTORY_OPERATION_REORDER_OPERATIONS_CATALOG_DICTIONARY_ENTRY",
                    List.of("HEAD_COMPANY", "STORE"),
                    Map.ofEntries(
                            Map.entry("HEAD_COMPANY", "EDIT_HEAD_COMPANY_CATALOG"),
                            Map.entry("STORE", "EDIT_STORE_CATALOG")),
                    "NONE",
                    WorkspaceCommandOperationToken.CopySourcePolicy.NONE);

    public static final WorkspaceCommandOperationToken SAVE_OPERATIONS_CATALOG_ITEM =
            new WorkspaceCommandOperationToken(
                    "saveOperationsCatalogItem",
                    "catalog",
                    "CATALOG_INVENTORY_OPERATION_SAVE_OPERATIONS_CATALOG_ITEM",
                    List.of("HEAD_COMPANY", "STORE"),
                    Map.ofEntries(
                            Map.entry("HEAD_COMPANY", "EDIT_HEAD_COMPANY_CATALOG"),
                            Map.entry("STORE", "EDIT_STORE_CATALOG")),
                    "NONE",
                    WorkspaceCommandOperationToken.CopySourcePolicy.NONE);

    public static final WorkspaceCommandOperationToken STAGE_OPERATIONS_CATALOG_ASSET =
            new WorkspaceCommandOperationToken(
                    "stageOperationsCatalogAsset",
                    "asset",
                    "CATALOG_INVENTORY_OPERATION_STAGE_OPERATIONS_CATALOG_ASSET",
                    List.of("HEAD_COMPANY", "STORE"),
                    Map.ofEntries(
                            Map.entry("HEAD_COMPANY", "EDIT_HEAD_COMPANY_CATALOG"),
                            Map.entry("STORE", "EDIT_STORE_CATALOG")),
                    "NONE",
                    WorkspaceCommandOperationToken.CopySourcePolicy.NONE);

    public static final WorkspaceCommandOperationToken TRANSITION_OPERATIONS_CATALOG_DICTIONARY_ENTRY_STATUS =
            new WorkspaceCommandOperationToken(
                    "transitionOperationsCatalogDictionaryEntryStatus",
                    "catalog",
                    "CATALOG_INVENTORY_OPERATION_TRANSITION_OPERATIONS_CATALOG_DICTIONARY_ENTRY_STATUS",
                    List.of("HEAD_COMPANY", "STORE"),
                    Map.ofEntries(
                            Map.entry("HEAD_COMPANY", "EDIT_HEAD_COMPANY_CATALOG"),
                            Map.entry("STORE", "EDIT_STORE_CATALOG")),
                    "NONE",
                    WorkspaceCommandOperationToken.CopySourcePolicy.NONE);

    public static final WorkspaceCommandOperationToken TRANSITION_OPERATIONS_CATALOG_ITEM_STATUS =
            new WorkspaceCommandOperationToken(
                    "transitionOperationsCatalogItemStatus",
                    "catalog",
                    "CATALOG_INVENTORY_OPERATION_TRANSITION_OPERATIONS_CATALOG_ITEM_STATUS",
                    List.of("HEAD_COMPANY", "STORE"),
                    Map.ofEntries(
                            Map.entry("HEAD_COMPANY", "EDIT_HEAD_COMPANY_CATALOG"),
                            Map.entry("STORE", "EDIT_STORE_CATALOG")),
                    "NONE",
                    WorkspaceCommandOperationToken.CopySourcePolicy.NONE);

    public static final WorkspaceCommandOperationToken TRANSITION_OPERATIONS_PRODUCTION_TAG_STATUS =
            new WorkspaceCommandOperationToken(
                    "transitionOperationsProductionTagStatus",
                    "fulfillment-production",
                    "CATALOG_INVENTORY_OPERATION_TRANSITION_OPERATIONS_PRODUCTION_TAG_STATUS",
                    List.of("HEAD_COMPANY", "STORE"),
                    Map.ofEntries(
                            Map.entry("HEAD_COMPANY", "EDIT_HEAD_COMPANY_CATALOG"),
                            Map.entry("STORE", "EDIT_STORE_CATALOG")),
                    "NONE",
                    WorkspaceCommandOperationToken.CopySourcePolicy.NONE);

    public static final WorkspaceCommandOperationToken UPDATE_OPERATIONS_CATALOG_ATTRIBUTE_DEFINITION =
            new WorkspaceCommandOperationToken(
                    "updateOperationsCatalogAttributeDefinition",
                    "catalog",
                    "CATALOG_INVENTORY_OPERATION_UPDATE_OPERATIONS_CATALOG_ATTRIBUTE_DEFINITION",
                    List.of("HEAD_COMPANY", "STORE"),
                    Map.ofEntries(
                            Map.entry("HEAD_COMPANY", "EDIT_HEAD_COMPANY_CATALOG"),
                            Map.entry("STORE", "EDIT_STORE_CATALOG")),
                    "NONE",
                    WorkspaceCommandOperationToken.CopySourcePolicy.NONE);

    public static final WorkspaceCommandOperationToken UPDATE_OPERATIONS_CATALOG_CATEGORY =
            new WorkspaceCommandOperationToken(
                    "updateOperationsCatalogCategory",
                    "catalog",
                    "CATALOG_INVENTORY_OPERATION_UPDATE_OPERATIONS_CATALOG_CATEGORY",
                    List.of("HEAD_COMPANY", "STORE"),
                    Map.ofEntries(
                            Map.entry("HEAD_COMPANY", "EDIT_HEAD_COMPANY_CATALOG"),
                            Map.entry("STORE", "EDIT_STORE_CATALOG")),
                    "NONE",
                    WorkspaceCommandOperationToken.CopySourcePolicy.NONE);

    public static final WorkspaceCommandOperationToken UPDATE_OPERATIONS_CATALOG_DICTIONARY_ENTRY =
            new WorkspaceCommandOperationToken(
                    "updateOperationsCatalogDictionaryEntry",
                    "catalog",
                    "CATALOG_INVENTORY_OPERATION_UPDATE_OPERATIONS_CATALOG_DICTIONARY_ENTRY",
                    List.of("HEAD_COMPANY", "STORE"),
                    Map.ofEntries(
                            Map.entry("HEAD_COMPANY", "EDIT_HEAD_COMPANY_CATALOG"),
                            Map.entry("STORE", "EDIT_STORE_CATALOG")),
                    "NONE",
                    WorkspaceCommandOperationToken.CopySourcePolicy.NONE);

    public static final WorkspaceCommandOperationToken UPDATE_OPERATIONS_CATALOG_ORDER_OPTION_DEFINITION =
            new WorkspaceCommandOperationToken(
                    "updateOperationsCatalogOrderOptionDefinition",
                    "catalog",
                    "CATALOG_INVENTORY_OPERATION_UPDATE_OPERATIONS_CATALOG_ORDER_OPTION_DEFINITION",
                    List.of("HEAD_COMPANY", "STORE"),
                    Map.ofEntries(
                            Map.entry("HEAD_COMPANY", "EDIT_HEAD_COMPANY_CATALOG"),
                            Map.entry("STORE", "EDIT_STORE_CATALOG")),
                    "NONE",
                    WorkspaceCommandOperationToken.CopySourcePolicy.NONE);

    public static final WorkspaceCommandOperationToken UPDATE_OPERATIONS_CATALOG_UNIT =
            new WorkspaceCommandOperationToken(
                    "updateOperationsCatalogUnit",
                    "catalog",
                    "CATALOG_INVENTORY_OPERATION_UPDATE_OPERATIONS_CATALOG_UNIT",
                    List.of("HEAD_COMPANY", "STORE"),
                    Map.ofEntries(
                            Map.entry("HEAD_COMPANY", "EDIT_HEAD_COMPANY_CATALOG"),
                            Map.entry("STORE", "EDIT_STORE_CATALOG")),
                    "NONE",
                    WorkspaceCommandOperationToken.CopySourcePolicy.NONE);

    public static final WorkspaceCommandOperationToken UPDATE_OPERATIONS_INVENTORY_TARGET_CONFIGURATION =
            new WorkspaceCommandOperationToken(
                    "updateOperationsInventoryTargetConfiguration",
                    "inventory",
                    "CATALOG_INVENTORY_OPERATION_UPDATE_OPERATIONS_INVENTORY_TARGET_CONFIGURATION",
                    List.of("STORE"),
                    Map.ofEntries(Map.entry("STORE", "EDIT_STORE_INVENTORY")),
                    "NONE",
                    WorkspaceCommandOperationToken.CopySourcePolicy.NONE);

    public static final WorkspaceCommandOperationToken UPDATE_OPERATIONS_PRODUCTION_TAG =
            new WorkspaceCommandOperationToken(
                    "updateOperationsProductionTag",
                    "fulfillment-production",
                    "CATALOG_INVENTORY_OPERATION_UPDATE_OPERATIONS_PRODUCTION_TAG",
                    List.of("HEAD_COMPANY", "STORE"),
                    Map.ofEntries(
                            Map.entry("HEAD_COMPANY", "EDIT_HEAD_COMPANY_CATALOG"),
                            Map.entry("STORE", "EDIT_STORE_CATALOG")),
                    "NONE",
                    WorkspaceCommandOperationToken.CopySourcePolicy.NONE);

    public static List<WorkspaceCommandOperationToken> all() {
        return List.of(
                ADJUST_OPERATIONS_INVENTORY_TARGET,
                BATCH_TRANSITION_OPERATIONS_CATALOG_ITEM_STATUS,
                COUNT_OPERATIONS_INVENTORY_TARGET,
                CREATE_OPERATIONS_CATALOG_ATTRIBUTE_DEFINITION,
                CREATE_OPERATIONS_CATALOG_CATEGORY,
                CREATE_OPERATIONS_CATALOG_DICTIONARY_ENTRY,
                CREATE_OPERATIONS_CATALOG_ITEM,
                CREATE_OPERATIONS_CATALOG_ORDER_OPTION_DEFINITION,
                CREATE_OPERATIONS_CATALOG_UNIT,
                CREATE_OPERATIONS_PRODUCTION_TAG,
                DELETE_OPERATIONS_CATALOG_ATTRIBUTE_DEFINITION,
                DELETE_OPERATIONS_CATALOG_CATEGORY,
                DELETE_OPERATIONS_CATALOG_ORDER_OPTION_DEFINITION,
                DELETE_OPERATIONS_CATALOG_UNIT,
                DISABLE_OPERATIONS_CATALOG_UNIT,
                EXECUTE_OPERATIONS_BRAND_CATALOG_COPY,
                EXECUTE_OPERATIONS_LOCAL_CATALOG_COPY,
                EXECUTE_OPERATIONS_TEMPORARY_CATALOG_ITEM_PROMOTION,
                INCREASE_OPERATIONS_INVENTORY_TARGET,
                MOVE_OPERATIONS_CATALOG_CATEGORY,
                PREFLIGHT_OPERATIONS_BRAND_CATALOG_COPY,
                PREFLIGHT_OPERATIONS_LOCAL_CATALOG_COPY,
                PREFLIGHT_OPERATIONS_TEMPORARY_CATALOG_ITEM_PROMOTION,
                RELEASE_OPERATIONS_CATALOG_STAGED_ASSET,
                REORDER_OPERATIONS_CATALOG_DICTIONARY_ENTRY,
                SAVE_OPERATIONS_CATALOG_ITEM,
                STAGE_OPERATIONS_CATALOG_ASSET,
                TRANSITION_OPERATIONS_CATALOG_DICTIONARY_ENTRY_STATUS,
                TRANSITION_OPERATIONS_CATALOG_ITEM_STATUS,
                TRANSITION_OPERATIONS_PRODUCTION_TAG_STATUS,
                UPDATE_OPERATIONS_CATALOG_ATTRIBUTE_DEFINITION,
                UPDATE_OPERATIONS_CATALOG_CATEGORY,
                UPDATE_OPERATIONS_CATALOG_DICTIONARY_ENTRY,
                UPDATE_OPERATIONS_CATALOG_ORDER_OPTION_DEFINITION,
                UPDATE_OPERATIONS_CATALOG_UNIT,
                UPDATE_OPERATIONS_INVENTORY_TARGET_CONFIGURATION,
                UPDATE_OPERATIONS_PRODUCTION_TAG);
    }
}
