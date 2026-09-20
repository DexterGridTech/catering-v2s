package com.catering.v2s.platform.asset.application.operations;

import com.catering.v2s.app.edge.generated.wire.StoreServicePointAssetReleaseReadback;
import com.catering.v2s.app.edge.generated.wire.StoreServicePointAssetReleaseRequest;
import com.catering.v2s.platform.asset.application.PlatformAssetService;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation transaction boundary for releasing an unclaimed service-point image. */
@Component
public class ReleaseStagedStoreServicePointImageOperation {
    public static final String OPERATION_ID = "releaseStagedStoreServicePointImage";
    private final PlatformAssetService assets;

    public ReleaseStagedStoreServicePointImageOperation(PlatformAssetService assets) {
        this.assets = assets;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public StoreServicePointAssetReleaseReadback execute(Invocation invocation) {
        PlatformAssetService.AssetReadback released = assets.releaseStagedStoreServicePointImage(
                invocation.workspaceUuid(),
                invocation.groupWorkspaceKey(),
                invocation.assetRef(),
                required(invocation.request().expectedAssetVersion()));
        return new StoreServicePointAssetReleaseReadback(released.assetRef(), "RELEASED", released.version());
    }

    public record Invocation(
            StoreServicePointAssetReleaseRequest request,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID assetRef) {}

    private static long required(Long value) {
        if (value == null) throw new IllegalArgumentException("expectedAssetVersion is required");
        return value;
    }
}
