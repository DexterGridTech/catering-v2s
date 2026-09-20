package com.catering.v2s.organization.application.operations;

import com.catering.v2s.organization.api.StoreServicePointOwnerApi;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation transaction boundary for service-point area reordering. */
@Component
public class PostOperationsStoreServicePointAreaOrderOperation {
    public static final String OPERATION_ID = "postOperationsStoreServicePointAreaOrder";
    private final StoreServicePointOwnerApi owner;

    public PostOperationsStoreServicePointAreaOrderOperation(StoreServicePointOwnerApi owner) {
        this.owner = owner;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public StoreServicePointOwnerApi.Area execute(StoreServicePointOwnerApi.OrderCommand command) {
        return owner.moveArea(command);
    }
}
