package com.catering.v2s.platform.workspace.application.persistence;

import com.catering.v2s.platform.foundation.persistence.AdvisoryLock;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Typed JDBC execution for workspace command receipts and their transaction lock. */
@Repository
public class WorkspaceCommandReceiptPersistence {
    private final JdbcTemplate jdbc;

    public WorkspaceCommandReceiptPersistence(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record Receipt(String requestHash, String responseJson) {}

    public void lock(String groupWorkspaceKey, String idempotencyKey) {
        AdvisoryLock.acquireHashText(jdbc, groupWorkspaceKey + ":" + idempotencyKey);
    }

    public Optional<Receipt> find(String groupWorkspaceKey, String idempotencyKey) {
        return Optional.ofNullable(jdbc.query(
                WorkspaceCommandReceiptServiceSql.FIND,
                statement -> {
                    statement.setString(1, groupWorkspaceKey);
                    statement.setString(2, idempotencyKey);
                },
                result -> result.next() ? mapReceipt(result) : null));
    }

    public void upgradeLegacyResponse(String groupWorkspaceKey, String idempotencyKey, String responseJson) {
        jdbc.update(
                WorkspaceCommandReceiptServiceSql.UPGRADE_LEGACY_RESPONSE,
                responseJson,
                groupWorkspaceKey,
                idempotencyKey);
    }

    public void insert(
            String groupWorkspaceKey,
            UUID workspaceUuid,
            String idempotencyKey,
            String requestHash,
            String responseJson,
            long createdAtEpochMillis) {
        jdbc.update(
                WorkspaceCommandReceiptServiceSql.INSERT,
                groupWorkspaceKey,
                workspaceUuid,
                idempotencyKey,
                requestHash,
                responseJson,
                createdAtEpochMillis);
    }

    private static Receipt mapReceipt(ResultSet result) throws SQLException {
        return new Receipt(result.getString(1), result.getString(2));
    }
}
