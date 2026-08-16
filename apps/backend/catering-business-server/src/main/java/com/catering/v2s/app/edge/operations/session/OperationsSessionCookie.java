package com.catering.v2s.app.edge.operations.session;

/** Opaque operations session cookie; only the operations session resolver can read its raw value. */
public final class OperationsSessionCookie {
    private final String value;

    private OperationsSessionCookie(String value) {
        this.value = value;
    }

    public static OperationsSessionCookie fromCookie(String value) {
        return new OperationsSessionCookie(value);
    }

    String rawValue() {
        return value;
    }

    @Override
    public String toString() {
        return "OperationsSessionCookie[redacted]";
    }
}
