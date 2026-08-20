package com.catering.v2s.app.edge.externalcollaboration;

import com.catering.v2s.businesschannel.api.BusinessChannelCommandApi;
import com.catering.v2s.businesschannel.api.BusinessChannelReadApi;
import com.catering.v2s.businesschannel.api.BusinessChannelReadback;
import com.catering.v2s.collaboration.api.CollaborationCatalogReadApi;
import com.catering.v2s.collaboration.api.CollaborationCommandApi;
import com.catering.v2s.collaboration.api.CollaborationReadback;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.platform.foundation.security.Sha256Hex;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Finite edge coordinator for the approved collaboration/channel command pairs. It owns no facts: each mutation is
 * delegated to the owning API and joins the same REQUIRED transaction.
 */
@Service
public class ExternalCollaborationBusinessChannelCoordinator {
    private static final String DISABLED = "DISABLED";
    private static final String IDEMPOTENCY_NAMESPACE = "external-collaboration-business-channel";

    private final CollaborationCommandApi collaboration;
    private final CollaborationCatalogReadApi catalog;
    private final BusinessChannelReadApi businessChannelsRead;
    private final BusinessChannelCommandApi businessChannels;

    public ExternalCollaborationBusinessChannelCoordinator(
            CollaborationCommandApi collaboration,
            CollaborationCatalogReadApi catalog,
            BusinessChannelReadApi businessChannelsRead,
            BusinessChannelCommandApi businessChannels) {
        this.collaboration = collaboration;
        this.catalog = catalog;
        this.businessChannelsRead = businessChannelsRead;
        this.businessChannels = businessChannels;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public CollaborationReadback.OwnerBinding deletePlatformBinding(
            CollaborationCommandApi.DeletePlatformBindingCommand command) {
        List<BusinessChannelReadback.Channel> attached = businessChannelsRead.findChannelsForBinding(
                command.workspaceUuid(), command.groupWorkspaceKey(), command.bindingRef());
        CollaborationReadback.OwnerBinding result = collaboration.requestOrDeletePlatformBinding(command);
        for (BusinessChannelReadback.Channel channel : attached) {
            businessChannels.returnChannelToDraftAfterBindingDeletion(
                    new BusinessChannelCommandApi.ReturnChannelToDraftAfterBindingDeletionCommand(
                            command.workspaceUuid(),
                            command.groupWorkspaceKey(),
                            channel.channelRef(),
                            channel.version(),
                            childKey(command.idempotencyKey(), "binding-delete", channel.channelRef()),
                            command.actor()));
        }
        return result;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public CollaborationReadback.OwnerBinding deleteOperationsBinding(
            CollaborationCommandApi.DeleteOperationsBindingCommand command, UUID channelRef) {
        BusinessChannelReadback.Channel channel =
                requireChannel(command.workspaceUuid(), command.groupWorkspaceKey(), channelRef);
        requireBinding(channel, command.bindingRef());
        CollaborationReadback.OwnerBinding result = collaboration.requestOrDeleteOperationsBinding(command);
        businessChannels.returnChannelToDraftAfterBindingDeletion(
                new BusinessChannelCommandApi.ReturnChannelToDraftAfterBindingDeletionCommand(
                        command.workspaceUuid(),
                        command.groupWorkspaceKey(),
                        channel.channelRef(),
                        channel.version(),
                        childKey(command.idempotencyKey(), "binding-delete", channel.channelRef()),
                        command.actor()));
        return result;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public CollaborationReadback.OwnerBinding createOperationsBinding(
            CollaborationCommandApi.CreateOperationsBindingCommand command,
            UUID channelRef,
            OperationsOwnerScopeGrant businessChannelGrant) {
        BusinessChannelReadback.Channel channel =
                requireChannel(command.workspaceUuid(), command.groupWorkspaceKey(), channelRef);
        if (channel.bindingRef() != null) {
            throw problem("CHANNEL_BINDING_ALREADY_ATTACHED", 409, "business channel already has a binding");
        }
        CollaborationReadback.OwnerBinding result = collaboration.createOperationsBinding(command);
        businessChannels.updateChannel(new BusinessChannelCommandApi.UpdateChannelCommand(
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                channel.channelRef(),
                channel.channelName(),
                result.bindingRef(),
                channel.version(),
                command.contextVersion(),
                childKey(command.idempotencyKey(), "binding-attach", channel.channelRef()),
                command.actor(),
                Objects.requireNonNull(businessChannelGrant, "businessChannelGrant")));
        return result;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public CollaborationReadback.OwnerBinding updateOperationsBinding(
            CollaborationCommandApi.UpdateOperationsBindingCommand command, UUID channelRef) {
        BusinessChannelReadback.Channel channel =
                requireChannel(command.workspaceUuid(), command.groupWorkspaceKey(), channelRef);
        requireBinding(channel, command.bindingRef());
        requireEditable(channel);
        return collaboration.updateOperationsBinding(command);
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public CollaborationReadback.ExternalSystem transitionExternalSystemStatus(
            CollaborationCommandApi.TransitionExternalSystemStatusCommand command) {
        CollaborationReadback.Tree tree = catalog.readTree(command.workspaceUuid(), command.groupWorkspaceKey());
        CollaborationReadback.ExternalSystem result = collaboration.transitionExternalSystemStatus(command);
        if (DISABLED.equals(command.status())) {
            tree.providerProfiles().stream()
                    .filter(profile -> Objects.equals(profile.externalSystemCode(), command.externalSystemCode()))
                    .forEach(profile -> applyStopForProvider(
                            command.workspaceUuid(),
                            command.groupWorkspaceKey(),
                            profile.providerCode(),
                            command.idempotencyKey(),
                            command.actor()));
        }
        return result;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public CollaborationReadback.ProviderProfile transitionProviderProfileStatus(
            CollaborationCommandApi.TransitionProviderProfileStatusCommand command) {
        CollaborationReadback.ProviderProfile result = collaboration.transitionProviderProfileStatus(command);
        if (DISABLED.equals(command.status())) {
            applyStopForProvider(
                    command.workspaceUuid(),
                    command.groupWorkspaceKey(),
                    command.providerCode(),
                    command.idempotencyKey(),
                    command.actor());
        }
        return result;
    }

    private void applyStopForProvider(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String providerCode,
            String idempotencyKey,
            com.catering.v2s.audit.contract.AuditActor actor) {
        for (BusinessChannelReadback.Channel channel :
                businessChannelsRead.findChannelsForProvider(workspaceUuid, groupWorkspaceKey, providerCode)) {
            businessChannels.applyExternalStopReason(new BusinessChannelCommandApi.ApplyExternalStopReasonCommand(
                    workspaceUuid,
                    groupWorkspaceKey,
                    channel.channelRef(),
                    providerCode,
                    channel.version(),
                    childKey(idempotencyKey, "provider-stop-" + providerCode, channel.channelRef()),
                    actor));
        }
    }

    private BusinessChannelReadback.Channel requireChannel(
            UUID workspaceUuid, String groupWorkspaceKey, UUID channelRef) {
        if (channelRef == null) throw problem("CHANNEL_CONTEXT_REQUIRED", 422, "channelRef is required");
        BusinessChannelReadback.Channel channel =
                businessChannelsRead.readChannel(workspaceUuid, groupWorkspaceKey, channelRef);
        if (channel == null) throw problem("CHANNEL_NOT_FOUND", 404, "business channel was not found");
        return channel;
    }

    private static void requireBinding(BusinessChannelReadback.Channel channel, UUID bindingRef) {
        if (!Objects.equals(channel.bindingRef(), bindingRef)) {
            throw problem("BINDING_CONTEXT_MISMATCH", 409, "binding is not attached to the selected business channel");
        }
    }

    private static void requireEditable(BusinessChannelReadback.Channel channel) {
        if (DISABLED.equals(channel.status())) {
            throw problem("DISABLED_OBJECT_NOT_EDITABLE", 409, "disabled object is not editable");
        }
    }

    private static String childKey(String parent, String action, UUID resourceRef) {
        return Sha256Hex.digest(IDEMPOTENCY_NAMESPACE + "|" + action + "|" + resourceRef + "|" + parent);
    }

    private static CollaborationCommandApi.Problem problem(String code, int status, String message) {
        return new CollaborationCommandApi.Problem(code, status, message);
    }
}
