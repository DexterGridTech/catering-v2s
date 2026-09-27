package com.catering.v2s.extension.application.persistence;

/** SQL text owned by ExtensionAuditHistoryService; B3 relocates text without changing execution. */
public final class ExtensionAuditHistoryServiceSql {
    public static final String EXTENSION_AUDIT_HISTORY_SERVICE_SELECT_EXTENSION_DEFINITION_GROUP_WORKSPACE_KEY =
            "SELECT EXISTS(SELECT 1 FROM extension.extension_definition WHERE group_workspace_key=? AND ";
    public static final String EXTENSION_AUDIT_HISTORY_SERVICE_ENTITY_TYPE = "entity_type=?)";
    public static final String EXTENSION_AUDIT_HISTORY_SERVICE_SELECT_AUDIT_EVENT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY =
            "SELECT count(*) FROM extension.audit_event WHERE workspace_uuid=? AND group_workspace_key=? AND ";
    public static final String EXTENSION_AUDIT_HISTORY_SERVICE_ENTITY_TYPE_EXTENSION_DEFINITION_ENTITY_REF_TEXT =
            "entity_type='EXTENSION_DEFINITION' AND entity_ref_text=?";
    public static final String EXTENSION_AUDIT_HISTORY_SERVICE_SELECT_OCCURRED_AT_EPOCH_MILLIS =
            "SELECT id, occurred_at_epoch_millis, actor_display_snapshot, action, entity_type, entity_ref_text, ";
    public static final String EXTENSION_AUDIT_HISTORY_SERVICE_AUDIT_EVENT_CHANGES_JSON_TEXT_WORKSPACE_UUID =
            "changes_json::text FROM extension.audit_event WHERE workspace_uuid=? AND ";
    public static final String EXTENSION_AUDIT_HISTORY_SERVICE_GROUP_WORKSPACE_KEY = "group_workspace_key=? ";
    public static final String CONDITION_ENTITY_TYPE_EXTENSION_DEF_001 =
            "AND entity_type='EXTENSION_DEFINITION' AND entity_ref_text=? ORDER BY ";
    public static final String EXTENSION_AUDIT_HISTORY_SERVICE_OCCURRED_AT_EPOCH_MILLIS = "occurred_at_epoch_millis ";
    public static final String EXTENSION_AUDIT_HISTORY_SERVICE_DESC_DIRECTION_DESC_ID_DESC_LIMIT_OFFSET =
            "DESC, id DESC LIMIT ? OFFSET ?";
    public static final String EXTENSION_AUDIT_HISTORY_SERVICE_CTE_LATERAL =
            """
        WITH target AS (SELECT 1 FROM extension.extension_definition WHERE group_workspace_key=? AND entity_type=?),
        events AS (
          SELECT id, occurred_at_epoch_millis, actor_display_snapshot, action, entity_type, entity_ref_text,
                 changes_json::text AS changes_json, count(*) OVER () AS total
          FROM extension.audit_event
          WHERE EXISTS (SELECT 1 FROM target) AND workspace_uuid=? AND group_workspace_key=?
            AND entity_type='EXTENSION_DEFINITION' AND entity_ref_text=?
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
