package com.catering.v2s.terminaldataserver.history;

import com.catering.v2s.terminaldataserver.history.TdsConnectionHistoryEvent.EventType;
import com.catering.v2s.terminaldataserver.history.TdsDorisStreamLoadClient.Disposition;
import com.catering.v2s.terminaldataserver.history.TdsDorisStreamLoadClient.LoadResult;
import com.catering.v2s.terminaldataserver.observability.TdsAsyncLog;
import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import reactor.core.Disposable;
import reactor.core.scheduler.Scheduler;
import tools.jackson.databind.ObjectMapper;

/** Bounded, best-effort Doris history sink isolated from TDS protocol, PG and HTTP request threads. */
@Component
public final class TdsConnectionHistoryWriter implements org.springframework.context.SmartLifecycle {
    static final int MAX_QUEUE_EVENTS = 4_096;
    static final int MAX_EVENT_BYTES = 1_024;
    static final int MAX_QUEUE_BYTES = 4 * 1024 * 1024;
    static final int MAX_BATCH_EVENTS = 128;
    static final int MAX_BATCH_BYTES = 128 * 1024;
    static final int MAX_ATTEMPTS = 3;
    private static final long[] RETRY_BACKOFF_MILLIS = {100, 500};
    private static final long FLUSH_INTERVAL_MILLIS = 250;
    private static final Logger LOGGER = LoggerFactory.getLogger(TdsConnectionHistoryWriter.class);

    private final ArrayBlockingQueue<QueuedEvent> queue = new ArrayBlockingQueue<>(MAX_QUEUE_EVENTS);
    private final AtomicInteger outstandingEvents = new AtomicInteger();
    private final AtomicInteger outstandingBytes = new AtomicInteger();
    private final AtomicLong enqueued = new AtomicLong();
    private final AtomicLong dropped = new AtomicLong();
    private final AtomicLong loaded = new AtomicLong();
    private final AtomicLong failed = new AtomicLong();
    private final AtomicLong retries = new AtomicLong();
    private final AtomicBoolean running = new AtomicBoolean();
    private final AtomicBoolean flushing = new AtomicBoolean();
    private final TdsDorisStreamLoadClient client;
    private final ObjectMapper objectMapper;
    private final Scheduler writerScheduler;
    private final Scheduler logScheduler;
    private volatile Disposable periodicFlush;

    public TdsConnectionHistoryWriter(
            TdsDorisStreamLoadClient client,
            @org.springframework.beans.factory.annotation.Qualifier("tds-wire-object-mapper") ObjectMapper objectMapper,
            @Qualifier("tds-doris-worker") Scheduler writerScheduler,
            @Qualifier("tds-log-worker") Scheduler logScheduler) {
        this.client = Objects.requireNonNull(client, "client");
        this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper");
        this.writerScheduler = Objects.requireNonNull(writerScheduler, "writerScheduler");
        this.logScheduler = Objects.requireNonNull(logScheduler, "logScheduler");
    }

    public boolean recordConnected(TdsConnectionHistoryEvent event) {
        return enqueue(requireType(event, EventType.CONNECTED));
    }

    public boolean recordDisconnected(TdsConnectionHistoryEvent event) {
        return enqueue(requireType(event, EventType.DISCONNECTED));
    }

    public boolean recordHeartbeat(TdsConnectionHistoryEvent event) {
        return enqueue(requireType(event, EventType.HEARTBEAT_RTT));
    }

    private boolean enqueue(TdsConnectionHistoryEvent event) {
        byte[] payload;
        try {
            payload = objectMapper.writeValueAsBytes(event.toDorisRow());
        } catch (RuntimeException failure) {
            return drop("SERIALIZATION_FAILED", event.eventType());
        }
        if (payload.length > MAX_EVENT_BYTES) return drop("EVENT_LIMIT_EXCEEDED", event.eventType());
        if (!reserve(payload.length)) return drop("QUEUE_FULL", event.eventType());
        if (!queue.offer(new QueuedEvent(event.eventType(), payload))) {
            release(payload.length);
            return drop("QUEUE_FULL", event.eventType());
        }
        enqueued.incrementAndGet();
        return true;
    }

    private static TdsConnectionHistoryEvent requireType(TdsConnectionHistoryEvent event, EventType expected) {
        Objects.requireNonNull(event, "event");
        if (event.eventType() != expected) throw new IllegalArgumentException("TDS_HISTORY_EVENT_TYPE_MISMATCH");
        return event;
    }

    private boolean reserve(int bytes) {
        while (true) {
            int currentCount = outstandingEvents.get();
            if (currentCount >= MAX_QUEUE_EVENTS || !outstandingEvents.compareAndSet(currentCount, currentCount + 1)) {
                if (currentCount >= MAX_QUEUE_EVENTS) return false;
                continue;
            }
            while (true) {
                int currentBytes = outstandingBytes.get();
                if (currentBytes + bytes > MAX_QUEUE_BYTES) {
                    outstandingEvents.decrementAndGet();
                    return false;
                }
                if (outstandingBytes.compareAndSet(currentBytes, currentBytes + bytes)) return true;
            }
        }
    }

    private void release(int bytes) {
        outstandingEvents.decrementAndGet();
        outstandingBytes.addAndGet(-bytes);
    }

    private boolean drop(String reason, EventType type) {
        long total = dropped.incrementAndGet();
        TdsAsyncLog.enqueue(
                logScheduler,
                () -> LOGGER.warn(
                        "event=tds_doris_history_event_dropped reason={} eventType={} "
                                + "queueDepth={} queueBytes={} totalDropped={}",
                        reason,
                        type,
                        outstandingEvents.get(),
                        outstandingBytes.get(),
                        total));
        return false;
    }

    @Override
    public void start() {
        if (!running.compareAndSet(false, true)) return;
        periodicFlush = writerScheduler.schedulePeriodically(
                this::flushOneBatch, FLUSH_INTERVAL_MILLIS, FLUSH_INTERVAL_MILLIS, TimeUnit.MILLISECONDS);
        TdsAsyncLog.enqueue(
                logScheduler,
                () -> LOGGER.info(
                        "event=tds_doris_history_writer_started flushIntervalMillis={}", FLUSH_INTERVAL_MILLIS));
    }

    @Override
    public void stop() {
        if (!running.compareAndSet(true, false)) return;
        Disposable scheduled = periodicFlush;
        if (scheduled != null) scheduled.dispose();
        TdsAsyncLog.enqueue(
                logScheduler,
                () -> LOGGER.info(
                        "event=tds_doris_history_writer_stopped pendingEvents={} pendingBytes={} "
                                + "dropped={} loaded={} failed={}",
                        outstandingEvents.get(),
                        outstandingBytes.get(),
                        dropped.get(),
                        loaded.get(),
                        failed.get()));
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
        return Integer.MIN_VALUE + 2;
    }

    void flushOneBatch() {
        if (!flushing.compareAndSet(false, true)) return;
        List<QueuedEvent> events = List.of();
        boolean batchReleased = false;
        try {
            events = drainBatch();
            if (events.isEmpty()) return;
            Batch batch = toBatch(events);
            long startedNanos = System.nanoTime();
            LoadResult lastResult = null;
            int attempts = 0;
            for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
                attempts = attempt;
                lastResult = client.load(batch.label(), batch.payload());
                if (lastResult.disposition() == Disposition.COMPLETE) {
                    loaded.addAndGet(events.size());
                    releaseBatch(events);
                    batchReleased = true;
                    logBatch(
                            "loaded",
                            batch,
                            events.size(),
                            attempts,
                            System.nanoTime() - startedNanos,
                            lastResult.reason());
                    return;
                }
                if (lastResult.disposition() == Disposition.FAILED) break;
                if (attempt < MAX_ATTEMPTS) {
                    retries.incrementAndGet();
                    try {
                        Thread.sleep(RETRY_BACKOFF_MILLIS[attempt - 1]);
                    } catch (InterruptedException interrupted) {
                        Thread.currentThread().interrupt();
                        lastResult = LoadResult.retry("INTERRUPTED");
                        break;
                    }
                }
            }
            failed.addAndGet(events.size());
            releaseBatch(events);
            batchReleased = true;
            logBatch(
                    "dropped_after_retry",
                    batch,
                    events.size(),
                    attempts,
                    System.nanoTime() - startedNanos,
                    lastResult == null ? "NO_RESULT" : lastResult.reason());
        } catch (RuntimeException failure) {
            if (!events.isEmpty() && !batchReleased) {
                failed.addAndGet(events.size());
                releaseBatch(events);
            }
            TdsAsyncLog.enqueue(
                    logScheduler,
                    () -> LOGGER.error(
                            "event=tds_doris_history_flush_failed failureType={} queueDepth={} queueBytes={}",
                            failure.getClass().getSimpleName(),
                            outstandingEvents.get(),
                            outstandingBytes.get()));
        } finally {
            flushing.set(false);
        }
    }

    private List<QueuedEvent> drainBatch() {
        List<QueuedEvent> events = new ArrayList<>(MAX_BATCH_EVENTS);
        int bytes = 0;
        while (events.size() < MAX_BATCH_EVENTS) {
            QueuedEvent next = queue.peek();
            if (next == null) break;
            int nextSize = next.payload().length + (events.isEmpty() ? 0 : 1);
            if (bytes + nextSize > MAX_BATCH_BYTES) break;
            QueuedEvent taken = queue.poll();
            if (taken == null) continue;
            events.add(taken);
            bytes += nextSize;
        }
        return events;
    }

    private Batch toBatch(List<QueuedEvent> events) {
        ByteArrayOutputStream body = new ByteArrayOutputStream();
        for (int index = 0; index < events.size(); index++) {
            if (index > 0) body.write('\n');
            body.writeBytes(events.get(index).payload());
        }
        return new Batch(UUID.randomUUID().toString(), body.toByteArray());
    }

    private void releaseBatch(List<QueuedEvent> events) {
        events.forEach(event -> release(event.payload().length));
    }

    private void logBatch(String outcome, Batch batch, int eventCount, int attempts, long elapsedNanos, String reason) {
        TdsAsyncLog.enqueue(
                logScheduler,
                () -> LOGGER.info(
                        "event=tds_doris_history_batch_{} label={} eventCount={} "
                                + "payloadBytes={} attempts={} elapsedMillis={} reason={} "
                                + "queueDepth={} queueBytes={} enqueued={} dropped={} loaded={} "
                                + "failed={} retries={}",
                        outcome,
                        batch.label(),
                        eventCount,
                        batch.payload().length,
                        attempts,
                        TimeUnit.NANOSECONDS.toMillis(elapsedNanos),
                        reason,
                        outstandingEvents.get(),
                        outstandingBytes.get(),
                        enqueued.get(),
                        dropped.get(),
                        loaded.get(),
                        failed.get(),
                        retries.get()));
    }

    int pendingEventCount() {
        return outstandingEvents.get();
    }

    int pendingByteCount() {
        return outstandingBytes.get();
    }

    long enqueuedCount() {
        return enqueued.get();
    }

    long droppedCount() {
        return dropped.get();
    }

    long loadedCount() {
        return loaded.get();
    }

    long failedCount() {
        return failed.get();
    }

    long retryCount() {
        return retries.get();
    }

    private record QueuedEvent(EventType type, byte[] payload) {}

    private record Batch(String label, byte[] payload) {}
}
