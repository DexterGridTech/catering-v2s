package com.catering.v2s.terminalupdate.application;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.platform.asset.api.TerminalUpdateAssetStorage;
import com.catering.v2s.platform.foundation.persistence.CommandReceiptSupport;
import com.catering.v2s.terminalupdate.api.TerminalUpdateArtifactOwnerApi;
import com.catering.v2s.terminalupdate.api.TerminalUpdateArtifactOwnerApi.MinimumFull;
import com.catering.v2s.terminalupdate.api.TerminalUpdateArtifactOwnerApi.ValidatedStage;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import org.springframework.stereotype.Component;

/** Coordinates private byte staging, parsing, and owner metadata acceptance. */
@Component
public final class StageTerminalUpdateArtifactOperation {
    private static final ObjectMapper JSON = new ObjectMapper();

    private final TerminalUpdateAssetStorage assets;
    private final TerminalUpdateArtifactParser parser;
    private final TerminalUpdateArtifactOwnerApi owner;

    public StageTerminalUpdateArtifactOperation(
            TerminalUpdateAssetStorage assets,
            TerminalUpdateArtifactParser parser,
            TerminalUpdateArtifactOwnerApi owner) {
        this.assets = assets;
        this.parser = parser;
        this.owner = owner;
    }

    public StagedArtifact execute(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String fileName,
            String sha256,
            long declaredSizeBytes,
            java.io.InputStream content,
            String idempotencyKey,
            AuditActor actor) {
        UUID ownerActorId = java.util.Objects.requireNonNull(actor, "actor").actorId();
        if (ownerActorId == null) throw new IllegalArgumentException("A platform actor is required to stage packages");
        String actorScopedKey = actorScopedIdempotencyKey(
                workspaceUuid, groupWorkspaceKey, actor.actorType(), ownerActorId, idempotencyKey);
        var staged = assets.stageTerminalUpdatePackage(workspaceUuid, groupWorkspaceKey, fileName, sha256,
                declaredSizeBytes, content, actorScopedKey);
        ValidatedStage validated;
        try (var packageContent = assets.openTerminalUpdatePackage(workspaceUuid, groupWorkspaceKey, staged.assetRef(), true)) {
            TerminalUpdateArtifactParser.ParsedArtifact parsed = parser.parse(
                    packageContent.content(), packageContent.sizeBytes(), packageContent.sha256());
            MinimumFull minimumFull = parseMinimumFull(parsed.minimumFullJson());
            validated = new ValidatedStage(
                    staged.assetRef(), workspaceUuid, groupWorkspaceKey, staged.assetRef(), staged.fileName(),
                    staged.expiresAtEpochMillis(), staged.sizeBytes(), staged.sha256(), parsed.applicationId(),
                    parsed.platform(), parsed.nativeVersion(), parsed.nativeBuildNumber(), parsed.bundleVersion(),
                    parsed.runtimeVersion(), parsed.entryPath(), parsed.filesJson(), parsed.publicationId(),
                    parsed.apkPath(), parsed.apkSha256(), parsed.certificateSha256(), minimumFull,
                    actor.actorType(), ownerActorId);
        } catch (RuntimeException failure) {
            releaseAfterFailure(workspaceUuid, groupWorkspaceKey, staged, failure);
            throw failure;
        } catch (Exception failure) {
            RuntimeException wrapped = new InvalidStagedArtifactException(failure);
            releaseAfterFailure(workspaceUuid, groupWorkspaceKey, staged, wrapped);
            throw wrapped;
        }
        try {
            owner.acceptValidatedStage(validated, actor);
        } catch (RuntimeException failure) {
            releaseAfterFailure(workspaceUuid, groupWorkspaceKey, staged, failure);
            throw failure;
        }
        return new StagedArtifact(staged.assetRef(), staged.bindGrant(), staged.expiresAtEpochMillis(),
                staged.fileName(), staged.sha256(), staged.sizeBytes());
    }

    static String actorScopedIdempotencyKey(
            UUID workspaceUuid, String groupWorkspaceKey, String actorType, UUID actorId, String idempotencyKey) {
        return CommandReceiptSupport.requestHash(workspaceUuid + "|" + groupWorkspaceKey + "|"
                + actorType + "|" + actorId + "|" + idempotencyKey);
    }

    private void releaseAfterFailure(UUID workspaceUuid, String groupWorkspaceKey,
            TerminalUpdateAssetStorage.StagedPackage staged, RuntimeException failure) {
        try {
            assets.releaseTerminalUpdatePackage(workspaceUuid, groupWorkspaceKey, staged.assetRef(), staged.bindGrant());
        } catch (RuntimeException cleanupFailure) {
            failure.addSuppressed(cleanupFailure);
        }
    }

    private static MinimumFull parseMinimumFull(String json) {
        if (json == null) return null;
        try {
            return JSON.readValue(json, MinimumFull.class);
        } catch (Exception failure) {
            throw new InvalidStagedArtifactException(failure);
        }
    }

    public record StagedArtifact(
            UUID stageRef,
            String stageBindGrant,
            long expiresAtEpochMillis,
            String fileName,
            String sha256,
            long byteSize) {}

    public static final class InvalidStagedArtifactException extends RuntimeException {
        public InvalidStagedArtifactException(Throwable cause) { super(cause); }
    }
}
