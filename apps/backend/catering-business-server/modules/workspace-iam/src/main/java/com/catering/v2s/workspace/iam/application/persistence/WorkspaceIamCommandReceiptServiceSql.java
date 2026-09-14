package com.catering.v2s.workspace.iam.application.persistence;

/** SQL text fragments owned by WorkspaceIamCommandReceiptService; B3 relocates text only and does not change execution. */
public final class WorkspaceIamCommandReceiptServiceSql {
    public static final String WORKSPACE_IAM_COMMAND_RECEIPT_SERVICE_SELECT_REQUEST_HASH_RESPONSE_JSON_TEXT = "SELECT request_hash, response_json::text ";
    public static final String WORKSPACE_IAM_COMMAND_RECEIPT_SERVICE_FROM_CLAUSE_WORKSPACE_COMMAND_RECEIPT = "FROM workspace_iam.workspace_command_receipt WHERE workspace_uuid=? AND idempotency_key=?";
    public static final String WORKSPACE_IAM_COMMAND_RECEIPT_SERVICE_INSERT_INTO_WORKSPACE_COMMAND_RECEIPT = "INSERT INTO workspace_iam.workspace_command_receipt ";
    public static final String WORKSPACE_IAM_COMMAND_RECEIPT_SERVICE_OPEN_PAREN_WORKSPACE_UUID = "(workspace_uuid, idempotency_key, request_hash, response_json, created_at_epoch_millis) ";
    public static final String WORKSPACE_IAM_COMMAND_RECEIPT_SERVICE_VALUES_VALUES_JSONB = "VALUES (?, ?, ?, ?::jsonb, ?)";
}
