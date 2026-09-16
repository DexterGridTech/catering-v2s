package com.catering.v2s.inventory.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.catering.v2s.inventory.api.InventoryOwnerApi;
import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.platform.command.CatalogAuthorizationScope;
import com.catering.v2s.platform.command.CatalogInventoryWorkspaceCommandTokens;
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
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
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

/** M-01: the owner write predicate must bind the caller's version, not a reread version. */
@Testcontainers
class InventoryTypedMutationCasIntegrationTest {
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final UUID SCOPE = UUID.randomUUID();

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    private static JdbcTemplate jdbc;
    private static InventoryOwnerService service;
    private static TransactionTemplate transactions;

    @BeforeAll
    static void setup() {
        Flyway.configure()
                .dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
                .locations("filesystem:../../src/main/resources/db/migration")
                .schemas("public")
                .defaultSchema("public")
                .load()
                .migrate();
        DriverManagerDataSource dataSource =
                new DriverManagerDataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
        jdbc = new JdbcTemplate(dataSource);
        transactions = new TransactionTemplate(new DataSourceTransactionManager(dataSource));
        service = new InventoryOwnerService(jdbc, MAPPER, (TimeProvider) () -> 1_785_000_000_000L);
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
    void countRejectsAStaleDifferentKeyButReplaysThePriorKey() {
        UUID targetRef = insertTarget();
        InventoryOwnerApi.InventoryMutationReadback first = inTransaction(() -> service.countTarget(
                context(),
                new InventoryOwnerApi.CountTargetCommand(targetRef, 5L, new BigDecimal("150"), null, false, "count"),
                "count-first"));
        assertStaleCountRejectedAndReplayIsStable(targetRef, first);
    }

    @Test
    void increaseRejectsAStaleDifferentKeyButReplaysThePriorKey() {
        UUID targetRef = insertTarget();
        InventoryOwnerApi.InventoryMutationReadback first = inTransaction(() -> service.increaseTarget(
                context(),
                new InventoryOwnerApi.IncreaseTargetCommand(targetRef, 5L, new BigDecimal("50"), null, "increase"),
                "increase-first"));
        InventoryOwnerApi.Problem stale = assertThrows(
                InventoryOwnerApi.Problem.class,
                () -> inTransaction(() -> service.increaseTarget(
                        context(),
                        new InventoryOwnerApi.IncreaseTargetCommand(targetRef, 5L, new BigDecimal("10"), null, "stale"),
                        "increase-stale")));
        assertEquals("VERSION_CONFLICT", stale.code());
        assertMutationState(targetRef);
        assertReplayEquals(
                first,
                inTransaction(() -> service.increaseTarget(
                        context(),
                        new InventoryOwnerApi.IncreaseTargetCommand(
                                targetRef, 5L, new BigDecimal("50"), null, "increase"),
                        "increase-first")));
        assertEquals(1L, ledgerCount(targetRef));
    }

    @Test
    void adjustRejectsAStaleDifferentKeyButReplaysThePriorKey() {
        UUID targetRef = insertTarget();
        InventoryOwnerApi.InventoryMutationReadback first = inTransaction(() -> service.adjustTarget(
                context(),
                new InventoryOwnerApi.AdjustTargetCommand(
                        targetRef, 5L, "INCREASE", new BigDecimal("50"), null, "CORRECTION", "adjust"),
                "adjust-first"));
        InventoryOwnerApi.Problem stale = assertThrows(
                InventoryOwnerApi.Problem.class,
                () -> inTransaction(() -> service.adjustTarget(
                        context(),
                        new InventoryOwnerApi.AdjustTargetCommand(
                                targetRef, 5L, "DECREASE", new BigDecimal("10"), null, "CORRECTION", "stale"),
                        "adjust-stale")));
        assertEquals("VERSION_CONFLICT", stale.code());
        assertMutationState(targetRef);
        assertReplayEquals(
                first,
                inTransaction(() -> service.adjustTarget(
                        context(),
                        new InventoryOwnerApi.AdjustTargetCommand(
                                targetRef, 5L, "INCREASE", new BigDecimal("50"), null, "CORRECTION", "adjust"),
                        "adjust-first")));
        assertEquals(1L, ledgerCount(targetRef));
    }

    @Test
    void scopedLedgerReadersReturnSameScopeFactsAndRejectAnotherStore() {
        UUID targetRef = insertTarget();
        UUID entryRef = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO "
                        + "inventory.stock_ledger(entry_ref,target_ref,operation_id,delta,balance_before,balance_after,"
                        + "reas"
                        + "on_code,note,occurred_at_epoch_millis) VALUES(?,?,?,?,?,?,?,?,?)",
                entryRef,
                targetRef,
                "INCREASE",
                new BigDecimal("5"),
                new BigDecimal("100"),
                new BigDecimal("105"),
                "TEST",
                "scope-read",
                1_785_000_000_000L);

        var request = MAPPER.createObjectNode().put("pageSize", 20);
        var changes =
                service.readTargetChangeSummary(SCOPE.toString(), "BRAND", targetRef.toString(), "TODAY", "STORE");
        var history = service.readTargetBusinessHistory(
                SCOPE.toString(), "BRAND", targetRef.toString(), request, "read-history", "STORE");
        var ledger = service.readTargetLedger(
                SCOPE.toString(), "BRAND", targetRef.toString(), request, "read-ledger", "STORE");

        assertEquals(1L, changes.path("entryCount").asLong());
        assertEquals(1, history.path("entries").size());
        assertEquals(1, ledger.path("entries").size());
        assertEquals(
                entryRef.toString(),
                ledger.path("entries").get(0).path("entryRef").asText());

        String otherStore = UUID.randomUUID().toString();
        InventoryOwnerApi.Problem changesFailure = assertThrows(
                InventoryOwnerApi.Problem.class,
                () -> service.readTargetChangeSummary(otherStore, "BRAND", targetRef.toString(), "TODAY", "STORE"));
        InventoryOwnerApi.Problem historyFailure = assertThrows(
                InventoryOwnerApi.Problem.class,
                () -> service.readTargetBusinessHistory(
                        otherStore, "BRAND", targetRef.toString(), request, "read-history-other", "STORE"));
        InventoryOwnerApi.Problem ledgerFailure = assertThrows(
                InventoryOwnerApi.Problem.class,
                () -> service.readTargetLedger(
                        otherStore, "BRAND", targetRef.toString(), request, "read-ledger-other", "STORE"));

        assertEquals("NOT_FOUND", changesFailure.code());
        assertEquals("NOT_FOUND", historyFailure.code());
        assertEquals("NOT_FOUND", ledgerFailure.code());
    }

    @Test
    void ledgerCannotOutliveOrDetachFromItsScopedTarget() {
        assertThrows(
                DataIntegrityViolationException.class,
                () -> jdbc.update(
                        "INSERT INTO "
                                + "inventory.stock_ledger(entry_ref,target_ref,operation_id,delta,balance_before,balanc"
                                + "e_af"
                                + "ter,occurred_at_epoch_millis) VALUES(?,?,?,?,?,?,?)",
                        UUID.randomUUID(),
                        UUID.randomUUID(),
                        "ADJUST",
                        BigDecimal.ONE,
                        BigDecimal.ZERO,
                        BigDecimal.ONE,
                        1_785_000_000_000L));
    }

    private static void assertStaleCountRejectedAndReplayIsStable(
            UUID targetRef, InventoryOwnerApi.InventoryMutationReadback first) {
        InventoryOwnerApi.Problem stale = assertThrows(
                InventoryOwnerApi.Problem.class,
                () -> inTransaction(() -> service.countTarget(
                        context(),
                        new InventoryOwnerApi.CountTargetCommand(
                                targetRef, 5L, new BigDecimal("100"), null, false, "stale"),
                        "count-stale")));
        assertEquals("VERSION_CONFLICT", stale.code());
        assertMutationState(targetRef);
        assertReplayEquals(
                first,
                inTransaction(() -> service.countTarget(
                        context(),
                        new InventoryOwnerApi.CountTargetCommand(
                                targetRef, 5L, new BigDecimal("150"), null, false, "count"),
                        "count-first")));
        assertEquals(1L, ledgerCount(targetRef));
    }

    private static <T> T inTransaction(Supplier<T> work) {
        return Objects.requireNonNull(transactions.execute(status -> work.get()));
    }

    private static void assertReplayEquals(
            InventoryOwnerApi.InventoryMutationReadback expected, InventoryOwnerApi.InventoryMutationReadback actual) {
        assertEquals(expected.targetRef(), actual.targetRef());
        assertEquals(0, expected.before().compareTo(actual.before()));
        assertEquals(0, expected.change().compareTo(actual.change()));
        assertEquals(0, expected.after().compareTo(actual.after()));
        assertEquals(expected.ledgerEntryRef(), actual.ledgerEntryRef());
        assertEquals(expected.stockState(), actual.stockState());
        assertEquals(expected.version(), actual.version());
    }

    private static void assertMutationState(UUID targetRef) {
        BigDecimal balance = jdbc.queryForObject(
                "SELECT balance FROM inventory.stock_target WHERE target_ref=?", BigDecimal.class, targetRef);
        assertEquals(0, new BigDecimal("150").compareTo(balance));
        assertEquals(
                6L,
                jdbc.queryForObject(
                        "SELECT version FROM inventory.stock_target WHERE target_ref=?", Long.class, targetRef));
    }

    private static long ledgerCount(UUID targetRef) {
        return jdbc.queryForObject(
                "SELECT COUNT(*) FROM inventory.stock_ledger WHERE target_ref=?", Long.class, targetRef);
    }

    private static UUID insertTarget() {
        UUID targetRef = UUID.randomUUID();
        InventoryTestUnitFacts.insertDirectTarget(
                jdbc,
                targetRef,
                SCOPE,
                "BRAND",
                UUID.randomUUID(),
                UUID.randomUUID(),
                "ITEM-" + targetRef,
                "SKU-" + targetRef,
                new BigDecimal("100"),
                5L);
        return targetRef;
    }

    private static WorkspaceExecutionContext<CatalogAuthorizationScope> context() {
        UUID workspaceId = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();
        UUID assignmentId = UUID.randomUUID();
        var token = CatalogInventoryWorkspaceCommandTokens.COUNT_OPERATIONS_INVENTORY_TARGET;
        var selectedStore = new WorkspaceSessionEntryReadback.VisibleDataNodeCandidate(
                "STORE",
                SCOPE,
                "Inventory test store",
                "INVENTORY-TEST-STORE",
                List.of("Inventory test store"),
                null,
                null,
                SCOPE,
                null);
        WorkspaceSessionReadback session = new WorkspaceSessionReadback(
                UUID.randomUUID(),
                workspaceId,
                "inventory-m01-test",
                accountId,
                assignmentId,
                new WorkspaceSessionEntryReadback.ScopeContext(null, null, selectedStore, null),
                1L,
                1L,
                Set.of(),
                Set.of(token.capabilityFor("STORE")),
                "inventory test",
                "STORE",
                SCOPE);
        WorkspaceAuthenticationService sessions = mock(WorkspaceAuthenticationService.class);
        when(sessions.commandAuthorizationFacts("inventory-test-session"))
                .thenReturn(new WorkspaceCommandAuthorizationFacts(session, UUID.randomUUID(), "STORE", SCOPE));
        WorkspaceCapabilityScopeResolver capabilities = mock(WorkspaceCapabilityScopeResolver.class);
        when(capabilities.resolveGeneratedCatalogOperation(any(), anyString(), anyString(), any(), any()))
                .thenReturn(new WorkspaceCapabilityScopeResolver.CatalogScopeResolution(
                        new WorkspaceCapabilityScopeResolver.ScopeResolution(
                                WorkspaceCapabilityScopeResolver.Decision.ALLOW,
                                token.capabilityFor("STORE"),
                                new WorkspaceCapabilityScopeResolver.FirstOwnerQueryPredicate(
                                        workspaceId,
                                        "inventory-m01-test",
                                        "STORE",
                                        SCOPE,
                                        "STORE",
                                        SCOPE,
                                        List.of(SCOPE))),
                        new CatalogScopeLookup.CatalogBrandJudgment(
                                "BRAND", "TEST_ORGANIZATION_JUDGMENT", "TEST_REVISION"),
                        null));
        CatalogScopeLookup catalogScopes = mock(CatalogScopeLookup.class);
        return new CommandExecutionContextResolver(
                        capabilities, catalogScopes, sessions, (workspace, group, targetType, storeId) -> {})
                .resolveCatalog(
                        "inventory-test-session",
                        token,
                        SCOPE.toString(),
                        CatalogScopeLookup.CatalogBrandSelection.fromRequestValue("BRAND"),
                        "inventory-correlation",
                        "inventory-request");
    }
}
