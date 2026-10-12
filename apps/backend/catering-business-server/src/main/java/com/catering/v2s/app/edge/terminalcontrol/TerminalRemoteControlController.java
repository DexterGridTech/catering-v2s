package com.catering.v2s.app.edge.terminalcontrol;

import com.catering.v2s.app.edge.diagnostic.RequestCompletionDiagnosticState;
import com.catering.v2s.app.edge.generated.wire.TerminalRemoteControlRegisterRequest;
import com.catering.v2s.app.edge.generated.wire.TerminalRemoteControlRegisterResponse;
import com.catering.v2s.app.edge.generated.wire.TerminalRemoteControlStatusReportReceipt;
import com.catering.v2s.app.edge.generated.wire.TerminalRemoteControlStatusReportRequest;
import com.catering.v2s.app.edge.terminal.TerminalCredentialEdgeVerifier;
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
        Verification credential = TerminalCredentialEdgeVerifier.verify(credentials, groupWorkspaceKey,
                authorization, terminalRef);
        var result = owner.register(new RegistrationCommand(credential, sessionId, request.topologyKind(),
                TerminalRemoteControlWire.peer(request.peerIdentity())));
        RequestCompletionDiagnosticState diagnostic = RequestCompletionDiagnosticState.find(servletRequest);
        log.atInfo().addKeyValue("event", "TERMINAL_REMOTE_CONTROL_REGISTERED")
                .addKeyValue("operationId", "registerTerminalRemoteControl")
                .addKeyValue("requestId", diagnostic == null ? "unavailable" : diagnostic.requestId())
                .addKeyValue("correlationId", diagnostic == null ? "unavailable" : diagnostic.correlationId())
                .addKeyValue("terminalRef", credential.terminalRef()).addKeyValue("sessionId", sessionId)
                .addKeyValue("topologyKind", request.topologyKind())
                .addKeyValue("endpointCount", result.grants().size()).log("event=TERMINAL_REMOTE_CONTROL_REGISTERED");
        return ResponseEntity.ok(TerminalRemoteControlWire.registration(result));
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
