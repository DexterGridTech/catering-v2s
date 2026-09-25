package com.catering.v2s.inventory.application.persistence;

/**
 * SQL text fragments owned by InventoryCatalogLifecycleService; B3 relocates text only and does not change execution.
 */
public final class InventoryCatalogLifecycleServiceSql {
    public static final String PARAMETER_PLACEHOLDER = "?";
    public static final String PLACEHOLDER_SEPARATOR = ",";
    public static final String OWNER_ENABLED_PREDICATE_SUFFIX = "=? AND definition_status='ENABLED'";
    public static final String INBOUND_RESOLVABLE_SUFFIX = "),TRUE) AS inbound_resolvable,";
    public static final String INBOUND_SUMMARY_PREFIX =
            "COALESCE((SELECT string_agg(DISTINCT COALESCE(NULLIF(BTRIM(source_name),''),"
                    + "NULLIF(BTRIM(source_code),''),'未知商品'),', ') FROM ";
    public static final String DEPENDENCY_COUNT_PREFIX = "SELECT ";
    public static final String DEPENDENCY_COUNT_TABLE_PREFIX = ",COUNT(*) FROM inventory.";
    public static final String DEPENDENCY_COUNT_GROUP_SUFFIX = " = ANY(?::uuid[]) GROUP BY ";
    public static final String ITEM_PARENT_DIFF_PREDICATE = "bom.item_ref IS DISTINCT FROM ot.item_ref";
    public static final String SKU_PARENT_DIFF_PREDICATE = "bom.product_sku_ref IS DISTINCT FROM ot.product_sku_ref";
    public static final String OWNER_TARGET_LOCK_SUFFIX = "=? ORDER BY target_ref FOR UPDATE";
    public static final String OWNER_BOM_LOCK_SUFFIX = "=? ORDER BY bom_ref FOR UPDATE";
    public static final String OWNER_TARGET_ORDER_SUFFIX = "=? ORDER BY target_ref";
    public static final String ACTIVE_TARGET_COUNT_SUFFIX = "=? AND definition_status='ENABLED') + ";
    public static final String ACTIVE_BOM_COUNT_PREFIX =
            "(SELECT COUNT(*) FROM inventory.stock_bom WHERE data_node_ref=? AND brand_ref=? AND ";
    public static final String ACTIVE_BOM_COUNT_SUFFIX = "=? AND definition_status='ENABLED')";
    public static final String
            INVENTORY_CATALOG_LIFECYCLE_SERVICE_SELECT_STOCK_TARGET_TARGET_REF_DATA_NODE_REF_BRAND_REF =
                    "SELECT target_ref FROM inventory.stock_target WHERE data_node_ref=? AND brand_ref=? ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONDITION_CONSUMPTION_UNIT_REF_COUNTING_UNIT_REF =
            "AND (consumption_unit_ref=? OR counting_unit_ref=?) FOR UPDATE";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_SELECT_STOCK_LEDGER_LEDGER_CONSUMPTION_UNIT_REF =
            "SELECT count(*) FROM inventory.stock_ledger ledger WHERE ledger.consumption_unit_ref=? ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONDITION_STOCK_TARGET_TARGET =
            "AND EXISTS (SELECT 1 FROM inventory.stock_target target ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_WHERE_TARGET_TARGET_REF_LEDGER =
            "WHERE target.target_ref=ledger.target_ref ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONDITION_TARGET_DATA_NODE_REF_BRAND_REF =
            "AND target.data_node_ref=? AND target.brand_ref=?)";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_SELECT_STOCK_BOM_BOM =
            "SELECT count(*) FROM inventory.stock_bom bom WHERE EXISTS (";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_SELECT_JSONB_ARRAY_ELEMENTS_BOM_ROWS_LINE =
            "SELECT 1 FROM jsonb_array_elements(bom.rows) line ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_WHERE_LINE_CONSUMPTION_UNIT_SNAPSHOT_UNIT_REF =
            "WHERE line->'consumptionUnitSnapshot'->>'unitRef'=? )";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_SELECT_STOCK_TARGET =
            "SELECT target_ref,product_sku_ref,consumption_unit_ref FROM inventory.stock_target ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_WHERE_DATA_NODE_REF_BRAND_REF_ITEM_REF =
            "WHERE data_node_ref=? AND brand_ref=? AND item_ref=? FOR UPDATE";
    public static final String
            INVENTORY_CATALOG_LIFECYCLE_SERVICE_UPDATE_STOCK_TARGET_DEFINITION_STATUS_DISABLED_VERSION =
                    "UPDATE inventory.stock_target SET definition_status='DISABLED',version=version+1,";
    public static final String
            INVENTORY_CATALOG_LIFECYCLE_SERVICE_UPDATE_UPDATED_AT_EPOCH_MILLIS_DATA_NODE_REF_BRAND_REF =
                    "updated_at_epoch_millis=? WHERE data_node_ref=? AND brand_ref=? AND ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_UPDATE_STOCK_BOM_DEFINITION_STATUS_DISABLED_VERSION =
            "UPDATE inventory.stock_bom SET definition_status='DISABLED',version=version+1,";
    public static final String
            INVENTORY_CATALOG_LIFECYCLE_SERVICE_UPDATE_UPDATED_AT_EPOCH_MILLIS_DATA_NODE_REF_BRAND_REF_ALTERNATE_A =
                    "updated_at_epoch_millis=? WHERE data_node_ref=? AND brand_ref=? AND ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_CTE_RECEIPT_LOCK =
            "WITH receipt_lock AS MATERIALIZED (";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_SELECT_PG_ADVISORY_XACT_LOCK_HASHTEXT_TEXT =
            "SELECT pg_advisory_xact_lock(hashtext(CAST(? AS text)),hashtext(CAST(? AS text)))";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_CLOSE_PAREN_PRIOR_RECEIPT =
            "), prior_receipt AS MATERIALIZED (";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_SELECT_OPERATION_ID_REQUEST_HASH_RESPONSE_TEXT =
            "SELECT operation_id,request_hash,response_json::text AS response ";
    public static final String
            INVENTORY_CATALOG_LIFECYCLE_SERVICE_FROM_CLAUSE_RECEIPT_LOCK_FROM_INVENTORY_COMMAND_RECEI =
                    "FROM inventory.command_receipt CROSS JOIN receipt_lock ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_WHERE_DATA_NODE_REF_IDEMPOTENCY_KEY =
            "WHERE data_node_ref=? AND idempotency_key=?";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_CLOSE_PAREN_OWNED_TARGETS =
            "), owned_targets AS MATERIALIZED (";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_SELECT_TARGET_TARGET_REF_ITEM_REF_DEFINITION_STATUS =
            "SELECT target.target_ref,target.item_ref,target.definition_status ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_FROM_CLAUSE_RECEIPT_LOCK_TARGET =
            "FROM inventory.stock_target target CROSS JOIN receipt_lock ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_WHERE_TARGET_DATA_NODE_REF_BRAND_REF_ITEM_REF =
            "WHERE target.data_node_ref=? AND target.brand_ref=? AND target.item_ref=? ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_LOCK_FOR_UPDATE = "FOR UPDATE";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_CLOSE_PAREN_OWNED_BOMS =
            "), owned_boms AS MATERIALIZED (";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_SELECT_BOM_BOM_REF_DEFINITION_STATUS =
            "SELECT bom.bom_ref,bom.definition_status ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_FROM_CLAUSE_RECEIPT_LOCK_BOM =
            "FROM inventory.stock_bom bom CROSS JOIN receipt_lock ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_WHERE_BOM_DATA_NODE_REF_BRAND_REF_ITEM_REF =
            "WHERE bom.data_node_ref=? AND bom.brand_ref=? AND bom.item_ref=? ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_LOCK_FOR_UPDATE_ALTERNATE_A = "FOR UPDATE";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_CLOSE_PAREN = "), ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_AS_MATERIALIZED = " AS MATERIALIZED (";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_SELECT_BOM_BOM_REF_TARGET_REF_DEFINITION_STATUS =
            "SELECT bom.bom_ref,ot.target_ref,ot.definition_status AS target_status,";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_BOM_ITEM_CODE_SOURCE_CODE_SOURCE_ITEM =
            "bom.item_code AS source_code,source_item.name AS source_name ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_FROM_CLAUSE_RECEIPT_LOCK_BOM_ALTERNATE_A =
            "FROM inventory.stock_bom bom CROSS JOIN receipt_lock ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_LATERAL_JSONB_ARRAY_ELEMENTS_JSONB_TYPEOF_BOM_ROWS =
            "CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(bom.rows)='array' ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_THEN_BOM_ROWS_ENTRY =
            "THEN bom.rows ELSE '[]'::jsonb END) AS e(entry) ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_JOIN_OWNED_TARGETS_TARGET_REF_TEXT_ENTRY =
            "JOIN owned_targets ot ON ot.target_ref::text=COALESCE(e.entry->>'targetRef',";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_ENTRY_COMPONENT_TARGET_REF =
            "e.entry->>'componentTargetRef') ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_CATALOG_ITEM_SOURCE_ITEM_ITEM_REF_BOM =
            "LEFT JOIN catalog.catalog_item source_item ON source_item.item_ref=bom.item_ref ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONDITION_SOURCE_ITEM_DATA_NODE_REF_BRAND_REF =
            "AND source_item.data_node_ref=? AND source_item.brand_ref=? ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_WHERE_BOM_DATA_NODE_REF_BRAND_REF_DEFINITION_STATUS =
            "WHERE bom.data_node_ref=? AND bom.brand_ref=? AND bom.definition_status='ENABLED' ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONDITION_BOM_ITEM_REF =
            "AND bom.item_ref IS DISTINCT FROM ? ";
    public static final String
            INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONDITION_PRIOR_RECEIPT_AND_NOT_EXISTS_SELECT_1_FROM =
                    "AND NOT EXISTS (SELECT 1 FROM prior_receipt) ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_LOCK_OF_BOM = "FOR UPDATE OF bom";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_CLOSE_PAREN_RETIRED_TARGETS =
            "), retired_targets AS (";
    public static final String
            INVENTORY_CATALOG_LIFECYCLE_SERVICE_UPDATE_STOCK_TARGET_TARGET_DEFINITION_STATUS_DISABLED =
                    "UPDATE inventory.stock_target target SET definition_status='DISABLED',";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_VERSION_TARGET_UPDATED_AT_EPOCH_MILLIS =
            "version=target.version+1,updated_at_epoch_millis=? ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_WHERE_OWNED_TARGETS_TARGET_TARGET_REF =
            "WHERE target.target_ref IN (SELECT target_ref FROM owned_targets) ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONDITION_TARGET_DEFINITION_STATUS_ENABLED =
            "AND target.definition_status='ENABLED' ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONDITION_AND_NOT_EXISTS_SELECT_1_FROM =
            "AND NOT EXISTS (SELECT 1 FROM ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_CLOSE_PAREN_ALTERNATE_A = ") ";
    public static final String
            INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONDITION_PRIOR_RECEIPT_AND_NOT_EXISTS_SELECT_1_FROM_ALTERNATE_A =
                    "AND NOT EXISTS (SELECT 1 FROM prior_receipt) ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_RETURNING_TARGET_TARGET_REF =
            "RETURNING target.target_ref";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_CLOSE_PAREN_RETIRED_BOMS = "), retired_boms AS (";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_UPDATE_STOCK_BOM_BOM_DEFINITION_STATUS_DISABLED =
            "UPDATE inventory.stock_bom bom SET definition_status='DISABLED',";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_VERSION_BOM_UPDATED_AT_EPOCH_MILLIS =
            "version=bom.version+1,updated_at_epoch_millis=? ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_WHERE_OWNED_BOMS_BOM_BOM_REF =
            "WHERE bom.bom_ref IN (SELECT bom_ref FROM owned_boms) ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONDITION_BOM_DEFINITION_STATUS_ENABLED =
            "AND bom.definition_status='ENABLED' ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONDITION_AND_NOT_EXISTS_SELECT_1_FROM_ALTERNATE_A =
            "AND NOT EXISTS (SELECT 1 FROM ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_CLOSE_PAREN_ALTERNATE_B = ") ";
    public static final String
            INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONDITION_PRIOR_RECEIPT_AND_NOT_EXISTS_SELECT_1_FROM_ALTERNATE_B =
                    "AND NOT EXISTS (SELECT 1 FROM prior_receipt) ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_RETURNING_BOM_BOM_REF = "RETURNING bom.bom_ref";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_CLOSE_PAREN_OUTCOME = "), outcome AS (";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_SELECT = "SELECT ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_OPEN_PAREN_SELECT_COUNT_FROM =
            "(SELECT COUNT(*) FROM ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_CLOSE_PAREN_INBOUND_COUNT = ") AS inbound_count,";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_BOOL_AND_TARGET_STATUS_ENABLED =
            "COALESCE((SELECT bool_and(target_status='ENABLED' ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONDITION_NULLIF_BTRIM_SOURCE_CODE =
            "AND NULLIF(BTRIM(source_code),'') IS NOT NULL ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONDITION_NULLIF_BTRIM_SOURCE_NAME =
            "AND NULLIF(BTRIM(source_name),'') IS NOT NULL) FROM ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_CLOSE_PAREN_ALTERNATE_C = "),'') ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_INBOUND_SUMMARY = "AS inbound_summary,";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_OPEN_PAREN_RETIRED_TARGETS_RETIRED_TARGET_COUNT =
            "(SELECT COUNT(*) FROM retired_targets) AS retired_target_count,";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_OPEN_PAREN_RETIRED_BOMS_RETIRED_BOM_COUNT =
            "(SELECT COUNT(*) FROM retired_boms) AS retired_bom_count,";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_OPEN_PAREN_OWNED_TARGETS_DEFINITION_STATUS_ENABLED =
            "((SELECT COUNT(*) FROM owned_targets WHERE definition_status='ENABLED') ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_RETIRED_TARGETS_SELECT_COUNT_FROM_RETIRED_TA =
            "- (SELECT COUNT(*) FROM retired_targets) + ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_OPEN_PAREN_OWNED_BOMS_DEFINITION_STATUS_ENABLED =
            "(SELECT COUNT(*) FROM owned_boms WHERE definition_status='ENABLED') ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_RETIRED_BOMS_REMAINING_COUNT =
            "- (SELECT COUNT(*) FROM retired_boms)) AS remaining_count";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_CLOSE_PAREN_RESPONSE_PAYLOAD =
            "), response_payload AS (";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_SELECT_JSONB_BUILD_OBJECT_SUBJECT_KIND_TEXT =
            "SELECT jsonb_build_object('subject',jsonb_build_object('kind',CAST(? AS text),";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_REF =
            "'ref',CAST(? AS text)),'retiredStockTargetCount',retired_target_count,";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_RETIRED_PRODUCT_BOM_COUNT_RETIRED_BOM_COUNT =
            "'retiredProductBomCount',retired_bom_count,";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_REMAINING_ACTIVE_OWNED_DEFINITION_ =
            "'remainingActiveOwnedDefinitionCount',remaining_count) AS response ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_FROM_CLAUSE_OUTCOME =
            "FROM outcome WHERE inbound_count=0 AND inbound_resolvable AND remaining_count=0 ";
    public static final String
            INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONDITION_PRIOR_RECEIPT_AND_NOT_EXISTS_SELECT_1_FROM_ALTERNATE_C =
                    "AND NOT EXISTS (SELECT 1 FROM prior_receipt)";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_CLOSE_PAREN_WRITTEN_RECEIPT =
            "), written_receipt AS (";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_INSERT_INTO_COMMAND_RECEIPT =
            "INSERT INTO inventory.command_receipt(receipt_ref,data_node_ref,idempotency_key,";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_OPERATION_ID =
            "operation_id,request_hash,response_json,created_at_epoch_millis) ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_SELECT_RESPONSE_PAYLOAD_RESPONSE =
            "SELECT ?,?,?,?,?,response,? FROM response_payload ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_RETURNING_RESPONSE_TEXT =
            "RETURNING response_json::text AS response";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_CLOSE_PAREN_OUTCOME_ALTERNATE_A =
            ") SELECT outcome.inbound_count,outcome.inbound_resolvable,outcome.inbound_summary,";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_OUTCOME =
            "outcome.retired_target_count,outcome.retired_bom_count,outcome.remaining_count,";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_PRIOR_RECEIPT_OPERATION_ID_REQUEST_HASH_RESPONSE =
            "prior_receipt.operation_id,prior_receipt.request_hash,prior_receipt.response,";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_PRIOR_RECEIPT_WRITTEN_RECEIPT_RESPONSE =
            "written_receipt.response FROM outcome LEFT JOIN prior_receipt ON TRUE ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_WRITTEN_RECEIPT_LEFT_JOIN_WRITTEN_RECEIPT_ON =
            "LEFT JOIN written_receipt ON TRUE";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_WHERE_DATA_NODE_REF = " WHERE data_node_ref=? ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONDITION_BRAND_REF = "AND brand_ref=? AND ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_CTE_INPUT_TEXT_SCOPE_BRAND =
            "WITH input AS (SELECT ?::text AS scope, ?::text AS brand, ?::uuid[] AS subject_refs), ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_OWNED_TARGETS = "owned_targets AS (";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_SELECT_TARGET_TARGET_REF_DEFINITION_STATUS_ITEM_REF =
            "SELECT target.target_ref,target.definition_status,target.item_ref,target.product_sku_ref ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_FROM_CLAUSE_INPUT_TARGET =
            "FROM inventory.stock_target target CROSS JOIN input ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_WHERE_TARGET_DATA_NODE_REF_INPUT_SCOPE =
            "WHERE target.data_node_ref=input.scope AND target.brand_ref=input.brand ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONDITION_TARGET = "AND target.";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_INPUT_SUBJECT_REFS = "=ANY(input.subject_refs)), ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_OWNED_BOMS = "owned_boms AS (";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_SELECT_BOM_BOM_REF_DEFINITION_STATUS_ITEM_REF =
            "SELECT bom.bom_ref,bom.definition_status,bom.item_ref,bom.product_sku_ref,bom.option_value_ref ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_FROM_CLAUSE_INPUT_BOM =
            "FROM inventory.stock_bom bom CROSS JOIN input ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_WHERE_BOM_DATA_NODE_REF_INPUT_SCOPE =
            "WHERE bom.data_node_ref=input.scope AND bom.brand_ref=input.brand ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONDITION_BOM = "AND bom.";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_INPUT_SUBJECT_REFS_ALTERNATE_A =
            "=ANY(input.subject_refs)), ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_INBOUND = "inbound AS (";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_SELECT_SELECT_OT = "SELECT ot.";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_SUBJECT_REF_BOM_BOM_REF_ITEM_REF =
            " AS subject_ref,bom.bom_ref,bom.item_ref,bom.product_sku_ref,";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_BOM_OPTION_VALUE_REF_TARGET_REF_ITEM_CODE =
            "bom.option_value_ref,ot.target_ref,bom.item_code,source_item.name,ot.definition_status ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_FROM_CLAUSE_INPUT_BOM_ALTERNATE_A =
            "FROM inventory.stock_bom bom CROSS JOIN input ";
    public static final String
            INVENTORY_CATALOG_LIFECYCLE_SERVICE_LATERAL_JSONB_ARRAY_ELEMENTS_JSONB_TYPEOF_BOM_ROWS_ALTERNATE_A =
                    "CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(bom.rows)='array' ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_THEN_BOM_ROWS_ENTRY_ALTERNATE_A =
            "THEN bom.rows ELSE '[]'::jsonb END) AS e(entry) ";
    public static final String
            INVENTORY_CATALOG_LIFECYCLE_SERVICE_JOIN_OWNED_TARGETS_TARGET_REF_TEXT_ENTRY_ALTERNATE_A =
                    "JOIN owned_targets ot ON ot.target_ref::text=COALESCE(e.entry->>'targetRef',";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_ENTRY_COMPONENT_TARGET_REF_ALTERNATE_A =
            "e.entry->>'componentTargetRef') ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_CATALOG_ITEM_SOURCE_ITEM_ITEM_REF_BOM_ALTERNATE_A =
            "LEFT JOIN catalog.catalog_item source_item ON source_item.item_ref=bom.item_ref ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONDITION_SOURCE_ITEM_DATA_NODE_REF_INPUT_SCOPE =
            "AND source_item.data_node_ref=input.scope AND source_item.brand_ref=input.brand ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_WHERE_BOM_DATA_NODE_REF_INPUT_SCOPE_ALTERNATE_A =
            "WHERE bom.data_node_ref=input.scope AND bom.brand_ref=input.brand ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONDITION_BOM_DEFINITION_STATUS_ENABLED_ALTERNATE_A =
            "AND bom.definition_status='ENABLED' ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONDITION = "AND ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_CLOSE_PAREN_ALTERNATE_D = ") ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_SELECT_TARGET_FACT_KIND_TARGET_REF_FACT_REF =
            "SELECT 'TARGET' AS fact_kind,target.target_ref AS fact_ref,target.";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_SUBJECT_REF =
            " AS subject_ref,target.definition_status,NULL::uuid AS source_item_ref,NULL::uuid AS source_sku_ref,";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_SOURCE_OPTION_VALUE_REF_TARGET_TARGET_REF_TEXT =
            "NULL::uuid AS source_option_value_ref,target.target_ref AS target_ref,NULL::text AS source_code,";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_TEXT_SOURCE_NAME_TARGET_DEFINITION_STATUS =
            "NULL::text AS source_name,target.definition_status AS matched_target_status ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_FROM_CLAUSE_OWNED_TARGETS_TARGET =
            "FROM owned_targets target ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_UNION_BOM_BOM_REF =
            "UNION ALL SELECT 'BOM',bom.bom_ref,bom.";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_VALUE_SEPARATOR_BOM_DEFINITION_STATUS_TEXT =
            ",bom.definition_status,NULL::uuid,NULL::uuid,NULL::uuid,NULL::uuid,NULL::text,NULL::text,NULL::text ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_FROM_CLAUSE_OWNED_BOMS_BOM = "FROM owned_boms bom ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_UNION_INBOUND_BOM_REF_SUBJECT_REF_ENABLED =
            "UNION ALL SELECT 'INBOUND',inbound.bom_ref,inbound.subject_ref,'ENABLED',";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_INBOUND_ITEM_REF_PRODUCT_SKU_REF_OPTION_VALUE_REF =
            "inbound.item_ref,inbound.product_sku_ref,inbound.option_value_ref,inbound.target_ref,";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_INBOUND_ITEM_CODE_NAME_DEFINITION_STATUS =
            "inbound.item_code,inbound.name,inbound.definition_status FROM inbound ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_ORDER_BY_SUBJECT_REF_FACT_KIND_FACT_REF =
            "ORDER BY subject_ref,fact_kind,fact_ref";
    public static final String
            INVENTORY_CATALOG_LIFECYCLE_SERVICE_SELECT_STOCK_TARGET_TARGET_REF_DATA_NODE_REF_BRAND_REF_ALTERNATE_A =
                    "SELECT target_ref FROM inventory.stock_target WHERE data_node_ref=? AND brand_ref=? AND ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_SELECT_STOCK_BOM_BOM_REF_DATA_NODE_REF_BRAND_REF =
            "SELECT bom_ref FROM inventory.stock_bom WHERE data_node_ref=? AND brand_ref=? AND ";
    public static final String
            INVENTORY_CATALOG_LIFECYCLE_SERVICE_SELECT_STOCK_TARGET_TARGET_REF_DATA_NODE_REF_BRAND_REF_ALTERNATE_B =
                    "SELECT target_ref FROM inventory.stock_target WHERE data_node_ref=? AND brand_ref=? AND ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_SELECT_LATERAL_BOM_BOM_REF_JSONB_ARRAY_ELEMENTS =
            "SELECT bom.bom_ref FROM inventory.stock_bom bom CROSS JOIN LATERAL jsonb_array_elements(";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_CASE_JSONB_TYPEOF_BOM_ROWS_ENTRY =
            "CASE WHEN jsonb_typeof(bom.rows)='array' THEN bom.rows ELSE '[]'::jsonb END) e(entry) ";
    public static final String
            INVENTORY_CATALOG_LIFECYCLE_SERVICE_WHERE_BOM_DATA_NODE_REF_BRAND_REF_DEFINITION_STATUS_ALTERNATE_A =
                    "WHERE bom.data_node_ref=? AND bom.brand_ref=? AND bom.definition_status='ENABLED' AND ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_ENTRY_TARGET_REF_COMPONENT_TARGET_REF =
            "COALESCE(e.entry->>'targetRef',e.entry->>'componentTargetRef') IN (";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_CLOSE_PAREN_ALTERNATE_E = ") ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_ORDER_BY_BOM_BOM_REF =
            "ORDER BY bom.bom_ref FOR UPDATE";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_SELECT_STOCK_TARGET_DATA_NODE_REF_BRAND_REF =
            "SELECT (SELECT COUNT(*) FROM inventory.stock_target WHERE data_node_ref=? AND brand_ref=? AND ";
    public static final String
            INVENTORY_CATALOG_LIFECYCLE_SERVICE_SELECT_COMMAND_RECEIPT_OPERATION_ID_REQUEST_HASH_RESPONSE_TEXT =
                    "SELECT operation_id,request_hash,response_json::text FROM inventory.command_receipt WHERE data_node_ref=? ";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONDITION_IDEMPOTENCY_KEY = "AND idempotency_key=?";
    public static final String INVENTORY_CATALOG_LIFECYCLE_SERVICE_INSERT_INTO = "INSERT INTO ";

    public static final String
            INVENTORY_CATALOG_LIFECYCLE_SERVICE_INVENTORY_COMMAND_RECEIPT_RECEIPT_REF_DATA_NODE_REF_IDEMPOTENCY_KEY_OPERATION_ID_REQUEST_HASH_RESPONSE_CREATED_AT_EPOCH_MILLIS_VALUES_CAST_AS_JSONB =
                    """
    inventory.command_receipt(receipt_ref,data_node_ref,idempotency_key,operation_id,request_hash,response_json,created_at_epoch_millis) VALUES(?,?,?,?,?,CAST(? AS JSONB),?)""";
}
