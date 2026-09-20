package com.catering.v2s.workspace.iam.application.persistence;

/** SQL text fragments owned by WorkspaceOtpRateLimitService; B3 relocates text only and does not change execution. */
public final class WorkspaceOtpRateLimitServiceSql {
    public static final String WORKSPACE_OTP_RATE_LIMIT_SERVICE_DELETE_OTP_RATE_LIMIT_BUCKET_WORKSPACE_UUID_GROUP_WORKSPACE_KEY = "DELETE FROM workspace_iam.otp_rate_limit_bucket WHERE workspace_uuid=? AND group_workspace_key=? AND ";
    public static final String WORKSPACE_OTP_RATE_LIMIT_SERVICE_PURPOSE_SUBJECT_REF = "purpose=? AND subject_ref=?";
    public static final String WORKSPACE_OTP_RATE_LIMIT_SERVICE_SELECT_WINDOW_STARTED_AT_EPOCH_MILLIS = "SELECT window_started_at_epoch_millis, send_count, verify_failed_attempts, locked_until_epoch_millis ";
    public static final String WORKSPACE_OTP_RATE_LIMIT_SERVICE_FROM_CLAUSE_OTP_RATE_LIMIT_BUCKET = "FROM workspace_iam.otp_rate_limit_bucket WHERE workspace_uuid=? AND group_workspace_key=? ";
    public static final String WORKSPACE_OTP_RATE_LIMIT_SERVICE_CONDITION = "AND ";
    public static final String WORKSPACE_OTP_RATE_LIMIT_SERVICE_PURPOSE_SUBJECT_REF_ALTERNATE_A = "purpose=? AND subject_ref=?";
    public static final String WORKSPACE_OTP_RATE_LIMIT_SERVICE_INSERT_INTO_OTP_RATE_LIMIT_BUCKET = "INSERT INTO workspace_iam.otp_rate_limit_bucket (workspace_uuid, group_workspace_key, purpose, ";
    public static final String WORKSPACE_OTP_RATE_LIMIT_SERVICE_SUBJECT_REF = "subject_ref, window_started_at_epoch_millis, send_count, verify_failed_attempts, ";
    public static final String WORKSPACE_OTP_RATE_LIMIT_SERVICE_LOCKED_UNTIL_EPOCH_MILLIS_UPDATED_AT_EPOCH_MILLIS = "locked_until_epoch_millis, updated_at_epoch_millis) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON ";
    public static final String WORKSPACE_OTP_RATE_LIMIT_SERVICE_SET = "CONFLICT (workspace_uuid, group_workspace_key, purpose, subject_ref) DO UPDATE SET ";
    public static final String WORKSPACE_OTP_RATE_LIMIT_SERVICE_WINDOW_STARTED_AT_EPOCH_MILLIS = "window_started_at_epoch_millis=EXCLUDED.window_started_at_epoch_millis, ";
    public static final String WORKSPACE_OTP_RATE_LIMIT_SERVICE_SEND_COUNT_VERIFY_FAILED_ATTEMPTS = "send_count=EXCLUDED.send_count, verify_failed_attempts=EXCLUDED.verify_failed_attempts, ";
    public static final String WORKSPACE_OTP_RATE_LIMIT_SERVICE_LOCKED_UNTIL_EPOCH_MILLIS = "locked_until_epoch_millis=EXCLUDED.locked_until_epoch_millis, ";
    public static final String WORKSPACE_OTP_RATE_LIMIT_SERVICE_UPDATE_UPDATED_AT_EPOCH_MILLIS = "updated_at_epoch_millis=EXCLUDED.updated_at_epoch_millis";
}
