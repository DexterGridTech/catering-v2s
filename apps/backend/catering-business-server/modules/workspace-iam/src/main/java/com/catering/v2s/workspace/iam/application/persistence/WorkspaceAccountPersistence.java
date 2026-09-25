package com.catering.v2s.workspace.iam.application.persistence;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.audit.contract.AuditChange;
import com.catering.v2s.audit.contract.AuditChangeJson;
import com.catering.v2s.audit.contract.AuditChangePolicy;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.workspace.iam.api.WorkspaceAccountReadback;
import com.catering.v2s.workspace.iam.application.WorkspaceAccountService;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Typed execution boundary for workspace-account facts and mutations. */
@Repository
public class WorkspaceAccountPersistence {
    private final JdbcTemplate jdbc;
    private final TimeProvider time;

    @Autowired
    public WorkspaceAccountPersistence(JdbcTemplate jdbc, TimeProvider time) {
        this.jdbc = jdbc;
        this.time = time;
    }

    public WorkspaceAccountReadback require(UUID workspaceUuid, String key, UUID accountId) {
        return jdbc.query(
                WorkspaceAccountServiceSql.WORKSPACE_ACCOUNT_SERVICE_SELECT_WORKSPACE_UUID
                        + WorkspaceAccountServiceSql
                                .WORKSPACE_ACCOUNT_SERVICE_WORKSPACE_ACCOUNT_DISPLAY_NAME_STATUS_VERSION
                        + WorkspaceAccountServiceSql.WORKSPACE_ACCOUNT_SERVICE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY,
                statement -> {
                    statement.setObject(1, accountId);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, key);
                },
                result -> {
                    if (!result.next()) throw new WorkspaceAccountService.AccountNotFoundException();
                    return readback(result);
                });
    }

    public StatusTransition transitionStatus(
            UUID workspaceUuid, String key, UUID accountId, String status, long expectedVersion) {
        StatusTransition transition = jdbc.query(
                WorkspaceAccountServiceSql.WORKSPACE_ACCOUNT_SERVICE_CTE_WORKSPACE_ACCOUNT_CURRENT_STATUS
                        + WorkspaceAccountServiceSql
                                .WORKSPACE_ACCOUNT_SERVICE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_UPDATED
                        + WorkspaceAccountServiceSql.WORKSPACE_ACCOUNT_SERVICE_WORKSPACE_ACCOUNT_STATUS_VERSION
                        + WorkspaceAccountServiceSql
                                .WORKSPACE_ACCOUNT_SERVICE_UPDATE_UPDATED_AT_EPOCH_MILLIS_WORKSPACE_UUID_GROUP_WORKSPACE_KEY
                        + WorkspaceAccountServiceSql
                                .WORKSPACE_ACCOUNT_SERVICE_CONDITION_VERSION_STATUS_VOIDED_WORKSPACE_UUID
                        + WorkspaceAccountServiceSql.WORKSPACE_ACCOUNT_SERVICE_GROUP_WORKSPACE_KEY_MOBILE_NORMALIZED
                        + WorkspaceAccountServiceSql
                                .WORKSPACE_ACCOUNT_SERVICE_LOGIN_NAME_NORMALIZED_DISPLAY_NAME_STATUS_VERSION
                        + WorkspaceAccountServiceSql
                                .WORKSPACE_ACCOUNT_SERVICE_CURRENT_PREVIOUS_STATUS_EXISTING_ID_SENTINEL
                        + WorkspaceAccountServiceSql
                                .WORKSPACE_ACCOUNT_SERVICE_JOIN_CONDITION_UPDATED_ON_TRUE_LEFT_JOIN_UPDATED_ON,
                statement -> {
                    statement.setObject(1, accountId);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, key);
                    statement.setString(4, status);
                    statement.setLong(5, time.currentEpochMillis());
                    statement.setObject(6, accountId);
                    statement.setObject(7, workspaceUuid);
                    statement.setString(8, key);
                    statement.setLong(9, expectedVersion);
                },
                result -> result.next()
                        ? new StatusTransition(
                                result.getObject("existing_id", UUID.class),
                                result.getObject("id", UUID.class) == null ? null : readback(result),
                                result.getString("previous_status"))
                        : null);
        if (transition != null && transition.updated() != null && !"ENABLED".equals(status)) {
            jdbc.update(
                    WorkspaceAccountServiceSql
                                    .WORKSPACE_ACCOUNT_SERVICE_UPDATE_WORKSPACE_SESSION_STATUS_REVOKED_REVOKED_AT_EPOCH_MILLIS
                            + WorkspaceAccountServiceSql.WORKSPACE_ACCOUNT_SERVICE_ACCOUNT_ID_STATUS_ACTIVE,
                    time.currentEpochMillis(),
                    accountId);
        }
        return transition;
    }

    public String revokeAssignment(
            UUID workspaceUuid, String key, UUID accountId, UUID assignmentId, long expectedVersion) {
        return jdbc.query(
                WorkspaceAccountServiceSql.WORKSPACE_ACCOUNT_SERVICE_UPDATE_ROLE_ASSIGNMENT_STATUS_REVOKED_VERSION
                        + WorkspaceAccountServiceSql
                                .WORKSPACE_ACCOUNT_SERVICE_UPDATE_UPDATED_AT_EPOCH_MILLIS_ACCOUNT_ID_WORKSPACE_UUID
                        + WorkspaceAccountServiceSql
                                .WORKSPACE_ACCOUNT_SERVICE_CONDITION_GROUP_WORKSPACE_KEY_STATUS_ACTIVE_VERSION,
                statement -> {
                    statement.setLong(1, time.currentEpochMillis());
                    statement.setObject(2, assignmentId);
                    statement.setObject(3, accountId);
                    statement.setObject(4, workspaceUuid);
                    statement.setString(5, key);
                    statement.setLong(6, expectedVersion);
                },
                result -> result.next() ? result.getString(1) : null);
    }

    public void revokeAssignmentSessions(UUID accountId, UUID assignmentId) {
        jdbc.update(
                WorkspaceAccountServiceSql
                                .WORKSPACE_ACCOUNT_SERVICE_UPDATE_WORKSPACE_SESSION_STATUS_REVOKED_REVOKED_AT_EPOCH_MILLIS_ALTERNATE_A
                        + WorkspaceAccountServiceSql
                                .WORKSPACE_ACCOUNT_SERVICE_ACCOUNT_ID_CURRENT_ASSIGNMENT_ID_STATUS_ACTIVE,
                time.currentEpochMillis(),
                accountId,
                assignmentId);
    }

    public UUID accountIdByAssignment(UUID workspaceUuid, String key, UUID assignmentId) {
        return jdbc.query(
                WorkspaceAccountServiceSql.WORKSPACE_ACCOUNT_SERVICE_SELECT_ROLE_ASSIGNMENT_ACCOUNT_ID_WORKSPACE_UUID
                        + WorkspaceAccountServiceSql.WORKSPACE_ACCOUNT_SERVICE_GROUP_WORKSPACE_KEY,
                statement -> {
                    statement.setObject(1, assignmentId);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, key);
                },
                result -> {
                    if (!result.next()) throw new WorkspaceAccountService.AccountNotFoundException();
                    return result.getObject(1, UUID.class);
                });
    }

    public AssignmentTarget assignmentTarget(UUID workspaceUuid, String key, UUID assignmentId) {
        return jdbc.query(
                WorkspaceAccountServiceSql
                                .WORKSPACE_ACCOUNT_SERVICE_SELECT_ROLE_ASSIGNMENT_ACCOUNT_ID_SERVICE_NODE_TYPE_SERVICE_NODE_ID
                        + WorkspaceAccountServiceSql
                                .WORKSPACE_ACCOUNT_SERVICE_CONDITION_WORKSPACE_UUID_GROUP_WORKSPACE_KEY,
                statement -> {
                    statement.setObject(1, assignmentId);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, key);
                },
                result -> {
                    if (!result.next()) throw new WorkspaceAccountService.AccountNotFoundException();
                    return new AssignmentTarget(
                            result.getObject(1, UUID.class), result.getString(2), result.getObject(3, UUID.class));
                });
    }

    public void audit(
            UUID workspaceUuid,
            String key,
            UUID accountId,
            String action,
            AuditActor actor,
            AuditChangePolicy policy,
            List<AuditChange> changes) {
        jdbc.update(
                WorkspaceAccountServiceSql
                                .WORKSPACE_ACCOUNT_SERVICE_INSERT_INTO_AUDIT_EVENT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_ENTITY_TYPE
                        + WorkspaceAccountServiceSql
                                .WORKSPACE_ACCOUNT_SERVICE_ENTITY_REF_TEXT_ACTOR_TYPE_ACTOR_ID_ACTOR_DISPLAY_SNAPSHOT
                        + WorkspaceAccountServiceSql
                                .WORKSPACE_ACCOUNT_SERVICE_OCCURRED_AT_EPOCH_MILLIS_CHANGES_JSON_WORKSPACE_ACCOUNT
                        + WorkspaceAccountServiceSql.WORKSPACE_ACCOUNT_SERVICE_PARAMETER_PLACEHOLDER
                        + WorkspaceAccountServiceSql.WORKSPACE_ACCOUNT_SERVICE_CAST_AS_JSONB,
                UUID.randomUUID(),
                workspaceUuid,
                key,
                accountId.toString(),
                actor.actorType(),
                actor.actorId(),
                actor.displaySnapshot(),
                action,
                time.currentEpochMillis(),
                AuditChangeJson.write(policy.allow(changes)));
    }

    private static WorkspaceAccountReadback readback(ResultSet result) throws SQLException {
        return new WorkspaceAccountReadback(
                result.getObject(1, UUID.class),
                result.getObject(2, UUID.class),
                result.getString(3),
                result.getString(4),
                result.getString(5),
                result.getString(6),
                result.getString(7),
                result.getLong(8));
    }

    public record StatusTransition(UUID existingId, WorkspaceAccountReadback updated, String previousStatus) {}

    public record AssignmentTarget(UUID accountId, String serviceNodeType, UUID serviceNodeId) {}
}
