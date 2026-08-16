package com.catering.v2s.store.contract.application;

import com.catering.v2s.contract.api.OperationsStoreContractCommandApi;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation transaction boundary for a Contract update and its required final task view. */
@Component
public class UpdateOperationsContractOperation {
    public static final String OPERATION_ID = "updateOperationsContract";
    private final OperationsStoreContractCommandApi contracts;
    private final OperationsStoreContractCommandApi.TaskReadbackApi taskReads;

    public UpdateOperationsContractOperation(
            OperationsStoreContractCommandApi contracts, OperationsStoreContractCommandApi.TaskReadbackApi taskReads) {
        this.contracts = contracts;
        this.taskReads = taskReads;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public OperationsStoreContractCommandApi.StoreContractTaskReadback execute(
            OperationsStoreContractCommandApi.UpdateCommand command) {
        contracts.update(command);
        return taskReads.readTaskView(new OperationsStoreContractCommandApi.TaskViewQuery(
                command.workspaceUuid(), command.groupWorkspaceKey(), command.contractId()));
    }
}
