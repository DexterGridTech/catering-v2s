package com.catering.v2s.workspace.iam.application;

import com.catering.v2s.audit.contract.*;
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
}
