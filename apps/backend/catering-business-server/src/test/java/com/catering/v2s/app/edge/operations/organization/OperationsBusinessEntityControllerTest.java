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
import com.catering.v2s.organization.application.BusinessEntityService;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import com.catering.v2s.workspace.iam.application.WorkspaceAuthenticationService;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class OperationsBusinessEntityControllerTest {
    private static final String WORKSPACE_KEY = "operations-business-entity-test";

    @Test
    void brandPagePassesTheClosedQueryToTheOwnerAndReturnsTheOwnerTotalWithoutLocalSlicing() {
        UUID workspaceId = UUID.randomUUID();
        WorkspaceAuthenticationService authentication = mock(WorkspaceAuthenticationService.class);
        when(authentication.session("operations-session")).thenReturn(new WorkspaceSessionReadback(UUID.randomUUID(), workspaceId, WORKSPACE_KEY, UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), 1L, 9L, Set.of(), Set.of(), "Operations tester"));
        BusinessEntityService entities = mock(BusinessEntityService.class);
        when(entities.pageBrands(workspaceId, WORKSPACE_KEY, "brand", "BR", "ENABLED", "NAME", "ASC", 3, 7))
            .thenReturn(new BusinessEntityService.BrandPage(List.of(), 51, 3, 7));
        OperationsBusinessEntityController controller = new OperationsBusinessEntityController(new OperationsSessionResolver(authentication), entities);
        EdgeRequestContext request = new EdgeRequestContext("test-rate-limit-fingerprint", "test-correlation", null, OperationsSessionCookie.fromCookie("operations-session"), null, null, null);

        var response = controller.brands(request, WORKSPACE_KEY, 1L, "brand", "BR", BusinessEntityStatus.ENABLED, "NAME", "ASC", 3, 7);

        assertEquals(51L, response.metadata().total());
        assertEquals(3L, response.metadata().page());
        assertEquals(7L, response.metadata().pageSize());
        assertEquals(List.of(), response.items());
        verify(entities).pageBrands(workspaceId, WORKSPACE_KEY, "brand", "BR", "ENABLED", "NAME", "ASC", 3, 7);
        verifyNoMoreInteractions(entities);
    }

    @Test
    void tenantAndHeadCompanyPagesPassTheirClosedQueriesToTheOwnerWithoutEdgeLocalPaging() {
        UUID workspaceId = UUID.randomUUID();
        WorkspaceAuthenticationService authentication = mock(WorkspaceAuthenticationService.class);
        when(authentication.session("operations-session")).thenReturn(new WorkspaceSessionReadback(UUID.randomUUID(), workspaceId, WORKSPACE_KEY, UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), 1L, 9L, Set.of(), Set.of(), "Operations tester"));
        BusinessEntityService entities = mock(BusinessEntityService.class);
        when(entities.pageEntities("TENANT", workspaceId, WORKSPACE_KEY, "tenant", "TN", "ENABLED", "NAME", "ASC", 2, 5)).thenReturn(new BusinessEntityService.EntityPage(List.of(), 12, 2, 5));
        when(entities.pageEntities("HEAD_COMPANY", workspaceId, WORKSPACE_KEY, "head", "HC", "DISABLED", "UPDATED_AT", "DESC", 4, 3)).thenReturn(new BusinessEntityService.EntityPage(List.of(), 9, 4, 3));
        OperationsBusinessEntityController controller = new OperationsBusinessEntityController(new OperationsSessionResolver(authentication), entities);
        EdgeRequestContext request = new EdgeRequestContext("test-rate-limit-fingerprint", "test-correlation", null, OperationsSessionCookie.fromCookie("operations-session"), null, null, null);

        var tenants = controller.tenants(request, WORKSPACE_KEY, 1L, "tenant", "TN", BusinessEntityStatus.ENABLED, "NAME", "ASC", 2, 5);
        var headCompanies = controller.headCompanies(request, WORKSPACE_KEY, 1L, "head", "HC", BusinessEntityStatus.DISABLED, "UPDATED_AT", "DESC", 4, 3);

        assertEquals(12L, tenants.metadata().total());
        assertEquals(9L, headCompanies.metadata().total());
        verify(entities).pageEntities("TENANT", workspaceId, WORKSPACE_KEY, "tenant", "TN", "ENABLED", "NAME", "ASC", 2, 5);
        verify(entities).pageEntities("HEAD_COMPANY", workspaceId, WORKSPACE_KEY, "head", "HC", "DISABLED", "UPDATED_AT", "DESC", 4, 3);
        verifyNoMoreInteractions(entities);
    }
}
