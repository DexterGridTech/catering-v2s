package com.catering.v2s.terminaldataserver.session;

import com.catering.v2s.terminaldataserver.observability.TdsAsyncLog;
import com.catering.v2s.terminaldataserver.state.TdsConnectionStateRepository;
import com.catering.v2s.terminaldataserver.state.TdsConnectionStateRepository.CurrentBinding;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import javax.sql.DataSource;
import org.postgresql.PGConnection;
import org.postgresql.PGNotification;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.web.server.context.WebServerApplicationContext;
import org.springframework.context.SmartLifecycle;
import org.springframework.stereotype.Component;
import reactor.core.scheduler.Scheduler;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** Holds the dedicated PostgreSQL listener and reconciles local sessions after every reconnect. */
@Component
public final class TdsBindingRevocationListener implements SmartLifecycle {
    private static final Logger LOGGER = LoggerFactory.getLogger(TdsBindingRevocationListener.class);
    private static final String CHANNEL = "terminal_binding_events";
    private static final String LISTENER_THREAD_NAME = "tds-revocation-listener";
    private static final long NOTIFICATION_WAIT_MILLIS = 1_000;
    private static final long HEALTH_INTERVAL_NANOS = Duration.ofSeconds(10).toNanos();
    private static final int MAX_PAYLOAD_BYTES = 7_900;

    private final DataSource dataSource;
    private final TdsConnectionStateRepository repository;
    private final TdsTerminalSessionActors actors;
    private final TdsListenerRecoveryGate listenerRecoveryGate;
    private final ObjectMapper objectMapper;
    private final Scheduler logScheduler;
    private final Object lifecycleMonitor = new Object();
    private final List<Runnable> stopCallbacks = new ArrayList<>();
    private volatile boolean listenerRunning;
    private volatile boolean workerActive;
    private volatile boolean ready;
    private volatile Thread listenerThread;

    public TdsBindingRevocationListener(
            DataSource dataSource,
            TdsConnectionStateRepository repository,
            TdsTerminalSessionActors actors,
            TdsListenerRecoveryGate listenerRecoveryGate,
            @Qualifier("tds-wire-object-mapper") ObjectMapper objectMapper,
            @Qualifier("tds-log-worker") Scheduler logScheduler) {
        this.dataSource = Objects.requireNonNull(dataSource, "dataSource");
        this.repository = Objects.requireNonNull(repository, "repository");
        this.actors = Objects.requireNonNull(actors, "actors");
        this.listenerRecoveryGate = Objects.requireNonNull(listenerRecoveryGate, "listenerRecoveryGate");
        this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper");
        this.logScheduler = Objects.requireNonNull(logScheduler, "logScheduler");
    }

    public boolean isReady() {
        return ready;
    }

    @Override
    public void start() {
        Thread thread;
        synchronized (lifecycleMonitor) {
            if (workerActive) return;
            workerActive = true;
            listenerRunning = true;
            thread = new Thread(this::runListener, LISTENER_THREAD_NAME);
            thread.setDaemon(true);
            listenerThread = thread;
        }
        try {
            thread.start();
        } catch (RuntimeException | Error failure) {
            finishListener();
            throw failure;
        }
    }

    private void runListener() {
        try {
            runListenerLoop();
        } catch (RuntimeException failure) {
            ready = false;
            logWarning("tds_listener_stopped", failure.getClass().getSimpleName(), -1);
        } finally {
            finishListener();
        }
    }

    private void runListenerLoop() {
        long[] retryMillis = {1_000, 2_000, 4_000, 5_000};
        int retryIndex = 0;
        while (listenerRunning) {
            int backendPid = -1;
            try (Connection connection = dataSource.getConnection()) {
                backendPid = connection.unwrap(PGConnection.class).getBackendPID();
                listenAndReconcile(connection, backendPid);
                retryIndex = 0;
                poll(connection, backendPid);
            } catch (SQLException | RuntimeException failure) {
                ready = false;
                logWarning("tds_listener_disconnected", failure.getClass().getSimpleName(), backendPid);
            }
            if (!listenerRunning) break;
            listenerRecoveryGate.beforeReconnect(backendPid);
            sleepBeforeRetry(retryMillis[retryIndex]);
            retryIndex = Math.min(retryIndex + 1, retryMillis.length - 1);
        }
        ready = false;
    }

    private void listenAndReconcile(Connection connection, int backendPid) throws SQLException {
        connection.setAutoCommit(false);
        try (Statement statement = connection.createStatement()) {
            statement.execute("LISTEN " + CHANNEL);
        }
        connection.commit();
        connection.setAutoCommit(true);

        var keys = actors.trackedBindings();
        var currentBindings = repository.readCurrentBindings(connection, keys);
        for (CurrentBinding binding : currentBindings.values()) actors.reconcile(binding);
        ready = true;
        logInfo("tds_listener_ready", keys.size(), backendPid);
    }

    private void poll(Connection connection, int backendPid) throws SQLException {
        PGConnection pgConnection = connection.unwrap(PGConnection.class);
        long nextHealthCheck = System.nanoTime() + HEALTH_INTERVAL_NANOS;
        long lastHealthCheck = System.nanoTime();
        while (listenerRunning) {
            PGNotification[] notifications = pgConnection.getNotifications((int) NOTIFICATION_WAIT_MILLIS);
            if (notifications != null) {
                for (PGNotification notification : notifications) {
                    if (!CHANNEL.equals(notification.getName())) continue;
                    Revocation revocation = parse(notification.getParameter());
                    listenerRecoveryGate.beforeRevocationDispatch(
                            revocation.terminalRef(), revocation.revokedGeneration());
                    actors.revoked(revocation.terminalRef(), revocation.revokedGeneration());
                    logRevocationApplied(revocation);
                }
            }
            if (System.nanoTime() >= nextHealthCheck) {
                long probeStarted = System.nanoTime();
                try (Statement statement = connection.createStatement()) {
                    statement.execute("SELECT 1");
                }
                long probeFinished = System.nanoTime();
                long intervalMillis = TimeUnit.NANOSECONDS.toMillis(probeStarted - lastHealthCheck);
                long elapsedMillis = TimeUnit.NANOSECONDS.toMillis(probeFinished - probeStarted);
                TdsAsyncLog.enqueue(
                        logScheduler,
                        () -> LOGGER.info(
                                "event=tds_listener_health_probe_completed "
                                        + "backendPid={} intervalMillis={} elapsedMillis={}",
                                backendPid,
                                intervalMillis,
                                elapsedMillis));
                lastHealthCheck = probeFinished;
                nextHealthCheck = probeFinished + HEALTH_INTERVAL_NANOS;
            }
        }
    }

    private Revocation parse(String payload) throws SQLException {
        if (payload == null || payload.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > MAX_PAYLOAD_BYTES) {
            throw new SQLException("TDS_NOTIFICATION_PAYLOAD_INVALID");
        }
        try {
            return parsePayload(payload, objectMapper);
        } catch (RuntimeException failure) {
            throw new SQLException("TDS_NOTIFICATION_PAYLOAD_INVALID", failure);
        }
    }

    static Revocation parsePayload(String payload, ObjectMapper objectMapper) {
        JsonNode node;
        try {
            node = objectMapper.readTree(payload);
        } catch (JacksonException malformed) {
            throw new IllegalArgumentException("TDS_NOTIFICATION_PAYLOAD_INVALID", malformed);
        }
        if (node == null || !node.isObject() || node.propertyNames().size() != 3) {
            throw new IllegalArgumentException("TDS_NOTIFICATION_PAYLOAD_INVALID");
        }
        JsonNode version = node.get("v");
        JsonNode terminal = node.get("terminalRef");
        JsonNode generation = node.get("revokedGeneration");
        if (version == null
                || !version.isIntegralNumber()
                || !version.canConvertToInt()
                || version.asInt() != 1
                || terminal == null
                || !terminal.isString()
                || generation == null
                || !generation.isIntegralNumber()
                || !generation.canConvertToLong()
                || generation.asLong() < 1) {
            throw new IllegalArgumentException("TDS_NOTIFICATION_PAYLOAD_INVALID");
        }
        try {
            UUID terminalRef = UUID.fromString(terminal.asString());
            if (!terminalRef.toString().equals(terminal.asString())) {
                throw new IllegalArgumentException("TDS_NOTIFICATION_PAYLOAD_INVALID");
            }
            return new Revocation(terminalRef, generation.asLong());
        } catch (IllegalArgumentException malformed) {
            throw new IllegalArgumentException("TDS_NOTIFICATION_PAYLOAD_INVALID", malformed);
        }
    }

    private void sleepBeforeRetry(long millis) {
        long deadline = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(millis);
        synchronized (lifecycleMonitor) {
            while (listenerRunning) {
                long remaining = deadline - System.nanoTime();
                if (remaining <= 0) return;
                try {
                    TimeUnit.NANOSECONDS.timedWait(lifecycleMonitor, remaining);
                } catch (InterruptedException interrupted) {
                    Thread.currentThread().interrupt();
                    listenerRunning = false;
                    ready = false;
                    return;
                }
            }
        }
    }

    private void logInfo(String event, int targetCount, int backendPid) {
        TdsAsyncLog.enqueue(
                logScheduler,
                () -> LOGGER.info("event={} targetCount={} backendPid={}", event, targetCount, backendPid));
    }

    private void logRevocationApplied(Revocation revocation) {
        TdsAsyncLog.enqueue(
                logScheduler,
                () -> LOGGER.info(
                        "event=tds_binding_revocation_applied terminalRef={} revokedGeneration={}",
                        revocation.terminalRef(),
                        revocation.revokedGeneration()));
    }

    private void logWarning(String event, String failureType, int backendPid) {
        TdsAsyncLog.enqueue(
                logScheduler,
                () -> LOGGER.warn("event={} failureType={} backendPid={}", event, failureType, backendPid));
    }

    @Override
    public void stop() {
        requestStop(null);
    }

    @Override
    public void stop(Runnable callback) {
        requestStop(Objects.requireNonNull(callback, "callback"));
    }

    private void requestStop(Runnable callback) {
        boolean runCallbackNow = false;
        Thread threadToStop = null;
        synchronized (lifecycleMonitor) {
            if (callback != null) {
                if (workerActive) stopCallbacks.add(callback);
                else runCallbackNow = true;
            }
            if (workerActive) {
                listenerRunning = false;
                ready = false;
                threadToStop = listenerThread;
                lifecycleMonitor.notifyAll();
            }
        }
        if (threadToStop != null) threadToStop.interrupt();
        if (runCallbackNow) callback.run();
    }

    private void finishListener() {
        List<Runnable> callbacks;
        synchronized (lifecycleMonitor) {
            listenerRunning = false;
            ready = false;
            workerActive = false;
            listenerThread = null;
            callbacks = List.copyOf(stopCallbacks);
            stopCallbacks.clear();
            lifecycleMonitor.notifyAll();
        }
        for (Runnable callback : callbacks) {
            try {
                callback.run();
            } catch (RuntimeException failure) {
                logWarning(
                        "tds_listener_stop_callback_failed", failure.getClass().getSimpleName(), -1);
            }
        }
    }

    @Override
    public boolean isRunning() {
        return workerActive;
    }

    @Override
    public boolean isAutoStartup() {
        return true;
    }

    @Override
    public int getPhase() {
        return WebServerApplicationContext.START_STOP_LIFECYCLE_PHASE - 2;
    }

    record Revocation(UUID terminalRef, long revokedGeneration) {}
}
