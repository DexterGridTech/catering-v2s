package com.catering.v2s.platform.asset.api;

import com.catering.v2s.platform.command.CatalogAuthorizationScope;
import com.catering.v2s.platform.command.WorkspaceExecutionContext;
import java.io.InputStream;
import java.util.List;
import java.util.UUID;

/**
 * Typed catalog-asset command boundary. Multipart content remains a stream from edge to asset
 * owner; catalog never receives bytes, storage metadata, or an asset receipt implementation.
 */
public interface CatalogAssetCommandApi {
    record StageCommand(String fileName, String mediaType, String contentDigest, long contentLength,
                        InputStream content, String idempotencyKey) { }
    record StageReadback(UUID assetRef, String bindGrant, String status, String mediaType,
                         String contentDigest, long version) { }
    record ReleaseCommand(UUID assetRef, long expectedVersion, String idempotencyKey) { }
    record ReleaseReadback(UUID assetRef, long releasedAt, long version) { }

    StageReadback stageCatalogAsset(WorkspaceExecutionContext<CatalogAuthorizationScope> context,
                                   StageCommand command);

    ReleaseReadback releaseUnreferencedCatalogAsset(WorkspaceExecutionContext<CatalogAuthorizationScope> context,
                                                    ReleaseCommand command);

    /**
     * Discards an unclaimed catalog stage belonging to the resolved workspace.  This is
     * intentionally distinct from {@link #releaseUnreferencedCatalogAsset}: the latter
     * releases an ACTIVE asset after catalog has made a global no-reference judgement.
     */
    ReleaseReadback releaseStagedCatalogAsset(WorkspaceExecutionContext<CatalogAuthorizationScope> context,
                                              ReleaseCommand command);

    /**
     * Catalog-save settlement is an asset-owner operation: it serializes all participating
     * references, consumes staged bind grants, and releases only prior refs no longer selected
     * by the saved catalog entity. Bind grants remain opaque, one-per-reference proof material.
     */
    record AssetBinding(UUID assetRef, String bindGrant) { }
    /**
     * Catalog has already made the global reference judgement. The asset owner
     * obtains the version only after it holds its lifecycle lock, so the
     * coordinator does not perform an unlocked read solely to relay a version.
     */
    record PriorAssetReference(UUID assetRef) { }
    record AssetMetadata(UUID assetRef, String status, long version) { }
    record SaveSettlementCommand(List<AssetBinding> bindings, List<PriorAssetReference> priorReferences,
                                 String idempotencyKeyBase) {
        public SaveSettlementCommand {
            bindings = bindings == null ? List.of() : List.copyOf(bindings);
            priorReferences = priorReferences == null ? List.of() : List.copyOf(priorReferences);
        }
    }
    record SaveSettlementReadback(List<AssetMetadata> claimed, List<AssetMetadata> released) {
        public SaveSettlementReadback {
            claimed = List.copyOf(claimed);
            released = List.copyOf(released);
        }
    }

    SaveSettlementReadback settleCatalogSaveAssets(WorkspaceExecutionContext<CatalogAuthorizationScope> context,
                                                   SaveSettlementCommand command);
}
