package com.catering.v2s.catalog.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.platform.asset.api.CatalogAssetReferenceLock;
import com.catering.v2s.platform.command.CatalogInventoryWorkspaceCommandTokens;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.sql.Connection;
import java.sql.SQLException;
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
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
class CatalogReceiptFirstUseConcurrencyIntegrationTest {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final UUID WORKSPACE = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final String BRAND = "RECEIPT-CATALOG-BRAND";
    private static final long BARRIER_LOCK_KEY = 7_744_113_221L;
    private static final String FIRST_APP = "catalog-receipt-first-use-1";
    private static final String SECOND_APP = "catalog-receipt-first-use-2";

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    private static JdbcTemplate monitor;
    private static Connection barrierConnection;

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
        monitor = new JdbcTemplate(dataSource("catalog-receipt-monitor"));
        assertEquals("read committed", monitor.queryForObject("SHOW transaction_isolation", String.class));
    }

    @AfterEach
    void cleanupDatabaseHooks() {
        releaseBarrierLock();
        monitor.execute("DROP TRIGGER IF EXISTS test_catalog_receipt_first_use_barrier ON catalog.dictionary_entry");
        monitor.execute("DROP FUNCTION IF EXISTS catalog.test_catalog_receipt_first_use_barrier()");
        monitor.execute("DROP TRIGGER IF EXISTS test_catalog_receipt_failure ON catalog.command_receipt");
        monitor.execute("DROP FUNCTION IF EXISTS catalog.test_catalog_receipt_failure()");
    }

    @Test
    void sameKeyAndSameRequestAcrossIndependentTransactionsWritesBusinessStateOnce() throws Exception {
        UUID scope = UUID.randomUUID();
        String code = uniqueCode("RACE");
        String key = "catalog-first-use-same";
        installDictionaryBarrierTrigger();
        acquireBarrierLock();
        ExecutorService executor = Executors.newFixedThreadPool(2);
        CyclicBarrier start = new CyclicBarrier(3);
        Future<JsonNode> first = submit(executor, start, scope, code, key, FIRST_APP);
        Future<JsonNode> second = submit(executor, start, scope, code, key, SECOND_APP);
        try {
            start.await(10, TimeUnit.SECONDS);
            awaitBothTransactionsAtDatabaseBarrier();
            releaseBarrierLock();

            JsonNode firstResult = first.get(10, TimeUnit.SECONDS);
            JsonNode secondResult = second.get(10, TimeUnit.SECONDS);
            assertEquivalentDictionaryResponses(firstResult, secondResult);
            assertEquals(1L, dictionaryCount(scope, code));
            assertEquals(1L, receiptCount(scope, key));
        } finally {
            releaseBarrierLock();
            executor.shutdownNow();
        }
    }

    @Test
    void sameKeyAndDifferentRequestReturnsIdempotencyMismatchInIndependentTransaction() {
        UUID scope = UUID.randomUUID();
        String key = "catalog-first-use-mismatch";
        createInTransaction(scope, "FIRST-" + uniqueCode("MISMATCH"), key, "catalog-mismatch-first");

        CatalogOwnerApi.Problem mismatch = assertThrows(
                CatalogOwnerApi.Problem.class,
                () -> createInTransaction(scope, "SECOND-" + uniqueCode("MISMATCH"), key, "catalog-mismatch-second"));
        assertEquals("IDEMPOTENCY_MISMATCH", mismatch.code());
        assertEquals(409, mismatch.status());
        assertEquals(1L, receiptCount(scope, key));
    }

    @Test
    void receiptFailureRollsBackBusinessWriteAndSameKeyCanRetry() {
        UUID scope = UUID.randomUUID();
        String code = uniqueCode("ROLLBACK");
        String key = "catalog-first-use-rollback";
        installReceiptFailureTrigger();

        assertThrows(DataAccessException.class, () -> createInTransaction(scope, code, key, "catalog-rollback-first"));
        assertEquals(0L, dictionaryCount(scope, code));
        assertEquals(0L, receiptCount(scope, key));

        monitor.execute("DROP TRIGGER IF EXISTS test_catalog_receipt_failure ON catalog.command_receipt");
        monitor.execute("DROP FUNCTION IF EXISTS catalog.test_catalog_receipt_failure()");

        JsonNode retry = createInTransaction(scope, code, key, "catalog-rollback-retry");
        assertTrue(retry.path("result").isObject());
        assertEquals(1L, dictionaryCount(scope, code));
        assertEquals(1L, receiptCount(scope, key));
    }

    private static Future<JsonNode> submit(
            ExecutorService executor,
            CyclicBarrier start,
            UUID scope,
            String code,
            String key,
            String applicationName) {
        return executor.submit(() -> {
            start.await(10, TimeUnit.SECONDS);
            DataSource dataSource = dataSource(applicationName);
            CatalogOwnerService service = service(new JdbcTemplate(dataSource));
            TransactionTemplate transaction = new TransactionTemplate(new DataSourceTransactionManager(dataSource));
            return transaction.execute(status -> create(service, scope, code, key, applicationName));
        });
    }

    private static JsonNode create(CatalogOwnerService service, UUID scope, String code, String key, String requestId) {
        ObjectNode request = JSON.createObjectNode()
                .put("dictionaryKind", "TAG")
                .put("code", code)
                .put("name", code);
        return service.write(
                CatalogCommandContextFixture.context(
                        WORKSPACE,
                        "catalog-receipt-first-use",
                        scope,
                        BRAND,
                        CatalogInventoryWorkspaceCommandTokens.CREATE_OPERATIONS_CATALOG_DICTIONARY_ENTRY,
                        null,
                        requestId),
                request,
                key);
    }

    private static JsonNode createInTransaction(UUID scope, String code, String key, String requestId) {
        DataSource dataSource = dataSource("catalog-receipt-sequential");
        CatalogOwnerService service = service(new JdbcTemplate(dataSource));
        TransactionTemplate transaction = new TransactionTemplate(new DataSourceTransactionManager(dataSource));
        return transaction.execute(status -> create(service, scope, code, key, requestId));
    }

    private static CatalogOwnerService service(JdbcTemplate jdbc) {
        return new CatalogOwnerService(
                jdbc, JSON, (TimeProvider) () -> 1_785_000_000_000L, mock(CatalogAssetReferenceLock.class));
    }

    private static void assertEquivalentDictionaryResponses(JsonNode expected, JsonNode actual) {
        assertEquals(expected.path("revision").asText(), actual.path("revision").asText());
        assertEquals(
                expected.path("requestId").asText(), actual.path("requestId").asText());
        assertEquals(expected.path("version").asLong(), actual.path("version").asLong());
        JsonNode expectedResult = expected.path("result");
        JsonNode actualResult = actual.path("result");
        assertTrue(expectedResult.isObject());
        assertTrue(actualResult.isObject());
        assertEquals(
                expectedResult.path("dictionaryKind").asText(),
                actualResult.path("dictionaryKind").asText());
        assertEquals(
                expectedResult.path("code").asText(), actualResult.path("code").asText());
        assertEquals(
                expectedResult.path("name").asText(), actualResult.path("name").asText());
        assertEquals(
                expectedResult.path("status").asText(),
                actualResult.path("status").asText());
        assertEquals(
                expectedResult.path("version").asLong(),
                actualResult.path("version").asLong());
        assertEquals(
                expectedResult.path("parentEntryRef").isNull(),
                actualResult.path("parentEntryRef").isNull());
    }

    private static long dictionaryCount(UUID scope, String code) {
        return monitor.queryForObject(
                "SELECT COUNT(*) FROM catalog.dictionary_entry WHERE data_node_ref=? AND brand_ref=? AND code=?",
                Long.class,
                scope.toString(),
                BRAND,
                code);
    }

    private static long receiptCount(UUID scope, String key) {
        return monitor.queryForObject(
                "SELECT COUNT(*) FROM catalog.command_receipt WHERE data_node_ref=? AND idempotency_key=?",
                Long.class,
                scope.toString(),
                key);
    }

    private static String uniqueCode(String prefix) {
        return prefix + "-"
                + UUID.randomUUID().toString().replace("-", "").substring(0, 12).toUpperCase();
    }

    private static DataSource dataSource(String applicationName) {
        DriverManagerDataSource dataSource =
                new DriverManagerDataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
        Properties properties = new Properties();
        properties.setProperty("ApplicationName", applicationName);
        dataSource.setConnectionProperties(properties);
        return dataSource;
    }

    private static void installDictionaryBarrierTrigger() {
        monitor.execute("CREATE OR REPLACE FUNCTION catalog.test_catalog_receipt_first_use_barrier() RETURNS trigger "
                + "LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_advisory_xact_lock("
                + BARRIER_LOCK_KEY
                + "); RETURN NEW; END $$");
        monitor.execute(
                "CREATE TRIGGER test_catalog_receipt_first_use_barrier BEFORE INSERT ON catalog.dictionary_entry "
                        + "FOR EACH ROW EXECUTE FUNCTION catalog.test_catalog_receipt_first_use_barrier()");
    }

    private static void installReceiptFailureTrigger() {
        monitor.execute(
                "CREATE OR REPLACE FUNCTION catalog.test_catalog_receipt_failure() RETURNS trigger LANGUAGE plpgsql "
                        + "AS $$ BEGIN RAISE EXCEPTION 'test receipt failure'; END $$");
        monitor.execute(
                "CREATE TRIGGER test_catalog_receipt_failure BEFORE INSERT ON catalog.command_receipt FOR EACH ROW "
                        + "EXECUTE FUNCTION catalog.test_catalog_receipt_failure()");
    }

    private static void acquireBarrierLock() {
        try {
            barrierConnection = dataSource("catalog-receipt-barrier").getConnection();
            try (var statement = barrierConnection.createStatement()) {
                statement.execute("SELECT pg_advisory_lock(" + BARRIER_LOCK_KEY + ")");
            }
        } catch (SQLException failure) {
            throw new AssertionError(failure);
        }
    }

    private static void releaseBarrierLock() {
        if (barrierConnection == null) return;
        try (var statement = barrierConnection.createStatement()) {
            statement.execute("SELECT pg_advisory_unlock(" + BARRIER_LOCK_KEY + ")");
            barrierConnection.close();
        } catch (SQLException failure) {
            throw new AssertionError(failure);
        } finally {
            barrierConnection = null;
        }
    }

    private static void awaitBothTransactionsAtDatabaseBarrier() {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
        while (System.nanoTime() < deadline) {
            Long blocked = monitor.queryForObject(
                    "SELECT COUNT(*) FROM pg_stat_activity WHERE application_name IN (?, ?) "
                            + "AND wait_event_type='Lock'",
                    Long.class,
                    FIRST_APP,
                    SECOND_APP);
            if (blocked != null && blocked == 2L) return;
            Thread.yield();
        }
        List<String> activity = monitor.query(
                "SELECT application_name,state,wait_event_type,wait_event,query FROM pg_stat_activity "
                        + "WHERE application_name LIKE 'catalog-receipt-first-use-%' ORDER BY application_name",
                (result, index) -> result.getString("application_name")
                        + " state="
                        + result.getString("state")
                        + " waitType="
                        + result.getString("wait_event_type")
                        + " wait="
                        + result.getString("wait_event")
                        + " query="
                        + result.getString("query"));
        throw new AssertionError("both catalog transactions did not reach the receipt barrier: " + activity);
    }
}
