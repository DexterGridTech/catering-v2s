package com.catering.v2s.terminalupdate.api;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.audit.contract.AuditHistoryPage;
import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi.Verification;
import java.util.Objects;
import java.util.UUID;
import java.util.List;

/** Public owner commands and reads for immutable terminal update artifacts. */
public interface TerminalUpdateArtifactOwnerApi {
    StageAcceptance acceptValidatedStage(ValidatedStage stage, AuditActor actor);

    ArtifactReadback register(RegisterArtifact command);

    void releaseStage(ReleaseStage command);

    ArtifactReadback read(UUID workspaceUuid, String groupWorkspaceKey, UUID artifactRef);

    java.util.List<ArtifactReadback> readPage(
            UUID workspaceUuid, String groupWorkspaceKey, int limit, UUID before, ArtifactQuery query);

    AuditHistoryPage readAuditHistory(
            UUID workspaceUuid, String groupWorkspaceKey, UUID artifactRef, long page, long pageSize);

    DownloadGrant issueDownloadGrant(Verification binding, UUID artifactRef);

    AuthorizedPackage authorizeDownload(String grant);

    record DownloadGrant(String relativeContentPath, String grant, long expiresAtEpochMillis,
            UUID artifactRef, String zipSha256, long byteSize, ArtifactManifest artifact) {}

    record ArtifactManifest(
            int schemaVersion,
            String platform,
            String applicationId,
            String nativeVersion,
            long nativeBuildNumber,
            String bundleVersion,
            String runtimeVersion,
            String entry,
            List<ArtifactFile> files,
            String publicationId,
            MinimumFull minimumFull,
            ApkFacts apk) {
        public ArtifactManifest {
            if (schemaVersion != 1) throw new IllegalArgumentException("schemaVersion is invalid");
            platform = required(platform, "platform", 32);
            applicationId = required(applicationId, "applicationId", 255);
            nativeVersion = required(nativeVersion, "nativeVersion", 64);
            if (nativeBuildNumber < 1) throw new IllegalArgumentException("nativeBuildNumber is invalid");
            bundleVersion = required(bundleVersion, "bundleVersion", 64);
            runtimeVersion = required(runtimeVersion, "runtimeVersion", 128);
            entry = required(entry, "entry", 1024);
            files = List.copyOf(Objects.requireNonNull(files, "files"));
            if (files.isEmpty() || files.size() > 128) throw new IllegalArgumentException("files are invalid");
            publicationId = digest(publicationId, "publicationId");
        }
    }

    record ArtifactFile(String path, long sizeBytes, String sha256) {
        public ArtifactFile {
            path = required(path, "path", 1024);
            if (sizeBytes < 0) throw new IllegalArgumentException("sizeBytes is invalid");
            sha256 = digest(sha256, "sha256");
        }
    }

    record ApkFacts(String path, String sha256, String certificateSha256) {
        public ApkFacts {
            path = required(path, "path", 1024);
            sha256 = digest(sha256, "sha256");
            certificateSha256 = digest(certificateSha256, "certificateSha256");
        }
    }

    record AuthorizedPackage(UUID workspaceUuid, String groupWorkspaceKey, UUID artifactRef, UUID assetRef,
            String zipSha256, long byteSize) {}

    record MinimumFull(
            String applicationId,
            long nativeBuildNumber,
            String runtimeVersion,
            String publicationId,
            String apkSha256) {
        public MinimumFull {
            applicationId = required(applicationId, "applicationId", 255);
            if (nativeBuildNumber < 1) throw new IllegalArgumentException("nativeBuildNumber is invalid");
            runtimeVersion = required(runtimeVersion, "runtimeVersion", 128);
            publicationId = digest(publicationId, "publicationId");
            apkSha256 = digest(apkSha256, "apkSha256");
        }
    }

    record ValidatedStage(
            UUID stageRef,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID assetRef,
            String fileName,
            long expiresAtEpochMillis,
            long byteSize,
            String zipSha256,
            String applicationId,
            String platform,
            String nativeVersion,
            long nativeBuildNumber,
            String bundleVersion,
            String runtimeVersion,
            String entryPath,
            String filesJson,
            String publicationId,
            String apkPath,
            String apkSha256,
            String certificateSha256,
            MinimumFull minimumFull,
            String ownerActorType,
            UUID ownerActorId) {
        public ValidatedStage {
            stageRef = Objects.requireNonNull(stageRef, "stageRef");
            workspaceUuid = Objects.requireNonNull(workspaceUuid, "workspaceUuid");
            groupWorkspaceKey = required(groupWorkspaceKey, "groupWorkspaceKey", 64);
            assetRef = Objects.requireNonNull(assetRef, "assetRef");
            fileName = required(fileName, "fileName", 255);
            if (expiresAtEpochMillis < 1 || byteSize < 4) throw new IllegalArgumentException("stage bounds invalid");
            zipSha256 = digest(zipSha256, "zipSha256");
            applicationId = required(applicationId, "applicationId", 255);
            platform = required(platform, "platform", 32);
            nativeVersion = required(nativeVersion, "nativeVersion", 64);
            if (nativeBuildNumber < 1) throw new IllegalArgumentException("nativeBuildNumber is invalid");
            bundleVersion = required(bundleVersion, "bundleVersion", 64);
            runtimeVersion = required(runtimeVersion, "runtimeVersion", 128);
            entryPath = required(entryPath, "entryPath", 1024);
            filesJson = required(filesJson, "filesJson", 262_144);
            publicationId = digest(publicationId, "publicationId");
            if (apkPath != null) apkPath = required(apkPath, "apkPath", 1024);
            if (apkSha256 != null) apkSha256 = digest(apkSha256, "apkSha256");
            if (certificateSha256 != null) certificateSha256 = digest(certificateSha256, "certificateSha256");
            if ((apkPath == null) != (apkSha256 == null) || (apkPath == null) != (certificateSha256 == null))
                throw new IllegalArgumentException("APK facts must be complete");
            ownerActorType = required(ownerActorType, "ownerActorType", 48);
            ownerActorId = Objects.requireNonNull(ownerActorId, "ownerActorId");
        }
    }

    record StageAcceptance(UUID stageRef, boolean inserted) {
        public StageAcceptance {
            stageRef = Objects.requireNonNull(stageRef, "stageRef");
        }
    }

    record RegisterArtifact(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID stageRef,
            AuditActor actor,
            String stageBindGrant,
            String kind,
            UUID minimumFullArtifactRef,
            String idempotencyKey) {
        public RegisterArtifact {
            workspaceUuid = Objects.requireNonNull(workspaceUuid, "workspaceUuid");
            groupWorkspaceKey = required(groupWorkspaceKey, "groupWorkspaceKey", 64);
            stageRef = Objects.requireNonNull(stageRef, "stageRef");
            actor = Objects.requireNonNull(actor, "actor");
            stageBindGrant = required(stageBindGrant, "stageBindGrant", 512);
            kind = required(kind, "kind", 16);
            if (!kind.equals("FULL") && !kind.equals("HOT")) throw new IllegalArgumentException("kind is invalid");
            idempotencyKey = required(idempotencyKey, "idempotencyKey", 128);
            if (idempotencyKey.length() < 16) throw new IllegalArgumentException("idempotencyKey is invalid");
            if (kind.equals("FULL") && minimumFullArtifactRef != null)
                throw new IllegalArgumentException("FULL cannot reference a minimum FULL");
            if (kind.equals("HOT") && minimumFullArtifactRef == null)
                throw new IllegalArgumentException("HOT requires a minimum FULL");
        }

        @Override
        public String toString() {
            return "RegisterArtifact[workspaceUuid=" + workspaceUuid + ", stageRef=" + stageRef
                    + ", kind=" + kind + ", stageBindGrant=redacted, idempotencyKey=redacted]";
        }
    }

    record ReleaseStage(UUID workspaceUuid, String groupWorkspaceKey, UUID stageRef, AuditActor actor, String stageBindGrant) {
        public ReleaseStage {
            workspaceUuid = Objects.requireNonNull(workspaceUuid, "workspaceUuid");
            groupWorkspaceKey = required(groupWorkspaceKey, "groupWorkspaceKey", 64);
            stageRef = Objects.requireNonNull(stageRef, "stageRef");
            actor = Objects.requireNonNull(actor, "actor");
            stageBindGrant = required(stageBindGrant, "stageBindGrant", 512);
        }

        @Override
        public String toString() {
            return "ReleaseStage[workspaceUuid=" + workspaceUuid + ", stageRef=" + stageRef
                    + ", stageBindGrant=redacted]";
        }
    }

    record ArtifactReadback(
            UUID artifactRef,
            String kind,
            String applicationId,
            String platform,
            String nativeVersion,
            long nativeBuildNumber,
            String bundleVersion,
            String runtimeVersion,
            String entryPath,
            String filesJson,
            String publicationId,
            UUID assetRef,
            String zipSha256,
            String apkSha256,
            String apkPath,
            String certificateSha256,
            long byteSize,
            UUID minimumFullArtifactRef,
            MinimumFull minimumFull,
            long createdAtEpochMillis) {}

    record ArtifactQuery(String kind, String applicationId, String runtimeVersion, String queryText,
            Long minimumFullNativeBuildNumber, String minimumFullPublicationId, String minimumFullApkSha256) {
        public ArtifactQuery {
            if (kind != null && !kind.equals("FULL") && !kind.equals("HOT")) throw new IllegalArgumentException("kind is invalid");
            if (applicationId != null && (applicationId.isBlank() || applicationId.length() > 128)) throw new IllegalArgumentException("applicationId is invalid");
            if (runtimeVersion != null && (runtimeVersion.isBlank() || runtimeVersion.length() > 128)) throw new IllegalArgumentException("runtimeVersion is invalid");
            if (queryText != null && (queryText.isBlank() || queryText.length() > 120)) throw new IllegalArgumentException("queryText is invalid");
            if (minimumFullNativeBuildNumber != null && minimumFullNativeBuildNumber < 0) throw new IllegalArgumentException("minimumFullNativeBuildNumber is invalid");
            if (minimumFullPublicationId != null && !minimumFullPublicationId.matches("[a-f0-9]{64}")) throw new IllegalArgumentException("minimumFullPublicationId is invalid");
            if (minimumFullApkSha256 != null && !minimumFullApkSha256.matches("[a-f0-9]{64}")) throw new IllegalArgumentException("minimumFullApkSha256 is invalid");
            boolean hasMinimumFullFilter = minimumFullNativeBuildNumber != null
                    || minimumFullPublicationId != null || minimumFullApkSha256 != null;
            boolean hasCompleteMinimumFullFilter = minimumFullNativeBuildNumber != null
                    && minimumFullPublicationId != null && minimumFullApkSha256 != null;
            if (hasMinimumFullFilter && (!hasCompleteMinimumFullFilter || kind == null
                    || applicationId == null || runtimeVersion == null))
                throw new IllegalArgumentException("minimum FULL filter requires all five identity facts");
        }
    }

    private static String required(String value, String name, int max) {
        if (value == null || value.isBlank() || value.length() > max)
            throw new IllegalArgumentException(name + " is invalid");
        return value;
    }

    private static String digest(String value, String name) {
        if (value == null || !value.matches("[a-f0-9]{64}"))
            throw new IllegalArgumentException(name + " is invalid");
        return value;
    }
}
