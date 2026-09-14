package com.catering.v2s.workspace.iam.application.persistence;

/** SQL text fragments owned by WorkspaceAssignmentScopeService; B3 relocates text only and does not change execution. */
public final class WorkspaceAssignmentScopeServiceSql {
    public static final String WORKSPACE_ASSIGNMENT_SCOPE_SERVICE_SELECT_ROLE_ASSIGNMENT_SERVICE_NODE_TYPE_SERVICE_NODE_ID = "SELECT service_node_type, service_node_id FROM workspace_iam.role_assignment WHERE id=? AND ";
    public static final String WORKSPACE_ASSIGNMENT_SCOPE_SERVICE_CONTINUATION_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_STATUS_ACTIVE = "workspace_uuid=? AND group_workspace_key=? AND status='ACTIVE'";
}
