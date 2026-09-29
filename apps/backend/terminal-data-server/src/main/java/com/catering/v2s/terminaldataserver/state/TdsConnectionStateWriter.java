package com.catering.v2s.terminaldataserver.state;

import com.catering.v2s.terminaldataserver.config.TdsRuntimeSettings;
import com.catering.v2s.terminaldataserver.observability.TdsAsyncLog;
import com.catering.v2s.terminaldataserver.state.TdsConnectionStateRepository.Heartbeat;
import com.catering.v2s.terminaldataserver.state.TdsConnectionStateRepository.SessionIdentity;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.web.server.context.WebServerApplicationContext;
import org.springframework.context.SmartLifecycle;
import org.springframework.stereotype.Component;
import reactor.core.Disposable;
import reactor.core.scheduler.Scheduler;

/** Coalesces each session's latest heartbeat and retains disconnects until persisted. */
@Component
public final class TdsConnectionStateWriter implements SmartLifecycle {
    private static final Logger LOGGER = LoggerFactory.getLogger(TdsConnectionStateWriter.class);

    private final TdsConnectionStateRepository repository;
    private final TdsRuntimeSettings settings;
    private final Scheduler scheduler;
    private final Scheduler logScheduler;
    private final ConcurrentHashMap<SessionIdentity, Heartbeat> pendingHeartbeats = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<SessionIdentity, PendingDisconnect> pendingDisconnects = new ConcurrentHashMap<>();
    private final AtomicBoolean running = new AtomicBoolean();
    private volatile Disposable periodicWrite;

    public TdsConnectionStateWriter(
            TdsConnectionStateRepository repository,
            TdsRuntimeSettings settings,
            @Qualifier("tds-db-worker") Scheduler databaseScheduler,
            @Qualifier("tds-log-worker") Scheduler logScheduler) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.settings = Objects.requireNonNull(settings, "settings");
        this.scheduler = Objects.requireNonNull(databaseScheduler, "databaseScheduler");
        this.logScheduler = Objects.requireNonNull(logScheduler, "logScheduler");
    }

    public boolean queueHeartbeat(SessionIdentity session, double lastRttMs) {
        Heartbeat heartbeat = new Heartbeat(session, lastRttMs);
        AtomicBoolean accepted = new AtomicBoolean();
        pendingDisconnects.compute(session, (key, disconnect) -> {
            if (disconnect == null) {
                pendingHeartbeats.put(key, heartbeat);
                accepted.set(true);
            }
            return disconnect;
        });
        return accepted.get();
    }

    public void queueDisconnect(SessionIdentity session, String closeReason, Runnable persisted) {
        PendingDisconnect disconnect = new PendingDisconnect(session, closeReason, persisted);
        pendingDisconnects.putIfAbsent(session, disconnect);
        pendingHeartbeats.remove(session);
    }

    @Override
    public void start() {
        if (!running.compareAndSet(false, true)) return;
        long intervalMs = settings.stateWriteInterval().toMillis();
        periodicWrite = scheduler.schedulePeriodically(this::flush, intervalMs, intervalMs, TimeUnit.MILLISECONDS);
    }

    @Override
    public void stop() {
        if (!running.compareAndSet(true, false)) return;
        Disposable scheduled = periodicWrite;
        if (scheduled != null) scheduled.dispose();
        flush();
    }

    @Override
    public void stop(Runnable callback) {
        try {
            stop();
        } finally {
            callback.run();
        }
    }

    @Override
    public boolean isRunning() {
        return running.get();
    }

    @Override
    public int getPhase() {
        return WebServerApplicationContext.START_STOP_LIFECYCLE_PHASE - 1;
    }

    void flush() {
        List<PendingDisconnect> disconnects = new ArrayList<>(pendingDisconnects.values());
        for (PendingDisconnect disconnect : disconnects) {
            if (!flushDisconnect(disconnect)) return;
        }
        flushHeartbeats(new ArrayList<>(pendingHeartbeats.values()));
    }

    private boolean flushDisconnect(PendingDisconnect disconnect) {
        try {
            repository.writeDisconnect(disconnect.session(), disconnect.closeReason());
            if (pendingDisconnects.remove(disconnect.session(), disconnect))
                disconnect.persisted().run();
            return true;
        } catch (RuntimeException failure) {
            TdsAsyncLog.enqueue(
                    logScheduler,
                    () -> LOGGER.warn(
                            ("event=tds_disconnect_write_failed sessionId={} pendingHeartbeats={} pend"
                                    + "ingDisconnects={} failureType={}"),
                            disconnect.session().sessionId(),
                            pendingHeartbeats.size(),
                            pendingDisconnects.size(),
                            failure.getClass().getSimpleName()));
            return false;
        }
    }

    private void flushHeartbeats(Collection<Heartbeat> heartbeats) {
        if (heartbeats.isEmpty()) return;
        try {
            int updated = repository.writeHeartbeats(heartbeats);
            heartbeats.forEach(heartbeat -> pendingHeartbeats.remove(heartbeat.session(), heartbeat));
            int pendingHeartbeatCount = pendingHeartbeats.size();
            int pendingDisconnectCount = pendingDisconnects.size();
            TdsAsyncLog.enqueue(
                    logScheduler,
                    () -> LOGGER.info(
                            "event=tds_heartbeat_write_completed requested={} updated={} pendingHeartbeats={} "
                                    + "pendingDisconnects={}",
                            heartbeats.size(),
                            updated,
                            pendingHeartbeatCount,
                            pendingDisconnectCount));
        } catch (RuntimeException failure) {
            TdsAsyncLog.enqueue(
                    logScheduler,
                    () -> LOGGER.warn(
                            ("event=tds_heartbeat_write_failed count={} pendingHeartbeats={} pendingDi"
                                    + "sconnects={} failureType={}"),
                            heartbeats.size(),
                            pendingHeartbeats.size(),
                            pendingDisconnects.size(),
                            failure.getClass().getSimpleName()));
        }
    }

    int pendingHeartbeatCount() {
        return pendingHeartbeats.size();
    }

    int pendingDisconnectCount() {
        return pendingDisconnects.size();
    }

    private record PendingDisconnect(SessionIdentity session, String closeReason, Runnable persisted) {
        private PendingDisconnect {
            Objects.requireNonNull(session, "session");
            Objects.requireNonNull(closeReason, "closeReason");
            Objects.requireNonNull(persisted, "persisted");
        }
    }
}
