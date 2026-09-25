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
    public static final String
            CATALOG_COMPOSITE_FACTS_JOIN_CONDITION_CATALOG_SKU_ITEM_ITEM_REF_COMPONENT_COMPONENT_ITEM_REF =
                    "ON item.item_ref=component.component_item_ref LEFT JOIN catalog.catalog_sku sku ON ";
    public static final String CATALOG_COMPOSITE_FACTS_SKU_ITEM_REF_COMPONENT_COMPONENT_ITEM_REF =
            "sku.item_ref=component.component_item_ref AND sku.product_sku_ref=component.product_sku_ref ";
    public static final String CATALOG_COMPOSITE_FACTS_WHERE_GROUP_ROW_ITEM_REF = "WHERE group_row.item_ref IN (";
    public static final String CATALOG_COMPOSITE_FACTS_UPDATE_CATALOG_COMPOSITE_GROUP_DISPLAY_ORDER_ITEM_REF =
            "UPDATE catalog.catalog_composite_group SET display_order=display_order+1000000 WHERE item_ref=?";
    public static final String CATALOG_COMPOSITE_FACTS_INSERT_INTO = "INSERT INTO ";

    public static final String CATALOG_COMPOSITE_FACTS_UPDATE_CATALOG_COMPOSITE_GROUP_UPDATE_CATALOG_CATALOG_COMPO =
            "UPDATE catalog.catalog_composite_group SET ";
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
    public static final String CATALOG_COMPOSITE_FACTS_UPDATE_CATALOG_COMPOSITE_COMPONENT_UPDATE_CATALOG_CATALOG_COMPO =
            "UPDATE catalog.catalog_composite_component SET ";
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
    public static final String
            CATALOG_COMPOSITE_FACTS_GROUP_ROW_ITEM_REF_GROUP_ROW_COMPOSITE_GROUP_REF_GROUP_ROW_GROUP_CODE_GROUP_ROW_GROUP_NAME_GROUP_ROW_SELECTION_RULE_COMPONENT_ITEM_REF_COMPONENT_PRODUCT_SKU_REF_COMPONENT =
                    """
    group_row.item_ref,group_row.composite_group_ref,group_row.group_code,group_row.group_name,group_row.selection_rule,group_row.min_selections,group_row.max_selections,group_row.display_order,component.composite_component_ref,component.component_item_ref,component.product_sku_ref,component""";
    public static final String
            CATALOG_COMPOSITE_FACTS_QUANTITY_COMPONENT_UNIT_COMPONENT_IS_DEFAULT_COMPONENT_EXTRA_PRICE_COMPONENT_STATUS_COMPONENT_SKU_SKU_CODE_SKU_SKU_NAME =
                    """
    .quantity,component.unit,component.is_default,component.extra_price,component.status,component.display_order,item.code,item.name,sku.sku_code,sku.sku_name\s""";
    public static final String
            CATALOG_COMPOSITE_FACTS_CATALOG_CATALOG_COMPOSITE_GROUP_COMPOSITE_GROUP_REF_ITEM_REF_GROUP_CODE_GROUP_NAME_SELECTION_RULE_MIN_SELECTIONS_MAX_SELECTIONS_DISPLAY_ORDER_MIN_SELECTIONS_MAX_SELECTIONS_DISPLAY_ORDER_VALUES =
                    """
    catalog.catalog_composite_group(composite_group_ref,item_ref,group_code,group_name,selection_rule,min_selections,max_selections,display_order) VALUES(?,?,?,?,?,?,?,?)""";
    public static final String
            CATALOG_COMPOSITE_FACTS_CATALOG_CATALOG_COMPOSITE_GROUP_COMPOSITE_GROUP_REF_ITEM_REF_GROUP_CODE_GROUP_NAME_SELECTION_RULE_MIN_SELECTIONS_MAX_SELECTIONS_DISPLAY_ORDER_MIN_SELECTIONS_MAX_SELECTIONS_DISPLAY_ORDER_VALUES_ALTERNATE_A =
                    """
    catalog.catalog_composite_group(composite_group_ref,item_ref,group_code,group_name,selection_rule,min_selections,max_selections,display_order) VALUES(?,?,?,?,?,?,?,?)""";
    public static final String
            CATALOG_COMPOSITE_FACTS_CATALOG_CATALOG_COMPOSITE_COMPONENT_COMPOSITE_COMPONENT_REF_COMPOSITE_GROUP_REF_COMPONENT_ITEM_REF_PRODUCT_SKU_REF_QUANTITY_UNIT_IS_DEFAULT_EXTRA_PRICE_IS_DEFAULT_EXTRA_PRICE_STATUS_DISPLAY_ORDER =
                    """
    catalog.catalog_composite_component(composite_component_ref,composite_group_ref,component_item_ref,product_sku_ref,quantity,unit,is_default,extra_price,status,display_order)\s""";
    public static final String
            CATALOG_COMPOSITE_FACTS_COMPOSITE_GROUP_REF_GROUP_CODE_GROUP_NAME_SELECTION_RULE_MIN_SELECTIONS_MAX_SELECTIONS_DISPLAY_ORDER_FROM_CATALOG_CATALOG_COMPOSITE_GROUP_CATALOG_CATALOG_COMPOSITE_GROUP_WHERE_ITEM_REF =
                    """
    composite_group_ref,group_code,group_name,selection_rule,min_selections,max_selections,display_order FROM catalog.catalog_composite_group WHERE item_ref=?""";
    public static final String
            CATALOG_COMPOSITE_FACTS_COMPOSITE_COMPONENT_REF_COMPONENT_ITEM_REF_PRODUCT_SKU_REF_QUANTITY_UNIT_IS_DEFAULT_EXTRA_PRICE_QUANTITY_UNIT_IS_DEFAULT_EXTRA_PRICE =
                    """
    composite_component_ref,component_item_ref,product_sku_ref,quantity,unit,is_default,extra_price,""";
    public static final String
            CATALOG_COMPOSITE_FACTS_CATALOG_CATALOG_COMPOSITE_COMPONENT_COMPOSITE_COMPONENT_REF_COMPOSITE_GROUP_REF_COMPONENT_ITEM_REF_PRODUCT_SKU_REF_QUANTITY_UNIT_IS_DEFAULT_EXTRA_PRICE_IS_DEFAULT_EXTRA_PRICE_STATUS_DISPLAY_ORDER_ALTERNATE_A =
                    """
    catalog.catalog_composite_component(composite_component_ref,composite_group_ref,component_item_ref,product_sku_ref,quantity,unit,is_default,extra_price,status,display_order""";
    public static final String
            CATALOG_COMPOSITE_FACTS_STATUS_DISPLAY_ORDER_WHERE_COMPOSITE_COMPONENT_REF_STATUS_DISPLAY_ORDER_WHERE_COMPOSITE_COMPONENT_REF =
                    """
    status=?,display_order=? WHERE composite_component_ref=?""";
}
