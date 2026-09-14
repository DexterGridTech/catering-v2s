package com.catering.v2s.salesmenu.application.persistence;

/** SQL text fragments owned by SalesMenuOperationRecordService; B3 relocates text only and does not change execution. */
public final class SalesMenuOperationRecordServiceSql {
    public static final String SALES_MENU_OPERATION_RECORD_SERVICE_CONDITION_OCCURRED_AT_EPOCH_MILLIS = " AND (occurred_at_epoch_millis < ? OR ";
    public static final String SALES_MENU_OPERATION_RECORD_SERVICE_OPEN_PAREN_OCCURRED_AT_EPOCH_MILLIS_RECORD_REF = "(occurred_at_epoch_millis = ? AND record_ref < ?))";
    public static final String SALES_MENU_OPERATION_RECORD_SERVICE_SELECT_RECORD_REF = "SELECT record_ref,occurred_at_epoch_millis,operation_kind,collection_ref,target_ref,";
    public static final String SALES_MENU_OPERATION_RECORD_SERVICE_CONTINUATION_TARGET_KIND = "target_kind,";
    public static final String SALES_MENU_OPERATION_RECORD_SERVICE_CONTINUATION_TARGET_DISPLAY_SNAPSHOT = "target_display_snapshot,result,failure_code,actor_display_snapshot ";
    public static final String SALES_MENU_OPERATION_RECORD_SERVICE_FROM_CLAUSE_SALES_OPERATION_RECORD_FROM_SALES_MENU_SALES_OPERAT = "FROM sales_menu.sales_operation_record ";
    public static final String SALES_MENU_OPERATION_RECORD_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_STORE_REF = "WHERE workspace_uuid=? AND group_workspace_key=? AND store_ref=? ";
    public static final String SALES_MENU_OPERATION_RECORD_SERVICE_CONDITION_COLLECTION_REF_CHANNEL_REF = "AND collection_ref=? AND (channel_ref IS NULL OR channel_ref=?)";
    public static final String SALES_MENU_OPERATION_RECORD_SERVICE_ORDER_BY_OCCURRED_AT_EPOCH_MILLIS_RECORD_REF = " ORDER BY occurred_at_epoch_millis DESC,record_ref DESC LIMIT ?";
    public static final String SALES_MENU_OPERATION_RECORD_SERVICE_INSERT_INTO_SALES_OPERATION_RECORD = "INSERT INTO sales_menu.sales_operation_record(record_ref,workspace_uuid,group_workspace_key,";
    public static final String SALES_MENU_OPERATION_RECORD_SERVICE_CONTINUATION_STORE_REF_CHANNEL_REF_COLLECTION_REF_OPERATION_KIND = "store_ref,channel_ref,collection_ref,operation_kind,target_ref,target_kind,";
    public static final String SALES_MENU_OPERATION_RECORD_SERVICE_CONTINUATION_TARGET_DISPLAY_SNAPSHOT_RESULT_FAILURE_CODE = "target_display_snapshot,result,failure_code,";
    public static final String SALES_MENU_OPERATION_RECORD_SERVICE_CONTINUATION_ACTOR_TYPE = "actor_type,";
    public static final String SALES_MENU_OPERATION_RECORD_SERVICE_CONTINUATION_ACTOR_ID = "actor_id,actor_display_snapshot,occurred_at_epoch_millis,idempotency_key) ";
    public static final String SALES_MENU_OPERATION_RECORD_SERVICE_VALUES = "VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";
}
