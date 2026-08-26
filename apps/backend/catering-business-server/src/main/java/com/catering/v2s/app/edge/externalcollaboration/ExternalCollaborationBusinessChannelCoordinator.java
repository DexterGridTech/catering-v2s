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
    private static final String DISABLED = "DISABLED";
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
            EdgeRequestContext request,
            String groupWorkspaceKey,
            UUID channelRef,
            BindingRequest body,
            String idempotencyKey) {
        if (sessions == null || organizationAuthorization == null || capabilityScopes == null) {
            throw new IllegalStateException("operations binding coordinator dependencies are not configured");
        }
        WorkspaceSessionReadback session = sessions.requireWorkspaceCommand(request, groupWorkspaceKey);
        BusinessChannelReadback.ChannelWithTemplateProvider channelFacts =
                businessChannelsRead.readChannelWithTemplateProvider(
                        session.workspaceUuid(), session.groupWorkspaceKey(), channelRef);
        BusinessChannelReadback.Channel channel = channelFacts.channel();
        assertChannelNode(channel, body.nodeType(), body.nodeRef());
        String providerCode = channelFacts.providerCode();
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
                Objects.requireNonNull(businessChannelGrant, "businessChannelGrant"),
                result,
                channel));
        return result;
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

    private static void requireChannelContext(
            CollaborationCommandApi.CreateOperationsBindingCommand command,
            UUID channelRef,
            BusinessChannelReadback.Channel channel) {
        if (channel == null || channelRef == null || !Objects.equals(channelRef, channel.channelRef())) {
            throw problem("CHANNEL_CONTEXT_REQUIRED", 422, "business channel context is required");
        }
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
            BusinessChannelReadback.Channel channel, String requestNodeType, UUID requestNodeRef) {
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
