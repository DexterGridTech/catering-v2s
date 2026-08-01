package com.catering.v2s.app.edge.platform.session;

/** Opaque platform session cookie; only the platform session resolver can read its raw value. */
public final class PlatformSessionCookie {
    private final String value;
    private PlatformSessionCookie(String value) { this.value = value; }
    public static PlatformSessionCookie fromCookie(String value) { return new PlatformSessionCookie(value); }
    String rawValue() { return value; }
    @Override public String toString() { return "PlatformSessionCookie[redacted]"; }
}
