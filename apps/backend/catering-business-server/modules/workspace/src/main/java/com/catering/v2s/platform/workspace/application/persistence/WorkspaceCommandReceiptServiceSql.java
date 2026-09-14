package com.catering.v2s.platform.workspace.application.persistence;

/** SQL text owned by WorkspaceCommandReceiptPersistence; B3 relocates text without changing execution. */
public final class WorkspaceCommandReceiptServiceSql {
    public static final String LOCK = "SELECT pg_advisory_xact_lock(hashtext(? || ':' || ?))";
    public static final String FIND = "SELECT request_hash, response_json::text FROM platform_workspace.workspace_command_receipt WHERE "
            + "group_workspace_key=? AND idempotency_key=?";
    public static final String UPGRADE_LEGACY_RESPONSE = "UPDATE platform_workspace.workspace_command_receipt SET response_json=?::jsonb WHERE "
            + "group_workspace_key=? AND idempotency_key=?";
    public static final String INSERT = "INSERT INTO platform_workspace.workspace_command_receipt (group_workspace_key, workspace_uuid, "
            + "idempotency_key, request_hash, response_json, created_at_epoch_millis) VALUES (?, ?, ?, "
            + "?, ?::jsonb, ?)";
}
