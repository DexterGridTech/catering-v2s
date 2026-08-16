package com.catering.v2s.platform.foundation.persistence;

import java.io.PrintWriter;
import java.lang.reflect.InvocationHandler;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.logging.Logger;
import javax.sql.DataSource;

/** DataSource decorator that observes JDBC work only while a request tracker scope is active. */
public final class CountingDataSource implements DataSource {
    private final DataSource delegate;

    public CountingDataSource(DataSource delegate) {
        this.delegate = java.util.Objects.requireNonNull(delegate, "delegate");
    }

    @Override
    public Connection getConnection() throws SQLException {
        return acquire(() -> delegate.getConnection());
    }

    @Override
    public Connection getConnection(String username, String password) throws SQLException {
        return acquire(() -> delegate.getConnection(username, password));
    }

    @Override
    public <T> T unwrap(Class<T> iface) throws SQLException {
        if (iface.isInstance(this)) return iface.cast(this);
        return delegate.unwrap(iface);
    }

    @Override
    public boolean isWrapperFor(Class<?> iface) throws SQLException {
        return iface.isInstance(this) || delegate.isWrapperFor(iface);
    }

    @Override
    public PrintWriter getLogWriter() throws SQLException {
        return delegate.getLogWriter();
    }

    @Override
    public void setLogWriter(PrintWriter out) throws SQLException {
        delegate.setLogWriter(out);
    }

    @Override
    public void setLoginTimeout(int seconds) throws SQLException {
        delegate.setLoginTimeout(seconds);
    }

    @Override
    public int getLoginTimeout() throws SQLException {
        return delegate.getLoginTimeout();
    }

    @Override
    public Logger getParentLogger() throws java.sql.SQLFeatureNotSupportedException {
        return delegate.getParentLogger();
    }

    private Connection acquire(ConnectionSupplier supplier) throws SQLException {
        if (!DatabaseOperationTracker.isActive()) return supplier.get();
        long started = System.nanoTime();
        try {
            return wrapConnection(supplier.get());
        } finally {
            DatabaseOperationTracker.record("CONNECTION", "GET_CONNECTION", System.nanoTime() - started, null, null, 1);
        }
    }

    private static Connection wrapConnection(Connection connection) {
        return (Connection) Proxy.newProxyInstance(
                CountingDataSource.class.getClassLoader(),
                new Class<?>[] {Connection.class},
                new ConnectionHandler(connection));
    }

    private static Statement wrapStatement(Statement statement, String template) {
        Class<?>[] interfaces = statement instanceof java.sql.CallableStatement
                ? new Class<?>[] {java.sql.CallableStatement.class}
                : statement instanceof java.sql.PreparedStatement
                        ? new Class<?>[] {java.sql.PreparedStatement.class}
                        : new Class<?>[] {Statement.class};
        return (Statement) Proxy.newProxyInstance(
                CountingDataSource.class.getClassLoader(), interfaces, new StatementHandler(statement, template));
    }

    private static final class ConnectionHandler implements InvocationHandler {
        private final Connection delegate;

        private ConnectionHandler(Connection delegate) {
            this.delegate = delegate;
        }

        @Override
        public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
            if ("equals".equals(method.getName())) return proxy == (args == null ? null : args[0]);
            if (isTransaction(method.getName(), args) && DatabaseOperationTracker.isActive()) {
                long started = System.nanoTime();
                try {
                    return invokeDelegate(delegate, method, args);
                } finally {
                    DatabaseOperationTracker.record(
                            "TRANSACTION", action(method.getName()), System.nanoTime() - started, null, null, 1);
                }
            }
            Object result = invokeDelegate(delegate, method, args);
            if (result instanceof Statement statement && isStatementFactory(method.getName())) {
                String template = args != null && args.length > 0 && args[0] instanceof String sql ? sql : null;
                return DatabaseOperationTracker.isActive() ? wrapStatement(statement, template) : statement;
            }
            return result;
        }

        private static boolean isStatementFactory(String name) {
            return name.equals("createStatement") || name.equals("prepareStatement") || name.equals("prepareCall");
        }

        private static boolean isTransaction(String name, Object[] args) {
            return name.equals("commit")
                    || name.equals("rollback")
                    || (name.equals("setAutoCommit")
                            && args != null
                            && args.length == 1
                            && Boolean.FALSE.equals(args[0]));
        }
    }

    private static final class StatementHandler implements InvocationHandler {
        private final Statement delegate;
        private final String template;
        private final Map<Integer, String> parameterHashes = new LinkedHashMap<>();
        private final List<String> batchParameterHashes = new ArrayList<>();
        private int batchSize;

        private StatementHandler(Statement delegate, String template) {
            this.delegate = delegate;
            this.template = template;
        }

        @Override
        public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
            String name = method.getName();
            if (isParameterSetter(name, args)) {
                parameterHashes.put(
                        (Integer) args[0], DatabaseOperationTracker.parameterHash(args.length > 1 ? args[1] : null));
                return invokeDelegate(delegate, method, args);
            }
            if (name.equals("clearParameters")) {
                parameterHashes.clear();
                return invokeDelegate(delegate, method, args);
            }
            if (name.equals("addBatch")) {
                batchSize++;
                if (args == null || args.length == 0) batchParameterHashes.add(combinedParameterHash());
                return invokeDelegate(delegate, method, args);
            }
            if (name.equals("clearBatch")) {
                batchSize = 0;
                batchParameterHashes.clear();
                return invokeDelegate(delegate, method, args);
            }
            if (!isExecution(name) || !DatabaseOperationTracker.isActive())
                return invokeDelegate(delegate, method, args);
            int logicalStatements = name.contains("Batch") ? Math.max(1, batchSize) : 1;
            String sql = template == null && args != null && args.length > 0 && args[0] instanceof String value
                    ? value
                    : template;
            String paramsHash = name.contains("Batch") ? combinedBatchHash() : combinedParameterHash();
            long started = System.nanoTime();
            try {
                return invokeDelegate(delegate, method, args);
            } finally {
                DatabaseOperationTracker.record(
                        kind(name), action(name), System.nanoTime() - started, sql, paramsHash, logicalStatements);
                if (name.contains("Batch")) {
                    batchSize = 0;
                    batchParameterHashes.clear();
                }
            }
        }

        private String combinedParameterHash() {
            if (parameterHashes.isEmpty()) return DatabaseOperationTracker.parameterHash("NO_BOUND_PARAMETERS");
            if (parameterHashes.containsValue("UNAVAILABLE")) return "UNAVAILABLE";
            return DatabaseOperationTracker.parameterHash(parameterHashes.entrySet().stream()
                    .map(entry -> entry.getKey() + ":" + String.valueOf(entry.getValue()))
                    .collect(java.util.stream.Collectors.joining("|")));
        }

        private String combinedBatchHash() {
            if (batchParameterHashes.isEmpty()) return combinedParameterHash();
            if (batchParameterHashes.contains("UNAVAILABLE")) return "UNAVAILABLE";
            return DatabaseOperationTracker.parameterHash(String.join("|", batchParameterHashes));
        }

        private static boolean isParameterSetter(String name, Object[] args) {
            return name.startsWith("set")
                    && args != null
                    && args.length >= 1
                    && args[0] instanceof Integer
                    && !name.equals("setFetchDirection")
                    && !name.equals("setFetchSize")
                    && !name.equals("setQueryTimeout")
                    && !name.equals("setMaxRows")
                    && !name.equals("setLargeMaxRows")
                    && !name.equals("setMaxFieldSize");
        }

        private static boolean isExecution(String name) {
            return name.equals("execute")
                    || name.equals("executeQuery")
                    || name.equals("executeUpdate")
                    || name.equals("executeLargeUpdate")
                    || name.equals("executeBatch")
                    || name.equals("executeLargeBatch");
        }
    }

    private static Object invokeDelegate(Object target, Method method, Object[] args) throws Throwable {
        try {
            return method.invoke(target, args);
        } catch (InvocationTargetException exception) {
            throw exception.getTargetException();
        }
    }

    private static String kind(String name) {
        if (name.contains("Query")) return "QUERY";
        if (name.contains("Batch")) return "BATCH";
        return "UPDATE";
    }

    private static String action(String name) {
        return name.replaceAll("([a-z])([A-Z])", "$1_$2").toUpperCase(java.util.Locale.ROOT);
    }

    @FunctionalInterface
    private interface ConnectionSupplier {
        Connection get() throws SQLException;
    }
}
