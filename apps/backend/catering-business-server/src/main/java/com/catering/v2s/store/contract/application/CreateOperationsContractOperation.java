package com.catering.v2s.store.contract.application;

import com.catering.v2s.contract.api.OperationsStoreContractCommandApi;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation transaction boundary for a Contract create and its required final task view. */
@Component
public class CreateOperationsContractOperation {
    public static final String OPERATION_ID = "createOperationsContract";
    private final OperationsStoreContractCommandApi contracts;
    private final OperationsStoreContractCommandApi.TaskReadbackApi taskReads;

    public CreateOperationsContractOperation(OperationsStoreContractCommandApi contracts,
                                             OperationsStoreContractCommandApi.TaskReadbackApi taskReads) {
        this.contracts = contracts;
        this.taskReads = taskReads;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public OperationsStoreContractCommandApi.StoreContractTaskReadback execute(OperationsStoreContractCommandApi.CreateCommand command) {
        var contract = contracts.create(command);
        return taskReads.readTaskView(new OperationsStoreContractCommandApi.TaskViewQuery(command.workspaceUuid(), command.groupWorkspaceKey(), contract.id()));
    }
}
