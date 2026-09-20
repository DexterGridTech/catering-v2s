package com.catering.v2s.platform.iam.application.persistence;

/** SQL text owned by PlatformCommandReceiptService; B3 relocates text without changing execution. */
public final class PlatformCommandReceiptServiceSql {
    public static final String FIND = "SELECT request_hash, response_json::text FROM platform_iam.platform_command_receipt WHERE "
            + "idempotency_key=?";
    public static final String UPGRADE_LEGACY_RESPONSE = "UPDATE platform_iam.platform_command_receipt SET response_json=?::jsonb WHERE "
            + "idempotency_key=?";
    public static final String INSERT = "INSERT INTO platform_iam.platform_command_receipt (idempotency_key, request_hash, response_json, "
            + "created_at_epoch_millis) VALUES (?, ?, ?::jsonb, ?)";

}
