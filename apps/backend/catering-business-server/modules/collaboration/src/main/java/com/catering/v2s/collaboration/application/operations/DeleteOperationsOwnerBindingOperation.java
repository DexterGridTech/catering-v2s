package com.catering.v2s.collaboration.application.operations;

import com.catering.v2s.collaboration.api.CollaborationCommandApi;
import com.catering.v2s.collaboration.api.CollaborationReadback;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation transaction boundary for an operations collaboration binding deletion. */
@Component
public class DeleteOperationsOwnerBindingOperation {
    public static final String OPERATION_ID = "deleteOperationsOwnerBinding";
    private final CollaborationCommandApi collaboration;

    public DeleteOperationsOwnerBindingOperation(CollaborationCommandApi collaboration) {
        this.collaboration = collaboration;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public CollaborationReadback.OwnerBinding execute(CollaborationCommandApi.DeleteOperationsBindingCommand command) {
        return collaboration.requestOrDeleteOperationsBinding(command);
    }
}
