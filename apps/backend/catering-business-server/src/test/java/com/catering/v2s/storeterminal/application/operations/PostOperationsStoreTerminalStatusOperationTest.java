package com.catering.v2s.storeterminal.application.operations;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.storeterminal.api.StoreTerminalOwnerApi;
import com.catering.v2s.terminalbinding.api.TerminalBindingOwnerApi;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;

class PostOperationsStoreTerminalStatusOperationTest {
    @Test
    void voidStatusCoordinatesBothOwnersInOrder() {
        UUID workspace = UUID.randomUUID();
        String groupKey = "terminal-status-test";
        UUID terminalRef = UUID.randomUUID();
        AuditActor actor = AuditActor.system();
        StoreTerminalOwnerApi owner = mock(StoreTerminalOwnerApi.class);
        TerminalBindingOwnerApi binding = mock(TerminalBindingOwnerApi.class);
        StoreTerminalOwnerApi.StatusCommand command = mock(StoreTerminalOwnerApi.StatusCommand.class);
        when(command.workspaceUuid()).thenReturn(workspace);
        when(command.groupWorkspaceKey()).thenReturn(groupKey);
        when(command.terminalRef()).thenReturn(terminalRef);
        when(command.actor()).thenReturn(actor);
        StoreTerminalOwnerApi.TerminalMutation mutation =
                new StoreTerminalOwnerApi.TerminalMutation(terminalRef, 9, "VOIDED");
        when(owner.transitionTerminalStatus(command)).thenReturn(mutation);

        StoreTerminalOwnerApi.TerminalMutation result =
                new PostOperationsStoreTerminalStatusOperation(owner, binding).execute(command);

        assertEquals(mutation, result);
        InOrder order = inOrder(owner, binding);
        order.verify(owner).transitionTerminalStatus(command);
        order.verify(binding)
                .endForTerminalVoid(
                        new TerminalBindingOwnerApi.TerminalVoidCommand(workspace, groupKey, terminalRef, actor));
    }

    @Test
    void nonVoidStatusDoesNotCallBindingOwner() {
        StoreTerminalOwnerApi owner = mock(StoreTerminalOwnerApi.class);
        TerminalBindingOwnerApi binding = mock(TerminalBindingOwnerApi.class);
        StoreTerminalOwnerApi.StatusCommand command = mock(StoreTerminalOwnerApi.StatusCommand.class);
        StoreTerminalOwnerApi.TerminalMutation mutation =
                new StoreTerminalOwnerApi.TerminalMutation(UUID.randomUUID(), 4, "DISABLED");
        when(owner.transitionTerminalStatus(command)).thenReturn(mutation);

        assertEquals(mutation, new PostOperationsStoreTerminalStatusOperation(owner, binding).execute(command));

        verify(binding, never()).endForTerminalVoid(org.mockito.ArgumentMatchers.any());
    }
}
