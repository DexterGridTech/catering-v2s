package com.catering.v2s.app.edge.terminalcontrol;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.catering.v2s.app.edge.diagnostic.EdgeRouteFaceRegistry;
import com.catering.v2s.app.edge.diagnostic.RequestCompletionDiagnosticState;
import com.catering.v2s.app.edge.generated.wire.TerminalRemoteControlRegisterRequest;
import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi;
import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi.Outcome;
import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi.Verification;
import com.catering.v2s.terminalcontrol.api.TerminalRemoteControlOwnerApi;
import com.catering.v2s.terminalcontrol.api.TerminalRemoteControlOwnerApi.Failure;
import com.catering.v2s.terminalcontrol.api.TerminalRemoteControlOwnerApi.RemoteControlException;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class TerminalRemoteControlControllerDiagnosticTest {
    @Test
    void typedRejectionMessageCarriesTheFieldsConsumedByManagedDiagnosticProjection() {
        MockHttpServletRequest request = request();
        Logger logger = (Logger) LoggerFactory.getLogger(TerminalRemoteControlProblemAdvice.class);
        ListAppender<ILoggingEvent> appender = new ListAppender<>();
        appender.start();
        logger.addAppender(appender);
        try {
            new TerminalRemoteControlProblemAdvice().remoteControl(new RemoteControlException(Failure.NOT_READY), request);

            ILoggingEvent event = appender.list.stream().filter(item ->
                    item.getFormattedMessage().contains("event=TERMINAL_REMOTE_CONTROL_REQUEST_REJECTED"))
                    .findFirst().orElseThrow();
            assertTrue(event.getFormattedMessage().contains("operationId=registerTerminalRemoteControl"));
            assertTrue(event.getFormattedMessage().contains("requestId=request-remote-register"));
            assertTrue(event.getFormattedMessage().contains("correlationId=correlation-remote-register"));
            assertTrue(event.getFormattedMessage().contains("failure=NOT_READY"));
            assertEquals(null, event.getThrowableProxy());
        } finally {
            logger.detachAppender(appender);
            appender.stop();
        }
    }

    @Test
    void unexpectedRegistrationFailureLogsCorrelatedSafeCauseWithoutChangingFailure() {
        String groupKey = "remote-control-test";
        UUID terminalRef = UUID.randomUUID();
        UUID sessionId = UUID.randomUUID();
        String secret = java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(new byte[32]);
        String authorization = "Terminal 1." + secret;
        var credentials = mock(TerminalCredentialVerificationApi.class);
        var owner = mock(TerminalRemoteControlOwnerApi.class);
        when(credentials.verifyBusinessCredential(any())).thenReturn(new Verification(
                Outcome.VERIFIED, UUID.randomUUID(), groupKey, UUID.randomUUID(), terminalRef, 1, 10, "device"));
        when(owner.register(any())).thenThrow(new IllegalStateException("private request detail"));
        var controller = new TerminalRemoteControlController(credentials, owner);
        MockHttpServletRequest request = request();
        Logger logger = (Logger) LoggerFactory.getLogger(TerminalRemoteControlController.class);
        ListAppender<ILoggingEvent> appender = new ListAppender<>();
        appender.start();
        logger.addAppender(appender);
        try {
            assertThrows(IllegalStateException.class, () -> controller.register(groupKey, sessionId, request,
                    authorization, terminalRef.toString(), new TerminalRemoteControlRegisterRequest(
                            sessionId, "MOBILE_SINGLE", tools.jackson.databind.node.JsonNodeFactory.instance.nullNode())));

            ILoggingEvent event = appender.list.stream().filter(item ->
                    item.getFormattedMessage().contains("event=TERMINAL_REMOTE_CONTROL_REGISTER_UNEXPECTED_FAILURE"))
                    .findFirst().orElseThrow();
            Map<String, String> fields = event.getKeyValuePairs().stream().collect(
                    Collectors.toMap(pair -> pair.key, pair -> String.valueOf(pair.value)));
            assertEquals("registerTerminalRemoteControl", fields.get("operationId"));
            assertEquals("request-remote-register", fields.get("requestId"));
            assertEquals("correlation-remote-register", fields.get("correlationId"));
            assertEquals("IllegalStateException", fields.get("exceptionType"));
            assertEquals("IllegalStateException", fields.get("rootCauseType"));
            assertEquals("OWNER", fields.get("phase"));
            assertTrue(fields.get("exceptionOrigin").contains("#"));
            assertTrue(event.getFormattedMessage().contains("requestId=request-remote-register"));
            assertFalse(event.getFormattedMessage().contains("private request detail"));
            assertFalse(event.getFormattedMessage().contains(secret));
            assertEquals(null, event.getThrowableProxy());
        } finally {
            logger.detachAppender(appender);
            appender.stop();
        }
    }

    @Test
    void unexpectedCredentialVerificationFailureLogsTheCredentialBoundary() {
        String groupKey = "remote-control-test";
        UUID terminalRef = UUID.randomUUID();
        UUID sessionId = UUID.randomUUID();
        String secret = java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(new byte[32]);
        var credentials = mock(TerminalCredentialVerificationApi.class);
        var owner = mock(TerminalRemoteControlOwnerApi.class);
        when(credentials.verifyBusinessCredential(any())).thenThrow(new IllegalStateException("private database detail"));
        var controller = new TerminalRemoteControlController(credentials, owner);
        Logger logger = (Logger) LoggerFactory.getLogger(TerminalRemoteControlController.class);
        ListAppender<ILoggingEvent> appender = new ListAppender<>();
        appender.start();
        logger.addAppender(appender);
        try {
            assertThrows(IllegalStateException.class, () -> controller.register(groupKey, sessionId, request(),
                    "Terminal 1." + secret, terminalRef.toString(), new TerminalRemoteControlRegisterRequest(
                            sessionId, "MOBILE_SINGLE", tools.jackson.databind.node.JsonNodeFactory.instance.nullNode())));

            ILoggingEvent event = appender.list.stream().filter(item ->
                    item.getFormattedMessage().contains("event=TERMINAL_REMOTE_CONTROL_REGISTER_UNEXPECTED_FAILURE"))
                    .findFirst().orElseThrow();
            Map<String, String> fields = event.getKeyValuePairs().stream().collect(
                    Collectors.toMap(pair -> pair.key, pair -> String.valueOf(pair.value)));
            assertEquals("CREDENTIAL", fields.get("phase"));
            assertEquals("request-remote-register", fields.get("requestId"));
            assertEquals(terminalRef.toString(), fields.get("terminalRef"));
            assertFalse(event.getFormattedMessage().contains("private database detail"));
            assertFalse(event.getFormattedMessage().contains(secret));
            assertEquals(null, event.getThrowableProxy());
        } finally {
            logger.detachAppender(appender);
            appender.stop();
        }
    }

    @Test
    void unexpectedResponseProjectionFailureLogsItsOwnBoundary() {
        String groupKey = "remote-control-test";
        UUID terminalRef = UUID.randomUUID();
        UUID sessionId = UUID.randomUUID();
        String secret = java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(new byte[32]);
        var credentials = mock(TerminalCredentialVerificationApi.class);
        var owner = mock(TerminalRemoteControlOwnerApi.class);
        when(credentials.verifyBusinessCredential(any())).thenReturn(new Verification(
                Outcome.VERIFIED, UUID.randomUUID(), groupKey, UUID.randomUUID(), terminalRef, 1, 10, "device"));
        when(owner.register(any())).thenReturn(null);
        var controller = new TerminalRemoteControlController(credentials, owner);
        Logger logger = (Logger) LoggerFactory.getLogger(TerminalRemoteControlController.class);
        ListAppender<ILoggingEvent> appender = new ListAppender<>();
        appender.start();
        logger.addAppender(appender);
        try {
            assertThrows(NullPointerException.class, () -> controller.register(groupKey, sessionId, request(),
                    "Terminal 1." + secret, terminalRef.toString(), new TerminalRemoteControlRegisterRequest(
                            sessionId, "MOBILE_SINGLE", tools.jackson.databind.node.JsonNodeFactory.instance.nullNode())));

            ILoggingEvent event = appender.list.stream().filter(item ->
                    item.getFormattedMessage().contains("event=TERMINAL_REMOTE_CONTROL_REGISTER_UNEXPECTED_FAILURE"))
                    .findFirst().orElseThrow();
            Map<String, String> fields = event.getKeyValuePairs().stream().collect(
                    Collectors.toMap(pair -> pair.key, pair -> String.valueOf(pair.value)));
            assertEquals("RESPONSE_WIRE", fields.get("phase"));
            assertEquals("request-remote-register", fields.get("requestId"));
            assertFalse(event.getFormattedMessage().contains(secret));
            assertEquals(null, event.getThrowableProxy());
        } finally {
            logger.detachAppender(appender);
            appender.stop();
        }
    }

    private static MockHttpServletRequest request() {
        MockHttpServletRequest request = new MockHttpServletRequest("POST",
                "/api/terminal/group-workspaces/remote-control-test/remote-control-sessions/session/registration");
        request.addHeader("X-Correlation-Id", "correlation-remote-register");
        MockHttpServletResponse response = new MockHttpServletResponse();
        response.setHeader("X-Request-Id", "request-remote-register");
        RequestCompletionDiagnosticState.getOrCreate(request, response,
                new EdgeRouteFaceRegistry.Definition("registerTerminalRemoteControl", "POST",
                        "/api/terminal/group-workspaces/{groupWorkspaceKey}/remote-control-sessions/{sessionId}/registration",
                        "terminal-control", "terminal"));
        return request;
    }
}
