package com.catering.v2s.organization.api;

import java.util.List;
import java.util.UUID;

/** Organization-owned judgment for a selected visible data node. */
public interface OrganizationVisibilityLookup {
    boolean isVisibleDataNodeAllowed(
        UUID workspaceUuid,
        String groupWorkspaceKey,
        String assignmentNodeType,
        UUID assignmentNodeId,
        UUID visibleNodeId
    );

    /**
     * Owner-scoped task read for an already authenticated role assignment. It
     * deliberately does not expose the workspace-wide enabled-node inventory.
     */
    default List<VisibleDataNodeCandidate> listVisibleDataNodeCandidates(
        UUID workspaceUuid,
        String groupWorkspaceKey,
        String assignmentNodeType,
        UUID assignmentNodeId
    ) {
        throw new UnsupportedOperationException("visible data-node candidate enumeration is unavailable");
    }

    /**
     * Describes the owner-persisted selector context without widening the
     * candidate set.  In particular, a STORE assignment can display its
     * fixed region and project even though neither is selectable by that role.
     */
    default ScopeContext describeScopeContext(
        UUID workspaceUuid,
        String groupWorkspaceKey,
        UUID regionId,
        UUID projectId,
        UUID storeId,
        UUID headCompanyId
    ) {
        List<VisibleDataNodeCandidate> candidates = listVisibleDataNodeCandidates(workspaceUuid, groupWorkspaceKey, "GROUP", null);
        return new ScopeContext(
            find(candidates, "REGION", regionId),
            find(candidates, "PROJECT", projectId),
            find(candidates, "STORE", storeId),
            find(candidates, "HEAD_COMPANY", headCompanyId)
        );
    }

    private static VisibleDataNodeCandidate find(List<VisibleDataNodeCandidate> candidates, String type, UUID id) {
        return id == null ? null : candidates.stream().filter(value -> type.equals(value.dataNodeType()) && id.equals(value.dataNodeId())).findFirst().orElse(null);
    }

    record ScopeContext(
        VisibleDataNodeCandidate region,
        VisibleDataNodeCandidate project,
        VisibleDataNodeCandidate store,
        VisibleDataNodeCandidate headCompany
    ) { }

    record VisibleDataNodeCandidate(
        String dataNodeType,
        UUID dataNodeId,
        String dataNodeName,
        String dataNodeCode,
        List<String> ancestorPath,
        UUID regionId,
        UUID projectId,
        UUID storeId,
        UUID headCompanyId
    ) { }
}
