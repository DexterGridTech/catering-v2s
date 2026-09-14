package com.catering.v2s.workspace.iam.application;

import com.catering.v2s.workspace.iam.application.persistence.WorkspaceOtpRateLimitPersistence;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import java.util.UUID;
import org.springframework.stereotype.Service;

/** Per-subject OTP send/verify guard: three sends and five invalid verifications per ten-minute window. */
@Service
public final class WorkspaceOtpRateLimitService {
    private static final long WINDOW = 10 * 60 * 1000L;
    private final WorkspaceOtpRateLimitPersistence persistence;
    private final TimeProvider time;

    @org.springframework.beans.factory.annotation.Autowired
    public WorkspaceOtpRateLimitService(WorkspaceOtpRateLimitPersistence persistence, TimeProvider time) {
        this.persistence = persistence;
        this.time = time;
    }

    public WorkspaceOtpRateLimitService(org.springframework.jdbc.core.JdbcTemplate jdbc, TimeProvider time) {
        this(new WorkspaceOtpRateLimitPersistence(jdbc), time);
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
        persistence.clear(workspace, key, purpose, subject);
    }

    private void mutate(UUID workspace, String key, String purpose, UUID subject, boolean send, boolean failedVerify) {
        persistence.lock(workspace, purpose, subject);
        long now = time.currentEpochMillis();
        WorkspaceOtpRateLimitPersistence.BucketRow row = persistence.bucket(workspace, key, purpose, subject);
        Bucket current = row == null ? null : new Bucket(
                row.windowStartedAt(), row.sendCount(), row.verifyFailedAttempts(), row.lockedUntil());
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
        persistence.upsertBucket(
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
