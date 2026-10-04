package com.catering.v2s.app.acceptance;

import java.security.SecureRandom;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.Base64;
import java.util.UUID;
import org.junit.jupiter.api.Assertions;
import org.testcontainers.containers.PostgreSQLContainer;

/** Provisions the narrowly scoped, per-process PostgreSQL identity used by the acceptance TDS JVM. */
final class TdsDatabasePrincipal implements AutoCloseable {
    private static final SecureRandom RANDOM = new SecureRandom();

    private final String jdbcUrl;
    private final String adminUsername;
    private final String adminPassword;
    private final String database;
    private final String username;
    private final String password;
    private final boolean terminalControlAvailable;
    private boolean closed;

    private TdsDatabasePrincipal(
            String jdbcUrl,
            String adminUsername,
            String adminPassword,
            String database,
            String username,
            String password,
            boolean terminalControlAvailable) {
        this.jdbcUrl = jdbcUrl;
        this.adminUsername = adminUsername;
        this.adminPassword = adminPassword;
        this.database = database;
        this.username = username;
        this.password = password;
        this.terminalControlAvailable = terminalControlAvailable;
    }

    static TdsDatabasePrincipal provision(PostgreSQLContainer<?> postgres, String instanceName) throws SQLException {
        String username = "tds_accept_" + instanceName.replace('-', '_') + "_" + UUID.randomUUID().toString().replace("-", "");
        byte[] secret = new byte[32];
        RANDOM.nextBytes(secret);
        String password = Base64.getUrlEncoder().withoutPadding().encodeToString(secret);
        java.util.Arrays.fill(secret, (byte) 0);
        String database;
        boolean terminalControlAvailable;
        try (Connection admin = DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
                Statement statement = admin.createStatement()) {
            try (var result = statement.executeQuery("SELECT current_database()")) {
                Assertions.assertTrue(result.next(), "TDS_DB_NAME_LOOKUP_FAILED");
                database = result.getString(1);
            }
            terminalControlAvailable = terminalControlAvailable(statement);
            statement.execute("CREATE ROLE " + username + " LOGIN PASSWORD '" + password + "'");
        }
        TdsDatabasePrincipal principal = new TdsDatabasePrincipal(
                postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword(), database, username, password,
                terminalControlAvailable);
        try {
            principal.grantRequiredAccess();
            principal.verifyAccessBoundary();
            return principal;
        } catch (SQLException | RuntimeException failure) {
            try {
                principal.close();
            } catch (SQLException cleanupFailure) {
                failure.addSuppressed(cleanupFailure);
            }
            throw failure;
        }
    }

    String username() {
        return username;
    }

    String password() {
        return password;
    }

    private void grantRequiredAccess() throws SQLException {
        try (Connection admin = DriverManager.getConnection(jdbcUrl, adminUsername, adminPassword);
                Statement statement = admin.createStatement()) {
            statement.execute("GRANT CONNECT ON DATABASE " + quoteIdentifier(database) + " TO " + username);
            for (String schema : new String[] {
                "platform_workspace", "store_terminal", "organization", "terminal_binding", "terminal_connection", "contract"
            }) {
                statement.execute("GRANT USAGE ON SCHEMA " + schema + " TO " + username);
            }
            statement.execute("GRANT SELECT (workspace_uuid, group_workspace_key, status) ON platform_workspace.group_workspace TO " + username);
            statement.execute("GRANT SELECT (workspace_uuid, group_workspace_key, terminal_ref, store_ref, status) ON store_terminal.terminal TO " + username);
            statement.execute("GRANT SELECT (workspace_uuid, group_workspace_key, id, status) ON organization.store TO " + username);
            statement.execute("GRANT SELECT (workspace_uuid, group_workspace_key, terminal_ref, generation, credential_digest, binding_status, bound_device_id, activated_at_epoch_millis) ON terminal_binding.latest_binding TO " + username);
            statement.execute("GRANT USAGE ON SEQUENCE terminal_connection.session_sequence TO " + username);
            statement.execute("GRANT SELECT, INSERT, UPDATE ON terminal_connection.latest_state TO " + username);
            statement.execute("GRANT SELECT ON organization.terminal_topic_snapshot, contract.terminal_topic_snapshot TO " + username);
            statement.execute("GRANT EXECUTE ON FUNCTION organization.read_terminal_topic_time(UUID, VARCHAR, UUID, VARCHAR, UUID) TO " + username);
            statement.execute("GRANT EXECUTE ON FUNCTION contract.read_terminal_topic_time(UUID, VARCHAR, UUID, VARCHAR, UUID) TO " + username);
            if (terminalControlAvailable) {
                statement.execute("GRANT USAGE ON SCHEMA terminal_control TO " + username);
                statement.execute("GRANT EXECUTE ON FUNCTION terminal_control.claim_online_operation(UUID, VARCHAR) TO " + username);
                statement.execute("GRANT EXECUTE ON FUNCTION terminal_control.accept_terminal_report(UUID, UUID, UUID, BIGINT, VARCHAR, VARCHAR, VARCHAR, TIMESTAMPTZ, JSONB, VARCHAR) TO " + username);
            }
        }
    }

    private void verifyAccessBoundary() throws SQLException {
        try (Connection tds = DriverManager.getConnection(jdbcUrl, username, password);
                Statement statement = tds.createStatement()) {
            statement.executeQuery("SELECT workspace_uuid, group_workspace_key, status FROM platform_workspace.group_workspace LIMIT 0").close();
            statement.executeQuery("SELECT workspace_uuid, group_workspace_key, terminal_ref, store_ref, status FROM store_terminal.terminal LIMIT 0").close();
            statement.executeQuery("SELECT workspace_uuid, group_workspace_key, id, status FROM organization.store LIMIT 0").close();
            statement.executeQuery("SELECT workspace_uuid, group_workspace_key, terminal_ref, generation, credential_digest, binding_status, bound_device_id, activated_at_epoch_millis FROM terminal_binding.latest_binding LIMIT 0").close();
            statement.executeQuery("SELECT nextval('terminal_connection.session_sequence')").close();
            statement.executeQuery("SELECT workspace_uuid, group_workspace_key, terminal_ref, node_id, session_id, session_sequence FROM terminal_connection.latest_state LIMIT 0").close();
            statement.executeQuery("SELECT workspace_uuid, group_workspace_key, store_ref, topic_key, topic_time_epoch_millis FROM organization.terminal_topic_snapshot LIMIT 0").close();
            statement.executeQuery("SELECT workspace_uuid, group_workspace_key, store_ref, topic_key, topic_time_epoch_millis FROM contract.terminal_topic_snapshot LIMIT 0").close();
            statement.executeQuery("SELECT count(*) FROM organization.read_terminal_topic_time(NULL::uuid, NULL::varchar, NULL::uuid, 'STORE', NULL::uuid)").close();
            statement.executeQuery("SELECT count(*) FROM contract.read_terminal_topic_time(NULL::uuid, NULL::varchar, NULL::uuid, 'CONTRACT', NULL::uuid)").close();
            if (terminalControlAvailable) {
                statement.executeQuery("SELECT count(*) FROM terminal_control.claim_online_operation(NULL::uuid, 'acceptance-node')").close();
                statement.executeQuery("SELECT accepted FROM terminal_control.accept_terminal_report(NULL::uuid, NULL::uuid, NULL::uuid, 1, 'acceptance-node', 'acceptance-session', 'RECEIVED', clock_timestamp(), NULL, NULL)").close();
            }
            try {
                statement.execute("UPDATE organization.store SET name = name WHERE false");
                Assertions.fail("TDS_OWNER_DML_MUST_BE_DENIED");
            } catch (SQLException denied) {
                Assertions.assertEquals("42501", denied.getSQLState(), "TDS_OWNER_DML_FAILURE_MUST_BE_PERMISSION_DENIED");
            }
            if (terminalControlAvailable) {
                for (String sql : new String[] {
                    "SELECT operation_id FROM terminal_control.online_operation LIMIT 0",
                    "INSERT INTO terminal_control.online_operation(operation_id) VALUES ('00000000-0000-0000-0000-000000000000')",
                    "UPDATE terminal_control.online_operation SET status = status WHERE false",
                    "DELETE FROM terminal_control.online_operation WHERE false"
                }) {
                    try {
                        statement.execute(sql);
                        Assertions.fail("TDS_TERMINAL_CONTROL_DIRECT_TABLE_ACCESS_MUST_BE_DENIED");
                    } catch (SQLException denied) {
                        Assertions.assertEquals("42501", denied.getSQLState(), "TDS_TERMINAL_CONTROL_ACCESS_FAILURE_MUST_BE_PERMISSION_DENIED");
                    }
                }
            }
        }
    }

    private static boolean terminalControlAvailable(Statement statement) throws SQLException {
        try (var result = statement.executeQuery("""
                SELECT to_regnamespace('terminal_control') IS NOT NULL,
                       to_regclass('terminal_control.online_operation') IS NOT NULL,
                       to_regprocedure('terminal_control.claim_online_operation(uuid,character varying)') IS NOT NULL,
                       to_regprocedure('terminal_control.accept_terminal_report(uuid,uuid,uuid,bigint,character varying,character varying,character varying,timestamp with time zone,jsonb,character varying)') IS NOT NULL
                """)) {
            Assertions.assertTrue(result.next(), "TDS_TERMINAL_CONTROL_CATALOG_LOOKUP_FAILED");
            boolean schema = result.getBoolean(1);
            boolean table = result.getBoolean(2);
            boolean claim = result.getBoolean(3);
            boolean report = result.getBoolean(4);
            if (!schema) {
                Assertions.assertFalse(table || claim || report, "TDS_TERMINAL_CONTROL_OBJECT_SET_INCONSISTENT");
                return false;
            }
            Assertions.assertTrue(table && claim && report, "TDS_TERMINAL_CONTROL_OBJECT_SET_INCOMPLETE");
            return true;
        }
    }

    @Override
    public void close() throws SQLException {
        if (closed) return;
        closed = true;
        try (Connection admin = DriverManager.getConnection(jdbcUrl, adminUsername, adminPassword);
                Statement statement = admin.createStatement()) {
            statement.execute("REVOKE CONNECT ON DATABASE " + quoteIdentifier(database) + " FROM " + username);
            statement.execute("DROP OWNED BY " + username);
            statement.execute("DROP ROLE " + username);
        }
    }

    private static String quoteIdentifier(String identifier) {
        return "\"" + identifier.replace("\"", "\"\"") + "\"";
    }
}
