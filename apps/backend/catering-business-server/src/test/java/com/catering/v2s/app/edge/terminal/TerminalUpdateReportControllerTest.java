package com.catering.v2s.app.edge.terminal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

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
import org.springframework.http.HttpStatus;

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
            UUID reportId = UUID.randomUUID();
            TerminalUpdateReportRecent recent = new TerminalUpdateReportRecent(
                    currentValues[i][0], currentValues[i][1], 100L + i, null, null, null);
            TerminalUpdateReportRequest request = new TerminalUpdateReportRequest(
                    reportId, (long) i + 1, taskId, actual, recent);
            var response = controller.submit(groupKey, authorization, terminalRef.toString(), reportId.toString(), request);
            assertEquals(HttpStatus.OK, response.getStatusCode());
            TerminalUpdateReportReceipt receipt = response.getBody();
            assertEquals(reportId, receipt.reportId());
            assertEquals("ACCEPTED", receipt.outcome());
        }

        verify(reports, org.mockito.Mockito.times(currentValues.length)).record(any(), any());
    }
}
