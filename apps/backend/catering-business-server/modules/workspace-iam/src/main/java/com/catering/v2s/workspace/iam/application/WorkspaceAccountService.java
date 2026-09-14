package com.catering.v2s.workspace.iam.application;

import com.catering.v2s.workspace.iam.application.persistence.WorkspaceAccountPersistence;
import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.audit.contract.AuditChange;
import com.catering.v2s.audit.contract.AuditChangePolicy;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.platform.foundation.workspace.WorkspaceStatusLookup;
import com.catering.v2s.platform.iam.api.PlatformGovernanceAuthorization;
import com.catering.v2s.workspace.iam.api.WorkspaceAccountReadback;
import com.catering.v2s.workspace.iam.api.WorkspaceAuthorizationCatalog.UserManagementAction;
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
    private final WorkspaceAccountPersistence persistence;
    private final TimeProvider time;
    private final WorkspaceCommandAuthorizationService commandAuthorization;
    private final WorkspaceIamCommandReceiptService receipts;
    private final PlatformGovernanceAuthorization platformAuthorization;

    public WorkspaceAccountService(JdbcTemplate jdbc, TimeProvider time) {
        this(
                new WorkspaceAccountPersistence(jdbc, time),
                time,
                new WorkspaceCommandAuthorizationService(jdbc),
                new WorkspaceIamCommandReceiptService(jdbc, time),
                null);
    }

    public WorkspaceAccountService(
            JdbcTemplate jdbc, TimeProvider time, WorkspaceCommandAuthorizationService commandAuthorization) {
        this(
                new WorkspaceAccountPersistence(jdbc, time),
                time,
                commandAuthorization,
                new WorkspaceIamCommandReceiptService(jdbc, time),
                null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public WorkspaceAccountService(
            WorkspaceAccountPersistence persistence,
            TimeProvider time,
            WorkspaceCommandAuthorizationService commandAuthorization,
            WorkspaceIamCommandReceiptService receipts,
            PlatformGovernanceAuthorization platformAuthorization) {
        this.persistence = persistence;
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
        this(new WorkspaceAccountPersistence(jdbc, time), time, commandAuthorization, receipts, platformAuthorization);
    }

    @Transactional(readOnly = true)
    public WorkspaceAccountReadback require(UUID workspaceUuid, String key, UUID accountId) {
        return persistence.require(workspaceUuid, key, accountId);
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
        WorkspaceAccountPersistence.StatusTransition transition =
                persistence.transitionStatus(workspaceUuid, key, accountId, status, expectedVersion);
        if (transition == null || transition.existingId() == null) throw new AccountNotFoundException();
        if ("VOIDED".equals(transition.previousStatus())) throw new AccountConflictException();
        if (transition.updated() == null) throw new AccountConflictException();
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
        String assignment = persistence.revokeAssignment(workspaceUuid, key, accountId, assignmentId, expectedVersion);
        if (assignment == null) throw new AccountConflictException();
        persistence.revokeAssignmentSessions(accountId, assignmentId);
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
        UUID accountId = persistence.accountIdByAssignment(workspaceUuid, key, assignmentId);
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
        WorkspaceAccountPersistence.AssignmentTarget target =
                persistence.assignmentTarget(workspaceUuid, key, assignmentId);
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
        persistence.audit(workspaceUuid, key, accountId, action, actor, policy, changes);
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

    public record AssignmentRevocation(UUID assignmentId, String status, long revision) {}
}
