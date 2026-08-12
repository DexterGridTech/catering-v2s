package com.catering.v2s.app.edge.operations.organization;

import com.catering.v2s.platform.foundation.contract.ServiceNodeTypes;

import com.catering.v2s.app.edge.generated.wire.HeadCompanyBrandAuthorizationAddRequest;
import com.catering.v2s.app.edge.generated.backendperformancem1.BackendPerformanceM1CommandExecutionBindings;
import com.catering.v2s.app.edge.operations.session.OperationsSessionResolver;
import com.catering.v2s.app.edge.problem.InvalidEdgeRequestException;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.organization.application.BusinessEntityService;
import com.catering.v2s.organization.application.AddOperationsOrganizationHeadCompanyBrandAuthorizationOperation;
import com.catering.v2s.organization.application.RemoveOperationsOrganizationHeadCompanyBrandAuthorizationOperation;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import com.catering.v2s.workspace.iam.application.WorkspaceCapabilityScopeResolver;
import com.catering.v2s.workspace.iam.application.WorkspaceCommandAuthorizationService;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Operations head-company authorization capability adapter. */
@RestController
@RequestMapping("/api/operations/group-workspaces/{groupWorkspaceKey}/organization/head-companies")
public final class OperationsHeadCompanyAuthorizationController {
    private final OperationsSessionResolver sessions;
    private final BusinessEntityService entities;
    private final WorkspaceCapabilityScopeResolver capabilityScopes;
    private final AddOperationsOrganizationHeadCompanyBrandAuthorizationOperation addOperation;
    private final RemoveOperationsOrganizationHeadCompanyBrandAuthorizationOperation removeOperation;
    private final BackendPerformanceM1CommandExecutionBindings m1Bindings;

    public OperationsHeadCompanyAuthorizationController(OperationsSessionResolver sessions, BusinessEntityService entities, WorkspaceCapabilityScopeResolver capabilityScopes) {
        this(sessions, entities, capabilityScopes, new AddOperationsOrganizationHeadCompanyBrandAuthorizationOperation(entities), new RemoveOperationsOrganizationHeadCompanyBrandAuthorizationOperation(entities), BackendPerformanceM1CommandExecutionBindings.forHeadCompanyAuthorization(new AddOperationsOrganizationHeadCompanyBrandAuthorizationOperation(entities), new RemoveOperationsOrganizationHeadCompanyBrandAuthorizationOperation(entities)));
    }

    @org.springframework.beans.factory.annotation.Autowired
    public OperationsHeadCompanyAuthorizationController(OperationsSessionResolver sessions, BusinessEntityService entities, WorkspaceCapabilityScopeResolver capabilityScopes, AddOperationsOrganizationHeadCompanyBrandAuthorizationOperation addOperation, RemoveOperationsOrganizationHeadCompanyBrandAuthorizationOperation removeOperation, BackendPerformanceM1CommandExecutionBindings m1Bindings) {
        this.sessions = sessions; this.entities = entities; this.capabilityScopes = capabilityScopes; this.addOperation = addOperation; this.removeOperation = removeOperation; this.m1Bindings = m1Bindings;
    }

    @PostMapping("/{headCompanyId}/brand-authorizations")
    ResponseEntity<Void> add(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @PathVariable UUID headCompanyId, @RequestHeader("Idempotency-Key") String idempotencyKey, @RequestBody HeadCompanyBrandAuthorizationAddRequest body) {
        var session = sessions.requireWorkspaceCommand(request, groupWorkspaceKey);
        m1Bindings.bindAddOperationsOrganizationHeadCompanyBrandAuthorization(new com.catering.v2s.organization.api.OperationsBusinessEntityCommandApi.HeadCompanyBrandAuthorizationCommand(session.workspaceUuid(), groupWorkspaceKey, headCompanyId, requiredUuid(body == null ? null : body.brandId()), idempotencyKey, sessions.actor(session), requireCapability(session, "REQ_ADD_OPERATIONS_ORGANIZATION_HEAD_COMPANY_BRAND_AUTHORIZATION", headCompanyId)));
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{headCompanyId}/brand-authorizations/{brandId}")
    ResponseEntity<Void> remove(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @PathVariable UUID headCompanyId, @PathVariable String brandId, @RequestHeader("Idempotency-Key") String idempotencyKey) {
        var session = sessions.requireWorkspaceCommand(request, groupWorkspaceKey);
        m1Bindings.bindRemoveOperationsOrganizationHeadCompanyBrandAuthorization(new com.catering.v2s.organization.api.OperationsBusinessEntityCommandApi.HeadCompanyBrandAuthorizationCommand(session.workspaceUuid(), groupWorkspaceKey, headCompanyId, requiredUuid(brandId), idempotencyKey, sessions.actor(session), requireCapability(session, "REQ_REMOVE_OPERATIONS_ORGANIZATION_HEAD_COMPANY_BRAND_AUTHORIZATION", headCompanyId)));
        return ResponseEntity.noContent().build();
    }

    private static UUID requiredUuid(String value) {
        if (value == null || value.isBlank()) throw new InvalidEdgeRequestException("brand id is required");
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException exception) {
            throw new InvalidEdgeRequestException("brand id is invalid");
        }
    }

    private com.catering.v2s.organization.api.OperationsOwnerScopeGrant requireCapability(WorkspaceSessionReadback session, String requirementId, UUID headCompanyId) {
        var resolution = capabilityScopes.resolve(session, requirementId, new WorkspaceCapabilityScopeResolver.ServerResolvedResource(ServiceNodeTypes.HEAD_COMPANY, headCompanyId));
        if (resolution.decision() != WorkspaceCapabilityScopeResolver.Decision.ALLOW) throw new WorkspaceCommandAuthorizationService.AuthorizationDeniedException();
        return resolution.ownerScopeGrant(requirementId);
    }
}
