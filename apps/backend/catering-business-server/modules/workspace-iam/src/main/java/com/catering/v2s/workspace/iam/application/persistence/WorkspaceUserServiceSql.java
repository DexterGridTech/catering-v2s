package com.catering.v2s.workspace.iam.application.persistence;

/** SQL text fragments owned by WorkspaceUserService; B3 relocates text only and does not change execution. */
public final class WorkspaceUserServiceSql {
    public static final String SORT_DIRECTION_ASC = "ASC";
    public static final String SORT_DIRECTION_DESC = "DESC";
    public static final String DISPLAY_NAME_ORDER = "a.display_name";
    public static final String LOGIN_NAME_ORDER = "a.login_name_normalized";
    public static final String LAST_LOGIN_ORDER = "COALESCE(login.last_login_at, -1)";
    public static final String UPDATED_AT_ORDER = "a.updated_at_epoch_millis";
    public static final String PARAMETER_PLACEHOLDER = "?";
    public static final String PLACEHOLDER_SEPARATOR = ",";
    public static final String SQL_CLOSE_PAREN = ")";
    public static final String SQL_SPACE = " ";
    public static final String WORKSPACE_USER_SERVICE_SELECT_SELECT_COUNT = "SELECT COUNT(*)";
    public static final String WORKSPACE_USER_SERVICE_SELECT_SELECT_A_ID = "SELECT a.id";
    public static final String WORKSPACE_USER_SERVICE_ORDER_BY = " ORDER BY ";
    public static final String WORKSPACE_USER_SERVICE_FROM_CLAUSE_WORKSPACE_ACCOUNT_ACCOUNT_ID =
            " FROM workspace_iam.workspace_account a LEFT JOIN (SELECT account_id, ";
    public static final String WORKSPACE_USER_SERVICE_AUTHENTICATED_AT_EPOCH_MILLIS_LAST_LOGIN_AT =
            "MAX(authenticated_at_epoch_millis) AS last_login_at FROM ";
    public static final String WORKSPACE_USER_SERVICE_WORKSPACE_AUTHENTICATION_HISTORY =
            "workspace_iam.workspace_authentication_history WHERE workspace_uuid=? AND group_workspace_key=? ";
    public static final String WORKSPACE_USER_SERVICE_GROUP_BY_ACCOUNT_ID_LOGIN =
            "GROUP BY account_id) login ON login.account_id=a.id";
    public static final String WORKSPACE_USER_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_TEXT_DISPLAY_NAME =
            " WHERE a.workspace_uuid=? AND a.group_workspace_key=? AND (CAST(? AS text) IS NULL OR a.display_name ";
    public static final String WORKSPACE_USER_SERVICE_ILIKE_TEXT_MOBILE_NORMALIZED =
            "ILIKE '%' || ? || '%') AND (CAST(? AS text) IS NULL OR a.mobile_normalized ILIKE '%' || ? ";
    public static final String WORKSPACE_USER_SERVICE_SQL_PUNCTUATION = "|| ";
    public static final String WORKSPACE_USER_SERVICE_TEXT_LOGIN_NAME_NORMALIZED_ILIKE =
            "'%') AND (CAST(? AS text) IS NULL OR a.login_name_normalized ILIKE '%' || ? || '%') AND ";
    public static final String WORKSPACE_USER_SERVICE_OPEN_PAREN = "(CAST(? ";
    public static final String WORKSPACE_USER_SERVICE_TEXT_STATUS =
            "AS text) IS NULL OR a.status=?) AND ((CAST(? AS text) IS NULL AND CAST(? AS uuid) IS NULL ";
    public static final String WORKSPACE_USER_SERVICE_CONDITION = "AND ";
    public static final String WORKSPACE_USER_SERVICE_ROLE_ASSIGNMENT_ASSIGNMENT =
            "CAST(? AS uuid) IS NULL) OR EXISTS (SELECT 1 FROM workspace_iam.role_assignment assignment ";
    public static final String WORKSPACE_USER_SERVICE_WHERE_ASSIGNMENT_ACCOUNT_ID_WORKSPACE_UUID =
            "WHERE assignment.account_id=a.id AND assignment.workspace_uuid=a.workspace_uuid AND ";
    public static final String WORKSPACE_USER_SERVICE_ASSIGNMENT_GROUP_WORKSPACE_KEY_TEXT =
            "assignment.group_workspace_key=a.group_workspace_key AND (CAST(? AS text) IS NULL OR ";
    public static final String WORKSPACE_USER_SERVICE_ASSIGNMENT_SERVICE_NODE_TYPE =
            "assignment.service_node_type=?) AND (CAST(? AS uuid) IS NULL OR ";
    public static final String WORKSPACE_USER_SERVICE_ASSIGNMENT_SERVICE_NODE_ID = "assignment.service_node_id=?) ";
    public static final String WORKSPACE_USER_SERVICE_CONDITION_ASSIGNMENT_ROLE_ID =
            "AND (CAST(? AS uuid) IS NULL OR assignment.role_id=?)))";
    public static final String WORKSPACE_USER_SERVICE_SET = "SET";
    public static final String SELECT_DISP_NAME_MOBILE_NORMALIZED_001 =
            "SELECT id, display_name, mobile_normalized, login_name_normalized, status, version, ";
    public static final String WORKSPACE_USER_SERVICE_WORKSPACE_ACCOUNT =
            "created_at_epoch_millis, updated_at_epoch_millis FROM workspace_iam.workspace_account WHERE ";
    public static final String WORKSPACE_USER_SERVICE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY =
            "workspace_uuid=? AND group_workspace_key=? AND id IN (";
    public static final String WORKSPACE_USER_SERVICE_SELECT_ACCOUNT_ID_ROLE_ID_ROLE_NAME =
            "SELECT r.id, r.account_id, r.role_id, role.name, r.service_node_type, r.service_node_id, r.status, ";
    public static final String WORKSPACE_USER_SERVICE_SOURCE_INVITATION_ID =
            "r.source_invitation_id, r.version, r.created_at_epoch_millis, r.updated_at_epoch_millis ";
    public static final String WORKSPACE_USER_SERVICE_FROM_CLAUSE = "FROM ";
    public static final String WORKSPACE_USER_SERVICE_WORKSPACE_ROLE_ROLE_ASSIGNMENT_ROLE_ROLE_ID =
            "workspace_iam.role_assignment r JOIN workspace_iam.workspace_role role ON role.id=r.role_id ";
    public static final String WORKSPACE_USER_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_ACCOUNT_ID =
            "WHERE r.workspace_uuid=? AND r.group_workspace_key=? AND r.account_id IN (";
    public static final String WORKSPACE_USER_SERVICE_SELECT_ACCOUNT_ID_AUTHENTICATED_AT_EPOCH_MILLIS =
            "SELECT account_id, MAX(authenticated_at_epoch_millis) FROM ";
    public static final String WORKSPACE_USER_SERVICE_WORKSPACE_AUTHENTICATION_HISTORY_WORKSPACE_UUID =
            "workspace_iam.workspace_authentication_history WHERE workspace_uuid=? AND ";
    public static final String WORKSPACE_USER_SERVICE_GROUP_WORKSPACE_KEY = "group_workspace_key=? ";
    public static final String WORKSPACE_USER_SERVICE_CONDITION_ACCOUNT_ID = "AND account_id IN (";
    public static final String WORKSPACE_USER_SERVICE_SELECT_ACCOUNT_ID_AUTHENTICATED_AT_EPOCH_MILLIS_ALTERNATE_A =
            "SELECT account_id, id, authenticated_at_epoch_millis FROM (SELECT account_id, id, ";
    public static final String WORKSPACE_USER_SERVICE_AUTHENTICATED_AT_EPOCH_MILLIS_ACCOUNT_ID =
            "authenticated_at_epoch_millis, ROW_NUMBER() OVER (PARTITION BY account_id ORDER BY ";
    public static final String WORKSPACE_USER_SERVICE_AUTHENTICATED_AT_EPOCH_MILLIS =
            "authenticated_at_epoch_millis DESC, id DESC) AS row_number FROM ";
    public static final String WORKSPACE_USER_SERVICE_WORKSPACE_AUTHENTICATION_HISTORY_ALTERNATE_A =
            "workspace_iam.workspace_authentication_history WHERE workspace_uuid=? AND group_workspace_key=? ";
    public static final String WORKSPACE_USER_SERVICE_CONDITION_ACCOUNT_ID_ALTERNATE_A = "AND account_id IN (";
    public static final String SELECT_INVITE_MOBILE_NORMALIZED_STATUS_002 =
            ("SELECT mobile_normalized, id, status, version, expires_at_epoch_millis F"
                    + "ROM workspace_iam.invitation ");
    public static final String WORKSPACE_USER_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_MOBILE_NORMALIZED =
            "WHERE workspace_uuid=? AND group_workspace_key=? AND mobile_normalized IN (";
    public static final String WORKSPACE_USER_SERVICE_SELECT_WORKSPACE_CREDENTIAL_ACCOUNT_ID_PASSWORD_CHANGE_REQUIRED =
            "SELECT account_id FROM workspace_iam.workspace_credential WHERE password_change_required=TRUE AND ";
    public static final String WORKSPACE_USER_SERVICE_ACCOUNT_ID = "account_id IN (";
    public static final String WORKSPACE_USER_SERVICE_SELECT_INVITATION_ID_SERVICE_NODE_TYPE_SERVICE_NODE_ID =
            "SELECT invitation_id, service_node_type, service_node_id FROM ";
    public static final String WORKSPACE_USER_SERVICE_INVITATION_ASSIGNMENT_INTENT_INVITATION_ID =
            "workspace_iam.invitation_assignment_intent WHERE invitation_id IN (";
    public static final String ACCOUNT_PAGE_ORDER_SUFFIX = ", a.id ASC LIMIT ? OFFSET ?";
    public static final String ASSIGNMENT_ORDER_SUFFIX = ") ORDER BY r.created_at_epoch_millis";
    public static final String LATEST_AUTHENTICATION_ORDER_SUFFIX = ") GROUP BY account_id";
    public static final String AUTHENTICATION_HISTORY_ORDER_SUFFIX =
            ")) ranked WHERE row_number<=10 ORDER BY account_id, authenticated_at_epoch_millis DESC, id DESC";
    public static final String INVITATION_ORDER_SUFFIX = ") ORDER BY expires_at_epoch_millis DESC";
}
