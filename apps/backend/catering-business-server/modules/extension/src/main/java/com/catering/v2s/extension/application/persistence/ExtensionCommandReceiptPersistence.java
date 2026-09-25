package com.catering.v2s.extension.application.persistence;

import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Typed persistence execution boundary for extension command receipts. */
@Repository
public class ExtensionCommandReceiptPersistence {
    private final JdbcTemplate jdbc;
    private final com.catering.v2s.platform.foundation.time.TimeProvider time;

    public ExtensionCommandReceiptPersistence(
            JdbcTemplate jdbc, com.catering.v2s.platform.foundation.time.TimeProvider time) {
        this.jdbc = jdbc;
        this.time = time;
    }

    public int claim(String key, UUID workspaceUuid, String groupWorkspaceKey, String entityType, String requestHash) {
        return jdbc.update(
                ExtensionCommandReceiptServiceSql
                                .EXTENSION_COMMAND_RECEIPT_SERVICE_INSERT_INTO_EXTENSION_COMMAND_RECEIPT
                        + ExtensionCommandReceiptServiceSql.EXTENSION_COMMAND_RECEIPT_SERVICE_GROUP_WORKSPACE_KEY
                        + ExtensionCommandReceiptServiceSql
                                .EXTENSION_COMMAND_RECEIPT_SERVICE_CREATED_AT_EPOCH_MILLIS_IN_PROGRESS
                        + ExtensionCommandReceiptServiceSql
                                .EXTENSION_COMMAND_RECEIPT_SERVICE_JOIN_CONDITION_WORKSPACE_UUID_IDEMPOTENCY_KEY,
                key,
                workspaceUuid,
                groupWorkspaceKey,
                entityType,
                requestHash,
                time.currentEpochMillis());
    }

    public Receipt find(UUID workspaceUuid, String key) {
        return jdbc.query(
                ExtensionCommandReceiptServiceSql.EXTENSION_COMMAND_RECEIPT_SERVICE_SELECT_EXTENSION_COMMAND_RECEIPT
                        + ExtensionCommandReceiptServiceSql
                                .EXTENSION_COMMAND_RECEIPT_SERVICE_WORKSPACE_UUID_IDEMPOTENCY_KEY,
                statement -> {
                    statement.setObject(1, workspaceUuid);
                    statement.setString(2, key);
                },
                result -> result.next()
                        ? new Receipt(result.getString(1), result.getString(2), result.getString(3))
                        : null);
    }

    public int complete(UUID workspaceUuid, String key, String responseJson) {
        return jdbc.update(
                ExtensionCommandReceiptServiceSql
                                .EXTENSION_COMMAND_RECEIPT_SERVICE_UPDATE_EXTENSION_COMMAND_RECEIPT_RESPONSE_JSON
                        + ExtensionCommandReceiptServiceSql
                                .EXTENSION_COMMAND_RECEIPT_SERVICE_STATE_SUCCEEDED_WORKSPACE_UUID_IDEMPOTENCY_KEY
                        + ExtensionCommandReceiptServiceSql.EXTENSION_COMMAND_RECEIPT_SERVICE_STATE_IN_PROGRESS,
                responseJson,
                workspaceUuid,
                key);
    }

    public record Receipt(String requestHash, String responseJson, String state) {}
}
