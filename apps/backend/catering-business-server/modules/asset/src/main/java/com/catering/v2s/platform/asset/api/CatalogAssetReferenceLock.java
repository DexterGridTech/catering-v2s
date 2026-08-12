package com.catering.v2s.platform.asset.api;

import java.util.Collection;
import java.util.UUID;

/**
 * Transaction-scoped serialization authority for catalog references to one immutable asset.
 * The asset owner owns the lock identity; catalog owns the facts being protected.
 */
public interface CatalogAssetReferenceLock {
    void lockCatalogReferences(Collection<UUID> assetRefs);

    /** One-asset lifecycle operations take this serialization point before catalog's global judgment. */
    void lockCatalogReference(UUID assetRef);
}
