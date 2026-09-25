package com.catering.v2s.organization.application.persistence;

/**
 * SQL text fragments owned by BusinessEntityCommandReceiptService; B3 relocates text only and does not change
 * execution.
 */
public final class BusinessEntityCommandReceiptServiceSql {
    public static final String
            BUSINESS_ENTITY_COMMAND_RECEIPT_SERVICE_UPDATE_ORGANIZATION_COMMAND_RECEIPT_ENTITY_ID_RESPONSE_JSON =
                    "UPDATE organization.organization_command_receipt SET entity_id=?, response_json=CAST(? AS JSONB), ";
    public static final String BUSINESS_ENTITY_COMMAND_RECEIPT_SERVICE_STATE_SUCCEEDED_WORKSPACE_UUID_IDEMPOTENCY_KEY =
            "state='SUCCEEDED' WHERE workspace_uuid=? AND idempotency_key=? AND state='IN_PROGRESS'";
    public static final String
            BUSINESS_ENTITY_COMMAND_RECEIPT_SERVICE_UPDATE_ORGANIZATION_COMMAND_RECEIPT_ENTITY_ID_RESPONSE_JSON_ALTERNATE_A =
                    "UPDATE organization.organization_command_receipt SET entity_id=?, response_json=?::jsonb, ";
    public static final String
            BUSINESS_ENTITY_COMMAND_RECEIPT_SERVICE_STATE_SUCCEEDED_WORKSPACE_UUID_IDEMPOTENCY_KEY_ALTERNATE_A =
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
