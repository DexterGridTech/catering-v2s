package com.catering.v2s.workspace.iam.application.persistence;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.audit.contract.AuditChangeJson;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Typed execution boundary for platform workspace-credential reset facts and writes. */
@Repository
public class WorkspacePasswordResetPersistence {
    private final JdbcTemplate jdbc;

    @Autowired
    public WorkspacePasswordResetPersistence(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public AccountRow account(UUID workspaceUuid, String groupWorkspaceKey, UUID accountId) {
        return jdbc.query(
                WorkspacePasswordResetServiceSql
                                .WORKSPACE_PASSWORD_RESET_SERVICE_SELECT_WORKSPACE_ACCOUNT_LOGIN_NAME_NORMALIZED_STATUS_VERSION
                        + WorkspacePasswordResetServiceSql
                                .WORKSPACE_PASSWORD_RESET_SERVICE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY,
                statement -> {
                    statement.setObject(1, accountId);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, groupWorkspaceKey);
                },
                result -> result.next()
                        ? new AccountRow(
                                result.getObject(1, UUID.class),
                                result.getString(2),
                                result.getString(3),
                                result.getLong(4))
                        : null);
    }

    public int bumpAccountVersion(UUID accountId, long expectedVersion, long now) {
        return jdbc.update(
                WorkspacePasswordResetServiceSql
                                .WORKSPACE_PASSWORD_RESET_SERVICE_UPDATE_WORKSPACE_ACCOUNT_VERSION_UPDATED_AT_EPOCH_MILLIS
                        + WorkspacePasswordResetServiceSql.WORKSPACE_PASSWORD_RESET_SERVICE_VERSION,
                now,
                accountId,
                expectedVersion);
    }

    public int updateCredential(UUID accountId, String passwordHash, long now) {
        return jdbc.update(
                WorkspacePasswordResetServiceSql
                                .WORKSPACE_PASSWORD_RESET_SERVICE_UPDATE_WORKSPACE_CREDENTIAL_PASSWORD_HASH_CHANGED_AT_EPOCH_MILLIS
                        + WorkspacePasswordResetServiceSql.WORKSPACE_PASSWORD_RESET_SERVICE_FAILED_ATTEMPTS
                        + WorkspacePasswordResetServiceSql.WORKSPACE_PASSWORD_RESET_SERVICE_VERSION_ACCOUNT_ID,
                passwordHash,
                now,
                accountId);
    }

    public int revokeSessions(UUID accountId, long now) {
        return jdbc.update(
                WorkspacePasswordResetServiceSql
                                .WORKSPACE_PASSWORD_RESET_SERVICE_UPDATE_WORKSPACE_SESSION_STATUS_REVOKED_REVOKED_AT_EPOCH_MILLIS
                        + WorkspacePasswordResetServiceSql.WORKSPACE_PASSWORD_RESET_SERVICE_ACCOUNT_ID_STATUS_ACTIVE,
                now,
                accountId);
    }

    public int audit(UUID workspaceUuid, String groupWorkspaceKey, UUID accountId, AuditActor actor, long now) {
        return jdbc.update(
                WorkspacePasswordResetServiceSql.WORKSPACE_PASSWORD_RESET_SERVICE_INSERT_INTO_AUDIT_EVENT
                        + WorkspacePasswordResetServiceSql.WORKSPACE_PASSWORD_RESET_SERVICE_ENTITY_REF_TEXT
                        + WorkspacePasswordResetServiceSql.WORKSPACE_PASSWORD_RESET_SERVICE_OCCURRED_AT_EPOCH_MILLIS
                        + WorkspacePasswordResetServiceSql
                                .WORKSPACE_PASSWORD_RESET_SERVICE_WORKSPACE_ACCOUNT_CREDENTIAL_RESET,
                UUID.randomUUID(),
                workspaceUuid,
                groupWorkspaceKey,
                accountId.toString(),
                actor.actorType(),
                actor.actorId(),
                actor.displaySnapshot(),
                now,
                AuditChangeJson.write(java.util.List.of()));
    }

    public record AccountRow(UUID id, String loginName, String status, long version) {}
}
