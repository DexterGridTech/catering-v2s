package com.catering.v2s.app.acceptance;

import com.catering.v2s.platform.foundation.persistence.DatabaseOperationTracker;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

/** Test-visible observer of the production request interceptor; it neither counts nor gates DB work. */
public final class BackendAcceptanceDatabaseMetricsSink implements DatabaseOperationTracker.MeasurementSink {
    private final ConcurrentMap<String, DatabaseOperationTracker.Snapshot> snapshots = new ConcurrentHashMap<>();

    @Override
    public void accept(String correlationId, DatabaseOperationTracker.Snapshot snapshot) {
        if (correlationId != null && snapshot != null) snapshots.put(correlationId, snapshot);
    }

    public DatabaseOperationTracker.Snapshot snapshotFor(String correlationId) {
        return snapshots.get(correlationId);
    }
}
