package com.catering.v2s.app.edge.platform.extension;

import com.catering.v2s.app.edge.extension.ExtensionDefinitionWireMapper;
import com.catering.v2s.app.edge.generated.wire.ExtensionDefinition;
import com.catering.v2s.app.edge.generated.wire.ExtensionDefinitionUpdateRequest;
import com.catering.v2s.app.edge.generated.wire.ExtensionDefinitionUpdateRequestDefinitionsItem;
import com.catering.v2s.app.edge.generated.wire.ExtensionEntityCatalogPage;
import com.catering.v2s.app.edge.generated.wire.ExtensionEntityCatalogPageItemsItem;
import com.catering.v2s.app.edge.generated.wire.ExtensionEntityType;
import com.catering.v2s.app.edge.platform.session.PlatformSessionResolver;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.extension.application.ExtensionDefinitionService;
import com.catering.v2s.platform.workspace.application.WorkspaceAdministrationService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/platform/group-workspaces/{groupWorkspaceKey}/extension-definitions")
public final class PlatformExtensionDefinitionController {
    private final PlatformSessionResolver sessions;
    private final WorkspaceAdministrationService workspaces;
    private final ExtensionDefinitionService definitions;

    public PlatformExtensionDefinitionController(
            PlatformSessionResolver sessions,
            WorkspaceAdministrationService workspaces,
            ExtensionDefinitionService definitions) {
        this.sessions = sessions;
        this.workspaces = workspaces;
        this.definitions = definitions;
    }

    @GetMapping
    ExtensionEntityCatalogPage list(EdgeRequestContext request, @PathVariable String groupWorkspaceKey) {
        var workspace = sessions.requireRead(request).requireSelectedWorkspace(workspaces, groupWorkspaceKey);
        return new ExtensionEntityCatalogPage(
                definitions.platformManagementDefinitions(workspace.workspaceUuid(), groupWorkspaceKey).stream()
                        .map(value -> {
                            var type = ExtensionEntityType.valueOf(value.hostType());
                            return new ExtensionEntityCatalogPageItemsItem(
                                    type,
                                    businessName(type),
                                    (long) value.fields().size(),
                                    value.updatedAtEpochMillis());
                        })
                        .toList());
    }

    @GetMapping("/{entityType}")
    ExtensionDefinition detail(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable("entityType") String hostType) {
        var workspace = sessions.requireRead(request).requireSelectedWorkspace(workspaces, groupWorkspaceKey);
        return ExtensionDefinitionWireMapper.wire(
                definitions.platformManagementDefinition(workspace.workspaceUuid(), groupWorkspaceKey, hostType));
    }

    @PutMapping("/{entityType}")
    ExtensionDefinition replace(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable("entityType") String hostType,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody ExtensionDefinitionUpdateRequest body) {
        var actor = sessions.requireActor(request);
        var workspace = workspaces.require(groupWorkspaceKey);
        if (body == null || body.expectedVersion() == null || body.expectedVersion() < 0 || body.definitions() == null)
            throw new ExtensionDefinitionService.DefinitionInvalidException();
        return ExtensionDefinitionWireMapper.wire(definitions.replaceDraft(
                workspace.workspaceUuid(),
                groupWorkspaceKey,
                hostType,
                body.expectedVersion(),
                body.definitions().stream()
                        .map(PlatformExtensionDefinitionController::field)
                        .toList(),
                actor,
                idempotencyKey));
    }

    private static ExtensionDefinitionService.DraftField field(ExtensionDefinitionUpdateRequestDefinitionsItem value) {
        if (value == null
                || value.label() == null
                || value.type() == null
                || value.required() == null
                || value.options() == null
                || value.status() == null) {
            throw new ExtensionDefinitionService.DefinitionInvalidException();
        }
        try {
            return new ExtensionDefinitionService.DraftField(
                    value.key(),
                    value.label(),
                    value.type(),
                    value.required(),
                    value.options(),
                    value.status(),
                    value.displayOrder() == null ? null : Math.toIntExact(value.displayOrder()),
                    value.displaySuffix());
        } catch (ArithmeticException overflow) {
            throw new ExtensionDefinitionService.DefinitionInvalidException(overflow);
        }
    }

    private static String businessName(ExtensionEntityType type) {
        return switch (type) {
            case BRAND -> "品牌";
            case TENANT -> "经营租户";
            case HEAD_COMPANY -> "总公司";
            case STORE -> "门店";
            case CONTRACT -> "合同";
            case COMMERCIAL_GROUP -> "商业集团";
            case REGION -> "大区";
            case PROJECT -> "项目";
        };
    }
}
