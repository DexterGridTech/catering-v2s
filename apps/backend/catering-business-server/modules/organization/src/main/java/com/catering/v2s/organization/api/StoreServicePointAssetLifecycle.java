package com.catering.v2s.organization.api;

import java.util.UUID;

/**
 * Narrow port used by the organization owner to settle a service-point image inside its REQUIRED transaction.
 * Implementations remain the sole owner of platform-asset lifecycle tables and storage metadata.
 */
public interface StoreServicePointAssetLifecycle {
    AssetClaim claimStaged(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID storeRef,
            UUID servicePointRef,
            UUID assetRef,
            String bindGrant);

    void releaseActive(
            UUID workspaceUuid, String groupWorkspaceKey, UUID storeRef, UUID servicePointRef, UUID assetRef);

    record AssetClaim(UUID assetRef, String usage, String status, long version, long sizeBytes) {}
}
