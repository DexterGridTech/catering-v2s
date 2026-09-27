package com.catering.v2s.salesmenu.application.persistence;

/** SQL text fragments owned by SalesMenuItemService; B3 relocates text only and does not change execution. */
public final class SalesMenuItemServiceSql {
    public static final String VALUE_SEPARATOR = ",";
    public static final String PARAMETER_PLACEHOLDER = "?";
    public static final String SALES_VERSION_ITEM_TABLE = "sales_menu.sales_version_item";
    public static final String SALES_ITEM_REF_COLUMN = "sales_item_ref";
    public static final String SQL_CLOSE_PAREN = ")";
    public static final String DRAFT_ITEM_VALUE_TUPLE = "(?,?,?)";
    public static final String VERSION_ITEM_VALUE_TUPLE =
            "(CAST(? AS uuid),CAST(? AS text),CAST(? AS text),CAST(? AS text),CAST(? AS bigint))";
    public static final String ADJACENCY_LESS_SUFFIX = " < ?))";
    public static final String ADJACENCY_GREATER_SUFFIX = " > ?))";
    public static final String SELECT_PREFIX = "SELECT ";
    public static final String DISPLAY_ORDER_PROJECTION = ",display_order FROM ";
    public static final String UPDATE_PREFIX = "UPDATE ";
    public static final String DISPLAY_ORDER_DESC_LOCK_SUFFIX = " DESC LIMIT 1 FOR UPDATE";
    public static final String DISPLAY_ORDER_ASC_LOCK_SUFFIX = " ASC LIMIT 1 FOR UPDATE";
    public static final String UPDATE_SALES_VER_ITEM_DISP_001 =
            "UPDATE sales_menu.sales_version_item SET display_name_override=?,listed_price_cents=?,";
    public static final String SALES_MENU_ITEM_SERVICE_RESOLVED_ITEM_NAME_RESOLVED_ITEM_CODE_RESOLVED_PRODUCT_SHAPE =
            "resolved_item_name=?,resolved_item_code=?,resolved_product_shape=?,";
    public static final String SALES_MENU_ITEM_SERVICE_RESOLVED_SALES_UNIT_REF_RESOLVED_SALES_UNIT_CODE =
            "resolved_sales_unit_ref=NULL,resolved_sales_unit_code=NULL,";
    public static final String SALES_MENU_ITEM_SERVICE_RESOLVED_SALES_UNIT_NAME_RESOLVED_SALES_UNIT_DIMENSION =
            "resolved_sales_unit_name=NULL,resolved_sales_unit_dimension=NULL,";
    public static final String SALES_MENU_ITEM_SERVICE_RESOLVED_SALES_UNIT_PRECISION =
            "resolved_sales_unit_precision=NULL,";
    public static final String ALT_ORDERING_CONSTRAINTS_JSON_DISP_002 =
            "ordering_constraints_json=?::jsonb,display_media_mode=?,version=version+1 ";
    public static final String SALES_MENU_ITEM_SERVICE_WHERE_VERSION_REF_SALES_ITEM_REF =
            "WHERE version_ref=? AND sales_item_ref=?";
    public static final String SALES_MENU_ITEM_SERVICE_DELETE_SALES_VERSION_ITEM_SKU_VERSION_REF_SALES_ITEM_REF =
            "DELETE FROM sales_menu.sales_version_item_sku WHERE version_ref=? AND sales_item_ref=?";
    public static final String INSERT_INTO_SALES_VER_ITEM_003 =
            "INSERT INTO sales_menu.sales_version_item_sku(version_ref,sales_item_ref,sku_ref,";
    public static final String SALES_MENU_ITEM_SERVICE_LISTED_PRICE_CENTS =
            "listed_price_cents,resolved_sku_code,resolved_sku_name,default_price_cents,";
    public static final String SALES_MENU_ITEM_SERVICE_DISPLAY_ORDER = "display_order) VALUES(?,?,?,?,?,?,?,?)";
    public static final String
            SALES_MENU_ITEM_SERVICE_DELETE_SALES_VERSION_ITEM_SKU_VERSION_REF_SALES_ITEM_REF_ALTERNATE_A =
                    "DELETE FROM sales_menu.sales_version_item_sku WHERE version_ref=? AND sales_item_ref=?";
    public static final String DELETE_SALES_VER_ITEM_ORD_004 =
            "DELETE FROM sales_menu.sales_version_item_order_option_value ";
    public static final String SALES_MENU_ITEM_SERVICE_WHERE_VERSION_REF_SALES_ITEM_REF_ALTERNATE_A =
            "WHERE version_ref=? AND sales_item_ref=?";
    public static final String SALES_MENU_ITEM_SERVICE_DELETE_SALES_VERSION_ITEM_ORDER_OPTION_VERSION_REF =
            "DELETE FROM sales_menu.sales_version_item_order_option WHERE version_ref=? ";
    public static final String SALES_MENU_ITEM_SERVICE_CONDITION_SALES_ITEM_REF = "AND sales_item_ref=?";
    public static final String SALES_MENU_ITEM_SERVICE_DELETE_SALES_VERSION_ITEM_MEDIA_VERSION_REF_SALES_ITEM_REF =
            "DELETE FROM sales_menu.sales_version_item_media WHERE version_ref=? AND sales_item_ref=?";
    public static final String SALES_MENU_ITEM_SERVICE_DELETE_SALES_VERSION_ITEM_VERSION_REF_SALES_ITEM_REF =
            "DELETE FROM sales_menu.sales_version_item WHERE version_ref=? AND sales_item_ref=?";
    public static final String SALES_MENU_ITEM_SERVICE_SELECT_SALES_VERSION_ITEM_VERSION =
            "SELECT version FROM sales_menu.sales_version_item ";
    public static final String SALES_MENU_ITEM_SERVICE_WHERE_VERSION_REF_CURRENT_DRAFT_VERSION_REF =
            "WHERE version_ref=(SELECT current_draft_version_ref ";
    public static final String SALES_MENU_ITEM_SERVICE_FROM_CLAUSE_SALES_COLLECTION_COLLECTION_REF =
            "FROM sales_menu.sales_collection WHERE collection_ref=?) ";
    public static final String SALES_MENU_ITEM_SERVICE_CONDITION_SALES_ITEM_REF_ALTERNATE_A = "AND sales_item_ref=?";
    public static final String SALES_MENU_ITEM_SERVICE_SELECT_SALES_ITEM_COLLECTION_REF_SALES_ITEM_REF =
            "SELECT 1 FROM sales_menu.sales_item WHERE collection_ref=? AND sales_item_ref=?";
    public static final String SALES_MENU_ITEM_SERVICE_SELECT_REQUEST_HASH_STATUS_READBACK_JSON_TEXT =
            "SELECT request_hash,status,response_json::text readback_json ";
    public static final String SALES_MENU_ITEM_SERVICE_FROM_CLAUSE_SALES_COMMAND_RECEIPT_FROM_SALES_MENU_SALES_COMMAN =
            "FROM sales_menu.sales_command_receipt ";
    public static final String SALES_MENU_ITEM_SERVICE_WHERE_WORKSPACE_UUID_OPERATION_ID_IDEMPOTENCY_KEY =
            "WHERE workspace_uuid=? AND operation_id=? AND idempotency_key=?";
    public static final String SALES_MENU_ITEM_SERVICE_INSERT_INTO_SALES_COMMAND_RECEIPT =
            "INSERT INTO sales_menu.sales_command_receipt(receipt_ref,workspace_uuid,group_workspace_key,";

    public static final String SALES_MENU_ITEM_SERVICE_VALUES_VALUES_JSONB = "VALUES(?,?,?,?,?,?,? ,?::jsonb,?) ";
    public static final String SALES_MENU_ITEM_SERVICE_JOIN_CONDITION_WORKSPACE_UUID_OPERATION_ID_IDEMPOTENCY_KEY =
            "ON CONFLICT (workspace_uuid,operation_id,idempotency_key) DO NOTHING";
    public static final String SALES_MENU_ITEM_SERVICE_SELECT_REQUEST_HASH_STATUS_READBACK_JSON_TEXT_ALTERNATE_A =
            "SELECT request_hash,status,response_json::text readback_json ";
    public static final String
            SALES_MENU_ITEM_SERVICE_FROM_CLAUSE_SALES_COMMAND_RECEIPT_FROM_SALES_MENU_SALES_COMMAN_ALTERNATE_A =
                    "FROM sales_menu.sales_command_receipt ";
    public static final String SALES_MENU_ITEM_SERVICE_WHERE_WORKSPACE_UUID_OPERATION_ID_IDEMPOTENCY_KEY_ALTERNATE_A =
            "WHERE workspace_uuid=? AND operation_id=? AND idempotency_key=?";
    public static final String INSERT_INTO_SALES_ITEM_SALES_005 =
            "INSERT INTO sales_menu.sales_item(sales_item_ref,collection_ref,catalog_item_ref) VALUES ";
    public static final String SALES_MENU_ITEM_SERVICE_CTE_INPUT_SALES_ITEM_REF_RESOLVED_ITEM_NAME_RESOLVED_ITEM_CODE =
            "WITH input(sales_item_ref,resolved_item_name,resolved_item_code,resolved_product_shape,ordinal) AS ";
    public static final String SALES_MENU_ITEM_SERVICE_OPEN_PAREN = "(VALUES ";
    public static final String SALES_MENU_ITEM_SERVICE_CLOSE_PAREN_BASE_DISPLAY_ORDER_START_ORDER =
            "), base AS (SELECT COALESCE(MAX(display_order)+1,0) AS start_order ";
    public static final String SALES_MENU_ITEM_SERVICE_FROM_CLAUSE_SALES_VERSION_ITEM_VERSION_REF_SECTION_REF =
            "FROM sales_menu.sales_version_item WHERE version_ref=? AND section_ref=?) ";
    public static final String INSERT_INTO_SALES_VER_ITEM_006 =
            "INSERT INTO sales_menu.sales_version_item(version_ref,sales_item_ref,section_ref,";
    public static final String SALES_MENU_ITEM_SERVICE_COLLECTION_REF =
            "collection_ref,display_order,resolved_item_name,resolved_item_code,resolved_product_shape,";
    public static final String ALT_ORDERING_CONSTRAINTS_JSON_DISP_ALT_A_007 =
            "ordering_constraints_json,display_media_mode,version) ";
    public static final String SALES_MENU_ITEM_SERVICE_SELECT_INPUT_SALES_ITEM_REF_BASE_START_ORDER =
            "SELECT ?,input.sales_item_ref,?,?,base.start_order+input.ordinal,";
    public static final String SALES_MENU_ITEM_SERVICE_INPUT =
            "input.resolved_item_name,input.resolved_item_code,input.resolved_product_shape,";
    public static final String SALES_MENU_ITEM_SERVICE_BASE_ORDINAL =
            "'{}'::jsonb,?,1 FROM input CROSS JOIN base ORDER BY input.ordinal";
    public static final String SALES_MENU_ITEM_SERVICE_CONDITION_DISPLAY_ORDER =
            " AND (display_order < ? OR (display_order = ? AND ";
    public static final String SALES_MENU_ITEM_SERVICE_CONDITION_DISPLAY_ORDER_ALTERNATE_A =
            " AND (display_order > ? OR (display_order = ? AND ";
    public static final String SALES_MENU_ITEM_SERVICE_ORDER_BY_DISPLAY_ORDER = " ORDER BY display_order DESC,";
    public static final String SALES_MENU_ITEM_SERVICE_ORDER_BY_DISPLAY_ORDER_ALTERNATE_A =
            " ORDER BY display_order ASC,";
    public static final String SALES_MENU_ITEM_SERVICE_CONDITION_SECTION_REF = " AND section_ref=?";
    public static final String SALES_MENU_ITEM_SERVICE_WHERE_VERSION_REF = " WHERE version_ref=?";
    public static final String SALES_MENU_ITEM_SERVICE_SELECT_DISPLAY_ORDER_VALUE =
            "SELECT COALESCE(max(display_order),0)+1 AS value FROM ";
    public static final String SALES_MENU_ITEM_SERVICE_WHERE_VERSION_REF_ALTERNATE_A = " WHERE version_ref=?";
    public static final String SALES_MENU_ITEM_SERVICE_SET_DISPLAY_ORDER_VERSION_REF =
            " SET display_order=? WHERE version_ref=? AND ";
    public static final String SALES_MENU_ITEM_SERVICE_SET_DISPLAY_ORDER_VERSION_REF_ALTERNATE_A =
            " SET display_order=? WHERE version_ref=? AND ";
    public static final String SALES_MENU_ITEM_SERVICE_SET_DISPLAY_ORDER_VERSION_REF_ALTERNATE_B =
            " SET display_order=? WHERE version_ref=? AND ";
    public static final String SALES_MENU_ITEM_SERVICE_CONDITION_DISPLAY_ORDER_ALTERNATE_B =
            " AND (v.display_order > ? OR ";
    public static final String SALES_MENU_ITEM_SERVICE_OPEN_PAREN_DISPLAY_ORDER_SALES_ITEM_REF =
            "(v.display_order = ? AND v.sales_item_ref > ?))";
    public static final String SALES_MENU_ITEM_SERVICE_SELECT_VERSION_REF_SALES_ITEM_REF_CATALOG_ITEM_REF_SECTION_REF =
            "SELECT v.version_ref,i.sales_item_ref,i.catalog_item_ref,v.section_ref,v.display_order,v.version,";
    public static final String SALES_MENU_ITEM_SERVICE_DISPLAY_NAME_OVERRIDE_RESOLVED_ITEM_NAME_RESOLVED_ITEM_CODE =
            "v.display_name_override,v.resolved_item_name,v.resolved_item_code,";
    public static final String SALES_MENU_ITEM_SERVICE_RESOLVED_PRODUCT_SHAPE =
            "v.resolved_product_shape,v.resolved_sales_unit_ref,v.resolved_sales_unit_code,";
    public static final String SALES_MENU_ITEM_SERVICE_RESOLVED_SALES_UNIT_NAME =
            "v.resolved_sales_unit_name,v.resolved_sales_unit_dimension,v.resolved_sales_unit_precision,";
    public static final String SALES_MENU_ITEM_SERVICE_LISTED_PRICE_CENTS_ALTERNATE_A = "v.listed_price_cents,";
    public static final String SALES_MENU_ITEM_SERVICE_ORDERING_CONSTRAINTS_JSON_TEXT_DISPLAY_MEDIA_MODE =
            "v.ordering_constraints_json::text ordering_constraints_json,v.display_media_mode,";
    public static final String SALES_MENU_ITEM_SERVICE_PUBLISHED_PRIMARY_IMAGE_ASSET_REF =
            "v.published_primary_image_asset_ref,";
    public static final String SALES_MENU_ITEM_SERVICE_PUBLISHED_CATALOG_IMAGE_ASSET_REFS_TEXT =
            "v.published_catalog_image_asset_refs::text published_catalog_image_asset_refs,";
    public static final String SALES_MENU_ITEM_SERVICE_SALES_VERSION_ITEM_PREVIOUS =
            "EXISTS (SELECT 1 FROM sales_menu.sales_version_item previous ";
    public static final String SALES_MENU_ITEM_SERVICE_WHERE_PREVIOUS_VERSION_REF_SECTION_REF =
            "WHERE previous.version_ref=v.version_ref AND previous.section_ref=v.section_ref AND ";
    public static final String SALES_MENU_ITEM_SERVICE_OPEN_PAREN_PREVIOUS_DISPLAY_ORDER =
            "(previous.display_order < v.display_order OR ";
    public static final String SALES_MENU_ITEM_SERVICE_OPEN_PAREN_PREVIOUS_DISPLAY_ORDER_ALTERNATE_A =
            "(previous.display_order=v.display_order AND ";
    public static final String SALES_MENU_ITEM_SERVICE_PREVIOUS_SALES_ITEM_REF_CAN_MOVE_UP =
            "previous.sales_item_ref < v.sales_item_ref))) can_move_up,";
    public static final String SALES_MENU_ITEM_SERVICE_SALES_VERSION_ITEM_NEXT_ITEM =
            "EXISTS (SELECT 1 FROM sales_menu.sales_version_item next_item ";
    public static final String SALES_MENU_ITEM_SERVICE_WHERE_NEXT_ITEM_VERSION_REF_SECTION_REF =
            "WHERE next_item.version_ref=v.version_ref AND next_item.section_ref=v.section_ref AND ";
    public static final String SALES_MENU_ITEM_SERVICE_OPEN_PAREN_NEXT_ITEM_DISPLAY_ORDER =
            "(next_item.display_order > v.display_order OR ";
    public static final String SALES_MENU_ITEM_SERVICE_OPEN_PAREN_NEXT_ITEM_DISPLAY_ORDER_ALTERNATE_A =
            "(next_item.display_order=v.display_order AND ";
    public static final String SALES_MENU_ITEM_SERVICE_NEXT_ITEM_SALES_ITEM_REF_CAN_MOVE_DOWN =
            "next_item.sales_item_ref > v.sales_item_ref))) can_move_down ";
    public static final String SALES_MENU_ITEM_SERVICE_FROM_CLAUSE_SALES_ITEM_FROM_SALES_MENU_SALES_VERSIO =
            "FROM sales_menu.sales_version_item v JOIN sales_menu.sales_item i ";
    public static final String SALES_MENU_ITEM_SERVICE_JOIN_CONDITION_SALES_ITEM_REF_VERSION_REF_SECTION_REF =
            "ON i.sales_item_ref=v.sales_item_ref WHERE v.version_ref=? AND v.section_ref=?";
    public static final String SALES_MENU_ITEM_SERVICE_ORDER_BY_DISPLAY_ORDER_SALES_ITEM_REF =
            " ORDER BY v.display_order,v.sales_item_ref LIMIT ?";
    public static final String SELECT_VER_REF_SALES_ITEM_ALT_A_008 =
            "SELECT v.version_ref,i.sales_item_ref,i.catalog_item_ref,v.section_ref,v.display_order,v.version,";
    public static final String DISP_NAME_OVERRIDE_RESOLVED_ITEM_ALT_A_009 =
            "v.display_name_override,v.resolved_item_name,v.resolved_item_code,";
    public static final String SALES_MENU_ITEM_SERVICE_RESOLVED_PRODUCT_SHAPE_ALTERNATE_A =
            "v.resolved_product_shape,v.resolved_sales_unit_ref,v.resolved_sales_unit_code,";
    public static final String SALES_MENU_ITEM_SERVICE_RESOLVED_SALES_UNIT_NAME_ALTERNATE_A =
            "v.resolved_sales_unit_name,v.resolved_sales_unit_dimension,v.resolved_sales_unit_precision,";
    public static final String SALES_MENU_ITEM_SERVICE_LISTED_PRICE_CENTS_ALTERNATE_B = "v.listed_price_cents,";
    public static final String SALES_MENU_ITEM_SERVICE_ORDERING_CONSTRAINTS_JSON_TEXT_DISPLAY_MEDIA_MODE_ALTERNATE_A =
            "v.ordering_constraints_json::text ordering_constraints_json,v.display_media_mode,";
    public static final String SALES_MENU_ITEM_SERVICE_PUBLISHED_PRIMARY_IMAGE_ASSET_REF_ALTERNATE_A =
            "v.published_primary_image_asset_ref,";
    public static final String SALES_MENU_ITEM_SERVICE_PUBLISHED_CATALOG_IMAGE_ASSET_REFS_TEXT_ALTERNATE_A =
            "v.published_catalog_image_asset_refs::text published_catalog_image_asset_refs,";
    public static final String SALES_MENU_ITEM_SERVICE_SALES_VERSION_ITEM_PREVIOUS_ALTERNATE_A =
            "EXISTS (SELECT 1 FROM sales_menu.sales_version_item previous ";
    public static final String SALES_MENU_ITEM_SERVICE_WHERE_PREVIOUS_VERSION_REF_SECTION_REF_ALTERNATE_A =
            "WHERE previous.version_ref=v.version_ref AND previous.section_ref=v.section_ref AND ";
    public static final String SALES_MENU_ITEM_SERVICE_OPEN_PAREN_PREVIOUS_DISPLAY_ORDER_ALTERNATE_B =
            "(previous.display_order < v.display_order OR ";
    public static final String SALES_MENU_ITEM_SERVICE_OPEN_PAREN_PREVIOUS_DISPLAY_ORDER_ALTERNATE_C =
            "(previous.display_order=v.display_order AND ";
    public static final String SALES_MENU_ITEM_SERVICE_PREVIOUS_SALES_ITEM_REF_CAN_MOVE_UP_ALTERNATE_A =
            "previous.sales_item_ref < v.sales_item_ref))) can_move_up,";
    public static final String SALES_MENU_ITEM_SERVICE_SALES_VERSION_ITEM_NEXT_ITEM_ALTERNATE_A =
            "EXISTS (SELECT 1 FROM sales_menu.sales_version_item next_item ";
    public static final String SALES_MENU_ITEM_SERVICE_WHERE_NEXT_ITEM_VERSION_REF_SECTION_REF_ALTERNATE_A =
            "WHERE next_item.version_ref=v.version_ref AND next_item.section_ref=v.section_ref AND ";
    public static final String SALES_MENU_ITEM_SERVICE_OPEN_PAREN_NEXT_ITEM_DISPLAY_ORDER_ALTERNATE_B =
            "(next_item.display_order > v.display_order OR ";
    public static final String SALES_MENU_ITEM_SERVICE_OPEN_PAREN_NEXT_ITEM_DISPLAY_ORDER_ALTERNATE_C =
            "(next_item.display_order=v.display_order AND ";
    public static final String SALES_MENU_ITEM_SERVICE_NEXT_ITEM_SALES_ITEM_REF_CAN_MOVE_DOWN_ALTERNATE_A =
            "next_item.sales_item_ref > v.sales_item_ref))) can_move_down ";
    public static final String SALES_MENU_ITEM_SERVICE_FROM_CLAUSE_SALES_ITEM_FROM_SALES_MENU_SALES_VERSIO_ALTERNATE_A =
            "FROM sales_menu.sales_version_item v JOIN sales_menu.sales_item i ";
    public static final String SALES_MENU_ITEM_SERVICE_JOIN_CONDITION_SALES_ITEM_REF_VERSION_REF =
            "ON i.sales_item_ref=v.sales_item_ref WHERE v.version_ref=?";
    public static final String SALES_MENU_ITEM_SERVICE_CONDITION_SECTION_REF_ALTERNATE_A = " AND v.section_ref=?";
    public static final String SALES_MENU_ITEM_SERVICE_CONDITION_SALES_ITEM_REF_ALTERNATE_B = " AND v.sales_item_ref=?";
    public static final String SALES_MENU_ITEM_SERVICE_ORDER_BY_SECTION_REF_DISPLAY_ORDER_SALES_ITEM_REF =
            " ORDER BY v.section_ref,v.display_order,v.sales_item_ref";
    public static final String SELECT_SALES_ITEM_REF_DEF_010 =
            "SELECT sales_item_ref,definition_ref,resolved_definition_name,selection_mode,required,";
    public static final String SALES_MENU_ITEM_SERVICE_MIN_SELECTION_COUNT_MAX_SELECTION_COUNT_DISPLAY_ORDER =
            "min_selection_count,max_selection_count,display_order ";
    public static final String SALES_MENU_ITEM_SERVICE_FROM_CLAUSE_SALES_VERSION_ITEM_ORDER_OPTION_VERSION_REF =
            "FROM sales_menu.sales_version_item_order_option WHERE version_ref=? ";
    public static final String SALES_MENU_ITEM_SERVICE_CONDITION_SALES_ITEM_REF_ALTERNATE_C = "AND sales_item_ref IN (";
    public static final String SALES_MENU_ITEM_SERVICE_CLOSE_PAREN = ") ";
    public static final String SALES_MENU_ITEM_SERVICE_ORDER_BY_SALES_ITEM_REF_DISPLAY_ORDER_DEFINITION_REF =
            "ORDER BY sales_item_ref,display_order,definition_ref";
    public static final String SALES_MENU_ITEM_SERVICE_SELECT_SALES_ITEM_REF =
            "SELECT sales_item_ref,definition_ref,definition_value_ref,resolved_value_name,display_order,";
    public static final String SALES_MENU_ITEM_SERVICE_DEFAULT_VALUE_EXTRA_PRICE = "default_value,extra_price ";
    public static final String SALES_MENU_ITEM_SERVICE_FROM_CLAUSE_SALES_VERSION_ITEM_ORDER_OPTION_VA_VERSION_REF =
            "FROM sales_menu.sales_version_item_order_option_value WHERE version_ref=? ";
    public static final String SALES_MENU_ITEM_SERVICE_CONDITION_SALES_ITEM_REF_ALTERNATE_D = "AND sales_item_ref IN (";
    public static final String SALES_MENU_ITEM_SERVICE_CLOSE_PAREN_ALTERNATE_A = ") ";
    public static final String ORD_BY_SALES_ITEM_REF_011 =
            "ORDER BY sales_item_ref,definition_ref,display_order,definition_value_ref";
    public static final String SELECT_SALES_ITEM_REF_SKU_012 =
            "SELECT sales_item_ref,sku_ref,listed_price_cents,resolved_sku_code,resolved_sku_name,";
    public static final String SALES_MENU_ITEM_SERVICE_SALES_VERSION_ITEM_SKU_DEFAULT_PRICE_CENTS_DISPLAY_ORDER =
            "default_price_cents,display_order FROM sales_menu.sales_version_item_sku ";
    public static final String SALES_MENU_ITEM_SERVICE_WHERE_VERSION_REF_SALES_ITEM_REF_ALTERNATE_B =
            "WHERE version_ref=? AND sales_item_ref IN (";
    public static final String SALES_MENU_ITEM_SERVICE_CLOSE_PAREN_ALTERNATE_B = ") ";
    public static final String SALES_MENU_ITEM_SERVICE_ORDER_BY_SALES_ITEM_REF_DISPLAY_ORDER_SKU_REF =
            "ORDER BY sales_item_ref,display_order,sku_ref";
    public static final String SALES_MENU_ITEM_SERVICE_SELECT_SALES_ITEM_REF_ASSET_REF_DISPLAY_ORDER =
            "SELECT sales_item_ref,asset_ref,display_order ";
    public static final String SALES_MENU_ITEM_SERVICE_FROM_CLAUSE_SALES_VERSION_ITEM_MEDIA_VERSION_REF =
            "FROM sales_menu.sales_version_item_media WHERE version_ref=? ";
    public static final String SALES_MENU_ITEM_SERVICE_CONDITION_SALES_ITEM_REF_ALTERNATE_E = "AND sales_item_ref IN (";
    public static final String SALES_MENU_ITEM_SERVICE_CLOSE_PAREN_ALTERNATE_C = ") ";
    public static final String SALES_MENU_ITEM_SERVICE_ORDER_BY_SALES_ITEM_REF_DISPLAY_ORDER_ASSET_REF =
            "ORDER BY sales_item_ref,display_order,asset_ref";
    public static final String SALES_MENU_ITEM_SERVICE_SELECT_SALES_ITEM_REF_TARGET_KIND_TARGET_REF_STATE =
            "SELECT sales_item_ref,target_kind,target_ref,state,reason,changed_at_epoch_millis,";
    public static final String SALES_MENU_ITEM_SERVICE_ACTOR_DISPLAY_SNAPSHOT = "actor_display_snapshot ";
    public static final String SALES_MENU_ITEM_SERVICE_FROM_CLAUSE_SALES_MANUAL_STATUS_CURRENT_CHANNEL_REF =
            "FROM sales_menu.sales_manual_status_current WHERE channel_ref=? ";
    public static final String SALES_MENU_ITEM_SERVICE_CONDITION_SALES_ITEM_REF_ALTERNATE_F = "AND sales_item_ref IN (";
    public static final String SALES_MENU_ITEM_SERVICE_SELECT_SALES_COLLECTION_CURRENT_DRAFT_VERSION_REF =
            "SELECT current_draft_version_ref FROM sales_menu.sales_collection ";
    public static final String SALES_MENU_ITEM_SERVICE_WHERE_COLLECTION_REF = "WHERE collection_ref=?";
    public static final String SALES_MENU_ITEM_SERVICE_UPDATE_SALES_COLLECTION_VERSION_REVISION =
            "UPDATE sales_menu.sales_collection_version SET revision=revision+1 ";
    public static final String SALES_MENU_ITEM_SERVICE_WHERE_VERSION_REF_KIND_DRAFT =
            "WHERE version_ref=? AND kind='DRAFT'";
    public static final String SALES_MENU_ITEM_SERVICE_SELECT_SALES_COLLECTION_LATEST_PUBLISHED_VERSION_REF =
            "SELECT latest_published_version_ref FROM sales_menu.sales_collection ";
    public static final String SALES_MENU_ITEM_SERVICE_WHERE_COLLECTION_REF_ALTERNATE_A = "WHERE collection_ref=?";
    public static final String
            SALES_MENU_ITEM_SERVICE_DELETE_SALES_VERSION_ITEM_MEDIA_VERSION_REF_SALES_ITEM_REF_ALTERNATE_A =
                    "DELETE FROM sales_menu.sales_version_item_media WHERE version_ref=? AND sales_item_ref=?";
    public static final String SALES_MENU_ITEM_SERVICE_INSERT_INTO_SALES_VERSION_ITEM_MEDIA_VERSION_REF_SALES_ITEM_REF =
            "INSERT INTO sales_menu.sales_version_item_media(version_ref,sales_item_ref,";
    public static final String SALES_MENU_ITEM_SERVICE_ASSET_REF_DISPLAY_ORDER =
            "asset_ref,display_order) VALUES(?,?,?,?)";
    public static final String
            SALES_MENU_ITEM_SERVICE_DELETE_SALES_VERSION_ITEM_ORDER_OPTION_VA_DELETE_FROM_SALES_MENU_SALES_ALTERNATE_A =
                    "DELETE FROM sales_menu.sales_version_item_order_option_value ";
    public static final String SALES_MENU_ITEM_SERVICE_WHERE_VERSION_REF_SALES_ITEM_REF_ALTERNATE_C =
            "WHERE version_ref=? AND sales_item_ref=?";
    public static final String
            SALES_MENU_ITEM_SERVICE_DELETE_SALES_VERSION_ITEM_ORDER_OPTION_VERSION_REF_SALES_ITEM_REF =
                    "DELETE FROM sales_menu.sales_version_item_order_option WHERE version_ref=? AND sales_item_ref=?";
    public static final String INSERT_INTO_SALES_VER_ITEM_013 =
            "INSERT INTO sales_menu.sales_version_item_order_option(version_ref,sales_item_ref,";
    public static final String SALES_MENU_ITEM_SERVICE_DEFINITION_REF_RESOLVED_DEFINITION_NAME_SELECTION_MODE_REQUIRED =
            "definition_ref,resolved_definition_name,selection_mode,required,min_selection_count,";
    public static final String SALES_MENU_ITEM_SERVICE_MAX_SELECTION_COUNT_DISPLAY_ORDER =
            "max_selection_count,display_order) VALUES(?,?,?,?,?,?,?,?,?)";
    public static final String INSERT_INTO_SALES_VER_ITEM_014 =
            "INSERT INTO sales_menu.sales_version_item_order_option_value(version_ref,sales_item_ref,";
    public static final String SALES_MENU_ITEM_SERVICE_DEFINITION_REF =
            "definition_ref,definition_value_ref,resolved_value_name,display_order,";
    public static final String SALES_MENU_ITEM_SERVICE_DEFAULT_VALUE_EXTRA_PRICE_ALTERNATE_A =
            "default_value,extra_price) VALUES(?,?,?,?,?,?,?,?)";
    public static final String SALES_MENU_ITEM_SERVICE_SELECT_SALES_VERSION_ITEM_CATALOG_ITEM_REF_ITEM_COUNT =
            "SELECT i.catalog_item_ref,COUNT(*) AS item_count FROM sales_menu.sales_version_item v ";
    public static final String SALES_MENU_ITEM_SERVICE_JOIN_SALES_ITEM_SALES_ITEM_REF =
            "JOIN sales_menu.sales_item i ON i.sales_item_ref=v.sales_item_ref ";
    public static final String SALES_MENU_ITEM_SERVICE_WHERE_COLLECTION_REF_VERSION_REF_CATALOG_ITEM_REF =
            "WHERE i.collection_ref=? AND v.version_ref=? AND i.catalog_item_ref IN (";
    public static final String COUNT_BY_ITEM_GROUP_SUFFIX = ") GROUP BY i.catalog_item_ref";
    public static final String SALES_MENU_ITEM_SERVICE_SELECT_SALES_VERSION_SECTION_SELECT_1_FROM_SALES_MENU_SAL =
            "SELECT 1 FROM sales_menu.sales_version_section ";
    public static final String SALES_MENU_ITEM_SERVICE_WHERE_COLLECTION_REF_VERSION_REF_SECTION_REF =
            "WHERE collection_ref=? AND version_ref=? AND section_ref=?";
    public static final String SALES_MENU_ITEM_SERVICE_SELECT_SALES_VERSION_ITEM_VERSION_REF_SALES_ITEM_REF =
            "SELECT 1 FROM sales_menu.sales_version_item WHERE version_ref=? AND sales_item_ref=?";
    public static final String SALES_MENU_ITEM_SERVICE_SELECT_SALES_VERSION_ITEM_SECTION_REF_DISPLAY_ORDER =
            "SELECT section_ref,display_order FROM sales_menu.sales_version_item ";
    public static final String SALES_MENU_ITEM_SERVICE_WHERE_VERSION_REF_SALES_ITEM_REF_ALTERNATE_D =
            "WHERE version_ref=? AND sales_item_ref=? FOR UPDATE";
    public static final String SALES_MENU_ITEM_SERVICE_INSERT_INTO_SALES_OPERATION_RECORD =
            "INSERT INTO sales_menu.sales_operation_record(record_ref,workspace_uuid,group_workspace_key,";
}
