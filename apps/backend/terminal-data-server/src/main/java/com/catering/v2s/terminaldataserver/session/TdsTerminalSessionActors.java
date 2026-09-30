package com.catering.v2s.terminaldataserver.session;

import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi.Outcome;
import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi.Verification;
import com.catering.v2s.terminaldataserver.config.TdsRuntimeSettings;
import com.catering.v2s.terminaldataserver.observability.TdsAsyncLog;
import com.catering.v2s.terminaldataserver.protocol.TerminalConnectionFrameCodec;
import com.catering.v2s.terminaldataserver.state.TdsConnectionStateRepository;
import com.catering.v2s.terminaldataserver.state.TdsConnectionStateRepository.BindingKey;
import com.catering.v2s.terminaldataserver.state.TdsConnectionStateRepository.CurrentBinding;
import com.catering.v2s.terminaldataserver.state.TdsConnectionStateRepository.SessionIdentity;
import com.catering.v2s.terminaldataserver.state.TdsConnectionStateWriter;
import com.catering.v2s.terminaldataserver.websocket.TdsWebSocketConnection;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.RejectedExecutionException;
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
    private final TdsConnectionStateWriter stateWriter;
    private final TdsRuntimeSettings settings;
    private final TerminalConnectionFrameCodec codec;
    private final TdsConnectionCapacityLimiter capacityLimiter;
    private final Scheduler jdbcScheduler;
    private final Scheduler logScheduler;
    private final ConcurrentHashMap<UUID, TerminalActor> actors = new ConcurrentHashMap<>();
    private final Object admissionMonitor = new Object();
    private final AtomicBoolean draining = new AtomicBoolean();
    private final AtomicBoolean drainStarted = new AtomicBoolean();

    public TdsTerminalSessionActors(
            TdsConnectionStateRepository repository,
            TdsConnectionStateWriter stateWriter,
            TdsRuntimeSettings settings,
            TerminalConnectionFrameCodec codec,
            TdsConnectionCapacityLimiter capacityLimiter,
            @Qualifier("tds-db-worker") Scheduler jdbcScheduler,
            @Qualifier("tds-log-worker") Scheduler logScheduler) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.stateWriter = Objects.requireNonNull(stateWriter, "stateWriter");
        this.settings = Objects.requireNonNull(settings, "settings");
        this.codec = Objects.requireNonNull(codec, "codec");
        this.capacityLimiter = Objects.requireNonNull(capacityLimiter, "capacityLimiter");
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
                    TerminalActor actor = actors.get(terminalRef);
                    if (actor == null) return false;
                    try {
                        return actor.register(attemptId, verification);
                    } finally {
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
                SessionIdentity identity;
                try {
                    identity = repository.open(verification, settings.nodeId(), connection.sessionId());
                } catch (RuntimeException failure) {
                    synchronized (monitor) {
                        if (pending.get(attemptId) == attempt) pending.remove(attemptId);
                        trackedPermit.close();
                        connection.close("SERVER_ERROR");
                    }
                    throw failure;
                }

                synchronized (monitor) {
                    if (pending.get(attemptId) != attempt
                            || draining.get()
                            || generationRevoked(generation)
                            || !connection.isOpen()) {
                        String closeReason = draining.get()
                                ? "REDIRECT_TO_NEXT_NODE"
                                : generationRevoked(generation)
                                        ? "ACTIVATION_CANCELLED"
                                        : connection.closeReasonOr("NETWORK_ERROR");
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
                        sent = connection.sendSessionReady(sessionReady, identity);
                    } catch (RuntimeException failure) {
                        abandonOpenedSession(attemptId, connection, identity, trackedPermit, "SERVER_ERROR");
                        throw failure;
                    }
                    if (!sent) {
                        abandonOpenedSession(attemptId, connection, identity, trackedPermit, "SERVER_ERROR");
                        return false;
                    }

                    ActiveSession previous = active;
                    active = new ActiveSession(generation, connection, identity, trackedPermit);
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
                return pending.isEmpty() && active == null;
            }
        }

        private void queueDisconnect(ActiveSession session, String closeReason) {
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
                TdsConnectionCapacityLimiter.Permit trackedPermit) {}
}
