package com.catering.v2s.organization.application.persistence;

/** SQL text fragments owned by OrganizationVisibilityService; B3 relocates text only and does not change execution. */
public final class OrganizationVisibilityServiceSql {
    public static final String ORGANIZATION_VISIBILITY_SERVICE_SELECT_ORGANIZATION_NODE_WORKSPACE_UUID = "SELECT EXISTS(SELECT 1 FROM organization.organization_node WHERE id=? AND workspace_uuid=? AND ";
    public static final String ORGANIZATION_VISIBILITY_SERVICE_STORE_GROUP_WORKSPACE_KEY_STATUS_ENABLED = "group_workspace_key=? AND status='ENABLED') OR EXISTS(SELECT 1 FROM organization.store ";
    public static final String ORGANIZATION_VISIBILITY_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_STATUS_ENABLED = "WHERE id=? AND workspace_uuid=? AND group_workspace_key=? AND status='ENABLED')";
    public static final String ORGANIZATION_VISIBILITY_SERVICE_SELECT_STORE_PROJECT_ID_WORKSPACE_UUID = "SELECT EXISTS(SELECT 1 FROM organization.store WHERE id=? AND project_id=? AND workspace_uuid=? ";
    public static final String ORGANIZATION_VISIBILITY_SERVICE_CONDITION_GROUP_WORKSPACE_KEY_STATUS_ENABLED = "AND group_workspace_key=? AND status='ENABLED')";
    public static final String ORGANIZATION_VISIBILITY_SERVICE_SELECT_STORE_PROJECT_ID_WORKSPACE_UUID_ALTERNATE_A = "SELECT COALESCE((SELECT project_id FROM organization.store WHERE id=? AND workspace_uuid=? AND ";
    public static final String ORGANIZATION_VISIBILITY_SERVICE_GROUP_WORKSPACE_KEY_NODE_ID = "group_workspace_key=?), ?) AS node_id";
    public static final String ORGANIZATION_VISIBILITY_SERVICE_CTE_ORGANIZATION_NODE_ANCESTRY_PARENT_ID = "WITH RECURSIVE ancestry AS (SELECT id, parent_id FROM organization.organization_node WHERE id=? AND ";
    public static final String ORGANIZATION_VISIBILITY_SERVICE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_PARENT_PARENT_ID = "workspace_uuid=? AND group_workspace_key=? UNION ALL SELECT parent.id, parent.parent_id ";
    public static final String ORGANIZATION_VISIBILITY_SERVICE_FROM_CLAUSE = "FROM ";
    public static final String ORGANIZATION_VISIBILITY_SERVICE_ALTERNATIVE_ANCESTRY_ORGANIZATION_NODE_PARENT_CHILD_PARENT_ID = "organization.organization_node parent JOIN ancestry child ON child.parent_id=parent.id) ";
    public static final String ORGANIZATION_VISIBILITY_SERVICE_SELECT = "SELECT ";
    public static final String ORGANIZATION_VISIBILITY_SERVICE_ANCESTRY_EXISTS_SELECT_1_FROM_ANCESTR = "EXISTS(SELECT 1 FROM ancestry WHERE id=?)";
    public static final String ORGANIZATION_VISIBILITY_SERVICE_SELECT_ORGANIZATION_NODE_NODE_TYPE_CODE_NAME_PARENT_ID = "SELECT id, node_type, code, name, parent_id, status FROM organization.organization_node WHERE ";
    public static final String ORGANIZATION_VISIBILITY_SERVICE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_NODE_TYPE_CODE = "workspace_uuid=? AND group_workspace_key=? ORDER BY node_type, code";
    public static final String ORGANIZATION_VISIBILITY_SERVICE_SELECT_STORE_CODE_NAME_PROJECT_ID_HEAD_COMPANY_ID = "SELECT id, code, name, project_id, head_company_id, status FROM organization.store WHERE ";
    public static final String ORGANIZATION_VISIBILITY_SERVICE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_CODE = "workspace_uuid=? AND group_workspace_key=? ORDER BY code";
    public static final String ORGANIZATION_VISIBILITY_SERVICE_SELECT_HEAD_COMPANY_CODE_NAME_WORKSPACE_UUID = "SELECT id, code, name FROM organization.head_company WHERE workspace_uuid=? AND ";
    public static final String ORGANIZATION_VISIBILITY_SERVICE_GROUP_WORKSPACE_KEY_STATUS_ENABLED_CODE = "group_workspace_key=? AND status='ENABLED' ORDER BY code";
    public static final String ORGANIZATION_VISIBILITY_SERVICE_SELECT_ORGANIZATION_NODE_NODE_TYPE_CODE_NAME_PARENT_ID_ALTERNATE_A = "SELECT id, node_type, code, name, parent_id, status FROM organization.organization_node WHERE ";
    public static final String ORGANIZATION_VISIBILITY_SERVICE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY = "workspace_uuid=? AND group_workspace_key=?";
}
