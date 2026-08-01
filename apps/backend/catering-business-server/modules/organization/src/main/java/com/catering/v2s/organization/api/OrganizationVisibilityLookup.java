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

    record VisibleDataNodeCandidate(
        String dataNodeType,
        UUID dataNodeId,
        String dataNodeName,
        List<String> ancestorPath,
        UUID regionId,
        UUID projectId,
        UUID storeId
    ) { }
}
