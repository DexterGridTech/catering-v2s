package com.catering.v2s.inventory.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.catering.v2s.inventory.api.InventoryOwnerApi;
import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.platform.command.CatalogAuthorizationScope;
import com.catering.v2s.platform.command.CatalogInventoryWorkspaceCommandTokens;
import com.catering.v2s.platform.command.WorkspaceCommandOperationToken;
import com.catering.v2s.platform.command.WorkspaceExecutionContext;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionEntryReadback;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import com.catering.v2s.workspace.iam.application.CommandExecutionContextResolver;
import com.catering.v2s.workspace.iam.application.WorkspaceAuthenticationService;
import com.catering.v2s.workspace.iam.application.WorkspaceCapabilityScopeResolver;
import com.catering.v2s.workspace.iam.application.WorkspaceCommandAuthorizationFacts;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;
import java.util.Properties;
import java.util.Set;
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
class InventoryReceiptFirstUseConcurrencyIntegrationTest {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final UUID WORKSPACE = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private static final UUID SCOPE = UUID.fromString("33333333-3333-3333-3333-333333333333");
    private static final String BRAND = "RECEIPT-INVENTORY-BRAND";
    private static final long BARRIER_LOCK_KEY = 7_744_113_227L;
    private static final String FIRST_APP = "inventory-receipt-first-use-1";
    private static final String SECOND_APP = "inventory-receipt-first-use-2";

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
        monitor = new JdbcTemplate(dataSource("inventory-receipt-monitor"));
        assertEquals("read committed", monitor.queryForObject("SHOW transaction_isolation", String.class));
    }

    @AfterEach
    void cleanupDatabaseHooks() {
        releaseBarrierLock();
        monitor.execute("DROP TRIGGER IF EXISTS test_inventory_receipt_first_use_barrier ON inventory.stock_ledger");
        monitor.execute("DROP FUNCTION IF EXISTS inventory.test_inventory_receipt_first_use_barrier()");
        monitor.execute("DROP TRIGGER IF EXISTS test_inventory_receipt_failure ON inventory.command_receipt");
        monitor.execute("DROP FUNCTION IF EXISTS inventory.test_inventory_receipt_failure()");
    }

    @Test
    void sameKeyAndSameRequestAcrossIndependentTransactionsWritesBusinessStateOnce() throws Exception {
        UUID targetRef = insertTarget();
        String key = "inventory-first-use-same";
        installLedgerBarrierTrigger();
        acquireBarrierLock();
        ExecutorService executor = Executors.newFixedThreadPool(2);
        CyclicBarrier start = new CyclicBarrier(3);
        Future<InventoryOwnerApi.InventoryMutationReadback> first = submit(executor, start, targetRef, key, FIRST_APP);
        Future<InventoryOwnerApi.InventoryMutationReadback> second =
                submit(executor, start, targetRef, key, SECOND_APP);
        try {
            start.await(10, TimeUnit.SECONDS);
            awaitBothTransactionsAtDatabaseBarrier();
            releaseBarrierLock();

            InventoryOwnerApi.InventoryMutationReadback firstResult = first.get(10, TimeUnit.SECONDS);
            InventoryOwnerApi.InventoryMutationReadback secondResult = second.get(10, TimeUnit.SECONDS);
            assertEquals(firstResult.targetRef(), secondResult.targetRef());
            assertEquals(firstResult.ledgerEntryRef(), secondResult.ledgerEntryRef());
            assertEquals(0, firstResult.after().compareTo(secondResult.after()));
            assertEquals(6L, firstResult.version());
            assertEquals(1L, ledgerCount(targetRef));
            assertEquals(1L, receiptCount(targetRef, key));
            assertEquals(0, new BigDecimal("110").compareTo(balance(targetRef)));
        } finally {
            releaseBarrierLock();
            executor.shutdownNow();
        }
    }

    @Test
    void sameKeyAndDifferentRequestReturnsIdempotencyMismatchInIndependentTransaction() {
        UUID targetRef = insertTarget();
        String key = "inventory-first-use-mismatch";
        inTransaction(() -> increase(targetRef, key, new BigDecimal("10"), "inventory-mismatch-first"));

        InventoryOwnerApi.Problem mismatch = assertThrows(
                InventoryOwnerApi.Problem.class,
                () -> inTransaction(() -> increase(targetRef, key, new BigDecimal("20"), "inventory-mismatch-second")));
        assertEquals("IDEMPOTENCY_MISMATCH", mismatch.code());
        assertEquals(409, mismatch.status());
        assertEquals(1L, receiptCount(targetRef, key));
        assertEquals(1L, ledgerCount(targetRef));
        assertEquals(0, new BigDecimal("110").compareTo(balance(targetRef)));
    }

    @Test
    void receiptFailureRollsBackBusinessWriteAndSameKeyCanRetry() {
        UUID targetRef = insertTarget();
        String key = "inventory-first-use-rollback";
        installReceiptFailureTrigger();

        assertThrows(
                DataAccessException.class,
                () -> inTransaction(() -> increase(targetRef, key, new BigDecimal("10"), "inventory-rollback-first")));
        assertEquals(0L, ledgerCount(targetRef));
        assertEquals(0L, receiptCount(targetRef, key));
        assertEquals(0, new BigDecimal("100").compareTo(balance(targetRef)));

        monitor.execute("DROP TRIGGER IF EXISTS test_inventory_receipt_failure ON inventory.command_receipt");
        monitor.execute("DROP FUNCTION IF EXISTS inventory.test_inventory_receipt_failure()");

        InventoryOwnerApi.InventoryMutationReadback retry =
                inTransaction(() -> increase(targetRef, key, new BigDecimal("10"), "inventory-rollback-retry"));
        assertTrue(retry.after().compareTo(new BigDecimal("110")) == 0);
        assertEquals(1L, ledgerCount(targetRef));
        assertEquals(1L, receiptCount(targetRef, key));
    }

    private static Future<InventoryOwnerApi.InventoryMutationReadback> submit(
            ExecutorService executor, CyclicBarrier start, UUID targetRef, String key, String applicationName) {
        return executor.submit(() -> {
            start.await(10, TimeUnit.SECONDS);
            DataSource dataSource = dataSource(applicationName);
            InventoryOwnerService service = new InventoryOwnerService(
                    new JdbcTemplate(dataSource), JSON, (TimeProvider) () -> 1_785_000_000_000L);
            TransactionTemplate transaction = new TransactionTemplate(new DataSourceTransactionManager(dataSource));
            return transaction.execute(status -> service.increaseTarget(
                    context("increaseOperationsInventoryTarget", applicationName),
                    command(targetRef, new BigDecimal("10"), "race"),
                    key));
        });
    }

    private static InventoryOwnerApi.InventoryMutationReadback increase(
            UUID targetRef, String key, BigDecimal quantity, String requestId) {
        DataSource dataSource = dataSource("inventory-receipt-sequential");
        InventoryOwnerService service =
                new InventoryOwnerService(new JdbcTemplate(dataSource), JSON, (TimeProvider) () -> 1_785_000_000_000L);
        return new TransactionTemplate(new DataSourceTransactionManager(dataSource))
                .execute(status -> service.increaseTarget(
                        context("increaseOperationsInventoryTarget", requestId),
                        command(targetRef, quantity, requestId),
                        key));
    }

    private static InventoryOwnerApi.IncreaseTargetCommand command(UUID targetRef, BigDecimal quantity, String note) {
        return new InventoryOwnerApi.IncreaseTargetCommand(targetRef, 5L, quantity, null, note);
    }

    private static <T> T inTransaction(java.util.function.Supplier<T> work) {
        return work.get();
    }

    private static WorkspaceExecutionContext<CatalogAuthorizationScope> context(String operationId, String requestId) {
        WorkspaceCommandOperationToken token =
                switch (operationId) {
                    case "increaseOperationsInventoryTarget" -> CatalogInventoryWorkspaceCommandTokens
                            .INCREASE_OPERATIONS_INVENTORY_TARGET;
                    default -> throw new AssertionError("unsupported inventory operation " + operationId);
                };
        var selectedStore = new WorkspaceSessionEntryReadback.VisibleDataNodeCandidate(
                "STORE",
                SCOPE,
                "Inventory receipt test store",
                "RECEIPT-INVENTORY-STORE",
                List.of(),
                null,
                null,
                SCOPE,
                null);
        UUID accountId = UUID.randomUUID();
        UUID assignmentId = UUID.randomUUID();
        WorkspaceSessionReadback session = new WorkspaceSessionReadback(
                UUID.randomUUID(),
                WORKSPACE,
                "inventory-receipt-first-use",
                accountId,
                assignmentId,
                new WorkspaceSessionEntryReadback.ScopeContext(null, null, selectedStore, null),
                1L,
                1L,
                Set.of(),
                Set.of(token.capabilityFor("STORE")),
                "inventory receipt test",
                "STORE",
                SCOPE);
        WorkspaceAuthenticationService sessions = mock(WorkspaceAuthenticationService.class);
        when(sessions.commandAuthorizationFacts("test-session"))
                .thenReturn(new WorkspaceCommandAuthorizationFacts(session, UUID.randomUUID(), "STORE", SCOPE));
        WorkspaceCapabilityScopeResolver capabilities = mock(WorkspaceCapabilityScopeResolver.class);
        when(capabilities.resolveGeneratedCatalogOperation(any(), anyString(), anyString(), any(), any()))
                .thenReturn(new WorkspaceCapabilityScopeResolver.CatalogScopeResolution(
                        new WorkspaceCapabilityScopeResolver.ScopeResolution(
                                WorkspaceCapabilityScopeResolver.Decision.ALLOW,
                                token.capabilityFor("STORE"),
                                new WorkspaceCapabilityScopeResolver.FirstOwnerQueryPredicate(
                                        WORKSPACE,
                                        "inventory-receipt-first-use",
                                        "STORE",
                                        SCOPE,
                                        "STORE",
                                        SCOPE,
                                        List.of(SCOPE))),
                        new CatalogScopeLookup.CatalogBrandJudgment(
                                BRAND, "RECEIPT_INVENTORY_TEST", "RECEIPT_INVENTORY_REVISION"),
                        null));
        CatalogScopeLookup catalogScopes = mock(CatalogScopeLookup.class);
        return new CommandExecutionContextResolver(
                        capabilities, catalogScopes, sessions, (workspace, group, targetType, storeId) -> {})
                .resolveCatalog(
                        "test-session",
                        token,
                        SCOPE.toString(),
                        CatalogScopeLookup.CatalogBrandSelection.fromRequestValue(BRAND),
                        "inventory-receipt-correlation",
                        requestId);
    }

    private static UUID insertTarget() {
        UUID targetRef = UUID.randomUUID();
        InventoryTestUnitFacts.insertDirectTarget(
                monitor,
                targetRef,
                SCOPE,
                BRAND,
                UUID.randomUUID(),
                UUID.randomUUID(),
                "RECEIPT-ITEM-" + targetRef,
                "RECEIPT-SKU-" + targetRef,
                new BigDecimal("100"),
                5L);
        return targetRef;
    }

    private static BigDecimal balance(UUID targetRef) {
        return monitor.queryForObject(
                "SELECT balance FROM inventory.stock_target WHERE target_ref=?", BigDecimal.class, targetRef);
    }

    private static long ledgerCount(UUID targetRef) {
        return monitor.queryForObject(
                "SELECT COUNT(*) FROM inventory.stock_ledger WHERE target_ref=?", Long.class, targetRef);
    }

    private static long receiptCount(UUID targetRef, String key) {
        return monitor.queryForObject(
                "SELECT COUNT(*) FROM inventory.command_receipt WHERE data_node_ref=? AND idempotency_key=?",
                Long.class,
                SCOPE.toString(),
                key);
    }

    private static DataSource dataSource(String applicationName) {
        DriverManagerDataSource dataSource =
                new DriverManagerDataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
        Properties properties = new Properties();
        properties.setProperty("ApplicationName", applicationName);
        dataSource.setConnectionProperties(properties);
        return dataSource;
    }

    private static void installLedgerBarrierTrigger() {
        monitor.execute(
                "CREATE OR REPLACE FUNCTION inventory.test_inventory_receipt_first_use_barrier() RETURNS trigger "
                        + "LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_advisory_xact_lock("
                        + BARRIER_LOCK_KEY
                        + "); RETURN NEW; END $$");
        monitor.execute(
                "CREATE TRIGGER test_inventory_receipt_first_use_barrier BEFORE INSERT ON inventory.stock_ledger "
                        + "FOR EACH ROW EXECUTE FUNCTION inventory.test_inventory_receipt_first_use_barrier()");
    }

    private static void installReceiptFailureTrigger() {
        monitor.execute("CREATE OR REPLACE FUNCTION inventory.test_inventory_receipt_failure() "
                + "RETURNS trigger LANGUAGE plpgsql "
                + "AS $$ BEGIN RAISE EXCEPTION 'test receipt failure'; END $$");
        monitor.execute(
                "CREATE TRIGGER test_inventory_receipt_failure BEFORE INSERT ON inventory.command_receipt FOR EACH ROW "
                        + "EXECUTE FUNCTION inventory.test_inventory_receipt_failure()");
    }

    private static void acquireBarrierLock() {
        try {
            barrierConnection = dataSource("inventory-receipt-barrier").getConnection();
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
                        + "WHERE application_name LIKE 'inventory-receipt-first-use-%' ORDER BY application_name",
                (result, index) -> result.getString("application_name")
                        + " state="
                        + result.getString("state")
                        + " waitType="
                        + result.getString("wait_event_type")
                        + " wait="
                        + result.getString("wait_event")
                        + " query="
                        + result.getString("query"));
        throw new AssertionError("both inventory transactions did not reach the receipt barrier: " + activity);
    }
}
