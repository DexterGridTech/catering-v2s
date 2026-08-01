package com.catering.v2s.platform.asset.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.catering.v2s.platform.foundation.time.TimeProvider;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
class PlatformAssetServiceTest {
    @Container static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");
    private static Flyway flyway;
    private static PlatformAssetService assets;
    private static JdbcTemplate jdbc;
    private static UUID workspaceId;

    @BeforeAll static void setup() {
        flyway = Flyway.configure().dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword()).locations("filesystem:../../src/main/resources/db/migration").schemas("public").defaultSchema("public").cleanDisabled(false).load();
        flyway.migrate();
        jdbc = new JdbcTemplate(new DriverManagerDataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword()));
        long now = 1_785_000_000_000L;
        workspaceId = UUID.randomUUID();
        jdbc.update("INSERT INTO platform_workspace.group_workspace (workspace_uuid, group_workspace_key, name, name_normalized, operations_title, status, revision, version, created_at_epoch_millis, updated_at_epoch_millis, status_changed_at_epoch_millis) VALUES (?, 'asset-flow', 'Asset flow', 'asset flow', 'Asset flow', 'ENABLED', 1, 1, ?, ?, ?)", workspaceId, now, now, now);
        TimeProvider time = () -> now;
        assets = new PlatformAssetService(jdbc, time, new MemoryObjects());
    }

    @Test void onlyActiveAssetExposesPublicReferenceAfterOneTimeClaim() {
        byte[] png = png();
        var staged = assets.stageContent("GROUP_WORKSPACE_LOGO", "image/png", png.length, new ByteArrayInputStream(png));
        assertThrows(PlatformAssetService.AssetNotFoundException.class, () -> assets.requireActivePublicReference(staged.assetRef()));
        assets.claim(staged.assetRef(), workspaceId, "asset-flow", staged.bindGrant());
        var reference = assets.requireActivePublicReference(staged.assetRef());
        assertEquals("image/png", reference.contentType());
        assertTrue(reference.publicUrl().startsWith("https://assets.test/r5-assets/tenant-prod/static/"));
        assertThrows(PlatformAssetService.AssetClaimRejectedException.class, () -> assets.claim(staged.assetRef(), workspaceId, "asset-flow", staged.bindGrant()));
    }

    @Test void rejectsUnsupportedOrOversizedContent() {
        assertThrows(PlatformAssetService.AssetInputInvalidException.class, () -> assets.stageContent("GROUP_WORKSPACE_LOGO", "text/plain", 1, new ByteArrayInputStream(new byte[]{1})));
        assertThrows(PlatformAssetService.AssetInputInvalidException.class, () -> assets.stageContent("GROUP_WORKSPACE_LOGO", "image/png", 4, new ByteArrayInputStream(new byte[]{1, 2, 3, 4})));
        assertThrows(PlatformAssetService.AssetInputInvalidException.class, () -> assets.stageContent("GROUP_WORKSPACE_LOGO", "image/png", png().length + 1L, new ByteArrayInputStream(png())));
    }

    @Test void stagingReleaseRequiresTheLiveOneTimeProof() {
        var staged = assets.stageContent("GROUP_WORKSPACE_LOGO", "image/png", png().length, new ByteArrayInputStream(png()));
        assertThrows(PlatformAssetService.AssetClaimRejectedException.class, () -> assets.releaseStaged(staged.assetRef(), "wrong-proof"));
        assets.releaseStaged(staged.assetRef(), staged.bindGrant());
        assertEquals("RELEASED", assets.require(staged.assetRef()).status());
        assertThrows(PlatformAssetService.AssetClaimRejectedException.class, () -> assets.releaseStaged(staged.assetRef(), staged.bindGrant()));
    }

    @AfterAll static void cleanup() { if (flyway != null) flyway.clean(); }

    private static byte[] png() {
        try {
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            if (!javax.imageio.ImageIO.write(new BufferedImage(1, 1, BufferedImage.TYPE_INT_ARGB), "png", output)) throw new IllegalStateException("PNG_WRITER_UNAVAILABLE");
            return output.toByteArray();
        } catch (java.io.IOException failure) { throw new IllegalStateException(failure); }
    }

    private static final class MemoryObjects implements AssetObjectStorage {
        private final Map<String, byte[]> objects = new HashMap<>();
        @Override public String bucketName() { return "r5-assets"; }
        @Override public String objectKey(String suffix) { return "tenant-prod/" + suffix; }
        @Override public boolean ownsObjectKey(String key) { return key != null && key.matches("tenant-prod/static/[a-f0-9]{64}(?:\\.[a-z0-9]{2,5})?"); }
        @Override public void put(String key, String contentType, long size, InputStream bytes) { try { objects.put(key, bytes.readAllBytes()); } catch (java.io.IOException failure) { throw new IllegalStateException(failure); } }
        @Override public boolean exists(String key) { return objects.containsKey(key); }
        @Override public String publicUrl(String key) { return "https://assets.test/r5-assets/" + key; }
        @Override public void delete(String key) { objects.remove(key); }
    }
}
