package com.catering.v2s.app.edge.operations.organization;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.platform.foundation.contract.ServiceNodeTypes;
import com.catering.v2s.storeterminal.api.StoreTerminalOwnerApi;
import com.catering.v2s.terminalbinding.api.TerminalBindingOwnerApi;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import com.catering.v2s.workspace.iam.application.WorkspaceCapabilityScopeResolver;
import com.catering.v2s.workspace.iam.application.WorkspaceCapabilityScopeResolver.Decision;
import com.catering.v2s.workspace.iam.application.WorkspaceCapabilityScopeResolver.FirstOwnerQueryPredicate;
import com.catering.v2s.workspace.iam.application.WorkspaceCapabilityScopeResolver.ScopeResolution;
import com.catering.v2s.workspace.iam.application.WorkspaceCommandAuthorizationService;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;

class OperationsStoreTerminalActivationCancellationTest {
    private static final String REQUIREMENT_ID = "REQ_CANCEL_OPERATIONS_STORE_TERMINAL_ACTIVATION";
    private static final String GROUP_KEY = "group-1";
    private static final UUID WORKSPACE = UUID.randomUUID();
    private static final UUID STORE = UUID.randomUUID();
    private static final UUID TERMINAL = UUID.randomUUID();

    @Test
    void resolvesGrantAndOwnerTargetBeforeCallingBindingOwner() {
        WorkspaceCapabilityScopeResolver scopes = mock(WorkspaceCapabilityScopeResolver.class);
        StoreTerminalOwnerApi storeTerminals = mock(StoreTerminalOwnerApi.class);
        TerminalBindingOwnerApi terminalBindings = mock(TerminalBindingOwnerApi.class);
        WorkspaceSessionReadback session = session();
        var serverGrant = new com.catering.v2s.organization.api.OperationsOwnerScopeGrant(
                WORKSPACE,
                GROUP_KEY,
                REQUIREMENT_ID,
                "EDIT_STORE_TERMINAL",
                ServiceNodeTypes.STORE,
                STORE,
                "GROUP",
                UUID.randomUUID(),
                List.of(),
                session.contextVersion());
        when(scopes.resolveGeneratedOperation(
                        eq(session),
                        eq(REQUIREMENT_ID),
                        eq("EDIT_STORE_TERMINAL"),
                        any(WorkspaceCapabilityScopeResolver.ServerResolvedResource.class)))
                .thenReturn(allowed(serverGrant));
        var ownerTarget =
                new StoreTerminalOwnerApi.OperationsActivationCancellationTarget(WORKSPACE, GROUP_KEY, STORE, TERMINAL);
        when(storeTerminals.resolveOperationsActivationCancellationTarget(
                        WORKSPACE, GROUP_KEY, STORE, TERMINAL, session.contextVersion(), serverGrant))
                .thenReturn(ownerTarget);
        when(terminalBindings.cancelByOperations(any()))
                .thenReturn(TerminalBindingOwnerApi.OperationsCancelOutcome.CANCELLED);
        var coordinator = new OperationsStoreTerminalActivationCancellation(scopes, storeTerminals, terminalBindings);

        var result = coordinator.execute(session, STORE, TERMINAL, 9L, "request-00000001", AuditActor.system());

        assertEquals(TerminalBindingOwnerApi.OperationsCancelOutcome.CANCELLED, result);
        InOrder order = inOrder(scopes, storeTerminals, terminalBindings);
        order.verify(scopes)
                .resolveGeneratedOperation(
                        eq(session),
                        eq(REQUIREMENT_ID),
                        eq("EDIT_STORE_TERMINAL"),
                        any(WorkspaceCapabilityScopeResolver.ServerResolvedResource.class));
        order.verify(storeTerminals)
                .resolveOperationsActivationCancellationTarget(
                        WORKSPACE, GROUP_KEY, STORE, TERMINAL, session.contextVersion(), serverGrant);
        ArgumentCaptor<TerminalBindingOwnerApi.OperationsCancelCommand> command =
                ArgumentCaptor.forClass(TerminalBindingOwnerApi.OperationsCancelCommand.class);
        order.verify(terminalBindings).cancelByOperations(command.capture());
        assertEquals(WORKSPACE, command.getValue().target().workspaceUuid());
        assertEquals(STORE, command.getValue().target().storeRef());
        assertEquals(REQUIREMENT_ID, command.getValue().grant().requirementId());
        assertEquals(session.contextVersion(), command.getValue().contextVersion());
    }

    @Test
    void deniedCapabilityNeverReadsTargetOrCallsBindingOwner() {
        WorkspaceCapabilityScopeResolver scopes = mock(WorkspaceCapabilityScopeResolver.class);
        StoreTerminalOwnerApi storeTerminals = mock(StoreTerminalOwnerApi.class);
        TerminalBindingOwnerApi terminalBindings = mock(TerminalBindingOwnerApi.class);
        WorkspaceSessionReadback session = session();
        when(scopes.resolveGeneratedOperation(
                        eq(session),
                        eq(REQUIREMENT_ID),
                        eq("EDIT_STORE_TERMINAL"),
                        any(WorkspaceCapabilityScopeResolver.ServerResolvedResource.class)))
                .thenReturn(new ScopeResolution(Decision.DENY, null, null));
        var coordinator = new OperationsStoreTerminalActivationCancellation(scopes, storeTerminals, terminalBindings);

        assertThrows(
                WorkspaceCommandAuthorizationService.AuthorizationDeniedException.class,
                () -> coordinator.execute(session, STORE, TERMINAL, 9L, "request-00000001", AuditActor.system()));

        verifyNoInteractions(storeTerminals, terminalBindings);
    }

    private static ScopeResolution allowed(com.catering.v2s.organization.api.OperationsOwnerScopeGrant grant) {
        return new ScopeResolution(
                Decision.ALLOW,
                grant.capabilityKey(),
                new FirstOwnerQueryPredicate(
                        grant.workspaceUuid(),
                        grant.groupWorkspaceKey(),
                        grant.targetType(),
                        grant.targetId(),
                        grant.assignmentNodeType(),
                        grant.assignmentNodeId(),
                        grant.targetAncestorIds(),
                        grant.expectedContextVersion()));
    }

    private static WorkspaceSessionReadback session() {
        return new WorkspaceSessionReadback(
                UUID.randomUUID(),
                WORKSPACE,
                GROUP_KEY,
                UUID.randomUUID(),
                UUID.randomUUID(),
                null,
                17L,
                1L,
                Set.of(),
                Set.of(),
                "operator",
                "GROUP",
                UUID.randomUUID());
    }
}
