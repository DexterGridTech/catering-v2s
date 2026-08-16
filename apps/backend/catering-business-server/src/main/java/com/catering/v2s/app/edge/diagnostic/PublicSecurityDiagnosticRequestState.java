package com.catering.v2s.app.edge.diagnostic;

import com.catering.v2s.platform.foundation.diagnostic.RequestDiagnosticContext;
import com.catering.v2s.platform.foundation.diagnostic.SecurityDiagnosticEvent;
import com.catering.v2s.platform.foundation.persistence.DatabaseOperationTracker;
import jakarta.servlet.http.HttpServletRequest;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

/** Request-attribute state shared by normal and error dispatches for one public security operation. */
public final class PublicSecurityDiagnosticRequestState {
    private static final String ATTRIBUTE = PublicSecurityDiagnosticRequestState.class.getName();
    private static final String UNKNOWN_ERROR = "PLATFORM_COMMON_RESULT_UNKNOWN";
    private final RequestDiagnosticContext context;
    private final long startedAtNanos;
    private final AtomicBoolean completed = new AtomicBoolean();
    private final AtomicReference<Terminal> frozenTerminal = new AtomicReference<>();

    private PublicSecurityDiagnosticRequestState(RequestDiagnosticContext context) {
        this.context = context;
        this.startedAtNanos = System.nanoTime();
    }

    public static PublicSecurityDiagnosticRequestState getOrCreate(
            HttpServletRequest request, PublicSecurityOperationRegistry.Definition definition) {
        Object existing = request.getAttribute(ATTRIBUTE);
        if (existing instanceof PublicSecurityDiagnosticRequestState state) return state;
        RequestDiagnosticContext context = HttpRequestMetricsInterceptor.context(request);
        if (context == null) {
            context = new RequestDiagnosticContext(
                    sanitizeCorrelationId(request.getHeader("X-Correlation-Id")),
                    "req-" + UUID.randomUUID(),
                    definition.operationId(),
                    definition.routeTemplate(),
                    definition.owner());
        }
        PublicSecurityDiagnosticRequestState state = new PublicSecurityDiagnosticRequestState(context);
        request.setAttribute(ATTRIBUTE, state);
        return state;
    }

    public static PublicSecurityDiagnosticRequestState find(HttpServletRequest request) {
        Object state = request.getAttribute(ATTRIBUTE);
        return state instanceof PublicSecurityDiagnosticRequestState value ? value : null;
    }

    /** Lets typed Problem adapters freeze only public status and error code, never exception detail. */
    public static void freezeFailure(HttpServletRequest request, int status, String errorCode) {
        PublicSecurityDiagnosticRequestState state = find(request);
        if (state != null) state.freeze(status, errorCode);
    }

    /** Reuses one trusted value for the wire Problem and the diagnostic event. */
    public static String correlationId(HttpServletRequest request) {
        PublicSecurityDiagnosticRequestState state = find(request);
        return state == null
                ? sanitizeCorrelationId(request.getHeader("X-Correlation-Id"))
                : state.context.correlationId();
    }

    public SecurityDiagnosticEvent startedEvent() {
        return new SecurityDiagnosticEvent(context, "REQUEST_STARTED", "EDGE", "STARTED", 0, null, null);
    }

    public SecurityDiagnosticEvent completeOnce(int responseStatus, Exception exception) {
        if (!completed.compareAndSet(false, true)) return null;
        Terminal terminal = frozenTerminal.get();
        boolean failed = terminal != null || exception != null || responseStatus >= 400;
        int status = terminal == null ? responseStatus : terminal.status();
        String errorCode = terminal == null ? (failed ? UNKNOWN_ERROR : null) : terminal.errorCode();
        DatabaseOperationTracker.Snapshot database = DatabaseOperationTracker.snapshot();
        return new SecurityDiagnosticEvent(
                context,
                failed ? "REQUEST_FAILED" : "REQUEST_SUCCEEDED",
                "EDGE",
                failed ? "FAILED" : "SUCCEEDED",
                Math.max(0, (System.nanoTime() - startedAtNanos) / 1_000_000),
                status,
                errorCode,
                database.count(),
                database.durationMillis());
    }

    private void freeze(int status, String errorCode) {
        if (status < 100 || status > 599 || errorCode == null || !errorCode.matches("[A-Z0-9_:-]{1,128}")) {
            throw new IllegalArgumentException("invalid diagnostic terminal");
        }
        frozenTerminal.compareAndSet(null, new Terminal(status, errorCode));
    }

    private static String sanitizeCorrelationId(String candidate) {
        return candidate != null && candidate.matches("[A-Za-z0-9._:-]{1,128}")
                ? candidate
                : "corr-" + UUID.randomUUID();
    }

    private record Terminal(int status, String errorCode) {}
}
