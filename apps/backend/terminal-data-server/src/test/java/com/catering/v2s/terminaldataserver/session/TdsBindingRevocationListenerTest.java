package com.catering.v2s.terminaldataserver.session;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.when;

import com.catering.v2s.terminaldataserver.protocol.TdsWireJsonConfiguration;
import com.catering.v2s.terminaldataserver.session.TdsBindingRevocationListener.Revocation;
import com.catering.v2s.terminaldataserver.session.TdsBindingRevocationListener.SessionOpened;
import com.catering.v2s.terminaldataserver.session.TdsBindingRevocationListener.TopicChangedWakeup;
import com.catering.v2s.terminaldataserver.state.TdsConnectionStateRepository;
import com.catering.v2s.terminaldataserver.state.TdsConnectionStateRepository.BindingKey;
import com.catering.v2s.terminaldataserver.state.TdsConnectionStateRepository.CurrentBinding;
import com.catering.v2s.terminaldataserver.state.TdsConnectionStateRepository.CurrentSessionState;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.postgresql.PGConnection;
import org.postgresql.PGNotification;
import reactor.core.scheduler.Schedulers;
import tools.jackson.databind.ObjectMapper;

class TdsBindingRevocationListenerTest {
    private static final UUID TERMINAL = UUID.fromString("95e948ef-2fe6-4b18-b6d5-509d023ea249");
    private final ObjectMapper objectMapper = TdsWireJsonConfiguration.createWireObjectMapper();

    @Test
    void parsesTheVersionedRevocationPayload() {
        assertThat(TdsBindingRevocationListener.parsePayload(
                        "{\"v\":1,\"kind\":\"BINDING_REVOKED\",\"terminalRef\":\"" + TERMINAL
                                + "\",\"revokedGeneration\":2}",
                        objectMapper))
                .isEqualTo(new Revocation(TERMINAL, 2));
        assertThat(TdsBindingRevocationListener.parsePayload(
                        "{\"v\":1,\"kind\":\"SESSION_OPEN\",\"terminalRef\":\"" + TERMINAL + "\"}", objectMapper))
                .isEqualTo(new SessionOpened(TERMINAL));
        UUID workspace = UUID.randomUUID();
        UUID owner = UUID.randomUUID();
        assertThat(TdsBindingRevocationListener.parsePayload(
                        "{\"v\":1,\"kind\":\"TOPIC_CHANGED\",\"workspaceUuid\":\"" + workspace
                                + "\",\"groupWorkspaceKey\":\"GROUP-1\",\"topicKey\":\"STORE\",\"ownerRef\":\""
                                + owner + "\",\"futureField\":true}",
                        objectMapper))
                .isEqualTo(new TopicChangedWakeup(workspace, "GROUP-1", "STORE", owner));
    }

    @Test
    void listenerLoopRunsOnItsOwnThreadInsteadOfTheDatabaseWorker() throws Exception {
        DataSource dataSource = mock(DataSource.class);
        CountDownLatch connectAttempted = new CountDownLatch(1);
        CountDownLatch stopped = new CountDownLatch(1);
        AtomicReference<String> listenerThreadName = new AtomicReference<>();
        when(dataSource.getConnection()).thenAnswer(invocation -> {
            listenerThreadName.set(Thread.currentThread().getName());
            connectAttempted.countDown();
            throw new SQLException("expected test connection failure");
        });
        TdsBindingRevocationListener listener = new TdsBindingRevocationListener(
                dataSource,
                mock(TdsConnectionStateRepository.class),
                mock(TdsTerminalSessionActors.class),
                new TdsListenerRecoveryGate("", "", ""),
                TdsWireJsonConfiguration.createWireObjectMapper(),
                Schedulers.immediate());

        try {
            listener.start();
            assertThat(connectAttempted.await(2, TimeUnit.SECONDS)).isTrue();
            listener.stop(stopped::countDown);
            assertThat(stopped.await(2, TimeUnit.SECONDS)).isTrue();
            assertThat(listenerThreadName.get())
                    .isEqualTo("tds-revocation-listener")
                    .isNotEqualTo("tds-db-worker");
        } finally {
            if (listener.isRunning()) {
                listener.stop(stopped::countDown);
                stopped.await(2, TimeUnit.SECONDS);
            }
        }
    }

    @Test
    void topicChangeWakeupDoesNotDisconnectTheSharedDatabaseListener() throws Exception {
        DataSource dataSource = mock(DataSource.class);
        Connection connection = mock(Connection.class);
        Statement statement = mock(Statement.class);
        PGConnection pgConnection = mock(PGConnection.class);
        PGNotification notification = mock(PGNotification.class);
        CountDownLatch resumedPolling = new CountDownLatch(1);
        CountDownLatch stopped = new CountDownLatch(1);
        AtomicInteger connectionCount = new AtomicInteger();
        AtomicBoolean firstNotification = new AtomicBoolean(true);

        when(dataSource.getConnection()).thenAnswer(invocation -> {
            connectionCount.incrementAndGet();
            return connection;
        });
        when(connection.createStatement()).thenReturn(statement);
        when(connection.unwrap(PGConnection.class)).thenReturn(pgConnection);
        when(connection.getAutoCommit()).thenReturn(true);
        when(pgConnection.getBackendPID()).thenReturn(73);
        when(notification.getName()).thenReturn("terminal_binding_events");
        when(notification.getParameter()).thenReturn("{\"v\":1,\"kind\":\"TOPIC_CHANGED\","
                + "\"workspaceUuid\":\"11111111-1111-4111-8111-111111111111\","
                + "\"groupWorkspaceKey\":\"GROUP-1\",\"topicKey\":\"STORE\","
                + "\"ownerRef\":\"22222222-2222-4222-8222-222222222222\"}");
        when(pgConnection.getNotifications(anyInt())).thenAnswer(invocation -> {
            if (firstNotification.compareAndSet(true, false)) return new PGNotification[] {notification};
            resumedPolling.countDown();
            try {
                Thread.sleep(10_000);
            } catch (InterruptedException stopping) {
                Thread.currentThread().interrupt();
            }
            return null;
        });

        TdsBindingRevocationListener listener = new TdsBindingRevocationListener(
                dataSource,
                mock(TdsConnectionStateRepository.class),
                mock(TdsTerminalSessionActors.class),
                new TdsListenerRecoveryGate("", "", ""),
                TdsWireJsonConfiguration.createWireObjectMapper(),
                Schedulers.immediate());

        try {
            listener.start();
            assertThat(resumedPolling.await(2, TimeUnit.SECONDS)).isTrue();
            assertThat(listener.isReady()).isTrue();
            assertThat(connectionCount.get()).isEqualTo(1);
        } finally {
            listener.stop(stopped::countDown);
            assertThat(stopped.await(2, TimeUnit.SECONDS)).isTrue();
        }
    }

    @Test
    void parsesAndDispatchesRevocationOnTheDedicatedListenerThread() throws Exception {
        DataSource dataSource = mock(DataSource.class);
        Connection connection = mock(Connection.class);
        Statement statement = mock(Statement.class);
        PGConnection pgConnection = mock(PGConnection.class);
        PGNotification notification = mock(PGNotification.class);
        TdsConnectionStateRepository repository = mock(TdsConnectionStateRepository.class);
        TdsTerminalSessionActors actors = mock(TdsTerminalSessionActors.class);
        CountDownLatch notificationDispatched = new CountDownLatch(1);
        CountDownLatch stopped = new CountDownLatch(1);
        AtomicBoolean notificationReturned = new AtomicBoolean();
        AtomicReference<Thread> parseThread = new AtomicReference<>();
        AtomicReference<Thread> dispatchThread = new AtomicReference<>();
        ObjectMapper mapper = spy(TdsWireJsonConfiguration.createWireObjectMapper());
        doAnswer(invocation -> {
                    parseThread.set(Thread.currentThread());
                    return invocation.callRealMethod();
                })
                .when(mapper)
                .readTree(anyString());

        when(dataSource.getConnection()).thenReturn(connection);
        when(connection.createStatement()).thenReturn(statement);
        when(connection.unwrap(PGConnection.class)).thenReturn(pgConnection);
        when(repository.readCurrentBindings(eq(connection), anyCollection())).thenReturn(Map.of());
        when(repository.readCurrentSessions(eq(connection), anyCollection())).thenReturn(Map.of());
        when(actors.trackedBindings()).thenReturn(List.of());
        when(notification.getName()).thenReturn("terminal_binding_events");
        when(notification.getParameter())
                .thenReturn("{\"v\":1,\"kind\":\"BINDING_REVOKED\",\"terminalRef\":\"" + TERMINAL
                        + "\",\"revokedGeneration\":2}");
        when(pgConnection.getNotifications(anyInt())).thenAnswer(invocation -> {
            if (notificationReturned.compareAndSet(false, true)) return new PGNotification[] {notification};
            try {
                Thread.sleep(10_000);
            } catch (InterruptedException stopping) {
                Thread.currentThread().interrupt();
            }
            return null;
        });
        doAnswer(invocation -> {
                    dispatchThread.set(Thread.currentThread());
                    notificationDispatched.countDown();
                    return null;
                })
                .when(actors)
                .revoked(TERMINAL, 2);

        TdsBindingRevocationListener listener = new TdsBindingRevocationListener(
                dataSource,
                repository,
                actors,
                new TdsListenerRecoveryGate("", "", ""),
                mapper,
                Schedulers.immediate());

        try {
            listener.start();
            assertThat(notificationDispatched.await(2, TimeUnit.SECONDS)).isTrue();
            listener.stop(stopped::countDown);
            assertThat(stopped.await(2, TimeUnit.SECONDS)).isTrue();
            assertThat(parseThread.get()).isSameAs(dispatchThread.get());
            assertThat(parseThread.get().getName()).isEqualTo("tds-revocation-listener");
        } finally {
            if (listener.isRunning()) {
                listener.stop(stopped::countDown);
                stopped.await(2, TimeUnit.SECONDS);
            }
        }
    }

    @Test
    void listenerFailureDiagnosticsExposeOnlyValidatedSqlState() {
        assertThat(TdsBindingRevocationListener.sqlState(new SQLException("private message", "08006")))
                .isEqualTo("08006");
        assertThat(TdsBindingRevocationListener.sqlState(new SQLException("private message", "bad-state")))
                .isEqualTo("NONE");
        assertThat(TdsBindingRevocationListener.sqlState(
                        new IllegalStateException("wrapper", new SQLException("private message", "57P01"))))
                .isEqualTo("57P01");
        assertThat(TdsBindingRevocationListener.sqlState(new IllegalStateException("private message")))
                .isEqualTo("NONE");
    }

    @Test
    void sessionOpenNotificationReconcilesBindingAndAuthoritativeSessionOnTheListenerThread() throws Exception {
        DataSource dataSource = mock(DataSource.class);
        Connection connection = mock(Connection.class);
        Statement statement = mock(Statement.class);
        PGConnection pgConnection = mock(PGConnection.class);
        PGNotification notification = mock(PGNotification.class);
        TdsConnectionStateRepository repository = mock(TdsConnectionStateRepository.class);
        TdsTerminalSessionActors actors = mock(TdsTerminalSessionActors.class);
        CountDownLatch notificationDispatched = new CountDownLatch(1);
        CountDownLatch stopped = new CountDownLatch(1);
        AtomicBoolean notificationReturned = new AtomicBoolean();
        BindingKey key = new BindingKey("GROUP-1", TERMINAL);
        CurrentBinding binding = new CurrentBinding(key, UUID.randomUUID(), 3L, "ACTIVE");
        CurrentSessionState session =
                new CurrentSessionState(key, binding.workspaceUuid(), "node-b", "session-b", 12L, null);
        when(dataSource.getConnection()).thenReturn(connection);
        when(connection.createStatement()).thenReturn(statement);
        when(connection.unwrap(PGConnection.class)).thenReturn(pgConnection);
        when(actors.trackedBindings()).thenReturn(List.of(), List.of(key));
        when(repository.readCurrentBindings(eq(connection), anyCollection()))
                .thenReturn(Map.of(), Map.of(key, binding));
        when(repository.readCurrentSessions(eq(connection), anyCollection()))
                .thenReturn(Map.of(), Map.of(key, session));
        when(notification.getName()).thenReturn("terminal_binding_events");
        when(notification.getParameter())
                .thenReturn("{\"v\":1,\"kind\":\"SESSION_OPEN\",\"terminalRef\":\"" + TERMINAL + "\"}");
        when(pgConnection.getNotifications(anyInt())).thenAnswer(invocation -> {
            if (notificationReturned.compareAndSet(false, true)) return new PGNotification[] {notification};
            try {
                Thread.sleep(10_000);
            } catch (InterruptedException stoppingListener) {
                Thread.currentThread().interrupt();
            }
            return null;
        });
        org.mockito.Mockito.doAnswer(invocation -> {
                    notificationDispatched.countDown();
                    return null;
                })
                .when(actors)
                .reconcileSession(session);

        TdsBindingRevocationListener listener = new TdsBindingRevocationListener(
                dataSource,
                repository,
                actors,
                new TdsListenerRecoveryGate("", "", ""),
                objectMapper,
                Schedulers.immediate());
        try {
            listener.start();
            assertThat(notificationDispatched.await(2, TimeUnit.SECONDS)).isTrue();
            listener.stop(stopped::countDown);
            assertThat(stopped.await(2, TimeUnit.SECONDS)).isTrue();
            org.mockito.Mockito.verify(actors).reconcile(binding);
            org.mockito.Mockito.verify(actors).reconcileSession(session);
            org.mockito.Mockito.verify(actors).reconcileTopicSubscriptions();
        } finally {
            if (listener.isRunning()) {
                listener.stop(stopped::countDown);
                stopped.await(2, TimeUnit.SECONDS);
            }
        }
    }

    @Test
    void rejectsMalformedOrOutOfContractPayloads() {
        List<String> invalidPayloads = List.of(
                "not-json",
                "{\"v\":2,\"kind\":\"BINDING_REVOKED\",\"terminalRef\":\"" + TERMINAL + "\",\"revokedGeneration\":2}",
                "{\"v\":1,\"kind\":\"BINDING_REVOKED\",\"terminalRef\":\"not-a-uuid\",\"revokedGeneration\":2}",
                "{\"v\":1,\"kind\":\"BINDING_REVOKED\",\"terminalRef\":\"" + TERMINAL + "\",\"revokedGeneration\":0}",
                "{\"v\":1,\"kind\":\"BINDING_REVOKED\",\"terminalRef\":\"" + TERMINAL
                        + "\",\"revokedGeneration\":2,\"extra\":true}",
                "{\"v\":1,\"kind\":\"SESSION_OPEN\",\"terminalRef\":\"" + TERMINAL + "\",\"extra\":true}",
                "{\"v\":1,\"kind\":\"UNKNOWN\",\"terminalRef\":\"" + TERMINAL + "\"}",
                "{\"v\":1,\"kind\":\"BINDING_REVOKED\",\"terminalRef\":\"" + TERMINAL
                        + "\",\"revokedGeneration\":2} {}");

        for (String payload : invalidPayloads) {
            assertThatThrownBy(() -> TdsBindingRevocationListener.parsePayload(payload, objectMapper))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessage("TDS_NOTIFICATION_PAYLOAD_INVALID");
        }
    }
}
