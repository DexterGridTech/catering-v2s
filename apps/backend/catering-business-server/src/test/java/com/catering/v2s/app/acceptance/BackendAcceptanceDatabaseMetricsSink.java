package com.catering.v2s.app.acceptance;

import com.catering.v2s.platform.foundation.persistence.DatabaseOperationTracker;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.atomic.AtomicInteger;

/** Test-visible observer of the production request interceptor; it neither counts nor gates DB work. */
public final class BackendAcceptanceDatabaseMetricsSink implements DatabaseOperationTracker.MeasurementSink {
    private final ConcurrentMap<String, DatabaseOperationTracker.Snapshot> snapshots = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, AtomicInteger> observationCounts = new ConcurrentHashMap<>();

    @Override
    public void accept(String correlationId, DatabaseOperationTracker.Snapshot snapshot) {
        if (correlationId == null || snapshot == null) return;
        snapshots.put(correlationId, snapshot);
        observationCounts
                .computeIfAbsent(correlationId, ignored -> new AtomicInteger())
                .incrementAndGet();
    }

    public DatabaseOperationTracker.Snapshot snapshotFor(String correlationId) {
        return snapshots.get(correlationId);
    }

    public int observationCountFor(String correlationId) {
        AtomicInteger count = observationCounts.get(correlationId);
        return count == null ? 0 : count.get();
    }
}
