package com.catering.v2s.platform.workspace.application.persistence;

/** SQL text owned by PlatformWorkspaceAuditHistoryPersistence; B3 relocates text without changing execution. */
public final class PlatformWorkspaceAuditHistoryServiceSql {
    public static final String PAGE =
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
            """;
}
