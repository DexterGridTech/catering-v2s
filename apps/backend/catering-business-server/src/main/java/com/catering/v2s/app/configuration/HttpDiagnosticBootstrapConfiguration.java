package com.catering.v2s.app.configuration;

import com.catering.v2s.platform.iam.api.PlatformDiagnosticBootstrap;
import java.util.Arrays;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Wires the owner-only first actor command solely for an approved empty isolated namespace. */
@Configuration
public class HttpDiagnosticBootstrapConfiguration {
    @Bean
    @ConditionalOnProperty(name = "v2s.http-diagnostic.bootstrap-enabled", havingValue = "true")
    ApplicationRunner httpDiagnosticBootstrapRunner(
        PlatformDiagnosticBootstrap bootstrap,
        @Value("${V2S_RUNTIME_ENVIRONMENT:}") String environment,
        @Value("${V2S_DEV_PROFILE:}") String profile,
        @Value("${V2S_HTTP_DIAGNOSTIC_RUN_ID:}") String runId,
        @Value("${V2S_HTTP_DIAGNOSTIC_BOOTSTRAP_LOGIN:}") String loginName,
        @Value("${V2S_HTTP_DIAGNOSTIC_BOOTSTRAP_CREDENTIAL:}") String credential
    ) {
        return ownerBootstrap(bootstrap, environment, profile, runId, loginName, credential);
    }

    static ApplicationRunner ownerBootstrap(PlatformDiagnosticBootstrap bootstrap, String environment, String profile, String runId, String loginName, String credential) {
        if (!"non-production".equals(environment) || !isApprovedBootstrapRun(profile, runId)
                || !loginName.matches("[a-z][a-z0-9-]{2,62}")
                || credential.length() < 12) {
            throw new IllegalStateException("HTTP_DIAGNOSTIC_BOOTSTRAP_CONFIGURATION_INVALID");
        }
        return arguments -> {
            char[] password = credential.toCharArray();
            try {
                bootstrap.bootstrapFirstAdministrator(loginName, "HTTP Diagnostic Administrator", password);
            } finally {
                Arrays.fill(password, '\0');
            }
        };
    }

    private static boolean isApprovedBootstrapRun(String profile, String runId) {
        return ("rm1-http-diagnostic".equals(profile) && runId.matches("rm1-http-diagnostic-[A-Za-z0-9-]{8,128}"))
                || ("backend-performance-final-acceptance".equals(profile)
                && runId.matches("backend-performance-final-\\d+-[a-f0-9]{8}"));
    }
}
