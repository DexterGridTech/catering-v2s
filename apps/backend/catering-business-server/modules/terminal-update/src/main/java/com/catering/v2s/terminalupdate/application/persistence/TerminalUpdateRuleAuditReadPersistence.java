package com.catering.v2s.terminalupdate.application.persistence;

import com.catering.v2s.audit.contract.AuditHistoryResultSetReader;
import com.catering.v2s.audit.contract.AuditReadScope;
import com.catering.v2s.platform.foundation.persistence.ReadBudgetComponent;
import java.sql.Array;
import java.sql.SQLException;
import java.util.Set;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Single-query project authorization and page projection for rule audit history. */
@Repository
public class TerminalUpdateRuleAuditReadPersistence {
    private final JdbcTemplate jdbc;

    public TerminalUpdateRuleAuditReadPersistence(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public AuditHistoryResultSetReader.AuthorizedProjection read(
            AuditReadScope scope, Set<UUID> visibleProjectRefs, UUID projectRef, UUID ruleRef, long page, long pageSize) {
        long offset = Math.multiplyExact(page - 1, pageSize);
        UUID[] visibleProjects = visibleProjectRefs.toArray(UUID[]::new);
        return ReadBudgetComponent.measure(ReadBudgetComponent.Component.PRIMARY_QUERY, () -> jdbc.query(
                """
                WITH target AS (
                  SELECT rule_ref FROM terminal_update.project_rule
                  WHERE rule_ref=? AND project_ref=? AND workspace_uuid=? AND group_workspace_key=?
                ), auth_scope AS (
                  SELECT EXISTS(SELECT 1 FROM target) AS found,
                         COALESCE(? = ANY(?::uuid[]), FALSE) AS authorized
                ), events AS (
                  SELECT event.id AS audit_id,event.occurred_at_epoch_millis,event.actor_display_snapshot,
                         event.action,event.entity_type,event.entity_ref_text,event.changes_json::text AS changes_json,
                         count(*) OVER () AS total
                  FROM terminal_update.audit_event event CROSS JOIN auth_scope
                  WHERE auth_scope.found AND auth_scope.authorized
                    AND event.workspace_uuid=? AND event.group_workspace_key=?
                    AND event.entity_type='TERMINAL_UPDATE_RULE' AND event.entity_ref_text=?
                ), summary AS (SELECT COALESCE(MAX(total),0) AS total FROM events)
                SELECT auth_scope.found,auth_scope.authorized,summary.total,
                       page_rows.audit_id,page_rows.occurred_at_epoch_millis,page_rows.actor_display_snapshot,
                       page_rows.action,page_rows.entity_type,page_rows.entity_ref_text,page_rows.changes_json
                FROM auth_scope CROSS JOIN summary
                LEFT JOIN LATERAL (
                  SELECT * FROM events ORDER BY occurred_at_epoch_millis DESC,audit_id DESC LIMIT ? OFFSET ?
                ) page_rows ON TRUE
                """,
                statement -> {
                    statement.setObject(1, ruleRef);
                    statement.setObject(2, projectRef);
                    statement.setObject(3, scope.workspaceUuid());
                    statement.setString(4, scope.groupWorkspaceKey());
                    statement.setObject(5, projectRef);
                    statement.setArray(6, projectRefs(statement, visibleProjects));
                    statement.setObject(7, scope.workspaceUuid());
                    statement.setString(8, scope.groupWorkspaceKey());
                    statement.setString(9, ruleRef.toString());
                    statement.setLong(10, pageSize);
                    statement.setLong(11, offset);
                }, AuditHistoryResultSetReader::readAuthorized));
    }

    private static Array projectRefs(java.sql.PreparedStatement statement, UUID[] refs) throws SQLException {
        return statement.getConnection().createArrayOf("uuid", refs);
    }
}
