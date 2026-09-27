package com.catering.v2s.catalog.application.persistence;

/** SQL text fragments owned by CatalogDefinitionFacts; B3 relocates text only and does not change execution. */
public final class CatalogDefinitionFactsSql {
    public static final String PARAMETER_PLACEHOLDER = "?";
    public static final String PLACEHOLDER_SEPARATOR = ",";
    public static final String CATALOG_DEFINITION_FACTS_CONDITION_STATUS_ENABLED = " AND status='ENABLED'";
    public static final String CATALOG_DEFINITION_FACTS_CTE_BOUNDED_DEFINITION = "WITH bounded_definition AS (";
    public static final String CATALOG_DEFINITION_FACTS_SELECT_ATTRIBUTE_DEFINITION_REF_CODE_NAME_STATUS =
            "SELECT attribute_definition_ref,code,name,status,value_type,version ";
    public static final String FROM_CLAUSE_CAT_ATTR_DEF_001 = "FROM catalog.catalog_attribute_definition ";
    public static final String CATALOG_DEFINITION_FACTS_WHERE_DATA_NODE_REF_BRAND_REF =
            "WHERE data_node_ref=? AND brand_ref=?";
    public static final String CATALOG_DEFINITION_FACTS_EMPTY_LITERAL = " ";
    public static final String CATALOG_DEFINITION_FACTS_ORDER_BY_NAME_CODE_ATTRIBUTE_DEFINITION_REF =
            "ORDER BY name,code,attribute_definition_ref LIMIT ?) ";
    public static final String CATALOG_DEFINITION_FACTS_SELECT_DEFINITION_ATTRIBUTE_DEFINITION_REF_CODE_NAME =
            "SELECT definition.attribute_definition_ref,definition.code,definition.name,";
    public static final String CATALOG_DEFINITION_FACTS_DEFINITION_STATUS_VALUE_TYPE_VERSION =
            "definition.status,definition.value_type,definition.version,";
    public static final String CATALOG_DEFINITION_FACTS_OPTION_ATTRIBUTE_DEFINITION_OPTION_REF =
            "option.attribute_definition_option_ref,";
    public static final String CATALOG_DEFINITION_FACTS_OPTION_NAME_DISPLAY_ORDER = "option.name,option.display_order ";
    public static final String CATALOG_DEFINITION_FACTS_FROM_CLAUSE_BOUNDED_DEFINITION_DEFINITION =
            "FROM bounded_definition definition ";
    public static final String CATALOG_DEFINITION_FACTS_CATALOG_ATTRIBUTE_DEFINITION_OPTIO_OPTION =
            "LEFT JOIN catalog.catalog_attribute_definition_option option ";
    public static final String CATALOG_DEFINITION_FACTS_JOIN_CONDITION_OPTION_ATTRIBUTE_DEFINITION_REF_DEFINITION =
            "ON option.attribute_definition_ref=definition.attribute_definition_ref ";
    public static final String CATALOG_DEFINITION_FACTS_ORDER_BY_DEFINITION_NAME_CODE_ATTRIBUTE_DEFINITION_REF =
            "ORDER BY definition.name,definition.code,definition.attribute_definition_ref,";
    public static final String CATALOG_DEFINITION_FACTS_OPTION_DISPLAY_ORDER_ATTRIBUTE_DEFINITION_OPTION_REF =
            "option.display_order,option.attribute_definition_option_ref";
    public static final String CATALOG_DEFINITION_FACTS_INSERT_INTO_CATALOG_ATTRIBUTE_DEFINITION =
            "INSERT INTO catalog.catalog_attribute_definition(attribute_definition_ref,data_node_ref,brand_";
    public static final String
            CATALOG_DEFINITION_FACTS_UPDATE_CATALOG_ATTRIBUTE_DEFINITION_CODE_NAME_VERSION_UPDATED_AT_EPO =
                    "UPDATE catalog.catalog_attribute_definition SET code=?,name=?,version=version+1,updated_at_epo";

    public static final String CATALOG_DEFINITION_FACTS_CONDITION_STATUS_ENABLED_ALTERNATE_A = " AND status='ENABLED'";
    public static final String CATALOG_DEFINITION_FACTS_SELECT_ORDER_OPTION_DEFINITION_REF_CODE_NAME_STATUS =
            "SELECT order_option_definition_ref,code,name,status,selection_mode,version ";
    public static final String CATALOG_DEFINITION_FACTS_FROM_CLAUSE_CATALOG_ORDER_OPT_FROM_CATALOG_CATALOG_ORDER_O =
            "FROM catalog.catalog_order_opt";

    public static final String CATALOG_DEFINITION_FACTS_WHERE_DATA_NODE_REF_BRAND_REF_ALTERNATE_A =
            "WHERE data_node_ref=? AND brand_ref=?";

    public static final String CATALOG_DEFINITION_FACTS_INSERT_INTO_CATALOG_ORDER_OPTION_DEFINITION =
            "INSERT INTO catalog.catalog_order_option_definition(order_option_definition_ref,data_node_ref,";
    public static final String
            CATALOG_DEFINITION_FACTS_UPDATE_CATALOG_ORDER_OPTION_DEFINITION_NAME_SELECTION_MODE_VERSION_UPDAT =
                    ("UPDATE catalog.catalog_order_option_definition SET name=?,selection_mode"
                            + "=?,version=version+1,updat");

    public static final String CATALOG_DEFINITION_FACTS_CONDITION_VERSION_STATUS_VOIDED =
            "AND version=? AND status <> 'VOIDED'";
    public static final String CATALOG_DEFINITION_FACTS_SELECT_CATALOG_ATTRIBUTE_DEFINITIO =
            "SELECT attribute_definition_option_ref,name,display_order FROM catalog.catalog_attribute_definitio";
    public static final String CATALOG_DEFINITION_FACTS_SELECT_CATALOG_ORDER_OPTION =
            "SELECT order_option_definition_value_ref,code,name,display_order FROM catalog.catalog_order_option";
    public static final String CATALOG_DEFINITION_FACTS_SELECT_MATERIAL =
            "SELECT material.order_option_definition_value_ref,material.order_option_definition_material_ref,";
    public static final String CATALOG_DEFINITION_FACTS_MATERIAL_MATERIAL_ITEM_REF_MATERIAL_ITEM_NAME =
            "material.material_item_ref,material_item.name,material.stock_target_ref,";
    public static final String CATALOG_DEFINITION_FACTS_MATERIAL =
            "material.consumption_unit_ref,material.consumption_unit_code,material.consumption_unit_name,";
    public static final String CATALOG_DEFINITION_FACTS_MATERIAL_CONSUMPTION_UNIT_DIMENSION_CONSUMPTION_UNIT_PRECISION =
            "material.consumption_unit_dimension,material.consumption_unit_precision ";
    public static final String CATALOG_DEFINITION_FACTS_FROM_CLAUSE_CATALOG_ITEM_MATERIAL =
            "FROM catalog.catalog_order_option_definition_material material JOIN catalog.catalog_item ";
    public static final String CATALOG_DEFINITION_FACTS_MATERIAL_ITEM_ITEM_REF_MATERIAL_MATERIAL_ITEM_REF =
            "material_item ON material_item.item_ref=material.material_item_ref WHERE material.";
    public static final String CATALOG_DEFINITION_FACTS_ALTERNATIVE_ORDER_OPTION_DEFINITION_VALUE_REF =
            "order_option_definition_value_ref IN (";
    public static final String
            CATALOG_DEFINITION_FACTS_DELETE_CATALOG_ATTRIBUTE_DEFINITION_OPTIO_ATTRIBUTE_DEFINITION_REF =
                    "DELETE FROM catalog.catalog_attribute_definition_option WHERE attribute_definition_ref=?";
    public static final String CATALOG_DEFINITION_FACTS_INSERT_INTO_CATALOG_ATTRIBUTE_DEFINITION_OPTIO =
            "INSERT INTO catalog.catalog_attribute_definition_option(attribute_definition_option_ref,attrib";

    public static final String
            CATALOG_DEFINITION_FACTS_UPDATE_CATALOG_ORDER_OPTION_DEFINITION_VA_NAME_DISPLAY_ORDER_ORDE =
                    "UPDATE catalog.catalog_order_option_definition_value SET name=?,display_order=? WHERE orde";

    public static final String CATALOG_DEFINITION_FACTS_INSERT_INTO_CATALOG_ORDER_OPTION_DEFINITION_VA =
            "INSERT INTO catalog.catalog_order_option_definition_value(order_option_definition_value_re";
    public static final String
            CATALOG_DEFINITION_FACTS_DELETE_CATALOG_ORDER_OPTION_DEFINITION_MA_ORDER_OPTION_DEFINITION_VAL =
                    "DELETE FROM catalog.catalog_order_option_definition_material WHERE order_option_definition_val";

    public static final String CATALOG_DEFINITION_FACTS_INSERT_INTO_CATALOG_ORDER_OPTION_DEFINITION_MA =
            "INSERT INTO catalog.catalog_order_option_definition_material(order_option_definition_mater";

    public static final String DELETE_CAT_ITEM_ORD_OPT_002 =
            "DELETE FROM catalog.catalog_item_order_option_value_override WHERE ";
    public static final String CATALOG_DEFINITION_FACTS_ALTERNATIVE_ORDER_OPTION_DEFINITION_VALUE_REF_ALTERNATE_A =
            "order_option_definition_value_ref=?";
    public static final String DELETE_CAT_ORD_OPT_DEF_003 =
            "DELETE FROM catalog.catalog_order_option_definition_material WHERE ";
    public static final String CATALOG_DEFINITION_FACTS_ALTERNATIVE_ORDER_OPTION_DEFINITION_VALUE_REF_ALTERNATE_B =
            "order_option_definition_value_ref=?";
    public static final String DELETE_CAT_ORD_OPT_DEF_004 =
            "DELETE FROM catalog.catalog_order_option_definition_value WHERE ";
    public static final String CATALOG_DEFINITION_FACTS_ALTERNATIVE_ORDER_OPTION_DEFINITION_VALUE_REF_ALTERNATE_C =
            "order_option_definition_value_ref=?";
    public static final String CATALOG_DEFINITION_FACTS_SELECT_CATALOG_ATTRIBUTE_DEFINITIO_ALTERNATE_A =
            "SELECT attribute_definition_option_ref,name,display_order FROM catalog.catalog_attribute_definitio";
    public static final String CATALOG_DEFINITION_FACTS_SELECT_CATALOG_ITEM_ATTRIBUTE_ASSIGNMENT_ATTRIBUTE_DEFINITION =
            "SELECT EXISTS (SELECT 1 FROM catalog.catalog_item_attribute_assignment WHERE attribute_definition_";

    public static final String SELECT_CAT_ITEM_ORD_OPT_005 =
            "SELECT EXISTS (SELECT 1 FROM catalog.catalog_item_order_option_config ";
    public static final String CATALOG_DEFINITION_FACTS_WHERE_ORDER_OPTION_DEFINITION_REF =
            "WHERE order_option_definition_ref=?)";
    public static final String UPDATE_CAT_ATTR_DEF_STATUS_006 =
            "UPDATE catalog.catalog_attribute_definition SET status=?,version=version+1,";
    public static final String CATALOG_DEFINITION_FACTS_UPDATE_UPDATED_AT_EPOCH_MILLIS = "updated_at_epoch_millis=? ";
    public static final String WHERE_ATTR_DEF_REF_VER_007 =
            "WHERE attribute_definition_ref=? AND version=? AND status <> 'VOIDED'";
    public static final String CATALOG_DEFINITION_FACTS_SELECT_ATTRIBUTE_DEFINITION_REF_CODE_NAME_STATUS_ALTERNATE_A =
            "SELECT attribute_definition_ref,code,name,status,value_type,version ";
    public static final String
            CATALOG_DEFINITION_FACTS_FROM_CLAUSE_CATALOG_ATTRIBUTE_DEFINI_FROM_CATALOG_CATALOG_ATTRIBU =
                    "FROM catalog.catalog_attribute_defini";

    public static final String SELECT_ORD_OPT_DEF_REF_ALT_A_008 =
            "SELECT order_option_definition_ref,code,name,status,selection_mode,version ";
    public static final String
            CATALOG_DEFINITION_FACTS_FROM_CLAUSE_CATALOG_ORDER_OPT_FROM_CATALOG_CATALOG_ORDER_O_ALTERNATE_A =
                    "FROM catalog.catalog_order_opt";

    public static final String UPDATE_CAT_ORD_OPT_DEF_009 =
            "UPDATE catalog.catalog_order_option_definition SET status=?,version=version+1,";
    public static final String UPDATE_UPDATED_AT_EPOCH_MS_ALT_A_010 = "updated_at_epoch_millis=? ";
    public static final String WHERE_ORD_OPT_DEF_REF_011 =
            "WHERE order_option_definition_ref=? AND version=? AND status <> 'VOIDED'";
    public static final String CATALOG_DEFINITION_FACTS_SELECT_CATALOG_ORDER_OPTION_ALTERNATE_A =
            "SELECT order_option_definition_value_ref,code,name,display_order FROM catalog.catalog_order_option";
    public static final String CATALOG_DEFINITION_FACTS_REF_CODE_NAME_STATUS =
            "ref,code,name,status,value_type,version,created_at_epoch_millis,updated_at_epoch_millis) ";
    public static final String CATALOG_DEFINITION_FACTS_VALUES_ENABLED = "VALUES(?,?,?,?,?,'ENABLED',?,1,?,?)";
    public static final String CATALOG_DEFINITION_FACTS_BRAND_REF_CODE_NAME_STATUS =
            "brand_ref,code,name,status,selection_mode,version,created_at_epoch_millis,";
    public static final String CATALOG_DEFINITION_FACTS_UPDATE_UPDATED_AT_EPOCH_MILLIS_ALTERNATE_B =
            "updated_at_epoch_millis";
    public static final String CATALOG_DEFINITION_FACTS_CLOSE_PAREN_ENABLED = ") VALUES(?,?,?,?,?,'ENABLED',?,1,?,?)";
    public static final String CATALOG_DEFINITION_FACTS_N_OPTION_ATTRIBUTE_DEFINITION_REF_DISPLAY_ORDER =
            "n_option WHERE attribute_definition_ref=? ORDER BY display_order,";
    public static final String CATALOG_DEFINITION_FACTS_ATTRIBUTE_DEFINITION_OPTION_REF =
            "attribute_definition_option_ref";
    public static final String CATALOG_DEFINITION_FACTS_DEFINITION_VALUE_ORDER_OPTION_DEFINITION_REF_DISPLAY_ORDER =
            "_definition_value WHERE order_option_definition_ref=? ORDER BY display_order,";
    public static final String CATALOG_DEFINITION_FACTS_ALTERNATIVE_ORDER_OPTION_DEFI = "order_option_defi";

    public static final String CATALOG_DEFINITION_FACTS_CLOSE_PAREN_ORDER_BY = ") ORDER BY ";
    public static final String CATALOG_DEFINITION_FACTS_MATERIAL_ALTERNATE_A =
            "material.order_option_definition_value_ref,material.order_option_definition_material_ref";
    public static final String ORD_OPT_DEF_REF_DATA_012 =
            "f,order_option_definition_ref,data_node_ref,brand_ref,code,name,display_order)";
    public static final String CATALOG_DEFINITION_FACTS_VALUES = " VALUES(";
    public static final String CATALOG_DEFINITION_FACTS_PARAMETER_PLACEHOLDER = "?,?,?,?,?,?,?)";
    public static final String CATALOG_DEFINITION_FACTS_N_OPTION_ATTRIBUTE_DEFINITION_REF_DISPLAY_ORDER_ALTERNATE_A =
            "n_option WHERE attribute_definition_ref=? ORDER BY display_order,";
    public static final String CATALOG_DEFINITION_FACTS_ATTRIBUTE_DEFINITION_OPTION_REF_ALTERNATE_A =
            "attribute_definition_option_ref";
    public static final String DEF_VAL_ORD_OPT_DEF_ALT_A_013 =
            "_definition_value WHERE order_option_definition_ref=? ORDER BY display_order,";
    public static final String CATALOG_DEFINITION_FACTS_ALTERNATIVE_ORDER_OPTION_DEFI_ALTERNATE_A = "order_option_defi";

    public static final String UPDATE_CAT_ATTR_DEF_SET_014 =
            """
    UPDATE catalog.catalog_attribute_definition SET code=?,name=?,vers\
    ion=version+1,updated_at_epoch_millis=? WHERE attribute_definition\
    _ref=? AND version=? AND status <> 'VOIDED'""";
    public static final String FROM_CAT_ORD_OPT_DEF_015 = """
    FROM catalog.catalog_order_option_definition\s""";
    public static final String ORD_BY_NAME_CODE_ORD_016 =
            """
    \sORDER BY name,code,order_option_definition_ref LIMIT ?""";
    public static final String UPDATE_CAT_ORD_OPT_DEF_017 =
            """
    UPDATE catalog.catalog_order_option_definition SET name=?,selectio\
    n_mode=?,version=version+1,updated_at_epoch_millis=? WHERE order_o\
    ption_definition_ref=?\s""";
    public static final String CATALOG_DEFINITION_FACTS_ORDER_OPTION_DEFINITION_VALUE_REF =
            """
    order_option_definition_value_ref""";
    public static final String INSERT_INTO_CAT_ATTR_DEF_018 =
            """
    INSERT INTO catalog.catalog_attribute_definition_option(attribute_\
    definition_option_ref,attribute_definition_ref,name,display_order)\
     VALUES(?,?,?,?)""";
    public static final String UPDATE_CAT_ORD_OPT_DEF_019 =
            """
    UPDATE catalog.catalog_order_option_definition_value SET name=?,di\
    splay_order=? WHERE order_option_definition_value_ref=?""";
    public static final String DELETE_FROM_CAT_ORD_OPT_020 =
            """
    DELETE FROM catalog.catalog_order_option_definition_material WHERE order_option_definition_value_ref=?""";
    public static final String INSERT_INTO_CAT_ORD_OPT_021 =
            """
    INSERT INTO catalog.catalog_order_option_definition_material(order\
    _option_definition_material_ref,order_option_definition_value_ref,\
    material_item_ref,stock_target_ref,""";
    public static final String CONSUM_UNIT_REF_CONSUM_UNIT_022 =
            """
    consumption_unit_ref,consumption_unit_code,consumption_unit_name,c\
    onsumption_unit_dimension,consumption_unit_precision) VALUES(?,?,?\
    ,?,?,?,?,?,?)""";
    public static final String SELECT_EXISTS_SELECT_FROM_CAT_023 =
            """
    SELECT EXISTS (SELECT 1 FROM catalog.catalog_item_attribute_assignment WHERE attribute_definition_ref=?)""";
    public static final String FROM_CAT_ATTR_DEF_WHERE_024 =
            """
    FROM catalog.catalog_attribute_definition WHERE data_node_ref=? AND brand_ref=? AND attribute_definition_ref=?""";
    public static final String FROM_CAT_ORD_OPT_DEF_025 =
            """
    FROM catalog.catalog_order_option_definition WHERE data_node_ref=?\
     AND brand_ref=? AND order_option_definition_ref=?""";
    public static final String CATALOG_DEFINITION_FACTS_ORDER_OPTION_DEFINITION_VALUE_REF_ALTERNATE_A =
            """
    order_option_definition_value_ref""";
}
