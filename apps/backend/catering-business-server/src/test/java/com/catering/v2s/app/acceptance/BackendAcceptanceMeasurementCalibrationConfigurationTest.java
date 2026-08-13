package com.catering.v2s.app.acceptance;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.annotation.PostConstruct;
import java.lang.reflect.Method;
import org.junit.jupiter.api.Test;
import org.springframework.boot.ApplicationRunner;

class BackendAcceptanceMeasurementCalibrationConfigurationTest {
    @Test
    void defersFixturePreparationUntilAfterApplicationContextRefresh() throws Exception {
        Method preparation = BackendAcceptanceMeasurementCalibrationConfiguration
                .BackendAcceptanceMeasurementCalibrationController.class
                .getDeclaredMethod("prepareFixtureTable");

        assertFalse(preparation.isAnnotationPresent(PostConstruct.class));
        assertTrue(java.util.Arrays.stream(BackendAcceptanceMeasurementCalibrationConfiguration.class.getDeclaredMethods())
                .anyMatch(method -> method.getReturnType() == ApplicationRunner.class
                        && method.getName().equals("backendAcceptanceMeasurementCalibrationFixtureRunner")));
        assertFalse(java.util.Arrays.stream(BackendAcceptanceMeasurementCalibrationConfiguration.class.getDeclaredMethods())
                .anyMatch(method -> method.getName().equals("backendAcceptanceMeasurementCalibrationController")));
    }
}
