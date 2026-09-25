package com.catering.v2s.salesmenu.application.persistence;

/** SQL text fragments owned by SalesMenuSectionService; B3 relocates text only and does not change execution. */
public final class SalesMenuSectionServiceSql {
    public static final String SALES_VERSION_SECTION_TABLE = "sales_menu.sales_version_section";
    public static final String SECTION_REF_COLUMN = "section_ref";
    public static final String ADJACENCY_LESS_SUFFIX = " < ?))";
    public static final String ADJACENCY_GREATER_SUFFIX = " > ?))";
    public static final String SELECT_PREFIX = "SELECT ";
    public static final String DISPLAY_ORDER_PROJECTION = ",display_order FROM ";
    public static final String UPDATE_PREFIX = "UPDATE ";
    public static final String DISPLAY_ORDER_DESC_LOCK_SUFFIX = " DESC LIMIT 1 FOR UPDATE";
    public static final String DISPLAY_ORDER_ASC_LOCK_SUFFIX = " ASC LIMIT 1 FOR UPDATE";
    public static final String SALES_MENU_SECTION_SERVICE_INSERT_INTO_SALES_SECTION_SECTION_REF_COLLECTION_REF =
            "INSERT INTO sales_menu.sales_section(section_ref,collection_ref) VALUES(?,?)";
    public static final String SALES_MENU_SECTION_SERVICE_INSERT_INTO_SALES_VERSION_SECTION =
            "INSERT INTO sales_menu.sales_version_section(version_ref,section_ref,collection_ref,name,";
    public static final String SALES_MENU_SECTION_SERVICE_DISPLAY_ORDER = "display_order) ";
    public static final String SALES_MENU_SECTION_SERVICE_VALUES_DISPLAY_ORDER =
            "VALUES(?,?,?, ?,COALESCE((SELECT max(display_order)+1 ";
    public static final String SALES_MENU_SECTION_SERVICE_FROM_CLAUSE_SALES_VERSION_SECTION_VERSION_REF =
            "FROM sales_menu.sales_version_section WHERE version_ref=?),0))";
    public static final String SALES_MENU_SECTION_SERVICE_UPDATE_SALES_VERSION_SECTION_NAME_VERSION_REF_SECTION_REF =
            "UPDATE sales_menu.sales_version_section SET name=? WHERE version_ref=? AND section_ref=?";
    public static final String SALES_MENU_SECTION_SERVICE_SELECT_SALES_VERSION_ITEM_SELECT_1_FROM_SALES_MENU_SAL =
            "SELECT 1 FROM sales_menu.sales_version_item ";
    public static final String SALES_MENU_SECTION_SERVICE_WHERE_VERSION_REF_SECTION_REF =
            "WHERE version_ref=? AND section_ref=? LIMIT 1";
    public static final String SALES_MENU_SECTION_SERVICE_DELETE_SALES_VERSION_SECTION_VERSION_REF_SECTION_REF =
            "DELETE FROM sales_menu.sales_version_section WHERE version_ref=? AND section_ref=?";
    public static final String SALES_MENU_SECTION_SERVICE_SELECT_REQUEST_HASH_STATUS_READBACK_JSON_TEXT =
            "SELECT request_hash,status,response_json::text readback_json ";
    public static final String
            SALES_MENU_SECTION_SERVICE_FROM_CLAUSE_SALES_COMMAND_RECEIPT_FROM_SALES_MENU_SALES_COMMAN =
                    "FROM sales_menu.sales_command_receipt ";
    public static final String SALES_MENU_SECTION_SERVICE_WHERE_WORKSPACE_UUID_OPERATION_ID_IDEMPOTENCY_KEY =
            "WHERE workspace_uuid=? AND operation_id=? AND idempotency_key=?";
    public static final String SALES_MENU_SECTION_SERVICE_INSERT_INTO_SALES_COMMAND_RECEIPT =
            "INSERT INTO sales_menu.sales_command_receipt(receipt_ref,workspace_uuid,group_workspace_key,";
    public static final String SALES_MENU_SECTION_SERVICE_OPERATION_ID_IDEMPOTENCY_KEY_REQUEST_HASH_STATUS =
            "operation_id,idempotency_key,request_hash,status,response_json,created_at_epoch_millis) ";
    public static final String SALES_MENU_SECTION_SERVICE_VALUES_VALUES_JSONB = "VALUES(?,?,?,?,?,?,? ,?::jsonb,?) ";
    public static final String SALES_MENU_SECTION_SERVICE_JOIN_CONDITION_WORKSPACE_UUID_OPERATION_ID_IDEMPOTENCY_KEY =
            "ON CONFLICT (workspace_uuid,operation_id,idempotency_key) DO NOTHING";
    public static final String SALES_MENU_SECTION_SERVICE_SELECT_REQUEST_HASH_STATUS_READBACK_JSON_TEXT_ALTERNATE_A =
            "SELECT request_hash,status,response_json::text readback_json ";
    public static final String
            SALES_MENU_SECTION_SERVICE_FROM_CLAUSE_SALES_COMMAND_RECEIPT_FROM_SALES_MENU_SALES_COMMAN_ALTERNATE_A =
                    "FROM sales_menu.sales_command_receipt ";
    public static final String
            SALES_MENU_SECTION_SERVICE_WHERE_WORKSPACE_UUID_OPERATION_ID_IDEMPOTENCY_KEY_ALTERNATE_A =
                    "WHERE workspace_uuid=? AND operation_id=? AND idempotency_key=?";
    public static final String SALES_MENU_SECTION_SERVICE_CONDITION_DISPLAY_ORDER =
            " AND (display_order < ? OR (display_order = ? AND ";
    public static final String SALES_MENU_SECTION_SERVICE_CONDITION_DISPLAY_ORDER_ALTERNATE_A =
            " AND (display_order > ? OR (display_order = ? AND ";
    public static final String SALES_MENU_SECTION_SERVICE_ORDER_BY_DISPLAY_ORDER = " ORDER BY display_order DESC,";
    public static final String SALES_MENU_SECTION_SERVICE_ORDER_BY_DISPLAY_ORDER_ALTERNATE_A =
            " ORDER BY display_order ASC,";
    public static final String SALES_MENU_SECTION_SERVICE_CONDITION_SECTION_REF = " AND section_ref=?";
    public static final String SALES_MENU_SECTION_SERVICE_WHERE_VERSION_REF = " WHERE version_ref=?";
    public static final String SALES_MENU_SECTION_SERVICE_SELECT_DISPLAY_ORDER_VALUE =
            "SELECT COALESCE(max(display_order),0)+1 AS value FROM ";
    public static final String SALES_MENU_SECTION_SERVICE_WHERE_VERSION_REF_ALTERNATE_A = " WHERE version_ref=?";
    public static final String SALES_MENU_SECTION_SERVICE_SET_DISPLAY_ORDER_VERSION_REF =
            " SET display_order=? WHERE version_ref=? AND ";
    public static final String SALES_MENU_SECTION_SERVICE_SET_DISPLAY_ORDER_VERSION_REF_ALTERNATE_A =
            " SET display_order=? WHERE version_ref=? AND ";
    public static final String SALES_MENU_SECTION_SERVICE_SET_DISPLAY_ORDER_VERSION_REF_ALTERNATE_B =
            " SET display_order=? WHERE version_ref=? AND ";
    public static final String SALES_MENU_SECTION_SERVICE_SELECT_SECTION_REF_NAME_DISPLAY_ORDER =
            "SELECT s.section_ref,s.name,s.display_order,(SELECT count(*) ";
    public static final String SALES_MENU_SECTION_SERVICE_FROM_CLAUSE_SALES_VERSION_ITEM_VERSION_REF =
            "FROM sales_menu.sales_version_item i WHERE i.version_ref=? ";
    public static final String SALES_MENU_SECTION_SERVICE_CONDITION_SECTION_REF_ITEM_COUNT =
            "AND i.section_ref=s.section_ref) item_count,";
    public static final String SALES_MENU_SECTION_SERVICE_SALES_VERSION_SECTION_PREVIOUS =
            "EXISTS (SELECT 1 FROM sales_menu.sales_version_section previous ";
    public static final String SALES_MENU_SECTION_SERVICE_WHERE_PREVIOUS_VERSION_REF =
            "WHERE previous.version_ref=s.version_ref AND ";
    public static final String SALES_MENU_SECTION_SERVICE_OPEN_PAREN_PREVIOUS_DISPLAY_ORDER =
            "(previous.display_order < s.display_order OR ";
    public static final String SALES_MENU_SECTION_SERVICE_OPEN_PAREN_PREVIOUS_DISPLAY_ORDER_ALTERNATE_A =
            "(previous.display_order=s.display_order AND ";
    public static final String SALES_MENU_SECTION_SERVICE_PREVIOUS_SECTION_REF_CAN_MOVE_UP =
            "previous.section_ref < s.section_ref))) can_move_up,";
    public static final String SALES_MENU_SECTION_SERVICE_SALES_VERSION_SECTION_NEXT_SECTION =
            "EXISTS (SELECT 1 FROM sales_menu.sales_version_section next_section ";
    public static final String SALES_MENU_SECTION_SERVICE_WHERE_NEXT_SECTION_VERSION_REF =
            "WHERE next_section.version_ref=s.version_ref AND ";
    public static final String SALES_MENU_SECTION_SERVICE_OPEN_PAREN_NEXT_SECTION_DISPLAY_ORDER =
            "(next_section.display_order > s.display_order OR ";
    public static final String SALES_MENU_SECTION_SERVICE_OPEN_PAREN_NEXT_SECTION_DISPLAY_ORDER_ALTERNATE_A =
            "(next_section.display_order=s.display_order AND ";
    public static final String SALES_MENU_SECTION_SERVICE_NEXT_SECTION_SECTION_REF_CAN_MOVE_DOWN =
            "next_section.section_ref > s.section_ref))) can_move_down ";
    public static final String SALES_MENU_SECTION_SERVICE_FROM_CLAUSE_SALES_VERSION_SECTION_VERSION_REF_ALTERNATE_A =
            "FROM sales_menu.sales_version_section s WHERE s.version_ref=? ";
    public static final String SALES_MENU_SECTION_SERVICE_ORDER_BY_DISPLAY_ORDER_SECTION_REF =
            "ORDER BY s.display_order,s.section_ref";
    public static final String SALES_MENU_SECTION_SERVICE_SELECT_SALES_COLLECTION_CURRENT_DRAFT_VERSION_REF =
            "SELECT current_draft_version_ref FROM sales_menu.sales_collection ";
    public static final String SALES_MENU_SECTION_SERVICE_WHERE_COLLECTION_REF = "WHERE collection_ref=?";
    public static final String SALES_MENU_SECTION_SERVICE_UPDATE_SALES_COLLECTION_VERSION_REVISION =
            "UPDATE sales_menu.sales_collection_version SET revision=revision+1 ";
    public static final String SALES_MENU_SECTION_SERVICE_WHERE_VERSION_REF_KIND_DRAFT =
            "WHERE version_ref=? AND kind='DRAFT'";
    public static final String SALES_MENU_SECTION_SERVICE_SELECT_SALES_COLLECTION_LATEST_PUBLISHED_VERSION_REF =
            "SELECT latest_published_version_ref FROM sales_menu.sales_collection ";
    public static final String SALES_MENU_SECTION_SERVICE_WHERE_COLLECTION_REF_ALTERNATE_A = "WHERE collection_ref=?";
    public static final String SALES_MENU_SECTION_SERVICE_SELECT_SALES_VERSION_SECTION_SELECT_1_FROM_SALES_MENU_SAL =
            "SELECT 1 FROM sales_menu.sales_version_section ";
    public static final String SALES_MENU_SECTION_SERVICE_WHERE_COLLECTION_REF_VERSION_REF_SECTION_REF =
            "WHERE collection_ref=? AND version_ref=? AND section_ref=?";
    public static final String SALES_MENU_SECTION_SERVICE_SELECT_SALES_VERSION_SECTION_SECTION_REF_DISPLAY_ORDER =
            "SELECT section_ref,display_order FROM sales_menu.sales_version_section ";
    public static final String SALES_MENU_SECTION_SERVICE_WHERE_COLLECTION_REF_VERSION_REF_SECTION_REF_ALTERNATE_A =
            "WHERE collection_ref=? AND version_ref=? AND section_ref=? FOR UPDATE";
    public static final String SALES_MENU_SECTION_SERVICE_INSERT_INTO_SALES_OPERATION_RECORD =
            "INSERT INTO sales_menu.sales_operation_record(record_ref,workspace_uuid,group_workspace_key,";
    public static final String SALES_MENU_SECTION_SERVICE_STORE_REF_CHANNEL_REF_COLLECTION_REF_OPERATION_KIND =
            "store_ref,channel_ref,collection_ref,operation_kind,target_ref,target_kind,";
    public static final String SALES_MENU_SECTION_SERVICE_TARGET_DISPLAY_SNAPSHOT_RESULT_ACTOR_TYPE_ACTOR_ID =
            "target_display_snapshot,result,actor_type,actor_id,actor_display_snapshot,";
    public static final String SALES_MENU_SECTION_SERVICE_OCCURRED_AT_EPOCH_MILLIS_IDEMPOTENCY_KEY =
            "occurred_at_epoch_millis,idempotency_key) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";
}
