package com.catering.v2s.workspace.iam.application;

import com.catering.v2s.audit.contract.*;
import com.catering.v2s.platform.foundation.persistence.ReadBudgetComponent;
import java.sql.Array;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Owner-local reader for workspace role, account and invitation audit facts. */
@Service public class WorkspaceIamAuditHistoryService {
  private static final Set<String> TYPES = Set.of("WORKSPACE_ROLE", "WORKSPACE_ACCOUNT", "WORKSPACE_INVITATION");
  private final JdbcTemplate jdbc; public WorkspaceIamAuditHistoryService(JdbcTemplate jdbc) { this.jdbc = jdbc; }
  @Transactional(readOnly = true) public AuditHistoryPage read(AuditReadScope scope, AuditTarget target, long page, long pageSize) {
    if (!TYPES.contains(target.entityType()) || page < 1 || pageSize < 1 || pageSize > 100) throw new IllegalArgumentException("unsupported workspace IAM audit target");
    String table = switch (target.entityType()) { case "WORKSPACE_ROLE" -> "workspace_role"; case "WORKSPACE_ACCOUNT" -> "workspace_account"; case "WORKSPACE_INVITATION" -> "invitation"; default -> throw new IllegalArgumentException("unsupported workspace IAM audit target"); };
    Boolean exists = jdbc.query("SELECT EXISTS(SELECT 1 FROM workspace_iam." + table + " WHERE id::text=? AND workspace_uuid=? AND group_workspace_key=?)", statement -> { statement.setString(1, target.entityRef()); statement.setObject(2, scope.workspaceUuid()); statement.setString(3, scope.groupWorkspaceKey()); }, result -> result.next() && result.getBoolean(1));
    if (!Boolean.TRUE.equals(exists)) throw absent(target.entityType());
    long total = jdbc.queryForObject("SELECT count(*) FROM workspace_iam.audit_event WHERE workspace_uuid=? AND group_workspace_key=? AND entity_type=? AND entity_ref_text=?", Long.class, scope.workspaceUuid(), scope.groupWorkspaceKey(), target.entityType(), target.entityRef());
    List<AuditHistoryItem> items = jdbc.query("SELECT id, occurred_at_epoch_millis, actor_display_snapshot, action, entity_type, entity_ref_text, changes_json::text FROM workspace_iam.audit_event WHERE workspace_uuid=? AND group_workspace_key=? AND entity_type=? AND entity_ref_text=? ORDER BY occurred_at_epoch_millis DESC, id DESC LIMIT ? OFFSET ?", (r, n) -> new AuditHistoryItem(r.getObject("id", UUID.class), r.getLong("occurred_at_epoch_millis"), r.getString("actor_display_snapshot"), r.getString("action"), new AuditTarget(r.getString("entity_type"), r.getString("entity_ref_text")), AuditChangeJson.read(r.getString("changes_json"))), scope.workspaceUuid(), scope.groupWorkspaceKey(), target.entityType(), target.entityRef(), pageSize, (page - 1) * pageSize);
    return new AuditHistoryPage(items, page, pageSize, total);
  }
  private static RuntimeException absent(String entityType) { return switch (entityType) { case "WORKSPACE_ROLE" -> new WorkspaceRoleService.RoleNotFoundException(); case "WORKSPACE_ACCOUNT" -> new WorkspaceAccountService.AccountNotFoundException(); case "WORKSPACE_INVITATION" -> new WorkspaceInvitationService.InvitationNotFoundException(); default -> new IllegalArgumentException("unsupported workspace IAM audit target"); }; }
  @Transactional(readOnly = true) public AuditHistoryPage readWorkspaceRole(AuditReadScope scope, String roleId, long page, long pageSize) {
    return readPlatformProjection(scope, roleId, page, pageSize, "WORKSPACE_ROLE", "workspace_role", new WorkspaceRoleService.RoleNotFoundException());
  }
  @Transactional(readOnly = true) public AuditHistoryPage readWorkspaceAccount(AuditReadScope scope, String accountId, long page, long pageSize) {
    return readPlatformProjection(scope, accountId, page, pageSize, "WORKSPACE_ACCOUNT", "workspace_account", new WorkspaceAccountService.AccountNotFoundException());
  }
  @Transactional(readOnly = true) public AuditHistoryPage readWorkspaceInvitation(AuditReadScope scope, String invitationId, long page, long pageSize) {
    return readPlatformProjection(scope, invitationId, page, pageSize, "WORKSPACE_INVITATION", "invitation", new WorkspaceInvitationService.InvitationNotFoundException());
  }

  /** Closed platform-audit projection; variants are fixed by the audited entity type. */
  @Transactional(readOnly = true) public AuditHistoryPage readPlatformAuditProjection(AuditReadScope scope, AuditTarget target, long page, long pageSize) {
    if (target == null) throw new IllegalArgumentException("unsupported workspace IAM audit target");
    return switch (target.entityType()) {
      case "WORKSPACE_ROLE" -> readPlatformProjection(scope, target.entityRef(), page, pageSize, "WORKSPACE_ROLE", "workspace_role", new WorkspaceRoleService.RoleNotFoundException());
      case "WORKSPACE_ACCOUNT" -> readPlatformProjection(scope, target.entityRef(), page, pageSize, "WORKSPACE_ACCOUNT", "workspace_account", new WorkspaceAccountService.AccountNotFoundException());
      case "WORKSPACE_INVITATION" -> readPlatformProjection(scope, target.entityRef(), page, pageSize, "WORKSPACE_INVITATION", "invitation", new WorkspaceInvitationService.InvitationNotFoundException());
      default -> throw new IllegalArgumentException("unsupported workspace IAM audit target");
    };
  }

  private AuditHistoryPage readPlatformProjection(AuditReadScope scope, String entityRef, long page, long pageSize, String entityType, String targetTable, RuntimeException absent) {
    if (page < 1 || pageSize < 1 || pageSize > 100) throw new IllegalArgumentException("unsupported workspace IAM audit target");
    long offset = Math.multiplyExact(page - 1, pageSize);
    PageProjection value = jdbc.query("""
        WITH target AS (SELECT 1 FROM workspace_iam.%s WHERE id::text=? AND workspace_uuid=? AND group_workspace_key=?),
        events AS (
          SELECT id, occurred_at_epoch_millis, actor_display_snapshot, action, entity_type, entity_ref_text,
                 changes_json::text AS changes_json, count(*) OVER () AS total
          FROM workspace_iam.audit_event
          WHERE EXISTS (SELECT 1 FROM target) AND workspace_uuid=? AND group_workspace_key=?
            AND entity_type=? AND entity_ref_text=?
        ), summary AS (SELECT COALESCE(MAX(total), 0) AS total FROM events)
        SELECT EXISTS (SELECT 1 FROM target) AS target_exists, summary.total,
               page.event_id, page.occurred_at_epoch_millis, page.actor_display_snapshot, page.action,
               page.entity_type, page.entity_ref_text, page.changes_json
        FROM summary LEFT JOIN LATERAL (
          SELECT id AS event_id, occurred_at_epoch_millis, actor_display_snapshot, action, entity_type,
                 entity_ref_text, changes_json FROM events
          ORDER BY occurred_at_epoch_millis DESC, id DESC LIMIT ? OFFSET ?
        ) page ON TRUE
        """.formatted(targetTable), statement -> {
          statement.setString(1, entityRef); statement.setObject(2, scope.workspaceUuid()); statement.setString(3, scope.groupWorkspaceKey());
          statement.setObject(4, scope.workspaceUuid()); statement.setString(5, scope.groupWorkspaceKey());
          statement.setString(6, entityType); statement.setString(7, entityRef);
          statement.setLong(8, pageSize); statement.setLong(9, offset);
        }, WorkspaceIamAuditHistoryService::platformProjection);
    if (!value.targetExists()) throw absent;
    return new AuditHistoryPage(value.items(), page, pageSize, value.total());
  }

  private static PageProjection platformProjection(ResultSet rows) throws SQLException {
    boolean targetExists = false; long total = 0; List<AuditHistoryItem> items = new ArrayList<>();
    while (rows.next()) {
      targetExists = rows.getBoolean("target_exists"); total = rows.getLong("total");
      UUID id = rows.getObject("event_id", UUID.class);
      if (id != null) items.add(new AuditHistoryItem(id, rows.getLong("occurred_at_epoch_millis"), rows.getString("actor_display_snapshot"), rows.getString("action"), new AuditTarget(rows.getString("entity_type"), rows.getString("entity_ref_text")), AuditChangeJson.read(rows.getString("changes_json"))));
    }
    return new PageProjection(targetExists, List.copyOf(items), total);
  }
  private record PageProjection(boolean targetExists, List<AuditHistoryItem> items, long total) { }

  /**
   * One owner-local operations projection.  Authorization consumes only the read-context facts
   * already loaded for this request; it must not rebuild a task path through another owner.
   */
  @Transactional(readOnly = true)
  public AuditHistoryPage readOperationsAuditProjection(WorkspaceReadAuthorizationFacts facts, AuditTarget target, long page, long pageSize) {
    if (facts == null || target == null || !Set.of("WORKSPACE_ACCOUNT", "WORKSPACE_INVITATION").contains(target.entityType())
        || page < 1 || pageSize < 1 || pageSize > 100) throw new IllegalArgumentException("unsupported operations workspace audit target");
    Projection value = ReadBudgetComponent.measure(ReadBudgetComponent.Component.PRIMARY_QUERY, () -> jdbc.query(
        operationsSql(target.entityType()), statement -> {
          statement.setObject(1, uuid(target.entityRef()));
          statement.setObject(2, facts.workspaceUuid()); statement.setString(3, facts.groupWorkspaceKey());
          int index = 4;
          if ("WORKSPACE_ACCOUNT".equals(target.entityType())) {
            statement.setObject(index++, facts.workspaceUuid()); statement.setString(index++, facts.groupWorkspaceKey());
          }
          statement.setString(index++, facts.assignmentNodeType()); statement.setObject(index++, facts.assignmentNodeId());
          statement.setArray(index++, uuidArray(statement, ids(facts, "REGION")));
          statement.setArray(index++, uuidArray(statement, ids(facts, "PROJECT")));
          statement.setArray(index++, uuidArray(statement, ids(facts, "HEAD_COMPANY")));
          statement.setArray(index++, uuidArray(statement, ids(facts, "STORE")));
          statement.setObject(index++, facts.workspaceUuid()); statement.setString(index++, facts.groupWorkspaceKey());
          statement.setString(index++, target.entityType()); statement.setString(index++, target.entityRef());
          statement.setLong(index++, pageSize); statement.setLong(index, (page - 1) * pageSize);
        }, WorkspaceIamAuditHistoryService::projection));
    if (!value.found()) throw absent(target.entityType());
    if (!value.authorized()) throw new WorkspaceCommandAuthorizationService.AuthorizationDeniedException();
    return new AuditHistoryPage(value.items(), page, pageSize, value.total());
  }

  private static String operationsSql(String type) {
    boolean account = "WORKSPACE_ACCOUNT".equals(type);
    String table = account ? "workspace_account" : "invitation";
    String targets = account
        ? "SELECT assignment.service_node_type, assignment.service_node_id FROM workspace_iam.role_assignment assignment WHERE assignment.account_id=subject.id AND assignment.workspace_uuid=? AND assignment.group_workspace_key=? AND assignment.status='ACTIVE'"
        : "SELECT intent.service_node_type, intent.service_node_id FROM workspace_iam.invitation_assignment_intent intent WHERE intent.invitation_id=subject.id";
    String allowed = "(target.service_node_type='GROUP' AND ?='GROUP' AND target.service_node_id=?) OR (target.service_node_type='REGION' AND target.service_node_id=ANY(?)) OR (target.service_node_type='PROJECT' AND target.service_node_id=ANY(?)) OR (target.service_node_type='HEAD_COMPANY' AND target.service_node_id=ANY(?)) OR (target.service_node_type='STORE' AND target.service_node_id=ANY(?))";
    String authorization = account ? "EXISTS (SELECT 1 FROM (" + targets + ") target WHERE " + allowed + ")" : "NOT EXISTS (SELECT 1 FROM (" + targets + ") target WHERE NOT (" + allowed + "))";
    return "WITH subject AS (SELECT entity.id FROM (VALUES (1)) input(value) LEFT JOIN workspace_iam." + table + " entity ON entity.id=? AND entity.workspace_uuid=? AND entity.group_workspace_key=?), authorization AS (SELECT subject.id IS NOT NULL AS found, CASE WHEN subject.id IS NULL THEN FALSE WHEN " + authorization + " THEN TRUE ELSE FALSE END AS authorized FROM subject), audit_rows AS (SELECT event.id AS audit_id, event.occurred_at_epoch_millis, event.actor_display_snapshot, event.action, event.entity_type, event.entity_ref_text, event.changes_json::text AS changes_json, count(*) OVER() AS total FROM workspace_iam.audit_event event CROSS JOIN authorization WHERE authorization.found AND authorization.authorized AND event.workspace_uuid=? AND event.group_workspace_key=? AND event.entity_type=? AND event.entity_ref_text=?), page_rows AS (SELECT * FROM audit_rows ORDER BY occurred_at_epoch_millis DESC, audit_id DESC LIMIT ? OFFSET ?), total_rows AS (SELECT coalesce(max(total), 0) AS total FROM audit_rows) SELECT authorization.found, authorization.authorized, total_rows.total, page_rows.audit_id, page_rows.occurred_at_epoch_millis, page_rows.actor_display_snapshot, page_rows.action, page_rows.entity_type, page_rows.entity_ref_text, page_rows.changes_json FROM authorization CROSS JOIN total_rows LEFT JOIN page_rows ON TRUE";
  }

  private static Projection projection(ResultSet rows) throws SQLException {
    boolean found = false; boolean authorized = false; long total = 0; List<AuditHistoryItem> items = new ArrayList<>();
    while (rows.next()) {
      found = rows.getBoolean("found"); authorized = rows.getBoolean("authorized"); total = rows.getLong("total");
      UUID id = rows.getObject("audit_id", UUID.class);
      if (id != null) items.add(new AuditHistoryItem(id, rows.getLong("occurred_at_epoch_millis"), rows.getString("actor_display_snapshot"), rows.getString("action"), new AuditTarget(rows.getString("entity_type"), rows.getString("entity_ref_text")), AuditChangeJson.read(rows.getString("changes_json"))));
    }
    return new Projection(found, authorized, List.copyOf(items), total);
  }

  private static List<UUID> ids(WorkspaceReadAuthorizationFacts facts, String type) {
    return facts.visibleOrganizationFacts().candidates().stream().filter(value -> type.equals(value.dataNodeType())).map(value -> value.dataNodeId()).toList();
  }
  private static Array uuidArray(java.sql.PreparedStatement statement, List<UUID> values) throws SQLException { return statement.getConnection().createArrayOf("uuid", values.toArray(UUID[]::new)); }
  private static UUID uuid(String value) { try { return UUID.fromString(value); } catch (RuntimeException invalid) { throw new IllegalArgumentException("operations audit target must be a UUID", invalid); } }
  private record Projection(boolean found, boolean authorized, List<AuditHistoryItem> items, long total) { }
}
