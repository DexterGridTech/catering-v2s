package com.catering.v2s.workspace.iam.application;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.organization.api.WorkspaceStatusLookup;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.platform.foundation.seed.DevFixedOtpIssuer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.HexFormat;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Account-reset owner flow. A platform command starts a short-lived generation;
 * public callers prove the invitation-bound mobile before a one-time password
 * reset grant is released. Neither generation keys, OTPs nor grants are stored
 * in plaintext or returned by platform administration endpoints.
 */
@Service
public class WorkspacePasswordResetService {
    private static final long RESET_TTL_MILLIS = 30 * 60 * 1000L;
    private static final long OTP_TTL_MILLIS = 5 * 60 * 1000L;
    private static final long GRANT_TTL_MILLIS = 15 * 60 * 1000L;
    private final JdbcTemplate jdbc;
    private final TimeProvider time;
    private final WorkspaceOtpRateLimitService otpLimits;
    private final WorkspaceIamCommandReceiptService receipts;
    private final WorkspaceStatusLookup workspaces;
    private final DevFixedOtpIssuer fixedOtpIssuer;
    private final SecureRandom random = new SecureRandom();
    private final BCryptPasswordEncoder passwords = new BCryptPasswordEncoder();

    public WorkspacePasswordResetService(JdbcTemplate jdbc, TimeProvider time) { this(jdbc, time, new WorkspaceOtpRateLimitService(jdbc, time), new WorkspaceIamCommandReceiptService(jdbc, time), localWorkspaceStatus(jdbc), (DevFixedOtpIssuer) null); }

    @org.springframework.beans.factory.annotation.Autowired
    public WorkspacePasswordResetService(JdbcTemplate jdbc, TimeProvider time, WorkspaceOtpRateLimitService otpLimits, WorkspaceIamCommandReceiptService receipts, WorkspaceStatusLookup workspaces, ObjectProvider<DevFixedOtpIssuer> fixedOtpIssuer) {
        this(jdbc, time, otpLimits, receipts, workspaces, fixedOtpIssuer.getIfAvailable());
    }

    public WorkspacePasswordResetService(JdbcTemplate jdbc, TimeProvider time, WorkspaceOtpRateLimitService otpLimits, WorkspaceIamCommandReceiptService receipts, WorkspaceStatusLookup workspaces) { this(jdbc, time, otpLimits, receipts, workspaces, (DevFixedOtpIssuer) null); }
    public WorkspacePasswordResetService(JdbcTemplate jdbc, TimeProvider time, WorkspaceOtpRateLimitService otpLimits) { this(jdbc, time, otpLimits, new WorkspaceIamCommandReceiptService(jdbc, time), localWorkspaceStatus(jdbc), (DevFixedOtpIssuer) null); }

    private WorkspacePasswordResetService(JdbcTemplate jdbc, TimeProvider time, WorkspaceOtpRateLimitService otpLimits, WorkspaceIamCommandReceiptService receipts, WorkspaceStatusLookup workspaces, DevFixedOtpIssuer fixedOtpIssuer) {
        this.jdbc = jdbc; this.time = time; this.otpLimits = otpLimits; this.receipts = receipts; this.workspaces = workspaces; this.fixedOtpIssuer = fixedOtpIssuer;
    }

    @Transactional
    public RequestResult request(UUID workspaceUuid, String groupWorkspaceKey, UUID accountId, long expectedVersion) {
        requireEnabledWorkspace(workspaceUuid, groupWorkspaceKey);
        Account account = account(workspaceUuid, groupWorkspaceKey, accountId);
        if (!"ENABLED".equals(account.status()) || account.version() != expectedVersion) throw new ResetStateException();
        long now = time.currentEpochMillis();
        jdbc.update("UPDATE workspace_iam.password_reset SET status='SUPERSEDED', version=version+1 WHERE account_id=? AND status IN ('PENDING','MOBILE_VERIFIED')", account.id());
        UUID id = UUID.randomUUID();
        String generationKey = secret();
        jdbc.update("INSERT INTO workspace_iam.password_reset (id, account_id, generation_key_hash, status, expires_at_epoch_millis, version) VALUES (?, ?, ?, 'PENDING', ?, 1)", id, account.id(), hash(generationKey), now + RESET_TTL_MILLIS);
        jdbc.update("INSERT INTO workspace_iam.password_reset_progress (password_reset_id, version) VALUES (?, 1)", id);
        return new RequestResult(account.id(), account.loginName(), account.status(), "RESET_PENDING", 1, now + RESET_TTL_MILLIS, "QUEUED", account.version(), generationKey);
    }

    /** Platform-initiated reset is actor-audited and receipt-idempotent; it never persists or returns the generation secret. */
    @Transactional
    public PlatformRequestResult requestPlatform(UUID workspaceUuid, String groupWorkspaceKey, UUID accountId, long expectedVersion, String idempotencyKey, AuditActor actor) {
        return receipts.execute(workspaceUuid, idempotencyKey, "workspace-credential-reset|" + groupWorkspaceKey + "|" + accountId + "|" + expectedVersion, PlatformRequestResult.class, () -> {
            RequestResult result = request(workspaceUuid, groupWorkspaceKey, accountId, expectedVersion);
            jdbc.update("INSERT INTO workspace_iam.audit_event (id, workspace_uuid, group_workspace_key, entity_type, entity_ref_text, actor_type, actor_id, actor_display_snapshot, action, occurred_at_epoch_millis, changes_json) VALUES (?, ?, ?, 'WORKSPACE_ACCOUNT', ?, ?, ?, ?, 'WORKSPACE_ACCOUNT_CREDENTIAL_RESET_REQUESTED', ?, '[]'::jsonb)", UUID.randomUUID(), workspaceUuid, groupWorkspaceKey, accountId.toString(), actor.actorType(), actor.actorId(), actor.displaySnapshot(), time.currentEpochMillis());
            return new PlatformRequestResult(result.accountId(), result.loginName(), result.status(), result.credentialStatus(), result.generation(), result.expiresAt(), result.deliveryStatus(), result.revision());
        });
    }

    @Transactional(noRollbackFor = WorkspaceAuthenticationService.OtpRateLimitedException.class)
    public OtpDelivery sendOtp(String rawGenerationKey, String mobile) {
        Reset reset = reset(rawGenerationKey);
        requireActive(reset, "PENDING");
        Account account = accountById(reset.accountId());
        requireMobile(account.mobile(), mobile);
        otpLimits.beforeSend(account.workspaceUuid(), account.groupWorkspaceKey(), "PASSWORD_RESET_VERIFY", reset.id());
        long expires = Math.min(reset.expiresAt(), time.currentEpochMillis() + OTP_TTL_MILLIS);
        jdbc.update("UPDATE workspace_iam.otp_grant SET status='SUPERSEDED' WHERE subject_ref=? AND purpose='PASSWORD_RESET_VERIFY' AND status='ACTIVE'", reset.id());
        String otp = fixedOtpIssuer == null ? String.format("%06d", random.nextInt(1_000_000)) : fixedOtpIssuer.issue("PASSWORD_RESET_VERIFY", reset.id());
        jdbc.update("INSERT INTO workspace_iam.otp_grant (id, workspace_uuid, group_workspace_key, purpose, token_hash, subject_ref, status, expires_at_epoch_millis) VALUES (?, ?, ?, 'PASSWORD_RESET_VERIFY', ?, ?, 'ACTIVE', ?)", UUID.randomUUID(), account.workspaceUuid(), account.groupWorkspaceKey(), hash(otp), reset.id(), expires);
        return new OtpDelivery(expires, null);
    }

    @Transactional(noRollbackFor = {ResetOtpInvalidException.class, WorkspaceAuthenticationService.OtpRateLimitedException.class})
    public Readiness verifyOtp(String rawGenerationKey, String mobile, String rawOtp) {
        Reset reset = reset(rawGenerationKey);
        requireActive(reset, "PENDING");
        Account account = accountById(reset.accountId());
        requireMobile(account.mobile(), mobile);
        otpLimits.beforeVerify(account.workspaceUuid(), account.groupWorkspaceKey(), "PASSWORD_RESET_VERIFY", reset.id());
        int consumed = jdbc.update("UPDATE workspace_iam.otp_grant SET status='USED', used_at_epoch_millis=? WHERE subject_ref=? AND purpose='PASSWORD_RESET_VERIFY' AND token_hash=? AND status='ACTIVE' AND expires_at_epoch_millis>?", time.currentEpochMillis(), reset.id(), hash(rawOtp), time.currentEpochMillis());
        if (consumed != 1) {
            jdbc.update("UPDATE workspace_iam.otp_grant SET attempt_count=attempt_count+1 WHERE subject_ref=? AND purpose='PASSWORD_RESET_VERIFY' AND status='ACTIVE'", reset.id());
            otpLimits.invalidVerify(account.workspaceUuid(), account.groupWorkspaceKey(), "PASSWORD_RESET_VERIFY", reset.id());
            throw new ResetOtpInvalidException();
        }
        otpLimits.successfulVerify(account.workspaceUuid(), account.groupWorkspaceKey(), "PASSWORD_RESET_VERIFY", reset.id());
        String grant = secret();
        long grantExpiry = Math.min(reset.expiresAt(), time.currentEpochMillis() + GRANT_TTL_MILLIS);
        if (jdbc.update("UPDATE workspace_iam.password_reset SET status='MOBILE_VERIFIED', version=version+1 WHERE id=? AND status='PENDING' AND version=?", reset.id(), reset.version()) != 1) throw new ResetStateException();
        jdbc.update("UPDATE workspace_iam.password_reset_progress SET password_reset_grant_hash=?, password_reset_grant_expires_at_epoch_millis=?, version=version+1 WHERE password_reset_id=?", hash(grant), grantExpiry, reset.id());
        return new Readiness(grant, account.loginName(), "SET_PASSWORD");
    }

    @Transactional
    public Completion complete(String rawGenerationKey, String grant, char[] password) {
        Reset reset = reset(rawGenerationKey);
        requireActive(reset, "MOBILE_VERIFIED");
        if (password == null || password.length < 8 || !validGrant(reset.id(), grant)) throw new ResetStateException();
        Account account = accountById(reset.accountId());
        long now = time.currentEpochMillis();
        jdbc.update("UPDATE workspace_iam.workspace_credential SET password_hash=?, changed_at_epoch_millis=?, failed_attempts=0, locked_until_epoch_millis=NULL, version=version+1 WHERE account_id=?", passwords.encode(new String(password)), now, account.id());
        int revoked = jdbc.update("UPDATE workspace_iam.workspace_session SET status='REVOKED', revoked_at_epoch_millis=? WHERE account_id=? AND status='ACTIVE'", now, account.id());
        if (jdbc.update("UPDATE workspace_iam.password_reset SET status='COMPLETED', completed_at_epoch_millis=?, version=version+1 WHERE id=? AND status='MOBILE_VERIFIED' AND version=?", now, reset.id(), reset.version()) != 1) throw new ResetStateException();
        jdbc.update("UPDATE workspace_iam.password_reset_progress SET completed_at_epoch_millis=?, version=version+1 WHERE password_reset_id=?", now, reset.id());
        return new Completion("COMPLETED", account.loginName(), "密码已重置", "/operations/" + account.groupWorkspaceKey() + "/login", revoked > 0);
    }

    private void requireActive(Reset reset, String status) { if (!status.equals(reset.status()) || reset.expiresAt() <= time.currentEpochMillis()) throw new ResetStateException(); }
    private Reset reset(String rawGenerationKey) { return jdbc.query("SELECT id, account_id, status, expires_at_epoch_millis, version FROM workspace_iam.password_reset WHERE generation_key_hash=?", statement -> statement.setString(1, hash(rawGenerationKey)), result -> { if (!result.next()) throw new ResetNotFoundException(); return new Reset(result.getObject(1, UUID.class), result.getObject(2, UUID.class), result.getString(3), result.getLong(4), result.getLong(5)); }); }
    private Account account(UUID workspace, String key, UUID id) { Account value = accountById(id); if (!workspace.equals(value.workspaceUuid()) || !key.equals(value.groupWorkspaceKey())) throw new ResetNotFoundException(); return value; }
    private Account accountById(UUID id) { return jdbc.query("SELECT id, workspace_uuid, group_workspace_key, mobile_normalized, login_name_normalized, status, version FROM workspace_iam.workspace_account WHERE id=?", statement -> statement.setObject(1, id), result -> { if (!result.next()) throw new ResetNotFoundException(); return new Account(result.getObject(1, UUID.class), result.getObject(2, UUID.class), result.getString(3), result.getString(4), result.getString(5), result.getString(6), result.getLong(7)); }); }
    private boolean validGrant(UUID resetId, String rawGrant) { return rawGrant != null && jdbc.queryForObject("SELECT COUNT(*) FROM workspace_iam.password_reset_progress WHERE password_reset_id=? AND password_reset_grant_hash=? AND password_reset_grant_expires_at_epoch_millis>?", Integer.class, resetId, hash(rawGrant), time.currentEpochMillis()) == 1; }
    private static void requireMobile(String actual, String requested) { String value = normalizedMobile(requested); if (!actual.equals(value)) throw new ResetMobileMismatchException(); }
    private void requireEnabledWorkspace(UUID workspaceUuid, String groupWorkspaceKey) { if (!workspaces.isEnabled(workspaceUuid, groupWorkspaceKey)) throw new WorkspaceAccountService.WorkspaceDisabledException(); }
    private static WorkspaceStatusLookup localWorkspaceStatus(JdbcTemplate jdbc) { return (workspaceUuid, key) -> Boolean.TRUE.equals(jdbc.query("SELECT status='ENABLED' FROM platform_workspace.group_workspace WHERE workspace_uuid=? AND group_workspace_key=?", statement -> { statement.setObject(1, workspaceUuid); statement.setString(2, key); }, result -> result.next() && result.getBoolean(1))); }
    private static String normalizedMobile(String value) { String normalized = value == null ? "" : value.replace(" ", "").replace("-", ""); if (!normalized.matches("^\\+?[0-9]{8,20}$")) throw new ResetMobileMismatchException(); return normalized.startsWith("+") ? normalized.substring(1) : normalized; }
    private String secret() { byte[] bytes = new byte[32]; random.nextBytes(bytes); return HexFormat.of().formatHex(bytes); }
    private static String hash(String value) { try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); } catch (Exception failure) { throw new IllegalStateException(failure); } }

    public record RequestResult(UUID accountId, String loginName, String status, String credentialStatus, int generation, long expiresAt, String deliveryStatus, long revision, String rawGenerationKey) { }
    public record PlatformRequestResult(UUID accountId, String loginName, String status, String credentialStatus, int generation, long expiresAt, String deliveryStatus, long revision) { }
    public record OtpDelivery(long expiresAt, String testCode) { }
    public record Readiness(String passwordResetGrant, String loginName, String nextStep) { }
    public record Completion(String status, String loginName, String message, String loginPath, boolean sessionsRevoked) { }
    private record Reset(UUID id, UUID accountId, String status, long expiresAt, long version) { }
    private record Account(UUID id, UUID workspaceUuid, String groupWorkspaceKey, String mobile, String loginName, String status, long version) { }
    public static final class ResetNotFoundException extends RuntimeException { }
    public static final class ResetStateException extends RuntimeException { }
    public static final class ResetOtpInvalidException extends RuntimeException { }
    public static final class ResetMobileMismatchException extends RuntimeException { }
}
