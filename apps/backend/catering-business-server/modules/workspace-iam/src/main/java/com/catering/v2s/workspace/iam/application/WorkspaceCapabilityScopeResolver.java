package com.catering.v2s.workspace.iam.application;

import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.organization.api.OrganizationTaskPathLookup;
import com.catering.v2s.organization.api.WorkspaceAssignmentScopeLookup;
import com.catering.v2s.platform.foundation.contract.ServiceNodeTypes;
import com.catering.v2s.platform.foundation.persistence.DatabaseOperationTracker;
import com.catering.v2s.workspace.iam.api.WorkspaceAuthorizationCatalog;
import com.catering.v2s.workspace.iam.api.WorkspaceCapabilityRequirementCatalog;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * Resolves the first workspace scope predicate from server-owned session, assignment and target facts. Capability names
 * are obtained exclusively from the generated requirement catalog.
 */
@Service
public class WorkspaceCapabilityScopeResolver {
    private static final String AUTHENTICATED_WORKSPACE = "AUTHENTICATED_WORKSPACE";
    private static final String AUTHENTICATED_WORKSPACE_TARGET_SCOPE = "AUTHENTICATED_WORKSPACE_TARGET_SCOPE";

    private final WorkspaceAssignmentScopeLookup assignments;
    private final OrganizationTaskPathLookup taskPaths;
    private final JdbcTemplate jdbc;

    public WorkspaceCapabilityScopeResolver(
            WorkspaceAssignmentScopeLookup assignments, OrganizationTaskPathLookup taskPaths) {
        this(assignments, taskPaths, null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public WorkspaceCapabilityScopeResolver(
            WorkspaceAssignmentScopeLookup assignments, OrganizationTaskPathLookup taskPaths, JdbcTemplate jdbc) {
        this.assignments = assignments;
        this.taskPaths = taskPaths;
        this.jdbc = jdbc;
    }

    public ScopeResolution resolve(
            WorkspaceSessionReadback session, String requirementId, ServerResolvedResource target) {
        return resolve(session, requirementId, target, TargetPathPolicy.ENABLED_ONLY);
    }

    /**
     * Resolves an owner status-transition target, including a disabled persisted fact only so an otherwise authorized
     * actor can enable it again. Normal reads, candidates and other commands must continue through
     * {@link #resolve(WorkspaceSessionReadback, String, ServerResolvedResource)}.
     */
    public ScopeResolution resolveStatusTransition(
            WorkspaceSessionReadback session, String requirementId, ServerResolvedResource target) {
        return resolve(session, requirementId, target, TargetPathPolicy.STATUS_TRANSITION);
    }

    /**
     * Resolves the narrow business-channel case where the explicitly targeted Store may be disabled. It deliberately
     * rejects every other target type so this cannot become a general disabled-scope escape hatch.
     */
    public ScopeResolution resolveIncludingDisabledStoreTarget(
            WorkspaceSessionReadback session, String requirementId, ServerResolvedResource target) {
        if (target == null || !ServiceNodeTypes.STORE.equals(target.resourceType())) return ScopeResolution.deny();
        return resolve(session, requirementId, target, TargetPathPolicy.DISABLED_STORE_TARGET);
    }

    /**
     * Resolves a generated operation policy only when its edge projection agrees with the authoritative global IAM
     * requirement catalog. The generated edge registry is therefore a finite transport projection, never a replacement
     * for requirement registration or live role-scope resolution.
     */
    public ScopeResolution resolveGeneratedOperation(
            WorkspaceSessionReadback session,
            String requirementId,
            String capabilityKey,
            ServerResolvedResource target) {
        if (target == null
                || !java.util.Objects.equals(
                        WorkspaceCapabilityRequirementCatalog.resolveCapabilityKey(requirementId, target.resourceType())
                                .orElse(null),
                        capabilityKey)) {
            return ScopeResolution.deny();
        }
        return resolve(session, requirementId, target);
    }

    private ScopeResolution resolve(
            WorkspaceSessionReadback session,
            String requirementId,
            ServerResolvedResource target,
            TargetPathPolicy targetPathPolicy) {
        var requirement =
                WorkspaceCapabilityRequirementCatalog.requirement(requirementId).orElse(null);
        if (requirement == null
                || !AUTHENTICATED_WORKSPACE.equals(requirement.authorizationMode())
                || !AUTHENTICATED_WORKSPACE_TARGET_SCOPE.equals(requirement.resolverId())) {
            return ScopeResolution.deny();
        }
        String capability = WorkspaceCapabilityRequirementCatalog.resolveCapabilityKey(
                        requirement.requirementId(), target.resourceType())
                .orElse(null);
        return resolveWithCapability(session, requirementId, capability, target, targetPathPolicy);
    }

    private ScopeResolution resolveWithCapability(
            WorkspaceSessionReadback session,
            String requirementId,
            String capability,
            ServerResolvedResource target,
            TargetPathPolicy targetPathPolicy) {
        try (var scopeSection = DatabaseOperationTracker.pushSection(DatabaseOperationTracker.Section.SCOPE)) {
            if (session == null
                    || session.currentAssignmentId() == null
                    || target == null
                    || target.resourceType() == null
                    || target.resourceId() == null
                    || requirementId == null
                    || requirementId.isBlank()
                    || capability == null
                    || capability.isBlank()) {
                return ScopeResolution.deny();
            }
            WorkspaceAssignmentScopeLookup.AssignmentScope assignment;
            try {
                assignment = loadWorkspaceCommandAuthorizationFacts(session, capability)
                        .assignmentScope();
            } catch (RuntimeException ignored) {
                return ScopeResolution.deny();
            }
            OrganizationTaskPathLookup.CommandTaskPathFacts pathFacts;
            try {
                pathFacts = switch (targetPathPolicy) {
                    case ENABLED_ONLY -> taskPaths.commandTaskPathFacts(
                            session.workspaceUuid(),
                            session.groupWorkspaceKey(),
                            assignment.serviceNodeType(),
                            assignment.serviceNodeId(),
                            target.resourceType(),
                            target.resourceId(),
                            false);
                    case STATUS_TRANSITION -> taskPaths.commandTaskPathFacts(
                            session.workspaceUuid(),
                            session.groupWorkspaceKey(),
                            assignment.serviceNodeType(),
                            assignment.serviceNodeId(),
                            target.resourceType(),
                            target.resourceId(),
                            true);
                    case DISABLED_STORE_TARGET -> taskPaths.commandTaskPathFactsAllowingDisabledTarget(
                            session.workspaceUuid(),
                            session.groupWorkspaceKey(),
                            assignment.serviceNodeType(),
                            assignment.serviceNodeId(),
                            target.resourceType(),
                            target.resourceId());};
            } catch (RuntimeException ignored) {
                return ScopeResolution.deny();
            }
            OrganizationTaskPathLookup.TaskPath taskPath = pathFacts.taskPath();
            if (assignment == null
                    || assignment.serviceNodeType() == null
                    || assignment.serviceNodeId() == null
                    || !taskPath.targetType().equals(target.resourceType())
                    || !taskPath.targetId().equals(target.resourceId())
                    || !(pathFacts.assignmentScopeAllowed()
                            || allowsHeadCompanyToCreateHeadCompany(capability, assignment, taskPath))) {
                return ScopeResolution.deny();
            }
            return ScopeResolution.allow(
                    capability,
                    new FirstOwnerQueryPredicate(
                            session.workspaceUuid(),
                            session.groupWorkspaceKey(),
                            target.resourceType(),
                            target.resourceId(),
                            assignment.serviceNodeType(),
                            assignment.serviceNodeId(),
                            taskPath.ancestorIds(),
                            session.contextVersion()));
        } finally {
            DatabaseOperationTracker.markPhase(DatabaseOperationTracker.Phase.SCOPE_RESOLVED);
        }
    }

    private enum TargetPathPolicy {
        ENABLED_ONLY,
        STATUS_TRANSITION,
        DISABLED_STORE_TARGET
    }

    /**
     * A head-company role may hold only the total-company create capability. The operation's owner fact is still the
     * commercial group, so this is deliberately not a generic HEAD_COMPANY-to-GROUP scope rule.
     */
    private static boolean allowsHeadCompanyToCreateHeadCompany(
            String capability,
            WorkspaceAssignmentScopeLookup.AssignmentScope assignment,
            OrganizationTaskPathLookup.TaskPath taskPath) {
        return WorkspaceAuthorizationCatalog.CapabilityKeys.BC_ORG_HEAD_COMPANY_CREATE.equals(capability)
                && ServiceNodeTypes.HEAD_COMPANY.equals(assignment.serviceNodeType())
                && ServiceNodeTypes.GROUP.equals(taskPath.targetType());
    }

    /**
     * One command-transaction fact loader binds the fresh active assignment and its ENABLED role capability. It
     * replaces the former sibling capability and assignment reads without borrowing any task-path or owner-object fact
     * from another module.
     */
    private WorkspaceCommandAuthorizationFacts loadWorkspaceCommandAuthorizationFacts(
            WorkspaceSessionReadback session, String capability) {
        try (var ignored = DatabaseOperationTracker.pushSection(DatabaseOperationTracker.Section.AUTHZ)) {
            if (session.assignmentNodeType() != null && session.assignmentNodeId() != null) {
                if (session.actionCapabilityKeys() == null
                        || !session.actionCapabilityKeys().contains(capability)) {
                    throw new WorkspaceAssignmentScopeService.AssignmentScopeNotFoundException();
                }
                return new WorkspaceCommandAuthorizationFacts(new WorkspaceAssignmentScopeLookup.AssignmentScope(
                        session.assignmentNodeType(), session.assignmentNodeId()));
            }
            if (jdbc == null) {
                if (session.actionCapabilityKeys() == null
                        || !session.actionCapabilityKeys().contains(capability)) {
                    throw new WorkspaceAssignmentScopeService.AssignmentScopeNotFoundException();
                }
                return new WorkspaceCommandAuthorizationFacts(assignments.requireActiveScope(
                        session.workspaceUuid(), session.groupWorkspaceKey(), session.currentAssignmentId()));
            }
            return jdbc.query(
                    "SELECT assignment.service_node_type, assignment.service_node_id FROM "
                            + "workspace_iam.role_assignment assignment "
                            + "JOIN workspace_iam.workspace_role role ON role.id=assignment.role_id "
                            + "WHERE assignment.id=? AND assignment.workspace_uuid=? "
                            + "AND assignment.group_workspace_key=? AND assignment.status='ACTIVE' "
                            + "AND role.workspace_uuid=assignment.workspace_uuid "
                            + "AND role.group_workspace_key=assignment.group_workspace_key "
                            + "AND role.status='ENABLED' AND jsonb_exists(role.capability_keys, ?)",
                    statement -> {
                        statement.setObject(1, session.currentAssignmentId());
                        statement.setObject(2, session.workspaceUuid());
                        statement.setString(3, session.groupWorkspaceKey());
                        statement.setString(4, capability);
                    },
                    result -> {
                        if (!result.next())
                            throw new WorkspaceAssignmentScopeService.AssignmentScopeNotFoundException();
                        return new WorkspaceCommandAuthorizationFacts(
                                new WorkspaceAssignmentScopeLookup.AssignmentScope(
                                        result.getString(1), result.getObject(2, UUID.class)));
                    });
        } finally {
            DatabaseOperationTracker.markPhase(DatabaseOperationTracker.Phase.AUTHORIZED);
        }
    }

    public record ServerResolvedResource(String resourceType, UUID resourceId) {}

    private record WorkspaceCommandAuthorizationFacts(WorkspaceAssignmentScopeLookup.AssignmentScope assignmentScope) {}

    /** Owner commands must apply this predicate in their first target query, then re-check their invariant. */
    public record FirstOwnerQueryPredicate(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String resourceType,
            UUID resourceId,
            String assignmentNodeType,
            UUID assignmentNodeId,
            java.util.List<UUID> targetAncestorIds,
            long expectedContextVersion) {
        public FirstOwnerQueryPredicate(
                UUID workspaceUuid,
                String groupWorkspaceKey,
                String resourceType,
                UUID resourceId,
                String assignmentNodeType,
                UUID assignmentNodeId,
                java.util.List<UUID> targetAncestorIds) {
            this(
                    workspaceUuid,
                    groupWorkspaceKey,
                    resourceType,
                    resourceId,
                    assignmentNodeType,
                    assignmentNodeId,
                    targetAncestorIds,
                    -1L);
        }
    }

    public enum Decision {
        ALLOW,
        DENY
    }

    public record ScopeResolution(
            Decision decision, String capabilityKey, FirstOwnerQueryPredicate firstOwnerQueryPredicate) {
        public OperationsOwnerScopeGrant ownerScopeGrant(String requirementId) {
            if (decision != Decision.ALLOW || firstOwnerQueryPredicate == null || capabilityKey == null) {
                throw new WorkspaceCommandAuthorizationService.AuthorizationDeniedException();
            }
            return new OperationsOwnerScopeGrant(
                    firstOwnerQueryPredicate.workspaceUuid(),
                    firstOwnerQueryPredicate.groupWorkspaceKey(),
                    requirementId,
                    capabilityKey,
                    firstOwnerQueryPredicate.resourceType(),
                    firstOwnerQueryPredicate.resourceId(),
                    firstOwnerQueryPredicate.assignmentNodeType(),
                    firstOwnerQueryPredicate.assignmentNodeId(),
                    firstOwnerQueryPredicate.targetAncestorIds(),
                    firstOwnerQueryPredicate.expectedContextVersion());
        }

        static ScopeResolution allow(String capabilityKey, FirstOwnerQueryPredicate predicate) {
            return new ScopeResolution(Decision.ALLOW, capabilityKey, predicate);
        }

        static ScopeResolution deny() {
            return new ScopeResolution(Decision.DENY, null, null);
        }
    }
}
