package com.catering.v2s.organization.application.operations;

import com.catering.v2s.contract.api.OperationsStoreContractCommandApi;
import com.catering.v2s.organization.api.OperationsStoreCommandApi;
import com.catering.v2s.organization.api.OrganizationEntityReadback;
import com.catering.v2s.organization.api.OrganizationOwnerApi;
import com.catering.v2s.organization.api.StoreOperatingRuleReadback;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation transaction boundary for a Store update and its required final readback. */
@Component
public class UpdateOperationsOrganizationStoreOperation {
    public static final String OPERATION_ID = "updateOperationsOrganizationStore";
    private final OperationsStoreCommandApi stores;
    private final OperationsStoreCommandApi.StoreDetailReadbackApi organizationDetails;
    private final OperationsStoreContractCommandApi.StoreStatusReadbackApi contractStatuses;
    private final OrganizationOwnerApi operatingRuleOwner;

    public UpdateOperationsOrganizationStoreOperation(
            OperationsStoreCommandApi stores,
            OperationsStoreCommandApi.StoreDetailReadbackApi organizationDetails,
            OperationsStoreContractCommandApi.StoreStatusReadbackApi contractStatuses,
            OrganizationOwnerApi operatingRuleOwner) {
        this.stores = stores;
        this.organizationDetails = organizationDetails;
        this.contractStatuses = contractStatuses;
        this.operatingRuleOwner = operatingRuleOwner;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public Result execute(OperationsStoreCommandApi.UpdateStoreCommand command) {
        OrganizationEntityReadback store = stores.updateStore(command);
        StoreOperatingRuleReadback operatingRules = operatingRuleOwner.requireStoreOperatingRuleSwitches(
                command.workspaceUuid(), command.groupWorkspaceKey(), store.id());
        return new Result(
                store,
                organizationDetails.readStoreDetail(new OperationsStoreCommandApi.StoreDetailQuery(
                        command.workspaceUuid(), command.groupWorkspaceKey(), store.id())),
                contractStatuses
                        .readDerivedStoreStatus(new OperationsStoreContractCommandApi.StoreStatusQuery(
                                command.workspaceUuid(), command.groupWorkspaceKey(), store.id()))
                        .status(),
                operatingRules);
    }

    public record Result(
            OrganizationEntityReadback store,
            OperationsStoreCommandApi.StoreOrganizationDetailReadback organizationDetail,
            String contractDerivedStatus,
            StoreOperatingRuleReadback operatingRules) {}
}
