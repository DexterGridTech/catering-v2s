package com.catering.v2s.organization.application.operations;

import com.catering.v2s.organization.api.StoreServicePointOwnerApi;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation transaction boundary for service-point reordering. */
@Component
public class PostOperationsStoreServicePointOrderOperation {
    public static final String OPERATION_ID = "postOperationsStoreServicePointOrder";
    private final StoreServicePointOwnerApi owner;

    public PostOperationsStoreServicePointOrderOperation(StoreServicePointOwnerApi owner) {
        this.owner = owner;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public StoreServicePointOwnerApi.Point execute(StoreServicePointOwnerApi.OrderCommand command) {
        return owner.movePoint(command);
    }
}
