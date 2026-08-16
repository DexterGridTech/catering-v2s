package com.catering.v2s.platform.foundation.diagnostic;

import java.util.Objects;

/** Fixed, payload-free completion envelope for every mapped HTTP operation. */
public record RequestCompletionEvent(
        RequestDiagnosticContext context,
        String consumerFace,
        String outcome,
        long durationMillis,
        Integer status,
        String errorCode,
        long databaseOperationCount,
        long databaseDurationMillis) {
    public RequestCompletionEvent {
        context = Objects.requireNonNull(context, "context");
        consumerFace = allowed(consumerFace, "consumerFace");
        outcome = allowed(outcome, "outcome");
        if (durationMillis < 0 || databaseOperationCount < 0 || databaseDurationMillis < 0) {
            throw new IllegalArgumentException("negative completion metric");
        }
        if (status == null || status < 100 || status > 599)
            throw new IllegalArgumentException("invalid completion status");
        if (errorCode != null) errorCode = allowed(errorCode, "errorCode");
    }

    public Fields fields() {
        return new Fields(
                context.correlationId(),
                context.requestId(),
                context.operationId(),
                context.routeTemplate(),
                context.owner(),
                consumerFace,
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
            String consumerFace,
            String outcome,
            long durationMillis,
            Integer status,
            String errorCode,
            long databaseOperationCount,
            long databaseDurationMillis) {}

    private static String allowed(String value, String name) {
        Objects.requireNonNull(value, name);
        if (!value.matches("[A-Za-z0-9._:-]{1,128}")) throw new IllegalArgumentException("invalid completion " + name);
        return value;
    }
}
