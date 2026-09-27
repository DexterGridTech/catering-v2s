package com.catering.v2s.catalog.application.persistence;

/** SQL text fragments owned by CatalogCompositeFacts; B3 relocates text only and does not change execution. */
public final class CatalogCompositeFactsSql {
    public static final String PARAMETER_PLACEHOLDER = "?";
    public static final String PLACEHOLDER_SEPARATOR = ",";
    public static final String CATALOG_COMPOSITE_FACTS_SELECT = "SELECT ";

    public static final String CATALOG_COMPOSITE_FACTS_FROM_CLAUSE_CATALOG_COMPOSITE_GROUP_GROUP_ROW =
            "FROM catalog.catalog_composite_group group_row LEFT ";
    public static final String CATALOG_COMPOSITE_FACTS_JOIN = "JOIN ";
    public static final String CATALOG_COMPOSITE_FACTS_CATALOG_COMPOSITE_COMPONENT_COMPONENT =
            "catalog.catalog_composite_component component ON ";
    public static final String CATALOG_COMPOSITE_FACTS_CATALOG_ITEM_COMPONENT_COMPOSITE_GROUP_REF_GROUP_ROW =
            "component.composite_group_ref=group_row.composite_group_ref LEFT JOIN catalog.catalog_item ";
    public static final String CATALOG_COMPOSITE_FACTS_ITEM = "item ";
    public static final String JOIN_CONDITION_CAT_SKU_ITEM_001 =
            "ON item.item_ref=component.component_item_ref LEFT JOIN catalog.catalog_sku sku ON ";
    public static final String CATALOG_COMPOSITE_FACTS_SKU_ITEM_REF_COMPONENT_COMPONENT_ITEM_REF =
            "sku.item_ref=component.component_item_ref AND sku.product_sku_ref=component.product_sku_ref ";
    public static final String CATALOG_COMPOSITE_FACTS_WHERE_GROUP_ROW_ITEM_REF = "WHERE group_row.item_ref IN (";
    public static final String CATALOG_COMPOSITE_FACTS_UPDATE_CATALOG_COMPOSITE_GROUP_DISPLAY_ORDER_ITEM_REF =
            "UPDATE catalog.catalog_composite_group SET display_order=display_order+1000000 WHERE item_ref=?";
    public static final String CATALOG_COMPOSITE_FACTS_INSERT_INTO = "INSERT INTO ";

    public static final String UPDATE_CAT_COMP_GRP_UPDATE_002 = "UPDATE catalog.catalog_composite_group SET ";
    public static final String CATALOG_COMPOSITE_FACTS_GROUP_NAME_SELECTION_RULE_MIN_SELECTIONS_MAX_SELECTIONS =
            "group_name=?,selection_rule=?,min_selections=?,max_selections=?,display_order=? ";
    public static final String CATALOG_COMPOSITE_FACTS_WHERE = "WHERE ";
    public static final String CATALOG_COMPOSITE_FACTS_COMPOSITE_GROUP_REF = "composite_group_ref=?";
    public static final String CATALOG_COMPOSITE_FACTS_DELETE_CATALOG_COMPOSITE_COMPONENT_COMPOSITE_GROUP_REF =
            "DELETE FROM catalog.catalog_composite_component WHERE composite_group_ref=?";
    public static final String CATALOG_COMPOSITE_FACTS_DELETE_CATALOG_COMPOSITE_GROUP_COMPOSITE_GROUP_REF =
            "DELETE FROM catalog.catalog_composite_group WHERE composite_group_ref=?";
    public static final String CATALOG_COMPOSITE_FACTS_INSERT_INTO_ALTERNATE_A = "INSERT INTO ";

    public static final String CATALOG_COMPOSITE_FACTS_INSERT_INTO_ALTERNATE_B = "INSERT INTO ";

    public static final String CATALOG_COMPOSITE_FACTS_VALUES = "VALUES(?,?,?,?,?,?,?,?,?,?)";
    public static final String CATALOG_COMPOSITE_FACTS_UPDATE_CATALOG_COMPOSITE_COMPONENT_DISPLAY_ORDER =
            "UPDATE catalog.catalog_composite_component SET display_order=display_order+1000000 WHERE ";
    public static final String CATALOG_COMPOSITE_FACTS_COMPOSITE_GROUP_REF_ALTERNATE_A = "composite_group_ref=?";
    public static final String CATALOG_COMPOSITE_FACTS_INSERT_INTO_ALTERNATE_C = "INSERT INTO ";

    public static final String CATALOG_COMPOSITE_FACTS_JOIN_CONDITION_ONEN = "onen";

    public static final String CATALOG_COMPOSITE_FACTS_CLOSE_PAREN = ") ";
    public static final String CATALOG_COMPOSITE_FACTS_VALUES_ALTERNATE_A = "VALUES(?,?,?,?,?,?,?,?,?,?)";
    public static final String UPDATE_CAT_COMP_COMPNT_UPDATE_003 = "UPDATE catalog.catalog_composite_component SET ";
    public static final String CATALOG_COMPOSITE_FACTS_COMPONENT_ITEM_REF_PRODUCT_SKU_REF_QUANTITY_UNIT =
            "component_item_ref=?,product_sku_ref=?,quantity=?,unit=?,is_default=?,extra_price=?,";

    public static final String CATALOG_COMPOSITE_FACTS_DELETE_CATALOG_COMPOSITE_COMPONENT_COMPOSITE_COMPONENT_REF =
            "DELETE FROM catalog.catalog_composite_component WHERE composite_component_ref=?";
    public static final String CATALOG_COMPOSITE_FACTS_CLOSE_PAREN_ORDER_BY = ") ORDER BY ";
    public static final String CATALOG_COMPOSITE_FACTS_GROUP_ROW_ITEM_REF_DISPLAY_ORDER_GROUP_CODE =
            "group_row.item_ref,group_row.display_order,group_row.group_code,component.display_order,";
    public static final String CATALOG_COMPOSITE_FACTS_COMPONENT_COMPOSITE_COMPONENT_REF =
            "component.composite_component_ref";
    public static final String CATALOG_COMPOSITE_FACTS_SELECT_ALTERNATE_A = "SELECT ";

    public static final String CATALOG_COMPOSITE_FACTS_SELECT_ALTERNATE_B = "SELECT ";

    public static final String CATALOG_COMPOSITE_FACTS_CATALOG_COMPOSITE_COMPONENT_ALTERNATE_B =
            "status,display_order FROM catalog.catalog_composite_component WHERE composite_group_ref=?";
    public static final String GRP_ROW_ITEM_REF_GRP_004 =
            """
    group_row.item_ref,group_row.composite_group_ref,group_row.group_c\
    ode,group_row.group_name,group_row.selection_rule,group_row.min_se\
    lections,group_row.max_selections,group_row.display_order,componen\
    t.composite_component_ref,component.component_item_ref,component.p\
    roduct_sku_ref,component""";
    public static final String QUANTITY_COMPNT_UNIT_COMPNT_IS_005 =
            """
    .quantity,component.unit,component.is_default,component.extra_pric\
    e,component.status,component.display_order,item.code,item.name,sku\
    .sku_code,sku.sku_name\s""";
    public static final String CAT_COMP_GRP_COMP_GRP_006 =
            """
    catalog.catalog_composite_group(composite_group_ref,item_ref,group\
    _code,group_name,selection_rule,min_selections,max_selections,disp\
    lay_order) VALUES(?,?,?,?,?,?,?,?)""";
    public static final String CAT_COMP_GRP_COMP_GRP_ALT_A_007 =
            """
    catalog.catalog_composite_group(composite_group_ref,item_ref,group\
    _code,group_name,selection_rule,min_selections,max_selections,disp\
    lay_order) VALUES(?,?,?,?,?,?,?,?)""";
    public static final String CAT_COMP_COMPNT_COMP_COMPNT_008 =
            """
    catalog.catalog_composite_component(composite_component_ref,compos\
    ite_group_ref,component_item_ref,product_sku_ref,quantity,unit,is_\
    default,extra_price,status,display_order)\s""";
    public static final String COMP_GRP_REF_GRP_CODE_009 =
            """
    composite_group_ref,group_code,group_name,selection_rule,min_selec\
    tions,max_selections,display_order FROM catalog.catalog_composite_\
    group WHERE item_ref=?""";
    public static final String COMP_COMPNT_REF_COMPNT_ITEM_010 =
            """
    composite_component_ref,component_item_ref,product_sku_ref,quantity,unit,is_default,extra_price,""";
    public static final String CAT_COMP_COMPNT_COMP_COMPNT_ALT_A_011 =
            """
    catalog.catalog_composite_component(composite_component_ref,compos\
    ite_group_ref,component_item_ref,product_sku_ref,quantity,unit,is_\
    default,extra_price,status,display_order""";
    public static final String STATUS_DISP_ORD_WHERE_COMP_012 =
            """
    status=?,display_order=? WHERE composite_component_ref=?""";
}
