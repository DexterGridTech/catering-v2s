package database;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Instant;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Disposable PostgreSQL proof. It migrates from zero and never touches the DEV datasource.
 */
@Testcontainers
class DatabaseBoundariesTest {
    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    private static Flyway flyway;

    @BeforeAll
    static void migrateFromZero() throws SQLException {
        flyway = Flyway.configure()
            .dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
            .schemas("public")
            .defaultSchema("public")
            .locations("classpath:db/migration")
            .cleanDisabled(false)
            .load();
        var result = flyway.migrate();
        assertEquals(flyway.info().all().length, result.migrationsExecuted);
        try (Connection connection = adminConnection(); Statement statement = connection.createStatement()) {
            statement.execute("CREATE ROLE database_reader LOGIN PASSWORD 'reader'");
            statement.execute("GRANT USAGE ON SCHEMA platform_workspace, organization TO database_reader");
            statement.execute("GRANT SELECT ON ALL TABLES IN SCHEMA platform_workspace, organization TO database_reader");
        }
    }

    @Test
    void compositeForeignKeyRejectsAnotherWorkspaceId() throws Exception {
        long workspaceA = workspace("workspace-a", "Workspace A");
        long workspaceB = workspace("workspace-b", "Workspace B");
        SQLException exception = assertThrows(SQLException.class, () -> {
            try (Connection connection = adminConnection(); PreparedStatement statement = connection.prepareStatement(
                "INSERT INTO organization.commercial_group (group_workspace_key, group_workspace_id, commercial_group_code, commercial_group_name, created_by_platform_subject, commercial_group_uuid, created_at_epoch_millis) VALUES (?, ?, ?, ?, ?, ?, ?)"
            )) {
                statement.setString(1, "workspace-a");
                statement.setLong(2, workspaceB);
                statement.setString(3, "bad-reference");
                statement.setString(4, "Bad reference");
                statement.setString(5, "platform-admin:test");
                statement.setObject(6, UUID.randomUUID());
                statement.setLong(7, Instant.now().toEpochMilli());
                statement.executeUpdate();
            }
        });
        assertEquals("23503", exception.getSQLState());
        assertTrue(workspaceA > 0);
    }

    @Test
    void staleCasUpdateChangesNoRows() throws Exception {
        long workspace = workspace("workspace-cas", "Workspace CAS");
        try (Connection connection = adminConnection(); PreparedStatement statement = connection.prepareStatement(
            "UPDATE platform_workspace.group_workspace SET status = 'DISABLED', revision = revision + 1 WHERE id = ? AND revision = ?"
        )) {
            statement.setLong(1, workspace);
            statement.setLong(2, 99);
            assertEquals(0, statement.executeUpdate());
            statement.setLong(2, 1);
            assertEquals(1, statement.executeUpdate());
        }
    }

    @Test
    void r5RemovesPlatformOnlyRlsAndKeepsAuthorizationInApplicationLayer() throws Exception {
        workspace("workspace-rls", "Workspace RLS");
        try (Connection connection = readerConnection()) {
            assertTrue(count(connection, "SELECT count(*) FROM platform_workspace.group_workspace") > 0);
        }
    }

    @AfterAll
    static void cleanTemporaryDatabase() throws SQLException {
        flyway.clean();
        try (Connection connection = adminConnection(); Statement statement = connection.createStatement()) {
            statement.execute("DROP SCHEMA IF EXISTS contract CASCADE");
            statement.execute("DROP SCHEMA IF EXISTS workspace_iam CASCADE");
            statement.execute("DROP SCHEMA IF EXISTS extension CASCADE");
            statement.execute("DROP SCHEMA IF EXISTS platform_asset CASCADE");
            statement.execute("DROP SCHEMA IF EXISTS platform_iam CASCADE");
            statement.execute("DROP SCHEMA IF EXISTS organization CASCADE");
            statement.execute("DROP SCHEMA IF EXISTS platform_workspace CASCADE");
        }
        try (Connection connection = adminConnection(); ResultSet tables = connection.getMetaData().getTables(null, "platform_workspace", "group_workspace", null)) {
            assertFalse(tables.next(), "Flyway clean must remove the temporary schema facts");
        }
    }

    private static long workspace(String key, String name) throws SQLException {
        try (Connection connection = adminConnection(); PreparedStatement statement = connection.prepareStatement(
            "INSERT INTO platform_workspace.group_workspace (group_workspace_key, name, status, workspace_uuid, name_normalized, operations_title, created_at_epoch_millis, updated_at_epoch_millis, status_changed_at_epoch_millis) VALUES (?, ?, 'ENABLED', ?, ?, ?, ?, ?, ?) RETURNING id"
        )) {
            long now = Instant.now().toEpochMilli();
            statement.setString(1, key);
            statement.setString(2, name);
            statement.setObject(3, UUID.randomUUID());
            statement.setString(4, name.toLowerCase());
            statement.setString(5, name);
            statement.setLong(6, now);
            statement.setLong(7, now);
            statement.setLong(8, now);
            try (ResultSet result = statement.executeQuery()) {
                assertTrue(result.next());
                return result.getLong(1);
            }
        }
    }

    private static int count(Connection connection, String query) throws SQLException {
        try (Statement statement = connection.createStatement(); ResultSet result = statement.executeQuery(query)) {
            assertTrue(result.next());
            return result.getInt(1);
        }
    }

    private static Connection adminConnection() throws SQLException {
        return DriverManager.getConnection(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
    }

    private static Connection readerConnection() throws SQLException {
        return DriverManager.getConnection(POSTGRES.getJdbcUrl(), "database_reader", "reader");
    }
}
