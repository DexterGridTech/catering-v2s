package com.catering.v2s.workspace.iam.application.persistence;

/**
 * SQL text fragments owned by WorkspaceAuditAuthorizationService; B3 relocates text only and does not change execution.
 */
public final class WorkspaceAuditAuthorizationServiceSql {
    public static final String WORKSPACE_AUDIT_AUTHORIZATION_SERVICE_SELECT_TARGET_SERVICE_NODE_TYPE_SERVICE_NODE_ID =
            "SELECT DISTINCT target.service_node_type, target.service_node_id FROM ";
    public static final String WORKSPACE_AUDIT_AUTHORIZATION_SERVICE_ROLE_ASSIGNMENT_TARGET =
            "workspace_iam.role_assignment target ";
    public static final String WORKSPACE_AUDIT_AUTHORIZATION_SERVICE_WHERE_TARGET_ACCOUNT_ID_WORKSPACE_UUID =
            "WHERE target.account_id=? AND target.workspace_uuid=? AND ";
    public static final String WORKSPACE_AUDIT_AUTHORIZATION_SERVICE_TARGET_GROUP_WORKSPACE_KEY =
            "target.group_workspace_key=? ";
    public static final String WORKSPACE_AUDIT_AUTHORIZATION_SERVICE_CONDITION_TARGET_STATUS_ACTIVE =
            "AND target.status='ACTIVE'";
    public static final String
            WORKSPACE_AUDIT_AUTHORIZATION_SERVICE_SELECT_INVITATION_TARGET_SERVICE_NODE_TYPE_SERVICE_NODE_ID =
                    "SELECT target.service_node_type, target.service_node_id FROM workspace_iam.invitation ";
    public static final String WORKSPACE_AUDIT_AUTHORIZATION_SERVICE_INVITATION = "invitation ";
    public static final String WORKSPACE_AUDIT_AUTHORIZATION_SERVICE_JOIN_INVITATION_ASSIGNMENT_INTENT_TARGET =
            "JOIN workspace_iam.invitation_assignment_intent target ON ";
    public static final String WORKSPACE_AUDIT_AUTHORIZATION_SERVICE_TARGET_INVITATION_ID_INVITATION =
            "target.invitation_id=invitation.id ";
    public static final String WORKSPACE_AUDIT_AUTHORIZATION_SERVICE_WHERE_INVITATION_WORKSPACE_UUID =
            "WHERE invitation.id=? AND invitation.workspace_uuid=? AND ";
    public static final String WORKSPACE_AUDIT_AUTHORIZATION_SERVICE_INVITATION_GROUP_WORKSPACE_KEY =
            "invitation.group_workspace_key=?";
    public static final String
            WORKSPACE_AUDIT_AUTHORIZATION_SERVICE_SELECT_ASSIGNMENT_SERVICE_NODE_TYPE_SERVICE_NODE_ID =
                    "SELECT assignment.service_node_type, assignment.service_node_id ";
    public static final String WORKSPACE_AUDIT_AUTHORIZATION_SERVICE_FROM_CLAUSE_ROLE_ASSIGNMENT_ASSIGNMENT =
            "FROM workspace_iam.role_assignment assignment ";
    public static final String WORKSPACE_AUDIT_AUTHORIZATION_SERVICE_JOIN_WORKSPACE_ROLE_ROLE_ASSIGNMENT_ROLE_ID =
            "JOIN workspace_iam.workspace_role role ON role.id=assignment.role_id ";
    public static final String WORKSPACE_AUDIT_AUTHORIZATION_SERVICE_WHERE_ASSIGNMENT_ACCOUNT_ID_WORKSPACE_UUID =
            "WHERE assignment.id=? AND assignment.account_id=? AND assignment.workspace_uuid=? ";
    public static final String
            WORKSPACE_AUDIT_AUTHORIZATION_SERVICE_CONDITION_ASSIGNMENT_GROUP_WORKSPACE_KEY_STATUS_ACTIVE =
                    "AND assignment.group_workspace_key=? AND assignment.status='ACTIVE' ";
    public static final String WORKSPACE_AUDIT_AUTHORIZATION_SERVICE_CONDITION_ROLE_STATUS_ENABLED =
            "AND role.status='ENABLED'";
}
