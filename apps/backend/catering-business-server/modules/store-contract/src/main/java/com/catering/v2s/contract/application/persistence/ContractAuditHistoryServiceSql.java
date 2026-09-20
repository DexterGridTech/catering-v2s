package com.catering.v2s.contract.application.persistence;

/** SQL text fragments owned by ContractAuditHistoryService; B3 relocates text only and does not change execution. */
public final class ContractAuditHistoryServiceSql {
    public static final String CONTRACT_AUDIT_HISTORY_SERVICE_SELECT_STORE_CONTRACT_TEXT_WORKSPACE_UUID = "SELECT EXISTS(SELECT 1 FROM contract.store_contract WHERE id::text=? AND workspace_uuid=? AND ";
    public static final String CONTRACT_AUDIT_HISTORY_SERVICE_GROUP_WORKSPACE_KEY = "group_workspace_key=?)";
    public static final String CONTRACT_AUDIT_HISTORY_SERVICE_SELECT_AUDIT_EVENT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY = "SELECT count(*) FROM contract.audit_event WHERE workspace_uuid=? AND group_workspace_key=? AND ";
    public static final String CONTRACT_AUDIT_HISTORY_SERVICE_ENTITY_TYPE_STORE_CONTRACT_ENTITY_REF_TEXT = "entity_type='STORE_CONTRACT' AND entity_ref_text=?";
    public static final String CONTRACT_AUDIT_HISTORY_SERVICE_SELECT_OCCURRED_AT_EPOCH_MILLIS = "SELECT id, occurred_at_epoch_millis, actor_display_snapshot, action, entity_type, entity_ref_text, ";
    public static final String CONTRACT_AUDIT_HISTORY_SERVICE_AUDIT_EVENT_CHANGES_JSON_TEXT_WORKSPACE_UUID = "changes_json::text FROM contract.audit_event WHERE workspace_uuid=? AND ";
    public static final String CONTRACT_AUDIT_HISTORY_SERVICE_GROUP_WORKSPACE_KEY_ALTERNATE_A = "group_workspace_key=? ";
    public static final String CONTRACT_AUDIT_HISTORY_SERVICE_CONDITION_ENTITY_TYPE = "AND entity_type='STORE_CONTRACT' AND entity_ref_text=? ORDER BY occurred_at_epoch_millis ";
    public static final String CONTRACT_AUDIT_HISTORY_SERVICE_DESC_DIRECTION = "DESC, ";
    public static final String CONTRACT_AUDIT_HISTORY_SERVICE_ID_DESC_LIMIT_OFFSET = "id DESC LIMIT ? OFFSET ?";
    public static final String CONTRACT_AUDIT_HISTORY_SERVICE_CTE_LATERAL = """
        WITH target AS (SELECT 1 FROM contract.store_contract WHERE id::text=? AND workspace_uuid=? AND \
        group_workspace_key=?),
        events AS (
          SELECT id, occurred_at_epoch_millis, actor_display_snapshot, action, entity_type, entity_ref_text,
                 changes_json::text AS changes_json, count(*) OVER () AS total
          FROM contract.audit_event
          WHERE EXISTS (SELECT 1 FROM target) AND workspace_uuid=? AND group_workspace_key=?
            AND entity_type='STORE_CONTRACT' AND entity_ref_text=?
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
    public static final String CONTRACT_AUDIT_HISTORY_SERVICE_CTE_LATERAL_STORE_ID_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_FOUND = """
        WITH target AS (SELECT contract.id, contract.store_id FROM contract.store_contract contract WHERE \
        contract.id=? AND contract.workspace_uuid=? AND contract.group_workspace_key=?),
        auth_scope AS (SELECT target.id IS NOT NULL AS found, target.store_id=ANY(?) AS authorized FROM (VALUES (1)) \
        input(value) LEFT JOIN target ON TRUE),
        events AS (SELECT event.id AS audit_id, event.occurred_at_epoch_millis, event.actor_display_snapshot, \
        event.action, event.entity_type, event.entity_ref_text, event.changes_json::text AS changes_json, count(*) \
        OVER () AS total FROM contract.audit_event event CROSS JOIN auth_scope WHERE auth_scope.found AND \
        auth_scope.authorized AND event.workspace_uuid=? AND event.group_workspace_key=? AND \
        event.entity_type='STORE_CONTRACT' AND event.entity_ref_text=?),
        summary AS (SELECT COALESCE(MAX(total), 0) AS total FROM events)
        SELECT auth_scope.found, auth_scope.authorized, summary.total, page.audit_id, page.occurred_at_epoch_millis, \
        page.actor_display_snapshot, page.action, page.entity_type, page.entity_ref_text, page.changes_json
        FROM auth_scope CROSS JOIN summary LEFT JOIN LATERAL (SELECT * FROM events ORDER BY occurred_at_epoch_millis \
        DESC, audit_id DESC LIMIT ? OFFSET ?) page ON TRUE
        """;
}
