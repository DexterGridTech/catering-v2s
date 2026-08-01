package com.catering.v2s.platform.iam.application;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.audit.contract.AuditChange;
import com.catering.v2s.audit.contract.AuditChangePolicy;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.platform.iam.api.PlatformGovernanceAuthorization;
import com.catering.v2s.platform.iam.api.PlatformSessionReadback;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.beans.factory.annotation.Value;

/** Platform credential/session owner. It has no default principal and stores only token hashes. */
@Service
public class PlatformAuthenticationService implements PlatformGovernanceAuthorization {
    private static final long SESSION_TTL_MILLIS = 8 * 60 * 60 * 1000L;
    private static final int CREDENTIAL_FAILURE_LIMIT = 10;
    private static final long CREDENTIAL_LOCK_MILLIS = 15 * 60 * 1000L;
    private static final int SOURCE_FAILURE_LIMIT = 30;
    private static final long ACCOUNT_FAILURE_WINDOW_MILLIS = 15 * 60 * 1000L;
    private static final long SOURCE_FAILURE_WINDOW_MILLIS = 5 * 60 * 1000L;
    private static final long SOURCE_LOCK_MILLIS = 5 * 60 * 1000L;
    private static final long OTP_TTL_MILLIS = 5 * 60 * 1000L;
    private static final long RECOVERY_FLOW_TTL_MILLIS = 30 * 60 * 1000L;
    private static final int OTP_SEND_LIMIT = 5;
    private static final int OTP_VERIFY_LIMIT = 10;
    private static final AuditChangePolicy ADMIN_CREATED = new AuditChangePolicy("PLATFORM_ADMIN", "PLATFORM_ADMIN_CREATED", Set.of("displayName"));
    private static final AuditChangePolicy ADMIN_STATUS_CHANGED = new AuditChangePolicy("PLATFORM_ADMIN", "PLATFORM_ADMIN_STATUS_CHANGED", Set.of("status"));
    private static final AuditChangePolicy ADMIN_PROFILE_UPDATED = new AuditChangePolicy("PLATFORM_ADMIN", "PLATFORM_ADMIN_PROFILE_UPDATED", Set.of("displayName"));
    private static final AuditChangePolicy ADMIN_CREDENTIAL_RESET = new AuditChangePolicy("PLATFORM_ADMIN", "PLATFORM_ADMIN_CREDENTIAL_RESET", Set.of());
    private final JdbcTemplate jdbc;
    private final TimeProvider timeProvider;
    private final PlatformCommandReceiptService receipts;
    private final byte[] rateLimitHmacSecret;
    private final boolean debugCodeExposure;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    private final SecureRandom secureRandom = new SecureRandom();

    @org.springframework.beans.factory.annotation.Autowired
    public PlatformAuthenticationService(JdbcTemplate jdbc, TimeProvider timeProvider, PlatformCommandReceiptService receipts, @Value("${platform.iam.rate-limit-hmac-secret:}") String rateLimitHmacSecret, @Value("${platform.otp.debug-code-exposure:false}") boolean debugCodeExposure) {
        this.jdbc = jdbc;
        this.timeProvider = timeProvider;
        this.receipts = receipts;
        if (rateLimitHmacSecret == null || rateLimitHmacSecret.isBlank()) throw new IllegalStateException("platform.iam.rate-limit-hmac-secret must be configured");
        this.rateLimitHmacSecret = rateLimitHmacSecret.getBytes(StandardCharsets.UTF_8);
        this.debugCodeExposure = debugCodeExposure;
    }

    /** Test-only compatibility constructor; production always supplies the configured HMAC secret. */
    public PlatformAuthenticationService(JdbcTemplate jdbc, TimeProvider timeProvider) { this(jdbc, timeProvider, new PlatformCommandReceiptService(jdbc, timeProvider), UUID.randomUUID().toString(), false); }

    /** Public OTP entry is mobile-bound; display-only mobile data is never read as identity. */
    @Transactional(noRollbackFor = OtpRateLimitedException.class)
    public OtpDispatch sendLoginOtp(String mobile, String sourceAddress) {
        String normalizedMobile = normalizedMobile(mobile);
        String mobileFingerprint = hmac("MOBILE:" + normalizedMobile);
        OtpAttempt attempt = beginOtpAttempt("PLATFORM_LOGIN_SEND", mobileFingerprint, sourceAddress);
        long now = timeProvider.currentEpochMillis();
        jdbc.update("UPDATE platform_iam.platform_otp_grant SET status='SUPERSEDED' WHERE purpose='PLATFORM_LOGIN' AND mobile_fingerprint=? AND status='ACTIVE'", mobileFingerprint);
        UUID administratorId = jdbc.query("SELECT id FROM platform_iam.platform_admin WHERE mobile_normalized=? AND status='ENABLED'", statement -> statement.setString(1, normalizedMobile), result -> result.next() ? result.getObject(1, UUID.class) : null);
        String code = newOtp();
        long expiresAt = Math.addExact(now, OTP_TTL_MILLIS);
        jdbc.update("INSERT INTO platform_iam.platform_otp_grant (id, purpose, platform_admin_id, mobile_fingerprint, token_hash, status, expires_at_epoch_millis, created_at_epoch_millis) VALUES (?, 'PLATFORM_LOGIN', ?, ?, ?, 'ACTIVE', ?, ?)", UUID.randomUUID(), administratorId, mobileFingerprint, hash(code), expiresAt, now);
        recordOtpAttempt("PLATFORM_LOGIN_SEND", attempt, OTP_SEND_LIMIT);
        return new OtpDispatch(expiresAt, debugCodeExposure ? code : null);
    }

    @Transactional(noRollbackFor = {OtpInvalidException.class, OtpRateLimitedException.class})
    public LoginResult verifyLoginOtp(String mobile, String code, String sourceAddress) {
        String normalizedMobile = normalizedMobile(mobile);
        String mobileFingerprint = hmac("MOBILE:" + normalizedMobile);
        OtpAttempt attempt = beginOtpAttempt("PLATFORM_LOGIN_VERIFY", mobileFingerprint, sourceAddress);
        long now = timeProvider.currentEpochMillis();
        UUID administratorId = jdbc.query("SELECT platform_admin_id FROM platform_iam.platform_otp_grant WHERE purpose='PLATFORM_LOGIN' AND mobile_fingerprint=? AND token_hash=? AND status='ACTIVE' AND expires_at_epoch_millis>? FOR UPDATE", statement -> { statement.setString(1, mobileFingerprint); statement.setString(2, hash(code == null ? "" : code)); statement.setLong(3, now); }, result -> result.next() ? result.getObject(1, UUID.class) : null);
        if (administratorId == null || jdbc.update("UPDATE platform_iam.platform_otp_grant SET status='USED', used_at_epoch_millis=? WHERE purpose='PLATFORM_LOGIN' AND mobile_fingerprint=? AND token_hash=? AND status='ACTIVE'", now, mobileFingerprint, hash(code == null ? "" : code)) != 1) {
            jdbc.update("UPDATE platform_iam.platform_otp_grant SET attempt_count=attempt_count+1 WHERE purpose='PLATFORM_LOGIN' AND mobile_fingerprint=? AND status='ACTIVE'", mobileFingerprint);
            recordOtpAttempt("PLATFORM_LOGIN_VERIFY", attempt, OTP_VERIFY_LIMIT);
            throw new OtpInvalidException();
        }
        CredentialRow credential = jdbc.query("SELECT a.id, a.display_name, a.status, c.password_hash, c.locked_until_epoch_millis FROM platform_iam.platform_admin a JOIN platform_iam.platform_credential c ON c.platform_admin_id=a.id WHERE a.id=? AND a.mobile_normalized=?", statement -> { statement.setObject(1, administratorId); statement.setString(2, normalizedMobile); }, result -> result.next() ? new CredentialRow(result.getObject("id", UUID.class), result.getString("display_name"), result.getString("status"), result.getString("password_hash"), result.getObject("locked_until_epoch_millis", Long.class)) : null);
        if (credential == null || !"ENABLED".equals(credential.status)) {
            recordOtpAttempt("PLATFORM_LOGIN_VERIFY", attempt, OTP_VERIFY_LIMIT);
            throw new OtpInvalidException();
        }
        clearOtpAttempts("PLATFORM_LOGIN_VERIFY", attempt);
        return createSession(credential.platformAdminId, credential.displayName, now);
    }

    @Transactional(noRollbackFor = OtpRateLimitedException.class)
    public RecoveryStart startPasswordRecovery(String loginName, String mobile, String sourceAddress) {
        String normalizedLoginName = normalize(loginName);
        String normalizedMobile = normalizedMobile(mobile);
        RecoveryStartAttempt attempt = beginRecoveryStartAttempt(normalizedLoginName, normalizedMobile, sourceAddress);
        long now = timeProvider.currentEpochMillis();
        UUID administratorId = jdbc.query("SELECT id FROM platform_iam.platform_admin WHERE login_name_normalized=? AND mobile_normalized=? AND status='ENABLED'", statement -> { statement.setString(1, normalizedLoginName); statement.setString(2, normalizedMobile); }, result -> result.next() ? result.getObject(1, UUID.class) : null);
        String token = newToken();
        jdbc.update("INSERT INTO platform_iam.platform_password_recovery_flow (id, token_hash, login_name_normalized, mobile_normalized, platform_admin_id, status, expires_at_epoch_millis, created_at_epoch_millis, version) VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?, 1)", UUID.randomUUID(), hash(token), normalizedLoginName, normalizedMobile, administratorId, Math.addExact(now, RECOVERY_FLOW_TTL_MILLIS), now);
        recordRecoveryStartAttempt(attempt);
        return new RecoveryStart(token);
    }

    @Transactional(noRollbackFor = OtpRateLimitedException.class)
    public RecoveryStart startPasswordRecovery(String loginName, String mobile) {
        return startPasswordRecovery(loginName, mobile, "legacy-test-source");
    }

    @Transactional(noRollbackFor = OtpRateLimitedException.class)
    public OtpDispatch sendPasswordRecoveryOtp(PasswordRecoveryFlowCredential recoveryFlow, String sourceAddress) {
        RecoveryFlow flow = requireRecoveryFlow(recoveryFlow.rawValue(), "PENDING");
        String mobileFingerprint = hmac("MOBILE:" + flow.mobileNormalized());
        OtpAttempt attempt = beginOtpAttempt("PLATFORM_RECOVERY_SEND", mobileFingerprint, sourceAddress);
        long now = timeProvider.currentEpochMillis();
        jdbc.update("UPDATE platform_iam.platform_otp_grant SET status='SUPERSEDED' WHERE purpose='PLATFORM_PASSWORD_RECOVERY' AND recovery_flow_id=? AND status='ACTIVE'", flow.id());
        String code = newOtp();
        long expiresAt = Math.addExact(now, OTP_TTL_MILLIS);
        jdbc.update("INSERT INTO platform_iam.platform_otp_grant (id, purpose, platform_admin_id, recovery_flow_id, mobile_fingerprint, token_hash, status, expires_at_epoch_millis, created_at_epoch_millis) VALUES (?, 'PLATFORM_PASSWORD_RECOVERY', ?, ?, ?, ?, 'ACTIVE', ?, ?)", UUID.randomUUID(), flow.platformAdminId(), flow.id(), mobileFingerprint, hash(code), expiresAt, now);
        recordOtpAttempt("PLATFORM_RECOVERY_SEND", attempt, OTP_SEND_LIMIT);
        return new OtpDispatch(expiresAt, debugCodeExposure ? code : null);
    }

    @Transactional(noRollbackFor = {OtpInvalidException.class, OtpRateLimitedException.class, RecoveryFlowInvalidException.class})
    public RecoveryVerification verifyPasswordRecoveryOtp(PasswordRecoveryFlowCredential recoveryFlow, String code, String sourceAddress) {
        RecoveryFlow flow = requireRecoveryFlow(recoveryFlow.rawValue(), "PENDING");
        String mobileFingerprint = hmac("MOBILE:" + flow.mobileNormalized());
        OtpAttempt attempt = beginOtpAttempt("PLATFORM_RECOVERY_VERIFY", mobileFingerprint, sourceAddress);
        long now = timeProvider.currentEpochMillis();
        int consumed = jdbc.update("UPDATE platform_iam.platform_otp_grant SET status='USED', used_at_epoch_millis=? WHERE purpose='PLATFORM_PASSWORD_RECOVERY' AND recovery_flow_id=? AND token_hash=? AND status='ACTIVE' AND expires_at_epoch_millis>?", now, flow.id(), hash(code == null ? "" : code), now);
        if (consumed != 1 || !recoveryIdentityStillEligible(flow)) {
            jdbc.update("UPDATE platform_iam.platform_otp_grant SET attempt_count=attempt_count+1 WHERE purpose='PLATFORM_PASSWORD_RECOVERY' AND recovery_flow_id=? AND status='ACTIVE'", flow.id());
            recordOtpAttempt("PLATFORM_RECOVERY_VERIFY", attempt, OTP_VERIFY_LIMIT);
            throw new OtpInvalidException();
        }
        if (jdbc.update("UPDATE platform_iam.platform_password_recovery_flow SET status='VERIFIED', verified_at_epoch_millis=?, version=version+1 WHERE id=? AND status='PENDING'", now, flow.id()) != 1) throw new RecoveryFlowInvalidException();
        clearOtpAttempts("PLATFORM_RECOVERY_VERIFY", attempt);
        return new RecoveryVerification("PASSWORD_REQUIRED");
    }

    @Transactional(noRollbackFor = RecoveryFlowInvalidException.class)
    public PasswordChangeResult completePasswordRecovery(PasswordRecoveryFlowCredential recoveryFlow, char[] newPassword) {
        if (newPassword == null || newPassword.length < 8) throw new InvalidAdministratorInputException();
        RecoveryFlow flow = requireRecoveryFlow(recoveryFlow.rawValue(), "VERIFIED");
        if (!recoveryIdentityStillEligible(flow) || flow.platformAdminId() == null) throw new RecoveryFlowInvalidException();
        long now = timeProvider.currentEpochMillis();
        jdbc.update("UPDATE platform_iam.platform_credential SET password_hash=?, changed_at_epoch_millis=?, failed_attempts=0, locked_until_epoch_millis=NULL, version=version+1 WHERE platform_admin_id=?", passwordEncoder.encode(new String(newPassword)), now, flow.platformAdminId());
        jdbc.update("UPDATE platform_iam.platform_session SET status='REVOKED', revoked_at_epoch_millis=?, version=version+1 WHERE platform_admin_id=? AND status='ACTIVE'", now, flow.platformAdminId());
        if (jdbc.update("UPDATE platform_iam.platform_password_recovery_flow SET status='COMPLETED', completed_at_epoch_millis=?, version=version+1 WHERE id=? AND status='VERIFIED'", now, flow.id()) != 1) throw new RecoveryFlowInvalidException();
        return new PasswordChangeResult("COMPLETED", true, true);
    }

    @Transactional(noRollbackFor = {InvalidCredentialsException.class, AccountDisabledException.class, CredentialLockedException.class, LoginRateLimitedException.class})
    public LoginResult login(String loginName, char[] password) {
        return login(loginName, password, "legacy-test-source");
    }

    /** Source address is converted to an owner-local HMAC before storage; raw source data never leaves the edge. */
    @Transactional(noRollbackFor = {InvalidCredentialsException.class, AccountDisabledException.class, CredentialLockedException.class, LoginRateLimitedException.class})
    public LoginResult login(String loginName, char[] password, String sourceAddress) {
        String normalized = normalize(loginName);
        LoginAttempt attempt = beginLoginAttempt(normalized, sourceAddress);
        Optional<CredentialRow> row = jdbc.query(
            "SELECT a.id, a.display_name, a.status, c.password_hash, c.locked_until_epoch_millis FROM platform_iam.platform_admin a JOIN platform_iam.platform_credential c ON c.platform_admin_id=a.id WHERE a.login_name_normalized=?",
            statement -> statement.setString(1, normalized),
            result -> result.next() ? Optional.of(new CredentialRow(result.getObject("id", UUID.class), result.getString("display_name"), result.getString("status"), result.getString("password_hash"), result.getObject("locked_until_epoch_millis", Long.class))) : Optional.empty()
        );
        if (row.isEmpty()) {
            recordInvalidLogin(attempt);
            throw new InvalidCredentialsException();
        }
        CredentialRow credential = row.get();
        long now = timeProvider.currentEpochMillis();
        if (!"ENABLED".equals(credential.status)) {
            recordSourceFailure(attempt);
            throw new AccountDisabledException();
        }
        if (credential.lockedUntilEpochMillis != null && credential.lockedUntilEpochMillis > now) throw new CredentialLockedException();
        if (!passwordEncoder.matches(new String(password == null ? new char[0] : password), credential.passwordHash)) {
            recordInvalidLogin(attempt);
            jdbc.update("UPDATE platform_iam.platform_credential SET failed_attempts=CASE WHEN locked_until_epoch_millis IS NOT NULL AND locked_until_epoch_millis<=? THEN 1 ELSE failed_attempts+1 END, locked_until_epoch_millis=CASE WHEN (CASE WHEN locked_until_epoch_millis IS NOT NULL AND locked_until_epoch_millis<=? THEN 1 ELSE failed_attempts+1 END)>=? THEN ? ELSE locked_until_epoch_millis END, version=version+1 WHERE platform_admin_id=?", now, now, CREDENTIAL_FAILURE_LIMIT, now + CREDENTIAL_LOCK_MILLIS, credential.platformAdminId);
            throw new InvalidCredentialsException();
        }
        clearAccountFailures(attempt);
        jdbc.update("UPDATE platform_iam.platform_credential SET failed_attempts=0, locked_until_epoch_millis=NULL, version=version+1 WHERE platform_admin_id=? AND (failed_attempts<>0 OR locked_until_epoch_millis IS NOT NULL)", credential.platformAdminId);
        return createSession(credential.platformAdminId, credential.displayName, now);
    }

    @Transactional(readOnly = true)
    public PlatformSessionReadback requireActiveSession(String token) {
        long now = timeProvider.currentEpochMillis();
        return jdbc.query(
            "SELECT s.id, s.version, a.id AS admin_id, a.display_name, s.expires_at_epoch_millis FROM platform_iam.platform_session s JOIN platform_iam.platform_admin a ON a.id=s.platform_admin_id WHERE s.token_hash=? AND s.status='ACTIVE' AND a.status='ENABLED' AND s.expires_at_epoch_millis>?",
            statement -> { statement.setString(1, hash(token)); statement.setLong(2, now); },
            result -> {
                if (!result.next()) throw new SessionExpiredException();
                return new PlatformSessionReadback(result.getObject("id", UUID.class), result.getLong("version"), result.getObject("admin_id", UUID.class), result.getString("display_name"), result.getLong("expires_at_epoch_millis"));
            }
        );
    }

    @Transactional
    public void logout(String token) {
        long now = timeProvider.currentEpochMillis();
        jdbc.update("UPDATE platform_iam.platform_session SET status='REVOKED', revoked_at_epoch_millis=?, version=version+1 WHERE token_hash=? AND status='ACTIVE'", now, hash(token));
    }

    /** Rotation revokes every session, including the caller, so a fresh login is mandatory. */
    @Transactional
    public PasswordChangeResult changeCurrentPassword(String token, char[] currentPassword, char[] newPassword, long expectedSessionVersion) {
        if (newPassword == null || newPassword.length < 8) throw new InvalidAdministratorInputException();
        SessionCredential session = jdbc.query("SELECT s.platform_admin_id, s.version, c.password_hash FROM platform_iam.platform_session s JOIN platform_iam.platform_credential c ON c.platform_admin_id=s.platform_admin_id WHERE s.token_hash=? AND s.status='ACTIVE' AND s.expires_at_epoch_millis>?", statement -> { statement.setString(1, hash(token)); statement.setLong(2, timeProvider.currentEpochMillis()); }, result -> {
            if (!result.next()) throw new SessionExpiredException();
            return new SessionCredential(result.getObject(1, UUID.class), result.getLong(2), result.getString(3));
        });
        if (session.version() != expectedSessionVersion) throw new PlatformAdminVersionConflictException();
        if (!passwordEncoder.matches(new String(currentPassword == null ? new char[0] : currentPassword), session.passwordHash())) throw new InvalidCredentialsException();
        long now = timeProvider.currentEpochMillis();
        jdbc.update("UPDATE platform_iam.platform_credential SET password_hash=?, changed_at_epoch_millis=?, version=version+1 WHERE platform_admin_id=?", passwordEncoder.encode(new String(newPassword)), now, session.adminId());
        jdbc.update("UPDATE platform_iam.platform_session SET status='REVOKED', revoked_at_epoch_millis=?, version=version+1 WHERE platform_admin_id=? AND status='ACTIVE'", now, session.adminId());
        return new PasswordChangeResult("COMPLETED", true, true);
    }

    /** Administrative reset is an explicit password replacement, never a secret readback. */
    @Transactional
    public PlatformAdminReadback resetAdministratorCredential(UUID adminId, char[] password, long expectedVersion) {
        return resetAdministratorCredential(adminId, password, expectedVersion, AuditActor.system());
    }

    @Transactional
    public PlatformAdminReadback resetAdministratorCredential(UUID adminId, char[] password, long expectedVersion, AuditActor actor) {
        requireEnabledPlatformAdministrator(actor);
        if (password == null || password.length < 8) throw new InvalidAdministratorInputException();
        long now = timeProvider.currentEpochMillis();
        if (jdbc.update("UPDATE platform_iam.platform_admin SET version=version+1, updated_at_epoch_millis=? WHERE id=? AND version=?", now, adminId, expectedVersion) != 1) throw new PlatformAdminVersionConflictException();
        jdbc.update("UPDATE platform_iam.platform_credential SET password_hash=?, changed_at_epoch_millis=?, version=version+1, failed_attempts=0, locked_until_epoch_millis=NULL WHERE platform_admin_id=?", passwordEncoder.encode(new String(password)), now, adminId);
        jdbc.update("UPDATE platform_iam.platform_session SET status='REVOKED', revoked_at_epoch_millis=?, version=version+1 WHERE platform_admin_id=? AND status='ACTIVE'", now, adminId);
        audit(adminId, "PLATFORM_ADMIN_CREDENTIAL_RESET", now, actor, ADMIN_CREDENTIAL_RESET.allow(List.of())); return requireAdministrator(adminId);
    }

    @Transactional
    public PlatformAdminReadback resetAdministratorCredential(UUID adminId, char[] password, long expectedVersion, String idempotencyKey) { return resetAdministratorCredential(adminId, password, expectedVersion, idempotencyKey, AuditActor.system()); }

    @Transactional
    public PlatformAdminReadback resetAdministratorCredential(UUID adminId, char[] password, long expectedVersion, String idempotencyKey, AuditActor actor) { requireEnabledPlatformAdministrator(actor); return receipts.execute(idempotencyKey, canonical("reset", adminId.toString(), String.valueOf(expectedVersion), hash(new String(password == null ? new char[0] : password))), () -> resetAdministratorCredential(adminId, password, expectedVersion, actor)); }

    /** Owner-bounded platform-administrator query; the edge never materializes or slices this population. */
    @Transactional(readOnly = true)
    public PlatformAdminPage pageAdministrators(String userName, String loginName, String status, int page, int pageSize, String sortKey, String sortDirection) {
        if (page < 1 || pageSize < 1 || pageSize > 100 || !validFilter(userName, 128) || !validFilter(loginName, 64)
            || (status != null && !Set.of("ENABLED", "DISABLED").contains(status))
            || !Set.of("USER_NAME", "LOGIN_NAME", "LAST_LOGIN_AT", "UPDATED_AT").contains(sortKey)
            || !Set.of("ASC", "DESC").contains(sortDirection)) throw new InvalidAdministratorInputException();
        String where = " WHERE (CAST(? AS text) IS NULL OR a.display_name ILIKE '%' || CAST(? AS text) || '%') AND (CAST(? AS text) IS NULL OR a.login_name ILIKE '%' || CAST(? AS text) || '%') AND (CAST(? AS text) IS NULL OR a.status=CAST(? AS text))";
        Object[] values = new Object[] {userName, userName, loginName, loginName, status, status};
        Long total = jdbc.queryForObject("SELECT COUNT(*) FROM platform_iam.platform_admin a" + where, Long.class, values);
        long offset;
        try { offset = Math.multiplyExact((long) page - 1, pageSize); } catch (ArithmeticException exception) { throw new InvalidAdministratorInputException(); }
        List<Object> pageValues = new java.util.ArrayList<>(java.util.Arrays.asList(values)); pageValues.add((long) pageSize); pageValues.add(offset);
        List<PlatformAdminReadback> items = jdbc.query(readbackSql(where + " ORDER BY " + administratorOrderBy(sortKey, sortDirection) + " LIMIT ? OFFSET ?"), (result, rowNumber) -> mapReadback(result), pageValues.toArray());
        return new PlatformAdminPage(items, page, pageSize, total == null ? 0L : total, sortKey, sortDirection);
    }

    @Transactional(readOnly = true)
    public PlatformAdminReadback requireAdministrator(UUID id) {
        return jdbc.query(readbackSql("WHERE a.id=?"), statement -> statement.setObject(1, id), result -> {
            if (!result.next()) throw new PlatformAdminNotFoundException();
            return mapReadback(result);
        });
    }

    @Transactional
    public PlatformAdminReadback transitionAdministratorStatus(UUID id, String targetStatus, long expectedVersion) {
        return transitionAdministratorStatus(id, targetStatus, expectedVersion, AuditActor.system());
    }

    @Transactional
    public PlatformAdminReadback transitionAdministratorStatus(UUID id, String targetStatus, long expectedVersion, AuditActor actor) {
        requireEnabledPlatformAdministrator(actor);
        if (!"ENABLED".equals(targetStatus) && !"DISABLED".equals(targetStatus)) throw new InvalidAdministratorStatusException();
        long now = timeProvider.currentEpochMillis();
        if ("DISABLED".equals(targetStatus)) requireDeactivationAllowed(id, actor);
        int changed = jdbc.update("UPDATE platform_iam.platform_admin SET status=?, version=version+1, updated_at_epoch_millis=? WHERE id=? AND version=?", targetStatus, now, id, expectedVersion);
        if (changed == 0) throw new PlatformAdminVersionConflictException();
        if ("DISABLED".equals(targetStatus)) jdbc.update("UPDATE platform_iam.platform_session SET status='REVOKED', revoked_at_epoch_millis=?, version=version+1 WHERE platform_admin_id=? AND status='ACTIVE'", now, id);
        audit(id, "PLATFORM_ADMIN_STATUS_CHANGED", now, actor, ADMIN_STATUS_CHANGED.allow(List.of(new AuditChange("status", null, targetStatus)))); return requireAdministrator(id);
    }

    @Transactional
    public PlatformAdminReadback transitionAdministratorStatus(UUID id, String targetStatus, long expectedVersion, String idempotencyKey) { return transitionAdministratorStatus(id, targetStatus, expectedVersion, idempotencyKey, AuditActor.system()); }

    @Transactional
    public PlatformAdminReadback transitionAdministratorStatus(UUID id, String targetStatus, long expectedVersion, String idempotencyKey, AuditActor actor) { requireEnabledPlatformAdministrator(actor); return receipts.execute(idempotencyKey, canonical("status", id.toString(), targetStatus, String.valueOf(expectedVersion)), () -> transitionAdministratorStatus(id, targetStatus, expectedVersion, actor)); }

    @Transactional
    public PlatformAdminReadback createAdministrator(String loginName, String displayName, String mobile, char[] initialPassword) {
        return createAdministrator(loginName, displayName, mobile, initialPassword, AuditActor.system());
    }

    @Transactional
    public PlatformAdminReadback createAdministrator(String loginName, String displayName, String mobile, char[] initialPassword, AuditActor actor) {
        requireEnabledPlatformAdministrator(actor);
        String normalized = normalize(loginName);
        if (displayName == null || displayName.trim().isEmpty() || initialPassword == null || initialPassword.length < 8) throw new InvalidAdministratorInputException();
        UUID id = UUID.randomUUID();
        long now = timeProvider.currentEpochMillis();
        try {
            String displayMobile = optionalMobile(mobile);
            jdbc.update("INSERT INTO platform_iam.platform_admin (id, login_name, login_name_normalized, display_name, mobile_mask_source, mobile_normalized, status, version, created_at_epoch_millis, updated_at_epoch_millis) VALUES (?, ?, ?, ?, ?, ?, 'ENABLED', 1, ?, ?)", id, loginName.trim(), normalized, displayName.trim(), displayMobile, displayMobile == null ? null : normalizedMobile(displayMobile), now, now);
            jdbc.update("INSERT INTO platform_iam.platform_credential (platform_admin_id, password_hash, algorithm, changed_at_epoch_millis, version) VALUES (?, ?, 'bcrypt', ?, 1)", id, passwordEncoder.encode(new String(initialPassword)), now);
        } catch (org.springframework.dao.DuplicateKeyException exception) { throw new LoginNameConflictException(); }
        audit(id, "PLATFORM_ADMIN_CREATED", now, actor, ADMIN_CREATED.allow(List.of(new AuditChange("displayName", null, displayName.trim())))); return requireAdministrator(id);
    }

    @Transactional
    public PlatformAdminReadback createAdministrator(String loginName, String displayName, String mobile, char[] initialPassword, String idempotencyKey) { return createAdministrator(loginName, displayName, mobile, initialPassword, idempotencyKey, AuditActor.system()); }

    @Transactional
    public PlatformAdminReadback createAdministrator(String loginName, String displayName, String mobile, char[] initialPassword, String idempotencyKey, AuditActor actor) { requireEnabledPlatformAdministrator(actor); return receipts.execute(idempotencyKey, canonical("create", loginName, displayName, mobile, hash(new String(initialPassword == null ? new char[0] : initialPassword))), () -> createAdministrator(loginName, displayName, mobile, initialPassword, actor)); }

    @Transactional
    public PlatformAdminReadback createAdministrator(String loginName, String displayName, char[] initialPassword) { return createAdministrator(loginName, displayName, null, initialPassword); }

    @Transactional
    public PlatformAdminReadback updateAdministratorProfile(UUID id, String displayName, String mobile, long expectedVersion) {
        return updateAdministratorProfile(id, displayName, mobile, expectedVersion, AuditActor.system());
    }

    @Transactional
    public PlatformAdminReadback updateAdministratorProfile(UUID id, String displayName, String mobile, long expectedVersion, AuditActor actor) {
        requireEnabledPlatformAdministrator(actor);
        if (displayName == null || displayName.trim().isEmpty()) throw new InvalidAdministratorInputException();
        long now = timeProvider.currentEpochMillis();
        String displayMobile = optionalMobile(mobile);
        int changed = jdbc.update("UPDATE platform_iam.platform_admin SET display_name=?, mobile_mask_source=?, mobile_normalized=?, version=version+1, updated_at_epoch_millis=? WHERE id=? AND version=?", displayName.trim(), displayMobile, displayMobile == null ? null : normalizedMobile(displayMobile), now, id, expectedVersion);
        if (changed == 0) throw new PlatformAdminVersionConflictException();
        audit(id, "PLATFORM_ADMIN_PROFILE_UPDATED", now, actor, ADMIN_PROFILE_UPDATED.allow(List.of(new AuditChange("displayName", null, displayName.trim())))); return requireAdministrator(id);
    }

    @Transactional
    public PlatformAdminReadback updateAdministratorProfile(UUID id, String displayName, String mobile, long expectedVersion, String idempotencyKey) { return updateAdministratorProfile(id, displayName, mobile, expectedVersion, idempotencyKey, AuditActor.system()); }

    @Transactional
    public PlatformAdminReadback updateAdministratorProfile(UUID id, String displayName, String mobile, long expectedVersion, String idempotencyKey, AuditActor actor) { requireEnabledPlatformAdministrator(actor); return receipts.execute(idempotencyKey, canonical("profile", id.toString(), displayName, mobile, String.valueOf(expectedVersion)), () -> updateAdministratorProfile(id, displayName, mobile, expectedVersion, actor)); }

    @Transactional
    public PlatformAdminReadback updateAdministratorProfile(UUID id, String displayName, long expectedVersion) {
        if (displayName == null || displayName.trim().isEmpty()) throw new InvalidAdministratorInputException();
        long now = timeProvider.currentEpochMillis();
        if (jdbc.update("UPDATE platform_iam.platform_admin SET display_name=?, version=version+1, updated_at_epoch_millis=? WHERE id=? AND version=?", displayName.trim(), now, id, expectedVersion) != 1) throw new PlatformAdminVersionConflictException();
        audit(id, "PLATFORM_ADMIN_PROFILE_UPDATED", now, AuditActor.system(), ADMIN_PROFILE_UPDATED.allow(List.of(new AuditChange("displayName", null, displayName.trim()))));
        return requireAdministrator(id);
    }

    private static String normalize(String loginName) {
        if (loginName == null || loginName.trim().isEmpty()) throw new InvalidCredentialsException();
        return loginName.trim().toLowerCase(java.util.Locale.ROOT);
    }
    /** Frozen P6-2 model: every enabled platform administrator is a platform super-administrator. */
    @Transactional(readOnly = true)
    @Override
    public void requireEnabledPlatformAdministrator(AuditActor actor) {
        if (actor != null && "SYSTEM".equals(actor.actorType())) return;
        if (actor == null || !"PLATFORM_ADMIN".equals(actor.actorType()) || !Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM platform_iam.platform_admin WHERE id=? AND status='ENABLED')", Boolean.class, actor.actorId()))) throw new AccountDisabledException();
    }
    private static boolean validFilter(String value, int maximumLength) { return value == null || value.length() <= maximumLength; }
    private static String administratorOrderBy(String sortKey, String sortDirection) {
        String field = switch (sortKey) {
            case "USER_NAME" -> "a.display_name";
            case "LOGIN_NAME" -> "a.login_name_normalized";
            case "LAST_LOGIN_AT" -> "last_login_at";
            case "UPDATED_AT" -> "a.updated_at_epoch_millis";
            default -> throw new InvalidAdministratorInputException();
        };
        return field + ' ' + sortDirection + ", a.id ASC";
    }
    private static String canonical(String operation, String... values) { StringBuilder value = new StringBuilder(operation); for (String item : values) { String safe = item == null ? "<null>" : item; value.append('|').append(safe.length()).append(':').append(safe); } return value.toString(); }
    private static String optionalMobile(String value) { if (value != null && value.length() > 32) throw new InvalidAdministratorInputException(); return value == null || value.isBlank() ? null : value.trim(); }
    private static String normalizedMobile(String value) {
        String normalized = value == null ? "" : value.replace(" ", "").replace("-", "");
        if (!normalized.matches("^\\+?[0-9]{8,20}$")) throw new InvalidAdministratorInputException();
        return normalized.startsWith("+") ? normalized.substring(1) : normalized;
    }
    private LoginResult createSession(UUID administratorId, String displayName, long now) {
        UUID sessionId = UUID.randomUUID();
        String token = newToken();
        long expiresAt = Math.addExact(now, SESSION_TTL_MILLIS);
        jdbc.update("INSERT INTO platform_iam.platform_session (id, platform_admin_id, token_hash, status, expires_at_epoch_millis, created_at_epoch_millis, last_seen_at_epoch_millis, version) VALUES (?, ?, ?, 'ACTIVE', ?, ?, ?, 1)", sessionId, administratorId, hash(token), expiresAt, now, now);
        return new LoginResult(token, new PlatformSessionReadback(sessionId, 1L, administratorId, displayName, expiresAt));
    }
    private RecoveryFlow requireRecoveryFlow(String rawToken, String status) {
        long now = timeProvider.currentEpochMillis();
        return jdbc.query("SELECT id, login_name_normalized, mobile_normalized, platform_admin_id, status, expires_at_epoch_millis FROM platform_iam.platform_password_recovery_flow WHERE token_hash=? FOR UPDATE", statement -> statement.setString(1, hash(rawToken == null ? "" : rawToken)), result -> {
            if (!result.next() || !status.equals(result.getString("status")) || result.getLong("expires_at_epoch_millis") <= now) throw new RecoveryFlowInvalidException();
            return new RecoveryFlow(result.getObject("id", UUID.class), result.getString("login_name_normalized"), result.getString("mobile_normalized"), result.getObject("platform_admin_id", UUID.class));
        });
    }
    private boolean recoveryIdentityStillEligible(RecoveryFlow flow) {
        if (flow.platformAdminId() == null) return false;
        Boolean present = jdbc.query("SELECT TRUE FROM platform_iam.platform_admin WHERE id=? AND login_name_normalized=? AND mobile_normalized=? AND status='ENABLED'", statement -> { statement.setObject(1, flow.platformAdminId()); statement.setString(2, flow.loginNameNormalized()); statement.setString(3, flow.mobileNormalized()); }, result -> result.next() ? Boolean.TRUE : Boolean.FALSE);
        return Boolean.TRUE.equals(present);
    }
    private OtpAttempt beginOtpAttempt(String purpose, String mobileFingerprint, String sourceAddress) {
        String sourceFingerprint = hmac("SOURCE:" + (sourceAddress == null || sourceAddress.isBlank() ? "unknown" : sourceAddress));
        lockRateBucket(purpose + ":MOBILE", mobileFingerprint); lockRateBucket(purpose + ":SOURCE", sourceFingerprint);
        long now = timeProvider.currentEpochMillis();
        requireOtpRateBucketOpen(purpose, "MOBILE", mobileFingerprint, now); requireOtpRateBucketOpen(purpose, "SOURCE", sourceFingerprint, now);
        return new OtpAttempt(mobileFingerprint, sourceFingerprint);
    }
    private RecoveryStartAttempt beginRecoveryStartAttempt(String normalizedLoginName, String normalizedMobile, String sourceAddress) {
        String accountFingerprint = hmac("ACCOUNT:" + normalizedLoginName);
        String mobileFingerprint = hmac("MOBILE:" + normalizedMobile);
        String sourceFingerprint = hmac("SOURCE:" + (sourceAddress == null || sourceAddress.isBlank() ? "unknown" : sourceAddress));
        lockRateBucket("PLATFORM_RECOVERY_START:ACCOUNT", accountFingerprint); lockRateBucket("PLATFORM_RECOVERY_START:MOBILE", mobileFingerprint); lockRateBucket("PLATFORM_RECOVERY_START:SOURCE", sourceFingerprint);
        long now = timeProvider.currentEpochMillis();
        requireOtpRateBucketOpen("PLATFORM_RECOVERY_START", "ACCOUNT", accountFingerprint, now); requireOtpRateBucketOpen("PLATFORM_RECOVERY_START", "MOBILE", mobileFingerprint, now); requireOtpRateBucketOpen("PLATFORM_RECOVERY_START", "SOURCE", sourceFingerprint, now);
        return new RecoveryStartAttempt(accountFingerprint, mobileFingerprint, sourceFingerprint);
    }
    private void requireOtpRateBucketOpen(String purpose, String dimension, String fingerprint, long now) {
        Long lockedUntil = jdbc.query("SELECT locked_until_epoch_millis FROM platform_iam.platform_public_otp_rate_limit_bucket WHERE purpose=? AND dimension=? AND fingerprint=?", statement -> { statement.setString(1, purpose); statement.setString(2, dimension); statement.setString(3, fingerprint); }, result -> result.next() ? result.getObject(1, Long.class) : null);
        if (lockedUntil != null && lockedUntil > now) throw new OtpRateLimitedException();
    }
    private void recordOtpAttempt(String purpose, OtpAttempt attempt, int threshold) {
        recordOtpRateFailure(purpose, "MOBILE", attempt.mobileFingerprint(), threshold, ACCOUNT_FAILURE_WINDOW_MILLIS, CREDENTIAL_LOCK_MILLIS);
        recordOtpRateFailure(purpose, "SOURCE", attempt.sourceFingerprint(), threshold, SOURCE_FAILURE_WINDOW_MILLIS, SOURCE_LOCK_MILLIS);
    }
    private void clearOtpAttempts(String purpose, OtpAttempt attempt) {
        jdbc.update("DELETE FROM platform_iam.platform_public_otp_rate_limit_bucket WHERE purpose=? AND dimension=? AND fingerprint=?", purpose, "MOBILE", attempt.mobileFingerprint());
        jdbc.update("DELETE FROM platform_iam.platform_public_otp_rate_limit_bucket WHERE purpose=? AND dimension=? AND fingerprint=?", purpose, "SOURCE", attempt.sourceFingerprint());
    }
    private void recordRecoveryStartAttempt(RecoveryStartAttempt attempt) {
        recordOtpRateFailure("PLATFORM_RECOVERY_START", "ACCOUNT", attempt.accountFingerprint(), OTP_SEND_LIMIT, ACCOUNT_FAILURE_WINDOW_MILLIS, CREDENTIAL_LOCK_MILLIS);
        recordOtpRateFailure("PLATFORM_RECOVERY_START", "MOBILE", attempt.mobileFingerprint(), OTP_SEND_LIMIT, ACCOUNT_FAILURE_WINDOW_MILLIS, CREDENTIAL_LOCK_MILLIS);
        recordOtpRateFailure("PLATFORM_RECOVERY_START", "SOURCE", attempt.sourceFingerprint(), OTP_SEND_LIMIT, SOURCE_FAILURE_WINDOW_MILLIS, SOURCE_LOCK_MILLIS);
    }
    private void recordOtpRateFailure(String purpose, String dimension, String fingerprint, int threshold, long windowMillis, long lockMillis) {
        long now = timeProvider.currentEpochMillis();
        RateBucket current = jdbc.query("SELECT window_started_at_epoch_millis, failed_attempts FROM platform_iam.platform_public_otp_rate_limit_bucket WHERE purpose=? AND dimension=? AND fingerprint=?", statement -> { statement.setString(1, purpose); statement.setString(2, dimension); statement.setString(3, fingerprint); }, result -> result.next() ? new RateBucket(result.getLong(1), result.getInt(2)) : null);
        boolean resetWindow = current == null || now - current.windowStartedAtEpochMillis() >= windowMillis;
        long startedAt = resetWindow ? now : current.windowStartedAtEpochMillis();
        int failures = resetWindow ? 1 : current.failedAttempts() + 1;
        Long lockedUntil = failures >= threshold ? now + lockMillis : null;
        jdbc.update("INSERT INTO platform_iam.platform_public_otp_rate_limit_bucket (purpose, dimension, fingerprint, window_started_at_epoch_millis, failed_attempts, locked_until_epoch_millis, updated_at_epoch_millis) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (purpose, dimension, fingerprint) DO UPDATE SET window_started_at_epoch_millis=EXCLUDED.window_started_at_epoch_millis, failed_attempts=EXCLUDED.failed_attempts, locked_until_epoch_millis=EXCLUDED.locked_until_epoch_millis, updated_at_epoch_millis=EXCLUDED.updated_at_epoch_millis", purpose, dimension, fingerprint, startedAt, failures, lockedUntil, now);
    }
    private LoginAttempt beginLoginAttempt(String normalizedAccount, String sourceAddress) {
        String accountFingerprint = hmac("ACCOUNT:" + normalizedAccount);
        String sourceFingerprint = hmac("SOURCE:" + (sourceAddress == null || sourceAddress.isBlank() ? "unknown" : sourceAddress));
        lockRateBucket("ACCOUNT", accountFingerprint); lockRateBucket("SOURCE", sourceFingerprint);
        long now = timeProvider.currentEpochMillis();
        requireRateBucketOpen("ACCOUNT", accountFingerprint, now); requireRateBucketOpen("SOURCE", sourceFingerprint, now);
        return new LoginAttempt(accountFingerprint, sourceFingerprint);
    }
    private void lockRateBucket(String dimension, String fingerprint) { jdbc.queryForList("SELECT pg_advisory_xact_lock(hashtext(?))", dimension + ':' + fingerprint); }
    private void requireRateBucketOpen(String dimension, String fingerprint, long now) {
        Long lockedUntil = jdbc.query("SELECT locked_until_epoch_millis FROM platform_iam.platform_login_rate_limit_bucket WHERE dimension=? AND fingerprint=?", statement -> { statement.setString(1, dimension); statement.setString(2, fingerprint); }, result -> result.next() ? result.getObject(1, Long.class) : null);
        if (lockedUntil != null && lockedUntil > now) throw new LoginRateLimitedException();
    }
    private void recordInvalidLogin(LoginAttempt attempt) { recordRateFailure("ACCOUNT", attempt.accountFingerprint(), CREDENTIAL_FAILURE_LIMIT, ACCOUNT_FAILURE_WINDOW_MILLIS, CREDENTIAL_LOCK_MILLIS); recordRateFailure("SOURCE", attempt.sourceFingerprint(), SOURCE_FAILURE_LIMIT, SOURCE_FAILURE_WINDOW_MILLIS, SOURCE_LOCK_MILLIS); }
    private void recordSourceFailure(LoginAttempt attempt) { recordRateFailure("SOURCE", attempt.sourceFingerprint(), SOURCE_FAILURE_LIMIT, SOURCE_FAILURE_WINDOW_MILLIS, SOURCE_LOCK_MILLIS); }
    private void recordRateFailure(String dimension, String fingerprint, int threshold, long windowMillis, long lockMillis) {
        long now = timeProvider.currentEpochMillis();
        RateBucket current = jdbc.query("SELECT window_started_at_epoch_millis, failed_attempts FROM platform_iam.platform_login_rate_limit_bucket WHERE dimension=? AND fingerprint=?", statement -> { statement.setString(1, dimension); statement.setString(2, fingerprint); }, result -> result.next() ? new RateBucket(result.getLong(1), result.getInt(2)) : null);
        boolean resetWindow = current == null || now - current.windowStartedAtEpochMillis() >= windowMillis;
        long startedAt = resetWindow ? now : current.windowStartedAtEpochMillis();
        int failures = resetWindow ? 1 : current.failedAttempts() + 1;
        Long lockedUntil = failures >= threshold ? now + lockMillis : null;
        jdbc.update("INSERT INTO platform_iam.platform_login_rate_limit_bucket (dimension, fingerprint, window_started_at_epoch_millis, failed_attempts, locked_until_epoch_millis, updated_at_epoch_millis) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (dimension, fingerprint) DO UPDATE SET window_started_at_epoch_millis=EXCLUDED.window_started_at_epoch_millis, failed_attempts=EXCLUDED.failed_attempts, locked_until_epoch_millis=EXCLUDED.locked_until_epoch_millis, updated_at_epoch_millis=EXCLUDED.updated_at_epoch_millis", dimension, fingerprint, startedAt, failures, lockedUntil, now);
    }
    private void clearAccountFailures(LoginAttempt attempt) { jdbc.update("DELETE FROM platform_iam.platform_login_rate_limit_bucket WHERE dimension='ACCOUNT' AND fingerprint=?", attempt.accountFingerprint()); }
    private String hmac(String value) { try { Mac mac = Mac.getInstance("HmacSHA256"); mac.init(new SecretKeySpec(rateLimitHmacSecret, "HmacSHA256")); return java.util.HexFormat.of().formatHex(mac.doFinal(value.getBytes(StandardCharsets.UTF_8))); } catch (Exception error) { throw new IllegalStateException("HMAC-SHA256 unavailable", error); } }
    private void requireDeactivationAllowed(UUID id, AuditActor actor) {
        // The count predicate spans every platform administrator, so serialize it with a
        // single owner-local transaction advisory lock before inspecting the target.
        jdbc.queryForList("SELECT pg_advisory_xact_lock(hashtext(?))", "platform-iam:last-enabled-administrator");
        AdminGuard guard = jdbc.query("SELECT is_builtin, status FROM platform_iam.platform_admin WHERE id=? FOR UPDATE", statement -> statement.setObject(1, id), result -> { if (!result.next()) throw new PlatformAdminNotFoundException(); return new AdminGuard(result.getBoolean(1), result.getString(2)); });
        if (guard.builtIn() || (actor != null && id.equals(actor.actorId()))) throw new AdministratorDeactivationForbiddenException();
        Long activeCount = jdbc.queryForObject("SELECT count(*) FROM platform_iam.platform_admin WHERE status='ENABLED'", Long.class);
        if ("ENABLED".equals(guard.status()) && activeCount != null && activeCount <= 1) throw new AdministratorDeactivationForbiddenException();
    }
    private void audit(UUID subjectRef, String action, long now, AuditActor actor, List<AuditChange> changes) {
        jdbc.update("INSERT INTO platform_iam.audit_event (id, entity_type, entity_ref_text, actor_type, actor_id, actor_display_snapshot, action, occurred_at_epoch_millis, changes_json) VALUES (?, 'PLATFORM_ADMIN', ?, ?, ?, ?, ?, ?, CAST(? AS JSONB))", UUID.randomUUID(), subjectRef.toString(), actor.actorType(), actor.actorId(), actor.displaySnapshot(), action, now, json(changes));
    }
    private static String json(List<AuditChange> changes) { StringBuilder value = new StringBuilder("["); for (int index = 0; index < changes.size(); index++) { if (index > 0) value.append(','); AuditChange change = changes.get(index); value.append("{\"fieldKey\":\"").append(escape(change.fieldKey())).append("\""); if (change.beforeValue() != null) value.append(",\"before\":\"").append(escape(change.beforeValue())).append("\""); if (change.afterValue() != null) value.append(",\"after\":\"").append(escape(change.afterValue())).append("\""); value.append('}'); } return value.append(']').toString(); }
    private static String escape(String value) { return value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r"); }
    private static String readbackSql(String suffix) { return """
        SELECT a.id, a.login_name, a.display_name, a.mobile_mask_source, a.status, a.is_builtin, a.version, a.created_at_epoch_millis, a.updated_at_epoch_millis,
               (SELECT max(coalesce(s.last_seen_at_epoch_millis, s.created_at_epoch_millis)) FROM platform_iam.platform_session s WHERE s.platform_admin_id=a.id) AS last_login_at,
               coalesce((SELECT p.action FROM platform_iam.audit_event p WHERE p.entity_type='PLATFORM_ADMIN' AND p.entity_ref_text=a.id::text ORDER BY p.occurred_at_epoch_millis DESC, p.id DESC LIMIT 1), 'NO_ADMIN_AUDIT_EVENT') AS audit_summary
          FROM platform_iam.platform_admin a
        """ + suffix; }
    private static PlatformAdminReadback mapReadback(java.sql.ResultSet result) throws java.sql.SQLException { return new PlatformAdminReadback(result.getObject("id", UUID.class), result.getString("login_name"), result.getString("display_name"), result.getString("mobile_mask_source"), result.getString("status"), result.getBoolean("is_builtin"), result.getLong("version"), result.getLong("created_at_epoch_millis"), result.getLong("updated_at_epoch_millis"), result.getObject("last_login_at", Long.class), result.getString("audit_summary")); }

    private String newToken() { byte[] bytes = new byte[32]; secureRandom.nextBytes(bytes); return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes); }
    private String newOtp() { return String.format("%06d", secureRandom.nextInt(1_000_000)); }
    private static String hash(String value) {
        try { return java.util.HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch (Exception exception) { throw new IllegalStateException("SHA-256 unavailable", exception); }
    }
    private record CredentialRow(UUID platformAdminId, String displayName, String status, String passwordHash, Long lockedUntilEpochMillis) { }
    private record LoginAttempt(String accountFingerprint, String sourceFingerprint) { }
    private record RateBucket(long windowStartedAtEpochMillis, int failedAttempts) { }
    private record AdminGuard(boolean builtIn, String status) { }
    private record SessionCredential(UUID adminId, long version, String passwordHash) { }
    private record OtpAttempt(String mobileFingerprint, String sourceFingerprint) { }
    private record RecoveryStartAttempt(String accountFingerprint, String mobileFingerprint, String sourceFingerprint) { }
    private record RecoveryFlow(UUID id, String loginNameNormalized, String mobileNormalized, UUID platformAdminId) { }
    public record LoginResult(String rawSessionToken, PlatformSessionReadback session) { }
    public record OtpDispatch(long expiresAt, String debugVerificationCode) { }
    public record RecoveryStart(String rawFlowToken) { }
    public record RecoveryVerification(String status) { }
    public record PlatformAdminReadback(UUID id, String loginName, String displayName, String mobile, String status, boolean builtIn, long version, long createdAtEpochMillis, long updatedAtEpochMillis, Long lastLoginAtEpochMillis, String auditSummary) { }
    public record PlatformAdminPage(List<PlatformAdminReadback> items, int page, int pageSize, long total, String sortKey, String sortDirection) { }
    public record PasswordChangeResult(String status, boolean sessionsRevoked, boolean reauthenticationRequired) { }
    public static final class InvalidCredentialsException extends RuntimeException { }
    public static final class AccountDisabledException extends RuntimeException { }
    public static final class CredentialLockedException extends RuntimeException { }
    public static final class SessionExpiredException extends RuntimeException { }
    public static final class PlatformAdminNotFoundException extends RuntimeException { }
    public static final class PlatformAdminVersionConflictException extends RuntimeException { }
    public static final class InvalidAdministratorStatusException extends RuntimeException { }
    public static final class InvalidAdministratorInputException extends RuntimeException { }
    public static final class LoginNameConflictException extends RuntimeException { }
    public static final class LoginRateLimitedException extends RuntimeException { }
    public static final class OtpRateLimitedException extends RuntimeException { }
    public static final class OtpInvalidException extends RuntimeException { }
    public static final class RecoveryFlowInvalidException extends RuntimeException { }
    public static final class AdministratorDeactivationForbiddenException extends RuntimeException { }
    /** Opaque browser recovery credential; only this owner service can read the raw value. */
    public static final class PasswordRecoveryFlowCredential {
        private final String value;
        private PasswordRecoveryFlowCredential(String value) { this.value = value; }
        public static PasswordRecoveryFlowCredential fromEdgeCookie(String value) { return new PasswordRecoveryFlowCredential(value); }
        String rawValue() { return value; }
        @Override public String toString() { return "PasswordRecoveryFlowCredential[redacted]"; }
    }
}
