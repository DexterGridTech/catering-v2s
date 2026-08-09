package com.catering.v2s.platform.foundation.persistence;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Proxy;
import java.nio.charset.StandardCharsets;
import java.io.ByteArrayInputStream;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.util.Map;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;

class DatabaseOperationTrackerTest {
    private static final byte[] HMAC_KEY = "only-for-focused-tests-key".getBytes(StandardCharsets.UTF_8);

    @Test
    void recordsLogicalOperationsOnlyInsideTheRequestScope() {
        assertEquals(0, DatabaseOperationTracker.snapshot().count());
        try (DatabaseOperationTracker.Scope ignored = DatabaseOperationTracker.open()) {
            DatabaseOperationTracker.record("query", 2_000_000L);
            DatabaseOperationTracker.record("update", 3_000_000L);
            DatabaseOperationTracker.Snapshot snapshot = DatabaseOperationTracker.snapshot();
            assertEquals(2, snapshot.count());
            assertEquals(2, snapshot.logicalStatementCount());
            assertEquals(5L, snapshot.durationMillis());
            assertEquals(2, snapshot.operations().size());
            assertEquals("QUERY", snapshot.operations().get(0).kind());
            assertEquals("UPDATE", snapshot.operations().get(1).kind());
            assertEquals(DatabaseOperationTracker.Section.UNCLASSIFIED, snapshot.operations().getFirst().section());
            assertEquals(Map.of("QUERY", 1L, "UPDATE", 1L), snapshot.kindCounts());
            assertEquals(Map.of("QUERY", 2L, "UPDATE", 3L), snapshot.kindDurationMillis());
        }
        assertEquals(0, DatabaseOperationTracker.snapshot().count());
    }

    @Test
    void nestedScopesRestoreTheParentCollector() {
        try (DatabaseOperationTracker.Scope outer = DatabaseOperationTracker.open()) {
            DatabaseOperationTracker.record("query", 1_000_000L);
            try (DatabaseOperationTracker.Scope inner = DatabaseOperationTracker.open()) {
                DatabaseOperationTracker.record("query", 4_000_000L);
                assertEquals(1, DatabaseOperationTracker.snapshot().count());
            }
            assertEquals(1, DatabaseOperationTracker.snapshot().count());
            assertEquals(1L, DatabaseOperationTracker.snapshot().durationMillis());
        }
    }

    @Test
    void recordsOnlyHmacIdentifiersAndProducesMechanicalSuspects() {
        try (DatabaseOperationTracker.Scope ignored = DatabaseOperationTracker.open(new DatabaseOperationTracker.Options(HMAC_KEY, true, true));
             DatabaseOperationTracker.SectionScope section = DatabaseOperationTracker.pushSection(DatabaseOperationTracker.Section.REFERENCE_CHECK)) {
            DatabaseOperationTracker.markPhase("OWNER_COMMAND_BEGIN");
            String sameParams = DatabaseOperationTracker.parameterHash("customer-42");
            DatabaseOperationTracker.record("QUERY", "EXECUTE_QUERY", 1_000_000L, "select id from customer where code = ?", sameParams, 1);
            DatabaseOperationTracker.record("QUERY", "EXECUTE_QUERY", 1_000_000L, "select id from customer where code = ?", sameParams, 1);
            DatabaseOperationTracker.Snapshot snapshot = DatabaseOperationTracker.snapshot();
            var operation = snapshot.operations().getFirst();
            assertNotNull(operation.statementId());
            assertNotNull(operation.paramsHash());
            assertNotEquals("select id from customer where code = ?", operation.statementId());
            assertNotEquals("customer-42", operation.paramsHash());
            assertEquals(DatabaseOperationTracker.Section.REFERENCE_CHECK, operation.section());
            assertEquals(DatabaseOperationTracker.Phase.OWNER_COMMAND_BEGIN, operation.phase());
            assertFalse(snapshot.statementDictionary().isEmpty());
            assertEquals("select id from customer where code = ?", snapshot.statementDictionary().get(operation.statementId()));
            assertEquals(1, snapshot.suspects().size());
            assertEquals("REDUNDANT_REPEAT", snapshot.suspects().getFirst().pattern());
            assertEquals(1, snapshot.phaseCheckpoints().size());
            assertEquals(0, snapshot.phaseCheckpoints().getFirst().databaseOperationCount());
        }
    }

    @Test
    void distinguishesNPlusOneFromRedundantParameters() {
        try (DatabaseOperationTracker.Scope ignored = DatabaseOperationTracker.open(new DatabaseOperationTracker.Options(HMAC_KEY, false));
             DatabaseOperationTracker.SectionScope section = DatabaseOperationTracker.pushSection(DatabaseOperationTracker.Section.OWNER_READ)) {
            for (String value : new String[]{"one", "two", "three"}) {
                DatabaseOperationTracker.record("QUERY", "EXECUTE_QUERY", 1_000_000L, "select * from item where id = ?", DatabaseOperationTracker.parameterHash(value), 1);
            }
            assertEquals("N_PLUS_ONE", DatabaseOperationTracker.snapshot().suspects().getFirst().pattern());
        }
    }

    @Test
    void keepsPhysicalConnectionAndTransactionKindsSeparateFromLogicalOwnerSection() {
        try (DatabaseOperationTracker.Scope ignored = DatabaseOperationTracker.open(new DatabaseOperationTracker.Options(HMAC_KEY, false));
             DatabaseOperationTracker.SectionScope section = DatabaseOperationTracker.pushSection(DatabaseOperationTracker.Section.SESSION)) {
            DatabaseOperationTracker.record("CONNECTION", "BORROW", 1_000_000L, null, null, 1);
            DatabaseOperationTracker.record("TRANSACTION", "BEGIN", 2_000_000L, null, null, 1);

            DatabaseOperationTracker.Snapshot snapshot = DatabaseOperationTracker.snapshot();
            assertEquals(Map.of("CONNECTION", 1L, "TRANSACTION", 1L), snapshot.kindCounts());
            assertEquals(Map.of(DatabaseOperationTracker.Section.SESSION, 2L), snapshot.logicalSectionCounts());
            assertEquals(1L, snapshot.connectionBorrowCount());
            assertEquals(3L, snapshot.kindDurationMillis().get("TRANSACTION") + snapshot.kindDurationMillis().get("CONNECTION"));
        }
    }

    @Test
    void recordsOnlyRealOwnerCommandAndReadbackBoundaries() {
        try (DatabaseOperationTracker.Scope ignored = DatabaseOperationTracker.open(new DatabaseOperationTracker.Options(HMAC_KEY, false))) {
            try (var command = OwnerOperationDiagnostics.beginCommand();
                 var write = DatabaseOperationTracker.pushSection(DatabaseOperationTracker.Section.OWNER_WRITE)) {
                DatabaseOperationTracker.record("UPDATE", "EXECUTE_UPDATE", 1_000_000L, "update item set status = ?", DatabaseOperationTracker.parameterHash("enabled"), 1);
            }
            String readback = OwnerOperationDiagnostics.readback(() -> {
                DatabaseOperationTracker.record("QUERY", "EXECUTE_QUERY", 1_000_000L, "select status from item where id = ?", DatabaseOperationTracker.parameterHash("item-1"), 1);
                return "readback";
            });

            DatabaseOperationTracker.Snapshot snapshot = DatabaseOperationTracker.snapshot();
            assertEquals("readback", readback);
            assertEquals(DatabaseOperationTracker.Section.OWNER_WRITE, snapshot.operations().get(0).section());
            assertEquals(DatabaseOperationTracker.Section.READBACK, snapshot.operations().get(1).section());
            assertEquals(
                java.util.List.of(
                    DatabaseOperationTracker.Phase.OWNER_COMMAND_BEGIN,
                    DatabaseOperationTracker.Phase.OWNER_COMMAND_END,
                    DatabaseOperationTracker.Phase.READBACK_END
                ),
                snapshot.phaseCheckpoints().stream().map(DatabaseOperationTracker.PhaseCheckpoint::phase).toList()
            );
        }
    }

    @Test
    void doesNotMarkReadbackCompleteWhenTheReadbackFails() {
        try (DatabaseOperationTracker.Scope ignored = DatabaseOperationTracker.open(new DatabaseOperationTracker.Options(HMAC_KEY, false))) {
            assertThrows(IllegalStateException.class, () -> OwnerOperationDiagnostics.readback(() -> {
                DatabaseOperationTracker.record("QUERY", "EXECUTE_QUERY", 1_000_000L, "select status from item where id = ?", DatabaseOperationTracker.parameterHash("item-1"), 1);
                throw new IllegalStateException("readback failed");
            }));

            DatabaseOperationTracker.Snapshot snapshot = DatabaseOperationTracker.snapshot();
            assertEquals(DatabaseOperationTracker.Section.READBACK, snapshot.operations().getFirst().section());
            assertTrue(snapshot.phaseCheckpoints().stream().noneMatch(checkpoint -> checkpoint.phase() == DatabaseOperationTracker.Phase.READBACK_END));
        }
    }

    @Test
    void marksStreamParametersUnavailableAndExcludesThemFromSuspects() {
        try (DatabaseOperationTracker.Scope ignored = DatabaseOperationTracker.open(new DatabaseOperationTracker.Options(HMAC_KEY, false));
             DatabaseOperationTracker.SectionScope section = DatabaseOperationTracker.pushSection(DatabaseOperationTracker.Section.OWNER_WRITE)) {
            String unavailable = DatabaseOperationTracker.parameterHash(new ByteArrayInputStream(new byte[]{1, 2, 3}));
            assertEquals("UNAVAILABLE", unavailable);
            DatabaseOperationTracker.record("UPDATE", "EXECUTE_UPDATE", 1_000_000L, "update asset set content = ?", unavailable, 1);
            DatabaseOperationTracker.record("UPDATE", "EXECUTE_UPDATE", 1_000_000L, "update asset set content = ?", unavailable, 1);
            assertTrue(DatabaseOperationTracker.snapshot().suspects().isEmpty());
        }
    }

    @Test
    void dataSourceDecoratorSeparatesConnectionTransactionAndBatchStatements() throws Exception {
        PreparedStatement statement = (PreparedStatement) Proxy.newProxyInstance(getClass().getClassLoader(), new Class<?>[]{PreparedStatement.class}, (proxy, method, args) -> {
            if (method.getName().equals("executeBatch")) return new int[]{1, 1};
            if (method.getName().equals("executeUpdate")) return 1;
            if (method.getReturnType().equals(boolean.class)) return false;
            if (method.getReturnType().equals(int.class)) return 0;
            if (method.getReturnType().equals(long.class)) return 0L;
            return null;
        });
        Connection connection = (Connection) Proxy.newProxyInstance(getClass().getClassLoader(), new Class<?>[]{Connection.class}, (proxy, method, args) -> {
            if (method.getName().equals("prepareStatement")) return statement;
            if (method.getReturnType().equals(boolean.class)) return false;
            if (method.getReturnType().equals(int.class)) return 0;
            if (method.getReturnType().equals(long.class)) return 0L;
            return null;
        });
        DataSource delegate = (DataSource) Proxy.newProxyInstance(getClass().getClassLoader(), new Class<?>[]{DataSource.class}, (proxy, method, args) -> {
            if (method.getName().equals("getConnection")) return connection;
            if (method.getReturnType().equals(boolean.class)) return false;
            if (method.getReturnType().equals(int.class)) return 0;
            if (method.getReturnType().equals(long.class)) return 0L;
            return null;
        });
        try (DatabaseOperationTracker.Scope ignored = DatabaseOperationTracker.open(new DatabaseOperationTracker.Options(HMAC_KEY, false));
             Connection wrapped = new CountingDataSource(delegate).getConnection();
             PreparedStatement wrappedStatement = wrapped.prepareStatement("update item set name = ? where id = ?")) {
            wrapped.setAutoCommit(false);
            wrappedStatement.setString(1, "first");
            wrappedStatement.setString(2, "one");
            wrappedStatement.addBatch();
            wrappedStatement.setString(1, "second");
            wrappedStatement.setString(2, "two");
            wrappedStatement.addBatch();
            assertEquals(2, wrappedStatement.executeBatch().length);
            wrapped.commit();
            DatabaseOperationTracker.Snapshot snapshot = DatabaseOperationTracker.snapshot();
            assertEquals(4, snapshot.count());
            assertEquals(5, snapshot.logicalStatementCount());
            assertEquals(2, snapshot.batchStatementTotal());
            assertEquals(1, snapshot.sectionCounts().get(DatabaseOperationTracker.Section.CONNECTION));
            assertEquals(2, snapshot.sectionCounts().get(DatabaseOperationTracker.Section.TRANSACTION));
            assertEquals(1, snapshot.connectionBorrowCount());
            var batch = snapshot.operations().stream().filter(operation -> operation.kind().equals("BATCH")).findFirst().orElseThrow();
            assertEquals(2, batch.batchSize());
            assertNotNull(batch.statementId());
            assertNotNull(batch.paramsHash());
        }
    }

    @Test
    void dataSourceDoesNotDecorateOrCollectWithoutAnOpenScope() throws Exception {
        Statement statement = (Statement) Proxy.newProxyInstance(getClass().getClassLoader(), new Class<?>[]{Statement.class}, (proxy, method, args) -> 1);
        Connection connection = (Connection) Proxy.newProxyInstance(getClass().getClassLoader(), new Class<?>[]{Connection.class}, (proxy, method, args) -> method.getName().equals("createStatement") ? statement : null);
        DataSource delegate = (DataSource) Proxy.newProxyInstance(getClass().getClassLoader(), new Class<?>[]{DataSource.class}, (proxy, method, args) -> method.getName().equals("getConnection") ? connection : null);
        try (Connection unwrapped = new CountingDataSource(delegate).getConnection(); Statement raw = unwrapped.createStatement()) {
            assertTrue(raw == statement);
        }
        assertEquals(0, DatabaseOperationTracker.snapshot().count());
    }
}
