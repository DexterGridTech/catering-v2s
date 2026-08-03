package com.catering.v2s.platform.foundation.persistence;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.lang.reflect.Proxy;
import java.sql.Connection;
import java.sql.Statement;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;

class DatabaseOperationTrackerTest {
    @Test
    void recordsLogicalOperationsOnlyInsideTheRequestScope() {
        assertEquals(0, DatabaseOperationTracker.snapshot().count());
        try (DatabaseOperationTracker.Scope ignored = DatabaseOperationTracker.open()) {
            DatabaseOperationTracker.record("query", 2_000_000L);
            DatabaseOperationTracker.record("update", 3_000_000L);
            DatabaseOperationTracker.Snapshot snapshot = DatabaseOperationTracker.snapshot();
            assertEquals(2, snapshot.count());
            assertEquals(5L, snapshot.durationMillis());
            assertEquals(2, snapshot.operations().size());
            assertEquals("QUERY", snapshot.operations().get(0).kind());
            assertEquals("UPDATE", snapshot.operations().get(1).kind());
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
    void dataSourceDecoratorRecordsStatementExecution() throws Exception {
        Statement statement = (Statement) Proxy.newProxyInstance(getClass().getClassLoader(), new Class<?>[]{Statement.class}, (proxy, method, args) -> {
            if (method.getName().equals("executeUpdate")) return 1;
            if (method.getReturnType().equals(boolean.class)) return false;
            if (method.getReturnType().equals(int.class)) return 0;
            if (method.getReturnType().equals(long.class)) return 0L;
            return null;
        });
        Connection connection = (Connection) Proxy.newProxyInstance(getClass().getClassLoader(), new Class<?>[]{Connection.class}, (proxy, method, args) -> {
            if (method.getName().equals("createStatement")) return statement;
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
        try (DatabaseOperationTracker.Scope ignored = DatabaseOperationTracker.open(); Connection wrapped = new CountingDataSource(delegate).getConnection(); Statement wrappedStatement = wrapped.createStatement()) {
            assertEquals(1, wrappedStatement.executeUpdate("ignored"));
            assertEquals(1, DatabaseOperationTracker.snapshot().count());
            assertEquals("UPDATE", DatabaseOperationTracker.snapshot().operations().getFirst().kind());
        }
    }
}
