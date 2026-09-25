package com.catering.v2s.catalog.application.persistence;

/** SQL text fragments owned by CatalogDictionaryService; B3 relocates text only and does not change execution. */
public final class CatalogDictionaryServiceSql {
    public static final String PARAMETER_PLACEHOLDER = "?";
    public static final String PLACEHOLDER_SEPARATOR = ",";
    public static final String SKU_ATTRIBUTE_REF_COLUMN = "relation.attribute_ref";
    public static final String SKU_ATTRIBUTE_VALUE_REF_COLUMN = "relation.attribute_value_ref";
    public static final String CATALOG_DICTIONARY_SERVICE_SELECT_DICTIONARY_ENTRY_VERSION_DATA_NODE_REF_BRAND_REF =
            "SELECT version FROM catalog.dictionary_entry WHERE data_node_ref=? AND brand_ref=? AND ";
    public static final String CATALOG_DICTIONARY_SERVICE_DICTIONARY_KIND_CODE = "dictionary_kind=? AND code=?";
    public static final String CATALOG_DICTIONARY_SERVICE_INSERT_INTO_DICTIONARY_ENTRY_INSERT_INTO_CATALOG_DICTIONA =
            "INSERT INTO catalog.dictionary_entry ";
    public static final String CATALOG_DICTIONARY_SERVICE_OPEN_PAREN_ENTRY_REF_DATA_NODE_REF_BRAND_REF_DICTIONARY_KIND =
            "(entry_ref,data_node_ref,brand_ref,dictionary_kind,code,name,parent_entry_ref,display_or";

    public static final String CATALOG_DICTIONARY_SERVICE_UPDATE_DICTIONARY_ENTRY_NAME_VERSION_UPDATED_AT_EPOCH_MILLIS =
            "UPDATE catalog.dictionary_entry SET name=?,version=version+1,updated_at_epoch_millis=? WHERE ";
    public static final String CATALOG_DICTIONARY_SERVICE_DATA_NODE_REF_BRAND_REF_DICTIONARY_KIND_CODE =
            "data_node_ref=? AND brand_ref=? AND dictionary_kind=? AND code=? AND version=? AND ";
    public static final String CATALOG_DICTIONARY_SERVICE_STATUS_VOIDED = "status <> 'VOIDED'";
    public static final String
            CATALOG_DICTIONARY_SERVICE_UPDATE_DICTIONARY_ENTRY_DISPLAY_ORDER_VERSION_UPDATED_AT_EPOCH_MILLIS =
                    "UPDATE catalog.dictionary_entry SET display_order=?,version=version+1,updated_at_epoch_millis=? ";
    public static final String CATALOG_DICTIONARY_SERVICE_WHERE_DATA_NODE_REF_BRAND_REF_DICTIONARY_KIND_CODE =
            "WHERE data_node_ref=? AND brand_ref=? AND dictionary_kind=? AND code=?";
    public static final String
            CATALOG_DICTIONARY_SERVICE_UPDATE_DICTIONARY_ENTRY_STATUS_VERSION_UPDATED_AT_EPOCH_MILLIS =
                    "UPDATE catalog.dictionary_entry SET status=?,version=version+1,updated_at_epoch_millis=? ";
    public static final String
            CATALOG_DICTIONARY_SERVICE_WHERE_DATA_NODE_REF_BRAND_REF_DICTIONARY_KIND_CODE_ALTERNATE_A =
                    "WHERE data_node_ref=? AND brand_ref=? AND dictionary_kind=? AND code=? AND ";
    public static final String CATALOG_DICTIONARY_SERVICE_VERSION_STATUS_VOIDED = "version=? AND status <> 'VOIDED'";
    public static final String CATALOG_DICTIONARY_SERVICE_WHERE_DISPLAY_ORDER_ENTRY_REF =
            " WHERE display_order > ? OR (display_order = ? AND entry_ref > ?)";
    public static final String CATALOG_DICTIONARY_SERVICE_CTE_MATCHING_ENTRY_REF_CODE_NAME =
            "WITH matching AS (SELECT entry_ref,code,name,status,parent_entry_ref,display_order,version,";
    public static final String
            CATALOG_DICTIONARY_SERVICE_UPDATE_DICTIONARY_ENTRY_UPDATED_AT_EPOCH_MILLIS_DATA_NODE_REF =
                    "updated_at_epoch_millis FROM catalog.dictionary_entry WHERE data_node_ref=? ";
    public static final String CATALOG_DICTIONARY_SERVICE_CONDITION_BRAND_REF_DICTIONARY_KIND =
            "AND brand_ref=? AND dictionary_kind=? AND ";
    public static final String CATALOG_DICTIONARY_SERVICE_OPEN_PAREN_PARENT_ENTRY_REF =
            "(?::uuid IS NULL OR parent_entry_ref=?) ";
    public static final String CATALOG_DICTIONARY_SERVICE_CONDITION_CODE_CHR_NAME_ILIKE =
            "AND (? = '' OR (code || chr(1) || name) ILIKE '%' || ? || '%') ";
    public static final String CATALOG_DICTIONARY_SERVICE_CONDITION_TEXT_STATUS =
            "AND (?::text IS NULL OR status=?)), ";
    public static final String CATALOG_DICTIONARY_SERVICE_AGGREGATE_TOTAL_VERSION =
            "aggregate AS (SELECT COUNT(*) AS total, COALESCE(MAX(version),0) AS ";
    public static final String CATALOG_DICTIONARY_SERVICE_MATCHING_GENERATION = "generation FROM matching), ";
    public static final String CATALOG_DICTIONARY_SERVICE_PAGED_ENTRY_REF_CODE_NAME =
            "paged AS (SELECT entry_ref,code,name,status,parent_entry_ref,display_order,version,";
    public static final String CATALOG_DICTIONARY_SERVICE_UPDATE_MATCHING_UPDATED_AT_EPOCH_MILLIS =
            "updated_at_epoch_millis FROM matching";
    public static final String CATALOG_DICTIONARY_SERVICE_ORDER_BY_DISPLAY_ORDER_ENTRY_REF =
            " ORDER BY display_order, entry_ref LIMIT ?) ";
    public static final String CATALOG_DICTIONARY_SERVICE_SELECT_ENTRY_REF_CODE_NAME_STATUS =
            "SELECT p.entry_ref,p.code,p.name,p.status,p.parent_entry_ref,p.display_order,p.version,";
    public static final String CATALOG_DICTIONARY_SERVICE_UPDATED_AT_EPOCH_MILLIS = "p.updated_at_epoch_millis,";
    public static final String CATALOG_DICTIONARY_SERVICE_PAGED_TOTAL_GENERATION_DISPLAY_ORDER =
            "a.total,a.generation FROM aggregate a LEFT JOIN paged p ON TRUE ORDER BY p.display_order NULLS LAST,";
    public static final String CATALOG_DICTIONARY_SERVICE_ENTRY_REF = "p.entry_ref";
    public static final String CATALOG_DICTIONARY_SERVICE_SELECT_ENTRY_REF_DICTIONARY_KIND_CODE_NAME =
            "SELECT entry_ref,dictionary_kind,code,name,status,parent_entry_ref,display_order,version FROM ";
    public static final String CATALOG_DICTIONARY_SERVICE_DICTIONARY_ENTRY_DATA_NODE_REF_BRAND_REF_DICTIONARY_KIND =
            "catalog.dictionary_entry WHERE data_node_ref=? AND brand_ref=? AND dictionary_kind=? ORDER ";
    public static final String CATALOG_DICTIONARY_SERVICE_ENTRY_REF_ALTERNATE_A = "BY entry_ref FOR UPDATE";
    public static final String CATALOG_DICTIONARY_SERVICE_SELECT_DICTIONARY_ENTRY_DISPLAY_ORDER_DATA_NODE_REF =
            "SELECT COALESCE(MAX(display_order), -1) + 1 FROM catalog.dictionary_entry WHERE data_node_ref=? AND ";
    public static final String CATALOG_DICTIONARY_SERVICE_BRAND_REF_DICTIONARY_KIND =
            "brand_ref=? AND dictionary_kind=?";
    public static final String CATALOG_DICTIONARY_SERVICE_SELECT_SELECT_DISTINCT = "SELECT DISTINCT ";
    public static final String CATALOG_DICTIONARY_SERVICE_FROM_CLAUSE_CATALOG_SKU_RELATION_SKU =
            " FROM catalog.catalog_sku_attribute_value relation JOIN catalog.catalog_sku sku ON ";
    public static final String CATALOG_DICTIONARY_SERVICE_CATALOG_ITEM_SKU_PRODUCT_SKU_REF_RELATION_ITEM =
            "sku.product_sku_ref=relation.product_sku_ref JOIN catalog.catalog_item item ON ";
    public static final String CATALOG_DICTIONARY_SERVICE_ITEM_ITEM_REF_SKU_DATA_NODE_REF =
            "item.item_ref=sku.item_ref WHERE item.data_node_ref=? AND item.brand_ref=? AND ";
    public static final String CATALOG_DICTIONARY_SERVICE_ITEM_STATUS_VOIDED = "item.status <> 'VOIDED' AND ";
    public static final String CATALOG_DICTIONARY_SERVICE_SELECT_DICTIONARY_ENTRY_ENTRY_REF_DATA_NODE_REF =
            "SELECT EXISTS (SELECT 1 FROM catalog.dictionary_entry WHERE entry_ref=? AND data_node_ref=? AND ";
    public static final String CATALOG_DICTIONARY_SERVICE_BRAND_REF_DICTIONARY_KIND_SKU_ATTRIBUTE =
            "brand_ref=? AND dictionary_kind='SKU_ATTRIBUTE')";
    public static final String
            CATALOG_DICTIONARY_SERVICE_SELECT_DICTIONARY_ENTRY_NAME_DATA_NODE_REF_BRAND_REF_DICTIONARY_KIND =
                    "SELECT name FROM catalog.dictionary_entry WHERE data_node_ref=? AND brand_ref=? AND dictionary_kind=? ";
    public static final String CATALOG_DICTIONARY_SERVICE_CONDITION_CODE = "AND code=?";
    public static final String CATALOG_DICTIONARY_SERVICE_SELECT_DICTIONARY_ENTRY_STATUS_DATA_NODE_REF_BRAND_REF =
            "SELECT status FROM catalog.dictionary_entry WHERE data_node_ref=? AND brand_ref=? AND ";
    public static final String CATALOG_DICTIONARY_SERVICE_DICTIONARY_KIND_CODE_ALTERNATE_A =
            "dictionary_kind=? AND code=?";
    public static final String
            CATALOG_DICTIONARY_SERVICE_SELECT_DICTIONARY_ENTRY_PARENT_ENTRY_REF_DATA_NODE_REF_BRAND_REF =
                    "SELECT parent_entry_ref FROM catalog.dictionary_entry WHERE data_node_ref=? AND brand_ref=? AND ";
    public static final String CATALOG_DICTIONARY_SERVICE_DICTIONARY_KIND_CODE_ALTERNATE_B =
            "dictionary_kind=? AND code=?";
    public static final String CATALOG_DICTIONARY_SERVICE_SELECT_DICTIONARY_ENTRY_ENTRY_REF_DATA_NODE_REF_BRAND_REF =
            "SELECT entry_ref FROM catalog.dictionary_entry WHERE data_node_ref=? AND brand_ref=? AND ";
    public static final String CATALOG_DICTIONARY_SERVICE_DICTIONARY_KIND_CODE_ALTERNATE_C =
            "dictionary_kind=? AND code=?";
    public static final String CATALOG_DICTIONARY_SERVICE_SELECT_CATALOG_ITEM_VERSION_DATA_NODE_REF_BRAND_REF =
            "SELECT COALESCE(MAX(version),0) FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=?";
    public static final String
            CATALOG_DICTIONARY_SERVICE_SELECT_DICTIONARY_ENTRY_VERSION_DATA_NODE_REF_BRAND_REF_ALTERNATE_A =
                    "SELECT COALESCE(MAX(version),0) FROM catalog.dictionary_entry WHERE data_node_ref=? AND brand_ref=? ";
    public static final String CATALOG_DICTIONARY_SERVICE_CONDITION_DICTIONARY_KIND = "AND dictionary_kind=?";
    public static final String
            CATALOG_DICTIONARY_SERVICE_SELECT_COMMAND_RECEIPT_OPERATION_ID_REQUEST_HASH_RESPONSE_TEXT =
                    "SELECT operation_id,request_hash,response_json::text FROM catalog.command_receipt WHERE data_node_ref=? ";
    public static final String CATALOG_DICTIONARY_SERVICE_CONDITION_IDEMPOTENCY_KEY = "AND idempotency_key=?";
    public static final String CATALOG_DICTIONARY_SERVICE_INSERT_INTO_COMMAND_RECEIPT =
            "INSERT INTO catalog.command_receipt(receipt_ref,data_node_ref,idempotency_key,operation_id,request_hash,";
    public static final String CATALOG_DICTIONARY_SERVICE_RESPONSE_CREATED_AT_EPOCH_MILLIS =
            "response_json,created_at_epoch_millis) VALUES(?,?,?,?,?,CAST(? AS JSONB),?)";
    public static final String CATALOG_DICTIONARY_SERVICE_IN_LIST_PREFIX = " IN (";
    public static final String CATALOG_DICTIONARY_SERVICE_CLOSE_PAREN = ")";
    public static final String
            CATALOG_DICTIONARY_SERVICE_ENTRY_REF_DATA_NODE_REF_BRAND_REF_DICTIONARY_KIND_CODE_NAME_CREATED_AT_EPOCH_MILLIS_UPDATED_AT_EPOCH_MILLIS_VALUES =
                    """
    (entry_ref,data_node_ref,brand_ref,dictionary_kind,code,name,parent_entry_ref,display_order,created_at_epoch_millis,updated_at_epoch_millis) VALUES (?,?,?,?,?,?,?,?,?,?)""";
}
