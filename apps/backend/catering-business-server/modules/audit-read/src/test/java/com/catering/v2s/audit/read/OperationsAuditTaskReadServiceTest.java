package com.catering.v2s.audit.read;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.same;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import com.catering.v2s.audit.contract.AuditEntityTypes;
import com.catering.v2s.audit.contract.AuditHistoryPage;
import com.catering.v2s.audit.contract.AuditReadScope;
import com.catering.v2s.audit.contract.AuditTarget;
import com.catering.v2s.audit.read.OperationsAuditTaskReadService.OperationsAuditQuery;
import com.catering.v2s.contract.application.ContractAuditHistoryService;
import com.catering.v2s.organization.api.OrganizationVisibilityLookup;
import com.catering.v2s.organization.application.OrganizationAuditHistoryService;
import com.catering.v2s.storeterminal.application.StoreTerminalAuditHistoryService;
import com.catering.v2s.terminalbinding.api.TerminalBindingAuditReadApi;
import com.catering.v2s.workspace.iam.application.WorkspaceIamAuditHistoryService;
import com.catering.v2s.workspace.iam.application.WorkspaceReadAuthorizationFacts;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class OperationsAuditTaskReadServiceTest {
    @Test
    void dispatchesTheFourteenClosedQueriesOnlyToTheirNamedOwners() {
        WorkspaceIamAuditHistoryService workspaceIam = mock(WorkspaceIamAuditHistoryService.class);
        OrganizationAuditHistoryService organization = mock(OrganizationAuditHistoryService.class);
        ContractAuditHistoryService contract = mock(ContractAuditHistoryService.class);
        StoreTerminalAuditHistoryService storeTerminal = mock(StoreTerminalAuditHistoryService.class);
        TerminalBindingAuditReadApi terminalBinding = mock(TerminalBindingAuditReadApi.class);
        WorkspaceReadAuthorizationFacts facts = mock(WorkspaceReadAuthorizationFacts.class);
        when(facts.workspaceUuid()).thenReturn(UUID.randomUUID());
        when(facts.groupWorkspaceKey()).thenReturn("gw");
        when(facts.assignmentNodeType()).thenReturn("STORE");
        OrganizationVisibilityLookup.VisibleOrganizationFacts visibleFacts =
                mock(OrganizationVisibilityLookup.VisibleOrganizationFacts.class);
        when(facts.visibleOrganizationFacts()).thenReturn(visibleFacts);
        UUID visibleStoreRef = UUID.randomUUID();
        when(visibleFacts.candidates())
                .thenReturn(List.of(
                        new OrganizationVisibilityLookup.VisibleDataNodeCandidate(
                                "STORE",
                                visibleStoreRef,
                                "Visible store",
                                "VISIBLE",
                                List.of(),
                                null,
                                null,
                                visibleStoreRef,
                                null),
                        new OrganizationVisibilityLookup.VisibleDataNodeCandidate(
                                "REGION", UUID.randomUUID(), "Region", "REGION", List.of(), null, null, null, null)));
        AuditHistoryPage empty = new AuditHistoryPage(List.of(), 1, 20, 0);
        when(workspaceIam.readOperationsAuditProjection(any(), any(), anyLong(), anyLong()))
                .thenReturn(empty);
        when(organization.readOperationsAuditProjection(any(), any(), any(), any(), anyLong(), anyLong()))
                .thenReturn(empty);
        when(contract.readOperationsAuditProjection(any(), any(), any(), anyLong(), anyLong()))
                .thenReturn(empty);
        when(storeTerminal.readOperationsAuditProjection(any(), any(), any(), anyLong(), anyLong()))
                .thenReturn(empty);
        when(terminalBinding.read(any(), any(), any(), anyLong(), anyLong())).thenReturn(empty);
        OperationsAuditTaskReadService service = new OperationsAuditTaskReadService(
                workspaceIam, organization, contract, storeTerminal, terminalBinding);
        String id = UUID.randomUUID().toString();
        List<OperationsAuditQuery> queries = List.of(
                new OperationsAuditQuery.WorkspaceAccount(new AuditTarget("WORKSPACE_ACCOUNT", id), 1, 20),
                new OperationsAuditQuery.WorkspaceInvitation(new AuditTarget("WORKSPACE_INVITATION", id), 1, 20),
                new OperationsAuditQuery.CommercialGroup(new AuditTarget("COMMERCIAL_GROUP", id), 1, 20),
                new OperationsAuditQuery.OrganizationNode(new AuditTarget("ORGANIZATION_NODE", id), 1, 20),
                new OperationsAuditQuery.Brand(new AuditTarget("BRAND", id), 1, 20),
                new OperationsAuditQuery.Tenant(new AuditTarget("TENANT", id), 1, 20),
                new OperationsAuditQuery.HeadCompany(new AuditTarget("HEAD_COMPANY", id), 1, 20),
                new OperationsAuditQuery.Store(new AuditTarget("STORE", id), 1, 20),
                new OperationsAuditQuery.StoreServicePointArea(
                        new AuditTarget(AuditEntityTypes.STORE_SERVICE_POINT_AREA, id), 1, 20),
                new OperationsAuditQuery.StoreServicePoint(
                        new AuditTarget(AuditEntityTypes.STORE_SERVICE_POINT, id), 1, 20),
                new OperationsAuditQuery.StoreQrConfiguration(
                        new AuditTarget(AuditEntityTypes.STORE_QR_CONFIGURATION, id), 1, 20),
                new OperationsAuditQuery.StoreContract(new AuditTarget("STORE_CONTRACT", id), 1, 20),
                new OperationsAuditQuery.StoreTerminal(new AuditTarget(AuditEntityTypes.STORE_TERMINAL, id), 1, 20),
                new OperationsAuditQuery.TerminalBinding(
                        new AuditTarget(AuditEntityTypes.TERMINAL_BINDING, id), 1, 20));
        queries.forEach(query -> service.read(facts, query));
        AuditReadScope scope = new AuditReadScope(facts.workspaceUuid(), facts.groupWorkspaceKey());
        verify(workspaceIam)
                .readOperationsAuditProjection(same(facts), same(queries.get(0).target()), eq(1L), eq(20L));
        verify(workspaceIam)
                .readOperationsAuditProjection(same(facts), same(queries.get(1).target()), eq(1L), eq(20L));
        for (int index = 2; index < 11; index++)
            verify(organization)
                    .readOperationsAuditProjection(
                            eq(scope),
                            eq("STORE"),
                            same(visibleFacts),
                            same(queries.get(index).target()),
                            eq(1L),
                            eq(20L));
        verify(contract)
                .readOperationsAuditProjection(
                        eq(scope), same(visibleFacts), same(queries.get(11).target()), eq(1L), eq(20L));
        verify(storeTerminal)
                .readOperationsAuditProjection(
                        eq(scope), same(visibleFacts), same(queries.get(12).target()), eq(1L), eq(20L));
        verify(terminalBinding)
                .read(eq(scope), eq(java.util.Set.of(visibleStoreRef)), eq(UUID.fromString(id)), eq(1L), eq(20L));
        verifyNoMoreInteractions(workspaceIam, organization, contract, storeTerminal, terminalBinding);
    }

    @Test
    void closedQueriesAcceptOnlyTheirCanonicalFourteenTargetTypes() {
        String id = UUID.randomUUID().toString();
        assertDoesNotThrow(
                () -> new OperationsAuditQuery.WorkspaceAccount(new AuditTarget("WORKSPACE_ACCOUNT", id), 1, 20));
        assertDoesNotThrow(
                () -> new OperationsAuditQuery.WorkspaceInvitation(new AuditTarget("WORKSPACE_INVITATION", id), 1, 20));
        assertDoesNotThrow(
                () -> new OperationsAuditQuery.CommercialGroup(new AuditTarget("COMMERCIAL_GROUP", id), 1, 20));
        assertDoesNotThrow(
                () -> new OperationsAuditQuery.OrganizationNode(new AuditTarget("ORGANIZATION_NODE", id), 1, 20));
        assertDoesNotThrow(() -> new OperationsAuditQuery.Brand(new AuditTarget("BRAND", id), 1, 20));
        assertDoesNotThrow(() -> new OperationsAuditQuery.Tenant(new AuditTarget("TENANT", id), 1, 20));
        assertDoesNotThrow(() -> new OperationsAuditQuery.HeadCompany(new AuditTarget("HEAD_COMPANY", id), 1, 20));
        assertDoesNotThrow(() -> new OperationsAuditQuery.Store(new AuditTarget("STORE", id), 1, 20));
        assertDoesNotThrow(() -> new OperationsAuditQuery.StoreServicePointArea(
                new AuditTarget(AuditEntityTypes.STORE_SERVICE_POINT_AREA, id), 1, 20));
        assertDoesNotThrow(() -> new OperationsAuditQuery.StoreServicePoint(
                new AuditTarget(AuditEntityTypes.STORE_SERVICE_POINT, id), 1, 20));
        assertDoesNotThrow(() -> new OperationsAuditQuery.StoreQrConfiguration(
                new AuditTarget(AuditEntityTypes.STORE_QR_CONFIGURATION, id), 1, 20));
        assertDoesNotThrow(() -> new OperationsAuditQuery.StoreContract(new AuditTarget("STORE_CONTRACT", id), 1, 20));
        assertDoesNotThrow(() ->
                new OperationsAuditQuery.StoreTerminal(new AuditTarget(AuditEntityTypes.STORE_TERMINAL, id), 1, 20));
        assertDoesNotThrow(() -> new OperationsAuditQuery.TerminalBinding(
                new AuditTarget(AuditEntityTypes.TERMINAL_BINDING, id), 1, 20));
        assertThrows(
                IllegalArgumentException.class,
                () -> new OperationsAuditQuery.WorkspaceAccount(new AuditTarget("STORE", id), 1, 20));
    }
}
