package com.catering.v2s.catalog.application.persistence;

/** SQL text fragments owned by CatalogSkuMediaFacts; B3 relocates text only and does not change execution. */
public final class CatalogSkuMediaFactsSql {
    public static final String PARAMETER_PLACEHOLDER = "?";
    public static final String PLACEHOLDER_SEPARATOR = ",";
    public static final String CATALOG_SKU_MEDIA_FACTS_DELETE_CATALOG_SKU_MEDIA_PRODUCT_SKU_REF = "DELETE FROM catalog.catalog_sku_media WHERE product_sku_ref IN (";
    public static final String CATALOG_SKU_MEDIA_FACTS_INSERT_INTO_CATALOG_SKU_MEDIA_PRODUCT_SKU_REF_ASSET_REF_DISPLAY_ORDER = "INSERT INTO catalog.catalog_sku_media(product_sku_ref,asset_ref,display_order) VALUES(?,?,?)";
    public static final String CATALOG_SKU_MEDIA_FACTS_INSERT_INTO_CATALOG_SKU_MEDIA_PRODUCT_SKU_REF_ASSET_REF_DISPLAY_ORDER_ALTERNATE_A = "INSERT INTO catalog.catalog_sku_media(product_sku_ref,asset_ref,display_order) VALUES(?,?,?)";
    public static final String CATALOG_SKU_MEDIA_FACTS_SELECT_CATALOG_SKU_MEDIA_PRODUCT_SKU_REF_ASSET_REF = "SELECT product_sku_ref,asset_ref FROM catalog.catalog_sku_media WHERE product_sku_ref IN (";
    public static final String CATALOG_SKU_MEDIA_FACTS_CONDITION_ITEM_DATA_NODE_REF_BRAND_REF = " AND item.data_node_ref=? AND item.brand_ref=?";
    public static final String CATALOG_SKU_MEDIA_FACTS_SELECT_CATALOG_SKU_MEDIA_SKU = "SELECT EXISTS (SELECT 1 FROM catalog.catalog_sku_media media JOIN catalog.catalog_sku sku ON ";
    public static final String CATALOG_SKU_MEDIA_FACTS_CONTINUATION_CATALOG_ITEM_SKU_PRODUCT_SKU_REF_MEDIA_ITEM = "sku.product_sku_ref=media.product_sku_ref JOIN catalog.catalog_item item ON ";
    public static final String CATALOG_SKU_MEDIA_FACTS_CONTINUATION_ITEM_ITEM_REF_SKU_MEDIA = "item.item_ref=sku.item_ref WHERE media.asset_ref=? AND item.status <> 'VOIDED'";
    public static final String CATALOG_SKU_MEDIA_FACTS_CONDITION_ITEM_DATA_NODE_REF_BRAND_REF_ALTERNATE_A = " AND item.data_node_ref=? AND item.brand_ref=?";
    public static final String CATALOG_SKU_MEDIA_FACTS_SELECT_CATALOG_SKU_MEDIA_ASSET_REF_SKU = "SELECT DISTINCT media.asset_ref FROM catalog.catalog_sku_media media JOIN catalog.catalog_sku sku ON ";
    public static final String CATALOG_SKU_MEDIA_FACTS_CONTINUATION_CATALOG_ITEM_SKU_PRODUCT_SKU_REF_MEDIA_ITEM_ALTERNATE_A = "sku.product_sku_ref=media.product_sku_ref JOIN catalog.catalog_item item ON ";
    public static final String CATALOG_SKU_MEDIA_FACTS_CONTINUATION_ITEM_ITEM_REF_SKU_MEDIA_ALTERNATE_A = "item.item_ref=sku.item_ref WHERE media.asset_ref IN (";
    public static final String CATALOG_SKU_MEDIA_FACTS_CLOSE_PAREN = ")";
    public static final String CATALOG_SKU_MEDIA_FACTS_CLOSE_PAREN_PRODUCT_SKU_REF_DISPLAY_ORDER_ASSET_REF = ") ORDER BY product_sku_ref,display_order,asset_ref";
    public static final String CATALOG_SKU_MEDIA_FACTS_CLOSE_PAREN_ALTERNATE_A = ")";
    public static final String CATALOG_SKU_MEDIA_FACTS_CLOSE_PAREN_ITEM_STATUS_VOIDED = ") AND item.status <> 'VOIDED'";
}
