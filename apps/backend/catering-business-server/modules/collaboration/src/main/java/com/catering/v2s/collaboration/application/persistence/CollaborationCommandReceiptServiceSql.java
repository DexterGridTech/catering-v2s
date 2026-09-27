package com.catering.v2s.collaboration.application.persistence;

/**
 * SQL text fragments owned by CollaborationCommandReceiptService; B3 relocates text only and does not change execution.
 */
public final class CollaborationCommandReceiptServiceSql {
    public static final String SELECT_CMD_RECEIPT_REQ_HASH_001 =
            "SELECT request_hash, response_json::text FROM collaboration.command_receipt ";
    public static final String WHERE_WS_UUID_GRP_WS_002 =
            "WHERE workspace_uuid=? AND group_workspace_key=? AND idempotency_key=?";
    public static final String INSERT_INTO_CMD_RECEIPT_INSERT_003 = "INSERT INTO collaboration.command_receipt ";
    public static final String COLLABORATION_COMMAND_RECEIPT_SERVICE_OPEN_PAREN_RECEIPT_REF =
            "(receipt_ref, workspace_uuid, group_workspace_key, idempotency_key, operation_id, ";
    public static final String COLLABORATION_COMMAND_RECEIPT_SERVICE_REQUEST_HASH =
            "request_hash, response_json, created_at_epoch_millis) ";
    public static final String COLLABORATION_COMMAND_RECEIPT_SERVICE_VALUES_VALUES_JSONB =
            "VALUES (?, ?, ?, ?, ?, ?, ?::jsonb, ?)";
}
