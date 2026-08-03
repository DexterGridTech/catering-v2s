package com.catering.v2s.app.edge.operations.organization;

import com.catering.v2s.app.edge.catalog.OrganizationEntityType;
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
import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.organization.api.OrganizationEntityReadback;
import com.catering.v2s.organization.application.BusinessEntityService;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import com.catering.v2s.workspace.iam.application.WorkspaceAuthenticationService;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Operations capability adapter for the three owner-controlled business-entity catalogs. */
@RestController
@RequestMapping("/api/operations/group-workspaces/{groupWorkspaceKey}/organization")
public final class OperationsBusinessEntityController {
    private final OperationsSessionResolver sessions;
    private final BusinessEntityService entities;

    public OperationsBusinessEntityController(OperationsSessionResolver sessions, BusinessEntityService entities) {
        this.sessions = sessions;
        this.entities = entities;
    }

    @PostMapping("/brands")
    ResponseEntity<Brand> createBrand(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @RequestHeader("Idempotency-Key") String idempotencyKey, @RequestBody BrandCreateRequest body) {
        WorkspaceSessionReadback session = sessions.requireWorkspace(request, groupWorkspaceKey);
        OrganizationEntityReadback result = create(session, groupWorkspaceKey, OrganizationEntityType.BRAND, body.code(), body.name(), null, null, body.alias(), body.remark(), BusinessEntityWireMapper.requestValues(body.extensionValues()), idempotencyKey);
        return ResponseEntity.status(HttpStatus.CREATED).body(BusinessEntityWireMapper.brand(result));
    }

    @PostMapping("/tenants")
    ResponseEntity<Tenant> createTenant(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @RequestHeader("Idempotency-Key") String idempotencyKey, @RequestBody TenantCreateRequest body) {
        WorkspaceSessionReadback session = sessions.requireWorkspace(request, groupWorkspaceKey);
        OrganizationEntityReadback result = create(session, groupWorkspaceKey, OrganizationEntityType.TENANT, body.code(), body.name(), body.legalName(), body.unifiedSocialCreditCode(), null, body.remark(), BusinessEntityWireMapper.requestValues(body.extensionValues()), idempotencyKey);
        return ResponseEntity.status(HttpStatus.CREATED).body(BusinessEntityWireMapper.tenant(result));
    }

    @PostMapping("/head-companies")
    ResponseEntity<HeadCompany> createHeadCompany(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @RequestHeader("Idempotency-Key") String idempotencyKey, @RequestBody HeadCompanyCreateRequest body) {
        WorkspaceSessionReadback session = sessions.requireWorkspace(request, groupWorkspaceKey);
        OrganizationEntityReadback result = create(session, groupWorkspaceKey, OrganizationEntityType.HEAD_COMPANY, body.code(), body.name(), body.legalName(), body.unifiedSocialCreditCode(), null, body.remark(), BusinessEntityWireMapper.requestValues(body.extensionValues()), idempotencyKey);
        return ResponseEntity.status(HttpStatus.CREATED).body(headCompany(session, groupWorkspaceKey, result));
    }

    @GetMapping("/brands")
    BrandPage brands(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @RequestParam long expectedContextVersion, @RequestParam(required = false) String name, @RequestParam(required = false) String code, @RequestParam(required = false) BusinessEntityStatus status, @RequestParam(required = false, defaultValue = "NAME") String sort, @RequestParam(required = false, defaultValue = "ASC") String direction, @RequestParam(required = false, defaultValue = "1") int page, @RequestParam(required = false, defaultValue = "20") int pageSize) {
        WorkspaceSessionReadback session = context(request, groupWorkspaceKey, expectedContextVersion);
        BusinessEntityService.BrandPage values = entities.pageBrands(session.workspaceUuid(), groupWorkspaceKey, name, code, status == null ? null : status.wire(), sort, direction, page, pageSize);
        return new BrandPage(new BrandPageMetadata(groupWorkspaceKey, (long) values.page(), (long) values.pageSize(), (long) values.total(), sortKey(sort), sortDirection(direction)), values.items().stream().map(BusinessEntityWireMapper::brand).toList());
    }

    @GetMapping("/tenants")
    TenantPage tenants(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @RequestParam long expectedContextVersion, @RequestParam(required = false) String name, @RequestParam(required = false) String code, @RequestParam(required = false) BusinessEntityStatus status, @RequestParam(required = false, defaultValue = "NAME") String sort, @RequestParam(required = false, defaultValue = "ASC") String direction, @RequestParam(required = false, defaultValue = "1") int page, @RequestParam(required = false, defaultValue = "20") int pageSize) {
        WorkspaceSessionReadback session = context(request, groupWorkspaceKey, expectedContextVersion);
        BusinessEntityService.EntityPage values = entities.pageEntities(OrganizationEntityType.TENANT.wire(), session.workspaceUuid(), groupWorkspaceKey, name, code, status == null ? null : status.wire(), sort, direction, page, pageSize);
        return new TenantPage(new TenantPageMetadata(groupWorkspaceKey, (long) values.page(), (long) values.pageSize(), (long) values.total(), sortKey(sort), sortDirection(direction)), values.items().stream().map(BusinessEntityWireMapper::tenant).toList());
    }

    @GetMapping("/head-companies")
    HeadCompanyPage headCompanies(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @RequestParam long expectedContextVersion, @RequestParam(required = false) String name, @RequestParam(required = false) String code, @RequestParam(required = false) BusinessEntityStatus status, @RequestParam(required = false, defaultValue = "NAME") String sort, @RequestParam(required = false, defaultValue = "ASC") String direction, @RequestParam(required = false, defaultValue = "1") int page, @RequestParam(required = false, defaultValue = "20") int pageSize) {
        WorkspaceSessionReadback session = context(request, groupWorkspaceKey, expectedContextVersion);
        BusinessEntityService.EntityPage values = entities.pageEntities(OrganizationEntityType.HEAD_COMPANY.wire(), session.workspaceUuid(), groupWorkspaceKey, name, code, status == null ? null : status.wire(), sort, direction, page, pageSize);
        Map<UUID, java.util.List<OrganizationEntityReadback>> brandsByHeadCompanyId = values.items().isEmpty() ? Map.of() : entities.authorizedBrandsByHeadCompanyIds(session.workspaceUuid(), groupWorkspaceKey, values.items().stream().map(OrganizationEntityReadback::id).toList());
        return new HeadCompanyPage(new HeadCompanyPageMetadata(groupWorkspaceKey, (long) values.page(), (long) values.pageSize(), (long) values.total(), sortKey(sort), sortDirection(direction)), values.items().stream().map(value -> headCompany(value, brandsByHeadCompanyId.get(value.id()))).toList());
    }

    @GetMapping("/brands/{brandId}") Brand brand(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @PathVariable UUID brandId, @RequestParam long expectedContextVersion) { WorkspaceSessionReadback session = context(request, groupWorkspaceKey, expectedContextVersion); return BusinessEntityWireMapper.brand(require(session, groupWorkspaceKey, OrganizationEntityType.BRAND, brandId)); }
    @GetMapping("/tenants/{tenantId}") Tenant tenant(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @PathVariable UUID tenantId, @RequestParam long expectedContextVersion) { WorkspaceSessionReadback session = context(request, groupWorkspaceKey, expectedContextVersion); return BusinessEntityWireMapper.tenant(require(session, groupWorkspaceKey, OrganizationEntityType.TENANT, tenantId)); }
    @GetMapping("/head-companies/{headCompanyId}") HeadCompany headCompany(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @PathVariable UUID headCompanyId, @RequestParam long expectedContextVersion) { WorkspaceSessionReadback session = context(request, groupWorkspaceKey, expectedContextVersion); return headCompany(session, groupWorkspaceKey, require(session, groupWorkspaceKey, OrganizationEntityType.HEAD_COMPANY, headCompanyId)); }

    @PatchMapping("/brands/{brandId}") Brand updateBrand(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @PathVariable UUID brandId, @RequestHeader("Idempotency-Key") String idempotencyKey, @RequestBody BrandUpdateRequest body) { WorkspaceSessionReadback session = context(request, groupWorkspaceKey, required(body.expectedContextVersion())); return BusinessEntityWireMapper.brand(update(session, groupWorkspaceKey, OrganizationEntityType.BRAND, brandId, body.code(), body.name(), null, null, body.alias(), body.remark(), required(body.expectedVersion()), BusinessEntityWireMapper.requestValues(body.extensionValues()), idempotencyKey)); }
    @PatchMapping("/tenants/{tenantId}") Tenant updateTenant(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @PathVariable UUID tenantId, @RequestHeader("Idempotency-Key") String idempotencyKey, @RequestBody TenantUpdateRequest body) { WorkspaceSessionReadback session = context(request, groupWorkspaceKey, required(body.expectedContextVersion())); return BusinessEntityWireMapper.tenant(update(session, groupWorkspaceKey, OrganizationEntityType.TENANT, tenantId, body.code(), body.name(), body.legalName(), body.unifiedSocialCreditCode(), null, body.remark(), required(body.expectedVersion()), BusinessEntityWireMapper.requestValues(body.extensionValues()), idempotencyKey)); }
    @PatchMapping("/head-companies/{headCompanyId}") HeadCompany updateHeadCompany(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @PathVariable UUID headCompanyId, @RequestHeader("Idempotency-Key") String idempotencyKey, @RequestBody HeadCompanyUpdateRequest body) { WorkspaceSessionReadback session = context(request, groupWorkspaceKey, required(body.expectedContextVersion())); OrganizationEntityReadback result = update(session, groupWorkspaceKey, OrganizationEntityType.HEAD_COMPANY, headCompanyId, body.code(), body.name(), body.legalName(), body.unifiedSocialCreditCode(), null, body.remark(), required(body.expectedVersion()), BusinessEntityWireMapper.requestValues(body.extensionValues()), idempotencyKey); return headCompany(session, groupWorkspaceKey, result); }

    @PostMapping("/brands/{brandId}/status") Brand brandStatus(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @PathVariable UUID brandId, @RequestHeader("Idempotency-Key") String idempotencyKey, @RequestBody BusinessEntityStatusRequest body) { WorkspaceSessionReadback session = sessions.requireWorkspace(request, groupWorkspaceKey); return BusinessEntityWireMapper.brand(transition(session, groupWorkspaceKey, OrganizationEntityType.BRAND, brandId, body, idempotencyKey)); }
    @PostMapping("/tenants/{tenantId}/status") Tenant tenantStatus(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @PathVariable UUID tenantId, @RequestHeader("Idempotency-Key") String idempotencyKey, @RequestBody BusinessEntityStatusRequest body) { WorkspaceSessionReadback session = sessions.requireWorkspace(request, groupWorkspaceKey); return BusinessEntityWireMapper.tenant(transition(session, groupWorkspaceKey, OrganizationEntityType.TENANT, tenantId, body, idempotencyKey)); }
    @PostMapping("/head-companies/{headCompanyId}/status") HeadCompany headCompanyStatus(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @PathVariable UUID headCompanyId, @RequestHeader("Idempotency-Key") String idempotencyKey, @RequestBody BusinessEntityStatusRequest body) { WorkspaceSessionReadback session = sessions.requireWorkspace(request, groupWorkspaceKey); return headCompany(session, groupWorkspaceKey, transition(session, groupWorkspaceKey, OrganizationEntityType.HEAD_COMPANY, headCompanyId, body, idempotencyKey)); }

    private OrganizationEntityReadback create(WorkspaceSessionReadback session, String key, OrganizationEntityType type, String code, String name, String legalName, String creditCode, String alias, String remark, Map<String, String> extensionValues, String idempotencyKey) { return entities.createEntity(type.wire(), session.workspaceUuid(), key, code, name, legalName, creditCode, alias, remark, extensionValues, idempotencyKey, actor(session)); }
    private OrganizationEntityReadback update(WorkspaceSessionReadback session, String key, OrganizationEntityType type, UUID id, String code, String name, String legalName, String creditCode, String alias, String remark, long expectedVersion, Map<String, String> extensionValues, String idempotencyKey) { return entities.updateEntity(type.wire(), session.workspaceUuid(), key, id, code, name, legalName, creditCode, alias, remark, expectedVersion, extensionValues, idempotencyKey, actor(session)); }
    private OrganizationEntityReadback transition(WorkspaceSessionReadback session, String key, OrganizationEntityType type, UUID id, BusinessEntityStatusRequest body, String idempotencyKey) { if (body.targetStatus() == null) throw new InvalidEdgeRequestException("target status is required"); return entities.transitionEntityStatus(type.wire(), session.workspaceUuid(), key, id, body.targetStatus().wire(), required(body.expectedVersion()), idempotencyKey, actor(session)); }
    private static AuditActor actor(WorkspaceSessionReadback session) { return new AuditActor("WORKSPACE_ACCOUNT", session.accountId(), session.accountDisplayName()); }
    private OrganizationEntityReadback require(WorkspaceSessionReadback session, String key, OrganizationEntityType type, UUID id) { return entities.requireEntity(type.wire(), session.workspaceUuid(), key, id); }
    private HeadCompany headCompany(WorkspaceSessionReadback session, String key, OrganizationEntityReadback value) { return BusinessEntityWireMapper.headCompany(value, entities.authorizedBrands(session.workspaceUuid(), key, value.id())); }
    private static HeadCompany headCompany(OrganizationEntityReadback value, java.util.List<OrganizationEntityReadback> brands) { return BusinessEntityWireMapper.headCompany(value, brands); }
    private WorkspaceSessionReadback context(EdgeRequestContext request, String key, long expectedContextVersion) { WorkspaceSessionReadback session = sessions.requireWorkspace(request, key); if (session.contextVersion() != expectedContextVersion) throw new WorkspaceAuthenticationService.SessionInvalidException(); return session; }

    private static long required(Long value) { if (value == null) throw new InvalidEdgeRequestException("expected version is required"); return value; }
    private static BusinessEntitySortKey sortKey(String value) { try { return BusinessEntitySortKey.valueOf(value); } catch (RuntimeException exception) { throw new InvalidEdgeRequestException("invalid sort"); } }
    private static BusinessEntitySortDirection sortDirection(String value) { try { return BusinessEntitySortDirection.valueOf(value); } catch (RuntimeException exception) { throw new InvalidEdgeRequestException("invalid direction"); } }
}
