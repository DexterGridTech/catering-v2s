package com.catering.v2s.inventory.application.persistence;

/** SQL text fragments owned by InventoryBomService; B3 relocates text only and does not change execution. */
public final class InventoryBomServiceSql {
    public static final String PARAMETER_PLACEHOLDER = "?";
    public static final String PLACEHOLDER_SEPARATOR = ",";
    public static final String SQL_CLOSE_PAREN = ")";
    public static final String SQL_CLOSE_PAREN_WITH_SPACE = ") ";
    public static final String TARGET_SELECT_COLUMNS =
            "target_ref,item_ref,product_sku_ref,item_code,sku_code,measure_mode,balance,configuration::text,"
                    + "version,updated_at_epoch_millis,consumption_unit_ref,consumption_unit_code,"
                    + "consumption_unit_name,consumption_unit_dimension,consumption_unit_precision,"
                    + "counting_unit_ref,counting_unit_code,counting_unit_name,counting_unit_dimension,"
                    + "counting_unit_precision,counting_unit_conversion_factor,definition_status,inventory_mode,"
                    + "component_eligible";
    public static final String INVENTORY_BOM_SERVICE_SELECT_CONSUMPTION_UNIT_REF =
            "SELECT consumption_unit_ref,consumption_unit_code,consumption_unit_name,consumption_unit_d";

    public static final String INVENTORY_BOM_SERVICE_FROM_CLAUSE_STOCK_TARGET_TARGET_REF =
            "FROM inventory.stock_target WHERE target_ref=?";
    public static final String INVENTORY_BOM_SERVICE_SELECT_COUNTING_UNIT_REF =
            "SELECT counting_unit_ref,counting_unit_code,counting_unit_name,counting_unit_dimension,cou";

    public static final String INVENTORY_BOM_SERVICE_FROM_CLAUSE_STOCK_TARGET_TARGET_REF_ALTERNATE_A =
            "FROM inventory.stock_target WHERE target_ref=?";
    public static final String INVENTORY_BOM_SERVICE_SELECT_ITEM_ITEM_REF_CODE_NAME =
            "SELECT item.item_ref,item.code,item.name,sku.product_sku_ref,sku.sku_code,sku.sku_name ";
    public static final String INVENTORY_BOM_SERVICE_FROM_CLAUSE_CATALOG_SKU_ITEM_SKU =
            "FROM catalog.catalog_item item LEFT JOIN catalog.catalog_sku sku ";
    public static final String INVENTORY_BOM_SERVICE_JOIN_CONDITION_SKU_ITEM_REF_ITEM_DATA_NODE_REF =
            "ON sku.item_ref=item.item_ref WHERE item.data_node_ref=? AND item.brand_ref=? ";
    public static final String INVENTORY_BOM_SERVICE_CONDITION_ITEM_ITEM_REF = "AND item.item_ref=ANY(?::uuid[])";
    public static final String INVENTORY_BOM_SERVICE_UPDATE_STOCK_TARGET_CONFIGURATION =
            "UPDATE inventory.stock_target SET configuration=CAST(? AS JSONB),";
    public static final String INVENTORY_BOM_SERVICE_COUNTING_UNIT_REF_COUNTING_UNIT_CODE_COUNTING_UNIT_NAME =
            "counting_unit_ref=?,counting_unit_code=?,counting_unit_name=?,";
    public static final String INVENTORY_BOM_SERVICE_COUNTING_UNIT_DIMENSION_COUNTING_UNIT_PRECISION =
            "counting_unit_dimension=?,counting_unit_precision=?,";

    public static final String INVENTORY_BOM_SERVICE_CONDITION = "AND ";
    public static final String INVENTORY_BOM_SERVICE_BRAND_REF_TARGET_REF_VERSION =
            "brand_ref=? AND target_ref=? AND version=?";
    public static final String INVENTORY_BOM_SERVICE_INSERT_INTO = "INSERT INTO ";
    public static final String INVENTORY_BOM_SERVICE_STOCK_TARGET_TARGET_REF_DATA_NODE_REF_BRAND_REF =
            "inventory.stock_target(target_ref,data_node_ref,brand_ref,item_ref,product_sku_ref,item_code";
    public static final String INVENTORY_BOM_SERVICE_VALUE_SEPARATOR_SKU = ",sku";

    public static final String INVENTORY_BOM_SERVICE_COUNTING_UNIT_REF =
            "counting_unit_ref,counting_unit_code,counting_unit_name,counting_unit_dimension,";
    public static final String INVENTORY_BOM_SERVICE_COUNTING_UNIT_PRECISION =
            "counting_unit_precision,counting_unit_conversion_factor,configuration,balance,version,";
    public static final String INVENTORY_BOM_SERVICE_DEFINITION_STATUS_CREATED_AT_EPOCH_MILLIS_UPDATED_AT_EPOCH_MILLIS =
            "definition_status,created_at_epoch_millis,updated_at_epoch_millis)";
    public static final String INVENTORY_BOM_SERVICE_VALUES_ENABLED =
            " VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CAST(? AS JSONB),0,1,'ENABLED',?,?)";
    public static final String INVENTORY_BOM_SERVICE_JOIN_CONDITION_ON_CONFLICT_DO_NOTHING = " ON CONFLICT DO NOTHING";
    public static final String INVENTORY_BOM_SERVICE_SELECT_STOCK_TARGET_TARGET_REF_DATA_NODE_REF_BRAND_REF =
            "SELECT target_ref FROM inventory.stock_target WHERE data_node_ref=? AND brand_ref=? ";
    public static final String INVENTORY_BOM_SERVICE_CONDITION_ITEM_REF_TARGET_REF =
            "AND item_ref=? ORDER BY target_ref FOR UPDATE";
    public static final String INVENTORY_BOM_SERVICE_SELECT = "SELECT";
    public static final String INVENTORY_BOM_SERVICE_ITEM_REF_TARGET_REF_CONSUMPTION_UNIT_REF_CONSUMPTION_UNIT_CODE =
            " item_ref,target_ref,consumption_unit_ref,consumption_unit_code,";
    public static final String INVENTORY_BOM_SERVICE_CONSUMPTION_UNIT_NAME = " consumption_unit_name,";
    public static final String INVENTORY_BOM_SERVICE_CONSUMPTION_UNIT_DIMENSION_CONSUMPTION_UNIT_PRECISION =
            "consumption_unit_dimension,consumption_unit_precision";
    public static final String INVENTORY_BOM_SERVICE_FROM_CLAUSE_STOCK_TARGET_DATA_NODE_REF =
            " FROM inventory.stock_target WHERE data_node_ref=? AND";
    public static final String INVENTORY_BOM_SERVICE_BRAND_REF_ITEM_REF = " brand_ref=? AND item_ref IN (";
    public static final String INVENTORY_BOM_SERVICE_CLOSE_PAREN = ") ";
    public static final String INVENTORY_BOM_SERVICE_ORDER_BY_ITEM_REF_TARGET_REF = "ORDER BY item_ref,target_ref";
    public static final String INVENTORY_BOM_SERVICE_DELETE_STOCK_BOM_DATA_NODE_REF_BRAND_REF_OPTION_VALUE_REF =
            "DELETE FROM inventory.stock_bom WHERE data_node_ref=? AND brand_ref=? AND option_value_ref IN (";
    public static final String
            INVENTORY_BOM_SERVICE_SELECT_PRODUCT_SKU_REF_OPTION_VALUE_REF_SKU_CODE_OPTION_VALUE_CODE =
                    "SELECT product_sku_ref,option_value_ref,sku_code,option_value_code,version,rows::text FROM ";
    public static final String INVENTORY_BOM_SERVICE_STOCK_BOM_DATA_NODE_REF_BRAND_REF_ITEM_REF =
            "inventory.stock_bom WHERE data_node_ref=? AND brand_ref=? AND item_ref=? ";
    public static final String INVENTORY_BOM_SERVICE_CONDITION_PRODUCT_SKU_REF_OPTION_VALUE_REF =
            "AND product_sku_ref IS NULL AND option_value_ref IN (";
    public static final String INVENTORY_BOM_SERVICE_CLOSE_PAREN_ALTERNATE_A = ") ";
    public static final String INVENTORY_BOM_SERVICE_ORDER_BY_OPTION_VALUE_REF = "ORDER BY option_value_ref FOR UPDATE";
    public static final String INVENTORY_BOM_SERVICE_INSERT_INTO_STOCK_BOM_BOM_REF_DATA_NODE_REF_BRAND_REF_ITEM_REF =
            "INSERT INTO inventory.stock_bom(bom_ref,data_node_ref,brand_ref,item_ref,product_sku_ref,optio";

    public static final String INVENTORY_BOM_SERVICE_ITEM_CODE_SKU_CODE_OPTION_VALUE_CODE_VERSION =
            "item_code,sku_code,option_value_code,version,rows,updated_at_epoch_millis) VALUES(?,";
    public static final String INVENTORY_BOM_SERVICE_PARAMETER_PLACEHOLDER_CAST_AS_JSONB =
            "?,?,?,?,?,?,?,?,?,CAST(? AS JSONB),?) ";
    public static final String INVENTORY_BOM_SERVICE_JOIN_CONDITION_DATA_NODE_REF_BRAND_REF_ITEM_REF_PRODUCT_SKU_REF =
            "ON CONFLICT (data_node_ref,brand_ref,item_ref,(COALESCE(product_sku_ref,'00000000-00";
    public static final String INVENTORY_BOM_SERVICE_00_0000_0000_000000000000_UU =
            "00-0000-0000-000000000000'::uuid)),";
    public static final String INVENTORY_BOM_SERVICE_OPEN_PAREN_OPTION_VALUE_REF =
            "(COALESCE(option_value_ref,'00000000-0000-0000-0000-000000000000'::uuid))) ";
    public static final String INVENTORY_BOM_SERVICE_WHERE_DEFINITION_STATUS_ENABLED =
            "WHERE definition_status='ENABLED' DO NOTHING";
    public static final String INVENTORY_BOM_SERVICE_SELECT_ALTERNATE_A = "SELECT ";
    public static final String INVENTORY_BOM_SERVICE_OPEN_PAREN_STOCK_TARGET_LEDGER_TARGET =
            "(SELECT COUNT(*) FROM inventory.stock_ledger ledger JOIN inventory.stock_target target ";
    public static final String INVENTORY_BOM_SERVICE_JOIN_CONDITION_TARGET_TARGET_REF_LEDGER =
            "ON target.target_ref=ledger.target_ref WHERE ledger.target_ref=? ";
    public static final String INVENTORY_BOM_SERVICE_CONDITION_TARGET_DATA_NODE_REF_BRAND_REF =
            "AND target.data_node_ref=? AND target.brand_ref=?), ";
    public static final String INVENTORY_BOM_SERVICE_OPEN_PAREN_LATERAL_BOM_JSONB_ARRAY_ELEMENTS =
            "(SELECT COUNT(*) FROM inventory.stock_bom bom CROSS JOIN LATERAL jsonb_array_elements(";
    public static final String INVENTORY_BOM_SERVICE_CASE_JSONB_TYPEOF_BOM_ROWS_LINE =
            "CASE WHEN jsonb_typeof(bom.rows)='array' THEN bom.rows ELSE '[]'::jsonb END) line ";
    public static final String INVENTORY_BOM_SERVICE_WHERE_BOM_DATA_NODE_REF_BRAND_REF_DEFINITION_STATUS =
            "WHERE bom.data_node_ref=? AND bom.brand_ref=? AND bom.definition_status='ENABLED' ";
    public static final String INVENTORY_BOM_SERVICE_CONDITION_LINE_TARGET_REF = "AND line->>'targetRef'=?)";
    public static final String INVENTORY_BOM_SERVICE_UPDATE_STOCK_TARGET_MEASURE_MODE_INVENTORY_MODE_DIRECT =
            "UPDATE inventory.stock_target SET measure_mode=?,inventory_mode='DIRECT',";
    public static final String INVENTORY_BOM_SERVICE_CONFIGURATION = "configuration=CAST(? AS JSONB),";
    public static final String INVENTORY_BOM_SERVICE_COUNTING_UNIT_REF_ALTERNATE_A =
            "counting_unit_ref=?,counting_unit_code=?,counting_unit_name=?,counting_unit_dimension=?,";
    public static final String INVENTORY_BOM_SERVICE_COUNTING_UNIT_PRECISION_ALTERNATE_A =
            "counting_unit_precision=?,counting_unit_conversion_factor=?,component_eligible=?,";
    public static final String INVENTORY_BOM_SERVICE_VERSION_UPDATED_AT_EPOCH_MILLIS =
            "version=?,updated_at_epoch_millis=? ";
    public static final String INVENTORY_BOM_SERVICE_WHERE_TARGET_REF_DATA_NODE_REF_BRAND_REF_DEFINITION_STATUS =
            "WHERE target_ref=? AND data_node_ref=? AND brand_ref=? AND definition_status='ENABLED'";
    public static final String
            INVENTORY_BOM_SERVICE_INSERT_INTO_STOCK_TARGET_TARGET_REF_DATA_NODE_REF_BRAND_REF_ITEM_REF =
                    "INSERT INTO inventory.stock_target(target_ref,data_node_ref,brand_ref,item_ref,product_sku_ref,";
    public static final String INVENTORY_BOM_SERVICE_ITEM_CODE_SKU_CODE_MEASURE_MODE_INVENTORY_MODE =
            "item_code,sku_code,measure_mode,inventory_mode,consumption_unit_ref,consumption_unit_code,";
    public static final String INVENTORY_BOM_SERVICE_CONSUMPTION_UNIT_NAME_ALTERNATE_A = "consumption_unit_name,";
    public static final String INVENTORY_BOM_SERVICE_CONSUMPTION_UNIT_DIMENSION =
            "consumption_unit_dimension,consumption_unit_precision,counting_unit_ref,counting_unit_code,";
    public static final String INVENTORY_BOM_SERVICE_COUNTING_UNIT_NAME =
            "counting_unit_name,counting_unit_dimension,counting_unit_precision,";
    public static final String INVENTORY_BOM_SERVICE_COUNTING_UNIT_CONVERSION_FACTOR =
            "counting_unit_conversion_factor,";
    public static final String INVENTORY_BOM_SERVICE_COMPONENT_ELIGIBLE_CONFIGURATION_BALANCE_VERSION =
            "component_eligible,configuration,balance,version,definition_status,created_at_epoch_millis,";
    public static final String INVENTORY_BOM_SERVICE_UPDATE_UPDATED_AT_EPOCH_MILLIS = "updated_at_epoch_millis) ";
    public static final String INVENTORY_BOM_SERVICE_VALUES_ENABLED_ALTERNATE_A =
            "VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CAST(? AS JSONB),0,1,'ENABLED',?,?)";
    public static final String INVENTORY_BOM_SERVICE_UPDATE_STOCK_BOM_ROWS_VERSION_UPDATED_AT_EPOCH_MILLIS =
            "UPDATE inventory.stock_bom SET rows=CAST(? AS JSONB),version=?,updated_at_epoch_millis=? ";
    public static final String INVENTORY_BOM_SERVICE_WHERE_BOM_REF_DATA_NODE_REF_BRAND_REF_DEFINITION_STATUS =
            "WHERE bom_ref=? AND data_node_ref=? AND brand_ref=? AND definition_status='ENABLED'";
    public static final String
            INVENTORY_BOM_SERVICE_INSERT_INTO_STOCK_BOM_BOM_REF_DATA_NODE_REF_BRAND_REF_ITEM_REF_ALTERNATE_A =
                    "INSERT INTO inventory.stock_bom(bom_ref,data_node_ref,brand_ref,item_ref,product_sku_ref,";
    public static final String INVENTORY_BOM_SERVICE_OPTION_VALUE_REF_ITEM_CODE_SKU_CODE_OPTION_VALUE_CODE =
            "option_value_ref,item_code,sku_code,option_value_code,version,rows,definition_status,";
    public static final String INVENTORY_BOM_SERVICE_UPDATE_UPDATED_AT_EPOCH_MILLIS_ALTERNATE_A =
            "updated_at_epoch_millis) ";
    public static final String INVENTORY_BOM_SERVICE_VALUES_ENABLED_ALTERNATE_B =
            "VALUES(?,?,?,?,?,?,?,?,?,1,CAST(? AS JSONB),'ENABLED',?)";
    public static final String INVENTORY_BOM_SERVICE_UPDATE_STOCK_TARGET_DEFINITION_STATUS_DISABLED_VERSION =
            "UPDATE inventory.stock_target SET definition_status='DISABLED',version=version+1,";
    public static final String INVENTORY_BOM_SERVICE_UPDATE_UPDATED_AT_EPOCH_MILLIS_ALTERNATE_B =
            "updated_at_epoch_millis=? ";
    public static final String INVENTORY_BOM_SERVICE_WHERE_TARGET_REF = "WHERE target_ref IN (";
    public static final String INVENTORY_BOM_SERVICE_UPDATE_STOCK_BOM_DEFINITION_STATUS_DISABLED_VERSION =
            "UPDATE inventory.stock_bom SET definition_status='DISABLED',version=version+1,";
    public static final String INVENTORY_BOM_SERVICE_UPDATE_UPDATED_AT_EPOCH_MILLIS_ALTERNATE_C =
            "updated_at_epoch_millis=? ";
    public static final String INVENTORY_BOM_SERVICE_WHERE_BOM_REF = "WHERE bom_ref IN (";
    public static final String INVENTORY_BOM_SERVICE_SELECT_TARGET_REF_ITEM_REF_PRODUCT_SKU_REF_VERSION =
            "SELECT target_ref,item_ref,product_sku_ref,version,balance,configuration::text,definition_status,";
    public static final String INVENTORY_BOM_SERVICE_CONSUMPTION_UNIT_REF =
            "consumption_unit_ref,consumption_unit_code,consumption_unit_name,consumption_unit_dimension,";
    public static final String INVENTORY_BOM_SERVICE_CONSUMPTION_UNIT_PRECISION =
            "consumption_unit_precision,counting_unit_ref,counting_unit_code,counting_unit_name,";
    public static final String INVENTORY_BOM_SERVICE_COUNTING_UNIT_DIMENSION =
            "counting_unit_dimension,counting_unit_precision,counting_unit_conversion_factor,";
    public static final String INVENTORY_BOM_SERVICE_MEASURE_MODE_COMPONENT_ELIGIBLE =
            "measure_mode,component_eligible ";
    public static final String INVENTORY_BOM_SERVICE_FROM_CLAUSE_STOCK_TARGET_DATA_NODE_REF_BRAND_REF_ITEM_REF =
            "FROM inventory.stock_target WHERE data_node_ref=? AND brand_ref=? AND item_ref=? ";
    public static final String INVENTORY_BOM_SERVICE_ORDER_BY_PRODUCT_SKU_REF_TARGET_REF =
            "ORDER BY product_sku_ref NULLS FIRST,target_ref FOR UPDATE";
    public static final String INVENTORY_BOM_SERVICE_SELECT_BOM_REF_ITEM_REF_PRODUCT_SKU_REF_OPTION_VALUE_REF =
            "SELECT bom_ref,item_ref,product_sku_ref,option_value_ref,version,rows::text,definition_status ";
    public static final String INVENTORY_BOM_SERVICE_FROM_CLAUSE_STOCK_BOM_DATA_NODE_REF_BRAND_REF_ITEM_REF =
            "FROM inventory.stock_bom WHERE data_node_ref=? AND brand_ref=? AND item_ref=? ";
    public static final String INVENTORY_BOM_SERVICE_ORDER_BY_PRODUCT_SKU_REF_OPTION_VALUE_REF_BOM_REF =
            "ORDER BY product_sku_ref NULLS FIRST,option_value_ref NULLS FIRST,bom_ref FOR UPDATE";
    public static final String INVENTORY_BOM_SERVICE_SELECT_STOCK_BOM_VERSION_ROWS_TEXT_DATA_NODE_REF =
            "SELECT version,rows::text FROM inventory.stock_bom WHERE data_node_ref=? AND brand_ref=? ";
    public static final String INVENTORY_BOM_SERVICE_CONDITION_ITEM_REF = "AND item_ref=? AND ";
    public static final String INVENTORY_BOM_SERVICE_PRODUCT_SKU_REF_OPTION_VALUE_REF =
            "product_sku_ref IS NULL AND option_value_ref=?";
    public static final String INVENTORY_BOM_SERVICE_SELECT_STOCK_BOM_VERSION_ROWS_TEXT_DATA_NODE_REF_ALTERNATE_A =
            "SELECT version,rows::text FROM inventory.stock_bom WHERE data_node_ref=? AND brand_ref=? ";
    public static final String INVENTORY_BOM_SERVICE_CONDITION_ALTERNATE_A = "AND ";
    public static final String INVENTORY_BOM_SERVICE_ITEM_REF_PRODUCT_SKU_REF_OPTION_VALUE_REF =
            "item_ref=? AND product_sku_ref IS NULL AND option_value_ref IS NULL";
    public static final String INVENTORY_BOM_SERVICE_SELECT_STOCK_BOM_VERSION_ROWS_TEXT_DATA_NODE_REF_ALTERNATE_B =
            "SELECT version,rows::text FROM inventory.stock_bom WHERE data_node_ref=? AND brand_ref=? ";
    public static final String INVENTORY_BOM_SERVICE_CONDITION_ALTERNATE_B = "AND ";
    public static final String INVENTORY_BOM_SERVICE_ITEM_REF_PRODUCT_SKU_REF_OPTION_VALUE_REF_ALTERNATE_A =
            "item_ref=? AND product_sku_ref=? AND option_value_ref IS NULL";
    public static final String INVENTORY_BOM_SERVICE_CONDITION_DEFINITION_STATUS_ENABLED =
            " AND definition_status='ENABLED' FOR UPDATE";
    public static final String INVENTORY_BOM_SERVICE_INSERT_INTO_ALTERNATE_A = "INSERT INTO ";

    public static final String INVENTORY_BOM_SERVICE_VALUES_VALUES_CAST_AS_JSONB_ON_CONF =
            "VALUES(?,?,?,?,?,?,?,?,?,?,CAST(? AS JSONB),?) ON CONFLICT ";
    public static final String INVENTORY_BOM_SERVICE_OPEN_PAREN_DATA_NODE_REF_BRAND_REF_ITEM_REF_PRODUCT_SKU_REF =
            "(data_node_ref,brand_ref,item_ref,(COALESCE(product_sku_ref, ";
    public static final String INVENTORY_BOM_SERVICE_OPTION_VALUE_REF =
            "'00000000-0000-0000-0000-000000000000'::uuid)),(COALESCE(option_value_ref, ";
    public static final String INVENTORY_BOM_SERVICE_DEFINITION_STATUS_ENABLED =
            "'00000000-0000-0000-0000-000000000000'::uuid))) WHERE definition_status='ENABLED' ";
    public static final String INVENTORY_BOM_SERVICE_SET_DO_UPDATE_SET = "DO UPDATE SET ";

    public static final String INVENTORY_BOM_SERVICE_FROM_CLAUSE_STOCK_TARGET_DATA_NODE_REF_BRAND_REF =
            " FROM inventory.stock_target WHERE data_node_ref=? AND brand_ref=? ";
    public static final String INVENTORY_BOM_SERVICE_CONDITION_DEFINITION_STATUS_ENABLED_ITEM_REF =
            "AND definition_status='ENABLED' AND item_ref=? ";
    public static final String INVENTORY_BOM_SERVICE_CONDITION_PRODUCT_SKU_REF =
            "AND product_sku_ref IS NOT DISTINCT FROM ?";
    public static final String INVENTORY_BOM_SERVICE_CONDITION_DEFINITION_STATUS_ENABLED_ALTERNATE_A =
            "AND definition_status='ENABLED' ";
    public static final String INVENTORY_BOM_SERVICE_FROM_CLAUSE_STOCK_TARGET_DATA_NODE_REF_ALTERNATE_A =
            " FROM inventory.stock_target WHERE data_node_ref=? AND ";
    public static final String INVENTORY_BOM_SERVICE_BRAND_REF = "brand_ref=? ";
    public static final String INVENTORY_BOM_SERVICE_CONDITION_TARGET_REF = "AND target_ref = ANY(?::uuid[])";
    public static final String INVENTORY_BOM_SERVICE_CTE_BOM_ROWS = "WITH bom_rows AS (";
    public static final String
            INVENTORY_BOM_SERVICE_SELECT_PRODUCT_SKU_REF_OPTION_VALUE_REF_SKU_CODE_OPTION_VALUE_CODE_ALTERNATE_A =
                    "SELECT product_sku_ref,option_value_ref,sku_code,option_value_code,version,rows::text AS bom_rows ";
    public static final String
            INVENTORY_BOM_SERVICE_FROM_CLAUSE_STOCK_BOM_DATA_NODE_REF_BRAND_REF_ITEM_REF_ALTERNATE_A =
                    "FROM inventory.stock_bom WHERE data_node_ref=? AND brand_ref=? AND item_ref=? ";
    public static final String INVENTORY_BOM_SERVICE_CONDITION_DEFINITION_STATUS_ENABLED_ALTERNATE_B =
            "AND definition_status='ENABLED'";
    public static final String INVENTORY_BOM_SERVICE_CLOSE_PAREN_COMPONENT_TARGET_REFS =
            "), component_target_refs AS (";
    public static final String INVENTORY_BOM_SERVICE_SELECT_LINE_VALUE_TARGET_REF_COMPONENT_TARGET_REF =
            "SELECT DISTINCT COALESCE(line.value->>'targetRef',line.value->>'componentTargetRef') AS target_ref ";
    public static final String INVENTORY_BOM_SERVICE_FROM_CLAUSE_LATERAL_JSONB_ARRAY_ELEMENTS =
            "FROM bom_rows CROSS JOIN LATERAL jsonb_array_elements(";
    public static final String INVENTORY_BOM_SERVICE_CASE_JSONB_TYPEOF_BOM_ROWS =
            "CASE WHEN jsonb_typeof(bom_rows.bom_rows::jsonb)='array' ";
    public static final String INVENTORY_BOM_SERVICE_THEN_BOM_ROWS_LINE =
            "THEN bom_rows.bom_rows::jsonb ELSE '[]'::jsonb END) line";
    public static final String INVENTORY_BOM_SERVICE_CLOSE_PAREN_TARGET_ROW_KIND =
            ") SELECT * FROM (SELECT 'TARGET' AS row_kind,";
    public static final String INVENTORY_BOM_SERVICE_VALUE_SEPARATOR_TEXT_BIGINT =
            ",NULL::uuid,NULL::uuid,NULL::text,NULL::text,NULL::bigint,NULL::text ";
    public static final String INVENTORY_BOM_SERVICE_FROM_CLAUSE_STOCK_TARGET_TARGET_DATA_NODE_REF_BRAND_REF =
            "FROM inventory.stock_target target WHERE target.data_node_ref=? AND target.brand_ref=? ";
    public static final String INVENTORY_BOM_SERVICE_CONDITION_TARGET_DEFINITION_STATUS_ENABLED =
            "AND target.definition_status='ENABLED' AND (";
    public static final String INVENTORY_BOM_SERVICE_SELECT_TARGET_TARGET_REF_ITEM_REF_PRODUCT_SKU_REF =
            "SELECT target.target_ref,target.item_ref,target.product_sku_ref,target.item_code,target.sku_code,";
    public static final String INVENTORY_BOM_SERVICE_ITEM_NAME_SKU_SKU_NAME =
            "item.name,sku.sku_name,target.consumption_unit_ref,target.consumption_unit_code,";
    public static final String INVENTORY_BOM_SERVICE_TARGET_CONSUMPTION_UNIT_NAME_CONSUMPTION_UNIT_DIMENSION =
            "target.consumption_unit_name,target.consumption_unit_dimension,";
    public static final String INVENTORY_BOM_SERVICE_TARGET_CONSUMPTION_UNIT_PRECISION =
            "target.consumption_unit_precision,";
    public static final String INVENTORY_BOM_SERVICE_STOCK_TARGET_TARGET =
            "COUNT(*) OVER() FROM inventory.stock_target target ";
    public static final String INVENTORY_BOM_SERVICE_JOIN_CATALOG_ITEM_ITEM_ITEM_REF_TARGET =
            "JOIN catalog.catalog_item item ON item.item_ref=target.item_ref ";
    public static final String INVENTORY_BOM_SERVICE_CONDITION_ITEM_DATA_NODE_REF_TARGET_BRAND_REF =
            "AND item.data_node_ref=target.data_node_ref AND item.brand_ref=target.brand_ref ";
    public static final String INVENTORY_BOM_SERVICE_CATALOG_SKU_SKU_PRODUCT_SKU_REF_TARGET =
            "LEFT JOIN catalog.catalog_sku sku ON sku.product_sku_ref=target.product_sku_ref ";
    public static final String INVENTORY_BOM_SERVICE_CONDITION_SKU_ITEM_REF_TARGET =
            "AND sku.item_ref=target.item_ref ";
    public static final String INVENTORY_BOM_SERVICE_WHERE_TARGET_DATA_NODE_REF_BRAND_REF =
            "WHERE target.data_node_ref=? AND target.brand_ref=? ";
    public static final String INVENTORY_BOM_SERVICE_CONDITION_TARGET_DEFINITION_STATUS_ENABLED_COMPONENT_ELIGIBLE =
            "AND target.definition_status='ENABLED' AND target.component_eligible=TRUE ";
    public static final String INVENTORY_BOM_SERVICE_CONDITION_TARGET_CONSUMPTION_UNIT_REF =
            "AND target.consumption_unit_ref IS NOT NULL ";
    public static final String INVENTORY_BOM_SERVICE_CONDITION_ITEM_NAME_ILIKE_SHORT_NAME =
            "AND (?='' OR item.name ILIKE ? OR COALESCE(item.short_name,'') ILIKE ? ";
    public static final String INVENTORY_BOM_SERVICE_ALTERNATIVE_TARGET_ITEM_CODE_ILIKE_SKU =
            "OR target.item_code ILIKE ? OR COALESCE(sku.sku_name,'') ILIKE ? ";
    public static final String INVENTORY_BOM_SERVICE_ALTERNATIVE_TARGET_SKU_CODE_ILIKE =
            "OR COALESCE(target.sku_code,'') ILIKE ?) ";
    public static final String INVENTORY_BOM_SERVICE_ORDER_BY_ITEM_NAME_SKU_SKU_NAME =
            "ORDER BY item.name,sku.sku_name NULLS FIRST,target.target_ref LIMIT ? OFFSET ?";
    public static final String INVENTORY_BOM_SERVICE_SELECT_DIRECT_FACT_KIND_ITEM_REF_PRODUCT_SKU_REF =
            "SELECT 'DIRECT' AS fact_kind,item_ref,product_sku_ref,inventory_mode,";
    public static final String INVENTORY_BOM_SERVICE_CONSUMPTION_UNIT_REF_ALTERNATE_A =
            "consumption_unit_ref,consumption_unit_code,consumption_unit_name,consumption_unit_dimension,";
    public static final String INVENTORY_BOM_SERVICE_CONSUMPTION_UNIT_PRECISION_INTEGER_BOM_LINE_COUNT =
            "consumption_unit_precision,NULL::integer AS bom_line_count ";
    public static final String INVENTORY_BOM_SERVICE_FROM_CLAUSE_STOCK_TARGET_DATA_NODE_REF_BRAND_REF_ALTERNATE_A =
            "FROM inventory.stock_target WHERE data_node_ref=? AND brand_ref=? ";
    public static final String INVENTORY_BOM_SERVICE_CONDITION_DEFINITION_STATUS_ENABLED_PRODUCT_SKU_REF_ITEM_REF =
            "AND definition_status='ENABLED' AND ((product_sku_ref IS NULL AND item_ref=ANY(?::uuid[])) ";
    public static final String INVENTORY_BOM_SERVICE_ALTERNATIVE_PRODUCT_SKU_REF =
            "OR (product_sku_ref IS NOT NULL AND product_sku_ref=ANY(?::uuid[]))) ";
    public static final String INVENTORY_BOM_SERVICE_UNION_BOM_FACT_KIND_ITEM_REF_PRODUCT_SKU_REF =
            "UNION ALL SELECT 'BOM' AS fact_kind,item_ref,product_sku_ref,NULL::text,NULL::uuid,NULL::text,";
    public static final String INVENTORY_BOM_SERVICE_TEXT_INTEGER_JSONB_TYPEOF_ROWS =
            "NULL::text,NULL::text,NULL::integer,CASE WHEN jsonb_typeof(rows)='array' ";
    public static final String INVENTORY_BOM_SERVICE_THEN_JSONB_ARRAY_LENGTH_ROWS_BOM_LINE_COUNT =
            "THEN jsonb_array_length(rows) ELSE -1 END AS bom_line_count ";
    public static final String INVENTORY_BOM_SERVICE_FROM_CLAUSE_STOCK_BOM_DATA_NODE_REF_BRAND_REF =
            "FROM inventory.stock_bom WHERE data_node_ref=? AND brand_ref=? ";
    public static final String INVENTORY_BOM_SERVICE_CONDITION_DEFINITION_STATUS_ENABLED_OPTION_VALUE_REF =
            "AND definition_status='ENABLED' AND option_value_ref IS NULL ";
    public static final String INVENTORY_BOM_SERVICE_CONDITION_PRODUCT_SKU_REF_ITEM_REF =
            "AND ((product_sku_ref IS NULL AND item_ref=ANY(?::uuid[])) ";
    public static final String INVENTORY_BOM_SERVICE_ALTERNATIVE_PRODUCT_SKU_REF_ALTERNATE_A =
            "OR (product_sku_ref IS NOT NULL AND product_sku_ref=ANY(?::uuid[]))) ";
    public static final String INVENTORY_BOM_SERVICE_ORDER_BY_ITEM_REF_PRODUCT_SKU_REF_FACT_KIND =
            "ORDER BY item_ref,product_sku_ref NULLS FIRST,fact_kind";
    public static final String INVENTORY_BOM_SERVICE_FROM_CLAUSE_STOCK_TARGET_DATA_NODE_REF_BRAND_REF_TARGET_REF =
            " FROM inventory.stock_target WHERE data_node_ref=? AND brand_ref=? AND target_ref=? ";
    public static final String INVENTORY_BOM_SERVICE_CONDITION_DEFINITION_STATUS_ENABLED_ALTERNATE_C =
            "AND definition_status='ENABLED'";
    public static final String INVENTORY_BOM_SERVICE_SELECT_STOCK_TARGET_VERSION_DATA_NODE_REF_BRAND_REF =
            "SELECT COALESCE(MAX(version),0) FROM inventory.stock_target WHERE data_node_ref=? AND brand_ref=?";
    public static final String INVENTORY_BOM_SERVICE_SELECT_COMMAND_RECEIPT_OPERATION_ID_REQUEST_HASH_RESPONSE_TEXT =
            "SELECT operation_id,request_hash,response_json::text FROM inventory.command_receipt WHERE data_node_ref=? ";
    public static final String INVENTORY_BOM_SERVICE_CONDITION_IDEMPOTENCY_KEY = "AND idempotency_key=?";
    public static final String INVENTORY_BOM_SERVICE_INSERT_INTO_ALTERNATE_B = "INSERT INTO ";

    public static final String TARGET_DISABLE_SCOPE_SUFFIX =
            ") AND data_node_ref=? AND brand_ref=? AND definition_status='ENABLED'";
    public static final String BOM_DISABLE_SCOPE_SUFFIX =
            ") AND data_node_ref=? AND brand_ref=? AND definition_status='ENABLED'";
    public static final String SELECT_PREFIX = "SELECT ";
    public static final String TARGET_FILTER_ITEM = "target.item_ref=?";
    public static final String TARGET_FILTER_NONE = "FALSE";
    public static final String TARGET_FILTER_OR = " OR ";
    public static final String TARGET_FILTER_COMPONENT =
            "target.target_ref::text IN (SELECT target_ref FROM component_target_refs)";
    public static final String COMBINED_TARGET_BOM_TAIL =
            "UNION ALL SELECT 'BOM',NULL::uuid,NULL::uuid,NULL::uuid,NULL::text,NULL::text,NULL::text,"
                    + "NULL::numeric,NULL::text,NULL::bigint,NULL::bigint,NULL::uuid,NULL::text,NULL::text,NULL::text,"
                    + "NULL::integer,NULL::uuid,NULL::text,NULL::text,NULL::text,NULL::integer,NULL::numeric,NULL::text,"
                    + "NULL::text,NULL::boolean,bom_rows.product_sku_ref,bom_rows.option_value_ref,bom_rows.sku_code,"
                    + "bom_rows.option_value_code,bom_rows.version,bom_rows.bom_rows FROM bom_rows "
                    + ") AS combined ORDER BY (row_kind='TARGET') DESC,4 NULLS FIRST,28 NULLS FIRST,29 NULLS FIRST";
    public static final String
            INVENTORY_BOM_SERVICE_SELECT_CONSUMPTION_UNIT_REF_CONSUMPTION_UNIT_CODE_CONSUMPTION_UNIT_NAME_CONSUMPTION_UNIT_DIMENSION_CONSUMPTION_UNIT_PRECISION_CONSUMPTION_UNIT_NAME_CONSUMPTION_UNIT_DIMENSION_CONSUMPTION_UNIT_PRECISION =
                    """
    SELECT consumption_unit_ref,consumption_unit_code,consumption_unit_name,consumption_unit_dimension,consumption_unit_precision\s""";
    public static final String
            INVENTORY_BOM_SERVICE_SELECT_COUNTING_UNIT_REF_COUNTING_UNIT_CODE_COUNTING_UNIT_NAME_COUNTING_UNIT_DIMENSION_COUNTING_UNIT_PRECISION_COUNTING_UNIT_DIMENSION_COUNTING_UNIT_PRECISION_COUNTING_UNIT_CONVERSION_FACTOR =
                    """
    SELECT counting_unit_ref,counting_unit_code,counting_unit_name,counting_unit_dimension,counting_unit_precision,counting_unit_conversion_factor\s""";
    public static final String
            INVENTORY_BOM_SERVICE_COUNTING_UNIT_CONVERSION_FACTOR_VERSION_UPDATED_AT_EPOCH_MILLIS_WHERE_DATA_NODE_REF_VERSION_UPDATED_AT_EPOCH_MILLIS_WHERE_DATA_NODE_REF =
                    """
    counting_unit_conversion_factor=?,version=version+1,updated_at_epoch_millis=? WHERE data_node_ref=?\s""";
    public static final String
            INVENTORY_BOM_SERVICE_SKU_CODE_MEASURE_MODE_INVENTORY_MODE_CONSUMPTION_UNIT_REF_CONSUMPTION_UNIT_CODE_CONSUMPTION_UNIT_NAME_CONSUMPTION_UNIT_DIMENSION_CONSUMPTION_UNIT_PRECISION =
                    """
    ,sku_code,measure_mode,inventory_mode,consumption_unit_ref,consumption_unit_code,consumption_unit_name,consumption_unit_dimension,consumption_unit_precision,""";
    public static final String
            INVENTORY_BOM_SERVICE_INSERT_INTO_INVENTORY_STOCK_BOM_BOM_REF_DATA_NODE_REF_BRAND_REF_ITEM_REF_PRODUCT_SKU_REF_OPTION_VALUE_REF_BRAND_REF_ITEM_REF_PRODUCT_SKU_REF_OPTION_VALUE_REF =
                    """
    INSERT INTO inventory.stock_bom(bom_ref,data_node_ref,brand_ref,item_ref,product_sku_ref,option_value_ref,""";
    public static final String
            INVENTORY_BOM_SERVICE_INVENTORY_STOCK_BOM_BOM_REF_DATA_NODE_REF_BRAND_REF_ITEM_REF_PRODUCT_SKU_REF_OPTION_VALUE_REF_ITEM_CODE_SKU_CODE_OPTION_VALUE_CODE_VERSION_ROWS_UPDATED_AT_EPOCH_MILLIS =
                    """
    inventory.stock_bom(bom_ref,data_node_ref,brand_ref,item_ref,product_sku_ref,option_value_ref,item_code,sku_code,option_value_code,version,rows,updated_at_epoch_millis)\s""";
    public static final String
            INVENTORY_BOM_SERVICE_VERSION_EXCLUDED_VERSION_ROWS_EXCLUDED_ROWS_UPDATED_AT_EPOCH_MILLIS_EXCLUDED_UPDATED_AT_EPOCH_MILLIS_ROWS_UPDATED_AT_EPOCH_MILLIS_EXCLUDED_UPDATED_AT_EPOCH_MILLIS =
                    """
    version=EXCLUDED.version,rows=EXCLUDED.rows,updated_at_epoch_millis=EXCLUDED.updated_at_epoch_millis""";
    public static final String
            INVENTORY_BOM_SERVICE_INVENTORY_COMMAND_RECEIPT_RECEIPT_REF_DATA_NODE_REF_IDEMPOTENCY_KEY_OPERATION_ID_REQUEST_HASH_RESPONSE_CREATED_AT_EPOCH_MILLIS_VALUES_CAST_AS_JSONB =
                    """
    inventory.command_receipt(receipt_ref,data_node_ref,idempotency_key,operation_id,request_hash,response_json,created_at_epoch_millis) VALUES(?,?,?,?,?,CAST(? AS JSONB),?)""";
}
