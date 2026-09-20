package com.catering.v2s.organization.application.operations;

import com.catering.v2s.organization.api.StoreServicePointOwnerApi;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation transaction boundary for service-point area status changes. */
@Component
public class PostOperationsStoreServicePointAreaStatusOperation {
    public static final String OPERATION_ID = "postOperationsStoreServicePointAreaStatus";
    private final StoreServicePointOwnerApi owner;

    public PostOperationsStoreServicePointAreaStatusOperation(StoreServicePointOwnerApi owner) {
        this.owner = owner;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public StoreServicePointOwnerApi.Area execute(StoreServicePointOwnerApi.StatusCommand command) {
        return owner.transitionArea(command);
    }
}
