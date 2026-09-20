package com.catering.v2s.inventory.application.persistence;

/** SQL text fragments owned by InventoryCopyService; B3 relocates text only and does not change execution. */
public final class InventoryCopyServiceSql {
    public static final String VALUE_SEPARATOR = ",";
    public static final String UUID_VALUE_ROW = "(?::uuid)";
    public static final String SELECT_PREFIX = "SELECT ";
    public static final String TARGET_SELECT_COLUMNS =
            "target_ref,item_ref,product_sku_ref,item_code,sku_code,measure_mode,balance,configuration::text,"
                    + "version,updated_at_epoch_millis,consumption_unit_ref,consumption_unit_code,"
                    + "consumption_unit_name,consumption_unit_dimension,consumption_unit_precision,"
                    + "counting_unit_ref,counting_unit_code,counting_unit_name,counting_unit_dimension,"
                    + "counting_unit_precision,counting_unit_conversion_factor,definition_status,inventory_mode,"
                    + "component_eligible";
    public static final String IDENTITY_OR_JOINER = " OR ";
    public static final String IDENTITY_PREDICATE = "(item_ref=? AND product_sku_ref IS NOT DISTINCT FROM ?)";
    public static final String SQL_CLOSE_PAREN = ")";
    public static final String INVENTORY_COPY_SERVICE_SELECT_CONSUMPTION_UNIT_REF = "SELECT consumption_unit_ref,consumption_unit_code,consumption_unit_name,consumption_unit_d";
    
    public static final String INVENTORY_COPY_SERVICE_FROM_CLAUSE_STOCK_TARGET_TARGET_REF = "FROM inventory.stock_target WHERE target_ref=?";
    public static final String INVENTORY_COPY_SERVICE_INSERT_INTO = "INSERT INTO ";
    
    
    public static final String INVENTORY_COPY_SERVICE_VALUE_SEPARATOR_SKU_CODE_MEASURE_MODE_INVENTORY_MODE_CONSUMPTION_UNIT_REF = ",sku_code,measure_mode,inventory_mode,consumption_unit_ref,consumption_unit_code,";
    public static final String INVENTORY_COPY_SERVICE_CONSUMPTION_UNIT_NAME = "consumption_unit_name,consumption_unit_dimension,consumption_unit_precision,";
    public static final String INVENTORY_COPY_SERVICE_COUNTING_UNIT_REF = "counting_unit_ref,counting_unit_code,counting_unit_name,counting_unit_dimension,";
    public static final String INVENTORY_COPY_SERVICE_COUNTING_UNIT_PRECISION = "counting_unit_precision,counting_unit_conversion_factor,configuration,balance,version,";
    public static final String INVENTORY_COPY_SERVICE_CREATED_AT_EPOCH_MILLIS_UPDATED_AT_EPOCH_MILLIS = "created_at_epoch_millis,updated_at_epoch_millis) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,";
    public static final String INVENTORY_COPY_SERVICE_PARAMETER_PLACEHOLDER_CAST_AS_JSONB_0_1_ON_CONFLIC = "?,?,?,?,?,?,CAST(? AS JSONB),0,1,?,?) ON CONFLICT DO NOTHING";
    public static final String INVENTORY_COPY_SERVICE_INSERT_INTO_ALTERNATE_A = "INSERT INTO ";
    
    
    
    public static final String INVENTORY_COPY_SERVICE_VALUES_VALUES_CAST_AS_JSONB_ON_CONF = "VALUES(?,?,?,?,?,?,?,?,?,?,CAST(? AS JSONB),?) ON CONFLICT ";
    public static final String INVENTORY_COPY_SERVICE_OPEN_PAREN_DATA_NODE_REF_BRAND_REF_ITEM_REF_PRODUCT_SKU_REF = "(data_node_ref,brand_ref,item_ref,(COALESCE(product_sku_ref, ";
    public static final String INVENTORY_COPY_SERVICE_OPTION_VALUE_REF = "'00000000-0000-0000-0000-000000000000'::uuid)),(COALESCE(option_value_ref, ";
    public static final String INVENTORY_COPY_SERVICE_DEFINITION_STATUS_ENABLED = "'00000000-0000-0000-0000-000000000000'::uuid))) WHERE definition_status='ENABLED' ";
    public static final String INVENTORY_COPY_SERVICE_SET_DO_UPDATE_SET = "DO UPDATE SET ";
    
    
    
    public static final String INVENTORY_COPY_SERVICE_SELECT_ITEM_ITEM_REF_CODE_NAME = "SELECT item.item_ref,item.code,item.name,sku.product_sku_ref,sku.sku_code,sku.sku_name ";
    public static final String INVENTORY_COPY_SERVICE_FROM_CLAUSE_CATALOG_SKU_ITEM_SKU = "FROM catalog.catalog_item item LEFT JOIN catalog.catalog_sku sku ";
    public static final String INVENTORY_COPY_SERVICE_JOIN_CONDITION_SKU_ITEM_REF_ITEM_DATA_NODE_REF = "ON sku.item_ref=item.item_ref WHERE item.data_node_ref=? AND item.brand_ref=? ";
    public static final String INVENTORY_COPY_SERVICE_CONDITION_ITEM_ITEM_REF = "AND item.item_ref=ANY(?::uuid[])";
    public static final String INVENTORY_COPY_SERVICE_FROM_CLAUSE_STOCK_TARGET_DATA_NODE_REF = " FROM inventory.stock_target WHERE data_node_ref=? AND ";
    public static final String INVENTORY_COPY_SERVICE_BRAND_REF_DEFINITION_STATUS_ENABLED = "brand_ref=? AND definition_status='ENABLED' AND (";
    public static final String INVENTORY_COPY_SERVICE_FROM_CLAUSE_STOCK_TARGET_DATA_NODE_REF_ALTERNATE_A = " FROM inventory.stock_target WHERE data_node_ref=? AND ";
    public static final String INVENTORY_COPY_SERVICE_BRAND_REF_DEFINITION_STATUS_ENABLED_ITEM_REF = "brand_ref=? AND definition_status='ENABLED' AND item_ref = ANY(?::uuid[]) ";
    public static final String INVENTORY_COPY_SERVICE_ORDER_BY_ITEM_REF_PRODUCT_SKU_REF = "ORDER BY item_ref,product_sku_ref ";
    public static final String INVENTORY_COPY_SERVICE_TARGET_REF = "NULLS FIRST,target_ref";
    public static final String INVENTORY_COPY_SERVICE_CONDITION_DEFINITION_STATUS_ENABLED = "AND definition_status='ENABLED' ";
    public static final String INVENTORY_COPY_SERVICE_FROM_CLAUSE_STOCK_TARGET_DATA_NODE_REF_ALTERNATE_B = " FROM inventory.stock_target WHERE data_node_ref=? AND ";
    public static final String INVENTORY_COPY_SERVICE_BRAND_REF = "brand_ref=? ";
    public static final String INVENTORY_COPY_SERVICE_CONDITION_TARGET_REF = "AND target_ref = ANY(?::uuid[])";
    public static final String INVENTORY_COPY_SERVICE_SELECT = "SELECT ";
    public static final String INVENTORY_COPY_SERVICE_ITEM_REF_PRODUCT_SKU_REF_OPTION_VALUE_REF_ITEM_CODE = "item_ref,product_sku_ref,option_value_ref,item_code,sku_code,option_value_code,";
    public static final String INVENTORY_COPY_SERVICE_STOCK_BOM_VERSION_ROWS_TEXT_DATA_NODE_REF = "version,rows::text FROM inventory.stock_bom WHERE data_node_ref=? AND brand_ref=? ";
    public static final String INVENTORY_COPY_SERVICE_CONDITION_ITEM_REF = "AND item_ref = ANY(?::uuid[]) ";
    public static final String INVENTORY_COPY_SERVICE_ORDER_BY_ITEM_REF_PRODUCT_SKU_REF_OPTION_VALUE_REF = "ORDER BY item_ref,product_sku_ref NULLS FIRST,option_value_ref NULLS FIRST";
    public static final String INVENTORY_COPY_SERVICE_SELECT_STOCK_TARGET_ITEM_REF_TARGET_REF_CONFIGURATION_TEXT = "SELECT item_ref,target_ref,configuration::text FROM inventory.stock_target WHERE data_node_ref=? AND ";
    public static final String INVENTORY_COPY_SERVICE_BRAND_REF_ITEM_REF_TARGET_REF = "brand_ref=? AND item_ref = ANY(?::uuid[]) ORDER BY item_ref,target_ref";
    public static final String INVENTORY_COPY_SERVICE_SELECT_STOCK_BOM_ROWS_TEXT_DATA_NODE_REF_BRAND_REF = "SELECT rows::text FROM inventory.stock_bom WHERE data_node_ref=? AND brand_ref=? ";
    public static final String INVENTORY_COPY_SERVICE_CONDITION_ITEM_REF_ALTERNATE_A = "AND item_ref = ANY(?::uuid[]) ";
    public static final String INVENTORY_COPY_SERVICE_ORDER_BY_ITEM_REF_PRODUCT_SKU_REF_OPTION_VALUE_REF_ALTERNATE_A = "ORDER BY item_ref,product_sku_ref NULLS FIRST,option_value_ref NULLS FIRST";
    public static final String INVENTORY_COPY_SERVICE_FROM_CLAUSE_STOCK_TARGET_DATA_NODE_REF_BRAND_REF_TARGET_REF = " FROM inventory.stock_target WHERE data_node_ref=? AND brand_ref=? AND target_ref=? ";
    public static final String INVENTORY_COPY_SERVICE_CONDITION_DEFINITION_STATUS_ENABLED_ALTERNATE_A = "AND definition_status='ENABLED'";
    public static final String INVENTORY_COPY_SERVICE_CTE_SELECTED_TARGET_REF = "WITH selected(target_ref) AS (VALUES ";
    public static final String INVENTORY_COPY_SERVICE_CLOSE_PAREN_BOUNDS_BIGINT_NOW_EPOCH = "), bounds AS (SELECT ?::bigint AS now_epoch), ";
    public static final String INVENTORY_COPY_SERVICE_AGGREGATE_TARGET_REF = "aggregate AS (SELECT l.target_ref, ";
    public static final String INVENTORY_COPY_SERVICE_DELTA_FILTER_OCCURRED_AT_EPOCH_MILLIS_NOW_EPOCH = "COALESCE(SUM(l.delta) FILTER (WHERE l.occurred_at_epoch_millis >= b.now_epoch - 86400000),0) AS ";
    public static final String INVENTORY_COPY_SERVICE_TODAY_CHANGE = "today_change, ";
    public static final String INVENTORY_COPY_SERVICE_DELTA_FILTER_OCCURRED_AT_EPOCH_MILLIS_NOW_EPOCH_ALTERNATE_A = "COALESCE(SUM(l.delta) FILTER (WHERE l.occurred_at_epoch_millis >= b.now_epoch - 604800000),0) AS ";
    public static final String INVENTORY_COPY_SERVICE_SEVEN_DAY_CHANGE = "seven_day_change, ";
    public static final String INVENTORY_COPY_SERVICE_DELTA_FILTER_OCCURRED_AT_EPOCH_MILLIS_NOW_EPOCH_ALTERNATE_B = "COALESCE(SUM(l.delta) FILTER (WHERE l.occurred_at_epoch_millis >= b.now_epoch - 2592000000),0) AS ";
    public static final String INVENTORY_COPY_SERVICE_THIRTY_DAY_CHANGE = "thirty_day_change ";
    public static final String INVENTORY_COPY_SERVICE_FROM_CLAUSE_BOUNDS_TARGET_REF = "FROM inventory.stock_ledger l JOIN selected s ON s.target_ref=l.target_ref CROSS JOIN bounds b ";
    public static final String INVENTORY_COPY_SERVICE_GROUP_BY_TARGET_REF = "GROUP BY l.target_ref), ";
    public static final String INVENTORY_COPY_SERVICE_LATEST_TARGET_REF_OPERATION_ID_OCCURRED_AT_EPOCH_MILLIS = "latest AS (SELECT l.target_ref,l.operation_id,l.occurred_at_epoch_millis,ROW_NUMBER() OVER ";
    public static final String INVENTORY_COPY_SERVICE_OPEN_PAREN_TARGET_REF_OCCURRED_AT_EPOCH_MILLIS_ENTRY_REF = "(PARTITION BY l.target_ref ORDER BY l.occurred_at_epoch_millis DESC,l.entry_ref DESC) AS ";
    public static final String INVENTORY_COPY_SERVICE_ROW_NUMBER_WINDOW_FUNCTION = "row_number ";
    public static final String INVENTORY_COPY_SERVICE_FROM_CLAUSE_SELECTED_TARGET_REF = "FROM inventory.stock_ledger l JOIN selected s ON s.target_ref=l.target_ref) ";
    public static final String INVENTORY_COPY_SERVICE_SELECT_ALTERNATE_A = "SELECT ";
    
    
    public static final String INVENTORY_COPY_SERVICE_FROM_CLAUSE_LATEST_TARGET_REF = "FROM selected s LEFT JOIN aggregate a ON a.target_ref=s.target_ref LEFT JOIN latest ON ";
    public static final String INVENTORY_COPY_SERVICE_LATEST_TARGET_REF = "latest.target_ref=s.target_ref AND latest.row_number=1";
    public static final String INVENTORY_COPY_SERVICE_SELECT_STOCK_TARGET_VERSION_DATA_NODE_REF_BRAND_REF = "SELECT COALESCE(MAX(version),0) FROM inventory.stock_target WHERE data_node_ref=? AND brand_ref=?";
    public static final String INVENTORY_COPY_SERVICE_SELECT_COMMAND_RECEIPT_OPERATION_ID_REQUEST_HASH_RESPONSE_TEXT = "SELECT operation_id,request_hash,response_json::text FROM inventory.command_receipt WHERE data_node_ref=? ";
    public static final String INVENTORY_COPY_SERVICE_CONDITION_IDEMPOTENCY_KEY = "AND idempotency_key=?";
    public static final String INVENTORY_COPY_SERVICE_INSERT_INTO_ALTERNATE_B = "INSERT INTO ";
    
    
    
    public static final String INVENTORY_COPY_SERVICE_SELECT_CONSUMPTION_UNIT_REF_CONSUMPTION_UNIT_CODE_CONSUMPTION_UNIT_NAME_CONSUMPTION_UNIT_DIMENSION_CONSUMPTION_UNIT_PRECISION_CONSUMPTION_UNIT_NAME_CONSUMPTION_UNIT_DIMENSION_CONSUMPTION_UNIT_PRECISION = """
    SELECT consumption_unit_ref,consumption_unit_code,consumption_unit_name,consumption_unit_dimension,consumption_unit_precision\s""";
    public static final String INVENTORY_COPY_SERVICE_INVENTORY_STOCK_TARGET_TARGET_REF_DATA_NODE_REF_BRAND_REF_ITEM_REF_PRODUCT_SKU_REF_ITEM_CODE_BRAND_REF_ITEM_REF_PRODUCT_SKU_REF_ITEM_CODE = """
    inventory.stock_target(target_ref,data_node_ref,brand_ref,item_ref,product_sku_ref,item_code""";
    public static final String INVENTORY_COPY_SERVICE_INVENTORY_STOCK_BOM_BOM_REF_DATA_NODE_REF_BRAND_REF_ITEM_REF_PRODUCT_SKU_REF_OPTION_VALUE_REF_ITEM_CODE_SKU_CODE_OPTION_VALUE_CODE_VERSION_ROWS_UPDATED_AT_EPOCH_MILLIS = """
    inventory.stock_bom(bom_ref,data_node_ref,brand_ref,item_ref,product_sku_ref,option_value_ref,item_code,sku_code,option_value_code,version,rows,updated_at_epoch_millis)\s""";
    public static final String INVENTORY_COPY_SERVICE_VERSION_EXCLUDED_VERSION_ROWS_EXCLUDED_ROWS_UPDATED_AT_EPOCH_MILLIS_EXCLUDED_UPDATED_AT_EPOCH_MILLIS_ROWS_UPDATED_AT_EPOCH_MILLIS_EXCLUDED_UPDATED_AT_EPOCH_MILLIS = """
    version=EXCLUDED.version,rows=EXCLUDED.rows,updated_at_epoch_millis=EXCLUDED.updated_at_epoch_millis""";
    public static final String INVENTORY_COPY_SERVICE_S_TARGET_REF_A_TODAY_CHANGE_A_SEVEN_DAY_CHANGE_A_THIRTY_DAY_CHANGE_LATEST_OPERATION_ID_LATEST_OPERATION_ID_LATEST_OCCURRED_AT_EPOCH_MILLIS = """
    s.target_ref,a.today_change,a.seven_day_change,a.thirty_day_change,latest.operation_id,latest.occurred_at_epoch_millis\s""";
    public static final String INVENTORY_COPY_SERVICE_INVENTORY_COMMAND_RECEIPT_RECEIPT_REF_DATA_NODE_REF_IDEMPOTENCY_KEY_OPERATION_ID_REQUEST_HASH_RESPONSE_CREATED_AT_EPOCH_MILLIS_VALUES_CAST_AS_JSONB = """
    inventory.command_receipt(receipt_ref,data_node_ref,idempotency_key,operation_id,request_hash,response_json,created_at_epoch_millis) VALUES(?,?,?,?,?,CAST(? AS JSONB),?)""";

}
