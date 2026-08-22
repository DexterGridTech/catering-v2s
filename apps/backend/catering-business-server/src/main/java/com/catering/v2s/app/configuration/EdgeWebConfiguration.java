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
import java.util.List;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

@Configuration
public class EdgeWebConfiguration implements WebMvcConfigurer {
    private final EdgeRequestContextArgumentResolver edgeRequestContextArgumentResolver;
    private final ObjectProvider<HttpRequestMetricsInterceptor> httpRequestMetricsInterceptor;
    private final ObjectProvider<ReadOnlyTaskConnectionScopeInterceptor> readOnlyTaskConnectionScopeInterceptor;
    private final ObjectMapper objectMapper;

    public EdgeWebConfiguration(
            EdgeRequestContextArgumentResolver edgeRequestContextArgumentResolver,
            ObjectProvider<HttpRequestMetricsInterceptor> httpRequestMetricsInterceptor,
            ObjectProvider<ReadOnlyTaskConnectionScopeInterceptor> readOnlyTaskConnectionScopeInterceptor,
            ObjectMapper objectMapper) {
        this.edgeRequestContextArgumentResolver = edgeRequestContextArgumentResolver;
        this.httpRequestMetricsInterceptor = httpRequestMetricsInterceptor;
        this.readOnlyTaskConnectionScopeInterceptor = readOnlyTaskConnectionScopeInterceptor;
        this.objectMapper = objectMapper;
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
