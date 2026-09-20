package com.catering.v2s.organization.application.operations;

import com.catering.v2s.organization.api.StoreServicePointOwnerApi;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation transaction boundary for service-point area creation. */
@Component
public class PostOperationsStoreServicePointAreaOperation {
    public static final String OPERATION_ID = "postOperationsStoreServicePointArea";
    private final StoreServicePointOwnerApi owner;

    public PostOperationsStoreServicePointAreaOperation(StoreServicePointOwnerApi owner) {
        this.owner = owner;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public StoreServicePointOwnerApi.Area execute(StoreServicePointOwnerApi.AreaCommand command) {
        return owner.createArea(command);
    }
}
