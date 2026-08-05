package com.catering.v2s.app.configuration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.catering.v2s.app.edge.diagnostic.HttpRequestMetricsInterceptor;
import com.catering.v2s.app.edge.diagnostic.PublicSecurityDiagnosticInterceptor;
import com.catering.v2s.app.edge.diagnostic.RequestCompletionDiagnosticInterceptor;
import com.catering.v2s.app.edge.session.EdgeRequestContextArgumentResolver;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;

class EdgeWebConfigurationTest {
    @Test
    void keepsMetricsOpenUntilPublicSecurityDiagnosticCompletes() {
        HttpRequestMetricsInterceptor metrics = mock(HttpRequestMetricsInterceptor.class);
        ObjectProvider<HttpRequestMetricsInterceptor> provider = mock(ObjectProvider.class);
        when(provider.getObject()).thenReturn(metrics);
        EdgeWebConfiguration configuration = new EdgeWebConfiguration(mock(EdgeRequestContextArgumentResolver.class), provider, new ObjectMapper());
        CapturingRegistry registry = new CapturingRegistry();

        configuration.addInterceptors(registry);

        List<HandlerInterceptor> interceptors = registry.values();
        assertEquals(3, interceptors.size());
        assertTrue(interceptors.get(0) == metrics);
        assertTrue(interceptors.get(1) instanceof PublicSecurityDiagnosticInterceptor);
        assertTrue(interceptors.get(2) instanceof RequestCompletionDiagnosticInterceptor);
    }

    private static final class CapturingRegistry extends InterceptorRegistry {
        private final List<HandlerInterceptor> captured = new ArrayList<>();
        @Override public org.springframework.web.servlet.config.annotation.InterceptorRegistration addInterceptor(HandlerInterceptor interceptor) { captured.add(interceptor); return super.addInterceptor(interceptor); }
        List<HandlerInterceptor> values() { return List.copyOf(captured); }
    }
}
