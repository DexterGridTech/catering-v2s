package com.catering.v2s.app.edge.operations.organization;

import com.catering.v2s.app.edge.catalog.OrganizationEntityType;
import com.catering.v2s.app.edge.extension.ExtensionDefinitionWireMapper;
import com.catering.v2s.app.edge.generated.wire.ExtensionDefinition;
import com.catering.v2s.app.edge.operations.session.OperationsSessionResolver;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.extension.api.ExtensionHostTypes;
import com.catering.v2s.extension.application.ExtensionDefinitionService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Operations extension-definition capability adapter. */
@RestController
@RequestMapping("/api/operations/group-workspaces/{groupWorkspaceKey}/organization")
public final class OperationsOrganizationExtensionController {
    private final OperationsSessionResolver sessions;
    private final ExtensionDefinitionService definitions;

    public OperationsOrganizationExtensionController(
            OperationsSessionResolver sessions, ExtensionDefinitionService definitions) {
        this.sessions = sessions;
        this.definitions = definitions;
    }

    @GetMapping("/stores/extension-definition")
    ExtensionDefinition storeDefinition(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @org.springframework.web.bind.annotation.RequestParam long expectedContextVersion) {
        var session = requireContext(request, groupWorkspaceKey, expectedContextVersion);
        return ExtensionDefinitionWireMapper.wire(definitions.operationsManagementDefinition(
                session.workspaceUuid(), groupWorkspaceKey, OrganizationEntityType.STORE.wire()));
    }

    @GetMapping("/business-entities/extension-definition")
    ExtensionDefinition businessEntityDefinition(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @org.springframework.web.bind.annotation.RequestParam long expectedContextVersion,
            @org.springframework.web.bind.annotation.RequestParam("entityType") String hostType) {
        var session = requireContext(request, groupWorkspaceKey, expectedContextVersion);
        if (!java.util.Set.of(ExtensionHostTypes.BRAND, ExtensionHostTypes.TENANT, ExtensionHostTypes.HEAD_COMPANY)
                .contains(hostType))
            throw new com.catering.v2s.app.edge.problem.InvalidEdgeRequestException("unsupported host type");
        return ExtensionDefinitionWireMapper.wire(
                definitions.operationsManagementDefinition(session.workspaceUuid(), groupWorkspaceKey, hostType));
    }

    @GetMapping("/hierarchy/extension-definition")
    ExtensionDefinition hierarchyDefinition(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @org.springframework.web.bind.annotation.RequestParam long expectedContextVersion,
            @org.springframework.web.bind.annotation.RequestParam("entityType") String hostType) {
        var session = requireContext(request, groupWorkspaceKey, expectedContextVersion);
        if (!java.util.Set.of(
                        ExtensionHostTypes.COMMERCIAL_GROUP, ExtensionHostTypes.REGION, ExtensionHostTypes.PROJECT)
                .contains(hostType))
            throw new com.catering.v2s.app.edge.problem.InvalidEdgeRequestException("unsupported host type");
        return ExtensionDefinitionWireMapper.wire(
                definitions.operationsManagementDefinition(session.workspaceUuid(), groupWorkspaceKey, hostType));
    }

    private com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback requireContext(
            EdgeRequestContext request, String groupWorkspaceKey, long expectedContextVersion) {
        return sessions.requireWorkspaceReadAtContextVersion(request, groupWorkspaceKey, expectedContextVersion);
    }
}
