package com.catering.v2s.extension.application;

import com.catering.v2s.audit.contract.*;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Owner-local reader for extension-definition revision history. */
@Service public class ExtensionAuditHistoryService {
  private final JdbcTemplate jdbc; public ExtensionAuditHistoryService(JdbcTemplate jdbc) { this.jdbc = jdbc; }
  @Transactional(readOnly = true) public AuditHistoryPage read(AuditReadScope scope, AuditTarget target, long page, long pageSize) {
    if (!"EXTENSION_DEFINITION".equals(target.entityType()) || page < 1 || pageSize < 1 || pageSize > 100) throw new IllegalArgumentException("unsupported extension audit target");
    Boolean exists = jdbc.query("SELECT EXISTS(SELECT 1 FROM extension.extension_definition WHERE group_workspace_key=? AND entity_type=?)", statement -> { statement.setString(1, scope.groupWorkspaceKey()); statement.setString(2, target.entityRef()); }, result -> result.next() && result.getBoolean(1));
    if (!Boolean.TRUE.equals(exists)) throw new ExtensionDefinitionService.DefinitionNotFoundException();
    long total = jdbc.queryForObject("SELECT count(*) FROM extension.audit_event WHERE workspace_uuid=? AND group_workspace_key=? AND entity_type='EXTENSION_DEFINITION' AND entity_ref_text=?", Long.class, scope.workspaceUuid(), scope.groupWorkspaceKey(), target.entityRef());
    List<AuditHistoryItem> items = jdbc.query("SELECT id, occurred_at_epoch_millis, actor_display_snapshot, action, entity_type, entity_ref_text, changes_json::text FROM extension.audit_event WHERE workspace_uuid=? AND group_workspace_key=? AND entity_type='EXTENSION_DEFINITION' AND entity_ref_text=? ORDER BY occurred_at_epoch_millis DESC, id DESC LIMIT ? OFFSET ?", (r, n) -> new AuditHistoryItem(r.getObject("id", UUID.class), r.getLong("occurred_at_epoch_millis"), r.getString("actor_display_snapshot"), r.getString("action"), new AuditTarget(r.getString("entity_type"), r.getString("entity_ref_text")), AuditChangeJson.read(r.getString("changes_json"))), scope.workspaceUuid(), scope.groupWorkspaceKey(), target.entityRef(), pageSize, (page - 1) * pageSize);
    return new AuditHistoryPage(items, page, pageSize, total);
  }
  @Transactional(readOnly = true) public AuditHistoryPage readExtensionDefinition(AuditReadScope scope, String entityType, long page, long pageSize) {
    if (page < 1 || pageSize < 1 || pageSize > 100) throw new IllegalArgumentException("unsupported extension audit target");
    long offset = Math.multiplyExact(page - 1, pageSize);
    PageProjection value = jdbc.query("""
        WITH target AS (SELECT 1 FROM extension.extension_definition WHERE group_workspace_key=? AND entity_type=?),
        events AS (
          SELECT id, occurred_at_epoch_millis, actor_display_snapshot, action, entity_type, entity_ref_text,
                 changes_json::text AS changes_json, count(*) OVER () AS total
          FROM extension.audit_event
          WHERE EXISTS (SELECT 1 FROM target) AND workspace_uuid=? AND group_workspace_key=?
            AND entity_type='EXTENSION_DEFINITION' AND entity_ref_text=?
        ), summary AS (SELECT COALESCE(MAX(total), 0) AS total FROM events)
        SELECT EXISTS (SELECT 1 FROM target) AS target_exists, summary.total,
               page.event_id, page.occurred_at_epoch_millis, page.actor_display_snapshot, page.action,
               page.entity_type, page.entity_ref_text, page.changes_json
        FROM summary LEFT JOIN LATERAL (
          SELECT id AS event_id, occurred_at_epoch_millis, actor_display_snapshot, action, entity_type,
                 entity_ref_text, changes_json FROM events
          ORDER BY occurred_at_epoch_millis DESC, id DESC LIMIT ? OFFSET ?
        ) page ON TRUE
        """, statement -> {
          statement.setString(1, scope.groupWorkspaceKey()); statement.setString(2, entityType);
          statement.setObject(3, scope.workspaceUuid()); statement.setString(4, scope.groupWorkspaceKey());
          statement.setString(5, entityType); statement.setLong(6, pageSize); statement.setLong(7, offset);
        }, ExtensionAuditHistoryService::projection);
    if (!value.targetExists()) throw new ExtensionDefinitionService.DefinitionNotFoundException();
    return new AuditHistoryPage(value.items(), page, pageSize, value.total());
  }

  private static PageProjection projection(java.sql.ResultSet rows) throws java.sql.SQLException {
    boolean targetExists = false; long total = 0; List<AuditHistoryItem> items = new java.util.ArrayList<>();
    while (rows.next()) {
      targetExists = rows.getBoolean("target_exists"); total = rows.getLong("total");
      UUID id = rows.getObject("event_id", UUID.class);
      if (id != null) items.add(new AuditHistoryItem(id, rows.getLong("occurred_at_epoch_millis"), rows.getString("actor_display_snapshot"), rows.getString("action"), new AuditTarget(rows.getString("entity_type"), rows.getString("entity_ref_text")), AuditChangeJson.read(rows.getString("changes_json"))));
    }
    return new PageProjection(targetExists, List.copyOf(items), total);
  }
  private record PageProjection(boolean targetExists, List<AuditHistoryItem> items, long total) { }
}
