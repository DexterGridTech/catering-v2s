package com.catering.v2s.workspace.iam.application.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Typed execution boundary for workspace invitation facts, commands and public-flow state. */
@Repository
public class WorkspaceInvitationPersistence {
    private final JdbcTemplate jdbc;

    public WorkspaceInvitationPersistence(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public int insertInvitation(
            UUID invitationId,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String tokenHash,
            String invitationToken,
            String mobileNormalized,
            String issuerDisplayNameSnapshot,
            long expiresAtEpochMillis,
            long createdAtEpochMillis) {
        return jdbc.update(
                WorkspaceInvitationServiceSql
                                .WORKSPACE_INVITATION_SERVICE_INSERT_INTO_INVITATION_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_TOKEN_HASH
                        + WorkspaceInvitationServiceSql.WORKSPACE_INVITATION_SERVICE_INVITATION_TOKEN
                        + WorkspaceInvitationServiceSql
                                .WORKSPACE_INVITATION_SERVICE_EXPIRES_AT_EPOCH_MILLIS_VERSION_CREATED_AT_EPOCH_MILLIS
                        + WorkspaceInvitationServiceSql.WORKSPACE_INVITATION_SERVICE_PENDING,
                invitationId,
                workspaceUuid,
                groupWorkspaceKey,
                tokenHash,
                invitationToken,
                mobileNormalized,
                issuerDisplayNameSnapshot,
                expiresAtEpochMillis,
                createdAtEpochMillis);
    }

    public int insertAssignmentIntent(UUID invitationId, UUID roleId, String serviceNodeType, UUID serviceNodeId) {
        return jdbc.update(
                WorkspaceInvitationServiceSql
                                .WORKSPACE_INVITATION_SERVICE_INSERT_INTO_INVITATION_ASSIGNMENT_INTENT_INVITATION_ID_ROLE_ID
                        + WorkspaceInvitationServiceSql.WORKSPACE_INVITATION_SERVICE_SERVICE_NODE_TYPE_SERVICE_NODE_ID,
                invitationId,
                roleId,
                serviceNodeType,
                serviceNodeId);
    }

    public PageRows page(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String normalizedMobile,
            String status,
            Long expiresFrom,
            Long expiresTo,
            String targetOrganizationType,
            UUID targetOrganizationRef,
            UUID roleId,
            String fixedTargetType,
            UUID fixedTargetId,
            String sort,
            String direction,
            int page,
            int pageSize) {
        List<String> clauses = new ArrayList<>(List.of(
                WorkspaceInvitationServiceSql.INVITATION_SCOPE_WORKSPACE,
                WorkspaceInvitationServiceSql.INVITATION_SCOPE_GROUP));
        List<Object> arguments = new ArrayList<>(List.of(workspaceUuid, groupWorkspaceKey));
        if (normalizedMobile != null) {
            clauses.add(WorkspaceInvitationServiceSql.INVITATION_MOBILE_LIKE);
            arguments.add("%" + normalizedMobile + "%");
        }
        if (status != null) {
            clauses.add(WorkspaceInvitationServiceSql.INVITATION_STATUS_FILTER);
            arguments.add(status);
        }
        if (expiresFrom != null) {
            clauses.add(WorkspaceInvitationServiceSql.INVITATION_EXPIRES_FROM_FILTER);
            arguments.add(expiresFrom);
        }
        if (expiresTo != null) {
            clauses.add(WorkspaceInvitationServiceSql.INVITATION_EXPIRES_TO_FILTER);
            arguments.add(expiresTo);
        }
        if (targetOrganizationType != null || targetOrganizationRef != null || roleId != null) {
            clauses.add(WorkspaceInvitationServiceSql.TARGET_ASSIGNMENT_FILTER);
            arguments.add(targetOrganizationType);
            arguments.add(targetOrganizationType);
            arguments.add(targetOrganizationRef);
            arguments.add(targetOrganizationRef);
            arguments.add(roleId);
            arguments.add(roleId);
        }
        if (fixedTargetType != null) {
            if (fixedTargetId == null) {
                clauses.add(WorkspaceInvitationServiceSql.FIXED_TARGET_TYPE_FILTER);
                arguments.add(fixedTargetType);
            } else {
                clauses.add(WorkspaceInvitationServiceSql.FIXED_TARGET_FILTER);
                arguments.add(fixedTargetType);
                arguments.add(fixedTargetId);
            }
        }
        String where = String.join(WorkspaceInvitationServiceSql.CLAUSE_JOINER, clauses);
        long total = jdbc.queryForObject(
                WorkspaceInvitationServiceSql
                                .WORKSPACE_INVITATION_SERVICE_SELECT_INVITATION_SELECT_COUNT_FROM_WORKSPACE_
                        + where,
                Long.class,
                arguments.toArray());
        if (total == 0) return new PageRows(List.of(), 0L);

        String orderColumn =
                switch (sort) {
                    case "CREATED_AT" -> WorkspaceInvitationServiceSql.CREATED_AT_ORDER;
                    case "EXPIRES_AT" -> WorkspaceInvitationServiceSql.EXPIRES_AT_ORDER;
                    default -> throw new IllegalArgumentException("unsupported invitation sort");
                };
        if (!WorkspaceInvitationServiceSql.SORT_DIRECTION_ASC.equals(direction)
                && !WorkspaceInvitationServiceSql.SORT_DIRECTION_DESC.equals(direction)) {
            throw new IllegalArgumentException("unsupported invitation direction");
        }
        String sql =
                WorkspaceInvitationServiceSql
                                .WORKSPACE_INVITATION_SERVICE_SELECT_MOBILE_NORMALIZED_STATUS_EXPIRES_AT_EPOCH_MILLIS_VERSION
                        + WorkspaceInvitationServiceSql.WORKSPACE_INVITATION_SERVICE_CREATED_AT_EPOCH_MILLIS
                        + WorkspaceInvitationServiceSql
                                .WORKSPACE_INVITATION_SERVICE_INVITATION_CANCELLED_AT_EPOCH_MILLIS_INVITATION_TOKEN
                        + where
                        + WorkspaceInvitationServiceSql.WORKSPACE_INVITATION_SERVICE_ORDER_BY_ORDER_BY_I
                        + orderColumn
                        + WorkspaceInvitationServiceSql.SQL_SPACE
                        + direction
                        + WorkspaceInvitationServiceSql.MANAGEMENT_PAGE_ORDER_SUFFIX;
        List<Object> pageArguments = new ArrayList<>(arguments);
        pageArguments.add(pageSize);
        pageArguments.add((page - 1) * pageSize);
        List<InvitationReadRow> rows = jdbc.query(sql, (result, rowNumber) -> readRow(result), pageArguments.toArray());
        return new PageRows(List.copyOf(rows), total);
    }

    public int cancel(
            UUID invitationId, UUID workspaceUuid, String groupWorkspaceKey, long cancelledAt, long expectedVersion) {
        return jdbc.update(
                WorkspaceInvitationServiceSql
                                .WORKSPACE_INVITATION_SERVICE_UPDATE_INVITATION_STATUS_CANCELLED_CANCELLED_AT_EPOCH_MILLIS
                        + WorkspaceInvitationServiceSql
                                .WORKSPACE_INVITATION_SERVICE_VERSION_WORKSPACE_UUID_GROUP_WORKSPACE_KEY
                        + WorkspaceInvitationServiceSql.WORKSPACE_INVITATION_SERVICE_STATUS
                        + WorkspaceInvitationServiceSql.WORKSPACE_INVITATION_SERVICE_PENDING_MOBILE_VERIFIED_VERSION,
                cancelledAt,
                invitationId,
                workspaceUuid,
                groupWorkspaceKey,
                expectedVersion);
    }

    public InvitationRow scopedInvitation(UUID workspaceUuid, String groupWorkspaceKey, UUID invitationId) {
        return jdbc.query(
                WorkspaceInvitationServiceSql
                                .WORKSPACE_INVITATION_SERVICE_SELECT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_MOBILE_NORMALIZED_STATUS
                        + WorkspaceInvitationServiceSql.WORKSPACE_INVITATION_SERVICE_INVITATION_VERSION_WORKSPACE_UUID
                        + WorkspaceInvitationServiceSql.WORKSPACE_INVITATION_SERVICE_GROUP_WORKSPACE_KEY,
                statement -> {
                    statement.setObject(1, invitationId);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, groupWorkspaceKey);
                },
                result -> result.next() ? invitationRow(result) : null);
    }

    public int reissue(UUID invitationId, long expectedVersion) {
        return jdbc.update(
                WorkspaceInvitationServiceSql.WORKSPACE_INVITATION_SERVICE_UPDATE_INVITATION_STATUS_REISSUED_VERSION
                        + WorkspaceInvitationServiceSql.WORKSPACE_INVITATION_SERVICE_VERSION,
                invitationId,
                expectedVersion);
    }

    public List<AssignmentIntentRow> assignmentIntents(UUID invitationId) {
        return jdbc.query(
                WorkspaceInvitationServiceSql.WORKSPACE_INVITATION_SERVICE_SELECT_INVITATION_ASSIGNMENT_INTENT
                        + WorkspaceInvitationServiceSql.WORKSPACE_INVITATION_SERVICE_WHERE_INVITATION_ID,
                (row, index) -> assignmentIntentRow(row),
                invitationId);
    }

    public int acceptIntent(UUID invitationId, long consentedAt, long expectedVersion) {
        return jdbc.update(
                WorkspaceInvitationServiceSql
                                .WORKSPACE_INVITATION_SERVICE_UPDATE_INVITATION_STATUS_ACCEPT_INTENT_RECORDED
                        + WorkspaceInvitationServiceSql
                                .WORKSPACE_INVITATION_SERVICE_CONSENTED_AT_EPOCH_MILLIS_VERSION_STATUS_PENDING
                        + WorkspaceInvitationServiceSql.WORKSPACE_INVITATION_SERVICE_CONDITION
                        + WorkspaceInvitationServiceSql.WORKSPACE_INVITATION_SERVICE_VERSION_ALTERNATE_A,
                consentedAt,
                invitationId,
                expectedVersion);
    }

    public List<String> roleNames(UUID invitationId) {
        return jdbc.query(
                WorkspaceInvitationServiceSql.WORKSPACE_INVITATION_SERVICE_SELECT_WORKSPACE_ROLE_NAME
                        + WorkspaceInvitationServiceSql
                                .WORKSPACE_INVITATION_SERVICE_JOIN_CONDITION_ROLE_ID_INVITATION_ID_NAME,
                (row, index) -> row.getString(1),
                invitationId);
    }

    public int consumeOtp(long usedAt, UUID invitationId, String tokenHash, long now) {
        return jdbc.update(
                WorkspaceInvitationServiceSql
                                .WORKSPACE_INVITATION_SERVICE_UPDATE_OTP_GRANT_STATUS_USED_USED_AT_EPOCH_MILLIS_SUBJECT_REF
                        + WorkspaceInvitationServiceSql
                                .WORKSPACE_INVITATION_SERVICE_PURPOSE_INVITATION_MOBILE_VERIFY_TOKEN_HASH_STATUS
                        + WorkspaceInvitationServiceSql.WORKSPACE_INVITATION_SERVICE_EXPIRES_AT_EPOCH_MILLIS,
                usedAt,
                invitationId,
                tokenHash,
                now);
    }

    public int incrementOtpAttempt(UUID invitationId) {
        return jdbc.update(
                WorkspaceInvitationServiceSql.WORKSPACE_INVITATION_SERVICE_UPDATE_OTP_GRANT_ATTEMPT_COUNT_SUBJECT_REF
                        + WorkspaceInvitationServiceSql
                                .WORKSPACE_INVITATION_SERVICE_PURPOSE_INVITATION_MOBILE_VERIFY_STATUS_ACTIVE,
                invitationId);
    }

    public int markMobileVerified(UUID invitationId, long expectedVersion) {
        return jdbc.update(
                WorkspaceInvitationServiceSql
                                .WORKSPACE_INVITATION_SERVICE_UPDATE_INVITATION_STATUS_MOBILE_VERIFIED_VERSION
                        + WorkspaceInvitationServiceSql
                                .WORKSPACE_INVITATION_SERVICE_STATUS_ACCEPT_INTENT_RECORDED_VERSION,
                invitationId,
                expectedVersion);
    }

    public int upsertPublicProgress(UUID invitationId, String verificationGrantHash, long expiresAt) {
        return jdbc.update(
                WorkspaceInvitationServiceSql.WORKSPACE_INVITATION_SERVICE_INSERT_INTO_INVITATION_PUBLIC_PROGRESS
                        + WorkspaceInvitationServiceSql
                                .WORKSPACE_INVITATION_SERVICE_VERIFICATION_GRANT_EXPIRES_AT_EPOC_VERSION
                        + WorkspaceInvitationServiceSql
                                .WORKSPACE_INVITATION_SERVICE_OPEN_PAREN_SET_INVITATION_ID_VERIFICATION_GRANT_HASH
                        + WorkspaceInvitationServiceSql
                                .WORKSPACE_INVITATION_SERVICE_VERIFICATION_GRANT_EXPIRES_AT_EPOCH_MILLIS_EXCLUDED_VERIFICATION_GRANT_EXPIRES_AT_EPOCH_MILLIS_EXCLUDED_VERIFICATION_GRANT_EXPIRES_AT_EPOCH_MILLIS
                        + WorkspaceInvitationServiceSql.WORKSPACE_INVITATION_SERVICE_VERSION_INVITATION_PUBLIC_PROGRESS,
                invitationId,
                verificationGrantHash,
                expiresAt);
    }

    public int updateCredentials(
            String loginNameNormalized, String displayName, String passwordHash, long readyAt, UUID invitationId) {
        return jdbc.update(
                WorkspaceInvitationServiceSql
                                .WORKSPACE_INVITATION_SERVICE_UPDATE_INVITATION_PUBLIC_PROGRESS_LOGIN_NAME_NORMALIZED_DISPLAY_NAME
                        + WorkspaceInvitationServiceSql
                                .WORKSPACE_INVITATION_SERVICE_PASSWORD_HASH_CREDENTIAL_READY_AT_EPOCH_MILLIS_VERSION
                        + WorkspaceInvitationServiceSql.WORKSPACE_INVITATION_SERVICE_INVITATION_ID,
                loginNameNormalized,
                displayName,
                passwordHash,
                readyAt,
                invitationId);
    }

    public int markCredentialReady(UUID invitationId, long expectedVersion) {
        return jdbc.update(
                WorkspaceInvitationServiceSql
                                .WORKSPACE_INVITATION_SERVICE_UPDATE_INVITATION_STATUS_CREDENTIAL_READY_VERSION
                        + WorkspaceInvitationServiceSql
                                .WORKSPACE_INVITATION_SERVICE_CONDITION_STATUS_MOBILE_VERIFIED_VERSION,
                invitationId,
                expectedVersion);
    }

    public int completeProgress(UUID accountId, long completedAt, UUID invitationId) {
        return jdbc.update(
                WorkspaceInvitationServiceSql
                                .WORKSPACE_INVITATION_SERVICE_UPDATE_INVITATION_PUBLIC_PROGRESS_COMPLETION_ACCOUNT_ID
                        + WorkspaceInvitationServiceSql
                                .WORKSPACE_INVITATION_SERVICE_COMPLETED_AT_EPOCH_MILLIS_VERSION_INVITATION_ID,
                accountId,
                completedAt,
                invitationId);
    }

    public InvitationRow byId(UUID invitationId) {
        return jdbc.query(
                WorkspaceInvitationServiceSql
                                .WORKSPACE_INVITATION_SERVICE_SELECT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_MOBILE_NORMALIZED_STATUS_ALTERNATE_A
                        + WorkspaceInvitationServiceSql.WORKSPACE_INVITATION_SERVICE_INVITATION_VERSION,
                statement -> statement.setObject(1, invitationId),
                result -> result.next() ? invitationRow(result) : null);
    }

    public int supersedeActiveOtp(UUID invitationId) {
        return jdbc.update(
                WorkspaceInvitationServiceSql
                                .WORKSPACE_INVITATION_SERVICE_UPDATE_OTP_GRANT_STATUS_SUPERSEDED_SUBJECT_REF
                        + WorkspaceInvitationServiceSql
                                .WORKSPACE_INVITATION_SERVICE_PURPOSE_INVITATION_MOBILE_VERIFY_STATUS_ACTIVE_ALTERNATE_A,
                invitationId);
    }

    public int createOtp(
            UUID otpId,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String tokenHash,
            UUID invitationId,
            long expiresAt) {
        return jdbc.update(
                WorkspaceInvitationServiceSql.WORKSPACE_INVITATION_SERVICE_INSERT_INTO_OTP_GRANT
                        + WorkspaceInvitationServiceSql.WORKSPACE_INVITATION_SERVICE_SUBJECT_REF
                        + WorkspaceInvitationServiceSql.WORKSPACE_INVITATION_SERVICE_PARAMETER_PLACEHOLDER
                        + WorkspaceInvitationServiceSql.WORKSPACE_INVITATION_SERVICE_PARAMETER_PLACEHOLDER_ACTIVE,
                otpId,
                workspaceUuid,
                groupWorkspaceKey,
                tokenHash,
                invitationId,
                expiresAt);
    }

    public int markCompleting(UUID invitationId, long expectedVersion) {
        return jdbc.update(
                WorkspaceInvitationServiceSql.WORKSPACE_INVITATION_SERVICE_UPDATE_INVITATION_STATUS_COMPLETING_VERSION
                        + WorkspaceInvitationServiceSql.WORKSPACE_INVITATION_SERVICE_STATUS_CREDENTIAL_READY_VERSION,
                invitationId,
                expectedVersion);
    }

    public int createAccount(
            UUID accountId,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String mobile,
            String loginName,
            String displayName,
            long createdAt,
            long updatedAt) {
        return jdbc.update(
                WorkspaceInvitationServiceSql
                                .WORKSPACE_INVITATION_SERVICE_INSERT_INTO_WORKSPACE_ACCOUNT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY
                        + WorkspaceInvitationServiceSql.WORKSPACE_INVITATION_SERVICE_MOBILE_NORMALIZED
                        + WorkspaceInvitationServiceSql
                                .WORKSPACE_INVITATION_SERVICE_CREATED_AT_EPOCH_MILLIS_UPDATED_AT_EPOCH_MILLIS_ENABLED
                        + WorkspaceInvitationServiceSql.WORKSPACE_INVITATION_SERVICE_1
                        + WorkspaceInvitationServiceSql.WORKSPACE_INVITATION_SERVICE_PARAMETER_PLACEHOLDER_ALTERNATE_A,
                accountId,
                workspaceUuid,
                groupWorkspaceKey,
                mobile,
                loginName,
                displayName,
                createdAt,
                updatedAt);
    }

    public int createCredential(UUID accountId, String passwordHash, long changedAt) {
        return jdbc.update(
                WorkspaceInvitationServiceSql
                                .WORKSPACE_INVITATION_SERVICE_INSERT_INTO_WORKSPACE_CREDENTIAL_ACCOUNT_ID_PASSWORD_HASH_ALGORITHM
                        + WorkspaceInvitationServiceSql
                                .WORKSPACE_INVITATION_SERVICE_CHANGED_AT_EPOCH_MILLIS_VERSION_BCRYPT,
                accountId,
                passwordHash,
                changedAt);
    }

    public int createRoleAssignment(
            UUID assignmentId,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID accountId,
            UUID roleId,
            UUID invitationId,
            String serviceNodeType,
            UUID serviceNodeId,
            long createdAt,
            long updatedAt) {
        return jdbc.update(
                WorkspaceInvitationServiceSql.WORKSPACE_INVITATION_SERVICE_INSERT_INTO_ROLE_ASSIGNMENT
                        + WorkspaceInvitationServiceSql.WORKSPACE_INVITATION_SERVICE_ROLE_ID
                        + WorkspaceInvitationServiceSql
                                .WORKSPACE_INVITATION_SERVICE_CREATED_AT_EPOCH_MILLIS_UPDATED_AT_EPOCH_MILLIS
                        + WorkspaceInvitationServiceSql.WORKSPACE_INVITATION_SERVICE_ACTIVE
                        + WorkspaceInvitationServiceSql.WORKSPACE_INVITATION_SERVICE_1_ALTERNATE_A,
                assignmentId,
                workspaceUuid,
                groupWorkspaceKey,
                accountId,
                roleId,
                invitationId,
                serviceNodeType,
                serviceNodeId,
                createdAt,
                updatedAt);
    }

    public int markCompleted(UUID invitationId, long completedAt) {
        return jdbc.update(
                WorkspaceInvitationServiceSql
                                .WORKSPACE_INVITATION_SERVICE_UPDATE_INVITATION_STATUS_COMPLETED_COMPLETED_AT_EPOCH_MILLIS
                        + WorkspaceInvitationServiceSql.WORKSPACE_INVITATION_SERVICE_VERSION_STATUS_COMPLETING,
                completedAt,
                invitationId);
    }

    public List<AssignmentFactRow> assignmentFacts(List<UUID> invitationIds) {
        List<UUID> ids = List.copyOf(new LinkedHashSet<>(invitationIds));
        if (ids.isEmpty()) return List.of();
        String placeholders = placeholders(ids.size());
        return jdbc.query(
                WorkspaceInvitationServiceSql
                                .WORKSPACE_INVITATION_SERVICE_SELECT_INTENT_INVITATION_ID_ROLE_ID_SERVICE_NODE_TYPE
                        + WorkspaceInvitationServiceSql
                                .WORKSPACE_INVITATION_SERVICE_INVITATION_ASSIGNMENT_INTENT_ROLE_NAME_INTENT
                        + WorkspaceInvitationServiceSql.WORKSPACE_INVITATION_SERVICE_WORKSPACE_ROLE_ROLE_INTENT_ROLE_ID
                        + placeholders
                        + WorkspaceInvitationServiceSql.ASSIGNMENT_INTENT_ORDER_SUFFIX,
                statement -> {
                    for (int index = 0; index < ids.size(); index++) statement.setObject(index + 1, ids.get(index));
                },
                (row, index) -> new AssignmentFactRow(
                        row.getObject(1, UUID.class),
                        row.getObject(2, UUID.class),
                        row.getString(3),
                        row.getObject(4, UUID.class),
                        row.getString(5)));
    }

    public Map<UUID, String> issuerNames(List<UUID> invitationIds) {
        List<UUID> ids = List.copyOf(new LinkedHashSet<>(invitationIds));
        if (ids.isEmpty()) return Map.of();
        return jdbc.query(
                WorkspaceInvitationServiceSql
                                .WORKSPACE_INVITATION_SERVICE_SELECT_INVITATION_ISSUER_DISPLAY_NAME_SNAPSHOT
                        + placeholders(ids.size())
                        + WorkspaceInvitationServiceSql.SQL_CLOSE_PAREN,
                statement -> {
                    for (int index = 0; index < ids.size(); index++) statement.setObject(index + 1, ids.get(index));
                },
                result -> {
                    Map<UUID, String> values = new java.util.LinkedHashMap<>();
                    while (result.next()) values.put(result.getObject(1, UUID.class), result.getString(2));
                    return Map.copyOf(values);
                });
    }

    public int appendAudit(
            UUID auditId,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID invitationId,
            String actorType,
            UUID actorId,
            String actorDisplaySnapshot,
            String action,
            long occurredAt,
            String changesJson) {
        return jdbc.update(
                WorkspaceInvitationServiceSql
                                .WORKSPACE_INVITATION_SERVICE_INSERT_INTO_AUDIT_EVENT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_ENTITY_TYPE
                        + WorkspaceInvitationServiceSql
                                .WORKSPACE_INVITATION_SERVICE_ENTITY_REF_TEXT_ACTOR_TYPE_ACTOR_ID_ACTOR_DISPLAY_SNAPSHOT
                        + WorkspaceInvitationServiceSql
                                .WORKSPACE_INVITATION_SERVICE_OCCURRED_AT_EPOCH_MILLIS_CHANGES_JSON_WORKSPACE_INVITATION
                        + WorkspaceInvitationServiceSql.WORKSPACE_INVITATION_SERVICE_PARAMETER_PLACEHOLDER_ALTERNATE_B
                        + WorkspaceInvitationServiceSql
                                .WORKSPACE_INVITATION_SERVICE_PARAMETER_PLACEHOLDER_CAST_AS_JSONB,
                auditId,
                workspaceUuid,
                groupWorkspaceKey,
                invitationId.toString(),
                actorType,
                actorId,
                actorDisplaySnapshot,
                action,
                occurredAt,
                changesJson);
    }

    public InvitationReadRow readback(UUID workspaceUuid, String groupWorkspaceKey, UUID invitationId) {
        return jdbc.query(
                WorkspaceInvitationServiceSql
                                .WORKSPACE_INVITATION_SERVICE_SELECT_MOBILE_NORMALIZED_STATUS_EXPIRES_AT_EPOCH_MILLIS_VERSION_ALTERNATE_A
                        + WorkspaceInvitationServiceSql.WORKSPACE_INVITATION_SERVICE_CREATED_AT_EPOCH_MILLIS_ALTERNATE_A
                        + WorkspaceInvitationServiceSql
                                .WORKSPACE_INVITATION_SERVICE_INVITATION_CANCELLED_AT_EPOCH_MILLIS_INVITATION_TOKEN_ALTERNATE_A
                        + WorkspaceInvitationServiceSql
                                .WORKSPACE_INVITATION_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY,
                statement -> {
                    statement.setObject(1, invitationId);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, groupWorkspaceKey);
                },
                result -> result.next() ? readRow(result) : null);
    }

    public AccountPresenceRow accountPresence(UUID workspaceUuid, String groupWorkspaceKey, String mobileNormalized) {
        return jdbc.query(
                WorkspaceInvitationServiceSql
                                .WORKSPACE_INVITATION_SERVICE_SELECT_WORKSPACE_ACCOUNT_STATUS_WORKSPACE_UUID
                        + WorkspaceInvitationServiceSql
                                .WORKSPACE_INVITATION_SERVICE_GROUP_WORKSPACE_KEY_MOBILE_NORMALIZED,
                statement -> {
                    statement.setObject(1, workspaceUuid);
                    statement.setString(2, groupWorkspaceKey);
                    statement.setString(3, mobileNormalized);
                },
                result -> result.next()
                        ? new AccountPresenceRow(result.getObject(1, UUID.class), result.getString(2))
                        : null);
    }

    public List<RoleRow> enabledRoles(UUID workspaceUuid, String groupWorkspaceKey, List<UUID> roleIds) {
        List<UUID> ids = List.copyOf(new LinkedHashSet<>(roleIds));
        if (ids.isEmpty()) return List.of();
        String placeholders = placeholders(ids.size());
        return jdbc.query(
                WorkspaceInvitationServiceSql
                                .WORKSPACE_INVITATION_SERVICE_SELECT_WORKSPACE_ROLE_NAME_SERVICE_NODE_TYPE_STATUS_WORKSPACE_UUID
                        + WorkspaceInvitationServiceSql.WORKSPACE_INVITATION_SERVICE_CONDITION_GROUP_WORKSPACE_KEY
                        + placeholders
                        + WorkspaceInvitationServiceSql.ENABLED_ROLE_LOCK_SUFFIX,
                statement -> {
                    statement.setObject(1, workspaceUuid);
                    statement.setString(2, groupWorkspaceKey);
                    for (int index = 0; index < ids.size(); index++) statement.setObject(index + 3, ids.get(index));
                },
                (row, index) -> new RoleRow(
                        row.getObject(1, UUID.class), row.getString(2), row.getString(3), row.getString(4)));
    }

    public boolean validGrant(UUID invitationId, String grantHash, long now) {
        Integer count = jdbc.queryForObject(
                WorkspaceInvitationServiceSql
                                .WORKSPACE_INVITATION_SERVICE_SELECT_INVITATION_PUBLIC_PROGRESS_INVITATION_ID
                        + WorkspaceInvitationServiceSql.WORKSPACE_INVITATION_SERVICE_CONDITION_VERIFICATION_GRANT_HASH
                        + WorkspaceInvitationServiceSql
                                .WORKSPACE_INVITATION_SERVICE_VERIFICATION_GRANT_EXPIRES_AT_EPOC_ALTERNATE_A,
                Integer.class,
                invitationId,
                grantHash,
                now);
        return count != null && count == 1;
    }

    public ProgressRow progress(UUID invitationId) {
        return jdbc.query(
                WorkspaceInvitationServiceSql.WORKSPACE_INVITATION_SERVICE_SELECT_LOGIN_NAME_NORMALIZED
                        + WorkspaceInvitationServiceSql
                                .WORKSPACE_INVITATION_SERVICE_INVITATION_PUBLIC_PROGRESS_INVITATION_ID,
                statement -> statement.setObject(1, invitationId),
                result -> result.next()
                        ? new ProgressRow(
                                result.getString(1),
                                result.getString(2),
                                result.getString(3),
                                result.getObject(4, UUID.class))
                        : null);
    }

    public InvitationRow byToken(String tokenHash) {
        return jdbc.query(
                WorkspaceInvitationServiceSql
                                .WORKSPACE_INVITATION_SERVICE_SELECT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_MOBILE_NORMALIZED_STATUS_ALTERNATE_C
                        + WorkspaceInvitationServiceSql.WORKSPACE_INVITATION_SERVICE_INVITATION_VERSION_TOKEN_HASH,
                statement -> statement.setString(1, tokenHash),
                result -> result.next() ? invitationRow(result) : null);
    }

    private static String placeholders(int size) {
        if (size <= 0) throw new IllegalArgumentException("at least one placeholder is required");
        return String.join(
                WorkspaceInvitationServiceSql.PLACEHOLDER_SEPARATOR,
                Collections.nCopies(size, WorkspaceInvitationServiceSql.PARAMETER_PLACEHOLDER));
    }

    private static InvitationRow invitationRow(ResultSet result) throws SQLException {
        return new InvitationRow(
                result.getObject(1, UUID.class),
                result.getObject(2, UUID.class),
                result.getString(3),
                result.getString(4),
                result.getString(5),
                result.getLong(6),
                result.getLong(7));
    }

    private static InvitationReadRow readRow(ResultSet result) throws SQLException {
        return new InvitationReadRow(
                result.getObject(1, UUID.class),
                result.getString(2),
                result.getString(3),
                result.getLong(4),
                result.getLong(5),
                result.getLong(6),
                result.getObject(7, Long.class),
                result.getObject(8, Long.class),
                result.getObject(9, Long.class),
                result.getString(10));
    }

    private static AssignmentIntentRow assignmentIntentRow(ResultSet result) throws SQLException {
        return new AssignmentIntentRow(
                result.getObject(1, UUID.class), result.getString(2), result.getObject(3, UUID.class));
    }

    public record PageRows(List<InvitationReadRow> items, long total) {}

    public record InvitationRow(
            UUID id,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String mobile,
            String status,
            long expiresAtEpochMillis,
            long version) {}

    public record InvitationReadRow(
            UUID id,
            String mobile,
            String status,
            long expiresAtEpochMillis,
            long version,
            long createdAtEpochMillis,
            Long consentedAtEpochMillis,
            Long completedAtEpochMillis,
            Long cancelledAtEpochMillis,
            String invitationToken) {}

    public record AssignmentIntentRow(UUID roleId, String serviceNodeType, UUID serviceNodeId) {}

    public record AssignmentFactRow(
            UUID invitationId, UUID roleId, String serviceNodeType, UUID serviceNodeId, String roleName) {}

    public record AccountPresenceRow(UUID accountId, String status) {}

    public record RoleRow(UUID id, String name, String serviceNodeType, String status) {}

    public record ProgressRow(String loginName, String displayName, String passwordHash, UUID accountId) {}
}
