package com.catering.v2s.platform.foundation.diagnostic;

/** The only contract through which an edge adapter can emit a security diagnostic. */
@FunctionalInterface
public interface SecurityDiagnosticRecorder {
    void record(SecurityDiagnosticEvent event);

    /**
     * Non-recursive, allowlisted fallback for a failed primary write. Implementations must never
     * re-enter {@link #record(SecurityDiagnosticEvent)} from here.
     */
    default void recordWriteFailure(SecurityDiagnosticEvent failedEvent) { }
}
