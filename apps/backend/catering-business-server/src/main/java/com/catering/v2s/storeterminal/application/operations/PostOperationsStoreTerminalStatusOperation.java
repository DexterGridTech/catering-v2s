package com.catering.v2s.storeterminal.application.operations;

import com.catering.v2s.storeterminal.api.StoreTerminalOwnerApi;
import com.catering.v2s.terminalbinding.api.TerminalBindingOwnerApi;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation transaction boundary for store-terminal lifecycle changes. */
@Component
public class PostOperationsStoreTerminalStatusOperation {
    public static final String OPERATION_ID = "postOperationsStoreTerminalStatus";

    private final StoreTerminalOwnerApi owner;
    private final TerminalBindingOwnerApi terminalBindings;

    public PostOperationsStoreTerminalStatusOperation(
            StoreTerminalOwnerApi owner, TerminalBindingOwnerApi terminalBindings) {
        this.owner = owner;
        this.terminalBindings = terminalBindings;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public StoreTerminalOwnerApi.TerminalMutation execute(StoreTerminalOwnerApi.StatusCommand command) {
        StoreTerminalOwnerApi.TerminalMutation mutation = owner.transitionTerminalStatus(command);
        if ("VOIDED".equals(mutation.status())) {
            terminalBindings.endForTerminalVoid(new TerminalBindingOwnerApi.TerminalVoidCommand(
                    command.workspaceUuid(), command.groupWorkspaceKey(), command.terminalRef(), command.actor()));
        }
        return mutation;
    }
}
