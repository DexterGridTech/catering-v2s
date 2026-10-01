package com.catering.v2s.terminaldataserver.session;

import com.catering.v2s.terminaldataserver.config.TdsRuntimeSettings;
import com.catering.v2s.terminaldataserver.observability.TdsAsyncLog;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.availability.AvailabilityChangeEvent;
import org.springframework.boot.availability.ReadinessState;
import org.springframework.boot.web.server.context.WebServerApplicationContext;
import org.springframework.context.ApplicationContext;
import org.springframework.context.SmartLifecycle;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Scheduler;

/** Withdraws readiness, allows the load balancer to drain, then rejects and redirects sessions. */
@Component
public final class TdsGracefulShutdownLifecycle implements SmartLifecycle {
    private static final Logger LOGGER = LoggerFactory.getLogger(TdsGracefulShutdownLifecycle.class);

    private final TdsTerminalSessionActors actors;
    private final TdsRuntimeSettings settings;
    private final ApplicationContext applicationContext;
    private final Scheduler logScheduler;
    private final Object monitor = new Object();
    private final List<Runnable> stopCallbacks = new ArrayList<>();
    private boolean running;
    private boolean stopping;
    private boolean stopped;

    public TdsGracefulShutdownLifecycle(
            TdsTerminalSessionActors actors,
            TdsRuntimeSettings settings,
            ApplicationContext applicationContext,
            @Qualifier("tds-log-worker") Scheduler logScheduler) {
        this.actors = Objects.requireNonNull(actors, "actors");
        this.settings = Objects.requireNonNull(settings, "settings");
        this.applicationContext = Objects.requireNonNull(applicationContext, "applicationContext");
        this.logScheduler = Objects.requireNonNull(logScheduler, "logScheduler");
    }

    @Override
    public void start() {
        synchronized (monitor) {
            running = true;
            stopping = false;
            stopped = false;
            stopCallbacks.clear();
        }
    }

    @Override
    public void stop() {
        stop(() -> {});
    }

    @Override
    public void stop(Runnable callback) {
        Objects.requireNonNull(callback, "callback");
        boolean beginStop;
        boolean alreadyStopped;
        synchronized (monitor) {
            alreadyStopped = stopped || !running;
            if (alreadyStopped) {
                beginStop = false;
            } else {
                stopCallbacks.add(callback);
                beginStop = !stopping;
                stopping = true;
            }
        }
        if (alreadyStopped) {
            callback.run();
            return;
        }
        if (!beginStop) return;

        AvailabilityChangeEvent.publish(applicationContext, ReadinessState.REFUSING_TRAFFIC);
        TdsAsyncLog.enqueue(
                logScheduler,
                () -> LOGGER.info(
                        "event=tds_readiness_withdrawn admission=OPEN withdrawalWaitMillis={} drainWindowMillis={}",
                        settings.readinessWithdrawalWait().toMillis(),
                        settings.drainWindow().toMillis()));
        Mono.delay(settings.readinessWithdrawalWait())
                .then(Mono.defer(() -> {
                    actors.refuseNewConnections();
                    long drainStartedNanos = System.nanoTime();
                    Mono<Boolean> drain = actors.beginDrain();
                    // Emit both markers in one ordered log task, after beginDrain has made its
                    // synchronous admission/session transition, so acceptance can observe the
                    // production phase boundary without racing separate log-worker tasks.
                    TdsAsyncLog.enqueue(logScheduler, () -> {
                        LOGGER.info("event=tds_admission_refused readiness=REFUSING_TRAFFIC");
                        LOGGER.info("event=tds_drain_started");
                    });
                    return drain.flatMap(hasActiveSessions -> {
                        long remainingNanos =
                                settings.drainWindow().toNanos() - (System.nanoTime() - drainStartedNanos);
                        return hasActiveSessions && remainingNanos > 0
                                ? Mono.delay(Duration.ofNanos(remainingNanos)).then()
                                : Mono.empty();
                    });
                }))
                .then(Mono.defer(actors::finishDrain))
                .doOnError(failure -> TdsAsyncLog.enqueue(
                        logScheduler,
                        () -> LOGGER.warn(
                                "event=tds_drain_failed failureType={}",
                                failure.getClass().getSimpleName())))
                .onErrorComplete()
                .doFinally(ignored -> completeStop())
                .subscribe();
    }

    private void completeStop() {
        List<Runnable> callbacks;
        synchronized (monitor) {
            if (stopped) return;
            running = false;
            stopping = false;
            stopped = true;
            callbacks = List.copyOf(stopCallbacks);
            stopCallbacks.clear();
        }
        TdsAsyncLog.enqueue(logScheduler, () -> LOGGER.info("event=tds_drain_completed"));
        for (Runnable callback : callbacks) {
            try {
                callback.run();
            } catch (RuntimeException failure) {
                TdsAsyncLog.enqueue(
                        logScheduler,
                        () -> LOGGER.warn(
                                "event=tds_drain_callback_failed failureType={}",
                                failure.getClass().getSimpleName()));
            }
        }
    }

    @Override
    public boolean isRunning() {
        synchronized (monitor) {
            return running;
        }
    }

    @Override
    public boolean isAutoStartup() {
        return true;
    }

    @Override
    public int getPhase() {
        return WebServerApplicationContext.GRACEFUL_SHUTDOWN_PHASE + 1;
    }
}
