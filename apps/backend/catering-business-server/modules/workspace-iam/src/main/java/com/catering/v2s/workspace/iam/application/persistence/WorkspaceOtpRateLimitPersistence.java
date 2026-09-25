package com.catering.v2s.workspace.iam.application.persistence;

import com.catering.v2s.platform.foundation.persistence.AdvisoryLock;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Typed execution boundary for subject OTP rate-limit buckets. */
@Repository
public class WorkspaceOtpRateLimitPersistence {
    private final JdbcTemplate jdbc;

    @Autowired
    public WorkspaceOtpRateLimitPersistence(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void lock(UUID workspace, String purpose, UUID subject) {
        AdvisoryLock.acquireHashText(jdbc, workspace + ":" + purpose + ':' + subject);
    }

    public BucketRow bucket(UUID workspace, String key, String purpose, UUID subject) {
        return jdbc.query(
                WorkspaceOtpRateLimitServiceSql.WORKSPACE_OTP_RATE_LIMIT_SERVICE_SELECT_WINDOW_STARTED_AT_EPOCH_MILLIS
                        + WorkspaceOtpRateLimitServiceSql
                                .WORKSPACE_OTP_RATE_LIMIT_SERVICE_FROM_CLAUSE_OTP_RATE_LIMIT_BUCKET
                        + WorkspaceOtpRateLimitServiceSql.WORKSPACE_OTP_RATE_LIMIT_SERVICE_CONDITION
                        + WorkspaceOtpRateLimitServiceSql
                                .WORKSPACE_OTP_RATE_LIMIT_SERVICE_PURPOSE_SUBJECT_REF_ALTERNATE_A,
                statement -> {
                    statement.setObject(1, workspace);
                    statement.setString(2, key);
                    statement.setString(3, purpose);
                    statement.setObject(4, subject);
                },
                result -> result.next()
                        ? new BucketRow(
                                result.getLong(1), result.getInt(2), result.getInt(3), result.getObject(4, Long.class))
                        : null);
    }

    public void upsertBucket(
            UUID workspace,
            String key,
            String purpose,
            UUID subject,
            long windowStartedAt,
            int sendCount,
            int verifyFailedAttempts,
            Long lockedUntil,
            long updatedAt) {
        jdbc.update(
                WorkspaceOtpRateLimitServiceSql.WORKSPACE_OTP_RATE_LIMIT_SERVICE_INSERT_INTO_OTP_RATE_LIMIT_BUCKET
                        + WorkspaceOtpRateLimitServiceSql.WORKSPACE_OTP_RATE_LIMIT_SERVICE_SUBJECT_REF
                        + WorkspaceOtpRateLimitServiceSql
                                .WORKSPACE_OTP_RATE_LIMIT_SERVICE_LOCKED_UNTIL_EPOCH_MILLIS_UPDATED_AT_EPOCH_MILLIS
                        + WorkspaceOtpRateLimitServiceSql.WORKSPACE_OTP_RATE_LIMIT_SERVICE_SET
                        + WorkspaceOtpRateLimitServiceSql
                                .WORKSPACE_OTP_RATE_LIMIT_SERVICE_WINDOW_STARTED_AT_EPOCH_MILLIS
                        + WorkspaceOtpRateLimitServiceSql
                                .WORKSPACE_OTP_RATE_LIMIT_SERVICE_SEND_COUNT_VERIFY_FAILED_ATTEMPTS
                        + WorkspaceOtpRateLimitServiceSql.WORKSPACE_OTP_RATE_LIMIT_SERVICE_LOCKED_UNTIL_EPOCH_MILLIS
                        + WorkspaceOtpRateLimitServiceSql
                                .WORKSPACE_OTP_RATE_LIMIT_SERVICE_UPDATE_UPDATED_AT_EPOCH_MILLIS,
                workspace,
                key,
                purpose,
                subject,
                windowStartedAt,
                sendCount,
                verifyFailedAttempts,
                lockedUntil,
                updatedAt);
    }

    public void clear(UUID workspace, String key, String purpose, UUID subject) {
        jdbc.update(
                WorkspaceOtpRateLimitServiceSql
                                .WORKSPACE_OTP_RATE_LIMIT_SERVICE_DELETE_OTP_RATE_LIMIT_BUCKET_WORKSPACE_UUID_GROUP_WORKSPACE_KEY
                        + WorkspaceOtpRateLimitServiceSql.WORKSPACE_OTP_RATE_LIMIT_SERVICE_PURPOSE_SUBJECT_REF,
                workspace,
                key,
                purpose,
                subject);
    }

    public record BucketRow(long windowStartedAt, int sendCount, int verifyFailedAttempts, Long lockedUntil) {}
}
