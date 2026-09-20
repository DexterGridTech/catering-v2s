package com.catering.v2s.workspace.iam.application.persistence;

import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Typed persistence boundary for the anonymous operations-password recovery flow. */
@Repository
public class WorkspacePasswordRecoveryPersistence {
    private final JdbcTemplate jdbc;

    public WorkspacePasswordRecoveryPersistence(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public int supersedeAccountRecoveries(UUID accountId) {
        return jdbc.update(
                WorkspacePasswordRecoveryServiceSql.WORKSPACE_PASSWORD_RECOVERY_SERVICE_UPDATE_OPERATIONS_PASSWORD_RECOVERY_STATUS_SUPERSEDED_VERSION
                        + WorkspacePasswordRecoveryServiceSql.WORKSPACE_PASSWORD_RECOVERY_SERVICE_WHERE_ACCOUNT_ID_STATUS_PENDING_OTP_VERIFIED,
                accountId);
    }

    public int createRecovery(
            UUID recoveryId,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID accountId,
            String flowTokenHash,
            long expiresAt,
            long now) {
        return jdbc.update(
                WorkspacePasswordRecoveryServiceSql.WORKSPACE_PASSWORD_RECOVERY_SERVICE_INSERT_INTO_OPERATIONS_PASSWORD_RECOVERY
                        + WorkspacePasswordRecoveryServiceSql.WORKSPACE_PASSWORD_RECOVERY_SERVICE_ACCOUNT_ID
                        + WorkspacePasswordRecoveryServiceSql.WORKSPACE_PASSWORD_RECOVERY_SERVICE_CREATED_AT_EPOCH_MILLIS
                        + WorkspacePasswordRecoveryServiceSql.WORKSPACE_PASSWORD_RECOVERY_SERVICE_VALUES_PENDING,
                recoveryId,
                workspaceUuid,
                groupWorkspaceKey,
                accountId,
                flowTokenHash,
                expiresAt,
                now);
    }

    public int supersedeActiveOtp(UUID recoveryId) {
        return jdbc.update(
                WorkspacePasswordRecoveryServiceSql.WORKSPACE_PASSWORD_RECOVERY_SERVICE_UPDATE_OTP_GRANT_STATUS_SUPERSEDED_SUBJECT_REF
                        + WorkspacePasswordRecoveryServiceSql.WORKSPACE_PASSWORD_RECOVERY_SERVICE_PURPOSE_OPERATIONS_PASSWORD_RECOVERY_STATUS_ACTIVE,
                recoveryId);
    }

    public int createOtp(
            UUID otpId,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String tokenHash,
            UUID recoveryId,
            long expiresAt) {
        return jdbc.update(
                WorkspacePasswordRecoveryServiceSql.WORKSPACE_PASSWORD_RECOVERY_SERVICE_INSERT_INTO_OTP_GRANT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_PURPOSE
                        + WorkspacePasswordRecoveryServiceSql.WORKSPACE_PASSWORD_RECOVERY_SERVICE_TOKEN_HASH
                        + WorkspacePasswordRecoveryServiceSql.WORKSPACE_PASSWORD_RECOVERY_SERVICE_OPERATIONS_PASSWORD_RECOVERY_ACTIVE,
                otpId,
                workspaceUuid,
                groupWorkspaceKey,
                tokenHash,
                recoveryId,
                expiresAt);
    }

    public int consumeOtp(long now, UUID recoveryId, String tokenHash) {
        return jdbc.update(
                WorkspacePasswordRecoveryServiceSql.WORKSPACE_PASSWORD_RECOVERY_SERVICE_UPDATE_OTP_GRANT_STATUS_USED_USED_AT_EPOCH_MILLIS_SUBJECT_REF
                        + WorkspacePasswordRecoveryServiceSql.WORKSPACE_PASSWORD_RECOVERY_SERVICE_PURPOSE
                        + WorkspacePasswordRecoveryServiceSql.WORKSPACE_PASSWORD_RECOVERY_SERVICE_EXPIRES_AT_EPOCH_MILLIS,
                now,
                recoveryId,
                tokenHash,
                now);
    }

    public int incrementOtpAttempt(UUID recoveryId) {
        return jdbc.update(
                WorkspacePasswordRecoveryServiceSql.WORKSPACE_PASSWORD_RECOVERY_SERVICE_UPDATE_OTP_GRANT_ATTEMPT_COUNT_SUBJECT_REF
                        + WorkspacePasswordRecoveryServiceSql.WORKSPACE_PASSWORD_RECOVERY_SERVICE_PURPOSE_OPERATIONS_PASSWORD_RECOVERY_STATUS_ACTIVE_ALTERNATE_A,
                recoveryId);
    }

    public int markOtpVerified(String completionGrantHash, long grantExpiresAt, UUID recoveryId, long version) {
        return jdbc.update(
                WorkspacePasswordRecoveryServiceSql.WORKSPACE_PASSWORD_RECOVERY_SERVICE_UPDATE_OPERATIONS_PASSWORD_RECOVERY_STATUS_OTP_VERIFIED
                        + WorkspacePasswordRecoveryServiceSql.WORKSPACE_PASSWORD_RECOVERY_SERVICE_COMPLETION_GRANT_HASH
                        + WorkspacePasswordRecoveryServiceSql.WORKSPACE_PASSWORD_RECOVERY_SERVICE_VERSION
                        + WorkspacePasswordRecoveryServiceSql.WORKSPACE_PASSWORD_RECOVERY_SERVICE_WHERE_STATUS_PENDING_VERSION,
                completionGrantHash,
                grantExpiresAt,
                recoveryId,
                version);
    }

    public int updateCredential(String passwordHash, long now, UUID accountId) {
        return jdbc.update(
                WorkspacePasswordRecoveryServiceSql.WORKSPACE_PASSWORD_RECOVERY_SERVICE_UPDATE_WORKSPACE_CREDENTIAL
                        + WorkspacePasswordRecoveryServiceSql.WORKSPACE_PASSWORD_RECOVERY_SERVICE_FAILED_ATTEMPTS
                        + WorkspacePasswordRecoveryServiceSql.WORKSPACE_PASSWORD_RECOVERY_SERVICE_VERSION_ACCOUNT_ID,
                passwordHash,
                now,
                accountId);
    }

    public int revokeSessions(long now, UUID accountId) {
        return jdbc.update(
                WorkspacePasswordRecoveryServiceSql.WORKSPACE_PASSWORD_RECOVERY_SERVICE_UPDATE_WORKSPACE_SESSION_STATUS_REVOKED_REVOKED_AT_EPOCH_MILLIS
                        + WorkspacePasswordRecoveryServiceSql.WORKSPACE_PASSWORD_RECOVERY_SERVICE_ACCOUNT_ID_STATUS_ACTIVE,
                now,
                accountId);
    }

    public int completeRecovery(long now, UUID recoveryId, long version) {
        return jdbc.update(
                WorkspacePasswordRecoveryServiceSql.WORKSPACE_PASSWORD_RECOVERY_SERVICE_UPDATE_OPERATIONS_PASSWORD_RECOVERY_STATUS_COMPLETED
                        + WorkspacePasswordRecoveryServiceSql.WORKSPACE_PASSWORD_RECOVERY_SERVICE_COMPLETION_GRANT_HASH_ALTERNATE_A
                        + WorkspacePasswordRecoveryServiceSql.WORKSPACE_PASSWORD_RECOVERY_SERVICE_COMPLETED_AT_EPOCH_MILLIS
                        + WorkspacePasswordRecoveryServiceSql.WORKSPACE_PASSWORD_RECOVERY_SERVICE_CONDITION
                        + WorkspacePasswordRecoveryServiceSql.WORKSPACE_PASSWORD_RECOVERY_SERVICE_VERSION_ALTERNATE_A,
                now,
                recoveryId,
                version);
    }

    public RecoveryRow activeRecovery(String flowTokenHash) {
        return jdbc.query(
                WorkspacePasswordRecoveryServiceSql.WORKSPACE_PASSWORD_RECOVERY_SERVICE_SELECT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_ACCOUNT_ID_STATUS
                        + WorkspacePasswordRecoveryServiceSql.WORKSPACE_PASSWORD_RECOVERY_SERVICE_COMPLETION_GRANT_HASH_ALTERNATE_B
                        + WorkspacePasswordRecoveryServiceSql.WORKSPACE_PASSWORD_RECOVERY_SERVICE_OPERATIONS_PASSWORD_RECOVERY_FLOW_TOKEN_HASH,
                statement -> statement.setString(1, flowTokenHash),
                result -> result.next()
                        ? new RecoveryRow(
                                result.getObject(1, UUID.class),
                                result.getObject(2, UUID.class),
                                result.getString(3),
                                result.getObject(4, UUID.class),
                                result.getString(5),
                                result.getLong(6),
                                result.getLong(7),
                                result.getString(8),
                                result.getObject(9, Long.class))
                        : null);
    }

    public AccountRow matchingAccount(
            UUID workspaceUuid, String groupWorkspaceKey, String loginName, String mobile) {
        return jdbc.query(
                WorkspacePasswordRecoveryServiceSql.WORKSPACE_PASSWORD_RECOVERY_SERVICE_SELECT_WORKSPACE_ACCOUNT
                        + WorkspacePasswordRecoveryServiceSql.WORKSPACE_PASSWORD_RECOVERY_SERVICE_WORKSPACE_UUID
                        + WorkspacePasswordRecoveryServiceSql.WORKSPACE_PASSWORD_RECOVERY_SERVICE_MOBILE_NORMALIZED
                        + WorkspacePasswordRecoveryServiceSql.WORKSPACE_PASSWORD_RECOVERY_SERVICE_CONDITION_STATUS_ENABLED,
                statement -> {
                    statement.setObject(1, workspaceUuid);
                    statement.setString(2, groupWorkspaceKey);
                    statement.setString(3, loginName);
                    statement.setString(4, mobile);
                },
                result -> result.next()
                        ? new AccountRow(
                                result.getObject(1, UUID.class),
                                result.getObject(2, UUID.class),
                                result.getString(3),
                                result.getString(4))
                        : null);
    }

    public AccountRow enabledAccount(UUID accountId, UUID workspaceUuid, String groupWorkspaceKey) {
        return jdbc.query(
                WorkspacePasswordRecoveryServiceSql.WORKSPACE_PASSWORD_RECOVERY_SERVICE_SELECT_WORKSPACE_ACCOUNT_ALTERNATE_A
                        + WorkspacePasswordRecoveryServiceSql.WORKSPACE_PASSWORD_RECOVERY_SERVICE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_STATUS_ENABLED,
                statement -> {
                    statement.setObject(1, accountId);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, groupWorkspaceKey);
                },
                result -> result.next()
                        ? new AccountRow(
                                result.getObject(1, UUID.class),
                                result.getObject(2, UUID.class),
                                result.getString(3),
                                result.getString(4))
                        : null);
    }

    public record RecoveryRow(
            UUID id,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID accountId,
            String status,
            long expiresAt,
            long version,
            String completionGrantHash,
            Long completionGrantExpiresAt) {}

    public record AccountRow(UUID id, UUID workspaceUuid, String groupWorkspaceKey, String status) {}
}
