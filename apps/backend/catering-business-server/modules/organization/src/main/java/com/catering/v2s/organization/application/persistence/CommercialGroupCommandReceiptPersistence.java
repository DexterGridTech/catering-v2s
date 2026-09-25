package com.catering.v2s.organization.application.persistence;

import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Typed JDBC boundary for commercial-group command receipts. */
@Repository
public class CommercialGroupCommandReceiptPersistence {
    private final JdbcTemplate jdbc;

    public CommercialGroupCommandReceiptPersistence(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Receipt read(UUID workspaceUuid, String idempotencyKey) {
        return jdbc.query(
                CommercialGroupCommandReceiptServiceSql
                                .COMMERCIAL_GROUP_COMMAND_RECEIPT_SERVICE_SELECT_COMMERCIAL_GROUP_COMMAND_RECEIPT
                        + CommercialGroupCommandReceiptServiceSql
                                .COMMERCIAL_GROUP_COMMAND_RECEIPT_SERVICE_WORKSPACE_UUID_IDEMPOTENCY_KEY,
                statement -> {
                    statement.setObject(1, workspaceUuid);
                    statement.setString(2, idempotencyKey);
                },
                result -> result.next() ? new Receipt(result.getString(1), result.getString(2)) : null);
    }

    public int replaceResponse(String responseJson, UUID workspaceUuid, String idempotencyKey) {
        return jdbc.update(
                CommercialGroupCommandReceiptServiceSql
                                .COMMERCIAL_GROUP_COMMAND_RECEIPT_SERVICE_UPDATE_COMMERCIAL_GROUP_COMMAND_RECEIPT_RESPONSE_JSON
                        + CommercialGroupCommandReceiptServiceSql
                                .COMMERCIAL_GROUP_COMMAND_RECEIPT_SERVICE_WORKSPACE_UUID_IDEMPOTENCY_KEY_ALTERNATE_A,
                responseJson,
                workspaceUuid,
                idempotencyKey);
    }

    public int insertSucceeded(
            UUID workspaceUuid,
            String idempotencyKey,
            UUID commercialGroupUuid,
            String requestHash,
            String responseJson,
            long createdAtEpochMillis) {
        return jdbc.update(
                CommercialGroupCommandReceiptServiceSql
                                .COMMERCIAL_GROUP_COMMAND_RECEIPT_SERVICE_INSERT_INTO_COMMERCIAL_GROUP_COMMAND_RECEIPT
                        + CommercialGroupCommandReceiptServiceSql
                                .COMMERCIAL_GROUP_COMMAND_RECEIPT_SERVICE_COMMERCIAL_GROUP_UUID
                        + CommercialGroupCommandReceiptServiceSql.COMMERCIAL_GROUP_COMMAND_RECEIPT_SERVICE_VALUES
                        + CommercialGroupCommandReceiptServiceSql
                                .COMMERCIAL_GROUP_COMMAND_RECEIPT_SERVICE_OPEN_PAREN_SUCCEEDED,
                workspaceUuid,
                idempotencyKey,
                commercialGroupUuid,
                requestHash,
                responseJson,
                createdAtEpochMillis);
    }

    public record Receipt(String requestHash, String responseJson) {}
}
