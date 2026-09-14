package com.catering.v2s.platform.iam.application.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

/** Typed JDBC execution boundary for platform authentication and administrator facts. */
@Repository
public class PlatformAuthenticationPersistence {
    private final JdbcTemplate jdbc;

    public PlatformAuthenticationPersistence(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record CredentialRow(
            UUID platformAdminId,
            String displayName,
            String status,
            String passwordHash,
            Long lockedUntilEpochMillis) {}

    public record SessionRow(
            UUID id, long version, UUID adminId, String displayName, long expiresAtEpochMillis) {}

    public record SessionCredential(UUID adminId, long version, String passwordHash) {}

    public record RecoveryFlow(
            UUID id,
            String loginNameNormalized,
            String mobileNormalized,
            UUID platformAdminId,
            String status,
            long expiresAtEpochMillis) {}

    public record RateBucket(long windowStartedAtEpochMillis, int failedAttempts) {}

    public record AdminGuard(boolean builtIn, String status) {}

    public record AdministratorRow(
            UUID id,
            String loginName,
            String displayName,
            String mobile,
            String status,
            boolean builtIn,
            long version,
            long createdAtEpochMillis,
            long updatedAtEpochMillis,
            Long lastLoginAtEpochMillis,
            String auditSummary) {}

    public void supersedeLoginOtp(String mobileFingerprint) {
        jdbc.update(PlatformAuthenticationServiceSql.LOGIN_SUPERSEDE_OTP, mobileFingerprint);
    }

    public UUID findEnabledAdministratorByMobile(String normalizedMobile) {
        return jdbc.query(
                PlatformAuthenticationServiceSql.LOGIN_FIND_ADMIN_BY_MOBILE,
                statement -> statement.setString(1, normalizedMobile),
                result -> result.next() ? result.getObject(1, UUID.class) : null);
    }

    public int insertLoginOtp(
            UUID id,
            UUID administratorId,
            String mobileFingerprint,
            String tokenHash,
            long expiresAt,
            long now) {
        return jdbc.update(
                PlatformAuthenticationServiceSql.LOGIN_INSERT_OTP,
                id,
                administratorId,
                mobileFingerprint,
                tokenHash,
                expiresAt,
                now);
    }

    public UUID findActiveLoginOtpAdministrator(String mobileFingerprint, String tokenHash, long now) {
        return jdbc.query(
                PlatformAuthenticationServiceSql.LOGIN_FIND_OTP,
                statement -> {
                    statement.setString(1, mobileFingerprint);
                    statement.setString(2, tokenHash);
                    statement.setLong(3, now);
                },
                result -> result.next() ? result.getObject(1, UUID.class) : null);
    }

    public int consumeLoginOtp(long now, String mobileFingerprint, String tokenHash) {
        return jdbc.update(PlatformAuthenticationServiceSql.LOGIN_CONSUME_OTP, now, mobileFingerprint, tokenHash);
    }

    public int incrementLoginOtpAttempts(String mobileFingerprint) {
        return jdbc.update(PlatformAuthenticationServiceSql.LOGIN_INCREMENT_OTP_ATTEMPTS, mobileFingerprint);
    }

    public CredentialRow findCredentialByAdministrator(UUID administratorId, String normalizedMobile) {
        return jdbc.query(
                PlatformAuthenticationServiceSql.LOGIN_FIND_CREDENTIAL_BY_ADMIN,
                statement -> {
                    statement.setObject(1, administratorId);
                    statement.setString(2, normalizedMobile);
                },
                result -> result.next() ? credentialRow(result) : null);
    }

    public UUID findRecoveryAdministrator(String normalizedLoginName, String normalizedMobile) {
        return jdbc.query(
                PlatformAuthenticationServiceSql.RECOVERY_FIND_ADMIN,
                statement -> {
                    statement.setString(1, normalizedLoginName);
                    statement.setString(2, normalizedMobile);
                },
                result -> result.next() ? result.getObject(1, UUID.class) : null);
    }

    public int insertRecoveryFlow(
            UUID id,
            String tokenHash,
            String normalizedLoginName,
            String normalizedMobile,
            UUID administratorId,
            long expiresAt,
            long now) {
        return jdbc.update(
                PlatformAuthenticationServiceSql.RECOVERY_INSERT_FLOW,
                id,
                tokenHash,
                normalizedLoginName,
                normalizedMobile,
                administratorId,
                expiresAt,
                now);
    }

    public void supersedeRecoveryOtp(UUID recoveryFlowId) {
        jdbc.update(PlatformAuthenticationServiceSql.RECOVERY_SUPERSEDE_OTP, recoveryFlowId);
    }

    public int insertRecoveryOtp(
            UUID id,
            UUID administratorId,
            UUID recoveryFlowId,
            String mobileFingerprint,
            String tokenHash,
            long expiresAt,
            long now) {
        return jdbc.update(
                PlatformAuthenticationServiceSql.RECOVERY_INSERT_OTP,
                id,
                administratorId,
                recoveryFlowId,
                mobileFingerprint,
                tokenHash,
                expiresAt,
                now);
    }

    public int consumeRecoveryOtp(long now, UUID recoveryFlowId, String tokenHash) {
        return jdbc.update(PlatformAuthenticationServiceSql.RECOVERY_CONSUME_OTP, now, recoveryFlowId, tokenHash, now);
    }

    public int incrementRecoveryOtpAttempts(UUID recoveryFlowId) {
        return jdbc.update(PlatformAuthenticationServiceSql.RECOVERY_INCREMENT_OTP_ATTEMPTS, recoveryFlowId);
    }

    public int markRecoveryVerified(long now, UUID recoveryFlowId) {
        return jdbc.update(PlatformAuthenticationServiceSql.RECOVERY_MARK_VERIFIED, now, recoveryFlowId);
    }

    public int updateRecoveryCredential(String passwordHash, long now, UUID administratorId) {
        return jdbc.update(PlatformAuthenticationServiceSql.RECOVERY_UPDATE_CREDENTIAL, passwordHash, now, administratorId);
    }

    public int revokeRecoverySessions(long now, UUID administratorId) {
        return jdbc.update(PlatformAuthenticationServiceSql.RECOVERY_REVOKE_SESSIONS, now, administratorId);
    }

    public int markRecoveryCompleted(long now, UUID recoveryFlowId) {
        return jdbc.update(PlatformAuthenticationServiceSql.RECOVERY_MARK_COMPLETED, now, recoveryFlowId);
    }

    public Optional<CredentialRow> findCredentialByLoginName(String normalizedLoginName) {
        return jdbc.query(
                PlatformAuthenticationServiceSql.LOGIN_FIND_CREDENTIAL,
                statement -> statement.setString(1, normalizedLoginName),
                result -> result.next() ? Optional.of(credentialRow(result)) : Optional.empty());
    }

    public int recordLoginFailure(
            long now,
            int credentialFailureLimit,
            long credentialLockUntil,
            UUID administratorId) {
        return jdbc.update(
                PlatformAuthenticationServiceSql.LOGIN_RECORD_FAILURE,
                now,
                now,
                credentialFailureLimit,
                credentialLockUntil,
                administratorId);
    }

    public int clearCredentialFailures(UUID administratorId) {
        return jdbc.update(PlatformAuthenticationServiceSql.LOGIN_CLEAR_CREDENTIAL_FAILURES, administratorId);
    }

    public SessionRow findActiveSession(String tokenHash, long now) {
        return jdbc.query(
                PlatformAuthenticationServiceSql.SESSION_FIND_ACTIVE,
                statement -> {
                    statement.setString(1, tokenHash);
                    statement.setLong(2, now);
                },
                result -> result.next()
                        ? new SessionRow(
                                result.getObject("id", UUID.class),
                                result.getLong("version"),
                                result.getObject("admin_id", UUID.class),
                                result.getString("display_name"),
                                result.getLong("expires_at_epoch_millis"))
                        : null);
    }

    public int revokeSession(String tokenHash, long now) {
        return jdbc.update(PlatformAuthenticationServiceSql.SESSION_REVOKE_BY_TOKEN, now, tokenHash);
    }

    public SessionCredential findSessionCredential(String tokenHash, long now) {
        return jdbc.query(
                PlatformAuthenticationServiceSql.SESSION_FIND_CREDENTIAL,
                statement -> {
                    statement.setString(1, tokenHash);
                    statement.setLong(2, now);
                },
                result -> result.next()
                        ? new SessionCredential(result.getObject(1, UUID.class), result.getLong(2), result.getString(3))
                        : null);
    }

    public int updatePasswordCredential(String passwordHash, long now, UUID administratorId) {
        return jdbc.update(PlatformAuthenticationServiceSql.PASSWORD_UPDATE_CREDENTIAL, passwordHash, now, administratorId);
    }

    public int revokePasswordSessions(long now, UUID administratorId) {
        return jdbc.update(PlatformAuthenticationServiceSql.PASSWORD_REVOKE_SESSIONS, now, administratorId);
    }

    public int updateAdministratorVersion(long now, UUID administratorId, long expectedVersion) {
        return jdbc.update(PlatformAuthenticationServiceSql.RESET_UPDATE_ADMIN_VERSION, now, administratorId, expectedVersion);
    }

    public int updateResetCredential(String passwordHash, long now, UUID administratorId) {
        return jdbc.update(PlatformAuthenticationServiceSql.RESET_UPDATE_CREDENTIAL, passwordHash, now, administratorId);
    }

    public Long countAdministrators(String userName, String loginName, String status) {
        return jdbc.queryForObject(
                PlatformAuthenticationServiceSql.ADMINISTRATOR_COUNT + PlatformAuthenticationServiceSql.ADMINISTRATOR_PAGE_WHERE,
                Long.class,
                pageFilterValues(userName, loginName, status));
    }

    public List<AdministratorRow> readAdministratorsPage(
            String userName,
            String loginName,
            String status,
            int pageSize,
            long offset,
            String sortKey,
            String sortDirection) {
        String sql = PlatformAuthenticationServiceSql.ADMINISTRATOR_READBACK_BASE
                + PlatformAuthenticationServiceSql.ADMINISTRATOR_PAGE_WHERE
                + PlatformAuthenticationServiceSql.ADMINISTRATOR_ORDER_BY_PREFIX
                + administratorOrderBy(sortKey, sortDirection)
                + PlatformAuthenticationServiceSql.ADMINISTRATOR_PAGE_LIMIT_OFFSET;
        Object[] values = pageFilterValues(userName, loginName, status);
        Object[] pageValues = java.util.Arrays.copyOf(values, values.length + 2);
        pageValues[values.length] = (long) pageSize;
        pageValues[values.length + 1] = offset;
        RowMapper<AdministratorRow> mapper = PlatformAuthenticationPersistence::administratorRow;
        return jdbc.query(sql, mapper, pageValues);
    }

    public AdministratorRow readAdministrator(UUID id) {
        return jdbc.query(
                PlatformAuthenticationServiceSql.ADMINISTRATOR_READBACK_BASE
                        + PlatformAuthenticationServiceSql.ADMINISTRATOR_READBACK_BY_ID_SUFFIX,
                statement -> statement.setObject(1, id),
                result -> result.next() ? administratorRow(result, 0) : null);
    }

    public int updateAdministratorStatus(String targetStatus, long now, UUID id, long expectedVersion) {
        return jdbc.update(
                PlatformAuthenticationServiceSql.ADMINISTRATOR_UPDATE_STATUS,
                targetStatus,
                now,
                id,
                expectedVersion);
    }

    public void lockBootstrapAdministratorTable() {
        jdbc.execute(PlatformAuthenticationServiceSql.BOOTSTRAP_LOCK_TABLE);
    }

    public Long countBootstrapAdministrators() {
        return jdbc.queryForObject(PlatformAuthenticationServiceSql.BOOTSTRAP_COUNT, Long.class);
    }

    public int insertBootstrapAdministrator(
            UUID id, String loginName, String normalizedLoginName, String displayName, long now) {
        return jdbc.update(
                PlatformAuthenticationServiceSql.BOOTSTRAP_INSERT_ADMIN,
                id,
                loginName,
                normalizedLoginName,
                displayName,
                now,
                now);
    }

    public int insertBootstrapCredential(UUID administratorId, String passwordHash, long now) {
        return jdbc.update(PlatformAuthenticationServiceSql.BOOTSTRAP_INSERT_CREDENTIAL, administratorId, passwordHash, now);
    }

    public int insertAdministrator(
            UUID id,
            String loginName,
            String normalizedLoginName,
            String displayName,
            String displayMobile,
            String normalizedMobile,
            long now) {
        return jdbc.update(
                PlatformAuthenticationServiceSql.ADMINISTRATOR_INSERT,
                id,
                loginName,
                normalizedLoginName,
                displayName,
                displayMobile,
                normalizedMobile,
                now,
                now);
    }

    public int insertAdministratorCredential(UUID administratorId, String passwordHash, long now) {
        return jdbc.update(PlatformAuthenticationServiceSql.ADMINISTRATOR_INSERT_CREDENTIAL, administratorId, passwordHash, now);
    }

    public int updateAdministratorProfile(
            String displayName,
            String displayMobile,
            String normalizedMobile,
            long now,
            UUID id,
            long expectedVersion) {
        return jdbc.update(
                PlatformAuthenticationServiceSql.ADMINISTRATOR_UPDATE_PROFILE,
                displayName,
                displayMobile,
                normalizedMobile,
                now,
                id,
                expectedVersion);
    }

    public int updateAdministratorDisplayName(String displayName, long now, UUID id, long expectedVersion) {
        return jdbc.update(
                PlatformAuthenticationServiceSql.ADMINISTRATOR_UPDATE_DISPLAY_NAME,
                displayName,
                now,
                id,
                expectedVersion);
    }

    public boolean isEnabledAdministrator(UUID id) {
        return Boolean.TRUE.equals(jdbc.queryForObject(
                PlatformAuthenticationServiceSql.ENABLED_ADMIN_EXISTS, Boolean.class, id));
    }

    public int insertSession(
            UUID sessionId,
            UUID administratorId,
            String tokenHash,
            long expiresAt,
            long now) {
        return jdbc.update(
                PlatformAuthenticationServiceSql.SESSION_INSERT,
                sessionId,
                administratorId,
                tokenHash,
                expiresAt,
                now,
                now);
    }

    public RecoveryFlow readRecoveryFlow(String tokenHash) {
        return jdbc.query(
                PlatformAuthenticationServiceSql.RECOVERY_FIND_FLOW,
                statement -> statement.setString(1, tokenHash),
                result -> result.next()
                        ? new RecoveryFlow(
                                result.getObject("id", UUID.class),
                                result.getString("login_name_normalized"),
                                result.getString("mobile_normalized"),
                                result.getObject("platform_admin_id", UUID.class),
                                result.getString("status"),
                                result.getLong("expires_at_epoch_millis"))
                        : null);
    }

    public boolean isRecoveryIdentityEligible(UUID administratorId, String loginName, String mobile) {
        return Boolean.TRUE.equals(jdbc.query(
                PlatformAuthenticationServiceSql.RECOVERY_IDENTITY_ELIGIBLE,
                statement -> {
                    statement.setObject(1, administratorId);
                    statement.setString(2, loginName);
                    statement.setString(3, mobile);
                },
                result -> result.next() ? Boolean.TRUE : Boolean.FALSE));
    }

    public Long findOtpRateLock(String purpose, String dimension, String fingerprint) {
        return jdbc.query(
                PlatformAuthenticationServiceSql.OTP_RATE_FIND_LOCK,
                statement -> {
                    statement.setString(1, purpose);
                    statement.setString(2, dimension);
                    statement.setString(3, fingerprint);
                },
                result -> result.next() ? result.getObject(1, Long.class) : null);
    }

    public int clearOtpRateBucket(String purpose, String dimension, String fingerprint) {
        return jdbc.update(PlatformAuthenticationServiceSql.OTP_RATE_CLEAR, purpose, dimension, fingerprint);
    }

    public RateBucket readOtpRateFailure(String purpose, String dimension, String fingerprint) {
        return jdbc.query(
                PlatformAuthenticationServiceSql.OTP_RATE_READ_FAILURE,
                statement -> {
                    statement.setString(1, purpose);
                    statement.setString(2, dimension);
                    statement.setString(3, fingerprint);
                },
                result -> result.next() ? new RateBucket(result.getLong(1), result.getInt(2)) : null);
    }

    public int upsertOtpRateFailure(
            String purpose,
            String dimension,
            String fingerprint,
            long windowStartedAt,
            int failedAttempts,
            Long lockedUntil,
            long now) {
        return jdbc.update(
                PlatformAuthenticationServiceSql.OTP_RATE_UPSERT,
                purpose,
                dimension,
                fingerprint,
                windowStartedAt,
                failedAttempts,
                lockedUntil,
                now);
    }

    public void lockLoginRateBucket(String dimension, String fingerprint) {
        jdbc.queryForList(PlatformAuthenticationServiceSql.LOGIN_RATE_LOCK, dimension + ':' + fingerprint);
    }

    public Long findLoginRateLock(String dimension, String fingerprint) {
        return jdbc.query(
                PlatformAuthenticationServiceSql.LOGIN_RATE_FIND_LOCK,
                statement -> {
                    statement.setString(1, dimension);
                    statement.setString(2, fingerprint);
                },
                result -> result.next() ? result.getObject(1, Long.class) : null);
    }

    public RateBucket readLoginRateFailure(String dimension, String fingerprint) {
        return jdbc.query(
                PlatformAuthenticationServiceSql.LOGIN_RATE_READ_FAILURE,
                statement -> {
                    statement.setString(1, dimension);
                    statement.setString(2, fingerprint);
                },
                result -> result.next() ? new RateBucket(result.getLong(1), result.getInt(2)) : null);
    }

    public int upsertLoginRateFailure(
            String dimension,
            String fingerprint,
            long windowStartedAt,
            int failedAttempts,
            Long lockedUntil,
            long now) {
        return jdbc.update(
                PlatformAuthenticationServiceSql.LOGIN_RATE_UPSERT,
                dimension,
                fingerprint,
                windowStartedAt,
                failedAttempts,
                lockedUntil,
                now);
    }

    public int clearLoginAccountFailures(String fingerprint) {
        return jdbc.update(PlatformAuthenticationServiceSql.LOGIN_RATE_CLEAR_ACCOUNT, fingerprint);
    }

    public void lockAdministratorDeactivation() {
        jdbc.queryForList(PlatformAuthenticationServiceSql.DEACTIVATION_LOCK, "platform-iam:last-enabled-administrator");
    }

    public AdminGuard readAdministratorDeactivationGuard(UUID id) {
        return jdbc.query(
                PlatformAuthenticationServiceSql.DEACTIVATION_FIND_GUARD,
                statement -> statement.setObject(1, id),
                result -> result.next()
                        ? new AdminGuard(result.getBoolean(1), result.getString(2))
                        : null);
    }

    public Long countEnabledAdministrators() {
        return jdbc.queryForObject(PlatformAuthenticationServiceSql.DEACTIVATION_COUNT_ENABLED, Long.class);
    }

    public int insertAudit(
            UUID eventId,
            String subjectRef,
            String actorType,
            UUID actorId,
            String actorDisplaySnapshot,
            String action,
            long occurredAt,
            String changesJson) {
        return jdbc.update(
                PlatformAuthenticationServiceSql.AUDIT_INSERT,
                eventId,
                subjectRef,
                actorType,
                actorId,
                actorDisplaySnapshot,
                action,
                occurredAt,
                changesJson);
    }

    private static Object[] pageFilterValues(String userName, String loginName, String status) {
        return new Object[] {userName, userName, loginName, loginName, status, status};
    }

    private static String administratorOrderBy(String sortKey, String sortDirection) {
        String field = switch (sortKey) {
            case "USER_NAME" -> PlatformAuthenticationServiceSql.ADMINISTRATOR_ORDER_USER_NAME;
            case "LOGIN_NAME" -> PlatformAuthenticationServiceSql.ADMINISTRATOR_ORDER_LOGIN_NAME;
            case "LAST_LOGIN_AT" -> PlatformAuthenticationServiceSql.ADMINISTRATOR_ORDER_LAST_LOGIN;
            case "UPDATED_AT" -> PlatformAuthenticationServiceSql.ADMINISTRATOR_ORDER_UPDATED;
            default -> throw new IllegalArgumentException("unsupported administrator sort key");
        };
        return field + ' ' + sortDirection + PlatformAuthenticationServiceSql.ADMINISTRATOR_ORDER_BY_STABLE_SUFFIX;
    }

    private static CredentialRow credentialRow(java.sql.ResultSet result) throws java.sql.SQLException {
        return new CredentialRow(
                result.getObject("id", UUID.class),
                result.getString("display_name"),
                result.getString("status"),
                result.getString("password_hash"),
                result.getObject("locked_until_epoch_millis", Long.class));
    }

    private static AdministratorRow administratorRow(java.sql.ResultSet result, int ignored) throws java.sql.SQLException {
        return new AdministratorRow(
                result.getObject("id", UUID.class),
                result.getString("login_name"),
                result.getString("display_name"),
                result.getString("mobile_mask_source"),
                result.getString("status"),
                result.getBoolean("is_builtin"),
                result.getLong("version"),
                result.getLong("created_at_epoch_millis"),
                result.getLong("updated_at_epoch_millis"),
                result.getObject("last_login_at", Long.class),
                result.getString("audit_summary"));
    }

    private static AdministratorRow administratorRow(java.sql.ResultSet result) throws java.sql.SQLException {
        return administratorRow(result, 0);
    }
}
