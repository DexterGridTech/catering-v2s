package com.catering.v2s.catalog.application.persistence;

/** SQL text fragments owned by CatalogSkuVariantAxisFacts; B3 relocates text only and does not change execution. */
public final class CatalogSkuVariantAxisFactsSql {
    public static final String PARAMETER_PLACEHOLDER = "?";
    public static final String PLACEHOLDER_SEPARATOR = ",";
    public static final String CATALOG_SKU_VARIANT_AXIS_FACTS_SELECT_CATALOG_SKU_VARIANT_AXIS =
            "SELECT attribute_ref,sku_variant_axis_ref,display_order FROM catalog.catalog_sku_variant_axis";
    public static final String CATALOG_SKU_VARIANT_AXIS_FACTS_WHERE_ITEM_REF = " WHERE item_ref=?";
    public static final String CATALOG_SKU_VARIANT_AXIS_FACTS_UPDATE_CATALOG_SKU_VARIANT_AXIS_DISPLAY_ORDER_ITEM_REF =
            "UPDATE catalog.catalog_sku_variant_axis SET display_order=display_order+1000000 WHERE item_ref=?";
    public static final String DELETE_CAT_SKU_VARIANT_AXIS_001 =
            "DELETE FROM catalog.catalog_sku_variant_axis_value WHERE sku_variant_axis_ref IN (";
    public static final String CATALOG_SKU_VARIANT_AXIS_FACTS_DELETE_CATALOG_SKU_VARIANT_AXIS_SKU_VARIANT_AXIS_REF =
            "DELETE FROM catalog.catalog_sku_variant_axis WHERE sku_variant_axis_ref IN (";
    public static final String CATALOG_SKU_VARIANT_AXIS_FACTS_INSERT_INTO_CATALOG_SKU_VARIANT_AXIS =
            "INSERT INTO catalog.catalog_sku_variant_axis(sku_variant_axis_ref,item_ref,attribute_ref,";
    public static final String CATALOG_SKU_VARIANT_AXIS_FACTS_DISPLAY_ORDER = "display_order) VALUES(?,?,?,?)";
    public static final String UPDATE_CAT_SKU_VARIANT_AXIS_002 =
            "UPDATE catalog.catalog_sku_variant_axis SET display_order=? WHERE sku_variant_axis_ref=?";
    public static final String CATALOG_SKU_VARIANT_AXIS_FACTS_INSERT_INTO_CATALOG_SKU_VARIANT_AXIS_VALUE =
            "INSERT INTO catalog.catalog_sku_variant_axis_value(sku_variant_axis_ref,value_ref,";
    public static final String CATALOG_SKU_VARIANT_AXIS_FACTS_DISPLAY_ORDER_ALTERNATE_A =
            "display_order) VALUES(?,?,?)";
    public static final String CATALOG_SKU_VARIANT_AXIS_FACTS_INSERT_INTO = "INSERT INTO ";
    public static final String CATALOG_SKU_VARIANT_AXIS_FACTS_CATALOG_SKU_VARIANT_AXIS =
            "catalog.catalog_sku_variant_axis(sku_variant_axis_ref,item_ref,attribute_ref,display_order) ";
    public static final String CATALOG_SKU_VARIANT_AXIS_FACTS_VALUES = "VALUES(?,?,?,?)";
    public static final String INSERT_INTO_CAT_SKU_VARIANT_ALT_A_003 =
            "INSERT INTO catalog.catalog_sku_variant_axis_value(sku_variant_axis_ref,value_ref,display_order) ";
    public static final String CATALOG_SKU_VARIANT_AXIS_FACTS_VALUES_ALTERNATE_A = "VALUES(?,?,?)";
    public static final String CATALOG_SKU_VARIANT_AXIS_FACTS_SELECT_AXIS_ATTRIBUTE_REF_VALUE_VALUE_REF =
            "SELECT axis.attribute_ref, value.value_ref, axis.sku_variant_axis_ref, axis.display_order FROM ";
    public static final String CATALOG_SKU_VARIANT_AXIS_FACTS_CATALOG_SKU_VARIANT_AXIS_AXIS =
            "catalog.catalog_sku_variant_axis axis LEFT JOIN ";
    public static final String CATALOG_SKU_VARIANT_AXIS_FACTS_CATALOG_SKU_VARIANT_AXIS_VALUE_VALUE =
            "catalog.catalog_sku_variant_axis_value value ON ";
    public static final String CATALOG_SKU_VARIANT_AXIS_FACTS_VALUE_SKU_VARIANT_AXIS_REF_AXIS_ITEM_REF =
            "value.sku_variant_axis_ref=axis.sku_variant_axis_ref WHERE axis.item_ref=?";
    public static final String CATALOG_SKU_VARIANT_AXIS_FACTS_SELECT = "SELECT ";

    public static final String CATALOG_SKU_VARIANT_AXIS_FACTS_CATALOG_SKU_VARIANT_AXIS_VALUE =
            "attribute.entry_ref=axis.attribute_ref LEFT JOIN catalog.catalog_sku_variant_axis_value ";
    public static final String CATALOG_SKU_VARIANT_AXIS_FACTS_VALUE = "value ";
    public static final String JOIN_CONDITION_DICTIONARY_ENTRY_VAL_004 =
            "ON value.sku_variant_axis_ref=axis.sku_variant_axis_ref LEFT JOIN catalog.dictionary_entry ";
    public static final String CATALOG_SKU_VARIANT_AXIS_FACTS_VALUE_ENTRY_ENTRY_REF_VALUE_VALUE_REF =
            "value_entry ON value_entry.entry_ref=value.value_ref WHERE axis.item_ref IN (";
    public static final String CATALOG_SKU_VARIANT_AXIS_FACTS_CLOSE_PAREN_ORDER_BY = ") ORDER BY ";
    public static final String CATALOG_SKU_VARIANT_AXIS_FACTS_AXIS_ITEM_REF_DISPLAY_ORDER_ATTRIBUTE_REF =
            "axis.item_ref,axis.display_order,axis.attribute_ref,value.display_order,value.value_ref";
    public static final String CATALOG_SKU_VARIANT_AXIS_FACTS_CLOSE_PAREN = ")";
    public static final String CATALOG_SKU_VARIANT_AXIS_FACTS_CLOSE_PAREN_ALTERNATE_A = ")";
    public static final String AXIS_ITEM_REF_AXIS_SKU_005 =
            """
    axis.item_ref,axis.sku_variant_axis_ref,axis.attribute_ref,attribu\
    te.code,attribute.name,axis.display_order,value.value_ref,value_en\
    try.code,value_entry.name,value_entry.status,value.display_order F\
    ROM catalog.catalog_sku_variant_axis axis JOIN catalog.dictionary_\
    entry attribute ON\s""";
}
