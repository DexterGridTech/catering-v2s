package com.catering.v2s.extension.application.persistence;

/** SQL text owned by ExtensionCommandReceiptService; B3 relocates text without changing execution. */
public final class ExtensionCommandReceiptServiceSql {
    public static final String EXTENSION_COMMAND_RECEIPT_SERVICE_UPDATE_EXTENSION_COMMAND_RECEIPT_RESPONSE_JSON = "UPDATE extension.extension_command_receipt SET response_json=CAST(? AS JSONB), ";
    public static final String EXTENSION_COMMAND_RECEIPT_SERVICE_STATE_SUCCEEDED_WORKSPACE_UUID_IDEMPOTENCY_KEY = "state='SUCCEEDED' WHERE workspace_uuid=? AND idempotency_key=? AND ";
    public static final String EXTENSION_COMMAND_RECEIPT_SERVICE_STATE_IN_PROGRESS = "state='IN_PROGRESS'";
    public static final String EXTENSION_COMMAND_RECEIPT_SERVICE_INSERT_INTO_EXTENSION_COMMAND_RECEIPT = "INSERT INTO extension.extension_command_receipt (idempotency_key, workspace_uuid, ";
    public static final String EXTENSION_COMMAND_RECEIPT_SERVICE_GROUP_WORKSPACE_KEY = "group_workspace_key, entity_type, request_hash, response_json, state, ";
    public static final String EXTENSION_COMMAND_RECEIPT_SERVICE_CREATED_AT_EPOCH_MILLIS_IN_PROGRESS = "created_at_epoch_millis) VALUES (?, ?, ?, ?, ?, '{}'::jsonb, 'IN_PROGRESS', ?) ";
    public static final String EXTENSION_COMMAND_RECEIPT_SERVICE_JOIN_CONDITION_WORKSPACE_UUID_IDEMPOTENCY_KEY = "ON CONFLICT (workspace_uuid, idempotency_key) DO NOTHING";
    public static final String EXTENSION_COMMAND_RECEIPT_SERVICE_SELECT_EXTENSION_COMMAND_RECEIPT = "SELECT request_hash, response_json::text, state FROM extension.extension_command_receipt WHERE ";
    public static final String EXTENSION_COMMAND_RECEIPT_SERVICE_WORKSPACE_UUID_IDEMPOTENCY_KEY = "workspace_uuid=? AND idempotency_key=?";
}
