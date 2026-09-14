package com.catering.v2s.workspace.iam.application;

import com.catering.v2s.workspace.iam.application.persistence.WorkspacePasswordRecoveryPersistence;
import com.catering.v2s.platform.foundation.security.Sha256Hex;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.platform.foundation.workspace.WorkspaceStatusLookup;
import java.security.SecureRandom;
import java.util.HexFormat;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Anonymous operations-password recovery is deliberately separate from the administrator-issued reset-generation flow.
 * Its opaque flow and completion grant are owner secrets; public callers receive neither in a response body.
 */
@Service
public class WorkspacePasswordRecoveryService {
    private static final long FLOW_TTL_MILLIS = 30 * 60 * 1000L;
    private static final long OTP_TTL_MILLIS = 5 * 60 * 1000L;
    private static final long GRANT_TTL_MILLIS = 15 * 60 * 1000L;
    private final WorkspacePasswordRecoveryPersistence persistence;
    private final TimeProvider time;
    private final WorkspaceOtpRateLimitService otpLimits;
    private final WorkspaceLoginRateLimitService recoveryLimits;
    private final WorkspaceStatusLookup workspaces;
    private final boolean debugCodeExposure;
    private final SecureRandom random = new SecureRandom();
    private final BCryptPasswordEncoder passwords = new BCryptPasswordEncoder();

    /** Compatibility constructor for focused owner tests; production injects all guards. */
    public WorkspacePasswordRecoveryService(JdbcTemplate jdbc, TimeProvider time) {
        this(
                new WorkspacePasswordRecoveryPersistence(jdbc),
                time,
                new WorkspaceOtpRateLimitService(jdbc, time),
                new WorkspaceLoginRateLimitService(jdbc, time),
                (workspaceUuid, groupWorkspaceKey) -> "ENABLED",
                new com.catering.v2s.platform.foundation.security.OtpDebugExposurePolicy("", false));
    }

    /** Compatibility constructor for focused owner tests; production injects the typed persistence boundary. */
    public WorkspacePasswordRecoveryService(
            JdbcTemplate jdbc,
            TimeProvider time,
            WorkspaceOtpRateLimitService otpLimits,
            WorkspaceLoginRateLimitService recoveryLimits,
            WorkspaceStatusLookup workspaces,
            com.catering.v2s.platform.foundation.security.OtpDebugExposurePolicy otpDebugExposurePolicy) {
        this(
                new WorkspacePasswordRecoveryPersistence(jdbc),
                time,
                otpLimits,
                recoveryLimits,
                workspaces,
                otpDebugExposurePolicy);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public WorkspacePasswordRecoveryService(
            WorkspacePasswordRecoveryPersistence persistence,
            TimeProvider time,
            WorkspaceOtpRateLimitService otpLimits,
            WorkspaceLoginRateLimitService recoveryLimits,
            WorkspaceStatusLookup workspaces,
            com.catering.v2s.platform.foundation.security.OtpDebugExposurePolicy otpDebugExposurePolicy) {
        this.persistence = persistence;
        this.time = time;
        this.otpLimits = otpLimits;
        this.recoveryLimits = recoveryLimits;
        this.workspaces = workspaces;
        this.debugCodeExposure = otpDebugExposurePolicy.enabled();
    }

    @Transactional(noRollbackFor = WorkspaceAuthenticationService.LoginRateLimitedException.class)
    public StartResult start(
            UUID workspaceUuid, String groupWorkspaceKey, String loginName, String mobile, String sourceAddress) {
        String normalizedLoginName = normalizedLoginName(loginName);
        String normalizedMobile = normalizedMobile(mobile);
        WorkspaceLoginRateLimitService.Attempt attempt = recoveryLimits.beginPasswordRecovery(
                groupWorkspaceKey, normalizedLoginName, normalizedMobile, sourceAddress);
        // Apply the same source guard before any account lookup result can influence later work.
        recoveryLimits.recordPasswordRecoveryStart(groupWorkspaceKey, attempt);
        Account account = workspaces.isEnabled(workspaceUuid, groupWorkspaceKey)
                ? matchingEnabledAccount(workspaceUuid, groupWorkspaceKey, normalizedLoginName, normalizedMobile)
                : null;
        long now = time.currentEpochMillis();
        if (account != null) {
            persistence.supersedeAccountRecoveries(account.id());
        }
        UUID recoveryId = UUID.randomUUID();
        String rawFlow = secret();
        long expiresAt = now + FLOW_TTL_MILLIS;
        persistence.createRecovery(
                recoveryId,
                workspaceUuid,
                groupWorkspaceKey,
                account == null ? null : account.id(),
                sha256(rawFlow),
                expiresAt,
                now);
        return new StartResult(rawFlow, expiresAt);
    }

    @Transactional(noRollbackFor = WorkspaceAuthenticationService.OtpRateLimitedException.class)
    public OtpDelivery sendOtp(
            UUID workspaceUuid, String groupWorkspaceKey, RecoveryFlowCredential recoveryFlow, String sourceAddress) {
        Recovery recovery = requireActive(recoveryFlow.rawValue(), "PENDING");
        requireWorkspace(recovery, workspaceUuid, groupWorkspaceKey);
        sourceAttempt(recovery, sourceAddress);
        otpLimits.beforeSend(
                recovery.workspaceUuid(), recovery.groupWorkspaceKey(), "OPERATIONS_PASSWORD_RECOVERY", recovery.id());
        long expiresAt = Math.min(recovery.expiresAt(), time.currentEpochMillis() + OTP_TTL_MILLIS);
        String otp = null;
        if (recovery.accountId() != null) {
            persistence.supersedeActiveOtp(recovery.id());
            otp = String.format("%06d", random.nextInt(1_000_000));
            persistence.createOtp(
                    UUID.randomUUID(),
                    recovery.workspaceUuid(),
                    recovery.groupWorkspaceKey(),
                    sha256(otp),
                    recovery.id(),
                    expiresAt);
        }
        return new OtpDelivery(expiresAt, debugCodeExposure ? otp : null);
    }

    OtpDelivery sendOtp(UUID workspaceUuid, String groupWorkspaceKey, String rawFlow, String sourceAddress) {
        return sendOtp(workspaceUuid, groupWorkspaceKey, RecoveryFlowCredential.fromEdgeCookie(rawFlow), sourceAddress);
    }

    @Transactional(
            noRollbackFor = {OtpInvalidException.class, WorkspaceAuthenticationService.OtpRateLimitedException.class})
    public VerificationResult verifyOtp(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            RecoveryFlowCredential recoveryFlow,
            String rawOtp,
            String sourceAddress) {
        Recovery recovery = requireActive(recoveryFlow.rawValue(), "PENDING");
        requireWorkspace(recovery, workspaceUuid, groupWorkspaceKey);
        sourceAttempt(recovery, sourceAddress);
        otpLimits.beforeVerify(
                recovery.workspaceUuid(), recovery.groupWorkspaceKey(), "OPERATIONS_PASSWORD_RECOVERY", recovery.id());
        long now = time.currentEpochMillis();
        int consumed = persistence.consumeOtp(
                now,
                recovery.id(),
                sha256(rawOtp));
        if (recovery.accountId() == null || consumed != 1) {
            persistence.incrementOtpAttempt(recovery.id());
            otpLimits.invalidVerify(
                    recovery.workspaceUuid(),
                    recovery.groupWorkspaceKey(),
                    "OPERATIONS_PASSWORD_RECOVERY",
                    recovery.id());
            throw new OtpInvalidException();
        }
        Account account = enabledAccount(recovery);
        if (account == null) throw new OtpInvalidException();
        otpLimits.successfulVerify(
                recovery.workspaceUuid(), recovery.groupWorkspaceKey(), "OPERATIONS_PASSWORD_RECOVERY", recovery.id());
        String rawGrant = secret();
        long grantExpiry = Math.min(recovery.expiresAt(), time.currentEpochMillis() + GRANT_TTL_MILLIS);
        if (persistence.markOtpVerified(sha256(rawGrant), grantExpiry, recovery.id(), recovery.version()) != 1)
            throw new RecoveryStateException();
        return new VerificationResult(rawGrant);
    }

    VerificationResult verifyOtp(
            UUID workspaceUuid, String groupWorkspaceKey, String rawFlow, String rawOtp, String sourceAddress) {
        return verifyOtp(
                workspaceUuid,
                groupWorkspaceKey,
                RecoveryFlowCredential.fromEdgeCookie(rawFlow),
                rawOtp,
                sourceAddress);
    }

    @Transactional
    public Completion complete(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            RecoveryFlowCredential recoveryFlow,
            RecoveryGrantCredential recoveryGrant,
            char[] password) {
        Recovery recovery = requireActive(recoveryFlow.rawValue(), "OTP_VERIFIED");
        requireWorkspace(recovery, workspaceUuid, groupWorkspaceKey);
        if (password == null || password.length < 8 || !validGrant(recovery, recoveryGrant.rawValue()))
            throw new RecoveryStateException();
        Account account = enabledAccount(recovery);
        if (account == null) throw new RecoveryStateException();
        long now = time.currentEpochMillis();
        persistence.updateCredential(passwords.encode(new String(password)), now, account.id());
        int revoked = persistence.revokeSessions(now, account.id());
        if (persistence.completeRecovery(now, recovery.id(), recovery.version()) != 1)
            throw new RecoveryStateException();
        return new Completion("COMPLETED", revoked > 0);
    }

    Completion complete(
            UUID workspaceUuid, String groupWorkspaceKey, String rawFlow, String rawGrant, char[] password) {
        return complete(
                workspaceUuid,
                groupWorkspaceKey,
                RecoveryFlowCredential.fromEdgeCookie(rawFlow),
                RecoveryGrantCredential.fromEdgeCookie(rawGrant),
                password);
    }

    private void sourceAttempt(Recovery recovery, String sourceAddress) {
        WorkspaceLoginRateLimitService.Attempt attempt =
                recoveryLimits.begin(recovery.groupWorkspaceKey(), "recovery:" + recovery.id(), sourceAddress);
        recoveryLimits.recordSourceFailure(recovery.groupWorkspaceKey(), attempt);
    }

    private static void requireWorkspace(Recovery recovery, UUID workspaceUuid, String groupWorkspaceKey) {
        if (!recovery.workspaceUuid().equals(workspaceUuid)
                || !recovery.groupWorkspaceKey().equals(groupWorkspaceKey)) throw new RecoveryStateException();
    }

    private Recovery requireActive(String rawFlow, String requiredStatus) {
        if (rawFlow == null || rawFlow.isBlank()) throw new RecoveryStateException();
        WorkspacePasswordRecoveryPersistence.RecoveryRow row = persistence.activeRecovery(sha256(rawFlow));
        Recovery recovery = row == null
                ? null
                : new Recovery(
                        row.id(),
                        row.workspaceUuid(),
                        row.groupWorkspaceKey(),
                        row.accountId(),
                        row.status(),
                        row.expiresAt(),
                        row.version(),
                        row.completionGrantHash(),
                        row.completionGrantExpiresAt());
        if (recovery == null
                || !requiredStatus.equals(recovery.status())
                || recovery.expiresAt() <= time.currentEpochMillis()) throw new RecoveryStateException();
        return recovery;
    }

    private Account matchingEnabledAccount(
            UUID workspaceUuid, String groupWorkspaceKey, String loginName, String mobile) {
        if (loginName.isBlank() || mobile.isBlank()) return null;
        return account(persistence.matchingAccount(workspaceUuid, groupWorkspaceKey, loginName, mobile));
    }

    private Account enabledAccount(Recovery recovery) {
        if (recovery.accountId() == null
                || !workspaces.isEnabled(recovery.workspaceUuid(), recovery.groupWorkspaceKey())) return null;
        return account(persistence.enabledAccount(
                recovery.accountId(), recovery.workspaceUuid(), recovery.groupWorkspaceKey()));
    }

    private static Account account(WorkspacePasswordRecoveryPersistence.AccountRow row) {
        return row == null ? null : new Account(row.id(), row.workspaceUuid(), row.groupWorkspaceKey(), row.status());
    }

    private boolean validGrant(Recovery recovery, String rawGrant) {
        return rawGrant != null
                && recovery.completionGrantHash() != null
                && recovery.completionGrantExpiresAt() != null
                && recovery.completionGrantExpiresAt() > time.currentEpochMillis()
                && recovery.completionGrantHash().equals(sha256(rawGrant));
    }

    private static String normalizedLoginName(String value) {
        return value == null ? "" : value.trim().toLowerCase(java.util.Locale.ROOT);
    }

    private static String normalizedMobile(String value) {
        String normalized = value == null ? "" : value.replace(" ", "").replace("-", "");
        if (!normalized.matches("^\\+?[0-9]{8,20}$")) return "";
        return normalized.startsWith("+") ? normalized.substring(1) : normalized;
    }

    private String secret() {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }

    private static String sha256(String value) {
        return Sha256Hex.digest(value == null ? "" : value);
    }

    public record StartResult(String rawFlow, long expiresAt) {}

    public record OtpDelivery(long expiresAt, String debugVerificationCode) {}

    public record VerificationResult(String rawCompletionGrant) {}

    public record Completion(String status, boolean sessionsRevoked) {}

    private record Recovery(
            UUID id,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID accountId,
            String status,
            long expiresAt,
            long version,
            String completionGrantHash,
            Long completionGrantExpiresAt) {}

    private record Account(UUID id, UUID workspaceUuid, String groupWorkspaceKey, String status) {}

    public static final class OtpInvalidException extends RuntimeException {}

    public static final class RecoveryStateException extends RuntimeException {}
    /** Opaque browser recovery flow; only workspace-IAM can read the raw value. */
    public static final class RecoveryFlowCredential {
        private final String value;

        private RecoveryFlowCredential(String value) {
            this.value = value;
        }

        public static RecoveryFlowCredential fromEdgeCookie(String value) {
            return new RecoveryFlowCredential(value);
        }

        String rawValue() {
            return value;
        }

        @Override
        public String toString() {
            return "RecoveryFlowCredential[redacted]";
        }
    }
    /** Opaque one-time completion grant; only workspace-IAM can read the raw value. */
    public static final class RecoveryGrantCredential {
        private final String value;

        private RecoveryGrantCredential(String value) {
            this.value = value;
        }

        public static RecoveryGrantCredential fromEdgeCookie(String value) {
            return new RecoveryGrantCredential(value);
        }

        String rawValue() {
            return value;
        }

        @Override
        public String toString() {
            return "RecoveryGrantCredential[redacted]";
        }
    }
}
