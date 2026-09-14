package com.catering.v2s.workspace.iam.application;

import com.catering.v2s.workspace.iam.application.persistence.WorkspaceLoginRateLimitPersistence;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import java.nio.charset.StandardCharsets;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Owner-local password login buckets; HMAC fingerprints ensure account names and source addresses never enter storage.
 */
@Service
public final class WorkspaceLoginRateLimitService {
    private static final int ACCOUNT_LIMIT = 10;
    private static final int SOURCE_LIMIT = 30;
    private static final long ACCOUNT_WINDOW = 15 * 60 * 1000L;
    private static final long SOURCE_WINDOW = 5 * 60 * 1000L;
    private final WorkspaceLoginRateLimitPersistence persistence;
    private final TimeProvider time;
    private final byte[] hmacSecret;

    @org.springframework.beans.factory.annotation.Autowired
    public WorkspaceLoginRateLimitService(
            WorkspaceLoginRateLimitPersistence persistence,
            TimeProvider time,
            @Value("${workspace-iam.rate-limit-hmac-secret:}") String secret) {
        this.persistence = persistence;
        this.time = time;
        if (secret == null || secret.isBlank())
            throw new IllegalStateException("workspace-iam.rate-limit-hmac-secret must be configured");
        this.hmacSecret = secret.getBytes(StandardCharsets.UTF_8);
    }
    /** Test-only compatibility constructor; the Spring constructor remains the production configuration path. */
    WorkspaceLoginRateLimitService(
            org.springframework.jdbc.core.JdbcTemplate jdbc, TimeProvider time) {
        this(new WorkspaceLoginRateLimitPersistence(jdbc), time);
    }

    private WorkspaceLoginRateLimitService(WorkspaceLoginRateLimitPersistence persistence, TimeProvider time) {
        this.persistence = persistence;
        this.time = time;
        this.hmacSecret = java.util.UUID.randomUUID().toString().getBytes(StandardCharsets.UTF_8);
    }

    public Attempt begin(String key, String loginName, String sourceAddress) {
        Attempt attempt = attempt("ACCOUNT", key, normalize(loginName), sourceAddress);
        lock(key, "ACCOUNT", attempt.accountFingerprint());
        lock(key, "SOURCE", attempt.sourceFingerprint());
        long now = time.currentEpochMillis();
        requireOpen(key, "ACCOUNT", attempt.accountFingerprint(), now);
        requireOpen(key, "SOURCE", attempt.sourceFingerprint(), now);
        return attempt;
    }
    /**
     * Recovery uses a normalized login-name/mobile pair so rotating source addresses cannot bypass the account guard.
     */
    public Attempt beginPasswordRecovery(String key, String loginName, String mobile, String sourceAddress) {
        Attempt attempt =
                attempt("PASSWORD_RECOVERY", key, normalize(loginName) + ':' + normalizeMobile(mobile), sourceAddress);
        lock(key, "ACCOUNT", attempt.accountFingerprint());
        lock(key, "SOURCE", attempt.sourceFingerprint());
        long now = time.currentEpochMillis();
        requireOpen(key, "ACCOUNT", attempt.accountFingerprint(), now);
        requireOpen(key, "SOURCE", attempt.sourceFingerprint(), now);
        return attempt;
    }

    public void recordInvalid(String key, Attempt attempt) {
        failure(key, "ACCOUNT", attempt.accountFingerprint(), ACCOUNT_LIMIT, ACCOUNT_WINDOW, ACCOUNT_WINDOW);
        failure(key, "SOURCE", attempt.sourceFingerprint(), SOURCE_LIMIT, SOURCE_WINDOW, SOURCE_WINDOW);
    }
    /** The public start result is intentionally independent of lookup outcome, so both fingerprints advance first. */
    public void recordPasswordRecoveryStart(String key, Attempt attempt) {
        recordInvalid(key, attempt);
    }

    public void recordSourceFailure(String key, Attempt attempt) {
        failure(key, "SOURCE", attempt.sourceFingerprint(), SOURCE_LIMIT, SOURCE_WINDOW, SOURCE_WINDOW);
    }

    public void clearAccount(String key, Attempt attempt) {
        persistence.clearAccount(key, attempt.accountFingerprint());
    }

    private void lock(String key, String dimension, String fingerprint) {
        persistence.lock(key, dimension, fingerprint);
    }

    private void requireOpen(String key, String dimension, String fingerprint, long now) {
        Long until = persistence.lockedUntil(key, dimension, fingerprint);
        if (until != null && until > now) throw new WorkspaceAuthenticationService.LoginRateLimitedException();
    }

    private void failure(String key, String dimension, String fingerprint, int limit, long window, long lock) {
        long now = time.currentEpochMillis();
        WorkspaceLoginRateLimitPersistence.BucketRow row = persistence.bucket(key, dimension, fingerprint);
        Bucket current = row == null ? null : new Bucket(row.windowStartedAt(), row.failedAttempts());
        boolean resetWindow = current == null || now - current.windowStartedAt() >= window;
        long started = resetWindow ? now : current.windowStartedAt();
        int attempts = resetWindow ? 1 : current.failedAttempts() + 1;
        Long until = attempts >= limit ? now + lock : null;
        persistence.upsertBucket(
                key,
                dimension,
                fingerprint,
                started,
                attempts,
                until,
                now);
    }

    private String hmac(String value) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(hmacSecret, "HmacSHA256"));
            return java.util.HexFormat.of().formatHex(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception error) {
            throw new IllegalStateException("HMAC-SHA256 unavailable", error);
        }
    }

    private Attempt attempt(String purpose, String key, String accountMaterial, String sourceAddress) {
        return new Attempt(
                hmac(purpose + ':' + key + ':' + accountMaterial), hmac("SOURCE:" + key + ':' + source(sourceAddress)));
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase(java.util.Locale.ROOT);
    }

    private static String normalizeMobile(String value) {
        String normalized = value == null ? "" : value.replace(" ", "").replace("-", "");
        return normalized.startsWith("+") ? normalized.substring(1) : normalized;
    }

    private static String source(String value) {
        return value == null || value.isBlank() ? "unknown" : value;
    }

    public record Attempt(String accountFingerprint, String sourceFingerprint) {}

    private record Bucket(long windowStartedAt, int failedAttempts) {}
}
