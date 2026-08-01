package com.catering.v2s.platform.workspace.application;

import com.catering.v2s.audit.contract.AuditHistoryItem;
import com.catering.v2s.audit.contract.AuditHistoryPage;
import com.catering.v2s.audit.contract.AuditChangeJson;
import com.catering.v2s.audit.contract.AuditReadScope;
import com.catering.v2s.audit.contract.AuditTarget;
import com.catering.v2s.organization.api.CommercialGroupInitializationAuditLookup;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Owner-local task reader for group-workspace audit facts after the host scope is authorized. */
@Service
public class PlatformWorkspaceAuditHistoryService {
    private final JdbcTemplate jdbc;
    private final CommercialGroupInitializationAuditLookup commercialGroupAudit;

    public PlatformWorkspaceAuditHistoryService(JdbcTemplate jdbc, CommercialGroupInitializationAuditLookup commercialGroupAudit) { this.jdbc = jdbc; this.commercialGroupAudit = commercialGroupAudit; }

    @Transactional(readOnly = true)
    public AuditHistoryPage readGroupWorkspace(AuditReadScope scope, AuditTarget target, long page, long pageSize) {
        if (!"GROUP_WORKSPACE".equals(target.entityType()) || page < 1 || pageSize < 1 || pageSize > 100) throw new IllegalArgumentException("unsupported audit target");
        Boolean hostExists = jdbc.query("SELECT EXISTS(SELECT 1 FROM platform_workspace.group_workspace WHERE id::text=? AND workspace_uuid=? AND group_workspace_key=?)", statement -> { statement.setString(1, target.entityRef()); statement.setObject(2, scope.workspaceUuid()); statement.setString(3, scope.groupWorkspaceKey()); }, result -> result.next() && result.getBoolean(1));
        if (!Boolean.TRUE.equals(hostExists)) throw new WorkspaceAdministrationService.WorkspaceNotFoundException();
        long ownTotal = jdbc.queryForObject(
            "SELECT count(*) FROM platform_workspace.audit_event WHERE workspace_uuid=? AND group_workspace_key=? AND entity_type='GROUP_WORKSPACE' AND entity_ref_text=?",
            Long.class, scope.workspaceUuid(), scope.groupWorkspaceKey(), target.entityRef());
        long fetchSize = Math.addExact(Math.multiplyExact(page - 1, pageSize), pageSize);
        List<AuditHistoryItem> ownItems = jdbc.query(
            "SELECT id, occurred_at_epoch_millis, actor_display_snapshot, action, entity_type, entity_ref_text, changes_json::text FROM platform_workspace.audit_event WHERE workspace_uuid=? AND group_workspace_key=? AND entity_type='GROUP_WORKSPACE' AND entity_ref_text=? ORDER BY occurred_at_epoch_millis DESC, id DESC LIMIT ? OFFSET ?",
            (result, row) -> new AuditHistoryItem(result.getObject("id", UUID.class), result.getLong("occurred_at_epoch_millis"), result.getString("actor_display_snapshot"), result.getString("action"), new AuditTarget(result.getString("entity_type"), result.getString("entity_ref_text")), AuditChangeJson.read(result.getString("changes_json"))),
            scope.workspaceUuid(), scope.groupWorkspaceKey(), target.entityRef(), fetchSize, 0);
        AuditHistoryPage organization = commercialGroupAudit.readInitializationForGroupWorkspace(scope, target.entityRef(), 1, 1);
        long offset = (page - 1) * pageSize;
        List<AuditHistoryItem> items = java.util.stream.Stream.concat(ownItems.stream(), organization.items().stream())
            .sorted(Comparator.comparingLong(AuditHistoryItem::occurredAtEpochMillis).reversed().thenComparing(AuditHistoryItem::id, Comparator.reverseOrder()))
            .skip(offset)
            .limit(pageSize)
            .toList();
        return new AuditHistoryPage(items, page, pageSize, ownTotal + organization.total());
    }
}
