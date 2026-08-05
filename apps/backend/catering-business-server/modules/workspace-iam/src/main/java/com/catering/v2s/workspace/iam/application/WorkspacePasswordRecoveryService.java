package com.catering.v2s.workspace.iam.application;

import com.catering.v2s.organization.api.WorkspaceStatusLookup;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.HexFormat;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Anonymous operations-password recovery is deliberately separate from the
 * administrator-issued reset-generation flow. Its opaque flow and completion
 * grant are owner secrets; public callers receive neither in a response body.
 */
@Service
public class WorkspacePasswordRecoveryService {
    private static final long FLOW_TTL_MILLIS = 30 * 60 * 1000L;
    private static final long OTP_TTL_MILLIS = 5 * 60 * 1000L;
    private static final long GRANT_TTL_MILLIS = 15 * 60 * 1000L;
    private final JdbcTemplate jdbc;
    private final TimeProvider time;
    private final WorkspaceOtpRateLimitService otpLimits;
    private final WorkspaceLoginRateLimitService recoveryLimits;
    private final WorkspaceStatusLookup workspaces;
    private final boolean debugCodeExposure;
    private final SecureRandom random = new SecureRandom();
    private final BCryptPasswordEncoder passwords = new BCryptPasswordEncoder();

    /** Compatibility constructor for focused owner tests; production injects all guards. */
    public WorkspacePasswordRecoveryService(JdbcTemplate jdbc, TimeProvider time) {
        this(jdbc, time, new WorkspaceOtpRateLimitService(jdbc, time), new WorkspaceLoginRateLimitService(jdbc, time), (workspaceUuid, groupWorkspaceKey) -> true, new com.catering.v2s.platform.foundation.security.OtpDebugExposurePolicy("", false));
    }

    @org.springframework.beans.factory.annotation.Autowired
    public WorkspacePasswordRecoveryService(
        JdbcTemplate jdbc,
        TimeProvider time,
        WorkspaceOtpRateLimitService otpLimits,
        WorkspaceLoginRateLimitService recoveryLimits,
        WorkspaceStatusLookup workspaces,
        com.catering.v2s.platform.foundation.security.OtpDebugExposurePolicy otpDebugExposurePolicy
    ) {
        this.jdbc = jdbc;
        this.time = time;
        this.otpLimits = otpLimits;
        this.recoveryLimits = recoveryLimits;
        this.workspaces = workspaces;
        this.debugCodeExposure = otpDebugExposurePolicy.enabled();
    }

    @Transactional(noRollbackFor = WorkspaceAuthenticationService.LoginRateLimitedException.class)
    public StartResult start(UUID workspaceUuid, String groupWorkspaceKey, String loginName, String mobile, String sourceAddress) {
        String normalizedLoginName = normalizedLoginName(loginName);
        String normalizedMobile = normalizedMobile(mobile);
        WorkspaceLoginRateLimitService.Attempt attempt = recoveryLimits.beginPasswordRecovery(groupWorkspaceKey, normalizedLoginName, normalizedMobile, sourceAddress);
        // Apply the same source guard before any account lookup result can influence later work.
        recoveryLimits.recordPasswordRecoveryStart(groupWorkspaceKey, attempt);
        Account account = workspaces.isEnabled(workspaceUuid, groupWorkspaceKey)
            ? matchingEnabledAccount(workspaceUuid, groupWorkspaceKey, normalizedLoginName, normalizedMobile)
            : null;
        long now = time.currentEpochMillis();
        if (account != null) {
            jdbc.update("UPDATE workspace_iam.operations_password_recovery SET status='SUPERSEDED', version=version+1 WHERE account_id=? AND status IN ('PENDING','OTP_VERIFIED')", account.id());
        }
        UUID recoveryId = UUID.randomUUID();
        String rawFlow = secret();
        long expiresAt = now + FLOW_TTL_MILLIS;
        jdbc.update("INSERT INTO workspace_iam.operations_password_recovery (id, workspace_uuid, group_workspace_key, account_id, flow_token_hash, status, expires_at_epoch_millis, version, created_at_epoch_millis) VALUES (?, ?, ?, ?, ?, 'PENDING', ?, 1, ?)", recoveryId, workspaceUuid, groupWorkspaceKey, account == null ? null : account.id(), sha256(rawFlow), expiresAt, now);
        return new StartResult(rawFlow, expiresAt);
    }

    @Transactional(noRollbackFor = WorkspaceAuthenticationService.OtpRateLimitedException.class)
    public OtpDelivery sendOtp(UUID workspaceUuid, String groupWorkspaceKey, RecoveryFlowCredential recoveryFlow, String sourceAddress) {
        Recovery recovery = requireActive(recoveryFlow.rawValue(), "PENDING");
        requireWorkspace(recovery, workspaceUuid, groupWorkspaceKey);
        sourceAttempt(recovery, sourceAddress);
        otpLimits.beforeSend(recovery.workspaceUuid(), recovery.groupWorkspaceKey(), "OPERATIONS_PASSWORD_RECOVERY", recovery.id());
        long expiresAt = Math.min(recovery.expiresAt(), time.currentEpochMillis() + OTP_TTL_MILLIS);
        String otp = null;
        if (recovery.accountId() != null) {
            jdbc.update("UPDATE workspace_iam.otp_grant SET status='SUPERSEDED' WHERE subject_ref=? AND purpose='OPERATIONS_PASSWORD_RECOVERY' AND status='ACTIVE'", recovery.id());
            otp = String.format("%06d", random.nextInt(1_000_000));
            jdbc.update("INSERT INTO workspace_iam.otp_grant (id, workspace_uuid, group_workspace_key, purpose, token_hash, subject_ref, status, expires_at_epoch_millis) VALUES (?, ?, ?, 'OPERATIONS_PASSWORD_RECOVERY', ?, ?, 'ACTIVE', ?)", UUID.randomUUID(), recovery.workspaceUuid(), recovery.groupWorkspaceKey(), sha256(otp), recovery.id(), expiresAt);
        }
        return new OtpDelivery(expiresAt, debugCodeExposure ? otp : null);
    }

    OtpDelivery sendOtp(UUID workspaceUuid, String groupWorkspaceKey, String rawFlow, String sourceAddress) {
        return sendOtp(workspaceUuid, groupWorkspaceKey, RecoveryFlowCredential.fromEdgeCookie(rawFlow), sourceAddress);
    }

    @Transactional(noRollbackFor = {OtpInvalidException.class, WorkspaceAuthenticationService.OtpRateLimitedException.class})
    public VerificationResult verifyOtp(UUID workspaceUuid, String groupWorkspaceKey, RecoveryFlowCredential recoveryFlow, String rawOtp, String sourceAddress) {
        Recovery recovery = requireActive(recoveryFlow.rawValue(), "PENDING");
        requireWorkspace(recovery, workspaceUuid, groupWorkspaceKey);
        sourceAttempt(recovery, sourceAddress);
        otpLimits.beforeVerify(recovery.workspaceUuid(), recovery.groupWorkspaceKey(), "OPERATIONS_PASSWORD_RECOVERY", recovery.id());
        int consumed = jdbc.update("UPDATE workspace_iam.otp_grant SET status='USED', used_at_epoch_millis=? WHERE subject_ref=? AND purpose='OPERATIONS_PASSWORD_RECOVERY' AND token_hash=? AND status='ACTIVE' AND expires_at_epoch_millis>?", time.currentEpochMillis(), recovery.id(), sha256(rawOtp), time.currentEpochMillis());
        if (recovery.accountId() == null || consumed != 1) {
            jdbc.update("UPDATE workspace_iam.otp_grant SET attempt_count=attempt_count+1 WHERE subject_ref=? AND purpose='OPERATIONS_PASSWORD_RECOVERY' AND status='ACTIVE'", recovery.id());
            otpLimits.invalidVerify(recovery.workspaceUuid(), recovery.groupWorkspaceKey(), "OPERATIONS_PASSWORD_RECOVERY", recovery.id());
            throw new OtpInvalidException();
        }
        Account account = enabledAccount(recovery);
        if (account == null) throw new OtpInvalidException();
        otpLimits.successfulVerify(recovery.workspaceUuid(), recovery.groupWorkspaceKey(), "OPERATIONS_PASSWORD_RECOVERY", recovery.id());
        String rawGrant = secret();
        long grantExpiry = Math.min(recovery.expiresAt(), time.currentEpochMillis() + GRANT_TTL_MILLIS);
        if (jdbc.update("UPDATE workspace_iam.operations_password_recovery SET status='OTP_VERIFIED', completion_grant_hash=?, completion_grant_expires_at_epoch_millis=?, version=version+1 WHERE id=? AND status='PENDING' AND version=?", sha256(rawGrant), grantExpiry, recovery.id(), recovery.version()) != 1) throw new RecoveryStateException();
        return new VerificationResult(rawGrant);
    }

    VerificationResult verifyOtp(UUID workspaceUuid, String groupWorkspaceKey, String rawFlow, String rawOtp, String sourceAddress) {
        return verifyOtp(workspaceUuid, groupWorkspaceKey, RecoveryFlowCredential.fromEdgeCookie(rawFlow), rawOtp, sourceAddress);
    }

    @Transactional
    public Completion complete(UUID workspaceUuid, String groupWorkspaceKey, RecoveryFlowCredential recoveryFlow, RecoveryGrantCredential recoveryGrant, char[] password) {
        Recovery recovery = requireActive(recoveryFlow.rawValue(), "OTP_VERIFIED");
        requireWorkspace(recovery, workspaceUuid, groupWorkspaceKey);
        if (password == null || password.length < 8 || !validGrant(recovery, recoveryGrant.rawValue())) throw new RecoveryStateException();
        Account account = enabledAccount(recovery);
        if (account == null) throw new RecoveryStateException();
        long now = time.currentEpochMillis();
        jdbc.update("UPDATE workspace_iam.workspace_credential SET password_hash=?, changed_at_epoch_millis=?, failed_attempts=0, locked_until_epoch_millis=NULL, password_change_required=FALSE, version=version+1 WHERE account_id=?", passwords.encode(new String(password)), now, account.id());
        int revoked = jdbc.update("UPDATE workspace_iam.workspace_session SET status='REVOKED', revoked_at_epoch_millis=? WHERE account_id=? AND status='ACTIVE'", now, account.id());
        if (jdbc.update("UPDATE workspace_iam.operations_password_recovery SET status='COMPLETED', completion_grant_hash=NULL, completion_grant_expires_at_epoch_millis=NULL, completed_at_epoch_millis=?, version=version+1 WHERE id=? AND status='OTP_VERIFIED' AND version=?", now, recovery.id(), recovery.version()) != 1) throw new RecoveryStateException();
        return new Completion("COMPLETED", revoked > 0);
    }

    Completion complete(UUID workspaceUuid, String groupWorkspaceKey, String rawFlow, String rawGrant, char[] password) {
        return complete(workspaceUuid, groupWorkspaceKey, RecoveryFlowCredential.fromEdgeCookie(rawFlow), RecoveryGrantCredential.fromEdgeCookie(rawGrant), password);
    }

    private void sourceAttempt(Recovery recovery, String sourceAddress) {
        WorkspaceLoginRateLimitService.Attempt attempt = recoveryLimits.begin(recovery.groupWorkspaceKey(), "recovery:" + recovery.id(), sourceAddress);
        recoveryLimits.recordSourceFailure(recovery.groupWorkspaceKey(), attempt);
    }

    private static void requireWorkspace(Recovery recovery, UUID workspaceUuid, String groupWorkspaceKey) {
        if (!recovery.workspaceUuid().equals(workspaceUuid) || !recovery.groupWorkspaceKey().equals(groupWorkspaceKey)) throw new RecoveryStateException();
    }

    private Recovery requireActive(String rawFlow, String requiredStatus) {
        if (rawFlow == null || rawFlow.isBlank()) throw new RecoveryStateException();
        Recovery recovery = jdbc.query("SELECT id, workspace_uuid, group_workspace_key, account_id, status, expires_at_epoch_millis, version, completion_grant_hash, completion_grant_expires_at_epoch_millis FROM workspace_iam.operations_password_recovery WHERE flow_token_hash=?", statement -> statement.setString(1, sha256(rawFlow)), result -> result.next() ? new Recovery(result.getObject(1, UUID.class), result.getObject(2, UUID.class), result.getString(3), result.getObject(4, UUID.class), result.getString(5), result.getLong(6), result.getLong(7), result.getString(8), result.getObject(9, Long.class)) : null);
        if (recovery == null || !requiredStatus.equals(recovery.status()) || recovery.expiresAt() <= time.currentEpochMillis()) throw new RecoveryStateException();
        return recovery;
    }

    private Account matchingEnabledAccount(UUID workspaceUuid, String groupWorkspaceKey, String loginName, String mobile) {
        if (loginName.isBlank() || mobile.isBlank()) return null;
        return jdbc.query("SELECT id, workspace_uuid, group_workspace_key, status FROM workspace_iam.workspace_account WHERE workspace_uuid=? AND group_workspace_key=? AND login_name_normalized=? AND mobile_normalized=? AND status='ENABLED'", statement -> { statement.setObject(1, workspaceUuid); statement.setString(2, groupWorkspaceKey); statement.setString(3, loginName); statement.setString(4, mobile); }, result -> result.next() ? new Account(result.getObject(1, UUID.class), result.getObject(2, UUID.class), result.getString(3), result.getString(4)) : null);
    }

    private Account enabledAccount(Recovery recovery) {
        if (recovery.accountId() == null || !workspaces.isEnabled(recovery.workspaceUuid(), recovery.groupWorkspaceKey())) return null;
        return jdbc.query("SELECT id, workspace_uuid, group_workspace_key, status FROM workspace_iam.workspace_account WHERE id=? AND workspace_uuid=? AND group_workspace_key=? AND status='ENABLED'", statement -> { statement.setObject(1, recovery.accountId()); statement.setObject(2, recovery.workspaceUuid()); statement.setString(3, recovery.groupWorkspaceKey()); }, result -> result.next() ? new Account(result.getObject(1, UUID.class), result.getObject(2, UUID.class), result.getString(3), result.getString(4)) : null);
    }

    private boolean validGrant(Recovery recovery, String rawGrant) {
        return rawGrant != null && recovery.completionGrantHash() != null && recovery.completionGrantExpiresAt() != null && recovery.completionGrantExpiresAt() > time.currentEpochMillis() && recovery.completionGrantHash().equals(sha256(rawGrant));
    }

    private static String normalizedLoginName(String value) { return value == null ? "" : value.trim().toLowerCase(java.util.Locale.ROOT); }
    private static String normalizedMobile(String value) { String normalized = value == null ? "" : value.replace(" ", "").replace("-", ""); if (!normalized.matches("^\\+?[0-9]{8,20}$")) return ""; return normalized.startsWith("+") ? normalized.substring(1) : normalized; }
    private String secret() { byte[] bytes = new byte[32]; random.nextBytes(bytes); return HexFormat.of().formatHex(bytes); }
    private static String sha256(String value) { try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest((value == null ? "" : value).getBytes(StandardCharsets.UTF_8))); } catch (Exception failure) { throw new IllegalStateException(failure); } }

    public record StartResult(String rawFlow, long expiresAt) { }
    public record OtpDelivery(long expiresAt, String debugVerificationCode) { }
    public record VerificationResult(String rawCompletionGrant) { }
    public record Completion(String status, boolean sessionsRevoked) { }
    private record Recovery(UUID id, UUID workspaceUuid, String groupWorkspaceKey, UUID accountId, String status, long expiresAt, long version, String completionGrantHash, Long completionGrantExpiresAt) { }
    private record Account(UUID id, UUID workspaceUuid, String groupWorkspaceKey, String status) { }
    public static final class OtpInvalidException extends RuntimeException { }
    public static final class RecoveryStateException extends RuntimeException { }
    /** Opaque browser recovery flow; only workspace-IAM can read the raw value. */
    public static final class RecoveryFlowCredential {
        private final String value;
        private RecoveryFlowCredential(String value) { this.value = value; }
        public static RecoveryFlowCredential fromEdgeCookie(String value) { return new RecoveryFlowCredential(value); }
        String rawValue() { return value; }
        @Override public String toString() { return "RecoveryFlowCredential[redacted]"; }
    }
    /** Opaque one-time completion grant; only workspace-IAM can read the raw value. */
    public static final class RecoveryGrantCredential {
        private final String value;
        private RecoveryGrantCredential(String value) { this.value = value; }
        public static RecoveryGrantCredential fromEdgeCookie(String value) { return new RecoveryGrantCredential(value); }
        String rawValue() { return value; }
        @Override public String toString() { return "RecoveryGrantCredential[redacted]"; }
    }
}
