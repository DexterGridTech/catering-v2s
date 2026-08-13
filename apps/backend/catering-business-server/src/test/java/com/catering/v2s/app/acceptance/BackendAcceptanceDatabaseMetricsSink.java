package com.catering.v2s.app.acceptance;

import com.catering.v2s.platform.foundation.persistence.DatabaseOperationTracker;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.function.Function;

/**
 * Test-visible observer for the production request tracker. It stores completed snapshots by
 * correlation id; it does not intercept JDBC work or maintain a second counter.
 */
public final class BackendAcceptanceDatabaseMetricsSink implements DatabaseOperationTracker.MeasurementSink {
    private final ConcurrentMap<String, Observation> observations = new ConcurrentHashMap<>();
    private final Function<DatabaseOperationTracker.Snapshot, Map<String, Long>> metricProjector;

    public BackendAcceptanceDatabaseMetricsSink() {
        this(BackendAcceptanceDatabaseMetricsSink::projectMetrics);
    }

    BackendAcceptanceDatabaseMetricsSink(Function<DatabaseOperationTracker.Snapshot, Map<String, Long>> metricProjector) {
        this.metricProjector = Objects.requireNonNull(metricProjector, "metricProjector");
    }

    @Override
    public void accept(String correlationId, DatabaseOperationTracker.Snapshot snapshot) {
        if (correlationId == null || !correlationId.matches("[A-Za-z0-9._:-]{1,128}")) {
            throw new IllegalArgumentException("MEASUREMENT_SINK_INTEGRITY_FAILED:CORRELATION");
        }
        Map<String, Long> metrics = metricProjector.apply(Objects.requireNonNull(snapshot, "snapshot"));
        if (metrics == null) throw new IllegalArgumentException("MEASUREMENT_SINK_INTEGRITY_FAILED:METRICS");
        Map<String, Long> copy = new LinkedHashMap<>();
        metrics.forEach((metric, value) -> {
            if (!BackendAcceptanceMeasurementCalibrationScenario.METRICS.contains(metric)
                    || value == null || value < 0) throw new IllegalArgumentException("MEASUREMENT_SINK_INTEGRITY_FAILED:" + metric);
            copy.put(metric, value);
        });
        observations.put(correlationId, new Observation(snapshot, Map.copyOf(copy)));
    }

    public DatabaseOperationTracker.Snapshot snapshotFor(String correlationId) {
        Observation observation = observations.get(correlationId);
        return observation == null ? null : observation.snapshot();
    }

    public Map<String, Long> metricValuesFor(String correlationId) {
        Observation observation = observations.get(correlationId);
        return observation == null ? null : observation.metrics();
    }

    public Metrics metricsFor(String correlationId) {
        Map<String, Long> values = metricValuesFor(correlationId);
        if (values == null || !values.keySet().containsAll(BackendAcceptanceMeasurementCalibrationScenario.METRICS)) return null;
        return new Metrics(
                values.get("LOGICAL_SQL"), values.get("QUERY"), values.get("UPDATE"),
                values.get("CONNECTION"), values.get("TRANSACTION"), values.get("BATCH"));
    }

    public void clear() { observations.clear(); }

    static Map<String, Long> projectMetrics(DatabaseOperationTracker.Snapshot snapshot) {
        Map<String, Long> kinds = snapshot.kindCounts();
        Map<String, Long> result = new LinkedHashMap<>();
        // LOGICAL_SQL is the deterministic SQL statement denominator, not the physical
        // connection/transaction interaction count. The production snapshot intentionally
        // keeps those interactions in its cumulative logical field for legacy diagnostics;
        // this acceptance projection derives the six-metric contract from the same operations
        // so calibration and route evidence use one explicit meaning.
        long logicalSql = snapshot.operations().stream()
                .filter(operation -> "QUERY".equals(operation.kind())
                        || "UPDATE".equals(operation.kind()))
                .mapToLong(DatabaseOperationTracker.Operation::batchSize)
                .sum()
                + snapshot.batchStatementTotal();
        result.put("LOGICAL_SQL", logicalSql);
        result.put("QUERY", kinds.getOrDefault("QUERY", 0L));
        result.put("UPDATE", kinds.getOrDefault("UPDATE", 0L));
        result.put("CONNECTION", kinds.getOrDefault("CONNECTION", 0L));
        result.put("TRANSACTION", kinds.getOrDefault("TRANSACTION", 0L));
        result.put("BATCH", kinds.getOrDefault("BATCH", 0L));
        return result;
    }

    private record Observation(DatabaseOperationTracker.Snapshot snapshot, Map<String, Long> metrics) { }

    public record Metrics(long logicalSql, long query, long update, long connection, long transaction, long batch) {
        public Metrics {
            if (logicalSql < 0 || query < 0 || update < 0 || connection < 0 || transaction < 0 || batch < 0) {
                throw new IllegalArgumentException("negative backend acceptance metric");
            }
        }

        public long value(String metric) {
            return switch (metric) {
                case "LOGICAL_SQL" -> logicalSql;
                case "QUERY" -> query;
                case "UPDATE" -> update;
                case "CONNECTION" -> connection;
                case "TRANSACTION" -> transaction;
                case "BATCH" -> batch;
                default -> throw new IllegalArgumentException("unknown backend acceptance metric: " + metric);
            };
        }
    }
}
