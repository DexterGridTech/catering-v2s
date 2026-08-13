package com.catering.v2s.platform.asset.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
class PlatformAssetServiceTest {
    @Container static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");
    private static Flyway flyway;
    private static PlatformAssetService assets;
    private static MemoryObjects objects;
    private static JdbcTemplate jdbc;
    private static UUID workspaceId;
    private static UUID secondWorkspaceId;
    private static UUID dataNodeId;
    private static UUID secondDataNodeId;
    private static TransactionTemplate transactions;

    @BeforeAll static void setup() {
        flyway = Flyway.configure().dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword()).locations("filesystem:../../src/main/resources/db/migration").schemas("public").defaultSchema("public").cleanDisabled(false).load();
        flyway.migrate();
        var dataSource = new DriverManagerDataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
        jdbc = new JdbcTemplate(dataSource);
        transactions = new TransactionTemplate(new DataSourceTransactionManager(dataSource));
        long now = 1_785_000_000_000L;
        workspaceId = UUID.randomUUID();
        secondWorkspaceId = UUID.randomUUID();
        dataNodeId = UUID.randomUUID();
        secondDataNodeId = UUID.randomUUID();
        jdbc.update("INSERT INTO platform_workspace.group_workspace (workspace_uuid, group_workspace_key, name, name_normalized, operations_title, status, revision, version, created_at_epoch_millis, updated_at_epoch_millis, status_changed_at_epoch_millis) VALUES (?, 'asset-flow', 'Asset flow', 'asset flow', 'Asset flow', 'ENABLED', 1, 1, ?, ?, ?)", workspaceId, now, now, now);
        jdbc.update("INSERT INTO platform_workspace.group_workspace (workspace_uuid, group_workspace_key, name, name_normalized, operations_title, status, revision, version, created_at_epoch_millis, updated_at_epoch_millis, status_changed_at_epoch_millis) VALUES (?, 'asset-flow-b', 'Asset flow B', 'asset flow b', 'Asset flow B', 'ENABLED', 1, 1, ?, ?, ?)", secondWorkspaceId, now, now, now);
        TimeProvider time = () -> now;
        objects = new MemoryObjects();
        assets = new PlatformAssetService(jdbc, time, objects);
    }

    @Test void onlyActiveAssetExposesPublicReferenceAfterOneTimeClaim() {
        byte[] png = png(0xff1a365d);
        var staged = assets.stageContent("GROUP_WORKSPACE_LOGO", "image/png", png.length, new ByteArrayInputStream(png));
        assertThrows(PlatformAssetService.AssetNotFoundException.class, () -> assets.requireActivePublicReference(staged.assetRef()));
        assets.claim(staged.assetRef(), workspaceId, "asset-flow", staged.bindGrant());
        var reference = assets.requireActivePublicReference(staged.assetRef());
        assertEquals("image/png", reference.contentType());
        assertTrue(reference.publicUrl().startsWith("https://assets.test/r5-assets/tenant-prod/static/"));
        assertThrows(PlatformAssetService.AssetClaimRejectedException.class, () -> assets.claim(staged.assetRef(), workspaceId, "asset-flow", staged.bindGrant()));
    }

    @Test void activeReferenceReadUsesOwnerMetadataWithoutTurningEveryReadIntoAnObjectStorageHealthCheck() {
        byte[] png = png(0xff334155);
        var staged = assets.stageContent("GROUP_WORKSPACE_LOGO", "image/png", png.length, new ByteArrayInputStream(png));
        assets.claim(staged.assetRef(), workspaceId, "asset-flow", staged.bindGrant());

        objects.failStat = true;
        try {
            assertTrue(assets.requireActivePublicReference(staged.assetRef()).publicUrl().contains(staged.sha256()));
            assertEquals(1, assets.requireActivePublicReferences(java.util.List.of(staged.assetRef())).size());
        } finally {
            objects.failStat = false;
        }
    }

    @Test void batchPublicReferencesUseTheOwnerReadAndPreserveMissingAssetFailure() {
        byte[] firstPng = png(0xff0f172a);
        byte[] secondPng = png(0xff2c5282);
        var first = assets.stageContent("GROUP_WORKSPACE_LOGO", "image/png", firstPng.length, new ByteArrayInputStream(firstPng));
        var second = assets.stageContent("GROUP_WORKSPACE_LOGO", "image/png", secondPng.length, new ByteArrayInputStream(secondPng));
        assets.claim(first.assetRef(), workspaceId, "asset-flow", first.bindGrant());
        assets.claim(second.assetRef(), workspaceId, "asset-flow", second.bindGrant());
        var references = assets.requireActivePublicReferences(java.util.List.of(first.assetRef(), second.assetRef(), first.assetRef()));
        assertEquals(2, references.size());
        assertEquals("image/png", references.get(first.assetRef()).contentType());
        assertThrows(PlatformAssetService.AssetNotFoundException.class, () -> assets.requireActivePublicReferences(java.util.List.of(first.assetRef(), UUID.randomUUID())));
    }

    @Test void rejectsUnsupportedOrOversizedContent() {
        byte[] png = png(0xff3b82f6);
        assertThrows(PlatformAssetService.AssetInputInvalidException.class, () -> assets.stageContent("GROUP_WORKSPACE_LOGO", "text/plain", 1, new ByteArrayInputStream(new byte[]{1})));
        assertThrows(PlatformAssetService.AssetInputInvalidException.class, () -> assets.stageContent("GROUP_WORKSPACE_LOGO", "image/png", 4, new ByteArrayInputStream(new byte[]{1, 2, 3, 4})));
        assertThrows(PlatformAssetService.AssetInputInvalidException.class, () -> assets.stageContent("GROUP_WORKSPACE_LOGO", "image/png", png.length + 1L, new ByteArrayInputStream(png)));
    }

    @Test void stagingReleaseRequiresTheLiveOneTimeProof() {
        byte[] png = png(0xff4c51bf);
        var staged = assets.stageContent("GROUP_WORKSPACE_LOGO", "image/png", png.length, new ByteArrayInputStream(png));
        assertThrows(PlatformAssetService.AssetClaimRejectedException.class, () -> assets.releaseStaged(staged.assetRef(), "wrong-proof"));
        assets.releaseStaged(staged.assetRef(), staged.bindGrant());
        assertEquals("RELEASED", assets.require(staged.assetRef()).status());
        assertThrows(PlatformAssetService.AssetClaimRejectedException.class, () -> assets.releaseStaged(staged.assetRef(), staged.bindGrant()));
    }

    @Test void catalogReferenceOwnsImageLifecycleAndReleaseIsIdempotentByVersion() {
        byte[] png = png(0xff2f855a);
        var staged = assets.stageCatalogContent(workspaceId, "asset-flow", dataNodeId.toString(), "STORE", "image/png", png.length, new ByteArrayInputStream(png), "catalog-image-claim-0001", grant(workspaceId, "asset-flow", dataNodeId));
        assertEquals("STAGED", assets.require(staged.assetRef()).status());
        var active = assets.claimCatalogStaged(staged.assetRef(), workspaceId, "asset-flow", dataNodeId.toString(), "STORE", staged.bindGrant(), grant(workspaceId, "asset-flow", dataNodeId));
        assertEquals("ACTIVE", active.status());
        assertEquals("CATALOG_ITEM_IMAGE", active.usage());
        var released = assets.releaseUnreferencedCatalogAsset(staged.assetRef(), active.version(), "catalog-image-release-0001", workspaceId, "asset-flow", dataNodeId.toString(), "STORE", grant(workspaceId, "asset-flow", dataNodeId));
        assertEquals("RELEASED", released.status());
        assertThrows(PlatformAssetService.AssetClaimRejectedException.class, () -> assets.claimCatalogStaged(staged.assetRef(), workspaceId, "asset-flow", dataNodeId.toString(), "STORE", staged.bindGrant(), grant(workspaceId, "asset-flow", dataNodeId)));

        var restaged = assets.stageCatalogContent(secondWorkspaceId, "asset-flow-b", secondDataNodeId.toString(), "STORE", "image/png", png.length,
            new ByteArrayInputStream(png), "catalog-image-restage-0001", grant(secondWorkspaceId, "asset-flow-b", secondDataNodeId));
        assertEquals(staged.assetRef(), restaged.assetRef());
        assertEquals("STAGED", assets.require(restaged.assetRef()).status());
        assertEquals(released.version() + 1, assets.require(restaged.assetRef()).version());
        assertThrows(PlatformAssetService.AssetClaimRejectedException.class, () -> assets.claimCatalogStaged(restaged.assetRef(), workspaceId, "asset-flow", dataNodeId.toString(), "STORE", restaged.bindGrant(), grant(workspaceId, "asset-flow", dataNodeId)));
        assertEquals("ACTIVE", assets.claimCatalogStaged(restaged.assetRef(), secondWorkspaceId, "asset-flow-b", secondDataNodeId.toString(), "STORE", restaged.bindGrant(), grant(secondWorkspaceId, "asset-flow-b", secondDataNodeId)).status());
    }

    @Test void ownerLocalGlobalReleaseRereadsVersionAndReplaysTheSameReceipt() {
        byte[] png = png(0xff166534);
        var staged = assets.stageCatalogContent(workspaceId, "asset-flow", dataNodeId.toString(), "STORE", "image/png", png.length,
            new ByteArrayInputStream(png), "catalog-owner-local-release-stage-0001", grant(workspaceId, "asset-flow", dataNodeId));
        assets.claimCatalogStaged(staged.assetRef(), workspaceId, "asset-flow", dataNodeId.toString(), "STORE", staged.bindGrant(), grant(workspaceId, "asset-flow", dataNodeId));
        String idempotencyKey = "catalog-owner-local-release-0001";

        var released = assets.releaseUnreferencedCatalogAsset(staged.assetRef(), idempotencyKey,
            workspaceId, "asset-flow", dataNodeId.toString(), "STORE", grant(workspaceId, "asset-flow", dataNodeId));

        assertEquals(released, assets.releaseUnreferencedCatalogAsset(staged.assetRef(), idempotencyKey,
            workspaceId, "asset-flow", dataNodeId.toString(), "STORE", grant(workspaceId, "asset-flow", dataNodeId)));
        assertEquals("RELEASED", assets.require(staged.assetRef()).status());
    }

    @Test void contentAddressedCatalogStageReusesAnExistingAssetReference() {
        byte[] png = png(0xff9f1234);
        var first = assets.stageCatalogContent(workspaceId, "asset-flow", dataNodeId.toString(), "STORE", "image/png", png.length, new ByteArrayInputStream(png), "catalog-image-dedupe-0001", grant(workspaceId, "asset-flow", dataNodeId));
        assets.claimCatalogStaged(first.assetRef(), workspaceId, "asset-flow", dataNodeId.toString(), "STORE", first.bindGrant(), grant(workspaceId, "asset-flow", dataNodeId));

        var replay = assets.stageCatalogContent(workspaceId, "asset-flow", dataNodeId.toString(), "STORE", "image/png", png.length, new ByteArrayInputStream(png), "catalog-image-dedupe-0001", grant(workspaceId, "asset-flow", dataNodeId));

        var second = assets.stageCatalogContent(workspaceId, "asset-flow", dataNodeId.toString(), "STORE", "image/png", png.length, new ByteArrayInputStream(png), "catalog-image-dedupe-0002", grant(workspaceId, "asset-flow", dataNodeId));

        assertEquals(first.assetRef(), replay.assetRef());
        assertEquals(first.assetRef(), second.assetRef());
        assertEquals("ACTIVE", assets.require(second.assetRef()).status());
    }

    @Test void aDifferentCatalogCommandCannotRotateThePendingCommandsGrant() {
        byte[] png = png(0xffbe123c);
        var first = assets.stageCatalogContent(workspaceId, "asset-flow", dataNodeId.toString(), "STORE",
            "image/png", png.length, new ByteArrayInputStream(png), "catalog-pending-grant-0001",
            grant(workspaceId, "asset-flow", dataNodeId));

        assertThrows(PlatformAssetService.AssetIdempotencyConflictException.class,
            () -> assets.stageCatalogContent(workspaceId, "asset-flow", dataNodeId.toString(), "STORE",
                "image/png", png.length, new ByteArrayInputStream(png), "catalog-pending-grant-0002",
                grant(workspaceId, "asset-flow", dataNodeId)));

        assertEquals("ACTIVE", assets.claimCatalogStaged(first.assetRef(), workspaceId, "asset-flow",
            dataNodeId.toString(), "STORE", first.bindGrant(), grant(workspaceId, "asset-flow", dataNodeId)).status());
    }

    @Test void identicalWorkspaceLogoBytesShareThePhysicalObjectButKeepIndependentAssetAndGrantLifecycles() {
        byte[] png = png(0xff64748b);
        int objectsBefore = objects.size();

        var first = assets.stageContent("GROUP_WORKSPACE_LOGO", "image/png", png.length,
            new ByteArrayInputStream(png), "workspace-logo-identical-0001");
        var second = assets.stageContent("GROUP_WORKSPACE_LOGO", "image/png", png.length,
            new ByteArrayInputStream(png), "workspace-logo-identical-0002");

        assertNotEquals(first.assetRef(), second.assetRef());
        assertNotEquals(first.bindGrant(), second.bindGrant());
        assertEquals(first.sha256(), second.sha256());
        assertEquals(2, jdbc.queryForObject(
            "SELECT count(*) FROM platform_asset.staged_asset WHERE sha256=? AND usage='GROUP_WORKSPACE_LOGO'",
            Integer.class, first.sha256()));
        assertEquals(objectsBefore + 1, objects.size());

        assets.claim(first.assetRef(), workspaceId, "asset-flow", first.bindGrant());
        assets.claim(second.assetRef(), secondWorkspaceId, "asset-flow-b", second.bindGrant());
        assertEquals("ACTIVE", assets.require(first.assetRef()).status());
        assertEquals("ACTIVE", assets.require(second.assetRef()).status());
    }

    @Test void identicalBytesAcrossLogoAndCatalogKeepSeparateLogicalOwnershipWhileCatalogStillDeduplicates() {
        byte[] png = png(0xff475569);
        int objectsBefore = objects.size();

        var logo = assets.stageContent("GROUP_WORKSPACE_LOGO", "image/png", png.length,
            new ByteArrayInputStream(png), "workspace-logo-cross-usage-0001");
        var catalog = assets.stageCatalogContent(workspaceId, "asset-flow", dataNodeId.toString(), "STORE",
            "image/png", png.length, new ByteArrayInputStream(png), "catalog-cross-usage-0001",
            grant(workspaceId, "asset-flow", dataNodeId));
        assets.claimCatalogStaged(catalog.assetRef(), workspaceId, "asset-flow", dataNodeId.toString(), "STORE",
            catalog.bindGrant(), grant(workspaceId, "asset-flow", dataNodeId));
        var catalogAgain = assets.stageCatalogContent(workspaceId, "asset-flow", dataNodeId.toString(), "STORE",
            "image/png", png.length, new ByteArrayInputStream(png), "catalog-cross-usage-0002",
            grant(workspaceId, "asset-flow", dataNodeId));

        assertNotEquals(logo.assetRef(), catalog.assetRef());
        assertEquals(catalog.assetRef(), catalogAgain.assetRef());
        assertEquals(2, jdbc.queryForObject(
            "SELECT count(*) FROM platform_asset.staged_asset WHERE sha256=?",
            Integer.class, logo.sha256()));
        assertEquals(1, jdbc.queryForObject(
            "SELECT count(*) FROM platform_asset.staged_asset WHERE sha256=? AND usage='CATALOG_ITEM_IMAGE'",
            Integer.class, logo.sha256()));
        assertEquals(objectsBefore + 1, objects.size());

        byte[] reversePng = png(0xff52525b);
        var catalogFirst = assets.stageCatalogContent(workspaceId, "asset-flow", dataNodeId.toString(), "STORE",
            "image/png", reversePng.length, new ByteArrayInputStream(reversePng), "catalog-cross-usage-reverse-0001",
            grant(workspaceId, "asset-flow", dataNodeId));
        var logoSecond = assets.stageContent("GROUP_WORKSPACE_LOGO", "image/png", reversePng.length,
            new ByteArrayInputStream(reversePng), "workspace-logo-cross-usage-reverse-0001");
        assertNotEquals(catalogFirst.assetRef(), logoSecond.assetRef());
        assertEquals(2, jdbc.queryForObject("SELECT count(*) FROM platform_asset.staged_asset WHERE sha256=?", Integer.class, logoSecond.sha256()));
    }

    @Test void concurrentIdenticalLogoStagesSerializePhysicalCreationButKeepBothLogicalIntents() throws Exception {
        byte[] png = png(0xff71717a);
        int objectsBefore = objects.size();
        var ready = new CountDownLatch(2);
        var start = new CountDownLatch(1);
        var results = new ConcurrentLinkedQueue<PlatformAssetService.StageReadback>();
        var failures = new ConcurrentLinkedQueue<Throwable>();

        try (var executor = Executors.newFixedThreadPool(2)) {
            for (int index = 0; index < 2; index++) {
                final int command = index;
                executor.submit(() -> {
                    ready.countDown();
                    try {
                        start.await(10, TimeUnit.SECONDS);
                        results.add(transactions.execute(status -> assets.stageContent("GROUP_WORKSPACE_LOGO", "image/png", png.length,
                            new ByteArrayInputStream(png), "workspace-logo-concurrent-000" + command)));
                    } catch (Throwable failure) {
                        failures.add(failure);
                    }
                });
            }
            assertTrue(ready.await(10, TimeUnit.SECONDS));
            start.countDown();
            executor.shutdown();
            assertTrue(executor.awaitTermination(30, TimeUnit.SECONDS));
        }

        assertTrue(failures.isEmpty(), () -> "unexpected concurrent failure: " + failures);
        assertEquals(2, results.size());
        assertEquals(2, results.stream().map(PlatformAssetService.StageReadback::assetRef).distinct().count());
        assertEquals(2, jdbc.queryForObject("SELECT count(*) FROM platform_asset.staged_asset WHERE sha256=? AND usage='GROUP_WORKSPACE_LOGO'", Integer.class, results.peek().sha256()));
        assertEquals(objectsBefore + 1, objects.size());
    }

    @Test void databaseUniquenessAppliesToCatalogLogicalReuseButNotSharedPhysicalLogoBytes() {
        String key = "tenant-prod/static/" + "a".repeat(64) + ".png";
        insertStagedAsset(UUID.randomUUID(), "GROUP_WORKSPACE_LOGO", key);
        insertStagedAsset(UUID.randomUUID(), "GROUP_WORKSPACE_LOGO", key);
        insertStagedAsset(UUID.randomUUID(), "CATALOG_ITEM_IMAGE", key);

        assertThrows(DataIntegrityViolationException.class,
            () -> insertStagedAsset(UUID.randomUUID(), "CATALOG_ITEM_IMAGE", key));
        assertEquals(0, jdbc.queryForObject(
            "SELECT count(*) FROM pg_constraint WHERE conrelid='platform_asset.staged_asset'::regclass AND conname IN ('staged_asset_storage_key_key','uq_platform_asset_bucket_object')",
            Integer.class));
        assertEquals(1, jdbc.queryForObject(
            "SELECT count(*) FROM pg_indexes WHERE schemaname='platform_asset' AND tablename='staged_asset' AND indexname='uq_platform_asset_catalog_bucket_object' AND indexdef LIKE 'CREATE UNIQUE INDEX%' AND indexdef LIKE '%CATALOG_ITEM_IMAGE%'",
            Integer.class));
    }

    @Test void catalogStageCannotBeClaimedOrDiscardedByAnotherWorkspaceButActiveRefCanBeReusedAcrossScopes() {
        byte[] firstPng = png(0xff7c3aed);
        var staged = assets.stageCatalogContent(workspaceId, "asset-flow", dataNodeId.toString(), "STORE", "image/png", firstPng.length, new ByteArrayInputStream(firstPng), "catalog-scope-stage-0001", grant(workspaceId, "asset-flow", dataNodeId));

        assertThrows(PlatformAssetService.AssetClaimRejectedException.class, () -> assets.claimCatalogStaged(staged.assetRef(), secondWorkspaceId, "asset-flow-b", secondDataNodeId.toString(), "STORE", staged.bindGrant(), grant(secondWorkspaceId, "asset-flow-b", secondDataNodeId)));
        assertThrows(PlatformAssetService.AssetClaimRejectedException.class, () -> assets.releaseCatalogStaged(staged.assetRef(), assets.require(staged.assetRef()).version(), "catalog-scope-release-b-0001", secondWorkspaceId, "asset-flow-b", secondDataNodeId.toString(), "STORE", grant(secondWorkspaceId, "asset-flow-b", secondDataNodeId)));
        assertEquals("STAGED", assets.require(staged.assetRef()).status());

        assertThrows(PlatformAssetService.AssetClaimRejectedException.class, () -> assets.claimCatalogStaged(staged.assetRef(), workspaceId, "asset-flow", dataNodeId.toString(), "STORE", "wrong-grant", grant(workspaceId, "asset-flow", dataNodeId)));
        var active = assets.claimCatalogStaged(staged.assetRef(), workspaceId, "asset-flow", dataNodeId.toString(), "STORE", staged.bindGrant(), grant(workspaceId, "asset-flow", dataNodeId));
        assertEquals(active, assets.claimCatalogStaged(staged.assetRef(), secondWorkspaceId, "asset-flow-b", secondDataNodeId.toString(), "STORE", null, grant(secondWorkspaceId, "asset-flow-b", secondDataNodeId)));

        byte[] secondPng = png(0xff0891b2);
        var ownedStage = assets.stageCatalogContent(workspaceId, "asset-flow", dataNodeId.toString(), "STORE", "image/png", secondPng.length, new ByteArrayInputStream(secondPng), "catalog-scope-stage-0002", grant(workspaceId, "asset-flow", dataNodeId));
        var released = assets.releaseCatalogStaged(ownedStage.assetRef(), assets.require(ownedStage.assetRef()).version(), "catalog-scope-release-a-0002", workspaceId, "asset-flow", dataNodeId.toString(), "STORE", grant(workspaceId, "asset-flow", dataNodeId));
        assertEquals("RELEASED", released.status());
    }

    @Test void workspaceStagedReleaseDoesNotAcceptAnActiveCatalogAsset() {
        byte[] png = png(0xff0ea5e9);
        var staged = assets.stageCatalogContent(workspaceId, "asset-flow", dataNodeId.toString(), "STORE", "image/png", png.length,
            new ByteArrayInputStream(png), "catalog-staged-release-boundary-0001", grant(workspaceId, "asset-flow", dataNodeId));
        var released = assets.releaseCatalogStaged(staged.assetRef(), assets.require(staged.assetRef()).version(), "catalog-staged-release-boundary-0002",
            workspaceId, "asset-flow", dataNodeId.toString(), "STORE", grant(workspaceId, "asset-flow", dataNodeId));
        assertEquals("RELEASED", released.status());

        var activeStage = assets.stageCatalogContent(workspaceId, "asset-flow", dataNodeId.toString(), "STORE", "image/png", png.length,
            new ByteArrayInputStream(png), "catalog-staged-release-boundary-0003", grant(workspaceId, "asset-flow", dataNodeId));
        var active = assets.claimCatalogStaged(activeStage.assetRef(), workspaceId, "asset-flow", dataNodeId.toString(), "STORE", activeStage.bindGrant(), grant(workspaceId, "asset-flow", dataNodeId));
        assertThrows(PlatformAssetService.AssetClaimRejectedException.class,
            () -> assets.releaseCatalogStaged(active.assetRef(), active.version(), "catalog-staged-release-boundary-0004",
                workspaceId, "asset-flow", dataNodeId.toString(), "STORE", grant(workspaceId, "asset-flow", dataNodeId)));
    }

    @Test void catalogCommandsRejectWrongServerResolvedScopeBeforeAssetReceiptAccess() {
        byte[] png = png(0xff047857);
        assertThrows(PlatformAssetService.AssetOwnerScopeForbiddenException.class,
            () -> assets.stageCatalogContent(workspaceId, "asset-flow", dataNodeId.toString(), "STORE", "image/png", png.length,
                new ByteArrayInputStream(png), "catalog-owner-scope-denied-0001", grant(secondWorkspaceId, "asset-flow-b", secondDataNodeId)));
    }

    @Test void catalogLifecycleCommandsRejectScopeMatchingInventoryCapabilityBeforeReceiptAccess() {
        byte[] png = png(0xff0f766e);
        OperationsOwnerScopeGrant inventoryGrant = grant(workspaceId, "asset-flow", dataNodeId, "EDIT_STORE_INVENTORY");

        assertThrows(PlatformAssetService.AssetOwnerScopeForbiddenException.class,
            () -> assets.stageCatalogContent(workspaceId, "asset-flow", dataNodeId.toString(), "STORE", "image/png", png.length,
                new ByteArrayInputStream(png), "catalog-owner-capability-denied-stage-0001", inventoryGrant));

        var staged = assets.stageCatalogContent(workspaceId, "asset-flow", dataNodeId.toString(), "STORE", "image/png", png.length,
            new ByteArrayInputStream(png), "catalog-owner-capability-valid-stage-0001", grant(workspaceId, "asset-flow", dataNodeId));
        assertThrows(PlatformAssetService.AssetOwnerScopeForbiddenException.class,
            () -> assets.claimCatalogStaged(staged.assetRef(), workspaceId, "asset-flow", dataNodeId.toString(), "STORE", staged.bindGrant(), inventoryGrant));
        assertThrows(PlatformAssetService.AssetOwnerScopeForbiddenException.class,
            () -> assets.releaseCatalogStaged(staged.assetRef(), assets.require(staged.assetRef()).version(), "catalog-owner-capability-denied-release-0001",
                workspaceId, "asset-flow", dataNodeId.toString(), "STORE", inventoryGrant));

        var active = assets.claimCatalogStaged(staged.assetRef(), workspaceId, "asset-flow", dataNodeId.toString(), "STORE", staged.bindGrant(), grant(workspaceId, "asset-flow", dataNodeId));
        assertThrows(PlatformAssetService.AssetOwnerScopeForbiddenException.class,
            () -> assets.releaseUnreferencedCatalogAsset(active.assetRef(), active.version(), "catalog-owner-capability-denied-global-release-0001",
                workspaceId, "asset-flow", dataNodeId.toString(), "STORE", inventoryGrant));
    }

    @Test void receiptScopeSeparatesCatalogStageAndStagedReleaseButKeepsActiveReleaseGlobal() {
        String sharedStageKey = "catalog-scope-stage-key-0001";
        var firstStage = assets.stageCatalogContent(workspaceId, "asset-flow", dataNodeId.toString(), "STORE", "image/png", png(0xff1d4ed8).length,
            new ByteArrayInputStream(png(0xff1d4ed8)), sharedStageKey, grant(workspaceId, "asset-flow", dataNodeId));
        var secondStage = assets.stageCatalogContent(secondWorkspaceId, "asset-flow-b", secondDataNodeId.toString(), "STORE", "image/png", png(0xff7e22ce).length,
            new ByteArrayInputStream(png(0xff7e22ce)), sharedStageKey, grant(secondWorkspaceId, "asset-flow-b", secondDataNodeId));
        assertTrue(!firstStage.assetRef().equals(secondStage.assetRef()));
        assertEquals(firstStage.assetRef(), assets.stageCatalogContent(workspaceId, "asset-flow", dataNodeId.toString(), "STORE", "image/png", png(0xff1d4ed8).length,
            new ByteArrayInputStream(png(0xff1d4ed8)), sharedStageKey, grant(workspaceId, "asset-flow", dataNodeId)).assetRef());
        assertEquals(secondStage.assetRef(), assets.stageCatalogContent(secondWorkspaceId, "asset-flow-b", secondDataNodeId.toString(), "STORE", "image/png", png(0xff7e22ce).length,
            new ByteArrayInputStream(png(0xff7e22ce)), sharedStageKey, grant(secondWorkspaceId, "asset-flow-b", secondDataNodeId)).assetRef());
        assertEquals(2, jdbc.queryForObject("SELECT count(*) FROM platform_asset.asset_command_receipt WHERE idempotency_key=?", Integer.class, sharedStageKey));
        assertThrows(PlatformAssetService.AssetIdempotencyConflictException.class, () -> assets.stageCatalogContent(workspaceId, "asset-flow", dataNodeId.toString(), "STORE", "image/png", png(0xffea580c).length,
            new ByteArrayInputStream(png(0xffea580c)), sharedStageKey, grant(workspaceId, "asset-flow", dataNodeId)));

        String sharedStagedReleaseKey = "catalog-scope-release-key-0001";
        long firstStageVersion = assets.require(firstStage.assetRef()).version();
        long secondStageVersion = assets.require(secondStage.assetRef()).version();
        var firstReleasedStage = assets.releaseCatalogStaged(firstStage.assetRef(), firstStageVersion, sharedStagedReleaseKey,
            workspaceId, "asset-flow", dataNodeId.toString(), "STORE", grant(workspaceId, "asset-flow", dataNodeId));
        var secondReleasedStage = assets.releaseCatalogStaged(secondStage.assetRef(), secondStageVersion, sharedStagedReleaseKey,
            secondWorkspaceId, "asset-flow-b", secondDataNodeId.toString(), "STORE", grant(secondWorkspaceId, "asset-flow-b", secondDataNodeId));
        assertEquals(firstReleasedStage, assets.releaseCatalogStaged(firstStage.assetRef(), firstStageVersion, sharedStagedReleaseKey,
            workspaceId, "asset-flow", dataNodeId.toString(), "STORE", grant(workspaceId, "asset-flow", dataNodeId)));
        assertEquals(secondReleasedStage, assets.releaseCatalogStaged(secondStage.assetRef(), secondStageVersion, sharedStagedReleaseKey,
            secondWorkspaceId, "asset-flow-b", secondDataNodeId.toString(), "STORE", grant(secondWorkspaceId, "asset-flow-b", secondDataNodeId)));

        var activeStage = assets.stageCatalogContent(workspaceId, "asset-flow", dataNodeId.toString(), "STORE", "image/png", png(0xff0f766e).length,
            new ByteArrayInputStream(png(0xff0f766e)), "catalog-global-release-stage-0001", grant(workspaceId, "asset-flow", dataNodeId));
        var active = assets.claimCatalogStaged(activeStage.assetRef(), workspaceId, "asset-flow", dataNodeId.toString(), "STORE", activeStage.bindGrant(), grant(workspaceId, "asset-flow", dataNodeId));
        String globalReleaseKey = "catalog-global-release-key-0001";
        var released = assets.releaseUnreferencedCatalogAsset(active.assetRef(), active.version(), globalReleaseKey,
            workspaceId, "asset-flow", dataNodeId.toString(), "STORE", grant(workspaceId, "asset-flow", dataNodeId));
        assertEquals("global", jdbc.queryForObject("SELECT scope_key FROM platform_asset.asset_command_receipt WHERE idempotency_key=?", String.class, globalReleaseKey));
        jdbc.update("UPDATE platform_asset.asset_command_receipt SET scope_key='legacy' WHERE idempotency_key=?", globalReleaseKey);
        assertEquals(released, assets.releaseUnreferencedCatalogAsset(active.assetRef(), active.version(), globalReleaseKey,
            secondWorkspaceId, "asset-flow-b", secondDataNodeId.toString(), "STORE", grant(secondWorkspaceId, "asset-flow-b", secondDataNodeId)));
    }

    @AfterAll static void cleanup() { if (flyway != null) flyway.clean(); }

    private static OperationsOwnerScopeGrant grant(UUID workspaceUuid, String groupWorkspaceKey, UUID targetId) {
        return grant(workspaceUuid, groupWorkspaceKey, targetId, "EDIT_STORE_CATALOG");
    }

    private static void insertStagedAsset(UUID assetRef, String usage, String objectKey) {
        jdbc.update("INSERT INTO platform_asset.staged_asset (asset_ref, usage, storage_key, bucket_name, object_key, content_type, size_bytes, sha256, status, created_at_epoch_millis, version) VALUES (?, ?, ?, 'r5-assets', ?, 'image/png', 1, ?, 'STAGED', 1785000000000, 1)",
            assetRef, usage, objectKey, objectKey, "a".repeat(64));
    }

    private static OperationsOwnerScopeGrant grant(UUID workspaceUuid, String groupWorkspaceKey, UUID targetId, String capabilityKey) {
        return new OperationsOwnerScopeGrant(workspaceUuid, groupWorkspaceKey, "CATALOG_INVENTORY_OWNER_TEST", capabilityKey, "STORE", targetId, "STORE", targetId, java.util.List.of(targetId));
    }

    private static byte[] png(int argb) {
        try {
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            BufferedImage image = new BufferedImage(1, 1, BufferedImage.TYPE_INT_ARGB);
            image.setRGB(0, 0, argb);
            if (!javax.imageio.ImageIO.write(image, "png", output)) throw new IllegalStateException("PNG_WRITER_UNAVAILABLE");
            return output.toByteArray();
        } catch (java.io.IOException failure) { throw new IllegalStateException(failure); }
    }

    private static final class MemoryObjects implements AssetObjectStorage {
        private final Map<String, byte[]> objects = new HashMap<>();
        private boolean failStat;
        @Override public String bucketName() { return "r5-assets"; }
        @Override public String objectKey(String suffix) { return "tenant-prod/" + suffix; }
        @Override public boolean ownsObjectKey(String key) { return key != null && key.matches("tenant-prod/static/[a-f0-9]{64}(?:\\.[a-z0-9]{2,5})?"); }
        @Override public void put(String key, String contentType, long size, InputStream bytes) { try { objects.put(key, bytes.readAllBytes()); } catch (java.io.IOException failure) { throw new IllegalStateException(failure); } }
        @Override public boolean exists(String key) {
            if (failStat) throw new AssetObjectStorageUnavailableException("object.stat", new IllegalStateException("storage unavailable"));
            return objects.containsKey(key);
        }
        @Override public String publicUrl(String key) { return "https://assets.test/r5-assets/" + key; }
        @Override public void delete(String key) { objects.remove(key); }
        int size() { return objects.size(); }
    }
}
