package com.catering.v2s.catalog.application.persistence;

/** SQL text fragments owned by CatalogPreparationFacts; B3 relocates text only and does not change execution. */
public final class CatalogPreparationFactsSql {
    public static final String PARAMETER_PLACEHOLDER = "?";
    public static final String PLACEHOLDER_SEPARATOR = ",";
    public static final String CATALOG_PREPARATION_FACTS_SELECT_CATALOG_ITEM_ITEM_REF_PREPARATION_PROFILE_TEXT = "SELECT item_ref,preparation_profile::text FROM catalog.catalog_item WHERE item_ref IN (";
    public static final String CATALOG_PREPARATION_FACTS_SELECT_CATALOG_SKU_PRODUCT_SKU_REF_PREPARATION_OVERRIDE_TEXT = "SELECT product_sku_ref,preparation_override::text FROM catalog.catalog_sku WHERE product_sku_ref IN (";
    public static final String CATALOG_PREPARATION_FACTS_SELECT_CONFIG_ITEM_REF_OVERRIDE_ORDER_OPTION_DEFINITION_VALUE_REF = "SELECT config.item_ref,override.order_option_definition_value_ref,override.preparation_effect::text ";
    public static final String CATALOG_PREPARATION_FACTS_FROM_CLAUSE_CATALOG_ITEM_ORDER_OPTION_CONFIG_CONFIG = "FROM catalog.catalog_item_order_option_config config JOIN ";
    public static final String CATALOG_PREPARATION_FACTS_CATALOG_ITEM_ORDER_OPTION_VALUE_OV_OVERRIDE = "catalog.catalog_item_order_option_value_override override ON ";
    public static final String CATALOG_PREPARATION_FACTS_OVERRIDE_ITEM_ORDER_OPTION_CONFIG_REF_CONFIG = "override.item_order_option_config_ref=config.item_order_option_config_ref ";
    public static final String CATALOG_PREPARATION_FACTS_WHERE_CONFIG_ITEM_REF = "WHERE config.item_ref IN (";
    public static final String CATALOG_PREPARATION_FACTS_CLOSE_PAREN_OVERRIDE_PREPARATION_EFFECT = ") AND override.preparation_effect IS NOT NULL ";
    public static final String CATALOG_PREPARATION_FACTS_ORDER_BY_CONFIG_ITEM_REF_OVERRIDE_ORDER_OPTION_DEFINITION_VALUE_REF = "ORDER BY config.item_ref,override.order_option_definition_value_ref";
    public static final String CATALOG_PREPARATION_FACTS_SELECT_ITEM_FACT_KIND_ITEM_REF_RELATED_REF = "SELECT 'ITEM' AS fact_kind,item_ref,NULL::uuid AS related_ref,preparation_profile::text AS value ";
    public static final String CATALOG_PREPARATION_FACTS_FROM_CLAUSE_CATALOG_ITEM_ITEM_REF = "FROM catalog.catalog_item WHERE item_ref IN (";
    public static final String CATALOG_PREPARATION_FACTS_UNION_SKU_ITEM_REF_PRODUCT_SKU_REF_PREPARATION_OVERRIDE = " UNION ALL SELECT 'SKU',sku.item_ref,sku.product_sku_ref,sku.preparation_override::text ";
    public static final String CATALOG_PREPARATION_FACTS_FROM_CLAUSE_CATALOG_SKU_SKU_PRODUCT_SKU_REF = "FROM catalog.catalog_sku sku WHERE sku.product_sku_ref IN (";
    public static final String CATALOG_PREPARATION_FACTS_ORDER_BY_FACT_KIND_ITEM_REF_RELATED_REF = " ORDER BY fact_kind,item_ref,related_ref";
    public static final String CATALOG_PREPARATION_FACTS_UPDATE_CATALOG_ITEM_PREPARATION_PROFILE_ITEM_REF = "UPDATE catalog.catalog_item SET preparation_profile=CAST(? AS JSONB) WHERE item_ref=?";
    public static final String CATALOG_PREPARATION_FACTS_UPDATE_CATALOG_SKU_PREPARATION_OVERRIDE_ITEM_REF = "UPDATE catalog.catalog_sku SET preparation_override=NULL WHERE item_ref=?";
    public static final String CATALOG_PREPARATION_FACTS_UPDATE_CATALOG_SKU_PREPARATION_OVERRIDE = "UPDATE catalog.catalog_sku SET preparation_override=CAST(? AS JSONB) ";
    public static final String CATALOG_PREPARATION_FACTS_WHERE_ITEM_REF_PRODUCT_SKU_REF = "WHERE item_ref=? AND product_sku_ref=?";
    public static final String CATALOG_PREPARATION_FACTS_UPDATE_CATALOG_ITEM_ORDER_OPTION_VALUE_OV_OVERRIDE_PREPARATION_EFFECT = "UPDATE catalog.catalog_item_order_option_value_override override SET preparation_effect=NULL ";
    public static final String CATALOG_PREPARATION_FACTS_FROM_CLAUSE_CATALOG_ITEM_ORDER_OPTION_CONFIG_CONFIG_ALTERNATE_A = "FROM catalog.catalog_item_order_option_config config ";
    public static final String CATALOG_PREPARATION_FACTS_WHERE_OVERRIDE_ITEM_ORDER_OPTION_CONFIG_REF_CONFIG = "WHERE override.item_order_option_config_ref=config.item_order_option_config_ref ";
    public static final String CATALOG_PREPARATION_FACTS_CONDITION_CONFIG_ITEM_REF = "AND config.item_ref=?";
    public static final String CATALOG_PREPARATION_FACTS_UPDATE_CATALOG_ITEM_ORDER_OPTION_VALUE_OV_OVERRIDE = "UPDATE catalog.catalog_item_order_option_value_override override ";
    public static final String CATALOG_PREPARATION_FACTS_SET_PREPARATION_EFFECT = "SET preparation_effect=CAST(? AS JSONB) ";
    public static final String CATALOG_PREPARATION_FACTS_FROM_CLAUSE_CATALOG_ITEM_ORDER_OPTION_CONFIG_CONFIG_ALTERNATE_B = "FROM catalog.catalog_item_order_option_config config ";
    public static final String CATALOG_PREPARATION_FACTS_WHERE_OVERRIDE_ITEM_ORDER_OPTION_CONFIG_REF_CONFIG_ALTERNATE_A = "WHERE override.item_order_option_config_ref=config.item_order_option_config_ref ";
    public static final String CATALOG_PREPARATION_FACTS_CONDITION_CONFIG_ITEM_REF_OVERRIDE_ORDER_OPTION_DEFINITION_VALUE_REF = "AND config.item_ref=? AND override.order_option_definition_value_ref=?";
    public static final String CATALOG_PREPARATION_FACTS_CLOSE_PAREN = ")";
    public static final String CATALOG_PREPARATION_FACTS_CLOSE_PAREN_ALTERNATE_A = ")";
    public static final String CATALOG_PREPARATION_FACTS_CLOSE_PAREN_EFFECT_CONFIG_ITEM_REF_OVERRIDE = ") UNION ALL SELECT 'EFFECT',config.item_ref,override.order_option_definition_value_ref,";
    public static final String CATALOG_PREPARATION_FACTS_CATALOG_ITEM_ORDER_OPTION_CONFIG = "override.preparation_effect::text FROM catalog.catalog_item_order_option_config config JOIN ";
    public static final String CATALOG_PREPARATION_FACTS_CATALOG_ITEM_ORDER_OPTION_VALUE_OV_OVERRIDE_ALTERNATE_A = "catalog.catalog_item_order_option_value_override override ON ";
    public static final String CATALOG_PREPARATION_FACTS_OVERRIDE_ITEM_ORDER_OPTION_CONFIG_REF_CONFIG_ALTERNATE_A = "override.item_order_option_config_ref=config.item_order_option_config_ref WHERE ";
    public static final String CATALOG_PREPARATION_FACTS_CONFIG_ITEM_REF = "config.item_ref IN (";
    public static final String CATALOG_PREPARATION_FACTS_CLOSE_PAREN_OVERRIDE_PREPARATION_EFFECT_ALTERNATE_A = ") AND override.preparation_effect IS NOT NULL";
}
