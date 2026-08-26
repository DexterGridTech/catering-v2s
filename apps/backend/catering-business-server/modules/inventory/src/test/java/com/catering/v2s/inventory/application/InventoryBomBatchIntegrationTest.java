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
import java.math.BigDecimal;
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

/** SQL-M6: a realistic BOM has many component rows but one bounded target judgment. */
@Testcontainers
class InventoryBomBatchIntegrationTest {
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final UUID WORKSPACE = UUID.randomUUID();
    private static final UUID SCOPE = UUID.randomUUID();
    private static final UUID BOM_ITEM = UUID.randomUUID();

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

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
        JdbcTemplate jdbc = new JdbcTemplate(
                new DriverManagerDataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword()));
        service = new InventoryOwnerService(jdbc, MAPPER, (TimeProvider) () -> 1_785_000_000_000L);
        for (int index = 0; index < 10; index++) insertTarget(jdbc, UUID.randomUUID(), "TARGET-" + index);
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
    void tenBomRowsResolveAndPersistThroughTheSingleBoundedJudgment() {
        JsonNode saved = service.saveCatalogProductBom(
                SCOPE.toString(),
                "BRAND",
                request(existingTargetRefs()),
                "batch-bom",
                "batch-bom-receipt",
                WORKSPACE,
                "inventory-bom-batch",
                "STORE",
                grant());
        assertEquals(1L, saved.path("version").asLong());
        assertEquals(true, saved.path("saved").asBoolean());
    }

    @Test
    void missingTargetStillUsesReferenceFailureContract() {
        List<UUID> refs = existingTargetRefs();
        refs.set(7, UUID.randomUUID());
        InventoryOwnerApi.Problem failure = assertThrows(
                InventoryOwnerApi.Problem.class,
                () -> service.saveCatalogProductBom(
                        SCOPE.toString(),
                        "BRAND",
                        request(refs),
                        "missing-bom",
                        "missing-bom-receipt",
                        WORKSPACE,
                        "inventory-bom-batch",
                        "STORE",
                        grant()));
        assertEquals("REFERENCE_MAPPING_UNRESOLVED", failure.code());
    }

    private static List<UUID> existingTargetRefs() {
        JdbcTemplate jdbc = new JdbcTemplate(
                new DriverManagerDataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword()));
        return jdbc.query(
                "SELECT target_ref FROM inventory.stock_target WHERE data_node_ref=? AND brand_ref=? ORDER BY "
                        + "item_code",
                (row, index) -> row.getObject(1, UUID.class),
                SCOPE.toString(),
                "BRAND");
    }

    private static ObjectNode request(List<UUID> refs) {
        ObjectNode request = MAPPER.createObjectNode()
                .put("itemRef", BOM_ITEM.toString())
                .put("itemCode", "BOM-OWNER")
                .put("expectedVersion", 0);
        ArrayNode rows = request.putArray("rows");
        for (UUID ref : refs)
            rows.addObject()
                    .put("targetRef", ref.toString())
                    .put("quantity", "1")
                    .put("lineSign", "POSITIVE")
                    .set("consumptionUnitSnapshot", InventoryTestUnitFacts.consumptionUnitSnapshot(MAPPER));
        return request;
    }

    private static void insertTarget(JdbcTemplate jdbc, UUID targetRef, String itemCode) {
        InventoryTestUnitFacts.insertDirectTarget(
                jdbc, targetRef, SCOPE, "BRAND", UUID.randomUUID(), null, itemCode, null, BigDecimal.ZERO, 1L);
    }

    private static OperationsOwnerScopeGrant grant() {
        return new OperationsOwnerScopeGrant(
                WORKSPACE,
                "inventory-bom-batch",
                "CATALOG_INVENTORY_OPERATION_SAVE_OPERATIONS_CATALOG_ITEM",
                "EDIT_STORE_CATALOG",
                "STORE",
                SCOPE,
                "STORE",
                SCOPE,
                List.of(SCOPE));
    }
}
