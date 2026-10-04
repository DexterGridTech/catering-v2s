package com.catering.v2s.terminaldataserver.session;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi.Outcome;
import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi.Verification;
import com.catering.v2s.terminaldataserver.config.TdsRuntimeSettings;
import com.catering.v2s.terminaldataserver.history.TdsConnectionHistoryWriter;
import com.catering.v2s.terminaldataserver.protocol.TerminalConnectionFrameCodec;
import com.catering.v2s.terminaldataserver.protocol.TerminalConnectionProtocol;
import com.catering.v2s.terminaldataserver.protocol.TerminalConnectionFrameCodec.TopicAccept;
import com.catering.v2s.terminaldataserver.protocol.TerminalConnectionFrameCodec.TopicSubscribe;
import com.catering.v2s.terminaldataserver.protocol.TerminalConnectionFrameCodec.TopicUnsubscribe;
import com.catering.v2s.terminaldataserver.state.TdsConnectionStateRepository;
import com.catering.v2s.terminaldataserver.state.TdsConnectionStateRepository.BindingKey;
import com.catering.v2s.terminaldataserver.state.TdsConnectionStateRepository.CurrentBinding;
import com.catering.v2s.terminaldataserver.state.TdsConnectionStateRepository.CurrentSessionState;
import com.catering.v2s.terminaldataserver.state.TdsConnectionStateRepository.SessionIdentity;
import com.catering.v2s.terminaldataserver.state.TdsConnectionStateWriter;
import com.catering.v2s.terminaldataserver.state.TdsTerminalTopicRepository;
import com.catering.v2s.terminaldataserver.websocket.TdsWebSocketConnection;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.OptionalLong;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.TimeUnit;
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
    private final TdsConnectionHistoryWriter historyWriter = mock(TdsConnectionHistoryWriter.class);
    private final TerminalConnectionFrameCodec codec = mock(TerminalConnectionFrameCodec.class);
    private final TerminalConnectionProtocol protocol = mock(TerminalConnectionProtocol.class);
    private final TdsTerminalTopicRepository topicRepository = mock(TdsTerminalTopicRepository.class);
    private final TdsRuntimeSettings settings = TdsRuntimeSettings.from(
            "2", "16", Duration.ofSeconds(30), Duration.ofSeconds(90), Duration.ofSeconds(15), Duration.ofSeconds(10));
    private final TdsConnectionCapacityLimiter limiter = new TdsConnectionCapacityLimiter(2, 16);
    private TdsConnectionCapacityLimiter trackedSessionLimiter = new TdsConnectionCapacityLimiter(2, 16);
    private TdsTerminalSessionActors actors;

    @BeforeEach
    void setUp() {
        when(codec.sessionReady(anyString(), anyString(), any(Instant.class), anyLong(), anyLong()))
                .thenReturn("session-ready");
        when(protocol.applicationClose(anyString()))
                .thenAnswer(invocation -> new TerminalConnectionProtocol.Close(4000, invocation.getArgument(0)));
        actors = new TdsTerminalSessionActors(
                repository,
                topicRepository,
                stateWriter,
                historyWriter,
                settings,
                codec,
                trackedSessionLimiter,
                new SessionRegistrationGate("", "", "", Schedulers.immediate()),
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
    void revocationDoesNotWaitForSynchronousSessionOpenHoldingTheActorMonitor() throws Exception {
        TdsWebSocketConnection connection = connection("session-revoked-during-open");
        begin("attempt-revoked-during-open", 1, connection);
        Verification currentVerification = verification(1);
        assertThat(actors.recordVerification(TERMINAL, "attempt-revoked-during-open", currentVerification)
                        .block())
                .isTrue();
        repository.openEntered = new CountDownLatch(1);
        repository.openRelease = new CountDownLatch(1);

        CompletableFuture<Boolean> registration = CompletableFuture.supplyAsync(
                () -> actors.register(TERMINAL, "attempt-revoked-during-open", currentVerification)
                        .block());
        try {
            assertThat(repository.openEntered.await(2, TimeUnit.SECONDS)).isTrue();
            CompletableFuture<Void> revocation = CompletableFuture.runAsync(() -> actors.revoked(TERMINAL, 1));
            revocation.get(1, TimeUnit.SECONDS);
        } finally {
            repository.openRelease.countDown();
        }

        assertThat(registration.get(2, TimeUnit.SECONDS)).isFalse();
        assertThat(connection.closeReasonOr("missing")).isEqualTo("ACTIVATION_CANCELLED");
        verify(stateWriter)
                .queueDisconnect(eq(repository.opened.getFirst()), eq("ACTIVATION_CANCELLED"), any(Runnable.class));
    }

    @Test
    void inFlightRegistrationRetainsThePerTerminalActorAndLockAfterRevocation() throws Exception {
        TdsWebSocketConnection oldConnection = connection("session-in-flight-old");
        begin("attempt-in-flight-old", 1, oldConnection);
        Verification oldVerification = verification(1);
        assertThat(actors.recordVerification(TERMINAL, "attempt-in-flight-old", oldVerification)
                        .block())
                .isTrue();

        repository.blockedSessionId = "session-in-flight-old";
        repository.blockedOpenEntered = new CountDownLatch(1);
        repository.blockedOpenRelease = new CountDownLatch(1);
        repository.concurrentOpenEntered = new CountDownLatch(1);
        CompletableFuture<Boolean> oldRegistration =
                CompletableFuture.supplyAsync(() -> actors.register(TERMINAL, "attempt-in-flight-old", oldVerification)
                        .block());
        CompletableFuture<Boolean> replacementRegistration = null;
        boolean actorRetainedAfterRevocation = false;
        boolean replacementReachedRepositoryBeforeRelease = false;

        try {
            assertThat(repository.blockedOpenEntered.await(2, TimeUnit.SECONDS)).isTrue();
            actors.revoked(TERMINAL, 1);
            actorRetainedAfterRevocation = actors.trackedActorCount() == 1;

            TdsWebSocketConnection replacement = connection("session-in-flight-new");
            begin("attempt-in-flight-new", 2, replacement);
            Verification replacementVerification = verification(2);
            assertThat(actors.recordVerification(TERMINAL, "attempt-in-flight-new", replacementVerification)
                            .block())
                    .isTrue();
            CountDownLatch replacementCallStarted = new CountDownLatch(1);
            replacementRegistration = CompletableFuture.supplyAsync(() -> {
                replacementCallStarted.countDown();
                return actors.register(TERMINAL, "attempt-in-flight-new", replacementVerification)
                        .block();
            });
            assertThat(replacementCallStarted.await(2, TimeUnit.SECONDS)).isTrue();
            replacementReachedRepositoryBeforeRelease =
                    repository.concurrentOpenEntered.await(100, TimeUnit.MILLISECONDS);
        } finally {
            repository.blockedOpenRelease.countDown();
        }

        assertThat(oldRegistration.get(2, TimeUnit.SECONDS)).isFalse();
        assertThat(replacementRegistration).isNotNull();
        assertThat(replacementRegistration.get(2, TimeUnit.SECONDS)).isTrue();
        assertThat(actorRetainedAfterRevocation).isTrue();
        assertThat(replacementReachedRepositoryBeforeRelease).isFalse();
        assertThat(repository.opened)
                .extracting(SessionIdentity::sessionId)
                .containsExactly("session-in-flight-old", "session-in-flight-new");
        assertThat(repository.opened.get(0).sequence())
                .isLessThan(repository.opened.get(1).sequence());
        verify(stateWriter)
                .queueDisconnect(eq(repository.opened.get(0)), eq("ACTIVATION_CANCELLED"), any(Runnable.class));
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
    void aLaterCommittedSessionObservedBeforeLocalRegistrationRejectsTheOlderCandidate() throws Exception {
        RecordingRepository sharedRepository = new RecordingRepository();
        TdsTerminalSessionActors nodeA = newActors(sharedRepository);
        TdsTerminalSessionActors nodeB = newActors(sharedRepository);
        TdsWebSocketConnection candidateA = connection("node-a-session");
        TdsWebSocketConnection candidateB = connection("node-b-session");
        assertThat(nodeA.beginAttempt(TERMINAL, "GROUP-1", "node-a-attempt", 1, candidateA)
                        .block())
                .isTrue();
        assertThat(nodeA.recordVerification(TERMINAL, "node-a-attempt", verification(1))
                        .block())
                .isTrue();
        assertThat(nodeB.beginAttempt(TERMINAL, "GROUP-1", "node-b-attempt", 1, candidateB)
                        .block())
                .isTrue();
        assertThat(nodeB.recordVerification(TERMINAL, "node-b-attempt", verification(1))
                        .block())
                .isTrue();

        sharedRepository.blockReadSessionId = "node-a-session";
        sharedRepository.currentReadEntered = new CountDownLatch(1);
        sharedRepository.currentReadRelease = new CountDownLatch(1);
        CompletableFuture<Boolean> registrationA = CompletableFuture.supplyAsync(() ->
                nodeA.register(TERMINAL, "node-a-attempt", verification(1)).block());
        assertThat(sharedRepository.currentReadEntered.await(2, TimeUnit.SECONDS))
                .isTrue();

        assertThat(nodeB.register(TERMINAL, "node-b-attempt", verification(1)).block())
                .isTrue();
        CurrentSessionState latestFromB = sharedRepository.currentSession(candidateB.sessionId());
        assertThat(latestFromB).isNotNull();
        nodeA.reconcileSession(latestFromB);
        sharedRepository.currentReadRelease.countDown();

        assertThat(registrationA.get(2, TimeUnit.SECONDS)).isFalse();
        assertThat(candidateA.isAuthenticationReady()).isFalse();
        assertThat(candidateA.closeReasonOr("missing")).isEqualTo("SESSION_REPLACED");
        assertThat(candidateB.isAuthenticationReady()).isTrue();
        assertThat(nodeA.trackedActorCount()).isZero();
        assertThat(nodeB.trackedActorCount()).isEqualTo(1);
    }

    @Test
    void aSessionRegisteredBeforeTheNewerCommitIsClosedByTheLaterAuthoritativeRead() {
        RecordingRepository sharedRepository = new RecordingRepository();
        TdsTerminalSessionActors nodeA = newActors(sharedRepository);
        TdsTerminalSessionActors nodeB = newActors(sharedRepository);
        TdsWebSocketConnection candidateA = connection("node-a-first");
        beginWith(nodeA, "node-a-first-attempt", 1, candidateA);
        assertThat(registerWith(nodeA, "node-a-first-attempt", 1)).isTrue();

        TdsWebSocketConnection candidateB = connection("node-b-later");
        beginWith(nodeB, "node-b-later-attempt", 1, candidateB);
        assertThat(registerWith(nodeB, "node-b-later-attempt", 1)).isTrue();

        nodeA.reconcileSession(sharedRepository.currentSession(candidateB.sessionId()));

        assertThat(candidateA.closeReasonOr("missing")).isEqualTo("SESSION_REPLACED");
        assertThat(candidateB.isAuthenticationReady()).isTrue();
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
    void candidateThatDidNotBecomeTheLatestDatabaseSessionLeavesTheExistingSessionUntouched() {
        TdsWebSocketConnection active = connection("session-active");
        begin("active", 1, active);
        assertThat(register("active", 1)).isTrue();

        repository.noOpenSessionId = "session-superseded-before-write";
        TdsWebSocketConnection candidate = connection("session-superseded-before-write");
        begin("superseded", 1, candidate);
        assertThat(actors.recordVerification(TERMINAL, "superseded", verification(1))
                        .block())
                .isTrue();

        assertThat(actors.register(TERMINAL, "superseded", verification(1)).block())
                .isFalse();

        assertThat(active.isOpen()).isTrue();
        assertThat(active.isAuthenticationReady()).isTrue();
        assertThat(candidate.closeReasonOr("missing")).isEqualTo("SESSION_REPLACED");
        verify(stateWriter, never()).queueDisconnect(any(), anyString(), any(Runnable.class));
    }

    @Test
    void trackedCapacityRejectsOnlyCandidateAndReleasesPermitAfterDisconnectPersistence() {
        trackedSessionLimiter = new TdsConnectionCapacityLimiter(2, 1);
        actors = new TdsTerminalSessionActors(
                repository,
                topicRepository,
                stateWriter,
                historyWriter,
                settings,
                codec,
                trackedSessionLimiter,
                new SessionRegistrationGate("", "", "", Schedulers.immediate()),
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
        assertThat(trackedSessionLimiter.tryAcquireTrackedSession()).isNull();
        persisted.getValue().run();

        TdsWebSocketConnection next = connection("session-next");
        begin("next", 2, next);
        assertThat(register("next", 2)).isTrue();
        assertThat(next.isAuthenticationReady()).isTrue();
    }

    @Test
    void releasesTrackedPermitWhenOpeningSessionStateFails() {
        trackedSessionLimiter = new TdsConnectionCapacityLimiter(2, 1);
        actors = new TdsTerminalSessionActors(
                repository,
                topicRepository,
                stateWriter,
                historyWriter,
                settings,
                codec,
                trackedSessionLimiter,
                new SessionRegistrationGate("", "", "", Schedulers.immediate()),
                Schedulers.immediate(),
                Schedulers.immediate());
        repository.failOpen = true;
        TdsWebSocketConnection connection = connection("session-open-fails");
        begin("open-fails", 1, connection);

        assertThatThrownBy(() -> register("open-fails", 1)).isInstanceOf(IllegalStateException.class);

        assertThat(connection.closeReasonOr("missing")).isEqualTo("SERVER_ERROR");
        assertThat(repository.opened).isEmpty();
        verify(stateWriter, never()).queueDisconnect(any(), anyString(), any(Runnable.class));
        TdsConnectionCapacityLimiter.Permit released = trackedSessionLimiter.tryAcquireTrackedSession();
        assertThat(released).isNotNull();
        released.close();
    }

    @Test
    void keepsTrackedPermitUntilOpenedSessionDisconnectIsPersistedAfterCodecFailure() {
        trackedSessionLimiter = new TdsConnectionCapacityLimiter(2, 1);
        actors = new TdsTerminalSessionActors(
                repository,
                topicRepository,
                stateWriter,
                historyWriter,
                settings,
                codec,
                trackedSessionLimiter,
                new SessionRegistrationGate("", "", "", Schedulers.immediate()),
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
        assertThat(trackedSessionLimiter.tryAcquireTrackedSession()).isNull();
        persisted.getValue().run();
        TdsConnectionCapacityLimiter.Permit released = trackedSessionLimiter.tryAcquireTrackedSession();
        assertThat(released).isNotNull();
        released.close();
    }

    @Test
    void queuesDisconnectAfterCommittedCandidateReadbackFailsWithoutClosingPreviousSession() {
        trackedSessionLimiter = new TdsConnectionCapacityLimiter(2, 2);
        actors = new TdsTerminalSessionActors(
                repository,
                topicRepository,
                stateWriter,
                historyWriter,
                settings,
                codec,
                trackedSessionLimiter,
                new SessionRegistrationGate("", "", "", Schedulers.immediate()),
                Schedulers.immediate(),
                Schedulers.immediate());

        TdsWebSocketConnection previous = connection("session-previous");
        begin("previous", 1, previous);
        assertThat(register("previous", 1)).isTrue();

        TdsWebSocketConnection candidate = connection("session-readback-fails");
        repository.failReadSessionId = "session-readback-fails";
        begin("candidate-readback-fails", 2, candidate);
        Verification candidateVerification = verification(2);
        assertThat(actors.recordVerification(TERMINAL, "candidate-readback-fails", candidateVerification)
                        .block())
                .isTrue();

        assertThatThrownBy(() -> actors.register(TERMINAL, "candidate-readback-fails", candidateVerification).block())
                .isInstanceOf(IllegalStateException.class);

        ArgumentCaptor<Runnable> persisted = ArgumentCaptor.forClass(Runnable.class);
        SessionIdentity candidateIdentity = repository.opened.getLast();
        verify(stateWriter).queueDisconnect(eq(candidateIdentity), eq("SERVER_ERROR"), persisted.capture());
        assertThat(candidate.closeReasonOr("missing")).isEqualTo("SERVER_ERROR");
        assertThat(candidate.isAuthenticationReady()).isFalse();
        assertThat(previous.isOpen()).isTrue();
        assertThat(previous.isAuthenticationReady()).isTrue();
        verify(historyWriter).recordConnected(any());
        assertThat(repository.latest.values())
                .extracting(CurrentSessionState::sessionId)
                .contains("session-readback-fails");
        assertThat(trackedSessionLimiter.tryAcquireTrackedSession()).isNull();

        persisted.getValue().run();

        TdsConnectionCapacityLimiter.Permit released = trackedSessionLimiter.tryAcquireTrackedSession();
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
                topicRepository,
                stateWriter,
                historyWriter,
                settings,
                codec,
                trackedSessionLimiter,
                new SessionRegistrationGate("", "", "", Schedulers.immediate()),
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
            TdsConnectionCapacityLimiter.Permit released = trackedSessionLimiter.tryAcquireTrackedSession();
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

    @Test
    void activeTopicSubscriptionReplaysLatestAndCoalescesSameMillisecondOnlineChanges() {
        List<String> frames = new ArrayList<>();
        List<String> notificationIds = new ArrayList<>();
        when(codec.topicChanged(anyString(), anyString(), anyString(), any(), anyLong())).thenAnswer(invocation -> {
            String notificationId = invocation.getArgument(0);
            notificationIds.add(notificationId);
            return "{\"type\":\"TOPIC_CHANGED\",\"notificationId\":\"" + notificationId + "\"}";
        });
        when(topicRepository.readTime(eq(WORKSPACE), eq("GROUP-1"), eq(STORE), eq("STORE"), eq(STORE)))
                .thenReturn(OptionalLong.of(100));
        TdsWebSocketConnection connection = connection("topic-session", frames);
        begin("topic-attempt", 1, connection);
        assertThat(register("topic-attempt", 1)).isTrue();
        frames.clear();

        UUID subscriptionId = UUID.randomUUID();
        UUID otherStoreRef = UUID.randomUUID();
        assertThat(actors.subscribeTopic(
                        TERMINAL, connection, new TopicSubscribe(UUID.randomUUID(), "STORE", otherStoreRef, 100)))
                .isFalse();
        assertThat(actors.subscribeTopic(
                        TERMINAL, connection, new TopicSubscribe(subscriptionId, "STORE", STORE, 100)))
                .isTrue();
        assertThat(frames).isEmpty();

        TdsTerminalSessionActors.TopicChange change =
                new TdsTerminalSessionActors.TopicChange(WORKSPACE, "GROUP-1", "STORE", STORE);
        actors.topicChanged(new TdsTerminalSessionActors.TopicChange(
                UUID.randomUUID(), "GROUP-1", "STORE", STORE));
        actors.topicChanged(new TdsTerminalSessionActors.TopicChange(
                WORKSPACE, "OTHER-GROUP", "STORE", STORE));
        actors.topicChanged(new TdsTerminalSessionActors.TopicChange(
                WORKSPACE, "GROUP-1", "STORE", otherStoreRef));
        assertThat(frames).isEmpty();
        actors.topicChanged(change);
        assertThat(frames).hasSize(1);
        actors.topicChanged(change);
        assertThat(frames).hasSize(1);

        actors.acceptTopic(
                TERMINAL,
                connection,
                new TopicAccept(UUID.fromString(notificationIds.getFirst()), subscriptionId, "STORE", STORE, 100));
        assertThat(frames).hasSize(2);
        assertThat(notificationIds).hasSize(2);

        actors.unsubscribeTopic(TERMINAL, connection, new TopicUnsubscribe(subscriptionId, "STORE", STORE));
        actors.topicChanged(change);
        assertThat(frames).hasSize(2);
    }

    @Test
    void listenerReconciliationRereadsActiveTopicAndSendsOnlyNewerOwnerTime() {
        List<String> frames = new ArrayList<>();
        List<String> notificationIds = new ArrayList<>();
        when(codec.topicChanged(anyString(), anyString(), anyString(), any(), anyLong())).thenAnswer(invocation -> {
            String notificationId = invocation.getArgument(0);
            notificationIds.add(notificationId);
            return "{\"type\":\"TOPIC_CHANGED\",\"notificationId\":\"" + notificationId + "\"}";
        });
        when(topicRepository.readTime(WORKSPACE, "GROUP-1", STORE, "STORE", STORE))
                .thenReturn(OptionalLong.of(100), OptionalLong.of(101), OptionalLong.of(101));
        TdsWebSocketConnection connection = connection("topic-reconcile-session", frames);
        begin("topic-reconcile-attempt", 1, connection);
        assertThat(register("topic-reconcile-attempt", 1)).isTrue();
        frames.clear();
        UUID subscriptionId = UUID.randomUUID();
        assertThat(actors.subscribeTopic(
                        TERMINAL, connection, new TopicSubscribe(subscriptionId, "STORE", STORE, 100)))
                .isTrue();
        assertThat(frames).isEmpty();

        actors.reconcileTopicSubscriptions();
        assertThat(frames).hasSize(1);
        actors.acceptTopic(
                TERMINAL,
                connection,
                new TopicAccept(UUID.fromString(notificationIds.getFirst()), subscriptionId, "STORE", STORE, 101));
        assertThat(frames).hasSize(1);
        verify(topicRepository, times(3)).readTime(WORKSPACE, "GROUP-1", STORE, "STORE", STORE);
    }

    @Test
    void retainsTwelveActiveOwnerSubscriptionsAndReleasesThemOnUnsubscribeAndDisconnect() {
        List<String> frames = new ArrayList<>();
        List<String> notificationIds = new ArrayList<>();
        when(codec.topicChanged(anyString(), anyString(), anyString(), any(), anyLong()))
                .thenAnswer(invocation -> {
                    String notificationId = invocation.getArgument(0);
                    notificationIds.add(notificationId);
                    return "topic-change-" + notificationId;
                });
        when(topicRepository.readTime(eq(WORKSPACE), eq("GROUP-1"), eq(STORE), eq("CONTRACT"), any(UUID.class)))
                .thenReturn(OptionalLong.of(100));
        TdsWebSocketConnection connection = connection("topic-many-session", frames);
        begin("topic-many-attempt", 1, connection);
        assertThat(register("topic-many-attempt", 1)).isTrue();
        frames.clear();

        List<UUID> ownerRefs = new ArrayList<>();
        List<UUID> subscriptionIds = new ArrayList<>();
        for (int index = 0; index < 12; index++) {
            UUID ownerRef = UUID.randomUUID();
            UUID subscriptionId = UUID.randomUUID();
            ownerRefs.add(ownerRef);
            subscriptionIds.add(subscriptionId);
            assertThat(actors.subscribeTopic(
                            TERMINAL,
                            connection,
                            new TopicSubscribe(subscriptionId, "CONTRACT", ownerRef, 100)))
                    .isTrue();
            actors.topicChanged(new TdsTerminalSessionActors.TopicChange(
                    WORKSPACE, "GROUP-1", "CONTRACT", ownerRef));
            actors.acceptTopic(
                    TERMINAL,
                    connection,
                    new TopicAccept(UUID.fromString(notificationIds.getLast()), subscriptionId, "CONTRACT", ownerRef, 100));
        }
        assertThat(frames).hasSize(12);

        UUID firstOwner = ownerRefs.getFirst();
        UUID firstSubscription = subscriptionIds.getFirst();
        actors.unsubscribeTopic(
                TERMINAL, connection, new TopicUnsubscribe(firstSubscription, "CONTRACT", firstOwner));
        actors.topicChanged(new TdsTerminalSessionActors.TopicChange(
                WORKSPACE, "GROUP-1", "CONTRACT", firstOwner));
        assertThat(frames).hasSize(12);

        UUID secondOwner = ownerRefs.get(1);
        actors.topicChanged(new TdsTerminalSessionActors.TopicChange(
                WORKSPACE, "GROUP-1", "CONTRACT", secondOwner));
        assertThat(frames).hasSize(13);

        actors.connectionClosed(TERMINAL, "topic-many-attempt", connection);
        UUID thirdOwner = ownerRefs.get(2);
        actors.topicChanged(new TdsTerminalSessionActors.TopicChange(
                WORKSPACE, "GROUP-1", "CONTRACT", thirdOwner));
        assertThat(frames).hasSize(13);
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
        return new TdsWebSocketConnection(
                session, protocol, limiter.tryAcquireUnauthenticated(), Schedulers.immediate());
    }

    private TdsWebSocketConnection connection(String sessionId, List<String> outboundFrames) {
        WebSocketSession session = mock(WebSocketSession.class);
        when(session.getId()).thenReturn(sessionId);
        when(session.isOpen()).thenReturn(true);
        when(session.close(any(CloseStatus.class))).thenReturn(Mono.empty());
        when(session.textMessage(anyString())).thenAnswer(invocation -> {
            outboundFrames.add(invocation.getArgument(0));
            return mock(WebSocketMessage.class);
        });
        TdsWebSocketConnection connection =
                new TdsWebSocketConnection(session, protocol, limiter.tryAcquireUnauthenticated(), Schedulers.immediate());
        connection.outboundMessages().subscribe(ignored -> {});
        return connection;
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

    private boolean registerWith(TdsTerminalSessionActors target, String attemptId, long generation) {
        Verification currentVerification = verification(generation);
        assertThat(target.recordVerification(TERMINAL, attemptId, currentVerification)
                        .block())
                .isTrue();
        return Boolean.TRUE.equals(
                target.register(TERMINAL, attemptId, currentVerification).block());
    }

    private void beginWith(
            TdsTerminalSessionActors target, String attemptId, long generation, TdsWebSocketConnection connection) {
        assertThat(target.beginAttempt(TERMINAL, "GROUP-1", attemptId, generation, connection)
                        .block())
                .isTrue();
    }

    private TdsTerminalSessionActors newActors(RecordingRepository sourceRepository) {
        return new TdsTerminalSessionActors(
                sourceRepository,
                topicRepository,
                stateWriter,
                historyWriter,
                settings,
                codec,
                new TdsConnectionCapacityLimiter(2, 16),
                new SessionRegistrationGate("", "", "", Schedulers.immediate()),
                Schedulers.immediate(),
                Schedulers.immediate());
    }

    private static final class RecordingRepository extends TdsConnectionStateRepository {
        private final List<SessionIdentity> opened = Collections.synchronizedList(new ArrayList<>());
        private final AtomicLong sequence = new AtomicLong();
        private final Map<BindingKey, CurrentSessionState> latest = new java.util.concurrent.ConcurrentHashMap<>();
        private boolean failOpen;
        private volatile String failReadSessionId;
        private volatile String noOpenSessionId;
        private volatile CountDownLatch openEntered;
        private volatile CountDownLatch openRelease;
        private volatile String blockedSessionId;
        private volatile CountDownLatch blockedOpenEntered;
        private volatile CountDownLatch blockedOpenRelease;
        private volatile CountDownLatch concurrentOpenEntered;
        private volatile String blockReadSessionId;
        private volatile CountDownLatch currentReadEntered;
        private volatile CountDownLatch currentReadRelease;

        private RecordingRepository() {
            super(mock(JdbcTemplate.class));
        }

        @Override
        public Optional<SessionIdentity> open(Verification verification, String nodeId, String sessionId) {
            if (failOpen) throw new IllegalStateException("database unavailable");
            if (sessionId.equals(noOpenSessionId)) return Optional.empty();
            if (sessionId.equals(blockedSessionId)) {
                CountDownLatch entered = blockedOpenEntered;
                CountDownLatch release = blockedOpenRelease;
                if (entered != null && release != null) {
                    entered.countDown();
                    try {
                        if (!release.await(2, TimeUnit.SECONDS)) {
                            throw new IllegalStateException("test blocked open timed out");
                        }
                    } catch (InterruptedException interrupted) {
                        Thread.currentThread().interrupt();
                        throw new IllegalStateException("test blocked open interrupted", interrupted);
                    }
                }
            } else if (blockedSessionId != null && concurrentOpenEntered != null) {
                concurrentOpenEntered.countDown();
            }
            CountDownLatch entered = openEntered;
            CountDownLatch release = openRelease;
            if (entered != null && release != null) {
                entered.countDown();
                try {
                    if (!release.await(2, TimeUnit.SECONDS)) throw new IllegalStateException("test open timed out");
                } catch (InterruptedException interrupted) {
                    Thread.currentThread().interrupt();
                    throw new IllegalStateException("test open interrupted", interrupted);
                }
            }
            SessionIdentity identity = new SessionIdentity(
                    verification.workspaceUuid(),
                    verification.groupWorkspaceKey(),
                    verification.terminalRef(),
                    nodeId,
                    sessionId,
                    sequence.incrementAndGet(),
                    Instant.parse("2026-09-26T00:00:00Z"));
            opened.add(identity);
            BindingKey key = new BindingKey(identity.groupWorkspaceKey(), identity.terminalRef());
            latest.put(
                    key,
                    new CurrentSessionState(
                            key,
                            identity.workspaceUuid(),
                            identity.nodeId(),
                            identity.sessionId(),
                            identity.sequence(),
                            null));
            return Optional.of(identity);
        }

        @Override
        public Optional<CurrentSessionState> readCurrentSession(SessionIdentity identity) {
            CurrentSessionState observed =
                    latest.get(new BindingKey(identity.groupWorkspaceKey(), identity.terminalRef()));
            if (identity.sessionId().equals(failReadSessionId)) {
                throw new IllegalStateException("database readback unavailable");
            }
            if (identity.sessionId().equals(blockReadSessionId)) {
                CountDownLatch entered = currentReadEntered;
                CountDownLatch release = currentReadRelease;
                if (entered != null && release != null) {
                    entered.countDown();
                    try {
                        if (!release.await(2, TimeUnit.SECONDS)) {
                            throw new IllegalStateException("test current-session read timed out");
                        }
                    } catch (InterruptedException interrupted) {
                        Thread.currentThread().interrupt();
                        throw new IllegalStateException("test current-session read interrupted", interrupted);
                    }
                }
            }
            return Optional.ofNullable(observed);
        }

        private CurrentSessionState currentSession(String sessionId) {
            return latest.values().stream()
                    .filter(state -> state.sessionId().equals(sessionId))
                    .findFirst()
                    .orElse(null);
        }
    }
}
