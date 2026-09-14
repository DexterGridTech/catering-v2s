package com.catering.v2s.workspace.iam.application;

import com.catering.v2s.workspace.iam.application.persistence.WorkspacePasswordResetPersistence;
import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.audit.contract.AuditChangeJson;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.platform.foundation.workspace.WorkspaceStatusLookup;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Platform-owned credential reset. The temporary password is the normalized login name and the account is
 * owner-enforced into a mandatory password exit. No reset generation key, OTP, grant, or delivery channel exists in
 * this flow.
 */
@Service
public class WorkspacePasswordResetService {
    private final WorkspacePasswordResetPersistence persistence;
    private final TimeProvider time;
    private final WorkspaceIamCommandReceiptService receipts;
    private final WorkspaceStatusLookup workspaces;
    private final BCryptPasswordEncoder passwords = new BCryptPasswordEncoder();

    public WorkspacePasswordResetService(
            JdbcTemplate jdbc,
            TimeProvider time,
            WorkspaceIamCommandReceiptService receipts,
            WorkspaceStatusLookup workspaces) {
        this(new WorkspacePasswordResetPersistence(jdbc), time, receipts, workspaces);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public WorkspacePasswordResetService(
            WorkspacePasswordResetPersistence persistence,
            TimeProvider time,
            WorkspaceIamCommandReceiptService receipts,
            WorkspaceStatusLookup workspaces) {
        this.persistence = persistence;
        this.time = time;
        this.receipts = receipts;
        this.workspaces = workspaces;
    }

    @Transactional
    public PlatformRequestResult requestPlatform(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID accountId,
            long expectedVersion,
            String idempotencyKey,
            AuditActor actor) {
        return receipts.execute(
                workspaceUuid,
                idempotencyKey,
                "workspace-credential-reset|" + groupWorkspaceKey + "|" + accountId + "|" + expectedVersion,
                PlatformRequestResult.class,
                () -> reset(workspaceUuid, groupWorkspaceKey, accountId, expectedVersion, actor));
    }

    private PlatformRequestResult reset(
            UUID workspaceUuid, String groupWorkspaceKey, UUID accountId, long expectedVersion, AuditActor actor) {
        if (!workspaces.isEnabled(workspaceUuid, groupWorkspaceKey))
            throw new WorkspaceAccountService.WorkspaceDisabledException();
        WorkspacePasswordResetPersistence.AccountRow account =
                persistence.account(workspaceUuid, groupWorkspaceKey, accountId);
        if (account == null || !"ENABLED".equals(account.status()) || account.version() != expectedVersion)
            throw new ResetStateException();
        long now = time.currentEpochMillis();
        if (persistence.bumpAccountVersion(account.id(), expectedVersion, now) != 1) {
            throw new ResetStateException();
        }
        persistence.updateCredential(account.id(), passwords.encode(account.loginName()), now);
        int revoked = persistence.revokeSessions(account.id(), now);
        persistence.audit(workspaceUuid, groupWorkspaceKey, account.id(), actor, now);
        return new PlatformRequestResult(
                account.id(),
                account.loginName(),
                account.status(),
                "CHANGE_REQUIRED",
                expectedVersion + 1,
                revoked > 0);
    }

    public record PlatformRequestResult(
            UUID accountId,
            String loginName,
            String status,
            String credentialStatus,
            long revision,
            boolean sessionsRevoked) {}

    public static final class ResetStateException extends RuntimeException {}
}
