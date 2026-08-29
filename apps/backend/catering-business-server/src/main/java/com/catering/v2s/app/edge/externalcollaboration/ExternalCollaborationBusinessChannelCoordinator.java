package com.catering.v2s.app.edge.externalcollaboration;

import com.catering.v2s.app.edge.operations.session.OperationsSessionResolver;
import com.catering.v2s.app.edge.problem.InvalidEdgeRequestException;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.businesschannel.api.BusinessChannelCommandApi;
import com.catering.v2s.businesschannel.api.BusinessChannelReadApi;
import com.catering.v2s.businesschannel.api.BusinessChannelReadback;
import com.catering.v2s.collaboration.api.CollaborationCatalogReadApi;
import com.catering.v2s.collaboration.api.CollaborationCommandApi;
import com.catering.v2s.collaboration.api.CollaborationReadback;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.organization.api.OrganizationTaskPathLookup;
import com.catering.v2s.platform.foundation.contract.ServiceNodeTypes;
import com.catering.v2s.platform.foundation.security.Sha256Hex;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import com.catering.v2s.workspace.iam.application.WorkspaceCapabilityScopeResolver;
import com.catering.v2s.workspace.iam.application.WorkspaceCommandAuthorizationService;
import com.catering.v2s.workspace.iam.application.WorkspaceUserService;
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
    private static final String IDEMPOTENCY_NAMESPACE = "external-collaboration-business-channel";
    private static final String REQ_BINDING_CREATE = "REQ_OPERATIONS_BUSINESS_CHANNEL_BINDING_CREATE";
    private static final String REQ_UPDATE_CHANNEL = "REQ_UPDATE_OPERATIONS_BUSINESS_CHANNEL";

    private final CollaborationCommandApi collaboration;
    private final CollaborationCatalogReadApi catalog;
    private final BusinessChannelReadApi businessChannelsRead;
    private final BusinessChannelCommandApi businessChannels;
    private final OperationsSessionResolver sessions;
    private final WorkspaceUserService organizationAuthorization;
    private final WorkspaceCapabilityScopeResolver capabilityScopes;

    /** Test-only compatibility constructor for coordinator paths that do not build a new operations binding. */
    public ExternalCollaborationBusinessChannelCoordinator(
            CollaborationCommandApi collaboration,
            CollaborationCatalogReadApi catalog,
            BusinessChannelReadApi businessChannelsRead,
            BusinessChannelCommandApi businessChannels) {
        this(collaboration, catalog, businessChannelsRead, businessChannels, null, null, null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public ExternalCollaborationBusinessChannelCoordinator(
            CollaborationCommandApi collaboration,
            CollaborationCatalogReadApi catalog,
            BusinessChannelReadApi businessChannelsRead,
            BusinessChannelCommandApi businessChannels,
            OperationsSessionResolver sessions,
            WorkspaceUserService organizationAuthorization,
            WorkspaceCapabilityScopeResolver capabilityScopes) {
        this.collaboration = collaboration;
        this.catalog = catalog;
        this.businessChannelsRead = businessChannelsRead;
        this.businessChannels = businessChannels;
        this.sessions = sessions;
        this.organizationAuthorization = organizationAuthorization;
        this.capabilityScopes = capabilityScopes;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public CollaborationReadback.OwnerBinding deletePlatformBinding(
            CollaborationCommandApi.DeletePlatformBindingCommand command) {
        List<BusinessChannelReadback.Channel> attached = businessChannelsRead.findChannelsForBinding(
                command.workspaceUuid(), command.groupWorkspaceKey(), command.bindingRef());
        CollaborationReadback.OwnerBinding result = collaboration.requestOrDeletePlatformBinding(command);
        for (BusinessChannelReadback.Channel channel : attached) {
            businessChannels.detachChannelBinding(new BusinessChannelCommandApi.DetachChannelBindingCommand(
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
        return deleteOperationsBinding(command, commandContext(channel));
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public CollaborationReadback.OwnerBinding deleteOperationsBinding(
            CollaborationCommandApi.DeleteOperationsBindingCommand command,
            BusinessChannelReadback.ChannelCommandContext channel) {
        requireChannelContext(channel);
        requireBinding(channel.bindingRef(), command.bindingRef());
        CollaborationReadback.OwnerBinding result = collaboration.requestOrDeleteOperationsBinding(command);
        businessChannels.detachChannelBinding(new BusinessChannelCommandApi.DetachChannelBindingCommand(
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                channel.channelRef(),
                channel.version(),
                childKey(command.idempotencyKey(), "binding-delete", channel.channelRef()),
                command.actor(),
                command.bindingRef()));
        return result;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public CollaborationReadback.OwnerBinding createOperationsBinding(
            EdgeRequestContext request,
            String groupWorkspaceKey,
            UUID channelRef,
            BindingRequest body,
            String idempotencyKey) {
        if (sessions == null || organizationAuthorization == null || capabilityScopes == null) {
            throw new IllegalStateException("operations binding coordinator dependencies are not configured");
        }
        WorkspaceSessionReadback session = sessions.requireWorkspaceCommand(request, groupWorkspaceKey);
        BusinessChannelReadback.ChannelCommandContext channel = businessChannelsRead.readChannelCommandContext(
                session.workspaceUuid(), session.groupWorkspaceKey(), channelRef);
        assertChannelNode(channel, body.nodeType(), body.nodeRef());
        String providerCode = channel.templateProviderCode();
        if (!Objects.equals(providerCode, required(body.providerCode(), "providerCode"))) {
            throw new InvalidEdgeRequestException("providerCode does not match channel template");
        }
        String nodeType = ownerNodeType(channel.ownerNodeType());
        UUID nodeRef = ownerNodeId(channel.ownerNodeRef());
        OrganizationTaskPathLookup.TaskPath ownerTaskPath = ServiceNodeTypes.STORE.equals(nodeType)
                ? organizationAuthorization.resolveCommandTargetAllowingDisabledStore(session, nodeType, nodeRef)
                : organizationAuthorization.resolveCommandTarget(session, nodeType, nodeRef);
        AuditActor actor = sessions.actor(session);
        CollaborationCommandApi.CreateOperationsBindingCommand command =
                new CollaborationCommandApi.CreateOperationsBindingCommand(
                        session.workspaceUuid(),
                        session.groupWorkspaceKey(),
                        providerCode,
                        optionalText(body.capabilityClass(), "capabilityClass"),
                        nodeType,
                        channel.ownerNodeRef(),
                        optionalText(body.bindingDisplayName(), "bindingDisplayName"),
                        optionalText(body.externalOwnerId(), "externalOwnerId"),
                        session.contextVersion(),
                        idempotencyKey,
                        actor,
                        grant(session, REQ_BINDING_CREATE, nodeType, nodeRef, ownerTaskPath));
        return createOperationsBinding(
                command, channelRef, channel, grant(session, REQ_UPDATE_CHANNEL, nodeType, nodeRef, ownerTaskPath));
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public CollaborationReadback.OwnerBinding createOperationsBinding(
            CollaborationCommandApi.CreateOperationsBindingCommand command,
            UUID channelRef,
            BusinessChannelReadback.Channel channel,
            OperationsOwnerScopeGrant businessChannelGrant) {
        requireChannelContext(command, channelRef, channel);
        return createOperationsBindingInternal(
                command,
                channelRef,
                channel.channelName(),
                channel.bindingRef(),
                channel.version(),
                businessChannelGrant);
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public CollaborationReadback.OwnerBinding createOperationsBinding(
            CollaborationCommandApi.CreateOperationsBindingCommand command,
            UUID channelRef,
            BusinessChannelReadback.ChannelCommandContext channel,
            OperationsOwnerScopeGrant businessChannelGrant) {
        requireChannelContext(channelRef, channel);
        return createOperationsBindingInternal(
                command,
                channelRef,
                channel.channelName(),
                channel.bindingRef(),
                channel.version(),
                businessChannelGrant);
    }

    private CollaborationReadback.OwnerBinding createOperationsBindingInternal(
            CollaborationCommandApi.CreateOperationsBindingCommand command,
            UUID channelRef,
            String channelName,
            UUID bindingRef,
            long channelVersion,
            OperationsOwnerScopeGrant businessChannelGrant) {
        if (bindingRef != null) {
            throw problem("CHANNEL_BINDING_ALREADY_ATTACHED", 409, "business channel already has a binding");
        }
        CollaborationReadback.OwnerBinding result = collaboration.createOperationsBinding(command);
        businessChannels.updateChannel(new BusinessChannelCommandApi.UpdateChannelCommand(
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                channelRef,
                channelName,
                result.bindingRef(),
                channelVersion,
                command.contextVersion(),
                childKey(command.idempotencyKey(), "binding-attach", channelRef),
                command.actor(),
                Objects.requireNonNull(businessChannelGrant, "businessChannelGrant"),
                result));
        return result;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public CollaborationReadback.ExternalSystem transitionExternalSystemStatus(
            CollaborationCommandApi.TransitionExternalSystemStatusCommand command) {
        return collaboration.transitionExternalSystemStatus(command);
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public CollaborationReadback.ProviderProfile transitionProviderProfileStatus(
            CollaborationCommandApi.TransitionProviderProfileStatusCommand command) {
        return collaboration.transitionProviderProfileStatus(command);
    }

    private BusinessChannelReadback.Channel requireChannel(
            UUID workspaceUuid, String groupWorkspaceKey, UUID channelRef) {
        if (channelRef == null) throw problem("CHANNEL_CONTEXT_REQUIRED", 422, "channelRef is required");
        BusinessChannelReadback.Channel channel =
                businessChannelsRead.readChannel(workspaceUuid, groupWorkspaceKey, channelRef);
        if (channel == null) throw problem("CHANNEL_NOT_FOUND", 404, "business channel was not found");
        return channel;
    }

    private static void requireChannelContext(
            CollaborationCommandApi.CreateOperationsBindingCommand command,
            UUID channelRef,
            BusinessChannelReadback.Channel channel) {
        if (channel == null || channelRef == null || !Objects.equals(channelRef, channel.channelRef())) {
            throw problem("CHANNEL_CONTEXT_REQUIRED", 422, "business channel context is required");
        }
    }

    private static void requireChannelContext(UUID channelRef, BusinessChannelReadback.ChannelCommandContext channel) {
        if (channel == null || channelRef == null || !Objects.equals(channelRef, channel.channelRef())) {
            throw problem("CHANNEL_CONTEXT_REQUIRED", 422, "business channel context is required");
        }
    }

    private static void requireChannelContext(BusinessChannelReadback.ChannelCommandContext channel) {
        if (channel == null || channel.channelRef() == null) {
            throw problem("CHANNEL_CONTEXT_REQUIRED", 422, "business channel context is required");
        }
    }

    private static BusinessChannelReadback.ChannelCommandContext commandContext(
            BusinessChannelReadback.Channel channel) {
        return new BusinessChannelReadback.ChannelCommandContext(
                channel.channelRef(),
                channel.templateRef(),
                channel.ownerNodeType(),
                channel.ownerNodeRef(),
                channel.channelName(),
                channel.bindingRef(),
                channel.version(),
                null,
                null,
                null);
    }

    private OperationsOwnerScopeGrant grant(
            WorkspaceSessionReadback session,
            String requirementId,
            String nodeType,
            UUID nodeRef,
            OrganizationTaskPathLookup.TaskPath resolvedTaskPath) {
        var resolution = capabilityScopes.resolveUsingResolvedTaskPath(
                session,
                requirementId,
                new WorkspaceCapabilityScopeResolver.ServerResolvedResource(nodeType, nodeRef),
                resolvedTaskPath);
        if (resolution.decision() != WorkspaceCapabilityScopeResolver.Decision.ALLOW) {
            throw new WorkspaceCommandAuthorizationService.AuthorizationDeniedException();
        }
        return resolution.ownerScopeGrant(requirementId);
    }

    private static void assertChannelNode(
            BusinessChannelReadback.ChannelCommandContext channel, String requestNodeType, UUID requestNodeRef) {
        if (channel == null
                || !Objects.equals(ownerNodeType(channel.ownerNodeType()), ownerNodeType(requestNodeType))
                || !Objects.equals(channel.ownerNodeRef(), requestNodeRef.toString())) {
            throw new InvalidEdgeRequestException("binding node does not match business channel context");
        }
    }

    private static String ownerNodeType(String value) {
        if (!ServiceNodeTypes.PROJECT.equals(value) && !ServiceNodeTypes.STORE.equals(value)) {
            throw new InvalidEdgeRequestException("business channel owner node type is unsupported");
        }
        return value;
    }

    private static UUID ownerNodeId(String value) {
        try {
            return UUID.fromString(value);
        } catch (RuntimeException failure) {
            throw new InvalidEdgeRequestException("business channel owner node reference is invalid", failure);
        }
    }

    private static String required(String value, String field) {
        if (value == null || value.isBlank()) throw new InvalidEdgeRequestException(field + " is required");
        return value;
    }

    private static String optionalText(String value, String field) {
        if (value == null) return null;
        if (value.isBlank()) throw new InvalidEdgeRequestException(field + " must not be blank");
        return value;
    }

    private static void requireBinding(BusinessChannelReadback.Channel channel, UUID bindingRef) {
        requireBinding(channel.bindingRef(), bindingRef);
    }

    private static void requireBinding(UUID attachedBindingRef, UUID bindingRef) {
        if (!Objects.equals(attachedBindingRef, bindingRef)) {
            throw problem("BINDING_CONTEXT_MISMATCH", 409, "binding is not attached to the selected business channel");
        }
    }

    private static String childKey(String parent, String action, UUID resourceRef) {
        return Sha256Hex.digest(IDEMPOTENCY_NAMESPACE + "|" + action + "|" + resourceRef + "|" + parent);
    }

    private static CollaborationCommandApi.Problem problem(String code, int status, String message) {
        return new CollaborationCommandApi.Problem(code, status, message);
    }

    public record BindingRequest(
            String providerCode,
            String capabilityClass,
            String nodeType,
            UUID nodeRef,
            String bindingDisplayName,
            String externalOwnerId) {
        public BindingRequest {
            if (nodeRef == null) throw new InvalidEdgeRequestException("nodeRef is required");
        }
    }
}
