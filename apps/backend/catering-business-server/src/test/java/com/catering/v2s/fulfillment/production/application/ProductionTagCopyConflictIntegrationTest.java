package com.catering.v2s.fulfillment.production.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.catering.v2s.fulfillment.production.api.ProductionTagOwnerApi;
import com.catering.v2s.fulfillment.production.application.persistence.ProductionTagOwnerPersistence;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.platform.foundation.persistence.CountingDataSource;
import com.catering.v2s.platform.foundation.persistence.DatabaseOperationTracker;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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

/** An all-reused production-tag copy is a conflict, not a successful write. */
@Testcontainers
class ProductionTagCopyConflictIntegrationTest {
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final UUID WORKSPACE = UUID.randomUUID();
    private static final UUID SOURCE_SCOPE = UUID.randomUUID();
    private static final UUID TARGET_SCOPE = UUID.randomUUID();
    private static final UUID SOURCE_TAG = UUID.randomUUID();

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    private static JdbcTemplate jdbc;
    private static ProductionTagOwnerService service;

    @BeforeAll
    static void setup() {
        Flyway.configure()
                .dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
                .locations("filesystem:src/main/resources/db/migration")
                .schemas("public")
                .defaultSchema("public")
                .load()
                .migrate();
        jdbc = new JdbcTemplate(new CountingDataSource(
                new DriverManagerDataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())));
        service = new ProductionTagOwnerService(
                new ProductionTagOwnerPersistence(jdbc, (TimeProvider) () -> 1_785_000_000_000L), MAPPER);
        insertTag(SOURCE_TAG, SOURCE_SCOPE, "TAG-A");
        insertTag(UUID.randomUUID(), TARGET_SCOPE, "TAG-A");
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
    void allTargetConflictsAreNotReportedAsCommittedCopy() {
        ObjectNode request = MAPPER.createObjectNode();
        request.putArray("productionTagDefinitionRefs").add(SOURCE_TAG.toString());
        JsonNode preflight = service.preflightCopy(
                SOURCE_SCOPE.toString(),
                TARGET_SCOPE.toString(),
                "BRAND",
                request,
                WORKSPACE,
                "production-copy-conflict",
                "STORE",
                grant());
        request.put("productionPreflightDigest", preflight.path("digest").asText());

        JsonNode readback = service.copy(
                SOURCE_SCOPE.toString(),
                TARGET_SCOPE.toString(),
                "BRAND",
                request,
                "all-conflicts",
                "all-conflicts-receipt",
                WORKSPACE,
                "production-copy-conflict",
                "STORE",
                grant());

        assertEquals("CONFLICT", readback.path("status").asText());
        assertEquals(0, readback.path("version").asInt());
    }

    @Test
    void copyUsesOneJdbcBatchForTwoConflictingTags() {
        UUID secondSource = UUID.randomUUID();
        insertTag(secondSource, SOURCE_SCOPE, "TAG-B");
        insertTag(UUID.randomUUID(), TARGET_SCOPE, "TAG-B");
        ObjectNode request = MAPPER.createObjectNode();
        request.putArray("productionTagDefinitionRefs")
                .add(SOURCE_TAG.toString())
                .add(secondSource.toString());
        JsonNode preflight = service.preflightCopy(
                SOURCE_SCOPE.toString(),
                TARGET_SCOPE.toString(),
                "BRAND",
                request,
                WORKSPACE,
                "production-copy-conflict",
                "STORE",
                grant());
        request.put("productionPreflightDigest", preflight.path("digest").asText());

        DatabaseOperationTracker.Snapshot snapshot;
        try (var measurement = DatabaseOperationTracker.open(new DatabaseOperationTracker.Options(
                "production-copy-metrics-key".getBytes(java.nio.charset.StandardCharsets.UTF_8), true, true))) {
            JsonNode readback = service.copy(
                    SOURCE_SCOPE.toString(),
                    TARGET_SCOPE.toString(),
                    "BRAND",
                    request,
                    "all-conflicts-batch",
                    "all-conflicts-batch-receipt",
                    WORKSPACE,
                    "production-copy-conflict",
                    "STORE",
                    grant());
            assertEquals("CONFLICT", readback.path("status").asText());
            snapshot = measurement.snapshot();
        }

        long ownerBatchCount = snapshot.operations().stream()
                .filter(operation -> "BATCH".equals(operation.kind())
                        && "EXECUTE_BATCH".equals(operation.action())
                        && operation.section() == DatabaseOperationTracker.Section.OWNER_WRITE
                        && operation.batchSize() == 2)
                .count();
        assertEquals(1, ownerBatchCount, () -> "operations=" + snapshot.operations());
    }

    @Test
    void sameIdempotencyKeyCannotReplayOneBrandReadbackIntoAnotherBrand() {
        ObjectNode request =
                MAPPER.createObjectNode().put("code", "BRAND-RECEIPT").put("name", "Brand receipt");
        service.write(
                "createOperationsProductionTag",
                TARGET_SCOPE.toString(),
                "BRAND-A",
                request,
                "brand-a",
                "brand-receipt-key-0001",
                WORKSPACE,
                "production-copy-conflict",
                "STORE",
                grant());

        ProductionTagOwnerApi.Problem failure = assertThrows(
                ProductionTagOwnerApi.Problem.class,
                () -> service.write(
                        "createOperationsProductionTag",
                        TARGET_SCOPE.toString(),
                        "BRAND-B",
                        request,
                        "brand-b",
                        "brand-receipt-key-0001",
                        WORKSPACE,
                        "production-copy-conflict",
                        "STORE",
                        grant()));

        assertEquals("IDEMPOTENCY_MISMATCH", failure.code());
        assertEquals(
                0,
                jdbc.queryForObject(
                        "SELECT count(*) FROM fulfillment_production.production_tag_definition WHERE data_node_ref=? "
                                + "AND brand_ref=? AND code=?",
                        Integer.class,
                        TARGET_SCOPE.toString(),
                        "BRAND-B",
                        "BRAND-RECEIPT"));
    }

    @Test
    void duplicateProductionTagCodeIsNotMisreportedAsVersionDrift() {
        ObjectNode first =
                MAPPER.createObjectNode().put("code", "DUPLICATE-CODE").put("name", "First name");
        service.write(
                "createOperationsProductionTag",
                TARGET_SCOPE.toString(),
                "BRAND",
                first,
                "duplicate-first",
                "duplicate-first-receipt",
                WORKSPACE,
                "production-copy-conflict",
                "STORE",
                grant());

        ObjectNode duplicate =
                MAPPER.createObjectNode().put("code", "DUPLICATE-CODE").put("name", "Changed name");
        ProductionTagOwnerApi.Problem failure = assertThrows(
                ProductionTagOwnerApi.Problem.class,
                () -> service.write(
                        "createOperationsProductionTag",
                        TARGET_SCOPE.toString(),
                        "BRAND",
                        duplicate,
                        "duplicate-second",
                        "duplicate-second-receipt",
                        WORKSPACE,
                        "production-copy-conflict",
                        "STORE",
                        grant()));

        assertEquals("DUPLICATE_CODE", failure.code());
    }

    private static void insertTag(UUID ref, UUID scope, String code) {
        jdbc.update(
                "INSERT INTO "
                        + "fulfillment_production.production_tag_definition("
                        + "tag_ref,data_node_ref,brand_ref,code,name,status,version,"
                        + "created_at_epoch_millis,updated_at_epoch_millis) "
                        + "VALUES(?,?,?,?,'Tag A','ENABLED',1,1,1)",
                ref,
                scope.toString(),
                "BRAND",
                code);
    }

    private static OperationsOwnerScopeGrant grant() {
        return new OperationsOwnerScopeGrant(
                WORKSPACE,
                "production-copy-conflict",
                "PRODUCTION_COPY_TEST",
                "EDIT_STORE_CATALOG",
                "STORE",
                TARGET_SCOPE,
                "STORE",
                TARGET_SCOPE,
                List.of(TARGET_SCOPE));
    }
}
