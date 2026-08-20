package com.catering.v2s.collaboration.application.operations;

import com.catering.v2s.collaboration.api.CollaborationCommandApi;
import com.catering.v2s.collaboration.api.CollaborationReadback;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation transaction boundary for an operations collaboration binding command. */
@Component
public class CreateOperationsOwnerBindingOperation {
    public static final String OPERATION_ID = "createOperationsOwnerBinding";
    private final CollaborationCommandApi collaboration;

    public CreateOperationsOwnerBindingOperation(CollaborationCommandApi collaboration) {
        this.collaboration = collaboration;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public CollaborationReadback.OwnerBinding execute(CollaborationCommandApi.CreateOperationsBindingCommand command) {
        return collaboration.createOperationsBinding(command);
    }
}
