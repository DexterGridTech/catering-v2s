package com.catering.v2s.businesschannel.application.persistence;

/** SQL text owned by BusinessChannelCommandReceiptService; B3 relocates text without changing execution. */
public final class BusinessChannelCommandReceiptServiceSql {
    public static final String
            BUSINESS_CHANNEL_COMMAND_RECEIPT_SERVICE_SELECT_COMMAND_RECEIPT_REQUEST_HASH_RESPONSE_JSON_TEXT =
                    "SELECT request_hash, response_json::text FROM business_channel.command_receipt ";
    public static final String
            BUSINESS_CHANNEL_COMMAND_RECEIPT_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_IDEMPOTENCY_KEY =
                    "WHERE workspace_uuid=? AND group_workspace_key=? AND idempotency_key=?";
    public static final String
            BUSINESS_CHANNEL_COMMAND_RECEIPT_SERVICE_INSERT_INTO_COMMAND_RECEIPT_INSERT_INTO_BUSINESS_CHANNEL =
                    "INSERT INTO business_channel.command_receipt ";
    public static final String BUSINESS_CHANNEL_COMMAND_RECEIPT_SERVICE_OPEN_PAREN_RECEIPT_REF =
            "(receipt_ref, workspace_uuid, group_workspace_key, idempotency_key, operation_id, ";
    public static final String BUSINESS_CHANNEL_COMMAND_RECEIPT_SERVICE_REQUEST_HASH =
            "request_hash, response_json, created_at_epoch_millis) ";
    public static final String BUSINESS_CHANNEL_COMMAND_RECEIPT_SERVICE_VALUES_VALUES_JSONB =
            "VALUES (?, ?, ?, ?, ?, ?, ?::jsonb, ?)";
}
