package com.catering.v2s.app.edge.operations.organization;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import com.catering.v2s.app.edge.generated.wire.HeadCompanyBrandAuthorizationAddRequest;
import com.catering.v2s.app.edge.operations.session.OperationsSessionResolver;
import com.catering.v2s.app.edge.operations.session.OperationsSessionCookie;
import com.catering.v2s.app.edge.problem.InvalidEdgeRequestException;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.organization.application.BusinessEntityService;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import com.catering.v2s.workspace.iam.application.WorkspaceAuthenticationService;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class OperationsHeadCompanyAuthorizationControllerTest {
    private static final String WORKSPACE_KEY = "operations-test";
    private static final String IDEMPOTENCY_KEY = "r24-edge-idempotency-key";

    @Test
    void addDelegatesOneBrandCommandAndReturnsNoContentWithoutReadback() {
        Fixture fixture = fixture();
        UUID headCompanyId = UUID.randomUUID();
        UUID brandId = UUID.randomUUID();

        var response = fixture.controller().add(fixture.request(), WORKSPACE_KEY, headCompanyId, IDEMPOTENCY_KEY, new HeadCompanyBrandAuthorizationAddRequest(brandId.toString()));

        assertEquals(HttpStatus.NO_CONTENT, response.getStatusCode());
        assertEquals(null, response.getBody());
        verify(fixture.entities()).addHeadCompanyBrandAuthorization(fixture.workspaceId(), WORKSPACE_KEY, headCompanyId, brandId, IDEMPOTENCY_KEY, fixture.actor());
        verifyNoMoreInteractions(fixture.entities());
    }

    @Test
    void removeDelegatesOneBrandCommandAndReturnsNoContentWithoutReadback() {
        Fixture fixture = fixture();
        UUID headCompanyId = UUID.randomUUID();
        UUID brandId = UUID.randomUUID();

        var response = fixture.controller().remove(fixture.request(), WORKSPACE_KEY, headCompanyId, brandId.toString(), IDEMPOTENCY_KEY);

        assertEquals(HttpStatus.NO_CONTENT, response.getStatusCode());
        assertEquals(null, response.getBody());
        verify(fixture.entities()).removeHeadCompanyBrandAuthorization(fixture.workspaceId(), WORKSPACE_KEY, headCompanyId, brandId, IDEMPOTENCY_KEY, fixture.actor());
        verifyNoMoreInteractions(fixture.entities());
    }

    @Test
    void malformedBrandIdIsRejectedBeforeItCanReachAnOwnerCommand() {
        Fixture fixture = fixture();

        assertThrows(InvalidEdgeRequestException.class, () -> fixture.controller().add(fixture.request(), WORKSPACE_KEY, UUID.randomUUID(), IDEMPOTENCY_KEY, new HeadCompanyBrandAuthorizationAddRequest("not-a-uuid")));

        verifyNoInteractions(fixture.entities());
    }

    private static Fixture fixture() {
        UUID workspaceId = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();
        WorkspaceSessionReadback session = new WorkspaceSessionReadback(UUID.randomUUID(), workspaceId, WORKSPACE_KEY, accountId, UUID.randomUUID(), UUID.randomUUID(), 1L, 1L, Set.of(), Set.of(), "Operations tester");
        WorkspaceAuthenticationService authentication = mock(WorkspaceAuthenticationService.class);
        when(authentication.session("operations-session")).thenReturn(session);
        BusinessEntityService entities = mock(BusinessEntityService.class);
        OperationsHeadCompanyAuthorizationController controller = new OperationsHeadCompanyAuthorizationController(new OperationsSessionResolver(authentication), entities);
        EdgeRequestContext request = new EdgeRequestContext("test-rate-limit-fingerprint", "test-correlation", null, OperationsSessionCookie.fromCookie("operations-session"), null, null, null);
        return new Fixture(controller, entities, request, workspaceId, new AuditActor("WORKSPACE_ACCOUNT", accountId, "Operations tester"));
    }

    private record Fixture(OperationsHeadCompanyAuthorizationController controller, BusinessEntityService entities, EdgeRequestContext request, UUID workspaceId, AuditActor actor) { }
}
