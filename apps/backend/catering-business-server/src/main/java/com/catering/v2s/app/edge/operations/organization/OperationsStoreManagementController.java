package com.catering.v2s.app.edge.operations.organization;

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
import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.contract.application.ContractTaskReadService;
import com.catering.v2s.organization.api.OrganizationEntityReadback;
import com.catering.v2s.organization.application.BusinessEntityService;
import com.catering.v2s.organization.application.OrganizationOverviewTaskReadService;
import com.catering.v2s.organization.application.StoreCandidateTaskReadService;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import com.catering.v2s.workspace.iam.application.WorkspaceAuthenticationService;
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

/** Operations store capability adapter; immutable store relations are re-read from the organization owner on update. */
@RestController
@RequestMapping("/api/operations/group-workspaces/{groupWorkspaceKey}/organization/stores")
public final class OperationsStoreManagementController {
    private final OperationsSessionResolver sessions; private final BusinessEntityService entities; private final StoreCandidateTaskReadService storeCandidates; private final OrganizationOverviewTaskReadService overview; private final ContractTaskReadService contracts; private final WorkspaceUserService user;
    public OperationsStoreManagementController(OperationsSessionResolver sessions, BusinessEntityService entities, StoreCandidateTaskReadService storeCandidates, OrganizationOverviewTaskReadService overview, ContractTaskReadService contracts, WorkspaceUserService user) { this.sessions = sessions; this.entities = entities; this.storeCandidates = storeCandidates; this.overview = overview; this.contracts = contracts; this.user = user; }

    @PostMapping ResponseEntity<OrganizationStore> create(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @RequestHeader("Idempotency-Key") String idempotencyKey, @RequestBody OrganizationStoreCreateRequest body) {
        WorkspaceSessionReadback session = sessions.requireWorkspace(request, groupWorkspaceKey);
        UUID projectId = user.resolveTaskScope(session, "PROJECT", uuid(body.projectId())).targetId();
        OrganizationEntityReadback value = entities.createStore(session.workspaceUuid(), groupWorkspaceKey, projectId, uuid(body.tenantId()), uuid(body.brandId()), nullableUuid(body.headCompanyId()), body.code(), body.name(), body.notes(), BusinessEntityWireMapper.requestValues(body.extensionValues()), idempotencyKey, actor(session));
        return ResponseEntity.status(HttpStatus.CREATED).body(store(session, groupWorkspaceKey, value));
    }
    @GetMapping OrganizationStorePage list(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @RequestParam long expectedContextVersion, @RequestParam(required = false) String name, @RequestParam(required = false) UUID projectId, @RequestParam(required = false) String code, @RequestParam(required = false) OrganizationStoreStatus status, @RequestParam(required = false) OrganizationStoreSortKey sort, @RequestParam(required = false) OrganizationStoreSortDirection direction, @RequestParam(required = false, defaultValue = "1") int page, @RequestParam(required = false, defaultValue = "20") int pageSize) {
        WorkspaceSessionReadback session = context(request, groupWorkspaceKey, expectedContextVersion);
        if (session.currentAssignmentId() == null || session.visibleDataNodeId() == null) throw new WorkspaceAuthenticationService.SessionInvalidException();
        UUID scopedProjectId = projectId == null ? null : user.resolveTaskScope(session, "PROJECT", projectId).targetId();
        var result = overview.page(session.workspaceUuid(), groupWorkspaceKey, "STORE", new OrganizationOverviewTaskReadService.Query("STORE", name, code, status == null ? null : status.wire(), null, scopedProjectId, null, null, sort == null ? null : sort.name(), direction == null ? null : direction.name(), session.visibleDataNodeId()), page, pageSize);
        List<UUID> storeIds = result.items().stream().map(OrganizationOverviewTaskReadService.Item::id).toList();
        Map<UUID, OrganizationEntityReadback> stores = entities.requireEntities("STORE", session.workspaceUuid(), groupWorkspaceKey, storeIds);
        Map<UUID, String> statuses = contracts.derivedStoreStatuses(session.workspaceUuid(), groupWorkspaceKey, storeIds);
        OrganizationStorePageMetadata metadata = new OrganizationStorePageMetadata(groupWorkspaceKey, null, (long) result.metadata().page(), (long) result.metadata().pageSize(), result.metadata().total(), OrganizationStoreSortKey.valueOf(result.metadata().sort()), OrganizationStoreSortDirection.valueOf(result.metadata().direction()));
        return new OrganizationStorePage(metadata, result.items().stream().map(item -> StoreWireMapper.store(requiredStore(stores, item.id()), item, statuses.get(item.id()))).toList());
    }
    @GetMapping("/{storeId}") OrganizationStore detail(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @PathVariable UUID storeId, @RequestParam long expectedContextVersion) { WorkspaceSessionReadback session = context(request, groupWorkspaceKey, expectedContextVersion); scopedStore(session, groupWorkspaceKey, storeId); return store(session, groupWorkspaceKey, entities.requireEntity("STORE", session.workspaceUuid(), groupWorkspaceKey, storeId)); }
    @GetMapping("/candidates") StoreCandidateTaskReadService.Page candidates(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @RequestParam long expectedContextVersion, @RequestParam(required = false) UUID projectId, @RequestParam(required = false) UUID brandId, @RequestParam(required = false) UUID tenantId) { var session = context(request, groupWorkspaceKey, expectedContextVersion); if (session.currentAssignmentId() == null) throw new WorkspaceAuthenticationService.SessionInvalidException(); return storeCandidates.candidates(session.workspaceUuid(), groupWorkspaceKey, session.currentAssignmentId(), session.visibleDataNodeId(), projectId, brandId, tenantId); }
    @PatchMapping("/{storeId}") OrganizationStore update(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @PathVariable UUID storeId, @RequestHeader("Idempotency-Key") String idempotencyKey, @RequestBody OrganizationStoreUpdateRequest body) { WorkspaceSessionReadback session = sessions.requireWorkspace(request, groupWorkspaceKey); OrganizationOverviewTaskReadService.Item current = scopedStore(session, groupWorkspaceKey, storeId); OrganizationEntityReadback value = entities.updateStore(session.workspaceUuid(), groupWorkspaceKey, storeId, current.project().id(), current.tenant().id(), current.brand().id(), nullableUuid(body.headCompanyId()), current.code(), body.name(), body.notes(), required(body.expectedVersion()), BusinessEntityWireMapper.requestValues(body.extensionValues()), idempotencyKey, actor(session)); return store(session, groupWorkspaceKey, value); }
    @PostMapping("/{storeId}/status") OrganizationStore transitionStatus(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @PathVariable UUID storeId, @RequestHeader("Idempotency-Key") String idempotencyKey, @RequestBody OrganizationStoreStatusRequest body) { WorkspaceSessionReadback session = sessions.requireWorkspace(request, groupWorkspaceKey); scopedStore(session, groupWorkspaceKey, storeId); if (body.targetStatus() == null) throw new InvalidEdgeRequestException("target status is required"); return store(session, groupWorkspaceKey, entities.transitionEntityStatus("STORE", session.workspaceUuid(), groupWorkspaceKey, storeId, body.targetStatus().wire(), required(body.expectedVersion()), idempotencyKey, actor(session))); }
    private OrganizationStore store(WorkspaceSessionReadback session, String key, OrganizationEntityReadback value) { return StoreWireMapper.store(value, overview.detail(session.workspaceUuid(), key, "STORE", value.id()), contracts.derivedStoreStatus(session.workspaceUuid(), key, value.id())); }
    private OrganizationOverviewTaskReadService.Item scopedStore(WorkspaceSessionReadback session, String key, UUID storeId) { OrganizationOverviewTaskReadService.Item current = overview.detail(session.workspaceUuid(), key, "STORE", storeId); user.resolveTaskScope(session, "PROJECT", current.project().id()); return current; }
    private static OrganizationEntityReadback requiredStore(Map<UUID, OrganizationEntityReadback> stores, UUID storeId) { OrganizationEntityReadback value = stores.get(storeId); if (value == null) throw new IllegalStateException("paged store disappeared during readback"); return value; }
    private WorkspaceSessionReadback context(EdgeRequestContext request, String key, long expected) { WorkspaceSessionReadback session = sessions.requireWorkspace(request, key); if (session.contextVersion() != expected) throw new WorkspaceAuthenticationService.SessionInvalidException(); return session; }
    private static AuditActor actor(WorkspaceSessionReadback session) { return new AuditActor("WORKSPACE_ACCOUNT", session.accountId(), session.accountDisplayName()); }
    private static UUID uuid(String value) { if (value == null) throw new InvalidEdgeRequestException("identifier is required"); try { return UUID.fromString(value); } catch (IllegalArgumentException exception) { throw new InvalidEdgeRequestException("identifier is invalid"); } }
    private static UUID nullableUuid(String value) { return value == null ? null : uuid(value); }
    private static long required(Long value) { if (value == null) throw new InvalidEdgeRequestException("expected version is required"); return value; }
}
