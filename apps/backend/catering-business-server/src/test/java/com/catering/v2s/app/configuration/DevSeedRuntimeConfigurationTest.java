package com.catering.v2s.app.configuration;

import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

class DevSeedRuntimeConfigurationTest {
    @Test
    void acceptsOnlyExactNonProductionR5FullSeedRuntime() {
        DevSeedRuntimeConfiguration.validate("non-production", "r5-full", "v2s-dev-formal-seed", "123456");
    }

    @Test
    void rejectsEveryMissingOrWrongActivationCondition() {
        assertThrows(
                IllegalStateException.class,
                () -> DevSeedRuntimeConfiguration.validate("production", "r5-full", "v2s-dev-formal-seed", "123456"));
        assertThrows(
                IllegalStateException.class,
                () -> DevSeedRuntimeConfiguration.validate(
                        "non-production", "default", "v2s-dev-formal-seed", "123456"));
        assertThrows(
                IllegalStateException.class,
                () -> DevSeedRuntimeConfiguration.validate("non-production", "r5-full", "production-seed", "123456"));
        assertThrows(
                IllegalStateException.class,
                () -> DevSeedRuntimeConfiguration.validate(
                        "non-production", "r5-full", "v2s-dev-formal-seed", "abc123"));
    }

    @Test
    void fixedIssuerDoesNotNeedOrOverrideTheSystemClock() {
        DevSeedRuntimeConfiguration configuration = new DevSeedRuntimeConfiguration();
        assertThrows(IllegalArgumentException.class, () -> configuration
                .devFixedOtpIssuer("non-production", "r5-full", "v2s-dev-formal-seed", "123456")
                .issue("", null));
    }
}
