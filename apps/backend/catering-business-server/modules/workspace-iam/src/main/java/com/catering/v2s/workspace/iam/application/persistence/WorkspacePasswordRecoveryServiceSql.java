package com.catering.v2s.workspace.iam.application.persistence;

/** SQL text fragments owned by WorkspacePasswordRecoveryService; B3 relocates text only and does not change execution. */
public final class WorkspacePasswordRecoveryServiceSql {
    public static final String WORKSPACE_PASSWORD_RECOVERY_SERVICE_UPDATE_OPERATIONS_PASSWORD_RECOVERY_STATUS_SUPERSEDED_VERSION = "UPDATE workspace_iam.operations_password_recovery SET status='SUPERSEDED', version=version+1 ";
    public static final String WORKSPACE_PASSWORD_RECOVERY_SERVICE_WHERE_ACCOUNT_ID_STATUS_PENDING_OTP_VERIFIED = "WHERE account_id=? AND status IN ('PENDING','OTP_VERIFIED')";
    public static final String WORKSPACE_PASSWORD_RECOVERY_SERVICE_INSERT_INTO_OPERATIONS_PASSWORD_RECOVERY = "INSERT INTO workspace_iam.operations_password_recovery (id, workspace_uuid, group_workspace_key, ";
    public static final String WORKSPACE_PASSWORD_RECOVERY_SERVICE_ACCOUNT_ID = "account_id, flow_token_hash, status, expires_at_epoch_millis, version, ";
    public static final String WORKSPACE_PASSWORD_RECOVERY_SERVICE_CREATED_AT_EPOCH_MILLIS = "created_at_epoch_millis) ";
    public static final String WORKSPACE_PASSWORD_RECOVERY_SERVICE_VALUES_PENDING = "VALUES (?, ?, ?, ?, ?, 'PENDING', ?, 1, ?)";
    public static final String WORKSPACE_PASSWORD_RECOVERY_SERVICE_UPDATE_OTP_GRANT_STATUS_SUPERSEDED_SUBJECT_REF = "UPDATE workspace_iam.otp_grant SET status='SUPERSEDED' WHERE subject_ref=? AND ";
    public static final String WORKSPACE_PASSWORD_RECOVERY_SERVICE_PURPOSE_OPERATIONS_PASSWORD_RECOVERY_STATUS_ACTIVE = "purpose='OPERATIONS_PASSWORD_RECOVERY' AND status='ACTIVE'";
    public static final String WORKSPACE_PASSWORD_RECOVERY_SERVICE_INSERT_INTO_OTP_GRANT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_PURPOSE = "INSERT INTO workspace_iam.otp_grant (id, workspace_uuid, group_workspace_key, purpose, ";
    public static final String WORKSPACE_PASSWORD_RECOVERY_SERVICE_TOKEN_HASH = "token_hash, subject_ref, status, expires_at_epoch_millis) VALUES (?, ?, ?, ";
    public static final String WORKSPACE_PASSWORD_RECOVERY_SERVICE_OPERATIONS_PASSWORD_RECOVERY_ACTIVE = "'OPERATIONS_PASSWORD_RECOVERY', ?, ?, 'ACTIVE', ?)";
    public static final String WORKSPACE_PASSWORD_RECOVERY_SERVICE_UPDATE_OTP_GRANT_STATUS_USED_USED_AT_EPOCH_MILLIS_SUBJECT_REF = "UPDATE workspace_iam.otp_grant SET status='USED', used_at_epoch_millis=? WHERE subject_ref=? AND ";
    public static final String WORKSPACE_PASSWORD_RECOVERY_SERVICE_PURPOSE = "purpose='OPERATIONS_PASSWORD_RECOVERY' AND token_hash=? AND status='ACTIVE' AND ";
    public static final String WORKSPACE_PASSWORD_RECOVERY_SERVICE_EXPIRES_AT_EPOCH_MILLIS = "expires_at_epoch_millis>?";
    public static final String WORKSPACE_PASSWORD_RECOVERY_SERVICE_UPDATE_OTP_GRANT_ATTEMPT_COUNT_SUBJECT_REF = "UPDATE workspace_iam.otp_grant SET attempt_count=attempt_count+1 WHERE subject_ref=? AND ";
    public static final String WORKSPACE_PASSWORD_RECOVERY_SERVICE_PURPOSE_OPERATIONS_PASSWORD_RECOVERY_STATUS_ACTIVE_ALTERNATE_A = "purpose='OPERATIONS_PASSWORD_RECOVERY' AND status='ACTIVE'";
    public static final String WORKSPACE_PASSWORD_RECOVERY_SERVICE_UPDATE_OPERATIONS_PASSWORD_RECOVERY_STATUS_OTP_VERIFIED = "UPDATE workspace_iam.operations_password_recovery SET status='OTP_VERIFIED', ";
    public static final String WORKSPACE_PASSWORD_RECOVERY_SERVICE_COMPLETION_GRANT_HASH = "completion_grant_hash=?, completion_grant_expires_at_epoch_millis=?, ";
    public static final String WORKSPACE_PASSWORD_RECOVERY_SERVICE_VERSION = "version=version+1 ";
    public static final String WORKSPACE_PASSWORD_RECOVERY_SERVICE_WHERE_STATUS_PENDING_VERSION = "WHERE id=? AND status='PENDING' AND version=?";
    public static final String WORKSPACE_PASSWORD_RECOVERY_SERVICE_UPDATE_WORKSPACE_CREDENTIAL = "UPDATE workspace_iam.workspace_credential SET password_hash=?, changed_at_epoch_millis=?, ";
    public static final String WORKSPACE_PASSWORD_RECOVERY_SERVICE_FAILED_ATTEMPTS = "failed_attempts=0, locked_until_epoch_millis=NULL, password_change_required=FALSE, ";
    public static final String WORKSPACE_PASSWORD_RECOVERY_SERVICE_VERSION_ACCOUNT_ID = "version=version+1 WHERE account_id=?";
    public static final String WORKSPACE_PASSWORD_RECOVERY_SERVICE_UPDATE_WORKSPACE_SESSION_STATUS_REVOKED_REVOKED_AT_EPOCH_MILLIS = "UPDATE workspace_iam.workspace_session SET status='REVOKED', revoked_at_epoch_millis=? WHERE ";
    public static final String WORKSPACE_PASSWORD_RECOVERY_SERVICE_ACCOUNT_ID_STATUS_ACTIVE = "account_id=? AND status='ACTIVE'";
    public static final String WORKSPACE_PASSWORD_RECOVERY_SERVICE_UPDATE_OPERATIONS_PASSWORD_RECOVERY_STATUS_COMPLETED = "UPDATE workspace_iam.operations_password_recovery SET status='COMPLETED', ";
    public static final String WORKSPACE_PASSWORD_RECOVERY_SERVICE_COMPLETION_GRANT_HASH_ALTERNATE_A = "completion_grant_hash=NULL, completion_grant_expires_at_epoch_millis=NULL, ";
    public static final String WORKSPACE_PASSWORD_RECOVERY_SERVICE_COMPLETED_AT_EPOCH_MILLIS = "completed_at_epoch_millis=?, version=version+1 WHERE id=? AND status='OTP_VERIFIED' ";
    public static final String WORKSPACE_PASSWORD_RECOVERY_SERVICE_CONDITION = "AND ";
    public static final String WORKSPACE_PASSWORD_RECOVERY_SERVICE_VERSION_ALTERNATE_A = "version=?";
    public static final String WORKSPACE_PASSWORD_RECOVERY_SERVICE_SELECT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_ACCOUNT_ID_STATUS = "SELECT id, workspace_uuid, group_workspace_key, account_id, status, expires_at_epoch_millis, version, ";
    public static final String WORKSPACE_PASSWORD_RECOVERY_SERVICE_COMPLETION_GRANT_HASH_ALTERNATE_B = "completion_grant_hash, completion_grant_expires_at_epoch_millis FROM ";
    public static final String WORKSPACE_PASSWORD_RECOVERY_SERVICE_OPERATIONS_PASSWORD_RECOVERY_FLOW_TOKEN_HASH = "workspace_iam.operations_password_recovery WHERE flow_token_hash=?";
    public static final String WORKSPACE_PASSWORD_RECOVERY_SERVICE_SELECT_WORKSPACE_ACCOUNT = "SELECT id, workspace_uuid, group_workspace_key, status FROM workspace_iam.workspace_account WHERE ";
    public static final String WORKSPACE_PASSWORD_RECOVERY_SERVICE_WORKSPACE_UUID = "workspace_uuid=? AND group_workspace_key=? AND login_name_normalized=? AND ";
    public static final String WORKSPACE_PASSWORD_RECOVERY_SERVICE_MOBILE_NORMALIZED = "mobile_normalized=? ";
    public static final String WORKSPACE_PASSWORD_RECOVERY_SERVICE_CONDITION_STATUS_ENABLED = "AND status='ENABLED'";
    public static final String WORKSPACE_PASSWORD_RECOVERY_SERVICE_SELECT_WORKSPACE_ACCOUNT_ALTERNATE_A = "SELECT id, workspace_uuid, group_workspace_key, status FROM workspace_iam.workspace_account WHERE ";
    public static final String WORKSPACE_PASSWORD_RECOVERY_SERVICE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_STATUS_ENABLED = "id=? AND workspace_uuid=? AND group_workspace_key=? AND status='ENABLED'";
}
