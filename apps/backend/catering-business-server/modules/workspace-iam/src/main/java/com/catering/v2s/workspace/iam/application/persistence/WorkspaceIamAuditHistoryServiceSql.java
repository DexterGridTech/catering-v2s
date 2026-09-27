package com.catering.v2s.workspace.iam.application.persistence;

/**
 * SQL text fragments owned by WorkspaceIamAuditHistoryService; B3 relocates text only and does not change execution.
 */
public final class WorkspaceIamAuditHistoryServiceSql {
    public static final String SQL_CLOSE_PAREN = ")";
    public static final String SQL_CLOSE_PARENS = "))";
    public static final String WORKSPACE_IAM_AUDIT_HISTORY_SERVICE_SELECT_WORKSPACE_IAM_SELECT_EXISTS_SELECT_1_FROM_ =
            "SELECT EXISTS(SELECT 1 FROM workspace_iam.";
    public static final String WORKSPACE_IAM_AUDIT_HISTORY_SERVICE_WHERE_TEXT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY =
            " WHERE id::text=? AND workspace_uuid=? AND group_workspace_key=?)";
    public static final String SELECT_AUDIT_EVENT_WS_UUID_001 =
            ("SELECT count(*) FROM workspace_iam.audit_event WHERE workspace_uuid=? AN"
                    + "D group_workspace_key=? AND ");
    public static final String WORKSPACE_IAM_AUDIT_HISTORY_SERVICE_ENTITY_TYPE_ENTITY_REF_TEXT =
            "entity_type=? AND entity_ref_text=?";
    public static final String WORKSPACE_IAM_AUDIT_HISTORY_SERVICE_SELECT_OCCURRED_AT_EPOCH_MILLIS =
            "SELECT id, occurred_at_epoch_millis, actor_display_snapshot, action, entity_type, entity_ref_text, ";
    public static final String WORKSPACE_IAM_AUDIT_HISTORY_SERVICE_AUDIT_EVENT_CHANGES_JSON_TEXT_WORKSPACE_UUID =
            "changes_json::text FROM workspace_iam.audit_event WHERE workspace_uuid=? AND ";
    public static final String WORKSPACE_IAM_AUDIT_HISTORY_SERVICE_GROUP_WORKSPACE_KEY_ENTITY_TYPE_ENTITY_REF_TEXT =
            "group_workspace_key=? AND entity_type=? AND entity_ref_text=? ORDER BY ";
    public static final String WORKSPACE_IAM_AUDIT_HISTORY_SERVICE_OCCURRED_AT_EPOCH_MILLIS =
            "occurred_at_epoch_millis ";
    public static final String WORKSPACE_IAM_AUDIT_HISTORY_SERVICE_DESC_DIRECTION_DESC_ID_DESC_LIMIT_OFFSET =
            "DESC, id DESC LIMIT ? OFFSET ?";
    public static final String WORKSPACE_IAM_AUDIT_HISTORY_SERVICE_CTE_LATERAL =
            """
        WITH target AS (SELECT 1 FROM workspace_iam.%s WHERE id::text=? AND workspace_uuid=? AND group_workspace_key=?),
        events AS (
          SELECT id, occurred_at_epoch_millis, actor_display_snapshot, action, entity_type, entity_ref_text,
                 changes_json::text AS changes_json, count(*) OVER () AS total
          FROM workspace_iam.audit_event
          WHERE EXISTS (SELECT 1 FROM target) AND workspace_uuid=? AND group_workspace_key=?
            AND entity_type=? AND entity_ref_text=?
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
    public static final String WORKSPACE_IAM_AUDIT_HISTORY_SERVICE_SELECT_ROLE_ASSIGNMENT =
            "SELECT assignment.service_node_type, assignment.service_node_id FROM workspace_iam.role_assignment ";
    public static final String WORKSPACE_IAM_AUDIT_HISTORY_SERVICE_ASSIGNMENT_ACCOUNT_ID_SUBJECT_WORKSPACE_UUID =
            "assignment WHERE assignment.account_id=subject.id AND assignment.workspace_uuid=? AND ";
    public static final String WORKSPACE_IAM_AUDIT_HISTORY_SERVICE_ASSIGNMENT_GROUP_WORKSPACE_KEY_STATUS_ACTIVE =
            "assignment.group_workspace_key=? AND assignment.status='ACTIVE'";
    public static final String WORKSPACE_IAM_AUDIT_HISTORY_SERVICE_SELECT_INTENT_SERVICE_NODE_TYPE_SERVICE_NODE_ID =
            "SELECT intent.service_node_type, intent.service_node_id FROM ";
    public static final String WORKSPACE_IAM_AUDIT_HISTORY_SERVICE_INVITATION_ASSIGNMENT_INTENT =
            "workspace_iam.invitation_assignment_intent intent WHERE intent.invitation_id=subject.id";
    public static final String WORKSPACE_IAM_AUDIT_HISTORY_SERVICE_CTE_WORKSPACE_IAM_SUBJECT_ENTITY_INPUT_VALUE =
            "WITH subject AS (SELECT entity.id FROM (VALUES (1)) input(value) LEFT JOIN workspace_iam.";
    public static final String WORKSPACE_IAM_AUDIT_HISTORY_SERVICE_THEN_SUBJECT_AUTHORIZED_AUDIT_ROWS_EVENT_AUDIT_ID =
            " THEN TRUE ELSE FALSE END AS authorized FROM subject), audit_rows AS (SELECT event.id AS audit_id, ";
    public static final String WORKSPACE_IAM_AUDIT_HISTORY_SERVICE_EVENT =
            "event.occurred_at_epoch_millis, event.actor_display_snapshot, event.action, event.entity_type, ";
    public static final String WORKSPACE_IAM_AUDIT_HISTORY_SERVICE_EVENT_ENTITY_REF_TEXT_CHANGES_JSON_TEXT =
            "event.entity_ref_text, event.changes_json::text AS changes_json, count(*) OVER() AS total FROM ";
    public static final String WORKSPACE_IAM_AUDIT_HISTORY_SERVICE_AUTH_SCOPE_AUDIT_EVENT_EVENT_FOUND =
            "workspace_iam.audit_event event CROSS JOIN auth_scope WHERE auth_scope.found AND ";
    public static final String WORKSPACE_IAM_AUDIT_HISTORY_SERVICE_AUTH_SCOPE_AUTHORIZED_EVENT_WORKSPACE_UUID =
            "auth_scope.authorized AND event.workspace_uuid=? AND event.group_workspace_key=? AND ";
    public static final String WORKSPACE_IAM_AUDIT_HISTORY_SERVICE_AUDIT_ROWS =
            "event.entity_type=? AND event.entity_ref_text=?), page_rows AS (SELECT * FROM audit_rows ORDER ";
    public static final String WORKSPACE_IAM_AUDIT_HISTORY_SERVICE_OCCURRED_AT_EPOCH_MILLIS_AUDIT_ID_TOTAL_ROWS =
            "BY occurred_at_epoch_millis DESC, audit_id DESC LIMIT ? OFFSET ?), total_rows AS (SELECT ";
    public static final String WORKSPACE_IAM_AUDIT_HISTORY_SERVICE_AUDIT_ROWS_TOTAL_AUTH_SCOPE_FOUND =
            "coalesce(max(total), 0) AS total FROM audit_rows) SELECT auth_scope.found, ";
    public static final String WORKSPACE_IAM_AUDIT_HISTORY_SERVICE_AUTH_SCOPE_AUTHORIZED_TOTAL_ROWS_TOTAL =
            "auth_scope.authorized, total_rows.total, page_rows.audit_id, ";
    public static final String WORKSPACE_IAM_AUDIT_HISTORY_SERVICE_PAGE_ROWS =
            "page_rows.occurred_at_epoch_millis, page_rows.actor_display_snapshot, page_rows.action, ";
    public static final String WORKSPACE_IAM_AUDIT_HISTORY_SERVICE_AUTH_SCOPE =
            "page_rows.entity_type, page_rows.entity_ref_text, page_rows.changes_json FROM auth_scope CROSS ";
    public static final String WORKSPACE_IAM_AUDIT_HISTORY_SERVICE_JOIN_PAGE_ROWS_JOIN_TOTAL_ROWS_LEFT_JOIN_PA =
            "JOIN total_rows LEFT JOIN page_rows ON TRUE";
    public static final String ALLOWED_TARGET_SCOPE =
            "(target.service_node_type='GROUP' AND ?='GROUP' AND target.service_node_id=?) OR "
                    + "(target.service_node_type='REGION' AND target.service_node_id=ANY(?)) OR "
                    + "(target.service_node_type='PROJECT' AND target.service_node_id=ANY(?)) OR "
                    + "(target.service_node_type='HEAD_COMPANY' AND target.service_node_id=ANY(?)) OR "
                    + "(target.service_node_type='STORE' AND target.service_node_id=ANY(?))";
    public static final String AUTHORIZATION_EXISTS_PREFIX = "EXISTS (SELECT 1 FROM (";
    public static final String AUTHORIZATION_EXISTS_SUFFIX = ") target WHERE ";
    public static final String AUTHORIZATION_NOT_EXISTS_PREFIX = "NOT EXISTS (SELECT 1 FROM (";
    public static final String AUTHORIZATION_NOT_EXISTS_SUFFIX = ") target WHERE NOT (";
    public static final String ENTITY_JOIN_SUFFIX =
            " entity ON entity.id=? AND entity.workspace_uuid=? AND entity.group_workspace_key=?), auth_scope AS ";
    public static final String AUTH_SCOPE_PREFIX =
            "(SELECT subject.id IS NOT NULL AS found, CASE WHEN subject.id IS NULL THEN FALSE WHEN ";
}
