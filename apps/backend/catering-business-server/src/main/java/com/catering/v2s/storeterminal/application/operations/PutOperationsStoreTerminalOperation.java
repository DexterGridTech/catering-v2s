package com.catering.v2s.storeterminal.application.operations;

import com.catering.v2s.storeterminal.api.StoreTerminalOwnerApi;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation transaction boundary for store-terminal replacement. */
@Component
public class PutOperationsStoreTerminalOperation {
    public static final String OPERATION_ID = "putOperationsStoreTerminal";

    private final StoreTerminalOwnerApi owner;

    public PutOperationsStoreTerminalOperation(StoreTerminalOwnerApi owner) {
        this.owner = owner;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public StoreTerminalOwnerApi.TerminalMutation execute(StoreTerminalOwnerApi.ReplaceCommand command) {
        return owner.replaceTerminal(command);
    }
}
