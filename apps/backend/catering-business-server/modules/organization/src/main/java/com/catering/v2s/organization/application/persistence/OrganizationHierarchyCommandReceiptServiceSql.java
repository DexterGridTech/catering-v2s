package com.catering.v2s.organization.application.persistence;

/**
 * SQL text fragments owned by OrganizationHierarchyCommandReceiptService; B3 relocates text only and does not change
 * execution.
 */
public final class OrganizationHierarchyCommandReceiptServiceSql {
    public static final String ORGANIZATION_HIERARCHY_COMMAND_RECEIPT_SERVICE_SELECT_ORGANIZATION_COMMAND_RECEIPT =
            "SELECT request_hash, response_json::text FROM organization.organization_command_receipt WHERE ";
    public static final String ORGANIZATION_HIERARCHY_COMMAND_RECEIPT_SERVICE_WORKSPACE_UUID_IDEMPOTENCY_KEY =
            "workspace_uuid=? AND idempotency_key=?";
    public static final String UPDATE_ORG_CMD_RECEIPT_RESP_001 =
            "UPDATE organization.organization_command_receipt SET response_json=?::jsonb WHERE ";
    public static final String WS_UUID_IDEMPOTENCY_KEY_ALT_A_002 = "workspace_uuid=? AND idempotency_key=?";
    public static final String ORGANIZATION_HIERARCHY_COMMAND_RECEIPT_SERVICE_INSERT_INTO_ORGANIZATION_COMMAND_RECEIPT =
            "INSERT INTO organization.organization_command_receipt (workspace_uuid, idempotency_key, ";
    public static final String ORGANIZATION_HIERARCHY_COMMAND_RECEIPT_SERVICE_ENTITY_ID =
            "entity_id, request_hash, response_json, state, created_at_epoch_millis) VALUES (?, ?, ";
    public static final String ORGANIZATION_HIERARCHY_COMMAND_RECEIPT_SERVICE_PARAMETER_PLACEHOLDER = "?, ?, ";
    public static final String ORGANIZATION_HIERARCHY_COMMAND_RECEIPT_SERVICE_PARAMETER_PLACEHOLDER_SUCCEEDED =
            "?::jsonb, 'SUCCEEDED', ?)";
}
