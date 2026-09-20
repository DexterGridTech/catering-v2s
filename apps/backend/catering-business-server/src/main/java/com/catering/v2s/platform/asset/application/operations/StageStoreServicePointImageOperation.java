package com.catering.v2s.platform.asset.application.operations;

import com.catering.v2s.app.edge.generated.wire.StoreServicePointAssetStageReadback;
import com.catering.v2s.app.edge.generated.wire.StoreServicePointAssetStageRequest;
import com.catering.v2s.platform.asset.application.PlatformAssetService;
import java.io.InputStream;
import java.util.UUID;
import org.springframework.stereotype.Component;

/** One-operation composition entry for staging a service-point image. */
@Component
public final class StageStoreServicePointImageOperation {
    public static final String OPERATION_ID = "stageStoreServicePointImage";
    private final PlatformAssetService assets;

    public StageStoreServicePointImageOperation(PlatformAssetService assets) {
        this.assets = assets;
    }

    public StoreServicePointAssetStageReadback execute(Invocation invocation) {
        PlatformAssetService.StageReadback staged = assets.stageStoreServicePointImage(
                invocation.workspaceUuid(),
                invocation.groupWorkspaceKey(),
                invocation.request().mediaType(),
                invocation.contentLength(),
                invocation.content(),
                invocation.idempotencyKey(),
                invocation.request().contentDigest());
        long version = assets.require(staged.assetRef()).version();
        return new StoreServicePointAssetStageReadback(staged.assetRef(), staged.bindGrant(), "STAGED", version);
    }

    public record Invocation(
            StoreServicePointAssetStageRequest request,
            long contentLength,
            InputStream content,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String idempotencyKey) {}
}
