package com.catering.v2s.catalog.application.persistence;

/** SQL text fragments owned by CatalogItemCategoryFacts; B3 relocates text only and does not change execution. */
public final class CatalogItemCategoryFactsSql {
    public static final String PARAMETER_PLACEHOLDER = "?";
    public static final String PLACEHOLDER_SEPARATOR = ",";
    public static final String CATALOG_ITEM_CATEGORY_FACTS_SELECT_CATALOG_ITEM_CATEGORY_ITEM_REF_CATEGORY_REF =
            "SELECT item_ref,category_ref FROM catalog.catalog_item_category WHERE item_ref IN (";
    public static final String CATALOG_ITEM_CATEGORY_FACTS_SELECT_RELATION_ITEM_REF_CATEGORY_REF_CATEGORY =
            "SELECT relation.item_ref,relation.category_ref,category.name ";
    public static final String CATALOG_ITEM_CATEGORY_FACTS_FROM_CLAUSE_CATALOG_ITEM_CATEGORY_RELATION =
            "FROM catalog.catalog_item_category relation ";
    public static final String CATALOG_ITEM_CATEGORY_FACTS_JOIN_CATALOG_CATEGORY_CATEGORY_CATEGORY_REF_RELATION =
            "JOIN catalog.catalog_category category ON category.category_ref=relation.category_ref ";
    public static final String CATALOG_ITEM_CATEGORY_FACTS_CONDITION_CATEGORY_DATA_NODE_REF_BRAND_REF =
            "AND category.data_node_ref=? AND category.brand_ref=? ";
    public static final String CATALOG_ITEM_CATEGORY_FACTS_CONDITION_CATEGORY_STATUS_VOIDED_RELATION =
            "AND category.status <> 'VOIDED' WHERE relation.item_ref IN (";
    public static final String CATALOG_ITEM_CATEGORY_FACTS_DELETE_CATALOG_ITEM_CATEGORY_ITEM_REF =
            "DELETE FROM catalog.catalog_item_category WHERE item_ref=?";
    public static final String CATALOG_ITEM_CATEGORY_FACTS_INSERT_INTO_CATALOG_ITEM_CATEGORY_ITEM_REF_CATEGORY_REF =
            "INSERT INTO catalog.catalog_item_category(item_ref,category_ref) VALUES(?,?)";
    public static final String INSERT_INTO_CAT_ITEM_CATG_ALT_A_001 =
            "INSERT INTO catalog.catalog_item_category(item_ref,category_ref) VALUES(?,?)";
    public static final String CATALOG_ITEM_CATEGORY_FACTS_CLOSE_PAREN_ITEM_REF_CATEGORY_REF =
            ") ORDER BY item_ref,category_ref";
    public static final String CATALOG_ITEM_CATEGORY_FACTS_CLOSE_PAREN_RELATION_ITEM_REF_CATEGORY_REF =
            ") ORDER BY relation.item_ref,relation.category_ref";
}
