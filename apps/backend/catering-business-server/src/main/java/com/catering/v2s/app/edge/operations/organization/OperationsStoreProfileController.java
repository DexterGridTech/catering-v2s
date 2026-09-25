package com.catering.v2s.app.edge.operations.organization;

import com.catering.v2s.app.edge.catalog.OrganizationEntityType;
import com.catering.v2s.app.edge.generated.wire.OrganizationStore;
import com.catering.v2s.app.edge.generated.wire.StoreContract;
import com.catering.v2s.app.edge.generated.wire.StoreContractItem;
import com.catering.v2s.app.edge.generated.wire.StoreContractPage;
import com.catering.v2s.app.edge.generated.wire.StoreContractPageMetadata;
import com.catering.v2s.app.edge.generated.wire.StoreContractProject;
import com.catering.v2s.app.edge.generated.wire.StoreContractSortDirection;
import com.catering.v2s.app.edge.generated.wire.StoreContractSortKey;
import com.catering.v2s.app.edge.generated.wire.StoreContractStatus;
import com.catering.v2s.app.edge.generated.wire.StoreContractStore;
import com.catering.v2s.app.edge.generated.wire.StoreContractTenant;
import com.catering.v2s.app.edge.generated.wire.StoreContractViewState;
import com.catering.v2s.app.edge.operations.session.OperationsSessionResolver;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.contract.application.ContractTaskReadService;
import com.catering.v2s.organization.api.OrganizationEntityReadback;
import com.catering.v2s.organization.application.BusinessEntityService;
import com.catering.v2s.organization.application.OperationsOrganizationTaskReadService;
import com.catering.v2s.organization.application.OrganizationOverviewTaskReadService;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import com.catering.v2s.workspace.iam.application.WorkspaceAuthenticationService;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

/** Current-store surfaces are deliberately tied to the selected operations context. */
@RestController
@RequestMapping("/api/operations/group-workspaces/{groupWorkspaceKey}/store/profile")
public final class OperationsStoreProfileController {
    private static final ObjectMapper JSON = new ObjectMapper();
    private final OperationsSessionResolver sessions;
    private final BusinessEntityService entities;
    private final OrganizationOverviewTaskReadService overview;
    private final ContractTaskReadService contracts;
    private final OperationsOrganizationTaskReadService reads;

    /** Legacy focused-test constructor; production uses the explicit GET-only task reader. */
    public OperationsStoreProfileController(
            OperationsSessionResolver sessions,
            BusinessEntityService entities,
            OrganizationOverviewTaskReadService overview,
            ContractTaskReadService contracts) {
        this(sessions, entities, overview, contracts, new OperationsOrganizationTaskReadService(entities, overview));
    }

    @org.springframework.beans.factory.annotation.Autowired
    public OperationsStoreProfileController(
            OperationsSessionResolver sessions,
            BusinessEntityService entities,
            OrganizationOverviewTaskReadService overview,
            ContractTaskReadService contracts,
            OperationsOrganizationTaskReadService reads) {
        this.sessions = sessions;
        this.entities = entities;
        this.overview = overview;
        this.contracts = contracts;
        this.reads = reads;
    }

    @GetMapping
    OrganizationStore profile(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @RequestParam long expectedContextVersion) {
        WorkspaceSessionReadback session = context(request, groupWorkspaceKey, expectedContextVersion);
        java.util.UUID storeId = requireStore(session);
        OrganizationEntityReadback entity = entities.requireEntity(
                OrganizationEntityType.STORE.wire(), session.workspaceUuid(), groupWorkspaceKey, storeId);
        var operatingRules =
                entities.requireStoreOperatingRuleSwitches(session.workspaceUuid(), groupWorkspaceKey, storeId);
        return StoreWireMapper.store(
                entity,
                reads.store(session.workspaceUuid(), groupWorkspaceKey, storeId),
                contracts.derivedStoreStatus(session.workspaceUuid(), groupWorkspaceKey, storeId),
                operatingRules.values());
    }

    @GetMapping("/contracts")
    StoreContractPage contracts(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @RequestParam long expectedContextVersion,
            @RequestParam StoreContractViewState state,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        WorkspaceSessionReadback session = context(request, groupWorkspaceKey, expectedContextVersion);
        return contractPage(contracts.operationsFixedStoreContractPage(
                session.workspaceUuid(),
                groupWorkspaceKey,
                requireStore(session),
                ContractTaskReadService.FixedStoreContractViewState.valueOf(state.name()),
                page,
                pageSize));
    }

    private WorkspaceSessionReadback context(EdgeRequestContext request, String key, long expected) {
        return sessions.requireWorkspaceReadAtContextVersion(request, key, expected);
    }

    private static StoreContractPage contractPage(ContractTaskReadService.FixedStoreContractPage value) {
        return new StoreContractPage(
                new StoreContractPageMetadata(
                        value.groupWorkspaceKey(),
                        value.project().id(),
                        value.project().name(),
                        (long) value.page(),
                        (long) value.pageSize(),
                        value.total(),
                        StoreContractSortKey.CONTRACT_NO,
                        StoreContractSortDirection.ASC,
                        null),
                value.items().stream()
                        .map(OperationsStoreProfileController::contract)
                        .toList());
    }

    private static StoreContract contract(ContractTaskReadService.StoreContractView value) {
        return new StoreContract(
                value.id().toString(),
                value.groupWorkspaceKey(),
                referenceProject(value.project()),
                referenceStore(value.store()),
                referenceTenant(value.tenant()),
                value.phaseName(),
                value.contractNo(),
                value.effectiveFrom().toString(),
                value.effectiveTo() == null ? null : value.effectiveTo().toString(),
                value.note(),
                extensionValues(value.extensionValues()),
                value.extensionRuleRevision(),
                StoreContractStatus.valueOf(value.status()),
                value.revision(),
                value.source(),
                value.createdAt(),
                value.updatedAt(),
                value.items().stream()
                        .map(item -> new StoreContractItem(item.code(), item.name()))
                        .toList(),
                value.phaseNameSnapshot());
    }

    private static StoreContractProject referenceProject(ContractTaskReadService.Reference value) {
        return new StoreContractProject(value.id().toString(), value.code(), value.name());
    }

    private static StoreContractStore referenceStore(ContractTaskReadService.Reference value) {
        return new StoreContractStore(value.id().toString(), value.code(), value.name());
    }

    private static StoreContractTenant referenceTenant(ContractTaskReadService.Reference value) {
        return new StoreContractTenant(value.id().toString(), value.code(), value.name());
    }

    private static JsonNode extensionValues(Map<String, String> values) {
        ObjectNode result = JSON.createObjectNode();
        values.forEach((key, raw) -> {
            try {
                result.set(key, JSON.readTree(raw));
            } catch (Exception exception) {
                throw new IllegalStateException("contract owner emitted invalid extension JSON", exception);
            }
        });
        return result;
    }

    private static java.util.UUID requireStore(WorkspaceSessionReadback value) {
        if (value.scopeContext() == null || value.scopeContext().store() == null)
            throw new WorkspaceAuthenticationService.SessionInvalidException();
        return value.scopeContext().store().dataNodeId();
    }
}
