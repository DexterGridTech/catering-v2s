package com.catering.v2s.app.edge.diagnostic;

import com.catering.v2s.platform.foundation.diagnostic.SecurityDiagnosticEvent;
import com.catering.v2s.platform.foundation.diagnostic.SecurityDiagnosticRecorder;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

/** Emits one start and one terminal event only for the fixed public security operation denominator. */
public final class PublicSecurityDiagnosticInterceptor implements HandlerInterceptor {
    private final PublicSecurityOperationRegistry registry;
    private final SecurityDiagnosticRecorder recorder;

    public PublicSecurityDiagnosticInterceptor(
            PublicSecurityOperationRegistry registry, SecurityDiagnosticRecorder recorder) {
        this.registry = registry;
        this.recorder = recorder;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (!(handler instanceof HandlerMethod method)) return true;
        PublicSecurityOperation operation = method.getMethodAnnotation(PublicSecurityOperation.class);
        if (operation == null) return true;
        PublicSecurityDiagnosticRequestState existing = PublicSecurityDiagnosticRequestState.find(request);
        if (existing == null)
            record(PublicSecurityDiagnosticRequestState.getOrCreate(request, registry.resolve(operation))
                    .startedEvent());
        return true;
    }

    @Override
    public void afterCompletion(
            HttpServletRequest request, HttpServletResponse response, Object handler, Exception exception) {
        PublicSecurityDiagnosticRequestState state = PublicSecurityDiagnosticRequestState.find(request);
        if (state == null) return;
        SecurityDiagnosticEvent terminal = state.completeOnce(response.getStatus(), exception);
        if (terminal != null) record(terminal);
    }

    private void record(SecurityDiagnosticEvent event) {
        try {
            recorder.record(event);
        } catch (RuntimeException failure) {
            // Foundation owns the non-recursive, allowlisted DIAGNOSTIC_WRITE_FAILED fallback.
            try {
                recorder.recordWriteFailure(event);
            } catch (RuntimeException ignored) {
                // Diagnostics are observational only: even a fallback sink failure cannot alter HTTP/owner work.
            }
        }
    }
}
