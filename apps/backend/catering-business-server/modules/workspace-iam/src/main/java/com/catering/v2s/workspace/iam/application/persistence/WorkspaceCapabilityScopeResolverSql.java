package com.catering.v2s.workspace.iam.application.persistence;

/**
 * SQL text fragments owned by WorkspaceCapabilityScopeResolver; B3 relocates text only and does not change execution.
 */
public final class WorkspaceCapabilityScopeResolverSql {
    public static final String WORKSPACE_CAPABILITY_SCOPE_RESOLVER_SELECT_ASSIGNMENT_SERVICE_NODE_TYPE_SERVICE_NODE_ID =
            "SELECT assignment.service_node_type, assignment.service_node_id FROM ";
    public static final String WORKSPACE_CAPABILITY_SCOPE_RESOLVER_ROLE_ASSIGNMENT_ASSIGNMENT =
            "workspace_iam.role_assignment assignment ";
    public static final String WORKSPACE_CAPABILITY_SCOPE_RESOLVER_JOIN_WORKSPACE_ROLE_ROLE_ASSIGNMENT_ROLE_ID =
            "JOIN workspace_iam.workspace_role role ON role.id=assignment.role_id ";
    public static final String WORKSPACE_CAPABILITY_SCOPE_RESOLVER_WHERE_ASSIGNMENT_WORKSPACE_UUID =
            "WHERE assignment.id=? AND assignment.workspace_uuid=? ";
    public static final String CONDITION_ASSIGN_GRP_WS_KEY_001 =
            "AND assignment.group_workspace_key=? AND assignment.status='ACTIVE' ";
    public static final String WORKSPACE_CAPABILITY_SCOPE_RESOLVER_CONDITION_ROLE_WORKSPACE_UUID_ASSIGNMENT =
            "AND role.workspace_uuid=assignment.workspace_uuid ";
    public static final String WORKSPACE_CAPABILITY_SCOPE_RESOLVER_CONDITION_ROLE_GROUP_WORKSPACE_KEY_ASSIGNMENT =
            "AND role.group_workspace_key=assignment.group_workspace_key ";
    public static final String WORKSPACE_CAPABILITY_SCOPE_RESOLVER_CONDITION_ROLE_STATUS_ENABLED_JSONB_EXISTS =
            "AND role.status='ENABLED' AND jsonb_exists(role.capability_keys, ?)";
}
