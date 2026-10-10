package com.catering.v2s.terminaldataserver.state;

import static org.assertj.core.api.Assertions.assertThat;

import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi.Outcome;
import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi.Verification;
import com.catering.v2s.terminaldataserver.protocol.TdsWireJsonConfiguration;
import java.sql.Connection;
import java.sql.Statement;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.postgresql.PGConnection;
import org.postgresql.PGNotification;
import org.postgresql.ds.PGSimpleDataSource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import tools.jackson.databind.ObjectMapper;

@Testcontainers
class TdsConnectionStateRepositoryPostgresIntegrationTest {
    private static final ObjectMapper JSON = TdsWireJsonConfiguration.createWireObjectMapper();

    @Container
    private static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    private DataSource dataSource;
    private JdbcTemplate jdbc;
    private TdsConnectionStateRepository repository;
    private TransactionTemplate transactions;
    private UUID workspaceUuid;
    private UUID terminalRef;

    @BeforeEach
    void prepareDatabase() {
        DriverManagerDataSource configuredDataSource =
                new DriverManagerDataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
        configuredDataSource.setDriverClassName("org.postgresql.Driver");
        dataSource = configuredDataSource;
        jdbc = new JdbcTemplate(dataSource);
        jdbc.execute("DROP SCHEMA IF EXISTS terminal_connection CASCADE");
        jdbc.execute("CREATE SCHEMA terminal_connection");
        jdbc.execute("CREATE SEQUENCE terminal_connection.session_sequence START WITH 1");
        jdbc.execute(
                """
                CREATE TABLE terminal_connection.latest_state (
                    workspace_uuid uuid NOT NULL,
                    group_workspace_key varchar(64) NOT NULL,
                    terminal_ref uuid NOT NULL,
                    node_id varchar(128) NOT NULL,
                    session_id varchar(128) NOT NULL,
                    session_sequence bigint NOT NULL,
                    connected_at_epoch_millis bigint NOT NULL,
                    disconnected_at_epoch_millis bigint NULL,
                    last_activity_at_epoch_millis bigint NOT NULL,
                    last_rtt_ms double precision NOT NULL,
                    close_reason varchar(48) NULL,
                    PRIMARY KEY (workspace_uuid, group_workspace_key, terminal_ref)
                )
                """);
        repository = new TdsConnectionStateRepository(jdbc);
        transactions = new TransactionTemplate(new DataSourceTransactionManager(dataSource));
        workspaceUuid = UUID.randomUUID();
        terminalRef = UUID.randomUUID();
    }

    @Test
    void rollbackRemovesLatestSessionAndSuppressesSessionOpenNotification() throws Exception {
        try (Connection listener = listenForSessionOpen()) {
            PGConnection pgListener = listener.unwrap(PGConnection.class);
            AtomicReference<TdsConnectionStateRepository.SessionIdentity> opened = new AtomicReference<>();

            transactions.executeWithoutResult(status -> {
                opened.set(repository
                        .open(verification(), "node-a", "session-rollback")
                        .orElseThrow());
                status.setRollbackOnly();
            });

            assertThat(opened.get()).isNotNull();
            assertThat(latestSessionCount()).isZero();
            assertThat(pgListener.getNotifications(500)).isEmpty();
        }
    }

    @Test
    void commitMakesLatestSessionVisibleWithItsSessionOpenNotification() throws Exception {
        try (Connection listener = listenForSessionOpen()) {
            PGConnection pgListener = listener.unwrap(PGConnection.class);
            AtomicReference<TdsConnectionStateRepository.SessionIdentity> opened = new AtomicReference<>();

            transactions.executeWithoutResult(status -> {
                opened.set(repository
                        .open(verification(), "node-a", "session-commit")
                        .orElseThrow());
                try {
                    assertThat(pgListener.getNotifications(100)).isEmpty();
                } catch (java.sql.SQLException failure) {
                    throw new IllegalStateException("TDS_POSTGRES_NOTIFICATION_PRECOMMIT_READ_FAILED", failure);
                }
            });

            PGNotification[] notifications = pgListener.getNotifications(5_000);
            assertThat(notifications).hasSize(1);
            assertThat(notifications[0].getName()).isEqualTo("terminal_binding_events");
            var payload = JSON.readTree(notifications[0].getParameter());
            assertThat(payload.path("kind").asString()).isEqualTo("SESSION_OPEN");
            assertThat(payload.path("terminalRef").asString()).isEqualTo(terminalRef.toString());
            assertThat(latestSessionCount()).isEqualTo(1);
            assertThat(jdbc.queryForMap(
                            "SELECT workspace_uuid, group_workspace_key, terminal_ref, node_id, session_id, "
                                    + "session_sequence FROM terminal_connection.latest_state WHERE terminal_ref=?",
                            terminalRef))
                    .containsEntry("workspace_uuid", workspaceUuid)
                    .containsEntry("group_workspace_key", "GROUP-A")
                    .containsEntry("terminal_ref", terminalRef)
                    .containsEntry("node_id", "node-a")
                    .containsEntry("session_id", "session-commit")
                    .containsEntry("session_sequence", opened.get().sequence());
        }
    }

    @Test
    void disconnectForAnOlderOpenedIdentityDoesNotOverwriteANewerSession() {
        TdsConnectionStateRepository.SessionIdentity older =
                repository.open(verification(), "node-a", "session-older").orElseThrow();
        TdsConnectionStateRepository.SessionIdentity newer =
                repository.open(verification(), "node-b", "session-newer").orElseThrow();

        assertThat(repository.writeDisconnect(older, "SERVER_ERROR")).isTrue();

        TdsConnectionStateRepository.CurrentSessionState current =
                repository.readCurrentSession(older).orElseThrow();
        assertThat(newer.sequence()).isGreaterThan(older.sequence());
        assertThat(current.sessionId()).isEqualTo("session-newer");
        assertThat(current.sequence()).isEqualTo(newer.sequence());
        assertThat(current.isOpen()).isTrue();
    }

    private Connection listenForSessionOpen() throws Exception {
        PGSimpleDataSource listenerDataSource = new PGSimpleDataSource();
        listenerDataSource.setURL(POSTGRES.getJdbcUrl());
        listenerDataSource.setUser(POSTGRES.getUsername());
        listenerDataSource.setPassword(POSTGRES.getPassword());
        Connection listener = listenerDataSource.getConnection();
        try (Statement statement = listener.createStatement()) {
            statement.execute("LISTEN terminal_binding_events");
        }
        return listener;
    }

    private long latestSessionCount() {
        return jdbc.queryForObject("SELECT count(*) FROM terminal_connection.latest_state", Long.class);
    }

    private Verification verification() {
        UUID storeRef = UUID.randomUUID();
        return new Verification(
                Outcome.VERIFIED, workspaceUuid, "GROUP-A", storeRef, terminalRef, 1, System.currentTimeMillis(),
                "device-postgres-test");
    }
}
