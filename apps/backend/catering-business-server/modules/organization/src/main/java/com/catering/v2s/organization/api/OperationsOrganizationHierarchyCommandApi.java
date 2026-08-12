package com.catering.v2s.organization.api;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.extension.api.ExtensionSubmission;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/**
 * Typed operations-owner boundary for hierarchy commands that accept dynamic extension fields.
 * The application handler supplies server-resolved scope and actor facts; this owner performs
 * its own target recheck before idempotency receipt replay.
 */
public interface OperationsOrganizationHierarchyCommandApi {
    OrganizationNodeReadback createRegion(CreateRegionCommand command);

    OrganizationNodeReadback createProject(CreateProjectCommand command);

    OrganizationNodeReadback updateNode(UpdateNodeCommand command);

    OrganizationNodeReadback transitionNodeStatus(TransitionNodeStatusCommand command);

    record CreateRegionCommand(
        UUID workspaceUuid,
        String groupWorkspaceKey,
        String code,
        String name,
        String notes,
        ExtensionSubmission extensionSubmission,
        String idempotencyKey,
        AuditActor actor,
        OperationsOwnerScopeGrant ownerScopeGrant
    ) {
        public CreateRegionCommand {
            extensionSubmission = normalized(extensionSubmission);
            actor = Objects.requireNonNull(actor, "actor");
            ownerScopeGrant = Objects.requireNonNull(ownerScopeGrant, "ownerScopeGrant");
        }
    }

    record CreateProjectCommand(
        UUID workspaceUuid,
        String groupWorkspaceKey,
        UUID regionId,
        String code,
        String name,
        String notes,
        List<String> phaseNames,
        ExtensionSubmission extensionSubmission,
        String idempotencyKey,
        AuditActor actor,
        OperationsOwnerScopeGrant ownerScopeGrant
    ) {
        public CreateProjectCommand {
            phaseNames = phaseNames == null ? List.of() : List.copyOf(phaseNames);
            extensionSubmission = normalized(extensionSubmission);
            actor = Objects.requireNonNull(actor, "actor");
            ownerScopeGrant = Objects.requireNonNull(ownerScopeGrant, "ownerScopeGrant");
        }
    }

    record UpdateNodeCommand(
        UUID workspaceUuid,
        String groupWorkspaceKey,
        UUID nodeId,
        String code,
        String name,
        UUID parentId,
        String notes,
        List<String> phaseNames,
        long expectedVersion,
        ExtensionSubmission extensionSubmission,
        String idempotencyKey,
        AuditActor actor,
        OperationsOwnerScopeGrant ownerScopeGrant
    ) {
        public UpdateNodeCommand {
            phaseNames = phaseNames == null ? List.of() : List.copyOf(phaseNames);
            extensionSubmission = normalized(extensionSubmission);
            actor = Objects.requireNonNull(actor, "actor");
            ownerScopeGrant = Objects.requireNonNull(ownerScopeGrant, "ownerScopeGrant");
        }
    }

    record TransitionNodeStatusCommand(
        UUID workspaceUuid,
        String groupWorkspaceKey,
        UUID nodeId,
        long expectedVersion,
        String targetStatus,
        String idempotencyKey,
        AuditActor actor,
        OperationsOwnerScopeGrant ownerScopeGrant
    ) {
        public TransitionNodeStatusCommand {
            actor = Objects.requireNonNull(actor, "actor");
            ownerScopeGrant = Objects.requireNonNull(ownerScopeGrant, "ownerScopeGrant");
        }
    }

    private static ExtensionSubmission normalized(ExtensionSubmission value) {
        return value == null ? new ExtensionSubmission(List.of()) : value;
    }
}
