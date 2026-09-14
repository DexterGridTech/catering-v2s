package com.catering.v2s.workspace.iam.application.persistence;

/** SQL text fragments owned by WorkspaceCommandAuthorizationService; B3 relocates text only and does not change execution. */
public final class WorkspaceCommandAuthorizationServiceSql {
    public static final String WORKSPACE_COMMAND_AUTHORIZATION_SERVICE_SELECT_ROLE_ASSIGNMENT_ASSIGNMENT = "SELECT EXISTS(SELECT 1 FROM workspace_iam.role_assignment assignment ";
    public static final String WORKSPACE_COMMAND_AUTHORIZATION_SERVICE_JOIN_WORKSPACE_ROLE_ROLE_ASSIGNMENT_ROLE_ID = "JOIN workspace_iam.workspace_role role ON role.id=assignment.role_id ";
    public static final String WORKSPACE_COMMAND_AUTHORIZATION_SERVICE_WHERE_ASSIGNMENT_WORKSPACE_UUID = "WHERE assignment.id=? AND assignment.workspace_uuid=? ";
    public static final String WORKSPACE_COMMAND_AUTHORIZATION_SERVICE_CONDITION_ASSIGNMENT_GROUP_WORKSPACE_KEY_STATUS_ACTIVE = "AND assignment.group_workspace_key=? AND assignment.status='ACTIVE' ";
    public static final String WORKSPACE_COMMAND_AUTHORIZATION_SERVICE_CONDITION_ROLE_WORKSPACE_UUID_ASSIGNMENT = "AND role.workspace_uuid=assignment.workspace_uuid ";
    public static final String WORKSPACE_COMMAND_AUTHORIZATION_SERVICE_CONDITION_ROLE_GROUP_WORKSPACE_KEY_ASSIGNMENT = "AND role.group_workspace_key=assignment.group_workspace_key ";
    public static final String WORKSPACE_COMMAND_AUTHORIZATION_SERVICE_CONDITION_ROLE_STATUS_ENABLED_JSONB_EXISTS = "AND role.status='ENABLED' AND jsonb_exists(role.capability_keys, ?))";
}
