package com.catering.v2s.app.edge.terminalcontrol;

import com.catering.v2s.app.edge.generated.wire.TerminalRemoteControlControllerGrant;
import com.catering.v2s.app.edge.generated.wire.TerminalRemoteControlDescription;
import com.catering.v2s.app.edge.generated.wire.TerminalRemoteControlEndpoint;
import com.catering.v2s.app.edge.generated.wire.TerminalRemoteControlEndpointGrant;
import com.catering.v2s.app.edge.generated.wire.TerminalRemoteControlScreen;
import com.catering.v2s.app.edge.generated.wire.TerminalRemoteControlStartResponse;
import com.catering.v2s.app.edge.generated.wire.TerminalRemoteControlStatusReportReceipt;
import com.catering.v2s.app.edge.generated.wire.TerminalRemoteControlRegisterResponse;
import com.catering.v2s.terminalcontrol.api.TerminalRemoteControlOwnerApi;
import com.catering.v2s.terminalcontrol.api.TerminalRemoteControlOwnerApi.EndpointGrant;
import com.catering.v2s.terminalcontrol.api.TerminalRemoteControlOwnerApi.Failure;
import com.catering.v2s.terminalcontrol.api.TerminalRemoteControlOwnerApi.RemoteControlException;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

public final class TerminalRemoteControlWire {
    private static final tools.jackson.databind.ObjectMapper JSON = new tools.jackson.databind.ObjectMapper();

    private TerminalRemoteControlWire() {}

    public static TerminalRemoteControlStartResponse start(TerminalRemoteControlOwnerApi.StartReadback value) {
        return new TerminalRemoteControlStartResponse(value.sessionId(), value.state().name(), value.roomName(),
                value.controllerIdentity(), json(value.description()), value.startOperationId(),
                value.deadlineAt().toEpochMilli());
    }

    public static com.catering.v2s.app.edge.generated.wire.TerminalRemoteControlSessionRead session(
            TerminalRemoteControlOwnerApi.SessionReadback value) {
        return new com.catering.v2s.app.edge.generated.wire.TerminalRemoteControlSessionRead(value.sessionId(),
                value.state().name(), value.reason(), json(value.description()),
                value.startedAt().toEpochMilli(), value.endedAt() == null ? null : value.endedAt().toEpochMilli());
    }

    public static TerminalRemoteControlControllerGrant grant(TerminalRemoteControlOwnerApi.ControllerGrant value) {
        return new TerminalRemoteControlControllerGrant(value.url(), value.roomName(), value.participantIdentity(),
                value.token(), value.expiresAt().toEpochMilli(), description(value.description()));
    }

    public static TerminalRemoteControlRegisterResponse registration(
            TerminalRemoteControlOwnerApi.RegistrationReadback value) {
        List<TerminalRemoteControlEndpointGrant> grants = value.grants().stream()
                .map(TerminalRemoteControlWire::endpointGrant).toList();
        return new TerminalRemoteControlRegisterResponse(description(value.description()), value.remainingLeaseMs(), grants);
    }

    public static TerminalRemoteControlStatusReportReceipt receipt(TerminalRemoteControlOwnerApi.StatusReceipt value) {
        return new TerminalRemoteControlStatusReportReceipt(value.sessionId(), value.state().name(), value.reason(),
                value.remainingLeaseMs());
    }

    public static com.catering.v2s.app.edge.generated.wire.TerminalRemoteControlEndResponse end(
            TerminalRemoteControlOwnerApi.EndReadback value) {
        return new com.catering.v2s.app.edge.generated.wire.TerminalRemoteControlEndResponse(value.sessionId(),
                value.state().name(), value.reason(), value.endedAt().toEpochMilli());
    }

    public static com.catering.v2s.terminalcontrol.api.TerminalRemoteControlOwnerApi.PeerIdentity peer(
            tools.jackson.databind.JsonNode node) {
        if (node == null || node.isNull()) return null;
        if (!node.isObject() || node.size() != 2 || !node.path("moduleName").isTextual()
                || !node.path("nodeId").isTextual()) throw failure(Failure.INVALID_STATE);
        String module = node.path("moduleName").textValue();
        String peerNode = node.path("nodeId").textValue();
        if (module.isBlank() || module.length() > 128 || peerNode.isBlank() || peerNode.length() > 128)
            throw failure(Failure.INVALID_STATE);
        return new com.catering.v2s.terminalcontrol.api.TerminalRemoteControlOwnerApi.PeerIdentity(module, peerNode);
    }

    public static com.catering.v2s.terminalcontrol.api.TerminalRemoteControlOwnerApi.State state(String value) {
        try { return com.catering.v2s.terminalcontrol.api.TerminalRemoteControlOwnerApi.State.valueOf(value); }
        catch (RuntimeException invalid) { throw failure(Failure.INVALID_STATE); }
    }

    static ResponseEntity<com.catering.v2s.app.edge.problem.ContractProblemAdvice.Problem> problem(
            RemoteControlException exception, jakarta.servlet.http.HttpServletRequest request) {
        Failure failure = exception.failure();
        HttpStatus status = switch (failure) {
            case AUTHORIZATION_DENIED, BINDING_INVALID -> HttpStatus.FORBIDDEN;
            case NOT_FOUND -> HttpStatus.NOT_FOUND;
            case SESSION_ENDED -> HttpStatus.GONE;
            case NOT_READY, OCCUPIED, IDENTITY_CONFLICT -> HttpStatus.CONFLICT;
            case INVALID_STATE -> HttpStatus.UNPROCESSABLE_ENTITY;
            case DEPENDENCY_UNAVAILABLE -> HttpStatus.SERVICE_UNAVAILABLE;
        };
        String code = switch (failure) {
            case AUTHORIZATION_DENIED -> "PLATFORM_COMMON_ACCESS_DENIED";
            case NOT_FOUND -> "PLATFORM_COMMON_RESOURCE_NOT_FOUND";
            case BINDING_INVALID -> "TERMINAL_BINDING_CREDENTIAL_INVALID";
            case NOT_READY -> "TERMINAL_CONTROL_REMOTE_NOT_READY";
            case OCCUPIED -> "TERMINAL_CONTROL_REMOTE_OCCUPIED";
            case IDENTITY_CONFLICT -> "TERMINAL_CONTROL_REMOTE_IDENTITY_CONFLICT";
            case SESSION_ENDED -> "TERMINAL_CONTROL_REMOTE_SESSION_ENDED";
            case INVALID_STATE -> "PLATFORM_COMMON_VALIDATION_FAILED";
            case DEPENDENCY_UNAVAILABLE -> "PLATFORM_DEPENDENCY_UNAVAILABLE";
        };
        return com.catering.v2s.app.edge.problem.ContractProblemAdvice.problem(status, code,
                "远程控制请求未能完成", request);
    }

    private static TerminalRemoteControlEndpointGrant endpointGrant(EndpointGrant value) {
        return new TerminalRemoteControlEndpointGrant(value.endpointId(), value.roomName(), value.participantIdentity(),
                value.token(), value.expiresAt().toEpochMilli());
    }

    private static TerminalRemoteControlDescription description(JsonNode value) {
        if (value == null) return null;
        try { return JSON.readValue(value.toString(), TerminalRemoteControlDescription.class); }
        catch (tools.jackson.core.JacksonException invalid) {
            throw new IllegalStateException("REMOTE_CONTROL_DESCRIPTION_READBACK_INVALID", invalid);
        }
    }

    private static tools.jackson.databind.JsonNode json(JsonNode value) {
        if (value == null) return null;
        try { return JSON.readTree(value.toString()); }
        catch (tools.jackson.core.JacksonException invalid) {
            throw new IllegalStateException("REMOTE_CONTROL_DESCRIPTION_READBACK_INVALID", invalid);
        }
    }

    private static RemoteControlException failure(Failure failure) { return new RemoteControlException(failure); }
}
