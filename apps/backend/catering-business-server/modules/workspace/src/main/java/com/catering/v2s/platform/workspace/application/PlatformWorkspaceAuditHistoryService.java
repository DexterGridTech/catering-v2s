package com.catering.v2s.platform.workspace.application;

import com.catering.v2s.audit.contract.AuditChangeJson;
import com.catering.v2s.audit.contract.AuditHistoryItem;
import com.catering.v2s.audit.contract.AuditHistoryPage;
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

    public PlatformWorkspaceAuditHistoryService(
            JdbcTemplate jdbc, CommercialGroupInitializationAuditLookup commercialGroupAudit) {
        this.jdbc = jdbc;
        this.commercialGroupAudit = commercialGroupAudit;
    }

    /** Typed platform-audit projection keyed by the stable group-workspace business key. */
    @Transactional(readOnly = true)
    public AuditHistoryPage readGroupWorkspace(
            AuditReadScope scope, String groupWorkspaceKey, long page, long pageSize) {
        if (page < 1 || pageSize < 1 || pageSize > 100) throw new IllegalArgumentException("unsupported audit target");
        long offset = Math.multiplyExact(page - 1, pageSize);
        long fetchSize = Math.addExact(offset, pageSize);
        GroupWorkspaceProjection own = readGroupWorkspaceProjection(scope, groupWorkspaceKey, fetchSize);
        if (!own.targetExists()) throw new WorkspaceAdministrationService.WorkspaceNotFoundException();
        AuditHistoryPage organization =
                commercialGroupAudit.readInitializationForGroupWorkspace(scope, own.auditRef(), 1, 1);
        List<AuditHistoryItem> items = java.util.stream.Stream.concat(
                        own.items().stream(), organization.items().stream())
                .sorted(Comparator.comparingLong(AuditHistoryItem::occurredAtEpochMillis)
                        .reversed()
                        .thenComparing(AuditHistoryItem::id, Comparator.reverseOrder()))
                .skip(offset)
                .limit(pageSize)
                .toList();
        return new AuditHistoryPage(items, page, pageSize, own.total() + organization.total());
    }

    private GroupWorkspaceProjection readGroupWorkspaceProjection(
            AuditReadScope scope, String groupWorkspaceKey, long fetchSize) {
        return jdbc.query(
                """
            WITH target AS (
              SELECT id FROM platform_workspace.group_workspace WHERE group_workspace_key=? AND workspace_uuid=?
            ), events AS (
              SELECT id, occurred_at_epoch_millis, actor_display_snapshot, action, entity_type, entity_ref_text,
                     changes_json::text AS changes_json, count(*) OVER () AS total
              FROM platform_workspace.audit_event
              WHERE EXISTS (SELECT 1 FROM target) AND workspace_uuid=? AND group_workspace_key=?
                AND entity_type='GROUP_WORKSPACE' AND entity_ref_text=(SELECT id::text FROM target)
            ), summary AS (SELECT COALESCE(MAX(total), 0) AS total FROM events)
            SELECT EXISTS (SELECT 1 FROM target) AS target_exists, (SELECT id::text FROM target) AS audit_ref,
                   summary.total, page.event_id, page.occurred_at_epoch_millis, page.actor_display_snapshot,
                   page.action, page.entity_type, page.entity_ref_text, page.changes_json
            FROM summary LEFT JOIN LATERAL (
              SELECT id AS event_id, occurred_at_epoch_millis, actor_display_snapshot, action, entity_type,
                     entity_ref_text, changes_json FROM events
              ORDER BY occurred_at_epoch_millis DESC, id DESC LIMIT ?
            ) page ON TRUE
            """,
                statement -> {
                    statement.setString(1, groupWorkspaceKey);
                    statement.setObject(2, scope.workspaceUuid());
                    statement.setObject(3, scope.workspaceUuid());
                    statement.setString(4, scope.groupWorkspaceKey());
                    statement.setLong(5, fetchSize);
                },
                PlatformWorkspaceAuditHistoryService::groupWorkspaceProjection);
    }

    private static GroupWorkspaceProjection groupWorkspaceProjection(java.sql.ResultSet rows)
            throws java.sql.SQLException {
        boolean targetExists = false;
        String auditRef = null;
        long total = 0;
        List<AuditHistoryItem> items = new java.util.ArrayList<>();
        while (rows.next()) {
            targetExists = rows.getBoolean("target_exists");
            auditRef = rows.getString("audit_ref");
            total = rows.getLong("total");
            UUID id = rows.getObject("event_id", UUID.class);
            if (id != null)
                items.add(new AuditHistoryItem(
                        id,
                        rows.getLong("occurred_at_epoch_millis"),
                        rows.getString("actor_display_snapshot"),
                        rows.getString("action"),
                        new AuditTarget(rows.getString("entity_type"), rows.getString("entity_ref_text")),
                        AuditChangeJson.read(rows.getString("changes_json"))));
        }
        return new GroupWorkspaceProjection(targetExists, auditRef, List.copyOf(items), total);
    }

    private record GroupWorkspaceProjection(
            boolean targetExists, String auditRef, List<AuditHistoryItem> items, long total) {}
}
