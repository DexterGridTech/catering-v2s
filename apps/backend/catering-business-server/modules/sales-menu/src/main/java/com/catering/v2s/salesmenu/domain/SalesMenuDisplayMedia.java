package com.catering.v2s.salesmenu.domain;

import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

public record SalesMenuDisplayMedia(SalesMenuDisplayMediaMode mode, List<UUID> assetRefs, UUID primaryAssetRef) {
    public SalesMenuDisplayMedia {
        Objects.requireNonNull(mode, "mode");
        assetRefs = List.copyOf(Objects.requireNonNull(assetRefs, "assetRefs"));
        if (assetRefs.size() > SalesMenuPolicy.MAX_CUSTOM_ASSETS
                || assetRefs.stream().anyMatch(Objects::isNull)) {
            throw new IllegalArgumentException("at most six asset references are allowed");
        }
        if (assetRefs.size() != new HashSet<>(assetRefs).size()) {
            throw new IllegalArgumentException("asset references must be unique");
        }
        if (primaryAssetRef != null && !assetRefs.contains(primaryAssetRef)) {
            throw new IllegalArgumentException("primary asset must be listed");
        }
        if (mode == SalesMenuDisplayMediaMode.INHERIT_CATALOG && (!assetRefs.isEmpty() || primaryAssetRef != null)) {
            throw new IllegalArgumentException("catalog media cannot carry custom assets");
        }
    }
}
