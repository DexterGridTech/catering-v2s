package com.catering.v2s.platform.asset.api;

import java.util.Map;
import java.util.Set;
import java.util.UUID;

/** Owner-side task read for active sales-menu item images. */
public interface SalesMenuAssetReadApi {
    Map<UUID, SalesMenuItemImage> readSalesMenuItemImages(Set<UUID> assetRefs);

    record PublicReference(String publicUrl, String contentType, String sha256) {}

    record SalesMenuItemImage(
            UUID assetRef,
            PublicReference publicReference,
            SalesMenuAssetUsage usage,
            String status,
            long version,
            long sizeBytes) {}
}
