package com.catering.v2s.app.edge.operations.organization;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.catering.v2s.app.edge.generated.wire.CommercialGroupUpdateRequest;
import com.catering.v2s.app.edge.generated.wire.OrganizationNodeCreateRequest;
import com.catering.v2s.app.edge.generated.wire.OrganizationNodeStatusTransitionRequest;
import com.catering.v2s.app.edge.generated.wire.OrganizationNodeUpdateRequest;
import com.catering.v2s.app.edge.generated.wire.OrganizationProjectCreateRequest;
import com.catering.v2s.app.edge.operations.session.OperationsSessionCookie;
import com.catering.v2s.app.edge.operations.session.OperationsSessionResolver;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.organization.api.CommercialGroupReadback;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.organization.api.OrganizationNodeReadback;
import com.catering.v2s.organization.application.OrganizationCommandService;
import com.catering.v2s.organization.application.OrganizationHierarchyService;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import com.catering.v2s.workspace.iam.application.WorkspaceAuthenticationService;
import com.catering.v2s.workspace.iam.application.WorkspaceCapabilityScopeResolver;
import com.catering.v2s.workspace.iam.application.WorkspaceCommandAuthorizationService;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class OperationsOrganizationHierarchyControllerTest {
    private static final String WORKSPACE_KEY = "operations-organization-hierarchy-test";
    private static final String IDEMPOTENCY_KEY = "operations-group-edit-0001";

    @Test
    void commercialGroupUpdateUsesTheCurrentWorkspaceSessionAndReturnsOwnerReadback() {
        UUID workspaceId = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();
        WorkspaceAuthenticationService authentication = mock(WorkspaceAuthenticationService.class);
        WorkspaceSessionReadback session = new WorkspaceSessionReadback(UUID.randomUUID(), workspaceId, WORKSPACE_KEY, accountId, UUID.randomUUID(), com.catering.v2s.workspace.iam.api.WorkspaceSessionEntryReadback.ScopeContext.empty(), 1L, 1L, Set.of(), Set.of(), "Operations tester");
        when(authentication.session("operations-session")).thenReturn(session);
        OrganizationHierarchyService hierarchy = mock(OrganizationHierarchyService.class);
        OrganizationCommandService commercialGroups = mock(OrganizationCommandService.class);
        WorkspaceCapabilityScopeResolver capabilityScopes = mock(WorkspaceCapabilityScopeResolver.class);
        UUID groupId = UUID.randomUUID();
        var predicate = new WorkspaceCapabilityScopeResolver.FirstOwnerQueryPredicate(
            workspaceId, WORKSPACE_KEY, "GROUP", groupId, "GROUP", groupId, java.util.List.of(groupId)
        );
        var ownerGrant = new OperationsOwnerScopeGrant(
            workspaceId, WORKSPACE_KEY, "REQ_UPDATE_OPERATIONS_COMMERCIAL_GROUP", "BC-ORG-GROUP-EDIT",
            "GROUP", groupId, "GROUP", groupId, java.util.List.of(groupId)
        );
        when(commercialGroups.requireCommercialGroup(WORKSPACE_KEY)).thenReturn(new CommercialGroupReadback(groupId, WORKSPACE_KEY, "GROUP-02", "Existing group", 4L, "platform-origin", 100L, 200L, Map.of(), 0L));
        when(capabilityScopes.resolve(eq(session), eq("REQ_UPDATE_OPERATIONS_COMMERCIAL_GROUP"), eq(new WorkspaceCapabilityScopeResolver.ServerResolvedResource("GROUP", groupId))))
            .thenReturn(new WorkspaceCapabilityScopeResolver.ScopeResolution(WorkspaceCapabilityScopeResolver.Decision.ALLOW, "BC-ORG-GROUP-EDIT", predicate));
        when(commercialGroups.execute(eq(workspaceId), eq(WORKSPACE_KEY), eq(IDEMPOTENCY_KEY), eq("GROUP-02"), eq("Updated group"), eq(4L), eq(Map.of()), eq(new AuditActor("WORKSPACE_ACCOUNT", accountId, "Operations tester")), eq(ownerGrant)))
            .thenReturn(new CommercialGroupReadback(groupId, WORKSPACE_KEY, "GROUP-02", "Updated group", 5L, "platform-origin", 100L, 200L, Map.of(), 0L));
        OperationsOrganizationHierarchyController controller = new OperationsOrganizationHierarchyController(new OperationsSessionResolver(authentication), hierarchy, commercialGroups, capabilityScopes);
        EdgeRequestContext request = new EdgeRequestContext("test-rate-limit-fingerprint", "test-correlation", null, OperationsSessionCookie.fromCookie("operations-session"), null, null, null);

        var response = controller.updateCommercialGroup(request, WORKSPACE_KEY, IDEMPOTENCY_KEY, new CommercialGroupUpdateRequest("GROUP-02", "Updated group", null, 4L));

        assertEquals(groupId.toString(), response.id());
        assertEquals("Updated group", response.groupName());
        assertEquals(5L, response.version());
        verify(capabilityScopes).resolve(session, "REQ_UPDATE_OPERATIONS_COMMERCIAL_GROUP", new WorkspaceCapabilityScopeResolver.ServerResolvedResource("GROUP", groupId));
        verify(commercialGroups).execute(workspaceId, WORKSPACE_KEY, IDEMPOTENCY_KEY, "GROUP-02", "Updated group", 4L, Map.of(), new AuditActor("WORKSPACE_ACCOUNT", accountId, "Operations tester"), ownerGrant);
    }

    @Test
    void commercialGroupUpdateRejectsAnAuthenticatedSessionWithoutThePersistedGrant() {
        UUID workspaceId = UUID.randomUUID();
        WorkspaceAuthenticationService authentication = mock(WorkspaceAuthenticationService.class);
        WorkspaceSessionReadback session = new WorkspaceSessionReadback(UUID.randomUUID(), workspaceId, WORKSPACE_KEY, UUID.randomUUID(), UUID.randomUUID(), com.catering.v2s.workspace.iam.api.WorkspaceSessionEntryReadback.ScopeContext.empty(), 1L, 1L, Set.of(), Set.of(), "Operations tester");
        when(authentication.session("operations-session")).thenReturn(session);
        OrganizationHierarchyService hierarchy = mock(OrganizationHierarchyService.class);
        OrganizationCommandService commercialGroups = mock(OrganizationCommandService.class);
        WorkspaceCapabilityScopeResolver capabilityScopes = mock(WorkspaceCapabilityScopeResolver.class);
        UUID groupId = UUID.randomUUID();
        when(commercialGroups.requireCommercialGroup(WORKSPACE_KEY)).thenReturn(new CommercialGroupReadback(groupId, WORKSPACE_KEY, "GROUP-02", "Existing group", 4L, "platform-origin", 100L, 200L, Map.of(), 0L));
        when(capabilityScopes.resolve(eq(session), eq("REQ_UPDATE_OPERATIONS_COMMERCIAL_GROUP"), eq(new WorkspaceCapabilityScopeResolver.ServerResolvedResource("GROUP", groupId))))
            .thenReturn(new WorkspaceCapabilityScopeResolver.ScopeResolution(WorkspaceCapabilityScopeResolver.Decision.DENY, null, null));
        OperationsOrganizationHierarchyController controller = new OperationsOrganizationHierarchyController(new OperationsSessionResolver(authentication), hierarchy, commercialGroups, capabilityScopes);
        EdgeRequestContext request = new EdgeRequestContext("test-rate-limit-fingerprint", "test-correlation", null, OperationsSessionCookie.fromCookie("operations-session"), null, null, null);

        org.junit.jupiter.api.Assertions.assertThrows(WorkspaceCommandAuthorizationService.AuthorizationDeniedException.class, () ->
            controller.updateCommercialGroup(request, WORKSPACE_KEY, IDEMPOTENCY_KEY, new CommercialGroupUpdateRequest("GROUP-02", "Updated group", null, 4L))
        );

        verify(commercialGroups, never()).execute(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.anyLong(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
        verify(commercialGroups, never()).execute(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.anyLong(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
    }

    @Test
    void hierarchyWritesRejectBeforeTheirOwnerCommandWhenTheResolvedCapabilityIsDenied() {
        UUID workspaceId = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();
        WorkspaceAuthenticationService authentication = mock(WorkspaceAuthenticationService.class);
        WorkspaceSessionReadback session = new WorkspaceSessionReadback(UUID.randomUUID(), workspaceId, WORKSPACE_KEY, accountId, UUID.randomUUID(), com.catering.v2s.workspace.iam.api.WorkspaceSessionEntryReadback.ScopeContext.empty(), 1L, 1L, Set.of(), Set.of(), "Operations tester");
        when(authentication.session("operations-session")).thenReturn(session);
        OrganizationHierarchyService hierarchy = mock(OrganizationHierarchyService.class);
        OrganizationCommandService commercialGroups = mock(OrganizationCommandService.class);
        WorkspaceCapabilityScopeResolver capabilityScopes = mock(WorkspaceCapabilityScopeResolver.class);
        UUID groupId = UUID.randomUUID();
        UUID regionId = UUID.randomUUID();
        when(commercialGroups.requireCommercialGroup(WORKSPACE_KEY)).thenReturn(new CommercialGroupReadback(groupId, WORKSPACE_KEY, "GROUP-02", "Existing group", 4L, "platform-origin", 100L, 200L, Map.of(), 0L));
        OrganizationNodeReadback region = new OrganizationNodeReadback(regionId, workspaceId, WORKSPACE_KEY, null, "REGION", "REGION-01", "Existing region", null, "ENABLED", 4L, 100L, 200L, java.util.List.of(), Map.of(), 0L);
        when(hierarchy.requireNode(workspaceId, WORKSPACE_KEY, regionId, "REGION")).thenReturn(region);
        when(hierarchy.requireNode(workspaceId, WORKSPACE_KEY, regionId, null)).thenReturn(region);
        when(capabilityScopes.resolve(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.any()))
            .thenReturn(new WorkspaceCapabilityScopeResolver.ScopeResolution(WorkspaceCapabilityScopeResolver.Decision.DENY, null, null));
        when(capabilityScopes.resolveStatusTransition(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.any()))
            .thenReturn(new WorkspaceCapabilityScopeResolver.ScopeResolution(WorkspaceCapabilityScopeResolver.Decision.DENY, null, null));
        OperationsOrganizationHierarchyController controller = new OperationsOrganizationHierarchyController(new OperationsSessionResolver(authentication), hierarchy, commercialGroups, capabilityScopes);
        EdgeRequestContext request = new EdgeRequestContext("test-rate-limit-fingerprint", "test-correlation", null, OperationsSessionCookie.fromCookie("operations-session"), null, null, null);

        org.junit.jupiter.api.Assertions.assertThrows(WorkspaceCommandAuthorizationService.AuthorizationDeniedException.class, () -> controller.createRegion(request, WORKSPACE_KEY, IDEMPOTENCY_KEY, new OrganizationNodeCreateRequest("REGION-02", "New region", null, null)));
        org.junit.jupiter.api.Assertions.assertThrows(WorkspaceCommandAuthorizationService.AuthorizationDeniedException.class, () -> controller.createProject(request, WORKSPACE_KEY, regionId, IDEMPOTENCY_KEY, new OrganizationProjectCreateRequest("PROJECT-02", "New project", null, null, null)));
        org.junit.jupiter.api.Assertions.assertThrows(WorkspaceCommandAuthorizationService.AuthorizationDeniedException.class, () -> controller.update(request, WORKSPACE_KEY, regionId, IDEMPOTENCY_KEY, new OrganizationNodeUpdateRequest("REGION-01", "Changed region", null, null, null, 4L, null)));
        org.junit.jupiter.api.Assertions.assertThrows(WorkspaceCommandAuthorizationService.AuthorizationDeniedException.class, () -> controller.transition(request, WORKSPACE_KEY, regionId, IDEMPOTENCY_KEY, new OrganizationNodeStatusTransitionRequest("DISABLED", 4L)));

        verify(capabilityScopes).resolve(session, "REQ_CREATE_OPERATIONS_ORGANIZATION_REGION", new WorkspaceCapabilityScopeResolver.ServerResolvedResource("GROUP", groupId));
        verify(capabilityScopes).resolve(session, "REQ_CREATE_OPERATIONS_ORGANIZATION_PROJECT", new WorkspaceCapabilityScopeResolver.ServerResolvedResource("REGION", regionId));
        verify(capabilityScopes).resolve(session, "ORG_NODE_EDIT", new WorkspaceCapabilityScopeResolver.ServerResolvedResource("REGION", regionId));
        verify(capabilityScopes).resolveStatusTransition(session, "REQ_TRANSITION_OPERATIONS_ORGANIZATION_NODE_STATUS", new WorkspaceCapabilityScopeResolver.ServerResolvedResource("REGION", regionId));
        verify(hierarchy, never()).createRegion(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
        verify(hierarchy, never()).createProject(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
        verify(hierarchy, never()).update(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.anyLong(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
        verify(hierarchy, never()).transitionStatus(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.anyLong(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
    }

    @Test
    void hierarchyWritesPassTheServerResolvedOwnerGrantToTheOwnerCommand() {
        UUID workspaceId = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();
        UUID groupId = UUID.randomUUID();
        UUID regionId = UUID.randomUUID();
        WorkspaceAuthenticationService authentication = mock(WorkspaceAuthenticationService.class);
        WorkspaceSessionReadback session = new WorkspaceSessionReadback(UUID.randomUUID(), workspaceId, WORKSPACE_KEY, accountId, UUID.randomUUID(), com.catering.v2s.workspace.iam.api.WorkspaceSessionEntryReadback.ScopeContext.empty(), 1L, 1L, Set.of(), Set.of(), "Operations tester");
        when(authentication.session("operations-session")).thenReturn(session);
        OrganizationHierarchyService hierarchy = mock(OrganizationHierarchyService.class);
        OrganizationCommandService commercialGroups = mock(OrganizationCommandService.class);
        WorkspaceCapabilityScopeResolver capabilityScopes = mock(WorkspaceCapabilityScopeResolver.class);
        OrganizationNodeReadback region = new OrganizationNodeReadback(regionId, workspaceId, WORKSPACE_KEY, null, "REGION", "REGION-01", "Existing region", null, "ENABLED", 4L, 100L, 200L, java.util.List.of(), Map.of(), 0L);
        OrganizationNodeReadback project = new OrganizationNodeReadback(UUID.randomUUID(), workspaceId, WORKSPACE_KEY, regionId, "PROJECT", "PROJECT-01", "New project", null, "ENABLED", 1L, 100L, 200L, java.util.List.of(), Map.of(), 0L);
        var groupPredicate = new WorkspaceCapabilityScopeResolver.FirstOwnerQueryPredicate(workspaceId, WORKSPACE_KEY, "GROUP", groupId, "GROUP", groupId, java.util.List.of(groupId));
        var regionPredicate = new WorkspaceCapabilityScopeResolver.FirstOwnerQueryPredicate(workspaceId, WORKSPACE_KEY, "REGION", regionId, "REGION", regionId, java.util.List.of(groupId, regionId));
        var groupGrant = new OperationsOwnerScopeGrant(workspaceId, WORKSPACE_KEY, "REQ_CREATE_OPERATIONS_ORGANIZATION_REGION", "BC-ORG-REGION-CREATE", "GROUP", groupId, "GROUP", groupId, java.util.List.of(groupId));
        var projectGrant = new OperationsOwnerScopeGrant(workspaceId, WORKSPACE_KEY, "REQ_CREATE_OPERATIONS_ORGANIZATION_PROJECT", "BC-ORG-PROJECT-CREATE", "REGION", regionId, "REGION", regionId, java.util.List.of(groupId, regionId));
        var updateGrant = new OperationsOwnerScopeGrant(workspaceId, WORKSPACE_KEY, "ORG_NODE_EDIT", "BC-ORG-REGION-EDIT", "REGION", regionId, "REGION", regionId, java.util.List.of(groupId, regionId));
        var transitionGrant = new OperationsOwnerScopeGrant(workspaceId, WORKSPACE_KEY, "REQ_TRANSITION_OPERATIONS_ORGANIZATION_NODE_STATUS", "BC-ORG-REGION-STATUS", "REGION", regionId, "REGION", regionId, java.util.List.of(groupId, regionId));
        when(commercialGroups.requireCommercialGroup(WORKSPACE_KEY)).thenReturn(new CommercialGroupReadback(groupId, WORKSPACE_KEY, "GROUP-02", "Existing group", 4L, "platform-origin", 100L, 200L, Map.of(), 0L));
        when(hierarchy.requireNode(workspaceId, WORKSPACE_KEY, regionId, "REGION")).thenReturn(region);
        when(hierarchy.requireNode(workspaceId, WORKSPACE_KEY, regionId, null)).thenReturn(region);
        when(capabilityScopes.resolve(session, "REQ_CREATE_OPERATIONS_ORGANIZATION_REGION", new WorkspaceCapabilityScopeResolver.ServerResolvedResource("GROUP", groupId))).thenReturn(new WorkspaceCapabilityScopeResolver.ScopeResolution(WorkspaceCapabilityScopeResolver.Decision.ALLOW, "BC-ORG-REGION-CREATE", groupPredicate));
        when(capabilityScopes.resolve(session, "REQ_CREATE_OPERATIONS_ORGANIZATION_PROJECT", new WorkspaceCapabilityScopeResolver.ServerResolvedResource("REGION", regionId))).thenReturn(new WorkspaceCapabilityScopeResolver.ScopeResolution(WorkspaceCapabilityScopeResolver.Decision.ALLOW, "BC-ORG-PROJECT-CREATE", regionPredicate));
        when(capabilityScopes.resolve(session, "ORG_NODE_EDIT", new WorkspaceCapabilityScopeResolver.ServerResolvedResource("REGION", regionId))).thenReturn(new WorkspaceCapabilityScopeResolver.ScopeResolution(WorkspaceCapabilityScopeResolver.Decision.ALLOW, "BC-ORG-REGION-EDIT", regionPredicate));
        when(capabilityScopes.resolveStatusTransition(session, "REQ_TRANSITION_OPERATIONS_ORGANIZATION_NODE_STATUS", new WorkspaceCapabilityScopeResolver.ServerResolvedResource("REGION", regionId))).thenReturn(new WorkspaceCapabilityScopeResolver.ScopeResolution(WorkspaceCapabilityScopeResolver.Decision.ALLOW, "BC-ORG-REGION-STATUS", regionPredicate));
        AuditActor actor = new AuditActor("WORKSPACE_ACCOUNT", accountId, "Operations tester");
        when(hierarchy.createRegion(workspaceId, WORKSPACE_KEY, "REGION-02", "New region", null, Map.of(), IDEMPOTENCY_KEY, actor, groupGrant)).thenReturn(region);
        when(hierarchy.createProject(workspaceId, WORKSPACE_KEY, regionId, "PROJECT-02", "New project", null, java.util.List.of(), Map.of(), IDEMPOTENCY_KEY, actor, projectGrant)).thenReturn(project);
        when(hierarchy.update(workspaceId, WORKSPACE_KEY, regionId, "REGION-01", "Changed region", null, null, java.util.List.of(), 4L, Map.of(), IDEMPOTENCY_KEY, actor, updateGrant)).thenReturn(region);
        when(hierarchy.transitionStatus(workspaceId, WORKSPACE_KEY, regionId, 4L, "DISABLED", IDEMPOTENCY_KEY, actor, transitionGrant)).thenReturn(region);
        OperationsOrganizationHierarchyController controller = new OperationsOrganizationHierarchyController(new OperationsSessionResolver(authentication), hierarchy, commercialGroups, capabilityScopes);
        EdgeRequestContext request = new EdgeRequestContext("test-rate-limit-fingerprint", "test-correlation", null, OperationsSessionCookie.fromCookie("operations-session"), null, null, null);

        controller.createRegion(request, WORKSPACE_KEY, IDEMPOTENCY_KEY, new OrganizationNodeCreateRequest("REGION-02", "New region", null, null));
        controller.createProject(request, WORKSPACE_KEY, regionId, IDEMPOTENCY_KEY, new OrganizationProjectCreateRequest("PROJECT-02", "New project", null, null, null));
        controller.update(request, WORKSPACE_KEY, regionId, IDEMPOTENCY_KEY, new OrganizationNodeUpdateRequest("REGION-01", "Changed region", null, null, null, 4L, null));
        controller.transition(request, WORKSPACE_KEY, regionId, IDEMPOTENCY_KEY, new OrganizationNodeStatusTransitionRequest("DISABLED", 4L));

        verify(hierarchy).createRegion(workspaceId, WORKSPACE_KEY, "REGION-02", "New region", null, Map.of(), IDEMPOTENCY_KEY, actor, groupGrant);
        verify(hierarchy).createProject(workspaceId, WORKSPACE_KEY, regionId, "PROJECT-02", "New project", null, java.util.List.of(), Map.of(), IDEMPOTENCY_KEY, actor, projectGrant);
        verify(hierarchy).update(workspaceId, WORKSPACE_KEY, regionId, "REGION-01", "Changed region", null, null, java.util.List.of(), 4L, Map.of(), IDEMPOTENCY_KEY, actor, updateGrant);
        verify(hierarchy).transitionStatus(workspaceId, WORKSPACE_KEY, regionId, 4L, "DISABLED", IDEMPOTENCY_KEY, actor, transitionGrant);
    }
}
