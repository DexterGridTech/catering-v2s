package com.catering.v2s.app.acceptance;

import com.catering.v2s.inventory.api.InventoryOwnerApi;
import com.catering.v2s.platform.foundation.persistence.DatabaseOperationTracker;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Proxy;
import java.util.concurrent.atomic.AtomicBoolean;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.context.annotation.Profile;

/** Wires the existing production interceptor snapshot into this focused HTTP test. */
@TestConfiguration(proxyBeanMethods = false)
@Profile("!backend-acceptance-secondary")
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

    /**
     * Test-only owner decorator for the published-menu read failure branch. It is not a production HTTP/API seam: the
     * sales-menu acceptance scenario arms exactly one read before issuing its real HTTP request.
     */
    @Bean(name = "backendAcceptanceInventoryOwnerApi")
    @Primary
    InventoryOwnerApi backendAcceptanceInventoryOwnerApi(
            @Qualifier("inventoryOwnerService") InventoryOwnerApi delegate) {
        return (InventoryOwnerApi) Proxy.newProxyInstance(
                InventoryOwnerApi.class.getClassLoader(),
                new Class<?>[] {InventoryOwnerApi.class},
                (proxy, method, args) -> {
                    if ("readSalesMenuAvailability".equals(method.getName())
                            && BackendAcceptanceInventoryFailureProbe.consumeNextReadFailure()) {
                        throw new IllegalStateException("BACKEND_ACCEPTANCE_INVENTORY_READ_FAILURE");
                    }
                    try {
                        return method.invoke(delegate, args);
                    } catch (InvocationTargetException failure) {
                        throw failure.getCause();
                    }
                });
    }
}

/** Single-use, same-JVM control used only by the real HTTP acceptance scenario. */
final class BackendAcceptanceInventoryFailureProbe {
    private static final AtomicBoolean ARMED = new AtomicBoolean();
    private static final AtomicBoolean CONSUMED = new AtomicBoolean();

    private BackendAcceptanceInventoryFailureProbe() {}

    static void failNextRead() {
        CONSUMED.set(false);
        ARMED.set(true);
    }

    static boolean consumeNextReadFailure() {
        boolean consumed = ARMED.getAndSet(false);
        if (consumed) CONSUMED.set(true);
        return consumed;
    }

    static boolean wasConsumed() {
        return CONSUMED.get();
    }
}
