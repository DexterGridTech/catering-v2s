package com.catering.v2s.workspace.iam.application.persistence;

import com.catering.v2s.platform.foundation.persistence.AdvisoryLock;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Typed execution boundary for workspace-IAM command receipt locking and storage. */
@Repository
public class WorkspaceIamCommandReceiptPersistence {
    private final JdbcTemplate jdbc;

    @Autowired
    public WorkspaceIamCommandReceiptPersistence(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void acquireLock(UUID workspaceUuid, String key) {
        AdvisoryLock.acquire(jdbc, "workspace-iam-receipt", workspaceUuid.toString(), key);
    }

    public ReceiptRow find(UUID workspaceUuid, String key) {
        return jdbc.query(
                WorkspaceIamCommandReceiptServiceSql
                                .WORKSPACE_IAM_COMMAND_RECEIPT_SERVICE_SELECT_REQUEST_HASH_RESPONSE_JSON_TEXT
                        + WorkspaceIamCommandReceiptServiceSql
                                .WORKSPACE_IAM_COMMAND_RECEIPT_SERVICE_FROM_CLAUSE_WORKSPACE_COMMAND_RECEIPT,
                statement -> {
                    statement.setObject(1, workspaceUuid);
                    statement.setString(2, key);
                },
                result -> result.next() ? new ReceiptRow(result.getString(1), result.getString(2)) : null);
    }

    public void insert(
            UUID workspaceUuid, String key, String requestHash, String responseJson, long createdAtEpochMillis) {
        jdbc.update(
                WorkspaceIamCommandReceiptServiceSql
                                .WORKSPACE_IAM_COMMAND_RECEIPT_SERVICE_INSERT_INTO_WORKSPACE_COMMAND_RECEIPT
                        + WorkspaceIamCommandReceiptServiceSql
                                .WORKSPACE_IAM_COMMAND_RECEIPT_SERVICE_OPEN_PAREN_WORKSPACE_UUID
                        + WorkspaceIamCommandReceiptServiceSql
                                .WORKSPACE_IAM_COMMAND_RECEIPT_SERVICE_VALUES_VALUES_JSONB,
                workspaceUuid,
                key,
                requestHash,
                responseJson,
                createdAtEpochMillis);
    }

    public record ReceiptRow(String requestHash, String responseJson) {}
}
