package com.catering.v2s.catalog.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.catering.v2s.platform.asset.application.AssetObjectStorage;
import com.catering.v2s.platform.asset.application.PlatformAssetService;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.InputStream;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** Real PostgreSQL counterexample: a shared assetRef remains protected until every catalog scope drops it. */
@Testcontainers
class CatalogAssetGlobalReferenceTest {
    @Container static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");
    private static Flyway flyway;
    private static DriverManagerDataSource dataSource;
    private static JdbcTemplate jdbc;
    private static CatalogOwnerService catalog;
    private static PlatformAssetService assets;
    private static final String SHARED_ASSET = UUID.randomUUID().toString();

    @BeforeAll static void setup() {
        flyway = Flyway.configure().dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
            .locations("filesystem:../../src/main/resources/db/migration").schemas("public").defaultSchema("public").cleanDisabled(false).load();
        flyway.migrate();
        dataSource = new DriverManagerDataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
        jdbc = new JdbcTemplate(dataSource);
        TimeProvider time = () -> 1_785_000_000_000L;
        assets = new PlatformAssetService(jdbc, time, new NoopObjects());
        catalog = new CatalogOwnerService(jdbc, new ObjectMapper(), time, assets);
        insertItem("scope-a", "A", "{\"images\":[]}");
        insertItem("scope-b", "B", "{\"images\":[{\"assetRef\":\"" + SHARED_ASSET + "\"}],\"skus\":[{\"mediaRefs\":[\"" + SHARED_ASSET + "\"]}]}");
    }

    @Test void sharedAssetRemainsReferencedWhenCurrentScopeHasRemovedIt() {
        assertFalse(catalog.assetReferenced("scope-a", "brand-1", SHARED_ASSET));
        assertTrue(catalog.assetReferencedAnywhere(SHARED_ASSET));
    }

    @BeforeEach void restoreSharedReference() {
        jdbc.update("UPDATE catalog.catalog_item SET sections=CAST(? AS JSONB) WHERE data_node_ref='scope-b' AND brand_ref='brand-1'", "{\"images\":[{\"assetRef\":\"" + SHARED_ASSET + "\"}],\"skus\":[{\"mediaRefs\":[\"" + SHARED_ASSET + "\"]}]}");
    }

    @Test void globalReferenceJudgmentTurnsFalseOnlyAfterLastScopeDropsSharedRef() {
        jdbc.update("UPDATE catalog.catalog_item SET sections=CAST(? AS JSONB) WHERE data_node_ref='scope-b' AND brand_ref='brand-1'", "{\"images\":[]}");
        assertFalse(catalog.assetReferencedAnywhere(SHARED_ASSET));
    }

    @Test void batchGlobalReferenceJudgmentKeepsCrossScopeSemantics() {
        String absent = UUID.randomUUID().toString();
        assertEquals(java.util.Set.of(SHARED_ASSET), catalog.assetRefsStillReferenced(java.util.Set.of(SHARED_ASSET, absent)));
    }

    @Test void releaseAndCrossScopeReuseSerializeOnTheSameAssetRef() throws Exception {
        UUID assetRef = UUID.randomUUID();
        String suffix = assetRef.toString().substring(0, 8);
        String removerCode = "TOCTOU-REMOVE-" + suffix;
        String reuserCode = "TOCTOU-REUSE-" + suffix;
        UUID workspaceId = UUID.randomUUID();
        String groupWorkspaceKey = "catalog-asset-linearization";
        String removerScope = UUID.randomUUID().toString();
        String reuserScope = UUID.randomUUID().toString();
        insertActiveAsset(assetRef);
        insertItem(removerScope, removerCode, refSections(assetRef));
        insertItem(reuserScope, reuserCode, "{\"images\":[]}");
        TransactionTemplate transactions = new TransactionTemplate(new DataSourceTransactionManager(dataSource));
        CountDownLatch globalCheckComplete = new CountDownLatch(1);
        CountDownLatch allowRelease = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            var remover = executor.submit(() -> transactions.executeWithoutResult(status -> {
                assets.lockCatalogReferences(List.of(assetRef));
                jdbc.update("UPDATE catalog.catalog_item SET sections=CAST('{\"images\":[]}' AS JSONB) WHERE data_node_ref=? AND brand_ref='brand-1' AND code=?", removerScope, removerCode);
                assertFalse(catalog.assetReferencedAnywhere(assetRef.toString()));
                globalCheckComplete.countDown();
                await(allowRelease);
                PlatformAssetService.AssetReadback current = assets.require(assetRef);
                assets.releaseUnreferencedCatalogAsset(assetRef, current.version(), "catalog-asset-linearization-release-" + assetRef,
                    workspaceId, groupWorkspaceKey, removerScope, "STORE", grant(workspaceId, groupWorkspaceKey, UUID.fromString(removerScope)));
            }));
            assertTrue(globalCheckComplete.await(3, TimeUnit.SECONDS));
            var reuser = executor.submit(() -> transactions.executeWithoutResult(status -> {
                catalog.write("saveOperationsCatalogItem", reuserScope, "brand-1", saveRequest(reuserCode, assetRef), "request-reuse", null,
                    workspaceId, groupWorkspaceKey, "STORE", grant(workspaceId, groupWorkspaceKey, UUID.fromString(reuserScope)));
                UUID otherWorkspace = UUID.randomUUID();
                UUID otherScope = UUID.randomUUID();
                assets.claimCatalogStaged(assetRef, otherWorkspace, "other-workspace", otherScope.toString(), "STORE", null,
                    grant(otherWorkspace, "other-workspace", otherScope));
            }));
            assertFalse(reuser.isDone());
            allowRelease.countDown();
            remover.get(3, TimeUnit.SECONDS);
            ExecutionException rejected = assertThrows(ExecutionException.class, () -> reuser.get(3, TimeUnit.SECONDS));
            assertTrue(hasCause(rejected, PlatformAssetService.AssetClaimRejectedException.class), () -> "unexpected concurrent reuser failure chain: " + causeChain(rejected));
            assertFalse(catalog.assetReferencedAnywhere(assetRef.toString()));
            assertEquals("RELEASED", assets.require(assetRef).status());
        } finally {
            allowRelease.countDown();
            executor.shutdownNow();
        }
    }

    @AfterAll static void cleanup() { if (flyway != null) flyway.clean(); }

    private static void insertItem(String scope, String code, String sections) {
        jdbc.update("INSERT INTO catalog.catalog_item (item_ref,data_node_ref,brand_ref,code,name,shape_key,status,attributes,sections,version,created_at_epoch_millis,updated_at_epoch_millis) VALUES (?,?, 'brand-1', ?, ?, 'STANDARD_SALE_COUNTED', 'DRAFT', CAST('{}' AS JSONB), CAST(? AS JSONB), 1, 1, 1)", UUID.randomUUID(), scope, code, code, sections);
    }

    private static void insertActiveAsset(UUID assetRef) {
        jdbc.update("INSERT INTO platform_asset.staged_asset (asset_ref,usage,storage_key,bucket_name,object_key,content_type,size_bytes,sha256,status,claimed_by_type,claimed_by_id,created_at_epoch_millis,activated_at_epoch_millis,version) VALUES (?, 'CATALOG_ITEM_IMAGE', ?, 'test-assets', ?, 'image/png', 1, ?, 'ACTIVE', 'CATALOG_ITEM_IMAGE', ?, 1, 1, 1)", assetRef, "storage-" + assetRef, "object-" + assetRef, "a".repeat(64), assetRef);
    }

    private static String refSections(UUID assetRef) {
        return "{\"images\":[{\"assetRef\":\"" + assetRef + "\"}]}";
    }

    private static com.fasterxml.jackson.databind.node.ObjectNode saveRequest(String itemCode, UUID assetRef) {
        ObjectNode request = new ObjectMapper().createObjectNode().put("itemCode", itemCode);
        request.putObject("sections").put("expectedCatalogVersion", 1L).putObject("catalogDraft").putArray("images").addObject().put("assetRef", assetRef.toString());
        return request;
    }

    private static OperationsOwnerScopeGrant grant(UUID workspaceUuid, String groupWorkspaceKey, UUID targetId) {
        return new OperationsOwnerScopeGrant(workspaceUuid, groupWorkspaceKey, "CATALOG_ASSET_OWNER_TEST", "EDIT_STORE_CATALOG", "STORE", targetId, "STORE", targetId, List.of(targetId));
    }

    private static void await(CountDownLatch latch) {
        try {
            if (!latch.await(3, TimeUnit.SECONDS)) throw new AssertionError("concurrent test did not reach its linearization barrier");
        } catch (InterruptedException failure) {
            Thread.currentThread().interrupt();
            throw new AssertionError(failure);
        }
    }

    private static boolean hasCause(Throwable failure, Class<? extends Throwable> expected) {
        for (Throwable current = failure; current != null && current.getCause() != current; current = current.getCause()) {
            if (expected.isInstance(current)) return true;
        }
        return false;
    }

    private static String causeChain(Throwable failure) {
        StringBuilder chain = new StringBuilder();
        for (Throwable current = failure; current != null && current.getCause() != current; current = current.getCause()) {
            if (!chain.isEmpty()) chain.append(" -> ");
            chain.append(current.getClass().getSimpleName());
        }
        return chain.toString();
    }

    private static final class NoopObjects implements AssetObjectStorage {
        @Override public String bucketName() { return "test-assets"; }
        @Override public String objectKey(String suffix) { return suffix; }
        @Override public boolean ownsObjectKey(String key) { return true; }
        @Override public void put(String key, String contentType, long size, InputStream bytes) { }
        @Override public boolean exists(String key) { return true; }
        @Override public String publicUrl(String key) { return "https://assets.test/" + key; }
        @Override public void delete(String key) { }
    }
}
