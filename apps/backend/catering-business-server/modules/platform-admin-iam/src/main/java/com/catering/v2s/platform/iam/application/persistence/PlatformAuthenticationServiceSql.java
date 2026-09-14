package com.catering.v2s.platform.iam.application.persistence;

/** SQL text owned by PlatformAuthenticationService; B3 relocates text without changing execution. */
public final class PlatformAuthenticationServiceSql {
    public static final String LOGIN_SUPERSEDE_OTP = "UPDATE platform_iam.platform_otp_grant SET status='SUPERSEDED' WHERE purpose='PLATFORM_LOGIN' AND "
            + "mobile_fingerprint=? AND status='ACTIVE'";
    public static final String LOGIN_FIND_ADMIN_BY_MOBILE = "SELECT id FROM platform_iam.platform_admin WHERE mobile_normalized=? AND status='ENABLED'";
    public static final String LOGIN_INSERT_OTP = "INSERT INTO platform_iam.platform_otp_grant (id, purpose, platform_admin_id, mobile_fingerprint, "
            + "token_hash, status, expires_at_epoch_millis, created_at_epoch_millis) VALUES (?, "
            + "'PLATFORM_LOGIN', ?, ?, ?, 'ACTIVE', ?, ?)";
    public static final String LOGIN_FIND_OTP = "SELECT platform_admin_id FROM platform_iam.platform_otp_grant WHERE purpose='PLATFORM_LOGIN' AND "
            + "mobile_fingerprint=? AND token_hash=? AND status='ACTIVE' AND expires_at_epoch_millis>? FOR UPDATE";
    public static final String LOGIN_CONSUME_OTP = "UPDATE platform_iam.platform_otp_grant SET status='USED', used_at_epoch_millis=? "
            + "WHERE purpose='PLATFORM_LOGIN' AND mobile_fingerprint=? AND token_hash=? AND status='ACTIVE'";
    public static final String LOGIN_INCREMENT_OTP_ATTEMPTS = "UPDATE platform_iam.platform_otp_grant SET attempt_count=attempt_count+1 WHERE "
            + "purpose='PLATFORM_LOGIN' AND mobile_fingerprint=? AND status='ACTIVE'";
    public static final String LOGIN_FIND_CREDENTIAL_BY_ADMIN = "SELECT a.id, a.display_name, a.status, c.password_hash, c.locked_until_epoch_millis FROM "
            + "platform_iam.platform_admin a JOIN platform_iam.platform_credential c ON "
            + "c.platform_admin_id=a.id WHERE a.id=? AND a.mobile_normalized=?";

    public static final String RECOVERY_FIND_ADMIN = "SELECT id FROM platform_iam.platform_admin WHERE login_name_normalized=? AND mobile_normalized=? AND "
            + "status='ENABLED'";
    public static final String RECOVERY_INSERT_FLOW = "INSERT INTO platform_iam.platform_password_recovery_flow (id, token_hash, login_name_normalized, "
            + "mobile_normalized, platform_admin_id, status, expires_at_epoch_millis, created_at_epoch_millis, "
            + "version) VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?, 1)";
    public static final String RECOVERY_SUPERSEDE_OTP = "UPDATE platform_iam.platform_otp_grant SET status='SUPERSEDED' WHERE "
            + "purpose='PLATFORM_PASSWORD_RECOVERY' AND recovery_flow_id=? AND status='ACTIVE'";
    public static final String RECOVERY_INSERT_OTP = "INSERT INTO platform_iam.platform_otp_grant (id, purpose, platform_admin_id, recovery_flow_id, "
            + "mobile_fingerprint, token_hash, status, expires_at_epoch_millis, created_at_epoch_millis) "
            + "VALUES (?, 'PLATFORM_PASSWORD_RECOVERY', ?, ?, ?, ?, 'ACTIVE', ?, ?)";
    public static final String RECOVERY_CONSUME_OTP = "UPDATE platform_iam.platform_otp_grant SET status='USED', used_at_epoch_millis=? WHERE "
            + "purpose='PLATFORM_PASSWORD_RECOVERY' AND recovery_flow_id=? AND token_hash=? AND "
            + "status='ACTIVE' AND expires_at_epoch_millis>?";
    public static final String RECOVERY_INCREMENT_OTP_ATTEMPTS = "UPDATE platform_iam.platform_otp_grant SET attempt_count=attempt_count+1 WHERE "
            + "purpose='PLATFORM_PASSWORD_RECOVERY' AND recovery_flow_id=? AND status='ACTIVE'";
    public static final String RECOVERY_MARK_VERIFIED = "UPDATE platform_iam.platform_password_recovery_flow SET status='VERIFIED', "
            + "verified_at_epoch_millis=?, version=version+1 WHERE id=? AND status='PENDING'";
    public static final String RECOVERY_UPDATE_CREDENTIAL = "UPDATE platform_iam.platform_credential SET password_hash=?, changed_at_epoch_millis=?, "
            + "failed_attempts=0, locked_until_epoch_millis=NULL, version=version+1 WHERE platform_admin_id=?";
    public static final String RECOVERY_REVOKE_SESSIONS = "UPDATE platform_iam.platform_session SET status='REVOKED', revoked_at_epoch_millis=?, "
            + "version=version+1 WHERE platform_admin_id=? AND status='ACTIVE'";
    public static final String RECOVERY_MARK_COMPLETED = "UPDATE platform_iam.platform_password_recovery_flow SET status='COMPLETED', "
            + "completed_at_epoch_millis=?, version=version+1 WHERE id=? AND status='VERIFIED'";

    public static final String LOGIN_FIND_CREDENTIAL = "SELECT a.id, a.display_name, a.status, c.password_hash, c.locked_until_epoch_millis FROM "
            + "platform_iam.platform_admin a JOIN platform_iam.platform_credential c ON "
            + "c.platform_admin_id=a.id WHERE a.login_name_normalized=?";
    public static final String LOGIN_RECORD_FAILURE = "UPDATE platform_iam.platform_credential SET failed_attempts=CASE WHEN locked_until_epoch_millis "
            + "IS NOT NULL AND locked_until_epoch_millis<=? THEN 1 ELSE failed_attempts+1 END, "
            + "locked_until_epoch_millis=CASE WHEN (CASE WHEN locked_until_epoch_millis IS NOT NULL "
            + "AND locked_until_epoch_millis<=? THEN 1 ELSE failed_attempts+1 END)>=? THEN ? ELSE "
            + "locked_until_epoch_millis END, version=version+1 WHERE platform_admin_id=?";
    public static final String LOGIN_CLEAR_CREDENTIAL_FAILURES = "UPDATE platform_iam.platform_credential SET failed_attempts=0, locked_until_epoch_millis=NULL, "
            + "version=version+1 WHERE platform_admin_id=? AND (failed_attempts<>0 OR "
            + "locked_until_epoch_millis IS NOT NULL)";
    public static final String SESSION_FIND_ACTIVE = "SELECT s.id, s.version, a.id AS admin_id, a.display_name, s.expires_at_epoch_millis FROM "
            + "platform_iam.platform_session s JOIN platform_iam.platform_admin a ON "
            + "a.id=s.platform_admin_id WHERE s.token_hash=? AND s.status='ACTIVE' AND a.status='ENABLED' AND "
            + "s.expires_at_epoch_millis>?";
    public static final String SESSION_REVOKE_BY_TOKEN = "UPDATE platform_iam.platform_session SET status='REVOKED', revoked_at_epoch_millis=?, "
            + "version=version+1 WHERE token_hash=? AND status='ACTIVE'";
    public static final String SESSION_FIND_CREDENTIAL = "SELECT s.platform_admin_id, s.version, c.password_hash FROM platform_iam.platform_session s JOIN "
            + "platform_iam.platform_credential c ON c.platform_admin_id=s.platform_admin_id WHERE "
            + "s.token_hash=? AND s.status='ACTIVE' AND s.expires_at_epoch_millis>?";
    public static final String PASSWORD_UPDATE_CREDENTIAL = "UPDATE platform_iam.platform_credential SET password_hash=?, changed_at_epoch_millis=?, "
            + "version=version+1 WHERE platform_admin_id=?";
    public static final String PASSWORD_REVOKE_SESSIONS = RECOVERY_REVOKE_SESSIONS;

    public static final String RESET_UPDATE_ADMIN_VERSION = "UPDATE platform_iam.platform_admin SET version=version+1, updated_at_epoch_millis=? WHERE "
            + "id=? AND version=?";
    public static final String RESET_UPDATE_CREDENTIAL = "UPDATE platform_iam.platform_credential SET password_hash=?, changed_at_epoch_millis=?, "
            + "version=version+1, failed_attempts=0, locked_until_epoch_millis=NULL WHERE "
            + "platform_admin_id=?";
    public static final String RESET_REVOKE_SESSIONS = RECOVERY_REVOKE_SESSIONS;
    public static final String ADMINISTRATOR_PAGE_WHERE =
            " WHERE (CAST(? AS text) IS NULL OR a.display_name ILIKE '%' || CAST(? AS text) || '%') AND (CAST(? AS "
                    + "text) IS NULL OR a.login_name ILIKE '%' || CAST(? AS text) || '%') AND (CAST(? AS text) IS "
                    + "NULL OR a.status=CAST(? AS text))";
    public static final String ADMINISTRATOR_COUNT = "SELECT COUNT(*) FROM platform_iam.platform_admin a";
    public static final String ADMINISTRATOR_ORDER_BY_PREFIX = " ORDER BY ";
    public static final String ADMINISTRATOR_ORDER_BY_STABLE_SUFFIX = ", a.id ASC";
    public static final String ADMINISTRATOR_PAGE_LIMIT_OFFSET = " LIMIT ? OFFSET ?";
    public static final String ADMINISTRATOR_ORDER_USER_NAME = "a.display_name";
    public static final String ADMINISTRATOR_ORDER_LOGIN_NAME = "a.login_name_normalized";
    public static final String ADMINISTRATOR_ORDER_LAST_LOGIN = "last_login_at";
    public static final String ADMINISTRATOR_ORDER_UPDATED = "a.updated_at_epoch_millis";
    public static final String ADMINISTRATOR_READBACK_BY_ID_SUFFIX = "WHERE a.id=?";
    public static final String ADMINISTRATOR_READBACK_BASE = """
        SELECT a.id, a.login_name, a.display_name, a.mobile_mask_source, a.status, a.is_builtin, a.version, \
        a.created_at_epoch_millis, a.updated_at_epoch_millis,
               (SELECT max(coalesce(s.last_seen_at_epoch_millis, s.created_at_epoch_millis)) FROM \
               platform_iam.platform_session s WHERE s.platform_admin_id=a.id) AS last_login_at,
               coalesce((SELECT p.action FROM platform_iam.audit_event p WHERE p.entity_type='PLATFORM_ADMIN' AND \
               p.entity_ref_text=a.id::text ORDER BY p.occurred_at_epoch_millis DESC, p.id DESC LIMIT 1), \
               'NO_ADMIN_AUDIT_EVENT') AS audit_summary
          FROM platform_iam.platform_admin a
        """;
    public static final String ADMINISTRATOR_UPDATE_STATUS = "UPDATE platform_iam.platform_admin SET status=?, version=version+1, updated_at_epoch_millis=? WHERE "
            + "id=? AND version=?";
    public static final String ADMINISTRATOR_REVOKE_SESSIONS = RECOVERY_REVOKE_SESSIONS;
    public static final String BOOTSTRAP_LOCK_TABLE = "LOCK TABLE platform_iam.platform_admin IN EXCLUSIVE MODE";
    public static final String BOOTSTRAP_COUNT = "SELECT COUNT(*) FROM platform_iam.platform_admin";
    public static final String BOOTSTRAP_INSERT_ADMIN = "INSERT INTO platform_iam.platform_admin (id, login_name, login_name_normalized, display_name, "
            + "status, version, created_at_epoch_millis, updated_at_epoch_millis) VALUES (?, ?, ?, ?, "
            + "'ENABLED', 1, ?, ?)";
    public static final String BOOTSTRAP_INSERT_CREDENTIAL = "INSERT INTO platform_iam.platform_credential (platform_admin_id, password_hash, algorithm, "
            + "changed_at_epoch_millis, version) VALUES (?, ?, 'bcrypt', ?, 1)";
    public static final String ADMINISTRATOR_INSERT = "INSERT INTO platform_iam.platform_admin (id, login_name, login_name_normalized, display_name, "
            + "mobile_mask_source, mobile_normalized, status, version, created_at_epoch_millis, "
            + "updated_at_epoch_millis) VALUES (?, ?, ?, ?, ?, ?, 'ENABLED', 1, ?, ?)";
    public static final String ADMINISTRATOR_INSERT_CREDENTIAL = BOOTSTRAP_INSERT_CREDENTIAL;
    public static final String ADMINISTRATOR_UPDATE_PROFILE = "UPDATE platform_iam.platform_admin SET display_name=?, mobile_mask_source=?, mobile_normalized=?, "
            + "version=version+1, updated_at_epoch_millis=? WHERE id=? AND version=?";
    public static final String ADMINISTRATOR_UPDATE_DISPLAY_NAME = "UPDATE platform_iam.platform_admin SET display_name=?, version=version+1, "
            + "updated_at_epoch_millis=? WHERE id=? AND version=?";
    public static final String ENABLED_ADMIN_EXISTS = "SELECT EXISTS(SELECT 1 FROM platform_iam.platform_admin WHERE id=? AND status='ENABLED')";

    public static final String SESSION_INSERT = "INSERT INTO platform_iam.platform_session (id, platform_admin_id, token_hash, status, "
            + "expires_at_epoch_millis, created_at_epoch_millis, last_seen_at_epoch_millis, version) "
            + "VALUES "
            + "(?, ?, ?, 'ACTIVE', ?, ?, ?, 1)";
    public static final String RECOVERY_FIND_FLOW = "SELECT id, login_name_normalized, mobile_normalized, platform_admin_id, status, "
            + "expires_at_epoch_millis FROM platform_iam.platform_password_recovery_flow WHERE "
            + "token_hash=? FOR UPDATE";
    public static final String RECOVERY_IDENTITY_ELIGIBLE = "SELECT TRUE FROM platform_iam.platform_admin WHERE id=? AND login_name_normalized=? AND "
            + "mobile_normalized=? AND status='ENABLED'";
    public static final String OTP_RATE_FIND_LOCK = "SELECT locked_until_epoch_millis FROM platform_iam.platform_public_otp_rate_limit_bucket WHERE "
            + "purpose=? AND dimension=? AND fingerprint=?";
    public static final String OTP_RATE_CLEAR = "DELETE FROM platform_iam.platform_public_otp_rate_limit_bucket WHERE purpose=? AND dimension=? AND "
            + "fingerprint=?";
    public static final String OTP_RATE_READ_FAILURE = "SELECT window_started_at_epoch_millis, failed_attempts FROM "
            + "platform_iam.platform_public_otp_rate_limit_bucket WHERE purpose=? AND dimension=? AND "
            + "fingerprint=?";
    public static final String OTP_RATE_UPSERT = "INSERT INTO platform_iam.platform_public_otp_rate_limit_bucket (purpose, dimension, fingerprint, "
            + "window_started_at_epoch_millis, failed_attempts, locked_until_epoch_millis, "
            + "updated_at_epoch_millis) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (purpose, dimension, "
            + "fingerprint) DO UPDATE SET "
            + "window_started_at_epoch_millis=EXCLUDED.window_started_at_epoch_millis, "
            + "failed_attempts=EXCLUDED.failed_attempts, "
            + "locked_until_epoch_millis=EXCLUDED.locked_until_epoch_millis, "
            + "updated_at_epoch_millis=EXCLUDED.updated_at_epoch_millis";
    public static final String LOGIN_RATE_LOCK = "SELECT pg_advisory_xact_lock(hashtext(?))";
    public static final String LOGIN_RATE_FIND_LOCK = "SELECT locked_until_epoch_millis FROM platform_iam.platform_login_rate_limit_bucket WHERE dimension=? "
            + "AND fingerprint=?";
    public static final String LOGIN_RATE_READ_FAILURE = "SELECT window_started_at_epoch_millis, failed_attempts FROM "
            + "platform_iam.platform_login_rate_limit_bucket WHERE dimension=? AND fingerprint=?";
    public static final String LOGIN_RATE_UPSERT = "INSERT INTO platform_iam.platform_login_rate_limit_bucket (dimension, fingerprint, "
            + "window_started_at_epoch_millis, failed_attempts, locked_until_epoch_millis, "
            + "updated_at_epoch_millis) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (dimension, fingerprint) DO "
            + "UPDATE SET window_started_at_epoch_millis=EXCLUDED.window_started_at_epoch_millis, "
            + "failed_attempts=EXCLUDED.failed_attempts, "
            + "locked_until_epoch_millis=EXCLUDED.locked_until_epoch_millis, "
            + "updated_at_epoch_millis=EXCLUDED.updated_at_epoch_millis";
    public static final String LOGIN_RATE_CLEAR_ACCOUNT = "DELETE FROM platform_iam.platform_login_rate_limit_bucket WHERE dimension='ACCOUNT' AND fingerprint=?";
    public static final String DEACTIVATION_LOCK = "SELECT pg_advisory_xact_lock(hashtext(?))";
    public static final String DEACTIVATION_FIND_GUARD = "SELECT is_builtin, status FROM platform_iam.platform_admin WHERE id=? FOR UPDATE";
    public static final String DEACTIVATION_COUNT_ENABLED = "SELECT count(*) FROM platform_iam.platform_admin WHERE status='ENABLED'";
    public static final String AUDIT_INSERT = "INSERT INTO platform_iam.audit_event (id, entity_type, entity_ref_text, actor_type, actor_id, "
            + "actor_display_snapshot, action, occurred_at_epoch_millis, changes_json) VALUES (?, "
            + "'PLATFORM_ADMIN', ?, ?, ?, ?, ?, ?, CAST(? AS JSONB))";

}
