package com.catering.v2s.collaboration.application.operations;

import com.catering.v2s.collaboration.api.CollaborationCommandApi;
import com.catering.v2s.collaboration.api.CollaborationReadback;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation transaction boundary for an operations collaboration binding update. */
@Component
public class UpdateOperationsOwnerBindingOperation {
    public static final String OPERATION_ID = "updateOperationsOwnerBinding";
    private final CollaborationCommandApi collaboration;

    public UpdateOperationsOwnerBindingOperation(CollaborationCommandApi collaboration) {
        this.collaboration = collaboration;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public CollaborationReadback.OwnerBinding execute(CollaborationCommandApi.UpdateOperationsBindingCommand command) {
        return collaboration.updateOperationsBinding(command);
    }
}
