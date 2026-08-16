package com.catering.v2s.app.configuration;

import com.catering.v2s.platform.foundation.seed.DevFixedOtpIssuer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Fail-closed DEV-only seed aids. They are absent unless the exact r5-full runtime is selected. */
@Configuration
@ConditionalOnProperty(name = "v2s.dev-profile", havingValue = "r5-full")
public class DevSeedRuntimeConfiguration {
    @Bean
    DevFixedOtpIssuer devFixedOtpIssuer(
            @Value("${v2s.runtime-environment:}") String runtimeEnvironment,
            @Value("${v2s.dev-profile:}") String profile,
            @Value("${v2s.dev-namespace:}") String namespace,
            @Value("${v2s.seed.fixed-otp-value:}") String fixedOtp) {
        validate(runtimeEnvironment, profile, namespace, fixedOtp);
        return (purpose, subjectRef) -> {
            if (purpose == null || purpose.isBlank() || subjectRef == null)
                throw new IllegalArgumentException("DEV_FIXED_OTP_PURPOSE_REQUIRED");
            return fixedOtp;
        };
    }

    static void validate(String runtimeEnvironment, String profile, String namespace, String fixedOtp) {
        if (!"non-production".equals(runtimeEnvironment)
                || !"r5-full".equals(profile)
                || namespace == null
                || !namespace.matches("^v2s-dev-[a-z0-9-]{3,32}$")
                || fixedOtp == null
                || !fixedOtp.matches("^[0-9]{6}$")) {
            throw new IllegalStateException("DEV_FIXED_SEED_RUNTIME_CONDITIONS_INVALID");
        }
    }
}
