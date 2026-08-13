package com.catering.v2s.app.acceptance;

import com.catering.v2s.platform.foundation.persistence.DatabaseOperationTracker;
import jakarta.annotation.PreDestroy;
import java.util.concurrent.atomic.AtomicLong;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

/** Test-only calibration route; it is not part of the semantic operation registry. */
@TestConfiguration(proxyBeanMethods = false)
public class BackendAcceptanceMeasurementCalibrationConfiguration {
    @Bean
    BackendAcceptanceDatabaseMetricsSink backendAcceptanceDatabaseMetricsSink() {
        return new BackendAcceptanceDatabaseMetricsSink();
    }

    @Bean(destroyMethod = "close")
    DatabaseOperationTracker.MeasurementSinkRegistration backendAcceptanceMeasurementSinkRegistration(
            BackendAcceptanceDatabaseMetricsSink sink) {
        return DatabaseOperationTracker.installMeasurementSink(sink);
    }

    @Bean
    ApplicationRunner backendAcceptanceMeasurementCalibrationFixtureRunner(
            BackendAcceptanceMeasurementCalibrationController controller) {
        return arguments -> controller.prepareFixtureTable();
    }

    @RestController
    @RequestMapping("/__backend-acceptance")
    static final class BackendAcceptanceMeasurementCalibrationController {
        private static final String TABLE = "backend_acceptance_measurement_calibration";
        private final JdbcTemplate jdbcTemplate;
        private final AtomicLong nextFixtureBaseId = new AtomicLong(1_000_000L);

        BackendAcceptanceMeasurementCalibrationController(JdbcTemplate jdbcTemplate) {
            this.jdbcTemplate = jdbcTemplate;
        }

        void prepareFixtureTable() {
            jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS " + TABLE + " (id BIGINT PRIMARY KEY, value VARCHAR(128) NOT NULL)");
        }

        @PreDestroy
        void removeFixtureTable() {
            jdbcTemplate.execute("DROP TABLE IF EXISTS " + TABLE);
        }

        @PostMapping("/measurement-calibration")
        CalibrationResponse calibrate(@RequestHeader("X-Correlation-Id") String correlationId) {
            BackendAcceptanceMeasurementCalibrationScenario.execute(jdbcTemplate, nextFixtureBaseId.getAndAdd(10L));
            return new CalibrationResponse("PASS", BackendAcceptanceMeasurementCalibrationScenario.SCENARIO_ID);
        }
    }

    record CalibrationResponse(String status, String scenarioId) { }
}
