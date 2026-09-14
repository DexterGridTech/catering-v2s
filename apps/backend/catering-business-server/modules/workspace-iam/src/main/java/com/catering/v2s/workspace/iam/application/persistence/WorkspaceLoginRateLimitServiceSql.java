package com.catering.v2s.workspace.iam.application.persistence;

/** SQL text fragments owned by WorkspaceLoginRateLimitService; B3 relocates text only and does not change execution. */
public final class WorkspaceLoginRateLimitServiceSql {
    public static final String WORKSPACE_LOGIN_RATE_LIMIT_SERVICE_DELETE_WORKSPACE_LOGIN_RATE_LIMIT_BUCKET_GROUP_WORKSPACE_KEY = "DELETE FROM workspace_iam.workspace_login_rate_limit_bucket WHERE group_workspace_key=? AND ";
    public static final String WORKSPACE_LOGIN_RATE_LIMIT_SERVICE_CONTINUATION_DIMENSION_ACCOUNT_FINGERPRINT = "dimension='ACCOUNT' AND fingerprint=?";
    public static final String WORKSPACE_LOGIN_RATE_LIMIT_SERVICE_SELECT_PG_ADVISORY_XACT_LOCK_HASHTEXT = "SELECT pg_advisory_xact_lock(hashtext(?))";
    public static final String WORKSPACE_LOGIN_RATE_LIMIT_SERVICE_SELECT_WORKSPACE_LOGIN_RATE_LIMIT_BUCKET = "SELECT locked_until_epoch_millis FROM workspace_iam.workspace_login_rate_limit_bucket WHERE ";
    public static final String WORKSPACE_LOGIN_RATE_LIMIT_SERVICE_CONTINUATION_GROUP_WORKSPACE_KEY_DIMENSION_FINGERPRINT = "group_workspace_key=? AND dimension=? AND fingerprint=?";
    public static final String WORKSPACE_LOGIN_RATE_LIMIT_SERVICE_SELECT_WINDOW_STARTED_AT_EPOCH_MILLIS_FAILED_ATTEMPTS = "SELECT window_started_at_epoch_millis, failed_attempts FROM ";
    public static final String WORKSPACE_LOGIN_RATE_LIMIT_SERVICE_CONTINUATION_WORKSPACE_LOGIN_RATE_LIMIT_BUCKET = "workspace_iam.workspace_login_rate_limit_bucket WHERE group_workspace_key=? AND dimension=? ";
    public static final String WORKSPACE_LOGIN_RATE_LIMIT_SERVICE_CONDITION = "AND ";
    public static final String WORKSPACE_LOGIN_RATE_LIMIT_SERVICE_CONTINUATION_FINGERPRINT = "fingerprint=?";
    public static final String WORKSPACE_LOGIN_RATE_LIMIT_SERVICE_INSERT_INTO_WORKSPACE_LOGIN_RATE_LIMIT_BUCKET = "INSERT INTO workspace_iam.workspace_login_rate_limit_bucket (group_workspace_key, dimension, ";
    public static final String WORKSPACE_LOGIN_RATE_LIMIT_SERVICE_CONTINUATION_FINGERPRINT_ALTERNATE_A = "fingerprint, window_started_at_epoch_millis, failed_attempts, locked_until_epoch_millis, ";
    public static final String WORKSPACE_LOGIN_RATE_LIMIT_SERVICE_UPDATE_UPDATED_AT_EPOCH_MILLIS_GROUP_WORKSPACE_KEY = "updated_at_epoch_millis) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (group_workspace_key, ";
    public static final String WORKSPACE_LOGIN_RATE_LIMIT_SERVICE_CONTINUATION_SET_DIMENSION_FINGERPRINT = "dimension, fingerprint) DO UPDATE SET ";
    public static final String WORKSPACE_LOGIN_RATE_LIMIT_SERVICE_CONTINUATION_WINDOW_STARTED_AT_EPOCH_MILLIS = "window_started_at_epoch_millis=EXCLUDED.window_started_at_epoch_millis, ";
    public static final String WORKSPACE_LOGIN_RATE_LIMIT_SERVICE_CONTINUATION_FAILED_ATTEMPTS = "failed_attempts=EXCLUDED.failed_attempts, ";
    public static final String WORKSPACE_LOGIN_RATE_LIMIT_SERVICE_CONTINUATION_LOCKED_UNTIL_EPOCH_MILLIS = "locked_until_epoch_millis=EXCLUDED.locked_until_epoch_millis, ";
    public static final String WORKSPACE_LOGIN_RATE_LIMIT_SERVICE_UPDATE_UPDATED_AT_EPOCH_MILLIS = "updated_at_epoch_millis=EXCLUDED.updated_at_epoch_millis";
}
