package com.catering.v2s.contract.application;

import com.catering.v2s.audit.contract.*;
import com.catering.v2s.organization.api.OrganizationVisibilityLookup.VisibleOrganizationFacts;
import com.catering.v2s.platform.foundation.persistence.ReadBudgetComponent;
import java.sql.Array;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Owner-local reader for store-contract audit facts. */
@Service public class ContractAuditHistoryService {
  private final JdbcTemplate jdbc; public ContractAuditHistoryService(JdbcTemplate jdbc) { this.jdbc = jdbc; }
  @Transactional(readOnly = true) public AuditHistoryPage read(AuditReadScope scope, AuditTarget target, long page, long pageSize) {
    if (!"STORE_CONTRACT".equals(target.entityType()) || page < 1 || pageSize < 1 || pageSize > 100) throw new IllegalArgumentException("unsupported contract audit target");
    Boolean exists = jdbc.query("SELECT EXISTS(SELECT 1 FROM contract.store_contract WHERE id::text=? AND workspace_uuid=? AND group_workspace_key=?)", statement -> { statement.setString(1, target.entityRef()); statement.setObject(2, scope.workspaceUuid()); statement.setString(3, scope.groupWorkspaceKey()); }, result -> result.next() && result.getBoolean(1));
    if (!Boolean.TRUE.equals(exists)) throw new ContractCommandService.ContractNotFoundException();
    long total = jdbc.queryForObject("SELECT count(*) FROM contract.audit_event WHERE workspace_uuid=? AND group_workspace_key=? AND entity_type='STORE_CONTRACT' AND entity_ref_text=?", Long.class, scope.workspaceUuid(), scope.groupWorkspaceKey(), target.entityRef());
    List<AuditHistoryItem> items = jdbc.query("SELECT id, occurred_at_epoch_millis, actor_display_snapshot, action, entity_type, entity_ref_text, changes_json::text FROM contract.audit_event WHERE workspace_uuid=? AND group_workspace_key=? AND entity_type='STORE_CONTRACT' AND entity_ref_text=? ORDER BY occurred_at_epoch_millis DESC, id DESC LIMIT ? OFFSET ?", (r, n) -> new AuditHistoryItem(r.getObject("id", UUID.class), r.getLong("occurred_at_epoch_millis"), r.getString("actor_display_snapshot"), r.getString("action"), new AuditTarget(r.getString("entity_type"), r.getString("entity_ref_text")), AuditChangeJson.read(r.getString("changes_json"))), scope.workspaceUuid(), scope.groupWorkspaceKey(), target.entityRef(), pageSize, (page - 1) * pageSize);
    return new AuditHistoryPage(items, page, pageSize, total);
  }
  @Transactional(readOnly = true) public AuditHistoryPage readStoreContract(AuditReadScope scope, String contractId, long page, long pageSize) {
    if (page < 1 || pageSize < 1 || pageSize > 100) throw new IllegalArgumentException("unsupported contract audit target");
    long offset = Math.multiplyExact(page - 1, pageSize);
    PageProjection value = jdbc.query("""
        WITH target AS (SELECT 1 FROM contract.store_contract WHERE id::text=? AND workspace_uuid=? AND group_workspace_key=?),
        events AS (
          SELECT id, occurred_at_epoch_millis, actor_display_snapshot, action, entity_type, entity_ref_text,
                 changes_json::text AS changes_json, count(*) OVER () AS total
          FROM contract.audit_event
          WHERE EXISTS (SELECT 1 FROM target) AND workspace_uuid=? AND group_workspace_key=?
            AND entity_type='STORE_CONTRACT' AND entity_ref_text=?
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
          statement.setString(1, contractId); statement.setObject(2, scope.workspaceUuid()); statement.setString(3, scope.groupWorkspaceKey());
          statement.setObject(4, scope.workspaceUuid()); statement.setString(5, scope.groupWorkspaceKey()); statement.setString(6, contractId);
          statement.setLong(7, pageSize); statement.setLong(8, offset);
        }, ContractAuditHistoryService::projection);
    if (!value.targetExists()) throw new ContractCommandService.ContractNotFoundException();
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

  /** Contract owner projection: only preloaded visible-store facts may establish host scope. */
  @Transactional(readOnly = true) public AuditHistoryPage readOperationsAuditProjection(AuditReadScope scope, VisibleOrganizationFacts visibleFacts, AuditTarget target, long page, long pageSize) {
    if (scope == null || visibleFacts == null || target == null || !"STORE_CONTRACT".equals(target.entityType()) || page < 1 || pageSize < 1 || pageSize > 100) throw new IllegalArgumentException("unsupported operations contract audit target");
    Projection value = ReadBudgetComponent.measure(ReadBudgetComponent.Component.PRIMARY_QUERY, () -> jdbc.query("""
        WITH target AS (SELECT contract.id, contract.store_id FROM contract.store_contract contract WHERE contract.id=? AND contract.workspace_uuid=? AND contract.group_workspace_key=?),
        auth_scope AS (SELECT target.id IS NOT NULL AS found, target.store_id=ANY(?) AS authorized FROM (VALUES (1)) input(value) LEFT JOIN target ON TRUE),
        events AS (SELECT event.id AS audit_id, event.occurred_at_epoch_millis, event.actor_display_snapshot, event.action, event.entity_type, event.entity_ref_text, event.changes_json::text AS changes_json, count(*) OVER () AS total FROM contract.audit_event event CROSS JOIN auth_scope WHERE auth_scope.found AND auth_scope.authorized AND event.workspace_uuid=? AND event.group_workspace_key=? AND event.entity_type='STORE_CONTRACT' AND event.entity_ref_text=?),
        summary AS (SELECT COALESCE(MAX(total), 0) AS total FROM events)
        SELECT auth_scope.found, auth_scope.authorized, summary.total, page.audit_id, page.occurred_at_epoch_millis, page.actor_display_snapshot, page.action, page.entity_type, page.entity_ref_text, page.changes_json
        FROM auth_scope CROSS JOIN summary LEFT JOIN LATERAL (SELECT * FROM events ORDER BY occurred_at_epoch_millis DESC, audit_id DESC LIMIT ? OFFSET ?) page ON TRUE
        """, statement -> {
          statement.setObject(1, uuid(target.entityRef())); statement.setObject(2, scope.workspaceUuid()); statement.setString(3, scope.groupWorkspaceKey()); statement.setArray(4, storeIds(statement, visibleFacts));
          statement.setObject(5, scope.workspaceUuid()); statement.setString(6, scope.groupWorkspaceKey()); statement.setString(7, target.entityRef()); statement.setLong(8, pageSize); statement.setLong(9, Math.multiplyExact(page - 1, pageSize));
        }, ContractAuditHistoryService::operationsProjection));
    if (!value.found()) throw new ContractCommandService.ContractNotFoundException();
    if (!value.authorized()) throw new ContractCommandService.ContractAuthorizationException();
    return new AuditHistoryPage(value.items(), page, pageSize, value.total());
  }

  private static Projection operationsProjection(ResultSet rows) throws SQLException {
    boolean found = false; boolean authorized = false; long total = 0; List<AuditHistoryItem> items = new ArrayList<>();
    while (rows.next()) { found = rows.getBoolean("found"); authorized = rows.getBoolean("authorized"); total = rows.getLong("total"); UUID id = rows.getObject("audit_id", UUID.class); if (id != null) items.add(new AuditHistoryItem(id, rows.getLong("occurred_at_epoch_millis"), rows.getString("actor_display_snapshot"), rows.getString("action"), new AuditTarget(rows.getString("entity_type"), rows.getString("entity_ref_text")), AuditChangeJson.read(rows.getString("changes_json")))); }
    return new Projection(found, authorized, List.copyOf(items), total);
  }
  private static Array storeIds(java.sql.PreparedStatement statement, VisibleOrganizationFacts facts) throws SQLException { return statement.getConnection().createArrayOf("uuid", facts.candidates().stream().filter(value -> "STORE".equals(value.dataNodeType())).map(value -> value.dataNodeId()).toArray(UUID[]::new)); }
  private static UUID uuid(String value) { try { return UUID.fromString(value); } catch (RuntimeException invalid) { throw new IllegalArgumentException("operations audit target must be a UUID", invalid); } }
  private record Projection(boolean found, boolean authorized, List<AuditHistoryItem> items, long total) { }
  private record PageProjection(boolean targetExists, List<AuditHistoryItem> items, long total) { }
}
