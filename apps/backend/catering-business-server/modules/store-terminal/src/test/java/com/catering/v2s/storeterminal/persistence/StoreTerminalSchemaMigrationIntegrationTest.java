package com.catering.v2s.storeterminal.persistence;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.audit.contract.AuditEventWriter;
import com.catering.v2s.catalog.api.CatalogProductionTagOwnerApi;
import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.organization.api.StoreContractLookup;
import com.catering.v2s.organization.api.StoreServicePointOwnerApi;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.storeterminal.api.StoreTerminalOwnerApi.CreateCommand;
import com.catering.v2s.storeterminal.api.StoreTerminalOwnerApi.ReplaceCommand;
import com.catering.v2s.storeterminal.api.StoreTerminalOwnerApi.StatusCommand;
import com.catering.v2s.storeterminal.api.StoreTerminalOwnerApi.TerminalMutation;
import com.catering.v2s.storeterminal.application.ActivationCodeCandidateSource;
import com.catering.v2s.storeterminal.application.StoreTerminalOwnerService;
import com.catering.v2s.storeterminal.domain.ActivationCode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** Verifies the terminal aggregate storage and its database-owned constraints in PostgreSQL. */
@Testcontainers
class StoreTerminalSchemaMigrationIntegrationTest {
    private static final UUID STORE_TERMINAL_TEST_FUNCTION = UUID.fromString("00000000-0000-0000-0000-000000000004");
    private static final String CREATE_CONFIGURATION =
            """
            {
              "printers": [],
              "functions": [{
                "clientKey": "cashier",
                "functionKey": "ORDERING_CASHIER",
                "ranges": [],
                "scenes": []
              }]
            }
            """;
    private static final String REPLACE_CONFIGURATION =
            """
            {
              "printers": [],
              "functions": [{
                "ref": "00000000-0000-0000-0000-000000000004",
                "functionKey": "ORDERING_CASHIER",
                "ranges": [],
                "scenes": []
              }]
            }
            """;

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    private static Flyway flyway;
    private static DriverManagerDataSource dataSource;
    private static JdbcTemplate jdbc;

    @BeforeAll
    static void migrate() {
        flyway = Flyway.configure()
                .dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
                .locations("filesystem:../../src/main/resources/db/migration")
                .schemas("public")
                .defaultSchema("public")
                .cleanDisabled(false)
                .load();
        flyway.migrate();
        dataSource = new DriverManagerDataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
        jdbc = new JdbcTemplate(dataSource);
    }

    @Test
    void createsAggregateReceiptAndOwnerAuditTablesWithFrozenConstraints() {
        assertNotNull(jdbc.queryForObject("SELECT to_regclass('store_terminal.terminal')", String.class));
        assertNotNull(jdbc.queryForObject("SELECT to_regclass('store_terminal.command_receipt')", String.class));
        assertNotNull(jdbc.queryForObject("SELECT to_regclass('store_terminal.audit_event')", String.class));

        Integer tableCount = jdbc.queryForObject(
                "SELECT count(*) FROM information_schema.tables "
                        + "WHERE table_schema='store_terminal' AND table_type='BASE TABLE'",
                Integer.class);
        assertEquals(3, tableCount);

        String configurationType = jdbc.queryForObject(
                "SELECT data_type FROM information_schema.columns "
                        + "WHERE table_schema='store_terminal' AND table_name='terminal' "
                        + "AND column_name='configuration'",
                String.class);
        assertEquals("jsonb", configurationType);

        String terminalIndexes = String.join(
                "\n",
                jdbc.query(
                        "SELECT indexdef FROM pg_indexes "
                                + "WHERE schemaname='store_terminal' AND tablename='terminal'",
                        (row, index) -> row.getString(1)));
        String receiptIndexes = String.join(
                "\n",
                jdbc.query(
                        "SELECT indexdef FROM pg_indexes "
                                + "WHERE schemaname='store_terminal' AND tablename='command_receipt'",
                        (row, index) -> row.getString(1)));
        String auditIndexes = String.join(
                "\n",
                jdbc.query(
                        "SELECT indexdef FROM pg_indexes "
                                + "WHERE schemaname='store_terminal' AND tablename='audit_event'",
                        (row, index) -> row.getString(1)));
        List<String> terminalConstraints = jdbc.query(
                "SELECT pg_get_constraintdef(oid) FROM pg_constraint "
                        + "WHERE conrelid='store_terminal.terminal'::regclass",
                (row, index) -> row.getString(1));
        List<String> auditConstraints = jdbc.query(
                "SELECT pg_get_constraintdef(oid) FROM pg_constraint "
                        + "WHERE conrelid='store_terminal.audit_event'::regclass",
                (row, index) -> row.getString(1));

        assertAll(
                () -> assertTrue(terminalIndexes.contains("uq_store_terminal_group_activation_code"), terminalIndexes),
                () -> assertTrue(terminalIndexes.contains("ux_store_terminal_store_active_name"), terminalIndexes),
                () -> assertTrue(
                        terminalIndexes.contains("WHERE") && terminalIndexes.contains("VOIDED"), terminalIndexes),
                () -> assertTrue(
                        terminalConstraints.stream()
                                .anyMatch(value -> value.contains("jsonb_typeof(configuration) = 'object'")),
                        terminalConstraints.toString()),
                () -> assertTrue(receiptIndexes.contains("uq_store_terminal_command_receipt_key"), receiptIndexes),
                () -> assertTrue(receiptIndexes.contains("UNIQUE"), receiptIndexes),
                () -> assertTrue(auditIndexes.contains("ix_store_terminal_audit_event_target_time"), auditIndexes),
                () -> assertTrue(auditIndexes.contains("occurred_at_epoch_millis DESC"), auditIndexes),
                () -> assertTrue(
                        auditConstraints.stream().anyMatch(value -> value.contains("FOREIGN KEY")),
                        auditConstraints.toString()),
                () -> assertTrue(
                        auditConstraints.stream().anyMatch(value -> value.contains("actor_type")),
                        auditConstraints.toString()),
                () -> assertTrue(
                        auditConstraints.stream()
                                .anyMatch(value -> value.contains("jsonb_typeof(changes_json) = 'array'")),
                        auditConstraints.toString()),
                () -> assertTrue(
                        auditConstraints.stream().anyMatch(value -> value.contains("occurred_at_epoch_millis >= 0")),
                        auditConstraints.toString()));

        UUID workspace = UUID.randomUUID();
        String group = "migration-test-" + UUID.randomUUID();
        UUID store = UUID.randomUUID();
        insertGroup(workspace, group);
        UUID auditActor = UUID.randomUUID();
        insertAuditEvent(UUID.randomUUID(), workspace, group, auditActor, "[]", 1);
        assertThrows(
                DataIntegrityViolationException.class,
                () -> insertAuditEvent(UUID.randomUUID(), UUID.randomUUID(), group, auditActor, "[]", 1));
        assertThrows(
                DataIntegrityViolationException.class,
                () -> insertAuditEvent(UUID.randomUUID(), workspace, group, null, "[]", 1));
        assertThrows(
                DataIntegrityViolationException.class,
                () -> insertAuditEvent(UUID.randomUUID(), workspace, group, auditActor, "{}", 1));
        assertThrows(
                DataIntegrityViolationException.class,
                () -> insertAuditEvent(UUID.randomUUID(), workspace, group, auditActor, "[]", -1));
        insertTerminal(workspace, group, store, "Front desk", "front desk", "ENABLED", "01234567", "{}");
        insertTerminal(workspace, group, store, "Disabled terminal", "disabled terminal", "DISABLED", "87654320", "{}");
        assertThrows(
                DataIntegrityViolationException.class,
                () -> insertTerminal(
                        workspace, group, store, "Unknown state", "unknown state", "ARCHIVED", "87654319", "{}"));
        assertThrows(
                DataIntegrityViolationException.class,
                () -> insertTerminal(
                        workspace,
                        group,
                        UUID.randomUUID(),
                        "Unsupported state",
                        "unsupported state",
                        "UNSUPPORTED",
                        "87654318",
                        "{}"));
        assertThrows(
                DataIntegrityViolationException.class,
                () -> insertTerminal(
                        workspace,
                        group,
                        UUID.randomUUID(),
                        "Second terminal",
                        "second terminal",
                        "ENABLED",
                        "01234567",
                        "{}"));
        assertThrows(
                DataIntegrityViolationException.class,
                () -> insertTerminal(
                        workspace, group, store, "Also disabled", "disabled terminal", "DISABLED", "87654318", "{}"));
        insertTerminal(workspace, group, UUID.randomUUID(), "Front desk", "front desk", "ENABLED", "87654317", "{}");
        assertThrows(
                DataIntegrityViolationException.class,
                () -> insertTerminal(workspace, group, store, "FRONT DESK", "front desk", "ENABLED", "12345678", "{}"));
        insertTerminal(workspace, group, store, "Retired terminal", "retired terminal", "VOIDED", "12345678", "{}");
        assertThrows(
                DataIntegrityViolationException.class,
                () -> insertTerminal(
                        workspace,
                        group,
                        UUID.randomUUID(),
                        "Code remains reserved",
                        "code remains reserved",
                        "ENABLED",
                        "12345678",
                        "{}"));
        insertTerminal(workspace, group, store, "Retired terminal", "retired terminal", "ENABLED", "12345679", "{}");
        assertThrows(
                DataIntegrityViolationException.class,
                () -> insertTerminal(
                        UUID.randomUUID(),
                        group,
                        store,
                        "Invalid config",
                        "invalid config",
                        "ENABLED",
                        "87654321",
                        "[]"));

        UUID receiptRef = UUID.randomUUID();
        String idempotencyKey = "terminal-migration-" + UUID.randomUUID();
        insertReceipt(receiptRef, workspace, group, idempotencyKey);
        assertThrows(
                DataIntegrityViolationException.class,
                () -> insertReceipt(UUID.randomUUID(), workspace, group, idempotencyKey));
        insertReceipt(UUID.randomUUID(), UUID.randomUUID(), group, idempotencyKey);
        insertReceipt(UUID.randomUUID(), workspace, group + "-other", idempotencyKey);
    }

    @Test
    void ownerStatusCommandRollsBackTerminalReceiptAndAuditTogether() {
        UUID workspace = UUID.randomUUID();
        String group = "audit-rollback-" + UUID.randomUUID();
        UUID store = UUID.randomUUID();
        UUID terminal = UUID.randomUUID();
        insertGroup(workspace, group);
        insertTerminal(
                terminal,
                workspace,
                group,
                store,
                "Rollback terminal",
                "rollback terminal",
                "ENABLED",
                "12345678",
                "{}");
        StoreContractLookup stores = mock(StoreContractLookup.class);
        when(stores.requireStoreContractContext(workspace, group, store))
                .thenReturn(new StoreContractLookup.StoreContractContext(
                        store, UUID.randomUUID(), UUID.randomUUID(), "ENABLED", "ENABLED", List.of()));
        var service = new StoreTerminalOwnerService(
                new StoreTerminalOwnerPersistence(jdbc),
                stores,
                mock(StoreServicePointOwnerApi.class),
                mock(CatalogScopeLookup.class),
                mock(CatalogProductionTagOwnerApi.class),
                (TimeProvider) () -> 2,
                () -> "87654321",
                new ObjectMapper(),
                new StoreTerminalAuditEventWriter(jdbc));
        var grant = new OperationsOwnerScopeGrant(
                workspace,
                group,
                "transition-store-terminal",
                "EDIT_STORE_TERMINAL",
                "STORE",
                store,
                "GROUP",
                UUID.randomUUID(),
                List.of(),
                1L);
        String idempotencyKey = "terminal-status-" + UUID.randomUUID();
        var transactions = new TransactionTemplate(new DataSourceTransactionManager(dataSource));

        assertThrows(
                ForcedRollback.class,
                () -> transactions.executeWithoutResult(status -> {
                    service.transitionTerminalStatus(new StatusCommand(
                            workspace,
                            group,
                            store,
                            terminal,
                            "DISABLED",
                            1,
                            idempotencyKey,
                            AuditActor.system(),
                            grant));
                    assertEquals(
                            "DISABLED",
                            jdbc.queryForObject(
                                    "SELECT status FROM store_terminal.terminal WHERE terminal_ref=?",
                                    String.class,
                                    terminal));
                    assertEquals(
                            1,
                            jdbc.queryForObject(
                                    "SELECT count(*) FROM store_terminal.command_receipt WHERE idempotency_key=?",
                                    Integer.class,
                                    idempotencyKey));
                    assertEquals(
                            1,
                            jdbc.queryForObject(
                                    "SELECT count(*) FROM store_terminal.audit_event WHERE entity_ref_text=?",
                                    Integer.class,
                                    terminal.toString()));
                    throw new ForcedRollback();
                }));

        assertEquals(
                "ENABLED",
                jdbc.queryForObject(
                        "SELECT status FROM store_terminal.terminal WHERE terminal_ref=?", String.class, terminal));
        assertEquals(
                1L,
                jdbc.queryForObject(
                        "SELECT version FROM store_terminal.terminal WHERE terminal_ref=?", Long.class, terminal));
        assertEquals(
                0,
                jdbc.queryForObject(
                        "SELECT count(*) FROM store_terminal.command_receipt WHERE idempotency_key=?",
                        Integer.class,
                        idempotencyKey));
        assertEquals(
                0,
                jdbc.queryForObject(
                        "SELECT count(*) FROM store_terminal.audit_event WHERE entity_ref_text=?",
                        Integer.class,
                        terminal.toString()));
    }

    @Test
    void ownerCreateCommandRollsBackTerminalReceiptAndAuditTogether() throws Exception {
        UUID workspace = UUID.randomUUID();
        String group = "create-audit-rollback-" + UUID.randomUUID();
        UUID store = UUID.randomUUID();
        String activationCode = "00123456";
        String idempotencyKey = "terminal-create-rollback-" + UUID.randomUUID();
        insertGroup(workspace, group);
        var service = ownerService(workspace, group, store);
        var command = new CreateCommand(
                workspace,
                group,
                store,
                "Rollback create",
                "laptop",
                ActivationCode.of(activationCode),
                new ObjectMapper().readTree(CREATE_CONFIGURATION),
                idempotencyKey,
                AuditActor.system(),
                ownerGrant(workspace, group, store));
        var transactions = new TransactionTemplate(new DataSourceTransactionManager(dataSource));
        AtomicReference<UUID> createdTerminal = new AtomicReference<>();

        assertThrows(
                ForcedRollback.class,
                () -> transactions.executeWithoutResult(status -> {
                    var mutation = service.createTerminal(command);
                    createdTerminal.set(mutation.terminalRef());
                    assertEquals(
                            1,
                            jdbc.queryForObject(
                                    "SELECT count(*) FROM store_terminal.terminal WHERE terminal_ref=?",
                                    Integer.class,
                                    mutation.terminalRef()));
                    assertEquals(
                            1,
                            jdbc.queryForObject(
                                    "SELECT count(*) FROM store_terminal.command_receipt WHERE idempotency_key=?",
                                    Integer.class,
                                    idempotencyKey));
                    String receipt = jdbc.queryForObject(
                            """
                            SELECT request_hash || response_json::text
                            FROM store_terminal.command_receipt
                            WHERE idempotency_key=?
                            """,
                            String.class,
                            idempotencyKey);
                    assertFalse(receipt.contains(activationCode));
                    String auditChanges = jdbc.queryForObject(
                            "SELECT changes_json::text FROM store_terminal.audit_event WHERE entity_ref_text=?",
                            String.class,
                            mutation.terminalRef().toString());
                    assertTrue(auditChanges.contains("已签发"));
                    assertFalse(auditChanges.contains(activationCode));
                    throw new ForcedRollback();
                }));

        assertNotNull(createdTerminal.get());
        assertEquals(
                0,
                jdbc.queryForObject(
                        "SELECT count(*) FROM store_terminal.terminal WHERE terminal_ref=?",
                        Integer.class,
                        createdTerminal.get()));
        assertEquals(
                0,
                jdbc.queryForObject(
                        "SELECT count(*) FROM store_terminal.command_receipt WHERE idempotency_key=?",
                        Integer.class,
                        idempotencyKey));
        assertEquals(
                0,
                jdbc.queryForObject(
                        "SELECT count(*) FROM store_terminal.audit_event WHERE entity_ref_text=?",
                        Integer.class,
                        createdTerminal.get().toString()));
    }

    @Test
    void ownerReplaceCommandRollsBackTerminalReceiptAndAuditTogether() throws Exception {
        UUID workspace = UUID.randomUUID();
        String group = "replace-audit-rollback-" + UUID.randomUUID();
        UUID store = UUID.randomUUID();
        UUID terminal = UUID.randomUUID();
        String idempotencyKey = "terminal-replace-rollback-" + UUID.randomUUID();
        insertGroup(workspace, group);
        insertTerminal(
                terminal,
                workspace,
                group,
                store,
                "Rollback before",
                "rollback before",
                "ENABLED",
                "12345678",
                REPLACE_CONFIGURATION);
        var service = ownerService(workspace, group, store);
        var command = new ReplaceCommand(
                workspace,
                group,
                store,
                terminal,
                "Rollback after",
                new ObjectMapper().readTree(REPLACE_CONFIGURATION),
                1,
                idempotencyKey,
                AuditActor.system(),
                ownerGrant(workspace, group, store));
        var transactions = new TransactionTemplate(new DataSourceTransactionManager(dataSource));

        assertThrows(
                ForcedRollback.class,
                () -> transactions.executeWithoutResult(status -> {
                    service.replaceTerminal(command);
                    assertEquals(
                            "Rollback after",
                            jdbc.queryForObject(
                                    "SELECT name FROM store_terminal.terminal WHERE terminal_ref=?",
                                    String.class,
                                    terminal));
                    assertEquals(
                            2L,
                            jdbc.queryForObject(
                                    "SELECT version FROM store_terminal.terminal WHERE terminal_ref=?",
                                    Long.class,
                                    terminal));
                    assertEquals(
                            1,
                            jdbc.queryForObject(
                                    "SELECT count(*) FROM store_terminal.command_receipt WHERE idempotency_key=?",
                                    Integer.class,
                                    idempotencyKey));
                    assertEquals(
                            1,
                            jdbc.queryForObject(
                                    "SELECT count(*) FROM store_terminal.audit_event WHERE entity_ref_text=?",
                                    Integer.class,
                                    terminal.toString()));
                    throw new ForcedRollback();
                }));

        assertEquals(
                "Rollback before",
                jdbc.queryForObject(
                        "SELECT name FROM store_terminal.terminal WHERE terminal_ref=?", String.class, terminal));
        assertEquals(
                1L,
                jdbc.queryForObject(
                        "SELECT version FROM store_terminal.terminal WHERE terminal_ref=?", Long.class, terminal));
        assertEquals(
                0,
                jdbc.queryForObject(
                        "SELECT count(*) FROM store_terminal.command_receipt WHERE idempotency_key=?",
                        Integer.class,
                        idempotencyKey));
        assertEquals(
                0,
                jdbc.queryForObject(
                        "SELECT count(*) FROM store_terminal.audit_event WHERE entity_ref_text=?",
                        Integer.class,
                        terminal.toString()));
    }

    @Test
    void concurrentAutomaticCodeCollisionWaitsForUniqueOwnerThenRetries() throws Exception {
        UUID workspace = UUID.randomUUID();
        String group = "concurrent-code-claim-" + UUID.randomUUID();
        UUID store = UUID.randomUUID();
        insertGroup(workspace, group);

        String sharedCandidate = "70000001";
        String retryCandidate = "70000002";
        String firstKey = "terminal-create-concurrent-a-" + UUID.randomUUID();
        String secondKey = "terminal-create-concurrent-b-" + UUID.randomUUID();
        CountDownLatch firstAuditInserted = new CountDownLatch(1);
        CountDownLatch releaseFirstTransaction = new CountDownLatch(1);
        CountDownLatch secondCandidateIssued = new CountDownLatch(1);
        var databaseAuditWriter = new StoreTerminalAuditEventWriter(jdbc);
        AuditEventWriter holdFirstTransactionAfterInsert = event -> {
            int inserted = databaseAuditWriter.write(event);
            firstAuditInserted.countDown();
            awaitLatch(releaseFirstTransaction, "first transaction release timed out");
            return inserted;
        };
        var firstOwner = ownerService(workspace, group, store, () -> sharedCandidate, holdFirstTransactionAfterInsert);
        AtomicInteger secondCandidates = new AtomicInteger();
        ActivationCodeCandidateSource secondSource = () -> {
            int attempt = secondCandidates.incrementAndGet();
            if (attempt == 1) {
                secondCandidateIssued.countDown();
                return sharedCandidate;
            }
            return retryCandidate;
        };
        var secondOwner = ownerService(workspace, group, store, secondSource, databaseAuditWriter);
        var firstCommand = new CreateCommand(
                workspace,
                group,
                store,
                "Concurrent terminal A",
                "laptop",
                null,
                new ObjectMapper().readTree(CREATE_CONFIGURATION),
                firstKey,
                AuditActor.system(),
                ownerGrant(workspace, group, store));
        var secondCommand = new CreateCommand(
                workspace,
                group,
                store,
                "Concurrent terminal B",
                "laptop",
                null,
                new ObjectMapper().readTree(CREATE_CONFIGURATION),
                secondKey,
                AuditActor.system(),
                ownerGrant(workspace, group, store));
        var firstTransaction = new TransactionTemplate(new DataSourceTransactionManager(dataSource));
        var secondTransaction = new TransactionTemplate(new DataSourceTransactionManager(dataSource));
        ExecutorService workers = Executors.newFixedThreadPool(2);
        Future<TerminalMutation> firstResult = null;
        Future<TerminalMutation> secondResult = null;

        try {
            firstResult =
                    workers.submit(() -> firstTransaction.execute(ignored -> firstOwner.createTerminal(firstCommand)));
            assertTrue(firstAuditInserted.await(30, TimeUnit.SECONDS), "first owner did not reach its audit write");

            secondResult = workers.submit(
                    () -> secondTransaction.execute(ignored -> secondOwner.createTerminal(secondCommand)));
            assertTrue(
                    secondCandidateIssued.await(30, TimeUnit.SECONDS),
                    "second owner did not request its first candidate");
            assertTrue(
                    awaitBlockedTerminalInsert(10_000),
                    "second terminal insert did not wait on the uncommitted activation-code claim");
            releaseFirstTransaction.countDown();

            var firstMutation = firstResult.get(30, TimeUnit.SECONDS);
            var secondMutation = secondResult.get(30, TimeUnit.SECONDS);
            assertNotNull(firstMutation);
            assertNotNull(secondMutation);
            assertEquals(2, secondCandidates.get());

            assertEquals(
                    2,
                    jdbc.queryForObject(
                            "SELECT count(DISTINCT activation_code) FROM store_terminal.terminal "
                                    + "WHERE workspace_uuid=? AND group_workspace_key=?",
                            Integer.class,
                            workspace,
                            group));
            assertEquals(
                    2,
                    jdbc.queryForObject(
                            "SELECT count(*) FROM store_terminal.command_receipt "
                                    + "WHERE workspace_uuid=? AND group_workspace_key=? AND idempotency_key IN (?,?)",
                            Integer.class,
                            workspace,
                            group,
                            firstKey,
                            secondKey));
            assertEquals(1, auditCount(firstMutation.terminalRef()));
            assertEquals(1, auditCount(secondMutation.terminalRef()));
        } finally {
            releaseFirstTransaction.countDown();
            workers.shutdownNow();
            workers.awaitTermination(30, TimeUnit.SECONDS);
        }
    }

    private static StoreTerminalOwnerService ownerService(UUID workspace, String group, UUID store) {
        return ownerService(workspace, group, store, () -> "87654321", new StoreTerminalAuditEventWriter(jdbc));
    }

    private static StoreTerminalOwnerService ownerService(
            UUID workspace,
            String group,
            UUID store,
            ActivationCodeCandidateSource candidates,
            AuditEventWriter auditEvents) {
        StoreContractLookup stores = mock(StoreContractLookup.class);
        when(stores.requireStoreContractContext(workspace, group, store))
                .thenReturn(new StoreContractLookup.StoreContractContext(
                        store, UUID.randomUUID(), UUID.randomUUID(), "ENABLED", "ENABLED", List.of()));
        return new StoreTerminalOwnerService(
                new StoreTerminalOwnerPersistence(jdbc),
                stores,
                mock(StoreServicePointOwnerApi.class),
                mock(CatalogScopeLookup.class),
                mock(CatalogProductionTagOwnerApi.class),
                (TimeProvider) () -> 2,
                candidates,
                new ObjectMapper(),
                auditEvents);
    }

    private static int auditCount(UUID terminalRef) {
        return jdbc.queryForObject(
                "SELECT count(*) FROM store_terminal.audit_event WHERE entity_ref_text=?",
                Integer.class,
                terminalRef.toString());
    }

    private static boolean awaitBlockedTerminalInsert(long timeoutMillis) {
        long deadline = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(timeoutMillis);
        while (System.nanoTime() < deadline) {
            Boolean blocked = jdbc.queryForObject(
                    "SELECT EXISTS (SELECT 1 FROM pg_stat_activity "
                            + "WHERE datname=current_database() AND pid<>pg_backend_pid() "
                            + "AND wait_event_type='Lock' "
                            + "AND query ILIKE 'INSERT INTO store_terminal.terminal%')",
                    Boolean.class);
            if (Boolean.TRUE.equals(blocked)) return true;
            Thread.yield();
        }
        return false;
    }

    private static void awaitLatch(CountDownLatch latch, String failureMessage) {
        try {
            if (!latch.await(30, TimeUnit.SECONDS)) throw new IllegalStateException(failureMessage);
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("concurrent database test interrupted", interrupted);
        }
    }

    private static OperationsOwnerScopeGrant ownerGrant(UUID workspace, String group, UUID store) {
        return new OperationsOwnerScopeGrant(
                workspace,
                group,
                "store-terminal-db-focused-test",
                "EDIT_STORE_TERMINAL",
                "STORE",
                store,
                "GROUP",
                UUID.randomUUID(),
                List.of(),
                1L);
    }

    private static void insertTerminal(
            UUID workspace,
            String group,
            UUID store,
            String name,
            String normalizedName,
            String status,
            String activationCode,
            String configuration) {
        insertTerminal(
                UUID.randomUUID(),
                workspace,
                group,
                store,
                name,
                normalizedName,
                status,
                activationCode,
                configuration);
    }

    private static void insertTerminal(
            UUID terminalRef,
            UUID workspace,
            String group,
            UUID store,
            String name,
            String normalizedName,
            String status,
            String activationCode,
            String configuration) {
        jdbc.update(
                "INSERT INTO store_terminal.terminal "
                        + "(terminal_ref, workspace_uuid, group_workspace_key, store_ref, name, name_normalized, "
                        + "device_type, status, version, activation_code, configuration, created_at_epoch_millis, "
                        + "updated_at_epoch_millis) VALUES (?, ?, ?, ?, ?, ?, 'TABLETOP', ?, 1, ?, ?::jsonb, 1, 1)",
                terminalRef,
                workspace,
                group,
                store,
                name,
                normalizedName,
                status,
                activationCode,
                configuration);
    }

    private static void insertReceipt(UUID receiptRef, UUID workspace, String group, String idempotencyKey) {
        jdbc.update(
                "INSERT INTO store_terminal.command_receipt "
                        + "(receipt_ref, workspace_uuid, group_workspace_key, idempotency_key, request_hash, "
                        + "response_json, created_at_epoch_millis) VALUES (?, ?, ?, ?, repeat('a', 64), NULL, 1)",
                receiptRef,
                workspace,
                group,
                idempotencyKey);
    }

    private static void insertGroup(UUID workspace, String group) {
        String name = "Migration test " + workspace;
        jdbc.update(
                "INSERT INTO platform_workspace.group_workspace (workspace_uuid, group_workspace_key, name, "
                        + "name_normalized, operations_title, status, revision, version, created_at_epoch_millis, "
                        + "updated_at_epoch_millis, status_changed_at_epoch_millis) "
                        + "VALUES (?, ?, ?, ?, ?, 'ENABLED', 1, 1, 1, 1, 1)",
                workspace,
                group,
                name,
                name.toLowerCase(Locale.ROOT),
                name);
    }

    private static void insertAuditEvent(
            UUID eventId, UUID workspace, String group, UUID actorId, String changesJson, long occurredAt) {
        jdbc.update(
                "INSERT INTO store_terminal.audit_event "
                        + "(id, workspace_uuid, group_workspace_key, entity_type, entity_ref_text, actor_type, "
                        + "actor_id, actor_display_snapshot, action, occurred_at_epoch_millis, changes_json) "
                        + "VALUES (?, ?, ?, 'STORE_TERMINAL', 'terminal-ref', 'USER', ?, 'Test operator', "
                        + "'TERMINAL_CREATED', ?, ?::jsonb)",
                eventId,
                workspace,
                group,
                actorId,
                occurredAt,
                changesJson);
    }

    private static final class ForcedRollback extends RuntimeException {}

    @AfterAll
    static void clean() {
        if (flyway != null) flyway.clean();
    }
}
