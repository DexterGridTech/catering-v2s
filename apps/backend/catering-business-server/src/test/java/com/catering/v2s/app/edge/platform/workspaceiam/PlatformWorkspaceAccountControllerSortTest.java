package com.catering.v2s.app.edge.platform.workspaceiam;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.mock;

import com.catering.v2s.app.edge.generated.wire.SortDirection;
import com.catering.v2s.app.edge.generated.wire.ServiceNodeType;
import com.catering.v2s.app.edge.generated.wire.WorkspacePlatformAccountSortKey;
import com.catering.v2s.app.edge.platform.session.PlatformSessionCookie;
import com.catering.v2s.app.edge.platform.session.PlatformSessionResolver;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.platform.iam.api.PlatformSessionReadback;
import com.catering.v2s.platform.iam.application.PlatformAuthenticationService;
import com.catering.v2s.platform.workspace.api.WorkspaceAdministrationReadback;
import com.catering.v2s.platform.workspace.application.WorkspaceAdministrationService;
import com.catering.v2s.workspace.iam.application.WorkspaceAccountService;
import com.catering.v2s.workspace.iam.application.WorkspacePasswordResetService;
import com.catering.v2s.workspace.iam.application.WorkspaceUserService;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class PlatformWorkspaceAccountControllerSortTest {
    private static final String KEY = "platform-account-test";

    @Test
    void platformAccountListDelegatesRequestedSortToOwner() {
        Fixture fixture = fixture();
        UUID organizationRef = UUID.randomUUID();
        when(fixture.user.page(org.mockito.ArgumentMatchers.argThat(query -> query.operationsSession() == null && fixture.workspace.workspaceUuid().equals(query.workspaceUuid()) && "STORE".equals(query.targetType()) && organizationRef.equals(query.organizationRef()) && "UPDATED_AT".equals(query.sort()) && "DESC".equals(query.direction()))))
            .thenReturn(new WorkspaceUserService.AccountPage(List.of(), 1, 50, 0L, null, null, null, null, "UPDATED_AT", "DESC"));

        var result = fixture.controller.list(fixture.request, KEY, null, null, null, null, null, ServiceNodeType.STORE, organizationRef.toString(), WorkspacePlatformAccountSortKey.UPDATED_AT, SortDirection.DESC, 1, 50);

        assertEquals(WorkspacePlatformAccountSortKey.UPDATED_AT, result.sort());
        assertEquals(SortDirection.DESC, result.direction());
        verify(fixture.user).page(org.mockito.ArgumentMatchers.argThat(query -> query.operationsSession() == null && fixture.workspace.workspaceUuid().equals(query.workspaceUuid()) && "STORE".equals(query.targetType()) && organizationRef.equals(query.organizationRef()) && "UPDATED_AT".equals(query.sort()) && "DESC".equals(query.direction())));
    }

    @Test
    void platformAccountListKeepsOwnerDefaultWhenSortIsAbsent() {
        Fixture fixture = fixture();
        when(fixture.user.page(org.mockito.ArgumentMatchers.argThat(query -> query.operationsSession() == null && fixture.workspace.workspaceUuid().equals(query.workspaceUuid()) && query.targetType() == null && query.organizationRef() == null && query.sort() == null && query.direction() == null)))
            .thenReturn(new WorkspaceUserService.AccountPage(List.of(), 1, 50, 0L, null, null, null, null, "LOGIN_NAME", "ASC"));

        var result = fixture.controller.list(fixture.request, KEY, null, null, null, null, null, null, null, null, null, 1, 50);

        assertEquals(WorkspacePlatformAccountSortKey.LOGIN_NAME, result.sort());
        assertEquals(SortDirection.ASC, result.direction());
        verify(fixture.user).page(org.mockito.ArgumentMatchers.argThat(query -> query.operationsSession() == null && fixture.workspace.workspaceUuid().equals(query.workspaceUuid()) && query.targetType() == null && query.organizationRef() == null && query.sort() == null && query.direction() == null));
    }

    private static Fixture fixture() {
        UUID workspaceUuid = UUID.randomUUID();
        PlatformAuthenticationService authentication = mock(PlatformAuthenticationService.class);
        when(authentication.requireActiveSession("platform-session"))
            .thenReturn(new PlatformSessionReadback(UUID.randomUUID(), 1L, UUID.randomUUID(), "Platform tester", Long.MAX_VALUE));
        WorkspaceAdministrationService workspaces = mock(WorkspaceAdministrationService.class);
        WorkspaceAdministrationReadback workspace = new WorkspaceAdministrationReadback(workspaceUuid, KEY, "Test workspace", "Operations", null, null, "ENABLED", 1L, 1L, 1L, 1L, true);
        when(workspaces.requireEnabled(KEY)).thenReturn(workspace);
        WorkspaceUserService user = mock(WorkspaceUserService.class);
        PlatformWorkspaceAccountController controller = new PlatformWorkspaceAccountController(
            new PlatformSessionResolver(authentication), workspaces, mock(WorkspaceAccountService.class),
            mock(WorkspacePasswordResetService.class), user);
        EdgeRequestContext request = new EdgeRequestContext("test-fingerprint", "test-correlation", PlatformSessionCookie.fromCookie("platform-session"), null, null, null, null);
        return new Fixture(controller, user, workspace, request);
    }

    private record Fixture(PlatformWorkspaceAccountController controller, WorkspaceUserService user, WorkspaceAdministrationReadback workspace, EdgeRequestContext request) { }
}
