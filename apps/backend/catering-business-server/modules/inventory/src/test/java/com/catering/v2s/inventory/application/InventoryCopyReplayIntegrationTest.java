package com.catering.v2s.inventory.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.catering.v2s.inventory.api.InventoryOwnerApi;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
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
    @Container static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");
    private static JdbcTemplate jdbc;
    private static InventoryOwnerService service;

    @BeforeAll static void setup() {
        Flyway.configure().dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
            .locations("filesystem:../../src/main/resources/db/migration").schemas("public").defaultSchema("public").load().migrate();
        jdbc = new JdbcTemplate(new DriverManagerDataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword()));
        service = new InventoryOwnerService(jdbc, MAPPER, (TimeProvider) () -> 1_785_000_000_000L);
        insertTarget(UUID.randomUUID(), SOURCE_SCOPE, SOURCE_ITEM, SOURCE_SKU, "ITEM-SOURCE", "SKU-SOURCE");
        insertTarget(TARGET_ROW, TARGET_SCOPE, TARGET_ITEM, TARGET_SKU, "ITEM-TARGET", "SKU-TARGET");
    }

    @AfterAll static void cleanup() {
        Flyway.configure().dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword()).cleanDisabled(false).load().clean();
    }

    @Test void replayRejectsTargetRevisionChangedAfterFirstCopy() {
        ObjectNode request = request();
        JsonNode preflight = service.preflightCopy(SOURCE_SCOPE.toString(), TARGET_SCOPE.toString(), "BRAND", request,
            WORKSPACE, "inventory-copy-replay", "STORE", grant());
        request.put("inventoryPreflightDigest", preflight.path("digest").asText());
        service.copy(SOURCE_SCOPE.toString(), TARGET_SCOPE.toString(), "BRAND", request, "copy-first", "copy-receipt",
            WORKSPACE, "inventory-copy-replay", "STORE", grant());
        jdbc.update("UPDATE inventory.stock_target SET version=version+1 WHERE target_ref=?", TARGET_ROW);

        InventoryOwnerApi.Problem failure = assertThrows(InventoryOwnerApi.Problem.class, () -> service.copy(
            SOURCE_SCOPE.toString(), TARGET_SCOPE.toString(), "BRAND", request, "copy-replay", "copy-receipt",
            WORKSPACE, "inventory-copy-replay", "STORE", grant()));
        assertEquals("STALE_COPY_PREFLIGHT", failure.code());
    }

    private static ObjectNode request() {
        ObjectNode request = MAPPER.createObjectNode();
        request.putArray("closureItemRefs").add(SOURCE_ITEM.toString());
        ArrayNode mappings = request.putArray("referenceMappings");
        mappings.addObject().put("objectType", "CATALOG_ITEM").put("sourceRef", SOURCE_ITEM.toString())
            .put("targetRef", TARGET_ITEM.toString()).put("targetCode", "ITEM-TARGET");
        mappings.addObject().put("objectType", "PRODUCT_SKU").put("sourceRef", SOURCE_SKU.toString())
            .put("targetRef", TARGET_SKU.toString()).put("targetSkuCode", "SKU-TARGET");
        // Catalog composes one cross-owner plan; inventory validates the opaque refs but does not consume SKU attributes.
        mappings.addObject().put("objectType", "SKU_ATTRIBUTE").put("sourceRef", UUID.randomUUID().toString())
            .put("targetRef", UUID.randomUUID().toString());
        return request;
    }

    private static void insertTarget(UUID ref, UUID scope, UUID item, UUID sku, String itemCode, String skuCode) {
        jdbc.update("INSERT INTO inventory.stock_target(target_ref,data_node_ref,brand_ref,item_ref,product_sku_ref,item_code,sku_code,measure_mode,configuration,balance,version,created_at_epoch_millis,updated_at_epoch_millis) VALUES(?,?,?,?,?,?,?,'UNIT','{}'::jsonb,0,1,1,1)",
            ref, scope.toString(), "BRAND", item, sku, itemCode, skuCode);
    }

    private static OperationsOwnerScopeGrant grant() {
        return new OperationsOwnerScopeGrant(WORKSPACE, "inventory-copy-replay", "INVENTORY_COPY_TEST", "EDIT_STORE_CATALOG",
            "STORE", TARGET_SCOPE, "STORE", TARGET_SCOPE, List.of(TARGET_SCOPE));
    }
}
