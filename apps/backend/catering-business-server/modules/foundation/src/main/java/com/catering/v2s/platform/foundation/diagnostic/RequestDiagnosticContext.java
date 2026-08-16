package com.catering.v2s.platform.foundation.diagnostic;

import java.util.Objects;

/** Immutable, allowlisted diagnostic context; it intentionally carries no request payload. */
public record RequestDiagnosticContext(
        String correlationId, String requestId, String operationId, String routeTemplate, String owner) {
    public RequestDiagnosticContext {
        correlationId = required(correlationId, "correlationId");
        requestId = required(requestId, "requestId");
        operationId = required(operationId, "operationId");
        routeTemplate = routeTemplate(routeTemplate);
        owner = required(owner, "owner");
    }

    private static String required(String value, String name) {
        Objects.requireNonNull(value, name);
        if (!value.matches("[A-Za-z0-9._:-]{1,128}")) {
            throw new IllegalArgumentException("invalid diagnostic " + name);
        }
        return value;
    }

    private static String routeTemplate(String value) {
        Objects.requireNonNull(value, "routeTemplate");
        // A fixed Spring mapping template is safe; a raw URI with query/string input is not.
        if (!value.matches("/[A-Za-z0-9._~{}:/-]{1,256}")) {
            throw new IllegalArgumentException("invalid diagnostic routeTemplate");
        }
        return value;
    }
}
