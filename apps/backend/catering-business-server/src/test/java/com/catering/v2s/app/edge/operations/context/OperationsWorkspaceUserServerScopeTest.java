package com.catering.v2s.app.edge.operations.context;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.catering.v2s.app.edge.operations.session.OperationsSessionResolver;
import com.catering.v2s.app.edge.operations.session.OperationsSessionCookie;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.app.edge.generated.wire.WorkspaceUserRevokeRequest;
import com.catering.v2s.app.edge.generated.wire.SortDirection;
import com.catering.v2s.app.edge.generated.wire.WorkspaceUserSortKey;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import com.catering.v2s.workspace.iam.application.WorkspaceAccountService;
import com.catering.v2s.workspace.iam.application.WorkspaceAuthenticationService;
import com.catering.v2s.workspace.iam.application.WorkspaceUserService;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class OperationsWorkspaceUserServerScopeTest {
    private static final String KEY = "operations-test";

    @Test
    void userPageDelegatesRequestedScopeToOwnerTaskRead() {
        UUID scopeRef = UUID.randomUUID();
        Fixture fixture = fixture();
        when(fixture.user.page(argThat(query -> query.operationsSession() == fixture.session && "STORE".equals(query.targetType()) && scopeRef.equals(query.requestedScopeRef()) && "DISPLAY_NAME".equals(query.sort()) && "DESC".equals(query.direction()))))
            .thenReturn(new WorkspaceUserService.AccountPage(List.of(), 1, 20, 0L, "STORE", scopeRef.toString(), "group/store", fixture.session.contextVersion(), "DISPLAY_NAME", "DESC"));

        var result = fixture.controller.storePage(fixture.request, KEY, scopeRef, null, null, null, null, WorkspaceUserSortKey.DISPLAY_NAME, SortDirection.DESC, 1, 20, fixture.session.contextVersion());

        assertEquals("STORE", result.targetOrganizationType().wire());
        assertEquals(WorkspaceUserSortKey.DISPLAY_NAME, result.criteria().sort());
        assertEquals(SortDirection.DESC, result.criteria().direction());
        verify(fixture.user).page(argThat(query -> query.operationsSession() == fixture.session && "STORE".equals(query.targetType()) && scopeRef.equals(query.requestedScopeRef()) && "DISPLAY_NAME".equals(query.sort()) && "DESC".equals(query.direction())));
    }

    @Test
    void userPageDefaultsToLoginNameAscending() {
        UUID scopeRef = UUID.randomUUID();
        Fixture fixture = fixture();
        when(fixture.user.page(argThat(query -> query.operationsSession() == fixture.session && "STORE".equals(query.targetType()) && scopeRef.equals(query.requestedScopeRef()) && query.sort() == null && query.direction() == null)))
            .thenReturn(new WorkspaceUserService.AccountPage(List.of(), 1, 20, 0L, "STORE", scopeRef.toString(), "group/store", fixture.session.contextVersion(), "LOGIN_NAME", "ASC"));

        var result = fixture.controller.storePage(fixture.request, KEY, scopeRef, null, null, null, null, null, null, 1, 20, fixture.session.contextVersion());

        assertEquals(WorkspaceUserSortKey.LOGIN_NAME, result.criteria().sort());
        assertEquals(SortDirection.ASC, result.criteria().direction());
        verify(fixture.user).page(argThat(query -> query.operationsSession() == fixture.session && "STORE".equals(query.targetType()) && scopeRef.equals(query.requestedScopeRef()) && query.sort() == null && query.direction() == null));
    }

    @Test
    void userRevokeDoesNotExposeUnusedScopeRef() {
        assertFalse(List.of(WorkspaceUserRevokeRequest.class.getRecordComponents()).stream()
            .anyMatch(component -> component.getName().equals("scopeRef")));
    }

    @Test
    void staleContextVersionIsAnOptimisticConflictInsteadOfAnAuthenticationFailure() {
        Fixture fixture = fixture();

        assertThrows(
            WorkspaceAuthenticationService.SessionConflictException.class,
            () -> new OperationsSessionResolver(fixture.authentication).requireWorkspaceAtContextVersion(
                fixture.request, KEY, fixture.session.contextVersion() - 1
            )
        );
    }

    private static Fixture fixture() {
        WorkspaceSessionReadback session = new WorkspaceSessionReadback(UUID.randomUUID(), UUID.randomUUID(), KEY, UUID.randomUUID(), UUID.randomUUID(), com.catering.v2s.workspace.iam.api.WorkspaceSessionEntryReadback.ScopeContext.empty(), 7L, 1L, Set.of(), Set.of(), "Operations tester");
        WorkspaceAuthenticationService authentication = mock(WorkspaceAuthenticationService.class);
        when(authentication.session("operations-session")).thenReturn(session);
        var readFacts = mock(com.catering.v2s.workspace.iam.application.WorkspaceReadAuthorizationFacts.class);
        when(readFacts.sessionReadback()).thenReturn(session);
        when(authentication.readAuthorizationFacts("operations-session")).thenReturn(readFacts);
        WorkspaceUserService user = mock(WorkspaceUserService.class);
        OperationsWorkspaceUserController controller = new OperationsWorkspaceUserController(new OperationsSessionResolver(authentication), user, mock(WorkspaceAccountService.class), new com.catering.v2s.workspace.iam.application.WorkspaceTaskReadService(user, null, authentication));
        EdgeRequestContext request = new EdgeRequestContext("test-rate-limit-fingerprint", "test-correlation", null, OperationsSessionCookie.fromCookie("operations-session"), null, null, null);
        return new Fixture(controller, user, request, session, authentication);
    }

    private record Fixture(OperationsWorkspaceUserController controller, WorkspaceUserService user, EdgeRequestContext request, WorkspaceSessionReadback session, WorkspaceAuthenticationService authentication) { }
}
