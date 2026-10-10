package com.catering.v2s.terminaldataserver.session;

import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi.Outcome;
import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi.Verification;
import com.catering.v2s.terminaldataserver.config.TdsRuntimeSettings;
import com.catering.v2s.terminaldataserver.history.TdsConnectionHistoryEvent;
import com.catering.v2s.terminaldataserver.history.TdsConnectionHistoryWriter;
import com.catering.v2s.terminaldataserver.observability.TdsAsyncLog;
import com.catering.v2s.terminaldataserver.protocol.TerminalConnectionFrameCodec;
import com.catering.v2s.terminaldataserver.protocol.TerminalConnectionFrameCodec.TopicAccept;
import com.catering.v2s.terminaldataserver.protocol.TerminalConnectionFrameCodec.TopicSubscribe;
import com.catering.v2s.terminaldataserver.protocol.TerminalConnectionFrameCodec.TopicUnsubscribe;
import com.catering.v2s.terminaldataserver.remote.TdsTerminalControlRepository.ClaimedOperation;
import com.catering.v2s.terminaldataserver.state.TdsConnectionStateRepository;
import com.catering.v2s.terminaldataserver.state.TdsConnectionStateRepository.BindingKey;
import com.catering.v2s.terminaldataserver.state.TdsConnectionStateRepository.CurrentBinding;
import com.catering.v2s.terminaldataserver.state.TdsConnectionStateRepository.CurrentSessionState;
import com.catering.v2s.terminaldataserver.state.TdsConnectionStateRepository.SessionIdentity;
import com.catering.v2s.terminaldataserver.state.TdsConnectionStateWriter;
import com.catering.v2s.terminaldataserver.state.TdsTerminalTopicRepository;
import com.catering.v2s.terminaldataserver.websocket.TdsWebSocketConnection;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.OptionalLong;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Scheduler;

/** Serializes verified registration, socket close and revocation by terminal identity. */
@Component
public final class TdsTerminalSessionActors {
    private static final Logger LOGGER = LoggerFactory.getLogger(TdsTerminalSessionActors.class);

    private final TdsConnectionStateRepository repository;
    private final TdsTerminalTopicRepository topicRepository;
    private final TdsConnectionStateWriter stateWriter;
    private final TdsConnectionHistoryWriter historyWriter;
    private final TdsRuntimeSettings settings;
    private final TerminalConnectionFrameCodec codec;
    private final TdsConnectionCapacityLimiter capacityLimiter;
    private final SessionRegistrationGate registrationGate;
    private final Scheduler jdbcScheduler;
    private final Scheduler logScheduler;
    private final ConcurrentHashMap<UUID, TerminalActor> actors = new ConcurrentHashMap<>();
    private final Object admissionMonitor = new Object();
    private final AtomicBoolean draining = new AtomicBoolean();
    private final AtomicBoolean drainStarted = new AtomicBoolean();

    public TdsTerminalSessionActors(
            TdsConnectionStateRepository repository,
            TdsTerminalTopicRepository topicRepository,
            TdsConnectionStateWriter stateWriter,
            TdsConnectionHistoryWriter historyWriter,
            TdsRuntimeSettings settings,
            TerminalConnectionFrameCodec codec,
            TdsConnectionCapacityLimiter capacityLimiter,
            SessionRegistrationGate registrationGate,
            @Qualifier("tds-db-worker") Scheduler jdbcScheduler,
            @Qualifier("tds-log-worker") Scheduler logScheduler) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.topicRepository = Objects.requireNonNull(topicRepository, "topicRepository");
        this.stateWriter = Objects.requireNonNull(stateWriter, "stateWriter");
        this.historyWriter = Objects.requireNonNull(historyWriter, "historyWriter");
        this.settings = Objects.requireNonNull(settings, "settings");
        this.codec = Objects.requireNonNull(codec, "codec");
        this.capacityLimiter = Objects.requireNonNull(capacityLimiter, "capacityLimiter");
        this.registrationGate = Objects.requireNonNull(registrationGate, "registrationGate");
        this.jdbcScheduler = Objects.requireNonNull(jdbcScheduler, "jdbcScheduler");
        this.logScheduler = Objects.requireNonNull(logScheduler, "logScheduler");
    }

    public Mono<Boolean> beginAttempt(
            UUID terminalRef,
            String groupWorkspaceKey,
            String attemptId,
            long generation,
            TdsWebSocketConnection connection) {
        return Mono.fromCallable(() -> {
                    synchronized (admissionMonitor) {
                        if (draining.get()) {
                            connection.close("REDIRECT_TO_NEXT_NODE");
                            return false;
                        }
                        TerminalActor actor = actors.compute(terminalRef, (key, current) -> {
                            TerminalActor selected = current == null ? new TerminalActor(key) : current;
                            selected.begin(groupWorkspaceKey, attemptId, generation, connection);
                            return selected;
                        });
                        return actor != null;
                    }
                })
                .subscribeOn(jdbcScheduler);
    }

    public boolean isDraining() {
        return draining.get();
    }

    /** Refuses new attempts without closing attempts already admitted. */
    public void refuseNewConnections() {
        synchronized (admissionMonitor) {
            draining.set(true);
        }
    }

    public Mono<Boolean> beginDrain() {
        List<Mono<Void>> pendingCloses = new ArrayList<>();
        AtomicBoolean hasActiveSessions = new AtomicBoolean();
        synchronized (admissionMonitor) {
            draining.set(true);
            if (!drainStarted.compareAndSet(false, true)) return Mono.just(false);
            for (UUID terminalRef : List.copyOf(actors.keySet())) {
                actors.computeIfPresent(terminalRef, (key, actor) -> {
                    if (actor.beginDrain(pendingCloses)) hasActiveSessions.set(true);
                    return actor.isIdle() ? null : actor;
                });
            }
        }
        return Mono.when(pendingCloses).thenReturn(hasActiveSessions.get());
    }

    public Mono<Void> finishDrain() {
        if (!draining.get()) return Mono.empty();
        List<Mono<Void>> activeCloses = new ArrayList<>();
        for (UUID terminalRef : List.copyOf(actors.keySet())) {
            actors.computeIfPresent(terminalRef, (key, actor) -> {
                activeCloses.add(actor.finishDrain());
                return actor.isIdle() ? null : actor;
            });
        }
        return Mono.when(activeCloses);
    }

    public Mono<Boolean> recordVerification(UUID terminalRef, String attemptId, Verification verification) {
        return Mono.fromCallable(() -> {
                    TerminalActor actor = actors.get(terminalRef);
                    return actor != null && actor.recordVerification(attemptId, verification);
                })
                .subscribeOn(jdbcScheduler);
    }

    public Mono<Boolean> register(UUID terminalRef, String attemptId, Verification verification) {
        return Mono.fromCallable(() -> {
                    TerminalActor actor = actors.computeIfPresent(terminalRef, (key, current) -> {
                        current.registrationStarted();
                        return current;
                    });
                    if (actor == null) return false;
                    try {
                        return actor.register(attemptId, verification);
                    } finally {
                        actor.registrationFinished();
                        removeIfIdle(terminalRef, actor);
                    }
                })
                .subscribeOn(jdbcScheduler);
    }

    public Mono<Void> reject(UUID terminalRef, String attemptId, String closeReason) {
        return Mono.<Void>fromRunnable(() -> {
                    actors.computeIfPresent(terminalRef, (key, actor) -> {
                        actor.reject(attemptId, closeReason);
                        return actor.isIdle() ? null : actor;
                    });
                })
                .subscribeOn(jdbcScheduler);
    }

    public void connectionClosed(UUID terminalRef, String attemptId, TdsWebSocketConnection connection) {
        Runnable close = () -> actors.computeIfPresent(terminalRef, (key, actor) -> {
            actor.connectionClosed(attemptId, connection);
            return actor.isIdle() ? null : actor;
        });
        try {
            jdbcScheduler.schedule(close);
        } catch (RejectedExecutionException rejected) {
            TdsAsyncLog.enqueue(
                    logScheduler,
                    () -> LOGGER.warn(
                            "event=tds_connection_closed_schedule_rejected connectionId={} fallback=inline",
                            connection.connectionId()));
            close.run();
        }
    }

    public void revoked(UUID terminalRef, long revokedGeneration) {
        if (revokedGeneration < 1) return;
        actors.computeIfPresent(terminalRef, (key, actor) -> {
            actor.revoke(revokedGeneration);
            return actor.isIdle() ? null : actor;
        });
    }

    public List<BindingKey> trackedBindings() {
        Set<BindingKey> keys = new HashSet<>();
        actors.values().forEach(actor -> keys.addAll(actor.bindingKeys()));
        return List.copyOf(keys);
    }

    public void reconcile(CurrentBinding binding) {
        actors.computeIfPresent(binding.key().terminalRef(), (key, actor) -> {
            actor.reconcile(binding);
            return actor.isIdle() ? null : actor;
        });
    }

    public void reconcileSession(CurrentSessionState currentSession) {
        Objects.requireNonNull(currentSession, "currentSession");
        actors.computeIfPresent(currentSession.key().terminalRef(), (key, actor) -> {
            actor.reconcileSession(currentSession);
            return actor.isIdle() ? null : actor;
        });
    }

    public boolean subscribeTopic(UUID terminalRef, TdsWebSocketConnection connection, TopicSubscribe request) {
        TerminalActor actor = actors.get(terminalRef);
        return actor != null && actor.subscribeTopic(connection, request);
    }

    public void unsubscribeTopic(UUID terminalRef, TdsWebSocketConnection connection, TopicUnsubscribe request) {
        TerminalActor actor = actors.get(terminalRef);
        if (actor != null) actor.unsubscribeTopic(connection, request);
    }

    public void acceptTopic(UUID terminalRef, TdsWebSocketConnection connection, TopicAccept request) {
        TerminalActor actor = actors.get(terminalRef);
        if (actor != null) actor.acceptTopic(connection, request);
    }

    /** Sends a claimed command only through the active socket matching its committed target identity. */
    public boolean dispatchRemoteCommand(ClaimedOperation operation) {
        Objects.requireNonNull(operation, "operation");
        TerminalActor actor = actors.get(operation.terminalRef());
        return actor != null && actor.dispatchRemoteCommand(operation);
    }

    public void topicChanged(TopicChange change) {
        actors.values().forEach(actor -> actor.topicChanged(change));
    }

    /** Re-reads active subscription facts after the PostgreSQL listener has re-established LISTEN. */
    public void reconcileTopicSubscriptions() {
        actors.values().forEach(TerminalActor::reconcileTopicSubscriptions);
    }

    public int trackedActorCount() {
        return actors.size();
    }

    private void removeIfIdle(UUID terminalRef, TerminalActor actor) {
        actors.computeIfPresent(terminalRef, (key, current) -> current == actor && actor.isIdle() ? null : current);
    }

    private final class TerminalActor {
        private final UUID terminalRef;
        private final Object monitor = new Object();
        private final Object registrationLock = new Object();
        private final Map<String, PendingAttempt> pending = new HashMap<>();
        private ActiveSession active;
        private long revokedThroughGeneration;
        private long latestObservedSequence;
        private int registrationsInFlight;

        private TerminalActor(UUID terminalRef) {
            this.terminalRef = terminalRef;
        }

        private boolean generationRevoked(long generation) {
            return generation <= revokedThroughGeneration;
        }

        private void begin(
                String groupWorkspaceKey, String attemptId, long generation, TdsWebSocketConnection connection) {
            if (groupWorkspaceKey == null
                    || groupWorkspaceKey.isBlank()
                    || attemptId == null
                    || attemptId.isBlank()
                    || generation < 1) {
                throw new IllegalArgumentException("TDS_SESSION_ATTEMPT_INVALID");
            }
            synchronized (monitor) {
                if (pending.putIfAbsent(attemptId, new PendingAttempt(groupWorkspaceKey, generation, connection))
                        != null) {
                    throw new IllegalStateException("TDS_SESSION_ATTEMPT_DUPLICATE");
                }
            }
        }

        private boolean beginDrain(List<Mono<Void>> pendingCloses) {
            synchronized (monitor) {
                pending.values()
                        .forEach(attempt -> pendingCloses.add(attempt.connection.closeAsync("REDIRECT_TO_NEXT_NODE")));
                pending.clear();
                return active != null;
            }
        }

        private Mono<Void> finishDrain() {
            synchronized (monitor) {
                if (active == null) return Mono.empty();
                ActiveSession drained = active;
                active = null;
                queueDisconnect(drained, "REDIRECT_TO_NEXT_NODE");
                return drained.connection().closeAsync("REDIRECT_TO_NEXT_NODE");
            }
        }

        private boolean recordVerification(String attemptId, Verification verification) {
            synchronized (monitor) {
                PendingAttempt attempt = pending.get(attemptId);
                if (attempt == null || verification == null || verification.outcome() != Outcome.VERIFIED) return false;
                if (draining.get()) {
                    pending.remove(attemptId);
                    attempt.connection.close("REDIRECT_TO_NEXT_NODE");
                    return false;
                }
                if (!terminalRef.equals(verification.terminalRef())
                        || !attempt.groupWorkspaceKey.equals(verification.groupWorkspaceKey())
                        || attempt.generation != verification.generation()) {
                    pending.remove(attemptId);
                    attempt.connection.close("CREDENTIAL_INVALID");
                    return false;
                }
                if (generationRevoked(attempt.generation) || !attempt.connection.isOpen()) {
                    pending.remove(attemptId);
                    attempt.connection.close("ACTIVATION_CANCELLED");
                    return false;
                }
                attempt.workspaceUuid = verification.workspaceUuid();
                if (attempt.reconciledBinding != null
                        && sameBindingIdentity(attempt, attempt.reconciledBinding)
                        && revokedByCurrentBinding(attempt.generation, attempt.reconciledBinding)) {
                    pending.remove(attemptId);
                    attempt.connection.close("ACTIVATION_CANCELLED");
                    return false;
                }
                return true;
            }
        }

        private boolean dispatchRemoteCommand(ClaimedOperation operation) {
            synchronized (monitor) {
                if (active == null
                        || active.generation() != operation.bindingGeneration()
                        || !active.connection().isOpen()
                        || !active.connection().sessionId().equals(operation.targetSessionId())
                        || !active.identity().nodeId().equals(settings.nodeId())
                        || !active.identity().terminalRef().equals(operation.terminalRef())) {
                    return false;
                }
                String payload = codec.remoteCommand(
                        operation.operationId(),
                        operation.requestId(),
                        operation.bindingGeneration(),
                        operation.commandName(),
                        operation.parameters());
                boolean sent = active.connection().sendText(payload);
                if (!sent) {
                    TdsAsyncLog.enqueue(
                            logScheduler,
                            () -> LOGGER.warn(
                                    "event=tds_remote_command_send_rejected operationId={} terminalRef={} sessionId={}",
                                    operation.operationId(),
                                    operation.terminalRef(),
                                    operation.targetSessionId()));
                }
                return sent;
            }
        }

        private boolean register(String attemptId, Verification verification) {
            synchronized (registrationLock) {
                PendingAttempt attempt;
                TdsWebSocketConnection connection;
                long generation;
                TdsConnectionCapacityLimiter.Permit trackedPermit;
                synchronized (monitor) {
                    attempt = pending.get(attemptId);
                    if (attempt == null) return false;
                    connection = attempt.connection;
                    generation = attempt.generation;
                    if (draining.get()) {
                        pending.remove(attemptId);
                        connection.close("REDIRECT_TO_NEXT_NODE");
                        return false;
                    }
                    if (verification == null || verification.outcome() != Outcome.VERIFIED) {
                        throw new IllegalArgumentException("TDS_SESSION_VERIFICATION_INVALID");
                    }
                    if (!terminalRef.equals(verification.terminalRef())
                            || !attempt.groupWorkspaceKey.equals(verification.groupWorkspaceKey())
                            || !Objects.equals(attempt.workspaceUuid, verification.workspaceUuid())
                            || generation != verification.generation()) {
                        pending.remove(attemptId);
                        connection.close("CREDENTIAL_INVALID");
                        return false;
                    }
                    if (generationRevoked(generation)) {
                        pending.remove(attemptId);
                        connection.close("ACTIVATION_CANCELLED");
                        return false;
                    }
                    if (!connection.isOpen()) {
                        pending.remove(attemptId);
                        return false;
                    }

                    trackedPermit = capacityLimiter.tryAcquireTrackedSession();
                    if (trackedPermit == null) {
                        pending.remove(attemptId);
                        connection.close("NODE_BUSY");
                        return false;
                    }
                }

                // Opening the row is synchronous JDBC. Keep it outside the actor monitor so a
                // concurrent revocation can remove this pending attempt and close its socket.
                Optional<SessionIdentity> opened;
                try {
                    opened = repository.open(verification, settings.nodeId(), connection.sessionId());
                } catch (RuntimeException failure) {
                    synchronized (monitor) {
                        if (pending.get(attemptId) == attempt) pending.remove(attemptId);
                        trackedPermit.close();
                        connection.close("SERVER_ERROR");
                    }
                    throw failure;
                }

                if (opened.isEmpty()) {
                    synchronized (monitor) {
                        if (pending.get(attemptId) == attempt) pending.remove(attemptId);
                        trackedPermit.close();
                        connection.close(
                                generationRevoked(generation)
                                        ? "ACTIVATION_CANCELLED"
                                        : connection.closeReasonOr("SESSION_REPLACED"));
                    }
                    return false;
                }
                SessionIdentity identity = opened.get();

                TdsAsyncLog.enqueue(
                        logScheduler,
                        () -> LOGGER.info(
                                "event=tds_session_postgres_open_committed_before_local_register "
                                        + "connectionId={} sessionId={} sequence={}",
                                connection.connectionId(),
                                identity.sessionId(),
                                identity.sequence()));
                try {
                    registrationGate.afterPostgresOpen(attemptId).block();
                } catch (RuntimeException failure) {
                    synchronized (monitor) {
                        abandonOpenedSession(attemptId, connection, identity, trackedPermit, "SERVER_ERROR");
                    }
                    throw failure;
                }

                Optional<CurrentSessionState> currentSession;
                try {
                    currentSession = repository.readCurrentSession(identity);
                } catch (RuntimeException failure) {
                    synchronized (monitor) {
                        discardOpenedCandidate(attemptId, attempt, connection, identity, trackedPermit, "SERVER_ERROR");
                    }
                    throw failure;
                }
                currentSession.ifPresent(this::observeSessionSequence);

                synchronized (monitor) {
                    if (pending.get(attemptId) != attempt
                            || draining.get()
                            || generationRevoked(generation)
                            || !connection.isOpen()
                            || currentSession.isEmpty()
                            || !currentSession.get().isOpen()
                            || !currentSession.get().matches(identity)
                            || identity.sequence() < latestObservedSequence) {
                        TdsAsyncLog.enqueue(
                                logScheduler,
                                () -> LOGGER.info(
                                        "event=tds_session_candidate_rejected "
                                                + "connectionId={} candidateSequence={} latestSequence={} "
                                                + "currentRowPresent={}",
                                        connection.connectionId(),
                                        identity.sequence(),
                                        currentSession
                                                .map(CurrentSessionState::sequence)
                                                .orElse(-1L),
                                        currentSession.isPresent()));
                        if (currentSession.isPresent() && currentSession.get().sequence() > identity.sequence()) {
                            rejectOpenedCandidate(attemptId, attempt, connection, trackedPermit, "SESSION_REPLACED");
                            return false;
                        }
                        String closeReason = draining.get()
                                ? "REDIRECT_TO_NEXT_NODE"
                                : generationRevoked(generation)
                                        ? "ACTIVATION_CANCELLED"
                                        : !connection.isOpen()
                                                ? connection.closeReasonOr("NETWORK_ERROR")
                                                : "SESSION_REPLACED";
                        abandonOpenedSession(attemptId, connection, identity, trackedPermit, closeReason);
                        return false;
                    }

                    String sessionReady;
                    try {
                        sessionReady = codec.sessionReady(
                                connection.sessionId(),
                                settings.nodeId(),
                                identity.connectedAt(),
                                settings.heartbeatInterval().toMillis(),
                                settings.heartbeatTimeout().toMillis());
                    } catch (RuntimeException failure) {
                        abandonOpenedSession(attemptId, connection, identity, trackedPermit, "SERVER_ERROR");
                        throw failure;
                    }
                    boolean sent;
                    try {
                        sent = connection.sendSessionReady(sessionReady, identity, generation);
                    } catch (RuntimeException failure) {
                        abandonOpenedSession(attemptId, connection, identity, trackedPermit, "SERVER_ERROR");
                        throw failure;
                    }
                    if (!sent) {
                        abandonOpenedSession(attemptId, connection, identity, trackedPermit, "SERVER_ERROR");
                        return false;
                    }

                    ActiveSession previous = active;
                    active = new ActiveSession(
                            generation, connection, identity, trackedPermit, verification.storeRef(), new HashMap<>());
                    historyWriter.recordConnected(TdsConnectionHistoryEvent.connected(identity));
                    pending.remove(attemptId);
                    if (previous != null) {
                        String previousReason =
                                previous.generation() < generation || generationRevoked(previous.generation())
                                        ? "ACTIVATION_CANCELLED"
                                        : "SESSION_REPLACED";
                        previous.connection().close(previousReason);
                        queueDisconnect(previous, previousReason);
                    }
                    TdsAsyncLog.enqueue(
                            logScheduler,
                            () -> LOGGER.info(
                                    "event=tds_session_registered connectionId={} sessionId={} generation={}",
                                    connection.connectionId(),
                                    connection.sessionId(),
                                    generation));
                    return true;
                }
            }
        }

        private void reject(String attemptId, String closeReason) {
            synchronized (monitor) {
                PendingAttempt attempt = pending.remove(attemptId);
                if (attempt != null) attempt.connection.close(closeReason);
            }
        }

        private boolean subscribeTopic(TdsWebSocketConnection connection, TopicSubscribe request) {
            long startedAtNanos = System.nanoTime();
            ActiveSession session;
            TopicSubscription subscription;
            synchronized (monitor) {
                session = active;
                if (session == null || session.connection() != connection) {
                    TdsAsyncLog.enqueue(
                            logScheduler,
                            () -> LOGGER.warn(
                                    "event=tds_topic_subscribe_rejected connectionId={} topicKey={} reason=NO_ACTIVE_SESSION",
                                    connection.connectionId(),
                                    request.topicKey()));
                    return false;
                }
                if (!validBoundTopic(session, request.topicKey(), request.ownerRef())) {
                    TdsAsyncLog.enqueue(
                            logScheduler,
                            () -> LOGGER.warn(
                                    "event=tds_topic_subscribe_rejected connectionId={} topicKey={} reason=TOPIC_OUTSIDE_BINDING",
                                    connection.connectionId(),
                                    request.topicKey()));
                    return false;
                }
                TopicSubscription existing =
                        session.subscriptions().get(request.subscriptionId().toString());
                if (existing != null) {
                    boolean matches = existing.matches(request.topicKey(), request.ownerRef());
                    TdsAsyncLog.enqueue(
                            logScheduler,
                            () -> LOGGER.info(
                                    "event=tds_topic_subscribe_duplicate connectionId={} topicKey={} matches={}",
                                    connection.connectionId(),
                                    request.topicKey(),
                                    matches));
                    return matches;
                }
                subscription = new TopicSubscription(
                        request.subscriptionId().toString(),
                        request.topicKey(),
                        request.ownerRef(),
                        request.lastAcceptedTimeEpochMillis());
                session.subscriptions().put(subscription.subscriptionId, subscription);
            }
            try {
                TdsAsyncLog.enqueue(
                        logScheduler,
                        () -> LOGGER.info(
                                "event=tds_topic_subscribe_time_read_begin connectionId={} topicKey={}",
                                connection.connectionId(),
                                request.topicKey()));
                OptionalLong current = topicRepository.readTime(
                        session.identity().workspaceUuid(),
                        session.identity().groupWorkspaceKey(),
                        session.storeRef(),
                        request.topicKey(),
                        request.ownerRef());
                TdsAsyncLog.enqueue(
                        logScheduler,
                        () -> LOGGER.info(
                                "event=tds_topic_subscribe_time_readback connectionId={} topicKey={} present={} elapsedMs={}",
                                connection.connectionId(),
                                request.topicKey(),
                                current.isPresent(),
                                TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startedAtNanos)));
                if (current.isEmpty()) {
                    TdsAsyncLog.enqueue(
                            logScheduler,
                            () -> LOGGER.warn(
                                    "event=tds_topic_owner_time_missing connectionId={} topicKey={} "
                                            + "workspaceUuid={} groupWorkspaceKey={} storeRef={} ownerRef={}",
                                    connection.connectionId(),
                                    request.topicKey(),
                                    session.identity().workspaceUuid(),
                                    session.identity().groupWorkspaceKey(),
                                    session.storeRef(),
                                    request.ownerRef()));
                    return rejectMissingTopic(session, subscription);
                }
                boolean notificationSent = sendTopicChange(session, subscription, current.getAsLong(), false);
                TdsAsyncLog.enqueue(
                        logScheduler,
                        () -> LOGGER.info(
                                "event=tds_topic_subscribe_completed connectionId={} topicKey={} notificationSent={} elapsedMs={}",
                                connection.connectionId(),
                                request.topicKey(),
                                notificationSent,
                                TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startedAtNanos)));
                return notificationSent;
            } catch (RuntimeException failure) {
                removeSubscription(session, subscription);
                TdsAsyncLog.enqueue(
                        logScheduler,
                        () -> LOGGER.error(
                                "event=tds_topic_subscribe_failed connectionId={} topicKey={} failureName={} elapsedMs={}",
                                connection.connectionId(),
                                request.topicKey(),
                                failure.getClass().getSimpleName(),
                                TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startedAtNanos)));
                connection.close("SERVER_ERROR");
                throw failure;
            }
        }

        private boolean rejectMissingTopic(ActiveSession session, TopicSubscription subscription) {
            removeSubscription(session, subscription);
            session.connection().close("UNKNOWN");
            return false;
        }

        private void unsubscribeTopic(TdsWebSocketConnection connection, TopicUnsubscribe request) {
            synchronized (monitor) {
                if (active == null || active.connection() != connection) return;
                TopicSubscription current =
                        active.subscriptions().get(request.subscriptionId().toString());
                if (current != null && current.matches(request.topicKey(), request.ownerRef())) {
                    active.subscriptions().remove(current.subscriptionId);
                }
            }
        }

        private void acceptTopic(TdsWebSocketConnection connection, TopicAccept request) {
            ActiveSession session;
            TopicSubscription subscription;
            boolean hadOnlineChangeWhilePending;
            synchronized (monitor) {
                session = active;
                if (session == null || session.connection() != connection) return;
                subscription =
                        session.subscriptions().get(request.subscriptionId().toString());
                if (subscription == null
                        || !subscription.matches(request.topicKey(), request.ownerRef())
                        || !request.notificationId().toString().equals(subscription.pendingNotificationId)
                        || subscription.pendingTime != request.acceptedTimeEpochMillis()) return;
                subscription.lastAcceptedTime = request.acceptedTimeEpochMillis();
                subscription.pendingNotificationId = null;
                subscription.pendingTime = -1;
                hadOnlineChangeWhilePending = subscription.dirtyWhilePending;
                subscription.dirtyWhilePending = false;
            }
            try {
                OptionalLong current = topicRepository.readTime(
                        session.identity().workspaceUuid(),
                        session.identity().groupWorkspaceKey(),
                        session.storeRef(),
                        subscription.topicKey,
                        subscription.ownerRef);
                if (current.isPresent()) {
                    sendTopicChange(session, subscription, current.getAsLong(), hadOnlineChangeWhilePending);
                }
            } catch (RuntimeException failure) {
                session.connection().close("SERVER_ERROR");
                throw failure;
            }
        }

        private void topicChanged(TopicChange change) {
            ActiveSession session;
            List<TopicSubscription> matches;
            synchronized (monitor) {
                session = active;
                if (session == null
                        || !session.identity().workspaceUuid().equals(change.workspaceUuid())
                        || !session.identity().groupWorkspaceKey().equals(change.groupWorkspaceKey())) return;
                matches = session.subscriptions().values().stream()
                        .filter(subscription -> subscription.matches(change.topicKey(), change.ownerRef()))
                        .toList();
            }
            for (TopicSubscription subscription : matches) {
                try {
                    OptionalLong current = topicRepository.readTime(
                            session.identity().workspaceUuid(),
                            session.identity().groupWorkspaceKey(),
                            session.storeRef(),
                            subscription.topicKey,
                            subscription.ownerRef);
                    if (current.isPresent()) sendTopicChange(session, subscription, current.getAsLong(), true);
                } catch (RuntimeException failure) {
                    session.connection().close("SERVER_ERROR");
                    throw failure;
                }
            }
        }

        private void reconcileTopicSubscriptions() {
            ActiveSession session;
            List<TopicSubscription> subscriptions;
            synchronized (monitor) {
                session = active;
                if (session == null) return;
                subscriptions = List.copyOf(session.subscriptions().values());
            }
            for (TopicSubscription subscription : subscriptions) {
                try {
                    OptionalLong current = topicRepository.readTime(
                            session.identity().workspaceUuid(),
                            session.identity().groupWorkspaceKey(),
                            session.storeRef(),
                            subscription.topicKey,
                            subscription.ownerRef);
                    if (current.isPresent()) sendTopicChange(session, subscription, current.getAsLong(), false);
                } catch (RuntimeException failure) {
                    session.connection().close("SERVER_ERROR");
                    throw failure;
                }
            }
        }

        private boolean sendTopicChange(
                ActiveSession session, TopicSubscription subscription, long currentTime, boolean onlineWakeup) {
            synchronized (monitor) {
                if (active != session
                        || !session.connection().isOpen()
                        || session.subscriptions().get(subscription.subscriptionId) != subscription) return true;
                if (subscription.pendingNotificationId != null) {
                    if (onlineWakeup) subscription.dirtyWhilePending = true;
                    return true;
                }
                if (!onlineWakeup && currentTime == subscription.lastAcceptedTime) return true;
                String notificationId = UUID.randomUUID().toString();
                String payload = codec.topicChanged(
                        notificationId,
                        subscription.subscriptionId,
                        subscription.topicKey,
                        subscription.ownerRef,
                        currentTime);
                subscription.pendingNotificationId = notificationId;
                subscription.pendingTime = currentTime;
                if (session.connection().sendText(payload)) return true;
                subscription.pendingNotificationId = null;
                subscription.pendingTime = -1;
                TdsAsyncLog.enqueue(
                        logScheduler,
                        () -> LOGGER.warn(
                                "event=tds_topic_notification_send_rejected connectionId={} topicKey={} "
                                        + "disposition=RETRY_ON_NEXT_WAKEUP",
                                session.connection().connectionId(),
                                subscription.topicKey));
                return false;
            }
        }

        private void removeSubscription(ActiveSession session, TopicSubscription subscription) {
            synchronized (monitor) {
                if (active == session) session.subscriptions().remove(subscription.subscriptionId, subscription);
            }
        }

        private boolean validBoundTopic(ActiveSession session, String topicKey, UUID ownerRef) {
            return switch (topicKey) {
                case "STORE",
                        "STORE_OPERATING_RULE",
                        "VALID_CONTRACT_COLLECTION",
                        "SERVICE_POINT_AREA_COLLECTION",
                        "SERVICE_POINT_COLLECTION" -> ownerRef.equals(session.storeRef());
                case "PROJECT", "REGION", "COMMERCIAL_GROUP", "CONTRACT", "SERVICE_POINT_AREA", "SERVICE_POINT",
                        "TERMINAL_UPDATE_RULES" -> true;
                default -> false;
            };
        }

        private void connectionClosed(String attemptId, TdsWebSocketConnection connection) {
            synchronized (monitor) {
                pending.remove(attemptId);
                if (active != null && active.connection() == connection) {
                    ActiveSession closed = active;
                    active = null;
                    String closeReason = connection.closeReasonOr("NETWORK_ERROR");
                    TdsAsyncLog.enqueue(
                            logScheduler,
                            () -> LOGGER.info(
                                    "event=tds_session_connection_closed "
                                            + "connectionId={} sessionId={} generation={} closeReason={}",
                                    connection.connectionId(),
                                    closed.identity().sessionId(),
                                    closed.generation(),
                                    closeReason));
                    queueDisconnect(closed, closeReason);
                }
            }
        }

        private void revoke(long generation) {
            if (generation < 1) return;
            synchronized (monitor) {
                revokedThroughGeneration = Math.max(revokedThroughGeneration, generation);
                Iterator<Map.Entry<String, PendingAttempt>> iterator =
                        pending.entrySet().iterator();
                while (iterator.hasNext()) {
                    PendingAttempt attempt = iterator.next().getValue();
                    if (generationRevoked(attempt.generation)) {
                        iterator.remove();
                        attempt.connection.close("ACTIVATION_CANCELLED");
                    }
                }
                if (active != null && generationRevoked(active.generation())) {
                    ActiveSession revoked = active;
                    active = null;
                    revoked.connection().close("ACTIVATION_CANCELLED");
                    queueDisconnect(revoked, "ACTIVATION_CANCELLED");
                }
            }
        }

        private List<BindingKey> bindingKeys() {
            synchronized (monitor) {
                Set<BindingKey> keys = new HashSet<>();
                pending.values().forEach(attempt -> keys.add(new BindingKey(attempt.groupWorkspaceKey, terminalRef)));
                if (active != null) keys.add(new BindingKey(active.identity().groupWorkspaceKey(), terminalRef));
                return List.copyOf(keys);
            }
        }

        private void reconcile(CurrentBinding binding) {
            synchronized (monitor) {
                Iterator<Map.Entry<String, PendingAttempt>> iterator =
                        pending.entrySet().iterator();
                while (iterator.hasNext()) {
                    PendingAttempt attempt = iterator.next().getValue();
                    if (attempt.groupWorkspaceKey.equals(binding.key().groupWorkspaceKey())) {
                        attempt.reconciledBinding = binding;
                    }
                    if (sameBindingIdentity(attempt, binding) && revokedByCurrentBinding(attempt.generation, binding)) {
                        revokedThroughGeneration = Math.max(revokedThroughGeneration, binding.generation());
                        iterator.remove();
                        attempt.connection.close("ACTIVATION_CANCELLED");
                    }
                }
                if (active != null
                        && binding.generation() != null
                        && active.identity()
                                .groupWorkspaceKey()
                                .equals(binding.key().groupWorkspaceKey())
                        && active.identity().workspaceUuid().equals(binding.workspaceUuid())
                        && revokedByCurrentBinding(active.generation(), binding)) {
                    revokedThroughGeneration = Math.max(revokedThroughGeneration, binding.generation());
                    ActiveSession revoked = active;
                    active = null;
                    revoked.connection().close("ACTIVATION_CANCELLED");
                    queueDisconnect(revoked, "ACTIVATION_CANCELLED");
                }
            }
        }

        private void reconcileSession(CurrentSessionState currentSession) {
            synchronized (monitor) {
                if (!terminalRef.equals(currentSession.key().terminalRef())) return;
                if (currentSession.sequence() < latestObservedSequence) return;
                latestObservedSequence = currentSession.sequence();
                if (active != null
                        && currentSession.sequence() >= active.identity().sequence()
                        && (!currentSession.isOpen() || !currentSession.matches(active.identity()))) {
                    ActiveSession replaced = active;
                    active = null;
                    replaced.connection().close("SESSION_REPLACED");
                    queueDisconnect(replaced, "SESSION_REPLACED");
                    TdsAsyncLog.enqueue(
                            logScheduler,
                            () -> LOGGER.info(
                                    "event=tds_session_reconciled_as_replaced "
                                            + "sessionId={} localSequence={} latestSessionId={} latestSequence={}",
                                    replaced.identity().sessionId(),
                                    replaced.identity().sequence(),
                                    currentSession.sessionId(),
                                    currentSession.sequence()));
                }
            }
        }

        private void observeSessionSequence(CurrentSessionState currentSession) {
            synchronized (monitor) {
                if (terminalRef.equals(currentSession.key().terminalRef())) {
                    latestObservedSequence = Math.max(latestObservedSequence, currentSession.sequence());
                }
            }
        }

        private void rejectOpenedCandidate(
                String attemptId,
                PendingAttempt attempt,
                TdsWebSocketConnection connection,
                TdsConnectionCapacityLimiter.Permit trackedPermit,
                String closeReason) {
            if (pending.get(attemptId) == attempt) pending.remove(attemptId);
            trackedPermit.close();
            connection.close(closeReason);
        }

        private void discardOpenedCandidate(
                String attemptId,
                PendingAttempt attempt,
                TdsWebSocketConnection connection,
                SessionIdentity identity,
                TdsConnectionCapacityLimiter.Permit trackedPermit,
                String closeReason) {
            if (pending.get(attemptId) == attempt) pending.remove(attemptId);
            connection.close(closeReason);
            stateWriter.queueDisconnect(identity, closeReason, () -> {
                trackedPermit.close();
                TdsAsyncLog.enqueue(
                        logScheduler,
                        () -> LOGGER.info(
                                "event=tds_tracked_session_permit_released sessionId={} closeReason={}",
                                identity.sessionId(),
                                closeReason));
            });
        }

        private boolean sameBindingIdentity(PendingAttempt attempt, CurrentBinding binding) {
            return binding.generation() != null
                    && attempt.workspaceUuid != null
                    && attempt.groupWorkspaceKey.equals(binding.key().groupWorkspaceKey())
                    && attempt.workspaceUuid.equals(binding.workspaceUuid());
        }

        private boolean revokedByCurrentBinding(long sessionGeneration, CurrentBinding binding) {
            return binding.generation() != null
                    && binding.generation() >= sessionGeneration
                    && (binding.generation() > sessionGeneration || !"ACTIVE".equals(binding.bindingStatus()));
        }

        private boolean isIdle() {
            synchronized (monitor) {
                return pending.isEmpty() && active == null && registrationsInFlight == 0;
            }
        }

        private void registrationStarted() {
            synchronized (monitor) {
                registrationsInFlight++;
            }
        }

        private void registrationFinished() {
            synchronized (monitor) {
                if (registrationsInFlight < 1) {
                    throw new IllegalStateException("TDS_REGISTRATION_LIFECYCLE_INVALID");
                }
                registrationsInFlight--;
            }
        }

        private void queueDisconnect(ActiveSession session, String closeReason) {
            historyWriter.recordDisconnected(TdsConnectionHistoryEvent.disconnected(session.identity(), closeReason));
            stateWriter.queueDisconnect(session.identity(), closeReason, () -> {
                session.trackedPermit().close();
                TdsAsyncLog.enqueue(
                        logScheduler,
                        () -> LOGGER.info(
                                "event=tds_tracked_session_permit_released sessionId={} closeReason={}",
                                session.identity().sessionId(),
                                closeReason));
            });
        }

        private void abandonOpenedSession(
                String attemptId,
                TdsWebSocketConnection connection,
                SessionIdentity identity,
                TdsConnectionCapacityLimiter.Permit trackedPermit,
                String closeReason) {
            pending.remove(attemptId);
            ActiveSession previous = active;
            active = null;
            connection.close(closeReason);
            stateWriter.queueDisconnect(identity, closeReason, () -> {
                trackedPermit.close();
                TdsAsyncLog.enqueue(
                        logScheduler,
                        () -> LOGGER.info(
                                "event=tds_tracked_session_permit_released sessionId={} closeReason={}",
                                identity.sessionId(),
                                closeReason));
            });
            if (previous != null) {
                previous.connection().close(closeReason);
                queueDisconnect(previous, closeReason);
            }
        }
    }

    private static final class PendingAttempt {
        private final String groupWorkspaceKey;
        private final long generation;
        private final TdsWebSocketConnection connection;
        private UUID workspaceUuid;
        private CurrentBinding reconciledBinding;

        private PendingAttempt(String groupWorkspaceKey, long generation, TdsWebSocketConnection connection) {
            this.groupWorkspaceKey = groupWorkspaceKey;
            this.generation = generation;
            this.connection = connection;
        }
    }

    private record ActiveSession(
            long generation,
            TdsWebSocketConnection connection,
            SessionIdentity identity,
            TdsConnectionCapacityLimiter.Permit trackedPermit,
            UUID storeRef,
            Map<String, TopicSubscription> subscriptions) {}

    private static final class TopicSubscription {
        private final String subscriptionId;
        private final String topicKey;
        private final UUID ownerRef;
        private long lastAcceptedTime;
        private String pendingNotificationId;
        private long pendingTime = -1;
        private boolean dirtyWhilePending;

        private TopicSubscription(String subscriptionId, String topicKey, UUID ownerRef, long lastAcceptedTime) {
            this.subscriptionId = subscriptionId;
            this.topicKey = topicKey;
            this.ownerRef = ownerRef;
            this.lastAcceptedTime = lastAcceptedTime;
        }

        private boolean matches(String candidateTopicKey, UUID candidateOwnerRef) {
            return topicKey.equals(candidateTopicKey) && ownerRef.equals(candidateOwnerRef);
        }
    }

    public record TopicChange(UUID workspaceUuid, String groupWorkspaceKey, String topicKey, UUID ownerRef) {}
}
