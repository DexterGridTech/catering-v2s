package com.catering.v2s.app.edge.operations.organization;

import com.catering.v2s.app.edge.catalog.OrganizationEntityType;
import com.catering.v2s.app.edge.extension.ExtensionSubmissionWireMapper;
import com.catering.v2s.app.edge.generated.backendperformancem1.BackendPerformanceM1CommandExecutionBindings;
import com.catering.v2s.app.edge.generated.wire.Brand;
import com.catering.v2s.app.edge.generated.wire.BrandCreateRequest;
import com.catering.v2s.app.edge.generated.wire.BrandPage;
import com.catering.v2s.app.edge.generated.wire.BrandPageMetadata;
import com.catering.v2s.app.edge.generated.wire.BrandUpdateRequest;
import com.catering.v2s.app.edge.generated.wire.BusinessEntitySortDirection;
import com.catering.v2s.app.edge.generated.wire.BusinessEntitySortKey;
import com.catering.v2s.app.edge.generated.wire.BusinessEntityStatus;
import com.catering.v2s.app.edge.generated.wire.BusinessEntityStatusRequest;
import com.catering.v2s.app.edge.generated.wire.HeadCompany;
import com.catering.v2s.app.edge.generated.wire.HeadCompanyCreateRequest;
import com.catering.v2s.app.edge.generated.wire.HeadCompanyPage;
import com.catering.v2s.app.edge.generated.wire.HeadCompanyPageMetadata;
import com.catering.v2s.app.edge.generated.wire.HeadCompanyUpdateRequest;
import com.catering.v2s.app.edge.generated.wire.Tenant;
import com.catering.v2s.app.edge.generated.wire.TenantCreateRequest;
import com.catering.v2s.app.edge.generated.wire.TenantPage;
import com.catering.v2s.app.edge.generated.wire.TenantPageMetadata;
import com.catering.v2s.app.edge.generated.wire.TenantUpdateRequest;
import com.catering.v2s.app.edge.operations.session.OperationsSessionResolver;
import com.catering.v2s.app.edge.problem.InvalidEdgeRequestException;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.extension.api.ExtensionSubmission;
import com.catering.v2s.organization.api.OperationsBusinessEntityCommandApi;
import com.catering.v2s.organization.api.OrganizationEntityReadback;
import com.catering.v2s.organization.api.OrganizationTaskPathLookup;
import com.catering.v2s.organization.application.BusinessEntityService;
import com.catering.v2s.organization.application.OperationsOrganizationTaskReadService;
import com.catering.v2s.organization.application.operations.CreateOperationsOrganizationBrandOperation;
import com.catering.v2s.organization.application.operations.CreateOperationsOrganizationHeadCompanyOperation;
import com.catering.v2s.organization.application.operations.CreateOperationsOrganizationTenantOperation;
import com.catering.v2s.organization.application.operations.TransitionOperationsOrganizationBrandStatusOperation;
import com.catering.v2s.organization.application.operations.TransitionOperationsOrganizationHeadCompanyStatusOperation;
import com.catering.v2s.organization.application.operations.TransitionOperationsOrganizationTenantStatusOperation;
import com.catering.v2s.organization.application.operations.UpdateOperationsOrganizationBrandOperation;
import com.catering.v2s.organization.application.operations.UpdateOperationsOrganizationHeadCompanyOperation;
import com.catering.v2s.organization.application.operations.UpdateOperationsOrganizationTenantOperation;
import com.catering.v2s.platform.foundation.contract.ServiceNodeTypes;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import com.catering.v2s.workspace.iam.application.WorkspaceCapabilityScopeResolver;
import com.catering.v2s.workspace.iam.application.WorkspaceCommandAuthorizationService;
import java.util.List;
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

/** Operations capability adapter for the three owner-controlled business-entity catalogs. */
@RestController
@RequestMapping("/api/operations/group-workspaces/{groupWorkspaceKey}/organization")
public final class OperationsBusinessEntityController {
    private final OperationsSessionResolver sessions;
    private final BusinessEntityService entities;
    private final WorkspaceCapabilityScopeResolver capabilityScopes;
    private final OrganizationTaskPathLookup taskPaths;
    private final OperationsOrganizationTaskReadService reads;
    private final CreateOperationsOrganizationBrandOperation createBrandOperation;
    private final UpdateOperationsOrganizationBrandOperation updateBrandOperation;
    private final CreateOperationsOrganizationTenantOperation createTenantOperation;
    private final UpdateOperationsOrganizationTenantOperation updateTenantOperation;
    private final CreateOperationsOrganizationHeadCompanyOperation createHeadCompanyOperation;
    private final UpdateOperationsOrganizationHeadCompanyOperation updateHeadCompanyOperation;
    private final TransitionOperationsOrganizationHeadCompanyStatusOperation transitionHeadCompanyStatusOperation;
    private final TransitionOperationsOrganizationBrandStatusOperation transitionBrandStatusOperation;
    private final TransitionOperationsOrganizationTenantStatusOperation transitionTenantStatusOperation;
    private final BackendPerformanceM1CommandExecutionBindings m1Bindings;

    /** Legacy focused-test constructor; production uses the explicit GET-only task reader. */
    public OperationsBusinessEntityController(
            OperationsSessionResolver sessions,
            BusinessEntityService entities,
            WorkspaceCapabilityScopeResolver capabilityScopes) {
        this(
                sessions,
                entities,
                capabilityScopes,
                null,
                new OperationsOrganizationTaskReadService(entities, null),
                new CreateOperationsOrganizationBrandOperation(entities),
                new UpdateOperationsOrganizationBrandOperation(entities),
                new CreateOperationsOrganizationTenantOperation(entities),
                new UpdateOperationsOrganizationTenantOperation(entities),
                new CreateOperationsOrganizationHeadCompanyOperation(entities),
                new UpdateOperationsOrganizationHeadCompanyOperation(entities),
                new TransitionOperationsOrganizationHeadCompanyStatusOperation(entities),
                new TransitionOperationsOrganizationBrandStatusOperation(entities),
                new TransitionOperationsOrganizationTenantStatusOperation(entities),
                BackendPerformanceM1CommandExecutionBindings.forBusinessEntity(
                        new CreateOperationsOrganizationBrandOperation(entities),
                        new UpdateOperationsOrganizationBrandOperation(entities),
                        new CreateOperationsOrganizationTenantOperation(entities),
                        new UpdateOperationsOrganizationTenantOperation(entities),
                        new CreateOperationsOrganizationHeadCompanyOperation(entities),
                        new UpdateOperationsOrganizationHeadCompanyOperation(entities),
                        new TransitionOperationsOrganizationHeadCompanyStatusOperation(entities),
                        new TransitionOperationsOrganizationBrandStatusOperation(entities),
                        new TransitionOperationsOrganizationTenantStatusOperation(entities)));
    }

    @org.springframework.beans.factory.annotation.Autowired
    public OperationsBusinessEntityController(
            OperationsSessionResolver sessions,
            BusinessEntityService entities,
            WorkspaceCapabilityScopeResolver capabilityScopes,
            OrganizationTaskPathLookup taskPaths,
            OperationsOrganizationTaskReadService reads,
            CreateOperationsOrganizationBrandOperation createBrandOperation,
            UpdateOperationsOrganizationBrandOperation updateBrandOperation,
            CreateOperationsOrganizationTenantOperation createTenantOperation,
            UpdateOperationsOrganizationTenantOperation updateTenantOperation,
            CreateOperationsOrganizationHeadCompanyOperation createHeadCompanyOperation,
            UpdateOperationsOrganizationHeadCompanyOperation updateHeadCompanyOperation,
            TransitionOperationsOrganizationHeadCompanyStatusOperation transitionHeadCompanyStatusOperation,
            TransitionOperationsOrganizationBrandStatusOperation transitionBrandStatusOperation,
            TransitionOperationsOrganizationTenantStatusOperation transitionTenantStatusOperation,
            BackendPerformanceM1CommandExecutionBindings m1Bindings) {
        this.sessions = sessions;
        this.entities = entities;
        this.capabilityScopes = capabilityScopes;
        this.taskPaths = taskPaths;
        this.reads = reads;
        this.createBrandOperation = createBrandOperation;
        this.updateBrandOperation = updateBrandOperation;
        this.createTenantOperation = createTenantOperation;
        this.updateTenantOperation = updateTenantOperation;
        this.createHeadCompanyOperation = createHeadCompanyOperation;
        this.updateHeadCompanyOperation = updateHeadCompanyOperation;
        this.transitionHeadCompanyStatusOperation = transitionHeadCompanyStatusOperation;
        this.transitionBrandStatusOperation = transitionBrandStatusOperation;
        this.transitionTenantStatusOperation = transitionTenantStatusOperation;
        this.m1Bindings = m1Bindings;
    }

    @PostMapping("/brands")
    ResponseEntity<Brand> createBrand(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody BrandCreateRequest body) {
        WorkspaceSessionReadback session = sessions.requireWorkspaceCommand(request, groupWorkspaceKey);
        OrganizationTaskPathLookup.TaskPath groupPath = groupTaskPath(session, groupWorkspaceKey);
        OrganizationEntityReadback result = m1Bindings.bindCreateOperationsOrganizationBrand(
                new OperationsBusinessEntityCommandApi.BrandCreateCommand(
                        session.workspaceUuid(),
                        groupWorkspaceKey,
                        body.code(),
                        body.name(),
                        body.alias(),
                        body.remark(),
                        brandCreateSubmission(body.extensionValues()),
                        idempotencyKey,
                        actor(session),
                        requireCapability(session, "REQ_CREATE_OPERATIONS_ORGANIZATION_BRAND", groupPath)));
        return ResponseEntity.status(HttpStatus.CREATED).body(BusinessEntityWireMapper.brand(result));
    }

    @PostMapping("/tenants")
    ResponseEntity<Tenant> createTenant(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody TenantCreateRequest body) {
        WorkspaceSessionReadback session = sessions.requireWorkspaceCommand(request, groupWorkspaceKey);
        OrganizationTaskPathLookup.TaskPath groupPath = groupTaskPath(session, groupWorkspaceKey);
        OrganizationEntityReadback result = m1Bindings.bindCreateOperationsOrganizationTenant(
                new OperationsBusinessEntityCommandApi.TenantCreateCommand(
                        session.workspaceUuid(),
                        groupWorkspaceKey,
                        body.code(),
                        body.name(),
                        body.legalName(),
                        body.unifiedSocialCreditCode(),
                        body.remark(),
                        tenantCreateSubmission(body.extensionValues()),
                        idempotencyKey,
                        actor(session),
                        requireCapability(session, "REQ_CREATE_OPERATIONS_ORGANIZATION_TENANT", groupPath)));
        return ResponseEntity.status(HttpStatus.CREATED).body(BusinessEntityWireMapper.tenant(result));
    }

    @PostMapping("/head-companies")
    ResponseEntity<HeadCompany> createHeadCompany(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody HeadCompanyCreateRequest body) {
        WorkspaceSessionReadback session = sessions.requireWorkspaceCommand(request, groupWorkspaceKey);
        OrganizationTaskPathLookup.TaskPath groupPath = groupTaskPath(session, groupWorkspaceKey);
        var result = m1Bindings.bindCreateOperationsOrganizationHeadCompany(
                new OperationsBusinessEntityCommandApi.HeadCompanyCreateCommand(
                        session.workspaceUuid(),
                        groupWorkspaceKey,
                        body.code(),
                        body.name(),
                        body.legalName(),
                        body.unifiedSocialCreditCode(),
                        body.remark(),
                        headCompanyCreateSubmission(body.extensionValues()),
                        idempotencyKey,
                        actor(session),
                        requireCapability(session, "REQ_CREATE_OPERATIONS_ORGANIZATION_HEAD_COMPANY", groupPath)));
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(BusinessEntityWireMapper.headCompany(result.entity(), result.authorizedBrands()));
    }

    @GetMapping("/brands")
    BrandPage brands(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @RequestParam long expectedContextVersion,
            @RequestParam(required = false) String queryText,
            @RequestParam(required = false) BusinessEntityStatus status,
            @RequestParam(required = false, defaultValue = "NAME") String sort,
            @RequestParam(required = false, defaultValue = "ASC") String direction,
            @RequestParam(required = false, defaultValue = "1") int page,
            @RequestParam(required = false, defaultValue = "20") int pageSize,
            @RequestParam(required = false) String extensionFilters,
            @RequestParam(required = false) String definitionRevision) {
        WorkspaceSessionReadback session = context(request, groupWorkspaceKey, expectedContextVersion);
        BusinessEntityService.BrandPage values = reads.brands(
                session.workspaceUuid(),
                groupWorkspaceKey,
                queryText,
                status == null ? null : status.wire(),
                sort,
                direction,
                page,
                pageSize,
                extensionFilters,
                definitionRevision);
        return new BrandPage(
                new BrandPageMetadata(
                        groupWorkspaceKey,
                        (long) values.page(),
                        (long) values.pageSize(),
                        (long) values.total(),
                        sortKey(sort),
                        sortDirection(direction),
                        values.definitionRevision()),
                values.items().stream().map(BusinessEntityWireMapper::brand).toList());
    }

    @GetMapping("/tenants")
    TenantPage tenants(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @RequestParam long expectedContextVersion,
            @RequestParam(required = false) String name,
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String legalName,
            @RequestParam(required = false) String unifiedSocialCreditCode,
            @RequestParam(required = false) BusinessEntityStatus status,
            @RequestParam(required = false, defaultValue = "NAME") String sort,
            @RequestParam(required = false, defaultValue = "ASC") String direction,
            @RequestParam(required = false, defaultValue = "1") int page,
            @RequestParam(required = false, defaultValue = "20") int pageSize,
            @RequestParam(required = false) String extensionFilters,
            @RequestParam(required = false) String definitionRevision) {
        WorkspaceSessionReadback session = context(request, groupWorkspaceKey, expectedContextVersion);
        BusinessEntityService.EntityPage values = reads.tenants(
                session.workspaceUuid(),
                groupWorkspaceKey,
                name,
                code,
                legalName,
                unifiedSocialCreditCode,
                status == null ? null : status.wire(),
                sort,
                direction,
                page,
                pageSize,
                extensionFilters,
                definitionRevision);
        return new TenantPage(
                new TenantPageMetadata(
                        groupWorkspaceKey,
                        (long) values.page(),
                        (long) values.pageSize(),
                        (long) values.total(),
                        sortKey(sort),
                        sortDirection(direction),
                        values.definitionRevision()),
                values.items().stream().map(BusinessEntityWireMapper::tenant).toList());
    }

    @GetMapping("/head-companies")
    HeadCompanyPage headCompanies(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @RequestParam long expectedContextVersion,
            @RequestParam(required = false) String name,
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String legalName,
            @RequestParam(required = false) String unifiedSocialCreditCode,
            @RequestParam(required = false) BusinessEntityStatus status,
            @RequestParam(required = false, defaultValue = "NAME") String sort,
            @RequestParam(required = false, defaultValue = "ASC") String direction,
            @RequestParam(required = false, defaultValue = "1") int page,
            @RequestParam(required = false, defaultValue = "20") int pageSize,
            @RequestParam(required = false) String extensionFilters,
            @RequestParam(required = false) String definitionRevision) {
        WorkspaceSessionReadback session = context(request, groupWorkspaceKey, expectedContextVersion);
        BusinessEntityService.EntityPage values = reads.headCompanies(
                session.workspaceUuid(),
                groupWorkspaceKey,
                name,
                code,
                legalName,
                unifiedSocialCreditCode,
                status == null ? null : status.wire(),
                sort,
                direction,
                page,
                pageSize,
                extensionFilters,
                definitionRevision);
        return new HeadCompanyPage(
                new HeadCompanyPageMetadata(
                        groupWorkspaceKey,
                        (long) values.page(),
                        (long) values.pageSize(),
                        (long) values.total(),
                        sortKey(sort),
                        sortDirection(direction),
                        values.definitionRevision()),
                values.items().stream()
                        .map(BusinessEntityWireMapper::headCompanySummary)
                        .toList());
    }

    @GetMapping("/brands/{brandId}")
    Brand brand(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID brandId,
            @RequestParam long expectedContextVersion) {
        WorkspaceSessionReadback session = context(request, groupWorkspaceKey, expectedContextVersion);
        return BusinessEntityWireMapper.brand(reads.brand(session.workspaceUuid(), groupWorkspaceKey, brandId));
    }

    @GetMapping("/tenants/{tenantId}")
    Tenant tenant(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID tenantId,
            @RequestParam long expectedContextVersion) {
        WorkspaceSessionReadback session = context(request, groupWorkspaceKey, expectedContextVersion);
        return BusinessEntityWireMapper.tenant(reads.tenant(session.workspaceUuid(), groupWorkspaceKey, tenantId));
    }

    @GetMapping("/head-companies/{headCompanyId}")
    HeadCompany headCompany(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID headCompanyId,
            @RequestParam long expectedContextVersion) {
        WorkspaceSessionReadback session = context(request, groupWorkspaceKey, expectedContextVersion);
        return headCompany(reads.headCompany(session.workspaceUuid(), groupWorkspaceKey, headCompanyId));
    }

    @PatchMapping("/brands/{brandId}")
    Brand updateBrand(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID brandId,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody BrandUpdateRequest body) {
        WorkspaceSessionReadback session = sessions.requireWorkspaceCommand(request, groupWorkspaceKey);
        OrganizationTaskPathLookup.TaskPath groupPath = groupTaskPath(session, groupWorkspaceKey);
        return BusinessEntityWireMapper.brand(m1Bindings.bindUpdateOperationsOrganizationBrand(
                new OperationsBusinessEntityCommandApi.BrandUpdateCommand(
                        session.workspaceUuid(),
                        groupWorkspaceKey,
                        brandId,
                        body.code(),
                        body.name(),
                        body.alias(),
                        body.remark(),
                        required(body.expectedVersion()),
                        brandUpdateSubmission(body.extensionValues()),
                        idempotencyKey,
                        actor(session),
                        requireCapability(session, "REQ_UPDATE_OPERATIONS_ORGANIZATION_BRAND", groupPath))));
    }

    @PatchMapping("/tenants/{tenantId}")
    Tenant updateTenant(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID tenantId,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody TenantUpdateRequest body) {
        WorkspaceSessionReadback session = sessions.requireWorkspaceCommand(request, groupWorkspaceKey);
        OrganizationTaskPathLookup.TaskPath groupPath = groupTaskPath(session, groupWorkspaceKey);
        return BusinessEntityWireMapper.tenant(m1Bindings.bindUpdateOperationsOrganizationTenant(
                new OperationsBusinessEntityCommandApi.TenantUpdateCommand(
                        session.workspaceUuid(),
                        groupWorkspaceKey,
                        tenantId,
                        body.code(),
                        body.name(),
                        body.legalName(),
                        body.unifiedSocialCreditCode(),
                        body.remark(),
                        required(body.expectedVersion()),
                        tenantUpdateSubmission(body.extensionValues()),
                        idempotencyKey,
                        actor(session),
                        requireCapability(session, "REQ_UPDATE_OPERATIONS_ORGANIZATION_TENANT", groupPath))));
    }

    @PatchMapping("/head-companies/{headCompanyId}")
    HeadCompany updateHeadCompany(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID headCompanyId,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody HeadCompanyUpdateRequest body) {
        WorkspaceSessionReadback session = sessions.requireWorkspaceCommand(request, groupWorkspaceKey);
        var result = m1Bindings.bindUpdateOperationsOrganizationHeadCompany(
                new OperationsBusinessEntityCommandApi.HeadCompanyUpdateCommand(
                        session.workspaceUuid(),
                        groupWorkspaceKey,
                        headCompanyId,
                        body.code(),
                        body.name(),
                        body.legalName(),
                        body.unifiedSocialCreditCode(),
                        body.remark(),
                        required(body.expectedVersion()),
                        headCompanyUpdateSubmission(body.extensionValues()),
                        idempotencyKey,
                        actor(session),
                        requireCapability(
                                session,
                                "REQ_UPDATE_OPERATIONS_ORGANIZATION_HEAD_COMPANY",
                                ServiceNodeTypes.HEAD_COMPANY,
                                headCompanyId)));
        return BusinessEntityWireMapper.headCompany(result.entity(), result.authorizedBrands());
    }

    @PostMapping("/brands/{brandId}/status")
    Brand brandStatus(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID brandId,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody BusinessEntityStatusRequest body) {
        if (body.targetStatus() == null) throw new InvalidEdgeRequestException("target status is required");
        WorkspaceSessionReadback session = sessions.requireWorkspaceCommand(request, groupWorkspaceKey);
        return BusinessEntityWireMapper.brand(m1Bindings.bindTransitionOperationsOrganizationBrandStatus(
                new OperationsBusinessEntityCommandApi.BrandStatusCommand(
                        session.workspaceUuid(),
                        groupWorkspaceKey,
                        brandId,
                        body.targetStatus().wire(),
                        required(body.expectedVersion()),
                        idempotencyKey,
                        actor(session),
                        requireStatusTransitionCapability(
                                session,
                                "REQ_TRANSITION_OPERATIONS_ORGANIZATION_BRAND_STATUS",
                                ServiceNodeTypes.GROUP,
                                entities.requireCommercialGroupId(session.workspaceUuid(), groupWorkspaceKey)))));
    }

    @PostMapping("/tenants/{tenantId}/status")
    Tenant tenantStatus(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID tenantId,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody BusinessEntityStatusRequest body) {
        if (body.targetStatus() == null) throw new InvalidEdgeRequestException("target status is required");
        WorkspaceSessionReadback session = sessions.requireWorkspaceCommand(request, groupWorkspaceKey);
        return BusinessEntityWireMapper.tenant(m1Bindings.bindTransitionOperationsOrganizationTenantStatus(
                new OperationsBusinessEntityCommandApi.TenantStatusCommand(
                        session.workspaceUuid(),
                        groupWorkspaceKey,
                        tenantId,
                        body.targetStatus().wire(),
                        required(body.expectedVersion()),
                        idempotencyKey,
                        actor(session),
                        requireStatusTransitionCapability(
                                session,
                                "REQ_TRANSITION_OPERATIONS_ORGANIZATION_TENANT_STATUS",
                                ServiceNodeTypes.GROUP,
                                entities.requireCommercialGroupId(session.workspaceUuid(), groupWorkspaceKey)))));
    }

    @PostMapping("/head-companies/{headCompanyId}/status")
    HeadCompany headCompanyStatus(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID headCompanyId,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody BusinessEntityStatusRequest body) {
        if (body.targetStatus() == null) throw new InvalidEdgeRequestException("target status is required");
        WorkspaceSessionReadback session = sessions.requireWorkspaceCommand(request, groupWorkspaceKey);
        var result = m1Bindings.bindTransitionOperationsOrganizationHeadCompanyStatus(
                new OperationsBusinessEntityCommandApi.HeadCompanyStatusCommand(
                        session.workspaceUuid(),
                        groupWorkspaceKey,
                        headCompanyId,
                        body.targetStatus().wire(),
                        required(body.expectedVersion()),
                        idempotencyKey,
                        actor(session),
                        requireStatusTransitionCapability(
                                session,
                                "REQ_TRANSITION_OPERATIONS_ORGANIZATION_HEAD_COMPANY_STATUS",
                                ServiceNodeTypes.HEAD_COMPANY,
                                headCompanyId)));
        return BusinessEntityWireMapper.headCompany(result.entity(), result.authorizedBrands());
    }

    private OrganizationEntityReadback transition(
            WorkspaceSessionReadback session,
            String key,
            OrganizationEntityType type,
            UUID id,
            BusinessEntityStatusRequest body,
            String idempotencyKey) {
        if (body.targetStatus() == null) throw new InvalidEdgeRequestException("target status is required");
        String targetType =
                type == OrganizationEntityType.HEAD_COMPANY ? ServiceNodeTypes.HEAD_COMPANY : ServiceNodeTypes.GROUP;
        UUID targetId = type == OrganizationEntityType.HEAD_COMPANY
                ? id
                : entities.requireCommercialGroupId(session.workspaceUuid(), key);
        return entities.transitionEntityStatus(
                type.wire(),
                session.workspaceUuid(),
                key,
                id,
                body.targetStatus().wire(),
                required(body.expectedVersion()),
                idempotencyKey,
                actor(session),
                requireStatusTransitionCapability(session, statusRequirement(type), targetType, targetId));
    }

    private static AuditActor actor(WorkspaceSessionReadback session) {
        return new AuditActor("WORKSPACE_ACCOUNT", session.accountId(), session.accountDisplayName());
    }

    private HeadCompany headCompany(OperationsOrganizationTaskReadService.HeadCompany value) {
        return BusinessEntityWireMapper.headCompany(value.entity(), value.authorizedBrands());
    }

    private WorkspaceSessionReadback context(EdgeRequestContext request, String key, long expectedContextVersion) {
        return sessions.requireWorkspaceReadAtContextVersion(request, key, expectedContextVersion);
    }

    private OrganizationTaskPathLookup.TaskPath groupTaskPath(
            WorkspaceSessionReadback session, String groupWorkspaceKey) {
        if (taskPaths != null) return taskPaths.requireGroupTaskPath(session.workspaceUuid(), groupWorkspaceKey);
        UUID groupId = entities.requireCommercialGroupId(session.workspaceUuid(), groupWorkspaceKey);
        return new OrganizationTaskPathLookup.TaskPath(ServiceNodeTypes.GROUP, groupId, List.of(groupId), "");
    }

    private com.catering.v2s.organization.api.OperationsOwnerScopeGrant requireCapability(
            WorkspaceSessionReadback session, String requirementId, OrganizationTaskPathLookup.TaskPath groupPath) {
        var resolution = capabilityScopes.resolveUsingResolvedTaskPath(
                session,
                requirementId,
                new WorkspaceCapabilityScopeResolver.ServerResolvedResource(
                        groupPath.targetType(), groupPath.targetId()),
                groupPath);
        if (resolution.decision() != WorkspaceCapabilityScopeResolver.Decision.ALLOW)
            throw new WorkspaceCommandAuthorizationService.AuthorizationDeniedException();
        return resolution.ownerScopeGrant(requirementId);
    }

    private com.catering.v2s.organization.api.OperationsOwnerScopeGrant requireCapability(
            WorkspaceSessionReadback session, String requirementId, String targetType, UUID targetId) {
        var resolution = capabilityScopes.resolve(
                session,
                requirementId,
                new WorkspaceCapabilityScopeResolver.ServerResolvedResource(targetType, targetId));
        if (resolution.decision() != WorkspaceCapabilityScopeResolver.Decision.ALLOW)
            throw new WorkspaceCommandAuthorizationService.AuthorizationDeniedException();
        return resolution.ownerScopeGrant(requirementId);
    }

    private com.catering.v2s.organization.api.OperationsOwnerScopeGrant requireStatusTransitionCapability(
            WorkspaceSessionReadback session, String requirementId, String targetType, UUID targetId) {
        var resolution = capabilityScopes.resolveStatusTransition(
                session,
                requirementId,
                new WorkspaceCapabilityScopeResolver.ServerResolvedResource(targetType, targetId));
        if (resolution.decision() != WorkspaceCapabilityScopeResolver.Decision.ALLOW)
            throw new WorkspaceCommandAuthorizationService.AuthorizationDeniedException();
        return resolution.ownerScopeGrant(requirementId);
    }

    private static String statusRequirement(OrganizationEntityType type) {
        return switch (type) {
            case BRAND -> "REQ_TRANSITION_OPERATIONS_ORGANIZATION_BRAND_STATUS";
            case TENANT -> "REQ_TRANSITION_OPERATIONS_ORGANIZATION_TENANT_STATUS";
            case HEAD_COMPANY -> "REQ_TRANSITION_OPERATIONS_ORGANIZATION_HEAD_COMPANY_STATUS";
            default -> throw new InvalidEdgeRequestException("unsupported entity type");
        };
    }

    private static long required(Long value) {
        if (value == null) throw new InvalidEdgeRequestException("expected version is required");
        return value;
    }

    private static ExtensionSubmission brandCreateSubmission(JsonNode values) {
        return ExtensionSubmissionWireMapper.toSubmission(values);
    }

    private static ExtensionSubmission brandUpdateSubmission(JsonNode values) {
        return ExtensionSubmissionWireMapper.toSubmission(values);
    }

    private static ExtensionSubmission tenantCreateSubmission(JsonNode values) {
        return ExtensionSubmissionWireMapper.toSubmission(values);
    }

    private static ExtensionSubmission tenantUpdateSubmission(JsonNode values) {
        return ExtensionSubmissionWireMapper.toSubmission(values);
    }

    private static ExtensionSubmission headCompanyCreateSubmission(JsonNode values) {
        return ExtensionSubmissionWireMapper.toSubmission(values);
    }

    private static ExtensionSubmission headCompanyUpdateSubmission(JsonNode values) {
        return ExtensionSubmissionWireMapper.toSubmission(values);
    }

    private static ExtensionSubmission submission(List<ExtensionSubmission.ExtensionFieldValue> values) {
        return new ExtensionSubmission(values);
    }

    private static BusinessEntitySortKey sortKey(String value) {
        try {
            return BusinessEntitySortKey.valueOf(value);
        } catch (RuntimeException exception) {
            throw new InvalidEdgeRequestException("invalid sort", exception);
        }
    }

    private static BusinessEntitySortDirection sortDirection(String value) {
        try {
            return BusinessEntitySortDirection.valueOf(value);
        } catch (RuntimeException exception) {
            throw new InvalidEdgeRequestException("invalid direction", exception);
        }
    }
}
