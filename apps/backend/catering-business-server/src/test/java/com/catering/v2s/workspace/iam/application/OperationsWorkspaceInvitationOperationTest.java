package com.catering.v2s.workspace.iam.application;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.catering.v2s.app.edge.generated.wire.WorkspaceOperationsInvitationActionRequest;
import com.catering.v2s.app.edge.generated.wire.WorkspaceOperationsInvitationCreateRequest;
import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.platform.foundation.contract.ServiceNodeTypes;
import com.catering.v2s.workspace.iam.api.WorkspaceOperationsCommandApi;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class OperationsWorkspaceInvitationOperationTest {
    private static final String IDEMPOTENCY_KEY = "s17-operation-test-key";

    @Test
    void createAdapterPreservesTargetScopeAndRequestValues() {
        WorkspaceOperationsCommandApi commands = mock(WorkspaceOperationsCommandApi.class);
        WorkspaceInvitationService.ManagementInvitationView view = view();
        when(commands.createInvitation(any())).thenReturn(view);
        WorkspaceCommandAuthorizationFacts facts = mock(WorkspaceCommandAuthorizationFacts.class);
        AuditActor actor = new AuditActor("WORKSPACE_ACCOUNT", UUID.randomUUID(), "S17 tester");
        UUID scopeRef = UUID.randomUUID();
        UUID roleId = UUID.randomUUID();

        assertSame(view, new CreateOperationsWorkspaceInvitationOperation(commands).execute(
            facts,
            ServiceNodeTypes.STORE,
            new WorkspaceOperationsInvitationCreateRequest(scopeRef, "13800000000", List.of(roleId.toString()), IDEMPOTENCY_KEY),
            actor
        ));

        ArgumentCaptor<WorkspaceOperationsCommandApi.InvitationCreateCommand> captured = ArgumentCaptor.forClass(WorkspaceOperationsCommandApi.InvitationCreateCommand.class);
        verify(commands).createInvitation(captured.capture());
        assertEquals(ServiceNodeTypes.STORE, captured.getValue().expectedTargetType());
        assertEquals(scopeRef, captured.getValue().requestedScopeRef());
        assertEquals(List.of(roleId), captured.getValue().roleIds());
        assertEquals(IDEMPOTENCY_KEY, captured.getValue().idempotencyKey());
        assertSame(actor, captured.getValue().actor());
    }

    @Test
    void cancelAdapterPreservesTargetScopeAndActionValues() {
        WorkspaceOperationsCommandApi commands = mock(WorkspaceOperationsCommandApi.class);
        WorkspaceInvitationService.ManagementInvitationView view = view();
        when(commands.cancelInvitation(any())).thenReturn(view);
        WorkspaceCommandAuthorizationFacts facts = mock(WorkspaceCommandAuthorizationFacts.class);
        AuditActor actor = new AuditActor("WORKSPACE_ACCOUNT", UUID.randomUUID(), "S17 tester");
        UUID scopeRef = UUID.randomUUID();
        UUID invitationId = UUID.randomUUID();

        assertSame(view, new CancelOperationsWorkspaceInvitationOperation(commands).execute(
            facts,
            ServiceNodeTypes.PROJECT,
            invitationId,
            new WorkspaceOperationsInvitationActionRequest(scopeRef, 4L, 7L, IDEMPOTENCY_KEY),
            actor
        ));

        ArgumentCaptor<WorkspaceOperationsCommandApi.InvitationActionCommand> captured = ArgumentCaptor.forClass(WorkspaceOperationsCommandApi.InvitationActionCommand.class);
        verify(commands).cancelInvitation(captured.capture());
        assertEquals(ServiceNodeTypes.PROJECT, captured.getValue().expectedTargetType());
        assertEquals(scopeRef, captured.getValue().requestedScopeRef());
        assertEquals(invitationId, captured.getValue().invitationId());
        assertEquals(7L, captured.getValue().expectedVersion());
    }

    @Test
    void reissueAdapterPreservesTargetScopeAndActionValues() {
        WorkspaceOperationsCommandApi commands = mock(WorkspaceOperationsCommandApi.class);
        WorkspaceInvitationService.ManagementInvitationView view = view();
        when(commands.reissueInvitation(any())).thenReturn(view);
        WorkspaceCommandAuthorizationFacts facts = mock(WorkspaceCommandAuthorizationFacts.class);
        AuditActor actor = new AuditActor("WORKSPACE_ACCOUNT", UUID.randomUUID(), "S17 tester");
        UUID scopeRef = UUID.randomUUID();
        UUID invitationId = UUID.randomUUID();

        assertSame(view, new ReissueOperationsWorkspaceInvitationOperation(commands).execute(
            facts,
            ServiceNodeTypes.HEAD_COMPANY,
            invitationId,
            new WorkspaceOperationsInvitationActionRequest(scopeRef, 4L, 8L, IDEMPOTENCY_KEY),
            actor
        ));

        ArgumentCaptor<WorkspaceOperationsCommandApi.InvitationActionCommand> captured = ArgumentCaptor.forClass(WorkspaceOperationsCommandApi.InvitationActionCommand.class);
        verify(commands).reissueInvitation(captured.capture());
        assertEquals(ServiceNodeTypes.HEAD_COMPANY, captured.getValue().expectedTargetType());
        assertEquals(scopeRef, captured.getValue().requestedScopeRef());
        assertEquals(invitationId, captured.getValue().invitationId());
        assertEquals(8L, captured.getValue().expectedVersion());
    }

    private static WorkspaceInvitationService.ManagementInvitationView view() {
        return new WorkspaceInvitationService.ManagementInvitationView(
            UUID.randomUUID(),
            "s17-workspace",
            "138****0000",
            "13800000000",
            "S17 tester",
            ServiceNodeTypes.STORE,
            "s17/store",
            List.of("S17 role"),
            "PENDING",
            1L,
            100L,
            1L,
            10L,
            null,
            null,
            null,
            null
        );
    }
}
