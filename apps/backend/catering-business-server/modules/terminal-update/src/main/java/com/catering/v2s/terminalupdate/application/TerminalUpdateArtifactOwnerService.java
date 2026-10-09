package com.catering.v2s.terminalupdate.application;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.audit.contract.AuditHistoryPage;
import com.catering.v2s.audit.contract.AuditHistoryResultSetReader;
import com.catering.v2s.audit.contract.AuditChange;
import com.catering.v2s.audit.contract.AuditEvent;
import com.catering.v2s.audit.contract.AuditEventWriter;
import com.catering.v2s.audit.contract.AuditTarget;
import com.catering.v2s.platform.asset.api.TerminalUpdateAssetStorage;
import com.catering.v2s.platform.foundation.persistence.CommandReceiptSupport;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.platform.foundation.security.Sha256Hex;
import com.catering.v2s.organization.api.OrganizationTaskPathLookup;
import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi;
import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi.Verification;
import com.catering.v2s.terminalupdate.api.TerminalUpdateArtifactOwnerApi;
import com.catering.v2s.terminalupdate.api.TerminalUpdateArtifactOwnerApi.ArtifactReadback;
import com.catering.v2s.terminalupdate.api.TerminalUpdateArtifactOwnerApi.ArtifactManifest;
import com.catering.v2s.terminalupdate.api.TerminalUpdateArtifactOwnerApi.ArtifactFile;
import com.catering.v2s.terminalupdate.api.TerminalUpdateArtifactOwnerApi.ApkFacts;
import com.catering.v2s.terminalupdate.api.TerminalUpdateArtifactOwnerApi.ArtifactQuery;
import com.catering.v2s.terminalupdate.api.TerminalUpdateArtifactOwnerApi.MinimumFull;
import com.catering.v2s.terminalupdate.api.TerminalUpdateArtifactOwnerApi.RegisterArtifact;
import com.catering.v2s.terminalupdate.api.TerminalUpdateArtifactOwnerApi.ReleaseStage;
import com.catering.v2s.terminalupdate.api.TerminalUpdateArtifactOwnerApi.StageAcceptance;
import com.catering.v2s.terminalupdate.api.TerminalUpdateArtifactOwnerApi.ValidatedStage;
import com.catering.v2s.terminalupdate.application.persistence.TerminalUpdateArtifactPersistence;
import com.catering.v2s.terminalupdate.application.persistence.TerminalUpdateDownloadGrantPersistence;
import com.catering.v2s.terminalupdate.application.persistence.TerminalUpdateRulePersistence;
import com.catering.v2s.terminalupdate.application.persistence.TerminalUpdateArtifactPersistence.FullIdentity;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.type.TypeReference;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.security.SecureRandom;
import java.util.Base64;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Owns immutable publication facts and coordinates their same-transaction private asset claim. */
@Service
public class TerminalUpdateArtifactOwnerService implements TerminalUpdateArtifactOwnerApi {
    private static final ObjectMapper JSON = new ObjectMapper().findAndRegisterModules();
    private static final String ARTIFACT_ENTITY = "TERMINAL_UPDATE_ARTIFACT";
    private static final String REGISTER = "register";

    private final TerminalUpdateArtifactPersistence persistence;
    private final TerminalUpdateAssetStorage assets;
    private final AuditEventWriter auditEvents;
    private final TimeProvider time;
    private final TerminalUpdateDownloadGrantPersistence grants;
    private final TerminalUpdateRulePersistence rules;
    private final OrganizationTaskPathLookup organization;
    private final TerminalCredentialVerificationApi credentials;
    private final SecureRandom secureRandom = new SecureRandom();

    public TerminalUpdateArtifactOwnerService(
            TerminalUpdateArtifactPersistence persistence,
            TerminalUpdateAssetStorage assets,
            @Qualifier("terminalUpdateAuditEventWriter") AuditEventWriter auditEvents,
            TimeProvider time,
            TerminalUpdateDownloadGrantPersistence grants,
            TerminalUpdateRulePersistence rules,
            OrganizationTaskPathLookup organization,
            TerminalCredentialVerificationApi credentials) {
        this.persistence = Objects.requireNonNull(persistence, "persistence");
        this.assets = Objects.requireNonNull(assets, "assets");
        this.auditEvents = Objects.requireNonNull(auditEvents, "auditEvents");
        this.time = Objects.requireNonNull(time, "time");
        this.grants = Objects.requireNonNull(grants, "grants");
        this.rules = Objects.requireNonNull(rules, "rules");
        this.organization = Objects.requireNonNull(organization, "organization");
        this.credentials = Objects.requireNonNull(credentials, "credentials");
    }

    @Override
    @Transactional
    public StageAcceptance acceptValidatedStage(ValidatedStage stage, AuditActor actor) {
        Objects.requireNonNull(stage, "stage");
        Objects.requireNonNull(actor, "actor");
        int inserted = persistence.insertStage(stage, time.currentEpochMillis());
        ValidatedStage stored = persistence.readStage(stage.stageRef(), false)
                .orElseThrow(TerminalUpdateStageNotFoundException::new);
        if (!sameStage(stored, stage)) throw new TerminalUpdateStageConflictException();
        requireStageActor(stored, actor);
        if (inserted == 1) auditEvents.write(audit(stage.workspaceUuid(), stage.groupWorkspaceKey(),
                actor, stage.stageRef(), "STAGE", List.of(
                        change("fileName", stage.fileName()), change("zipSha256", stage.zipSha256()),
                        change("byteSize", Long.toString(stage.byteSize())))));
        return new StageAcceptance(stage.stageRef(), inserted == 1);
    }

    @Override
    @Transactional
    public ArtifactReadback register(RegisterArtifact command) {
        Objects.requireNonNull(command, "command");
        String requestHash = requestHash(command);
        persistence.lockCommand(command.groupWorkspaceKey(), REGISTER, command.idempotencyKey());
        Optional<TerminalUpdateArtifactPersistence.Receipt> previous = persistence.findReceipt(
                command.groupWorkspaceKey(), REGISTER, command.idempotencyKey());
        if (previous.isPresent()) {
            if (!requestHash.equals(previous.get().requestHash())) throw new TerminalUpdateIdempotencyConflictException();
            return deserialize(previous.get().responseJson());
        }

        ValidatedStage stage = persistence.readStage(command.stageRef(), true)
                .orElseThrow(TerminalUpdateStageNotFoundException::new);
        if (!stage.workspaceUuid().equals(command.workspaceUuid())
                || !stage.groupWorkspaceKey().equals(command.groupWorkspaceKey()))
            throw new TerminalUpdateStageNotFoundException();
        requireStageActor(stage, command.actor());
        if (stage.expiresAtEpochMillis() <= time.currentEpochMillis()) throw new TerminalUpdateStageExpiredException();
        if (!command.kind().equals(stage.apkPath() == null ? "HOT" : "FULL"))
            throw new TerminalUpdateArtifactInvalidException();

        FullIdentity minimumFull = command.kind().equals("HOT")
                ? validateMinimumFull(command, stage)
                : null;
        persistence.lockPublication(stage.applicationId(), stage.platform(), stage.runtimeVersion(), stage.bundleVersion());
        String existingPublication = persistence.registerPublication(stage.applicationId(), stage.platform(),
                stage.runtimeVersion(), stage.bundleVersion(), stage.publicationId());
        if (!stage.publicationId().equals(existingPublication)) throw new TerminalUpdatePublicationConflictException();

        UUID artifactRef = UUID.randomUUID();
        try {
            assets.claimTerminalUpdatePackage(command.workspaceUuid(), command.groupWorkspaceKey(), stage.assetRef(),
                    command.stageBindGrant(), stage.zipSha256());
        } catch (RuntimeException failure) {
            throw new TerminalUpdateStageNotOwnedException(failure);
        }
        persistence.insertArtifact(artifactRef, stage, command.kind(),
                minimumFull == null ? null : minimumFull.artifactRef(), time.currentEpochMillis());
        persistence.deleteStage(stage.stageRef());
        ArtifactReadback result = persistence.readArtifact(command.workspaceUuid(), command.groupWorkspaceKey(), artifactRef)
                .orElseThrow(TerminalUpdateOwnerInvariantException::new);
        auditEvents.write(audit(command.workspaceUuid(), command.groupWorkspaceKey(), command.actor(), artifactRef,
                "REGISTER", List.of(change("kind", command.kind()), change("applicationId", stage.applicationId()),
                        change("publicationId", stage.publicationId()), change("zipSha256", stage.zipSha256()))));
        persistence.insertReceipt(command.groupWorkspaceKey(), REGISTER, command.idempotencyKey(), requestHash,
                TerminalUpdateArtifactPersistence.write(result), time.currentEpochMillis());
        return result;
    }

    @Override
    @Transactional
    public void releaseStage(ReleaseStage command) {
        Objects.requireNonNull(command, "command");
        ValidatedStage stage = persistence.readStage(command.stageRef(), true)
                .orElseThrow(TerminalUpdateStageNotFoundException::new);
        if (!stage.workspaceUuid().equals(command.workspaceUuid())
                || !stage.groupWorkspaceKey().equals(command.groupWorkspaceKey()))
            throw new TerminalUpdateStageNotFoundException();
        requireStageActor(stage, command.actor());
        try {
            assets.releaseTerminalUpdatePackage(command.workspaceUuid(), command.groupWorkspaceKey(),
                    command.stageRef(), command.stageBindGrant());
        } catch (RuntimeException failure) {
            throw new TerminalUpdateStageNotOwnedException(failure);
        }
        persistence.deleteStage(command.stageRef());
        auditEvents.write(audit(command.workspaceUuid(), command.groupWorkspaceKey(), command.actor(),
                command.stageRef(), "RELEASE_STAGE", List.of(change("zipSha256", stage.zipSha256()))));
    }

    @Override
    @Transactional(readOnly = true)
    public ArtifactReadback read(UUID workspaceUuid, String groupWorkspaceKey, UUID artifactRef) {
        return persistence.readArtifact(workspaceUuid, groupWorkspaceKey, artifactRef)
                .orElseThrow(TerminalUpdateArtifactNotFoundException::new);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ArtifactReadback> readPage(UUID workspaceUuid, String groupWorkspaceKey, int limit, UUID before,
            ArtifactQuery query) {
        if (limit < 1 || limit > 101) throw new IllegalArgumentException("artifact page limit is invalid");
        return persistence.readPage(workspaceUuid, groupWorkspaceKey, limit, before,
                new TerminalUpdateArtifactPersistence.ArtifactFilter(query.kind(), query.applicationId(),
                        query.runtimeVersion(), query.queryText(), query.minimumFullNativeBuildNumber(),
                        query.minimumFullPublicationId(), query.minimumFullApkSha256()));
    }

    @Override
    @Transactional(readOnly = true)
    public AuditHistoryPage readAuditHistory(
            UUID workspaceUuid, String groupWorkspaceKey, UUID artifactRef, long page, long pageSize) {
        if (page < 1 || pageSize < 1 || pageSize > 100)
            throw new IllegalArgumentException("terminal update audit page is invalid");
        long offset = Math.multiplyExact(page - 1, pageSize);
        AuditHistoryResultSetReader.TargetProjection result = persistence.readAuditHistory(
                workspaceUuid, groupWorkspaceKey, artifactRef, pageSize, offset);
        if (!result.targetExists()) throw new TerminalUpdateArtifactNotFoundException();
        return new AuditHistoryPage(result.items(), page, pageSize, result.total());
    }

    @Override
    @Transactional
    public DownloadGrant issueDownloadGrant(Verification binding, UUID artifactRef) {
        if (binding == null || binding.outcome() != TerminalCredentialVerificationApi.Outcome.VERIFIED
                || artifactRef == null || !credentials.isCurrentActiveBinding(binding.workspaceUuid(),
                        binding.groupWorkspaceKey(), binding.terminalRef(), binding.generation()))
            throw new TerminalUpdateArtifactNotAuthorizedException();
        UUID projectRef = projectFor(binding.workspaceUuid(), binding.groupWorkspaceKey(), binding.storeRef());
        ArtifactReadback artifact = persistence.readArtifact(binding.workspaceUuid(), binding.groupWorkspaceKey(), artifactRef)
                .orElseThrow(TerminalUpdateArtifactNotFoundException::new);
        if (!rules.artifactAssignedToStore(binding.workspaceUuid(), binding.groupWorkspaceKey(), projectRef,
                binding.storeRef(), artifactRef)) throw new TerminalUpdateArtifactNotAuthorizedException();
        long now = time.currentEpochMillis();
        grants.lock(binding.workspaceUuid(), binding.groupWorkspaceKey(), binding.terminalRef(), binding.generation());
        grants.deleteExpired(now, 100);
        if (grants.activeCount(binding.workspaceUuid(), binding.groupWorkspaceKey(), binding.terminalRef(),
                binding.generation(), now) >= 32) throw new TerminalUpdateDownloadBusyException();
        byte[] tokenBytes = new byte[32];
        secureRandom.nextBytes(tokenBytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(tokenBytes);
        java.util.Arrays.fill(tokenBytes, (byte) 0);
        long expiresAt = Math.addExact(now, 300_000L);
        grants.insert(Sha256Hex.digest(token), binding.workspaceUuid(), binding.groupWorkspaceKey(),
                binding.terminalRef(), binding.generation(), binding.storeRef(), projectRef, artifactRef, now, expiresAt);
        return new DownloadGrant("/api/terminal/group-workspaces/" + binding.groupWorkspaceKey()
                + "/update-artifacts/" + artifactRef + "/content", token, expiresAt, artifactRef,
                artifact.zipSha256(), artifact.byteSize(), manifest(artifact));
    }

    @Override
    @Transactional(readOnly = true)
    public AuthorizedPackage authorizeDownload(String grant) {
        if (grant == null || grant.isBlank() || grant.length() > 128)
            throw new TerminalUpdateDownloadGrantExpiredException();
        var stored = grants.read(Sha256Hex.digest(grant));
        if (stored == null || stored.expiresAtEpochMillis() <= time.currentEpochMillis())
            throw new TerminalUpdateDownloadGrantExpiredException();
        if (!credentials.isCurrentActiveBinding(stored.workspaceUuid(), stored.groupWorkspaceKey(),
                stored.terminalRef(), stored.generation())) throw new TerminalUpdateArtifactNotAuthorizedException();
        UUID projectRef = projectFor(stored.workspaceUuid(), stored.groupWorkspaceKey(), stored.storeRef());
        if (!projectRef.equals(stored.projectRef()) || !rules.artifactAssignedToStore(stored.workspaceUuid(),
                stored.groupWorkspaceKey(), projectRef, stored.storeRef(), stored.artifactRef()))
            throw new TerminalUpdateArtifactNotAuthorizedException();
        return new AuthorizedPackage(stored.workspaceUuid(), stored.groupWorkspaceKey(), stored.artifactRef(),
                stored.assetRef(), stored.zipSha256(), stored.byteSize());
    }

    private UUID projectFor(UUID workspaceUuid, String groupWorkspaceKey, UUID storeRef) {
        var path = organization.requireTaskPath(workspaceUuid, groupWorkspaceKey, "STORE", storeRef);
        return path.nodes().stream().filter(node -> "PROJECT".equals(node.nodeType()))
                .map(OrganizationTaskPathLookup.TaskPathNode::ref).findFirst()
                .orElseThrow(TerminalUpdateArtifactNotAuthorizedException::new);
    }

    private static ArtifactManifest manifest(ArtifactReadback artifact) {
        try {
            List<ArtifactFile> files = JSON.readValue(artifact.filesJson(), new TypeReference<>() {});
            ApkFacts apk = artifact.apkPath() == null ? null
                    : new ApkFacts(artifact.apkPath(), artifact.apkSha256(), artifact.certificateSha256());
            return new ArtifactManifest(1, artifact.platform(), artifact.applicationId(), artifact.nativeVersion(),
                    artifact.nativeBuildNumber(), artifact.bundleVersion(), artifact.runtimeVersion(),
                    artifact.entryPath(), files, artifact.publicationId(), artifact.minimumFull(), apk);
        } catch (JsonProcessingException failure) {
            throw new IllegalStateException("terminal update artifact manifest read failed", failure);
        }
    }

    private FullIdentity validateMinimumFull(RegisterArtifact command, ValidatedStage hot) {
        FullIdentity full = persistence.readFull(command.workspaceUuid(), command.groupWorkspaceKey(),
                        command.minimumFullArtifactRef())
                .orElseThrow(TerminalUpdateMinimumFullInvalidException::new);
        MinimumFull declared = hot.minimumFull();
        if (declared == null || !full.applicationId().equals(declared.applicationId())
                || full.nativeBuildNumber() != declared.nativeBuildNumber()
                || !full.runtimeVersion().equals(declared.runtimeVersion())
                || !full.publicationId().equals(declared.publicationId())
                || !full.apkSha256().equals(declared.apkSha256())
                || !full.applicationId().equals(hot.applicationId())
                || !full.runtimeVersion().equals(hot.runtimeVersion())
                || !"android".equals(hot.platform())) throw new TerminalUpdateMinimumFullInvalidException();
        return full;
    }

    private static boolean sameStage(ValidatedStage left, ValidatedStage right) {
        return left.stageRef().equals(right.stageRef()) && left.workspaceUuid().equals(right.workspaceUuid())
                && left.groupWorkspaceKey().equals(right.groupWorkspaceKey()) && left.assetRef().equals(right.assetRef())
                && left.fileName().equals(right.fileName()) && left.expiresAtEpochMillis() == right.expiresAtEpochMillis()
                && left.byteSize() == right.byteSize() && left.zipSha256().equals(right.zipSha256())
                && left.applicationId().equals(right.applicationId()) && left.platform().equals(right.platform())
                && left.nativeVersion().equals(right.nativeVersion()) && left.nativeBuildNumber() == right.nativeBuildNumber()
                && left.bundleVersion().equals(right.bundleVersion()) && left.runtimeVersion().equals(right.runtimeVersion())
                && left.entryPath().equals(right.entryPath()) && sameJsonValue(left.filesJson(), right.filesJson())
                && left.publicationId().equals(right.publicationId()) && Objects.equals(left.apkPath(), right.apkPath())
                && Objects.equals(left.apkSha256(), right.apkSha256())
                && Objects.equals(left.certificateSha256(), right.certificateSha256())
                && Objects.equals(left.minimumFull(), right.minimumFull());
    }

    private static boolean sameJsonValue(String left, String right) {
        try {
            JsonNode leftValue = JSON.readTree(left);
            JsonNode rightValue = JSON.readTree(right);
            return leftValue != null && leftValue.equals(rightValue);
        } catch (JsonProcessingException failure) {
            return false;
        }
    }

    private static void requireStageActor(ValidatedStage stage, AuditActor actor) {
        if (!stage.ownerActorType().equals(actor.actorType()) || !stage.ownerActorId().equals(actor.actorId()))
            throw new TerminalUpdateStageNotOwnedException();
    }

    private AuditEvent audit(UUID workspaceUuid, String groupWorkspaceKey, AuditActor actor,
            UUID targetRef, String action, List<AuditChange> changes) {
        return new AuditEvent(UUID.randomUUID(), workspaceUuid, groupWorkspaceKey,
                new AuditTarget(ARTIFACT_ENTITY, targetRef.toString()), actor, action,
                time.currentEpochMillis(), changes);
    }

    private static AuditChange change(String key, String value) {
        return AuditChange.forNullableScalar(key, null, value);
    }

    private static String requestHash(RegisterArtifact command) {
        String canonical = command.workspaceUuid() + "|" + command.groupWorkspaceKey() + "|"
                + command.actor().actorType() + "|" + command.actor().actorId() + "|" + command.stageRef()
                + "|" + command.kind() + "|" + command.minimumFullArtifactRef() + "|"
                + CommandReceiptSupport.requestHash(command.stageBindGrant());
        return CommandReceiptSupport.requestHash(canonical);
    }

    private static ArtifactReadback deserialize(String json) {
        try { return JSON.readValue(json, ArtifactReadback.class); }
        catch (Exception failure) { throw new TerminalUpdateOwnerInvariantException(failure); }
    }

    public static class TerminalUpdateArtifactInvalidException extends RuntimeException {}
    public static class TerminalUpdateStageNotOwnedException extends RuntimeException {
        public TerminalUpdateStageNotOwnedException() {}
        public TerminalUpdateStageNotOwnedException(Throwable cause) { super(cause); }
    }
    public static class TerminalUpdateStageNotFoundException extends RuntimeException {}
    public static class TerminalUpdateStageExpiredException extends RuntimeException {}
    public static class TerminalUpdateStageConflictException extends RuntimeException {}
    public static class TerminalUpdateIdempotencyConflictException extends RuntimeException {}
    public static class TerminalUpdatePublicationConflictException extends RuntimeException {}
    public static class TerminalUpdateMinimumFullInvalidException extends RuntimeException {}
    public static class TerminalUpdateArtifactNotFoundException extends RuntimeException {}
    public static class TerminalUpdateOwnerInvariantException extends RuntimeException {
        public TerminalUpdateOwnerInvariantException() {}
        public TerminalUpdateOwnerInvariantException(Throwable cause) { super(cause); }
    }
    public static class TerminalUpdateArtifactNotAuthorizedException extends RuntimeException {}
    public static class TerminalUpdateDownloadGrantExpiredException extends RuntimeException {}
    public static class TerminalUpdateDownloadBusyException extends RuntimeException {}
}
