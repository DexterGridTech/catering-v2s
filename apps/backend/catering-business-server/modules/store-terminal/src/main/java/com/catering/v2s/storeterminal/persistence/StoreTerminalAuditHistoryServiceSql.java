package com.catering.v2s.storeterminal.persistence;

/** Owner-local authorized audit projection for one terminal and its currently visible store. */
public final class StoreTerminalAuditHistoryServiceSql {
    public static final String STORE_TERMINAL_AUDIT_HISTORY_AUTHORIZED_TARGET =
            """
        WITH target AS (
          SELECT terminal.store_ref
          FROM store_terminal.terminal terminal
          WHERE terminal.terminal_ref = ?
            AND terminal.workspace_uuid = ?
            AND terminal.group_workspace_key = ?
        ), auth_scope AS (
          SELECT target.store_ref IS NOT NULL AS found,
                 COALESCE(target.store_ref = ANY(?::uuid[]), FALSE) AS authorized
          FROM (VALUES (1)) input(value)
          LEFT JOIN target ON TRUE
        ), events AS (
          SELECT event.id AS audit_id, event.occurred_at_epoch_millis, event.actor_display_snapshot,
                 event.action, event.entity_type, event.entity_ref_text, event.changes_json::text AS changes_json,
                 count(*) OVER () AS total
          FROM store_terminal.audit_event event
          CROSS JOIN auth_scope
          WHERE auth_scope.found AND auth_scope.authorized
            AND event.workspace_uuid = ?
            AND event.group_workspace_key = ?
            AND event.entity_type = 'STORE_TERMINAL'
            AND event.entity_ref_text = ?
        ), summary AS (SELECT COALESCE(MAX(total), 0) AS total FROM events)
        SELECT auth_scope.found, auth_scope.authorized, summary.total,
               page.audit_id, page.occurred_at_epoch_millis, page.actor_display_snapshot,
               page.action, page.entity_type, page.entity_ref_text, page.changes_json
        FROM auth_scope
        CROSS JOIN summary
        LEFT JOIN LATERAL (
          SELECT * FROM events
          ORDER BY occurred_at_epoch_millis DESC, audit_id DESC
          LIMIT ? OFFSET ?
        ) page ON TRUE
        """;

    private StoreTerminalAuditHistoryServiceSql() {}
}
