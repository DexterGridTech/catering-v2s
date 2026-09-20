package com.catering.v2s.organization.application.operations;

import com.catering.v2s.organization.api.StoreServicePointOwnerApi;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation transaction boundary for a service-point update. */
@Component
public class PatchOperationsStoreServicePointOperation {
    public static final String OPERATION_ID = "patchOperationsStoreServicePoint";
    private final StoreServicePointOwnerApi owner;

    public PatchOperationsStoreServicePointOperation(StoreServicePointOwnerApi owner) {
        this.owner = owner;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public StoreServicePointOwnerApi.Point execute(StoreServicePointOwnerApi.PointCommand command) {
        return owner.updatePoint(command);
    }
}
