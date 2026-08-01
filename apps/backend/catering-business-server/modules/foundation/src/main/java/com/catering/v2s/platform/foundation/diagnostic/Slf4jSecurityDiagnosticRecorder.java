package com.catering.v2s.platform.foundation.diagnostic;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** SLF4J key-value writer; callers cannot add arbitrary fields to the event envelope. */
public final class Slf4jSecurityDiagnosticRecorder implements SecurityDiagnosticRecorder {
    private static final Logger LOG = LoggerFactory.getLogger(Slf4jSecurityDiagnosticRecorder.class);

    @Override
    public void record(SecurityDiagnosticEvent event) {
        var fields = event.fields();
        LOG.atInfo()
                .addKeyValue("correlationId", fields.get("correlationId"))
                .addKeyValue("requestId", fields.get("requestId"))
                .addKeyValue("operationId", fields.get("operationId"))
                .addKeyValue("routeTemplate", fields.get("routeTemplate"))
                .addKeyValue("owner", fields.get("owner"))
                .addKeyValue("event", fields.get("event"))
                .addKeyValue("phase", fields.get("phase"))
                .addKeyValue("outcome", fields.get("outcome"))
                .addKeyValue("durationMillis", fields.get("durationMillis"))
                .addKeyValue("status", fields.get("status"))
                .addKeyValue("errorCode", fields.get("errorCode"))
                .log("security-diagnostic");
    }

    @Override
    public void recordWriteFailure(SecurityDiagnosticEvent failedEvent) {
        // This is deliberately a distinct foundation-owned fallback, not a second event write.
        LOG.atWarn()
                .addKeyValue("event", "DIAGNOSTIC_WRITE_FAILED")
                .addKeyValue("operationId", failedEvent.context().operationId())
                .log("security-diagnostic");
    }
}
