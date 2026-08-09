package com.catering.v2s.app.edge.operations.organization;

import com.catering.v2s.platform.foundation.contract.ServiceNodeTypes;

import com.catering.v2s.app.edge.generated.wire.OrganizationHierarchySnapshot;
import com.catering.v2s.app.edge.generated.wire.OrganizationNode;
import com.catering.v2s.app.edge.generated.wire.OrganizationNodeCreateRequest;
import com.catering.v2s.app.edge.generated.wire.OrganizationNodeStatusTransitionRequest;
import com.catering.v2s.app.edge.generated.wire.OrganizationNodeUpdateRequest;
import com.catering.v2s.app.edge.generated.wire.OrganizationProjectCreateRequest;
import com.catering.v2s.app.edge.generated.wire.OrganizationProjectCreateRequestPhasesItem;
import com.catering.v2s.app.edge.generated.wire.OrganizationNodeUpdateRequestPhasesItem;
import com.catering.v2s.app.edge.generated.wire.CommercialGroupRoot;
import com.catering.v2s.app.edge.generated.wire.CommercialGroupUpdateRequest;
import com.catering.v2s.app.edge.operations.session.OperationsSessionResolver;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.organization.api.OrganizationNodeReadback;
import com.catering.v2s.organization.application.OrganizationHierarchyService;
import com.catering.v2s.organization.application.OrganizationCommandService;
import com.catering.v2s.organization.application.OperationsOrganizationTaskReadService;
import com.catering.v2s.workspace.iam.application.WorkspaceCapabilityScopeResolver;
import com.catering.v2s.workspace.iam.application.WorkspaceCommandAuthorizationService;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Operations hierarchy capability adapter; it owns only hierarchy paths from the frozen catalog. */
@RestController
@RequestMapping("/api/operations/group-workspaces/{groupWorkspaceKey}/hierarchy")
public final class OperationsOrganizationHierarchyController {
    private final OperationsSessionResolver sessions;
    private final OrganizationHierarchyService hierarchy;
    private final OrganizationCommandService commercialGroups;
    private final WorkspaceCapabilityScopeResolver capabilityScopes;
    private final OperationsOrganizationTaskReadService reads;

    public OperationsOrganizationHierarchyController(
        OperationsSessionResolver sessions,
        OrganizationHierarchyService hierarchy,
        OrganizationCommandService commercialGroups,
        WorkspaceCapabilityScopeResolver capabilityScopes
    ) {
        this(sessions, hierarchy, commercialGroups, capabilityScopes,
            new OperationsOrganizationTaskReadService(null, null, hierarchy, commercialGroups));
    }

    @org.springframework.beans.factory.annotation.Autowired
    public OperationsOrganizationHierarchyController(
        OperationsSessionResolver sessions,
        OrganizationHierarchyService hierarchy,
        OrganizationCommandService commercialGroups,
        WorkspaceCapabilityScopeResolver capabilityScopes,
        OperationsOrganizationTaskReadService reads
    ) {
        this.sessions = sessions;
        this.hierarchy = hierarchy;
        this.commercialGroups = commercialGroups;
        this.capabilityScopes = capabilityScopes;
        this.reads = reads;
    }

    @GetMapping
    OrganizationHierarchySnapshot list(EdgeRequestContext request, @PathVariable String groupWorkspaceKey) {
        UUID workspaceUuid = workspace(request, groupWorkspaceKey);
        OperationsOrganizationTaskReadService.HierarchySnapshot snapshot = reads.hierarchy(workspaceUuid, groupWorkspaceKey);
        return OrganizationHierarchyWireMapper.snapshot(groupWorkspaceKey, snapshot.commercialGroup(), snapshot.nodes());
    }

    @PostMapping("/regions")
    ResponseEntity<OrganizationNode> createRegion(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @RequestHeader("Idempotency-Key") String idempotencyKey, @RequestBody OrganizationNodeCreateRequest body) {
        var session = sessions.requireWorkspace(request, groupWorkspaceKey);
        var authorization = requireCapability(session, "REQ_CREATE_OPERATIONS_ORGANIZATION_REGION", ServiceNodeTypes.GROUP, commercialGroups.requireCommercialGroup(groupWorkspaceKey).id());
        return ResponseEntity.status(HttpStatus.CREATED).body(OrganizationHierarchyWireMapper.node(hierarchy.createRegion(session.workspaceUuid(), groupWorkspaceKey, body.code(), body.name(), body.notes(), BusinessEntityWireMapper.requestValues(body.extensionValues()), idempotencyKey, sessions.actor(session), authorization.ownerScopeGrant("REQ_CREATE_OPERATIONS_ORGANIZATION_REGION"))));
    }

    @PostMapping("/regions/{regionId}/projects")
    ResponseEntity<OrganizationNode> createProject(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @PathVariable UUID regionId, @RequestHeader("Idempotency-Key") String idempotencyKey, @RequestBody OrganizationProjectCreateRequest body) {
        var session = sessions.requireWorkspace(request, groupWorkspaceKey);
        var authorization = requireCapability(session, "REQ_CREATE_OPERATIONS_ORGANIZATION_PROJECT", ServiceNodeTypes.REGION, hierarchy.requireNode(session.workspaceUuid(), groupWorkspaceKey, regionId, ServiceNodeTypes.REGION).id());
        return ResponseEntity.status(HttpStatus.CREATED).body(OrganizationHierarchyWireMapper.node(hierarchy.createProject(session.workspaceUuid(), groupWorkspaceKey, regionId, body.code(), body.name(), body.notes(), projectPhaseNames(body.phases()), BusinessEntityWireMapper.requestValues(body.extensionValues()), idempotencyKey, sessions.actor(session), authorization.ownerScopeGrant("REQ_CREATE_OPERATIONS_ORGANIZATION_PROJECT"))));
    }

    @PostMapping("/{nodeId}/status")
    OrganizationNode transition(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @PathVariable UUID nodeId, @RequestHeader("Idempotency-Key") String idempotencyKey, @RequestBody OrganizationNodeStatusTransitionRequest body) {
        if (body.expectedVersion() == null) throw new com.catering.v2s.app.edge.problem.InvalidEdgeRequestException("expected version is required");
        var session = sessions.requireWorkspace(request, groupWorkspaceKey);
        var node = hierarchy.requireNode(session.workspaceUuid(), groupWorkspaceKey, nodeId, null);
        var authorization = requireStatusTransitionCapability(session, "REQ_TRANSITION_OPERATIONS_ORGANIZATION_NODE_STATUS", node.nodeType(), node.id());
        return OrganizationHierarchyWireMapper.node(hierarchy.transitionStatus(session.workspaceUuid(), groupWorkspaceKey, nodeId, body.expectedVersion(), body.targetStatus(), idempotencyKey, sessions.actor(session), authorization.ownerScopeGrant("REQ_TRANSITION_OPERATIONS_ORGANIZATION_NODE_STATUS")));
    }

    @PatchMapping("/{nodeId}")
    OrganizationNode update(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @PathVariable UUID nodeId, @RequestHeader("Idempotency-Key") String idempotencyKey, @RequestBody OrganizationNodeUpdateRequest body) {
        if (body.expectedVersion() == null) throw new com.catering.v2s.app.edge.problem.InvalidEdgeRequestException("expected version is required");
        UUID parentId = body.parentId() == null ? null : UUID.fromString(body.parentId());
        var session = sessions.requireWorkspace(request, groupWorkspaceKey);
        var node = hierarchy.requireNode(session.workspaceUuid(), groupWorkspaceKey, nodeId, null);
        var authorization = requireCapability(session, "ORG_NODE_EDIT", node.nodeType(), node.id());
        return OrganizationHierarchyWireMapper.node(hierarchy.update(session.workspaceUuid(), groupWorkspaceKey, nodeId, body.code(), body.name(), parentId, body.notes(), updatePhaseNames(body.phases()), body.expectedVersion(), BusinessEntityWireMapper.requestValues(body.extensionValues()), idempotencyKey, sessions.actor(session), authorization.ownerScopeGrant("ORG_NODE_EDIT")));
    }

    @PatchMapping("/commercial-group")
    CommercialGroupRoot updateCommercialGroup(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @RequestHeader("Idempotency-Key") String idempotencyKey, @RequestBody CommercialGroupUpdateRequest body) {
        if (body.expectedVersion() == null) throw new com.catering.v2s.app.edge.problem.InvalidEdgeRequestException("expected version is required");
        var session = sessions.requireWorkspace(request, groupWorkspaceKey);
        var commercialGroup = commercialGroups.requireCommercialGroup(groupWorkspaceKey);
        var authorization = requireCapability(session, "REQ_UPDATE_OPERATIONS_COMMERCIAL_GROUP", ServiceNodeTypes.GROUP, commercialGroup.id());
        return OrganizationHierarchyWireMapper.commercialGroup(commercialGroups.execute(
            session.workspaceUuid(), groupWorkspaceKey, idempotencyKey, body.groupCode(), body.groupName(), body.expectedVersion(), BusinessEntityWireMapper.requestValues(body.extensionValues()), sessions.actor(session), authorization.ownerScopeGrant("REQ_UPDATE_OPERATIONS_COMMERCIAL_GROUP")
        ));
    }

    private UUID workspace(EdgeRequestContext request, String groupWorkspaceKey) {
        return sessions.requireWorkspaceRead(request, groupWorkspaceKey).workspaceUuid();
    }

    private WorkspaceCapabilityScopeResolver.ScopeResolution requireCapability(com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback session, String requirementId, String targetType, UUID targetId) {
        var resolution = capabilityScopes.resolve(session, requirementId, new WorkspaceCapabilityScopeResolver.ServerResolvedResource(targetType, targetId));
        if (resolution.decision() != WorkspaceCapabilityScopeResolver.Decision.ALLOW) throw new WorkspaceCommandAuthorizationService.AuthorizationDeniedException();
        return resolution;
    }

    private WorkspaceCapabilityScopeResolver.ScopeResolution requireStatusTransitionCapability(com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback session, String requirementId, String targetType, UUID targetId) {
        var resolution = capabilityScopes.resolveStatusTransition(session, requirementId, new WorkspaceCapabilityScopeResolver.ServerResolvedResource(targetType, targetId));
        if (resolution.decision() != WorkspaceCapabilityScopeResolver.Decision.ALLOW) throw new WorkspaceCommandAuthorizationService.AuthorizationDeniedException();
        return resolution;
    }

    private static List<String> projectPhaseNames(List<OrganizationProjectCreateRequestPhasesItem> values) {
        if (values == null) return List.of();
        return values.stream().map(OrganizationProjectCreateRequestPhasesItem::name).toList();
    }

    private static List<String> updatePhaseNames(List<OrganizationNodeUpdateRequestPhasesItem> values) {
        if (values == null) return List.of();
        return values.stream().map(OrganizationNodeUpdateRequestPhasesItem::name).toList();
    }
}
