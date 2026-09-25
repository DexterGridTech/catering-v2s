package com.catering.v2s.businesschannel.api;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.collaboration.api.CollaborationReadback;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.platform.foundation.contract.OwnerProblem;
import java.util.List;
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

    /** Detaches a collaboration binding without rewriting the channel's own lifecycle status. */
    BusinessChannelReadback.Channel detachChannelBinding(DetachChannelBindingCommand command, long expectedVersion);

    default BusinessChannelReadback.Channel detachChannelBinding(DetachChannelBindingCommand command) {
        return detachChannelBinding(command, command.expectedVersion());
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
            String urlRule,
            String storeVisibilityScope,
            List<UUID> visibleStoreRefs,
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
            String storeVisibilityScope,
            String urlRule,
            List<UUID> visibleStoreRefs,
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
            OperationsOwnerScopeGrant ownerScopeGrant,
            CollaborationReadback.OwnerBinding bindingReadback,
            BusinessChannelReadback.Channel initialChannelReadback) {
        public UpdateChannelCommand(
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
            this(
                    workspaceUuid,
                    groupWorkspaceKey,
                    channelRef,
                    channelName,
                    bindingRef,
                    expectedVersion,
                    contextVersion,
                    idempotencyKey,
                    actor,
                    ownerScopeGrant,
                    null,
                    null);
        }

        /** Cross-owner attach path supplies the already-created binding readback, but never a trusted channel row. */
        public UpdateChannelCommand(
                UUID workspaceUuid,
                String groupWorkspaceKey,
                UUID channelRef,
                String channelName,
                UUID bindingRef,
                long expectedVersion,
                long contextVersion,
                String idempotencyKey,
                AuditActor actor,
                OperationsOwnerScopeGrant ownerScopeGrant,
                CollaborationReadback.OwnerBinding bindingReadback) {
            this(
                    workspaceUuid,
                    groupWorkspaceKey,
                    channelRef,
                    channelName,
                    bindingRef,
                    expectedVersion,
                    contextVersion,
                    idempotencyKey,
                    actor,
                    ownerScopeGrant,
                    bindingReadback,
                    null);
        }

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

    record DetachChannelBindingCommand(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID channelRef,
            long expectedVersion,
            String idempotencyKey,
            AuditActor actor,
            UUID expectedBindingRef) {
        public DetachChannelBindingCommand(
                UUID workspaceUuid,
                String groupWorkspaceKey,
                UUID channelRef,
                long expectedVersion,
                String idempotencyKey,
                AuditActor actor) {
            this(workspaceUuid, groupWorkspaceKey, channelRef, expectedVersion, idempotencyKey, actor, null);
        }

        public DetachChannelBindingCommand {
            actor = Objects.requireNonNull(actor, "actor");
        }
    }

    final class Problem extends RuntimeException implements OwnerProblem {
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

        @Override
        public String code() {
            return code;
        }

        @Override
        public int status() {
            return status;
        }
    }
}
