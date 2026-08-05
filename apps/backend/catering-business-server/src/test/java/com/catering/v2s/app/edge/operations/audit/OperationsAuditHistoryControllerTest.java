package com.catering.v2s.app.edge.operations.audit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.catering.v2s.app.edge.operations.session.OperationsSessionCookie;
import com.catering.v2s.app.edge.operations.session.OperationsSessionResolver;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.audit.contract.AuditHistoryPage;
import com.catering.v2s.contract.application.ContractAuditHistoryService;
import com.catering.v2s.contract.application.ContractTaskReadService;
import com.catering.v2s.organization.application.OrganizationAuditHistoryService;
import com.catering.v2s.organization.application.OrganizationOverviewTaskReadService;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import com.catering.v2s.workspace.iam.application.WorkspaceAuditAuthorizationService;
import com.catering.v2s.workspace.iam.application.WorkspaceAuthenticationService;
import com.catering.v2s.workspace.iam.application.WorkspaceIamAuditHistoryService;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** Every operations audit host must retain a typed edge dispatch; no entity type may fall through to session recovery. */
class OperationsAuditHistoryControllerTest {
    private static final String WORKSPACE_KEY = "operations-audit-test";

    @Test
    void dispatchesEveryContractualAuditEntityThroughTheCurrentWorkspaceSession() {
        Fixture fixture = fixture();
        UUID id = UUID.randomUUID();
        for (String entityType : List.of("WORKSPACE_ACCOUNT", "WORKSPACE_INVITATION", "COMMERCIAL_GROUP", "ORGANIZATION_NODE", "BRAND", "TENANT", "HEAD_COMPANY", "STORE", "STORE_CONTRACT")) {
            if (List.of("ORGANIZATION_NODE", "BRAND", "TENANT", "HEAD_COMPANY", "STORE").contains(entityType)) {
                String category = "STORE".equals(entityType) ? "STORE" : "BRAND".equals(entityType) || "TENANT".equals(entityType) || "HEAD_COMPANY".equals(entityType) ? "BUSINESS_ENTITY" : "HIERARCHY";
                String hostType = "ORGANIZATION_NODE".equals(entityType) ? "REGION" : entityType;
                when(fixture.overview.detail(fixture.session.workspaceUuid(), WORKSPACE_KEY, category, id)).thenReturn(overviewItem(id, category, hostType));
            }
            assertEquals(0L, fixture.controller.history(fixture.request, WORKSPACE_KEY, entityType, id.toString(), 1, 10).total());
        }
        UUID projectNodeId = UUID.randomUUID();
        when(fixture.overview.detail(fixture.session.workspaceUuid(), WORKSPACE_KEY, "HIERARCHY", projectNodeId))
            .thenReturn(overviewItem(projectNodeId, "HIERARCHY", "PROJECT"));
        assertEquals(0L, fixture.controller.history(fixture.request, WORKSPACE_KEY, "ORGANIZATION_NODE", projectNodeId.toString(), 1, 10).total());

        verify(fixture.authorization).requireWorkspaceSubject(fixture.session, "WORKSPACE_ACCOUNT", id);
        verify(fixture.authorization).requireWorkspaceSubject(fixture.session, "WORKSPACE_INVITATION", id);
        verify(fixture.authorization, org.mockito.Mockito.times(3)).requireGroupHost(fixture.session);
        verify(fixture.authorization).requireScopedHost(eq(fixture.session), eq("REGION"), eq(id));
        verify(fixture.authorization).requireScopedHost(eq(fixture.session), eq("HEAD_COMPANY"), eq(id));
        verify(fixture.authorization).requireScopedHost(eq(fixture.session), eq("PROJECT"), eq(projectNodeId));
        verify(fixture.authorization, org.mockito.Mockito.times(3)).requireScopedHost(eq(fixture.session), eq("PROJECT"), any(UUID.class));
        verify(fixture.organizationAudit).readCommercialGroup(any(), any(), eq(1L), eq(10L));
        verify(fixture.workspaceIamAudit, org.mockito.Mockito.times(2)).read(any(), any(), eq(1L), eq(10L));
        verify(fixture.organizationAudit, org.mockito.Mockito.times(6)).read(any(), any(), eq(1L), eq(10L));
        verify(fixture.contractAudit).read(any(), any(), eq(1L), eq(10L));
    }

    private static Fixture fixture() {
        UUID workspaceId = UUID.randomUUID();
        UUID assignmentId = UUID.randomUUID();
        WorkspaceSessionReadback session = new WorkspaceSessionReadback(UUID.randomUUID(), workspaceId, WORKSPACE_KEY, UUID.randomUUID(), assignmentId, com.catering.v2s.workspace.iam.api.WorkspaceSessionEntryReadback.ScopeContext.empty(), 1L, 1L, Set.of(), Set.of(), "Operations tester");
        WorkspaceAuthenticationService authentication = mock(WorkspaceAuthenticationService.class);
        when(authentication.session("operations-session")).thenReturn(session);
        WorkspaceIamAuditHistoryService workspaceIamAudit = mock(WorkspaceIamAuditHistoryService.class);
        OrganizationAuditHistoryService organizationAudit = mock(OrganizationAuditHistoryService.class);
        ContractAuditHistoryService contractAudit = mock(ContractAuditHistoryService.class);
        WorkspaceAuditAuthorizationService authorization = mock(WorkspaceAuditAuthorizationService.class);
        OrganizationOverviewTaskReadService overview = mock(OrganizationOverviewTaskReadService.class);
        ContractTaskReadService contracts = mock(ContractTaskReadService.class);
        AuditHistoryPage empty = new AuditHistoryPage(List.of(), 1L, 10L, 0L);
        when(workspaceIamAudit.read(any(), any(), eq(1L), eq(10L))).thenReturn(empty);
        when(organizationAudit.read(any(), any(), eq(1L), eq(10L))).thenReturn(empty);
        when(organizationAudit.readCommercialGroup(any(), any(), eq(1L), eq(10L))).thenReturn(empty);
        when(contractAudit.read(any(), any(), eq(1L), eq(10L))).thenReturn(empty);
        when(contracts.view(eq(workspaceId), eq(WORKSPACE_KEY), any(UUID.class))).thenAnswer(invocation -> {
            UUID contractId = invocation.getArgument(2, UUID.class);
            var project = new ContractTaskReadService.Reference(UUID.randomUUID(), "project", "Project");
            var store = new ContractTaskReadService.Reference(UUID.randomUUID(), "store", "Store");
            return new ContractTaskReadService.StoreContractView(contractId, WORKSPACE_KEY, project, store, new ContractTaskReadService.Reference(UUID.randomUUID(), "tenant", "Tenant"), null, "contract", null, null, null, Map.of(), 0L, "ACTIVE", 1L, "contract", 1L, 1L, List.of(), null);
        });
        OperationsAuditHistoryController controller = new OperationsAuditHistoryController(new OperationsSessionResolver(authentication), workspaceIamAudit, organizationAudit, contractAudit, authorization, overview, contracts);
        EdgeRequestContext request = new EdgeRequestContext("fingerprint", "correlation", null, OperationsSessionCookie.fromCookie("operations-session"), null, null, null);
        return new Fixture(controller, request, session, workspaceIamAudit, organizationAudit, contractAudit, authorization, overview);
    }

    private static OrganizationOverviewTaskReadService.Item overviewItem(UUID id, String category, String type) {
        return new OrganizationOverviewTaskReadService.Item(id, WORKSPACE_KEY, category, type, "code", "name", List.of(), "ENABLED", "organization", 1L, 1L, 1L, null, null, null, new OrganizationOverviewTaskReadService.Reference(UUID.randomUUID(), "project", "Project", true), null, null, null, List.of(), List.of(), null);
    }

    private record Fixture(OperationsAuditHistoryController controller, EdgeRequestContext request, WorkspaceSessionReadback session, WorkspaceIamAuditHistoryService workspaceIamAudit, OrganizationAuditHistoryService organizationAudit, ContractAuditHistoryService contractAudit, WorkspaceAuditAuthorizationService authorization, OrganizationOverviewTaskReadService overview) { }
}
