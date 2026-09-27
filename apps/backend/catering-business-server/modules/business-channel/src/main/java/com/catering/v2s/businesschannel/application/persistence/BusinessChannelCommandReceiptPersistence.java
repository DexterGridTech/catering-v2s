package com.catering.v2s.businesschannel.application.persistence;

import com.catering.v2s.platform.foundation.persistence.AdvisoryLock;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Typed persistence execution for business-channel command receipts. */
@Repository
public class BusinessChannelCommandReceiptPersistence {
    private final JdbcTemplate jdbc;

    public BusinessChannelCommandReceiptPersistence(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record Receipt(String requestHash, String responseJson) {}

    public void lock(UUID workspaceUuid, String groupWorkspaceKey, String idempotencyKey) {
        AdvisoryLock.acquireHashTextPair(jdbc, workspaceUuid.toString(), groupWorkspaceKey + ":" + idempotencyKey);
    }

    public Optional<Receipt> find(UUID workspaceUuid, String groupWorkspaceKey, String idempotencyKey) {
        return jdbc.query(
                BusinessChannelCommandReceiptServiceSql.SELECT_CMD_RECEIPT_REQ_HASH_001
                        + BusinessChannelCommandReceiptServiceSql.WHERE_WS_UUID_GRP_WS_002,
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
                BusinessChannelCommandReceiptServiceSql.INSERT_INTO_CMD_RECEIPT_INSERT_003
                        + BusinessChannelCommandReceiptServiceSql
                                .BUSINESS_CHANNEL_COMMAND_RECEIPT_SERVICE_OPEN_PAREN_RECEIPT_REF
                        + BusinessChannelCommandReceiptServiceSql.BUSINESS_CHANNEL_COMMAND_RECEIPT_SERVICE_REQUEST_HASH
                        + BusinessChannelCommandReceiptServiceSql
                                .BUSINESS_CHANNEL_COMMAND_RECEIPT_SERVICE_VALUES_VALUES_JSONB,
                receiptRef,
                workspaceUuid,
                groupWorkspaceKey,
                idempotencyKey,
                operationId,
                requestHash,
                responseJson,
                createdAtEpochMillis);
    }
}
