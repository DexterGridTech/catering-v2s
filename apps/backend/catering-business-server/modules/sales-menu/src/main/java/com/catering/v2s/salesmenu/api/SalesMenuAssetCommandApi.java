package com.catering.v2s.salesmenu.api;

import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.salesmenu.domain.SalesMenuAssetTarget;
import java.io.InputStream;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/** Narrow cross-owner asset command boundary; the asset owner remains the lifecycle owner. */
public interface SalesMenuAssetCommandApi {
    SalesMenuReadback.AssetStage stageSalesMenuItemImage(
            SalesMenuAssetTarget target,
            OperationsOwnerScopeGrant ownerScopeGrant,
            long contextVersion,
            StageCommand command);

    SalesMenuReadback.AssetRelease releaseStagedSalesMenuItemImage(
            SalesMenuAssetTarget target,
            OperationsOwnerScopeGrant ownerScopeGrant,
            long contextVersion,
            ReleaseCommand command);

    SalesMenuReadback.AssetClaim claimSalesMenuItemImages(
            SalesMenuAssetTarget target,
            OperationsOwnerScopeGrant ownerScopeGrant,
            long contextVersion,
            List<AssetBinding> bindings);

    record StageCommand(
            SalesMenuAssetTarget target,
            OperationsOwnerScopeGrant ownerScopeGrant,
            long contextVersion,
            String fileName,
            String mediaType,
            String contentDigest,
            long contentLength,
            InputStream content,
            String idempotencyKey) {
        public StageCommand {
            Objects.requireNonNull(target, "target");
            Objects.requireNonNull(ownerScopeGrant, "ownerScopeGrant");
            if (contextVersion < 0) throw new IllegalArgumentException("contextVersion cannot be negative");
            fileName = required(fileName, "fileName", 255);
            mediaType = required(mediaType, "mediaType", 128);
            contentDigest = required(contentDigest, "contentDigest", 128);
            Objects.requireNonNull(content, "content");
            idempotencyKey = required(idempotencyKey, "idempotencyKey", 128);
            if (contentLength < 0) throw new IllegalArgumentException("contentLength cannot be negative");
        }
    }

    record ReleaseCommand(
            SalesMenuAssetTarget target,
            OperationsOwnerScopeGrant ownerScopeGrant,
            long contextVersion,
            UUID assetRef,
            long expectedVersion,
            String idempotencyKey) {
        public ReleaseCommand {
            Objects.requireNonNull(target, "target");
            Objects.requireNonNull(ownerScopeGrant, "ownerScopeGrant");
            if (contextVersion < 0) throw new IllegalArgumentException("contextVersion cannot be negative");
            Objects.requireNonNull(assetRef, "assetRef");
            idempotencyKey = required(idempotencyKey, "idempotencyKey", 128);
            if (expectedVersion < 0) throw new IllegalArgumentException("expectedVersion cannot be negative");
        }
    }

    record AssetBinding(UUID assetRef, String bindGrant) {
        public AssetBinding {
            Objects.requireNonNull(assetRef, "assetRef");
            bindGrant = required(bindGrant, "bindGrant", 512);
        }
    }

    /** Asset owner rejected the resolved menu/store/item target or capability envelope. */
    final class AssetTargetRejectedException extends RuntimeException {
        public AssetTargetRejectedException(Throwable cause) {
            super(cause);
        }
    }

    /** Asset owner rejected a staged claim because its lifecycle or one-time proof is no longer valid. */
    final class AssetClaimRejectedException extends RuntimeException {
        public AssetClaimRejectedException(Throwable cause) {
            super(cause);
        }
    }

    private static String required(String value, String name, int maxLength) {
        String normalized = Objects.requireNonNullElse(value, "").trim();
        if (normalized.isEmpty() || normalized.length() > maxLength) {
            throw new IllegalArgumentException(name + " is invalid");
        }
        return normalized;
    }
}
