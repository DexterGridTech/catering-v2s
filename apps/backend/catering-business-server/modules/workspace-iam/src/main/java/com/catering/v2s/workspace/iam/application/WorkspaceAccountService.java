package com.catering.v2s.workspace.iam.application;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.audit.contract.AuditChange;
import com.catering.v2s.audit.contract.AuditChangeJson;
import com.catering.v2s.audit.contract.AuditChangePolicy;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.platform.foundation.workspace.WorkspaceStatusLookup;
import com.catering.v2s.platform.iam.api.PlatformGovernanceAuthorization;
import com.catering.v2s.workspace.iam.api.WorkspaceAccountReadback;
import com.catering.v2s.workspace.iam.api.WorkspaceAuthorizationCatalog.UserManagementAction;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class WorkspaceAccountService {
    private static final AuditChangePolicy ACCOUNT_STATUS_CHANGED =
            new AuditChangePolicy("WORKSPACE_ACCOUNT", "WORKSPACE_ACCOUNT_STATUS_CHANGED", Set.of("status"));
    private static final AuditChangePolicy ASSIGNMENT_REVOKED = new AuditChangePolicy(
            "WORKSPACE_ACCOUNT", "WORKSPACE_ACCOUNT_ASSIGNMENT_REVOKED", Set.of("serviceNodeAssignment"));
    private final JdbcTemplate jdbc;
    private final TimeProvider time;
    private final WorkspaceCommandAuthorizationService commandAuthorization;
    private final WorkspaceIamCommandReceiptService receipts;
    private final PlatformGovernanceAuthorization platformAuthorization;

    public WorkspaceAccountService(JdbcTemplate jdbc, TimeProvider time) {
        this(
                jdbc,
                time,
                new WorkspaceCommandAuthorizationService(jdbc),
                new WorkspaceIamCommandReceiptService(jdbc, time),
                null);
    }

    public WorkspaceAccountService(
            JdbcTemplate jdbc, TimeProvider time, WorkspaceCommandAuthorizationService commandAuthorization) {
        this(jdbc, time, commandAuthorization, new WorkspaceIamCommandReceiptService(jdbc, time), null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public WorkspaceAccountService(
            JdbcTemplate jdbc,
            TimeProvider time,
            WorkspaceCommandAuthorizationService commandAuthorization,
            WorkspaceIamCommandReceiptService receipts,
            PlatformGovernanceAuthorization platformAuthorization) {
        this.jdbc = jdbc;
        this.time = time;
        this.commandAuthorization = commandAuthorization;
        this.receipts = receipts;
        this.platformAuthorization = platformAuthorization;
    }
    /** Compatibility construction only; workspace status is no longer an account-owner dependency. */
    public WorkspaceAccountService(
            JdbcTemplate jdbc,
            TimeProvider time,
            WorkspaceCommandAuthorizationService commandAuthorization,
            WorkspaceIamCommandReceiptService receipts,
            WorkspaceStatusLookup ignoredWorkspaceStatus,
            PlatformGovernanceAuthorization platformAuthorization) {
        this(jdbc, time, commandAuthorization, receipts, platformAuthorization);
    }

    @Transactional(readOnly = true)
    public WorkspaceAccountReadback require(UUID workspaceUuid, String key, UUID accountId) {
        return jdbc.query(
                "SELECT id, workspace_uuid, group_workspace_key, mobile_normalized, login_name_normalized, "
                        + "display_name, status, version FROM workspace_iam.workspace_account WHERE id=? AND "
                        + "workspace_uuid=? AND group_workspace_key=?",
                statement -> {
                    statement.setObject(1, accountId);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, key);
                },
                result -> {
                    if (!result.next()) throw new AccountNotFoundException();
                    return readback(result);
                });
    }

    @Transactional
    public WorkspaceAccountReadback transitionStatus(
            UUID workspaceUuid, String key, UUID accountId, String status, long expectedVersion) {
        return transitionStatus(workspaceUuid, key, accountId, status, expectedVersion, AuditActor.system());
    }

    @Transactional
    public WorkspaceAccountReadback transitionStatus(
            UUID workspaceUuid, String key, UUID accountId, String status, long expectedVersion, AuditActor actor) {
        if (!Set.of("ENABLED", "DISABLED", "VOIDED").contains(status)) {
            // Preserve the historical not-found-before-invalid-status ordering without making the normal command
            // path read the account twice.
            require(workspaceUuid, key, accountId);
            throw new AccountConflictException();
        }
        StatusTransition transition = jdbc.query(
                "WITH current AS (SELECT id, status FROM workspace_iam.workspace_account WHERE id=? AND "
                        + "workspace_uuid=? AND group_workspace_key=? FOR UPDATE), updated AS (UPDATE "
                        + "workspace_iam.workspace_account SET status=?, version=version+1, "
                        + "updated_at_epoch_millis=? WHERE id=? AND workspace_uuid=? AND group_workspace_key=? "
                        + "AND version=? AND status <> 'VOIDED' RETURNING id, workspace_uuid, "
                        + "group_workspace_key, mobile_normalized, "
                        + "login_name_normalized, display_name, status, version) SELECT updated.*, current.status "
                        + "AS previous_status, current.id AS existing_id FROM (SELECT 1) sentinel LEFT JOIN current "
                        + "ON true LEFT JOIN updated ON true",
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
        if (transition == null || transition.existingId() == null) throw new AccountNotFoundException();
        if ("VOIDED".equals(transition.previousStatus())) throw new AccountConflictException();
        if (transition.updated() == null) throw new AccountConflictException();
        if (!"ENABLED".equals(status))
            jdbc.update(
                    "UPDATE workspace_iam.workspace_session SET status='REVOKED', revoked_at_epoch_millis=? WHERE "
                            + "account_id=? AND status='ACTIVE'",
                    time.currentEpochMillis(),
                    accountId);
        audit(
                workspaceUuid,
                key,
                accountId,
                "WORKSPACE_ACCOUNT_STATUS_CHANGED",
                actor,
                ACCOUNT_STATUS_CHANGED,
                List.of(new AuditChange(
                        "status",
                        transition.previousStatus(),
                        transition.updated().status())));
        return transition.updated();
    }

    @Transactional
    public WorkspaceAccountReadback transitionStatusForPlatform(
            UUID workspaceUuid,
            String key,
            UUID accountId,
            String status,
            long expectedVersion,
            String idempotencyKey,
            AuditActor actor) {
        requirePlatformActor(actor);
        return receipts.execute(
                workspaceUuid,
                idempotencyKey,
                canonical("platform-account-status", key, accountId, status, expectedVersion),
                WorkspaceAccountReadback.class,
                () -> transitionStatus(workspaceUuid, key, accountId, status, expectedVersion, actor));
    }

    @Transactional
    public void revokeAssignment(
            UUID workspaceUuid, String key, UUID accountId, UUID assignmentId, long expectedVersion) {
        revokeAssignment(workspaceUuid, key, accountId, assignmentId, expectedVersion, AuditActor.system());
    }

    @Transactional
    public void revokeAssignment(
            UUID workspaceUuid, String key, UUID accountId, UUID assignmentId, long expectedVersion, AuditActor actor) {
        String assignment = jdbc.query(
                "UPDATE workspace_iam.role_assignment SET status='REVOKED', version=version+1, "
                        + "updated_at_epoch_millis=? WHERE id=? AND account_id=? AND workspace_uuid=? "
                        + "AND group_workspace_key=? AND status='ACTIVE' AND version=? RETURNING service_node_type",
                statement -> {
                    statement.setLong(1, time.currentEpochMillis());
                    statement.setObject(2, assignmentId);
                    statement.setObject(3, accountId);
                    statement.setObject(4, workspaceUuid);
                    statement.setString(5, key);
                    statement.setLong(6, expectedVersion);
                },
                result -> result.next() ? result.getString(1) : null);
        if (assignment == null) throw new AccountConflictException();
        jdbc.update(
                "UPDATE workspace_iam.workspace_session SET status='REVOKED', revoked_at_epoch_millis=? WHERE "
                        + "account_id=? AND current_assignment_id=? AND status='ACTIVE'",
                time.currentEpochMillis(),
                accountId,
                assignmentId);
        audit(
                workspaceUuid,
                key,
                accountId,
                "WORKSPACE_ACCOUNT_ASSIGNMENT_REVOKED",
                actor,
                ASSIGNMENT_REVOKED,
                List.of(new AuditChange("serviceNodeAssignment", assignment, "REVOKED")));
    }

    @Transactional
    public AssignmentRevocation revokeAssignmentForPlatform(
            UUID workspaceUuid,
            String key,
            UUID accountId,
            UUID assignmentId,
            long expectedVersion,
            String idempotencyKey,
            AuditActor actor) {
        requirePlatformActor(actor);
        return receipts.execute(
                workspaceUuid,
                idempotencyKey,
                canonical("platform-assignment-revoke", key, accountId, assignmentId, expectedVersion),
                AssignmentRevocation.class,
                () -> {
                    revokeAssignment(workspaceUuid, key, accountId, assignmentId, expectedVersion, actor);
                    return new AssignmentRevocation(assignmentId, "REVOKED", expectedVersion + 1);
                });
    }

    @Transactional
    public UUID revokeAssignment(UUID workspaceUuid, String key, UUID assignmentId, long expectedVersion) {
        return revokeAssignment(workspaceUuid, key, assignmentId, expectedVersion, AuditActor.system());
    }

    @Transactional
    public UUID revokeAssignment(
            UUID workspaceUuid, String key, UUID assignmentId, long expectedVersion, AuditActor actor) {
        UUID accountId = jdbc.query(
                "SELECT account_id FROM workspace_iam.role_assignment WHERE id=? AND workspace_uuid=? AND "
                        + "group_workspace_key=?",
                statement -> {
                    statement.setObject(1, assignmentId);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, key);
                },
                result -> {
                    if (!result.next()) throw new AccountNotFoundException();
                    return result.getObject(1, UUID.class);
                });
        revokeAssignment(workspaceUuid, key, accountId, assignmentId, expectedVersion, actor);
        return accountId;
    }
    /** Operations authorization must be rechecked before a prior receipt is allowed to replay. */
    @Transactional
    public UUID revokeAssignmentForOperations(
            UUID workspaceUuid,
            String key,
            UUID actorAssignmentId,
            String expectedTargetType,
            UUID assignmentId,
            long expectedVersion,
            String idempotencyKey,
            AuditActor actor) {
        AssignmentTarget target = jdbc.query(
                "SELECT account_id, service_node_type, service_node_id FROM workspace_iam.role_assignment WHERE id=? "
                        + "AND workspace_uuid=? AND group_workspace_key=?",
                statement -> {
                    statement.setObject(1, assignmentId);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, key);
                },
                result -> {
                    if (!result.next()) throw new AccountNotFoundException();
                    return new AssignmentTarget(
                            result.getObject(1, UUID.class), result.getString(2), result.getObject(3, UUID.class));
                });
        if (expectedTargetType == null || !expectedTargetType.equals(target.serviceNodeType()))
            throw new WorkspaceCommandAuthorizationService.AuthorizationDeniedException();
        commandAuthorization.requireUserManagementAction(
                workspaceUuid,
                key,
                actorAssignmentId,
                target.serviceNodeType(),
                target.serviceNodeId(),
                UserManagementAction.ROLE_REVOKE);
        return receipts.execute(
                workspaceUuid,
                idempotencyKey,
                canonical(
                        "operations-assignment-revoke",
                        key,
                        target.accountId(),
                        actorAssignmentId + "|" + target.serviceNodeType() + "|" + target.serviceNodeId() + "|"
                                + assignmentId,
                        expectedVersion),
                UUID.class,
                () -> {
                    revokeAssignment(workspaceUuid, key, target.accountId(), assignmentId, expectedVersion, actor);
                    return target.accountId();
                });
    }

    private void audit(
            UUID workspaceUuid,
            String key,
            UUID accountId,
            String action,
            AuditActor actor,
            AuditChangePolicy policy,
            List<AuditChange> changes) {
        jdbc.update(
                "INSERT INTO workspace_iam.audit_event (id, workspace_uuid, group_workspace_key, entity_type, "
                        + "entity_ref_text, actor_type, actor_id, actor_display_snapshot, action, "
                        + "occurred_at_epoch_millis, changes_json) VALUES (?, ?, ?, 'WORKSPACE_ACCOUNT', ?, ?, ?, ?, "
                        + "?, ?, "
                        + "CAST(? AS JSONB))",
                UUID.randomUUID(),
                workspaceUuid,
                key,
                accountId.toString(),
                actor.actorType(),
                actor.actorId(),
                actor.displaySnapshot(),
                action,
                time.currentEpochMillis(),
                auditJson(policy.allow(changes)));
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

    private static String auditJson(List<AuditChange> changes) {
        return AuditChangeJson.write(changes);
    }

    private void requirePlatformActor(AuditActor actor) {
        if (platformAuthorization == null) throw new IllegalStateException("platform authorization is required");
        platformAuthorization.requireEnabledPlatformAdministrator(actor);
    }

    private static String canonical(String operation, String key, UUID accountId, Object value, long expectedVersion) {
        return operation + '|' + key + '|' + accountId + '|' + value + '|' + expectedVersion;
    }

    public static final class AccountNotFoundException extends RuntimeException {
        public AccountNotFoundException() {}

        public AccountNotFoundException(Throwable cause) {
            super(cause);
        }
    }

    public static final class AccountConflictException extends RuntimeException {}

    public static final class WorkspaceDisabledException extends RuntimeException {}

    private record AssignmentTarget(UUID accountId, String serviceNodeType, UUID serviceNodeId) {}

    private record StatusTransition(UUID existingId, WorkspaceAccountReadback updated, String previousStatus) {}

    public record AssignmentRevocation(UUID assignmentId, String status, long revision) {}
}
