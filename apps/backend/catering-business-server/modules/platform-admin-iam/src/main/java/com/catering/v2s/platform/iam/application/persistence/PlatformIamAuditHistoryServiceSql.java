package com.catering.v2s.platform.iam.application.persistence;

/** SQL text owned by PlatformIamAuditHistoryService; B3 relocates text without changing execution. */
public final class PlatformIamAuditHistoryServiceSql {
    public static final String ADMIN_EXISTS = "SELECT EXISTS(SELECT 1 FROM platform_iam.platform_admin WHERE id::text=?)";
    public static final String COUNT = "SELECT count(*) FROM platform_iam.audit_event WHERE entity_type='PLATFORM_ADMIN' AND "
            + "entity_ref_text=?";
    public static final String PAGE = "SELECT id, occurred_at_epoch_millis, actor_display_snapshot, action, entity_type, entity_ref_text, "
            + "changes_json::text FROM platform_iam.audit_event WHERE entity_type='PLATFORM_ADMIN' AND "
            + "entity_ref_text=? ORDER BY occurred_at_epoch_millis DESC, id DESC LIMIT ? OFFSET ?";
    public static final String TARGET_PAGE = """
        WITH target AS (SELECT 1 FROM platform_iam.platform_admin WHERE id::text=?),
        events AS (
          SELECT id, occurred_at_epoch_millis, actor_display_snapshot, action, entity_type, entity_ref_text,
                 changes_json::text AS changes_json, count(*) OVER () AS total
          FROM platform_iam.audit_event
          WHERE EXISTS (SELECT 1 FROM target) AND entity_type='PLATFORM_ADMIN' AND entity_ref_text=?
        ), summary AS (SELECT COALESCE(MAX(total), 0) AS total FROM events)
        SELECT EXISTS (SELECT 1 FROM target) AS target_exists, summary.total,
               page.event_id, page.occurred_at_epoch_millis, page.actor_display_snapshot, page.action,
               page.entity_type, page.entity_ref_text, page.changes_json
        FROM summary LEFT JOIN LATERAL (
          SELECT id AS event_id, occurred_at_epoch_millis, actor_display_snapshot, action, entity_type,
                 entity_ref_text, changes_json FROM events
          ORDER BY occurred_at_epoch_millis DESC, id DESC LIMIT ? OFFSET ?
        ) page ON TRUE
        """;

}
