package com.catering.v2s.organization.application.operations;

import com.catering.v2s.organization.api.StoreServicePointOwnerApi;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation transaction boundary for a service-point area update. */
@Component
public class PatchOperationsStoreServicePointAreaOperation {
    public static final String OPERATION_ID = "patchOperationsStoreServicePointArea";
    private final StoreServicePointOwnerApi owner;

    public PatchOperationsStoreServicePointAreaOperation(StoreServicePointOwnerApi owner) {
        this.owner = owner;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public StoreServicePointOwnerApi.Area execute(StoreServicePointOwnerApi.AreaCommand command) {
        return owner.updateArea(command);
    }
}
