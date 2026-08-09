package com.catering.v2s.app.edge.platform.contract;

import com.catering.v2s.app.edge.platform.session.PlatformSessionResolver;
import com.catering.v2s.app.edge.generated.wire.ContractOverviewItem;
import com.catering.v2s.app.edge.generated.wire.ContractOverviewItemContractRef;
import com.catering.v2s.app.edge.generated.wire.ContractOverviewItemExtensionFieldsItem;
import com.catering.v2s.app.edge.generated.wire.ContractOverviewItemProjectRef;
import com.catering.v2s.app.edge.generated.wire.ContractOverviewItemStoreRef;
import com.catering.v2s.app.edge.generated.wire.ContractOverviewItemTenantRef;
import com.catering.v2s.app.edge.generated.wire.ContractOverviewPage;
import com.catering.v2s.app.edge.generated.wire.ContractOverviewPageMetadata;
import com.catering.v2s.app.edge.generated.wire.StoreContractItem;
import com.catering.v2s.app.edge.generated.wire.StoreContractSortDirection;
import com.catering.v2s.app.edge.generated.wire.StoreContractSortKey;
import com.catering.v2s.app.edge.generated.wire.StoreContractStatus;
import com.catering.v2s.contract.application.ContractTaskReadService;
import com.catering.v2s.extension.api.ExtensionDefinitionReadback;
import com.catering.v2s.extension.api.ExtensionHostTypes;
import com.catering.v2s.extension.application.ExtensionDefinitionService;
import com.catering.v2s.platform.workspace.application.WorkspaceAdministrationService;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Platform-only read surface; contract task reads remain owned by contract. */
@RestController
@RequestMapping("/api/platform/group-workspaces/{groupWorkspaceKey}/contract-overview")
public final class PlatformContractOverviewController {
    private static final ObjectMapper JSON = new ObjectMapper();
    private final PlatformSessionResolver sessions;
    private final ContractTaskReadService reads;
    private final ExtensionDefinitionService definitions;
    private final WorkspaceAdministrationService workspaces;

    public PlatformContractOverviewController(PlatformSessionResolver sessions, ContractTaskReadService reads, ExtensionDefinitionService definitions, WorkspaceAdministrationService workspaces) { this.sessions = sessions; this.reads = reads; this.definitions = definitions; this.workspaces = workspaces; }

    @GetMapping ContractOverviewPage page(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @RequestParam(required = false) String contractNo, @RequestParam(required = false) UUID storeId, @RequestParam(required = false) String phaseName, @RequestParam(required = false) UUID tenantId, @RequestParam(required = false) String itemCode, @RequestParam(required = false) String status, @RequestParam(defaultValue = "UPDATED_AT") String sort, @RequestParam(defaultValue = "DESC") String direction, @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "50") int pageSize) {
        UUID workspaceUuid = sessions.requireRead(request).requireEnabledSelectedWorkspace(workspaces, groupWorkspaceKey).workspaceUuid();
        return overview(reads.platformOverviewTaskPage(workspaceUuid, groupWorkspaceKey, new ContractTaskReadService.ContractListQuery(null, storeId, tenantId, contractNo, phaseName, itemCode, null, null, status, sort, direction, page, pageSize)));
    }

    @GetMapping("/{contractId}") ContractOverviewItem detail(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @PathVariable UUID contractId) {
        UUID workspaceUuid = sessions.requireRead(request).requireEnabledSelectedWorkspace(workspaces, groupWorkspaceKey).workspaceUuid();
        var value = reads.platformOverviewTaskDetail(workspaceUuid, groupWorkspaceKey, contractId);
        return overviewItem(value, extensionFields(definitions.platformContractManagementDefinition(workspaceUuid, groupWorkspaceKey), value.extensionValues()));
    }

    private static ContractOverviewPage overview(ContractTaskReadService.ContractPage value) {
        Long asOf = value.items().stream().map(ContractTaskReadService.StoreContractView::updatedAt).max(Long::compare).orElse(null);
        return new ContractOverviewPage(
            new ContractOverviewPageMetadata(value.metadata().groupWorkspaceKey(), (long) value.metadata().page(), (long) value.metadata().pageSize(), value.metadata().total(), StoreContractSortKey.valueOf(value.metadata().sort()), StoreContractSortDirection.valueOf(value.metadata().direction())),
            value.items().stream().map(PlatformContractOverviewController::overviewItem).toList(), "AVAILABLE", asOf, java.util.List.of(), java.util.List.of(), "AVAILABLE", asOf, java.util.List.of()
        );
    }

    private static ContractOverviewItem overviewItem(ContractTaskReadService.StoreContractView value) {
        return new ContractOverviewItem(
            contractRef(value.id(), value.contractNo(), value.contractNo(), "RESOLVED"), storeRef(value.store()), value.phaseName() == null ? "未设置" : value.phaseName(), tenantRef(value.tenant()),
            value.effectiveFrom().toString(), value.effectiveTo() == null ? null : value.effectiveTo().toString(), null, StoreContractStatus.valueOf(value.status()), value.source(), value.revision(), value.createdAt(), value.updatedAt(), "RESOLVED", "RESOLVED", projectRef(value.project()), value.items().stream().map(ContractTaskReadService.Item::code).collect(java.util.stream.Collectors.joining(", ")), value.items().stream().map(item -> new StoreContractItem(item.code(), item.name())).toList(), java.util.List.of()
        );
    }

    private static ContractOverviewItem overviewItem(ContractTaskReadService.StoreContractView value, java.util.List<ContractOverviewItemExtensionFieldsItem> extensionFields) {
        return new ContractOverviewItem(
            contractRef(value.id(), value.contractNo(), value.contractNo(), "RESOLVED"), storeRef(value.store()), value.phaseName() == null ? "未设置" : value.phaseName(), tenantRef(value.tenant()), value.effectiveFrom().toString(), value.effectiveTo() == null ? null : value.effectiveTo().toString(), value.note(), StoreContractStatus.valueOf(value.status()), value.source(), value.revision(), value.createdAt(), value.updatedAt(), "RESOLVED", "RESOLVED", projectRef(value.project()), value.items().stream().map(ContractTaskReadService.Item::code).collect(java.util.stream.Collectors.joining(", ")), value.items().stream().map(item -> new StoreContractItem(item.code(), item.name())).toList(), extensionFields
        );
    }

    private static ContractOverviewItemContractRef contractRef(UUID id, String code, String name, String resolutionStatus) { return new ContractOverviewItemContractRef(id.toString(), code, name, resolutionStatus); }
    private static ContractOverviewItemStoreRef storeRef(ContractTaskReadService.Reference value) { return new ContractOverviewItemStoreRef(value.id().toString(), value.code(), value.name(), "RESOLVED"); }
    private static ContractOverviewItemProjectRef projectRef(ContractTaskReadService.Reference value) { return new ContractOverviewItemProjectRef(value.id().toString(), value.code(), value.name(), "RESOLVED"); }
    private static ContractOverviewItemTenantRef tenantRef(ContractTaskReadService.Reference value) { return new ContractOverviewItemTenantRef(value.id().toString(), value.code(), value.name(), "RESOLVED"); }
    private java.util.List<ContractOverviewItemExtensionFieldsItem> extensionFields(ExtensionDefinitionReadback definition, java.util.Map<String, String> values) {
        return definition.fields().stream().filter(field -> "ENABLED".equals(field.status())).sorted(java.util.Comparator.comparingInt(ExtensionDefinitionReadback.Field::displayOrder)).map(field -> new ContractOverviewItemExtensionFieldsItem(field.label(), displayValue(values.get(field.fieldKey())))).toList();
    }
    private static String displayValue(String encoded) { if (encoded == null) return null; try { JsonNode value = JSON.readTree(encoded); return value.isValueNode() ? value.asText() : value.toString(); } catch (java.io.IOException failure) { throw new IllegalArgumentException("invalid contract extension value", failure); } }

}
