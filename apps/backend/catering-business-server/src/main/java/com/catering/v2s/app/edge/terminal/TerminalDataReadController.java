package com.catering.v2s.app.edge.terminal;

import com.catering.v2s.app.edge.generated.wire.OrganizationStore;
import com.catering.v2s.app.edge.generated.wire.OrganizationStoreOperatingRuleValues;
import com.catering.v2s.app.edge.generated.wire.OrganizationStoreStatus;
import com.catering.v2s.app.edge.generated.wire.StoreContract;
import com.catering.v2s.app.edge.generated.wire.StoreContractItem;
import com.catering.v2s.app.edge.generated.wire.StoreContractProject;
import com.catering.v2s.app.edge.generated.wire.StoreContractStatus;
import com.catering.v2s.app.edge.generated.wire.StoreContractStore;
import com.catering.v2s.app.edge.generated.wire.StoreContractTenant;
import com.catering.v2s.app.edge.generated.wire.StoreServicePointAreaType;
import com.catering.v2s.app.edge.generated.wire.StoreServicePointStatus;
import com.catering.v2s.app.edge.generated.wire.StoreServicePointType;
import com.catering.v2s.app.edge.generated.wire.TerminalContractRead;
import com.catering.v2s.app.edge.generated.wire.TerminalServicePointAreaRead;
import com.catering.v2s.app.edge.generated.wire.TerminalServicePointAreaReadArea;
import com.catering.v2s.app.edge.generated.wire.TerminalServicePointRead;
import com.catering.v2s.app.edge.generated.wire.TerminalServicePointReadServicePoint;
import com.catering.v2s.app.edge.generated.wire.TerminalStoreActiveContractsRead;
import com.catering.v2s.app.edge.generated.wire.TerminalStoreBasicRead;
import com.catering.v2s.app.edge.generated.wire.TerminalStoreOrganizationPathRead;
import com.catering.v2s.app.edge.generated.wire.TerminalStoreServicePointAreasRead;
import com.catering.v2s.app.edge.generated.wire.TerminalStoreServicePointAreasReadItemsItem;
import com.catering.v2s.app.edge.generated.wire.TerminalStoreServicePointsRead;
import com.catering.v2s.app.edge.generated.wire.TerminalStoreServicePointsReadItemsItem;
import com.catering.v2s.app.edge.problem.ContractProblemAdvice;
import com.catering.v2s.app.edge.problem.InvalidEdgeRequestException;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.contract.application.ContractTaskReadService;
import com.catering.v2s.organization.api.OrganizationNodeReadback;
import com.catering.v2s.organization.api.StoreServicePointOwnerApi;
import com.catering.v2s.organization.application.BusinessEntityService;
import com.catering.v2s.organization.application.OperationsOrganizationTaskReadService;
import com.catering.v2s.organization.application.OrganizationOverviewTaskReadService;
import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi;
import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi.Verification;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.dao.TransientDataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** Terminal-facing read edge. Authorization is resolved once and owner reads remain read-only. */
@RestController
@RequestMapping("/api/terminal/group-workspaces/{groupWorkspaceKey}")
public class TerminalDataReadController {
    private static final Logger log = LoggerFactory.getLogger(TerminalDataReadController.class);
    private static final ObjectMapper JSON = new ObjectMapper();

    @ExceptionHandler({DataAccessResourceFailureException.class, TransientDataAccessException.class})
    ResponseEntity<ContractProblemAdvice.Problem> dependencyUnavailable(
            RuntimeException exception, EdgeRequestContext request) {
        log.atWarn()
                .addKeyValue("event", "TERMINAL_DATA_READ_DEPENDENCY_UNAVAILABLE")
                .addKeyValue("exceptionType", exception.getClass().getSimpleName())
                .log("Terminal data read dependency is unavailable");
        String code = "PLATFORM_DEPENDENCY_UNAVAILABLE";
        String detail = "终端资料暂时无法读取，请稍后重试";
        return ContractProblemAdvice.problem(HttpStatus.SERVICE_UNAVAILABLE, code, detail, request);
    }

    private final TerminalCredentialVerificationApi credentials;
    private final BusinessEntityService entities;
    private final OperationsOrganizationTaskReadService organizationReads;
    private final StoreServicePointOwnerApi servicePoints;
    private final ContractTaskReadService contracts;

    public TerminalDataReadController(
            TerminalCredentialVerificationApi credentials,
            BusinessEntityService entities,
            OperationsOrganizationTaskReadService organizationReads,
            StoreServicePointOwnerApi servicePoints,
            ContractTaskReadService contracts) {
        this.credentials = Objects.requireNonNull(credentials, "credentials");
        this.entities = Objects.requireNonNull(entities, "entities");
        this.organizationReads = Objects.requireNonNull(organizationReads, "organizationReads");
        this.servicePoints = Objects.requireNonNull(servicePoints, "servicePoints");
        this.contracts = Objects.requireNonNull(contracts, "contracts");
    }

    @GetMapping("/stores/{storeRef}/basic")
    @Transactional(readOnly = true)
    public TerminalStoreBasicRead storeBasic(
            @PathVariable String groupWorkspaceKey,
            @PathVariable String storeRef,
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestHeader(value = "X-Terminal-Ref", required = false) String terminalRef,
            @RequestHeader(value = "X-Terminal-Device-Id", required = false) String deviceId) {
        Verification binding = verify(groupWorkspaceKey, authorization, terminalRef, deviceId);
        UUID requestedStore = uuid(storeRef);
        requireSameStore(binding, requestedStore);
        OrganizationOverviewTaskReadService.Item detail =
                organizationReads.store(binding.workspaceUuid(), binding.groupWorkspaceKey(), binding.storeRef());
        var rules = entities.requireStoreOperatingRuleSwitches(
                binding.workspaceUuid(), binding.groupWorkspaceKey(), binding.storeRef());
        OrganizationStoreOperatingRuleValues ruleWire =
                JSON.convertValue(rules.values().asMap(), OrganizationStoreOperatingRuleValues.class);
        OrganizationStore storeWire = new OrganizationStore(
                detail.id().toString(),
                detail.groupWorkspaceKey(),
                detail.code(),
                detail.name(),
                project(detail.project()),
                brand(detail.brand()),
                tenant(detail.tenant()),
                detail.headCompany() == null
                        ? null
                        : new com.catering.v2s.app.edge.generated.wire.OrganizationStoreHeadCompany(
                                detail.headCompany().id().toString(),
                                detail.headCompany().code(),
                                detail.headCompany().name(),
                                null),
                detail.notes(),
                OrganizationStoreStatus.valueOf(detail.status()),
                extensionValues(detail.extensionValues()),
                detail.extensionRuleRevision(),
                detail.version(),
                detail.createdAt(),
                detail.updatedAt(),
                contracts.derivedStoreStatus(binding.workspaceUuid(), binding.groupWorkspaceKey(), binding.storeRef()),
                ruleWire);
        logRead("terminalReadStoreBasic", binding);
        return new TerminalStoreBasicRead(storeWire, ruleWire, detail.updatedAt(), detail.updatedAt());
    }

    @GetMapping("/stores/{storeRef}/organization-path")
    @Transactional(readOnly = true)
    public TerminalStoreOrganizationPathRead organizationPath(
            @PathVariable String groupWorkspaceKey,
            @PathVariable String storeRef,
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestHeader(value = "X-Terminal-Ref", required = false) String terminalRef,
            @RequestHeader(value = "X-Terminal-Device-Id", required = false) String deviceId) {
        Verification binding = verify(groupWorkspaceKey, authorization, terminalRef, deviceId);
        requireSameStore(binding, uuid(storeRef));
        var snapshot = organizationReads.hierarchy(binding.workspaceUuid(), binding.groupWorkspaceKey());
        OrganizationOverviewTaskReadService.Item store =
                organizationReads.store(binding.workspaceUuid(), binding.groupWorkspaceKey(), binding.storeRef());
        UUID projectRef = store.project().id();
        OrganizationNodeReadback project = node(snapshot.nodes(), projectRef);
        OrganizationNodeReadback region = node(snapshot.nodes(), project.parentId());
        var group = snapshot.commercialGroup();
        if (!group.id().equals(region.parentId())) throw TerminalDataReadProblem.denied();
        logRead("terminalReadStoreOrganizationPath", binding);
        return new TerminalStoreOrganizationPathRead(
                project.id(),
                project.name(),
                region.id(),
                region.name(),
                group.id(),
                group.commercialGroupName(),
                project.updatedAtEpochMillis(),
                region.updatedAtEpochMillis(),
                group.updatedAtEpochMillis());
    }

    @GetMapping("/stores/{storeRef}/contracts")
    @Transactional(readOnly = true)
    public TerminalStoreActiveContractsRead activeContracts(
            @PathVariable String groupWorkspaceKey,
            @PathVariable String storeRef,
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestHeader(value = "X-Terminal-Ref", required = false) String terminalRef,
            @RequestHeader(value = "X-Terminal-Device-Id", required = false) String deviceId) {
        Verification binding = verify(groupWorkspaceKey, authorization, terminalRef, deviceId);
        requireSameStore(binding, uuid(storeRef));
        List<ContractTaskReadService.StoreContractView> active = contracts.activeTerminalStoreContracts(
                binding.workspaceUuid(), binding.groupWorkspaceKey(), binding.storeRef());
        logRead("terminalReadStoreActiveContracts", binding);
        return new TerminalStoreActiveContractsRead(
                active.stream().map(TerminalDataReadController::contract).toList(),
                active.stream()
                        .mapToLong(ContractTaskReadService.StoreContractView::updatedAt)
                        .max()
                        .orElse(0));
    }

    @GetMapping("/contracts/{contractRef}")
    @Transactional(readOnly = true)
    public TerminalContractRead contract(
            @PathVariable String groupWorkspaceKey,
            @PathVariable String contractRef,
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestHeader(value = "X-Terminal-Ref", required = false) String terminalRef,
            @RequestHeader(value = "X-Terminal-Device-Id", required = false) String deviceId) {
        Verification binding = verify(groupWorkspaceKey, authorization, terminalRef, deviceId);
        var value = contracts.view(binding.workspaceUuid(), binding.groupWorkspaceKey(), uuid(contractRef));
        if (value == null || !binding.storeRef().equals(value.store().id())) throw TerminalDataReadProblem.notFound();
        logRead("terminalReadContract", binding);
        return new TerminalContractRead(contract(value), value.updatedAt());
    }

    @GetMapping("/stores/{storeRef}/service-point-areas")
    @Transactional(readOnly = true)
    public TerminalStoreServicePointAreasRead servicePointAreas(
            @PathVariable String groupWorkspaceKey,
            @PathVariable String storeRef,
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestHeader(value = "X-Terminal-Ref", required = false) String terminalRef,
            @RequestHeader(value = "X-Terminal-Device-Id", required = false) String deviceId) {
        Verification binding = verify(groupWorkspaceKey, authorization, terminalRef, deviceId);
        requireSameStore(binding, uuid(storeRef));
        List<StoreServicePointOwnerApi.TerminalArea> enabled = servicePoints.readTerminalAreas(
                binding.workspaceUuid(), binding.groupWorkspaceKey(), binding.storeRef());
        logRead("terminalReadStoreServicePointAreas", binding);
        return new TerminalStoreServicePointAreasRead(
                enabled.stream()
                        .map(TerminalDataReadController::terminalAreaItem)
                        .toList(),
                enabled.stream()
                        .mapToLong(StoreServicePointOwnerApi.TerminalArea::updatedAt)
                        .max()
                        .orElse(0));
    }

    @GetMapping("/service-point-areas/{areaRef}")
    @Transactional(readOnly = true)
    public TerminalServicePointAreaRead servicePointArea(
            @PathVariable String groupWorkspaceKey,
            @PathVariable String areaRef,
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestHeader(value = "X-Terminal-Ref", required = false) String terminalRef,
            @RequestHeader(value = "X-Terminal-Device-Id", required = false) String deviceId) {
        Verification binding = verify(groupWorkspaceKey, authorization, terminalRef, deviceId);
        UUID requested = uuid(areaRef);
        StoreServicePointOwnerApi.TerminalArea value = servicePoints.readTerminalArea(
                binding.workspaceUuid(), binding.groupWorkspaceKey(), binding.storeRef(), requested);
        logRead("terminalReadServicePointArea", binding);
        return new TerminalServicePointAreaRead(terminalArea(value), value.updatedAt());
    }

    @GetMapping("/stores/{storeRef}/service-points")
    @Transactional(readOnly = true)
    public TerminalStoreServicePointsRead servicePoints(
            @PathVariable String groupWorkspaceKey,
            @PathVariable String storeRef,
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestHeader(value = "X-Terminal-Ref", required = false) String terminalRef,
            @RequestHeader(value = "X-Terminal-Device-Id", required = false) String deviceId) {
        Verification binding = verify(groupWorkspaceKey, authorization, terminalRef, deviceId);
        requireSameStore(binding, uuid(storeRef));
        List<StoreServicePointOwnerApi.TerminalPoint> enabled = servicePoints.readTerminalPoints(
                binding.workspaceUuid(), binding.groupWorkspaceKey(), binding.storeRef());
        logRead("terminalReadStoreServicePoints", binding);
        return new TerminalStoreServicePointsRead(
                enabled.stream()
                        .map(TerminalDataReadController::terminalPointItem)
                        .toList(),
                enabled.stream()
                        .mapToLong(StoreServicePointOwnerApi.TerminalPoint::updatedAt)
                        .max()
                        .orElse(0));
    }

    @GetMapping("/service-points/{pointRef}")
    @Transactional(readOnly = true)
    public TerminalServicePointRead servicePoint(
            @PathVariable String groupWorkspaceKey,
            @PathVariable String pointRef,
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestHeader(value = "X-Terminal-Ref", required = false) String terminalRef,
            @RequestHeader(value = "X-Terminal-Device-Id", required = false) String deviceId) {
        Verification binding = verify(groupWorkspaceKey, authorization, terminalRef, deviceId);
        StoreServicePointOwnerApi.TerminalPoint value = servicePoints.readTerminalPoint(
                binding.workspaceUuid(), binding.groupWorkspaceKey(), binding.storeRef(), uuid(pointRef));
        logRead("terminalReadServicePoint", binding);
        return new TerminalServicePointRead(terminalPoint(value), value.updatedAt());
    }

    private Verification verify(String groupKey, String authorization, String terminalRef, String deviceId) {
        return TerminalCredentialEdgeVerifier.verify(credentials, groupKey, authorization, terminalRef, deviceId);
    }

    private static OrganizationNodeReadback node(List<OrganizationNodeReadback> nodes, UUID ref) {
        return nodes.stream()
                .filter(value -> value.id().equals(ref))
                .findFirst()
                .orElseThrow(TerminalDataReadProblem::denied);
    }

    private static void requireSameStore(Verification binding, UUID requested) {
        if (!binding.storeRef().equals(requested)) throw TerminalDataReadProblem.denied();
    }

    private static UUID uuid(String value) {
        try {
            return UUID.fromString(value);
        } catch (RuntimeException malformed) {
            throw invalid(malformed);
        }
    }

    private static InvalidEdgeRequestException invalid(Throwable cause) {
        return new InvalidEdgeRequestException("terminal read request is invalid", cause);
    }

    private static void logRead(String operationId, Verification binding) {
        log.atInfo()
                .addKeyValue("event", "TERMINAL_DATA_READ_COMPLETED")
                .addKeyValue("operationId", operationId)
                .addKeyValue("terminalRef", binding.terminalRef())
                .addKeyValue("storeRef", binding.storeRef())
                .addKeyValue("generation", binding.generation())
                .log("terminal data read completed");
    }

    private static com.catering.v2s.app.edge.generated.wire.OrganizationStoreProject project(
            OrganizationOverviewTaskReadService.Reference value) {
        return new com.catering.v2s.app.edge.generated.wire.OrganizationStoreProject(
                value.id().toString(), value.code(), value.name(), null);
    }

    private static com.catering.v2s.app.edge.generated.wire.OrganizationStoreBrand brand(
            OrganizationOverviewTaskReadService.Reference value) {
        return new com.catering.v2s.app.edge.generated.wire.OrganizationStoreBrand(
                value.id().toString(), value.code(), value.name(), null);
    }

    private static com.catering.v2s.app.edge.generated.wire.OrganizationStoreTenant tenant(
            OrganizationOverviewTaskReadService.Reference value) {
        return new com.catering.v2s.app.edge.generated.wire.OrganizationStoreTenant(
                value.id().toString(), value.code(), value.name(), null);
    }

    private static JsonNode extensionValues(Map<String, String> values) {
        var result = JSON.createObjectNode();
        values.forEach((key, value) -> {
            try {
                result.set(key, JSON.readTree(value));
            } catch (Exception failure) {
                throw new IllegalStateException("organization owner emitted invalid extension JSON", failure);
            }
        });
        return result;
    }

    private static StoreContract contract(ContractTaskReadService.StoreContractView value) {
        JsonNode extensionValues = JSON.createObjectNode();
        var object = (tools.jackson.databind.node.ObjectNode) extensionValues;
        value.extensionValues().forEach((key, raw) -> {
            try {
                object.set(key, JSON.readTree(raw));
            } catch (Exception failure) {
                throw new IllegalStateException("contract owner emitted invalid extension JSON", failure);
            }
        });
        return new StoreContract(
                value.id().toString(),
                value.groupWorkspaceKey(),
                new StoreContractProject(
                        value.project().id().toString(),
                        value.project().code(),
                        value.project().name()),
                new StoreContractStore(
                        value.store().id().toString(),
                        value.store().code(),
                        value.store().name()),
                new StoreContractTenant(
                        value.tenant().id().toString(),
                        value.tenant().code(),
                        value.tenant().name()),
                value.phaseName(),
                value.contractNo(),
                value.effectiveFrom().toString(),
                value.effectiveTo() == null ? null : value.effectiveTo().toString(),
                value.note(),
                extensionValues,
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

    private static TerminalServicePointAreaReadArea terminalArea(StoreServicePointOwnerApi.TerminalArea value) {
        return new TerminalServicePointAreaReadArea(
                value.areaRef(),
                value.storeRef(),
                value.name(),
                value.code(),
                StoreServicePointAreaType.valueOf(value.areaType()),
                StoreServicePointStatus.valueOf(value.status()),
                value.displayOrder(),
                value.version(),
                value.createdAt(),
                value.updatedAt());
    }

    private static TerminalStoreServicePointAreasReadItemsItem terminalAreaItem(
            StoreServicePointOwnerApi.TerminalArea value) {
        return new TerminalStoreServicePointAreasReadItemsItem(
                value.areaRef(),
                value.storeRef(),
                value.name(),
                value.code(),
                StoreServicePointAreaType.valueOf(value.areaType()),
                StoreServicePointStatus.valueOf(value.status()),
                value.displayOrder(),
                value.version(),
                value.createdAt(),
                value.updatedAt());
    }

    private static TerminalServicePointReadServicePoint terminalPoint(StoreServicePointOwnerApi.TerminalPoint value) {
        return new TerminalServicePointReadServicePoint(
                value.pointRef(),
                value.storeRef(),
                value.areaRef(),
                value.name(),
                value.code(),
                StoreServicePointType.valueOf(value.pointType()),
                StoreServicePointStatus.valueOf(value.status()),
                value.displayOrder(),
                json(value.seatCapacity()),
                json(value.tableShape()),
                json(value.reservable()),
                value.imageAssetRef(),
                parseJson(value.extensionValuesJson()),
                json(value.extensionRuleRevision()),
                value.version(),
                value.createdAt(),
                value.updatedAt());
    }

    private static TerminalStoreServicePointsReadItemsItem terminalPointItem(
            StoreServicePointOwnerApi.TerminalPoint value) {
        return new TerminalStoreServicePointsReadItemsItem(
                value.pointRef(),
                value.storeRef(),
                value.areaRef(),
                value.name(),
                value.code(),
                StoreServicePointType.valueOf(value.pointType()),
                StoreServicePointStatus.valueOf(value.status()),
                value.displayOrder(),
                json(value.seatCapacity()),
                json(value.tableShape()),
                json(value.reservable()),
                value.imageAssetRef(),
                parseJson(value.extensionValuesJson()),
                json(value.extensionRuleRevision()),
                value.version(),
                value.createdAt(),
                value.updatedAt());
    }

    private static JsonNode json(Object value) {
        return value == null ? null : JSON.valueToTree(value);
    }

    private static JsonNode parseJson(String value) {
        try {
            return JSON.readTree(value == null ? "{}" : value);
        } catch (Exception failure) {
            throw new IllegalStateException("service point owner emitted invalid extension JSON", failure);
        }
    }
}
