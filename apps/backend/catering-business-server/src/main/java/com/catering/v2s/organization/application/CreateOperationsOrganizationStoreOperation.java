package com.catering.v2s.organization.application;

import com.catering.v2s.contract.api.OperationsStoreContractCommandApi;
import com.catering.v2s.organization.api.OrganizationEntityReadback;
import com.catering.v2s.organization.api.OperationsStoreCommandApi;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation transaction boundary for a Store create and its required final readback. */
@Component
public class CreateOperationsOrganizationStoreOperation {
    public static final String OPERATION_ID = "createOperationsOrganizationStore";
    private final OperationsStoreCommandApi stores;
    private final OperationsStoreCommandApi.StoreDetailReadbackApi organizationDetails;
    private final OperationsStoreContractCommandApi.StoreStatusReadbackApi contractStatuses;

    public CreateOperationsOrganizationStoreOperation(OperationsStoreCommandApi stores,
                                                       OperationsStoreCommandApi.StoreDetailReadbackApi organizationDetails,
                                                       OperationsStoreContractCommandApi.StoreStatusReadbackApi contractStatuses) {
        this.stores = stores;
        this.organizationDetails = organizationDetails;
        this.contractStatuses = contractStatuses;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public Result execute(OperationsStoreCommandApi.CreateStoreCommand command) {
        OrganizationEntityReadback store = stores.createStore(command);
        return new Result(
            store,
            organizationDetails.readStoreDetail(new OperationsStoreCommandApi.StoreDetailQuery(command.workspaceUuid(), command.groupWorkspaceKey(), store.id())),
            contractStatuses.readDerivedStoreStatus(new OperationsStoreContractCommandApi.StoreStatusQuery(command.workspaceUuid(), command.groupWorkspaceKey(), store.id())).status()
        );
    }

    public record Result(OrganizationEntityReadback store,
                         OperationsStoreCommandApi.StoreOrganizationDetailReadback organizationDetail,
                         String contractDerivedStatus) { }
}
