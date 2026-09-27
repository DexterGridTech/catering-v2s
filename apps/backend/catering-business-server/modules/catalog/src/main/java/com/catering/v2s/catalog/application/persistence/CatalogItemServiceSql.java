package com.catering.v2s.catalog.application.persistence;

/** SQL text fragments owned by CatalogItemService; B3 relocates text only and does not change execution. */
public final class CatalogItemServiceSql {
    public static final String VALUE_SEPARATOR = ",";
    public static final String PARAMETER_PLACEHOLDER = "?";
    public static final String REFERENCE_TUPLE = "(?,?)";
    public static final String SKU_STATUS_ENABLED_PREDICATE = "sku.status = 'ENABLED'";
    public static final String SKU_STATUS_NOT_VOIDED_PREDICATE = "sku.status <> 'VOIDED'";
    public static final String CATALOG_ITEM_SERVICE_UPDATE_CATALOG_ITEM_STATUS_VERSION_UPDATED_AT_EPOCH_MILLIS =
            "UPDATE catalog.catalog_item SET status=?,version=version+1,updated_at_epoch_millis=? ";
    public static final String CATALOG_ITEM_SERVICE_WHERE_ITEM_REF_DATA_NODE_REF_BRAND_REF_VERSION =
            "WHERE item_ref=? AND data_node_ref=? AND brand_ref=? AND version=? AND status <> 'VOIDED' ";
    public static final String CATALOG_ITEM_SERVICE_RETURNING_VERSION = "RETURNING version";
    public static final String CATALOG_ITEM_SERVICE_SELECT_ITEM_REF_CODE_NAME_SHORT_NAME =
            "SELECT item_ref,code,name,short_name,shape_key,status,sections::text,version,updated_at_epoch_millis,";
    public static final String CATALOG_ITEM_SERVICE_CATALOG_ITEM_SOURCE_SCOPE_REF_DATA_NODE_REF_BRAND_REF =
            "source_scope_ref,data_node_ref,brand_ref FROM catalog.catalog_item WHERE ";
    public static final String CATALOG_ITEM_SERVICE_SELECT = "SELECT";
    public static final String CATALOG_ITEM_SERVICE_ITEM_REF_CODE_NAME_SHORT_NAME =
            " item_ref,code,name,short_name,shape_key,status,sections::text,version,";
    public static final String CATALOG_ITEM_SERVICE_UPDATE_UPDATED_AT_EPOCH_MILLIS_SOURCE_SCOPE_REF =
            "updated_at_epoch_millis,source_scope_ref";
    public static final String CATALOG_ITEM_SERVICE_FROM_CLAUSE_CATALOG_ITEM_DATA_NODE_REF_BRAND_REF_ITEM_REF =
            " FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=? AND item_ref=?";
    public static final String CATALOG_ITEM_SERVICE_LOCK_FOR_UPDATE = " FOR UPDATE";
    public static final String CATALOG_ITEM_SERVICE_SELECT_CATALOG_ITEM_DATA_NODE_REF_BRAND_REF_CODE_STATUS =
            "SELECT COUNT(*) FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=? AND code=? AND status ";
    public static final String CATALOG_ITEM_SERVICE_VOIDED = "<> 'VOIDED'";
    public static final String CATALOG_ITEM_SERVICE_SELECT_ASSET_REF = "SELECT DISTINCT asset_ref FROM (";
    public static final String CATALOG_ITEM_SERVICE_SELECT_CATALOG_ITEM_IMAGE_IMAGE_ASSET_REF =
            "SELECT image.asset_ref FROM catalog.catalog_item_image image ";
    public static final String CATALOG_ITEM_SERVICE_JOIN_CATALOG_ITEM_ITEM_ITEM_REF_IMAGE =
            "JOIN catalog.catalog_item item ON item.item_ref=image.item_ref ";
    public static final String CATALOG_ITEM_SERVICE_WHERE_IMAGE_ASSET_REF = "WHERE image.asset_ref IN (";
    public static final String CATALOG_ITEM_SERVICE_CLOSE_PAREN_ITEM_STATUS_VOIDED = ") AND item.status <> 'VOIDED' ";
    public static final String CATALOG_ITEM_SERVICE_UNION = "UNION ";
    public static final String CATALOG_ITEM_SERVICE_SELECT_CATALOG_SKU_MEDIA_MEDIA_ASSET_REF =
            "SELECT media.asset_ref FROM catalog.catalog_sku_media media ";
    public static final String CATALOG_ITEM_SERVICE_JOIN_CATALOG_SKU_SKU_PRODUCT_SKU_REF_MEDIA =
            "JOIN catalog.catalog_sku sku ON sku.product_sku_ref=media.product_sku_ref ";
    public static final String CATALOG_ITEM_SERVICE_JOIN_CATALOG_ITEM_ITEM_ITEM_REF_SKU =
            "JOIN catalog.catalog_item item ON item.item_ref=sku.item_ref ";
    public static final String CATALOG_ITEM_SERVICE_WHERE_MEDIA_ASSET_REF = "WHERE media.asset_ref IN (";
    public static final String CATALOG_ITEM_SERVICE_CLOSE_PAREN_ITEM_STATUS_VOIDED_ALTERNATE_A =
            ") AND item.status <> 'VOIDED'";
    public static final String CATALOG_ITEM_SERVICE_UNION_ALTERNATE_A = " UNION ";
    public static final String CATALOG_ITEM_SERVICE_SELECT_PUBLISHED_PUBLISHED_PRIMARY_IMAGE_ASSET_REF =
            "SELECT published.published_primary_image_asset_ref ";
    public static final String CATALOG_ITEM_SERVICE_FROM_CLAUSE_SALES_VERSION_ITEM_PUBLISHED =
            "FROM sales_menu.sales_version_item published ";
    public static final String CATALOG_ITEM_SERVICE_JOIN_SALES_COLLECTION_VERSION_PUBLISHED_VERSION =
            "JOIN sales_menu.sales_collection_version published_version ";
    public static final String CATALOG_ITEM_SERVICE_JOIN_CONDITION_PUBLISHED_VERSION_VERSION_REF_PUBLISHED =
            "ON published_version.version_ref=published.version_ref ";
    public static final String CATALOG_ITEM_SERVICE_WHERE_PUBLISHED_PUBLISHED_PRIMARY_IMAGE_ASSET_REF =
            "WHERE published.published_primary_image_asset_ref IN (";
    public static final String CATALOG_ITEM_SERVICE_CLOSE_PAREN = ") ";
    public static final String CATALOG_ITEM_SERVICE_CONDITION_PUBLISHED_VERSION_KIND_PUBLISHED =
            "AND published_version.kind='PUBLISHED'";
    public static final String CATALOG_ITEM_SERVICE_UNION_ALTERNATE_B = " UNION ";
    public static final String CATALOG_ITEM_SERVICE_SELECT_SNAPSHOT_ASSET_REF =
            "SELECT CASE WHEN snapshot.asset_ref ~* ";
    public static final String CATALOG_ITEM_SERVICE_0_9A_F_8_0_9A_F_4_1_5_0_9A_F =
            "'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' ";
    public static final String CATALOG_ITEM_SERVICE_THEN_SNAPSHOT_ASSET_REF = "THEN snapshot.asset_ref::uuid END ";
    public static final String CATALOG_ITEM_SERVICE_FROM_CLAUSE_SALES_VERSION_ITEM_PUBLISHED_ALTERNATE_A =
            "FROM sales_menu.sales_version_item published ";
    public static final String CATALOG_ITEM_SERVICE_JOIN_SALES_COLLECTION_VERSION_PUBLISHED_VERSION_ALTERNATE_A =
            "JOIN sales_menu.sales_collection_version published_version ";
    public static final String CATALOG_ITEM_SERVICE_JOIN_CONDITION_PUBLISHED_VERSION_VERSION_REF_PUBLISHED_ALTERNATE_A =
            "ON published_version.version_ref=published.version_ref ";
    public static final String CATALOG_ITEM_SERVICE_LATERAL_JSONB_ARRAY_ELEMENTS_TEXT =
            "CROSS JOIN LATERAL jsonb_array_elements_text(";
    public static final String CATALOG_ITEM_SERVICE_PUBLISHED_PUBLISHED_CATALOG_IMAGE_ASSET_REFS_SNAPSHOT_ASSET_REF =
            "published.published_catalog_image_asset_refs) snapshot(asset_ref) ";
    public static final String CATALOG_ITEM_SERVICE_WHERE_SNAPSHOT_ASSET_REF = "WHERE snapshot.asset_ref IN (";
    public static final String CATALOG_ITEM_SERVICE_CLOSE_PAREN_ALTERNATE_A = ") ";
    public static final String CATALOG_ITEM_SERVICE_CONDITION_PUBLISHED_VERSION_KIND_PUBLISHED_ALTERNATE_A =
            "AND published_version.kind='PUBLISHED'";
    public static final String CATALOG_ITEM_SERVICE_CLOSE_PAREN_REFERENCED_ASSETS = ") referenced_assets";
    public static final String CATALOG_ITEM_SERVICE_SELECT_ASSET_REF_ALTERNATE_A = "SELECT asset_ref FROM (";
    public static final String CATALOG_ITEM_SERVICE_SELECT_CATALOG_ITEM_IMAGE_IMAGE_ASSET_REF_ALTERNATE_A =
            "SELECT image.asset_ref FROM catalog.catalog_item_image image ";
    public static final String CATALOG_ITEM_SERVICE_JOIN_CATALOG_ITEM_ITEM_ITEM_REF_IMAGE_ALTERNATE_A =
            "JOIN catalog.catalog_item item ON item.item_ref=image.item_ref ";
    public static final String CATALOG_ITEM_SERVICE_WHERE_ITEM_DATA_NODE_REF_BRAND_REF_CODE =
            "WHERE item.data_node_ref=? AND item.brand_ref=? AND item.code=? ";
    public static final String CATALOG_ITEM_SERVICE_CONDITION_ITEM_STATUS_VOIDED = "AND item.status <> 'VOIDED' ";
    public static final String CATALOG_ITEM_SERVICE_UNION_ALTERNATE_C = "UNION ";
    public static final String CATALOG_ITEM_SERVICE_SELECT_CATALOG_SKU_MEDIA_MEDIA_ASSET_REF_ALTERNATE_A =
            "SELECT media.asset_ref FROM catalog.catalog_sku_media media ";
    public static final String CATALOG_ITEM_SERVICE_JOIN_CATALOG_SKU_SKU_PRODUCT_SKU_REF_MEDIA_ALTERNATE_A =
            "JOIN catalog.catalog_sku sku ON sku.product_sku_ref=media.product_sku_ref ";
    public static final String CATALOG_ITEM_SERVICE_JOIN_CATALOG_ITEM_ITEM_ITEM_REF_SKU_ALTERNATE_A =
            "JOIN catalog.catalog_item item ON item.item_ref=sku.item_ref ";
    public static final String CATALOG_ITEM_SERVICE_WHERE_ITEM_DATA_NODE_REF_BRAND_REF_CODE_ALTERNATE_A =
            "WHERE item.data_node_ref=? AND item.brand_ref=? AND item.code=? ";
    public static final String CATALOG_ITEM_SERVICE_CONDITION_ITEM_STATUS_VOIDED_ALTERNATE_A =
            "AND item.status <> 'VOIDED'";
    public static final String CATALOG_ITEM_SERVICE_CLOSE_PAREN_ASSET_REFS_ASSET_REF =
            ") asset_refs ORDER BY asset_ref";
    public static final String CATALOG_ITEM_SERVICE_SELECT_CATALOG_SKU_ITEM_CODE_SKU_SKU_CODE =
            "SELECT item.code,sku.sku_code,sku.sku_name FROM catalog.catalog_item item JOIN catalog.catalog_sku ";
    public static final String CATALOG_ITEM_SERVICE_SKU_ITEM_REF_ITEM_DATA_NODE_REF =
            "sku ON sku.item_ref=item.item_ref WHERE item.data_node_ref=? AND item.brand_ref=? AND ";
    public static final String CATALOG_ITEM_SERVICE_ITEM_CODE = "item.code ";
    public static final String CATALOG_ITEM_SERVICE_IN_LIST_PREFIX = "IN (";
    public static final String CATALOG_ITEM_SERVICE_CTE_ITEM_SCOPE_ITEM_REF_PREPARATION_PROFILE =
            "WITH item_scope AS (SELECT item_ref,preparation_profile FROM ";
    public static final String CATALOG_ITEM_SERVICE_CATALOG_ITEM_DATA_NODE_REF_BRAND_REF_CODE =
            "catalog.catalog_item WHERE data_node_ref=? AND brand_ref=? AND code=? AND status <> 'VOIDED'), ";
    public static final String CATALOG_ITEM_SERVICE_MATCHING_SKU_PRODUCT_SKU_REF_SKU_CODE =
            "matching AS (SELECT sku.product_sku_ref,sku.sku_code,sku.sku_name,";
    public static final String CATALOG_ITEM_SERVICE_SKU_STANDARD_SALE_PRICE = "sku.standard_sale_price,";
    public static final String CATALOG_ITEM_SERVICE_SKU_SALES_UNIT_OVERRIDE_REF_SALES_UNIT_REF_SALES_UNIT_CODE =
            "sku.sales_unit_override_ref,sku.sales_unit_ref,sku.sales_unit_code,sku.sales_unit_name,";
    public static final String CATALOG_ITEM_SERVICE_SKU_SALES_UNIT_DIMENSION_SALES_UNIT_PRECISION_SALES_UNIT =
            "sku.sales_unit_dimension,sku.sales_unit_precision,COALESCE(sales_unit.status,'ENABLED'),";
    public static final String CATALOG_ITEM_SERVICE_SKU =
            "sku.base_measure_unit_override_ref,sku.base_measure_unit_ref,sku.base_measure_unit_code,";
    public static final String CATALOG_ITEM_SERVICE_SKU_ALTERNATE_A =
            "sku.base_measure_unit_name,sku.base_measure_unit_dimension,sku.base_measure_unit_precision,";
    public static final String CATALOG_ITEM_SERVICE_BASE_UNIT_STATUS_ENABLED_SKU =
            "COALESCE(base_unit.status,'ENABLED'),sku.is_default,sku.status,sku.updated_at_epoch_millis,";
    public static final String CATALOG_ITEM_SERVICE_PRIMARY_MEDIA_ASSET_REF_ATTRIBUTES_ATTRIBUTE_VALUES =
            "primary_media.asset_ref,attributes.attribute_values,sku.display_order,";
    public static final String CATALOG_ITEM_SERVICE_ITEM_PREPARATION_PROFILE_TEXT_SKU =
            "item.preparation_profile::text,sku.preparation_override::text,production_tag.ref ";
    public static final String CATALOG_ITEM_SERVICE_FROM_CLAUSE_ITEM_SCOPE_SKU_ITEM =
            "FROM catalog.catalog_sku sku JOIN item_scope item ON ";
    public static final String CATALOG_ITEM_SERVICE_ITEM_ITEM_REF_SKU = "item.item_ref=sku.item_ref ";
    public static final String CATALOG_ITEM_SERVICE_UNIT_DEFINITION_SALES_UNIT_UNIT_REF_SKU_SALES_UNIT_REF =
            "LEFT JOIN catalog.unit_definition sales_unit ON sales_unit.unit_ref=sku.sales_unit_ref ";
    public static final String CATALOG_ITEM_SERVICE_UNIT_DEFINITION_BASE_UNIT_UNIT_REF_SKU_BASE_MEASURE_UNIT_REF =
            "LEFT JOIN catalog.unit_definition base_unit ON base_unit.unit_ref=sku.base_measure_unit_ref ";
    public static final String CATALOG_ITEM_SERVICE_CATALOG_SKU_MEDIA_MEDIA_ASSET_REF =
            "LEFT JOIN LATERAL (SELECT media.asset_ref FROM catalog.catalog_sku_media media ";
    public static final String CATALOG_ITEM_SERVICE_WHERE_MEDIA_PRODUCT_SKU_REF_SKU_DISPLAY_ORDER =
            "WHERE media.product_sku_ref=sku.product_sku_ref ORDER BY media.display_order,";
    public static final String CATALOG_ITEM_SERVICE_MEDIA_ASSET_REF_PRIMARY_MEDIA =
            "media.asset_ref LIMIT 1) primary_media ON TRUE ";
    public static final String CATALOG_ITEM_SERVICE_CATALOG_ITEM_REFERENCE_RELATION_REF =
            "LEFT JOIN LATERAL (SELECT relation.ref FROM catalog.catalog_item_reference relation ";
    public static final String CATALOG_ITEM_SERVICE_WHERE_RELATION_ITEM_REF_ITEM_KIND =
            "WHERE relation.item_ref=item.item_ref AND relation.kind='PRODUCTION_TAG') production_tag ON TRUE ";
    public static final String CATALOG_ITEM_SERVICE_LATERAL_JSONB_AGG_JSONB_BUILD_OBJECT_ATTRIBUTE_REF =
            "LEFT JOIN LATERAL (SELECT COALESCE(jsonb_agg(jsonb_build_object('attributeRef',";
    public static final String CATALOG_ITEM_SERVICE_ATTRIBUTE_ENTRY_REF_TEXT = "attribute.entry_ref::text,";
    public static final String CATALOG_ITEM_SERVICE_ATTRIBUTE_CODE_ATTRIBUTE_CODE_ATTRIBUTE_NAME =
            "'attributeCode',attribute.code,'attributeName',attribute.name,";
    public static final String CATALOG_ITEM_SERVICE_ATTRIBUTE_VALUE_REF_VALUE_ENTRY_REF_TEXT =
            "'attributeValueRef',value.entry_ref::text,";
    public static final String CATALOG_ITEM_SERVICE_VALUE_CODE_VALUE_CODE_VALUE_LABEL =
            "'valueCode',value.code,'valueLabel',value.name,'displayOrder',";
    public static final String CATALOG_ITEM_SERVICE_AXIS_VALUE_DISPLAY_ORDER_STATUS_VALUE =
            "COALESCE(axis_value.display_order,0),'status',value.status) ";
    public static final String CATALOG_ITEM_SERVICE_ORDER_BY_AXIS_VALUE_DISPLAY_ORDER_ATTRIBUTE_CODE =
            "ORDER BY COALESCE(axis_value.display_order,0),attribute.code,value.code), '[]':";
    public static final String CATALOG_ITEM_SERVICE_ATTRIBUTE_VALUES = ":jsonb) attribute_values ";
    public static final String CATALOG_ITEM_SERVICE_FROM_CLAUSE_CATALOG_SKU_ATTRIBUTE_VALUE_ASSIGNMENT =
            "FROM catalog.catalog_sku_attribute_value assignment JOIN ";
    public static final String CATALOG_ITEM_SERVICE_DICTIONARY_ENTRY_ATTRIBUTE_ENTRY_REF_ASSIGNMENT =
            "catalog.dictionary_entry attribute ON attribute.entry_ref=assignment.attribute_ref ";
    public static final String CATALOG_ITEM_SERVICE_JOIN_DICTIONARY_ENTRY_VALUE =
            "JOIN catalog.dictionary_entry value ON ";
    public static final String CATALOG_ITEM_SERVICE_VALUE_ENTRY_REF_ASSIGNMENT_ATTRIBUTE_VALUE_REF =
            "value.entry_ref=assignment.attribute_value_ref LEFT JOIN ";
    public static final String CATALOG_ITEM_SERVICE_CATALOG_SKU_VARIANT_AXIS_AXIS =
            "catalog.catalog_sku_variant_axis axis ";
    public static final String CATALOG_ITEM_SERVICE_JOIN_CONDITION_AXIS_ITEM_REF_SKU_ATTRIBUTE_REF =
            "ON axis.item_ref=sku.item_ref AND axis.attribute_ref=assignment.attribute_ref ";
    public static final String CATALOG_ITEM_SERVICE_CATALOG_SKU_VARIANT_AXIS_VALUE_AXIS_VALUE =
            "LEFT JOIN catalog.catalog_sku_variant_axis_value axis_value ";
    public static final String CATALOG_ITEM_SERVICE_JOIN_CONDITION_AXIS_VALUE_SKU_VARIANT_AXIS_REF_AXIS =
            "ON axis_value.sku_variant_axis_ref=axis.sku_variant_axis_ref AND ";
    public static final String CATALOG_ITEM_SERVICE_AXIS_VALUE_VALUE_REF_ASSIGNMENT_ATTRIBUTE_VALUE_REF =
            "axis_value.value_ref=assignment.attribute_value_ref ";
    public static final String CATALOG_ITEM_SERVICE_WHERE_ASSIGNMENT_PRODUCT_SKU_REF_SKU_ATTRIBUTES =
            "WHERE assignment.product_sku_ref=sku.product_sku_ref) attributes ON TRUE WHERE ";
    public static final String CATALOG_ITEM_SERVICE_WHERE_DISPLAY_ORDER_SKU_CODE =
            " WHERE (display_order>? OR (display_order=? AND sku_code>?) OR ";
    public static final String CATALOG_ITEM_SERVICE_OPEN_PAREN_DISPLAY_ORDER_SKU_CODE_PRODUCT_SKU_REF =
            "(display_order=? AND sku_code=? AND product_sku_ref>?))";
    public static final String CATALOG_ITEM_SERVICE_ORDER_BY_DISPLAY_ORDER_SKU_CODE_PRODUCT_SKU_REF =
            " ORDER BY display_order,sku_code,product_sku_ref LIMIT ?) ";
    public static final String CATALOG_ITEM_SERVICE_SELECT_ITEM_SCOPE_PAGED_AGGREGATE_TOTAL_ITEM_EXISTS =
            "SELECT paged.*,aggregate.total,EXISTS(SELECT 1 FROM item_scope) AS item_exists ";
    public static final String CATALOG_ITEM_SERVICE_FROM_CLAUSE_PAGED_FROM_AGGREGATE_LEFT_JOIN_PAG =
            "FROM aggregate LEFT JOIN paged ON TRUE ";
    public static final String CATALOG_ITEM_SERVICE_ORDER_BY_PAGED_DISPLAY_ORDER_SKU_CODE_PRODUCT_SKU_REF =
            "ORDER BY paged.display_order,paged.sku_code,paged.product_sku_ref";
    public static final String CATALOG_ITEM_SERVICE_INSERT_INTO_CATALOG_ITEM_ITEM_REF_DATA_NODE_REF_BRAND_REF_CODE =
            "INSERT INTO catalog.catalog_item (item_ref, data_node_ref, brand_ref, code, name, short_name, ";
    public static final String CATALOG_ITEM_SERVICE_SHAPE_KEY_STATUS_SECTIONS_VERSION =
            "shape_key, status, sections, version, created_at_epoch_millis, ";
    public static final String CATALOG_ITEM_SERVICE_UPDATE_UPDATED_AT_EPOCH_MILLIS_DISABLED =
            "updated_at_epoch_millis) VALUES (?, ?, ?, ?, ?, ?, ?, 'DISABLED', CAST(? AS JSONB), 1, ";
    public static final String CATALOG_ITEM_SERVICE_PARAMETER_PLACEHOLDER = "?, ?)";
    public static final String CATALOG_ITEM_SERVICE_UPDATE_CATALOG_ITEM_NAME_SHORT_NAME_SECTIONS =
            "UPDATE catalog.catalog_item SET name=?, short_name=?, sections=CAST(? AS JSONB), ";
    public static final String CATALOG_ITEM_SERVICE_SALES_UNIT_REF =
            "sales_unit_ref=?,sales_unit_code=?,sales_unit_name=?,sales_unit_dimension=?,";
    public static final String CATALOG_ITEM_SERVICE_SALES_UNIT_PRECISION_BASE_MEASURE_UNIT_REF_BASE_MEASURE_UNIT_CODE =
            "sales_unit_precision=?,base_measure_unit_ref=?,base_measure_unit_code=?,";
    public static final String CATALOG_ITEM_SERVICE_BASE_MEASURE_UNIT_NAME =
            "base_measure_unit_name=?,base_measure_unit_dimension=?,base_measure_unit_precision=?,";
    public static final String CATALOG_ITEM_SERVICE_VERSION_UPDATED_AT_EPOCH_MILLIS_DATA_NODE_REF_BRAND_REF =
            "version=version+1, updated_at_epoch_millis=? WHERE data_node_ref=? AND brand_ref=? ";
    public static final String CATALOG_ITEM_SERVICE_CONDITION_CODE_VERSION_STATUS_VOIDED =
            "AND code=? AND version=? AND status <> 'VOIDED'";
    public static final String CATALOG_ITEM_SERVICE_UPDATE_CATALOG_ITEM =
            "UPDATE catalog.catalog_item SET sales_unit_ref=?,sales_unit_code=?,sales_unit_name=?,sales_unit_di";

    public static final String CATALOG_ITEM_SERVICE_UPDATE_CATALOG_SKU_UPDATE_CATALOG_CATALOG_SKU_S =
            "UPDATE catalog.catalog_sku SET";

    public static final String CATALOG_ITEM_SERVICE_BASE_MEASURE_UNIT_REF_ALTERNATE_A =
            "base_measure_unit_ref=?,base_measure_unit_code=?,base_measure_unit_name=?,";
    public static final String CATALOG_ITEM_SERVICE_BASE_MEASURE_UNIT_DIMENSION_BASE_MEASURE_UNIT_PRECISION =
            "base_measure_unit_dimension=?,base_measure_unit_precision=?";
    public static final String CATALOG_ITEM_SERVICE_VALUE_SEPARATOR_UPDATED_AT_EPOCH_MILLIS =
            ",updated_at_epoch_millis=?";
    public static final String CATALOG_ITEM_SERVICE_WHERE_PRODUCT_SKU_REF = " WHERE product_sku_ref=?";
    public static final String CATALOG_ITEM_SERVICE_UPDATE_CATALOG_ITEM_VERSION_UPDATED_AT_EPOCH_MILLIS_ITEM_REF =
            "UPDATE catalog.catalog_item SET version=version+1,updated_at_epoch_millis=? WHERE item_ref=? ";
    public static final String CATALOG_ITEM_SERVICE_CONDITION_DATA_NODE_REF_BRAND_REF_VERSION_STATUS =
            "AND data_node_ref=? AND brand_ref=? AND version=? AND status <> 'VOIDED'";
    public static final String CATALOG_ITEM_SERVICE_SELECT_CATALOG_ITEM_SKU_ITEM_REF_ITEM =
            "SELECT sku.item_ref FROM catalog.catalog_sku sku JOIN catalog.catalog_item item ON ";
    public static final String CATALOG_ITEM_SERVICE_ITEM_ITEM_REF_SKU_DATA_NODE_REF =
            "item.item_ref=sku.item_ref WHERE item.data_node_ref=? AND item.brand_ref=? AND ";
    public static final String CATALOG_ITEM_SERVICE_SKU_PRODUCT_SKU_REF = "sku.product_sku_ref=?";
    public static final String CATALOG_ITEM_SERVICE_SELECT_CATALOG_SKU_PRODUCT_SKU_REF =
            "SELECT EXISTS (SELECT 1 FROM catalog.catalog_sku WHERE product_sku_ref=?)";
    public static final String CATALOG_ITEM_SERVICE_SELECT_CATALOG_ITEM_VERSION_DATA_NODE_REF_BRAND_REF_ITEM_REF =
            "SELECT version FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=? AND item_ref=? FOR ";
    public static final String CATALOG_ITEM_SERVICE_UPDATE = "UPDATE";
    public static final String CATALOG_ITEM_SERVICE_SELECT_SKU = "SELECT 'SKU' AS";
    public static final String CATALOG_ITEM_SERVICE_KIND_COMPONENT_PRODUCT_SKU_REF_COMPOSITE_COMPONENT_REF =
            " kind,component.product_sku_ref,component.composite_component_ref,owner_item.item_ref,";
    public static final String CATALOG_ITEM_SERVICE_OWNER_ITEM_CODE_NAME_BIGINT =
            "owner_item.code,owner_item.name,NULL::bigint";
    public static final String CATALOG_ITEM_SERVICE_FROM_CLAUSE_CATALOG_COMPOSITE_GROUP_COMPONENT =
            " FROM catalog.catalog_composite_component component JOIN catalog.catalog_composite_group";
    public static final String CATALOG_ITEM_SERVICE_GROUP_ROW_COMPOSITE_GROUP_REF_COMPONENT =
            " group_row ON group_row.composite_group_ref=component.composite_group_ref JOIN";
    public static final String CATALOG_ITEM_SERVICE_CATALOG_ITEM_OWNER_ITEM_ITEM_REF_GROUP_ROW =
            " catalog.catalog_item owner_item ON owner_item.item_ref=group_row.item_ref JOIN";
    public static final String CATALOG_ITEM_SERVICE_CATALOG_SKU_TARGET_SKU_PRODUCT_SKU_REF_COMPONENT =
            " catalog.catalog_sku target_sku ON target_sku.product_sku_ref=component.product_sku_ref";
    public static final String CATALOG_ITEM_SERVICE_WHERE = " WHERE";
    public static final String CATALOG_ITEM_SERVICE_OWNER_ITEM_DATA_NODE_REF_BRAND_REF_STATUS =
            " owner_item.data_node_ref=? AND owner_item.brand_ref=? AND owner_item.status <> 'VOIDED' AND";
    public static final String CATALOG_ITEM_SERVICE_COMPONENT_PRODUCT_SKU_REF =
            " component.product_sku_ref=ANY(?::uuid[]) AND";
    public static final String CATALOG_ITEM_SERVICE_OWNER_ITEM_ITEM_REF_TARGET_SKU =
            " owner_item.item_ref <> target_sku.item_ref UNION ALL SELECT";
    public static final String CATALOG_ITEM_SERVICE_ITEM_COMPONENT_COMPOSITE_COMPONENT_REF_OWNER_ITEM =
            " 'ITEM',NULL::uuid,component.composite_component_ref,owner_item.item_ref,";
    public static final String CATALOG_ITEM_SERVICE_OWNER_ITEM_CODE_NAME_BIGINT_ALTERNATE_A =
            "owner_item.code,owner_item.name,NULL::bigint";
    public static final String CATALOG_ITEM_SERVICE_FROM_CLAUSE_CATALOG_COMPOSITE_GROUP_COMPONENT_ALTERNATE_A =
            " FROM catalog.catalog_composite_component component JOIN catalog.catalog_composite_group";
    public static final String CATALOG_ITEM_SERVICE_GROUP_ROW_COMPOSITE_GROUP_REF_COMPONENT_ALTERNATE_A =
            " group_row ON group_row.composite_group_ref=component.composite_group_ref JOIN";
    public static final String CATALOG_ITEM_SERVICE_CATALOG_ITEM_OWNER_ITEM_ITEM_REF_GROUP_ROW_ALTERNATE_A =
            " catalog.catalog_item owner_item ON owner_item.item_ref=group_row.item_ref WHERE";
    public static final String CATALOG_ITEM_SERVICE_OWNER_ITEM_DATA_NODE_REF_BRAND_REF_STATUS_ALTERNATE_A =
            " owner_item.data_node_ref=? AND owner_item.brand_ref=? AND owner_item.status <> 'VOIDED' AND";
    public static final String CATALOG_ITEM_SERVICE_COMPONENT_COMPONENT_ITEM_REF =
            " component.component_item_ref=? UNION ALL SELECT";
    public static final String CATALOG_ITEM_SERVICE_GENERATION_TEXT =
            " 'GENERATION',NULL::uuid,NULL::uuid,NULL::uuid,NULL::text,NULL::text,";
    public static final String CATALOG_ITEM_SERVICE_VERSION = "COALESCE(MAX(version),0) FROM";
    public static final String CATALOG_ITEM_SERVICE_CATALOG_ITEM_DATA_NODE_REF_BRAND_REF =
            " catalog.catalog_item WHERE data_node_ref=? AND brand_ref=?";
    public static final String CATALOG_ITEM_SERVICE_SELECT_COMPONENT_PRODUCT_SKU_REF_COMPOSITE_COMPONENT_REF =
            "SELECT component.product_sku_ref,component.composite_component_ref,";
    public static final String CATALOG_ITEM_SERVICE_OWNER_ITEM_ITEM_REF_CODE_NAME =
            "owner_item.item_ref,owner_item.code,owner_item.name FROM ";
    public static final String CATALOG_ITEM_SERVICE_CATALOG_COMPOSITE_GROUP_CATALOG_COMPOSITE_COMPONENT_COMPONENT =
            "catalog.catalog_composite_component component JOIN catalog.catalog_composite_group ";
    public static final String CATALOG_ITEM_SERVICE_GROUP_ROW = "group_row ON ";
    public static final String CATALOG_ITEM_SERVICE_CATALOG_ITEM_GROUP_ROW_COMPOSITE_GROUP_REF_COMPONENT =
            "group_row.composite_group_ref=component.composite_group_ref JOIN catalog.catalog_item ";
    public static final String CATALOG_ITEM_SERVICE_CATALOG_SKU_OWNER_ITEM_ITEM_REF_GROUP_ROW_TARGET_SKU =
            "owner_item ON owner_item.item_ref=group_row.item_ref JOIN catalog.catalog_sku target_sku ON ";
    public static final String CATALOG_ITEM_SERVICE_TARGET_SKU_PRODUCT_SKU_REF_COMPONENT_OWNER_ITEM =
            "target_sku.product_sku_ref=component.product_sku_ref WHERE owner_item.data_node_ref=? AND ";
    public static final String CATALOG_ITEM_SERVICE_OWNER_ITEM_BRAND_REF = "owner_item.brand_ref=? ";
    public static final String CATALOG_ITEM_SERVICE_CONDITION = "AND ";
    public static final String CATALOG_ITEM_SERVICE_OWNER_ITEM_STATUS_VOIDED_COMPONENT =
            "owner_item.status <> 'VOIDED' AND component.product_sku_ref = ANY(?::uuid[]) ";
    public static final String CATALOG_ITEM_SERVICE_CONDITION_OWNER_ITEM_ITEM_REF_TARGET_SKU =
            "AND owner_item.item_ref <> target_sku.item_ref ORDER BY ";
    public static final String CATALOG_ITEM_SERVICE_COMPONENT_PRODUCT_SKU_REF_OWNER_ITEM_CODE =
            "component.product_sku_ref,owner_item.code,component.composite_component_ref";
    public static final String UPDATE_CAT_ITEM_STATUS_VER_ALT_A_001 =
            "UPDATE catalog.catalog_item SET status=?, version=version+1, updated_at_epoch_millis=? WHERE ";
    public static final String CATALOG_ITEM_SERVICE_ITEM_REF_DATA_NODE_REF_BRAND_REF_VERSION =
            "item_ref=? AND data_node_ref=? AND brand_ref=? AND version=?";
    public static final String CATALOG_ITEM_SERVICE_SELECT_CATALOG_ITEM_DATA_NODE_REF_BRAND_REF_CODE =
            "SELECT COUNT(*) FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=? AND code=? AND ";
    public static final String CATALOG_ITEM_SERVICE_ITEM_REF_STATUS_VOIDED = "item_ref<>? AND status <> 'VOIDED'";
    public static final String CATALOG_ITEM_SERVICE_UPDATE_CATALOG_ITEM_UPDATE_CATALOG_CATALOG_ITEM_ =
            "UPDATE catalog.catalog_item SET ";
    public static final String CATALOG_ITEM_SERVICE_NAME_SHORT_NAME_SHAPE_KEY_STATUS =
            "name=?,short_name=?,shape_key=?,status='DISABLED',sections=CAST(? AS JSONB),";
    public static final String CATALOG_ITEM_SERVICE_VERSION_UPDATED_AT_EPOCH_MILLIS =
            "version=version+1,updated_at_epoch_millis=? ";
    public static final String CATALOG_ITEM_SERVICE_WHERE_ALTERNATE_A = "WHERE ";
    public static final String CATALOG_ITEM_SERVICE_DATA_NODE_REF_BRAND_REF_CODE_VERSION =
            "data_node_ref=? AND brand_ref=? AND code=? AND version=?";
    public static final String CATALOG_ITEM_SERVICE_INSERT_INTO_CATALOG_ITEM_INSERT_INTO_CATALOG_CATALOG_ =
            "INSERT INTO catalog.catalog_item ";
    public static final String CATALOG_ITEM_SERVICE_OPEN_PAREN_ITEM_REF_DATA_NODE_REF_BRAND_REF_CODE =
            "(item_ref,data_node_ref,brand_ref,code,name,short_name,shape_key,status,sections,";

    public static final String CATALOG_ITEM_SERVICE_VALUES_DISABLED =
            "VALUES (?,?,?,?,?,?,?, 'DISABLED',CAST(? AS JSONB),?,?,1,?,?)";
    public static final String CATALOG_ITEM_SERVICE_UPDATE_CATALOG_ITEM_STATUS_VOIDED_VERSION_UPDATED_AT_EPOCH_MILLIS =
            "UPDATE catalog.catalog_item SET status='VOIDED',version=version+1,updated_at_epoch_millis=? ";
    public static final String CATALOG_ITEM_SERVICE_WHERE_DATA_NODE_REF_BRAND_REF_CODE_VERSION =
            "WHERE data_node_ref=? AND brand_ref=? AND code=? AND version=?";
    public static final String CATALOG_ITEM_SERVICE_SELECT_CATEGORY_REF_CODE_NAME_PARENT_CODE =
            "SELECT category_ref,code,name,parent_code,parent_category_ref,status,version,display_order FROM ";
    public static final String CATALOG_ITEM_SERVICE_CATALOG_CATEGORY_DATA_NODE_REF_BRAND_REF_CATEGORY_REF =
            "catalog.catalog_category WHERE data_node_ref=? AND brand_ref=? AND category_ref IN (";
    public static final String CATALOG_ITEM_SERVICE_SELECT_PRODUCT_IDENTIFIER_ITEM_REF =
            "SELECT EXISTS (SELECT 1 FROM catalog.product_identifier WHERE item_ref=?)";
    public static final String CATALOG_ITEM_SERVICE_SELECT_ITEM_ITEM_REF_CODE_NAME =
            "SELECT item.item_ref,item.code,item.name,item.short_name,item.shape_key,item.status,";
    public static final String CATALOG_ITEM_SERVICE_ITEM_SECTIONS_TEXT = "item.sections::text,";
    public static final String CATALOG_ITEM_SERVICE_ITEM_VERSION_UPDATED_AT_EPOCH_MILLIS_SOURCE_SCOPE_REF =
            "item.version,item.updated_at_epoch_millis,item.source_scope_ref,";
    public static final String CATALOG_ITEM_SERVICE_PRODUCT_IDENTIFIER_IDENTIFIER =
            "EXISTS (SELECT 1 FROM catalog.product_identifier identifier WHERE ";
    public static final String CATALOG_ITEM_SERVICE_IDENTIFIER_ITEM_REF_ITEM = "identifier.item_ref=item.item_ref) ";
    public static final String CATALOG_ITEM_SERVICE_FROM_CLAUSE_CATALOG_ITEM_ITEM_DATA_NODE_REF_BRAND_REF =
            "FROM catalog.catalog_item item WHERE item.data_node_ref=? AND item.brand_ref=? ";
    public static final String CATALOG_ITEM_SERVICE_CONDITION_ITEM_CODE = "AND item.code=?";
    public static final String CATALOG_ITEM_SERVICE_SELECT_COMPONENT_COMPONENT_ITEM_REF_OWNER_ITEM_ITEM_REF =
            "SELECT component.component_item_ref,owner_item.item_ref,owner_item.code,owner_item.name ";
    public static final String CATALOG_ITEM_SERVICE_FROM_CLAUSE_CATALOG_COMPOSITE_COMPONENT_COMPONENT =
            "FROM catalog.catalog_composite_component component JOIN ";
    public static final String CATALOG_ITEM_SERVICE_CATALOG_COMPOSITE_GROUP_GROUP_ROW =
            "catalog.catalog_composite_group group_row ON ";
    public static final String CATALOG_ITEM_SERVICE_CATALOG_ITEM_GROUP_ROW_COMPOSITE_GROUP_REF_COMPONENT_ALTERNATE_A =
            "group_row.composite_group_ref=component.composite_group_ref JOIN catalog.catalog_item ";
    public static final String CATALOG_ITEM_SERVICE_OWNER_ITEM_ITEM_REF_GROUP_ROW_DATA_NODE_REF =
            "owner_item ON owner_item.item_ref=group_row.item_ref WHERE owner_item.data_node_ref=? AND ";
    public static final String CATALOG_ITEM_SERVICE_OWNER_ITEM_BRAND_REF_STATUS_VOIDED =
            "owner_item.brand_ref=? AND owner_item.status <> 'VOIDED' ";
    public static final String CATALOG_ITEM_SERVICE_CONDITION_COMPONENT_COMPONENT_ITEM_REF =
            "AND component.component_item_ref=ANY(?::uuid[]) ORDER BY component.component_item_ref, ";
    public static final String CATALOG_ITEM_SERVICE_OWNER_ITEM_CODE_ITEM_REF = "owner_item.code, owner_item.item_ref";
    public static final String CATALOG_ITEM_SERVICE_SELECT_OWNER_ITEM_ITEM_REF_CODE_NAME =
            "SELECT owner_item.item_ref, owner_item.code, owner_item.name ";
    public static final String CATALOG_ITEM_SERVICE_FROM_CLAUSE_CATALOG_COMPOSITE_COMPONENT_COMPONENT_ALTERNATE_A =
            "FROM catalog.catalog_composite_component component JOIN ";
    public static final String CATALOG_ITEM_SERVICE_CATALOG_COMPOSITE_GROUP_GROUP_ROW_ALTERNATE_A =
            "catalog.catalog_composite_group group_row ON ";
    public static final String CATALOG_ITEM_SERVICE_CATALOG_ITEM_GROUP_ROW_COMPOSITE_GROUP_REF_COMPONENT_ALTERNATE_B =
            "group_row.composite_group_ref=component.composite_group_ref JOIN catalog.catalog_item ";
    public static final String CATALOG_ITEM_SERVICE_OWNER_ITEM_ITEM_REF_GROUP_ROW_DATA_NODE_REF_ALTERNATE_A =
            "owner_item ON owner_item.item_ref=group_row.item_ref WHERE owner_item.data_node_ref=? AND ";
    public static final String CATALOG_ITEM_SERVICE_OWNER_ITEM_BRAND_REF_STATUS_VOIDED_ALTERNATE_A =
            "owner_item.brand_ref=? AND owner_item.status <> 'VOIDED' AND component.component_item_ref=? ";
    public static final String CATALOG_ITEM_SERVICE_ORDER_BY_OWNER_ITEM_CODE_ITEM_REF =
            "ORDER BY owner_item.code, owner_item.item_ref";
    public static final String CATALOG_ITEM_SERVICE_SELECT_CATEGORY_REF_CODE_NAME_PARENT_CODE_ALTERNATE_A =
            "SELECT category_ref,code,name,parent_code,parent_category_ref,status,version,display_order FROM ";
    public static final String CATALOG_ITEM_SERVICE_CATALOG_CATEGORY_DATA_NODE_REF_BRAND_REF_CATEGORY_REF_ALTERNATE_A =
            "catalog.catalog_category WHERE data_node_ref=? AND brand_ref=? AND category_ref IN (";
    public static final String CATALOG_ITEM_SERVICE_SELECT_SKU_ATTRIBUTE_DICTIONARY_KIND_RELATION_ATTRIBUTE_REF =
            "SELECT 'SKU_ATTRIBUTE' AS dictionary_kind,relation.attribute_ref AS entry_ref FROM ";
    public static final String CATALOG_ITEM_SERVICE_CATALOG_SKU_CATALOG_SKU_ATTRIBUTE_VALUE_RELATION_SKU =
            "catalog.catalog_sku_attribute_value relation JOIN catalog.catalog_sku sku ON ";
    public static final String CATALOG_ITEM_SERVICE_CATALOG_ITEM_SKU_PRODUCT_SKU_REF_RELATION_ITEM =
            "sku.product_sku_ref=relation.product_sku_ref JOIN catalog.catalog_item item ON ";
    public static final String CATALOG_ITEM_SERVICE_ITEM_ITEM_REF_SKU_DATA_NODE_REF_ALTERNATE_A =
            "item.item_ref=sku.item_ref WHERE item.data_node_ref=? AND item.brand_ref=? ";
    public static final String CATALOG_ITEM_SERVICE_CONDITION_ITEM_ITEM_REF = "AND item.item_ref=? ";
    public static final String CATALOG_ITEM_SERVICE_UNION_SKU_ATTRIBUTE_VALUE_RELATION_ATTRIBUTE_VALUE_REF =
            "UNION SELECT 'SKU_ATTRIBUTE_VALUE',relation.attribute_value_ref FROM ";
    public static final String CATALOG_ITEM_SERVICE_CATALOG_SKU_CATALOG_SKU_ATTRIBUTE_VALUE_RELATION_SKU_ALTERNATE_A =
            "catalog.catalog_sku_attribute_value relation JOIN catalog.catalog_sku sku ON ";
    public static final String CATALOG_ITEM_SERVICE_CATALOG_ITEM_SKU_PRODUCT_SKU_REF_RELATION_ITEM_ALTERNATE_A =
            "sku.product_sku_ref=relation.product_sku_ref JOIN catalog.catalog_item item ON ";
    public static final String CATALOG_ITEM_SERVICE_ITEM_ITEM_REF_SKU_DATA_NODE_REF_ALTERNATE_B =
            "item.item_ref=sku.item_ref WHERE item.data_node_ref=? AND item.brand_ref=? ";
    public static final String CATALOG_ITEM_SERVICE_CONDITION_ITEM_ITEM_REF_ALTERNATE_A = "AND item.item_ref=?";
    public static final String CATALOG_ITEM_SERVICE_SELECT_DICTIONARY_ENTRY_DICTIONARY_KIND_ENTRY_REF_STATUS =
            "SELECT dictionary_kind,entry_ref,status FROM catalog.dictionary_entry ";
    public static final String CATALOG_ITEM_SERVICE_WHERE_DATA_NODE_REF_BRAND_REF =
            "WHERE data_node_ref=? AND brand_ref=? ";
    public static final String CATALOG_ITEM_SERVICE_CONDITION_DICTIONARY_KIND_ENTRY_REF =
            "AND (dictionary_kind,entry_ref) IN (";
    public static final String SELECT_CAT_ITEM_REF_STATUS_002 =
            "SELECT item_ref,status FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=? ";
    public static final String CATALOG_ITEM_SERVICE_CONDITION_ITEM_REF = "AND item_ref IN (";
    public static final String CATALOG_ITEM_SERVICE_SELECT_SKU_PRODUCT_SKU_REF_ITEM_REF_ITEM =
            "SELECT sku.product_sku_ref,sku.item_ref,item.status,sku.status ";
    public static final String CATALOG_ITEM_SERVICE_FROM_CLAUSE_CATALOG_ITEM_SKU_ITEM =
            "FROM catalog.catalog_sku sku JOIN catalog.catalog_item item ";
    public static final String CATALOG_ITEM_SERVICE_JOIN_CONDITION_ITEM_ITEM_REF_SKU_DATA_NODE_REF =
            "ON item.item_ref=sku.item_ref WHERE item.data_node_ref=? AND item.brand_ref=? AND ";
    public static final String CATALOG_ITEM_SERVICE_SKU_PRODUCT_SKU_REF_ALTERNATE_A = "sku.product_sku_ref IN (";
    public static final String CATALOG_ITEM_SERVICE_CTE_SELECTED_ITEM_REF_CATEGORY_REF_RELATION =
            "WITH RECURSIVE selected(item_ref,category_ref) AS (SELECT relation.item_ref,relation.category_ref ";
    public static final String CATALOG_ITEM_SERVICE_FROM_CLAUSE_CATALOG_CATEGORY_RELATION_CATEGORY =
            "FROM catalog.catalog_item_category relation JOIN catalog.catalog_category category ";
    public static final String CATALOG_ITEM_SERVICE_JOIN_CONDITION_CATEGORY_CATEGORY_REF_RELATION_ITEM_REF =
            "ON category.category_ref=relation.category_ref WHERE relation.item_ref IN (";
    public static final String CATALOG_ITEM_SERVICE_CLOSE_PAREN_CATEGORY_DATA_NODE_REF_BRAND_REF =
            ") AND category.data_node_ref=? AND category.brand_ref=? ";
    public static final String CATALOG_ITEM_SERVICE_CONDITION_CATEGORY_STATUS_VOIDED =
            "AND category.status <> 'VOIDED'), ";
    public static final String CATALOG_ITEM_SERVICE_CATEGORY_PATHS_LEAF_REF_CATEGORY_REF_PARENT_CATEGORY_REF =
            "category_paths(leaf_ref,category_ref,parent_category_ref,path_nodes) AS (";
    public static final String CATALOG_ITEM_SERVICE_SELECT_CATEGORY_CATEGORY_REF_PARENT_CATEGORY_REF =
            "SELECT category.category_ref,category.category_ref,category.parent_category_ref,";
    public static final String CATALOG_ITEM_SERVICE_JSONB_BUILD_ARRAY_JSONB_BUILD_OBJECT_CATEGORY_REF_CATEGORY =
            "jsonb_build_array(jsonb_build_object('categoryRef',category.category_ref::text,";
    public static final String CATALOG_ITEM_SERVICE_CODE_CATEGORY_NAME = "'code',category.code,'name',category.name)) ";
    public static final String CATALOG_ITEM_SERVICE_FROM_CLAUSE_CATALOG_CATEGORY_CATEGORY =
            "FROM selected JOIN catalog.catalog_category category ";
    public static final String CATALOG_ITEM_SERVICE_JOIN_CONDITION_CATEGORY_CATEGORY_REF_SELECTED =
            "ON category.category_ref=selected.category_ref ";
    public static final String CATALOG_ITEM_SERVICE_UNION_PATHS_LEAF_REF_PARENT_CATEGORY_REF =
            "UNION ALL SELECT paths.leaf_ref,parent.category_ref,parent.parent_category_ref,";
    public static final String CATALOG_ITEM_SERVICE_JSONB_BUILD_ARRAY_JSONB_BUILD_OBJECT_CATEGORY_REF_PARENT =
            "jsonb_build_array(jsonb_build_object('categoryRef',parent.category_ref::text,";
    public static final String CATALOG_ITEM_SERVICE_CODE_PARENT_NAME_PATHS =
            "'code',parent.code,'name',parent.name)) || paths.path_nodes ";
    public static final String CATALOG_ITEM_SERVICE_FROM_CLAUSE_CATEGORY_PATHS_PATHS = "FROM category_paths paths ";
    public static final String CATALOG_ITEM_SERVICE_JOIN_CATALOG_CATEGORY_PARENT_DATA_NODE_REF_BRAND_REF =
            "JOIN catalog.catalog_category parent ON parent.data_node_ref=? AND parent.brand_ref=? ";
    public static final String CATALOG_ITEM_SERVICE_CONDITION_PARENT_CATEGORY_REF_PATHS_PARENT_CATEGORY_REF =
            "AND parent.category_ref=paths.parent_category_ref AND parent.status <> 'VOIDED') ";
    public static final String CATALOG_ITEM_SERVICE_SELECT_SELECTED_ITEM_REF_CATEGORY_REF_PATHS_PATH_NODES =
            "SELECT selected.item_ref,selected.category_ref,paths.path_nodes FROM selected ";
    public static final String CATALOG_ITEM_SERVICE_CATEGORY_PATHS_PATHS_LEAF_REF_SELECTED_CATEGORY_REF =
            "LEFT JOIN category_paths paths ON paths.leaf_ref=selected.category_ref ";
    public static final String CATALOG_ITEM_SERVICE_CONDITION_PATHS_PARENT_CATEGORY_REF =
            "AND paths.parent_category_ref IS NULL";
    public static final String CATALOG_ITEM_SERVICE_SELECT_ALTERNATE_A = "SELECT ";

    public static final String CATALOG_ITEM_SERVICE_BRAND_REF = "brand_ref=? ";
    public static final String CATALOG_ITEM_SERVICE_CONDITION_CODE = "AND code IN (";
    public static final String CATALOG_ITEM_SERVICE_SELECT_ALTERNATE_B = "SELECT";
    public static final String CATALOG_ITEM_SERVICE_ITEM_REF_CODE_NAME_SHORT_NAME_ALTERNATE_B =
            " item_ref,code,name,short_name,shape_key,status,sections::text,version,";
    public static final String CATALOG_ITEM_SERVICE_UPDATE_UPDATED_AT_EPOCH_MILLIS_SOURCE_SCOPE_REF_ALTERNATE_A =
            "updated_at_epoch_millis,source_scope_ref";
    public static final String CATALOG_ITEM_SERVICE_FROM_CLAUSE_CATALOG_ITEM_DATA_NODE_REF_BRAND_REF_CODE =
            " FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=? AND code IN (";
    public static final String CATALOG_ITEM_SERVICE_SELECT_ALTERNATE_C = "SELECT ";
    public static final String CATALOG_ITEM_SERVICE_PRODUCT_IDENTIFIER_ITEM_REF =
            "EXISTS (SELECT 1 FROM catalog.product_identifier WHERE item_ref=?),";
    public static final String CATALOG_ITEM_SERVICE_CATALOG_ITEM_ITEM_REF_PREPARATION_PROFILE =
            "EXISTS (SELECT 1 FROM catalog.catalog_item WHERE item_ref=? AND preparation_profile IS NOT NULL),";
    public static final String CATALOG_ITEM_SERVICE_CATALOG_SKU_ITEM_REF_PREPARATION_OVERRIDE =
            "EXISTS (SELECT 1 FROM catalog.catalog_sku WHERE item_ref=? AND preparation_override IS NOT NULL),";
    public static final String CATALOG_ITEM_SERVICE_CATALOG_SKU_MEDIA_SKU =
            "EXISTS (SELECT 1 FROM catalog.catalog_sku_media media JOIN catalog.catalog_sku sku ON ";
    public static final String CATALOG_ITEM_SERVICE_SKU_PRODUCT_SKU_REF_MEDIA_ITEM_REF =
            "sku.product_sku_ref=media.product_sku_ref WHERE sku.item_ref=?),";
    public static final String CATALOG_ITEM_SERVICE_CATALOG_ITEM_CATEGORY_ITEM_REF =
            "EXISTS (SELECT 1 FROM catalog.catalog_item_category WHERE item_ref=?),";
    public static final String CATALOG_ITEM_SERVICE_CATALOG_COMPOSITE_GROUP_ITEM_REF =
            "EXISTS (SELECT 1 FROM catalog.catalog_composite_group WHERE item_ref=?),";
    public static final String CATALOG_ITEM_SERVICE_CATALOG_ITEM_ATTRIBUTE_ASSIGNMENT_ITEM_REF =
            "EXISTS (SELECT 1 FROM catalog.catalog_item_attribute_assignment WHERE item_ref=?),";
    public static final String CATALOG_ITEM_SERVICE_CATALOG_ITEM_ORDER_OPTION_CONFIG_ITEM_REF =
            "EXISTS (SELECT 1 FROM catalog.catalog_item_order_option_config WHERE item_ref=?),";
    public static final String CATALOG_ITEM_SERVICE_CATALOG_ITEM_ORDER_OPTION_VALUE_OV_OVERRIDE =
            "EXISTS (SELECT 1 FROM catalog.catalog_item_order_option_value_override override JOIN ";
    public static final String CATALOG_ITEM_SERVICE_CATALOG_ITEM_ORDER_OPTION_CONFIG_CONFIG =
            "catalog.catalog_item_order_option_config config ON ";
    public static final String CATALOG_ITEM_SERVICE_CONFIG_ITEM_ORDER_OPTION_CONFIG_REF_OVERRIDE =
            "config.item_order_option_config_ref=override.item_order_option_config_ref ";
    public static final String CATALOG_ITEM_SERVICE_WHERE_CONFIG_ITEM_REF_OVERRIDE_PREPARATION_EFFECT =
            "WHERE config.item_ref=? AND override.preparation_effect IS NOT NULL),";
    public static final String CATALOG_ITEM_SERVICE_CATALOG_SKU_VARIANT_AXIS_ITEM_REF =
            "EXISTS (SELECT 1 FROM catalog.catalog_sku_variant_axis WHERE item_ref=?),";
    public static final String CATALOG_ITEM_SERVICE_CATALOG_ITEM_IMAGE_ITEM_REF =
            "EXISTS (SELECT 1 FROM catalog.catalog_item_image WHERE item_ref=?),";
    public static final String CATALOG_ITEM_SERVICE_CATALOG_ITEM_REFERENCE_ITEM_REF =
            "EXISTS (SELECT 1 FROM catalog.catalog_item_reference WHERE item_ref=?)";
    public static final String CATALOG_ITEM_SERVICE_SELECT_ITEM_REF_SALES_UNIT_REF_SALES_UNIT_CODE_SALES_UNIT_NAME =
            "SELECT item_ref,sales_unit_ref,sales_unit_code,sales_unit_name,sales_unit_dimension,sales_unit_pre";

    public static final String CATALOG_ITEM_SERVICE_FROM_CLAUSE_CATALOG_ITEM_ITEM_REF =
            "FROM catalog.catalog_item WHERE item_ref IN (";
    public static final String SELECT_CAT_ITEM_SALES_UNIT_003 =
            ("SELECT sales_unit_ref FROM catalog.catalog_item WHERE data_node_ref=? AN"
                    + "D brand_ref=? AND item_ref=? ");
    public static final String CATALOG_ITEM_SERVICE_CONDITION_CATALOG_ITEM_SALES_UNIT_REF_BASE_MEASURE_UNIT_REF =
            "AND sales_unit_ref IS NOT NULL UNION SELECT base_measure_unit_ref FROM catalog.catalog_item ";
    public static final String CATALOG_ITEM_SERVICE_WHERE_DATA_NODE_REF_BRAND_REF_ITEM_REF_BASE_MEASURE_UNIT_REF =
            "WHERE data_node_ref=? AND brand_ref=? AND item_ref=? AND base_measure_unit_ref IS NOT NULL ";
    public static final String CATALOG_ITEM_SERVICE_UNION_CATALOG_SKU_SKU_SALES_UNIT_OVERRIDE_REF_ITEM_REF =
            "UNION SELECT sku.sales_unit_override_ref FROM catalog.catalog_sku sku WHERE sku.item_ref=? ";
    public static final String CONDITION_SKU_SALES_UNIT_OVERRIDE_004 =
            "AND sku.sales_unit_override_ref IS NOT NULL UNION SELECT sku.base_measure_unit_override_ref ";
    public static final String CATALOG_ITEM_SERVICE_FROM_CLAUSE_CATALOG_SKU_SKU_ITEM_REF =
            "FROM catalog.catalog_sku sku WHERE sku.item_ref=? ";
    public static final String CATALOG_ITEM_SERVICE_CONDITION_SKU_BASE_MEASURE_UNIT_OVERRIDE_REF =
            "AND sku.base_measure_unit_override_ref IS NOT NULL";
    public static final String CATALOG_ITEM_SERVICE_SELECT_COMMAND_RECEIPT_OPERATION_ID_REQUEST_HASH_RESPONSE_TEXT =
            "SELECT operation_id,request_hash,response_json::text FROM catalog.command_receipt WHERE data_node_ref=? ";
    public static final String CATALOG_ITEM_SERVICE_CONDITION_IDEMPOTENCY_KEY = "AND idempotency_key=?";
    public static final String CATALOG_ITEM_SERVICE_INSERT_INTO = "INSERT INTO ";
    public static final String CATALOG_ITEM_SERVICE_COMMAND_RECEIPT_RECEIPT_REF_DATA_NODE_REF_IDEMPOTENCY_KEY =
            "catalog.command_receipt(receipt_ref,data_node_ref,idempotency_key,operation_id,request_hash,";

    public static final String CATALOG_ITEM_SERVICE_JOIN_CONDITION_ONSE_CREATED_AT_EPOCH_MILLIS =
            "onse,created_at_epoch_millis) VALUES(?,?,?,?,?,CAST(? AS JSONB),?)";
    public static final String CATALOG_ITEM_SERVICE_SELECT_CATALOG_ITEM_VERSION_DATA_NODE_REF_BRAND_REF =
            "SELECT COALESCE(MAX(version),0) FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=?";
    public static final String CATALOG_ITEM_SERVICE_ITEM_REF = "item_ref IN (";
    public static final String CATALOG_ITEM_SERVICE_CLOSE_PAREN_ALTERNATE_B = ")";
    public static final String CATALOG_ITEM_SERVICE_CLOSE_PAREN_ITEM_STATUS_VOIDED_SKU =
            ") AND item.status <> 'VOIDED' AND sku.status <> 'VOIDED' ORDER BY ";
    public static final String CATALOG_ITEM_SERVICE_ITEM_CODE_SKU_DISPLAY_ORDER =
            "item.code,sku.display_order,sku.sku_code";
    public static final String CATALOG_ITEM_SERVICE_CLOSE_PAREN_ALTERNATE_C = "), ";
    public static final String CATALOG_ITEM_SERVICE_MATCHING_AGGREGATE_TOTAL_PAGED =
            "aggregate AS (SELECT COUNT(*) AS total FROM matching), paged AS (SELECT * FROM matching";
    public static final String CATALOG_ITEM_SERVICE_CLOSE_PAREN_STATUS_VOIDED_CATEGORY_REF =
            ") AND status <> 'VOIDED' ORDER BY category_ref FOR UPDATE";
    public static final String CATALOG_ITEM_SERVICE_CLOSE_PAREN_CATEGORY_REF = ") ORDER BY category_ref FOR UPDATE";
    public static final String CATALOG_ITEM_SERVICE_CLOSE_PAREN_DICTIONARY_KIND_ENTRY_REF =
            ") ORDER BY dictionary_kind,entry_ref FOR UPDATE";
    public static final String CATALOG_ITEM_SERVICE_CLOSE_PAREN_ITEM_REF_KEY_SHARE =
            ") ORDER BY item_ref FOR KEY SHARE";
    public static final String CATALOG_ITEM_SERVICE_CLOSE_PAREN_SKU_PRODUCT_SKU_REF_KEY_SHARE =
            ") ORDER BY sku.product_sku_ref FOR KEY SHARE OF sku,item";
    public static final String CATALOG_ITEM_SERVICE_CLOSE_PAREN_STATUS_VOIDED_CODE =
            ") AND status <> 'VOIDED' ORDER BY code";
    public static final String CATALOG_ITEM_SERVICE_CLOSE_PAREN_CODE = ") ORDER BY code";
    public static final String CATALOG_ITEM_SERVICE_SELECT_ALTERNATE_D = "SELECT ";
    public static final String CATALOG_ITEM_SERVICE_CATALOG_SKU_ITEM_REF =
            "EXISTS (SELECT 1 FROM catalog.catalog_sku WHERE item_ref IN (";
    public static final String CATALOG_ITEM_SERVICE_CLOSE_PAREN_STATUS_VOIDED = ") AND status <> 'VOIDED'),";
    public static final String CATALOG_ITEM_SERVICE_CATALOG_ITEM_CATEGORY_ITEM_REF_ALTERNATE_A =
            "EXISTS (SELECT 1 FROM catalog.catalog_item_category WHERE item_ref IN (";
    public static final String CATALOG_ITEM_SERVICE_CLOSE_PAREN_ALTERNATE_D = ")),";
    public static final String CATALOG_ITEM_SERVICE_CATALOG_COMPOSITE_GROUP_ITEM_REF_ALTERNATE_A =
            "EXISTS (SELECT 1 FROM catalog.catalog_composite_group WHERE item_ref IN (";
    public static final String CATALOG_ITEM_SERVICE_CLOSE_PAREN_ALTERNATE_E = ")),";
    public static final String CATALOG_ITEM_SERVICE_CATALOG_ITEM_ATTRIBUTE_ASSIGNMENT_ITEM_REF_ALTERNATE_A =
            "EXISTS (SELECT 1 FROM catalog.catalog_item_attribute_assignment WHERE item_ref IN (";
    public static final String CATALOG_ITEM_SERVICE_CLOSE_PAREN_ALTERNATE_F = ")),";
    public static final String CATALOG_ITEM_SERVICE_CATALOG_ITEM_ORDER_OPTION_CONFIG_ITEM_REF_ALTERNATE_A =
            "EXISTS (SELECT 1 FROM catalog.catalog_item_order_option_config WHERE item_ref IN (";
    public static final String CATALOG_ITEM_SERVICE_CLOSE_PAREN_ALTERNATE_G = ")),";
    public static final String CATALOG_ITEM_SERVICE_CATALOG_SKU_VARIANT_AXIS_ITEM_REF_ALTERNATE_A =
            "EXISTS (SELECT 1 FROM catalog.catalog_sku_variant_axis WHERE item_ref IN (";
    public static final String CATALOG_ITEM_SERVICE_CLOSE_PAREN_ALTERNATE_H = ")),";
    public static final String CATALOG_ITEM_SERVICE_CATALOG_ITEM_IMAGE_ITEM_REF_ALTERNATE_A =
            "EXISTS (SELECT 1 FROM catalog.catalog_item_image WHERE item_ref IN (";
    public static final String CATALOG_ITEM_SERVICE_CLOSE_PAREN_ALTERNATE_I = ")),";
    public static final String CATALOG_ITEM_SERVICE_CATALOG_ITEM_REFERENCE_ITEM_REF_ALTERNATE_A =
            "EXISTS (SELECT 1 FROM catalog.catalog_item_reference WHERE item_ref IN (";
    public static final String CATALOG_ITEM_SERVICE_CLOSE_PAREN_ALTERNATE_J = "))";
    public static final String CATALOG_ITEM_SERVICE_CLOSE_PAREN_ALTERNATE_K = ")";
    public static final String BATCH_STATUS_SCOPE_PREDICATE = "data_node_ref=? AND brand_ref=? AND ";
    public static final String UPDATE_CAT_ITEM_SET_SALES_005 =
            """
    UPDATE catalog.catalog_item SET sales_unit_ref=?,sales_unit_code=?\
    ,sales_unit_name=?,sales_unit_dimension=?,sales_unit_precision=?,""";
    public static final String BASE_MEAS_UNIT_REF_BASE_006 =
            """
    base_measure_unit_ref=?,base_measure_unit_code=?,base_measure_unit\
    _name=?,base_measure_unit_dimension=?,base_measure_unit_precision=\
    ? WHERE item_ref=?""";
    public static final String SALES_UNIT_REF_SALES_UNIT_007 =
            """
    \ssales_unit_ref=?,sales_unit_code=?,sales_unit_name=?,sales_unit_dimension=?,sales_unit_precision=?,""";
    public static final String SRC_ITEM_CODE_SRC_SCOPE_008 =
            """
    source_item_code,source_scope_ref,version,created_at_epoch_millis,updated_at_epoch_millis)\s""";
    public static final String ITEM_REF_CODE_NAME_SHORT_009 =
            """
    item_ref,code,name,short_name,shape_key,status,sections::text,vers\
    ion,updated_at_epoch_millis,source_scope_ref FROM catalog.catalog_\
    item WHERE data_node_ref=? AND\s""";
    public static final String SELECT_ITEM_REF_SALES_UNIT_010 =
            """
    SELECT item_ref,sales_unit_ref,sales_unit_code,sales_unit_name,sales_unit_dimension,sales_unit_precision,""";
    public static final String BASE_MEAS_UNIT_REF_BASE_011 =
            """
    base_measure_unit_ref,base_measure_unit_code,base_measure_unit_nam\
    e,base_measure_unit_dimension,base_measure_unit_precision\s""";
    public static final String RESP_CREATED_AT_EPOCH_MS_012 =
            """
    response_json,created_at_epoch_millis) VALUES(?,?,?,?,?,CAST(? AS JSONB),?)""";
}
