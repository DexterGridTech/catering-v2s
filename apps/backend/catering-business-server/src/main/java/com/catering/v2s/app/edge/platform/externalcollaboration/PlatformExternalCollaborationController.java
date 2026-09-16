package com.catering.v2s.app.edge.platform.externalcollaboration;

import com.catering.v2s.app.edge.externalcollaboration.ExternalCollaborationBusinessChannelCoordinator;
import com.catering.v2s.app.edge.generated.wire.CapabilityDictionary;
import com.catering.v2s.app.edge.generated.wire.ExternalCollaborationTree;
import com.catering.v2s.app.edge.generated.wire.ExternalSystemStatusRequest;
import com.catering.v2s.app.edge.generated.wire.ExternalSystemView;
import com.catering.v2s.app.edge.generated.wire.OwnerBindingCreateRequest;
import com.catering.v2s.app.edge.generated.wire.OwnerBindingDeleteRequest;
import com.catering.v2s.app.edge.generated.wire.OwnerBindingPage;
import com.catering.v2s.app.edge.generated.wire.OwnerBindingUpdateRequest;
import com.catering.v2s.app.edge.generated.wire.OwnerBindingView;
import com.catering.v2s.app.edge.generated.wire.ProviderProfileView;
import com.catering.v2s.app.edge.platform.session.PlatformSessionResolver;
import com.catering.v2s.app.edge.problem.InvalidEdgeRequestException;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.collaboration.api.CollaborationBindingReadApi;
import com.catering.v2s.collaboration.api.CollaborationCatalogReadApi;
import com.catering.v2s.collaboration.api.CollaborationCatalogSource;
import com.catering.v2s.collaboration.api.CollaborationCommandApi;
import com.catering.v2s.collaboration.api.CollaborationReadback;
import com.catering.v2s.platform.workspace.application.WorkspaceAdministrationService;
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

/** Platform-admin collaboration surface; platform commands carry no operations capability. */
@RestController
@RequestMapping("/api/platform")
public final class PlatformExternalCollaborationController {
    private final PlatformSessionResolver sessions;
    private final WorkspaceAdministrationService workspaces;
    private final CollaborationCatalogReadApi catalog;
    private final CollaborationCatalogSource catalogSource;
    private final CollaborationBindingReadApi bindings;
    private final CollaborationCommandApi commands;
    private final ExternalCollaborationBusinessChannelCoordinator coordinator;

    public PlatformExternalCollaborationController(
            PlatformSessionResolver sessions,
            WorkspaceAdministrationService workspaces,
            CollaborationCatalogReadApi catalog,
            CollaborationCatalogSource catalogSource,
            CollaborationBindingReadApi bindings,
            CollaborationCommandApi commands,
            ExternalCollaborationBusinessChannelCoordinator coordinator) {
        this.sessions = sessions;
        this.workspaces = workspaces;
        this.catalog = catalog;
        this.catalogSource = catalogSource;
        this.bindings = bindings;
        this.commands = commands;
        this.coordinator = coordinator;
    }

    @GetMapping("/group-workspaces/{groupWorkspaceKey}/external-collaboration")
    ExternalCollaborationTree tree(EdgeRequestContext request, @PathVariable String groupWorkspaceKey) {
        var workspace = workspace(request, groupWorkspaceKey);
        return ExternalCollaborationWireMapper.tree(
                catalog.readTree(workspace.workspaceUuid(), workspace.groupWorkspaceKey()));
    }

    @GetMapping("/group-workspaces/{groupWorkspaceKey}/external-systems/{externalSystemCode}")
    ExternalSystemView externalSystem(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable String externalSystemCode) {
        var workspace = workspace(request, groupWorkspaceKey);
        return ExternalCollaborationWireMapper.externalSystem(catalog.readExternalSystem(
                workspace.workspaceUuid(), workspace.groupWorkspaceKey(), externalSystemCode));
    }

    @GetMapping("/group-workspaces/{groupWorkspaceKey}/provider-profiles/{providerCode}")
    ProviderProfileView providerProfile(
            EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @PathVariable String providerCode) {
        var workspace = workspace(request, groupWorkspaceKey);
        return ExternalCollaborationWireMapper.providerProfile(
                catalog.readProviderProfile(workspace.workspaceUuid(), workspace.groupWorkspaceKey(), providerCode));
    }

    @GetMapping("/group-workspaces/{groupWorkspaceKey}/provider-profiles/{providerCode}/owner-bindings")
    OwnerBindingPage providerBindings(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable String providerCode,
            @RequestParam(required = false) String bindingName,
            @RequestParam(required = false) String nodeQueryText,
            @RequestParam(required = false) String sortKey,
            @RequestParam(required = false) String sortDirection,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageSize) {
        var workspace = workspace(request, groupWorkspaceKey);
        return bindingPage(
                workspace,
                bindings.pageBindings(
                        workspace.workspaceUuid(),
                        workspace.groupWorkspaceKey(),
                        providerCode,
                        bindingName,
                        nodeQueryText,
                        sortKey,
                        sortDirection,
                        bindingPageNumber(page),
                        bindingPageSize(pageSize)));
    }

    @GetMapping("/group-workspaces/{groupWorkspaceKey}/owner-bindings/{bindingRef}")
    OwnerBindingView binding(
            EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @PathVariable UUID bindingRef) {
        var workspace = workspace(request, groupWorkspaceKey);
        return binding(
                workspace, bindings.readBinding(workspace.workspaceUuid(), workspace.groupWorkspaceKey(), bindingRef));
    }

    @GetMapping("/external-capability-dictionary")
    CapabilityDictionary capabilityDictionary(EdgeRequestContext request) {
        sessions.requireRead(request);
        return ExternalCollaborationWireMapper.dictionary(catalogSource);
    }

    @PostMapping("/group-workspaces/{groupWorkspaceKey}/owner-bindings")
    OwnerBindingView createBinding(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody OwnerBindingCreateRequest body) {
        var session = sessions.require(request);
        var workspace = workspaces.requireEnabled(groupWorkspaceKey);
        String key = requireIdempotencyKey(idempotencyKey);
        if (body == null) throw new InvalidEdgeRequestException("binding request is required");
        return binding(
                workspace.workspaceUuid(),
                workspace.groupWorkspaceKey(),
                commands.createPlatformBinding(new CollaborationCommandApi.CreatePlatformBindingCommand(
                        workspace.workspaceUuid(),
                        workspace.groupWorkspaceKey(),
                        ExternalCollaborationWireMapper.requiredText(body.providerCode(), "providerCode"),
                        ExternalCollaborationWireMapper.optionalText(body.capabilityClass(), "capabilityClass"),
                        ExternalCollaborationWireMapper.requiredText(body.nodeType(), "nodeType"),
                        requiredNodeRef(body.nodeRef()),
                        ExternalCollaborationWireMapper.optionalText(body.bindingDisplayName(), "bindingDisplayName"),
                        ExternalCollaborationWireMapper.optionalText(body.externalOwnerId(), "externalOwnerId"),
                        key,
                        sessions.actor(session))));
    }

    @PatchMapping("/group-workspaces/{groupWorkspaceKey}/owner-bindings/{bindingRef}")
    OwnerBindingView updateBinding(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID bindingRef,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody OwnerBindingUpdateRequest body) {
        var session = sessions.require(request);
        var workspace = workspaces.requireEnabled(groupWorkspaceKey);
        String key = requireIdempotencyKey(idempotencyKey);
        if (body == null || body.expectedVersion() == null) {
            throw new InvalidEdgeRequestException("expected version is required");
        }
        return binding(
                workspace.workspaceUuid(),
                workspace.groupWorkspaceKey(),
                commands.updatePlatformBinding(new CollaborationCommandApi.UpdatePlatformBindingCommand(
                        workspace.workspaceUuid(),
                        workspace.groupWorkspaceKey(),
                        bindingRef,
                        ExternalCollaborationWireMapper.optionalText(body.bindingDisplayName(), "bindingDisplayName"),
                        ExternalCollaborationWireMapper.optionalText(body.externalOwnerId(), "externalOwnerId"),
                        body.expectedVersion(),
                        key,
                        sessions.actor(session))));
    }

    @PostMapping("/group-workspaces/{groupWorkspaceKey}/external-systems/{externalSystemCode}/status")
    ExternalSystemView transitionExternalSystemStatus(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable String externalSystemCode,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody ExternalSystemStatusRequest body) {
        var session = sessions.require(request);
        var workspace = workspaces.requireEnabled(groupWorkspaceKey);
        if (body == null || body.expectedVersion() == null || body.status() == null) {
            throw new InvalidEdgeRequestException("status and expectedVersion are required");
        }
        CollaborationReadback.ExternalSystem result = coordinator.transitionExternalSystemStatus(
                new CollaborationCommandApi.TransitionExternalSystemStatusCommand(
                        workspace.workspaceUuid(),
                        workspace.groupWorkspaceKey(),
                        externalSystemCode,
                        body.status(),
                        body.expectedVersion(),
                        requireIdempotencyKey(idempotencyKey),
                        sessions.actor(session)));
        return ExternalCollaborationWireMapper.externalSystem(result);
    }

    @PostMapping("/group-workspaces/{groupWorkspaceKey}/provider-profiles/{providerCode}/status")
    ProviderProfileView transitionProviderProfileStatus(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable String providerCode,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody ExternalSystemStatusRequest body) {
        var session = sessions.require(request);
        var workspace = workspaces.requireEnabled(groupWorkspaceKey);
        if (body == null || body.expectedVersion() == null || body.status() == null) {
            throw new InvalidEdgeRequestException("status and expectedVersion are required");
        }
        CollaborationReadback.ProviderProfile result = coordinator.transitionProviderProfileStatus(
                new CollaborationCommandApi.TransitionProviderProfileStatusCommand(
                        workspace.workspaceUuid(),
                        workspace.groupWorkspaceKey(),
                        providerCode,
                        body.status(),
                        body.expectedVersion(),
                        requireIdempotencyKey(idempotencyKey),
                        sessions.actor(session)));
        return ExternalCollaborationWireMapper.providerProfile(result);
    }

    @DeleteMapping("/group-workspaces/{groupWorkspaceKey}/owner-bindings/{bindingRef}")
    OwnerBindingView deleteBinding(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID bindingRef,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody OwnerBindingDeleteRequest body) {
        var session = sessions.require(request);
        var workspace = workspaces.requireEnabled(groupWorkspaceKey);
        if (body == null || body.expectedVersion() == null) {
            throw new InvalidEdgeRequestException("expectedVersion is required");
        }
        return binding(
                workspace.workspaceUuid(),
                workspace.groupWorkspaceKey(),
                coordinator.deletePlatformBinding(new CollaborationCommandApi.DeletePlatformBindingCommand(
                        workspace.workspaceUuid(),
                        workspace.groupWorkspaceKey(),
                        bindingRef,
                        body.expectedVersion(),
                        requireIdempotencyKey(idempotencyKey),
                        sessions.actor(session))));
    }

    private PlatformSessionResolver.EnabledSelectedWorkspaceFact workspace(
            EdgeRequestContext request, String groupWorkspaceKey) {
        return sessions.requireRead(request).requireEnabledSelectedWorkspace(workspaces, groupWorkspaceKey);
    }

    private OwnerBindingPage bindingPage(
            PlatformSessionResolver.EnabledSelectedWorkspaceFact workspace,
            CollaborationReadback.OwnerBindingPage page) {
        return new OwnerBindingPage(
                new com.catering.v2s.app.edge.generated.wire.OwnerBindingPageMetadata(
                        ExternalCollaborationWireMapper.text(page.metadata().bindingName()),
                        ExternalCollaborationWireMapper.text(page.metadata().nodeQueryText()),
                        page.metadata().sortKey(),
                        page.metadata().sortDirection(),
                        (long) page.metadata().page(),
                        (long) page.metadata().pageSize(),
                        page.metadata().total()),
                page.items().stream()
                        .map(ExternalCollaborationWireMapper::binding)
                        .toList());
    }

    private OwnerBindingView binding(
            PlatformSessionResolver.EnabledSelectedWorkspaceFact workspace, CollaborationReadback.OwnerBinding value) {
        return binding(workspace.workspaceUuid(), workspace.groupWorkspaceKey(), value);
    }

    private OwnerBindingView binding(
            UUID workspaceUuid, String groupWorkspaceKey, CollaborationReadback.OwnerBinding value) {
        return ExternalCollaborationWireMapper.binding(value);
    }

    private static String requireIdempotencyKey(String value) {
        if (value == null || value.isBlank() || value.length() < 16 || value.length() > 128) {
            throw new InvalidEdgeRequestException("invalid idempotency key");
        }
        return value;
    }

    private static String requiredNodeRef(UUID value) {
        if (value == null) throw new InvalidEdgeRequestException("nodeRef is required");
        return value.toString();
    }

    private static int bindingPageSize(Integer value) {
        if (value == null) return 0;
        if (value < 1 || value > 100) {
            throw new InvalidEdgeRequestException("pageSize must be between 1 and 100");
        }
        return value;
    }

    private static int bindingPageNumber(Integer value) {
        if (value == null) return 0;
        if (value < 1) throw new InvalidEdgeRequestException("page must be at least 1");
        return value;
    }
}
