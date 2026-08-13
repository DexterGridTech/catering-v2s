package com.catering.v2s.app.acceptance;

import com.catering.v2s.platform.iam.api.PlatformDiagnosticBootstrap;
import java.util.Arrays;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;

/** Test-only owner bootstrap for one managed, empty backend-acceptance namespace. */
@TestConfiguration(proxyBeanMethods = false)
public class BackendAcceptanceOwnerBootstrapConfiguration {
    @Bean
    @ConditionalOnProperty(name = "v2s.backend-acceptance.bootstrap-enabled", havingValue = "true")
    ApplicationRunner backendAcceptanceBootstrapRunner(
            PlatformDiagnosticBootstrap bootstrap,
            @Value("${V2S_RUNTIME_ENVIRONMENT:}") String environment,
            @Value("${V2S_DEV_PROFILE:}") String profile,
            @Value("${V2S_BACKEND_ACCEPTANCE_RUN_ID:}") String runId,
            @Value("${V2S_BACKEND_ACCEPTANCE_BOOTSTRAP_LOGIN:}") String loginName,
            @Value("${V2S_BACKEND_ACCEPTANCE_BOOTSTRAP_CREDENTIAL:}") String credential) {
        if (!"non-production".equals(environment)
                || !"backend-acceptance".equals(profile)
                || !runId.matches("backend-acceptance-[A-Za-z0-9._:-]{8,128}")
                || !loginName.matches("[a-z][a-z0-9-]{2,62}")
                || credential.length() < 12) {
            throw new IllegalStateException("BACKEND_ACCEPTANCE_BOOTSTRAP_CONFIGURATION_INVALID");
        }
        return arguments -> {
            char[] password = credential.toCharArray();
            try {
                bootstrap.bootstrapFirstAdministrator(loginName, "Backend Acceptance Administrator", password);
            } finally {
                Arrays.fill(password, '\0');
            }
        };
    }
}
