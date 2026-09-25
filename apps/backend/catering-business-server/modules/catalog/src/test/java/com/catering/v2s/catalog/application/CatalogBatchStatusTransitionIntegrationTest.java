package com.catering.v2s.catalog.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;

import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.catalog.application.persistence.CatalogProductionTagOwnerPersistence;
import com.catering.v2s.inventory.application.InventoryOwnerService;
import com.catering.v2s.platform.asset.api.CatalogAssetReferenceLock;
import com.catering.v2s.platform.command.CatalogInventoryWorkspaceCommandTokens;
import com.catering.v2s.platform.command.WorkspaceExecutionContext;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
class CatalogBatchStatusTransitionIntegrationTest {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final UUID WORKSPACE = UUID.randomUUID();
    private static final UUID SCOPE = UUID.randomUUID();
    private static final String BRAND = "BATCH-BRAND";

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    private static JdbcTemplate jdbc;
    private static CatalogOwnerService catalog;

    @BeforeAll
    static void setup() {
        Flyway.configure()
                .dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
                .locations("filesystem:../../src/main/resources/db/migration")
                .schemas("public")
                .defaultSchema("public")
                .cleanDisabled(false)
                .load()
                .migrate();
        DataSource dataSource =
                new DriverManagerDataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
        jdbc = new JdbcTemplate(dataSource);
        InventoryOwnerService inventory =
                new InventoryOwnerService(jdbc, JSON, (TimeProvider) () -> 1_785_000_000_000L);
        CatalogProductionTagOwnerService production = new CatalogProductionTagOwnerService(
                new CatalogProductionTagOwnerPersistence(jdbc, (TimeProvider) () -> 1_785_000_000_000L), JSON);
        catalog = new CatalogOwnerService(
                jdbc,
                JSON,
                (TimeProvider) () -> 1_785_000_000_000L,
                mock(CatalogAssetReferenceLock.class),
                production,
                inventory,
                new DataSourceTransactionManager(dataSource));
    }

    @Test
    void batchStatusOwnerBoundaryDeclaresRequiredTransactionForTheNoManagerConstructionPath() throws Exception {
        Transactional transaction = CatalogItemService.class
                .getMethod(
                        "transitionCatalogItemStatuses",
                        WorkspaceExecutionContext.class,
                        CatalogOwnerApi.CatalogItemBatchStatusTransitionCommand.class,
                        String.class)
                .getAnnotation(Transactional.class);

        assertNotNull(transaction);
        assertEquals(Propagation.REQUIRED, transaction.propagation());
    }

    @Test
    void unknownItemFailureEscapesWithoutCreatingReceiptButKeepsEarlierItemCommit() {
        JsonNode committed = create(BRAND, "BATCH-UNKNOWN-FIRST");
        JsonNode broken = create(BRAND, "BATCH-UNKNOWN-SECOND");
        UUID committedRef = UUID.fromString(committed.path("resourceRef").asText());
        UUID brokenRef = UUID.fromString(broken.path("resourceRef").asText());
        jdbc.update(
                "UPDATE catalog.catalog_item SET sections='{" + "\"standardSalePrice\":100"
                        + "}'::jsonb WHERE item_ref=?",
                committedRef);
        // JSON null is a persisted malformed owner fact. Voiding it reaches the owner JSON decoder and
        // produces RESULT_UNKNOWN, which is a request-level failure rather than an item business outcome.
        jdbc.update("UPDATE catalog.catalog_item SET sections='null'::jsonb WHERE item_ref=?", brokenRef);
        String key = "batch-unknown-item-key";

        CatalogOwnerApi.Problem failure = assertThrows(
                CatalogOwnerApi.Problem.class,
                () -> batch(
                        BRAND,
                        "VOIDED",
                        List.of(
                                new CatalogOwnerApi.CatalogItemBatchStatusTransitionItem(committedRef, 1L),
                                new CatalogOwnerApi.CatalogItemBatchStatusTransitionItem(brokenRef, 1L)),
                        key));

        assertEquals("RESULT_UNKNOWN", failure.code());
        assertEquals("VOIDED", status(committedRef));
        assertEquals(2L, version(committedRef));
        assertEquals("DISABLED", status(brokenRef));
        assertEquals(1L, version(brokenRef));
        assertEquals(
                0L,
                jdbc.queryForObject(
                        "SELECT COUNT(*) FROM catalog.command_receipt WHERE data_node_ref=? AND idempotency_key=?",
                        Long.class,
                        SCOPE.toString(),
                        key));
    }

    @Test
    void partialFailureCommitsSuccessfulItemsAndPreservesUntouchedSections() {
        JsonNode first = create(BRAND, "BATCH-PARTIAL-FIRST");
        JsonNode second = create(BRAND, "BATCH-PARTIAL-SECOND");
        UUID firstRef = UUID.fromString(first.path("resourceRef").asText());
        UUID secondRef = UUID.fromString(second.path("resourceRef").asText());
        jdbc.update(
                "UPDATE catalog.catalog_item SET sections='{\"marker\":\"keep\"}'::jsonb WHERE item_ref=?", firstRef);
        jdbc.update("UPDATE catalog.catalog_item SET name=name, version=version+1 WHERE item_ref=?", secondRef);

        CatalogOwnerApi.CatalogItemBatchStatusTransitionReadback readback = batch(
                BRAND,
                "VOIDED",
                List.of(
                        new CatalogOwnerApi.CatalogItemBatchStatusTransitionItem(firstRef, 1L),
                        new CatalogOwnerApi.CatalogItemBatchStatusTransitionItem(secondRef, 1L)),
                "batch-partial-key");

        assertEquals(
                List.of(firstRef, secondRef),
                readback.results().stream()
                        .map(CatalogOwnerApi.CatalogItemBatchStatusTransitionResult::itemRef)
                        .toList());
        assertEquals("BATCH-PARTIAL-FIRST", readback.results().get(0).itemCode());
        assertEquals(
                CatalogOwnerApi.CatalogItemBatchStatusTransitionOutcome.SUCCEEDED,
                readback.results().get(0).outcome());
        assertEquals(null, readback.results().get(0).problemCode());
        assertEquals(null, readback.results().get(0).reason());
        assertEquals(2L, readback.results().get(0).version());
        assertEquals("BATCH-PARTIAL-SECOND", readback.results().get(1).itemCode());
        assertEquals(
                CatalogOwnerApi.CatalogItemBatchStatusTransitionOutcome.FAILED,
                readback.results().get(1).outcome());
        assertEquals("VERSION_CONFLICT", readback.results().get(1).problemCode());
        assertFalse(readback.results().get(1).reason().isBlank());
        assertEquals(null, readback.results().get(1).version());
        assertEquals("VOIDED", status(firstRef));
        assertEquals("DISABLED", status(secondRef));
        assertEquals(
                "keep",
                jdbc.queryForObject(
                        "SELECT sections->>'marker' FROM catalog.catalog_item WHERE item_ref=?",
                        String.class,
                        firstRef));
    }

    @Test
    void disabledTransitionDoesNotApplyVoidedReferenceGuard() {
        JsonNode target = create(BRAND, "BATCH-DISABLED-REFERENCED");
        JsonNode owner = create(BRAND, "BATCH-DISABLED-OWNER");
        UUID targetRef = UUID.fromString(target.path("resourceRef").asText());
        UUID ownerRef = UUID.fromString(owner.path("resourceRef").asText());
        UUID groupRef = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO "
                        + "catalog.catalog_composite_group(composite_group_ref,item_ref,group_code,group_name,selection"
                        + "_rul"
                        + "e,min_selections,max_selections,display_order) VALUES(?,?,?,?,?,?,?,?)",
                groupRef,
                ownerRef,
                "GROUP",
                "组合",
                "OPTIONAL",
                0,
                1,
                0);
        jdbc.update(
                "INSERT INTO "
                        + "catalog.catalog_composite_component(composite_component_ref,composite_group_ref,component_it"
                        + "em_r"
                        + "ef,product_sku_ref,quantity,unit,is_default,extra_price,status,display_order) "
                        + "VALUES(?,?,?,?,?,?,?,?,?,?)",
                UUID.randomUUID(),
                groupRef,
                targetRef,
                null,
                1,
                "EA",
                false,
                null,
                "ENABLED",
                0);

        CatalogOwnerApi.CatalogItemBatchStatusTransitionReadback readback = batch(
                BRAND,
                "DISABLED",
                List.of(new CatalogOwnerApi.CatalogItemBatchStatusTransitionItem(targetRef, 1L)),
                "batch-disabled-reference-key");

        assertEquals(
                CatalogOwnerApi.CatalogItemBatchStatusTransitionOutcome.SUCCEEDED,
                readback.results().get(0).outcome());
        assertEquals("DISABLED", status(targetRef));
    }

    @Test
    void itemRefOutsideBrandReturnsPerItemScopeForbiddenWithoutMutation() {
        JsonNode foreign = create("OTHER-BRAND", "BATCH-FOREIGN");
        UUID foreignRef = UUID.fromString(foreign.path("resourceRef").asText());

        CatalogOwnerApi.CatalogItemBatchStatusTransitionReadback readback = batch(
                BRAND,
                "VOIDED",
                List.of(new CatalogOwnerApi.CatalogItemBatchStatusTransitionItem(foreignRef, 1L)),
                "batch-scope-key");

        assertEquals("BATCH-FOREIGN", readback.results().get(0).itemCode());
        assertEquals(
                CatalogOwnerApi.CatalogItemBatchStatusTransitionOutcome.FAILED,
                readback.results().get(0).outcome());
        assertEquals("SCOPE_FORBIDDEN", readback.results().get(0).problemCode());
        assertFalse(readback.results().get(0).reason().isBlank());
        assertEquals(null, readback.results().get(0).version());
        assertEquals("DISABLED", status(foreignRef));
    }

    @Test
    void batchValidationRejectsEmptyDuplicateAndOverLimitBeforeHashing() {
        CatalogOwnerApi.Problem empty =
                assertThrows(CatalogOwnerApi.Problem.class, () -> batch(BRAND, "VOIDED", List.of(), "batch-empty-key"));
        assertEquals("VALIDATION_ERROR", empty.code());
        assertEquals(400, empty.status());

        UUID duplicate = UUID.randomUUID();
        CatalogOwnerApi.Problem repeated = assertThrows(
                CatalogOwnerApi.Problem.class,
                () -> batch(
                        BRAND,
                        "VOIDED",
                        List.of(
                                new CatalogOwnerApi.CatalogItemBatchStatusTransitionItem(duplicate, 1L),
                                new CatalogOwnerApi.CatalogItemBatchStatusTransitionItem(duplicate, 1L)),
                        "batch-duplicate-key"));
        assertEquals("VALIDATION_ERROR", repeated.code());

        List<CatalogOwnerApi.CatalogItemBatchStatusTransitionItem> tooMany = new ArrayList<>();
        for (int index = 0; index < 101; index++)
            tooMany.add(new CatalogOwnerApi.CatalogItemBatchStatusTransitionItem(UUID.randomUUID(), 1L));
        CatalogOwnerApi.Problem oversized =
                assertThrows(CatalogOwnerApi.Problem.class, () -> batch(BRAND, "VOIDED", tooMany, "batch-limit-key"));
        assertEquals("VALIDATION_ERROR", oversized.code());
    }

    @Test
    void replayReturnsOriginalPartialResultWithoutReexecuting() {
        JsonNode item = create(BRAND, "BATCH-REPLAY");
        UUID itemRef = UUID.fromString(item.path("resourceRef").asText());
        List<CatalogOwnerApi.CatalogItemBatchStatusTransitionItem> items =
                List.of(new CatalogOwnerApi.CatalogItemBatchStatusTransitionItem(itemRef, 1L));
        CatalogOwnerApi.CatalogItemBatchStatusTransitionReadback first =
                batch(BRAND, "VOIDED", items, "batch-replay-key");
        jdbc.update("UPDATE catalog.catalog_item SET status='DISABLED', version=version+1 WHERE item_ref=?", itemRef);

        CatalogOwnerApi.CatalogItemBatchStatusTransitionReadback replay =
                batch(BRAND, "VOIDED", items, "batch-replay-key");

        assertEquals(first.results(), replay.results());
        assertEquals("DISABLED", status(itemRef));
        assertEquals(3L, version(itemRef));
    }

    @Test
    void sameIdempotencyKeyWithDifferentItemOrderIsRejected() {
        JsonNode first = create(BRAND, "BATCH-ORDER-FIRST");
        JsonNode second = create(BRAND, "BATCH-ORDER-SECOND");
        UUID firstRef = UUID.fromString(first.path("resourceRef").asText());
        UUID secondRef = UUID.fromString(second.path("resourceRef").asText());
        String key = "batch-order-mismatch-key";

        batch(
                BRAND,
                "VOIDED",
                List.of(
                        new CatalogOwnerApi.CatalogItemBatchStatusTransitionItem(firstRef, 1L),
                        new CatalogOwnerApi.CatalogItemBatchStatusTransitionItem(secondRef, 1L)),
                key);

        CatalogOwnerApi.Problem mismatch = assertThrows(
                CatalogOwnerApi.Problem.class,
                () -> batch(
                        BRAND,
                        "VOIDED",
                        List.of(
                                new CatalogOwnerApi.CatalogItemBatchStatusTransitionItem(secondRef, 1L),
                                new CatalogOwnerApi.CatalogItemBatchStatusTransitionItem(firstRef, 1L)),
                        key));
        assertEquals("IDEMPOTENCY_MISMATCH", mismatch.code());
    }

    @Test
    void sameTargetIsSuccessfulNoOpWithoutVersionIncrement() {
        JsonNode item = create(BRAND, "BATCH-NOOP");
        UUID itemRef = UUID.fromString(item.path("resourceRef").asText());
        CatalogOwnerApi.CatalogItemBatchStatusTransitionReadback readback = batch(
                BRAND,
                "DISABLED",
                List.of(new CatalogOwnerApi.CatalogItemBatchStatusTransitionItem(itemRef, 1L)),
                "batch-noop-key");

        assertEquals(
                CatalogOwnerApi.CatalogItemBatchStatusTransitionOutcome.SUCCEEDED,
                readback.results().get(0).outcome());
        assertEquals(1L, readback.results().get(0).version());
        assertEquals(1L, version(itemRef));
    }

    private static CatalogOwnerApi.CatalogItemBatchStatusTransitionReadback batch(
            String brand,
            String targetStatus,
            List<CatalogOwnerApi.CatalogItemBatchStatusTransitionItem> items,
            String idempotencyKey) {
        return catalog.transitionCatalogItemStatuses(
                context(
                        "batchTransitionOperationsCatalogItemStatus",
                        SCOPE,
                        brand,
                        "batch-request-" + UUID.randomUUID()),
                new CatalogOwnerApi.CatalogItemBatchStatusTransitionCommand(targetStatus, items),
                idempotencyKey);
    }

    private static JsonNode create(String brand, String code) {
        return catalog.write(
                        context("createOperationsCatalogItem", SCOPE, brand, "create-request-" + UUID.randomUUID()),
                        JSON.createObjectNode()
                                .put("code", code)
                                .put("name", code)
                                .put("shapeKey", "STANDARD_SALE_COUNTED"),
                        "create-key-" + UUID.randomUUID())
                .path("result");
    }

    private static String status(UUID itemRef) {
        return jdbc.queryForObject("SELECT status FROM catalog.catalog_item WHERE item_ref=?", String.class, itemRef);
    }

    private static long version(UUID itemRef) {
        Long value =
                jdbc.queryForObject("SELECT version FROM catalog.catalog_item WHERE item_ref=?", Long.class, itemRef);
        assertNotNull(value);
        return value;
    }

    private static com.catering.v2s.platform.command.WorkspaceExecutionContext<
                    com.catering.v2s.platform.command.CatalogAuthorizationScope>
            context(String operation, UUID scope, String brand, String requestId) {
        var token = CatalogInventoryWorkspaceCommandTokens.all().stream()
                .filter(candidate -> candidate.operationId().equals(operation))
                .findFirst()
                .orElseThrow(() -> new AssertionError("missing token: " + operation));
        return CatalogCommandContextFixture.context(
                WORKSPACE, "catalog-batch-status-test", scope, brand, token, null, requestId);
    }
}
