package com.catering.v2s.store.contract.application;

import com.catering.v2s.contract.api.OperationsStoreContractCommandApi;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation transaction boundary for a Contract invalidation and final task view. */
@Component
public class InvalidateOperationsContractOperation {
    public static final String OPERATION_ID = "invalidateOperationsContract";
    private final OperationsStoreContractCommandApi contracts;
    private final OperationsStoreContractCommandApi.TaskReadbackApi taskReads;

    public InvalidateOperationsContractOperation(
            OperationsStoreContractCommandApi contracts, OperationsStoreContractCommandApi.TaskReadbackApi taskReads) {
        this.contracts = contracts;
        this.taskReads = taskReads;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public OperationsStoreContractCommandApi.StoreContractTaskReadback execute(
            OperationsStoreContractCommandApi.InvalidateCommand command) {
        contracts.invalidate(command);
        return taskReads.readTaskView(new OperationsStoreContractCommandApi.TaskViewQuery(
                command.workspaceUuid(), command.groupWorkspaceKey(), command.contractId()));
    }
}
