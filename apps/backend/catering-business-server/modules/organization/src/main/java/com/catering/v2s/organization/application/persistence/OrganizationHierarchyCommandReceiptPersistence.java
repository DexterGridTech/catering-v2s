package com.catering.v2s.organization.application.persistence;

import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Typed JDBC boundary for organization-hierarchy command receipts. */
@Repository
public class OrganizationHierarchyCommandReceiptPersistence {
    private final JdbcTemplate jdbc;

    public OrganizationHierarchyCommandReceiptPersistence(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Receipt read(UUID workspaceUuid, String idempotencyKey) {
        return jdbc.query(
                OrganizationHierarchyCommandReceiptServiceSql.ORGANIZATION_HIERARCHY_COMMAND_RECEIPT_SERVICE_SELECT_ORGANIZATION_COMMAND_RECEIPT
                        + OrganizationHierarchyCommandReceiptServiceSql.ORGANIZATION_HIERARCHY_COMMAND_RECEIPT_SERVICE_CONTINUATION_WORKSPACE_UUID_IDEMPOTENCY_KEY,
                statement -> {
                    statement.setObject(1, workspaceUuid);
                    statement.setString(2, idempotencyKey);
                },
                result -> result.next() ? new Receipt(result.getString(1), result.getString(2)) : null);
    }

    public int replaceResponse(String responseJson, UUID workspaceUuid, String idempotencyKey) {
        return jdbc.update(
                OrganizationHierarchyCommandReceiptServiceSql.ORGANIZATION_HIERARCHY_COMMAND_RECEIPT_SERVICE_UPDATE_ORGANIZATION_COMMAND_RECEIPT_RESPONSE_JSON
                        + OrganizationHierarchyCommandReceiptServiceSql.ORGANIZATION_HIERARCHY_COMMAND_RECEIPT_SERVICE_CONTINUATION_WORKSPACE_UUID_IDEMPOTENCY_KEY_ALTERNATE_A,
                responseJson,
                workspaceUuid,
                idempotencyKey);
    }

    public int insertSucceeded(
            UUID workspaceUuid,
            String idempotencyKey,
            UUID entityId,
            String requestHash,
            String responseJson,
            long createdAtEpochMillis) {
        return jdbc.update(
                OrganizationHierarchyCommandReceiptServiceSql.ORGANIZATION_HIERARCHY_COMMAND_RECEIPT_SERVICE_INSERT_INTO_ORGANIZATION_COMMAND_RECEIPT
                        + OrganizationHierarchyCommandReceiptServiceSql.ORGANIZATION_HIERARCHY_COMMAND_RECEIPT_SERVICE_CONTINUATION_ENTITY_ID
                        + OrganizationHierarchyCommandReceiptServiceSql.ORGANIZATION_HIERARCHY_COMMAND_RECEIPT_SERVICE_PARAMETER_PLACEHOLDER
                        + OrganizationHierarchyCommandReceiptServiceSql.ORGANIZATION_HIERARCHY_COMMAND_RECEIPT_SERVICE_PARAMETER_PLACEHOLDER_SUCCEEDED,
                workspaceUuid,
                idempotencyKey,
                entityId,
                requestHash,
                responseJson,
                createdAtEpochMillis);
    }

    public record Receipt(String requestHash, String responseJson) {}
}
