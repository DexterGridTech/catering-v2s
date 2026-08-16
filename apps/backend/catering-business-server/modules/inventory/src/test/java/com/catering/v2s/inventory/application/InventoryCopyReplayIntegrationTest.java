package com.catering.v2s.inventory.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.catering.v2s.inventory.api.InventoryOwnerApi;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.platform.foundation.persistence.CountingDataSource;
import com.catering.v2s.platform.foundation.persistence.DatabaseOperationTracker;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
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

/** RF-13: a target-side revision change must reject a coordinated-copy replay. */
@Testcontainers
class InventoryCopyReplayIntegrationTest {
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final UUID WORKSPACE = UUID.randomUUID();
    private static final UUID SOURCE_SCOPE = UUID.randomUUID();
    private static final UUID TARGET_SCOPE = UUID.randomUUID();
    private static final UUID SOURCE_ITEM = UUID.randomUUID();
    private static final UUID TARGET_ITEM = UUID.randomUUID();
    private static final UUID SOURCE_SKU = UUID.randomUUID();
    private static final UUID TARGET_SKU = UUID.randomUUID();
    private static final UUID TARGET_ROW = UUID.randomUUID();

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    private static JdbcTemplate jdbc;
    private static InventoryOwnerService service;

    @BeforeAll
    static void setup() {
        Flyway.configure()
                .dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
                .locations("filesystem:../../src/main/resources/db/migration")
                .schemas("public")
                .defaultSchema("public")
                .load()
                .migrate();
        jdbc = new JdbcTemplate(new CountingDataSource(
                new DriverManagerDataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())));
        service = new InventoryOwnerService(jdbc, MAPPER, (TimeProvider) () -> 1_785_000_000_000L);
        insertTarget(UUID.randomUUID(), SOURCE_SCOPE, SOURCE_ITEM, SOURCE_SKU, "ITEM-SOURCE", "SKU-SOURCE");
        insertTarget(TARGET_ROW, TARGET_SCOPE, TARGET_ITEM, TARGET_SKU, "ITEM-TARGET", "SKU-TARGET");
    }

    @AfterAll
    static void cleanup() {
        Flyway.configure()
                .dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
                .cleanDisabled(false)
                .load()
                .clean();
    }

    @Test
    void replayRejectsTargetRevisionChangedAfterFirstCopy() {
        ObjectNode request = request();
        JsonNode preflight = service.preflightCopy(
                SOURCE_SCOPE.toString(),
                TARGET_SCOPE.toString(),
                "BRAND",
                request,
                WORKSPACE,
                "inventory-copy-replay",
                "STORE",
                grant());
        request.put("inventoryPreflightDigest", preflight.path("digest").asText());
        mergePreflightReferenceMappings(request, preflight);
        service.copy(
                SOURCE_SCOPE.toString(),
                TARGET_SCOPE.toString(),
                "BRAND",
                request,
                "copy-first",
                "copy-receipt",
                WORKSPACE,
                "inventory-copy-replay",
                "STORE",
                grant());
        jdbc.update("UPDATE inventory.stock_target SET version=version+1 WHERE target_ref=?", TARGET_ROW);

        InventoryOwnerApi.Problem failure = assertThrows(
                InventoryOwnerApi.Problem.class,
                () -> service.copy(
                        SOURCE_SCOPE.toString(),
                        TARGET_SCOPE.toString(),
                        "BRAND",
                        request,
                        "copy-replay",
                        "copy-receipt",
                        WORKSPACE,
                        "inventory-copy-replay",
                        "STORE",
                        grant()));
        assertEquals("STALE_COPY_PREFLIGHT", failure.code());
    }

    @Test
    void allTargetConflictsAreNotReportedAsCommittedCopy() {
        ObjectNode request = request();
        JsonNode preflight = service.preflightCopy(
                SOURCE_SCOPE.toString(),
                TARGET_SCOPE.toString(),
                "BRAND",
                request,
                WORKSPACE,
                "inventory-copy-replay",
                "STORE",
                grant());
        request.put("inventoryPreflightDigest", preflight.path("digest").asText());
        mergePreflightReferenceMappings(request, preflight);

        JsonNode readback = service.copy(
                SOURCE_SCOPE.toString(),
                TARGET_SCOPE.toString(),
                "BRAND",
                request,
                "copy-all-conflicts",
                "copy-all-conflicts-receipt",
                WORKSPACE,
                "inventory-copy-replay",
                "STORE",
                grant());

        assertEquals("CONFLICT", readback.path("status").asText());
        assertEquals(0, readback.path("version").asInt());
    }

    @Test
    void bomUpsertIsCommittedWhenEveryTargetAlreadyExists() {
        UUID sourceScope = UUID.randomUUID();
        UUID targetScope = UUID.randomUUID();
        UUID sourceItem = UUID.randomUUID();
        UUID sourceSku = UUID.randomUUID();
        UUID targetItem = UUID.randomUUID();
        UUID targetSku = UUID.randomUUID();
        UUID sourceTargetRef = UUID.randomUUID();
        UUID targetTargetRef = UUID.randomUUID();
        insertTarget(sourceTargetRef, sourceScope, sourceItem, sourceSku, "ITEM-SOURCE-BOM", "SKU-SOURCE-BOM");
        insertTarget(targetTargetRef, targetScope, targetItem, targetSku, "ITEM-TARGET-BOM", "SKU-TARGET-BOM");
        insertBom(sourceScope, sourceItem, sourceSku, "ITEM-SOURCE-BOM", "SKU-SOURCE-BOM", sourceTargetRef);

        ObjectNode request =
                copyRequest(sourceItem, sourceSku, targetItem, targetSku, "ITEM-TARGET-BOM", "SKU-TARGET-BOM");
        JsonNode preflight = service.preflightCopy(
                sourceScope.toString(),
                targetScope.toString(),
                "BRAND",
                request,
                WORKSPACE,
                "inventory-copy-replay",
                "STORE",
                grant(targetScope));
        request.put("inventoryPreflightDigest", preflight.path("digest").asText());
        mergePreflightReferenceMappings(request, preflight);

        JsonNode readback = service.copy(
                sourceScope.toString(),
                targetScope.toString(),
                "BRAND",
                request,
                "copy-bom-upsert",
                "copy-bom-upsert-receipt",
                WORKSPACE,
                "inventory-copy-replay",
                "STORE",
                grant(targetScope));

        assertEquals("COMMITTED", readback.path("status").asText());
        assertEquals(1, readback.path("version").asInt());
        assertEquals(
                1,
                jdbc.queryForObject(
                        "SELECT count(*) FROM inventory.stock_bom WHERE data_node_ref=? AND brand_ref=? AND item_ref=? "
                                + "AND product_sku_ref=?",
                        Integer.class,
                        targetScope.toString(),
                        "BRAND",
                        targetItem,
                        targetSku));
        assertEquals(
                targetTargetRef.toString(),
                jdbc.queryForObject(
                        "SELECT rows->0->>'targetRef' FROM inventory.stock_bom WHERE data_node_ref=? AND brand_ref=? "
                                + "AND item_ref=? AND product_sku_ref=?",
                        String.class,
                        targetScope.toString(),
                        "BRAND",
                        targetItem,
                        targetSku));
    }

    @Test
    void localCopyTransfersOnlyTheSelectedBomClassAndMakesAnAbsentClassExplicit() {
        UUID sourceScope = UUID.randomUUID();
        UUID targetScope = UUID.randomUUID();
        UUID sourceItem = UUID.randomUUID();
        UUID targetItem = UUID.randomUUID();
        UUID sourceSku = UUID.randomUUID();
        UUID targetSku = UUID.randomUUID();
        UUID sourceOption = UUID.randomUUID();
        UUID targetOption = UUID.randomUUID();
        insertBomOwner(sourceScope, sourceItem, sourceSku, null, "LOCAL-SOURCE", "LOCAL-SKU", null);
        insertBomOwner(sourceScope, sourceItem, null, sourceOption, "LOCAL-SOURCE", null, "LOCAL-OPTION");
        insertBomOwner(sourceScope, sourceItem, null, null, "LOCAL-SOURCE", null, null);

        ObjectNode skuOnly = localCopyRequest(sourceItem, targetItem, sourceSku, targetSku, sourceOption, targetOption);
        skuOnly.putArray("selectedSections").add("SKU_BOM");
        JsonNode skuPreflight = service.preflightCopy(
                sourceScope.toString(),
                targetScope.toString(),
                "BRAND",
                skuOnly,
                WORKSPACE,
                "inventory-copy-replay",
                "STORE",
                grant(targetScope));
        assertTrue(skuPreflight.path("skipped").isEmpty());
        skuOnly.put("inventoryPreflightDigest", skuPreflight.path("digest").asText());
        mergePreflightReferenceMappings(skuOnly, skuPreflight);
        JsonNode copied = service.copy(
                sourceScope.toString(),
                targetScope.toString(),
                "BRAND",
                skuOnly,
                "local-sku-only",
                "local-sku-only-receipt",
                WORKSPACE,
                "inventory-copy-replay",
                "STORE",
                grant(targetScope));
        assertEquals("COMMITTED", copied.path("status").asText());
        assertEquals(
                1,
                jdbc.queryForObject(
                        "SELECT count(*) FROM inventory.stock_bom WHERE data_node_ref=? AND brand_ref=? AND item_ref=? "
                                + "AND product_sku_ref=?",
                        Integer.class,
                        targetScope.toString(),
                        "BRAND",
                        targetItem,
                        targetSku));
        assertEquals(
                0,
                jdbc.queryForObject(
                        "SELECT count(*) FROM inventory.stock_bom WHERE data_node_ref=? AND brand_ref=? AND item_ref=? "
                                + "AND option_value_ref=?",
                        Integer.class,
                        targetScope.toString(),
                        "BRAND",
                        targetItem,
                        targetOption));
        assertEquals(
                0,
                jdbc.queryForObject(
                        "SELECT count(*) FROM inventory.stock_bom WHERE data_node_ref=? AND brand_ref=? AND item_ref=? "
                                + "AND product_sku_ref IS NULL AND option_value_ref IS NULL",
                        Integer.class,
                        targetScope.toString(),
                        "BRAND",
                        targetItem));

        ObjectNode absent = localCopyRequest(sourceItem, targetItem, sourceSku, targetSku, sourceOption, targetOption);
        absent.putArray("selectedSections").add("ITEM_BOM").add("OPTION_VALUE_BOM");
        jdbc.update(
                "DELETE FROM inventory.stock_bom WHERE data_node_ref=? AND brand_ref=? AND item_ref=? AND "
                        + "product_sku_ref IS NULL",
                sourceScope.toString(),
                "BRAND",
                sourceItem);
        JsonNode absentPreflight = service.preflightCopy(
                sourceScope.toString(),
                targetScope.toString(),
                "BRAND",
                absent,
                WORKSPACE,
                "inventory-copy-replay",
                "STORE",
                grant(targetScope));
        assertEquals(2, absentPreflight.path("skipped").size());
        absent.put("inventoryPreflightDigest", absentPreflight.path("digest").asText());
        mergePreflightReferenceMappings(absent, absentPreflight);
        JsonNode absentExecution = service.copy(
                sourceScope.toString(),
                targetScope.toString(),
                "BRAND",
                absent,
                "local-absent",
                "local-absent-receipt",
                WORKSPACE,
                "inventory-copy-replay",
                "STORE",
                grant(targetScope));
        assertEquals("SKIPPED", absentExecution.path("status").asText());
        assertEquals(absentPreflight.path("skipped"), absentExecution.path("skipped"));
    }

    @Test
    void sameIdempotencyKeyOnOneDataNodeDoesNotReplayAnotherBrandCopyReadback() {
        ObjectNode request = request();
        String receiptKey = "inventory-brand-receipt-key-0001";
        JsonNode preflight = service.preflightCopy(
                SOURCE_SCOPE.toString(),
                TARGET_SCOPE.toString(),
                "BRAND",
                request,
                WORKSPACE,
                "inventory-copy-replay",
                "STORE",
                grant());
        request.put("inventoryPreflightDigest", preflight.path("digest").asText());
        mergePreflightReferenceMappings(request, preflight);

        JsonNode brandA = service.copy(
                SOURCE_SCOPE.toString(),
                TARGET_SCOPE.toString(),
                "BRAND",
                request,
                "inventory-brand-a",
                receiptKey,
                WORKSPACE,
                "inventory-copy-replay",
                "STORE",
                grant());
        assertEquals("CONFLICT", brandA.path("status").asText());

        insertTarget(
                UUID.randomUUID(),
                SOURCE_SCOPE,
                SOURCE_ITEM,
                SOURCE_SKU,
                "ITEM-SOURCE",
                "SKU-SOURCE",
                "BRAND-RECEIPT-B");
        InventoryOwnerApi.Problem brandB = assertThrows(
                InventoryOwnerApi.Problem.class,
                () -> service.copy(
                        SOURCE_SCOPE.toString(),
                        TARGET_SCOPE.toString(),
                        "BRAND-RECEIPT-B",
                        request.deepCopy(),
                        "inventory-brand-b",
                        receiptKey,
                        WORKSPACE,
                        "inventory-copy-replay",
                        "STORE",
                        grant()));

        assertEquals("IDEMPOTENCY_MISMATCH", brandB.code());
        assertEquals(
                0,
                jdbc.queryForObject(
                        "SELECT count(*) FROM inventory.stock_target WHERE data_node_ref=? AND brand_ref=? AND "
                                + "item_ref=? AND product_sku_ref=?",
                        Integer.class,
                        TARGET_SCOPE.toString(),
                        "BRAND-RECEIPT-B",
                        TARGET_ITEM,
                        TARGET_SKU));
    }

    @Test
    void copyRecordsTheActualJdbcBatchAndOwnerCommandPhases() {
        UUID batchSourceItem = UUID.randomUUID();
        UUID batchSourceSku = UUID.randomUUID();
        UUID batchTargetItem = UUID.randomUUID();
        UUID batchTargetSku = UUID.randomUUID();
        insertTarget(
                UUID.randomUUID(),
                SOURCE_SCOPE,
                batchSourceItem,
                batchSourceSku,
                "ITEM-SOURCE-BATCH",
                "SKU-SOURCE-BATCH");
        ObjectNode request = batchRequest(batchSourceItem, batchSourceSku, batchTargetItem, batchTargetSku);
        JsonNode preflight = service.preflightCopy(
                SOURCE_SCOPE.toString(),
                TARGET_SCOPE.toString(),
                "BRAND",
                request,
                WORKSPACE,
                "inventory-copy-replay",
                "STORE",
                grant());
        request.put("inventoryPreflightDigest", preflight.path("digest").asText());
        mergePreflightReferenceMappings(request, preflight);
        DatabaseOperationTracker.Snapshot snapshot;
        try (var measurement = DatabaseOperationTracker.open(new DatabaseOperationTracker.Options(
                "inventory-copy-metrics-key".getBytes(java.nio.charset.StandardCharsets.UTF_8), false, true))) {
            JsonNode readback = service.copy(
                    SOURCE_SCOPE.toString(),
                    TARGET_SCOPE.toString(),
                    "BRAND",
                    request,
                    "inventory-counted-copy",
                    "inventory-counted-copy-receipt",
                    WORKSPACE,
                    "inventory-copy-replay",
                    "STORE",
                    grant());
            assertEquals("COMMITTED", readback.path("status").asText());
            snapshot = measurement.snapshot();
        }

        assertTrue(snapshot.count() > 0);
        assertEquals(
                1,
                snapshot.operations().stream()
                        .filter(operation -> "BATCH".equals(operation.kind())
                                && "EXECUTE_BATCH".equals(operation.action())
                                && operation.section() == DatabaseOperationTracker.Section.OWNER_WRITE
                                && operation.batchSize() == 2)
                        .count());
        assertTrue(snapshot.phaseCheckpoints().stream()
                .anyMatch(checkpoint -> checkpoint.phase() == DatabaseOperationTracker.Phase.OWNER_COMMAND_BEGIN));
        assertTrue(snapshot.phaseCheckpoints().stream()
                .anyMatch(checkpoint -> checkpoint.phase() == DatabaseOperationTracker.Phase.OWNER_COMMAND_END));
    }

    /**
     * The inventory preflight owns STOCK_TARGET identity allocation. Production coordinators merge these entries into
     * the execute plan; direct owner tests must model the same hand-off instead of weakening execute-time validation.
     */
    private static void mergePreflightReferenceMappings(ObjectNode request, JsonNode preflight) {
        ArrayNode mappings = request.withArray("referenceMappings");
        for (JsonNode generated : preflight.path("referenceMappings")) {
            String sourceRef = generated.path("sourceRef").asText();
            boolean alreadyPresent = false;
            for (JsonNode existing : mappings) {
                if (sourceRef.equals(existing.path("sourceRef").asText())) {
                    alreadyPresent = true;
                    break;
                }
            }
            if (!alreadyPresent) mappings.add(generated.deepCopy());
        }
    }

    private static ObjectNode request() {
        ObjectNode request = MAPPER.createObjectNode();
        request.putArray("closureItemRefs").add(SOURCE_ITEM.toString());
        ArrayNode mappings = request.putArray("referenceMappings");
        mappings.addObject()
                .put("objectType", "CATALOG_ITEM")
                .put("sourceRef", SOURCE_ITEM.toString())
                .put("targetRef", TARGET_ITEM.toString())
                .put("targetCode", "ITEM-TARGET");
        mappings.addObject()
                .put("objectType", "PRODUCT_SKU")
                .put("sourceRef", SOURCE_SKU.toString())
                .put("targetRef", TARGET_SKU.toString())
                .put("targetSkuCode", "SKU-TARGET");
        // Catalog composes one cross-owner plan; inventory validates the opaque refs but does not consume SKU
        // attributes.
        mappings.addObject()
                .put("objectType", "SKU_ATTRIBUTE")
                .put("sourceRef", UUID.randomUUID().toString())
                .put("targetRef", UUID.randomUUID().toString());
        return request;
    }

    private static ObjectNode batchRequest(UUID sourceItem, UUID sourceSku, UUID targetItem, UUID targetSku) {
        ObjectNode request = request();
        request.withArray("closureItemRefs").add(sourceItem.toString());
        ArrayNode mappings = request.withArray("referenceMappings");
        mappings.addObject()
                .put("objectType", "CATALOG_ITEM")
                .put("sourceRef", sourceItem.toString())
                .put("targetRef", targetItem.toString())
                .put("targetCode", "ITEM-TARGET-BATCH");
        mappings.addObject()
                .put("objectType", "PRODUCT_SKU")
                .put("sourceRef", sourceSku.toString())
                .put("targetRef", targetSku.toString())
                .put("targetSkuCode", "SKU-TARGET-BATCH");
        return request;
    }

    private static ObjectNode copyRequest(
            UUID sourceItem,
            UUID sourceSku,
            UUID targetItem,
            UUID targetSku,
            String targetItemCode,
            String targetSkuCode) {
        ObjectNode request = MAPPER.createObjectNode();
        request.putArray("closureItemRefs").add(sourceItem.toString());
        ArrayNode mappings = request.putArray("referenceMappings");
        mappings.addObject()
                .put("objectType", "CATALOG_ITEM")
                .put("sourceRef", sourceItem.toString())
                .put("targetRef", targetItem.toString())
                .put("targetCode", targetItemCode);
        mappings.addObject()
                .put("objectType", "PRODUCT_SKU")
                .put("sourceRef", sourceSku.toString())
                .put("targetRef", targetSku.toString())
                .put("targetSkuCode", targetSkuCode);
        return request;
    }

    private static ObjectNode localCopyRequest(
            UUID sourceItem, UUID targetItem, UUID sourceSku, UUID targetSku, UUID sourceOption, UUID targetOption) {
        ObjectNode request = MAPPER.createObjectNode();
        request.putArray("closureItemRefs").add(sourceItem.toString());
        ArrayNode mappings = request.putArray("referenceMappings");
        mappings.addObject()
                .put("objectType", "CATALOG_ITEM")
                .put("sourceRef", sourceItem.toString())
                .put("targetRef", targetItem.toString())
                .put("targetCode", "LOCAL-TARGET");
        mappings.addObject()
                .put("objectType", "PRODUCT_SKU")
                .put("sourceRef", sourceSku.toString())
                .put("targetRef", targetSku.toString())
                .put("targetSkuCode", "LOCAL-TARGET-SKU");
        mappings.addObject()
                .put("objectType", "SKU_ATTRIBUTE_VALUE")
                .put("sourceRef", sourceOption.toString())
                .put("targetRef", targetOption.toString())
                .put("targetOptionValueCode", "LOCAL-TARGET-OPTION");
        return request;
    }

    private static void insertTarget(UUID ref, UUID scope, UUID item, UUID sku, String itemCode, String skuCode) {
        insertTarget(ref, scope, item, sku, itemCode, skuCode, "BRAND");
    }

    private static void insertTarget(
            UUID ref, UUID scope, UUID item, UUID sku, String itemCode, String skuCode, String brand) {
        jdbc.update(
                "INSERT INTO "
                        + "inventory.stock_target(target_ref,data_node_ref,brand_ref,item_ref,product_sku_ref,item_code"
                        + ",sku"
                        + "_code,measure_mode,configuration,balance,version,created_at_epoch_millis,updated_at_epoch_mi"
                        + "llis"
                        + ") VALUES(?,?,?,?,?,?,?,'UNIT','{}'::jsonb,0,1,1,1)",
                ref,
                scope.toString(),
                brand,
                item,
                sku,
                itemCode,
                skuCode);
    }

    private static void insertBom(
            UUID scope, UUID item, UUID sku, String itemCode, String skuCode, UUID componentTargetRef) {
        jdbc.update(
                "INSERT INTO "
                        + "inventory.stock_bom(bom_ref,data_node_ref,brand_ref,item_ref,product_sku_ref,option_value_re"
                        + "f,it"
                        + "em_code,sku_code,option_value_code,version,rows,updated_at_epoch_millis) "
                        + "VALUES(?,?,?,?,?,NULL,?,?,NULL,1,CAST(? AS JSONB),1)",
                UUID.randomUUID(),
                scope.toString(),
                "BRAND",
                item,
                sku,
                itemCode,
                skuCode,
                "[{\"targetRef\":\"" + componentTargetRef + "\"}]");
    }

    private static void insertBomOwner(
            UUID scope, UUID item, UUID sku, UUID option, String itemCode, String skuCode, String optionCode) {
        jdbc.update(
                "INSERT INTO "
                        + "inventory.stock_bom(bom_ref,data_node_ref,brand_ref,item_ref,product_sku_ref,option_value_re"
                        + "f,it"
                        + "em_code,sku_code,option_value_code,version,rows,updated_at_epoch_millis) "
                        + "VALUES(?,?,?,?,?,?,?,?,?,1,'[]'::jsonb,1)",
                UUID.randomUUID(),
                scope.toString(),
                "BRAND",
                item,
                sku,
                option,
                itemCode,
                skuCode,
                optionCode);
    }

    private static OperationsOwnerScopeGrant grant() {
        return grant(TARGET_SCOPE);
    }

    private static OperationsOwnerScopeGrant grant(UUID targetScope) {
        return new OperationsOwnerScopeGrant(
                WORKSPACE,
                "inventory-copy-replay",
                "INVENTORY_COPY_TEST",
                "EDIT_STORE_CATALOG",
                "STORE",
                targetScope,
                "STORE",
                targetScope,
                List.of(targetScope));
    }
}
