package com.catering.v2s.platform.foundation.diagnostic;

import java.util.Map;
import java.util.Objects;

/** A closed, secret-safe event envelope emitted by the platform diagnostic boundary. */
public record SecurityDiagnosticEvent(
        RequestDiagnosticContext context,
        String event,
        String phase,
        String outcome,
        long durationMillis,
        Integer status,
        String errorCode
) {
    public SecurityDiagnosticEvent {
        context = Objects.requireNonNull(context, "context");
        event = allowed(event, "event");
        phase = allowed(phase, "phase");
        outcome = allowed(outcome, "outcome");
        if (durationMillis < 0) throw new IllegalArgumentException("negative diagnostic duration");
        if (status != null && (status < 100 || status > 599)) throw new IllegalArgumentException("invalid diagnostic status");
        if (errorCode != null) errorCode = allowed(errorCode, "errorCode");
    }

    public Map<String, Object> fields() {
        return Map.ofEntries(
                Map.entry("correlationId", context.correlationId()),
                Map.entry("requestId", context.requestId()),
                Map.entry("operationId", context.operationId()),
                Map.entry("routeTemplate", context.routeTemplate()),
                Map.entry("owner", context.owner()),
                Map.entry("event", event), Map.entry("phase", phase),
                Map.entry("outcome", outcome), Map.entry("durationMillis", durationMillis),
                Map.entry("status", status == null ? "unassigned" : status),
                Map.entry("errorCode", errorCode == null ? "unassigned" : errorCode));
    }

    private static String allowed(String value, String name) {
        Objects.requireNonNull(value, name);
        if (!value.matches("[A-Z0-9_:-]{1,128}")) throw new IllegalArgumentException("invalid diagnostic " + name);
        return value;
    }
}
