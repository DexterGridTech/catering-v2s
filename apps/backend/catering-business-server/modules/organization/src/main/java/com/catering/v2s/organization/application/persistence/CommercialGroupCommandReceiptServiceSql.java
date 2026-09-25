package com.catering.v2s.organization.application.persistence;

/**
 * SQL text fragments owned by CommercialGroupCommandReceiptService; B3 relocates text only and does not change
 * execution.
 */
public final class CommercialGroupCommandReceiptServiceSql {
    public static final String COMMERCIAL_GROUP_COMMAND_RECEIPT_SERVICE_SELECT_COMMERCIAL_GROUP_COMMAND_RECEIPT =
            "SELECT request_hash, response_json::text FROM organization.commercial_group_command_receipt WHERE ";
    public static final String COMMERCIAL_GROUP_COMMAND_RECEIPT_SERVICE_WORKSPACE_UUID_IDEMPOTENCY_KEY =
            "workspace_uuid=? AND idempotency_key=?";
    public static final String
            COMMERCIAL_GROUP_COMMAND_RECEIPT_SERVICE_UPDATE_COMMERCIAL_GROUP_COMMAND_RECEIPT_RESPONSE_JSON =
                    "UPDATE organization.commercial_group_command_receipt SET response_json=?::jsonb WHERE ";
    public static final String COMMERCIAL_GROUP_COMMAND_RECEIPT_SERVICE_WORKSPACE_UUID_IDEMPOTENCY_KEY_ALTERNATE_A =
            "workspace_uuid=? AND idempotency_key=?";
    public static final String COMMERCIAL_GROUP_COMMAND_RECEIPT_SERVICE_INSERT_INTO_COMMERCIAL_GROUP_COMMAND_RECEIPT =
            "INSERT INTO organization.commercial_group_command_receipt (workspace_uuid, idempotency_key, ";
    public static final String COMMERCIAL_GROUP_COMMAND_RECEIPT_SERVICE_COMMERCIAL_GROUP_UUID =
            "commercial_group_uuid, request_hash, response_json, state, created_at_epoch_millis) ";
    public static final String COMMERCIAL_GROUP_COMMAND_RECEIPT_SERVICE_VALUES = "VALUES ";
    public static final String COMMERCIAL_GROUP_COMMAND_RECEIPT_SERVICE_OPEN_PAREN_SUCCEEDED =
            "(?, ?, ?, ?, ?::jsonb, 'SUCCEEDED', ?)";
}
