package com.catering.v2s.app.acceptance;

import com.catering.v2s.platform.foundation.persistence.DatabaseOperationTracker;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;

/** Wires the existing production interceptor snapshot into this focused HTTP test. */
@TestConfiguration(proxyBeanMethods = false)
public class BackendAcceptanceMetricsConfiguration {
    @Bean
    BackendAcceptanceDatabaseMetricsSink backendAcceptanceDatabaseMetricsSink() {
        return new BackendAcceptanceDatabaseMetricsSink();
    }

    @Bean(destroyMethod = "close")
    DatabaseOperationTracker.MeasurementSinkRegistration backendAcceptanceMeasurementSinkRegistration(
            BackendAcceptanceDatabaseMetricsSink sink) {
        return DatabaseOperationTracker.installMeasurementSink(sink);
    }
}
