package com.catering.v2s.catalog.application.persistence;

/** SQL text fragments owned by CatalogIdentifierFacts; B3 relocates text only and does not change execution. */
public final class CatalogIdentifierFactsSql {
    public static final String PARAMETER_PLACEHOLDER = "?";
    public static final String PLACEHOLDER_SEPARATOR = ",";
    public static final String CATALOG_IDENTIFIER_FACTS_SELECT_IDENTIFIER_REF_ITEM_REF_PRODUCT_SKU_REF_IDENTIFIER_TYPE =
            "SELECT identifier_ref,item_ref,product_sku_ref,identifier_type,identifier_value,";
    public static final String CATALOG_IDENTIFIER_FACTS_PRODUCT_IDENTIFIER_NORMALIZED_VALUE_DISPLAY_ORDER_ITEM_REF =
            "normalized_value,display_order FROM catalog.product_identifier WHERE item_ref IN (";
    public static final String CATALOG_IDENTIFIER_FACTS_DELETE_PRODUCT_IDENTIFIER_ITEM_REF =
            "DELETE FROM catalog.product_identifier WHERE item_ref=?";
    public static final String CATALOG_IDENTIFIER_FACTS_INSERT_INTO_PRODUCT_IDENTIFIER =
            "INSERT INTO catalog.product_identifier(identifier_ref,data_node_ref,brand_ref,item_ref,";
    public static final String CATALOG_IDENTIFIER_FACTS_PRODUCT_SKU_REF =
            "product_sku_ref,identifier_type,identifier_value,normalized_value,display_order) ";
    public static final String CATALOG_IDENTIFIER_FACTS_VALUES = "VALUES(?,?,?,?,?,?,?,?,?)";
    public static final String CATALOG_IDENTIFIER_FACTS_SELECT_CATALOG_SKU_PRODUCT_SKU_REF_ITEM_REF =
            "SELECT product_sku_ref FROM catalog.catalog_sku WHERE item_ref=? AND product_sku_ref IN (";
    public static final String CLOSE_PAREN_ITEM_REF_PRODUCT_001 =
            ") ORDER BY item_ref,product_sku_ref NULLS FIRST,display_order,identifier_ref";
    public static final String CATALOG_IDENTIFIER_FACTS_CLOSE_PAREN = ")";
}
