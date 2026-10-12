package com.catering.v2s.app.edge.operations.terminalupdate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.catering.v2s.app.edge.operations.session.OperationsSessionResolver;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.organization.api.OrganizationTaskPathLookup;
import com.catering.v2s.terminalupdate.api.TerminalUpdateArtifactOwnerApi;
import com.catering.v2s.terminalupdate.api.TerminalUpdateReportOwnerApi;
import com.catering.v2s.terminalupdate.api.TerminalUpdateReportOwnerApi.ReportHistoryPage;
import com.catering.v2s.terminalupdate.api.TerminalUpdateReportOwnerApi.ReportHistoryRow;
import com.catering.v2s.terminalupdate.api.TerminalUpdateReportOwnerApi.ReportReferences;
import com.catering.v2s.terminalupdate.api.TerminalUpdateReportOwnerApi.ReportRuleTarget;
import com.catering.v2s.terminalupdate.api.TerminalUpdateRuleOwnerApi.RuleArtifactIdentity;
import com.catering.v2s.workspace.iam.api.WorkspaceAuthorizationCatalog;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class OperationsTerminalUpdateReportHistoryLoggingTest {
    private static final UUID WORKSPACE = UUID.fromString("11111111-1111-4111-8111-111111111111");
    private static final UUID PROJECT = UUID.fromString("22222222-2222-4222-8222-222222222222");
    private static final UUID TERMINAL = UUID.fromString("33333333-3333-4333-8333-333333333333");
    private static final UUID REPORT = UUID.fromString("44444444-4444-4444-8444-444444444444");
    private static final UUID TASK = UUID.fromString("55555555-5555-4555-8555-555555555555");
    private static final String GROUP = "history-log-test";

    @Test
    void successfulHistoryReadLogsActualPageShapeAndRequestIdentityWithoutReportBody() {
        OperationsSessionResolver sessions = mock(OperationsSessionResolver.class);
        OrganizationTaskPathLookup organization = mock(OrganizationTaskPathLookup.class);
        TerminalUpdateArtifactOwnerApi artifacts = mock(TerminalUpdateArtifactOwnerApi.class);
        TerminalUpdateReportOwnerApi reports = mock(TerminalUpdateReportOwnerApi.class);
        EdgeRequestContext request = new EdgeRequestContext("source", "corr-history-9", null, null,
                null, null, null, "req-history-9", null, null, null, null);
        MockHttpServletRequest servletRequest = new MockHttpServletRequest("GET",
                "/api/operations/group-workspaces/history-log-test/projects/22222222-2222-4222-8222-222222222222/terminal-versions/33333333-3333-4333-8333-333333333333/update-reports");
        servletRequest.addHeader("X-Correlation-Id", "corr-history-9");
        MockHttpServletResponse servletResponse = new MockHttpServletResponse();
        servletResponse.setHeader("X-Request-Id", "req-history-9");
        com.catering.v2s.app.edge.diagnostic.RequestCompletionDiagnosticState.getOrCreate(
                servletRequest, servletResponse, new com.catering.v2s.app.edge.diagnostic.EdgeRouteFaceRegistry.Definition(
                        "getOperationsProjectTerminalUpdateReportHistoryPage", "GET", "/api/operations/group-workspaces/{groupWorkspaceKey}/projects/{projectRef}/terminal-versions/{terminalRef}/update-reports",
                        "terminal-update", "operations-admin"));
        WorkspaceSessionReadback session = new WorkspaceSessionReadback(
                UUID.randomUUID(), WORKSPACE, GROUP, UUID.randomUUID(), UUID.randomUUID(), null,
                7, 2, Set.of(WorkspaceAuthorizationCatalog.PageDesignKeys.PG_PROJECT_TERMINAL_VERSION_RULES),
                Set.of(), "operator", "PROJECT", PROJECT);
        OrganizationTaskPathLookup.TaskPath path = new OrganizationTaskPathLookup.TaskPath(
                "PROJECT", PROJECT, List.of(PROJECT), "project-path");
        when(sessions.requireWorkspaceReadAtContextVersion(request, GROUP, 7)).thenReturn(session);
        when(organization.requireTaskPath(WORKSPACE, GROUP, "PROJECT", PROJECT)).thenReturn(path);
        when(organization.isScopeAllowed(WORKSPACE, GROUP, "PROJECT", PROJECT, path)).thenReturn(true);
        RuleArtifactIdentity full = new RuleArtifactIdentity("com.example.console", "FULL", "1.0");
        ReportReferences references = new ReportReferences(new ReportRuleTarget(full, null), full, null);
        ReportHistoryRow row = new ReportHistoryRow(REPORT, TASK, 42,
                "{\"apkVersion\":null,\"nativeBuildNumber\":null,\"applicationId\":\"com.example.console\",\"runtimeVersion\":\"1\",\"jsVersion\":null,\"publicationId\":null,\"apkSha256\":null,\"bundleSha256\":null,\"entryKind\":\"UNKNOWN\",\"unknownReason\":\"OTHER\"}",
                "{\"state\":\"UNKNOWN\",\"reason\":\"UNKNOWN\",\"changedAtEpochMillis\":42,\"ruleRef\":null,\"fullArtifactRef\":null,\"hotArtifactRef\":null}",
                references, 123456789L);
        when(reports.readHistory(WORKSPACE, GROUP, PROJECT, TERMINAL, "opaque-cursor-value", 20))
                .thenReturn(new ReportHistoryPage(List.of(row), "cursor-next"));
        var controller = new OperationsTerminalUpdateReadController(sessions, organization, artifacts, reports);

        Logger logger = (Logger) LoggerFactory.getLogger(OperationsTerminalUpdateReadController.class);
        ListAppender<ILoggingEvent> appender = new ListAppender<>();
        appender.start();
        logger.addAppender(appender);
        try {
            var response = controller.history(request, GROUP, PROJECT, TERMINAL, 7, "opaque-cursor-value", 20, servletRequest);
            assertEquals(1, response.items().size());
            assertEquals(42, response.items().getFirst().reportSequence());
            assertEquals(1, appender.list.size());
            var fields = fields(appender.list.getFirst());
            assertEquals("TERMINAL_UPDATE_REPORT_HISTORY_READ", fields.get("event"));
            assertEquals("getOperationsProjectTerminalUpdateReportHistoryPage", fields.get("operationId"));
            assertEquals("req-history-9", fields.get("requestId"));
            assertEquals("corr-history-9", fields.get("correlationId"));
            assertEquals("1", fields.get("itemCount"));
            assertEquals("42", fields.get("firstReportSequence"));
            assertEquals("42", fields.get("lastReportSequence"));
            assertEquals("true", fields.get("cursorPresent"));
            assertEquals("123456789", fields.get("firstReceivedAtEpochMillis"));
            assertEquals("123456789", fields.get("lastReceivedAtEpochMillis"));
            assertEquals(TASK.toString(), fields.get("firstTaskId"));
            assertEquals(TASK.toString(), fields.get("lastTaskId"));
            assertEquals("true", fields.get("nextPagePresent"));
            assertFalse(fields.values().toString().contains("opaque-cursor-value"));
            assertFalse(fields.values().toString().contains("com.example.console"));
            assertFalse(appender.list.getFirst().getFormattedMessage().contains("com.example.console"));
            assertTrue(appender.list.getFirst().getFormattedMessage().contains("event=TERMINAL_UPDATE_REPORT_HISTORY_READ"));
            assertTrue(appender.list.getFirst().getFormattedMessage().contains("cursorPresent=true"));
            assertTrue(appender.list.getFirst().getFormattedMessage().contains("firstTaskId=" + TASK));
            assertTrue(appender.list.getFirst().getFormattedMessage().contains("lastTaskId=" + TASK));
            assertFalse(appender.list.getFirst().getFormattedMessage().contains("opaque-cursor-value"));
        } finally {
            logger.detachAppender(appender);
            appender.stop();
        }
    }

    private static java.util.Map<String, String> fields(ILoggingEvent event) {
        return event.getKeyValuePairs().stream()
                .collect(java.util.stream.Collectors.toMap(pair -> pair.key, pair -> String.valueOf(pair.value)));
    }
}
