package com.catering.v2s.workspace.iam.application;

import com.catering.v2s.platform.foundation.time.TimeProvider;
import java.nio.charset.StandardCharsets;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
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
    private final JdbcTemplate jdbc;
    private final TimeProvider time;
    private final byte[] hmacSecret;

    @org.springframework.beans.factory.annotation.Autowired
    public WorkspaceLoginRateLimitService(
            JdbcTemplate jdbc, TimeProvider time, @Value("${workspace-iam.rate-limit-hmac-secret:}") String secret) {
        this.jdbc = jdbc;
        this.time = time;
        if (secret == null || secret.isBlank())
            throw new IllegalStateException("workspace-iam.rate-limit-hmac-secret must be configured");
        this.hmacSecret = secret.getBytes(StandardCharsets.UTF_8);
    }
    /** Test-only compatibility constructor; the Spring constructor remains the production configuration path. */
    WorkspaceLoginRateLimitService(JdbcTemplate jdbc, TimeProvider time) {
        this.jdbc = jdbc;
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
        jdbc.update(
                "DELETE FROM workspace_iam.workspace_login_rate_limit_bucket WHERE group_workspace_key=? AND "
                        + "dimension='ACCOUNT' AND fingerprint=?",
                key,
                attempt.accountFingerprint());
    }

    private void lock(String key, String dimension, String fingerprint) {
        jdbc.queryForList("SELECT pg_advisory_xact_lock(hashtext(?))", key + ':' + dimension + ':' + fingerprint);
    }

    private void requireOpen(String key, String dimension, String fingerprint, long now) {
        Long until = jdbc.query(
                "SELECT locked_until_epoch_millis FROM workspace_iam.workspace_login_rate_limit_bucket WHERE "
                        + "group_workspace_key=? AND dimension=? AND fingerprint=?",
                statement -> {
                    statement.setString(1, key);
                    statement.setString(2, dimension);
                    statement.setString(3, fingerprint);
                },
                result -> result.next() ? result.getObject(1, Long.class) : null);
        if (until != null && until > now) throw new WorkspaceAuthenticationService.LoginRateLimitedException();
    }

    private void failure(String key, String dimension, String fingerprint, int limit, long window, long lock) {
        long now = time.currentEpochMillis();
        Bucket current = jdbc.query(
                "SELECT window_started_at_epoch_millis, failed_attempts FROM "
                        + "workspace_iam.workspace_login_rate_limit_bucket WHERE group_workspace_key=? AND dimension=? "
                        + "AND "
                        + "fingerprint=?",
                statement -> {
                    statement.setString(1, key);
                    statement.setString(2, dimension);
                    statement.setString(3, fingerprint);
                },
                result -> result.next() ? new Bucket(result.getLong(1), result.getInt(2)) : null);
        boolean resetWindow = current == null || now - current.windowStartedAt() >= window;
        long started = resetWindow ? now : current.windowStartedAt();
        int attempts = resetWindow ? 1 : current.failedAttempts() + 1;
        Long until = attempts >= limit ? now + lock : null;
        jdbc.update(
                "INSERT INTO workspace_iam.workspace_login_rate_limit_bucket (group_workspace_key, dimension, "
                        + "fingerprint, window_started_at_epoch_millis, failed_attempts, locked_until_epoch_millis, "
                        + "updated_at_epoch_millis) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (group_workspace_key, "
                        + "dimension, fingerprint) DO UPDATE SET "
                        + "window_started_at_epoch_millis=EXCLUDED.window_started_at_epoch_millis, "
                        + "failed_attempts=EXCLUDED.failed_attempts, "
                        + "locked_until_epoch_millis=EXCLUDED.locked_until_epoch_millis, "
                        + "updated_at_epoch_millis=EXCLUDED.updated_at_epoch_millis",
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
