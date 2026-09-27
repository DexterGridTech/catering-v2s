package com.catering.v2s.catalog.application.persistence;

/** SQL text fragments owned by CatalogItemDefinitionFacts; B3 relocates text only and does not change execution. */
public final class CatalogItemDefinitionFactsSql {
    public static final String PARAMETER_PLACEHOLDER = "?";
    public static final String PLACEHOLDER_SEPARATOR = ",";
    public static final String
            CATALOG_ITEM_DEFINITION_FACTS_SELECT_ASSIGNMENT_ITEM_REF_ITEM_ATTRIBUTE_ASSIGNMENT_REF_DEFINITION =
                    ("SELECT assignment.item_ref,assignment.item_attribute_assignment_ref,defi"
                            + "nition.attribute_definitio");

    public static final String CATALOG_ITEM_DEFINITION_FACTS_FROM_CLAUSE_CATALOG_ITEM_ATTRIBUTE_ASSIGNMENT_ASSIGNMENT =
            "FROM catalog.catalog_item_attribute_assignment assignment ";
    public static final String
            CATALOG_ITEM_DEFINITION_FACTS_JOIN_CATALOG_ATTRIBUTE_DEFINITION_DEFINITION_ATTRIBUTE_DEFINITION =
                    "JOIN catalog.catalog_attribute_definition definition ON definition.attribute_definition_";

    public static final String CATALOG_ITEM_DEFINITION_FACTS_ATTRIBUTE_DEFINITION_OPTION_REF_SELECTION =
            "attribute_definition_option_ref=selection.attribute_definition_option_ref ";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_WHERE_ASSIGNMENT_ITEM_REF =
            "WHERE assignment.item_ref IN (";
    public static final String SELECT_ASSIGN_ITEM_REF_ITEM_ALT_A_001 =
            ("SELECT assignment.item_ref,assignment.item_attribute_assignment_ref,defi"
                    + "nition.attribute_definition_");

    public static final String CATALOG_ITEM_DEFINITION_FACTS_TEXT_VALUE_SELECTION_ATTRIBUTE_DEFINITION_OPTION_REF =
            "text_value,selection.attribute_definition_option_ref,";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_OPTION_ROW =
            "option_row.attribute_definition_option_ref,option_row.name,option_row.display_order";
    public static final String FROM_CLAUSE_CAT_ITEM_ATTR_ALT_A_002 =
            " FROM catalog.catalog_item_attribute_assignment assignment JOIN";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_CATALOG_ATTRIBUTE_DEFINITION_DEFINITION =
            " catalog.catalog_attribute_definition definition ON";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_DEFINITION_ATTRIBUTE_DEFINITION_REF_ASSIGNMENT =
            " definition.attribute_definition_ref=assignment.attribute_definition_ref LEFT JOIN";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_CATALOG_ITEM_ATTRIBUTE_SELECTION_SELECTION =
            " catalog.catalog_item_attribute_selection selection ON";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_SELECT_SELECTION_ITEM_ATTRIBUTE_ASSIGNMENT_REF_ASSIGNMENT =
            " selection.item_attribute_assignment_ref=assignment.item_attribute_assignment_ref LEFT JOIN";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_CATALOG_ATTRIBUTE_DEFINITION_OPTIO_OPTION_ROW =
            " catalog.catalog_attribute_definition_option option_row ON";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_OPTION_ROW_ATTRIBUTE_DEFINITION_REF_DEFINITION =
            " option_row.attribute_definition_ref=definition.attribute_definition_ref WHERE";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_DEFINITION_DATA_NODE_REF_BRAND_REF_ASSIGNMENT =
            " definition.data_node_ref=? AND definition.brand_ref=? AND assignment.item_ref IN (";
    public static final String SELECT_CONFIG_ITEM_REF_ITEM_003 =
            ("SELECT config.item_ref,config.item_order_option_config_ref,definition.or" + "der_option_definition_ref,");
    public static final String CATALOG_ITEM_DEFINITION_FACTS_DEFINITION_NAME_SELECTION_MODE_CONFIG =
            "definition.name,definition.selection_mode,config.display_order,config.is_required,";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_CONFIG_MIN_SELECTION_COUNT_MAX_SELECTION_COUNT =
            "config.min_selection_count,config.max_selection_count,";

    public static final String CATALOG_ITEM_DEFINITION_FACTS_OVERRIDE =
            "override.item_order_option_value_override_ref,override.is_default,override.extra_price,";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_OVERRIDE_PREPARATION_EFFECT_TEXT =
            "override.preparation_effect::text ";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_FROM_CLAUSE_CATALOG_ITEM_ORDER_OPTION_CONFIG_CONFIG =
            "FROM catalog.catalog_item_order_option_config config ";
    public static final String
            CATALOG_ITEM_DEFINITION_FACTS_JOIN_CATALOG_ORDER_OPTION_DEFINITION_DEFINITION_ORDER_OPTION_DEFIN =
                    "JOIN catalog.catalog_order_option_definition definition ON definition.order_option_defin";

    public static final String CATALOG_ITEM_DEFINITION_FACTS_JOIN_CATALOG_ORDER_OPTION_DEFINITION_VA_VALUE_DEFINITION =
            "JOIN catalog.catalog_order_option_definition_value value_definition ON value_definition.";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_ALTERNATIVE_ORDER_OPTION_DEFINITION_REF_DEFINITION =
            "order_option_definition_ref=definition.order_option_definition_ref ";

    public static final String CATALOG_ITEM_DEFINITION_FACTS_CONDITION_OVERRIDE =
            "AND override.order_option_definition_value_ref=value_definition.order_option_definition_";

    public static final String CATALOG_ITEM_DEFINITION_FACTS_WHERE_CONFIG_ITEM_REF = "WHERE config.item_ref IN (";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_CTE_RELATED_ITEMS_ITEM_REF_MATERIAL_MATERIAL_ITEM_REF =
            "WITH related_items(item_ref) AS (SELECT ?::uuid UNION SELECT DISTINCT material.material_item_ref FROM";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_CATALOG_ITEM_ORDER_OPTION_CONFIG_CONFIG =
            " catalog.catalog_item_order_option_config config JOIN";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_CATALOG_ORDER_OPTION_DEFINITION_VA_VALUE_DEFINITION =
            " catalog.catalog_order_option_definition_value value_definition ON";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_VALUE_DEFINITION_ORDER_OPTION_DEFINITION_REF_CONFIG =
            " value_definition.order_option_definition_ref=config.order_option_definition_ref JOIN";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_CATALOG_ORDER_OPTION_DEFINITION_MA_MATERIAL =
            " catalog.catalog_order_option_definition_material material ON";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_MATERIAL =
            " material.order_option_definition_value_ref=value_definition.";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_ALTERNATIVE_ORDER_OPTION_DEFINITION_VALUE_REF =
            "order_option_definition_value_ref";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_WHERE_CONFIG_ITEM_REF_ALTERNATE_A =
            " WHERE config.item_ref=?),";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_MAPPINGS_SORT_ORDER_OBJECT_TYPE_SOURCE_REF =
            " mappings(sort_order,object_type,source_ref,target_code,target_sku_code) AS (SELECT";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_CATALOG_ORDER_OPTION_DEFINITION_VA =
            " 1,'CATALOG_ORDER_OPTION_DEFINITION_VALUE',";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_VALUE_DEFINITION_ORDER_OPTION_DEFINITION_VALUE_REF_CODE =
            "value_definition.order_option_definition_value_ref,value_definition.code,NULL";
    public static final String FROM_CLAUSE_CAT_ITEM_ORD_ALT_A_004 =
            " FROM catalog.catalog_item_order_option_config config JOIN";
    public static final String CAT_ORD_OPT_DEF_VA_ALT_A_005 =
            " catalog.catalog_order_option_definition_value value_definition ON";
    public static final String VAL_DEF_ORD_OPT_DEF_ALT_A_006 =
            " value_definition.order_option_definition_ref=config.order_option_definition_ref WHERE";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_CONFIG_ITEM_REF = " config.item_ref=? UNION SELECT";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_CATALOG_ITEM_MATERIAL_MATERIAL_ITEM_REF_MATERIAL_ITEM =
            " 2,'CATALOG_ITEM',material.material_item_ref,material_item.code,NULL FROM";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_CATALOG_ITEM_ORDER_OPTION_CONFIG_CONFIG_ALTERNATE_A =
            " catalog.catalog_item_order_option_config config JOIN";
    public static final String CAT_ORD_OPT_DEF_VA_ALT_B_007 =
            " catalog.catalog_order_option_definition_value value_definition ON";
    public static final String VAL_DEF_ORD_OPT_DEF_ALT_B_008 =
            " value_definition.order_option_definition_ref=config.order_option_definition_ref JOIN";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_CATALOG_ORDER_OPTION_DEFINITION_MA_MATERIAL_ALTERNATE_A =
            " catalog.catalog_order_option_definition_material material ON";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_MATERIAL_ALTERNATE_A =
            " material.order_option_definition_value_ref=value_definition.";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_ALTERNATIVE_ORDER_OPTION_DEFINITION_VALUE_REF_ALTERNATE_A =
            "order_option_definition_value_ref";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_JOIN_CATALOG_ITEM_MATERIAL_ITEM =
            " JOIN catalog.catalog_item material_item ON";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_MATERIAL_ITEM_ITEM_REF_MATERIAL_MATERIAL_ITEM_REF =
            " material_item.item_ref=material.material_item_ref";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_WHERE_CONFIG_ITEM_REF_PRODUCT_SKU_SKU =
            " WHERE config.item_ref=? UNION SELECT 3,'PRODUCT_SKU',sku.product_sku_ref,NULL,sku.sku_code";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_FROM_CLAUSE_RELATED_ITEMS_SKU_ITEM_ITEM_REF =
            " FROM catalog.catalog_sku sku JOIN related_items item ON item.item_ref=sku.item_ref WHERE";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_SKU_STATUS_VOIDED_OBJECT_TYPE =
            " sku.status <> 'VOIDED') SELECT object_type,source_ref,target_code,target_sku_code FROM";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_MAPPINGS_SORT_ORDER_SOURCE_REF =
            " mappings ORDER BY sort_order,source_ref";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_SELECT_CATALOG_ITEM_ATTRIBUTE =
            "SELECT attribute_definition_ref,item_attribute_assignment_ref FROM catalog.catalog_item_attribute_";

    public static final String DELETE_CAT_ITEM_ATTR_SELECTN_009 =
            "DELETE FROM catalog.catalog_item_attribute_selection WHERE item_attribute_assignment_ref IN (";
    public static final String DELETE_CAT_ITEM_ATTR_ASSIGN_010 =
            "DELETE FROM catalog.catalog_item_attribute_assignment WHERE item_attribute_assignment_ref IN (";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_INSERT_INTO_CATALOG_ITEM_ATTRIBUTE_ASSIGNMENT =
            "INSERT INTO catalog.catalog_item_attribute_assignment(item_attribute_assignment_ref,item_ref,";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_ATTRIBUTE_DEFINITION_REF_TEXT_VALUE =
            "attribute_definition_ref,text_value) VALUES(?,?,?,?)";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_UPDATE_CATALOG_ITEM_ATTRIBUTE_ASSIGNMENT_TEXT_VALUE =
            "UPDATE catalog.catalog_item_attribute_assignment SET text_value=? WHERE ";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_ITEM_ATTRIBUTE_ASSIGNMENT_REF =
            "item_attribute_assignment_ref=?";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_INSERT_INTO_CATALOG_ITEM_ATTRIBUTE_SELECTION =
            "INSERT INTO catalog.catalog_item_attribute_selection(item_attribute_assignment_ref,";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_ATTRIBUTE_DEFINITION_OPTION_REF =
            "attribute_definition_option_ref) VALUES(?,?)";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_SELECT_CATALOG_ITEM_ORDER_OP =
            "SELECT order_option_definition_ref,item_order_option_config_ref FROM catalog.catalog_item_order_op";

    public static final String DELETE_CAT_ITEM_ORD_OPT_011 =
            "DELETE FROM catalog.catalog_item_order_option_value_override WHERE ";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_ITEM_ORDER_OPTION_CONFIG_REF =
            "item_order_option_config_ref IN (";
    public static final String DELETE_CAT_ITEM_ORD_OPT_012 =
            "DELETE FROM catalog.catalog_item_order_option_config WHERE item_order_option_config_ref IN (";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_INSERT_INTO_CATALOG_ITEM_ORDER_OPTION_CONFIG =
            "INSERT INTO catalog.catalog_item_order_option_config(item_order_option_config_ref,item_ref,";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_ALTERNATIVE_ORDER_OPTION_DEFINITION_REF =
            "order_option_definition_ref,display_order,is_required,min_selection_count,";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_MAX_SELECTION_COUNT = "max_selection_count) ";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_VALUES = "VALUES(?,?,?,?,?,?,?)";
    public static final String UPDATE_CAT_ITEM_ORD_OPT_013 =
            "UPDATE catalog.catalog_item_order_option_config SET display_order=?,is_required=?,";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_MIN_SELECTION_COUNT =
            "min_selection_count=?,max_selection_count=? WHERE item_order_option_config_ref=?";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_INSERT_INTO_CATALOG_ITEM_ORDER_OPTION_VALUE_OV =
            "INSERT INTO catalog.catalog_item_order_option_value_override(";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_ITEM_ORDER_OPTION_VALUE_OVERRIDE_R =
            "item_order_option_value_override_ref,item_order_option_config_ref,";
    public static final String ALT_ORD_OPT_DEF_VAL_014 =
            "order_option_definition_value_ref,is_default,extra_price) VALUES(?,?,?,?,?)";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_SELECT_CATALOG_ITEM_ORDER_OPTION_CONFIG =
            "SELECT DISTINCT material.material_item_ref FROM catalog.catalog_item_order_option_config config ";
    public static final String
            CATALOG_ITEM_DEFINITION_FACTS_JOIN_CATALOG_ORDER_OPTION_DEFINITION_VA_VALUE_ROW_ORDER_OPTION_D =
                    "JOIN catalog.catalog_order_option_definition_value value_row ON value_row.order_option_d";

    public static final String
            CATALOG_ITEM_DEFINITION_FACTS_JOIN_CATALOG_ORDER_OPTION_DEFINITION_MA_MATERIAL_ORDER_OPTION =
                    "JOIN catalog.catalog_order_option_definition_material material ON material.order_option_";

    public static final String CATALOG_ITEM_DEFINITION_FACTS_WHERE_CONFIG_ITEM_REF_ALTERNATE_B =
            "WHERE config.item_ref IN (";
    public static final String SELECT_CONFIG_ITEM_REF_ITEM_ALT_A_015 =
            ("SELECT config.item_ref,config.item_order_option_config_ref,definition.or" + "der_option_definition_ref,");
    public static final String CATALOG_ITEM_DEFINITION_FACTS_DEFINITION_CODE_NAME_SELECTION_MODE =
            "definition.code,definition.name,definition.selection_mode,definition.version,";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_CONFIG_DISPLAY_ORDER_IS_REQUIRED_MIN_SELECTION_COUNT =
            "config.display_order,config.is_required,config.min_selection_count,";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_CONFIG =
            "config.max_selection_count,value_definition.order_option_definition_value_ref,";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_VALUE_DEFINITION_CODE_NAME_DISPLAY_ORDER =
            "value_definition.code,value_definition.name,value_definition.display_order,";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_OVERRIDE_ALTERNATE_A =
            "override.item_order_option_value_override_ref,override.is_default,override.extra_price,";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_MATERIAL_ALTERNATE_B =
            "material.order_option_definition_material_ref,material.material_item_ref,";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_MATERIAL_ITEM_CODE_MATERIAL_STOCK_TARGET_REF =
            "material_item.code,material.stock_target_ref,material.consumption_unit_ref,";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_MATERIAL_CONSUMPTION_UNIT_CODE_CONSUMPTION_UNIT_NAME =
            "material.consumption_unit_code,material.consumption_unit_name,";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_MATERIAL_ALTERNATE_C =
            "material.consumption_unit_dimension,material.consumption_unit_precision";
    public static final String FROM_CLAUSE_CAT_ITEM_ORD_ALT_B_016 =
            " FROM catalog.catalog_item_order_option_config config JOIN";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_CATALOG_ORDER_OPTION_DEFINITION_DEFINITION =
            " catalog.catalog_order_option_definition definition ON";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_DEFINITION_ORDER_OPTION_DEFINITION_REF_CONFIG =
            " definition.order_option_definition_ref=config.order_option_definition_ref LEFT JOIN";
    public static final String CAT_ORD_OPT_DEF_VA_ALT_C_017 =
            " catalog.catalog_order_option_definition_value value_definition ON";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_VALUE_DEFINITION_ORDER_OPTION_DEFINITION_REF_DEFINITION =
            " value_definition.order_option_definition_ref=definition.order_option_definition_ref";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_LEFT_JOIN = " LEFT JOIN";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_CATALOG_ITEM_ORDER_OPTION_VALUE_OV_OVERRIDE =
            " catalog.catalog_item_order_option_value_override override ON";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_OVERRIDE_ITEM_ORDER_OPTION_CONFIG_REF_CONFIG =
            " override.item_order_option_config_ref=config.item_order_option_config_ref AND";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_OVERRIDE_ALTERNATE_B =
            " override.order_option_definition_value_ref=value_definition.";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_ALTERNATIVE_ORDER_OPTION_DEFINITION_VALUE_REF_ALTERNATE_B =
            "order_option_definition_value_ref LEFT JOIN";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_CATALOG_ORDER_OPTION_DEFINITION_MA_MATERIAL_ALTERNATE_B =
            " catalog.catalog_order_option_definition_material material ON";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_MATERIAL_ALTERNATE_D =
            " material.order_option_definition_value_ref=value_definition.";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_ALTERNATIVE_CATALOG_ITEM =
            "order_option_definition_value_ref LEFT JOIN catalog.catalog_item material_item ON";
    public static final String MAT_ITEM_REF_MAT_ITEM_ALT_A_018 = " material_item.item_ref=material.material_item_ref";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_WHERE_DEFINITION_DATA_NODE_REF_BRAND_REF_CONFIG =
            " WHERE definition.data_node_ref=? AND definition.brand_ref=? AND config.item_ref IN (";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_INSERT_INTO_CATALOG_ORDER_OPTION_DEFINITION =
            "INSERT INTO catalog.catalog_order_option_definition(order_option_definition_ref,data_node_ref,";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_INSERT_INTO_CATALOG_ORDER_OPTION_DEFINITION_VA =
            "INSERT INTO catalog.catalog_order_option_definition_value(order_option_definition_value_re";
    public static final String INSERT_INTO_CAT_ORD_OPT_019 =
            "INSERT INTO catalog.catalog_order_option_definition_material(order_option_definition_m";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_SELECT_CATALOG_ORDER_OPT =
            "SELECT order_option_definition_ref,code,name,selection_mode,version FROM catalog.catalog_order_opt";

    public static final String CATALOG_ITEM_DEFINITION_FACTS_WHERE_DATA_NODE_REF_BRAND_REF_ORDER_OPTION_DEFINITION_REF =
            "WHERE data_node_ref=? AND brand_ref=? AND order_option_definition_ref IN (";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_SELECT_DEFINITION_ORDER_OPTION_DEFINITION_REF_CODE_NAME =
            "SELECT definition.order_option_definition_ref,definition.code,definition.name,";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_DEFINITION_SELECTION_MODE_VERSION_VALUE_ROW =
            "definition.selection_mode,definition.version,value_row.order_option_definition_value_ref,";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_VALUE_ROW_CODE_NAME_DISPLAY_ORDER =
            "value_row.code,value_row.name,value_row.display_order,";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_MATERIAL_ALTERNATE_E =
            "material.order_option_definition_material_ref,material.material_item_ref,";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_MATERIAL_ITEM_CODE_MATERIAL_STOCK_TARGET_REF_ALTERNATE_A =
            "material_item.code,material.stock_target_ref,material.consumption_unit_ref,";
    public static final String MAT_CONSUM_UNIT_CODE_CONSUM_ALT_A_020 =
            "material.consumption_unit_code,material.consumption_unit_name,";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_MATERIAL_ALTERNATE_F =
            "material.consumption_unit_dimension,material.consumption_unit_precision ";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_FROM_CLAUSE_CATALOG_ORDER_OPTION_DEFINITION_DEFINITION =
            "FROM catalog.catalog_order_option_definition definition LEFT JOIN";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_CATALOG_ORDER_OPTION_DEFINITION_VA_VALUE_ROW =
            " catalog.catalog_order_option_definition_value value_row ON";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_VALUE_ROW_ORDER_OPTION_DEFINITION_REF_DEFINITION =
            " value_row.order_option_definition_ref=definition.order_option_definition_ref LEFT JOIN";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_CATALOG_ORDER_OPTION_DEFINITION_MA_MATERIAL_ALTERNATE_C =
            " catalog.catalog_order_option_definition_material material ON";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_MATERIAL_ORDER_OPTION_DEFINITION_VALUE_REF =
            " material.order_option_definition_value_ref=";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_VALUE_ROW_ORDER_OPTION_DEFINITION_VALUE_REF =
            "value_row.order_option_definition_value_ref LEFT JOIN";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_CATALOG_ITEM_MATERIAL_ITEM_ITEM_REF_MATERIAL =
            " catalog.catalog_item material_item ON material_item.item_ref=material.material_item_ref ";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_WHERE_DEFINITION_DATA_NODE_REF_BRAND_REF_CODE =
            "WHERE definition.data_node_ref=? AND definition.brand_ref=? AND definition.code IN (";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_SELECT_VALUE_ROW =
            "SELECT value_row.order_option_definition_ref,value_row.order_option_definition_value_ref,value_row.";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_CODE_VALUE_ROW_NAME_DISPLAY_ORDER =
            "code,value_row.name,value_row.display_order,material.order_option_definition_material_ref,";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_MATERIAL_MATERIAL_ITEM_REF_MATERIAL_ITEM_CODE =
            "material.material_item_ref,material_item.code,material.stock_target_ref,";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_MATERIAL_ALTERNATE_G =
            "material.consumption_unit_ref,material.consumption_unit_code,material.consumption_unit_name,";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_CATALOG =
            "material.consumption_unit_dimension,material.consumption_unit_precision FROM catalog.";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_CATALOG_CATALOG_ORDER_OPTION_DEFINITION_VA_VALUE_ROW =
            "catalog_order_option_definition_value value_row LEFT JOIN catalog.";

    public static final String MAT_ITEM_REF_MAT_ITEM_ALT_B_021 =
            "material_item ON material_item.item_ref=material.material_item_ref WHERE value_row.";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_ALTERNATIVE_ORDER_OPTION_DEFINITION_REF_ALTERNATE_A =
            "order_option_definition_ref IN (";
    public static final String SELECT_CAT_ASSIGN_ITEM_REF_022 =
            ("SELECT assignment.item_ref,assignment.attribute_definition_ref,assignmen" + "t.text_value FROM catalog.");
    public static final String CATALOG_ITEM_DEFINITION_FACTS_CATALOG_ITEM_ATTRIBUTE_ASSIGNMENT_ASSIGNMENT =
            "catalog_item_attribute_assignment assignment ";
    public static final String JOIN_CAT_ATTR_DEF_ATTR_ALT_A_023 =
            "JOIN catalog.catalog_attribute_definition definition ON definition.attribute_definition_";

    public static final String CATALOG_ITEM_DEFINITION_FACTS_WHERE_DEFINITION_DATA_NODE_REF_BRAND_REF_ASSIGNMENT =
            "WHERE definition.data_node_ref=? AND definition.brand_ref=? AND assignment.item_ref IN (";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_INSERT_INTO_CATALOG_ATTRIBUTE_DEFINITION =
            "INSERT INTO catalog.catalog_attribute_definition(attribute_definition_ref,data_node_ref,br";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_INSERT_INTO_CATALOG_ATTRIBUTE_DEFINITION_OPTIO =
            "INSERT INTO catalog.catalog_attribute_definition_option(attribute_definition_option_re";

    public static final String CATALOG_ITEM_DEFINITION_FACTS_INSERT_INTO_CATALOG_ITEM_ATTRIBUTE_ASSIGNMENT_ALTERNATE_A =
            "INSERT INTO catalog.catalog_item_attribute_assignment(item_attribute_assignment_ref,item_ref,a";

    public static final String CATALOG_ITEM_DEFINITION_FACTS_INSERT_INTO_CATALOG_ITEM_ATTRIBUTE_SELECTION_ALTERNATE_A =
            "INSERT INTO catalog.catalog_item_attribute_selection(item_attribute_assignment_ref,attribu";

    public static final String CATALOG_ITEM_DEFINITION_FACTS_SELECT_ATTRIBUTE_DEFINITION_REF_CODE_NAME_VALUE_TYPE =
            "SELECT attribute_definition_ref,code,name,value_type,version FROM";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_CATALOG_ATTRIBUTE_DEFINITION_DATA_NODE_REF_BRAND_REF =
            " catalog.catalog_attribute_definition WHERE data_node_ref=? AND brand_ref=? AND";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_ATTRIBUTE_DEFINITION_REF =
            " attribute_definition_ref IN (";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_SELECT_DEFINITION_ATTRIBUTE_DEFINITION_REF_CODE_NAME =
            "SELECT definition.attribute_definition_ref,definition.code,definition.name,definition.value_type,";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_DEFINITION =
            "definition.version,option_row.attribute_definition_option_ref,";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_OPTION_ROW_NAME_DISPLAY_ORDER =
            "option_row.name,option_row.display_order";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_FROM_CLAUSE_CATALOG_ATTRIBUTE_DEFINITION_DEFINITION =
            " FROM catalog.catalog_attribute_definition definition LEFT JOIN";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_CATALOG_ATTRIBUTE_DEFINITION_OPTIO_OPTION_ROW_ALTERNATE_A =
            " catalog.catalog_attribute_definition_option option_row ON";
    public static final String OPT_ROW_ATTR_DEF_REF_ALT_A_024 =
            " option_row.attribute_definition_ref=definition.attribute_definition_ref WHERE";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_DEFINITION_DATA_NODE_REF_BRAND_REF_CODE =
            " definition.data_node_ref=? AND definition.brand_ref=? AND definition.code IN (";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_SELECT_CATALOG =
            "SELECT attribute_definition_ref,attribute_definition_option_ref,name,display_order FROM catalog.";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_CATALOG_ATTRIBUTE_DEFINITION_OPTIO =
            "catalog_attribute_definition_option WHERE attribute_definition_ref IN (";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_SELECT = "SELECT";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_ASSIGNMENT_ITEM_REF_ATTRIBUTE_DEFINITION_REF =
            " assignment.item_ref,assignment.attribute_definition_ref,";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_SELECT_SELECTION_ATTRIBUTE_DEFINITION_OPTION_REF =
            "selection.attribute_definition_option_ref";
    public static final String FROM_CLAUSE_CAT_ITEM_ATTR_ALT_B_025 =
            " FROM catalog.catalog_item_attribute_assignment assignment JOIN";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_CATALOG_ITEM_ATTRIBUTE_SELECTION_SELECTION_ALTERNATE_A =
            " catalog.catalog_item_attribute_selection selection ON";
    public static final String SELECT_SELECTN_ITEM_ATTR_ASSIGN_ALT_A_026 =
            " selection.item_attribute_assignment_ref=assignment.item_attribute_assignment_ref WHERE";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_ASSIGNMENT_ITEM_REF_ALTERNATE_A =
            " assignment.item_ref IN (";
    public static final String SELECT_DEF_ATTR_DEF_REF_027 =
            "SELECT definition.attribute_definition_ref,definition.value_type,definition.status,";

    public static final String CATALOG_ITEM_DEFINITION_FACTS_DEFINITION_BRAND_REF_ATTRIBUTE_DEFINITION_REF =
            "definition.brand_ref=? AND definition.attribute_definition_ref IN (";
    public static final String SELECT_DEF_ORD_OPT_DEF_028 =
            ("SELECT definition.order_option_definition_ref,definition.selection_mode,"
                    + "definition.status,value_row.");
    public static final String CATALOG_ITEM_DEFINITION_FACTS_ALTERNATIVE_CATALOG_ORDER_OPTION_DEFINITION =
            "order_option_definition_value_ref FROM catalog.catalog_order_option_definition definition ";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_CATALOG_ORDER_OPTION_DEFINITION_VA_VALUE_ROW_ALTERNATE_A =
            "LEFT JOIN catalog.catalog_order_option_definition_value value_row ON ";
    public static final String VAL_ROW_ORD_OPT_DEF_ALT_A_029 =
            "value_row.order_option_definition_ref=definition.order_option_definition_ref WHERE ";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_DEFINITION_DATA_NODE_REF_BRAND_REF =
            "definition.data_node_ref=? AND definition.brand_ref=? AND ";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_DEFINITION_ORDER_OPTION_DEFINITION_REF =
            "definition.order_option_definition_ref IN (";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_SELECT_VALUE_ROW_ORDER_OPTION_DEFINITION_VALUE_REF =
            "SELECT value_row.order_option_definition_value_ref ";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_FROM_CLAUSE_CATALOG_ORDER_OPTION_DEFINITION_VA_VALUE_ROW =
            "FROM catalog.catalog_order_option_definition_value value_row ";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_WHERE_VALUE_ROW_ORDER_OPTION_DEFINITION_REF_DISPLAY_ORDER =
            "WHERE value_row.order_option_definition_ref=? ORDER BY value_row.display_order,value_row";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_ORDER_OPTION_DEFINITION_VALUE_REF =
            ".order_option_definition_value_ref";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_SELECT_CATALOG_ATTRIBUTE_DEFINITION_OPTIO =
            "SELECT attribute_definition_option_ref FROM catalog.catalog_attribute_definition_option WHERE attr";

    public static final String CATALOG_ITEM_DEFINITION_FACTS_CLOSE_PAREN_ASSIGNMENT_ITEM_REF_DEFINITION_CODE =
            ") ORDER BY assignment.item_ref,definition.code,definition.attribute_definition_ref,";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_OPTION_ROW_DISPLAY_ORDER_ATTRIBUTE_DEFINITION_OPTION_REF =
            "option_row.display_order NULLS LAST,option_row.attribute_definition_option_ref";
    public static final String CLOSE_PAREN_ASSIGN_ITEM_REF_ALT_A_030 =
            ") ORDER BY assignment.item_ref,definition.code,definition.attribute_definition_ref,";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_SELECT_SELECTION =
            "selection.attribute_definition_option_ref NULLS LAST,option_row.display_order NULLS LAST,";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_OPTION_ROW_ATTRIBUTE_DEFINITION_OPTION_REF =
            "option_row.attribute_definition_option_ref";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_CLOSE_PAREN_CONFIG_ITEM_REF_DISPLAY_ORDER_DEFINITION =
            ") ORDER BY config.item_ref,config.display_order,definition.name,";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_DEFINITION_ALTERNATE_A =
            "definition.order_option_definition_ref,value_definition.display_order,";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_VALUE_DEFINITION_ORDER_OPTION_DEFINITION_VALUE_REF =
            "value_definition.order_option_definition_value_ref";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_CLOSE_PAREN = ")";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_CLOSE_PAREN_ALTERNATE_A = ")";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_CLOSE_PAREN_ALTERNATE_B = ")";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_CLOSE_PAREN_ALTERNATE_C = ")";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_CLOSE_PAREN_MATERIAL_MATERIAL_ITEM_REF =
            ") ORDER BY material.material_item_ref";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_CLOSE_PAREN_ORDER_BY = ") ORDER BY";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_CONFIG_ITEM_REF_DISPLAY_ORDER_DEFINITION =
            " config.item_ref,config.display_order,definition.name,";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_DEFINITION_ORDER_OPTION_DEFINITION_REF_ALTERNATE_A =
            "definition.order_option_definition_ref,";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_VALUE_DEFINITION_DISPLAY_ORDER =
            "value_definition.display_order NULLS LAST,";
    public static final String VAL_DEF_ORD_OPT_DEF_ALT_A_031 = "value_definition.order_option_definition_value_ref,";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_MATERIAL_ORDER_OPTION_DEFINITION_MATERIAL_R =
            "material.order_option_definition_material_ref";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_BRAND_REF_CODE_NAME_SELECTION_MODE =
            "brand_ref,code,name,selection_mode,version,created_at_epoch_millis,";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_UPDATE_UPDATED_AT_EPOCH_MILLIS = "updated_at_epoch_millis";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_CLOSE_PAREN_VALUES_1 = ") VALUES(?,?,?,?,?,?,1,?,?)";
    public static final String ORD_OPT_DEF_REF_DATA_032 =
            "f,order_option_definition_ref,data_node_ref,brand_ref,code,name,display_order)";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_VALUES_ALTERNATE_A = " VALUES(";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_PARAMETER_PLACEHOLDER = "?,?,?,?,?,?,?)";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_ATERIAL_REF =
            "aterial_ref,order_option_definition_value_ref,material_item_ref,";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_STOCK_TARGET_REF = "stock_target_ref,";

    public static final String CATALOG_ITEM_DEFINITION_FACTS_CLOSE_PAREN_CODE_ORDER_OPTION_DEFINITION_REF =
            ") ORDER BY code,order_option_definition_ref";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_CLOSE_PAREN_DEFINITION_CODE_ORDER_OPTION_DEFINITION_REF =
            ") ORDER BY definition.code,definition.order_option_definition_ref,";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_VALUE_ROW_DISPLAY_ORDER_ORDER_OPTION_DEFINITION_VALUE_REF =
            "value_row.display_order NULLS LAST,value_row.order_option_definition_value_ref,";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_MATERIAL_ORDER_OPTION_DEFINITION_MATERIAL_R_ALTERNATE_A =
            "material.order_option_definition_material_ref";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_CLOSE_PAREN_ORDER_BY_ALTERNATE_A = ") ORDER BY ";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_VALUE_ROW_ORDER_OPTION_DEFINITION_REF_DISPLAY_ORDER =
            "value_row.order_option_definition_ref,value_row.display_order,value_row.";
    public static final String ALT_ORD_OPT_DEF_VAL_ALT_C_033 =
            "order_option_definition_value_ref,material.order_option_definition_material_ref";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_CLOSE_PAREN_ASSIGNMENT_ITEM_REF_ATTRIBUTE_DEFINITION_REF =
            ") ORDER BY assignment.item_ref,assignment.attribute_definition_ref";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_CONDITION_AND_REF_CODE_NAME_VALUE_TYPE =
            "and_ref,code,name,value_type,version,created_at_epoch_millis,";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_UPDATE_UPDATED_AT_EPOCH_MILLIS_ALTERNATE_A =
            "updated_at_epoch_millis) ";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_VALUES_VALUES_1 = "VALUES(?,?,?,?,?,?,1,?,?)";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_CLOSE_PAREN_ALTERNATE_D = ")";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_CLOSE_PAREN_DEFINITION_CODE_ATTRIBUTE_DEFINITION_REF =
            ") ORDER BY definition.code,definition.attribute_definition_ref,";
    public static final String OPT_ROW_DISP_ORD_ATTR_ALT_A_034 =
            "option_row.display_order NULLS LAST,option_row.attribute_definition_option_ref";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_CLOSE_PAREN_ATTRIBUTE_DEFINITION_REF =
            ") ORDER BY attribute_definition_ref,display_order,attribute_definition_option_ref";
    public static final String CLOSE_PAREN_ASSIGN_ITEM_REF_ALT_A_035 =
            ") ORDER BY assignment.item_ref,assignment.attribute_definition_ref,";
    public static final String SELECT_SELECTN_ATTR_DEF_OPT_ALT_A_036 = "selection.attribute_definition_option_ref";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_CLOSE_PAREN_DEFINITION_ATTRIBUTE_DEFINITION_REF =
            ") ORDER BY definition.attribute_definition_ref,";
    public static final String OPT_ROW_DISP_ORD_ATTR_ALT_B_037 =
            "option_row.display_order,option_row.attribute_definition_option_ref";
    public static final String CATALOG_ITEM_DEFINITION_FACTS_CLOSE_PAREN_DEFINITION_ORDER_OPTION_DEFINITION_REF =
            ") ORDER BY definition.order_option_definition_ref,";
    public static final String VAL_ROW_DISP_ORD_OPT_ALT_A_038 =
            "value_row.display_order,value_row.order_option_definition_value_ref";
    public static final String SELECT_ASSIGN_ITEM_REF_ASSIGN_039 =
            """
    SELECT assignment.item_ref,assignment.item_attribute_assignment_ref,definition.attribute_definition_ref,""";
    public static final String DEF_CODE_DEF_NAME_DEF_040 =
            """
    definition.code,definition.name,definition.value_type,assignment.t\
    ext_value,selection.attribute_definition_option_ref,option_row.nam\
    e\s""";
    public static final String JOIN_CAT_ATTR_DEF_ON_041 =
            """
    JOIN catalog.catalog_attribute_definition definition ON definition\
    .attribute_definition_ref=assignment.attribute_definition_ref\s""";
    public static final String LEFT_JOIN_CAT_ITEM_ATTR_042 =
            """
    LEFT JOIN catalog.catalog_item_attribute_selection selection ON se\
    lection.item_attribute_assignment_ref=assignment.item_attribute_as\
    signment_ref\s""";
    public static final String LEFT_JOIN_CAT_ATTR_DEF_043 =
            """
    LEFT JOIN catalog.catalog_attribute_definition_option option_row O\
    N option_row.attribute_definition_ref=definition.attribute_definit\
    ion_ref AND option_row.""";
    public static final String SELECT_ASSIGN_ITEM_REF_ASSIGN_044 =
            """
    SELECT assignment.item_ref,assignment.item_attribute_assignment_re\
    f,definition.attribute_definition_ref,definition.code,definition.n\
    ame,definition.value_type,definition.version,assignment.""";
    public static final String VAL_DEF_ORD_OPT_DEF_045 =
            """
    value_definition.order_option_definition_value_ref,value_definition.name,value_definition.display_order,""";
    public static final String JOIN_CAT_ORD_OPT_DEF_046 =
            """
    JOIN catalog.catalog_order_option_definition definition ON definit\
    ion.order_option_definition_ref=config.order_option_definition_ref\
    \s""";
    public static final String LEFT_JOIN_CAT_ITEM_ORD_047 =
            """
    LEFT JOIN catalog.catalog_item_order_option_value_override overrid\
    e ON override.item_order_option_config_ref=config.item_order_optio\
    n_config_ref\s""";
    public static final String AND_OVERRIDE_ORD_OPT_DEF_048 =
            """
    AND override.order_option_definition_value_ref=value_definition.order_option_definition_value_ref\s""";
    public static final String SELECT_ATTR_DEF_REF_ITEM_049 =
            """
    SELECT attribute_definition_ref,item_attribute_assignment_ref FROM\
     catalog.catalog_item_attribute_assignment WHERE item_ref=?""";
    public static final String SELECT_ORD_OPT_DEF_REF_050 =
            """
    SELECT order_option_definition_ref,item_order_option_config_ref FR\
    OM catalog.catalog_item_order_option_config WHERE item_ref=?""";
    public static final String JOIN_CAT_ORD_OPT_DEF_051 =
            """
    JOIN catalog.catalog_order_option_definition_value value_row ON va\
    lue_row.order_option_definition_ref=config.order_option_definition\
    _ref\s""";
    public static final String JOIN_CAT_ORD_OPT_DEF_052 =
            """
    JOIN catalog.catalog_order_option_definition_material material ON \
    material.order_option_definition_value_ref=value_row.order_option_\
    definition_value_ref\s""";
    public static final String CONSUM_UNIT_REF_CONSUM_UNIT_053 =
            """
    consumption_unit_ref,consumption_unit_code,consumption_unit_name,c\
    onsumption_unit_dimension,consumption_unit_precision) VALUES(?,?,?\
    ,?,?,?,?,?,?)""";
    public static final String SELECT_ORD_OPT_DEF_REF_054 =
            """
    SELECT order_option_definition_ref,code,name,selection_mode,versio\
    n FROM catalog.catalog_order_option_definition\s""";
    public static final String CAT_ORD_OPT_DEF_MAT_055 =
            """
    catalog_order_option_definition_material material ON material.orde\
    r_option_definition_value_ref=value_row.order_option_definition_va\
    lue_ref LEFT JOIN catalog.catalog_item\s""";
    public static final String JOIN_CAT_ATTR_DEF_ON_ALT_A_056 =
            """
    JOIN catalog.catalog_attribute_definition definition ON definition\
    .attribute_definition_ref=assignment.attribute_definition_ref\s""";
    public static final String INSERT_INTO_CAT_ATTR_DEF_057 =
            """
    INSERT INTO catalog.catalog_attribute_definition_option(attribute_\
    definition_option_ref,attribute_definition_ref,name,display_order)\
     VALUES(?,?,?,?)""";
    public static final String INSERT_INTO_CAT_ITEM_ATTR_058 =
            """
    INSERT INTO catalog.catalog_item_attribute_assignment(item_attribu\
    te_assignment_ref,item_ref,attribute_definition_ref,text_value) VA\
    LUES(?,?,?,?)""";
    public static final String INSERT_INTO_CAT_ITEM_ATTR_059 =
            """
    INSERT INTO catalog.catalog_item_attribute_selection(item_attribut\
    e_assignment_ref,attribute_definition_option_ref) VALUES(?,?)""";
    public static final String OPT_ROW_ATTR_DEF_OPT_060 =
            """
    option_row.attribute_definition_option_ref FROM catalog.catalog_attribute_definition definition LEFT JOIN\s""";
    public static final String CAT_ATTR_DEF_OPT_ROW_061 =
            """
    catalog.catalog_attribute_definition_option option_row ON option_r\
    ow.attribute_definition_ref=definition.attribute_definition_ref WH\
    ERE definition.data_node_ref=? AND\s""";
    public static final String SELECT_ATTR_DEF_OPT_REF_062 =
            """
    SELECT attribute_definition_option_ref FROM catalog.catalog_attrib\
    ute_definition_option WHERE attribute_definition_ref=? ORDER BY di\
    splay_order,attribute_definition_option_ref""";
}
