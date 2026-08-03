package com.catering.v2s.platform.foundation.persistence;

import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.logging.Logger;
import java.io.PrintWriter;
import javax.sql.DataSource;

/** DataSource decorator that observes statement execution without retaining SQL or parameters. */
public final class CountingDataSource implements DataSource {
    private final DataSource delegate;

    public CountingDataSource(DataSource delegate) {
        this.delegate = java.util.Objects.requireNonNull(delegate, "delegate");
    }

    @Override public Connection getConnection() throws SQLException { return wrapConnection(delegate.getConnection()); }
    @Override public Connection getConnection(String username, String password) throws SQLException { return wrapConnection(delegate.getConnection(username, password)); }
    @Override public <T> T unwrap(Class<T> iface) throws SQLException { if (iface.isInstance(this)) return iface.cast(this); return delegate.unwrap(iface); }
    @Override public boolean isWrapperFor(Class<?> iface) throws SQLException { return iface.isInstance(this) || delegate.isWrapperFor(iface); }
    @Override public PrintWriter getLogWriter() throws SQLException { return delegate.getLogWriter(); }
    @Override public void setLogWriter(PrintWriter out) throws SQLException { delegate.setLogWriter(out); }
    @Override public void setLoginTimeout(int seconds) throws SQLException { delegate.setLoginTimeout(seconds); }
    @Override public int getLoginTimeout() throws SQLException { return delegate.getLoginTimeout(); }
    @Override public Logger getParentLogger() throws java.sql.SQLFeatureNotSupportedException { return delegate.getParentLogger(); }

    private static Connection wrapConnection(Connection connection) {
        return (Connection) Proxy.newProxyInstance(
                CountingDataSource.class.getClassLoader(),
                new Class<?>[]{Connection.class},
                new ConnectionHandler(connection));
    }

    private static Statement wrapStatement(Statement statement) {
        Class<?>[] interfaces = statement instanceof java.sql.CallableStatement
                ? new Class<?>[]{java.sql.CallableStatement.class}
                : statement instanceof java.sql.PreparedStatement
                    ? new Class<?>[]{java.sql.PreparedStatement.class}
                    : new Class<?>[]{Statement.class};
        return (Statement) Proxy.newProxyInstance(CountingDataSource.class.getClassLoader(), interfaces, new StatementHandler(statement));
    }

    private static final class ConnectionHandler implements InvocationHandler {
        private final Connection delegate;
        private ConnectionHandler(Connection delegate) { this.delegate = delegate; }

        @Override public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
            Object result = method.invoke(delegate, args);
            if (result instanceof Statement statement && isStatementFactory(method.getName())) return wrapStatement(statement);
            if ("equals".equals(method.getName())) return proxy == (args == null ? null : args[0]);
            return result;
        }

        private static boolean isStatementFactory(String name) {
            return name.equals("createStatement") || name.equals("prepareStatement") || name.equals("prepareCall");
        }
    }

    private static final class StatementHandler implements InvocationHandler {
        private final Statement delegate;
        private StatementHandler(Statement delegate) { this.delegate = delegate; }

        @Override public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
            if (!isExecution(method.getName())) return method.invoke(delegate, args);
            long started = System.nanoTime();
            try { return method.invoke(delegate, args); }
            finally { DatabaseOperationTracker.record(kind(method.getName()), System.nanoTime() - started); }
        }

        private static boolean isExecution(String name) {
            return name.equals("execute") || name.equals("executeQuery") || name.equals("executeUpdate")
                    || name.equals("executeLargeUpdate") || name.equals("executeBatch") || name.equals("executeLargeBatch");
        }

        private static String kind(String name) {
            if (name.contains("Query")) return "QUERY";
            if (name.contains("Batch")) return "BATCH";
            return "UPDATE";
        }
    }
}
