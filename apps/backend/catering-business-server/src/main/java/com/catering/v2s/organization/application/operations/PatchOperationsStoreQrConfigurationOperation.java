package com.catering.v2s.organization.application.operations;

import com.catering.v2s.organization.api.StoreServicePointOwnerApi;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation transaction boundary for the store QR configuration update. */
@Component
public class PatchOperationsStoreQrConfigurationOperation {
    public static final String OPERATION_ID = "patchOperationsStoreQrConfiguration";
    private final StoreServicePointOwnerApi owner;

    public PatchOperationsStoreQrConfigurationOperation(StoreServicePointOwnerApi owner) {
        this.owner = owner;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public StoreServicePointOwnerApi.QrConfiguration execute(StoreServicePointOwnerApi.QrConfigurationCommand command) {
        return owner.updateQrConfiguration(command);
    }
}
