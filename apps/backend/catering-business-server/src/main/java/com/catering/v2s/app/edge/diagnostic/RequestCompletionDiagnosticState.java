package com.catering.v2s.app.edge.diagnostic;

import com.catering.v2s.platform.foundation.diagnostic.RequestCompletionEvent;
import com.catering.v2s.platform.foundation.diagnostic.RequestDiagnosticContext;
import com.catering.v2s.platform.foundation.persistence.DatabaseOperationTracker;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

/** Request-local state for the always-on, payload-free completion observer. */
public final class RequestCompletionDiagnosticState {
    private static final String ATTRIBUTE = RequestCompletionDiagnosticState.class.getName();
    private static final String UNKNOWN_ERROR = "PLATFORM_COMMON_RESULT_UNKNOWN";
    private final RequestDiagnosticContext context;
    private final String consumerFace;
    private final long startedAtNanos;
    private final AtomicBoolean completed = new AtomicBoolean();
    private final AtomicReference<String> frozenErrorCode = new AtomicReference<>();

    private RequestCompletionDiagnosticState(RequestDiagnosticContext context, String consumerFace) {
        this.context = context;
        this.consumerFace = consumerFace;
        this.startedAtNanos = System.nanoTime();
    }

    public static RequestCompletionDiagnosticState getOrCreate(HttpServletRequest request, HttpServletResponse response, EdgeRouteFaceRegistry.Definition definition) {
        Object existing = request.getAttribute(ATTRIBUTE);
        if (existing instanceof RequestCompletionDiagnosticState state) return state;
        RequestDiagnosticContext context = HttpRequestMetricsInterceptor.context(request);
        if (context == null) {
            context = new RequestDiagnosticContext(
                    sanitizeCorrelationId(request.getHeader("X-Correlation-Id")),
                    sanitizeRequestId(response.getHeader("X-Request-Id")),
                    definition.operationId(),
                    definition.path(),
                    definition.owner());
        }
        RequestCompletionDiagnosticState state = new RequestCompletionDiagnosticState(context, definition.consumerFace());
        request.setAttribute(ATTRIBUTE, state);
        return state;
    }

    public static RequestCompletionDiagnosticState find(HttpServletRequest request) {
        Object value = request.getAttribute(ATTRIBUTE);
        return value instanceof RequestCompletionDiagnosticState state ? state : null;
    }

    public static void freezeFailure(HttpServletRequest request, String errorCode) {
        RequestCompletionDiagnosticState state = find(request);
        if (state == null) return;
        if (errorCode == null || !errorCode.matches("[A-Z0-9_:-]{1,128}")) throw new IllegalArgumentException("invalid completion error code");
        state.frozenErrorCode.compareAndSet(null, errorCode);
    }

    public RequestCompletionEvent completeOnce(int responseStatus, Exception exception) {
        if (!completed.compareAndSet(false, true)) return null;
        // Reuse the edge-owned tracker opened by HttpRequestMetricsInterceptor; opening a nested
        // collector here would hide the same database operations from that existing observer.
        DatabaseOperationTracker.Snapshot snapshot = DatabaseOperationTracker.snapshot();
        String errorCode = frozenErrorCode.get();
        boolean failed = errorCode != null || exception != null || responseStatus >= 400;
        return new RequestCompletionEvent(
                context,
                consumerFace,
                failed ? "FAILED" : "SUCCEEDED",
                Math.max(0, (System.nanoTime() - startedAtNanos) / 1_000_000),
                responseStatus,
                errorCode == null && failed ? UNKNOWN_ERROR : errorCode,
                snapshot.count(),
                snapshot.durationMillis());
    }

    public String correlationId() { return context.correlationId(); }

    public String requestId() { return context.requestId(); }

    private static String sanitizeCorrelationId(String candidate) {
        return candidate != null && candidate.matches("[A-Za-z0-9._:-]{1,128}") ? candidate : "corr-" + UUID.randomUUID();
    }

    private static String sanitizeRequestId(String candidate) {
        return candidate != null && candidate.matches("[A-Za-z0-9._:-]{1,128}") ? candidate : "req-" + UUID.randomUUID();
    }
}
