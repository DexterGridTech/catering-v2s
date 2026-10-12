package com.catering.v2s.app.edge.terminal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.catering.v2s.app.edge.generated.wire.TerminalUpdateReportActual;
import com.catering.v2s.app.edge.generated.wire.TerminalUpdateReportReceipt;
import com.catering.v2s.app.edge.generated.wire.TerminalUpdateReportRecent;
import com.catering.v2s.app.edge.generated.wire.TerminalUpdateReportRequest;
import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi;
import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi.Outcome;
import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi.Verification;
import com.catering.v2s.terminalupdate.api.TerminalUpdateReportOwnerApi;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class TerminalUpdateReportControllerTest {
    @Test
    void acceptsCurrentWaitingAndAdmissionRejectionReportValues() {
        String groupKey = "terminal-report-test";
        UUID terminalRef = UUID.randomUUID();
        UUID workspaceRef = UUID.randomUUID();
        UUID storeRef = UUID.randomUUID();
        UUID taskId = UUID.randomUUID();
        var credentials = mock(TerminalCredentialVerificationApi.class);
        var reports = mock(TerminalUpdateReportOwnerApi.class);
        when(credentials.verifyBusinessCredential(any())).thenReturn(new Verification(
                Outcome.VERIFIED, workspaceRef, groupKey, storeRef, terminalRef, 1, 10, "device-test"));
        when(reports.record(any(), any())).thenAnswer(invocation -> {
            TerminalUpdateReportOwnerApi.ReportInput input = invocation.getArgument(1);
            return new TerminalUpdateReportOwnerApi.ReportReceipt(
                    input.reportId(), input.taskId(), input.reportSequence(), "ACCEPTED");
        });
        var controller = new TerminalUpdateReportController(credentials, reports);
        Logger logger = (Logger) LoggerFactory.getLogger(TerminalUpdateReportController.class);
        ListAppender<ILoggingEvent> appender = new ListAppender<>();
        appender.start();
        logger.addAppender(appender);
        String secret = java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(new byte[32]);
        String authorization = "Terminal 1." + secret;
        TerminalUpdateReportActual actual = new TerminalUpdateReportActual(
                tools.jackson.databind.node.JsonNodeFactory.instance.textNode("1.0.0"),
                tools.jackson.databind.node.JsonNodeFactory.instance.numberNode(1),
                "com.example.terminal", "1", tools.jackson.databind.node.JsonNodeFactory.instance.nullNode(),
                tools.jackson.databind.node.JsonNodeFactory.instance.textNode("a".repeat(64)),
                tools.jackson.databind.node.JsonNodeFactory.instance.textNode("b".repeat(64)),
                tools.jackson.databind.node.JsonNodeFactory.instance.nullNode(), "INSTALLED_APK", null);
        String[][] currentValues = {
            {"WAITING_IDLE", "NONE"},
            {"ADMISSION_REJECTED", "INCOMPATIBLE"},
            {"ADMISSION_REJECTED", "WOULD_DOWNGRADE"},
            {"ADMISSION_REJECTED", "FAILED_ARTIFACT"}
        };

        for (int i = 0; i < currentValues.length; i++) {
            MockHttpServletRequest servletRequest = servletRequest(i);
            UUID reportId = UUID.randomUUID();
            TerminalUpdateReportRecent recent = new TerminalUpdateReportRecent(
                    currentValues[i][0], currentValues[i][1], 100L + i, null, null, null);
            TerminalUpdateReportRequest request = new TerminalUpdateReportRequest(
                    reportId, (long) i + 1, taskId, actual, recent);
            var response = controller.submit(servletRequest, groupKey, authorization, terminalRef.toString(), reportId.toString(), request);
            assertEquals(HttpStatus.OK, response.getStatusCode());
            TerminalUpdateReportReceipt receipt = response.getBody();
            assertEquals(reportId, receipt.reportId());
            assertEquals("ACCEPTED", receipt.outcome());
        }

        verify(reports, org.mockito.Mockito.times(currentValues.length)).record(any(), any());
        try {
            assertEquals(currentValues.length, appender.list.size());
            ILoggingEvent event = appender.list.getFirst();
            var fields = event.getKeyValuePairs().stream()
                    .collect(java.util.stream.Collectors.toMap(pair -> pair.key, pair -> String.valueOf(pair.value)));
            assertEquals("TERMINAL_UPDATE_REPORT_ACCEPTED", fields.get("event"));
            assertEquals("submitTerminalUpdateReport", fields.get("operationId"));
            assertEquals("request-report-test-0", fields.get("requestId"));
            assertEquals("correlation-report-test-0", fields.get("correlationId"));
            assertEquals(terminalRef.toString(), fields.get("terminalRef"));
            assertTrue(event.getFormattedMessage().contains("event=TERMINAL_UPDATE_REPORT_ACCEPTED"));
            assertTrue(event.getFormattedMessage().contains("requestId=request-report-test-0"));
            assertTrue(event.getFormattedMessage().contains("correlationId=correlation-report-test-0"));
            assertTrue(event.getFormattedMessage().contains("taskId=" + taskId));
            assertTrue(event.getFormattedMessage().contains("reportId="));
            assertFalse(java.util.Arrays.toString(fields.values().toArray()).contains(secret));
        } finally {
            logger.detachAppender(appender);
            appender.stop();
        }
    }

    private static MockHttpServletRequest servletRequest(int index) {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/terminal/group-workspaces/test/update-reports");
        request.addHeader("X-Correlation-Id", "correlation-report-test-" + index);
        MockHttpServletResponse response = new MockHttpServletResponse();
        response.setHeader("X-Request-Id", "request-report-test-" + index);
        com.catering.v2s.app.edge.diagnostic.RequestCompletionDiagnosticState.getOrCreate(
                request, response, new com.catering.v2s.app.edge.diagnostic.EdgeRouteFaceRegistry.Definition(
                        "submitTerminalUpdateReport", "POST", "/api/terminal/group-workspaces/{groupWorkspaceKey}/update-reports",
                        "terminal-update", "terminal"));
        return request;
    }
}
