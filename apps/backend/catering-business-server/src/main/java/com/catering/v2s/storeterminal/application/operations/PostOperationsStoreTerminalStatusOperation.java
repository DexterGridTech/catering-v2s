package com.catering.v2s.storeterminal.application.operations;

import com.catering.v2s.storeterminal.api.StoreTerminalOwnerApi;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation transaction boundary for store-terminal lifecycle changes. */
@Component
public class PostOperationsStoreTerminalStatusOperation {
    public static final String OPERATION_ID = "postOperationsStoreTerminalStatus";

    private final StoreTerminalOwnerApi owner;

    public PostOperationsStoreTerminalStatusOperation(StoreTerminalOwnerApi owner) {
        this.owner = owner;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public StoreTerminalOwnerApi.TerminalMutation execute(StoreTerminalOwnerApi.StatusCommand command) {
        return owner.transitionTerminalStatus(command);
    }
}
