package com.catering.v2s.organization.api;

import java.util.List;
import java.util.UUID;

/**
 * Server-resolved authorization facts handed from workspace-IAM to an organization or
 * contract owner.  It intentionally carries no client-selected scope or capability.
 */
public record OperationsOwnerScopeGrant(
    UUID workspaceUuid,
    String groupWorkspaceKey,
    String requirementId,
    String capabilityKey,
    String targetType,
    UUID targetId,
    String assignmentNodeType,
    UUID assignmentNodeId,
    List<UUID> targetAncestorIds
) {
    public OperationsOwnerScopeGrant {
        targetAncestorIds = List.copyOf(targetAncestorIds);
    }

    public boolean matches(UUID workspaceUuid, String groupWorkspaceKey, String targetType, UUID targetId) {
        return this.workspaceUuid.equals(workspaceUuid)
            && this.groupWorkspaceKey.equals(groupWorkspaceKey)
            && this.targetType.equals(targetType)
            && this.targetId.equals(targetId);
    }
}
