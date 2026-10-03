package com.catering.v2s.app.configuration;

import com.catering.v2s.app.edge.diagnostic.HttpRequestMetricsInterceptor;
import com.catering.v2s.app.edge.diagnostic.PublicSecurityDiagnosticInterceptor;
import com.catering.v2s.app.edge.diagnostic.PublicSecurityOperationRegistry;
import com.catering.v2s.app.edge.diagnostic.ReadOnlyTaskConnectionScopeInterceptor;
import com.catering.v2s.app.edge.diagnostic.RequestCompletionDiagnosticInterceptor;
import com.catering.v2s.app.edge.session.EdgeRequestContextArgumentResolver;
import com.catering.v2s.platform.foundation.diagnostic.SecurityDiagnosticRecorder;
import com.catering.v2s.platform.foundation.diagnostic.Slf4jSecurityDiagnosticRecorder;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.util.List;
import java.util.Objects;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

@Configuration
public class EdgeWebConfiguration implements WebMvcConfigurer {
    private final EdgeRequestContextArgumentResolver edgeRequestContextArgumentResolver;
    private final ObjectProvider<HttpRequestMetricsInterceptor> httpRequestMetricsInterceptor;
    private final ObjectProvider<ReadOnlyTaskConnectionScopeInterceptor> readOnlyTaskConnectionScopeInterceptor;
    private final ObjectMapper objectMapper;
    private final String runtimeEnvironment;
    private final String terminalBrowserAllowedOrigins;

    public EdgeWebConfiguration(
            EdgeRequestContextArgumentResolver edgeRequestContextArgumentResolver,
            ObjectProvider<HttpRequestMetricsInterceptor> httpRequestMetricsInterceptor,
            ObjectProvider<ReadOnlyTaskConnectionScopeInterceptor> readOnlyTaskConnectionScopeInterceptor,
            ObjectMapper objectMapper,
            @Value("${v2s.runtime-environment:}") String runtimeEnvironment,
            @Value("${v2s.terminal.browser-allowed-origins:}") String terminalBrowserAllowedOrigins) {
        this.edgeRequestContextArgumentResolver = edgeRequestContextArgumentResolver;
        this.httpRequestMetricsInterceptor = httpRequestMetricsInterceptor;
        this.readOnlyTaskConnectionScopeInterceptor = readOnlyTaskConnectionScopeInterceptor;
        this.objectMapper = objectMapper;
        this.runtimeEnvironment = Objects.requireNonNull(runtimeEnvironment, "runtimeEnvironment");
        this.terminalBrowserAllowedOrigins = Objects.requireNonNull(
                terminalBrowserAllowedOrigins, "terminalBrowserAllowedOrigins");
    }

    @Override
    public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
        resolvers.add(edgeRequestContextArgumentResolver);
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(httpRequestMetricsInterceptor.getObject());
        // Metrics must open before this scope so its first connection borrow is measured.
        registry.addInterceptor(readOnlyTaskConnectionScopeInterceptor.getObject());
        // Metrics must complete after public-security diagnostics so its request-scoped tracker is still open.
        registry.addInterceptor(
                publicSecurityDiagnosticInterceptor(publicSecurityOperationRegistry(), securityDiagnosticRecorder()));
        registry.addInterceptor(requestCompletionDiagnosticInterceptor(securityDiagnosticRecorder()));
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        List<String> origins = terminalBrowserOrigins();
        if (origins.isEmpty()) return;
        configureTerminalBrowserCors(
                registry.addMapping("/api/terminal/group-workspaces/*/activation"), origins);
        configureTerminalBrowserCors(
                registry.addMapping("/api/terminal/group-workspaces/*/terminals/*/activation/cancel"), origins);
    }

    private List<String> terminalBrowserOrigins() {
        if (terminalBrowserAllowedOrigins.isBlank()) return List.of();
        if (!"non-production".equals(runtimeEnvironment)) {
            throw new IllegalStateException("TERMINAL_BROWSER_CORS_REQUIRES_NON_PRODUCTION");
        }
        String[] values = terminalBrowserAllowedOrigins.split(",", -1);
        List<String> origins = java.util.Arrays.stream(values).map(String::trim).toList();
        if (origins.isEmpty()
                || origins.stream().anyMatch(String::isEmpty)
                || origins.stream().distinct().count() != origins.size()
                || origins.stream().anyMatch(origin -> !isExplicitLoopbackOrigin(origin))) {
            throw new IllegalStateException("TERMINAL_BROWSER_CORS_ORIGIN_INVALID");
        }
        return origins;
    }

    private static boolean isExplicitLoopbackOrigin(String value) {
        try {
            URI origin = URI.create(value);
            return "http".equals(origin.getScheme())
                    && ("127.0.0.1".equals(origin.getHost()) || "localhost".equals(origin.getHost()))
                    && origin.getPort() >= 1024
                    && origin.getPort() <= 65535
                    && (origin.getRawPath() == null || origin.getRawPath().isEmpty())
                    && origin.getRawQuery() == null
                    && origin.getRawFragment() == null
                    && origin.getRawUserInfo() == null
                    && origin.toString().equals(value);
        } catch (IllegalArgumentException invalidOrigin) {
            return false;
        }
    }

    private static void configureTerminalBrowserCors(
            org.springframework.web.servlet.config.annotation.CorsRegistration registration, List<String> origins) {
        registration.allowedOrigins(origins.toArray(String[]::new))
                .allowedMethods("POST")
                .allowedHeaders("Authorization", "Content-Type", "X-Correlation-Id", "X-Request-Id")
                .maxAge(300);
    }

    @Bean
    PublicSecurityOperationRegistry publicSecurityOperationRegistry() {
        return new PublicSecurityOperationRegistry();
    }

    @Bean
    @ConditionalOnMissingBean(ObjectMapper.class)
    static ObjectMapper objectMapper() {
        return new ObjectMapper().findAndRegisterModules();
    }

    @Bean
    SecurityDiagnosticRecorder securityDiagnosticRecorder() {
        return new Slf4jSecurityDiagnosticRecorder();
    }

    @Bean
    HttpRequestMetricsInterceptor httpRequestMetricsInterceptor() {
        return new HttpRequestMetricsInterceptor(new ObjectMapper());
    }

    @Bean
    ReadOnlyTaskConnectionScopeInterceptor readOnlyTaskConnectionScopeInterceptor(
            PlatformTransactionManager transactions) {
        return new ReadOnlyTaskConnectionScopeInterceptor(
                com.catering.v2s.app.edge.diagnostic.EdgeRouteFaceRegistry.loadExtended(objectMapper), transactions);
    }

    @Bean
    RequestCompletionDiagnosticInterceptor requestCompletionDiagnosticInterceptor(SecurityDiagnosticRecorder recorder) {
        return new RequestCompletionDiagnosticInterceptor(objectMapper, recorder);
    }

    @Bean
    PublicSecurityDiagnosticInterceptor publicSecurityDiagnosticInterceptor(
            PublicSecurityOperationRegistry registry, SecurityDiagnosticRecorder recorder) {
        return new PublicSecurityDiagnosticInterceptor(registry, recorder);
    }

    @Bean
    @ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
    ApplicationRunner publicSecurityOperationMappingValidation(
            PublicSecurityOperationRegistry registry, RequestMappingHandlerMapping mappings) {
        return arguments -> registry.validateMappings(mappings.getHandlerMethods());
    }
}
