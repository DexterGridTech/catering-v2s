package com.catering.v2s.catalog.application.persistence;

/** SQL text fragments owned by CatalogSkuFacts; B3 relocates text only and does not change execution. */
public final class CatalogSkuFactsSql {
    public static final String PARAMETER_PLACEHOLDER = "?";
    public static final String PLACEHOLDER_SEPARATOR = ",";
    public static final String REQUESTED_ITEM_REF_VALUE = "(?::uuid)";
    public static final String VALUE_SEPARATOR = ",";
    public static final String CATALOG_SKU_FACTS_SELECT_FILTER_STATUS_ENABLED =
            "SELECT COUNT(*) FILTER (WHERE status='ENABLED') ";
    public static final String CATALOG_SKU_FACTS_FROM_CLAUSE_CATALOG_SKU_ITEM_REF_STATUS_VOIDED =
            "FROM catalog.catalog_sku WHERE item_ref=? AND status <> 'VOIDED'";
    public static final String CATALOG_SKU_FACTS_CTE_REQUESTED_ITEM_REF = "WITH requested(item_ref) AS (VALUES ";
    public static final String CATALOG_SKU_FACTS_CLOSE_PAREN_REQUESTED_ITEM_REF_SKU_PRODUCT_SKU_REF =
            ") SELECT requested.item_ref, sku.product_sku_ref, sku.sku_code, sku.sku_name,";
    public static final String CATALOG_SKU_FACTS_SKU_STANDARD_SALE_PRICE_IS_DEFAULT_STATUS =
            " sku.standard_sale_price, sku.is_default, sku.status, sku.version, sku.display_order,";
    public static final String CATALOG_SKU_FACTS_SKU_VARIANT_COMBINATION_DIGEST_SALES_UNIT_OVERRIDE_REF =
            " sku.variant_combination_digest, sku.sales_unit_override_ref,";
    public static final String CATALOG_SKU_FACTS_SKU_BASE_MEASURE_UNIT_OVERRIDE_REF_SALES_UNIT_REF_SALES_UNIT_CODE =
            " sku.base_measure_unit_override_ref, sku.sales_unit_ref, sku.sales_unit_code,";
    public static final String CATALOG_SKU_FACTS_SKU_SALES_UNIT_NAME_SALES_UNIT_DIMENSION_SALES_UNIT_PRECISION =
            " sku.sales_unit_name, sku.sales_unit_dimension, sku.sales_unit_precision,";
    public static final String CATALOG_SKU_FACTS_SKU =
            " sku.base_measure_unit_ref, sku.base_measure_unit_code, sku.base_measure_unit_name,";
    public static final String CATALOG_SKU_FACTS_SKU_BASE_MEASURE_UNIT_DIMENSION_BASE_MEASURE_UNIT_PRECISION =
            " sku.base_measure_unit_dimension, sku.base_measure_unit_precision,";
    public static final String CATALOG_SKU_FACTS_ATTRIBUTE_VALUE_ATTRIBUTE_REF_ATTRIBUTE_CODE =
            " attribute_value.attribute_ref, attribute.code, attribute.name, value.entry_ref, value.code,";
    public static final String CATALOG_SKU_FACTS_VALUE_NAME_STATUS_AXIS_VALUE =
            " value.name, value.status, COALESCE(axis_value.display_order,0), media_refs.media_refs,";
    public static final String CATALOG_SKU_FACTS_SKU_PREPARATION_OVERRIDE_TEXT_UPDATED_AT_EPOCH_MILLIS =
            " sku.preparation_override::text AS preparation_override, sku.updated_at_epoch_millis,";
    public static final String CATALOG_SKU_FACTS_CATALOG_SKU_AXIS_FACTS_SKU =
            " axis_facts.axis_facts FROM requested LEFT JOIN catalog.catalog_sku sku ON";
    public static final String CATALOG_SKU_FACTS_SKU_ITEM_REF_REQUESTED_STATUS =
            " sku.item_ref=requested.item_ref AND sku.status <> 'VOIDED' LEFT JOIN";
    public static final String CATALOG_SKU_FACTS_CATALOG_SKU_ATTRIBUTE_VALUE_ATTRIBUTE_VALUE =
            " catalog.catalog_sku_attribute_value attribute_value ON";
    public static final String CATALOG_SKU_FACTS_DICTIONARY_ENTRY_ATTRIBUTE_VALUE_PRODUCT_SKU_REF_SKU =
            " attribute_value.product_sku_ref=sku.product_sku_ref LEFT JOIN catalog.dictionary_entry";
    public static final String CATALOG_SKU_FACTS_ATTRIBUTE_ENTRY_REF_ATTRIBUTE_VALUE_ATTRIBUTE_REF =
            " attribute ON attribute.entry_ref=attribute_value.attribute_ref LEFT JOIN";
    public static final String CATALOG_SKU_FACTS_DICTIONARY_ENTRY_VALUE_ENTRY_REF_ATTRIBUTE_VALUE =
            " catalog.dictionary_entry value ON value.entry_ref=attribute_value.attribute_value_ref LEFT";
    public static final String CATALOG_SKU_FACTS_JOIN = " JOIN";
    public static final String CATALOG_SKU_FACTS_CATALOG_SKU_VARIANT_AXIS_AXIS_ITEM_REF_SKU =
            " catalog.catalog_sku_variant_axis axis ON axis.item_ref=sku.item_ref AND";
    public static final String CATALOG_SKU_FACTS_AXIS_ATTRIBUTE_REF_ATTRIBUTE_VALUE =
            " axis.attribute_ref=attribute_value.attribute_ref LEFT JOIN";
    public static final String CATALOG_SKU_FACTS_CATALOG_SKU_VARIANT_AXIS_VALUE_AXIS_VALUE =
            " catalog.catalog_sku_variant_axis_value axis_value ON";
    public static final String CATALOG_SKU_FACTS_AXIS_VALUE_SKU_VARIANT_AXIS_REF_AXIS =
            " axis_value.sku_variant_axis_ref=axis.sku_variant_axis_ref AND";
    public static final String CATALOG_SKU_FACTS_LATERAL_AXIS_VALUE_VALUE_REF_ATTRIBUTE_VALUE_ATTRIBUTE_VALUE_REF =
            " axis_value.value_ref=attribute_value.attribute_value_ref LEFT JOIN LATERAL";
    public static final String CATALOG_SKU_FACTS_OPEN_PAREN_STRING_AGG_MEDIA_ASSET_REF_TEXT =
            " (SELECT COALESCE(string_agg(media.asset_ref::text, ',' ORDER BY media.display_order,";
    public static final String CATALOG_SKU_FACTS_CATALOG_SKU_MEDIA_MEDIA_ASSET_REF_MEDIA_REFS =
            " media.asset_ref), '') AS media_refs FROM catalog.catalog_sku_media media WHERE";
    public static final String CATALOG_SKU_FACTS_LATERAL_MEDIA_PRODUCT_SKU_REF_SKU_MEDIA_REFS =
            " media.product_sku_ref=sku.product_sku_ref) AS media_refs ON TRUE LEFT JOIN LATERAL";
    public static final String CATALOG_SKU_FACTS_OPEN_PAREN_JSONB_AGG_JSONB_BUILD_OBJECT =
            " (SELECT COALESCE(jsonb_agg(jsonb_build_object(";
    public static final String CATALOG_SKU_FACTS_ATTRIBUTE_REF_AXIS_PROJECTION_TEXT =
            "'attributeRef',axis_projection.attribute_ref::text,";
    public static final String CATALOG_SKU_FACTS_ATTRIBUTE_CODE_AXIS_PROJECTION =
            "'attributeCode',axis_projection.attribute_code,";
    public static final String CATALOG_SKU_FACTS_ATTRIBUTE_NAME_AXIS_PROJECTION =
            "'attributeName',axis_projection.attribute_name,";
    public static final String CATALOG_SKU_FACTS_DISPLAY_ORDER_AXIS_PROJECTION =
            "'displayOrder',axis_projection.display_order,";
    public static final String CATALOG_SKU_FACTS_AXIS_PROJECTION_VALUES_JSON_DISPLAY_ORDER =
            "'values',axis_projection.values_json) ORDER BY axis_projection.display_order,";
    public static final String CATALOG_SKU_FACTS_AXIS_PROJECTION_ATTRIBUTE_REF_TEXT_AXIS_FACTS =
            " axis_projection.attribute_ref), '[]'::jsonb)::text AS axis_facts FROM (SELECT";
    public static final String CATALOG_SKU_FACTS_AXIS_PROJECTION_ATTRIBUTE_REF_ATTRIBUTE_PROJECTION_CODE =
            " axis_projection.attribute_ref,attribute_projection.code AS attribute_code,";
    public static final String CATALOG_SKU_FACTS_ATTRIBUTE_PROJECTION_NAME_ATTRIBUTE_NAME_AXIS_PROJECTION =
            " attribute_projection.name AS attribute_name,axis_projection.display_order,";
    public static final String CATALOG_SKU_FACTS_JSONB_AGG_JSONB_BUILD_OBJECT =
            " COALESCE((SELECT jsonb_agg(jsonb_build_object(";
    public static final String CATALOG_SKU_FACTS_VALUE_REF_AXIS_VALUE_PROJECTION_TEXT =
            "'valueRef',axis_value_projection.value_ref::text,";
    public static final String CATALOG_SKU_FACTS_VALUE_CODE_VALUE_PROJECTION_CODE_VALUE_LABEL =
            "'valueCode',value_projection.code,'valueLabel',value_projection.name,";
    public static final String CATALOG_SKU_FACTS_STATUS_VALUE_PROJECTION_DISPLAY_ORDER_AXIS_VALUE_PROJECTION =
            "'status',value_projection.status,'displayOrder',axis_value_projection.display_order)";
    public static final String CATALOG_SKU_FACTS_ORDER_BY_AXIS_VALUE_PROJECTION_DISPLAY_ORDER_VALUE_REF =
            " ORDER BY axis_value_projection.display_order,axis_value_projection.value_ref) FROM";
    public static final String CATALOG_SKU_FACTS_CATALOG_SKU_VARIANT_AXIS_VALUE_AXIS_VALUE_PROJECTION =
            " catalog.catalog_sku_variant_axis_value axis_value_projection LEFT JOIN";
    public static final String CATALOG_SKU_FACTS_DICTIONARY_ENTRY_VALUE_PROJECTION_ENTRY_REF =
            " catalog.dictionary_entry value_projection ON value_projection.entry_ref=";
    public static final String CATALOG_SKU_FACTS_AXIS_VALUE_PROJECTION_VALUE_REF_SKU_VARIANT_AXIS_REF =
            " axis_value_projection.value_ref WHERE axis_value_projection.sku_variant_axis_ref=";
    public static final String CATALOG_SKU_FACTS_AXIS_PROJECTION_SKU_VARIANT_AXIS_REF_VALUES_JSON =
            " axis_projection.sku_variant_axis_ref), '[]'::jsonb) AS values_json FROM";
    public static final String CATALOG_SKU_FACTS_DICTIONARY_ENTRY_CATALOG_SKU_VARIANT_AXIS_AXIS_PROJECTION =
            " catalog.catalog_sku_variant_axis axis_projection JOIN catalog.dictionary_entry";
    public static final String CATALOG_SKU_FACTS_ATTRIBUTE_PROJECTION_ENTRY_REF_AXIS_PROJECTION_ATTRIBUTE_REF =
            " attribute_projection ON attribute_projection.entry_ref=axis_projection.attribute_ref WHERE";
    public static final String CATALOG_SKU_FACTS_AXIS_PROJECTION_ITEM_REF_REQUESTED_AXIS_FACTS =
            " axis_projection.item_ref=requested.item_ref) axis_projection) axis_facts ON TRUE ORDER BY";
    public static final String CATALOG_SKU_FACTS_REQUESTED_ITEM_REF_SKU_DISPLAY_ORDER =
            " requested.item_ref, sku.display_order NULLS LAST, sku.sku_code NULLS LAST,";
    public static final String CATALOG_SKU_FACTS_AXIS_VALUE_DISPLAY_ORDER_ATTRIBUTE_CODE =
            " COALESCE(axis_value.display_order,0), attribute.code, value.code";
    public static final String CATALOG_SKU_FACTS_SELECT_SKU_ITEM_REF_PRODUCT_SKU_REF_SKU_CODE =
            "SELECT sku.item_ref, sku.product_sku_ref, sku.sku_code, sku.sku_name,";
    public static final String CATALOG_SKU_FACTS_SKU_STANDARD_SALE_PRICE_IS_DEFAULT_STATUS_ALTERNATE_A =
            " sku.standard_sale_price, sku.is_default, sku.status, sku.version, sku.display_order,";
    public static final String CATALOG_SKU_FACTS_SKU_VARIANT_COMBINATION_DIGEST_SALES_UNIT_OVERRIDE_REF_ALTERNATE_A =
            " sku.variant_combination_digest, sku.sales_unit_override_ref,";
    public static final String SKU_BASE_MEAS_UNIT_OVERRIDE_ALT_A_001 =
            " sku.base_measure_unit_override_ref, sku.sales_unit_ref, sku.sales_unit_code,";
    public static final String SKU_SALES_UNIT_NAME_SALES_ALT_A_002 =
            " sku.sales_unit_name, sku.sales_unit_dimension, sku.sales_unit_precision,";
    public static final String CATALOG_SKU_FACTS_SKU_ALTERNATE_A =
            " sku.base_measure_unit_ref, sku.base_measure_unit_code, sku.base_measure_unit_name,";
    public static final String SKU_BASE_MEAS_UNIT_DIM_ALT_A_003 =
            " sku.base_measure_unit_dimension, sku.base_measure_unit_precision,";
    public static final String CATALOG_SKU_FACTS_ATTRIBUTE_VALUE_ATTRIBUTE_REF_ATTRIBUTE_CODE_ALTERNATE_A =
            " attribute_value.attribute_ref, attribute.code, attribute.name, value.entry_ref, value.code,";
    public static final String CATALOG_SKU_FACTS_VALUE_NAME_STATUS_AXIS_VALUE_ALTERNATE_A =
            " value.name, value.status, COALESCE(axis_value.display_order,0), media_refs.media_refs,";
    public static final String CATALOG_SKU_FACTS_EMPTY_LITERAL = " ";
    public static final String CATALOG_SKU_FACTS_PREPARATION_OVERRIDE_SKU_UPDATED_AT_EPOCH_MILLIS =
            " AS preparation_override, sku.updated_at_epoch_millis FROM";
    public static final String CATALOG_SKU_FACTS_CATALOG_SKU_ATTRIBUTE_VALUE_CATALOG_SKU_SKU_ATTRIBUTE_VALUE =
            " catalog.catalog_sku sku LEFT JOIN catalog.catalog_sku_attribute_value attribute_value ON";
    public static final String CATALOG_SKU_FACTS_DICTIONARY_ENTRY_ATTRIBUTE_VALUE_PRODUCT_SKU_REF_SKU_ALTERNATE_A =
            " attribute_value.product_sku_ref = sku.product_sku_ref LEFT JOIN catalog.dictionary_entry";
    public static final String CATALOG_SKU_FACTS_ATTRIBUTE_ENTRY_REF_ATTRIBUTE_VALUE_ATTRIBUTE_REF_ALTERNATE_A =
            " attribute ON attribute.entry_ref = attribute_value.attribute_ref LEFT JOIN";
    public static final String CATALOG_SKU_FACTS_DICTIONARY_ENTRY_VALUE_ENTRY_REF_ATTRIBUTE_VALUE_ALTERNATE_A =
            " catalog.dictionary_entry value ON value.entry_ref = attribute_value.attribute_value_ref";
    public static final String CATALOG_SKU_FACTS_SERVICE_LEFT_JOIN_PREFIX = " LEFT";
    public static final String CATALOG_SKU_FACTS_JOIN_CATALOG_SKU_VARIANT_AXIS_AXIS_ITEM_REF_SKU =
            " JOIN catalog.catalog_sku_variant_axis axis ON axis.item_ref = sku.item_ref AND";
    public static final String CATALOG_SKU_FACTS_AXIS_ATTRIBUTE_REF_ATTRIBUTE_VALUE_ALTERNATE_A =
            " axis.attribute_ref = attribute_value.attribute_ref LEFT JOIN";
    public static final String CATALOG_SKU_FACTS_CATALOG_SKU_VARIANT_AXIS_VALUE_AXIS_VALUE_SKU_VARIANT_AXIS_REF =
            " catalog.catalog_sku_variant_axis_value axis_value ON axis_value.sku_variant_axis_ref =";
    public static final String CATALOG_SKU_FACTS_AXIS_SKU_VARIANT_AXIS_REF_AXIS_VALUE_VALUE_REF =
            " axis.sku_variant_axis_ref AND axis_value.value_ref = attribute_value.attribute_value_ref,";
    public static final String CATALOG_SKU_FACTS_LATERAL_STRING_AGG_MEDIA_ASSET_REF =
            " LATERAL (SELECT COALESCE(string_agg(media.asset_ref::text, ',' ORDER BY";
    public static final String CATALOG_SKU_FACTS_MEDIA_DISPLAY_ORDER = " media.display_order,";
    public static final String CATALOG_SKU_FACTS_CATALOG_SKU_MEDIA_MEDIA_ASSET_REF_MEDIA_REFS_ALTERNATE_A =
            " media.asset_ref), '') AS media_refs FROM catalog.catalog_sku_media media WHERE";
    public static final String CATALOG_SKU_FACTS_MEDIA_PRODUCT_SKU_REF_SKU_MEDIA_REFS =
            " media.product_sku_ref = sku.product_sku_ref) AS media_refs WHERE sku.item_ref IN (";
    public static final String CATALOG_SKU_FACTS_SELECT_CATALOG_SKU_PRODUCT_SKU_REF_ITEM_REF_STATUS_VOIDED =
            "SELECT product_sku_ref FROM catalog.catalog_sku WHERE item_ref=? AND status <> 'VOIDED' FOR UPDATE";
    public static final String CATALOG_SKU_FACTS_CTE_LOCKED_SKUS = "WITH locked_skus AS MATERIALIZED (";
    public static final String CATALOG_SKU_FACTS_SELECT_SKU_PRODUCT_SKU_REF = "SELECT sku.product_sku_ref ";
    public static final String CATALOG_SKU_FACTS_FROM_CLAUSE_CATALOG_SKU_SKU = "FROM catalog.catalog_sku sku ";
    public static final String CATALOG_SKU_FACTS_WHERE_SKU_ITEM_REF_STATUS_VOIDED =
            "WHERE sku.item_ref=? AND sku.status <> 'VOIDED' FOR UPDATE";
    public static final String CATALOG_SKU_FACTS_CLOSE_PAREN = ") ";
    public static final String CATALOG_SKU_FACTS_SELECT_LOCKED_SKUS_PRODUCT_SKU_REF_MEDIA_ASSET_REF =
            "SELECT locked_skus.product_sku_ref,media.asset_ref ";
    public static final String CATALOG_SKU_FACTS_FROM_CLAUSE_CATALOG_SKU_MEDIA_MEDIA =
            "FROM locked_skus LEFT JOIN catalog.catalog_sku_media media ";
    public static final String CATALOG_SKU_FACTS_JOIN_CONDITION_MEDIA_PRODUCT_SKU_REF_LOCKED_SKUS =
            "ON media.product_sku_ref=locked_skus.product_sku_ref ";
    public static final String CATALOG_SKU_FACTS_UNION_UNION_ALL = "UNION ALL ";
    public static final String CATALOG_SKU_FACTS_SELECT_IMAGE_ASSET_REF = "SELECT NULL::uuid,image.asset_ref ";
    public static final String CATALOG_SKU_FACTS_FROM_CLAUSE_CATALOG_ITEM_IMAGE_IMAGE_ITEM_REF =
            "FROM catalog.catalog_item_image image WHERE image.item_ref=?";
    public static final String CATALOG_SKU_FACTS_SELECT_CATALOG_SKU_PRODUCT_SKU_REF_SKU_CODE_STATUS_VERSION =
            "SELECT product_sku_ref,sku_code,status,version FROM catalog.catalog_sku WHERE item_ref=? AND ";
    public static final String CATALOG_SKU_FACTS_PRODUCT_SKU_REF = "product_sku_ref=? FOR UPDATE";
    public static final String CATALOG_SKU_FACTS_UPDATE_CATALOG_SKU_STATUS_VOIDED_VERSION_UPDATED_AT_EPOCH_MILLIS =
            "UPDATE catalog.catalog_sku SET status='VOIDED',version=version+1,updated_at_epoch_millis=? ";
    public static final String CATALOG_SKU_FACTS_WHERE_ITEM_REF = "WHERE item_ref=? AND ";
    public static final String CATALOG_SKU_FACTS_PRODUCT_SKU_REF_VERSION_STATUS_VOIDED =
            "product_sku_ref=? AND version=? AND status <> 'VOIDED'";
    public static final String CATALOG_SKU_FACTS_UPDATE_CATALOG_SKU_STATUS_VOIDED_VERSION =
            "UPDATE catalog.catalog_sku SET status='VOIDED',version=version+1,";
    public static final String CATALOG_SKU_FACTS_UPDATE_UPDATED_AT_EPOCH_MILLIS_ITEM_REF =
            "updated_at_epoch_millis=? WHERE item_ref=? AND ";
    public static final String CATALOG_SKU_FACTS_PRODUCT_SKU_REF_STATUS_VOIDED =
            "product_sku_ref=? AND status <> 'VOIDED'";
    public static final String CATALOG_SKU_FACTS_INSERT_INTO = "INSERT INTO ";

    public static final String CATALOG_SKU_FACTS_SALES_UNIT_OVERRIDE_REF = "sales_unit_override_ref,";
    public static final String CATALOG_SKU_FACTS_BASE_MEASURE_UNIT_OVERRIDE_REF_UPDATED_AT_EPOCH_MILLIS =
            "base_measure_unit_override_ref,updated_at_epoch_millis)";
    public static final String CATALOG_SKU_FACTS_VALUES_SET_PRODUCT_SKU_REF =
            " VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(product_sku_ref) DO UPDATE SET ";
    public static final String CATALOG_SKU_FACTS_SKU_CODE_SKU_NAME =
            "sku_code=EXCLUDED.sku_code,sku_name=EXCLUDED.sku_name,";
    public static final String CATALOG_SKU_FACTS_STANDARD_SALE_PRICE_IS_DEFAULT_STATUS =
            "standard_sale_price=EXCLUDED.standard_sale_price,is_default=EXCLUDED.is_default,status=";
    public static final String CATALOG_SKU_FACTS_STATUS_DISPLAY_ORDER_VARIANT_COMBINATION_DIGEST =
            "EXCLUDED.status,display_order=EXCLUDED.display_order,variant_combination_digest=";
    public static final String CATALOG_SKU_FACTS_VARIANT_COMBINATION_DIGEST = "EXCLUDED.variant_combination_digest,";
    public static final String CATALOG_SKU_FACTS_SALES_UNIT_OVERRIDE_REF_ALTERNATE_A =
            "sales_unit_override_ref=EXCLUDED.sales_unit_override_ref,";
    public static final String CATALOG_SKU_FACTS_BASE_MEASURE_UNIT_OVERRIDE_REF =
            "base_measure_unit_override_ref=EXCLUDED.base_measure_unit_override_ref,";
    public static final String CATALOG_SKU_FACTS_UPDATE_UPDATED_AT_EPOCH_MILLIS =
            "updated_at_epoch_millis=EXCLUDED.updated_at_epoch_millis,";
    public static final String CATALOG_SKU_FACTS_VERSION_CATALOG_SKU = "version=catalog.catalog_sku.version+1";
    public static final String CATALOG_SKU_FACTS_WHERE_CATALOG_SKU_ITEM_REF_STATUS =
            " WHERE catalog.catalog_sku.item_ref=EXCLUDED.item_ref AND catalog.catalog_sku.status <>";
    public static final String CATALOG_SKU_FACTS_VOIDED = " 'VOIDED'";
    public static final String CATALOG_SKU_FACTS_DELETE_CATALOG_SKU_ATTRIBUTE_VALUE_PRODUCT_SKU_REF =
            "DELETE FROM catalog.catalog_sku_attribute_value WHERE product_sku_ref IN (";
    public static final String CATALOG_SKU_FACTS_INSERT_INTO_ALTERNATE_A = "INSERT INTO";
    public static final String CATALOG_SKU_FACTS_CATALOG_SKU_ATTRIBUTE_VALUE =
            " catalog.catalog_sku_attribute_value(product_sku_ref,attribute_ref,attribute_value_ref) ";
    public static final String CATALOG_SKU_FACTS_VALUES = "VALUES(?,?,?)";
    public static final String CATALOG_SKU_FACTS_INSERT_INTO_ALTERNATE_B = "INSERT INTO ";

    public static final String CATALOG_SKU_FACTS_VALUES_ALTERNATE_A = "VALUES(?,?,?,?,?,?,?,?,?,?) ";
    public static final String CATALOG_SKU_FACTS_JOIN_CONDITION_PRODUCT_SKU_REF =
            "ON CONFLICT(product_sku_ref) DO NOTHING";
    public static final String CATALOG_SKU_FACTS_INSERT_INTO_ALTERNATE_C = "INSERT INTO ";
    public static final String CATALOG_SKU_FACTS_CATALOG_SKU_ATTRIBUTE_VALUE_ALTERNATE_A =
            "catalog.catalog_sku_attribute_value(product_sku_ref,attribute_ref,attribute_value_ref) ";
    public static final String CATALOG_SKU_FACTS_VALUES_ALTERNATE_B = "VALUES(?,?,?)";
    public static final String UPDATE_CAT_SKU_SALES_UNIT_004 =
            "UPDATE catalog.catalog_sku SET sales_unit_override_ref=?,base_measure_unit_override_ref=?,";
    public static final String CATALOG_SKU_FACTS_UPDATE_UPDATED_AT_EPOCH_MILLIS_WHER = "updated_at_epoch_millis=? WHER";

    public static final String CATALOG_SKU_FACTS_SKU_PREPARATION_OVERRIDE_TEXT = "sku.preparation_override::text";
    public static final String CATALOG_SKU_FACTS_TEXT = "NULL::text";
    public static final String CATALOG_SKU_FACTS_CLOSE_PAREN_SKU_STATUS_VOIDED =
            ") AND sku.status <> 'VOIDED' ORDER BY ";
    public static final String CATALOG_SKU_FACTS_SKU_ITEM_REF_DISPLAY_ORDER_SKU_CODE =
            "sku.item_ref, sku.display_order, sku.sku_code, ";
    public static final String CATALOG_SKU_FACTS_AXIS_VALUE_DISPLAY_ORDER_ATTRIBUTE_CODE_ALTERNATE_A =
            "COALESCE(axis_value.display_order,0), attribute.code, value.code";
    public static final String CATALOG_SKU_FACTS_CLOSE_PAREN_ALTERNATE_A = ")";
    public static final String CAT_SKU_PRODUCT_SKU_REF_005 =
            """
    catalog.catalog_sku(product_sku_ref,item_ref,sku_code,sku_name,sta\
    ndard_sale_price,is_default,status,display_order,variant_combinati\
    on_digest,""";
    public static final String CAT_SKU_PRODUCT_SKU_REF_006 =
            """
    catalog.catalog_sku(product_sku_ref,item_ref,sku_code,sku_name,sta\
    ndard_sale_price,is_default,status,display_order,variant_combinati\
    on_digest,updated_at_epoch_millis)\s""";
    public static final String UPDATED_AT_EPOCH_MS_WHERE_007 =
            """
    updated_at_epoch_millis=? WHERE product_sku_ref=?""";
}
