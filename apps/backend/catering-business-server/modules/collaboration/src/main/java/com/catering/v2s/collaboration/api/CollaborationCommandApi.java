package com.catering.v2s.collaboration.api;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import java.util.Objects;
import java.util.UUID;

/**
 * Collaboration owner commands. Platform and operations faces are separate command types so an operations grant can
 * never be accidentally treated as platform authorization.
 */
public interface CollaborationCommandApi {
    CollaborationReadback.ExternalSystem transitionExternalSystemStatus(TransitionExternalSystemStatusCommand command);

    CollaborationReadback.ProviderProfile transitionProviderProfileStatus(
            TransitionProviderProfileStatusCommand command);

    CollaborationReadback.OwnerBinding createPlatformBinding(CreatePlatformBindingCommand command);

    CollaborationReadback.OwnerBinding createOperationsBinding(CreateOperationsBindingCommand command);

    CollaborationReadback.OwnerBinding updatePlatformBinding(UpdatePlatformBindingCommand command);

    CollaborationReadback.OwnerBinding requestOrDeletePlatformBinding(DeletePlatformBindingCommand command);

    CollaborationReadback.OwnerBinding requestOrDeleteOperationsBinding(DeleteOperationsBindingCommand command);

    CollaborationReadback.OwnerBinding applyAuthorizationCallback(AuthorizationCallbackCommand command);

    CollaborationReadback.OwnerBinding applyRevocationCallback(RevocationCallbackCommand command);

    default CollaborationReadback.OwnerBinding createBinding(CreatePlatformBindingCommand command) {
        return createPlatformBinding(command);
    }

    default CollaborationReadback.OwnerBinding createBinding(CreateOperationsBindingCommand command) {
        return createOperationsBinding(command);
    }

    default CollaborationReadback.OwnerBinding updateBinding(UpdatePlatformBindingCommand command) {
        return updatePlatformBinding(command);
    }

    default CollaborationReadback.OwnerBinding requestOrDeleteBinding(DeletePlatformBindingCommand command) {
        return requestOrDeletePlatformBinding(command);
    }

    default CollaborationReadback.OwnerBinding requestOrDeleteBinding(DeleteOperationsBindingCommand command) {
        return requestOrDeleteOperationsBinding(command);
    }

    record TransitionExternalSystemStatusCommand(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String externalSystemCode,
            String status,
            long expectedVersion,
            String idempotencyKey,
            AuditActor actor) {
        public TransitionExternalSystemStatusCommand {
            actor = Objects.requireNonNull(actor, "actor");
        }
    }

    record TransitionProviderProfileStatusCommand(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String providerCode,
            String status,
            long expectedVersion,
            String idempotencyKey,
            AuditActor actor) {
        public TransitionProviderProfileStatusCommand {
            actor = Objects.requireNonNull(actor, "actor");
        }
    }

    record CreatePlatformBindingCommand(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String providerCode,
            String capabilityClass,
            String nodeType,
            String nodeRef,
            String bindingDisplayName,
            String externalOwnerId,
            String idempotencyKey,
            AuditActor actor) {
        public CreatePlatformBindingCommand {
            actor = Objects.requireNonNull(actor, "actor");
        }
    }

    record CreateOperationsBindingCommand(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String providerCode,
            String capabilityClass,
            String nodeType,
            String nodeRef,
            String bindingDisplayName,
            String externalOwnerId,
            long contextVersion,
            String idempotencyKey,
            AuditActor actor,
            OperationsOwnerScopeGrant ownerScopeGrant) {
        public CreateOperationsBindingCommand {
            actor = Objects.requireNonNull(actor, "actor");
            ownerScopeGrant = Objects.requireNonNull(ownerScopeGrant, "ownerScopeGrant");
        }
    }

    record UpdatePlatformBindingCommand(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID bindingRef,
            String bindingDisplayName,
            String externalOwnerId,
            long expectedVersion,
            String idempotencyKey,
            AuditActor actor) {
        public UpdatePlatformBindingCommand {
            actor = Objects.requireNonNull(actor, "actor");
        }
    }

    record DeletePlatformBindingCommand(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID bindingRef,
            long expectedVersion,
            String idempotencyKey,
            AuditActor actor) {
        public DeletePlatformBindingCommand {
            actor = Objects.requireNonNull(actor, "actor");
        }
    }

    record DeleteOperationsBindingCommand(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID bindingRef,
            long expectedVersion,
            long contextVersion,
            String idempotencyKey,
            AuditActor actor,
            OperationsOwnerScopeGrant ownerScopeGrant) {
        public DeleteOperationsBindingCommand {
            actor = Objects.requireNonNull(actor, "actor");
            ownerScopeGrant = Objects.requireNonNull(ownerScopeGrant, "ownerScopeGrant");
        }
    }

    /** Adapter identity is an opaque audit boundary; the callback payload itself never enters this owner. */
    record AuthorizationCallbackCommand(
            UUID bindingRef,
            String externalOwnerId,
            String authorizationReference,
            String adapterIdentity,
            String idempotencyKey) {}

    /** The adapter reports revocation as a fact; it does not send a URL, signature or raw provider payload. */
    record RevocationCallbackCommand(UUID bindingRef, String adapterIdentity, String idempotencyKey) {}

    final class Problem extends RuntimeException {
        private static final long serialVersionUID = 1L;
        private final String code;
        private final int status;

        public Problem(String code, int status, String message) {
            super(message);
            this.code = code;
            this.status = status;
        }

        public Problem(String code, int status, String message, Throwable cause) {
            super(message, cause);
            this.code = code;
            this.status = status;
        }

        public String code() {
            return code;
        }

        public int status() {
            return status;
        }
    }
}
