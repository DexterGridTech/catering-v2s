package com.catering.v2s.terminaldataserver.observability;

import java.util.Objects;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.atomic.AtomicLong;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import reactor.core.scheduler.Scheduler;

/** Queues immutable, already-redacted log events away from Netty and Reactor event-loop threads. */
public final class TdsAsyncLog {
    private static final Logger LOGGER = LoggerFactory.getLogger(TdsAsyncLog.class);
    private static final AtomicLong DROPPED_EVENTS = new AtomicLong();

    private TdsAsyncLog() {}

    public static void enqueue(Scheduler scheduler, Runnable logEvent) {
        Objects.requireNonNull(scheduler, "scheduler");
        Objects.requireNonNull(logEvent, "logEvent");
        try {
            scheduler.schedule(() -> {
                long dropped = DROPPED_EVENTS.getAndSet(0);
                if (dropped > 0) {
                    LOGGER.error("event=tds_diagnostic_log_queue_recovered droppedEventCount={}", dropped);
                }
                logEvent.run();
            });
        } catch (RejectedExecutionException saturated) {
            DROPPED_EVENTS.updateAndGet(current -> current == Long.MAX_VALUE ? current : current + 1);
        }
    }
}
