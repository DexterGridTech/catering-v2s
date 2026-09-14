package com.catering.v2s.catalog.application.persistence;

/** SQL text fragments owned by CatalogItemMediaFacts; B3 relocates text only and does not change execution. */
public final class CatalogItemMediaFactsSql {
    public static final String PARAMETER_PLACEHOLDER = "?";
    public static final String PLACEHOLDER_SEPARATOR = ",";
    public static final String CATALOG_ITEM_MEDIA_FACTS_SELECT_CATALOG_ITEM_IMAGE_ITEM_REF_ASSET_REF = "SELECT item_ref,asset_ref FROM catalog.catalog_item_image WHERE item_ref IN (";
    public static final String CATALOG_ITEM_MEDIA_FACTS_DELETE_CATALOG_ITEM_IMAGE_ITEM_REF = "DELETE FROM catalog.catalog_item_image WHERE item_ref=?";
    public static final String CATALOG_ITEM_MEDIA_FACTS_INSERT_INTO_CATALOG_ITEM_IMAGE_ITEM_REF_ASSET_REF_DISPLAY_ORDER = "INSERT INTO catalog.catalog_item_image(item_ref,asset_ref,display_order) VALUES(?,?,?)";
    public static final String CATALOG_ITEM_MEDIA_FACTS_INSERT_INTO_CATALOG_ITEM_IMAGE_ITEM_REF_ASSET_REF_DISPLAY_ORDER_ALTERNATE_A = "INSERT INTO catalog.catalog_item_image(item_ref,asset_ref,display_order) VALUES(?,?,?)";
    public static final String CATALOG_ITEM_MEDIA_FACTS_CONDITION_ITEM_DATA_NODE_REF_BRAND_REF = " AND item.data_node_ref=? AND item.brand_ref=?";
    public static final String CATALOG_ITEM_MEDIA_FACTS_SELECT_CATALOG_ITEM_IMAGE_ITEM = "SELECT EXISTS (SELECT 1 FROM catalog.catalog_item_image image JOIN catalog.catalog_item item ON ";
    public static final String CATALOG_ITEM_MEDIA_FACTS_CONTINUATION_ITEM_ITEM_REF_IMAGE_ASSET_REF = "item.item_ref=image.item_ref WHERE image.asset_ref=? AND item.status <> 'VOIDED'";
    public static final String CATALOG_ITEM_MEDIA_FACTS_CONDITION_ITEM_DATA_NODE_REF_BRAND_REF_ALTERNATE_A = " AND item.data_node_ref=? AND item.brand_ref=?";
    public static final String CATALOG_ITEM_MEDIA_FACTS_SELECT_CATALOG_ITEM_IMAGE_ASSET_REF_ITEM = "SELECT DISTINCT image.asset_ref FROM catalog.catalog_item_image image JOIN catalog.catalog_item item ";
    public static final String CATALOG_ITEM_MEDIA_FACTS_JOIN_CONDITION_ITEM_ITEM_REF_IMAGE_ASSET_REF = "ON item.item_ref=image.item_ref WHERE image.asset_ref IN (";
    public static final String CATALOG_ITEM_MEDIA_FACTS_CLOSE_PAREN_ITEM_REF_DISPLAY_ORDER_ASSET_REF = ") ORDER BY item_ref,display_order,asset_ref";
    public static final String CATALOG_ITEM_MEDIA_FACTS_CLOSE_PAREN = ")";
    public static final String CATALOG_ITEM_MEDIA_FACTS_CLOSE_PAREN_ITEM_STATUS_VOIDED = ") AND item.status <> 'VOIDED'";
}
