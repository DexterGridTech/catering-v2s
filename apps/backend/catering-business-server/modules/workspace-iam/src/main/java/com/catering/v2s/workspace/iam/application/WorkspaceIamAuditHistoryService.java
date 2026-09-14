package com.catering.v2s.workspace.iam.application;

import com.catering.v2s.workspace.iam.application.persistence.WorkspaceIamAuditHistoryPersistence;
import com.catering.v2s.audit.contract.*;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Owner-local reader for workspace role, account and invitation audit facts. */
@Service
public class WorkspaceIamAuditHistoryService {
    private static final Set<String> TYPES = Set.of("WORKSPACE_ROLE", "WORKSPACE_ACCOUNT", "WORKSPACE_INVITATION");
    private final WorkspaceIamAuditHistoryPersistence persistence;

    public WorkspaceIamAuditHistoryService(JdbcTemplate jdbc) {
        this(new WorkspaceIamAuditHistoryPersistence(jdbc));
    }

    @org.springframework.beans.factory.annotation.Autowired
    public WorkspaceIamAuditHistoryService(WorkspaceIamAuditHistoryPersistence persistence) {
        this.persistence = persistence;
    }

    @Transactional(readOnly = true)
    public AuditHistoryPage read(AuditReadScope scope, AuditTarget target, long page, long pageSize) {
        if (!TYPES.contains(target.entityType()) || page < 1 || pageSize < 1 || pageSize > 100)
            throw new IllegalArgumentException("unsupported workspace IAM audit target");
        String table =
                switch (target.entityType()) {
                    case "WORKSPACE_ROLE" -> "workspace_role";
                    case "WORKSPACE_ACCOUNT" -> "workspace_account";
                    case "WORKSPACE_INVITATION" -> "invitation";
                    default -> throw new IllegalArgumentException("unsupported workspace IAM audit target");
                };
        if (!persistence.targetExists(target.entityType(), table, target.entityRef(), scope))
            throw absent(target.entityType());
        long total = persistence.countEvents(scope, target);
        List<AuditHistoryItem> items = persistence.readPage(scope, target, page, pageSize);
        return new AuditHistoryPage(items, page, pageSize, total);
    }

    private static RuntimeException absent(String entityType) {
        return switch (entityType) {
            case "WORKSPACE_ROLE" -> new WorkspaceRoleService.RoleNotFoundException();
            case "WORKSPACE_ACCOUNT" -> new WorkspaceAccountService.AccountNotFoundException();
            case "WORKSPACE_INVITATION" -> new WorkspaceInvitationService.InvitationNotFoundException();
            default -> new IllegalArgumentException("unsupported workspace IAM audit target");
        };
    }

    @Transactional(readOnly = true)
    public AuditHistoryPage readWorkspaceRole(AuditReadScope scope, String roleId, long page, long pageSize) {
        return readPlatformProjection(
                scope,
                roleId,
                page,
                pageSize,
                "WORKSPACE_ROLE",
                "workspace_role",
                new WorkspaceRoleService.RoleNotFoundException());
    }

    @Transactional(readOnly = true)
    public AuditHistoryPage readWorkspaceAccount(AuditReadScope scope, String accountId, long page, long pageSize) {
        return readPlatformProjection(
                scope,
                accountId,
                page,
                pageSize,
                "WORKSPACE_ACCOUNT",
                "workspace_account",
                new WorkspaceAccountService.AccountNotFoundException());
    }

    @Transactional(readOnly = true)
    public AuditHistoryPage readWorkspaceInvitation(
            AuditReadScope scope, String invitationId, long page, long pageSize) {
        return readPlatformProjection(
                scope,
                invitationId,
                page,
                pageSize,
                "WORKSPACE_INVITATION",
                "invitation",
                new WorkspaceInvitationService.InvitationNotFoundException());
    }

    /** Closed platform-audit projection; variants are fixed by the audited entity type. */
    @Transactional(readOnly = true)
    public AuditHistoryPage readPlatformAuditProjection(
            AuditReadScope scope, AuditTarget target, long page, long pageSize) {
        if (target == null) throw new IllegalArgumentException("unsupported workspace IAM audit target");
        return switch (target.entityType()) {
            case "WORKSPACE_ROLE" -> readPlatformProjection(
                    scope,
                    target.entityRef(),
                    page,
                    pageSize,
                    "WORKSPACE_ROLE",
                    "workspace_role",
                    new WorkspaceRoleService.RoleNotFoundException());
            case "WORKSPACE_ACCOUNT" -> readPlatformProjection(
                    scope,
                    target.entityRef(),
                    page,
                    pageSize,
                    "WORKSPACE_ACCOUNT",
                    "workspace_account",
                    new WorkspaceAccountService.AccountNotFoundException());
            case "WORKSPACE_INVITATION" -> readPlatformProjection(
                    scope,
                    target.entityRef(),
                    page,
                    pageSize,
                    "WORKSPACE_INVITATION",
                    "invitation",
                    new WorkspaceInvitationService.InvitationNotFoundException());
            default -> throw new IllegalArgumentException("unsupported workspace IAM audit target");
        };
    }

    private AuditHistoryPage readPlatformProjection(
            AuditReadScope scope,
            String entityRef,
            long page,
            long pageSize,
            String entityType,
            String targetTable,
            RuntimeException absent) {
        if (page < 1 || pageSize < 1 || pageSize > 100)
            throw new IllegalArgumentException("unsupported workspace IAM audit target");
        long offset = Math.multiplyExact(page - 1, pageSize);
        AuditHistoryResultSetReader.TargetProjection value = persistence.readPlatformProjection(
                entityRef, scope, entityType, targetTable, pageSize, offset);
        if (!value.targetExists()) throw absent;
        return new AuditHistoryPage(value.items(), page, pageSize, value.total());
    }

    /**
     * One owner-local operations projection. Authorization consumes only the read-context facts already loaded for this
     * request; it must not rebuild a task path through another owner.
     */
    @Transactional(readOnly = true)
    public AuditHistoryPage readOperationsAuditProjection(
            WorkspaceReadAuthorizationFacts facts, AuditTarget target, long page, long pageSize) {
        if (facts == null
                || target == null
                || !Set.of("WORKSPACE_ACCOUNT", "WORKSPACE_INVITATION").contains(target.entityType())
                || page < 1
                || pageSize < 1
                || pageSize > 100) throw new IllegalArgumentException("unsupported operations workspace audit target");
        AuditHistoryResultSetReader.AuthorizedProjection value = persistence.readOperations(
                facts, target, pageSize, (page - 1) * pageSize);
        if (!value.found()) throw absent(target.entityType());
        if (!value.authorized()) throw new WorkspaceCommandAuthorizationService.AuthorizationDeniedException();
        return new AuditHistoryPage(value.items(), page, pageSize, value.total());
    }

}
