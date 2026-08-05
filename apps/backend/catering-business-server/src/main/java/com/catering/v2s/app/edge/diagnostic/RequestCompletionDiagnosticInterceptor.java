package com.catering.v2s.app.edge.diagnostic;

import com.catering.v2s.platform.foundation.diagnostic.RequestCompletionEvent;
import com.catering.v2s.platform.foundation.diagnostic.SecurityDiagnosticRecorder;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Map;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.HandlerMapping;

/** Always-on completion observer for generated business routes; it never reads request payloads. */
public final class RequestCompletionDiagnosticInterceptor implements HandlerInterceptor {
    private final Map<String, EdgeRouteFaceRegistry.Definition> definitions;
    private final SecurityDiagnosticRecorder recorder;

    public RequestCompletionDiagnosticInterceptor(ObjectMapper mapper, SecurityDiagnosticRecorder recorder) {
        this.definitions = EdgeRouteFaceRegistry.load(mapper);
        this.recorder = recorder;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (isPublicSecurity(handler) || isManagedDiagnosticRequest(request)) return true;
        String pattern = (String) request.getAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE);
        if (pattern == null || pattern.isBlank()) return true;
        String method = request.getMethod().toUpperCase(java.util.Locale.ROOT);
        EdgeRouteFaceRegistry.Definition definition = definitions.get(method + " " + pattern);
        if (definition == null) definition = new EdgeRouteFaceRegistry.Definition("route.unresolved", method, safePattern(pattern), "unresolved", "unknown");
        RequestCompletionDiagnosticState.getOrCreate(request, response, definition);
        RequestCompletionDiagnosticState state = RequestCompletionDiagnosticState.find(request);
        response.setHeader("X-Correlation-Id", state.correlationId());
        if (response.getHeader("X-Request-Id") == null) response.setHeader("X-Request-Id", state.requestId());
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception exception) {
        RequestCompletionDiagnosticState state = RequestCompletionDiagnosticState.find(request);
        if (state == null) return;
        RequestCompletionEvent event = state.completeOnce(response.getStatus(), exception);
        if (event != null) record(event);
    }

    private void record(RequestCompletionEvent event) {
        try {
            recorder.recordCompletion(event);
        } catch (RuntimeException failure) {
            try { recorder.recordCompletionWriteFailure(event); } catch (RuntimeException ignored) { }
        }
    }

    private static boolean isPublicSecurity(Object handler) {
        return handler instanceof HandlerMethod method && method.hasMethodAnnotation(PublicSecurityOperation.class);
    }

    private static boolean isManagedDiagnosticRequest(HttpServletRequest request) {
        // Only the already-validated metrics interceptor may mark a request as managed. Raw
        // headers are caller-controlled and must never provide an observability bypass.
        return request.getAttribute(HttpRequestMetricsInterceptor.class.getName()) != null;
    }

    private static String safePattern(String pattern) {
        return pattern.matches("/[A-Za-z0-9._~{}:/-]{1,256}") ? pattern : "/unresolved";
    }
}
