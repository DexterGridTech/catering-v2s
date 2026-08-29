package com.catering.v2s.workspace.iam.application;

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
    private final JdbcTemplate jdbc;
    private final TimeProvider time;
    private final WorkspaceIamCommandReceiptService receipts;
    private final WorkspaceStatusLookup workspaces;
    private final BCryptPasswordEncoder passwords = new BCryptPasswordEncoder();

    public WorkspacePasswordResetService(
            JdbcTemplate jdbc,
            TimeProvider time,
            WorkspaceIamCommandReceiptService receipts,
            WorkspaceStatusLookup workspaces) {
        this.jdbc = jdbc;
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
        Account account = jdbc.query(
                "SELECT id, login_name_normalized, status, version FROM workspace_iam.workspace_account WHERE id=? AND "
                        + "workspace_uuid=? AND group_workspace_key=?",
                statement -> {
                    statement.setObject(1, accountId);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, groupWorkspaceKey);
                },
                result -> result.next()
                        ? new Account(
                                result.getObject(1, UUID.class),
                                result.getString(2),
                                result.getString(3),
                                result.getLong(4))
                        : null);
        if (account == null || !"ENABLED".equals(account.status()) || account.version() != expectedVersion)
            throw new ResetStateException();
        long now = time.currentEpochMillis();
        if (jdbc.update(
                        "UPDATE workspace_iam.workspace_account SET version=version+1, updated_at_epoch_millis=? WHERE "
                                + "id=? AND version=?",
                        now,
                        account.id(),
                        expectedVersion)
                != 1) {
            throw new ResetStateException();
        }
        jdbc.update(
                "UPDATE workspace_iam.workspace_credential SET password_hash=?, changed_at_epoch_millis=?, "
                        + "failed_attempts=0, locked_until_epoch_millis=NULL, password_change_required=TRUE, "
                        + "version=version+1 WHERE account_id=?",
                passwords.encode(account.loginName()),
                now,
                account.id());
        int revoked = jdbc.update(
                "UPDATE workspace_iam.workspace_session SET status='REVOKED', revoked_at_epoch_millis=? WHERE "
                        + "account_id=? AND status='ACTIVE'",
                now,
                account.id());
        jdbc.update(
                "INSERT INTO workspace_iam.audit_event (id, workspace_uuid, group_workspace_key, entity_type, "
                        + "entity_ref_text, actor_type, actor_id, actor_display_snapshot, action, "
                        + "occurred_at_epoch_millis, changes_json) VALUES (?, ?, ?, 'WORKSPACE_ACCOUNT', ?, ?, ?, ?, "
                        + "'WORKSPACE_ACCOUNT_CREDENTIAL_RESET', ?, CAST(? AS JSONB))",
                UUID.randomUUID(),
                workspaceUuid,
                groupWorkspaceKey,
                account.id().toString(),
                actor.actorType(),
                actor.actorId(),
                actor.displaySnapshot(),
                now,
                AuditChangeJson.write(java.util.List.of()));
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

    private record Account(UUID id, String loginName, String status, long version) {}

    public static final class ResetStateException extends RuntimeException {}
}
