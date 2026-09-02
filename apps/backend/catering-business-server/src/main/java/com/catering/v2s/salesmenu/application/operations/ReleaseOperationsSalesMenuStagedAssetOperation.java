package com.catering.v2s.salesmenu.application.operations;

import com.catering.v2s.salesmenu.api.SalesMenuAssetCommandApi;
import com.catering.v2s.salesmenu.api.SalesMenuReadback;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Component
public class ReleaseOperationsSalesMenuStagedAssetOperation {
    public static final String OPERATION_ID = "releaseOperationsSalesMenuStagedAsset";
    private final SalesMenuAssetCommandApi owner;

    public ReleaseOperationsSalesMenuStagedAssetOperation(SalesMenuAssetCommandApi owner) {
        this.owner = owner;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public SalesMenuReadback.AssetRelease execute(SalesMenuAssetCommandApi.ReleaseCommand command) {
        return owner.releaseStagedSalesMenuItemImage(
                command.target(), command.ownerScopeGrant(), command.contextVersion(), command);
    }
}
