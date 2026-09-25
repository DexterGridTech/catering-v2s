package com.catering.v2s.inventory.application.persistence;

/** SQL text fragments owned by InventoryTargetService; B3 relocates text only and does not change execution. */
public final class InventoryTargetServiceSql {
    public static final String PARAMETER_PLACEHOLDER = "?";
    public static final String VALUE_SEPARATOR = ",";
    public static final String UUID_VALUE_ROW = "(?::uuid)";
    public static final String CLOSE_PAREN = ")";
    public static final String STOCK_VIEW_ALL_PREDICATE = "TRUE";
    public static final String STOCK_VIEW_NEEDS_ATTENTION_PREDICATE = "stock_state <> 'OK'";
    public static final String STOCK_VIEW_STATE_PREFIX = "stock_state='";
    public static final String STOCK_VIEW_STATE_SUFFIX = "'";
    public static final String SELECT_PREFIX = "SELECT ";
    public static final String TARGET_SELECT_COLUMNS =
            "target_ref,item_ref,product_sku_ref,item_code,sku_code,measure_mode,balance,configuration::text,"
                    + "version,updated_at_epoch_millis,consumption_unit_ref,consumption_unit_code,"
                    + "consumption_unit_name,consumption_unit_dimension,consumption_unit_precision,"
                    + "counting_unit_ref,counting_unit_code,counting_unit_name,counting_unit_dimension,"
                    + "counting_unit_precision,counting_unit_conversion_factor,definition_status,inventory_mode,"
                    + "component_eligible";
    public static final String CLASSIFIED_AGGREGATE_PREFIX =
            "), classified AS (SELECT target_ref, item_ref, product_sku_ref, item_code, sku_code, "
                    + "measure_mode, balance, configuration, version, updated_at_epoch_millis, threshold, "
                    + "unknown_flag, CASE WHEN unknown_flag THEN 'UNKNOWN' WHEN balance < 0 THEN 'NEGATIVE' "
                    + "WHEN balance = 0 THEN 'OUT' WHEN threshold > 0 AND balance < threshold THEN 'LOW' ELSE "
                    + "'OK' END AS stock_state FROM base), aggregate AS (SELECT COUNT(*) AS all_count, "
                    + "COUNT(*) FILTER (WHERE stock_state <> 'OK') AS attention_count, COUNT(*) FILTER (WHERE "
                    + "stock_state='LOW') AS low_count, COUNT(*) FILTER (WHERE stock_state='OUT') AS "
                    + "out_count, COUNT(*) FILTER (WHERE stock_state='NEGATIVE') AS negative_count, COUNT(*) "
                    + "FILTER (WHERE stock_state='UNKNOWN') AS unknown_count, COUNT(*) FILTER (WHERE ";
    public static final String CLASSIFIED_VIEW_AND_PAGED_PREFIX =
            ") AS view_count FROM classified), paged AS (SELECT target_ref, item_ref, product_sku_ref, "
                    + "item_code, sku_code, measure_mode, balance, configuration, version, "
                    + "updated_at_epoch_millis, stock_state FROM classified WHERE ";
    public static final String TARGET_COUNT_GROUP_SUFFIX = ") GROUP BY item_ref";
    public static final String INVENTORY_TARGET_SERVICE_UPDATE_STOCK_TARGET_CONFIGURATION =
            "UPDATE inventory.stock_target SET configuration=CAST(? AS JSONB),";
    public static final String INVENTORY_TARGET_SERVICE_COUNTING_UNIT_REF =
            "counting_unit_ref=?,counting_unit_code=?,counting_unit_name=?,counting_unit_dimension=?,";

    public static final String INVENTORY_TARGET_SERVICE_BRAND_REF = "brand_ref=? ";
    public static final String INVENTORY_TARGET_SERVICE_CONDITION_TARGET_REF_VERSION = "AND target_ref=? AND version=?";
    public static final String INVENTORY_TARGET_SERVICE_SELECT_CONSUMPTION_UNIT_REF =
            "SELECT consumption_unit_ref,consumption_unit_code,consumption_unit_name,consumption_unit_d";

    public static final String INVENTORY_TARGET_SERVICE_FROM_CLAUSE_STOCK_TARGET_TARGET_REF =
            "FROM inventory.stock_target WHERE target_ref=?";
    public static final String INVENTORY_TARGET_SERVICE_SELECT_COUNTING_UNIT_REF =
            "SELECT counting_unit_ref,counting_unit_code,counting_unit_name,counting_unit_dimension,cou";

    public static final String INVENTORY_TARGET_SERVICE_FROM_CLAUSE_STOCK_TARGET_TARGET_REF_ALTERNATE_A =
            "FROM inventory.stock_target WHERE target_ref=?";
    public static final String INVENTORY_TARGET_SERVICE_INSERT_INTO = "INSERT INTO ";
    public static final String INVENTORY_TARGET_SERVICE_STOCK_LEDGER_ENTRY_REF_TARGET_REF_OPERATION_ID =
            "inventory.stock_ledger(entry_ref,target_ref,operation_id,delta,balance_before,balance_after,";

    public static final String
            INVENTORY_TARGET_SERVICE_JOIN_CONDITION_ON_CODE_NOTE_OCCURRED_AT_EPOCH_MILLIS_CONSUMPTION_UNIT_REF =
                    "on_code,note,occurred_at_epoch_millis,consumption_unit_ref,consumption_unit_code,consump";

    public static final String INVENTORY_TARGET_SERVICE_VALUE_SEPARATOR = ",?,?,?,?,?,?,?,?,?)";
    public static final String INVENTORY_TARGET_SERVICE_UPDATE_STOCK_TARGET_BALANCE_VERSION_UPDATED_AT_EPOCH_MILLIS =
            "UPDATE inventory.stock_target SET balance=?,version=version+1,updated_at_epoch_millis=? WHERE ";
    public static final String INVENTORY_TARGET_SERVICE_TARGET_REF_VERSION = "target_ref=? AND version=?";
    public static final String INVENTORY_TARGET_SERVICE_SELECT_DELTA =
            "SELECT COALESCE(SUM(CASE WHEN delta>0 THEN delta ELSE 0 END),0), COALESCE(SUM(CASE WHEN delta<0 THEN ";
    public static final String INVENTORY_TARGET_SERVICE_STOCK_LEDGER_DELTA_TARGET_REF =
            "-delta ELSE 0 END),0), COUNT(*) FROM inventory.stock_ledger WHERE target_ref=? AND ";
    public static final String INVENTORY_TARGET_SERVICE_OCCURRED_AT_EPOCH_MILLIS = "occurred_at_epoch_millis>=?";
    public static final String
            INVENTORY_TARGET_SERVICE_SELECT_STOCK_LEDGER_OPERATION_ID_DELTA_OCCURRED_AT_EPOCH_MILLIS_TARGET_REF =
                    "SELECT operation_id,delta,occurred_at_epoch_millis FROM inventory.stock_ledger WHERE target_ref=? ";
    public static final String INVENTORY_TARGET_SERVICE_ORDER_BY_OCCURRED_AT_EPOCH_MILLIS =
            "ORDER BY occurred_at_epoch_millis DESC LIMIT 20";
    public static final String INVENTORY_TARGET_SERVICE_SELECT_ITEM_ITEM_REF_CODE_NAME =
            "SELECT item.item_ref,item.code,item.name,sku.product_sku_ref,sku.sku_code,sku.sku_name ";
    public static final String INVENTORY_TARGET_SERVICE_FROM_CLAUSE_CATALOG_SKU_ITEM_SKU =
            "FROM catalog.catalog_item item LEFT JOIN catalog.catalog_sku sku ";
    public static final String INVENTORY_TARGET_SERVICE_JOIN_CONDITION_SKU_ITEM_REF_ITEM_DATA_NODE_REF =
            "ON sku.item_ref=item.item_ref WHERE item.data_node_ref=? AND item.brand_ref=? ";
    public static final String INVENTORY_TARGET_SERVICE_CONDITION_ITEM_ITEM_REF = "AND item.item_ref=ANY(?::uuid[])";
    public static final String INVENTORY_TARGET_SERVICE_CTE_CATALOG_CATEGORY_SCOPE_CATEGORY_REF =
            "WITH RECURSIVE catalog_category_scope(category_ref) AS (";
    public static final String INVENTORY_TARGET_SERVICE_SELECT_CATALOG_CATEGORY_CATEGORY_REF_DATA_NODE_REF =
            "SELECT c.category_ref FROM catalog.catalog_category c WHERE c.data_node_ref=? AND ";
    public static final String INVENTORY_TARGET_SERVICE_BRAND_REF_CATEGORY_REF_TEXT_STATUS =
            "c.brand_ref=? AND c.category_ref::text=?::text AND c.status <> 'VOIDED' ";
    public static final String INVENTORY_TARGET_SERVICE_UNION_CATALOG_CATEGORY_CHILD_CATEGORY_REF =
            "UNION ALL SELECT child.category_ref FROM catalog.catalog_category child JOIN ";
    public static final String INVENTORY_TARGET_SERVICE_CATALOG_CATEGORY_SCOPE_PARENT_CHILD_PARENT_CATEGORY_REF =
            "catalog_category_scope parent ON child.parent_category_ref=parent.category_ref ";
    public static final String INVENTORY_TARGET_SERVICE_WHERE_CHILD_DATA_NODE_REF_BRAND_REF_BOOLEAN =
            "WHERE child.data_node_ref=? AND child.brand_ref=? AND ?::boolean = TRUE AND child.status <> ";
    public static final String INVENTORY_TARGET_SERVICE_VOIDED = "'VOIDED'), ";
    public static final String INVENTORY_TARGET_SERVICE_BASE_TARGET_REF_ITEM_REF_PRODUCT_SKU_REF =
            "base AS (SELECT st.target_ref, st.item_ref, st.product_sku_ref, st.item_code, st.sku_code, ";
    public static final String INVENTORY_TARGET_SERVICE_MEASURE_MODE_BALANCE_CONFIGURATION_TEXT =
            "st.measure_mode, st.balance, st.configuration::text AS configuration, st.version, ";
    public static final String INVENTORY_TARGET_SERVICE_UPDATED_AT_EPOCH_MILLIS = "st.updated_at_epoch_millis, ";
    public static final String INVENTORY_TARGET_SERVICE_NULLIF_CONFIGURATION_LOW_STOCK_THRESHOLD_NUMERIC =
            "COALESCE(NULLIF(st.configuration->>'lowStockThreshold','')::numeric,0) AS threshold, ";
    public static final String INVENTORY_TARGET_SERVICE_STOCK_TARGET_CONFIGURATION_UNKNOWN_UNKNOWN_FLAG =
            "st.configuration->>'unknown'='true' AS unknown_flag FROM inventory.stock_target st ";
    public static final String INVENTORY_TARGET_SERVICE_WHERE_DATA_NODE_REF_BRAND_REF =
            "WHERE st.data_node_ref=? AND st.brand_ref=?";
    public static final String INVENTORY_TARGET_SERVICE_CONDITION_CATALOG_ITEM_AND_EXISTS_SELECT_1_FROM_CAT =
            " AND EXISTS (SELECT 1 FROM catalog.catalog_item catalog_item WHERE ";
    public static final String INVENTORY_TARGET_SERVICE_CATALOG_ITEM_ITEM_REF = "catalog_item.item_ref=st.item_ref ";
    public static final String INVENTORY_TARGET_SERVICE_CONDITION_CATALOG_ITEM_DATA_NODE_REF_BRAND_REF_STATUS =
            "AND catalog_item.data_node_ref=? AND catalog_item.brand_ref=? AND catalog_item.status ";
    public static final String INVENTORY_TARGET_SERVICE_VOIDED_ALTERNATE_A = "<> 'VOIDED'";
    public static final String INVENTORY_TARGET_SERVICE_CONDITION_CATALOG_ITEM_NAME_CHR_SHORT_NAME =
            " AND (catalog_item.name || chr(1) || COALESCE(catalog_item.short_name, '') || chr(1) || ";
    public static final String INVENTORY_TARGET_SERVICE_CATALOG_ITEM_CODE_ILIKE =
            "catalog_item.code) ILIKE '%' || ? || '%'";
    public static final String INVENTORY_TARGET_SERVICE_CONDITION_CATALOG_CATEGORY_SCOPE_RELATION =
            " AND EXISTS (SELECT 1 FROM catalog.catalog_item_category relation JOIN catalog_category_scope ";
    public static final String INVENTORY_TARGET_SERVICE_CATEGORY_CATEGORY_REF_RELATION =
            "category ON category.category_ref=relation.category_ref WHERE ";
    public static final String INVENTORY_TARGET_SERVICE_RELATION_ITEM_REF_CATALOG_ITEM =
            "relation.item_ref=catalog_item.item_ref)";
    public static final String INVENTORY_TARGET_SERVICE_CONDITION_ITEM_REF = " AND st.item_ref IN (";
    public static final String INVENTORY_TARGET_SERVICE_ORDER_BY_ITEM_CODE_SKU_CODE_TARGET_REF =
            " ORDER BY item_code, sku_code NULLS FIRST, target_ref OFFSET ? LIMIT ?) SELECT ";

    public static final String INVENTORY_TARGET_SERVICE_PAGED_AGGREGATE_ITEM_CODE_SKU_CODE =
            "aggregate a LEFT JOIN paged p ON TRUE ORDER BY p.item_code,p.sku_code NULLS ";
    public static final String INVENTORY_TARGET_SERVICE_TARGET_REF = "FIRST,p.target_ref";
    public static final String INVENTORY_TARGET_SERVICE_SELECT_STOCK_TARGET_ITEM_REF_DATA_NODE_REF_BRAND_REF =
            "SELECT item_ref,COUNT(*) FROM inventory.stock_target WHERE data_node_ref=? AND brand_ref=? ";
    public static final String INVENTORY_TARGET_SERVICE_CONDITION_ITEM_REF_ALTERNATE_A = "AND item_ref IN (";
    public static final String INVENTORY_TARGET_SERVICE_CTE_SELECTED_TARGET_REF_PERIODS_PERIOD =
            "WITH selected(target_ref) AS (VALUES (?::uuid)), periods(period,since,sort_order) AS (VALUES";
    public static final String INVENTORY_TARGET_SERVICE_OPEN_PAREN_TODAY_SUMMARY =
            " ('TODAY',?,1),('7D',?,2),('30D',?,3)), summary AS (SELECT 'SUMMARY' AS";
    public static final String INVENTORY_TARGET_SERVICE_ROW_KIND_PERIOD_SORT_ORDER_LEDGER =
            " row_kind,p.period,p.sort_order,COALESCE(SUM(CASE WHEN ledger.delta>0";
    public static final String INVENTORY_TARGET_SERVICE_THEN_LEDGER_DELTA = " THEN ledger.delta ELSE 0";
    public static final String INVENTORY_TARGET_SERVICE_INCREASE_LEDGER_DELTA =
            " END),0) AS increase,COALESCE(SUM(CASE WHEN ledger.delta<0 THEN -ledger.delta ELSE 0 END),0)";
    public static final String INVENTORY_TARGET_SERVICE_ALIAS_KEYWORD = " AS";
    public static final String INVENTORY_TARGET_SERVICE_DECREASE_LEDGER_ENTRY_REF_ENTRY_COUNT =
            " decrease,COUNT(ledger.entry_ref) AS entry_count,NULL::text AS operation_id,NULL::numeric AS";
    public static final String INVENTORY_TARGET_SERVICE_SELECTED_DELTA_BIGINT_OCCURRED_AT =
            " delta,NULL::bigint AS occurred_at FROM periods p CROSS JOIN selected s LEFT JOIN";
    public static final String INVENTORY_TARGET_SERVICE_STOCK_LEDGER_LEDGER_TARGET_REF =
            " inventory.stock_ledger ledger ON ledger.target_ref=s.target_ref AND";
    public static final String INVENTORY_TARGET_SERVICE_LEDGER_OCCURRED_AT_EPOCH_MILLIS_SINCE_PERIOD =
            " ledger.occurred_at_epoch_millis>=p.since GROUP BY p.period,p.sort_order), recent AS (SELECT";
    public static final String INVENTORY_TARGET_SERVICE_RECENT_ROW_KIND_TEXT_PERIOD =
            " 'RECENT' AS row_kind,NULL::text AS period,100 AS sort_order,NULL::numeric AS";
    public static final String INVENTORY_TARGET_SERVICE_INCREASE_NUMERIC_DECREASE_BIGINT =
            " increase,NULL::numeric AS decrease,NULL::bigint AS";
    public static final String INVENTORY_TARGET_SERVICE_ENTRY_COUNT_LEDGER_OPERATION_ID_DELTA =
            " entry_count,ledger.operation_id,ledger.delta,ledger.occurred_at_epoch_millis AS occurred_at";
    public static final String INVENTORY_TARGET_SERVICE_FROM_CLAUSE_SELECTED_LEDGER_TARGET_REF =
            " FROM inventory.stock_ledger ledger JOIN selected s ON s.target_ref=ledger.target_ref";
    public static final String INVENTORY_TARGET_SERVICE_ORDER_BY = " ORDER BY";
    public static final String INVENTORY_TARGET_SERVICE_LEDGER_OCCURRED_AT_EPOCH_MILLIS_ENTRY_REF =
            " ledger.occurred_at_epoch_millis DESC,ledger.entry_ref DESC LIMIT 20) SELECT";
    public static final String INVENTORY_TARGET_SERVICE_ROW_KIND_PERIOD_SORT_ORDER_INCREASE =
            " row_kind,period,sort_order,increase,decrease,entry_count,operation_id,delta,occurred_at";
    public static final String INVENTORY_TARGET_SERVICE_FROM_CLAUSE = " FROM";
    public static final String INVENTORY_TARGET_SERVICE_SUMMARY = " summary UNION ALL SELECT";
    public static final String INVENTORY_TARGET_SERVICE_ROW_KIND_PERIOD_SORT_ORDER_INCREASE_ALTERNATE_A =
            " row_kind,period,sort_order,increase,decrease,entry_count,operation_id,delta,occurred_at";
    public static final String INVENTORY_TARGET_SERVICE_FROM_CLAUSE_ALTERNATE_A = " FROM";
    public static final String INVENTORY_TARGET_SERVICE_RECENT_SORT_ORDER = " recent ORDER BY sort_order";
    public static final String INVENTORY_TARGET_SERVICE_SELECT_DELTA_ALTERNATE_A =
            "SELECT COALESCE(SUM(CASE WHEN delta>0 THEN delta ELSE 0 END),0), COALESCE(SUM(CASE WHEN delta<0 THEN ";
    public static final String INVENTORY_TARGET_SERVICE_STOCK_LEDGER_DELTA_TARGET_REF_ALTERNATE_A =
            "-delta ELSE 0 END),0), COUNT(*) FROM inventory.stock_ledger WHERE target_ref=? AND ";
    public static final String INVENTORY_TARGET_SERVICE_OCCURRED_AT_EPOCH_MILLIS_ALTERNATE_A =
            "occurred_at_epoch_millis>=?";
    public static final String INVENTORY_TARGET_SERVICE_SELECT = "SELECT ";

    public static final String INVENTORY_TARGET_SERVICE_FROM_CLAUSE_STOCK_LEDGER_TARGET_REF_OPERATION_ID_INCREASE =
            "FROM inventory.stock_ledger WHERE target_ref=? AND operation_id IN ('COUNT','INCREASE') ";
    public static final String INVENTORY_TARGET_SERVICE_ORDER_BY_OCCURRED_AT_EPOCH_MILLIS_ENTRY_REF =
            "ORDER BY occurred_at_epoch_millis DESC,entry_ref DESC LIMIT ? OFFSET ?";
    public static final String INVENTORY_TARGET_SERVICE_CTE_EXPANDED = "WITH expanded AS (";
    public static final String INVENTORY_TARGET_SERVICE_SELECT_ITEM_REF_ITEM_CODE_SKU_CODE_OPTION_VALUE_CODE =
            "SELECT sb.item_ref,sb.item_code,sb.sku_code,sb.option_value_code,entry->>'nodeType' AS ";
    public static final String INVENTORY_TARGET_SERVICE_SOURCE_KIND = "source_kind,";
    public static final String INVENTORY_TARGET_SERVICE_ENTRY_QUANTITY_QUANTITY_PER_UNIT =
            "COALESCE(entry->>'quantity',entry->>'quantityPerUnit','0') AS quantity,";
    public static final String INVENTORY_TARGET_SERVICE_ENTRY_CONSUMPTION_UNIT_SNAPSHOT_UNIT_REF_CONSUMPTION_UNIT_REF =
            "entry->'consumptionUnitSnapshot'->>'unitRef' AS consumption_unit_ref,";
    public static final String INVENTORY_TARGET_SERVICE_ENTRY_CONSUMPTION_UNIT_SNAPSHOT_CODE_CONSUMPTION_UNIT_CODE =
            "entry->'consumptionUnitSnapshot'->>'code' AS consumption_unit_code,";
    public static final String INVENTORY_TARGET_SERVICE_ENTRY_CONSUMPTION_UNIT_SNAPSHOT_NAME_CONSUMPTION_UNIT_NAME =
            "entry->'consumptionUnitSnapshot'->>'name' AS consumption_unit_name,";
    public static final String INVENTORY_TARGET_SERVICE_ENTRY =
            "entry->'consumptionUnitSnapshot'->>'unitDimension' AS consumption_unit_dimension,";
    public static final String INVENTORY_TARGET_SERVICE_OPEN_PAREN_ENTRY_CONSUMPTION_UNIT_SNAPSHOT_PRECISION_INTEGER =
            "(entry->'consumptionUnitSnapshot'->>'precision')::integer AS consumption_unit_precision,";

    public static final String INVENTORY_TARGET_SERVICE_FROM_CLAUSE_STOCK_BOM_FROM_INVENTORY_STOCK_BOM_SB =
            "FROM inventory.stock_bom sb ";
    public static final String INVENTORY_TARGET_SERVICE_LATERAL_JSONB_ARRAY_ELEMENTS_JSONB_TYPEOF_ROWS =
            "CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(sb.rows)='array' THEN ";
    public static final String INVENTORY_TARGET_SERVICE_ROWS_ORDINALITY_ENTRY_ORD =
            "sb.rows ELSE '[]'::jsonb END) WITH ORDINALITY AS e(entry,ord) ";
    public static final String INVENTORY_TARGET_SERVICE_WHERE_DATA_NODE_REF_BRAND_REF_ALTERNATE_A =
            "WHERE sb.data_node_ref=? AND sb.brand_ref=? ";
    public static final String INVENTORY_TARGET_SERVICE_CONDITION_DEFINITION_STATUS_ENABLED =
            "AND sb.definition_status='ENABLED' ";
    public static final String INVENTORY_TARGET_SERVICE_CONDITION_JSONB_PATH_EXISTS_JSONB_TYPEOF_ROWS =
            "AND jsonb_path_exists(CASE WHEN jsonb_typeof(sb.rows)='array' THEN sb.rows ";
    public static final String INVENTORY_TARGET_SERVICE_ELSE_ELSE_JSONB_END = "ELSE '[]'::jsonb END, ";
    public static final String INVENTORY_TARGET_SERVICE_TARGET_REF_COMPONENT_TARGET_REF =
            "'$[*] ? (@.targetRef == $targetRef || @.componentTargetRef == $targetRef)', ";
    public static final String INVENTORY_TARGET_SERVICE_JSONB_BUILD_OBJECT_TARGET_REF_TO_JSONB_TEXT =
            "jsonb_build_object('targetRef',to_jsonb(CAST(? AS text)))) ";
    public static final String INVENTORY_TARGET_SERVICE_CONDITION_ENTRY_TARGET_REF_COMPONENT_TARGET_REF =
            "AND COALESCE(entry->>'targetRef',entry->>'componentTargetRef')=?";
    public static final String INVENTORY_TARGET_SERVICE_CLOSE_PAREN = ") SELECT ";
    public static final String INVENTORY_TARGET_SERVICE_ITEM_REF_ITEM_CODE_SKU_CODE_OPTION_VALUE_CODE =
            "item_ref,item_code,sku_code,option_value_code,source_kind,quantity,consumption_unit_ref,";

    public static final String INVENTORY_TARGET_SERVICE_TIMING_TOTAL = "timing,total ";
    public static final String INVENTORY_TARGET_SERVICE_FROM_CLAUSE_EXPANDED_ITEM_CODE_SKU_CODE_ORD =
            "FROM expanded ORDER BY item_code,sku_code NULLS FIRST,ord LIMIT ? OFFSET ?";
    public static final String INVENTORY_TARGET_SERVICE_SELECT_ALTERNATE_A = "SELECT ";

    public static final String INVENTORY_TARGET_SERVICE_FROM_CLAUSE_STOCK_LEDGER_TARGET_REF =
            "FROM inventory.stock_ledger WHERE target_ref=? ";
    public static final String INVENTORY_TARGET_SERVICE_ORDER_BY_OCCURRED_AT_EPOCH_MILLIS_ENTRY_REF_ALTERNATE_A =
            "ORDER BY occurred_at_epoch_millis DESC,entry_ref DESC LIMIT ? OFFSET ?";
    public static final String INVENTORY_TARGET_SERVICE_INSERT_INTO_ALTERNATE_A = "INSERT INTO ";
    public static final String INVENTORY_TARGET_SERVICE_STOCK_LEDGER_ENTRY_REF_TARGET_REF_OPERATION_ID_ALTERNATE_A =
            "inventory.stock_ledger(entry_ref,target_ref,operation_id,delta,balance_before,balance_after,";

    public static final String
            INVENTORY_TARGET_SERVICE_JOIN_CONDITION_ON_CODE_NOTE_OCCURRED_AT_EPOCH_MILLIS_CONSUMPTION_UNIT_REF_ALTERNATE_A =
                    "on_code,note,occurred_at_epoch_millis,consumption_unit_ref,consumption_unit_code,";
    public static final String INVENTORY_TARGET_SERVICE_CONSUMPTION_UNIT_NAME =
            "consumption_unit_name,consumption_unit_dimension,consumption_unit_precision) VALUES(?,?,";
    public static final String INVENTORY_TARGET_SERVICE_PARAMETER_PLACEHOLDER = "?,?,?,?,?,?,?,?,?,?,?,?)";
    public static final String
            INVENTORY_TARGET_SERVICE_UPDATE_STOCK_TARGET_BALANCE_VERSION_UPDATED_AT_EPOCH_MILLIS_ALTERNATE_A =
                    "UPDATE inventory.stock_target SET balance=?,version=version+1,updated_at_epoch_millis=? WHERE ";
    public static final String INVENTORY_TARGET_SERVICE_TARGET_REF_VERSION_ALTERNATE_A = "target_ref=? AND version=?";
    public static final String INVENTORY_TARGET_SERVICE_UPDATE_STOCK_TARGET_CONFIGURATION_ALTERNATE_A =
            "UPDATE inventory.stock_target SET configuration=CAST(? AS JSONB),";

    public static final String INVENTORY_TARGET_SERVICE_BRAND_REF_TARGET_REF_VERSION =
            "brand_ref=? AND target_ref=? AND version=?";
    public static final String INVENTORY_TARGET_SERVICE_FROM_CLAUSE_STOCK_TARGET_DATA_NODE_REF_BRAND_REF_TARGET_REF =
            " FROM inventory.stock_target WHERE data_node_ref=? AND brand_ref=? AND target_ref=? ";
    public static final String INVENTORY_TARGET_SERVICE_CONDITION_DEFINITION_STATUS_ENABLED_ALTERNATE_A =
            "AND definition_status='ENABLED'";
    public static final String INVENTORY_TARGET_SERVICE_CTE_SELECTED_TARGET_REF =
            "WITH selected(target_ref) AS (VALUES ";
    public static final String INVENTORY_TARGET_SERVICE_CLOSE_PAREN_BOUNDS_BIGINT_NOW_EPOCH =
            "), bounds AS (SELECT ?::bigint AS now_epoch), ";
    public static final String INVENTORY_TARGET_SERVICE_AGGREGATE_TARGET_REF = "aggregate AS (SELECT l.target_ref, ";
    public static final String INVENTORY_TARGET_SERVICE_DELTA_FILTER_OCCURRED_AT_EPOCH_MILLIS_NOW_EPOCH =
            "COALESCE(SUM(l.delta) FILTER (WHERE l.occurred_at_epoch_millis >= b.now_epoch - 86400000),0) AS ";
    public static final String INVENTORY_TARGET_SERVICE_TODAY_CHANGE = "today_change, ";
    public static final String INVENTORY_TARGET_SERVICE_DELTA_FILTER_OCCURRED_AT_EPOCH_MILLIS_NOW_EPOCH_ALTERNATE_A =
            "COALESCE(SUM(l.delta) FILTER (WHERE l.occurred_at_epoch_millis >= b.now_epoch - 604800000),0) AS ";
    public static final String INVENTORY_TARGET_SERVICE_SEVEN_DAY_CHANGE = "seven_day_change, ";
    public static final String INVENTORY_TARGET_SERVICE_DELTA_FILTER_OCCURRED_AT_EPOCH_MILLIS_NOW_EPOCH_ALTERNATE_B =
            "COALESCE(SUM(l.delta) FILTER (WHERE l.occurred_at_epoch_millis >= b.now_epoch - 2592000000),0) AS ";
    public static final String INVENTORY_TARGET_SERVICE_THIRTY_DAY_CHANGE = "thirty_day_change ";
    public static final String INVENTORY_TARGET_SERVICE_FROM_CLAUSE_BOUNDS_TARGET_REF =
            "FROM inventory.stock_ledger l JOIN selected s ON s.target_ref=l.target_ref CROSS JOIN bounds b ";
    public static final String INVENTORY_TARGET_SERVICE_GROUP_BY_TARGET_REF = "GROUP BY l.target_ref), ";
    public static final String INVENTORY_TARGET_SERVICE_LATEST_TARGET_REF_OPERATION_ID_OCCURRED_AT_EPOCH_MILLIS =
            "latest AS (SELECT l.target_ref,l.operation_id,l.occurred_at_epoch_millis,ROW_NUMBER() OVER ";
    public static final String INVENTORY_TARGET_SERVICE_OPEN_PAREN_TARGET_REF_OCCURRED_AT_EPOCH_MILLIS_ENTRY_REF =
            "(PARTITION BY l.target_ref ORDER BY l.occurred_at_epoch_millis DESC,l.entry_ref DESC) AS ";
    public static final String INVENTORY_TARGET_SERVICE_ALTERNATE_A = "row_number ";
    public static final String INVENTORY_TARGET_SERVICE_FROM_CLAUSE_SELECTED_TARGET_REF =
            "FROM inventory.stock_ledger l JOIN selected s ON s.target_ref=l.target_ref) ";
    public static final String INVENTORY_TARGET_SERVICE_SELECT_ALTERNATE_B = "SELECT ";

    public static final String INVENTORY_TARGET_SERVICE_FROM_CLAUSE_LATEST_TARGET_REF =
            "FROM selected s LEFT JOIN aggregate a ON a.target_ref=s.target_ref LEFT JOIN latest ON ";
    public static final String INVENTORY_TARGET_SERVICE_LATEST_TARGET_REF =
            "latest.target_ref=s.target_ref AND latest.row_number=1";
    public static final String
            INVENTORY_TARGET_SERVICE_SELECT_STOCK_LEDGER_OPERATION_ID_DELTA_OCCURRED_AT_EPOCH_MILLIS_TARGET_REF_ALTERNATE_A =
                    "SELECT operation_id,delta,occurred_at_epoch_millis FROM inventory.stock_ledger WHERE target_ref=? ";
    public static final String INVENTORY_TARGET_SERVICE_ORDER_BY_OCCURRED_AT_EPOCH_MILLIS_ALTERNATE_A =
            "ORDER BY occurred_at_epoch_millis DESC LIMIT 20";
    public static final String INVENTORY_TARGET_SERVICE_SELECT_STOCK_TARGET_VERSION_DATA_NODE_REF_BRAND_REF =
            "SELECT COALESCE(MAX(version),0) FROM inventory.stock_target WHERE data_node_ref=? AND brand_ref=?";
    public static final String INVENTORY_TARGET_SERVICE_SELECT_COMMAND_RECEIPT_OPERATION_ID_REQUEST_HASH_RESPONSE_TEXT =
            "SELECT operation_id,request_hash,response_json::text FROM inventory.command_receipt WHERE data_node_ref=? ";
    public static final String INVENTORY_TARGET_SERVICE_CONDITION_IDEMPOTENCY_KEY = "AND idempotency_key=?";
    public static final String INVENTORY_TARGET_SERVICE_INSERT_INTO_ALTERNATE_B = "INSERT INTO ";

    public static final String
            INVENTORY_TARGET_SERVICE_COUNTING_UNIT_PRECISION_COUNTING_UNIT_CONVERSION_FACTOR_VERSION_UPDATED_AT_EPOCH_MILLIS_WHERE_DATA_NODE_REF_AND_UPDATED_AT_EPOCH_MILLIS_WHERE_DATA_NODE_REF_AND =
                    """
    counting_unit_precision=?,counting_unit_conversion_factor=?,version=version+1,updated_at_epoch_millis=? WHERE data_node_ref=? AND\s""";
    public static final String
            INVENTORY_TARGET_SERVICE_SELECT_CONSUMPTION_UNIT_REF_CONSUMPTION_UNIT_CODE_CONSUMPTION_UNIT_NAME_CONSUMPTION_UNIT_DIMENSION_CONSUMPTION_UNIT_PRECISION_CONSUMPTION_UNIT_NAME_CONSUMPTION_UNIT_DIMENSION_CONSUMPTION_UNIT_PRECISION =
                    """
    SELECT consumption_unit_ref,consumption_unit_code,consumption_unit_name,consumption_unit_dimension,consumption_unit_precision\s""";
    public static final String
            INVENTORY_TARGET_SERVICE_REASON_CODE_NOTE_OCCURRED_AT_EPOCH_MILLIS_CONSUMPTION_UNIT_REF_CONSUMPTION_UNIT_CODE_CONSUMPTION_UNIT_NAME_CONSUMPTION_UNIT_DIMENSION_CONSUMPTION_UNIT_PRECISION_VALUES =
                    """
    reason_code,note,occurred_at_epoch_millis,consumption_unit_ref,consumption_unit_code,consumption_unit_name,consumption_unit_dimension,consumption_unit_precision) VALUES(?,?,?,?,?""";
    public static final String
            INVENTORY_TARGET_SERVICE_P_TARGET_REF_P_ITEM_REF_P_PRODUCT_SKU_REF_P_ITEM_CODE_P_SKU_CODE_UNKNOWN_COUNT_A_VIEW_COUNT_FROM =
                    """
    p.target_ref,p.item_ref,p.product_sku_ref,p.item_code,p.sku_code,p.measure_mode,p.balance,p.configuration,p.version,p.updated_at_epoch_millis,p.stock_state,a.all_count,a.attention_count,a.low_count,a.out_count,a.negative_count,a.unknown_count,a.view_count FROM\s""";
    public static final String
            INVENTORY_TARGET_SERVICE_ENTRY_REF_OPERATION_ID_DELTA_BALANCE_BEFORE_BALANCE_AFTER_REASON_CODE_CONSUMPTION_UNIT_CODE_CONSUMPTION_UNIT_NAME_CONSUMPTION_UNIT_DIMENSION =
                    """
    entry_ref,operation_id,delta,balance_before,balance_after,reason_code,occurred_at_epoch_millis,consumption_unit_ref,consumption_unit_code,consumption_unit_name,consumption_unit_dimension,""";
    public static final String
            INVENTORY_TARGET_SERVICE_CONSUMPTION_UNIT_PRECISION_COUNT_OVER_CONSUMPTION_UNIT_PRECISION_COUNT_OVER =
                    """
    consumption_unit_precision,COUNT(*) OVER()\s""";
    public static final String
            INVENTORY_TARGET_SERVICE_ENTRY_TIMING_AS_TIMING_ORD_COUNT_OVER_AS_TOTAL_COUNT_OVER_AS_TOTAL =
                    """
    entry->>'timing' AS timing,ord,COUNT(*) OVER() AS total\s""";
    public static final String
            INVENTORY_TARGET_SERVICE_CONSUMPTION_UNIT_CODE_CONSUMPTION_UNIT_NAME_CONSUMPTION_UNIT_DIMENSION_CONSUMPTION_UNIT_PRECISION_CONSUMPTION_UNIT_CODE_CONSUMPTION_UNIT_NAME_CONSUMPTION_UNIT_DIMENSION_CONSUMPTION_UNIT_PRECISION =
                    """
    consumption_unit_code,consumption_unit_name,consumption_unit_dimension,consumption_unit_precision,""";
    public static final String
            INVENTORY_TARGET_SERVICE_ENTRY_REF_OPERATION_ID_DELTA_BALANCE_BEFORE_BALANCE_AFTER_REASON_CODE_CONSUMPTION_UNIT_CODE_CONSUMPTION_UNIT_NAME_CONSUMPTION_UNIT_DIMENSION_ALTERNATE_A =
                    """
    entry_ref,operation_id,delta,balance_before,balance_after,reason_code,occurred_at_epoch_millis,consumption_unit_ref,consumption_unit_code,consumption_unit_name,consumption_unit_dimension,""";
    public static final String
            INVENTORY_TARGET_SERVICE_CONSUMPTION_UNIT_PRECISION_COUNT_OVER_CONSUMPTION_UNIT_PRECISION_COUNT_OVER_ALTERNATE_A =
                    """
    consumption_unit_precision,COUNT(*) OVER()\s""";
    public static final String
            INVENTORY_TARGET_SERVICE_REASON_CODE_NOTE_OCCURRED_AT_EPOCH_MILLIS_CONSUMPTION_UNIT_REF_CONSUMPTION_UNIT_CODE_NOTE_OCCURRED_AT_EPOCH_MILLIS_CONSUMPTION_UNIT_REF_CONSUMPTION_UNIT_CODE =
                    """
    reason_code,note,occurred_at_epoch_millis,consumption_unit_ref,consumption_unit_code,""";
    public static final String
            INVENTORY_TARGET_SERVICE_COUNTING_UNIT_REF_COUNTING_UNIT_CODE_COUNTING_UNIT_NAME_COUNTING_UNIT_DIMENSION_COUNTING_UNIT_REF_COUNTING_UNIT_CODE_COUNTING_UNIT_NAME_COUNTING_UNIT_DIMENSION =
                    """
    counting_unit_ref=?,counting_unit_code=?,counting_unit_name=?,counting_unit_dimension=?,""";
    public static final String
            INVENTORY_TARGET_SERVICE_COUNTING_UNIT_PRECISION_COUNTING_UNIT_CONVERSION_FACTOR_VERSION_UPDATED_AT_EPOCH_MILLIS_WHERE_DATA_NODE_REF_AND_UPDATED_AT_EPOCH_MILLIS_WHERE_DATA_NODE_REF_AND_ALTERNATE_A =
                    """
    counting_unit_precision=?,counting_unit_conversion_factor=?,version=version+1,updated_at_epoch_millis=? WHERE data_node_ref=? AND\s""";
    public static final String
            INVENTORY_TARGET_SERVICE_S_TARGET_REF_A_TODAY_CHANGE_A_SEVEN_DAY_CHANGE_A_THIRTY_DAY_CHANGE_LATEST_OPERATION_ID_LATEST_OPERATION_ID_LATEST_OCCURRED_AT_EPOCH_MILLIS =
                    """
    s.target_ref,a.today_change,a.seven_day_change,a.thirty_day_change,latest.operation_id,latest.occurred_at_epoch_millis\s""";
    public static final String
            INVENTORY_TARGET_SERVICE_INVENTORY_COMMAND_RECEIPT_RECEIPT_REF_DATA_NODE_REF_IDEMPOTENCY_KEY_OPERATION_ID_REQUEST_HASH_RESPONSE_CREATED_AT_EPOCH_MILLIS_VALUES_CAST_AS_JSONB =
                    """
    inventory.command_receipt(receipt_ref,data_node_ref,idempotency_key,operation_id,request_hash,response_json,created_at_epoch_millis) VALUES(?,?,?,?,?,CAST(? AS JSONB),?)""";
}
