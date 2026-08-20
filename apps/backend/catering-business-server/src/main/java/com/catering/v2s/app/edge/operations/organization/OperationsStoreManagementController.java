package com.catering.v2s.app.edge.operations.organization;

import com.catering.v2s.app.edge.extension.ExtensionSubmissionWireMapper;
import com.catering.v2s.app.edge.generated.backendperformancem1.BackendPerformanceM1CommandExecutionBindings;
import com.catering.v2s.app.edge.generated.wire.OrganizationStore;
import com.catering.v2s.app.edge.generated.wire.OrganizationStoreCreateRequest;
import com.catering.v2s.app.edge.generated.wire.OrganizationStorePage;
import com.catering.v2s.app.edge.generated.wire.OrganizationStorePageMetadata;
import com.catering.v2s.app.edge.generated.wire.OrganizationStoreSortDirection;
import com.catering.v2s.app.edge.generated.wire.OrganizationStoreSortKey;
import com.catering.v2s.app.edge.generated.wire.OrganizationStoreStatus;
import com.catering.v2s.app.edge.generated.wire.OrganizationStoreStatusRequest;
import com.catering.v2s.app.edge.generated.wire.OrganizationStoreUpdateRequest;
import com.catering.v2s.app.edge.operations.session.OperationsSessionResolver;
import com.catering.v2s.app.edge.problem.InvalidEdgeRequestException;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.contract.application.ContractTaskReadService;
import com.catering.v2s.extension.api.ExtensionSubmission;
import com.catering.v2s.organization.api.OperationsStoreCommandApi;
import com.catering.v2s.organization.api.OrganizationEntityReadback;
import com.catering.v2s.organization.application.BusinessEntityService;
import com.catering.v2s.organization.application.OperationsOrganizationTaskReadService;
import com.catering.v2s.organization.application.OrganizationOverviewTaskReadService;
import com.catering.v2s.organization.application.operations.CreateOperationsOrganizationStoreOperation;
import com.catering.v2s.organization.application.operations.TransitionOperationsOrganizationStoreStatusOperation;
import com.catering.v2s.organization.application.operations.UpdateOperationsOrganizationStoreOperation;
import com.catering.v2s.platform.foundation.contract.ServiceNodeTypes;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import com.catering.v2s.workspace.iam.application.WorkspaceCapabilityScopeResolver;
import com.catering.v2s.workspace.iam.application.WorkspaceCommandAuthorizationService;
import com.catering.v2s.workspace.iam.application.WorkspaceUserService;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;

/** Operations store capability adapter; immutable store relations are re-read from the organization owner on update. */
@RestController
@RequestMapping("/api/operations/group-workspaces/{groupWorkspaceKey}/organization/stores")
public final class OperationsStoreManagementController {
    private final OperationsSessionResolver sessions;
    private final BusinessEntityService entities;
    private final OrganizationOverviewTaskReadService overview;
    private final ContractTaskReadService contracts;
    private final WorkspaceUserService user;
    private final WorkspaceCapabilityScopeResolver capabilityScopes;
    private final OperationsOrganizationTaskReadService reads;
    private final CreateOperationsOrganizationStoreOperation createOperation;
    private final UpdateOperationsOrganizationStoreOperation updateOperation;
    private final TransitionOperationsOrganizationStoreStatusOperation transitionOperation;
    private final BackendPerformanceM1CommandExecutionBindings m1Bindings;
    /** Legacy focused-test constructor; production uses the explicit GET-only task reader. */
    public OperationsStoreManagementController(
            OperationsSessionResolver sessions,
            BusinessEntityService entities,
            OrganizationOverviewTaskReadService overview,
            ContractTaskReadService contracts,
            WorkspaceUserService user,
            WorkspaceCapabilityScopeResolver capabilityScopes) {
        this(
                sessions,
                entities,
                overview,
                contracts,
                user,
                capabilityScopes,
                new OperationsOrganizationTaskReadService(entities, overview),
                new CreateOperationsOrganizationStoreOperation(entities, overview, contracts),
                new UpdateOperationsOrganizationStoreOperation(entities, overview, contracts),
                new TransitionOperationsOrganizationStoreStatusOperation(entities, overview, contracts),
                BackendPerformanceM1CommandExecutionBindings.forStoreManagement(
                        new CreateOperationsOrganizationStoreOperation(entities, overview, contracts),
                        new TransitionOperationsOrganizationStoreStatusOperation(entities, overview, contracts),
                        new UpdateOperationsOrganizationStoreOperation(entities, overview, contracts)));
    }

    @org.springframework.beans.factory.annotation.Autowired
    public OperationsStoreManagementController(
            OperationsSessionResolver sessions,
            BusinessEntityService entities,
            OrganizationOverviewTaskReadService overview,
            ContractTaskReadService contracts,
            WorkspaceUserService user,
            WorkspaceCapabilityScopeResolver capabilityScopes,
            OperationsOrganizationTaskReadService reads,
            CreateOperationsOrganizationStoreOperation createOperation,
            UpdateOperationsOrganizationStoreOperation updateOperation,
            TransitionOperationsOrganizationStoreStatusOperation transitionOperation,
            BackendPerformanceM1CommandExecutionBindings m1Bindings) {
        this.sessions = sessions;
        this.entities = entities;
        this.overview = overview;
        this.contracts = contracts;
        this.user = user;
        this.capabilityScopes = capabilityScopes;
        this.reads = reads;
        this.createOperation = createOperation;
        this.updateOperation = updateOperation;
        this.transitionOperation = transitionOperation;
        this.m1Bindings = m1Bindings;
    }

    @PostMapping
    ResponseEntity<OrganizationStore> create(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody OrganizationStoreCreateRequest body) {
        WorkspaceSessionReadback session = sessions.requireWorkspaceCommand(request, groupWorkspaceKey);
        UUID projectId = user.resolveSelectedProjectScope(session, null).targetId();
        var result = m1Bindings.bindCreateOperationsOrganizationStore(new OperationsStoreCommandApi.CreateStoreCommand(
                session.workspaceUuid(),
                groupWorkspaceKey,
                projectId,
                uuid(body.tenantId()),
                uuid(body.brandId()),
                nullableUuid(body.headCompanyId()),
                body.code(),
                body.name(),
                body.notes(),
                createSubmission(body.extensionValues()),
                idempotencyKey,
                actor(session),
                requireCapability(session, "REQ_CREATE_OPERATIONS_ORGANIZATION_STORE", projectId)));
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(StoreWireMapper.store(
                        result.store(), result.organizationDetail(), result.contractDerivedStatus()));
    }

    @GetMapping
    OrganizationStorePage list(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @RequestParam long expectedContextVersion,
            @RequestParam(required = false) String name,
            @RequestParam(required = false) String code,
            @RequestParam(required = false) OrganizationStoreStatus status,
            @RequestParam(required = false) OrganizationStoreSortKey sort,
            @RequestParam(required = false) OrganizationStoreSortDirection direction,
            @RequestParam(required = false, defaultValue = "1") int page,
            @RequestParam(required = false, defaultValue = "20") int pageSize) {
        WorkspaceSessionReadback session = context(request, groupWorkspaceKey, expectedContextVersion);
        UUID scopedProjectId = user.resolveSelectedProjectScope(session, null).targetId();
        var result = reads.stores(
                session.workspaceUuid(),
                groupWorkspaceKey,
                new OrganizationOverviewTaskReadService.Query(
                        ServiceNodeTypes.STORE,
                        name,
                        code,
                        null,
                        null,
                        status == null ? null : status.wire(),
                        null,
                        scopedProjectId,
                        null,
                        null,
                        sort == null ? null : sort.name(),
                        direction == null ? null : direction.name(),
                        scopedProjectId),
                page,
                pageSize);
        List<UUID> storeIds = result.items().stream()
                .map(OrganizationOverviewTaskReadService.Item::id)
                .toList();
        Map<UUID, OrganizationEntityReadback> stores =
                entities.requireEntities(ServiceNodeTypes.STORE, session.workspaceUuid(), groupWorkspaceKey, storeIds);
        Map<UUID, String> statuses =
                contracts.derivedStoreStatuses(session.workspaceUuid(), groupWorkspaceKey, storeIds);
        OrganizationStorePageMetadata metadata = new OrganizationStorePageMetadata(
                groupWorkspaceKey,
                null,
                (long) result.metadata().page(),
                (long) result.metadata().pageSize(),
                result.metadata().total(),
                OrganizationStoreSortKey.valueOf(result.metadata().sort()),
                OrganizationStoreSortDirection.valueOf(result.metadata().direction()));
        return new OrganizationStorePage(
                metadata,
                result.items().stream()
                        .map(item ->
                                StoreWireMapper.store(requiredStore(stores, item.id()), item, statuses.get(item.id())))
                        .toList());
    }

    @GetMapping("/{storeId}")
    OrganizationStore detail(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID storeId,
            @RequestParam long expectedContextVersion) {
        WorkspaceSessionReadback session = context(request, groupWorkspaceKey, expectedContextVersion);
        OrganizationOverviewTaskReadService.Item current = scopedReadStore(session, groupWorkspaceKey, storeId);
        return store(session, groupWorkspaceKey, current);
    }

    @PatchMapping("/{storeId}")
    OrganizationStore update(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID storeId,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody OrganizationStoreUpdateRequest body) {
        WorkspaceSessionReadback session = sessions.requireWorkspaceCommand(request, groupWorkspaceKey);
        UUID projectId = user.resolveSelectedProjectScope(
                        session, entities.requireStoreProjectId(session.workspaceUuid(), groupWorkspaceKey, storeId))
                .targetId();
        var grant = requireCapability(session, "REQ_UPDATE_OPERATIONS_ORGANIZATION_STORE", projectId);
        OrganizationOverviewTaskReadService.Item current =
                overview.detail(session.workspaceUuid(), groupWorkspaceKey, ServiceNodeTypes.STORE, storeId);
        var result = m1Bindings.bindUpdateOperationsOrganizationStore(new OperationsStoreCommandApi.UpdateStoreCommand(
                session.workspaceUuid(),
                groupWorkspaceKey,
                storeId,
                projectId,
                current.tenant().id(),
                current.brand().id(),
                nullableUuid(body.headCompanyId()),
                current.code(),
                body.name(),
                body.notes(),
                required(body.expectedVersion()),
                updateSubmission(body.extensionValues()),
                idempotencyKey,
                actor(session),
                grant));
        return StoreWireMapper.store(result.store(), result.organizationDetail(), result.contractDerivedStatus());
    }

    @PostMapping("/{storeId}/status")
    OrganizationStore transitionStatus(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID storeId,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody OrganizationStoreStatusRequest body) {
        WorkspaceSessionReadback session = sessions.requireWorkspaceCommand(request, groupWorkspaceKey);
        UUID projectId = user.resolveSelectedProjectScope(
                        session, entities.requireStoreProjectId(session.workspaceUuid(), groupWorkspaceKey, storeId))
                .targetId();
        if (body.targetStatus() == null) throw new InvalidEdgeRequestException("target status is required");
        var result = m1Bindings.bindTransitionOperationsOrganizationStoreStatus(
                new OperationsStoreCommandApi.StoreStatusCommand(
                        session.workspaceUuid(),
                        groupWorkspaceKey,
                        storeId,
                        body.targetStatus().wire(),
                        required(body.expectedVersion()),
                        idempotencyKey,
                        actor(session),
                        requireStatusTransitionCapability(
                                session, "REQ_TRANSITION_OPERATIONS_ORGANIZATION_STORE_STATUS", projectId)));
        return StoreWireMapper.store(result.store(), result.organizationDetail(), result.contractDerivedStatus());
    }

    private OrganizationStore store(
            WorkspaceSessionReadback session, String key, OrganizationOverviewTaskReadService.Item detail) {
        OrganizationEntityReadback value =
                entities.requireEntity(ServiceNodeTypes.STORE, session.workspaceUuid(), key, detail.id());
        return StoreWireMapper.store(
                value, detail, contracts.derivedStoreStatus(session.workspaceUuid(), key, detail.id()));
    }

    private OrganizationOverviewTaskReadService.Item scopedReadStore(
            WorkspaceSessionReadback session, String key, UUID storeId) {
        OrganizationOverviewTaskReadService.Item current = reads.store(session.workspaceUuid(), key, storeId);
        user.resolveSelectedProjectScope(session, current.project().id());
        return current;
    }

    private OrganizationOverviewTaskReadService.Item scopedStore(
            WorkspaceSessionReadback session, String key, UUID storeId) {
        OrganizationOverviewTaskReadService.Item current =
                overview.detail(session.workspaceUuid(), key, ServiceNodeTypes.STORE, storeId);
        user.resolveSelectedProjectScope(session, current.project().id());
        return current;
    }

    private static OrganizationEntityReadback requiredStore(
            Map<UUID, OrganizationEntityReadback> stores, UUID storeId) {
        OrganizationEntityReadback value = stores.get(storeId);
        if (value == null) throw new IllegalStateException("paged store disappeared during readback");
        return value;
    }

    private com.catering.v2s.organization.api.OperationsOwnerScopeGrant requireCapability(
            WorkspaceSessionReadback session, String requirementId, UUID projectId) {
        var resolution = capabilityScopes.resolve(
                session,
                requirementId,
                new WorkspaceCapabilityScopeResolver.ServerResolvedResource(ServiceNodeTypes.PROJECT, projectId));
        if (resolution.decision() != WorkspaceCapabilityScopeResolver.Decision.ALLOW)
            throw new WorkspaceCommandAuthorizationService.AuthorizationDeniedException();
        return resolution.ownerScopeGrant(requirementId);
    }

    private com.catering.v2s.organization.api.OperationsOwnerScopeGrant requireStatusTransitionCapability(
            WorkspaceSessionReadback session, String requirementId, UUID projectId) {
        var resolution = capabilityScopes.resolveStatusTransition(
                session,
                requirementId,
                new WorkspaceCapabilityScopeResolver.ServerResolvedResource(ServiceNodeTypes.PROJECT, projectId));
        if (resolution.decision() != WorkspaceCapabilityScopeResolver.Decision.ALLOW)
            throw new WorkspaceCommandAuthorizationService.AuthorizationDeniedException();
        return resolution.ownerScopeGrant(requirementId);
    }

    private WorkspaceSessionReadback context(EdgeRequestContext request, String key, long expected) {
        return sessions.requireWorkspaceReadAtContextVersion(request, key, expected);
    }

    private static AuditActor actor(WorkspaceSessionReadback session) {
        return new AuditActor("WORKSPACE_ACCOUNT", session.accountId(), session.accountDisplayName());
    }

    private static UUID uuid(String value) {
        if (value == null) throw new InvalidEdgeRequestException("identifier is required");
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException exception) {
            throw new InvalidEdgeRequestException("identifier is invalid", exception);
        }
    }

    private static UUID nullableUuid(String value) {
        return value == null ? null : uuid(value);
    }

    private static long required(Long value) {
        if (value == null) throw new InvalidEdgeRequestException("expected version is required");
        return value;
    }

    private static ExtensionSubmission createSubmission(JsonNode values) {
        return ExtensionSubmissionWireMapper.toSubmission(values);
    }

    private static ExtensionSubmission updateSubmission(JsonNode values) {
        return ExtensionSubmissionWireMapper.toSubmission(values);
    }
}
