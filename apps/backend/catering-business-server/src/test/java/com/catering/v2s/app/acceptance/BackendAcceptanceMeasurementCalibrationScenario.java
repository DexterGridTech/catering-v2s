package com.catering.v2s.app.acceptance;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.List;
import java.util.Objects;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Immutable known-cost calibration fixture. Expected values are derived from this definition,
 * never from the measured snapshot or accepted baseline.
 */
public final class BackendAcceptanceMeasurementCalibrationScenario {
    public static final String SCENARIO_ID = "backendAcceptanceMeasurementSinkIntegrity";
    public static final String FAILURE_PREFIX = "MEASUREMENT_SINK_INTEGRITY_FAILED:";
    public static final List<String> METRICS = List.of("LOGICAL_SQL", "QUERY", "UPDATE", "CONNECTION", "TRANSACTION", "BATCH");

    private static final FixtureDefinition FIXTURE = new FixtureDefinition(2, 3, 1, 0, 1);

    private BackendAcceptanceMeasurementCalibrationScenario() { }

    public static FixtureDefinition fixtureDefinition() { return FIXTURE; }

    public static BackendAcceptanceDatabaseMetricsSink.Metrics expectedMetrics() {
        return FIXTURE.expectedMetrics();
    }

    /** Executes the one-connection, one-origin fixture through the production DataSource wrapper. */
    public static void execute(JdbcTemplate jdbcTemplate) {
        execute(jdbcTemplate, 1_000_000L);
    }

    public static void execute(JdbcTemplate jdbcTemplate, long fixtureBaseId) {
        if (fixtureBaseId < 1 || fixtureBaseId > Long.MAX_VALUE - FIXTURE.insertCount() - 1L) {
            throw new IllegalArgumentException("calibration fixture base id invalid");
        }
        Objects.requireNonNull(jdbcTemplate, "jdbcTemplate").execute((ConnectionCallback<Void>) connection -> {
            connection.setAutoCommit(false);
            try (PreparedStatement insert = connection.prepareStatement(
                    "INSERT INTO backend_acceptance_measurement_calibration (id, value) VALUES (?, ?)")) {
                for (int id = 1; id <= FIXTURE.insertCount(); id++) {
                    insert.setLong(1, fixtureBaseId + id);
                    insert.setString(2, "fixture-" + id);
                    insert.executeUpdate();
                }
            }
            try (PreparedStatement select = connection.prepareStatement(
                "SELECT value FROM backend_acceptance_measurement_calibration WHERE id = ?")) {
                for (int id = 1; id <= FIXTURE.selectCount(); id++) {
                    select.setLong(1, fixtureBaseId + ((id - 1) % FIXTURE.insertCount()) + 1L);
                    try (ResultSet result = select.executeQuery()) {
                        if (!result.next()) throw new IllegalStateException("calibration fixture readback missing");
                    }
                }
            }
            // The managed connection is released after the callback. The explicit begin is the
            // one deterministic transaction-origin observation in this calibration fixture.
            return null;
        });
    }

    public static Receipt verify(String correlationId, BackendAcceptanceDatabaseMetricsSink sink) {
        BackendAcceptanceDatabaseMetricsSink.Metrics expected = expectedMetrics();
        java.util.Map<String, Long> actualValues = sink == null ? null : sink.metricValuesFor(correlationId);
        if (actualValues == null) fail("LOGICAL_SQL", expected.logicalSql(), 0, correlationId);
        for (String metric : METRICS) {
            long expectedValue = expected.value(metric);
            Long actualValue = actualValues.get(metric);
            if (actualValue == null || expectedValue != actualValue) fail(metric, expectedValue, actualValue == null ? -1 : actualValue, correlationId);
        }
        BackendAcceptanceDatabaseMetricsSink.Metrics actual = sink.metricsFor(correlationId);
        return new Receipt(SCENARIO_ID, correlationId, expected, actual);
    }

    private static void fail(String metric, long expected, long actual, String correlationId) {
        throw new IllegalStateException(FAILURE_PREFIX + metric
                + ":expected=" + expected + ":actual=" + actual + ":correlationId=" + safeCorrelation(correlationId));
    }

    private static String safeCorrelation(String value) {
        return value != null && value.matches("[A-Za-z0-9._:-]{1,128}") ? value : "INVALID";
    }

    public record FixtureDefinition(int insertCount, int selectCount, int transactionCount, int batchCount, int connectionCount) {
        public FixtureDefinition {
            if (insertCount < 0 || selectCount < 0 || transactionCount < 0 || batchCount < 0 || connectionCount < 0) {
                throw new IllegalArgumentException("negative calibration fixture definition");
            }
        }

        public BackendAcceptanceDatabaseMetricsSink.Metrics expectedMetrics() {
            return new BackendAcceptanceDatabaseMetricsSink.Metrics(
                    insertCount + selectCount,
                    selectCount,
                    insertCount,
                    connectionCount,
                    transactionCount,
                    batchCount);
        }
    }

    public record Receipt(String scenarioId, String correlationId,
                          BackendAcceptanceDatabaseMetricsSink.Metrics expected,
                          BackendAcceptanceDatabaseMetricsSink.Metrics actual) { }
}
