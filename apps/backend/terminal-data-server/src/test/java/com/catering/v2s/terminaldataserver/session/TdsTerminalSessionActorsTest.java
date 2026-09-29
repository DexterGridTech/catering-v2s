package com.catering.v2s.terminaldataserver.session;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi.Outcome;
import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi.Verification;
import com.catering.v2s.terminaldataserver.config.TdsRuntimeSettings;
import com.catering.v2s.terminaldataserver.protocol.TerminalConnectionFrameCodec;
import com.catering.v2s.terminaldataserver.protocol.TerminalConnectionProtocol;
import com.catering.v2s.terminaldataserver.state.TdsConnectionStateRepository;
import com.catering.v2s.terminaldataserver.state.TdsConnectionStateRepository.BindingKey;
import com.catering.v2s.terminaldataserver.state.TdsConnectionStateRepository.CurrentBinding;
import com.catering.v2s.terminaldataserver.state.TdsConnectionStateRepository.SessionIdentity;
import com.catering.v2s.terminaldataserver.state.TdsConnectionStateWriter;
import com.catering.v2s.terminaldataserver.websocket.TdsWebSocketConnection;
import com.catering.v2s.terminaldataserver.websocket.UnauthenticatedConnectionLimiter;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.reactive.socket.CloseStatus;
import org.springframework.web.reactive.socket.WebSocketMessage;
import org.springframework.web.reactive.socket.WebSocketSession;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

class TdsTerminalSessionActorsTest {
    private static final UUID WORKSPACE = UUID.fromString("667d0c56-90a4-4bf4-b0fa-08d7f3b653ba");
    private static final UUID STORE = UUID.fromString("66abf394-3b77-487a-a344-5a8209dfd573");
    private static final UUID TERMINAL = UUID.fromString("95e948ef-2fe6-4b18-b6d5-509d023ea249");

    private final RecordingRepository repository = new RecordingRepository();
    private final TdsConnectionStateWriter stateWriter = mock(TdsConnectionStateWriter.class);
    private final TerminalConnectionFrameCodec codec = mock(TerminalConnectionFrameCodec.class);
    private final TerminalConnectionProtocol protocol = mock(TerminalConnectionProtocol.class);
    private final TdsRuntimeSettings settings = TdsRuntimeSettings.from(
            "2", "16", Duration.ofSeconds(30), Duration.ofSeconds(90), Duration.ofSeconds(15), Duration.ofSeconds(10));
    private final UnauthenticatedConnectionLimiter limiter = new UnauthenticatedConnectionLimiter(settings);
    private TdsTrackedSessionLimiter trackedSessionLimiter = new TdsTrackedSessionLimiter(16);
    private TdsTerminalSessionActors actors;

    @BeforeEach
    void setUp() {
        when(codec.sessionReady(anyString(), anyString(), any(Instant.class), anyLong(), anyLong()))
                .thenReturn("session-ready");
        when(protocol.applicationClose(anyString()))
                .thenAnswer(invocation -> new TerminalConnectionProtocol.Close(4000, invocation.getArgument(0)));
        actors = new TdsTerminalSessionActors(
                repository,
                stateWriter,
                settings,
                codec,
                trackedSessionLimiter,
                Schedulers.immediate(),
                Schedulers.immediate());
    }

    @Test
    void registersWithTheDatabaseIdentityAndKeepsTheActorForTheActiveSocket() {
        TdsWebSocketConnection connection = connection("session-1");
        begin("attempt-1", 1, connection);

        assertThat(register("attempt-1", 1)).isTrue();

        assertThat(connection.isAuthenticationReady()).isTrue();
        assertThat(connection.persistedSession()).isEqualTo(repository.opened.getFirst());
        assertThat(actors.trackedActorCount()).isEqualTo(1);
    }

    @Test
    void revocationObservedBeforeRegistrationRejectsWithoutOpeningConnectionState() {
        TdsWebSocketConnection connection = connection("session-1");
        begin("attempt-1", 1, connection);
        actors.revoked(TERMINAL, 1);

        assertThat(actors.register(TERMINAL, "attempt-1", verification(1)).block())
                .isFalse();

        assertThat(repository.opened).isEmpty();
        assertThat(connection.closeReasonOr("missing")).isEqualTo("ACTIVATION_CANCELLED");
        assertThat(actors.trackedActorCount()).isZero();
    }

    @Test
    void sameGenerationReplacementUsesSessionReplaced() {
        TdsWebSocketConnection previous = connection("session-1");
        begin("attempt-1", 1, previous);
        assertThat(register("attempt-1", 1)).isTrue();

        TdsWebSocketConnection replacement = connection("session-2");
        begin("attempt-2", 1, replacement);
        assertThat(register("attempt-2", 1)).isTrue();

        assertThat(previous.closeReasonOr("missing")).isEqualTo("SESSION_REPLACED");
        assertThat(replacement.isAuthenticationReady()).isTrue();
        verify(stateWriter)
                .queueDisconnect(eq(repository.opened.getFirst()), eq("SESSION_REPLACED"), any(Runnable.class));
    }

    @Test
    void newerVerifiedGenerationClosesTheRevokedSessionAsActivationCancelled() {
        TdsWebSocketConnection previous = connection("session-1");
        begin("attempt-1", 1, previous);
        assertThat(register("attempt-1", 1)).isTrue();

        TdsWebSocketConnection replacement = connection("session-2");
        begin("attempt-2", 2, replacement);
        assertThat(register("attempt-2", 2)).isTrue();

        assertThat(previous.closeReasonOr("missing")).isEqualTo("ACTIVATION_CANCELLED");
        assertThat(replacement.isAuthenticationReady()).isTrue();
        verify(stateWriter)
                .queueDisconnect(eq(repository.opened.getFirst()), eq("ACTIVATION_CANCELLED"), any(Runnable.class));
    }

    @Test
    void aRejectedReplacementDoesNotDisturbTheActiveSession() {
        TdsWebSocketConnection active = connection("session-1");
        begin("attempt-1", 1, active);
        assertThat(register("attempt-1", 1)).isTrue();

        TdsWebSocketConnection rejected = connection("session-2");
        begin("attempt-2", 2, rejected);
        actors.reject(TERMINAL, "attempt-2", "CREDENTIAL_INVALID").block();

        assertThat(active.isOpen()).isTrue();
        assertThat(active.isAuthenticationReady()).isTrue();
        assertThat(rejected.closeReasonOr("missing")).isEqualTo("CREDENTIAL_INVALID");
        verify(stateWriter, never()).queueDisconnect(any(), anyString(), any(Runnable.class));
    }

    @Test
    void trackedCapacityRejectsOnlyCandidateAndReleasesPermitAfterDisconnectPersistence() {
        trackedSessionLimiter = new TdsTrackedSessionLimiter(1);
        actors = new TdsTerminalSessionActors(
                repository,
                stateWriter,
                settings,
                codec,
                trackedSessionLimiter,
                Schedulers.immediate(),
                Schedulers.immediate());

        TdsWebSocketConnection active = connection("session-active");
        begin("active", 1, active);
        assertThat(register("active", 1)).isTrue();

        TdsWebSocketConnection candidate = connection("session-candidate");
        begin("candidate", 2, candidate);
        assertThat(register("candidate", 2)).isFalse();

        assertThat(candidate.closeReasonOr("missing")).isEqualTo("NODE_BUSY");
        assertThat(active.isOpen()).isTrue();
        assertThat(active.isAuthenticationReady()).isTrue();
        assertThat(repository.opened).hasSize(1);
        verify(stateWriter, never()).queueDisconnect(any(), anyString(), any(Runnable.class));

        actors.revoked(TERMINAL, 1);
        ArgumentCaptor<Runnable> persisted = ArgumentCaptor.forClass(Runnable.class);
        verify(stateWriter)
                .queueDisconnect(eq(repository.opened.getFirst()), eq("ACTIVATION_CANCELLED"), persisted.capture());
        assertThat(trackedSessionLimiter.tryAcquire()).isNull();
        persisted.getValue().run();

        TdsWebSocketConnection next = connection("session-next");
        begin("next", 2, next);
        assertThat(register("next", 2)).isTrue();
        assertThat(next.isAuthenticationReady()).isTrue();
    }

    @Test
    void releasesTrackedPermitWhenOpeningSessionStateFails() {
        trackedSessionLimiter = new TdsTrackedSessionLimiter(1);
        actors = new TdsTerminalSessionActors(
                repository,
                stateWriter,
                settings,
                codec,
                trackedSessionLimiter,
                Schedulers.immediate(),
                Schedulers.immediate());
        repository.failOpen = true;
        TdsWebSocketConnection connection = connection("session-open-fails");
        begin("open-fails", 1, connection);

        assertThatThrownBy(() -> register("open-fails", 1)).isInstanceOf(IllegalStateException.class);

        assertThat(connection.closeReasonOr("missing")).isEqualTo("SERVER_ERROR");
        assertThat(repository.opened).isEmpty();
        verify(stateWriter, never()).queueDisconnect(any(), anyString(), any(Runnable.class));
        TdsTrackedSessionLimiter.Permit released = trackedSessionLimiter.tryAcquire();
        assertThat(released).isNotNull();
        released.close();
    }

    @Test
    void keepsTrackedPermitUntilOpenedSessionDisconnectIsPersistedAfterCodecFailure() {
        trackedSessionLimiter = new TdsTrackedSessionLimiter(1);
        actors = new TdsTerminalSessionActors(
                repository,
                stateWriter,
                settings,
                codec,
                trackedSessionLimiter,
                Schedulers.immediate(),
                Schedulers.immediate());
        when(codec.sessionReady(anyString(), anyString(), any(Instant.class), anyLong(), anyLong()))
                .thenThrow(new IllegalStateException("codec failed"));
        TdsWebSocketConnection connection = connection("session-codec-fails");
        begin("codec-fails", 1, connection);

        assertThatThrownBy(() -> register("codec-fails", 1)).isInstanceOf(IllegalStateException.class);

        assertThat(connection.closeReasonOr("missing")).isEqualTo("SERVER_ERROR");
        ArgumentCaptor<Runnable> persisted = ArgumentCaptor.forClass(Runnable.class);
        verify(stateWriter).queueDisconnect(eq(repository.opened.getFirst()), eq("SERVER_ERROR"), persisted.capture());
        assertThat(trackedSessionLimiter.tryAcquire()).isNull();
        persisted.getValue().run();
        TdsTrackedSessionLimiter.Permit released = trackedSessionLimiter.tryAcquire();
        assertThat(released).isNotNull();
        released.close();
    }

    @Test
    void aSocketClosedBeforeRegistrationDoesNotWriteLatestState() {
        AtomicBoolean open = new AtomicBoolean(true);
        TdsWebSocketConnection connection = connection("session-1", open);
        begin("attempt-1", 1, connection);
        assertThat(actors.recordVerification(TERMINAL, "attempt-1", verification(1))
                        .block())
                .isTrue();
        open.set(false);

        assertThat(actors.register(TERMINAL, "attempt-1", verification(1)).block())
                .isFalse();

        assertThat(repository.opened).isEmpty();
        assertThat(actors.trackedActorCount()).isZero();
    }

    @Test
    void recoveryClosesOnlyWhenTheSameDatabaseIdentityEstablishesRevocation() {
        TdsWebSocketConnection active = connection("session-1");
        begin("attempt-1", 1, active);
        assertThat(register("attempt-1", 1)).isTrue();
        BindingKey key = new BindingKey("GROUP-1", TERMINAL);

        actors.reconcile(new CurrentBinding(key, WORKSPACE, 1L, "ACTIVE"));
        assertThat(active.isOpen()).isTrue();

        actors.reconcile(new CurrentBinding(key, UUID.randomUUID(), 2L, "ENDED"));
        actors.reconcile(new CurrentBinding(key, null, null, null));
        assertThat(active.isOpen()).isTrue();
        verify(stateWriter, never()).queueDisconnect(any(), anyString(), any(Runnable.class));

        actors.reconcile(new CurrentBinding(key, WORKSPACE, 2L, "ACTIVE"));

        assertThat(active.closeReasonOr("missing")).isEqualTo("ACTIVATION_CANCELLED");
        verify(stateWriter)
                .queueDisconnect(eq(repository.opened.getFirst()), eq("ACTIVATION_CANCELLED"), any(Runnable.class));
    }

    @Test
    void unexpectedPeerCloseRecordsNetworkErrorForTheSameSession() {
        TdsWebSocketConnection active = connection("session-network-close");
        begin("attempt-network-close", 1, active);
        assertThat(register("attempt-network-close", 1)).isTrue();

        actors.connectionClosed(TERMINAL, "attempt-network-close", active);

        verify(stateWriter).queueDisconnect(eq(repository.opened.getFirst()), eq("NETWORK_ERROR"), any(Runnable.class));
    }

    @Test
    void connectionClosedFallsBackInlineWhenDatabaseSchedulerRejectsTheTask() {
        AtomicBoolean rejectTasks = new AtomicBoolean();
        var rejectingScheduler = Schedulers.fromExecutor(command -> {
            if (rejectTasks.get()) throw new RejectedExecutionException("test scheduler rejection");
            command.run();
        });
        actors = new TdsTerminalSessionActors(
                repository,
                stateWriter,
                settings,
                codec,
                trackedSessionLimiter,
                rejectingScheduler,
                Schedulers.immediate());
        try {
            TdsWebSocketConnection active = connection("session-scheduler-rejects-close");
            begin("attempt-scheduler-rejects-close", 1, active);
            assertThat(register("attempt-scheduler-rejects-close", 1)).isTrue();
            rejectTasks.set(true);

            actors.connectionClosed(TERMINAL, "attempt-scheduler-rejects-close", active);

            ArgumentCaptor<Runnable> persisted = ArgumentCaptor.forClass(Runnable.class);
            verify(stateWriter)
                    .queueDisconnect(eq(repository.opened.getFirst()), eq("NETWORK_ERROR"), persisted.capture());
            persisted.getValue().run();
            TdsTrackedSessionLimiter.Permit released = trackedSessionLimiter.tryAcquire();
            assertThat(released).isNotNull();
            released.close();
        } finally {
            rejectingScheduler.dispose();
        }
    }

    @Test
    void recoveryReconcilesPendingVerifiedAttemptsBeforeRegistration() {
        TdsWebSocketConnection pending = connection("session-1");
        begin("attempt-1", 1, pending);
        Verification currentVerification = verification(1);
        assertThat(actors.recordVerification(TERMINAL, "attempt-1", currentVerification)
                        .block())
                .isTrue();

        assertThat(actors.trackedBindings()).containsExactly(new BindingKey("GROUP-1", TERMINAL));
        actors.reconcile(new CurrentBinding(new BindingKey("GROUP-1", TERMINAL), WORKSPACE, 1L, "ENDED"));

        assertThat(pending.closeReasonOr("missing")).isEqualTo("ACTIVATION_CANCELLED");
        assertThat(actors.register(TERMINAL, "attempt-1", currentVerification).block())
                .isFalse();
        assertThat(repository.opened).isEmpty();
    }

    @Test
    void recoveryBeforeCredentialResultRejectsOnlyWhenItProvesSameIdentityWasRevoked() {
        TdsWebSocketConnection pending = connection("session-1");
        begin("attempt-1", 1, pending);
        actors.reconcile(new CurrentBinding(new BindingKey("GROUP-1", TERMINAL), WORKSPACE, 2L, "ACTIVE"));

        assertThat(actors.recordVerification(TERMINAL, "attempt-1", verification(1))
                        .block())
                .isFalse();
        assertThat(pending.closeReasonOr("missing")).isEqualTo("ACTIVATION_CANCELLED");
        assertThat(actors.register(TERMINAL, "attempt-1", verification(1)).block())
                .isFalse();
        assertThat(repository.opened).isEmpty();
    }

    @Test
    void recoveryBeforeCredentialResultAllowsMissingLowerOrDifferentIdentityToRegister() {
        BindingKey key = new BindingKey("GROUP-1", TERMINAL);
        TdsWebSocketConnection missing = connection("missing");
        begin("missing", 1, missing);
        actors.reconcile(new CurrentBinding(key, null, null, null));
        assertThat(missing.isOpen()).isTrue();
        assertThat(actors.recordVerification(TERMINAL, "missing", verification(1))
                        .block())
                .isTrue();
        assertThat(missing.isOpen()).isTrue();
        assertThat(actors.register(TERMINAL, "missing", verification(1)).block())
                .isTrue();

        TdsWebSocketConnection lower = connection("lower");
        begin("lower", 2, lower);
        actors.reconcile(new CurrentBinding(key, WORKSPACE, 1L, "ACTIVE"));
        assertThat(actors.recordVerification(TERMINAL, "lower", verification(2)).block())
                .isTrue();
        assertThat(lower.isOpen()).isTrue();
        assertThat(actors.register(TERMINAL, "lower", verification(2)).block()).isTrue();

        TdsWebSocketConnection different = connection("different");
        begin("different", 3, different);
        actors.reconcile(new CurrentBinding(key, UUID.randomUUID(), 4L, "ENDED"));
        assertThat(actors.recordVerification(TERMINAL, "different", verification(3))
                        .block())
                .isTrue();
        assertThat(different.isOpen()).isTrue();
        assertThat(actors.register(TERMINAL, "different", verification(3)).block())
                .isTrue();

        assertThat(missing.closeReasonOr("missing")).isEqualTo("ACTIVATION_CANCELLED");
        assertThat(lower.closeReasonOr("missing")).isEqualTo("ACTIVATION_CANCELLED");
        assertThat(different.isAuthenticationReady()).isTrue();
        assertThat(repository.opened).hasSize(3);
    }

    @Test
    void drainRejectsNewAndPendingConnectionsThenRedirectsActiveSessions() {
        TdsWebSocketConnection active = connection("session-active");
        begin("active", 1, active);
        assertThat(register("active", 1)).isTrue();
        active.outboundMessages().next().block();

        TdsWebSocketConnection pending = connection("session-pending");
        begin("pending", 2, pending);
        actors.refuseNewConnections();

        assertThat(actors.isDraining()).isTrue();
        assertThat(active.isOpen()).isTrue();
        assertThat(pending.isOpen()).isTrue();

        TdsWebSocketConnection arriving = connection("session-arriving");
        assertThat(actors.beginAttempt(TERMINAL, "GROUP-1", "arriving", 3, arriving)
                        .block())
                .isFalse();
        assertThat(arriving.closeReasonOr("missing")).isEqualTo("REDIRECT_TO_NEXT_NODE");

        assertThat(actors.beginDrain().block()).isTrue();
        assertThat(pending.closeReasonOr("missing")).isEqualTo("REDIRECT_TO_NEXT_NODE");

        actors.finishDrain().block();

        assertThat(active.closeReasonOr("missing")).isEqualTo("REDIRECT_TO_NEXT_NODE");
        assertThat(actors.trackedActorCount()).isZero();
        verify(stateWriter)
                .queueDisconnect(eq(repository.opened.getFirst()), eq("REDIRECT_TO_NEXT_NODE"), any(Runnable.class));
    }

    private TdsWebSocketConnection connection(String sessionId) {
        return connection(sessionId, new AtomicBoolean(true));
    }

    private TdsWebSocketConnection connection(String sessionId, AtomicBoolean open) {
        WebSocketSession session = mock(WebSocketSession.class);
        when(session.getId()).thenReturn(sessionId);
        when(session.isOpen()).thenAnswer(ignored -> open.get());
        when(session.close(any(CloseStatus.class))).thenReturn(Mono.empty());
        when(session.textMessage(anyString())).thenReturn(mock(WebSocketMessage.class));
        return new TdsWebSocketConnection(session, protocol, limiter.tryAcquire(), Schedulers.immediate());
    }

    private static Verification verification(long generation) {
        return new Verification(
                Outcome.VERIFIED, WORKSPACE, "GROUP-1", STORE, TERMINAL, generation, 1_798_387_200_000L);
    }

    private void begin(String attemptId, long generation, TdsWebSocketConnection connection) {
        assertThat(actors.beginAttempt(TERMINAL, "GROUP-1", attemptId, generation, connection)
                        .block())
                .isTrue();
    }

    private boolean register(String attemptId, long generation) {
        Verification currentVerification = verification(generation);
        assertThat(actors.recordVerification(TERMINAL, attemptId, currentVerification)
                        .block())
                .isTrue();
        return Boolean.TRUE.equals(
                actors.register(TERMINAL, attemptId, currentVerification).block());
    }

    private static final class RecordingRepository extends TdsConnectionStateRepository {
        private final List<SessionIdentity> opened = new ArrayList<>();
        private final AtomicLong sequence = new AtomicLong();
        private boolean failOpen;

        private RecordingRepository() {
            super(mock(JdbcTemplate.class));
        }

        @Override
        public SessionIdentity open(Verification verification, String nodeId, String sessionId) {
            if (failOpen) throw new IllegalStateException("database unavailable");
            SessionIdentity identity = new SessionIdentity(
                    verification.workspaceUuid(),
                    verification.groupWorkspaceKey(),
                    verification.terminalRef(),
                    nodeId,
                    sessionId,
                    sequence.incrementAndGet(),
                    Instant.parse("2026-09-26T00:00:00Z"));
            opened.add(identity);
            return identity;
        }
    }
}
