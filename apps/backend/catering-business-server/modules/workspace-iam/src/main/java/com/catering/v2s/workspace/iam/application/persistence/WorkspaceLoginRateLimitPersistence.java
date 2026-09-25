package com.catering.v2s.workspace.iam.application.persistence;

import com.catering.v2s.platform.foundation.persistence.AdvisoryLock;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Typed execution boundary for login and password-recovery rate-limit buckets. */
@Repository
public class WorkspaceLoginRateLimitPersistence {
    private final JdbcTemplate jdbc;

    @Autowired
    public WorkspaceLoginRateLimitPersistence(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void clearAccount(String key, String accountFingerprint) {
        jdbc.update(
                WorkspaceLoginRateLimitServiceSql
                                .WORKSPACE_LOGIN_RATE_LIMIT_SERVICE_DELETE_WORKSPACE_LOGIN_RATE_LIMIT_BUCKET_GROUP_WORKSPACE_KEY
                        + WorkspaceLoginRateLimitServiceSql
                                .WORKSPACE_LOGIN_RATE_LIMIT_SERVICE_DIMENSION_ACCOUNT_FINGERPRINT,
                key,
                accountFingerprint);
    }

    public void lock(String key, String dimension, String fingerprint) {
        AdvisoryLock.acquireHashText(jdbc, key + ':' + dimension + ':' + fingerprint);
    }

    public Long lockedUntil(String key, String dimension, String fingerprint) {
        return jdbc.query(
                WorkspaceLoginRateLimitServiceSql
                                .WORKSPACE_LOGIN_RATE_LIMIT_SERVICE_SELECT_WORKSPACE_LOGIN_RATE_LIMIT_BUCKET
                        + WorkspaceLoginRateLimitServiceSql
                                .WORKSPACE_LOGIN_RATE_LIMIT_SERVICE_GROUP_WORKSPACE_KEY_DIMENSION_FINGERPRINT,
                statement -> {
                    statement.setString(1, key);
                    statement.setString(2, dimension);
                    statement.setString(3, fingerprint);
                },
                result -> result.next() ? result.getObject(1, Long.class) : null);
    }

    public BucketRow bucket(String key, String dimension, String fingerprint) {
        return jdbc.query(
                WorkspaceLoginRateLimitServiceSql
                                .WORKSPACE_LOGIN_RATE_LIMIT_SERVICE_SELECT_WINDOW_STARTED_AT_EPOCH_MILLIS_FAILED_ATTEMPTS
                        + WorkspaceLoginRateLimitServiceSql
                                .WORKSPACE_LOGIN_RATE_LIMIT_SERVICE_WORKSPACE_LOGIN_RATE_LIMIT_BUCKET
                        + WorkspaceLoginRateLimitServiceSql.WORKSPACE_LOGIN_RATE_LIMIT_SERVICE_CONDITION
                        + WorkspaceLoginRateLimitServiceSql.WORKSPACE_LOGIN_RATE_LIMIT_SERVICE_FINGERPRINT,
                statement -> {
                    statement.setString(1, key);
                    statement.setString(2, dimension);
                    statement.setString(3, fingerprint);
                },
                result -> result.next() ? new BucketRow(result.getLong(1), result.getInt(2)) : null);
    }

    public void upsertBucket(
            String key,
            String dimension,
            String fingerprint,
            long windowStartedAt,
            int failedAttempts,
            Long lockedUntil,
            long updatedAt) {
        jdbc.update(
                WorkspaceLoginRateLimitServiceSql
                                .WORKSPACE_LOGIN_RATE_LIMIT_SERVICE_INSERT_INTO_WORKSPACE_LOGIN_RATE_LIMIT_BUCKET
                        + WorkspaceLoginRateLimitServiceSql.WORKSPACE_LOGIN_RATE_LIMIT_SERVICE_FINGERPRINT_ALTERNATE_A
                        + WorkspaceLoginRateLimitServiceSql
                                .WORKSPACE_LOGIN_RATE_LIMIT_SERVICE_UPDATE_UPDATED_AT_EPOCH_MILLIS_GROUP_WORKSPACE_KEY
                        + WorkspaceLoginRateLimitServiceSql.WORKSPACE_LOGIN_RATE_LIMIT_SERVICE_SET_DIMENSION_FINGERPRINT
                        + WorkspaceLoginRateLimitServiceSql
                                .WORKSPACE_LOGIN_RATE_LIMIT_SERVICE_WINDOW_STARTED_AT_EPOCH_MILLIS
                        + WorkspaceLoginRateLimitServiceSql.WORKSPACE_LOGIN_RATE_LIMIT_SERVICE_FAILED_ATTEMPTS
                        + WorkspaceLoginRateLimitServiceSql.WORKSPACE_LOGIN_RATE_LIMIT_SERVICE_LOCKED_UNTIL_EPOCH_MILLIS
                        + WorkspaceLoginRateLimitServiceSql
                                .WORKSPACE_LOGIN_RATE_LIMIT_SERVICE_UPDATE_UPDATED_AT_EPOCH_MILLIS,
                key,
                dimension,
                fingerprint,
                windowStartedAt,
                failedAttempts,
                lockedUntil,
                updatedAt);
    }

    public record BucketRow(long windowStartedAt, int failedAttempts) {}
}
