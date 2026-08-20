package com.catering.v2s.businesschannel.api;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import java.util.Objects;
import java.util.UUID;

/**
 * Typed commands owned by business-channel. Cross-owner commands carry only declared readback facts. C-02 keeps node
 * type and node reference as separate facts; C-08 has no runtime rule DSL and C-09 has no quantitative compliance gate
 * in this owner.
 */
public interface BusinessChannelCommandApi {
    BusinessChannelReadback.Template createTemplate(CreateTemplateCommand command);

    BusinessChannelReadback.Template updateTemplate(UpdateTemplateCommand command);

    BusinessChannelReadback.Template transitionTemplateStatus(TransitionTemplateStatusCommand command);

    BusinessChannelReadback.Channel createChannel(CreateChannelCommand command);

    BusinessChannelReadback.Channel updateChannel(UpdateChannelCommand command);

    BusinessChannelReadback.Channel transitionChannelStatus(TransitionChannelStatusCommand command);

    /** C-04 remains pending; this is only the accepted detach fact, not an invented unbind state machine. */
    BusinessChannelReadback.Channel returnChannelToDraftAfterBindingDeletion(
            ReturnChannelToDraftAfterBindingDeletionCommand command, long expectedVersion);

    /** C-01 remains pending; this command only adds the external stop fact and never clears stop reasons. */
    BusinessChannelReadback.Channel applyExternalStopReason(
            ApplyExternalStopReasonCommand command, long expectedVersion);

    default BusinessChannelReadback.Channel returnChannelToDraftAfterBindingDeletion(
            ReturnChannelToDraftAfterBindingDeletionCommand command) {
        return returnChannelToDraftAfterBindingDeletion(command, command.expectedVersion());
    }

    default BusinessChannelReadback.Channel applyExternalStopReason(ApplyExternalStopReasonCommand command) {
        return applyExternalStopReason(command, command.expectedVersion());
    }

    record CreateTemplateCommand(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID projectRef,
            String templateName,
            String templateCode,
            String accessKind,
            String operatorKind,
            String orderKind,
            String dineInForm,
            String providerCode,
            long contextVersion,
            String idempotencyKey,
            AuditActor actor,
            OperationsOwnerScopeGrant ownerScopeGrant) {
        public CreateTemplateCommand {
            actor = Objects.requireNonNull(actor, "actor");
            ownerScopeGrant = Objects.requireNonNull(ownerScopeGrant, "ownerScopeGrant");
        }
    }

    record UpdateTemplateCommand(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID templateRef,
            String templateName,
            long expectedVersion,
            long contextVersion,
            String idempotencyKey,
            AuditActor actor,
            OperationsOwnerScopeGrant ownerScopeGrant) {
        public UpdateTemplateCommand {
            actor = Objects.requireNonNull(actor, "actor");
            ownerScopeGrant = Objects.requireNonNull(ownerScopeGrant, "ownerScopeGrant");
        }
    }

    record TransitionTemplateStatusCommand(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID templateRef,
            String status,
            long expectedVersion,
            long contextVersion,
            String idempotencyKey,
            AuditActor actor,
            OperationsOwnerScopeGrant ownerScopeGrant) {
        public TransitionTemplateStatusCommand {
            actor = Objects.requireNonNull(actor, "actor");
            ownerScopeGrant = Objects.requireNonNull(ownerScopeGrant, "ownerScopeGrant");
        }
    }

    record CreateChannelCommand(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID templateRef,
            String ownerNodeType,
            String ownerNodeRef,
            /** User-entered, immutable after creation, and unique within the group workspace. */
            String channelCode,
            String channelName,
            UUID bindingRef,
            long contextVersion,
            String idempotencyKey,
            AuditActor actor,
            OperationsOwnerScopeGrant ownerScopeGrant) {
        public CreateChannelCommand {
            actor = Objects.requireNonNull(actor, "actor");
            ownerScopeGrant = Objects.requireNonNull(ownerScopeGrant, "ownerScopeGrant");
        }
    }

    record UpdateChannelCommand(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID channelRef,
            String channelName,
            UUID bindingRef,
            long expectedVersion,
            long contextVersion,
            String idempotencyKey,
            AuditActor actor,
            OperationsOwnerScopeGrant ownerScopeGrant) {
        public UpdateChannelCommand {
            actor = Objects.requireNonNull(actor, "actor");
            ownerScopeGrant = Objects.requireNonNull(ownerScopeGrant, "ownerScopeGrant");
        }
    }

    record TransitionChannelStatusCommand(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID channelRef,
            String status,
            long expectedVersion,
            long contextVersion,
            String idempotencyKey,
            AuditActor actor,
            OperationsOwnerScopeGrant ownerScopeGrant) {
        public TransitionChannelStatusCommand {
            actor = Objects.requireNonNull(actor, "actor");
            ownerScopeGrant = Objects.requireNonNull(ownerScopeGrant, "ownerScopeGrant");
        }
    }

    record ReturnChannelToDraftAfterBindingDeletionCommand(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID channelRef,
            long expectedVersion,
            String idempotencyKey,
            AuditActor actor) {
        public ReturnChannelToDraftAfterBindingDeletionCommand {
            actor = Objects.requireNonNull(actor, "actor");
        }
    }

    record ApplyExternalStopReasonCommand(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID channelRef,
            String providerCode,
            long expectedVersion,
            String idempotencyKey,
            AuditActor actor) {
        public ApplyExternalStopReasonCommand {
            actor = Objects.requireNonNull(actor, "actor");
        }
    }

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
