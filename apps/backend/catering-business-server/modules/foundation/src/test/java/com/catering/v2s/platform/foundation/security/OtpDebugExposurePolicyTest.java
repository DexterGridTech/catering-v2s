package com.catering.v2s.platform.foundation.security;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class OtpDebugExposurePolicyTest {
    @Test
    void nonProductionAndUatCannotDisableTheDebugReadback() {
        assertTrue(OtpDebugExposurePolicy.resolve("non-production", true));
        assertTrue(OtpDebugExposurePolicy.resolve("uat", true));
        assertThrows(IllegalStateException.class, () -> OtpDebugExposurePolicy.resolve("non-production", false));
        assertThrows(IllegalStateException.class, () -> OtpDebugExposurePolicy.resolve("uat", false));
    }

    @Test
    void productionCannotEnableTheDebugReadback() {
        assertFalse(OtpDebugExposurePolicy.resolve("production", false));
        assertThrows(IllegalStateException.class, () -> OtpDebugExposurePolicy.resolve("production", true));
    }
}
