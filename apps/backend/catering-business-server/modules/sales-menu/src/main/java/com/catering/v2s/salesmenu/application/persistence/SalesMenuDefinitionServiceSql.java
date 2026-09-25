package com.catering.v2s.salesmenu.application.persistence;

/** SQL text fragments owned by SalesMenuDefinitionService; B3 relocates text only and does not change execution. */
public final class SalesMenuDefinitionServiceSql {
    public static final String VALUE_SEPARATOR = ",";
    public static final String PARAMETER_PLACEHOLDER = "?";
    public static final String PLACEHOLDER_SEPARATOR = ",";
    public static final String SALES_MENU_DEFINITION_SERVICE_CONDITION_NAME_COLLECTION_REF =
            " AND (c.name > ? OR (c.name = ? AND c.collection_ref > ?))";
    public static final String
            SALES_MENU_DEFINITION_SERVICE_SELECT_COLLECTION_REF_STORE_REF_NAME_ARCHIVED_AT_EPOCH_MILLIS =
                    "SELECT c.collection_ref,c.store_ref,c.name,c.archived_at_epoch_millis,c.version,";
    public static final String SALES_MENU_DEFINITION_SERVICE_REVISION_DRAFT_REVISION = "d.revision draft_revision,";
    public static final String SALES_MENU_DEFINITION_SERVICE_REVISION_PUBLISHED_REVISION =
            "p.revision published_revision,";
    public static final String SALES_MENU_DEFINITION_SERVICE_PUBLICATION =
            "publication.source_draft_revision latest_published_source_draft_revision,";
    public static final String SALES_MENU_DEFINITION_SERVICE_SCHEDULE_KIND_SCHEDULE_START_LOCAL_TIME =
            "d.schedule_kind,d.schedule_start_local_time,";
    public static final String SALES_MENU_DEFINITION_SERVICE_SCHEDULE_END_LOCAL_TIME = "d.schedule_end_local_time,";
    public static final String SALES_MENU_DEFINITION_SERVICE_SALES_COLLECTION =
            "a.channel_ref,a.status,a.version activation_version FROM sales_menu.sales_collection c ";
    public static final String
            SALES_MENU_DEFINITION_SERVICE_JOIN_SALES_COLLECTION_VERSION_VERSION_REF_CURRENT_DRAFT_VERSION_REF =
                    "JOIN sales_menu.sales_collection_version d ON d.version_ref=c.current_draft_version_ref ";
    public static final String SALES_MENU_DEFINITION_SERVICE_SALES_COLLECTION_VERSION_LEFT_JOIN_SALES_MENU_SALES_C =
            "LEFT JOIN sales_menu.sales_collection_version p ";
    public static final String SALES_MENU_DEFINITION_SERVICE_JOIN_CONDITION_VERSION_REF_LATEST_PUBLISHED_VERSION_REF =
            "ON p.version_ref=c.latest_published_version_ref ";
    public static final String SALES_MENU_DEFINITION_SERVICE_SALES_PUBLICATION_PUBLICATION =
            "LEFT JOIN sales_menu.sales_publication publication ";
    public static final String
            SALES_MENU_DEFINITION_SERVICE_JOIN_CONDITION_PUBLICATION_PUBLISHED_VERSION_REF_VERSION_REF =
                    "ON publication.published_version_ref=p.version_ref ";
    public static final String SALES_MENU_DEFINITION_SERVICE_CONDITION_PUBLICATION_COLLECTION_REF =
            "AND publication.collection_ref=c.collection_ref ";
    public static final String SALES_MENU_DEFINITION_SERVICE_SALES_COLLECTION_ACTIVATION_LEFT_JOIN_SALES_MENU_SALES_C =
            "LEFT JOIN sales_menu.sales_collection_activation a ";
    public static final String SALES_MENU_DEFINITION_SERVICE_JOIN_CONDITION_COLLECTION_REF_CHANNEL_REF =
            "ON a.collection_ref=c.collection_ref AND a.channel_ref=? ";
    public static final String SALES_MENU_DEFINITION_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_STORE_REF_NAME =
            "WHERE c.workspace_uuid=? AND c.group_workspace_key=? AND c.store_ref=? AND c.name ILIKE ? ";
    public static final String SALES_MENU_DEFINITION_SERVICE_ORDER_BY_NAME_COLLECTION_REF =
            " ORDER BY c.name,c.collection_ref LIMIT ?";
    public static final String SALES_MENU_DEFINITION_SERVICE_SELECT_CHANNEL_REF_STATUS_VERSION =
            "SELECT channel_ref,status,version ";
    public static final String
            SALES_MENU_DEFINITION_SERVICE_FROM_CLAUSE_SALES_COLLECTION_ACTIVATION_FROM_SALES_MENU_SALES_COLLEC =
                    "FROM sales_menu.sales_collection_activation ";
    public static final String SALES_MENU_DEFINITION_SERVICE_WHERE_COLLECTION_REF_CHANNEL_REF =
            "WHERE collection_ref=? AND channel_ref=?";
    public static final String SALES_MENU_DEFINITION_SERVICE_INSERT_INTO_SALES_COLLECTION =
            "INSERT INTO sales_menu.sales_collection(collection_ref,workspace_uuid,group_workspace_key,";
    public static final String SALES_MENU_DEFINITION_SERVICE_STORE_REF_NAME_VERSION =
            "store_ref,name,version) VALUES(?,?,?,?,?,1)";
    public static final String
            SALES_MENU_DEFINITION_SERVICE_UPDATE_SALES_COLLECTION_CURRENT_DRAFT_VERSION_REF_COLLECTION_REF =
                    "UPDATE sales_menu.sales_collection SET current_draft_version_ref=? WHERE collection_ref=?";
    public static final String SALES_MENU_DEFINITION_SERVICE_INSERT_INTO_SALES_COLLECTION_ACTIVATION =
            "INSERT INTO sales_menu.sales_collection_activation(collection_ref,channel_ref,status,";
    public static final String SALES_MENU_DEFINITION_SERVICE_VERSION = "version) VALUES(?,?,?,1)";
    public static final String SALES_MENU_DEFINITION_SERVICE_INSERT_INTO_SALES_COLLECTION_ALTERNATE_A =
            "INSERT INTO sales_menu.sales_collection(collection_ref,workspace_uuid,group_workspace_key,";
    public static final String SALES_MENU_DEFINITION_SERVICE_STORE_REF_NAME_VERSION_ALTERNATE_A =
            "store_ref,name,version) VALUES(?,?,?,?,?,1)";
    public static final String
            SALES_MENU_DEFINITION_SERVICE_UPDATE_SALES_COLLECTION_CURRENT_DRAFT_VERSION_REF_COLLECTION_REF_ALTERNATE_A =
                    "UPDATE sales_menu.sales_collection SET current_draft_version_ref=? WHERE collection_ref=?";
    public static final String SALES_MENU_DEFINITION_SERVICE_UPDATE_SALES_COLLECTION_NAME_COLLECTION_REF =
            "UPDATE sales_menu.sales_collection SET name=? WHERE collection_ref=?";
    public static final String
            SALES_MENU_DEFINITION_SERVICE_UPDATE_SALES_COLLECTION_ARCHIVED_AT_EPOCH_MILLIS_COLLECTION_REF =
                    "UPDATE sales_menu.sales_collection SET archived_at_epoch_millis=? WHERE collection_ref=?";
    public static final String
            SALES_MENU_DEFINITION_SERVICE_INSERT_INTO_SALES_COLLECTION_ACTIVATION_INSERT_INTO_SALES_MENU_SALES =
                    "INSERT INTO sales_menu.sales_collection_activation(";
    public static final String SALES_MENU_DEFINITION_SERVICE_COLLECTION_REF_CHANNEL_REF_STATUS_VERSION =
            "collection_ref,channel_ref,status,version) ";
    public static final String SALES_MENU_DEFINITION_SERVICE_VALUES_SET_COLLECTION_REF_CHANNEL_REF =
            "VALUES(?,?,?,1) ON CONFLICT (collection_ref,channel_ref) DO UPDATE SET ";
    public static final String SALES_MENU_DEFINITION_SERVICE_STATUS_VERSION_SALES_COLLECTION_ACTIVATION =
            "status=EXCLUDED.status,version=sales_menu.sales_collection_activation.version+1";
    public static final String SALES_MENU_DEFINITION_SERVICE_UPDATE_SALES_COLLECTION_VERSION_SCHEDULE_KIND =
            "UPDATE sales_menu.sales_collection_version SET schedule_kind=?,";
    public static final String SALES_MENU_DEFINITION_SERVICE_SCHEDULE_START_LOCAL_TIME = "schedule_start_local_time=?,";
    public static final String SALES_MENU_DEFINITION_SERVICE_SCHEDULE_END_LOCAL_TIME_VERSION_REF =
            "schedule_end_local_time=? WHERE version_ref=?";
    public static final String SALES_MENU_DEFINITION_SERVICE_SELECT_REQUEST_HASH_STATUS_READBACK_JSON_TEXT =
            "SELECT request_hash,status,response_json::text readback_json ";
    public static final String
            SALES_MENU_DEFINITION_SERVICE_FROM_CLAUSE_SALES_COMMAND_RECEIPT_FROM_SALES_MENU_SALES_COMMAN =
                    "FROM sales_menu.sales_command_receipt ";
    public static final String SALES_MENU_DEFINITION_SERVICE_WHERE_WORKSPACE_UUID_OPERATION_ID_IDEMPOTENCY_KEY =
            "WHERE workspace_uuid=? AND operation_id=? AND idempotency_key=?";
    public static final String SALES_MENU_DEFINITION_SERVICE_INSERT_INTO_SALES_COMMAND_RECEIPT =
            "INSERT INTO sales_menu.sales_command_receipt(receipt_ref,workspace_uuid,group_workspace_key,";
    public static final String SALES_MENU_DEFINITION_SERVICE_OPERATION_ID_IDEMPOTENCY_KEY_REQUEST_HASH_STATUS =
            "operation_id,idempotency_key,request_hash,status,response_json,created_at_epoch_millis) ";
    public static final String SALES_MENU_DEFINITION_SERVICE_VALUES_VALUES_JSONB = "VALUES(?,?,?,?,?,?,? ,?::jsonb,?) ";
    public static final String
            SALES_MENU_DEFINITION_SERVICE_JOIN_CONDITION_WORKSPACE_UUID_OPERATION_ID_IDEMPOTENCY_KEY =
                    "ON CONFLICT (workspace_uuid,operation_id,idempotency_key) DO NOTHING";
    public static final String SALES_MENU_DEFINITION_SERVICE_SELECT_REQUEST_HASH_STATUS_READBACK_JSON_TEXT_ALTERNATE_A =
            "SELECT request_hash,status,response_json::text readback_json ";
    public static final String
            SALES_MENU_DEFINITION_SERVICE_FROM_CLAUSE_SALES_COMMAND_RECEIPT_FROM_SALES_MENU_SALES_COMMAN_ALTERNATE_A =
                    "FROM sales_menu.sales_command_receipt ";
    public static final String
            SALES_MENU_DEFINITION_SERVICE_WHERE_WORKSPACE_UUID_OPERATION_ID_IDEMPOTENCY_KEY_ALTERNATE_A =
                    "WHERE workspace_uuid=? AND operation_id=? AND idempotency_key=?";
    public static final String
            SALES_MENU_DEFINITION_SERVICE_SELECT_SALES_VERSION_SECTION_SECTION_REF_NAME_DISPLAY_ORDER =
                    "SELECT section_ref,name,display_order FROM sales_menu.sales_version_section ";
    public static final String SALES_MENU_DEFINITION_SERVICE_WHERE_VERSION_REF_DISPLAY_ORDER =
            "WHERE version_ref=? ORDER BY display_order";
    public static final String SALES_MENU_DEFINITION_SERVICE_INSERT_INTO_SALES_SECTION_SECTION_REF_COLLECTION_REF =
            "INSERT INTO sales_menu.sales_section(section_ref,collection_ref) VALUES(?,?)";
    public static final String SALES_MENU_DEFINITION_SERVICE_INSERT_INTO_SALES_VERSION_SECTION =
            "INSERT INTO sales_menu.sales_version_section(version_ref,section_ref,collection_ref,name,";
    public static final String SALES_MENU_DEFINITION_SERVICE_DISPLAY_ORDER = "display_order) ";
    public static final String SALES_MENU_DEFINITION_SERVICE_VALUES = "VALUES(?,?,?,?,?)";
    public static final String
            SALES_MENU_DEFINITION_SERVICE_SELECT_VERSION_REF_SALES_ITEM_REF_CATALOG_ITEM_REF_SECTION_REF =
                    "SELECT v.version_ref,i.sales_item_ref,i.catalog_item_ref,v.section_ref,v.display_order,";
    public static final String SALES_MENU_DEFINITION_SERVICE_VERSION_ALTERNATE_A =
            "v.version,v.display_name_override,v.resolved_item_name,v.resolved_item_code,";
    public static final String SALES_MENU_DEFINITION_SERVICE_RESOLVED_PRODUCT_SHAPE =
            "v.resolved_product_shape,v.resolved_sales_unit_ref,v.resolved_sales_unit_code,";
    public static final String SALES_MENU_DEFINITION_SERVICE_RESOLVED_SALES_UNIT_NAME =
            "v.resolved_sales_unit_name,v.resolved_sales_unit_dimension,v.resolved_sales_unit_precision,";
    public static final String SALES_MENU_DEFINITION_SERVICE_LISTED_PRICE_CENTS_ORDERING_CONSTRAINTS_JSON =
            "v.listed_price_cents,v.ordering_constraints_json,";
    public static final String SALES_MENU_DEFINITION_SERVICE_DISPLAY_MEDIA_MODE_PUBLISHED_PRIMARY_IMAGE_ASSET_REF =
            "v.display_media_mode,v.published_primary_image_asset_ref,";
    public static final String SALES_MENU_DEFINITION_SERVICE_PUBLISHED_CATALOG_IMAGE_ASSET_REFS_TEXT =
            "v.published_catalog_image_asset_refs::text published_catalog_image_asset_refs,";
    public static final String SALES_MENU_DEFINITION_SERVICE_CAN_MOVE_UP_CAN_MOVE_DOWN =
            "false AS can_move_up,false AS can_move_down ";
    public static final String
            SALES_MENU_DEFINITION_SERVICE_FROM_CLAUSE_SALES_VERSION_ITEM_FROM_SALES_MENU_SALES_VERSIO =
                    "FROM sales_menu.sales_version_item v ";
    public static final String SALES_MENU_DEFINITION_SERVICE_JOIN_SALES_ITEM_SALES_ITEM_REF =
            "JOIN sales_menu.sales_item i ON i.sales_item_ref=v.sales_item_ref ";
    public static final String SALES_MENU_DEFINITION_SERVICE_WHERE_VERSION_REF_DISPLAY_ORDER_ALTERNATE_A =
            "WHERE v.version_ref=? ORDER BY v.display_order";
    public static final String
            SALES_MENU_DEFINITION_SERVICE_INSERT_INTO_SALES_ITEM_SALES_ITEM_REF_COLLECTION_REF_CATALOG_ITEM_REF =
                    "INSERT INTO sales_menu.sales_item(sales_item_ref,collection_ref,catalog_item_ref) VALUES(?,?,?)";
    public static final String SALES_MENU_DEFINITION_SERVICE_INSERT_INTO_SALES_VERSION_ITEM =
            "INSERT INTO sales_menu.sales_version_item(version_ref,sales_item_ref,section_ref,collection_ref,";
    public static final String SALES_MENU_DEFINITION_SERVICE_DISPLAY_ORDER_ALTERNATE_A =
            "display_order,display_name_override,resolved_item_name,resolved_item_code,";
    public static final String SALES_MENU_DEFINITION_SERVICE_RESOLVED_PRODUCT_SHAPE_ALTERNATE_A =
            "resolved_product_shape,listed_price_cents,ordering_constraints_json,";
    public static final String SALES_MENU_DEFINITION_SERVICE_DISPLAY_MEDIA_MODE_VERSION =
            "display_media_mode,version) VALUES(?,?,?,?,?,?,?,?,?,?,?::jsonb,?,1)";
    public static final String
            SALES_MENU_DEFINITION_SERVICE_INSERT_INTO_SALES_VERSION_ITEM_SKU_VERSION_REF_SALES_ITEM_REF_SKU_REF =
                    "INSERT INTO sales_menu.sales_version_item_sku(version_ref,sales_item_ref,sku_ref,";
    public static final String SALES_MENU_DEFINITION_SERVICE_LISTED_PRICE_CENTS =
            "listed_price_cents,resolved_sku_code,resolved_sku_name,default_price_cents,";
    public static final String SALES_MENU_DEFINITION_SERVICE_DISPLAY_ORDER_ALTERNATE_B =
            "display_order) VALUES(?,?,?,?,?,?,?,?)";
    public static final String
            SALES_MENU_DEFINITION_SERVICE_INSERT_INTO_SALES_VERSION_ITEM_ORDER_OPTION_VERSION_REF_SALES_ITEM_REF =
                    "INSERT INTO sales_menu.sales_version_item_order_option(version_ref,sales_item_ref,";
    public static final String SALES_MENU_DEFINITION_SERVICE_DEFINITION_REF =
            "definition_ref,resolved_definition_name,selection_mode,required,min_selection_count,";
    public static final String SALES_MENU_DEFINITION_SERVICE_MAX_SELECTION_COUNT_DISPLAY_ORDER =
            "max_selection_count,display_order) VALUES(?,?,?,?,?,?,?,?,?)";
    public static final String SALES_MENU_DEFINITION_SERVICE_INSERT_INTO_SALES_VERSION_ITEM_ORDER_OPTION_VA =
            "INSERT INTO sales_menu.sales_version_item_order_option_value(version_ref,sales_item_ref,";
    public static final String SALES_MENU_DEFINITION_SERVICE_DEFINITION_REF_ALTERNATE_A =
            "definition_ref,definition_value_ref,resolved_value_name,display_order,";
    public static final String SALES_MENU_DEFINITION_SERVICE_DEFAULT_VALUE_EXTRA_PRICE =
            "default_value,extra_price) VALUES(?,?,?,?,?,?,?,?)";
    public static final String
            SALES_MENU_DEFINITION_SERVICE_INSERT_INTO_SALES_VERSION_ITEM_MEDIA_VERSION_REF_SALES_ITEM_REF =
                    "INSERT INTO sales_menu.sales_version_item_media(version_ref,sales_item_ref,";
    public static final String SALES_MENU_DEFINITION_SERVICE_ASSET_REF_DISPLAY_ORDER =
            "asset_ref,display_order) VALUES(?,?,?,?)";
    public static final String SALES_MENU_DEFINITION_SERVICE_INSERT_INTO_SALES_COLLECTION_VERSION =
            "INSERT INTO sales_menu.sales_collection_version(version_ref,collection_ref,kind,revision,";
    public static final String SALES_MENU_DEFINITION_SERVICE_SCHEDULE_KIND =
            "schedule_kind,schedule_start_local_time,schedule_end_local_time,";
    public static final String SALES_MENU_DEFINITION_SERVICE_SOURCE_DRAFT_VERSION_REF_SOURCE_DRAFT_REVISION_VERSION =
            "source_draft_version_ref,source_draft_revision,version) VALUES(?,?,?,?,?,?,?,?,?,1)";
    public static final String SALES_MENU_DEFINITION_SERVICE_SELECT_SALES_ITEM_REF =
            "SELECT sales_item_ref,definition_ref,resolved_definition_name,selection_mode,required,";
    public static final String SALES_MENU_DEFINITION_SERVICE_MIN_SELECTION_COUNT_MAX_SELECTION_COUNT_DISPLAY_ORDER =
            "min_selection_count,max_selection_count,display_order ";
    public static final String SALES_MENU_DEFINITION_SERVICE_FROM_CLAUSE_SALES_VERSION_ITEM_ORDER_OPTION_VERSION_REF =
            "FROM sales_menu.sales_version_item_order_option WHERE version_ref=? ";
    public static final String SALES_MENU_DEFINITION_SERVICE_CONDITION_SALES_ITEM_REF = "AND sales_item_ref IN (";
    public static final String SALES_MENU_DEFINITION_SERVICE_CLOSE_PAREN = ") ";
    public static final String SALES_MENU_DEFINITION_SERVICE_ORDER_BY_SALES_ITEM_REF_DISPLAY_ORDER_DEFINITION_REF =
            "ORDER BY sales_item_ref,display_order,definition_ref";
    public static final String SALES_MENU_DEFINITION_SERVICE_SELECT_SALES_ITEM_REF_ALTERNATE_A =
            "SELECT sales_item_ref,definition_ref,definition_value_ref,resolved_value_name,display_order,";
    public static final String SALES_MENU_DEFINITION_SERVICE_DEFAULT_VALUE_EXTRA_PRICE_ALTERNATE_A =
            "default_value,extra_price ";
    public static final String
            SALES_MENU_DEFINITION_SERVICE_FROM_CLAUSE_SALES_VERSION_ITEM_ORDER_OPTION_VA_VERSION_REF =
                    "FROM sales_menu.sales_version_item_order_option_value WHERE version_ref=? ";
    public static final String SALES_MENU_DEFINITION_SERVICE_CONDITION_SALES_ITEM_REF_ALTERNATE_A =
            "AND sales_item_ref IN (";
    public static final String SALES_MENU_DEFINITION_SERVICE_CLOSE_PAREN_ALTERNATE_A = ") ";
    public static final String SALES_MENU_DEFINITION_SERVICE_ORDER_BY_SALES_ITEM_REF =
            "ORDER BY sales_item_ref,definition_ref,display_order,definition_value_ref";
    public static final String
            SALES_MENU_DEFINITION_SERVICE_SELECT_SALES_ITEM_REF_SKU_REF_LISTED_PRICE_CENTS_RESOLVED_SKU_CODE =
                    "SELECT sales_item_ref,sku_ref,listed_price_cents,resolved_sku_code,resolved_sku_name,";
    public static final String SALES_MENU_DEFINITION_SERVICE_SALES_VERSION_ITEM_SKU_DEFAULT_PRICE_CENTS_DISPLAY_ORDER =
            "default_price_cents,display_order FROM sales_menu.sales_version_item_sku ";
    public static final String SALES_MENU_DEFINITION_SERVICE_WHERE_VERSION_REF_SALES_ITEM_REF =
            "WHERE version_ref=? AND sales_item_ref IN (";
    public static final String SALES_MENU_DEFINITION_SERVICE_CLOSE_PAREN_ALTERNATE_B = ") ";
    public static final String SALES_MENU_DEFINITION_SERVICE_ORDER_BY_SALES_ITEM_REF_DISPLAY_ORDER_SKU_REF =
            "ORDER BY sales_item_ref,display_order,sku_ref";
    public static final String SALES_MENU_DEFINITION_SERVICE_SELECT_SALES_ITEM_REF_ASSET_REF_DISPLAY_ORDER =
            "SELECT sales_item_ref,asset_ref,display_order ";
    public static final String SALES_MENU_DEFINITION_SERVICE_FROM_CLAUSE_SALES_VERSION_ITEM_MEDIA_VERSION_REF =
            "FROM sales_menu.sales_version_item_media WHERE version_ref=? ";
    public static final String SALES_MENU_DEFINITION_SERVICE_CONDITION_SALES_ITEM_REF_ALTERNATE_B =
            "AND sales_item_ref IN (";
    public static final String SALES_MENU_DEFINITION_SERVICE_CLOSE_PAREN_ALTERNATE_C = ") ";
    public static final String SALES_MENU_DEFINITION_SERVICE_ORDER_BY_SALES_ITEM_REF_DISPLAY_ORDER_ASSET_REF =
            "ORDER BY sales_item_ref,display_order,asset_ref";
    public static final String SALES_MENU_DEFINITION_SERVICE_SELECT_SALES_COLLECTION_CURRENT_DRAFT_VERSION_REF =
            "SELECT current_draft_version_ref FROM sales_menu.sales_collection ";
    public static final String SALES_MENU_DEFINITION_SERVICE_WHERE_COLLECTION_REF = "WHERE collection_ref=?";
    public static final String SALES_MENU_DEFINITION_SERVICE_UPDATE_SALES_COLLECTION_VERSION_REVISION =
            "UPDATE sales_menu.sales_collection_version SET revision=revision+1 ";
    public static final String SALES_MENU_DEFINITION_SERVICE_WHERE_VERSION_REF_KIND_DRAFT =
            "WHERE version_ref=? AND kind='DRAFT'";
    public static final String SALES_MENU_DEFINITION_SERVICE_INSERT_INTO_SALES_OPERATION_RECORD =
            "INSERT INTO sales_menu.sales_operation_record(record_ref,workspace_uuid,group_workspace_key,";
    public static final String SALES_MENU_DEFINITION_SERVICE_STORE_REF_CHANNEL_REF_COLLECTION_REF_OPERATION_KIND =
            "store_ref,channel_ref,collection_ref,operation_kind,target_ref,target_kind,";
    public static final String SALES_MENU_DEFINITION_SERVICE_TARGET_DISPLAY_SNAPSHOT_RESULT_ACTOR_TYPE_ACTOR_ID =
            "target_display_snapshot,result,actor_type,actor_id,actor_display_snapshot,";
    public static final String SALES_MENU_DEFINITION_SERVICE_OCCURRED_AT_EPOCH_MILLIS_IDEMPOTENCY_KEY =
            "occurred_at_epoch_millis,idempotency_key) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";
}
