package com.catering.v2s.collaboration.application.persistence;

import com.catering.v2s.platform.foundation.persistence.AdvisoryLock;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Typed persistence execution boundary for collaboration command receipts. */
@Repository
public class CollaborationCommandReceiptPersistence {
    private final JdbcTemplate jdbc;

    public CollaborationCommandReceiptPersistence(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void lock(UUID workspaceUuid, String groupWorkspaceKey, String idempotencyKey) {
        AdvisoryLock.acquireHashTextPair(jdbc, workspaceUuid.toString(), groupWorkspaceKey + ":" + idempotencyKey);
    }

    public Optional<Receipt> find(UUID workspaceUuid, String groupWorkspaceKey, String idempotencyKey) {
        return jdbc.query(
                CollaborationCommandReceiptServiceSql
                                .COLLABORATION_COMMAND_RECEIPT_SERVICE_SELECT_COMMAND_RECEIPT_REQUEST_HASH_RESPONSE_JSON_TEXT
                        + CollaborationCommandReceiptServiceSql
                                .COLLABORATION_COMMAND_RECEIPT_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_IDEMPOTENCY_KEY,
                statement -> {
                    statement.setObject(1, workspaceUuid);
                    statement.setString(2, groupWorkspaceKey);
                    statement.setString(3, idempotencyKey);
                },
                result -> result.next()
                        ? Optional.of(new Receipt(result.getString(1), result.getString(2)))
                        : Optional.empty());
    }

    public void insert(
            UUID receiptRef,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String idempotencyKey,
            String operationId,
            String requestHash,
            String responseJson,
            long createdAtEpochMillis) {
        jdbc.update(
                CollaborationCommandReceiptServiceSql
                                .COLLABORATION_COMMAND_RECEIPT_SERVICE_INSERT_INTO_COMMAND_RECEIPT_INSERT_INTO_COLLABORATION_CO
                        + CollaborationCommandReceiptServiceSql
                                .COLLABORATION_COMMAND_RECEIPT_SERVICE_OPEN_PAREN_RECEIPT_REF
                        + CollaborationCommandReceiptServiceSql.COLLABORATION_COMMAND_RECEIPT_SERVICE_REQUEST_HASH
                        + CollaborationCommandReceiptServiceSql
                                .COLLABORATION_COMMAND_RECEIPT_SERVICE_VALUES_VALUES_JSONB,
                receiptRef,
                workspaceUuid,
                groupWorkspaceKey,
                idempotencyKey,
                operationId,
                requestHash,
                responseJson,
                createdAtEpochMillis);
    }

    public record Receipt(String requestHash, String responseJson) {}
}
