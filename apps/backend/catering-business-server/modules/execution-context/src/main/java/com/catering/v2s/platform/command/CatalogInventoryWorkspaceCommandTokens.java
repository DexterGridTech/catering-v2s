package com.catering.v2s.platform.command;

import java.util.List;
import java.util.Map;

/**
 * Generated command tokens. Binding source: contracts/registry/operation-handler-bindings.json Binding digest:
 * b70a1fe23866ce6a4dbdcc7f6c956831a95d31e05a55ae210e0a32e9e53f2347 Contract source:
 * contracts/catalog/catalog-inventory-edge-contract.json Contract digest:
 * ac1568443e44af877fddd4ab7401bd05a4fe207fd1579326379008a2ed425bd9
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
                    WorkspaceCommandOperationToken.CopySourcePolicy.NONE,
                    true);

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
                    WorkspaceCommandOperationToken.CopySourcePolicy.NONE,
                    true);

    public static final WorkspaceCommandOperationToken COUNT_OPERATIONS_INVENTORY_TARGET =
            new WorkspaceCommandOperationToken(
                    "countOperationsInventoryTarget",
                    "inventory",
                    "CATALOG_INVENTORY_OPERATION_COUNT_OPERATIONS_INVENTORY_TARGET",
                    List.of("STORE"),
                    Map.ofEntries(Map.entry("STORE", "EDIT_STORE_INVENTORY")),
                    "NONE",
                    WorkspaceCommandOperationToken.CopySourcePolicy.NONE,
                    true);

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
                    WorkspaceCommandOperationToken.CopySourcePolicy.NONE,
                    true);

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
                    WorkspaceCommandOperationToken.CopySourcePolicy.NONE,
                    true);

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
                    WorkspaceCommandOperationToken.CopySourcePolicy.NONE,
                    true);

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
                    WorkspaceCommandOperationToken.CopySourcePolicy.NONE,
                    true);

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
                    WorkspaceCommandOperationToken.CopySourcePolicy.NONE,
                    true);

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
                    WorkspaceCommandOperationToken.CopySourcePolicy.NONE,
                    true);

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
                    WorkspaceCommandOperationToken.CopySourcePolicy.NONE,
                    true);

    public static final WorkspaceCommandOperationToken EXECUTE_OPERATIONS_BRAND_CATALOG_COPY =
            new WorkspaceCommandOperationToken(
                    "executeOperationsBrandCatalogCopy",
                    "catalog",
                    "CATALOG_INVENTORY_OPERATION_EXECUTE_OPERATIONS_BRAND_CATALOG_COPY",
                    List.of("STORE"),
                    Map.ofEntries(Map.entry("STORE", "EDIT_STORE_CATALOG")),
                    "COPY_TARGET",
                    WorkspaceCommandOperationToken.CopySourcePolicy.ORGANIZATION_JUDGMENT,
                    true);

    public static final WorkspaceCommandOperationToken EXECUTE_OPERATIONS_LOCAL_CATALOG_COPY =
            new WorkspaceCommandOperationToken(
                    "executeOperationsLocalCatalogCopy",
                    "catalog",
                    "CATALOG_INVENTORY_OPERATION_EXECUTE_OPERATIONS_LOCAL_CATALOG_COPY",
                    List.of("STORE"),
                    Map.ofEntries(Map.entry("STORE", "EDIT_STORE_CATALOG")),
                    "COPY_TARGET",
                    WorkspaceCommandOperationToken.CopySourcePolicy.TARGET_SCOPE,
                    true);

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
                    WorkspaceCommandOperationToken.CopySourcePolicy.CATALOG_ITEM,
                    true);

    public static final WorkspaceCommandOperationToken INCREASE_OPERATIONS_INVENTORY_TARGET =
            new WorkspaceCommandOperationToken(
                    "increaseOperationsInventoryTarget",
                    "inventory",
                    "CATALOG_INVENTORY_OPERATION_INCREASE_OPERATIONS_INVENTORY_TARGET",
                    List.of("STORE"),
                    Map.ofEntries(Map.entry("STORE", "EDIT_STORE_INVENTORY")),
                    "NONE",
                    WorkspaceCommandOperationToken.CopySourcePolicy.NONE,
                    true);

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
                    WorkspaceCommandOperationToken.CopySourcePolicy.NONE,
                    true);

    public static final WorkspaceCommandOperationToken PREFLIGHT_OPERATIONS_BRAND_CATALOG_COPY =
            new WorkspaceCommandOperationToken(
                    "preflightOperationsBrandCatalogCopy",
                    "catalog",
                    "CATALOG_INVENTORY_OPERATION_PREFLIGHT_OPERATIONS_BRAND_CATALOG_COPY",
                    List.of("STORE"),
                    Map.ofEntries(Map.entry("STORE", "EDIT_STORE_CATALOG")),
                    "COPY_TARGET",
                    WorkspaceCommandOperationToken.CopySourcePolicy.ORGANIZATION_JUDGMENT,
                    false);

    public static final WorkspaceCommandOperationToken PREFLIGHT_OPERATIONS_LOCAL_CATALOG_COPY =
            new WorkspaceCommandOperationToken(
                    "preflightOperationsLocalCatalogCopy",
                    "catalog",
                    "CATALOG_INVENTORY_OPERATION_PREFLIGHT_OPERATIONS_LOCAL_CATALOG_COPY",
                    List.of("STORE"),
                    Map.ofEntries(Map.entry("STORE", "EDIT_STORE_CATALOG")),
                    "COPY_TARGET",
                    WorkspaceCommandOperationToken.CopySourcePolicy.TARGET_SCOPE,
                    false);

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
                    WorkspaceCommandOperationToken.CopySourcePolicy.CATALOG_ITEM,
                    false);

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
                    WorkspaceCommandOperationToken.CopySourcePolicy.NONE,
                    true);

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
                    WorkspaceCommandOperationToken.CopySourcePolicy.NONE,
                    true);

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
                    WorkspaceCommandOperationToken.CopySourcePolicy.NONE,
                    true);

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
                    WorkspaceCommandOperationToken.CopySourcePolicy.NONE,
                    true);

    public static final WorkspaceCommandOperationToken TRANSITION_OPERATIONS_CATALOG_ATTRIBUTE_DEFINITION_STATUS =
            new WorkspaceCommandOperationToken(
                    "transitionOperationsCatalogAttributeDefinitionStatus",
                    "catalog",
                    "CATALOG_INVENTORY_OPERATION_TRANSITION_OPERATIONS_CATALOG_ATTRIBUTE_DEFINITION_STATUS",
                    List.of("HEAD_COMPANY", "STORE"),
                    Map.ofEntries(
                            Map.entry("HEAD_COMPANY", "EDIT_HEAD_COMPANY_CATALOG"),
                            Map.entry("STORE", "EDIT_STORE_CATALOG")),
                    "NONE",
                    WorkspaceCommandOperationToken.CopySourcePolicy.NONE,
                    true);

    public static final WorkspaceCommandOperationToken TRANSITION_OPERATIONS_CATALOG_CATEGORY_STATUS =
            new WorkspaceCommandOperationToken(
                    "transitionOperationsCatalogCategoryStatus",
                    "catalog",
                    "CATALOG_INVENTORY_OPERATION_TRANSITION_OPERATIONS_CATALOG_CATEGORY_STATUS",
                    List.of("HEAD_COMPANY", "STORE"),
                    Map.ofEntries(
                            Map.entry("HEAD_COMPANY", "EDIT_HEAD_COMPANY_CATALOG"),
                            Map.entry("STORE", "EDIT_STORE_CATALOG")),
                    "NONE",
                    WorkspaceCommandOperationToken.CopySourcePolicy.NONE,
                    true);

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
                    WorkspaceCommandOperationToken.CopySourcePolicy.NONE,
                    true);

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
                    WorkspaceCommandOperationToken.CopySourcePolicy.NONE,
                    true);

    public static final WorkspaceCommandOperationToken TRANSITION_OPERATIONS_CATALOG_ORDER_OPTION_DEFINITION_STATUS =
            new WorkspaceCommandOperationToken(
                    "transitionOperationsCatalogOrderOptionDefinitionStatus",
                    "catalog",
                    "CATALOG_INVENTORY_OPERATION_TRANSITION_OPERATIONS_CATALOG_ORDER_OPTION_DEFINITION_STATUS",
                    List.of("HEAD_COMPANY", "STORE"),
                    Map.ofEntries(
                            Map.entry("HEAD_COMPANY", "EDIT_HEAD_COMPANY_CATALOG"),
                            Map.entry("STORE", "EDIT_STORE_CATALOG")),
                    "NONE",
                    WorkspaceCommandOperationToken.CopySourcePolicy.NONE,
                    true);

    public static final WorkspaceCommandOperationToken TRANSITION_OPERATIONS_CATALOG_UNIT_STATUS =
            new WorkspaceCommandOperationToken(
                    "transitionOperationsCatalogUnitStatus",
                    "catalog",
                    "CATALOG_INVENTORY_OPERATION_TRANSITION_OPERATIONS_CATALOG_UNIT_STATUS",
                    List.of("HEAD_COMPANY", "STORE"),
                    Map.ofEntries(
                            Map.entry("HEAD_COMPANY", "EDIT_HEAD_COMPANY_CATALOG"),
                            Map.entry("STORE", "EDIT_STORE_CATALOG")),
                    "NONE",
                    WorkspaceCommandOperationToken.CopySourcePolicy.NONE,
                    true);

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
                    WorkspaceCommandOperationToken.CopySourcePolicy.NONE,
                    true);

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
                    WorkspaceCommandOperationToken.CopySourcePolicy.NONE,
                    true);

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
                    WorkspaceCommandOperationToken.CopySourcePolicy.NONE,
                    true);

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
                    WorkspaceCommandOperationToken.CopySourcePolicy.NONE,
                    true);

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
                    WorkspaceCommandOperationToken.CopySourcePolicy.NONE,
                    true);

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
                    WorkspaceCommandOperationToken.CopySourcePolicy.NONE,
                    true);

    public static final WorkspaceCommandOperationToken UPDATE_OPERATIONS_INVENTORY_TARGET_CONFIGURATION =
            new WorkspaceCommandOperationToken(
                    "updateOperationsInventoryTargetConfiguration",
                    "inventory",
                    "CATALOG_INVENTORY_OPERATION_UPDATE_OPERATIONS_INVENTORY_TARGET_CONFIGURATION",
                    List.of("STORE"),
                    Map.ofEntries(Map.entry("STORE", "EDIT_STORE_INVENTORY")),
                    "NONE",
                    WorkspaceCommandOperationToken.CopySourcePolicy.NONE,
                    true);

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
                    WorkspaceCommandOperationToken.CopySourcePolicy.NONE,
                    true);

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
                TRANSITION_OPERATIONS_CATALOG_ATTRIBUTE_DEFINITION_STATUS,
                TRANSITION_OPERATIONS_CATALOG_CATEGORY_STATUS,
                TRANSITION_OPERATIONS_CATALOG_DICTIONARY_ENTRY_STATUS,
                TRANSITION_OPERATIONS_CATALOG_ITEM_STATUS,
                TRANSITION_OPERATIONS_CATALOG_ORDER_OPTION_DEFINITION_STATUS,
                TRANSITION_OPERATIONS_CATALOG_UNIT_STATUS,
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
