package com.catering.v2s.organization.application.operations;

import com.catering.v2s.organization.api.CommercialGroupReadback;
import com.catering.v2s.organization.api.OperationsCommercialGroupCommandApi;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation transaction boundary for an operations commercial-group update. */
@Component
public class UpdateOperationsCommercialGroupOperation {
    public static final String OPERATION_ID = "updateOperationsCommercialGroup";
    private final OperationsCommercialGroupCommandApi commercialGroups;

    public UpdateOperationsCommercialGroupOperation(OperationsCommercialGroupCommandApi commercialGroups) {
        this.commercialGroups = commercialGroups;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public CommercialGroupReadback execute(OperationsCommercialGroupCommandApi.UpdateCommand command) {
        return commercialGroups.update(command);
    }
}
