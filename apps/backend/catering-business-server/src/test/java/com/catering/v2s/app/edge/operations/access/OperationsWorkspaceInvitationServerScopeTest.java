package com.catering.v2s.app.edge.operations.access;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.argThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.catering.v2s.app.edge.generated.wire.WorkspaceOperationsInvitationCreateRequest;
import com.catering.v2s.app.edge.generated.wire.WorkspaceOperationsInvitationActionRequest;
import com.catering.v2s.app.edge.generated.wire.SortDirection;
import com.catering.v2s.app.edge.generated.wire.WorkspaceInvitationSortKey;
import com.catering.v2s.app.edge.operations.session.OperationsSessionResolver;
import com.catering.v2s.app.edge.operations.session.OperationsSessionCookie;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.organization.api.OrganizationTaskPathLookup;
import com.catering.v2s.workspace.iam.api.WorkspaceInvitationReadback;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import com.catering.v2s.workspace.iam.application.WorkspaceAuthenticationService;
import com.catering.v2s.workspace.iam.application.WorkspaceInvitationService;
import com.catering.v2s.workspace.iam.application.WorkspaceUserService;
import java.util.List;
import java.util.Map;
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
        when(fixture.invitations.managementPageForOperations(eq(fixture.session), eq("PROJECT"), eq(scopeRef), argThat(page -> "EXPIRES_AT".equals(page.sort()) && "ASC".equals(page.direction()))))
            .thenReturn(new WorkspaceInvitationService.ManagementInvitationPage(List.of(), 1, 20, 0L, new WorkspaceInvitationService.ManagementInvitationPageRequest(null, null, null, null, null, null, "EXPIRES_AT", "ASC", 1, 20)));

        var result = fixture.controller.projectList(fixture.request, KEY, scopeRef.toString(), null, null, null, null, null, null, WorkspaceInvitationSortKey.EXPIRES_AT, SortDirection.ASC, 1, 20, fixture.session.contextVersion());

        assertEquals(List.of(), result.items());
        assertEquals(WorkspaceInvitationSortKey.EXPIRES_AT, result.criteria().sort());
        assertEquals(SortDirection.ASC, result.criteria().direction());
        verify(fixture.invitations).managementPageForOperations(eq(fixture.session), eq("PROJECT"), eq(scopeRef), argThat(page -> "EXPIRES_AT".equals(page.sort()) && "ASC".equals(page.direction())));
    }

    @Test
    void invitationListDefaultsToCreatedAtDescending() {
        Fixture fixture = fixture();
        UUID scopeRef = UUID.randomUUID();
        when(fixture.invitations.managementPageForOperations(eq(fixture.session), eq("PROJECT"), eq(scopeRef), argThat(page -> "CREATED_AT".equals(page.sort()) && "DESC".equals(page.direction()))))
            .thenReturn(new WorkspaceInvitationService.ManagementInvitationPage(List.of(), 1, 20, 0L, new WorkspaceInvitationService.ManagementInvitationPageRequest(null, null, null, null, null, null, "CREATED_AT", "DESC", 1, 20)));

        var result = fixture.controller.projectList(fixture.request, KEY, scopeRef.toString(), null, null, null, null, null, null, null, null, 1, 20, fixture.session.contextVersion());

        assertEquals(WorkspaceInvitationSortKey.CREATED_AT, result.criteria().sort());
        assertEquals(SortDirection.DESC, result.criteria().direction());
        verify(fixture.invitations).managementPageForOperations(eq(fixture.session), eq("PROJECT"), eq(scopeRef), argThat(page -> "CREATED_AT".equals(page.sort()) && "DESC".equals(page.direction())));
    }

    @Test
    void createUsesOnlyOwnerResolvedTaskPathForAssignmentIntent() {
        Fixture fixture = fixture();
        UUID scopeRef = UUID.randomUUID();
        UUID targetId = UUID.randomUUID();
        UUID roleId = UUID.randomUUID();
        when(fixture.user.resolveCommandTarget(fixture.session, "STORE", scopeRef))
            .thenReturn(new OrganizationTaskPathLookup.TaskPath("STORE", targetId, List.of(targetId), "group/store"));
        WorkspaceInvitationReadback created = new WorkspaceInvitationReadback(UUID.randomUUID(), fixture.session.workspaceUuid(), KEY, "13800000000", "PENDING", 100L, 1L, 10L, null, null, null, null);
        when(fixture.invitations.createForOperations(eq(fixture.session.workspaceUuid()), eq(KEY), eq(fixture.session.currentAssignmentId()), eq("13800000000"), argThat(intents -> intents.size() == 1 && intents.getFirst().roleId().equals(roleId) && intents.getFirst().serviceNodeType().equals("STORE") && intents.getFirst().serviceNodeId().equals(targetId)), eq(IDEMPOTENCY_KEY), eq(fixture.actor)))
            .thenReturn(created);
        when(fixture.invitations.managementView(created)).thenReturn(new WorkspaceInvitationService.ManagementInvitationView(created.id(), KEY, "138****0000", "13800000000", "平台管理员", "STORE", "group/store", List.of("Store manager"), "PENDING", 1L, 100L, 1L, 10L, null, null, null, null));

        var response = fixture.controller.storeCreate(fixture.request, KEY, IDEMPOTENCY_KEY, new WorkspaceOperationsInvitationCreateRequest(scopeRef.toString(), "13800000000", List.of(roleId.toString()), fixture.session.contextVersion(), IDEMPOTENCY_KEY));

        assertEquals(201, response.getStatusCode().value());
        verify(fixture.authentication).session("operations-session");
        verify(fixture.user).resolveCommandTarget(fixture.session, "STORE", scopeRef);
        verify(fixture.invitations).createForOperations(eq(fixture.session.workspaceUuid()), eq(KEY), eq(fixture.session.currentAssignmentId()), eq("13800000000"), argThat(intents -> intents.size() == 1 && intents.getFirst().serviceNodeType().equals("STORE") && intents.getFirst().serviceNodeId().equals(targetId)), eq(IDEMPOTENCY_KEY), eq(fixture.actor));
    }

    @Test
    void candidateEndpointDelegatesScopeNarrowingToOwner() {
        Fixture fixture = fixture();
        UUID scopeRef = UUID.randomUUID();
        when(fixture.user.candidatesForOperations(fixture.session, "PROJECT", scopeRef, "ORGANIZATION", null, 1, 20, null))
            .thenReturn(new WorkspaceUserService.CandidatePage(new WorkspaceUserService.CandidateQueryMetadata("ORGANIZATION", null, 1, 20, 0, null), List.of(), List.of()));
        OperationsWorkspaceInvitationCandidateController candidates = new OperationsWorkspaceInvitationCandidateController(fixture.sessions, fixture.user);

        var result = candidates.projectCandidates(fixture.request, KEY, scopeRef, "ORGANIZATION", null, 1, 20, null, fixture.session.contextVersion());

        assertEquals(List.of(), result.organizations());
        verify(fixture.user).candidatesForOperations(fixture.session, "PROJECT", scopeRef, "ORGANIZATION", null, 1, 20, null);
    }

    @Test
    void invitationActionsDoNotExposeUnusedScopeRef() {
        assertFalse(List.of(WorkspaceOperationsInvitationActionRequest.class.getRecordComponents()).stream()
            .anyMatch(component -> component.getName().equals("scopeRef")));
    }

    private static Fixture fixture() {
        UUID accountId = UUID.randomUUID();
        WorkspaceSessionReadback session = new WorkspaceSessionReadback(UUID.randomUUID(), UUID.randomUUID(), KEY, accountId, UUID.randomUUID(), UUID.randomUUID(), 7L, 1L, Set.of(), Set.of(), "Operations tester");
        WorkspaceAuthenticationService authentication = mock(WorkspaceAuthenticationService.class);
        when(authentication.session("operations-session")).thenReturn(session);
        OperationsSessionResolver sessions = new OperationsSessionResolver(authentication);
        WorkspaceInvitationService invitations = mock(WorkspaceInvitationService.class);
        WorkspaceUserService user = mock(WorkspaceUserService.class);
        EdgeRequestContext request = new EdgeRequestContext("test-rate-limit-fingerprint", "test-correlation", null, OperationsSessionCookie.fromCookie("operations-session"), null, null, null);
        return new Fixture(new OperationsWorkspaceInvitationController(sessions, invitations, user), sessions, authentication, invitations, user, request, new AuditActor("WORKSPACE_ACCOUNT", accountId, "Operations tester"), session);
    }

    private record Fixture(OperationsWorkspaceInvitationController controller, OperationsSessionResolver sessions, WorkspaceAuthenticationService authentication, WorkspaceInvitationService invitations, WorkspaceUserService user, EdgeRequestContext request, AuditActor actor, WorkspaceSessionReadback session) { }
}
