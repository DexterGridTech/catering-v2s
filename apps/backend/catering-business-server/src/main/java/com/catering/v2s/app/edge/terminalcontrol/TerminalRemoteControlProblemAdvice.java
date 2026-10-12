package com.catering.v2s.app.edge.terminalcontrol;

import com.catering.v2s.app.edge.diagnostic.RequestCompletionDiagnosticState;
import com.catering.v2s.terminalcontrol.api.TerminalRemoteControlOwnerApi.RemoteControlException;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice(assignableTypes = {
        com.catering.v2s.app.edge.operations.terminalcontrol.OperationsRemoteControlController.class,
        TerminalRemoteControlController.class
})
public final class TerminalRemoteControlProblemAdvice {
    private static final Logger log = LoggerFactory.getLogger(TerminalRemoteControlProblemAdvice.class);

    @ExceptionHandler(RemoteControlException.class)
    ResponseEntity<com.catering.v2s.app.edge.problem.ContractProblemAdvice.Problem> remoteControl(
            RemoteControlException exception, HttpServletRequest request) {
        RequestCompletionDiagnosticState state = RequestCompletionDiagnosticState.find(request);
        String operationId = state == null ? "unavailable" : state.operationId();
        String requestId = state == null ? "unavailable" : state.requestId();
        String correlationId = state == null ? "unavailable" : state.correlationId();
        String failure = exception.failure().name();
        log.atWarn().addKeyValue("event", "TERMINAL_REMOTE_CONTROL_REQUEST_REJECTED")
                .addKeyValue("operationId", operationId)
                .addKeyValue("requestId", requestId)
                .addKeyValue("correlationId", correlationId)
                .addKeyValue("failure", failure)
                .log("event=TERMINAL_REMOTE_CONTROL_REQUEST_REJECTED operationId={} requestId={} correlationId={} failure={}",
                        operationId, requestId, correlationId, failure);
        return TerminalRemoteControlWire.problem(exception, request);
    }
}
