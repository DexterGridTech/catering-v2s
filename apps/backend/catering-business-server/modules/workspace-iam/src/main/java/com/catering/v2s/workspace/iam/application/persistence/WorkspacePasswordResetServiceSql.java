package com.catering.v2s.workspace.iam.application.persistence;

/** SQL text fragments owned by WorkspacePasswordResetService; B3 relocates text only and does not change execution. */
public final class WorkspacePasswordResetServiceSql {
    public static final String WORKSPACE_PASSWORD_RESET_SERVICE_SELECT_WORKSPACE_ACCOUNT_LOGIN_NAME_NORMALIZED_STATUS_VERSION = "SELECT id, login_name_normalized, status, version FROM workspace_iam.workspace_account WHERE id=? AND ";
    public static final String WORKSPACE_PASSWORD_RESET_SERVICE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY = "workspace_uuid=? AND group_workspace_key=?";
    public static final String WORKSPACE_PASSWORD_RESET_SERVICE_UPDATE_WORKSPACE_ACCOUNT_VERSION_UPDATED_AT_EPOCH_MILLIS = "UPDATE workspace_iam.workspace_account SET version=version+1, updated_at_epoch_millis=? WHERE ";
    public static final String WORKSPACE_PASSWORD_RESET_SERVICE_VERSION = "id=? AND version=?";
    public static final String WORKSPACE_PASSWORD_RESET_SERVICE_UPDATE_WORKSPACE_CREDENTIAL_PASSWORD_HASH_CHANGED_AT_EPOCH_MILLIS = "UPDATE workspace_iam.workspace_credential SET password_hash=?, changed_at_epoch_millis=?, ";
    public static final String WORKSPACE_PASSWORD_RESET_SERVICE_FAILED_ATTEMPTS = "failed_attempts=0, locked_until_epoch_millis=NULL, password_change_required=TRUE, ";
    public static final String WORKSPACE_PASSWORD_RESET_SERVICE_VERSION_ACCOUNT_ID = "version=version+1 WHERE account_id=?";
    public static final String WORKSPACE_PASSWORD_RESET_SERVICE_UPDATE_WORKSPACE_SESSION_STATUS_REVOKED_REVOKED_AT_EPOCH_MILLIS = "UPDATE workspace_iam.workspace_session SET status='REVOKED', revoked_at_epoch_millis=? WHERE ";
    public static final String WORKSPACE_PASSWORD_RESET_SERVICE_ACCOUNT_ID_STATUS_ACTIVE = "account_id=? AND status='ACTIVE'";
    public static final String WORKSPACE_PASSWORD_RESET_SERVICE_INSERT_INTO_AUDIT_EVENT = "INSERT INTO workspace_iam.audit_event (id, workspace_uuid, group_workspace_key, entity_type, ";
    public static final String WORKSPACE_PASSWORD_RESET_SERVICE_ENTITY_REF_TEXT = "entity_ref_text, actor_type, actor_id, actor_display_snapshot, action, ";
    public static final String WORKSPACE_PASSWORD_RESET_SERVICE_OCCURRED_AT_EPOCH_MILLIS = "occurred_at_epoch_millis, changes_json) VALUES (?, ?, ?, 'WORKSPACE_ACCOUNT', ?, ?, ?, ?, ";
    public static final String WORKSPACE_PASSWORD_RESET_SERVICE_WORKSPACE_ACCOUNT_CREDENTIAL_RESET = "'WORKSPACE_ACCOUNT_CREDENTIAL_RESET', ?, CAST(? AS JSONB))";
}
