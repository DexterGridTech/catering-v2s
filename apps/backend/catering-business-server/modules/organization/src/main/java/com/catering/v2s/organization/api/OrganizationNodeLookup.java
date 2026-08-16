package com.catering.v2s.organization.api;

import java.util.UUID;

/** Public owner judgment API for consumers such as workspace-IAM and contract. */
public interface OrganizationNodeLookup {
    OrganizationNodeReadback requireNode(
            UUID workspaceUuid, String groupWorkspaceKey, UUID nodeId, String requiredType);

    boolean isEnterable(UUID workspaceUuid, String groupWorkspaceKey, UUID nodeId);

    /**
     * A display-only readback of the node's real hierarchy. Consumers may use this for a user-facing acknowledgement,
     * but it grants neither read nor write authority over the organization owner.
     */
    String describePath(UUID workspaceUuid, String groupWorkspaceKey, UUID nodeId);
}
