package com.catering.v2s.workspace.iam.application;

import com.catering.v2s.platform.foundation.time.TimeProvider;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/** Per-subject OTP send/verify guard: three sends and five invalid verifications per ten-minute window. */
@Service
public final class WorkspaceOtpRateLimitService {
    private static final long WINDOW = 10 * 60 * 1000L;
    private final JdbcTemplate jdbc;
    private final TimeProvider time;

    public WorkspaceOtpRateLimitService(JdbcTemplate jdbc, TimeProvider time) {
        this.jdbc = jdbc;
        this.time = time;
    }

    public void beforeSend(UUID workspace, String key, String purpose, UUID subject) {
        mutate(workspace, key, purpose, subject, true, false);
    }

    public void beforeVerify(UUID workspace, String key, String purpose, UUID subject) {
        mutate(workspace, key, purpose, subject, false, false);
    }

    public void invalidVerify(UUID workspace, String key, String purpose, UUID subject) {
        mutate(workspace, key, purpose, subject, false, true);
    }

    public void successfulVerify(UUID workspace, String key, String purpose, UUID subject) {
        jdbc.update(
                "DELETE FROM workspace_iam.otp_rate_limit_bucket WHERE workspace_uuid=? AND group_workspace_key=? AND "
                        + "purpose=? AND subject_ref=?",
                workspace,
                key,
                purpose,
                subject);
    }

    private void mutate(UUID workspace, String key, String purpose, UUID subject, boolean send, boolean failedVerify) {
        jdbc.queryForList("SELECT pg_advisory_xact_lock(hashtext(?))", workspace + ":" + purpose + ':' + subject);
        long now = time.currentEpochMillis();
        Bucket current = jdbc.query(
                "SELECT window_started_at_epoch_millis, send_count, verify_failed_attempts, locked_until_epoch_millis "
                        + "FROM workspace_iam.otp_rate_limit_bucket WHERE workspace_uuid=? AND group_workspace_key=? "
                        + "AND "
                        + "purpose=? AND subject_ref=?",
                statement -> {
                    statement.setObject(1, workspace);
                    statement.setString(2, key);
                    statement.setString(3, purpose);
                    statement.setObject(4, subject);
                },
                result -> result.next()
                        ? new Bucket(
                                result.getLong(1), result.getInt(2), result.getInt(3), result.getObject(4, Long.class))
                        : null);
        if (current != null && current.lockedUntil() != null && current.lockedUntil() > now)
            throw new WorkspaceAuthenticationService.OtpRateLimitedException();
        boolean resetWindow = current == null || now - current.windowStartedAt() >= WINDOW;
        long started = resetWindow ? now : current.windowStartedAt();
        int sends = resetWindow ? 0 : current.sendCount();
        int failures = resetWindow ? 0 : current.verifyFailedAttempts();
        if (send && sends >= 3) throw new WorkspaceAuthenticationService.OtpRateLimitedException();
        if (!failedVerify && !send && failures >= 5) throw new WorkspaceAuthenticationService.OtpRateLimitedException();
        if (send) sends++;
        if (failedVerify) failures++;
        Long lockedUntil = failures >= 5 ? now + WINDOW : null;
        jdbc.update(
                "INSERT INTO workspace_iam.otp_rate_limit_bucket (workspace_uuid, group_workspace_key, purpose, "
                        + "subject_ref, window_started_at_epoch_millis, send_count, verify_failed_attempts, "
                        + "locked_until_epoch_millis, updated_at_epoch_millis) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON "
                        + "CONFLICT (workspace_uuid, group_workspace_key, purpose, subject_ref) DO UPDATE SET "
                        + "window_started_at_epoch_millis=EXCLUDED.window_started_at_epoch_millis, "
                        + "send_count=EXCLUDED.send_count, verify_failed_attempts=EXCLUDED.verify_failed_attempts, "
                        + "locked_until_epoch_millis=EXCLUDED.locked_until_epoch_millis, "
                        + "updated_at_epoch_millis=EXCLUDED.updated_at_epoch_millis",
                workspace,
                key,
                purpose,
                subject,
                started,
                sends,
                failures,
                lockedUntil,
                now);
        if (lockedUntil != null) throw new WorkspaceAuthenticationService.OtpRateLimitedException();
    }

    private record Bucket(long windowStartedAt, int sendCount, int verifyFailedAttempts, Long lockedUntil) {}
}
