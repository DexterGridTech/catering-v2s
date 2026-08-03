package com.catering.v2s.platform.foundation.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** Resolves the deployment-only OTP readback rule without holding any owner data. */
@Component
public final class OtpDebugExposurePolicy {
    private final boolean enabled;

    public OtpDebugExposurePolicy(
        @Value("${v2s.runtime-environment:}") String runtimeEnvironment,
        @Value("${platform.otp.debug-code-exposure:false}") boolean configuredExposure
    ) {
        this.enabled = resolve(runtimeEnvironment, configuredExposure);
    }

    public boolean enabled() {
        return enabled;
    }

    static boolean resolve(String runtimeEnvironment, boolean configuredExposure) {
        String runtime = runtimeEnvironment == null ? "" : runtimeEnvironment.trim().toLowerCase();
        if ("non-production".equals(runtime) || "uat".equals(runtime)) {
            if (!configuredExposure) throw new IllegalStateException("OTP_DEBUG_EXPOSURE_REQUIRED_NON_PRODUCTION");
            return true;
        }
        if ("production".equals(runtime)) {
            if (configuredExposure) throw new IllegalStateException("OTP_DEBUG_EXPOSURE_FORBIDDEN_PRODUCTION");
            return false;
        }
        return configuredExposure;
    }
}
