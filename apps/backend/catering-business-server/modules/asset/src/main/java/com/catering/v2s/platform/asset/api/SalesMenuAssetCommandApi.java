package com.catering.v2s.platform.asset.api;

import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import java.io.InputStream;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/**
 * Owner-facing lifecycle boundary for sales-menu images. The sales-menu owner supplies the resolved target; this API
 * never performs menu membership or draft-version judgment.
 */
public interface SalesMenuAssetCommandApi {
    StageReadback stageSalesMenuItemImage(
            SalesMenuAssetTarget target,
            OperationsOwnerScopeGrant ownerScopeGrant,
            long contextVersion,
            StageCommand command);

    ReleaseReadback releaseStagedSalesMenuItemImage(
            SalesMenuAssetTarget target,
            OperationsOwnerScopeGrant ownerScopeGrant,
            long contextVersion,
            ReleaseCommand command);

    ClaimReadback claimSalesMenuItemImages(
            SalesMenuAssetTarget target,
            OperationsOwnerScopeGrant ownerScopeGrant,
            long contextVersion,
            List<AssetBinding> bindings);

    record StageCommand(
            String fileName,
            String mediaType,
            String contentDigest,
            long contentLength,
            InputStream content,
            String idempotencyKey) {
        public StageCommand {
            fileName = required(fileName, "fileName", 255);
            mediaType = required(mediaType, "mediaType", 128);
            contentDigest = required(contentDigest, "contentDigest", 128);
            Objects.requireNonNull(content, "content");
            idempotencyKey = required(idempotencyKey, "idempotencyKey", 128);
            if (contentLength < 0) {
                throw new IllegalArgumentException("contentLength cannot be negative");
            }
        }
    }

    record ReleaseCommand(UUID assetRef, long expectedVersion, String idempotencyKey) {
        public ReleaseCommand {
            Objects.requireNonNull(assetRef, "assetRef");
            idempotencyKey = required(idempotencyKey, "idempotencyKey", 128);
            if (expectedVersion < 0) {
                throw new IllegalArgumentException("expectedVersion cannot be negative");
            }
        }
    }

    record AssetBinding(UUID assetRef, String bindGrant) {
        public AssetBinding {
            Objects.requireNonNull(assetRef, "assetRef");
            bindGrant = required(bindGrant, "bindGrant", 512);
        }
    }

    record StageReadback(
            UUID assetRef,
            SalesMenuAssetTarget target,
            String bindGrant,
            String status,
            String mediaType,
            String contentDigest,
            long version) {}

    record ReleaseReadback(SalesMenuAssetTarget target, UUID assetRef, long releasedAt, long version) {}

    record ClaimReadback(SalesMenuAssetTarget target, List<AssetMetadata> assets) {
        public ClaimReadback {
            Objects.requireNonNull(target, "target");
            assets = List.copyOf(Objects.requireNonNull(assets, "assets"));
        }
    }

    record AssetMetadata(UUID assetRef, String usage, String status, long version, long sizeBytes) {}

    private static String required(String value, String name, int maxLength) {
        String normalized = Objects.requireNonNullElse(value, "").trim();
        if (normalized.isEmpty() || normalized.length() > maxLength) {
            throw new IllegalArgumentException(name + " is invalid");
        }
        return normalized;
    }
}
