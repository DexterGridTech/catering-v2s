package com.catering.v2s.app.edge.operations.access;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.argThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.catering.v2s.app.edge.generated.wire.SortDirection;
import com.catering.v2s.app.edge.generated.wire.WorkspaceInvitationSortKey;
import com.catering.v2s.app.edge.generated.wire.WorkspaceInvitationStatus;
import com.catering.v2s.app.edge.generated.wire.WorkspaceOperationsInvitationActionRequest;
import com.catering.v2s.app.edge.generated.wire.WorkspaceOperationsInvitationCreateRequest;
import com.catering.v2s.app.edge.operations.session.OperationsSessionCookie;
import com.catering.v2s.app.edge.operations.session.OperationsSessionResolver;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.organization.api.OrganizationTaskPathLookup;
import com.catering.v2s.workspace.iam.api.WorkspaceInvitationReadback;
import com.catering.v2s.workspace.iam.api.WorkspaceOperationsCommandApi;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import com.catering.v2s.workspace.iam.application.WorkspaceAuthenticationService;
import com.catering.v2s.workspace.iam.application.WorkspaceInvitationService;
import com.catering.v2s.workspace.iam.application.WorkspaceUserService;
import com.catering.v2s.workspace.iam.application.operations.CancelOperationsWorkspaceInvitationOperation;
import com.catering.v2s.workspace.iam.application.operations.CreateOperationsWorkspaceInvitationOperation;
import com.catering.v2s.workspace.iam.application.operations.ReissueOperationsWorkspaceInvitationOperation;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class OperationsWorkspaceInvitationServerScopeTest {
    private static final String KEY = "operations-test";
    private static final String IDEMPOTENCY_KEY = "p3c-server-scope-key";

    @Test
    void invitationListDelegatesRequestedScopeToOwnerTaskRead() {
        Fixture fixture = fixture();
        UUID scopeRef = UUID.randomUUID();
        when(fixture.invitations.managementPageForOperations(
                        eq(fixture.session),
                        eq("PROJECT"),
                        eq(scopeRef),
                        argThat(page -> "EXPIRES_AT".equals(page.sort()) && "ASC".equals(page.direction()))))
                .thenReturn(new WorkspaceInvitationService.ManagementInvitationPage(
                        List.of(),
                        1,
                        20,
                        0L,
                        new WorkspaceInvitationService.ManagementInvitationPageRequest(
                                null, null, null, null, null, null, null, "EXPIRES_AT", "ASC", 1, 20)));

        var result = fixture.controller.projectList(
                fixture.request,
                KEY,
                scopeRef.toString(),
                null,
                null,
                null,
                null,
                null,
                null,
                WorkspaceInvitationSortKey.EXPIRES_AT,
                SortDirection.ASC,
                1,
                20,
                fixture.session.contextVersion());

        assertEquals(List.of(), result.items());
        assertEquals(WorkspaceInvitationSortKey.EXPIRES_AT, result.criteria().sort());
        assertEquals(SortDirection.ASC, result.criteria().direction());
        verify(fixture.invitations)
                .managementPageForOperations(
                        eq(fixture.session),
                        eq("PROJECT"),
                        eq(scopeRef),
                        argThat(page -> "EXPIRES_AT".equals(page.sort()) && "ASC".equals(page.direction())));
    }

    @Test
    void invitationListDefaultsToCreatedAtDescending() {
        Fixture fixture = fixture();
        UUID scopeRef = UUID.randomUUID();
        when(fixture.invitations.managementPageForOperations(
                        eq(fixture.session),
                        eq("PROJECT"),
                        eq(scopeRef),
                        argThat(page -> "CREATED_AT".equals(page.sort()) && "DESC".equals(page.direction()))))
                .thenReturn(new WorkspaceInvitationService.ManagementInvitationPage(
                        List.of(),
                        1,
                        20,
                        0L,
                        new WorkspaceInvitationService.ManagementInvitationPageRequest(
                                null, null, null, null, null, null, null, "CREATED_AT", "DESC", 1, 20)));

        var result = fixture.controller.projectList(
                fixture.request,
                KEY,
                scopeRef.toString(),
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                1,
                20,
                fixture.session.contextVersion());

        assertEquals(WorkspaceInvitationSortKey.CREATED_AT, result.criteria().sort());
        assertEquals(SortDirection.DESC, result.criteria().direction());
        verify(fixture.invitations)
                .managementPageForOperations(
                        eq(fixture.session),
                        eq("PROJECT"),
                        eq(scopeRef),
                        argThat(page -> "CREATED_AT".equals(page.sort()) && "DESC".equals(page.direction())));
    }

    @Test
    void createDelegatesUnresolvedScopeToTypedOwnerCommand() {
        Fixture fixture = fixture();
        UUID scopeRef = UUID.randomUUID();
        UUID roleId = UUID.randomUUID();
        WorkspaceInvitationReadback created = new WorkspaceInvitationReadback(
                UUID.randomUUID(),
                fixture.session.workspaceUuid(),
                KEY,
                "13800000000",
                "PENDING",
                100L,
                1L,
                10L,
                null,
                null,
                null,
                null);
        WorkspaceInvitationService.ManagementInvitationView view =
                new WorkspaceInvitationService.ManagementInvitationView(
                        created.id(),
                        KEY,
                        "138****0000",
                        "13800000000",
                        "平台管理员",
                        "STORE",
                        List.of(
                                new OrganizationTaskPathLookup.TaskPathNode(
                                        UUID.randomUUID(), "group", "Group", "GROUP"),
                                new OrganizationTaskPathLookup.TaskPathNode(
                                        UUID.randomUUID(), "store", "Store", "STORE")),
                        List.of("Store manager"),
                        "PENDING",
                        1L,
                        100L,
                        1L,
                        10L,
                        null,
                        null,
                        null,
                        null);
        when(fixture.commands.createInvitation(
                        argThat(command -> command.facts().sessionReadback() == fixture.session
                                && "STORE".equals(command.expectedTargetType())
                                && scopeRef.equals(command.requestedScopeRef())
                                && command.roleIds().equals(List.of(roleId))
                                && IDEMPOTENCY_KEY.equals(command.idempotencyKey())
                                && fixture.actor.equals(command.actor()))))
                .thenReturn(view);

        var response = fixture.controller.storeCreate(
                fixture.request,
                KEY,
                IDEMPOTENCY_KEY,
                new WorkspaceOperationsInvitationCreateRequest(
                        scopeRef, "13800000000", List.of(roleId.toString()), IDEMPOTENCY_KEY));

        assertEquals(201, response.getStatusCode().value());
        verify(fixture.authentication).commandAuthorizationFacts("operations-session");
        verify(fixture.commands)
                .createInvitation(argThat(command -> command.facts().sessionReadback() == fixture.session
                        && "STORE".equals(command.expectedTargetType())
                        && scopeRef.equals(command.requestedScopeRef())
                        && command.roleIds().equals(List.of(roleId))));
        verifyNoInteractions(fixture.user, fixture.invitations);
    }

    @Test
    void candidateEndpointDelegatesScopeNarrowingToOwner() {
        Fixture fixture = fixture();
        UUID scopeRef = UUID.randomUUID();
        when(fixture.user.candidates(
                        org.mockito.ArgumentMatchers.argThat(query -> query.operationsSession() == fixture.session
                                && "PROJECT".equals(query.targetType())
                                && scopeRef.equals(query.requestedScopeRef())
                                && "ORGANIZATION".equals(query.subjectType())
                                && "INVITATION_TARGET".equals(query.candidateUsage()))))
                .thenReturn(new WorkspaceUserService.CandidatePage(
                        new WorkspaceUserService.CandidateQueryMetadata("ORGANIZATION", null, 1, 20, 0, null),
                        List.of(),
                        List.of()));
        OperationsWorkspaceInvitationCandidateController candidates =
                new OperationsWorkspaceInvitationCandidateController(
                        fixture.sessions,
                        fixture.user,
                        new com.catering.v2s.workspace.iam.application.WorkspaceTaskReadService(
                                fixture.user, fixture.invitations, fixture.authentication));

        var result = candidates.projectCandidates(
                fixture.request,
                KEY,
                scopeRef,
                "ORGANIZATION",
                "INVITATION_TARGET",
                null,
                1,
                20,
                null,
                fixture.session.contextVersion());

        assertEquals(List.of(), result.organizations());
        verify(fixture.user)
                .candidates(org.mockito.ArgumentMatchers.argThat(query -> query.operationsSession() == fixture.session
                        && "PROJECT".equals(query.targetType())
                        && scopeRef.equals(query.requestedScopeRef())
                        && "ORGANIZATION".equals(query.subjectType())
                        && "INVITATION_TARGET".equals(query.candidateUsage())));
    }

    @Test
    void invitationActionsDelegateOwnerContextAndExactSelectedScope() {
        Fixture fixture = fixture();
        UUID scopeRef = UUID.randomUUID();
        UUID invitationId = UUID.randomUUID();
        WorkspaceInvitationReadback cancelled = new WorkspaceInvitationReadback(
                invitationId,
                fixture.session.workspaceUuid(),
                KEY,
                "13800000000",
                "CANCELLED",
                100L,
                2L,
                10L,
                null,
                null,
                11L,
                null);
        WorkspaceInvitationService.ManagementInvitationView view =
                new WorkspaceInvitationService.ManagementInvitationView(
                        invitationId,
                        KEY,
                        "138****0000",
                        "13800000000",
                        "平台管理员",
                        "PROJECT",
                        List.of(
                                new OrganizationTaskPathLookup.TaskPathNode(
                                        UUID.randomUUID(), "group", "Group", "GROUP"),
                                new OrganizationTaskPathLookup.TaskPathNode(
                                        UUID.randomUUID(), "project", "Project", "PROJECT")),
                        List.of("Project manager"),
                        "CANCELLED",
                        2L,
                        100L,
                        2L,
                        10L,
                        null,
                        null,
                        11L,
                        null);
        when(fixture.commands.cancelInvitation(
                        argThat(command -> command.facts().sessionReadback() == fixture.session
                                && "PROJECT".equals(command.expectedTargetType())
                                && scopeRef.equals(command.requestedScopeRef())
                                && invitationId.equals(command.invitationId())
                                && command.expectedVersion() == 1L
                                && IDEMPOTENCY_KEY.equals(command.idempotencyKey())
                                && fixture.actor.equals(command.actor()))))
                .thenReturn(view);

        var result = fixture.controller.projectCancel(
                fixture.request,
                KEY,
                invitationId,
                IDEMPOTENCY_KEY,
                new WorkspaceOperationsInvitationActionRequest(
                        scopeRef, fixture.session.contextVersion(), 1L, IDEMPOTENCY_KEY));

        assertEquals(WorkspaceInvitationStatus.CANCELLED, result.status());
        assertTrue(List.of(WorkspaceOperationsInvitationActionRequest.class.getRecordComponents()).stream()
                .anyMatch(component -> component.getName().equals("scopeRef")));
        assertTrue(List.of(WorkspaceOperationsInvitationActionRequest.class.getRecordComponents()).stream()
                .anyMatch(component -> component.getName().equals("expectedContextVersion")));
        verify(fixture.commands)
                .cancelInvitation(argThat(command -> command.facts().sessionReadback() == fixture.session
                        && "PROJECT".equals(command.expectedTargetType())
                        && scopeRef.equals(command.requestedScopeRef())
                        && invitationId.equals(command.invitationId())
                        && command.expectedVersion() == 1L));
        verifyNoInteractions(fixture.user, fixture.invitations);
    }

    @Test
    void reissueDelegatesOwnerContextAndExactSelectedScope() {
        Fixture fixture = fixture();
        UUID scopeRef = UUID.randomUUID();
        UUID invitationId = UUID.randomUUID();
        WorkspaceInvitationService.ManagementInvitationView view =
                new WorkspaceInvitationService.ManagementInvitationView(
                        invitationId,
                        KEY,
                        "138****0000",
                        "13800000000",
                        "平台管理员",
                        "PROJECT",
                        List.of(
                                new OrganizationTaskPathLookup.TaskPathNode(
                                        UUID.randomUUID(), "group", "Group", "GROUP"),
                                new OrganizationTaskPathLookup.TaskPathNode(
                                        UUID.randomUUID(), "project", "Project", "PROJECT")),
                        List.of("Project manager"),
                        "ACTIVE",
                        2L,
                        120L,
                        2L,
                        20L,
                        null,
                        null,
                        null,
                        null);
        when(fixture.commands.reissueInvitation(
                        argThat(command -> command.facts().sessionReadback() == fixture.session
                                && "PROJECT".equals(command.expectedTargetType())
                                && scopeRef.equals(command.requestedScopeRef())
                                && invitationId.equals(command.invitationId())
                                && command.expectedVersion() == 1L
                                && IDEMPOTENCY_KEY.equals(command.idempotencyKey())
                                && fixture.actor.equals(command.actor()))))
                .thenReturn(view);

        var result = fixture.controller.projectReissue(
                fixture.request,
                KEY,
                invitationId,
                IDEMPOTENCY_KEY,
                new WorkspaceOperationsInvitationActionRequest(
                        scopeRef, fixture.session.contextVersion(), 1L, IDEMPOTENCY_KEY));

        assertEquals(WorkspaceInvitationStatus.ACTIVE, result.status());
        verify(fixture.commands)
                .reissueInvitation(argThat(command -> command.facts().sessionReadback() == fixture.session
                        && "PROJECT".equals(command.expectedTargetType())
                        && scopeRef.equals(command.requestedScopeRef())
                        && invitationId.equals(command.invitationId())
                        && command.expectedVersion() == 1L));
        verifyNoInteractions(fixture.user, fixture.invitations);
    }

    @Test
    void staleInvitationActionContextIsRejectedBeforeAnyOwnerCommand() {
        Fixture fixture = fixture();
        UUID invitationId = UUID.randomUUID();

        assertThrows(
                WorkspaceAuthenticationService.SessionConflictException.class,
                () -> fixture.controller.projectCancel(
                        fixture.request,
                        KEY,
                        invitationId,
                        IDEMPOTENCY_KEY,
                        new WorkspaceOperationsInvitationActionRequest(
                                UUID.randomUUID(), fixture.session.contextVersion() + 1, 1L, IDEMPOTENCY_KEY)));

        verifyNoInteractions(fixture.user, fixture.invitations);
    }

    private static Fixture fixture() {
        UUID accountId = UUID.randomUUID();
        WorkspaceSessionReadback session = new WorkspaceSessionReadback(
                UUID.randomUUID(),
                UUID.randomUUID(),
                KEY,
                accountId,
                UUID.randomUUID(),
                com.catering.v2s.workspace.iam.api.WorkspaceSessionEntryReadback.ScopeContext.empty(),
                7L,
                1L,
                Set.of(),
                Set.of(),
                "Operations tester");
        WorkspaceAuthenticationService authentication = mock(WorkspaceAuthenticationService.class);
        when(authentication.session("operations-session")).thenReturn(session);
        var readFacts = mock(com.catering.v2s.workspace.iam.application.WorkspaceReadAuthorizationFacts.class);
        when(readFacts.sessionReadback()).thenReturn(session);
        when(readFacts.groupWorkspaceKey()).thenReturn(session.groupWorkspaceKey());
        when(authentication.readAuthorizationFacts("operations-session")).thenReturn(readFacts);
        var commandFacts = mock(com.catering.v2s.workspace.iam.application.WorkspaceCommandAuthorizationFacts.class);
        when(commandFacts.sessionReadback()).thenReturn(session);
        when(authentication.commandAuthorizationFacts("operations-session")).thenReturn(commandFacts);
        OperationsSessionResolver sessions = new OperationsSessionResolver(authentication);
        WorkspaceInvitationService invitations = mock(WorkspaceInvitationService.class);
        WorkspaceUserService user = mock(WorkspaceUserService.class);
        WorkspaceOperationsCommandApi commands = mock(WorkspaceOperationsCommandApi.class);
        EdgeRequestContext request = new EdgeRequestContext(
                "test-rate-limit-fingerprint",
                "test-correlation",
                null,
                OperationsSessionCookie.fromCookie("operations-session"),
                null,
                null,
                null);
        return new Fixture(
                new OperationsWorkspaceInvitationController(
                        sessions,
                        invitations,
                        user,
                        new com.catering.v2s.workspace.iam.application.WorkspaceTaskReadService(
                                user, invitations, authentication),
                        new CancelOperationsWorkspaceInvitationOperation(commands),
                        new CreateOperationsWorkspaceInvitationOperation(commands),
                        new ReissueOperationsWorkspaceInvitationOperation(commands)),
                sessions,
                authentication,
                invitations,
                user,
                commands,
                request,
                new AuditActor("WORKSPACE_ACCOUNT", accountId, "Operations tester"),
                session);
    }

    private record Fixture(
            OperationsWorkspaceInvitationController controller,
            OperationsSessionResolver sessions,
            WorkspaceAuthenticationService authentication,
            WorkspaceInvitationService invitations,
            WorkspaceUserService user,
            WorkspaceOperationsCommandApi commands,
            EdgeRequestContext request,
            AuditActor actor,
            WorkspaceSessionReadback session) {}
}
