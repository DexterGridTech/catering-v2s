package com.catering.v2s.salesmenu.application.operations;

import com.catering.v2s.salesmenu.api.SalesMenuAssetCommandApi;
import com.catering.v2s.salesmenu.api.SalesMenuReadback;
import org.springframework.stereotype.Component;

@Component
public final class StageOperationsSalesMenuAssetMultipartOperation {
    public static final String OPERATION_ID = "stageOperationsSalesMenuAsset";
    private final SalesMenuAssetCommandApi owner;

    public StageOperationsSalesMenuAssetMultipartOperation(SalesMenuAssetCommandApi owner) {
        this.owner = owner;
    }

    public SalesMenuReadback.AssetStage execute(SalesMenuAssetCommandApi.StageCommand command) {
        return owner.stageSalesMenuItemImage(
                command.target(), command.ownerScopeGrant(), command.contextVersion(), command);
    }
}
