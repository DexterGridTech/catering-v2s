package com.catering.v2s.catalog.application.persistence;

/** SQL text fragments owned by CatalogUnitDefinitionFacts; B3 relocates text only and does not change execution. */
public final class CatalogUnitDefinitionFactsSql {
    public static final String PARAMETER_PLACEHOLDER = "?";
    public static final String PLACEHOLDER_SEPARATOR = ",";
    public static final String LOCK_VALUE_TUPLE = "(?,?)";
    public static final String CATALOG_UNIT_DEFINITION_FACTS_SELECT_UNIT_DEFINITION_UNIT_REF_CODE_NAME_DIMENSION =
            "SELECT unit_ref,code,name,dimension,precision,status,version FROM catalog.unit_definition ";
    public static final String CATALOG_UNIT_DEFINITION_FACTS_WHERE_DATA_NODE_REF_BRAND_REF =
            "WHERE data_node_ref=? AND brand_ref=? ";
    public static final String CATALOG_UNIT_DEFINITION_FACTS_CONDITION_STATUS = "AND status=? ";
    public static final String CATALOG_UNIT_DEFINITION_FACTS_CONDITION_STATUS_ENABLED = "AND status='ENABLED' ";
    public static final String CATALOG_UNIT_DEFINITION_FACTS_CONDITION_DIMENSION = "AND dimension=? ";
    public static final String CATALOG_UNIT_DEFINITION_FACTS_CONDITION_CODE_CHR_NAME_ILIKE =
            "AND (code || chr(1) || name) ILIKE '%' || ? || '%' ";
    public static final String CATALOG_UNIT_DEFINITION_FACTS_ORDER_BY_NAME_CODE_UNIT_REF =
            "ORDER BY name,code,unit_ref LIMIT 100";
    public static final String CATALOG_UNIT_DEFINITION_FACTS_SELECT_UNIT_DEFINITION_DATA_NODE_REF_BRAND_REF =
            "SELECT count(*) FROM catalog.unit_definition WHERE data_node_ref=? AND brand_ref=?";
    public static final String
            CATALOG_UNIT_DEFINITION_FACTS_INSERT_INTO_UNIT_DEFINITION_UNIT_REF_DATA_NODE_REF_BRAND_REF_CODE =
                    "INSERT INTO catalog.unit_definition(unit_ref,data_node_ref,brand_ref,code,name,dimension,preci";

    public static final String CATALOG_UNIT_DEFINITION_FACTS_VALUES_ENABLED = "VALUES(?,?,?,?,?,?,?,'ENABLED',1,?,?)";
    public static final String CATALOG_UNIT_DEFINITION_FACTS_UPDATE_UNIT_DEFINITION_CODE_NAME_DIMENSION_PRECISION =
            "UPDATE catalog.unit_definition SET code=?,name=?,dimension=?,precision=?,version=version+1,upd";

    public static final String CATALOG_UNIT_DEFINITION_FACTS_WHERE_UNIT_REF_VERSION = "WHERE unit_ref=? AND version=?";
    public static final String
            CATALOG_UNIT_DEFINITION_FACTS_UPDATE_UNIT_DEFINITION_STATUS_VERSION_UPDATED_AT_EPOCH_MILLIS =
                    "UPDATE catalog.unit_definition SET status=?,version=version+1,updated_at_epoch_millis=? ";
    public static final String CATALOG_UNIT_DEFINITION_FACTS_WHERE_UNIT_REF_VERSION_STATUS_VOIDED =
            "WHERE unit_ref=? AND version=? AND status <> 'VOIDED'";
    public static final String
            CATALOG_UNIT_DEFINITION_FACTS_CTE_UNIT_LOCKS_PG_ADVISORY_XACT_LOCK_LOCK_KEY_ONE_LOCK_KEY_TWO =
                    "WITH unit_locks AS MATERIALIZED (SELECT pg_advisory_xact_lock(lock_key_one,lock_key_two) ";
    public static final String CATALOG_UNIT_DEFINITION_FACTS_FROM_CLAUSE_FROM_VALUES = "FROM (VALUES ";
    public static final String CATALOG_UNIT_DEFINITION_FACTS_CLOSE_PAREN_REQUESTED_LOCKS_LOCK_KEY_ONE_LOCK_KEY_TWO =
            ") AS requested_locks(lock_key_one,lock_key_two)) ";
    public static final String
            CATALOG_UNIT_DEFINITION_FACTS_SELECT_UNIT_DEFINITION_UNIT_REF_CODE_NAME_DIMENSION_ALTERNATE_A =
                    "SELECT unit_ref,code,name,dimension,precision,status,version FROM catalog.unit_definition ";
    public static final String CATALOG_UNIT_DEFINITION_FACTS_WHERE_DATA_NODE_REF_BRAND_REF_UNIT_REF =
            "WHERE data_node_ref=? AND brand_ref=? AND unit_ref IN (";
    public static final String
            CATALOG_UNIT_DEFINITION_FACTS_SELECT_UNIT_DEFINITION_UNIT_REF_CODE_NAME_DIMENSION_ALTERNATE_B =
                    "SELECT unit_ref,code,name,dimension,precision,status,version FROM catalog.unit_definition WHERE un";

    public static final String
            CATALOG_UNIT_DEFINITION_FACTS_SELECT_UNIT_DEFINITION_UNIT_REF_CODE_NAME_DIMENSION_ALTERNATE_C =
                    "SELECT unit_ref,code,name,dimension,precision,status,version FROM catalog.unit_definition ";
    public static final String CATALOG_UNIT_DEFINITION_FACTS_WHERE_DATA_NODE_REF_BRAND_REF_UNIT_REF_ALTERNATE_A =
            "WHERE data_node_ref=? AND brand_ref=? AND unit_ref=?";
    public static final String CATALOG_UNIT_DEFINITION_FACTS_SELECT_CATALOG_ITEM_SALES_UNIT_REF_BASE_MEASURE_UNIT_REF =
            "SELECT EXISTS (SELECT 1 FROM catalog.catalog_item WHERE sales_unit_ref=? OR base_measure_unit_ref=?) ";
    public static final String CATALOG_UNIT_DEFINITION_FACTS_ALTERNATIVE_CATALOG_SKU_SALES_UNIT_OVERRIDE_REF_BASE_MEA =
            "OR EXISTS (SELECT 1 FROM catalog.catalog_sku WHERE sales_unit_override_ref=? OR base_mea";

    public static final String CATALOG_UNIT_DEFINITION_FACTS_ALTERNATIVE_CATALOG_ORDER_OPTION_DEFINITION_MA_CONSUMPT =
            "OR EXISTS (SELECT 1 FROM catalog.catalog_order_option_definition_material WHERE consumpt";

    public static final String CATALOG_UNIT_DEFINITION_FACTS_SELECT_REF = "SELECT ref FROM (";
    public static final String CATALOG_UNIT_DEFINITION_FACTS_SELECT_CATALOG_ITEM_SALES_UNIT_REF_REF =
            "SELECT sales_unit_ref AS ref FROM catalog.catalog_item WHERE sales_unit_ref IN (";
    public static final String
            CATALOG_UNIT_DEFINITION_FACTS_CLOSE_PAREN_CATALOG_ORDER_OPTION_DEFINITION_MA_CONSUMPTION_UNIT_REF =
                    ") UNION SELECT consumption_unit_ref FROM catalog.catalog_order_option_definition_material ";
    public static final String CATALOG_UNIT_DEFINITION_FACTS_WHERE_CONSUMPTION_UNIT_REF =
            "WHERE consumption_unit_ref IN (";
    public static final String CATALOG_UNIT_DEFINITION_FACTS_CLOSE_PAREN_UNIT_LOCKS_AND_SELECT_COUNT_FROM_UNIT_L =
            ") AND (SELECT count(*) FROM unit_locks)=? FOR UPDATE";
    public static final String CATALOG_UNIT_DEFINITION_FACTS_CLOSE_PAREN_CATALOG_ITEM_BASE_MEASURE_UNIT_REF =
            ") UNION SELECT base_measure_unit_ref FROM catalog.catalog_item WHERE ";
    public static final String CATALOG_UNIT_DEFINITION_FACTS_BASE_MEASURE_UNIT_REF = "base_measure_unit_ref IN (";
    public static final String CATALOG_UNIT_DEFINITION_FACTS_CLOSE_PAREN_SALES_UNIT_OVERRIDE_REF =
            ") UNION SELECT sales_unit_override_ref FROM ";
    public static final String CATALOG_UNIT_DEFINITION_FACTS_CATALOG_SKU_SALES_UNIT_OVERRIDE_REF =
            "catalog.catalog_sku WHERE sales_unit_override_ref IN (";
    public static final String CATALOG_UNIT_DEFINITION_FACTS_CLOSE_PAREN_CATALOG_SKU_BASE_MEASURE_UNIT_OVERRIDE_REF =
            ") UNION SELECT base_measure_unit_override_ref FROM catalog.catalog_sku WHERE ";
    public static final String CATALOG_UNIT_DEFINITION_FACTS_BASE_MEASURE_UNIT_OVERRIDE_REF =
            "base_measure_unit_override_ref IN (";
    public static final String CATALOG_UNIT_DEFINITION_FACTS_CLOSE_PAREN_REFERENCED_REF =
            ")) referenced WHERE ref IS NOT NULL";
    public static final String
            CATALOG_UNIT_DEFINITION_FACTS_INSERT_INTO_CATALOG_UNIT_DEFINITION_UNIT_REF_DATA_NODE_REF_BRAND_REF_CODE_NAME_DIMENSION_STATUS_VERSION_CREATED_AT_EPOCH_MILLIS_UPDATED_AT_EPOCH_MILLIS =
                    """
    INSERT INTO catalog.unit_definition(unit_ref,data_node_ref,brand_ref,code,name,dimension,precision,status,version,created_at_epoch_millis,updated_at_epoch_millis)\s""";
    public static final String
            CATALOG_UNIT_DEFINITION_FACTS_UPDATE_CATALOG_UNIT_DEFINITION_SET_CODE_NAME_DIMENSION_PRECISION_VERSION_UPDATED_AT_EPOCH_MILLIS_DIMENSION_PRECISION_VERSION_UPDATED_AT_EPOCH_MILLIS =
                    """
    UPDATE catalog.unit_definition SET code=?,name=?,dimension=?,precision=?,version=version+1,updated_at_epoch_millis=?\s""";
    public static final String
            CATALOG_UNIT_DEFINITION_FACTS_SELECT_UNIT_REF_CODE_NAME_DIMENSION_PRECISION_STATUS_VERSION_FROM_CATALOG_UNIT_DEFINITION_WHERE_UNIT_REF =
                    """
    SELECT unit_ref,code,name,dimension,precision,status,version FROM catalog.unit_definition WHERE unit_ref=?""";
    public static final String
            CATALOG_UNIT_DEFINITION_FACTS_OR_EXISTS_SELECT_FROM_CATALOG_CATALOG_SKU_WHERE_SALES_UNIT_OVERRIDE_REF_OR_BASE_MEASURE_UNIT_OVERRIDE_REF_WHERE_SALES_UNIT_OVERRIDE_REF_OR_BASE_MEASURE_UNIT_OVERRIDE_REF =
                    """
    OR EXISTS (SELECT 1 FROM catalog.catalog_sku WHERE sales_unit_override_ref=? OR base_measure_unit_override_ref=?)\s""";
    public static final String
            CATALOG_UNIT_DEFINITION_FACTS_OR_EXISTS_SELECT_FROM_CATALOG_CATALOG_ORDER_OPTION_DEFINITION_MATERIAL_WHERE_CONSUMPTION_UNIT_REF_CATALOG_CATALOG_ORDER_OPTION_DEFINITION_MATERIAL_WHERE_CONSUMPTION_UNIT_REF =
                    """
    OR EXISTS (SELECT 1 FROM catalog.catalog_order_option_definition_material WHERE consumption_unit_ref=?)""";
}
