package com.catering.v2s.app.edge.platform.workspaceiam;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.catering.v2s.app.edge.generated.wire.ServiceNodeType;
import com.catering.v2s.app.edge.generated.wire.SortDirection;
import com.catering.v2s.app.edge.generated.wire.WorkspaceAccountStatus;
import com.catering.v2s.app.edge.generated.wire.WorkspaceAccountStatusTransitionRequest;
import com.catering.v2s.app.edge.generated.wire.WorkspacePlatformAccountSortKey;
import com.catering.v2s.app.edge.platform.session.PlatformSessionCookie;
import com.catering.v2s.app.edge.platform.session.PlatformSessionResolver;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.organization.api.OrganizationTaskPathLookup;
import com.catering.v2s.platform.iam.api.PlatformSessionReadback;
import com.catering.v2s.platform.iam.application.PlatformAuthenticationService;
import com.catering.v2s.platform.workspace.api.WorkspaceAdministrationReadback;
import com.catering.v2s.platform.workspace.application.WorkspaceAdministrationService;
import com.catering.v2s.workspace.iam.application.PlatformWorkspaceAccountTaskReadService;
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
        when(fixture.reads.page(org.mockito.ArgumentMatchers.argThat(query -> query.operationsSession() == null
                        && fixture.workspace.workspaceUuid().equals(query.workspaceUuid())
                        && "STORE".equals(query.targetType())
                        && organizationRef.equals(query.organizationRef())
                        && "UPDATED_AT".equals(query.sort())
                        && "DESC".equals(query.direction()))))
                .thenReturn(new WorkspaceUserService.AccountPage(
                        List.of(), 1, 50, 0L, null, null, null, null, "UPDATED_AT", "DESC"));

        var result = fixture.controller.list(
                fixture.request,
                KEY,
                null,
                null,
                null,
                null,
                null,
                ServiceNodeType.STORE,
                organizationRef.toString(),
                WorkspacePlatformAccountSortKey.UPDATED_AT,
                SortDirection.DESC,
                1,
                50);

        assertEquals(WorkspacePlatformAccountSortKey.UPDATED_AT, result.sort());
        assertEquals(SortDirection.DESC, result.direction());
        verify(fixture.reads)
                .page(org.mockito.ArgumentMatchers.argThat(query -> query.operationsSession() == null
                        && fixture.workspace.workspaceUuid().equals(query.workspaceUuid())
                        && "STORE".equals(query.targetType())
                        && organizationRef.equals(query.organizationRef())
                        && "UPDATED_AT".equals(query.sort())
                        && "DESC".equals(query.direction())));
    }

    @Test
    void platformAccountListKeepsOwnerDefaultWhenSortIsAbsent() {
        Fixture fixture = fixture();
        when(fixture.reads.page(org.mockito.ArgumentMatchers.argThat(query -> query.operationsSession() == null
                        && fixture.workspace.workspaceUuid().equals(query.workspaceUuid())
                        && query.targetType() == null
                        && query.organizationRef() == null
                        && query.sort() == null
                        && query.direction() == null)))
                .thenReturn(new WorkspaceUserService.AccountPage(
                        List.of(), 1, 50, 0L, null, null, null, null, "LOGIN_NAME", "ASC"));

        var result = fixture.controller.list(
                fixture.request, KEY, null, null, null, null, null, null, null, null, null, 1, 50);

        assertEquals(WorkspacePlatformAccountSortKey.LOGIN_NAME, result.sort());
        assertEquals(SortDirection.ASC, result.direction());
        verify(fixture.reads)
                .page(org.mockito.ArgumentMatchers.argThat(query -> query.operationsSession() == null
                        && fixture.workspace.workspaceUuid().equals(query.workspaceUuid())
                        && query.targetType() == null
                        && query.organizationRef() == null
                        && query.sort() == null
                        && query.direction() == null));
    }

    @Test
    void platformAccountStatusUsesCombinedOwnerTransitionAndFullReadback() {
        Fixture fixture = fixture();
        UUID accountId = UUID.randomUUID();
        String idempotencyKey = "platform-account-status-001";
        UUID assignmentId = UUID.randomUUID();
        UUID storeId = UUID.randomUUID();
        UUID invitationId = UUID.randomUUID();
        UUID authenticationId = UUID.randomUUID();
        OrganizationTaskPathLookup.TaskPathNode store =
                new OrganizationTaskPathLookup.TaskPathNode(storeId, "store-1", "Store one", "STORE");
        WorkspaceUserService.User readback = new WorkspaceUserService.User(
                accountId,
                "Updated user",
                "13800000071",
                "138****0071",
                "updated-user",
                "DISABLED",
                "CHANGE_REQUIRED",
                1,
                List.of(new WorkspaceUserService.Assignment(
                        assignmentId,
                        accountId,
                        UUID.randomUUID(),
                        "Store manager",
                        "STORE",
                        List.of(store),
                        "ACTIVE",
                        "INVITATION",
                        3L,
                        4L,
                        5L,
                        storeId)),
                List.of(new WorkspaceUserService.Invitation(invitationId, "ACTIVE", 2, 8L)),
                7L,
                List.of(new WorkspaceUserService.AuthenticationHistory(authenticationId, 6L)),
                1L,
                2L,
                2L);
        when(fixture.reads.transitionStatusAndReadback(
                        eq(fixture.workspace.workspaceUuid()),
                        eq(KEY),
                        eq(accountId),
                        eq("DISABLED"),
                        eq(1L),
                        eq(idempotencyKey),
                        any(AuditActor.class)))
                .thenReturn(readback);

        var result = fixture.controller.status(
                fixture.request,
                KEY,
                accountId,
                idempotencyKey,
                new WorkspaceAccountStatusTransitionRequest(WorkspaceAccountStatus.DISABLED, 1L));

        assertEquals(accountId.toString(), result.id());
        assertEquals(WorkspaceAccountStatus.DISABLED, result.status());
        assertEquals("Updated user", result.displayName());
        assertEquals("CHANGE_REQUIRED", result.credentialStatus());
        assertEquals(1L, result.activeAssignmentCount());
        assertEquals(
                "Store one",
                result.assignments()
                        .getFirst()
                        .organizationPathNodes()
                        .getFirst()
                        .name());
        assertEquals(
                invitationId.toString(), result.invitationHistory().getFirst().invitationId());
        assertEquals(6L, result.authenticationHistory().getFirst().authenticatedAt());
        verify(fixture.reads)
                .transitionStatusAndReadback(
                        eq(fixture.workspace.workspaceUuid()),
                        eq(KEY),
                        eq(accountId),
                        eq("DISABLED"),
                        eq(1L),
                        eq(idempotencyKey),
                        any(AuditActor.class));
    }

    private static Fixture fixture() {
        UUID workspaceUuid = UUID.randomUUID();
        PlatformAuthenticationService authentication = mock(PlatformAuthenticationService.class);
        when(authentication.requireActiveSession("platform-session"))
                .thenReturn(new PlatformSessionReadback(
                        UUID.randomUUID(), 1L, UUID.randomUUID(), "Platform tester", Long.MAX_VALUE));
        WorkspaceAdministrationService workspaces = mock(WorkspaceAdministrationService.class);
        WorkspaceAdministrationReadback workspace = new WorkspaceAdministrationReadback(
                workspaceUuid, KEY, "Test workspace", "Operations", null, null, "ENABLED", 1L, 1L, 1L, 1L, true);
        when(workspaces.requireEnabled(KEY)).thenReturn(workspace);
        PlatformWorkspaceAccountTaskReadService reads = mock(PlatformWorkspaceAccountTaskReadService.class);
        PlatformWorkspaceAccountController controller = new PlatformWorkspaceAccountController(
                new PlatformSessionResolver(authentication),
                workspaces,
                mock(WorkspaceAccountService.class),
                mock(WorkspacePasswordResetService.class),
                reads);
        EdgeRequestContext request = new EdgeRequestContext(
                "test-fingerprint",
                "test-correlation",
                PlatformSessionCookie.fromCookie("platform-session"),
                null,
                null,
                null,
                null);
        return new Fixture(controller, reads, workspace, request);
    }

    private record Fixture(
            PlatformWorkspaceAccountController controller,
            PlatformWorkspaceAccountTaskReadService reads,
            WorkspaceAdministrationReadback workspace,
            EdgeRequestContext request) {}
}
