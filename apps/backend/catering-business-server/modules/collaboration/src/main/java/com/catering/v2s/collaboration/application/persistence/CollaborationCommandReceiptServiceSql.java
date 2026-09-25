package com.catering.v2s.collaboration.application.persistence;

/**
 * SQL text fragments owned by CollaborationCommandReceiptService; B3 relocates text only and does not change execution.
 */
public final class CollaborationCommandReceiptServiceSql {
    public static final String
            COLLABORATION_COMMAND_RECEIPT_SERVICE_SELECT_COMMAND_RECEIPT_REQUEST_HASH_RESPONSE_JSON_TEXT =
                    "SELECT request_hash, response_json::text FROM collaboration.command_receipt ";
    public static final String
            COLLABORATION_COMMAND_RECEIPT_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_IDEMPOTENCY_KEY =
                    "WHERE workspace_uuid=? AND group_workspace_key=? AND idempotency_key=?";
    public static final String
            COLLABORATION_COMMAND_RECEIPT_SERVICE_INSERT_INTO_COMMAND_RECEIPT_INSERT_INTO_COLLABORATION_CO =
                    "INSERT INTO collaboration.command_receipt ";
    public static final String COLLABORATION_COMMAND_RECEIPT_SERVICE_OPEN_PAREN_RECEIPT_REF =
            "(receipt_ref, workspace_uuid, group_workspace_key, idempotency_key, operation_id, ";
    public static final String COLLABORATION_COMMAND_RECEIPT_SERVICE_REQUEST_HASH =
            "request_hash, response_json, created_at_epoch_millis) ";
    public static final String COLLABORATION_COMMAND_RECEIPT_SERVICE_VALUES_VALUES_JSONB =
            "VALUES (?, ?, ?, ?, ?, ?, ?::jsonb, ?)";
}
