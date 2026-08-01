package com.catering.v2s.contract.application;

import com.catering.v2s.audit.contract.*;
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
}
