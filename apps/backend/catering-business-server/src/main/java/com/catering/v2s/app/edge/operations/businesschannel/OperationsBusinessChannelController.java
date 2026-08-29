package com.catering.v2s.app.edge.operations.businesschannel;

import com.catering.v2s.app.edge.externalcollaboration.ExternalCollaborationBusinessChannelCoordinator;
import com.catering.v2s.app.edge.generated.backendperformancem1.BackendPerformanceM1CommandExecutionBindings;
import com.catering.v2s.app.edge.generated.wire.BusinessChannelCreateRequest;
import com.catering.v2s.app.edge.generated.wire.BusinessChannelPage;
import com.catering.v2s.app.edge.generated.wire.BusinessChannelStatusRequest;
import com.catering.v2s.app.edge.generated.wire.BusinessChannelTemplateCandidatePage;
import com.catering.v2s.app.edge.generated.wire.BusinessChannelTemplateCreateRequest;
import com.catering.v2s.app.edge.generated.wire.BusinessChannelTemplatePage;
import com.catering.v2s.app.edge.generated.wire.BusinessChannelTemplateStatusRequest;
import com.catering.v2s.app.edge.generated.wire.BusinessChannelTemplateUpdateRequest;
import com.catering.v2s.app.edge.generated.wire.BusinessChannelTemplateView;
import com.catering.v2s.app.edge.generated.wire.BusinessChannelUpdateRequest;
import com.catering.v2s.app.edge.generated.wire.BusinessChannelView;
import com.catering.v2s.app.edge.generated.wire.OwnerBindingCreateRequest;
import com.catering.v2s.app.edge.generated.wire.OwnerBindingUpdateRequest;
import com.catering.v2s.app.edge.generated.wire.OwnerBindingView;
import com.catering.v2s.app.edge.operations.session.OperationsSessionResolver;
import com.catering.v2s.app.edge.platform.externalcollaboration.ExternalCollaborationWireMapper;
import com.catering.v2s.app.edge.problem.InvalidEdgeRequestException;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.businesschannel.api.BusinessChannelCommandApi;
import com.catering.v2s.businesschannel.api.BusinessChannelReadApi;
import com.catering.v2s.businesschannel.api.BusinessChannelReadback;
import com.catering.v2s.collaboration.api.CollaborationBindingReadApi;
import com.catering.v2s.collaboration.api.CollaborationCommandApi;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.organization.application.OperationsOrganizationTaskReadService;
import com.catering.v2s.organization.application.OrganizationOverviewTaskReadService;
import com.catering.v2s.platform.foundation.contract.ServiceNodeTypes;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import com.catering.v2s.workspace.iam.application.WorkspaceAuthenticationService;
import com.catering.v2s.workspace.iam.application.WorkspaceCapabilityScopeResolver;
import com.catering.v2s.workspace.iam.application.WorkspaceUserService;
import java.util.Objects;
import java.util.UUID;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Operations-admin business-channel surface; writes resolve exactly the two approved capabilities by target type. */
@RestController
@RequestMapping("/api/operations")
public final class OperationsBusinessChannelController {
    private static final int DEFAULT_PAGE_SIZE = 50;
    private static final int MAX_PAGE_SIZE = 100;
    private static final String REQ_CREATE_TEMPLATE = "REQ_CREATE_OPERATIONS_BUSINESS_CHANNEL_TEMPLATE";
    private static final String REQ_UPDATE_TEMPLATE = "REQ_UPDATE_OPERATIONS_BUSINESS_CHANNEL_TEMPLATE";
    private static final String REQ_TRANSITION_TEMPLATE = "REQ_TRANSITION_OPERATIONS_BUSINESS_CHANNEL_TEMPLATE_STATUS";
    private static final String REQ_CREATE_CHANNEL = "REQ_CREATE_OPERATIONS_BUSINESS_CHANNEL";
    private static final String REQ_UPDATE_CHANNEL = "REQ_UPDATE_OPERATIONS_BUSINESS_CHANNEL";
    private static final String REQ_TRANSITION_CHANNEL = "REQ_TRANSITION_OPERATIONS_BUSINESS_CHANNEL_STATUS";
    private static final String REQ_BINDING_DELETE = "REQ_OPERATIONS_BUSINESS_CHANNEL_BINDING_DELETE";

    private final OperationsSessionResolver sessions;
    private final BusinessChannelReadApi businessChannels;
    private final BackendPerformanceM1CommandExecutionBindings commandBindings;
    private final WorkspaceCapabilityScopeResolver capabilities;
    private final CollaborationBindingReadApi collaborationBindings;
    private final OperationsOrganizationTaskReadService organizationReads;
    private final WorkspaceUserService organizationAuthorization;
    private final ExternalCollaborationBusinessChannelCoordinator coordinator;

    public OperationsBusinessChannelController(
            OperationsSessionResolver sessions,
            BusinessChannelReadApi businessChannels,
            BackendPerformanceM1CommandExecutionBindings commandBindings,
            WorkspaceCapabilityScopeResolver capabilities,
            CollaborationBindingReadApi collaborationBindings,
            OperationsOrganizationTaskReadService organizationReads,
            WorkspaceUserService organizationAuthorization,
            ExternalCollaborationBusinessChannelCoordinator coordinator) {
        this.sessions = sessions;
        this.businessChannels = businessChannels;
        this.commandBindings = commandBindings;
        this.capabilities = capabilities;
        this.collaborationBindings = collaborationBindings;
        this.organizationReads = organizationReads;
        this.organizationAuthorization = organizationAuthorization;
        this.coordinator = coordinator;
    }

    @GetMapping("/group-workspaces/{groupWorkspaceKey}/business-channel-templates")
    BusinessChannelTemplatePage templates(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @RequestParam(required = false) UUID projectRef,
            @RequestParam(required = false) String sortKey,
            @RequestParam(required = false) String sortDirection) {
        WorkspaceSessionReadback session = sessions.requireWorkspaceRead(request, groupWorkspaceKey);
        UUID scopedProjectRef = organizationAuthorization
                .resolveSelectedProjectScope(session, projectRef)
                .targetId();
        return BusinessChannelWireMapper.templatePage(businessChannels.pageTemplates(
                session.workspaceUuid(),
                session.groupWorkspaceKey(),
                scopedProjectRef,
                null,
                null,
                sortKey,
                sortDirection));
    }

    @GetMapping("/group-workspaces/{groupWorkspaceKey}/business-channel-template-candidates")
    BusinessChannelTemplateCandidatePage storeTemplateCandidates(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @RequestParam(required = false) UUID projectRef,
            @RequestParam(required = false) UUID storeRef,
            @RequestParam(required = false) String cursor,
            @RequestParam(required = false) Integer pageSize,
            @RequestParam(required = false) String sortKey,
            @RequestParam(required = false) String sortDirection) {
        WorkspaceSessionReadback session = sessions.requireWorkspaceRead(request, groupWorkspaceKey);
        requireStoreProjectPair(session, projectRef, storeRef);
        return BusinessChannelWireMapper.templateCandidatePage(businessChannels.pageStoreTemplateCandidates(
                session.workspaceUuid(),
                session.groupWorkspaceKey(),
                projectRef,
                storeRef == null ? null : storeRef.toString(),
                cursor,
                pageSize(pageSize),
                sortKey,
                sortDirection));
    }

    @GetMapping("/group-workspaces/{groupWorkspaceKey}/projects/{projectRef}/business-channels")
    BusinessChannelPage projectChannels(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID projectRef,
            @RequestParam(required = false) String sortKey,
            @RequestParam(required = false) String sortDirection) {
        return channels(request, groupWorkspaceKey, ServiceNodeTypes.PROJECT, projectRef, sortKey, sortDirection);
    }

    @GetMapping("/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/business-channels")
    BusinessChannelPage storeChannels(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID storeRef,
            @RequestParam(required = false) String sortKey,
            @RequestParam(required = false) String sortDirection) {
        return channels(request, groupWorkspaceKey, ServiceNodeTypes.STORE, storeRef, sortKey, sortDirection);
    }

    @GetMapping("/group-workspaces/{groupWorkspaceKey}/business-channels/{channelRef}")
    BusinessChannelView channel(
            EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @PathVariable UUID channelRef) {
        WorkspaceSessionReadback session = sessions.requireWorkspaceRead(request, groupWorkspaceKey);
        return BusinessChannelWireMapper.channel(requireScopedChannel(session, channelRef));
    }

    @GetMapping("/group-workspaces/{groupWorkspaceKey}/business-channels/{channelRef}/owner-binding")
    OwnerBindingView channelBinding(
            EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @PathVariable UUID channelRef) {
        WorkspaceSessionReadback session = sessions.requireWorkspaceRead(request, groupWorkspaceKey);
        BusinessChannelReadback.Channel channel = requireScopedChannel(session, channelRef);
        if (channel.bindingRef() == null) throw new InvalidEdgeRequestException("business channel has no binding");
        return ExternalCollaborationWireMapper.binding(collaborationBindings.readBinding(
                session.workspaceUuid(), session.groupWorkspaceKey(), channel.bindingRef()));
    }

    @PostMapping("/group-workspaces/{groupWorkspaceKey}/business-channel-templates")
    BusinessChannelTemplateView createTemplate(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody BusinessChannelTemplateCreateRequest body) {
        WorkspaceSessionReadback session = sessions.requireWorkspaceCommand(request, groupWorkspaceKey);
        if (body == null || body.projectRef() == null) throw new InvalidEdgeRequestException("projectRef is required");
        String key = idempotencyKey(idempotencyKey);
        String requirement = REQ_CREATE_TEMPLATE;
        return BusinessChannelWireMapper.template(commandBindings.bindCreateOperationsBusinessChannelTemplate(
                new BusinessChannelCommandApi.CreateTemplateCommand(
                        session.workspaceUuid(),
                        session.groupWorkspaceKey(),
                        body.projectRef(),
                        required(body.templateName(), "templateName"),
                        required(body.templateCode(), "templateCode"),
                        required(body.accessKind(), "accessKind"),
                        required(body.operatorKind(), "operatorKind"),
                        required(body.orderKind(), "orderKind"),
                        body.dineInForm(),
                        ExternalCollaborationWireMapper.optionalText(body.providerCode(), "providerCode"),
                        session.contextVersion(),
                        key,
                        sessions.actor(session),
                        grant(session, requirement, ServiceNodeTypes.PROJECT, body.projectRef()))));
    }

    @PatchMapping("/group-workspaces/{groupWorkspaceKey}/business-channel-templates/{templateRef}")
    BusinessChannelTemplateView updateTemplate(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID templateRef,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody BusinessChannelTemplateUpdateRequest body) {
        WorkspaceSessionReadback session = sessions.requireWorkspaceCommand(request, groupWorkspaceKey);
        if (body == null || body.expectedVersion() == null)
            throw new InvalidEdgeRequestException("expectedVersion is required");
        BusinessChannelReadback.TemplateCommandContext target = businessChannels.readTemplateCommandContext(
                session.workspaceUuid(), session.groupWorkspaceKey(), templateRef);
        return BusinessChannelWireMapper.template(commandBindings.bindUpdateOperationsBusinessChannelTemplate(
                new BusinessChannelCommandApi.UpdateTemplateCommand(
                        session.workspaceUuid(),
                        session.groupWorkspaceKey(),
                        templateRef,
                        required(body.templateName(), "templateName"),
                        body.expectedVersion(),
                        session.contextVersion(),
                        idempotencyKey(idempotencyKey),
                        sessions.actor(session),
                        grant(session, REQ_UPDATE_TEMPLATE, ServiceNodeTypes.PROJECT, target.projectRef()))));
    }

    @PostMapping("/group-workspaces/{groupWorkspaceKey}/business-channel-templates/{templateRef}/status")
    BusinessChannelTemplateView transitionTemplateStatus(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID templateRef,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody BusinessChannelTemplateStatusRequest body) {
        WorkspaceSessionReadback session = sessions.requireWorkspaceCommand(request, groupWorkspaceKey);
        if (body == null || body.expectedVersion() == null)
            throw new InvalidEdgeRequestException("expectedVersion is required");
        BusinessChannelReadback.TemplateCommandContext target = businessChannels.readTemplateCommandContext(
                session.workspaceUuid(), session.groupWorkspaceKey(), templateRef);
        return BusinessChannelWireMapper.template(commandBindings.bindTransitionOperationsBusinessChannelTemplateStatus(
                new BusinessChannelCommandApi.TransitionTemplateStatusCommand(
                        session.workspaceUuid(),
                        session.groupWorkspaceKey(),
                        templateRef,
                        required(body.status(), "status"),
                        body.expectedVersion(),
                        session.contextVersion(),
                        idempotencyKey(idempotencyKey),
                        sessions.actor(session),
                        grant(session, REQ_TRANSITION_TEMPLATE, ServiceNodeTypes.PROJECT, target.projectRef()))));
    }

    @PostMapping("/group-workspaces/{groupWorkspaceKey}/business-channels")
    BusinessChannelView createChannel(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody BusinessChannelCreateRequest body) {
        WorkspaceSessionReadback session = sessions.requireWorkspaceCommand(request, groupWorkspaceKey);
        if (body == null || body.templateRef() == null || body.ownerNodeRef() == null) {
            throw new InvalidEdgeRequestException("templateRef and ownerNodeRef are required");
        }
        String nodeType = ownerNodeType(body.ownerNodeType());
        return BusinessChannelWireMapper.channel(
                commandBindings.bindCreateOperationsBusinessChannel(new BusinessChannelCommandApi.CreateChannelCommand(
                        session.workspaceUuid(),
                        session.groupWorkspaceKey(),
                        body.templateRef(),
                        nodeType,
                        body.ownerNodeRef().toString(),
                        required(body.channelCode(), "channelCode"),
                        required(body.channelName(), "channelName"),
                        body.bindingRef(),
                        session.contextVersion(),
                        idempotencyKey(idempotencyKey),
                        sessions.actor(session),
                        grant(
                                session,
                                REQ_CREATE_CHANNEL,
                                nodeType,
                                body.ownerNodeRef(),
                                ServiceNodeTypes.STORE.equals(nodeType)))));
    }

    @PatchMapping("/group-workspaces/{groupWorkspaceKey}/business-channels/{channelRef}")
    BusinessChannelView updateChannel(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID channelRef,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody BusinessChannelUpdateRequest body) {
        WorkspaceSessionReadback session = sessions.requireWorkspaceCommand(request, groupWorkspaceKey);
        if (body == null || body.expectedVersion() == null)
            throw new InvalidEdgeRequestException("expectedVersion is required");
        BusinessChannelReadback.ChannelCommandContext target = businessChannels.readChannelCommandContext(
                session.workspaceUuid(), session.groupWorkspaceKey(), channelRef);
        return BusinessChannelWireMapper.channel(
                commandBindings.bindUpdateOperationsBusinessChannel(new BusinessChannelCommandApi.UpdateChannelCommand(
                        session.workspaceUuid(),
                        session.groupWorkspaceKey(),
                        channelRef,
                        required(body.channelName(), "channelName"),
                        body.bindingRef(),
                        body.expectedVersion(),
                        session.contextVersion(),
                        idempotencyKey(idempotencyKey),
                        sessions.actor(session),
                        grant(
                                session,
                                REQ_UPDATE_CHANNEL,
                                ownerNodeType(target.ownerNodeType()),
                                ownerNodeId(target.ownerNodeRef())))));
    }

    @PostMapping("/group-workspaces/{groupWorkspaceKey}/business-channels/{channelRef}")
    BusinessChannelView transitionChannelStatus(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID channelRef,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody BusinessChannelStatusRequest body) {
        WorkspaceSessionReadback session = sessions.requireWorkspaceCommand(request, groupWorkspaceKey);
        if (body == null || body.expectedVersion() == null)
            throw new InvalidEdgeRequestException("expectedVersion is required");
        BusinessChannelReadback.ChannelCommandContext target = businessChannels.readChannelCommandContext(
                session.workspaceUuid(), session.groupWorkspaceKey(), channelRef);
        return BusinessChannelWireMapper.channel(commandBindings.bindTransitionOperationsBusinessChannelStatus(
                new BusinessChannelCommandApi.TransitionChannelStatusCommand(
                        session.workspaceUuid(),
                        session.groupWorkspaceKey(),
                        channelRef,
                        required(body.status(), "status"),
                        body.expectedVersion(),
                        session.contextVersion(),
                        idempotencyKey(idempotencyKey),
                        sessions.actor(session),
                        grant(
                                session,
                                REQ_TRANSITION_CHANNEL,
                                ownerNodeType(target.ownerNodeType()),
                                ownerNodeId(target.ownerNodeRef())))));
    }

    @PostMapping("/group-workspaces/{groupWorkspaceKey}/business-channels/{channelRef}/owner-binding")
    OwnerBindingView createBinding(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID channelRef,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody OwnerBindingCreateRequest body) {
        if (body == null || body.nodeRef() == null) throw new InvalidEdgeRequestException("nodeRef is required");
        String key = idempotencyKey(idempotencyKey);
        return ExternalCollaborationWireMapper.binding(coordinator.createOperationsBinding(
                request,
                groupWorkspaceKey,
                channelRef,
                new ExternalCollaborationBusinessChannelCoordinator.BindingRequest(
                        body.providerCode(),
                        ExternalCollaborationWireMapper.optionalText(body.capabilityClass(), "capabilityClass"),
                        body.nodeType(),
                        body.nodeRef(),
                        ExternalCollaborationWireMapper.optionalText(body.bindingDisplayName(), "bindingDisplayName"),
                        ExternalCollaborationWireMapper.optionalText(body.externalOwnerId(), "externalOwnerId")),
                key));
    }

    @DeleteMapping("/group-workspaces/{groupWorkspaceKey}/business-channels/{channelRef}/owner-binding")
    OwnerBindingView deleteBinding(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID channelRef,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody OwnerBindingUpdateRequest body) {
        WorkspaceSessionReadback session = sessions.requireWorkspaceCommand(request, groupWorkspaceKey);
        if (body == null || body.expectedVersion() == null)
            throw new InvalidEdgeRequestException("expectedVersion is required");
        BusinessChannelReadback.ChannelCommandContext channel = businessChannels.readChannelCommandContext(
                session.workspaceUuid(), session.groupWorkspaceKey(), channelRef);
        UUID bindingRef = requireBindingRef(channel);
        String nodeType = ownerNodeType(channel.ownerNodeType());
        return ExternalCollaborationWireMapper.binding(coordinator.deleteOperationsBinding(
                new CollaborationCommandApi.DeleteOperationsBindingCommand(
                        session.workspaceUuid(),
                        session.groupWorkspaceKey(),
                        bindingRef,
                        body.expectedVersion(),
                        session.contextVersion(),
                        idempotencyKey(idempotencyKey),
                        sessions.actor(session),
                        grant(session, REQ_BINDING_DELETE, nodeType, ownerNodeId(channel.ownerNodeRef()))),
                channel));
    }

    private BusinessChannelPage channels(
            EdgeRequestContext request,
            String groupWorkspaceKey,
            String ownerNodeType,
            UUID ownerNodeRef,
            String sortKey,
            String sortDirection) {
        WorkspaceSessionReadback session = sessions.requireWorkspaceRead(request, groupWorkspaceKey);
        String scopedOwnerNodeRef;
        if (ServiceNodeTypes.PROJECT.equals(ownerNodeType)) {
            scopedOwnerNodeRef = organizationAuthorization
                    .resolveSelectedProjectScope(session, ownerNodeRef)
                    .targetId()
                    .toString();
        } else {
            requireScopedStore(session, groupWorkspaceKey, ownerNodeRef);
            scopedOwnerNodeRef = ownerNodeRef.toString();
        }
        return BusinessChannelWireMapper.channelPage(businessChannels.pageChannels(
                session.workspaceUuid(),
                session.groupWorkspaceKey(),
                ownerNodeType,
                scopedOwnerNodeRef,
                null,
                sortKey,
                sortDirection));
    }

    private BusinessChannelReadback.Channel requireScopedChannel(
            WorkspaceSessionReadback session, UUID requestedChannelRef) {
        BusinessChannelReadback.Channel channel = readChannel(session, requestedChannelRef);
        if (!requestedChannelRef.equals(channel.channelRef())) {
            throw new InvalidEdgeRequestException("business channel reference does not match readback");
        }
        String nodeType = ownerNodeType(channel.ownerNodeType());
        UUID nodeRef = ownerNodeId(channel.ownerNodeRef());
        if (ServiceNodeTypes.PROJECT.equals(nodeType)) {
            organizationAuthorization.resolveSelectedProjectScope(session, nodeRef);
        } else {
            requireScopedStore(session, session.groupWorkspaceKey(), nodeRef);
        }
        return channel;
    }

    private OrganizationOverviewTaskReadService.Item requireScopedStore(
            WorkspaceSessionReadback session, String groupWorkspaceKey, UUID storeRef) {
        var store = organizationReads.store(session.workspaceUuid(), groupWorkspaceKey, storeRef);
        if (store.project() == null || store.project().id() == null) {
            throw new InvalidEdgeRequestException("store has no project owner");
        }
        if (session.scopeContext() != null && session.scopeContext().store() != null) {
            if (!storeRef.equals(requireStore(session))) {
                throw new WorkspaceUserService.TaskScopeDeniedException();
            }
        } else {
            organizationAuthorization.resolveSelectedProjectScope(
                    session, store.project().id());
        }
        return store;
    }

    private void requireStoreProjectPair(WorkspaceSessionReadback session, UUID projectRef, UUID storeRef) {
        if (projectRef == null) throw new InvalidEdgeRequestException("projectRef is required");
        if (storeRef == null) throw new InvalidEdgeRequestException("storeRef is required");
        var store = requireScopedStore(session, session.groupWorkspaceKey(), storeRef);
        if (!projectRef.equals(store.project().id())) {
            throw new InvalidEdgeRequestException("storeRef does not belong to projectRef");
        }
    }

    private BusinessChannelReadback.Channel readChannel(WorkspaceSessionReadback session, UUID channelRef) {
        return businessChannels.readChannel(session.workspaceUuid(), session.groupWorkspaceKey(), channelRef);
    }

    private OperationsOwnerScopeGrant grant(
            WorkspaceSessionReadback session, String requirementId, String nodeType, UUID nodeRef) {
        return grant(session, requirementId, nodeType, nodeRef, false);
    }

    private OperationsOwnerScopeGrant grant(
            WorkspaceSessionReadback session,
            String requirementId,
            String nodeType,
            UUID nodeRef,
            boolean allowDisabledStoreTarget) {
        if (nodeRef == null) throw new InvalidEdgeRequestException("ownerNodeRef is required");
        WorkspaceCapabilityScopeResolver.ServerResolvedResource target =
                new WorkspaceCapabilityScopeResolver.ServerResolvedResource(nodeType, nodeRef);
        WorkspaceCapabilityScopeResolver.ScopeResolution resolution = allowDisabledStoreTarget
                ? capabilities.resolveIncludingDisabledStoreTarget(session, requirementId, target)
                : capabilities.resolve(session, requirementId, target);
        return resolution.ownerScopeGrant(requirementId);
    }

    private static void assertChannelNode(
            BusinessChannelReadback.Channel channel, String requestNodeType, UUID requestNodeRef) {
        if (!Objects.equals(ownerNodeType(channel.ownerNodeType()), ownerNodeType(requestNodeType))
                || !Objects.equals(channel.ownerNodeRef(), requestNodeRef.toString())) {
            throw new InvalidEdgeRequestException("binding node does not match business channel context");
        }
    }

    private static UUID requireBindingRef(BusinessChannelReadback.ChannelCommandContext channel) {
        if (channel.bindingRef() == null) throw new InvalidEdgeRequestException("business channel has no binding");
        return channel.bindingRef();
    }

    private static UUID requireStore(WorkspaceSessionReadback value) {
        if (value.scopeContext() == null || value.scopeContext().store() == null)
            throw new WorkspaceAuthenticationService.SessionInvalidException();
        return value.scopeContext().store().dataNodeId();
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

    private static String idempotencyKey(String value) {
        if (value == null || value.isBlank() || value.length() < 16 || value.length() > 128) {
            throw new InvalidEdgeRequestException("invalid idempotency key");
        }
        return value;
    }

    private static int pageSize(Integer value) {
        int normalized = value == null ? DEFAULT_PAGE_SIZE : value;
        if (normalized < 1 || normalized > MAX_PAGE_SIZE) {
            throw new InvalidEdgeRequestException("pageSize must be between 1 and 100");
        }
        return normalized;
    }
}
