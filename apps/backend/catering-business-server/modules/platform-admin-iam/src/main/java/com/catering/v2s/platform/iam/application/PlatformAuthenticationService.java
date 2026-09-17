package com.catering.v2s.platform.iam.application;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.audit.contract.AuditChange;
import com.catering.v2s.audit.contract.AuditChangeJson;
import com.catering.v2s.audit.contract.AuditChangePolicy;
import com.catering.v2s.platform.foundation.persistence.ReadBudgetComponent;
import com.catering.v2s.platform.foundation.security.Sha256Hex;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.platform.iam.api.PlatformDiagnosticBootstrap;
import com.catering.v2s.platform.iam.api.PlatformGovernanceAuthorization;
import com.catering.v2s.platform.iam.api.PlatformSessionReadback;
import com.catering.v2s.platform.iam.application.persistence.PlatformAuthenticationPersistence;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Platform credential/session owner. It has no default principal and stores only token hashes. */
@Service
public class PlatformAuthenticationService implements PlatformGovernanceAuthorization, PlatformDiagnosticBootstrap {
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
    private static final AuditChangePolicy ADMIN_CREATED =
            new AuditChangePolicy("PLATFORM_ADMIN", "PLATFORM_ADMIN_CREATED", Set.of("displayName"));
    private static final AuditChangePolicy ADMIN_STATUS_CHANGED =
            new AuditChangePolicy("PLATFORM_ADMIN", "PLATFORM_ADMIN_STATUS_CHANGED", Set.of("status"));
    private static final AuditChangePolicy ADMIN_PROFILE_UPDATED =
            new AuditChangePolicy("PLATFORM_ADMIN", "PLATFORM_ADMIN_PROFILE_UPDATED", Set.of("displayName"));
    private static final AuditChangePolicy ADMIN_CREDENTIAL_RESET =
            new AuditChangePolicy("PLATFORM_ADMIN", "PLATFORM_ADMIN_CREDENTIAL_RESET", Set.of());
    private final PlatformAuthenticationPersistence persistence;
    private final TimeProvider timeProvider;
    private final PlatformCommandReceiptService receipts;
    private final byte[] rateLimitHmacSecret;
    private final boolean debugCodeExposure;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    private final SecureRandom secureRandom = new SecureRandom();

    @org.springframework.beans.factory.annotation.Autowired
    public PlatformAuthenticationService(
            PlatformAuthenticationPersistence persistence,
            TimeProvider timeProvider,
            PlatformCommandReceiptService receipts,
            @Value("${platform.iam.rate-limit-hmac-secret:}") String rateLimitHmacSecret,
            com.catering.v2s.platform.foundation.security.OtpDebugExposurePolicy otpDebugExposurePolicy) {
        this.persistence = persistence;
        this.timeProvider = timeProvider;
        this.receipts = receipts;
        if (rateLimitHmacSecret == null || rateLimitHmacSecret.isBlank())
            throw new IllegalStateException("platform.iam.rate-limit-hmac-secret must be configured");
        this.rateLimitHmacSecret = rateLimitHmacSecret.getBytes(StandardCharsets.UTF_8);
        this.debugCodeExposure = otpDebugExposurePolicy.enabled();
    }

    /** Test-only compatibility constructor; production injects the typed persistence boundary. */
    public PlatformAuthenticationService(
            JdbcTemplate jdbc,
            TimeProvider timeProvider,
            PlatformCommandReceiptService receipts,
            String rateLimitHmacSecret,
            com.catering.v2s.platform.foundation.security.OtpDebugExposurePolicy otpDebugExposurePolicy) {
        this(
                new PlatformAuthenticationPersistence(jdbc),
                timeProvider,
                receipts,
                rateLimitHmacSecret,
                otpDebugExposurePolicy);
    }

    /** Test-only compatibility constructor; production always supplies the configured HMAC secret. */
    public PlatformAuthenticationService(JdbcTemplate jdbc, TimeProvider timeProvider) {
        this(
                jdbc,
                timeProvider,
                new PlatformCommandReceiptService(jdbc, timeProvider),
                UUID.randomUUID().toString(),
                new com.catering.v2s.platform.foundation.security.OtpDebugExposurePolicy("", false));
    }

    /** Public OTP entry is mobile-bound; display-only mobile data is never read as identity. */
    @Transactional(noRollbackFor = OtpRateLimitedException.class)
    public OtpDispatch sendLoginOtp(String mobile, String sourceAddress) {
        String normalizedMobile = normalizedMobile(mobile);
        String mobileFingerprint = hmac("MOBILE:" + normalizedMobile);
        OtpAttempt attempt = beginOtpAttempt("PLATFORM_LOGIN_SEND", mobileFingerprint, sourceAddress);
        long now = timeProvider.currentEpochMillis();
        persistence.supersedeLoginOtp(mobileFingerprint);
        UUID administratorId = persistence.findEnabledAdministratorByMobile(normalizedMobile);
        String code = newOtp();
        long expiresAt = Math.addExact(now, OTP_TTL_MILLIS);
        persistence.insertLoginOtp(
                UUID.randomUUID(), administratorId, mobileFingerprint, hash(code), expiresAt, now);
        recordOtpAttempt("PLATFORM_LOGIN_SEND", attempt, OTP_SEND_LIMIT);
        return new OtpDispatch(expiresAt, debugCodeExposure ? code : null);
    }

    @Transactional(noRollbackFor = {OtpInvalidException.class, OtpRateLimitedException.class})
    public LoginResult verifyLoginOtp(String mobile, String code, String sourceAddress) {
        String normalizedMobile = normalizedMobile(mobile);
        String mobileFingerprint = hmac("MOBILE:" + normalizedMobile);
        OtpAttempt attempt = beginOtpAttempt("PLATFORM_LOGIN_VERIFY", mobileFingerprint, sourceAddress);
        long now = timeProvider.currentEpochMillis();
        String codeHash = hash(code == null ? "" : code);
        UUID administratorId = persistence.findActiveLoginOtpAdministrator(mobileFingerprint, codeHash, now);
        if (administratorId == null || persistence.consumeLoginOtp(now, mobileFingerprint, codeHash) != 1) {
            persistence.incrementLoginOtpAttempts(mobileFingerprint);
            recordOtpAttempt("PLATFORM_LOGIN_VERIFY", attempt, OTP_VERIFY_LIMIT);
            throw new OtpInvalidException();
        }
        PlatformAuthenticationPersistence.CredentialRow credential =
                persistence.findCredentialByAdministrator(administratorId, normalizedMobile);
        if (credential == null || !"ENABLED".equals(credential.status())) {
            recordOtpAttempt("PLATFORM_LOGIN_VERIFY", attempt, OTP_VERIFY_LIMIT);
            throw new OtpInvalidException();
        }
        clearOtpAttempts("PLATFORM_LOGIN_VERIFY", attempt);
        return createSession(credential.platformAdminId(), credential.displayName(), now);
    }

    @Transactional(noRollbackFor = OtpRateLimitedException.class)
    public RecoveryStart startPasswordRecovery(String loginName, String mobile, String sourceAddress) {
        String normalizedLoginName = normalize(loginName);
        String normalizedMobile = normalizedMobile(mobile);
        RecoveryStartAttempt attempt = beginRecoveryStartAttempt(normalizedLoginName, normalizedMobile, sourceAddress);
        long now = timeProvider.currentEpochMillis();
        UUID administratorId = persistence.findRecoveryAdministrator(normalizedLoginName, normalizedMobile);
        String token = newToken();
        persistence.insertRecoveryFlow(
                UUID.randomUUID(),
                hash(token),
                normalizedLoginName,
                normalizedMobile,
                administratorId,
                Math.addExact(now, RECOVERY_FLOW_TTL_MILLIS),
                now);
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
        persistence.supersedeRecoveryOtp(flow.id());
        String code = newOtp();
        long expiresAt = Math.addExact(now, OTP_TTL_MILLIS);
        persistence.insertRecoveryOtp(
                UUID.randomUUID(),
                flow.platformAdminId(),
                flow.id(),
                mobileFingerprint,
                hash(code),
                expiresAt,
                now);
        recordOtpAttempt("PLATFORM_RECOVERY_SEND", attempt, OTP_SEND_LIMIT);
        return new OtpDispatch(expiresAt, debugCodeExposure ? code : null);
    }

    @Transactional(
            noRollbackFor = {
                OtpInvalidException.class,
                OtpRateLimitedException.class,
                RecoveryFlowInvalidException.class
            })
    public RecoveryVerification verifyPasswordRecoveryOtp(
            PasswordRecoveryFlowCredential recoveryFlow, String code, String sourceAddress) {
        RecoveryFlow flow = requireRecoveryFlow(recoveryFlow.rawValue(), "PENDING");
        String mobileFingerprint = hmac("MOBILE:" + flow.mobileNormalized());
        OtpAttempt attempt = beginOtpAttempt("PLATFORM_RECOVERY_VERIFY", mobileFingerprint, sourceAddress);
        long now = timeProvider.currentEpochMillis();
        int consumed = persistence.consumeRecoveryOtp(now, flow.id(), hash(code == null ? "" : code));
        if (consumed != 1 || !recoveryIdentityStillEligible(flow)) {
            persistence.incrementRecoveryOtpAttempts(flow.id());
            recordOtpAttempt("PLATFORM_RECOVERY_VERIFY", attempt, OTP_VERIFY_LIMIT);
            throw new OtpInvalidException();
        }
        if (persistence.markRecoveryVerified(now, flow.id()) != 1) throw new RecoveryFlowInvalidException();
        clearOtpAttempts("PLATFORM_RECOVERY_VERIFY", attempt);
        return new RecoveryVerification("PASSWORD_REQUIRED");
    }

    @Transactional(noRollbackFor = RecoveryFlowInvalidException.class)
    public PasswordChangeResult completePasswordRecovery(
            PasswordRecoveryFlowCredential recoveryFlow, char[] newPassword) {
        if (newPassword == null || newPassword.length < 8) throw new InvalidAdministratorInputException();
        RecoveryFlow flow = requireRecoveryFlow(recoveryFlow.rawValue(), "VERIFIED");
        if (!recoveryIdentityStillEligible(flow) || flow.platformAdminId() == null)
            throw new RecoveryFlowInvalidException();
        long now = timeProvider.currentEpochMillis();
        persistence.updateRecoveryCredential(
                passwordEncoder.encode(new String(newPassword)), now, flow.platformAdminId());
        persistence.revokeRecoverySessions(now, flow.platformAdminId());
        if (persistence.markRecoveryCompleted(now, flow.id()) != 1) throw new RecoveryFlowInvalidException();
        return new PasswordChangeResult("COMPLETED", true, true);
    }

    @Transactional(
            noRollbackFor = {
                InvalidCredentialsException.class,
                AccountDisabledException.class,
                CredentialLockedException.class,
                LoginRateLimitedException.class
            })
    public LoginResult login(String loginName, char[] password) {
        return login(loginName, password, "legacy-test-source");
    }

    /** Source address is converted to an owner-local HMAC before storage; raw source data never leaves the edge. */
    @Transactional(
            noRollbackFor = {
                InvalidCredentialsException.class,
                AccountDisabledException.class,
                CredentialLockedException.class,
                LoginRateLimitedException.class
            })
    public LoginResult login(String loginName, char[] password, String sourceAddress) {
        String normalized = normalize(loginName);
        LoginAttempt attempt = beginLoginAttempt(normalized, sourceAddress);
        Optional<PlatformAuthenticationPersistence.CredentialRow> row =
                persistence.findCredentialByLoginName(normalized);
        if (row.isEmpty()) {
            recordInvalidLogin(attempt);
            throw new InvalidCredentialsException();
        }
        PlatformAuthenticationPersistence.CredentialRow credential = row.get();
        long now = timeProvider.currentEpochMillis();
        if (!"ENABLED".equals(credential.status())) {
            recordSourceFailure(attempt);
            throw new AccountDisabledException();
        }
        if (credential.lockedUntilEpochMillis() != null && credential.lockedUntilEpochMillis() > now)
            throw new CredentialLockedException();
        if (!passwordEncoder.matches(
                new String(password == null ? new char[0] : password), credential.passwordHash())) {
            recordInvalidLogin(attempt);
            persistence.recordLoginFailure(
                    now, CREDENTIAL_FAILURE_LIMIT, now + CREDENTIAL_LOCK_MILLIS, credential.platformAdminId());
            throw new InvalidCredentialsException();
        }
        clearAccountFailures(attempt);
        persistence.clearCredentialFailures(credential.platformAdminId());
        return createSession(credential.platformAdminId(), credential.displayName(), now);
    }

    @Transactional(readOnly = true)
    public PlatformSessionReadback requireActiveSession(String token) {
        long now = timeProvider.currentEpochMillis();
        PlatformAuthenticationPersistence.SessionRow session = persistence.findActiveSession(hash(token), now);
        if (session == null) throw new SessionExpiredException();
        return new PlatformSessionReadback(
                session.id(), session.version(), session.adminId(), session.displayName(), session.expiresAtEpochMillis());
    }

    @Transactional
    public void logout(String token) {
        long now = timeProvider.currentEpochMillis();
        persistence.revokeSession(hash(token), now);
    }

    /** Rotation revokes every session, including the caller, so a fresh login is mandatory. */
    @Transactional
    public PasswordChangeResult changeCurrentPassword(
            String token, char[] currentPassword, char[] newPassword, long expectedSessionVersion) {
        if (newPassword == null || newPassword.length < 8) throw new InvalidAdministratorInputException();
        PlatformAuthenticationPersistence.SessionCredential session =
                persistence.findSessionCredential(hash(token), timeProvider.currentEpochMillis());
        if (session == null) throw new SessionExpiredException();
        if (session.version() != expectedSessionVersion) throw new PlatformAdminVersionConflictException();
        if (!passwordEncoder.matches(
                new String(currentPassword == null ? new char[0] : currentPassword), session.passwordHash()))
            throw new InvalidCredentialsException();
        long now = timeProvider.currentEpochMillis();
        persistence.updatePasswordCredential(passwordEncoder.encode(new String(newPassword)), now, session.adminId());
        persistence.revokePasswordSessions(now, session.adminId());
        return new PasswordChangeResult("COMPLETED", true, true);
    }

    /** Administrative reset is an explicit password replacement, never a secret readback. */
    @Transactional
    public PlatformAdminReadback resetAdministratorCredential(UUID adminId, char[] password, long expectedVersion) {
        return resetAdministratorCredential(adminId, password, expectedVersion, AuditActor.system());
    }

    @Transactional
    public PlatformAdminReadback resetAdministratorCredential(
            UUID adminId, char[] password, long expectedVersion, AuditActor actor) {
        requireEnabledPlatformAdministrator(actor);
        if (password == null || password.length < 8) throw new InvalidAdministratorInputException();
        long now = timeProvider.currentEpochMillis();
        if (persistence.updateAdministratorVersion(now, adminId, expectedVersion) != 1)
            throw new PlatformAdminVersionConflictException();
        persistence.updateResetCredential(passwordEncoder.encode(new String(password)), now, adminId);
        persistence.revokeRecoverySessions(now, adminId);
        audit(adminId, "PLATFORM_ADMIN_CREDENTIAL_RESET", now, actor, ADMIN_CREDENTIAL_RESET.allow(List.of()));
        return requireAdministrator(adminId);
    }

    @Transactional
    public PlatformAdminReadback resetAdministratorCredential(
            UUID adminId, char[] password, long expectedVersion, String idempotencyKey) {
        return resetAdministratorCredential(adminId, password, expectedVersion, idempotencyKey, AuditActor.system());
    }

    @Transactional
    public PlatformAdminReadback resetAdministratorCredential(
            UUID adminId, char[] password, long expectedVersion, String idempotencyKey, AuditActor actor) {
        requireEnabledPlatformAdministrator(actor);
        return receipts.execute(
                idempotencyKey,
                canonical(
                        "reset",
                        adminId.toString(),
                        String.valueOf(expectedVersion),
                        hash(new String(password == null ? new char[0] : password))),
                () -> resetAdministratorCredential(adminId, password, expectedVersion, actor));
    }

    /** Owner-bounded platform-administrator query; the edge never materializes or slices this population. */
    @Transactional(readOnly = true)
    public PlatformAdminPage pageAdministrators(
            String userName,
            String loginName,
            String status,
            int page,
            int pageSize,
            String sortKey,
            String sortDirection) {
        return pageAdministratorsWithBudget(userName, loginName, status, page, pageSize, sortKey, sortDirection);
    }

    /** Platform task-read page boundary: the bounded primary read and its matching count stay separately measurable. */
    @Transactional(readOnly = true)
    public PlatformAdminPage platformAdministratorPage(
            String userName,
            String loginName,
            String status,
            int page,
            int pageSize,
            String sortKey,
            String sortDirection) {
        return pageAdministratorsWithBudget(userName, loginName, status, page, pageSize, sortKey, sortDirection);
    }

    private PlatformAdminPage pageAdministratorsWithBudget(
            String userName,
            String loginName,
            String status,
            int page,
            int pageSize,
            String sortKey,
            String sortDirection) {
        if (page < 1
                || pageSize < 1
                || pageSize > 100
                || !validFilter(userName, 128)
                || !validFilter(loginName, 64)
                || (status != null && !Set.of("ENABLED", "DISABLED").contains(status))
                || !Set.of("USER_NAME", "LOGIN_NAME", "LAST_LOGIN_AT", "UPDATED_AT")
                        .contains(sortKey)
                || !Set.of("ASC", "DESC").contains(sortDirection)) throw new InvalidAdministratorInputException();
        Long total = ReadBudgetComponent.measure(
                ReadBudgetComponent.Component.OPTIONAL_COUNT,
                () -> persistence.countAdministrators(userName, loginName, status));
        long offset;
        try {
            offset = Math.multiplyExact((long) page - 1, pageSize);
        } catch (ArithmeticException exception) {
            throw new InvalidAdministratorInputException(exception);
        }
        List<PlatformAdminReadback> items = ReadBudgetComponent.measure(
                ReadBudgetComponent.Component.PRIMARY_QUERY,
                () -> persistence.readAdministratorsPage(
                                userName, loginName, status, pageSize, offset, sortKey, sortDirection)
                        .stream()
                        .map(PlatformAuthenticationService::mapReadback)
                        .toList());
        return new PlatformAdminPage(items, page, pageSize, total == null ? 0L : total, sortKey, sortDirection);
    }

    @Transactional(readOnly = true)
    public PlatformAdminReadback requireAdministrator(UUID id) {
        PlatformAuthenticationPersistence.AdministratorRow row = persistence.readAdministrator(id);
        if (row == null) throw new PlatformAdminNotFoundException();
        return mapReadback(row);
    }

    /** Platform task-read detail boundary; command readbacks continue to use {@link #requireAdministrator(UUID)}. */
    @Transactional(readOnly = true)
    public PlatformAdminReadback platformAdministratorDetail(UUID id) {
        return ReadBudgetComponent.measure(ReadBudgetComponent.Component.PRIMARY_QUERY, () -> requireAdministrator(id));
    }

    @Transactional
    public PlatformAdminReadback transitionAdministratorStatus(UUID id, String targetStatus, long expectedVersion) {
        return transitionAdministratorStatus(id, targetStatus, expectedVersion, AuditActor.system());
    }

    @Transactional
    public PlatformAdminReadback transitionAdministratorStatus(
            UUID id, String targetStatus, long expectedVersion, AuditActor actor) {
        requireEnabledPlatformAdministrator(actor);
        if (!"ENABLED".equals(targetStatus) && !"DISABLED".equals(targetStatus))
            throw new InvalidAdministratorStatusException();
        long now = timeProvider.currentEpochMillis();
        if ("DISABLED".equals(targetStatus)) requireDeactivationAllowed(id, actor);
        int changed = persistence.updateAdministratorStatus(targetStatus, now, id, expectedVersion);
        if (changed == 0) throw new PlatformAdminVersionConflictException();
        if ("DISABLED".equals(targetStatus))
            persistence.revokeRecoverySessions(now, id);
        audit(
                id,
                "PLATFORM_ADMIN_STATUS_CHANGED",
                now,
                actor,
                ADMIN_STATUS_CHANGED.allow(List.of(AuditChange.forNullableScalar("status", null, targetStatus))));
        return requireAdministrator(id);
    }

    @Transactional
    public PlatformAdminReadback transitionAdministratorStatus(
            UUID id, String targetStatus, long expectedVersion, String idempotencyKey) {
        return transitionAdministratorStatus(id, targetStatus, expectedVersion, idempotencyKey, AuditActor.system());
    }

    @Transactional
    public PlatformAdminReadback transitionAdministratorStatus(
            UUID id, String targetStatus, long expectedVersion, String idempotencyKey, AuditActor actor) {
        requireEnabledPlatformAdministrator(actor);
        return receipts.execute(
                idempotencyKey,
                canonical("status", id.toString(), targetStatus, String.valueOf(expectedVersion)),
                () -> transitionAdministratorStatus(id, targetStatus, expectedVersion, actor));
    }

    @Transactional
    public PlatformAdminReadback createAdministrator(
            String loginName, String displayName, String mobile, char[] initialPassword) {
        return createAdministrator(loginName, displayName, mobile, initialPassword, AuditActor.system());
    }

    /**
     * Establishes the sole initial administrator for a diagnostic-owned empty database. This is not an HTTP capability
     * and cannot create a second administrator or bypass normal actor checks.
     */
    @Transactional
    @Override
    public DiagnosticAdministrator bootstrapFirstAdministrator(
            String loginName, String displayName, char[] initialPassword) {
        persistence.lockBootstrapAdministratorTable();
        Long existing = persistence.countBootstrapAdministrators();
        if (existing == null || existing != 0L) throw new DiagnosticBootstrapUnavailableException();
        PlatformAdminReadback created =
                createAdministratorForDiagnosticBootstrap(loginName, displayName, initialPassword);
        return new DiagnosticAdministrator(created.id(), created.loginName());
    }

    private PlatformAdminReadback createAdministratorForDiagnosticBootstrap(
            String loginName, String displayName, char[] initialPassword) {
        String normalized = normalize(loginName);
        if (displayName == null
                || displayName.trim().isEmpty()
                || initialPassword == null
                || initialPassword.length < 8) throw new InvalidAdministratorInputException();
        UUID id = UUID.randomUUID();
        long now = timeProvider.currentEpochMillis();
        try {
            persistence.insertBootstrapAdministrator(id, loginName.trim(), normalized, displayName.trim(), now);
            persistence.insertBootstrapCredential(id, passwordEncoder.encode(new String(initialPassword)), now);
        } catch (org.springframework.dao.DuplicateKeyException exception) {
            throw new LoginNameConflictException(exception);
        }
        audit(
                id,
                "PLATFORM_DIAGNOSTIC_ADMIN_BOOTSTRAPPED",
                now,
                AuditActor.system(),
                ADMIN_CREATED.allow(List.of(AuditChange.forNullableScalar("displayName", null, displayName.trim()))));
        return requireAdministrator(id);
    }

    @Transactional
    public PlatformAdminReadback createAdministrator(
            String loginName, String displayName, String mobile, char[] initialPassword, AuditActor actor) {
        requireEnabledPlatformAdministrator(actor);
        String normalized = normalize(loginName);
        if (displayName == null
                || displayName.trim().isEmpty()
                || initialPassword == null
                || initialPassword.length < 8) throw new InvalidAdministratorInputException();
        UUID id = UUID.randomUUID();
        long now = timeProvider.currentEpochMillis();
        try {
            String displayMobile = optionalMobile(mobile);
            persistence.insertAdministrator(
                    id,
                    loginName.trim(),
                    normalized,
                    displayName.trim(),
                    displayMobile,
                    displayMobile == null ? null : normalizedMobile(displayMobile),
                    now);
            persistence.insertAdministratorCredential(
                    id, passwordEncoder.encode(new String(initialPassword)), now);
        } catch (org.springframework.dao.DuplicateKeyException exception) {
            throw new LoginNameConflictException(exception);
        }
        audit(
                id,
                "PLATFORM_ADMIN_CREATED",
                now,
                actor,
                ADMIN_CREATED.allow(List.of(AuditChange.forNullableScalar("displayName", null, displayName.trim()))));
        return requireAdministrator(id);
    }

    @Transactional
    public PlatformAdminReadback createAdministrator(
            String loginName, String displayName, String mobile, char[] initialPassword, String idempotencyKey) {
        return createAdministrator(
                loginName, displayName, mobile, initialPassword, idempotencyKey, AuditActor.system());
    }

    @Transactional
    public PlatformAdminReadback createAdministrator(
            String loginName,
            String displayName,
            String mobile,
            char[] initialPassword,
            String idempotencyKey,
            AuditActor actor) {
        requireEnabledPlatformAdministrator(actor);
        return receipts.execute(
                idempotencyKey,
                canonical(
                        "create",
                        loginName,
                        displayName,
                        mobile,
                        hash(new String(initialPassword == null ? new char[0] : initialPassword))),
                () -> createAdministrator(loginName, displayName, mobile, initialPassword, actor));
    }

    @Transactional
    public PlatformAdminReadback createAdministrator(String loginName, String displayName, char[] initialPassword) {
        return createAdministrator(loginName, displayName, null, initialPassword);
    }

    @Transactional
    public PlatformAdminReadback updateAdministratorProfile(
            UUID id, String displayName, String mobile, long expectedVersion) {
        return updateAdministratorProfile(id, displayName, mobile, expectedVersion, AuditActor.system());
    }

    @Transactional
    public PlatformAdminReadback updateAdministratorProfile(
            UUID id, String displayName, String mobile, long expectedVersion, AuditActor actor) {
        requireEnabledPlatformAdministrator(actor);
        if (displayName == null || displayName.trim().isEmpty()) throw new InvalidAdministratorInputException();
        long now = timeProvider.currentEpochMillis();
        String displayMobile = optionalMobile(mobile);
        int changed = persistence.updateAdministratorProfile(
                displayName.trim(),
                displayMobile,
                displayMobile == null ? null : normalizedMobile(displayMobile),
                now,
                id,
                expectedVersion);
        if (changed == 0) throw new PlatformAdminVersionConflictException();
        audit(
                id,
                "PLATFORM_ADMIN_PROFILE_UPDATED",
                now,
                actor,
                ADMIN_PROFILE_UPDATED.allow(List.of(AuditChange.forNullableScalar("displayName", null, displayName.trim()))));
        return requireAdministrator(id);
    }

    @Transactional
    public PlatformAdminReadback updateAdministratorProfile(
            UUID id, String displayName, String mobile, long expectedVersion, String idempotencyKey) {
        return updateAdministratorProfile(
                id, displayName, mobile, expectedVersion, idempotencyKey, AuditActor.system());
    }

    @Transactional
    public PlatformAdminReadback updateAdministratorProfile(
            UUID id, String displayName, String mobile, long expectedVersion, String idempotencyKey, AuditActor actor) {
        requireEnabledPlatformAdministrator(actor);
        return receipts.execute(
                idempotencyKey,
                canonical("profile", id.toString(), displayName, mobile, String.valueOf(expectedVersion)),
                () -> updateAdministratorProfile(id, displayName, mobile, expectedVersion, actor));
    }

    @Transactional
    public PlatformAdminReadback updateAdministratorProfile(UUID id, String displayName, long expectedVersion) {
        if (displayName == null || displayName.trim().isEmpty()) throw new InvalidAdministratorInputException();
        long now = timeProvider.currentEpochMillis();
        if (persistence.updateAdministratorDisplayName(displayName.trim(), now, id, expectedVersion) != 1)
            throw new PlatformAdminVersionConflictException();
        audit(
                id,
                "PLATFORM_ADMIN_PROFILE_UPDATED",
                now,
                AuditActor.system(),
                ADMIN_PROFILE_UPDATED.allow(List.of(AuditChange.forNullableScalar("displayName", null, displayName.trim()))));
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
        if (actor == null
                || !"PLATFORM_ADMIN".equals(actor.actorType())
                || !persistence.isEnabledAdministrator(actor.actorId())) throw new AccountDisabledException();
    }

    private static boolean validFilter(String value, int maximumLength) {
        return value == null || value.length() <= maximumLength;
    }

    private static String canonical(String operation, String... values) {
        StringBuilder value = new StringBuilder(operation);
        for (String item : values) {
            String safe = item == null ? "<null>" : item;
            value.append('|').append(safe.length()).append(':').append(safe);
        }
        return value.toString();
    }

    private static String optionalMobile(String value) {
        if (value != null && value.length() > 32) throw new InvalidAdministratorInputException();
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static String normalizedMobile(String value) {
        String normalized = value == null ? "" : value.replace(" ", "").replace("-", "");
        if (!normalized.matches("^\\+?[0-9]{8,20}$")) throw new InvalidAdministratorInputException();
        return normalized.startsWith("+") ? normalized.substring(1) : normalized;
    }

    private LoginResult createSession(UUID administratorId, String displayName, long now) {
        UUID sessionId = UUID.randomUUID();
        String token = newToken();
        long expiresAt = Math.addExact(now, SESSION_TTL_MILLIS);
        persistence.insertSession(sessionId, administratorId, hash(token), expiresAt, now);
        return new LoginResult(
                token, new PlatformSessionReadback(sessionId, 1L, administratorId, displayName, expiresAt));
    }

    private RecoveryFlow requireRecoveryFlow(String rawToken, String status) {
        long now = timeProvider.currentEpochMillis();
        PlatformAuthenticationPersistence.RecoveryFlow flow =
                persistence.readRecoveryFlow(hash(rawToken == null ? "" : rawToken));
        if (flow == null || !status.equals(flow.status()) || flow.expiresAtEpochMillis() <= now)
            throw new RecoveryFlowInvalidException();
        return new RecoveryFlow(flow.id(), flow.loginNameNormalized(), flow.mobileNormalized(), flow.platformAdminId());
    }

    private boolean recoveryIdentityStillEligible(RecoveryFlow flow) {
        if (flow.platformAdminId() == null) return false;
        return persistence.isRecoveryIdentityEligible(
                flow.platformAdminId(), flow.loginNameNormalized(), flow.mobileNormalized());
    }

    private OtpAttempt beginOtpAttempt(String purpose, String mobileFingerprint, String sourceAddress) {
        String sourceFingerprint =
                hmac("SOURCE:" + (sourceAddress == null || sourceAddress.isBlank() ? "unknown" : sourceAddress));
        lockRateBucket(purpose + ":MOBILE", mobileFingerprint);
        lockRateBucket(purpose + ":SOURCE", sourceFingerprint);
        long now = timeProvider.currentEpochMillis();
        requireOtpRateBucketOpen(purpose, "MOBILE", mobileFingerprint, now);
        requireOtpRateBucketOpen(purpose, "SOURCE", sourceFingerprint, now);
        return new OtpAttempt(mobileFingerprint, sourceFingerprint);
    }

    private RecoveryStartAttempt beginRecoveryStartAttempt(
            String normalizedLoginName, String normalizedMobile, String sourceAddress) {
        String accountFingerprint = hmac("ACCOUNT:" + normalizedLoginName);
        String mobileFingerprint = hmac("MOBILE:" + normalizedMobile);
        String sourceFingerprint =
                hmac("SOURCE:" + (sourceAddress == null || sourceAddress.isBlank() ? "unknown" : sourceAddress));
        lockRateBucket("PLATFORM_RECOVERY_START:ACCOUNT", accountFingerprint);
        lockRateBucket("PLATFORM_RECOVERY_START:MOBILE", mobileFingerprint);
        lockRateBucket("PLATFORM_RECOVERY_START:SOURCE", sourceFingerprint);
        long now = timeProvider.currentEpochMillis();
        requireOtpRateBucketOpen("PLATFORM_RECOVERY_START", "ACCOUNT", accountFingerprint, now);
        requireOtpRateBucketOpen("PLATFORM_RECOVERY_START", "MOBILE", mobileFingerprint, now);
        requireOtpRateBucketOpen("PLATFORM_RECOVERY_START", "SOURCE", sourceFingerprint, now);
        return new RecoveryStartAttempt(accountFingerprint, mobileFingerprint, sourceFingerprint);
    }

    private void requireOtpRateBucketOpen(String purpose, String dimension, String fingerprint, long now) {
        Long lockedUntil = persistence.findOtpRateLock(purpose, dimension, fingerprint);
        if (lockedUntil != null && lockedUntil > now) throw new OtpRateLimitedException();
    }

    private void recordOtpAttempt(String purpose, OtpAttempt attempt, int threshold) {
        recordOtpRateFailure(
                purpose,
                "MOBILE",
                attempt.mobileFingerprint(),
                threshold,
                ACCOUNT_FAILURE_WINDOW_MILLIS,
                CREDENTIAL_LOCK_MILLIS);
        recordOtpRateFailure(
                purpose,
                "SOURCE",
                attempt.sourceFingerprint(),
                threshold,
                SOURCE_FAILURE_WINDOW_MILLIS,
                SOURCE_LOCK_MILLIS);
    }

    private void clearOtpAttempts(String purpose, OtpAttempt attempt) {
        persistence.clearOtpRateBucket(purpose, "MOBILE", attempt.mobileFingerprint());
        persistence.clearOtpRateBucket(purpose, "SOURCE", attempt.sourceFingerprint());
    }

    private void recordRecoveryStartAttempt(RecoveryStartAttempt attempt) {
        recordOtpRateFailure(
                "PLATFORM_RECOVERY_START",
                "ACCOUNT",
                attempt.accountFingerprint(),
                OTP_SEND_LIMIT,
                ACCOUNT_FAILURE_WINDOW_MILLIS,
                CREDENTIAL_LOCK_MILLIS);
        recordOtpRateFailure(
                "PLATFORM_RECOVERY_START",
                "MOBILE",
                attempt.mobileFingerprint(),
                OTP_SEND_LIMIT,
                ACCOUNT_FAILURE_WINDOW_MILLIS,
                CREDENTIAL_LOCK_MILLIS);
        recordOtpRateFailure(
                "PLATFORM_RECOVERY_START",
                "SOURCE",
                attempt.sourceFingerprint(),
                OTP_SEND_LIMIT,
                SOURCE_FAILURE_WINDOW_MILLIS,
                SOURCE_LOCK_MILLIS);
    }

    private void recordOtpRateFailure(
            String purpose, String dimension, String fingerprint, int threshold, long windowMillis, long lockMillis) {
        long now = timeProvider.currentEpochMillis();
        PlatformAuthenticationPersistence.RateBucket current =
                persistence.readOtpRateFailure(purpose, dimension, fingerprint);
        boolean resetWindow = current == null || now - current.windowStartedAtEpochMillis() >= windowMillis;
        long startedAt = resetWindow ? now : current.windowStartedAtEpochMillis();
        int failures = resetWindow ? 1 : current.failedAttempts() + 1;
        Long lockedUntil = failures >= threshold ? now + lockMillis : null;
        persistence.upsertOtpRateFailure(
                purpose, dimension, fingerprint, startedAt, failures, lockedUntil, now);
    }

    private LoginAttempt beginLoginAttempt(String normalizedAccount, String sourceAddress) {
        String accountFingerprint = hmac("ACCOUNT:" + normalizedAccount);
        String sourceFingerprint =
                hmac("SOURCE:" + (sourceAddress == null || sourceAddress.isBlank() ? "unknown" : sourceAddress));
        lockRateBucket("ACCOUNT", accountFingerprint);
        lockRateBucket("SOURCE", sourceFingerprint);
        long now = timeProvider.currentEpochMillis();
        requireRateBucketOpen("ACCOUNT", accountFingerprint, now);
        requireRateBucketOpen("SOURCE", sourceFingerprint, now);
        return new LoginAttempt(accountFingerprint, sourceFingerprint);
    }

    private void lockRateBucket(String dimension, String fingerprint) {
        persistence.lockLoginRateBucket(dimension, fingerprint);
    }

    private void requireRateBucketOpen(String dimension, String fingerprint, long now) {
        Long lockedUntil = persistence.findLoginRateLock(dimension, fingerprint);
        if (lockedUntil != null && lockedUntil > now) throw new LoginRateLimitedException();
    }

    private void recordInvalidLogin(LoginAttempt attempt) {
        recordRateFailure(
                "ACCOUNT",
                attempt.accountFingerprint(),
                CREDENTIAL_FAILURE_LIMIT,
                ACCOUNT_FAILURE_WINDOW_MILLIS,
                CREDENTIAL_LOCK_MILLIS);
        recordRateFailure(
                "SOURCE",
                attempt.sourceFingerprint(),
                SOURCE_FAILURE_LIMIT,
                SOURCE_FAILURE_WINDOW_MILLIS,
                SOURCE_LOCK_MILLIS);
    }

    private void recordSourceFailure(LoginAttempt attempt) {
        recordRateFailure(
                "SOURCE",
                attempt.sourceFingerprint(),
                SOURCE_FAILURE_LIMIT,
                SOURCE_FAILURE_WINDOW_MILLIS,
                SOURCE_LOCK_MILLIS);
    }

    private void recordRateFailure(
            String dimension, String fingerprint, int threshold, long windowMillis, long lockMillis) {
        long now = timeProvider.currentEpochMillis();
        PlatformAuthenticationPersistence.RateBucket current =
                persistence.readLoginRateFailure(dimension, fingerprint);
        boolean resetWindow = current == null || now - current.windowStartedAtEpochMillis() >= windowMillis;
        long startedAt = resetWindow ? now : current.windowStartedAtEpochMillis();
        int failures = resetWindow ? 1 : current.failedAttempts() + 1;
        Long lockedUntil = failures >= threshold ? now + lockMillis : null;
        persistence.upsertLoginRateFailure(
                dimension, fingerprint, startedAt, failures, lockedUntil, now);
    }

    private void clearAccountFailures(LoginAttempt attempt) {
        persistence.clearLoginAccountFailures(attempt.accountFingerprint());
    }

    private String hmac(String value) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(rateLimitHmacSecret, "HmacSHA256"));
            return java.util.HexFormat.of().formatHex(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception error) {
            throw new IllegalStateException("HMAC-SHA256 unavailable", error);
        }
    }

    private void requireDeactivationAllowed(UUID id, AuditActor actor) {
        // The count predicate spans every platform administrator, so serialize it with a
        // single owner-local transaction advisory lock before inspecting the target.
        persistence.lockAdministratorDeactivation();
        PlatformAuthenticationPersistence.AdminGuard guard = persistence.readAdministratorDeactivationGuard(id);
        if (guard == null) throw new PlatformAdminNotFoundException();
        if (guard.builtIn() || (actor != null && id.equals(actor.actorId())))
            throw new AdministratorDeactivationForbiddenException();
        Long activeCount = persistence.countEnabledAdministrators();
        if ("ENABLED".equals(guard.status()) && activeCount != null && activeCount <= 1)
            throw new AdministratorDeactivationForbiddenException();
    }

    private void audit(UUID subjectRef, String action, long now, AuditActor actor, List<AuditChange> changes) {
        persistence.insertAudit(
                UUID.randomUUID(),
                subjectRef.toString(),
                actor.actorType(),
                actor.actorId(),
                actor.displaySnapshot(),
                action,
                now,
                json(changes));
    }

    private static String json(List<AuditChange> changes) {
        return AuditChangeJson.write(changes);
    }

    private static PlatformAdminReadback mapReadback(PlatformAuthenticationPersistence.AdministratorRow row) {
        return new PlatformAdminReadback(
                row.id(),
                row.loginName(),
                row.displayName(),
                row.mobile(),
                row.status(),
                row.builtIn(),
                row.version(),
                row.createdAtEpochMillis(),
                row.updatedAtEpochMillis(),
                row.lastLoginAtEpochMillis(),
                row.auditSummary());
    }

    private String newToken() {
        byte[] bytes = new byte[32];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String newOtp() {
        return String.format("%06d", secureRandom.nextInt(1_000_000));
    }

    private static String hash(String value) {
        try {
            return Sha256Hex.digest(value);
        } catch (Exception exception) {
            throw new IllegalStateException("SHA-256 unavailable", exception);
        }
    }

    private record LoginAttempt(String accountFingerprint, String sourceFingerprint) {}

    private record OtpAttempt(String mobileFingerprint, String sourceFingerprint) {}

    private record RecoveryStartAttempt(
            String accountFingerprint, String mobileFingerprint, String sourceFingerprint) {}

    private record RecoveryFlow(UUID id, String loginNameNormalized, String mobileNormalized, UUID platformAdminId) {}

    public record LoginResult(String rawSessionToken, PlatformSessionReadback session) {}

    public record OtpDispatch(long expiresAt, String debugVerificationCode) {}

    public record RecoveryStart(String rawFlowToken) {}

    public record RecoveryVerification(String status) {}

    public record PlatformAdminReadback(
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

    public record PlatformAdminPage(
            List<PlatformAdminReadback> items,
            int page,
            int pageSize,
            long total,
            String sortKey,
            String sortDirection) {}

    public record PasswordChangeResult(String status, boolean sessionsRevoked, boolean reauthenticationRequired) {}

    public static final class InvalidCredentialsException extends RuntimeException {}

    public static final class AccountDisabledException extends RuntimeException {}
    /**
     * Diagnostic bootstrap is a process-startup fixture, not an HTTP owner fact. Keep this exception non-public so the
     * typed HTTP-problem denominator cannot mistake it for a contract-visible failure.
     */
    static final class DiagnosticBootstrapUnavailableException extends RuntimeException {}

    public static final class CredentialLockedException extends RuntimeException {}

    public static final class SessionExpiredException extends RuntimeException {}

    public static final class PlatformAdminNotFoundException extends RuntimeException {}

    public static final class PlatformAdminVersionConflictException extends RuntimeException {}

    public static final class InvalidAdministratorStatusException extends RuntimeException {}

    public static final class InvalidAdministratorInputException extends RuntimeException {
        public InvalidAdministratorInputException() {}

        public InvalidAdministratorInputException(Throwable cause) {
            super(cause);
        }
    }

    public static final class LoginNameConflictException extends RuntimeException {
        public LoginNameConflictException() {}

        public LoginNameConflictException(Throwable cause) {
            super(cause);
        }
    }

    public static final class LoginRateLimitedException extends RuntimeException {}

    public static final class OtpRateLimitedException extends RuntimeException {}

    public static final class OtpInvalidException extends RuntimeException {}

    public static final class RecoveryFlowInvalidException extends RuntimeException {}

    public static final class AdministratorDeactivationForbiddenException extends RuntimeException {}
    /** Opaque browser recovery credential; only this owner service can read the raw value. */
    public static final class PasswordRecoveryFlowCredential {
        private final String value;

        private PasswordRecoveryFlowCredential(String value) {
            this.value = value;
        }

        public static PasswordRecoveryFlowCredential fromEdgeCookie(String value) {
            return new PasswordRecoveryFlowCredential(value);
        }

        String rawValue() {
            return value;
        }

        @Override
        public String toString() {
            return "PasswordRecoveryFlowCredential[redacted]";
        }
    }
}
