package com.catering.v2s.terminaldataserver.config;

import java.time.Duration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import reactor.core.scheduler.Scheduler;
import reactor.core.scheduler.Schedulers;

/** Binds required admission capacities and validates TDS timing before the server starts. */
@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(TdsRuntimeProperties.class)
public class TdsSettingsConfiguration {
    private static final int LOG_QUEUE_CAPACITY_PER_THREAD = 1_024;

    @Bean
    TdsRuntimeSettings tdsRuntimeSettings(TdsRuntimeProperties properties) {
        return TdsRuntimeSettings.from(
                properties.maxUnauthenticatedConnections(),
                properties.maxTrackedSessions(),
                Duration.ofMillis(properties.heartbeatIntervalMs()),
                Duration.ofMillis(properties.heartbeatTimeoutMs()),
                Duration.ofMillis(properties.stateWriteIntervalMs()),
                Duration.ofMillis(properties.drainWindowMs()),
                properties.nodeId(),
                Duration.ofMillis(properties.readinessWithdrawalWaitMs()));
    }

    @Bean(name = "tds-db-worker", destroyMethod = "dispose")
    Scheduler tdsDbWorker(TdsRuntimeSettings settings) {
        int capacity = plusBounded(settings.maxUnauthenticatedConnections(), 2);
        return Schedulers.newBoundedElastic(capacity, capacity, "tds-db-worker");
    }

    @Bean(name = "tds-log-worker", destroyMethod = "dispose")
    Scheduler tdsLogWorker(TdsRuntimeSettings settings) {
        int capacity = workerCapacity(settings);
        return Schedulers.newBoundedElastic(capacity, LOG_QUEUE_CAPACITY_PER_THREAD, "tds-log-worker");
    }

    @Bean(name = "tds-identity-worker", destroyMethod = "dispose")
    Scheduler tdsIdentityWorker(TdsRuntimeSettings settings) {
        int capacity = settings.maxUnauthenticatedConnections();
        return Schedulers.newBoundedElastic(capacity, capacity, "tds-identity-worker");
    }

    @Bean(name = "tds-codec-worker", destroyMethod = "dispose")
    Scheduler tdsCodecWorker(TdsRuntimeSettings settings) {
        int capacity = workerCapacity(settings);
        return Schedulers.newBoundedElastic(capacity, capacity, "tds-codec-worker");
    }

    private static int workerCapacity(TdsRuntimeSettings settings) {
        return Math.max(
                1,
                Math.min(
                        settings.maxUnauthenticatedConnections(),
                        Runtime.getRuntime().availableProcessors()));
    }

    private static int plusBounded(int value, int extra) {
        return (int) Math.min(Integer.MAX_VALUE, (long) value + extra);
    }
}
