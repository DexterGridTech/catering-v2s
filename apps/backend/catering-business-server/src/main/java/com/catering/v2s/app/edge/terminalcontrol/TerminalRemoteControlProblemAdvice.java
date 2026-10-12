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
        log.atWarn().addKeyValue("event", "TERMINAL_REMOTE_CONTROL_REQUEST_REJECTED")
                .addKeyValue("operationId", state == null ? "unavailable" : state.operationId())
                .addKeyValue("requestId", state == null ? "unavailable" : state.requestId())
                .addKeyValue("correlationId", state == null ? "unavailable" : state.correlationId())
                .addKeyValue("failure", exception.failure().name())
                .log("event=TERMINAL_REMOTE_CONTROL_REQUEST_REJECTED");
        return TerminalRemoteControlWire.problem(exception, request);
    }
}
