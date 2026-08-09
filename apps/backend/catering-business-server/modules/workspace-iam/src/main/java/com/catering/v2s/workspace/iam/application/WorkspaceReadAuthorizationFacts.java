package com.catering.v2s.workspace.iam.application;

import com.catering.v2s.organization.api.OrganizationVisibilityLookup;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionEntryReadback;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/** Immutable authorization and visibility facts for one authenticated operations task read. */
public record WorkspaceReadAuthorizationFacts(
    UUID sessionId,
    UUID workspaceUuid,
    String groupWorkspaceKey,
    UUID accountId,
    UUID assignmentId,
    UUID roleId,
    String assignmentNodeType,
    UUID assignmentNodeId,
    long contextVersion,
    long authorizationRevision,
    String accountDisplayName,
    Set<String> pageAccessKeys,
    Set<String> actionCapabilityKeys,
    OrganizationVisibilityLookup.VisibleOrganizationFacts visibleOrganizationFacts
) {
    public WorkspaceReadAuthorizationFacts {
        pageAccessKeys = Set.copyOf(pageAccessKeys);
        actionCapabilityKeys = Set.copyOf(actionCapabilityKeys);
    }

    /** Projects the existing edge session shape without another owner lookup. */
    public WorkspaceSessionReadback sessionReadback() {
        return new WorkspaceSessionReadback(
            sessionId, workspaceUuid, groupWorkspaceKey, accountId, assignmentId, scopeContext(),
            contextVersion, authorizationRevision, pageAccessKeys, actionCapabilityKeys, accountDisplayName
        );
    }

    private WorkspaceSessionEntryReadback.ScopeContext scopeContext() {
        var scope = visibleOrganizationFacts.scopeContext();
        return new WorkspaceSessionEntryReadback.ScopeContext(
            readback(scope.region()), readback(scope.project()), readback(scope.store()), readback(scope.headCompany())
        );
    }

    private static WorkspaceSessionEntryReadback.VisibleDataNodeCandidate readback(
        OrganizationVisibilityLookup.VisibleDataNodeCandidate value
    ) {
        if (value == null) return null;
        return new WorkspaceSessionEntryReadback.VisibleDataNodeCandidate(
            value.dataNodeType(), value.dataNodeId(), value.dataNodeName(), value.dataNodeCode(),
            List.copyOf(value.ancestorPath()), value.regionId(), value.projectId(), value.storeId(), value.headCompanyId()
        );
    }
}
