package com.catering.v2s.app.acceptance;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.catering.v2s.platform.foundation.persistence.DatabaseOperationTracker;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class BackendAcceptanceDatabaseMetricsSinkTest {
    private static final String CORRELATION = "calibration-correlation-1";

    @Test
    void acceptsTheCompleteTrackerProjection() {
        BackendAcceptanceDatabaseMetricsSink sink = new BackendAcceptanceDatabaseMetricsSink();
        sink.accept(CORRELATION, calibrationSnapshot());

        BackendAcceptanceMeasurementCalibrationScenario.Receipt receipt =
                BackendAcceptanceMeasurementCalibrationScenario.verify(CORRELATION, sink);

        assertEquals(receipt.expected(), receipt.actual());
    }

    @Test
    void noOpSinkAndWrongCorrelationAreRed() {
        IllegalStateException noOp = assertThrows(IllegalStateException.class,
                () -> BackendAcceptanceMeasurementCalibrationScenario.verify(CORRELATION, new BackendAcceptanceDatabaseMetricsSink()));
        assertEquals("MEASUREMENT_SINK_INTEGRITY_FAILED:LOGICAL_SQL:expected=5:actual=0:correlationId=" + CORRELATION, noOp.getMessage());

        BackendAcceptanceDatabaseMetricsSink wrongCorrelation = new BackendAcceptanceDatabaseMetricsSink();
        wrongCorrelation.accept("other-correlation-1", calibrationSnapshot());
        IllegalStateException wrong = assertThrows(IllegalStateException.class,
                () -> BackendAcceptanceMeasurementCalibrationScenario.verify(CORRELATION, wrongCorrelation));
        assertEquals("MEASUREMENT_SINK_INTEGRITY_FAILED:LOGICAL_SQL:expected=5:actual=0:correlationId=" + CORRELATION, wrong.getMessage());
    }

    @Test
    void everyOmittedMetricIsRedIncludingZeroValuedBatch() {
        for (String omittedMetric : BackendAcceptanceMeasurementCalibrationScenario.METRICS) {
            BackendAcceptanceDatabaseMetricsSink sink = new BackendAcceptanceDatabaseMetricsSink(snapshot -> {
                Map<String, Long> values = new java.util.LinkedHashMap<>(BackendAcceptanceDatabaseMetricsSink.projectMetrics(snapshot));
                values.remove(omittedMetric);
                return values;
            });
            sink.accept(CORRELATION, calibrationSnapshot());

            IllegalStateException failure = assertThrows(IllegalStateException.class,
                    () -> BackendAcceptanceMeasurementCalibrationScenario.verify(CORRELATION, sink));
            assertEquals("MEASUREMENT_SINK_INTEGRITY_FAILED:" + omittedMetric, failure.getMessage().substring(0, ("MEASUREMENT_SINK_INTEGRITY_FAILED:" + omittedMetric).length()));
        }
    }

    private static DatabaseOperationTracker.Snapshot calibrationSnapshot() {
        List<DatabaseOperationTracker.Operation> operations = new ArrayList<>();
        operations.add(new DatabaseOperationTracker.Operation("UPDATE", 0));
        operations.add(new DatabaseOperationTracker.Operation("UPDATE", 0));
        operations.add(new DatabaseOperationTracker.Operation("QUERY", 0));
        operations.add(new DatabaseOperationTracker.Operation("QUERY", 0));
        operations.add(new DatabaseOperationTracker.Operation("QUERY", 0));
        operations.add(new DatabaseOperationTracker.Operation("CONNECTION", 0));
        operations.add(new DatabaseOperationTracker.Operation("TRANSACTION", 0));
        return new DatabaseOperationTracker.Snapshot(operations.size(), 5, 0, 0, 0, operations, Map.of(), List.of(), Map.of(), List.of());
    }
}
