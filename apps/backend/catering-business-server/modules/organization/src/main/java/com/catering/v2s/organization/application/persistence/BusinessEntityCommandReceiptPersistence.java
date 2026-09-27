package com.catering.v2s.organization.application.persistence;

import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Typed JDBC boundary for organization business-entity command receipts. */
@Repository
public class BusinessEntityCommandReceiptPersistence {
    private final JdbcTemplate jdbc;

    public BusinessEntityCommandReceiptPersistence(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public int markSucceeded(UUID entityId, String responseJson, UUID workspaceUuid, String idempotencyKey) {
        return jdbc.update(
                BusinessEntityCommandReceiptServiceSql.UPDATE_ORG_CMD_RECEIPT_ENTITY_ALT_A_002
                        + BusinessEntityCommandReceiptServiceSql.STATE_SUCCEEDED_WS_UUID_IDEMPOTENCY_ALT_A_003,
                entityId,
                responseJson,
                workspaceUuid,
                idempotencyKey);
    }

    public int markAuthorizationSucceeded(UUID headCompanyId, UUID workspaceUuid, String idempotencyKey) {
        return jdbc.update(
                BusinessEntityCommandReceiptServiceSql.UPDATE_ORG_CMD_RECEIPT_ENTITY_001
                        + BusinessEntityCommandReceiptServiceSql
                                .BUSINESS_ENTITY_COMMAND_RECEIPT_SERVICE_STATE_SUCCEEDED_WORKSPACE_UUID_IDEMPOTENCY_KEY,
                headCompanyId,
                "{\"status\":204}",
                workspaceUuid,
                idempotencyKey);
    }

    public int claim(UUID workspaceUuid, String idempotencyKey, String requestHash, long createdAtEpochMillis) {
        return jdbc.update(
                BusinessEntityCommandReceiptServiceSql
                                .BUSINESS_ENTITY_COMMAND_RECEIPT_SERVICE_INSERT_INTO_ORGANIZATION_COMMAND_RECEIPT
                        + BusinessEntityCommandReceiptServiceSql.BUSINESS_ENTITY_COMMAND_RECEIPT_SERVICE_RESPONSE_JSON
                        + BusinessEntityCommandReceiptServiceSql
                                .BUSINESS_ENTITY_COMMAND_RECEIPT_SERVICE_PARAMETER_PLACEHOLDER
                        + BusinessEntityCommandReceiptServiceSql
                                .BUSINESS_ENTITY_COMMAND_RECEIPT_SERVICE_JOIN_CONDITION_WORKSPACE_UUID_IDEMPOTENCY_KEY,
                workspaceUuid,
                idempotencyKey,
                requestHash,
                createdAtEpochMillis);
    }

    public Receipt read(UUID workspaceUuid, String idempotencyKey) {
        return jdbc.query(
                BusinessEntityCommandReceiptServiceSql
                                .BUSINESS_ENTITY_COMMAND_RECEIPT_SERVICE_SELECT_ORGANIZATION_COMMAND_RECEIPT
                        + BusinessEntityCommandReceiptServiceSql
                                .BUSINESS_ENTITY_COMMAND_RECEIPT_SERVICE_WORKSPACE_UUID_IDEMPOTENCY_KEY,
                statement -> {
                    statement.setObject(1, workspaceUuid);
                    statement.setString(2, idempotencyKey);
                },
                result -> result.next()
                        ? new Receipt(result.getString(1), result.getString(2), result.getString(3))
                        : null);
    }

    public record Receipt(String requestHash, String responseJson, String state) {}
}
