package com.catering.v2s.catalog.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.platform.asset.api.CatalogAssetReferenceLock;
import com.catering.v2s.platform.command.CatalogInventoryWorkspaceCommandTokens;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.sql.Connection;
import java.util.List;
import java.util.Properties;
import java.util.UUID;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
class CatalogDictionaryReorderIntegrationTest {
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final String BRAND = "BRAND";
    private static final UUID WORKSPACE = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final long BARRIER_LOCK_KEY = 7_744_112_233L;
    private static final String FIRST_APP = "catalog-reorder-t1";
    private static final String SECOND_APP = "catalog-reorder-t2";

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    private static JdbcTemplate monitor;
    private static Connection barrierConnection;

    @BeforeAll
    static void migrate() {
        Flyway.configure()
                .dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
                .locations("filesystem:../../src/main/resources/db/migration")
                .schemas("public")
                .defaultSchema("public")
                .cleanDisabled(false)
                .load()
                .migrate();
        monitor = new JdbcTemplate(dataSource("catalog-reorder-monitor"));
    }

    @Test
    void reorderRequiresEachCurrentCodeExactlyOnce() {
        Fixture fixture = fixture();

        CatalogOwnerApi.Problem duplicate = assertThrows(
                CatalogOwnerApi.Problem.class,
                () -> reorder(fixture, List.of(fixture.first(), fixture.first(), fixture.third())));
        assertEquals("VALIDATION_ERROR", duplicate.code());
        assertEquals(List.of(fixture.first(), fixture.voided(), fixture.third()), codes(read(fixture)));

        CatalogOwnerApi.Problem omitted = assertThrows(
                CatalogOwnerApi.Problem.class, () -> reorder(fixture, List.of(fixture.first(), fixture.third())));
        assertEquals("VALIDATION_ERROR", omitted.code());
        assertEquals(List.of(fixture.first(), fixture.voided(), fixture.third()), codes(read(fixture)));

        CatalogOwnerApi.Problem unknown = assertThrows(
                CatalogOwnerApi.Problem.class,
                () -> reorder(fixture, List.of(fixture.first(), fixture.voided(), "UNKNOWN", fixture.third())));
        assertEquals("VALIDATION_ERROR", unknown.code());
        assertEquals(List.of(fixture.first(), fixture.voided(), fixture.third()), codes(read(fixture)));
    }

    @Test
    void reorderIncludesAndMovesVoidedEntriesWithTheFullSubmittedSequence() {
        Fixture fixture = fixture();

        JsonNode moved = reorder(fixture, List.of(fixture.third(), fixture.voided(), fixture.first()));

        assertEquals(List.of(fixture.third(), fixture.voided(), fixture.first()), codes(moved));
        assertEquals("VOIDED", entry(moved, fixture.voided()).path("status").asText());

        JsonNode movedAgain = reorder(fixture, List.of(fixture.third(), fixture.first(), fixture.voided()));
        assertEquals(List.of(fixture.third(), fixture.first(), fixture.voided()), codes(movedAgain));
    }

    @Test
    void concurrentReordersSerializeAtTheOwnerTransactionBoundary() throws Exception {
        Fixture fixture = fixture();
        installBarrierTrigger();
        acquireBarrierLock();
        ExecutorService executor = Executors.newFixedThreadPool(2);
        CyclicBarrier start = new CyclicBarrier(3);
        Future<JsonNode> first = submit(
                executor, start, fixture, List.of(fixture.third(), fixture.voided(), fixture.first()), FIRST_APP);
        Future<JsonNode> second = submit(
                executor, start, fixture, List.of(fixture.first(), fixture.voided(), fixture.third()), SECOND_APP);
        try {
            start.await();
            awaitBothConnectionsAtDatabaseBarrier();
            releaseBarrierLock();

            JsonNode firstResult = first.get(10, TimeUnit.SECONDS);
            JsonNode secondResult = second.get(10, TimeUnit.SECONDS);
            List<String> finalCodes = codes(read(fixture));
            assertTrue(finalCodes.equals(List.of(fixture.third(), fixture.voided(), fixture.first()))
                    || finalCodes.equals(List.of(fixture.first(), fixture.voided(), fixture.third())));
            assertEquals(finalCodes, codes(firstResult).equals(finalCodes) ? codes(firstResult) : codes(secondResult));
        } finally {
            releaseBarrierLock();
            executor.shutdownNow();
            dropBarrierTrigger();
        }
    }

    private static Future<JsonNode> submit(
            ExecutorService executor,
            CyclicBarrier start,
            Fixture fixture,
            List<String> order,
            String applicationName) {
        return executor.submit(() -> {
            start.await();
            DataSource dataSource = dataSource(applicationName);
            CatalogOwnerService service = service(new JdbcTemplate(dataSource));
            TransactionTemplate transaction = new TransactionTemplate(new DataSourceTransactionManager(dataSource));
            return transaction.execute(status -> reorder(service, fixture, order, applicationName + UUID.randomUUID()));
        });
    }

    private static JsonNode reorder(Fixture fixture, List<String> order) {
        return reorder(service(monitor), fixture, order, "reorder-" + UUID.randomUUID());
    }

    private static JsonNode reorder(
            CatalogOwnerService service, Fixture fixture, List<String> order, String requestId) {
        ObjectNode request = MAPPER.createObjectNode().put("dictionaryKind", "TAG");
        ArrayNode codes = request.putArray("orderedCodes");
        order.forEach(codes::add);
        return service.write(
                        context("reorderOperationsCatalogDictionaryEntry", fixture.scope(), requestId),
                        request,
                        "receipt-" + requestId)
                .path("data")
                .path("entries");
    }

    private static JsonNode read(Fixture fixture) {
        return service(monitor)
                .readDictionary(
                        fixture.scope().toString(),
                        BRAND,
                        "TAG",
                        MAPPER.createObjectNode().put("dictionaryKind", "TAG"),
                        "read-" + UUID.randomUUID())
                .path("data")
                .path("entries");
    }

    private static CatalogOwnerService service(JdbcTemplate jdbc) {
        TimeProvider time = () -> 1_785_000_000_000L;
        return new CatalogOwnerService(jdbc, MAPPER, time, mock(CatalogAssetReferenceLock.class));
    }

    private static Fixture fixture() {
        UUID scope = UUID.randomUUID();
        Fixture fixture = new Fixture(scope, "DICT-A", "DICT-VOID", "DICT-C");
        create(fixture, fixture.first());
        create(fixture, fixture.voided());
        create(fixture, fixture.third());
        transitionToVoided(fixture, fixture.voided());
        return fixture;
    }

    private static void create(Fixture fixture, String code) {
        ObjectNode request = MAPPER.createObjectNode()
                .put("dictionaryKind", "TAG")
                .put("code", code)
                .put("name", code);
        String requestId = "create-" + code + UUID.randomUUID();
        service(monitor)
                .write(
                        context("createOperationsCatalogDictionaryEntry", fixture.scope(), requestId),
                        request,
                        "receipt-create-" + code + UUID.randomUUID());
    }

    private static void transitionToVoided(Fixture fixture, String code) {
        ObjectNode request = MAPPER.createObjectNode()
                .put("dictionaryKind", "TAG")
                .put("entryCode", code)
                .put("targetStatus", "VOIDED")
                .put("expectedVersion", 1L);
        String requestId = "void-" + code + UUID.randomUUID();
        service(monitor)
                .write(
                        context("transitionOperationsCatalogDictionaryEntryStatus", fixture.scope(), requestId),
                        request,
                        "receipt-void-" + code + UUID.randomUUID());
    }

    private static List<String> codes(JsonNode entries) {
        List<String> result = new java.util.ArrayList<>();
        entries.forEach(entry -> result.add(entry.path("code").asText()));
        return result;
    }

    private static com.catering.v2s.platform.command.WorkspaceExecutionContext<
                    com.catering.v2s.platform.command.CatalogAuthorizationScope>
            context(String operation, UUID scope, String requestId) {
        var token = CatalogInventoryWorkspaceCommandTokens.all().stream()
                .filter(candidate -> candidate.operationId().equals(operation))
                .findFirst()
                .orElseThrow(() -> new AssertionError("missing token: " + operation));
        return CatalogCommandContextFixture.context(
                WORKSPACE, "catalog-reorder-test", scope, BRAND, token, null, requestId);
    }

    private static JsonNode entry(JsonNode entries, String code) {
        for (JsonNode entry : entries) if (code.equals(entry.path("code").asText())) return entry;
        throw new AssertionError("missing dictionary code " + code);
    }

    private static OperationsOwnerScopeGrant grant(UUID scope) {
        return new OperationsOwnerScopeGrant(
                WORKSPACE,
                "catalog-reorder-test",
                "CATALOG_REORDER_TEST",
                "EDIT_STORE_CATALOG",
                "STORE",
                scope,
                "STORE",
                scope,
                List.of(scope));
    }

    private static DataSource dataSource(String applicationName) {
        DriverManagerDataSource dataSource =
                new DriverManagerDataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
        Properties properties = new Properties();
        properties.setProperty("ApplicationName", applicationName);
        dataSource.setConnectionProperties(properties);
        return dataSource;
    }

    private static void installBarrierTrigger() {
        monitor.execute(
                "CREATE OR REPLACE FUNCTION catalog.test_dictionary_reorder_barrier() RETURNS trigger LANGUAGE plpgsql "
                        + "AS $$ BEGIN PERFORM pg_advisory_xact_lock("
                        + BARRIER_LOCK_KEY + "); RETURN NEW; END $$");
        monitor.execute(
                "CREATE TRIGGER test_dictionary_reorder_barrier BEFORE UPDATE ON catalog.dictionary_entry FOR EACH ROW "
                        + "EXECUTE FUNCTION catalog.test_dictionary_reorder_barrier()");
    }

    private static void dropBarrierTrigger() {
        monitor.execute("DROP TRIGGER IF EXISTS test_dictionary_reorder_barrier ON catalog.dictionary_entry");
        monitor.execute("DROP FUNCTION IF EXISTS catalog.test_dictionary_reorder_barrier()");
    }

    private static void acquireBarrierLock() {
        try {
            barrierConnection = dataSource("catalog-reorder-barrier").getConnection();
            try (var statement = barrierConnection.createStatement()) {
                statement.execute("SELECT pg_advisory_lock(" + BARRIER_LOCK_KEY + ")");
            }
        } catch (java.sql.SQLException failure) {
            throw new AssertionError(failure);
        }
    }

    private static void releaseBarrierLock() {
        if (barrierConnection == null) return;
        try (var statement = barrierConnection.createStatement()) {
            statement.execute("SELECT pg_advisory_unlock(" + BARRIER_LOCK_KEY + ")");
            barrierConnection.close();
        } catch (java.sql.SQLException failure) {
            throw new AssertionError(failure);
        } finally {
            barrierConnection = null;
        }
    }

    private static void awaitBothConnectionsAtDatabaseBarrier() {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
        while (System.nanoTime() < deadline) {
            Long blocked = monitor.queryForObject(
                    "SELECT COUNT(*) FROM pg_stat_activity WHERE application_name IN (?, ?) AND wait_event_type='Lock'",
                    Long.class,
                    FIRST_APP,
                    SECOND_APP);
            if (blocked != null && blocked == 2L) return;
            Thread.yield();
        }
        List<String> activity = monitor.query(
                "SELECT application_name,state,wait_event_type,wait_event,query FROM pg_stat_activity WHERE "
                        + "application_name LIKE 'catalog-reorder-%' ORDER BY application_name",
                (result, index) -> result.getString("application_name") + " state=" + result.getString("state")
                        + " waitType=" + result.getString("wait_event_type") + " wait=" + result.getString("wait_event")
                        + " query=" + result.getString("query"));
        throw new AssertionError(
                "both reorder transactions did not reach the deterministic database barrier: " + activity);
    }

    private record Fixture(UUID scope, String first, String voided, String third) {}
}
