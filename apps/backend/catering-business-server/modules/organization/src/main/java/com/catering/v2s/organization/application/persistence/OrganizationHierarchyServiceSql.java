package com.catering.v2s.organization.application.persistence;

/** SQL text fragments owned by OrganizationHierarchyService; B3 relocates text only and does not change execution. */
public final class OrganizationHierarchyServiceSql {
    public static final String PARAMETER_PLACEHOLDER = "?";
    public static final String PLACEHOLDER_SEPARATOR = ",";
    public static final String HIERARCHY_ORDER_NAME = "name";
    public static final String HIERARCHY_ORDER_CODE = "code";
    public static final String HIERARCHY_ORDER_UPDATED_AT = "updated_at_epoch_millis";
    public static final String SORT_DIRECTION_ASC = "ASC";
    public static final String SORT_DIRECTION_DESC = "DESC";
    public static final String SQL_SPACE = " ";
    public static final String PATH_CTE_CLOSE_SUFFIX = ") ";
    public static final String PATH_TARGET_ID_COLUMN = "target_id";
    public static final String ORGANIZATION_HIERARCHY_SERVICE_INSERT_INTO_ORGANIZATION_NODE =
            "INSERT INTO organization.organization_node (id, workspace_uuid, group_workspace_key, parent_id, ";
    public static final String ORGANIZATION_HIERARCHY_SERVICE_NODE_TYPE_CODE_NAME_NOTES =
            "node_type, code, name, notes, phase_names, status, version, created_at_epoch_millis, ";
    public static final String ORGANIZATION_HIERARCHY_SERVICE_UPDATE_UPDATED_AT_EPOCH_MILLIS =
            "updated_at_epoch_millis, extension_values, extension_rule_revision) VALUES (?, ?, ?, ?, ?, ";
    public static final String ORGANIZATION_HIERARCHY_SERVICE_PARAMETER_PLACEHOLDER = "?, ";
    public static final String ORGANIZATION_HIERARCHY_SERVICE_PARAMETER_PLACEHOLDER_ENABLED =
            "?, ?, CAST('[]' AS JSONB), 'ENABLED', 1, ?, ?, CAST(? AS JSONB), ?)";
    public static final String ORGANIZATION_HIERARCHY_SERVICE_INSERT_INTO_ORGANIZATION_NODE_ALTERNATE_A =
            "INSERT INTO organization.organization_node (id, workspace_uuid, group_workspace_key, parent_id, ";

    public static final String ORGANIZATION_HIERARCHY_SERVICE_UPDATE_UPDATED_AT_EPOCH_MILLIS_ALTERNATE_A =
            "updated_at_epoch_millis, extension_values, extension_rule_revision) VALUES (?, ?, ?, ?, ?, ";
    public static final String ORGANIZATION_HIERARCHY_SERVICE_PARAMETER_PLACEHOLDER_ALTERNATE_A = "?, ";
    public static final String ORGANIZATION_HIERARCHY_SERVICE_PARAMETER_PLACEHOLDER_ENABLED_ALTERNATE_A =
            "?, ?, CAST('[]' AS JSONB), 'ENABLED', 1, ?, ?, CAST(? AS JSONB), ?)";
    public static final String SELECT_WS_UUID_GRP_WS_001 =
            "SELECT id, workspace_uuid, group_workspace_key, parent_id, node_type, code, name, notes, status, ";
    public static final String ORGANIZATION_HIERARCHY_SERVICE_VERSION =
            "version, created_at_epoch_millis, updated_at_epoch_millis, extension_values::text, ";
    public static final String ORGANIZATION_HIERARCHY_SERVICE_ORGANIZATION_NODE_EXTENSION_RULE_REVISION_WORKSPACE_UUID =
            "extension_rule_revision FROM organization.organization_node WHERE workspace_uuid=? AND ";
    public static final String ORGANIZATION_HIERARCHY_SERVICE_GROUP_WORKSPACE_KEY_NODE_TYPE_REGION_PROJECT =
            "group_workspace_key=? AND node_type IN ('REGION','PROJECT') ORDER BY node_type, code";
    public static final String ORGANIZATION_HIERARCHY_SERVICE_SELECT_PROJECT_PHASE_NAME_PROJECT_ID_PHASE_NAME =
            "SELECT project_id, phase_name FROM organization.project_phase_name WHERE project_id IN (";
    public static final String ORGANIZATION_HIERARCHY_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY =
            " WHERE workspace_uuid=? AND group_workspace_key=?";
    public static final String ORGANIZATION_HIERARCHY_SERVICE_CONDITION_TEXT_NAME_ILIKE_ESCAPE =
            " AND (?::text IS NULL OR name ILIKE ? ESCAPE '!')";
    public static final String ORGANIZATION_HIERARCHY_SERVICE_CONDITION_TEXT_CODE_ILIKE_ESCAPE =
            " AND (?::text IS NULL OR code ILIKE ? ESCAPE '!')";
    public static final String ORGANIZATION_HIERARCHY_SERVICE_CONDITION_TEXT_STATUS =
            " AND (?::text IS NULL OR status=?)";
    public static final String ORGANIZATION_HIERARCHY_SERVICE_CONDITION_TEXT_NODE_TYPE =
            " AND (?::text IS NULL OR node_type=?)";
    public static final String ORGANIZATION_HIERARCHY_SERVICE_CONDITION_AND_UUID_IS_NULL_OR_ID =
            " AND (?::uuid IS NULL OR id=?)";
    public static final String ORGANIZATION_HIERARCHY_SERVICE_SELECT_ORGANIZATION_NODE_SELECT_COUNT_FROM_ORGANIZATI =
            "SELECT COUNT(*) FROM organization.organization_node";
    public static final String SELECT_WS_UUID_GRP_WS_ALT_A_002 =
            "SELECT id, workspace_uuid, group_workspace_key, parent_id, node_type, code, name, notes, status, ";
    public static final String ORGANIZATION_HIERARCHY_SERVICE_VERSION_ALTERNATE_A =
            "version, created_at_epoch_millis, updated_at_epoch_millis, extension_values::text, ";
    public static final String ORGANIZATION_HIERARCHY_SERVICE_ORGANIZATION_NODE_EXTENSION_RULE_REVISION =
            "extension_rule_revision FROM organization.organization_node";
    public static final String ORGANIZATION_HIERARCHY_SERVICE_ORDER_BY = " ORDER BY ";
    public static final String ORGANIZATION_HIERARCHY_SERVICE_UPDATE_ORGANIZATION_NODE_VERSION_UPDATED_AT_EPOCH_MILLIS =
            "UPDATE organization.organization_node SET version=version+1, updated_at_epoch_millis=? WHERE ";
    public static final String ORGANIZATION_HIERARCHY_SERVICE_VERSION_ALTERNATE_B = "id=? AND version=?";
    public static final String ORGANIZATION_HIERARCHY_SERVICE_UPDATE_ORGANIZATION_NODE_STATUS_VERSION =
            "UPDATE organization.organization_node SET status=?, version=version+1, ";
    public static final String ORGANIZATION_HIERARCHY_SERVICE_UPDATE_UPDATED_AT_EPOCH_MILLIS_WORKSPACE_UUID =
            "updated_at_epoch_millis=? WHERE id=? AND workspace_uuid=? ";
    public static final String ORGANIZATION_HIERARCHY_SERVICE_CONDITION_GROUP_WORKSPACE_KEY_VERSION =
            "AND group_workspace_key=? AND version=?";
    public static final String ORGANIZATION_HIERARCHY_SERVICE_UPDATE_ORGANIZATION_NODE_CODE_NAME_NOTES =
            "UPDATE organization.organization_node SET code=?, name=?, notes=?, ";
    public static final String ORGANIZATION_HIERARCHY_SERVICE_EXTENSION_VALUES_EXTENSION_RULE_REVISION =
            "extension_values=CAST(? AS JSONB), extension_rule_revision=?, ";
    public static final String ORGANIZATION_HIERARCHY_SERVICE_VERSION_UPDATED_AT_EPOCH_MILLIS =
            "version=version+1, updated_at_epoch_millis=? WHERE id=? AND ";
    public static final String ORGANIZATION_HIERARCHY_SERVICE_WORKSPACE_UUID = "workspace_uuid=? ";
    public static final String ORGANIZATION_HIERARCHY_SERVICE_CONDITION_GROUP_WORKSPACE_KEY_VERSION_ALTERNATE_A =
            "AND group_workspace_key=? AND version=?";
    public static final String ORGANIZATION_HIERARCHY_SERVICE_UPDATE_ORGANIZATION_NODE_CODE_NAME_NOTES_ALTERNATE_A =
            "UPDATE organization.organization_node SET code=?, name=?, notes=?, ";

    public static final String ORGANIZATION_HIERARCHY_SERVICE_CONDITION_GROUP_WORKSPACE_KEY_VERSION_ALTERNATE_B =
            "AND group_workspace_key=? AND version=?";
    public static final String SELECT_WS_UUID_GRP_WS_ALT_B_003 =
            "SELECT n.id, n.workspace_uuid, n.group_workspace_key, n.parent_id, n.node_type, n.code, n.name,";
    public static final String ORGANIZATION_HIERARCHY_SERVICE_NOTES_STATUS_VERSION_CREATED_AT_EPOCH_MILLIS =
            " n.notes, n.status, n.version, n.created_at_epoch_millis, n.updated_at_epoch_millis,";
    public static final String ORGANIZATION_HIERARCHY_SERVICE_EXTENSION_VALUES_TEXT_EXTENSION_RULE_REVISION_ARRAY_AGG =
            " n.extension_values::text, n.extension_rule_revision, COALESCE(array_agg(p.phase_name";
    public static final String ORGANIZATION_HIERARCHY_SERVICE_ORDER_BY_DISPLAY_ORDER_FILTER_PHASE_NAME_TEXT =
            " ORDER BY p.display_order) FILTER (WHERE p.phase_name IS NOT NULL), ARRAY[]::text[]) AS";
    public static final String ORGANIZATION_HIERARCHY_SERVICE_PHASE_NAMES = " phase_names FROM";
    public static final String ORGANIZATION_HIERARCHY_SERVICE_ALTERNATIVE_PROJECT_PHASE_NAME_ORGANIZATION_NODE =
            " organization.organization_node n LEFT JOIN organization.project_phase_name p ON";
    public static final String ORGANIZATION_HIERARCHY_SERVICE_PROJECT_ID_NODE_TYPE_PROJECT_WORKSPACE_UUID =
            " p.project_id=n.id AND n.node_type='PROJECT' WHERE n.id=? AND n.workspace_uuid=? AND";
    public static final String ORGANIZATION_HIERARCHY_SERVICE_GROUP_WORKSPACE_KEY_WORKSPACE_UUID =
            " n.group_workspace_key=? GROUP BY n.id, n.workspace_uuid, n.group_workspace_key,";
    public static final String ORGANIZATION_HIERARCHY_SERVICE_PARENT_ID = " n.parent_id,";
    public static final String ORGANIZATION_HIERARCHY_SERVICE_NODE_TYPE_CODE_NAME_NOTES_ALTERNATE_B =
            " n.node_type, n.code, n.name, n.notes, n.status, n.version, n.created_at_epoch_millis,";
    public static final String ORGANIZATION_HIERARCHY_SERVICE_UPDATED_AT_EPOCH_MILLIS =
            " n.updated_at_epoch_millis, n.extension_values, n.extension_rule_revision";
    public static final String ORGANIZATION_HIERARCHY_SERVICE_SELECT_ORGANIZATION_NODE_STATUS_WORKSPACE_UUID =
            "SELECT status FROM organization.organization_node WHERE id=? AND workspace_uuid=? AND ";
    public static final String ORGANIZATION_HIERARCHY_SERVICE_GROUP_WORKSPACE_KEY = "group_workspace_key=?";
    public static final String ORGANIZATION_HIERARCHY_SERVICE_CTE_ANCESTRY = "WITH RECURSIVE ancestry AS (";
    public static final String ORGANIZATION_HIERARCHY_SERVICE_SELECT_ORGANIZATION_NODE_PARENT_ID_CODE_NAME_DEPTH =
            "SELECT id, parent_id, code, name, 0 AS depth FROM organization.organization_node WHERE id=? ";
    public static final String ORGANIZATION_HIERARCHY_SERVICE_CONDITION_WORKSPACE_UUID_GROUP_WORKSPACE_KEY =
            "AND workspace_uuid=? AND group_workspace_key=? ";
    public static final String ORGANIZATION_HIERARCHY_SERVICE_UNION_UNION_ALL = "UNION ALL ";
    public static final String ORGANIZATION_HIERARCHY_SERVICE_SELECT_PARENT_PARENT_ID_CODE_NAME =
            "SELECT parent.id, parent.parent_id, parent.code, parent.name, ancestry.depth + 1 ";
    public static final String ORGANIZATION_HIERARCHY_SERVICE_FROM_CLAUSE_ANCESTRY_PARENT_PARENT_ID =
            "FROM organization.organization_node parent JOIN ancestry ON ancestry.parent_id=parent.id ";
    public static final String ORGANIZATION_HIERARCHY_SERVICE_WHERE_PARENT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY =
            "WHERE parent.workspace_uuid=? AND parent.group_workspace_key=?";
    public static final String ORGANIZATION_HIERARCHY_SERVICE_CLOSE_PAREN_ANCESTRY_STRING_AGG_CODE_NAME_DEPTH =
            ") SELECT string_agg(code || ' ' || name, ' / ' ORDER BY depth DESC) FROM ancestry";
    public static final String SELECT_PROJECT_PHASE_NAME_PROJECT_ALT_A_004 =
            "SELECT project_id, phase_name FROM organization.project_phase_name WHERE project_id IN (";
    public static final String ORGANIZATION_HIERARCHY_SERVICE_CTE_ANCESTRY_ALTERNATE_A = "WITH RECURSIVE ancestry AS (";
    public static final String ORGANIZATION_HIERARCHY_SERVICE_SELECT_NODE_TARGET_ID_PARENT_ID_CODE =
            "SELECT node.id AS target_id, node.id, node.parent_id, node.code, node.name, 0 AS depth FROM ";
    public static final String ALT_ORG_NODE_WS_UUID_005 =
            "organization.organization_node node WHERE node.workspace_uuid=? AND node.group_workspace_key=? ";
    public static final String ORGANIZATION_HIERARCHY_SERVICE_CONDITION_NODE = "AND node.id IN (";
    public static final String ORGANIZATION_HIERARCHY_SERVICE_DELETE_PROJECT_PHASE_NAME_PROJECT_ID =
            "DELETE FROM organization.project_phase_name WHERE project_id=?";
    public static final String INSERT_INTO_PROJECT_PHASE_NAME_006 =
            ("INSERT INTO organization.project_phase_name (project_id, phase_name, dis"
                    + "play_order) VALUES (?, ?, ?)");
    public static final String PROJECT_PHASE_ORDER_SUFFIX = ") ORDER BY project_id, display_order";
    public static final String PATH_PARENT_SELECT =
            "UNION ALL SELECT ancestry.target_id, parent.id, parent.parent_id, parent.code, parent.name, ";
    public static final String PATH_PARENT_FROM =
            "ancestry.depth + 1 FROM organization.organization_node parent JOIN ancestry ON ";
    public static final String PATH_PARENT_WHERE =
            "ancestry.parent_id=parent.id WHERE parent.workspace_uuid=? AND parent.group_workspace_key=?";
    public static final String PATH_SELECT_PROJECTION =
            ") SELECT target_id, array_agg(id ORDER BY depth DESC) AS path_ids, array_agg(code ORDER BY depth ";
    public static final String ORGANIZATION_HIERARCHY_PATH_SELECT_PROJECTION_GROUP_BY =
            "DESC) AS path_codes, array_agg(name ORDER BY depth DESC) AS path_names FROM ancestry GROUP BY ";
    public static final String PAGE_ORDER_SUFFIX = ", id DESC LIMIT ? OFFSET ?";
}
