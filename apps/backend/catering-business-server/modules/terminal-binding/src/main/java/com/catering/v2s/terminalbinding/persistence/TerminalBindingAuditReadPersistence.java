package com.catering.v2s.terminalbinding.persistence;

import com.catering.v2s.audit.contract.AuditHistoryResultSetReader;
import com.catering.v2s.audit.contract.AuditReadScope;
import com.catering.v2s.platform.foundation.persistence.ReadBudgetComponent;
import java.sql.Array;
import java.sql.SQLException;
import java.util.Set;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Single-query authorization and page projection for terminal-binding audit history. */
@Repository
public class TerminalBindingAuditReadPersistence {
    private final JdbcTemplate jdbc;

    public TerminalBindingAuditReadPersistence(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public AuditHistoryResultSetReader.AuthorizedProjection read(
            AuditReadScope scope, Set<UUID> visibleStoreRefs, UUID terminalRef, long page, long pageSize) {
        long offset = Math.multiplyExact(page - 1, pageSize);
        UUID[] visibleStores = visibleStoreRefs.toArray(UUID[]::new);
        return ReadBudgetComponent.measure(
                ReadBudgetComponent.Component.PRIMARY_QUERY,
                () -> jdbc.query(
                        """
                        WITH target AS (
                          SELECT terminal.store_ref
                          FROM store_terminal.terminal terminal
                          WHERE terminal.terminal_ref=? AND terminal.workspace_uuid=?
                            AND terminal.group_workspace_key=?
                        ), auth_scope AS (
                          SELECT target.store_ref IS NOT NULL AS found,
                                 COALESCE(target.store_ref = ANY(?::uuid[]), FALSE) AS authorized
                          FROM (VALUES (1)) input(value)
                          LEFT JOIN target ON TRUE
                        ), events AS (
                          SELECT event.id AS audit_id, event.occurred_at_epoch_millis, event.actor_display_snapshot,
                                 event.action, event.entity_type, event.entity_ref_text,
                                 event.changes_json::text AS changes_json, count(*) OVER () AS total
                          FROM terminal_binding.audit_event event
                          CROSS JOIN auth_scope
                          WHERE auth_scope.found AND auth_scope.authorized
                            AND event.workspace_uuid=? AND event.group_workspace_key=?
                            AND event.entity_type='TERMINAL_BINDING' AND event.entity_ref_text=?
                        ), summary AS (SELECT COALESCE(MAX(total), 0) AS total FROM events)
                        SELECT auth_scope.found, auth_scope.authorized, summary.total,
                               page.audit_id, page.occurred_at_epoch_millis, page.actor_display_snapshot,
                               page.action, page.entity_type, page.entity_ref_text, page.changes_json
                        FROM auth_scope
                        CROSS JOIN summary
                        LEFT JOIN LATERAL (
                          SELECT * FROM events
                          ORDER BY occurred_at_epoch_millis DESC, audit_id DESC
                          LIMIT ? OFFSET ?
                        ) page ON TRUE
                        """,
                        statement -> {
                            statement.setObject(1, terminalRef);
                            statement.setObject(2, scope.workspaceUuid());
                            statement.setString(3, scope.groupWorkspaceKey());
                            statement.setArray(4, visibleStores(statement, visibleStores));
                            statement.setObject(5, scope.workspaceUuid());
                            statement.setString(6, scope.groupWorkspaceKey());
                            statement.setString(7, terminalRef.toString());
                            statement.setLong(8, pageSize);
                            statement.setLong(9, offset);
                        },
                        AuditHistoryResultSetReader::readAuthorized));
    }

    private static Array visibleStores(java.sql.PreparedStatement statement, UUID[] visibleStoreRefs)
            throws SQLException {
        return statement.getConnection().createArrayOf("uuid", visibleStoreRefs);
    }
}
