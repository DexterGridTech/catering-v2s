package com.catering.v2s.app.edge.operations.organization;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import com.catering.v2s.app.edge.generated.wire.BusinessEntityStatus;
import com.catering.v2s.app.edge.operations.session.OperationsSessionCookie;
import com.catering.v2s.app.edge.operations.session.OperationsSessionResolver;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.organization.api.OrganizationEntityReadback;
import com.catering.v2s.organization.application.BusinessEntityService;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import com.catering.v2s.workspace.iam.application.WorkspaceAuthenticationService;
import com.catering.v2s.workspace.iam.application.WorkspaceCapabilityScopeResolver;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;

class OperationsBusinessEntityControllerTest {
    private static final String WORKSPACE_KEY = "operations-business-entity-test";

    @Test
    void brandPagePassesTheClosedQueryToTheOwnerAndReturnsTheOwnerTotalWithoutLocalSlicing() {
        UUID workspaceId = UUID.randomUUID();
        WorkspaceAuthenticationService authentication = mock(WorkspaceAuthenticationService.class);
        WorkspaceSessionReadback session = new WorkspaceSessionReadback(UUID.randomUUID(), workspaceId, WORKSPACE_KEY, UUID.randomUUID(), UUID.randomUUID(), com.catering.v2s.workspace.iam.api.WorkspaceSessionEntryReadback.ScopeContext.empty(), 1L, 9L, Set.of(), Set.of(), "Operations tester");
        when(authentication.session("operations-session")).thenReturn(session);
        readFacts(authentication, session);
        BusinessEntityService entities = mock(BusinessEntityService.class);
        when(entities.pageBrands(workspaceId, WORKSPACE_KEY, "brand", "ENABLED", "NAME", "ASC", 3, 7))
            .thenReturn(new BusinessEntityService.BrandPage(List.of(), 51, 3, 7));
        OperationsBusinessEntityController controller = new OperationsBusinessEntityController(new OperationsSessionResolver(authentication), entities, mock(WorkspaceCapabilityScopeResolver.class));
        EdgeRequestContext request = new EdgeRequestContext("test-rate-limit-fingerprint", "test-correlation", null, OperationsSessionCookie.fromCookie("operations-session"), null, null, null);

        var response = controller.brands(request, WORKSPACE_KEY, 1L, "brand", BusinessEntityStatus.ENABLED, "NAME", "ASC", 3, 7);

        assertEquals(51L, response.metadata().total());
        assertEquals(3L, response.metadata().page());
        assertEquals(7L, response.metadata().pageSize());
        assertEquals(List.of(), response.items());
        verify(entities).pageBrands(workspaceId, WORKSPACE_KEY, "brand", "ENABLED", "NAME", "ASC", 3, 7);
        verifyNoMoreInteractions(entities);
    }

    @Test
    void tenantAndHeadCompanyPagesPassTheirClosedQueriesToTheOwnerWithoutEdgeLocalPaging() {
        UUID workspaceId = UUID.randomUUID();
        WorkspaceAuthenticationService authentication = mock(WorkspaceAuthenticationService.class);
        WorkspaceSessionReadback session = new WorkspaceSessionReadback(UUID.randomUUID(), workspaceId, WORKSPACE_KEY, UUID.randomUUID(), UUID.randomUUID(), com.catering.v2s.workspace.iam.api.WorkspaceSessionEntryReadback.ScopeContext.empty(), 1L, 9L, Set.of(), Set.of(), "Operations tester");
        when(authentication.session("operations-session")).thenReturn(session);
        readFacts(authentication, session);
        BusinessEntityService entities = mock(BusinessEntityService.class);
        when(entities.pageEntities("TENANT", workspaceId, WORKSPACE_KEY, "tenant", "TN", "Tenant Legal", "91310000TENANT", "ENABLED", "NAME", "ASC", 2, 5)).thenReturn(new BusinessEntityService.EntityPage(List.of(), 12, 2, 5));
        when(entities.pageEntities("HEAD_COMPANY", workspaceId, WORKSPACE_KEY, "head", "HC", "Head Legal", "91310000HEAD", "DISABLED", "UPDATED_AT", "DESC", 4, 3)).thenReturn(new BusinessEntityService.EntityPage(List.of(), 9, 4, 3));
        OperationsBusinessEntityController controller = new OperationsBusinessEntityController(new OperationsSessionResolver(authentication), entities, mock(WorkspaceCapabilityScopeResolver.class));
        EdgeRequestContext request = new EdgeRequestContext("test-rate-limit-fingerprint", "test-correlation", null, OperationsSessionCookie.fromCookie("operations-session"), null, null, null);

        var tenants = controller.tenants(request, WORKSPACE_KEY, 1L, "tenant", "TN", "Tenant Legal", "91310000TENANT", BusinessEntityStatus.ENABLED, "NAME", "ASC", 2, 5);
        var headCompanies = controller.headCompanies(request, WORKSPACE_KEY, 1L, "head", "HC", "Head Legal", "91310000HEAD", BusinessEntityStatus.DISABLED, "UPDATED_AT", "DESC", 4, 3);

        assertEquals(12L, tenants.metadata().total());
        assertEquals(9L, headCompanies.metadata().total());
        verify(entities).pageEntities("TENANT", workspaceId, WORKSPACE_KEY, "tenant", "TN", "Tenant Legal", "91310000TENANT", "ENABLED", "NAME", "ASC", 2, 5);
        verify(entities).pageEntities("HEAD_COMPANY", workspaceId, WORKSPACE_KEY, "head", "HC", "Head Legal", "91310000HEAD", "DISABLED", "UPDATED_AT", "DESC", 4, 3);
        verifyNoMoreInteractions(entities);
    }

    @Test
    void headCompanyPagesReturnSummaryRowsWithoutHydratingAuthorizedBrands() {
        UUID workspaceId = UUID.randomUUID();
        WorkspaceAuthenticationService authentication = mock(WorkspaceAuthenticationService.class);
        WorkspaceSessionReadback session = new WorkspaceSessionReadback(UUID.randomUUID(), workspaceId, WORKSPACE_KEY, UUID.randomUUID(), UUID.randomUUID(), com.catering.v2s.workspace.iam.api.WorkspaceSessionEntryReadback.ScopeContext.empty(), 1L, 9L, Set.of(), Set.of(), "Operations tester");
        when(authentication.session("operations-session")).thenReturn(session);
        readFacts(authentication, session);
        BusinessEntityService entities = mock(BusinessEntityService.class);
        OperationsBusinessEntityController controller = new OperationsBusinessEntityController(new OperationsSessionResolver(authentication), entities, mock(WorkspaceCapabilityScopeResolver.class));
        EdgeRequestContext request = new EdgeRequestContext("test-rate-limit-fingerprint", "test-correlation", null, OperationsSessionCookie.fromCookie("operations-session"), null, null, null);

        for (int itemCount : List.of(1, 20, 50)) {
            List<OrganizationEntityReadback> heads = IntStream.range(0, itemCount).mapToObj(index -> entity("HEAD_COMPANY", workspaceId, "head-" + index)).toList();
            when(entities.pageEntities("HEAD_COMPANY", workspaceId, WORKSPACE_KEY, null, null, null, null, null, "NAME", "ASC", 1, itemCount))
                .thenReturn(new BusinessEntityService.EntityPage(heads, itemCount, 1, itemCount));

            var response = controller.headCompanies(request, WORKSPACE_KEY, 1L, null, null, null, null, null, "NAME", "ASC", 1, itemCount);

            assertEquals(itemCount, response.items().size());
        }
        verifyNoMoreInteractions(entities);
    }

    private static OrganizationEntityReadback entity(String type, UUID workspaceId, String code) {
        return new OrganizationEntityReadback(UUID.randomUUID(), type, workspaceId, WORKSPACE_KEY, code, code,
            type + " legal", type + " credit", "ENABLED", 1L, null, null, null, 0L, 1L, 1L, Map.of());
    }

    private static void readFacts(WorkspaceAuthenticationService authentication, WorkspaceSessionReadback session) {
        var facts = mock(com.catering.v2s.workspace.iam.application.WorkspaceReadAuthorizationFacts.class);
        when(facts.sessionReadback()).thenReturn(session);
        when(authentication.readAuthorizationFacts("operations-session")).thenReturn(facts);
    }
}
