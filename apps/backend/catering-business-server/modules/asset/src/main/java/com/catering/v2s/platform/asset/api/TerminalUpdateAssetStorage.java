package com.catering.v2s.platform.asset.api;

import java.io.InputStream;
import java.io.IOException;
import java.util.UUID;

/** Narrow asset-owner boundary for private immutable terminal-update package bytes. */
public interface TerminalUpdateAssetStorage {
    record StagedPackage(
            UUID assetRef, String bindGrant, long expiresAtEpochMillis, String fileName, long sizeBytes, String sha256) {}

    record PackageContent(String contentType, long sizeBytes, String sha256, InputStream content) implements AutoCloseable {
        @Override
        public void close() throws IOException {
            content.close();
        }
    }

    StagedPackage stageTerminalUpdatePackage(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String fileName,
            String expectedSha256,
            long declaredSizeBytes,
            InputStream content,
            String idempotencyKey);

    PackageContent openTerminalUpdatePackage(
            UUID workspaceUuid, String groupWorkspaceKey, UUID assetRef, boolean requireStaged);

    void claimTerminalUpdatePackage(
            UUID workspaceUuid, String groupWorkspaceKey, UUID assetRef, String bindGrant, String expectedSha256);

    void releaseTerminalUpdatePackage(
            UUID workspaceUuid, String groupWorkspaceKey, UUID assetRef, String bindGrant);
}
