package com.catering.v2s.organization.application.persistence;

/** SQL text fragments owned by OrganizationAuditHistoryService; B3 relocates text only and does not change execution. */
public final class OrganizationAuditHistoryServiceSql {
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_SELECT_ORGANIZATION_SELECT_EXISTS_SELECT_1_FROM_ = "SELECT EXISTS(SELECT 1 FROM organization.";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_WHERE_TEXT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY = " WHERE id::text=? AND workspace_uuid=? AND group_workspace_key=?)";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_SELECT_AUDIT_EVENT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY = "SELECT count(*) FROM organization.audit_event WHERE workspace_uuid=? AND group_workspace_key=? AND ";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_ENTITY_TYPE_ENTITY_REF_TEXT = "entity_type=? AND entity_ref_text=?";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_SELECT_OCCURRED_AT_EPOCH_MILLIS = "SELECT id, occurred_at_epoch_millis, actor_display_snapshot, action, entity_type, entity_ref_text, ";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_AUDIT_EVENT_CHANGES_JSON_TEXT_WORKSPACE_UUID = "changes_json::text FROM organization.audit_event WHERE workspace_uuid=? AND ";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_GROUP_WORKSPACE_KEY_ENTITY_TYPE_ENTITY_REF_TEXT = "group_workspace_key=? AND entity_type=? AND entity_ref_text=? ORDER BY ";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_OCCURRED_AT_EPOCH_MILLIS = "occurred_at_epoch_millis ";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_DESC_DIRECTION_DESC_ID_DESC_LIMIT_OFFSET = "DESC, id DESC LIMIT ? OFFSET ?";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_CTE_LATERAL = """
        WITH events AS (
          SELECT id, occurred_at_epoch_millis, actor_display_snapshot, action, entity_type, entity_ref_text,
                 changes_json::text AS changes_json, count(*) OVER () AS total
          FROM organization.audit_event
          WHERE workspace_uuid=? AND group_workspace_key=? AND entity_type='GROUP_WORKSPACE'
            AND entity_ref_text=? AND action='COMMERCIAL_GROUP_INITIALIZED'
        ), summary AS (SELECT COALESCE(MAX(total), 0) AS total FROM events)
        SELECT summary.total, page.event_id, page.occurred_at_epoch_millis, page.actor_display_snapshot,
               page.action, page.entity_type, page.entity_ref_text, page.changes_json
        FROM summary LEFT JOIN LATERAL (
          SELECT id AS event_id, occurred_at_epoch_millis, actor_display_snapshot, action, entity_type,
                 entity_ref_text, changes_json FROM events
          ORDER BY occurred_at_epoch_millis DESC, id DESC LIMIT ? OFFSET ?
        ) page ON TRUE
        """;
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_SELECT_COMMERCIAL_GROUP_GROUP_WORKSPACE_ID = "SELECT commercial_group.group_workspace_id FROM organization.commercial_group commercial_group JOIN ";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_GROUP_WORKSPACE_WORKSPACE = "platform_workspace.group_workspace workspace ON ";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_WORKSPACE_COMMERCIAL_GROUP_GROUP_WORKSPACE_ID = "workspace.id=commercial_group.group_workspace_id AND ";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_WORKSPACE_GROUP_WORKSPACE_KEY_COMMERCIAL_GROUP = "workspace.group_workspace_key=commercial_group.group_workspace_key WHERE ";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_COMMERCIAL_GROUP = "commercial_group.commercial_group_uuid::text=? AND workspace.workspace_uuid=? AND ";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_COMMERCIAL_GROUP_GROUP_WORKSPACE_KEY = "commercial_group.group_workspace_key=?";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_SELECT_AUDIT_EVENT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_ALTERNATE_A = "SELECT count(*) FROM organization.audit_event WHERE workspace_uuid=? AND group_workspace_key=? AND ";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_OPEN_PAREN_ENTITY_TYPE_GROUP_WORKSPACE_ENTITY_REF_TEXT = "((entity_type='GROUP_WORKSPACE' AND entity_ref_text=? AND ";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_ACTION = "action='COMMERCIAL_GROUP_INITIALIZED') OR (entity_type='COMMERCIAL_GROUP' AND ";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_ENTITY_REF_TEXT = "entity_ref_text=?))";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_SELECT_OCCURRED_AT_EPOCH_MILLIS_ALTERNATE_A = "SELECT id, occurred_at_epoch_millis, actor_display_snapshot, action, entity_type, entity_ref_text, ";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_AUDIT_EVENT_CHANGES_JSON_TEXT_WORKSPACE_UUID_ALTERNATE_A = "changes_json::text FROM organization.audit_event WHERE workspace_uuid=? AND ";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_GROUP_WORKSPACE_KEY = "group_workspace_key=? AND ((entity_type='GROUP_WORKSPACE' AND entity_ref_text=? AND ";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_ACTION_ALTERNATE_A = "action='COMMERCIAL_GROUP_INITIALIZED') OR (entity_type='COMMERCIAL_GROUP' AND ";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_ENTITY_REF_TEXT_OCCURRED_AT_EPOCH_MILLIS = "entity_ref_text=?)) ORDER BY occurred_at_epoch_millis DESC, id DESC LIMIT ? OFFSET ?";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_SELECT_COMMERCIAL_GROUP_COMMERCIAL_GROUP_UUID = "SELECT commercial_group.commercial_group_uuid AS id, ";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_COMMERCIAL_GROUP_ALTERNATE_A = "commercial_group.group_workspace_id::text AS initialization_ref, TRUE AS group_only, ";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_NODE_SCOPE = "FALSE AS node_scope, ";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_COMMERCIAL_GROUP_HEAD_COMPANY_SCOPE_STORE_SCOPE = "FALSE AS head_company_scope, FALSE AS store_scope FROM organization.commercial_group ";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_COMMERCIAL_GROUP_ALTERNATE_B = "commercial_group WHERE ";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_COMMERCIAL_GROUP_ALTERNATE_C = "commercial_group.commercial_group_uuid=? AND commercial_group.group_workspace_key=?";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_SELECT_NODE_TEXT_INITIALIZATION_REF = "SELECT node.id, NULL::text AS initialization_ref, FALSE AS ";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_GROUP_ONLY_NODE_SCOPE_HEAD_COMPANY_SCOPE_STORE_SCOPE = "group_only, TRUE AS node_scope, FALSE AS head_company_scope, FALSE AS store_scope FROM ";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_ALTERNATIVE_ORGANIZATION_NODE_NODE_WORKSPACE_UUID = "organization.organization_node node WHERE node.id=? AND node.workspace_uuid=? AND ";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_NODE_GROUP_WORKSPACE_KEY = "node.group_workspace_key=?";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_SELECT_BRAND_TEXT_INITIALIZATION_REF_GROUP_ONLY = "SELECT brand.id, NULL::text AS initialization_ref, TRUE AS group_only, FALSE AS ";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_BRAND_NODE_SCOPE_HEAD_COMPANY_SCOPE_STORE_SCOPE = "node_scope, FALSE AS head_company_scope, FALSE AS store_scope FROM organization.brand ";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_BRAND = "brand WHERE ";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_BRAND_WORKSPACE_UUID_GROUP_WORKSPACE_KEY = "brand.id=? AND brand.workspace_uuid=? AND brand.group_workspace_key=?";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_SELECT_TENANT_TEXT_INITIALIZATION_REF_GROUP_ONLY = "SELECT tenant.id, NULL::text AS initialization_ref, TRUE AS group_only, FALSE AS ";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_TENANT_NODE_SCOPE_HEAD_COMPANY_SCOPE_STORE_SCOPE = "node_scope, FALSE AS head_company_scope, FALSE AS store_scope FROM organization.tenant ";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_TENANT = "tenant WHERE ";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_TENANT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY = "tenant.id=? AND tenant.workspace_uuid=? AND tenant.group_workspace_key=?";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_SELECT_HEAD_COMPANY_TEXT_INITIALIZATION_REF = "SELECT head_company.id, NULL::text AS initialization_ref, FALSE AS ";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_GROUP_ONLY_NODE_SCOPE_HEAD_COMPANY_SCOPE_STORE_SCOPE_ALTERNATE_A = "group_only, FALSE AS node_scope, TRUE AS head_company_scope, FALSE AS store_scope ";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_FROM_CLAUSE_HEAD_COMPANY_FROM_ORGANIZATION_HEAD_COMPA = "FROM organization.head_company head_company WHERE head_company.id=? AND ";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_HEAD_COMPANY_WORKSPACE_UUID_GROUP_WORKSPACE_KEY = "head_company.workspace_uuid=? AND head_company.group_workspace_key=?";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_SELECT_STORE_TEXT_INITIALIZATION_REF_GROUP_ONLY = "SELECT store.id, NULL::text AS initialization_ref, FALSE AS group_only, FALSE ";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_NODE_SCOPE_HEAD_COMPANY_SCOPE_STORE_SCOPE = "AS node_scope, FALSE AS head_company_scope, TRUE AS store_scope FROM ";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_ALTERNATIVE_STORE_WORKSPACE_UUID = "organization.store store WHERE store.id=? AND store.workspace_uuid=? AND ";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_STORE_GROUP_WORKSPACE_KEY = "store.group_workspace_key=?";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_CTE_TARGET = "WITH target AS (";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_CLOSE_PAREN_AUTH_SCOPE_TARGET_FOUND = "), auth_scope AS (SELECT target.id IS NOT NULL AS found, CASE WHEN target.id IS NULL THEN FALSE ";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_WHEN_TARGET_GROUP_ONLY_NODE_SCOPE = "WHEN target.group_only THEN ?='GROUP' WHEN target.node_scope THEN target.id=ANY(?) WHEN ";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_TARGET_HEAD_COMPANY_SCOPE_STORE_SCOPE = "target.head_company_scope THEN target.id=ANY(?) WHEN target.store_scope THEN target.id=ANY(?) ";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_ELSE_AUTHORIZED_TARGET_INITIALIZATION_REF_INPUT = "ELSE FALSE END AS authorized, target.initialization_ref FROM (VALUES (1)) input(value) LEFT ";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_JOIN_TARGET_AUDIT_ROWS_EVENT_AUDIT_ID = "JOIN target ON TRUE), audit_rows AS (SELECT event.id AS audit_id, ";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_EVENT = "event.occurred_at_epoch_millis, event.actor_display_snapshot, event.action, event.entity_type, ";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_EVENT_ENTITY_REF_TEXT_CHANGES_JSON_TEXT = "event.entity_ref_text, event.changes_json::text AS changes_json, count(*) OVER() AS total FROM ";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_ALTERNATIVE_AUTH_SCOPE_AUDIT_EVENT_EVENT_FOUND = "organization.audit_event event CROSS JOIN auth_scope WHERE auth_scope.found AND ";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_AUTH_SCOPE_AUTHORIZED_EVENT_WORKSPACE_UUID = "auth_scope.authorized AND event.workspace_uuid=? AND event.group_workspace_key=? AND ";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_OPEN_PAREN_COMMERCIAL_GROUP_EVENT_ENTITY_TYPE_ENTITY_REF_TEXT = "((?='COMMERCIAL_GROUP' AND ((event.entity_type='COMMERCIAL_GROUP' AND event.entity_ref_text=?) ";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_ALTERNATIVE_EVENT_ENTITY_TYPE_GROUP_WORKSPACE_ENTITY_REF_TEXT = "OR (event.entity_type='GROUP_WORKSPACE' AND event.entity_ref_text=auth_scope.initialization_ref ";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_CONDITION_EVENT = "AND event.action='COMMERCIAL_GROUP_INITIALIZED'))) OR (?<>'COMMERCIAL_GROUP' AND ";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_AUDIT_ROWS = "event.entity_type=? AND event.entity_ref_text=?))), page_rows AS (SELECT * FROM audit_rows ";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_ORDER_BY_OCCURRED_AT_EPOCH_MILLIS_AUDIT_ID_TOTAL_ROWS = "ORDER BY occurred_at_epoch_millis DESC, audit_id DESC LIMIT ? OFFSET ?), total_rows AS (SELECT ";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_AUDIT_ROWS_TOTAL_AUTH_SCOPE_FOUND = "coalesce(max(total), 0) AS total FROM audit_rows) SELECT auth_scope.found, ";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_AUTH_SCOPE_AUTHORIZED_TOTAL_ROWS_TOTAL = "auth_scope.authorized, total_rows.total, page_rows.audit_id, ";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_PAGE_ROWS = "page_rows.occurred_at_epoch_millis, page_rows.actor_display_snapshot, page_rows.action, ";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_AUTH_SCOPE = "page_rows.entity_type, page_rows.entity_ref_text, page_rows.changes_json FROM auth_scope CROSS ";
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_JOIN_PAGE_ROWS_JOIN_TOTAL_ROWS_LEFT_JOIN_PA = "JOIN total_rows LEFT JOIN page_rows ON TRUE";

    /** Owner projection for store-owned service-point facts; table and identifier fragments are closed below. */
    public static final String ORGANIZATION_AUDIT_HISTORY_SERVICE_SERVICE_POINT_TARGET_AUDIT_PROJECTION = """
        WITH target AS (
          SELECT target.store_ref
          FROM organization.%s target
          WHERE target.%s=? AND target.workspace_uuid=? AND target.group_workspace_key=?
        ), auth_scope AS (
          SELECT EXISTS(SELECT 1 FROM target) AS found,
                 COALESCE((SELECT store_ref FROM target)=ANY(?), FALSE) AS authorized
          FROM (VALUES (1)) input(value)
        ), audit_rows AS (
          SELECT event.id AS audit_id, event.occurred_at_epoch_millis, event.actor_display_snapshot,
                 event.action, event.entity_type, event.entity_ref_text,
                 event.changes_json::text AS changes_json, count(*) OVER() AS total
          FROM organization.audit_event event CROSS JOIN auth_scope
          WHERE auth_scope.found AND auth_scope.authorized
            AND event.workspace_uuid=? AND event.group_workspace_key=?
            AND event.entity_type=? AND event.entity_ref_text=?
        ), page_rows AS (
          SELECT * FROM audit_rows
          ORDER BY occurred_at_epoch_millis DESC, audit_id DESC LIMIT ? OFFSET ?
        ), total_rows AS (
          SELECT coalesce(max(total), 0) AS total FROM audit_rows
        )
        SELECT auth_scope.found, auth_scope.authorized, total_rows.total,
               page_rows.audit_id, page_rows.occurred_at_epoch_millis, page_rows.actor_display_snapshot,
               page_rows.action, page_rows.entity_type, page_rows.entity_ref_text, page_rows.changes_json
        FROM auth_scope CROSS JOIN total_rows LEFT JOIN page_rows ON TRUE
        """;
}
