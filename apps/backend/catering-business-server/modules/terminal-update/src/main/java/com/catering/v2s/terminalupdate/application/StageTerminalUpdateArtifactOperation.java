package com.catering.v2s.terminalupdate.application;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.platform.asset.api.TerminalUpdateAssetStorage;
import com.catering.v2s.platform.foundation.persistence.CommandReceiptSupport;
import com.catering.v2s.terminalupdate.api.TerminalUpdateArtifactOwnerApi;
import com.catering.v2s.terminalupdate.api.TerminalUpdateArtifactOwnerApi.MinimumFull;
import com.catering.v2s.terminalupdate.api.TerminalUpdateArtifactOwnerApi.ValidatedStage;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/** Coordinates private byte staging, parsing, and owner metadata acceptance. */
@Component
public final class StageTerminalUpdateArtifactOperation {
    private static final Logger log = LoggerFactory.getLogger(StageTerminalUpdateArtifactOperation.class);
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
            String requestId,
            AuditActor actor) {
        String diagnosticRequestId = safeRequestId(requestId);
        long operationStarted = System.nanoTime();
        UUID ownerActorId = java.util.Objects.requireNonNull(actor, "actor").actorId();
        if (ownerActorId == null) throw new IllegalArgumentException("A platform actor is required to stage packages");
        String actorScopedKey = actorScopedIdempotencyKey(
                workspaceUuid, groupWorkspaceKey, actor.actorType(), ownerActorId, idempotencyKey);
        diagnostic(diagnosticRequestId, "ASSET_STAGE", "STARTED", 0, declaredSizeBytes, null, false);
        TerminalUpdateAssetStorage.StagedPackage staged;
        try {
            staged = assets.stageTerminalUpdatePackage(workspaceUuid, groupWorkspaceKey, fileName, sha256,
                    declaredSizeBytes, content, actorScopedKey, diagnosticRequestId);
            diagnostic(diagnosticRequestId, "ASSET_STAGE", "SUCCEEDED", elapsedMillis(operationStarted),
                    declaredSizeBytes, null, false);
        } catch (RuntimeException failure) {
            diagnostic(diagnosticRequestId, "ASSET_STAGE", "FAILED", elapsedMillis(operationStarted),
                    declaredSizeBytes, failure.getClass().getSimpleName(), true);
            throw failure;
        }
        ValidatedStage validated;
        long parseStarted = System.nanoTime();
        diagnostic(diagnosticRequestId, "PACKAGE_PARSE", "STARTED", 0, staged.sizeBytes(), null, false);
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
            diagnostic(diagnosticRequestId, "PACKAGE_PARSE", "SUCCEEDED", elapsedMillis(parseStarted),
                    staged.sizeBytes(), null, false);
        } catch (RuntimeException failure) {
            diagnostic(diagnosticRequestId, "PACKAGE_PARSE", "FAILED", elapsedMillis(parseStarted),
                    staged.sizeBytes(), failure.getClass().getSimpleName(), true);
            releaseAfterFailure(workspaceUuid, groupWorkspaceKey, staged, failure);
            throw failure;
        } catch (Exception failure) {
            RuntimeException wrapped = new InvalidStagedArtifactException(failure);
            diagnostic(diagnosticRequestId, "PACKAGE_PARSE", "FAILED", elapsedMillis(parseStarted),
                    staged.sizeBytes(), failure.getClass().getSimpleName(), true);
            releaseAfterFailure(workspaceUuid, groupWorkspaceKey, staged, wrapped);
            throw wrapped;
        }
        long acceptStarted = System.nanoTime();
        diagnostic(diagnosticRequestId, "OWNER_ACCEPT", "STARTED", 0, staged.sizeBytes(), null, false);
        try {
            owner.acceptValidatedStage(validated, actor);
        } catch (RuntimeException failure) {
            diagnostic(diagnosticRequestId, "OWNER_ACCEPT", "FAILED", elapsedMillis(acceptStarted),
                    staged.sizeBytes(), failure.getClass().getSimpleName(), true);
            releaseAfterFailure(workspaceUuid, groupWorkspaceKey, staged, failure);
            throw failure;
        }
        diagnostic(diagnosticRequestId, "OWNER_ACCEPT", "SUCCEEDED", elapsedMillis(acceptStarted),
                staged.sizeBytes(), null, false);
        return new StagedArtifact(staged.assetRef(), staged.bindGrant(), staged.expiresAtEpochMillis(),
                staged.fileName(), staged.sha256(), staged.sizeBytes(), validated.apkPath() == null ? "HOT" : "FULL",
                validated.applicationId(), validated.platform(), validated.nativeVersion(), validated.nativeBuildNumber(),
                validated.bundleVersion(), validated.runtimeVersion(), validated.publicationId(), validated.apkSha256(),
                validated.minimumFull());
    }

    private static void diagnostic(
            String requestId, String stage, String outcome, long elapsedMs,
            long byteSize, String failureType, boolean warning) {
        if (requestId == null) return;
        var event = (warning ? log.atWarn() : log.atInfo())
                .addKeyValue("event", "TERMINAL_UPDATE_ARTIFACT_STAGE")
                .addKeyValue("requestId", requestId)
                .addKeyValue("stage", stage)
                .addKeyValue("outcome", outcome)
                .addKeyValue("elapsedMs", elapsedMs)
                .addKeyValue("byteSize", byteSize);
        if (failureType != null) event.addKeyValue("failureType", failureType.replaceAll("[^A-Za-z0-9_.:-]", "_"));
        event.log("terminal update artifact stage {} {}", stage, outcome);
    }

    private static String safeRequestId(String value) {
        return value != null && value.matches("[A-Za-z0-9_.:-]{1,128}") ? value : null;
    }

    private static long elapsedMillis(long startedAtNanos) {
        return Math.max(0, (System.nanoTime() - startedAtNanos) / 1_000_000);
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
            long byteSize,
            String candidateKind,
            String applicationId,
            String platform,
            String nativeVersion,
            long nativeBuildNumber,
            String bundleVersion,
            String runtimeVersion,
            String publicationId,
            String apkSha256,
            MinimumFull minimumFull) {}

    public static final class InvalidStagedArtifactException extends RuntimeException {
        public InvalidStagedArtifactException(Throwable cause) { super(cause); }
    }
}
