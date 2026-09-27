package com.catering.v2s.workspace.iam.application.persistence;

/** SQL text fragments owned by WorkspaceAccountService; B3 relocates text only and does not change execution. */
public final class WorkspaceAccountServiceSql {
    public static final String WORKSPACE_ACCOUNT_SERVICE_SELECT_WORKSPACE_UUID =
            "SELECT id, workspace_uuid, group_workspace_key, mobile_normalized, login_name_normalized, ";
    public static final String WORKSPACE_ACCOUNT_SERVICE_WORKSPACE_ACCOUNT_DISPLAY_NAME_STATUS_VERSION =
            "display_name, status, version FROM workspace_iam.workspace_account WHERE id=? AND ";
    public static final String WORKSPACE_ACCOUNT_SERVICE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY =
            "workspace_uuid=? AND group_workspace_key=?";
    public static final String WORKSPACE_ACCOUNT_SERVICE_CTE_WORKSPACE_ACCOUNT_CURRENT_STATUS =
            "WITH current AS (SELECT id, status FROM workspace_iam.workspace_account WHERE id=? AND ";
    public static final String WORKSPACE_ACCOUNT_SERVICE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_UPDATED =
            "workspace_uuid=? AND group_workspace_key=? FOR UPDATE), updated AS (UPDATE ";
    public static final String WORKSPACE_ACCOUNT_SERVICE_WORKSPACE_ACCOUNT_STATUS_VERSION =
            "workspace_iam.workspace_account SET status=?, version=version+1, ";
    public static final String UPDATE_UPDATED_AT_EPOCH_MS_001 =
            "updated_at_epoch_millis=? WHERE id=? AND workspace_uuid=? AND group_workspace_key=? ";
    public static final String WORKSPACE_ACCOUNT_SERVICE_CONDITION_VERSION_STATUS_VOIDED_WORKSPACE_UUID =
            "AND version=? AND status <> 'VOIDED' RETURNING id, workspace_uuid, ";
    public static final String WORKSPACE_ACCOUNT_SERVICE_GROUP_WORKSPACE_KEY_MOBILE_NORMALIZED =
            "group_workspace_key, mobile_normalized, ";
    public static final String WORKSPACE_ACCOUNT_SERVICE_LOGIN_NAME_NORMALIZED_DISPLAY_NAME_STATUS_VERSION =
            "login_name_normalized, display_name, status, version) SELECT updated.*, current.status ";
    public static final String WORKSPACE_ACCOUNT_SERVICE_CURRENT_PREVIOUS_STATUS_EXISTING_ID_SENTINEL =
            "AS previous_status, current.id AS existing_id FROM (SELECT 1) sentinel LEFT JOIN current ";
    public static final String WORKSPACE_ACCOUNT_SERVICE_JOIN_CONDITION_UPDATED_ON_TRUE_LEFT_JOIN_UPDATED_ON =
            "ON true LEFT JOIN updated ON true";
    public static final String UPDATE_WS_SESSION_STATUS_REVOKED_002 =
            "UPDATE workspace_iam.workspace_session SET status='REVOKED', revoked_at_epoch_millis=? WHERE ";
    public static final String WORKSPACE_ACCOUNT_SERVICE_ACCOUNT_ID_STATUS_ACTIVE = "account_id=? AND status='ACTIVE'";
    public static final String WORKSPACE_ACCOUNT_SERVICE_UPDATE_ROLE_ASSIGNMENT_STATUS_REVOKED_VERSION =
            "UPDATE workspace_iam.role_assignment SET status='REVOKED', version=version+1, ";
    public static final String WORKSPACE_ACCOUNT_SERVICE_UPDATE_UPDATED_AT_EPOCH_MILLIS_ACCOUNT_ID_WORKSPACE_UUID =
            "updated_at_epoch_millis=? WHERE id=? AND account_id=? AND workspace_uuid=? ";
    public static final String WORKSPACE_ACCOUNT_SERVICE_CONDITION_GROUP_WORKSPACE_KEY_STATUS_ACTIVE_VERSION =
            "AND group_workspace_key=? AND status='ACTIVE' AND version=? RETURNING service_node_type";
    public static final String UPDATE_WS_SESSION_STATUS_REVOKED_ALT_A_003 =
            "UPDATE workspace_iam.workspace_session SET status='REVOKED', revoked_at_epoch_millis=? WHERE ";
    public static final String WORKSPACE_ACCOUNT_SERVICE_ACCOUNT_ID_CURRENT_ASSIGNMENT_ID_STATUS_ACTIVE =
            "account_id=? AND current_assignment_id=? AND status='ACTIVE'";
    public static final String WORKSPACE_ACCOUNT_SERVICE_SELECT_ROLE_ASSIGNMENT_ACCOUNT_ID_WORKSPACE_UUID =
            "SELECT account_id FROM workspace_iam.role_assignment WHERE id=? AND workspace_uuid=? AND ";
    public static final String WORKSPACE_ACCOUNT_SERVICE_GROUP_WORKSPACE_KEY = "group_workspace_key=?";
    public static final String SELECT_ROLE_ASSIGN_ACCOUNT_ID_004 =
            ("SELECT account_id, service_node_type, service_node_id FROM workspace_iam"
                    + ".role_assignment WHERE id=? ");
    public static final String WORKSPACE_ACCOUNT_SERVICE_CONDITION_WORKSPACE_UUID_GROUP_WORKSPACE_KEY =
            "AND workspace_uuid=? AND group_workspace_key=?";
    public static final String INSERT_INTO_AUDIT_EVENT_WS_005 =
            "INSERT INTO workspace_iam.audit_event (id, workspace_uuid, group_workspace_key, entity_type, ";
    public static final String WORKSPACE_ACCOUNT_SERVICE_ENTITY_REF_TEXT_ACTOR_TYPE_ACTOR_ID_ACTOR_DISPLAY_SNAPSHOT =
            "entity_ref_text, actor_type, actor_id, actor_display_snapshot, action, ";
    public static final String WORKSPACE_ACCOUNT_SERVICE_OCCURRED_AT_EPOCH_MILLIS_CHANGES_JSON_WORKSPACE_ACCOUNT =
            "occurred_at_epoch_millis, changes_json) VALUES (?, ?, ?, 'WORKSPACE_ACCOUNT', ?, ?, ?, ?, ";
    public static final String WORKSPACE_ACCOUNT_SERVICE_PARAMETER_PLACEHOLDER = "?, ?, ";
    public static final String WORKSPACE_ACCOUNT_SERVICE_CAST_AS_JSONB = "CAST(? AS JSONB))";
}
