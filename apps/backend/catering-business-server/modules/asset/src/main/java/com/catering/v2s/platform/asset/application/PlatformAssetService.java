package com.catering.v2s.platform.asset.application;

import com.catering.v2s.platform.asset.api.WorkspaceLogoAssetCommand;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import java.io.BufferedInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Collection;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Owner service for public static images and videos. Business owners retain only asset references. */
@Service
public class PlatformAssetService implements WorkspaceLogoAssetCommand {
    private static final long MAX_IMAGE_BYTES = 5L * 1024 * 1024;
    /** Video is deliberately not capped at the image/logo limit; future approved video usage stays streaming. */
    private static final long MAX_VIDEO_BYTES = 512L * 1024 * 1024;
    private final JdbcTemplate jdbc;
    private final TimeProvider time;
    private final AssetObjectStorage objects;
    private final SecureRandom random = new SecureRandom();

    public PlatformAssetService(JdbcTemplate jdbc, TimeProvider time, AssetObjectStorage objects) {
        this.jdbc = jdbc;
        this.time = time;
        this.objects = objects;
    }

    /** Metadata-only staging for a pre-existing object. The object must be in the configured owner bucket. */
    @Transactional
    public AssetReadback stage(UUID assetRef, String usage, String objectKey, String contentType, long sizeBytes, String sha256) {
        if (assetRef == null || !validUsageContentType(usage, contentType) || !objects.ownsObjectKey(objectKey) || sha256 == null || !sha256.matches("[a-f0-9]{64}") || sizeBytes <= 0 || sizeBytes > maxBytes(contentType) || !objects.exists(objectKey)) throw new AssetInputInvalidException();
        long now = time.currentEpochMillis();
        jdbc.update("INSERT INTO platform_asset.staged_asset (asset_ref, usage, storage_key, bucket_name, object_key, content_type, size_bytes, sha256, status, created_at_epoch_millis, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'STAGED', ?, 1)", assetRef, usage, objectKey, objects.bucketName(), objectKey, contentType, sizeBytes, sha256, now);
        return require(assetRef);
    }

    /**
     * Stores only immutable content-hash objects. The one-time bind proof is stored as a hash and
     * must be consumed by the workspace command before the object becomes public.
     */
    public StageReadback stageContent(String usage, String contentType, long declaredSizeBytes, InputStream content) {
        return stageContent(usage, contentType, declaredSizeBytes, content, null);
    }

    public StageReadback stageContent(String usage, String contentType, long declaredSizeBytes, InputStream content, String idempotencyKey) {
        if (!validUsageContentType(usage, contentType) || content == null || declaredSizeBytes <= 0 || declaredSizeBytes > maxBytes(contentType)) throw new AssetInputInvalidException();
        MaterializedContent materialized = materializeAndValidate(contentType, declaredSizeBytes, content);
        String requestHash = sha256((usage + "|" + contentType + "|" + materialized.sizeBytes() + "|" + materialized.sha256()).getBytes(StandardCharsets.UTF_8));
        if (idempotencyKey != null) {
            if (idempotencyKey.length() < 16 || idempotencyKey.length() > 128) { deleteQuietly(materialized.path()); throw new AssetInputInvalidException(); }
            Replay replay = jdbc.query("SELECT receipt.request_hash, asset.asset_ref, asset.status, asset.content_type, asset.size_bytes, asset.sha256 FROM platform_asset.asset_command_receipt receipt JOIN platform_asset.staged_asset asset ON asset.asset_ref=receipt.asset_ref WHERE receipt.idempotency_key=? FOR UPDATE", statement -> statement.setString(1, idempotencyKey), result -> result.next() ? new Replay(result.getString(1), result.getObject(2, UUID.class), result.getString(3), result.getString(4), result.getLong(5), result.getString(6)) : null);
            if (replay != null) {
                deleteQuietly(materialized.path());
                if (!requestHash.equals(replay.requestHash()) || !"STAGED".equals(replay.status())) throw new AssetIdempotencyConflictException();
                String renewed = secret(); long replayNow = time.currentEpochMillis(); long replayExpires = replayNow + 15 * 60 * 1000L;
                jdbc.update("UPDATE platform_asset.asset_bind_grant SET consumed_at_epoch_millis=? WHERE asset_ref=? AND consumed_at_epoch_millis IS NULL", replayNow, replay.assetRef());
                jdbc.update("INSERT INTO platform_asset.asset_bind_grant (asset_ref, grant_hash, expires_at_epoch_millis) VALUES (?, ?, ?)", replay.assetRef(), sha256(renewed.getBytes(StandardCharsets.UTF_8)), replayExpires);
                return new StageReadback(replay.assetRef(), renewed, replayExpires, replay.contentType(), replay.sizeBytes(), replay.sha256());
            }
        }
        UUID assetRef = UUID.randomUUID();
        String digest = materialized.sha256();
        String objectKey = objects.objectKey("static/" + digest + suffix(contentType));
        String grant = secret();
        long now = time.currentEpochMillis();
        long expires = now + 15 * 60 * 1000L;
        boolean uploadedByThisAttempt = false;
        try (InputStream upload = Files.newInputStream(materialized.path())) {
            // Object I/O deliberately happens outside a database transaction. Content-addressed
            // objects are shared, so an existing object is never overwritten or later deleted by
            // this attempt's relational rollback/constraint failure.
            if (!objects.exists(objectKey)) {
                objects.put(objectKey, contentType, materialized.sizeBytes(), upload);
                uploadedByThisAttempt = true;
            }
            jdbc.update("INSERT INTO platform_asset.staged_asset (asset_ref, usage, storage_key, bucket_name, object_key, content_type, size_bytes, sha256, status, created_at_epoch_millis, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'STAGED', ?, 1)", assetRef, usage, objectKey, objects.bucketName(), objectKey, contentType, materialized.sizeBytes(), digest, now);
            jdbc.update("INSERT INTO platform_asset.asset_bind_grant (asset_ref, grant_hash, expires_at_epoch_millis) VALUES (?, ?, ?)", assetRef, sha256(grant.getBytes(StandardCharsets.UTF_8)), expires);
            if (idempotencyKey != null) jdbc.update("INSERT INTO platform_asset.asset_command_receipt (idempotency_key, asset_ref, request_hash, response_json, created_at_epoch_millis) VALUES (?, ?, ?, CAST(? AS JSONB), ?)", idempotencyKey, assetRef, requestHash, "{\"assetRef\":\"" + assetRef + "\",\"contentType\":\"" + contentType + "\",\"sizeBytes\":" + materialized.sizeBytes() + ",\"sha256\":\"" + digest + "\"}", now);
        } catch (RuntimeException failure) {
            deleteOnlyUnreferencedUpload(objectKey, uploadedByThisAttempt);
            throw failure;
        } catch (IOException failure) {
            deleteOnlyUnreferencedUpload(objectKey, uploadedByThisAttempt);
            throw new AssetStorageUnavailableException(failure);
        } finally {
            try { Files.deleteIfExists(materialized.path()); } catch (IOException ignored) { }
        }
        return new StageReadback(assetRef, grant, expires, contentType, materialized.sizeBytes(), digest);
    }

    @Override @Transactional
    public void claim(UUID assetRef, UUID workspaceUuid, String groupWorkspaceKey, String bindGrant) {
        if (assetRef == null || workspaceUuid == null || groupWorkspaceKey == null || bindGrant == null || bindGrant.isBlank()) throw new AssetClaimRejectedException();
        long now = time.currentEpochMillis();
        String proof = sha256(bindGrant.getBytes(StandardCharsets.UTF_8));
        int consumed = jdbc.update("UPDATE platform_asset.asset_bind_grant g SET consumed_at_epoch_millis=? FROM platform_asset.staged_asset a WHERE g.asset_ref=? AND a.asset_ref=g.asset_ref AND a.status='STAGED' AND a.usage='GROUP_WORKSPACE_LOGO' AND g.consumed_at_epoch_millis IS NULL AND g.expires_at_epoch_millis>=? AND g.grant_hash=?", now, assetRef, now, proof);
        if (consumed != 1) throw new AssetClaimRejectedException();
        int changed = jdbc.update("UPDATE platform_asset.staged_asset SET workspace_uuid=?, group_workspace_key=?, status='ACTIVE', claimed_by_type='GROUP_WORKSPACE_LOGO', claimed_by_id=?, activated_at_epoch_millis=?, version=version+1 WHERE asset_ref=? AND status='STAGED'", workspaceUuid, groupWorkspaceKey, workspaceUuid, now, assetRef);
        if (changed != 1) throw new AssetClaimRejectedException();
    }

    @Override @Transactional
    public void release(UUID assetRef, UUID workspaceUuid) {
        jdbc.update("UPDATE platform_asset.staged_asset SET status='RELEASED', released_at_epoch_millis=?, version=version+1 WHERE asset_ref=? AND claimed_by_id=? AND status='ACTIVE'", time.currentEpochMillis(), assetRef, workspaceUuid);
    }

    /** Releases an unclaimed staging asset only when the one-time staging proof is presented. */
    @Override @Transactional
    public void releaseStaged(UUID assetRef, String bindGrant) {
        if (assetRef == null || bindGrant == null || bindGrant.isBlank()) throw new AssetClaimRejectedException();
        long now = time.currentEpochMillis();
        String proof = sha256(bindGrant.getBytes(StandardCharsets.UTF_8));
        int released = jdbc.update("UPDATE platform_asset.staged_asset a SET status='RELEASED', released_at_epoch_millis=?, version=version+1 WHERE a.asset_ref=? AND a.status='STAGED' AND EXISTS (SELECT 1 FROM platform_asset.asset_bind_grant g WHERE g.asset_ref=a.asset_ref AND g.consumed_at_epoch_millis IS NULL AND g.expires_at_epoch_millis>=? AND g.grant_hash=?)", now, assetRef, now, proof);
        if (released != 1) throw new AssetClaimRejectedException();
        jdbc.update("UPDATE platform_asset.asset_bind_grant SET consumed_at_epoch_millis=? WHERE asset_ref=? AND consumed_at_epoch_millis IS NULL AND grant_hash=?", now, assetRef, proof);
    }

    @Transactional(readOnly = true)
    public AssetReadback require(UUID assetRef) {
        return jdbc.query("SELECT asset_ref, usage, status, version FROM platform_asset.staged_asset WHERE asset_ref=?", statement -> statement.setObject(1, assetRef), result -> { if (!result.next()) throw new AssetNotFoundException(); return new AssetReadback(result.getObject("asset_ref", UUID.class), result.getString("usage"), result.getString("status"), result.getLong("version")); });
    }

    @Transactional(readOnly = true)
    public PublicAssetReference requireActivePublicReference(UUID assetRef) {
        ActiveAsset asset = jdbc.query("SELECT object_key, content_type, sha256 FROM platform_asset.staged_asset WHERE asset_ref=? AND status='ACTIVE'", statement -> statement.setObject(1, assetRef), result -> {
            if (!result.next()) throw new AssetNotFoundException();
            return new ActiveAsset(result.getString("object_key"), result.getString("content_type"), result.getString("sha256"));
        });
        if (!objects.exists(asset.objectKey())) throw new AssetNotFoundException();
        return new PublicAssetReference(objects.publicUrl(asset.objectKey()), asset.contentType(), asset.sha256());
    }

    /** Bounded owner task read for a collection surface; absent/inactive/object-missing remains a failure. */
    @Transactional(readOnly = true)
    public Map<UUID, PublicAssetReference> requireActivePublicReferences(Collection<UUID> assetRefs) {
        LinkedHashSet<UUID> distinct = new LinkedHashSet<>(assetRefs == null ? List.of() : assetRefs);
        if (distinct.isEmpty()) return Map.of();
        if (distinct.contains(null)) throw new AssetNotFoundException();
        String placeholders = String.join(",", java.util.Collections.nCopies(distinct.size(), "?"));
        List<UUID> ids = List.copyOf(distinct);
        Map<UUID, ActiveAsset> active = jdbc.query("SELECT asset_ref, object_key, content_type, sha256 FROM platform_asset.staged_asset WHERE status='ACTIVE' AND asset_ref IN (" + placeholders + ")", statement -> {
            for (int index = 0; index < ids.size(); index++) statement.setObject(index + 1, ids.get(index));
        }, result -> {
            Map<UUID, ActiveAsset> resultById = new LinkedHashMap<>();
            while (result.next()) resultById.put(result.getObject("asset_ref", UUID.class), new ActiveAsset(result.getString("object_key"), result.getString("content_type"), result.getString("sha256")));
            return resultById;
        });
        if (active.size() != ids.size()) throw new AssetNotFoundException();
        Map<UUID, PublicAssetReference> references = new LinkedHashMap<>();
        for (UUID id : ids) {
            ActiveAsset asset = active.get(id);
            if (asset == null || !objects.exists(asset.objectKey())) throw new AssetNotFoundException();
            references.put(id, new PublicAssetReference(objects.publicUrl(asset.objectKey()), asset.contentType(), asset.sha256()));
        }
        return Map.copyOf(references);
    }

    private static boolean validUsageContentType(String usage, String contentType) {
        // R5 currently approves a logo usage only. Video support stays in the object adapter/public origin,
        // but it may not be smuggled into the logo command before a video owner usage is approved.
        return "GROUP_WORKSPACE_LOGO".equals(usage) && ("image/png".equals(contentType) || "image/jpeg".equals(contentType) || "image/webp".equals(contentType));
    }
    private static boolean validContentType(String value) { return "image/png".equals(value) || "image/jpeg".equals(value) || "image/webp".equals(value) || "video/mp4".equals(value); }
    private static String suffix(String contentType) { return switch (contentType) { case "image/png" -> ".png"; case "image/jpeg" -> ".jpg"; case "image/webp" -> ".webp"; case "video/mp4" -> ".mp4"; default -> throw new AssetInputInvalidException(); }; }
    private static long maxBytes(String contentType) { return "video/mp4".equals(contentType) ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES; }
    private static MaterializedContent materializeAndValidate(String contentType, long declaredSizeBytes, InputStream source) {
        Path file;
        try { file = Files.createTempFile("catering-v2s-asset-", ".upload"); }
        catch (IOException failure) { throw new AssetStorageUnavailableException(failure); }
        long size = 0;
        byte[] prefix = new byte[8192];
        int prefixLength = 0;
        MessageDigest digest;
        try { digest = MessageDigest.getInstance("SHA-256"); }
        catch (Exception failure) { throw new IllegalStateException(failure); }
        try (InputStream input = new BufferedInputStream(source); var output = Files.newOutputStream(file)) {
            byte[] buffer = new byte[8192];
            for (int read; (read = input.read(buffer)) != -1;) {
                size += read;
                if (size > maxBytes(contentType)) throw new AssetInputInvalidException();
                int copied = Math.min(read, prefix.length - prefixLength);
                if (copied > 0) { System.arraycopy(buffer, 0, prefix, prefixLength, copied); prefixLength += copied; }
                digest.update(buffer, 0, read);
                output.write(buffer, 0, read);
            }
        } catch (AssetInputInvalidException failure) {
            deleteQuietly(file); throw failure;
        } catch (IOException failure) {
            deleteQuietly(file); throw new AssetStorageUnavailableException(failure);
        }
        if (size != declaredSizeBytes || size == 0 || !matchesMagic(contentType, prefix, prefixLength) || (isImage(contentType) && !decodesImage(file))) {
            deleteQuietly(file); throw new AssetInputInvalidException();
        }
        return new MaterializedContent(file, size, HexFormat.of().formatHex(digest.digest()));
    }
    private static boolean isImage(String contentType) { return contentType.startsWith("image/"); }
    private static boolean decodesImage(Path file) { try (InputStream input = Files.newInputStream(file)) { return ImageIO.read(input) != null; } catch (IOException failure) { return false; } }
    private static boolean matchesMagic(String contentType, byte[] value, int length) {
        return switch (contentType) {
            case "image/png" -> length >= 8 && value[0] == (byte) 0x89 && value[1] == 0x50 && value[2] == 0x4e && value[3] == 0x47 && value[4] == 0x0d && value[5] == 0x0a && value[6] == 0x1a && value[7] == 0x0a;
            case "image/jpeg" -> length >= 3 && value[0] == (byte) 0xff && value[1] == (byte) 0xd8 && value[2] == (byte) 0xff;
            case "image/webp" -> length >= 12 && value[0] == 0x52 && value[1] == 0x49 && value[2] == 0x46 && value[3] == 0x46 && value[8] == 0x57 && value[9] == 0x45 && value[10] == 0x42 && value[11] == 0x50;
            case "video/mp4" -> length >= 12 && value[4] == 0x66 && value[5] == 0x74 && value[6] == 0x79 && value[7] == 0x70;
            default -> false;
        };
    }
    private void deleteOnlyUnreferencedUpload(String objectKey, boolean uploadedByThisAttempt) {
        if (!uploadedByThisAttempt) return;
        Boolean stillReferenced = jdbc.query(
            "SELECT EXISTS(SELECT 1 FROM platform_asset.staged_asset WHERE object_key=?)",
            statement -> statement.setString(1, objectKey),
            result -> result.next() && result.getBoolean(1)
        );
        if (!Boolean.TRUE.equals(stillReferenced)) {
            try { objects.delete(objectKey); } catch (RuntimeException ignored) { }
        }
    }
    private static void deleteQuietly(Path file) { try { Files.deleteIfExists(file); } catch (IOException ignored) { } }
    private String secret() { byte[] bytes = new byte[32]; random.nextBytes(bytes); return HexFormat.of().formatHex(bytes); }
    private static String sha256(byte[] bytes) { try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)); } catch (Exception failure) { throw new IllegalStateException(failure); } }
    public record AssetReadback(UUID assetRef, String usage, String status, long version) { }
    public record StageReadback(UUID assetRef, String bindGrant, long expiresAt, String contentType, long sizeBytes, String sha256) { }
    public record PublicAssetReference(String publicUrl, String contentType, String sha256) { }
    private record ActiveAsset(String objectKey, String contentType, String sha256) { }
    private record MaterializedContent(Path path, long sizeBytes, String sha256) { }
    private record Replay(String requestHash, UUID assetRef, String status, String contentType, long sizeBytes, String sha256) { }
    public static final class AssetInputInvalidException extends RuntimeException { }
    public static final class AssetIdempotencyConflictException extends RuntimeException { }
    public static final class AssetStorageUnavailableException extends RuntimeException { public AssetStorageUnavailableException(Throwable cause) { super(cause); } }
    public static final class AssetClaimRejectedException extends RuntimeException { }
    public static final class AssetNotFoundException extends RuntimeException { }
}
