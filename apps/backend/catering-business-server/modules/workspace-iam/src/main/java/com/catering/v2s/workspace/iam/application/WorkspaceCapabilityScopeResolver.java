package com.catering.v2s.workspace.iam.application;

import com.catering.v2s.organization.api.OrganizationTaskPathLookup;
import com.catering.v2s.organization.api.WorkspaceAssignmentScopeLookup;
import com.catering.v2s.workspace.iam.api.WorkspaceCapabilityRequirementCatalog;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

    public WorkspaceCapabilityScopeResolver(
        WorkspaceAssignmentScopeLookup assignments,
        OrganizationTaskPathLookup taskPaths
    ) {
        this.assignments = assignments;
        this.taskPaths = taskPaths;
    }

    @Transactional(readOnly = true)
    public ScopeResolution resolve(
        WorkspaceSessionReadback session,
        String requirementId,
        ServerResolvedResource target
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
        if (capability == null || session.actionCapabilityKeys() == null
            || !session.actionCapabilityKeys().contains(capability)) {
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
            taskPath = taskPaths.requireTaskPath(session.workspaceUuid(), session.groupWorkspaceKey(), target.resourceType(), target.resourceId());
        } catch (RuntimeException ignored) {
            return ScopeResolution.deny();
        }
        if (assignment == null || assignment.serviceNodeType() == null || assignment.serviceNodeId() == null
            || !taskPath.targetType().equals(target.resourceType()) || !taskPath.targetId().equals(target.resourceId())
            || !taskPaths.isScopeAllowed(session.workspaceUuid(), session.groupWorkspaceKey(), assignment.serviceNodeType(), assignment.serviceNodeId(), taskPath)) {
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
        static ScopeResolution allow(String capabilityKey, FirstOwnerQueryPredicate predicate) {
            return new ScopeResolution(Decision.ALLOW, capabilityKey, predicate);
        }

        static ScopeResolution deny() {
            return new ScopeResolution(Decision.DENY, null, null);
        }
    }
}
