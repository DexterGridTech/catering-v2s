package com.catering.v2s.app.edge.terminal;

import com.catering.v2s.app.edge.generated.wire.TerminalActivationRequest;
import com.catering.v2s.app.edge.generated.wire.TerminalActivationResult;
import com.catering.v2s.app.edge.diagnostic.RequestCompletionDiagnosticState;
import com.catering.v2s.terminalbinding.api.TerminalBindingOwnerApi.ActivationOutcome;
import com.catering.v2s.terminalbinding.api.TerminalBindingOwnerApi.ActivationResult;
import java.util.Objects;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Public device protocol. It intentionally has no user-session or permission dependencies. */
@RestController
@RequestMapping("/api/terminal/group-workspaces/{groupWorkspaceKey}")
public final class TerminalActivationController {
    private static final Logger log = LoggerFactory.getLogger(TerminalActivationController.class);
    private final ActivateTerminalOperation activation;

    public TerminalActivationController(ActivateTerminalOperation activation) {
        this.activation = Objects.requireNonNull(activation, "activation");
    }

    @PostMapping("/activation")
    public ResponseEntity<TerminalActivationResult> activate(
            @PathVariable String groupWorkspaceKey,
            @RequestBody TerminalActivationRequest request,
            @RequestAttribute(value = RequestCompletionDiagnosticState.REQUEST_ATTRIBUTE, required = false)
                    RequestCompletionDiagnosticState completion) {
        String requestId = completion == null ? "unavailable" : completion.requestId();
        String correlationId = completion == null ? "unavailable" : completion.correlationId();
        long startedAtNanos = System.nanoTime();
        log.atInfo()
                .addKeyValue("event", "TERMINAL_ACTIVATION_HTTP_STARTED")
                .addKeyValue("operationId", "activateTerminal")
                .addKeyValue("requestId", requestId)
                .addKeyValue("correlationId", correlationId)
                .log("terminal activation HTTP handler started");
        ActivationResult result;
        try {
            result = activation.execute(groupWorkspaceKey, request);
        } catch (RuntimeException failure) {
            log.atError()
                    .addKeyValue("event", "TERMINAL_ACTIVATION_HTTP_FAILED")
                    .addKeyValue("operationId", "activateTerminal")
                    .addKeyValue("requestId", requestId)
                    .addKeyValue("correlationId", correlationId)
                    .addKeyValue("exceptionType", failure.getClass().getSimpleName())
                    .addKeyValue(
                            "causeType",
                            failure.getCause() == null
                                    ? "none"
                                    : failure.getCause().getClass().getSimpleName())
                    .addKeyValue(
                            "elapsedMillis",
                            Math.max(0, (System.nanoTime() - startedAtNanos) / 1_000_000))
                    .log("terminal activation HTTP handler failed");
            throw failure;
        }
        log.atInfo()
                .addKeyValue("event", "TERMINAL_ACTIVATION_HTTP_RESULT")
                .addKeyValue("operationId", "activateTerminal")
                .addKeyValue("requestId", requestId)
                .addKeyValue("correlationId", correlationId)
                .addKeyValue("outcome", result.outcome().name())
                .addKeyValue("elapsedMillis", Math.max(0, (System.nanoTime() - startedAtNanos) / 1_000_000))
                .log("terminal activation HTTP handler returned an owner outcome");
        if (result.outcome() != ActivationOutcome.ACTIVATED) throw TerminalActivationProblem.from(result.outcome());
        return ResponseEntity.ok(new TerminalActivationResult(
                result.terminalRef(), result.storeRef(), result.groupWorkspaceKey(), result.bindingGeneration()));
    }
}
