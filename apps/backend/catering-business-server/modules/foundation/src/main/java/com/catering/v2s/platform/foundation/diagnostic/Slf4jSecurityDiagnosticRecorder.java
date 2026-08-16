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
                .addKeyValue("correlationId", fields.correlationId())
                .addKeyValue("requestId", fields.requestId())
                .addKeyValue("operationId", fields.operationId())
                .addKeyValue("routeTemplate", fields.routeTemplate())
                .addKeyValue("owner", fields.owner())
                .addKeyValue("event", fields.event())
                .addKeyValue("phase", fields.phase())
                .addKeyValue("outcome", fields.outcome())
                .addKeyValue("durationMillis", fields.durationMillis())
                .addKeyValue("status", fields.status() == null ? "unassigned" : fields.status())
                .addKeyValue("errorCode", fields.errorCode() == null ? "unassigned" : fields.errorCode())
                .addKeyValue("databaseOperationCount", fields.databaseOperationCount())
                .addKeyValue("databaseDurationMillis", fields.databaseDurationMillis())
                .log(render(fields));
    }

    @Override
    public void recordCompletion(RequestCompletionEvent event) {
        var fields = event.fields();
        LOG.atInfo()
                .addKeyValue("correlationId", fields.correlationId())
                .addKeyValue("requestId", fields.requestId())
                .addKeyValue("operationId", fields.operationId())
                .addKeyValue("routeTemplate", fields.routeTemplate())
                .addKeyValue("owner", fields.owner())
                .addKeyValue("consumerFace", fields.consumerFace())
                .addKeyValue("event", "REQUEST_COMPLETED")
                .addKeyValue("phase", "EDGE")
                .addKeyValue("outcome", fields.outcome())
                .addKeyValue("durationMillis", fields.durationMillis())
                .addKeyValue("status", fields.status())
                .addKeyValue("errorCode", fields.errorCode() == null ? "unassigned" : fields.errorCode())
                .addKeyValue("databaseOperationCount", fields.databaseOperationCount())
                .addKeyValue("databaseDurationMillis", fields.databaseDurationMillis())
                .log(renderCompletion(fields));
    }

    @Override
    public void recordWriteFailure(SecurityDiagnosticEvent failedEvent) {
        // This is deliberately a distinct foundation-owned fallback, not a second event write.
        LOG.atWarn()
                .addKeyValue("event", "DIAGNOSTIC_WRITE_FAILED")
                .addKeyValue("operationId", failedEvent.context().operationId())
                .log(
                        "security-diagnostic event=DIAGNOSTIC_WRITE_FAILED operationId={}",
                        failedEvent.context().operationId());
    }

    @Override
    public void recordCompletionWriteFailure(RequestCompletionEvent failedEvent) {
        LOG.atWarn()
                .addKeyValue("event", "DIAGNOSTIC_COMPLETION_WRITE_FAILED")
                .addKeyValue("operationId", failedEvent.fields().operationId())
                .log(
                        "security-diagnostic event=DIAGNOSTIC_COMPLETION_WRITE_FAILED operationId={}",
                        failedEvent.fields().operationId());
    }

    static String render(SecurityDiagnosticEvent.Fields fields) {
        return "security-diagnostic correlationId=" + fields.correlationId()
                + " requestId=" + fields.requestId()
                + " operationId=" + fields.operationId()
                + " routeTemplate=" + fields.routeTemplate()
                + " owner=" + fields.owner()
                + " event=" + fields.event()
                + " phase=" + fields.phase()
                + " outcome=" + fields.outcome()
                + " durationMillis=" + fields.durationMillis()
                + " status=" + (fields.status() == null ? "unassigned" : fields.status())
                + " errorCode=" + (fields.errorCode() == null ? "unassigned" : fields.errorCode())
                + " databaseOperationCount=" + fields.databaseOperationCount()
                + " databaseDurationMillis=" + fields.databaseDurationMillis();
    }

    static String renderCompletion(RequestCompletionEvent.Fields fields) {
        return "request-completed correlationId=" + fields.correlationId()
                + " requestId=" + fields.requestId()
                + " operationId=" + fields.operationId()
                + " routeTemplate=" + fields.routeTemplate()
                + " owner=" + fields.owner()
                + " consumerFace=" + fields.consumerFace()
                + " event=REQUEST_COMPLETED phase=EDGE"
                + " outcome=" + fields.outcome()
                + " durationMillis=" + fields.durationMillis()
                + " status=" + fields.status()
                + " errorCode=" + (fields.errorCode() == null ? "unassigned" : fields.errorCode())
                + " databaseOperationCount=" + fields.databaseOperationCount()
                + " databaseDurationMillis=" + fields.databaseDurationMillis();
    }
}
