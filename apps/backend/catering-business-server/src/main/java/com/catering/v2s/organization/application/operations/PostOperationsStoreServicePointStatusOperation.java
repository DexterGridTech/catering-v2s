package com.catering.v2s.organization.application.operations;

import com.catering.v2s.organization.api.StoreServicePointOwnerApi;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation transaction boundary for service-point status changes. */
@Component
public class PostOperationsStoreServicePointStatusOperation {
    public static final String OPERATION_ID = "postOperationsStoreServicePointStatus";
    private final StoreServicePointOwnerApi owner;

    public PostOperationsStoreServicePointStatusOperation(StoreServicePointOwnerApi owner) {
        this.owner = owner;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public StoreServicePointOwnerApi.Point execute(StoreServicePointOwnerApi.StatusCommand command) {
        return owner.transitionPoint(command);
    }
}
