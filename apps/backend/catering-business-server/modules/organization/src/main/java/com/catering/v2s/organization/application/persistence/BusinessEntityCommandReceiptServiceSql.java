package com.catering.v2s.organization.application.persistence;

/**
 * SQL text fragments owned by BusinessEntityCommandReceiptService; B3 relocates text only and does not change
 * execution.
 */
public final class BusinessEntityCommandReceiptServiceSql {
    public static final String UPDATE_ORG_CMD_RECEIPT_ENTITY_001 =
            ("UPDATE organization.organization_command_receipt SET entity_id=?, respon" + "se_json=CAST(? AS JSONB), ");
    public static final String BUSINESS_ENTITY_COMMAND_RECEIPT_SERVICE_STATE_SUCCEEDED_WORKSPACE_UUID_IDEMPOTENCY_KEY =
            "state='SUCCEEDED' WHERE workspace_uuid=? AND idempotency_key=? AND state='IN_PROGRESS'";
    public static final String UPDATE_ORG_CMD_RECEIPT_ENTITY_ALT_A_002 =
            "UPDATE organization.organization_command_receipt SET entity_id=?, response_json=?::jsonb, ";
    public static final String STATE_SUCCEEDED_WS_UUID_IDEMPOTENCY_ALT_A_003 =
            "state='SUCCEEDED' WHERE workspace_uuid=? AND idempotency_key=? AND state='IN_PROGRESS'";
    public static final String BUSINESS_ENTITY_COMMAND_RECEIPT_SERVICE_INSERT_INTO_ORGANIZATION_COMMAND_RECEIPT =
            "INSERT INTO organization.organization_command_receipt (workspace_uuid, idempotency_key, request_hash, ";
    public static final String BUSINESS_ENTITY_COMMAND_RECEIPT_SERVICE_RESPONSE_JSON =
            "response_json, state, created_at_epoch_millis) VALUES (?, ?, ?, '{}'::jsonb, 'IN_PROGRESS', ";
    public static final String BUSINESS_ENTITY_COMMAND_RECEIPT_SERVICE_PARAMETER_PLACEHOLDER = "?) ";
    public static final String BUSINESS_ENTITY_COMMAND_RECEIPT_SERVICE_JOIN_CONDITION_WORKSPACE_UUID_IDEMPOTENCY_KEY =
            "ON CONFLICT (workspace_uuid, idempotency_key) DO NOTHING";
    public static final String BUSINESS_ENTITY_COMMAND_RECEIPT_SERVICE_SELECT_ORGANIZATION_COMMAND_RECEIPT =
            "SELECT request_hash, response_json::text, state FROM organization.organization_command_receipt WHERE ";
    public static final String BUSINESS_ENTITY_COMMAND_RECEIPT_SERVICE_WORKSPACE_UUID_IDEMPOTENCY_KEY =
            "workspace_uuid=? AND idempotency_key=?";
}
