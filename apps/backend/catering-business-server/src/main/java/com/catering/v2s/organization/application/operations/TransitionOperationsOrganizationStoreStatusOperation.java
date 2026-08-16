package com.catering.v2s.organization.application.operations;

import com.catering.v2s.contract.api.OperationsStoreContractCommandApi;
import com.catering.v2s.organization.api.OperationsStoreCommandApi;
import com.catering.v2s.organization.api.OrganizationEntityReadback;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation transaction boundary for a Store status transition and final readback. */
@Component
public class TransitionOperationsOrganizationStoreStatusOperation {
    public static final String OPERATION_ID = "transitionOperationsOrganizationStoreStatus";
    private final OperationsStoreCommandApi stores;
    private final OperationsStoreCommandApi.StoreDetailReadbackApi organizationDetails;
    private final OperationsStoreContractCommandApi.StoreStatusReadbackApi contractStatuses;

    public TransitionOperationsOrganizationStoreStatusOperation(
            OperationsStoreCommandApi stores,
            OperationsStoreCommandApi.StoreDetailReadbackApi organizationDetails,
            OperationsStoreContractCommandApi.StoreStatusReadbackApi contractStatuses) {
        this.stores = stores;
        this.organizationDetails = organizationDetails;
        this.contractStatuses = contractStatuses;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public Result execute(OperationsStoreCommandApi.StoreStatusCommand command) {
        OrganizationEntityReadback store = stores.transitionStoreStatus(command);
        return new Result(
                store,
                organizationDetails.readStoreDetail(new OperationsStoreCommandApi.StoreDetailQuery(
                        command.workspaceUuid(), command.groupWorkspaceKey(), store.id())),
                contractStatuses
                        .readDerivedStoreStatus(new OperationsStoreContractCommandApi.StoreStatusQuery(
                                command.workspaceUuid(), command.groupWorkspaceKey(), store.id()))
                        .status());
    }

    public record Result(
            OrganizationEntityReadback store,
            OperationsStoreCommandApi.StoreOrganizationDetailReadback organizationDetail,
            String contractDerivedStatus) {}
}
