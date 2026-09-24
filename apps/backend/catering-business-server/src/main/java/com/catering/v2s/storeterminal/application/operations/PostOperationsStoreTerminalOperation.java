package com.catering.v2s.storeterminal.application.operations;

import com.catering.v2s.storeterminal.api.StoreTerminalOwnerApi;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation transaction boundary for store-terminal creation. */
@Component
public class PostOperationsStoreTerminalOperation {
    public static final String OPERATION_ID = "postOperationsStoreTerminal";

    private final StoreTerminalOwnerApi owner;

    public PostOperationsStoreTerminalOperation(StoreTerminalOwnerApi owner) {
        this.owner = owner;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public StoreTerminalOwnerApi.TerminalMutation execute(StoreTerminalOwnerApi.CreateCommand command) {
        return owner.createTerminal(command);
    }
}
