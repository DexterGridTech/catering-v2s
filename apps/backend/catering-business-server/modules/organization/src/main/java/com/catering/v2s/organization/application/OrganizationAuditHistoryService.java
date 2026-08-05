package com.catering.v2s.organization.application;

import com.catering.v2s.audit.contract.AuditEntityTypes;

import com.catering.v2s.audit.contract.*;
import com.catering.v2s.organization.api.CommercialGroupInitializationAuditLookup;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Owner-local reader for organization-node and business-entity audit facts. */
@Service public class OrganizationAuditHistoryService implements CommercialGroupInitializationAuditLookup {
  private static final Set<String> TYPES = Set.of("ORGANIZATION_NODE", "BRAND", "TENANT", AuditEntityTypes.HEAD_COMPANY, AuditEntityTypes.STORE);
  private final JdbcTemplate jdbc; public OrganizationAuditHistoryService(JdbcTemplate jdbc) { this.jdbc = jdbc; }
  @Transactional(readOnly = true) public AuditHistoryPage read(AuditReadScope scope, AuditTarget target, long page, long pageSize) {
    if (!TYPES.contains(target.entityType()) || page < 1 || pageSize < 1 || pageSize > 100) throw new IllegalArgumentException("unsupported organization audit target");
    String table = switch (target.entityType()) { case "ORGANIZATION_NODE" -> "organization_node"; case "BRAND" -> "brand"; case "TENANT" -> "tenant"; case AuditEntityTypes.HEAD_COMPANY -> "head_company"; case AuditEntityTypes.STORE -> "store"; default -> throw new IllegalArgumentException("unsupported organization audit target"); };
    Boolean exists = jdbc.query("SELECT EXISTS(SELECT 1 FROM organization." + table + " WHERE id::text=? AND workspace_uuid=? AND group_workspace_key=?)", statement -> { statement.setString(1, target.entityRef()); statement.setObject(2, scope.workspaceUuid()); statement.setString(3, scope.groupWorkspaceKey()); }, result -> result.next() && result.getBoolean(1));
    if (!Boolean.TRUE.equals(exists)) throw new BusinessEntityService.OrganizationNotFoundException();
    long total = jdbc.queryForObject("SELECT count(*) FROM organization.audit_event WHERE workspace_uuid=? AND group_workspace_key=? AND entity_type=? AND entity_ref_text=?", Long.class, scope.workspaceUuid(), scope.groupWorkspaceKey(), target.entityType(), target.entityRef());
    List<AuditHistoryItem> items = jdbc.query("SELECT id, occurred_at_epoch_millis, actor_display_snapshot, action, entity_type, entity_ref_text, changes_json::text FROM organization.audit_event WHERE workspace_uuid=? AND group_workspace_key=? AND entity_type=? AND entity_ref_text=? ORDER BY occurred_at_epoch_millis DESC, id DESC LIMIT ? OFFSET ?", (r, n) -> new AuditHistoryItem(r.getObject("id", UUID.class), r.getLong("occurred_at_epoch_millis"), r.getString("actor_display_snapshot"), r.getString("action"), new AuditTarget(r.getString("entity_type"), r.getString("entity_ref_text")), AuditChangeJson.read(r.getString("changes_json"))), scope.workspaceUuid(), scope.groupWorkspaceKey(), target.entityType(), target.entityRef(), pageSize, (page - 1) * pageSize);
    return new AuditHistoryPage(items, page, pageSize, total);
  }
  @Override
  @Transactional(readOnly = true)
  public AuditHistoryPage readInitializationForGroupWorkspace(AuditReadScope scope, String entityRef, long page, long pageSize) {
    if (page < 1 || pageSize < 1 || pageSize > 100) throw new IllegalArgumentException("unsupported organization audit page");
    long total = jdbc.queryForObject("SELECT count(*) FROM organization.audit_event WHERE workspace_uuid=? AND group_workspace_key=? AND entity_type='GROUP_WORKSPACE' AND entity_ref_text=? AND action='COMMERCIAL_GROUP_INITIALIZED'", Long.class, scope.workspaceUuid(), scope.groupWorkspaceKey(), entityRef);
    List<AuditHistoryItem> items = jdbc.query("SELECT id, occurred_at_epoch_millis, actor_display_snapshot, action, entity_type, entity_ref_text, changes_json::text FROM organization.audit_event WHERE workspace_uuid=? AND group_workspace_key=? AND entity_type='GROUP_WORKSPACE' AND entity_ref_text=? AND action='COMMERCIAL_GROUP_INITIALIZED' ORDER BY occurred_at_epoch_millis DESC, id DESC LIMIT ? OFFSET ?", (r, n) -> new AuditHistoryItem(r.getObject("id", UUID.class), r.getLong("occurred_at_epoch_millis"), r.getString("actor_display_snapshot"), r.getString("action"), new AuditTarget(r.getString("entity_type"), r.getString("entity_ref_text")), AuditChangeJson.read(r.getString("changes_json"))), scope.workspaceUuid(), scope.groupWorkspaceKey(), entityRef, pageSize, (page - 1) * pageSize);
    return new AuditHistoryPage(items, page, pageSize, total);
  }
  /** Reads only the initialization fact owned by the selected commercial group, never the wider workspace history. */
  @Transactional(readOnly = true)
  public AuditHistoryPage readCommercialGroup(AuditReadScope scope, AuditTarget target, long page, long pageSize) {
    if (!"COMMERCIAL_GROUP".equals(target.entityType()) || page < 1 || pageSize < 1 || pageSize > 100) throw new IllegalArgumentException("unsupported commercial-group audit target");
    List<Long> groupWorkspaceIds = jdbc.query(
        "SELECT commercial_group.group_workspace_id FROM organization.commercial_group commercial_group JOIN platform_workspace.group_workspace workspace ON workspace.id=commercial_group.group_workspace_id AND workspace.group_workspace_key=commercial_group.group_workspace_key WHERE commercial_group.commercial_group_uuid::text=? AND workspace.workspace_uuid=? AND commercial_group.group_workspace_key=?",
        statement -> { statement.setString(1, target.entityRef()); statement.setObject(2, scope.workspaceUuid()); statement.setString(3, scope.groupWorkspaceKey()); },
        (result, row) -> result.getLong(1));
    if (groupWorkspaceIds.isEmpty()) throw new BusinessEntityService.OrganizationNotFoundException();
    String workspaceRef = String.valueOf(groupWorkspaceIds.getFirst());
    long total = jdbc.queryForObject("SELECT count(*) FROM organization.audit_event WHERE workspace_uuid=? AND group_workspace_key=? AND ((entity_type='GROUP_WORKSPACE' AND entity_ref_text=? AND action='COMMERCIAL_GROUP_INITIALIZED') OR (entity_type='COMMERCIAL_GROUP' AND entity_ref_text=?))", Long.class, scope.workspaceUuid(), scope.groupWorkspaceKey(), workspaceRef, target.entityRef());
    List<AuditHistoryItem> items = jdbc.query("SELECT id, occurred_at_epoch_millis, actor_display_snapshot, action, entity_type, entity_ref_text, changes_json::text FROM organization.audit_event WHERE workspace_uuid=? AND group_workspace_key=? AND ((entity_type='GROUP_WORKSPACE' AND entity_ref_text=? AND action='COMMERCIAL_GROUP_INITIALIZED') OR (entity_type='COMMERCIAL_GROUP' AND entity_ref_text=?)) ORDER BY occurred_at_epoch_millis DESC, id DESC LIMIT ? OFFSET ?", (r, n) -> new AuditHistoryItem(r.getObject("id", UUID.class), r.getLong("occurred_at_epoch_millis"), r.getString("actor_display_snapshot"), r.getString("action"), new AuditTarget(r.getString("entity_type"), r.getString("entity_ref_text")), AuditChangeJson.read(r.getString("changes_json"))), scope.workspaceUuid(), scope.groupWorkspaceKey(), workspaceRef, target.entityRef(), pageSize, (page - 1) * pageSize);
    return new AuditHistoryPage(items, page, pageSize, total);
  }
}
