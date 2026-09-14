package com.catering.v2s.platform.workspace.application.persistence;

import com.catering.v2s.audit.contract.AuditChangeJson;
import com.catering.v2s.audit.contract.AuditHistoryItem;
import com.catering.v2s.audit.contract.AuditReadScope;
import com.catering.v2s.audit.contract.AuditTarget;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Typed JDBC execution for the workspace-owned audit projection. */
@Repository
public class PlatformWorkspaceAuditHistoryPersistence {
    private final JdbcTemplate jdbc;

    public PlatformWorkspaceAuditHistoryPersistence(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record GroupWorkspaceProjection(
            boolean targetExists, String auditRef, List<AuditHistoryItem> items, long total) {}

    public GroupWorkspaceProjection readGroupWorkspace(
            AuditReadScope scope, String groupWorkspaceKey, long fetchSize) {
        return jdbc.query(
                PlatformWorkspaceAuditHistoryServiceSql.PAGE,
                statement -> {
                    statement.setString(1, groupWorkspaceKey);
                    statement.setObject(2, scope.workspaceUuid());
                    statement.setObject(3, scope.workspaceUuid());
                    statement.setString(4, scope.groupWorkspaceKey());
                    statement.setLong(5, fetchSize);
                },
                PlatformWorkspaceAuditHistoryPersistence::mapProjection);
    }

    private static GroupWorkspaceProjection mapProjection(ResultSet rows) throws SQLException {
        boolean targetExists = false;
        String auditRef = null;
        long total = 0;
        List<AuditHistoryItem> items = new ArrayList<>();
        while (rows.next()) {
            targetExists = rows.getBoolean("target_exists");
            auditRef = rows.getString("audit_ref");
            total = rows.getLong("total");
            UUID id = rows.getObject("event_id", UUID.class);
            if (id != null) {
                items.add(new AuditHistoryItem(
                        id,
                        rows.getLong("occurred_at_epoch_millis"),
                        rows.getString("actor_display_snapshot"),
                        rows.getString("action"),
                        new AuditTarget(rows.getString("entity_type"), rows.getString("entity_ref_text")),
                        AuditChangeJson.read(rows.getString("changes_json"))));
            }
        }
        return new GroupWorkspaceProjection(targetExists, auditRef, List.copyOf(items), total);
    }
}
