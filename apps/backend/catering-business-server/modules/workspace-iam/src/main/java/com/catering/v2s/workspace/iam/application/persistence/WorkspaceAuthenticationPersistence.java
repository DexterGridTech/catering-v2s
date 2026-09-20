package com.catering.v2s.workspace.iam.application.persistence;

import com.catering.v2s.platform.foundation.persistence.ReadBudgetComponent;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Typed execution boundary for workspace authentication, sessions and credentials. */
@Repository
public class WorkspaceAuthenticationPersistence {
    private final JdbcTemplate jdbc;

    @Autowired
    public WorkspaceAuthenticationPersistence(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public AccountRow accountByLogin(String groupWorkspaceKey, String normalizedLoginName) {
        return jdbc.query(
                WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_SELECT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_STATUS_PASSWORD_HASH
                        + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_LOCKED_UNTIL_EPOCH_MILLIS
                        + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_WORKSPACE_ACCOUNT_OPERATIONS_TITLE_LOGO_ASSET_REF
                        + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_WORKSPACE_CREDENTIAL_ACCOUNT_ID
                        + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_GROUP_WORKSPACE_WORKSPACE_UUID
                        + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_GROUP_WORKSPACE_KEY
                        + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_LOGIN_NAME_NORMALIZED,
                statement -> {
                    statement.setString(1, groupWorkspaceKey);
                    statement.setString(2, normalizedLoginName);
                },
                result -> result.next() ? account(result, true) : null);
    }

    public int recordPasswordFailure(UUID accountId, long lockedUntil) {
        return jdbc.update(
                WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_UPDATE_WORKSPACE_CREDENTIAL_FAILED_ATTEMPTS
                        + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_LOCKED_UNTIL_EPOCH_MILLIS_FAILED_ATTEMPTS
                        + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_LOCKED_UNTIL_EPOCH_MILLIS_VERSION_ACCOUNT_ID,
                lockedUntil,
                accountId);
    }

    public int supersedeLoginOtp(UUID accountId) {
        return jdbc.update(
                WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_UPDATE_OTP_GRANT_STATUS_SUPERSEDED_SUBJECT_REF
                        + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_PURPOSE_WORKSPACE_LOGIN_STATUS_ACTIVE,
                accountId);
    }

    public int insertLoginOtp(
            UUID id,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String tokenHash,
            UUID accountId,
            long expiresAt) {
        return jdbc.update(
                WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_INSERT_INTO_OTP_GRANT
                        + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_SUBJECT_REF
                        + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_ACTIVE,
                id,
                workspaceUuid,
                groupWorkspaceKey,
                tokenHash,
                accountId,
                expiresAt);
    }

    public int consumeLoginOtp(long now, UUID accountId, String tokenHash) {
        return jdbc.update(
                WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_UPDATE_OTP_GRANT_STATUS_USED_USED_AT_EPOCH_MILLIS_SUBJECT_REF
                        + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_PURPOSE_WORKSPACE_LOGIN_TOKEN_HASH_STATUS
                        + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_EXPIRES_AT_EPOCH_MILLIS,
                now,
                accountId,
                tokenHash,
                now);
    }

    public int incrementLoginOtpAttempts(UUID accountId) {
        return jdbc.update(
                WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_UPDATE_OTP_GRANT_ATTEMPT_COUNT_SUBJECT_REF
                        + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_PURPOSE_WORKSPACE_LOGIN_STATUS_ACTIVE_ALTERNATE_A,
                accountId);
    }

    public int selectAssignment(
            UUID sessionId,
            UUID assignmentId,
            UUID regionId,
            UUID projectId,
            UUID storeId,
            UUID headCompanyId,
            long expectedContextVersion) {
        return jdbc.update(
                WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_UPDATE_WORKSPACE_SESSION_CURRENT_ASSIGNMENT_ID_SELECTED_REGION_ID
                        + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_SELECT_SELECTED_PROJECT_ID
                        + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_CONTEXT_VERSION_AUTHORIZATION_REVISION
                        + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_WHERE_CONTEXT_VERSION,
                assignmentId,
                regionId,
                projectId,
                storeId,
                headCompanyId,
                sessionId,
                expectedContextVersion);
    }

    public int selectDataNode(
            UUID sessionId,
            UUID regionId,
            UUID projectId,
            UUID storeId,
            UUID headCompanyId,
            long expectedContextVersion) {
        return jdbc.update(
                WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_UPDATE_WORKSPACE_SESSION_SELECTED_REGION_ID_SELECTED_PROJECT_ID
                        + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_SELECT_SELECTED_STORE_ID_SELECTED_HEAD_COMPANY_ID_CONTEXT_VERSION
                        + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_AUTHORIZATION_REVISION_CONTEXT_VERSION,
                regionId,
                projectId,
                storeId,
                headCompanyId,
                sessionId,
                expectedContextVersion);
    }

    public ReadAuthorizationRow activeAuthorizationRow(String tokenHash, long now) {
        return ReadBudgetComponent.measure(
                ReadBudgetComponent.Component.CONTEXT_WORKSPACE_IAM,
                () -> jdbc.query(
                        WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_SELECT_WORKSPACE_UUID
                                + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_SELECTED_REGION_ID
                                + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_SELECTED_HEAD_COMPANY_ID
                                + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_CONTEXT_VERSION
                                + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_SERVICE_NODE_TYPE
                                + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_SERVICE_NODE_ID_PAGE_ACCESS_KEYS_CAPABILITY_KEYS
                                + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_FROM_CLAUSE_WORKSPACE_SESSION_FROM_WORKSPACE_IAM_WORKSPACE
                                + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_JOIN_WORKSPACE_ACCOUNT_ACCOUNT_ID
                                + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_JOIN_ROLE_ASSIGNMENT_CURRENT_ASSIGNMENT_ID
                                + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_CONDITION_ACCOUNT_ID_WORKSPACE_UUID
                                + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_CONDITION_GROUP_WORKSPACE_KEY_STATUS_ACTIVE
                                + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_JOIN_WORKSPACE_ROLE_ROLE_ID
                                + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_WORKSPACE_UUID
                                + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_CONDITION_GROUP_WORKSPACE_KEY_STATUS_ENABLED
                                + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_WHERE_TOKEN_HASH_STATUS_ACTIVE_EXPIRES_AT_EPOCH_MILLIS,
                        statement -> {
                            statement.setString(1, tokenHash);
                            statement.setLong(2, now);
                        },
                        result -> result.next() ? readAuthorization(result) : null));
    }

    public UUID roleIdByAssignment(UUID assignmentId) {
        return jdbc.queryForObject(
                WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_SELECT_ROLE_ASSIGNMENT_ROLE_ID_STATUS_ACTIVE,
                UUID.class,
                assignmentId);
    }

    public int logout(String tokenHash, long now) {
        return jdbc.update(
                WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_UPDATE_WORKSPACE_SESSION_STATUS_REVOKED_REVOKED_AT_EPOCH_MILLIS
                        + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_SELECT_SELECTED_REGION_ID_SELECTED_PROJECT_ID_SELECTED_STORE_ID
                        + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_SELECT_SELECTED_HEAD_COMPANY_ID_TOKEN_HASH_STATUS_ACTIVE,
                now,
                tokenHash);
    }

    public SessionCredentialRow sessionCredential(String tokenHash, long now) {
        return jdbc.query(
                WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_SELECT_ACCOUNT_ID_CONTEXT_VERSION_PASSWORD_HASH_VERSION
                        + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_WORKSPACE_CREDENTIAL_WORKSPACE_SESSION
                        + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_ACCOUNT_ID_TOKEN_HASH_STATUS_ACTIVE
                        + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_EXPIRES_AT_EPOCH_MILLIS_ALTERNATE_A,
                statement -> {
                    statement.setString(1, tokenHash);
                    statement.setLong(2, now);
                },
                result -> result.next()
                        ? new SessionCredentialRow(
                                result.getObject(1, UUID.class),
                                result.getObject(2, UUID.class),
                                result.getLong(3),
                                result.getString(4),
                                result.getLong(5))
                        : null);
    }

    public int updateCredential(
            UUID accountId,
            String passwordHash,
            long now,
            long credentialVersion,
            UUID sessionId) {
        return jdbc.update(
                WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_UPDATE_WORKSPACE_CREDENTIAL_PASSWORD_HASH_CHANGED_AT_EPOCH_MILLIS
                        + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_FAILED_ATTEMPTS
                        + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_VERSION_ACCOUNT_ID
                        + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_WORKSPACE_SESSION_STATUS_ACTIVE
                        + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_EXPIRES_AT_EPOCH_MILLIS_ALTERNATE_B,
                passwordHash,
                now,
                accountId,
                credentialVersion,
                sessionId,
                now);
    }

    public int revokeAccountSessions(UUID accountId, long now) {
        return jdbc.update(
                WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_UPDATE_WORKSPACE_SESSION_STATUS_REVOKED_REVOKED_AT_EPOCH_MILLIS_ALTERNATE_A
                        + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_SELECT_SELECTED_REGION_ID_SELECTED_PROJECT_ID_SELECTED_STORE_ID_ALTERNATE_A
                        + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_SELECT_SELECTED_HEAD_COMPANY_ID_ACCOUNT_ID_STATUS_ACTIVE,
                now,
                accountId);
    }

    public List<AssignmentRow> activeAssignments(UUID accountId, UUID workspaceUuid, String groupWorkspaceKey) {
        return jdbc.query(
                WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_SELECT_ROLE_ASSIGNMENT_ROLE_ID_SERVICE_NODE_TYPE_SERVICE_NODE_ID
                        + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_JOIN_WORKSPACE_ROLE_ROLE_ID_ACCOUNT_ID
                        + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_STATUS_ACTIVE,
                (row, ignored) -> new AssignmentRow(
                        row.getObject(1, UUID.class),
                        row.getObject(2, UUID.class),
                        row.getString(3),
                        row.getObject(4, UUID.class)),
                accountId,
                workspaceUuid,
                groupWorkspaceKey);
    }

    public int createSession(
            UUID sessionId,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID accountId,
            String tokenHash,
            UUID assignmentId,
            UUID regionId,
            UUID projectId,
            UUID storeId,
            UUID headCompanyId,
            long expiresAt) {
        return jdbc.update(
                WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_INSERT_INTO_WORKSPACE_SESSION
                        + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_TOKEN_HASH
                        + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_SELECT_SELECTED_STORE_ID
                        + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_SELECT_SELECTED_HEAD_COMPANY_ID
                        + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_EXPIRES_AT_EPOCH_MILLIS_ACTIVE,
                sessionId,
                workspaceUuid,
                groupWorkspaceKey,
                accountId,
                tokenHash,
                assignmentId,
                regionId,
                projectId,
                storeId,
                headCompanyId,
                expiresAt);
    }

    public int recordAuthentication(
            UUID historyId, UUID workspaceUuid, String groupWorkspaceKey, UUID accountId, long now) {
        return jdbc.update(
                WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_INSERT_INTO_WORKSPACE_AUTHENTICATION_HISTORY
                        + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_ACCOUNT_ID_AUTHENTICATED_AT_EPOCH_MILLIS,
                historyId,
                workspaceUuid,
                groupWorkspaceKey,
                accountId,
                now);
    }

    public AccountRow accountByMobile(String groupWorkspaceKey, String normalizedMobile) {
        return jdbc.query(
                WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_SELECT_WORKSPACE_UUID_ALTERNATE_A
                        + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_DISPLAY_NAME_NAME_OPERATIONS_TITLE_LOGO_ASSET_REF
                        + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_WORKSPACE_CREDENTIAL_WORKSPACE_ACCOUNT
                        + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_GROUP_WORKSPACE_ACCOUNT_ID
                        + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY
                        + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_GROUP_WORKSPACE_KEY_MOBILE_NORMALIZED,
                statement -> {
                    statement.setString(1, groupWorkspaceKey);
                    statement.setString(2, normalizedMobile);
                },
                result -> result.next() ? account(result, false) : null);
    }

    public SessionRow session(String tokenHash, long now) {
        return jdbc.query(
                WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_SELECT_WORKSPACE_UUID_ALTERNATE_B
                        + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_SELECTED_REGION_ID_ALTERNATE_A
                        + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_SELECTED_HEAD_COMPANY_ID_ALTERNATE_A
                        + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_CONTEXT_VERSION_ALTERNATE_A
                        + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_WORKSPACE_SESSION
                        + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_WORKSPACE_ACCOUNT_ACCOUNT_ID
                        + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_WORKSPACE_CREDENTIAL
                        + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_GROUP_WORKSPACE_ACCOUNT_ID_ALTERNATE_A
                        + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_ALTERNATE_A
                        + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_TOKEN_HASH_STATUS_ACTIVE_EXPIRES_AT_EPOCH_MILLIS,
                statement -> {
                    statement.setString(1, tokenHash);
                    statement.setLong(2, now);
                },
                result -> result.next() ? session(result) : null);
    }

    public AssignmentRow assignment(UUID assignmentId, UUID accountId, UUID workspaceUuid, String groupWorkspaceKey) {
        return jdbc.query(
                WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_SELECT_ROLE_ASSIGNMENT_ROLE_ID_SERVICE_NODE_TYPE_SERVICE_NODE_ID_ALTERNATE_A
                        + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_JOIN_WORKSPACE_ROLE_ROLE_ID_ACCOUNT_ID_ALTERNATE_A
                        + WorkspaceAuthenticationServiceSql.WORKSPACE_AUTHENTICATION_SERVICE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_STATUS_ACTIVE_ALTERNATE_A,
                statement -> {
                    statement.setObject(1, assignmentId);
                    statement.setObject(2, accountId);
                    statement.setObject(3, workspaceUuid);
                    statement.setString(4, groupWorkspaceKey);
                },
                result -> result.next()
                        ? new AssignmentRow(
                                result.getObject(1, UUID.class),
                                result.getObject(2, UUID.class),
                                result.getString(3),
                                result.getObject(4, UUID.class))
                        : null);
    }

    private static AccountRow account(java.sql.ResultSet result, boolean withPassword) throws java.sql.SQLException {
        return withPassword
                ? new AccountRow(
                        result.getObject(1, UUID.class),
                        result.getObject(2, UUID.class),
                        result.getString(3),
                        result.getString(4),
                        result.getString(5),
                        result.getObject(6, Long.class),
                        result.getBoolean(7),
                        result.getString(8),
                        result.getString(9),
                        result.getString(10),
                        result.getString(11))
                : new AccountRow(
                        result.getObject(1, UUID.class),
                        result.getObject(2, UUID.class),
                        result.getString(3),
                        result.getString(4),
                        null,
                        null,
                        result.getBoolean(5),
                        result.getString(6),
                        result.getString(7),
                        result.getString(8),
                        result.getString(9));
    }

    private static ReadAuthorizationRow readAuthorization(java.sql.ResultSet result) throws java.sql.SQLException {
        return new ReadAuthorizationRow(
                result.getObject(1, UUID.class),
                result.getObject(2, UUID.class),
                result.getString(3),
                result.getObject(4, UUID.class),
                result.getObject(5, UUID.class),
                result.getObject(6, UUID.class),
                result.getObject(7, UUID.class),
                result.getObject(8, UUID.class),
                result.getObject(9, UUID.class),
                result.getLong(10),
                result.getLong(11),
                result.getString(12),
                result.getObject(13, UUID.class),
                result.getString(14),
                result.getObject(15, UUID.class),
                result.getString(16),
                result.getString(17));
    }

    private static SessionRow session(java.sql.ResultSet result) throws java.sql.SQLException {
        return new SessionRow(
                result.getObject(1, UUID.class),
                result.getObject(2, UUID.class),
                result.getString(3),
                result.getObject(4, UUID.class),
                result.getObject(5, UUID.class),
                result.getObject(6, UUID.class),
                result.getObject(7, UUID.class),
                result.getObject(8, UUID.class),
                result.getObject(9, UUID.class),
                result.getLong(10),
                result.getLong(11),
                result.getString(12),
                result.getString(13),
                result.getString(14),
                result.getString(15),
                result.getBoolean(16));
    }

    public record AccountRow(
            UUID id,
            UUID workspaceUuid,
            String key,
            String status,
            String passwordHash,
            Long lockedUntilEpochMillis,
            boolean passwordChangeRequired,
            String displayName,
            String workspaceName,
            String operationsTitle,
            String logoAssetRef) {}

    public record AssignmentRow(UUID id, UUID roleId, String nodeType, UUID nodeId) {}

    public record SessionCredentialRow(
            UUID sessionId, UUID accountId, long contextVersion, String passwordHash, long credentialVersion) {}

    public record ReadAuthorizationRow(
            UUID sessionId,
            UUID workspaceUuid,
            String key,
            UUID accountId,
            UUID assignmentId,
            UUID selectedRegionId,
            UUID selectedProjectId,
            UUID selectedStoreId,
            UUID selectedHeadCompanyId,
            long contextVersion,
            long authorizationRevision,
            String accountDisplayName,
            UUID roleId,
            String assignmentNodeType,
            UUID assignmentNodeId,
            String pageAccessKeys,
            String actionCapabilityKeys) {}

    public record SessionRow(
            UUID id,
            UUID workspaceUuid,
            String key,
            UUID accountId,
            UUID assignmentId,
            UUID selectedRegionId,
            UUID selectedProjectId,
            UUID selectedStoreId,
            UUID selectedHeadCompanyId,
            long contextVersion,
            long authorizationRevision,
            String accountDisplayName,
            String workspaceName,
            String operationsTitle,
            String logoAssetRef,
            boolean passwordChangeRequired) {}
}
