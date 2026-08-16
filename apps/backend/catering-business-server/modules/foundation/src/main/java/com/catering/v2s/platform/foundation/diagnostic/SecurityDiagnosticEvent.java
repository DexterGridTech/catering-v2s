package com.catering.v2s.platform.foundation.diagnostic;

import java.util.Objects;

/** A closed, secret-safe event envelope emitted by the platform diagnostic boundary. */
public record SecurityDiagnosticEvent(
        RequestDiagnosticContext context,
        String event,
        String phase,
        String outcome,
        long durationMillis,
        Integer status,
        String errorCode,
        long databaseOperationCount,
        long databaseDurationMillis) {
    public SecurityDiagnosticEvent(
            RequestDiagnosticContext context,
            String event,
            String phase,
            String outcome,
            long durationMillis,
            Integer status,
            String errorCode) {
        this(context, event, phase, outcome, durationMillis, status, errorCode, 0, 0);
    }

    public SecurityDiagnosticEvent {
        context = Objects.requireNonNull(context, "context");
        event = allowed(event, "event");
        phase = allowed(phase, "phase");
        outcome = allowed(outcome, "outcome");
        if (durationMillis < 0) throw new IllegalArgumentException("negative diagnostic duration");
        if (status != null && (status < 100 || status > 599))
            throw new IllegalArgumentException("invalid diagnostic status");
        if (errorCode != null) errorCode = allowed(errorCode, "errorCode");
        if (databaseOperationCount < 0 || databaseDurationMillis < 0)
            throw new IllegalArgumentException("negative database diagnostic metric");
    }

    /**
     * Closed logging fields only. This is deliberately not an untyped map: the event has a fixed, secret-safe schema
     * and cannot be confused with a database row or command payload.
     */
    public Fields fields() {
        return new Fields(
                context.correlationId(),
                context.requestId(),
                context.operationId(),
                context.routeTemplate(),
                context.owner(),
                event,
                phase,
                outcome,
                durationMillis,
                status,
                errorCode,
                databaseOperationCount,
                databaseDurationMillis);
    }

    public record Fields(
            String correlationId,
            String requestId,
            String operationId,
            String routeTemplate,
            String owner,
            String event,
            String phase,
            String outcome,
            long durationMillis,
            Integer status,
            String errorCode,
            long databaseOperationCount,
            long databaseDurationMillis) {}

    private static String allowed(String value, String name) {
        Objects.requireNonNull(value, name);
        if (!value.matches("[A-Z0-9_:-]{1,128}")) throw new IllegalArgumentException("invalid diagnostic " + name);
        return value;
    }
}
