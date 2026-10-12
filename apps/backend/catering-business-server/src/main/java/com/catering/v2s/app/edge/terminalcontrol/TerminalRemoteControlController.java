package com.catering.v2s.app.edge.terminalcontrol;

import com.catering.v2s.app.edge.diagnostic.RequestCompletionDiagnosticState;
import com.catering.v2s.app.edge.generated.wire.TerminalRemoteControlRegisterRequest;
import com.catering.v2s.app.edge.generated.wire.TerminalRemoteControlRegisterResponse;
import com.catering.v2s.app.edge.generated.wire.TerminalRemoteControlStatusReportReceipt;
import com.catering.v2s.app.edge.generated.wire.TerminalRemoteControlStatusReportRequest;
import com.catering.v2s.app.edge.problem.InvalidEdgeRequestException;
import com.catering.v2s.app.edge.terminal.TerminalCredentialEdgeVerifier;
import com.catering.v2s.app.edge.terminal.TerminalDataReadProblem;
import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi;
import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi.Verification;
import com.catering.v2s.terminalcontrol.api.TerminalRemoteControlOwnerApi;
import com.catering.v2s.terminalcontrol.api.TerminalRemoteControlOwnerApi.ReadyScreen;
import com.catering.v2s.terminalcontrol.api.TerminalRemoteControlOwnerApi.RegistrationCommand;
import com.catering.v2s.terminalcontrol.api.TerminalRemoteControlOwnerApi.StatusReportCommand;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Terminal credential edge for MASTER registration and finite lease/status reports. */
@RestController
@RequestMapping("/api/terminal/group-workspaces/{groupWorkspaceKey}/remote-control-sessions")
public final class TerminalRemoteControlController {
    private static final Logger log = LoggerFactory.getLogger(TerminalRemoteControlController.class);

    private final TerminalCredentialVerificationApi credentials;
    private final TerminalRemoteControlOwnerApi owner;

    public TerminalRemoteControlController(TerminalCredentialVerificationApi credentials,
            TerminalRemoteControlOwnerApi owner) {
        this.credentials = credentials;
        this.owner = owner;
    }

    @PostMapping("/{sessionId}/registration")
    ResponseEntity<TerminalRemoteControlRegisterResponse> register(@PathVariable String groupWorkspaceKey,
            @PathVariable UUID sessionId,
            HttpServletRequest servletRequest,
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestHeader(value = "X-Terminal-Ref", required = false) String terminalRef,
            @RequestBody TerminalRemoteControlRegisterRequest request) {
        Verification credential;
        try {
            credential = TerminalCredentialEdgeVerifier.verify(credentials, groupWorkspaceKey,
                    authorization, terminalRef);
        } catch (InvalidEdgeRequestException | TerminalDataReadProblem typed) {
            throw typed;
        } catch (RuntimeException failure) {
            logUnexpectedRegistrationFailure(servletRequest, safeTerminalRef(terminalRef), "CREDENTIAL", failure);
            throw failure;
        }

        TerminalRemoteControlOwnerApi.RegistrationReadback result;
        try {
            result = owner.register(new RegistrationCommand(credential, sessionId, request.topologyKind(),
                    TerminalRemoteControlWire.peer(request.peerIdentity())));
        } catch (TerminalRemoteControlOwnerApi.RemoteControlException typed) {
            throw typed;
        } catch (RuntimeException failure) {
            logUnexpectedRegistrationFailure(servletRequest, credential.terminalRef().toString(), "OWNER", failure);
            throw failure;
        }

        TerminalRemoteControlRegisterResponse response;
        try {
            response = TerminalRemoteControlWire.registration(result);
        } catch (RuntimeException failure) {
            logUnexpectedRegistrationFailure(servletRequest, credential.terminalRef().toString(), "RESPONSE_WIRE", failure);
            throw failure;
        }
        RequestCompletionDiagnosticState diagnostic = RequestCompletionDiagnosticState.find(servletRequest);
        log.atInfo().addKeyValue("event", "TERMINAL_REMOTE_CONTROL_REGISTERED")
                .addKeyValue("operationId", "registerTerminalRemoteControl")
                .addKeyValue("requestId", diagnostic == null ? "unavailable" : diagnostic.requestId())
                .addKeyValue("correlationId", diagnostic == null ? "unavailable" : diagnostic.correlationId())
                .addKeyValue("terminalRef", credential.terminalRef()).addKeyValue("sessionId", sessionId)
                .addKeyValue("topologyKind", request.topologyKind())
                .addKeyValue("endpointCount", result.grants().size()).log("event=TERMINAL_REMOTE_CONTROL_REGISTERED");
        return ResponseEntity.ok(response);
    }

    private static void logUnexpectedRegistrationFailure(HttpServletRequest request, String terminalRef,
            String phase, RuntimeException failure) {
        RequestCompletionDiagnosticState state = RequestCompletionDiagnosticState.find(request);
        String operationId = state == null ? "unavailable" : state.operationId();
        String requestId = state == null ? "unavailable" : state.requestId();
        String correlationId = state == null ? "unavailable" : state.correlationId();
        Throwable root = rootCause(failure);
        String exceptionType = safeType(failure);
        String rootCauseType = safeType(root);
        String exceptionOrigin = safeOrigin(root);
        log.atError().addKeyValue("event", "TERMINAL_REMOTE_CONTROL_REGISTER_UNEXPECTED_FAILURE")
                .addKeyValue("operationId", operationId)
                .addKeyValue("requestId", requestId)
                .addKeyValue("correlationId", correlationId)
                .addKeyValue("terminalRef", terminalRef)
                .addKeyValue("phase", phase)
                .addKeyValue("exceptionType", exceptionType)
                .addKeyValue("rootCauseType", rootCauseType)
                .addKeyValue("exceptionOrigin", exceptionOrigin)
                .log("event=TERMINAL_REMOTE_CONTROL_REGISTER_UNEXPECTED_FAILURE operationId={} requestId={} " +
                                "correlationId={} terminalRef={} phase={} exceptionType={} rootCauseType={} exceptionOrigin={}",
                        operationId, requestId, correlationId, terminalRef, phase, exceptionType, rootCauseType,
                        exceptionOrigin);
    }

    private static String safeTerminalRef(String value) {
        try { return UUID.fromString(value).toString(); }
        catch (RuntimeException malformed) { return "unavailable"; }
    }

    private static Throwable rootCause(Throwable failure) {
        Throwable current = failure;
        for (int depth = 0; depth < 16; depth++) {
            Throwable cause = current.getCause();
            if (cause == null || cause == current) return current;
            current = cause;
        }
        return current;
    }

    private static String safeType(Throwable failure) {
        String value = failure.getClass().getSimpleName();
        return value.matches("[A-Za-z0-9_$]{1,128}") ? value : "unavailable";
    }

    private static String safeOrigin(Throwable failure) {
        StackTraceElement[] trace = failure.getStackTrace();
        if (trace.length == 0) return "unavailable";
        StackTraceElement first = trace[0];
        String value = first.getClassName() + "#" + first.getMethodName();
        return value.matches("[A-Za-z0-9_.$#<>]{1,160}") ? value : "unavailable";
    }

    @PostMapping("/{sessionId}/status")
    ResponseEntity<TerminalRemoteControlStatusReportReceipt> report(@PathVariable String groupWorkspaceKey,
            @PathVariable UUID sessionId,
            HttpServletRequest servletRequest,
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestHeader(value = "X-Terminal-Ref", required = false) String terminalRef,
            @RequestBody TerminalRemoteControlStatusReportRequest request) {
        Verification credential = TerminalCredentialEdgeVerifier.verify(credentials, groupWorkspaceKey,
                authorization, terminalRef);
        if (!sessionId.equals(request.sessionId()))
            throw new TerminalRemoteControlOwnerApi.RemoteControlException(
                    TerminalRemoteControlOwnerApi.Failure.IDENTITY_CONFLICT);
        List<ReadyScreen> screens = request.readyScreens().stream().map(item ->
                new ReadyScreen(item.endpointId(), item.screen(), item.streamId(), item.trackSid())).toList();
        var result = owner.report(new StatusReportCommand(credential, sessionId,
                TerminalRemoteControlWire.state(request.state()), request.reason(), screens));
        RequestCompletionDiagnosticState diagnostic = RequestCompletionDiagnosticState.find(servletRequest);
        log.atInfo().addKeyValue("event", "TERMINAL_REMOTE_CONTROL_STATUS_ACCEPTED")
                .addKeyValue("operationId", "reportTerminalRemoteControl")
                .addKeyValue("requestId", diagnostic == null ? "unavailable" : diagnostic.requestId())
                .addKeyValue("correlationId", diagnostic == null ? "unavailable" : diagnostic.correlationId())
                .addKeyValue("terminalRef", credential.terminalRef()).addKeyValue("sessionId", sessionId)
                .addKeyValue("state", result.state()).addKeyValue("reason", result.reason())
                .addKeyValue("readyScreenCount", screens.size()).log("event=TERMINAL_REMOTE_CONTROL_STATUS_ACCEPTED");
        return ResponseEntity.ok(TerminalRemoteControlWire.receipt(result));
    }
}
