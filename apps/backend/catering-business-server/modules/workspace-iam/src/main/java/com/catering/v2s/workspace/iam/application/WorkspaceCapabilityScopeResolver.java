package com.catering.v2s.workspace.iam.application;

import com.catering.v2s.organization.api.OrganizationTaskPathLookup;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.organization.api.WorkspaceAssignmentScopeLookup;
import com.catering.v2s.workspace.iam.api.WorkspaceAuthorizationCatalog;
import com.catering.v2s.workspace.iam.api.WorkspaceCapabilityRequirementCatalog;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * Resolves the first workspace scope predicate from server-owned session, assignment and target facts.
 * Capability names are obtained exclusively from the generated requirement catalog.
 */
@Service
public class WorkspaceCapabilityScopeResolver {
    private static final String AUTHENTICATED_WORKSPACE = "AUTHENTICATED_WORKSPACE";
    private static final String AUTHENTICATED_WORKSPACE_TARGET_SCOPE = "AUTHENTICATED_WORKSPACE_TARGET_SCOPE";

    private final WorkspaceAssignmentScopeLookup assignments;
    private final OrganizationTaskPathLookup taskPaths;
    private final JdbcTemplate jdbc;

    public WorkspaceCapabilityScopeResolver(
        WorkspaceAssignmentScopeLookup assignments,
        OrganizationTaskPathLookup taskPaths
    ) {
        this(assignments, taskPaths, null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public WorkspaceCapabilityScopeResolver(
        WorkspaceAssignmentScopeLookup assignments,
        OrganizationTaskPathLookup taskPaths,
        JdbcTemplate jdbc
    ) {
        this.assignments = assignments;
        this.taskPaths = taskPaths;
        this.jdbc = jdbc;
    }

    public ScopeResolution resolve(
        WorkspaceSessionReadback session,
        String requirementId,
        ServerResolvedResource target
    ) {
        return resolve(session, requirementId, target, false);
    }

    /**
     * Resolves an owner status-transition target, including a disabled persisted fact only so
     * an otherwise authorized actor can enable it again. Normal reads, candidates and other
     * commands must continue through {@link #resolve(WorkspaceSessionReadback, String, ServerResolvedResource)}.
     */
    public ScopeResolution resolveStatusTransition(
        WorkspaceSessionReadback session,
        String requirementId,
        ServerResolvedResource target
    ) {
        return resolve(session, requirementId, target, true);
    }

    private ScopeResolution resolve(
        WorkspaceSessionReadback session,
        String requirementId,
        ServerResolvedResource target,
        boolean statusTransitionTarget
    ) {
        if (session == null || session.currentAssignmentId() == null || target == null
            || target.resourceType() == null || target.resourceId() == null) {
            return ScopeResolution.deny();
        }
        var requirement = WorkspaceCapabilityRequirementCatalog.requirement(requirementId).orElse(null);
        if (requirement == null
            || !AUTHENTICATED_WORKSPACE.equals(requirement.authorizationMode())
            || !AUTHENTICATED_WORKSPACE_TARGET_SCOPE.equals(requirement.resolverId())) {
            return ScopeResolution.deny();
        }
        String capability = WorkspaceCapabilityRequirementCatalog
            .resolveCapabilityKey(requirement.requirementId(), target.resourceType())
            .orElse(null);
        if (capability == null || !hasCurrentCapability(session, capability)) {
            return ScopeResolution.deny();
        }
        WorkspaceAssignmentScopeLookup.AssignmentScope assignment;
        try {
            assignment = assignments.requireActiveScope(
                session.workspaceUuid(), session.groupWorkspaceKey(), session.currentAssignmentId()
            );
        } catch (RuntimeException ignored) {
            return ScopeResolution.deny();
        }
        OrganizationTaskPathLookup.TaskPath taskPath;
        try {
            taskPath = statusTransitionTarget
                ? taskPaths.requireStatusTransitionTaskPath(session.workspaceUuid(), session.groupWorkspaceKey(), target.resourceType(), target.resourceId())
                : taskPaths.requireTaskPath(session.workspaceUuid(), session.groupWorkspaceKey(), target.resourceType(), target.resourceId());
        } catch (RuntimeException ignored) {
            return ScopeResolution.deny();
        }
        if (assignment == null || assignment.serviceNodeType() == null || assignment.serviceNodeId() == null
            || !taskPath.targetType().equals(target.resourceType()) || !taskPath.targetId().equals(target.resourceId())
            || !(taskPaths.isScopeAllowed(session.workspaceUuid(), session.groupWorkspaceKey(), assignment.serviceNodeType(), assignment.serviceNodeId(), taskPath)
                || allowsHeadCompanyToCreateHeadCompany(capability, assignment, taskPath))) {
            return ScopeResolution.deny();
        }
        return ScopeResolution.allow(
            capability,
            new FirstOwnerQueryPredicate(
                session.workspaceUuid(), session.groupWorkspaceKey(), target.resourceType(), target.resourceId(),
                assignment.serviceNodeType(), assignment.serviceNodeId(), taskPath.ancestorIds()
            )
        );
    }

    /**
     * A head-company role may hold only the total-company create capability. The operation's
     * owner fact is still the commercial group, so this is deliberately not a generic
     * HEAD_COMPANY-to-GROUP scope rule.
     */
    private static boolean allowsHeadCompanyToCreateHeadCompany(
        String capability,
        WorkspaceAssignmentScopeLookup.AssignmentScope assignment,
        OrganizationTaskPathLookup.TaskPath taskPath
    ) {
        return WorkspaceAuthorizationCatalog.CapabilityKeys.BC_ORG_HEAD_COMPANY_CREATE.equals(capability)
            && "HEAD_COMPANY".equals(assignment.serviceNodeType())
            && "GROUP".equals(taskPath.targetType());
    }

    /**
     * A session readback is only a navigation projection.  Production authorization must
     * re-read the active assignment and role capability so revocation between page load and
     * command/read execution cannot be bypassed by a stale session snapshot.
     */
    private boolean hasCurrentCapability(WorkspaceSessionReadback session, String capability) {
        if (jdbc == null) {
            return session.actionCapabilityKeys() != null && session.actionCapabilityKeys().contains(capability);
        }
        Boolean allowed = jdbc.query(
            "SELECT EXISTS(SELECT 1 FROM workspace_iam.role_assignment assignment "
                + "JOIN workspace_iam.workspace_role role ON role.id=assignment.role_id "
                + "WHERE assignment.id=? AND assignment.workspace_uuid=? "
                + "AND assignment.group_workspace_key=? AND assignment.status='ACTIVE' "
                + "AND role.workspace_uuid=assignment.workspace_uuid "
                + "AND role.group_workspace_key=assignment.group_workspace_key "
                + "AND role.status='ENABLED' AND jsonb_exists(role.capability_keys, ?))",
            statement -> {
                statement.setObject(1, session.currentAssignmentId());
                statement.setObject(2, session.workspaceUuid());
                statement.setString(3, session.groupWorkspaceKey());
                statement.setString(4, capability);
            },
            result -> result.next() && result.getBoolean(1)
        );
        return Boolean.TRUE.equals(allowed);
    }

    public record ServerResolvedResource(String resourceType, UUID resourceId) { }

    /** Owner commands must apply this predicate in their first target query, then re-check their invariant. */
    public record FirstOwnerQueryPredicate(
        UUID workspaceUuid,
        String groupWorkspaceKey,
        String resourceType,
        UUID resourceId,
        String assignmentNodeType,
        UUID assignmentNodeId,
        java.util.List<UUID> targetAncestorIds
    ) { }

    public enum Decision { ALLOW, DENY }

    public record ScopeResolution(Decision decision, String capabilityKey, FirstOwnerQueryPredicate firstOwnerQueryPredicate) {
        public OperationsOwnerScopeGrant ownerScopeGrant(String requirementId) {
            if (decision != Decision.ALLOW || firstOwnerQueryPredicate == null || capabilityKey == null) {
                throw new WorkspaceCommandAuthorizationService.AuthorizationDeniedException();
            }
            return new OperationsOwnerScopeGrant(
                firstOwnerQueryPredicate.workspaceUuid(), firstOwnerQueryPredicate.groupWorkspaceKey(),
                requirementId, capabilityKey, firstOwnerQueryPredicate.resourceType(), firstOwnerQueryPredicate.resourceId(),
                firstOwnerQueryPredicate.assignmentNodeType(), firstOwnerQueryPredicate.assignmentNodeId(),
                firstOwnerQueryPredicate.targetAncestorIds()
            );
        }
        static ScopeResolution allow(String capabilityKey, FirstOwnerQueryPredicate predicate) {
            return new ScopeResolution(Decision.ALLOW, capabilityKey, predicate);
        }

        static ScopeResolution deny() {
            return new ScopeResolution(Decision.DENY, null, null);
        }
    }
}
