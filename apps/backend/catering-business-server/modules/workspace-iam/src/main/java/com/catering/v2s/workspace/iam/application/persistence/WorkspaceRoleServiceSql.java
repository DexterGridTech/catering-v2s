package com.catering.v2s.workspace.iam.application.persistence;

/** SQL text fragments owned by WorkspaceRoleService; B3 relocates text only and does not change execution. */
public final class WorkspaceRoleServiceSql {
    public static final String PARAMETER_PLACEHOLDER = "?";
    public static final String PLACEHOLDER_SEPARATOR = ",";
    public static final String ROLE_NAME_ORDER = "name";
    public static final String ROLE_UPDATED_AT_ORDER = "updated_at_epoch_millis";
    public static final String SORT_DIRECTION_ASC = "ASC";
    public static final String SORT_DIRECTION_DESC = "DESC";
    public static final String SQL_SPACE = " ";
    public static final String SQL_CLOSE_PAREN = ")";
    public static final String WORKSPACE_ROLE_SERVICE_INSERT_INTO_WORKSPACE_ROLE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_NAME = "INSERT INTO workspace_iam.workspace_role (id, workspace_uuid, group_workspace_key, name, ";
    public static final String WORKSPACE_ROLE_SERVICE_CONTINUATION_SERVICE_NODE_TYPE_DESCRIPTION_STATUS_VERSION = "service_node_type, description, status, version, created_at_epoch_millis, ";
    public static final String WORKSPACE_ROLE_SERVICE_UPDATE_UPDATED_AT_EPOCH_MILLIS_PAGE_ACCESS_KEYS_CAPABILITY_KEYS = "updated_at_epoch_millis, page_access_keys, capability_keys) VALUES (?, ?, ?, ?, ?, ?, ";
    public static final String WORKSPACE_ROLE_SERVICE_CONTINUATION_ENABLED = "'ENABLED', 1, ?, ?, CAST(? AS JSONB), CAST(? AS JSONB))";
    public static final String WORKSPACE_ROLE_SERVICE_UPDATE_WORKSPACE_ROLE_NAME_DESCRIPTION_PAGE_ACCESS_KEYS = "UPDATE workspace_iam.workspace_role SET name=?, description=?, page_access_keys=CAST(? AS ";
    public static final String WORKSPACE_ROLE_SERVICE_CONTINUATION_CAPABILITY_KEYS_VERSION = "JSONB), capability_keys=CAST(? AS JSONB), version=version+1, ";
    public static final String WORKSPACE_ROLE_SERVICE_UPDATE_UPDATED_AT_EPOCH_MILLIS = "updated_at_epoch_millis=? ";
    public static final String WORKSPACE_ROLE_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_VERSION = "WHERE id=? AND workspace_uuid=? AND group_workspace_key=? AND version=?";
    public static final String WORKSPACE_ROLE_SERVICE_UPDATE_WORKSPACE_ROLE_STATUS_VERSION = "UPDATE workspace_iam.workspace_role SET status=?, version=version+1, ";
    public static final String WORKSPACE_ROLE_SERVICE_UPDATE_UPDATED_AT_EPOCH_MILLIS_WORKSPACE_UUID = "updated_at_epoch_millis=? WHERE id=? AND workspace_uuid=? AND ";
    public static final String WORKSPACE_ROLE_SERVICE_CONTINUATION_GROUP_WORKSPACE_KEY_VERSION = "group_workspace_key=? AND version=?";
    public static final String WORKSPACE_ROLE_SERVICE_CTE_FILTERED_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_NAME = "WITH filtered AS MATERIALIZED (SELECT id, workspace_uuid, group_workspace_key, name, description, ";
    public static final String WORKSPACE_ROLE_SERVICE_CONTINUATION_SERVICE_NODE_TYPE_STATUS_VERSION_CREATED_AT_EPOCH_MILLIS = "service_node_type, status, version, created_at_epoch_millis, updated_at_epoch_millis, ";
    public static final String WORKSPACE_ROLE_SERVICE_CONTINUATION_PAGE_ACCESS_KEYS_CAPABILITY_KEYS_TOTAL = "page_access_keys, capability_keys, COUNT(*) OVER () AS total FROM ";
    public static final String WORKSPACE_ROLE_SERVICE_CONTINUATION_WORKSPACE_ROLE = "workspace_iam.workspace_role ";
    public static final String WORKSPACE_ROLE_SERVICE_WHERE = "WHERE ";
    public static final String WORKSPACE_ROLE_SERVICE_VALUE_SEPARATOR_PAGE_TOTAL_TOTAL = ", id ASC LIMIT ? OFFSET ?), page_total AS (SELECT COALESCE(MAX(total), (SELECT COUNT(*) ";
    public static final String WORKSPACE_ROLE_SERVICE_FROM_CLAUSE_PAGED_TOTAL_WORKSPACE_UUID = "FROM filtered)) AS total FROM paged) SELECT paged.id, paged.workspace_uuid, ";
    public static final String WORKSPACE_ROLE_SERVICE_CONTINUATION_PAGED_GROUP_WORKSPACE_KEY_NAME_DESCRIPTION = "paged.group_workspace_key, paged.name, paged.description, paged.service_node_type, ";
    public static final String WORKSPACE_ROLE_SERVICE_CONTINUATION_PAGED_STATUS_VERSION_CREATED_AT_EPOCH_MILLIS = "paged.status, paged.version, paged.created_at_epoch_millis, ";
    public static final String WORKSPACE_ROLE_SERVICE_CONTINUATION_PAGED_UPDATED_AT_EPOCH_MILLIS_PAGE_ACCESS_KEYS_CAPABILITY_KEYS = "paged.updated_at_epoch_millis, paged.page_access_keys, paged.capability_keys, ";
    public static final String WORKSPACE_ROLE_SERVICE_CONTINUATION_PAGED_TOTAL = "page_total.total FROM page_total LEFT JOIN paged ON TRUE ORDER BY paged.";
    public static final String WORKSPACE_ROLE_SERVICE_SELECT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_NAME_DESCRIPTION = "SELECT id, workspace_uuid, group_workspace_key, name, description, service_node_type, status, ";
    public static final String WORKSPACE_ROLE_SERVICE_CONTINUATION_VERSION = "version, created_at_epoch_millis, updated_at_epoch_millis, page_access_keys, ";
    public static final String WORKSPACE_ROLE_SERVICE_CONTINUATION_CAPABILITY_KEYS = "capability_keys ";
    public static final String WORKSPACE_ROLE_SERVICE_FROM_CLAUSE_WORKSPACE_ROLE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY = "FROM workspace_iam.workspace_role WHERE id=? AND workspace_uuid=? AND group_workspace_key=?";
    public static final String WORKSPACE_ROLE_SERVICE_SELECT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_NAME_DESCRIPTION_ALTERNATE_A = "SELECT id, workspace_uuid, group_workspace_key, name, description, service_node_type, status, ";
    public static final String WORKSPACE_ROLE_SERVICE_CONTINUATION_VERSION_ALTERNATE_A = "version, created_at_epoch_millis, updated_at_epoch_millis, page_access_keys, ";
    public static final String WORKSPACE_ROLE_SERVICE_CONTINUATION_CAPABILITY_KEYS_ALTERNATE_A = "capability_keys ";
    public static final String WORKSPACE_ROLE_SERVICE_FROM_CLAUSE_WORKSPACE_ROLE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_ALTERNATE_A = "FROM workspace_iam.workspace_role WHERE workspace_uuid=? AND group_workspace_key=? AND id ";
    public static final String WORKSPACE_ROLE_SERVICE_CONTINUATION = "IN (";
    public static final String WORKSPACE_ROLE_SERVICE_INSERT_INTO_AUDIT_EVENT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_ENTITY_TYPE = "INSERT INTO workspace_iam.audit_event (id, workspace_uuid, group_workspace_key, entity_type, ";
    public static final String WORKSPACE_ROLE_SERVICE_CONTINUATION_ENTITY_REF_TEXT_ACTOR_TYPE_ACTOR_ID_ACTOR_DISPLAY_SNAPSHOT = "entity_ref_text, actor_type, actor_id, actor_display_snapshot, action, ";
    public static final String WORKSPACE_ROLE_SERVICE_CONTINUATION_OCCURRED_AT_EPOCH_MILLIS_CHANGES_JSON_WORKSPACE_ROLE = "occurred_at_epoch_millis, changes_json) VALUES (?, ?, ?, 'WORKSPACE_ROLE', ?, ?, ?, ?, ?, ";
    public static final String WORKSPACE_ROLE_SERVICE_PARAMETER_PLACEHOLDER = "?, ";
    public static final String WORKSPACE_ROLE_SERVICE_CONTINUATION_CAST_AS_JSONB = "CAST(? AS JSONB))";
    public static final String ROLE_PAGE_WHERE =
            "workspace_uuid=? AND group_workspace_key=? AND (CAST(? AS text) IS NULL OR name ILIKE '%' || ? || '%') "
                    + "AND (CAST(? AS text) IS NULL OR service_node_type=?) AND (CAST(? AS text) IS NULL OR status=?)";
    public static final String ROLE_PAGE_ORDER_PREFIX = "), paged AS (SELECT * FROM filtered ORDER BY ";
    public static final String ROLE_PAGE_ORDER_SUFFIX = ", paged.id ASC";
}
