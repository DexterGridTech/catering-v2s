package com.catering.v2s.app.configuration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.catering.v2s.app.edge.diagnostic.HttpRequestMetricsInterceptor;
import com.catering.v2s.app.edge.diagnostic.PublicSecurityDiagnosticInterceptor;
import com.catering.v2s.app.edge.diagnostic.ReadOnlyTaskConnectionScopeInterceptor;
import com.catering.v2s.app.edge.diagnostic.RequestCompletionDiagnosticInterceptor;
import com.catering.v2s.app.edge.session.EdgeRequestContextArgumentResolver;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;

class EdgeWebConfigurationTest {
    @Test
    void keepsMetricsOpenUntilPublicSecurityDiagnosticCompletes() {
        HttpRequestMetricsInterceptor metrics = mock(HttpRequestMetricsInterceptor.class);
        ObjectProvider<HttpRequestMetricsInterceptor> provider = mock(ObjectProvider.class);
        when(provider.getObject()).thenReturn(metrics);
        ReadOnlyTaskConnectionScopeInterceptor readScope = mock(ReadOnlyTaskConnectionScopeInterceptor.class);
        ObjectProvider<ReadOnlyTaskConnectionScopeInterceptor> readScopeProvider = mock(ObjectProvider.class);
        when(readScopeProvider.getObject()).thenReturn(readScope);
        EdgeWebConfiguration configuration = new EdgeWebConfiguration(
                mock(EdgeRequestContextArgumentResolver.class), provider, readScopeProvider, new ObjectMapper(), "", "");
        CapturingRegistry registry = new CapturingRegistry();

        configuration.addInterceptors(registry);

        List<HandlerInterceptor> interceptors = registry.values();
        assertEquals(4, interceptors.size());
        assertTrue(interceptors.get(0) == metrics);
        assertTrue(interceptors.get(1) == readScope);
        assertTrue(interceptors.get(2) instanceof PublicSecurityDiagnosticInterceptor);
        assertTrue(interceptors.get(3) instanceof RequestCompletionDiagnosticInterceptor);
    }

    @Test
    void enablesOnlyConfiguredLoopbackTerminalActivationOriginsOutsideProduction() {
        EdgeWebConfiguration configuration = configuration("non-production", "http://127.0.0.1:8093");
        CapturingCorsRegistry registry = new CapturingCorsRegistry();

        configuration.addCorsMappings(registry);

        Map<String, CorsConfiguration> mappings = registry.mappings();
        assertEquals(2, mappings.size());
        assertTerminalPostMapping(
                mappings.get("/api/terminal/group-workspaces/*/activation"), "http://127.0.0.1:8093");
        assertTerminalPostMapping(
                mappings.get("/api/terminal/group-workspaces/*/terminals/*/activation/cancel"),
                "http://127.0.0.1:8093");
    }

    @Test
    void rejectsConfiguredTerminalBrowserCorsInProductionAndLeavesUnconfiguredCorsDisabled() {
        IllegalStateException configuredProductionError = assertThrows(IllegalStateException.class,
                () -> configuration("production", "http://127.0.0.1:8093")
                        .addCorsMappings(new CapturingCorsRegistry()));
        assertEquals("TERMINAL_BROWSER_CORS_REQUIRES_NON_PRODUCTION", configuredProductionError.getMessage());

        CapturingCorsRegistry productionWithoutOrigins = new CapturingCorsRegistry();
        configuration("production", "").addCorsMappings(productionWithoutOrigins);
        assertTrue(productionWithoutOrigins.mappings().isEmpty());

        CapturingCorsRegistry unconfigured = new CapturingCorsRegistry();
        configuration("non-production", "").addCorsMappings(unconfigured);
        assertTrue(unconfigured.mappings().isEmpty());
    }

    @Test
    void rejectsWildcardAndNonLoopbackTerminalBrowserOrigins() {
        for (String invalidOrigin : List.of("*", "https://example.com", "http://localhost:8093/path")) {
            assertThrowsCorsOriginInvalid(invalidOrigin);
        }
    }

    private static void assertTerminalPostMapping(CorsConfiguration configuration, String origin) {
        assertNotNull(configuration);
        assertEquals(List.of(origin), configuration.getAllowedOrigins());
        assertEquals(List.of("POST"), configuration.getAllowedMethods());
        assertEquals(List.of("Authorization", "Content-Type", "X-Correlation-Id", "X-Request-Id"),
                configuration.getAllowedHeaders());
        assertTrue(!Boolean.TRUE.equals(configuration.getAllowCredentials()));
    }

    private static EdgeWebConfiguration configuration(String environment, String origins) {
        return new EdgeWebConfiguration(
                mock(EdgeRequestContextArgumentResolver.class),
                mock(ObjectProvider.class),
                mock(ObjectProvider.class),
                new ObjectMapper(),
                environment,
                origins);
    }

    private static void assertThrowsCorsOriginInvalid(String origin) {
        EdgeWebConfiguration configuration = configuration("non-production", origin);
        assertThrows(IllegalStateException.class, () -> configuration.addCorsMappings(new CapturingCorsRegistry()));
    }

    private static final class CapturingCorsRegistry extends CorsRegistry {
        Map<String, CorsConfiguration> mappings() {
            return getCorsConfigurations();
        }
    }

    private static final class CapturingRegistry extends InterceptorRegistry {
        private final List<HandlerInterceptor> captured = new ArrayList<>();

        @Override
        public org.springframework.web.servlet.config.annotation.InterceptorRegistration addInterceptor(
                HandlerInterceptor interceptor) {
            captured.add(interceptor);
            return super.addInterceptor(interceptor);
        }

        List<HandlerInterceptor> values() {
            return List.copyOf(captured);
        }
    }
}
