package com.catering.v2s.organization.api;

import java.util.List;
import java.util.Objects;
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
        return Objects.equals(this.workspaceUuid, workspaceUuid)
            && Objects.equals(this.groupWorkspaceKey, groupWorkspaceKey)
            && Objects.equals(this.targetType, targetType)
            && Objects.equals(this.targetId, targetId);
    }

    /**
     * Command owners must bind the server-minted capability as well as the target scope.
     * A scope-only match is not authority for a capability-governed write workflow.
     */
    public boolean matchesCapability(UUID workspaceUuid, String groupWorkspaceKey, String targetType, UUID targetId,
                                     String expectedCapabilityKey) {
        return matches(workspaceUuid, groupWorkspaceKey, targetType, targetId)
            && Objects.equals(this.capabilityKey, expectedCapabilityKey);
    }

    /**
     * Coordinated owner commands bind the originating operation requirement as
     * well as the target scope and capability.  A grant minted for another
     * catalog or inventory operation is not authority to enter that command.
     */
    public boolean matchesRequirementAndCapability(UUID workspaceUuid, String groupWorkspaceKey, String targetType,
                                                   UUID targetId, String expectedRequirementId,
                                                   String expectedCapabilityKey) {
        return matchesCapability(workspaceUuid, groupWorkspaceKey, targetType, targetId, expectedCapabilityKey)
            && Objects.equals(this.requirementId, expectedRequirementId);
    }
}
